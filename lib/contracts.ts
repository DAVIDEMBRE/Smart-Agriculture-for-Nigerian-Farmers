import { z } from "zod";

export const cropPredictionSchema = z.object({
  nitrogen: z.number().min(0).max(300),
  phosphorus: z.number().min(0).max(300),
  potassium: z.number().min(0).max(400),
  temperature_c: z.number().min(-10).max(65),
  humidity_pct: z.number().min(0).max(100),
  soil_ph: z.number().min(0).max(14),
  rainfall_mm: z.number().min(0).max(1000),
});

export type CropPredictionRequest = z.infer<typeof cropPredictionSchema>;

export const featureKeys = [
  "nitrogen",
  "phosphorus",
  "potassium",
  "temperature_c",
  "humidity_pct",
  "soil_ph",
  "rainfall_mm",
] as const;

export type FeatureKey = (typeof featureKeys)[number];

export const predictionAlternativeSchema = z.object({
  crop: z.string().min(1),
  model_score: z.number().min(0).max(1),
});

export type PredictionAlternative = z.infer<typeof predictionAlternativeSchema>;

export const explanationContributionSchema = z.object({
  feature: z.enum(featureKeys),
  direction: z.enum(["supports", "opposes"]),
  impact: z.number(),
});

export type ExplanationContribution = z.infer<typeof explanationContributionSchema>;

/**
 * Response shape shared by the deterministic fixture and the FastAPI service.
 * The client validates every response against this schema so a contract drift
 * surfaces as a handled `malformed` error instead of a runtime crash.
 */
export const cropPredictionResponseSchema = z.object({
  request_id: z.string().min(1),
  recommendation: z.string().min(1),
  model_score: z.number().min(0).max(1),
  alternatives: z.array(predictionAlternativeSchema),
  score_kind: z.enum(["uncalibrated_model_score", "calibrated_confidence"]),
  warnings: z.array(z.string()),
  explanations: z.array(explanationContributionSchema),
  model_version: z.string().min(1),
  schema_version: z.literal("1.0.0"),
  predicted_at: z.string().min(1),
});

export type CropPredictionResponse = z.infer<typeof cropPredictionResponseSchema>;

export const modelMetadataSchema = z.object({
  task: z.enum(["crop_recommendation", "irrigation_decision"]),
  name: z.string(),
  version: z.string(),
  status: z.enum(["fixture", "production", "unavailable"]),
  score_kind: z.enum(["uncalibrated_model_score", "calibrated_confidence"]),
  classes: z.number(),
  features: z.array(z.string()),
  held_out_accuracy: z.number().nullable(),
  release_gate: z.string().nullable(),
  /** Irrigation only: discloses how the source labels were binarised. */
  label_mapping: z.record(z.string(), z.string()).optional(),
});

export type ModelMetadata = z.infer<typeof modelMetadataSchema>;

/** `/api/v1/model-metadata` reports every model the deployment serves. */
export const modelMetadataListSchema = z.object({
  models: z.array(modelMetadataSchema).min(1),
});

export type ModelMetadataList = z.infer<typeof modelMetadataListSchema>;

export const readinessSchema = z.object({
  status: z.enum(["ready", "fixture-only"]),
  production_model_connected: z.boolean(),
  /** Which serving mode each task resolved to. */
  serving: z.object({
    crop_recommendation: z.enum(["fastapi", "native", "fixture"]),
    irrigation_decision: z.enum(["fastapi", "native", "unavailable"]),
  }),
  release_gate: z.string().nullable(),
});

export type Readiness = z.infer<typeof readinessSchema>;

export const uyoWeatherSchema = z.object({
  location: z.literal("Uyo, Akwa Ibom"),
  condition: z.string(),
  temperature_c: z.number(),
  feels_like_c: z.number(),
  humidity_pct: z.number(),
  pressure_hpa: z.number(),
  wind_speed_ms: z.number(),
  cloud_cover_pct: z.number(),
  rain_1h_mm: z.number(),
  observed_at: z.string(),
  fetched_at: z.string(),
  stale: z.boolean(),
  source: z.literal("OpenWeather"),
});

export type UyoWeather = z.infer<typeof uyoWeatherSchema>;

/**
 * Min and max of every feature in the training partition. Values outside these
 * bounds are accepted but warned about; the schema above is what rejects
 * physically impossible readings.
 */
export const trainingEnvelope: Record<FeatureKey, [number, number]> = {
  nitrogen: [0, 140],
  phosphorus: [5, 145],
  potassium: [5, 205],
  temperature_c: [8.8257, 43.6755],
  humidity_pct: [14.258, 99.9819],
  soil_ph: [3.5048, 9.9351],
  rainfall_mm: [20.2113, 298.5601],
};

export function envelopeWarnings(input: CropPredictionRequest): string[] {
  return featureKeys
    .filter((key) => input[key] < trainingEnvelope[key][0] || input[key] > trainingEnvelope[key][1])
    .map((key) => `${key} is outside the range represented in the training dataset.`);
}

/**
 * A percentage may only be presented as confidence once the serving model has
 * passed probability-calibration testing.
 */
export function isCalibrated(response: Pick<CropPredictionResponse, "score_kind">): boolean {
  return response.score_kind === "calibrated_confidence";
}

// ---------------------------------------------------------------------------
// Irrigation decision
// ---------------------------------------------------------------------------

/**
 * The irrigation model was trained on exactly these categories. They are the
 * only values the API accepts: the thesis pipeline's encoder silently treats an
 * unknown category as "no category", so the contract must reject it first.
 *
 * None of these five crops is among the 22 the recommender knows, so the two
 * models cannot be chained on the same crop.
 */
export const irrigationCrops = ["Carrot", "Chilli", "Potato", "Tomato", "Wheat"] as const;
export const irrigationSoils = [
  "Alluvial Soil",
  "Black Soil",
  "Chalky Soil",
  "Clay Soil",
  "Loam Soil",
  "Red Soil",
  "Sandy Soil",
] as const;
export const irrigationStages = [
  "Germination",
  "Seedling Stage",
  "Vegetative Growth / Root or Tuber Development",
  "Flowering",
  "Pollination",
  "Fruit/Grain/Bulb Formation",
  "Maturation",
  "Harvest",
] as const;

export type IrrigationCrop = (typeof irrigationCrops)[number];
export type IrrigationSoil = (typeof irrigationSoils)[number];
export type IrrigationStage = (typeof irrigationStages)[number];

export const irrigationRequestSchema = z.object({
  crop: z.enum(irrigationCrops),
  soil_type: z.enum(irrigationSoils),
  growth_stage: z.enum(irrigationStages),
  /** Soil moisture index. The dataset observes 1-100 and nothing outside it. */
  moisture_pct: z.number().min(1).max(100),
  temperature_c: z.number().min(-10).max(65),
  humidity_pct: z.number().min(0).max(100),
});

export type IrrigationRequest = z.infer<typeof irrigationRequestSchema>;

export const irrigationNumericKeys = ["moisture_pct", "temperature_c", "humidity_pct"] as const;
export type IrrigationNumericKey = (typeof irrigationNumericKeys)[number];

/** Observed range of each numeric input in the Smart Agriculture Dataset. */
export const irrigationEnvelope: Record<IrrigationNumericKey, [number, number]> = {
  moisture_pct: [1, 100],
  temperature_c: [13, 46],
  humidity_pct: [15, 91],
};

export function irrigationEnvelopeWarnings(input: IrrigationRequest): string[] {
  return irrigationNumericKeys
    .filter((key) => input[key] < irrigationEnvelope[key][0] || input[key] > irrigationEnvelope[key][1])
    .map((key) => `${key} is outside the range represented in the training dataset.`);
}

export const irrigationResponseSchema = z.object({
  request_id: z.string().min(1),
  decision: z.enum(["irrigate", "do_not_irrigate"]),
  /** Model probability of "irrigate". */
  model_score: z.number().min(0).max(1),
  score_kind: z.enum(["uncalibrated_model_score", "calibrated_confidence"]),
  warnings: z.array(z.string()),
  model_version: z.string().min(1),
  schema_version: z.literal("1.0.0"),
  predicted_at: z.string().min(1),
});

export type IrrigationResponse = z.infer<typeof irrigationResponseSchema>;
