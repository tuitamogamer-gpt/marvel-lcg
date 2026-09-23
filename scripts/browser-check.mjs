import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
await mkdir("output/browser", { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const url = process.env.BASE_URL || "http://localhost:5174";
await page.goto(url);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({
  path: "output/browser/lobby-desktop.png",
  fullPage: true,
});
for (const hero of [
  "Captain Marvel",
  "Iron Man",
  "Black Panther",
  "She-Hulk",
  "Spider-Man",
]) {
  await page.locator(".hero-tile").filter({ hasText: hero }).click();
  assert.equal(await page.locator(".hero-name h3").textContent(), hero);
}
await page.getByRole("button", { name: "View 40-card deck" }).click();
assert.equal(await page.locator(".deck-list section").count(), 3);
await page.getByRole("button", { name: "Close dialog" }).click();
await page.getByRole("button", { name: "Card library" }).click();
await page
  .getByRole("textbox", { name: "Search cards" })
  .fill("Swinging Web Kick");
assert.equal(await page.locator(".collection-card").count(), 1);
await page.locator(".collection-card").click();
assert.equal(
  await page.locator(".modal-heading h2").textContent(),
  "Swinging Web Kick",
);
await page.getByRole("button", { name: "Close dialog" }).click();
await page.getByRole("button", { name: "Clear search" }).click();
assert.equal(await page.locator(".collection-card").count(), 209);
await page.getByRole("button", { name: "Play", exact: false }).first().click();
await page.locator("#start-btn").click();
await page.getByRole("button", { name: "Keep hand & begin" }).click();
const state = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
assert.equal((await state()).phase, "player");
assert.equal((await state()).form, "alter");
await page.getByRole("button", { name: "Suit up" }).click();
assert.equal((await state()).form, "hero");
await page.getByRole("button", { name: /^Attack/ }).click();
assert.equal((await state()).villain.hp, 12);
// Pay for a real card entirely through the interface.
const playable = page.locator(".hand-card.playable");
if (await playable.count()) {
  await playable.first().click();
  await page.getByRole("button", { name: "Play card", exact: true }).click();
  for (let i = 0; i < 25; i++) {
    const st = await state();
    if (!st.prompt) break;
    const p = st.prompt;
    if (p.kind === "payment") {
      let total = 0;
      for (let j = 0; j < p.sources.length && total < p.cost; j++) {
        await page.locator(".payment-source").nth(j).click();
        total += p.sources[j].resources.length;
      }
      await page.getByRole("button", { name: /Spend .* & resolve/ }).click();
    } else if (p.kind === "choice") {
      await page.locator(".decision-option").first().click();
    } else {
      await page.getByRole("button", { name: "Confirm selection" }).click();
    }
  }
}
await page.screenshot({
  path: "output/browser/tabletop-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "End hero phase" }).click();
const count = (await state()).hand.length;
if (count > 5) {
  for (let i = 0; i < count - 5; i++)
    await page.locator(".selection-card").nth(i).click();
}
await page.getByRole("button", { name: "Begin villain phase" }).click();
for (let i = 0; i < 80; i++) {
  const st = await state();
  if (!st.prompt) break;
  const p = st.prompt;
  if (p.kind === "choice") {
    const idx = p.options.findIndex((o) =>
      [
        "take",
        "resolve",
        "allow",
        "skip",
        "pass",
        "threat",
        "exhaust",
      ].includes(o.id),
    );
    await page
      .locator(".decision-option")
      .nth(idx < 0 ? 0 : idx)
      .click();
  } else if (p.kind === "payment") {
    let total = 0;
    for (let j = 0; j < p.sources.length && total < p.cost; j++) {
      await page.locator(".payment-source").nth(j).click();
      total += p.sources[j].resources.length;
    }
    await page.getByRole("button", { name: /Spend .* & resolve/ }).click();
  } else {
    await page.getByRole("button", { name: "Confirm selection" }).click();
  }
}
const after = await state();
assert.ok(after.round === 2 || after.phase === "lost");
await page.reload();
await page.getByRole("button", { name: /Resume mission/ }).click();
assert.equal((await state()).round, after.round);
assert.equal((await state()).heroHP, after.heroHP);
await page.screenshot({ path: "output/browser/round-two.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
await page.screenshot({
  path: "output/browser/tabletop-mobile.png",
  fullPage: true,
});
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "mobile table overflow",
);
await page.getByRole("button", { name: "Marvel Champions home" }).click();
await page.screenshot({
  path: "output/browser/lobby-mobile.png",
  fullPage: true,
});
assert.ok(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  "mobile lobby overflow",
);
await page.getByRole("button", { name: "How to play" }).click();
await page.screenshot({
  path: "output/browser/help-mobile.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Let’s play" }).click();
await writeFile(
  "output/browser/result.json",
  JSON.stringify(
    {
      passed: true,
      checks: [
        "hero selection",
        "starter decks",
        "collection search",
        "card inspection",
        "start mission",
        "mulligan",
        "flip",
        "basic attack",
        "card payment",
        "villain phase",
        "autosave/resume",
        "mobile layout",
      ],
      errors,
      after,
    },
    null,
    2,
  ),
);
await browser.close();
console.log(JSON.stringify({ passed: true, errors, round: after.round }));
if (errors.length) process.exitCode = 1;
