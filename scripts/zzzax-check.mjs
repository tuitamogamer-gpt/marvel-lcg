import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.ZZZAX_OUTPUT || "output/zzzax/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const defaults = [
  "feedback-team",
  "dynamic-discard",
  "dynamic-blank",
  "haywire-payment",
  "haywire-indirect",
  "haywire-other-seat",
  "air-static",
  "zzzap-ally",
  "zzzap-tough",
];
const scenarios = (process.env.ZZZAX_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.ZZZAX_VIEWPORTS || "1440,1280,390,320")
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
import {zzzaxEnemyStats,zzzaxHandEnergy,zzzaxControlledEnergy} from './src/game/zzzax.ts';
export function isPlayerDeckPiece(p){return ['event','resource','ally','support','upgrade'].includes(card(p)?.type_code);}
export function payment(s){const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);}
export function observation(s,id){const p=s.minions.find(p=>p.id===id);const b=p?zzzaxEnemyStats(s,p):{};return{attack:p?card(p).attack+(b.attack||0):null,health:p?card(p).health+(b.health||0):null,handEnergy:zzzaxHandEnergy(s),controlledEnergy:zzzaxControlledEnergy(s)};}
export function fixture(kind){
 const team=kind==='feedback-team'||kind==='air-static'||kind==='haywire-other-seat';
 const heroId=kind==='dynamic-blank'?'ironheart':'nova';
 const heroes=team?[{heroId:'nova',aspect:'aggression',deckCards:heroStarterCodes('nova')},{heroId:'ironheart',aspect:'leadership',deckCards:heroStarterCodes('ironheart')}]:[{heroId,aspect:heroId==='nova'?'aggression':'leadership',deckCards:heroStarterCodes(heroId)}];
 let s=newGame({heroId,aspect:heroes[0].aspect,heroes,villainId:'rhino',module:'zzzax',seed:29037,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
 for(let n=0;s.phase==='mulligan'&&n<20;n++){if(s.prompt)throw Error('Unexpected native setup choice '+s.prompt.title);command({type:'MULLIGAN',ids:[]});}
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native source setup incomplete');
 const sources=s.players.map(seat=>{const p=seatView(s,seat).player;const cards=[...p.hand,...p.deck,...p.discard,...p.inPlay].map(p=>({id:p.id,code:p.code}));if(cards.length!==40)throw Error('Original source must contain forty actual cards');return{seatId:seat.id,heroId:seat.heroId,cards,codes:heroStarterCodes(seat.heroId).sort()};});
 const modular=s.encounter.deck.filter(p=>card(p).set_code==='zzzax').map(p=>({id:p.id,code:p.code}));if(modular.length!==7)throw Error('Exactly seven actual Zzzax modular pieces required');
 const identities=s.players.flatMap(seat=>{const p=seatView(s,seat).player;return [...(p.ironheartIdentity?[p.ironheartIdentity]:[]),...(p.setAside||[]).filter(p=>/^2900[23]a$/.test(p.code))].map(p=>({id:p.id,code:p.code}));});
 for(const seat of s.players){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=10;p.exhausted=false;p.flipped=false;}
 activateSeat(s,'p1');s.villain.hp=s.villain.maxHp=50;s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 function player(id='p1'){return seatView(s,id).player;}
 function take(code,id='p1'){const p=player(id);for(const zone of[p.hand,p.deck,p.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual source '+code+' for '+id);}
 function hand(codes,id='p1'){const ps=codes.map(code=>take(code,id));player(id).hand.push(...ps);return ps;}
 function put(code,id='p1'){const p=take(code,id);p.exhausted=false;player(id).inPlay.push(p);return p;}
 function encounter(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual encounter '+code);}
 function attach(code,id='p1'){const p=encounter(code);p.attachedTo='hero:'+id;s.attachments.push(p);return p;}
 function minion(){const p=encounter('29037');p.engagedWith='p1';s.minions.push(p);return p;}
 function reveal(code){const p=encounter(code);s.resolving.push(p);s.prompt={kind:'choice',title:'Resolve encounter',text:'Resolve the actual source encounter card.',options:[{id:'go',label:'Continue',effects:[{type:'reveal',piece:p,skip:true}]}]};return p;}
 let ids={};
 if(kind==='feedback-team'){
  const haywire=attach('29038');hand(['28004','28007']);put('28016');hand(['29006','29008'],'p2');put('29015','p2');
  ids={haywireId:haywire.id,schemeId:reveal('29036').id};
 }else if(kind==='dynamic-discard'){
  const energy=put('28016'),haywire=attach('29038'),enemy=minion();enemy.damage=3;ids={energyId:energy.id,haywireId:haywire.id,enemyId:enemy.id};
 }else if(kind==='dynamic-blank'){
  const energy=put('29015'),enemy=minion();enemy.damage=3;const [vivian,...resources]=hand(['29024','29021','29021']);ids={energyId:energy.id,enemyId:enemy.id,vivianId:vivian.id,resourceIds:resources.map(p=>p.id)};
 }else if(kind==='haywire-payment'){
  const energy=put('28016'),haywire=attach('29038');const [event,...resources]=hand(['28005','28013','28007']);ids={energyId:energy.id,haywireId:haywire.id,eventId:event.id,resourceIds:resources.map(p=>p.id)};
 }else if(kind==='haywire-indirect'){
  const ally=put('28002'),haywire=attach('29038');ids={allyId:ally.id,haywireId:haywire.id};
 }else if(kind==='haywire-other-seat'){
  const ally=put('29004','p2'),haywire=attach('29038','p1');
  s.players[0].ended=true;s.turnPlayerId='p2';activateSeat(s,'p2');
  ids={allyId:ally.id,haywireId:haywire.id};
 }else if(kind==='air-static'){
  const haywire=attach('29038');hand(['28004']);put('29015','p2');const air=encounter('29039');s.environments.push(air);
  s.prompt={kind:'choice',title:'Begin villain phase',text:'Resolve the native phase boundary.',options:[{id:'go',label:'Continue',effects:[{type:'beginVillain',actorId:s.firstPlayerId}]}]};ids={haywireId:haywire.id,airId:air.id};
 }else if(kind==='zzzap-ally'||kind==='zzzap-tough'){
  const loop=encounter('29036');s.encounter.deck.unshift(loop);const count=kind==='zzzap-ally'?3:2;hand(Array(count).fill('28005'));
  if(kind==='zzzap-ally')ids.allyId=put('28002').id;else s.player.tough=true;
  ids={...ids,loopId:loop.id,treacheryId:reveal('29040').id};
 }else throw Error('Unknown reviewed fixture '+kind);
 syncSeat(s);return{state:s,sources,modular,identities,...ids};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const { fixture, payment, observation, isPlayerDeckPiece } = await import(
  pathToFileURL(fixturePath).href
);

function allPieces(s) {
  const nested = (p) => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
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
  assert.equal(f.modular.length, 7);
  assert.deepEqual([...new Set(f.modular.map((p) => p.code))].sort(), [
    "29036",
    "29037",
    "29038",
    "29039",
    "29040",
  ]);
}
if (process.env.ZZZAX_FIXTURE_CHECK) {
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
    ignoreHTTPSErrors: process.env.ZZZAX_IGNORE_HTTPS_ERRORS === "1",
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("zzzax-fixture-loaded")) return;
    sessionStorage.setItem("zzzax-fixture-loaded", "yes");
    localStorage.setItem("champions.save.v1", JSON.stringify(state));
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
  }, f.state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const src of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((s) => s.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(src)) entryAssets.add(src);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.ZZZAX_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.ZZZAX_ASSET),
      ),
      "Expected immutable production entry",
    );
  }
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
async function removeHaywire() {
  const attachment = page
    .locator(".attached-piece")
    .filter({ has: page.locator('.attached-card img[src*="29038"]') });
  await attachment.getByRole("button", { name: /Discard|Remove/ }).click();
  return settle();
}
async function minionStats(attack, health, damage) {
  const enemy = page.locator(".enemy-unit").filter({
    has: page.locator('.minion-card-face img[src*="29037"]'),
  });
  assert.equal(
    await enemy.count(),
    1,
    "One actual physical Zzzax on the table",
  );
  assert.equal(
    await enemy.locator(".minion-health").getAttribute("aria-label"),
    `${health - damage} of ${health} hit points remaining`,
    "Rendered minion health uses current controlled Energy and blanking",
  );
  assert.equal(
    await enemy.locator(".minion-attack b").innerText(),
    String(attack),
    "Rendered minion attack uses current controlled Energy and blanking",
  );
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
  for (const kind of scenarios)
    for (const width of widths) {
      current = { kind, width };
      const f = fixture(kind);
      await open(f, width);
      let state;
      if (kind === "feedback-team") {
        assert.equal(
          observation(await save()).handEnergy,
          2,
          "Haywire converts both non-Energy printed hand resources",
        );
        await reload();
        await choice("go");
        state = await finishChoices();
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          8,
          "Fixed base two plus three effective Energy resources from each distinct seat",
        );
        assert.equal(seat(state, "p1").hp, 10);
        assert.equal(seat(state, "p2").hp, 10);
      } else if (kind === "dynamic-discard") {
        const before = observation(await save(), f.enemyId);
        assert.equal(before.attack, 3);
        assert.equal(before.health, 5);
        await minionStats(3, 5, 3);
        await removeHaywire();
        state = await save();
        assert.ok(state.prompt.options.some((p) => p.id === f.energyId));
        await checkpoint(kind + "-actual-controlled-energy-cost", width, f);
        await reload();
        await choice(f.energyId);
        state = await finishChoices();
        assert.ok(state.player.discard.some((p) => p.id === f.energyId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.haywireId));
        const after = observation(state, f.enemyId);
        assert.equal(after.attack, 2);
        assert.equal(after.health, 4);
        await minionStats(2, 4, 3);
        assert.equal(state.minions.find((p) => p.id === f.enemyId).damage, 3);
        assert.equal(state.player.hp, 10);
      } else if (kind === "dynamic-blank") {
        assert.equal(observation(await save(), f.enemyId).health, 5);
        await minionStats(3, 5, 3);
        await page
          .getByRole("button", { name: "Play now: Vivian", exact: true })
          .click();
        await settle();
        await pay(f.resourceIds);
        await findChoice((o) => o.id === "yes", "Vivian actual response");
        await choice("yes");
        await findChoice(
          (o) => o.id === f.enemyId,
          "Vivian actual non-Elite minion",
        );
        await checkpoint(kind + "-actual-vivian-target", width, f);
        await reload();
        await choice(f.enemyId);
        state = await finishChoices();
        assert.equal(observation(state, f.enemyId).attack, 2);
        assert.equal(observation(state, f.enemyId).health, 4);
        await minionStats(2, 4, 3);
        assert.ok(
          state.player.inPlay.some((p) => p.id === f.energyId),
          "Printed Energy card remains controlled while Zzzax is blank",
        );
        assert.ok(state.player.inPlay.some((p) => p.id === f.vivianId));
      } else if (kind === "haywire-payment") {
        await page
          .getByRole("button", { name: "Play now: Pot Shot", exact: true })
          .click();
        state = await settle();
        for (const id of f.resourceIds)
          assert.deepEqual(
            payment(state).find((p) => p.id === id).resources,
            ["energy"],
            "Haywire converts actual Mental and Wild hand resources to Energy without Nova Wild doubling",
          );
        await checkpoint(kind + "-actual-effective-hand-payment", width, f);
        await reload();
        await pay(f.resourceIds);
        await findChoice(
          (o) => o.id === state.villain.id,
          "Pot Shot actual enemy target",
        );
        await choice(state.villain.id);
        state = await finishChoices();
        assert.equal(state.villain.hp, 46);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        await removeHaywire();
        await reload();
        await choice(f.energyId);
        state = await finishChoices();
        assert.ok(state.encounter.discard.some((p) => p.id === f.haywireId));
        assert.ok(state.player.discard.some((p) => p.id === f.energyId));
        assert.equal(state.player.hp, 10);
      } else if (kind === "haywire-indirect" || kind === "haywire-other-seat") {
        if (kind === "haywire-other-seat") {
          assert.equal((await save()).activePlayerId, "p2");
          assert.equal((await save()).heroId, "ironheart");
          assert.equal(
            (await save()).attachments.find((p) => p.id === f.haywireId)
              .attachedTo,
            "hero:p1",
            "The printed attachment belongs to the other actual seat",
          );
          await checkpoint(kind + "-actual-teammate-attachment", width, f);
        }
        await removeHaywire();
        await choice("indirect");
        await findChoice(
          (o) => o.id === f.allyId,
          "Actual indirect ally allocation",
        );
        await checkpoint(kind + "-actual-indirect-cost", width, f);
        await reload();
        await choice(f.allyId);
        await choice(f.allyId);
        state = await finishChoices();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          2,
        );
        assert.equal(state.player.hp, 10);
        assert.ok(state.encounter.discard.some((p) => p.id === f.haywireId));
        if (kind === "haywire-other-seat") {
          assert.equal(state.activePlayerId, "p2");
          assert.equal(state.heroId, "ironheart");
          assert.equal(seat(state, "p1").hp, 10);
          assert.ok(
            seat(state, "p1").inPlay.every((p) => p.id !== f.allyId),
            "Acting Ironheart pays with their own Brawn without changing payer to attached Nova",
          );
        }
      } else if (kind === "air-static") {
        await choice("go");
        await findChoice(
          (o) => o.id === "hero",
          "Air Static first actual seat",
        );
        state = await save();
        assert.equal(state.activePlayerId, "p1");
        assert.equal(
          state.scheme.threat,
          0,
          "Air Static interrupt precedes regular villain-phase threat",
        );
        await checkpoint(kind + "-first-seat-before-main-threat", width, f);
        await reload();
        await choice("hero");
        await choice("hero");
        await findChoice(
          (o) => o.id === "hero",
          "Air Static second actual seat",
        );
        state = await save();
        assert.equal(state.activePlayerId, "p2");
        assert.equal(seat(state, "p1").hp, 8);
        assert.equal(seat(state, "p2").hp, 10);
        assert.equal(
          state.scheme.threat,
          0,
          "Second receipt still precedes regular main threat",
        );
        await checkpoint(kind + "-second-seat-saved-receipt", width, f);
        await reload();
        await choice("hero");
        await choice("hero");
        state = await settle();
        assert.equal(seat(state, "p1").hp, 8);
        assert.equal(seat(state, "p2").hp, 8);
        assert.equal(
          state.scheme.threat,
          2,
          "Normal per-player main threat follows both Air Static packets",
        );
        assert.ok(state.environments.some((p) => p.id === f.airId));
      } else if (kind === "zzzap-ally") {
        await choice("go");
        await findChoice(
          (o) => o.id === f.allyId,
          "Zzzap actual ally allocation",
        );
        await checkpoint(
          kind + "-actual-allocation-with-identity-zero",
          width,
          f,
        );
        await reload();
        await choice(f.allyId);
        await choice(f.allyId);
        await choice(f.allyId);
        state = await finishChoices();
        assert.equal(
          state.player.hp,
          10,
          "Damage allocated to ally never counts as identity damage",
        );
        assert.ok(state.player.discard.some((p) => p.id === f.allyId));
        assert.equal(
          state.encounter.dealt.length,
          1,
          "Zero identity damage grants exactly one native Surge encounter",
        );
        assert.equal(state.encounter.dealt[0].id, f.loopId);
        assert.equal(state.encounter.dealt[0].dealtTo, "p1");
        assert.equal(state.encounter.dealt[0].code, "29036");
        assert.match(
          await page
            .locator('.dealt-encounters[aria-label="Facedown encounters"]')
            .innerText(),
          /1 facedown encounter/,
          "The native table displays the actual deferred Surge card",
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.treacheryId));
      } else if (kind === "zzzap-tough") {
        await choice("go");
        await findChoice(
          (o) => o.id === "hero",
          "Zzzap actual Tough identity allocation",
        );
        await checkpoint(kind + "-actual-tough-before-receipt", width, f);
        await reload();
        await choice("hero");
        await choice("hero");
        state = await finishChoices();
        assert.equal(
          state.player.hp,
          10,
          "Tough prevents the complete allocated damage packet",
        );
        assert.equal(state.player.tough, false);
        assert.ok(
          !state.sideSchemes.some((p) => p.id === f.loopId),
          "Two damage dealt to the identity does not grant Surge when Tough prevents damage taken",
        );
        assert.equal(
          state.encounter.deck[0].id,
          f.loopId,
          "Actual next encounter remains unrevealed without Surge",
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.treacheryId));
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
      console.log(`Verified native Zzzax ${kind} at ${width}px`);
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
    if (process.env.ZZZAX_SHA256)
      assert.equal(
        sha256,
        process.env.ZZZAX_SHA256,
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
