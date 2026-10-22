import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output =
  process.env.WEAPONS_OUTPUT || "output/experimental-weapons/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const defaults = [
  "reveal-all",
  "remove-rifle",
  "remove-shield",
  "remove-gauntlets",
  "remove-suit",
  "gauntlets-damage",
  "gauntlets-tough",
  "rifle-ranged",
  "shield-retaliate",
  "suit-scheme",
];
const scenarios = (process.env.WEAPONS_SCENARIOS || defaults.join(","))
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const widths = (process.env.WEAPONS_VIEWPORTS || "1920,1280,390,320")
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
 const heroId='black_panther',codes=heroStarterCodes(heroId);
 let s=newGame({heroId,aspect:'protection',deckCards:codes,villainId:'rhino',module:'exper_weapon',seed:4072,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}return s;}
 for(let n=0;n<30;n++){
  if(s.phase==='mulligan'){command({type:'MULLIGAN',ids:[]});continue;}
  if(s.prompt?.kind==='choice'){command({type:'CHOOSE',id:s.prompt.options[0].id});continue;}
  if(s.prompt?.kind==='select'){command({type:'SELECT',ids:s.prompt.cards.slice(0,s.prompt.min).map(p=>p.id)});continue;}
  break;
 }
 if(s.phase!=='player'||s.prompt||s.review)throw Error('Native original source setup incomplete: '+JSON.stringify(s.prompt));
 const sources=s.players.map(seat=>{const p=seatView(s,seat).player;const cards=[...p.hand,...p.deck,...p.discard,...p.inPlay].map(p=>({id:p.id,code:p.code}));if(cards.length!==40)throw Error('Original source must contain40actualcards');return{seatId:seat.id,heroId:seat.heroId,cards,codes:heroStarterCodes(seat.heroId).sort()};});
 const modular=s.encounter.deck.filter(p=>card(p).set_code==='exper_weapon').map(p=>({id:p.id,code:p.code}));if(modular.length!==4)throw Error('Exactly4actualExperimentalWeaponscardsrequired');
 const p=s.player;p.deck.push(...p.hand.splice(0),...p.inPlay.splice(0),...p.discard.splice(0));p.form='hero';p.hp=10;p.exhausted=false;p.flipped=false;
 s.villain.hp=s.villain.maxHp=50;s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 function take(code){for(const zone of[p.hand,p.deck,p.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missingoriginalsource '+code);}
 function hand(codes){const ps=codes.map(take);p.hand.push(...ps);return ps;}
 function encounter(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missingactualencounter '+code);}
 function attach(code){const a=encounter(code);a.attachedTo=s.villain.id;s.attachments.push(a);return a;}
 function native(effects){s.prompt={kind:'choice',title:'Resolve encounter',text:'Resolve the actual source encounter card.',options:[{id:'go',label:'Continue',effects}]};}
 function zeroBoost(){const boost=s.encounter.deck.find(p=>Number(card(p).boost||0)===0&&!card(p).boost_star);if(!boost)throw Error('Missingactualzeroboost');s.encounter.deck.splice(s.encounter.deck.indexOf(boost),1);s.encounter.deck.unshift(boost);return boost;}
 let ids={};
 if(kind==='reveal-all'){
  const ps=['04072','04073','04074','04075'].map(encounter);s.resolving.push(...ps);native(ps.map(piece=>({type:'reveal',piece,skip:true})));ids={attachmentIds:ps.map(p=>p.id)};
 }else if(kind.startsWith('remove-')){
  const code={'remove-rifle':'04072','remove-shield':'04073','remove-gauntlets':'04074','remove-suit':'04075'}[kind];
  const a=attach(code),[energy,mental,physical]=hand(['01088','01089','01090']);ids={attachmentId:a.id,code,name:card(a).name,energyId:energy.id,mentalId:mental.id,physicalId:physical.id};
 }else if(kind==='gauntlets-damage'||kind==='gauntlets-tough'){
  const a=attach('04074'),[discard,retained]=hand(['01088','01089']),boost=zeroBoost();p.tough=kind==='gauntlets-tough';p.toughCards=p.tough?1:0;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);ids={attachmentId:a.id,discardId:discard.id,retainedId:retained.id,boostId:boost.id};
 }else if(kind==='rifle-ranged'){
  const a=attach('04072'),boost=zeroBoost();native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);ids={attachmentId:a.id,boostId:boost.id};
 }else if(kind==='shield-retaliate'){
  ids={attachmentId:attach('04073').id};
 }else if(kind==='suit-scheme'){
  const a=attach('04075'),boost=zeroBoost();p.form='alter';native([{type:'enemyScheme',id:s.villain.id,actorId:'p1'}]);ids={attachmentId:a.id,boostId:boost.id};
 }else throw Error('Unknownfixture '+kind);
 syncSeat(s);return{state:s,sources,modular,identities:[],...ids};
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
  assert.equal(f.modular.length, 4);
  assert.deepEqual([...new Set(f.modular.map((p) => p.code))].sort(), [
    "04072",
    "04073",
    "04074",
    "04075",
  ]);
}
if (process.env.WEAPONS_FIXTURE_CHECK) {
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
    ignoreHTTPSErrors: process.env.WEAPONS_IGNORE_HTTPS_ERRORS === "1",
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
    if (sessionStorage.getItem("weapons-fixture-loaded")) return;
    sessionStorage.setItem("weapons-fixture-loaded", "yes");
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
  if (process.env.WEAPONS_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.WEAPONS_ASSET),
      ),
      "Expected immutable production entry",
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
  const index = state.prompt.options.findIndex((option) => option.id === id);
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
async function defense() {
  return findChoice(
    (o) => o.id === "take" && /Take the attack/.test(o.label),
    "Native defense declaration",
  );
}
async function finishAttack() {
  for (let n = 0; n < 40; n++) {
    const state = await save();
    if (!state.prompt || state.prompt.title === "Power Gauntlets") return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    if (state.prompt.title === "Forced responses") {
      const gauntlets = state.prompt.options.find(
        (o) => o.label === "Power Gauntlets",
      );
      assert.ok(
        gauntlets,
        "Native ordering offers the actual Gauntlets response alongside Retaliate",
      );
      await choice(gauntlets.id);
      continue;
    }
    const selected = state.prompt.options.find((o) =>
      /^(take|resolve|allow|pass|skip|none|done|continue|no)$/.test(o.id),
    );
    assert.ok(
      selected,
      "Unexpected native attack prompt " + JSON.stringify(state.prompt),
    );
    await choice(selected.id);
  }
  throw Error("Attack did not finish");
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
function seat(state, id) {
  return state.activePlayerId === id
    ? state.player
    : state.players.find((seat) => seat.id === id).player;
}

try {
  if (!process.env.WEAPONS_FIXTURE_ONLY) {
    for (const width of widths) {
      current = { kind: "modular-selector", width };
      await open(null, width);
      const select = page.getByLabel("Modular encounter");
      assert.equal(
        await select.locator('option[value="exper_weapon"]').count(),
        1,
        "Complete module exposed in public setup",
      );
      await select.selectOption("exper_weapon");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      let state = await settle();
      state = await finishChoices();
      assert.equal(state.module, "exper_weapon");
      const modular = allPieces(state)
        .filter((p) => definition(p).set_code === "exper_weapon")
        .map((p) => ({ id: p.id, code: p.code }));
      const cards = [
        ...state.player.hand,
        ...state.player.deck,
        ...state.player.discard,
        ...state.player.inPlay,
      ].map((p) => ({ id: p.id, code: p.code }));
      const f = {
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
      await checkpoint("modular-selector-original-source", width, f);
      await reload();
      checks.push({
        kind: "modular-selector",
        width,
        sourceCards: 40,
        modularCards: 4,
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
      if (kind === "reveal-all") {
        await choice("go");
        state = await finishChoices();
        assert.deepEqual(
          state.attachments
            .filter((p) => f.attachmentIds.includes(p.id))
            .map((p) => p.code)
            .sort(),
          ["04072", "04073", "04074", "04075"],
        );
        assert.ok(
          state.attachments
            .filter((p) => f.attachmentIds.includes(p.id))
            .every((p) => p.attachedTo === state.villain.id),
        );
        assert.equal(stats(state).attack, 4);
        assert.equal(stats(state).scheme, 2);
        const displayed = await page.locator(".enemy-stats").innerText();
        assert.match(displayed, /4/);
        assert.match(displayed, /2/);
        for (const name of [
          "Laser Rifle",
          "Energy Shield",
          "Power Gauntlets",
          "Exo-Suit",
        ])
          assert.equal(
            await page
              .getByRole("button", {
                name: "Inspect " + name + ", attached to Rhino",
                exact: true,
              })
              .count(),
            1,
          );
      } else if (kind.startsWith("remove-")) {
        const host = page.locator(".attached-piece").filter({
          has: page.getByRole("button", {
            name: "Inspect " + f.name + ", attached to Rhino",
            exact: true,
          }),
        });
        const action = host.getByRole("button", { name: /^Spend / });
        assert.equal(
          await action.innerText(),
          "Remove",
          "Compact visible action retains the full typed cost in its accessible name",
        );
        assert.equal(await action.isDisabled(), false);
        await action.click();
        state = await settle();
        assert.equal(state.prompt.kind, "payment");
        await checkpoint(kind + "-typed-payment", width, f);
        await reload();
        const required =
          kind === "remove-rifle"
            ? [f.energyId, f.physicalId]
            : kind === "remove-shield"
              ? [f.energyId, f.mentalId]
              : kind === "remove-gauntlets"
                ? [f.mentalId, f.physicalId]
                : [f.energyId, f.mentalId, f.physicalId];
        await (await paymentSource(required[0])).click();
        assert.equal(
          await page
            .getByRole("button", { name: "Confirm payment", exact: true })
            .isDisabled(),
          true,
          "Wrong/incomplete types cannot pay",
        );
        await (await paymentSource(required[0])).click();
        await pay(required);
        state = await finishChoices();
        assert.ok(!state.attachments.some((p) => p.id === f.attachmentId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.attachmentId));
        assert.ok(
          required.every((id) => state.player.discard.some((p) => p.id === id)),
        );
        assert.equal(stats(state).attack, 2);
        assert.equal(stats(state).scheme, 1);
      } else if (
        kind === "gauntlets-damage" ||
        kind === "gauntlets-tough" ||
        kind === "rifle-ranged"
      ) {
        await choice("go");
        await defense();
        await choice("take");
        state = await finishAttack();
        if (kind === "gauntlets-damage") {
          assert.equal(state.player.hp, 8);
          assert.equal(state.prompt.title, "Power Gauntlets");
          assert.deepEqual(
            state.prompt.options.map((o) => o.id).sort(),
            [f.discardId, f.retainedId].sort(),
          );
          await checkpoint("gauntlets-actual-damage-discard-choice", width, f);
          await reload();
          await choice(f.discardId);
          state = await finishAttack();
          assert.ok(state.player.discard.some((p) => p.id === f.discardId));
          assert.ok(state.player.hand.some((p) => p.id === f.retainedId));
        } else if (kind === "gauntlets-tough") {
          assert.equal(state.player.hp, 10);
          assert.ok(!state.player.tough);
          assert.deepEqual(
            state.player.hand.map((p) => p.id).sort(),
            [f.discardId, f.retainedId].sort(),
          );
          assert.ok(!state.prompt);
        } else {
          assert.equal(state.player.hp, 7);
          assert.equal(
            state.villain.hp,
            50,
            "Ranged attack suppresses Black Panther retaliate",
          );
          assert.ok(!state.prompt);
        }
      } else if (kind === "shield-retaliate") {
        await page.locator(".attack-action").click();
        state = await settle();
        // The native engine may resolve its only legal target directly.
        if (state.prompt) {
          await findChoice(
            (o) => o.id === f.state.villain.id,
            "Actual villain target",
          );
          await choice(f.state.villain.id);
        }
        state = await finishChoices();
        assert.equal(state.villain.hp, 48);
        assert.equal(
          state.player.hp,
          9,
          "Energy Shield grants one actual Retaliate",
        );
      } else if (kind === "suit-scheme") {
        await choice("go");
        state = await finishChoices();
        assert.equal(
          state.scheme.threat,
          2,
          "Exo-Suit modifies native scheme by one",
        );
        assert.equal(state.player.hp, 10);
      }
      state = await save();
      assert.ok(!state.error, state.error);
      await checkpoint(kind + "-native-result", width, f);
      await reload();
      checks.push({
        kind,
        width,
        sourceCards: 40,
        modularCards: 4,
        exactReload: true,
      });
      console.log(
        "Verified native Experimental Weapons " + kind + " at " + width + "px",
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
    if (process.env.WEAPONS_SHA256)
      assert.equal(
        sha256,
        process.env.WEAPONS_SHA256,
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
