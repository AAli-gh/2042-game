const {test, expect} = require("@playwright/test");
const {open, reseed, levelFacts, seedLevel} = require("./helpers");

const cleared = (count, stars = 3) => {
  const out = {};
  for (let i = 1; i <= count; i++) out[i] = stars;
  return out;
};

test("the picker lists 100 levels in five chapters, with only the first unlocked", async ({page}) => {
  await open(page);
  await page.click("#openLevels");
  await expect(page.locator(".lv")).toHaveCount(100);
  await expect(page.locator(".chapter")).toHaveCount(5);
  await expect(page.locator(".lv:not(.locked)")).toHaveCount(1);
  await expect(page.locator("#levelsNote")).toContainText("★ 0 / 300");
});

test("clearing a level awards stars and unlocks the next one", async ({page}) => {
  await open(page);
  await page.click("#openLevels");
  await page.click('.lv[data-level="1"]');
  const level = await levelFacts(page);
  expect(level.kind).toBe("tile");

  // put the board one merge away from the goal
  await seedLevel(page, {level: 1, size: level.size, moves: 3,
                         tiles: [[0, 0, level.goal / 2], [0, 1, level.goal / 2]]});
  await expect(page.locator("#modeChip")).toContainText("LEVEL 1");
  await expect(page.locator("#bestLabel")).toHaveText("MOVES LEFT");

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#overlayMsg")).toHaveText("LEVEL 1 CLEAR");
  await expect(page.locator("#overlayStars i.on")).toHaveCount(3);
  await expect(page.locator("#nextLevel")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("game2048.levels")))).toEqual({1: 3});

  await page.click("#nextLevel");
  await expect(page.locator("#modeChip")).toContainText("LEVEL 2");
});

test("running out of budget fails the level and locks the board", async ({page}) => {
  await open(page);
  await page.click("#openLevels");
  await page.click('.lv[data-level="1"]');
  const level = await levelFacts(page);

  // one move left, and nowhere near the goal
  await seedLevel(page, {level: 1, size: level.size, moves: level.budget - 1, score: 40,
                         tiles: [[0, 0, 2], [0, 1, 4], [level.size - 1, level.size - 1, 8]]});
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#overlayMsg")).toHaveText("LEVEL FAILED");
  await expect(page.locator("#overlayStars i.on")).toHaveCount(0);
  await expect(page.locator("#tryAgain")).toHaveText("RETRY");

  const score = await page.locator("#score").textContent();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#score")).toHaveText(score);       // no further moves count

  await page.click("#tryAgain");
  await expect(page.locator("#best")).toHaveText(String(level.budget));   // a full budget again
  await expect(page.locator("#overlay")).not.toHaveClass(/show/);
});

test("trophies unlock at 10, 25, 50, 75 and 100 levels", async ({page}) => {
  await open(page);
  for (const [count, expected] of [[9, 0], [10, 1], [25, 2], [50, 3], [75, 4], [100, 5]]) {
    // the trophies already awarded are kept, so each step re-checks from a clean record
    await reseed(page, {"game2048.levels": cleared(count, 1), "game2048.stats": {badges: []}});
    await page.click("#statsBtn");
    await expect(page.locator(".trophy.won")).toHaveCount(expected);
    await page.click("#closeStats");
  }
});

test("three stars everywhere earns the star trophies too", async ({page}) => {
  await open(page, {"game2048.levels": cleared(100, 3)});
  await page.click("#statsBtn");
  await expect(page.locator(".trophy.won")).toHaveCount(7);
  await page.click("#closeStats");
  await expect(page.locator("#menuNote")).toContainText("PERFECTIONIST");
});

test("a no-undo level disables undo", async ({page}) => {
  await open(page, {"game2048.levels": cleared(21, 3)});
  await page.click("#openLevels");
  await page.click('.lv[data-level="22"]');            // the first level flagged noUndo
  await expect(page.locator("#modeChip")).toContainText("NO UNDO");
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#undo")).toBeDisabled();
});
