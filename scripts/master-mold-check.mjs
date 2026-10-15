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

const output = process.env.MASTER_MOLD_OUTPUT || "output/master-mold/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const defaults = [
  "sentinel-guard-stage",
  "scheme-put-solo",
  "scheme-put-team",
  "stage-two",
  "stage-two-loss",
  "magneto-attack-heal",
  "magneto-thwart-limit",
  "magneto-round-control",
  "mark-viii-unit",
  "mark-viii-beam",
  "unit-reveal-retaliate",
  "unit-boost",
  "stun-beam-damage",
  "stun-beam-defender",
  "children-hero",
  "children-alter",
  "shields-up",
  "intruder-defeater",
  "virus-hinder",
  "virus-victory",
];
const scenarios = (process.env.MASTER_MOLD_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.MASTER_MOLD_VIEWPORTS || "1440,1280,390,320")
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
  ["master_mold", "zero_tolerance", "sentinels"].map((set) => [
    set,
    definitions
      .filter(
        (c) =>
          c.set_code === set &&
          !["villain", "main_scheme"].includes(c.type_code),
      )
      .flatMap((c) => Array(c.quantity).fill(c.code))
      .sort(),
  ]),
);
assert.equal(originalEncounterCodes.master_mold.length, 13);
assert.equal(originalEncounterCodes.zero_tolerance.length, 7);
assert.equal(originalEncounterCodes.sentinels.length, 7);

// The focused positions preserve actual pieces from a completed original-source
// setup. Only their zones and damage are arranged; commands use the native host.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources,enemyStats,allyLimit,allyCount} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card,imageFor} from './src/game/cards.ts';
import {isTextBlank} from './src/game/card-text.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
export {imageFor,enemyStats,allyLimit,allyCount,isTextBlank};
export const definition=p=>card(p);
export const sourceCodes=id=>heroStarterCodes(id).filter(code=>code!=='32031a').sort();
export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};
export function fixture(kind){
 const team=['sentinel-guard-stage','scheme-put-team','stun-beam-defender','intruder-defeater','magneto-round-control'].includes(kind);
 const hero=id=>({heroId:id,aspect:id==='colossus'?'protection':'aggression',deckCards:heroStarterCodes(id),deckOrigin:'source'});
 const heroes=[hero('colossus'),...(team?[hero('shadowcat')]:[])];
 let s=newGame({heroId:'colossus',aspect:'protection',heroes,villainId:'master_mold',module:'zero_tolerance',modules:['zero_tolerance'],difficulty:'standard',seed:32109,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}return s;}
 for(let n=0;n<100&&(s.phase==='mulligan'||s.prompt);n++){
  if(s.review){command({type:'PROCEED'});continue;}
  if(s.prompt){const organic=s.prompt.options?.find(o=>o.image==='32006');const order=s.prompt.title==='Master Mold · each player'&&s.prompt.options.find(o=>o.id==='p1');const only=s.prompt.options?.length===1?s.prompt.options[0]:null;if(!organic&&!order&&!only)throw Error('Unreviewed actual Master Mold source setup '+JSON.stringify(s.prompt));command({type:'CHOOSE',id:(organic||order||only).id});}
  else command({type:'MULLIGAN',ids:[]});
 }
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native original Master Mold setup incomplete');
 const magneto=s.players.flatMap(seat=>seatView(s,seat).player.inPlay).find(p=>p.code==='32172b');
 if(!magneto)throw Error('Actual standalone Magneto setup required');
 // Return setup engagements and attachments to the same physical encounter
 // deck, so each focused position has only the specified actual engagement.
 s.encounter.deck.push(...s.minions.splice(0));
 s.encounter.deck.push(...s.attachments.splice(0).map(p=>{delete p.attachedTo;return p;}));
 s.encounter.deck.push(...s.encounter.dealt.splice(0).map(p=>{delete p.dealtTo;return p;}));
 for(const seat of s.players){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=seat.heroId==='colossus'?14:9;p.exhausted=false;p.flipped=false;p.tough=false;p.toughCards=0;}
 activateSeat(s,'p1');s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;s.villain.tough=false;s.villain.toughCards=0;
 function player(id='p1'){return seatView(s,id).player;}
 function take(code,id='p1'){const p=player(id);for(const z of[p.hand,p.deck,p.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing original player source '+code+' for '+id);}
 function put(code,id='p1'){const p=take(code,id);p.exhausted=false;player(id).inPlay.push(p);return p;}
 function encounter(code){for(const z of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual encounter '+code);}
 function native(effects){s.prompt={kind:'choice',title:'Resolve native source',text:'Continue the actual native encounter action.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code){const p=encounter(code);s.resolving.push(p);return p;}
 function minion(code,id='p1'){const p=encounter(code);p.engagedWith=id;p.damage=0;p.tough=false;p.toughCards=0;s.minions.push(p);return p;}
 function attach(code,target){const p=encounter(code);p.attachedTo=target;s.attachments.push(p);return p;}
 function order(codes){const ps=codes.map(encounter);s.encounter.deck.unshift(...ps);return ps;}
 function discard(codes){const ps=codes.map(encounter);s.encounter.discard.push(...ps);return ps;}
 function revealEffects(codes){return codes.map(code=>({type:'reveal',piece:reveal(code),skip:true}));}
 let ids={magnetoId:magneto.id};
 if(kind==='sentinel-guard-stage'){
  const p=minion('32101');p.damage=1;ids.minionId=p.id;ids.otherMinionId=minion('32105','p2').id;s.villain.hp=1;
  native([{type:'status',target:s.villain.id,status:'stunned'},{type:'status',target:s.villain.id,status:'confused'}]);
 }else if(kind==='scheme-put-solo'||kind==='scheme-put-team'){
  const id=team?'p2':'p1';player(id).form='alter';ids.actorId=id;ids.milledIds=order(['32107','32105']).map(p=>p.id);ids.followingId=s.encounter.deck[2].id;
  native([{type:'enemyScheme',id:s.villain.id,actorId:id}]);
 }else if(kind==='stage-two'||kind==='stage-two-loss'){
  ids.discardId=discard(['32117'])[0].id;
  native([{type:'threat',target:'main',amount:6},...(kind==='stage-two-loss'?[{type:'threat',target:'main',amount:8}]:[])]);
 }else if(kind==='magneto-attack-heal'){
  magneto.damage=4;const p=minion('32105');p.damage=2;ids.minionId=p.id;
 }else if(kind==='magneto-thwart-limit'){
  put('32002');put('32011');put('32012');s.scheme.threat=4;
 }else if(kind==='magneto-round-control'){
  ids.roundIds=order(['32118','32118','32104','32120']).map(p=>p.id);
 }else if(kind==='mark-viii-unit'){
  ids.attachmentIds=discard(['32116','32115']).map(p=>p.id);const p=reveal('32114');ids.minionId=p.id;native([{type:'reveal',piece:p,skip:true}]);
 }else if(kind==='mark-viii-beam'){
  const p=reveal('32114');ids.minionId=p.id;ids.attachedId=attach('32116',p.id).id;ids.topmostId=discard(['32116'])[0].id;native([{type:'reveal',piece:p,skip:true}]);
 }else if(kind==='unit-reveal-retaliate'){
  const p=minion('32105');p.damage=4;ids.minionId=p.id;const a=reveal('32115');ids.attachmentId=a.id;native([{type:'reveal',piece:a,skip:true}]);
 }else if(kind==='unit-boost'){
  ids.minionId=minion('32105').id;ids.boostId=order(['32115'])[0].id;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);
 }else if(kind==='stun-beam-damage'||kind==='stun-beam-defender'){
  const p=minion('32105');ids.minionId=p.id;ids.beamId=attach('32116',p.id).id;native([{type:'enemyAttack',id:p.id,actorId:'p1'}]);
 }else if(kind==='children-hero'){
  ids.minionIds=[minion('32101').id,minion('32105').id];native(revealEffects(['32117']));
 }else if(kind==='children-alter'){
  player().form='alter';const effects=revealEffects(['32117']);ids.milledIds=order(['32107','32105']).map(p=>p.id);native(effects);
 }else if(kind==='shields-up'){
  ids.minionIds=[minion('32101').id,minion('32105').id];const effects=revealEffects(['32118']);ids.otherId=order(['32118'])[0].id;
  native([...effects,{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);
 }else if(kind==='intruder-defeater'){
  const p=encounter('32119');p.counters=1;s.sideSchemes.push(p);ids.schemeId=p.id;activateSeat(s,'p2');s.turnPlayerId='p2';ids.milledIds=order(['32107','32105']).map(p=>p.id);
 }else if(kind==='virus-hinder'){
  const p=reveal('32120');ids.schemeId=p.id;native([{type:'reveal',piece:p,skip:true}]);
 }else if(kind==='virus-victory'){
  const p=encounter('32120');p.counters=1;s.sideSchemes.push(p);ids.schemeId=p.id;ids.minionIds=[minion('32101').id,minion('32105').id];
 }else throw Error('Unknown reviewed Master Mold fixture '+kind);
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
  allyCount,
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
        .filter((q) => q.ownerId === p.id && q.code !== "32172b")
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
  assert.equal(
    state.villain.maxHp,
    definition(state.villain).health * state.playerCount,
    `${label}: original printed Master Mold health per starting hero`,
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
    `${label}: seven original configurable Zero Tolerance pieces`,
  );
  assert.equal(
    f.modular.filter((p) => definition(p)?.set_code === "sentinels").length,
    7,
    `${label}: seven required original Sentinels pieces`,
  );
  for (const [set, codes] of Object.entries(originalEncounterCodes))
    assert.deepEqual(
      pieces
        .filter((p) => definition(p)?.set_code === set)
        .map((p) => p.code)
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
  const magneto = pieces.filter((p) => p.code === "32172b");
  assert.equal(
    magneto.length,
    1,
    `${label}: one actual standalone Magneto physical piece`,
  );
  assert.equal(
    magneto[0].ownerId,
    undefined,
    `${label}: standalone Magneto is not an owned starter card`,
  );
}

if (process.env.MASTER_MOLD_FIXTURE_CHECK) {
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
  const entryBytes = await readFile(
    resolve(output, `${stage}-${basename(new URL(js[0]).pathname)}`),
  );
  const coreChunks = [
    ...new Set(
      [...entryBytes.toString().matchAll(/core-cards-[\w-]+\.js/g)].map(
        (m) => m[0],
      ),
    ),
  ];
  assert.equal(
    coreChunks.length,
    1,
    "The actual production entry declares one core card chunk",
  );
  const coreUrl = new URL(coreChunks[0], js[0]).href;
  const coreBytes = await curlFile(
    coreUrl,
    resolve(output, `${stage}-${coreChunks[0]}`),
  );
  proof.push({
    kind: "core-cards",
    url: coreUrl,
    status: 200,
    sha256: createHash("sha256").update(coreBytes).digest("hex"),
    transport: "curl with inherited proxy and TLS settings",
  });
  if (process.env.MASTER_MOLD_CORE_SHA256)
    assert.equal(proof[2].sha256, process.env.MASTER_MOLD_CORE_SHA256);
  if (process.env.MASTER_MOLD_ASSET)
    assert.equal(
      basename(new URL(js[0]).pathname),
      process.env.MASTER_MOLD_ASSET,
    );
  if (process.env.MASTER_MOLD_SHA256)
    assert.equal(proof[0].sha256, process.env.MASTER_MOLD_SHA256);
  if (process.env.MASTER_MOLD_CSS_SHA256)
    assert.equal(proof[1].sha256, process.env.MASTER_MOLD_CSS_SHA256);
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
    if (sessionStorage.getItem("master-mold-fixture-loaded")) return;
    sessionStorage.setItem("master-mold-fixture-loaded", "yes");
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
  if (process.env.MASTER_MOLD_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.MASTER_MOLD_ASSET),
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
  if (state?.villainId === "master_mold") {
    assert.equal(
      await page
        .locator(`.villain-card img[src="${imageFor(state.villain.code)}"]`)
        .count(),
      1,
      "Actual current original Master Mold stage artwork",
    );
    assert.equal(
      await page
        .locator(`.scheme-card img[src="${imageFor(state.scheme.code)}"]`)
        .count(),
      1,
      "Actual current original Master Mold main scheme artwork",
    );
    const magneto = allPieces(state).find((p) => p.code === "32172b");
    const controller = state.players.find((p) =>
      seat(state, p.id).inPlay.some((q) => q.id === magneto.id),
    );
    if (controller) {
      const active = page.locator(
        `.in-play-card[data-piece-id="${magneto.id}"][data-card-code="32172b"]`,
      );
      const teammate = page
        .locator(".teammate-tableau")
        .getByRole("button", {
          name: `Inspect ${sources[controller.heroId].name}’s Magneto`,
          exact: true,
        })
        .locator(`img[src="${imageFor("32172b")}"]`);
      assert.equal(
        (await active.count()) + (await teammate.count()),
        1,
        "The actual controller's standalone Magneto appears once in the active or teammate play area",
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
  if (index === 0) await checkpoint(`${current.kind}-${id}-source-deck`, width);
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
    .getByRole("button", { name: "Master Mold", exact: true })
    .click();
  const modular = page.getByRole("combobox", {
    name: "Modular encounter",
    exact: true,
  });
  assert.equal(await modular.inputValue(), "zero_tolerance");
  assert.equal(
    await modular.locator('option[value="sentinels"]').count(),
    0,
    "The fixed required Sentinels set cannot occupy the selected slot",
  );
  assert.match(
    await page.locator(".module-label").innerText(),
    /Sentinels is included with this scenario\. Choose one additional modular set; Zero Tolerance is recommended\./,
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
  await modular.selectOption("zero_tolerance");
  await page.locator("#mission-seed").fill("32109");
  await page.locator("#start-btn").click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("champions.save.v1"))?.villainId ===
      "master_mold",
  );
  for (let n = 0; n < 8; n++) {
    const setup = await save();
    if (!setup.prompt) break;
    assert.equal(setup.prompt.title, "Master Mold · each player");
    const option =
      setup.prompt.options.find((o) => o.id === "p1") ||
      setup.prompt.options[0];
    assert.ok(["p1", "p2"].includes(option.id));
    await choice(option.id);
  }
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  let state = await save();
  assert.equal(state.villainId, "master_mold");
  assert.equal(state.playerCount, count);
  assert.equal(state.difficulty, difficulty.toLowerCase());
  assert.deepEqual(state.modules, ["zero_tolerance"]);
  assert.equal(
    state.villain.code,
    difficulty === "Standard" ? "32109" : "32110",
  );
  assert.equal(
    state.villain.maxHp,
    (difficulty === "Standard" ? 12 : 14) * count,
  );
  assert.equal(state.villain.tough, true);
  assert.equal(state.scheme.code, "32112b");
  const f = snapshot(state);
  for (const p of state.players) {
    assert.deepEqual(
      p.deckCards.filter((code) => code !== "32031a").sort(),
      sources[p.heroId].codes,
    );
    assert.equal(seat(state, p.id).form, "alter");
    assert.equal(seat(state, p.id).hand.length, 6);
  }
  conserved(state, f, "actual public source mulligan");
  for (let n = 0; n < 60; n++) {
    state = await save();
    if (state.phase === "player" && !state.prompt) break;
    if (state.prompt) {
      assert.equal(state.prompt.kind, "choice");
      const option =
        state.prompt.options.find((o) => o.image === "32006") ||
        (state.prompt.options.length === 1 && state.prompt.options[0]);
      assert.ok(
        option,
        "Unreviewed actual source setup choice " + JSON.stringify(state.prompt),
      );
      await reload();
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
  assert.equal(state.scheme.threat, count);
  assert.equal(
    state.minions.length,
    count,
    "Original setup puts one actual Sentinel per player",
  );
  for (const p of state.players) {
    const engaged = state.minions.filter((m) => m.engagedWith === p.id);
    assert.equal(engaged.length, 1);
    assert.match(definition(engaged[0]).traits, /Sentinel/i);
  }
  const magneto = seat(state, state.firstPlayerId).inPlay.find(
    (p) => p.code === "32172b",
  );
  assert.ok(magneto);
  assert.equal(magneto.ownerId, undefined);
  assert.equal(magneto.damage, 0);
  assert.equal(
    allyCount(state),
    0,
    "Actual first-player Magneto does not consume an ally slot",
  );
  assert.equal(
    state.sideSchemes.some((p) => p.code === "32104"),
    false,
    "PUT setup bypasses MarkII When Revealed instead of revealing required OZT",
  );
  const encounterPieces = allPieces(state).filter(
    (p) =>
      [
        "master_mold",
        "zero_tolerance",
        "sentinels",
        "standard",
        "expert",
      ].includes(definition(p).set_code) ||
      (definition(p).type_code === "obligation" &&
        state.players.some((seat) => seat.heroId === definition(p).set_code)),
  );
  assert.equal(
    encounterPieces.length,
    (difficulty === "Standard" ? 34 : 37) + count,
  );
  await window(`${current.kind}-actual-setup-originals`, width, f);
  checks.push({
    ...current,
    sourceCards: 40 * count,
    modularCards: 14,
    originalEncounterPieces: encounterPieces.length,
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
      [
        `${id}:defeated`,
        `${id}:wideawake-defeated`,
        `${id}:mastermold-defeated`,
      ].includes(x.id),
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
  current = { kind, width };
  const native = fixture(kind),
    f = { ...native, ...snapshot(native.state) };
  await open(f, width);
  let state = await save();
  if (state.prompt?.options.some((o) => o.id === "go"))
    state = await choice("go");
  if (
    ![
      "magneto-attack-heal",
      "unit-boost",
      "stun-beam-damage",
      "stun-beam-defender",
      "stage-two-loss",
    ].includes(kind)
  )
    await checkpoint(`${kind}-initial`, width, f);
  if (kind === "sentinel-guard-stage") {
    assert.equal(state.villain.stunned, false);
    assert.equal(state.villain.confused, false);
    await basic("attack");
    state = await save();
    assert.ok(
      state.prompt.options.every((o) => o.id !== state.villain.id),
      "Live main scheme grants actual Sentinel engagement Guard",
    );
    state = await target(f.minionId);
    state = await finishChoices();
    assert.ok(state.encounter.discard.some((p) => p.id === f.minionId));
    state = await actualAbility(f.magnetoId, /Attack/i);
    if (state.villain.code !== "32110") state = await target(state.villain.id);
    state = await finishChoices();
    assert.equal(state.villain.code, "32110");
    assert.equal(state.villain.hp, 14 * state.playerCount);
    assert.equal(state.villain.tough, true);
  } else if (
    kind === "scheme-put-solo" ||
    kind === "scheme-put-team" ||
    kind === "children-alter"
  ) {
    state = await finishChoices();
    assert.equal(
      state.scheme.threat,
      1,
      "Printed SCH1 resolves without a numeric boost",
    );
    const [discarded, minion] = f.milledIds;
    assert.ok(state.encounter.discard.some((p) => p.id === discarded));
    assert.ok(
      state.minions.some(
        (p) => p.id === minion && p.engagedWith === (f.actorId || "p1"),
      ),
    );
    assert.ok(
      !state.attachments.some((p) => p.code === "32107"),
      "Milled MarkV is PUT into play without its When Revealed search",
    );
    if (f.followingId)
      assert.equal(
        state.encounter.deck[0].id,
        f.followingId,
        "Master Mold takes no boost card for this scheme",
      );
  } else if (kind === "stage-two" || kind === "stage-two-loss") {
    state = await finishChoices();
    assert.equal(state.scheme.code, "32113b");
    assert.equal(state.scheme.index, 1);
    assert.notEqual(
      state.seed,
      f.state.seed,
      "Stage2A shuffled the actual encounter discard into the deck before milling",
    );
    if (kind === "stage-two-loss") {
      assert.equal(state.phase, "lost");
      assert.ok(state.scheme.threat >= 8);
      assert.match(
        await page.getByRole("dialog").innerText(),
        /defeat|lost|mission failed/i,
      );
    } else {
      assert.equal(state.phase, "player");
      assert.equal(state.scheme.threat, 1);
      assert.equal(state.minions.length, 1);
    }
  } else if (kind === "magneto-attack-heal") {
    state = await actualAbility(f.magnetoId, /Attack/i);
    if (
      state.prompt?.options.some((o) =>
        matchesOption(state, o, (x) => x.id === f.minionId),
      )
    )
      state = await target(f.minionId);
    const heal = (o) =>
      o.id.startsWith("mastermold-magneto:") &&
      o.label === "Magneto · heal 1 damage";
    await findChoice(heal, "Magneto actual optional after-defeat heal");
    await window("magneto-actual-heal-window", width, f);
    state = await select(heal, "Magneto actual optional after-defeat heal");
    state = await finishChoices();
    assert.ok(state.encounter.discard.some((p) => p.id === f.minionId));
    assert.equal(
      physical(state, f.magnetoId).damage,
      4,
      "At1HP Magneto heals before consequential damage and survives the actual attack",
    );
    assert.equal(physical(state, f.magnetoId).exhausted, true);
  } else if (kind === "magneto-thwart-limit") {
    assert.equal(allyCount(state), 3);
    assert.equal(allyLimit(state), 3);
    assert.equal(
      state.player.inPlay.filter((p) => definition(p).type_code === "ally")
        .length,
      4,
    );
    state = await actualAbility(f.magnetoId, /Thwart/i);
    if (state.scheme.threat !== 2) state = await target("main");
    state = await finishChoices();
    assert.equal(state.scheme.threat, 2);
    assert.equal(physical(state, f.magnetoId).damage, 1);
  } else if (kind === "magneto-round-control") {
    const round = state.round;
    state = await beginVillainPhase();
    state = await finishChoices();
    assert.equal(state.phase, "player");
    assert.equal(state.round, round + 1);
    assert.equal(state.firstPlayerId, "p2");
    assert.ok(seat(state, "p2").inPlay.some((p) => p.id === f.magnetoId));
    assert.ok(!seat(state, "p1").inPlay.some((p) => p.id === f.magnetoId));
  } else if (kind === "mark-viii-unit") {
    state = await finishChoices();
    assert.equal(physical(state, f.attachmentIds[1]).attachedTo, f.minionId);
    assert.ok(state.encounter.discard.some((p) => p.id === f.attachmentIds[0]));
    assert.deepEqual(enemyStats(state, physical(state, f.minionId)), {
      attack: 4,
      scheme: 4,
    });
  } else if (kind === "mark-viii-beam") {
    state = await finishChoices();
    assert.equal(physical(state, f.topmostId).attachedTo, f.minionId);
    assert.equal(physical(state, f.attachedId).attachedTo, f.minionId);
    assert.deepEqual(enemyStats(state, physical(state, f.minionId)), {
      attack: 5,
      scheme: 3,
    });
  } else if (kind === "unit-reveal-retaliate") {
    if (!state.attachments.some((p) => p.id === f.attachmentId))
      state = await target(f.minionId);
    state = await finishChoices();
    assert.deepEqual(enemyStats(state, physical(state, f.minionId)), {
      attack: 4,
      scheme: 2,
    });
    state = await basic("attack");
    if (
      state.prompt?.options.some((o) =>
        matchesOption(state, o, (x) => x.id === f.minionId),
      )
    )
      state = await target(f.minionId);
    state = await finishChoices();
    assert.ok(
      state.minions.some((p) => p.id === f.minionId && p.damage === 6),
      "Original5HP MarkV survives damage6 through actual +2HP UnitUpgrade",
    );
    assert.equal(
      state.player.hp,
      13,
      "Native basic attack receives UnitUpgrade Retaliate1",
    );
  } else if (kind === "unit-boost") {
    await window("unit-upgrade-actual-boost-defense", width, f);
    state = await attackChoice("take", "Take the actual Master Mold attack");
    if (!state.attachments.some((p) => p.id === f.boostId))
      state = await target(f.minionId);
    state = await finishChoices();
    assert.equal(physical(state, f.boostId).attachedTo, f.minionId);
    assert.equal(
      state.player.hp,
      12,
      "UnitUpgrade printed star contributes zero numeric icons while the actual boost card attaches",
    );
  } else if (kind === "stun-beam-damage" || kind === "stun-beam-defender") {
    await window(`${kind}-actual-defense`, width, f);
    state = await attackChoice(
      kind === "stun-beam-defender" ? "hero:p2" : "take",
      "Choose the actual damaged defender",
    );
    state = await finishChoices();
    const id = kind === "stun-beam-defender" ? "p2" : "p1";
    assert.equal(seat(state, id).stunned, true);
    assert.equal(seat(state, id).hp, kind === "stun-beam-defender" ? 7 : 10);
    if (id === "p2")
      assert.equal(
        seat(state, "p1").stunned,
        false,
        "Stun Beam follows the actual replacement defender",
      );
  } else if (kind === "children-hero") {
    if (state.prompt?.title === "Master Mold's Children")
      state = await target(f.minionIds[0]);
    state = await finishChoices();
    assert.equal(
      state.player.hp,
      9,
      "Each actually engaged minion attacks once; no fallback villain attack",
    );
    assert.equal(state.villain.hp, 12);
  } else if (kind === "shields-up") {
    assert.ok(f.minionIds.every((id) => physical(state, id).tough));
    state = await attackChoice(
      "take",
      "Take the actual Master Mold attack after ShieldsUp",
    );
    state = await finishChoices();
    assert.equal(
      state.villain.tough,
      true,
      "Actual ShieldsUp boost gives the villain Tough",
    );
    assert.equal(state.player.hp, 12);
  } else if (kind === "intruder-defeater") {
    state = await basic("thwart");
    if (
      state.prompt?.options.some((o) =>
        matchesOption(state, o, (x) => x.id === f.schemeId),
      )
    )
      state = await target(f.schemeId);
    state = await finishChoices();
    assert.ok(state.encounter.discard.some((p) => p.id === f.schemeId));
    assert.ok(state.encounter.discard.some((p) => p.id === f.milledIds[0]));
    assert.ok(
      state.minions.some(
        (p) => p.id === f.milledIds[1] && p.engagedWith === "p2",
      ),
      "IntruderAlert mills for the actual defeating player",
    );
    assert.ok(
      !state.attachments.some((p) => p.code === "32107"),
      "Actual defeat puts MarkV without revealing its search",
    );
  } else if (kind === "virus-hinder") {
    state = await finishChoices();
    assert.equal(
      physical(state, f.schemeId).counters,
      4,
      "Fixed2 starting threat plus Hinder2 per hero",
    );
    assert.equal(
      state.sideSchemes.filter((p) => p.id === f.schemeId).length,
      1,
    );
  } else if (kind === "virus-victory") {
    state = await actualAbility(f.magnetoId, /Thwart/i);
    if (
      state.prompt?.options.some((o) =>
        matchesOption(state, o, (x) => x.id === f.schemeId),
      )
    )
      state = await target(f.schemeId);
    await defeatWindow(f.schemeId, "Insert Virus Program");
    state = await finishChoices();
    assert.ok(state.victoryDisplay.some((p) => p.id === f.schemeId));
    assert.ok(!state.encounter.discard.some((p) => p.id === f.schemeId));
    assert.equal(state.villain.hp, 10);
    assert.ok(state.encounter.discard.some((p) => p.id === f.minionIds[0]));
    assert.equal(physical(state, f.minionIds[1]).damage, 2);
    assert.equal(
      physical(state, f.magnetoId).damage,
      1,
      "Virus damage is unlabelled, does not attack and preserves ally consequential damage",
    );
  } else throw Error(`Unknown reviewed Master Mold browser flow ${kind}`);
  if (kind === "stage-two-loss") {
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
    assert.deepEqual(replayed.modules, ["zero_tolerance"]);
    await window("stage-two-loss-actual-replay", width, snapshot(replayed));
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
  if (!process.env.MASTER_MOLD_FIXTURE_ONLY)
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
