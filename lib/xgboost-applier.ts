import { z } from "zod";
import {
  irrigationCrops,
  irrigationNumericKeys,
  irrigationSoils,
  irrigationStages,
  type IrrigationRequest,
} from "@/lib/contracts";

/**
 * Applier for the compact irrigation export written by `mlops/web_export.py`:
 * the thesis pipeline's ColumnTransformer (StandardScaler on the three numeric
 * inputs, one-hot on the three categorical inputs) followed by a binary
 * XGBoost.
 *
 * A port of `xgboost_reference_predict_proba`, asserted against the library on
 * all 16,411 rows before export and again in `xgboost-applier.test.ts`.
 *
 * One property of the thesis model matters here: the ColumnTransformer emitted
 * a sparse matrix, so XGBoost was trained seeing every one-hot zero (and any
 * exactly-zero scaled value) as *missing* and routing it by `default_left`.
 * The applier reproduces that by encoding zeros as NaN.
 */

export const compactXGBoostSchema = z.object({
  schema_version: z.literal("1.0.0"),
  kind: z.literal("xgboost-binary-logistic"),
  sparse_zeros_are_missing: z.literal(true),
  numeric_order: z.array(z.enum(irrigationNumericKeys)).length(irrigationNumericKeys.length),
  categorical_order: z.tuple([z.literal("crop"), z.literal("soil_type"), z.literal("growth_stage")]),
  scaler: z.object({ mean: z.array(z.number()).length(3), scale: z.array(z.number()).length(3) }),
  vocabulary: z.object({
    crop: z.array(z.string()),
    soil_type: z.array(z.string()),
    growth_stage: z.array(z.string()),
  }),
  /** Stored by XGBoost as a probability; the margin starts at its logit. */
  base_score: z.number().gt(0).lt(1),
  trees: z.array(
    z.object({
      feature: z.array(z.number().int()),
      threshold: z.array(z.number()),
      left: z.array(z.number().int()),
      right: z.array(z.number().int()),
      default_left: z.array(z.number().int()),
    }),
  ),
});

export type CompactXGBoost = z.infer<typeof compactXGBoostSchema>;

export type XGBoostModel = {
  vocabulary: CompactXGBoost["vocabulary"];
  /** Probability of "irrigate". */
  predictProba: (input: IrrigationRequest) => number;
  predict: (input: IrrigationRequest) => { decision: "irrigate" | "do_not_irrigate"; model_score: number };
};

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && [...a].sort().every((value, index) => value === [...b].sort()[index]);
}

/** Parses and validates the compact export once; the returned model is pure. */
export function loadXGBoostModel(raw: unknown): XGBoostModel {
  const compact = compactXGBoostSchema.parse(raw);

  // The contract enums and the model vocabulary must agree exactly, or the API
  // would accept a category the model has never seen.
  if (!sameSet(compact.vocabulary.crop, irrigationCrops)) throw new Error("crop vocabulary differs from the contract");
  if (!sameSet(compact.vocabulary.soil_type, irrigationSoils)) throw new Error("soil vocabulary differs from the contract");
  if (!sameSet(compact.vocabulary.growth_stage, irrigationStages)) throw new Error("stage vocabulary differs from the contract");

  const trees = compact.trees.map((tree, index) => {
    const n = tree.feature.length;
    if ([tree.threshold, tree.left, tree.right, tree.default_left].some((arr) => arr.length !== n)) {
      throw new Error(`tree ${index} has inconsistent node arrays`);
    }
    return {
      feature: Int32Array.from(tree.feature),
      threshold: Float32Array.from(tree.threshold),
      leafValue: Float64Array.from(tree.threshold),
      left: Int32Array.from(tree.left),
      right: Int32Array.from(tree.right),
      defaultLeft: Uint8Array.from(tree.default_left),
    };
  });

  const baseMargin = Math.log(compact.base_score / (1 - compact.base_score));
  const featureCount = 3 + compact.vocabulary.crop.length + compact.vocabulary.soil_type.length + compact.vocabulary.growth_stage.length;
  const cropIndex = new Map(compact.vocabulary.crop.map((v, i) => [v, i]));
  const soilIndex = new Map(compact.vocabulary.soil_type.map((v, i) => [v, i]));
  const stageIndex = new Map(compact.vocabulary.growth_stage.map((v, i) => [v, i]));
  const soilOffset = 3 + compact.vocabulary.crop.length;
  const stageOffset = soilOffset + compact.vocabulary.soil_type.length;

  /** Replicates the sparse ColumnTransformer output: zeros are NaN (missing). */
  function encode(input: IrrigationRequest): Float32Array {
    const x = new Float32Array(featureCount).fill(Number.NaN);
    for (let i = 0; i < 3; i += 1) {
      const scaled = (input[compact.numeric_order[i]] - compact.scaler.mean[i]) / compact.scaler.scale[i];
      if (scaled !== 0) x[i] = scaled;
    }
    x[3 + cropIndex.get(input.crop)!] = 1;
    x[soilOffset + soilIndex.get(input.soil_type)!] = 1;
    x[stageOffset + stageIndex.get(input.growth_stage)!] = 1;
    return x;
  }

  function predictProba(input: IrrigationRequest): number {
    const x = encode(input);
    let margin = baseMargin;
    for (const tree of trees) {
      let node = 0;
      while (tree.left[node] !== -1) {
        const value = x[tree.feature[node]];
        if (Number.isNaN(value)) node = tree.defaultLeft[node] ? tree.left[node] : tree.right[node];
        else node = value < tree.threshold[node] ? tree.left[node] : tree.right[node];
      }
      margin += tree.leafValue[node];
    }
    return 1 / (1 + Math.exp(-margin));
  }

  function predict(input: IrrigationRequest) {
    const model_score = predictProba(input);
    return { decision: model_score >= 0.5 ? ("irrigate" as const) : ("do_not_irrigate" as const), model_score };
  }

  return { vocabulary: compact.vocabulary, predictProba, predict };
}
