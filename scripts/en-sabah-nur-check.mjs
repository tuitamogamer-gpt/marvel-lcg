import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/en-sabah-nur/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.EN_SABAH_NUR_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'en_sabah_nur',difficulty:'standard',seed:45184,pacing:'expert',heroes});",
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
      " function onTop(code){s.encounter.deck.unshift(take(code));delete s.encounter.knownTop;}",
      " function untough(p){p.tough=false;p.toughCards=0;}",
      " const ritual=()=>s.sideSchemes.find(p=>p.code==='45163');",
      " const result={};",
      " if(kind==='form'){result.threat=s.scheme.threat;result.ritual=ritual().counters;native([{type:'esn:form',form:'Cyberpath'}]);}",
      " else if(kind==='power'){s.enSabahNur.power=3;onTop('45152');native([{type:'villainStepOne'}]);}",
      " else if(kind==='staggering'){const p=take('45149');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='ritual'){ritual().counters=9;native([{type:'threat',target:ritual().id,amount:1}]);}",
      " else if(kind==='rise'){s.scheme.threat=8*players-1;onTop('45154');native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='lose'){s.scheme.index=1;s.scheme.code='45148b';s.scheme.threat=10*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='win'){s.villain.code='45185c';s.villain.stage=2;s.villain.hp=1;untough(s.villain);native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
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
/** Every physical card of the En Sabah Nur set (the main schemes and
 * Apocalypse's forms are tracked by the game itself), and the Celestial
 * Tech and Clan Akkaba sets. */
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
    en_sabah_nur: 11,
    celestial_tech: 4,
    clan_akkaba: 7,
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
const FORMS = { a: "BIOMORPH", b: "CYBERPATH", c: "GIANT" };
const CAPTIONS = {
  a: (x) =>
    `Attacks gain overkill · on changing to Biomorph: ${x} indirect damage to each player`,
  b: (x) =>
    `Retaliate 1 · on changing to Cyberpath: ${x} threat on each scheme`,
  c: (x) => `Stalwart · on changing to Giant: he heals ${x}`,
};
const ROMAN = ["", "I", "II", "III"];
const RITUAL_CAPTION =
  "Permanent · at 10 threat, 5 come off and each of you is dealt a facedown card";
const ritual = (s) => s.sideSchemes.find((p) => p.code === "45163");
const note = (s) =>
  `Power ${s.enSabahNur.power} of 4 · the 4th after step one digs out a Superpower${s.scheme.code === "45148b" ? " · completed: you lose" : ""}`;
/** The villain's label and caption for his stage and form. */
async function apocalypse(s) {
  const letter = s.villain.code.slice(5);
  await shown(`VILLAIN · STAGE ${ROMAN[s.villain.stage]} · ${FORMS[letter]}`);
  await shown(CAPTIONS[letter](Number(s.villain.code.slice(4, 5)) - 3));
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
    if (sessionStorage.getItem("en-sabah-nur-check")) return;
    sessionStorage.setItem("en-sabah-nur-check", "1");
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
          .getByRole("button", { name: "En Sabah Nur", exact: true })
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
        await page.locator("#mission-seed").fill("45184");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "en_sabah_nur");
        assert.deepEqual(s.modules, ["celestial_tech", "clan_akkaba"]);
        const [code, hp] =
          difficulty === "expert" ? ["45185a", 20] : ["45184a", 16];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.maxHp, hp * players);
        assert.equal(s.scheme.code, "45147b");
        assert.equal(s.scheme.threat, players);
        assert.equal(s.enSabahNur.power, 0);
        assert.equal(ritual(s)?.counters, 5, "Ancient Ritual starts in play");
        await apocalypse(s);
        await shown(note(s));
        await shown(RITUAL_CAPTION);
        await artwork([code, "45147b", "45163"]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "form", width };
    let f = fixture("form");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(s.villain.code, "45184b", "Cyberpath");
    assert.equal(s.scheme.threat, f.threat + 1, "1 threat on the main scheme");
    assert.equal(ritual(s).counters, f.ritual + 1, "and on Ancient Ritual");
    await apocalypse(s);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("form", width);
    checks.push({ ...current });

    current = { kind: "power", width };
    f = fixture("power");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.villain.code, "45184c", "Giant-Sized Despot is dug out");
    assert.equal(s.enSabahNur.power, 1, "4 come off, its own comes on");
    await apocalypse(s);
    await shown(note(s));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("power", width);
    checks.push({ ...current });

    current = { kind: "staggering", width };
    f = fixture("staggering");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(
      s.attachments.some(
        (a) => a.code === "45149" && a.attachedTo === s.villain.id,
      ),
      "Staggering Strength attaches",
    );
    assert.equal(s.villain.code, "45184c", "and changes him to Giant");
    await apocalypse(s);
    await artwork(["45149"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("staggering", width);
    checks.push({ ...current });

    current = { kind: "ritual", width };
    f = fixture("ritual");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(ritual(s).counters, 5, "5 come off at 10");
    assert.equal(s.encounter.dealt.length, 1, "a facedown card for you");
    await shown(RITUAL_CAPTION);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("ritual", width);
    checks.push({ ...current });

    current = { kind: "rise", width };
    f = fixture("rise");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.scheme.code, "45148b", "The Rise of Apocalypse");
    assert.ok(
      s.sideSchemes.some((p) => p.code === "45154"),
      "its When Revealed digs out Plugged In",
    );
    await shown(note(s));
    await artwork(["45148b", "45154"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("rise", width);
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
