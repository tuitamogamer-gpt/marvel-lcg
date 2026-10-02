import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const root = process.env.OUTPUT_DIR || "output/onboarding";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1366, height: 768 },
  reducedMotion: "reduce",
});
const errors = [],
  checks = [],
  audits = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error") errors.push(e.text());
});
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
const coach = page.getByRole("region", { name: "First mission coach" });
async function capture(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((i) => i.getClientRects().length && i.loading !== "lazy")
        .map((i) => i.decode()),
    );
  });
  await page.screenshot({
    path: `${root}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
async function audit(name) {
  // Run diagnostics through Playwright so production CSP stays intact.
  await page.evaluate(
    await readFile(require.resolve("axe-core/axe.min.js"), "utf8"),
  );
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  audits.push({
    name,
    violations: result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  });
}
async function settle(choices = false) {
  for (let i = 0; i < 100; i++) {
    const s = await saved();
    if (s.review) {
      await page.getByRole("button", { name: "Proceed", exact: true }).click();
      continue;
    }
    if (!choices || !s.prompt) return s;
    if (s.prompt.kind === "payment") {
      await page
        .getByRole("button", { name: "Suggest resources", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Confirm payment", exact: true })
        .click();
    } else if (s.prompt.kind === "choice") {
      const preferred = s.prompt.options.findIndex((o) =>
        ["take", "allow", "pass", "resolve", "skip"].includes(o.id),
      );
      await page
        .locator(".decision-option")
        .nth(Math.max(0, preferred))
        .click();
    } else {
      for (let n = 0; n < (s.prompt.min || 0); n++)
        await page.locator(".decision-option").nth(n).click();
      await page
        .getByRole("button", { name: "Confirm selection", exact: true })
        .click();
    }
  }
  throw Error("Tutorial flow did not settle");
}
try {
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5174");
  await page.getByRole("button", { name: "Play your first mission" }).click();
  let s = await saved();
  assert.equal(s.heroId, "spider_man");
  assert.equal(s.villainId, "rhino");
  assert.equal(s.startSeed, 20260929);
  assert.equal(s.playerCount, 1);
  await page.getByRole("button", { name: "Keep hand & begin" }).click();
  await settle();
  assert.match(await coach.textContent(), /Become Spider-Man/);
  await page.getByRole("button", { name: /^Suit up/ }).click();
  await settle();
  assert.match(await coach.textContent(), /Your hand is your fuel/);
  await audit("tutorial-laptop");
  await capture("tutorial-laptop");
  const advisorBounds = await page
    .getByRole("button", { name: "Suggest a move", exact: true })
    .boundingBox();
  assert.ok(
    advisorBounds && advisorBounds.y + advisorBounds.height <= 768,
    "The advisor control must remain visible beside the coach",
  );
  await page.screenshot({ path: `${root}/tutorial-viewport.png` });
  checks.push(
    "Tutorial launches a fixed solo mission and tracks the actual opening hand and form change",
  );

  const playable = page.locator(".hand-play").first();
  await playable.click();
  s = await saved();
  if (s.prompt?.kind === "payment") {
    const before = JSON.stringify(s);
    await page
      .getByRole("button", { name: "Suggest resources", exact: true })
      .click();
    assert.equal(
      JSON.stringify(await saved()),
      before,
      "Suggesting resources must not spend them",
    );
    await page
      .getByRole("button", { name: "Confirm payment", exact: true })
      .click();
  }
  await settle(true);
  assert.ok((await saved()).stats.cardsPlayed > 0);
  checks.push(
    "Direct Play and suggested payment resolve a card through real controls",
  );
  if (await coach.getByRole("button", { name: "Skip this lesson" }).count())
    await coach.getByRole("button", { name: "Skip this lesson" }).click();
  const progress = await page.evaluate(() =>
    localStorage.getItem("champions.tutorial"),
  );
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.equal(
    await page.evaluate(() => localStorage.getItem("champions.tutorial")),
    progress,
  );
  assert.equal(await coach.count(), 1);
  checks.push("Tutorial progress is bound to this mission and survives reload");

  if (!(await saved()).player.exhausted) {
    await page.locator(".attack-action").click();
    if ((await saved()).prompt)
      await page
        .locator(".decision-option")
        .filter({ hasText: "Rhino" })
        .click();
    assert.ok((await saved()).review);
    await page.getByRole("button", { name: "View table", exact: true }).click();
    await page
      .getByRole("button", { name: "How to play", exact: false })
      .click();
    const before = JSON.stringify(await saved());
    await page.locator(".modal-intro").last().click();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Control+z");
    assert.equal(
      JSON.stringify(await saved()),
      before,
      "Help must block game shortcuts",
    );
    await page.keyboard.press("Escape");
    await page
      .getByRole("button", { name: "Open action details", exact: true })
      .click();
    const id = (await saved()).review.id;
    await page
      .getByRole("region", { name: "Action details and cards" })
      .click();
    await page.keyboard.press("Enter");
    assert.notEqual(
      (await saved()).review?.id,
      id,
      "Enter must acknowledge the current action review",
    );
    await settle();
    checks.push(
      "Help blocks Enter and Undo; Enter still advances the current review",
    );
  }

  await page.getByRole("button", { name: /^End hero phase/ }).click();
  await page
    .getByRole("button", { name: "Begin villain phase", exact: true })
    .click();
  await settle(true);
  s = await saved();
  assert.equal(s.round, 2);
  assert.equal(s.phase, "player");
  await capture("tutorial-round-two");
  checks.push(
    "The first mission reaches round two through defense and encounter decisions",
  );

  await page
    .getByRole("button", { name: "Card library", exact: false })
    .click();
  await page
    .getByRole("combobox", { name: "Filter card product", exact: true })
    .selectOption("core");
  await page
    .getByRole("textbox", { name: "Search cards" })
    .fill("Armored Guard");
  await page.locator(".collection-card").click();
  const guide = page.getByRole("region", { name: "Card keyword explanations" });
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent),
    "Guard",
    "Tab from Close must reach the keyword explanation",
  );
  await page.keyboard.press("Enter");
  assert.equal(await guide.locator("details[open]").count(), 1);
  assert.match(await guide.textContent(), /cannot attack the villain/);
  await audit("keyword-explanation");
  await capture("keyword-explanation");
  await page.setViewportSize({ width: 320, height: 740 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  await audit("keyword-320");
  await capture("keyword-320");
  await page.setViewportSize({ width: 1366, height: 768 });
  const before = JSON.stringify(await saved());
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  assert.equal(JSON.stringify(await saved()), before);
  await page.keyboard.press("Escape");
  checks.push(
    "Card keywords have keyboard-accessible explanations without changing gameplay",
  );
  await page.getByRole("button", { name: "Marvel Champions home" }).click();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  await page
    .getByRole("button", { name: "Dismiss first mission coach" })
    .click();
  assert.equal(await coach.count(), 0);
  assert.equal(
    await page.evaluate(() => localStorage.getItem("champions.tutorial")),
    null,
  );
  checks.push("Dismissing the coach preserves the mission");
  const result = { checks, audits, errors };
  await writeFile(`${root}/report.json`, JSON.stringify(result, null, 2));
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(
    audits.flatMap((a) => a.violations).length,
    0,
    JSON.stringify(audits),
  );
  console.log(
    JSON.stringify({ checks, audits: audits.length, errors }, null, 2),
  );
} catch (error) {
  await page.screenshot({ path: `${root}/failure.png`, fullPage: true });
  await writeFile(
    `${root}/failure-state.json`,
    JSON.stringify({ state: await saved(), checks, errors }, null, 2),
  );
  throw error;
} finally {
  await browser.close();
}
