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
).find((deck) => deck.id === "starter-15001a");
const sourceCodes = Object.entries(sourceDeck.cards)
  .flatMap(([code, count]) => Array(count).fill(code))
  .sort();
const output = "output/scarlet-witch";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture(kind='hex') {
        let s=newGame({heroId:'scw',aspect:'justice',villainId:'rhino',heroes:[{heroId:'scw',aspect:'justice',deckCards:heroStarterCodes('scw')}],seed:15001,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        s.player.form=['siblings','magic'].includes(kind)?'alter':'hero';s.player.hp=7;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];
          }
          throw Error('Missing physical source card '+code);
        }
        function hand(codes) {
          const pieces=codes.map(take);s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;
        }
        function encounterTop(codes) {
          const pieces=codes.map(code=>{
            const index=s.encounter.deck.findIndex(p=>p.code===code);if(index<0)throw Error('Missing physical encounter '+code);
            return s.encounter.deck.splice(index,1)[0];
          });
          s.encounter.deck.unshift(...pieces);return pieces;
        }
        let ids={};
        if(kind==='siblings') {
          const quicksilver=take('15002');s.player.inPlay.push(quicksilver);
          const [hex,decay,genius]=hand(['15004','15005','15021']);
          ids={hexId:hex.id,decayId:decay.id,geniusId:genius.id,quicksilverId:quicksilver.id};
        } else if(kind==='hex') {
          const crest=take('15009');s.player.inPlay.push(crest);
          const [hex,energy]=hand(['15004','15020']);
          const encounters=encounterTop(['01105','01110','01102','01111']);
          const sideIndex=s.encounter.deck.findIndex(p=>p.code==='01107');if(sideIndex<0)throw Error('Missing Rhino side scheme');
          const side=s.encounter.deck.splice(sideIndex,1)[0];side.counters=3;s.sideSchemes.push(side);
          ids={hexId:hex.id,energyId:energy.id,crestId:crest.id,discardedIds:encounters.slice(0,3).map(p=>p.id),replacementId:encounters[3].id};
        } else if(kind==='magic') {
          const agatha=take('15007');s.player.inPlay.push(agatha);
          const [magic,genius]=hand(['15003','15021']);
          const top=[take('15010'),take('15004'),take('15019')];s.player.deck.unshift(...top);
          ids={agathaId:agatha.id,magicId:magic.id,geniusId:genius.id,freeId:top[0].id,bottomIds:top.slice(1).map(p=>p.id),discardedIds:s.encounter.deck.slice(0,4).map(p=>p.id)};
        } else if(kind==='warp') {
          const [warp,strength]=hand(['15006','15022']);
          const encounters=encounterTop(['01106','01102']);
          s.phase='villain';
          s.prompt={kind:'choice',title:'Reveal the encounter card',text:'Reveal the actual top encounter card through native interrupts.',options:[{id:'reveal',label:'Reveal Stampede',effects:[{type:'revealNext'}]}]};
          ids={warpId:warp.id,strengthId:strength.id,revealedId:encounters[0].id,discardedId:encounters[1].id};
        } else if(kind==='shield') {
          const shield=take('15008');s.player.inPlay.push(shield);
          const quicksilver=take('15002');quicksilver.exhausted=true;s.player.inPlay.push(quicksilver);
          hand(['15021']);
          s.prompt={kind:'choice',title:'Resolve incoming damage',text:'Scarlet Witch takes damage through the native damage interrupt window.',options:[{id:'damage',label:'Deal 4 damage to Scarlet Witch',effects:[{type:'damage',target:'hero',amount:4,source:s.villain.id}]}]};
          ids={shieldId:shield.id,quicksilverId:quicksilver.id};
        }
        return {state:s,...ids};
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
      if (sessionStorage.getItem("scarlet-witch-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("scarlet-witch-fixture-loaded", "yes");
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
function physicalPieces(state) {
  const zones = [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
    ...state.player.inPlay,
    ...state.resolving.filter((p) => /^15/.test(p.code)),
  ];
  const zoneIds = new Set(zones.map((p) => p.id));
  assert.equal(
    zoneIds.size,
    zones.length,
    "Actual player zones contain each physical card once",
  );
  // Agatha holds the two remaining actual cards in her saved bottom-order
  // continuation. Each choice carries the same snapshot of that holding area.
  const held = new Map();
  const pending = [
    ...state.queue,
    ...(state.prompt?.options || []).flatMap((o) => o.effects || []),
  ];
  for (const effect of pending) {
    if (!["scw:agatha-bottom", "scw:agatha-order"].includes(effect.type))
      continue;
    for (const piece of effect.pieces || []) {
      assert.ok(
        !zoneIds.has(piece.id),
        "Agatha's held card is absent from all ordinary player zones",
      );
      if (held.has(piece.id))
        assert.deepEqual(
          held.get(piece.id),
          piece,
          "Agatha choice snapshots agree on each held physical card",
        );
      else held.set(piece.id, piece);
    }
  }
  return [...zones, ...held.values()];
}
function physicalCards(state) {
  return physicalPieces(state)
    .map((p) => p.id)
    .sort();
}
function conserved(state, expected, message) {
  const pieces = physicalPieces(state);
  assert.equal(pieces.length, 40, `${message}: all 40 physical source cards`);
  assert.deepEqual(
    pieces.map((p) => p.code).sort(),
    sourceCodes,
    `${message}: exact source printing quantities`,
  );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    expected,
    `${message}: physical instances conserved`,
  );
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
async function play(name) {
  await page
    .getByRole("button", { name: "Play now: " + name, exact: true })
    .first()
    .click();
  return settle();
}
async function payWith(names) {
  assert.equal((await save()).prompt?.kind, "payment");
  for (const name of names)
    await page
      .locator(".payment-source")
      .filter({
        has: page.locator("b", { hasText: new RegExp("^" + name + "$") }),
      })
      .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  return settle();
}
async function checkpoint(name, width, physical) {
  conserved(await save(), physical, name);
  await fit(name, width);
  await audit(name + " " + width);
}

async function selectCards(ids) {
  assert.equal((await save()).prompt?.kind, "select");
  for (const id of ids) {
    const index = (await save()).prompt.options.findIndex((o) => o.id === id);
    assert.ok(index >= 0, `Physical selection ${id} available`);
    await page.locator(".decision-option").nth(index).click();
  }
  await page
    .getByRole("button", { name: "Confirm selection", exact: true })
    .click();
  return settle();
}
async function continueCounts() {
  for (let i = 0; i < 8; i++) {
    const state = await save();
    if (
      state.prompt?.kind !== "choice" ||
      !state.prompt.options.some((o) => o.id === "continue")
    )
      return state;
    await choice("continue");
  }
  throw Error("Boost count interrupts did not settle");
}

try {
  let state;
  if (!process.env.SCARLET_WITCH_FIXTURE_ONLY) {
    await open();
    await page
      .getByRole("button", { name: /All heroes & starter decks/ })
      .click();
    const catalog = page.getByRole("dialog", {
      name: "All heroes & starter decks",
    });
    await catalog
      .getByRole("textbox", { name: "Search heroes and products" })
      .fill("Scarlet Witch");
    await catalog
      .locator(".catalog-hero-row")
      .filter({ has: page.locator("b", { hasText: /^Scarlet Witch$/ }) })
      .first()
      .click();
    await catalog
      .locator(".catalog-hero-detail")
      .getByRole("button", {
        name: "Choose Scarlet Witch for mission",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: /View 40-card deck/ }).click();
    assert.match(
      await page.locator(".deck-provenance").innerText(),
      /Source preconstructed list: Scarlet Witch Starter Deck/,
    );
    await capture("source-deck");
    await audit("Scarlet Witch source starter deck");
    await page.keyboard.press("Escape");
    await page.locator("#start-btn").click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    state = await save();
    assert.equal(state.heroId, "scw");
    assert.equal(state.players[0].deckCards.length, 40);
    assert.deepEqual([...state.players[0].deckCards].sort(), sourceCodes);
    assert.equal(state.player.form, "alter");
    const sourcePhysical = physicalCards(state);
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    await settle();
    for (const width of [1440, 1280, 390, 320])
      await checkpoint("source-board", width, sourcePhysical);
    await reload();
    checks.push(
      "Catalog launches exact Scarlet Witch source 40-card Justice starter with original printing IDs and Wanda alter-ego saved state",
    );
  }
  for (const width of (
    process.env.SCARLET_WITCH_VIEWPORTS || "1440,1280,390,320"
  )
    .split(",")
    .map(Number)) {
    const scenarios = (
      process.env.SCARLET_WITCH_SCENARIOS || "siblings,hex,magic,warp,shield"
    ).split(",");
    if (scenarios.includes("siblings")) {
      const f = fixture("siblings");
      await open(f.state, width);
      const physical = physicalCards(await save());
      const initialHand = (await save()).player.hand.map((p) => p.id);
      await page.getByRole("button", { name: /Superpowered Siblings/ }).click();
      state = await settle();
      assert.equal(state.prompt?.kind, "select");
      assert.equal(state.prompt.min, 2);
      assert.equal(state.prompt.max, 2);
      assert.equal(state.prompt.cancelable, true);
      await checkpoint("siblings-physical-cost", width, physical);
      await reload();
      await page.keyboard.press("Escape");
      state = await settle();
      assert.equal(state.prompt, null);
      assert.deepEqual(
        state.player.hand.map((p) => p.id),
        initialHand,
      );
      assert.notEqual(state.flags.scwSiblingsRound, state.round);
      await page.getByRole("button", { name: /Superpowered Siblings/ }).click();
      await settle();
      await selectCards([f.hexId, f.decayId]);
      state = await skipAll();
      assert.equal(
        state.player.hand.length,
        initialHand.length + 1,
        "Pietro ally enables draw three after paying two actual cards",
      );
      assert.equal(state.flags.scwSiblingsRound, state.round);
      for (const id of [f.hexId, f.decayId])
        assert.equal(state.player.discard.filter((p) => p.id === id).length, 1);
      assert.ok(state.player.hand.some((p) => p.id === f.geniusId));
      await checkpoint("siblings-after-draw", width, physical);
      await reload();
      console.log(`Verified siblings native browser flow at ${width}px`);
    }
    if (scenarios.includes("hex")) {
      const f = fixture("hex");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Hex Bolt");
      await checkpoint("hex-bolt-payment", width, physical);
      await reload();
      await payWith(["Energy"]);
      state = await findChoice(
        (o) => o.id === "chaos:p1",
        "Chaos Control actual replacement",
      );
      for (const id of f.discardedIds)
        assert.equal(
          state.encounter.discard.filter((p) => p.id === id).length,
          1,
        );
      await checkpoint("hex-bolt-discard-count", width, physical);
      await reload();
      await choice("chaos:p1");
      state = await findChoice(
        (o) => o.id === `crest:${f.crestId}:+1`,
        "Crest count modifier",
      );
      assert.equal(
        state.encounter.discard.filter((p) => p.id === f.replacementId).length,
        1,
      );
      await checkpoint("crest-count-modifier", width, physical);
      await reload();
      await choice(`crest:${f.crestId}:+1`);
      await continueCounts();
      state = await findChoice(
        (o) => o.id === "2",
        "Hex Bolt player-selected resolution order",
      );
      await checkpoint("hex-bolt-resolution-order", width, physical);
      await reload();
      await choice("2");
      assert.equal(
        (await save()).player.hand.length,
        1,
        "Chosen two-icon result draws before the other cards resolve",
      );
      await findChoice((o) => o.id === "0", "Hex Bolt remaining status result");
      await choice("0");
      await findChoice(
        (o) => o.id === `${f.state.villain.id}:stunned`,
        "Hex Bolt actual character status",
      );
      await checkpoint("hex-bolt-status-target", width, physical);
      await reload();
      await choice(`${f.state.villain.id}:stunned`);
      await findChoice((o) => o.id === "main", "Hex Bolt scheme target");
      await choice("main");
      state = await skipAll();
      assert.equal(state.villain.stunned, true);
      assert.equal(state.scheme.threat, 4);
      assert.equal(state.player.hand.length, 1);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.crestId).exhausted,
        true,
      );
      assert.equal(state.flags.scwChaosControlPhase, `${state.round}:player`);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.hexId).length,
        1,
      );
      await checkpoint("hex-bolt-after-three-results", width, physical);
      await reload();
      console.log(`Verified hex native browser flow at ${width}px`);
    }
    if (scenarios.includes("magic")) {
      const f = fixture("magic");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page
        .getByRole("button", { name: /Agatha Harkness/ })
        .filter({ hasText: /look|top|action|exhaust/i })
        .first()
        .click();
      await settle();
      await findChoice(
        (o) => o.id === f.freeId,
        "Agatha actual top three selection",
      );
      await checkpoint("agatha-top-three", width, physical);
      await reload();
      await choice(f.freeId);
      await findChoice((o) => o.id === f.bottomIds[1], "Agatha bottom order");
      await checkpoint("agatha-bottom-order", width, physical);
      await reload();
      await choice(f.bottomIds[1]);
      state = await save();
      if (state.prompt?.options.some((o) => o.id === f.bottomIds[0]))
        await choice(f.bottomIds[0]);
      state = await skipAll();
      assert.deepEqual(
        state.player.deck.slice(-2).map((p) => p.id),
        [f.bottomIds[1], f.bottomIds[0]],
      );
      assert.ok(state.player.hand.some((p) => p.id === f.freeId));
      await page.locator(".flip-button").click();
      await settle();
      await play("Chaos Magic");
      await findChoice((o) => o.id === f.freeId, "Chaos Magic free hand card");
      await checkpoint("chaos-magic-hand-choice", width, physical);
      await reload();
      await choice(f.freeId);
      state = await skipAll();
      assert.ok(state.player.inPlay.some((p) => p.id === f.freeId));
      assert.ok(
        state.player.hand.some((p) => p.id === f.geniusId),
        "Ignoring printed cost preserves payment resource",
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.magicId).length,
        1,
      );
      for (const id of f.discardedIds)
        assert.equal(
          state.encounter.discard.filter((p) => p.id === id).length,
          1,
        );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.agathaId).exhausted,
        true,
      );
      await checkpoint("chaos-magic-after-free-play", width, physical);
      await reload();
      console.log(`Verified magic native browser flow at ${width}px`);
    }
    if (scenarios.includes("warp")) {
      const f = fixture("warp");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("reveal");
      await findChoice(
        (o) => o.id === f.warpId || o.id.endsWith(":" + f.warpId),
        "Warp Reality encounter cancellation",
      );
      await checkpoint("warp-reality-interrupt", width, physical);
      await reload();
      await choice(
        (await save()).prompt.options.find(
          (o) => o.id === f.warpId || o.id.endsWith(":" + f.warpId),
        ).id,
      );
      state = await save();
      assert.equal(state.prompt?.kind, "payment");
      assert.equal(state.prompt.cost, 1);
      await checkpoint("warp-reality-physical-payment", width, physical);
      await reload();
      await payWith(["Strength"]);
      state = await skipAll();
      assert.equal(
        state.player.hp,
        7,
        "Cancelling Stampede prevents its attack",
      );
      assert.equal(!!state.player.stunned, false);
      for (const id of [f.revealedId, f.discardedId])
        assert.equal(
          state.encounter.discard.filter((p) => p.id === id).length,
          1,
        );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.warpId).length,
        1,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.strengthId).length,
        1,
      );
      await checkpoint("warp-reality-after-cancel", width, physical);
      await reload();
      console.log(`Verified warp native browser flow at ${width}px`);
    }
    if (scenarios.includes("shield")) {
      const f = fixture("shield");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("damage");
      await findChoice(
        (o) => o.id === f.shieldId || o.id.endsWith(":" + f.shieldId),
        "Magic Shield actual upgrade interrupt",
      );
      await checkpoint("magic-shield-damage-interrupt", width, physical);
      await reload();
      await choice(
        (await save()).prompt.options.find(
          (o) => o.id === f.shieldId || o.id.endsWith(":" + f.shieldId),
        ).id,
      );
      state = await skipAll();
      assert.equal(state.player.hp, 6);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.shieldId).length,
        1,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.quicksilverId).exhausted,
        true,
      );
      await page.getByRole("button", { name: /Ready Quicksilver/ }).click();
      state = await settle();
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.quicksilverId).exhausted,
        false,
      );
      await checkpoint("magic-shield-quicksilver-after", width, physical);
      await reload();
      console.log(`Verified shield native browser flow at ${width}px`);
    }
    checks.push(
      `At ${width}px native ${scenarios.join(", ")} interactions conserve all 40 source cards across reload`,
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
    JSON.stringify(
      { checks, audits: audits.length, layouts: layouts.length, errors },
      null,
      2,
    ),
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
