import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadCatBoostModel, type CatBoostModel } from "@/lib/catboost-applier";
import { productionManifestSchema, type ProductionManifest } from "@/lib/manifest";
import { loadXGBoostModel, type XGBoostModel } from "@/lib/xgboost-applier";

/**
 * Loads the served model artefacts from `artifacts/` once per server instance.
 *
 * `next.config.ts` lists these files in `outputFileTracingIncludes` so they
 * are bundled with the route functions on Vercel. A missing or invalid
 * artefact resolves to `null`, which the routes translate into the fixture
 * (crop) or a 503 (irrigation) rather than a crash.
 */

const ARTIFACTS_DIR = path.join(process.cwd(), "artifacts");

export type LoadedModel<TModel> = { model: TModel; manifest: ProductionManifest };

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(ARTIFACTS_DIR, file), "utf8"));
}

async function load<TModel>(
  manifestFile: string,
  build: (raw: unknown) => TModel,
): Promise<LoadedModel<TModel> | null> {
  try {
    const manifest = productionManifestSchema.parse(await readJson(manifestFile));
    if (manifest.status !== "production" || !manifest.artifacts.model?.path) return null;
    const model = build(await readJson(path.basename(manifest.artifacts.model.path)));
    return { model, manifest };
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "model_load_failed",
        manifest: manifestFile,
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return null;
  }
}

let cropPromise: Promise<LoadedModel<CatBoostModel> | null> | undefined;
let irrigationPromise: Promise<LoadedModel<XGBoostModel> | null> | undefined;

export function getCropModel(): Promise<LoadedModel<CatBoostModel> | null> {
  cropPromise ??= load("crop-manifest.json", loadCatBoostModel);
  return cropPromise;
}

export function getIrrigationModel(): Promise<LoadedModel<XGBoostModel> | null> {
  irrigationPromise ??= load("irrigation-manifest.json", loadXGBoostModel);
  return irrigationPromise;
}
