import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const root = "output/design";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1080 },
  reducedMotion: "reduce",
});
const browserErrors = [];
page.on("pageerror", (e) => browserErrors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") browserErrors.push(m.text());
});
const audits = [];
const layout = [];
const checks = [];
async function audit(name) {
  if (!(await page.evaluate(() => !!window.axe)))
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(async () =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  const violations = result.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    nodes: v.nodes.map((n) => ({
      target: n.target,
      summary: n.failureSummary,
    })),
  }));
  audits.push({
    name,
    violations,
    incomplete: result.incomplete.map((v) => v.id),
  });
}
async function capture(name, fullPage = true) {
  const dialog = (await page.getByRole("dialog").count()) > 0;
  if (fullPage && !dialog) await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `${root}/${name}.png`,
    fullPage: fullPage && !dialog,
  });
}
async function fit(name, width) {
  await page.setViewportSize({ width, height: 900 });
  const size = await page.evaluate(() => ({
    viewport: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  layout.push({ name, ...size });
  assert.ok(
    size.content <= size.viewport + 1,
    `${name}: ${size.content}px wider than ${size.viewport}px`,
  );
}
try {
  await page.goto(process.env.BASE_URL || "http://localhost:5174");
  await page.evaluate(() => document.fonts.ready);
  await audit("lobby-desktop");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await fit(`lobby-${width}`, width);
    await capture(`lobby-${width}`);
  }
  await page
    .getByRole("button", { name: "Card library", exact: false })
    .click();
  await audit("collection-desktop");
  await capture("collection-desktop");
  await fit("collection-mobile", 390);
  await audit("collection-mobile");
  await capture("collection-mobile");
  await page.getByRole("button", { name: "How to play", exact: false }).click();
  assert.equal(
    await page.evaluate(() => document.body.style.overflow),
    "hidden",
  );
  const last = page.getByRole("button", { name: "Let’s play" });
  await last.focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement.getAttribute("aria-label"),
    ),
    "Close dialog",
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.textContent.trim()),
    "Let’s play",
  );
  await audit("help-dialog-mobile");
  await capture("help-mobile");
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(() => document.body.style.overflow), "");
  checks.push("Modal focus trap, Escape and background scroll lock");
  await page.getByRole("button", { name: "Marvel Champions home" }).click();
  await page.locator("#start-btn").click();
  await audit("mulligan-mobile");
  await capture("mulligan-mobile");
  const chosen = page.locator(".selection-card").nth(1);
  await chosen.click();
  assert.equal(await chosen.getAttribute("aria-pressed"), "true");
  assert.equal(
    await chosen.evaluate((el) => document.activeElement === el),
    true,
  );
  await chosen.click();
  await page.getByRole("button", { name: "Keep hand & begin" }).click();
  await page.getByRole("button", { name: "Suit up" }).click();
  const state = () =>
    page.evaluate(() => JSON.parse(window.render_game_to_text()));
  const ready = (await state()).hand.filter((c) => c.playable).length;
  await page.getByRole("button", { name: /^Ready to play/ }).click();
  assert.equal(await page.locator(".hand-card").count(), ready);
  assert.equal(await page.locator(".hand-card:not(.playable)").count(), 0);
  await page.getByRole("button", { name: /^All cards/ }).click();
  assert.equal(
    await page.locator(".hand-card").count(),
    (await state()).hand.length,
  );
  checks.push("Hand filter preserves all cards and shows only legal plays");
  await audit("battlefield-mobile");
  for (const width of [320, 390, 768, 1024, 1440]) {
    await fit(`game-${width}`, width);
    await capture(`game-${width}`);
  }
  await audit("battlefield-desktop");
  if (await page.locator(".hand-card.playable").count()) {
    await page.locator(".hand-card.playable").first().click();
    await audit("card-inspection");
    await capture("inspection-desktop");
    await page.getByRole("button", { name: "Play card", exact: true }).click();
    if ((await state()).prompt?.kind === "payment") {
      const sources = page.locator(".payment-source");
      const source = sources.nth(Math.min(1, (await sources.count()) - 1));
      await source.click();
      assert.equal(
        await source.evaluate((el) => document.activeElement === el),
        true,
      );
      assert.equal(await source.getAttribute("aria-pressed"), "true");
      await audit("payment-desktop");
      await capture("payment-desktop");
      await fit("payment-mobile", 390);
      await audit("payment-mobile");
      await capture("payment-mobile");
      checks.push(
        "Payment selections keep keyboard focus and expose selection state",
      );
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
    }
  }
  assert.equal(browserErrors.length, 0, JSON.stringify(browserErrors));
  const result = {
    browserErrors,
    checks,
    layout,
    audits,
    violations: audits.reduce((n, a) => n + a.violations.length, 0),
  };
  await writeFile(`${root}/result.json`, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        checks,
        viewports: layout.length,
        audits: audits.length,
        violations: result.violations,
        browserErrors,
      },
      null,
      2,
    ),
  );
  if (result.violations) process.exitCode = 1;
} finally {
  await browser.close();
}
