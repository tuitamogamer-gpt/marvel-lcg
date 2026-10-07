import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const sourceDeck = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-decks.json", import.meta.url),
    "utf8",
  ),
).find((deck) => deck.id === "starter-13001a");
const sourceCodes = Object.entries(sourceDeck.cards)
  .flatMap(([code, count]) => Array(count).fill(code))
  .sort();
const output = "output/wasp";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture(kind='forms') {
        let s=newGame({heroId:'wsp',aspect:'aggression',villainId:'rhino',heroes:[{heroId:'wsp',aspect:'aggression',deckCards:heroStarterCodes('wsp')}],seed:13001,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        s.player.form=kind==='nadia'?'alter':'hero';s.player.heroForm=kind==='split'?'giant':'tiny';s.player.hp=7;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];
          }
          throw Error('Missing physical source card '+code);
        }
        function encounter(code) {
          const i=s.encounter.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing physical encounter '+code);
          return s.encounter.deck.splice(i,1)[0];
        }
        const helmet=take('13010'),growth=take('13005'),energy=take('13021');
        const help=take('13003'),strike=take('13004'),ironheart=take('13018'),swarm=take('13020');
        s.player.inPlay.push(helmet);
        s.player.deck.push(...s.player.hand);s.player.hand=[growth,energy,ironheart,swarm];
        s.player.discard.push(help,strike);
        let sideId,minionId;
        if(kind==='split'||kind==='growth') {
          const side=encounter('01107');side.counters=3;s.sideSchemes.push(side);sideId=side.id;
        }
        if(kind==='tiny') {
          const minion=encounter('01110');minion.engagedWith=s.activePlayerId;s.minions.push(minion);minionId=minion.id;
        }
        return {state:s,helmetId:helmet.id,growthId:growth.id,energyId:energy.id,helpId:help.id,strikeId:strike.id,sideId,minionId};
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

const browser = await chromium.launch({ headless: true });
const require = createRequire(import.meta.url);
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
let context, page;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
const textState = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

async function open(state, width = 1440) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width > 1000 ? 1000 : 844 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  if (state)
    await page.addInitScript((saved) => {
      if (sessionStorage.getItem("wasp-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("wasp-fixture-loaded", "yes");
    }, state);
  await page.goto(url);
  if (state) await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function settle() {
  for (let i = 0; i < 80; i++) {
    const state = await save();
    assert.ok(!state.error, state.error);
    if (!state.review) return state;
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  }
  throw Error("Review queue did not settle");
}
async function choice(id) {
  const state = await save();
  assert.equal(state.prompt?.kind, "choice");
  const index = state.prompt.options.findIndex((option) => option.id === id);
  assert.ok(index >= 0, `${state.prompt.title}: missing ${id}`);
  await page.locator(".decision-option").nth(index).click();
  return settle();
}
async function skip() {
  const state = await save();
  assert.equal(state.prompt?.kind, "choice");
  const option = state.prompt.options.find((o) =>
    /^(skip|pass|none|done|continue|no)$/.test(o.id),
  );
  assert.ok(option, JSON.stringify(state.prompt));
  return choice(option.id);
}
async function skipAll() {
  for (let i = 0; i < 20 && (await save()).prompt; i++) await skip();
  assert.equal((await save()).prompt, null);
  return save();
}
async function respond(title) {
  for (let i = 0; i < 12; i++) {
    const state = await save();
    assert.equal(state.prompt?.kind, "choice");
    const selected = state.prompt.options.find((option) =>
      title.test(option.label),
    );
    if (selected) return choice(selected.id);
    if (
      title.test(state.prompt.title) &&
      state.prompt.options.some((option) => option.id === "yes")
    )
      return choice("yes");
    await skip();
  }
  throw Error(`Response ${title} missing`);
}
async function pay() {
  assert.equal((await save()).prompt?.kind, "payment");
  await page
    .getByRole("button", { name: "Suggest resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  return settle();
}
async function reload() {
  const before = await save();
  await writeFile(
    `${output}/reload-before.json`,
    JSON.stringify(before, null, 2),
  );
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await save(),
    before,
    "Pending native choice and physical cards survive reload exactly",
  );
}
async function capture(name) {
  await page.locator(".combat-cinematic").waitFor({ state: "hidden" });
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
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
async function fit(name, width) {
  await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
      (dialog) => ({ width: dialog.clientWidth, content: dialog.scrollWidth }),
    ),
    formControls: [...document.querySelectorAll(".flip-button")].map(
      (button) => {
        const rect = button.getBoundingClientRect();
        const table = button.closest(".physical-table").getBoundingClientRect();
        return { left: rect.left, right: rect.right, tableRight: table.right };
      },
    ),
  }));
  layouts.push({ name, ...metrics });
  await capture(`${name}-${width}`);
  assert.ok(metrics.document <= width + 1, `${name}: page overflow`);
  assert.ok(
    metrics.dialogs.every((dialog) => dialog.content <= dialog.width + 1),
    `${name}: dialog overflow ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    metrics.formControls.every(
      (button) =>
        button.left >= 0 &&
        button.right <= Math.min(width, button.tableRight) + 1,
    ),
    `${name}: form control clipped ${JSON.stringify(metrics.formControls)}`,
  );
}
async function audit(name) {
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
      nodes: v.nodes.map((node) => ({
        target: node.target,
        message: node.failureSummary,
      })),
    })),
  });
}
function physicalCards(state) {
  return [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
    ...state.player.inPlay,
    ...state.resolving.filter((p) => /^13/.test(p.code)),
  ]
    .map((p) => p.id)
    .sort();
}

function conserved(state, expected, message) {
  const cards = physicalCards(state);
  assert.equal(cards.length, 40, `${message}: all 40 physical source cards`);
  assert.deepEqual(
    [
      ...state.player.hand,
      ...state.player.deck,
      ...state.player.discard,
      ...state.player.inPlay,
      ...state.resolving.filter((p) => /^13/.test(p.code)),
    ]
      .map((p) => p.code)
      .sort(),
    sourceCodes,
    `${message}: exact source printing quantities`,
  );
  assert.deepEqual(cards, expected, `${message}: physical instances conserved`);
}
async function findChoice(predicate, label) {
  for (let i = 0; i < 12; i++) {
    const state = await save();
    assert.equal(
      state.prompt?.kind,
      "choice",
      `${label}: native choice missing`,
    );
    if (state.prompt.options.some(predicate)) return state;
    await skip();
  }
  throw Error(`${label}: choice missing`);
}
async function allocate(id, amount) {
  await findChoice(
    (option) => option.id === `${id}:${amount}`,
    "Split allocation",
  );
  return choice(`${id}:${amount}`);
}

try {
  let state;
  if (!process.env.WASP_FIXTURE_ONLY) {
    await open();
    await page
      .getByRole("button", { name: /All heroes & starter decks/ })
      .click();
    const catalog = page.getByRole("dialog", {
      name: "All heroes & starter decks",
    });
    await catalog
      .getByRole("textbox", { name: "Search heroes and products" })
      .fill("Wasp");
    await catalog
      .locator(".catalog-hero-row")
      .filter({ has: page.locator("b", { hasText: /^Wasp$/ }) })
      .first()
      .click();
    await catalog
      .locator(".catalog-hero-detail")
      .getByRole("button", { name: "Choose Wasp for mission", exact: true })
      .click();
    await page.getByRole("button", { name: /View 40-card deck/ }).click();
    assert.match(
      await page.locator(".deck-provenance").innerText(),
      /Source preconstructed list: Wasp Starter Deck/,
    );
    await capture("source-deck");
    await audit("Wasp source starter deck");
    await page.keyboard.press("Escape");
    await page.locator("#start-btn").click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    state = await save();
    assert.equal(state.heroId, "wsp");
    assert.equal(state.players[0].deckCards.length, 40);
    assert.deepEqual([...state.players[0].deckCards].sort(), sourceCodes);
    assert.equal(state.player.form, "alter");
    const sourcePhysical = physicalCards(state);
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    state = await settle();
    conserved(state, sourcePhysical, "Source mission launch");
    for (const width of [1440, 1280, 390, 320]) {
      await fit("source-board", width);
      await audit(`Source board ${width}`);
    }
    await reload();
    checks.push(
      "Catalog selection launches exact Wasp source 40-card Aggression starter with original printing IDs and saves Nadia alter-ego form",
    );
  }

  for (const width of (process.env.WASP_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number)) {
    const forms = fixture("forms");
    await open(forms.state, width);
    const physical = physicalCards(await save());
    conserved(await save(), physical, "Three-form fixture");
    await page.locator(".flip-button").click();
    state = await settle();
    assert.equal(state.prompt.title, "Change form");
    assert.deepEqual(state.prompt.options.map((o) => o.id).sort(), [
      "alter",
      "giant",
    ]);
    await fit("form-choice", width);
    await audit(`Form choice ${width}`);
    await reload();
    await page.keyboard.press("Escape");
    state = await settle();
    assert.equal(state.player.heroForm, "tiny");
    assert.equal(state.player.flipped, false);
    await page.locator(".flip-button").click();
    await settle();
    await choice("giant");
    state = await skipAll();
    assert.equal(state.player.form, "hero");
    assert.equal(state.player.heroForm, "giant");
    assert.equal(state.player.flipped, true);
    const publicState = await textState();
    assert.equal(publicState.form, "hero");
    assert.equal(publicState.heroForm, "giant");
    assert.equal(publicState.stats.attack, 2);
    assert.equal(publicState.stats.thwart, 3);
    assert.equal(publicState.stats.defense, 3);
    conserved(state, physical, "Native Tiny to Giant form change");
    await fit("giant-board", width);
    await audit(`Giant board ${width}`);
    await reload();

    const nadia = fixture("nadia");
    await open(nadia.state, width);
    const nadiaPhysical = physicalCards(await save());
    await page.locator(".flip-button").click();
    state = await settle();
    assert.deepEqual(state.prompt.options.map((o) => o.id).sort(), [
      "giant",
      "tiny",
    ]);
    await page.keyboard.press("Escape");
    await settle();
    const handBefore = (await save()).player.hand.map((p) => p.id);
    await page.getByRole("button", { name: /G\.I\.R\.L\./ }).click();
    state = await settle();
    assert.equal(state.prompt?.kind, "select");
    assert.ok(
      state.prompt.options.some((option) => option.id === nadia.helpId),
    );
    assert.ok(
      state.prompt.options.some((option) => option.id === nadia.strikeId),
    );
    await fit("nadia-choice", width);
    await audit(`Nadia G.I.R.L. ${width}`);
    await reload();
    state = await save();
    for (const id of [nadia.helpId, nadia.strikeId]) {
      const index = state.prompt.options.findIndex(
        (option) => option.id === id,
      );
      await page.locator(".decision-option").nth(index).click();
    }
    await page
      .getByRole("button", { name: "Confirm selection", exact: true })
      .click();
    state = await settle();
    state = await skipAll();
    assert.ok(state.player.deck.some((p) => p.id === nadia.helpId));
    assert.ok(state.player.deck.some((p) => p.id === nadia.strikeId));
    assert.equal(state.player.discard.length, 0);
    assert.equal(state.flags.waspGirlRound, state.round);
    assert.deepEqual(
      state.player.hand.map((p) => p.id),
      handBefore,
    );
    conserved(state, nadiaPhysical, "Nadia native shuffle action");
    await fit("nadia-after-shuffle", width);
    await audit(`Nadia after shuffle ${width}`);
    await reload();

    const split = fixture("split");
    await open(split.state, width);
    const splitPhysical = physicalCards(await save());
    await page.locator(".thwart-action").click();
    await settle();
    await findChoice((option) => option.id === "main:1", "Giant basic thwart");
    await fit("giant-split", width);
    await audit(`Giant split allocation ${width}`);
    await reload();
    state = await allocate("main", 1);
    state = await skipAll();
    assert.equal(state.scheme.threat, 5);
    assert.equal(
      state.sideSchemes.find((p) => p.id === split.sideId).counters,
      1,
    );
    assert.equal(state.player.exhausted, true);
    assert.equal(state.villain.hp, 40);
    conserved(state, splitPhysical, "Giant divided basic thwart");
    await fit("giant-after-split", width);
    await audit(`Giant after split ${width}`);
    await reload();

    const growth = fixture("growth");
    await open(growth.state, width);
    const growthPhysical = physicalCards(await save());
    await page.locator(".thwart-action").click();
    await settle();
    state = await respond(/Rapid Growth/);
    assert.equal(state.prompt?.kind, "payment");
    assert.equal(state.prompt.cost, 1);
    await fit("rapid-growth-payment", width);
    await audit(`Rapid Growth payment ${width}`);
    await reload();
    state = await pay();
    assert.equal(state.player.heroForm, "giant");
    await findChoice(
      (option) => option.id === `${growth.sideId}:3`,
      "Rapid Growth boosted basic thwart",
    );
    await fit("rapid-growth-split", width);
    await audit(`Rapid Growth boosted split ${width}`);
    await reload();
    state = await allocate(growth.sideId, 3);
    state = await skipAll();
    assert.equal(state.scheme.threat, 4);
    assert.ok(!state.sideSchemes.some((p) => p.id === growth.sideId));
    assert.equal(state.player.exhausted, true);
    assert.equal(
      state.player.flipped,
      false,
      "Rapid Growth preserves voluntary form change",
    );
    assert.equal(
      state.villain.hp,
      40,
      "Giant defeat does not offer Tiny response",
    );
    assert.equal(
      state.player.discard.filter((p) => p.id === growth.growthId).length,
      1,
    );
    conserved(
      state,
      growthPhysical,
      "Rapid Growth payment and divided basic thwart",
    );
    await fit("rapid-growth-after", width);
    await audit(`Rapid Growth after payment ${width}`);
    await reload();

    const tiny = fixture("tiny");
    await open(tiny.state, width);
    const tinyPhysical = physicalCards(await save());
    await page.locator(".attack-action").click();
    await settle();
    await findChoice(
      (option) => option.id === tiny.minionId,
      "Tiny attack target",
    );
    state = await choice(tiny.minionId);
    assert.equal(state.prompt?.kind, "choice");
    assert.ok(
      /Small but Mighty/.test(state.prompt.title) ||
        state.prompt.options.some((option) =>
          /Small but Mighty/.test(option.label),
        ),
    );
    await fit("tiny-defeat-response", width);
    await audit(`Tiny defeat response ${width}`);
    await reload();
    state = await respond(/Small but Mighty/);
    state = await skipAll();
    assert.ok(!state.minions.some((p) => p.id === tiny.minionId));
    assert.equal(
      state.encounter.discard.filter((p) => p.id === tiny.minionId).length,
      1,
    );
    assert.equal(state.villain.hp, 39);
    assert.equal(state.player.heroForm, "tiny");
    conserved(state, tinyPhysical, "Tiny defeat response");
    await fit("tiny-after-defeat", width);
    await audit(`Tiny after defeat ${width}`);
    await reload();
    checks.push(
      `At ${width}px native three-form choice/cancel/reload, Nadia shuffle, Giant split thwart, reloaded Rapid Growth payment and boosted split, and Tiny defeat response conserve all 40 source cards`,
    );
  }
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((result) => result.violations.length === 0),
    JSON.stringify(audits),
  );
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, audits, layouts, errors }, null, 2),
  );
  await Promise.all(
    [
      "failure.json",
      "failure.png",
      "failure-body.txt",
      "failure-save.json",
      "failure-diagnostic.txt",
      "reload-before.json",
    ].map((name) => rm(`${output}/${name}`, { force: true })),
  );
  console.log(
    JSON.stringify({ checks, audits: audits.length, layouts, errors }, null, 2),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      { message: String(error), checks, audits, layouts, errors },
      null,
      2,
    ),
  );
  try {
    await page.screenshot({
      path: `${output}/failure.png`,
      fullPage: true,
      timeout: 5000,
    });
    await writeFile(
      `${output}/failure-body.txt`,
      await page.locator("body").innerText({ timeout: 5000 }),
    );
    const saved = await Promise.race([
      save(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(Error("Saved-state diagnostic timed out")),
          5000,
        ),
      ),
    ]);
    await writeFile(
      `${output}/failure-save.json`,
      JSON.stringify(saved, null, 2),
    );
  } catch (diagnosticError) {
    await writeFile(
      `${output}/failure-diagnostic.txt`,
      String(diagnosticError),
    );
  }
  throw error;
} finally {
  await browser.close();
}
