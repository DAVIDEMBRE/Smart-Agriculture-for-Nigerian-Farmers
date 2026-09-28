import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  irrigationCrops,
  irrigationRequestSchema,
  irrigationSoils,
  irrigationStages,
  type IrrigationRequest,
} from "@/lib/contracts";
import { productionManifestSchema } from "@/lib/manifest";
import { loadXGBoostModel } from "@/lib/xgboost-applier";

const root = path.resolve(__dirname, "..");
const readJson = (file: string) => JSON.parse(readFileSync(path.join(root, "artifacts", file), "utf8"));

type Golden = {
  rows: Array<{ categorical: [string, string, string]; numeric: [number, number, number]; label: number; source_result: number; proba_irrigate: number }>;
};

const model = loadXGBoostModel(readJson("irrigation-xgboost.model.json"));
const golden = readJson("irrigation-golden.json") as Golden;
const manifest = productionManifestSchema.parse(readJson("irrigation-manifest.json"));

function toRequest(row: Golden["rows"][number]): IrrigationRequest {
  return irrigationRequestSchema.parse({
    crop: row.categorical[0],
    soil_type: row.categorical[1],
    growth_stage: row.categorical[2],
    moisture_pct: row.numeric[0],
    temperature_c: row.numeric[1],
    humidity_pct: row.numeric[2],
  });
}

describe("XGBoost applier against the golden file", () => {
  it("covers the full Smart Agriculture dataset", () => {
    expect(golden.rows).toHaveLength(16411);
  });

  it("reproduces every decision and probability", () => {
    let mismatches = 0;
    let maxAbs = 0;
    for (const row of golden.rows) {
      const p = model.predictProba(toRequest(row));
      if (p >= 0.5 !== row.proba_irrigate >= 0.5) mismatches += 1;
      maxAbs = Math.max(maxAbs, Math.abs(p - row.proba_irrigate));
    }
    expect(mismatches).toBe(0);
    expect(maxAbs).toBeLessThan(1e-5);
  });

  it("agrees with the source labels at the rate the manifest reports", () => {
    const correct = golden.rows.filter((row) => model.predict(toRequest(row)).decision === (row.label === 1 ? "irrigate" : "do_not_irrigate")).length;
    expect(correct / golden.rows.length).toBeGreaterThanOrEqual(manifest.metrics.held_out_accuracy - 0.001);
  });

  it("was trained on a dataset whose label 2 rows were mapped to 0, as the manifest discloses", () => {
    const label2 = golden.rows.filter((row) => row.source_result === 2);
    expect(label2).toHaveLength(manifest.label_2_rows_mapped_to_0!);
    expect(label2.every((row) => row.label === 0)).toBe(true);
    expect(manifest.label_mapping?.["2"]).toMatch(/mapped_to_0/);
  });
});

describe("XGBoost applier behaviour", () => {
  it("says irrigate for a bone-dry germinating wheat field and not for a saturated one", () => {
    const base = { crop: "Wheat", soil_type: "Black Soil", growth_stage: "Germination", temperature_c: 26, humidity_pct: 77 } as const;
    expect(model.predict({ ...base, moisture_pct: 2 }).decision).toBe("irrigate");
    expect(model.predict({ ...base, moisture_pct: 95, temperature_c: 30, humidity_pct: 60 }).decision).toBe("do_not_irrigate");
  });

  it("exposes exactly the contract vocabulary", () => {
    expect([...model.vocabulary.crop].sort()).toEqual([...irrigationCrops].sort());
    expect([...model.vocabulary.soil_type].sort()).toEqual([...irrigationSoils].sort());
    expect([...model.vocabulary.growth_stage].sort()).toEqual([...irrigationStages].sort());
  });

  it("returns a probability in (0, 1)", () => {
    const p = model.predictProba({ crop: "Tomato", soil_type: "Loam Soil", growth_stage: "Flowering", moisture_pct: 50, temperature_c: 30, humidity_pct: 60 });
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(1);
  });
});
