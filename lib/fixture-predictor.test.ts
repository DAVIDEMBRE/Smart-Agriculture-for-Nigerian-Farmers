import { describe, expect, it } from "vitest";
import { fixturePredict } from "@/lib/fixture-predictor";
import { frozenSamples } from "@/lib/frozen-samples";
import { cropPredictionResponseSchema } from "@/lib/contracts";

const rice = frozenSamples[0].input;

describe("deterministic prediction fixture", () => {
  it("emits a response that satisfies the shared schema", () => {
    const result = fixturePredict(rice, "test-id");
    expect(cropPredictionResponseSchema.safeParse(result).success).toBe(true);
  });

  it("labels itself as a fixture in both the version and the warnings", () => {
    const result = fixturePredict(rice, "test-id");
    expect(result.model_version).toContain("fixture");
    expect(result.warnings[0]).toContain("production CatBoost artefact");
  });

  it("never presents its score as calibrated confidence", () => {
    expect(fixturePredict(rice, "test-id").score_kind).toBe("uncalibrated_model_score");
  });

  it("returns no explanations until SHAP output is verified", () => {
    expect(fixturePredict(rice, "test-id").explanations).toEqual([]);
  });

  it("is deterministic for a given input", () => {
    const first = fixturePredict(rice, "a");
    const second = fixturePredict(rice, "b");
    expect(second.recommendation).toBe(first.recommendation);
    expect(second.model_score).toBe(first.model_score);
  });

  it("returns ordered alternatives that do not include the recommendation", () => {
    const result = fixturePredict(frozenSamples[1].input, "test-id");
    expect(result.alternatives).toHaveLength(3);
    expect(result.alternatives.map((item) => item.crop)).not.toContain(result.recommendation);
    for (let index = 1; index < result.alternatives.length; index += 1) {
      expect(result.alternatives[index - 1].model_score).toBeGreaterThanOrEqual(result.alternatives[index].model_score);
    }
  });

  it("scores the recommendation at least as highly as every alternative", () => {
    const result = fixturePredict(rice, "test-id");
    for (const alternative of result.alternatives) {
      expect(result.model_score).toBeGreaterThanOrEqual(alternative.model_score);
    }
  });

  it("appends an envelope warning for a reading outside the training range", () => {
    const result = fixturePredict({ ...rice, rainfall_mm: 640 }, "test-id");
    expect(result.warnings.some((warning) => warning.includes("rainfall_mm"))).toBe(true);
  });
});

/**
 * The release contract names rice, mothbeans and papaya as the regression cases.
 * Exact label recovery is a gate on the production CatBoost artefact. Against
 * the fixture these tests pin current behaviour so it cannot drift unnoticed.
 */
describe("frozen regression samples", () => {
  it.each(frozenSamples)("pins the fixture output for the $expected row", (sample) => {
    expect(fixturePredict(sample.input, "test-id").recommendation).toBe(sample.fixtureRecommendation);
  });

  it.each(frozenSamples)("ranks the true $expected label within the fixture's top four", (sample) => {
    const result = fixturePredict(sample.input, "test-id");
    const ranked = [result.recommendation, ...result.alternatives.map((item) => item.crop)];
    expect(ranked).toContain(sample.expected);
  });

  it("recovers the label exactly for every sample the fixture is expected to get right", () => {
    const exact = frozenSamples.filter((sample) => sample.expected === sample.fixtureRecommendation);
    expect(exact.map((sample) => sample.expected)).toEqual(["rice", "papaya"]);
    for (const sample of exact) {
      expect(fixturePredict(sample.input, "test-id").recommendation).toBe(sample.expected);
    }
  });
});
