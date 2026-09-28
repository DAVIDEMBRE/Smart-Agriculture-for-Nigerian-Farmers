import type { Locale } from "@/lib/content";

/**
 * Watering guidance is authored, rule-based agronomic advice. It is NOT a
 * model output, and every rendered line says so. The numbers come from FAO
 * Irrigation and Drainage Paper 56 and FAO Irrigation Water Management
 * Training Manuals 3 and 4, plus crop-specific sources where FAO has no entry;
 * each crop lists what it drew on.
 */

/** The five agronomic phases the schedule engine reasons about. */
export const growthStages = ["establishment", "vegetative", "flowering", "yield_formation", "ripening"] as const;
export type GrowthStage = (typeof growthStages)[number];

/** FAO-4 soil classes used for net irrigation depth. */
export const soilTextures = ["sandy", "loam", "clay"] as const;
export type SoilTexture = (typeof soilTextures)[number];

/** FAO-4 rooting depth classes: shallow 30-60 cm, medium 50-100 cm, deep 90-150 cm. */
export type RootingClass = "shallow" | "medium" | "deep";

export type Season = "dry" | "wet";

export type KcProfile = {
  initial: number;
  development: number;
  mid: number;
  late: number;
};

export type LocalisedNotes = {
  /** Which stages must never be short of water, and why. */
  critical: string;
  /** What to do after rain. */
  afterRain: string;
  /** Visible signs that watering is overdue or excessive. */
  watchFor: string;
  /** Stage-specific practice (drain before harvest, stop before ripening, ...). */
  practice: string;
};

export type Source = { title: string; url: string };

export type CropGuidance = {
  /** Lower-case key matching the recommender class or the irrigation crop. */
  id: string;
  name: Record<Locale, string>;
  category: "cereal" | "pulse" | "fruit_tree" | "fruit_vine" | "vegetable" | "plantation" | "fibre";
  /** Whether the crop is one of the five the irrigation model was trained on. */
  irrigationModelCrop: boolean;
  waterNeed: "low" | "moderate" | "high" | "flooded";
  rooting: RootingClass;
  kc: KcProfile;
  /** Where the Kc values come from; states when a proxy crop was used. */
  kcBasis: string;
  droughtSensitivity: "low" | "medium" | "high";
  criticalStages: GrowthStage[];
  waterloggingRisk: "low" | "medium" | "high";
  /** Preferred time of day, with the reason carried in the notes. */
  timeOfDay: "early_morning" | "morning_or_evening";
  notes: Record<Locale, LocalisedNotes>;
  sources: Source[];
};
