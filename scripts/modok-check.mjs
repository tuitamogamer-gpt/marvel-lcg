import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/modok/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.MODOK_VIEWPORTS || "1280,768,390,320")
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
      "export {MODOK_CAPTION,ADAPTOID_UPGRADE_CAPTIONS,cellCaption,hostageCaption,holdingCell,modokMainNote,modokObjective} from './src/game/modok.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind,players=1){",
      " const heroes=[{heroId:'captain_marvel',aspect:'aggression'},{heroId:'spider_man',aspect:'justice'}].slice(0,players);",
      // The Scientist Supreme set joins another scenario with modular sets.
      " const rhino=kind==='supreme';",
      " let s=newGame({heroId:'captain_marvel',aspect:'aggression',villainId:rhino?'rhino':'modok',difficulty:'standard',seed:50103,pacing:'expert',heroes,...(rhino?{modules:['scientist_supreme']}:{})});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|bonus|resolve|allow|done)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      // Clear the dealt cards and the Adaptoids engaged at setup, so each
      // flow controls the board.
      " s.encounter.deck.push(...s.encounter.dealt.splice(0),...s.minions.splice(0));",
      " for(const p of s.encounter.deck){delete p.engagedWith;p.damage=0;}",
      " s.villain.tough=false;s.villain.toughCards=0;",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const cell=()=>(s.environments||[]).find(p=>['50105a','50106a','50107a','50108a'].includes(p.code));",
      // A hand of player cards that each give one resource, none wild.
      " function hand(n){const p=s.player,pick=[];for(const q of p.deck){const c=card(q);if((c.resource_energy||0)+(c.resource_mental||0)+(c.resource_physical||0)===1&&!c.resource_wild)pick.push(q);if(pick.length===n)break;}if(pick.length<n)throw Error('Missing resource cards');for(const q of pick)p.deck.splice(p.deck.indexOf(q),1);p.hand=pick;}",
      " const result={threat:s.scheme.threat};",
      " if(kind==='reset'){result.cell=cell().id;result.code=cell().code;native([{type:'damage',target:s.villain.id,amount:30,source:'hero'}]);}",
      " else if(kind==='cell'){hand(3);result.cell=cell().id;result.locks=cell().counters;}",
      " else if(kind==='free'){hand(3);cell().counters=1;result.cell=cell().id;result.code=cell().code;}",
      // The first Inhuman is freed, then Hostage Situation is revealed.
      " else if(kind==='hostage'){const c=cell();result.cell=c.id;native([{type:'mdk:unlock',n:c.counters}]);command({type:'CHOOSE',id:'go'});settle();const p=take('50121');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='upgrade'){result.upgrades=s.modok.upgrades.length;s.scheme.threat=0;native([{type:'threat',target:'main',amount:20}]);}",
      " else if(kind==='supreme'){const p=take('50125');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
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
  MODOK_CAPTION,
  ADAPTOID_UPGRADE_CAPTIONS,
  cellCaption,
  hostageCaption,
  holdingCell,
  modokMainNote,
  modokObjective,
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
    // Cards tucked under a card in play, and the ally held by Hostage
    // Situation.
    ...[...s.minions, ...s.sideSchemes, ...s.attachments].flatMap(
      (p) => p.storedCards || [],
    ),
    // The rest of the Holding Cell deck and the Adaptoid upgrades set aside.
    ...(s.modok?.cells || []),
    ...(s.modok?.upgrades || []),
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
/** The physical cards of M.O.D.O.K.'s encounter set, with the four Holding
 * Cells and the four Adaptoid upgrades, and of the Scientist Supreme set,
 * other than his villain card and the main scheme. */
const SETS = {
  "m.o.d.o.k.": 25,
  scientist_supreme: 5,
};
function originals(s, held = [], counts = SETS) {
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
const CELLS = ["50105a", "50106a", "50107a", "50108a"];
const INHUMANS = ["50105b", "50106b", "50107b", "50108b"];
const upgrades = (s) =>
  (s.environments || []).filter((p) => ADAPTOID_UPGRADE_CAPTIONS[p.code]);
const inhumans = (s) =>
  s.players.flatMap((seat) =>
    seatPlayer(s, seat).inPlay.filter((p) => INHUMANS.includes(p.code)),
  );
const ANY = "Hero Action · spend 3 resources · remove 1 lock counter";
/** Pay the pending cost with the first payment sources offered. */
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
    if (sessionStorage.getItem("modok-check")) return;
    sessionStorage.setItem("modok-check", "1");
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
  }, state);
  await page.goto(url);
  if (state) await page.getByRole("button", { name: /Resume mission/ }).click();
}
/** The saved game once the test holds, after a command from the page. */
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
    await until(
      (next) => JSON.stringify(next) !== JSON.stringify(s),
      "the choice " + o.label,
    );
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
          .getByRole("button", { name: "M.O.D.O.K.", exact: true })
          .click();
        await page.getByText(/Scientist Supreme is preselected/).waitFor();
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
        await page.locator("#mission-seed").fill("50103");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "modok");
        assert.ok(s.modok, "M.O.D.O.K.'s rules are on");
        assert.deepEqual(s.modules, ["scientist_supreme"]);
        const [code, hp] =
          difficulty === "expert" ? ["50103b", 14] : ["50103a", 10];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.hp, hp, "M.O.D.O.K.'s hit points are fixed");
        assert.equal(s.scheme.code, "50104b");
        const cell = holdingCell(s);
        assert.ok(CELLS.includes(cell?.code), "A Holding Cell is in play");
        assert.equal(cell.counters, 2 * players, "2 locks per player");
        assert.equal(s.modok.cells.length, 3, "3 Holding Cells below it");
        const n = difficulty === "expert" ? 2 : 1;
        assert.equal(upgrades(s).length, n, "Adaptoid upgrades in play");
        assert.equal(s.modok.upgrades.length, 4 - n, "the others set aside");
        for (const seat of s.players)
          assert.ok(
            s.minions.some(
              (m) => m.code === "50113" && m.engagedWith === seat.id,
            ),
            "Each player reveals an Adaptoid",
          );
        await shown("ENVIRONMENT · HOLDING CELL");
        await shown("ENVIRONMENT · ADAPTOID UPGRADE");
        assert.equal(
          await page.getByText("ENVIRONMENT · ADAPTOID UPGRADE").count(),
          n,
        );
        await shown(MODOK_CAPTION);
        await shown(modokObjective(s));
        await shown(modokMainNote(s));
        await shown(cellCaption(s));
        for (const p of upgrades(s))
          await shown(ADAPTOID_UPGRADE_CAPTIONS[p.code]);
        await artwork([
          code,
          "50104b",
          cell.code,
          "50113",
          ...upgrades(s).map((p) => p.code),
        ]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "reset", width };
    let f = fixture("reset");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.notEqual(s.phase, "won", "M.O.D.O.K. resets instead");
    assert.equal(s.villain.hp, 10, "his hit points reset");
    let freed = INHUMANS[CELLS.indexOf(f.code)];
    assert.equal(
      s.player.inPlay.find((p) => p.id === f.cell)?.code,
      freed,
      "2 locks come off and the last one frees the Inhuman",
    );
    assert.notEqual(holdingCell(s).id, f.cell, "The next Holding Cell");
    assert.equal(holdingCell(s).counters, 2, "enters with its locks");
    assert.equal(s.modok.cells.length, 2);
    await shown(MODOK_CAPTION);
    await shown(modokObjective(s));
    await shown(cellCaption(s));
    await artwork([freed, holdingCell(s).code]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("reset", width);
    checks.push({ ...current });

    current = { kind: "cell", width };
    f = fixture("cell");
    owned = originals(f.state);
    await open(width, f.state);
    await shown(cellCaption(f.state));
    // In hero form the Holding Cell offers its Hero Action, paid with its
    // own resources or 3 of any type.
    await shown("Spend 3 · remove a lock");
    await page.getByRole("button", { name: ANY, exact: true }).click();
    await payFirst(3);
    s = await settle();
    assert.equal(holdingCell(s).id, f.cell);
    assert.equal(holdingCell(s).counters, f.locks - 1, "1 lock comes off");
    await shown(cellCaption(s));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("cell", width);
    checks.push({ ...current });

    current = { kind: "free", width };
    f = fixture("free", 2);
    owned = originals(f.state);
    await open(width, f.state);
    await page.getByRole("button", { name: ANY, exact: true }).click();
    await payFirst(3);
    s = await until(
      (s) => s.prompt?.options?.some((o) => o.id === "p1"),
      "the choice of who takes the Inhuman",
    );
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: s.prompt.options.find((o) => o.id === "p1").label,
        exact: true,
      })
      .click();
    await until((s) => inhumans(s).length === 1, "the freed Inhuman");
    s = await settle();
    freed = INHUMANS[CELLS.indexOf(f.code)];
    assert.equal(
      s.players
        .flatMap((seat) => (seat.id === "p1" ? seatPlayer(s, seat).inPlay : []))
        .find((p) => p.id === f.cell)?.code,
      freed,
      "The Inhuman joins the chosen player",
    );
    assert.equal(holdingCell(s).counters, 4, "2 locks per player");
    await shown(modokObjective(s));
    await shown(cellCaption(s));
    await artwork([freed, holdingCell(s).code]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("free", width);
    checks.push({ ...current });

    current = { kind: "hostage", width };
    f = fixture("hostage");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    const scheme = s.sideSchemes.find((p) => p.code === "50121");
    assert.ok(scheme, "Hostage Situation enters play");
    assert.deepEqual(
      (scheme.storedCards || []).map((p) => p.id),
      [f.cell],
      "and holds the freed Inhuman",
    );
    assert.equal(inhumans(s).length, 0, "under no player's control");
    await shown(hostageCaption(s, scheme));
    await artwork(["50121"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("hostage", width);
    checks.push({ ...current });

    current = { kind: "upgrade", width };
    f = fixture("upgrade");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.notEqual(s.phase, "lost");
    assert.equal(s.scheme.threat, 0, "All threat comes off");
    assert.equal(s.modok.upgrades.length, f.upgrades - 1);
    assert.equal(upgrades(s).length, 2, "Another Adaptoid upgrade enters");
    assert.equal(
      await page.getByText("ENVIRONMENT · ADAPTOID UPGRADE").count(),
      2,
    );
    await shown(modokMainNote(s));
    for (const p of upgrades(s)) await shown(ADAPTOID_UPGRADE_CAPTIONS[p.code]);
    await artwork(upgrades(s).map((p) => p.code));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("upgrade", width);
    checks.push({ ...current });

    current = { kind: "supreme", width };
    f = fixture("supreme");
    const supreme = { scientist_supreme: 5 };
    owned = originals(f.state, f.held, supreme);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.villainId, "rhino");
    assert.ok(
      s.minions.some((p) => p.code === "50125"),
      "Scientist Supreme joins Rhino's scenario",
    );
    await artwork(["50125"]);
    assert.deepEqual(originals(s, [], supreme), owned);
    await resumeExact();
    await audit("supreme", width);
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
