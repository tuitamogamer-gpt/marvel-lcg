import { chromium, request } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.SPDR_OUTPUT || "output/spdr/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const defaults = [
  "maintenance",
  "pilot-flip",
  "sync-cancel",
  "rapid-deployment",
  "web-trap",
  "venom",
  "systems-ready",
  "systems-search",
  "may-hero",
  "may-alter",
  "command-draw",
  "command-ready",
  "host-ready",
  "psychic-thwart",
  "fluid-attack",
  "alloy-defense",
  "ejection",
  "pool-daredevil",
  "pool-noir",
  "pool-repurpose",
  "pool-thwip",
  "pool-barrier",
  "pool-forcefield",
  "pool-tingle-treachery",
  "pool-tingle-minion",
  "pool-ham",
  "pool-spider-man",
  "pool-stamina",
  "pool-unshakable",
  "pool-clarity",
  "obligation-remove",
  "obligation-discard",
  "nemesis",
  "giant-cost",
  "morbius-sync",
  "drain-energy",
  "drain-damage",
  "drain-alter",
  "module-grand",
  "module-bombshell",
  "module-bombshell-remainder",
  "module-bombshell-boost",
  "module-electro",
  "module-hobgoblin",
  "module-iron-spider",
  "module-iron-spider-overkill",
  "module-sandman",
  "module-sandman-boost",
  "module-spot-exact",
  "module-spot-excess",
  "module-spot-boost",
  "module-surge",
  "module-surge-remove",
];
const scenarios = (process.env.SPDR_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.SPDR_VIEWPORTS || "1920,1440,1280,390")
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

// Fixtures move only original physical cards from the native 40-card setup.
// The supplementary Clarity case declares a complete legal Leadership custom deck.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card,heroStats} from './src/game/cards.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
export {dispatch};
const originalSPdr=Object.entries({'31003':1,'31004':3,'31005':2,'31006':2,'31007':1,'31008':1,'31009':1,'31010':1,'31011':1,'31012':1,'31013':1,'31014':1,'31015':1,'31016':3,'31017':3,'31018':3,'31019':3,'31020':3,'31021':1,'31022':1,'31023':3,'31024':3}).flatMap(([code,count])=>Array(count).fill(code));
const clarityDeck=[...originalSPdr.filter(code=>['hero','basic'].includes(card({code}).faction_code)),...Object.entries({'31029':3,'01066':1,'01067':1,'01068':1,'01069':3,'01070':3,'01071':3,'01074':2}).flatMap(([code,count])=>Array(count).fill(code))];
const identityCodes=new Set(['31001a','31001b','31002a','31002b']);
export function isPlayerDeckPiece(p){return !identityCodes.has(p.code)&&['event','resource','ally','support','upgrade'].includes(card(p)?.type_code);}
export function definition(p){return card(p);}
export function sourceCodes(id,custom=false){return (id==='spdr'?(custom?clarityDeck:originalSPdr).slice():heroStarterCodes(id)).sort();}
export function stats(s){return heroStats(s);}
export function payment(s){const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);}
export function fixture(kind){
 const custom=kind==='pool-clarity';
 const heroes=[{heroId:'spdr',aspect:custom?'leadership':'protection',deckCards:sourceCodes('spdr',custom),deckOrigin:custom?'custom':'source'},...(kind==='module-bombshell-boost'?[{heroId:'nova',aspect:'aggression',deckCards:heroStarterCodes('nova'),deckOrigin:'source'}]:[])];
 let s=newGame({...heroes[0],heroes,villainId:'rhino',module:'ironspider_sinister',seed:31001,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
 for(let n=0;s.phase==='mulligan'&&n<20;n++){if(s.prompt)throw Error('Unexpected native setup choice '+s.prompt.title);command({type:'MULLIGAN',ids:[]});}
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native SP//dr source setup incomplete');
 const sources=s.players.map(seat=>{const p=seatView(s,seat).player;const cards=[...p.hand,...p.deck,...p.discard,...p.inPlay].filter(isPlayerDeckPiece).map(p=>({id:p.id,code:p.code}));if(cards.length!==40)throw Error('Native forty-card source missing');return{seatId:seat.id,heroId:seat.heroId,cards,codes:sourceCodes(seat.heroId,custom),provenance:custom?'Legal Leadership 40: original SP//dr hero/basic 23 plus 17 Leadership cards including supplementary Clarity of Purpose':'Original SP//dr Protection source starter'};});
 const p=s.player,suit=p.inPlay.find(piece=>piece.code==='31001b'),pilot=p.spdrIdentity;
 if(!suit||!pilot||pilot.code!=='31002a')throw Error('Native two independent SP//dr identity cards missing');
 const identities=[{id:suit.id,codes:['31001a','31001b']},{id:pilot.id,codes:['31002a','31002b']}];
 const modular=s.encounter.deck.filter(p=>card(p).set_code==='ironspider_sinister').map(p=>({id:p.id,code:p.code}));
 const encounters=[...s.encounter.deck,...(p.setAside||[])].filter(p=>['31025','31026','31027','31028'].includes(p.code)).map(p=>({id:p.id,code:p.code}));
 if(modular.length!==8||encounters.length!==6)throw Error('Native module eight and obligation/nemesis six required: '+JSON.stringify({module:modular,encounters}));
 p.deck.push(...p.hand.splice(0));p.hp=14;p.exhausted=false;p.flipped=false;
 if(!['maintenance','may-alter','drain-alter'].includes(kind)){command({type:'FLIP'});s.player.flipped=false;}
 if(s.players.length>1){const other=seatView(s,'p2').player;other.form='hero';other.hp=10;other.exhausted=false;other.flipped=false;}
 activateSeat(s,'p1');s.villain.hp=s.villain.maxHp=50;s.scheme.threat=6;s.queue=[];s.prompt=null;s.review=null;
 function player(){return s.player;}
 function take(code){const p=player();for(const zone of[p.hand,p.deck,p.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual source '+code);}
 function hand(codes){const ps=codes.map(take);player().hand.push(...ps);return ps;}
 function put(code){const p=take(code);p.exhausted=false;player().inPlay.push(p);return p;}
 function top(codes){const ps=codes.map(take);player().deck.unshift(...ps);return ps;}
 function encounter(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,player().setAside||[]]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual encounter '+code);}
 function minion(code){const p=encounter(code);p.engagedWith='p1';s.minions.push(p);return p;}
 function scheme(code='01107',amount=5){const p=encounter(code);p.counters=amount;s.sideSchemes.push(p);return p;}
 function native(effects){s.prompt={kind:'choice',title:'Resolve native source',text:'Resolve the actual physical source action.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code,fromDeck=false){const p=encounter(code);if(fromDeck){s.encounter.deck.unshift(p);native([{type:'revealNext'}]);}else{s.resolving.push(p);native([{type:'reveal',piece:p,skip:true}]);}return p;}
 function damage(amount){native([{type:'damage',target:'hero',amount,source:'browser-native-packet'}]);}
 function attack(id=s.villain.id){native([{type:'enemyAttack',id,actorId:'p1'}]);}
 function boost(code){const p=encounter(code);s.encounter.deck.unshift(p);return p;}
 let ids={suitId:suit.id,pilotId:pilot.id};
 if(kind==='maintenance'){ids.drawIds=top(['31004','31006']).map(p=>p.id);}
 else if(kind==='pilot-flip'){ids.eventId=hand(['31023'])[0].id;}
 else if(kind==='sync-cancel'){ids.eventId=hand(['31006'])[0].id;ids.linkId=put('31011').id;}
 else if(kind==='rapid-deployment'){ids.eventId=hand(['31005'])[0].id;ids.linkId=put('31011').id;ids.schemeId=scheme('01107',5).id;}
 else if(kind==='web-trap'){ids.eventId=hand(['31006'])[0].id;ids.linkId=put('31011').id;}
 else if(kind==='venom'){ids.eventId=hand(['31003'])[0].id;ids.interfaceIds=['31010','31011','31012','31013'].map(code=>put(code).id);}
 else if(kind==='systems-ready'){ids.eventId=hand(['31004'])[0].id;ids.interfaceIds=['31010','31011','31012','31013'].map(code=>{const p=put(code);p.exhausted=true;return p.id});player().inPlay.find(p=>p.id===pilot.id).exhausted=true;ids.resourceIds=hand(['31023']).map(p=>p.id);}
 else if(kind==='systems-search'){ids.eventId=hand(['31004'])[0].id;const p=take('31011');player().discard.push(p);ids.interfaceId=p.id;ids.resourceIds=hand(['31023']).map(p=>p.id);}
 else if(kind.startsWith('may-')){ids.supportId=put('31007').id;ids.topIds=top(kind==='may-alter'?['31004','31016','31006']:['31004','31016']).map(p=>p.id);}
 else if(kind==='command-draw'){ids.supportId=put('31009').id;ids.interfaceId=put('31011').id;ids.drawId=top(['31004'])[0].id;}
 else if(kind==='command-ready'){ids.supportId=put('31009').id;const p=put('31011');p.exhausted=true;ids.interfaceId=p.id;ids.discardId=hand(['31023'])[0].id;}
 else if(kind==='host-ready'){ids.upgradeId=put('31010').id;player().exhausted=true;player().spdrIdentity.exhausted=true;}
 else if(kind==='psychic-thwart'){ids.interfaceId=put('31011').id;}
 else if(kind==='fluid-attack'){ids.interfaceId=put('31013').id;}
 else if(kind==='alloy-defense'){ids.interfaceId=put('31012').id;ids.boostId=boost('31033').id;attack();}
 else if(kind==='ejection'){ids.supportId=put('31008').id;ids.interfaceIds=['31010','31011','31012','31013'].map(code=>put(code).id);player().hp=2;}
 else if(kind==='pool-daredevil'){ids.allyId=put('31014').id;ids.boostId=boost('01104').id;attack();}
 else if(kind==='pool-noir'){ids.allyId=put('31015').id;s.villain.hp=46;ids.encounterId=reveal('01104').id;}
 else if(kind==='pool-repurpose'){ids.upgradeId=put('31013').id;ids.eventId=hand(['31016'])[0].id;player().exhausted=true;player().spdrIdentity.exhausted=true;}
 else if(kind==='pool-thwip'){ids.enemyIds=[minion('31032').id,minion('31035').id];ids.morbiusId=minion('31027').id;const events=hand(['31017','31017']);ids.eventId=events[0].id;ids.secondEventId=events[1].id;ids.resourceIds=hand(['31023','31024']).map(p=>p.id);ids.interfaceId=put('31011').id;player().tough=true;}
 else if(kind==='pool-barrier'){const p=put('31018');p.counters=3;ids.upgradeId=p.id;damage(3);}
 else if(kind==='pool-forcefield'){const p=put('31019');p.counters=6;ids.upgradeId=p.id;damage(8);}
 else if(kind.startsWith('pool-tingle-')){ids.upgradeId=put('31020').id;s.villain.hp=46;ids.encounterId=reveal(kind==='pool-tingle-treachery'?'01104':'31035',true).id;}
 else if(kind==='pool-ham'){ids.allyId=put('31021').id;ids.boostId=boost('31034').id;}
 else if(kind==='pool-spider-man'){const p=put('31011');p.exhausted=true;ids.upgradeId=p.id;ids.allyId=hand(['31022'])[0].id;ids.interfaceId=put('31013').id;ids.drawId=top(['31004'])[0].id;}
 else if(kind==='pool-stamina'){ids.eventId=hand(['31023'])[0].id;player().exhausted=true;player().spdrIdentity.exhausted=true;}
 else if(kind==='pool-unshakable'){ids.eventId=hand(['31024'])[0].id;s.scheme.threat=0;const ps=['01104','01106','31033'].map(encounter);s.encounter.deck.unshift(...ps);ids.boostId=ps[0].id;ids.encounterId=ps[1].id;ids.secondBoostId=ps[2].id;}
 else if(kind==='pool-clarity'){ids.eventId=hand(['31023'])[0].id;const p=put('31029');p.attachedTo='hero:p1';ids.upgradeId=p.id;player().exhausted=true;player().spdrIdentity.exhausted=true;}
 else if(kind.startsWith('obligation-')){ids.interfaceId=put('31011').id;ids.encounterId=reveal('31025').id;}
 else if(kind==='nemesis'){ids.encounterId=reveal('01190').id;}
 else if(kind==='giant-cost'){ids.schemeId=scheme('31026',4).id;ids.interfaceId=put('31013').id;}
 else if(kind==='morbius-sync'){ids.enemyId=minion('31027').id;ids.eventId=hand(['31006'])[0].id;ids.interfaceId=put('31011').id;}
 else if(kind.startsWith('drain-')){ids.resourceIds=hand(['31003','31004']).map(p=>p.id);ids.encounterId=reveal('31028').id;}
 else if(kind==='module-grand'){ids.schemeId=scheme('31030',5).id;ids.secondSchemeId=scheme('01107',5).id;ids.enemyId=minion('31035').id;}
 else if(kind==='module-bombshell'){ids.enemyId=minion('31031').id;ids.allyIds=['31003','31014'].map(code=>put(code).id);attack(ids.enemyId);}
 else if(kind==='module-bombshell-remainder'){ids.enemyId=minion('31031').id;ids.allyId=put('31003').id;attack(ids.enemyId);}
 else if(kind==='module-bombshell-boost'){ids.boostId=boost('31031').id;ids.allyId=put('31003').id;attack();}
 else if(kind==='module-electro'){ids.resourceId=hand(['31003'])[0].id;ids.enemyId=reveal('31032').id;}
 else if(kind==='module-hobgoblin'){ids.enemyId=minion('31033').id;ids.discardIds=['31034','31026'].map(code=>boost(code).id).reverse();attack(ids.enemyId);}
 else if(kind==='module-iron-spider'){ids.enemyId=reveal('31034').id;}
 else if(kind==='module-iron-spider-overkill'){const p=minion('31034');p.tough=true;p.toughCards=1;ids.enemyId=p.id;const ally=put('31014');ally.damage=2;ids.allyId=ally.id;attack(p.id);}
 else if(kind==='module-sandman'){ids.enemyId=minion('31035').id;ids.discardIds=s.encounter.deck.slice(0,7).map(p=>p.id);}
 else if(kind==='module-sandman-boost'){ids.boostId=boost('31035').id;ids.discardIds=s.encounter.deck.slice(1,8).map(p=>p.id);attack();}
 else if(kind.startsWith('module-spot-')){if(kind==='module-spot-boost'){ids.boostId=boost('31036').id;attack();}else{const p=minion('31036');p.damage=kind==='module-spot-exact'?2:3;ids.enemyId=p.id;}}
 else if(kind==='module-surge'){ids.environmentId=reveal('31037').id;const p=encounter('31034');s.encounter.deck.unshift(p);ids.enemyId=p.id;const e=encounter('01104');s.encounter.deck.splice(1,0,e);ids.surgeId=e.id;s.villain.hp=46;s.prompt.options[0].effects.push({type:'revealDealt'});}
 else if(kind==='module-surge-remove'){const p=encounter('31037');s.environments.push(p);ids.environmentId=p.id;ids.interfaceId=put('31011').id;}
 else throw Error('Unknown reviewed fixture '+kind);
 syncSeat(s);return{state:s,sources,modular,identities,encounters,...ids};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const { fixture, payment, definition, sourceCodes, isPlayerDeckPiece, stats } =
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
        ...(p.spiderHamIdentity ? [p.spiderHamIdentity] : []),
        ...(p.spdrIdentity ? [p.spdrIdentity] : []),
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
    ...f.encounters,
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
  for (const identity of f.identities) {
    const matches = pieces.filter((p) => p.id === identity.id);
    assert.equal(matches.length, 1, `${label}: stable physical identity`);
    assert.ok(
      identity.codes.includes(matches[0].code),
      `${label}: actual current identity face`,
    );
  }
  assert.deepEqual(f.encounters.map((p) => p.code).sort(), [
    "31025",
    "31026",
    "31027",
    "31028",
    "31028",
    "31028",
  ]);
  for (const source of f.sources) {
    assert.equal(source.cards.length, 40);
    assert.equal(new Set(source.cards.map((p) => p.id)).size, 40);
    assert.deepEqual(
      source.cards.map((p) => p.code).sort(),
      source.codes,
      `${label}: exact declared source forty`,
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
  assert.equal(f.modular.length, 8);
  assert.deepEqual([...new Set(f.modular.map((p) => p.code))].sort(), [
    "31030",
    "31031",
    "31032",
    "31033",
    "31034",
    "31035",
    "31036",
    "31037",
  ]);
}
if (process.env.SPDR_FIXTURE_CHECK) {
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
const styleAssets = new Set();
let context, page, current, byteRequest;
function assetProxy() {
  const configured = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  assert.ok(configured, "The opt-in asset proxy must be configured");
  let parsed;
  try {
    parsed = new URL(configured);
  } catch {
    throw Error("The configured asset proxy URL is invalid");
  }
  assert.ok(
    ["http:", "https:"].includes(parsed.protocol),
    "The configured asset proxy must use HTTP or HTTPS",
  );
  return {
    server: parsed.origin,
    username: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
  };
}
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function open(f, width) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width > 1000 ? 1000 : 844 },
    reducedMotion: "reduce",
    ignoreHTTPSErrors: process.env.SPDR_IGNORE_HTTPS_ERRORS === "1",
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("spdr-fixture-loaded")) return;
    sessionStorage.setItem("spdr-fixture-loaded", "yes");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
  }, f?.state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const src of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((s) => s.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(src)) entryAssets.add(src);
  for (const href of await page
    .locator('link[rel="stylesheet"][href]')
    .evaluateAll((links) => links.map((link) => link.href)))
    if (/\/assets\/index-[^/]+\.css$/.test(href)) styleAssets.add(href);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  assert.ok(styleAssets.size <= 1, "One immutable production stylesheet");
  if (process.env.SPDR_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.SPDR_ASSET),
      ),
      "Expected immutable production entry",
    );
    assert.equal(
      styleAssets.size,
      1,
      "An actual production stylesheet is loaded",
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
  const index = state.prompt.options.findIndex(
    (option) =>
      option.id === id || option.id === `${state.activePlayerId}:${id}`,
  );
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
    if (
      state.prompt.options.some(
        (option) =>
          predicate(option) ||
          (option.id.startsWith(state.activePlayerId + ":") &&
            predicate({
              ...option,
              id: option.id.slice(state.activePlayerId.length + 1),
            })),
      )
    )
      return state;
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
  if (["won", "lost"].includes(before.phase)) {
    await page.locator("#start-btn").waitFor();
    assert.equal(
      await page.getByRole("button", { name: /Resume mission/ }).count(),
      0,
      "A completed mission never offers an active resume",
    );
  } else await page.getByRole("button", { name: /Resume mission/ }).click();
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
  const state = await settle();
  // Native choices resolve automatically when there is exactly one legal target.
  // Each caller still verifies the actual source/target's resulting state.
  if (!state.prompt) return state;
  if (
    state.prompt.kind === "choice" &&
    state.prompt.options.every((option) =>
      /^(yes|skip|no|pass)$/.test(option.id),
    )
  )
    return state;
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
  if (f) conserved(state, f, name);
  if (f) {
    const spdr = seat(state, "p1");
    assert.equal(spdr.spdrSuitId, f.suitId, "Stable independent suit ID");
    assert.equal(spdr.spdrPilotId, f.pilotId, "Stable independent pilot ID");
    assert.equal(
      spdr.spdrIdentity.id,
      spdr.form === "hero" ? f.suitId : f.pilotId,
    );
    if (state.heroId === "spdr") {
      const identities = page.getByRole("group", {
        name: "SP//dr physical identity cards",
        exact: true,
      });
      assert.equal(await identities.getAttribute("data-suit-id"), f.suitId);
      assert.equal(await identities.getAttribute("data-pilot-id"), f.pilotId);
      assert.equal(
        await identities.locator("span").nth(0).innerText(),
        "Suit: " +
          (physical(state, f.suitId).exhausted ? "exhausted" : "ready"),
      );
      assert.equal(
        await identities.locator("span").nth(1).innerText(),
        "Peni: " +
          (physical(state, f.pilotId).exhausted ? "exhausted" : "ready"),
      );
    }
  }
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
    playerActions: [
      ...document.querySelectorAll(
        ".flip-button, .hero-actions button, .in-play-actions button, .identity-card .ability-button",
      ),
    ]
      .filter((button) => button.getClientRects().length)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return {
          label: button.getAttribute("aria-label") || button.textContent,
          left: rect.left,
          right: rect.right,
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
    metrics.dialogs.every(
      (dialog) => dialog.top >= -1 && dialog.bottom <= metrics.height + 1,
    ),
    `${name}: dialog extends beyond viewport ${JSON.stringify(metrics.dialogs)}`,
  );
  assert.ok(
    metrics.encounterActions.every(
      (action) =>
        action.left >= Math.max(0, action.hostLeft) - 1 &&
        action.right <= Math.min(width, action.hostRight) + 1,
    ),
    `${name}: encounter action clipped ${JSON.stringify(metrics.encounterActions)}`,
  );
  assert.ok(
    metrics.playerActions.every(
      (action) => action.left >= -1 && action.right <= width + 1,
    ),
    `${name}: player action clipped ${JSON.stringify(metrics.playerActions)}`,
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

const name = (code) => definition({ code }).name;
async function optional(title, yes = true) {
  for (let n = 0; n < 15; n++) {
    const state = await save();
    assert.equal(state.prompt?.kind, "choice", title + " native choice");
    if (state.prompt.title === title) {
      const id = yes
        ? "yes"
        : state.prompt.options.find((o) => /^(skip|no|pass)$/.test(o.id))?.id;
      assert.ok(id, title + " has an explicit decline option");
      return choice(id);
    }
    const pass = state.prompt.options.find((o) =>
      /^(pass|skip|no|continue)$/.test(o.id),
    );
    assert.ok(pass, title + ": blocking " + JSON.stringify(state.prompt));
    await choice(pass.id);
  }
  throw Error("Native optional response not reached: " + title);
}
async function sourceAction(code, label) {
  const host = page
    .locator(".in-play-card")
    .filter({ has: page.locator(`img[src*="${code}"]`) });
  assert.equal(await host.count(), 1, "One original in-play source " + code);
  await host
    .locator(".in-play-actions")
    .getByRole("button", { name: label })
    .click();
  return settle();
}
async function flip() {
  await page.locator(".flip-button").click();
  return settle();
}
async function paidEvent(code, ids) {
  let state = await play(name(code));
  if (state.prompt?.kind === "payment") state = await pay(ids);
  return state;
}
function originalSources(state) {
  return state.players.map((seat) => {
    const p = seat.id === state.activePlayerId ? state.player : seat.player;
    return {
      seatId: seat.id,
      heroId: seat.heroId,
      cards: [...p.hand, ...p.deck, ...p.discard, ...p.inPlay]
        .filter(isPlayerDeckPiece)
        .map(({ id, code }) => ({ id, code })),
      codes: sourceCodes(seat.heroId),
      provenance: "Original source starter",
    };
  });
}

// Browser scenarios are populated after the native interfaces are fixed.
const sync = (id) => `spdr-sync:${id}`;
const physical = (state, id) =>
  allPieces(state).find((piece) => piece.id === id);
async function window(name, width, fixture) {
  await checkpoint(name, width, fixture);
  await reload();
  return save();
}
async function selectOption(predicate, label) {
  const state = await findChoice(predicate, label);
  const selected = state.prompt.options.find((option) => predicate(option));
  assert.ok(selected, label);
  return choice(selected.id);
}
async function identityAction(label) {
  await page.getByRole("button", { name: label }).click();
  return settle();
}
async function clarityAttachmentVisible(f, label) {
  const attached = page.locator(
    '.attached-cards[aria-label="Attached to SP//dr Suit"]',
  );
  assert.equal(
    await attached.count(),
    1,
    label + ": one actual suit attachment group",
  );
  assert.equal(
    await attached
      .getByRole("button", {
        name: "Inspect Clarity of Purpose, attached to SP//dr Suit",
        exact: true,
      })
      .isVisible(),
    true,
    label + ": actual Clarity is visible",
  );
  assert.equal(
    await attached
      .getByRole("button", {
        name: "Inspect SP//dr, attached to SP//dr Suit",
        exact: true,
      })
      .isVisible(),
    true,
    label + ": the actual physical Pilot shares this group",
  );
  assert.equal(await attached.locator('img[src*="31002b"]').count(), 1);
  const state = await save();
  assert.equal(physical(state, f.pilotId).code, "31002b");
  assert.equal(physical(state, f.pilotId).attachedTo, f.suitId);
  assert.equal(physical(state, f.upgradeId).attachedTo, "hero:p1");
}
async function enemyAction(id) {
  for (let n = 0; n < 40; n++) {
    const state = await save();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", "Native indirect assignment");
    if (
      /indirect|assign|damage/i.test(
        state.prompt.title + " " + state.prompt.text,
      )
    ) {
      const target = id || `hero:${state.activePlayerId}`;
      const option = state.prompt.options.find(
        (option) =>
          option.id === target ||
          option.id.startsWith(target + ":") ||
          (option.id === "hero" && target === `hero:${state.activePlayerId}`),
      );
      assert.ok(
        option,
        "Actual native damage recipient: " + JSON.stringify(state.prompt),
      );
      if (option.id === "hero")
        assert.ok(
          option.effects.every(
            (effect) =>
              (!effect.actorId || effect.actorId === state.activePlayerId) &&
              (!effect.zzzaxBatchOwner ||
                effect.zzzaxBatchOwner === state.activePlayerId),
          ),
          "The local hero alias belongs to the actual active damage recipient",
        );
      await choice(option.id);
    } else return finishChoices();
  }
  throw Error("Native damage assignment did not finish");
}
async function paidWindow(code, ids, kind, width, f) {
  const state = await play(name(code));
  if (state.prompt?.kind === "payment") {
    await window(kind + "-actual-payment", width, f);
    return pay(ids);
  }
  return state;
}
async function publicSource(width) {
  current = { kind: "public-source", width };
  await open(null, width);
  await page
    .getByRole("button", { name: /All heroes & starter decks/ })
    .click();
  const catalog = page.getByRole("dialog", {
    name: "All heroes & starter decks",
  });
  await catalog
    .getByRole("textbox", { name: "Search heroes and products" })
    .fill("SP//dr");
  await catalog
    .locator(".catalog-hero-row")
    .filter({ has: page.locator("b", { hasText: /^SP\/\/dr(?: Suit)?$/ }) })
    .first()
    .click();
  await catalog
    .locator(".catalog-hero-detail")
    .getByRole("button", { name: /Choose SP\/\/dr.*for mission/ })
    .click();
  await page.getByRole("button", { name: /View 40-card deck/ }).click();
  assert.match(
    await page.locator(".deck-provenance").innerText(),
    /Source preconstructed list: SP\/\/dr Suit Starter Deck/,
  );
  await checkpoint("public-original-protection-deck", width);
  await page.keyboard.press("Escape");
  await page
    .getByLabel("Modular encounter")
    .selectOption("ironspider_sinister");
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  await settle();
  const state = await finishChoices();
  assert.equal(state.heroId, "spdr");
  assert.equal(state.aspect, "protection");
  assert.equal(state.player.form, "alter");
  assert.equal(state.player.spdrIdentity.code, "31002a");
  assert.equal(state.player.hand.length, 4);
  const f = {
    sources: originalSources(state),
    suitId: state.player.spdrSuitId,
    pilotId: state.player.spdrPilotId,
    identities: [
      { id: state.player.spdrSuitId, codes: ["31001a", "31001b"] },
      { id: state.player.spdrPilotId, codes: ["31002a", "31002b"] },
    ],
    modular: allPieces(state)
      .filter((p) => definition(p).set_code === "ironspider_sinister")
      .map(({ id, code }) => ({ id, code })),
    encounters: allPieces(state)
      .filter((p) => ["31025", "31026", "31027", "31028"].includes(p.code))
      .map(({ id, code }) => ({ id, code })),
  };
  await window("public-two-independent-identities", width, f);
  checks.push({
    kind: "public-source",
    width,
    sourceCards: 40,
    identityCards: 2,
    obligationAndNemesis: 6,
    modularCards: 8,
    exactReload: true,
  });
}
try {
  if (!process.env.SPDR_FIXTURE_ONLY)
    for (const width of widths) await publicSource(width);
  for (const kind of scenarios)
    for (const width of widths) {
      current = { kind, width };
      const f = fixture(kind);
      conserved(f.state, f, kind + " initial");
      await open(f, width);
      let state = await save();
      if (state.prompt?.options?.some((option) => option.id === "go"))
        state = await choice("go");
      if (kind === "maintenance") {
        assert.equal(physical(state, f.suitId).exhausted, false);
        assert.equal(state.player.exhausted, false);
        state = await identityAction(/Maintenance/);
        assert.ok(
          f.drawIds.every((id) => state.player.hand.some((p) => p.id === id)),
        );
        assert.equal(physical(state, f.suitId).exhausted, true);
        assert.equal(physical(state, f.pilotId).exhausted, false);
        assert.equal(
          state.player.exhausted,
          false,
          "Maintenance exhausts the suit, never Peni",
        );
        await window(kind + "-suit-only-exhaustion", width, f);
        state = await flip();
        assert.equal(
          state.player.exhausted,
          true,
          "Flipping preserves the exhausted physical suit",
        );
        assert.equal(physical(state, f.pilotId).exhausted, false);
      } else if (kind === "pilot-flip") {
        await paidWindow("31023", [sync(f.pilotId)], kind, width, f);
        state = await finishChoices();
        assert.equal(physical(state, f.pilotId).exhausted, true);
        assert.equal(physical(state, f.suitId).exhausted, false);
        await window(kind + "-pilot-paid-resource", width, f);
        state = await flip();
        assert.equal(state.player.spdrIdentity.id, f.pilotId);
        assert.equal(
          state.player.exhausted,
          true,
          "Exhausted Pilot becomes exhausted Peni",
        );
        assert.equal(
          physical(state, f.suitId).exhausted,
          false,
          "Flipping never exhausts the other physical card",
        );
      } else if (kind === "sync-cancel") {
        state = await play(name("31006"));
        assert.equal(state.prompt.kind, "payment");
        await (await paymentSource(sync(f.pilotId))).click();
        await window(kind + "-selected-interface-uncommitted", width, f);
        state = await save();
        assert.equal(physical(state, f.pilotId).exhausted, false);
        assert.equal(physical(state, f.linkId).exhausted, false);
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        state = await settle();
        assert.ok(state.player.hand.some((p) => p.id === f.eventId));
        assert.equal(physical(state, f.pilotId).exhausted, false);
        await paidWindow(
          "31006",
          [sync(f.pilotId), sync(f.linkId)],
          kind + "-retry",
          width,
          f,
        );
        await target(state.villain.id);
        state = await finishChoices();
        assert.equal(state.villain.hp, 45);
        assert.equal(state.villain.stunned, true);
        assert.equal(physical(state, f.pilotId).exhausted, true);
        assert.equal(physical(state, f.linkId).exhausted, true);
      } else if (kind === "rapid-deployment") {
        state = await paidWindow(
          "31005",
          [sync(f.pilotId), sync(f.linkId)],
          kind,
          width,
          f,
        );
        await window(kind + "-first-native-removal", width, f);
        await target(f.schemeId);
        state = await save();
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          2,
        );
        await window(kind + "-second-native-removal", width, f);
        await target("main");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 3);
      } else if (kind === "web-trap") {
        await paidWindow(
          "31006",
          [sync(f.pilotId), sync(f.linkId)],
          kind,
          width,
          f,
        );
        state = await target(state.villain.id);
        state = await finishChoices();
        assert.equal(state.villain.hp, 45);
        assert.equal(state.villain.stunned, true);
      } else if (kind === "venom") {
        await paidWindow("31003", f.interfaceIds.map(sync), kind, width, f);
        await window(kind + "-actual-sync-receipt", width, f);
        state = await optional("VEN#m");
        assert.equal(physical(state, f.eventId).counters, 4);
        assert.ok(state.player.inPlay.some((p) => p.id === f.eventId));
        assert.ok(f.interfaceIds.every((id) => physical(state, id).exhausted));
        assert.equal(
          physical(state, f.pilotId).exhausted,
          false,
          "Only the four actually selected Interfaces exhaust",
        );
        await sourceAction("31003", /thwart/i);
        state = await target("main");
        state = await finishChoices();
        assert.equal(
          state.scheme.threat,
          1,
          "VEN#m actually thwarts five with four paid sym counters",
        );
        assert.equal(physical(state, f.eventId).damage, 1);
      } else if (kind === "systems-ready") {
        await paidWindow("31004", f.resourceIds, kind, width, f);
        await window(kind + "-printed-mode-choice", width, f);
        state = await choice("ready");
        assert.ok(
          [...f.interfaceIds, f.pilotId].every(
            (id) => !physical(state, id).exhausted,
          ),
        );
      } else if (kind === "systems-search") {
        await paidWindow("31004", f.resourceIds, kind, width, f);
        await choice("search");
        await window(kind + "-physical-discard-search", width, f);
        state = await target(f.interfaceId);
        assert.ok(state.player.hand.some((p) => p.id === f.interfaceId));
        assert.ok(!state.player.discard.some((p) => p.id === f.interfaceId));
      } else if (kind.startsWith("may-")) {
        state = await sourceAction("31007", /Aunt May/);
        state = await finishChoices();
        assert.ok(state.player.hand.some((p) => p.id === f.topIds[0]));
        assert.ok(state.player.discard.some((p) => p.id === f.topIds[1]));
        if (kind === "may-alter")
          assert.ok(state.player.hand.some((p) => p.id === f.topIds[2]));
        assert.equal(physical(state, f.supportId).exhausted, true);
      } else if (kind === "command-draw") {
        await sourceAction("31009", /draw 1/);
        await window(kind + "-interface-cost", width, f);
        state = await target(f.interfaceId);
        assert.ok(state.player.hand.some((p) => p.id === f.drawId));
        assert.equal(physical(state, f.supportId).exhausted, true);
        assert.equal(physical(state, f.interfaceId).exhausted, true);
      } else if (kind === "command-ready") {
        await sourceAction("31009", /discard a card/);
        await window(kind + "-actual-hand-cost", width, f);
        await target(f.discardId);
        await window(kind + "-exhausted-interface-target", width, f);
        state = await target(f.interfaceId);
        assert.ok(state.player.discard.some((p) => p.id === f.discardId));
        assert.equal(physical(state, f.interfaceId).exhausted, false);
        assert.equal(physical(state, f.supportId).exhausted, true);
      } else if (kind === "host-ready") {
        state = await sourceAction("31010", /Host Spider/);
        assert.equal(state.player.exhausted, false);
        assert.equal(physical(state, f.suitId).exhausted, false);
        assert.equal(physical(state, f.upgradeId).exhausted, true);
      } else if (kind === "psychic-thwart" || kind === "fluid-attack") {
        const power = kind === "psychic-thwart" ? "thwart" : "attack";
        await basic(power);
        await findChoice(
          (o) => o.id === f.interfaceId,
          "Actual Interface interrupt",
        );
        await window(kind + "-optional-interface-interrupt", width, f);
        await choice(f.interfaceId);
        state = await target(power === "thwart" ? "main" : state.villain.id);
        state = await finishChoices();
        assert.equal(
          power === "thwart" ? state.scheme.threat : state.villain.hp,
          power === "thwart" ? 2 : 46,
        );
        assert.equal(physical(state, f.interfaceId).exhausted, true);
        assert.equal(state.player.exhausted, true);
      } else if (kind === "alloy-defense") {
        await defense();
        await choice("hero");
        await findChoice(
          (o) => o.id === f.interfaceId,
          "Actual Alloy defense interrupt",
        );
        await window(kind + "-defense-interface-interrupt", width, f);
        await choice(f.interfaceId);
        state = await finishChoices();
        assert.equal(
          state.player.hp,
          14,
          "Actual four DEF prevents Rhino two plus two boost",
        );
        assert.equal(physical(state, f.interfaceId).exhausted, true);
        assert.equal(state.player.exhausted, true);
      } else if (kind === "ejection") {
        state = await sourceAction("31008", /Ejection Protocol/);
        state = await finishChoices();
        assert.equal(state.player.form, "alter");
        assert.equal(state.player.hp, 6);
        assert.equal(state.player.tough, true);
        assert.equal(state.player.spdrIdentity.id, f.pilotId);
        assert.equal(state.player.exhausted, true);
        assert.ok(f.interfaceIds.every((id) => physical(state, id).exhausted));
        assert.ok(state.player.discard.some((p) => p.id === f.supportId));
      } else if (kind === "pool-daredevil") {
        await defense();
        await window(kind + "-actual-ally-defense", width, f);
        await choice(f.allyId);
        await window(kind + "-completed-defense-response", width, f);
        state = await optional("Daredevil");
        state = await finishChoices();
        assert.equal(state.villain.hp, 49);
        assert.equal(physical(state, f.allyId).damage, 1);
        assert.equal(state.player.hp, 14);
      } else if (kind === "pool-noir") {
        await window(kind + "-actually-resolved-treachery", width, f);
        state = await optional("Spider-Man Noir");
        state = await finishChoices();
        const ally = physical(state, f.allyId);
        assert.equal(ally.storedCards.length, 1);
        assert.equal(ally.storedCards[0].id, f.encounterId);
        assert.equal(state.villain.hp, 50);
        assert.equal(
          await page.locator(`.in-play-card img[src*="01104"]`).count(),
          0,
          "Noir never exposes facedown encounter art",
        );
        assert.equal(
          await page
            .getByRole("button", { name: /Inspect Hard to Keep Down attached/ })
            .count(),
          0,
          "Noir facedown card has no face-revealing inspect control",
        );
        await sourceAction("31015", /thwart/i);
        state = await target("main");
        state = await finishChoices();
        assert.equal(
          state.scheme.threat,
          5,
          "Noir's actual X THW equals the one original facedown treachery",
        );
        assert.equal(physical(state, f.allyId).damage, 1);
      } else if (kind === "pool-repurpose") {
        await paidWindow("31016", [], kind, width, f);
        await window(kind + "-actual-tech-discard-cost", width, f);
        await target(f.upgradeId);
        await window(kind + "-chosen-power", width, f);
        state = await choice("attack");
        assert.equal(state.player.exhausted, false);
        assert.equal(stats(state).attack, 4);
        assert.ok(state.player.discard.some((p) => p.id === f.upgradeId));
      } else if (kind === "pool-thwip") {
        await paidWindow("31017", f.resourceIds, kind, width, f);
        state = await save();
        assert.equal(state.prompt.title, "Thwip Thwip! · deal 1 damage");
        assert.equal(state.player.hp, 14);
        assert.equal(state.player.tough, true);
        assert.ok(f.enemyIds.every((id) => !physical(state, id).stunned));
        await window(kind + "-real-deal-damage-cost", width, f);
        await target("hero:p1");
        state = await save();
        assert.equal(state.player.tough, false);
        assert.equal(
          state.player.hp,
          12,
          "The simultaneous cost consumes Tough before MORBIUS deals two",
        );
        assert.equal(physical(state, f.morbiusId).damage, 0);
        assert.ok(f.enemyIds.every((id) => !physical(state, id).stunned));
        await window(kind + "-first-stun-target", width, f);
        await target(f.enemyIds[0]);
        await window(kind + "-second-stun-target", width, f);
        state = await target(f.enemyIds[1]);
        assert.equal(state.player.hp, 12);
        assert.ok(
          f.enemyIds.every(
            (id) =>
              physical(state, id).stunned &&
              physical(state, id).stunCards === 1,
          ),
        );
        for (const id of [f.eventId, ...f.resourceIds])
          assert.equal(
            state.player.discard.filter((p) => p.id === id).length,
            1,
          );
        await window(kind + "-tough-before-morbius-result", width, f);
        assert.notEqual(f.eventId, f.secondEventId);
        assert.ok(state.player.hand.some((p) => p.id === f.secondEventId));
        await paidWindow(
          "31017",
          [sync(f.pilotId), sync(f.interfaceId)],
          kind + "-naked",
          width,
          f,
        );
        state = await save();
        assert.equal(state.prompt.title, "Thwip Thwip! · deal 1 damage");
        assert.equal(state.player.hp, 12);
        assert.equal(state.player.tough, false);
        await window(kind + "-naked-real-deal-damage-cost", width, f);
        const damageLogStart = state.log.length;
        await target("hero:p1");
        state = await save();
        assert.equal(state.player.hp, 9);
        const actualDamage = state.log
          .slice(damageLogStart)
          .flatMap((entry) => {
            const match = /^You take (\d+) damage\.$/.exec(entry.text);
            return match ? [Number(match[1])] : [];
          });
        assert.equal(
          actualDamage[0],
          1,
          "The naked Thwip cost deals one first",
        );
        assert.equal(
          actualDamage.reduce((sum, amount) => sum + amount, 0),
          3,
        );
        await window(kind + "-naked-first-stun-target", width, f);
        await target(f.morbiusId);
        await window(kind + "-naked-second-stun-target", width, f);
        state = await target(state.villain.id);
        assert.equal(state.player.hp, 9);
        assert.equal(state.villain.stunned, true);
        assert.equal(state.villain.stunCards, 1);
        assert.ok(
          [...f.enemyIds, f.morbiusId].every(
            (id) =>
              physical(state, id).stunned &&
              physical(state, id).stunCards === 1,
          ),
        );
        assert.equal(
          state.player.discard.filter((p) => p.id === f.secondEventId).length,
          1,
        );
        for (const id of [f.pilotId, f.interfaceId])
          assert.equal(physical(state, id).exhausted, true);
      } else if (kind === "pool-barrier") {
        await findChoice(
          (o) => o.id === f.upgradeId,
          "Actual Energy Barrier prevention",
        );
        await window(kind + "-native-damage-interrupt", width, f);
        await choice(f.upgradeId);
        state = await target(state.villain.id);
        state = await finishChoices();
        assert.equal(state.player.hp, 12);
        assert.equal(state.villain.hp, 49);
        assert.equal(physical(state, f.upgradeId).counters, 2);
      } else if (kind === "pool-forcefield") {
        state = await finishChoices();
        assert.equal(state.player.hp, 12);
        assert.ok(
          state.player.discard.some((p) => p.id === f.upgradeId),
          "Six real counters prevent six and depleted Uses discards",
        );
      } else if (kind.startsWith("pool-tingle-")) {
        await findChoice(
          (o) => o.id === f.upgradeId,
          "Spider-Tingle would-reveal interrupt",
        );
        await window(kind + "-blind-would-reveal", width, f);
        await choice(f.upgradeId);
        assert.equal(
          await page
            .locator(`img[src*="${physical(state, f.encounterId).code}"]`)
            .evaluateAll(
              (images) =>
                images.filter((image) => image.getClientRects().length).length,
            ),
          0,
          "Choose the actual damage cost before the encounter face is exposed",
        );
        await window(kind + "-real-web-warrior-damage-cost", width, f);
        await target("hero:p1");
        state = await finishChoices();
        assert.equal(state.player.hp, 13);
        if (kind === "pool-tingle-treachery") {
          assert.equal(state.villain.hp, 46);
          assert.ok(state.player.discard.some((p) => p.id === f.upgradeId));
          assert.ok(
            state.encounter.discard.some((p) => p.id === f.encounterId),
          );
        } else {
          assert.ok(state.player.inPlay.some((p) => p.id === f.upgradeId));
          assert.ok(state.minions.some((p) => p.id === f.encounterId));
        }
      } else if (kind === "pool-ham") {
        await sourceAction("31021", /thwart/i);
        state = await target("main");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 4);
        assert.ok(
          state.player.discard.some((p) => p.id === f.allyId),
          "Consequential one then three actual boost icons defeats Ham",
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
      } else if (kind === "pool-spider-man") {
        await paidWindow(
          "31022",
          [sync(f.pilotId), sync(f.interfaceId)],
          kind,
          width,
          f,
        );
        await window(kind + "-played-from-hand-response", width, f);
        await optional("Spider-Man · Otto Octavius");
        await window(kind + "-actual-tech-upgrade", width, f);
        state = await target(f.upgradeId);
        assert.equal(physical(state, f.upgradeId).exhausted, false);
        assert.ok(state.player.hand.some((p) => p.id === f.drawId));
      } else if (kind === "pool-stamina") {
        state = await paidWindow("31023", [sync(f.pilotId)], kind, width, f);
        state = await finishChoices();
        assert.equal(state.player.exhausted, false);
        assert.equal(physical(state, f.suitId).exhausted, false);
      } else if (kind === "pool-unshakable") {
        await paidWindow("31024", [sync(f.pilotId)], kind, width, f);
        state = await finishChoices();
        assert.ok(state.player.inPlay.some((p) => p.id === f.eventId));
        await beginVillainPhase();
        state = await finishChoices();
        assert.equal(
          state.player.stunCards,
          1,
          "Printed Steady requires two stun cards",
        );
        assert.equal(
          state.player.stunned,
          false,
          "One actual Stampede stun never stuns a Steady identity",
        );
        assert.equal(state.player.hp, 8);
        await window(kind + "-one-stun-is-not-stunned", width, f);
        await basic("attack");
        state = await target(state.villain.id);
        state = await finishChoices();
        assert.equal(
          state.villain.hp,
          48,
          "The Steady identity's actual basic attack still resolves",
        );
      } else if (kind === "pool-clarity") {
        await clarityAttachmentVisible(f, "Before actual payment");
        state = await play(name("31023"));
        const source = payment(state).find((p) => p.code === "31029");
        assert.ok(source, "Actual supplementary Clarity native Wild source");
        await window(kind + "-real-attached-character-resource", width, f);
        state = await pay([source.id]);
        state = await finishChoices();
        assert.equal(state.player.hp, 13);
        assert.equal(state.player.exhausted, false);
        assert.equal(physical(state, f.upgradeId).exhausted, true);
      } else if (kind === "obligation-remove") {
        await window(kind + "-owner-form-choice", width, f);
        await choice("flip");
        await window(kind + "-actual-peni-exhaustion", width, f);
        state = await choice("remove");
        assert.equal(state.player.form, "alter");
        assert.equal(state.player.exhausted, true);
        assert.ok(state.removed.some((p) => p.id === f.encounterId));
        assert.equal(physical(state, f.suitId).exhausted, false);
      } else if (kind === "obligation-discard") {
        await choice("continue");
        await window(kind + "-nonpermanent-interface-cost", width, f);
        state = await choice(f.interfaceId);
        state = await finishChoices();
        assert.ok(state.player.discard.some((p) => p.id === f.interfaceId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.encounterId));
        assert.ok(
          state.player.inPlay.some((p) => p.id === f.pilotId),
          "Permanent pilot is retained",
        );
      } else if (kind === "nemesis") {
        state = await finishChoices();
        assert.ok(state.minions.some((p) => p.code === "31027"));
        assert.ok(state.sideSchemes.some((p) => p.code === "31026"));
        assert.equal(
          state.encounter.deck.filter((p) => p.code === "31028").length,
          3,
        );
        assert.equal(
          state.player.setAside.filter((p) =>
            ["31026", "31027", "31028"].includes(p.code),
          ).length,
          0,
        );
      } else if (kind === "giant-cost") {
        state = await basic("thwart");
        if (state.prompt?.kind === "choice") {
          await target(f.schemeId);
          state = await save();
        }
        assert.equal(state.prompt.kind, "payment");
        assert.deepEqual(state.prompt.requirements, ["energy"]);
        assert.ok(
          state.prompt.after.some(
            (effect) =>
              effect.type === "thwart" &&
              effect.target === f.schemeId &&
              effect.amount === 2 &&
              effect.basic === true &&
              effect.spdrThwartCostPaid === true,
          ),
          "Actual sole Crisis target waits for its additional Energy cost",
        );
        await window(kind + "-additional-energy-resource-cost", width, f);
        state = await pay([sync(f.interfaceId)]);
        state = await finishChoices();
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          2,
        );
      } else if (kind === "morbius-sync") {
        await paidWindow(
          "31006",
          [sync(f.pilotId), sync(f.interfaceId)],
          kind,
          width,
          f,
        );
        state = await save();
        assert.equal(
          state.player.hp,
          12,
          "Actual generated resources cause the nemesis damage before Web-Trap",
        );
        await window(kind + "-resource-generation-before-action", width, f);
        await target(state.villain.id);
        state = await finishChoices();
        assert.equal(state.villain.hp, 45);
        assert.equal(state.villain.stunned, true);
      } else if (kind === "drain-energy") {
        await window(kind + "-printed-choice", width, f);
        await choice("pay");
        await window(kind + "-actual-two-energy-payment", width, f);
        state = await pay(f.resourceIds);
        state = await finishChoices();
        assert.equal(state.player.hp, 14);
        assert.ok(
          f.resourceIds.every((id) =>
            state.player.discard.some((p) => p.id === id),
          ),
        );
      } else if (kind === "drain-damage" || kind === "drain-alter") {
        await window(kind + "-printed-choice", width, f);
        state = await choice("other");
        state = await finishChoices();
        if (kind === "drain-damage") assert.equal(state.player.hp, 11);
        else {
          assert.equal(state.player.hp, 14);
          assert.equal(state.player.exhausted, true);
          assert.equal(physical(state, f.suitId).exhausted, false);
        }
      } else if (kind === "module-grand") {
        await basic("thwart");
        state = await save();
        assert.ok(
          !state.prompt?.options?.some((o) => o.id === f.schemeId),
          "Grand Larceny cannot be selected while any Criminal is in play",
        );
        state = await target(f.secondSchemeId);
        state = await finishChoices();
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          5,
        );
        assert.equal(
          state.scheme.threat,
          6,
          "The actual Crisis icon keeps main threat blocked",
        );
        assert.equal(physical(state, f.secondSchemeId).counters, 3);
      } else if (kind === "module-bombshell") {
        await defense();
        await window(kind + "-actual-attack-defense", width, f);
        await choice("take");
        state = await finishChoices();
        assert.equal(state.player.hp, 13);
        assert.ok(
          f.allyIds.every((id) => physical(state, id).damage === 1),
          "Three attack damage divided evenly among three actual characters",
        );
      } else if (kind === "module-bombshell-remainder") {
        await defense();
        await choice("take");
        await window(kind + "-actual-even-division-remainder", width, f);
        state = await choice("hero:p1");
        state = await finishChoices();
        assert.equal(state.player.hp, 12);
        assert.equal(physical(state, f.allyId).damage, 1);
      } else if (kind === "module-bombshell-boost") {
        await defense();
        await choice("take");
        await window(kind + "-native-boost-indirect-assignment", width, f);
        state = await enemyAction();
        assert.equal(state.player.hp, 11);
        assert.equal(state.player.exhausted, true);
        assert.equal(
          physical(state, f.allyId).exhausted,
          false,
          "Only the actual boost damage recipient exhausts",
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
        assert.equal(
          seat(state, "p2").hp,
          9,
          "The same actual boost deals one indirect damage to the other living seat",
        );
        assert.equal(
          seat(state, "p2").exhausted,
          true,
          "Only actual positively damaged recipients exhaust",
        );
      } else if (kind === "module-electro") {
        await window(kind + "-actual-printed-energy-choice", width, f);
        state = await choice(f.resourceId);
        state = await finishChoices();
        assert.ok(
          state.attachments.some(
            (p) => p.id === f.resourceId && p.attachedTo === f.enemyId,
          ),
        );
        await minionStats("31032", 2, 4);
      } else if (kind === "module-hobgoblin") {
        assert.ok(
          !state.attack,
          "Hobgoblin replaces its attack before defense and boost draw",
        );
        await window(kind + "-replaced-attack-indirect", width, f);
        state = await enemyAction();
        assert.equal(state.player.hp, 8);
        assert.ok(
          f.discardIds.every((id) =>
            state.encounter.discard.some((p) => p.id === id),
          ),
        );
      } else if (kind === "module-iron-spider") {
        state = await finishChoices();
        const enemy = physical(state, f.enemyId);
        assert.equal(enemy.tough, true);
        assert.equal(enemy.toughCards ?? Number(enemy.tough), 1);
        const toughStatus = page
          .locator(".enemy-unit")
          .filter({ has: page.locator('.minion-card-face img[src*="31034"]') })
          .locator(".status-card.tough");
        assert.equal(await toughStatus.count(), 1);
        assert.equal(await toughStatus.isVisible(), true);
        await minionStats("31034", 2, 6);
        await basic("attack");
        state = await save();
        assert.ok(
          !state.prompt?.options?.some(
            (option) => option.id === state.villain.id,
          ),
          "Iron Spider's Guard blocks the villain target",
        );
        await window(kind + "-actual-guard-target", width, f);
        await target(f.enemyId);
        state = await finishChoices();
        assert.equal(
          state.player.hp,
          13,
          "Actual Retaliate one follows the attack even though Tough prevents its damage",
        );
        assert.equal(physical(state, f.enemyId).damage, 0);
        assert.equal(physical(state, f.enemyId).tough, false);
      } else if (kind === "module-iron-spider-overkill") {
        await defense();
        await window(kind + "-actual-overkill-ally-defense", width, f);
        await choice(f.allyId);
        state = await finishChoices();
        assert.ok(state.player.discard.some((piece) => piece.id === f.allyId));
        assert.equal(
          state.player.hp,
          13,
          "The actual Iron Spider attack overkills one damage through the one-HP ally",
        );
      } else if (kind === "module-sandman") {
        await basic("attack");
        await target(f.enemyId);
        state = await finishChoices();
        assert.equal(physical(state, f.enemyId).damage, 2);
        assert.ok(
          f.discardIds.every((id) =>
            state.encounter.discard.some((p) => p.id === id),
          ),
        );
      } else if (kind === "module-sandman-boost") {
        await defense();
        await choice("take");
        state = await finishChoices();
        assert.equal(state.player.hp, 11);
        assert.ok(
          [...f.discardIds, f.boostId].every((id) =>
            state.encounter.discard.some((p) => p.id === id),
          ),
        );
      } else if (
        kind === "module-spot-exact" ||
        kind === "module-spot-excess"
      ) {
        await basic("attack");
        await target(f.enemyId);
        state = await finishChoices();
        assert.ok(!state.minions.some((p) => p.id === f.enemyId));
        assert.equal(
          state.encounter.deck.some((p) => p.id === f.enemyId),
          kind === "module-spot-exact",
        );
        assert.equal(
          state.encounter.discard.some((p) => p.id === f.enemyId),
          kind === "module-spot-excess",
        );
      } else if (kind === "module-spot-boost") {
        await defense();
        await choice("take");
        state = await finishChoices();
        assert.equal(state.player.hp, 12);
        assert.ok(
          state.minions.some(
            (p) => p.id === f.boostId && p.engagedWith === "p1",
          ),
        );
        assert.ok(!state.encounter.discard.some((p) => p.id === f.boostId));
      } else if (kind === "module-surge") {
        state = await finishChoices();
        assert.ok(state.environments.some((p) => p.id === f.environmentId));
        assert.ok(state.minions.some((p) => p.id === f.enemyId && p.tough));
        assert.ok(state.encounter.discard.some((p) => p.id === f.surgeId));
        assert.equal(
          state.villain.hp,
          50,
          "Environment Surge reveals Criminal then granted Surge resolves actual next encounter",
        );
      } else if (kind === "module-surge-remove") {
        await page
          .getByRole("button", {
            name: /Spend 2 resources.*discard Surge in Crime/,
          })
          .click();
        state = await settle();
        assert.equal(state.prompt.kind, "payment");
        await window(kind + "-physical-environment-payment", width, f);
        state = await pay([sync(f.pilotId), sync(f.interfaceId)]);
        state = await finishChoices();
        assert.ok(!state.environments.some((p) => p.id === f.environmentId));
        assert.ok(
          state.encounter.discard.some((p) => p.id === f.environmentId),
        );
      } else throw Error("Unreviewed browser scenario: " + kind);
      state = await save();
      assert.ok(!state.error, state.error);
      await window(kind + "-native-result", width, f);
      if (kind === "pool-clarity")
        await clarityAttachmentVisible(
          f,
          "After actual payment and JSON reload",
        );
      checks.push({
        kind,
        width,
        sourceCards: f.sources.map((source) => ({
          seatId: source.seatId,
          cards: source.cards.length,
          provenance: source.provenance,
        })),
        identityCards: 2,
        obligationAndNemesis: 6,
        modularCards: 8,
        exactReload: true,
      });
      console.log("Verified native SP//dr " + kind + " at " + width + "px");
    }
  assert.deepEqual(errors, []);
  let assetRequest = context.request;
  if (process.env.SPDR_REQUEST_PROXY === "1") {
    byteRequest = await request.newContext({
      proxy: assetProxy(),
      ignoreHTTPSErrors: process.env.SPDR_IGNORE_HTTPS_ERRORS === "1",
    });
    assetRequest = byteRequest;
  }
  const entryProof = [],
    styleProof = [];
  for (const asset of entryAssets) {
    const response = await assetRequest.get(asset);
    assert.equal(
      response.status(),
      200,
      "Served immutable production entry bytes",
    );
    const sha256 = createHash("sha256")
      .update(await response.body())
      .digest("hex");
    if (process.env.SPDR_SHA256)
      assert.equal(
        sha256,
        process.env.SPDR_SHA256,
        "Actual production entry SHA256",
      );
    entryProof.push({ url: asset, sha256 });
  }
  for (const asset of styleAssets) {
    const response = await assetRequest.get(asset);
    assert.equal(response.status(), 200, "Served immutable stylesheet bytes");
    const sha256 = createHash("sha256")
      .update(await response.body())
      .digest("hex");
    if (process.env.SPDR_CSS_SHA256)
      assert.equal(
        sha256,
        process.env.SPDR_CSS_SHA256,
        "Actual production CSS SHA256",
      );
    styleProof.push({ url: asset, sha256 });
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
        styleAssets: [...styleAssets],
        styleProof,
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
      styleProof,
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
    await writeFile(
      `${output}/failure-save.json`,
      JSON.stringify(await save().catch(() => null), null, 2),
    ).catch(() => {});
    await writeFile(
      `${output}/failure-body.txt`,
      await page.locator("body").innerText(),
    ).catch(() => {});
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  if (byteRequest) await byteRequest.dispose();
  if (context) await context.close();
  await browser.close();
}
