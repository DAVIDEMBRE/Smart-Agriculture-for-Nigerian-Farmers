import "server-only";

import type { UyoWeather } from "@/lib/contracts";
import { toUyoWeather, UYO_COORDINATES, WeatherShapeError, type OpenWeatherResponse } from "@/lib/weather";

/**
 * Server-side read of the current Uyo observation, shared by the route handler
 * and by the homepage so the first paint already contains the table. Returns
 * `null` for every failure mode; callers decide how to present that.
 *
 * The OpenWeather key is read here and never leaves the server.
 */
export async function readUyoWeather(): Promise<UyoWeather | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;

  try {
    const url = new URL("https://api.openweathermap.org/data/2.5/weather");
    url.searchParams.set("lat", String(UYO_COORDINATES.lat));
    url.searchParams.set("lon", String(UYO_COORDINATES.lon));
    url.searchParams.set("appid", key);
    url.searchParams.set("units", "metric");

    const response = await fetch(url, { next: { revalidate: 600 }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`OpenWeather returned ${response.status}`);

    return toUyoWeather((await response.json()) as OpenWeatherResponse);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "weather_fetch_error",
        reason: error instanceof WeatherShapeError ? "malformed_upstream_payload" : "upstream_error",
        error: error instanceof Error ? error.message : "unknown",
      }),
    );
    return null;
  }
}
