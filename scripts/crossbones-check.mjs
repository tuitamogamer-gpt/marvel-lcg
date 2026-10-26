import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.CROSSBONES_OUTPUT || "output/crossbones/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const defaults = [
  "armor-replace",
  "armor-counter",
  "gun-interrupt",
  "gun-empty",
  "full-auto",
  "bomber-damage",
  "bomber-threat",
  "hard-as-nails",
  "raid-armory",
  "cornered-staff",
  "assault",
  "main-two",
  "main-loss",
  "villain-stage",
  "villain-expert",
  "villain-win",
  "weapon-removal",
  "steel-fist-stage",
  "scarlet-full-auto",
];
const scenarios = (process.env.CROSSBONES_SCENARIOS || defaults.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const widths = (process.env.CROSSBONES_VIEWPORTS || "1280,768,390,320")
  .split(",")
  .map(Number);
assert.ok(scenarios.length && scenarios.every((s) => defaults.includes(s)));
assert.ok(widths.length && widths.every((w) => w >= 320));
await mkdir(output, { recursive: true });
for (const name of [
  "report.json",
  "failure.json",
  "failure.png",
  "failure-save.json",
  "failure-body.txt",
])
  await rm(output + "/" + name, { force: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {newGame,dispatch,paymentSources,enemyStats} from './src/game/engine.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {card} from './src/game/cards.ts';
import {seatView,syncSeat} from './src/game/team.ts';
export const definition=p=>card(p);
export const sourceCodes=id=>heroStarterCodes(id).sort();
export const stats=s=>enemyStats(s,s.villain);
export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};
export function fixture(kind){
 const heroId=kind==='steel-fist-stage'?'colossus':kind==='scarlet-full-auto'?'scw':'black_panther';
 let s=newGame({heroId,aspect:heroId==='scw'?'justice':'protection',deckCards:heroStarterCodes(heroId),villainId:'crossbones',difficulty:kind==='villain-expert'?'expert':'standard',seed:4058,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);for(let n=0;s.review&&n<100;n++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}return s;}
 for(let n=0;n<100;n++){
  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}
  if(s.prompt?.kind==='choice'){const option=s.prompt.options.find(o=>/^(pass|skip|none|done|continue|no)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:option.id});continue;}
  if(s.prompt?.kind==='select'){command({type:'SELECT',ids:s.prompt.cards.slice(0,s.prompt.min).map(p=>p.id)});continue;}
  break;
 }
 if(s.phase!=='player'||s.prompt||s.review||!s.crossbones)throw Error('Actual original Crossbones setup incomplete');
 const p=s.player;p.deck.push(...p.hand.splice(0));p.form='hero';p.hp=10;p.exhausted=false;p.flipped=false;p.tough=false;p.toughCards=0;
 // These original attachments have been discarded in this focused game position.
 for(const attachment of s.attachments.splice(0)){delete attachment.attachedTo;attachment.counters=0;attachment.damage=0;s.encounter.discard.push(attachment);}
 s.scheme.threat=0;s.queue=[];s.prompt=null;s.review=null;
 function take(code){for(const zone of[p.hand,p.deck,p.discard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing source player card '+code);}
 function hand(codes){const ps=codes.map(take);p.hand.push(...ps);return ps;}
 function encounter(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,s.crossbones.weaponDeck]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0]}throw Error('Missing physical encounter '+code);}
 function order(codes){const ps=codes.map(encounter);s.encounter.deck.unshift(...ps);return ps;}
 function attach(code){const a=encounter(code);a.attachedTo=s.villain.id;a.damage=0;a.counters=code==='04064'?2:0;s.attachments.push(a);return a;}
 function native(effects){s.prompt={kind:'choice',title:'Original Crossbones encounter',text:'Resolve the actual original-source encounter.',options:[{id:'go',label:'Continue',effects}]};}
 function reveal(code){const piece=encounter(code);s.resolving.push(piece);return{type:'reveal',piece,skip:true,actorId:'p1'};}
 function zeroBoost(){const boost=s.encounter.deck.find(p=>Number(card(p).boost||0)===0&&!card(p).boost_star);if(!boost)throw Error('No original zero boost');s.encounter.deck.splice(s.encounter.deck.indexOf(boost),1);s.encounter.deck.unshift(boost);return boost;}
 const ids={initialHp:s.villain.hp,weaponDeckBefore:s.crossbones.weaponDeck.length};
 if(kind==='armor-replace'||kind==='armor-counter'){
  const a=attach('04065');ids.attachmentId=a.id;native([{type:'damage',target:s.villain.id,amount:kind==='armor-replace'?7:2,source:'hero',actorId:'p1'}]);
 }else if(kind==='gun-interrupt'||kind==='gun-empty'){
  const gun=attach('04064');gun.counters=kind==='gun-empty'?1:2;ids.attachmentId=gun.id;ids.boostId=zeroBoost().id;ids.discardId=order(['04065'])[0].id;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);
 }else if(kind==='scarlet-full-auto'){
  const effect=reveal('04067');ids.triggerId=effect.piece.id;const cards=order(['04065','04066']);ids.originalCountId=cards[0].id;ids.replacementId=cards[1].id;native([effect]);
 }else if(kind==='full-auto'){
  const effect=reveal('04067');ids.triggerId=effect.piece.id;ids.attachmentId=attach('04148').id;ids.discardIds=order(['04065','04066']).map(p=>p.id);native([effect]);
 }else if(kind==='bomber-damage'||kind==='bomber-threat'){
  const effect=reveal('04066');ids.minionId=effect.piece.id;native([effect]);
 }else if(kind==='hard-as-nails'){
  s.villain.hp-=4;s.villain.damage=4;s.villain.tough=true;s.villain.toughCards=1;ids.initialHp=s.villain.hp;const effect=reveal('04068');ids.triggerId=effect.piece.id;native([effect]);
 }else if(kind==='raid-armory'){
  const effect=reveal('04069');ids.triggerId=effect.piece.id;const ps=order(['04066','04148']);ids.discardId=ps[0].id;ids.attachmentId=ps[1].id;native([effect]);
 }else if(kind==='cornered-staff'){
  const effect=reveal('04071');ids.sideId=effect.piece.id;ids.discardId=order(['04065'])[0].id;native([effect]);
 }else if(kind==='assault'){
  const side=encounter('04070');side.counters=1;s.sideSchemes.push(side);ids.sideId=side.id;ids.boostId=zeroBoost().id;
 }else if(kind==='main-two'||kind==='main-loss'){
  native([{type:'threat',target:'main',amount:3,actorId:'p1'},...(kind==='main-loss'?[{type:'threat',target:'main',amount:6,actorId:'p1'},{type:'threat',target:'main',amount:5,actorId:'p1'}]:[])]);
 }else if(kind==='villain-stage'||kind==='villain-expert'||kind==='villain-win'){
  native([{type:'damage',target:s.villain.id,amount:99,source:'hero',actorId:'p1'},...(kind==='villain-win'?[{type:'damage',target:s.crossbones.villainDeck[0].id,amount:99,source:'hero',actorId:'p1'}]:[])]);
 }else if(kind==='steel-fist-stage'){
  s.villain.hp=1;s.villain.damage=s.villain.maxHp-1;p.tough=true;p.toughCards=1;
  const cards=hand(['32008','32024']);ids.eventId=cards[0].id;ids.paymentIds=[cards[1].id];ids.originalVillainId=s.villain.id;ids.nextVillainId=s.crossbones.villainDeck[0].id;
 }else if(kind==='weapon-removal'){
  const effect=reveal('04072');ids.attachmentId=effect.piece.id;ids.paymentIds=hand(['01088','01090']).map(p=>p.id);native([effect]);
 }else throw Error('Unknown fixture '+kind);
 syncSeat(s);return{state:s,...ids};
}`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const fixturePath = resolve(output, "native-fixtures.mjs");
await writeFile(fixturePath, bundle.outputFiles[0].text);
const { fixture, payment, definition, sourceCodes, stats } = await import(
  pathToFileURL(fixturePath).href
);
function allPieces(s) {
  const nested = (p) => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
    ...(p.inheritorBoosts || []).flatMap(nested),
    ...(p.droneCard ? nested(p.droneCard) : []),
  ];
  return [
    s.villain,
    ...s.players.flatMap((seat) => {
      const p = seat.id === s.activePlayerId ? s.player : seat.player;
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
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.environments,
    ...s.victoryDisplay,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
    ...(s.crossbones
      ? [
          s.crossbones.currentMain,
          ...s.crossbones.mainDeck,
          ...s.crossbones.villainDeck,
          ...s.crossbones.weaponDeck,
        ]
      : []),
  ].flatMap(nested);
}
const physicalCode = (p) =>
  definition(p).back_link
    ? p.code.replace(/[ab]$/, "")
    : definition(p).type_code === "main_scheme"
      ? p.code.replace(/[ab]$/, "")
      : p.code;
function snapshot(state) {
  const pieces = allPieces(state);
  const sources = state.players.map((seat) => {
    const p = seat.id === state.activePlayerId ? state.player : seat.player;
    return {
      seatId: seat.id,
      heroId: seat.heroId,
      cards: [...p.hand, ...p.deck, ...p.discard, ...p.inPlay].map((p) => ({
        id: p.id,
        code: p.code,
      })),
      codes: sourceCodes(seat.heroId),
    };
  });
  return {
    sources,
    originals: pieces.map((p) => ({ id: p.id, code: physicalCode(p) })),
  };
}
function conserved(state, f, label) {
  const pieces = allPieces(state);
  assert.equal(
    new Set(pieces.map((p) => p.id)).size,
    pieces.length,
    label + ": unique physical zones",
  );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    f.originals.map((p) => p.id).sort(),
    label + ": original physical IDs",
  );
  for (const p of pieces)
    assert.equal(
      physicalCode(p),
      f.originals.find((q) => q.id === p.id).code,
      label + ": original printing preserved",
    );
  for (const source of f.sources) {
    assert.equal(source.cards.length, 40);
    assert.deepEqual(source.cards.map((p) => p.code).sort(), source.codes);
  }
  assert.equal(
    pieces.filter((p) => definition(p).set_code === "exper_weapon").length,
    4,
    label + ": original four weapons",
  );
}
if (process.env.CROSSBONES_FIXTURE_CHECK) {
  const prepared = scenarios.map((kind) => {
    const f = fixture(kind);
    Object.assign(f, snapshot(f.state));
    conserved(f.state, f, kind);
    return { kind, physicalPieces: f.originals.length };
  });
  await writeFile(
    output + "/fixture-preparation-report.json",
    JSON.stringify({ preparationOnly: true, prepared }, null, 2),
  );
  console.log(
    JSON.stringify({ preparationOnly: true, fixtures: prepared.length }),
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
    ignoreHTTPSErrors: process.env.CROSSBONES_IGNORE_HTTPS_ERRORS === "1",
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
    if (sessionStorage.getItem("crossbones-fixture-loaded")) return;
    sessionStorage.setItem("crossbones-fixture-loaded", "yes");
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
  if (process.env.CROSSBONES_ASSET) {
    assert.equal(
      entryAssets.size,
      1,
      "An actual production entry asset is loaded",
    );
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.CROSSBONES_ASSET),
      ),
      "Expected immutable production entry",
    );
  }
  if (process.env.CROSSBONES_SHA256) {
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
        process.env.CROSSBONES_SHA256,
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
  if (!["won", "lost"].includes(before.phase))
    await page.getByRole("button", { name: /Resume mission/ }).click();
  else
    assert.equal(
      await page.getByRole("button", { name: /Resume mission/ }).count(),
      0,
      "A completed mission is not offered as an active resume",
    );
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
  if (f) conserved(state, f, name);
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
    villainHeadings: [...document.querySelectorAll(".villain-info h2")].map(
      (heading) => {
        const range = document.createRange();
        range.selectNodeContents(heading);
        const playmat = heading.closest(".playmat").getBoundingClientRect();
        return {
          text: heading.textContent,
          playmatLeft: playmat.left,
          playmatRight: playmat.right,
          lines: [...range.getClientRects()].map((line) => ({
            left: line.left,
            right: line.right,
          })),
        };
      },
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
    metrics.villainHeadings.every((heading) =>
      heading.lines.every(
        (line) =>
          line.left >= Math.max(0, heading.playmatLeft) - 1 &&
          line.right <= Math.min(width, heading.playmatRight) + 1,
      ),
    ),
    `${name}: villain heading is clipped ${JSON.stringify(metrics.villainHeadings)}`,
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
async function finish(stop = () => false) {
  for (let n = 0; n < 160; n++) {
    const state = await settle();
    if (stop(state) || !state.prompt) return state;
    assert.equal(state.prompt.kind, "choice", JSON.stringify(state.prompt));
    const p = state.prompt;
    const option =
      p.options.find((o) =>
        /^(take|resolve|allow|pass|skip|none|done|continue|no)$/.test(o.id),
      ) ||
      (/indirect/i.test(p.text)
        ? p.options.find((o) => /^hero(?::|$)/.test(o.id))
        : undefined) ||
      (p.title === "When Revealed · ability order"
        ? p.options.find((option) => option.id === "incite") || p.options[0]
        : undefined) ||
      (p.options.length === 1 || p.title === "Forced responses"
        ? p.options[0]
        : undefined);
    assert.ok(
      option,
      "Unhandled native Crossbones decision " + JSON.stringify(p),
    );
    await choice(option.id);
  }
  throw Error("Native Crossbones continuation did not finish");
}
try {
  if (!process.env.CROSSBONES_FIXTURE_ONLY) {
    for (const width of widths)
      for (const difficulty of ["standard", "expert"]) {
        current = { kind: "public-source", width, difficulty };
        await open(null, width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Crossbones", exact: true })
          .click();
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Sabretooth", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("combobox", { name: /^Modular encounter/ })
            .count(),
          2,
        );
        assert.equal(
          await page
            .getByRole("combobox", { name: "Modular encounter 2", exact: true })
            .inputValue(),
          "mystique",
        );
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Rhino", exact: true })
          .click();
        assert.equal(
          await page
            .getByRole("combobox", { name: /^Modular encounter/ })
            .count(),
          1,
        );
        assert.equal(
          await page
            .getByRole("combobox", { name: "Modular encounter", exact: true })
            .inputValue(),
          "bomb_scare",
        );
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Crossbones", exact: true })
          .click();
        const selector = (i) =>
          page.getByRole("combobox", {
            name: "Modular encounter " + i,
            exact: true,
          });
        const recommended = [
          "hydra_assault",
          "weap_master",
          "legions_of_hydra",
        ];
        for (let i = 1; i <= 3; i++) {
          assert.equal(await selector(i).inputValue(), recommended[i - 1]);
          assert.equal(
            await selector(i).locator('option[value="exper_weapon"]').count(),
            0,
            "Reserved weapons cannot be selected twice",
          );
        }
        await selector(1).selectOption("weap_master");
        assert.equal(
          await selector(2).inputValue(),
          "hydra_assault",
          "Choosing an occupied primary slot swaps without duplicates",
        );
        await selector(1).selectOption("hydra_assault");
        await selector(3).selectOption("hydra_patrol");
        await page.waitForFunction(
          () =>
            document.querySelector(
              '[aria-label="Modular encounter 2"] option[value="hydra_patrol"]',
            ).disabled,
        );
        assert.equal(
          await selector(2)
            .locator('option[value="hydra_patrol"]')
            .evaluate((option) => option.disabled),
          true,
        );
        await selector(3).selectOption("legions_of_hydra");
        await page
          .locator(".setting-line")
          .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
          .getByRole("button", {
            name: difficulty === "standard" ? "Standard" : "Expert",
            exact: true,
          })
          .click();
        await page.locator("#mission-seed").fill("4058");
        await checkpoint("setup-" + difficulty, width, null);
        await page.locator("#start-btn").click();
        await page
          .getByRole("button", { name: "Keep hand & begin", exact: true })
          .waitFor();
        let state = await save();
        const f = snapshot(state);
        await page
          .getByRole("button", { name: "Keep hand & begin", exact: true })
          .click();
        state = await finish();
        assert.equal(state.villainId, "crossbones");
        assert.deepEqual(state.modules, recommended);
        assert.equal(
          state.villain.code,
          difficulty === "expert" ? "04059" : "04058",
        );
        assert.equal(state.scheme.code, "04061b");
        assert.equal(state.crossbones.weaponDeck.length, 3);
        assert.equal(
          state.attachments.filter(
            (p) => definition(p).set_code === "exper_weapon",
          ).length,
          1,
        );
        assert.equal(
          state.attachments.filter((p) => p.code === "04064").length,
          difficulty === "expert" ? 1 : 0,
        );
        assert.equal(
          await page
            .getByLabel("Experimental Weapons deck: 3 cards, face down", {
              exact: true,
            })
            .count(),
          1,
        );
        await checkpoint("public-" + difficulty, width, f);
        await reload();
        checks.push({
          ...current,
          sourceCards: 40,
          weaponCards: 4,
          exactReload: true,
        });
      }
  }
  for (const kind of process.env.CROSSBONES_PUBLIC_ONLY ? [] : scenarios)
    for (const width of widths) {
      current = { kind, width };
      const f = fixture(kind);
      Object.assign(f, snapshot(f.state));
      await open(f, width);
      let state;
      if (kind === "steel-fist-stage") {
        await page
          .getByRole("button", { name: "Play now: Steel Fist", exact: true })
          .click();
        state = await settle();
        assert.equal(state.prompt.kind, "payment");
        assert.equal(state.prompt.cost, 2);
        await checkpoint("steel-fist-source-payment", width, f);
        await pay(f.paymentIds);
        state = await finish((s) =>
          s.prompt?.options.some((o) => o.id === f.originalVillainId),
        );
        await choice(f.originalVillainId);
        state = await finish(
          (s) =>
            s.prompt?.title === "Steel Fist" &&
            s.prompt.options.some((o) => o.id === "discard"),
        );
        assert.equal(
          state.villain.id,
          f.nextVillainId,
          "Stage II uses the next original physical villain",
        );
        assert.equal(state.villain.code, "04059");
        assert.ok(state.player.tough);
        assert.equal(state.prompt.title, "Steel Fist");
        await checkpoint("steel-fist-next-stage-status-choice", width, f);
        await reload();
        await choice("discard");
      } else if (kind === "assault") {
        await page.locator(".thwart-action").click();
        state = await settle();
        if (state.prompt?.options.some((o) => o.id === f.sideId))
          await choice(f.sideId);
      } else await choice("go");
      if (kind === "scarlet-full-auto") {
        state = await finish((s) =>
          s.prompt?.options.some((o) => o.id === "chaos:p1"),
        );
        assert.equal(state.prompt.title, "Full Auto");
        assert.ok(
          state.encounter.discard.some((p) => p.id === f.originalCountId),
        );
        assert.ok(state.encounter.deck.some((p) => p.id === f.replacementId));
        await checkpoint("scarlet-full-auto-count-window", width, f);
        await reload();
        await choice("chaos:p1");
      }
      if (
        kind === "gun-interrupt" ||
        kind === "gun-empty" ||
        kind === "full-auto"
      ) {
        state = await finish((s) => /indirect/i.test(s.prompt?.text || ""));
        assert.match(
          state.prompt?.text || "",
          /indirect/i,
          "Actual indirect allocation is visible",
        );
        if (kind.startsWith("gun")) {
          assert.ok(state.attack, "Attack retained during its interrupt");
          assert.ok(
            !state.attack.defender,
            "Gun interrupt precedes defender declaration",
          );
          assert.ok(state.encounter.discard.some((p) => p.id === f.discardId));
        }
        await checkpoint(kind + "-indirect-choice", width, f);
        await reload();
      }
      if (kind.startsWith("bomber-")) {
        state = await finish((s) => s.prompt?.title === "Hydra Bomber");
        assert.equal(state.prompt.title, "Hydra Bomber");
        await choice(kind === "bomber-damage" ? "damage" : "threat");
      }
      if (kind === "weapon-removal") {
        state = await finish();
        const host = page.locator(".attached-piece").filter({
          has: page.getByRole("button", {
            name: "Inspect Laser Rifle, attached to Crossbones",
            exact: true,
          }),
        });
        await host
          .getByRole("button", { name: /^Spend energy \+ physical resources/ })
          .click();
        state = await settle();
        assert.equal(state.prompt.kind, "payment");
        await checkpoint("weapon-removal-payment", width, f);
        await reload();
        await pay(f.paymentIds);
      }
      state = await finish();
      if (kind === "armor-replace") {
        assert.equal(
          state.villain.hp,
          f.initialHp,
          "All 7 damage absorbed, no excess spills",
        );
        assert.ok(!state.attachments.some((p) => p.id === f.attachmentId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.attachmentId));
      } else if (kind === "armor-counter") {
        assert.equal(state.villain.hp, f.initialHp);
        assert.equal(
          state.attachments.find((p) => p.id === f.attachmentId).damage,
          2,
        );
        assert.equal(
          await page
            .getByLabel("Crossbones' Armor damage: 2 of 5", { exact: true })
            .count(),
          1,
        );
      } else if (kind === "gun-interrupt" || kind === "gun-empty") {
        assert.equal(
          state.player.hp,
          6,
          "Three indirect damage plus the one-point unboosted attack",
        );
        assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
        if (kind === "gun-empty")
          assert.ok(
            state.encounter.discard.some((p) => p.id === f.attachmentId),
          );
        else {
          assert.equal(
            state.attachments.find((p) => p.id === f.attachmentId).counters,
            1,
          );
          assert.equal(
            await page
              .getByLabel("Machine Gun ammo: 1", { exact: true })
              .count(),
            1,
          );
        }
      } else if (kind === "scarlet-full-auto") {
        assert.equal(
          state.player.hp,
          9,
          "Chaos Control replaces the discarded three-icon card with the actual one-icon card",
        );
        assert.ok(
          state.encounter.discard.some((p) => p.id === f.originalCountId),
        );
        assert.ok(
          state.encounter.discard.some((p) => p.id === f.replacementId),
        );
        assert.ok(
          state.flags.scwChaosControlPhase,
          "The phase use is saved after the actual replacement",
        );
      } else if (kind === "full-auto") {
        assert.equal(
          state.player.hp,
          6,
          "Current ATK 2 discards both actual cards and deals 4 indirect damage",
        );
        assert.ok(
          f.discardIds.every((id) =>
            state.encounter.discard.some((p) => p.id === id),
          ),
        );
      } else if (kind === "bomber-damage" || kind === "bomber-threat") {
        assert.ok(
          state.minions.some(
            (p) => p.id === f.minionId && p.engagedWith === "p1",
          ),
        );
        assert.equal(state.player.hp, kind === "bomber-damage" ? 8 : 10);
        assert.equal(state.scheme.threat, kind === "bomber-threat" ? 1 : 0);
      } else if (kind === "hard-as-nails") {
        assert.equal(state.villain.hp, f.initialHp + 3);
        assert.equal(state.villain.tough, true);
      } else if (kind === "raid-armory") {
        assert.equal(state.scheme.threat, 1, "Incite 1 before weapon search");
        assert.ok(state.attachments.some((p) => p.id === f.attachmentId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.discardId));
      } else if (kind === "cornered-staff") {
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.sideId).counters,
          6,
          "Printed fixed 3 plus 3 boost icons",
        );
      } else if (kind === "assault") {
        assert.ok(state.encounter.discard.some((p) => p.id === f.sideId));
        assert.equal(
          state.player.hp,
          9,
          "Defeating player receives actual villain attack",
        );
      } else if (kind === "main-two") {
        assert.equal(state.scheme.code, "04062b");
        assert.equal(state.scheme.threat, 1);
        assert.equal(
          state.crossbones.weaponDeck.length,
          f.weaponDeckBefore - 1,
        );
      } else if (kind === "main-loss") {
        assert.equal(state.phase, "lost");
        assert.equal(state.scheme.code, "04063b");
        assert.equal(
          state.crossbones.weaponDeck.length,
          f.weaponDeckBefore - 2,
        );
      } else if (kind === "villain-stage") {
        assert.equal(state.villain.code, "04059");
        assert.equal(state.villain.hp, 14);
        assert.ok(
          state.attachments.some((p) => p.code === "04064" && p.counters === 2),
        );
      } else if (kind === "villain-expert") {
        assert.equal(state.villain.code, "04060");
        assert.equal(state.villain.hp, 16);
        assert.equal(
          state.crossbones.weaponDeck.length,
          f.weaponDeckBefore - 1,
        );
      } else if (kind === "villain-win") assert.equal(state.phase, "won");
      else if (kind === "steel-fist-stage") {
        assert.equal(state.villain.id, f.nextVillainId);
        assert.equal(state.villain.code, "04059");
        assert.equal(
          state.villain.hp,
          14,
          "Excess event damage does not carry into the next stage",
        );
        assert.ok(
          state.villain.stunned && state.villain.confused,
          "Paid Steel Fist statuses follow the villain across its physical stage change",
        );
        assert.ok(!state.player.tough);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        assert.ok(
          f.paymentIds.every((id) =>
            state.player.discard.some((p) => p.id === id),
          ),
        );
      } else if (kind === "weapon-removal") {
        assert.ok(state.encounter.discard.some((p) => p.id === f.attachmentId));
        assert.ok(
          !state.crossbones.weaponDeck.some((p) => p.id === f.attachmentId),
        );
        assert.ok(
          f.paymentIds.every((id) =>
            state.player.discard.some((p) => p.id === id),
          ),
        );
      }
      assert.ok(!state.error, state.error);
      assert.ok(!state.prompt, "Native choice resolved");
      assert.equal(state.queue.length, 0);
      assert.ok(!state.attack && !state.scheming);
      await checkpoint(kind + "-result", width, f);
      await reload();
      checks.push({
        ...current,
        physicalPieces: f.originals.length,
        sourceCards: 40,
        exactReload: true,
      });
      console.log("Verified Crossbones " + kind + " at " + width + " px");
    }
  const expectedCases =
    widths.length *
    ((process.env.CROSSBONES_FIXTURE_ONLY ? 0 : 2) +
      (process.env.CROSSBONES_PUBLIC_ONLY ? 0 : scenarios.length));
  assert.equal(
    checks.length,
    expectedCases,
    "Every selected browser case completed",
  );
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
    if (process.env.CROSSBONES_SHA256)
      assert.equal(
        sha256,
        process.env.CROSSBONES_SHA256,
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
        fixtureOnly: !!process.env.CROSSBONES_FIXTURE_ONLY,
        publicOnly: !!process.env.CROSSBONES_PUBLIC_ONLY,
        expectedCases,
        ignoreHTTPSErrors: process.env.CROSSBONES_IGNORE_HTTPS_ERRORS === "1",
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
        entryProof: await Promise.all(
          [...entryAssets].map(async (url) => ({
            url,
            ...(await entryResponses.get(url)),
          })),
        ),
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
