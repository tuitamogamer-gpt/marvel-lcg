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
  [["nebu", "22001a", "Nebula", "justice"]].map(([id, code, name, aspect]) => {
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
const output = process.env.NEBU_OUTPUT || "output/nebula";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      import {pieceHP} from './src/game/cards.ts';
      export function fixture(kind='ae') {
        let s=newGame({heroId:'nebu',aspect:'justice',villainId:kind==='eros-drone'?'ultron':'rhino',heroes:[{heroId:'nebu',aspect:'justice',deckCards:heroStarterCodes('nebu')}],seed:22001,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        for(let i=0;i<40&&s.review;i++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}
        if(s.prompt||s.review)throw Error('Unexpected setup '+JSON.stringify(s.prompt));
        s.player.form=['ae','combat'].includes(kind)?'alter':'hero';s.player.hp=7;s.player.flipped=false;s.player.exhausted=false;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=kind==='eros-drone'?1:6;
        function take(code) {for(const zone of [s.player.hand,s.player.deck,s.player.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing actual source '+code);}
        function hand(codes) {const ps=codes.map(take);s.player.deck.push(...s.player.hand);s.player.hand=ps;return ps;}
        function inPlay(code) {const p=take(code);p.exhausted=false;s.player.inPlay.push(p);return p;}
        function encounter(code) {const i=s.encounter.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing actual encounter '+code);return s.encounter.deck.splice(i,1)[0];}
        function minion(code) {const p=encounter(code);p.engagedWith=s.activePlayerId;p.damage=0;s.minions.push(p);return p;}
        function native(effects) {s.prompt={kind:'choice',title:'Resolve native rules',text:'Continue the actual native engine windows.',options:[{id:'go',label:'Resolve printed rules',effects}]};}
        let ids={};
        if(kind==='ae'){const ship=inPlay('22003');const [first,second]=hand(['22004','22007','22024','22025']);ids={shipId:ship.id,firstId:first.id,secondId:second.id,drawIds:s.player.deck.slice(0,2).map(p=>p.id)};}
        else if(kind==='protocols'){const ca=inPlay('22004'),cb=inPlay('22004'),wa=inPlay('22007'),wb=inPlay('22007'),evasive=inPlay('22005');hand(['22023']);s.player.stunned=true;s.player.confused=true;s.round=2;const enemy=minion('01101');enemy.damage=pieceHP(s,enemy)-2;enemy.tough=true;const crisis=encounter('01108');crisis.counters=4;s.sideSchemes.push(crisis);native([{type:'beginTurn'}]);ids={cutIds:[ca.id,cb.id],weaponIds:[wa.id,wb.id],evasiveId:evasive.id,allIds:[ca.id,cb.id,wa.id,wb.id,evasive.id],enemyId:enemy.id,crisisId:crisis.id};}
        else if(kind==='wide'){const wide=inPlay('22008'),unyield=inPlay('22006');hand(['22023']);s.player.tough=true;s.round=2;const looked=['01105','01110','01108'].map(encounter);s.encounter.deck.unshift(...looked);native([{type:'beginTurn'}]);ids={wideId:wide.id,unyieldId:unyield.id,lookIds:looked.map(p=>p.id),encounterSize:s.encounter.deck.length};}
        else if(kind==='lethal'){const a=inPlay('22007'),b=inPlay('22007');const [event]=hand(['22010','22024']);ids={techIds:[a.id,b.id],eventId:event.id};}
        else if(kind==='combat'){const [event]=hand(['22009']);const found=take('22006');s.player.discard.push(...s.player.deck);s.player.deck=[found];ids={eventId:event.id,foundId:found.id};}
        else if(kind==='eros'){const [event,genius,energy]=hand(['22011','22025','22024']);const a=minion('01110'),b=minion('01103');ids={eventId:event.id,resourceIds:[genius.id,energy.id],enemyIds:[a.id,b.id]};}
        else if(kind==='eros-drone'){const [event,genius]=hand(['22011','22025']);const drone=s.minions.find(p=>p.code==='drone');if(!drone||!drone.droneCard)throw Error('Native Ultron setup must create a real player-source Drone');ids={eventId:event.id,resourceId:genius.id,droneId:drone.id,underlyingId:drone.droneCard.id};}
        else if(kind==='one-way'){const [event,second]=hand(['22015','22015','22016']);const target=s.encounter.deck.find(p=>p.code==='01108');if(!target)throw Error('Missing actual source side scheme');ids={eventId:event.id,secondId:second.id,schemeId:target.id,drawIds:s.player.deck.slice(0,3).map(p=>p.id)};}
        else if(kind==='thwart'){s.scheme.threat=2;const served=inPlay('22014');const [event]=hand(['22018','22024']);ids={servedId:served.id,eventId:event.id};}
        else if(kind==='nemesis'){const ally=inPlay('22002'),a=inPlay('22004'),b=inPlay('22008');hand(['22023']);const obligation=encounter('22027'),shadow=encounter('01190');native([{type:'reveal',piece:obligation},{type:'reveal',piece:shadow}]);ids={allyId:ally.id,techIds:[a.id,b.id],obligationId:obligation.id};}
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
      if (sessionStorage.getItem("nebula-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("nebula-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.NEBU_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.NEBU_ASSET),
      ),
      "Expected immutable production entry asset",
    );
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
  const sourceSet = new Set(sources[state.heroId].codes);
  const all = [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
    ...state.player.inPlay,
    ...(state.player.setAside || []),
    ...state.resolving,
    ...state.removed,
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...state.minions,
    ...state.sideSchemes,
    ...state.attachments,
    ...(state.environments || []),
    ...(state.encounter.storedBoosts || []),
    ...(state.attack?.pendingBoosts || []),
  ];
  const nested = (p) => {
    const children = [
      ...(p.storedCards || []),
      ...(p.captured || []),
      ...(p.droneCard ? [p.droneCard] : []),
    ];
    all.push(...children);
    children.forEach(nested);
  };
  [...all].forEach(nested);
  const pieces = all.filter((p) => sourceSet.has(p.code));
  assert.equal(
    new Set(pieces.map((p) => p.id)).size,
    pieces.length,
    "Each physical source occupies exactly one zone",
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
  assert.equal(
    pieces.length,
    sources[state.heroId].codes.length,
    `${message}: original physical source composition`,
  );
  assert.equal(
    pieces.filter((p) => !["21002", "21003", "21004"].includes(p.code)).length,
    40,
    `${message}: all forty playing deck cards`,
  );
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
      .locator(".payment-source:not(.selected)")
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
async function selection(ids) {
  const state = await save();
  assert.equal(state.prompt?.kind, "select");
  for (const id of ids) {
    const i = state.prompt.options.findIndex((o) => o.id === id);
    assert.ok(i >= 0);
    await page.locator(".decision-option").nth(i).click();
  }
  await page.getByRole("button", { name: /Confirm selection/ }).click();
  return settle();
}
function nemesisPieces(state) {
  return [
    ...(state.player.setAside || []),
    ...state.minions,
    ...state.sideSchemes,
    ...state.attachments,
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...state.resolving,
    ...state.removed,
  ].filter((p) => ["22028", "22029", "22030", "22031"].includes(p.code));
}
function nemesisConserved(state, ids) {
  const ps = nemesisPieces(state);
  assert.equal(new Set(ps.map((p) => p.id)).size, 5);
  assert.deepEqual(ps.map((p) => p.id).sort(), ids);
  assert.deepEqual(ps.map((p) => p.code).sort(), [
    "22028",
    "22029",
    "22030",
    "22031",
    "22031",
  ]);
}

try {
  let state;
  const viewports = (process.env.NEBU_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceViewports = (
    process.env.NEBU_SOURCE_VIEWPORTS || viewports.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.NEBU_FIXTURE_ONLY) {
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
        /Source preconstructed list: Nebula Starter Deck/,
      );
      await capture("nebu-source-deck");
      await audit("Nebula exact source starter");
      await page.keyboard.press("Escape");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .waitFor();
      state = await save();
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, "justice");
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      const physical = physicalCards(state);
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.prompt, null);
      for (const width of sourceViewports)
        await checkpoint("nebu-source-board", width, physical);
      await reload();
      checks.push(
        "Nebula original Justice source launches forty actual cards; source printings and physical IDs survive exact reload",
      );
    }
  }
  const scenarios = (
    process.env.NEBU_SCENARIOS ??
    "ae,protocols,wide,lethal,combat,eros,eros-drone,one-way,thwart,nemesis"
  )
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const supported = new Set([
    "ae",
    "protocols",
    "wide",
    "lethal",
    "combat",
    "eros",
    "eros-drone",
    "one-way",
    "thwart",
    "nemesis",
  ]);
  assert.ok(
    scenarios.every((n) => supported.has(n)),
    "Unknown Nebula scenario",
  );
  assert.ok(!process.env.NEBU_FIXTURE_ONLY || scenarios.length);
  for (const width of viewports) {
    if (scenarios.includes("ae")) {
      const f = fixture("ae");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Cutthroat Ambition");
      await checkpoint("nebula-ship-actual-ae-payment", width, physical);
      await reload();
      await payWith(["Nebula[’']s Ship"]);
      await findChoice(
        (o) => o.id === "yes",
        "Cybernetic Upgrades actual-play response",
      );
      await checkpoint(
        "cybernetic-upgrades-saved-optional-draw",
        width,
        physical,
      );
      await reload();
      await choice("yes");
      state = await skipAll();
      assert.ok(
        f.drawIds.every((id) => state.player.hand.some((p) => p.id === id)),
      );
      assert.equal(state.flags.nebulaCyberneticRound, state.round);
      assert.ok(state.player.inPlay.find((p) => p.id === f.shipId).exhausted);
      await play("Weapons Master");
      await payWith(["Energy"]);
      state = await skipAll();
      assert.ok(state.player.inPlay.some((p) => p.id === f.secondId));
      assert.equal(state.prompt, null);
      await checkpoint(
        "cybernetic-upgrades-once-round-playing-two-techniques",
        width,
        physical,
      );
      await reload();
      console.log("Verified Nebula AE play/draw/Ship at " + width + "px");
    }
    if (scenarios.includes("protocols")) {
      const f = fixture("protocols");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await checkpoint(
        "combat-protocols-required-physical-order",
        width,
        physical,
      );
      await reload();
      await choice(f.cutIds[0]);
      state = await save();
      assert.equal(state.player.confused, false);
      assert.ok(
        f.allIds.every((id) => state.player.inPlay.some((p) => p.id === id)),
      );
      await choice(f.cutIds[1]);
      await choice("main");
      state = await save();
      assert.equal(state.scheme.threat, 3);
      assert.ok(
        f.allIds.every((id) => state.player.inPlay.some((p) => p.id === id)),
      );
      await checkpoint(
        "combat-protocols-resolved-cutthroats-still-active",
        width,
        physical,
      );
      await reload();
      await choice(f.weaponIds[0]);
      assert.equal((await save()).player.stunned, false);
      await choice(f.weaponIds[1]);
      await choice(f.enemyId);
      state = await save();
      assert.equal(state.villain.hp, 38);
      assert.ok(!state.minions.some((p) => p.id === f.enemyId));
      assert.ok(
        f.allIds.every((id) => state.player.inPlay.some((p) => p.id === id)),
      );
      await checkpoint(
        "combat-protocols-continuous-piercing-overkill-before-final-discard",
        width,
        physical,
      );
      await reload();
      await choice(f.evasiveId);
      await choice("villain:confused");
      state = await skipAll();
      assert.equal(state.villain.confused, true);
      assert.ok(
        f.allIds.every((id) => state.player.discard.some((p) => p.id === id)),
      );
      await checkpoint(
        "combat-protocols-final-successful-source-discard",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Nebula native turn/order/status/retained keywords at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("wide")) {
      const f = fixture("wide");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await choice(f.unyieldId);
      state = await save();
      assert.ok(state.player.inPlay.some((p) => p.id === f.unyieldId));
      await choice(f.wideId);
      assert.deepEqual(
        (await save()).encounter.deck.slice(0, 3).map((p) => p.id),
        f.lookIds,
      );
      await checkpoint("wide-stance-actual-top-three-look", width, physical);
      await reload();
      await choice(f.lookIds[1]);
      await checkpoint("wide-stance-exact-survivor-order", width, physical);
      await reload();
      await choice(f.lookIds[2]);
      state = await skipAll();
      assert.deepEqual(
        state.encounter.deck.slice(0, 2).map((p) => p.id),
        [f.lookIds[2], f.lookIds[0]],
      );
      assert.equal(state.encounter.deck.length, f.encounterSize - 1);
      assert.ok(state.encounter.discard.some((p) => p.id === f.lookIds[1]));
      assert.ok(state.player.inPlay.some((p) => p.id === f.unyieldId));
      assert.ok(state.player.discard.some((p) => p.id === f.wideId));
      assert.equal(state.player.tough, true);
      await checkpoint(
        "wide-stance-real-discard-retains-failed-unyielding",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Wide Stance actual look/discard/order and failed Special at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("lethal")) {
      const f = fixture("lethal");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Lethal Intent");
      await checkpoint(
        "lethal-intent-positive-x-before-payment",
        width,
        physical,
      );
      await reload();
      await choice("2");
      await payWith(["Energy"]);
      assert.equal((await save()).prompt.max, 2);
      await checkpoint(
        "lethal-intent-distinct-physical-selection",
        width,
        physical,
      );
      await reload();
      await selection(f.techIds);
      await checkpoint(
        "lethal-intent-mandatory-physical-order",
        width,
        physical,
      );
      await reload();
      for (const id of [...f.techIds].reverse()) {
        await choice(id);
        await choice("villain");
      }
      state = await skipAll();
      assert.equal(state.villain.hp, 32);
      assert.ok(
        f.techIds.every((id) => state.player.inPlay.some((p) => p.id === id)),
      );
      assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      await checkpoint(
        "lethal-intent-actual-paid-x-keeps-techniques",
        width,
        physical,
      );
      await reload();
      console.log("Verified Lethal Intent actual X/order at " + width + "px");
    }
    if (scenarios.includes("combat")) {
      const f = fixture("combat");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Combat Ready");
      if ((await save()).prompt?.kind === "payment") await payWith([]);
      await checkpoint("combat-ready-find-last-original-card", width, physical);
      await reload();
      await choice("find");
      state = await skipAll();
      assert.ok(state.player.inPlay.some((p) => p.id === f.foundId));
      assert.equal(state.player.form, "alter");
      assert.equal(state.player.hand.length, 0);
      assert.equal(state.player.deck.length, 38);
      assert.equal(state.player.tough, true);
      assert.notEqual(state.flags.nebulaCyberneticRound, state.round);
      assert.equal(
        state.encounter.dealt.filter((p) => p.dealtTo === state.activePlayerId)
          .length,
        1,
      );
      await checkpoint(
        "combat-ready-same-id-after-native-deck-reset",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Combat Ready actual last-card/reset/put origin at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("eros")) {
      const f = fixture("eros");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Eros");
      const payment = (await save()).prompt;
      await payWith(["Genius", "Energy"]);
      state = await save();
      assert.equal(state.prompt.title, "Allocate payment resources");
      await checkpoint("eros-real-cost-resource-allocation", width, physical);
      await reload();
      await page.keyboard.press("Escape");
      state = await settle();
      assert.deepEqual(state.prompt, payment);
      assert.ok(
        f.resourceIds.every((id) => state.player.hand.some((p) => p.id === id)),
      );
      await payWith(["Genius", "Energy"]);
      await choice("mental");
      await response("yes", "Eros from-hand paid Mental response");
      await checkpoint(
        "eros-first-actual-mental-minion-choice",
        width,
        physical,
      );
      await reload();
      await choice(f.enemyIds[0]);
      await checkpoint(
        "eros-second-actual-mental-minion-choice",
        width,
        physical,
      );
      await reload();
      await choice(f.enemyIds[1]);
      state = await skipAll();
      assert.ok(
        f.enemyIds.every(
          (id) => state.minions.find((p) => p.id === id).confused,
        ),
      );
      assert.ok(state.player.inPlay.some((p) => p.id === f.eventId));
      await checkpoint(
        "eros-two-cost-mental-excludes-overpaid-icons",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Eros allocated cost/physical status choices at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("eros-drone")) {
      const f = fixture("eros-drone");
      await open(f.state, width);
      const physical = physicalCards(await save());
      assert.equal(physical.length, 40);
      assert.ok(
        (await save()).minions.find((p) => p.id === f.droneId).droneCard.id ===
          f.underlyingId,
      );
      await play("Eros");
      await checkpoint(
        "eros-ultron-drone-actual-player-source-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Genius"]);
      await response("yes", "Eros actual Ultron Drone response");
      const option = (await save()).prompt.options.find(
        (o) => o.id === f.droneId,
      );
      assert.ok(option);
      assert.match(option.label, /Ultron Drone/i);
      await checkpoint(
        "eros-ultron-drone-native-name-and-confuse-choice",
        width,
        physical,
      );
      await reload();
      await choice(f.droneId);
      state = await skipAll();
      const drone = state.minions.find((p) => p.id === f.droneId);
      assert.equal(drone.confused, true);
      assert.equal(drone.droneCard.id, f.underlyingId);
      assert.ok(state.player.inPlay.some((p) => p.id === f.eventId));
      await checkpoint(
        "eros-ultron-drone-status-preserves-underlying-physical-source",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Eros actual Ultron Drone name/status and hidden player source at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("one-way")) {
      const f = fixture("one-way");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("One Way or Another");
      await findChoice(
        (o) => o.id === f.schemeId,
        "One Way or Another before-arrow reveal cost",
      );
      await checkpoint(
        "one-way-or-another-actual-encounter-side-cost",
        width,
        physical,
      );
      await reload();
      await choice(f.schemeId);
      state = await skipAll();
      assert.ok(state.sideSchemes.some((p) => p.id === f.schemeId));
      assert.ok(
        f.drawIds.every((id) => state.player.hand.some((p) => p.id === id)),
      );
      assert.ok(state.player.hand.some((p) => p.id === f.secondId));
      assert.equal(state.flags.nebulaPackOneWayRound, state.round);
      assert.equal(
        await page
          .getByRole("button", {
            name: "Play now: One Way or Another",
            exact: true,
          })
          .count(),
        0,
      );
      await checkpoint(
        "one-way-or-another-cost-before-three-draws-and-round-max",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified One Way or Another real reveal/draw/max at " + width + "px",
      );
    }
    if (scenarios.includes("thwart")) {
      const f = fixture("thwart");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await basic("thwart");
      await target("main");
      await findChoice(
        (o) => o.id === f.eventId,
        "Brains/Justice native after actual basic thwart",
      );
      await checkpoint(
        "brains-justice-shared-last-threat-response",
        width,
        physical,
      );
      await reload();
      await choice(f.eventId);
      await checkpoint(
        "brains-over-brawn-physical-hand-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Energy"]);
      await target("villain");
      await response(f.servedId, "Justice Served physical discard-to-ready");
      state = await skipAll();
      assert.equal(state.villain.hp, 38);
      assert.equal(state.scheme.threat, 0);
      assert.equal(state.player.exhausted, false);
      assert.ok(
        [f.eventId, f.servedId].every((id) =>
          state.player.discard.some((p) => p.id === id),
        ),
      );
      await checkpoint(
        "brains-justice-native-attack-and-physical-ready-cost",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Brains/Justice native response ordering at " + width + "px",
      );
    }
    if (scenarios.includes("nemesis")) {
      const f = fixture("nemesis");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await checkpoint(
        "inferiority-complex-physical-forced-flip",
        width,
        physical,
      );
      await reload();
      await choice("flip");
      assert.equal((await save()).player.flipped, false);
      await choice("techniques");
      await checkpoint(
        "inferiority-complex-actual-technique-discard-cost",
        width,
        physical,
      );
      await reload();
      await selection(f.techIds);
      state = await skipAll();
      assert.equal(state.player.form, "alter");
      assert.equal(state.player.flipped, false);
      assert.ok(state.player.discard.some((p) => p.id === f.allyId));
      assert.ok(state.minions.some((p) => p.code === "22028"));
      assert.equal(
        state.sideSchemes.find((p) => p.code === "22029").counters,
        2,
      );
      const nemesisIds = nemesisPieces(state)
        .map((p) => p.id)
        .sort();
      nemesisConserved(state, nemesisIds);
      await checkpoint(
        "nebula-original-nemesis-and-gamora-ally-replacement",
        width,
        physical,
      );
      await reload();
      nemesisConserved(await save(), nemesisIds);
      console.log(
        "Verified Nebula obligation/actual five nemesis pieces at " +
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
        " flow preserves the original physical source composition through saved choices/payments and exact reload at " +
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
