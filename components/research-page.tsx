"use client";

import Link from "next/link";
import { ArrowRight, Database, Eye, Flask, WarningCircle } from "@phosphor-icons/react";
import { BarChart } from "@/components/bar-chart";
import { ResearchFigure } from "@/components/research-figure";
import { Reveal } from "@/components/reveal";
import { ServiceStatus } from "@/components/service-status";
import { WateringGuidance } from "@/components/watering-guidance";
import { useApp } from "@/components/app-provider";
import {
  datasets,
  evaluationMetrics,
  familyLabels,
  featureImportance,
  irrigationBenchmark,
  irrigationReleaseConditions,
  leaderboard,
  methodChecks,
  modelFigures,
  shapProvenance,
  soilFigure,
  studyFacts,
} from "@/lib/research-data";

const methodIcons = [Flask, Database, Eye];

/** Looks a figure up by id so reordering the list cannot mis-render a caption. */
const figure = (id: string) => {
  const found = modelFigures.find((item) => item.id === id);
  if (!found) throw new Error(`unknown research figure: ${id}`);
  return found;
};

const roleLabels: Record<(typeof datasets)[number]["role"], string> = {
  training: "Predictive training",
  context: "Context and validation",
  withheld: "Not used by a served model",
};

export function ResearchPage() {
  const { t } = useApp();

  return (
    <main id="main">
      <section className="page-hero research-hero">
        <div className="section-shell">
          <p className="section-kicker">{t.research.kicker}</p>
          <h1>{t.research.title}</h1>
          <p>{t.research.body}</p>
        </div>
      </section>

      <section className="section" aria-labelledby="scope-heading">
        <div className="section-shell">
          <Reveal>
            <p className="section-kicker">{t.research.scopeKicker}</p>
            <h2 className="section-title" id="scope-heading">
              {t.research.scopeTitle}
            </h2>
            <p className="section-copy">{t.research.scopeBody}</p>
          </Reveal>
          <div className="research-grid">
            <Reveal className="research-card">
              <strong>{studyFacts.configurations}</strong>
              <h3>evaluated configurations</h3>
              <p>Twelve classical models, one Optuna-tuned XGBoost, two ensembles and three deep-learning architectures.</p>
            </Reveal>
            <Reveal className="research-card">
              <strong>{evaluationMetrics.length}</strong>
              <h3>evaluation metrics</h3>
              <p>{evaluationMetrics.join(", ")}.</p>
            </Reveal>
            <Reveal className="research-card">
              <strong>{(studyFacts.bestAccuracy * 100).toFixed(2)}%</strong>
              <h3>CatBoost held-out accuracy</h3>
              <p>
                Matched by both ensembles, but reached with far lower inference cost: 0.013 ms per sample against 0.673 ms
                and 0.757 ms.
              </p>
            </Reveal>
            <Reveal className="research-card">
              <strong>
                {studyFacts.trainingRows}/{studyFacts.testRows}
              </strong>
              <h3>train and test rows</h3>
              <p>
                A stratified 80/20 split of the {studyFacts.cropClasses}-class Crop Recommendation Dataset, split before
                any scaler was fitted.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="leaderboard-heading">
        <div className="section-shell">
          <Reveal>
            <p className="section-kicker">{t.research.leaderboardKicker}</p>
            <h2 className="section-title" id="leaderboard-heading">
              {t.research.leaderboardTitle}
            </h2>
            <p className="section-copy">{t.research.leaderboardBody}</p>
          </Reveal>
          <Reveal>
            {/* The table is wider than a phone screen, so the scroll container
                is focusable and labelled for keyboard users. */}
            <div className="table-scroll" role="region" aria-label={t.research.leaderboardCaption} tabIndex={0}>
              <table className="results-table">
              <caption>{t.research.leaderboardCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{t.research.columnModel}</th>
                  <th scope="col">{t.research.columnFamily}</th>
                  <th scope="col">{t.research.columnAccuracy}</th>
                  <th scope="col">{t.research.columnMacroF1}</th>
                  <th scope="col">MCC</th>
                  <th scope="col">ROC-AUC</th>
                  <th scope="col">Fit (s)</th>
                  <th scope="col">Inference (ms)</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((row) => (
                  <tr key={row.model} className={row.model === "CatBoost" ? "is-highlighted" : undefined}>
                    <th scope="row">{row.model}</th>
                    <td>{familyLabels[row.family]}</td>
                    <td>{(row.accuracy * 100).toFixed(2)}%</td>
                    <td>{row.macroF1.toFixed(4)}</td>
                    <td>{row.mcc.toFixed(4)}</td>
                    <td>{row.rocAuc.toFixed(4)}</td>
                    <td>{row.fitSeconds.toFixed(2)}</td>
                    <td>{row.inferenceMsPerSample.toFixed(3)}</td>
                  </tr>
                ))}
                </tbody>
              </table>
            </div>
          </Reveal>
          <Reveal className="figure-pair">
            <ResearchFigure
              src={figure("catboost-confusion").src}
              alt={figure("catboost-confusion").alt}
              caption={figure("catboost-confusion").caption}
              source={figure("catboost-confusion").source}
              method={figure("catboost-confusion").method}
              width={figure("catboost-confusion").width}
              height={figure("catboost-confusion").height}
            />
          </Reveal>
        </div>
      </section>

      <section className="section dark-band" aria-labelledby="feature-heading">
        <div className="section-shell">
          <Reveal>
            <p className="section-kicker">{t.research.featureKicker}</p>
            <h2 className="section-title" id="feature-heading">
              {t.research.featureTitle}
            </h2>
            <p className="section-copy">{t.research.featureBody}</p>
          </Reveal>
          <Reveal className="shap-panel">
            <BarChart
              caption={shapProvenance.note}
              columnLabel="Feature"
              valueLabel="Mean |SHAP|"
              data={featureImportance.map((row) => ({
                label: row.label,
                value: row.meanAbsShap,
                display: row.meanAbsShap.toFixed(4),
              }))}
            />
            <p className="shap-provenance">
              {shapProvenance.note} Explained model: <b>{shapProvenance.explainedModel}</b> over {shapProvenance.samples}{" "}
              test samples and {shapProvenance.classes} classes. These are not CatBoost attributions, which is why the
              prediction API returns no per-input explanation yet.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="section" aria-labelledby="method-heading">
        <div className="section-shell">
          <Reveal>
            <p className="section-kicker">{t.research.methodKicker}</p>
            <h2 className="section-title" id="method-heading">
              {t.research.methodTitle}
            </h2>
            <p className="section-copy">{t.research.methodBody}</p>
          </Reveal>
          <div className="method-list">
            {methodChecks.map((check, index) => {
              const Icon = methodIcons[index] ?? Flask;
              return (
                <Reveal className="method-item" key={check.title}>
                  <Icon size={26} aria-hidden="true" />
                  <h3>{check.title}</h3>
                  <p>{check.detail}</p>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section" aria-labelledby="provenance-heading">
        <div className="section-shell split-grid provenance-grid">
          <Reveal>
            <p className="section-kicker">{t.research.provenanceKicker}</p>
            <h2 className="section-title" id="provenance-heading">
              {t.research.provenanceTitle}
            </h2>
            <p className="section-copy">{t.research.provenanceBody}</p>
            <ul className="provenance-list">
              {datasets.map((item) => (
                <li key={item.name}>
                  <b>{item.name}</b>
                  <span>
                    {roleLabels[item.role]} · {item.records}
                  </span>
                  <p>{item.detail}</p>
                </li>
              ))}
            </ul>
          </Reveal>
          <Reveal>
            <ResearchFigure
              src={soilFigure.src}
              alt={soilFigure.alt}
              caption={soilFigure.caption}
              source={soilFigure.source}
              method={soilFigure.method}
              width={2400}
              height={1800}
            />
          </Reveal>
        </div>
      </section>

      <section className="section dark-band" aria-labelledby="irrigation-heading">
        <div className="section-shell">
          <Reveal>
            <p className="section-kicker">{t.research.irrigationKicker}</p>
            <h2 className="section-title" id="irrigation-heading">
              {t.research.irrigationTitle}
            </h2>
            <p className="section-copy">{t.research.irrigationBody}</p>
          </Reveal>
          <Reveal className="irrigation-panel">
            <div>
              <div className="irrigation-metric">
                <strong>{(irrigationBenchmark.accuracy * 100).toFixed(2)}%</strong>
                <span>{irrigationBenchmark.note}</span>
              </div>
              <h3 className="irrigation-scope-title">{t.research.irrigationScope}</h3>
              <ul className="crop-chips" aria-label={t.research.irrigationScope}>
                {irrigationBenchmark.crops.map((crop) => (
                  <li key={crop}>{crop}</li>
                ))}
              </ul>
              <p className="irrigation-overlap">{t.research.irrigationNoOverlap}</p>
              <Link href="/irrigate" className="button-secondary inline-cta">
                {t.nav.irrigate} <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
            <div>
              <ResearchFigure
                src={figure("irrigation-cm-roc").src}
                alt={figure("irrigation-cm-roc").alt}
                caption={figure("irrigation-cm-roc").caption}
                source={figure("irrigation-cm-roc").source}
                method={figure("irrigation-cm-roc").method}
                width={figure("irrigation-cm-roc").width}
                height={figure("irrigation-cm-roc").height}
              />
              <h3 className="irrigation-gate-title">{t.research.irrigationGate}</h3>
              <dl className="gate-list gate-list-resolved">
                {irrigationReleaseConditions.map((item) => (
                  <div key={item.condition}>
                    <dt>{item.condition}</dt>
                    <dd>{item.resolution}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="section" aria-labelledby="guidance-heading">
        <div className="section-shell split-grid provenance-grid">
          <Reveal>
            <p className="section-kicker">{t.research.guidanceKicker}</p>
            <h2 className="section-title" id="guidance-heading">
              {t.research.guidanceTitle}
            </h2>
            <p className="section-copy">{t.research.guidanceBody}</p>
          </Reveal>
          <Reveal>
            <WateringGuidance crop="maize" initialStage="flowering" />
          </Reveal>
        </div>
      </section>

      <section className="section" aria-labelledby="status-heading">
        <div className="section-shell">
          <Reveal>
            <p className="section-kicker">{t.research.statusKicker}</p>
            <h2 className="section-title" id="status-heading">
              {t.research.statusTitle}
            </h2>
            <p className="section-copy">{t.research.statusBody}</p>
          </Reveal>
          <Reveal>
            <ServiceStatus />
          </Reveal>
        </div>
      </section>

      <section className="section section-compact">
        <div className="section-shell limitation-callout">
          <WarningCircle size={32} aria-hidden="true" />
          <div>
            <h2>{t.research.limitsTitle}</h2>
            <p>{t.research.limitsBody}</p>
          </div>
        </div>
      </section>
    </main>
  );
}
