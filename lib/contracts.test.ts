import { describe, expect, it } from "vitest";
import {
  cropPredictionSchema,
  envelopeWarnings,
  featureKeys,
  isCalibrated,
  trainingEnvelope,
} from "@/lib/contracts";
import { frozenSamples } from "@/lib/frozen-samples";

const rice = frozenSamples[0].input;

describe("crop prediction contract", () => {
  it("accepts the notebook rice sample", () => {
    expect(cropPredictionSchema.safeParse(rice).success).toBe(true);
  });

  it("requires all seven measurements", () => {
    for (const key of featureKeys) {
      const partial: Record<string, number> = { ...rice };
      delete partial[key];
      expect(cropPredictionSchema.safeParse(partial).success, `${key} should be required`).toBe(false);
    }
  });

  it("rejects a missing value supplied as an empty string or null", () => {
    expect(cropPredictionSchema.safeParse({ ...rice, nitrogen: "" }).success).toBe(false);
    expect(cropPredictionSchema.safeParse({ ...rice, nitrogen: null }).success).toBe(false);
    expect(cropPredictionSchema.safeParse({ ...rice, nitrogen: Number.NaN }).success).toBe(false);
  });

  it("rejects physically impossible values", () => {
    expect(cropPredictionSchema.safeParse({ ...rice, humidity_pct: 112 }).success).toBe(false);
    expect(cropPredictionSchema.safeParse({ ...rice, humidity_pct: -1 }).success).toBe(false);
    expect(cropPredictionSchema.safeParse({ ...rice, soil_ph: -2 }).success).toBe(false);
    expect(cropPredictionSchema.safeParse({ ...rice, soil_ph: 15 }).success).toBe(false);
    expect(cropPredictionSchema.safeParse({ ...rice, rainfall_mm: -1 }).success).toBe(false);
    expect(cropPredictionSchema.safeParse({ ...rice, temperature_c: -40 }).success).toBe(false);
  });

  it("names the offending field so the form can highlight it", () => {
    const parsed = cropPredictionSchema.safeParse({ ...rice, humidity_pct: 112 });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0].path[0]).toBe("humidity_pct");
  });
});

describe("training envelope", () => {
  it("stays silent for a reading drawn from the training data", () => {
    expect(envelopeWarnings(rice)).toEqual([]);
  });

  it("warns without rejecting plausible values outside the training data", () => {
    const input = { ...rice, temperature_c: 45 };
    expect(cropPredictionSchema.safeParse(input).success).toBe(true);
    expect(envelopeWarnings(input)).toContain("temperature_c is outside the range represented in the training dataset.");
  });

  it("warns once per feature that is out of range", () => {
    const input = { ...rice, temperature_c: 60, rainfall_mm: 900 };
    expect(envelopeWarnings(input)).toHaveLength(2);
  });

  it("treats the envelope bounds themselves as in range", () => {
    for (const key of featureKeys) {
      const [min, max] = trainingEnvelope[key];
      expect(envelopeWarnings({ ...rice, [key]: min })).toEqual([]);
      expect(envelopeWarnings({ ...rice, [key]: max })).toEqual([]);
    }
  });

  it("covers every model input", () => {
    expect(Object.keys(trainingEnvelope).sort()).toEqual([...featureKeys].sort());
  });
});

describe("score presentation gate", () => {
  it("only treats an explicitly calibrated score as confidence", () => {
    expect(isCalibrated({ score_kind: "uncalibrated_model_score" })).toBe(false);
    expect(isCalibrated({ score_kind: "calibrated_confidence" })).toBe(true);
  });
});
