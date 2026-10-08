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
  [["vision", "26001a", "Vision", "protection"]].map(
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
const output = process.env.VISION_OUTPUT || "output/vision";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';import {heroStarterCodes} from './src/game/hero-runtime.ts';import {deckCodes,card} from './src/game/cards.ts';import {seatView,activateSeat} from './src/game/team.ts';
      export function fixture(kind='density'){
        const team=kind==='joining';const aspect=team?'leadership':'protection';const custom=team?deckCodes('vision',aspect):[...heroStarterCodes('vision')];
        function replace(codes,from,to){const i=typeof from==='string'?codes.indexOf(from):codes.findIndex(from);if(i<0)throw Error('Missing legal replacement '+from);codes[i]=to;}
        if(kind==='machine')replace(custom,'26023','13024');if(kind==='meditation')replace(custom,'26023','26036');if(team)replace(custom,c=>card(c).faction_code==='leadership','26035');
        const peer=team?deckCodes('gam','protection'):[];if(team){replace(peer,c=>card(c).faction_code==='protection','26013');replace(peer,(c,i)=>card(c).faction_code==='protection'&&c!=='26013','26018');}
        let s=newGame({heroId:'vision',aspect,villainId:'rhino',module:kind==='defiance'?'masters_of_evil':'bomb_scare',heroes:[{heroId:'vision',aspect,deckCards:custom},...(team?[{heroId:'gam',aspect:'protection',deckCards:peer}]:[])],seed:26001,pacing:'expert'});
        s.visionBrowserSources=Object.fromEntries(s.players.map(seat=>{const p=seatView(s,seat).player;return [seat.id,[...p.hand,...p.deck,...p.discard,...p.inPlay,...(p.setAside||[])].filter(p=>card(p).faction_code!=='encounter').map(p=>({id:p.id,code:p.code}))]}));
        for(const seat of s.players){s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error)}for(let i=0;s.review&&i<100;i++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error)}if(s.prompt||s.review)throw Error('Unexpected native setup');
        for(const seat of s.players){const v=seatView(s,seat);v.player.form=kind==='meditation'?'alter':'hero';v.player.hp=9;v.player.exhausted=false;v.player.flipped=false;v.player.deck.push(...v.player.hand.splice(0));}
        activateSeat(s,'p1');s.turnPlayerId='p1';s.villain.hp=s.villain.maxHp=50;s.scheme.threat=6;
        const mass=s.player.inPlay.find(p=>['26002','26002b'].includes(p.code));if(!mass)throw Error('Missing actual native permanent');mass.code=['solar-dense','piercing','jocasta','defiance','machine','joining','nemesis'].includes(kind)?'26002b':'26002';
        function take(code,seat='p1'){const p=seatView(s,seat).player;for(const z of [p.hand,p.deck,p.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0]}throw Error('Missing actual source '+code+' on '+seat)}
        function hand(codes,seat='p1'){const p=seatView(s,seat).player,ps=codes.map(c=>take(c,seat));p.deck.push(...p.hand);p.hand=ps;return ps}
        function inPlay(code,seat='p1'){const p=take(code,seat);p.exhausted=false;seatView(s,seat).player.inPlay.push(p);return p}function discarded(code,seat='p1'){const p=take(code,seat);seatView(s,seat).player.discard.push(p);return p}
        function encounter(code){for(const z of [s.encounter.deck,s.encounter.discard,s.player.setAside||[]]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0]}throw Error('Missing actual encounter '+code)}
        function minion(code){const p=encounter(code);p.engagedWith='p1';p.damage=0;s.minions.push(p);return p}function attached(code){const p=encounter(code);p.attachedTo=s.villain.id;s.attachments.push(p);return p}
        function native(effects){s.prompt={kind:'choice',title:'Resolve native rules',text:'Continue actual native rules.',options:[{id:'go',label:'Resolve printed rules',effects}]}}function attack(boost='01105'){const p=encounter(boost);s.encounter.deck.unshift(p);native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);return p}
        let ids={massId:mass.id};
        if(kind==='density'){const control=inPlay('26007'),event=discarded('26008'),next=take('26024');s.player.deck.unshift(next);ids={...ids,controlId:control.id,eventId:event.id,nextId:next.id}}
        else if(kind==='intangible'){const enemy=minion('01103');s.player.hp=11;s.player.tough=true;s.player.toughCards=1;native([{type:'enemyAttack',id:enemy.id,actorId:'p1'}]);ids={...ids,enemyId:enemy.id}}
        else if(kind.startsWith('solar-')){const [event]=hand(['26008','26025','26026']);ids={...ids,eventId:event.id}}
        else if(kind==='passing'){const side=encounter('01108');side.counters=3;s.sideSchemes.push(side);const [event]=hand(['26010','26027']);ids={...ids,eventId:event.id,sideId:side.id}}
        else if(kind==='phase'){const horn=attached('01100'),charge=attached('01099'),[event]=hand(['26011','26025']);ids={...ids,hornId:horn.id,chargeId:charge.id,eventId:event.id}}
        else if(kind==='piercing'){s.villain.tough=true;s.villain.toughCards=1;const [event]=hand(['26009','26027']);ids={...ids,eventId:event.id}}
        else if(kind==='jocasta'){s.scheme.threat=3;const flow=inPlay('26016'),[ally]=hand(['26013','26025','26026','26027']),event=discarded('26012'),zero=encounter('01105');s.encounter.deck.unshift(zero);ids={...ids,allyId:ally.id,eventId:event.id,flowId:flow.id}}
        else if(kind==='defiance'){const [event]=hand(['26018','26021']),boost=attack('01130');ids={...ids,eventId:event.id,boostId:boost.id}}
        else if(kind==='machine'){const ally=inPlay('26022'),[a,b,r,reboot]=hand(['26025','13024','26027','26024']);ids={...ids,allyId:ally.id,powerId:b.id,rebootId:reboot.id}}
        else if(kind==='joining'){const [event,energy]=hand(['26035','01088']),[jocasta,guardian,genius]=hand(['26013','18002','01089'],'p2'),defense=discarded('26018','p2');ids={...ids,eventId:event.id,jocastaId:jocasta.id,guardianId:guardian.id,donorId:genius.id,defenseId:defense.id}}
        else if(kind==='meditation'){const [event,ally]=hand(['26036','26013']),defense=discarded('26012');ids={...ids,eventId:event.id,allyId:ally.id,defenseId:defense.id}}
        else if(kind==='nemesis'){const shadow=encounter('01190'),obligation=encounter('26028'),nemeses=s.player.setAside.map(p=>p.id),topId=s.player.deck[0].id;ids={...ids,obligationId:obligation.id,nemesisIds:nemeses,underlyingId:topId};native([{type:'reveal',piece:shadow},{type:'reveal',piece:obligation}])}
        else throw Error('Unknown Vision fixture '+kind);return {state:s,...ids};
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
      if (sessionStorage.getItem("vision-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("vision-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.VISION_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.VISION_ASSET),
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
function printing(p) {
  return p.code === "26002b" ? "26002" : p.code;
}
function physicalPieces(state) {
  const expected = state.visionBrowserSources
    ? Object.values(state.visionBrowserSources).flat()
    : null;
  const ids = expected ? new Set(expected.map((p) => p.id)) : null;
  const codes = new Set(sources.vision.codes);
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
  const pieces = all.filter((p) =>
    ids ? ids.has(p.id) : codes.has(printing(p)),
  );
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
  const codes = state.visionBrowserSources
    ? Object.values(state.visionBrowserSources)
        .flat()
        .map((p) => p.code)
        .sort()
    : sources.vision.codes;
  assert.equal(
    pieces.length,
    codes.length,
    message + ": actual physical deck count",
  );
  assert.deepEqual(
    pieces.map(printing).sort(),
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
  const viewports = (process.env.VISION_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceViewports = (
    process.env.VISION_SOURCE_VIEWPORTS || viewports.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.VISION_FIXTURE_ONLY) {
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
        /Source preconstructed list: Vision Starter Deck/,
      );
      await capture("vision-source-deck");
      await audit("Vision exact source starter");
      await page.keyboard.press("Escape");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .waitFor();
      state = await save();
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, "protection");
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      const physical = physicalCards(state);
      assert.equal(physical.length, 41);
      assert.equal(state.player.hand.length, 5);
      assert.ok(!state.player.inPlay.some((p) => p.code === "26002"));
      assert.equal(
        state.player.setAside.filter((p) => p.code === "26002").length,
        1,
      );
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.prompt, null);
      assert.equal(state.player.hand.length, 5);
      assert.equal(
        state.player.inPlay.filter((p) => p.code === "26002").length,
        1,
      );
      for (const width of sourceViewports)
        await checkpoint("vision-source-board", width, physical);
      await reload();
      checks.push(
        "Vision original Protection source keeps forty playing cards and one same-ID Permanent outside the count, placing Intangible after its five-card opening hand is kept; source printings and physical IDs survive exact reload",
      );
    }
  }
  const scenarios = (
    process.env.VISION_SCENARIOS ??
    "density,intangible,solar-intangible,solar-dense,passing,phase,piercing,jocasta,defiance,machine,joining,meditation,nemesis"
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const supported = new Set([
    "density",
    "intangible",
    "solar-intangible",
    "solar-dense",
    "passing",
    "phase",
    "piercing",
    "jocasta",
    "defiance",
    "machine",
    "joining",
    "meditation",
    "nemesis",
  ]);
  assert.ok(scenarios.every((s) => supported.has(s)));
  for (const width of viewports)
    for (const kind of scenarios) {
      const f = fixture(kind);
      await open(f.state, width);
      const physical = physicalCards(await save());
      if (kind === "density") {
        assert.equal(await page.locator(".attack-action").isDisabled(), true);
        await page.locator(".ability-button").click();
        await settle();
        await findChoice((o) => o.id === f.controlId, "Density response order");
        await checkpoint(
          "density-control-and-actual-mass-share-saved-response-order",
          width,
          physical,
        );
        await reload();
        await choice(f.controlId);
        await findChoice(
          (o) => o.id === f.eventId,
          "Density Control actual event",
        );
        await choice(f.eventId);
        await findChoice((o) => o.id === f.massId, "Dense draw");
        await choice(f.massId);
        state = await skipAll();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.massId).code,
          "26002b",
        );
        assert.ok(state.player.discard.some((p) => p.id === f.controlId));
        assert.ok(state.player.hand.some((p) => p.id === f.eventId));
        assert.ok(state.player.hand.some((p) => p.id === f.nextId));
        assert.equal(state.player.exhausted, false);
        assert.equal(state.player.flipped, false);
        await checkpoint(
          "dense-same-physical-face-and-returned-event-before-one-draw",
          width,
          physical,
        );
        await reload();
        await page.locator(".flip-button").click();
        state = await settle();
        assert.equal(state.player.form, "alter");
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.massId).code,
          "26002b",
        );
        assert.equal(
          await page.getByLabel("REC: 5", { exact: true }).count(),
          1,
        );
        await checkpoint(
          "dense-alter-ego-recovery-five-keeps-independent-identity-flip",
          width,
          physical,
        );
        await reload();
      } else if (kind === "intangible") {
        assert.equal(await page.locator(".attack-action").isDisabled(), true);
        await choice("go");
        state = await findChoice(
          (o) => o.id === "take",
          "Actual Intangible attack",
        );
        assert.ok(!state.prompt.options.some((o) => o.id === "hero"));
        await checkpoint(
          "intangible-prohibits-identity-attack-and-basic-defense",
          width,
          physical,
        );
        await reload();
        await choice("take");
        state = await skipAll();
        assert.equal(state.player.hp, 11);
        assert.equal(state.player.tough, true);
        await checkpoint(
          "intangible-constant-two-reduction-preserves-tough",
          width,
          physical,
        );
        await reload();
      } else if (kind.startsWith("solar-")) {
        await play("Solar Beam");
        await checkpoint(kind + "-actual-three-cost-payment", width, physical);
        await reload();
        await payWith(["Energy", "Genius"]);
        await target(
          kind === "solar-dense" ? (await save()).villain.id : "main",
        );
        state = await skipAll();
        assert.equal(
          kind === "solar-dense" ? state.villain.hp : state.scheme.threat,
          kind === "solar-dense" ? 43 : 1,
        );
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        assert.equal(state.player.exhausted, false);
        await checkpoint(
          kind + "-uses-only-current-printed-action",
          width,
          physical,
        );
        await reload();
      } else if (kind === "passing") {
        await play("Just Passing Through");
        await payWith(["Strength"]);
        state = await findChoice(
          (o) => o.id === "main",
          "Actual Crisis bypass",
        );
        await checkpoint(
          "just-passing-through-can-choose-main-with-actual-crisis",
          width,
          physical,
        );
        await reload();
        await choice("main");
        state = await skipAll();
        assert.equal(state.scheme.threat, 3);
        assert.ok(state.sideSchemes.some((p) => p.id === f.sideId));
        await checkpoint(
          "just-passing-through-thwarts-main-without-removing-crisis",
          width,
          physical,
        );
        await reload();
      } else if (kind === "phase") {
        await play("Phase Disruption");
        await payWith(["Energy"]);
        await target((await save()).villain.id);
        state = await findChoice(
          (o) => o.id === f.hornId,
          "Phase actual attachment",
        );
        assert.ok(!state.prompt.options.some((o) => o.id === f.chargeId));
        await checkpoint(
          "phase-disruption-only-eligible-actual-enemy-attachment",
          width,
          physical,
        );
        await reload();
        await choice(f.hornId);
        state = await skipAll();
        assert.equal(state.villain.confused, true);
        assert.ok(!state.attachments.some((p) => p.id === f.hornId));
        assert.ok(state.attachments.some((p) => p.id === f.chargeId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.hornId));
        await checkpoint(
          "phase-disruption-confuses-and-discards-same-eligible-source",
          width,
          physical,
        );
        await reload();
      } else if (kind === "piercing") {
        await play("Superdense Strike");
        await checkpoint(
          "superdense-strike-actual-dense-cost-and-tough-target",
          width,
          physical,
        );
        await reload();
        await payWith(["Strength"]);
        await target((await save()).villain.id);
        state = await skipAll();
        assert.equal(state.villain.hp, 45);
        assert.equal(state.villain.tough, false);
        await checkpoint(
          "superdense-strike-native-piercing-removes-tough-before-five",
          width,
          physical,
        );
        await reload();
      } else if (kind === "jocasta") {
        await play("Jocasta");
        await payWith(["Energy", "Genius"]);
        await findChoice((o) => o.id === "yes", "Jocasta");
        await choice("yes");
        await choice(f.eventId);
        state = await skipAll();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).storedCards[0].id,
          f.eventId,
        );
        await checkpoint(
          "jocasta-stores-original-physical-defense-event",
          width,
          physical,
        );
        await reload();
        await page.getByRole("button", { name: /End hero phase/ }).click();
        await page
          .getByRole("button", { name: "Begin villain phase", exact: true })
          .click();
        await settle();
        await findChoice((o) => o.id === "hero", "Vision actual defender");
        await choice("hero");
        state = await findChoice(
          (o) => o.image === "26012" && o.id.includes(f.eventId),
          "Jocasta stored Mass Increase",
        );
        await checkpoint(
          "jocasta-stored-defense-enters-actual-attack-window",
          width,
          physical,
        );
        await reload();
        await choice(
          state.prompt.options.find(
            (o) => o.image === "26012" && o.id.includes(f.eventId),
          ).id,
        );
        state = await save();
        assert.equal(state.prompt.kind, "payment");
        assert.equal(state.prompt.card.id, f.eventId);
        assert.ok(
          state.player.inPlay
            .find((p) => p.id === f.allyId)
            .storedCards.some((p) => p.id === f.eventId),
        );
        assert.equal(
          await page
            .locator(".payment-source b")
            .filter({ hasText: "Mass Increase" })
            .count(),
          0,
        );
        await checkpoint(
          "stored-defense-stays-nested-until-real-payment-commits",
          width,
          physical,
        );
        await reload();
        await payWith(["Strength"]);
        state = await findChoice((o) => o.id === "yes", "Flow Like Water");
        assert.match(state.prompt.title, /Flow Like Water/);
        await choice("yes");
        state = await skipAll();
        assert.equal(state.player.hp, 9);
        assert.equal(state.villain.hp, 49);
        assert.equal(state.villain.stunned, true);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).storedCards.length,
          0,
        );
        assert.equal(
          state.player.discard.filter((p) => p.id === f.eventId).length,
          1,
        );
        await checkpoint(
          "jocasta-paid-defense-prevention-and-flow-actual-attacker-damage",
          width,
          physical,
        );
        await reload();
      } else if (kind === "defiance") {
        await choice("go");
        await findChoice((o) => o.id === "take", "Actual villain attack");
        await choice("take");
        state = await findChoice(
          (o) => o.image === "26018",
          "Defiance before boost",
        );
        const hidden = state.hiddenInfo || 0;
        await checkpoint(
          "defiance-native-facedown-starred-boost-window",
          width,
          physical,
        );
        await reload();
        await choice(state.prompt.options.find((o) => o.image === "26018").id);
        await findChoice((o) => o.id === "spend", "Defiance optional spend");
        await choice("spend");
        await payWith(["Preservation"]);
        await findChoice((o) => o.id === "yes", "Preservation");
        await checkpoint(
          "defiance-zero-cost-physical-preservation-spend",
          width,
          physical,
        );
        await reload();
        await choice("yes");
        state = await skipAll();
        assert.equal(state.player.hp, 8);
        assert.equal(state.hiddenInfo || 0, hidden);
        assert.ok(state.encounter.discard.some((p) => p.id === f.boostId));
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        await checkpoint(
          "defiance-discards-starred-boost-without-flip-or-ability",
          width,
          physical,
        );
        await reload();
      } else if (kind === "machine") {
        await inPlayAction("Machine Man", "Attack");
        await findChoice(
          (o) => o.id === "3",
          "Machine Man current-use resources",
        );
        await choice("3");
        state = await save();
        const power = page.locator(".payment-source").filter({
          has: page.locator("b", { hasText: "The Power in All of Us" }),
        });
        assert.equal(
          await power.locator(".resource-value .resource").count(),
          1,
        );
        await checkpoint(
          "machine-man-actual-ability-payment-power-is-one-wild",
          width,
          physical,
        );
        await reload();
        await payWith(["Energy", "The Power in All of Us"]);
        await target((await save()).villain.id);
        state = await skipAll();
        assert.equal(state.villain.hp, 46);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          1,
        );
        await checkpoint(
          "machine-man-three-resources-enhance-exactly-current-attack",
          width,
          physical,
        );
        await reload();
        await play("Reboot");
        await payWith(["Strength"]);
        await target(f.allyId);
        await skipAll();
        await inPlayAction("Machine Man", "Attack");
        await target((await save()).villain.id);
        state = await skipAll();
        assert.equal(state.villain.hp, 45);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).damage,
          1,
        );
        await checkpoint(
          "reboot-readies-android-and-next-machine-man-attack-is-one",
          width,
          physical,
        );
        await reload();
      } else if (kind === "joining") {
        await play("Joining Forces");
        for (const name of ["Energy", "Gamora · Genius", "Gamora · Jocasta"])
          await page
            .locator(".payment-source:not(.selected)")
            .filter({
              has: page.locator("b", { hasText: new RegExp("^" + name + "$") }),
            })
            .click();
        assert.equal(
          await page
            .getByRole("button", { name: "Confirm payment", exact: true })
            .isDisabled(),
          true,
        );
        await checkpoint(
          "joining-forces-must-retain-actual-avenger-and-guardian",
          width,
          physical,
        );
        await reload();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await settle();
        await play("Joining Forces");
        await payWith(["Energy", "Gamora · Genius"]);
        await findChoice(
          (o) => o.id === f.jocastaId + "|" + f.guardianId,
          "Joining actual owner pair",
        );
        await checkpoint(
          "joining-forces-actual-alliance-owner-and-held-pair-choice",
          width,
          physical,
        );
        await reload();
        await choice(f.jocastaId + "|" + f.guardianId);
        state = await findChoice((o) => o.id === "yes", "Jocasta after batch");
        const peer = state.players.find((p) => p.id === "p2").player;
        assert.ok(peer.inPlay.some((p) => p.id === f.jocastaId));
        assert.ok(peer.inPlay.some((p) => p.id === f.guardianId));
        await choice("yes");
        await choice(f.defenseId);
        state = await skipAll();
        const p2 = state.players.find((p) => p.id === "p2").player;
        assert.equal(
          p2.inPlay.find((p) => p.id === f.jocastaId).storedCards[0].id,
          f.defenseId,
        );
        assert.ok(p2.discard.some((p) => p.id === f.donorId));
        await checkpoint(
          "joining-forces-puts-both-owned-allies-before-native-entry-responses",
          width,
          physical,
        );
        await reload();
      } else if (kind === "meditation") {
        await play("Meditation");
        state = await findChoice(
          (o) => o.id === f.allyId,
          "Meditation actual discounted play",
        );
        assert.equal(state.player.exhausted, true);
        await checkpoint(
          "meditation-pays-alter-ego-exhaustion-before-nested-play",
          width,
          physical,
        );
        await reload();
        await choice(f.allyId);
        await findChoice((o) => o.id === "yes", "Meditation Jocasta");
        await choice("yes");
        await choice(f.defenseId);
        state = await skipAll();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.allyId).storedCards[0].id,
          f.defenseId,
        );
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        assert.equal(state.flags.discount || 0, 0);
        await checkpoint(
          "meditation-actual-jocasta-play-finishes-parent-continuation",
          width,
          physical,
        );
        await reload();
      } else if (kind === "nemesis") {
        await choice("go");
        state = await skipAll();
        assert.ok(state.minions.some((p) => p.code === "26029"));
        assert.ok(state.environments.some((p) => p.code === "26031"));
        const drone = state.minions.find((p) => p.code === "drone");
        assert.equal(drone.droneCard.id, f.underlyingId);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.massId).code,
          "26002b",
        );
        await checkpoint(
          "vision-shadows-moves-five-actual-nemeses-and-hidden-source-drone",
          width,
          physical,
        );
        await reload();
        await page.locator(".flip-button").click();
        await settle();
        await inPlayAction("Corrupted Programming", "remove");
        state = await skipAll();
        assert.equal(state.player.exhausted, true);
        assert.ok(state.removed.some((p) => p.id === f.obligationId));
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.massId).code,
          "26002b",
        );
        await checkpoint(
          "vision-actual-obligation-removal-keeps-permanent-face-and-source",
          width,
          physical,
        );
        await reload();
      }
      console.log("Verified Vision native " + kind + " at " + width + "px");
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
