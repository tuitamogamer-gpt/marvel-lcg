import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const output = "output/hero-pack";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch,makePiece} from './src/game/engine.ts';
      import {STARTER_DECKS,catalogDeckCodes} from './src/game/catalog.ts';
      export function fixtures() {
        function begin(heroId,heroCode,aspect) {
          const deck=STARTER_DECKS.find(d=>d.heroCode===heroCode&&d.sourceType==='source-preconstructed');
          let s=newGame({heroId,aspect,villainId:'rhino',deckCards:catalogDeckCodes(deck),deckOrigin:'source',deckName:deck.name,seed:92014,pacing:'expert'});
          s=dispatch(s,{type:'MULLIGAN',ids:[]});
          if(s.error)throw Error(s.error);s.player.form='hero';
          return s;
        }
        function take(s,code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];
          }
          const p=makePiece(s,code);p.ownerId=s.activePlayerId;return p;
        }
        function hand(s,codes) {
          const pieces=codes.map(code=>take(s,code));s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;
        }
        const strange=begin('doctor_strange','09001a','protection');
        const index=strange.player.invocationDeck.findIndex(p=>p.code==='09032');
        strange.player.invocationDeck.unshift(strange.player.invocationDeck.splice(index,1)[0]);
        const crimson=strange.player.invocationDeck[0];
        const strangeHand=hand(strange,['09022','09023']);
        const widow=begin('black_widow','08001a','justice');
        const widowHand=hand(widow,['08010','08020']);
        const suit=take(widow,'08009');widow.player.inPlay.push(suit);widow.player.exhausted=true;
        const encounter=structuredClone(widow);
        const bite=encounter.player.hand.splice(encounter.player.hand.findIndex(p=>p.code==='08010'),1)[0];
        encounter.player.inPlay.push(bite);
        const minion=makePiece(encounter,'08026');
        // A saved encounter-reveal checkpoint lets the browser exercise the
        // normal reveal/entry/Preparation windows without depending on a draw.
        encounter.prompt={kind:'choice',title:'Reveal the encounter',text:'Reveal this physical Taskmaster encounter.',options:[{id:'reveal',label:'Reveal Taskmaster',image:minion.code,effects:[{type:'reveal',piece:minion}]}]};
        return {strange,widow,encounter,crimsonId:crimson.id,crimsonCode:crimson.code,strangeResourceId:strangeHand[0].id,biteId:widowHand[0].id,suitId:suit.id,minionId:minion.id};
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
async function open(s) {
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
  if (s)
    await page.addInitScript((state) => {
      if (sessionStorage.getItem("hero-pack-fixture-loaded")) return;
      localStorage.setItem("champions.save.v1", JSON.stringify(state));
      localStorage.setItem("champions.sound", "off");
      localStorage.setItem("champions.pacing", "expert");
      sessionStorage.setItem("hero-pack-fixture-loaded", "yes");
    }, s);
  await page.goto(url);
  if (s) await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function settle() {
  for (let i = 0; i < 80; i++) {
    const s = await save();
    assert.ok(!s.error, s.error);
    if (!s.review) return s;
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  }
  throw Error("Review queue did not settle");
}
async function choice(id) {
  const s = await save();
  assert.equal(s.prompt?.kind, "choice");
  const index = s.prompt.options.findIndex((o) => o.id === id);
  assert.ok(
    index >= 0,
    `${s.prompt.title}: missing ${id}; choices ${s.prompt.options.map((o) => o.id).join(", ")}`,
  );
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
    "Saved pending native decision must survive reload exactly",
  );
}
async function capture(name) {
  await page.locator(".combat-cinematic").waitFor({ state: "hidden" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => i.getClientRects().length && i.loading !== "lazy")
        .map((i) => i.decode()),
    );
  });
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
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
    violations: result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  });
}
async function fit(name, width) {
  await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
  const metrics = await page.evaluate(() => ({
    width: innerWidth,
    document: document.documentElement.scrollWidth,
    dialogs: [...document.querySelectorAll('[role="dialog"]')].map((d) => ({
      width: d.clientWidth,
      content: d.scrollWidth,
    })),
  }));
  layouts.push({ name, ...metrics });
  assert.ok(
    metrics.document <= width + 1,
    `${name}: page width ${metrics.document} / ${width}`,
  );
  assert.ok(
    metrics.dialogs.every((d) => d.content <= d.width + 1),
    `${name}: dialog overflow`,
  );
  await capture(`${name}-${width}`);
}
try {
  await open(data.strange);
  assert.equal(await page.locator(".invocation-area").count(), 1);
  assert.match(
    await page.locator(".invocation-area").innerText(),
    /Crimson Bands of Cyttorak/,
  );
  assert.deepEqual((await textState()).players[0].invocation, {
    top: data.crimsonCode,
    deck: 5,
    discard: 0,
  });
  await page
    .getByRole("button", { name: /Faceup Invocation, 5 cards/ })
    .click();
  const inspect = page.getByRole("dialog", {
    name: "Crimson Bands of Cyttorak",
    exact: true,
  });
  await inspect.waitFor();
  assert.equal(
    await page.getByRole("dialog").count(),
    1,
    "Top Invocation opens the card inspector",
  );
  assert.match(
    await inspect.locator(".product-source").innerText(),
    /Doctor Strange/,
  );
  assert.equal(
    await inspect.locator(".pile-grid").count(),
    0,
    "Hidden Invocation order must not be exposed as a pile",
  );
  await capture("invocation-top-inspector");
  await audit("Top Invocation inspection");
  await page.keyboard.press("Escape");
  assert.match(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("aria-label"),
    ),
    /Faceup Invocation/,
  );
  checks.push(
    "Only the faceup Invocation is inspected, with Hero Pack source and Escape/focus return",
  );
  for (const width of [1440, 390, 320]) await fit("invocation-board", width);
  await audit("Invocation mobile board");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page
    .getByRole("button", { name: /Spell Mastery.*Crimson Bands/ })
    .click();
  let s = await settle();
  assert.equal(s.prompt?.kind, "payment");
  assert.equal(s.prompt.cost, 2);
  assert.equal(
    s.player.exhausted,
    false,
    "Identity exhaust is committed only after payment",
  );
  await capture("invocation-payment");
  await audit("Invocation payment");
  await reload();
  s = await pay();
  assert.equal(s.player.exhausted, true);
  if (s.prompt) {
    assert.equal(s.prompt.title, "Crimson Bands of Cyttorak");
    await choice(s.villain.id);
  }
  s = await settle();
  assert.equal(s.villain.hp, data.strange.villain.hp - 7);
  assert.equal(s.villain.stunned, true);
  assert.ok(s.player.invocationDiscard.some((p) => p.id === data.crimsonId));
  assert.equal(s.player.invocationDeck.length, 4);
  assert.ok(s.player.discard.some((p) => p.id === data.strangeResourceId));
  assert.equal(s.player.invocationDeck[0].id === data.crimsonId, false);
  assert.deepEqual((await textState()).players[0].invocation, {
    top: s.player.invocationDeck[0].code,
    deck: 4,
    discard: 1,
  });
  await capture("invocation-resolved");
  await audit("Invocation resolved board");
  await reload();
  checks.push(
    "Spell Mastery payment survives reload, exhausts the identity, stuns/deals 7 and moves the exact Invocation to its own discard",
  );

  await open(data.widow);
  await page
    .getByRole("button", { name: "Play now: Widow's Bite", exact: true })
    .click();
  s = await settle();
  assert.equal(s.prompt?.cost, 1);
  await pay();
  s = await save();
  assert.ok(s.player.inPlay.some((p) => p.id === data.biteId));
  assert.ok(s.player.discard.some((p) => p.code === "08020"));
  await capture("preparation-played");
  checks.push(
    "Widow's Bite uses actual physical source-deck printing and resource payment before entering play",
  );

  await open(data.encounter);
  await choice("reveal");
  s = await save();
  assert.ok(
    s.prompt.options.some((o) => o.id === data.biteId),
    `${s.prompt.title}: missing Widow's Bite`,
  );
  await capture("preparation-trigger-choice");
  await audit("Preparation trigger choice");
  const biteIndex = s.prompt.options.findIndex(
    (option) => option.id === data.biteId,
  );
  const biteDecision = page.locator(".decision-option").nth(biteIndex);
  await biteDecision.hover();
  const preview = page.getByRole("tooltip", {
    name: "Enlarged card: Widow's Bite",
    exact: true,
  });
  await preview.waitFor({ state: "visible" });
  const previewRect = await preview.boundingBox();
  await page.mouse.move(
    previewRect.x + previewRect.width / 2,
    previewRect.y + previewRect.height / 2,
  );
  await page.waitForTimeout(220);
  assert.ok(
    await preview.isVisible(),
    "Card preview remains readable when the pointer moves over it",
  );
  await page.mouse.move(5, 5);
  await preview.waitFor({ state: "hidden" });
  await biteDecision.hover();
  await preview.waitFor({ state: "visible" });
  assert.ok(
    await biteDecision.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return button.contains(
        document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        ),
      );
    }),
    "Hover artwork must not intercept the actual decision button",
  );
  await capture("preparation-hover-through");
  await preview.locator("img").dispatchEvent("error");
  await preview.locator(".preview-fallback").waitFor();
  assert.ok(
    await biteDecision.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      return button.contains(
        document.elementFromPoint(
          rect.x + rect.width / 2,
          rect.y + rect.height / 2,
        ),
      );
    }),
    "Failed-image text must not intercept the actual decision button",
  );
  await choice(data.biteId);
  s = await save();
  assert.equal(s.prompt?.title, "After your Preparation resolves");
  assert.ok(s.player.discard.some((p) => p.id === data.biteId));
  const taskmaster = s.minions.find((p) => p.id === data.minionId);
  assert.equal(taskmaster.damage, 2);
  assert.equal(taskmaster.stunned, true);
  assert.equal(s.player.exhausted, true);
  assert.ok(s.prompt.options.some((o) => o.id === "widowmaker"));
  assert.ok(s.prompt.options.some((o) => o.id === data.suitId));
  await capture("preparation-response-order");
  await audit("Preparation response order");
  await reload();
  await choice(data.suitId);
  assert.equal((await save()).player.exhausted, false);
  await choice("widowmaker");
  s = await save();
  await choice(s.villain.id);
  s = await save();
  if (s.prompt?.title === "After your Preparation resolves")
    await choice("continue");
  s = await settle();
  assert.equal(s.villain.hp, data.encounter.villain.hp - 1);
  assert.equal(
    s.player.inPlay.find((p) => p.id === data.suitId).exhausted,
    true,
  );
  assert.equal(s.player.exhausted, false);
  assert.ok(!s.player.inPlay.some((p) => p.id === data.biteId));
  await capture("preparation-resolved");
  for (const width of [390, 320]) await fit("preparation-board", width);
  checks.push(
    "The discarded Preparation finishes its damage and stun before saved explicit Widowmaker/Synth-Suit ordering, then each response executes once",
  );

  for (const name of ["Black Widow", "Doctor Strange"]) {
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
    assert.match(
      await detail.locator(":scope > .product-source").innerText(),
      /Hero Pack/,
    );
    assert.match(
      await detail.locator(":scope > .product-source").innerText(),
      /sold separately/i,
    );
    assert.match(await detail.innerText(), /Starter Deck/);
    await capture(name.toLowerCase().replaceAll(" ", "-") + "-source");
    await audit(`${name} product provenance`);
    for (const width of [390, 320])
      await fit(name.toLowerCase().replaceAll(" ", "-") + "-catalog", width);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await detail
      .getByRole("button", { name: `Choose ${name} for mission`, exact: true })
      .click();
    assert.match(
      await page.locator(".hero-product-source").innerText(),
      /Hero Pack.*Sold separately/,
    );
    await page
      .getByRole("button", { name: "View 40-card deck", exact: false })
      .click();
    assert.match(
      await page.locator(".deck-provenance").innerText(),
      new RegExp(`Source preconstructed list: ${name} Starter Deck`),
    );
    await page.keyboard.press("Escape");
    await page.locator("#start-btn").click();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .waitFor();
    s = await save();
    assert.equal(s.phase, "mulligan");
    assert.equal(
      s.heroId,
      name === "Black Widow" ? "black_widow" : "doctor_strange",
    );
    assert.equal(s.player.hand.length + s.player.deck.length, 40);
    assert.equal(s.players[0].deckCards.length, 40);
    assert.ok(
      s.players[0].deckCards.every((c) =>
        c.startsWith(name === "Black Widow" ? "08" : "09"),
      ),
    );
    if (name === "Doctor Strange") {
      assert.equal(s.player.invocationDeck.length, 5);
      assert.equal((await textState()).players[0].invocation.top, undefined);
      assert.equal(
        await page.locator(".invocation-area").count(),
        0,
        "Invocation top is still hidden until mulligans finish",
      );
    }
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    await settle();
    if (name === "Doctor Strange")
      assert.equal(await page.locator(".invocation-area").count(), 1);
    await capture(name.toLowerCase().replaceAll(" ", "-") + "-source-mission");
    await reload();
  }
  checks.push(
    "Both Hero Pack source decks can be selected and launched from the catalog with exact 40-card printing lists, separate Invocation setup and visible product provenance",
  );
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((a) => a.violations.length === 0),
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
