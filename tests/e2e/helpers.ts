import type { Page, Route } from "@playwright/test";

export const riceSample = {
  nitrogen: "90",
  phosphorus: "42",
  potassium: "43",
  temperature_c: "20.9",
  humidity_pct: "82",
  soil_ph: "6.5",
  rainfall_mm: "202.9",
} as const;

/** Field labels as rendered in each locale, used to target the number inputs. */
export const fieldLabels = {
  en: {
    nitrogen: "Nitrogen",
    phosphorus: "Phosphorus",
    potassium: "Potassium",
    temperature_c: "Temperature",
    humidity_pct: "Relative humidity",
    soil_ph: "Soil pH",
    rainfall_mm: "Rainfall",
  },
  pcm: {
    nitrogen: "Nitrogen",
    phosphorus: "Phosphorus",
    potassium: "Potassium",
    temperature_c: "Temperature",
    humidity_pct: "Water wey dey air",
    soil_ph: "Soil pH",
    rainfall_mm: "Rainfall",
  },
} as const;

/** Fills the seven measurements by their `id`, which is stable across locales. */
export async function fillSample(page: Page, values: Record<string, string> = riceSample) {
  for (const [key, value] of Object.entries(values)) {
    await page.locator(`#${key}`).fill(value);
  }
}

export async function switchToPidgin(page: Page) {
  await page.getByRole("button", { name: /Switch to Nigerian Pidgin/i }).click();
}

/** Serves a fixed observation so weather-dependent assertions stay deterministic. */
export async function stubWeather(page: Page) {
  await page.route("**/api/v1/weather/uyo", (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        location: "Uyo, Akwa Ibom",
        condition: "light rain",
        temperature_c: 26.4,
        feels_like_c: 29.1,
        humidity_pct: 88,
        pressure_hpa: 1010,
        wind_speed_ms: 2.6,
        cloud_cover_pct: 75,
        rain_1h_mm: 1.24,
        observed_at: new Date().toISOString(),
        fetched_at: new Date().toISOString(),
        stale: false,
        source: "OpenWeather",
      }),
    }),
  );
}

export async function failPrediction(page: Page, status: number, body: unknown = { error: "prediction_unavailable" }) {
  await page.route("**/api/v1/predictions/crop", (route: Route) =>
    route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) }),
  );
}
