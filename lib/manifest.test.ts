import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  manifestConsistencyErrors,
  missingPromotionFields,
  productionManifestSchema,
  type ProductionManifest,
} from "@/lib/manifest";
import { studyFacts } from "@/lib/research-data";

const artifacts = path.resolve(__dirname, "..", "artifacts");
const load = (file: string) => productionManifestSchema.parse(JSON.parse(readFileSync(path.join(artifacts, file), "utf8")));

const crop = load("crop-manifest.json");
const irrigation = load("irrigation-manifest.json");

describe("crop manifest", () => {
  it("declares the seven features in the model's own column order", () => {
    expect(crop.feature_order).toEqual(["N", "P", "K", "temperature", "humidity", "ph", "rainfall"]);
  });

  it("agrees with the research tables on class count and accuracy", () => {
    expect(crop.classes).toBe(studyFacts.cropClasses);
    expect(crop.metrics.held_out_accuracy).toBe(studyFacts.bestAccuracy);
  });

  it("is a consistent production manifest with no outstanding fields", () => {
    expect(crop.status).toBe("production");
    expect(missingPromotionFields(crop)).toEqual([]);
    expect(manifestConsistencyErrors(crop)).toEqual([]);
  });

  it("versions the dataset by content hash rather than 'local-unversioned'", () => {
    expect(crop.dataset_versions.crop_recommendation).toMatch(/^sha256:[0-9a-f]{64}$/);
  });
});

describe("irrigation manifest", () => {
  it("is a consistent production manifest", () => {
    expect(irrigation.status).toBe("production");
    expect(irrigation.task).toBe("irrigation_decision");
    expect(manifestConsistencyErrors(irrigation)).toEqual([]);
  });

  it("reports the accuracy measured on the served artefact", () => {
    // The thesis reports 3,282/3,283 for its run; this artefact makes one more
    // error. The site shows the measured value, not the thesis value.
    expect(irrigation.metrics.held_out_accuracy).toBeCloseTo(3281 / 3283, 6);
    expect(irrigation.metrics.held_out_accuracy).toBeLessThanOrEqual(3282 / 3283);
  });

  it("records that the export happened in Colab", () => {
    expect(irrigation.exported_in).toBe("google-colab");
    expect(irrigation.git_revision).not.toMatch(/^colab-run/);
  });

  it("discloses the label-2 merge instead of hiding it", () => {
    expect(irrigation.label_mapping?.["0"]).toBe("do_not_irrigate");
    expect(irrigation.label_mapping?.["1"]).toBe("irrigate");
    expect(irrigation.label_mapping?.["2"]).toMatch(/mapped_to_0/);
    expect(irrigation.label_2_rows_mapped_to_0).toBe(1122);
  });

  it("records the five-crop vocabulary that does not overlap the recommender", () => {
    expect(irrigation.vocabulary?.crop).toEqual(["Carrot", "Chilli", "Potato", "Tomato", "Wheat"]);
  });
});

describe("promotion gate", () => {
  it("refuses a production claim with a missing checksum", () => {
    const broken: ProductionManifest = {
      ...crop,
      artifacts: { ...crop.artifacts, model: { path: "artifacts/crop-catboost.model.json", sha256: null } },
    };
    expect(manifestConsistencyErrors(broken)).toContain('status is "production" but artifacts.model.sha256 is not populated');
  });

  it("refuses a production claim built on unversioned data", () => {
    const broken: ProductionManifest = { ...crop, dataset_versions: { crop_recommendation: "local-unversioned" } };
    expect(manifestConsistencyErrors(broken)).toContain(
      'status is "production" but dataset_versions.crop_recommendation is not populated',
    );
  });

  it("refuses an irrigation manifest that does not disclose its label mapping", () => {
    const withoutMapping: ProductionManifest = { ...irrigation };
    delete withoutMapping.label_mapping;
    expect(manifestConsistencyErrors(withoutMapping)).toContain(
      "an irrigation manifest must disclose its label_mapping",
    );
  });

  it("rejects a checksum that is not 64 hex characters", () => {
    const broken = { ...crop, artifacts: { ...crop.artifacts, model: { path: "x", sha256: "nope" } } };
    expect(productionManifestSchema.safeParse(broken).success).toBe(false);
  });

  it("still describes a blocked manifest correctly", () => {
    const blocked: ProductionManifest = {
      ...crop,
      status: "blocked_missing_artifact",
      artifacts: { model: { path: null, sha256: null } },
      release_gate: "Export the artefact.",
    };
    expect(manifestConsistencyErrors(blocked)).toEqual([]);
    expect(missingPromotionFields(blocked)).toContain("artifacts.model.path");
  });
});
