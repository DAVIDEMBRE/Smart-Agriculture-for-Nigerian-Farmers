import { z } from "zod";
import { featureKeys, type CropPredictionRequest, type PredictionAlternative } from "@/lib/contracts";

/**
 * Applier for the compact CatBoost export written by `mlops/web_export.py`.
 *
 * This is a line-for-line port of `catboost_reference_predict_proba` in that
 * module, which is asserted against the CatBoost library on every training row
 * before the artefact is written. The golden file test in
 * `catboost-applier.test.ts` asserts the same thing about this port.
 *
 * CatBoost trees are oblivious: every node at a given depth uses the same
 * split, so a leaf index is just the bit pattern of the split outcomes.
 * Comparisons happen in float32 because that is what CatBoost does internally.
 */

export const compactCatBoostSchema = z.object({
  schema_version: z.literal("1.0.0"),
  kind: z.literal("catboost-oblivious-multiclass"),
  feature_order: z.array(z.enum(featureKeys)).length(featureKeys.length),
  scaler: z.object({ mean: z.array(z.number()), scale: z.array(z.number()) }),
  classes: z.array(z.string().min(1)).min(2),
  scale: z.number(),
  bias: z.array(z.number()),
  trees: z.array(
    z.object({
      splits: z.array(z.tuple([z.number().int().nonnegative(), z.number()])),
      /** base64 of little-endian float64, laid out leaf-major: `[leaf][class]`. */
      leaves: z.string().min(1),
    }),
  ),
});

export type CompactCatBoost = z.infer<typeof compactCatBoostSchema>;

type DecodedTree = { features: Int32Array; borders: Float32Array; leaves: Float64Array };

export type CatBoostModel = {
  classes: string[];
  featureOrder: CompactCatBoost["feature_order"];
  predictProba: (input: CropPredictionRequest) => Float64Array;
  predict: (input: CropPredictionRequest) => { recommendation: string; model_score: number; alternatives: PredictionAlternative[] };
};

function decodeF64(base64: string): Float64Array {
  const bytes = Buffer.from(base64, "base64");
  return new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
}

/** Parses and validates the compact export once; the returned model is pure. */
export function loadCatBoostModel(raw: unknown): CatBoostModel {
  const compact = compactCatBoostSchema.parse(raw);
  const nClasses = compact.classes.length;
  if (compact.bias.length !== nClasses) throw new Error("bias length does not match class count");
  if (compact.scaler.mean.length !== featureKeys.length || compact.scaler.scale.length !== featureKeys.length) {
    throw new Error("scaler does not cover the seven features");
  }

  const trees: DecodedTree[] = compact.trees.map((tree, index) => {
    const leaves = decodeF64(tree.leaves);
    const expected = (1 << tree.splits.length) * nClasses;
    if (leaves.length !== expected) throw new Error(`tree ${index} has ${leaves.length} leaf values, expected ${expected}`);
    return {
      features: Int32Array.from(tree.splits, ([feature]) => feature),
      borders: Float32Array.from(tree.splits, ([, border]) => border),
      leaves,
    };
  });

  const mean = compact.scaler.mean;
  const scale = compact.scaler.scale;
  const order = compact.feature_order;

  function predictProba(input: CropPredictionRequest): Float64Array {
    // Scale in float64, then round to float32 exactly as the library does.
    const x = new Float32Array(order.length);
    for (let i = 0; i < order.length; i += 1) x[i] = (input[order[i]] - mean[i]) / scale[i];

    const raw = new Float64Array(nClasses);
    for (const tree of trees) {
      let leaf = 0;
      for (let depth = 0; depth < tree.features.length; depth += 1) {
        if (x[tree.features[depth]] > tree.borders[depth]) leaf |= 1 << depth;
      }
      const base = leaf * nClasses;
      for (let c = 0; c < nClasses; c += 1) raw[c] += tree.leaves[base + c];
    }

    let max = -Infinity;
    for (let c = 0; c < nClasses; c += 1) {
      raw[c] = raw[c] * compact.scale + compact.bias[c];
      if (raw[c] > max) max = raw[c];
    }
    let sum = 0;
    for (let c = 0; c < nClasses; c += 1) {
      raw[c] = Math.exp(raw[c] - max);
      sum += raw[c];
    }
    for (let c = 0; c < nClasses; c += 1) raw[c] /= sum;
    return raw;
  }

  function predict(input: CropPredictionRequest) {
    const proba = predictProba(input);
    const ranked = Array.from(proba, (model_score, index) => ({ crop: compact.classes[index], model_score }))
      .sort((a, b) => b.model_score - a.model_score);
    return { recommendation: ranked[0].crop, model_score: ranked[0].model_score, alternatives: ranked.slice(1, 4) };
  }

  return { classes: compact.classes, featureOrder: order, predictProba, predict };
}
