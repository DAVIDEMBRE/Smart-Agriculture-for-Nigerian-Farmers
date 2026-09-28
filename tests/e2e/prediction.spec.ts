import { expect, test } from "@playwright/test";
import { failPrediction, fillSample, riceSample, switchToPidgin } from "./helpers";

test.describe("crop prediction journey", () => {
  test("English: the rice sample returns a result from the production CatBoost model", async ({ page }) => {
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();

    const result = page.getByRole("complementary", { name: /Crop recommendation result/i });
    await expect(result.getByRole("heading", { name: "rice", exact: true })).toBeVisible();
    await expect(result.getByText(/crop-recommendation-catboost@/i)).toBeVisible();
    await expect(result.getByText(/interface fixture/i)).toHaveCount(0);
  });

  test("English: the mothbeans row the fixture could not resolve is recovered by the real model", async ({ page }) => {
    await page.goto("/predict");
    await fillSample(page, {
      nitrogen: "3", phosphorus: "49", potassium: "18", temperature_c: "27.9", humidity_pct: "64.7", soil_ph: "3.69", rainfall_mm: "32.7",
    });
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByRole("complementary", { name: /Crop recommendation result/i }).getByRole("heading", { name: "mothbeans", exact: true })).toBeVisible();
  });

  test("English: watering guidance follows the recommendation", async ({ page }) => {
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByRole("heading", { name: "rice", exact: true })).toBeVisible();

    const guidance = page.getByRole("region", { name: /Watering guidance for Rice/i });
    await expect(guidance).toBeVisible();
    await expect(guidance.getByText(/standing water/i).first()).toBeVisible();
    await expect(guidance.getByText(/Every \d+ days|Keep \d+-\d+ cm/)).toBeVisible();
    await guidance.getByRole("button", { name: /Why this advice/i }).click();
    await expect(guidance.getByText(/FAO Training Manual 3/i)).toBeVisible();
  });

  test("English: ranked alternatives and the model version are shown", async ({ page }) => {
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();

    const result = page.getByRole("complementary", { name: /Crop recommendation result/i });
    await expect(result.getByRole("heading", { name: /Other model matches/i })).toBeVisible();
    await expect(result.locator(".alternative-row")).toHaveCount(3);
    await expect(result.getByText(/crop-recommendation-catboost@/i)).toBeVisible();
  });

  test("English: no per-input explanation block is shown while the API returns none", async ({ page }) => {
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByRole("heading", { name: "rice", exact: true })).toBeVisible();
    await expect(page.locator(".explanation-block")).toHaveCount(0);
  });

  test("Pidgin: the same journey works end to end", async ({ page }) => {
    await page.goto("/predict");
    await switchToPidgin(page);

    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tell us the condition");
    await fillSample(page);
    await page.getByRole("button", { name: /Check crop recommendation/i }).click();

    const result = page.getByRole("complementary", { name: /Crop recommendation result/i });
    await expect(result.getByRole("heading", { name: "rice", exact: true })).toBeVisible();
    await expect(result.getByText(/Top model score/i)).toBeVisible();
    await expect(page.getByRole("region", { name: /Watering guidance for Rice/i })).toBeVisible();
  });

  test("the language choice survives a page reload", async ({ page }) => {
    await page.goto("/predict");
    await switchToPidgin(page);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tell us the condition");
  });
});

test.describe("validation", () => {
  test("an empty form reports every missing measurement and moves focus", async ({ page }) => {
    await page.goto("/predict");
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();

    await expect(page.getByText("Enter a value.")).toHaveCount(7);
    await expect(page.locator("#nitrogen")).toBeFocused();
    await expect(page.getByTestId("form-status")).toContainText(/highlighted measurements/i);
  });

  test("a physically impossible value is rejected before any request is sent", async ({ page }) => {
    let requested = false;
    await page.route("**/api/v1/predictions/crop", (route) => {
      requested = true;
      return route.continue();
    });

    await page.goto("/predict");
    await fillSample(page, { ...riceSample, humidity_pct: "150" });
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();

    await expect(page.locator("#humidity_pct")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#humidity_pct")).toBeFocused();
    expect(requested).toBe(false);
  });

  test("a value outside the training envelope warns but still submits", async ({ page }) => {
    await page.goto("/predict");
    await fillSample(page, { ...riceSample, rainfall_mm: "640" });

    await expect(page.getByText(/Outside the training envelope/i)).toBeVisible();
    await expect(page.getByText(/rainfall_mm is outside the range/i)).toBeVisible();

    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByRole("complementary", { name: /Crop recommendation result/i }).getByRole("heading").first()).toBeVisible();
  });

  test("clearing the form restores the empty result panel", async ({ page }) => {
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByRole("heading", { name: "rice", exact: true })).toBeVisible();

    await page.getByRole("button", { name: /Clear form/i }).click();
    await expect(page.getByText(/Your result will appear here/i)).toBeVisible();
    await expect(page.locator("#nitrogen")).toHaveValue("");
  });
});

test.describe("failure states", () => {
  test("model unavailability is reported without losing the entered values", async ({ page }) => {
    await failPrediction(page, 503);
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();

    await expect(page.getByTestId("form-status")).toContainText(/unavailable right now/i);
    await expect(page.locator("#nitrogen")).toHaveValue("90");
  });

  test("a server-side rejection highlights the offending field", async ({ page }) => {
    await failPrediction(page, 422, {
      error: "invalid_input",
      issues: [{ path: ["soil_ph"], message: "Too big: expected number to be <=14" }],
    });
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();

    await expect(page.getByTestId("form-status")).toContainText(/rejected by the prediction service/i);
    await expect(page.locator("#soil_ph")).toHaveAttribute("aria-invalid", "true");
  });

  test("an unreadable response is reported as malformed rather than crashing", async ({ page }) => {
    await page.route("**/api/v1/predictions/crop", (route) =>
      route.fulfill({ status: 200, contentType: "text/html", body: "<html>gateway</html>" }),
    );
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByTestId("form-status")).toContainText(/unreadable response/i);
  });

  test("a dropped connection is reported and the request can be retried", async ({ page }) => {
    await page.route("**/api/v1/predictions/crop", (route) => route.abort("failed"));
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByTestId("form-status")).toContainText(/unavailable|offline/i);

    await page.unroute("**/api/v1/predictions/crop");
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();
    await expect(page.getByRole("heading", { name: "rice", exact: true })).toBeVisible();
  });

  test("a slow service keeps the button in its pending state", async ({ page }) => {
    await page.route("**/api/v1/predictions/crop", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      await route.continue();
    });
    await page.goto("/predict");
    await fillSample(page);
    await page.getByRole("button", { name: /Run crop recommendation/i }).click();

    const pending = page.getByRole("button", { name: /Checking conditions/i });
    await expect(pending).toBeVisible();
    await expect(pending).toBeDisabled();
    await expect(page.getByRole("heading", { name: "rice", exact: true })).toBeVisible();
  });
});
