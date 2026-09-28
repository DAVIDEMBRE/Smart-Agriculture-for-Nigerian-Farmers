import { featureKeys, type ModelMetadata, type ModelMetadataList } from "@/lib/contracts";
import { getCropModel, getIrrigationModel } from "@/lib/model-artifacts";
import { studyFacts } from "@/lib/research-data";

const fixtureMetadata: ModelMetadata = {
  task: "crop_recommendation",
  name: "Deterministic centroid interface fixture",
  version: "0.1.0",
  status: "fixture",
  score_kind: "uncalibrated_model_score",
  classes: studyFacts.cropClasses,
  features: [...featureKeys],
  held_out_accuracy: null,
  release_gate: "Export, checksum, and connect the production CatBoost artefact.",
};

export async function GET() {
  if (process.env.FASTAPI_BASE_URL) {
    const upstream = await fetch(`${process.env.FASTAPI_BASE_URL}/api/v1/model-metadata`, { cache: "no-store" });
    return new Response(await upstream.text(), { status: upstream.status, headers: { "content-type": "application/json" } });
  }

  const [crop, irrigation] = await Promise.all([getCropModel(), getIrrigationModel()]);

  const models: ModelMetadata[] = [
    crop
      ? {
          task: "crop_recommendation",
          name: crop.manifest.model_name,
          version: crop.manifest.model_version ?? "unknown",
          status: "production",
          score_kind: crop.manifest.serving?.score_kind ?? "uncalibrated_model_score",
          classes: crop.manifest.classes,
          features: [...featureKeys],
          held_out_accuracy: crop.manifest.metrics.held_out_accuracy,
          release_gate: crop.manifest.release_gate,
        }
      : fixtureMetadata,
    irrigation
      ? {
          task: "irrigation_decision",
          name: irrigation.manifest.model_name,
          version: irrigation.manifest.model_version ?? "unknown",
          status: "production",
          score_kind: irrigation.manifest.serving?.score_kind ?? "uncalibrated_model_score",
          classes: irrigation.manifest.classes,
          features: irrigation.manifest.feature_order,
          held_out_accuracy: irrigation.manifest.metrics.held_out_accuracy,
          release_gate: irrigation.manifest.release_gate,
          label_mapping: irrigation.manifest.label_mapping,
        }
      : {
          task: "irrigation_decision",
          name: "Irrigation decision model",
          version: "none",
          status: "unavailable",
          score_kind: "uncalibrated_model_score",
          classes: 2,
          features: [],
          held_out_accuracy: null,
          release_gate: "Retrain and export the irrigation pipeline (mlops/web_export.py).",
        },
  ];

  const payload: ModelMetadataList = { models };
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
}
