import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const sourceDeck = JSON.parse(
  await readFile(
    new URL("../src/data/catalog-decks.json", import.meta.url),
    "utf8",
  ),
).find((deck) => deck.id === "starter-14001a");
const sourceCodes = Object.entries(sourceDeck.cards)
  .flatMap(([code, count]) => Array(count).fill(code))
  .sort();
const output = "output/quicksilver";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture(kind='speed') {
        let s=newGame({heroId:'qsv',aspect:'protection',villainId:'rhino',heroes:[{heroId:'qsv',aspect:'protection',deckCards:heroStarterCodes('qsv')}],seed:14001,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        s.player.form=kind==='siblings'?'alter':'hero';s.player.hp=7;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=6;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];
          }
          throw Error('Missing physical source card '+code);
        }
        function hand(codes) {
          const pieces=codes.map(take);s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;
        }
        let ids={};
        if(kind==='speed') {
          const friction=take('14009');friction.exhausted=true;s.player.inPlay.push(friction);
          const [running,energy]=hand(['14003','14019']);
          ids={frictionId:friction.id,runningId:running.id,energyId:energy.id};
        } else if(kind==='siblings') {
          const scarlet=take('14002');s.player.inPlay.push(scarlet);
          const [running,double,genius]=hand(['14003','14004','14020']);
          ids={runningId:running.id,doubleId:double.id,geniusId:genius.id};
        } else if(kind==='double') {
          const [double,energy]=hand(['14004','14019']);ids={doubleId:double.id,energyId:energy.id};
          for(const code of ['01110','01107']) {
            const index=s.encounter.deck.findIndex(p=>p.code===code);if(index<0)throw Error('Missing physical target '+code);
            const piece=s.encounter.deck.splice(index,1)[0];
            if(code==='01110') {piece.engagedWith=s.activePlayerId;s.minions.push(piece);}
            else {piece.counters=3;s.sideSchemes.push(piece);}
          }
        } else if(kind==='multiple') {
          const [first,second,energy,strength]=hand(['14012','14012','14019','14021']);
          const third=s.player.deck.find(p=>p.code==='14012');if(!third)throw Error('Third physical Multiple Man missing');
          ids={multipleIds:[first.id,second.id,third.id],energyId:energy.id,strengthId:strength.id};
        } else if(kind==='defense') {
          const nerves=take('14017');s.player.inPlay.push(nerves);
          const [never,energy]=hand(['14014','14019']);
          const zero=s.encounter.deck.findIndex(p=>p.code==='01105');if(zero<0)throw Error('Missing zero boost encounter');
          s.encounter.deck.unshift(s.encounter.deck.splice(zero,1)[0]);
          s.phase='villain';s.flags.qsvSuperSpeedPhase=s.round+':player';
          s.prompt={kind:'choice',title:'Resolve the villain attack',text:'Resolve Rhino through the native attack and defense windows.',options:[{id:'attack',label:'Rhino attacks Quicksilver',effects:[{type:'enemyAttack',id:s.villain.id}]}]};
          ids={nervesId:nerves.id,neverId:never.id,energyId:energy.id};
        }
        return {state:s,...ids};
      }`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { fixture } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
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
const textState = () =>
  page.evaluate(() => JSON.parse(window.render_game_to_text()));

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
      if (sessionStorage.getItem("quicksilver-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("quicksilver-fixture-loaded", "yes");
    }, state);
  await page.goto(url);
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
    /^(skip|pass|none|done|continue|no)$/.test(o.id),
  );
  assert.ok(option, JSON.stringify(state.prompt));
  return choice(option.id);
}
async function skipAll() {
  for (let i = 0; i < 20 && (await save()).prompt; i++) await skip();
  assert.equal((await save()).prompt, null);
  return save();
}
async function respond(title) {
  for (let i = 0; i < 12; i++) {
    const state = await save();
    assert.equal(state.prompt?.kind, "choice");
    const selected = state.prompt.options.find((option) =>
      title.test(option.label),
    );
    if (selected) return choice(selected.id);
    if (
      title.test(state.prompt.title) &&
      state.prompt.options.some((option) => option.id === "yes")
    )
      return choice("yes");
    await skip();
  }
  throw Error(`Response ${title} missing`);
}
async function pay() {
  assert.equal((await save()).prompt?.kind, "payment");
  await page
    .getByRole("button", { name: "Suggest resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  return settle();
}
async function reload() {
  const before = await save();
  await writeFile(
    `${output}/reload-before.json`,
    JSON.stringify(before, null, 2),
  );
  await page.reload();
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
function physicalCards(state) {
  return [
    ...state.player.hand,
    ...state.player.deck,
    ...state.player.discard,
    ...state.player.inPlay,
    ...state.resolving.filter((p) => /^14/.test(p.code)),
  ]
    .map((p) => p.id)
    .sort();
}

function conserved(state, expected, message) {
  const cards = physicalCards(state);
  assert.equal(cards.length, 40, `${message}: all 40 physical source cards`);
  assert.deepEqual(
    [
      ...state.player.hand,
      ...state.player.deck,
      ...state.player.discard,
      ...state.player.inPlay,
      ...state.resolving.filter((p) => /^14/.test(p.code)),
    ]
      .map((p) => p.code)
      .sort(),
    sourceCodes,
    `${message}: exact source printing quantities`,
  );
  assert.deepEqual(cards, expected, `${message}: physical instances conserved`);
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

try {
  let state;
  if (!process.env.QUICKSILVER_FIXTURE_ONLY) {
    await open();
    await page
      .getByRole("button", { name: /All heroes & starter decks/ })
      .click();
    const catalog = page.getByRole("dialog", {
      name: "All heroes & starter decks",
    });
    await catalog
      .getByRole("textbox", { name: "Search heroes and products" })
      .fill("Quicksilver");
    await catalog
      .locator(".catalog-hero-row")
      .filter({ has: page.locator("b", { hasText: /^Quicksilver$/ }) })
      .first()
      .click();
    await catalog
      .locator(".catalog-hero-detail")
      .getByRole("button", {
        name: "Choose Quicksilver for mission",
        exact: true,
      })
      .click();
    await page.getByRole("button", { name: /View 40-card deck/ }).click();
    assert.match(
      await page.locator(".deck-provenance").innerText(),
      /Source preconstructed list: Quicksilver Starter Deck/,
    );
    await capture("source-deck");
    await audit("Quicksilver source starter deck");
    await page.keyboard.press("Escape");
    await page.locator("#start-btn").click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    state = await save();
    assert.equal(state.heroId, "qsv");
    assert.equal(state.players[0].deckCards.length, 40);
    assert.deepEqual([...state.players[0].deckCards].sort(), sourceCodes);
    assert.equal(state.player.form, "alter");
    const sourcePhysical = physicalCards(state);
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    state = await settle();
    conserved(state, sourcePhysical, "Source mission launch");
    for (const width of [1440, 1280, 390, 320])
      await checkpoint("source-board", width, sourcePhysical);
    await reload();
    checks.push(
      "Catalog launches exact Quicksilver source 40-card Protection starter with original printing IDs and Pietro alter-ego saved state",
    );
  }
  for (const width of (process.env.QUICKSILVER_VIEWPORTS || "1440,1280,390,320")
    .split(",")
    .map(Number)) {
    const scenarios = (
      process.env.QUICKSILVER_SCENARIOS ||
      "speed,siblings,double,multiple,defense"
    ).split(",");
    if (scenarios.includes("speed")) {
      const speed = fixture("speed");
      await open(speed.state, width);
      const physical = physicalCards(await save());
      await page.locator(".attack-action").click();
      await settle();
      if (
        (await save()).prompt?.options.some(
          (o) => o.id === speed.state.villain.id,
        )
      )
        await choice(speed.state.villain.id);
      await findChoice(
        (o) => /Super Speed/.test(o.label) || o.id === "yes",
        "Super Speed response",
      );
      await checkpoint("super-speed-response", width, physical);
      await reload();
      state = await respond(/Super Speed/);
      assert.equal(state.player.exhausted, false);
      state = await respond(/Friction Resistance/);
      state = await skipAll();
      assert.equal(state.villain.hp, 39);
      assert.equal(state.flags.qsvSuperSpeedPhase, state.round + ":player");
      assert.equal(
        state.player.inPlay.find((p) => p.id === speed.frictionId).exhausted,
        false,
      );
      await checkpoint("super-speed-after", width, physical);
      await reload();
      await page.locator(".thwart-action").click();
      await settle();
      if ((await save()).prompt?.options.some((o) => o.id === "main"))
        await choice("main");
      state = await save();
      assert.ok(
        !/Super Speed/.test(state.prompt?.title || "") &&
          !state.prompt?.options.some((o) => /Super Speed/.test(o.label)),
        "Super Speed is unavailable after the second basic power in this phase",
      );
      state = await skipAll();
      assert.equal(state.scheme.threat, 5);
      assert.equal(state.player.exhausted, true);
      await play("Always Be Running");
      await checkpoint("friction-resource-payment", width, physical);
      await reload();
      state = await payWith(["Friction Resistance"]);
      assert.equal(state.player.exhausted, false);
      state = await respond(/Friction Resistance/);
      state = await skipAll();
      assert.equal(
        state.player.inPlay.find((p) => p.id === speed.frictionId).exhausted,
        false,
      );
      assert.ok(state.player.hand.some((p) => p.id === speed.energyId));
      assert.equal(
        state.player.discard.filter((p) => p.id === speed.runningId).length,
        1,
      );
      await checkpoint("friction-after-ready", width, physical);
      await reload();
      console.log(`Verified speed native browser flow at ${width}px`);
    }
    if (scenarios.includes("siblings")) {
      const siblings = fixture("siblings");
      await open(siblings.state, width);
      const siblingsPhysical = physicalCards(await save());
      const beforeHand = (await save()).player.hand.length;
      await page.getByRole("button", { name: /Superpowered Siblings/ }).click();
      state = await settle();
      assert.equal(state.prompt?.kind, "select");
      assert.equal(state.prompt.min, 2);
      assert.equal(state.prompt.max, 2);
      await checkpoint("siblings-selection", width, siblingsPhysical);
      await reload();
      for (const id of [siblings.runningId, siblings.doubleId]) {
        const index = (await save()).prompt.options.findIndex(
          (o) => o.id === id,
        );
        assert.ok(index >= 0);
        await page.locator(".decision-option").nth(index).click();
      }
      await page
        .getByRole("button", { name: "Confirm selection", exact: true })
        .click();
      state = await settle();
      state = await skipAll();
      assert.equal(state.player.hand.length, beforeHand + 1);
      assert.equal(state.flags.qsvSiblingsRound, state.round);
      for (const id of [siblings.runningId, siblings.doubleId])
        assert.equal(state.player.discard.filter((p) => p.id === id).length, 1);
      assert.ok(state.player.hand.some((p) => p.id === siblings.geniusId));
      await checkpoint("siblings-after-draw", width, siblingsPhysical);
      await reload();
      console.log(`Verified siblings native browser flow at ${width}px`);
    }
    if (scenarios.includes("double")) {
      const double = fixture("double");
      await open(double.state, width);
      const doublePhysical = physicalCards(await save());
      await play("Double Time");
      await checkpoint("double-time-payment", width, doublePhysical);
      await reload();
      state = await payWith(["Energy"]);
      await findChoice((o) => o.id === "damage", "Double Time first option");
      await checkpoint("double-time-first-choice", width, doublePhysical);
      await reload();
      await choice("damage");
      await findChoice(
        (o) => o.id === double.state.villain.id,
        "Double Time enemy",
      );
      state = await choice(double.state.villain.id);
      await findChoice((o) => o.id === "thwart", "Double Time second option");
      assert.equal((await save()).villain.hp, 38);
      await checkpoint("double-time-second-choice", width, doublePhysical);
      await reload();
      await choice("thwart");
      await findChoice((o) => o.id === "main", "Double Time scheme");
      await choice("main");
      state = await skipAll();
      assert.equal(state.scheme.threat, 4);
      assert.equal(state.villain.hp, 38);
      assert.equal(state.player.exhausted, false);
      assert.equal(
        state.player.discard.filter((p) => p.id === double.doubleId).length,
        1,
      );
      await checkpoint("double-time-after", width, doublePhysical);
      await reload();
      console.log(`Verified double native browser flow at ${width}px`);
    }
    if (scenarios.includes("multiple")) {
      const multiple = fixture("multiple");
      await open(multiple.state, width);
      const multiplePhysical = physicalCards(await save());
      await play("Multiple Man");
      state = await payWith(["Energy", "Strength"]);
      await checkpoint("multiple-man-response", width, multiplePhysical);
      await reload();
      for (let i = 0; i < 2; i++) {
        state = await respond(/Multiple Man/);
        await findChoice(
          (o) => o.id === "deck",
          "Multiple Man search locations",
        );
        await choice("deck");
        await findChoice(
          (o) => multiple.multipleIds.includes(o.id),
          "Multiple Man physical search",
        );
        await checkpoint("multiple-man-search-" + i, width, multiplePhysical);
        await reload();
        const selected = (await save()).prompt.options.find((o) =>
          multiple.multipleIds.includes(o.id),
        );
        assert.ok(selected);
        state = await choice(selected.id);
      }
      state = await skipAll();
      assert.deepEqual(
        state.player.inPlay
          .filter((p) => p.code === "14012")
          .map((p) => p.id)
          .sort(),
        [...multiple.multipleIds].sort(),
      );
      assert.equal(
        state.player.inPlay.filter((p) => p.code === "14012").length,
        3,
      );
      await checkpoint("multiple-man-after", width, multiplePhysical);
      await reload();
      console.log(`Verified multiple native browser flow at ${width}px`);
    }
    if (scenarios.includes("defense")) {
      const defense = fixture("defense");
      await open(defense.state, width);
      const defensePhysical = physicalCards(await save());
      await choice("attack");
      await findChoice((o) => o.id === "hero", "Native defense declaration");
      await checkpoint("defense-declaration", width, defensePhysical);
      await reload();
      await choice("hero");
      state = await respond(/Never Back Down/);
      assert.equal(state.prompt?.kind, "payment");
      assert.equal(state.prompt.cost, 1);
      await checkpoint("never-back-down-payment", width, defensePhysical);
      await reload();
      state = await payWith(["Nerves of Steel"]);
      await findChoice(
        (o) => /Super Speed/.test(o.label) || o.id === "yes",
        "Villain phase Super Speed",
      );
      await checkpoint("villain-super-speed", width, defensePhysical);
      await reload();
      state = await respond(/Super Speed/);
      state = await skipAll();
      assert.equal(state.player.hp, 7);
      assert.equal(state.player.exhausted, false);
      assert.equal(state.villain.stunned, true);
      assert.equal(state.flags.qsvSuperSpeedPhase, state.round + ":villain");
      assert.equal(
        state.player.inPlay.find((p) => p.id === defense.nervesId).exhausted,
        true,
      );
      assert.ok(state.player.hand.some((p) => p.id === defense.energyId));
      await checkpoint("defense-after", width, defensePhysical);
      await reload();
      console.log(`Verified defense native browser flow at ${width}px`);
    }
    checks.push(
      `At ${width}px native ${scenarios.join(", ")} interactions conserve all 40 source cards across reload`,
    );
  }
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((result) => result.violations.length === 0),
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
    const saved = await Promise.race([
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
      JSON.stringify(saved, null, 2),
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
