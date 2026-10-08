import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const catalog = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-decks.json", import.meta.url),
    "utf8",
  ),
);
const sources = Object.fromEntries(
  [
    ["ghost_spider", "27001a", "Ghost-Spider", "Gwen Stacy", "protection"],
    ["spider_man_morales", "27030a", "Spider-Man", "Miles Morales", "justice"],
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
const output = process.env.SINISTER_OUTPUT || "output/sinister-heroes";
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
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      import {card} from './src/game/cards.ts';
      import {activateSeat,seatView} from './src/game/team.ts';
      export function fixture(kind){
        const ghost=kind.startsWith('ghost-')||kind.startsWith('pool-');
        const team=kind==='ghost-defense';
        const id=ghost?'ghost_spider':'spider_man_morales';
        const config=(heroId)=>({heroId,aspect:heroId==='ghost_spider'?'protection':'justice',deckCards:heroStarterCodes(heroId)});
        let s=newGame({...config(id),villainId:'rhino',seed:27030,pacing:'expert',...(team?{heroes:[config('spider_man_morales'),config('ghost_spider')]}:{})});
        for(const seat of s.players){s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error)}
        for(let i=0;s.review&&i<100;i++)s=dispatch(s,{type:'PROCEED'});
        if(s.prompt||s.review)throw Error('Native opening setup has not finished');
        s.sinisterBrowserSources=Object.fromEntries(s.players.map(seat=>{const p=seatView(s,seat).player;const cards=[...p.hand,...p.deck,...p.discard,...p.inPlay];if(cards.length!==40)throw Error('Original forty physical cards missing');return[seat.id,cards.map(p=>({id:p.id,code:p.code}))]}));
        s.sinisterEncounterSources=s.players.flatMap(seat=>[...(seatView(s,seat).player.setAside||[]),...s.encounter.deck.filter(p=>p.code===(seat.heroId==='ghost_spider'?'27025':'27056'))]).map(p=>({id:p.id,code:p.code}));
        if(s.sinisterEncounterSources.length!==s.players.length*6)throw Error('Original five nemeses and obligation missing');
        for(const seat of s.players){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));p.form='hero';p.exhausted=false;p.flipped=false;}
        activateSeat(s,team?'p2':'p1');s.turnPlayerId=s.activePlayerId;
        s.villain.hp=s.villain.maxHp=50;s.scheme.threat=6;s.queue=[];s.prompt=null;s.review=null;
        function take(code,seat=s.activePlayerId){const p=seatView(s,seat).player;for(const z of[p.hand,p.deck,p.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0]}throw Error('Missing actual starter '+code+' on '+seat)}
        function hand(codes,seat=s.activePlayerId){const p=seatView(s,seat).player;p.deck.push(...p.hand.splice(0));const ps=codes.map(c=>take(c,seat));p.hand.push(...ps);return ps}
        function inPlay(code,seat=s.activePlayerId){const p=take(code,seat);seatView(s,seat).player.inPlay.push(p);return p}
        function top(code){const p=take(code);s.player.deck.unshift(p);return p}
        function encounter(code){for(const seat of s.players){const z=seatView(s,seat).player.setAside||[];const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0]}for(const z of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0]}throw Error('Missing actual encounter '+code)}
        function native(effects){s.prompt={kind:'choice',title:'Resolve encounter',text:'Continue the encounter.',options:[{id:'go',label:'Continue',effects}]}}
        let ids={};
        if(kind==='miles-basic'){const a=inPlay('27037'),b=inPlay('27038');ids={powerId:a.id,mechanismId:b.id};}
        else if(kind==='miles-shot'||kind==='miles-shot-overpay'){const[event,energy,genius]=hand(['27034','27051','27052']);ids={eventId:event.id,energyId:energy.id,geniusId:genius.id};}
        else if(kind==='miles-swing'){const[event,genius]=hand(['27033','27052']);ids={eventId:event.id,geniusId:genius.id};}
        else if(kind==='miles-double-life'){const[first,second,energy,strength]=hand(['27032','27032','27051','27053']);s.player.exhausted=true;s.player.flipped=true;s.scheme.threat=0;const draw=top('27035');const boost=encounter('01186'),reveal=encounter('01112');s.encounter.deck.unshift(boost,reveal);ids={eventId:first.id,secondId:second.id,drawId:draw.id};}
        else if(kind==='miles-web-shooter'){const[shooter,ganke,event]=hand(['27039','27035','27031']);ids={shooterId:shooter.id,gankeId:ganke.id,eventId:event.id};}
        else if(kind==='miles-tracking'){s.player.form='alter';const[event,energy]=hand(['27033','27051']);const tracking=encounter('27057');native([{type:'reveal',piece:tracking}]);ids={trackingId:tracking.id,eventId:event.id};}
        else if(kind==='miles-claws'){const prowler=encounter('27058'),claws=encounter('27059');prowler.engagedWith=s.activePlayerId;prowler.damage=4;s.minions.push(prowler);s.player.tough=true;s.player.toughCards=1;native([{type:'reveal',piece:claws},{type:'enemyAttack',id:prowler.id,actorId:s.activePlayerId}]);ids={prowlerId:prowler.id,clawsId:claws.id};}
        else if(kind==='miles-nemesis'||kind==='ghost-nemesis'){const shadow=encounter('01190');native([{type:'reveal',piece:shadow}]);ids={shadowId:shadow.id,nemesisIds:s.sinisterEncounterSources.filter(p=>p.code!=='27025'&&p.code!=='27056').map(p=>p.id)};}
        else if(kind==='ghost-stored-response'){const g=inPlay('27007'),b=inPlay('27009'),[kick,energy]=hand(['27002','27020']),draw=top('27014');ids={georgeId:g.id,braceletId:b.id,eventId:kick.id,drawId:draw.id};}
        else if(kind==='ghost-as-if-hand'){const g=inPlay('27007'),[guidance,kick]=hand(['27003','27002']);ids={georgeId:g.id,eventId:guidance.id,kickId:kick.id};}
        else if(kind==='ghost-defense'){const b=inPlay('27009'),[kick,energy]=hand(['27002','27020']),m=encounter('01103');m.engagedWith='p1';s.minions.push(m);s.phase='villain';activateSeat(s,'p1');native([{type:'enemyAttack',id:m.id,actorId:'p1'}]);ids={braceletId:b.id,eventId:kick.id,enemyId:m.id};}
        else if(kind==='pool-jump-flip'){const[event,energy,strength]=hand(['27014','27020','27022']),boost=encounter('01186');s.encounter.deck.unshift(boost);native([{type:'enemyAttack',id:s.villain.id,actorId:s.activePlayerId}]);ids={eventId:event.id};}
        else if(kind==='pool-return-favor'){const[event]=hand(['27015']),treachery=encounter('01112');s.encounter.deck.unshift(treachery);ids={eventId:event.id,treacheryId:treachery.id};}
        else throw Error('Unknown Sinister fixture '+kind);
        return{state:s,...ids};
      }
    `,
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
      if (sessionStorage.getItem("sinister-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("sinister-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.SINISTER_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.SINISTER_ASSET),
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
  return p.code;
}
function physicalPieces(state) {
  const expected = state.sinisterBrowserSources
    ? Object.values(state.sinisterBrowserSources).flat()
    : null;
  const ids = expected ? new Set(expected.map((p) => p.id)) : null;
  const codes = new Set(sources[state.heroId].codes);
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
  const codes = state.sinisterBrowserSources
    ? Object.values(state.sinisterBrowserSources)
        .flat()
        .map((p) => p.code)
        .sort()
    : sources[state.heroId].codes;
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
    name: "Play from George Stacy: " + name,
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

function seat(state, id) {
  return id === state.activePlayerId
    ? state.player
    : state.players.find((p) => p.id === id).player;
}
async function cardResponse(code, label) {
  await findChoice((o) => o.image === code || o.label.includes(label), label);
  const state = await save();
  return choice(
    state.prompt.options.find(
      (o) => o.image === code || o.label.includes(label),
    ).id,
  );
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
function actualEncounters(state) {
  if (!state.sinisterEncounterSources) return;
  const zones = [
    ...state.players.flatMap((p) => [
      ...seat(state, p.id).inPlay,
      ...(seat(state, p.id).setAside || []),
    ]),
    ...state.encounter.deck,
    ...state.encounter.discard,
    ...state.encounter.dealt,
    ...state.minions,
    ...state.sideSchemes,
    ...state.attachments,
    ...state.resolving,
    ...state.removed,
    ...(state.environments || []),
    ...(state.attack?.pendingBoosts || []),
  ];
  const nested = (p) => [
    p,
    ...(p.storedCards || []).flatMap(nested),
    ...(p.captured || []).flatMap(nested),
  ];
  const all = zones.flatMap(nested);
  for (const original of state.sinisterEncounterSources)
    assert.equal(
      all.filter((p) => p.id === original.id && p.code === original.code)
        .length,
      1,
      "Original encounter " + original.code + ":" + original.id,
    );
}
const defaults =
  "miles-basic,miles-shot,miles-shot-overpay,miles-swing,miles-double-life,miles-web-shooter,miles-tracking,miles-claws,miles-nemesis,ghost-stored-response,ghost-as-if-hand,ghost-defense,ghost-nemesis,pool-jump-flip,pool-return-favor";
try {
  const widths = (process.env.SINISTER_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceWidths = (
    process.env.SINISTER_SOURCE_VIEWPORTS || widths.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.SINISTER_FIXTURE_ONLY) {
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
        has: page.locator("small", {
          hasText: new RegExp("^" + source.identity + "$"),
        }),
      });
      assert.equal(
        await row.count(),
        1,
        "One identity-specific catalog row for " + source.code,
      );
      await row.click();
      const detail = dialog.locator(".catalog-hero-detail");
      assert.ok(
        await detail.locator('img[src*="' + source.code + '"]').count(),
        "Selected canonical identity artwork " + source.code,
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
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, source.aspect);
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      const physical = physicalCards(state);
      assert.equal(physical.length, 40);
      assert.equal(state.player.hand.length, 6);
      assert.equal(state.player.setAside.length, 5);
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.player.hand.length, 6);
      assert.equal(state.player.inPlay.length, 0);
      for (const width of sourceWidths)
        await checkpoint(id + "-original-source-board", width, physical);
      await reload();
      checks.push(
        source.identity +
          " original forty-card starter, six-card opening hand and five separate physical nemeses survive setup and exact reload",
      );
    }
  }
  const scenarios = (process.env.SINISTER_SCENARIOS || defaults)
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
      await open(f.state, width);
      const physical = physicalCards(await save());
      let state;
      if (kind === "miles-basic") {
        await basic("attack");
        await target("villain");
        assert.equal((await save()).villain.hp, 48);
        await cardResponse("27037", "Power Within");
        await target("villain");
        await cardResponse("27038", "Defense Mechanism");
        await target("villain");
        state = await finishChoices();
        assert.equal(state.villain.hp, 46);
        assert.ok(
          state.villain.stunned && state.villain.confused && state.player.tough,
        );
        assert.ok(
          [f.powerId, f.mechanismId].every((id) =>
            state.player.discard.some((p) => p.id === id),
          ),
        );
        await checkpoint(
          "miles-performed-basic-and-two-paid-specials",
          width,
          physical,
        );
        await reload();
      } else if (kind === "miles-shot" || kind === "miles-shot-overpay") {
        await play("Web-Shot");
        await payWith(
          kind === "miles-shot" ? ["Energy"] : ["Energy", "Genius"],
        );
        if (kind === "miles-shot-overpay") await choice("mental");
        await target("villain");
        if (kind === "miles-shot") await target("villain");
        state = await finishChoices();
        assert.equal(state.villain.hp, kind === "miles-shot" ? 44 : 46);
        assert.equal(state.villain.stunned, kind === "miles-shot");
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        await checkpoint(kind + "-actual-cost-allocation", width, physical);
        await reload();
      } else if (kind === "miles-swing") {
        await play("Swing In");
        await payWith(["Genius"]);
        await target("main");
        await target("villain");
        state = await finishChoices();
        assert.equal(state.scheme.threat, 2);
        assert.ok(state.player.tough && state.villain.confused);
        await checkpoint("miles-swing-in-mental-camouflage", width, physical);
        await reload();
      } else if (kind === "miles-double-life") {
        await play("Double Life");
        await payWith(["Energy", "Strength"]);
        await choice("energy");
        state = await finishChoices();
        assert.equal(state.player.form, "alter");
        assert.equal(state.player.exhausted, true);
        assert.equal(state.player.flipped, true);
        const token = state.flags.milesDoubleLifePlayToken;
        assert.ok(token && !String(token).startsWith("legacy:"));
        assert.equal(
          await page
            .getByRole("button", { name: "Play now: Double Life", exact: true })
            .count(),
          0,
        );
        assert.match(
          await page
            .getByRole("button", { name: "Inspect Double Life", exact: true })
            .getAttribute("title"),
          /round|maximum/i,
        );
        await checkpoint(
          "miles-double-life-overpayment-and-global-max",
          width,
          physical,
        );
        await reload();
        await page.getByRole("button", { name: /End hero phase/ }).click();
        await page
          .getByRole("button", { name: "Begin villain phase", exact: true })
          .click();
        await settle();
        state = await finishChoices();
        assert.equal(state.round, f.state.round + 1);
        await play("Double Life");
        await payWith(["Ganke Lee"], "mental");
        state = await finishChoices();
        assert.equal(state.player.form, "hero");
        assert.notEqual(state.flags.milesDoubleLifePlayToken, token);
        assert.ok(state.player.discard.some((p) => p.id === f.secondId));
        await checkpoint(
          "miles-new-round-new-actual-play-token",
          width,
          physical,
        );
        await reload();
      } else if (kind === "miles-web-shooter") {
        await play("Web-Shooter");
        await payWith(["Ganke Lee"], "physical");
        state = await finishChoices();
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.shooterId).counters,
          3,
        );
        await checkpoint(
          "miles-web-shooter-original-id-three-uses",
          width,
          physical,
        );
        await reload();
        await play("Arachnobatics");
        await payWith(["Web-Shooter"], "mental");
        await target("villain");
        state = await finishChoices();
        assert.equal(state.villain.hp, 48);
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.shooterId).counters,
          2,
        );
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.shooterId).exhausted,
          true,
        );
        await checkpoint(
          "miles-web-shooter-actual-wild-resource-spend",
          width,
          physical,
        );
        await reload();
      } else if (kind === "miles-tracking") {
        await choice("go");
        state = await finishChoices();
        assert.equal(
          state.sideSchemes.find((p) => p.id === f.trackingId)
            .accelerationTokens,
          1,
        );
        assert.equal(state.encounter.acceleration, 0);
        await page
          .getByRole("button", { name: "Inspect Tracking Prey", exact: true })
          .click();
        assert.ok(
          await page
            .getByRole("dialog")
            .getByText("Acceleration tokens: 1", { exact: true })
            .count(),
        );
        await checkpoint(
          "miles-physical-acceleration-token-inspection",
          width,
          physical,
        );
        await page.keyboard.press("Escape");
        await reload();
        await page.locator(".flip-button").click();
        await settle();
        await play("Swing In");
        await payWith(["Energy"]);
        await target(f.trackingId);
        state = await finishChoices();
        assert.ok(!state.sideSchemes.some((p) => p.id === f.trackingId));
        assert.ok(state.encounter.discard.some((p) => p.id === f.trackingId));
        assert.equal(state.encounter.acceleration, 0);
        await checkpoint(
          "miles-actual-side-scheme-token-leaves-with-card",
          width,
          physical,
        );
        await reload();
      } else if (kind === "miles-claws") {
        await choice("go");
        await target(f.prowlerId);
        await finishChoices();
        state = await save();
        assert.equal(state.player.hp, 5);
        assert.equal(state.player.tough, false);
        assert.equal(
          state.attachments.find((p) => p.id === f.clawsId).attachedTo,
          f.prowlerId,
        );
        await checkpoint("miles-claws-actual-piercing-attack", width, physical);
        await reload();
        await basic("attack");
        await target(f.prowlerId);
        state = await finishChoices();
        assert.ok(state.encounter.discard.some((p) => p.id === f.clawsId));
        assert.ok(!state.attachments.some((p) => p.id === f.clawsId));
        await checkpoint(
          "miles-claws-physical-attachment-discard",
          width,
          physical,
        );
        await reload();
      } else if (kind === "ghost-stored-response") {
        await inPlayAction("George Stacy", "Exhaust George Stacy");
        await target(f.eventId);
        state = await finishChoices();
        assert.deepEqual(
          state.player.inPlay
            .find((p) => p.id === f.georgeId)
            .storedCards.map((p) => p.id),
          [f.eventId],
        );
        await checkpoint("ghost-george-actual-event-storage", width, physical);
        await reload();
        await basic("attack");
        await target("villain");
        await cardResponse("27002", "Ghost Kick");
        await payWith(["Energy"]);
        await target("villain");
        await cardResponse("27009", "Web-Bracelet");
        await cardResponse("27001a", "Dizzying Reflexes");
        state = await finishChoices();
        assert.equal(state.villain.hp, 42);
        assert.equal(state.player.exhausted, false);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        assert.ok(state.player.hand.some((p) => p.id === f.drawId));
        assert.equal(
          state.player.inPlay.find((p) => p.id === f.georgeId).storedCards
            .length,
          0,
        );
        await checkpoint(
          "ghost-stored-paid-kick-bracelet-and-dizzy",
          width,
          physical,
        );
        await reload();
      } else if (kind === "ghost-as-if-hand") {
        await inPlayAction("George Stacy", "Exhaust George Stacy");
        await target(f.eventId);
        await finishChoices();
        await page
          .getByRole("button", {
            name: "Inspect Parental Guidance stored with George Stacy",
            exact: true,
          })
          .click();
        await checkpoint("ghost-stored-as-if-hand-inspection", width, physical);
        await page.keyboard.press("Escape");
        await reload();
        await page.locator(".flip-button").click();
        await settle();
        await finishChoices();
        await play("Parental Guidance");
        await target(f.kickId);
        state = await finishChoices();
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        assert.deepEqual(
          state.player.inPlay
            .find((p) => p.id === f.georgeId)
            .storedCards.map((p) => p.id),
          [f.kickId],
        );
        await checkpoint(
          "ghost-stored-ordinary-play-uses-same-actual-id",
          width,
          physical,
        );
        await reload();
      } else if (kind === "ghost-defense") {
        await choice("go");
        await choice("hero:p2");
        await cardResponse("27002", "Ghost Kick");
        await payWith(["Energy"]);
        await target("villain");
        await cardResponse("27009", "Web-Bracelet");
        await cardResponse("27001a", "Dizzying Reflexes");
        state = await finishChoices();
        assert.equal(seat(state, "p2").hp, 10);
        assert.equal(seat(state, "p2").exhausted, false);
        assert.equal(state.villain.hp, 44);
        assert.ok(seat(state, "p2").discard.some((p) => p.id === f.eventId));
        assert.ok(!seat(state, "p1").discard.some((p) => p.id === f.eventId));
        await checkpoint(
          "ghost-actual-teammate-basic-defense-response-owner",
          width,
          physical,
        );
        await reload();
      } else if (kind === "ghost-nemesis" || kind === "miles-nemesis") {
        await choice("go");
        state = await finishChoices();
        assert.equal(state.player.setAside.length, 0);
        assert.equal(state.minions.length, 1);
        assert.equal(state.sideSchemes.length, 1);
        actualEncounters(state);
        assert.ok(f.nemesisIds.includes(state.minions[0].id));
        assert.ok(f.nemesisIds.includes(state.sideSchemes[0].id));
        await checkpoint(
          kind + "-five-original-encounter-instances",
          width,
          physical,
        );
        await reload();
      } else if (kind === "pool-jump-flip") {
        await choice("go");
        await cardResponse("27014", "Jump Flip");
        await payWith(["Energy", "Strength"]);
        assert.match(
          (await save()).prompt?.title || "",
          /Allocate payment resources/,
        );
        await checkpoint(
          "sinister-jump-flip-actual-resource-allocation",
          width,
          physical,
        );
        await reload();
        await choice("physical");
        state = await finishChoices();
        assert.equal(state.player.hp, 10);
        assert.equal(state.scheme.threat, 6);
        assert.ok(state.player.discard.some((p) => p.id === f.eventId));
        await checkpoint(
          "sinister-jump-flip-actual-for-cost-prevents-damage",
          width,
          physical,
        );
        await reload();
      } else if (kind === "pool-return-favor") {
        await play("Return the Favor");
        state = await finishChoices();
        assert.equal(state.villain.hp, 45);
        assert.equal(state.player.confused, true);
        assert.ok(state.encounter.discard.some((p) => p.id === f.treacheryId));
        await checkpoint(
          "sinister-risky-reveal-cost-finishes-before-attack",
          width,
          physical,
        );
        await reload();
      }
      state = await save();
      actualEncounters(state);
      conserved(state, physical, kind);
      console.log("Verified Sinister native " + kind + " at " + width + "px");
    }
    checks.push(
      "Native " +
        kind +
        " preserves actual physical source and encounter IDs through choices, payments and reload",
    );
  }
  assert.deepEqual(errors, []);
  assert.ok(audits.every((a) => !a.violations.length));
  await writeFile(
    output + "/report.json",
    JSON.stringify(
      { checks, audits, layouts, errors, entryAssets: [...entryAssets] },
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
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await context?.close();
  await browser.close();
}
