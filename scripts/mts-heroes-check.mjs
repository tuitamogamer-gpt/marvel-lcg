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
    ["spectrum", "21001a", "Spectrum", "leadership"],
    ["warlock", "21031a", "Adam Warlock", "aggression"],
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
const output = process.env.MTS_OUTPUT || "output/mts-heroes";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture(kind='transform') {
        const heroId=['transform','blast','photon','shield','obligation','mass'].includes(kind)?'spectrum':'warlock';
        const aspect=heroId==='spectrum'?'leadership':'aggression';
        let s=newGame({heroId,aspect,villainId:'rhino',heroes:[{heroId,aspect,deckCards:heroStarterCodes(heroId)}],seed:heroId==='spectrum'?21001:21031,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        for(let i=0;i<40&&s.review;i++){s=dispatch(s,{type:'PROCEED'});if(s.error)throw Error(s.error);}
        if(s.prompt||s.review)throw Error('Unexpected setup prompt '+JSON.stringify(s.prompt));
        s.player.form=['transform','avatar'].includes(kind)?'alter':'hero';s.player.hp=7;s.player.flipped=false;s.player.exhausted=false;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const index=zone.findIndex(p=>p.code===code);if(index>=0)return zone.splice(index,1)[0];
          }
          throw Error('Missing physical source printing '+code);
        }
        function hand(codes) {const pieces=codes.map(take);s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;}
        function inPlay(code,exhausted=false) {const piece=take(code);piece.exhausted=exhausted;s.player.inPlay.push(piece);return piece;}
        function encounter(code) {for(const zone of [s.encounter.deck,s.encounter.discard,s.player.setAside||[]]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing actual encounter '+code);}
        function encounterTop(code) {const p=encounter(code);s.encounter.deck.unshift(p);return p;}
        function minion(code='01110') {const p=encounter(code);p.engagedWith=s.activePlayerId;p.damage=0;s.minions.push(p);return p;}
        function side(code='01108',counters=4) {const p=encounter(code);p.counters=counters;s.sideSchemes.push(p);return p;}
        function native(effects,title='Resolve native rules') {s.prompt={kind:'choice',title,text:'Resolve the actual engine windows.',options:[{id:'go',label:'Resolve printed rules',effects}]};}
        function attack() {encounterTop('01105');native([{type:'enemyAttack',id:s.villain.id}]);}
        let ids={};
        if(heroId==='spectrum') {const forms=s.player.inPlay.filter(p=>['21002','21003','21004'].includes(p.code));if(forms.length!==3)throw Error('Native Spectrum setup must extract three original Permanent cards before opening hand');ids={gammaId:forms.find(p=>p.code==='21002').id,photonId:forms.find(p=>p.code==='21003').id,pulsarId:forms.find(p=>p.code==='21004').id};if(kind!=='transform')s.flags.spectrumEnergyFormId=kind==='photon'?ids.photonId:ids.gammaId;}
        if(kind==='transform') {s.player.exhausted=true;const rumble=inPlay('21022');const [moxie,event]=hand(['21017','21010']);ids={...ids,rumbleId:rumble.id,moxieId:moxie.id,eventId:event.id,drawId:s.player.deck[0].id};}
        else if(kind==='blast') {const a=inPlay('21006'),b=inPlay('21006');const [event,resource]=hand(['21007','21017']);const enemy=minion();ids={...ids,dupIds:[a.id,b.id],eventId:event.id,resourceId:resource.id,minionId:enemy.id};}
        else if(kind==='photon') {const [event,resource]=hand(['21008','21024']);const crisis=side();ids={...ids,eventId:event.id,resourceId:resource.id,crisisId:crisis.id};}
        else if(kind==='shield') {const [event,resource]=hand(['21009','21010']);attack();ids={...ids,eventId:event.id,resourceId:resource.id};}
        else if(kind==='obligation') {hand(['21010']);const obligation=encounter('21026');native([{type:'reveal',piece:obligation}]);ids={...ids,obligationId:obligation.id};}
        else if(kind==='mass') {const allies=[inPlay('21005'),inPlay('21011'),inPlay('21013')];inPlay('21015');const [event,band]=hand(['21016','21018']);ids={...ids,allyIds:allies.map(p=>p.id),eventId:event.id,bandId:band.id};}
        else if(kind==='mage') {s.player.exhausted=true;const cape=inPlay('21035'),a=inPlay('21037'),b=inPlay('21037');const [discard]=hand(['21046']);ids={capeId:cape.id,sensesIds:[a.id,b.id],discardId:discard.id,drawIds:s.player.deck.slice(0,2).map(p=>p.id)};}
        else if(kind==='spells') {const staff=inPlay('21034');const [blast,resource,quantum,second]=hand(['21038','21065','21040','21039']);const cards=['21044','21049','21056','21062'].map(take);s.player.deck.unshift(...cards);ids={staffId:staff.id,blastId:blast.id,quantumId:quantum.id,topIds:cards.map(p=>p.id),returnId:cards[0].id};}
        else if(kind==='avatar') {const soul=inPlay('21033');soul.counters=1;s.player.stunned=true;s.player.tough=true;const [discard]=hand(['21065']);ids={soulId:soul.id,discardId:discard.id};}
        else if(kind==='ward') {s.scheme.threat=3;const a=inPlay('21036'),b=inPlay('21036');hand(['21040']);const treachery=encounter('21070');native([{type:'reveal',piece:treachery}]);ids={wardIds:[a.id,b.id],treacheryId:treachery.id};}
        else if(kind==='shield-spell') {const ally=inPlay('21047');ally.damage=1;const [event,...spent]=hand(['21061','21046','21052','21058','21064']);attack();ids={eventId:event.id,allyId:ally.id,spentIds:spent.map(p=>p.id),costIds:s.player.deck.slice(0,2).map(p=>p.id),deckSize:s.player.deck.length};}
        else if(kind==='cosmic') {const ward=inPlay('21036'),staff=inPlay('21034');const [event,resource]=hand(['21048','21065']);const revealed=take('21042');s.resolving.push(revealed);native([{type:'reveal',piece:revealed}]);ids={wardId:ward.id,staffId:staff.id,eventId:event.id,revealedId:revealed.id};}
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
      if (sessionStorage.getItem("mts-heroes-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("mts-heroes-fixture-loaded", "yes");
    }, state);
  await page.goto(url, { waitUntil: "domcontentloaded" });
  for (const script of await page
    .locator('script[type="module"][src]')
    .evaluateAll((scripts) => scripts.map((script) => script.src)))
    if (/\/assets\/index-[^/]+\.js$/.test(script)) entryAssets.add(script);
  assert.ok(entryAssets.size <= 1, "One immutable production entry asset");
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
  const sourceCodes = sources[state.heroId].codes;
  const sourceSet = new Set(sourceCodes);
  const pieces = [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
    ...state.player.inPlay,
    ...state.resolving.filter((piece) => sourceSet.has(piece.code)),
    ...state.removed.filter((piece) => sourceSet.has(piece.code)),
    ...state.encounter.deck.filter((piece) => sourceSet.has(piece.code)),
    ...state.encounter.discard.filter((piece) => sourceSet.has(piece.code)),
    ...state.encounter.dealt.filter((piece) => sourceSet.has(piece.code)),
  ].filter((piece) => sourceSet.has(piece.code));
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
  assert.equal(
    pieces.length,
    sources[state.heroId].codes.length,
    `${message}: original physical source composition`,
  );
  assert.equal(
    pieces.filter((p) => !["21002", "21003", "21004"].includes(p.code)).length,
    40,
    `${message}: all forty playing deck cards`,
  );
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
async function assertForms(active) {
  for (const [name, code] of [
    ["Gamma", "21002"],
    ["Photon", "21003"],
    ["Pulsar", "21004"],
  ]) {
    const label =
      name === active ? "Inspect " + name : name + " · facedown energy form";
    const button = page.getByRole("button", { name: label, exact: true });
    assert.equal(
      await button.count(),
      1,
      "One physical " + name + " has the correct visible face",
    );
    assert.equal(
      await button
        .locator(
          name === active
            ? `.card-image[data-card-preview="${code}"]`
            : '.premium-card-back.back-hero[data-card-preview="back:hero"]',
        )
        .count(),
      1,
      name + " renders its physical front or facedown hero back",
    );
  }
}

try {
  let state;
  const viewports = (process.env.MTS_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number);
  const sourceViewports = (
    process.env.MTS_SOURCE_VIEWPORTS || viewports.join(",")
  )
    .split(",")
    .map(Number);
  if (!process.env.MTS_FIXTURE_ONLY) {
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
      if (id === "warlock") {
        const aspects = page.locator(".aspect-grid .aspect-option");
        assert.equal(await aspects.count(), 4);
        for (const button of await aspects.all()) {
          assert.equal(await button.isDisabled(), true);
          assert.equal(await button.getAttribute("aria-pressed"), "true");
        }
      }
      await page.getByRole("button", { name: /View 40-card deck/ }).click();
      assert.match(
        await page.locator(".deck-provenance").innerText(),
        new RegExp(
          "Source preconstructed list: " + source.name + " Starter Deck",
        ),
      );
      if (id === "spectrum")
        assert.match(
          await page.getByRole("dialog").innerText(),
          /3 Permanent energy forms start in play and stay outside the deck count/i,
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
      if (id === "warlock")
        assert.deepEqual(
          state.player.setAside.map((p) => p.code).sort(),
          ["21067", "21068", "21069", "21069", "21070"],
          "Warlock setup holds the five actual nemesis source pieces",
        );
      const physical = physicalCards(state);
      if (id === "spectrum") {
        assert.deepEqual(
          state.player.inPlay
            .filter((p) => ["21002", "21003", "21004"].includes(p.code))
            .map((p) => p.code)
            .sort(),
          ["21002", "21003", "21004"],
        );
        assert.ok(!state.flags.spectrumEnergyFormId);
      }
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      state = await settle();
      assert.equal(state.prompt, null);
      if (id === "spectrum") await assertForms();
      for (const width of sourceViewports)
        await checkpoint(id + "-source-board", width, physical);
      await reload();
      checks.push(
        source.name +
          " catalog launches exact original physical source (" +
          source.codes.length +
          " cards, forty-card playing deck); setup and printing IDs survive reload",
      );
    }
  }
  const scenarios = (
    process.env.MTS_SCENARIOS ??
    "transform,blast,photon,shield,obligation,mass,mage,spells,avatar,ward,shield-spell,cosmic"
  )
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
  const supported = new Set([
    "transform",
    "blast",
    "photon",
    "shield",
    "obligation",
    "mass",
    "mage",
    "spells",
    "avatar",
    "ward",
    "shield-spell",
    "cosmic",
  ]);
  assert.ok(
    scenarios.every((n) => supported.has(n)),
    "Unknown MTS scenario",
  );
  assert.ok(
    !process.env.MTS_FIXTURE_ONLY || scenarios.length,
    "Choose at least one native fixture scenario",
  );
  for (const width of viewports) {
    if (scenarios.includes("transform")) {
      const f = fixture("transform");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.locator(".flip-button").click();
      await settle();
      await findChoice(
        (o) => o.id === f.gammaId,
        "Required physical energy transformation",
      );
      await checkpoint(
        "spectrum-required-physical-energy-form",
        width,
        physical,
      );
      await reload();
      await choice(f.gammaId);
      await findChoice((o) => o.id === f.gammaId, "Gamma response union");
      await checkpoint("spectrum-shared-form-response-order", width, physical);
      await reload();
      await choice(f.rumbleId);
      await response(f.moxieId, "Physical Moxie response");
      if ((await save()).prompt?.kind === "payment") await payWith([]);
      await response(f.gammaId, "Physical Gamma response");
      await target("villain");
      state = await skipAll();
      assert.equal(state.villain.hp, 39);
      assert.equal(state.player.exhausted, false);
      assert.equal(state.flags.spectrumEnergyFormId, f.gammaId);
      assert.equal(state.player.flipped, true);
      assert.ok(state.player.discard.some((p) => p.id === f.rumbleId));
      await assertForms("Gamma");
      assert.equal(
        await page.locator(".attack-action .action-value").innerText(),
        "4",
      );
      await checkpoint("spectrum-gamma-moxie-rumble-complete", width, physical);
      await reload();
      await play("Speed of Light");
      if ((await save()).prompt?.kind === "payment") await payWith([]);
      await response(f.photonId, "Speed of Light different physical form");
      await findChoice(
        (o) => o.id === f.photonId,
        "Photon after complete draw",
      );
      state = await save();
      assert.ok(state.player.hand.some((p) => p.id === f.drawId));
      await checkpoint(
        "speed-of-light-draw-before-form-response",
        width,
        physical,
      );
      await reload();
      await choice(f.photonId);
      await target("main");
      state = await skipAll();
      assert.equal(state.scheme.threat, 5);
      assert.equal(state.flags.spectrumEnergyFormId, f.photonId);
      assert.equal(state.player.flipped, true);
      await assertForms("Photon");
      await checkpoint(
        "spectrum-photon-preserves-voluntary-flip-budget",
        width,
        physical,
      );
      await page
        .getByRole("button", {
          name: "Gamma · facedown energy form",
          exact: true,
        })
        .click();
      assert.match(
        await page
          .getByRole("status")
          .filter({ hasText: "Facedown energy form." })
          .innerText(),
        /Current energy form: Photon\. Its text is inactive while facedown\./,
      );
      await page.keyboard.press("Escape");
      await reload();
      console.log(
        "Verified Spectrum physical forms and ordered responses at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("blast")) {
      const f = fixture("blast");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Gamma Blast");
      await checkpoint(
        "energy-duplication-two-physical-payment-sources",
        width,
        physical,
      );
      await reload();
      await payWith(["Energy Duplication", "Energy Duplication", "Moxie"]);
      await target(f.minionId);
      state = await skipAll();
      assert.equal(state.villain.hp, 35);
      assert.equal(
        state.minions.some((p) => p.id === f.minionId),
        false,
      );
      assert.ok(
        f.dupIds.every(
          (id) => state.player.inPlay.find((p) => p.id === id).exhausted,
        ),
      );
      assert.equal(state.flags.spectrumEnergyFormId, f.gammaId);
      await checkpoint("already-gamma-blast-real-overkill", width, physical);
      await reload();
      console.log(
        "Verified Energy Duplication and Gamma Blast at " + width + "px",
      );
    }
    if (scenarios.includes("photon")) {
      const f = fixture("photon");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Photon Speed");
      await checkpoint("photon-speed-source-resource-payment", width, physical);
      await reload();
      await payWith(["Genius"]);
      await findChoice(
        (o) => o.id === "main",
        "Already Photon ignores only Crisis",
      );
      await checkpoint("photon-speed-main-through-crisis", width, physical);
      await reload();
      await choice("main");
      state = await skipAll();
      assert.equal(state.scheme.threat, 2);
      assert.equal(
        state.sideSchemes.find((p) => p.id === f.crisisId).counters,
        4,
      );
      await basic("thwart");
      state = await save();
      assert.ok(!state.prompt?.options.some((o) => o.id === "main"));
      await target(f.crisisId);
      state = await skipAll();
      assert.equal(state.scheme.threat, 2);
      assert.equal(
        state.sideSchemes.find((p) => p.id === f.crisisId).counters,
        1,
      );
      await checkpoint(
        "ordinary-photon-thwart-still-obeys-crisis",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Photon Speed and ordinary Crisis restriction at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("shield")) {
      const f = fixture("shield");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await response("hero", "Spectrum actual basic defender");
      await findChoice(
        (o) => o.id === f.eventId,
        "Pulsar Shield actual defense interrupt",
      );
      await checkpoint("pulsar-shield-native-defense-window", width, physical);
      await reload();
      await choice(f.eventId);
      await checkpoint(
        "pulsar-shield-actual-resource-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Speed of Light"]);
      await response(f.pulsarId, "Pulsar after complete ready");
      state = await skipAll();
      assert.equal(state.player.hp, 8);
      assert.equal(state.player.exhausted, false);
      assert.equal(state.flags.spectrumEnergyFormId, f.pulsarId);
      await checkpoint(
        "pulsar-shield-refreshes-defense-readies-heals",
        width,
        physical,
      );
      await reload();
      console.log("Verified Pulsar Shield native defense at " + width + "px");
    }
    if (scenarios.includes("obligation")) {
      const f = fixture("obligation");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      state = await skipAll();
      assert.ok(state.player.inPlay.some((p) => p.id === f.obligationId));
      await checkpoint(
        "loss-of-control-owned-physical-obligation",
        width,
        physical,
      );
      await reload();
      await page.locator(".flip-button").click();
      state = await settle();
      assert.equal(state.player.form, "alter");
      assert.ok(!state.flags.spectrumEnergyFormId);
      await inPlayAction("Loss of Control", /remove/);
      state = await skipAll();
      assert.equal(state.player.exhausted, true);
      assert.equal(
        state.removed.filter((p) => p.id === f.obligationId).length,
        1,
      );
      await checkpoint(
        "loss-of-control-ae-action-removes-exact-source",
        width,
        physical,
      );
      await reload();
      console.log("Verified Spectrum persistent obligation at " + width + "px");
    }
    if (scenarios.includes("mass")) {
      const f = fixture("mass");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Mass Attack");
      await checkpoint(
        "band-together-dynamic-three-wild-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Band Together"]);
      state = await save();
      const group = state.prompt.options.find((o) =>
        f.allyIds.every((id) => o.id.split("+").includes(id)),
      );
      assert.ok(group);
      await checkpoint("mass-attack-actual-three-ally-cost", width, physical);
      await reload();
      await choice(group.id);
      await target("villain");
      state = await skipAll();
      assert.equal(state.villain.hp, 28);
      assert.ok(
        f.allyIds.every(
          (id) => state.player.inPlay.find((p) => p.id === id).exhausted,
        ),
      );
      assert.equal(state.player.exhausted, false);
      await checkpoint(
        "mass-attack-mighty-avengers-physical-allies",
        width,
        physical,
      );
      await reload();
      console.log("Verified Band Together and Mass Attack at " + width + "px");
    }
    if (scenarios.includes("mage")) {
      const f = fixture("mage");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.getByRole("button", { name: /Battle Mage/ }).click();
      await checkpoint("battle-mage-physical-aspect-discard", width, physical);
      await reload();
      await choice(f.discardId);
      await target("villain");
      await findChoice(
        (o) => o.id === f.sensesIds[0],
        "Battle Mage independent physical responses",
      );
      await checkpoint(
        "mystic-senses-and-cape-response-order",
        width,
        physical,
      );
      await reload();
      await choice(f.sensesIds[0]);
      await response(f.capeId, "Actual Cape ready");
      await response(f.sensesIds[1], "Second actual Mystic Senses draw");
      state = await skipAll();
      assert.equal(state.villain.hp, 38);
      assert.equal(state.player.exhausted, false);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.capeId).exhausted,
        true,
      );
      assert.ok(
        f.drawIds.every((id) => state.player.hand.some((p) => p.id === id)),
      );
      assert.equal(
        state.flags.warlockMagePhase,
        `${state.round}:${state.phase}`,
      );
      assert.equal(
        await page.getByRole("button", { name: /Battle Mage/ }).count(),
        0,
      );
      await checkpoint(
        "battle-mage-real-draws-once-per-phase",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Battle Mage, Mystic Senses and Cape at " + width + "px",
      );
    }
    if (scenarios.includes("spells")) {
      const f = fixture("spells");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await play("Karmic Blast");
      await checkpoint("karmic-staff-native-resource-payment", width, physical);
      await reload();
      await payWith(["Karmic Staff", "Martinex"]);
      await findChoice(
        (o) => o.id === "4",
        "Karmic Blast original deck discard count",
      );
      await checkpoint("karmic-blast-count-before-looking", width, physical);
      await reload();
      await choice("4");
      await target("villain");
      state = await skipAll();
      assert.equal(state.villain.hp, 32);
      assert.ok(
        f.topIds.every((id) => state.player.discard.some((p) => p.id === id)),
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.staffId).exhausted,
        true,
      );
      await checkpoint(
        "karmic-blast-four-distinct-actual-aspects",
        width,
        physical,
      );
      await reload();
      await play("Quantum Magic");
      await payWith(["Cosmic Awareness"]);
      await findChoice(
        (o) => o.id === f.returnId,
        "Quantum Magic actual discarded printing",
      );
      await checkpoint(
        "quantum-magic-physical-discard-choice",
        width,
        physical,
      );
      await reload();
      await choice(f.returnId);
      state = await skipAll();
      assert.ok(state.player.hand.some((p) => p.id === f.returnId));
      assert.ok(!state.player.discard.some((p) => p.id === f.returnId));
      await checkpoint(
        "quantum-magic-returns-the-same-source-id",
        width,
        physical,
      );
      await reload();
      console.log("Verified Karmic Blast and Quantum Magic at " + width + "px");
    }
    if (scenarios.includes("avatar")) {
      const f = fixture("avatar");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await page.getByRole("button", { name: /Avatar of Life/ }).click();
      await checkpoint("avatar-of-life-physical-discard", width, physical);
      await reload();
      await choice(f.discardId);
      await response("stunned", "Avatar removes only one selected status");
      state = await skipAll();
      assert.equal(state.player.stunned, false);
      assert.equal(state.player.tough, true);
      await inPlayAction("Soul World", /heal all/);
      state = await skipAll();
      assert.equal(state.player.hp, 11);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.soulId).counters,
        0,
      );
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.soulId).exhausted,
        true,
      );
      await checkpoint("soul-world-actual-counter-full-heal", width, physical);
      await reload();
      console.log("Verified Avatar of Life and Soul World at " + width + "px");
    }
    if (scenarios.includes("ward")) {
      const f = fixture("ward");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await findChoice(
        (o) => o.id === f.wardIds[0],
        "Cosmic Ward forced duplicate-source choice",
      );
      await checkpoint(
        "cosmic-ward-physical-forced-interrupt",
        width,
        physical,
      );
      await reload();
      await choice(f.wardIds[0]);
      state = await skipAll();
      assert.equal(state.scheme.threat, 5);
      assert.equal(
        state.sideSchemes.some((p) => p.code === "21068"),
        false,
      );
      assert.ok(state.encounter.discard.some((p) => p.id === f.treacheryId));
      assert.ok(state.player.discard.some((p) => p.id === f.wardIds[0]));
      assert.ok(state.player.inPlay.some((p) => p.id === f.wardIds[1]));
      await checkpoint(
        "cosmic-ward-cancels-reveal-keeps-incite",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Cosmic Ward physical cancellation at " + width + "px",
      );
    }
    if (scenarios.includes("shield-spell")) {
      const f = fixture("shield-spell");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      await findChoice(
        (o) => o.id === f.eventId,
        "Shield Spell actual full-discard damage interrupt",
      );
      await checkpoint(
        "shield-spell-real-attack-damage-window",
        width,
        physical,
      );
      await reload();
      await choice(f.eventId);
      state = await save();
      assert.equal(state.prompt.title, "Shield Spell");
      assert.deepEqual(
        state.prompt.options.map((o) => o.id),
        ["continue", "spend"],
      );
      await checkpoint(
        "shield-spell-zero-cost-optional-resource-choice",
        width,
        physical,
      );
      await reload();
      await choice("spend");
      assert.equal((await save()).prompt.cost, 0);
      await checkpoint(
        "shield-spell-zero-cost-physical-overpayment",
        width,
        physical,
      );
      await reload();
      await payWith([
        "Audacity",
        "Determination",
        "Innovation",
        "Preservation",
      ]);
      assert.equal((await save()).prompt.title, "Audacity");
      await checkpoint(
        "shield-spell-spent-resource-response-before-discard",
        width,
        physical,
      );
      await reload();
      for (const name of [
        "Audacity",
        "Determination",
        "Innovation",
        "Preservation",
      ]) {
        assert.equal((await save()).prompt.title, name);
        await choice("yes");
        if (name === "Innovation") await target(f.allyId);
      }
      state = await skipAll();
      assert.equal(state.villain.hp, 39);
      assert.equal(state.scheme.threat, 5);
      assert.equal(state.player.hp, 8);
      assert.equal(
        state.player.inPlay.find((p) => p.id === f.allyId).damage,
        0,
      );
      assert.equal(state.player.deck.length, f.deckSize - 2);
      assert.ok(
        [...f.spentIds, ...f.costIds, f.eventId].every((id) =>
          state.player.discard.some((p) => p.id === id),
        ),
      );
      await checkpoint(
        "shield-spell-full-physical-discard-prevents-all-damage",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified Shield Spell zero-cost physical spending and full prevention at " +
          width +
          "px",
      );
    }
    if (scenarios.includes("cosmic")) {
      const f = fixture("cosmic");
      await open(f.state, width);
      const physical = physicalCards(await save());
      await choice("go");
      state = await skipAll();
      assert.equal(state.villain.hp, 38);
      assert.equal(
        state.removed.filter((p) => p.id === f.revealedId).length,
        1,
      );
      assert.ok(state.player.inPlay.some((p) => p.id === f.wardId));
      await checkpoint(
        "in-betweener-reveal-removes-same-player-source",
        width,
        physical,
      );
      await reload();
      await play("Living Tribunal");
      await checkpoint(
        "cosmic-player-event-native-shuffle-payment",
        width,
        physical,
      );
      await reload();
      await payWith(["Karmic Staff", "Martinex"]);
      state = await skipAll();
      assert.equal(
        state.encounter.deck.filter((p) => p.id === f.eventId).length,
        1,
      );
      assert.equal(
        state.encounter.deck.find((p) => p.id === f.eventId).ownerId,
        state.activePlayerId,
      );
      await checkpoint(
        "living-tribunal-preserves-owner-in-encounter-deck",
        width,
        physical,
      );
      await reload();
      console.log(
        "Verified cosmic player sources across encounter and removed zones at " +
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
        " flow preserves the original physical source composition through saved choices/payments and exact reload at " +
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
