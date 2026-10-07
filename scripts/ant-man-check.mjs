import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const output = "output/ant-man";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixture() {
        let s=newGame({heroId:'ant',aspect:'leadership',villainId:'rhino',heroes:[{heroId:'ant',aspect:'leadership',deckCards:heroStarterCodes('ant')}],seed:12001,pacing:'expert'});
        s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
        s.player.form='hero';s.player.heroForm='tiny';s.player.hp=6;
        s.villain.hp=s.villain.maxHp=40;s.scheme.threat=5;
        function take(code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];
          }
          throw Error('Missing physical source card '+code);
        }
        const helmet=take('12008'),strength=take('12009'),ants=take('12007'),gauntlets=take('12010');
        const resize=take('12005'),stomp=take('12003'),pym=take('12006'),energy=take('12021');
        s.player.inPlay.push(helmet,strength,ants,gauntlets);
        s.player.deck.push(...s.player.hand);s.player.hand=[resize,stomp,pym,energy];
        return {state:s,helmetId:helmet.id,strengthId:strength.id,antsId:ants.id,resizeId:resize.id,stompId:stomp.id,pymId:pym.id,energyId:energy.id};
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
const data = fixture();
const browser = await chromium.launch({ headless: true });
const require = createRequire(import.meta.url);
const url = process.env.BASE_URL || "http://127.0.0.1:5175";
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
      if (sessionStorage.getItem("ant-man-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(saved));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("ant-man-fixture-loaded", "yes");
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
  ]
    .map((p) => p.id)
    .sort();
}

try {
  let state;
  if (!process.env.ANT_MAN_FIXTURE_ONLY) {
    await open();
    await page
      .getByRole("button", { name: /All heroes & starter decks/ })
      .click();
    const catalog = page.getByRole("dialog", {
      name: "All heroes & starter decks",
    });
    await catalog
      .getByRole("textbox", { name: "Search heroes and products" })
      .fill("Ant-Man");
    await catalog
      .locator(".catalog-hero-row")
      .filter({ has: page.locator("b", { hasText: "Ant-Man" }) })
      .first()
      .click();
    const detail = catalog.locator(".catalog-hero-detail");
    await detail
      .getByRole("button", { name: "Choose Ant-Man for mission", exact: true })
      .click();
    await page.getByRole("button", { name: /View 40-card deck/ }).click();
    assert.match(
      await page.locator(".deck-provenance").innerText(),
      /Source preconstructed list: Ant-Man Starter Deck/,
    );
    await capture("source-deck");
    await page.keyboard.press("Escape");
    await page.locator("#start-btn").click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    state = await save();
    assert.equal(state.heroId, "ant");
    assert.equal(state.players[0].deckCards.length, 40);
    assert.ok(
      state.players[0].deckCards.every((code) => code.startsWith("12")),
    );
    assert.equal(state.player.form, "alter");
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    await settle();
    for (const width of [1440, 1280, 390, 320])
      await fit("source-board", width);
    await reload();
    checks.push(
      "Catalog selection launches the exact Ant-Man source 40-card Leadership deck with original printing IDs and saved Scott Lang form",
    );
  }

  for (const width of (process.env.ANT_MAN_VIEWPORTS || "1440,390,320")
    .split(",")
    .map(Number)) {
    await open(data.state, width);
    const physical = physicalCards(await save());
    assert.equal(
      physical.length,
      40,
      "Fixture contains all 40 source instances",
    );
    await page.locator(".flip-button").click();
    state = await settle();
    assert.equal(state.prompt.title, "Change form");
    assert.deepEqual(state.prompt.options.map((o) => o.id).sort(), [
      "alter",
      "giant",
    ]);
    await fit("form-choice", width);
    await audit(`Form choice ${width}`);
    await reload();
    await page.keyboard.press("Escape");
    await settle();
    assert.equal((await save()).player.heroForm, "tiny");
    await page.locator(".flip-button").click();
    await settle();
    await choice("giant");
    state = await respond(/Helmet/);
    assert.equal(state.player.hp, 8);
    await respond(/Giant Strength/);
    state = await skipAll();
    assert.equal(state.player.form, "hero");
    assert.equal(state.player.heroForm, "giant");
    assert.equal(state.player.flipped, true);
    const publicState = await textState();
    assert.equal(publicState.form, "hero");
    assert.equal(publicState.heroForm, "giant");
    assert.equal(
      publicState.stats.attack,
      4,
      "Giant Strength boosts Giant ATK",
    );
    assert.equal(publicState.stats.thwart, 1);
    assert.equal(publicState.stats.defense, 3);
    await fit("giant-board", width);
    await audit(`Giant board ${width}`);
    await page
      .getByRole("button", { name: "Play now: Giant Stomp", exact: true })
      .click();
    state = await settle();
    assert.equal(state.prompt.kind, "payment");
    assert.equal(state.prompt.cost, 3);
    await fit("stomp-payment", width);
    await audit(`Stomp payment ${width}`);
    await reload();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    state = await settle();
    assert.ok(state.player.hand.some((p) => p.id === data.pymId));
    await page
      .getByRole("button", { name: "Play now: Giant Stomp", exact: true })
      .click();
    await settle();
    state = await pay();
    assert.equal(state.prompt.title, "Pym Particles");
    await reload();
    state = await respond(/Pym Particles/);
    if (state.prompt?.options.some((o) => o.id === state.villain.id))
      state = await choice(state.villain.id);
    state = await skipAll();
    assert.equal(state.player.hp, 10);
    assert.equal(state.villain.hp, 32);
    assert.equal(
      state.player.discard.filter((p) => p.id === data.pymId).length,
      1,
    );
    assert.equal(
      state.player.discard.filter((p) => p.id === data.stompId).length,
      1,
    );
    await page
      .getByRole("button", { name: "Play now: Resize", exact: true })
      .click();
    await settle();
    state = await respond(/Helmet/);
    state = await skipAll();
    assert.equal(state.player.heroForm, "tiny");
    assert.equal(state.player.flipped, true);
    assert.equal(state.player.hand.length, 2);
    assert.deepEqual(
      physicalCards(state),
      physical,
      "All 40 physical source instances remain conserved",
    );
    await fit("tiny-after-resize", width);
    await audit(`Tiny after Resize ${width}`);
    await reload();
    checks.push(
      `At ${width}px native form choice/cancel/reload, Helmet/Strength, canceled/reloaded Stomp payment, spent Pym response and Resize resolve through actual controls and conserve all 40 cards`,
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
    JSON.stringify({ checks, audits: audits.length, layouts, errors }, null, 2),
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
