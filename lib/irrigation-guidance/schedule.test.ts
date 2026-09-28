import { describe, expect, it } from "vitest";
import { cropGuidance } from "./crops";
import { buildSchedule, irrigationStageToGrowthStage } from "./schedule";
import { growthStages, soilTextures } from "./types";
import { irrigationStages } from "@/lib/contracts";

const base = { growthStage: "flowering", soilTexture: "loam", season: "dry", temperatureC: 28, humidityPct: 75 } as const;

describe("schedule engine", () => {
  it("returns null for an unknown crop rather than inventing advice", () => {
    expect(buildSchedule({ ...base, crop: "cassava" })).toBeNull();
  });

  it("produces a schedule for every crop at every stage on every soil", () => {
    for (const crop of cropGuidance) {
      for (const growthStage of growthStages) {
        for (const soilTexture of soilTextures) {
          const schedule = buildSchedule({ ...base, crop: crop.id, growthStage, soilTexture });
          expect(schedule, `${crop.id}/${growthStage}/${soilTexture}`).not.toBeNull();
          expect(schedule!.basis.length).toBeGreaterThan(2);
          if (schedule!.frequency.kind === "every_n_days") {
            expect(schedule!.frequency.days).toBeGreaterThanOrEqual(2);
            expect(schedule!.frequency.days).toBeLessThanOrEqual(14);
          }
        }
      }
    }
  });

  it("uses the FAO-56 formula: ETc = ETo × Kc", () => {
    const schedule = buildSchedule({ ...base, crop: "maize" })!;
    expect(schedule.etcMmPerDay).toBeCloseTo(schedule.etoMmPerDay * schedule.kc, 2);
    expect(schedule.kc).toBe(1.15);
  });

  it("uses the FAO-4 net depth table: sandy < loam < clay for the same crop", () => {
    const sandy = buildSchedule({ ...base, crop: "tomato", soilTexture: "sandy" })!;
    const loam = buildSchedule({ ...base, crop: "tomato", soilTexture: "loam" })!;
    const clay = buildSchedule({ ...base, crop: "tomato", soilTexture: "clay" })!;
    expect(sandy.netDepthMm).toBe(30);
    expect(loam.netDepthMm).toBe(40);
    expect(clay.netDepthMm).toBe(50);
    const days = (s: typeof sandy) => (s.frequency.kind === "every_n_days" ? s.frequency.days : 1);
    expect(days(sandy)).toBeLessThanOrEqual(days(loam));
    expect(days(loam)).toBeLessThanOrEqual(days(clay));
  });

  it("waters a shallow-rooted potato more often than a deep-rooted maize on the same soil", () => {
    const potato = buildSchedule({ ...base, crop: "potato", growthStage: "yield_formation" })!;
    const maize = buildSchedule({ ...base, crop: "maize", growthStage: "yield_formation" })!;
    const days = (s: typeof potato) => (s.frequency.kind === "every_n_days" ? s.frequency.days : 1);
    expect(days(potato)).toBeLessThan(days(maize));
  });

  it("raises ETo for hot, dry air and lowers it for very humid air", () => {
    const hot = buildSchedule({ ...base, crop: "maize", temperatureC: 36, humidityPct: 40 })!;
    const humid = buildSchedule({ ...base, crop: "maize", temperatureC: 28, humidityPct: 90 })!;
    expect(hot.etoMmPerDay).toBeGreaterThan(humid.etoMmPerDay);
    expect(hot.basis.some((b) => b.rule === "eto_heat_adjustment")).toBe(true);
  });

  it("keeps rice flooded and expresses the top-up interval from ETc plus percolation", () => {
    const rice = buildSchedule({ ...base, crop: "rice", soilTexture: "sandy" })!;
    expect(rice.frequency.kind).toBe("keep_flooded");
    if (rice.frequency.kind === "keep_flooded") {
      expect(rice.frequency.depthCm).toEqual([3, 5]);
      expect(rice.frequency.topUpEveryDays).toBeGreaterThanOrEqual(1);
    }
    expect(rice.basis.some((b) => b.rule === "flooded_rice" && b.params.percolationMm === 8)).toBe(true);
  });

  it("withholds water from mango and coffee in the pre-flowering dry rest", () => {
    for (const crop of ["mango", "coffee"]) {
      const schedule = buildSchedule({ ...base, crop, growthStage: "vegetative" })!;
      expect(schedule.frequency).toEqual({ kind: "withhold", until: "flowering" });
    }
    expect(buildSchedule({ ...base, crop: "mango", growthStage: "yield_formation" })!.frequency.kind).toBe("every_n_days");
  });

  it("withholds water from drought-hardy pulses outside their critical stage in the wet season", () => {
    const schedule = buildSchedule({ ...base, crop: "mothbeans", growthStage: "vegetative", season: "wet" })!;
    expect(schedule.frequency.kind).toBe("withhold");
    const dry = buildSchedule({ ...base, crop: "mothbeans", growthStage: "vegetative", season: "dry" })!;
    expect(dry.frequency.kind).not.toBe("withhold");
  });

  it("credits recent rain as skipped days and never more than one interval", () => {
    const none = buildSchedule({ ...base, crop: "tomato" })!;
    const rained = buildSchedule({ ...base, crop: "tomato", recentRainMm: 20 })!;
    expect(none.afterRain).toBeNull();
    expect(rained.afterRain?.skipDays).toBeGreaterThan(0);
    const interval = rained.frequency.kind === "every_n_days" ? rained.frequency.days : 1;
    expect(rained.afterRain!.skipDays).toBeLessThanOrEqual(interval);
    const flood = buildSchedule({ ...base, crop: "tomato", recentRainMm: 200 })!;
    expect(flood.afterRain!.skipDays).toBeLessThanOrEqual(interval);
  });

  it("ignores rain below 5 mm", () => {
    expect(buildSchedule({ ...base, crop: "tomato", recentRainMm: 3 })!.afterRain).toBeNull();
  });

  it("warns about waterlogging when heavy rain exceeds the net depth on a sensitive crop", () => {
    const papaya = buildSchedule({ ...base, crop: "papaya", recentRainMm: 60 })!;
    expect(papaya.warnings).toContain("waterlogging_risk");
    const coconut = buildSchedule({ ...base, crop: "coconut", recentRainMm: 60 })!;
    expect(coconut.warnings).not.toContain("waterlogging_risk");
  });

  it("flags the critical stage", () => {
    expect(buildSchedule({ ...base, crop: "maize", growthStage: "flowering" })!.criticalNow).toBe(true);
    expect(buildSchedule({ ...base, crop: "maize", growthStage: "establishment" })!.criticalNow).toBe(false);
  });

  it("is deterministic", () => {
    const a = buildSchedule({ ...base, crop: "wheat", recentRainMm: 12 });
    const b = buildSchedule({ ...base, crop: "wheat", recentRainMm: 12 });
    expect(a).toEqual(b);
  });

  it("maps every irrigation-model stage label onto a schedule phase", () => {
    for (const stage of irrigationStages) expect(growthStages).toContain(irrigationStageToGrowthStage(stage));
    expect(irrigationStageToGrowthStage("Germination")).toBe("establishment");
    expect(irrigationStageToGrowthStage("Harvest")).toBe("ripening");
  });
});
