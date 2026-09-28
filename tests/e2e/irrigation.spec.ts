import { expect, test } from "@playwright/test";
import { switchToPidgin } from "./helpers";

const dryWheat = { crop: "Wheat", soil_type: "Black Soil", growth_stage: "Germination", moisture_pct: "2", temperature_c: "26", humidity_pct: "77" };

async function fillIrrigation(page: import("@playwright/test").Page, values = dryWheat) {
  await page.locator("#irr-crop").selectOption(values.crop);
  await page.locator("#irr-soil_type").selectOption(values.soil_type);
  await page.locator("#irr-growth_stage").selectOption(values.growth_stage);
  await page.locator("#irr-moisture_pct").fill(values.moisture_pct);
  await page.locator("#irr-temperature_c").fill(values.temperature_c);
  await page.locator("#irr-humidity_pct").fill(values.humidity_pct);
}

test.describe("irrigation decision journey", () => {
  test("English: a bone-dry germinating wheat field is told to irrigate now", async ({ page }) => {
    await page.goto("/irrigate");
    await fillIrrigation(page);
    await page.getByRole("button", { name: /Check irrigation/i }).click();

    const result = page.getByRole("complementary", { name: /Irrigation decision result/i });
    await expect(result.getByRole("heading", { name: /Irrigate now/i })).toBeVisible();
    await expect(result.getByText(/irrigation-decision-xgboost@/i)).toBeVisible();
    await expect(result.getByText(/does not schedule water/i)).toBeVisible();
  });

  test("English: a saturated field is told not to irrigate", async ({ page }) => {
    await page.goto("/irrigate");
    await fillIrrigation(page, { ...dryWheat, moisture_pct: "95", temperature_c: "30", humidity_pct: "60" });
    await page.getByRole("button", { name: /Check irrigation/i }).click();
    await expect(page.getByRole("heading", { name: /Do not irrigate now/i })).toBeVisible();
  });

  test("English: guidance for the crop follows the decision", async ({ page }) => {
    await page.goto("/irrigate");
    await fillIrrigation(page);
    await page.getByRole("button", { name: /Check irrigation/i }).click();
    await expect(page.getByRole("heading", { name: /Irrigate now/i })).toBeVisible();

    const guidance = page.getByRole("region", { name: /Watering guidance for Wheat/i });
    await expect(guidance).toBeVisible();
    await expect(guidance.getByText(/Every \d+ days|Every day/)).toBeVisible();
  });

  test("Pidgin: the same journey works end to end", async ({ page }) => {
    await page.goto("/irrigate");
    await switchToPidgin(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Make we water");
    await fillIrrigation(page);
    await page.getByRole("button", { name: /Check irrigation/i }).click();
    await expect(page.getByRole("heading", { name: /Water am now/i })).toBeVisible();
    await expect(page.getByRole("region", { name: /Watering guidance for Wheat/i })).toBeVisible();
  });

  test("only the five training crops are offered, and nothing else can be submitted", async ({ page }) => {
    await page.goto("/irrigate");
    const options = await page.locator("#irr-crop option").allTextContents();
    expect(options.filter((o) => o !== "Choose…").sort()).toEqual(["Carrot", "Chilli", "Potato", "Tomato", "Wheat"]);
  });

  test("a moisture value outside 1-100 is rejected before any request", async ({ page }) => {
    let requested = false;
    await page.route("**/api/v1/predictions/irrigation", (route) => {
      requested = true;
      return route.continue();
    });
    await page.goto("/irrigate");
    await fillIrrigation(page, { ...dryWheat, moisture_pct: "320" });
    await page.getByRole("button", { name: /Check irrigation/i }).click();
    await expect(page.locator("#irr-moisture_pct")).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator("#irr-moisture_pct")).toBeFocused();
    expect(requested).toBe(false);
  });

  test("an empty form reports every missing field", async ({ page }) => {
    await page.goto("/irrigate");
    await page.getByRole("button", { name: /Check irrigation/i }).click();
    await expect(page.getByText("Enter a value.")).toHaveCount(6);
    await expect(page.locator("#irr-crop")).toBeFocused();
  });

  test("a missing model artefact is reported as unavailable, not as a guess", async ({ page }) => {
    await page.route("**/api/v1/predictions/irrigation", (route) =>
      route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "model_unavailable" }) }),
    );
    await page.goto("/irrigate");
    await fillIrrigation(page);
    await page.getByRole("button", { name: /Check irrigation/i }).click();
    await expect(page.getByTestId("irrigation-status")).toContainText(/not available on this deployment/i);
  });

  test("the whole form can be completed by keyboard", async ({ page }) => {
    await page.goto("/irrigate");
    await page.locator("#irr-crop").focus();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Tab");
    await page.keyboard.press("ArrowDown");
    for (const value of ["2", "26", "77"]) {
      await page.keyboard.press("Tab");
      await page.keyboard.type(value);
    }
    await page.getByRole("button", { name: /Check irrigation/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("complementary", { name: /Irrigation decision result/i }).getByRole("heading").first()).toBeVisible();
  });
});

test.describe("watering guidance controls", () => {
  test("changing soil texture changes the watering interval", async ({ page }) => {
    await page.goto("/irrigate");
    await fillIrrigation(page, { ...dryWheat, crop: "Tomato", soil_type: "Loam Soil", growth_stage: "Flowering", moisture_pct: "40" });
    await page.getByRole("button", { name: /Check irrigation/i }).click();
    const guidance = page.getByRole("region", { name: /Watering guidance for Tomato/i });
    await expect(guidance).toBeVisible();

    const frequency = () => guidance.locator("dd").first().textContent();
    await guidance.getByLabel("Soil texture").selectOption("sandy");
    const sandy = await frequency();
    await guidance.getByLabel("Soil texture").selectOption("clay");
    const clay = await frequency();
    expect(sandy).not.toEqual(clay);
  });
});
