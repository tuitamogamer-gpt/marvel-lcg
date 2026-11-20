import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/black-widow-villain/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.BLACK_WIDOW_VILLAIN_VIEWPORTS || "1280,768,390,320")
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
      "export {BLACK_WIDOW_CAPTION,widowsWebNote} from './src/game/black-widow-villain.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind,players=1){",
      " const heroes=[{heroId:'captain_marvel',aspect:'aggression'},{heroId:'spider_man',aspect:'justice'}].slice(0,players);",
      // A.I.M. Science joins another scenario with modular sets.
      " const rhino=kind==='soldier';",
      " let s=newGame({heroId:'captain_marvel',aspect:'aggression',villainId:rhino?'rhino':'black_widow_villain',difficulty:'standard',seed:50064,pacing:'expert',heroes,...(rhino?{modules:['a.i.m._science']}:{})});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|bonus)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      // The setup minions go back so the fixture controls the encounter deck.
      " s.encounter.deck.push(...s.encounter.dealt.splice(0),...s.minions.splice(0));",
      " for(const p of s.encounter.deck){delete p.engagedWith;p.damage=0;}",
      " s.villain.tough=false;s.villain.toughCards=0;",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const result={threat:s.scheme.threat,hp:s.player.hp};",
      " if(kind==='gauntlet'){const p=take('50068');s.encounter.deck.unshift(p);delete s.encounter.knownTop;result.id=p.id;}",
      " else if(kind==='net'){const p=take('50071');result.held=[p];result.id=p.id;native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='abductor'){const i=s.player.deck.findIndex(p=>card(p).type_code==='ally');const [ally]=s.player.deck.splice(i,1);s.player.inPlay.push(ally);result.ally=ally.id;result.allyName=card(ally).name;result.cost=Math.max(0,Number(card(ally).cost)||0);const p=take('50080');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='soldier'){const p=take('50084');result.held=[p];result.id=p.id;native([{type:'reveal',piece:p,actorId:'p1'}]);}",
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
const { fixture, definition, BLACK_WIDOW_CAPTION, widowsWebNote } =
  await import(pathToFileURL(fixturePath).href);
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
    // Allies tucked under Abduct Superhumans.
    ...s.sideSchemes.flatMap((p) => p.storedCards || []),
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
/** The physical cards of Black Widow's encounter set and the two A.I.M.
 * modular sets, other than her villain and main scheme cards. */
const SETS = {
  black_widow_villain: 19,
  "a.i.m._abduction": 5,
  "a.i.m._science": 5,
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
const abduct = (s) => s.sideSchemes.find((p) => p.code === "50081");
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("black-widow-villain-check")) return;
    sessionStorage.setItem("black-widow-villain-check", "1");
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
      // The Widow's Web: the minion each player starts engaged with.
      s.prompt.title === "The Widow's Web" ||
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
          .getByRole("button", { name: "Black Widow", exact: true })
          .click();
        await page
          .getByText(
            /A\.I\.M\. Abduction and A\.I\.M\. Science are preselected/,
          )
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
        await page.locator("#mission-seed").fill("50064");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "black_widow_villain");
        assert.ok(s.blackWidowVillain, "Black Widow's rules are on");
        assert.deepEqual(s.modules, ["a.i.m._abduction", "a.i.m._science"]);
        const [code, hp, stage] =
          difficulty === "expert" ? ["50065", 16, 2] : ["50064", 13, 1];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.hp, hp * players);
        assert.equal(s.scheme.code, "50067b");
        // 2 threat per player, and Black Widow (II)'s When Revealed 2 more.
        assert.equal(s.scheme.threat, (stage === 2 ? 4 : 2) * players);
        for (const seat of s.players)
          assert.ok(
            s.minions.some((m) => m.engagedWith === seat.id),
            `A minion engages ${seat.id}`,
          );
        await shown(BLACK_WIDOW_CAPTION);
        await shown(widowsWebNote(s));
        await artwork([code, "50067b"]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "gauntlet", width };
    let f = fixture("gauntlet");
    let owned = originals(f.state);
    await open(width, f.state);
    await shown(BLACK_WIDOW_CAPTION);
    await page.locator(".attack-action").click();
    await until(
      (s) => s.prompt || s.scheme.threat !== f.threat,
      "the attack on Black Widow",
    );
    let s = await settle();
    assert.equal(s.scheme.threat, f.threat - 1, "She removes 1 threat");
    assert.equal(
      s.attachments.find((a) => a.id === f.id)?.attachedTo,
      s.villain.id,
      "Her Gauntlet's Preparation attaches it to her",
    );
    assert.equal(s.player.hp, f.hp - 1, "and it retaliates");
    await artwork(["50068"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("gauntlet", width);
    checks.push({ ...current });

    current = { kind: "net", width };
    f = fixture("net");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(
      s.attachments.find((a) => a.id === f.id)?.attachedTo,
      "hero:p1",
      "Stun Net attaches to your identity",
    );
    const attack = page.locator(".attack-action");
    assert.equal(await attack.isDisabled(), true, "which cannot attack");
    assert.equal(
      await attack.getAttribute("title"),
      "Stun Net: your identity cannot attack.",
    );
    await artwork(["50071"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("net", width);
    await page
      .getByRole("button", {
        name: "Hero Action · exhaust your hero · discard Stun Net",
        exact: true,
      })
      .first()
      .click();
    await until(
      (next) => next.prompt || !next.attachments.some((a) => a.id === f.id),
      "Stun Net's Hero Action",
    );
    s = await settle();
    assert.ok(
      s.encounter.discard.some((p) => p.id === f.id),
      "Stun Net is discarded",
    );
    assert.equal(s.player.exhausted, true, "and your hero exhausted");
    assert.deepEqual(originals(s), owned);
    checks.push({ ...current });

    current = { kind: "abductor", width };
    f = fixture("abductor");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    const scheme = abduct(s);
    assert.ok(scheme, "Abduct Superhumans enters play");
    assert.ok(
      !s.player.inPlay.some((p) => p.id === f.ally),
      "Your ally leaves play",
    );
    assert.deepEqual(
      (scheme.storedCards || []).map((p) => p.id),
      [f.ally],
      "and is tucked under it",
    );
    assert.equal(scheme.accelerationTokens, 1);
    assert.ok(scheme.counters >= f.cost, "with threat equal to its cost");
    await shown(`Abducted: ${f.allyName} · freed when it is defeated`);
    await page
      .getByText("Acceleration tokens: 1", { exact: true })
      .first()
      .waitFor();
    await artwork(["50081"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("abductor", width);
    checks.push({ ...current });

    current = { kind: "soldier", width };
    f = fixture("soldier");
    const science = { "a.i.m._science": 5 };
    owned = originals(f.state, f.held, science);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.villainId, "rhino");
    assert.ok(
      s.minions.some((m) => m.id === f.id),
      "A.I.M. Soldier joins Rhino's scenario",
    );
    assert.equal(
      s.minions.find((m) => m.code === "50083")?.engagedWith,
      "p1",
      "and brings A.I.M. Scientist in",
    );
    await artwork(["50084", "50083"]);
    assert.deepEqual(originals(s, [], science), owned);
    await resumeExact();
    await audit("soldier", width);
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
