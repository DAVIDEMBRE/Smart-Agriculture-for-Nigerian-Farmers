import type { UyoWeather } from "@/lib/contracts";

/** Fixed Uyo coordinates taken from the research notebook. */
export const UYO_COORDINATES = { lat: 5.0377, lon: 7.9128 } as const;

/** The interface refreshes on this interval; the route cache uses the same window. */
export const WEATHER_REFRESH_MS = 600_000;

/** An observation older than this is presented as stale even when it just arrived. */
export const WEATHER_STALE_AFTER_MS = 3 * WEATHER_REFRESH_MS;

export type OpenWeatherResponse = {
  dt?: number;
  weather?: Array<{ description?: string }>;
  main?: { temp?: number; feels_like?: number; humidity?: number; pressure?: number };
  wind?: { speed?: number };
  clouds?: { all?: number };
  rain?: Record<string, number>;
};

export class WeatherShapeError extends Error {
  constructor(field: string) {
    super(`OpenWeather response is missing ${field}`);
    this.name = "WeatherShapeError";
  }
}

function requireNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new WeatherShapeError(field);
  return value;
}

/**
 * Map an OpenWeather current-weather payload onto the app's own contract.
 * Optional readings fall back to zero; the fields the table cannot render
 * without raise `WeatherShapeError` so the route can answer 503 instead of
 * rendering `NaN`.
 */
export function toUyoWeather(raw: OpenWeatherResponse, now: Date = new Date()): UyoWeather {
  const observedAt = new Date(requireNumber(raw.dt, "dt") * 1000);
  return {
    location: "Uyo, Akwa Ibom",
    condition: raw.weather?.[0]?.description ?? "Unknown",
    temperature_c: requireNumber(raw.main?.temp, "main.temp"),
    feels_like_c: requireNumber(raw.main?.feels_like, "main.feels_like"),
    humidity_pct: requireNumber(raw.main?.humidity, "main.humidity"),
    pressure_hpa: requireNumber(raw.main?.pressure, "main.pressure"),
    wind_speed_ms: raw.wind?.speed ?? 0,
    cloud_cover_pct: raw.clouds?.all ?? 0,
    rain_1h_mm: raw.rain?.["1h"] ?? 0,
    observed_at: observedAt.toISOString(),
    fetched_at: now.toISOString(),
    stale: isStale(observedAt, now),
    source: "OpenWeather",
  };
}

export function isStale(observedAt: Date | string, now: Date = new Date()): boolean {
  const observed = typeof observedAt === "string" ? new Date(observedAt) : observedAt;
  if (Number.isNaN(observed.getTime())) return true;
  return now.getTime() - observed.getTime() > WEATHER_STALE_AFTER_MS;
}

export function formatObservedAt(iso: string, locale = "en-NG"): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(locale === "pcm" ? "en-NG" : locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Africa/Lagos",
  }).format(date);
}
