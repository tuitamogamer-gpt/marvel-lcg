import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

// Common desktop screens must fit the actual table and its controls. Shorter
// and mobile screens may scroll, but controls must remain reachable.
const desktopSizes = [
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
  [1024, 768],
];
const fallbackSizes = [
  [1280, 600],
  [768, 1024],
  [390, 844],
  [320, 568],
];
const root = "output/viewport-fit";
const require = createRequire(import.meta.url);
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
await mkdir(root, { recursive: true });
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [],
  layouts = [],
  audits = [],
  failures = [];
let context, page;

function verify(condition, message) {
  if (!condition) failures.push(message);
}
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));

async function open(saved) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript((state) => {
    Date.now = () => 54321;
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
    if (state && !sessionStorage.getItem("viewport-fixture-loaded")) {
      localStorage.setItem("champions.save.v1", JSON.stringify(state));
      sessionStorage.setItem("viewport-fixture-loaded", "yes");
    }
  }, saved);
  await page.goto(url);
  if (saved) await page.getByRole("button", { name: /Resume mission/ }).click();
}

async function settleOpening() {
  for (let n = 0; n < 80; n++) {
    const s = await save();
    assert.ok(!s.error, s.error);
    if (s.review) {
      await page.getByRole("button", { name: "Proceed", exact: true }).click();
      continue;
    }
    if (s.phase === "mulligan") {
      await page.getByRole("button", { name: "Keep hand & begin" }).click();
      continue;
    }
    assert.equal(s.prompt, null, "Opening requires an unexpected decision");
    return s;
  }
  throw Error("Mission opening did not settle");
}

async function launch(heroCount = 1) {
  await open();
  if (heroCount > 1)
    await page
      .getByRole("button", { name: `${heroCount} heroes`, exact: true })
      .click();
  await page.locator("#start-btn").click();
  const s = await settleOpening();
  assert.equal(s.players.length, heroCount);
  return s;
}

async function ready() {
  await page.keyboard.press("Escape");
  await page.mouse.move(0, 0);
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((img) => img.getClientRects().length && img.loading !== "lazy")
        .map((img) => img.decode()),
    );
    window.scrollTo(0, 0);
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
  });
}

async function controlMetrics(locator) {
  return locator.evaluate((control) => {
    const rect = control.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const hit = document.elementFromPoint(x, y);
    const image = control.querySelector(".card-image");
    const imageRect = image?.getBoundingClientRect();
    const imageHit = imageRect
      ? document.elementFromPoint(
          imageRect.left + imageRect.width / 2,
          imageRect.top + imageRect.height / 2,
        )
      : null;
    return {
      label: control.getAttribute("aria-label") || control.textContent.trim(),
      rect: {
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
      },
      visible:
        rect.width > 0 &&
        rect.height > 0 &&
        rect.left >= -1 &&
        rect.top >= -1 &&
        rect.right <= innerWidth + 1 &&
        rect.bottom <= innerHeight + 1,
      hit: hit === control || control.contains(hit),
      imageHit: image
        ? imageHit === control || control.contains(imageHit)
        : null,
    };
  });
}

async function fit(name, width, height, desktop = true) {
  await page.setViewportSize({ width, height });
  await ready();
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    scrollWidth: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    ),
    scrollHeight: Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    ),
    playArea: (() => {
      const el = document.querySelector(".table-play-area");
      return (
        el && {
          height: el.clientHeight,
          contentHeight: el.scrollHeight,
          width: el.clientWidth,
          contentWidth: el.scrollWidth,
        }
      );
    })(),
    // Keep diagnostic regions and scroll containers without coupling the test
    // to a particular grid, sticky position or element height.
    regions: [
      ...document.querySelectorAll(
        ".topbar, .tabletop, .tabletop-top, .team-strip, .playmat, .table-bottom, .mission-rail, .invocation-area",
      ),
    ].map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        class: el.className,
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      };
    }),
    internalScroll: [...document.querySelectorAll(".tabletop *")]
      .filter((el) => {
        const style = getComputedStyle(el);
        return (
          ["auto", "scroll"].includes(style.overflowY) &&
          el.scrollHeight > el.clientHeight + 1
        );
      })
      .map((el) => ({
        class: el.className,
        height: el.clientHeight,
        content: el.scrollHeight,
      })),
  }));
  const label = `${name} ${width}×${height}`;
  verify(
    metrics.scrollWidth <= width + 1,
    `${label}: horizontal overflow ${metrics.scrollWidth}/${width}`,
  );
  if (desktop)
    verify(
      metrics.scrollHeight <= height + 1,
      `${label}: vertical overflow ${metrics.scrollHeight}/${height}`,
    );
  if (desktop && metrics.playArea)
    verify(
      metrics.playArea.contentHeight <= metrics.playArea.height + 1,
      `${label}: table middle needs vertical scroll ${metrics.playArea.contentHeight}/${metrics.playArea.height}`,
    );
  // Capture before testing the far end of each horizontal lane so screenshots
  // retain the normal starting position with the main scheme first.
  await page.screenshot({
    path: `${root}/${name}-${width}x${height}.png`,
    fullPage: true,
  });
  const controls = [];
  for (const selector of [
    ".identity-card",
    ".hero-form-button",
    ".turn-action .primary-button",
    ".hand-filter button",
    ".hand-card",
    ".hand-play",
    ".hero-pile-area .discard-pile",
    ".in-play-image",
    ".in-play-actions button",
    ".invocation-area button",
    ".scheme-card",
    ".environment-card",
    ".enemy-tile",
    ".attached-card",
    ".attached-piece .text-button",
    ".identity-resource .ability-button",
    ".enemy-unit > .ability-button",
    ".teammate-identity",
    ".teammate-card-stack > button",
    ".encounter-zone button",
  ]) {
    const matches = page.locator(selector);
    const count = await matches.count();
    // Every card and action must be reachable, including cards initially off
    // the end of a horizontal lane and disabled actions that show current state.
    for (let index = 0; index < count; index++) {
      const control = matches.nth(index);
      // Empty teammate tableaux are intentionally represented by the team
      // selector instead. Test rendered controls, including off-lane cards.
      if (!(await control.evaluate((el) => el.getClientRects().length > 0)))
        continue;
      await control.scrollIntoViewIfNeeded();
      const result = await controlMetrics(control);
      controls.push({ selector, index, ...result });
      verify(
        result.visible,
        `${label}: control outside viewport: ${result.label}`,
      );
      verify(result.hit, `${label}: control obstructed: ${result.label}`);
      if (result.imageHit !== null)
        verify(
          result.imageHit,
          `${label}: card image obstructed: ${result.label}`,
        );
    }
  }
  layouts.push({ name, desktop, ...metrics, controls });
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    for (const lane of document.querySelectorAll(".tabletop *")) {
      const overflow = getComputedStyle(lane).overflowX;
      if (["auto", "scroll"].includes(overflow)) lane.scrollLeft = 0;
    }
  });
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
      nodes: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    }));
  });
  audits.push({ name, violations });
}

async function crowdedFixture() {
  return page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem("champions.save.v1"));
    const take = (code, zones) => {
      for (const zone of zones) {
        const index = zone.findIndex((piece) => piece.code === code);
        if (index >= 0) return zone.splice(index, 1)[0];
      }
      throw Error(`Missing fixture card ${code}`);
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
    for (const piece of state.player.inPlay) piece.exhausted = true;
    state.player.inPlay[0].damage = 1;
    state.player.inPlay[2].counters = 3;
    // Guarantee a real playable hand card even when the shuffled opening hand
    // happens to contain mostly resources or interrupts.
    if (!state.player.hand.some((piece) => piece.code === "01093"))
      state.player.hand.push(take("01093", playerZones));
    while (state.player.hand.length < 8) {
      const piece = state.player.deck.pop();
      if (!piece) throw Error("Fixture deck cannot supply eight hand cards");
      state.player.hand.push(piece);
    }
    while (state.player.hand.length > 8)
      state.player.deck.push(state.player.hand.pop());
    state.player.discard.push(...state.player.deck.splice(0, 3));
    state.player.exhausted = true;
    state.player.form = "hero";
    state.player.hp = 6;
    state.player.stunned = true;
    state.player.confused = true;
    state.villain.stunned = true;
    state.villain.confused = true;
    state.villain.tough = true;
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
    return state;
  });
}

async function inspectAndPlay() {
  await page.setViewportSize({ width: 1366, height: 768 });
  await ready();
  const before = await save();
  const hand = page.locator(".hand-card").first();
  await hand.hover();
  const preview = page.getByRole("tooltip", { name: /^Enlarged card:/ });
  await preview.waitFor({ state: "visible" });
  const box = await preview.boundingBox();
  verify(
    box &&
      box.x >= 0 &&
      box.y >= 0 &&
      box.x + box.width <= 1367 &&
      box.y + box.height <= 769,
    "Crowded laptop: hover preview must fit inside the viewport",
  );
  await page.keyboard.press("Escape");
  await preview.waitFor({ state: "hidden" });
  await hand.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  verify(
    await hand.evaluate((el) => document.activeElement === el),
    "Closing hand inspection must return keyboard focus to its card",
  );
  assert.deepEqual(await save(), before, "Inspection must preserve game state");
  checks.push(
    "Compact cards retain an in-viewport hover preview and inspection with Escape/focus return",
  );

  const allCards = await page.locator(".hand-card").count();
  assert.equal(allCards, 8, "Crowded fixture keeps all eight hand cards");
  const readyFilter = page.getByRole("button", { name: /^Ready to play/ });
  await readyFilter.click();
  assert.equal(await readyFilter.getAttribute("aria-pressed"), "true");
  assert.ok(
    await page.locator(".hand-play").count(),
    "Playable cards keep their direct Play controls",
  );
  assert.equal(
    await page.locator(".hand-slot:not(.playable)").count(),
    0,
    "Ready-to-play filter shows only playable cards",
  );
  await page.getByRole("button", { name: /^All cards/ }).click();
  assert.equal(await page.locator(".hand-card").count(), allCards);
  const play = page.locator(".hand-play").first();
  const playableCard = page.locator(".hand-slot.playable .hand-card").first();
  await playableCard.click();
  assert.ok(
    await page
      .getByRole("button", { name: "Play card", exact: true })
      .isEnabled(),
  );
  await page.keyboard.press("Escape");
  await play.click({ timeout: 5000 });
  const after = await save();
  verify(
    Boolean(after.prompt || after.review) ||
      after.player.hand.length < before.player.hand.length,
    "Direct hand Play must reach the native payment/decision/result flow",
  );
  checks.push(
    "All eight cards, both hand filters, inspector Play and direct hand Play remain functional",
  );
  await open(before);
}

async function strangeFixture() {
  // A native engine save exercises Doctor Strange's extra faceup Invocation
  // pile while preserving the hidden Invocation order.
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import {newGame,dispatch} from './src/game/engine.ts';
        import {STARTER_DECKS,catalogDeckCodes} from './src/game/catalog.ts';
        export function fixture() {
          const deck=STARTER_DECKS.find(d=>d.heroCode==='09001a'&&d.sourceType==='source-preconstructed');
          let s=newGame({heroId:'doctor_strange',aspect:'protection',villainId:'rhino',deckCards:catalogDeckCodes(deck),deckOrigin:'source',deckName:deck.name,seed:92014,pacing:'expert'});
          s=dispatch(s,{type:'MULLIGAN',ids:[]});
          if(s.error)throw Error(s.error);
          s.player.form='hero';
          s.players[0].player=s.player;
          return s;
        }`,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  const { fixture } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );
  return fixture();
}

async function goblinFixtures() {
  // Use native scenario setup so the Risky Business environment/counters and
  // Mutagen Formula's opening Thrall reflect real engine state.
  const bundle = await build({
    stdin: {
      resolveDir: process.cwd(),
      contents: `
        import {newGame,dispatch} from './src/game/engine.ts';
        import {card} from './src/game/cards.ts';
        export function fixtures() {
          return ['risky_business','mutagen_formula'].map(villainId=>{
            let s=newGame({heroId:'spider_man',aspect:'justice',villainId,seed:92015,pacing:'expert'});
            s=dispatch(s,{type:'MULLIGAN',ids:[]});
            if(s.error)throw Error(s.error);
            while(s.review) {
              s=dispatch(s,{type:'PROCEED'});
              if(s.error)throw Error(s.error);
            }
            if(s.prompt)throw Error('Unexpected scenario opening prompt');
            const index=s.encounter.deck.findIndex(p=>card(p).type_code==='minion');
            if(index<0)throw Error('Scenario fixture needs a real encounter minion');
            const minion=s.encounter.deck.splice(index,1)[0];
            minion.engagedWith=s.activePlayerId;
            s.minions.push(minion);
            s.players[0].player=s.player;
            return {name:villainId.replaceAll('_','-'),state:s};
          });
        }`,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  const { fixtures } = await import(
    `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
  );
  return fixtures();
}

async function inspectPublicCard(name, selector) {
  const before = await save();
  const control = page.locator(selector).first();
  await control.scrollIntoViewIfNeeded();
  // Use keyboard activation to verify keyboard focus return consistently;
  // WebKit clears button focus on mouse activation even after focus().
  await control.focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ state: "visible" });
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  verify(
    await control.evaluate((el) => document.activeElement === el),
    `${name}: inspection must restore focus to its public card`,
  );
  assert.deepEqual(
    await save(),
    before,
    `${name}: inspection must preserve state`,
  );
}

try {
  await launch();
  for (const [width, height] of desktopSizes)
    await fit("opening", width, height);
  checks.push(
    "A real solo mission opening is measured at seven common desktop sizes",
  );

  const crowded = await crowdedFixture();
  await open(crowded);
  assert.equal(await page.locator(".in-play-card.exhausted").count(), 6);
  assert.equal(await page.locator(".hand-card").count(), 8);
  assert.equal(await page.locator(".enemy-tile").count(), 1);
  assert.equal(await page.locator(".table-side-scheme").count(), 2);
  for (const [width, height] of desktopSizes)
    await fit("crowded", width, height);
  await page.setViewportSize({ width: 1366, height: 768 });
  await audit("crowded-desktop");
  try {
    await inspectAndPlay();
  } catch (error) {
    failures.push(`Crowded laptop interactions: ${error.message}`);
    await open(crowded);
  }
  for (const [width, height] of fallbackSizes)
    await fit("crowded-fallback", width, height, false);
  await audit("crowded-mobile");
  checks.push(
    "Crowded table covers six exhausted cards, eight hand cards, a minion, two side schemes, attachments and statuses",
  );
  checks.push(
    "Short and mobile screens keep horizontal containment and reachable controls through scrolling",
  );

  // Mission setup currently supports 1–3 heroes; exercise both team sizes
  // through the real launch flow instead of inventing an unsupported 4th seat.
  for (const count of [2, 3]) {
    await launch(count);
    for (const [width, height] of desktopSizes)
      await fit(`${count}-hero-opening`, width, height);
  }
  checks.push(
    "Real two-hero and maximum three-hero openings are measured across the same desktop matrix",
  );

  await open(await strangeFixture());
  assert.equal(await page.locator(".invocation-area").count(), 1);
  for (const [width, height] of desktopSizes)
    await fit("doctor-strange", width, height);
  await page.setViewportSize({ width: 1366, height: 768 });
  await page
    .getByRole("button", { name: /Faceup Invocation, 5 cards/ })
    .focus();
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor({ state: "visible" });
  assert.equal(await page.getByRole("dialog").locator(".pile-grid").count(), 0);
  await page.keyboard.press("Escape");
  assert.match(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    /Faceup Invocation/,
  );
  for (const [width, height] of fallbackSizes.slice(2))
    await fit("doctor-strange-fallback", width, height, false);
  checks.push(
    "Doctor Strange's Invocation piles fit desktop and mobile layouts and retain native inspection",
  );

  for (const { name, state } of await goblinFixtures()) {
    await open(state);
    assert.ok(await page.locator(".enemy-tile").count());
    assert.equal(
      await page.locator(".scenario-environment").count(),
      state.environments.length,
    );
    assert.equal(
      await page
        .locator(".scheme-area > :first-child")
        .evaluate((el) => el.classList.contains("main-scheme")),
      true,
      `${name}: main scheme must remain the first card in its lane`,
    );
    for (const [width, height] of desktopSizes) await fit(name, width, height);
    await page.setViewportSize({ width: 1366, height: 768 });
    await inspectPublicCard(`${name} minion`, ".enemy-tile");
    if (state.environments.length)
      await inspectPublicCard(`${name} environment`, ".environment-card");
    for (const [width, height] of [fallbackSizes[0], fallbackSizes[2]])
      await fit(`${name}-fallback`, width, height, false);
    await inspectPublicCard(`${name} mobile minion`, ".enemy-tile");
    if (state.environments.length)
      await inspectPublicCard(
        `${name} mobile environment`,
        ".environment-card",
      );
    checks.push(
      `${name}: native setup with encounter minions fits seven desktop sizes and two scrollable fallbacks; public card inspection preserves state and focus`,
    );
  }
  checks.push(
    "Every card image and button in hand, scheme, ally, upgrade, attachment and teammate lanes remains reachable by scrolling its own lane",
  );
  verify(errors.length === 0, `Browser errors: ${JSON.stringify(errors)}`);
  verify(
    audits.every(({ violations }) => violations.length === 0),
    `Accessibility violations: ${JSON.stringify(audits)}`,
  );
  assert.equal(failures.length, 0, failures.join("\n"));
} catch (error) {
  await page?.screenshot({ path: `${root}/failure.png`, fullPage: true });
  throw error;
} finally {
  await writeFile(
    `${root}/result.json`,
    JSON.stringify({ checks, layouts, audits, errors, failures }, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify({ checks, layouts, audits, errors, failures }, null, 2),
);
