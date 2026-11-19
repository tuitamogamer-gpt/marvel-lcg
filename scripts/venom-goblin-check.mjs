import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/venom-goblin/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.VENOM_GOBLIN_VIEWPORTS || "1280,768,390,320")
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
      "import {vgTarget} from './src/game/venom-goblin.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'venom_goblin',difficulty:'standard',seed:27113,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.venomGoblin)throw Error('Original Venom Goblin setup incomplete');",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " function native(effects){s.prompt={kind:'choice',title:'Original Venom Goblin effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const st=s.venomGoblin;",
      " const result={};",
      " if(kind==='thwart'){result.lower=st.bench.lower.threat;}",
      " else if(kind==='infest'){native([{type:'vgob:infest',playerId:'p1',stage:'27113'}]);}",
      " else if(kind==='flip'){st.bench.upper.threat=9;native([{type:'threat',target:vgTarget('upper'),amount:1}]);}",
      " else if(kind==='bombs'){const b=take('27138');result.id=b.id;result.held=[{id:b.id,code:b.code}];native([{type:'reveal',piece:b,actorId:'p1'}]);}",
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
const nameOf = (code) => definition({ code }).name;
const KEYS = ["lower", "midtown", "upper"];
/** The threat of a Manhattan main scheme, wherever the focus is. */
const threatOf = (s, key) =>
  s.venomGoblin.focus === key
    ? s.scheme.threat
    : s.venomGoblin.bench[key]?.threat;
const schemeCode = { lower: "27117a", midtown: "27118a", upper: "27119a" };
function pieces(s) {
  return [
    s.villain,
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
/** Every physical encounter card but the villain, main schemes and the
 * environments a completed main scheme becomes. */
function originals(s, held = []) {
  // A card revealed by a native effect is held by that effect, not a zone.
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const cards = all.filter(
    (p) =>
      !["villain", "main_scheme", "environment"].includes(
        definition(p).type_code,
      ),
  );
  const set = (code) =>
    cards
      .filter((p) => definition(p).set_code === code)
      .map((p) => p.code)
      .sort();
  assert.equal(
    set("venom_goblin").length,
    12,
    "The 12 encounter cards of Venom Goblin: " + set("venom_goblin"),
  );
  assert.equal(
    set("symbiotic_strength").length,
    9,
    "The 9 cards of Symbiotic Strength: " + set("symbiotic_strength"),
  );
  assert.equal(
    set("goblin_gear").length,
    6,
    "The 6 cards of Goblin Gear: " + set("goblin_gear"),
  );
  return cards.map((p) => p.id + ":" + p.code).sort();
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
    if (sessionStorage.getItem("venom-goblin-check")) return;
    sessionStorage.setItem("venom-goblin-check", "1");
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
      (s.prompt.options.length === 1 ||
      s.prompt.title === "Forced responses" ||
      /ability order/.test(s.prompt.title)
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
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
  throw Error("Native Venom Goblin continuation did not finish");
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
    "The three main schemes, the glider counter and the dealt cards survive reload",
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
async function schemesShown(s) {
  const st = s.venomGoblin;
  for (const key of KEYS.filter((k) => !st.flipped.includes(k))) {
    const name = nameOf(schemeCode[key]);
    await page
      .getByRole("group", {
        name: st.glider === key ? name + ", with the glider counter" : name,
        exact: true,
      })
      .waitFor();
  }
  await page
    .getByText(`${st.flipped.length} of 2 districts infested`)
    .waitFor();
}
try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "Venom Goblin", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "goblin_gear",
      );
      await page.getByText(/Symbiotic Strength is always included/).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("27113");
      await page.locator("#start-btn").click();
      const s = await begin();
      assert.equal(s.villainId, "venom_goblin");
      assert.deepEqual(s.modules, ["goblin_gear"]);
      assert.equal(s.villain.code, difficulty === "expert" ? "27114" : "27113");
      assert.equal(s.scheme.code, "27118a");
      assert.equal(s.venomGoblin.glider, "midtown");
      assert.deepEqual(
        KEYS.map((key) => threatOf(s, key)),
        [1, 2, 0],
        "Lower, Midtown and Upper Manhattan's starting threat",
      );
      if (difficulty === "expert")
        assert.ok(
          s.encounter.dealt.filter((p) => p.dealtTo === "p1").length >= 2,
          "Venom Goblin (II) deals 2 facedown encounter cards",
        );
      await schemesShown(s);
      await artwork([s.villain.code, "27117a", "27118a", "27119a"]);
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
    current = { kind: "thwart-out-of-focus", width };
    let f = fixture("thwart");
    let owned = originals(f.state);
    await open(width, f.state);
    await page.getByRole("button", { name: /^Thwart Remove threat/ }).click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: /^Lower Manhattan/ })
      .first()
      .click();
    let s = await settle();
    assert.equal(threatOf(s, "lower"), f.lower - 1, "Lower Manhattan loses 1");
    assert.equal(threatOf(s, "midtown"), 2);
    assert.equal(s.scheme.code, "27118a", "the glider stays on Midtown");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("thwart-out-of-focus", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "infest-the-city", width };
    f = fixture("infest");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: /^Place 2 threat on Upper Manhattan/ })
      .click();
    s = await settle();
    assert.equal(s.venomGoblin.glider, "upper", "the glider moves to Upper");
    assert.equal(threatOf(s, "upper"), 2);
    await schemesShown(s);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("infest-the-city", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "main-scheme-flips", width };
    f = fixture("flip");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.deepEqual(s.venomGoblin.flipped, ["upper"]);
    assert.ok(s.environments.some((p) => p.code === "27119b"));
    assert.equal(s.phase, "player");
    await schemesShown(s);
    await page
      .getByText("Infested · a second Symbiote environment loses the game")
      .waitFor();
    await artwork(["27119b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("main-scheme-flips", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "incendiary-bombs", width };
    f = fixture("bombs");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    const bombs = s.attachments.find((p) => p.id === f.id);
    assert.equal(bombs?.attachedTo, s.villain.id);
    assert.equal(bombs.counters, 2);
    await page.getByText("2 bombs", { exact: true }).waitFor();
    await artwork(["27138"]);
    assert.deepEqual(originals(s), owned);
    await audit("incendiary-bombs", width);
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
