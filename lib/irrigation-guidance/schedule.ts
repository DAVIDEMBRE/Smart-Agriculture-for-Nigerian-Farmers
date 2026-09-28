import { findCropGuidance } from "./crops";
import type { CropGuidance, GrowthStage, Season, SoilTexture } from "./types";

/**
 * Rule-based watering schedule.
 *
 * This is deliberately a small, transparent calculation, not a model:
 *
 *   daily crop water use  ETc = ETo × Kc            (FAO-56 method)
 *   net irrigation depth  D   = f(soil, rooting)    (FAO Training Manual 4)
 *   interval (days)       = D / ETc
 *
 * ETo is taken from FAO Training Manual 3 Table 5 for a humid climate, which
 * is what Uyo has, and adjusted for the temperature and humidity supplied.
 * Every number in the result carries a `basis` entry naming the rule and the
 * inputs it used, so the UI can show why the advice is what it is.
 */

export type ScheduleInput = {
  crop: string;
  growthStage: GrowthStage;
  soilTexture: SoilTexture;
  season: Season;
  /** Current or typical air temperature; defaults to a warm humid day. */
  temperatureC?: number;
  humidityPct?: number;
  /** Rain in the last day or two, if known. Never auto-filled from live weather. */
  recentRainMm?: number;
};

export type BasisRule =
  | "eto_humid_table"
  | "eto_heat_adjustment"
  | "eto_humidity_adjustment"
  | "kc_stage"
  | "net_depth_fao4"
  | "interval_formula"
  | "flooded_rice"
  | "withhold_low_need"
  | "dry_rest_before_flowering"
  | "rain_credit"
  | "waterlogging_risk"
  | "wet_season";

export type BasisEntry = { rule: BasisRule; params: Record<string, string | number> };

export type Frequency =
  | { kind: "every_n_days"; days: number }
  | { kind: "daily" }
  | { kind: "keep_flooded"; topUpEveryDays: number; depthCm: [number, number] }
  | { kind: "withhold"; until: GrowthStage };

export type Schedule = {
  crop: CropGuidance;
  input: Required<Pick<ScheduleInput, "growthStage" | "soilTexture" | "season">> & ScheduleInput;
  etoMmPerDay: number;
  kc: number;
  etcMmPerDay: number;
  netDepthMm: number;
  frequency: Frequency;
  /** Litres per square metre per application; equal to net depth in mm. */
  litresPerSquareMetre: number;
  timeOfDay: CropGuidance["timeOfDay"];
  afterRain: { skipDays: number; rainMm: number } | null;
  criticalNow: boolean;
  warnings: Array<"waterlogging_risk" | "outside_training_scope" | "critical_stage">;
  basis: BasisEntry[];
};

/** FAO Training Manual 4: net irrigation depth (mm) by soil texture × rooting class. */
const NET_DEPTH_MM: Record<SoilTexture, Record<CropGuidance["rooting"], number>> = {
  sandy: { shallow: 15, medium: 30, deep: 40 },
  loam: { shallow: 20, medium: 40, deep: 60 },
  clay: { shallow: 30, medium: 50, deep: 70 },
};

/** FAO Training Manual 3: paddy percolation and seepage losses (mm/day). */
const PADDY_PERCOLATION_MM: Record<SoilTexture, number> = { sandy: 8, loam: 6, clay: 4 };

/** Crops that set flowers only after a dry rest; watering then is counter-productive. */
const DRY_REST_BEFORE_FLOWERING = new Set(["mango", "coffee"]);

const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 14;

/** FAO Training Manual 3 Table 5, humid zone: 1-2 / 3-4 / 5-6 mm/day by temperature band. */
function referenceEto(temperatureC: number | undefined, humidityPct: number | undefined, basis: BasisEntry[]): number {
  const temp = temperatureC ?? 28;
  let eto = temp < 15 ? 1.5 : temp <= 25 ? 3.5 : 5.5;
  basis.push({ rule: "eto_humid_table", params: { temperatureC: temp, etoMmPerDay: eto } });

  if (temp > 32) {
    eto += 1;
    basis.push({ rule: "eto_heat_adjustment", params: { temperatureC: temp, adjustmentMm: 1 } });
  }
  if (humidityPct !== undefined) {
    if (humidityPct < 50) {
      eto += 0.5;
      basis.push({ rule: "eto_humidity_adjustment", params: { humidityPct, adjustmentMm: 0.5 } });
    } else if (humidityPct > 85) {
      eto -= 0.5;
      basis.push({ rule: "eto_humidity_adjustment", params: { humidityPct, adjustmentMm: -0.5 } });
    }
  }
  return Math.max(1, eto);
}

function kcForStage(crop: CropGuidance, stage: GrowthStage): number {
  switch (stage) {
    case "establishment":
      return crop.kc.initial;
    case "vegetative":
      return crop.kc.development;
    case "flowering":
    case "yield_formation":
      return crop.kc.mid;
    case "ripening":
      return crop.kc.late;
  }
}

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL_DAYS, Math.max(MIN_INTERVAL_DAYS, Math.round(days)));
}

export function buildSchedule(input: ScheduleInput): Schedule | null {
  const crop = findCropGuidance(input.crop);
  if (!crop) return null;

  const basis: BasisEntry[] = [];
  const warnings: Schedule["warnings"] = [];

  const eto = referenceEto(input.temperatureC, input.humidityPct, basis);
  const kc = kcForStage(crop, input.growthStage);
  basis.push({ rule: "kc_stage", params: { stage: input.growthStage, kc, source: crop.kcBasis } });
  const etc = Number((eto * kc).toFixed(2));

  const netDepthMm = NET_DEPTH_MM[input.soilTexture][crop.rooting];
  basis.push({ rule: "net_depth_fao4", params: { soil: input.soilTexture, rooting: crop.rooting, netDepthMm } });

  const criticalNow = crop.criticalStages.includes(input.growthStage);
  if (criticalNow) warnings.push("critical_stage");

  let frequency: Frequency;

  if (crop.waterNeed === "flooded") {
    // Paddy: keep 3-5 cm standing; water is lost to ETc plus percolation.
    const lossPerDay = etc + PADDY_PERCOLATION_MM[input.soilTexture];
    const topUp = clampInterval(50 / lossPerDay);
    frequency = { kind: "keep_flooded", topUpEveryDays: topUp, depthCm: [3, 5] };
    basis.push({ rule: "flooded_rice", params: { percolationMm: PADDY_PERCOLATION_MM[input.soilTexture], lossPerDayMm: Number(lossPerDay.toFixed(1)), topUpEveryDays: topUp } });
  } else if (DRY_REST_BEFORE_FLOWERING.has(crop.id) && input.growthStage === "vegetative") {
    frequency = { kind: "withhold", until: "flowering" };
    basis.push({ rule: "dry_rest_before_flowering", params: { crop: crop.id } });
  } else if (crop.droughtSensitivity === "low" && !criticalNow && input.season === "wet") {
    frequency = { kind: "withhold", until: crop.criticalStages[0] ?? "flowering" };
    basis.push({ rule: "withhold_low_need", params: { crop: crop.id, season: input.season } });
  } else {
    const rawDays = netDepthMm / etc;
    const days = clampInterval(rawDays);
    frequency = days <= 1 ? { kind: "daily" } : { kind: "every_n_days", days };
    basis.push({ rule: "interval_formula", params: { netDepthMm, etcMmPerDay: etc, rawDays: Number(rawDays.toFixed(1)), days } });
  }

  let afterRain: Schedule["afterRain"] = null;
  if (input.recentRainMm !== undefined && input.recentRainMm >= 5) {
    // Rain replaces the same depth of irrigation; credit it in days of crop use.
    const intervalDays = frequency.kind === "every_n_days" ? frequency.days : frequency.kind === "keep_flooded" ? frequency.topUpEveryDays : 1;
    const skipDays = Math.min(intervalDays, Math.floor(input.recentRainMm / etc));
    afterRain = { skipDays, rainMm: input.recentRainMm };
    basis.push({ rule: "rain_credit", params: { rainMm: input.recentRainMm, etcMmPerDay: etc, skipDays } });

    if (crop.waterloggingRisk === "high" && input.recentRainMm > netDepthMm) {
      warnings.push("waterlogging_risk");
      basis.push({ rule: "waterlogging_risk", params: { rainMm: input.recentRainMm, netDepthMm } });
    }
  }

  if (input.season === "wet" && frequency.kind !== "withhold") {
    basis.push({ rule: "wet_season", params: {} });
  }

  return {
    crop,
    input: { ...input, growthStage: input.growthStage, soilTexture: input.soilTexture, season: input.season },
    etoMmPerDay: eto,
    kc,
    etcMmPerDay: etc,
    netDepthMm,
    frequency,
    litresPerSquareMetre: netDepthMm,
    timeOfDay: crop.timeOfDay,
    afterRain,
    criticalNow,
    warnings,
    basis,
  };
}

/** Maps the irrigation model's eight training-stage labels onto the five schedule phases. */
export function irrigationStageToGrowthStage(stage: string): GrowthStage {
  switch (stage) {
    case "Germination":
    case "Seedling Stage":
      return "establishment";
    case "Vegetative Growth / Root or Tuber Development":
      return "vegetative";
    case "Flowering":
    case "Pollination":
      return "flowering";
    case "Fruit/Grain/Bulb Formation":
      return "yield_formation";
    case "Maturation":
    case "Harvest":
      return "ripening";
    default:
      return "vegetative";
  }
}
