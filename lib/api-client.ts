/**
 * The single interface between UI components and the prediction service.
 *
 * Components never call `fetch` directly. Today every call lands on a
 * same-origin Next.js route handler, which serves the deterministic fixture
 * until `FASTAPI_BASE_URL` is configured. Swapping the fixture adapter for
 * FastAPI therefore requires no component change.
 */

import {
  cropPredictionResponseSchema,
  irrigationResponseSchema,
  modelMetadataListSchema,
  readinessSchema,
  uyoWeatherSchema,
  type CropPredictionRequest,
  type CropPredictionResponse,
  type FeatureKey,
  type IrrigationRequest,
  type IrrigationResponse,
  type ModelMetadataList,
  type Readiness,
  type UyoWeather,
} from "@/lib/contracts";

export type ApiErrorKind =
  /** The service rejected one or more measurements (HTTP 422). */
  | "invalid_input"
  /** The browser has no network connection. */
  | "offline"
  /** The request exceeded the client timeout. */
  | "timeout"
  /** The service answered 5xx, or could not be reached. */
  | "unavailable"
  /** The response body did not match the agreed schema. */
  | "malformed";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  /** Per-field messages, present only for `invalid_input`. */
  readonly fieldIssues: Partial<Record<string, string>>;

  constructor(kind: ApiErrorKind, message: string, fieldIssues: Partial<Record<string, string>> = {}) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.fieldIssues = fieldIssues;
  }
}

export const PREDICTION_TIMEOUT_MS = 15_000;
export const READ_TIMEOUT_MS = 10_000;

type ZodIssueLike = { path?: unknown[]; message?: string };

function toFieldIssues(payload: unknown): Partial<Record<string, string>> {
  const issues = (payload as { issues?: ZodIssueLike[] } | null)?.issues;
  if (!Array.isArray(issues)) return {};
  const mapped: Partial<Record<string, string>> = {};
  for (const issue of issues) {
    const key = issue?.path?.[0];
    if (typeof key === "string" && issue.message) mapped[key] = issue.message;
  }
  return mapped;
}

/** Narrows the generic field issues to the crop form's keys. */
export function cropFieldIssues(error: ApiError): Partial<Record<FeatureKey, string>> {
  return error.fieldIssues as Partial<Record<FeatureKey, string>>;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiError("malformed", "The service returned a response that could not be read.");
  }
}

type RequestOptions = { signal?: AbortSignal; timeoutMs?: number };

/** Runs a request with a timeout and maps every transport failure onto `ApiError`. */
async function send(path: string, init: RequestInit, options: RequestOptions): Promise<Response> {
  if (isOffline()) throw new ApiError("offline", "No network connection is available.");

  const timeout = AbortSignal.timeout(options.timeoutMs ?? READ_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  try {
    return await fetch(path, { ...init, signal });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (isOffline()) throw new ApiError("offline", "No network connection is available.");
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new ApiError("timeout", "The service took too long to answer.");
    }
    throw new ApiError("unavailable", "The service could not be reached.");
  }
}

export async function predictCrop(
  input: CropPredictionRequest,
  options: RequestOptions = {},
): Promise<CropPredictionResponse> {
  const response = await send(
    "/api/v1/predictions/crop",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
    { ...options, timeoutMs: options.timeoutMs ?? PREDICTION_TIMEOUT_MS },
  );

  if (response.status === 422) {
    const payload = await readJson(response).catch(() => null);
    throw new ApiError("invalid_input", "Some measurements were rejected.", toFieldIssues(payload));
  }
  if (!response.ok) {
    throw new ApiError("unavailable", `The prediction service answered ${response.status}.`);
  }

  const parsed = cropPredictionResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new ApiError("malformed", "The prediction response did not match the agreed schema.");
  }
  return parsed.data;
}

export async function predictIrrigation(
  input: IrrigationRequest,
  options: RequestOptions = {},
): Promise<IrrigationResponse> {
  const response = await send(
    "/api/v1/predictions/irrigation",
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
    { ...options, timeoutMs: options.timeoutMs ?? PREDICTION_TIMEOUT_MS },
  );

  if (response.status === 422) {
    const payload = await readJson(response).catch(() => null);
    throw new ApiError("invalid_input", "Some inputs were rejected.", toFieldIssues(payload));
  }
  if (!response.ok) {
    throw new ApiError("unavailable", `The irrigation service answered ${response.status}.`);
  }

  const parsed = irrigationResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new ApiError("malformed", "The irrigation response did not match the agreed schema.");
  }
  return parsed.data;
}

export async function fetchUyoWeather(options: RequestOptions = {}): Promise<UyoWeather> {
  const response = await send("/api/v1/weather/uyo", { cache: "no-store" }, options);
  if (!response.ok) throw new ApiError("unavailable", "Live weather is unavailable.");

  const parsed = uyoWeatherSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new ApiError("malformed", "The weather response did not match the agreed schema.");
  return parsed.data;
}

export async function fetchModelMetadata(options: RequestOptions = {}): Promise<ModelMetadataList> {
  const response = await send("/api/v1/model-metadata", { cache: "no-store" }, options);
  if (!response.ok) throw new ApiError("unavailable", "Model metadata is unavailable.");

  const parsed = modelMetadataListSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new ApiError("malformed", "The metadata response did not match the agreed schema.");
  return parsed.data;
}

/**
 * Readiness answers 503 while the deployment is fixture-only, which is a valid
 * state to render rather than a transport failure.
 */
export async function fetchReadiness(options: RequestOptions = {}): Promise<Readiness> {
  const response = await send("/api/v1/readiness", { cache: "no-store" }, options);
  if (response.status !== 200 && response.status !== 503) {
    throw new ApiError("unavailable", "Readiness is unavailable.");
  }

  const parsed = readinessSchema.safeParse(await readJson(response));
  if (!parsed.success) throw new ApiError("malformed", "The readiness response did not match the agreed schema.");
  return parsed.data;
}

/** Maps an unknown thrown value onto the dictionary key used to describe it. */
export function errorMessageKey(error: unknown): ApiErrorKind | "generic" {
  return error instanceof ApiError ? error.kind : "generic";
}
