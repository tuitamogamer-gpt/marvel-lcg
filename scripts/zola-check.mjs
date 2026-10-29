import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/zola/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const widths = (process.env.ZOLA_VIEWPORTS || "1280,768,390,320")
  .split(",")
  .map(Number);
assert.ok(
  widths.length && widths.every((w) => Number.isInteger(w) && w >= 320),
);
await mkdir(output, { recursive: true });
for (const file of ["report.json", "failure.txt", "failure.png"])
  await rm(resolve(output, file), { force: true });
const fixturePath = resolve(output, "native-fixtures.mjs");
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: [
      "import {newGame,dispatch} from './src/game/engine.ts';",
      "import {card} from './src/game/cards.ts';",
      "import {heroStarterCodes} from './src/game/hero-runtime.ts';",
      "import {syncSeat} from './src/game/team.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',deckCards:heroStarterCodes('spider_man'),villainId:'zola',difficulty:'standard',seed:4112,pacing:'expert'});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.zola)throw Error('Original Zola setup incomplete');",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Zola encounter',text:'Resolve the original encounter effect.',options:[{id:'go',label:'Resolve original encounter',effects}]};}",
      " const result={};",
      " if(kind==='test-threshold'){s.zola.currentMain.counters=2;const minion=take('04115');s.encounter.deck.unshift(minion);result.minionId=minion.id;native([{type:'villainStepOne',actorId:s.firstPlayerId}]);}",
      " else if(kind==='mutate-tech'){const minion=take('04115'),tech=take('04117');s.encounter.deck.unshift(tech);s.resolving.push(minion);result.minionId=minion.id;result.techId=tech.id;native([{type:'reveal',piece:minion,skip:true,actorId:s.firstPlayerId}]);}",
      " else if(kind==='prison-rescue'){const prison=s.sideSchemes.find(p=>p.code==='04122');if(prison?.captured?.length!==1)throw Error('Original Black Cat was not captured');result.prisonId=prison.id;result.allyId=prison.captured[0].id;prison.counters=1;s.player.form='hero';s.player.exhausted=false;}",
      " else throw Error('Unknown fixture '+kind);",
      " syncSeat(s);return{state:s,...result};",
      "}",
    ].join("\n"),
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: fixturePath,
  logLevel: "silent",
});
const { fixture, definition } = await import(pathToFileURL(fixturePath).href);
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
let context, page, current;
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
function pieces(s) {
  const nested = (p) => [
    p,
    ...(p.captured || []).flatMap(nested),
    ...(p.storedCards || []).flatMap(nested),
  ];
  return [
    s.villain,
    s.zola.currentMain,
    ...s.zola.mainDeck,
    ...s.zola.villainDeck,
    ...s.players.flatMap((seat) => {
      const p = seat.id === s.activePlayerId ? s.player : seat.player;
      return [
        ...p.hand,
        ...p.deck,
        ...p.discard,
        ...p.inPlay,
        ...(p.setAside || []),
      ];
    }),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...s.environments,
    ...s.removed,
    ...s.resolving,
    ...s.victoryDisplay,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
  ].flatMap(nested);
}
function originals(s) {
  const all = pieces(s);
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  return all.map((p) => p.id + ":" + p.code).sort();
}
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("zola-check")) return;
    sessionStorage.setItem("zola-check", "1");
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
  }, state);
  await page.goto(url);
  if (state) await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function settle(stop = () => false) {
  for (let n = 0; n < 100; n++) {
    const s = await saved();
    assert.ok(!s.error, s.error);
    if (stop(s)) return s;
    if (s.review) {
      await page.locator("[role=dialog] [data-proceed]").last().click();
      continue;
    }
    if (!s.prompt) return s;
    assert.equal(
      s.prompt.kind,
      "choice",
      "Expected native choice: " + JSON.stringify(s.prompt),
    );
    const o =
      s.prompt.options.find((o) =>
        /^(pass|skip|continue|none|resolve|take|allow|no)$/.test(o.id),
      ) ||
      (s.prompt.options.length === 1 || s.prompt.title === "Forced responses"
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    await page.getByRole("button", { name: o.label, exact: true }).click();
  }
  throw Error("Native Zola continuation did not finish");
}
async function begin() {
  await settle();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  const s = await settle();
  assert.equal(s.phase, "player");
  return s;
}
async function resumeExact() {
  const before = await saved();
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(
    await saved(),
    before,
    "Native counters, queues and physical cards survive reload",
  );
}
async function audit(name, width) {
  await page.mouse.move(0, 0);
  await page.locator(".card-hover-preview").waitFor({ state: "hidden" });
  await page.evaluate(axe);
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document, {
        runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
      })
    ).violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  );
  audits.push({ name, width, violations });
  assert.deepEqual(violations, [], name);
  const layout = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  layouts.push({ name, ...layout });
  assert.ok(layout.content <= layout.width + 1, name + ": horizontal overflow");
  await page.screenshot({
    path: resolve(output, name + "-" + width + ".png"),
    fullPage: true,
  });
}
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "zola");
  assert.deepEqual(s.modules, ["under_attack"]);
  assert.equal(s.villain.code, difficulty === "expert" ? "04110" : "04109");
  assert.equal(s.scheme.code, "04112b");
  assert.equal(s.zola.currentMain.counters, 0);
  const prison = s.sideSchemes.find((p) => p.code === "04122");
  assert.equal(prison.captured.length, 1);
  assert.equal(prison.captured[0].code, "01002");
  assert.equal(prison.counters, 3);
  assert.equal(
    pieces(s).filter((p) => definition(p).set_code === "zola").length,
    30,
    "Two villain stages select thirty original physical Zola cards",
  );
  assert.equal(
    s.player.hand.length +
      s.player.deck.length +
      s.player.discard.length +
      s.player.inPlay.length +
      prison.captured.length,
    40,
    "Captured Black Cat remains part of the original forty-card player source",
  );
  assert.ok(
    s.minions.some(
      (p) => p.code === "04114" && p.tough && p.engagedWith === "p1",
    ),
  );
  assert.equal(
    s.sideSchemes.some((p) => p.code === "04123"),
    difficulty === "expert",
  );
  await page.getByLabel("Test counters: 0", { exact: true }).waitFor();
  await page
    .getByLabel("Hydra Prison: 1 captive ally, face down", { exact: true })
    .waitFor();
  for (const code of [s.villain.code, s.scheme.code, "04122", "04114"]) {
    const img = page.locator('img[src*="' + code + '"]').first();
    await img.waitFor();
    await img.evaluate(async (image) => {
      await image.decode();
      if (!image.naturalWidth) throw Error("Missing original artwork");
    });
  }
}
try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "Zola", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "under_attack",
      );
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("4112");
      await page.locator("#start-btn").click();
      const s = await begin();
      await setupEvidence(s, difficulty);
      const owned = originals(s);
      await resumeExact();
      assert.deepEqual(originals(await saved()), owned);
      await audit("standalone-" + difficulty, width);
      checks.push({
        ...current,
        physicalCards: owned.length,
        exactReload: true,
      });
    }
    for (const kind of ["test-threshold", "mutate-tech", "prison-rescue"]) {
      current = { kind, width };
      const f = fixture(kind),
        owned = originals(f.state);
      await open(width, f.state);
      await resumeExact();
      if (kind === "test-threshold")
        await page.getByLabel("Test counters: 2", { exact: true }).waitFor();
      if (kind === "prison-rescue") {
        await page.locator(".thwart-action").click();
        const s = await settle((s) =>
          s.prompt?.options.some((o) => o.id === f.prisonId),
        );
        const o = s.prompt?.options.find((o) => o.id === f.prisonId);
        if (o)
          await page
            .getByRole("button", { name: o.label, exact: true })
            .click();
        else
          assert.ok(
            s.removed.some((p) => p.id === f.prisonId),
            "The sole legal thwart target resolves automatically",
          );
      } else
        await page
          .getByRole("button", {
            name: "Resolve original encounter",
            exact: true,
          })
          .click();
      const s = await settle();
      assert.equal(
        s.phase,
        "player",
        "The focused native effect finishes without ending the mission",
      );
      if (kind === "test-threshold") {
        assert.equal(s.zola.currentMain.counters, 0);
        assert.ok(
          s.minions.some(
            (p) => p.id === f.minionId && p.engagedWith === s.firstPlayerId,
          ),
        );
        assert.ok(
          !s.attachments.some((p) => p.attachedTo === f.minionId),
          "Put into play does not trigger Mutate's When Revealed",
        );
        await page.getByLabel("Test counters: 0", { exact: true }).waitFor();
      } else if (kind === "mutate-tech") {
        assert.ok(
          s.attachments.some(
            (p) => p.id === f.techId && p.attachedTo === f.minionId,
          ),
        );
        const tile = page.locator('[data-piece-id="' + f.minionId + '"]');
        await tile.scrollIntoViewIfNeeded();
        await tile
          .getByLabel("7 of 7 hit points remaining", { exact: true })
          .waitFor();
        await tile.getByText("GUARD", { exact: true }).waitFor();
      } else {
        assert.ok(s.removed.some((p) => p.id === f.prisonId));
        assert.ok(
          s.player.hand.some((p) => p.id === f.allyId && p.code === "01002"),
        );
        assert.ok(!s.sideSchemes.some((p) => p.id === f.prisonId));
      }
      assert.deepEqual(originals(s), owned);
      await resumeExact();
      await audit(kind, width);
      checks.push({
        ...current,
        physicalCards: owned.length,
        exactReload: true,
      });
    }
  }
  current = { kind: "campaign-setup" };
  await open(1280);
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page
    .getByLabel("Mission preset", { exact: true })
    .selectOption("hydra");
  for (const [i, id] of [
    "crossbones",
    "absorbing_man",
    "taskmaster",
    "zola",
    "red_skull",
  ].entries())
    assert.equal(
      await page
        .getByLabel("Mission " + (i + 1) + " scenario", { exact: true })
        .inputValue(),
      id,
    );
  await page
    .getByRole("button", { name: "Remove mission 5", exact: true })
    .click();
  for (let i = 0; i < 3; i++)
    await page
      .getByRole("button", { name: "Remove mission 1", exact: true })
      .click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Zola rescue operation");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  const campaign = await begin();
  await setupEvidence(campaign, "standard");
  assert.ok(campaign.campaign);
  await page.reload();
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(await saved(), campaign);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await audit("campaign-table", width);
  }
  checks.push({ ...current, exactReload: true });
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      { checks, audits, layouts, errors, widths, baseURL: url },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      flows: checks.length,
      audits: audits.length,
      layouts: layouts.length,
      errors: errors.length,
    }),
  );
} catch (error) {
  await writeFile(
    resolve(output, "failure.txt"),
    String(error) +
      "\n" +
      JSON.stringify(current) +
      "\n" +
      (page ? await page.locator("body").innerText() : ""),
  );
  if (page)
    await page
      .screenshot({ path: resolve(output, "failure.png"), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  if (context) await context.close();
  await browser.close();
}
