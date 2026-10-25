import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output =
  process.env.RS_MODULES_OUTPUT || "output/red-skull-modules/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const moduleSpecs = {
  hydra_assault: {
    name: "Hydra Assault",
    codes: ["04145", "04145", "04145", "04146", "04146", "04147"],
  },
  weap_master: {
    name: "Weapon Master",
    codes: ["04148", "04149", "04150", "04150", "04151"],
  },
  hydra_patrol: {
    name: "Hydra Patrol",
    codes: ["04152", "04152", "04153", "04153", "04153", "04154"],
  },
};
const defaults = [
  "remove-knife",
  "remove-sidearm",
  "knife-piercing",
  "sidearm-ranged",
  "weapon-master-attack",
  "weapon-master-surge",
  "weapon-master-scheme",
  "grenade-hero",
  "grenade-alter",
  "regular-incite",
  "soldier-guard",
  "patrol-search",
  "flame-attack",
  "flame-boost",
  "jet-quickstrike",
  "jet-boost",
  "hail-search",
  "hail-attacks",
];
const scenarios = (process.env.RS_MODULES_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.RS_MODULES_VIEWPORTS || "1280,390,320")
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
import {newGame,dispatch,paymentSources,enemyStats} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card} from './src/game/cards.ts';
import {seatView,syncSeat} from './src/game/team.ts';
export function isPlayerDeckPiece(p){return ['event','resource','ally','support','upgrade'].includes(card(p)?.type_code);}
export function definition(p){return card(p);}
export function sourceCodes(id){return heroStarterCodes(id).sort();}
export function stats(s){return enemyStats(s,s.villain);}
export function payment(s){const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);}
export function fixture(kind){
 const module = /^(regular|soldier|patrol)/.test(kind)?'hydra_patrol':/^(flame|jet|hail)/.test(kind)?'hydra_assault':'weap_master';
 const heroId='black_panther',codes=heroStarterCodes(heroId);
 let s=newGame({heroId,aspect:'protection',deckCards:codes,villainId:'rhino',module,seed:4145,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
 for(let n=0;n<30;n++){
  if(s.phase==='mulligan'){command({type:'MULLIGAN',ids:[]});continue;}
  if(s.prompt?.kind==='choice'){command({type:'CHOOSE',id:s.prompt.options[0].id});continue;}
  if(s.prompt?.kind==='select'){command({type:'SELECT',ids:s.prompt.cards.slice(0,s.prompt.min).map(p=>p.id)});continue;}
  break;
 }
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native original source setup incomplete: '+JSON.stringify(s.prompt));
 const sources=s.players.map(seat=>{const p=seatView(s,seat).player;const cards=[...p.hand,...p.deck,...p.discard,...p.inPlay].map(p=>({id:p.id,code:p.code}));if(cards.length!==40)throw Error('Original source must contain forty actual cards');return{seatId:seat.id,heroId:seat.heroId,cards,codes:heroStarterCodes(seat.heroId).sort()};});
 const modular=s.encounter.deck.filter(p=>card(p).set_code===module).map(p=>({id:p.id,code:p.code}));
 const p=s.player;p.deck.push(...p.hand.splice(0),...p.inPlay.splice(0),...p.discard.splice(0));p.form='hero';p.hp=10;p.exhausted=false;p.flipped=false;
 s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 function take(code){for(const zone of[p.hand,p.deck,p.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing original player card '+code);}
 function hand(codes){const ps=codes.map(take);p.hand.push(...ps);return ps;}
 function encounter(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing actual encounter '+code);}
 function attach(code){const a=encounter(code);a.attachedTo=s.villain.id;s.attachments.push(a);return a;}
 function minion(code){const m=encounter(code);m.engagedWith='p1';m.hp=m.maxHp=Number(card(m).health);s.minions.push(m);return m;}
 function native(effects){s.prompt={kind:'choice',title:'Resolve encounter',text:'Resolve the actual source encounter card.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code){const piece=encounter(code);s.resolving.push(piece);native([{type:'reveal',piece,skip:true}]);return piece;}
 function zeroBoost(){const boost=s.encounter.deck.find(p=>Number(card(p).boost||0)===0&&!card(p).boost_star);if(!boost)throw Error('Missing actual zero-boost card');s.encounter.deck.splice(s.encounter.deck.indexOf(boost),1);s.encounter.deck.unshift(boost);return boost;}
 function support(code){const a=take(code);p.inPlay.push(a);return a;}
 let ids={};
 if(kind.startsWith('remove-')){
  const code=kind==='remove-knife'?'04148':'04149';
  const a=reveal(code),[energy,mental,physical]=hand(['01088','01089','01090']);ids={attachmentId:a.id,code,name:card(a).name,energyId:energy.id,mentalId:mental.id,physicalId:physical.id};
 }else if(kind==='knife-piercing'||kind==='sidearm-ranged'){
  const a=attach(kind==='knife-piercing'?'04148':'04149'),boost=zeroBoost();p.tough=kind==='knife-piercing';p.toughCards=p.tough?1:0;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);ids={attachmentId:a.id,boostId:boost.id};
 }else if(kind.startsWith('weapon-master-')){
  const piece=reveal('04150');s.prompt.options[0].effects.push({type:'revealDealt'});
  if(kind!=='weapon-master-attack')ids.attachmentId=attach('04149').id;
  const boost=zeroBoost();
  if(kind!=='weapon-master-attack'){const surge=encounter('01101');s.encounter.deck.splice(1,0,surge);ids.surgeId=surge.id;}
  p.form=kind==='weapon-master-scheme'?'alter':'hero';ids={...ids,revealedId:piece.id,boostId:boost.id,deckBefore:s.encounter.deck.length};
 }else if(kind.startsWith('grenade-')){
  p.form=kind==='grenade-alter'?'alter':'hero';ids={revealedId:reveal('04151').id};
 }else if(kind==='regular-incite'){
  ids={minionId:reveal('04152').id};
 }else if(kind==='soldier-guard'){
  const m=minion('04153');m.damage=2;m.hp=2;ids={minionId:m.id,dealtBefore:s.encounter.dealt.length};
 }else if(kind==='patrol-search'){
  const side=encounter('04154');side.counters=1;s.sideSchemes.push(side);const regular=s.encounter.deck.find(q=>q.code==='04152');ids={sideId:side.id,selectedId:regular.id};
 }else if(kind==='flame-attack'||kind==='flame-boost'){
  const discarded=support('01045'),retained=support('01092');
  if(kind==='flame-attack'){const m=minion('04145');ids.minionId=m.id;native([{type:'enemyAttack',id:m.id,actorId:'p1'}]);}
  else{const boost=encounter('04145');s.encounter.deck.unshift(boost);ids.boostId=boost.id;ids.boostIcons=Number(card(boost).boost||0);native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}
  ids={...ids,discardId:discarded.id,retainedId:retained.id};
 }else if(kind==='jet-quickstrike'){
  ids={minionId:reveal('04146').id};
 }else if(kind==='jet-boost'){
  const boost=encounter('04146');s.encounter.deck.unshift(boost);native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);ids={boostId:boost.id,boostIcons:Number(card(boost).boost||0),deckBefore:s.encounter.deck.length};
 }else if(kind==='hail-search'){
  p.form='alter';ids={revealedId:reveal('04147').id,selectedId:s.encounter.deck.find(q=>q.code==='04145').id};
 }else if(kind==='hail-attacks'){
  const m=minion('04146');ids={minionId:m.id,revealedId:reveal('04147').id};
 }else throw Error('Unknown fixture '+kind);
 syncSeat(s);return{state:s,sources,modular,module,villainHP:s.villain.hp,identities:[],...ids};
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
  assert.deepEqual(
    pieces
      .filter((piece) => definition(piece).set_code === f.module)
      .map((piece) => `${piece.id}:${piece.code}`)
      .sort(),
    f.modular.map((piece) => `${piece.id}:${piece.code}`).sort(),
    `${label}: no extra or missing physical module cards`,
  );
  assert.deepEqual(
    f.modular.map((piece) => piece.code).sort(),
    moduleSpecs[f.module].codes,
    `${label}: exact original ${f.module} quantities`,
  );
}
if (process.env.RS_MODULES_FIXTURE_CHECK) {
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
const entryResponses = new Map();
let context, page, current;
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function open(f, width) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: width > 1000 ? 1000 : 844 },
    reducedMotion: "reduce",
    ignoreHTTPSErrors: process.env.RS_MODULES_IGNORE_HTTPS_ERRORS === "1",
  });
  page = await context.newPage();
  page.setDefaultTimeout(30_000);
  page.setDefaultNavigationTimeout(45_000);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("response", (response) => {
    const asset = response.url();
    if (/\/assets\/index-[^/]+\.js$/.test(asset) && !entryResponses.has(asset))
      entryResponses.set(
        asset,
        response
          .body()
          .then((body) => ({
            status: response.status(),
            sha256: createHash("sha256").update(body).digest("hex"),
          }))
          .catch((error) => ({ error: String(error) })),
      );
  });
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("red-skull-modules-fixture-loaded")) return;
    sessionStorage.setItem("red-skull-modules-fixture-loaded", "yes");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
  }, f?.state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const src of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((s) => s.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(src)) entryAssets.add(src);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.RS_MODULES_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.RS_MODULES_ASSET),
      ),
      "Expected immutable production entry",
    );
  }
  if (process.env.RS_MODULES_SHA256) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry is required for SHA verification",
    );
    for (const asset of entryAssets) {
      const response = await entryResponses.get(asset);
      assert.ok(
        response,
        "Capture the actual browser-loaded entry bytes before testing",
      );
      assert.equal(response.status, 200);
      assert.equal(
        response.sha256,
        process.env.RS_MODULES_SHA256,
        "Expected immutable browser entry SHA256",
      );
    }
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
  const index = state.prompt.options.findIndex((option) => option.id === id);
  assert.ok(
    index >= 0,
    `${state.prompt.title}: missing exact native choice ${id}`,
  );
  await page.locator(".decision-option").nth(index).click();
  return settle();
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
async function advanceNative(stop = () => false) {
  for (let n = 0; n < 80; n++) {
    const state = await settle();
    if (stop(state) || !state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const selected = state.prompt.options.find((option) =>
      /^(take|resolve|allow|pass|skip|none|done|continue|no)$/.test(option.id),
    );
    if (selected) await choice(selected.id);
    else if (
      state.prompt.title === "Forced responses" ||
      state.prompt.options.length === 1
    )
      await choice(state.prompt.options[0].id);
    else
      throw Error("Unhandled native choice: " + JSON.stringify(state.prompt));
  }
  throw Error("Native continuation did not finish");
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
try {
  if (!process.env.RS_MODULES_FIXTURE_ONLY) {
    for (const module of Object.keys(moduleSpecs))
      for (const width of widths) {
        current = { kind: "modular-selector", module, width };
        await open(null, width);
        const select = page.getByLabel("Modular encounter");
        await select.waitFor({ state: "visible" });
        assert.equal(
          await select.locator(`option[value="${module}"]`).count(),
          1,
          "Complete module exposed in public setup",
        );
        await select.selectOption(module);
        await page.locator("#start-btn").click();
        await page
          .getByRole("button", { name: "Keep hand & begin", exact: true })
          .click();
        const state = await advanceNative();
        assert.equal(state.module, module);
        const modular = allPieces(state)
          .filter((p) => definition(p).set_code === module)
          .map((p) => ({ id: p.id, code: p.code }));
        const cards = [
          ...state.player.hand,
          ...state.player.deck,
          ...state.player.discard,
          ...state.player.inPlay,
        ].map((p) => ({ id: p.id, code: p.code }));
        const f = {
          module,
          sources: [
            {
              seatId: state.activePlayerId,
              heroId: state.heroId,
              cards,
              codes: sourceCodes(state.heroId),
            },
          ],
          modular,
          identities: [],
        };
        await checkpoint(`${module}-public-original-source`, width, f);
        await reload();
        checks.push({
          kind: "modular-selector",
          module,
          width,
          sourceCards: 40,
          modularCards: modular.length,
          exactReload: true,
        });
      }
  }
  for (const kind of scenarios)
    for (const width of widths) {
      current = { kind, width };
      const f = fixture(kind);
      await open(f, width);
      let state;
      if (kind.startsWith("remove-")) {
        await choice("go");
        state = await advanceNative();
        assert.ok(
          state.attachments.some(
            (p) => p.id === f.attachmentId && p.attachedTo === state.villain.id,
          ),
        );
        assert.equal(stats(state).attack, 3);
        const host = page.locator(".attached-piece").filter({
          has: page.getByRole("button", {
            name: "Inspect " + f.name + ", attached to Rhino",
            exact: true,
          }),
        });
        const action = host.getByRole("button", {
          name: /^Spend mental \+ physical resources/,
        });
        assert.equal(
          await action.innerText(),
          "Remove",
          "Compact action keeps the full typed cost in its accessible name",
        );
        assert.equal(await action.isDisabled(), false);
        await action.click();
        state = await settle();
        assert.equal(state.prompt.kind, "payment");
        await checkpoint(kind + "-typed-payment", width, f);
        await reload();
        await (await paymentSource(f.energyId)).click();
        assert.equal(
          await page
            .getByRole("button", { name: "Confirm payment", exact: true })
            .isDisabled(),
          true,
          "Energy cannot pay either required type",
        );
        await (await paymentSource(f.energyId)).click();
        await (await paymentSource(f.mentalId)).click();
        assert.equal(
          await page
            .getByRole("button", { name: "Confirm payment", exact: true })
            .isDisabled(),
          true,
          "Mental alone cannot pay the Physical requirement",
        );
        await (await paymentSource(f.mentalId)).click();
        await pay([f.mentalId, f.physicalId]);
        state = await advanceNative();
        assert.ok(!state.attachments.some((p) => p.id === f.attachmentId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.attachmentId));
        assert.ok(
          [f.mentalId, f.physicalId].every((id) =>
            state.player.discard.some((p) => p.id === id),
          ),
        );
        assert.ok(state.player.hand.some((p) => p.id === f.energyId));
        assert.equal(stats(state).attack, 2);
      } else if (kind === "knife-piercing" || kind === "sidearm-ranged") {
        await choice("go");
        state = await advanceNative();
        assert.equal(state.player.hp, 7);
        assert.ok(!state.player.tough);
        assert.equal(
          state.villain.hp,
          kind === "sidearm-ranged" ? f.villainHP : f.villainHP - 1,
          "Only the ranged attack suppresses Black Panther Retaliate",
        );
      } else if (kind.startsWith("weapon-master-")) {
        await choice("go");
        state = await advanceNative();
        assert.ok(state.encounter.discard.some((p) => p.id === f.revealedId));
        if (kind === "weapon-master-scheme") {
          assert.equal(state.scheme.threat, 1);
          assert.equal(state.player.hp, 10);
        } else
          assert.equal(
            state.player.hp,
            kind === "weapon-master-attack" ? 8 : 7,
          );
        assert.equal(
          state.encounter.deck.length,
          f.deckBefore - (f.surgeId ? 2 : 1),
          "Only the actual boost and, with a Weapon, one surge card leave the deck",
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
        if (f.surgeId)
          assert.ok(
            state.minions.some((p) => p.id === f.surgeId),
            "A real Weapon attachment adds one native surge reveal after the activation",
          );
        else
          assert.equal(
            state.minions.length,
            0,
            "No Weapon means no extra surge reveal",
          );
      } else if (kind.startsWith("grenade-")) {
        await choice("go");
        state = await advanceNative();
        assert.ok(state.encounter.discard.some((p) => p.id === f.revealedId));
        if (kind === "grenade-hero") {
          assert.equal(state.player.hp, 9);
          assert.ok(state.player.stunned);
          assert.equal(state.scheme.threat, 0);
        } else {
          assert.equal(state.player.hp, 10);
          assert.ok(state.player.confused);
          assert.equal(state.scheme.threat, 1);
        }
      } else if (kind === "regular-incite") {
        await choice("go");
        state = await advanceNative();
        assert.equal(
          state.scheme.threat,
          1,
          "The original Hydra Regular reveals with Incite 1",
        );
        assert.ok(
          state.minions.some(
            (p) => p.id === f.minionId && p.engagedWith === "p1",
          ),
        );
      } else if (kind === "soldier-guard") {
        await page.locator(".attack-action").click();
        state = await settle();
        if (state.prompt) {
          const targets = await findChoice(
            (o) => o.id === f.minionId,
            "Native Guard attack target",
          );
          assert.ok(
            !targets.prompt.options.some((o) => o.id === state.villain.id),
            "Guard excludes the villain",
          );
          await choice(f.minionId);
        }
        state = await advanceNative();
        assert.equal(state.villain.hp, f.villainHP);
        assert.ok(!state.minions.some((p) => p.id === f.minionId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.minionId));
        assert.equal(
          state.encounter.dealt.length,
          f.dealtBefore + 1,
          "The engaged player receives one actual encounter card after defeat",
        );
        assert.equal(state.encounter.dealt.at(-1).dealtTo, "p1");
      } else if (kind === "patrol-search") {
        await page.locator(".thwart-action").click();
        state = await settle();
        if (state.prompt?.options.some((o) => o.id === f.sideId))
          await choice(f.sideId);
        state = await advanceNative((s) =>
          s.prompt?.options.some((o) => o.id === f.selectedId),
        );
        assert.equal(state.prompt?.title, "Hydra Patrol");
        assert.ok(!state.sideSchemes.some((p) => p.id === f.sideId));
        await checkpoint("patrol-original-minion-choice", width, f);
        await reload();
        await choice(f.selectedId);
        state = await advanceNative();
        assert.ok(
          state.minions.some(
            (p) => p.id === f.selectedId && p.engagedWith === "p1",
          ),
        );
        assert.equal(
          state.scheme.threat,
          0,
          "PUT does not trigger Hydra Regular's reveal-only Incite",
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.sideId));
      } else if (kind === "flame-attack" || kind === "flame-boost") {
        await choice("go");
        state = await advanceNative((s) =>
          s.prompt?.options.some((o) => o.id === f.discardId),
        );
        assert.equal(state.prompt?.title, "Hydra Flame-Soldier");
        assert.deepEqual(
          state.prompt.options.map((o) => o.id).sort(),
          [f.discardId, f.retainedId].sort(),
          "Only actually controlled supports can be discarded",
        );
        await checkpoint(kind + "-actual-support-choice", width, f);
        await reload();
        await choice(f.discardId);
        state = await advanceNative();
        assert.ok(state.player.discard.some((p) => p.id === f.discardId));
        assert.ok(state.player.inPlay.some((p) => p.id === f.retainedId));
        assert.equal(
          state.player.hp,
          10 - (kind === "flame-attack" ? 1 : 2 + f.boostIcons),
        );
      } else if (kind === "jet-quickstrike" || kind === "jet-boost") {
        await choice("go");
        state = await advanceNative();
        if (kind === "jet-quickstrike") {
          assert.equal(state.player.hp, 8);
          assert.ok(
            state.minions.some(
              (p) => p.id === f.minionId && p.engagedWith === "p1",
            ),
          );
        } else {
          assert.equal(
            state.player.hp,
            6 - f.boostIcons,
            "The villain completes its first attack and then a second attack",
          );
          assert.equal(
            state.encounter.deck.length,
            f.deckBefore - 1,
            "The follow-up attack deals no new boost cards",
          );
          assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
          assert.equal(
            state.villain.hp,
            f.villainHP - 2,
            "Both actual attacks complete Black Panther Retaliate",
          );
        }
      } else if (kind === "hail-search") {
        await choice("go");
        state = await advanceNative((s) =>
          s.prompt?.options.some((o) => o.id === f.selectedId),
        );
        assert.equal(state.prompt?.title, "Hail Hydra!");
        await checkpoint("hail-original-minion-choice", width, f);
        await reload();
        await choice(f.selectedId);
        state = await advanceNative();
        assert.ok(
          state.minions.some(
            (p) => p.id === f.selectedId && p.engagedWith === "p1",
          ),
        );
        assert.equal(state.player.hp, 10);
        assert.ok(state.encounter.discard.some((p) => p.id === f.revealedId));
      } else if (kind === "hail-attacks") {
        await choice("go");
        state = await advanceNative();
        assert.equal(state.player.hp, 8);
        assert.equal(
          state.minions.length,
          1,
          "An actually attacked hero does not search for another Hydra minion",
        );
        assert.equal(state.minions[0].id, f.minionId);
        assert.ok(state.encounter.discard.some((p) => p.id === f.revealedId));
      }
      state = await save();
      assert.ok(!state.error, state.error);
      assert.ok(!state.prompt, "Every selected native flow is complete");
      assert.equal(state.queue.length, 0, "Native continuation fully resolved");
      assert.ok(
        !state.attack && !state.scheming,
        "Every activation has completed",
      );
      await checkpoint(kind + "-native-result", width, f);
      await reload();
      checks.push({
        kind,
        module: f.module,
        width,
        sourceCards: 40,
        modularCards: f.modular.length,
        exactReload: true,
      });
      console.log(
        "Verified native Red Skull modular flow " +
          kind +
          " at " +
          width +
          "px",
      );
    }
  assert.deepEqual(errors, []);
  const entryProof = [];
  for (const asset of entryAssets) {
    const response = await entryResponses.get(asset);
    assert.ok(response, "Capture the actual browser-loaded entry response");
    assert.equal(
      response.status,
      200,
      "Served immutable production entry bytes",
    );
    const sha256 = response.sha256;
    if (process.env.RS_MODULES_SHA256)
      assert.equal(
        sha256,
        process.env.RS_MODULES_SHA256,
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
        baseURL: url,
        ignoreHTTPSErrors: process.env.RS_MODULES_IGNORE_HTTPS_ERRORS === "1",
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
