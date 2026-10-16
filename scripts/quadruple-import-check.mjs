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
  process.env.QUADRUPLE_IMPORT_OUTPUT || "output/quadruple-import/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const heroes = [
  { id: "cyclops", code: "33001a", name: "Cyclops", aspect: "leadership" },
  { id: "phoenix", code: "34001a", name: "Phoenix", aspect: "justice" },
  { id: "wolverine", code: "35001a", name: "Wolverine", aspect: "aggression" },
  { id: "storm", code: "36001a", name: "Storm", aspect: "leadership" },
];
const requested = (
  process.env.QUADRUPLE_IMPORT_HEROES || heroes.map((h) => h.id).join(",")
)
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
const selected = requested.map((id) => {
  const hero = heroes.find((candidate) => candidate.id === id);
  assert.ok(hero, `Unknown quadruple-import hero: ${id}`);
  return hero;
});
const widths = (process.env.QUADRUPLE_IMPORT_VIEWPORTS || "1440,1280,390,320")
  .split(",")
  .map(Number);
assert.ok(selected.length && new Set(requested).size === requested.length);
assert.ok(
  widths.length &&
    widths.every((width) => Number.isInteger(width) && width >= 320),
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
const reversible = { "34002a": ["34002a", "34002b"] };
const sources = Object.fromEntries(
  selected.map((hero) => {
    const source = catalog.find((deck) => deck.id === `starter-${hero.code}`);
    assert.ok(source, `${hero.name}: original preconstructed source`);
    const setupCodes = expand(source.setupCards);
    const supplementaryCodes = expand(source.supplementaryCards);
    const codes = expand(source.cards).filter(
      (code) => !setupCodes.includes(code),
    );
    assert.equal(codes.length, 40, `${hero.name}: forty counted source cards`);
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

// Native metadata and stats must match the engine in the production bundle.
// This helper never creates a fixture or modifies the public browser's save.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `export {card,heroStats,imageFor} from './src/game/cards.ts';
export {heroRuntime} from './src/game/hero-runtime.ts';`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const metadataPath = resolve(output, "native-metadata.mjs");
await writeFile(metadataPath, bundle.outputFiles[0].text);
const { card, heroStats, imageFor, heroRuntime } = await import(
  pathToFileURL(metadataPath).href
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
    ...state.attachments,
    ...(state.environments || []),
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...(state.encounter.storedBoosts || []),
    ...(state.attack?.pendingBoosts || []),
    ...(state.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function extraFaces(source) {
  return source.extraCodes.flatMap((code) => reversible[code] || [code]);
}
function isDeckPiece(piece, source) {
  const definition = card(piece);
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
    `${source.name}: exact forty-card original source`,
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
  return { sourceCards, extras, encounter, nemeses };
}
function conserved(state, source, initial, label) {
  const pieces = allPieces(state);
  assert.equal(initial.sourceCards.length, 40);
  assert.deepEqual(
    pieces
      .filter((piece) => isDeckPiece(piece, source))
      .map((piece) => piece.id)
      .sort(),
    initial.sourceCards.map((piece) => piece.id).sort(),
    `${label}: forty original physical IDs`,
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
  }
  const drawZones = [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
  ];
  assert.ok(
    drawZones.every((piece) => !extraFaces(source).includes(piece.code)),
    `${label}: Permanents and weather reserves stay outside the draw pile`,
  );
  if (state.phase === "player") {
    for (const code of source.setupCodes)
      assert.equal(
        state.player.inPlay.filter((piece) =>
          (reversible[code] || [code]).includes(piece.code),
        ).length,
        1,
        `${label}: original Permanent enters play`,
      );
    if (source.id === "storm") {
      assert.equal(
        state.player.inPlay.filter((piece) =>
          source.supplementaryCodes.includes(piece.code),
        ).length,
        1,
        `${label}: one active weather card`,
      );
      assert.equal(
        state.player.setAside.filter((piece) =>
          source.supplementaryCodes.includes(piece.code),
        ).length,
        3,
        `${label}: three physical weather reserves`,
      );
    }
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
  if (process.env.QUADRUPLE_IMPORT_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.QUADRUPLE_IMPORT_ASSET),
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
async function finishChoices(source, setup = false) {
  for (let attempt = 0; attempt < 30; attempt++) {
    const state = await settle();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    // Clear Skies avoids changing basic attack values or adding retaliate to
    // Rhino. The choice must be offered by Storm's actual printed setup.
    const weather =
      setup && source.id === "storm"
        ? state.prompt.options.find(
            (option) =>
              option.image === "36002" || /clear skies/i.test(option.label),
          )
        : null;
    const option =
      weather ||
      state.prompt.options.find((candidate) =>
        /^(pass|skip|none|done|continue|no)$/.test(candidate.id),
      ) ||
      (state.prompt.options.length === 1 ? state.prompt.options[0] : null);
    assert.ok(
      option,
      `Unreviewed native ${setup ? "setup" : "action"} choice: ${JSON.stringify(state.prompt)}`,
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
        ".flip-button, .hero-actions button, .in-play-actions button, .identity-card .ability-button",
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
  await page.getByRole("button", { name: /View 40-card deck/ }).click();
  assert.match(
    await page.locator(".deck-provenance").innerText(),
    new RegExp(`Source preconstructed list: ${source.name} Starter Deck`),
  );
  await checkpoint(`${source.id}-original-source`, width);
  await page.keyboard.press("Escape");
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
    "Public source launcher preserves exact printed card quantities",
  );
  assert.equal(state.player.form, "alter");
  assert.equal(state.player.hand.length, 6, "Printed opening hand size");
  const initial = snapshot(state, source);
  conserved(state, source, initial, "original mulligan");

  current.stage = "native-setup";
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  state = await finishChoices(source, true);
  assert.equal(state.phase, "player");
  assert.equal(state.player.form, "alter");
  assert.equal(
    state.player.hand.length,
    6,
    "Setup does not draw cards or resolve weather specials",
  );
  if (source.id === "phoenix") {
    const force = state.player.inPlay.find((piece) => piece.code === "34002a");
    assert.ok(force, "Phoenix Force starts Restrained");
    assert.equal(
      force.counters,
      4,
      "Phoenix Force starts with four power counters",
    );
  }
  if (source.id === "storm")
    assert.ok(
      state.player.inPlay.some((piece) => piece.code === "36002"),
      "Actual Clear Skies setup choice enters play",
    );
  await checkpoint(`${source.id}-native-setup`, width, source, initial);
  await reload();

  current.stage = "hero-form";
  await page.locator(".flip-button").click();
  state = await finishChoices(source);
  assert.equal(state.player.form, "hero");
  assert.equal(state.player.flipped, true);
  assert.equal(
    state.player.exhausted,
    false,
    "Changing form leaves the hero ready",
  );
  await checkpoint(`${source.id}-hero-form`, width, source, initial);
  const expectedDamage = heroStats(state).attack;
  const beforeHp = state.villain.hp;
  assert.ok(expectedDamage > 0 && beforeHp > expectedDamage);

  current.stage = "basic-attack";
  await page.locator(".attack-action").click();
  state = await finishChoices(source);
  assert.equal(
    state.player.exhausted,
    true,
    "Actual native basic attack exhausts the hero",
  );
  assert.equal(
    state.villain.hp,
    beforeHp - expectedDamage,
    "Actual basic attack deals native ATK to Rhino",
  );
  assert.equal(state.phase, "player");
  await checkpoint(`${source.id}-basic-attack`, width, source, initial);
  await reload();
  conserved(await save(), source, initial, "completed attack reload");
  checks.push({
    hero: source.id,
    width,
    sourceCards: initial.sourceCards.length,
    permanentAndReserveCards: initial.extras.length,
    obligationAndNemesisCards: initial.nemeses.length,
    basicAttackDamage: expectedDamage,
    exactReload: true,
  });
  console.log(
    `Verified original ${source.name} source, setup and basic attack at ${width}px`,
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
    [entryAssets, entryProof, process.env.QUADRUPLE_IMPORT_SHA256],
    [styleAssets, styleProof, process.env.QUADRUPLE_IMPORT_CSS_SHA256],
  ])
    for (const asset of assets) {
      const response = await context.request.get(asset);
      assert.equal(response.status(), 200);
      const sha256 = createHash("sha256")
        .update(await response.body())
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
