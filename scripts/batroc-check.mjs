import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/batroc/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.BATROC_VIEWPORTS || "1280,768,390,320")
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
      "export {BATROC_CAPTION,alertCaption,batrocMainNote} from './src/game/batroc.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind,players=1){",
      " const heroes=[{heroId:'captain_marvel',aspect:'aggression'},{heroId:'spider_man',aspect:'justice'}].slice(0,players);",
      // Batroc's Brigade joins another scenario with modular sets.
      " const rhino=kind==='brigade';",
      " let s=newGame({heroId:'captain_marvel',aspect:'aggression',villainId:rhino?'rhino':'batroc',difficulty:'standard',seed:50086,pacing:'expert',heroes,...(rhino?{modules:['batrocs_brigade']}:{})});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|bonus)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " s.villain.tough=false;s.villain.toughCards=0;",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const alert=()=>s.environments.find(p=>p.code.startsWith('50090'));",
      " const result={threat:s.scheme.threat,hp:s.player.hp};",
      " if(kind==='reset'){s.scheme.threat=10;result.threat=10;native([{type:'damage',target:s.villain.id,amount:20,source:'hero'}]);}",
      // Locate Missing Person (2B) with 1 threat left.
      " else if(kind==='free'){const st=s.batroc;s.removed.push(st.currentMain);const a=st.mainDeck.shift();a.code='50088b';st.currentMain=a;s.scheme.index=1;s.scheme.code='50088b';s.scheme.threat=1;result.threat=1;native([{type:'thwart',target:'main',amount:1,source:'hero'}]);}",
      " else if(kind==='alert'){alert().counters=3;const [pay]=s.player.deck.splice(0,1);s.player.hand=[pay];result.counters=3;}",
      " else if(kind==='captive'){const p=s.batroc.captives.shift();p.exhausted=false;s.player.inPlay.push(p);result.id=p.id;}",
      " else if(kind==='brigade'){const p=take('50101');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
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
const { fixture, definition, BATROC_CAPTION, alertCaption, batrocMainNote } =
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
    // Cards tucked under Zaran.
    ...s.minions.flatMap((p) => p.storedCards || []),
    // The Rescued Captives still set aside.
    ...(s.batroc?.captives || []),
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
/** The physical cards of Batroc's encounter set and the two default
 * modular sets, other than his villain card, the main schemes and Alert
 * Level. */
const SETS = {
  batroc: 16,
  "a.i.m._science": 5,
  batrocs_brigade: 5,
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
        !["main_scheme", "villain", "environment"].includes(
          definition(p).type_code,
        ),
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
const alert = (s) => s.environments.find((p) => p.code.startsWith("50090"));
const captives = (s) =>
  s.players.flatMap((seat) =>
    seatPlayer(s, seat).inPlay.filter((p) => p.code === "50091"),
  );
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
    if (sessionStorage.getItem("batroc-check")) return;
    sessionStorage.setItem("batroc-check", "1");
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
          .getByRole("button", { name: "Batroc", exact: true })
          .click();
        await page
          .getByText(/A\.I\.M\. Science and Batroc.s Brigade are preselected/)
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
        await page.locator("#mission-seed").fill("50086");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "batroc");
        assert.ok(s.batroc, "Batroc's rules are on");
        assert.deepEqual(s.modules, ["a.i.m._science", "batrocs_brigade"]);
        const [code, hp] =
          difficulty === "expert" ? ["50086b", 12] : ["50086a", 8];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.hp, hp, "Batroc's hit points are fixed");
        assert.equal(s.scheme.code, "50087b");
        assert.equal(s.scheme.threat, 6 * players);
        assert.equal(alert(s)?.code, "50090a", "Alert Level, Low side");
        assert.equal(
          alert(s).counters,
          difficulty === "expert" ? 2 * players : 0,
        );
        assert.equal(s.batroc.captives.length, 4, "4 Rescued Captives aside");
        await page.getByText("ENVIRONMENT · LOW ALERT").first().waitFor();
        await shown(BATROC_CAPTION);
        await shown(batrocMainNote(s));
        await shown(alertCaption(s));
        await artwork([code, "50087b", "50090a"]);
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
    assert.notEqual(s.phase, "won", "Batroc cannot be defeated");
    assert.equal(s.villain.hp, 8, "his hit points reset");
    assert.equal(s.scheme.threat, f.threat - 6, "and 6 threat comes off");
    await shown(BATROC_CAPTION);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("reset", width);
    checks.push({ ...current });

    current = { kind: "free", width };
    f = fixture("free");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await until(
      (s) => s.prompt?.options?.some((o) => o.id === "advance"),
      "Locate Missing Person's choice",
    );
    assert.equal(captives(await saved()).length, 1, "A captive is freed");
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: "Advance to Extract Captives", exact: true })
      .click();
    await until((s) => s.scheme.code === "50089b", "Extract Captives");
    s = await settle();
    assert.equal(s.scheme.code, "50089b");
    assert.equal(s.scheme.threat, 12, "12 threat per player");
    assert.equal(alert(s).code, "50090b", "Alert Level flips to High");
    assert.ok(captives(s)[0].exhausted, "The captive enters exhausted");
    await page.getByText("ENVIRONMENT · HIGH ALERT").first().waitFor();
    await shown(batrocMainNote(s));
    await shown(alertCaption(s));
    await artwork(["50089b", "50090b", "50091"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("free", width);
    checks.push({ ...current });

    current = { kind: "alert", width };
    f = fixture("alert");
    owned = originals(f.state);
    await open(width, f.state);
    await shown(alertCaption(f.state));
    await page
      .getByRole("button", {
        name: "Hero Action · spend 1 resource · remove 1 threat from Alert Level",
        exact: true,
      })
      .click();
    await payFirst(1);
    s = await settle();
    assert.equal(alert(s).counters, f.counters - 1, "1 threat comes off");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("alert", width);
    checks.push({ ...current });

    current = { kind: "captive", width };
    f = fixture("captive");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Hero Action · exhaust · remove 1 threat from the main scheme",
      })
      .first()
      .click();
    s = await until(
      (s) => s.scheme.threat === f.threat - 1,
      "the Rescued Captive's Hero Action",
    );
    s = await settle();
    assert.equal(s.scheme.threat, f.threat - 1);
    assert.ok(
      captives(s).find((p) => p.id === f.id)?.exhausted,
      "The captive is exhausted",
    );
    await artwork(["50091"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("captive", width);
    checks.push({ ...current });

    current = { kind: "brigade", width };
    f = fixture("brigade");
    const brigade = { batrocs_brigade: 5 };
    owned = originals(f.state, f.held, brigade);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.villainId, "rhino");
    assert.ok(
      s.sideSchemes.some((p) => p.code === "50101"),
      "Batroc's Brigade joins Rhino's scenario",
    );
    assert.equal(s.villain.tough, true, "and Rhino gets a tough status card");
    await artwork(["50101"]);
    assert.deepEqual(originals(s, [], brigade), owned);
    await resumeExact();
    await audit("brigade", width);
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
