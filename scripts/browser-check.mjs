import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url);
const root = "output/hotseat";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
await page.addInitScript(() => {
  Date.now = () => 54321;
});
const errors = [],
  checks = [],
  audits = [],
  reviews = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const url = process.env.BASE_URL || "http://localhost:5174";
// Exercise a cold boost image: its card frame must exist before artwork arrives.
await page.route("**/cards/01099.png", async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 750));
  await route.continue();
});
const state = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));
async function screenshot(name) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(async () => {
    const images = Array.from(document.images).filter(
      (img) => img.getClientRects().length && img.loading !== "lazy",
    );
    await Promise.all(images.map((img) => img.decode()));
    await new Promise(requestAnimationFrame);
  });
  await page.screenshot({
    path: `${root}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
async function audit(name) {
  if (!(await page.evaluate(() => !!window.axe)))
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
async function clickProceed() {
  const s = await state();
  if (s.review)
    reviews.push({
      title: s.review.title,
      actor: s.review.actor,
      changes: s.review.changes.length,
    });
  await page.getByRole("button", { name: "Proceed", exact: true }).click();
}
async function settle({ choices = true, mulligans = false } = {}) {
  for (let n = 0; n < 240; n++) {
    const s = await state();
    if (s.error) throw Error(s.error);
    if (s.review) {
      await clickProceed();
      continue;
    }
    if (s.phase === "mulligan" && mulligans) {
      await page.getByRole("button", { name: "Keep hand & begin" }).click();
      continue;
    }
    if (!s.prompt || !choices) return s;
    const p = s.prompt;
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
      await page.locator(".decision-option").nth(Math.max(0, idx)).click();
    } else if (p.kind === "payment") {
      // Spend all available sources: a real payment through the interface.
      for (let i = 0; i < p.sources.length; i++)
        await page.locator(".payment-source").nth(i).click();
      await page.getByRole("button", { name: "Confirm payment" }).click();
    } else {
      for (let i = 0; i < (p.min || 0); i++)
        await page.locator(".decision-option").nth(i).click();
      await page.getByRole("button", { name: "Confirm selection" }).click();
    }
  }
  throw Error("UI did not settle after 240 steps");
}
try {
  await page.goto(url);
  await page.evaluate(() => document.fonts.ready);
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `lobby ${width} overflow`,
    );
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "3 heroes", exact: true }).click();
  assert.equal(await page.locator(".setup-seat").count(), 3);
  await page.getByRole("button", { name: /Configure hero 2/ }).click();
  assert.equal(
    await page.locator(".hero-tile.selected").innerText(),
    "CAPTAIN MARVEL\nCarol Danvers",
  );
  assert.equal(
    await page
      .locator(".hero-tile")
      .filter({ hasText: "Spider-Man" })
      .isDisabled(),
    true,
  );
  await page
    .locator(".aspect-option")
    .filter({ hasText: "Protection" })
    .click();
  assert.match(
    await page.locator(".setup-seat").nth(1).innerText(),
    /Protection/,
  );
  await page
    .locator(".aspect-option")
    .filter({ hasText: "Leadership" })
    .click();
  await screenshot("team-setup");
  await audit("three-hero-setup");
  checks.push(
    "Three distinct hero seats, individual aspects, duplicate identity prevention",
  );
  await page.getByRole("button", { name: "View 40-card deck" }).click();
  assert.equal(await page.locator(".deck-list section").count(), 3);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.locator("#start-btn").click();
  await screenshot("opening-hand");
  await audit("mulligan-desktop");
  await settle({ mulligans: true });
  assert.equal((await state()).players.length, 3);
  assert.equal((await state()).villain.hp, 42);
  assert.equal((await state()).scheme.limit, 21);
  await screenshot("team-tabletop");
  await audit("battlefield-desktop");
  // Inspect an alter-ego payment to verify identity resources have card art too.
  const early = (await state()).hand.find((c) => c.playable && c.cost > 0);
  if (early) {
    await page
      .getByRole("button", { name: `Inspect ${early.name}`, exact: true })
      .first()
      .click();
    await page.getByRole("button", { name: "Play card", exact: true }).click();
    const scientist = page
      .locator(".payment-source")
      .filter({ hasText: "Scientist" });
    assert.equal(
      await scientist.locator("img").getAttribute("src"),
      "/cards/01001b.png",
    );
    await scientist.click();
    assert.equal(await scientist.getAttribute("aria-pressed"), "true");
    await screenshot("payment-ability");
    await audit("payment-ability");
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    assert.equal((await state()).hand.length, 6);
    checks.push(
      "Scientist has identity artwork and canceling spends no cards or abilities",
    );
  }
  await page.getByRole("button", { name: "Suit up" }).click();
  assert.equal((await state()).review, null);
  assert.equal((await state()).form, "hero");
  assert.equal(
    await page.getByRole("button", { name: "Proceed", exact: true }).count(),
    0,
  );
  await screenshot("hero-after-flip");
  checks.push("Suit up changes form immediately without a Proceed checkpoint");
  await page.getByRole("button", { name: /^Attack/ }).click();
  assert.ok((await state()).review);
  assert.equal((await state()).villain.hp, 40);
  await screenshot("attack-review");
  await audit("action-review");
  const saved = await state();
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.equal((await state()).review.id, saved.review.id);
  assert.deepEqual((await state()).players, saved.players);
  checks.push(
    "Autosave restores all seats and the exact pending Proceed checkpoint",
  );
  await clickProceed();
  assert.equal((await state()).villain.hp, 40);
  await screenshot("damage-review");
  await settle();
  checks.push(
    "Basic attack combines exhaustion and 42 → 40 villain HP in one saved review",
  );
  await page.getByRole("button", { name: /View Captain Marvel/ }).click();
  assert.match(await page.locator(".identity-info h2").innerText(), /Carol/);
  assert.equal(
    await page.getByRole("button", { name: "End hero turn" }).isDisabled(),
    true,
  );
  await page.getByRole("button", { name: "Use Commander" }).click();
  await settle({ choices: false });
  assert.equal((await state()).turnPlayerId, "p1");
  await page
    .locator(".decision-option")
    .filter({ hasText: "Spider-Man" })
    .click();
  await settle();
  assert.equal((await state()).activePlayerId, "p1");
  checks.push(
    "Teammate inspection gates basic actions but allows Commander during Spider-Man’s turn, then restores his control",
  );
  if (await page.locator(".hand-card.playable").count()) {
    await page.locator(".hand-card.playable").first().click();
    await page.getByRole("button", { name: "Play card", exact: true }).click();
    if ((await state()).prompt?.kind === "payment") {
      await screenshot("payment");
      await audit("payment-desktop");
      const beforePayment = await state();
      const sources = page.locator(".payment-source");
      assert.equal(
        await sources.locator("img").count(),
        beforePayment.prompt.sources.length,
      );
      await page.setViewportSize({ width: 1280, height: 800 });
      const confirm = page.getByRole("button", {
        name: "Confirm payment",
        exact: true,
      });
      const bounds = await confirm.boundingBox();
      assert.ok(
        bounds.y >= 0 && bounds.y + bounds.height <= 800,
        "Payment footer stays on screen",
      );
      await sources.first().click();
      const selectedText = await page.locator(".payment-summary").innerText();
      await page.locator(".resource-zoom").first().click();
      await screenshot("payment-card-inspection");
      await page.getByRole("button", { name: "Back to payment" }).click();
      assert.equal(await sources.first().getAttribute("aria-pressed"), "true");
      assert.equal(
        await page.locator(".payment-summary").innerText(),
        selectedText,
      );
      await sources.first().click();
      assert.equal(await confirm.isDisabled(), true);
      for (let i = 0; i < beforePayment.prompt.sources.length; i++)
        await sources.nth(i).click();
      await screenshot("payment-selected-laptop");
      await audit("payment-selected-laptop");
      assert.deepEqual(
        (await state()).hand,
        beforePayment.hand,
        "Selecting resources does not mutate the hand",
      );
      await confirm.click();
      const paid = await state();
      assert.ok(paid.review.payment);
      assert.equal(
        paid.review.cards.filter((c) => c.resources).length,
        beforePayment.prompt.sources.length,
      );
      const proceedBounds = await page
        .getByRole("button", { name: "Proceed", exact: true })
        .boundingBox();
      assert.ok(
        proceedBounds.y >= 0 && proceedBounds.y + proceedBounds.height <= 800,
        "Proceed stays visible on a laptop",
      );
      await screenshot("payment-receipt-laptop");
      await audit("payment-receipt-laptop");
      await page.evaluate(() => window.advanceTime(10000));
      assert.deepEqual(
        (await state()).review,
        paid.review,
        "Time does not advance an action",
      );
      await page
        .getByRole("button", { name: "View table", exact: true })
        .click();
      assert.equal(
        (await state()).review.id,
        paid.review.id,
        "Closing the focus window does not proceed",
      );
      await page.getByRole("button", { name: "Open action details" }).click();
      await page.reload();
      await page.getByRole("button", { name: /Resume mission/ }).click();
      assert.deepEqual(
        (await state()).review,
        paid.review,
        "Reload preserves the exact payment receipt",
      );
      await page.setViewportSize({ width: 1440, height: 1000 });
      checks.push(
        "Full resource artwork, enlargement preserves selections, explicit payment, saved receipt and no timed advancement",
      );
    }
    await settle();
    checks.push(
      "Play and pay for an actual card, including each resulting effect",
    );
  }
  await page.getByRole("button", { name: "End hero turn" }).click();
  await settle();
  assert.equal((await state()).activePlayerId, "p2");
  assert.equal((await state()).phase, "player");
  assert.equal(
    await page.getByRole("button", { name: "Use Commander" }).count(),
    0,
  );
  checks.push("Commander’s once-per-round limit persists into her own turn");
  await page.getByRole("button", { name: "Suit up" }).click();
  await settle();
  await page.getByRole("button", { name: "End hero turn" }).click();
  await settle();
  assert.equal((await state()).activePlayerId, "p3");
  await page.getByRole("button", { name: "Suit up" }).click();
  await settle();
  await page.getByRole("button", { name: "End hero turn" }).click();
  await settle({ choices: false });
  assert.match((await state()).prompt.title, /end of hero phase/);
  for (let n = 0; n < 120; n++) {
    const s = await state();
    if (s.review) {
      await clickProceed();
      continue;
    }
    if (s.prompt?.title.includes("attacks")) break;
    assert.equal(s.prompt?.kind, "select");
    for (let i = 0; i < (s.prompt.min || 0); i++)
      await page.locator(".decision-option").nth(i).click();
    await page.getByRole("button", { name: "Confirm selection" }).click();
  }
  const defense = await state();
  assert.match(defense.prompt.title, /attacks/);
  await screenshot("team-defense");
  await audit("team-defense-dialog");
  const other = defense.prompt.options.findIndex((p) => p.id === "hero:p2");
  assert.ok(other >= 0);
  await page.locator(".decision-option").nth(other).click();
  for (let n = 0; n < 15; n++) {
    const s = await state();
    if (s.review?.calculation) break;
    await clickProceed();
  }
  const boostImage = page.locator(".review-focus .review-card img").first();
  const boostBounds = await boostImage.boundingBox();
  // Related cards are compact thumbnails since the 25 September action windows.
  assert.ok(
    boostBounds.width >= 40 && boostBounds.height / boostBounds.width > 1.3,
    "A cold boost image reserves a complete portrait card frame",
  );
  await screenshot("villain-boost-review");
  const decodedBounds = await boostImage.boundingBox();
  assert.equal(
    decodedBounds.width,
    boostBounds.width,
    "Loading boost artwork must not shift card width",
  );
  assert.equal(
    decodedBounds.height,
    boostBounds.height,
    "Loading boost artwork must not shift card height",
  );
  assert.equal(
    await boostImage.evaluate((img) => img.complete && img.naturalWidth > 0),
    true,
  );
  checks.push(
    "Slow boost artwork retains its full card frame and is decoded before visual verification",
  );
  await audit("villain-boost-review");
  await settle();
  const after = await state();
  assert.equal(after.round, 2);
  assert.equal(after.firstPlayerId, "p2");
  assert.equal(after.activePlayerId, "p2");
  checks.push(
    "All three turns, all end-phase discards, teammate defense, boost checkpoints, per-hero encounters and first-player rotation",
  );
  await screenshot("round-two");
  for (const [width, height] of [
    [1280, 800],
    [1440, 900],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `table ${width} overflow`,
    );
    await page.locator(".hand-section").scrollIntoViewIfNeeded();
    const bounds = await page.locator(".action-director").boundingBox();
    assert.ok(
      bounds.x > width / 2 && bounds.y >= 0,
      `resolution rail not visible at ${width}`,
    );
    await screenshot(`desktop-${width}`);
  }
  checks.push(
    "Desktop layouts at 1280, 1440 and 1920 pixels with persistent resolution rail",
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  const violations = audits.reduce((n, a) => n + a.violations.length, 0);
  await writeFile(
    `${root}/result.json`,
    JSON.stringify(
      { checks, audits, violations, errors, reviews, after },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        checks,
        audits: audits.length,
        violations,
        errors,
        reviewSteps: reviews.length,
        round: after.round,
      },
      null,
      2,
    ),
  );
  assert.equal(
    violations,
    0,
    "Accessibility violations; inspect output/hotseat/result.json",
  );
} catch (e) {
  await screenshot("failure");
  await writeFile(
    `${root}/failure.json`,
    JSON.stringify(
      { error: String(e), state: await state(), errors, audits },
      null,
      2,
    ),
  );
  throw e;
} finally {
  await browser.close();
}
