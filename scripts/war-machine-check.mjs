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
  [["warm", "23001a", "War Machine", "leadership"]].map(
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
const output = process.env.WARM_OUTPUT || "output/war-machine";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      import {deckCodes,card} from './src/game/cards.ts';
      import {seatView,activateSeat} from './src/game/team.ts';
      export function fixture(kind='form') {
        const team=['alliance','stand'].includes(kind);
        const original=heroStarterCodes('warm');
        const aspect=team?(kind==='alliance'?'aggression':'protection'):'leadership';
        const custom=team?deckCodes('warm',aspect):[...original];
        if(kind==='discount-gun'){const i=custom.indexOf('23016');if(i<0)throw Error('Missing legal Leadership source replacement');custom[i]='01092';}
        if(team){const i=custom.findIndex(code=>card(code).faction_code===aspect);if(i<0)throw Error('No legal custom aspect card');custom[i]=kind==='alliance'?'23032':'23034';}
        const peer=team?deckCodes('gam','leadership'):[];
        if(team){const innovationIndex=peer.findIndex(code=>card(code).faction_code==='leadership');peer[innovationIndex]='23021';const bpIndex=peer.findIndex((code,index)=>index!==innovationIndex&&card(code).faction_code==='leadership');peer[bpIndex]='23012';}
        let s=newGame({heroId:'warm',aspect,villainId:'rhino',heroes:[{heroId:'warm',aspect,deckCards:custom},...(team?[{heroId:'gam',aspect:'leadership',deckCards:peer}]:[])],seed:23001,pacing:'expert'});
        for(const seat of s.players){s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);}
        for(let i=0;i<80&&s.review;i++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}
        if(s.prompt||s.review)throw Error('Unexpected native setup '+JSON.stringify(s.prompt));
        s.warmBrowserSources=Object.fromEntries(s.players.map(seat=>{const p=seatView(s,seat).player;return [seat.id,[...p.hand,...p.deck,...p.discard,...p.inPlay].map(p=>({id:p.id,code:p.code}))]}));
        for(const seat of s.players){const v=seatView(s,seat);v.player.form=kind==='form'?'alter':'hero';v.player.hp=7;v.player.exhausted=false;v.player.flipped=false;v.player.deck.push(...v.player.hand.splice(0));v.flags.warMachineAmmo=0;}
        activateSeat(s,'p1');s.turnPlayerId='p1';s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code,seatId='p1') {const v=seatView(s,seatId);for(const z of [v.player.hand,v.player.deck,v.player.discard]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual physical printing '+code+' on '+seatId);}
        function hand(codes,seatId='p1') {const ps=codes.map(code=>take(code,seatId));const p=seatView(s,seatId).player;p.deck.push(...p.hand);p.hand=ps;return ps;}
        function inPlay(code,seatId='p1') {const p=take(code,seatId);p.exhausted=false;seatView(s,seatId).player.inPlay.push(p);return p;}
        function discarded(code,seatId='p1'){const p=take(code,seatId);seatView(s,seatId).player.discard.push(p);return p;}
        function encounter(code) {for(const z of [s.encounter.deck,s.encounter.discard,s.player.setAside||[]]){const i=z.findIndex(p=>p.code===code);if(i>=0)return z.splice(i,1)[0];}throw Error('Missing actual encounter '+code);}
        function minion(code){const p=encounter(code);p.engagedWith=s.activePlayerId;p.damage=0;s.minions.push(p);return p;}
        function native(effects){s.prompt={kind:'choice',title:'Resolve native rules',text:'Continue the actual printed native rules.',options:[{id:'go',label:'Resolve printed rules',effects}]};}
        function attack(seat='p1'){const zero=encounter('01105');s.encounter.deck.unshift(zero);native([{type:'enemyAttack',id:s.villain.id,actorId:seat}]);}
        let ids={};
        if(kind==='form'){const chassis=inPlay('23004'),bunker=inPlay('23003');bunker.counters=2;ids={chassisId:chassis.id,bunkerId:bunker.id};}
        else if(kind==='gun'||kind==='discount-gun'){const gun=inPlay('23005'),[event]=hand(['23008']);const carrier=kind==='discount-gun'?inPlay('01092'):null;ids={gunId:gun.id,eventId:event.id,carrierId:carrier?.id};}
        else if(kind==='full'){s.flags.warMachineAmmo=2;const guns=[inPlay('23005'),inPlay('23005')],[event]=hand(['23011','23026']);ids={gunIds:guns.map(p=>p.id),eventId:event.id};}
        else if(kind==='weapon'){s.flags.warMachineAmmo=2;const launcher=inPlay('23006'),cannon=inPlay('23007');ids={launcherId:launcher.id,cannonId:cannon.id};}
        else if(kind==='goliath'){const ally=inPlay('23015'),team=inPlay('23016');team.counters=2;ids={allyId:ally.id,teamId:team.id};}
        else if(kind==='scorch'){s.flags.warMachineAmmo=3;s.player.stunned=true;const [event,a,b]=hand(['23010','23025','23026']);const enemies=[minion('01110'),minion('01103')];ids={eventId:event.id,resourceIds:[a.id,b.id],enemyIds:enemies.map(p=>p.id)};}
        else if(kind==='panther'){const [bp,a,b]=hand(['23012','23025','23026']);const event=discarded('23020'),falcon=discarded('23014');const strength=take('23027'),innovation=take('23021'),beam=take('23008');s.player.hand.push(strength,innovation,beam);ids={bpId:bp.id,resourceIds:[a.id,b.id],storedId:event.id,falconId:falcon.id};}
        else if(kind==='sneak'){const [event,bp,resource]=hand(['23017','23012','23027']);const prior=discarded('23020');ids={eventId:event.id,bpId:bp.id,resourceId:resource.id,priorId:prior.id};}
        else if(kind==='alliance'){const [event,energy]=hand(['23032','01088']);const [innovation]=hand(['23021'],'p2');const ally=inPlay('23012','p2');ally.damage=2;ids={eventId:event.id,energyId:energy.id,donorId:innovation.id,allyId:ally.id};}
        else if(kind==='stand'){const [event,energy]=hand(['23034','01088']);const [genius]=hand(['01089'],'p2');attack('p2');ids={eventId:event.id,energyId:energy.id,donorId:genius.id};}
        else if(kind==='nemesis'){s.flags.warMachineAmmo=3;const gun=inPlay('23005');const obligation=encounter('23028'),shadow=encounter('01190');native([{type:'reveal',piece:obligation},{type:'reveal',piece:shadow}]);ids={gunId:gun.id,obligationId:obligation.id,nemesisIds:s.player.setAside.map(p=>p.id)};}
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
      if (sessionStorage.getItem("war-machine-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("war-machine-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
  if (process.env.WARM_ASSET)
    assert.ok(
      [...entryAssets].every((asset) =>
        asset.endsWith("/" + process.env.WARM_ASSET),
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
  const expected = state.warmBrowserSources
    ? Object.values(state.warmBrowserSources).flat()
    : null;
  const ids = expected ? new Set(expected.map((p) => p.id)) : null;
  const codes = new Set(sources.warm.codes);
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
  const codes = state.warmBrowserSources
    ? Object.values(state.warmBrowserSources)
        .flat()
        .map((p) => p.code)
        .sort()
    : sources.warm.codes;
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
  if (state.heroId === "warm") {
    const ammo = Math.max(0, Number(state.flags.warMachineAmmo || 0));
    assert.equal(
      await page.getByLabel("AMMO: " + ammo, { exact: true }).count(),
      1,
      "Visible identity AMMO reflects the saved native counter",
    );
  }
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
  const viewports = (process.env.WARM_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceViewports = (
    process.env.WARM_SOURCE_VIEWPORTS || viewports.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.WARM_FIXTURE_ONLY) {
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
        /Source preconstructed list: War Machine Starter Deck/,
      );
      await capture("warm-source-deck");
      await audit("War Machine exact source starter");
      await page.keyboard.press("Escape");
      await page.locator("#start-btn").click();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .waitFor();
      state = await save();
      assert.equal(state.heroId, id);
      assert.equal(state.aspect, "leadership");
      assert.deepEqual([...state.players[0].deckCards].sort(), source.codes);
      const physical = physicalCards(state);
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.prompt, null);
      for (const width of sourceViewports)
        await checkpoint("warm-source-board", width, physical);
      await reload();
      checks.push(
        "War Machine original Leadership source launches forty actual cards; source printings and physical IDs survive exact reload",
      );
    }
  }
  const scenarios = (
    process.env.WARM_SCENARIOS ??
    "form,gun,discount-gun,full,weapon,scorch,goliath,panther,sneak,alliance,stand,nemesis"
  )
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
  const supported = new Set([
    "form",
    "gun",
    "discount-gun",
    "full",
    "weapon",
    "scorch",
    "goliath",
    "panther",
    "sneak",
    "alliance",
    "stand",
    "nemesis",
  ]);
  assert.ok(
    scenarios.every((x) => supported.has(x)),
    "Unknown War Machine flow",
  );
  for (const width of viewports) {
    if (scenarios.includes("form")) {
      const f = fixture("form");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.locator(".flip-button").click();
      await settle();
      await checkpoint(
        "war-machine-ordered-physical-form-responses",
        width,
        physical,
      );
      await reload();
      await choice(f.chassisId);
      assert.equal((await save()).player.tough, true);
      await choice("identity");
      await skipAll();
      assert.equal((await save()).flags.warMachineAmmo, 5);
      await checkpoint("chassis-tough-and-five-identity-ammo", width, physical);
      await reload();
      await inPlayAction("Munitions Bunker", "move all");
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 7);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.bunkerId).counters,
        0,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.bunkerId).exhausted,
        true,
      );
      await checkpoint(
        "bunker-transfers-its-physical-counters",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified native War Machine forms and Bunker at " + width + "px",
      );
    }
    if (scenarios.includes("gun")) {
      const f = fixture("gun");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Repulsor Beam");
      await checkpoint("zero-ammo-repulsor-real-gun-payment", width, physical);
      await reload();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      state = await settle();
      assert.equal(state.flags.warMachineAmmo, 0);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.gunId).exhausted,
        false,
      );
      assert.ok(state.player.hand.some((p) => p.id === f.eventId));
      await play("Repulsor Beam");
      await payWith(["Gauntlet Gun"], "energy");
      await target((await save()).villain.id);
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 0);
      assert.equal(state.villain.hp, 36);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.gunId).exhausted,
        true,
      );
      await checkpoint(
        "paid-gun-adds-before-repulsor-removes-ammo",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified correlated Gauntlet payment and atomic cancel at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("discount-gun")) {
      const f = fixture("discount-gun");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await inPlayAction("Helicarrier", "Next card costs 1 less");
      await play("Repulsor Beam");
      assert.equal((await save()).prompt.cost, 0);
      assert.equal(
        await page
          .getByRole("button", { name: "Confirm payment", exact: true })
          .isDisabled(),
        true,
      );
      assert.deepEqual((await save()).prompt.sourceRequirement.ids, [f.gunId]);
      await checkpoint(
        "zero-cost-repulsor-requires-actual-generated-ammo-source",
        width,
        physical,
      );
      await reload();
      await page
        .getByRole("button", { name: "Suggest resources", exact: true })
        .click();
      assert.equal(await page.locator(".payment-source.selected").count(), 1);
      assert.match(
        await page.locator(".payment-source.selected b").innerText(),
        /^Gauntlet Gun$/,
      );
      assert.equal(
        await page
          .getByRole("button", { name: "Confirm payment", exact: true })
          .isEnabled(),
        true,
      );
      await checkpoint(
        "zero-cost-payment-advisor-selects-required-gun",
        width,
        physical,
      );
      await reload();
      await payWith(["Gauntlet Gun"], "energy");
      await target((await save()).villain.id);
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 0);
      assert.equal(state.villain.hp, 36);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.gunId).exhausted,
        true,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.carrierId).exhausted,
        true,
      );
      await checkpoint(
        "zero-cost-paid-gun-adds-ammo-before-additional-cost",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified actual Helicarrier zero-cost Gun requirement and payment advisor at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("full")) {
      const f = fixture("full");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Full Auto");
      await page
        .locator(".payment-source")
        .filter({ has: page.locator("b", { hasText: /^Genius$/ }) })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Confirm payment", exact: true })
          .isDisabled(),
        true,
      );
      await checkpoint(
        "full-auto-rejects-ordinary-resource-without-required-guns",
        width,
        physical,
      );
      await reload();
      await payWith(["Gauntlet Gun", "Gauntlet Gun"], "energy");
      assert.equal((await save()).prompt.title, "Full Auto · additional cost");
      await checkpoint("full-auto-ammo-cost-and-fixed-target", width, physical);
      await reload();
      await choice((await save()).villain.id);
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 0);
      assert.equal(state.villain.hp, 32);
      assert.ok(
        f.gunIds.every(
          (id) => state.player.inPlay.find((p) => p.id === id).exhausted,
        ),
      );
      await checkpoint("full-auto-native-eight-damage", width, physical);
      await reload();
      console.log(
        "Verified Full Auto actual gun resources and four-ammo cost at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("weapon")) {
      const f = fixture("weapon");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await inPlayAction("Missile Launcher", "ranged");
      await target((await save()).villain.id);
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 1);
      assert.equal(state.villain.hp, 38);
      await checkpoint(
        "missile-launcher-native-ranged-attack",
        width,
        physical,
      );
      await reload();
      await inPlayAction("Shoulder Cannon", "damage");
      await target((await save()).villain.id);
      await findChoice(
        (o) => o.id === "ready",
        "Shoulder Cannon additional ready cost",
      );
      await checkpoint(
        "shoulder-cannon-saved-ammo-ready-choice",
        width,
        physical,
      );
      await reload();
      await choice("ready");
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 0);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.cannonId).exhausted,
        false,
      );
      assert.equal(state.villain.hp, 37);
      await checkpoint(
        "shoulder-cannon-spends-one-and-readies-same-source",
        width,
        physical,
      );
      await reload();
      console.log("Verified native weapon attack windows at " + width + "px");
    }
    if (scenarios.includes("scorch")) {
      const f = fixture("scorch");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Scorched Earth");
      await checkpoint(
        "scorched-earth-actual-resource-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Energy", "Genius"]);
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 0);
      assert.equal(state.player.stunned, true);
      assert.equal(state.villain.hp, 37);
      assert.ok(
        f.enemyIds.every((id) => !state.minions.some((p) => p.id === id)),
      );
      assert.ok(
        f.resourceIds.every((id) =>
          state.player.discard.some((p) => p.id === id),
        ),
      );
      await checkpoint(
        "scorched-earth-native-nonattack-multiple-enemies",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Scorched Earth physical payment and native damage batch at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("goliath")) {
      const f = fixture("goliath");
      await open(f.state, width);
      const physical = physicalCards(await save());
      const special = page
        .locator(".in-play-card")
        .filter({ has: page.locator(".in-play-name", { hasText: "Goliath" }) })
        .locator(".in-play-actions button")
        .filter({ hasText: "+4 ATK" });
      assert.equal(await special.count(), 1);
      assert.equal((await save()).flags.hawkeyeGoliathPhase, undefined);
      await inPlayAction("Goliath", "Thwart");
      await target("main");
      state = await skipAll();
      const ally = state.player.inPlay.find((p) => p.id === f.allyId);
      assert.equal(state.scheme.threat, 4);
      assert.equal(ally.exhausted, true);
      assert.equal(ally.damage, 1);
      assert.equal(ally.bonusAtk || 0, 0);
      assert.equal(state.flags.hawkeyeGoliathPhase, undefined);
      assert.equal(await special.count(), 1);
      await checkpoint(
        "goliath-native-basic-thwart-while-special-action-remains-available",
        width,
        physical,
      );
      await reload();
      await inPlayAction("Command Team", "ready");
      await findChoice((o) => o.id === f.allyId, "Command Team actual Goliath");
      await choice(f.allyId);
      await skipAll();
      await inPlayAction("Goliath", "+4 ATK");
      state = await skipAll();
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.allyId).bonusAtk,
        4,
      );
      assert.equal(await special.count(), 0);
      await inPlayAction("Goliath", "Attack");
      await target((await save()).villain.id);
      state = await skipAll();
      assert.equal(state.villain.hp, 35);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.allyId).damage,
        3,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.allyId).exhausted,
        true,
      );
      await checkpoint(
        "goliath-phase-boost-and-native-five-attack-consequence",
        width,
        physical,
      );
      await reload();
      await page.getByRole("button", { name: /End hero phase/ }).click();
      await page
        .getByRole("button", { name: "Begin villain phase", exact: true })
        .click();
      state = await settle();
      assert.ok(!state.player.inPlay.some((p) => p.id === f.allyId));
      assert.ok(state.player.discard.some((p) => p.id === f.allyId));
      await checkpoint(
        "goliath-end-phase-discards-the-same-physical-source",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified native Goliath ordinary actions, phase boost and source discard at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("panther")) {
      const f = fixture("panther");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Black Panther");
      await payWith(["Energy", "Genius"]);
      await findChoice((o) => o.id === "yes", "Black Panther actual entry");
      await checkpoint(
        "black-panther-real-discard-storage-response",
        width,
        physical,
      );
      await reload();
      await choice("yes");
      await choice(f.storedId);
      await skipAll();
      state = await save();
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.bpId).storedCards[0].id,
        f.storedId,
      );
      await checkpoint(
        "black-panther-attached-event-is-playable",
        width,
        physical,
      );
      await reload();
      await play("Make the Call");
      await choice(f.falconId);
      await checkpoint(
        "stored-make-the-call-keeps-physical-event-and-ally-cost",
        width,
        physical,
      );
      await reload();
      assert.equal((await save()).prompt.cost, 4);
      await payWith(["Strength", "Innovation", "Repulsor Beam"]);
      state = await skipAll();
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.bpId).storedCards.length,
        0,
      );
      assert.ok(state.player.inPlay.some((p) => p.id === f.falconId));
      assert.ok(state.player.discard.some((p) => p.id === f.storedId));
      await checkpoint(
        "stored-event-plays-the-same-physical-event-and-ally",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified actual Black Panther attached-event UI and nested saved payment at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("sneak")) {
      const f = fixture("sneak");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Sneak Attack");
      await page
        .locator(".payment-source")
        .filter({ has: page.locator("b", { hasText: /^Black Panther$/ }) })
        .click();
      assert.equal(
        await page
          .getByRole("button", { name: "Confirm payment", exact: true })
          .isDisabled(),
        true,
      );
      await checkpoint(
        "sneak-payment-preserves-its-last-eligible-ally",
        width,
        physical,
      );
      await reload();
      await payWith(["Strength"]);
      await choice(f.bpId);
      await findChoice((o) => o.id === "yes", "Sneaked Black Panther entry");
      await choice("yes");
      assert.equal(
        (await save()).prompt.options.some((o) => o.id === f.eventId),
        false,
      );
      assert.ok((await save()).resolving.some((p) => p.id === f.eventId));
      await checkpoint(
        "sneak-entry-cannot-store-still-resolving-summoner",
        width,
        physical,
      );
      await reload();
      await choice(f.priorId);
      state = await skipAll();
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.bpId).storedCards[0].id,
        f.priorId,
      );
      assert.ok(state.player.discard.some((p) => p.id === f.eventId));
      await checkpoint("sneak-puts-the-same-physical-ally", width, physical);
      await reload();
      console.log(
        "Verified Sneak Attack retention, actual put and storage ordering at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("alliance")) {
      const f = fixture("alliance");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("As One!");
      assert.equal((await save()).prompt.alliance, true);
      await checkpoint(
        "alliance-exposes-actual-peer-resource-sources",
        width,
        physical,
      );
      await reload();
      await payWith(["Energy", "Gamora · Innovation"]);
      await findChoice(
        (o) => o.id === "yes",
        "Actual donor Innovation response",
      );
      await choice("yes");
      await choice(f.allyId);
      await findChoice(
        (o) => o.id === "hero:p1|hero:p2",
        "Alliance two-character exhaustion cost",
      );
      await checkpoint(
        "alliance-donor-response-before-character-cost",
        width,
        physical,
      );
      await reload();
      await choice("hero:p1|hero:p2");
      await target((await save()).villain.id);
      state = await skipAll();
      const p2 = state.players.find((p) => p.id === "p2").player;
      assert.ok(p2.discard.some((p) => p.id === f.donorId));
      assert.ok(!state.player.discard.some((p) => p.id === f.donorId));
      assert.equal(p2.inPlay.find((p) => p.id === f.allyId).damage, 1);
      assert.equal(state.villain.hp, 36);
      assert.equal(state.player.exhausted, true);
      assert.equal(p2.exhausted, true);
      await checkpoint(
        "alliance-commits-donor-owner-and-native-single-attack",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified native Alliance contribution owner and donor response at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("stand")) {
      const f = fixture("stand");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      state = await save();
      await choice(
        state.prompt.options.some((o) => o.id === "take") ? "take" : "none",
      );
      await findChoice(
        (o) => o.image === "23034",
        "Stand Together teammate actual damage window",
      );
      state = await save();
      const option =
        state.prompt.options.find(
          (o) => o.image === "23034" && o.id.endsWith(":hero:p2"),
        ) || state.prompt.options.find((o) => o.image === "23034");
      await choice(option.id);
      assert.equal((await save()).prompt.alliance, true);
      await checkpoint(
        "stand-together-peer-alliance-payment-window",
        width,
        physical,
      );
      await reload();
      await payWith(["Energy", "Gamora · Genius"]);
      await choice("hero:p1|hero:p2");
      state = await skipAll();
      assert.equal(state.players.find((p) => p.id === "p2").player.hp, 7);
      assert.equal(state.villain.hp, 38);
      assert.equal(state.enemyAttackCounts[state.villain.id], 1);
      assert.ok(
        state.players
          .find((p) => p.id === "p2")
          .player.discard.some((p) => p.id === f.donorId),
      );
      await checkpoint(
        "stand-protects-actual-teammate-reflects-one-native-attack",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Stand Together native teammate attack provenance at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("nemesis")) {
      const f = fixture("nemesis");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await choice("stay");
      await checkpoint(
        "equipment-malfunction-actual-ammo-obligation-cost",
        width,
        physical,
      );
      await reload();
      await choice("ammo");
      state = await skipAll();
      assert.equal(state.flags.warMachineAmmo, 0);
      assert.equal(state.player.setAside.length, 0);
      const all = [
        ...state.minions,
        ...state.sideSchemes,
        ...state.encounter.deck,
        ...state.encounter.discard,
        ...state.encounter.dealt,
        ...state.resolving,
        ...state.removed,
      ];
      assert.deepEqual(
        all
          .filter((p) => f.nemesisIds.includes(p.id))
          .map((p) => p.id)
          .sort(),
        [...f.nemesisIds].sort(),
      );
      assert.ok(state.minions.some((p) => p.code === "23029"));
      assert.ok(
        state.sideSchemes.some((p) => p.code === "23030" && p.counters === 4),
      );
      await checkpoint(
        "shadows-moves-the-same-five-set-aside-nemeses",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified printed obligation and five conserved physical nemeses at " +
          width +
          "px",
      );
    }
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
  throw error;
} finally {
  await browser.close();
}
