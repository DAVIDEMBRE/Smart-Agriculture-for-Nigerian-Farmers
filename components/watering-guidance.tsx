"use client";

import { CaretDown, CloudRain, Drop, Sun, Warning } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useApp } from "@/components/app-provider";
import type { Dictionary } from "@/lib/content";
import {
  buildSchedule,
  findCropGuidance,
  growthStages,
  soilTextures,
  type GrowthStage,
  type Schedule,
  type Season,
  type SoilTexture,
} from "@/lib/irrigation-guidance";

/** Fills `{name}` placeholders in a dictionary template. */
function fill(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

type WateringGuidanceProps = {
  /** Recommender class name or irrigation crop name. */
  crop: string;
  initialStage?: GrowthStage;
  /** Live readings from a form on the same page, offered as defaults only. */
  temperatureC?: number;
  humidityPct?: number;
};

/**
 * Rule-based watering advice for one crop, from the FAO-grounded knowledge base
 * in `lib/irrigation-guidance`. Every line can be opened to show the rule and
 * the inputs that produced it, and each crop lists its sources.
 */
export function WateringGuidance({ crop, initialStage = "vegetative", temperatureC, humidityPct }: WateringGuidanceProps) {
  const { locale, t } = useApp();
  const g = t.guidance;
  const guidance = findCropGuidance(crop);

  const [stage, setStage] = useState<GrowthStage>(initialStage);
  const [soil, setSoil] = useState<SoilTexture>("loam");
  const [season, setSeason] = useState<Season>("dry");
  const [showWhy, setShowWhy] = useState(false);

  const schedule = useMemo<Schedule | null>(() => {
    if (!guidance) return null;
    return buildSchedule({ crop: guidance.id, growthStage: stage, soilTexture: soil, season, temperatureC, humidityPct });
  }, [guidance, stage, soil, season, temperatureC, humidityPct]);

  if (!guidance || !schedule) {
    return (
      <section className="guidance" aria-label={g.title}>
        <p className="guidance-empty">{g.unknownCrop}</p>
      </section>
    );
  }

  const notes = guidance.notes[locale];
  const frequency = describeFrequency(schedule, g);
  const id = `guidance-${guidance.id}`;

  return (
    <section className="guidance" aria-labelledby={`${id}-title`}>
      <h3 id={`${id}-title`} className="guidance-title">
        {g.title} {guidance.name[locale]}
      </h3>
      <p className="guidance-intro">{g.intro}</p>

      <div className="guidance-controls">
        <label>
          <span>{g.stage}</span>
          <select value={stage} onChange={(event) => setStage(event.target.value as GrowthStage)}>
            {growthStages.map((value) => (
              <option key={value} value={value}>
                {g.stages[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{g.soil}</span>
          <select value={soil} onChange={(event) => setSoil(event.target.value as SoilTexture)}>
            {soilTextures.map((value) => (
              <option key={value} value={value}>
                {g.soils[value]}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>{g.season}</span>
          <select value={season} onChange={(event) => setSeason(event.target.value as Season)}>
            <option value="dry">{g.seasons.dry}</option>
            <option value="wet">{g.seasons.wet}</option>
          </select>
        </label>
      </div>

      {schedule.criticalNow && (
        <p className="guidance-critical" role="status">
          <Warning size={18} aria-hidden="true" /> <b>{g.criticalLabel}:</b> {g.criticalNow}
        </p>
      )}

      <dl className="guidance-grid">
        <div>
          <dt>
            <Drop size={18} aria-hidden="true" /> {g.frequencyLabel}
          </dt>
          <dd>
            {frequency}
            {season === "wet" && schedule.frequency.kind !== "withhold" && <small>{g.wetSeason}</small>}
          </dd>
        </div>
        {schedule.frequency.kind !== "withhold" && (
          <div>
            <dt>{g.amountLabel}</dt>
            <dd>{fill(g.amount, { litres: schedule.litresPerSquareMetre, mm: schedule.netDepthMm })}</dd>
          </div>
        )}
        <div>
          <dt>
            <Sun size={18} aria-hidden="true" /> {g.timeLabel}
          </dt>
          <dd>{schedule.timeOfDay === "early_morning" ? g.earlyMorning : g.morningOrEvening}</dd>
        </div>
        <div>
          <dt>
            <CloudRain size={18} aria-hidden="true" /> {g.afterRainLabel}
          </dt>
          <dd>{notes.afterRain}</dd>
        </div>
        <div>
          <dt>{g.criticalLabel}</dt>
          <dd>{notes.critical}</dd>
        </div>
        <div>
          <dt>{g.watchLabel}</dt>
          <dd>{notes.watchFor}</dd>
        </div>
        <div>
          <dt>{g.practiceLabel}</dt>
          <dd>{notes.practice}</dd>
        </div>
      </dl>

      <button type="button" className="guidance-why" aria-expanded={showWhy} aria-controls={`${id}-why`} onClick={() => setShowWhy((v) => !v)}>
        <CaretDown size={16} aria-hidden="true" className={showWhy ? "is-open" : undefined} /> {g.whyTitle}
      </button>
      {showWhy && (
        <ol id={`${id}-why`} className="guidance-basis">
          {schedule.basis.map((entry, index) => (
            <li key={`${entry.rule}-${index}`}>{fill(g.basis[entry.rule], entry.params)}</li>
          ))}
        </ol>
      )}

      <p className="guidance-sources">
        <b>{g.sourcesLabel}:</b>{" "}
        {guidance.sources.map((source, index) => (
          <span key={source.url}>
            {index > 0 && " · "}
            <a href={source.url} target="_blank" rel="noreferrer">
              {source.title}
            </a>
          </span>
        ))}
      </p>
    </section>
  );
}

function describeFrequency(schedule: Schedule, g: Dictionary["guidance"]): string {
  const f = schedule.frequency;
  switch (f.kind) {
    case "daily":
      return g.daily;
    case "every_n_days":
      return fill(g.everyNDays, { days: f.days });
    case "keep_flooded":
      return fill(g.keepFlooded, { min: f.depthCm[0], max: f.depthCm[1], days: f.topUpEveryDays });
    case "withhold":
      return fill(g.withhold, { stage: g.stages[f.until] });
  }
}
