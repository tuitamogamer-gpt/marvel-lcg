import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/god-of-lies/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.GOD_OF_LIES_VIEWPORTS || "1280,768,390,320")
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
      "export {AVATARS,SYNERGY,godOfLiesCaption,godOfLiesObjective,godOfLiesMainNote,godOfLiesPanel,synergyUse} from './src/game/god-of-lies.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind,players=1){",
      " const heroes=[{heroId:'captain_marvel',aspect:'aggression'},{heroId:'spider_man',aspect:'justice'}].slice(0,players);",
      " let s=newGame({heroId:'captain_marvel',aspect:'aggression',villainId:'god_of_lies',difficulty:'standard',seed:55027,pacing:'expert',heroes});",
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
      // Loki the Rascal in play, the other Avatars set aside.
      " const st=s.godOfLies;if(s.villain.code!=='55029a'){st.avatars=[...st.avatars.filter(c=>c!=='55029a'),s.villain.code];s.villain.code='55029a';}",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const result={};",
      " if(kind==='shatter'){st.shatter=2;native([{type:'damage',target:s.villain.id,amount:s.villain.hp,source:'hero'}]);}",
      " else if(kind==='worlds'){native([{type:'threat',target:'main',amount:8*players}]);}",
      " else if(kind==='defeat'){native([{type:'damage',target:'hero:p1',amount:99,source:'encounter'}]);}",
      " else if(kind==='chains'){const p=take('55035');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='fenris'){const p=take('55042');p.engagedWith='p1';p.damage=0;s.minions.push(p);result.minion=p.id;native([{type:'damage',target:p.id,amount:7,source:'hero'}]);}",
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
  AVATARS,
  SYNERGY,
  godOfLiesCaption,
  godOfLiesObjective,
  godOfLiesMainNote,
  godOfLiesPanel,
  synergyUse,
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
    // Intense Focus while set aside, and Trickster Magic's linked allies.
    ...(s.godOfLies?.focus ? [s.godOfLies.focus] : []),
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
/** The physical cards of the God of Lies and Trickster Magic sets, other
 * than the villains and main schemes: 22 encounter cards, Intense Focus
 * and the four Synergy environments. */
const SETS = { god_of_lies: 27, trickster_magic: 11 };
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
    if (sessionStorage.getItem("god-of-lies-check")) return;
    sessionStorage.setItem("god-of-lies-check", "1");
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
/** The scenario panel's captions for this state. */
function panelTexts(s) {
  const panel = godOfLiesPanel(s);
  return [
    `Only shatter counters wound him · ${panel.shatter} on the Avatar${panel.loki === "55027a" ? ` · flips at ${panel.flipAt}` : ""}`,
    panel.doomed
      ? "Complete: defeat Loki before the player phase ends"
      : "A completed scheme or a defeated hero adds 1 · at 2 you lose",
  ];
}
try {
  for (const width of widths)
    for (const difficulty of ["standard", "expert"])
      for (const players of [1, 2]) {
        current = { kind: "setup", width, difficulty, players };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "God of Lies", exact: true })
          .click();
        await page.getByText(/Loki, God of Lies stays out of reach/).waitFor();
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
        await page.locator("#mission-seed").fill("55027");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "god_of_lies");
        assert.ok(s.godOfLies, "God of Lies's rules are on");
        assert.deepEqual(s.modules, ["trickster_magic"]);
        assert.ok(AVATARS.includes(s.villain.code), "an Avatar of Loki");
        const bonus = difficulty === "expert" ? 2 : 0;
        assert.equal(s.villain.hp, (15 + bonus) * players);
        assert.equal(s.scheme.code, "55033b");
        assert.equal(s.scheme.threat, 0);
        assert.deepEqual(s.godOfLies.loki, {
          code: "55027a",
          hp: 20 * players,
          maxHp: 20 * players,
        });
        assert.equal(s.godOfLies.worlds, 0);
        assert.equal(s.godOfLies.avatars.length, 3);
        assert.deepEqual(
          (s.environments || []).map((p) => p.code).sort(),
          [...SYNERGY].sort(),
        );
        if (difficulty === "expert")
          assert.ok(
            s.attachments.some(
              (p) => p.code === "55034a" && p.attachedTo === s.villain.id,
            ),
            "Intense Focus on the Avatar",
          );
        else assert.equal(s.godOfLies.focus?.code, "55034a");
        await shown(godOfLiesCaption(s));
        await shown(godOfLiesObjective(s));
        await shown(godOfLiesMainNote(s));
        for (const text of panelTexts(s)) await shown(text);
        for (const p of s.environments)
          await shown(`Remove 1: ${synergyUse(p)}`);
        await artwork([
          s.villain.code,
          "55033b",
          "55027a",
          "55028b",
          ...SYNERGY,
        ]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "shatter", width };
    let f = fixture("shatter");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(s.godOfLies.loki.hp, 13, "2 + 5 shatter counters wound Loki");
    assert.equal(s.godOfLies.shatter, 0);
    assert.ok(
      ["55030a", "55031a", "55032a"].includes(s.villain.code),
      "another Avatar takes his place",
    );
    assert.equal(s.villain.hp, 15);
    assert.ok(s.godOfLies.avatars.includes("55029a"));
    assert.equal(
      s.environments.find((p) => p.code === "55055").counters,
      1,
      "Unified Front gains a synergy counter",
    );
    await shown(godOfLiesObjective(s));
    await shown(godOfLiesCaption(s));
    for (const text of panelTexts(s)) await shown(text);
    await artwork([s.villain.code]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("shatter", width);
    checks.push({ ...current });

    current = { kind: "worlds", width };
    f = fixture("worlds");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.scheme.threat, 0, "Mischief and Mayhem loses its threat");
    assert.equal(s.godOfLies.worlds, 1, "1 threat on Worlds Collide");
    await shown(godOfLiesObjective(s));
    await shown(godOfLiesMainNote(s));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("worlds", width);
    checks.push({ ...current });

    current = { kind: "defeat", width };
    f = fixture("defeat", 2);
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    const p1 = s.players.find((seat) => seat.id === "p1");
    assert.ok(!p1.eliminated, "the hero is not eliminated");
    const view = s.activePlayerId === "p1" ? s.player : p1.player;
    assert.equal(view.hp, 1);
    assert.equal(view.form, "alter");
    assert.equal(s.godOfLies.worlds, 1);
    await shown(godOfLiesObjective(s));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("defeat", width);
    checks.push({ ...current });

    current = { kind: "chains", width };
    f = fixture("chains");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    const chains = s.attachments.find((q) => q.code === "55035");
    assert.equal(chains.attachedTo, "hero:p1", "Wrapped in Chains attaches");
    assert.ok(s.player.exhausted, "its When Revealed exhausts you");
    await artwork(["55035"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("chains", width);
    checks.push({ ...current });

    current = { kind: "fenris", width };
    f = fixture("fenris");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(!s.minions.some((q) => q.id === f.minion));
    assert.equal(s.godOfLies.shatter, 3, "3 shatter counters");
    assert.equal(
      s.environments.find((p) => p.code === "55054").counters,
      1,
      "Mounting Resistance gains a synergy counter",
    );
    await shown(godOfLiesCaption(s));
    for (const text of panelTexts(s)) await shown(text);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("fenris", width);
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
