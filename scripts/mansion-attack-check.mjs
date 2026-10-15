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
  process.env.MANSION_ATTACK_OUTPUT || "output/mansion-attack/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";

const defaults = [
  "atrium-steady",
  "cafeteria-retaliate",
  "basketball-toughness",
  "courtyard-attack",
  "room-transition",
  "room-loss-replay",
  "avalanche-attack",
  "blob-attack",
  "pyro-attack",
  "toad-attack",
  "next-villain",
  "collision-hero",
  "collision-alter",
  "victory-standard",
  "victory-expert",
  "brotherhood-beatdown",
  "activation-targets",
  "activation-boost",
  "protect-students",
  "under-siege",
  "mystique-copy",
  "replacement-module",
];
const scenarios = (process.env.MANSION_ATTACK_SCENARIOS || defaults.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const widths = (process.env.MANSION_ATTACK_VIEWPORTS || "1440,1280,390,320")
  .split(",")
  .map(Number);
assert.ok(
  scenarios.length && scenarios.every((kind) => defaults.includes(kind)),
  "Only reviewed native browser cases",
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
    const source = catalog.find((d) => d.id === `starter-${code}`);
    assert.ok(source, `${name}: published original preconstructed source`);
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
const originalEncounterCodes = Object.fromEntries(
  [
    "mansion_attack",
    "brotherhood",
    "mystique",
    "bomb_scare",
    "standard",
    "expert",
  ].map((set) => [
    set,
    definitions
      .filter(
        (c) =>
          c.set_code === set &&
          !c.hidden &&
          !c.back_link &&
          !["villain", "main_scheme", "environment"].includes(c.type_code),
      )
      .flatMap((c) => Array(c.quantity).fill(c.code))
      .sort(),
  ]),
);
assert.equal(originalEncounterCodes.mansion_attack.length, 15);
assert.equal(originalEncounterCodes.brotherhood.length, 8);
assert.equal(originalEncounterCodes.mystique.length, 5);
const bossBases = ["32121", "32122", "32123", "32124"];
const mainBases = ["32125", "32126", "32127", "32128", "32129"];

// Focused positions move only original pieces from a completed published-source
// native setup. All player actions, payments and encounter reveals use the host.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources,enemyStats,schemeLimit,targets} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card,imageFor,heroStats,pieceHP} from './src/game/cards.ts';
import {isTextBlank} from './src/game/card-text.ts';
import {mansionAttackModifiers} from './src/game/mansion-attack.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
export {imageFor,enemyStats,schemeLimit,heroStats,pieceHP,isTextBlank};
export const definition=p=>card(p);
export const sourceCodes=id=>heroStarterCodes(id).filter(code=>code!=='32031a').sort();
export const enemyAttackTargets=s=>targets(s,'enemy',true);
export const roomModifiers=(s,p)=>mansionAttackModifiers(s,p,{isTextBlank});
export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};
export function fixture(kind){
 const team=['collision-hero','collision-alter'].includes(kind),expert=kind==='victory-expert',module=kind==='replacement-module'?'bomb_scare':'mystique';
 const hero=id=>({heroId:id,aspect:id==='colossus'?'protection':'aggression',deckCards:heroStarterCodes(id),deckOrigin:'source'});
 const heroes=[hero('colossus'),...(team?[hero('shadowcat')]:[])];
 let s=newGame({heroId:'colossus',aspect:'protection',heroes,villainId:'mansion_attack',module,modules:[module],difficulty:expert?'expert':'standard',seed:3212130,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}return s;}
 for(let n=0;n<100&&(s.phase==='mulligan'||s.prompt);n++){
  if(s.prompt){const source=s.prompt.options?.find(o=>o.image==='32006');const pass=s.prompt.options?.find(o=>/^(pass|skip|none|done|continue|no)$/.test(o.id));const only=s.prompt.options?.length===1?s.prompt.options[0]:null;const option=source||pass||only;if(!option)throw Error('Unreviewed original Mansion setup '+JSON.stringify(s.prompt));command({type:'CHOOSE',id:option.id});}
  else command({type:'MULLIGAN',ids:[]});
 }
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native original Mansion setup incomplete');
 s.encounter.deck.push(...s.encounter.dealt.splice(0).map(p=>{delete p.dealtTo;return p;}));
 for(const info of s.players){const p=seatView(s,info).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=info.heroId==='colossus'?14:9;p.exhausted=false;p.flipped=false;p.tough=false;p.toughCards=0;p.stunned=false;p.stunCards=0;p.confused=false;p.confuseCards=0;}
 activateSeat(s,'p1');s.turnPlayerId='p1';s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 const m=s.mansionAttack;
 function player(id='p1'){return seatView(s,id).player;}
 function take(code,id='p1'){const p=player(id);for(const z of[p.hand,p.deck,p.discard,p.inPlay]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing original player '+id+':'+code);}
 function hand(codes,id='p1'){const ps=codes.map(c=>take(c,id));player(id).hand.push(...ps);return ps;}
 function put(code,id='p1'){const p=take(code,id);p.exhausted=false;player(id).inPlay.push(p);return p;}
 function encounter(code){for(const z of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing original encounter '+code);}
 function minion(code,id='p1'){const p=encounter(code);p.engagedWith=id;p.damage=0;p.tough=false;p.toughCards=0;s.minions.push(p);return p;}
 function order(codes){const ps=codes.map(encounter);s.encounter.deck.unshift(...ps);return ps;}
 function playerTop(codes,id='p1'){const ps=codes.map(c=>take(c,id));player(id).deck.unshift(...ps);return ps;}
 function boss(code){if(s.villain.code!==code){const i=m.villainDeck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing original boss '+code);const p=m.villainDeck.splice(i,1)[0];m.villainDeck.push(s.villain);s.villain=p;}s.villain.hp=s.villain.maxHp=card(s.villain).health*s.playerCount;s.villain.stage=expert?2:1;s.villain.tough=false;s.villain.toughCards=0;return s.villain;}
 function room(code){if(m.currentMain.code!==code){const i=m.mainDeck.findIndex(p=>p.code.slice(0,-1)===code.slice(0,-1));if(i<0)throw Error('Missing original room '+code);const p=m.mainDeck.splice(i,1)[0];m.currentMain.code=m.currentMain.code.slice(0,-1)+'a';m.mainDeck.push(m.currentMain);p.code=code;m.currentMain=p;s.scheme.code=code;}s.scheme.threat=0;return m.currentMain;}
 function nextBoss(code){const i=m.villainDeck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing original next boss '+code);m.villainDeck.unshift(...m.villainDeck.splice(i,1));return m.villainDeck[0];}
 function nextRoom(code){const i=m.mainDeck.findIndex(p=>p.code.slice(0,-1)===code.slice(0,-1));if(i<0)throw Error('Missing original next room '+code);m.mainDeck.unshift(...m.mainDeck.splice(i,1));return m.mainDeck[0];}
 function native(effects){s.prompt={kind:'choice',title:'Original-source printed-rules fixture',text:'Resolve the actual original physical encounter card.',options:[{id:'go',label:'Resolve original encounter',effects}]};}
 function reveals(codes){return codes.map(code=>{const p=encounter(code);s.resolving.push(p);return {type:'reveal',piece:p,skip:true};});}
 let ids={};
 boss('32121'+(expert?'b':'a'));room('32128b');
 if(kind==='atrium-steady'){
  room('32126b');player().form='alter';s.villain.tough=true;s.villain.toughCards=1;
  const ps=hand(['32009','32008','32008','32024','32022']);ids.paymentIds=ps.slice(3).map(p=>p.id);
 }else if(kind==='cafeteria-retaliate'){
  room('32127b');ids.allyId=put('32002').id;ids.minionId=minion('32075').id;const ps=hand(['32015','32013']);ids.paymentIds=[ps[1].id];order(['01186']);
 }else if(kind==='basketball-toughness'){
  ids.existingId=put('32011').id;const ps=hand(['32002','32023','32013']);ids.allyId=ps[0].id;ids.paymentIds=ps.slice(1).map(p=>p.id);
  const effects=reveals(['32075']);ids.minionId=effects[0].piece.id;native(effects);
 }else if(kind==='courtyard-attack'){
  room('32129b');ids.allyId=put('32002').id;ids.minionId=minion('32076').id;
 }else if(kind==='room-transition'||kind==='room-loss-replay'){
  room('32129b');ids.previousMainId=m.currentMain.id;ids.allyId=put('32002').id;ids.minionId=minion('32075').id;s.scheme.threat=6;
  if(kind==='room-transition')ids.nextMainId=nextRoom('32126b').id;
  else {const retired=m.mainDeck.shift();retired.code=retired.code.slice(0,-1)+'b';s.victoryDisplay.push(retired);ids.previouslyCompletedId=retired.id;}
  const effects=reveals(['01186']);order(['01187']);native(effects);
 }else if(['avalanche-attack','blob-attack','pyro-attack','toad-attack'].includes(kind)){
  const index=['avalanche-attack','blob-attack','pyro-attack','toad-attack'].indexOf(kind);boss('3212'+(index+1)+'a');
  ids.allyId=put('32002').id;ids.handIds=hand(['32013','32014','32015']).map(p=>p.id);
  if(index===2)ids.milledIds=playerTop(['32022','32023']).map(p=>p.id);
  const effects=reveals(['3213'+(index+2)]);ids.boostId=order(['01186'])[0].id;native(effects);
 }else if(['next-villain','collision-hero','collision-alter','victory-standard','victory-expert'].includes(kind)){
  s.villain.hp=1;ids.defeatedId=s.villain.id;ids.nextVillainId=nextBoss('32122'+(expert?'b':'a')).id;
  if(kind.startsWith('collision')){ids.collisionId=minion('32074','p2').id;player('p2').form=kind==='collision-alter'?'alter':'hero';ids.actorId='p2';order(['01186','01187','01186']);}
  if(kind.startsWith('victory')){const needed=expert?2:1;ids.priorVictoryIds=m.villainDeck.splice(m.villainDeck.length-needed,needed).map(p=>{s.victoryDisplay.push(p);return p.id;});}
 }else if(kind==='brotherhood-beatdown'){
  ids.minionIds=['32074','32075','32076'].map(code=>minion(code).id);ids.handIds=hand(['32013','32014']).map(p=>p.id);native(reveals(['32131']));
 }else if(kind==='activation-targets'){
  boss('32123a');ids.minionIds=['32073','32074','32076'].map(code=>minion(code).id);ids.allyId=put('32002').id;ids.handIds=hand(['32013','32014']).map(p=>p.id);ids.milledIds=playerTop(['32007','32009']).map(p=>p.id);
  const effects=reveals(['32132','32133','32134','32135']);ids.revealedIds=effects.map(e=>e.piece.id);order(['01186']);native(effects);
 }else if(kind==='activation-boost'){
  ids.allyId=put('32002').id;const effects=reveals(['32132']);ids.boostIds=order(['32132','01186']).map(p=>p.id);ids.followingId=s.encounter.deck[2].id;native(effects);
 }else if(kind==='protect-students'){
  put('32004');player().form='alter';ids.eventId=hand(['32009'])[0].id;ids.expectedAllyId=player().deck.find(p=>p.code==='32002').id;
  const effects=reveals(['32136']);ids.schemeId=effects[0].piece.id;native(effects);
 }else if(kind==='under-siege'){
  ids.minionIds=['32074','32075','32076','32080'].map(code=>minion(code).id);const effects=reveals(['32137']);ids.schemeId=effects[0].piece.id;native(effects);
 }else if(kind==='mystique-copy'){
  room('32129b');const effects=reveals(['32080']);ids.minionId=effects[0].piece.id;native(effects);
 }else if(kind!=='replacement-module')throw Error('Unknown reviewed Mansion fixture '+kind);
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
  enemyAttackTargets,
  enemyStats,
  schemeLimit,
  heroStats,
  pieceHP,
  isTextBlank,
  roomModifiers,
} = await import(pathToFileURL(fixturePath).href);
for (const [id, source] of Object.entries(sources))
  assert.deepEqual(
    sourceCodes(id),
    source.codes,
    `${id}: runtime uses exact published original source40`,
  );

function seat(state, id) {
  return state.activePlayerId === id
    ? state.player
    : state.players.find((s) => s.id === id).player;
}
function allPieces(state) {
  const nested = (p) => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
    ...(p.inheritorBoosts || []).flatMap(nested),
  ];
  return [
    ...state.players.flatMap((info) => {
      const p = seat(state, info.id);
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
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...(state.encounter.storedBoosts || []),
    ...(state.attack?.pendingBoosts || []),
    ...(state.scheming?.pendingBoosts || []),
    ...(state.mansionAttack?.activeVillainRetired ? [] : [state.villain]),
    ...(state.mansionAttack?.currentMain
      ? [state.mansionAttack.currentMain]
      : []),
    ...(state.mansionAttack?.villainDeck || []),
    ...(state.mansionAttack?.mainDeck || []),
  ].flatMap(nested);
}
const physical = (state, id) => allPieces(state).find((p) => p.id === id);
const typePieces = (state, type) =>
  allPieces(state).filter(
    (p) =>
      definition(p).type_code === type &&
      definition(p).set_code === "mansion_attack",
  );
const victoryCount = (state, type) =>
  (state.victoryDisplay || []).filter((p) => definition(p).type_code === type)
    .length;
function snapshot(state) {
  const pieces = allPieces(state);
  return {
    sources: state.players.map((info) => ({
      seatId: info.id,
      heroId: info.heroId,
      cards: pieces
        .filter(
          (p) =>
            p.ownerId === info.id &&
            definition(p)?.faction_code !== "encounter" &&
            !["32031a", "32031b"].includes(p.code),
        )
        .map(({ id, code }) => ({ id, code })),
      codes: sources[info.heroId].codes,
    })),
    originals: pieces.map(({ id, code, ownerId }) => ({
      id,
      ownerId,
      codes: /^3212[5-9][ab]$/.test(code)
        ? [code.slice(0, -1) + "a", code.slice(0, -1) + "b"]
        : ["32031a", "32031b"].includes(code)
          ? ["32031a", "32031b"]
          : [code],
    })),
    modules: [...(state.modules || [state.module])],
    difficulty: state.difficulty,
  };
}
function conserved(state, f, label) {
  const pieces = allPieces(state);
  assert.ok(
    state.mansionAttack.mainDeck.every((piece) =>
      /^3212[6-9]a$/.test(piece.code),
    ),
    `${label}: every actual hidden room remains on its original2A front`,
  );
  assert.ok(
    state.minions.every(
      (minion) => definition(minion).name !== definition(state.villain).name,
    ),
    `${label}: no illegal same-title villain and engaged minion position`,
  );
  assert.equal(
    state.mansionAttack.winTarget,
    state.difficulty === "expert" ? 3 : 2,
    `${label}: original p15 victory target`,
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
        .filter((p) => source.cards.some((q) => q.id === p.id))
        .map((p) => p.id)
        .sort(),
      source.cards.map((p) => p.id).sort(),
      `${label}: all original player cards occupy one physical zone`,
    );
  }
  for (const set of [
    "mansion_attack",
    "brotherhood",
    ...f.modules,
    "standard",
    ...(f.difficulty === "expert" ? ["expert"] : []),
  ]) {
    const expected = originalEncounterCodes[set];
    assert.ok(expected, `${label}: reviewed original source set ${set}`);
    assert.deepEqual(
      pieces
        .filter(
          (p) =>
            definition(p)?.set_code === set &&
            !["villain", "main_scheme", "environment"].includes(
              definition(p).type_code,
            ),
        )
        .map((p) => p.code)
        .sort(),
      expected,
      `${label}: exact original ${set} physical encounter list`,
    );
  }
  for (const base of bossBases) {
    const copies = typePieces(state, "villain").filter((p) =>
      p.code.startsWith(base),
    );
    assert.equal(
      copies.length,
      1,
      `${label}: one physical ${base} boss across active/hidden/Victory zones`,
    );
    assert.equal(
      copies[0].code,
      base + (state.difficulty === "expert" ? "b" : "a"),
      `${label}: actual difficulty face`,
    );
  }
  for (const base of mainBases)
    assert.equal(
      typePieces(state, "main_scheme").filter((p) => p.code.startsWith(base))
        .length,
      1,
      `${label}: one physical ${base} main across active/hidden/Victory zones`,
    );
  assert.equal(
    pieces.filter((p) => p.code === "32130").length,
    1,
    `${label}: one original Save the School environment`,
  );
  assert.equal(
    pieces.filter((p) => definition(p).set_code === "mansion_attack").length,
    25,
    `${label}: all25 physical scenario cards (26 supported faces)`,
  );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    f.originals.map((p) => p.id).sort(),
    `${label}: every original piece in exactly one zone`,
  );
  for (const original of f.originals) {
    const matches = pieces.filter((p) => p.id === original.id);
    assert.equal(
      matches.length,
      1,
      `${label}: unique original physical ID ${original.id}`,
    );
    assert.ok(
      original.codes.includes(matches[0].code),
      `${label}: original physical card or reversible face ${original.id}`,
    );
    assert.equal(
      matches[0].ownerId,
      original.ownerId,
      `${label}: original ownership ${original.id}`,
    );
  }
  for (const info of state.players)
    assert.equal(
      pieces.filter(
        (p) => p.ownerId === info.id && ["32031a", "32031b"].includes(p.code),
      ).length,
      Number(info.heroId === "shadowcat"),
      `${label}: original extra reversible Permanent`,
    );
  if (!state.mansionAttack.activeVillainRetired)
    assert.equal(
      state.villain.maxHp,
      definition(state.villain).health * state.playerCount,
      `${label}: printed villain health per starting hero`,
    );
  if (state.mansionAttack.currentMain) {
    assert.equal(
      state.mansionAttack.currentMain.code,
      state.scheme.code,
      `${label}: public scheme view reflects actual physical room`,
    );
    assert.equal(
      schemeLimit(state),
      7 * state.playerCount,
      `${label}: original room threshold per hero`,
    );
  }
}
if (process.env.MANSION_ATTACK_FIXTURE_CHECK) {
  const prepared = scenarios.map((kind) => {
    const f = fixture(kind),
      inventory = snapshot(f.state);
    conserved(f.state, inventory, kind);
    return {
      kind,
      sourceCards: 40 * inventory.sources.length,
      originalPieces: inventory.originals.length,
      scenarioPieces: 25,
      physicalBosses: typePieces(f.state, "villain").length,
      physicalMains: typePieces(f.state, "main_scheme").length,
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
  if (process.env.MANSION_ATTACK_CORE_SHA256)
    assert.equal(proof[2].sha256, process.env.MANSION_ATTACK_CORE_SHA256);
  if (process.env.MANSION_ATTACK_ASSET)
    assert.equal(
      basename(new URL(js[0]).pathname),
      process.env.MANSION_ATTACK_ASSET,
    );
  if (process.env.MANSION_ATTACK_SHA256)
    assert.equal(proof[0].sha256, process.env.MANSION_ATTACK_SHA256);
  if (process.env.MANSION_ATTACK_CSS_SHA256)
    assert.equal(proof[1].sha256, process.env.MANSION_ATTACK_CSS_SHA256);
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
    if (sessionStorage.getItem("mansion-attack-fixture-loaded")) return;
    sessionStorage.setItem("mansion-attack-fixture-loaded", "yes");
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
  if (process.env.MANSION_ATTACK_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.MANSION_ATTACK_ASSET),
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
      publishedSources: f.sources.map((source) => ({
        seatId: source.seatId,
        heroId: source.heroId,
        sourceUrl: sources[source.heroId].sourceUrl,
        originalCards: source.cards,
      })),
      originalPhysicalIds: f.originals.map((piece) => piece.id).sort(),
      actualPieces: allPieces(state).map(({ id, code, ownerId }) => ({
        id,
        code,
        ownerId,
      })),
      physicalScenarioPieces: 25,
      physicalVillains: 4,
      physicalMainSchemes: 5,
    });
  }
  if (state?.villainId === "mansion_attack") {
    assert.equal(
      await page
        .locator(`.villain-card img[src="${imageFor(state.villain.code)}"]`)
        .count(),
      1,
      "Actual original current villain artwork",
    );
    assert.equal(
      await page
        .locator(`.scheme-card img[src="${imageFor(state.scheme.code)}"]`)
        .count(),
      1,
      "Actual original active room artwork",
    );
    assert.equal(
      await page
        .locator(`.scenario-environment img[src="${imageFor("32130")}"]`)
        .count(),
      1,
      "Actual original Save the School environment artwork",
    );
    const bossText = (await page.locator(".villain-info").innerText()).replace(
      /\s+/g,
      " ",
    );
    assert.ok(
      bossText.includes(
        `VILLAIN · SIDE ${state.difficulty === "expert" ? "B" : "A"}`,
      ),
    );
    assert.ok(
      bossText.includes(
        `${victoryCount(state, "villain")}/${state.mansionAttack.winTarget} villains defeated · ${state.mansionAttack.villainDeck.length} in the villain deck`,
      ),
      "Actual public boss progress and hidden count",
    );
    const mainText = (await page.locator(".main-scheme").innerText()).replace(
      /\s+/g,
      " ",
    );
    assert.ok(
      mainText.includes(
        `${victoryCount(state, "main_scheme") - 1}/2 rooms completed · ${state.mansionAttack.mainDeck.length} rooms in the main scheme deck`,
      ),
      "Actual public room progress excludes opening1B",
    );
    assert.equal(await page.locator(".scheme-stage").innerText(), "2B");
    assert.equal(
      await page.locator(".main-scheme details button").count(),
      state.victoryDisplay.length,
      "Each original public Victory card is inspectable exactly once",
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
async function publicSource(
  count,
  difficulty,
  width,
  module = "mystique",
  kind = `public-${count}-${difficulty}`,
) {
  current = { kind, count, difficulty, width, module };
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
    .getByRole("button", { name: "Mansion Attack", exact: true })
    .click();
  const modular = page.getByRole("combobox", {
    name: "Modular encounter",
    exact: true,
  });
  assert.equal(await modular.inputValue(), "mystique");
  assert.equal(
    await modular.locator('option[value="brotherhood"]').count(),
    0,
    "Fixed Brotherhood cannot occupy configurable slot",
  );
  assert.match(
    await page.locator(".module-label").innerText(),
    /Brotherhood is included with this scenario[\s\S]*Mystique is recommended/,
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
  await modular.selectOption(module);
  await page.locator("#mission-seed").fill("3212130");
  await page.locator("#start-btn").click();
  await page.waitForFunction(
    () =>
      JSON.parse(localStorage.getItem("champions.save.v1"))?.villainId ===
      "mansion_attack",
  );
  await settle();
  let state = await save();
  assert.equal(
    state.phase,
    "mulligan",
    "Actual opening setup has completed before opening-hand confirmation",
  );
  assert.equal(state.playerCount, count);
  assert.equal(state.difficulty, difficulty.toLowerCase());
  assert.deepEqual(state.modules, [module]);
  assert.match(
    state.villain.code,
    difficulty === "Standard" ? /^3212[1-4]a$/ : /^3212[1-4]b$/,
  );
  assert.equal(state.villain.hp, definition(state.villain).health * count);
  assert.equal(state.villain.tough, true);
  assert.match(state.scheme.code, /^3212[6-9]b$/);
  assert.equal(state.scheme.threat, count);
  assert.equal(state.mansionAttack.villainDeck.length, 3);
  assert.equal(state.mansionAttack.mainDeck.length, 3);
  assert.equal(victoryCount(state, "main_scheme"), 1);
  assert.ok(state.victoryDisplay.some((p) => p.code === "32125b"));
  assert.equal(state.environments.filter((p) => p.code === "32130").length, 1);
  for (const info of state.players) {
    assert.equal(seat(state, info.id).form, "alter");
    assert.equal(seat(state, info.id).hand.length, 6);
    assert.equal(
      state.encounter.dealt.filter((p) => p.dealtTo === info.id).length,
      1,
      "Original1B deals one actual facedown card to each seat before opening-hand confirmation",
    );
    assert.deepEqual(
      info.deckCards.filter((c) => c !== "32031a").sort(),
      sources[info.heroId].codes,
    );
  }
  const f = snapshot(state);
  conserved(state, f, "actual public mulligan");
  await window(`${kind}-original-mulligan`, width, f);
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
        "Unreviewed source setup " + JSON.stringify(state.prompt),
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
  assert.equal(state.encounter.dealt.length, count);
  if (module === "bomb_scare") {
    assert.equal(
      allPieces(state).filter((p) => definition(p).set_code === "mystique")
        .length,
      0,
      "Replacement module contains no recommended-only Mystique cards",
    );
    assert.equal(
      allPieces(state).filter((p) => definition(p).set_code === "brotherhood")
        .length,
      8,
    );
  }
  await window(`${kind}-actual-setup-originals`, width, f);
  checks.push({
    ...current,
    sourceCards: 40 * count,
    scenarioPieces: 25,
    requiredBrotherhoodPieces: 8,
    selectedModularPieces: originalEncounterCodes[module].length,
    originalPieces: f.originals.length,
    exactReload: true,
  });
}

async function actualAbility(id, label) {
  const host = page.locator(`.in-play-card[data-piece-id="${id}"]`);
  assert.equal(
    await host.count(),
    1,
    "Actual original controlled source exposes its native action",
  );
  await page.mouse.move(4, 4);
  await host
    .locator(".in-play-actions button")
    .filter({ hasText: label })
    .click();
  return settle();
}
async function finishNative(f = {}) {
  for (let n = 0; n < 200; n++) {
    const state = await save();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const p = state.prompt;
    const option =
      passOption(state) ||
      (/indirect/i.test(p.text)
        ? p.options.find((o) => /^hero(?::|$)/.test(o.id))
        : null) ||
      (p.title === "Avalanche"
        ? p.options.find((o) => o.id === f.allyId) ||
          p.options.find((o) => /^hero(?::|$)/.test(o.id))
        : null) ||
      (p.options.length === 1 ? p.options[0] : null) ||
      (/forced responses|each player|order/i.test(p.title)
        ? p.options[0]
        : null);
    assert.ok(
      option,
      "Unreviewed mandatory native source window " + JSON.stringify(p),
    );
    await choice(option.id);
  }
  throw Error("Actual native windows did not settle");
}
async function maybeTarget(id) {
  const s = await save();
  if (s.prompt?.options.some((o) => matchesOption(s, o, (x) => x.id === id)))
    return target(id);
  return s;
}
async function actualFlipTough() {
  await flip();
  await select(
    (o) => o.id === "steel-skin",
    "Native Steel Skin after actual form change",
  );
  return finishChoices();
}
async function runCase(kind, width) {
  if (kind === "replacement-module")
    return publicSource(1, "Standard", width, "bomb_scare", kind);
  current = { kind, width };
  const native = fixture(kind),
    f = { ...native, ...snapshot(native.state) };
  await open(f, width);
  if (["room-loss-replay", "victory-standard", "victory-expert"].includes(kind))
    await window(`${kind}-initial`, width, f);
  else await checkpoint(`${kind}-initial`, width, f);
  let state = await save();
  if (state.prompt?.options.some((o) => o.id === "go"))
    state = await choice("go");
  if (kind === "atrium-steady") {
    await actualFlipTough();
    await play("32009");
    await target("tough");
    await finishChoices();
    assert.equal(
      (await save()).player.toughCards,
      2,
      "Actual Bulletproof Protector gives two Tough cards",
    );
    for (let i = 0; i < 2; i++) {
      await play("32008");
      await window(`${kind}-actual-payment-${i + 1}`, width, f);
      await pay([f.paymentIds[i]]);
      await maybeTarget((await save()).villain.id);
      await select(
        (o) => o.id === "discard",
        "Actual Steel Fist optional Tough cost",
      );
      state = await finishChoices();
      assert.equal(state.villain.stunCards, i + 1);
      assert.equal(state.villain.confuseCards, i + 1);
      assert.equal(state.villain.stunned, i === 1);
      assert.equal(state.villain.confused, i === 1);
    }
    assert.equal(
      state.villain.hp,
      10,
      "First real Steel Fist removes actual Tough; second deals printed5",
    );
    assert.equal(state.player.toughCards, 0);
  } else if (kind === "cafeteria-retaliate") {
    await basic("attack");
    await maybeTarget(f.minionId);
    state = await finishChoices();
    assert.equal(
      state.player.hp,
      13,
      "Actual minion Retaliate damages the attacking hero",
    );
    assert.equal(physical(state, f.minionId).damage, 2);
    await actualAbility(f.allyId, /Attack/i);
    await maybeTarget(state.villain.id);
    state = await finishChoices();
    assert.equal(
      physical(state, f.allyId).damage,
      2,
      "Actual ally receives Retaliate1 plus printed consequential damage",
    );
    await paidEvent("32015", f.paymentIds);
    await select(
      (o) => o.id === "take",
      "Actual paid Bait and Switch enemy attack",
    );
    state = await finishNative(f);
    assert.equal(state.player.hp, 10);
    assert.equal(
      state.villain.hp,
      12,
      "Defending identity Retaliate damages actual attacking villain",
    );
  } else if (kind === "basketball-toughness") {
    state = await finishNative(f);
    assert.equal(
      physical(state, f.minionId).tough,
      true,
      "Actual revealed minion gains entry Toughness",
    );
    assert.equal(
      physical(state, f.existingId).tough,
      false,
      "Existing ally gains no retroactive Tough",
    );
    await play("32002");
    await window("basketball-actual-source-payment", width, f);
    await pay(f.paymentIds);
    state = await finishChoices();
    assert.equal(
      physical(state, f.allyId).tough,
      true,
      "Actual paid ally entry gains Toughness",
    );
    assert.equal(state.player.tough, false);
    assert.equal(state.villain.tough, false);
  } else if (kind === "courtyard-attack") {
    assert.equal(heroStats(state).attack, 3);
    assert.equal(enemyStats(state, physical(state, f.minionId)).attack, 3);
    assert.equal(enemyStats(state, state.villain).attack, 4);
    await basic("attack");
    await maybeTarget(state.villain.id);
    state = await finishChoices();
    assert.equal(state.villain.hp, 12);
    await actualAbility(f.allyId, /Attack/i);
    await maybeTarget(state.villain.id);
    state = await finishChoices();
    assert.equal(
      state.villain.hp,
      9,
      "Native ally attack includes the same live Courtyard +1",
    );
  } else if (kind === "room-transition") {
    state = await finishNative(f);
    assert.equal(state.mansionAttack.currentMain.id, f.nextMainId);
    assert.equal(state.scheme.code, "32126b");
    assert.equal(state.scheme.threat, 1);
    assert.equal(victoryCount(state, "main_scheme"), 2);
    assert.ok(state.victoryDisplay.some((p) => p.id === f.previousMainId));
    assert.equal(heroStats(state).attack, 2);
    assert.equal(enemyStats(state, state.villain).attack, 3);
    assert.equal(enemyStats(state, physical(state, f.minionId)).attack, 0);
    assert.equal(
      roomModifiers(state, "hero").steady,
      true,
      "New actual room replaces every previous live grant",
    );
  } else if (kind === "room-loss-replay") {
    state = await finishNative(f);
    assert.equal(state.phase, "lost");
    assert.equal(victoryCount(state, "main_scheme"), 3);
    assert.equal(state.mansionAttack.currentMain, undefined);
    assert.ok(state.victoryDisplay.some((p) => p.id === f.previousMainId));
    assert.match(
      await page.getByRole("dialog").innerText(),
      /defeat|lost|mission failed/i,
    );
  } else if (
    ["avalanche-attack", "blob-attack", "pyro-attack", "toad-attack"].includes(
      kind,
    )
  ) {
    await window(`${kind}-actual-defense`, width, f);
    await select(
      (o) => o.id === "take",
      "Take actual named villain activation",
    );
    state = await finishNative(f);
    assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
    assert.equal(
      state.mansionAttack.handledAttackResponses.length,
      1,
      "Exactly one actual performed-attack forced response",
    );
    if (kind === "avalanche-attack") {
      assert.equal(physical(state, f.allyId).exhausted, true);
      assert.equal(state.player.hp, 11);
    }
    if (kind === "blob-attack") {
      assert.equal(state.player.stunned, true);
      assert.equal(state.player.hp, 12);
    }
    if (kind === "pyro-attack") {
      assert.equal(
        state.player.hp,
        10,
        "Printed double-resource cards mill to four actual indirect damage",
      );
      for (const id of f.milledIds)
        assert.ok(state.player.discard.some((p) => p.id === id));
    }
    if (kind === "toad-attack") {
      assert.equal(state.player.hp, 12);
      assert.equal(
        state.player.hand.filter((p) => f.handIds.includes(p.id)).length,
        2,
      );
      assert.equal(
        state.player.discard.filter((p) => f.handIds.includes(p.id)).length,
        1,
      );
    }
  } else if (
    [
      "next-villain",
      "collision-hero",
      "collision-alter",
      "victory-standard",
      "victory-expert",
    ].includes(kind)
  ) {
    await basic("attack");
    await maybeTarget(state.villain.id);
    state = await finishNative(f);
    assert.ok(state.victoryDisplay.some((p) => p.id === f.defeatedId));
    if (kind.startsWith("victory")) {
      assert.equal(state.phase, "won");
      assert.equal(
        victoryCount(state, "villain"),
        kind === "victory-expert" ? 3 : 2,
      );
      assert.equal(state.mansionAttack.activeVillainRetired, true);
      assert.match(
        await page.getByRole("dialog").innerText(),
        /victory|won|complete/i,
      );
    } else {
      assert.equal(state.phase, "player");
      assert.equal(state.villain.id, f.nextVillainId);
      assert.equal(state.villain.tough, true);
      assert.equal(state.villain.hp, 16 * state.playerCount);
      assert.equal(victoryCount(state, "villain"), 1);
      assert.equal(
        state.encounter.dealt.length,
        state.playerCount,
        "Save the School deals actual facedown cards to every player before next villain",
      );
      if (kind.startsWith("collision")) {
        assert.ok(state.encounter.discard.some((p) => p.id === f.collisionId));
        assert.equal(
          state.minions.some((p) => p.id === f.collisionId),
          false,
        );
        if (kind === "collision-hero") {
          assert.equal(seat(state, "p2").hp, 7);
          assert.equal(seat(state, "p2").stunned, true);
          assert.equal(seat(state, "p1").hp, 14);
        } else {
          assert.equal(state.scheme.threat, 1);
          assert.equal(seat(state, "p2").hp, 9);
        }
      }
    }
  } else if (kind === "brotherhood-beatdown") {
    state = await finishNative(f);
    assert.equal(state.player.exhausted, true);
    assert.equal(state.player.stunned, true);
    assert.equal(state.player.hp, 12);
    assert.equal(
      state.player.hand.filter((p) => f.handIds.includes(p.id)).length,
      1,
    );
    assert.ok(
      f.minionIds.every((id) => state.minions.some((p) => p.id === id)),
    );
  } else if (kind === "activation-targets") {
    state = await finishNative(f);
    for (const id of f.revealedIds)
      assert.ok(
        state.encounter.discard.some((p) => p.id === id),
        "Each actual named treachery resolves and discards",
      );
    for (const id of [state.villain.id, ...f.minionIds])
      assert.equal(
        state.enemyAttackCounts[id],
        1,
        "Each actual matching current villain/engaged minion activates once",
      );
    assert.equal(
      state.minions.length,
      3,
      "Named activations create no duplicate original minion",
    );
    assert.ok(
      f.milledIds.every((id) => state.player.discard.some((p) => p.id === id)),
    );
  } else if (kind === "activation-boost") {
    await window("matching-source-extra-boost-defense", width, f);
    state = await finishNative(f);
    assert.equal(state.player.hp, 10);
    for (const id of f.boostIds)
      assert.ok(state.encounter.discard.some((p) => p.id === id));
    assert.equal(
      state.encounter.deck[0].id,
      f.followingId,
      "Exactly one additional actual boost for matching villain",
    );
  } else if (kind === "protect-students") {
    state = await finishNative(f);
    assert.equal(
      physical(state, f.schemeId).counters,
      4,
      "Fixed2 +Hinder2 per actual hero",
    );
    await actualFlipTough();
    await basic("thwart");
    await maybeTarget(f.schemeId);
    state = await finishChoices();
    assert.equal(physical(state, f.schemeId).counters, 2);
    await play("32009");
    await select(
      (o) => o.id === "ready",
      "Actual Bulletproof Protector readies exhausted hero after actual Tough cost",
    );
    await finishChoices();
    await basic("thwart");
    await maybeTarget(f.schemeId);
    await findChoice(
      (o) => o.id === f.expectedAllyId,
      "Native defeated-side-scheme actual source ally search",
    );
    await window("students-actual-original-ally-search", width, f);
    await target(f.expectedAllyId);
    state = await finishChoices();
    assert.ok(state.player.hand.some((p) => p.id === f.expectedAllyId));
    assert.ok(state.encounter.discard.some((p) => p.id === f.schemeId));
  } else if (kind === "under-siege") {
    state = await finishNative(f);
    assert.equal(
      physical(state, f.schemeId).counters,
      15,
      "Five actual Brotherhood characters includes current villain, three brothers and Mystique",
    );
    assert.equal(
      state.sideSchemes.filter((p) => p.id === f.schemeId).length,
      1,
    );
  } else if (kind === "mystique-copy") {
    state = await finishNative(f);
    const mystique = physical(state, f.minionId),
      copied = enemyStats(state, state.villain);
    assert.deepEqual(enemyStats(state, mystique), {
      attack: copied.attack + roomModifiers(state, mystique).attack,
      scheme: copied.scheme,
    });
    assert.equal(mystique.tough, true);
    assert.deepEqual(
      enemyAttackTargets(state).map((target) => target.id),
      [f.minionId],
      "Actual Mystique source leaves only its actual minion as a legal attack target",
    );
    await basic("attack");
    state = await save();
    if (state.prompt) {
      assert.ok(
        state.prompt.options.every((option) => option.id !== state.villain.id),
        "Actual Mystique source prohibits villain attacks",
      );
      await target(f.minionId);
    }
    state = await finishChoices();
    assert.equal(
      physical(state, f.minionId).tough,
      false,
      "Actual legal minion attack removes its printed entry Tough",
    );
    assert.equal(state.villain.hp, 15);
  } else throw Error("Unknown reviewed browser flow " + kind);
  if (["room-loss-replay", "victory-standard", "victory-expert"].includes(kind))
    await checkpoint(`${kind}-resolved`, width, f);
  else await window(`${kind}-resolved`, width, f);
  if (kind === "room-loss-replay") {
    await page
      .getByRole("button", { name: "Replay this seed", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    const replayed = await save();
    assert.equal(replayed.phase, "mulligan");
    assert.equal(replayed.startSeed, f.state.startSeed);
    assert.deepEqual(replayed.modules, ["mystique"]);
    assert.equal(victoryCount(replayed, "main_scheme"), 1);
    assert.equal(replayed.encounter.dealt.length, replayed.playerCount);
    await window("room-loss-actual-replay", width, snapshot(replayed));
  }
  checks.push({
    kind,
    width,
    sourceCards: 40 * f.sources.length,
    scenarioPieces: 25,
    requiredBrotherhoodPieces: 8,
    selectedModularPieces: 5,
    originalPieces: f.originals.length,
    exactReload: true,
  });
}

try {
  if (!process.env.MANSION_ATTACK_FIXTURE_ONLY)
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
        sourceAudits,
        errors,
        productionBrowserVerified: true,
        originalPlayerSources: sources,
        physicalScenarioPieces: 25,
        supportedScenarioFaces: 26,
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
