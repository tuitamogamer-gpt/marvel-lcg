import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/dark-beast/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.DARK_BEAST_VIEWPORTS || "1280,768,390,320")
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
      "export function fixture(kind,players=1){",
      " const heroes=[{heroId:'spider_man',aspect:'justice'},{heroId:'captain_marvel',aspect:'aggression'}].slice(0,players);",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'dark_beast',difficulty:'standard',seed:45118,pacing:'expert',heroes});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|bonus)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,...s.darkBeast.setAside.map(g=>g.pieces)]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const SETTINGS=['45127','45133','45139'];",
      " function setting(code){for(const p of (s.environments||[]).filter(q=>SETTINGS.includes(q.code))){s.environments=s.environments.filter(q=>q.id!==p.id);s.encounter.discard.push(p);}(s.environments||=[]).push(take(code));}",
      " function untough(p){p.tough=false;p.toughCards=0;}",
      " const result={};",
      " if(kind==='special'){setting('45133');result.threat=s.scheme.threat;native([{type:'db:special',playerId:'p1'}]);}",
      " else if(kind==='attack'){setting('45133');result.threat=s.scheme.threat;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}",
      " else if(kind==='replace'){setting('45127');const p=take('45133');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='stage'){untough(s.villain);result.first=(s.environments||[]).find(q=>SETTINGS.includes(q.code)).code;native([{type:'damage',target:s.villain.id,amount:s.villain.hp,source:'hero'}]);}",
      " else if(kind==='goggles'){setting('45133');const p=take('45122');p.attachedTo=s.villain.id;s.attachments.push(p);result.id=p.id;result.threat=s.scheme.threat;}",
      " else if(kind==='mutant'){setting('45133');const p=take('45137');p.attachedTo='hero:p1';s.attachments.push(p);s.player.form='alter';result.id=p.id;result.threat=s.scheme.threat;}",
      " else if(kind==='lose'){s.scheme.threat=10*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='win'){s.villain.code='45119';s.villain.stage=2;s.villain.hp=1;untough(s.villain);native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
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
    // The set-aside Savage Land, Genosha and Blue Moon sets.
    ...(s.darkBeast?.setAside.flatMap((g) => g.pieces) || []),
  ];
}
/** Every physical card of the Dark Beast set (the main scheme and the
 * villain are tracked by the game itself), the Savage Land, Genosha and
 * Blue Moon sets and the Dystopian Nightmare set. */
function originals(s, held = []) {
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const of = (set) =>
    all.filter(
      (p) =>
        definition(p).set_code === set &&
        !["main_scheme", "villain"].includes(definition(p).type_code),
    );
  const counts = {
    dark_beast: 9,
    savage_land: 8,
    genosha: 8,
    blue_moon: 8,
    dystopian_nightmare: 6,
  };
  const owned = [];
  for (const [set, n] of Object.entries(counts)) {
    const cards = of(set);
    assert.equal(
      cards.length,
      n,
      `The ${set} set: ${cards.map((p) => p.code)}`,
    );
    owned.push(...cards);
  }
  return owned.map((p) => p.id).sort();
}
const SETTINGS = ["45127", "45133", "45139"];
const LABELS = {
  45127: "SAVAGE LAND",
  45133: "GENOSHA",
  45139: "BLUE MOON",
};
const SPECIALS = {
  45127: "you discard your top 3 cards",
  45133: "1 threat on the main scheme",
  45139: "1 damage to your identity",
};
const setting = (s) =>
  (s.environments || []).find((p) => SETTINGS.includes(p.code));
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("dark-beast-check")) return;
    sessionStorage.setItem("dark-beast-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no|done|bonus|hero)$/.test(
          o.id,
        ),
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
    if (await dialog.count()) await dialog.first().click();
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
  throw Error("Native encounter continuation did not finish");
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
    // Both ends of each line of the text must be visible, not covered by a
    // neighbouring element.
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
    // The text itself must sit inside every clipping box around it.
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
          .getByRole("button", { name: "Dark Beast", exact: true })
          .click();
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
        await page.locator("#mission-seed").fill("45118");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "dark_beast");
        assert.deepEqual(s.modules, ["dystopian_nightmare"]);
        const [code, stage, hp] =
          difficulty === "expert" ? ["45119", "II", 18] : ["45118", "I", 15];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.maxHp, hp * players);
        assert.equal(s.scheme.code, "45121b");
        const env = setting(s);
        assert.ok(env, "A Setting is revealed at setup");
        assert.equal(s.darkBeast.setAside.length, 2, "Two sets stay aside");
        if (difficulty === "expert")
          assert.ok(
            s.attachments.some(
              (a) => a.code === "45122" && a.attachedTo === s.villain.id,
            ),
            "High-Tech Goggles",
          );
        await shown(`VILLAIN · STAGE ${stage} · ${LABELS[env.code]}`);
        await shown(`When he attacks you, the Special: ${SPECIALS[env.code]}`);
        await page.getByText("ENVIRONMENT · SETTING").first().waitFor();
        await artwork([code, "45121b", env.code]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "special", width };
    let f = fixture("special");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(s.scheme.threat, f.threat + 1, "Genosha's Special");
    await shown("VILLAIN · STAGE I · GENOSHA");
    await shown(
      "When he attacks you, the Special: 1 threat on the main scheme",
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("special", width);
    checks.push({ ...current });

    current = { kind: "attack", width };
    f = fixture("attack");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(s.scheme.threat >= f.threat + 1, "His attack resolves it too");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("attack", width);
    checks.push({ ...current });

    current = { kind: "replace", width };
    f = fixture("replace");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(setting(s)?.code, "45133", "Genosha replaces The Savage Land");
    assert.ok(
      !(s.environments || []).some((p) => p.code === "45127"),
      "The Savage Land is discarded",
    );
    await shown("VILLAIN · STAGE I · GENOSHA");
    await artwork(["45133"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("replace", width);
    checks.push({ ...current });

    current = { kind: "stage", width };
    f = fixture("stage");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.villain.code, "45119", "Dark Beast (II)");
    assert.ok(setting(s) && setting(s).code !== f.first, "A new Setting");
    assert.equal(s.darkBeast.setAside.length, 1);
    await shown(`VILLAIN · STAGE II · ${LABELS[setting(s).code]}`);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("stage", width);
    checks.push({ ...current });

    current = { kind: "goggles", width };
    f = fixture("goggles");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Hero Action · exhaust your hero · Special · discard High-Tech Goggles",
        exact: true,
      })
      .first()
      .click();
    s = await settle();
    assert.ok(s.player.exhausted, "The hero is exhausted");
    assert.equal(s.scheme.threat, f.threat + 1, "Genosha's Special");
    assert.ok(!s.attachments.some((a) => a.id === f.id), "Goggles discarded");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("goggles", width);
    checks.push({ ...current });

    current = { kind: "mutant", width };
    f = fixture("mutant");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Alter-Ego Action · Special · discard Escaped Mutant",
        exact: true,
      })
      .first()
      .click();
    s = await settle();
    assert.equal(s.scheme.threat, f.threat + 1, "Genosha's Special");
    assert.ok(!s.attachments.some((a) => a.id === f.id), "Mutant discarded");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("mutant", width);
    checks.push({ ...current });

    current = { kind: "lose", width };
    f = fixture("lose");
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.phase, "lost");
    await page.getByText("MISSION FAILED").first().waitFor();
    await audit("lose", width);
    checks.push({ ...current });

    current = { kind: "win", width };
    f = fixture("win");
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.phase, "won");
    await page.getByText("MISSION COMPLETE").first().waitFor();
    await audit("win", width);
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
