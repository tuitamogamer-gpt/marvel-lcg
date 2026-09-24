import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const root = "output/comic";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  checks = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (e) => {
  if (e.type() === "error") errors.push(e.text());
});
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function shot(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images).map((i) => i.decode().catch(() => {})),
    );
  });
  await page.screenshot({ path: `${root}/${name}.png` });
}
async function preview(locator, name) {
  await page.mouse.move(0, 0);
  await locator.scrollIntoViewIfNeeded();
  await locator.hover();
  await page.getByRole("tooltip").waitFor();
  await page.waitForTimeout(180);
  const bounds = await page.getByRole("tooltip").boundingBox();
  const viewport = page.viewportSize();
  assert.ok(
    bounds.x >= 0 &&
      bounds.y >= 0 &&
      bounds.x + bounds.width <= viewport.width + 1 &&
      bounds.y + bounds.height <= viewport.height + 1,
    `${name}: preview clipped`,
  );
  await shot(name);
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("tooltip").count(), 0);
  checks.push(name);
}
async function fixture(kind = "hero") {
  await page.evaluate(async (kind) => {
    const { newGame, dispatch, makePiece } =
      await import("/src/game/engine.ts");
    let s = newGame({
      heroId: "spider_man",
      aspect: "justice",
      villainId: "rhino",
      seed: 34,
    });
    s = dispatch(s, { type: "MULLIGAN", ids: [] });
    s.player.form = "hero";
    s.guided = true;
    s.review = null;
    s.prompt = null;
    s.queue = [];
    if (kind === "blocked") s.villain.tough = true;
    if (kind === "payment") s.player.form = "alter";
    if (kind === "enemy") {
      s.attack = {
        attacker: "villain",
        targetPlayerId: s.activePlayerId,
        base: 3,
        boostCodes: [],
        boostEffects: [],
        defender: "hero",
        defense: 0,
        prevented: 0,
        damage: 0,
        overkill: false,
        isVillain: true,
      };
      s.prompt = {
        kind: "choice",
        title: "Incoming attack",
        text: "Resolve the attack.",
        options: [
          {
            id: "resolve",
            label: "Resolve attack",
            effects: [{ type: "finishAttack" }],
          },
        ],
      };
    }
    if (kind === "crowded") {
      const ally = makePiece(s, "01083");
      s.player.inPlay.push(ally);
      const minion = makePiece(s, "01110");
      minion.engagedWith = s.activePlayerId;
      s.minions.push(minion);
      const tracer = makePiece(s, "01007");
      tracer.attachedTo = minion.id;
      s.player.inPlay.push(tracer);
      s.sideSchemes.push(makePiece(s, "01109"));
      s.player.discard.push(makePiece(s, "01088"));
      s.encounter.discard.push(makePiece(s, "01104"));
    }
    localStorage.setItem("champions.save.v1", JSON.stringify(s));
  }, kind);
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
}
try {
  await page.goto(process.env.BASE_URL || "http://localhost:5174");
  assert.equal(await page.locator(".official-resources a").count(), 3);
  await page.locator(".official-resources").scrollIntoViewIfNeeded();
  await shot("official-links");
  await preview(page.locator(".hero-tile img").first(), "lobby-hover");
  await page.mouse.move(0, 0);
  await page.locator(".hero-tile").first().focus();
  await page.getByRole("tooltip").waitFor();
  await page.keyboard.press("Escape");
  checks.push("Keyboard focus enlarges cards and Escape dismisses the preview");
  await page.getByRole("button", { name: "Card library", exact: true }).click();
  await preview(
    page.locator(".collection-grid [data-card-preview]").first(),
    "collection-hover",
  );
  await page.getByRole("button", { name: "Marvel Champions home" }).click();
  await fixture("crowded");
  // Every rendered tabletop face and back, including attachments and discard tops.
  const cards = page.locator("main [data-card-preview]");
  const count = await cards.count();
  for (let i = 0; i < count; i++) {
    if (await cards.nth(i).isVisible())
      await preview(cards.nth(i), `table-card-${i}`);
  }
  const before = await saved();
  await preview(
    page.locator(".hand-card [data-card-preview]").first(),
    "hand-hover",
  );
  assert.deepEqual(await saved(), before);
  // A preview is hoverable, and moving onto it does not dismiss it.
  await page.mouse.move(0, 0);
  await page.locator(".hand-card [data-card-preview]").first().hover();
  await page.getByRole("tooltip").waitFor();
  await page.getByRole("tooltip").hover();
  await page.waitForTimeout(300);
  assert.equal(await page.getByRole("tooltip").count(), 1);
  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 390, height: 844 });
  await preview(
    page.locator(".hand-card [data-card-preview]").last(),
    "mobile-edge-hover",
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await fixture("payment");
  await page
    .getByRole("button", { name: "Use Scientist…", exact: true })
    .click();
  await preview(
    page.locator(".decision-option [data-card-preview]").first(),
    "decision-hover",
  );
  await page.locator(".decision-option").first().click();
  await preview(
    page.locator(".payment-source [data-card-preview]").first(),
    "payment-hover",
  );
  assert.equal(await page.getByRole("dialog").count(), 1);
  for (const kind of ["hero", "blocked", "enemy"]) {
    await fixture(kind);
    const hp = (await saved()).villain.hp;
    if (kind === "enemy")
      await page
        .getByRole("button", { name: "Resolve attack", exact: true })
        .click();
    else await page.locator(".attack-action").click();
    await page.locator(".combat-cinematic").waitFor();
    // Freeze only the visual timeline at its impact frame for inspection.
    await page.evaluate(() => {
      document
        .querySelector(".combat-cinematic")
        .getAnimations({ subtree: true })
        .forEach((a) => {
          a.pause();
          a.currentTime = 750;
        });
    });
    await shot(`attack-${kind}`);
    assert.equal(
      await page
        .locator(".combat-cinematic")
        .evaluate((el) => getComputedStyle(el).pointerEvents),
      "none",
    );
    if (kind === "hero") assert.equal((await saved()).villain.hp, hp - 2);
    if (kind === "blocked") assert.equal((await saved()).villain.hp, hp);
    if (kind === "enemy") assert.equal((await saved()).player.hp, 7);
    await page.waitForTimeout(1600);
    assert.equal(await page.locator(".combat-cinematic").count(), 0);
    assert.ok(
      (await saved()).review,
      "Animation must never advance the review",
    );
    await preview(
      page.locator(".review-focus [data-card-preview]").first(),
      `review-hover-${kind}`,
    );
    await page.reload();
    await page.getByRole("button", { name: /Resume mission/ }).click();
    assert.equal(await page.locator(".combat-cinematic").count(), 0);
    checks.push(
      `${kind} attack: real outcome, click-through overlay, automatic cleanup, no replay after reload`,
    );
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await fixture("hero");
  await page.locator(".attack-action").click();
  assert.equal(
    await page
      .locator(".combat-strip")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  await shot("attack-reduced-motion");
  checks.push("Reduced motion keeps a static combat panel");
  assert.deepEqual(errors, []);
} finally {
  await writeFile(
    `${root}/report.json`,
    JSON.stringify({ checks, errors }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ checks: checks.length, errors }));
