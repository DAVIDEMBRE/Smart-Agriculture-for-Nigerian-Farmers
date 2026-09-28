import type { Readiness } from "@/lib/contracts";
import { getCropModel, getIrrigationModel } from "@/lib/model-artifacts";

export async function GET() {
  const fastapi = Boolean(process.env.FASTAPI_BASE_URL);
  const [crop, irrigation] = fastapi ? [null, null] : await Promise.all([getCropModel(), getIrrigationModel()]);

  const serving: Readiness["serving"] = {
    crop_recommendation: fastapi ? "fastapi" : crop ? "native" : "fixture",
    irrigation_decision: fastapi ? "fastapi" : irrigation ? "native" : "unavailable",
  };
  const production = serving.crop_recommendation !== "fixture";

  const payload: Readiness = {
    status: production ? "ready" : "fixture-only",
    production_model_connected: production,
    serving,
    release_gate: production
      ? serving.irrigation_decision === "unavailable"
        ? "Irrigation model artefact is missing; the crop recommender is live."
        : null
      : "Export the CatBoost artefact (mlops/web_export.py) or connect FASTAPI_BASE_URL.",
  };
  return Response.json(payload, { status: production ? 200 : 503, headers: { "cache-control": "no-store" } });
}
