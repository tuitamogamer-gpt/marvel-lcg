import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const output = "output/rise-heroes";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch,makePiece} from './src/game/engine.ts';
      import {heroStarterCodes} from './src/game/hero-runtime.ts';
      export function fixtures() {
        function begin(heroId,aspect) {
          let s=newGame({heroId,aspect,villainId:'rhino',heroes:[{heroId,aspect,deckCards:heroStarterCodes(heroId)}],seed:401,pacing:'expert'});
          s=dispatch(s,{type:'MULLIGAN',ids:[]});if(s.error)throw Error(s.error);
          s.player.form='hero';s.villain.hp=s.villain.maxHp=40;
          return s;
        }
        function take(s,code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];
          }
          throw Error('Missing physical starter card '+code);
        }
        const hawkeye=begin('hawkeye','leadership');
        const bow=take(hawkeye,'04002'),quiver=take(hawkeye,'04003'),arrow=take(hawkeye,'04005');
        const resource=take(hawkeye,'04023');
        hawkeye.player.deck.push(...hawkeye.player.hand);hawkeye.player.hand=[resource];
        hawkeye.player.inPlay.push(bow,quiver);
        hawkeye.player.deck.unshift(arrow);
        const spiderWoman=begin('spider_woman','aggression');
        const glide=take(spiderWoman,'04039'),swResource=take(spiderWoman,'04050');
        spiderWoman.player.deck.push(...spiderWoman.player.hand);spiderWoman.player.hand=[glide,swResource];
        spiderWoman.player.exhausted=true;
        const jessica=structuredClone(spiderWoman);jessica.player.form='alter';jessica.player.exhausted=false;
        return {hawkeye,spiderWoman,jessica,bowId:bow.id,quiverId:quiver.id,arrowId:arrow.id,resourceId:resource.id,glideId:glide.id};
      }`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { fixtures } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const data = fixtures();
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
async function open(state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  if (state)
    await page.addInitScript((state) => {
      if (sessionStorage.getItem("rise-heroes-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(state));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("rise-heroes-fixture-loaded", "yes");
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
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await save(),
    before,
    "Physical cards and pending decisions survive reload",
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
    fullPage:
      !(await page.getByRole("dialog").count()) &&
      !(await page.locator(".account-editor").count()),
  });
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
    violations: result.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        message: node.failureSummary,
      })),
    })),
  });
}
async function fit(name, width) {
  await page.setViewportSize({ width, height: width > 1000 ? 900 : 844 });
  if (await page.locator(".account-editor").count())
    await page.locator(".account-editor-settings").scrollIntoViewIfNeeded();
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map(
      (dialog) => ({ width: dialog.clientWidth, content: dialog.scrollWidth }),
    ),
  }));
  layouts.push({ name, ...metrics });
  assert.ok(metrics.document <= width + 1, `${name}: page overflow`);
  assert.ok(
    metrics.dialogs.every((dialog) => dialog.content <= dialog.width + 1),
    `${name}: dialog overflow`,
  );
  await capture(`${name}-${width}`);
}
try {
  await open(data.hawkeye);
  await page.getByRole("button", { name: /Quiver.*search.*5/ }).click();
  let state = await settle();
  assert.equal(state.prompt.kind, "choice");
  await choice(data.arrowId);
  const publicArrows = page.locator('[aria-label="Hawkeye\'s Quiver"]');
  assert.match(await publicArrows.innerText(), /Sonic Arrow/);
  await publicArrows
    .getByRole("button", { name: "Inspect Sonic Arrow in Quiver", exact: true })
    .click();
  await page
    .getByRole("dialog", { name: "Sonic Arrow", exact: true })
    .waitFor();
  await capture("quiver-inspector");
  await page.keyboard.press("Escape");
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    "Inspect Sonic Arrow in Quiver",
  );
  await publicArrows
    .getByRole("button", { name: "Play from Quiver: Sonic Arrow", exact: true })
    .click();
  state = await settle();
  assert.equal(state.prompt.kind, "payment");
  assert.equal(state.prompt.card.id, data.arrowId);
  assert.equal(state.prompt.cost, 2);
  await capture("quiver-payment");
  await audit("Quiver payment");
  await reload();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  state = await settle();
  assert.ok(
    state.player.inPlay
      .find((piece) => piece.id === data.quiverId)
      .storedCards.some((piece) => piece.id === data.arrowId),
  );
  await publicArrows
    .getByRole("button", { name: "Play from Quiver: Sonic Arrow", exact: true })
    .click();
  await settle();
  await pay();
  if ((await save()).prompt?.kind === "choice") await choice("villain");
  state = await settle();
  assert.equal(state.villain.hp, 37);
  assert.equal(state.villain.confused, true);
  assert.ok(state.player.discard.some((piece) => piece.id === data.arrowId));
  assert.equal(
    state.player.inPlay.find((piece) => piece.id === data.quiverId).storedCards
      .length,
    0,
  );
  assert.equal(
    state.player.inPlay.find((piece) => piece.id === data.bowId).exhausted,
    true,
  );
  await page.getByRole("button", { name: /Quick Draw/ }).click();
  state = await settle();
  assert.equal(state.player.exhausted, true);
  assert.equal(
    state.player.inPlay.find((piece) => piece.id === data.bowId).exhausted,
    false,
  );
  checks.push(
    "Physical Quiver Arrow remains attached through canceled/reloaded payment, resolves damage/confuse and enters discard; Quick Draw readies Bow",
  );

  await open(data.spiderWoman);
  await page
    .getByRole("button", {
      name: "Play now: Self-Propelled Glide",
      exact: true,
    })
    .click();
  await settle();
  await pay();
  state = await settle();
  assert.equal(state.player.exhausted, false);
  assert.ok(state.flags.swAerialRound === state.round);
  await capture("spider-woman-glide");
  await reload();
  await open(data.jessica);
  await page
    .getByRole("button", { name: /Jessica Drew.*look at the top/ })
    .click();
  state = await settle();
  assert.equal(state.prompt.title, "Jessica Drew");
  const deckChoice = state.prompt.options[0].id;
  await reload();
  await choice(deckChoice);
  state = await settle();
  assert.equal(state.prompt.options.length, 1);
  assert.ok(state.prompt.options[0].image);
  await choice("done");
  checks.push(
    "Spider-Woman's Glide readies/grants Aerial and Jessica Drew's saved deck choice reveals one top card",
  );

  for (const [name, id] of [
    ["Hawkeye", "hawkeye"],
    ["Spider-Woman", "spider_woman"],
  ]) {
    await open();
    await page.locator(".content-entry").click();
    const catalog = page.getByRole("dialog", {
      name: "All heroes & starter decks",
      exact: true,
    });
    await catalog
      .getByRole("textbox", { name: "Search heroes and products" })
      .fill(name);
    await catalog
      .locator(".catalog-hero-row")
      .filter({ has: page.locator("b", { hasText: name }) })
      .first()
      .click();
    const detail = catalog.locator(".catalog-hero-detail");
    assert.match(await detail.innerText(), /The Rise of Red Skull/);
    await detail
      .getByRole("button", { name: `Choose ${name} for mission`, exact: true })
      .click();
    if (id === "spider_woman")
      assert.equal(
        await page
          .getByRole("combobox", { name: "Spider-Woman second aspect" })
          .inputValue(),
        "justice",
      );
    await page.getByRole("button", { name: /View 40-card deck/ }).click();
    assert.match(
      await page.locator(".deck-provenance").innerText(),
      new RegExp(`Source preconstructed list: ${name} Starter Deck`),
    );
    await capture(`${id}-source-list`);
    await page.keyboard.press("Escape");
    await page.locator("#start-btn").click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    state = await save();
    assert.equal(state.heroId, id);
    assert.equal(state.players[0].deckCards.length, 40);
    assert.ok(
      state.players[0].deckCards.every((code) => code.startsWith("04")),
    );
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    await settle();
    for (const width of [1440, 1280, 390, 320]) await fit(`${id}-board`, width);
    await audit(`${name} board`);
    await reload();
  }
  await open();
  await page
    .getByRole("button", { name: "Spider-Woman Jessica Drew", exact: false })
    .click();
  await page
    .getByRole("combobox", { name: "Spider-Woman second aspect" })
    .selectOption("protection");
  const selected = await textState();
  assert.equal(selected.team[0].deckCards.length, 40);
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  assert.equal((await save()).heroId, "spider_woman");
  checks.push(
    "Both exact source precons launch with original printing IDs; alternate Spider-Woman two-aspect 40-card deck launches; responsive boards fit 320–1440px",
  );
  await open();
  const apiHeaders = {
    origin: new URL(url).origin,
    "x-champions-client": "1",
  };
  const registered = await context.request.post(`${url}/api/account`, {
    headers: apiHeaders,
    data: {
      action: "register",
      username: `rise_${Date.now()}`,
      displayName: "Rise Heroes QA",
      password: "four friendly testing champions",
    },
  });
  assert.equal(registered.status(), 200);
  await page.reload();
  await page
    .getByRole("button", { name: "Open player profile", exact: true })
    .click();
  await page.getByRole("button", { name: "BUILD A DECK", exact: true }).click();
  await page
    .getByLabel("Deck name", { exact: true })
    .fill("Jessica's two aspects");
  await page.getByLabel("Hero", { exact: true }).selectOption("spider_woman");
  assert.equal(
    await page.getByLabel("Aspect", { exact: true }).inputValue(),
    "justice",
  );
  assert.equal(
    await page.getByLabel("Second aspect", { exact: true }).inputValue(),
    "aggression",
  );
  const signatures = page.locator(".account-deck-columns section").filter({
    has: page.getByRole("heading", { name: "HERO", exact: true }),
  });
  assert.match(await signatures.innerText(), /Pheromones/);
  assert.match(await signatures.innerText(), /Venom Blast/);
  assert.equal(
    await signatures.getByRole("combobox").count(),
    0,
    "Colored signatures are fixed",
  );
  await page.getByRole("button", { name: "SAVE DECK", exact: true }).click();
  await page
    .getByRole("heading", { name: "Jessica's two aspects", exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page.getByLabel("Aspect", { exact: true }).selectOption("leadership");
  await page
    .getByLabel("Second aspect", { exact: true })
    .selectOption("protection");
  assert.match(await signatures.innerText(), /Pheromones/);
  const protection = page.locator(".account-deck-columns section").filter({
    has: page.getByRole("heading", { name: "PROTECTION", exact: true }),
  });
  assert.match(await protection.innerText(), /Counter-Punch/);
  await capture("spider-woman-account-editor");
  await audit("Spider-Woman account deck editor");
  for (const width of [390, 320])
    await fit("spider-woman-account-editor", width);
  await page.getByRole("button", { name: "SAVE DECK", exact: true }).click();
  await page
    .getByRole("heading", { name: "Jessica's two aspects", exact: true })
    .waitFor();
  await page.reload();
  await page
    .getByRole("button", { name: "Open player profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  assert.equal(
    await page.getByLabel("Aspect", { exact: true }).inputValue(),
    "leadership",
  );
  assert.equal(
    await page.getByLabel("Second aspect", { exact: true }).inputValue(),
    "protection",
  );
  await page
    .getByRole("button", { name: "Back to decks", exact: true })
    .click();
  await page.getByRole("button", { name: "USE DECK", exact: true }).click();
  assert.equal(
    await page
      .getByRole("combobox", { name: "Spider-Woman second aspect" })
      .inputValue(),
    "protection",
  );
  assert.deepEqual((await textState()).team[0].deckAspects, [
    "leadership",
    "protection",
  ]);
  await page.locator("#start-btn").click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  let savedMission;
  for (let i = 0; i < 60; i++) {
    const session = await (
      await context.request.get(`${url}/api/account`)
    ).json();
    savedMission = session.library.missions[0];
    if (savedMission?.state) break;
    await page.waitForTimeout(100);
  }
  assert.deepEqual(savedMission.state.players[0].deckAspects, [
    "leadership",
    "protection",
  ]);
  assert.equal(savedMission.state.players[0].deckCards.length, 40);
  checks.push(
    "Spider-Woman account editor locks colored signatures, edits both aspects, saves/reloads the exact pair and launches its physical 40-card deck",
  );
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((result) => result.violations.length === 0),
    JSON.stringify(audits),
  );
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, audits, layouts, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ checks, audits: audits.length, layouts, errors }, null, 2),
  );
} finally {
  await browser.close();
}
