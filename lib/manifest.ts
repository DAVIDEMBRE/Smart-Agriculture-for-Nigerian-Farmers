import { z } from "zod";

/**
 * Shape of the model manifests in `artifacts/` (`crop-manifest.json`,
 * `irrigation-manifest.json`), written by `mlops/web_export.py`.
 *
 * A manifest is the record that lets a served prediction be traced back to a
 * specific artefact, dataset and training run. A model may only be promoted
 * once every field it requires is populated and every checksum verifies.
 */
const artifactRefSchema = z.object({
  path: z.string().nullable(),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "sha256 must be 64 lowercase hex characters")
    .nullable(),
});

export const productionManifestSchema = z.object({
  schema_version: z.literal("1.0.0"),
  model_name: z.string().min(1),
  task: z.enum(["crop_recommendation", "irrigation_decision"]),
  model_version: z.string().nullable(),
  status: z.enum(["blocked_missing_artifact", "production"]),
  trained_at: z.string().nullable(),
  git_revision: z.string().nullable(),
  dataset_versions: z.record(z.string(), z.string()),
  feature_order: z.array(z.string()).min(1),
  classes: z.number().int().positive(),
  metrics: z
    .object({
      held_out_accuracy: z.number().min(0).max(1),
      macro_f1: z.number().min(0).max(1),
    })
    .catchall(z.number()),
  artifacts: z.record(z.string(), artifactRefSchema),
  release_gate: z.string().nullable(),
  serving: z
    .object({
      format: z.string(),
      score_kind: z.enum(["uncalibrated_model_score", "calibrated_confidence"]),
    })
    .optional(),
  /** Irrigation only: how the three-valued source column became a binary label. */
  label_mapping: z.record(z.string(), z.string()).optional(),
  label_2_rows_mapped_to_0: z.number().int().nonnegative().optional(),
  vocabulary: z.record(z.string(), z.array(z.string())).optional(),
  /** Set by `mlops/install_export.py` when the artefact came from a Colab run. */
  exported_in: z.string().optional(),
  notes: z.string().optional(),
});

export type ProductionManifest = z.infer<typeof productionManifestSchema>;

/** Fields that must all be populated before `status` may be `production`. */
export function missingPromotionFields(manifest: ProductionManifest): string[] {
  const missing: string[] = [];
  if (!manifest.model_version) missing.push("model_version");
  if (!manifest.trained_at) missing.push("trained_at");
  if (!manifest.git_revision) missing.push("git_revision");
  if (!("model" in manifest.artifacts)) missing.push("artifacts.model");

  for (const [name, ref] of Object.entries(manifest.artifacts)) {
    if (!ref.path) missing.push(`artifacts.${name}.path`);
    if (!ref.sha256) missing.push(`artifacts.${name}.sha256`);
  }

  for (const [dataset, version] of Object.entries(manifest.dataset_versions)) {
    if (version === "local-unversioned") missing.push(`dataset_versions.${dataset}`);
  }

  return missing;
}

/**
 * A manifest is internally consistent when its `status` matches whether the
 * promotion fields are actually filled in. This is what stops a manifest
 * claiming `production` while its checksums are still null.
 */
export function manifestConsistencyErrors(manifest: ProductionManifest): string[] {
  const missing = missingPromotionFields(manifest);
  if (manifest.status === "production") {
    const errors = missing.map((field) => `status is "production" but ${field} is not populated`);
    if (manifest.task === "irrigation_decision" && !manifest.label_mapping) {
      errors.push("an irrigation manifest must disclose its label_mapping");
    }
    return errors;
  }
  if (missing.length === 0) {
    return ['every promotion field is populated but status is still "blocked_missing_artifact"'];
  }
  if (!manifest.release_gate) {
    return ["a blocked manifest must state its release_gate"];
  }
  return [];
}
