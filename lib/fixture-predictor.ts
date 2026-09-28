import type { CropPredictionRequest, CropPredictionResponse, PredictionAlternative } from "@/lib/contracts";
import { envelopeWarnings } from "@/lib/contracts";

const cropCentroids: Record<string, number[]> = {
  apple: [20.8, 134.22, 199.89, 22.6309, 92.3334, 5.9297, 112.6548],
  banana: [100.23, 82.01, 50.05, 27.3768, 80.3581, 5.9839, 104.627],
  blackgram: [40.02, 67.47, 19.24, 29.9733, 65.1184, 7.134, 67.8842],
  chickpea: [40.09, 67.79, 79.92, 18.8728, 16.8604, 7.337, 80.059],
  coconut: [21.98, 16.93, 30.59, 27.4099, 94.8443, 5.9766, 175.6866],
  coffee: [101.2, 28.74, 29.94, 25.5405, 58.8698, 6.7903, 158.0663],
  cotton: [117.77, 46.24, 19.56, 23.989, 79.8435, 6.9127, 80.398],
  grapes: [23.18, 132.53, 200.11, 23.8496, 81.8752, 6.0259, 69.6118],
  jute: [78.4, 46.86, 39.99, 24.9584, 79.6399, 6.7328, 174.7928],
  kidneybeans: [20.75, 67.54, 20.05, 20.1151, 21.6054, 5.7494, 105.9198],
  lentil: [18.77, 68.36, 19.41, 24.5091, 64.8048, 6.9279, 45.6805],
  maize: [77.76, 48.44, 19.79, 22.3892, 65.0922, 6.2452, 84.767],
  mango: [20.07, 27.18, 29.92, 31.2088, 50.1566, 5.7664, 94.7045],
  mothbeans: [21.44, 48.01, 20.23, 28.1949, 53.1604, 6.8312, 51.1985],
  mungbean: [20.99, 47.28, 19.87, 28.5258, 85.5, 6.724, 48.4036],
  muskmelon: [100.32, 17.72, 50.08, 28.6631, 92.3428, 6.3588, 24.69],
  orange: [19.58, 16.55, 10.01, 22.7657, 92.1702, 7.017, 110.475],
  papaya: [49.88, 59.05, 50.04, 33.7239, 92.4034, 6.7414, 142.6278],
  pigeonpeas: [20.73, 67.73, 20.29, 27.7418, 48.0616, 5.7942, 149.4576],
  pomegranate: [18.87, 18.75, 40.21, 21.8378, 90.1255, 6.4292, 107.5284],
  rice: [79.89, 47.58, 39.87, 23.6893, 82.2728, 6.4255, 236.1811],
  watermelon: [99.42, 17, 50.22, 25.5918, 85.1604, 6.4958, 50.7862],
};

const scales = [140, 140, 200, 35, 85, 6.5, 280];

function vector(input: CropPredictionRequest) {
  return [input.nitrogen, input.phosphorus, input.potassium, input.temperature_c, input.humidity_pct, input.soil_ph, input.rainfall_mm];
}

export function fixturePredict(input: CropPredictionRequest, requestId: string): CropPredictionResponse {
  const values = vector(input);
  const distances = Object.entries(cropCentroids).map(([crop, centroid]) => {
    const distance = Math.sqrt(values.reduce((sum, value, index) => sum + ((value - centroid[index]) / scales[index]) ** 2, 0));
    return { crop, raw: Math.exp(-3.2 * distance) };
  });
  const total = distances.reduce((sum, item) => sum + item.raw, 0);
  const ranked: PredictionAlternative[] = distances
    .map(({ crop, raw }) => ({ crop, model_score: raw / total }))
    .sort((a, b) => b.model_score - a.model_score)
    .slice(0, 4);

  return {
    request_id: requestId,
    recommendation: ranked[0].crop,
    model_score: ranked[0].model_score,
    alternatives: ranked.slice(1),
    score_kind: "uncalibrated_model_score",
    warnings: [
      "This result uses the deterministic interface fixture. The production CatBoost artefact has not yet been supplied.",
      ...envelopeWarnings(input),
    ],
    explanations: [],
    model_version: "centroid-interface-fixture-0.1.0",
    schema_version: "1.0.0",
    predicted_at: new Date().toISOString(),
  };
}
