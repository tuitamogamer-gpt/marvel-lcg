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
    ["drax", "19001a", "Drax", "protection"],
    ["vnm", "20001a", "Venom", "justice"],
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
const output = process.env.DV_OUTPUT || "output/drax-venom";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture(kind='parry') {
        const heroId=['parry','cap','leap','stubborn'].includes(kind)?'drax':'vnm';
        const aspect=heroId==='drax'?'protection':'justice';
        let s=newGame({heroId,aspect,villainId:'rhino',heroes:[{heroId,aspect,deckCards:heroStarterCodes(heroId)}],seed:heroId==='drax'?19001:20001,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        for(let i=0;i<40&&s.review;i++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}
        if(s.prompt||s.review)throw Error('Unexpected setup prompt '+JSON.stringify(s.prompt));
        s.player.form='hero';s.player.hp=7;s.player.flipped=false;s.player.exhausted=false;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const index=zone.findIndex(p=>p.code===code);if(index>=0)return zone.splice(index,1)[0];
          }
          throw Error('Missing physical source printing '+code);
        }
        function hand(codes) {const pieces=codes.map(take);s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;}
        function inPlay(code,exhausted=false) {const piece=take(code);piece.exhausted=exhausted;s.player.inPlay.push(piece);return piece;}
        function top(code) {const piece=take(code);s.player.deck.unshift(piece);return piece;}
        function encounter(code) {const i=s.encounter.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing actual encounter '+code);return s.encounter.deck.splice(i,1)[0];}
        function encounterTop(code) {const p=encounter(code);s.encounter.deck.unshift(p);return p;}
        function minion(code='01110',damage=0) {const p=encounter(code);p.engagedWith=s.activePlayerId;p.damage=damage;s.minions.push(p);return p;}
        function native(effects,title='Resolve native rules') {s.prompt={kind:'choice',title,text:'Resolve the actual engine windows.',options:[{id:'go',label:'Resolve printed rules',effects}]};}
        function attack() {const boost=encounterTop('01105');native([{type:'enemyAttack',id:s.villain.id}]);return boost;}
        let ids={};
        if(kind==='parry') {s.flags.draxVengeanceCounters=2;const knife=inPlay('19008');const [parry,payback]=hand(['19006','19007']);attack();ids={knifeId:knife.id,parryId:parry.id,paybackId:payback.id};}
        else if(kind==='cap') {s.flags.draxVengeanceCounters=3;s.player.exhausted=true;const [event]=hand(['19003']);const boost=encounterTop('01105');ids={eventId:event.id,boostId:boost.id,drawIds:s.player.deck.slice(0,2).map(p=>p.id)};}
        else if(kind==='leap') {s.flags.draxVengeanceCounters=2;const knife=inPlay('19008'),mastery=inPlay('19010');const [leap,leading,energy]=hand(['19005','19017','19022']);const enemy=minion();enemy.tough=true;const boost=encounterTop('01110');ids={knifeId:knife.id,masteryId:mastery.id,leapId:leap.id,leadingId:leading.id,energyId:energy.id,minionId:enemy.id,boostId:boost.id,drawId:s.player.deck[0].id};}
        else if(kind==='stubborn') {s.flags.draxVengeanceCounters=2;const upgrade=inPlay('19011');hand(['19021']);native([{type:'damage',target:'hero',amount:15,source:'encounter'}]);ids={upgradeId:upgrade.id};}
        else if(kind==='pistols') {const a=inPlay('20010'),b=inPlay('20010'),gun=inPlay('20008',true),rebirth=inPlay('20007',true);const [event,genius,second]=hand(['20005','20018','20005','20017','20004']);ids={pistolIds:[a.id,b.id],gunId:gun.id,rebirthId:rebirth.id,eventId:event.id,secondId:second.id,resourceId:genius.id};}
        else if(kind==='allocation') {const [event,genius,energy,second,mental]=hand(['20002','20018','20017','20002','20004']);ids={eventId:event.id,resourceIds:[genius.id,energy.id],secondId:second.id,mentalId:mental.id};}
        else if(kind==='multigun') {const gun=inPlay('20008');hand(['20005','20018','20004']);const a=minion('01110',1),b=minion('01110',1);ids={gunId:gun.id,minionIds:[a.id,b.id]};}
        else if(kind==='tendrils') {const sense=inPlay('20009');const [strength]=hand(['20019']);const event=top('20003'),boost=attack();ids={senseId:sense.id,eventId:event.id,strengthId:strength.id,boostId:boost.id};}
        else if(kind==='nemesis') {const gun=inPlay('20008');const [event]=hand(['20004']);const obligation=encounter('20023'),shadow=encounter('01190');native([{type:'reveal',piece:obligation},{type:'reveal',piece:shadow}]);ids={gunId:gun.id,eventId:event.id,obligationId:obligation.id,shadowId:shadow.id,nemesisIds:s.player.setAside.map(p=>p.id).sort()};}
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
const entryAssets = new Set();
let context, page;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));

async function open(state, width = 1440) {
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
  if (state)
    await page.addInitScript((saved) => {
      if (sessionStorage.getItem("drax-venom-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("drax-venom-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
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
    /^(skip|pass|none|done|continue|no|take)$/.test(o.id),
  );
  assert.ok(option, JSON.stringify(state.prompt));
  return choice(option.id);
}
async function skipAll() {
  for (let i = 0; i < 20 && (await save()).prompt; i++) await skip();
  assert.equal((await save()).prompt, null);
  return save();
}
async function reload() {
  const before = await save();
  await writeFile(
    `${output}/reload-before.json`,
    JSON.stringify(before, null, 2),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await save(),
    before,
    "Pending native choice and physical cards survive reload exactly",
  );
}
async function capture(name) {
  await page.mouse.move(4, 4);
  await page.locator(".card-hover-preview").waitFor({ state: "hidden" });
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
  assert.equal(
    result.violations.length,
    0,
    `${name}: accessibility violations ${JSON.stringify(audits.at(-1))}`,
  );
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
    ...state.removed.filter((piece) => sourceSet.has(piece.code)),
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
async function payWith(names, wild) {
  assert.equal((await save()).prompt?.kind, "payment");
  for (const name of names)
    await page
      .locator(".payment-source")
      .filter({
        has: page.locator("b", { hasText: new RegExp("^" + name + "$") }),
      })
      .first()
      .click();
  if (wild) await page.getByLabel("Optional wild type").selectOption(wild);
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

async function response(id, label) {
  await findChoice((option) => option.id === id, label);
  return choice(id);
}
async function target(id) {
  const state = await save();
  return state.prompt?.options.some((option) => option.id === id)
    ? choice(id)
    : state;
}
async function basic(power) {
  await page.locator("." + power + "-action").click();
  return settle();
}
function nemesisPieces(state) {
  const pieces = [
    ...(state.player.setAside || []),
    ...state.minions,
    ...state.sideSchemes,
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...state.resolving,
    ...state.removed,
  ].filter((p) => ["20024", "20025"].includes(p.code));
  assert.equal(new Set(pieces.map((p) => p.id)).size, pieces.length);
  return pieces;
}
function nemesisConserved(state, ids) {
  const pieces = nemesisPieces(state);
  assert.deepEqual(pieces.map((p) => p.id).sort(), ids);
  assert.deepEqual(pieces.map((p) => p.code).sort(), [
    "20024",
    "20025",
    "20025",
    "20025",
    "20025",
  ]);
}

try {
  let state;
  const viewports = (process.env.DV_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceViewports = (
    process.env.DV_SOURCE_VIEWPORTS || viewports.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.DV_FIXTURE_ONLY) {
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
      const physical = physicalCards(state),
        pool =
          id === "vnm"
            ? nemesisPieces(state)
                .map((p) => p.id)
                .sort()
            : null;
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.prompt, null);
      if (id === "vnm") {
        const catalogCards = JSON.parse(
          await readFile(
            new URL("../src/data/catalog-cards.json", import.meta.url),
            "utf8",
          ),
        );
        assert.ok(
          state.player.hand.some((p) =>
            catalogCards.some(
              (c) =>
                c.code === p.code &&
                c.type_code === "upgrade" &&
                c.traits?.includes("Weapon"),
            ),
          ),
          "Armed and Ready finds an actual Weapon upgrade after mulligan",
        );
        nemesisConserved(state, pool);
      }
      for (const width of sourceViewports)
        await checkpoint(id + "-source-board", width, physical);
      await reload();
      checks.push(
        source.name +
          " catalog launches original source 40-card " +
          source.aspect +
          " deck; native setup and physical printing IDs survive reload",
      );
    }
  }
  const scenarios = (
    process.env.DV_SCENARIOS ??
    "parry,cap,leap,stubborn,pistols,allocation,multigun,tendrils,nemesis"
  )
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const supported = new Set([
    "parry",
    "cap",
    "leap",
    "stubborn",
    "pistols",
    "allocation",
    "multigun",
    "tendrils",
    "nemesis",
  ]);
  assert.ok(
    scenarios.every((name) => supported.has(name)),
    "Unknown Drax/Venom scenario",
  );
  assert.ok(
    !process.env.DV_FIXTURE_ONLY || scenarios.length,
    "Choose at least one native fixture scenario",
  );
  for (const width of viewports) {
    if (scenarios.includes("parry")) {
      const f = fixture("parry");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await findChoice(
        (o) => o.id === f.parryId,
        "Parry actual incoming damage interrupt",
      );
      await checkpoint("drax-parry-incoming-damage", width, physical);
      await reload();
      await choice(f.parryId);
      if ((await save()).prompt?.kind === "payment") await payWith([]);
      await findChoice(
        (o) => o.id === "vengeance",
        "Drax completed villain attack response",
      );
      await checkpoint(
        "drax-vengeance-and-payback-response-order",
        width,
        physical,
      );
      await reload();
      await choice("vengeance");
      await response(f.paybackId, "Payback actual physical event");
      if ((await save()).prompt?.kind === "payment") await payWith([]);
      state = await skipAll();
      assert.equal(state.player.hp, 7);
      assert.equal(state.player.exhausted, false);
      assert.equal(state.flags.draxVengeanceCounters, 3);
      assert.equal(state.villain.hp, 35);
      await checkpoint(
        "drax-parry-prevents-payback-current-atk",
        width,
        physical,
      );
      await reload();
      await page.locator(".flip-button").click();
      state = await settle();
      assert.equal(state.player.form, "alter");
      assert.equal(state.player.hp, 13);
      assert.equal(state.flags.draxVengeanceCounters, 0);
      await checkpoint(
        "drax-alter-ego-removes-counters-heals",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Drax Parry, vengeance, Payback and alter-ego at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("cap")) {
      const f = fixture("cap");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play('"Fight Me, Coward!"');
      if ((await save()).prompt?.kind === "payment") await payWith([]);
      await findChoice((o) => o.id === "vengeance", "Drax vengeance cap draw");
      await checkpoint("drax-fight-me-completed-attack-cap", width, physical);
      await reload();
      await choice("vengeance");
      state = await skipAll();
      assert.equal(state.flags.draxVengeanceCounters, 3);
      assert.equal(state.player.hp, 5);
      assert.equal(state.player.exhausted, false);
      assert.ok(
        f.drawIds.every((id) => state.player.hand.some((p) => p.id === id)),
        "Fight Me and vengeance cap each draw a real top card",
      );
      assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      await checkpoint("drax-cap-draw-actual-top-cards", width, physical);
      await reload();
      console.log(
        "Verified Drax vengeance cap and Fight Me at " + width + "px",
      );
    }
    if (scenarios.includes("leap")) {
      const f = fixture("leap");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await basic("attack");
      await findChoice(
        (o) => o.id === f.leapId,
        "Knife Leap native basic interrupt",
      );
      await checkpoint("knife-leap-before-target-payment", width, physical);
      await reload();
      await choice(f.leapId);
      await checkpoint(
        "knife-leap-discounted-physical-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Energy"]);
      await findChoice(
        (o) => o.id === f.leadingId,
        "Leading Blow native basic interrupt",
      );
      await checkpoint("leading-blow-actual-encounter-card", width, physical);
      await reload();
      await choice(f.leadingId);
      if ((await save()).prompt?.kind === "payment") await payWith([]);
      await response(f.minionId, "Knife Leap piercing actual minion target");
      await findChoice(
        (o) => o.id === "yes",
        "DWI Theet Mastery after basic attack",
      );
      await choice("yes");
      state = await skipAll();
      assert.equal(
        state.minions.some((p) => p.id === f.minionId),
        false,
      );
      assert.equal(state.villain.hp, 34);
      assert.equal(state.player.exhausted, false);
      assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
      assert.ok(state.player.inPlay.some((p) => p.id === f.masteryId));
      assert.deepEqual(
        state.player.hand.map((p) => p.id),
        [f.drawId],
      );
      await checkpoint(
        "knife-leap-piercing-overkill-leading-ready-dwi-draw",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Knife Leap, Leading Blow and DWI at " + width + "px",
      );
    }
    if (scenarios.includes("stubborn")) {
      const f = fixture("stubborn");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await findChoice(
        (o) => o.id === f.upgradeId,
        "Too Stubborn actual defeat replacement",
      );
      await checkpoint(
        "too-stubborn-saved-defeat-replacement",
        width,
        physical,
      );
      await reload();
      await choice(f.upgradeId);
      state = await skipAll();
      assert.equal(state.phase, "player");
      assert.equal(state.player.form, "alter");
      assert.equal(state.player.hp, 8);
      assert.equal(state.flags.draxVengeanceCounters, 0);
      assert.equal(state.removed.filter((p) => p.id === f.upgradeId).length, 1);
      await checkpoint(
        "too-stubborn-real-removed-upgrade-and-forced-heal",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Too Stubborn removal and healing at " + width + "px",
      );
    }
    if (scenarios.includes("pistols")) {
      const f = fixture("pistols");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await basic("thwart");
      await findChoice(
        (o) => o.id === f.pistolIds[0],
        "First physical Venom Pistol",
      );
      await checkpoint(
        "venom-physical-pistol-basic-interrupts",
        width,
        physical,
      );
      await reload();
      await choice(f.pistolIds[0]);
      await response(f.pistolIds[1], "Second physical Venom Pistol");
      await target("main");
      state = await skipAll();
      assert.equal(state.scheme.threat, 3);
      assert.ok(
        f.pistolIds.every(
          (id) => state.player.inPlay.find((p) => p.id === id).exhausted,
        ),
      );
      await play("Run and Gun");
      await checkpoint("symbiotic-bond-real-hp-payment", width, physical);
      await reload();
      await payWith(["Genius", "Symbiotic Bond"]);
      state = await skipAll();
      assert.equal(state.player.hp, 6);
      assert.equal(state.flags.venomBondPhase, `${state.round}:${state.phase}`);
      assert.equal(state.player.exhausted, false);
      assert.ok(
        [...f.pistolIds, f.gunId].every(
          (id) => !state.player.inPlay.find((p) => p.id === id).exhausted,
        ),
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.rebirthId).exhausted,
        true,
      );
      await checkpoint("run-and-gun-readies-actual-weapons", width, physical);
      await reload();
      await play("Run and Gun");
      assert.equal(
        await page
          .locator(".payment-source")
          .filter({ has: page.locator("b", { hasText: /^Symbiotic Bond$/ }) })
          .count(),
        0,
        "Bond unavailable again in same phase",
      );
      await checkpoint("symbiotic-bond-once-per-phase", width, physical);
      await reload();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await settle();
      console.log(
        "Verified physical Pistols, Bond and Run and Gun at " + width + "px",
      );
    }
    if (scenarios.includes("allocation")) {
      const f = fixture("allocation");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Behind Enemy Lines");
      await checkpoint(
        "behind-enemy-lines-overpayment-sources",
        width,
        physical,
      );
      await reload();
      const payment = (await save()).prompt;
      await payWith(["Genius", "Energy"]);
      state = await save();
      assert.equal(state.prompt.title, "Allocate payment resources");
      assert.ok(
        f.resourceIds.every((id) => state.player.hand.some((p) => p.id === id)),
      );
      await checkpoint(
        "venom-actual-paid-resource-allocation",
        width,
        physical,
      );
      await reload();
      await page.keyboard.press("Escape");
      state = await settle();
      assert.deepEqual(
        state.prompt,
        payment,
        "Cancel allocation restores the exact unspent payment request",
      );
      assert.ok(
        f.resourceIds.every((id) => state.player.hand.some((p) => p.id === id)),
      );
      await checkpoint("allocation-cancel-restores-payment", width, physical);
      await reload();
      await payWith(["Genius", "Energy"]);
      await choice("energy+mental");
      await target("main");
      state = await skipAll();
      assert.equal(state.scheme.threat, 3);
      assert.equal(state.villain.confused, false);
      assert.ok(
        f.resourceIds.every((id) =>
          state.player.discard.some((p) => p.id === id),
        ),
        "Only the committed allocation spends both selected physical sources",
      );
      await checkpoint(
        "mixed-allocated-payment-has-no-confuse",
        width,
        physical,
      );
      await reload();
      await play("Behind Enemy Lines");
      await payWith(["Locked and Loaded", "Symbiotic Bond"], "mental");
      await target("main");
      await target("villain");
      state = await skipAll();
      assert.equal(state.scheme.threat, 0);
      assert.equal(state.villain.confused, true);
      assert.equal(state.player.hp, 6);
      assert.ok(state.player.discard.some((p) => p.id === f.secondId));
      await checkpoint(
        "only-mental-actual-wild-allocation-confuses",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified actual typed resource allocation at " + width + "px",
      );
    }
    if (scenarios.includes("multigun")) {
      const f = fixture("multigun");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await inPlayAction("Multi-Gun", /each minion/);
      await checkpoint("multi-gun-selected-player-batch", width, physical);
      await reload();
      await target("p1");
      state = await skipAll();
      assert.ok(
        f.minionIds.every((id) => !state.minions.some((p) => p.id === id)),
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.gunId).exhausted,
        true,
      );
      await checkpoint(
        "multi-gun-simultaneous-physical-minion-defeats",
        width,
        physical,
      );
      await reload();
      await play("Run and Gun");
      await payWith(["Genius", "Locked and Loaded"]);
      await skipAll();
      await inPlayAction("Multi-Gun", /remove 2 threat/);
      await target("main");
      state = await skipAll();
      assert.equal(state.scheme.threat, 4);
      await checkpoint("multi-gun-native-threat-mode", width, physical);
      await reload();
      console.log(
        "Verified Multi-Gun batch and threat modes at " + width + "px",
      );
    }
    if (scenarios.includes("tendrils")) {
      const f = fixture("tendrils");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await findChoice(
        (o) => o.id === f.senseId,
        "Spider-Sense attack initiation",
      );
      await checkpoint(
        "venom-shared-attack-initiation-window",
        width,
        physical,
      );
      await reload();
      await choice(f.senseId);
      state = await save();
      assert.ok(state.player.hand.some((p) => p.id === f.eventId));
      await response(f.eventId, "Drawn actual Grasping Tendrils");
      await checkpoint("grasping-tendrils-physical-payment", width, physical);
      await reload();
      await payWith(["Strength"]);
      state = await skipAll();
      assert.equal(state.attack, null);
      assert.equal(state.player.hp, 7);
      assert.equal(state.player.exhausted, false);
      assert.equal(state.villain.stunned, true);
      assert.ok(
        state.encounter.deck.some((p) => p.id === f.boostId),
        "Cancelled attack never draws a boost",
      );
      assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      await checkpoint(
        "spider-sense-draw-tendrils-cancel-stun",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Spider-Sense and Tendrils cancellation at " + width + "px",
      );
    }
    if (scenarios.includes("nemesis")) {
      const f = fixture("nemesis");
      await open(f.state, width);
      const physical = physicalCards(await save());
      nemesisConserved(await save(), f.nemesisIds);
      await choice("go");
      await findChoice(
        (o) => o.id === "stay",
        "Venom obligation optional form",
      );
      await checkpoint("venom-obligation-physical-set-aside", width, physical);
      await reload();
      await choice("stay");
      await checkpoint(
        "venom-obligation-actual-symbiote-choice",
        width,
        physical,
      );
      await reload();
      await choice("symbiote");
      state = await skipAll();
      nemesisConserved(state, f.nemesisIds);
      assert.equal(state.minions.filter((p) => p.code === "20025").length, 4);
      assert.equal(state.player.setAside.length, 0);
      assert.equal(
        state.sideSchemes.find((p) => p.code === "20024").counters,
        2,
      );
      assert.ok(state.encounter.discard.some((p) => p.id === f.obligationId));
      assert.ok(state.encounter.discard.some((p) => p.id === f.shadowId));
      await checkpoint(
        "venom-obligation-then-all-remaining-nemeses",
        width,
        physical,
      );
      await reload();
      nemesisConserved(await save(), f.nemesisIds);
      await inPlayAction("Multi-Gun", /remove 2 threat/);
      state = await save();
      assert.equal(
        state.prompt?.options.some((o) => o.image === "20024") || false,
        false,
        "Klyntar threat locked while Symbiote enemy exists",
      );
      await target("main");
      state = await skipAll();
      assert.equal(state.scheme.threat, 4);
      assert.equal(
        state.sideSchemes.find((p) => p.code === "20024").counters,
        2,
      );
      nemesisConserved(state, f.nemesisIds);
      await checkpoint(
        "klyntar-lock-and-multi-gun-patrol-bypass",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Venom physical set-aside nemesis conservation at " +
          width +
          "px",
      );
    }
  }
  checks.push(
    ...scenarios.map(
      (name) =>
        "Native " +
        name +
        " flow preserves all 40 actual source cards through saved choices/payments and exact reload at " +
        viewports.join(",") +
        "px",
    ),
  );
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((result) => !result.violations.length),
    JSON.stringify(audits),
  );
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      { checks, audits, layouts, errors, entryAssets: [...entryAssets] },
      null,
      2,
    ),
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
      {
        message: String(error),
        checks,
        audits,
        layouts,
        errors,
        entryAssets: [...entryAssets],
      },
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
    const state = await Promise.race([
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
      JSON.stringify(state, null, 2),
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
