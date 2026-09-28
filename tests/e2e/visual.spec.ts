import { expect, test, type Page } from "@playwright/test";
import { stubWeather } from "./helpers";

/** The breakpoints the design has to hold at, from small Android to desktop. */
const viewports = [
  { name: "360", width: 360, height: 780 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

const routes = [
  { path: "/", name: "home" },
  { path: "/predict", name: "predict" },
  { path: "/irrigate", name: "irrigate" },
  { path: "/research", name: "research" },
];

/**
 * Below-the-fold images are lazy, so the page has to be scrolled before a
 * full-page capture. The step count is bounded from the test side: the page
 * grows as images load, and re-reading `scrollHeight` inside a page-side loop
 * can keep it running indefinitely.
 */
async function loadAllImages(page: Page, viewportHeight: number) {
  const MAX_STEPS = 24;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const done = await page.evaluate(
      ({ offset }) => {
        window.scrollTo(0, offset);
        return offset >= document.body.scrollHeight;
      },
      { offset: step * viewportHeight },
    );
    await page.waitForTimeout(80);
    if (done) break;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForFunction(() => [...document.images].every((image) => image.complete), null, { timeout: 15_000 });
  await page.waitForTimeout(200);
}

for (const viewport of viewports) {
  for (const route of routes) {
    test(`${route.name} at ${viewport.name}px`, async ({ page }) => {
      test.setTimeout(90_000);

      // Reveal animations are viewport-driven and would make snapshots race the
      // scroll position. Reduced motion renders every section in its settled
      // state, which is the state these tests are meant to compare.
      await page.emulateMedia({ reducedMotion: "reduce" });
      await stubWeather(page);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(route.path, { waitUntil: "networkidle" });

      await loadAllImages(page, viewport.height);

      await expect(page).toHaveScreenshot(`${route.name}-${viewport.name}.png`, {
        fullPage: true,
        // The homepage server-renders the live observation, so `stubWeather`
        // (a client-side route intercept) cannot pin it. Mask the whole card:
        // its readings and timestamp change between runs.
        mask: [page.locator(".weather-card")],
      });
    });
  }
}
