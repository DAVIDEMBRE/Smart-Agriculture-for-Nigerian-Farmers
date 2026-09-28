import { expect, test } from "@playwright/test";
import { stubWeather, switchToPidgin } from "./helpers";

test.describe("site chrome", () => {
  test("the homepage offers the prediction and research routes", async ({ page }) => {
    await stubWeather(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Better crop decisions");
    await page.getByRole("link", { name: /Get a crop recommendation/i }).first().click();
    await expect(page).toHaveURL(/\/predict$/);
  });

  test("switching to Pidgin translates the homepage and updates the document language", async ({ page }) => {
    await stubWeather(page);
    await page.goto("/");
    await switchToPidgin(page);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Better crop choice");
    await expect(page.locator("html")).toHaveAttribute("lang", "pcm-NG");
  });

  test("the theme toggle switches modes and persists across a reload", async ({ page }) => {
    await stubWeather(page);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

    await page.getByRole("button", { name: /Use dark theme/i }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");

    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });

  test("the research page renders the full leaderboard and the irrigation gate", async ({ page }) => {
    await page.goto("/research");
    await expect(page.getByRole("table", { name: /eighteen evaluated configurations/i }).or(page.locator("table.results-table"))).toBeVisible();
    await expect(page.locator("table.results-table tbody tr")).toHaveCount(18);
    await expect(page.locator(".gate-list-resolved > div")).toHaveCount(5);
  });

  test("the research figure opens in a dialog and closes again", async ({ page }) => {
    await page.goto("/research");
    await page.getByRole("button", { name: /Expand this figure/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  });

  test("the live service status reports both production models", async ({ page }) => {
    await page.goto("/research");
    await expect(page.getByText("Production model", { exact: true })).toHaveCount(2);
    await expect(page.getByText("crop-recommendation-catboost")).toBeVisible();
    await expect(page.getByText("irrigation-decision-xgboost")).toBeVisible();
    await expect(page.getByText(/mapped_to_0/)).toBeVisible();
  });

  test("the research page discloses the irrigation scope and the guidance module", async ({ page }) => {
    await page.goto("/research");
    await expect(page.getByRole("heading", { name: /irrigate-now classifier/i })).toBeVisible();
    await expect(page.getByRole("list", { name: /Crops the model knows/i }).getByRole("listitem")).toHaveCount(5);
    await expect(page.getByText(/cannot chain/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /authored rules, not a third model/i })).toBeVisible();
  });

  test("an unknown route renders the not-found page", async ({ page }) => {
    await page.goto("/no-such-page");
    await expect(page.getByRole("heading", { name: /outside the map/i })).toBeVisible();
  });
});

test.describe("keyboard-only use", () => {
  test("the skip link is the first stop and jumps to the main region", async ({ page }) => {
    await stubWeather(page);
    await page.goto("/");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: /Skip to main content/i })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#main$/);
  });

  test("the whole prediction form can be completed without a mouse", async ({ page }) => {
    await page.goto("/predict");
    await page.locator("#nitrogen").focus();

    const values = ["90", "42", "43", "20.9", "82", "6.5", "202.9"];
    for (const [index, value] of values.entries()) {
      await page.keyboard.type(value);
      if (index < values.length - 1) await page.keyboard.press("Tab");
    }

    await page.getByRole("button", { name: /Run crop recommendation/i }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "rice", exact: true })).toBeVisible();
  });

  test("every interactive control shows a visible focus ring", async ({ page }) => {
    await page.goto("/predict");
    await page.locator("#nitrogen").focus();
    const outline = await page.locator("#nitrogen").evaluate((node) => getComputedStyle(node).boxShadow);
    expect(outline).not.toBe("none");
  });
});

test.describe("mobile layout", () => {
  test.skip(({ isMobile }) => !isMobile, "covers the mobile navigation drawer only");

  test("the navigation drawer opens, navigates and closes", async ({ page }) => {
    await stubWeather(page);
    await page.goto("/");

    const toggle = page.getByRole("button", { name: /Open navigation/i });
    await expect(toggle).toBeVisible();
    await toggle.click();

    await page.getByRole("link", { name: "Research", exact: true }).click();
    await expect(page).toHaveURL(/\/research$/);
    await expect(page.getByRole("button", { name: /Open navigation/i })).toBeVisible();
  });

  test("the page never scrolls horizontally", async ({ page }) => {
    await stubWeather(page);
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test("primary controls meet the 44px touch target", async ({ page }) => {
    await page.goto("/predict");
    const button = page.getByRole("button", { name: /Run crop recommendation/i });
    const box = await button.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
