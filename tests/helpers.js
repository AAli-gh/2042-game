/** Shared fixtures: a clean profile, and hand-built saves for the paths that are slow to reach by playing. */

const FRESH_PREFS = {tutorialDone: true, sound: false, ambient: false, anim: true, theme: "teal"};

/**
 * Seed a known profile — no tutorial, no audio — plus any saved state the test needs.
 * Seeding happens on the first load only, so a test can write its own save and reload
 * without this wiping it again.
 */
async function freshProfile(page, extra = {}) {
  await page.addInitScript(state => {
    if (sessionStorage.getItem("__seeded")) return;
    sessionStorage.setItem("__seeded", "1");
    localStorage.clear();
    localStorage.setItem("game2048.prefs", JSON.stringify(state.prefs));
    for (const [key, value] of Object.entries(state.extra)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }, {prefs: FRESH_PREFS, extra});
}

/** A 4x4 snapshot, tiles given as [row, col, value]. */
function snapshot(tiles, {score = 0, moves = 0, level = 0, size = 4} = {}) {
  const grid = Array.from({length: size}, () => Array.from({length: size}, () => null));
  let id = 0;
  for (const [r, c, value] of tiles) grid[r][c] = {id: ++id, value, r, c};
  return JSON.stringify({grid, score, won: false, over: false, uid: id,
                         draws: 0, moves, timeLeft: 180, level, levelResult: null});
}

/** A saved game in the slot the app would use for that mode and size. */
function slot({mode = "classic", size = 4, level = 0, tiles, score = 0, moves = 0, ended = false}) {
  const key = mode === "level" ? "level:" + level : mode + ":" + size;
  return {[key]: {size, mode, ended, day: 0, score, moves,
                  snap: snapshot(tiles, {score, moves, level, size}), history: []}};
}

const menu = page => page.evaluate(() => { while (window.__onBack()) {} });

/**
 * What the board is telling the player about the current level: size, goal, budget.
 * Read from the UI rather than hardcoded, so regenerating the level table never
 * breaks these tests.
 */
async function levelFacts(page) {
  const chip = await page.locator("#modeChip").textContent();
  const progress = await page.locator("#progressText").textContent();
  return {
    id: +chip.match(/LEVEL (\d+)/)[1],
    size: +chip.match(/(\d+)×/)[1],
    goal: +progress.split("/")[1].trim(),
    kind: progress.trim().startsWith("TILE") ? "tile" : "score",
    budget: +(await page.locator("#best").textContent()),
    timed: (await page.locator("#bestLabel").textContent()) === "TIME"
  };
}

/** Drop a hand-built save into a level's slot and reopen the game on it. */
async function seedLevel(page, {level, size, tiles, moves = 0, score = 0}) {
  await reseed(page, {"game2048.games": slot({mode: "level", level, size, tiles, moves, score}),
                      "game2048.last": "level:" + level});
  await page.click("#play");
}

/** Seed the profile and open the game. Every test starts here. */
async function open(page, extra = {}) {
  await freshProfile(page, extra);
  await page.goto("/index.html");
}

/**
 * Replace stored state and reload onto it.
 *
 * The write has to happen in an init script rather than in the live page: the game saves
 * itself when the page is hidden, so anything written before a reload is overwritten by
 * the outgoing page on its way out.
 */
let reseedCount = 0;
async function reseed(page, entries) {
  const id = "__reseed_" + (++reseedCount);
  await page.addInitScript(state => {
    if (sessionStorage.getItem(state.id)) return;
    sessionStorage.setItem(state.id, "1");
    for (const [key, value] of Object.entries(state.entries)) {
      localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    }
  }, {id, entries});
  await page.reload();
}

module.exports = {freshProfile, open, reseed, snapshot, slot, menu, levelFacts, seedLevel};
