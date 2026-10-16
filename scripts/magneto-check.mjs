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

const output = process.env.MAGNETO_OUTPUT || "output/magneto/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const defaults = [
  "counter-errata",
  "counter-chain",
  "counter-exhaustion",
  "damage-cap",
  "bubble-cap",
  "boarding-progress",
  "sabotage-progress",
  "orbital-progress",
  "main-two",
  "main-three",
  "main-loss",
  "wrapped",
  "helmet",
  "armor",
  "seized",
  "mayhem",
  "m-type-boost",
  "villain-stage",
  "villain-win",
];
const scenarios = (process.env.MAGNETO_SCENARIOS || defaults.join(","))
  .split(",")
  .map((x) => x.trim())
  .filter(Boolean);
const widths = (process.env.MAGNETO_VIEWPORTS || "1440,1280,390,320")
  .split(",")
  .map(Number);
assert.ok(
  scenarios.length && scenarios.every((x) => defaults.includes(x)),
  "Reviewed native original-source cases",
);
assert.ok(widths.length && widths.every((x) => x >= 320));
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
    ["captain_america", "03001a", "Captain America", "leadership"],
  ].map(([id, code, name, aspect]) => {
    const source = catalog.find((d) => d.id === `starter-${code}`);
    assert.ok(source, `${name}: original published preconstructed list`);
    const codes = Object.entries(source.cards)
      .filter(([c]) => c !== "32031a")
      .flatMap(([c, n]) => Array(n).fill(c))
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
const encounterCodes = (set) =>
  definitions
    .filter(
      (c) =>
        c.set_code === set &&
        !c.hidden &&
        !["villain", "main_scheme"].includes(c.type_code),
    )
    .flatMap((c) => Array(c.quantity).fill(c.code))
    .sort();
assert.equal(encounterCodes("magneto_villain").length, 24);
assert.equal(
  definitions.filter((c) => c.set_code === "magneto_villain").length,
  26,
  "26 original supported source faces produce29 physical scenario cards at a chosen difficulty",
);
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources,enemyStats,schemeLimit} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card,imageFor} from './src/game/cards.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
export {imageFor,enemyStats,schemeLimit};
export const definition=p=>card(p);
export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};
export function fixture(kind){
 const team=['seized','mayhem'].includes(kind);
 const hero=(heroId,aspect)=>({heroId,aspect,deckCards:heroStarterCodes(heroId),deckOrigin:'source'});
 let s=newGame({heroId:'colossus',aspect:'protection',heroes:[hero('colossus','protection'),...(team?[hero('shadowcat','aggression')]:[])],villainId:'magneto',module:'acolytes',modules:['acolytes'],difficulty:'standard',seed:321380,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}return s;}
 for(let n=0;n<100&&(s.phase==='mulligan'||s.prompt);n++){
  if(s.prompt){const p=s.prompt;const option=p.options?.find(o=>o.image==='32006')||p.options?.find(o=>/^(pass|skip|none|done|continue|no)$/.test(o.id))||(p.options?.length===1&&p.options[0]);if(!option)throw Error('Unreviewed actual source setup '+JSON.stringify(p));command({type:'CHOOSE',id:option.id});}
  else command({type:'MULLIGAN',ids:[]});
 }
 if(s.phase!=='player'||s.prompt||s.review||!s.magneto)throw Error('Actual Magneto source setup incomplete');
 for(const info of s.players){const p=seatView(s,info).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=info.heroId==='colossus'?14:9;p.exhausted=false;p.flipped=false;p.tough=false;p.toughCards=0;p.stunned=false;p.stunCards=0;p.confused=false;p.confuseCards=0;}
 s.encounter.deck.push(...s.encounter.dealt.splice(0).map(p=>{delete p.dealtTo;return p;}));
 activateSeat(s,'p1');s.turnPlayerId='p1';s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;s.villain.tough=false;s.villain.toughCards=0;s.magneto.magnetCounters=0;
 const m=s.magneto;
 function player(id='p1'){return seatView(s,id).player;}
 function take(code,id='p1'){const p=player(id);for(const z of[p.hand,p.deck,p.discard,p.inPlay]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing original player '+id+':'+code);}
 function hand(codes,id='p1'){const ps=codes.map(c=>take(c,id));player(id).hand.push(...ps);return ps;}
 function encounter(code){for(const z of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing original encounter '+code);}
 function order(codes){const ps=codes.map(encounter);s.encounter.deck.unshift(...ps);return ps;}
 function reveal(code){const p=encounter(code);s.resolving.push(p);return {type:'reveal',piece:p,skip:true,actorId:s.activePlayerId};}
 function native(effects){s.prompt={kind:'choice',title:'Original-source Magneto fixture',text:'Resolve the actual printed original encounter.',options:[{id:'go',label:'Resolve original encounter',effects}]};}
 function attach(code,target=s.villain.id){const p=encounter(code);p.attachedTo=target;s.attachments.push(p);return p;}
 function board(){return s.sideSchemes.find(p=>p.code==='32144a'||p.code==='32144b');}
 function completeBoard(){const p=board();s.sideSchemes=s.sideSchemes.filter(q=>q.id!==p.id);p.code='32144b';s.victoryDisplay.push(p);return p;}
 function orbital(){const p=m.orbital;if(!p)throw Error('Original set-aside Orbital Decay missing');delete m.orbital;return p;}
 function main(code){const p=m.mainDeck.find(p=>p.code.slice(0,-1)===code.slice(0,-1));if(!p)throw Error('Original hidden main missing '+code);m.mainDeck=m.mainDeck.filter(q=>q.id!==p.id);s.victoryDisplay.push(m.currentMain);p.code=code;m.currentMain=p;m.mainCode=code;s.scheme.code=code;s.scheme.index=code==='32142b'?1:2;s.scheme.threat=0;return p;}
 let ids={initialHp:s.villain.hp,boardId:board().id,orbitalId:m.orbital.id};
 if(kind==='counter-errata'||kind==='counter-chain'){
  m.magnetCounters=2;const effect=reveal('32153');ids.triggerId=effect.piece.id;ids.foundId=order([kind==='counter-errata'?'32152':'32153'])[0].id;native([effect]);
 }else if(kind==='counter-exhaustion'){m.magnetCounters=2;const p=encounter('32146');ids.boundaryId=p.id;s.encounter.discard.push(...s.encounter.deck.splice(0));s.encounter.deck.push(p);ids.accelerationBefore=s.encounter.acceleration||0;native([{type:'magneto:place-counters',amount:1,actorId:'p1'}]);
 }else if(kind==='damage-cap')native([{type:'damage',target:s.villain.id,amount:3,source:'hero',actorId:'p1'},{type:'damage',target:s.villain.id,amount:99,source:'hero',actorId:'p1'}]);
 else if(kind==='bubble-cap'){const p=attach('32149');p.damage=0;s.villain.hp-=5;ids.initialHp=s.villain.hp;ids.bubbleId=p.id;native([{type:'damage',target:s.villain.id,amount:99,source:'hero',actorId:'p1'}]);}
 else if(kind==='boarding-progress'){const p=board();p.counters=1;native([{type:'thwart',target:p.id,amount:1,source:'hero',actorId:'p1'}]);}
 else if(kind==='sabotage-progress'){const p=board();p.code='32144b';p.counters=1;native([{type:'thwart',target:p.id,amount:1,source:'hero',actorId:'p1'}]);}
 else if(kind==='orbital-progress'){completeBoard();const p=orbital();p.counters=1;s.sideSchemes.push(p);native([{type:'thwart',target:p.id,amount:1,source:'hero',actorId:'p1'}]);}
 else if(kind==='main-two'){native([{type:'threat',target:'main',amount:5,skip:true}]);}
 else if(kind==='main-three'){main('32142b');native([{type:'threat',target:'main',amount:6,skip:true}]);}
 else if(kind==='main-loss'){main('32142b');main('32143b');native([{type:'threat',target:'main',amount:7,skip:true}]);}
 else if(kind==='wrapped'){ids.paymentIds=hand(['32014']).map(p=>p.id);const e=reveal('32150');ids.attachmentId=e.piece.id;native([e]);}
 else if(kind==='helmet'||kind==='armor'){ids.attachmentId=attach(kind==='helmet'?'32147':'32148').id;ids.paymentIds=hand(['32013','32014','32015']).map(p=>p.id);}
 else if(kind==='seized'){activateSeat(s,'p2');s.turnPlayerId='p2';const e=reveal('32158');ids.schemeId=e.piece.id;ids.storedIds=s.players.flatMap(info=>seatView(s,info).player.deck.slice(0,6).map(p=>p.id));ids.boostId=order(['01186'])[0].id;native([e,{type:'thwart',target:e.piece.id,amount:5,source:'hero',actorId:'p2'}]);}
 else if(kind==='mayhem'){activateSeat(s,'p2');s.turnPlayerId='p2';const p=encounter('32156');p.counters=1;s.sideSchemes.push(p);ids.schemeId=p.id;ids.milledIds=order(['32147','32151','32148','32146']).map(p=>p.id);}
 else if(kind==='villain-stage'||kind==='villain-win'){completeBoard();const p=orbital();p.code='32145b';p.attachedTo=s.villain.id;s.attachments.push(p);s.villain.hp=1;ids.futureVillainId=m.villainDeck[0].id;const effects=[{type:'damage',target:'villain',amount:1,source:'hero',actorId:'p1'}];if(kind==='villain-win')effects.push({type:'damage',target:'villain',amount:1,source:'hero',actorId:'p1'},{type:'damage',target:'villain',amount:99,source:'hero',actorId:'p1'});native(effects);}
 else if(kind==='m-type-boost'){const ps=order(['32146','32156']);ids.boostId=ps[0].id;ids.followingBoostId=ps[1].id;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}
 else throw Error('Unknown reviewed Magneto fixture '+kind);
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
const { fixture, definition, imageFor, payment, enemyStats, schemeLimit } =
  await import(pathToFileURL(fixturePath).href);
function seat(s, id) {
  return s.activePlayerId === id
    ? s.player
    : s.players.find((p) => p.id === id).player;
}
function allPieces(s) {
  const nested = (p) => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return [
    s.villain,
    ...(s.magneto?.currentMain ? [s.magneto.currentMain] : []),
    ...(s.magneto?.mainDeck || []),
    ...(s.magneto?.villainDeck || []),
    ...(s.magneto?.orbital ? [s.magneto.orbital] : []),
    ...s.players.flatMap((info) => {
      const p = seat(s, info.id);
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.resolving,
    ...s.removed,
    ...(s.victoryDisplay || []),
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
const splayers = (s) => s.players.map((p) => seat(s, p.id));
const physical = (s, id) => allPieces(s).find((p) => p.id === id);
function faceFamily(code) {
  if (/^3214[1-5][ab]$/.test(code) || /^32031[ab]$/.test(code))
    return [code.slice(0, -1) + "a", code.slice(0, -1) + "b"];
  return [code];
}
function snapshot(s) {
  const pieces = allPieces(s);
  return {
    sources: s.players.map((info) => ({
      seatId: info.id,
      heroId: info.heroId,
      cards: pieces
        .filter(
          (p) =>
            p.ownerId === info.id &&
            definition(p).faction_code !== "encounter" &&
            p.code !== "32031a" &&
            p.code !== "32031b",
        )
        .map(({ id, code }) => ({ id, code })),
      codes: sources[info.heroId].codes,
    })),
    originals: pieces.map(({ id, code, ownerId }) => ({
      id,
      codes: faceFamily(code),
      ownerId,
    })),
    modules: s.modules || [s.module],
    difficulty: s.difficulty,
  };
}
function conserved(s, f, label) {
  const pieces = allPieces(s);
  assert.equal(
    new Set(pieces.map((p) => p.id)).size,
    pieces.length,
    `${label}: no duplicated original physical pieces`,
  );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    f.originals.map((p) => p.id).sort(),
    `${label}: every original occupies exactly one physical zone`,
  );
  for (const o of f.originals) {
    const p = pieces.find((p) => p.id === o.id);
    assert.ok(
      o.codes.includes(p.code),
      `${label}: same original or reversible face ${o.id}`,
    );
    assert.equal(p.ownerId, o.ownerId, `${label}: original ownership ${o.id}`);
  }
  for (const source of f.sources) {
    assert.equal(source.cards.length, 40);
    assert.deepEqual(
      source.cards.map((p) => p.code).sort(),
      source.codes,
      `${label}: published source40 ${source.seatId}`,
    );
    assert.deepEqual(
      pieces
        .filter((p) => source.cards.some((q) => q.id === p.id))
        .map((p) => p.id)
        .sort(),
      source.cards.map((p) => p.id).sort(),
      `${label}: exact original source40 IDs`,
    );
  }
  const scenario = pieces.filter(
    (p) => definition(p).set_code === "magneto_villain",
  );
  assert.equal(
    scenario.length,
    29,
    `${label}: actual29 physical scenario cards`,
  );
  assert.equal(
    scenario.filter((p) => definition(p).type_code === "villain").length,
    2,
    `${label}: actual two difficulty stages`,
  );
  assert.deepEqual(
    scenario
      .filter(
        (p) => !["villain", "main_scheme"].includes(definition(p).type_code),
      )
      .map((p) => faceFamily(p.code)[0])
      .sort(),
    encounterCodes("magneto_villain")
      .map((code) => faceFamily(code)[0])
      .sort(),
    `${label}: exact24 original encounter cards including both reversible physicals`,
  );
  assert.deepEqual(
    scenario
      .filter((p) => definition(p).type_code === "villain")
      .map((p) => p.code)
      .sort(),
    f.difficulty === "expert" ? ["32139", "32140"] : ["32138", "32139"],
    `${label}: original difficulty stage composition`,
  );
  for (const root of ["32141", "32142", "32143", "32144", "32145"])
    assert.equal(
      scenario.filter((p) => p.code.startsWith(root)).length,
      1,
      `${label}: one actual reversible ${root}`,
    );
  for (const set of [
    ...f.modules,
    "standard",
    ...(f.difficulty === "expert" ? ["expert"] : []),
  ])
    assert.deepEqual(
      pieces
        .filter((p) => definition(p).set_code === set)
        .map((p) => p.code)
        .sort(),
      encounterCodes(set),
      `${label}: original ${set} composition`,
    );
  assert.equal(
    s.villain.maxHp,
    definition(s.villain).health * s.playerCount,
    `${label}: printed current villain HP`,
  );
  assert.equal(
    s.magneto.currentMain.code,
    s.scheme.code,
    `${label}: main view follows physical face`,
  );
}
if (process.env.MAGNETO_FIXTURE_CHECK) {
  const prepared = scenarios.map((kind) => {
    const f = fixture(kind),
      inventory = snapshot(f.state);
    conserved(f.state, inventory, kind);
    return {
      kind,
      sourceCards: inventory.sources.length * 40,
      scenarioPieces: 29,
      originalPieces: inventory.originals.length,
    };
  });
  await writeFile(
    `${output}/fixture-preparation-report.json`,
    JSON.stringify(
      { preparationOnly: true, productionBrowserVerified: false, prepared },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify({ preparationOnly: true, fixtures: prepared.length }),
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
  if (process.env.MAGNETO_CORE_SHA256)
    assert.equal(proof[2].sha256, process.env.MAGNETO_CORE_SHA256);
  if (process.env.MAGNETO_ASSET)
    assert.equal(basename(new URL(js[0]).pathname), process.env.MAGNETO_ASSET);
  if (process.env.MAGNETO_SHA256)
    assert.equal(proof[0].sha256, process.env.MAGNETO_SHA256);
  if (process.env.MAGNETO_CSS_SHA256)
    assert.equal(proof[1].sha256, process.env.MAGNETO_CSS_SHA256);
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
const targetHost = new URL(url).hostname;
const inheritedProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const remote = !["localhost", "127.0.0.1", "::1"].includes(targetHost);
const browser = await chromium.launch({
  headless: true,
  ...(remote && inheritedProxy ? { proxy: { server: inheritedProxy } } : {}),
});
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const errors = [],
  checks = [],
  audits = [],
  layouts = [],
  sourceAudits = [];
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
    if (sessionStorage.getItem("magneto-fixture-loaded")) return;
    sessionStorage.setItem("magneto-fixture-loaded", "yes");
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
  if (process.env.MAGNETO_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.MAGNETO_ASSET),
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
  if (f) {
    conserved(state, f, name);
    sourceAudits.push({
      name,
      width,
      originalPieces: f.originals.length,
      sourceCards: 40 * f.sources.length,
    });
  }
  if (state?.villainId === "magneto") {
    assert.equal(
      await page
        .locator(`.villain-card img[src="${imageFor(state.villain.code)}"]`)
        .count(),
      1,
      "Original current Magneto artwork",
    );
    assert.equal(
      await page
        .locator(`.scheme-card img[src="${imageFor(state.scheme.code)}"]`)
        .count(),
      1,
      "Original current main scheme artwork",
    );
    assert.equal(
      await page
        .getByLabel(`Magnet counters: ${state.magneto.magnetCounters}`, {
          exact: true,
        })
        .count(),
      1,
      "Actual saved Magnet counter is visible",
    );
    const limits = { "32144a": 6, "32144b": 12, "32145a": 18 };
    const caps = state.sideSchemes
      .filter((p) => limits[p.code])
      .map((p) => limits[p.code] * state.playerCount);
    if (caps.length)
      assert.equal(
        await page
          .getByLabel(`Magneto damage limit: ${Math.min(...caps)}`, {
            exact: true,
          })
          .count(),
        1,
        "Printed sustained damage cap is visible",
      );
    for (const p of state.attachments.filter((p) => p.code === "32149"))
      assert.equal(
        await page
          .getByLabel(`Magnetic Bubble damage: ${p.damage} of 8`, {
            exact: true,
          })
          .count(),
        1,
        "Actual Bubble damage is visible",
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
  assert.equal(await row.count(), 1);
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
  if (index === 0) await checkpoint(`${current.kind}-source-deck`, width);
  await page.keyboard.press("Escape");
}
async function publicSource(count, difficulty, width, module = "acolytes") {
  const kind = `public-${count}-${difficulty.toLowerCase()}-${module}`;
  current = { kind, count, difficulty, width, module };
  await open(null, width);
  await page
    .getByRole("button", {
      name: `${count} ${count === 1 ? "hero" : "heroes"}`,
      exact: true,
    })
    .click();
  for (const [index, id] of ["colossus", "shadowcat", "captain_america"]
    .slice(0, count)
    .entries())
    await chooseSource(id, index, width);
  await page
    .locator(".villain-tabs")
    .getByRole("button", { name: "Magneto", exact: true })
    .click();
  const modular = page.getByRole("combobox", {
    name: "Modular encounter",
    exact: true,
  });
  assert.equal(
    await modular.inputValue(),
    "acolytes",
    "Printed recommended Acolytes remains replaceable",
  );
  await modular.selectOption(module);
  const line = page
    .locator(".setting-line")
    .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) });
  await line.getByRole("button", { name: difficulty, exact: true }).click();
  await page.locator("#mission-seed").fill("321380");
  await page.locator("#start-btn").click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("champions.save.v1"))?.villainId ===
      "magneto",
  );
  await settle();
  let state = await save();
  assert.equal(state.phase, "mulligan");
  assert.equal(state.playerCount, count);
  assert.equal(state.difficulty, difficulty.toLowerCase());
  assert.deepEqual(state.modules, [module]);
  assert.equal(
    state.villain.code,
    difficulty === "Standard" ? "32138" : "32139",
  );
  assert.equal(state.villain.hp, definition(state.villain).health * count);
  assert.equal(state.villain.tough, true);
  assert.equal(state.scheme.code, "32141b");
  assert.equal(state.scheme.threat, count);
  assert.equal(state.magneto.mainDeck.length, 2);
  assert.equal(state.magneto.villainDeck.length, 1);
  assert.equal(state.magneto.orbital.code, "32145a");
  assert.equal(state.magneto.magnetCounters, 0);
  assert.equal(state.sideSchemes.filter((p) => p.code === "32144a").length, 1);
  assert.equal(
    state.encounter.dealt.length,
    difficulty === "Expert" ? count : 0,
  );
  const f = snapshot(state);
  conserved(state, f, "actual public original mulligan");
  await window(`${kind}-mulligan`, width, f);
  for (let n = 0; n < 80; n++) {
    state = await save();
    if (state.phase === "player" && !state.prompt) break;
    if (state.prompt) {
      assert.equal(state.prompt.kind, "choice");
      const option =
        state.prompt.options.find((o) => o.image === "32006") ||
        passOption(state) ||
        (state.prompt.options.length === 1 && state.prompt.options[0]);
      assert.ok(
        option,
        "Reviewed original hero setup " + JSON.stringify(state.prompt),
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
  conserved(state, f, "actual completed original source setup");
  if (module === "bomb_scare")
    assert.equal(
      allPieces(state).filter((p) => definition(p).set_code === "acolytes")
        .length,
      0,
      "Replacing recommended module removes every Acolytes source piece",
    );
  await window(`${kind}-ready`, width, f);
  checks.push({
    ...current,
    sourceCards: 40 * count,
    scenarioPieces: 29,
    selectedModularPieces: encounterCodes(module).length,
    originalPieces: f.originals.length,
    exactReload: true,
  });
}
async function finishNative() {
  for (let n = 0; n < 160; n++) {
    const state = await save();
    assert.ok(!state.error, state.error);
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const p = state.prompt;
    const option =
      passOption(state) ||
      p.options.find((o) => o.id === "take-damage") ||
      (/indirect/i.test(p.text)
        ? p.options.find((o) => /^hero(?::|$)/.test(o.id))
        : null) ||
      (p.options.length === 1 ? p.options[0] : null) ||
      (/each player|order|search|Factory Online|Rule of Magnus|Magnetic|M-Type Sentinel|Seized/i.test(
        p.title,
      )
        ? p.options[0]
        : null);
    assert.ok(
      option,
      "Unreviewed mandatory original-source window " + JSON.stringify(p),
    );
    await choice(option.id);
  }
  throw Error("Native source windows did not settle");
}
async function maybeTarget(id) {
  const s = await save();
  if (s.prompt?.options.some((o) => matchesOption(s, o, (x) => x.id === id)))
    return target(id);
  return s;
}
async function runCase(kind, width) {
  current = { kind, width };
  const native = fixture(kind),
    f = { ...native, ...snapshot(native.state) };
  await open(f, width);
  await window(`${kind}-initial`, width, f);
  let state = await save();
  if (state.prompt?.options.some((o) => o.id === "go"))
    state = await choice("go");
  if (kind === "wrapped") {
    state = await finishNative();
    assert.equal(physical(state, f.attachmentId).attachedTo, "hero:p1");
    assert.equal(
      await page.locator(".attack-action").isDisabled(),
      true,
      "Wrapped forbids native attack",
    );
    assert.equal(
      await page.locator(".thwart-action").isDisabled(),
      true,
      "Wrapped forbids native thwart",
    );
    await window(`${kind}-restricted`, width, f);
    const host = page
      .locator(".attached-piece")
      .filter({ has: page.locator(`img[src="${imageFor("32150")}"]`) });
    assert.equal(await host.count(), 1);
    await host
      .locator("button")
      .filter({ hasText: /exhaust identity/ })
      .click();
    await settle();
    assert.equal((await save()).prompt?.kind, "payment");
    await window(`${kind}-actual-payment`, width, f);
    await pay(f.paymentIds);
    state = await finishNative();
    assert.ok(state.encounter.discard.some((p) => p.id === f.attachmentId));
    assert.equal(state.player.exhausted, true);
    assert.ok(
      f.paymentIds.every((id) => state.player.discard.some((p) => p.id === id)),
    );
  } else if (kind === "helmet" || kind === "armor") {
    const targetId = state.villain.id;
    await basic("attack");
    await maybeTarget(targetId);
    await select(
      (o) => o.id.startsWith("magneto-response:"),
      `Actual ${kind} response after native hero basic attack`,
    );
    assert.equal((await save()).prompt?.kind, "payment");
    await window(`${kind}-actual-typed-payment`, width, f);
    await pay(f.paymentIds);
    state = await finishNative();
    assert.ok(state.encounter.discard.some((p) => p.id === f.attachmentId));
    assert.ok(
      f.paymentIds.every((id) => state.player.discard.some((p) => p.id === id)),
    );
    assert.equal(state.player.exhausted, true);
    assert.equal(state.villain.hp, f.initialHp - 2);
  } else if (kind === "seized") {
    state = await finishNative();
    let held = state.sideSchemes.find((p) => p.id === f.schemeId);
    assert.ok(held);
    assert.equal(held.storedCards.length, 12);
    assert.deepEqual(
      held.storedCards.map((p) => p.id).sort(),
      f.storedIds.slice().sort(),
    );
    await window(`${kind}-originals-stored`, width, f);
    await basic("thwart");
    state = await target(f.schemeId);
    assert.match(
      state.prompt?.title || "",
      /Magneto/i,
      "Actual Seized activation opens a native defense window",
    );
    assert.deepEqual(
      physical(state, f.schemeId)
        .storedCards.map((p) => p.id)
        .sort(),
      f.storedIds.slice().sort(),
      "Seized keeps the same original12 player cards beneath it until activation finishes",
    );
    assert.ok(
      f.storedIds.every(
        (id) =>
          !splayers(state).some((p) => p.discard.some((q) => q.id === id)),
      ),
      "Stored cards do not enter owner discards before the Seized activation",
    );
    await window(`${kind}-activation-before-discard`, width, f);
    state = await finishNative();
    assert.ok(state.encounter.discard.some((p) => p.id === f.schemeId));
    assert.ok(
      f.storedIds.every((id) =>
        splayers(state).some((p) => p.discard.some((q) => q.id === id)),
      ),
    );
    assert.equal(
      seat(state, "p1").hp,
      14,
      "Seized activation preserves other seat",
    );
    assert.ok(
      seat(state, "p2").hp < 9,
      "Seized activation targets actual defeating Shadowcat seat",
    );
  } else if (kind === "mayhem") {
    await basic("thwart");
    await target(f.schemeId);
    state = await finishNative();
    assert.equal(state.magneto.magnetCounters, 2);
    assert.ok(
      f.milledIds.every((id) =>
        state.encounter.discard.some((p) => p.id === id),
      ),
    );
    assert.ok(state.encounter.discard.some((p) => p.id === f.schemeId));
    assert.equal(state.activePlayerId, "p2");
    assert.equal(state.player.exhausted, true);
  } else {
    state = await finishNative();
    if (kind === "counter-errata") {
      assert.equal(state.magneto.magnetCounters, 0);
      assert.equal(
        seat(state, "p1").hp,
        14,
        "RRG1.8 removes3 before Electric Shock reads magnet counters",
      );
      assert.equal(
        seat(state, "p1").stunCards,
        1,
        "Actual Colossus Steady needs two status cards",
      );
      assert.ok(state.encounter.discard.some((p) => p.id === f.foundId));
    }
    if (kind === "counter-chain") {
      assert.equal(
        state.magneto.magnetCounters,
        1,
        "Nested original Magnetic adds1 after errata removes3",
      );
      assert.ok(state.encounter.discard.some((p) => p.id === f.foundId));
    }
    if (kind === "counter-exhaustion") {
      assert.equal(
        state.magneto.magnetCounters,
        0,
        "Counter errata still removes3 when finite Magnetic search fails",
      );
      assert.equal(
        state.encounter.dealt.length,
        0,
        "Encounter deck exhaustion does not fabricate a dealt encounter",
      );
      assert.equal(
        state.attachments.length,
        0,
        "Finite search never reveals a Magnetic card from the fresh shuffled deck",
      );
      assert.equal(seat(state, "p1").hp, 14);
      assert.equal(seat(state, "p1").stunCards, 0);
      assert.equal(state.sideSchemes.length, 1);
      assert.equal(
        state.encounter.acceleration,
        f.accelerationBefore + 1,
        "Native encounter-deck exhaustion adds its acceleration token",
      );
    }
    if (kind === "damage-cap")
      assert.equal(
        state.villain.hp,
        f.initialHp - 6,
        "All incoming source events share Boarding Party sustained damage limit",
      );
    if (kind === "bubble-cap") {
      assert.equal(state.villain.hp, f.initialHp);
      assert.equal(
        state.attachments.find((p) => p.id === f.bubbleId)?.damage,
        1,
        "Cap is applied before Bubble replaces remaining1, without overflow",
      );
    }
    if (kind === "boarding-progress") {
      assert.equal(
        state.sideSchemes.find((p) => p.id === f.boardId)?.code,
        "32144b",
      );
      assert.equal(state.magneto.orbital.id, f.orbitalId);
    }
    if (kind === "sabotage-progress") {
      assert.equal(
        state.victoryDisplay.find((p) => p.id === f.boardId)?.code,
        "32144b",
      );
      assert.equal(
        state.sideSchemes.find((p) => p.id === f.orbitalId)?.code,
        "32145a",
      );
      assert.equal(state.magneto.orbital, undefined);
    }
    if (kind === "orbital-progress") {
      assert.equal(
        state.attachments.find((p) => p.id === f.orbitalId)?.code,
        "32145b",
      );
      assert.equal(
        state.attachments.find((p) => p.id === f.orbitalId)?.attachedTo,
        state.villain.id,
      );
    }
    if (kind === "main-two") {
      assert.equal(state.scheme.code, "32142b");
      assert.equal(state.magneto.magnetCounters, 1);
      assert.ok(state.minions.some((p) => p.code === "32146"));
    }
    if (kind === "main-three") {
      assert.equal(state.scheme.code, "32143b");
      assert.equal(state.magneto.magnetCounters, 2);
      assert.ok(
        state.attachments.some((p) =>
          ["32147", "32148", "32149", "32150"].includes(p.code),
        ),
      );
    }
    if (kind === "main-loss") assert.equal(state.phase, "lost");
    if (kind === "villain-stage") {
      assert.equal(state.villain.id, f.futureVillainId);
      assert.equal(state.villain.code, "32139");
      assert.equal(state.villain.hp, 20);
      assert.equal(state.villain.tough, true);
      assert.equal(state.encounter.dealt.length, 1);
    }
    if (kind === "villain-win") assert.equal(state.phase, "won");
    if (kind === "m-type-boost") {
      assert.equal(state.villain.tough, true);
      assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
      assert.ok(
        state.encounter.discard.some((p) => p.id === f.followingBoostId),
        "M-Type deals its additional original facedown card into the current Magneto activation",
      );
      assert.equal(
        (state.encounter.storedBoosts || []).length,
        0,
        "Current Magneto boost is resolved before attack cleanup",
      );
      assert.equal(
        seat(state, "p1").hp,
        8,
        "Magneto printed2 plus original Magnetic Mayhem4 boost deals6 in this current attack",
      );
      assert.equal(
        state.magneto.magnetCounters,
        1,
        "Each completed Magneto attack adds one source counter",
      );
    }
  }
  if (["lost", "won"].includes(state.phase))
    await checkpoint(`${kind}-result`, width, f);
  else await window(`${kind}-result`, width, f);
  checks.push({
    kind,
    width,
    sourceCards: 40 * f.sources.length,
    scenarioPieces: 29,
    originalPieces: f.originals.length,
    exactReload: true,
  });
}
try {
  if (!process.env.MAGNETO_FIXTURE_ONLY)
    for (const width of widths)
      for (const count of [1, 2, 3])
        for (const difficulty of ["Standard", "Expert"])
          await publicSource(count, difficulty, width);
  for (const kind of scenarios)
    for (const width of widths) await runCase(kind, width);
  if (!process.env.MAGNETO_FIXTURE_ONLY)
    for (const width of widths)
      await publicSource(1, "Standard", width, "bomb_scare");
  const finalProof = await assetProof("after", initialProof);
  assert.deepEqual(errors, [], "No actual browser runtime/API errors");
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        baseUrl: url,
        checks,
        audits,
        layouts,
        sourceAudits,
        errors,
        productionBrowserVerified: true,
        originalPlayerSources: sources,
        physicalScenarioPieces: 29,
        supportedScenarioFaces: 26,
        assetProof: finalProof,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    JSON.stringify(
      {
        checks: checks.length,
        audits: audits.length,
        layouts: layouts.length,
        sourceAudits: sourceAudits.length,
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
        sourceAudits,
        errors,
        assetProof: initialProof,
        entryAssets: [...entryAssets],
        styleAssets: [...styleAssets],
      },
      null,
      2,
    ) + "\n",
  );
  if (page) {
    await page
      .screenshot({ path: `${output}/failure.png`, fullPage: true })
      .catch(() => {});
    await save()
      .then((s) =>
        writeFile(`${output}/failure-save.json`, JSON.stringify(s, null, 2)),
      )
      .catch(() => {});
    await page
      .locator("body")
      .innerText()
      .then((s) => writeFile(`${output}/failure-body.txt`, s))
      .catch(() => {});
  }
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
