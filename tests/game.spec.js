const {test, expect} = require("@playwright/test");
const {open, slot, menu} = require("./helpers");

test("starts on the menu and deals two tiles", async ({page}) => {
  await open(page);
  await expect(page.locator("#menu")).toHaveClass(/active/);
  await page.click("#play");
  await expect(page.locator("#game")).toHaveClass(/active/);
  await expect(page.locator("#tiles .tile")).toHaveCount(2);
  await expect(page.locator("#score")).toHaveText("0");
});

test("merging two tiles scores their sum", async ({page}) => {
  await open(page, {"game2048.games": slot({tiles: [[0, 0, 16], [0, 1, 16]]}),
                    "game2048.last": "classic:4"});
  await page.click("#play");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#score")).toHaveText("32");
  await expect(page.locator("#progressText")).toHaveText("32 / 2048");
});

test("undo restores the previous position", async ({page}) => {
  await open(page, {"game2048.games": slot({tiles: [[0, 0, 16], [0, 1, 16]]}),
                    "game2048.last": "classic:4"});
  await page.click("#play");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#score")).toHaveText("32");
  await page.click("#undo");
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#undo")).toBeDisabled();
});

test("a blocked move is refused instead of counted", async ({page}) => {
  await open(page, {"game2048.games": slot({tiles: [[0, 0, 2]]}), "game2048.last": "classic:4"});
  await page.click("#play");
  await page.keyboard.press("ArrowUp");            // the tile is already at the top-left
  await expect(page.locator("#score")).toHaveText("0");
  await expect(page.locator("#tiles .tile")).toHaveCount(1);
});

test("each mode and size keeps its own game", async ({page}) => {
  await open(page);
  await page.click("#openModes");
  await page.click('.chip[data-size="4"]');
  await page.click('.chip[data-mode="classic"]');
  await page.click("#startMode");
  for (const key of ["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"]) await page.keyboard.press(key);
  const classicScore = await page.locator("#score").textContent();

  await menu(page);
  await page.click("#openModes");
  await page.click('.chip[data-mode="daily"]');
  await page.click("#startMode");
  await expect(page.locator("#modeChip")).toContainText("DAILY");

  await menu(page);
  await page.click("#openModes");
  await page.click('.chip[data-mode="classic"]');
  await expect(page.locator("#startMode")).toHaveText("RESUME");
  await page.click("#startMode");
  await expect(page.locator("#score")).toHaveText(classicScore);
});

test("the daily challenge deals the same board twice", async ({page}) => {
  await open(page);
  const board = () => page.$$eval("#tiles .tile",
    nodes => nodes.map(n => n.textContent + "@" + n.style.transform).sort().join("|"));

  await page.click("#openModes");
  await page.click('.chip[data-mode="daily"]');
  await page.click("#startMode");
  const first = await board();

  await page.reload();
  await page.click("#openModes");
  await page.click('.chip[data-mode="daily"]');
  await page.click("#startMode");
  expect(await board()).toBe(first);
});

test("the menu offers to continue an unfinished game", async ({page}) => {
  await open(page, {"game2048.games": slot({tiles: [[0, 0, 8], [3, 3, 4]], score: 120, moves: 7}),
                    "game2048.last": "classic:4"});
  await expect(page.locator("#play")).toHaveText("CONTINUE");
  await expect(page.locator("#menuNote")).toContainText("IN PROGRESS 120");
  await page.click("#play");
  await expect(page.locator("#score")).toHaveText("120");
});

test("a save from before per-mode slots is migrated", async ({page}) => {
  await open(page, {"game2048.state": {
    size: 5, mode: "classic", ended: false,
    snap: JSON.stringify({grid: Array.from({length: 5}, (_, r) =>
            Array.from({length: 5}, (_, c) => (r === 0 && c === 0 ? {id: 1, value: 8, r: 0, c: 0} : null))),
          score: 99, won: false, over: false, uid: 1, draws: 0, moves: 4, timeLeft: 180}),
    history: []}});
  await page.click("#play");
  await expect(page.locator("#score")).toHaveText("99");
  await expect(page.locator("#modeChip")).toContainText("5×5");
  expect(await page.evaluate(() => localStorage.getItem("game2048.state"))).toBeNull();
});
