import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/kang/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.KANG_VIEWPORTS || "1280,768,390,320")
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
      "import {syncSeat,activateSeat} from './src/game/team.ts';",
      "import {kangStoredPieces} from './src/game/kang.ts';",
      "export const definition=p=>card(p);",
      "export const stored=s=>kangStoredPieces(s);",
      "export function fixture(kind){",
      " const players=kind==='areas'?2:1;",
      " const heroes=[{heroId:'spider_man',aspect:'justice'},{heroId:'captain_marvel',aspect:'aggression'}].slice(0,players);",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'kang',difficulty:'standard',modules:['temporal'],seed:11001,pacing:'expert',heroes});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|threat)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;}}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review||!s.kang)throw Error('Original Kang setup incomplete');",
      " function run(effects){s.prompt={kind:'choice',title:'Original Kang effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects:[]}]};s.queue=effects;command({type:'CHOOSE',id:'go'});settle();}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Kang effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " const result={};",
      " function stageThree(){s.villain.tough=false;run([{type:'damage',target:s.villain.id,amount:s.villain.hp,source:'hero',attack:true}]);run([{type:'kang:stage-two',actorId:s.firstPlayerId}]);activateSeat(s,s.turnPlayerId);}",
      " if(kind==='choice'){s.encounter.discard.push(...s.encounter.deck.filter(p=>definition(p).boost));s.encounter.deck=s.encounter.deck.filter(p=>!definition(p).boost);result.heroHp=s.player.hp;native([{type:'enemyAttack',id:s.villain.id}]);}",
      " else if(kind==='areas'){stageThree();result.other=s.kang.areas.find(a=>a.id!==s.activePlayerId).id;}",
      " else if(kind==='wrath'){stageThree();run([{type:'threat',target:'main',amount:9,actorId:'p1'}]);run([{type:'kang:areas-leave',actorId:s.firstPlayerId}]);result.hp=s.villain.hp;}",
      " else if(kind==='obligation'){const w=take('11018');s.player.inPlay.push(w);s.player.form='alter';const i=s.player.deck.findIndex(p=>definition(p).resource_physical&&!definition(p).resource_wild);const r=s.player.deck.splice(i,1)[0];s.player.hand.push(r);result.id=w.id;result.card=r.id;}",
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
const { fixture, definition, stored } = await import(
  pathToFileURL(fixturePath).href
);
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
const seatPlayer = (s, seat) =>
  seat.id === s.activePlayerId ? s.player : seat.player;
function pieces(s) {
  return [
    s.villain,
    ...stored(s),
    ...s.players.flatMap((seat) => {
      const p = seatPlayer(s, seat);
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
    ...(s.environments || []),
    ...s.removed,
    ...s.resolving,
    ...(s.victoryDisplay || []),
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
  ];
}
function originals(s) {
  const all = pieces(s);
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  assert.equal(
    all.filter((p) => ["kang", "exp_kang"].includes(definition(p).set_code))
      .length,
    43,
    "The 43 cards of the Kang set (Expert swaps the six villains)",
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
    if (sessionStorage.getItem("kang-check")) return;
    sessionStorage.setItem("kang-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no|done)$/.test(o.id),
      ) ||
      (s.prompt.options.length === 1 || s.prompt.title === "Forced responses"
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    // A defense declaration is a decision panel, not a dialog.
    const dialog = page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: o.label, exact: true });
    if (await dialog.count()) await dialog.click();
    else
      await page
        .getByRole("button", {
          name: new RegExp(
            "^" + o.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          ),
        })
        .first()
        .click();
  }
  throw Error("Native Kang continuation did not finish");
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
    "Kang's stages, set-aside cards and game areas survive reload",
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
async function artwork(codes) {
  for (const code of codes) {
    const img = page.locator('img[src*="' + code + '"]').first();
    await img.waitFor();
    await img.evaluate(async (image) => {
      await image.decode();
      if (!image.naturalWidth) throw Error("Missing original artwork");
    });
  }
}
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "kang");
  assert.deepEqual(s.modules, ["temporal"]);
  const version = difficulty === "expert" ? 1 : 0;
  assert.equal(s.villain.code, ["11001", "11034"][version]);
  assert.deepEqual(s.scheme, { code: "11007b", threat: 0, index: 0 });
  assert.equal(s.kang.stage, 1);
  assert.equal(s.kang.setAside.length, 5);
  assert.equal(s.kang.dominions.length, 4);
  assert.equal(s.encounter.dealt.length, 1, "1B deals an encounter card");
  await page.getByText("Defeat Kang (I)", { exact: true }).waitFor();
  await page.getByText("Stage 1 · Kang's Arrival", { exact: true }).waitFor();
  await artwork([s.villain.code, "11007b"]);
}
try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "Kang", exact: true })
        .click();
      const modular = page.getByRole("combobox", { name: /Modular encounter/ });
      assert.equal(await modular.inputValue(), "temporal");
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("11001");
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
  }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "conqueror-choice", width };
    let f = fixture("choice");
    let owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: /^Place 1 threat on the main scheme/,
      })
      .first()
      .click();
    let s = await settle();
    assert.equal(s.scheme.threat, 1, "Kang (I) places 1 threat");
    assert.equal(s.player.hp, f.heroHp - 2, "Kang's undefended attack");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("conqueror-choice", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "separate-game-areas", width };
    f = fixture("areas");
    owned = originals(f.state);
    await open(width, f.state);
    s = await settle();
    assert.equal(s.kang.stage, 3);
    assert.equal(s.kang.areas.length, 2);
    // The zone label's detail is hidden on phones; it stays in the page.
    await page
      .getByText("YOUR GAME AREA · 2 SEPARATE AREAS", { exact: true })
      .waitFor({ state: "attached" });
    await page
      .getByText("Stage 3 · 2 separate game areas", { exact: true })
      .waitFor();
    await page
      .getByRole("group", { name: /^Captain Marvel's game area: / })
      .waitFor();
    await artwork([s.villain.code, s.scheme.code]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("separate-game-areas", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "kangs-wrath", width };
    f = fixture("wrath");
    owned = originals(f.state);
    await open(width, f.state);
    s = await settle();
    assert.equal(s.kang.stage, 4);
    assert.equal(s.villain.code, "11006");
    assert.equal(
      s.sideSchemes.filter((p) => p.code === "11023").length,
      1,
      "One Kang's Dominion revealed",
    );
    await page.getByText("Stage 4 · Kang's Wrath", { exact: true }).waitFor();
    await page
      .getByText("Kang's Dominion: Kang cannot take damage.", { exact: true })
      .waitFor();
    await page.getByText("Defeat Kang (III)", { exact: true }).waitFor();
    await artwork(["11006", "11013b", "11023"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("kangs-wrath", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "obligation-action", width };
    f = fixture("obligation");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: /Discard a physical resource · discard Weakened/,
      })
      .first()
      .click();
    s = await saved();
    assert.equal(s.prompt?.title, "Weakened");
    const option = s.prompt.options.find((o) => o.id === f.card);
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: option.label, exact: true })
      .first()
      .click();
    s = await settle();
    assert.ok(
      !s.player.inPlay.some((p) => p.id === f.id),
      "Weakened discarded",
    );
    assert.ok(
      s.player.discard.some((p) => p.id === f.card),
      "The physical resource is discarded",
    );
    await audit("obligation-action", width);
    checks.push({ ...current });
  }
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
