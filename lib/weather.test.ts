import { describe, expect, it } from "vitest";
import {
  formatObservedAt,
  isStale,
  toUyoWeather,
  WeatherShapeError,
  WEATHER_STALE_AFTER_MS,
  UYO_COORDINATES,
  type OpenWeatherResponse,
} from "@/lib/weather";
import { uyoWeatherSchema } from "@/lib/contracts";

const now = new Date("2026-08-23T12:00:00.000Z");

const payload: OpenWeatherResponse = {
  dt: Math.floor(now.getTime() / 1000) - 300,
  weather: [{ description: "light rain" }],
  main: { temp: 26.4, feels_like: 29.1, humidity: 88, pressure: 1010 },
  wind: { speed: 2.6 },
  clouds: { all: 75 },
  rain: { "1h": 1.24 },
};

describe("Uyo coordinates", () => {
  it("uses the fixed coordinates from the notebook", () => {
    expect(UYO_COORDINATES).toEqual({ lat: 5.0377, lon: 7.9128 });
  });
});

describe("weather transformation", () => {
  it("maps a full OpenWeather payload onto the contract", () => {
    const weather = toUyoWeather(payload, now);
    expect(uyoWeatherSchema.safeParse(weather).success).toBe(true);
    expect(weather).toMatchObject({
      location: "Uyo, Akwa Ibom",
      condition: "light rain",
      temperature_c: 26.4,
      feels_like_c: 29.1,
      humidity_pct: 88,
      pressure_hpa: 1010,
      wind_speed_ms: 2.6,
      cloud_cover_pct: 75,
      rain_1h_mm: 1.24,
      stale: false,
      source: "OpenWeather",
    });
    expect(weather.fetched_at).toBe(now.toISOString());
  });

  it("defaults the optional readings that OpenWeather omits in dry, calm weather", () => {
    const weather = toUyoWeather({ ...payload, wind: undefined, clouds: undefined, rain: undefined }, now);
    expect(weather.wind_speed_ms).toBe(0);
    expect(weather.cloud_cover_pct).toBe(0);
    expect(weather.rain_1h_mm).toBe(0);
  });

  it("falls back to Unknown when no condition text is supplied", () => {
    expect(toUyoWeather({ ...payload, weather: [] }, now).condition).toBe("Unknown");
  });

  it("rejects a payload missing a reading the table has to render", () => {
    expect(() => toUyoWeather({ ...payload, main: { ...payload.main, temp: undefined } }, now)).toThrow(WeatherShapeError);
    expect(() => toUyoWeather({ ...payload, dt: undefined }, now)).toThrow(WeatherShapeError);
  });

  it("rejects a non-numeric reading rather than rendering NaN", () => {
    const corrupt = { ...payload, main: { ...payload.main, humidity: "88" as unknown as number } };
    expect(() => toUyoWeather(corrupt, now)).toThrow(WeatherShapeError);
  });
});

describe("stale observations", () => {
  it("treats a recent observation as fresh", () => {
    expect(isStale(new Date(now.getTime() - 60_000), now)).toBe(false);
  });

  it("marks an observation older than the stale window", () => {
    expect(isStale(new Date(now.getTime() - WEATHER_STALE_AFTER_MS - 1), now)).toBe(true);
  });

  it("marks an unparseable timestamp as stale rather than trusting it", () => {
    expect(isStale("not-a-date", now)).toBe(true);
  });

  it("flags a stale observation during transformation", () => {
    const old = { ...payload, dt: Math.floor((now.getTime() - WEATHER_STALE_AFTER_MS - 60_000) / 1000) };
    expect(toUyoWeather(old, now).stale).toBe(true);
  });
});

describe("observation timestamps", () => {
  it("renders in Lagos time, which is one hour ahead of UTC", () => {
    expect(formatObservedAt("2026-08-23T12:00:00.000Z")).toMatch(/13:00/);
  });

  it("does not throw on a corrupt timestamp", () => {
    expect(formatObservedAt("nonsense")).toBe("Unknown time");
  });
});
