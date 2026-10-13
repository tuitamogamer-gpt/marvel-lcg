import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const output = process.env.OUTPUT_DIR || "output/experience";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
page.on("pageerror", (error) => errors.push(error.message));
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function audit(name, target = page) {
  await target.evaluate(axe);
  const result = await target.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  const violations = result.violations.map(({ id, nodes }) => ({
    id,
    nodes: nodes.map(({ target, failureSummary }) => ({
      target,
      failureSummary,
    })),
  }));
  audits.push({ name, violations });
  assert.deepEqual(violations, [], `${name}: accessibility violations`);
}
async function fit(name, target = page) {
  const size = await target.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  layouts.push({ name, ...size });
  assert.ok(size.content <= size.width + 1, `${name}: horizontal overflow`);
}
async function capture(name, target = page, fullPage = false) {
  await target.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((image) => {
          const rect = image.getBoundingClientRect();
          return rect.width && rect.top < innerHeight && rect.bottom > 0;
        })
        .map((image) => image.decode().catch(() => {})),
    );
  });
  await target.screenshot({ path: `${output}/${name}.png`, fullPage });
}
try {
  await page.goto(url);
  await page.locator("#start-btn").waitFor();
  const total = await page.locator(".hero-tile").count();
  const search = page.getByRole("searchbox", {
    name: "Search playable heroes",
  });
  await search.fill("spdr");
  assert.equal(await page.locator(".hero-tile").count(), 1);
  await page.locator(".hero-tile").click();
  assert.match(await page.locator(".hero-details h3").innerText(), /SP\/\/dr/i);
  await search.fill("peter spider man");
  assert.equal(await page.locator(".hero-tile").count(), 1);
  await search.fill("zzzz no match");
  assert.equal(await page.locator(".hero-tile").count(), 0);
  assert.match(
    await page.locator(".hero-picker-footer").innerText(),
    /SP\/\/dr/i,
  );
  await page
    .getByRole("button", { name: "Show all heroes", exact: true })
    .click();
  assert.equal(
    await search.evaluate((node) => document.activeElement === node),
    true,
  );
  assert.equal(await page.locator(".hero-tile").count(), total);
  await page.getByRole("button", { name: "Core set", exact: true }).click();
  assert.equal(await page.locator(".hero-tile").count(), 5);
  await page
    .getByRole("button", { name: "Easy to learn", exact: true })
    .click();
  assert.ok((await page.locator(".hero-tile").count()) < total);
  await page.getByRole("button", { name: "All heroes", exact: true }).click();
  const region = page.getByRole("region", {
    name: "Playable heroes",
    exact: true,
  });
  await region.focus();
  await page.keyboard.press("End");
  await page.waitForFunction(
    () => document.querySelector(".hero-roster-window").scrollTop > 0,
  );
  checks.push(
    "Search accepts punctuation-free names and reordered terms; empty results preserve selection; filters and keyboard scrolling work.",
  );

  await page.getByRole("button", { name: "2 heroes", exact: true }).click();
  await page.getByRole("button", { name: /Configure hero 2:/ }).click();
  await search.fill("spdr");
  assert.equal(await page.locator(".hero-tile").isDisabled(), true);
  await page.getByRole("button", { name: "1 hero", exact: true }).click();
  await search.fill("");
  checks.push(
    "Already assigned heroes remain disabled in filtered multiplayer rosters.",
  );

  for (const width of [1440, 1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await fit(`lobby-${width}`);
    await audit(`lobby-${width}`);
    await page
      .locator("#hero-setup")
      .evaluate((node) => window.scrollTo(0, node.offsetTop - 20));
    await capture(`roster-${width}`);
    const overlaps = await page
      .locator(".mission-panel .setting-line")
      .evaluateAll((nodes) => {
        const boxes = nodes.map((node) => node.getBoundingClientRect());
        return boxes.some((a, index) =>
          boxes
            .slice(index + 1)
            .some(
              (b) =>
                Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1 &&
                Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1,
            ),
        );
      });
    assert.equal(overlaps, false, `mission controls overlap at ${width}px`);
  }
  checks.push(
    "Roster and mission controls fit five widths, including tablet and narrow mobile, without overlapping controls.",
  );

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: /All heroes & starter decks/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "All heroes & starter decks",
    exact: true,
  });
  await dialog
    .getByRole("combobox", { name: "Filter hero availability" })
    .selectOption("ready");
  assert.equal(
    await dialog.getByLabel("Catalog preview", { exact: true }).count(),
    0,
  );
  await dialog
    .getByRole("textbox", { name: "Search heroes and products" })
    .fill("spdr");
  assert.equal(await dialog.locator(".catalog-hero-row").count(), 1);
  await dialog
    .getByRole("combobox", { name: "Filter hero availability" })
    .selectOption("catalog");
  assert.equal(await dialog.locator(".catalog-hero-row").count(), 0);
  await dialog
    .getByRole("textbox", { name: "Search heroes and products" })
    .fill("");
  await audit("hero-catalog-filter");
  await capture("hero-catalog-filter");
  await page.keyboard.press("Escape");
  checks.push("Hero catalog availability combines correctly with text search.");

  await page.getByRole("button", { name: /Card library/ }).click();
  await page.getByRole("textbox", { name: "Search cards" }).fill("#01005");
  assert.equal(await page.locator(".collection-card").count(), 1);
  assert.match(
    await page.locator(".collection-card").innerText(),
    /Swinging Web Kick/,
  );
  await page
    .getByRole("combobox", { name: "Filter rules support" })
    .selectOption("catalog");
  await page.getByRole("heading", { name: "No cards found" }).waitFor();
  await page.getByRole("textbox", { name: "Search cards" }).fill("");
  assert.equal(await page.locator(".collection-support.supported").count(), 0);
  await page
    .getByRole("combobox", { name: "Filter rules support" })
    .selectOption("supported");
  assert.equal(
    await page.locator(".collection-support.supported").count(),
    await page.locator(".collection-card").count(),
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await fit(`library-${width}`);
    await audit(`library-${width}`);
    await capture(`library-${width}`);
  }
  checks.push(
    "Card-code search and rules-support filters return the correct cards and fit desktop/mobile layouts.",
  );

  // Finish an actual UI-created opening state as a fixture, then exercise the real history and replay controls.
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: /^Play/ }).click();
  await search.fill("Jessica Drew");
  await page.locator(".hero-tile").click();
  await page
    .locator(".aspect-option")
    .filter({ hasText: "Protection" })
    .click();
  await page
    .getByRole("combobox", { name: "Spider-Woman second aspect" })
    .selectOption("leadership");
  await page.locator(".module-label select").selectOption("zzzax");
  await page
    .locator(".setting-line")
    .filter({ hasText: "Difficulty" })
    .getByRole("button", { name: "Expert", exact: true })
    .click();
  await page
    .locator(".heroic-line")
    .getByRole("button", { name: "2", exact: true })
    .click();
  await page.locator("#mission-seed").fill("123456");
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  const opening = await saved();
  assert.ok(opening.players[0].deckCards.length >= 40);
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("champions.save.v1"));
    state.phase = "won";
    state.prompt = null;
    state.review = null;
    state.queue = [];
    localStorage.setItem("champions.save.v1", JSON.stringify(state));
  });
  await page.reload();
  await page
    .getByRole("region", { name: "Recent missions" })
    .getByRole("button", { name: "Replay", exact: true })
    .click();
  assert.equal(
    await page.locator(".module-label select").inputValue(),
    "zzzax",
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Spider-Woman second aspect" })
      .inputValue(),
    "leadership",
  );
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  const replay = await saved();
  for (const key of ["module", "difficulty", "heroic", "startSeed"])
    assert.deepEqual(replay[key], opening[key]);
  assert.deepEqual(replay.players[0].deckCards, opening.players[0].deckCards);
  assert.deepEqual(
    replay.players[0].deckAspects,
    opening.players[0].deckAspects,
  );
  assert.deepEqual(
    replay.players[0].player.hand,
    opening.players[0].player.hand,
  );
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    (await saved()).players[0].player.hand,
    opening.players[0].player.hand,
  );
  checks.push(
    "Recent-mission Replay restores the exact two-aspect deck, Zzzax module, Expert/Heroic settings, seed and opening hand; reload preserves it.",
  );

  const blocked = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  blocked.on("pageerror", (error) => errors.push(error.message));
  await blocked.addInitScript(() => {
    const get = Storage.prototype.getItem,
      set = Storage.prototype.setItem;
    Storage.prototype.getItem = () => {
      throw new DOMException("Blocked", "SecurityError");
    };
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
    window.restoreStorage = () => {
      Storage.prototype.getItem = get;
      Storage.prototype.setItem = set;
    };
  });
  await blocked.goto(url);
  await blocked
    .getByRole("button", { name: "Enable sound", exact: true })
    .click();
  await blocked
    .getByRole("button", { name: "Mute sound", exact: true })
    .waitFor();
  await blocked.locator("#start-btn").click();
  await blocked
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  const proceed = blocked.getByRole("button", { name: "Proceed", exact: true });
  for (let i = 0; i < 20 && (await proceed.count()); i++) await proceed.click();
  await blocked.locator(".storage-notice").waitFor();
  await fit("blocked-storage", blocked);
  await audit("blocked-storage", blocked);
  await capture("blocked-storage", blocked);
  await blocked.evaluate(() => window.restoreStorage());
  await blocked
    .getByRole("button", { name: "Retry save", exact: true })
    .click();
  await blocked.locator(".storage-notice").waitFor({ state: "detached" });
  assert.ok(
    await blocked.evaluate(
      () => JSON.parse(localStorage.getItem("champions.save.v1"))?.player,
    ),
  );
  checks.push(
    "Blocked storage does not crash startup or sound controls; the save warning is actionable and Retry save recovers the session.",
  );
  await blocked.close();
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, audits, layouts, errors }, null, 2),
  );
  await browser.close();
}
console.log(
  `Experience checks passed: ${checks.length} flows, ${audits.length} accessibility audits, ${layouts.length} layout checks.`,
);
