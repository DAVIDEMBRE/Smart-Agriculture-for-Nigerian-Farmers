import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  errorMessageKey,
  fetchModelMetadata,
  fetchReadiness,
  fetchUyoWeather,
  predictCrop,
  predictIrrigation,
} from "@/lib/api-client";
import { frozenSamples } from "@/lib/frozen-samples";
import type { CropPredictionResponse } from "@/lib/contracts";

const rice = frozenSamples[0].input;

const validResponse: CropPredictionResponse = {
  request_id: "3f6f6d1e-0000-4000-8000-000000000000",
  recommendation: "rice",
  model_score: 0.82,
  alternatives: [{ crop: "jute", model_score: 0.09 }],
  score_kind: "uncalibrated_model_score",
  warnings: ["This result uses the deterministic interface fixture."],
  explanations: [],
  model_version: "centroid-interface-fixture-0.1.0",
  schema_version: "1.0.0",
  predicted_at: "2026-08-23T12:00:00.000Z",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  // `navigator` is absent under the node environment; the client treats that as online.
  vi.stubGlobal("navigator", { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("predictCrop", () => {
  it("returns a schema-valid response", async () => {
    fetchMock.mockResolvedValue(jsonResponse(validResponse));
    await expect(predictCrop(rice)).resolves.toMatchObject({ recommendation: "rice" });

    const [path, init] = fetchMock.mock.calls[0];
    expect(path).toBe("/api/v1/predictions/crop");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual(rice);
  });

  it("maps a 422 onto per-field issues", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { error: "invalid_input", issues: [{ path: ["humidity_pct"], message: "Too big: expected number to be <=100" }] },
        422,
      ),
    );

    const error = await predictCrop({ ...rice, humidity_pct: 112 }).catch((thrown: unknown) => thrown);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).kind).toBe("invalid_input");
    expect((error as ApiError).fieldIssues.humidity_pct).toMatch(/100/);
  });

  it("tolerates a 422 body without a usable issue list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "invalid_input" }, 422));
    const error = (await predictCrop(rice).catch((thrown: unknown) => thrown)) as ApiError;
    expect(error.kind).toBe("invalid_input");
    expect(error.fieldIssues).toEqual({});
  });

  it("maps model unavailability onto `unavailable`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "prediction_unavailable" }, 503));
    await expect(predictCrop(rice)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps a malformed response body onto `malformed`", async () => {
    fetchMock.mockResolvedValue(new Response("<html>gateway</html>", { status: 200 }));
    await expect(predictCrop(rice)).rejects.toMatchObject({ kind: "malformed" });
  });

  it("maps a response that drifts from the schema onto `malformed`", async () => {
    const drifted = { ...validResponse, schema_version: "2.0.0" };
    fetchMock.mockResolvedValue(jsonResponse(drifted));
    await expect(predictCrop(rice)).rejects.toMatchObject({ kind: "malformed" });
  });

  it("maps a score outside 0-1 onto `malformed` rather than rendering it", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...validResponse, model_score: 8.2 }));
    await expect(predictCrop(rice)).rejects.toMatchObject({ kind: "malformed" });
  });

  it("maps a timeout onto `timeout`", async () => {
    fetchMock.mockRejectedValue(new DOMException("The operation timed out.", "TimeoutError"));
    await expect(predictCrop(rice)).rejects.toMatchObject({ kind: "timeout" });
  });

  it("maps a transport failure onto `unavailable`", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(predictCrop(rice)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("short-circuits when the browser reports it is offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    await expect(predictCrop(rice)).rejects.toMatchObject({ kind: "offline" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("propagates a caller-initiated abort instead of reporting a timeout", async () => {
    const controller = new AbortController();
    controller.abort();
    fetchMock.mockRejectedValue(new DOMException("Aborted", "AbortError"));
    await expect(predictCrop(rice, { signal: controller.signal })).rejects.toBeInstanceOf(DOMException);
  });
});

describe("fetchUyoWeather", () => {
  const weather = {
    location: "Uyo, Akwa Ibom",
    condition: "light rain",
    temperature_c: 26.4,
    feels_like_c: 29.1,
    humidity_pct: 88,
    pressure_hpa: 1010,
    wind_speed_ms: 2.6,
    cloud_cover_pct: 75,
    rain_1h_mm: 1.24,
    observed_at: "2026-08-23T11:55:00.000Z",
    fetched_at: "2026-08-23T12:00:00.000Z",
    stale: false,
    source: "OpenWeather",
  };

  it("returns a validated observation", async () => {
    fetchMock.mockResolvedValue(jsonResponse(weather));
    await expect(fetchUyoWeather()).resolves.toMatchObject({ condition: "light rain" });
  });

  it("maps an unconfigured or failing weather route onto `unavailable`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "weather_not_configured" }, 503));
    await expect(fetchUyoWeather()).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps a drifted weather payload onto `malformed`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...weather, location: "Lagos" }));
    await expect(fetchUyoWeather()).rejects.toMatchObject({ kind: "malformed" });
  });
});

describe("fetchReadiness", () => {
  const serving = { crop_recommendation: "fixture", irrigation_decision: "unavailable" };

  it("treats a fixture-only 503 as a state to render, not a failure", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: "fixture-only", production_model_connected: false, serving, release_gate: "Export CatBoost." }, 503),
    );
    await expect(fetchReadiness()).resolves.toMatchObject({ status: "fixture-only" });
  });

  it("reports both models serving natively", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          status: "ready",
          production_model_connected: true,
          serving: { crop_recommendation: "native", irrigation_decision: "native" },
          release_gate: null,
        },
        200,
      ),
    );
    await expect(fetchReadiness()).resolves.toMatchObject({ serving: { irrigation_decision: "native" } });
  });

  it("maps any other status onto `unavailable`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 500));
    await expect(fetchReadiness()).rejects.toMatchObject({ kind: "unavailable" });
  });
});

describe("fetchModelMetadata", () => {
  it("returns validated metadata for every served model", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        models: [
          {
            task: "crop_recommendation",
            name: "crop-recommendation-catboost",
            version: "1.0.0",
            status: "production",
            score_kind: "uncalibrated_model_score",
            classes: 22,
            features: ["nitrogen"],
            held_out_accuracy: 0.997727,
            release_gate: null,
          },
          {
            task: "irrigation_decision",
            name: "irrigation-decision-xgboost",
            version: "1.0.0",
            status: "production",
            score_kind: "uncalibrated_model_score",
            classes: 2,
            features: ["crop_id"],
            held_out_accuracy: 0.999695,
            release_gate: null,
            label_mapping: { "2": "mapped_to_0" },
          },
        ],
      }),
    );
    const metadata = await fetchModelMetadata();
    expect(metadata.models).toHaveLength(2);
    expect(metadata.models[1].label_mapping?.["2"]).toBe("mapped_to_0");
  });

  it("rejects a response without a models list", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ name: "x" }));
    await expect(fetchModelMetadata()).rejects.toMatchObject({ kind: "malformed" });
  });
});

describe("predictIrrigation", () => {
  const request = { crop: "Wheat", soil_type: "Black Soil", growth_stage: "Germination", moisture_pct: 2, temperature_c: 26, humidity_pct: 77 } as const;
  const response = {
    request_id: "3f6f6d1e-0000-4000-8000-000000000001",
    decision: "irrigate",
    model_score: 0.9994,
    score_kind: "uncalibrated_model_score",
    warnings: [],
    model_version: "irrigation-decision-xgboost@1.0.0",
    schema_version: "1.0.0",
    predicted_at: "2026-09-22T00:00:00.000Z",
  };

  it("returns a schema-valid decision", async () => {
    fetchMock.mockResolvedValue(jsonResponse(response));
    await expect(predictIrrigation(request)).resolves.toMatchObject({ decision: "irrigate" });
    expect(fetchMock.mock.calls[0][0]).toBe("/api/v1/predictions/irrigation");
  });

  it("maps a rejected category onto a field issue", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: "invalid_input", issues: [{ path: ["crop"], message: "Invalid option" }] }, 422),
    );
    const error = (await predictIrrigation(request).catch((thrown: unknown) => thrown)) as ApiError;
    expect(error.kind).toBe("invalid_input");
    expect(error.fieldIssues.crop).toBe("Invalid option");
  });

  it("maps a missing model artefact onto `unavailable`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: "model_unavailable" }, 503));
    await expect(predictIrrigation(request)).rejects.toMatchObject({ kind: "unavailable" });
  });

  it("maps an unknown decision value onto `malformed`", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...response, decision: "maybe" }));
    await expect(predictIrrigation(request)).rejects.toMatchObject({ kind: "malformed" });
  });
});

describe("errorMessageKey", () => {
  it("names the kind for an ApiError and falls back to generic otherwise", () => {
    expect(errorMessageKey(new ApiError("timeout", "slow"))).toBe("timeout");
    expect(errorMessageKey(new Error("boom"))).toBe("generic");
  });
});
