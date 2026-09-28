import { randomUUID } from "node:crypto";
import { cropPredictionSchema, envelopeWarnings, type CropPredictionResponse } from "@/lib/contracts";
import { fixturePredict } from "@/lib/fixture-predictor";
import { getCropModel } from "@/lib/model-artifacts";

/**
 * Serving order: an upstream FastAPI service if configured, else the native
 * TypeScript CatBoost applier, else the deterministic interface fixture.
 */
export async function POST(request: Request) {
  const requestId = randomUUID();
  const started = performance.now();
  const log = (fields: Record<string, unknown>) =>
    console.info(JSON.stringify({ event: "crop_prediction", request_id: requestId, latency_ms: Math.round(performance.now() - started), ...fields }));

  try {
    const parsed = cropPredictionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ request_id: requestId, error: "invalid_input", issues: parsed.error.issues }, { status: 422 });
    }

    if (process.env.FASTAPI_BASE_URL) {
      const upstream = await fetch(`${process.env.FASTAPI_BASE_URL}/api/v1/predictions/crop`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": requestId },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(12_000),
      });
      log({ status: upstream.status, model: "fastapi" });
      return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
    }

    const loaded = await getCropModel();
    if (loaded) {
      const warnings = envelopeWarnings(parsed.data);
      const prediction = loaded.model.predict(parsed.data);
      const result: CropPredictionResponse = {
        request_id: requestId,
        recommendation: prediction.recommendation,
        model_score: prediction.model_score,
        alternatives: prediction.alternatives,
        score_kind: loaded.manifest.serving?.score_kind ?? "uncalibrated_model_score",
        warnings,
        // Per-input explanations stay withheld until CatBoost-specific SHAP
        // output is verified against the frozen samples (mlops/README.md).
        explanations: [],
        model_version: `${loaded.manifest.model_name}@${loaded.manifest.model_version}`,
        schema_version: "1.0.0",
        predicted_at: new Date().toISOString(),
      };
      log({ status: 200, model: "catboost-native", model_version: result.model_version, ood_count: warnings.length });
      return Response.json(result);
    }

    const result = fixturePredict(parsed.data, requestId);
    log({ status: 200, model: result.model_version, ood_count: result.warnings.length - 1 });
    return Response.json(result);
  } catch (error) {
    console.error(JSON.stringify({ event: "crop_prediction_error", request_id: requestId, latency_ms: Math.round(performance.now() - started), error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ request_id: requestId, error: "prediction_unavailable" }, { status: 503 });
  }
}
