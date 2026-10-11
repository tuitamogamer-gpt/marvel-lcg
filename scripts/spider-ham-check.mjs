import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.SPIDER_HAM_OUTPUT || "output/spider-ham/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const defaults = [
  "toon-damage",
  "toon-recovery",
  "toon-payment",
  "upgrades-ready",
  "hammer-overkill",
  "americat",
  "ham-it-up",
  "hogwashed-minion",
  "hogwashed-scheme",
  "swing",
  "petulant-pig",
  "cancel",
  "physics-hero",
  "physics-alter",
  "daily-beagle",
  "obligation-remove",
  "obligation-surge",
  "nemesis",
  "trap-defeat",
  "glider",
  "feast",
  "pool-lady",
  "pool-lady-overwatch-main",
  "pool-lady-overwatch-defeat",
  "pool-pavitr",
  "pool-overwatch",
  "pool-overwatch-simultaneous",
  "pool-scarlet",
  "pool-spdr-excess",
  "pool-spdr-exact",
  "pool-web-leave",
  "pool-requirement",
  "pool-warrior-custom",
  "pool-great-responsibility",
  "pool-making-entrance",
  "pool-entrance-trap",
  "pool-one-way",
  "pool-followed",
  "pool-team-building",
];
const scenarios = (process.env.SPIDER_HAM_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.SPIDER_HAM_VIEWPORTS || "1920,1440,1280,390")
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

// Focused positions use only the physical cards from a complete native setup.
// The supplementary Warrior case declares its one-card custom-deck substitution.
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card,heroStats} from './src/game/cards.ts';
import {activateSeat,seatView,syncSeat} from './src/game/team.ts';
import {spiderHamTraits} from './src/game/spider-ham.ts';
import {spiderHamPackCharacterTraits,spiderHamPackCharacterModifiers} from './src/game/spider-ham-pack.ts';
// Independently transcribed original Spider-Ham Starter Deck printings/quantities.
const originalHam=Object.entries({'30002':1,'30003':2,'30004':1,'30005':1,'30006':2,'30007':3,'30008':1,'30009':2,'30010':1,'30011':1,'30012':1,'30013':1,'30014':3,'30015':2,'30016':3,'30017':3,'30018':3,'30019':3,'30020':1,'30021':1,'30022':3,'30023':1}).flatMap(([code,count])=>Array(count).fill(code));
export function isPlayerDeckPiece(p){return ['event','resource','ally','support','upgrade'].includes(card(p)?.type_code);}
export function definition(p){return card(p);}
export function sourceCodes(id){return (id==='spiderham'?originalHam.slice():heroStarterCodes(id)).sort();}
export function stats(s){return heroStats(s);}
export function aerial(s){return spiderHamTraits(s).includes('Aerial');}
export function grantedWarrior(s){return spiderHamPackCharacterTraits(s,'hero:p1',{isTextBlank:()=>false}).includes('Web-Warrior');}
export function warriorAttack(s){return spiderHamPackCharacterModifiers(s,'hero:p1').attack;}
export function payment(s){const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);}
export function fixture(kind){
 const custom=kind==='pool-warrior-custom';
 const codes=heroStarterCodes('spiderham');if(custom){codes.splice(codes.indexOf('30018'),1,'30029');}
 const heroes=[{heroId:'spiderham',aspect:'justice',deckCards:codes,deckOrigin:custom?'custom':'source'},...(kind==='pool-web-leave'?[{heroId:'nova',aspect:'aggression',deckCards:heroStarterCodes('nova'),deckOrigin:'source'}]:[])];
 let s=newGame({...heroes[0],heroes,villainId:'rhino',module:'inheritors',seed:30001,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
 for(let n=0;s.phase==='mulligan'&&n<20;n++){if(s.prompt)throw Error('Unexpected native setup choice '+s.prompt.title);command({type:'MULLIGAN',ids:[]});}
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native Spider-Ham source setup incomplete');
 const sources=s.players.map(seat=>{const p=seatView(s,seat).player;const cards=[...p.hand,...p.deck,...p.discard,...p.inPlay].map(p=>({id:p.id,code:p.code}));if(cards.length!==40)throw Error('Native forty-card source missing');const expected=sourceCodes(seat.heroId);if(custom&&seat.heroId==='spiderham'){expected.splice(expected.indexOf('30018'),1,'30029');}return{seatId:seat.id,heroId:seat.heroId,cards,codes:expected.sort(),provenance:custom&&seat.heroId==='spiderham'?'Custom 40: original Spider-Ham Justice starter with one Followed replaced by supplementary Warrior of the Great Web':'Original source starter'};});
 const p=s.player,identity=p.spiderHamIdentity;if(!identity||identity.code!=='30001b')throw Error('Native stable Spider-Ham identity missing');
 const identities=[{id:identity.id,code:identity.code}];
 const modular=s.encounter.deck.filter(p=>card(p).set_code==='inheritors').map(p=>({id:p.id,code:p.code}));
 const encounters=[...s.encounter.deck,...(p.setAside||[])].filter(p=>['30024','30025','30026','30027','30028'].includes(p.code)).map(p=>({id:p.id,code:p.code}));
 if(modular.length!==9||encounters.length!==6)throw Error('Native module nine and obligation/nemesis six required');
 for(const seat of s.players){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=seat.heroId==='spiderham'?12:10;p.exhausted=false;p.flipped=false;if(p.spiderHamIdentity){p.spiderHamIdentity.code='30001a';p.spiderHamIdentity.counters=0;}}
 activateSeat(s,'p1');s.villain.hp=s.villain.maxHp=50;s.scheme.threat=6;s.queue=[];s.prompt=null;s.review=null;
 function player(id='p1'){return seatView(s,id).player;}
 function toon(n){player().spiderHamIdentity.counters=n;}
 function alter(){player().form='alter';player().spiderHamIdentity.code='30001b';}
 function take(code,id='p1'){const p=player(id);for(const zone of[p.hand,p.deck,p.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual source '+code+' for '+id);}
 function hand(codes,id='p1'){const ps=codes.map(code=>take(code,id));player(id).hand.push(...ps);return ps;}
 function put(code,id='p1'){const p=take(code,id);p.exhausted=false;player(id).inPlay.push(p);return p;}
 function top(codes,id='p1'){const ps=codes.map(code=>take(code,id));player(id).deck.unshift(...ps);return ps;}
 function encounter(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,...s.players.map(seat=>seatView(s,seat).player.setAside||[])]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual encounter '+code);}
 function minion(code){const p=encounter(code);p.engagedWith='p1';s.minions.push(p);return p;}
 function scheme(code='30030',amount=3){const p=encounter(code);p.counters=amount;s.sideSchemes.push(p);return p;}
 function native(effects){s.prompt={kind:'choice',title:'Resolve native source',text:'Resolve the actual source action.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code,fromDeck=false){const p=encounter(code);if(fromDeck){s.encounter.deck.unshift(p);native([{type:'revealNext'}]);}else{s.resolving.push(p);native([{type:'reveal',piece:p,skip:true}]);}return p;}
 function damage(amount){native([{type:'damage',target:'hero',amount,source:'browser-native-packet'}]);}
 let ids={identityId:identity.id};
 if(kind==='toon-damage'){native([{type:'damage',target:'hero',amount:3,source:'native-first-packet'},{type:'damage',target:'hero',amount:2,source:'native-second-packet'}]);}
 else if(kind==='toon-recovery'){alter();player().hp=4;}
 else if(['toon-payment','swing'].includes(kind)){toon(3);ids.eventId=hand(['30007'])[0].id;}
 else if(kind==='upgrades-ready'){toon(1);player().exhausted=true;ids.hammerId=put('30010').id;ids.webbingId=put('30011').id;}
 else if(kind==='hammer-overkill'){toon(1);ids.hammerId=put('30010').id;const p=minion('01101');p.damage=1;ids.enemyId=p.id;}
 else if(kind==='americat'){toon(3);ids.allyId=hand(['30002'])[0].id;const p=take('30003');player().discard.push(p);ids.shuffleId=p.id;}
 else if(kind==='ham-it-up'){toon(4);ids.eventId=hand(['30003'])[0].id;}
 else if(kind==='hogwashed-minion'){toon(2);ids.enemyId=minion('30038').id;ids.eventId=hand(['30004'])[0].id;}
 else if(kind==='hogwashed-scheme'){toon(1);ids.schemeId=scheme('30030',6).id;const[e,r]=hand(['30004','30007']);ids.eventId=e.id;ids.resourceIds=[r.id];}
 else if(kind==='petulant-pig'){ids.eventId=hand(['30006'])[0].id;ids.drawIds=top(['30008','30010','30011']).map(p=>p.id);const p=encounter('30031');s.encounter.deck.unshift(p);ids.boostId=p.id;}
 else if(kind==='cancel'){toon(2);ids.eventId=hand(['30005'])[0].id;ids.schemeId=scheme().id;ids.encounterId=reveal('30031',true).id;}
 else if(kind.startsWith('physics-')){if(kind==='physics-alter'){alter();toon(2);}ids.physicsId=put('30009').id;damage(6);}
 else if(kind==='daily-beagle'){alter();ids.supportId=put('30008').id;}
 else if(kind==='obligation-remove'){toon(2);ids.encounterId=reveal('30024').id;}
 else if(kind==='obligation-surge'){player().stunned=true;player().stunnedCards=1;const p=encounter('30031');s.encounter.deck.unshift(p);ids.surgeId=p.id;ids.encounterId=reveal('30024').id;}
 else if(kind==='nemesis'){toon(4);const a=put('30008'),b=put('30011'),c=put('30012');a.counters=2;b.counters=3;c.damage=1;c.stunned=true;c.stunnedCards=1;ids.supportId=a.id;ids.webbingId=b.id;ids.allyId=c.id;ids.encounterId=reveal('01190').id;}
 else if(kind==='trap-defeat'){toon(3);ids.schemeId=scheme('30025',3).id;const p=encounter('30026');s.encounter.discard.push(p);ids.enemyId=p.id;ids.eventId=hand(['30003'])[0].id;}
 else if(kind==='glider'){ids.enemyId=minion('30026').id;ids.encounterId=reveal('30027').id;}
 else if(kind==='feast'){player().confused=true;player().confusedCards=1;const p=encounter('30031');s.encounter.deck.unshift(p);ids.surgeId=p.id;ids.encounterId=reveal('30028').id;}
 else if(kind==='pool-lady'){ids.allyId=put('30012').id;ids.schemeId=scheme().id;}
 else if(kind==='pool-lady-overwatch-main'){ids.allyId=put('30012').id;const p=put('30019');p.attachedTo='main';ids.watchId=p.id;ids.schemeId=scheme('01107',1).id;}
 else if(kind==='pool-lady-overwatch-defeat'){ids.allyId=put('30012').id;ids.schemeId=scheme('01107',1).id;ids.secondSchemeId=scheme('30030',5).id;const p=put('30019');p.attachedTo=ids.schemeId;ids.watchId=p.id;}
 else if(kind==='pool-pavitr'){alter();ids.webId=put('30023').id;ids.spdrId=put('30021').id;const[a,...r]=hand(['30013','30003','30003','30007']);ids.allyId=a.id;ids.resourceIds=r.map(p=>p.id);}
 else if(kind==='pool-overwatch'){ids.schemeId=scheme().id;ids.eventId=hand(['30019'])[0].id;}
 else if(kind==='pool-overwatch-simultaneous'){toon(2);ids.schemeIds=[scheme('01107',2).id,scheme('30030',2).id];ids.watchIds=ids.schemeIds.map(id=>{const p=put('30019');p.attachedTo=id;return p.id;});ids.eventId=hand(['30014'])[0].id;}
 else if(kind==='pool-scarlet'){s.scheme.threat=4;ids.allyId=put('30020').id;ids.drawId=top(['30008'])[0].id;ids.encounterId=reveal('30031',true).id;}
 else if(kind.startsWith('pool-spdr-')){const p=put('30021');p.damage=kind==='pool-spdr-excess'?1:0;ids.allyId=p.id;}
 else if(kind==='pool-web-leave'){ids.webId=put('30023').id;const p=put('30012');p.damage=3;ids.allyId=p.id;ids.drawId=top(['28016'],'p2')[0].id;}
 else if(kind==='pool-requirement'){toon(2);ids.schemeIds=[scheme('30030',1).id,scheme('01107',1).id];ids.eventId=hand(['30014'])[0].id;}
 else if(kind==='pool-warrior-custom'){toon(1);const[u,a,w,r1,r2]=hand(['30029','30021','30023','30007','30007']);ids.upgradeId=u.id;ids.allyId=a.id;ids.webId=w.id;ids.resourceIds=[r1.id,r2.id];}
 else if(kind==='pool-great-responsibility'){ids.eventId=hand(['30015'])[0].id;native([{type:'threat',target:'main',amount:3}]);}
 else if(kind==='pool-making-entrance'){player().hp=8;s.scheme.threat=4;const[e,r]=hand(['30016','30007']);ids.eventId=e.id;ids.resourceIds=[r.id];}
 else if(kind==='pool-entrance-trap'){player().hp=2;ids.enemyId=minion('30026').id;ids.schemeId=scheme('30025',4).id;const[e,r]=hand(['30016','30022']);ids.eventId=e.id;ids.resourceIds=[r.id];}
 else if(kind==='pool-one-way'){ids.eventId=hand(['30017'])[0].id;ids.schemeId=s.encounter.deck.find(p=>p.code==='30030').id;ids.drawIds=top(['30008','30010','30011']).map(p=>p.id);}
 else if(kind==='pool-followed'){toon(1);ids.schemeId=scheme('30030',2).id;const[e,h]=hand(['30018','30003']);ids.eventId=e.id;ids.thwartId=h.id;}
 else if(kind==='pool-team-building'){toon(2);ids.supportId=put('30022').id;ids.allyId=hand(['30002'])[0].id;}
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
const {
  fixture,
  payment,
  definition,
  sourceCodes,
  isPlayerDeckPiece,
  stats,
  aerial,
  grantedWarrior,
  warriorAttack,
} = await import(pathToFileURL(fixturePath).href);

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
      ["30001a", "30001b"].includes(matches[0].code),
      `${label}: actual current identity face`,
    );
  }
  assert.deepEqual(f.encounters.map((p) => p.code).sort(), [
    "30024",
    "30025",
    "30026",
    "30027",
    "30028",
    "30028",
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
if (process.env.SPIDER_HAM_FIXTURE_CHECK) {
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
let context, page, current;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function open(f, width) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width > 1000 ? 1000 : 844 },
    reducedMotion: "reduce",
    ignoreHTTPSErrors: process.env.SPIDER_HAM_IGNORE_HTTPS_ERRORS === "1",
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("spider-ham-fixture-loaded")) return;
    sessionStorage.setItem("spider-ham-fixture-loaded", "yes");
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
  if (process.env.SPIDER_HAM_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.SPIDER_HAM_ASSET),
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
  if (f && state.heroId === "spiderham") {
    const counter = page.getByRole("group", {
      name: "Toon counters",
      exact: true,
    });
    assert.equal(
      await counter.getAttribute("data-identity-id"),
      state.player.spiderHamIdentity.id,
      "Visible counter belongs to the actual physical identity",
    );
    assert.equal(
      await counter.locator(".stat-token").getAttribute("aria-label"),
      "TOON: " + toonCount(state),
      "Accessible native toon count matches the actual counter state",
    );
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
        ".flip-button, .hero-actions button, .in-play-actions button",
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

const toonCount = (s) => Number(seat(s, "p1").spiderHamIdentity.counters || 0);
const toonSource = (f, index = 1) => `spider-ham-toon:${f.identityId}:${index}`;
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
      cards: [...p.hand, ...p.deck, ...p.discard, ...p.inPlay].map(
        ({ id, code }) => ({ id, code }),
      ),
      codes: sourceCodes(seat.heroId),
      provenance: "Original source starter",
    };
  });
}

try {
  if (!process.env.SPIDER_HAM_FIXTURE_ONLY) {
    for (const width of widths) {
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
        .fill("Spider-Ham");
      await catalog
        .locator(".catalog-hero-row")
        .filter({ has: page.locator("b", { hasText: /^Spider-Ham$/ }) })
        .first()
        .click();
      await catalog
        .locator(".catalog-hero-detail")
        .getByRole("button", {
          name: "Choose Spider-Ham for mission",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: /View 40-card deck/ }).click();
      assert.match(
        await page.locator(".deck-provenance").innerText(),
        /Source preconstructed list: Spider-Ham Starter Deck/,
      );
      await checkpoint("public-original-justice-deck", width);
      await page.keyboard.press("Escape");
      await page.getByLabel("Modular encounter").selectOption("inheritors");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      await settle();
      const state = await finishChoices();
      assert.equal(state.heroId, "spiderham");
      assert.equal(state.aspect, "justice");
      assert.equal(state.player.form, "alter");
      assert.equal(state.player.spiderHamIdentity.code, "30001b");
      assert.equal(toonCount(state), 0);
      const f = {
        sources: originalSources(state),
        identities: [{ id: state.player.spiderHamIdentity.id, code: "30001b" }],
        modular: allPieces(state)
          .filter((p) => definition(p).set_code === "inheritors")
          .map(({ id, code }) => ({ id, code })),
        encounters: allPieces(state)
          .filter((p) =>
            ["30024", "30025", "30026", "30027", "30028"].includes(p.code),
          )
          .map(({ id, code }) => ({ id, code })),
      };
      await checkpoint("public-original-source-board", width, f);
      await reload();
      checks.push({
        kind: "public-source",
        width,
        originalSourceCards: 40,
        identityCards: 1,
        obligationAndNemesis: 6,
        modularCards: 9,
        exactReload: true,
      });
    }
  }
  for (const kind of scenarios)
    for (const width of widths) {
      current = { kind, width };
      const f = fixture(kind);
      conserved(f.state, f, kind + " initial");
      await open(f, width);
      let state = await save();
      if (state.prompt?.options?.some((o) => o.id === "go"))
        state = await choice("go");
      if (kind === "toon-damage") {
        assert.equal(state.player.hp, 9);
        assert.equal(
          toonCount(state),
          0,
          "Damage does not grant an automatic toon",
        );
        await checkpoint(kind + "-optional-first-packet", width, f);
        await reload();
        state = await optional("Spider-Nonsense", false);
        assert.equal(state.player.hp, 7);
        assert.equal(toonCount(state), 0);
        state = await optional("Spider-Nonsense");
        assert.equal(
          toonCount(state),
          1,
          "One optional toon per actual damage instance",
        );
      } else if (kind === "toon-recovery") {
        state = await basic("recover");
        assert.equal(state.player.hp, 9, "Printed REC five actually heals");
        assert.equal(toonCount(state), 0);
        await checkpoint(kind + "-optional-recovery", width, f);
        await reload();
        state = await optional("Cartoon Power");
        assert.equal(toonCount(state), 1);
        assert.ok(!state.prompt && state.player.exhausted);
      } else if (["toon-payment", "swing"].includes(kind)) {
        state = await play(name("30007"));
        assert.equal(state.prompt.cost, 3);
        assert.equal(
          payment(state).filter((p) => p.id.startsWith("spider-ham-toon:"))
            .length,
          3,
        );
        await checkpoint(kind + "-wild-toon-payment", width, f);
        await reload();
        state = await pay([1, 2, 3].map((i) => toonSource(f, i)));
        state = await target(state.villain.id);
        assert.equal(state.villain.hp, 44);
        assert.equal(state.villain.confused, true);
        assert.equal(toonCount(state), 0);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      } else if (kind === "upgrades-ready") {
        assert.equal(stats(state).attack, 2);
        assert.equal(stats(state).thwart, 3);
        state = await sourceAction("30011", /ready.*Aerial/i);
        assert.equal(state.player.exhausted, false);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.webbingId).exhausted,
          true,
        );
        assert.equal(toonCount(state), 0);
        assert.equal(aerial(state), true);
        await checkpoint(kind + "-actual-ready-aerial", width, f);
        await reload();
        state = await flip();
        assert.equal(state.player.spiderHamIdentity.id, f.identityId);
        assert.equal(state.player.spiderHamIdentity.code, "30001b");
        assert.equal(
          stats(state).attack,
          1,
          "Hammer hero-only modifier is inactive in alter-ego",
        );
        assert.equal(stats(state).thwart, 2);
        assert.equal(stats(state).recover, 5);
      } else if (kind === "hammer-overkill") {
        state = await basic("attack");
        await findChoice(
          (o) => o.id === f.hammerId,
          "Actual Huge Wooden Hammer interrupt",
        );
        await checkpoint(kind + "-counter-cost-interrupt", width, f);
        await reload();
        state = await choice(f.hammerId);
        state = await target(f.enemyId);
        state = await finishChoices();
        assert.equal(toonCount(state), 0);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.hammerId).exhausted,
          true,
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.enemyId));
        assert.equal(
          state.villain.hp,
          48,
          "Actual four ATK defeats the two-HP minion and overkills two",
        );
      } else if (kind === "americat") {
        await paidEvent(
          "30002",
          [1, 2, 3].map((i) => toonSource(f, i)),
        );
        await optional("Captain Americat");
        await checkpoint(kind + "-original-discard-shuffle", width, f);
        await reload();
        state = await target(f.shuffleId);
        assert.equal(toonCount(state), 1);
        assert.ok(state.player.inPlay.some((p) => p.id === f.allyId));
        assert.ok(state.player.deck.some((p) => p.id === f.shuffleId));
        assert.ok(!state.player.discard.some((p) => p.id === f.shuffleId));
      } else if (kind === "ham-it-up") {
        await paidEvent("30003", []);
        state = await target("main");
        assert.equal(state.scheme.threat, 2);
        assert.equal(
          toonCount(state),
          4,
          "Ham It Up counts without spending current toons",
        );
      } else if (kind.startsWith("hogwashed-")) {
        state = await paidEvent(
          "30004",
          kind === "hogwashed-minion" ? [toonSource(f)] : f.resourceIds,
        );
        assert.equal(
          toonCount(state),
          0,
          "Printed and additional costs finish before targets",
        );
        if (kind === "hogwashed-scheme" && state.prompt)
          assert.ok(!state.prompt.options.some((o) => o.id === "main"));
        await checkpoint(kind + "-legal-native-targets", width, f);
        await reload();
        state = await target(f.enemyId || f.schemeId);
        assert.equal(state.scheme.threat, 6);
        if (f.enemyId) {
          assert.equal(state.minions.find((p) => p.id === f.enemyId).damage, 5);
          assert.equal(
            state.player.hp,
            12,
            "Hogwashed damage does not trigger Retaliate",
          );
        } else
          assert.equal(
            state.sideSchemes.find((p) => p.id === f.schemeId).counters,
            1,
          );
      } else if (kind === "petulant-pig") {
        await paidEvent("30006", []);
        state = await defense();
        assert.ok(
          f.drawIds.every((id) => state.player.deck.some((p) => p.id === id)),
        );
        assert.ok(
          f.drawIds.every((id) => !state.player.hand.some((p) => p.id === id)),
          "Draw waits until the complete attack",
        );
        await checkpoint(kind + "-attack-before-draw", width, f);
        await reload();
        await choice("take");
        state = await optional("Spider-Nonsense");
        state = await finishChoices();
        assert.equal(state.player.hp, 8);
        assert.equal(toonCount(state), 1);
        assert.ok(
          f.drawIds.every((id) => state.player.hand.some((p) => p.id === id)),
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
      } else if (kind === "cancel") {
        await findChoice(
          (o) => o.id === f.eventId,
          "Paid native encounter cancellation",
        );
        await checkpoint(kind + "-actual-deck-reveal-interrupt", width, f);
        await reload();
        state = await choice(f.eventId);
        assert.equal(state.prompt.kind, "payment");
        assert.equal(state.prompt.cost, 1);
        assert.equal(
          payment(state).filter((p) => p.id.startsWith("spider-ham-toon:"))
            .length,
          1,
          "Additional toon cost is reserved",
        );
        await checkpoint(kind + "-paid-cancel", width, f);
        await reload();
        state = await pay([toonSource(f)]);
        state = await finishChoices();
        assert.equal(toonCount(state), 0);
        assert.equal(state.scheme.threat, 6);
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          3,
        );
        assert.ok(!state.minions.some((p) => p.id === f.encounterId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.encounterId));
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      } else if (kind.startsWith("physics-")) {
        await findChoice(
          (o) => o.id === f.physicsId,
          "Cartoon Physics actual prevention source",
        );
        await checkpoint(kind + "-prevention", width, f);
        await reload();
        state = await choice(f.physicsId);
        if (kind === "physics-hero") state = await optional("Spider-Nonsense");
        else state = await finishChoices();
        assert.equal(
          state.player.hp,
          11,
          "Only one of the actual six damage is taken",
        );
        assert.equal(toonCount(state), kind === "physics-hero" ? 1 : 2);
        assert.ok(state.player.discard.some((p) => p.id === f.physicsId));
        assert.ok(!state.player.inPlay.some((p) => p.id === f.physicsId));
      } else if (kind === "daily-beagle") {
        state = await sourceAction("30008", /toon/i);
        assert.equal(toonCount(state), 1);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.supportId).exhausted,
          true,
        );
        state = await flip();
        assert.equal(
          await page
            .locator(".in-play-card")
            .filter({ has: page.locator('img[src*="30008"]') })
            .locator(".in-play-actions button")
            .count(),
          0,
        );
      } else if (kind.startsWith("obligation-")) {
        await checkpoint(kind + "-native-owner-choice", width, f);
        await reload();
        if (kind === "obligation-remove") {
          await choice("alter");
          state = await choice("exhaust");
          assert.equal(state.player.form, "alter");
          assert.equal(state.player.spiderHamIdentity.id, f.identityId);
          assert.equal(state.player.exhausted, true);
          assert.equal(toonCount(state), 1);
          assert.ok(state.removed.some((p) => p.id === f.encounterId));
        } else {
          await choice("stay");
          state = await choice("stun");
          state = await finishChoices();
          assert.ok(
            state.encounter.discard.some((p) => p.id === f.encounterId),
          );
          assert.ok(state.encounter.dealt.some((p) => p.id === f.surgeId));
          assert.equal(state.player.stunnedCards, 1);
        }
      } else if (kind === "nemesis") {
        state = await finishChoices();
        assert.equal(toonCount(state), 0);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.supportId).counters || 0,
          0,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.webbingId).counters || 0,
          0,
        );
        const ally = state.player.inPlay.find((p) => p.id === f.allyId);
        assert.equal(
          ally.damage,
          1,
          "Gobbler removes all-purpose counters, preserving damage tokens",
        );
        assert.equal(
          ally.stunned,
          true,
          "Status cards survive the counter wipe",
        );
        assert.equal(state.player.hp, 12);
        assert.equal(state.scheme.threat, 6);
        assert.ok(
          state.minions.some(
            (p) => p.code === "30026" && p.engagedWith === "p1",
          ),
        );
        assert.equal(
          state.sideSchemes.find((p) => p.code === "30025").counters,
          3,
        );
        assert.equal(state.player.setAside.length, 0);
        assert.equal(
          state.encounter.deck.filter((p) =>
            ["30027", "30028"].includes(p.code),
          ).length,
          3,
        );
      } else if (kind === "trap-defeat") {
        await paidEvent("30003", []);
        state = await target(f.schemeId);
        state = await finishChoices();
        assert.ok(state.encounter.discard.some((p) => p.id === f.schemeId));
        assert.ok(
          state.minions.some(
            (p) => p.id === f.enemyId && p.engagedWith === "p1",
          ),
        );
        assert.equal(
          toonCount(state),
          0,
          "Put into play still triggers the actual Gobbler engagement",
        );
      } else if (kind === "glider") {
        state = await target(f.enemyId);
        state = await finishChoices();
        assert.ok(
          state.attachments.some(
            (p) => p.id === f.encounterId && p.attachedTo === f.enemyId,
          ),
        );
        await minionStats("30026", 3, 4);
        assert.equal(
          state.encounter.dealt.length,
          1,
          "Printed Surge deals one actual physical encounter",
        );
      } else if (kind === "feast") {
        state = await optional("Spider-Nonsense");
        state = await finishChoices();
        assert.equal(state.player.hp, 10);
        assert.equal(toonCount(state), 1);
        assert.equal(state.player.confusedCards, 1);
        assert.ok(state.encounter.dealt.some((p) => p.id === f.surgeId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.encounterId));
      } else if (kind === "pool-lady") {
        await sourceAction("30012", /thwart/i);
        await target("main");
        state = await optional("Lady Spider");
        if (state.prompt)
          assert.ok(!state.prompt.options.some((o) => o.id === "main"));
        await checkpoint(kind + "-different-scheme-response", width, f);
        await reload();
        state = await target(f.schemeId);
        assert.equal(state.scheme.threat, 4);
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          1,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          2,
        );
      } else if (kind.startsWith("pool-lady-overwatch-")) {
        await sourceAction("30012", /thwart/i);
        await target(kind === "pool-lady-overwatch-main" ? "main" : f.schemeId);
        state = await save();
        assert.equal(
          state.prompt?.title,
          "Overwatch",
          "The native interrupt precedes scheme cleanup and Lady Spider's response",
        );
        await checkpoint(kind + "-interrupt-before-response", width, f);
        await reload();
        await optional("Overwatch");
        state = await target(
          kind === "pool-lady-overwatch-main" ? f.schemeId : f.secondSchemeId,
        );
        if (kind === "pool-lady-overwatch-defeat") {
          assert.equal(
            state.prompt?.title,
            "Lady Spider",
            "Lady Spider responds after the native interrupted removal and scheme cleanup",
          );
          assert.ok(
            state.encounter.discard.some((piece) => piece.id === f.schemeId),
          );
          assert.equal(
            state.sideSchemes.find((piece) => piece.id === f.secondSchemeId)
              .counters,
            4,
            "Overwatch copies the one threat actually removed",
          );
          await checkpoint(kind + "-actual-receipt-after-cleanup", width, f);
          await reload();
          await optional("Lady Spider");
          state = await target(f.secondSchemeId);
          assert.equal(
            state.sideSchemes.find((piece) => piece.id === f.secondSchemeId)
              .counters,
            3,
            "Lady Spider copies the original actual one-threat receipt",
          );
          assert.equal(state.scheme.threat, 6);
        } else {
          assert.equal(
            state.prompt,
            null,
            "Defeating the only other scheme leaves no stale Lady Spider response",
          );
          assert.equal(state.scheme.threat, 4);
          assert.equal(state.sideSchemes.length, 0);
        }
        assert.equal(
          state.player.inPlay.find((piece) => piece.id === f.allyId).damage,
          2,
        );
        assert.ok(state.player.discard.some((piece) => piece.id === f.watchId));
        assert.equal(
          allPieces(state).filter((piece) => piece.id === f.schemeId).length,
          1,
        );
        assert.ok(
          state.encounter.discard.some((piece) => piece.id === f.schemeId),
        );
      } else if (kind === "pool-pavitr") {
        await paidEvent("30013", f.resourceIds);
        await optional("Spider-Man · Pavitr Prabhakar");
        state = await target("main");
        assert.equal(
          state.scheme.threat,
          3,
          "All controlled Web-Warrior card types count, including support",
        );
        assert.equal(state.player.form, "alter");
      } else if (kind === "pool-overwatch") {
        await paidEvent("30019", []);
        await target("main");
        await basic("thwart");
        await target("main");
        await optional("Overwatch");
        await checkpoint(kind + "-actual-thwart-mirror", width, f);
        await reload();
        state = await target(f.schemeId);
        assert.equal(state.scheme.threat, 4);
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.schemeId).counters,
          1,
        );
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      } else if (kind === "pool-overwatch-simultaneous") {
        state = await play(name("30014"));
        assert.deepEqual(state.prompt.requirements, ["energy"]);
        await (await paymentSource(toonSource(f, 1))).click();
        await (await paymentSource(toonSource(f, 2))).click();
        await page.getByLabel("Optional wild type").selectOption("energy");
        await checkpoint(kind + "-actual-event-payment", width, f);
        await reload();
        state = await pay([toonSource(f, 1), toonSource(f, 2)]);
        assert.equal(state.prompt?.title, "Overwatch");
        assert.ok(
          state.prompt.options.some((option) =>
            option.effects.some((effect) => effect.id === f.watchIds[0]),
          ),
          "The first interrupt belongs to the actual Watch on the first scheme",
        );
        assert.ok(
          f.schemeIds.every(
            (id) =>
              state.sideSchemes.find((piece) => piece.id === id).counters === 1,
          ),
          "The original simultaneous event removes one from each scheme",
        );
        assert.ok(
          f.watchIds.every((id, index) =>
            state.player.inPlay.some(
              (piece) =>
                piece.id === id && piece.attachedTo === f.schemeIds[index],
            ),
          ),
          "Both actual Watches remain attached until their native interrupts",
        );
        await checkpoint(kind + "-first-native-watch", width, f);
        await reload();
        state = await optional("Overwatch");
        assert.ok(
          state.player.discard.some((piece) => piece.id === f.watchIds[0]),
        );
        assert.ok(
          state.player.inPlay.some(
            (piece) =>
              piece.id === f.watchIds[1] && piece.attachedTo === f.schemeIds[1],
          ),
          "The second actual Watch stays attached until the copied thwart defeats its scheme",
        );
        await checkpoint(kind + "-actual-copy-target", width, f);
        await reload();
        state = await target(f.schemeIds[1]);
        assert.equal(
          state.prompt,
          null,
          "The discarded second Watch leaves no stale native interrupt",
        );
        assert.equal(state.sideSchemes.length, 1);
        assert.equal(state.sideSchemes[0].id, f.schemeIds[0]);
        assert.equal(state.sideSchemes[0].counters, 1);
        assert.ok(
          state.encounter.discard.some((piece) => piece.id === f.schemeIds[1]),
        );
        assert.ok(
          f.watchIds.every((id) =>
            state.player.discard.some((piece) => piece.id === id),
          ),
        );
        assert.ok(state.player.discard.some((piece) => piece.id === f.eventId));
        assert.equal(
          state.villain.hp,
          50,
          "Even the Odds does not claim a scheme defeated by Overwatch's copied thwart",
        );
        assert.equal(toonCount(state), 0);
      } else if (kind === "pool-scarlet") {
        await findChoice(
          (o) => o.id === f.allyId,
          "Scarlet Spider before reveal",
        );
        await choice(f.allyId);
        state = await save();
        assert.equal(state.prompt.title, "Scarlet Spider · name a card type");
        assert.equal(
          await page
            .locator('img[src*="30031"]')
            .evaluateAll(
              (images) =>
                images.filter((image) => image.getClientRects().length).length,
            ),
          0,
          "Scarlet Spider names a type before any actual encounter face is visible",
        );
        assert.ok(state.player.deck.some((p) => p.id === f.drawId));
        assert.ok(!state.minions.some((p) => p.id === f.encounterId));
        await checkpoint(kind + "-name-before-look", width, f);
        await reload();
        state = await choice("minion");
        state = await finishChoices();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          1,
        );
        assert.ok(state.player.hand.some((p) => p.id === f.drawId));
        assert.ok(state.minions.some((p) => p.id === f.encounterId));
        assert.equal(state.scheme.threat, 5);
      } else if (kind.startsWith("pool-spdr-")) {
        await sourceAction("30021", /thwart/i);
        state = await target("main");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 4);
        assert.equal(
          state.player.hand.some((p) => p.id === f.allyId),
          kind === "pool-spdr-excess",
        );
        assert.equal(
          state.player.discard.some((p) => p.id === f.allyId),
          kind === "pool-spdr-exact",
        );
        if (kind === "pool-spdr-excess")
          assert.equal(
            state.player.hand.find((p) => p.id === f.allyId).damage || 0,
            0,
          );
      } else if (kind === "pool-web-leave") {
        await sourceAction("30012", /thwart/i);
        await target("main");
        await optional("Web of Life and Destiny");
        await checkpoint(kind + "-actual-recipient", width, f);
        await reload();
        state = await choice("p2");
        state = await finishChoices();
        assert.ok(seat(state, "p2").hand.some((p) => p.id === f.drawId));
        assert.ok(seat(state, "p1").discard.some((p) => p.id === f.allyId));
        assert.equal(
          toonCount(state),
          0,
          "Ally consequential damage does not grant identity toons",
        );
      } else if (kind === "pool-requirement") {
        state = await play(name("30014"));
        assert.deepEqual(state.prompt.requirements, ["energy"]);
        await (await paymentSource(toonSource(f, 1))).click();
        await (await paymentSource(toonSource(f, 2))).click();
        await page.getByLabel("Optional wild type").selectOption("energy");
        await checkpoint(kind + "-energy-requirement", width, f);
        await reload();
        state = await pay([toonSource(f, 1), toonSource(f, 2)]);
        state = await finishChoices();
        assert.equal(toonCount(state), 0);
        assert.equal(state.villain.hp, 48);
        assert.ok(
          f.schemeIds.every((id) =>
            state.encounter.discard.some((p) => p.id === id),
          ),
        );
      } else if (kind === "pool-warrior-custom") {
        await paidEvent("30029", [toonSource(f)]);
        state = await target("hero:p1");
        assert.ok(
          state.player.inPlay.some(
            (p) => p.id === f.upgradeId && p.attachedTo === "hero:p1",
          ),
        );
        state = await flip();
        assert.equal(state.player.form, "alter");
        assert.equal(grantedWarrior(state), true);
        state = await play(name("30023"));
        if (state.prompt?.kind === "payment") {
          assert.equal(
            state.prompt.cost,
            0,
            "Actual current alter-ego trait grant ignores printed support cost",
          );
          state = await pay([]);
        }
        await paidEvent("30021", f.resourceIds);
        await sourceAction("30021", /thwart/i);
        await target("main");
        await optional("Warrior of the Great Web");
        state = await finishChoices();
        assert.equal(warriorAttack(state), 1);
        assert.ok(state.player.discard.some((p) => p.id === f.allyId));
      } else if (kind === "pool-great-responsibility") {
        state = await findChoice(
          (o) =>
            o.effects?.some(
              (effect) =>
                effect.type === "resolveHandEvent" && effect.id === f.eventId,
            ),
          "Native threat replacement event",
        );
        const sourceOption = state.prompt.options.find((option) =>
          option.effects?.some(
            (effect) =>
              effect.type === "resolveHandEvent" && effect.id === f.eventId,
          ),
        );
        await checkpoint(kind + "-threat-interrupt", width, f);
        await reload();
        await choice(sourceOption.id);
        state = await optional("Spider-Nonsense");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 6);
        assert.equal(state.player.hp, 9);
        assert.equal(toonCount(state), 1);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      } else if (kind === "pool-making-entrance") {
        await basic("thwart");
        await findChoice(
          (o) => o.id === f.eventId,
          "Native basic thwart interrupt",
        );
        await choice(f.eventId);
        state = await pay(f.resourceIds);
        state = await target("main");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 0);
        assert.equal(state.player.hp, 10, "Remove all threat then heal two");
      } else if (kind === "pool-entrance-trap") {
        await basic("thwart");
        await findChoice(
          (option) => option.id === f.eventId,
          "Making an Entrance's actual basic-thwart interrupt",
        );
        await checkpoint(kind + "-actual-paid-interrupt", width, f);
        await reload();
        await choice(f.eventId);
        await checkpoint(kind + "-native-payment", width, f);
        await reload();
        await pay(f.resourceIds);
        await checkpoint(kind + "-actual-trap-target", width, f);
        await reload();
        await target(f.schemeId);
        state = await defense();
        assert.equal(state.attack.attacker, f.enemyId);
        assert.equal(state.attack.base, 2);
        assert.equal(
          state.sideSchemes.find((piece) => piece.id === f.schemeId).counters,
          0,
          "The actual Trap is depleted before its native forced attack",
        );
        assert.equal(
          state.player.hp,
          2,
          "Entrance cannot heal before Nefarious Trap's forced attack",
        );
        await checkpoint(kind + "-forced-attack-before-heal", width, f);
        await reload();
        state = await choice("take");
        state = await finishChoices();
        assert.equal(
          state.phase,
          "lost",
          "The printed forced attack defeats the two-HP identity before healing",
        );
        assert.equal(
          state.player.hp,
          0,
          "No queued heal resurrects a defeated Spider-Ham",
        );
        assert.ok(state.player.discard.some((piece) => piece.id === f.eventId));
        assert.ok(
          state.player.discard.some((piece) => piece.id === f.resourceIds[0]),
        );
      } else if (kind === "pool-one-way") {
        await paidEvent("30017", []);
        await checkpoint(kind + "-actual-source-search", width, f);
        await reload();
        state = await target(f.schemeId);
        state = await finishChoices();
        assert.ok(state.sideSchemes.some((p) => p.id === f.schemeId));
        assert.ok(
          f.drawIds.every((id) => state.player.hand.some((p) => p.id === id)),
        );
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      } else if (kind === "pool-followed") {
        await paidEvent("30018", [toonSource(f)]);
        await target(f.schemeId);
        await basic("thwart");
        await target(f.schemeId);
        await optional("Followed");
        state = await target(state.villain.id);
        state = await finishChoices();
        assert.equal(state.villain.hp, 46);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.schemeId));
      } else if (kind === "pool-team-building") {
        await sourceAction("30022", /play/i);
        await target(f.allyId);
        state = await save();
        assert.equal(state.prompt.kind, "payment");
        assert.equal(
          state.prompt.cost,
          2,
          "Trait-matched source ally receives exactly one reduction",
        );
        await checkpoint(kind + "-native-discount-payment", width, f);
        await reload();
        await pay([toonSource(f, 1), toonSource(f, 2)]);
        await optional("Captain Americat");
        state = await finishChoices();
        assert.equal(toonCount(state), 1);
        assert.ok(state.player.inPlay.some((p) => p.id === f.allyId));
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.supportId).exhausted,
          true,
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
          provenance: source.provenance,
        })),
        identityCards: 1,
        obligationAndNemesis: 6,
        modularCards: 9,
        exactReload: true,
      });
      console.log("Verified native Spider-Ham " + kind + " at " + width + "px");
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
    if (process.env.SPIDER_HAM_SHA256)
      assert.equal(
        sha256,
        process.env.SPIDER_HAM_SHA256,
        "Expected actual production entry SHA256",
      );
    entryProof.push({ url: asset, sha256 });
  }
  const styleProof = [];
  for (const asset of styleAssets) {
    const response = await context.request.get(asset);
    assert.equal(response.status(), 200, "Served immutable stylesheet bytes");
    const sha256 = createHash("sha256")
      .update(await response.body())
      .digest("hex");
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
  if (context) await context.close();
  await browser.close();
}
