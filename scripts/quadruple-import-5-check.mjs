import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// A bounded integration gate: launch the actual published source lists through
// the public UI, then keep their physical cards through setup, combat and reload.
// Pack-specific rules remain covered by each pack's focused engine tests.
const output =
  process.env.QUADRUPLE_IMPORT_5_OUTPUT || "output/quadruple-import-5/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const heroes = [
  {
    id: "nightcrawler",
    code: "48001a",
    name: "Nightcrawler",
    aspect: "protection",
    deckSize: 40,
    seed: 48001,
    expectedSetup: [],
    expectedSupplementary: [],
  },
  {
    id: "magneto",
    code: "49001a",
    name: "Magneto",
    aspect: "leadership",
    deckSize: 40,
    seed: 49001,
    expectedSetup: [],
    expectedSupplementary: ["49033", "49034", "49035", "49036"],
  },
  {
    id: "maria_hill",
    code: "50001a",
    name: "Maria Hill",
    aspect: "leadership",
    deckSize: 40,
    seed: 50001,
    expectedSetup: [],
    expectedSupplementary: [],
  },
  {
    id: "nick_fury",
    code: "50034a",
    name: "Nick Fury",
    aspect: "justice",
    deckSize: 40,
    seed: 50034,
    expectedSetup: ["50035a"],
    expectedSupplementary: [],
  },
];
const requested = (
  process.env.QUADRUPLE_IMPORT_5_HEROES || heroes.map((h) => h.id).join(",")
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const selected = requested.map((id) => {
  const hero = heroes.find((candidate) => candidate.id === id);
  assert.ok(hero, `Unknown fifth quadruple-import hero: ${id}`);
  return hero;
});
const widths = (process.env.QUADRUPLE_IMPORT_5_VIEWPORTS || "1440,1280,390,320")
  .split(",")
  .map(Number);
assert.ok(selected.length && new Set(requested).size === requested.length);
assert.ok(
  widths.length &&
    widths.every((width) => Number.isInteger(width) && width >= 320) &&
    new Set(widths).size === widths.length,
);
await mkdir(output, { recursive: true });
await Promise.all(
  [
    "report.json",
    "failure.json",
    "failure.png",
    "failure-save.json",
    "failure-body.txt",
  ].map((name) => rm(`${output}/${name}`, { force: true })),
);

const catalog = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-decks.json", import.meta.url),
    "utf8",
  ),
);
const definitions = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-cards.json", import.meta.url),
    "utf8",
  ),
);
const expand = (cards = {}) =>
  Object.entries(cards)
    .flatMap(([code, count]) => Array(count).fill(code))
    .sort();
const playerTypes = new Set([
  "event",
  "resource",
  "ally",
  "support",
  "upgrade",
  "player_side_scheme",
]);
// Native metadata and stats must match the engine in the production bundle.
// This helper never creates a fixture or modifies the public browser's save.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {card,heroCard,heroStats,imageFor} from './src/game/cards.ts';
export {heroRuntime} from './src/game/hero-runtime.ts';
export {paymentSources} from './src/game/payment.ts';`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const metadataPath = resolve(output, "native-metadata.mjs");
await writeFile(metadataPath, bundle.outputFiles[0].text);
const { card, heroStats, imageFor, heroRuntime, paymentSources } = await import(
  pathToFileURL(metadataPath).href
);

const reversible = {
  "50035a": ["50035a", "50035b"],
  "50035b": ["50035a", "50035b"],
};
const printed = new Map(
  definitions.map((definition) => [definition.code, definition]),
);
assert.equal(
  printed.get("50035a").back_link,
  "50035b",
  "The suit family uses the source-declared reverse",
);
const sources = Object.fromEntries(
  selected.map((hero) => {
    const source = catalog.find((deck) => deck.id === `starter-${hero.code}`);
    assert.ok(source, `${hero.name}: original preconstructed source`);
    const runtime = heroRuntime(hero.id);
    assert.ok(runtime, `${hero.name}: native runtime metadata`);
    const setupCodes = expand(runtime.setupCards);
    const supplementaryCodes = expand(runtime.supplementaryCards);
    assert.deepEqual(
      setupCodes,
      hero.expectedSetup,
      `${hero.name}: source-grounded setup pool`,
    );
    assert.deepEqual(
      supplementaryCodes,
      hero.expectedSupplementary,
      `${hero.name}: source-grounded Linked reserve pool`,
    );
    const codes = expand(source.cards).filter(
      (code) => !setupCodes.includes(code),
    );
    assert.equal(
      codes.length,
      hero.deckSize,
      `${hero.name}: exact counted source cards`,
    );
    return [
      hero.id,
      {
        ...hero,
        sourceUrl: source.sourceUrl,
        codes,
        originalCodes: expand(source.cards),
        setupCodes,
        supplementaryCodes,
        extraCodes: [...setupCodes, ...supplementaryCodes].sort(),
      },
    ];
  }),
);

function allPieces(state) {
  const nested = (piece) => [
    piece,
    ...(piece.storedCards || []).flatMap(nested),
    ...(piece.captured || []).flatMap(nested),
    ...(piece.droneCard ? nested(piece.droneCard) : []),
    ...(piece.inheritorBoosts || []).flatMap(nested),
  ];
  return [
    ...state.players.flatMap((seat) => {
      const player =
        seat.id === state.activePlayerId ? state.player : seat.player;
      return [
        ...player.hand,
        ...player.deck,
        ...player.discard,
        ...player.inPlay,
        ...(player.setAside || []),
        ...(player.invocationDeck || []),
        ...(player.invocationDiscard || []),
      ];
    }),
    ...state.resolving,
    ...state.removed,
    ...state.minions,
    ...state.sideSchemes,
    ...(state.victoryDisplay || []),
    ...state.attachments,
    ...(state.environments || []),
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...(state.encounter.storedBoosts || []),
    ...(state.deadpool?.poolSetAside || []),
    ...(state.attack?.pendingBoosts || []),
    ...(state.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function extraFaces(source) {
  return source.extraCodes.flatMap((code) => reversible[code] || [code]);
}
function isDeckPiece(piece, source) {
  // A Controlled Innocent keeps its original source printing even while its public card() definition is a facedown minion.
  const definition = printed.get(piece.code);
  return (
    definition?.faction_code !== "encounter" &&
    playerTypes.has(definition?.type_code) &&
    !extraFaces(source).includes(piece.code)
  );
}
function snapshot(state, source) {
  const pieces = allPieces(state);
  const runtime = heroRuntime(source.id);
  assert.ok(
    runtime?.scripted,
    `${source.name}: executable native hero is installed`,
  );
  const encounterCodes = [...runtime.obligationCodes, ...runtime.nemesisCodes];
  const nemesisCodes = definitions
    .filter((definition) => encounterCodes.includes(definition.code))
    .flatMap((definition) => Array(definition.quantity).fill(definition.code))
    .sort();
  const sourceCards = pieces.filter((piece) => isDeckPiece(piece, source));
  const extras = pieces.filter((piece) =>
    extraFaces(source).includes(piece.code),
  );
  const encounter = pieces.filter(
    (piece) => card(piece)?.faction_code === "encounter",
  );
  const nemeses = encounter.filter((piece) =>
    encounterCodes.includes(piece.code),
  );
  assert.deepEqual(
    sourceCards.map((piece) => piece.code).sort(),
    source.codes,
    `${source.name}: exact ${source.deckSize}-card original source`,
  );
  assert.deepEqual(
    extras.map((piece) => piece.code).sort(),
    source.extraCodes,
    `${source.name}: original physical Permanents and reserves`,
  );
  assert.deepEqual(
    nemeses.map((piece) => piece.code).sort(),
    nemesisCodes,
    `${source.name}: exact original obligation and nemesis quantities`,
  );
  const dreadpool = encounter.filter(
    (piece) => card(piece)?.set_code === "dreadpool",
  );
  assert.equal(
    dreadpool.length,
    0,
    "These original sources do not choose Pool or add the Dreadpool dependency",
  );
  return { sourceCards, extras, encounter, nemeses, dreadpool };
}
function conserved(state, source, initial, label) {
  const pieces = allPieces(state);
  assert.equal(initial.sourceCards.length, source.deckSize);
  assert.deepEqual(
    pieces
      .filter((piece) => isDeckPiece(piece, source))
      .map((piece) => piece.id)
      .sort(),
    initial.sourceCards.map((piece) => piece.id).sort(),
    `${label}: ${source.deckSize} original physical IDs`,
  );
  assert.deepEqual(
    pieces
      .filter((piece) => extraFaces(source).includes(piece.code))
      .map((piece) => piece.id)
      .sort(),
    initial.extras.map((piece) => piece.id).sort(),
    `${label}: original Permanent and reserve IDs`,
  );
  const tracked = [
    ...initial.sourceCards,
    ...initial.extras,
    ...initial.encounter,
  ];
  const ownedIds = new Set(
    [...initial.sourceCards, ...initial.extras].map((piece) => piece.id),
  );
  assert.equal(
    new Set(tracked.map((piece) => piece.id)).size,
    tracked.length,
    `${label}: baseline physical IDs are unique`,
  );
  for (const original of tracked) {
    const matches = pieces.filter((piece) => piece.id === original.id);
    assert.equal(
      matches.length,
      1,
      `${label}: ${original.code}:${original.id} occupies one zone`,
    );
    assert.ok(
      (reversible[original.code] || [original.code]).includes(matches[0].code),
      `${label}: original source printing or reversible face`,
    );
    if (ownedIds.has(original.id))
      assert.equal(
        matches[0].ownerId,
        original.ownerId,
        `${label}: the physical card keeps its original owner in every zone`,
      );
  }
  const drawZones = [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
  ];
  assert.ok(
    drawZones.every(
      (piece) =>
        !source.setupCodes
          .flatMap((code) => reversible[code] || [code])
          .includes(piece.code),
    ),
    `${label}: Permanents stay outside the draw pile`,
  );
  if (state.phase === "player") {
    for (const code of new Set(source.setupCodes))
      assert.equal(
        state.player.inPlay.filter((piece) =>
          (reversible[code] || [code]).includes(piece.code),
        ).length,
        source.setupCodes.filter((candidate) => candidate === code).length,
        `${label}: each original Permanent enters play`,
      );
  }
}

const browser = await chromium.launch({ headless: true });
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const checks = [],
  audits = [],
  layouts = [],
  errors = [];
const entryAssets = new Set(),
  styleAssets = new Set();
let context, page, current;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));

async function open(width) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width > 1000 ? 1000 : 844 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
  });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const src of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(src)) entryAssets.add(src);
  for (const href of await page
    .locator('link[rel="stylesheet"][href]')
    .evaluateAll((links) => links.map((link) => link.href)))
    if (/\/assets\/index-[^/]+\.css$/.test(href)) styleAssets.add(href);
  assert.equal(
    entryAssets.size,
    1,
    "One immutable production entry asset is loaded",
  );
  assert.equal(
    styleAssets.size,
    1,
    "One immutable production stylesheet is loaded",
  );
  if (process.env.QUADRUPLE_IMPORT_5_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith(
          "/" + process.env.QUADRUPLE_IMPORT_5_ASSET.replace(/^\/+/, ""),
        ),
      ),
    );
}
async function settle() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await save();
    assert.ok(state && !state.error, state?.error || "Native save must exist");
    if (!state.review) return state;
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  }
  throw Error("Native review queue did not settle");
}
async function choose(option) {
  const state = await save();
  assert.equal(state.prompt?.kind, "choice", JSON.stringify(state.prompt));
  const index = state.prompt.options.findIndex(
    (candidate) => candidate.id === option.id,
  );
  assert.ok(index >= 0, `Missing native choice ${option.id}`);
  await page.locator(".decision-option").nth(index).click();
  return settle();
}
async function finishChoices(source, preferred = () => null) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = await settle();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const option =
      (await preferred(state)) ||
      state.prompt.options.find((candidate) =>
        /^(pass|skip|none|done|continue|no)$/.test(candidate.id),
      ) ||
      (state.prompt.options.length === 1 ? state.prompt.options[0] : null);
    assert.ok(
      option,
      `Unreviewed native choice: ${JSON.stringify(state.prompt)}`,
    );
    await choose(option);
  }
  throw Error("Native choices did not finish");
}
async function reload() {
  const before = await save();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await save(),
    before,
    "Exact native state and physical IDs survive reload",
  );
  assert.equal(
    await page.locator(".milestone-animation").count(),
    0,
    "Resume never replays a milestone",
  );
}
async function checkpoint(name, width, source, initial) {
  if (initial) conserved(await save(), source, initial, name);
  await page.mouse.move(4, 4);
  for (const selector of [
    ".card-hover-preview",
    ".combat-cinematic",
    ".milestone-animation",
  ])
    await page.locator(selector).waitFor({ state: "hidden" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter(
          (image) => image.getClientRects().length && image.loading !== "lazy",
        )
        .map((image) => image.decode()),
    );
  });
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
      (dialog) => ({
        width: dialog.clientWidth,
        content: dialog.scrollWidth,
        top: dialog.getBoundingClientRect().top,
        bottom: dialog.getBoundingClientRect().bottom,
      }),
    ),
    actions: [
      ...document.querySelectorAll(
        ".flip-button, .hero-actions button, .in-play-actions button, .identity-info > .ability-button",
      ),
    ]
      .filter((button) => button.getClientRects().length)
      .map((button) => ({
        label: button.getAttribute("aria-label") || button.textContent,
        left: button.getBoundingClientRect().left,
        right: button.getBoundingClientRect().right,
      })),
  }));
  layouts.push({ name, ...metrics });
  assert.ok(metrics.document <= width + 1, `${name}: horizontal page overflow`);
  assert.ok(
    metrics.dialogs.every((dialog) => dialog.content <= dialog.width + 1),
    `${name}: horizontal dialog overflow`,
  );
  assert.ok(
    metrics.dialogs.every(
      (dialog) => dialog.top >= -1 && dialog.bottom <= metrics.height + 1,
    ),
    `${name}: dialog outside viewport`,
  );
  assert.ok(
    metrics.actions.every(
      (action) => action.left >= -1 && action.right <= width + 1,
    ),
    `${name}: action clipped`,
  );
  await page.evaluate(axe);
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  audits.push({
    name,
    width,
    violations: result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        message: node.failureSummary,
      })),
    })),
  });
  assert.equal(
    result.violations.length,
    0,
    `${name}: accessibility ${JSON.stringify(audits.at(-1))}`,
  );
  await page.screenshot({
    path: `${output}/${name}-${width}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}

async function flipHero(source, width, initial) {
  await page.locator(".flip-button").click();
  const state = await finishChoices(source);
  assert.equal(state.player.form, "hero");
  assert.equal(
    await page
      .locator(`.identity-card img[src="${imageFor(source.code)}"]`)
      .count(),
    1,
    "The actual imported hero face is displayed",
  );
  await checkpoint(`${source.id}-hero-form`, width, source, initial);
  return state;
}

async function basicAttack(source) {
  const before = await save();
  assert.equal(before.player.form, "hero");
  assert.equal(before.player.exhausted, false);
  await page.locator(".attack-action").click();
  const after = await finishChoices(source);
  const damage = heroStats(before).attack;
  assert.equal(after.player.exhausted, true);
  assert.equal(after.villain.hp, before.villain.hp - damage);
  return damage;
}

async function playHandPiece(piece) {
  const before = await save();
  const index = before.player.hand.findIndex(
    (candidate) => candidate.id === piece.id,
  );
  assert.ok(index >= 0, "The actual physical card is in this hand");
  const slot = page.locator(".hand-slot").nth(index);
  assert.equal(
    await slot.locator(`img[src="${imageFor(piece.code)}"]`).count(),
    1,
  );
  await slot
    .getByRole("button", { name: `Play now: ${card(piece).name}`, exact: true })
    .click();
  return settle();
}

async function payPhysicalCards(
  source,
  { preferred = () => null, abilityIds = [], excludeIds = [] } = {},
) {
  const pending = await settle();
  assert.equal(pending.prompt?.kind, "payment");
  assert.ok(
    !pending.prompt.requirements?.length,
    "This source flow uses ordinary printed costs",
  );
  const available = paymentSources(pending);
  const sources = available.filter((item) => item.kind === "card");
  const abilities = available.filter((item) => item.kind === "ability");
  const buttons = page.locator(
    ".payment-source-group.card-sources .payment-source",
  );
  assert.equal(
    await buttons.count(),
    sources.length,
    "Each actual native hand payment appears in the UI",
  );
  const cost = pending.prompt.cost || 0;
  let abilityValue = 0;
  for (const id of abilityIds) {
    const index = abilities.findIndex((item) => item.id === id);
    assert.ok(index >= 0, "The actual in-play resource ability is available");
    abilityValue += abilities[index].resources.length;
    const button = page
      .locator(".payment-source-group.ability-sources .payment-source")
      .nth(index);
    await button.click();
    assert.equal(await button.getAttribute("aria-pressed"), "true");
  }
  assert.ok(abilityValue <= cost);
  assert.ok(sources.length < 20, "The physical payment search is bounded");
  let selected = null;
  for (let mask = 0; mask < 2 ** sources.length; mask++) {
    const chosen = sources.filter((_, index) => mask & (1 << index));
    if (chosen.some((item) => excludeIds.includes(item.id))) continue;
    if (
      chosen.reduce((total, item) => total + item.resources.length, 0) !==
      cost - abilityValue
    )
      continue;
    if (!selected || chosen.length < selected.length) selected = chosen;
  }
  assert.ok(
    selected,
    "The unmodified source hand can pay the printed cost exactly",
  );
  for (const item of selected) {
    const index = sources.findIndex((candidate) => candidate.id === item.id);
    await buttons.nth(index).click();
    assert.equal(await buttons.nth(index).getAttribute("aria-pressed"), "true");
  }
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  const after = await finishChoices(source, preferred);
  for (const item of selected) {
    assert.ok(pending.player.hand.some((piece) => piece.id === item.id));
    assert.ok(
      after.player.discard.some((piece) => piece.id === item.id),
      "The same physical resource reaches its owner's discard",
    );
    assert.ok(!after.player.hand.some((piece) => piece.id === item.id));
  }
  return {
    state: after,
    cost,
    paidHandCardIds: selected.map((item) => item.id),
    resourceAbilityIds: abilityIds,
  };
}

async function nextRound(source, preferred = () => null) {
  const before = await save();
  const identity =
    before.player.form === "hero" ? source.code : heroRuntime(source.id).alter;
  const discardCount = Math.max(
    0,
    before.player.hand.length - card(identity).hand_size,
  );
  await page.getByRole("button", { name: /End hero phase/ }).click();
  for (let index = 0; index < discardCount; index++)
    await page.locator(".selection-card").nth(index).click();
  await page
    .getByRole("button", { name: "Begin villain phase", exact: true })
    .click();
  for (let attempt = 0; attempt < 100; attempt++) {
    const state = await settle();
    if (state.phase === "player" && state.round === before.round + 1) {
      assert.ok(!state.prompt);
      return state;
    }
    assert.equal(state.prompt?.kind, "choice", JSON.stringify(state.prompt));
    const option =
      (await preferred(state)) ||
      state.prompt.options.find((candidate) =>
        /^(pass|skip|none|done|continue|no)$/.test(candidate.id),
      ) ||
      state.prompt.options.find((candidate) => candidate.id === "take") ||
      (state.prompt.options.length === 1 ? state.prompt.options[0] : null);
    assert.ok(
      option,
      `Unreviewed ${source.name} villain-phase choice: ${JSON.stringify(state.prompt)}`,
    );
    await choose(option);
  }
  throw Error(`${source.name} did not finish the actual villain phase`);
}

async function magneticPull(source, width, initial) {
  const reserve = (await save()).player.setAside.filter((piece) =>
    source.expectedSupplementary.includes(piece.code),
  );
  assert.deepEqual(
    reserve.map((piece) => piece.code).sort(),
    source.expectedSupplementary,
  );
  await flipHero(source, width, initial);
  const before = await save();
  const index = before.player.deck.findIndex((piece) =>
    /\bMagnetic\b/.test(printed.get(piece.code)?.traits || ""),
  );
  assert.ok(
    index > 0,
    "The natural source seed exercises both a non-Magnetic discard and Magnetic recovery",
  );
  const discarded = before.player.deck.slice(0, index);
  const recovered = before.player.deck[index];
  await page
    .getByRole("button", {
      name: "Magnetic Pull · discard until a Magnetic card",
      exact: true,
    })
    .click();
  const after = await finishChoices(source);
  assert.deepEqual(after.player.deck, before.player.deck.slice(index + 1));
  assert.deepEqual(after.player.discard, [
    ...before.player.discard,
    ...discarded,
  ]);
  assert.deepEqual(
    after.player.hand,
    [...before.player.hand, recovered],
    "The same Magnetic physical card returns to the actual hand",
  );
  assert.deepEqual(after.player.setAside, before.player.setAside);
  await checkpoint("magneto-magnetic-pull", width, source, initial);
  await reload();
  const damage = await basicAttack(source);
  return {
    action: "Magnetic Pull",
    discardedIds: discarded.map((piece) => piece.id),
    recoveredId: recovered.id,
    linkedReserveIds: reserve.map((piece) => piece.id),
    basicAttackDamage: damage,
  };
}

async function nightcrawlerBamf(source, width, initial) {
  const before = await save();
  const bamf = before.player.deck.find((piece) => piece.code === "48006");
  assert.ok(
    bamf,
    "The AE action searches an actual counted Bamf! in the source deck",
  );
  await page
    .getByRole("button", { name: "Search the deck for Bamf!", exact: true })
    .click();
  const searching = await settle();
  assert.equal(searching.prompt?.title, "Kurt Wagner");
  const option = searching.prompt.options.find(
    (candidate) => candidate.id === bamf.id,
  );
  assert.ok(option, "The public search offers the original physical Bamf!");
  const searched = await choose(option);
  assert.ok(searched.player.hand.some((piece) => piece.id === bamf.id));
  assert.equal(searched.player.hand.length, before.player.hand.length + 1);
  assert.deepEqual(
    searched.player.deck.map((piece) => piece.id).sort(),
    before.player.deck
      .filter((piece) => piece.id !== bamf.id)
      .map((piece) => piece.id)
      .sort(),
  );
  assert.equal(searched.player.exhausted, false);
  await checkpoint("nightcrawler-ae-search", width, source, initial);
  await reload();
  let pending = await playHandPiece(bamf);
  assert.equal(pending.prompt?.kind, "choice");
  const enemy = pending.prompt.options.find(
    (candidate) => candidate.id === pending.villain.id,
  );
  assert.ok(enemy, "Bamf! attaches to the real Rhino target");
  pending = await choose(enemy);
  if (pending.prompt?.kind === "payment") {
    assert.equal(pending.prompt.cost, 0);
    await page
      .getByRole("button", { name: "Confirm payment", exact: true })
      .click();
  }
  const attached = await finishChoices(source);
  assert.equal(
    attached.player.inPlay.find((piece) => piece.id === bamf.id)?.attachedTo,
    attached.villain.id,
  );
  await flipHero(source, width, initial);
  const damage = await basicAttack(source);
  await checkpoint("nightcrawler-bamf-attached", width, source, initial);
  let defended = false;
  const after = await nextRound(source, async (state) => {
    const defend = state.prompt.options.find((candidate) =>
      candidate.effects?.some(
        (effect) =>
          effect.type === "nightcrawler:bamf" && effect.id === bamf.id,
      ),
    );
    if (!defend) return null;
    assert.equal(
      state.player.exhausted,
      false,
      "Nightcrawler is ready before declaring this defense",
    );
    await checkpoint(
      "nightcrawler-bamf-defense-decision",
      width,
      source,
      initial,
    );
    await reload();
    defended = true;
    return defend;
  });
  assert.ok(
    defended,
    "The actual enemy activation offers and uses Bamf!'s native interrupt",
  );
  assert.ok(after.player.discard.some((piece) => piece.id === bamf.id));
  assert.ok(!after.player.inPlay.some((piece) => piece.id === bamf.id));
  assert.equal(
    after.player.exhausted,
    false,
    "The native Bamf! defense did not exhaust Nightcrawler",
  );
  assert.ok(
    after.log.some(
      (entry) =>
        entry.text === "Bamf!: Nightcrawler defends without exhausting.",
    ),
  );
  return {
    action: "Kurt Wagner search and Bamf! defense",
    searchedAndAttachedId: bamf.id,
    defendedWithoutExhausting: true,
    pendingDefenseReload: true,
    basicAttackDamage: damage,
  };
}

async function mariaSupportStaff(source, width, initial) {
  const before = await save();
  const staff = before.player.deck.find((piece) => piece.code === "50008");
  const team = before.player.hand.find((piece) => piece.code === "50016");
  assert.ok(
    staff && team,
    "The natural source seed has Support Staff in the deck and an actual Command Team in hand",
  );
  await page
    .getByRole("button", {
      name: "Search for a S.H.I.E.L.D. support",
      exact: true,
    })
    .click();
  const searching = await settle();
  assert.equal(searching.prompt?.title, "Maria Hill");
  const option = searching.prompt.options.find(
    (candidate) => candidate.id === staff.id,
  );
  assert.ok(option, "Maria searches an original physical S.H.I.E.L.D. support");
  const searched = await choose(option);
  assert.equal(
    searched.player.exhausted,
    true,
    "The printed AE action exhausts Maria Hill",
  );
  assert.equal(searched.player.hand.length, before.player.hand.length + 1);
  assert.ok(searched.player.hand.some((piece) => piece.id === staff.id));
  assert.deepEqual(
    searched.player.deck.map((piece) => piece.id).sort(),
    before.player.deck
      .filter((piece) => piece.id !== staff.id)
      .map((piece) => piece.id)
      .sort(),
  );
  await checkpoint("maria-hill-ae-support-search", width, source, initial);
  await reload();
  await playHandPiece(staff);
  const staffPayment = await payPhysicalCards(source, {
    excludeIds: [team.id],
  });
  assert.equal(staffPayment.cost, 1);
  const inPlay = staffPayment.state.player.inPlay.find(
    (piece) => piece.id === staff.id,
  );
  assert.equal(
    inPlay?.counters,
    3,
    "The same paid Support Staff enters with three actual staff counters",
  );
  assert.equal(inPlay.exhausted, false);
  await playHandPiece(team);
  const teamPayment = await payPhysicalCards(source, {
    abilityIds: [staff.id],
  });
  assert.equal(teamPayment.cost, 2);
  const spentStaff = teamPayment.state.player.inPlay.find(
    (piece) => piece.id === staff.id,
  );
  const paidTeam = teamPayment.state.player.inPlay.find(
    (piece) => piece.id === team.id,
  );
  assert.equal(
    spentStaff?.counters,
    2,
    "The actual resource ability spends exactly one staff counter",
  );
  assert.equal(
    spentStaff.exhausted,
    true,
    "Generating the wild resource exhausts Support Staff",
  );
  assert.equal(paidTeam?.counters, 3);
  await checkpoint("maria-hill-paid-support-resource", width, source, initial);
  await reload();
  await flipHero(source, width, initial);
  await page
    .getByRole("button", {
      name: "Reassignment · move 1 all-purpose counter",
      exact: true,
    })
    .click();
  let pending = await settle();
  assert.equal(pending.prompt?.title, "Reassignment · source");
  const from = pending.prompt.options.find(
    (candidate) => candidate.id === staff.id,
  );
  assert.ok(from);
  pending = await choose(from);
  assert.equal(pending.prompt?.title, "Reassignment · destination");
  const to = pending.prompt.options.find(
    (candidate) => candidate.id === team.id,
  );
  assert.ok(to);
  await checkpoint(
    "maria-hill-reassignment-destination",
    width,
    source,
    initial,
  );
  await reload();
  const after = await choose(to);
  assert.equal(
    after.player.inPlay.find((piece) => piece.id === staff.id)?.counters,
    1,
  );
  assert.equal(
    after.player.inPlay.find((piece) => piece.id === team.id)?.counters,
    4,
    "The moved all-purpose counter adopts Command Team's command-counter type",
  );
  return {
    action: "AE S.H.I.E.L.D. search, Support Staff resource and Reassignment",
    searchedSupportId: staff.id,
    paidSupportId: team.id,
    staffPaymentIds: staffPayment.paidHandCardIds,
    teamPaymentIds: teamPayment.paidHandCardIds,
    actualStaffResourceId: staff.id,
    staffCountersAfter: 1,
    commandCountersAfter: 4,
    pendingReassignmentReload: true,
  };
}

async function assertSuitVisible(suit) {
  const panel = page.locator(`.in-play-card[data-piece-id="${suit.id}"]`);
  assert.equal(
    await panel.locator(`img[src="${imageFor(suit.code)}"]`).count(),
    1,
    "The linked suit shows its actual current source face",
  );
  const threat = panel.getByRole("img", {
    name: `Suit threat: ${suit.counters}`,
    exact: true,
  });
  assert.ok(
    await threat.isVisible(),
    "The physical suit's actual threat track is visible",
  );
}

async function nickFurySuitFlow(source, width, initial) {
  const before = await save();
  const suit = before.player.inPlay.find((piece) => piece.code === "50035a");
  assert.ok(suit, "One actual source Permanent begins Assault side faceup");
  assert.equal(suit.counters, 0);
  assert.equal(initial.extras.length, 1);
  await page
    .getByRole("button", {
      name: "Infiltrate · change to Stealth suit",
      exact: true,
    })
    .click();
  const stealth = await finishChoices(source);
  const changed = stealth.player.inPlay.find((piece) => piece.id === suit.id);
  assert.equal(changed?.code, "50035b");
  assert.equal(changed.counters, 0);
  assert.equal(
    stealth.player.form,
    "alter",
    "Suit form and identity form are separate",
  );
  assert.equal(stealth.player.exhausted, false);
  await assertSuitVisible(changed);
  await checkpoint("nick-fury-infiltrate-stealth", width, source, initial);
  await reload();
  await flipHero(source, width, initial);
  const firstRound = await nextRound(source);
  const firstSuit = firstRound.player.inPlay.find(
    (piece) => piece.id === suit.id,
  );
  assert.equal(firstSuit?.code, "50035b");
  assert.ok(
    firstSuit.counters > 0,
    "Stealth receives actual threat from an enemy activation",
  );
  assert.ok(
    firstRound.scheme.threat > 0,
    "There is actual main-scheme threat for the basic thwart",
  );
  assert.equal(firstRound.player.exhausted, false);
  await assertSuitVisible(firstSuit);
  await checkpoint(
    "nick-fury-stealth-activation-threat",
    width,
    source,
    initial,
  );
  const beforeThwart = await save();
  let gathered = false;
  await page.locator(".thwart-action").click();
  const thwarted = await finishChoices(source, (state) => {
    const gather = state.prompt.options.find(
      (option) => option.id === "gather-intel",
    );
    if (gather) {
      gathered = true;
      return gather;
    }
    return state.prompt.options.find((option) => option.id === "main") || null;
  });
  assert.ok(
    gathered,
    "The actual basic thwart opens and resolves Gather Intel",
  );
  assert.equal(thwarted.player.exhausted, true);
  assert.equal(
    thwarted.scheme.threat,
    Math.max(0, beforeThwart.scheme.threat - heroStats(beforeThwart).thwart),
  );
  assert.equal(
    thwarted.player.inPlay.find((piece) => piece.id === suit.id)?.counters,
    firstSuit.counters + 1,
    "Gather Intel adds exactly one real suit threat",
  );
  await assertSuitVisible(
    thwarted.player.inPlay.find((piece) => piece.id === suit.id),
  );
  await checkpoint("nick-fury-gather-intel", width, source, initial);
  await reload();
  const ready = await nextRound(source);
  const readySuit = ready.player.inPlay.find((piece) => piece.id === suit.id);
  assert.equal(readySuit?.code, "50035b");
  assert.equal(ready.player.exhausted, false);
  const spent = Math.min(3, readySuit.counters);
  assert.ok(spent > 0);
  let assault = false;
  await page.locator(".attack-action").click();
  const attacked = await finishChoices(source, async (state) => {
    if (state.prompt.title !== "Assault") return null;
    const pendingSuit = state.player.inPlay.find(
      (piece) => piece.id === suit.id,
    );
    assert.equal(
      pendingSuit?.code,
      "50035a",
      "Break Cover changes the same physical suit before Assault",
    );
    assert.equal(pendingSuit.counters, readySuit.counters);
    const pay = state.prompt.options.find(
      (option) => option.id === String(spent),
    );
    assert.ok(pay);
    await checkpoint(
      "nick-fury-assault-threat-decision",
      width,
      source,
      initial,
    );
    await reload();
    assault = true;
    return pay;
  });
  assert.ok(
    assault,
    "The actual attack spends accumulated suit threat through Assault",
  );
  assert.equal(attacked.player.exhausted, true);
  assert.equal(
    attacked.villain.hp,
    ready.villain.hp - heroStats(ready).attack - spent,
  );
  const finalSuit = attacked.player.inPlay.find(
    (piece) => piece.id === suit.id,
  );
  assert.equal(finalSuit?.code, "50035a");
  assert.equal(finalSuit.counters, readySuit.counters - spent);
  await assertSuitVisible(finalSuit);
  return {
    action:
      "Infiltrate, Stealth activation, basic thwart/Gather Intel and Assault",
    linkedSuitId: suit.id,
    playingCards: 40,
    rawSourceCards: source.originalCodes.length,
    gatheredThreat: 1,
    assaultThreatSpent: spent,
    assaultDamage: heroStats(ready).attack + spent,
    pendingAssaultReload: true,
  };
}

// Source acceptance never inserts a fixture or changes a saved state.
async function nativeSourceFlow(source, width, initial) {
  if (source.id === "magneto") return magneticPull(source, width, initial);
  if (source.id === "nightcrawler")
    return nightcrawlerBamf(source, width, initial);
  if (source.id === "maria_hill")
    return mariaSupportStaff(source, width, initial);
  if (source.id === "nick_fury")
    return nickFurySuitFlow(source, width, initial);
  throw Error(`Unreviewed native browser flow: ${source.id}`);
}

async function publicSource(source, width) {
  current = { hero: source.id, width, stage: "public-source" };
  await open(width);
  await page
    .getByRole("button", { name: /All heroes & starter decks/ })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "All heroes & starter decks",
  });
  await dialog
    .getByRole("textbox", { name: "Search heroes and products" })
    .fill(source.name);
  const row = dialog.locator(".catalog-hero-row").filter({
    has: page.locator("b", { hasText: new RegExp(`^${source.name}$`) }),
  });
  assert.equal(
    await row.count(),
    1,
    `${source.name}: one canonical source identity`,
  );
  await row.click();
  assert.equal(
    await dialog
      .locator(`.catalog-hero-detail img[src="${imageFor(source.code)}"]`)
      .count(),
    1,
  );
  await dialog
    .getByRole("button", {
      name: `Choose ${source.name} for mission`,
      exact: true,
    })
    .click();
  assert.equal(
    await page.locator(".aspect-grid .aspect-option").count(),
    5,
    "The public lobby exposes all five playable aspects",
  );
  await page
    .getByRole("button", { name: `View ${source.deckSize}-card deck` })
    .click();
  assert.match(
    await page.locator(".deck-provenance").innerText(),
    new RegExp(`Source preconstructed list: ${source.name} Starter Deck`),
  );
  await checkpoint(`${source.id}-original-source`, width);
  await page.keyboard.press("Escape");
  await page.locator("#mission-seed").fill(String(source.seed));
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  let state = await save();
  assert.equal(state.heroId, source.id);
  assert.equal(state.aspect, source.aspect);
  assert.equal(state.villainId, "rhino");
  assert.equal(state.players.length, 1);
  assert.deepEqual(
    [...state.players[0].deckCards].sort(),
    source.originalCodes,
    "Public launcher preserves the exact immutable source map, including any setup Permanent",
  );
  assert.equal(state.player.form, "alter");
  assert.equal(state.player.hand.length, 6, "Printed opening hand size");
  const initial = snapshot(state, source);
  conserved(state, source, initial, "original mulligan");
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  current.stage = "native-setup";
  state = await finishChoices(source);
  assert.equal(state.phase, "player");
  assert.equal(state.player.form, "alter");
  assert.equal(state.player.hand.length, 6);
  assert.equal(
    await page
      .locator(
        `.identity-card img[src="${imageFor(heroRuntime(source.id).alter)}"]`,
      )
      .count(),
    1,
  );
  await checkpoint(`${source.id}-native-setup`, width, source, initial);
  await reload();
  const native = await nativeSourceFlow(source, width, initial);
  await checkpoint(`${source.id}-native-complete`, width, source, initial);
  await reload();
  conserved(
    await save(),
    source,
    initial,
    "completed native flow exact reload",
  );
  checks.push({
    hero: source.id,
    width,
    seed: source.seed,
    sourceCards: initial.sourceCards.length,
    permanentAndReserveCards: initial.extras.length,
    obligationAndNemesisCards: initial.nemeses.length,
    nativeAbility: native,
    exactReload: true,
  });
  console.log(
    `Verified original ${source.name} source, native ability, physical IDs and exact reload at ${width}px`,
  );
}
try {
  for (const width of widths)
    for (const source of Object.values(sources))
      await publicSource(source, width);
  assert.deepEqual(errors, []);
  const entryProof = [],
    styleProof = [];
  for (const [assets, proof, expected] of [
    [entryAssets, entryProof, process.env.QUADRUPLE_IMPORT_5_SHA256],
    [styleAssets, styleProof, process.env.QUADRUPLE_IMPORT_5_CSS_SHA256],
  ])
    for (const asset of assets) {
      // Use the browser's same-origin connection, including its proxy path.
      // A separate APIRequestContext can bypass that path on the live site.
      const response = await page.evaluate(async (assetUrl) => {
        const fetched = await fetch(assetUrl);
        return {
          status: fetched.status,
          body: Array.from(new Uint8Array(await fetched.arrayBuffer())),
        };
      }, asset);
      assert.equal(response.status, 200);
      const sha256 = createHash("sha256")
        .update(Buffer.from(response.body))
        .digest("hex");
      if (expected)
        assert.equal(
          sha256,
          expected,
          "Served immutable production asset SHA256",
        );
      proof.push({ url: asset, sha256 });
    }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        url,
        checks,
        audits,
        layouts,
        errors,
        entryProof,
        styleProof,
        sourceUrls: Object.fromEntries(
          Object.values(sources).map((source) => [source.id, source.sourceUrl]),
        ),
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify(
      {
        checks: checks.length,
        audits: audits.length,
        layouts: layouts.length,
        errors,
        entryProof,
        styleProof,
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      {
        message: String(error),
        stack: error.stack,
        current,
        checks,
        audits,
        layouts,
        errors,
        entryAssets: [...entryAssets],
        styleAssets: [...styleAssets],
      },
      null,
      2,
    ),
  );
  if (page) {
    await page
      .screenshot({ path: `${output}/failure.png`, fullPage: true })
      .catch(() => {});
    await save()
      .then((state) =>
        writeFile(
          `${output}/failure-save.json`,
          JSON.stringify(state, null, 2),
        ),
      )
      .catch(() => {});
    await page
      .locator("body")
      .innerText()
      .then((body) => writeFile(`${output}/failure-body.txt`, body))
      .catch(() => {});
  }
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
