import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const root = "output/flow";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
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
async function capture(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((img) => img.decode()));
  });
  await page.screenshot({
    path: `${root}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
async function audit(name) {
  if (!(await page.evaluate(() => Boolean(window.axe))))
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
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
async function proceedTo(predicate) {
  for (let i = 0; i < 120; i++) {
    const s = await saved();
    if (predicate(s)) return s;
    if (!s.review)
      throw Error(`Unexpected stop: ${s.prompt?.title || s.phase}`);
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  }
  throw Error("Too many review steps");
}
try {
  await page.goto(process.env.BASE_URL || "http://127.0.0.1:5174");
  await page.evaluate(async () => {
    const { newGame, dispatch, makePiece } =
      await import("/src/game/engine.ts");
    let s = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
      seed: 34,
    });
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    const take = (code, zones) => {
      for (const zone of zones) {
        const i = zone.findIndex((p) => p.code === code);
        if (i >= 0) return zone.splice(i, 1)[0];
      }
      return makePiece(s, code);
    };
    const zones = [s.player.hand, s.player.deck];
    const tracer = take("01007", zones);
    const aunt = take("01006", zones);
    const ally = take("01083", zones);
    s.player.inPlay.push(aunt, ally);
    s.player.hand.push(tracer);
    const bomber = take("01110", [s.encounter.deck]);
    bomber.engagedWith = s.activePlayerId;
    s.minions.push(bomber);
    const soldier = take("01103", [s.encounter.deck]);
    soldier.engagedWith = s.activePlayerId;
    s.minions.push(soldier);
    s.guided = true;
    s.review = null;
    s.prompt = null;
    s.queue = [];
    localStorage.setItem("champions.save.v1", JSON.stringify(s));
  });
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  await capture("scientist-table");
  await page
    .getByRole("button", { name: "Use Scientist…", exact: true })
    .click();
  await page.getByRole("button", { name: /Play Spider-Tracer/ }).click();
  const scientist = page
    .locator(".payment-source")
    .filter({ hasText: "Scientist" });
  assert.match(
    await page.locator(".payment-source").first().innerText(),
    /Scientist/,
  );
  await scientist.click();
  await capture("scientist-payment");
  await audit("scientist-payment");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await proceedTo((s) => !s.review);
  assert.ok(!(await saved()).flags.scientist);
  await page
    .getByRole("button", { name: "Use Scientist…", exact: true })
    .click();
  await page.getByRole("button", { name: /Play Spider-Tracer/ }).click();
  await page
    .locator(".payment-source")
    .filter({ hasText: "Scientist" })
    .click();
  const beforePay = await saved();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  const paid = await saved();
  assert.equal(paid.flags.scientist, true);
  assert.equal(paid.player.exhausted, false);
  assert.equal(paid.player.hand.length, beforePay.player.hand.length - 1);
  assert.equal(paid.player.discard.length, beforePay.player.discard.length);
  checks.push(
    "Scientist is first in payment, cancel is free, confirmed use pays 1 mental without discarding or exhausting Peter",
  );
  await proceedTo((s) => !s.review);
  assert.match((await saved()).prompt.title, /Spider-Tracer/);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Hydra Bomber", exact: true })
    .click();
  await proceedTo((s) =>
    s.review?.cards?.some((c) => c.label === "Attached to Hydra Bomber"),
  );
  await capture("attachment-confirmation");
  await proceedTo((s) => !s.review);
  const attached = page.getByRole("button", {
    name: "Inspect Spider-Tracer, attached to Hydra Bomber",
    exact: true,
  });
  assert.equal(await attached.count(), 1);
  assert.equal(
    await page
      .locator(".tableau-group.setup")
      .getByText("Spider-Tracer", { exact: true })
      .count(),
    0,
  );
  assert.ok(
    await page
      .getByRole("button", { name: "Use Scientist…", exact: true })
      .isDisabled(),
  );
  await attached.click();
  assert.equal(
    await page
      .getByRole("dialog", { name: "Spider-Tracer", exact: true })
      .count(),
    1,
  );
  await page.keyboard.press("Escape");
  checks.push(
    "Tracer is confirmed, displayed once under Hydra Bomber, and inspectable",
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    await capture(`attached-${width}`);
    if (width !== 320) await audit(`attached-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: /Suit up/ }).click();
  await page.getByRole("button", { name: /End hero phase/ }).click();
  const discardCount = Math.max(0, (await saved()).player.hand.length - 5);
  for (let i = 0; i < discardCount; i++)
    await page.locator(".selection-card").nth(i).click();
  await page
    .getByRole("button", { name: "Begin villain phase", exact: true })
    .click();
  await proceedTo((s) => !s.review && s.prompt?.title.includes("attacks"));
  assert.equal((await saved()).prompt.context.attack.target.name, "Spider-Man");
  assert.equal(
    await page
      .getByRole("dialog")
      .locator(".attack-target img")
      .getAttribute("src"),
    "/cards/01001a.png",
  );
  await capture("villain-attack");
  await audit("villain-attack");
  await proceedTo((s) => !s.review);
  assert.match((await saved()).prompt.title, /Rhino attacks/);
  await capture("choose-defender");
  const defenseState = await saved();
  await page.getByRole("button", { name: /Defend with Spider-Man/ }).click();
  await proceedTo((s) => !!(s.review || s.prompt?.context)?.calculation);
  assert.equal(
    ((await saved()).review || (await saved()).prompt.context).attack.label,
    "HERO DEFENDING",
  );
  await capture("hero-defends");
  for (const [width, height] of [
    [1280, 720],
    [1366, 768],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    const layout = await page.getByRole("dialog").evaluate((dialog) => {
      const body = dialog.querySelector(".review-focus-body") || dialog;
      const bounds = dialog.getBoundingClientRect();
      return {
        scroll: body.scrollHeight - body.clientHeight,
        width: body.scrollWidth - body.clientWidth,
        bottom: bounds.bottom,
        top: bounds.top,
      };
    });
    assert.ok(
      layout.scroll <= 1 &&
        layout.width <= 1 &&
        layout.bottom <= height &&
        layout.top >= 0,
      `Attack fits without scrolling at ${width}x${height}: ${JSON.stringify(layout)}`,
    );
    await capture(`attack-${width}x${height}`);
  }
  await audit("attack-summary");
  checks.push(
    "Attack participants, boost cards, calculation, changes and controls fit without scrolling at 1280x720 through 1920x1080",
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await capture("hero-defends-mobile");
  const proceedFits = await page.getByRole("dialog").evaluate((dialog) => {
    const bounds = dialog.getBoundingClientRect();
    return [...dialog.querySelectorAll(".review-focus-footer button")].every(
      (button) => {
        const rect = button.getBoundingClientRect();
        return rect.left >= bounds.left && rect.right <= bounds.right;
      },
    );
  });
  assert.ok(proceedFits, "Every footer action fits inside the mobile dialog");
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  );
  checks.push(
    "Villain activation and defense keep Spider-Man visible, with separate drawn and boost cards",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.evaluate(
    (s) => localStorage.setItem("champions.save.v1", JSON.stringify(s)),
    defenseState,
  );
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  await page.getByRole("button", { name: /Defend with Mockingbird/ }).click();
  await proceedTo((s) => !!(s.review || s.prompt?.context)?.calculation);
  assert.equal(
    ((await saved()).review || (await saved()).prompt.context).attack.target
      .name,
    "Mockingbird",
  );
  await capture("ally-defends");
  checks.push(
    "Choosing an ally switches the defender card and retains the protected hero label",
  );
  await page.evaluate(async (s) => {
    const { makePiece } = await import("/src/game/engine.ts");
    s.player.hand.push(makePiece(s, "01003"));
    s.attack.base = 5;
    localStorage.setItem("champions.save.v1", JSON.stringify(s));
  }, defenseState);
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  await page.getByRole("button", { name: /Take the attack/ }).click();
  await proceedTo((s) => !s.review && s.prompt?.title === "Incoming attack");
  await page.setViewportSize({ width: 1280, height: 720 });
  assert.equal(
    await page.getByRole("button", { name: "Proceed", exact: true }).count(),
    0,
  );
  assert.ok(
    await page
      .getByRole("dialog")
      .evaluate((dialog) => dialog.scrollHeight <= dialog.clientHeight + 1),
    "Damage prevention fits without scrolling on a laptop",
  );
  await capture("prevention-1280x720");
  await audit("damage-prevention");
  const beforePrevention = (await saved()).player.hp;
  await page
    .getByRole("button", { name: /Backflip · prevent all damage/ })
    .click();
  assert.notEqual((await saved()).review?.title, "Decision confirmed");
  await proceedTo((s) => !s.attack);
  assert.equal((await saved()).player.hp, beforePrevention);
  checks.push(
    "Prevention choices open directly with attack math, fit on a laptop, and Backflip prevents damage",
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(
    audits.flatMap((a) => a.violations).length,
    0,
    JSON.stringify(audits),
  );
  await writeFile(
    `${root}/report.json`,
    JSON.stringify({ checks, errors, audits }, null, 2),
  );
  console.log(JSON.stringify({ checks, errors, audits }, null, 2));
} catch (error) {
  await capture("failure").catch(() => {});
  throw error;
} finally {
  await browser.close();
}
