"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CheckCircle, Flask, Leaf, MapTrifold, ShieldCheck } from "@phosphor-icons/react";
import { BarChart } from "@/components/bar-chart";
import { Reveal } from "@/components/reveal";
import { WeatherTable } from "@/components/weather-table";
import { useApp } from "@/components/app-provider";
import { featureImportance, leaderboardHighlights, studyFacts } from "@/lib/research-data";
import type { UyoWeather } from "@/lib/contracts";

export function HomePage({ initialWeather }: { initialWeather: UyoWeather | null }) {
  const { t } = useApp();

  const leaderboardData = leaderboardHighlights.map((row) => ({
    label: row.model,
    value: row.accuracy,
    display: `${(row.accuracy * 100).toFixed(2)}%`,
    highlight: row.model === "CatBoost",
  }));

  const importanceData = featureImportance.slice(0, 4).map((row, index) => ({
    label: row.label,
    value: row.meanAbsShap,
    display: row.meanAbsShap.toFixed(2),
    annotation: `${t.evidence.rank} ${index + 1}`,
  }));

  return (
    <main id="main">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-media">
          <Image src="/generated/hero-farm.jpg" alt={t.hero.imageAlt} fill priority sizes="100vw" quality={70} />
        </div>
        <div className="hero-content">
          <p className="eyebrow">{t.hero.kicker}</p>
          <h1 id="hero-title">{t.hero.title}</h1>
          <p className="hero-copy">{t.hero.body}</p>
          <div className="button-row">
            <Link className="button-primary" href="/predict">
              {t.hero.ctaPredict}
              <ArrowRight size={18} weight="bold" aria-hidden="true" />
            </Link>
            <Link className="button-secondary" href="/research">
              {t.hero.ctaResearch}
            </Link>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="weather-heading">
        <div className="section-shell">
          <Reveal>
            <p className="section-kicker">{t.weather.kicker}</p>
            <h2 className="section-title" id="weather-heading">
              {t.weather.title}
            </h2>
            <p className="section-copy">{t.weather.body}</p>
          </Reveal>
          <Reveal className="weather-image-panel weather-section-panel">
            <Image src="/generated/uyo-weather.jpg" alt={t.weather.imageAlt} fill sizes="(max-width: 900px) 100vw, 1400px" quality={70} />
            <div className="weather-overlay">
              <WeatherTable initialWeather={initialWeather} />
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section section-workflow" aria-labelledby="workflow-heading">
        <div className="section-shell split-grid">
          <Reveal className="media-frame workflow-media">
            <Image src="/generated/field-measurements.jpg" alt={t.workflow.imageAlt} fill sizes="(max-width: 900px) 100vw, 50vw" quality={70} />
          </Reveal>
          <Reveal>
            <p className="section-kicker">{t.workflow.kicker}</p>
            <h2 className="section-title" id="workflow-heading">
              {t.workflow.title}
            </h2>
            <p className="section-copy">{t.workflow.body}</p>
            <ul className="input-clusters" aria-label={t.workflow.inputsLabel}>
              <li>
                <Leaf size={22} aria-hidden="true" />
                <span>
                  <b>{t.workflow.nutrients}</b>
                  <small>{t.workflow.nutrientsDetail}</small>
                </span>
              </li>
              <li>
                <Flask size={22} aria-hidden="true" />
                <span>
                  <b>{t.workflow.ph}</b>
                  <small>{t.workflow.phDetail}</small>
                </span>
              </li>
              <li>
                <MapTrifold size={22} aria-hidden="true" />
                <span>
                  <b>{t.workflow.climate}</b>
                  <small>{t.workflow.climateDetail}</small>
                </span>
              </li>
            </ul>
            <Link href="/predict" className="button-primary inline-cta">
              {t.workflow.cta} <ArrowRight size={18} aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>

      <section className="section dark-band" aria-labelledby="evidence-heading">
        <div className="section-shell">
          <div className="split-grid evidence-intro">
            <Reveal>
              <p className="section-kicker">{t.evidence.kicker}</p>
              <h2 className="section-title" id="evidence-heading">
                {t.evidence.title}
              </h2>
              <p className="section-copy">{t.evidence.body}</p>
            </Reveal>
            <Reveal className="media-frame research-media">
              <Image src="/generated/research-lab.jpg" alt={t.evidence.imageAlt} fill sizes="(max-width: 900px) 100vw, 42vw" quality={70} />
            </Reveal>
          </div>
          <Reveal>
            <ul className="metrics-strip" aria-label={t.evidence.metricsLabel}>
              <li className="metric">
                <strong>{studyFacts.configurations}</strong>
                <span>{t.evidence.configurations}</span>
              </li>
              <li className="metric">
                <strong>{(studyFacts.bestAccuracy * 100).toFixed(2)}%</strong>
                <span>{t.evidence.accuracy}</span>
              </li>
              <li className="metric">
                <strong>{studyFacts.cropClasses}</strong>
                <span>{t.evidence.classes}</span>
              </li>
              <li className="metric">
                <strong>{studyFacts.features}</strong>
                <span>{t.evidence.features}</span>
              </li>
            </ul>
          </Reveal>
        </div>
      </section>

      <section className="section" aria-labelledby="context-heading">
        <div className="section-shell">
          <Reveal className="context-visual">
            <Image src="/generated/nigeria-context.jpg" alt={t.context.imageAlt} fill sizes="100vw" quality={70} />
            <div className="context-copy">
              <p className="section-kicker">{t.context.kicker}</p>
              <h2 className="section-title" id="context-heading">
                {t.context.title}
              </h2>
              <p className="section-copy">{t.context.body}</p>
            </div>
          </Reveal>

          <div className="research-charts">
            <Reveal className="data-panel">
              <div className="panel-heading">
                <h3>{t.evidence.leaderboardTitle}</h3>
                <span className="panel-note">{t.evidence.leaderboardNote}</span>
              </div>
              <div className="chart">
                <BarChart
                  caption={`${t.evidence.leaderboardTitle}. ${t.evidence.leaderboardNote}.`}
                  columnLabel="Configuration"
                  valueLabel={t.evidence.leaderboardNote}
                  data={leaderboardData}
                  min={0.95}
                  max={1}
                />
                <Link href="/research" className="panel-link">
                  {t.evidence.viewFullTable} <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </Reveal>

            <Reveal className="data-panel">
              <div className="panel-heading">
                <h3>{t.evidence.featureTitle}</h3>
                <span className="panel-note">{t.evidence.featureNote}</span>
              </div>
              <div className="chart">
                <BarChart
                  caption={`${t.evidence.featureTitle}. ${t.evidence.featureNote}.`}
                  columnLabel="Feature"
                  valueLabel="Mean |SHAP|"
                  data={importanceData}
                />
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section section-compact" aria-labelledby="limits-heading">
        <div className="section-shell">
          <Reveal className="responsible-panel">
            <Image src="/generated/responsible-use.jpg" alt={t.limits.imageAlt} fill sizes="100vw" quality={70} />
            <div className="responsible-copy">
              <p className="section-kicker">{t.limits.kicker}</p>
              <h2 className="section-title" id="limits-heading">
                {t.limits.title}
              </h2>
              <p className="section-copy">{t.limits.body}</p>
              <ul className="responsibility-list">
                <li>
                  <CheckCircle size={20} aria-hidden="true" /> {t.limits.pointResearch}
                </li>
                <li>
                  <ShieldCheck size={20} aria-hidden="true" /> {t.limits.pointNoControl}
                </li>
              </ul>
              <Link href="/predict" className="button-primary inline-cta">
                {t.hero.ctaPredict}
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </main>
  );
}
