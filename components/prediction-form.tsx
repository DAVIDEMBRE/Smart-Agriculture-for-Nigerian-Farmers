"use client";

import { ArrowRight, Info, SpinnerGap, Warning } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { WateringGuidance } from "@/components/watering-guidance";
import { ApiError, cropFieldIssues, predictCrop } from "@/lib/api-client";
import {
  cropPredictionSchema,
  envelopeWarnings,
  featureKeys,
  trainingEnvelope,
  type CropPredictionRequest,
  type CropPredictionResponse,
  type FeatureKey,
} from "@/lib/contracts";
import type { Dictionary } from "@/lib/content";
import type { ApiErrorKind } from "@/lib/api-client";

/** Maps a transport failure onto the dictionary entry that describes it. */
const errorCopyKey: Record<ApiErrorKind, keyof Dictionary["errors"]> = {
  invalid_input: "invalidInput",
  offline: "offline",
  timeout: "timeout",
  unavailable: "unavailable",
  malformed: "malformed",
};

type FormValues = Record<FeatureKey, string>;

const emptyValues: FormValues = {
  nitrogen: "",
  phosphorus: "",
  potassium: "",
  temperature_c: "",
  humidity_pct: "",
  soil_ph: "",
  rainfall_mm: "",
};

/** Unit, input step and worked example for each of the seven measurements. */
const fieldMeta: Record<FeatureKey, { unit: string; step: string; example: string }> = {
  nitrogen: { unit: "N", step: "1", example: "90" },
  phosphorus: { unit: "P", step: "1", example: "42" },
  potassium: { unit: "K", step: "1", example: "43" },
  temperature_c: { unit: "°C", step: "0.1", example: "20.9" },
  humidity_pct: { unit: "%", step: "0.1", example: "82" },
  soil_ph: { unit: "pH", step: "0.1", example: "6.5" },
  rainfall_mm: { unit: "mm", step: "0.1", example: "202.9" },
};

function fieldLabel(t: Dictionary, key: FeatureKey): string {
  const labels: Record<FeatureKey, string> = {
    nitrogen: t.predict.nitrogen,
    phosphorus: t.predict.phosphorus,
    potassium: t.predict.potassium,
    temperature_c: t.predict.temperature,
    humidity_pct: t.predict.humidity,
    soil_ph: t.predict.soilPh,
    rainfall_mm: t.predict.rainfall,
  };
  return labels[key];
}

function fieldHint(t: Dictionary, key: FeatureKey): string {
  const hints: Record<FeatureKey, string> = {
    nitrogen: t.predict.nitrogenHint,
    phosphorus: t.predict.phosphorusHint,
    potassium: t.predict.potassiumHint,
    temperature_c: t.predict.temperatureHint,
    humidity_pct: t.predict.humidityHint,
    soil_ph: t.predict.soilPhHint,
    rainfall_mm: t.predict.rainfallHint,
  };
  return hints[key];
}

function toNumbers(values: FormValues): CropPredictionRequest {
  return Object.fromEntries(featureKeys.map((key) => [key, Number(values[key])])) as CropPredictionRequest;
}

function isComplete(values: FormValues): boolean {
  return featureKeys.every((key) => values[key].trim() !== "" && Number.isFinite(Number(values[key])));
}

function formatScore(value: number): string {
  return value.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 1 });
}

export function PredictionForm() {
  const { t } = useApp();
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<FeatureKey, string>>>({});
  const [result, setResult] = useState<CropPredictionResponse | null>(null);
  const [submitted, setSubmitted] = useState<CropPredictionRequest | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const firstFieldRef = useRef<HTMLInputElement>(null);

  // Warnings are computed as the user types, so an out-of-distribution reading
  // is visible before the request is ever sent.
  const liveWarnings = useMemo(
    () => (isComplete(values) ? envelopeWarnings(toNumbers(values)) : []),
    [values],
  );

  function update(key: FeatureKey, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function reset() {
    setValues(emptyValues);
    setErrors({});
    setResult(null);
    setSubmitted(null);
    setStatus("idle");
    setMessage("");
    firstFieldRef.current?.focus();
  }

  function focusFirstError(nextErrors: Partial<Record<FeatureKey, string>>) {
    const firstKey = featureKeys.find((key) => nextErrors[key]);
    if (firstKey) document.getElementById(firstKey)?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const candidate = toNumbers(values);
    const parsed = cropPredictionSchema.safeParse(candidate);
    const missing = featureKeys.filter((key) => values[key].trim() === "");

    if (!parsed.success || missing.length > 0) {
      const nextErrors: Partial<Record<FeatureKey, string>> = {};
      for (const key of missing) nextErrors[key] = t.predict.required;
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as FeatureKey;
          if (!nextErrors[key]) nextErrors[key] = issue.message;
        }
      }
      setErrors(nextErrors);
      setStatus("error");
      setMessage(t.predict.checkFields);
      focusFirstError(nextErrors);
      return;
    }

    setStatus("loading");
    setErrors({});
    try {
      setResult(await predictCrop(parsed.data));
      setSubmitted(parsed.data);
      setStatus("idle");
    } catch (error) {
      setResult(null);
      setStatus("error");
      if (error instanceof ApiError) {
        setMessage(t.errors[errorCopyKey[error.kind]]);
        const issues = cropFieldIssues(error);
        if (error.kind === "invalid_input" && Object.keys(issues).length > 0) {
          setErrors(issues);
          focusFirstError(issues);
        }
      } else {
        setMessage(t.errors.generic);
      }
    }
  }

  return (
    <div className="form-layout">
      <form className="form-panel" onSubmit={submit} noValidate>
        <div className="form-intro-note">
          <Info size={20} aria-hidden="true" />
          <p>{t.predict.note}</p>
        </div>

        <fieldset className="form-fieldset">
          <legend className="visually-hidden">{t.predict.fieldsLabel}</legend>
          <div className="form-grid">
            {featureKeys.map((key, index) => {
              const [min, max] = trainingEnvelope[key];
              const meta = fieldMeta[key];
              const decimals = meta.step === "1" ? 0 : 1;
              const error = errors[key];
              const errorId = `${key}-error`;
              const hintId = `${key}-hint`;
              return (
                <div className="field" key={key}>
                  <div className="field-label-row">
                    <label htmlFor={key}>{fieldLabel(t, key)}</label>
                    <span className="field-unit" aria-hidden="true">
                      {meta.unit}
                    </span>
                  </div>
                  <input
                    id={key}
                    name={key}
                    ref={index === 0 ? firstFieldRef : undefined}
                    type="number"
                    inputMode="decimal"
                    step={meta.step}
                    value={values[key]}
                    onChange={(event) => update(key, event.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? `${errorId} ${hintId}` : hintId}
                  />
                  {error && (
                    <small id={errorId} className="field-error">
                      {error}
                    </small>
                  )}
                  <small id={hintId}>
                    {fieldHint(t, key)} {t.predict.exampleLabel}: {meta.example} {meta.unit}. {t.predict.rangeLabel}:{" "}
                    {min.toFixed(decimals)}–{max.toFixed(decimals)}.
                  </small>
                </div>
              );
            })}
          </div>
        </fieldset>

        {liveWarnings.length > 0 && (
          <div className="preflight-warning" role="status">
            <Warning size={21} aria-hidden="true" />
            <div>
              <b>{t.predict.envelopeHeading}</b>
              <p>{t.predict.envelopeBody}</p>
              <ul>
                {liveWarnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button className="button-primary" type="submit" disabled={status === "loading"}>
            {status === "loading" ? (
              <>
                <SpinnerGap className="spin" size={18} aria-hidden="true" /> {t.predict.submitting}
              </>
            ) : (
              <>
                {t.predict.submit}
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
          <button className="button-secondary" type="button" onClick={reset}>
            {t.predict.reset}
          </button>
        </div>

        <p className="form-status" role="alert" data-testid="form-status">
          {message}
        </p>
      </form>

      <aside className="result-card" aria-live="polite" aria-label={t.result.heading}>
        {!result ? (
          <div className="empty-result">
            <span className="result-index" aria-hidden="true">
              {t.result.emptyIndex}
            </span>
            <h2>{t.result.emptyTitle}</h2>
            <p>{t.result.emptyBody}</p>
          </div>
        ) : (
          <div>
            <span className="result-label">{t.result.label}</span>
            <h2 className="result-crop">{result.recommendation}</h2>
            <p className="score-note">
              {t.result.scorePrefix}: {formatScore(result.model_score)}.
            </p>

            {result.alternatives.length > 0 && (
              <div className="alternative-list">
                <h3>{t.result.alternatives}</h3>
                {result.alternatives.map((item) => (
                  <div className="alternative-row" key={item.crop}>
                    <span>{item.crop}</span>
                    <b>{formatScore(item.model_score)}</b>
                  </div>
                ))}
              </div>
            )}

            {/* Shown only once the API returns verified per-input attributions. */}
            {result.explanations.length > 0 && (
              <div className="explanation-block">
                <h3>{t.result.explanations}</h3>
                <ul className="explanation-list">
                  {result.explanations.map((item) => (
                    <li key={item.feature}>
                      <span>{fieldLabel(t, item.feature)}</span>
                      <em className={item.direction === "supports" ? "is-supporting" : "is-opposing"}>
                        {item.direction === "supports" ? t.result.supports : t.result.opposes}
                      </em>
                      <b>{item.impact.toFixed(3)}</b>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.warnings.length > 0 && (
              <div className="warning-box">
                <b>{t.result.important}</b>
                {result.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}

            <p className="result-meta">
              {t.result.modelLabel}: {result.model_version}
              <br />
              {t.result.requestLabel}: {result.request_id.slice(0, 8)}
            </p>
          </div>
        )}
      </aside>

      {result && submitted && (
        <div className="guidance-slot">
          <WateringGuidance
            key={result.recommendation}
            crop={result.recommendation}
            temperatureC={submitted.temperature_c}
            humidityPct={submitted.humidity_pct}
          />
        </div>
      )}
    </div>
  );
}
