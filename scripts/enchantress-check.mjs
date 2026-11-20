import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/enchantress/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.ENCHANTRESS_VIEWPORTS || "1280,768,390,320")
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
      "import {newGame,dispatch,makePiece} from './src/game/engine.ts';",
      "import {card} from './src/game/cards.ts';",
      "import {syncSeat} from './src/game/team.ts';",
      "export {enchantressCaption,enchantressObjective,enchantressMainNote,enchantmentCaption,enchantment} from './src/game/enchantress-villain.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind,players=1){",
      " const heroes=[{heroId:'captain_marvel',aspect:'aggression'},{heroId:'spider_man',aspect:'justice'}].slice(0,players);",
      " let s=newGame({heroId:'captain_marvel',aspect:'aggression',villainId:'enchantress_villain',difficulty:'standard',seed:55001,pacing:'expert',heroes});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|bonus|resolve|allow|done)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " s.villain.tough=false;s.villain.toughCards=0;",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      // Swap a chosen Hypnotic Gaze into the first player's play area.
      " function gaze(front,counters){const mine=s.attachments.find(p=>p.attachedTo==='hero:p1');const other=[...s.enchantress.gazes,...s.attachments].find(p=>p.code===front);if(other&&other.id!==mine.id){other.code=mine.code;mine.code=front;}mine.counters=counters;return mine;}",
      " const result={};",
      " if(kind==='trance'){result.gaze=gaze('55010a',4).id;native([{type:'ench:charm',playerId:'p1',n:1,actorId:'p1'}]);}",
      " else if(kind==='forced'){const g=gaze('55009a',0);g.code='55009b';result.gaze=g.id;const law=take('55021');law.counters=3;s.sideSchemes.push(law);result.scheme=law.id;}",
      " else if(kind==='temptation'){const p=take('55013');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='crown'){const p=take('55016');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='beguiled'){const p=take('55056');p.engagedWith='p1';p.damage=0;s.minions.push(p);result.minion=p.id;native([{type:'damage',target:p.id,amount:7,source:'hero'}]);}",
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
const {
  fixture,
  definition,
  enchantressCaption,
  enchantressObjective,
  enchantressMainNote,
  enchantmentCaption,
  enchantment,
} = await import(pathToFileURL(fixturePath).href);
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
    // Future of Despair and the Hypnotic Gazes set aside, and Trickster
    // Magic's linked allies.
    ...(s.enchantress?.despair ? [s.enchantress.despair] : []),
    ...(s.enchantress?.gazes || []),
    ...(s.tricksterMagic?.allies || []),
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
/** The physical cards of the Enchantress and Trickster Magic sets, other
 * than Enchantress and the main scheme. */
const SETS = { enchantress_villain: 27, trickster_magic: 11 };
function originals(s, held = [], counts = SETS) {
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const owned = [];
  for (const [set, n] of Object.entries(counts)) {
    const cards = all.filter(
      (p) =>
        definition(p).set_code === set &&
        !["main_scheme", "villain"].includes(definition(p).type_code),
    );
    assert.equal(
      cards.length,
      n,
      `The ${set} set: ${cards.map((p) => p.code)}`,
    );
    owned.push(...cards);
  }
  return owned.map((p) => p.id).sort();
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
    if (sessionStorage.getItem("enchantress-check")) return;
    sessionStorage.setItem("enchantress-check", "1");
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
  }, state);
  await page.goto(url);
  if (state) await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function until(test, what) {
  for (let n = 0; n < 100; n++) {
    const s = await saved();
    if (test(s)) return s;
    await page.waitForTimeout(50);
  }
  throw Error("Timed out waiting for " + what);
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
        /^(pass|skip|continue|none|resolve|take|allow|no|done|bonus|hero)$/.test(
          o.id,
        ),
      ) ||
      (s.prompt.options.length === 1 ||
      s.prompt.title === "Forced responses" ||
      s.prompt.title === "Discard a card" ||
      /ability order/.test(s.prompt.title)
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    await choose(s, o.label);
  }
  throw Error("Native encounter continuation did not finish");
}
async function choose(s, label) {
  const dialog = page
    .locator("[role=dialog]")
    .last()
    .getByRole("button", { name: label, exact: true });
  if (await dialog.count()) await dialog.first().click();
  else
    await page
      .getByRole("button", {
        name: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .first()
      .click();
  await until(
    (next) => JSON.stringify(next) !== JSON.stringify(s),
    "the choice " + label,
  );
}
async function resumeExact() {
  const before = await saved();
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(await saved(), before, "The scenario survives reload");
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
/** The text is shown in full: not clipped by an ellipsis or its box. */
async function shown(text) {
  const el = page.getByText(text, { exact: true }).first();
  await el.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const clipped = await el.evaluate((node) => {
    if (
      node.scrollWidth > node.clientWidth + 1 &&
      getComputedStyle(node).overflow !== "visible"
    )
      return "ellipsis";
    node.scrollIntoView({ block: "center", inline: "nearest" });
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const line of range.getClientRects()) {
      if (line.width < 2) continue;
      for (const x of [line.left + 1, line.right - 1]) {
        const hit = document.elementFromPoint(x, line.top + line.height / 2);
        if (!hit || !(hit === node || node.contains(hit)))
          return `covered by ${hit?.className || hit?.tagName}`;
      }
    }
    const r = range.getBoundingClientRect();
    for (let box = node.parentElement; box; box = box.parentElement) {
      const style = getComputedStyle(box);
      if (style.overflowX === "visible" && style.overflowY === "visible")
        continue;
      const b = box.getBoundingClientRect();
      if (
        r.left < b.left - 1 ||
        r.right > b.right + 1 ||
        r.top < b.top - 1 ||
        r.bottom > b.bottom + 1
      )
        return box.className || box.tagName;
    }
    return "";
  });
  assert.equal(clipped, "", `Clipped: ${text}`);
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
async function resolveFixture() {
  await page
    .getByRole("button", { name: "Resolve original effect", exact: true })
    .click();
  await until((s) => s.prompt?.title !== "Original encounter effect", "it");
  return settle();
}
try {
  for (const width of widths)
    for (const difficulty of ["standard", "expert"])
      for (const players of [1, 2]) {
        current = { kind: "setup", width, difficulty, players };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Enchantress", exact: true })
          .click();
        await page
          .getByText(/Each hero starts with a random Hypnotic Gaze/)
          .waitFor();
        await page
          .locator(".setting-line")
          .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
          .getByRole("button", {
            name: difficulty === "expert" ? "Expert" : "Standard",
            exact: true,
          })
          .click();
        if (players === 2)
          await page
            .locator(".team-size")
            .getByRole("button", { name: "2 heroes", exact: true })
            .click();
        await page.locator("#mission-seed").fill("55001");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "enchantress_villain");
        assert.ok(s.enchantress, "Enchantress's rules are on");
        assert.deepEqual(s.modules, ["trickster_magic"]);
        const [code, hp] =
          difficulty === "expert" ? ["55002", 16] : ["55001", 15];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.hp, hp * players);
        assert.equal(s.scheme.code, "55004b");
        assert.equal(s.scheme.threat, players);
        assert.equal(s.enchantress.despair?.code, "55006");
        assert.equal(s.enchantress.gazes.length, 5 - players);
        assert.equal(s.tricksterMagic.allies.length, 4);
        const gaze = enchantment(s, "p1");
        assert.ok(gaze && gaze.code.endsWith("a"), "a Hypnotic Gaze");
        await shown(enchantressCaption(s));
        await shown(enchantressObjective(s));
        await shown(enchantressMainNote(s));
        await shown(enchantmentCaption(gaze));
        await artwork([code, "55004b", gaze.code]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "trance", width };
    let f = fixture("trance");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    let p = s.attachments.find((q) => q.id === f.gaze);
    assert.equal(p.code, "55010b", "Hypnotic Gaze flips to Trance of Sloth");
    assert.equal(p.counters, 0);
    assert.ok(s.player.stunned, "Trance of Sloth stuns its identity");
    await shown(enchantmentCaption(p));
    await shown(enchantressObjective(s));
    await artwork(["55010b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("trance", width);
    checks.push({ ...current });

    current = { kind: "forced", width };
    f = fixture("forced");
    owned = originals(f.state);
    await open(width, f.state);
    const threat = f.state.scheme.threat;
    await page
      .getByRole("button", {
        name: "Forced Action · 1 threat here, 2 off a side scheme",
        exact: true,
      })
      .click();
    s = await settle();
    assert.equal(s.scheme.threat, threat + 1);
    assert.equal(s.sideSchemes.find((q) => q.id === f.scheme).counters, 1);
    p = s.attachments.find((q) => q.id === f.gaze);
    assert.ok(p.exhausted, "the Trance is exhausted until the ready step");
    await shown(enchantmentCaption(p));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("forced", width);
    checks.push({ ...current });

    current = { kind: "temptation", width };
    f = fixture("temptation");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    p = s.attachments.find((q) => q.code === "55013");
    assert.equal(p.attachedTo, "hero:p1", "Kiss of Temptation attaches");
    await shown(enchantmentCaption(p));
    await page
      .getByRole("button", {
        name: "Forced Action · charm, draw 1 and discard 1",
        exact: true,
      })
      .click();
    s = await settle();
    assert.equal(enchantment(s, "p1").counters, 1, "1 charm counter");
    await shown(enchantmentCaption(enchantment(s, "p1")));
    await artwork(["55013"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("temptation", width);
    checks.push({ ...current });

    current = { kind: "crown", width };
    f = fixture("crown");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    p = s.attachments.find((q) => q.code === "55016");
    assert.equal(p.attachedTo, s.villain.id, "the Crown attaches to her");
    const before = s.player.hp;
    await page
      .getByRole("button", {
        name: "Hero Action · all exhaust, take 1 · discard",
        exact: true,
      })
      .click();
    s = await settle();
    assert.ok(!s.attachments.some((q) => q.code === "55016"));
    assert.equal(s.player.hp, before - 1);
    assert.ok(s.player.exhausted);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("crown", width);
    checks.push({ ...current });

    current = { kind: "beguiled", width };
    f = fixture("beguiled");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(!s.minions.some((q) => q.id === f.minion));
    assert.ok(
      s.victoryDisplay.some((q) => q.code === "55056"),
      "Absorbing Man: Victory 1",
    );
    assert.ok(
      s.player.inPlay.some((q) => q.code === "55063"),
      "Carl Creel joins the hero",
    );
    await artwork(["55063"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("beguiled", width);
    checks.push({ ...current });

    current = { kind: "trickster-magic", width };
    await open(width);
    await page
      .locator(".villain-tabs")
      .getByRole("button", { name: "Rhino", exact: true })
      .click();
    await page
      .getByLabel("Modular encounter", { exact: true })
      .selectOption("trickster_magic");
    await page.locator("#mission-seed").fill("55056");
    await page.locator("#start-btn").click();
    s = await settle();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    s = await settle();
    assert.equal(s.villainId, "rhino");
    assert.ok(s.modules.includes("trickster_magic"), JSON.stringify(s.modules));
    assert.ok(!s.enchantress, "Trickster Magic alone");
    assert.equal(s.tricksterMagic.allies.length, 4);
    assert.equal(
      s.encounter.deck.filter(
        (q) => definition(q).set_code === "trickster_magic",
      ).length,
      7,
    );
    await resumeExact();
    await audit("trickster-magic", width);
    checks.push({ ...current });
  }
  assert.deepEqual(errors, []);
  const report = {
    flows: checks.length,
    audits: audits.length,
    layouts: layouts.length,
    errors: errors.length,
  };
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ ...report, checks, audits, layouts }, null, 2),
  );
  console.log(JSON.stringify(report));
} catch (error) {
  await writeFile(
    resolve(output, "failure.txt"),
    `${JSON.stringify(current)}\n${error.stack || error}`,
  );
  if (page)
    await page
      .screenshot({ path: resolve(output, "failure.png"), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  await browser.close();
}
