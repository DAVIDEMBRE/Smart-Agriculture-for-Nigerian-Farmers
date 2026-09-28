import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fillSample, stubWeather } from "./helpers";

/** WCAG 2.2 AA maps onto these axe tag sets. */
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/**
 * Scroll-triggered reveal animations hold content at zero opacity until it
 * enters the viewport, which axe would otherwise report as a contrast failure.
 * Scrolling the page once puts every section into its settled state before the
 * scan runs.
 */
async function settle(page: Page) {
  await page.evaluate(async () => {
    const step = window.innerHeight;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => setTimeout(resolve, 250));
  });
}

async function analyse(page: Page) {
  await settle(page);
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

const routes = [
  ["/", "homepage"],
  ["/predict", "prediction page"],
  ["/irrigate", "irrigation page"],
  ["/research", "research page"],
] as const;

for (const [path, name] of routes) {
  test(`${name} has no WCAG 2.2 AA violations in light mode`, async ({ page }) => {
    await stubWeather(page);
    await page.goto(path);
    const { violations } = await analyse(page);
    expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });

  test(`${name} has no WCAG 2.2 AA violations in dark mode`, async ({ page }) => {
    await stubWeather(page);
    await page.goto(path);
    await page.getByRole("button", { name: /Use dark theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    const { violations } = await analyse(page);
    expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
  });
}

test("the homepage in Pidgin has no WCAG 2.2 AA violations", async ({ page }) => {
  await stubWeather(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Switch to Nigerian Pidgin/i }).click();
  const { violations } = await analyse(page);
  expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test("the prediction result region is accessible once populated", async ({ page }) => {
  await page.goto("/predict");
  await fillSample(page);
  await page.getByRole("button", { name: /Run crop recommendation/i }).click();
  await expect(page.getByRole("heading", { name: "rice", exact: true })).toBeVisible();

  const { violations } = await analyse(page);
  expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test("the irrigation result and guidance block are accessible once populated", async ({ page }) => {
  await page.goto("/irrigate");
  await page.locator("#irr-crop").selectOption("Wheat");
  await page.locator("#irr-soil_type").selectOption("Black Soil");
  await page.locator("#irr-growth_stage").selectOption("Germination");
  await page.locator("#irr-moisture_pct").fill("2");
  await page.locator("#irr-temperature_c").fill("26");
  await page.locator("#irr-humidity_pct").fill("77");
  await page.getByRole("button", { name: /Check irrigation/i }).click();
  await expect(page.getByRole("heading", { name: /Irrigate now/i })).toBeVisible();
  await page.getByRole("button", { name: /Why this advice/i }).click();

  const { violations } = await analyse(page);
  expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test("the validation error state is accessible", async ({ page }) => {
  await page.goto("/predict");
  await page.getByRole("button", { name: /Run crop recommendation/i }).click();
  await expect(page.getByText("Enter a value.").first()).toBeVisible();

  const { violations } = await analyse(page);
  expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});

test("the expanded research figure dialog is accessible", async ({ page }) => {
  await page.goto("/research");
  await page.getByRole("button", { name: /Expand this figure/i }).first().click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const { violations } = await analyse(page);
  expect(violations.map((violation) => `${violation.id}: ${violation.help}`)).toEqual([]);
});
