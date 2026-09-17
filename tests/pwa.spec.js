const {test, expect} = require("@playwright/test");
const {open} = require("./helpers");

test("the service worker caches the build and the game still runs offline", async ({page, context}) => {
  await open(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {timeout: 20000});

  const caches = await page.evaluate(() => window.caches.keys());
  expect(caches.some(name => name.startsWith("game2048-"))).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#menu")).toHaveClass(/active/);
  await page.click("#play");
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await context.setOffline(false);
});

test("the page is fetched network-first, so a new build is picked up", async ({page}) => {
  await open(page);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, {timeout: 20000});

  // ask the worker for the page: a network-first handler must not answer from the cache alone
  const served = await page.evaluate(async () => {
    const res = await fetch("index.html", {cache: "no-store"});
    return {ok: res.ok, fromCache: res.headers.get("x-from-cache")};
  });
  expect(served.ok).toBe(true);
  expect(served.fromCache).toBeNull();
});

test("the board is announced for screen readers", async ({page}) => {
  await open(page);
  await expect(page.locator("#board")).toHaveAttribute("role", "application");
  await page.click("#play");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#a11yStatus")).toContainText("Score");
  await expect(page.locator("#a11yStatus")).toContainText("free squares");
});
