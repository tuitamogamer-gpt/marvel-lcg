import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve, basename } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.SABRETOOTH_OUTPUT || "output/sabretooth/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const defaults = [
  "heal-attack",
  "heal-scheme",
  "heal-exhaustion",
  "step-one-solo",
  "step-one-team",
  "rescue-team",
  "protect-payment",
  "kelly-redirect",
  "ally-overkill",
  "medical-emergency",
  "mystique-block",
  "infiltration-reveal",
  "infiltration-draw",
  "surprise-existing",
  "surprise-search",
  "brotherhood-quickstrike",
  "homo-superior",
  "pyro-resources",
  "battle-round",
];
const scenarios = (process.env.SABRETOOTH_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.SABRETOOTH_VIEWPORTS || "1440,1280,390,320")
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
    const codes = Object.entries(source.cards)
      .filter(([code]) => code !== "32031a")
      .flatMap(([code, count]) => Array(count).fill(code))
      .sort();
    assert.equal(codes.length, 40);
    return [id, { code, name, aspect, sourceUrl: source.sourceUrl, codes }];
  }),
);
const definitions = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-cards.json", import.meta.url),
    "utf8",
  ),
);
const originalEncounterCodes = Object.fromEntries(
  ["sabretooth", "brotherhood", "mystique"].map((set) => [
    set,
    definitions
      .filter(
        (c) =>
          c.set_code === set &&
          !["villain", "main_scheme"].includes(c.type_code) &&
          c.code !== "32065b",
      )
      .flatMap((c) => Array(c.quantity).fill(c.code))
      .sort(),
  ]),
);
assert.equal(originalEncounterCodes.sabretooth.length, 12);
assert.equal(originalEncounterCodes.brotherhood.length, 8);
assert.equal(originalEncounterCodes.mystique.length, 5);

// Compile the native host used by the built application. Every focused position
// moves original setup pieces; no substitute player or encounter cards exist.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card,imageFor} from './src/game/cards.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
export {imageFor};
export const definition=p=>card(p);
export const sourceCodes=id=>heroStarterCodes(id).filter(code=>code!=='32031a').sort();
export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};
export function fixture(kind){
 const team=['step-one-team','rescue-team','surprise-existing','battle-round'].includes(kind);
 const shadow=['mystique-block','infiltration-draw','surprise-existing','surprise-search'].includes(kind);
 const heroId=shadow?'shadowcat':'colossus';
 const other=shadow?'colossus':'shadowcat';
 const hero=id=>({heroId:id,aspect:id==='colossus'?'protection':'aggression',deckCards:heroStarterCodes(id),deckOrigin:'source'});
 const heroes=[hero(heroId),...(team?[hero(other)]:[])];
 let s=newGame({heroId,aspect:heroes[0].aspect,heroes,villainId:'sabretooth',module:'brotherhood',modules:['brotherhood','mystique'],senatorDamage:0,seed:32060,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}return s;}
 for(let n=0;n<50&&(s.phase==='mulligan'||s.prompt);n++){
  if(s.review){command({type:'PROCEED'});continue;}
  if(s.prompt){const organic=s.prompt.options?.find(o=>o.image==='32006');const only=s.prompt.options?.length===1?s.prompt.options[0]:null;if(!organic&&!only)throw Error('Unreviewed source setup '+JSON.stringify(s.prompt));command({type:'CHOOSE',id:(organic||only).id});}
  else command({type:'MULLIGAN',ids:[]});
 }
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native original setup incomplete');
 if(!s.sabretooth?.kelly)throw Error('Native Sabretooth must initialize the actual Robert Kelly NPC');
 const find=s.sideSchemes.find(p=>p.code==='32065a');
 if(!find||s.sabretooth.kelly.attachedTo!==find.id)throw Error('Actual Find attachment setup required');
 for(const seat of s.players){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=seat.heroId==='colossus'?14:9;p.exhausted=false;p.flipped=false;p.tough=false;p.toughCards=0;}
 activateSeat(s,'p1');s.villain.hp=s.villain.maxHp;s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 function player(id='p1'){return seatView(s,id).player;}
 function take(code,id='p1'){const p=player(id);for(const z of[p.hand,p.deck,p.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing original source '+code+' for '+id);}
 function hand(codes,id='p1'){const ps=codes.map(code=>take(code,id));player(id).hand.push(...ps);return ps;}
 function put(code,id='p1'){const p=take(code,id);p.exhausted=false;player(id).inPlay.push(p);return p;}
 function top(codes,id='p1'){const ps=codes.map(code=>take(code,id));player(id).deck.unshift(...ps);return ps;}
 function encounter(code){for(const z of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,...s.players.map(seat=>seatView(s,seat).player.setAside)]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual encounter '+code);}
 function native(effects){s.prompt={kind:'choice',title:'Resolve native source',text:'Continue the actual native encounter action.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code){const p=encounter(code);s.resolving.push(p);native([{type:'reveal',piece:p,skip:true}]);return p;}
 function minion(code,id='p1'){const p=encounter(code);p.engagedWith=id;s.minions.push(p);return p;}
 function phased(){const p=player().inPlay.find(p=>p.code==='32031a');if(!p)throw Error('Missing original Permanent');p.code='32031b';return p;}
 function rescued(){s.sideSchemes.splice(s.sideSchemes.indexOf(find),1);find.code='32065b';find.counters=0;s.environments.push(find);delete s.sabretooth.kelly.attachedTo;s.sabretooth.controllerId=s.firstPlayerId;s.scheme.code='32064b';s.scheme.index=1;s.scheme.threat=0;}
 function order(codes){const ps=codes.map(encounter);s.encounter.deck.unshift(...ps);return ps;}
 function activate(kind='attack',codes=['32069','32071']){const ps=order(codes);native([{type:kind==='attack'?'enemyAttack':'enemyScheme',id:s.villain.id,actorId:'p1',activation:{enemyId:s.villain.id,playerId:'p1',kind}}]);return ps;}
 const k=s.sabretooth.kelly;let ids={kellyId:k.id,findId:find.id};
 if(kind==='heal-attack'||kind==='heal-scheme'||kind==='heal-exhaustion'){
  s.villain.hp=s.villain.maxHp-10;if(kind==='heal-scheme')player().form='alter';
  if(kind==='heal-exhaustion'){const ps=['32069','32071'].map(encounter);s.encounter.discard.push(...s.encounter.deck.splice(0));s.encounter.deck.push(...ps);native([{type:'enemyAttack',id:s.villain.id,actorId:'p1',activation:{enemyId:s.villain.id,playerId:'p1',kind:'attack'}}]);ids={...ids,boostId:ps[0].id,healId:ps[1].id};}
  else{const ps=activate(kind==='heal-scheme'?'scheme':'attack');ids={...ids,boostId:ps[0].id,healId:ps[1].id};}
 }else if(kind==='step-one-solo'||kind==='step-one-team'){
  s.scheme.threat=kind==='step-one-solo'?0:6*s.playerCount-s.playerCount;order(['32069','32071','32069','32072','32068','32071']);
 }else if(kind==='rescue-team'){
  find.counters=1;s.scheme.threat=1;const ps=order(['32067','32068']);ids.dealtIds=ps.map(p=>p.id);
 }else if(kind==='protect-payment'||kind==='kelly-redirect'||kind==='ally-overkill'){
  rescued();if(kind==='protect-payment')ids.resourceId=hand(['32022'])[0].id;
  if(kind==='ally-overkill'){const ally=put('32002');ally.damage=2;ids.allyId=ally.id;}
  const ps=activate('attack',kind==='ally-overkill'?['32026','32071']:['32069','32071']);ids={...ids,boostId:ps[0].id,healId:ps[1].id};
 }else if(kind==='medical-emergency'){
  k.damage=4;s.scheme.threat=1;const p=encounter('32071');p.counters=1;s.sideSchemes.push(p);ids.emergencyId=p.id;
 }else if(kind==='mystique-block'){
  phased();const p=minion('32080');p.tough=true;const a=encounter('32067');a.attachedTo=s.villain.id;s.attachments.push(a);ids={...ids,mystiqueId:p.id,clawsId:a.id,resourceIds:hand(['32052','32053','32054']).map(p=>p.id)};
 }else if(kind==='infiltration-reveal'){
  ids.surgeId=order(['32068'])[0].id;ids.infiltrationId=reveal('32082').id;
 }else if(kind==='infiltration-draw'||kind==='surprise-search'||kind==='surprise-existing'){
  player().form='alter';phased();ids.roomId=put('32033').id;
  if(kind==='infiltration-draw'){ids.allyId=put('32032').id;ids.supportId=ids.roomId;}
  else if(kind==='surprise-existing'){const m=minion('32080','p2');m.tough=true;ids.mystiqueId=m.id;}
  else{ids.mystiqueId=s.encounter.deck.find(p=>p.code==='32080').id;}
  const intruder=encounter(kind==='infiltration-draw'?'32082':'32083');player().deck.unshift(intruder);ids.intruderId=intruder.id;
 }else if(kind==='brotherhood-quickstrike'){
  const b=encounter('32079'),m=encounter('32074');s.resolving.push(b,m);native([{type:'reveal',piece:b,skip:true},{type:'reveal',piece:m,skip:true}]);ids={...ids,brotherhoodId:b.id,minionId:m.id};
 }else if(kind==='homo-superior'){
  ids.minionId=minion('32074').id;ids.attachmentId=reveal('32077').id;
 }else if(kind==='pyro-resources'){
  const pyro=minion('32075');const intruder=encounter('32082');const resource=take('32022');player().deck.unshift(intruder,resource);ids={...ids,pyroId:pyro.id,discardIds:[intruder.id,resource.id]};native([{type:'enemyAttack',id:pyro.id,actorId:'p1'}]);
 }else if(kind==='battle-round'){
  rescued();s.villain.hp=s.villain.maxHp-10;ids.roundIds=order(['32069','32071','32069','32072','32068','32071']).map(p=>p.id);
 }else throw Error('Unknown reviewed fixture '+kind);
 syncSeat(s);return {state:s,...ids};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const { fixture, definition, imageFor, payment, sourceCodes } = await import(
  pathToFileURL(fixturePath).href
);

function seat(state, id) {
  return state.activePlayerId === id
    ? state.player
    : state.players.find((seat) => seat.id === id).player;
}
const mass = (state, id = state.activePlayerId) =>
  seat(state, id).inPlay.find((piece) =>
    ["32031a", "32031b"].includes(piece.code),
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
    ...state.players.flatMap((seatInfo) => {
      const p = seat(state, seatInfo.id);
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...state.resolving,
    ...state.removed,
    ...(state.victoryDisplay || []),
    ...state.minions,
    ...state.sideSchemes,
    ...state.attachments,
    ...(state.environments || []),
    ...(state.sabretooth?.kelly ? [state.sabretooth.kelly] : []),
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
function snapshot(state) {
  const pieces = allPieces(state);
  const playerCards = pieces.filter(
    (p) =>
      definition(p)?.faction_code !== "encounter" &&
      !["32031a", "32031b"].includes(p.code),
  );
  return {
    sources: state.players.map((p) => ({
      seatId: p.id,
      heroId: p.heroId,
      cards: playerCards
        .filter((q) => q.ownerId === p.id)
        .map(({ id, code }) => ({ id, code })),
      codes: sources[p.heroId].codes,
    })),
    originals: pieces.map(({ id, code }) => ({
      id,
      codes: ["32031a", "32031b"].includes(code)
        ? ["32031a", "32031b"]
        : ["32065a", "32065b"].includes(code)
          ? ["32065a", "32065b"]
          : [code],
    })),
    modular: pieces
      .filter((p) =>
        ["brotherhood", "mystique"].includes(definition(p)?.set_code),
      )
      .map(({ id, code }) => ({ id, code })),
  };
}
function conserved(state, f, label) {
  const pieces = allPieces(state);
  assert.equal(
    state.villain.maxHp,
    definition(state.villain).health * state.playerCount,
    `${label}: actual printed Sabretooth health per starting hero`,
  );
  for (const source of f.sources) {
    assert.equal(
      source.cards.length,
      40,
      `${label}: actual original source40 for ${source.seatId}`,
    );
    assert.equal(new Set(source.cards.map((p) => p.id)).size, 40);
    assert.deepEqual(
      source.cards.map((p) => p.code).sort(),
      source.codes,
      `${label}: exact published preconstructed list`,
    );
    assert.deepEqual(
      pieces
        .filter(
          (p) =>
            p.ownerId === source.seatId &&
            definition(p)?.faction_code !== "encounter" &&
            !["32031a", "32031b"].includes(p.code),
        )
        .map((p) => p.id)
        .sort(),
      source.cards.map((p) => p.id).sort(),
      `${label}: no added or lost player cards`,
    );
  }
  assert.equal(
    f.modular.filter((p) => definition(p)?.set_code === "brotherhood").length,
    8,
    `${label}: eight original Brotherhood pieces`,
  );
  assert.equal(
    f.modular.filter((p) => definition(p)?.set_code === "mystique").length,
    5,
    `${label}: five original Mystique pieces`,
  );
  for (const [set, codes] of Object.entries(originalEncounterCodes))
    assert.deepEqual(
      pieces
        .filter((p) => definition(p)?.set_code === set)
        .map((p) => (p.code === "32065b" ? "32065a" : p.code))
        .sort(),
      codes,
      `${label}: exact original ${set} physical encounter list`,
    );
  for (const p of state.players)
    assert.equal(
      pieces.filter(
        (q) => q.ownerId === p.id && ["32031a", "32031b"].includes(q.code),
      ).length,
      Number(p.heroId === "shadowcat"),
      `${label}: one actual extra reversible Permanent per Shadowcat`,
    );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    f.originals.map((p) => p.id).sort(),
    `${label}: every original piece occupies exactly one physical zone`,
  );
  for (const original of f.originals) {
    const matches = pieces.filter((p) => p.id === original.id);
    assert.equal(matches.length, 1, `${label}: unique physical ${original.id}`);
    assert.ok(
      original.codes.includes(matches[0].code),
      `${label}: original printing or actual reversible face for ${original.id}`,
    );
  }
  assert.ok(state.sabretooth.kellyId, `${label}: persistent NPC ID`);
  if (state.sabretooth.kelly)
    assert.equal(state.sabretooth.kelly.id, state.sabretooth.kellyId);
}

if (process.env.SABRETOOTH_FIXTURE_CHECK) {
  const prepared = scenarios.map((kind) => {
    const f = fixture(kind),
      inventory = snapshot(f.state);
    conserved(f.state, inventory, kind);
    return {
      kind,
      playerCards: inventory.sources.map((s) => ({
        seatId: s.seatId,
        count: s.cards.length,
      })),
      originalPieces: inventory.originals.length,
      modularCards: inventory.modular.length,
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

const run = promisify(execFile);
async function curlFile(address, path) {
  // Inherit the configured HTTP(S)_PROXY, NO_PROXY and TLS trust. Raw Node
  // internet requests bypass that route in the managed workspace.
  const { stdout } = await run(
    "curl",
    [
      "--fail",
      "--silent",
      "--show-error",
      "--location",
      "--max-time",
      "60",
      "--output",
      path,
      "--write-out",
      "%{http_code}",
      address,
    ],
    { maxBuffer: 16384 },
  );
  assert.equal(
    stdout.trim(),
    "200",
    `Actual anonymous production URL ${address}`,
  );
  return readFile(path);
}
async function assetProof(stage, expected) {
  const html = await curlFile(url, resolve(output, `production-${stage}.html`));
  const js = [
    ...html.toString().matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g),
  ]
    .map((m) => new URL(m[1], url).href)
    .filter((p) => /\/assets\/index-[^/]+\.js$/.test(p));
  const css = [
    ...html.toString().matchAll(/<link\b[^>]*\bhref=["']([^"']+)["']/g),
  ]
    .map((m) => new URL(m[1], url).href)
    .filter((p) => /\/assets\/index-[^/]+\.css$/.test(p));
  assert.equal(js.length, 1, "Serve the actual built production entry");
  assert.equal(css.length, 1, "Serve the actual built production stylesheet");
  const proof = [];
  for (const [kind, address] of [
    ["javascript", js[0]],
    ["stylesheet", css[0]],
  ]) {
    const bytes = await curlFile(
      address,
      resolve(output, `${stage}-${basename(new URL(address).pathname)}`),
    );
    proof.push({
      kind,
      url: address,
      status: 200,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      transport: "curl with inherited proxy and TLS settings",
    });
  }
  if (process.env.SABRETOOTH_ASSET)
    assert.equal(
      basename(new URL(js[0]).pathname),
      process.env.SABRETOOTH_ASSET,
    );
  if (process.env.SABRETOOTH_SHA256)
    assert.equal(proof[0].sha256, process.env.SABRETOOTH_SHA256);
  if (process.env.SABRETOOTH_CSS_SHA256)
    assert.equal(proof[1].sha256, process.env.SABRETOOTH_CSS_SHA256);
  if (expected)
    assert.deepEqual(
      proof,
      expected,
      "Exact immutable artifact before and after actual UI cases",
    );
  await writeFile(
    `${output}/asset-proof-${stage}.json`,
    JSON.stringify(proof, null, 2),
  );
  return proof;
}

let initialProof;
try {
  initialProof = await assetProof("before");
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      {
        message: String(error),
        stack: error.stack,
        stage: "anonymous-production-asset-proof",
        baseUrl: url,
        checks: [],
        audits: [],
        layouts: [],
      },
      null,
      2,
    ),
  );
  throw error;
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
    if (sessionStorage.getItem("sabretooth-fixture-loaded")) return;
    sessionStorage.setItem("sabretooth-fixture-loaded", "yes");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
  }, f?.state);
  const navigation = await page.goto(url, { waitUntil: "domcontentloaded" });
  assert.equal(
    navigation.status(),
    200,
    `Actual anonymous production HTML ${navigation.url()}`,
  );
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
  if (process.env.SABRETOOTH_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.SABRETOOTH_ASSET),
      ),
    );
  assert.deepEqual([...entryAssets], [initialProof[0].url]);
  assert.deepEqual([...styleAssets], [initialProof[1].url]);
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
  const target = page.locator(".decision-option").nth(index);
  // A previous click may leave the pointer on this modal button's hover edge.
  // Move away before scrolling so its one-pixel hover translation stays stable.
  await page.mouse.move(4, 4);
  await target.scrollIntoViewIfNeeded();
  await target.click();
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
  if (f) conserved(state, f, name);
  if (state?.villainId === "sabretooth") {
    assert.equal(
      await page
        .locator(`.villain-card img[src="${imageFor(state.villain.code)}"]`)
        .count(),
      1,
      "Actual current native villain stage artwork",
    );
    assert.equal(
      await page
        .locator(`.scheme-card img[src="${imageFor(state.scheme.code)}"]`)
        .count(),
      1,
      "Actual current native main scheme face artwork",
    );
    const mission = [...state.sideSchemes, ...state.environments].find((p) =>
      ["32065a", "32065b"].includes(p.code),
    );
    assert.ok(mission);
    assert.equal(
      await page
        .locator(`.scheme-area img[src="${imageFor(mission.code)}"]`)
        .count(),
      1,
      "Actual same-piece Find/Protect artwork",
    );
  }
  if (state?.sabretooth?.kelly) {
    const kelly = state.sabretooth.kelly;
    const npc = page.getByRole("group", {
      name: "Robert Kelly scenario ally",
      exact: true,
    });
    assert.equal(await npc.getAttribute("data-piece-id"), kelly.id);
    assert.match(await npc.innerText(), /Robert Kelly/);
    assert.equal(
      await npc
        .locator(`[aria-label="Robert Kelly health: ${9 - kelly.damage} of 9"]`)
        .count(),
      1,
      "Displayed NPC health uses its actual source damage",
    );
    assert.equal(
      await npc.locator(`img[src="${imageFor("32066")}"]`).count(),
      1,
    );
    if (kelly.attachedTo)
      assert.match(
        await npc.innerText(),
        /Attached to Find the Senator.*text blank.*no controller/i,
      );
    else {
      const controller = state.players.find(
        (p) => p.id === state.sabretooth.controllerId,
      );
      assert.ok(controller);
      assert.match(
        await npc.innerText(),
        new RegExp(`Controlled by ${sources[controller.heroId].name}`),
      );
    }
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
        ".flip-button, .hero-actions button, .in-play-actions button, .identity-card .ability-button, .attached-piece .text-button, .scenario-environment button:not(.environment-card), .scenario-ally button",
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

async function chooseSource(id, index, width) {
  const source = sources[id];
  await page
    .getByRole("button", { name: new RegExp(`^Configure hero ${index + 1}:`) })
    .click();
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
  await checkpoint(
    `public-${current.count}-${current.difficulty}-${id}-source-deck`,
    width,
  );
  await page.keyboard.press("Escape");
}
async function publicSource(count, difficulty, width) {
  current = { kind: `public-${count}-${difficulty}`, count, difficulty, width };
  await open(null, width);
  await page
    .getByRole("button", {
      name: `${count} ${count === 1 ? "hero" : "heroes"}`,
      exact: true,
    })
    .click();
  await chooseSource("colossus", 0, width);
  if (count === 2) await chooseSource("shadowcat", 1, width);
  await page
    .locator(".villain-tabs")
    .getByRole("button", { name: "Sabretooth", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Modular encounter 1", exact: true })
      .inputValue(),
    "brotherhood",
    "Printed first recommended module is selected by default",
  );
  assert.equal(
    await page
      .getByRole("combobox", { name: "Modular encounter 2", exact: true })
      .inputValue(),
    "mystique",
    "Printed second recommended module is selected by default",
  );
  const difficultyControls = page
    .locator(".setting-line")
    .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) });
  await difficultyControls
    .getByRole("button", { name: difficulty, exact: true })
    .click();
  assert.equal(
    await difficultyControls
      .getByRole("button", { name: difficulty, exact: true })
      .getAttribute("aria-pressed"),
    "true",
  );
  await page
    .getByRole("combobox", { name: "Modular encounter 1", exact: true })
    .selectOption("brotherhood");
  await page
    .getByRole("combobox", { name: "Modular encounter 2", exact: true })
    .selectOption("mystique");
  await page.locator("#mission-seed").fill("32060");
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  let state = await save();
  assert.equal(state.villainId, "sabretooth");
  assert.equal(state.playerCount, count);
  assert.equal(state.difficulty, difficulty.toLowerCase());
  assert.deepEqual(state.modules, ["brotherhood", "mystique"]);
  assert.equal(
    state.villain.code,
    difficulty === "Standard" ? "32060" : "32061",
  );
  assert.equal(
    state.villain.maxHp,
    (difficulty === "Standard" ? 13 : 15) * count,
  );
  assert.equal(state.scheme.code, "32063b");
  assert.equal(
    state.villain.tough,
    difficulty === "Expert",
    "Actual Expert stageII enters with printed Toughness",
  );
  assert.equal(state.scheme.threat, 0);
  const f = snapshot(state),
    kelly = state.sabretooth.kelly;
  assert.equal(kelly.code, "32066");
  assert.equal(kelly.damage, difficulty === "Standard" ? 1 : 2);
  assert.equal(state.sabretooth.startingDamage, kelly.damage);
  assert.equal(state.sabretooth.controllerId, undefined);
  const find = state.sideSchemes.find((p) => p.code === "32065a");
  assert.ok(find);
  assert.equal(find.counters, 5 * count);
  assert.equal(kelly.attachedTo, find.id);
  conserved(state, f, "actual public source mulligan");
  for (const p of state.players) {
    assert.deepEqual(
      p.deckCards.filter((code) => code !== "32031a").sort(),
      sources[p.heroId].codes,
    );
    assert.equal(seat(state, p.id).form, "alter");
    assert.equal(seat(state, p.id).hand.length, 6);
  }
  for (let n = 0; n < 20; n++) {
    state = await save();
    if (state.phase === "player" && !state.prompt) break;
    if (state.prompt) {
      assert.equal(state.prompt.kind, "choice");
      const organic = state.prompt.options.find((o) => o.image === "32006");
      assert.ok(
        organic,
        "Printed Colossus setup searches an actual source Organic Steel",
      );
      await window(`${current.kind}-organic-steel-source-search`, width, f);
      await choice(organic.id);
    } else {
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      await settle();
    }
  }
  state = await finishChoices();
  assert.equal(state.phase, "player");
  assert.equal(state.prompt, null);
  assert.ok(seat(state, "p1").hand.some((p) => p.code === "32006"));
  if (count === 2) assert.equal(mass(state, "p2").code, "32031a");
  const npc = page.getByRole("group", {
    name: "Robert Kelly scenario ally",
    exact: true,
  });
  assert.match(
    await npc.innerText(),
    /Attached to Find the Senator.*no controller/i,
  );
  assert.match(await npc.innerText(), /text blank/i);
  assert.match(await page.locator(".main-scheme").innerText(), /NO LIMIT/);
  assert.equal(await page.locator(".main-scheme .threat-track").count(), 0);
  assert.equal(await page.locator(".main-scheme.critical").count(), 0);
  await window(`${current.kind}-actual-setup-originals`, width, f);
  checks.push({
    ...current,
    sourceCards: 40 * count,
    modularCards: 13,
    kellyId: kelly.id,
    findId: find.id,
    exactReload: true,
  });
}
async function attackChoice(id, label) {
  return select((o) => o.id === id, label);
}
async function runCase(kind, width) {
  current = { kind, width };
  const native = fixture(kind),
    f = { ...native, ...snapshot(native.state) };
  if (kind === "ally-overkill")
    assert.equal(
      definition(physical(native.state, f.boostId)).boost,
      2,
      "Actual original Juggernaut has two numeric boost icons in addition to its printed star",
    );
  conserved(native.state, f, `${kind} initial`);
  await open(f, width);
  let state = await save();
  if (state.prompt?.options.some((o) => o.id === "go"))
    state = await choice("go");
  if (["heal-attack", "heal-exhaustion"].includes(kind)) {
    await window(`${kind}-actual-activation-defense`, width, f);
    state = await attackChoice("take", "Actual undefended activation");
    state = await finishChoices();
    assert.equal(
      state.villain.hp,
      5,
      "One actual activation heals exactly the top card's two numeric boost icons",
    );
    assert.equal(state.sabretooth.completedActivationIds.length, 1);
    assert.equal(
      state.player.hp,
      12,
      "Attached text-blank Kelly cannot redirect an actual undefended attack",
    );
    assert.equal(state.sabretooth.kelly.damage, 0);
    assert.ok(physical(state, f.boostId));
    assert.ok(physical(state, f.healId));
    if (kind === "heal-exhaustion")
      assert.equal(
        state.encounter.acceleration,
        1,
        "Discarding the actual last heal card executes encounter exhaustion/reset",
      );
    else assert.ok(state.encounter.discard.some((p) => p.id === f.healId));
  } else if (kind === "heal-scheme") {
    state = await finishChoices();
    assert.equal(state.scheme.threat, 1);
    assert.equal(
      state.villain.hp,
      5,
      "An actual alter-ego scheme activation also regenerates",
    );
    assert.equal(state.sabretooth.completedActivationIds.length, 1);
    assert.ok(state.encounter.discard.some((p) => p.id === f.healId));
  } else if (kind === "step-one-solo" || kind === "step-one-team") {
    state = await beginVillainPhase();
    assert.equal(
      state.scheme.code,
      "32063b",
      "Main 1B has no threat completion limit",
    );
    assert.equal(
      state.scheme.threat,
      kind === "step-one-solo" ? 1 : 6 * state.playerCount,
      "Actual step-one threat is placed before the threshold check",
    );
    assert.equal(
      state.sabretooth.kelly.damage,
      kind === "step-one-solo" ? 2 : 3,
      "Kelly takes two below six threat per hero, or three after the actual team threshold",
    );
    assert.equal(state.sabretooth.kelly.attachedTo, f.findId);
    assert.equal(state.sabretooth.controllerId, undefined);
    await window(`${kind}-after-threat-before-attack`, width, f);
  } else if (kind === "rescue-team") {
    state = await basic("thwart");
    if (state.prompt) await target(f.findId);
    else
      assert.equal(
        state.environments.find((p) => p.id === f.findId)?.code,
        "32065b",
        "The sole legal Find target auto-resolves its actual native rescue",
      );
    state = await finishChoices();
    assert.equal(state.scheme.code, "32064b");
    assert.equal(state.scheme.threat, 0);
    assert.equal(state.sabretooth.kelly.id, f.kellyId);
    assert.equal(state.sabretooth.kelly.attachedTo, undefined);
    assert.equal(state.sabretooth.controllerId, state.firstPlayerId);
    assert.equal(
      state.sideSchemes.some((p) => p.id === f.findId),
      false,
    );
    assert.equal(
      state.environments.find((p) => p.id === f.findId).code,
      "32065b",
      "Find flips the same physical card to Protect",
    );
    assert.deepEqual(
      state.encounter.dealt.map((p) => p.id).sort(),
      f.dealtIds.slice().sort(),
    );
    assert.deepEqual(
      state.encounter.dealt.map((p) => p.dealtTo).sort(),
      ["p1", "p2"],
      "Actual 2A deals one original encounter card per seat",
    );
  } else if (kind === "protect-payment") {
    await attackChoice("hero", "Controller's actual hero defense");
    await findChoice(
      (o) => o.id.startsWith(`protect:${f.findId}:`),
      "Protect after the actual Sabretooth defense",
    );
    await window(`${kind}-actual-defense-response`, width, f);
    state = await select(
      (o) => o.id.startsWith(`protect:${f.findId}:`),
      "Protect ready response",
    );
    assert.equal(state.prompt.kind, "payment");
    assert.equal(state.prompt.cost, 2);
    assert.equal(
      state.player.exhausted,
      true,
      "Hero remains exhausted until actual payment completes",
    );
    assert.equal(state.sabretooth.usedDefenseResponses.length, 0);
    await window(`${kind}-actual-two-resource-payment`, width, f);
    state = await pay([f.resourceId]);
    state = await finishChoices();
    assert.equal(state.player.exhausted, false);
    assert.equal(state.sabretooth.usedDefenseResponses.length, 1);
    assert.ok(state.player.discard.some((p) => p.id === f.resourceId));
    assert.equal(state.sabretooth.kelly.damage, 0);
  } else if (kind === "kelly-redirect") {
    state = await attackChoice("take", "Actual undefended enemy attack");
    state = await finishChoices();
    assert.equal(
      state.player.hp,
      14,
      "The controller's identity takes no redirected damage",
    );
    assert.equal(
      state.sabretooth.kelly.damage,
      2,
      "Actual entire undefended attack damages Kelly",
    );
  } else if (kind === "ally-overkill") {
    await window(`${kind}-actual-original-ally-defense`, width, f);
    state = await attackChoice(f.allyId, "Actual original ally defender");
    state = await finishChoices();
    assert.equal(
      state.player.hp,
      11,
      "Juggernaut's original two-icon boost grants Overkill: three excess damage reaches the identity",
    );
    assert.equal(
      state.sabretooth.kelly.damage,
      0,
      "A defended ally Overkill packet never becomes an undefended Kelly attack",
    );
    assert.ok(state.player.discard.some((p) => p.id === f.allyId));
    assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
  } else if (kind === "medical-emergency") {
    await basic("thwart");
    await target(f.emergencyId);
    await findChoice(
      (o) => o.id === `${f.emergencyId}:defeated`,
      "Actual first-player ordering of Emergency healing and Victory",
    );
    await window(`${kind}-actual-when-defeated-victory-order`, width, f);
    await choice(`${f.emergencyId}:defeated`);
    state = await finishChoices();
    assert.equal(
      state.sabretooth.kelly.damage,
      2,
      "The actual encounter When Defeated heals Kelly despite Find's player-heal restriction",
    );
    assert.ok(
      state.victoryDisplay.some((p) => p.id === f.emergencyId),
      "Victory preserves the actual defeated Emergency ID",
    );
    assert.equal(state.sabretooth.kelly.attachedTo, f.findId);
  } else if (kind === "mystique-block") {
    assert.equal(mass(state).code, "32031b");
    const tile = page
      .locator(".enemy-unit")
      .filter({ has: page.locator(`img[src="${imageFor("32080")}"]`) });
    assert.equal(
      await tile.locator(".minion-attack b").innerText(),
      "3",
      "Mystique uses current villain ATK including actual Claws",
    );
    await basic("attack");
    state = await save();
    if (state.prompt) {
      assert.ok(
        !state.prompt.options.some((o) => o.id === "villain"),
        "Absolute villain prohibition survives Phased Guard bypass",
      );
      await target(f.mystiqueId);
    }
    state = await finishChoices();
    assert.equal(state.villain.hp, 13);
    assert.equal(physical(state, f.mystiqueId).tough, false);
    const claws = page
      .locator(".attached-piece")
      .filter({ has: page.locator(`img[src="${imageFor("32067")}"]`) });
    await claws
      .getByRole("button", { name: /Discard Adamantium Claws/ })
      .click();
    state = await settle();
    assert.equal(state.prompt.kind, "payment");
    assert.equal(state.prompt.cost, 3);
    assert.deepEqual(state.prompt.requirements.slice().sort(), [
      "energy",
      "mental",
      "physical",
    ]);
    await window(`${kind}-actual-claws-typed-payment`, width, f);
    await pay(f.resourceIds);
    state = await finishChoices();
    assert.equal(
      await tile.locator(".minion-attack b").innerText(),
      "2",
      "Mystique immediately updates after the actual attachment leaves play",
    );
    assert.equal(
      state.attachments.some((p) => p.id === f.clawsId),
      false,
    );
  } else if (kind === "infiltration-reveal") {
    state = await finishChoices();
    assert.ok(state.player.deck.some((p) => p.id === f.infiltrationId));
    assert.equal(
      state.encounter.discard.some((p) => p.id === f.infiltrationId),
      false,
      "Actual resolving Shapeshifter preserves itself inside the player deck",
    );
    assert.deepEqual(
      state.encounter.dealt.map((p) => ({ id: p.id, dealtTo: p.dealtTo })),
      [{ id: f.surgeId, dealtTo: "p1" }],
      "Printed Surge deals the next actual original card facedown under RRG1.8",
    );
  } else if (kind === "infiltration-draw") {
    await sourceAction("32033", "Room");
    state = await findChoice(
      (o) => o.id === f.allyId,
      "Actual Shapeshifter hand-entry forced discard",
    );
    assert.ok(state.player.hand.some((p) => p.id === f.intruderId));
    assert.ok(state.prompt.options.some((o) => o.id === f.supportId));
    assert.ok(
      !passOption(state),
      "Infiltration's actual mandatory discard has no pass",
    );
    await window(`${kind}-actual-forced-hand-entry-response`, width, f);
    await target(f.allyId);
    state = await finishChoices();
    assert.ok(state.player.discard.some((p) => p.id === f.allyId));
    assert.ok(
      state.player.hand.some((p) => p.id === f.intruderId),
      "The same actual encounter printing remains in hand after its forced response",
    );
    assert.ok(state.player.inPlay.some((p) => p.id === f.roomId));
  } else if (kind === "surprise-existing") {
    await sourceAction("32033", "Room");
    state = await finishChoices();
    assert.ok(seat(state, "p1").hand.some((p) => p.id === f.intruderId));
    assert.equal(
      state.scheme.threat,
      1,
      "Existing Mystique schemes against the actual alter-ego hand-entry seat even when engaged elsewhere",
    );
    assert.equal(physical(state, f.mystiqueId).engagedWith, "p2");
    assert.equal(seat(state, "p2").hp, 14);
  } else if (kind === "surprise-search") {
    await sourceAction("32033", "Room");
    await findChoice(
      (o) => o.id === f.mystiqueId,
      "Actual encounter search for absent Mystique",
    );
    await window(`${kind}-actual-searched-original-Mystique`, width, f);
    await target(f.mystiqueId);
    state = await finishChoices();
    assert.ok(state.player.hand.some((p) => p.id === f.intruderId));
    assert.equal(physical(state, f.mystiqueId).engagedWith, "p1");
    assert.equal(physical(state, f.mystiqueId).tough, true);
    assert.ok(
      state.minions.some((p) => p.id === f.mystiqueId),
      "The searched original enters through native reveal and Toughness",
    );
    assert.equal(
      state.scheme.threat,
      0,
      "Absent Mystique is actually revealed, without inventing an additional activation",
    );
  } else if (kind === "brotherhood-quickstrike") {
    await window(`${kind}-actual-entry-quickstrike`, width, f);
    state = await attackChoice(
      "take",
      "Brotherhood's granted native Quickstrike",
    );
    state = await finishChoices();
    assert.equal(state.player.hp, 12);
    assert.equal(
      state.player.stunned,
      true,
      "Blob's completed actual damaging attack stuns its damaged character",
    );
    assert.equal(physical(state, f.brotherhoodId).counters, 5);
  } else if (kind === "homo-superior") {
    await findChoice(
      (o) => o.id === f.minionId,
      "Actual Homo Superior recipient",
    );
    await window(`${kind}-actual-minion-attachment-target`, width, f);
    await target(f.minionId);
    state = await finishChoices();
    assert.equal(physical(state, f.attachmentId).attachedTo, f.minionId);
    assert.equal(physical(state, f.minionId).tough, true);
    const tile = page
      .locator(".enemy-unit")
      .filter({ has: page.locator(`img[src="${imageFor("32074")}"]`) });
    assert.equal(
      await tile.locator(".minion-health").getAttribute("aria-label"),
      "11 of 11 hit points remaining",
    );
  } else if (kind === "pyro-resources") {
    await attackChoice("take", "Pyro's actual zero-damage attack");
    state = await findChoice(
      (o) => o.id === "hero:p1" || o.id === "hero",
      "Printed resource indirect damage",
    );
    assert.ok(
      state.encounter.discard.some((p) => p.id === f.discardIds[0]),
      "Pyro discards the actual encounter Shapeshifter to the encounter owner's discard",
    );
    assert.ok(
      state.player.discard.some((p) => p.id === f.discardIds[1]),
      "Pyro discards the actual Energy to the source player's discard",
    );
    assert.match(state.prompt.text, /2 remaining indirect damage/);
    await window(`${kind}-actual-resource-indirect-assignment`, width, f);
    for (let n = 0; n < 2; n++) {
      state = await save();
      const opt = state.prompt.options.find(
        (o) => o.id === "hero:p1" || o.id === "hero",
      );
      assert.ok(opt);
      await choice(opt.id);
    }
    state = await finishChoices();
    assert.equal(
      state.player.hp,
      12,
      "Actual double Energy contributes2; actual encounter Shapeshifter contributes0",
    );
    assert.equal(
      state.player.hand.some((p) => p.id === f.discardIds[0]),
      false,
      "Discard is not a hand-entry trigger",
    );
  } else if (kind === "battle-round") {
    const round = state.round;
    state = await beginVillainPhase();
    state = await finishChoices();
    assert.equal(state.phase, "player");
    assert.equal(state.round, round + 1);
    assert.equal(state.firstPlayerId, "p2");
    assert.equal(
      state.sabretooth.controllerId,
      "p2",
      "Robert Kelly's same physical NPC transfers to the new first player",
    );
    assert.equal(state.sabretooth.kelly.id, f.kellyId);
    assert.equal(
      state.sabretooth.kelly.damage,
      2,
      "Only the first controller's undefended attack redirects during this full round",
    );
    assert.equal(
      state.villain.hp,
      21,
      "Both actual villain activations discard their original cards and heal2+3",
    );
    assert.equal(state.sabretooth.completedActivationIds.length, 2);
    assert.equal(state.scheme.threat, 2);
    assert.ok(state.attachments.some((p) => p.code === "32068"));
    assert.ok(state.sideSchemes.some((p) => p.code === "32071"));
    assert.equal(
      state.sideSchemes.find((p) => p.code === "32071").counters,
      6,
      "Actual team Emergency entry uses fixed2 base plus Hinder2 per hero",
    );
    assert.equal(physical(state, f.findId).code, "32065b");
  }
  await window(`${kind}-resolved`, width, f);
  checks.push({
    kind,
    width,
    sourceCards: 40 * f.sources.length,
    modularCards: 13,
    originalPieces: f.originals.length,
    exactReload: true,
  });
}

try {
  if (!process.env.SABRETOOTH_FIXTURE_ONLY)
    for (const width of widths)
      for (const count of [1, 2])
        for (const difficulty of ["Standard", "Expert"])
          await publicSource(count, difficulty, width);
  for (const kind of scenarios)
    for (const width of widths) await runCase(kind, width);
  const finalProof = await assetProof("after", initialProof);
  assert.equal(
    errors.length,
    0,
    `Actual browser runtime/API errors ${JSON.stringify(errors)}`,
  );
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        baseUrl: url,
        checks,
        audits,
        layouts,
        errors,
        productionBrowserVerified: true,
        assetProof: finalProof,
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
        assetProof: finalProof,
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
        assetProof: initialProof,
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
