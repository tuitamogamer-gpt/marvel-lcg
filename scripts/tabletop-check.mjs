import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

// Layout fixtures intentionally exercise crowded public zones. The real
// multi-hero gameplay sequence lives in browser-check.mjs.
const require = createRequire(import.meta.url);
const root = "output/tabletop";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [];
const checks = [];
const layouts = [];
const audits = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
async function capture(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map((img) => img.decode()));
    const backgrounds = new Set(
      [
        ...document.querySelectorAll(
          ".playmat, .premium-token, .premium-card-back",
        ),
      ]
        .flatMap((el) => [
          ...getComputedStyle(el).backgroundImage.matchAll(
            /url\(["']?([^"')]+)["']?\)/g,
          ),
        ])
        .map((match) => match[1]),
    );
    await Promise.all(
      [...backgrounds].map((src) => {
        const image = new Image();
        image.src = src;
        return image.decode();
      }),
    );
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: `${root}/${name}.png`, fullPage: true });
}
async function audit(name) {
  if (!(await page.evaluate(() => Boolean(window.axe))))
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    });
    return result.violations.map(({ id, nodes }) => ({
      id,
      targets: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    }));
  });
  audits.push({ name, violations });
}
try {
  await page.goto(process.env.BASE_URL || "http://localhost:5174");
  await page.locator("#start-btn").click();
  await page.getByRole("button", { name: "Keep hand & begin" }).click();
  for (
    let n = 0;
    n < 20 &&
    (await page.getByRole("button", { name: "Proceed", exact: true }).count());
    n++
  )
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  await capture("opening-table");
  assert.match(await page.locator(".identity-stats").innerText(), /REC/);
  assert.doesNotMatch(await page.locator(".identity-stats").innerText(), /ATK/);
  await page
    .getByRole("button", { name: "Your discard, 0 cards. Inspect pile" })
    .click();
  assert.match(
    await page.getByRole("dialog").innerText(),
    /no cards in this discard pile/,
  );
  await page.keyboard.press("Escape");
  checks.push("An empty discard opens an accurate empty-pile dialog");

  const missionBeforeStyling = await page.evaluate(() =>
    localStorage.getItem("champions.save.v1"),
  );
  await page.getByRole("button", { name: "Customize table" }).click();
  await capture("collector-picker");
  await audit("collector-picker-desktop");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 850 });
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth + 1,
      ),
    );
    const dialog = page.getByRole("dialog");
    assert.ok(
      await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    );
    await capture(`collector-picker-${width}`);
    if (width === 390) await audit("collector-picker-mobile");
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Back to the game" }).focus();
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .getByRole("button", { name: "Close dialog" })
      .evaluate((el) => document.activeElement === el),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Customize table" })
      .evaluate((el) => document.activeElement === el),
    true,
  );
  for (const [id, name] of [
    ["midnight-city", "Midnight Manhattan"],
    ["helicarrier", "Helicarrier"],
    ["cosmic-rift", "Cosmic Rift"],
  ]) {
    await page.getByRole("button", { name: "Customize table" }).click();
    // Scope to the dialog: a hand card with the same name (Helicarrier) is also a button.
    const choice = page
      .getByRole("dialog")
      .getByRole("button", { name: new RegExp(name) });
    await choice.click();
    assert.equal(await choice.getAttribute("aria-pressed"), "true");
    await page.getByRole("button", { name: "Back to the game" }).click();
    assert.equal(
      await page.locator(".playmat").getAttribute("data-playmat"),
      id,
    );
    await capture(`playmat-${id}`);
    await audit(`playmat-${id}`);
  }
  assert.equal(
    await page.evaluate(() => localStorage.getItem("champions.save.v1")),
    missionBeforeStyling,
  );
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.equal(
    await page.locator(".playmat").getAttribute("data-playmat"),
    "cosmic-rift",
  );
  await page.evaluate(() =>
    localStorage.setItem("champions.playmat.v1", "removed-theme"),
  );
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.equal(
    await page.locator(".playmat").getAttribute("data-playmat"),
    "midnight-city",
  );
  checks.push(
    "All generated playmats load, selection survives reload, invalid preferences fall back, and mission state is unchanged",
  );
  checks.push(
    "Table customization fits small screens, traps focus, and restores focus after Escape",
  );

  const expected = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("champions.save.v1"));
    const take = (code, zones) => {
      for (const zone of zones) {
        const index = zone.findIndex((piece) => piece.code === code);
        if (index >= 0) return zone.splice(index, 1)[0];
      }
      throw new Error(`Missing fixture card ${code}`);
    };
    const playerZones = [state.player.hand, state.player.deck];
    state.player.inPlay = [
      "01002",
      "01058",
      "01008",
      "01006",
      "01091",
      "01092",
    ].map((code) => take(code, playerZones));
    state.player.inPlay[0].exhausted = true;
    state.player.inPlay[0].damage = 1;
    state.player.inPlay[2].counters = 3;
    state.player.inPlay[3].exhausted = true;
    state.player.inPlay[4].exhausted = true;
    state.player.inPlay[5].exhausted = true;
    state.player.exhausted = true;
    state.player.form = "hero";
    state.player.hp = 6;
    state.player.stunned = true;
    state.player.confused = true;
    state.player.discard.push(...state.player.deck.splice(0, 3));
    while (state.player.hand.length < 8)
      state.player.hand.push(state.player.deck.pop());
    const encounterZones = [state.encounter.deck];
    const minion = take("01103", encounterZones);
    minion.engagedWith = state.activePlayerId;
    minion.tough = true;
    state.minions = [minion];
    state.sideSchemes = ["01107", "01109"].map((code) => {
      const piece = take(code, encounterZones);
      piece.counters = 3;
      return piece;
    });
    const attachment = take("01099", encounterZones);
    attachment.attachedTo = state.villain.id;
    state.attachments = [attachment];
    state.encounter.discard.push(take("01104", encounterZones));
    const dealt = state.encounter.deck.pop();
    dealt.dealtTo = state.activePlayerId;
    state.encounter.dealt.push(dealt);
    state.scheme.threat = 5;
    state.review = null;
    state.prompt = null;
    state.players[0].player = state.player;
    localStorage.setItem("champions.save.v1", JSON.stringify(state));
    return {
      heroDiscard: state.player.discard.at(-1).code,
      encounterDiscard: state.encounter.discard.at(-1).code,
      facedown: dealt.code,
    };
  });
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  const rotation = await page
    .locator(".identity-card")
    .evaluate((el) => getComputedStyle(el).transform);
  assert.match(rotation, /^matrix\(0, 1, -1, 0,/);
  assert.match(await page.locator(".identity-stats").innerText(), /ATK/);
  assert.doesNotMatch(await page.locator(".identity-stats").innerText(), /REC/);
  checks.push(
    "Displayed identity stats follow the current hero or alter-ego face",
  );
  assert.equal(
    await page
      .getByRole("meter", { name: "Hero HP", exact: true })
      .getAttribute("aria-valuenow"),
    "6",
  );
  assert.equal(
    await page.locator(".hero-pile-area .discard-pile img").getAttribute("src"),
    `/cards/${expected.heroDiscard}.png`,
  );
  assert.equal(
    await page.locator(".encounter-zone .discard-pile img").getAttribute("src"),
    `/cards/${expected.encounterDiscard}.png`,
  );
  assert.equal(
    await page
      .locator(".hero-pile img, .encounter-pile img, .dealt-encounters img")
      .count(),
    0,
  );
  assert.equal(await page.locator(".enemy-tile .card-image").count(), 1);
  assert.equal(await page.locator(".table-side-scheme .card-image").count(), 2);
  checks.push(
    "Saved exhaustion rotates identity 90 degrees and health matches saved state",
  );
  checks.push(
    "Discard tops show actual last discarded cards; draw piles and dealt encounters stay face down",
  );
  checks.push("Minion and side-scheme cards retain their complete artwork");
  await page
    .getByRole("button", { name: "Your discard, 3 cards. Inspect pile" })
    .click();
  assert.equal(await page.locator(".pile-grid button").count(), 3);
  await page.locator(".pile-grid button").first().click();
  assert.ok(await page.getByRole("dialog").isVisible());
  await page.keyboard.press("Escape");
  checks.push(
    "A populated discard opens all cards and an individual card can be inspected",
  );

  for (const width of [1280, 1440, 1920, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    const inspections = [];
    const inspectableCards = page.locator(
      ".identity-card, .in-play-image .card-image",
    );
    for (let index = 0; index < (await inspectableCards.count()); index++) {
      const inspectableCard = inspectableCards.nth(index);
      // In-play lanes may scroll horizontally. Validate every physical card
      // after bringing it into view, including cards beyond the initial lane.
      await inspectableCard.scrollIntoViewIfNeeded();
      const inspection = await inspectableCard.evaluate((card) => {
        const mat = document.querySelector(".playmat").getBoundingClientRect();
        const rect = card.getBoundingClientRect();
        const button = card.closest("button");
        const control = button.getBoundingClientRect();
        const hit = document.elementFromPoint(
          control.left + control.width / 2,
          control.top + control.height / 2,
        );
        return {
          name: card.getAttribute("alt") || button.getAttribute("aria-label"),
          inside:
            rect.left >= mat.left - 1 &&
            rect.right <= mat.right + 1 &&
            rect.top >= mat.top - 1 &&
            rect.bottom <= mat.bottom + 1,
          unobstructed: hit === button || button.contains(hit),
        };
      });
      inspections.push(inspection);
    }
    const layout = await page.evaluate(() => {
      const overlap = [...document.querySelectorAll(".in-play-cards")].some(
        (group) => {
          const cards = [
            ...group.querySelectorAll(".in-play-image .card-image"),
          ].map((el) => el.getBoundingClientRect());
          return cards.some((a, i) =>
            cards
              .slice(i + 1)
              .some(
                (b) =>
                  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 &&
                  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2,
              ),
          );
        },
      );
      const pageRegions = [
        ...document.querySelectorAll(
          ".topbar, .tabletop, .tabletop-top, .round-tracker, .mission-brief, .team-strip, .playmat, .mission-rail",
        ),
      ].map((el) => ({
        class: el.className,
        right: Math.round(el.getBoundingClientRect().right),
      }));
      return {
        width: innerWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overlap,
        pageRegions,
      };
    });
    layout.inspections = inspections;
    layout.outside = inspections.filter((card) => !card.inside).length;
    layout.obstructed = inspections.filter((card) => !card.unobstructed).length;
    layouts.push(layout);
    assert.ok(layout.scrollWidth <= width + 1, `Page overflow at ${width}`);
    assert.equal(
      layout.outside,
      0,
      `Rotated cards outside the mat at ${width}`,
    );
    assert.equal(
      layout.obstructed,
      0,
      `Card inspection controls obstructed at ${width}: ${JSON.stringify(inspections.filter((card) => !card.unobstructed))}`,
    );
    assert.equal(layout.overlap, false, `Rotated card overlap at ${width}`);
    await capture(`crowded-${width}`);
    if ([1440, 390].includes(width)) await audit(`crowded-${width}`);
  }
  checks.push(
    "Every crowded and exhausted card can be brought into view and inspected inside the table without overlap at six viewport widths",
  );
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.evaluate(() => window.scrollTo(0, 0));
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight + 1,
    ),
    "The crowded laptop table must fit without page scrolling",
  );
  assert.ok(
    await page
      .locator(".table-play-area")
      .evaluate((el) => el.scrollHeight <= el.clientHeight + 1),
    "The crowded laptop table must fit without vertical scrolling inside the mat",
  );
  assert.equal(
    await page.locator(".hero-form-button").evaluate((control) => {
      const box = control.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return hit === control || control.contains(hit);
    }),
    true,
    "The crowded table's form control must remain unobstructed",
  );
  await capture("crowded-laptop");
  checks.push(
    "The crowded laptop table fits one screen and its form control remains unobstructed",
  );
  assert.equal(errors.length, 0, JSON.stringify(errors));
  assert.equal(
    audits.flatMap((audit) => audit.violations).length,
    0,
    JSON.stringify(audits),
  );
} catch (error) {
  await page.screenshot({ path: `${root}/failure.png`, fullPage: true });
  throw error;
} finally {
  await writeFile(
    `${root}/result.json`,
    JSON.stringify({ checks, layouts, audits, errors }, null, 2),
  );
  await browser.close();
}
console.log(JSON.stringify({ checks, layouts, audits, errors }, null, 2));
