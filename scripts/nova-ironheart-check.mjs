import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

const catalog = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-decks.json", import.meta.url),
    "utf8",
  ),
);
const sources = Object.fromEntries(
  [
    ["nova", "28001a", "Nova", "Sam Alexander", "aggression"],
    ["ironheart", "29001a", "Ironheart", "Riri Williams", "leadership"],
  ].map(([id, code, name, identity, aspect]) => {
    const deck = catalog.find((d) => d.id === "starter-" + code);
    assert.ok(deck, identity + " original starter");
    return [
      id,
      {
        code,
        name,
        identity,
        aspect,
        codes: Object.entries(deck.cards)
          .flatMap(([code, count]) => Array(count).fill(code))
          .sort(),
      },
    ];
  }),
);
const output = process.env.NOVA_IRONHEART_OUTPUT || "output/nova-ironheart";
await mkdir(output, { recursive: true });
for (const name of [
  "report.json",
  "failure.json",
  "failure.png",
  "failure-save.json",
  "failure-body.txt",
])
  await rm(output + "/" + name, { force: true });
const defaults =
  "nova-sam-wild,nova-sam-ordinary,nova-helmet,nova-unleash,nova-forcefield,nova-forcefield-overpay,nova-forcefield-ally,nova-weight,nova-recycle,nova-nemesis,iron-versions,iron-prodigy-v1,iron-prodigy-v2,iron-photon-fly,iron-resources,iron-tony,iron-nemesis,pool-no-quarter,pool-moon-girl,pool-go-all-out";
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
 import {newGame,dispatch,paymentSources} from './src/game/engine.ts';
 import {heroStarterCodes} from './src/game/hero-runtime.ts';
 import {card} from './src/game/cards.ts';
 export function isPlayerDeckPiece(p){return ['event','resource','ally','support','upgrade'].includes(card(p)?.type_code);}
 export function nativePaymentSources(s){const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);}
 export function fixture(kind){
  const heroId=kind.startsWith('iron-')||kind==='pool-go-all-out'?'ironheart':'nova';
  const aspect=heroId==='nova'?'aggression':'leadership';
  let s=newGame({heroId,aspect,villainId:'rhino',module:'bomb_scare',deckCards:heroStarterCodes(heroId),deckOrigin:'source',seed:heroId==='nova'?28001:29001,pacing:'expert'});
  function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
  command({type:'MULLIGAN',ids:[]});if(s.prompt||s.review)throw Error('Original setup is unfinished');
  const originalSource=[...s.player.hand,...s.player.deck,...s.player.discard,...s.player.inPlay].map(p=>({id:p.id,code:p.code}));
  if(originalSource.length!==40)throw Error('Original source must have forty actual player cards');
  const identities=heroId==='ironheart'?[s.player.ironheartIdentity,...s.player.setAside.filter(p=>['29002a','29003a'].includes(p.code))].map(p=>({id:p.id,code:p.code})):[];
  if(heroId==='ironheart'&&identities.length!==3)throw Error('Three actual physical Ironheart identities required');
  const encounters=[...s.player.setAside.filter(p=>card(p)?.faction_code==='encounter'),...s.encounter.deck.filter(p=>p.code===(heroId==='nova'?'28021':'29028'))].map(p=>({id:p.id,code:p.code}));
  if(encounters.length!==6)throw Error('Five actual nemeses and one obligation required');
  s.player.deck.push(...s.player.hand.splice(0));s.player.form='hero';s.player.hp=10;s.player.exhausted=false;s.player.flipped=false;
  s.villain.hp=s.villain.maxHp=50;s.scheme.threat=6;s.queue=[];s.prompt=null;s.review=null;
  function take(code){for(const z of[s.player.hand,s.player.deck,s.player.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0]}throw Error('Missing actual original source '+code)}
  function hand(codes){s.player.deck.push(...s.player.hand.splice(0));const ps=codes.map(take);s.player.hand.push(...ps);return ps}
  function put(code){const p=take(code);p.exhausted=false;s.player.inPlay.push(p);return p}
  function top(codes){const ps=codes.map(take);s.player.deck.unshift(...ps);return ps}
  function encounter(code){for(const z of[s.player.setAside,s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0]}throw Error('Missing actual encounter '+code)}
  function minion(code,damage=0){const p=encounter(code);p.engagedWith=s.activePlayerId;p.damage=damage;s.minions.push(p);return p}
  function native(effects){s.prompt={kind:'choice',title:'Resolve encounter',text:'Continue the encounter.',options:[{id:'go',label:'Continue',effects}]}}
  function level2(){s.player.ironheartIdentity.counters=6;command({type:'ABILITY',id:'identity',action:'ironheart-level-up'});if(s.prompt)throw Error('Unexpected level-up prompt');}
  let ids={};
  if(kind==='nova-sam-wild'||kind==='nova-sam-ordinary'){s.player.form='alter';const [resource]=hand([kind==='nova-sam-wild'?'28007':'28005']);ids={resourceId:resource.id,helmetId:s.player.deck.find(p=>p.code==='28009').id};}
  else if(kind==='nova-helmet'){const helmet=put('28009'),[event]=hand(['28005']);ids={helmetId:helmet.id,eventId:event.id};}
  else if(kind==='nova-unleash'){const [event,second,resource]=hand(['28006','28006','28007']);const [draw]=top(['28009']);s.scheme.threat=1;ids={eventId:event.id,secondId:second.id,resourceId:resource.id,drawId:draw.id};}
  else if(kind.startsWith('nova-forcefield')){const helmet=put('28009'),codes=kind==='nova-forcefield'?['28003']:kind==='nova-forcefield-overpay'?['28003','28005','28007']:['28003','28005'],ps=hand(codes);s.player.stunned=true;if(kind==='nova-forcefield-ally'){const ally=put('28002'),charge=encounter('01099');charge.attachedTo=s.villain.id;s.attachments.push(charge);ids={allyId:ally.id,chargeId:charge.id};}const boost=encounter('01105');s.encounter.deck.unshift(boost);native([{type:'enemyAttack',id:s.villain.id,actorId:s.activePlayerId}]);ids={...ids,helmetId:helmet.id,eventId:ps[0].id,resourceIds:ps.slice(1).map(p=>p.id),boostId:boost.id};}
  else if(kind==='nova-weight'){const helmet=put('28009');helmet.exhausted=true;const [unleash,resource]=hand(['28006','28007']);s.scheme.threat=1;const weight=encounter('28021');native([{type:'reveal',piece:weight}]);ids={helmetId:helmet.id,weightId:weight.id,resourceId:resource.id,unleashId:unleash.id};}
  else if(kind==='nova-recycle'){const ally=put('28002');ally.damage=2;const helmet=put('28009'),[event]=hand(['28004']);ids={allyId:ally.id,helmetId:helmet.id,eventId:event.id};}
  else if(kind==='nova-nemesis'||kind==='iron-nemesis'){const shadow=encounter('01190');const effects=[{type:'reveal',piece:shadow}];if(heroId==='ironheart'){s.player.ironheartIdentity.counters=1;const obligation=encounter('29028');effects.push({type:'reveal',piece:obligation});ids.obligationId=obligation.id;}native(effects);ids={...ids,shadowId:shadow.id,nemesisIds:encounters.filter(p=>p.code!=='28021'&&p.code!=='29028').map(p=>p.id)};}
  else if(kind==='iron-versions'){put('29012');put('29013');s.player.hp=7;s.player.exhausted=true;s.player.stunned=true;s.player.ironheartIdentity.counters=13;const [stroke]=hand(['29009']);const [draw]=top(['29005']);ids={versionIds:identities.map(p=>p.id),strokeId:stroke.id,drawId:draw.id};}
  else if(kind==='iron-prodigy-v1'){s.player.form='alter';const [stroke,energy]=hand(['29009','29006']);const [draw]=top(['29005']);ids={strokeId:stroke.id,energyId:energy.id,drawId:draw.id};}
  else if(kind==='iron-prodigy-v2'){level2();s.player.form='alter';const ps=hand(['29006','29006']);ids={resourceIds:ps.map(p=>p.id),versionId:s.player.ironheartIdentity.id};}
  else if(kind==='iron-photon-fly'){const enemy=minion('01101');const ps=hand(['29006','29005','29021','29021','29009','29009']);s.scheme.threat=3;const draws=top(['29011','29010']);ids={enemyId:enemy.id,photonId:ps[0].id,flyId:ps[1].id,powerIds:ps.slice(2,4).map(p=>p.id),strokeIds:ps.slice(4).map(p=>p.id),drawIds:draws.map(p=>p.id)};}
  else if(kind==='iron-resources'){const brawn=put('29004');brawn.exhausted=true;const ingenuity=put('29027'),[scan,photon,power]=hand(['29008','29006','29021']);ids={brawnId:brawn.id,ingenuityId:ingenuity.id,scanId:scan.id,photonId:photon.id,topEncounterId:s.encounter.deck[0].id};}
  else if(kind==='iron-tony'){const tony=put('29011'),ps=top(['29005','29006']);ids={tonyId:tony.id,topIds:ps.map(p=>p.id)};}
  else if(kind==='pool-no-quarter'){put('28017');const enemy=minion('01101',2);const [event,physical,mental]=hand(['28013','28002','28013']);const milled=top(['28016','28018','28014','28009','28012']);ids={enemyId:enemy.id,eventId:event.id,resourceIds:[physical.id,mental.id],milled:milled.map(p=>({id:p.id,code:p.code}))};}
  else if(kind==='pool-moon-girl'){const [ally,...resources]=hand(['28018','28017','28013','28002']);const draws=top(['28008','28020']);ids={allyId:ally.id,resourceIds:resources.map(p=>p.id),drawIds:draws.map(p=>p.id)};}
  else if(kind==='pool-go-all-out'){const [boost,event,mental,energy,physical]=hand(['29019','29017','29005','29006','29013']);ids={boostId:boost.id,eventId:event.id,mentalId:mental.id,resourceIds:[energy.id,physical.id]};}
  else throw Error('Unknown reviewed native fixture '+kind);
  return {state:s,source:originalSource,identities,encounters,...ids};
 }
 `,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { fixture, isPlayerDeckPiece, nativePaymentSources } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
if (process.env.NOVA_IRONHEART_FIXTURE_CHECK) {
  const prepared = [];
  for (const kind of defaults.split(",")) {
    const f = fixture(kind);
    const actual = [
      ...allPieces(f.state),
      ...(f.state.prompt?.options || []).flatMap((option) =>
        (option.effects || [])
          .filter((effect) => effect.type === "reveal" && effect.piece)
          .map((effect) => effect.piece),
      ),
    ];
    for (const original of [...f.source, ...f.identities, ...f.encounters]) {
      assert.equal(
        actual.filter((p) => p.id === original.id && p.code === original.code)
          .length,
        1,
        kind + ": original physical " + original.code,
      );
    }
    assert.equal(f.source.length, 40);
    assert.equal(new Set(f.source.map((p) => p.id)).size, 40);
    assert.deepEqual(
      actual
        .filter(isPlayerDeckPiece)
        .map((p) => p.id)
        .sort(),
      f.source.map((p) => p.id).sort(),
      kind + ": exact original forty deck cards without extra player pieces",
    );
    assert.equal(f.identities.length, f.state.heroId === "ironheart" ? 3 : 0);
    assert.equal(f.encounters.length, 6);
    prepared.push({
      kind,
      sourceCards: f.source.length,
      identities: f.identities.length,
      encounters: f.encounters.length,
    });
  }
  await writeFile(
    output + "/fixture-preparation-report.json",
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
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
const entryAssets = new Set();
let context, page;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));

async function open(state, width = 1440) {
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
  if (state)
    await page.addInitScript((saved) => {
      if (sessionStorage.getItem("nova-ironheart-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("nova-ironheart-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.NOVA_IRONHEART_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production module asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.NOVA_IRONHEART_ASSET),
      ),
      "Expected immutable production entry asset",
    );
  }
  if (state) await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function settle() {
  for (let i = 0; i < 80; i++) {
    const state = await save();
    assert.ok(!state.error, state.error);
    if (!state.review) return state;
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  }
  throw Error("Review queue did not settle");
}
async function choice(id) {
  const state = await save();
  assert.equal(state.prompt?.kind, "choice");
  const index = state.prompt.options.findIndex((option) => option.id === id);
  assert.ok(index >= 0, `${state.prompt.title}: missing ${id}`);
  await page.locator(".decision-option").nth(index).click();
  return settle();
}
async function skip() {
  const state = await save();
  assert.equal(state.prompt?.kind, "choice");
  const option = state.prompt.options.find((o) =>
    /^(skip|pass|none|done|continue|no|take)$/.test(o.id),
  );
  assert.ok(option, JSON.stringify(state.prompt));
  return choice(option.id);
}
async function reload() {
  const before = await save();
  await writeFile(
    `${output}/reload-before.json`,
    JSON.stringify(before, null, 2),
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await save(),
    before,
    "Pending native choice and physical cards survive reload exactly",
  );
}
async function capture(name) {
  await page.mouse.move(4, 4);
  await page.locator(".card-hover-preview").waitFor({ state: "hidden" });
  await page.locator(".combat-cinematic").waitFor({ state: "hidden" });
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
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
async function fit(name, width) {
  await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
      (dialog) => ({ width: dialog.clientWidth, content: dialog.scrollWidth }),
    ),
    formControls: [...document.querySelectorAll(".flip-button")].map(
      (button) => {
        const rect = button.getBoundingClientRect();
        const table = button.closest(".physical-table").getBoundingClientRect();
        return { left: rect.left, right: rect.right, tableRight: table.right };
      },
    ),
  }));
  layouts.push({ name, ...metrics });
  await capture(`${name}-${width}`);
  assert.ok(metrics.document <= width + 1, `${name}: page overflow`);
  assert.ok(
    metrics.dialogs.every((dialog) => dialog.content <= dialog.width + 1),
    `${name}: dialog overflow ${JSON.stringify(metrics)}`,
  );
  assert.ok(
    metrics.formControls.every(
      (button) =>
        button.left >= 0 &&
        button.right <= Math.min(width, button.tableRight) + 1,
    ),
    `${name}: form control clipped ${JSON.stringify(metrics.formControls)}`,
  );
}
async function audit(name) {
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
    `${name}: accessibility violations ${JSON.stringify(audits.at(-1))}`,
  );
}
let originals;
function allPieces(state) {
  const walk = (p) => [
    p,
    ...(p.storedCards || []).flatMap(walk),
    ...(p.captured || []).flatMap(walk),
    ...(p.droneCard ? walk(p.droneCard) : []),
  ];
  return [
    ...state.players.flatMap((seat) => {
      const p = seat.id === state.activePlayerId ? state.player : seat.player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
        ...(p.ironheartIdentity ? [p.ironheartIdentity] : []),
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
  ].flatMap(walk);
}
function snapshot(state) {
  const p = state.player,
    source = [...p.hand, ...p.deck, ...p.discard, ...p.inPlay].map((p) => ({
      id: p.id,
      code: p.code,
    }));
  const identities =
    state.heroId === "ironheart"
      ? [
          p.ironheartIdentity,
          ...p.setAside.filter((p) => ["29002a", "29003a"].includes(p.code)),
        ].map((p) => ({ id: p.id, code: p.code }))
      : [];
  const encounters = [
    ...p.setAside.filter((p) => !/^2900[23]a$/.test(p.code)),
    ...state.encounter.deck.filter(
      (p) => p.code === (state.heroId === "nova" ? "28021" : "29028"),
    ),
  ].map((p) => ({ id: p.id, code: p.code }));
  return { source, identities, encounters };
}
function physicalCards(state) {
  return allPieces(state)
    .filter(isPlayerDeckPiece)
    .map((p) => p.id)
    .sort();
}
function conserved(state, expected, message) {
  const pieces = allPieces(state);
  for (const group of ["source", "identities", "encounters"])
    for (const o of originals[group]) {
      const matching = pieces.filter((p) => p.id === o.id);
      assert.equal(
        matching.length,
        1,
        message +
          ": original " +
          group +
          " " +
          o.code +
          ":" +
          o.id +
          " occupies exactly one actual zone",
      );
      assert.equal(
        matching[0].code,
        o.code,
        message + ": original physical printing remains " + o.code,
      );
    }
  assert.equal(
    originals.source.length,
    40,
    message + ": original forty-player-card source",
  );
  assert.deepEqual(
    physicalCards(state),
    expected,
    message + ": original source IDs",
  );
  assert.equal(new Set(originals.source.map((p) => p.id)).size, 40);
  assert.equal(
    originals.identities.length,
    state.heroId === "ironheart" ? 3 : 0,
  );
  assert.equal(originals.encounters.length, 6);
  if (state.heroId === "ironheart") {
    assert.equal(
      state.player.setAside.filter((p) => /^2900[123]a$/.test(p.code)).length,
      2,
      message + ": exactly two reserved physical identities",
    );
    assert.ok(
      originals.identities.some(
        (p) => p.id === state.player.ironheartIdentity.id,
      ),
    );
    assert.ok(
      ![
        ...state.player.hand,
        ...state.player.deck,
        ...state.player.discard,
      ].some((p) => /^2900[123][ab]$/.test(p.code)),
      message + ": identity faces never enter player deck",
    );
  }
}
async function paymentSource(id) {
  const state = await save();
  assert.equal(state.prompt?.kind, "payment");
  const sources = nativePaymentSources(state);
  const source = sources.find((source) => source.id === id);
  assert.ok(source, "Actual original resource source " + id);
  const group = sources.filter((s) => s.kind === source.kind);
  const index = group.findIndex((source) => source.id === id);
  const button = page
    .locator(`.payment-source-group.${source.kind}-sources .payment-source`)
    .nth(index);
  assert.equal(
    await button.getAttribute("aria-label"),
    `${source.name} · ${source.resources.join(" + ")} · ${source.description}`,
    "Exact actual source in its rendered resource group",
  );
  return button;
}
async function payIds(ids, wild) {
  const state = await save();
  assert.equal(state.prompt?.kind, "payment");
  for (const id of ids) {
    const button = await paymentSource(id);
    assert.equal(await button.getAttribute("aria-pressed"), "false");
    await button.click();
  }
  if (wild) await page.getByLabel("Optional wild type").selectOption(wild);
  assert.equal(
    await page
      .getByRole("button", { name: "Confirm payment", exact: true })
      .isDisabled(),
    false,
    "Printed cost and Requirement are actually paid",
  );
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  return settle();
}
async function identity(label) {
  await page
    .locator(
      ".identity .ability-button, .identity-card .ability-button, .identity-info .ability-button",
    )
    .filter({ hasText: label })
    .click();
  return settle();
}
async function flip() {
  await page.locator(".flip-button").click();
  return settle();
}
async function assertFace(code) {
  assert.ok(
    await page.locator('.identity-card img[src*="' + code + '"]').count(),
    "Actual current identity artwork " + code,
  );
}
async function findChoice(predicate, label) {
  for (let i = 0; i < 12; i++) {
    const state = await save();
    assert.equal(
      state.prompt?.kind,
      "choice",
      `${label}: native choice missing`,
    );
    if (state.prompt.options.some(predicate)) return state;
    await skip();
  }
  throw Error(`${label}: choice missing`);
}
async function play(name) {
  await page
    .getByRole("button", { name: "Play now: " + name, exact: true })
    .first()
    .click();
  return settle();
}
async function checkpoint(name, width, physical) {
  const state = await save();
  conserved(state, physical, name);
  await fit(name, width);
  await audit(name + " " + width);
}

async function inPlayAction(name, action) {
  const card = page.locator(".in-play-card").filter({
    has: page.locator(".in-play-name").filter({ hasText: name }),
  });
  await card
    .locator(".in-play-actions button")
    .filter({ hasText: action })
    .first()
    .click();
  return settle();
}

async function target(id) {
  const state = await save();
  return state.prompt?.options.some((option) => option.id === id)
    ? choice(id)
    : state;
}
async function basic(power) {
  await page.locator("." + power + "-action").click();
  return settle();
}
async function finishChoices() {
  for (let n = 0; n < 60; n++) {
    const state = await save();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const pass = state.prompt.options.find((o) =>
      /^(skip|pass|none|done|continue|no|take)$/.test(o.id),
    );
    if (pass) await choice(pass.id);
    else if (state.prompt.options.length === 1)
      await choice(state.prompt.options[0].id);
    else
      throw Error("Unresolved native choice: " + JSON.stringify(state.prompt));
  }
  throw Error("Native choices did not finish");
}

try {
  const widths = (process.env.NOVA_IRONHEART_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceWidths = (
    process.env.NOVA_IRONHEART_SOURCE_VIEWPORTS || widths.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.NOVA_IRONHEART_FIXTURE_ONLY)
    for (const [id, source] of Object.entries(sources)) {
      await open();
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
        has: page.locator("b", {
          hasText: new RegExp("^" + source.name + "$"),
        }),
      });
      assert.equal(
        await row.count(),
        1,
        "One canonical source identity " + source.code,
      );
      await row.click();
      const detail = dialog.locator(".catalog-hero-detail");
      assert.ok(
        await detail.locator('img[src*="' + source.code + '"]').count(),
      );
      await detail
        .getByRole("button", {
          name: "Choose " + source.name + " for mission",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: /View 40-card deck/ }).click();
      assert.match(
        await page.locator(".deck-provenance").innerText(),
        /Source preconstructed list:/,
      );
      await capture(id + "-original-source");
      await audit(source.identity + " original source");
      await page.keyboard.press("Escape");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .waitFor();
      let state = await save();
      originals = snapshot(state);
      const physical = physicalCards(state);
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, source.aspect);
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      assert.deepEqual(
        originals.source.map((p) => p.code).sort(),
        source.codes,
      );
      assert.equal(physical.length, 40);
      assert.equal(state.player.hand.length, 6);
      assert.equal(state.player.inPlay.length, 0);
      assert.equal(state.player.setAside.length, id === "ironheart" ? 7 : 5);
      if (id === "ironheart") {
        assert.equal(state.player.ironheartIdentity.code, "29001a");
        assert.deepEqual(
          originals.identities.map((p) => p.code),
          ["29001a", "29002a", "29003a"],
        );
      }
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.player.inPlay.length, 0);
      assert.equal(state.player.hand.length, 6);
      for (const width of sourceWidths)
        await checkpoint(id + "-original-source-board", width, physical);
      await reload();
      checks.push(
        source.identity +
          " original source40, six-card opening, actual nemesis IDs" +
          (id === "ironheart"
            ? " and three physical identities with two reserved versions"
            : " without invented Helmet setup") +
          " survive actual setup and exact reload",
      );
    }
  const scenarios = (process.env.NOVA_IRONHEART_SCENARIOS || defaults)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const kind of scenarios) {
    assert.ok(
      defaults.split(",").includes(kind),
      "Reviewed native scenario " + kind,
    );
    for (const width of widths) {
      const f = fixture(kind);
      originals = f;
      await open(f.state, width);
      const physical = physicalCards(await save());
      let state;
      if (kind === "nova-sam-wild" || kind === "nova-sam-ordinary") {
        await identity("Sam Alexander");
        await checkpoint(kind + "-actual-ability-payment", width, physical);
        await reload();
        await payIds([f.resourceId]);
        await findChoice((o) => o.id === f.helmetId, "Actual deck Helmet");
        await checkpoint(kind + "-original-helmet-search", width, physical);
        await reload();
        await choice(f.helmetId);
        state = await finishChoices();
        assert.equal(state.player.form, "alter");
        assert.equal(state.player.exhausted, false);
        assert.equal(state.player.flipped, false);
        assert.equal(
          state.player.inPlay.some((p) => p.id === f.helmetId),
          kind === "nova-sam-wild",
        );
        assert.equal(
          state.player.hand.some((p) => p.id === f.helmetId),
          kind === "nova-sam-ordinary",
        );
      } else if (kind === "nova-helmet") {
        await play("Pot Shot");
        state = await save();
        assert.equal(state.prompt.cost, 2);
        assert.deepEqual(
          nativePaymentSources(state).find((p) => p.id === f.helmetId)
            .resources,
          ["wild", "wild"],
        );
        await checkpoint(
          "helmet-doubles-only-printed-pot-shot-payment",
          width,
          physical,
        );
        await reload();
        await payIds([f.helmetId]);
        await target("villain");
        state = await finishChoices();
        assert.equal(state.villain.hp, 46);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.helmetId).exhausted,
          true,
        );
        await basic("thwart");
        await target("main");
        await findChoice(
          (o) => o.id === f.helmetId,
          "Completed basic Helmet response",
        );
        await checkpoint(
          "native-basic-thwart-retains-actual-helmet-response",
          width,
          physical,
        );
        await reload();
        await choice(f.helmetId);
        state = await finishChoices();
        assert.equal(state.scheme.threat, 5);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.helmetId).exhausted,
          false,
        );
        assert.equal(state.player.exhausted, true);
      } else if (kind === "nova-unleash") {
        await play("Unleash Nova Force");
        await payIds([f.resourceId]);
        state = await finishChoices();
        assert.equal(state.flags.novaUnleashRound, state.round);
        assert.equal(
          await page
            .getByRole("button", {
              name: "Play now: Unleash Nova Force",
              exact: true,
            })
            .count(),
          0,
          "Global max prevents second actual copy",
        );
        await basic("thwart");
        await target("main");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 0);
        assert.equal(state.player.exhausted, false);
        assert.ok(state.player.hand.some((p) => p.id === f.drawId));
        assert.equal(
          await page.getByLabel("ATK: 1", { exact: true }).count(),
          1,
        );
        assert.equal(
          await page.getByLabel("THW: 1", { exact: true }).count(),
          1,
        );
        await checkpoint(
          "unleash-actual-last-threat-ready-draw-without-stat-bonus",
          width,
          physical,
        );
        await reload();
        await page.getByRole("button", { name: /End hero phase/ }).click();
        state = await settle();
        assert.equal(
          state.flags.novaUnleashRound,
          state.round,
          "Unleash survives player-phase end",
        );
      } else if (
        kind === "nova-forcefield" ||
        kind === "nova-forcefield-overpay" ||
        kind === "nova-forcefield-ally"
      ) {
        await choice("go");
        const defenderId = kind === "nova-forcefield-ally" ? f.allyId : "take";
        await findChoice((o) => o.id === defenderId, "Actual enemy attack");
        await choice(defenderId);
        const victimId = f.allyId || `hero:${f.state.activePlayerId}`;
        const actualVictim = (option) =>
          option.image === "28003" &&
          option.effects.some(
            (effect) => effect.context?.targetId === victimId,
          );
        await findChoice(actualVictim, "Actual friendly attack damage victim");
        state = await save();
        const response = state.prompt.options.find(actualVictim);
        assert.match(
          response.label,
          kind === "nova-forcefield-ally"
            ? /damage to Ms\. Marvel/
            : /damage to Nova/,
        );
        await checkpoint(
          kind + "-actual-damage-interrupt-no-defense",
          width,
          physical,
        );
        await reload();
        await choice(response.id);
        state = await save();
        assert.equal(state.prompt.card.id, f.eventId);
        assert.equal(state.prompt.cost, 1);
        assert.deepEqual(
          nativePaymentSources(state).find((p) => p.id === f.helmetId)
            .resources,
          ["wild"],
        );
        await payIds(kind === "nova-forcefield" ? [f.helmetId] : f.resourceIds);
        if (kind === "nova-forcefield-overpay") {
          state = await findChoice(
            (o) =>
              o.id === "energy" &&
              o.effects.some(
                (effect) =>
                  JSON.stringify(effect.generatedForCard) ===
                  JSON.stringify(["energy"]),
              ),
            "Actual Forcefield FOR energy versus Wild overpayment allocation",
          );
          assert.equal(state.prompt.title, "Allocate payment resources");
          await checkpoint(
            "forcefield-actual-energy-allocation-excludes-overpaid-wild",
            width,
            physical,
          );
          await reload();
          await choice("energy");
        }
        if (kind === "nova-forcefield") await target("villain");
        state = await finishChoices();
        assert.equal(state.player.hp, 10);
        assert.equal(
          state.player.stunned,
          true,
          "Nonattack damage preserves Stun",
        );
        assert.equal(state.villain.hp, kind === "nova-forcefield" ? 47 : 50);
        assert.equal(
          state.player.exhausted,
          false,
          "Forcefield does not designate a basic defender",
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.helmetId).exhausted,
          kind === "nova-forcefield",
        );
        if (kind === "nova-forcefield-ally") {
          assert.equal(
            state.player.inPlay.find((p) => p.id === f.allyId).damage,
            2,
            "The original ally remains the defender and takes the unprevented attack damage",
          );
          assert.ok(state.encounter.discard.some((p) => p.id === f.chargeId));
        }
      } else if (kind === "nova-weight") {
        await choice("go");
        state = await finishChoices();
        assert.equal(state.player.form, "hero");
        assert.ok(state.player.inPlay.some((p) => p.id === f.weightId));
        await play("Unleash Nova Force");
        await payIds([f.resourceId]);
        await finishChoices();
        await basic("thwart");
        await target("main");
        state = await finishChoices();
        assert.equal(state.player.exhausted, false);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.helmetId).exhausted,
          true,
        );
        await checkpoint(
          "actual-weight-blocks-completed-basic-helmet-ready",
          width,
          physical,
        );
        await reload();
        await flip();
        await inPlayAction("Weight of the World", "Exhaust Sam Alexander");
        state = await finishChoices();
        assert.equal(state.player.form, "alter");
        assert.equal(state.player.exhausted, true);
        assert.ok(state.removed.some((p) => p.id === f.weightId));
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.helmetId).exhausted,
          true,
        );
      } else if (kind === "nova-recycle") {
        await play("Lightspeed Flight");
        await payIds([f.helmetId]);
        await target("main");
        await findChoice(
          (o) => o.id === f.allyId,
          "Ms. Marvel actual event PLAY",
        );
        await checkpoint(
          "actual-event-discard-before-ms-marvel-cost",
          width,
          physical,
        );
        await reload();
        await choice(f.allyId);
        state = await finishChoices();
        assert.equal(state.scheme.threat, 3);
        assert.ok(state.player.discard.some((p) => p.id === f.allyId));
        assert.equal(
          state.player.hand.filter((p) => p.id === f.eventId).length,
          1,
          "Paid sacrifice returns exact event once",
        );
      } else if (kind === "nova-nemesis" || kind === "iron-nemesis") {
        await choice("go");
        state = await finishChoices();
        assert.equal(
          state.minions.filter(
            (p) => p.code === (kind === "nova-nemesis" ? "28023" : "29030"),
          ).length,
          1,
        );
        assert.equal(
          state.sideSchemes.filter(
            (p) => p.code === (kind === "nova-nemesis" ? "28022" : "29029"),
          ).length,
          1,
        );
        const moved = [
          ...state.minions,
          ...state.sideSchemes,
          ...state.encounter.deck,
          ...state.encounter.discard,
        ];
        for (const id of f.nemesisIds)
          assert.equal(moved.filter((p) => p.id === id).length, 1);
        if (kind === "iron-nemesis") {
          assert.equal(state.player.ironheartIdentity.counters, 0);
          assert.ok(
            state.encounter.discard.some((p) => p.id === f.obligationId),
          );
          assert.ok(
            state.player.setAside
              .filter((p) => /^2900[23]a$/.test(p.code))
              .every((p) => !moved.some((q) => q.id === p.id)),
          );
        }
      } else if (kind === "iron-versions") {
        await identity("Level Up!");
        state = await finishChoices();
        assert.equal(state.player.ironheartIdentity.id, f.versionIds[1]);
        assert.equal(state.player.ironheartIdentity.counters, 7);
        assert.equal(state.player.hp, 7);
        assert.equal(
          await page
            .getByRole("meter", { name: "Hero HP", exact: true })
            .getAttribute("aria-valuemax"),
          "14",
        );
        assert.equal(state.player.exhausted, false);
        assert.equal(state.player.flipped, false);
        assert.equal(state.player.stunned, true);
        await assertFace("29002a");
        await checkpoint(
          "ironheart-same-original-v2-surplus-hp-status",
          width,
          physical,
        );
        await reload();
        await identity("Level Up!");
        state = await finishChoices();
        assert.equal(state.player.ironheartIdentity.id, f.versionIds[2]);
        assert.equal(state.player.ironheartIdentity.counters, 1);
        assert.equal(state.player.hp, 7);
        assert.equal(state.player.tough, true);
        assert.equal(state.player.flipped, false);
        await assertFace("29003a");
        await checkpoint(
          "ironheart-original-v3-ready-tough-with-independent-flip",
          width,
          physical,
        );
        await reload();
        await identity("Maximum Efficiency");
        await target("villain");
        state = await finishChoices();
        assert.equal(state.villain.hp, 48);
        assert.equal(state.player.stunned, true);
        assert.equal(state.player.ironheartIdentity.counters, 0);
        await flip();
        await assertFace("29003b");
        await identity("Child Prodigy");
        await payIds([f.strokeId]);
        await findChoice((o) => o.id === "yes", "Actual Stroke spend response");
        await choice("yes");
        state = await finishChoices();
        assert.equal(state.player.ironheartIdentity.counters, 2);
        assert.ok(state.player.hand.some((p) => p.id === f.drawId));
        assert.equal(state.player.hp, 7);
      } else if (kind === "iron-prodigy-v1") {
        await identity("Child Prodigy");
        state = await save();
        assert.deepEqual(state.prompt.requirements, ["mental"]);
        await checkpoint(
          "v1-child-prodigy-real-mental-requirement-and-cancel",
          width,
          physical,
        );
        await reload();
        await (await paymentSource(f.energyId)).click();
        assert.equal(
          await page
            .getByRole("button", { name: "Confirm payment", exact: true })
            .isDisabled(),
          true,
        );
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        state = await settle();
        assert.equal(state.player.ironheartIdentity.counters, 0);
        assert.ok(state.player.hand.some((p) => p.id === f.energyId));
        await identity("Child Prodigy");
        await payIds([f.strokeId]);
        await findChoice((o) => o.id === "yes", "Actual Stroke spend");
        await choice("yes");
        state = await finishChoices();
        assert.equal(state.player.ironheartIdentity.counters, 2);
        assert.ok(state.player.hand.some((p) => p.id === f.drawId));
        assert.equal(
          await page
            .locator(".identity-info .ability-button")
            .filter({ hasText: "Child Prodigy" })
            .count(),
          0,
          "Committed physical-identity limit used",
        );
      } else if (kind === "iron-prodigy-v2") {
        await assertFace("29002b");
        await identity("Child Prodigy");
        await findChoice(
          (o) => o.id === "any",
          "Version2 alternate printed resource cost",
        );
        await checkpoint(
          "v2-child-prodigy-actual-alternate-cost-choice",
          width,
          physical,
        );
        await reload();
        await choice("any");
        await payIds(f.resourceIds);
        state = await finishChoices();
        assert.equal(state.player.ironheartIdentity.id, f.versionId);
        assert.equal(state.player.ironheartIdentity.counters, 1);
        for (const id of f.resourceIds)
          assert.ok(state.player.discard.some((p) => p.id === id));
      } else if (kind === "iron-photon-fly") {
        await play("Photon Beam");
        state = await save();
        for (const id of f.powerIds)
          assert.deepEqual(
            nativePaymentSources(state).find((p) => p.id === id).resources,
            ["wild"],
            "Leadership resource does not double for signature event",
          );
        await payIds(f.powerIds);
        await target(f.enemyId);
        state = await finishChoices();
        assert.equal(state.player.ironheartIdentity.counters, 2);
        assert.ok(state.encounter.discard.some((p) => p.id === f.enemyId));
        await checkpoint(
          "photon-actual-defeat-gives-two-causal-progress",
          width,
          physical,
        );
        await reload();
        await play("Fly Over");
        await payIds(f.strokeIds);
        for (let i = 0; i < 2; i++) {
          await findChoice(
            (o) => o.id === "yes",
            "Each original Stroke actual SPEND",
          );
          await choice("yes");
        }
        await target("main");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 0);
        assert.equal(state.player.ironheartIdentity.counters, 6);
        for (const id of f.drawIds)
          assert.ok(state.player.hand.some((p) => p.id === id));
      } else if (kind === "iron-resources") {
        await play("Sector Scan");
        state = await save();
        assert.equal(state.prompt.cost, 2);
        for (const id of [f.brawnId, f.ingenuityId])
          assert.deepEqual(
            nativePaymentSources(state).find((p) => p.id === id).resources,
            ["mental"],
          );
        await checkpoint(
          "actual-exhausted-brawn-and-ingenuity-mental-sources",
          width,
          physical,
        );
        await reload();
        await payIds([f.brawnId, f.ingenuityId]);
        state = await finishChoices();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.ingenuityId).exhausted,
          true,
        );
        assert.equal(state.flags.ironheartSectorScanRound, state.round);
        assert.equal(state.encounter.deck[0].id, f.topEncounterId);
        assert.equal(
          await page
            .getByRole("button", { name: "Play now: Photon Beam", exact: true })
            .count(),
          0,
          "Used actual abilities cannot generate extra resources",
        );
      } else if (kind === "iron-tony") {
        await inPlayAction("Tony Stark A.I.", "Tony Stark");
        await findChoice(
          (o) => o.id === f.topIds[0],
          "Actual top two viewed cards",
        );
        await checkpoint("tony-peeks-two-original-source-ids", width, physical);
        await reload();
        await choice(f.topIds[0]);
        state = await finishChoices();
        assert.ok(state.player.hand.some((p) => p.id === f.topIds[0]));
        assert.ok(state.player.discard.some((p) => p.id === f.topIds[1]));
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.tonyId).exhausted,
          true,
        );
      } else if (kind === "pool-no-quarter") {
        await play("No Quarter");
        state = await save();
        assert.deepEqual(state.prompt.requirements, ["physical"]);
        await checkpoint(
          "no-quarter-actual-physical-requirement-honed-mental",
          width,
          physical,
        );
        await reload();
        await payIds(f.resourceIds);
        await target(f.enemyId);
        state = await finishChoices();
        assert.ok(state.encounter.discard.some((p) => p.id === f.enemyId));
        const red = new Set(["28016", "28014", "28012"]);
        for (const p of f.milled)
          assert.equal(
            state.player.hand.some((q) => q.id === p.id),
            red.has(p.code),
            "Exact milled Aggression retrieval " + p.code,
          );
        for (const p of f.milled.filter((p) => !red.has(p.code)))
          assert.ok(state.player.discard.some((q) => q.id === p.id));
      } else if (kind === "pool-moon-girl") {
        await play("Moon Girl");
        await checkpoint(
          "moon-girl-three-actual-hand-resource-cost",
          width,
          physical,
        );
        await reload();
        await payIds(f.resourceIds);
        state = await findChoice(
          (o) => o.id === "yes",
          "Actual Moon Girl hand-PLAY response",
        );
        assert.match(state.prompt.title, /Moon Girl/);
        await checkpoint(
          "moon-girl-actual-two-mental-draw-response",
          width,
          physical,
        );
        await reload();
        await choice("yes");
        state = await finishChoices();
        assert.ok(state.player.inPlay.some((p) => p.id === f.allyId));
        for (const id of f.drawIds)
          assert.ok(state.player.hand.some((p) => p.id === id));
        assert.equal(
          state.player.hand.length,
          2,
          "Two actual allocated Mental resources draw exactly two",
        );
      } else if (kind === "pool-go-all-out") {
        await play("Morale Boost");
        await payIds([f.mentalId]);
        await target("hero");
        state = await finishChoices();
        assert.equal(
          await page.getByLabel("ATK: 3", { exact: true }).count(),
          1,
        );
        assert.equal(
          await page.getByLabel("THW: 2", { exact: true }).count(),
          1,
        );
        assert.equal(
          await page.getByLabel("DEF: 4", { exact: true }).count(),
          1,
        );
        await play("Go All Out");
        await checkpoint(
          "go-all-out-actual-energy-requirement-before-exhaust",
          width,
          physical,
        );
        await reload();
        await payIds(f.resourceIds);
        await target("villain");
        state = await finishChoices();
        assert.equal(state.player.exhausted, true);
        assert.equal(
          state.villain.hp,
          41,
          "Current modified basic powers 3+2+4 determine damage",
        );
      }
      state = await save();
      await checkpoint(kind + "-native-original-ids-result", width, physical);
      await reload();
      console.log(
        "Verified Nova/Ironheart native " + kind + " at " + width + "px",
      );
    }
  }
  checks.push(
    ...scenarios.map(
      (kind) =>
        "Native " +
        kind +
        " preserves original source and identity/encounter IDs through actual UI and exact reload at " +
        widths.join(",") +
        "px",
    ),
  );
  assert.deepEqual(errors, []);
  assert.ok(audits.every((a) => !a.violations.length));
  const entryProof = [];
  for (const entry of entryAssets) {
    const response = await fetch(entry);
    assert.equal(
      response.status,
      200,
      "Verified served production entry bytes",
    );
    const sha256 = createHash("sha256")
      .update(Buffer.from(await response.arrayBuffer()))
      .digest("hex");
    if (process.env.NOVA_IRONHEART_SHA256)
      assert.equal(
        sha256,
        process.env.NOVA_IRONHEART_SHA256,
        "Expected actual production entry SHA256",
      );
    entryProof.push({ url: entry, sha256 });
  }
  await writeFile(
    output + "/report.json",
    JSON.stringify(
      {
        checks,
        audits,
        layouts,
        errors,
        entryAssets: [...entryAssets],
        entryProof,
        sourceDecks: Object.values(sources).map((s) => ({
          code: s.code,
          cards: s.codes.length,
        })),
        viewports: widths,
      },
      null,
      2,
    ),
  );
  for (const name of [
    "failure.json",
    "failure.png",
    "failure-save.json",
    "failure-body.txt",
    "reload-before.json",
  ])
    await rm(output + "/" + name, { force: true });
  console.log(
    JSON.stringify(
      {
        checks,
        audits: audits.length,
        layouts: layouts.length,
        errors,
        entryAssets: [...entryAssets],
      },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    output + "/failure.json",
    JSON.stringify(
      {
        message: String(error),
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
      .screenshot({ path: output + "/failure.png", fullPage: true })
      .catch(() => {});
    await writeFile(
      output + "/failure-save.json",
      JSON.stringify(await save(), null, 2),
    ).catch(() => {});
    await writeFile(
      output + "/failure-body.txt",
      await page.locator("body").innerText(),
    ).catch(() => {});
  }
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
