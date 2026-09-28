"use client";

import { CheckCircle, Circle, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useApp } from "@/components/app-provider";
import { fetchModelMetadata, fetchReadiness } from "@/lib/api-client";
import type { ModelMetadata, Readiness } from "@/lib/contracts";

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; models: ModelMetadata[]; readiness: Readiness };

/**
 * Reads the deployment's own health endpoints so the research page reports what
 * is actually being served rather than what the repository hopes to serve.
 */
export function ServiceStatus() {
  const { t } = useApp();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [metadata, readiness] = await Promise.all([
          fetchModelMetadata({ signal: controller.signal }),
          fetchReadiness({ signal: controller.signal }),
        ]);
        setState({ status: "ready", models: metadata.models, readiness });
      } catch {
        if (!controller.signal.aborted) setState({ status: "error" });
      }
    })();
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return (
      <div className="status-panel" role="status">
        <Circle size={20} aria-hidden="true" /> {t.status.loading}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="status-panel" role="status">
        <WarningCircle size={20} aria-hidden="true" /> {t.status.unavailable}
      </div>
    );
  }

  return (
    <div className="status-grid">
      {state.models.map((model) => (
        <ModelCard key={model.task} model={model} readiness={state.readiness} />
      ))}
    </div>
  );
}

function ModelCard({ model, readiness }: { model: ModelMetadata; readiness: Readiness }) {
  const { t } = useApp();
  const production = model.status === "production";
  const taskLabel = model.task === "crop_recommendation" ? t.status.taskCrop : t.status.taskIrrigation;
  const mode = readiness.serving[model.task];
  const statusLabel = production ? t.status.production : model.status === "fixture" ? t.status.fixture : t.status.notServing;

  const rows: Array<[string, string]> = [
    [t.status.version, model.version],
    [t.status.servingMode, mode],
    [t.status.classes, String(model.classes)],
    [t.status.scoreKind, model.score_kind === "calibrated_confidence" ? t.status.calibrated : t.status.uncalibrated],
    [
      t.status.accuracy,
      model.held_out_accuracy === null
        ? t.status.notMeasured
        : model.held_out_accuracy.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 2 }),
    ],
  ];

  return (
    <div className={`status-panel is-detailed ${production ? "is-production" : ""}`}>
      <div className="status-panel-head">
        <span className={production ? "status" : "status is-stale"}>{statusLabel}</span>
        <p className="status-task">{taskLabel}</p>
        <h3>{model.name}</h3>
      </div>
      <dl className="status-rows">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {model.label_mapping && (
        <p className="status-gate">
          <WarningCircle size={18} aria-hidden="true" />
          <span>
            <b>{t.status.labelMapping}:</b> {model.label_mapping["2"]}
          </span>
        </p>
      )}
      {model.release_gate && (
        <p className="status-gate">
          {production ? <CheckCircle size={18} aria-hidden="true" /> : <WarningCircle size={18} aria-hidden="true" />}
          <span>
            <b>{t.status.releaseGate}:</b> {model.release_gate}
          </span>
        </p>
      )}
    </div>
  );
}
