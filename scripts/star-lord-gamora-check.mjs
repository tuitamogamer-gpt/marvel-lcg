import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const catalogDecks = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-decks.json", import.meta.url),
    "utf8",
  ),
);
const sources = Object.fromEntries(
  [
    ["stld", "17001a", "Star-Lord", "leadership"],
    ["gam", "18001a", "Gamora", "aggression"],
  ].map(([id, code, name, aspect]) => {
    const deck = catalogDecks.find((deck) => deck.id === "starter-" + code);
    assert.ok(deck, name + " source deck exists");
    return [
      id,
      {
        name,
        aspect,
        codes: Object.entries(deck.cards)
          .flatMap(([code, count]) => Array(count).fill(code))
          .sort(),
      },
    ];
  }),
);
const output = process.env.SG_OUTPUT || "output/star-lord-gamora";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture(kind='smooth') {
        const heroId=['smooth','discount','gun','weapon','boots','bad-boy'].includes(kind)?'stld':'gam';
        const aspect=heroId==='stld'?'leadership':'aggression';
        let s=newGame({heroId,aspect,villainId:'rhino',heroes:[{heroId,aspect,deckCards:heroStarterCodes(heroId)}],seed:heroId==='stld'?17001:18001,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        for(let i=0;i<12&&(s.review||s.prompt);i++) {
          if(s.review)s=dispatch(s,{type:'PROCEED'});
          else if(s.prompt.kind==='choice'&&s.prompt.title==='Peter Quill setup')s=dispatch(s,{type:'CHOOSE',id:s.prompt.options[0].id});
          else throw Error('Unexpected setup prompt '+JSON.stringify(s.prompt));
          if(s.error)throw Error(s.error);
        }
        s.player.form=['smooth','tactician'].includes(kind)?'alter':'hero';s.player.hp=7;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const index=zone.findIndex(p=>p.code===code);if(index>=0)return zone.splice(index,1)[0];
          }
          throw Error('Missing physical source printing '+code);
        }
        function hand(codes) {const pieces=codes.map(take);s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;}
        function inPlay(code,exhausted=false) {const piece=take(code);piece.exhausted=exhausted;s.player.inPlay.push(piece);return piece;}
        function top(code) {const piece=take(code);s.player.deck.unshift(piece);return piece;}
        function discard(code) {const piece=take(code);s.player.discard.push(piece);return piece;}
        function facedown(count) {const cards=s.encounter.deck.splice(0,count);for(const p of cards)p.dealtTo=s.activePlayerId;s.encounter.dealt.push(...cards);return cards.map(p=>p.id);}
        function minion(code='01110') {const i=s.encounter.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing actual minion '+code);const p=s.encounter.deck.splice(i,1)[0];p.engagedWith=s.activePlayerId;s.minions.push(p);return p;}
        function side() {const i=s.encounter.deck.findIndex(p=>p.code==='01107');if(i<0)throw Error('Missing actual Rhino side scheme');const p=s.encounter.deck.splice(i,1)[0];p.counters=3;s.sideSchemes.push(p);return p;}
        function nativeAttack() {const i=s.encounter.deck.findIndex(p=>p.code==='01105');if(i<0)throw Error('Missing actual zero boost');s.encounter.deck.unshift(s.encounter.deck.splice(i,1)[0]);s.phase='villain';s.prompt={kind:'choice',title:'Resolve the villain attack',text:'Resolve the native attack and damage windows.',options:[{id:'attack',label:'Rhino attacks the hero',effects:[{type:'enemyAttack',id:s.villain.id}]}]};}
        let ids={};
        if(kind==='smooth') {const [swap,helmet]=hand(['17003','17010']);const next=top('17005');ids={swapId:swap.id,topId:next.id,helmetId:helmet.id};}
        else if(kind==='discount') {const gun=inPlay('17007'),helmet=inPlay('17010');const [sliding,escape]=hand(['17005','17003']);s.player.exhausted=true;ids={gunId:gun.id,helmetId:helmet.id,slidingId:sliding.id,escapeId:escape.id};}
        else if(kind==='gun') {const gun=inPlay('17007');const [resource]=hand(['17003']);s.villain.tough=true;ids={gunId:gun.id,resourceId:resource.id};}
        else if(kind==='weapon') {const ally=inPlay('17011'),practice=inPlay('17017');const [laser,resource]=hand(['17019','17003']);const enemy=minion();ids={allyId:ally.id,practiceId:practice.id,laserId:laser.id,resourceId:resource.id,minionId:enemy.id};}
        else if(kind==='boots') {const boots=inPlay('17008');hand(['17003']);ids={bootsId:boots.id,dealtIds:facedown(2)};s.prompt={kind:'choice',title:'Resolve incoming damage',text:'Apply real direct damage through Jet Boots.',options:[{id:'damage',label:'Deal 5 damage to Star-Lord',effects:[{type:'damage',target:'hero',amount:5,source:s.villain.id}]}]};}
        else if(kind==='bad-boy') {const bad=inPlay('17006');const [escape]=hand(['17003']);ids={badId:bad.id,escapeId:escape.id};nativeAttack();}
        else if(kind==='tactician') {const room=inPlay('18008');hand(['18005','18022']);const next=top('18003'),bottom=discard('18006'),newer=discard('18007');ids={roomId:room.id,topId:next.id,bottomId:bottom.id,newerId:newer.id};}
        else if(kind==='dual') {const sword=inPlay('18010'),keen=inPlay('18009');const [event,energy,acro]=hand(['18020','18021','18003']);const enemy=minion(),scheme=side();ids={swordId:sword.id,keenId:keen.id,eventId:event.id,energyId:energy.id,acroId:acro.id,minionId:enemy.id,sideId:scheme.id};}
        else if(kind==='crosscounter') {const sword=inPlay('18010');const [event,energy]=hand(['18004','18021']);ids={swordId:sword.id,eventId:event.id,energyId:energy.id};nativeAttack();}
        return {state:s,...ids};
      }`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { fixture } = await import(
  "data:text/javascript;base64," +
    Buffer.from(bundle.outputFiles[0].text).toString("base64")
);
const browser = await chromium.launch({ headless: true });
const require = createRequire(import.meta.url);
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
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
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  if (state)
    await page.addInitScript((saved) => {
      if (sessionStorage.getItem("star-lord-gamora-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("star-lord-gamora-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
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
async function skipAll() {
  for (let i = 0; i < 20 && (await save()).prompt; i++) await skip();
  assert.equal((await save()).prompt, null);
  return save();
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
}
function physicalPieces(state) {
  const sourceCodes = sources[state.heroId].codes;
  const sourceSet = new Set(sourceCodes);
  const pieces = [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
    ...state.player.inPlay,
    ...state.resolving.filter((piece) => sourceSet.has(piece.code)),
  ];
  assert.equal(
    new Set(pieces.map((piece) => piece.id)).size,
    pieces.length,
    "Each physical player card occupies exactly one zone",
  );
  return pieces;
}
function physicalCards(state) {
  return physicalPieces(state)
    .map((p) => p.id)
    .sort();
}
function conserved(state, expected, message) {
  const pieces = physicalPieces(state);
  assert.equal(pieces.length, 40, `${message}: all 40 actual source cards`);
  assert.deepEqual(
    pieces.map((p) => p.code).sort(),
    sources[state.heroId].codes,
    `${message}: original printing quantities`,
  );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    expected,
    `${message}: physical source instances conserved`,
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
async function payWith(names) {
  assert.equal((await save()).prompt?.kind, "payment");
  for (const name of names)
    await page
      .locator(".payment-source")
      .filter({
        has: page.locator("b", { hasText: new RegExp("^" + name + "$") }),
      })
      .first()
      .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  return settle();
}
async function checkpoint(name, width, physical) {
  conserved(await save(), physical, name);
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

const facedown = (state) =>
  state.encounter.dealt.filter(
    (piece) => (piece.dealtTo || state.activePlayerId) === state.activePlayerId,
  );
async function setup(physical) {
  for (let i = 0; i < 12; i++) {
    const state = await settle();
    if (!state.prompt) return state;
    assert.equal(state.prompt.kind, "choice");
    assert.equal(state.prompt.title, "Peter Quill setup");
    conserved(state, physical, "Star-Lord native setup choice");
    await reload();
    await choice(state.prompt.options[0].id);
  }
  throw Error("Native setup did not settle");
}
async function response(id, label) {
  await findChoice((option) => option.id === id, label);
  return choice(id);
}
async function gamoraResponses(f, width, physical, explicit = false) {
  const flow = explicit ? "hit-and-run" : "crosscounter";
  await findChoice((o) => o.id === "finesse", "Gamora Finesse response");
  await checkpoint(flow + "-gamora-event-responses", width, physical);
  await reload();
  await choice("finesse");
  if (explicit) await response(f.sideId, "Finesse actual side scheme");
  await findChoice((o) => o.id === "precision", "Gamora Precision response");
  await checkpoint(flow + "-gamora-independent-precision", width, physical);
  await reload();
  await choice("precision");
  if (explicit) await response(f.minionId, "Precision actual minion");
  await response(f.swordId, "Gamora Sword physical response");
  if (explicit) await response("villain", "Gamora Sword actual villain");
  return skipAll();
}

try {
  let state;
  const viewports = (process.env.SG_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceViewports = (
    process.env.SG_SOURCE_VIEWPORTS || viewports.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.SG_FIXTURE_ONLY) {
    for (const [id, source] of Object.entries(sources)) {
      await open();
      await page
        .getByRole("button", { name: /All heroes & starter decks/ })
        .click();
      const catalog = page.getByRole("dialog", {
        name: "All heroes & starter decks",
      });
      await catalog
        .getByRole("textbox", { name: "Search heroes and products" })
        .fill(source.name);
      await catalog
        .locator(".catalog-hero-row")
        .filter({
          has: page.locator("b", {
            hasText: new RegExp("^" + source.name + "$"),
          }),
        })
        .first()
        .click();
      await catalog
        .locator(".catalog-hero-detail")
        .getByRole("button", {
          name: "Choose " + source.name + " for mission",
          exact: true,
        })
        .click();
      await page.getByRole("button", { name: /View 40-card deck/ }).click();
      assert.match(
        await page.locator(".deck-provenance").innerText(),
        new RegExp(
          "Source preconstructed list: " + source.name + " Starter Deck",
        ),
      );
      await capture(id + "-source-deck");
      await audit(source.name + " exact source starter");
      await page.keyboard.press("Escape");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .waitFor();
      state = await save();
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, source.aspect);
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      const physical = physicalCards(state);
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      await setup(physical);
      if (id === "stld")
        assert.ok(
          (await save()).player.hand.some((piece) => piece.code === "17007"),
          "Peter Quill setup found a physical Element Gun",
        );
      for (const width of sourceViewports)
        await checkpoint(id + "-source-board", width, physical);
      await reload();
      checks.push(
        source.name +
          " catalog launches original source 40-card " +
          source.aspect +
          " deck; native setup and physical printing IDs survive reload",
      );
    }
  }
  const scenarios = (
    process.env.SG_SCENARIOS ??
    "smooth,discount,gun,weapon,boots,bad-boy,tactician,dual,crosscounter"
  )
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  const supported = new Set([
    "smooth",
    "discount",
    "gun",
    "weapon",
    "boots",
    "bad-boy",
    "tactician",
    "dual",
    "crosscounter",
  ]);
  assert.ok(
    scenarios.every((name) => supported.has(name)),
    "Unknown SG scenario",
  );
  assert.ok(
    !process.env.SG_FIXTURE_ONLY || scenarios.length,
    "Choose at least one native fixture scenario",
  );
  for (const width of viewports) {
    if (scenarios.includes("smooth")) {
      const f = fixture("smooth");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.getByRole("button", { name: /Smooth Talker/ }).click();
      await findChoice(
        (o) => o.id === f.swapId,
        "Smooth Talker physical hand card",
      );
      await checkpoint("smooth-talker-before-swap", width, physical);
      await reload();
      await choice(f.swapId);
      state = await skipAll();
      assert.equal(state.player.deck[0].id, f.swapId);
      assert.ok(state.player.hand.some((piece) => piece.id === f.topId));
      assert.equal(state.flags.starlordSmoothRound, state.round);
      assert.equal(
        await page.getByRole("button", { name: /Smooth Talker/ }).count(),
        0,
      );
      await checkpoint("smooth-talker-physical-swap", width, physical);
      await reload();
      console.log("Verified Smooth Talker physical swap at " + width + "px");
    }
    if (scenarios.includes("discount")) {
      const f = fixture("discount");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Sliding Shot");
      await findChoice(
        (o) => o.id === "starlord-discount",
        "Star-Lord cost interrupt",
      );
      await checkpoint("what-could-go-wrong-cost-interrupt", width, physical);
      await reload();
      await choice("starlord-discount");
      state = await settle();
      if (state.prompt?.kind === "payment") await payWith([]);
      state = await skipAll();
      assert.equal(facedown(state).length, 1);
      assert.equal(state.villain.hp, 33);
      assert.equal(state.flags.starlordCostRound, state.round);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.slidingId).length,
        1,
      );
      await checkpoint("sliding-shot-counts-new-encounter", width, physical);
      await reload();
      await play("Daring Escape");
      state = await skipAll();
      assert.equal(facedown(state).length, 2);
      assert.equal(new Set(facedown(state).map((p) => p.id)).size, 2);
      assert.equal(state.player.exhausted, false);
      assert.equal(state.player.hand.length, 1);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.escapeId).length,
        1,
      );
      await checkpoint(
        "daring-escape-ready-draw-second-encounter",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Star-Lord cost and facedown scaling at " + width + "px",
      );
    }
    if (scenarios.includes("gun")) {
      const f = fixture("gun");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await inPlayAction("Element Gun", /damage|attack|exhaust/i);
      assert.equal((await save()).prompt?.kind, "payment");
      await checkpoint("element-gun-actual-resource-payment", width, physical);
      await reload();
      await payWith(["Daring Escape"]);
      state = await skipAll();
      assert.equal(state.villain.hp, 37);
      assert.equal(state.villain.tough, false);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.gunId).exhausted,
        true,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.resourceId).length,
        1,
      );
      assert.equal(facedown(state).length, 0);
      await checkpoint("element-gun-piercing-tough", width, physical);
      await reload();
      console.log("Verified paid Element Gun Piercing at " + width + "px");
    }
    if (scenarios.includes("weapon")) {
      const f = fixture("weapon");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Laser Blaster");
      state = await settle();
      if (state.prompt?.options?.some((o) => o.id === "starlord-discount"))
        await skip();
      await checkpoint("laser-blaster-physical-payment", width, physical);
      await reload();
      await payWith(["Daring Escape"]);
      await findChoice(
        (o) => o.id === f.allyId,
        "Laser Blaster newly gained Guardian ally",
      );
      await checkpoint(
        "laser-blaster-native-guardian-attachment",
        width,
        physical,
      );
      await reload();
      await choice(f.allyId);
      state = await skipAll();
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.laserId).attachedTo,
        f.allyId,
      );
      await inPlayAction("Adam Warlock", /^Attack/i);
      await response(f.minionId, "Attached ally actual minion attack");
      await findChoice(
        (o) => o.id === f.practiceId,
        "Target Practice physical weapon interrupt",
      );
      await checkpoint(
        "target-practice-native-weapon-interrupt",
        width,
        physical,
      );
      await reload();
      await choice(f.practiceId);
      state = await skipAll();
      assert.equal(
        state.minions.some((p) => p.id === f.minionId),
        false,
      );
      assert.equal(state.villain.hp, 38);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.allyId).damage,
        1,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.allyId).exhausted,
        true,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.practiceId).length,
        1,
      );
      await checkpoint(
        "laser-blaster-target-practice-overkill",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Guardian grant, Laser Blaster and Target Practice at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("boots")) {
      const f = fixture("boots");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("damage");
      await findChoice(
        (o) => o.id === f.bootsId,
        "Jet Boots physical damage interrupt",
      );
      await checkpoint("jet-boots-native-damage-window", width, physical);
      await reload();
      await choice(f.bootsId);
      state = await skipAll();
      assert.equal(state.player.hp, 4);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.bootsId).exhausted,
        true,
      );
      assert.deepEqual(
        facedown(state).map((p) => p.id),
        f.dealtIds,
      );
      await checkpoint("jet-boots-facedown-prevention", width, physical);
      await reload();
      console.log(
        "Verified Jet Boots per-encounter prevention at " + width + "px",
      );
    }
    if (scenarios.includes("bad-boy")) {
      const f = fixture("bad-boy");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("attack");
      await findChoice(
        (o) => o.id === f.badId,
        "Bad Boy native villain attack interrupt",
      );
      await checkpoint("bad-boy-villain-damage-window", width, physical);
      await reload();
      await choice(f.badId);
      state = await skipAll();
      assert.equal(state.player.hp, 7);
      assert.equal(state.player.form, "alter");
      assert.equal(state.player.hand.length, 3);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.badId).length,
        1,
      );
      assert.ok(!state.player.inPlay.some((p) => p.id === f.badId));
      await checkpoint("bad-boy-prevent-change-form-draw", width, physical);
      await reload();
      console.log("Verified Bad Boy prevent/change/draw at " + width + "px");
    }
    if (scenarios.includes("tactician")) {
      const f = fixture("tactician");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.getByRole("button", { name: /Skilled Tactician/ }).click();
      state = await skipAll();
      assert.equal(state.player.hand.length, 3);
      assert.ok(state.player.hand.some((p) => p.id === f.topId));
      assert.equal(state.flags.gamoraTacticianRound, state.round);
      await checkpoint("skilled-tactician-actual-top-event", width, physical);
      await reload();
      await inPlayAction("Conditioning Room", /return|heal|conditioning/i);
      state = await skipAll();
      assert.equal(state.player.hp, 8);
      assert.ok(state.player.hand.some((p) => p.id === f.bottomId));
      assert.ok(state.player.discard.some((p) => p.id === f.newerId));
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.roomId).exhausted,
        true,
      );
      await checkpoint(
        "conditioning-room-bottommost-event-heal",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Gamora Tactician and Conditioning Room at " + width + "px",
      );
    }
    if (scenarios.includes("dual")) {
      const f = fixture("dual");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Hit and Run");
      await checkpoint("hit-and-run-keen-instincts-payment", width, physical);
      await reload();
      await payWith(["Energy", "Keen Instincts"]);
      await response("villain", "Hit and Run actual attack target");
      await response("main", "Hit and Run actual thwart target");
      state = await gamoraResponses(f, width, physical, true);
      assert.equal(state.villain.hp, 37);
      assert.equal(state.scheme.threat, 4);
      assert.equal(
        state.sideSchemes.find((p) => p.id === f.sideId).counters,
        2,
      );
      assert.equal(state.minions.find((p) => p.id === f.minionId).damage, 1);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.keenId).exhausted,
        true,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.energyId).length,
        1,
      );
      assert.equal(
        state.player.discard.filter((p) => p.id === f.eventId).length,
        1,
      );
      await checkpoint(
        "gamora-dual-label-independent-responses",
        width,
        physical,
      );
      await reload();
      await play("Acrobatic Move");
      await response("villain", "Second attack actual target");
      state = await findChoice(
        (o) => o.id === f.swordId,
        "Sword responds on second attack event",
      );
      assert.ok(
        !state.prompt.options.some((o) =>
          ["finesse", "precision"].includes(o.id),
        ),
        "Identity responses are each once per phase",
      );
      await choice(f.swordId);
      await response("villain", "Second Sword actual target");
      state = await skipAll();
      assert.equal(state.villain.hp, 34);
      await checkpoint("gamora-phase-limits-sword-repeats", width, physical);
      await reload();
      console.log(
        "Verified Gamora dual event and separate phase limits at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("crosscounter")) {
      const f = fixture("crosscounter");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("attack");
      await findChoice(
        (o) => o.id === f.eventId,
        "Crosscounter actual damage interrupt",
      );
      await checkpoint("crosscounter-native-damage-window", width, physical);
      await reload();
      await choice(f.eventId);
      assert.equal((await save()).prompt?.kind, "payment");
      await checkpoint(
        "crosscounter-reaction-resource-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Energy"]);
      state = await gamoraResponses(f, width, physical);
      assert.equal(state.player.hp, 7);
      assert.equal(state.player.exhausted, false);
      assert.equal(state.villain.hp, 37);
      assert.equal(state.scheme.threat, 4);
      assert.equal(
        state.player.discard.filter((p) => p.id === f.eventId).length,
        1,
      );
      await checkpoint(
        "crosscounter-prevent-attack-thwart-responses",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Crosscounter and event responses at " + width + "px",
      );
    }
  }
  checks.push(
    ...scenarios.map(
      (name) =>
        "Native " +
        name +
        " flow preserves all 40 actual source cards through saved choices/payments and exact reload at " +
        viewports.join(",") +
        "px",
    ),
  );
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((result) => !result.violations.length),
    JSON.stringify(audits),
  );
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, audits, layouts, errors }, null, 2),
  );
  await Promise.all(
    [
      "failure.json",
      "failure.png",
      "failure-body.txt",
      "failure-save.json",
      "failure-diagnostic.txt",
      "reload-before.json",
    ].map((name) => rm(`${output}/${name}`, { force: true })),
  );
  console.log(
    JSON.stringify(
      { checks, audits: audits.length, layouts: layouts.length, errors },
      null,
      2,
    ),
  );
} catch (error) {
  await writeFile(
    `${output}/failure.json`,
    JSON.stringify(
      { message: String(error), checks, audits, layouts, errors },
      null,
      2,
    ),
  );
  try {
    await page.screenshot({
      path: `${output}/failure.png`,
      fullPage: true,
      timeout: 5000,
    });
    await writeFile(
      `${output}/failure-body.txt`,
      await page.locator("body").innerText({ timeout: 5000 }),
    );
    const state = await Promise.race([
      save(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(Error("Saved-state diagnostic timed out")),
          5000,
        ),
      ),
    ]);
    await writeFile(
      `${output}/failure-save.json`,
      JSON.stringify(state, null, 2),
    );
  } catch (diagnosticError) {
    await writeFile(
      `${output}/failure-diagnostic.txt`,
      String(diagnosticError),
    );
  }
  throw error;
} finally {
  await browser.close();
}
