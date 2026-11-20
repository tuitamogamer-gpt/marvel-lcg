import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/baron-zemo/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.BARON_ZEMO_VIEWPORTS || "1280,768,390,320")
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
      "export {zemoCaption,zemoObjective,zemoMainNote,boardCaption,moleCombination,remainingCombinations} from './src/game/baron-zemo.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind,players=1){",
      " const heroes=[{heroId:'captain_marvel',aspect:'aggression'},{heroId:'spider_man',aspect:'justice'}].slice(0,players);",
      " let s=newGame({heroId:'captain_marvel',aspect:'aggression',villainId:'baron_zemo',difficulty:'standard',seed:50165,pacing:'expert',heroes});",
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
      " const board=code=>s.environments.find(p=>p.code===code);",
      " const result={};",
      // Two energy cards in hand pay Chief Medical Officer's Hero Action.
      " if(kind==='investigate'){s.player.hp-=3;const energy=[];for(const p of[...s.player.deck]){const c=card(p);if((c.resource_energy||0)>=1&&!c.resource_wild&&energy.length<2){energy.push(p);s.player.deck.splice(s.player.deck.indexOf(p),1);}}s.player.hand=energy;result.board=board('50181a').id;}",
      " else if(kind==='evidence'){board('50182a').counters=0;result.board=board('50182a').id;native([{type:'zemo:respond',actorId:'p1'}]);}",
      " else if(kind==='accusation'){s.zemo.gained.push(...s.zemo.shield.splice(0));native([{type:'zemo:advance'}]);}",
      " else if(kind==='joins'){native([{type:'zemo:secret',id:board('50181a').id,n:2}]);}",
      " else if(kind==='warrant'){s.player.form='alter';const p=take('50179');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
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
  zemoCaption,
  zemoObjective,
  zemoMainNote,
  boardCaption,
  moleCombination,
  remainingCombinations,
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
    // The board members who joined the villain, and the evidence in its
    // envelopes or gained.
    ...(s.executiveBoard?.joined || []),
    ...(s.zemo?.aim || []),
    ...(s.zemo?.shield || []),
    ...(s.zemo?.gained || []),
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
/** The physical cards of the Baron Zemo, S.H.I.E.L.D., Executive Board and
 * evidence sets, other than Baron Zemo and the main scheme. */
const SETS = {
  baron_zemo: 12,
  "s.h.i.e.l.d.": 5,
  "s.h.i.e.l.d._executive_board": 6,
  executive_board_evidence: 9,
};
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
async function payFirst(n) {
  await until((s) => s.prompt?.kind === "payment", "the payment");
  for (let i = 0; i < n; i++)
    await page.locator(".payment-source").nth(i).click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  await until((s) => s.prompt?.kind !== "payment", "the payment to finish");
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
    if (sessionStorage.getItem("baron-zemo-check")) return;
    sessionStorage.setItem("baron-zemo-check", "1");
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
const boards = (s) =>
  (s.environments || []).filter((p) =>
    ["50181a", "50182a", "50183a"].includes(p.code),
  );
try {
  for (const width of widths)
    for (const difficulty of ["standard", "expert"])
      for (const players of [1, 2]) {
        current = { kind: "setup", width, difficulty, players };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Baron Zemo", exact: true })
          .click();
        await page.getByText(/A mole on the S\.H\.I\.E\.L\.D\./).waitFor();
        assert.equal(
          await page
            .locator(".setting-line")
            .filter({
              has: page.locator("span", { hasText: /^Executive Board$/ }),
            })
            .count(),
          0,
          "Baron Zemo always uses the Executive Board",
        );
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
        await page.locator("#mission-seed").fill("50165");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "baron_zemo");
        assert.ok(s.zemo, "Baron Zemo's rules are on");
        assert.deepEqual(s.modules, ["scientist_supreme", "s.h.i.e.l.d."]);
        const [code, hp] =
          difficulty === "expert" ? ["50166a", 16] : ["50165a", 12];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.hp, hp, "no per-player hit points");
        assert.equal(s.scheme.code, "50167b");
        assert.equal(s.scheme.threat, 2 * players);
        assert.deepEqual(
          boards(s).map((p) => p.counters),
          [2, 2, 2],
          "each board member starts with 2 secret counters",
        );
        assert.equal(s.zemo.shield.length, 6);
        assert.equal(s.zemo.aim.length, 3);
        await shown("ENVIRONMENT · BOARD MEMBER");
        await shown(zemoCaption(s));
        await shown(zemoObjective(s));
        await shown(zemoMainNote(s));
        await shown(boardCaption(s, boards(s)[0]));
        await shown(`VILLAIN · ${difficulty === "expert" ? "B1" : "A1"}`);
        await artwork([code, "50167b", "50181a", "50182a", "50183a"]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "investigate", width };
    let f = fixture("investigate");
    let owned = originals(f.state);
    await open(width, f.state);
    const hp = f.state.player.hp;
    await page
      .getByRole("button", {
        name: "Hero Action · spend 2 energy · remove 1 secret counter, then heal 1 damage from a friendly character",
        exact: true,
      })
      .click();
    await payFirst(2);
    let s = await settle();
    assert.equal(
      s.environments.find((p) => p.id === f.board).counters,
      1,
      "A secret counter comes off Chief Medical Officer",
    );
    assert.equal(s.player.hp, hp + 1, "and the hero heals 1 damage");
    await shown(
      boardCaption(
        s,
        s.environments.find((p) => p.id === f.board),
      ),
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("investigate", width);
    checks.push({ ...current });

    current = { kind: "evidence", width };
    f = fixture("evidence");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await until((s) => s.prompt?.title === "Zemo's Manipulations", "it");
    await choose(
      s,
      "Place 2 secret counters on Chief Surveillance Officer · gain 2 evidence cards",
    );
    s = await until((s) => s.zemo.gained.length === 2, "the evidence");
    assert.equal(
      s.environments.find((p) => p.id === f.board).counters,
      2,
      "2 secret counters go on Chief Surveillance Officer",
    );
    assert.ok(remainingCombinations(s).length < 27, "combinations crossed out");
    assert.equal(s.prompt?.text, "Make your accusation now?");
    s = await settle();
    assert.equal(s.scheme.code, "50167b", "the players have not accused yet");
    await shown(zemoMainNote(s));
    await shown(zemoObjective(s));
    await shown(
      boardCaption(
        s,
        s.environments.find((p) => p.id === f.board),
      ),
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("evidence", width);
    checks.push({ ...current });

    current = { kind: "accusation", width };
    f = fixture("accusation");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    const mole = moleCombination(s);
    assert.equal(s.zemo.accusation.member, mole[3], "the correct accusation");
    assert.equal(s.villain.code, "50165b", "Baron Zemo is unmasked");
    assert.equal(s.villain.hp, 18);
    assert.equal(s.scheme.code, "50169b");
    assert.ok(
      s.attachments.some(
        (p) => p.code === "50170" && p.attachedTo === s.villain.id,
      ),
      "Baron Zemo's Sword is attached to him",
    );
    assert.equal(s.executiveBoard.joined.length, 1, "the mole joins him");
    await shown("VILLAIN · A2 · UNMASKED");
    await shown(zemoCaption(s));
    await shown(zemoObjective(s));
    await shown(zemoMainNote(s));
    await artwork([
      "50165b",
      "50169b",
      "50170",
      s.executiveBoard.joined[0].code,
    ]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("accusation", width);
    checks.push({ ...current });

    current = { kind: "joins", width };
    f = fixture("joins");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.deepEqual(
      s.executiveBoard.joined.map((p) => [p.code, p.counters]),
      [["50181b", 4]],
      "Chief Medical Officer joins Baron Zemo with 4 secret counters",
    );
    await shown("4 secrets");
    await artwork(["50181b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("joins", width);
    checks.push({ ...current });

    current = { kind: "warrant", width };
    f = fixture("warrant");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(
      s.player.inPlay.some((p) => p.code === "50179"),
      "Arrest Warrant stays in your play area",
    );
    await page
      .getByRole("button", {
        name: /Alter-Ego Action · exhaust your identity/,
      })
      .first()
      .click();
    s = await settle((s) => s.minions.some((m) => m.code === "50178"));
    s = await settle();
    assert.ok(!s.player.inPlay.some((p) => p.code === "50179"));
    assert.ok(s.player.exhausted, "The identity is exhausted");
    assert.ok(
      s.minions.some((m) => m.code === "50178"),
      "a S.H.I.E.L.D. minion is revealed",
    );
    await artwork(["50178"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("warrant", width);
    checks.push({ ...current });

    current = { kind: "executive-board", width };
    await open(width);
    await page
      .locator(".villain-tabs")
      .getByRole("button", { name: "Rhino", exact: true })
      .click();
    await page
      .locator(".setting-line")
      .filter({ has: page.locator("span", { hasText: /^Executive Board$/ }) })
      .getByRole("button", { name: "Added", exact: true })
      .click();
    await page
      .getByText(/The S\.H\.I\.E\.L\.D\. Executive Board joins the encounter/)
      .waitFor();
    await page.locator("#mission-seed").fill("50181");
    await page.locator("#start-btn").click();
    s = await settle();
    await page
      .getByRole("button", { name: "Keep hand & begin", exact: true })
      .click();
    s = await settle();
    assert.equal(s.villainId, "rhino");
    assert.ok(s.executiveBoard && !s.zemo, "The Executive Board alone");
    assert.equal(s.modules.length, 1, "It does not count as a modular set");
    assert.deepEqual(
      boards(s).map((p) => p.counters),
      [2, 2, 2],
    );
    await shown("ENVIRONMENT · BOARD MEMBER");
    await shown(boardCaption(s, boards(s)[0]));
    await artwork(["50181a", "50182a", "50183a"]);
    await resumeExact();
    await audit("executive-board", width);
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
