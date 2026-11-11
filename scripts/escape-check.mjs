import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/escape/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.ESCAPE_VIEWPORTS || "1280,768,390,320")
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
      "import {syncSeat} from './src/game/team.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'escape_the_museum',difficulty:'standard',seed:16080,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'},{heroId:'captain_marvel',aspect:'aggression'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.escape)throw Error('Original Escape the Museum setup incomplete');",
      " function run(effects){s.prompt={kind:'choice',title:'fixture',text:'',options:[{id:'go',label:'go',effects}]};command({type:'CHOOSE',id:'go'});}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Escape the Museum effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " const result={};",
      " s.player.form='hero';s.player.exhausted=false;",
      " if(kind==='labyrinth'){result.threat=s.scheme.threat;result.dealt=s.encounter.dealt.length;}",
      " else if(kind==='wound'){s.scheme.threat=10;result.threat=10;native([{type:'damage',target:s.villain.id,amount:s.villain.hp}]);}",
      " else if(kind==='great-escape'){run([{type:'thwart',target:'main',amount:s.scheme.threat}]);run([{type:'thwart',target:'main',amount:s.scheme.threat}]);s.player.form='hero';s.player.exhausted=false;result.threat=s.scheme.threat;}",
      " else if(kind==='escape-win'){run([{type:'thwart',target:'main',amount:s.scheme.threat}]);run([{type:'thwart',target:'main',amount:s.scheme.threat}]);native([{type:'thwart',target:'main',amount:s.scheme.threat}]);}",
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
const seatPlayer = (s, seat) =>
  seat.id === s.activePlayerId ? s.player : seat.player;
function pieces(s) {
  return [
    s.villain,
    s.escape.currentMain,
    ...s.escape.mainDeck,
    ...s.escape.setAside,
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
    if (sessionStorage.getItem("escape-check")) return;
    sessionStorage.setItem("escape-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no|damage)$/.test(o.id),
      ) ||
      (s.prompt.options.length === 1 || s.prompt.title === "Forced responses"
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: o.label, exact: true })
      .click();
  }
  throw Error("Native Escape the Museum continuation did not finish");
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
    "The main scheme stage, Collector's side and physical cards survive reload",
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
const labyrinthButton = () =>
  page.getByRole("button", {
    name: "Hero Action · deal yourself 1 facedown encounter card · remove 5 threat from the main scheme",
    exact: true,
  });
const milanoButton = () =>
  page.getByRole("button", { name: "Milano · remove 3 threat", exact: true });
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "escape_the_museum");
  assert.deepEqual(s.modules, ["menagerie_medley"]);
  assert.equal(s.villain.code, difficulty === "expert" ? "16081a" : "16080a");
  assert.equal(s.villain.hp, difficulty === "expert" ? 10 : 8);
  assert.equal(s.escape.currentMain.code, "16082b");
  assert.equal(s.scheme.threat, 7);
  assert.deepEqual(
    s.environments.map((p) => p.code),
    ["16085a"],
  );
  assert.equal(s.escape.setAside.length, 7, "Ship Command is set aside");
  assert.equal(
    pieces(s).filter((p) => definition(p).set_code === "escape_the_museum")
      .length,
    11,
    "One villain, three main schemes, Library Labyrinth and six treacheries",
  );
  assert.equal(
    pieces(s).filter((p) => definition(p).set_code === "galactic_artifacts")
      .length,
    9,
  );
  assert.equal(
    pieces(s).filter((p) => definition(p).set_code === "ship_command").length,
    7,
  );
  assert.equal(s.player.form, "alter");
  assert.equal(
    await labyrinthButton().count(),
    0,
    "Library Labyrinth's Hero Action needs hero form",
  );
  await page.getByText("Clear all threat · stage 1 of 3").first().waitFor();
  for (const code of [s.villain.code, s.escape.currentMain.code, "16085a"]) {
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
        .getByRole("button", { name: "Escape the Museum", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "menagerie_medley",
      );
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("16080");
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
    current = { kind: "labyrinth", width };
    let f = fixture("labyrinth");
    const owned = originals(f.state);
    await open(width, f.state);
    await resumeExact();
    await labyrinthButton().click();
    let s = await settle();
    assert.equal(s.scheme.threat, f.threat - 5);
    assert.equal(s.encounter.dealt.length, f.dealt + 1);
    assert.equal(
      await labyrinthButton().count(),
      0,
      "Library Labyrinth is limited to once per round per player",
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("labyrinth", width);
    checks.push({ ...current, threat: s.scheme.threat, exactReload: true });

    current = { kind: "wound", width };
    f = fixture("wound");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(s.phase, "player", "Collector cannot be defeated");
    assert.equal(s.villain.code, "16080b");
    assert.equal(s.scheme.threat, f.threat - 6);
    await page
      .getByText("Wounded · cannot be defeated until the round ends")
      .first()
      .waitFor();
    await audit("wound", width);
    checks.push({ ...current, threat: s.scheme.threat });

    current = { kind: "great-escape", width };
    f = fixture("great-escape");
    await open(width, f.state);
    assert.equal(f.state.escape.currentMain.code, "16084b");
    await page.getByText("Clear all threat · stage 3 of 3").first().waitFor();
    await page.getByText("Museum Ship").first().waitFor();
    await milanoButton().click();
    s = await settle();
    assert.equal(s.scheme.threat, f.threat - 3);
    assert.equal(await milanoButton().count(), 0);
    await resumeExact();
    await audit("great-escape", width);
    checks.push({ ...current, threat: s.scheme.threat, exactReload: true });

    current = { kind: "escape-win", width };
    f = fixture("escape-win");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle((s) => s.phase === "won" || s.phase === "lost");
    assert.equal(s.phase, "won");
    await page
      .getByText(/The Milano escapes the museum/)
      .first()
      .waitFor();
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
