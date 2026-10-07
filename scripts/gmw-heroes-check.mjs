import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const catalogDecks = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-decks.json", import.meta.url),
    "utf8",
  ),
);
const sources = Object.fromEntries(
  [
    ["groot", "16001a", "Groot", "protection"],
    ["rocket", "16029a", "Rocket Raccoon", "aggression"],
  ].map(([id, code, name, aspect]) => {
    const deck = catalogDecks.find((deck) => deck.id === "starter-" + code);
    assert.ok(deck, name + " source deck exists");
    return [
      id,
      {
        name,
        aspect,
        codes: Object.entries(deck.cards)
          .flatMap(([code, count]) => Array(count).fill(code))
          .sort(),
      },
    ];
  }),
);
const output = process.env.GMW_OUTPUT || "output/gmw-heroes";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture(kind='growth') {
        const heroId=['growth','colossus','tough','tough-targets'].includes(kind)?'groot':'rocket';
        const aspect=heroId==='groot'?'protection':'aggression';
        let s=newGame({heroId,aspect,villainId:'rhino',heroes:[{heroId,aspect,deckCards:heroStarterCodes(heroId)}],seed:heroId==='groot'?16001:16029,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        s.player.form=['growth','tinker'].includes(kind)?'alter':'hero';s.player.hp=7;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const index=zone.findIndex(p=>p.code===code);if(index>=0)return zone.splice(index,1)[0];
          }
          throw Error('Missing source printing '+code);
        }
        function hand(codes) {
          const pieces=codes.map(take);s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;
        }
        function inPlay(code,counters=0,exhausted=false) {
          const piece=take(code);piece.counters=counters;piece.exhausted=exhausted;s.player.inPlay.push(piece);return piece;
        }
        let ids={};
        if(kind==='growth') {
          s.flags.grootGrowthCounters=3;
          const fertile=inPlay('16007'),entangling=inPlay('16008'),lashing=inPlay('16009');
          const [fruition,energy]=hand(['16002','16021']);
          const sideIndex=s.encounter.deck.findIndex(p=>p.code==='01107');if(sideIndex<0)throw Error('Missing actual Rhino side scheme');
          const side=s.encounter.deck.splice(sideIndex,1)[0];side.counters=3;s.sideSchemes.push(side);
          ids={fertileId:fertile.id,entanglingId:entangling.id,lashingId:lashing.id,fruitionId:fruition.id,energyId:energy.id};
        } else if(kind==='colossus'||kind==='tough') {
          s.flags.grootGrowthCounters=4;s.player.tough=kind==='tough';hand(['16021']);
          s.prompt={kind:'choice',title:'Resolve incoming damage',text:'Apply real incoming damage through Groot’s forced interrupt.',options:[{id:'damage',label:'Deal 6 damage to Groot',effects:[{type:'damage',target:'hero',amount:6,source:s.villain.id}]}]};
        } else if(kind==='tough-targets') {
          s.flags.grootGrowthCounters=3;
          const starhawk=inPlay('16012'),rocket=inPlay('16019');
          const [event,strength]=hand(['16006','16023']);
          ids={eventId:event.id,strengthId:strength.id,starhawkId:starhawk.id,rocketId:rocket.id};
        } else if(kind==='tinker') {
          const cannon=inPlay('16036',0,true),battery=inPlay('16034',2,true);
          const [reload,salvage]=hand(['16031','16033']);
          ids={cannonId:cannon.id,batteryId:battery.id,reloadId:reload.id,salvageId:salvage.id};
        } else if(kind==='cannon') {
          const cannon=inPlay('16036',2),follow=inPlay('16045');hand(['16050']);
          const index=s.encounter.deck.findIndex(p=>p.code==='01110');if(index<0)throw Error('Missing actual Hydra Bomber');
          const minion=s.encounter.deck.splice(index,1)[0];minion.engagedWith=s.activePlayerId;s.minions.push(minion);
          ids={cannonId:cannon.id,followId:follow.id,minionId:minion.id};
        } else if(kind==='team-up') {
          const pistol=inPlay('16038',1,true),battery=inPlay('16034',2,true),groot=inPlay('16047');
          const [reload,team,energy,strength]=hand(['16031','16048','16049','16051']);
          const minionIndex=s.encounter.deck.findIndex(p=>p.code==='01110');if(minionIndex<0)throw Error('Missing actual Hydra Bomber');
          const minion=s.encounter.deck.splice(minionIndex,1)[0];minion.engagedWith=s.activePlayerId;s.minions.push(minion);
          ids={pistolId:pistol.id,batteryId:battery.id,grootId:groot.id,reloadId:reload.id,teamId:team.id,energyId:energy.id,strengthId:strength.id};
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
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
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
      if (sessionStorage.getItem("gmw-heroes-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("gmw-heroes-fixture-loaded", "yes");
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
  const sourceCodes = sources[state.heroId].codes;
  const sourceSet = new Set(sourceCodes);
  const pieces = [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
    ...state.player.inPlay,
    ...state.resolving.filter((piece) => sourceSet.has(piece.code)),
  ];
  assert.equal(
    new Set(pieces.map((piece) => piece.id)).size,
    pieces.length,
    "Each physical player card occupies exactly one zone",
  );
  return pieces;
}
function physicalCards(state) {
  return physicalPieces(state)
    .map((p) => p.id)
    .sort();
}
function conserved(state, expected, message) {
  const pieces = physicalPieces(state);
  assert.equal(pieces.length, 40, `${message}: all 40 actual source cards`);
  assert.deepEqual(
    pieces.map((p) => p.code).sort(),
    sources[state.heroId].codes,
    `${message}: original printing quantities`,
  );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    expected,
    `${message}: physical source instances conserved`,
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

async function inPlayAction(name, action) {
  const card = page.locator(".in-play-card").filter({
    has: page.locator(".in-play-name").filter({ hasText: name }),
  });
  await card
    .locator(".in-play-actions button")
    .filter({ hasText: action })
    .first()
    .click();
  return settle();
}
function growth(state) {
  return state.flags.grootGrowthCounters || 0;
}

try {
  let state;
  if (!process.env.GMW_FIXTURE_ONLY) {
    for (const [id, source] of Object.entries(sources)) {
      await open();
      await page
        .getByRole("button", { name: /All heroes & starter decks/ })
        .click();
      const catalog = page.getByRole("dialog", {
        name: "All heroes & starter decks",
      });
      await catalog
        .getByRole("textbox", { name: "Search heroes and products" })
        .fill(source.name);
      await catalog
        .locator(".catalog-hero-row")
        .filter({
          has: page.locator("b", {
            hasText: new RegExp("^" + source.name + "$"),
          }),
        })
        .first()
        .click();
      await catalog
        .locator(".catalog-hero-detail")
        .getByRole("button", {
          name: "Choose " + source.name + " for mission",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: /View 40-card deck/ }).click();
      assert.match(
        await page.locator(".deck-provenance").innerText(),
        new RegExp(
          "Source preconstructed list: " + source.name + " Starter Deck",
        ),
      );
      await capture(id + "-source-deck");
      await audit(source.name + " exact source starter");
      await page.keyboard.press("Escape");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .waitFor();
      state = await save();
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, source.aspect);
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      const physical = physicalCards(state);
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      await settle();
      for (const width of (process.env.GMW_VIEWPORTS || "1440,1280,390,320")
        .split(",")
        .map(Number))
        await checkpoint(id + "-source-board", width, physical);
      await reload();
      checks.push(
        source.name +
          " catalog launches original source 40-card " +
          source.aspect +
          " deck with physical printing IDs and saved alter-ego form",
      );
    }
  }
  const scenarios = (
    process.env.GMW_SCENARIOS ||
    "growth,colossus,tough-targets,tinker,cannon,team-up"
  ).split(",");
  for (const width of (process.env.GMW_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number)) {
    if (scenarios.includes("growth")) {
      const f = fixture("growth");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.getByRole("button", { name: /Growth Spurt/ }).click();
      state = await settle();
      assert.equal(growth(state), 5);
      await inPlayAction("Fertile Ground", /exhaust|place|draw/i);
      state = await skipAll();
      assert.equal(growth(state), 6);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.fertileId).exhausted,
        true,
      );
      await checkpoint("growth-spurt-fertile-ground", width, physical);
      await reload();
      await play("Fruition");
      state = await skipAll();
      assert.equal(growth(state), 8);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.fruitionId).length,
        1,
      );
      await page.locator(".flip-button").click();
      await settle();
      assert.equal(
        await page.locator('[aria-label="GROWTH: 8"]').isVisible(),
        true,
      );
      await page.locator(".thwart-action").click();
      state = await settle();
      if (state.prompt?.options?.some((o) => o.id === "main"))
        await choice("main");
      await findChoice(
        (o) => o.id === f.entanglingId,
        "Entangling Vines physical interrupt",
      );
      await checkpoint("entangling-vines-interrupt", width, physical);
      await reload();
      await choice(f.entanglingId);
      state = await save();
      if (state.prompt?.options?.some((o) => o.id === "main"))
        await choice("main");
      await findChoice(
        (o) => o.id === f.lashingId,
        "Lashing Vines physical ready response",
      );
      await checkpoint("lashing-vines-response", width, physical);
      await reload();
      await choice(f.lashingId);
      state = await skipAll();
      assert.equal(growth(state), 5);
      assert.equal(state.scheme.threat, 3);
      assert.equal(state.player.exhausted, false);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.entanglingId).exhausted,
        true,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.lashingId).exhausted,
        true,
      );
      assert.equal(
        await page.locator('[aria-label="GROWTH: 5"]').isVisible(),
        true,
      );
      await checkpoint("groot-after-vines", width, physical);
      await reload();
      console.log("Verified Groot growth and vines at " + width + "px");
    }
    if (scenarios.includes("colossus")) {
      const tough = fixture("tough");
      await open(tough.state, width);
      let physical = physicalCards(await save());
      await checkpoint("groot-tough-before-damage", width, physical);
      await choice("damage");
      state = await skipAll();
      assert.equal(state.player.hp, 7);
      assert.equal(growth(state), 4);
      assert.equal(!!state.player.tough, false);
      await checkpoint("groot-tough-preserves-growth", width, physical);
      await reload();
      const f = fixture("colossus");
      await open(f.state, width);
      physical = physicalCards(await save());
      await choice("damage");
      state = await skipAll();
      assert.equal(growth(state), 0);
      assert.equal(state.player.hp, 5);
      await checkpoint("flora-colossus-prevents-four", width, physical);
      await reload();
      console.log("Verified Groot Tough and Flora Colossus at " + width + "px");
    }
    if (scenarios.includes("tough-targets")) {
      const f = fixture("tough-targets");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play('"We Are Groot"');
      await checkpoint("we-are-groot-payment", width, physical);
      await reload();
      await payWith(["Strength"]);
      await findChoice((o) => o.id === "3", "We Are Groot growth cost");
      await checkpoint("we-are-groot-growth-cost", width, physical);
      await reload();
      await choice("3");
      await findChoice((o) => o.id === "hero", "We Are Groot identity target");
      await choice("hero");
      await findChoice(
        (o) => o.id === f.starhawkId,
        "We Are Groot first ally target",
      );
      await checkpoint("we-are-groot-distinct-targets", width, physical);
      await reload();
      await choice(f.starhawkId);
      state = await save();
      assert.ok(
        !state.prompt.options.some((o) => o.id === "hero"),
        "Chosen identity cannot be chosen twice",
      );
      await choice(f.rocketId);
      state = await skipAll();
      assert.equal(growth(state), 0);
      assert.equal(state.player.tough, true);
      for (const id of [f.starhawkId, f.rocketId])
        assert.equal(state.player.inPlay.find((p) => p.id === id).tough, true);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.eventId).length,
        1,
      );
      await checkpoint("we-are-groot-three-tough-characters", width, physical);
      await reload();
      console.log(
        "Verified We Are Groot distinct friendly targets at " + width + "px",
      );
    }
    if (scenarios.includes("tinker")) {
      const f = fixture("tinker");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.getByRole("button", { name: /Tinkering/ }).click();
      await settle();
      state = await save();
      assert.equal(state.prompt?.kind, "select");
      assert.ok(state.prompt.options.some((o) => o.id === f.cannonId));
      await checkpoint("tinkering-physical-cost", width, physical);
      await reload();
      await selectCards([f.cannonId]);
      state = await skipAll();
      assert.equal(
        state.player.discard.filter((p) => p.id === f.cannonId).length,
        1,
      );
      assert.equal(state.player.hand.length, 4);
      assert.equal(state.flags.rocketTinkerRound, state.round);
      await page.locator(".flip-button").click();
      await settle();
      await play("Reload");
      await checkpoint("salvage-actual-resource-payment", width, physical);
      await reload();
      await payWith(["Salvage"]);
      await respond(/Salvage/);
      await findChoice(
        (o) => o.id === f.cannonId,
        "Salvage actual discarded Tech",
      );
      await checkpoint("salvage-top-deck-choice", width, physical);
      await reload();
      await choice(f.cannonId);
      state = await skipAll();
      assert.equal(state.player.deck[0].id, f.cannonId);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.batteryId).exhausted,
        false,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.batteryId).counters,
        2,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.salvageId).length,
        1,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.reloadId).length,
        1,
      );
      await checkpoint("salvage-after-top-deck", width, physical);
      await reload();
      console.log("Verified Tinkering and Salvage at " + width + "px");
    }
    if (scenarios.includes("cannon")) {
      const f = fixture("cannon");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await inPlayAction("Particle Cannon", /attack|damage|exhaust/i);
      await findChoice(
        (o) => o.id === f.minionId,
        "Particle Cannon actual minion target",
      );
      await checkpoint("particle-cannon-charged-target", width, physical);
      await reload();
      await choice(f.minionId);
      await respond(/Follow Through/);
      await checkpoint("follow-through-excess-interrupt", width, physical);
      await reload();
      await respond(/Murdered You|excess.*draw|draw.*excess/i);
      state = await skipAll();
      assert.equal(
        state.minions.some((p) => p.id === f.minionId),
        false,
      );
      assert.equal(state.villain.hp, 37);
      assert.equal(state.player.hand.length, 2);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.cannonId).counters,
        1,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.cannonId).exhausted,
        true,
      );
      const chargeBadge = page
        .locator(".in-play-card")
        .filter({
          has: page.locator(".in-play-name", { hasText: "Particle Cannon" }),
        })
        .locator(".counter-token");
      assert.equal(
        await chargeBadge
          .locator("..")
          .getByRole("img", { name: "Particle Cannon", exact: true })
          .isVisible(),
        true,
      );
      assert.equal(await chargeBadge.isVisible(), true);
      assert.equal(await chargeBadge.innerText(), "1");
      assert.match(await chargeBadge.textContent(), /1\s*CHARGES/);
      await checkpoint("particle-cannon-overkill-draw", width, physical);
      await reload();
      console.log(
        "Verified Particle Cannon, Follow Through and excess draw at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("team-up")) {
      const f = fixture("team-up");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Reload");
      await payWith(["Energy"]);
      state = await skipAll();
      for (const id of [f.pistolId, f.batteryId])
        assert.equal(
          state.player.inPlay.find((p) => p.id === id).exhausted,
          false,
        );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.pistolId).counters,
        1,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.batteryId).counters,
        2,
      );
      await checkpoint(
        "reload-readies-tech-preserves-charges",
        width,
        physical,
      );
      await reload();
      await inPlayAction("Rocket's Pistol", /attack|damage|exhaust/i);
      await findChoice(
        (o) => o.id === f.state.villain.id,
        "Rocket Pistol actual villain target",
      );
      await choice(f.state.villain.id);
      state = await skipAll();
      assert.equal(state.villain.hp, 38);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.pistolId).counters,
        0,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.pistolId).exhausted,
        true,
      );
      await play("Flora and Fauna");
      await checkpoint("flora-fauna-physical-payment", width, physical);
      await reload();
      await payWith(["Strength"]);
      await findChoice(
        (o) => o.id === f.pistolId,
        "Flora and Fauna actual Rocket upgrade",
      );
      await checkpoint("flora-fauna-team-up-target", width, physical);
      await reload();
      await choice(f.pistolId);
      state = await skipAll();
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.pistolId).counters,
        2,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.pistolId).exhausted,
        false,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.teamId).length,
        1,
      );
      await checkpoint("flora-fauna-after-recharge", width, physical);
      await reload();
      console.log("Verified Reload and Flora and Fauna at " + width + "px");
    }
  }
  checks.push(
    ...scenarios.map(
      (scenario) =>
        "Native " +
        scenario +
        " flow preserves all 40 source physical IDs through saved choices and reload at " +
        (process.env.GMW_VIEWPORTS || "1440,1280,390,320") +
        "px",
    ),
  );
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
