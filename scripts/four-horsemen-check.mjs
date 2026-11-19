import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/four-horsemen/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.HORSEMEN_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'four_horsemen',difficulty:'standard',seed:45081,pacing:'expert',heroes});",
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
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const villains=()=>s.horsemen.row.map(k=>k===s.horsemen.focus?s.villain:s.horsemen.bench[k]);",
      " const byKey=k=>k===s.horsemen.focus?s.villain:s.horsemen.bench[k];",
      " for(const v of villains()){v.tough=false;v.toughCards=0;}",
      " const result={row:[...s.horsemen.row]};",
      " if(kind==='counter'){result.active=s.horsemen.active;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}",
      " else if(kind==='zero'){const [a,b,c]=s.horsemen.row;native([a,b,c].map(k=>({type:'damage',target:byKey(k).id,amount:byKey(k).hp,source:'hero'})));}",
      " else if(kind==='war'){s.horsemen.active='war';const i=s.player.deck.findIndex(p=>card(p).type_code==='upgrade');const u=s.player.deck.splice(i,1)[0];s.player.inPlay.push(u);result.id=u.id;native([{type:'enemyAttack',id:byKey('war').id,actorId:'p1'}]);}",
      " else if(kind==='horse'){const p=take('45090');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='lose'){s.scheme.threat=12*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='win'){const last=s.horsemen.row[3];for(const k of s.horsemen.row.slice(0,3))byKey(k).hp=0;byKey(last).hp=1;native([{type:'damage',target:byKey(last).id,amount:1,source:'hero'}]);}",
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
  ];
}
/** Every physical card of the Four Horsemen set (the main scheme and the
 * villains are tracked by the game itself), the Hounds set and the
 * Dystopian Nightmare set. */
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
  const set = of("four_horsemen");
  assert.equal(
    set.length,
    15,
    `The Four Horsemen set: ${set.map((p) => p.code)}`,
  );
  const hounds = of("hounds");
  assert.equal(hounds.length, 7, "The Hounds set");
  const nightmare = of("dystopian_nightmare");
  assert.equal(nightmare.length, 6, "The Dystopian Nightmare set");
  return [...set, ...hounds, ...nightmare].map((p) => p.id).sort();
}
const horsemen = (s) =>
  s.horsemen.row.map((k) =>
    k === s.horsemen.focus ? s.villain : s.horsemen.bench[k],
  );
const byKey = (s, k) =>
  k === s.horsemen.focus ? s.villain : s.horsemen.bench[k];
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("horsemen-check")) return;
    sessionStorage.setItem("horsemen-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no|done|bonus)$/.test(
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
async function payWith(ids) {
  assert.equal((await saved()).prompt.kind, "payment");
  for (const id of ids) {
    const name = definition(
      (await saved()).player.hand.find((p) => p.id === id),
    ).name;
    await page
      .getByRole("button", {
        name: new RegExp(
          "^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " ·",
        ),
      })
      .first()
      .click();
  }
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
}
try {
  for (const width of widths)
    for (const difficulty of ["standard", "expert"])
      for (const players of [1, 2]) {
        current = { kind: "setup", width, difficulty, players };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Four Horsemen", exact: true })
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
        await page.locator("#mission-seed").fill("45081");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "four_horsemen");
        assert.deepEqual(s.modules, ["dystopian_nightmare", "hounds"]);
        const side = difficulty === "expert" ? "b" : "a";
        const villains = horsemen(s);
        assert.equal(villains.length, 4);
        for (const v of villains) assert.ok(v.code.endsWith(side), v.code);
        assert.equal(s.scheme.code, "45085b");
        assert.equal(
          s.sideSchemes.filter((p) =>
            ["45086", "45087", "45088", "45089"].includes(p.code),
          ).length,
          players,
        );
        const active = definition(byKey(s, s.horsemen.active)).name;
        await page
          .getByText("Bring all four Horsemen to 0 · 0 of 4 at 0")
          .waitFor();
        await page
          .getByText("None falls while another has hit points")
          .waitFor();
        await page
          .getByText(`Active: ${active} · moves on after each activation`)
          .waitFor();
        await page
          .getByRole("group", { name: `${active}, the active villain` })
          .waitFor();
        await artwork([...villains.map((v) => v.code), "45085b"]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "counter", width };
    let f = fixture("counter");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    const next = f.row[(f.row.indexOf(f.active) + 1) % 4];
    assert.equal(s.horsemen.active, next, "The active counter moves on");
    await page
      .getByRole("group", {
        name: `${definition(byKey(s, next)).name}, the active villain`,
      })
      .waitFor();
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("counter", width);
    checks.push({ ...current });

    current = { kind: "zero", width };
    f = fixture("zero");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.notEqual(s.phase, "won");
    assert.equal(horsemen(s).filter((v) => v.hp === 0).length, 3);
    await page
      .getByText("Bring all four Horsemen to 0 · 3 of 4 at 0")
      .waitFor();
    await page
      .getByText("At 0 · falls once all four are at 0")
      .first()
      .waitFor();
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("zero", width);
    checks.push({ ...current });

    current = { kind: "war", width };
    f = fixture("war");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(!s.player.inPlay.some((p) => p.id === f.id), "War's discard");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("war", width);
    checks.push({ ...current });

    current = { kind: "horse", width };
    f = fixture("horse");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    // Tied villains: the player chooses which one Golden Horse rides.
    const pending = await saved();
    if (pending.prompt?.title === "Golden Horse")
      await page
        .locator("[role=dialog]")
        .last()
        .getByRole("button", {
          name: pending.prompt.options[0].label,
          exact: true,
        })
        .first()
        .click();
    s = await settle();
    const horse = s.attachments.find((p) => p.code === "45090");
    assert.ok(horse, "Golden Horse is attached");
    assert.ok(horsemen(s).some((v) => v.id === horse.attachedTo));
    await artwork(["45090"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("horse", width);
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
