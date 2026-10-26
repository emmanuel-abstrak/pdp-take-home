import { expect, test } from "@playwright/test";
import { LEGACY_DOWN_PORT, PORT } from "../playwright.config";

const MIGRATED = "/articles/a-field-guide-to-legacy-data";
const LEGACY = "/articles/caching-without-tears";

test("lists every legacy article with normalized fields", async ({ page }) => {
  await page.goto("/articles");
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(5);

  const guide = page.getByRole("listitem").filter({ has: page.getByRole("heading", { name: "A field guide to legacy data" }) });
  await expect(guide).toContainText("Pieter van der Merwe · 15 February 2024");
  await expect(guide).toContainText("Featured");
});

test("a migrated slug is rendered by Next.js", async ({ page }) => {
  const res = await page.goto(MIGRATED);
  expect(res?.headers()["x-served-by"]).toBe("next");
  await expect(page).toHaveTitle("A field guide to legacy data · Acme News");
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute("href", new RegExp(`${MIGRATED}$`));
  await expect(page.getByText("Served by legacy PHP")).toHaveCount(0);
});

test("a non-migrated slug is served by legacy under the same URL, query intact", async ({ page }) => {
  const res = await page.goto(`${LEGACY}?utm_source=newsletter&ref=e2e`);
  expect(res?.status()).toBe(200);
  expect(res?.request().redirectedFrom()).toBeNull();
  expect(res?.headers()["x-served-by"]).toBe("legacy-php");
  expect(page.url()).toBe(`http://127.0.0.1:${PORT}${LEGACY}?utm_source=newsletter&ref=e2e`);
  await expect(page.locator("footer")).toContainText("query: utm_source=newsletter&ref=e2e");
  await expect(page.locator("footer")).toContainText(`host: 127.0.0.1:${PORT}`);
  expect(Object.values(res!.headers()).join(" ")).not.toMatch(/:8000|PHP\//);
});

test("routes Next.js doesn't have yet fall through to legacy", async ({ page }) => {
  await page.goto("/about?from=e2e");
  await expect(page.getByRole("heading", { name: "About Acme News" })).toBeVisible();
  await expect(page.locator("footer")).toContainText("query: from=e2e");
});

test("unknown slugs get legacy's 404; malformed slugs and the internal route are never forwarded", async ({ request }) => {
  const unknown = await request.get("/articles/does-not-exist");
  expect(unknown.status()).toBe(404);
  expect(unknown.headers()["x-served-by"]).toBe("legacy-php");

  for (const path of ["/articles/Not_A_Slug", `/legacy${LEGACY}`]) {
    const blocked = await request.get(path);
    expect(blocked.status()).toBe(404);
    expect(blocked.headers()["x-served-by"]).toBeUndefined();
  }
});

test("list links navigate client-side into Next.js and by full page load into legacy", async ({ page }) => {
  await page.goto("/articles");
  await page.evaluate(() => Object.assign(window, { __sameDocument: true }));

  await page.getByRole("link", { name: "A field guide to legacy data" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("A field guide to legacy data");
  expect(await page.evaluate(() => "__sameDocument" in window)).toBe(true);

  await page.goBack();
  await page.getByRole("link", { name: "Caching without tears" }).click();
  await expect(page.getByText("Served by legacy PHP")).toBeVisible();
  expect(page.url()).toBe(`http://127.0.0.1:${PORT}${LEGACY}`);
});

test.describe("when legacy is down", () => {
  test.use({ baseURL: `http://127.0.0.1:${LEGACY_DOWN_PORT}` });

  test("cached pages keep serving", async ({ page }) => {
    await page.goto(MIGRATED);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("A field guide to legacy data");
  });

  test("uncached pages show a friendly error with retry", async ({ page }) => {
    await page.goto(LEGACY);
    await expect(page.getByRole("heading", { name: "Articles are temporarily unavailable" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  });

  test("unmigrated pages show a friendly outage page instead of a raw error", async ({ page }) => {
    for (const path of ["/articles/the-strangler-fig-pattern", "/about"]) {
      const res = await page.goto(path);
      expect(res?.status()).toBe(503);
      expect(res?.headers()["retry-after"]).toBe("30");
      await expect(page.getByRole("heading", { name: "This page is temporarily unavailable" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Try again" })).toBeVisible();
    }
  });
});
