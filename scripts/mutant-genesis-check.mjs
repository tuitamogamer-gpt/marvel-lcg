import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output =
  process.env.MUTANT_GENESIS_OUTPUT || "output/mutant-genesis/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const defaults = [
  "colossus-steel-skin",
  "colossus-steel-fist",
  "colossus-bulletproof",
  "colossus-armor-up",
  "colossus-nemesis",
  "shadowcat-phase-control",
  "shadowcat-solid",
  "shadowcat-phased-attack",
  "shadowcat-phased-defense",
  "shadowcat-quick-solid",
  "shadowcat-quick-phased",
  "shadowcat-obligation",
  "shadowcat-nemesis",
  "pool-nightcrawler",
  "pool-mutant-protectors",
  "pool-professor-x",
  "pool-team-strike",
];
const scenarios = (process.env.MUTANT_GENESIS_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.MUTANT_GENESIS_VIEWPORTS || "1440,1280,390,320")
  .split(",")
  .map(Number);
assert.ok(
  scenarios.length && scenarios.every((kind) => defaults.includes(kind)),
);
assert.ok(widths.length && widths.every((width) => width >= 320));
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
const sources = Object.fromEntries(
  [
    ["colossus", "32001a", "Colossus", "protection"],
    ["shadowcat", "32030a", "Shadowcat", "aggression"],
  ].map(([id, code, name, aspect]) => {
    const source = catalog.find((deck) => deck.id === `starter-${code}`);
    assert.ok(source, `${name}: original preconstructed source`);
    return [
      id,
      {
        code,
        name,
        aspect,
        sourceUrl: source.sourceUrl,
        codes: Object.entries(source.cards)
          .filter(([code]) => code !== "32031a")
          .flatMap(([code, count]) => Array(count).fill(code))
          .sort(),
      },
    ];
  }),
);
for (const source of Object.values(sources))
  assert.equal(source.codes.length, 40);

// Compile fixtures against the same native engine that the production UI imports.
// Fixtures move original physical setup cards; they never manufacture player cards.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources} from './src/game/engine.ts';
import {heroStarterCodes,heroRuntime} from './src/game/hero-runtime.ts';
import {card,heroStats,imageFor} from './src/game/cards.ts';
import {syncSeat} from './src/game/team.ts';
export function definition(p){return card(p);}
export {imageFor};
export function stats(s){return heroStats(s);}
export function isPlayerDeckPiece(p){return !['32031a','32031b'].includes(p.code)&&['event','resource','ally','support','upgrade'].includes(card(p)?.type_code);}
export function payment(s){const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);}
export function fixture(kind){
 const heroId=kind.startsWith('shadowcat-')||kind==='pool-team-strike'?'shadowcat':'colossus';
 const aspect=heroId==='shadowcat'?'aggression':'protection';
 let s=newGame({heroId,aspect,villainId:'rhino',module:'bomb_scare',deckCards:heroStarterCodes(heroId),deckOrigin:'source',seed:heroId==='colossus'?32001:32030,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}return s;}
 for(let n=0;n<30&&(s.phase==='mulligan'||s.prompt);n++){
  if(s.review){command({type:'PROCEED'});continue;}
  if(s.prompt){
   if(s.prompt.kind!=='choice')throw Error('Unexpected setup '+JSON.stringify(s.prompt));
   const organic=s.prompt.options.find(o=>o.image==='32006');
   const only=s.prompt.options.length===1?s.prompt.options[0]:null;
   if(!organic&&!only)throw Error('Unreviewed original setup choice '+JSON.stringify(s.prompt));
   command({type:'CHOOSE',id:(organic||only).id});
  }else command({type:'MULLIGAN',ids:[]});
 }
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native original source setup incomplete');
 const source=[...s.player.hand,...s.player.deck,...s.player.discard,...s.player.inPlay].filter(isPlayerDeckPiece).map(({id,code})=>({id,code}));
 if(source.length!==40)throw Error('Original source must contain forty physical player cards');
 const permanent=s.player.inPlay.filter(p=>['32031a','32031b'].includes(p.code)).map(p=>({id:p.id,codes:['32031a','32031b']}));
 if(permanent.length!==Number(heroId==='shadowcat'))throw Error('Native Shadowcat must have one actual reversible Permanent');
 const encounter=[...s.encounter.deck,...s.encounter.discard,...s.encounter.dealt,...s.player.setAside].filter(p=>card(p)?.faction_code==='encounter').map(({id,code})=>({id,code}));
 const runtime=heroRuntime(heroId);
 const nemesisCodes=[...runtime.obligationCodes,...runtime.nemesisCodes];
 const nemeses=encounter.filter(p=>nemesisCodes.includes(p.code));
 if(nemeses.length!==6)throw Error('Native six physical obligation and nemesis cards required');
 const p=s.player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=heroId==='colossus'?14:9;p.exhausted=false;p.flipped=false;p.tough=false;p.toughCards=0;
 s.villain.hp=s.villain.maxHp=50;s.scheme.threat=4;s.queue=[];s.prompt=null;s.review=null;
 function take(code){for(const z of[p.hand,p.deck,p.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual original source '+code);}
 function hand(codes){const ps=codes.map(take);p.hand.push(...ps);return ps;}
 function put(code){const q=take(code);q.exhausted=false;p.inPlay.push(q);return q;}
 function top(codes){const ps=codes.map(take);p.deck.unshift(...ps);return ps;}
 function encounterPiece(code){for(const z of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,p.setAside]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual encounter '+code);}
 function native(effects){s.prompt={kind:'choice',title:'Resolve native source',text:'Continue the native source action.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code){const q=encounterPiece(code);s.resolving.push(q);native([{type:'reveal',piece:q,skip:true}]);return q;}
 function attack(){const q=encounterPiece('01105');s.encounter.deck.unshift(q);native([{type:'enemyAttack',id:s.villain.id,actorId:s.activePlayerId}]);return q;}
 function tough(n){p.tough=!!n;p.toughCards=n;}
 function phased(){const mass=p.inPlay.find(q=>q.id===permanent[0].id);mass.code='32031b';return mass;}
 function roundCards(){const ps=['01106','01105'].map(encounterPiece);s.encounter.deck.unshift(...ps);s.scheme.threat=0;return ps;}
 let ids={};
 if(kind==='colossus-steel-skin'){p.form='alter';tough(1);}
 else if(kind==='colossus-steel-fist'){tough(2);const iron=put('32004'),steel=put('32006'),muscles=put('32005');steel.counters=2;ids={ironId:iron.id,steelId:steel.id,musclesId:muscles.id,eventId:hand(['32008'])[0].id,drawId:top(['32003'])[0].id};}
 else if(kind==='colossus-bulletproof'){tough(1);p.exhausted=true;ids.eventId=hand(['32009'])[0].id;}
 else if(kind==='colossus-armor-up'){p.form='alter';ids.eventId=hand(['32010'])[0].id;const q=encounterPiece('01105');s.encounter.deck.unshift(q);ids.boostId=q.id;native([{type:'villainActivate'}]);}
 else if(kind==='colossus-nemesis'){tough(2);ids.shadowId=reveal('01190').id;}
 else if(kind==='shadowcat-phase-control'){p.form='alter';ids.roundIds=roundCards().map(q=>q.id);}
 else if(kind==='shadowcat-solid'){p.exhausted=true;const ps=hand(['32037','32039']);ids={eventId:ps[0].id,resourceId:ps[1].id,massId:permanent[0].id};}
 else if(kind==='shadowcat-phased-attack'){const mass=phased();mass.exhausted=true;ids.massId=mass.id;}
 else if(kind==='shadowcat-phased-defense'){const mass=phased();mass.exhausted=true;ids={massId:mass.id,boostId:attack().id};}
 else if(kind==='shadowcat-quick-solid'||kind==='shadowcat-quick-phased'){if(kind.endsWith('phased'))phased();ids.eventId=hand(['32040'])[0].id;ids.drawIds=top(['32037','32038']).map(q=>q.id);ids.boostId=attack().id;}
 else if(kind==='shadowcat-obligation'){ids.obligationId=reveal('32055').id;}
 else if(kind==='shadowcat-nemesis'){ids.shadowId=reveal('01190').id;}
 else if(kind==='pool-nightcrawler'){ids={allyId:put('32011').id,resourceId:hand(['32022'])[0].id,boostId:attack().id};}
 else if(kind==='pool-mutant-protectors'){const ps=hand(['32017','32012','32022']);ids={eventId:ps[0].id,allyId:ps[1].id,resourceId:ps[2].id,boostId:attack().id};}
 else if(kind==='pool-professor-x'){const ps=hand(['32019','32022','32023']);ids={allyId:ps[0].id,resourceIds:ps.slice(1).map(q=>q.id),roundIds:roundCards().map(q=>q.id)};}
 else if(kind==='pool-team-strike'){const ps=hand(['32045','32039']);ids={eventId:ps[0].id,resourceId:ps[1].id,allyIds:['32032','32042'].map(code=>put(code).id)};}
 else throw Error('Unknown reviewed fixture '+kind);
 syncSeat(s);return {state:s,source,permanent,encounter,nemeses,...ids};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const { fixture, definition, imageFor, stats, payment, isPlayerDeckPiece } =
  await import(pathToFileURL(fixturePath).href);

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
const physical = (state, id) =>
  allPieces(state).find((piece) => piece.id === id);
const mass = (state) =>
  state.player.inPlay.find((piece) =>
    ["32031a", "32031b"].includes(piece.code),
  );
const toughCount = (state) =>
  state.player.toughCards || Number(state.player.tough);
function snapshot(state) {
  const pieces = allPieces(state),
    source = pieces
      .filter(isPlayerDeckPiece)
      .map(({ id, code }) => ({ id, code }));
  const encounter = pieces
    .filter((piece) => definition(piece)?.faction_code === "encounter")
    .map(({ id, code }) => ({ id, code }));
  const range = state.heroId === "colossus" ? [32025, 32029] : [32055, 32059];
  const permanent = pieces.find((piece) =>
    ["32031a", "32031b"].includes(piece.code),
  );
  return {
    source,
    encounter,
    permanent: permanent
      ? [{ id: permanent.id, codes: ["32031a", "32031b"] }]
      : [],
    nemeses: encounter.filter(
      (piece) =>
        Number(piece.code) >= range[0] && Number(piece.code) <= range[1],
    ),
  };
}
function conserved(state, f, label) {
  const pieces = allPieces(state);
  assert.equal(f.source.length, 40, `${label}: forty actual source deck cards`);
  assert.equal(new Set(f.source.map((piece) => piece.id)).size, 40);
  assert.deepEqual(
    f.source.map((piece) => piece.code).sort(),
    sources[state.heroId].codes,
    `${label}: exact original preconstructed list`,
  );
  assert.deepEqual(
    pieces
      .filter(isPlayerDeckPiece)
      .map((piece) => piece.id)
      .sort(),
    f.source.map((piece) => piece.id).sort(),
    `${label}: exact source physical IDs, no added player cards`,
  );
  for (const original of [...f.source, ...f.encounter]) {
    const matches = pieces.filter((piece) => piece.id === original.id);
    assert.equal(
      matches.length,
      1,
      `${label}: ${original.code}:${original.id} occupies exactly one actual zone`,
    );
    assert.equal(
      matches[0].code,
      original.code,
      `${label}: physical source printing unchanged`,
    );
  }
  assert.equal(
    f.nemeses.length,
    6,
    `${label}: five actual nemeses and one obligation`,
  );
  assert.equal(f.permanent.length, Number(state.heroId === "shadowcat"));
  for (const original of f.permanent) {
    const matches = pieces.filter((piece) => piece.id === original.id);
    assert.equal(
      matches.length,
      1,
      `${label}: one reversible Permanent physical ID`,
    );
    assert.ok(original.codes.includes(matches[0].code));
    assert.ok(
      (state.phase === "mulligan"
        ? state.player.setAside
        : state.player.inPlay
      ).some((piece) => piece.id === original.id),
      `${label}: Permanent occupies its native setup or play zone`,
    );
    assert.ok(
      ![
        ...state.player.hand,
        ...state.player.deck,
        ...state.player.discard,
      ].some((piece) => original.codes.includes(piece.code)),
    );
  }
}
if (process.env.MUTANT_GENESIS_FIXTURE_CHECK) {
  const prepared = scenarios.map((kind) => {
    const f = fixture(kind);
    conserved(f.state, f, kind);
    return {
      kind,
      sourceCards: f.source.length,
      permanentCards: f.permanent.length,
      obligationAndNemesis: f.nemeses.length,
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
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
const entryAssets = new Set(),
  styleAssets = new Set();
let context, page, current;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function open(f, width) {
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
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("mutant-genesis-fixture-loaded")) return;
    sessionStorage.setItem("mutant-genesis-fixture-loaded", "yes");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
  }, f?.state);
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
    "One actual immutable production entry asset is loaded",
  );
  assert.equal(
    styleAssets.size,
    1,
    "One actual immutable production stylesheet is loaded",
  );
  if (process.env.MUTANT_GENESIS_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.MUTANT_GENESIS_ASSET),
      ),
    );
  if (f) {
    await page.getByRole("button", { name: /Resume mission/ }).click();
    conserved(await save(), f, "actual resume");
  }
}
async function settle() {
  for (let n = 0; n < 100; n++) {
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
  const index = state.prompt.options.findIndex(
    (option) =>
      option.id === id || option.id === `${state.activePlayerId}:${id}`,
  );
  assert.ok(index >= 0, `${state.prompt.title}: missing native choice ${id}`);
  await page.locator(".decision-option").nth(index).click();
  return settle();
}
const passOption = (state) =>
  state.prompt?.options.find((option) =>
    /^(pass|skip|none|done|continue|no|take)$/.test(option.id),
  );
async function finishChoices() {
  for (let n = 0; n < 80; n++) {
    const state = await save();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const option =
      passOption(state) ||
      (state.prompt.options.length === 1 && state.prompt.options[0]);
    assert.ok(
      option,
      "Unreviewed blocking native choice: " + JSON.stringify(state.prompt),
    );
    await choice(option.id);
  }
  throw Error("Native choices did not finish");
}
async function findChoice(predicate, label) {
  for (let n = 0; n < 15; n++) {
    const state = await save();
    assert.equal(
      state.prompt?.kind,
      "choice",
      `${label}: ${JSON.stringify(state.prompt)}`,
    );
    if (
      state.prompt.options.some((option) =>
        matchesOption(state, option, predicate),
      )
    )
      return state;
    const option = state.prompt.options.find((option) =>
      /^(pass|skip|continue|no)$/.test(option.id),
    );
    assert.ok(
      option,
      `${label}: unexpected blocking choice ${JSON.stringify(state.prompt)}`,
    );
    await choice(option.id);
  }
  throw Error(`${label}: native choice was not reached`);
}
function matchesOption(state, option, predicate) {
  return (
    predicate(option) ||
    (option.id.startsWith(state.activePlayerId + ":") &&
      predicate({
        ...option,
        id: option.id.slice(state.activePlayerId.length + 1),
      }))
  );
}
async function select(predicate, label) {
  const state = await findChoice(predicate, label);
  return choice(
    state.prompt.options.find((option) =>
      matchesOption(state, option, predicate),
    ).id,
  );
}
async function reload() {
  const before = await save();
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await save(),
    before,
    "Exact native prompt, queue, payment window and physical IDs survive reload",
  );
  assert.equal(
    await page.locator(".milestone-animation").count(),
    0,
    "Resume never replays a milestone",
  );
}
async function paymentSource(id) {
  const state = await save();
  assert.equal(state.prompt?.kind, "payment");
  const available = payment(state),
    source = available.find((source) => source.id === id);
  assert.ok(
    source,
    `Actual native payment source ${id}: ${JSON.stringify(available)}`,
  );
  const index = available
    .filter((candidate) => candidate.kind === source.kind)
    .findIndex((candidate) => candidate.id === id);
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
  for (const id of ids) {
    const button = await paymentSource(id);
    assert.equal(await button.getAttribute("aria-pressed"), "false");
    await button.click();
  }
  const confirm = page.getByRole("button", {
    name: "Confirm payment",
    exact: true,
  });
  assert.equal(
    await confirm.isDisabled(),
    false,
    "Actual printed cost and required resource types are paid",
  );
  await confirm.click();
  return settle();
}
async function play(code) {
  await page
    .getByRole("button", {
      name: "Play now: " + definition({ code }).name,
      exact: true,
    })
    .first()
    .click();
  return settle();
}
async function paidEvent(code, ids = []) {
  let state = await play(code);
  if (state.prompt?.kind === "payment") state = await pay(ids);
  return state;
}
async function target(id) {
  const state = await save();
  assert.ok(
    state.prompt?.options.some(
      (option) =>
        option.id === id || option.id === `${state.activePlayerId}:${id}`,
    ),
    `Actual target ${id} is required`,
  );
  return choice(id);
}
async function basic(action) {
  await page.locator(`.${action}-action`).click();
  return settle();
}
async function flip() {
  await page.locator(".flip-button").click();
  return settle();
}
async function identityAction(label) {
  await page
    .locator(
      ".identity .ability-button, .identity-card .ability-button, .identity-info .ability-button",
    )
    .filter({ hasText: label })
    .click();
  return settle();
}
async function sourceAction(code, label) {
  const host = page
    .locator(".in-play-card")
    .filter({ has: page.locator(`img[src="${imageFor(code)}"]`) });
  assert.equal(await host.count(), 1);
  await host
    .locator(".in-play-actions button")
    .filter({ hasText: label })
    .click();
  return settle();
}
async function beginVillainPhase() {
  await page
    .getByRole("button", { name: "End hero phase", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Begin villain phase", exact: true })
    .click();
  return settle();
}
async function finishRound() {
  const initial = await save(),
    round = initial.round;
  await beginVillainPhase();
  const state = await finishChoices();
  assert.equal(state.phase, "player");
  assert.equal(
    state.round,
    round + 1,
    "Actual complete round reaches the next hero phase",
  );
  return state;
}
async function checkpoint(name, width, f) {
  const state = await save();
  if (f) conserved(state, f, name);
  if (state?.heroId === "shadowcat") {
    const permanent = mass(state);
    assert.ok(permanent);
    const status = page.getByRole("group", {
      name: "Shadowcat physical mass form",
      exact: true,
    });
    assert.equal(await status.getAttribute("data-mass-id"), permanent.id);
    assert.equal(
      await status.getAttribute("data-mass-form"),
      permanent.code === "32031a" ? "solid" : "phased",
    );
    assert.equal(
      await status.locator(".readiness-label").innerText(),
      permanent.exhausted ? "EXHAUSTED" : "READY",
    );
    assert.equal(
      await page
        .locator(`.in-play-card img[src="${imageFor(permanent.code)}"]`)
        .count(),
      1,
      "Actual current reversible Permanent artwork",
    );
  }
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
        ".flip-button, .hero-actions button, .in-play-actions button, .identity-card .ability-button, .attached-piece .text-button",
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
    `${name}: horizontal dialog overflow ${JSON.stringify(metrics.dialogs)}`,
  );
  assert.ok(
    metrics.dialogs.every(
      (dialog) => dialog.top >= -1 && dialog.bottom <= metrics.height + 1,
    ),
    `${name}: dialog outside viewport ${JSON.stringify(metrics.dialogs)}`,
  );
  assert.ok(
    metrics.actions.every(
      (action) => action.left >= -1 && action.right <= width + 1,
    ),
    `${name}: action clipped ${JSON.stringify(metrics.actions)}`,
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
async function window(name, width, f) {
  await checkpoint(name, width, f);
  await reload();
  return save();
}
async function publicSource(id, width) {
  current = { kind: `public-${id}`, width };
  await open(null, width);
  const source = sources[id];
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
  assert.equal(await row.count(), 1, "One canonical source identity");
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
  await checkpoint(`public-${id}-original-${source.aspect}-deck`, width);
  await page.keyboard.press("Escape");
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  let state = await save();
  assert.equal(state.heroId, id);
  assert.equal(state.aspect, source.aspect);
  assert.deepEqual(
    [...state.players[0].deckCards].filter((code) => code !== "32031a").sort(),
    source.codes,
  );
  const f = snapshot(state);
  conserved(state, f, "actual original mulligan");
  assert.equal(state.player.form, "alter");
  assert.equal(
    state.player.hand.length,
    6,
    "Original printed alter-ego opening hand size",
  );
  const organicInDeck = state.player.deck.filter(
    (piece) => piece.code === "32006",
  ).length;
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  state = await settle();
  if (state.prompt) {
    assert.equal(id, "colossus", "Only Colossus setup searches a source card");
    const organic = state.prompt.options.find(
      (option) => option.image === "32006",
    );
    assert.ok(
      organic,
      "Native setup searches an actual Organic Steel source copy",
    );
    await window("public-colossus-organic-steel-setup-choice", width, f);
    state = await choice(organic.id);
  }
  state = await finishChoices();
  if (id === "colossus") {
    assert.ok(
      state.player.hand.some((piece) => piece.code === "32006"),
      "Printed setup places an actual Organic Steel into hand",
    );
    assert.equal(
      state.player.hand.length,
      6 + Number(organicInDeck > 0),
      "Organic Steel setup adds its actual searched copy after the original opening hand",
    );
  } else {
    assert.equal(mass(state).code, "32031a");
    assert.equal(state.player.hand.length, 6);
  }
  await window(`public-${id}-original-forty-with-native-setup`, width, f);
  checks.push({
    kind: `public-${id}`,
    width,
    sourceCards: 40,
    permanentCards: f.permanent.length,
    obligationAndNemesis: 6,
    exactReload: true,
  });
}

try {
  if (!process.env.MUTANT_GENESIS_FIXTURE_ONLY)
    for (const width of widths)
      for (const id of Object.keys(sources)) await publicSource(id, width);
  for (const kind of scenarios)
    for (const width of widths) {
      current = { kind, width };
      const f = fixture(kind);
      conserved(f.state, f, `${kind} initial`);
      await open(f, width);
      let state = await save();
      if (state.prompt?.options.some((option) => option.id === "go"))
        state = await choice("go");
      if (kind === "colossus-steel-skin") {
        await flip();
        await findChoice(
          (option) => option.id === "steel-skin",
          "Steel Skin native response",
        );
        await window(`${kind}-pending-second-tough`, width, f);
        await choice("steel-skin");
        state = await finishChoices();
        assert.equal(state.player.form, "hero");
        assert.equal(toughCount(state), 2);
        assert.match(
          await page.locator(".identity-info").innerText(),
          /Tough\s*×2/i,
        );
      } else if (kind === "colossus-steel-fist") {
        state = await play("32008");
        assert.equal(state.prompt.cost, 2);
        assert.equal(
          stats(state).attack,
          3,
          "Titanium Muscles adds its printed hero ATK",
        );
        assert.equal(
          stats(state).thwart,
          2,
          "Iron Will adds its printed hero THW",
        );
        assert.equal(
          await page
            .locator(".identity-info")
            .getByLabel("ATK: 3", { exact: true })
            .count(),
          1,
        );
        assert.equal(
          await page
            .locator(".identity-info")
            .getByLabel("THW: 2", { exact: true })
            .count(),
          1,
        );
        const muscles = payment(state).find(
          (source) =>
            source.id === f.musclesId || source.id.endsWith(":" + f.musclesId),
        );
        assert.ok(muscles, "Actual Titanium Muscles source");
        assert.deepEqual(muscles.resources, ["physical", "physical"]);
        await window(`${kind}-two-tough-physical-payment`, width, f);
        await pay([muscles.id]);
        await target((await save()).villain.id);
        await select(
          (option) => option.id === "discard",
          "Steel Fist optional tough discard",
        );
        await findChoice(
          (option) => option.image === "32004",
          "Iron Will actual tough discard response",
        );
        await window(`${kind}-actual-tough-discard-responses`, width, f);
        await select(
          (option) => option.image === "32004",
          "Iron Will original upgrade",
        );
        await select(
          (option) => option.image === "32006",
          "Organic Steel original upgrade",
        );
        state = await finishChoices();
        assert.equal(state.villain.hp, 45);
        assert.equal(state.villain.stunned, true);
        assert.equal(state.villain.confused, true);
        assert.equal(toughCount(state), 2);
        assert.ok(state.player.hand.some((piece) => piece.id === f.drawId));
        assert.equal(physical(state, f.steelId).counters, 1);
        assert.equal(physical(state, f.steelId).exhausted, true);
        assert.equal(physical(state, f.musclesId).exhausted, true);
      } else if (kind === "colossus-bulletproof") {
        await paidEvent("32009");
        await findChoice(
          (option) => option.id === "ready",
          "Bulletproof Protector printed choice",
        );
        await window(`${kind}-paid-tough-before-ready-choice`, width, f);
        assert.equal(toughCount(await save()), 0);
        await choice("ready");
        state = await finishChoices();
        assert.equal(state.player.exhausted, false);
        assert.equal(toughCount(state), 0);
        assert.ok(state.player.discard.some((piece) => piece.id === f.eventId));
      } else if (kind === "colossus-armor-up") {
        await findChoice(
          (option) => option.id === f.eventId,
          "Armor Up before native villain activation",
        );
        await window(`${kind}-native-alter-ego-activation-interrupt`, width, f);
        await choice(f.eventId);
        await select(
          (option) => option.id === "steel-skin",
          "Armor Up Steel Skin response",
        );
        await findChoice(
          (option) => option.id === "take",
          "Armor Up changes native activation to attack",
        );
        await choice("take");
        state = await finishChoices();
        assert.equal(state.player.form, "hero");
        assert.equal(state.player.hp, 14);
        assert.equal(toughCount(state), 0);
        assert.equal(state.scheme.threat, 4);
        assert.ok(state.player.discard.some((piece) => piece.id === f.eventId));
      } else if (kind === "colossus-nemesis") {
        state = await finishChoices();
        assert.ok(
          state.minions.some((piece) => piece.code === "32026" && piece.tough),
        );
        const rampage = state.sideSchemes.find(
          (piece) => piece.code === "32027",
        );
        assert.ok(rampage);
        assert.equal(toughCount(state), 0);
        assert.equal(
          rampage.counters,
          6,
          "Printed two threat plus two for each actual discarded Tough card",
        );
        assert.ok(state.encounter.deck.some((piece) => piece.code === "32028"));
      } else if (kind === "shadowcat-phase-control") {
        state = await identityAction(/Phase Control/);
        assert.equal(mass(state).code, "32031b");
        assert.equal(state.player.exhausted, false);
        assert.equal(state.player.form, "alter");
        assert.equal(
          state.player.flipped,
          false,
          "Changing the separate Permanent leaves the identity flip available",
        );
        const control = page
          .locator(
            ".identity .ability-button, .identity-card .ability-button, .identity-info .ability-button",
          )
          .filter({ hasText: /Phase Control/ });
        assert.equal(
          await control.isDisabled(),
          true,
          "Phase Control actual once-per-round limit",
        );
        await window(`${kind}-independent-permanent-once-per-round`, width, f);
        state = await finishRound();
        assert.equal(mass(state).code, "32031b");
        assert.equal(await control.isDisabled(), false);
        state = await identityAction(/Phase Control/);
        assert.equal(mass(state).code, "32031a");
      } else if (kind === "shadowcat-solid") {
        state = await play("32037");
        assert.equal(state.prompt.cost, 2);
        const solid = payment(state).find(
          (source) =>
            source.id === f.massId || source.id.endsWith(":" + f.massId),
        );
        assert.ok(solid, "Actual Solid Hero Resource");
        assert.deepEqual(solid.resources, ["physical"]);
        await (await paymentSource(solid.id)).click();
        assert.equal(mass(await save()).exhausted, false);
        await window(`${kind}-selected-solid-is-uncommitted`, width, f);
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await settle();
        assert.equal(mass(await save()).exhausted, false);
        state = await play("32037");
        await pay([solid.id, f.resourceId]);
        await target((await save()).villain.id);
        await findChoice(
          (option) => option.id.startsWith("shadowcat-mass:"),
          "Solid native optional attack completion",
        );
        await window(`${kind}-completed-attack-optional-mass-flip`, width, f);
        await select(
          (option) => option.id.startsWith("shadowcat-mass:"),
          "Solid original physical Permanent response",
        );
        state = await finishChoices();
        assert.equal(state.villain.hp, 47);
        assert.equal(state.player.exhausted, false);
        assert.equal(mass(state).code, "32031b");
        assert.equal(mass(state).exhausted, true);
      } else if (kind === "shadowcat-phased-attack") {
        state = await basic("attack");
        assert.equal(
          state.prompt,
          null,
          "The sole legal enemy resolves directly through the native basic attack",
        );
        state = await finishChoices();
        assert.equal(state.villain.hp, 48);
        assert.equal(mass(state).code, "32031a");
        assert.equal(mass(state).exhausted, true);
        assert.equal(state.player.exhausted, true);
      } else if (kind === "shadowcat-phased-defense") {
        await findChoice(
          (option) => option.id === "hero",
          "Phased actual basic defender",
        );
        await window(`${kind}-native-basic-defense-declaration`, width, f);
        await choice("hero");
        state = await finishChoices();
        assert.equal(state.player.hp, 9);
        assert.equal(state.player.exhausted, true);
        assert.equal(mass(state).code, "32031a");
        assert.equal(mass(state).exhausted, true);
      } else if (
        kind === "shadowcat-quick-solid" ||
        kind === "shadowcat-quick-phased"
      ) {
        await findChoice(
          (option) => option.id === f.eventId,
          "Quick Shift actual physical defense event",
        );
        await window(`${kind}-printed-interrupt-window`, width, f);
        state = await choice(f.eventId);
        if (state.prompt?.kind === "payment") state = await pay([]);
        if (kind.endsWith("phased"))
          assert.ok(
            f.drawIds.every((id) =>
              state.player.hand.some((piece) => piece.id === id),
            ),
            "Actual Phased branch draws two original source cards",
          );
        state = await finishChoices();
        assert.equal(state.player.hp, 9);
        assert.equal(state.player.exhausted, false);
        assert.equal(mass(state).code, "32031a");
        assert.ok(state.player.discard.some((piece) => piece.id === f.eventId));
      } else if (kind === "shadowcat-obligation") {
        state = await finishChoices();
        assert.equal(mass(state).code, "32031b");
        assert.equal(await page.locator(".attack-action").isDisabled(), true);
        await window(`${kind}-phased-lock-keeps-physical-permanent`, width, f);
        await flip();
        assert.equal(
          await page
            .locator(".identity-info .ability-button")
            .filter({ hasText: /Phase Control/ })
            .isDisabled(),
          true,
          "Permanently Phased prevents changing the actual mass form",
        );
        state = await sourceAction("32055", /remove/i);
        state = await finishChoices();
        assert.equal(state.player.form, "alter");
        assert.equal(state.player.exhausted, true);
        assert.ok(state.removed.some((piece) => piece.id === f.obligationId));
        assert.equal(mass(state).code, "32031b");
      } else if (kind === "shadowcat-nemesis") {
        state = await finishChoices();
        assert.ok(state.minions.some((piece) => piece.code === "32056"));
        assert.ok(state.sideSchemes.some((piece) => piece.code === "32057"));
        assert.equal(state.player.confused, true);
        assert.equal(mass(state).code, "32031a");
        assert.equal(
          state.player.setAside.filter((piece) =>
            ["32056", "32057", "32058", "32059"].includes(piece.code),
          ).length,
          0,
        );
      } else if (kind === "pool-nightcrawler") {
        await findChoice(
          (option) => option.id === "take",
          "Actual incoming X-Men damage",
        );
        await choice("take");
        await findChoice(
          (option) => option.id === f.allyId,
          "Nightcrawler actual damage interrupt",
        );
        await choice(f.allyId);
        state = await save();
        assert.equal(state.prompt.kind, "payment");
        assert.deepEqual(state.prompt.requirements, ["energy"]);
        await window(`${kind}-original-ally-required-energy-payment`, width, f);
        await pay([f.resourceId]);
        state = await finishChoices();
        assert.equal(state.player.hp, 14);
        assert.ok(state.player.hand.some((piece) => piece.id === f.allyId));
        assert.ok(!state.player.inPlay.some((piece) => piece.id === f.allyId));
      } else if (kind === "pool-mutant-protectors") {
        await findChoice(
          (option) => option.id === f.eventId,
          "Mutant Protectors actual defense window",
        );
        await choice(f.eventId);
        await window(`${kind}-one-cost-and-held-original-ally`, width, f);
        await pay([f.resourceId]);
        await target(f.allyId);
        state = await save();
        const polaris = state.prompt?.options.find(
          (option) => option.image === "32012" || /Polaris/.test(option.label),
        );
        if (polaris) await choice(polaris.id);
        await select(
          (option) => option.id === "yes",
          "Polaris actual entry response",
        );
        await target(f.allyId);
        state = await finishChoices();
        const ally = state.player.inPlay.find((piece) => piece.id === f.allyId);
        assert.ok(ally);
        assert.equal(ally.exhausted, true);
        assert.equal(ally.damage, 0);
        assert.equal(ally.tough, false);
        assert.equal(state.player.hp, 14);
        assert.ok(state.player.discard.some((piece) => piece.id === f.eventId));
      } else if (kind === "pool-professor-x") {
        await play("32019");
        await window(`${kind}-original-three-cost-payment`, width, f);
        await pay(f.resourceIds);
        await findChoice(
          (option) => option.id === "confuse",
          "Professor X forced entry options",
        );
        await choice("confuse");
        state = await finishChoices();
        assert.equal(state.villain.confused, true);
        assert.ok(state.player.inPlay.some((piece) => piece.id === f.allyId));
        await window(
          `${kind}-forced-entry-with-saved-end-round-discard`,
          width,
          f,
        );
        state = await finishRound();
        assert.ok(state.player.discard.some((piece) => piece.id === f.allyId));
        assert.ok(!state.player.inPlay.some((piece) => piece.id === f.allyId));
      } else if (kind === "pool-team-strike") {
        await play("32045");
        await findChoice(
          (option) =>
            f.allyIds.every((id) => option.id.split("+").includes(id)),
          "Team Strike actual X-Men ally subset",
        );
        await window(
          `${kind}-choose-actual-hero-and-two-allies-cost`,
          width,
          f,
        );
        await select(
          (option) =>
            f.allyIds.every((id) => option.id.split("+").includes(id)),
          "Team Strike exact original characters",
        );
        state = await save();
        assert.equal(state.prompt?.kind, "payment");
        assert.equal(
          state.player.exhausted,
          false,
          "Staged exhaustion costs remain uncommitted before payment",
        );
        assert.ok(f.allyIds.every((id) => !physical(state, id).exhausted));
        await (await paymentSource(f.resourceId)).click();
        await window(
          `${kind}-staged-ready-characters-and-unspent-resource`,
          width,
          f,
        );
        const cancelResource = await paymentSource(f.resourceId);
        if ((await cancelResource.getAttribute("aria-pressed")) === "false")
          await cancelResource.click();
        assert.equal(
          await cancelResource.getAttribute("aria-pressed"),
          "true",
          "The actual original resource is selected when payment is canceled",
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        state = await settle();
        assert.equal(state.prompt, null);
        assert.equal(state.player.exhausted, false);
        assert.ok(f.allyIds.every((id) => !physical(state, id).exhausted));
        assert.ok(
          state.player.hand.some((piece) => piece.id === f.resourceId),
          "Canceled payment retains the exact selected resource card",
        );
        assert.ok(
          state.player.hand.some((piece) => piece.id === f.eventId),
          "Canceled payment retains the exact Team Strike event",
        );
        conserved(
          state,
          f,
          "Team Strike actual cancellation keeps the full original physical source",
        );
        await play("32045");
        await select(
          (option) =>
            f.allyIds.every((id) => option.id.split("+").includes(id)),
          "Retry the same actual Team Strike characters",
        );
        await pay([f.resourceId]);
        state = await save();
        assert.equal(
          state.player.exhausted,
          true,
          "Successful payment commits hero exhaustion with resources",
        );
        assert.ok(
          f.allyIds.every((id) => physical(state, id).exhausted),
          "Successful payment commits both actual ally exhaustion costs together",
        );
        assert.equal(
          state.player.discard.filter((piece) => piece.id === f.resourceId)
            .length,
          1,
          "Successful payment spends the exact original resource once",
        );
        await target((await save()).villain.id);
        await select(
          (option) => option.id === "5",
          "Team Strike total printed ATK distribution",
        );
        await select(
          (option) => option.id.startsWith("shadowcat-mass:"),
          "Team Strike completes one actual identity Attack for the Solid response",
        );
        state = await finishChoices();
        assert.equal(state.villain.hp, 45);
        assert.equal(state.player.exhausted, true);
        assert.ok(f.allyIds.every((id) => physical(state, id).exhausted));
        assert.ok(f.allyIds.every((id) => physical(state, id).damage === 0));
        assert.equal(mass(state).code, "32031b");
      } else throw Error(`Unreviewed browser scenario ${kind}`);
      await window(`${kind}-native-result`, width, f);
      checks.push({
        kind,
        width,
        sourceCards: 40,
        permanentCards: f.permanent.length,
        obligationAndNemesis: 6,
        exactReload: true,
      });
      console.log(`Verified native Mutant Genesis ${kind} at ${width}px`);
    }
  assert.deepEqual(errors, []);
  const entryProof = [],
    styleProof = [];
  for (const [assets, proof, expected] of [
    [entryAssets, entryProof, process.env.MUTANT_GENESIS_SHA256],
    [styleAssets, styleProof, process.env.MUTANT_GENESIS_CSS_SHA256],
  ]) {
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
  }
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        checks,
        audits,
        layouts,
        errors,
        entryProof,
        styleProof,
        sourceUrls: Object.fromEntries(
          Object.entries(sources).map(([id, source]) => [id, source.sourceUrl]),
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
