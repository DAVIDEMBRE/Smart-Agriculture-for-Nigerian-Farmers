import { randomUUID } from "node:crypto";
import { irrigationEnvelopeWarnings, irrigationRequestSchema, type IrrigationResponse } from "@/lib/contracts";
import { getIrrigationModel } from "@/lib/model-artifacts";

/**
 * Serving order: upstream FastAPI if configured, else the native TypeScript
 * XGBoost applier. There is deliberately no fixture for irrigation: a made-up
 * "water now" is worse than no answer.
 */
export async function POST(request: Request) {
  const requestId = randomUUID();
  const started = performance.now();
  const log = (fields: Record<string, unknown>) =>
    console.info(JSON.stringify({ event: "irrigation_prediction", request_id: requestId, latency_ms: Math.round(performance.now() - started), ...fields }));

  try {
    const parsed = irrigationRequestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return Response.json({ request_id: requestId, error: "invalid_input", issues: parsed.error.issues }, { status: 422 });
    }

    if (process.env.FASTAPI_BASE_URL) {
      const upstream = await fetch(`${process.env.FASTAPI_BASE_URL}/api/v1/predictions/irrigation`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": requestId },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(12_000),
      });
      log({ status: upstream.status, model: "fastapi" });
      return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
    }

    const loaded = await getIrrigationModel();
    if (!loaded) {
      log({ status: 503, model: "none" });
      return Response.json({ request_id: requestId, error: "model_unavailable" }, { status: 503 });
    }

    const warnings = irrigationEnvelopeWarnings(parsed.data);
    const prediction = loaded.model.predict(parsed.data);
    const result: IrrigationResponse = {
      request_id: requestId,
      decision: prediction.decision,
      model_score: prediction.model_score,
      score_kind: loaded.manifest.serving?.score_kind ?? "uncalibrated_model_score",
      warnings,
      model_version: `${loaded.manifest.model_name}@${loaded.manifest.model_version}`,
      schema_version: "1.0.0",
      predicted_at: new Date().toISOString(),
    };
    log({ status: 200, model: "xgboost-native", model_version: result.model_version, decision: result.decision, ood_count: warnings.length });
    return Response.json(result);
  } catch (error) {
    console.error(JSON.stringify({ event: "irrigation_prediction_error", request_id: requestId, latency_ms: Math.round(performance.now() - started), error: error instanceof Error ? error.message : "unknown" }));
    return Response.json({ request_id: requestId, error: "prediction_unavailable" }, { status: 503 });
  }
}
