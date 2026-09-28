import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadCatBoostModel } from "@/lib/catboost-applier";
import { featureKeys, type CropPredictionRequest } from "@/lib/contracts";
import { frozenSamples } from "@/lib/frozen-samples";
import { productionManifestSchema } from "@/lib/manifest";

const root = path.resolve(__dirname, "..");
const readJson = (file: string) => JSON.parse(readFileSync(path.join(root, "artifacts", file), "utf8"));

type Golden = {
  feature_order: string[];
  classes: string[];
  rows: Array<{ input: number[]; label: string; predicted: string; proba: number[] }>;
};

const model = loadCatBoostModel(readJson("crop-catboost.model.json"));
const golden = readJson("crop-golden.json") as Golden;
const manifest = productionManifestSchema.parse(readJson("crop-manifest.json"));

function toRequest(values: number[]): CropPredictionRequest {
  return Object.fromEntries(featureKeys.map((key, index) => [key, values[index]])) as CropPredictionRequest;
}

describe("CatBoost applier against the golden file", () => {
  it("covers the full training set", () => {
    expect(golden.rows).toHaveLength(2200);
    expect(golden.feature_order).toEqual([...featureKeys]);
    expect(golden.classes).toEqual(model.classes);
  });

  it("reproduces every predicted label and probability", () => {
    let mismatches = 0;
    let maxAbs = 0;
    for (const row of golden.rows) {
      const proba = model.predictProba(toRequest(row.input));
      const predicted = model.classes[proba.indexOf(Math.max(...proba))];
      if (predicted !== row.predicted) mismatches += 1;
      for (let c = 0; c < proba.length; c += 1) maxAbs = Math.max(maxAbs, Math.abs(proba[c] - row.proba[c]));
    }
    expect(mismatches).toBe(0);
    expect(maxAbs).toBeLessThan(1e-6);
  });

  it("recomputes the accuracy the manifest records over the whole set", () => {
    // The manifest's accuracy is on the 440-row held-out partition; the full
    // set includes training rows, so it must be at least that high.
    const correct = golden.rows.filter((row) => model.predict(toRequest(row.input)).recommendation === row.label).length;
    expect(correct / golden.rows.length).toBeGreaterThanOrEqual(manifest.metrics.held_out_accuracy);
  });
});

describe("CatBoost applier on the frozen samples", () => {
  it.each(frozenSamples)("recovers $expected exactly", (sample) => {
    expect(model.predict(sample.input).recommendation).toBe(sample.expected);
  });

  it("returns probabilities that sum to one with three ordered alternatives", () => {
    const result = model.predict(frozenSamples[0].input);
    const proba = model.predictProba(frozenSamples[0].input);
    expect(Array.from(proba).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
    expect(result.alternatives).toHaveLength(3);
    expect(result.alternatives.map((a) => a.crop)).not.toContain(result.recommendation);
    expect(result.model_score).toBeGreaterThanOrEqual(result.alternatives[0].model_score);
  });
});

describe("crop manifest", () => {
  it("is a verified production manifest for the served artefact", () => {
    expect(manifest.status).toBe("production");
    expect(manifest.task).toBe("crop_recommendation");
    expect(manifest.metrics.held_out_accuracy).toBe(0.997727);
    expect(manifest.artifacts.model.path).toBe("artifacts/crop-catboost.model.json");
  });
});
