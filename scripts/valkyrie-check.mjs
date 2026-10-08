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
  [["valk", "25001a", "Valkyrie", "aggression"]].map(
    ([id, code, name, aspect]) => {
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
    },
  ),
);
const output = process.env.VALK_OUTPUT || "output/valkyrie";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      import {deckCodes,card} from './src/game/cards.ts';
      import {seatView,activateSeat} from './src/game/team.ts';
      export function fixture(kind='death') {
        const team=kind==='problem';
        const aspect=team?'justice':kind==='anticipation'?'protection':'aggression';
        const custom=aspect==='aggression'?[...heroStarterCodes('valk')]:deckCodes('valk',aspect);
        if(aspect!=='aggression'){const i=custom.findIndex(code=>card(code).faction_code===aspect);if(i<0)throw Error('Missing legal aspect replacement');custom[i]=team?'25033':'25035';}
        let s=newGame({heroId:'valk',aspect,villainId:kind==='thor-drone'?'ultron':'rhino',module:'bomb_scare',heroes:[{heroId:'valk',aspect,deckCards:custom},...(team?[{heroId:'gam',aspect:'leadership',deckCards:deckCodes('gam','leadership')}]:[])],seed:25001,pacing:'expert'});
        s.valkBrowserSources=Object.fromEntries(s.players.map(seat=>{const p=seatView(s,seat).player;return [seat.id,[...p.hand,...p.deck,...p.discard,...p.inPlay,...(p.setAside||[])].filter(p=>card(p).faction_code!=='encounter').map(p=>({id:p.id,code:p.code}))]}));
        for(const seat of s.players){s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);}
        for(let i=0;i<80&&s.review;i++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}
        if(s.prompt||s.review)throw Error('Unexpected native setup '+JSON.stringify(s.prompt));
        for(const seat of s.players){const v=seatView(s,seat);v.player.form=kind==='search'?'alter':'hero';v.player.hp=10;v.player.exhausted=false;v.player.flipped=false;v.player.deck.push(...v.player.hand.splice(0));}
        activateSeat(s,'p1');s.turnPlayerId='p1';s.villain.hp=s.villain.maxHp=50;s.scheme.threat=6;
        function take(code,seatId='p1') {const v=seatView(s,seatId);for(const z of [v.player.hand,v.player.deck,v.player.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual physical printing '+code+' on '+seatId);}
        function hand(codes,seatId='p1') {const ps=codes.map(code=>take(code,seatId));const p=seatView(s,seatId).player;p.deck.push(...p.hand);p.hand=ps;return ps;}
        function inPlay(code,seatId='p1') {const p=take(code,seatId);p.exhausted=false;seatView(s,seatId).player.inPlay.push(p);return p;}
        function discarded(code,seatId='p1'){const p=take(code,seatId);seatView(s,seatId).player.discard.push(p);return p;}
        function encounter(code) {for(const z of [s.encounter.deck,s.encounter.discard,s.player.setAside||[]]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual encounter '+code);}
        function minion(code){const p=encounter(code);p.engagedWith=s.activePlayerId;p.damage=0;s.minions.push(p);return p;}
        function glow(enemy=s.villain.id){const p=encounter('25002');p.attachedTo=enemy;s.player.inPlay.push(p);return p;}
        function native(effects){s.prompt={kind:'choice',title:'Resolve native rules',text:'Continue the actual printed native rules.',options:[{id:'go',label:'Resolve printed rules',effects}]};}
        function attack(){const zero=encounter('01105');s.encounter.deck.unshift(zero);native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}
        let ids={};
        if(kind==='death'){const [resource]=hand(['25024']);ids={glowId:s.player.setAside.find(p=>p.code==='25002').id,resourceId:resource.id};}
        else if(kind==='defeat'){const enemy=minion('01103'),p=glow(enemy.id),sword=inPlay('25006'),hall=inPlay('25004'),flights=[inPlay('25008'),inPlay('25008')];ids={enemyId:enemy.id,glowId:p.id,hallId:hall.id,flightIds:flights.map(p=>p.id),swordId:sword.id,topId:s.player.deck[0].id};}
        else if(kind==='have'){const enemy=minion('01103'),p=glow(enemy.id),sword=inPlay('25006');const [event,a,b]=hand(['25012','25025','25026']);ids={enemyId:enemy.id,glowId:p.id,swordId:sword.id,eventId:event.id,resourceIds:[a.id,b.id]};}
        else if(kind==='shield'){const spear=inPlay('25005'),p=glow(),[event,r]=hand(['25011','25024']);s.player.exhausted=true;attack();ids={spearId:spear.id,glowId:p.id,eventId:event.id,resourceId:r.id};}
        else if(kind==='search'){const annabelle=inPlay('25003'),[visit]=hand(['25009']),chosen=take('25012'),prior=discarded('25008');s.player.deck.unshift(chosen);ids={annabelleId:annabelle.id,chosenId:chosen.id,visitId:visit.id,priorId:prior.id};}
        else if(kind==='bifrost'){const bifrost=inPlay('25023'),[r]=hand(['25025']),ally=take('25014'),enemy=minion('01103');s.player.deck.unshift(ally);ids={bifrostId:bifrost.id,allyId:ally.id,resourceId:r.id,enemyId:enemy.id};}
        else if(kind==='angela'){const [ally]=hand(['25015']),enemy=encounter('01103');s.encounter.deck.unshift(enemy);ids={allyId:ally.id,enemyId:enemy.id,hidden:s.hiddenInfo||0};}
        else if(kind==='quick'){const sword=inPlay('25006'),p=glow(),[quick,smash,r,stamina]=hand(['25018','25019','25025','25024']);ids={swordId:sword.id,glowId:p.id,quickId:quick.id,smashId:smash.id,resourceId:r.id,staminaId:stamina.id};}
        else if(kind==='stamina'){const [event,audacity]=hand(['25024','25021']);s.player.stunCards=2;s.player.stunned=true;ids={eventId:event.id,audacityId:audacity.id};}
        else if(kind==='nemesis'){inPlay('25006');inPlay('25017');hand(['25019','25024','25025','25026','25008','25007','25012']);const shadow=encounter('01190'),obligation=encounter('25028');const nemeses=s.player.setAside.filter(p=>card(p).faction_code==='encounter');ids={nemesisIds:nemeses.map(p=>p.id),obligationId:obligation.id,glowId:s.player.setAside.find(p=>p.code==='25002').id};native([{type:'reveal',piece:shadow},{type:'reveal',piece:obligation}]);}
        else if(kind==='beguiled'){const ally=inPlay('25013');ally.damage=1;ally.counters=2;const beguiled=encounter('25031');ids={allyId:ally.id,beguiledId:beguiled.id};native([{type:'reveal',piece:beguiled},{type:'optional',title:'Remove the actual native condition',text:'Discard Beguiled through ordinary native attachment rules.',effects:[{type:'discardPiece',id:beguiled.id}]}]);}
        else if(kind==='anticipation'){const anticipation=inPlay('25035'),[event]=hand(['25010']),enemy=encounter('01103');s.encounter.deck.unshift(enemy);s.player.exhausted=true;ids={anticipationId:anticipation.id,eventId:event.id,enemyId:enemy.id,topIds:s.player.deck.slice(0,2).map(p=>p.id)};}
        else if(kind==='thor-drone'){const ally=inPlay('25013'),[resource]=hand(['25025']),drone=s.minions.find(p=>p.code==='drone'),enemy=minion('01110');if(!drone?.droneCard)throw Error('Missing actual Ultron setup source');ally.tough=false;ally.toughCards=0;s.player.exhausted=true;const p=glow(drone.id);ids={allyId:ally.id,resourceId:resource.id,droneId:drone.id,underlyingId:drone.droneCard.id,enemyId:enemy.id,glowId:p.id};}
        else if(kind==='problem'){const [event,a]=hand(['25033','01088']),[b]=hand(['01089'],'p2'),side=encounter('01107');side.counters=3;s.sideSchemes.push(side);ids={eventId:event.id,donorId:b.id,sideId:side.id};}
        else throw Error('Unknown Valkyrie fixture '+kind);
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
      if (sessionStorage.getItem("valkyrie-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("valkyrie-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.VALK_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.VALK_ASSET),
      ),
      "Expected immutable production entry asset",
    );
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
function physicalPieces(state) {
  const expected = state.valkBrowserSources
    ? Object.values(state.valkBrowserSources).flat()
    : null;
  const ids = expected ? new Set(expected.map((p) => p.id)) : null;
  const codes = new Set(sources.valk.codes);
  const all = [
    ...state.players.flatMap((seat) => {
      const p = seat.id === state.activePlayerId ? state.player : seat.player;
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
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...state.minions,
    ...state.sideSchemes,
    ...state.attachments,
    ...(state.encounter.storedBoosts || []),
    ...(state.attack?.pendingBoosts || []),
  ];
  const nested = (p) => {
    const children = [
      ...(p.storedCards || []),
      ...(p.captured || []),
      ...(p.droneCard ? [p.droneCard] : []),
    ];
    all.push(...children);
    children.forEach(nested);
  };
  [...all].forEach(nested);
  const pieces = all.filter((p) => (ids ? ids.has(p.id) : codes.has(p.code)));
  assert.equal(
    new Set(pieces.map((p) => p.id)).size,
    pieces.length,
    "Each physical source occupies exactly one zone",
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
  const codes = state.valkBrowserSources
    ? Object.values(state.valkBrowserSources)
        .flat()
        .map((p) => p.code)
        .sort()
    : sources.valk.codes;
  assert.equal(
    pieces.length,
    codes.length,
    message + ": actual physical deck count",
  );
  assert.deepEqual(
    pieces.map((p) => p.code).sort(),
    codes,
    message + ": physical printing quantities",
  );
  assert.deepEqual(
    pieces.map((p) => p.id).sort(),
    expected,
    message + ": physical source IDs",
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
  const regular = page.getByRole("button", {
    name: "Play now: " + name,
    exact: true,
  });
  const stored = page.getByRole("button", {
    name: "Play from Black Panther: " + name,
    exact: true,
  });
  await ((await regular.count()) ? regular.first() : stored.first()).click();
  return settle();
}
async function payWith(names, wild) {
  assert.equal((await save()).prompt?.kind, "payment");
  for (const name of names)
    await page
      .locator(".payment-source:not(.selected)")
      .filter({
        has: page.locator("b", { hasText: new RegExp("^" + name + "$") }),
      })
      .first()
      .click();
  if (wild) await page.getByLabel("Optional wild type").selectOption(wild);
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
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

async function response(id, label) {
  await findChoice((option) => option.id === id, label);
  return choice(id);
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
async function selection(ids) {
  const state = await save();
  assert.equal(state.prompt?.kind, "select");
  for (const id of ids) {
    const i = state.prompt.options.findIndex((o) => o.id === id);
    assert.ok(i >= 0);
    await page.locator(".decision-option").nth(i).click();
  }
  await page.getByRole("button", { name: /Confirm selection/ }).click();
  return settle();
}
try {
  let state;
  const viewports = (process.env.VALK_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceViewports = (
    process.env.VALK_SOURCE_VIEWPORTS || viewports.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.VALK_FIXTURE_ONLY) {
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
      await page.getByRole("button", { name: /View 41-card deck/ }).click();
      assert.match(
        await page.locator(".deck-provenance").innerText(),
        /Source preconstructed list: Valkyrie Starter Deck/,
      );
      await capture("valk-source-deck");
      await audit("Valkyrie exact source starter");
      await page.keyboard.press("Escape");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .waitFor();
      state = await save();
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, "aggression");
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      const physical = physicalCards(state);
      assert.equal(physical.length, 41);
      assert.equal(
        state.player.setAside.filter((p) => p.code === "25002").length,
        1,
      );
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.prompt, null);
      for (const width of sourceViewports)
        await checkpoint("valk-source-board", width, physical);
      await reload();
      checks.push(
        "Valkyrie original Aggression source launches forty-one actual cards with the physical Death-Glow set aside leaving forty ordinary cards; source printings and physical IDs survive exact reload",
      );
    }
  }
  const scenarios = (
    process.env.VALK_SCENARIOS ??
    "death,defeat,have,shield,search,bifrost,angela,quick,stamina,nemesis,beguiled,anticipation,problem,thor-drone"
  )
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const supported = new Set([
    "death",
    "defeat",
    "have",
    "shield",
    "search",
    "bifrost",
    "angela",
    "quick",
    "stamina",
    "nemesis",
    "beguiled",
    "anticipation",
    "problem",
    "thor-drone",
  ]);
  assert.ok(scenarios.every((kind) => supported.has(kind)));
  for (const width of viewports)
    for (const kind of scenarios) {
      const f = fixture(kind);
      await open(f.state, width);
      const physical = physicalCards(await save());
      if (kind === "death") {
        await page.locator(".ability-button").click();
        await settle();
        state = await save();
        assert.equal(state.prompt.kind, "payment");
        assert.equal(state.prompt.card.id, f.glowId);
        await checkpoint(
          "death-glow-actual-paid-set-aside-source",
          width,
          physical,
        );
        await reload();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await settle();
        assert.ok(
          (await save()).player.setAside.some((p) => p.id === f.glowId),
        );
        await page.locator(".ability-button").click();
        await settle();
        await payWith(["Godlike Stamina"]);
        await target((await save()).villain.id);
        state = await skipAll();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.glowId).attachedTo,
          state.villain.id,
        );
        await checkpoint(
          "death-glow-paid-play-preserves-original-id",
          width,
          physical,
        );
        await reload();
        await page.locator(".flip-button").click();
        await settle();
        await page.locator(".ability-button").click();
        state = await skipAll();
        assert.ok(state.player.setAside.some((p) => p.id === f.glowId));
        assert.ok(!state.player.discard.some((p) => p.id === f.glowId));
        await checkpoint(
          "brunnhilde-detaches-to-set-aside-without-discard",
          width,
          physical,
        );
        await reload();
      } else if (kind === "defeat") {
        await basic("attack");
        await target(f.enemyId);
        await findChoice((o) => o.id === f.hallId, "Death Glow responses");
        state = await save();
        assert.equal(state.player.exhausted, false);
        assert.ok(state.player.setAside.some((p) => p.id === f.glowId));
        assert.ok(!state.minions.some((p) => p.id === f.enemyId));
        await checkpoint(
          "death-glow-forced-ready-before-optional-defeat-responses",
          width,
          physical,
        );
        await reload();
        await choice(f.hallId);
        assert.equal((await save()).player.hp, 11);
        assert.ok((await save()).player.hand.some((p) => p.id === f.topId));
        await checkpoint(
          "valhalla-actual-heal-draw-and-exhaust",
          width,
          physical,
        );
        await reload();
        for (const id of f.flightIds) {
          await findChoice((o) => o.id === id, "Flight response");
          await choice(id);
          await target("main");
        }
        state = await skipAll();
        assert.equal(state.scheme.threat, 0);
        assert.equal(
          state.player.discard.filter((p) => f.flightIds.includes(p.id)).length,
          2,
        );
        await checkpoint(
          "two-physical-flights-discard-and-remove-remaining-threat",
          width,
          physical,
        );
        await reload();
      } else if (kind === "have") {
        await play("Have at Thee!");
        await checkpoint(
          "have-at-thee-real-three-cost-payment",
          width,
          physical,
        );
        await reload();
        await payWith(["Energy", "Genius"]);
        await target(f.enemyId);
        state = await skipAll();
        assert.equal(state.villain.hp, 46);
        assert.ok(!state.minions.some((p) => p.id === f.enemyId));
        assert.ok(state.player.setAside.some((p) => p.id === f.glowId));
        await checkpoint(
          "have-at-thee-fixed-seven-and-marked-overkill-four",
          width,
          physical,
        );
        await reload();
      } else if (kind === "shield") {
        await choice("go");
        await findChoice((o) => o.image === "25011", "Shieldmaiden");
        state = await save();
        const id = state.prompt.options.find((o) => o.image === "25011").id;
        await checkpoint(
          "exhausted-shieldmaiden-native-attack-interrupt",
          width,
          physical,
        );
        await reload();
        await choice(id);
        await checkpoint(
          "shieldmaiden-actual-defense-event-payment",
          width,
          physical,
        );
        await reload();
        await payWith(["Godlike Stamina"]);
        state = await skipAll();
        assert.equal(state.player.hp, 10);
        assert.equal(state.player.exhausted, true);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        assert.ok(state.log.some((x) => x.text.includes("5 DEF")));
        await checkpoint(
          "marked-spear-plus-shieldmaiden-defends-at-five",
          width,
          physical,
        );
        await reload();
      } else if (kind === "search") {
        await inPlayAction("Annabelle Riggs", "search");
        await checkpoint(
          "annabelle-actual-top-five-signature-search",
          width,
          physical,
        );
        await reload();
        await choice(f.chosenId);
        state = await skipAll();
        assert.ok(state.player.hand.some((p) => p.id === f.chosenId));
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.annabelleId).exhausted,
          true,
        );
        await checkpoint(
          "annabelle-retrieves-same-physical-signature",
          width,
          physical,
        );
        await play("Visit Valhalla");
        await findChoice((o) => o.id === f.priorId, "Visit Valhalla");
        await reload();
        await choice(f.priorId);
        state = await skipAll();
        assert.ok(state.player.hand.some((p) => p.id === f.priorId));
        await checkpoint(
          "visit-valhalla-actual-discard-retrieval",
          width,
          physical,
        );
        await reload();
      } else if (kind === "bifrost") {
        await inPlayAction("The Bifrost", "search");
        await checkpoint("bifrost-actual-deck-ally-choice", width, physical);
        await reload();
        await choice(f.allyId);
        await checkpoint(
          "bifrost-paid-play-keeps-source-out-of-hand",
          width,
          physical,
        );
        await reload();
        await payWith(["Energy"]);
        await findChoice((o) => o.id === "yes", "Throg");
        await choice("yes");
        state = await skipAll();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).tough,
          true,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.bifrostId).exhausted,
          true,
        );
        assert.ok(!state.player.deck.some((p) => p.id === f.allyId));
        await checkpoint(
          "bifrost-native-throg-entry-tough-and-shuffle",
          width,
          physical,
        );
        await reload();
      } else if (kind === "angela") {
        await play("Angela");
        await findChoice((o) => o.id === f.enemyId, "Angela actual minion");
        await checkpoint(
          "angela-actual-top-ten-minion-search",
          width,
          physical,
        );
        await reload();
        await choice(f.enemyId);
        state = await skipAll();
        assert.equal(state.player.hp, 10);
        assert.ok(
          state.minions.some(
            (p) => p.id === f.enemyId && p.engagedWith === "p1",
          ),
        );
        assert.ok(state.hiddenInfo > f.hidden);
        await checkpoint(
          "angela-puts-actual-shocker-without-reveal-damage",
          width,
          physical,
        );
        await reload();
      } else if (kind === "quick") {
        await play("Quick Strike");
        await payWith(["Energy"]);
        await target((await save()).villain.id);
        state = await skipAll();
        assert.equal(state.villain.hp, 46);
        assert.equal(state.player.exhausted, false);
        await checkpoint(
          "quick-strike-target-specific-four-atk-without-exhaust",
          width,
          physical,
        );
        await reload();
        await play("Smash the Problem");
        await checkpoint(
          "smash-the-problem-actual-exhaustion-payment",
          width,
          physical,
        );
        await reload();
        await payWith(["Godlike Stamina"]);
        await target("main");
        state = await skipAll();
        assert.equal(state.scheme.threat, 3);
        assert.equal(state.player.exhausted, true);
        await checkpoint(
          "smash-uses-ordinary-three-atk-and-not-marked-bonus",
          width,
          physical,
        );
        await reload();
      } else if (kind === "stamina") {
        await play("Godlike Stamina");
        await findChoice(
          (o) => o.id === "spend",
          "Optional real resource spend",
        );
        await choice("spend");
        await checkpoint(
          "zero-cost-stamina-allows-actual-audacity-resource",
          width,
          physical,
        );
        await reload();
        await payWith(["Audacity"]);
        await findChoice((o) => o.id === "yes", "Audacity");
        await checkpoint(
          "audacity-real-spend-response-before-healing",
          width,
          physical,
        );
        await reload();
        await choice("yes");
        await findChoice((o) => o.id === "stunned", "Actual status");
        await choice("stunned");
        state = await skipAll();
        assert.equal(state.villain.hp, 49);
        assert.equal(state.player.hp, 12);
        assert.equal(state.player.stunCards, 1);
        assert.equal(state.player.stunned, true);
        await checkpoint(
          "stamina-heals-and-discards-one-of-two-status-cards",
          width,
          physical,
        );
        await reload();
      } else if (kind === "nemesis") {
        await choice("go");
        state = await skipAll();
        assert.ok(state.minions.some((p) => p.code === "25029"));
        const side = state.sideSchemes.find((p) => p.code === "25030");
        assert.equal(side.counters, 3);
        const seduced = state.attachments.find((p) => p.code === "25032");
        assert.equal(seduced.attachedTo, "hero:p1");
        assert.ok(f.nemesisIds.includes(seduced.id));
        assert.deepEqual(
          state.player.setAside.map((p) => p.id),
          [f.glowId],
        );
        await checkpoint(
          "shadows-moves-five-real-nemeses-and-seduced-condition",
          width,
          physical,
        );
        await reload();
        assert.equal(await page.locator(".attack-action").isDisabled(), true);
        await play("Smash the Problem");
        await payWith(["Godlike Stamina"]);
        await target(side.id);
        state = await skipAll();
        assert.ok(!state.sideSchemes.some((p) => p.id === side.id));
        await page.locator(".flip-button").click();
        await settle();
        await inPlayAction("Trouble in Otherworld", "remove");
        await checkpoint(
          "trouble-in-otherworld-typed-energy-mental-payment",
          width,
          physical,
        );
        await reload();
        await payWith(["Energy", "Genius"]);
        state = await skipAll();
        assert.ok(state.removed.some((p) => p.id === f.obligationId));
        await page
          .getByRole("button", {
            name: /Spend energy and mental.*discard Seduced/,
          })
          .click();
        await settle();
        await payWith(["Flight of the Valkyrior", "Aragorn"]);
        state = await skipAll();
        assert.ok(!state.attachments.some((p) => p.id === seduced.id));
        assert.ok(state.encounter.discard.some((p) => p.id === seduced.id));
        await checkpoint(
          "brunnhilde-removes-obligation-and-discards-actual-seduced",
          width,
          physical,
        );
        await reload();
      } else if (kind === "beguiled") {
        await choice("go");
        await findChoice((o) => o.id === f.allyId, "Beguiled highest cost");
        await checkpoint(
          "beguiled-actual-highest-cost-ally-choice",
          width,
          physical,
        );
        await reload();
        await choice(f.allyId);
        state = await save();
        assert.equal(
          state.minions.find((p) => p.id === f.allyId).treatedAsMinion,
          true,
        );
        assert.ok(!state.player.inPlay.some((p) => p.id === f.allyId));
        assert.equal(state.minions.find((p) => p.id === f.allyId).damage, 1);
        await checkpoint(
          "beguiled-same-source-ally-converts-to-native-minion",
          width,
          physical,
        );
        await reload();
        await choice("yes");
        state = await skipAll();
        assert.ok(!state.minions.some((p) => p.id === f.allyId));
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          1,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).counters,
          2,
        );
        await checkpoint(
          "beguiled-discard-restores-original-physical-ally",
          width,
          physical,
        );
        await reload();
      } else if (kind === "anticipation") {
        await play("Chooser of the Slain");
        await findChoice((o) => o.id === f.enemyId, "Chooser actual minion");
        await checkpoint(
          "chooser-actual-minion-entry-cost-before-two-draws",
          width,
          physical,
        );
        await reload();
        await choice(f.enemyId);
        await findChoice((o) => o.id === f.anticipationId, "Anticipation");
        await checkpoint(
          "anticipation-native-engagement-interrupt",
          width,
          physical,
        );
        await reload();
        await choice(f.anticipationId);
        state = await skipAll();
        assert.equal(state.player.exhausted, false);
        assert.ok(state.player.discard.some((p) => p.id === f.anticipationId));
        assert.deepEqual(
          state.player.hand.map((p) => p.id),
          f.topIds,
        );
        assert.equal(state.player.hp, 10);
        await checkpoint(
          "anticipation-pays-same-discard-before-chooser-draw-two",
          width,
          physical,
        );
        await reload();
      } else if (kind === "thor-drone") {
        await inPlayAction("Thor", "Attack");
        await target(f.droneId);
        await findChoice(
          (o) => o.id === "thor-attack-each",
          "Thor actual minion interrupt",
        );
        await checkpoint(
          "thor-actual-ultron-drone-minion-attack-interrupt",
          width,
          physical,
        );
        await reload();
        await choice("thor-attack-each");
        await payWith(["Energy"]);
        await findChoice((o) => o.id === f.droneId, "Thor native Drone order");
        state = await save();
        assert.match(
          state.prompt.options.find((o) => o.id === f.droneId).label,
          /Ultron Drone/i,
        );
        assert.equal(
          state.minions.find((p) => p.id === f.droneId).droneCard.id,
          f.underlyingId,
        );
        assert.ok(!state.prompt.options.some((o) => o.id === f.underlyingId));
        await checkpoint(
          "thor-paid-energy-orders-public-drone-name-and-hidden-source",
          width,
          physical,
        );
        await reload();
        await choice(f.droneId);
        await target(f.enemyId);
        state = await skipAll();
        assert.ok(
          !state.minions.some((p) => p.id === f.droneId || p.id === f.enemyId),
        );
        assert.equal(
          state.player.discard.filter((p) => p.id === f.underlyingId).length,
          1,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          2,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).exhausted,
          true,
        );
        assert.equal(state.player.exhausted, true);
        assert.ok(state.player.setAside.some((p) => p.id === f.glowId));
        await checkpoint(
          "thor-one-native-consequence-and-source-return-preserve-glow-owner",
          width,
          physical,
        );
        await reload();
      } else if (kind === "problem") {
        await play("Problem Solvers");
        assert.equal((await save()).prompt.alliance, true);
        await checkpoint(
          "problem-solvers-actual-alliance-owner-resources",
          width,
          physical,
        );
        await reload();
        await payWith(["Energy", "Gamora · Genius"]);
        await findChoice(
          (o) => o.id === "hero:p1|hero:p2",
          "Problem Solvers pair",
        );
        await checkpoint(
          "problem-solvers-distinct-avenger-guardian-pair",
          width,
          physical,
        );
        await reload();
        await choice("hero:p1|hero:p2");
        state = await skipAll();
        assert.equal(state.scheme.threat, 3);
        assert.ok(!state.sideSchemes.some((p) => p.id === f.sideId));
        assert.equal(state.player.exhausted, true);
        assert.equal(
          state.players.find((p) => p.id === "p2").player.exhausted,
          true,
        );
        assert.ok(
          state.players
            .find((p) => p.id === "p2")
            .player.discard.some((p) => p.id === f.donorId),
        );
        await checkpoint(
          "problem-solvers-one-batch-thwarts-each-scheme",
          width,
          physical,
        );
        await reload();
      }
      console.log("Verified Valkyrie native " + kind + " at " + width + "px");
    }
  checks.push(
    ...scenarios.map(
      (name) =>
        "Native " +
        name +
        " flow conserves actual physical source IDs through UI choices, payments and reload at " +
        viewports.join(",") +
        "px",
    ),
  );
  assert.deepEqual(errors, []);
  assert.ok(audits.every((r) => !r.violations.length));
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      { checks, audits, layouts, errors, entryAssets: [...entryAssets] },
      null,
      2,
    ),
  );
  await Promise.all(
    [
      "failure.json",
      "failure.png",
      "failure-body.txt",
      "failure-save.json",
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
      .screenshot({ path: `${output}/failure.png`, fullPage: true })
      .catch(() => {});
    try {
      const failedState = await save();
      await writeFile(
        `${output}/failure-save.json`,
        JSON.stringify(failedState, null, 2),
      );
    } catch {}
    await writeFile(
      `${output}/failure-body.txt`,
      await page.locator("body").innerText(),
    ).catch(() => {});
  }
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await browser.close();
}
