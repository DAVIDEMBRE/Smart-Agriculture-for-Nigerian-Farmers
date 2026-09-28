import type { CropPredictionRequest } from "@/lib/contracts";

export type FrozenSample = {
  /** The label recorded for this row in the source dataset. */
  expected: string;
  input: CropPredictionRequest;
  /**
   * What the deterministic centroid fixture currently returns. The fixture is a
   * crude stand-in for CatBoost, so this is not always `expected`; recording it
   * means any unintended drift in the fixture fails a test.
   */
  fixtureRecommendation: string;
};

/**
 * Regression samples taken verbatim from `Data/Crop_recommendation.csv`, one per
 * crop named in the release contract.
 *
 * Exact recovery of `expected` is a gate on the production CatBoost artefact,
 * not on the fixture: all three cases must be replayed against the exported
 * model before `FASTAPI_BASE_URL` is connected. `mlops/README.md` records it.
 */
export const frozenSamples: FrozenSample[] = [
  {
    expected: "rice",
    fixtureRecommendation: "rice",
    input: {
      nitrogen: 90,
      phosphorus: 42,
      potassium: 43,
      temperature_c: 20.87974371,
      humidity_pct: 82.00274423,
      soil_ph: 6.502985292,
      rainfall_mm: 202.9355362,
    },
  },
  {
    // The fixture ranks mothbeans second here: N=3 and pH=3.69 sit far from the
    // mothbeans centroid, which a distance-based stand-in cannot resolve.
    expected: "mothbeans",
    fixtureRecommendation: "mango",
    input: {
      nitrogen: 3,
      phosphorus: 49,
      potassium: 18,
      temperature_c: 27.91095209,
      humidity_pct: 64.70930606,
      soil_ph: 3.692863601,
      rainfall_mm: 32.67891866,
    },
  },
  {
    expected: "papaya",
    fixtureRecommendation: "papaya",
    input: {
      nitrogen: 61,
      phosphorus: 68,
      potassium: 50,
      temperature_c: 35.21462816,
      humidity_pct: 91.49725058,
      soil_ph: 6.793245417,
      rainfall_mm: 243.0745066,
    },
  },
];
