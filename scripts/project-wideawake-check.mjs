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

const output =
  process.env.PROJECT_WIDEAWAKE_OUTPUT || "output/project-wideawake/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const defaults = [
  "permanent-thwart",
  "main-capture-solo",
  "main-capture-team",
  "capture-loss",
  "mall-jubilee",
  "jubilee-payment",
  "abduction-captive",
  "attacked-ally-capture",
  "consequential-discard",
  "captive-combat",
  "sentinel-upgrades",
  "self-repair",
  "mutant-detected",
  "warn-others",
  "zero-tolerance-minions",
  "targeted-elimination",
  "mark-vi-boost",
  "relentless-robots",
  "battle-round",
  "boom-bombs",
  "allocated-team-setup",
];
const scenarios = (
  process.env.PROJECT_WIDEAWAKE_SCENARIOS || defaults.join(",")
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.PROJECT_WIDEAWAKE_VIEWPORTS || "1440,1280,390,320")
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
  ["project_wideawake", "zero_tolerance", "sentinels"].map((set) => [
    set,
    definitions
      .filter(
        (c) =>
          c.set_code === set &&
          !["villain", "main_scheme"].includes(c.type_code) &&
          c.code !== "32088b",
      )
      .flatMap((c) => Array(c.quantity).fill(c.code))
      .sort(),
  ]),
);
assert.equal(originalEncounterCodes.project_wideawake.length, 20);
assert.equal(originalEncounterCodes.zero_tolerance.length, 7);
assert.equal(originalEncounterCodes.sentinels.length, 7);

// Compile the native host used by the built application. Every focused position
// moves original setup pieces; no substitute player or encounter cards exist.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `import {newGame,dispatch,paymentSources,enemyStats,allyLimit} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card,imageFor} from './src/game/cards.ts';
import {isTextBlank} from './src/game/card-text.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
export {imageFor,enemyStats,allyLimit,isTextBlank};
export const definition=p=>card(p);
export const sourceCodes=id=>heroStarterCodes(id).filter(code=>code!=='32031a').sort();
export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};
export function fixture(kind){
 const team=['main-capture-team','abduction-captive','mark-vi-boost','relentless-robots','battle-round'].includes(kind);
 const hero=id=>({heroId:id,aspect:id==='colossus'?'protection':'aggression',deckCards:heroStarterCodes(id),deckOrigin:'source'});
 const heroes=[hero('colossus'),...(team?[hero('shadowcat')]:[])];
 let s=newGame({heroId:'colossus',aspect:'protection',heroes,villainId:'project_wideawake',module:'sentinels',modules:['sentinels'],difficulty:kind==='abduction-captive'?'expert':'standard',seed:32084,pacing:'expert',captureAllocation:Array(heroes.length).fill(0)});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}return s;}
 for(let n=0;n<80&&(s.phase==='mulligan'||s.prompt);n++){
  if(s.review){command({type:'PROCEED'});continue;}
  if(s.prompt){const organic=s.prompt.options?.find(o=>o.image==='32006');const abduction=s.prompt.options?.every(o=>o.image==='32100')&&s.prompt.options[0];const only=s.prompt.options?.length===1?s.prompt.options[0]:null;if(!organic&&!abduction&&!only)throw Error('Unreviewed actual source setup '+JSON.stringify(s.prompt));command({type:'CHOOSE',id:(organic||abduction||only).id});}
  else command({type:'MULLIGAN',ids:[]});
 }
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native original setup incomplete');
 if(!s.projectWideawake?.setAsideCaptives)throw Error('Native Project Wideawake must own the actual Captive pool');
 const ozt=s.sideSchemes.find(p=>p.code==='32104'),mall=s.sideSchemes.find(p=>p.code==='32088a');
 if(!ozt||!mall)throw Error('Actual Operation Zero Tolerance and Mall setup required');
 for(const seat of s.players){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=seat.heroId==='colossus'?14:9;p.exhausted=false;p.flipped=false;p.tough=false;p.toughCards=0;}
 activateSeat(s,'p1');s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 // Setup can deal a real Expert encounter to the other seat. Keep that same
 // physical card in the native deck for this focused player-phase position.
 s.encounter.deck.push(...s.encounter.dealt.splice(0).map(p=>{delete p.dealtTo;return p;}));
 function player(id='p1'){return seatView(s,id).player;}
 function take(code,id='p1'){const p=player(id);for(const z of[p.hand,p.deck,p.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing original source '+code+' for '+id);}
 function hand(codes,id='p1'){const ps=codes.map(code=>take(code,id));player(id).hand.push(...ps);return ps;}
 function put(code,id='p1'){const p=take(code,id);p.exhausted=false;player(id).inPlay.push(p);return p;}
 function encounter(code){for(const z of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual encounter '+code);}
 function native(effects){s.prompt={kind:'choice',title:'Resolve native source',text:'Continue the actual native encounter action.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code){const p=encounter(code);s.resolving.push(p);return p;}
 function minion(code,id='p1'){const p=encounter(code);p.engagedWith=id;s.minions.push(p);return p;}
 function attach(code,target=s.villain.id){const p=encounter(code);p.attachedTo=target;s.attachments.push(p);return p;}
 function order(codes){const ps=codes.map(encounter);s.encounter.deck.unshift(...ps);return ps;}
 function jubilee(){s.sideSchemes.splice(s.sideSchemes.indexOf(mall),1);mall.code='32088b';mall.counters=0;mall.exhausted=false;player(s.firstPlayerId).inPlay.push(mall);s.projectWideawake.jubileeId=mall.id;return mall;}
 function captive(code,id='p1'){const z=s.projectWideawake.setAsideCaptives;const i=z.findIndex(p=>p.code===code);if(i<0)throw Error('Missing actual set-aside Captive '+code);const p=z.splice(i,1)[0];p.ownerId=id;p.exhausted=false;player(id).inPlay.push(p);return p;}
 let ids={oztId:ozt.id,mallId:mall.id};
 if(kind==='permanent-thwart'){
  ozt.counters=1;ids.initialCaptured=ozt.captured?.length||0;
 }else if(kind==='main-capture-solo'||kind==='main-capture-team'){
  const id=team?'p2':'p1';if(team)s.firstPlayerId=id;s.scheme.threat=5*s.playerCount-1;ids.topId=player(id).deck[0].id;ids.ownerId=id;native([{type:'threat',target:'main',amount:2}]);
 }else if(kind==='capture-loss'){
  ids.topIds=player().deck.slice(0,4).map(p=>p.id);native(Array.from({length:4},()=>({type:'threat',target:'main',amount:5})));
 }else if(kind==='mall-jubilee'){
  mall.counters=1;put('32002');put('32011');put('32012');ids.sentinelId=s.encounter.deck.find(p=>p.code==='32093').id;
 }else if(kind==='jubilee-payment'){
  ids.jubileeId=jubilee().id;ids.energyId=hand(['32007'])[0].id;ids.wrongTypeId=hand(['32008'])[0].id;ids.targetId=minion('32093').id;
 }else if(kind==='abduction-captive'){
  const a=s.sideSchemes.find(p=>p.code==='32100');if(!a)throw Error('Actual initial Abduction missing');a.counters=1;ids.abductionId=a.id;ids.captiveIds=s.projectWideawake.setAsideCaptives.map(p=>p.id);s.villain.hp=1;s.villain.tough=false;s.villain.toughCards=0;activateSeat(s,'p2');s.turnPlayerId='p2';
 }else if(kind==='attacked-ally-capture'){
  const ally=jubilee();ally.damage=2;ids.allyId=ally.id;ids.boostId=order(['32100'])[0].id;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);
 }else if(kind==='consequential-discard'){
  const ally=put('32002');ally.damage=2;ids.allyId=ally.id;ids.minionId=minion('32093').id;s.villain.tough=false;s.villain.toughCards=0;
 }else if(kind==='captive-combat'){
  ids.allyId=captive('32089').id;const a=minion('32101');a.damage=1;ids.targetId=a.id;ids.otherMinionId=minion('32093').id;s.villain.tough=false;s.villain.toughCards=0;
 }else if(kind==='boom-bombs'){
  ids.allyId=captive('32090').id;ids.learningId=attach('32095').id;s.villain.tough=false;s.villain.toughCards=0;ids.roundIds=order(['32100','32099']).map(p=>p.id);
 }else if(kind==='sentinel-upgrades'){
  const ps=['32094','32095','32096'].map(reveal);ids.attachmentIds=ps.map(p=>p.id);ids.resourceIds=hand(['32024','32008','32023','32003','32022','32007']).map(p=>p.id);native(ps.map(piece=>({type:'reveal',piece,skip:true})));
 }else if(kind==='self-repair'){
  s.villain.hp=6;s.villain.stunned=true;s.villain.stunCards=1;s.villain.confused=true;s.villain.confuseCards=1;s.villain.tough=false;s.villain.toughCards=0;const p=reveal('32097');ids.sourceId=p.id;native([{type:'reveal',piece:p,skip:true}]);
 }else if(kind==='mutant-detected'){
  player().form='alter';ids.minionId=minion('32101').id;const ps=['32098','32098'].map(reveal);ids.sourceIds=ps.map(p=>p.id);ids.topId=player().deck[0].id;ids.boostId=order(['32100'])[0].id;native(ps.map(piece=>({type:'reveal',piece,skip:true})));
 }else if(kind==='warn-others'){
  player().form='alter';const a=encounter('32099'),b=encounter('32099');a.ownerId=b.ownerId='p1';player().inPlay.push(a,b);ids.removeId=a.id;ids.captureId=b.id;
 }else if(kind==='zero-tolerance-minions'){
  const a=reveal('32102'),b=minion('32102'),c=reveal('32101');b.tough=false;b.toughCards=0;ids.attackBarrierId=attach('32103',b.id).id;ids.searchMarkIIIId=a.id;ids.markIIIId=b.id;ids.markIIId=c.id;ids.barrierId=s.encounter.deck.find(p=>p.code==='32103').id;native([{type:'reveal',piece:a,skip:true},{type:'enemyAttack',id:b.id,actorId:'p1'},{type:'reveal',piece:c,skip:true}]);
 }else if(kind==='targeted-elimination'){
  const p=reveal('32105');ids.minionId=p.id;ids.targetedIds=s.encounter.deck.filter(p=>p.code==='32107').map(p=>p.id);native([{type:'reveal',piece:p,skip:true}]);
 }else if(kind==='mark-vi-boost'){
  ids.targetedIds=[attach('32107','hero:p1').id,attach('32107','hero:p2').id];ids.boostId=order(['32106'])[0].id;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);
 }else if(kind==='relentless-robots'){
  ids.minionId=minion('32101').id;const p=encounter('32108');p.counters=1;s.sideSchemes.push(p);ids.schemeId=p.id;s.scheme.threat=3;
 }else if(kind==='battle-round'){
  ids.jubileeId=jubilee().id;ids.roundIds=order(['32100','32098','32097','32099']).map(p=>p.id);
 }else throw Error('Unknown reviewed fixture '+kind);
 syncSeat(s);return {state:s,...ids};
}
`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const {
  fixture,
  definition,
  imageFor,
  payment,
  sourceCodes,
  enemyStats,
  allyLimit,
  isTextBlank,
} = await import(pathToFileURL(fixturePath).href);

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
    ...(state.projectWideawake?.setAsideCaptives || []),
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
        : ["32088a", "32088b"].includes(code)
          ? ["32088a", "32088b"]
          : [code],
    })),
    modular: pieces
      .filter((p) =>
        ["zero_tolerance", "sentinels"].includes(definition(p)?.set_code),
      )
      .map(({ id, code }) => ({ id, code })),
  };
}
function conserved(state, f, label) {
  const pieces = allPieces(state);
  assert.ok(
    state.villain.maxHp ===
      definition(state.villain).health * state.playerCount +
        state.attachments.filter(
          (p) =>
            p.code === "32096" &&
            p.attachedTo === state.villain.id &&
            !isTextBlank(state, p),
        ).length *
          8,
    `${label}: original printed Sentinel health per starting hero`,
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
        .filter((p) => source.cards.some((original) => original.id === p.id))
        .map((p) => p.id)
        .sort(),
      source.cards.map((p) => p.id).sort(),
      `${label}: no added or lost player cards`,
    );
  }
  assert.equal(
    f.modular.filter((p) => definition(p)?.set_code === "zero_tolerance")
      .length,
    7,
    `${label}: seven required original Zero Tolerance pieces`,
  );
  assert.equal(
    f.modular.filter((p) => definition(p)?.set_code === "sentinels").length,
    7,
    `${label}: seven original configurable Sentinels pieces`,
  );
  for (const [set, codes] of Object.entries(originalEncounterCodes))
    assert.deepEqual(
      pieces
        .filter((p) => definition(p)?.set_code === set)
        .map((p) => (p.code === "32088b" ? "32088a" : p.code))
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
  assert.ok(state.projectWideawake, `${label}: native Project Wideawake state`);
  if (state.projectWideawake.jubileeId) {
    const jubilee = pieces.filter(
      (p) => p.id === state.projectWideawake.jubileeId,
    );
    assert.equal(
      jubilee.length,
      1,
      `${label}: Jubilee remains one physical Mall piece`,
    );
    assert.equal(jubilee[0].code, "32088b");
  }
}

if (process.env.PROJECT_WIDEAWAKE_FIXTURE_CHECK) {
  const prepared = scenarios
    .filter((kind) => kind !== "allocated-team-setup")
    .map((kind) => {
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
  if (process.env.PROJECT_WIDEAWAKE_ASSET)
    assert.equal(
      basename(new URL(js[0]).pathname),
      process.env.PROJECT_WIDEAWAKE_ASSET,
    );
  if (process.env.PROJECT_WIDEAWAKE_SHA256)
    assert.equal(proof[0].sha256, process.env.PROJECT_WIDEAWAKE_SHA256);
  if (process.env.PROJECT_WIDEAWAKE_CSS_SHA256)
    assert.equal(proof[1].sha256, process.env.PROJECT_WIDEAWAKE_CSS_SHA256);
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
    if (sessionStorage.getItem("project-wideawake-fixture-loaded")) return;
    sessionStorage.setItem("project-wideawake-fixture-loaded", "yes");
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
  if (process.env.PROJECT_WIDEAWAKE_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.PROJECT_WIDEAWAKE_ASSET),
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
  if (state?.villainId === "project_wideawake") {
    assert.equal(
      await page
        .locator(".mission-objectives b")
        .filter({
          hasText: new RegExp(
            `^Keep captured cards below ${3 + state.playerCount}$`,
          ),
        })
        .count(),
      1,
      "The public mission objective states the actual capture-loss threshold",
    );
    assert.equal(
      await page
        .locator(`.villain-card img[src="${imageFor(state.villain.code)}"]`)
        .count(),
      1,
      "Actual current original Sentinel stage artwork",
    );
    assert.equal(
      await page
        .locator(`.scheme-card img[src="${imageFor(state.scheme.code)}"]`)
        .count(),
      1,
      "Actual original unlimited main scheme artwork",
    );
    const ozt = state.sideSchemes.find((p) => p.code === "32104");
    if (ozt) {
      const displayed = page.locator(
        `.table-side-scheme[data-piece-id="${ozt.id}"]`,
      );
      assert.equal(await displayed.count(), 1);
      assert.equal(
        await displayed.locator(`img[src="${imageFor("32104")}"]`).count(),
        1,
        "Actual Operation Zero Tolerance artwork identifies the physical scheme",
      );
      assert.equal(
        await displayed
          .locator(
            `[aria-label="Operation Zero Tolerance: ${ozt.captured?.length || 0} facedown cards; lose at ${state.playerCount + 3}"]`,
          )
          .count(),
        1,
        "The accessible captured count uses the actual physical scheme",
      );
      assert.match(
        await displayed.innerText(),
        new RegExp(`${ozt.captured?.length || 0}.*facedown`, "i"),
        "The public board shows the actual facedown captured count",
      );
      for (const hidden of ozt.captured || [])
        assert.equal(
          await displayed.locator(`[data-piece-id="${hidden.id}"]`).count(),
          0,
          "Captured source cards remain hidden, without a duplicate visible card",
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
  await checkpoint(`${current.kind}-${id}-source-deck`, width);
  await page.keyboard.press("Escape");
}
async function publicSource(count, difficulty, width, allocation) {
  current = {
    kind: allocation ? "allocated-team-setup" : `public-${count}-${difficulty}`,
    count,
    difficulty,
    width,
  };
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
    .getByRole("button", { name: "Project Wideawake", exact: true })
    .click();
  const modular = page.getByRole("combobox", {
    name: "Modular encounter",
    exact: true,
  });
  assert.equal(await modular.inputValue(), "sentinels");
  assert.equal(
    await modular.locator('option[value="zero_tolerance"]').count(),
    0,
    "The fixed required Zero Tolerance set cannot be selected twice",
  );
  assert.match(
    await page.locator(".module-label").innerText(),
    /Zero Tolerance/i,
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
  await modular.selectOption("sentinels");
  if (allocation) {
    await page.getByText("Starting captures", { exact: true }).click();
    for (const [index, id] of ["colossus", "shadowcat"].entries()) {
      const input = page.getByRole("spinbutton", {
        name: `Starting captures for ${sources[id].name}`,
        exact: true,
      });
      await input.fill(String(allocation[index]));
      assert.equal(await input.inputValue(), String(allocation[index]));
    }
    await checkpoint("allocated-team-setup-actual-controls", width);
  }
  await page.locator("#mission-seed").fill("32084");
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  let state = await save();
  assert.equal(state.villainId, "project_wideawake");
  assert.equal(state.playerCount, count);
  assert.equal(state.difficulty, difficulty.toLowerCase());
  assert.deepEqual(state.modules, ["sentinels"]);
  assert.equal(
    state.villain.code,
    difficulty === "Standard" ? "32084" : "32085",
  );
  assert.equal(
    state.villain.maxHp,
    (difficulty === "Standard" ? 16 : 18) * count,
  );
  assert.equal(state.villain.tough, true);
  assert.equal(state.scheme.code, "32087b");
  const expectedAllocation = allocation || [
    difficulty === "Standard" ? 1 : 2,
    ...Array(count - 1).fill(0),
  ];
  assert.deepEqual(
    state.projectWideawake.captureAllocation,
    expectedAllocation,
  );
  const initialCaptured =
    state.sideSchemes.find((p) => p.code === "32104").captured || [];
  assert.equal(
    initialCaptured.length,
    expectedAllocation.reduce((sum, n) => sum + n, 0),
  );
  for (let index = 0; index < count; index++)
    assert.equal(
      initialCaptured.filter((p) => p.ownerId === `p${index + 1}`).length,
      expectedAllocation[index],
      "Original starting captured cards come from exactly the configured source seat",
    );
  const f = snapshot(state);
  assert.equal(state.projectWideawake.setAsideCaptives.length, 4);
  assert.deepEqual(
    state.projectWideawake.setAsideCaptives.map((p) => p.code).sort(),
    ["32089", "32090", "32091", "32092"],
  );
  for (const p of state.players) {
    assert.deepEqual(
      p.deckCards.filter((code) => code !== "32031a").sort(),
      sources[p.heroId].codes,
    );
    assert.equal(seat(state, p.id).form, "alter");
    assert.equal(seat(state, p.id).hand.length, 6);
  }
  conserved(state, f, "actual public source mulligan");
  for (let n = 0; n < 40; n++) {
    state = await save();
    if (state.phase === "player" && !state.prompt) break;
    if (state.prompt) {
      assert.equal(state.prompt.kind, "choice");
      const organic = state.prompt.options.find((o) => o.image === "32006");
      const abduction =
        state.prompt.options.every((o) => o.image === "32100") &&
        state.prompt.options[0];
      const option = organic || abduction;
      assert.ok(
        option,
        "Unreviewed actual source setup choice: " +
          JSON.stringify(state.prompt),
      );
      await window(
        `${current.kind}-${organic ? "organic-steel-source-search" : "original-abduction-source-search"}`,
        width,
        f,
      );
      await choice(option.id);
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
  const mall = state.sideSchemes.find((p) => p.code === "32088a");
  const ozt = state.sideSchemes.find((p) => p.code === "32104");
  const abduction = state.sideSchemes.find((p) => p.code === "32100");
  assert.ok(mall && ozt && abduction);
  assert.equal(mall.counters, 4, "Printed Mall starting threat is fixed");
  assert.equal(ozt.counters, 3 * count);
  assert.equal(abduction.counters, 2 + 2 * count);
  assert.equal(state.scheme.threat, count);
  assert.equal(
    state.encounter.deck.length,
    difficulty === "Standard" ? 34 + count : 38,
  );
  assert.equal(
    state.encounter.dealt.length,
    difficulty === "Expert" ? count - 1 : 0,
  );
  const originals = allPieces(state).filter((p) => {
    const source = definition(p);
    return (
      [
        "project_wideawake",
        "zero_tolerance",
        "sentinels",
        "standard",
        "expert",
      ].includes(source.set_code) ||
      (source.type_code === "obligation" &&
        state.players.some((seat) => seat.heroId === source.set_code))
    );
  });
  assert.equal(originals.length, (difficulty === "Standard" ? 41 : 44) + count);
  assert.match(await page.locator(".main-scheme").innerText(), /NO LIMIT/);
  assert.equal(await page.locator(".main-scheme .threat-track").count(), 0);
  assert.equal(await page.locator(".main-scheme.critical").count(), 0);
  await window(`${current.kind}-actual-setup-originals`, width, f);
  checks.push({
    ...current,
    sourceCards: 40 * count,
    modularCards: 14,
    originalEncounterPieces: originals.length,
    exactReload: true,
  });
}

async function attackChoice(id, label) {
  return select((o) => o.id === id, label);
}
async function actualAbility(id, label) {
  const host = page.locator(`.in-play-card[data-piece-id="${id}"]`);
  assert.equal(
    await host.count(),
    1,
    "One actual controlled source card exposes the native action",
  );
  await page.mouse.move(4, 4);
  await host
    .locator(".in-play-actions button")
    .filter({ hasText: label })
    .click();
  return settle();
}
async function attachmentAction(code, label) {
  const host = page
    .locator(".attached-piece")
    .filter({ has: page.locator(`img[src="${imageFor(code)}"]`) });
  assert.equal(
    await host.count(),
    1,
    "The actual attachment exposes its native action",
  );
  await page.mouse.move(4, 4);
  await host.locator("button").filter({ hasText: label }).click();
  return settle();
}
async function cancelPayment() {
  assert.equal((await save()).prompt?.kind, "payment");
  await page
    .locator(".payment-modal")
    .getByRole("button", { name: "Cancel", exact: true })
    .click();
  return settle();
}
async function defeatWindow(id, label, nextId) {
  const state = await save();
  const response = state.prompt?.options.find((o) =>
    matchesOption(state, o, (x) =>
      [`${id}:defeated`, `${id}:wideawake-defeated`].includes(x.id),
    ),
  );
  if (response) return choice(response.id);
  assert.ok(
    !state.prompt ||
      passOption(state) ||
      (nextId &&
        state.prompt.options.some((o) =>
          matchesOption(state, o, (x) => x.id === nextId),
        )),
    `${label}: unreviewed mandatory source window ${JSON.stringify(state.prompt)}`,
  );
  return state;
}
async function runCase(kind, width) {
  if (kind === "allocated-team-setup")
    return publicSource(2, "Standard", width, [0, 1]);
  current = { kind, width };
  const native = fixture(kind),
    f = { ...native, ...snapshot(native.state) };
  await open(f, width);
  let state = await save();
  const operation = () => state.sideSchemes.find((p) => p.id === f.oztId);
  if (state.prompt?.options.some((o) => o.id === "go"))
    state = await choice("go");
  if (kind === "permanent-thwart") {
    await basic("thwart");
    state = await target(f.oztId);
    state = await finishChoices();
    assert.equal(operation().counters, 0);
    assert.equal(operation().captured?.length || 0, f.initialCaptured);
    assert.ok(!state.encounter.discard.some((p) => p.id === f.oztId));
    assert.match(
      await page
        .locator(`.table-side-scheme[data-piece-id="${f.oztId}"]`)
        .innerText(),
      /PERMANENT/,
    );
  } else if (kind === "main-capture-solo" || kind === "main-capture-team") {
    state = await finishChoices();
    assert.equal(
      state.phase,
      "player",
      "The main scheme has no threat-loss limit",
    );
    assert.equal(
      state.scheme.threat,
      1,
      "One qualifying placement captures once and removes exactly5 per hero",
    );
    const captured = operation().captured;
    assert.equal(captured.length, 1);
    assert.equal(captured[0].id, f.topId);
    assert.equal(captured[0].ownerId, f.ownerId);
    assert.ok(!seat(state, f.ownerId).deck.some((p) => p.id === f.topId));
    assert.equal(state.projectWideawake.handledThreatTokens.length, 1);
  } else if (kind === "capture-loss") {
    state = await finishChoices();
    assert.equal(
      state.phase,
      "lost",
      "Four actual facedown cards meet the solo loss threshold",
    );
    assert.deepEqual(
      operation().captured.map((p) => p.id),
      f.topIds,
    );
    assert.equal(operation().captured.length, state.playerCount + 3);
    assert.match(
      await page.getByRole("dialog").innerText(),
      /defeat|lost|mission failed/i,
    );
  } else if (kind === "mall-jubilee") {
    await basic("thwart");
    state = await target(f.mallId);
    await defeatWindow(f.mallId, "Mall", f.sentinelId);
    state = await select(
      (o) => o.id === f.sentinelId,
      "The actual selected Sentinel search result",
    );
    state = await finishChoices();
    assert.ok(
      state.minions.some(
        (p) => p.id === f.sentinelId && p.engagedWith === "p1",
      ),
    );
    assert.equal(state.projectWideawake.jubileeId, f.mallId);
    const jubilee = seat(state, "p1").inPlay.find((p) => p.id === f.mallId);
    assert.equal(jubilee.code, "32088b");
    assert.equal(jubilee.damage, 0);
    assert.ok(!state.sideSchemes.some((p) => p.id === f.mallId));
    assert.ok(!state.encounter.discard.some((p) => p.id === f.mallId));
    assert.equal(
      await page
        .locator(
          `.in-play-card[data-piece-id="${f.mallId}"][data-card-code="32088b"]`,
        )
        .count(),
      1,
    );
    assert.equal(
      seat(state, "p1").inPlay.filter((p) => definition(p).type_code === "ally")
        .length,
      4,
      "Jubilee enters alongside three ordinary allies without an ally-limit discard",
    );
  } else if (kind === "jubilee-payment") {
    state = await actualAbility(f.jubileeId, /Jubilee.*energy/i);
    state = await target(f.targetId);
    assert.equal(state.prompt.kind, "payment");
    assert.equal(state.prompt.cost, 1);
    assert.deepEqual(state.prompt.requirements, ["energy"]);
    assert.equal(physical(state, f.jubileeId).exhausted, false);
    await window("jubilee-actual-energy-payment", width, f);
    const wrong = await paymentSource(f.wrongTypeId);
    await wrong.click();
    assert.equal(
      await page
        .getByRole("button", { name: "Confirm payment", exact: true })
        .isDisabled(),
      true,
      "A physical resource cannot pay Jubilee's energy cost",
    );
    await wrong.click();
    const energy = await paymentSource(f.energyId);
    await energy.click();
    const before = await save();
    state = await cancelPayment();
    assert.equal(physical(state, f.jubileeId).exhausted, false);
    assert.equal(physical(state, f.targetId).damage, 0);
    assert.deepEqual(
      state.player.hand.map((p) => p.id),
      before.player.hand.map((p) => p.id),
    );
    state = await actualAbility(f.jubileeId, /Jubilee.*energy/i);
    state = await target(f.targetId);
    state = await pay([f.energyId]);
    state = await finishChoices();
    assert.equal(physical(state, f.jubileeId).exhausted, true);
    assert.equal(physical(state, f.targetId).damage, 2);
    assert.ok(state.player.discard.some((p) => p.id === f.energyId));
    assert.ok(state.player.hand.some((p) => p.id === f.wrongTypeId));
  } else if (kind === "abduction-captive") {
    await basic("thwart");
    state = await target(f.abductionId);
    await defeatWindow(f.abductionId, "Abduction Protocols");
    state = await finishChoices();
    const rescued = seat(state, "p2").inPlay.filter((p) =>
      f.captiveIds.includes(p.id),
    );
    assert.equal(
      rescued.length,
      1,
      "One actual seeded Captive enters the defeating player's play area",
    );
    assert.equal(rescued[0].ownerId, "p2");
    assert.equal(state.projectWideawake.setAsideCaptives.length, 3);
    assert.ok(state.victoryDisplay.some((p) => p.id === f.abductionId));
    await window("abduction-actual-seeded-rescue", width, f);
    state = await actualAbility(rescued[0].id, /Attack/i);
    if (state.villain.code !== "32086") state = await target(state.villain.id);
    assert.equal(physical(state, rescued[0].id).exhausted, true);
    if (state.prompt?.options.some((o) => o.image === "32100"))
      state = await select(
        (o) => o.image === "32100",
        "Actual stageIII Abduction search",
      );
    state = await finishChoices();
    assert.equal(state.villain.code, "32086");
    assert.equal(state.villain.maxHp, 44);
    assert.equal(state.villain.tough, true);
    assert.match(definition(state.villain).text, /Stalwart/);
    assert.equal(
      state.encounter.dealt.length,
      2,
      "Original SentinelIII deals each player including the first player",
    );
    assert.deepEqual(state.encounter.dealt.map((p) => p.dealtTo).sort(), [
      "p1",
      "p2",
    ]);
    assert.equal(state.sideSchemes.filter((p) => p.code === "32100").length, 1);
  } else if (kind === "attacked-ally-capture") {
    await window("ozt-actual-enemy-attack-defense", width, f);
    state = await attackChoice(f.allyId, "Defend with the actual Jubilee");
    state = await finishChoices();
    assert.deepEqual(
      operation().captured.map((p) => p.id),
      [f.allyId],
    );
    assert.equal(operation().captured[0].code, "32088b");
    assert.ok(
      !state.victoryDisplay.some((p) => p.id === f.allyId),
      "The same Victory-1 ally is captured through actual enemy attack defeat",
    );
    assert.ok(!state.player.inPlay.some((p) => p.id === f.allyId));
  } else if (kind === "consequential-discard") {
    state = await actualAbility(f.allyId, /Attack/i);
    state = await target(f.minionId);
    state = await finishChoices();
    assert.equal(physical(state, f.minionId).damage, 2);
    assert.ok(state.player.discard.some((p) => p.id === f.allyId));
    assert.equal(
      operation().captured?.length || 0,
      0,
      "Consequential defeat is not an enemy attack defeat",
    );
  } else if (kind === "captive-combat") {
    state = await actualAbility(f.allyId, /Attack/i);
    state = await target(f.targetId);
    state = await select(
      (o) => o.id.startsWith(`wideawake-response:${f.allyId}:`),
      "Rictor actual after-attack response",
    );
    state = await finishChoices();
    assert.ok(state.encounter.discard.some((p) => p.id === f.targetId));
    assert.equal(state.villain.hp, 15);
    assert.equal(physical(state, f.otherMinionId).damage, 1);
    assert.equal(physical(state, f.allyId).damage, 1);
    assert.equal(operation().captured?.length || 0, 0);
  } else if (kind === "boom-bombs") {
    state = await actualAbility(f.allyId, /Attack/i);
    if (state.villain.hp !== 15) state = await target(state.villain.id);
    assert.equal(physical(state, f.allyId).exhausted, true);
    state = await select(
      (o) => o.id.startsWith(`wideawake-response:${f.allyId}:`),
      "Boom Boom actual after-attack response",
    );
    state = await finishChoices();
    assert.equal(state.villain.hp, 15);
    assert.equal(
      physical(state, f.allyId).damage,
      2,
      "The actual attack takes Retaliate1 plus consequential1 before the delayed bomb",
    );
    assert.deepEqual(state.projectWideawake.bombs, [
      { enemyId: state.villain.id, count: 1 },
    ]);
    assert.equal(state.projectWideawake.delayedBombs.length, 1);
    const counter = page.locator('[aria-label="Bomb counters on Sentinel: 1"]');
    assert.equal(await counter.count(), 1);
    assert.match(await counter.innerText(), /2.*damage.*end.*player phase/is);
    await window("boom-boom-actual-saved-counter", width, f);
    const round = state.round;
    state = await beginVillainPhase();
    state = await finishChoices();
    assert.equal(state.phase, "player");
    assert.equal(state.round, round + 1);
    assert.equal(
      state.villain.hp,
      13,
      "The saved bomb deals exactly2 unlabelled damage at actual player-phase end",
    );
    assert.deepEqual(state.projectWideawake.bombs, []);
    assert.deepEqual(state.projectWideawake.delayedBombs, []);
    assert.equal(await counter.count(), 0);
    assert.equal(
      physical(state, f.allyId).damage,
      2,
      "Unlabelled bomb damage does not trigger another Retaliate",
    );
    assert.ok(state.player.inPlay.some((p) => p.id === f.allyId));
  } else if (kind === "sentinel-upgrades") {
    state = await finishChoices();
    assert.equal(state.villain.maxHp, 24);
    assert.deepEqual(enemyStats(state, state.villain), {
      attack: 3,
      scheme: 3,
    });
    for (let index = 0; index < 3; index++) {
      const code = ["32094", "32095", "32096"][index];
      state = await attachmentAction(
        code,
        new RegExp(`Discard ${definition({ code }).name}`, "i"),
      );
      assert.equal(state.prompt.kind, "payment");
      assert.equal(state.prompt.cost, 3);
      assert.deepEqual(
        state.prompt.requirements,
        Array(3).fill(["physical", "mental", "energy"][index]),
      );
      await window(`sentinel-${code}-actual-typed-payment`, width, f);
      state = await pay(f.resourceIds.slice(index * 2, index * 2 + 2));
      state = await finishChoices();
      assert.ok(
        state.encounter.discard.some((p) => p.id === f.attachmentIds[index]),
      );
    }
    assert.equal(state.villain.maxHp, 16);
    assert.deepEqual(enemyStats(state, state.villain), {
      attack: 2,
      scheme: 2,
    });
  } else if (kind === "self-repair") {
    state = await finishChoices();
    assert.equal(state.villain.hp, 11);
    assert.equal(state.villain.stunned, false);
    assert.equal(state.villain.confused, false);
    assert.equal(state.villain.tough, true);
    assert.ok(state.encounter.discard.some((p) => p.id === f.sourceId));
  } else if (kind === "mutant-detected") {
    assert.equal(state.prompt.title, "Mutant Detected");
    await window("mutant-detected-actual-capture-or-attacks", width, f);
    state = await choice("capture");
    assert.deepEqual(
      operation().captured.map((p) => p.id),
      [f.topId],
    );
    assert.equal(state.prompt.title, "Mutant Detected");
    state = await choice("attacks");
    state = await finishChoices();
    assert.equal(state.player.form, "alter");
    assert.equal(
      state.player.hp,
      8,
      "The villain and engaged Sentinel attack even in alter-ego",
    );
    assert.equal(operation().captured.length, 1);
    assert.ok(
      f.sourceIds.every((id) =>
        state.encounter.discard.some((p) => p.id === id),
      ),
    );
  } else if (kind === "warn-others") {
    state = await actualAbility(f.removeId, /Warn the Others.*exhaust/i);
    assert.equal(state.player.exhausted, true);
    assert.ok(state.encounter.discard.some((p) => p.id === f.removeId));
    state = await flip();
    state = await finishChoices();
    assert.equal(state.player.form, "hero");
    state = await beginVillainPhase();
    assert.equal(
      state.attack.attacker,
      state.villain.id,
      "Public end-phase confirmation commits the actual turn-end window",
    );
    assert.deepEqual(
      operation().captured.map((p) => p.id),
      [f.captureId],
    );
    assert.ok(!state.player.inPlay.some((p) => p.id === f.captureId));
  } else if (kind === "zero-tolerance-minions") {
    if (state.prompt?.options.some((o) => o.id === f.barrierId))
      state = await choice(f.barrierId);
    assert.equal(
      state.attachments.find((p) => p.id === f.barrierId).attachedTo,
      f.searchMarkIIIId,
      "The actual searched Barrier attaches to the revealed MarkIII",
    );
    assert.equal(physical(state, f.searchMarkIIIId).tough, true);
    assert.equal(
      physical(state, f.markIIIId).tough,
      false,
      "The actual upcoming attacker has already spent its Tough",
    );
    assert.equal(state.attack.attacker, f.markIIIId);
    const surgeTopId = state.encounter.deck[0].id;
    await window("mark-iii-actual-barrier-attack", width, f);
    state = await attackChoice("take", "Take the actual Barrier minion attack");
    state = await finishChoices();
    assert.equal(state.player.hp, 9);
    assert.equal(physical(state, f.markIIIId).tough, true);
    assert.ok(state.minions.some((p) => p.id === f.markIIId));
    assert.ok(
      state.encounter.dealt.some(
        (p) => p.id === surgeTopId && p.dealtTo === "p1",
      ),
      "MarkII sees real OZT and deals the next actual encounter through Surge",
    );
  } else if (kind === "targeted-elimination") {
    if (
      !state.attachments.some(
        (p) => p.code === "32107" && f.targetedIds.includes(p.id),
      )
    )
      state = await select(
        (o) => f.targetedIds.includes(o.id),
        "Actual MarkV searches Targeted for Elimination",
      );
    state = await finishChoices();
    const targeted = state.attachments.find((p) => p.code === "32107");
    assert.ok(f.targetedIds.includes(targeted.id));
    assert.equal(targeted.attachedTo, "hero:p1");
    assert.equal(state.player.flipped, false);
    assert.equal(
      await page.locator(".flip-button").isDisabled(),
      true,
      "Live Sentinel engagement plus Targeted prohibit hero to alter-ego",
    );
    state = await attachmentAction(
      "32107",
      /Targeted for Elimination.*exhaust/i,
    );
    assert.equal(state.player.exhausted, true);
    assert.ok(state.encounter.discard.some((p) => p.id === targeted.id));
    assert.equal(await page.locator(".flip-button").isDisabled(), false);
    state = await flip();
    state = await finishChoices();
    assert.equal(state.player.form, "alter");
  } else if (kind === "mark-vi-boost") {
    state = await attackChoice(
      "take",
      "Take the actual Sentinel villain attack",
    );
    assert.equal(state.prompt.title, "Sentinel Mark VI");
    assert.deepEqual(
      state.prompt.options.map((o) => o.id),
      ["p1", "p2"],
    );
    await window("mark-vi-actual-boost-recipient", width, f);
    state = await choice("p2");
    state = await finishChoices();
    const dealt = state.encounter.dealt.find((p) => p.id === f.boostId);
    assert.equal(dealt.code, "32106");
    assert.equal(dealt.dealtTo, "p2");
    assert.ok(!state.minions.some((p) => p.id === f.boostId));
    assert.ok(!state.encounter.discard.some((p) => p.id === f.boostId));
    assert.equal(seat(state, "p1").hp, 12);
    assert.equal(seat(state, "p2").hp, 9);
  } else if (kind === "relentless-robots") {
    state = await basic("thwart");
    assert.ok(
      state.prompt.options.every(
        (o) => !matchesOption(state, o, (x) => x.id === f.schemeId),
      ),
      "Engaged acting player has no legal Relentless Robots thwart target",
    );
    state = await target(f.oztId);
    assert.equal(
      operation().counters,
      5,
      "Other legal schemes remain available to the engaged player",
    );
    assert.equal(
      state.scheme.threat,
      3,
      "Actual Abduction Crisis keeps the main scheme unavailable",
    );
    await page
      .getByRole("button", { name: "End hero turn", exact: true })
      .click();
    state = await settle();
    assert.equal(state.activePlayerId, "p2");
    state = await basic("thwart");
    state = await target(f.schemeId);
    state = await finishChoices();
    assert.ok(
      state.encounter.discard.some((p) => p.id === f.schemeId),
      "The unengaged other seat actually thwarts that same scheme",
    );
  } else if (kind === "battle-round") {
    const round = state.round;
    state = await beginVillainPhase();
    state = await finishChoices();
    assert.equal(state.phase, "player");
    assert.equal(state.round, round + 1);
    assert.equal(state.firstPlayerId, "p2");
    assert.equal(state.projectWideawake.jubileeId, f.jubileeId);
    assert.ok(
      seat(state, "p2").inPlay.some(
        (p) => p.id === f.jubileeId && p.code === "32088b",
      ),
    );
    assert.ok(!seat(state, "p1").inPlay.some((p) => p.id === f.jubileeId));
    assert.equal(seat(state, "p1").hp, 10);
    assert.equal(seat(state, "p2").hp, 5);
    assert.equal(state.scheme.threat, 2);
    assert.equal(operation().captured?.length || 0, 0);
    assert.equal(state.villain.tough, true);
    assert.ok(seat(state, "p2").inPlay.some((p) => p.code === "32099"));
    assert.equal(
      await page
        .locator(
          `.in-play-card[data-piece-id="${f.jubileeId}"][data-card-code="32088b"]`,
        )
        .count(),
      1,
    );
  } else throw Error(`Unknown reviewed browser flow ${kind}`);
  if (kind === "capture-loss") {
    // Finished missions leave the unfinished-mission resume banner. Exercise
    // their public replay control while the actual result is still open.
    await checkpoint(`${kind}-resolved`, width, f);
    await page
      .getByRole("button", { name: "Replay this seed", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    const replayed = await save();
    assert.equal(replayed.phase, "mulligan");
    assert.equal(replayed.startSeed, f.state.startSeed);
    assert.deepEqual(
      replayed.projectWideawake.captureAllocation,
      [0],
      "Actual replay preserves explicit zero instead of substituting the Standard default",
    );
    assert.equal(
      replayed.sideSchemes.find((p) => p.code === "32104").captured?.length ||
        0,
      0,
    );
    await window(
      "capture-loss-actual-zero-allocation-replay",
      width,
      snapshot(replayed),
    );
  } else await window(`${kind}-resolved`, width, f);
  checks.push({
    kind,
    width,
    sourceCards: 40 * f.sources.length,
    modularCards: 14,
    originalPieces: f.originals.length,
    exactReload: true,
  });
}

try {
  if (!process.env.PROJECT_WIDEAWAKE_FIXTURE_ONLY)
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
