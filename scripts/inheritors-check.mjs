import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.INHERITORS_OUTPUT || "output/inheritors/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const defaults = [
  "hunting-team",
  "hunting-fallback",
  "bora-morlun",
  "guard-patrol",
  "stalwart",
  "karn-attack",
  "verna-retaliate",
  "reveal-bora",
  "reveal-brix",
  "reveal-daemos",
  "reveal-jennix",
  "reveal-karn",
  "reveal-morlun",
  "reveal-solus",
  "reveal-verna",
  "reveal-no-web-warrior",
];
const scenarios = (process.env.INHERITORS_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.INHERITORS_VIEWPORTS || "1920,1440,1280,390")
  .split(",")
  .map(Number);
assert.ok(
  scenarios.length && scenarios.every((kind) => defaults.includes(kind)),
);
assert.ok(widths.length && widths.every((width) => width >= 320));
await mkdir(output, { recursive: true });
for (const name of [
  "report.json",
  "failure.json",
  "failure.png",
  "failure-save.json",
  "failure-body.txt",
])
  await rm(`${output}/${name}`, { force: true });

// Every fixture starts with the real original source deck and encounter pool.
// Moving these pieces into a focused legal position never creates extra cards.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card} from './src/game/cards.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
export function isPlayerDeckPiece(p){return ['event','resource','ally','support','upgrade'].includes(card(p)?.type_code);}
export function definition(p){return card(p);}
export function sourceCodes(id){return heroStarterCodes(id).sort();}
export function payment(s){const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);}
export function fixture(kind){
 const global=kind.startsWith('reveal-')&&kind!=='reveal-no-web-warrior';
 const configs=kind==='hunting-team'?['ghost_spider','spider_man_morales']:kind==='stalwart'?['spider_man_morales','nova']:global||kind==='guard-patrol'||kind==='karn-attack'?['nova','spider_man_morales']:['nova'];
 const heroes=configs.map(heroId=>({heroId,aspect:heroId==='nova'?'aggression':heroId==='ghost_spider'?'protection':'justice',deckCards:heroStarterCodes(heroId)}));
 let s=newGame({...heroes[0],heroes,villainId:'rhino',module:'inheritors',seed:30030,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
 for(let n=0;s.phase==='mulligan'&&n<20;n++){if(s.prompt)throw Error('Unexpected native setup choice '+s.prompt.title);command({type:'MULLIGAN',ids:[]});}
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native source setup incomplete');
 const sources=s.players.map(seat=>{const p=seatView(s,seat).player;const cards=[...p.hand,...p.deck,...p.discard,...p.inPlay].map(p=>({id:p.id,code:p.code}));if(cards.length!==40)throw Error('Original source must contain forty actual cards');return{seatId:seat.id,heroId:seat.heroId,cards,codes:heroStarterCodes(seat.heroId).sort()};});
 const modular=s.encounter.deck.filter(p=>card(p).set_code==='inheritors').map(p=>({id:p.id,code:p.code}));if(modular.length!==9)throw Error('Exactly nine actual Inheritors modular pieces required');
 for(const seat of s.players){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=10;p.exhausted=false;p.flipped=false;}
 activateSeat(s,'p1');s.villain.hp=s.villain.maxHp=50;s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 function player(id='p1'){return seatView(s,id).player;}
 function take(code,id='p1'){const p=player(id);for(const zone of[p.hand,p.deck,p.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual source '+code+' for '+id);}
 function hand(codes,id='p1'){const ps=codes.map(code=>take(code,id));player(id).hand.push(...ps);return ps;}
 function put(code,id='p1'){const p=take(code,id);p.exhausted=false;player(id).inPlay.push(p);return p;}
 function encounter(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual encounter '+code);}
 function minion(code,id='p1'){const p=encounter(code);p.engagedWith=id;s.minions.push(p);return p;}
 function scheme(){const p=encounter('30030');p.counters=6;s.sideSchemes.push(p);return p;}
 function native(effects){s.prompt={kind:'choice',title:'Resolve encounter',text:'Resolve the actual source encounter card.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code){const p=encounter(code);s.resolving.push(p);native([{type:'reveal',piece:p,skip:true}]);return p;}
 function begin(){native([{type:'beginVillain',actorId:s.firstPlayerId}]);}
 let ids={};
 if(global){player('p2').form='alter';ids.webWarriorId=put('27048','p2').id;ids.allyId=put('28002').id;}
 if(kind==='hunting-team'){
  const hunt=scheme(),first=encounter('30033'),middle=encounter('01186'),second=encounter('30034');s.encounter.deck.unshift(first,middle,second);begin();ids={schemeId:hunt.id,firstId:first.id,middleId:middle.id,secondId:second.id};
 }else if(kind==='hunting-fallback'){
  const hunt=scheme(),cards=['30035','30036','30038'].map(encounter);s.encounter.deck.unshift(...cards);ids={schemeId:hunt.id,minionIds:cards.map(p=>p.id),allyId:put('28002').id,supportId:put('28008').id};begin();
 }else if(kind==='bora-morlun'){
  const bora=minion('30031'),morlun=minion('30036');morlun.damage=1;const[event,resource]=hand(['28005','28007']);ids={boraId:bora.id,morlunId:morlun.id,eventId:event.id,resourceIds:[resource.id]};
 }else if(kind==='guard-patrol'){
  const bora=minion('30031'),brix=minion('30032','p2'),jennix=minion('30034','p2'),hunt=scheme();brix.damage=1;jennix.damage=2;s.scheme.threat=4;const[thwart,first,second,r1,r2,r3]=hand(['28004','28005','28005','28007','28007','28015']);ids={boraId:bora.id,brixId:brix.id,jennixId:jennix.id,schemeId:hunt.id,thwartId:thwart.id,eventIds:[first.id,second.id],resourceIds:[r1.id,r2.id,r3.id]};
 }else if(kind==='stalwart'){
  const solus=minion('30037'),daemos=minion('30033','p2');s.scheme.threat=6;const[shot,swing,energy,genius]=hand(['27034','27033','27051','27052']);ids={solusId:solus.id,daemosId:daemos.id,eventIds:[shot.id,swing.id],energyId:energy.id,geniusId:genius.id};
 }else if(kind==='karn-attack'){
  const karn=minion('30035','p2'),morlun=minion('30036'),ally=put('28002');ally.damage=2;ally.tough=true;ally.toughCards=1;native([{type:'enemyAttack',id:morlun.id,actorId:'p1'}]);ids={karnId:karn.id,morlunId:morlun.id,allyId:ally.id};
 }else if(kind==='verna-retaliate'){
  const bora=minion('30031'),verna=minion('30038');ids={boraId:bora.id,vernaId:verna.id};
 }else if(kind==='reveal-bora'){
  ids.schemeId=scheme().id;ids.enemyId=reveal('30031').id;
 }else if(kind==='reveal-brix'){
  ids.enemyId=reveal('30032').id;
 }else if(kind==='reveal-daemos'){
  ids.enemyId=reveal('30033').id;
 }else if(kind==='reveal-jennix'){
  const[event,resource]=hand(['28005','28007']);ids={...ids,eventId:event.id,resourceIds:[resource.id],enemyId:reveal('30034').id};
 }else if(kind==='reveal-karn'){
  ids.upgradeId=put('28016').id;ids.supportId=put('28008').id;ids.enemyId=reveal('30035').id;
 }else if(kind==='reveal-morlun'){
  ids.enemyId=reveal('30036').id;
 }else if(kind==='reveal-solus'){
  player('p2').form='hero';
  const stored=encounter('30031'),normal=encounter('30032'),minionBoost=encounter('30035');s.encounter.deck.unshift(stored,normal,minionBoost);ids={...ids,storedId:stored.id,normalId:normal.id,minionBoostId:minionBoost.id,enemyId:reveal('30037').id};
 }else if(kind==='reveal-verna'){
  ids.enemyId=reveal('30038').id;
 }else if(kind==='reveal-no-web-warrior'){
  ids.allyId=put('28002').id;ids.upgradeId=put('28016').id;ids.supportId=put('28008').id;ids.schemeId=scheme().id;const ps=['30031','30032','30033','30034','30035','30036','30037','30038'].map(encounter);s.resolving.push(...ps);native(ps.map(piece=>({type:'reveal',piece,skip:true})));ids.minionIds=ps.map(p=>p.id);
 }else throw Error('Unknown reviewed fixture '+kind);
 syncSeat(s);return{state:s,sources,modular,identities:[],...ids};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const { fixture, payment, definition, sourceCodes, isPlayerDeckPiece } =
  await import(pathToFileURL(fixturePath).href);

function allPieces(s) {
  const nested = (p) => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
    ...(p.inheritorBoosts || []).flatMap(nested),
  ];
  return [
    ...s.players.flatMap((seat) => {
      const p = seat.id === s.activePlayerId ? s.player : seat.player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  ].flatMap(nested);
}
function conserved(state, f, label) {
  const pieces = allPieces(state);
  for (const original of [
    ...f.sources.flatMap((source) => source.cards),
    ...f.modular,
    ...f.identities,
  ]) {
    const matches = pieces.filter((p) => p.id === original.id);
    assert.equal(
      matches.length,
      1,
      `${label}: ${original.code}:${original.id} has exactly one physical zone`,
    );
    assert.equal(
      matches[0].code,
      original.code,
      `${label}: original printing preserved`,
    );
  }
  for (const source of f.sources) {
    assert.equal(source.cards.length, 40);
    assert.equal(new Set(source.cards.map((p) => p.id)).size, 40);
    assert.deepEqual(
      source.cards.map((p) => p.code).sort(),
      source.codes,
      `${label}: exact original source forty`,
    );
  }
  assert.deepEqual(
    pieces
      .filter(isPlayerDeckPiece)
      .map((p) => p.id)
      .sort(),
    f.sources.flatMap((source) => source.cards.map((p) => p.id)).sort(),
    `${label}: no extra or missing original player-deck cards`,
  );
  assert.equal(f.modular.length, 9);
  assert.deepEqual([...new Set(f.modular.map((p) => p.code))].sort(), [
    "30030",
    "30031",
    "30032",
    "30033",
    "30034",
    "30035",
    "30036",
    "30037",
    "30038",
  ]);
}
if (process.env.INHERITORS_FIXTURE_CHECK) {
  const prepared = scenarios.map((kind) => {
    const f = fixture(kind);
    conserved(f.state, f, kind);
    return {
      kind,
      sourceCards: f.sources.map((source) => ({
        seatId: source.seatId,
        cards: source.cards.length,
      })),
      modularCards: f.modular.length,
    };
  });
  await writeFile(
    `${output}/fixture-preparation-report.json`,
    JSON.stringify(
      { preparationOnly: true, productionBrowserVerified: false, prepared },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      preparationOnly: true,
      productionBrowserVerified: false,
      fixtures: prepared.length,
    }),
  );
  process.exit(0);
}

const browser = await chromium.launch({ headless: true });
const require = createRequire(import.meta.url);
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
const entryAssets = new Set();
let context, page, current;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function open(f, width) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width > 1000 ? 1000 : 844 },
    reducedMotion: "reduce",
    ignoreHTTPSErrors: process.env.INHERITORS_IGNORE_HTTPS_ERRORS === "1",
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("inheritors-fixture-loaded")) return;
    sessionStorage.setItem("inheritors-fixture-loaded", "yes");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
  }, f?.state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const src of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((s) => s.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(src)) entryAssets.add(src);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.INHERITORS_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.INHERITORS_ASSET),
      ),
      "Expected immutable production entry",
    );
  }
  if (!f) return;
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.equal(
    await page.locator(".milestone-animation").count(),
    0,
    "Resume never replays a milestone",
  );
  conserved(await save(), f, "actual resume");
}
async function settle() {
  for (let n = 0; n < 80; n++) {
    const state = await save();
    assert.ok(!state.error, state.error);
    if (!state.review) return state;
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  }
  throw Error("Native review queue did not settle");
}
async function choice(id) {
  const state = await save();
  assert.equal(state.prompt?.kind, "choice", JSON.stringify(state.prompt));
  const index = state.prompt.options.findIndex((option) => option.id === id);
  assert.ok(
    index >= 0,
    `${state.prompt.title}: missing exact native choice ${id}`,
  );
  await page.locator(".decision-option").nth(index).click();
  return settle();
}
async function finishChoices() {
  for (let n = 0; n < 60; n++) {
    const state = await save();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const pass = state.prompt.options.find((o) =>
      /^(pass|skip|none|done|continue|no|take)$/.test(o.id),
    );
    if (pass) await choice(pass.id);
    else if (state.prompt.options.length === 1)
      await choice(state.prompt.options[0].id);
    else
      throw Error("Unresolved native choice: " + JSON.stringify(state.prompt));
  }
  throw Error("Native choices did not finish");
}
async function findChoice(predicate, label) {
  for (let n = 0; n < 15; n++) {
    const state = await save();
    assert.equal(
      state.prompt?.kind,
      "choice",
      `${label}: native choice required`,
    );
    if (state.prompt.options.some(predicate)) return state;
    const pass = state.prompt.options.find((o) =>
      /^(pass|skip|continue|no)$/.test(o.id),
    );
    assert.ok(
      pass,
      `${label}: unexpected blocking choice ${JSON.stringify(state.prompt)}`,
    );
    await choice(pass.id);
  }
  throw Error(`${label}: native choice not reached`);
}
async function reload() {
  const before = await save();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await save(),
    before,
    "Exact native prompt, receipt, queue and physical IDs survive JSON reload",
  );
  assert.equal(
    await page.locator(".milestone-animation").count(),
    0,
    "Reload never replays a milestone",
  );
}
async function paymentSource(id) {
  const state = await save();
  assert.equal(state.prompt?.kind, "payment");
  const sources = payment(state),
    source = sources.find((p) => p.id === id);
  assert.ok(source, "Exact original physical payment source " + id);
  const index = sources
    .filter((p) => p.kind === source.kind)
    .findIndex((p) => p.id === id);
  const button = page
    .locator(`.payment-source-group.${source.kind}-sources .payment-source`)
    .nth(index);
  assert.equal(
    await button.getAttribute("aria-label"),
    `${source.name} · ${source.resources.join(" + ")} · ${source.description}`,
  );
  return button;
}
async function pay(ids) {
  for (const id of ids) await (await paymentSource(id)).click();
  const confirm = page.getByRole("button", {
    name: "Confirm payment",
    exact: true,
  });
  assert.equal(
    await confirm.isDisabled(),
    false,
    "The actual printed cost is fully paid",
  );
  await confirm.click();
  return settle();
}
async function minionStats(code, attack, health, damage = 0) {
  const enemy = page.locator(".enemy-unit").filter({
    has: page.locator('.minion-card-face img[src*="' + code + '"]'),
  });
  assert.equal(
    await enemy.count(),
    1,
    "One actual physical " + code + " on the table",
  );
  assert.equal(
    await enemy.locator(".minion-health").getAttribute("aria-label"),
    health - damage + " of " + health + " hit points remaining",
  );
  assert.equal(
    await enemy.locator(".minion-attack b").innerText(),
    String(attack),
    "Printed ATK plus live Inheritor aura",
  );
}
async function play(name) {
  await page
    .getByRole("button", { name: "Play now: " + name, exact: true })
    .first()
    .click();
  return settle();
}
async function basic(action) {
  await page.locator("." + action + "-action").click();
  return settle();
}
async function target(id) {
  await findChoice((o) => o.id === id, "Actual target " + id);
  return choice(id);
}
async function defense() {
  return findChoice(
    (o) => o.id === "take" && /Take the attack/.test(o.label),
    "Native defense declaration",
  );
}
async function beginVillainPhase() {
  const initial = await save();
  if (initial.playerCount === 1) {
    await page
      .getByRole("button", { name: "End hero phase", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Begin villain phase", exact: true })
      .click();
    return settle();
  }
  for (let n = 0; n < initial.playerCount; n++) {
    const state = await save();
    if (state.phase !== "player") return state;
    assert.ok(
      !state.prompt,
      "Complete each actual hero turn before the shared villain phase",
    );
    await page
      .getByRole("button", { name: "End hero turn", exact: true })
      .click();
    await settle();
  }
  for (let n = 0; n < initial.playerCount; n++) {
    const state = await save();
    if (state.prompt?.kind !== "select") break;
    assert.match(state.prompt.title, /end of hero phase/);
    assert.equal(
      state.prompt.min,
      0,
      "These original source fixtures have no mandatory hand discard",
    );
    await page.getByRole("button", { name: /Confirm selection/ }).click();
    await settle();
  }
  const state = await save();
  assert.equal(
    state.phase,
    "villain",
    "Both native end-of-phase discard selections precede the shared villain phase",
  );
  return state;
}
async function checkpoint(name, width, f) {
  const state = await save();
  conserved(state, f, name);
  await page.mouse.move(4, 4);
  await page.locator(".card-hover-preview").waitFor({ state: "hidden" });
  await page.locator(".combat-cinematic").waitFor({ state: "hidden" });
  await page.locator(".milestone-animation").waitFor({ state: "hidden" });
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
    document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
      (dialog) => ({ width: dialog.clientWidth, content: dialog.scrollWidth }),
    ),
    encounterActions: [
      ...document.querySelectorAll(
        ".attached-piece .text-button, .scenario-environment button:not(.environment-card)",
      ),
    ].map((button) => {
      const rect = button.getBoundingClientRect();
      const host = button
        .closest(".attached-piece, .scenario-environment")
        .getBoundingClientRect();
      return {
        label: button.getAttribute("aria-label") || button.textContent,
        left: rect.left,
        right: rect.right,
        hostLeft: host.left,
        hostRight: host.right,
      };
    }),
  }));
  layouts.push({ name, ...metrics });
  assert.ok(metrics.document <= width + 1, `${name}: horizontal page overflow`);
  assert.ok(
    metrics.dialogs.every((dialog) => dialog.content <= dialog.width + 1),
    `${name}: dialog overflow ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    metrics.encounterActions.every(
      (action) =>
        action.left >= Math.max(0, action.hostLeft) - 1 &&
        action.right <= Math.min(width, action.hostRight) + 1,
    ),
    `${name}: encounter action clipped ${JSON.stringify(metrics.encounterActions)}`,
  );
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
    width,
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
    `${name}: accessibility ${JSON.stringify(audits.at(-1))}`,
  );
  await page.screenshot({
    path: `${output}/${name}-${width}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
function seat(state, id) {
  return state.activePlayerId === id
    ? state.player
    : state.players.find((seat) => seat.id === id).player;
}

try {
  if (!process.env.INHERITORS_FIXTURE_ONLY) {
    for (const width of widths) {
      current = { kind: "modular-selector", width };
      await open(null, width);
      const select = page.getByLabel("Modular encounter");
      assert.equal(
        await select.locator('option[value="inheritors"]').count(),
        1,
        "Public modular selector exposes the complete imported set",
      );
      assert.equal(
        await select.locator('option[value="inheritors"]').innerText(),
        "The Inheritors",
      );
      await select.selectOption("inheritors");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      let state = await settle();
      state = await finishChoices();
      assert.equal(state.module, "inheritors");
      const modular = allPieces(state)
        .filter((p) => definition(p).set_code === "inheritors")
        .map((p) => ({ id: p.id, code: p.code }));
      const cards = [
        ...state.player.hand,
        ...state.player.deck,
        ...state.player.discard,
        ...state.player.inPlay,
      ].map((p) => ({ id: p.id, code: p.code }));
      const f = {
        sources: [
          {
            seatId: state.activePlayerId,
            heroId: state.heroId,
            cards,
            codes: sourceCodes(state.heroId),
          },
        ],
        modular,
        identities: [],
      };
      assert.equal(
        cards.length,
        40,
        "Public setup retains its actual forty-card starter",
      );
      await checkpoint("modular-selector-original-source-board", width, f);
      await reload();
      checks.push({
        kind: "modular-selector",
        width,
        modularCards: modular.length,
        sourceCards: 40,
        exactReload: true,
      });
    }
  }
  for (const kind of scenarios)
    for (const width of widths) {
      current = { kind, width };
      const f = fixture(kind);
      await open(f, width);
      let state;
      if (kind === "hunting-team") {
        await choice("go");
        state = await findChoice(
          (o) => o.id === "p1",
          "First eligible Web-Warrior recipient",
        );
        assert.equal(state.prompt.title, "Hunting the Spider-Totems");
        assert.deepEqual(state.prompt.options.map((o) => o.id).sort(), [
          "p1",
          "p2",
        ]);
        assert.equal(
          state.scheme.threat,
          0,
          "Forced interrupt precedes main-scheme threat",
        );
        await checkpoint(kind + "-first-recipient", width, f);
        await reload();
        await choice("p2");
        state = await findChoice(
          (o) => o.id === "p1",
          "Second eligible Web-Warrior recipient",
        );
        assert.equal(state.scheme.threat, 0);
        assert.equal(
          state.minions.find((p) => p.id === f.firstId).engagedWith,
          "p2",
        );
        await checkpoint(kind + "-second-recipient", width, f);
        await reload();
        await choice("p1");
        state = await defense();
        assert.equal(
          state.minions.find((p) => p.id === f.secondId).engagedWith,
          "p1",
        );
        assert.equal(
          state.minions.find((p) => p.id === f.secondId).tough,
          false,
          "Put into play never runs Jennix When Revealed",
        );
        assert.ok(
          state.players.every((p) => !seat(state, p.id).stunned),
          "Put into play never runs Daemos When Revealed",
        );
        assert.ok(
          state.encounter.discard.some((p) => p.id === f.middleId),
          "The actual non-Inheritor among the three remains discarded",
        );
        assert.equal(
          state.scheme.threat,
          2,
          "Ordinary per-player main threat follows both native recipient choices",
        );
      } else if (kind === "hunting-fallback") {
        await choice("go");
        state = await defense();
        assert.ok(
          f.minionIds.every((id) =>
            state.minions.some((p) => p.id === id && p.engagedWith === "p1"),
          ),
          "All three physical Inheritors fall back to the first player",
        );
        assert.equal(
          state.player.hp,
          10,
          "Putting Morlun and Verna into play triggers no reveal damage",
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          0,
        );
        assert.ok(
          state.player.inPlay.some((p) => p.id === f.supportId),
          "Putting Karn into play triggers no controlled-card discard",
        );
      } else if (kind === "bora-morlun") {
        await minionStats("30031", 2, 5);
        await minionStats("30036", 3, 5, 1);
        await play("Pot Shot");
        await pay(f.resourceIds);
        await target(f.morlunId);
        state = await finishChoices();
        assert.ok(state.encounter.discard.some((p) => p.id === f.morlunId));
        await minionStats("30031", 1, 5);
        await checkpoint(kind + "-aura-source-defeated", width, f);
        await reload();
        await beginVillainPhase();
        state = await defense();
        assert.equal(
          state.scheme.threat,
          2,
          "One living Inheritor contributes one dynamic Bora acceleration icon",
        );
      } else if (kind === "guard-patrol") {
        await play("Lightspeed Flight");
        await pay([f.resourceIds[0]]);
        state = await findChoice(
          (o) => o.id === f.schemeId,
          "Patrol permits side schemes",
        );
        assert.ok(
          !state.prompt.options.some((o) => o.id === "main"),
          "A remote Brix grants patrol to the locally engaged Inheritor",
        );
        await checkpoint(kind + "-patrol-targets", width, f);
        await reload();
        await choice(f.schemeId);
        await finishChoices();
        await play("Pot Shot");
        await pay([f.resourceIds[1]]);
        state = await findChoice(
          (o) => o.id === f.jennixId,
          "Guarded actual attack",
        );
        assert.ok(
          !state.prompt.options.some((o) => o.id === state.villain.id),
          "A remote Jennix grants guard to the locally engaged Inheritor",
        );
        await checkpoint(kind + "-guard-targets", width, f);
        await reload();
        await choice(f.jennixId);
        await finishChoices();
        await play("Pot Shot");
        await pay([f.resourceIds[2]]);
        state = await findChoice(
          (o) => o.id === f.brixId,
          "Attack after Jennix leaves",
        );
        assert.ok(
          state.prompt.options.some((o) => o.id === state.villain.id),
          "Guard disappears immediately when its actual source leaves play",
        );
        await choice(f.brixId);
        await finishChoices();
        await basic("thwart");
        await target("main");
        state = await finishChoices();
        assert.equal(
          state.scheme.threat,
          3,
          "Main-scheme thwart becomes legal when Brix leaves play",
        );
        assert.ok(
          state.encounter.discard.some((p) => p.id === f.brixId) &&
            state.encounter.discard.some((p) => p.id === f.jennixId),
        );
      } else if (kind === "stalwart") {
        await play("Web-Shot");
        await pay([f.energyId]);
        await target(f.solusId);
        await target(f.solusId);
        state = await finishChoices();
        assert.equal(state.minions.find((p) => p.id === f.solusId).damage, 6);
        assert.equal(
          state.minions.find((p) => p.id === f.solusId).stunned,
          false,
          "Remote Daemos grants stalwart during actual paid Web-Shot",
        );
        await checkpoint(kind + "-native-stun-prevented", width, f);
        await reload();
        await play("Swing In");
        await pay([f.geniusId]);
        await target("main");
        state = await findChoice(
          (o) => o.id === state.villain.id,
          "Spider Camouflage eligible enemy",
        );
        assert.ok(
          !state.prompt.options.some(
            (o) => o.id === f.solusId || o.id === f.daemosId,
          ),
          "Native confusion choices exclude both actual stalwart Inheritors",
        );
        await choice(state.villain.id);
        state = await finishChoices();
        assert.equal(
          state.villain.confused,
          true,
          "The actual legal non-Inheritor can still receive confusion",
        );
        assert.equal(
          state.minions.find((p) => p.id === f.solusId).confused,
          false,
          "The same live aura prevents actual native confusion",
        );
        assert.equal(state.scheme.threat, 2);
      } else if (kind === "karn-attack") {
        await choice("go");
        await defense();
        await checkpoint(kind + "-actual-tough-defender", width, f);
        await reload();
        await choice(f.allyId);
        state = await finishChoices();
        assert.ok(
          state.player.discard.some((p) => p.id === f.allyId),
          "Piercing removes actual ally Tough before lethal attack damage",
        );
        assert.equal(
          state.player.hp,
          8,
          "Three attack against one remaining ally HP sends two overkill damage to the identity",
        );
        assert.equal(
          seat(state, "p2").hp,
          10,
          "The remote Karn source does not change the attacked player",
        );
      } else if (kind === "verna-retaliate") {
        await basic("attack");
        await target(f.boraId);
        state = await finishChoices();
        assert.equal(state.minions.find((p) => p.id === f.boraId).damage, 1);
        assert.equal(
          state.player.hp,
          9,
          "Actual attack on another Inheritor triggers granted retaliate 1",
        );
      } else if (kind === "reveal-no-web-warrior") {
        await choice("go");
        state = await finishChoices();
        assert.equal(state.minions.length, 8);
        assert.equal(state.player.hp, 10);
        assert.equal(state.player.stunned, false);
        assert.equal(state.scheme.threat, 0);
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          6,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          0,
        );
        assert.ok(
          state.player.inPlay.some((p) => p.id === f.upgradeId) &&
            state.player.inPlay.some((p) => p.id === f.supportId),
        );
        assert.ok(
          state.minions.every(
            (p) => !p.tough && !(p.inheritorBoosts || []).length,
          ),
          "No Web-Warrior means all eight conditional reveal effects remain inactive",
        );
      } else {
        await choice("go");
        if (kind === "reveal-daemos") {
          state = await findChoice(
            (o) => o.id === f.allyId,
            "Daemos controlled stun recipient",
          );
          assert.ok(
            !state.prompt.options.some((o) => o.id === f.webWarriorId),
            "Global Web-Warrior condition does not change the recipient controller",
          );
          await checkpoint(kind + "-native-character-choice", width, f);
          await reload();
          await choice(f.allyId);
          state = await finishChoices();
          assert.equal(
            state.player.inPlay.find((p) => p.id === f.allyId).stunned,
            true,
          );
          assert.equal(state.player.stunned, false);
        } else if (kind === "reveal-karn") {
          state = await findChoice(
            (o) => o.id === f.upgradeId,
            "Karn actual controlled discard",
          );
          assert.ok(state.prompt.options.some((o) => o.id === f.supportId));
          assert.ok(
            !state.prompt.options.some(
              (o) => o.id === f.allyId || o.id === f.webWarriorId,
            ),
          );
          await checkpoint(kind + "-native-controlled-card-choice", width, f);
          await reload();
          await choice(f.upgradeId);
          state = await finishChoices();
          assert.ok(state.player.discard.some((p) => p.id === f.upgradeId));
          assert.ok(state.player.inPlay.some((p) => p.id === f.supportId));
        } else {
          state = await finishChoices();
          if (kind === "reveal-bora") {
            assert.equal(state.scheme.threat, 1);
            assert.equal(
              state.sideSchemes.find((p) => p.id === f.schemeId).counters,
              7,
            );
          } else if (kind === "reveal-brix")
            assert.equal(state.scheme.threat, 2);
          else if (kind === "reveal-jennix") {
            assert.equal(
              state.minions.find((p) => p.id === f.enemyId).tough,
              true,
            );
            await checkpoint(kind + "-actual-reveal-tough", width, f);
            await reload();
            await play("Pot Shot");
            await pay(f.resourceIds);
            await target(f.enemyId);
            state = await finishChoices();
            assert.equal(
              state.minions.find((p) => p.id === f.enemyId).tough,
              false,
            );
            assert.equal(
              state.minions.find((p) => p.id === f.enemyId).damage,
              0,
              "Actual Tough prevents the paid attack",
            );
          } else if (kind === "reveal-morlun") assert.equal(state.player.hp, 8);
          else if (kind === "reveal-verna") {
            assert.equal(state.player.hp, 9);
            assert.equal(
              state.player.inPlay.find((p) => p.id === f.allyId).damage,
              1,
            );
            assert.equal(
              seat(state, "p2").inPlay.find((p) => p.id === f.webWarriorId)
                .damage,
              0,
              "Each controlled character means the revealed-to player only",
            );
          } else if (kind === "reveal-solus") {
            assert.deepEqual(
              state.minions
                .find((p) => p.id === f.enemyId)
                .inheritorBoosts.map((p) => p.id),
              [f.storedId],
              "The exact top encounter becomes Solus physical facedown boost",
            );
            const solus = page.locator(".enemy-unit").filter({
              has: page.locator('.minion-card-face img[src*="30037"]'),
            });
            assert.equal(
              await solus
                .getByText("1 FACEDOWN BOOST", { exact: true })
                .count(),
              1,
              "The actual table displays Solus stored boost count",
            );
            await minionStats("30037", 3, 7);
            await checkpoint(kind + "-actual-stored-boost", width, f);
            await reload();
            // The real villain phase consumes Rhino's normal boost first,
            // then gives the original Solus its stored and villainous boosts.
            await beginVillainPhase();
            state = await defense();
            await choice("hero");
            state = await defense();
            assert.equal(state.attack.attacker, f.enemyId);
            assert.equal(
              state.attack.base,
              3,
              "Solus actual native attack starts with its printed ATK",
            );
            const pending = state.attack.pendingBoosts.map((p) => p.id);
            assert.ok(
              pending.includes(f.storedId) &&
                pending.includes(f.minionBoostId) &&
                pending.length === 2,
              "The stored Solus card joins its own ordinary villainous boost",
            );
            assert.equal(
              state.minions.find((p) => p.id === f.enemyId).inheritorBoosts
                .length,
              0,
              "Actual stored boost leaves the minion when used",
            );
            await checkpoint(kind + "-actual-villainous-attack", width, f);
            await reload();
            await choice(f.allyId);
            state = await defense();
            assert.ok(
              seat(state, "p1").discard.some((p) => p.id === f.allyId),
              "The actual seven-damage boosted Solus attack defeats its original owner's defender",
            );
            assert.ok(
              state.encounter.discard.some((p) => p.id === f.storedId) &&
                state.encounter.discard.some((p) => p.id === f.minionBoostId),
              "Consumed physical stored boost is discarded normally",
            );
          }
        }
        assert.equal(
          seat(state, "p2").hp,
          10,
          "Another seat controls the Web-Warrior which enables the original revealed-to player effect",
        );
      }
      state = await save();
      assert.ok(!state.error, state.error);
      await checkpoint(kind + "-native-result", width, f);
      await reload();
      checks.push({
        kind,
        width,
        sourceCards: f.sources.map((source) => ({
          seatId: source.seatId,
          cards: source.cards.length,
        })),
        modularCards: f.modular.length,
        exactReload: true,
      });
      console.log("Verified native Inheritors " + kind + " at " + width + "px");
    }
  assert.deepEqual(errors, []);
  const entryProof = [];
  for (const asset of entryAssets) {
    const response = await context.request.get(asset);
    assert.equal(
      response.status(),
      200,
      "Served immutable production entry bytes",
    );
    const sha256 = createHash("sha256")
      .update(await response.body())
      .digest("hex");
    if (process.env.INHERITORS_SHA256)
      assert.equal(
        sha256,
        process.env.INHERITORS_SHA256,
        "Expected actual production entry SHA256",
      );
    entryProof.push({ url: asset, sha256 });
  }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        checks,
        audits,
        layouts,
        errors,
        entryAssets: [...entryAssets],
        entryProof,
        viewports: widths,
        scenarios,
      },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      checks: checks.length,
      audits: audits.length,
      layouts: layouts.length,
      errors,
      entryProof,
    }),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      {
        message: String(error),
        current,
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
  if (page) {
    await page
      .screenshot({ path: `${output}/failure.png`, fullPage: true })
      .catch(() => {});
    await writeFile(
      `${output}/failure-save.json`,
      JSON.stringify(await save(), null, 2),
    ).catch(() => {});
    await writeFile(
      `${output}/failure-body.txt`,
      await page.locator("body").innerText(),
    ).catch(() => {});
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  await browser.close();
}
