"use client";

import { ArrowRight, Drop, Info, SpinnerGap, Warning } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { useApp } from "@/components/app-provider";
import { WateringGuidance } from "@/components/watering-guidance";
import { ApiError, predictIrrigation, type ApiErrorKind } from "@/lib/api-client";
import type { Dictionary } from "@/lib/content";
import {
  irrigationCrops,
  irrigationEnvelope,
  irrigationEnvelopeWarnings,
  irrigationNumericKeys,
  irrigationRequestSchema,
  irrigationSoils,
  irrigationStages,
  type IrrigationNumericKey,
  type IrrigationRequest,
  type IrrigationResponse,
} from "@/lib/contracts";
import { irrigationStageToGrowthStage } from "@/lib/irrigation-guidance";

type FieldKey = "crop" | "soil_type" | "growth_stage" | IrrigationNumericKey;
type FormValues = Record<FieldKey, string>;

const emptyValues: FormValues = { crop: "", soil_type: "", growth_stage: "", moisture_pct: "", temperature_c: "", humidity_pct: "" };

const numericMeta: Record<IrrigationNumericKey, { unit: string; step: string; example: string }> = {
  moisture_pct: { unit: "index", step: "1", example: "35" },
  temperature_c: { unit: "°C", step: "0.1", example: "28" },
  humidity_pct: { unit: "%", step: "0.1", example: "70" },
};

const errorCopyKey: Record<ApiErrorKind, keyof Dictionary["errors"]> = {
  invalid_input: "invalidInput",
  offline: "offline",
  timeout: "timeout",
  unavailable: "unavailable",
  malformed: "malformed",
};

function toRequest(values: FormValues) {
  return {
    crop: values.crop,
    soil_type: values.soil_type,
    growth_stage: values.growth_stage,
    moisture_pct: Number(values.moisture_pct),
    temperature_c: Number(values.temperature_c),
    humidity_pct: Number(values.humidity_pct),
  };
}

function formatScore(value: number): string {
  return value.toLocaleString(undefined, { style: "percent", maximumFractionDigits: 1 });
}

export function IrrigationForm() {
  const { t } = useApp();
  const c = t.irrigate;
  const [values, setValues] = useState<FormValues>(emptyValues);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [result, setResult] = useState<{ response: IrrigationResponse; request: IrrigationRequest } | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");
  const firstFieldRef = useRef<HTMLSelectElement>(null);

  const parsedLive = useMemo(() => irrigationRequestSchema.safeParse(toRequest(values)), [values]);
  const liveWarnings = useMemo(() => (parsedLive.success ? irrigationEnvelopeWarnings(parsedLive.data) : []), [parsedLive]);

  function update(key: FieldKey, value: string) {
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
    setStatus("idle");
    setMessage("");
    firstFieldRef.current?.focus();
  }

  function focusFirstError(nextErrors: Partial<Record<FieldKey, string>>) {
    const order: FieldKey[] = ["crop", "soil_type", "growth_stage", ...irrigationNumericKeys];
    const firstKey = order.find((key) => nextErrors[key]);
    if (firstKey) document.getElementById(`irr-${firstKey}`)?.focus();
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const parsed = irrigationRequestSchema.safeParse(toRequest(values));
    const missing = (Object.keys(emptyValues) as FieldKey[]).filter((key) => values[key].trim() === "");
    if (!parsed.success || missing.length > 0) {
      const nextErrors: Partial<Record<FieldKey, string>> = {};
      for (const key of missing) nextErrors[key] = t.predict.required;
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const key = issue.path[0] as FieldKey;
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
      const response = await predictIrrigation(parsed.data);
      setResult({ response, request: parsed.data });
      setStatus("idle");
    } catch (error) {
      setResult(null);
      setStatus("error");
      if (error instanceof ApiError) {
        setMessage(error.kind === "unavailable" ? c.modelUnavailable : t.errors[errorCopyKey[error.kind]]);
        const issues = error.fieldIssues as Partial<Record<FieldKey, string>>;
        if (error.kind === "invalid_input" && Object.keys(issues).length > 0) {
          setErrors(issues);
          focusFirstError(issues);
        }
      } else {
        setMessage(t.errors.generic);
      }
    }
  }

  const selectField = (key: "crop" | "soil_type" | "growth_stage", label: string, hint: string, options: readonly string[]) => {
    const error = errors[key];
    const id = `irr-${key}`;
    return (
      <div className="field" key={key}>
        <label htmlFor={id}>{label}</label>
        <select
          id={id}
          name={key}
          ref={key === "crop" ? firstFieldRef : undefined}
          value={values[key]}
          onChange={(event) => update(key, event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error ${id}-hint` : `${id}-hint`}
        >
          <option value="">{c.choose}</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        {error && (
          <small id={`${id}-error`} className="field-error">
            {error}
          </small>
        )}
        <small id={`${id}-hint`}>{hint}</small>
      </div>
    );
  };

  const numericField = (key: IrrigationNumericKey, label: string, hint: string) => {
    const [min, max] = irrigationEnvelope[key];
    const meta = numericMeta[key];
    const error = errors[key];
    const id = `irr-${key}`;
    return (
      <div className="field" key={key}>
        <div className="field-label-row">
          <label htmlFor={id}>{label}</label>
          <span className="field-unit" aria-hidden="true">
            {meta.unit}
          </span>
        </div>
        <input
          id={id}
          name={key}
          type="number"
          inputMode="decimal"
          step={meta.step}
          value={values[key]}
          onChange={(event) => update(key, event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error ${id}-hint` : `${id}-hint`}
        />
        {error && (
          <small id={`${id}-error`} className="field-error">
            {error}
          </small>
        )}
        <small id={`${id}-hint`}>
          {hint} {t.predict.exampleLabel}: {meta.example}. {t.predict.rangeLabel}: {min}–{max}.
        </small>
      </div>
    );
  };

  return (
    <div className="form-layout">
      <form className="form-panel" onSubmit={submit} noValidate>
        <div className="form-intro-note">
          <Info size={20} aria-hidden="true" />
          <p>{c.note}</p>
        </div>

        <fieldset className="form-fieldset">
          <legend className="visually-hidden">{c.fieldsLabel}</legend>
          <div className="form-grid">
            {selectField("crop", c.crop, c.cropHint, irrigationCrops)}
            {selectField("soil_type", c.soilType, c.soilTypeHint, irrigationSoils)}
            {selectField("growth_stage", c.growthStage, c.growthStageHint, irrigationStages)}
            {numericField("moisture_pct", c.moisture, c.moistureHint)}
            {numericField("temperature_c", c.temperature, c.temperatureHint)}
            {numericField("humidity_pct", c.humidity, c.humidityHint)}
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
                <SpinnerGap className="spin" size={18} aria-hidden="true" /> {c.submitting}
              </>
            ) : (
              <>
                {c.submit}
                <ArrowRight size={18} aria-hidden="true" />
              </>
            )}
          </button>
          <button className="button-secondary" type="button" onClick={reset}>
            {c.reset}
          </button>
        </div>

        <p className="form-status" role="alert" data-testid="irrigation-status">
          {message}
        </p>
      </form>

      <aside className="result-card" aria-live="polite" aria-label={c.resultHeading}>
        {!result ? (
          <div className="empty-result">
            <span className="result-index" aria-hidden="true">
              <Drop size={40} />
            </span>
            <h2>{c.emptyTitle}</h2>
            <p>{c.emptyBody}</p>
          </div>
        ) : (
          <div>
            <span className="result-label">{c.resultHeading}</span>
            <h2 className={`result-crop result-decision ${result.response.decision === "irrigate" ? "is-irrigate" : "is-hold"}`}>
              {result.response.decision === "irrigate" ? c.decisionIrrigate : c.decisionNo}
            </h2>
            <p className="score-note">
              {c.scorePrefix}: {formatScore(result.response.model_score)}.
            </p>
            <p className="result-context">
              {result.request.crop} · {result.request.soil_type} · {result.request.growth_stage}
            </p>
            {result.response.warnings.length > 0 && (
              <div className="warning-box">
                <b>{t.result.important}</b>
                {result.response.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            )}
            <p className="result-responsible">{c.responsibleUse}</p>
            <p className="result-meta">
              {t.result.modelLabel}: {result.response.model_version}
              <br />
              {t.result.requestLabel}: {result.response.request_id.slice(0, 8)}
            </p>
          </div>
        )}
      </aside>

      {result && (
        <div className="guidance-slot">
          <WateringGuidance
            key={`${result.request.crop}-${result.request.growth_stage}`}
            crop={result.request.crop}
            initialStage={irrigationStageToGrowthStage(result.request.growth_stage)}
            temperatureC={result.request.temperature_c}
            humidityPct={result.request.humidity_pct}
          />
        </div>
      )}
    </div>
  );
}
