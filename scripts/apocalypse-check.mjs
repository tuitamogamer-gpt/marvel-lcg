import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/apocalypse/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.APOCALYPSE_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'apocalypse',difficulty:'standard',seed:45101,pacing:'expert',heroes});",
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
      " const prelates=()=>s.minions.filter(m=>/Prelate/.test(card(m).traits||''));",
      " function noPrelates(){for(const m of prelates()){s.minions=s.minions.filter(q=>q.id!==m.id);s.encounter.discard.push(m);}}",
      " function untough(p){p.tough=false;p.toughCards=0;}",
      " const heart=()=>s.sideSchemes.find(p=>p.code==='45104a');",
      " function throne(){const h=heart();s.sideSchemes=s.sideSchemes.filter(p=>p.id!==h.id);h.code='45104b';s.removed.push(h);const t=s.apocalypse.throne;delete s.apocalypse.throne;return t;}",
      " const result={};",
      " if(kind==='advance'){s.scheme.threat=9*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='reset'){untough(s.villain);const p=take('45107');p.attachedTo=s.villain.id;s.attachments.push(p);result.id=p.id;s.scheme.threat=15;result.max=s.villain.maxHp;native([{type:'damage',target:s.villain.id,amount:s.villain.hp,source:'hero'}]);}",
      " else if(kind==='citadel'){noPrelates();result.id=heart().id;native([{type:'thwart',target:heart().id,amount:2,source:'hero'}]);}",
      " else if(kind==='worthy'){noPrelates();untough(s.villain);s.villain.hp-=6;result.hp=s.villain.hp;const t=throne();t.code='45105a';t.counters=1;s.sideSchemes.push(t);result.id=t.id;native([{type:'thwart',target:t.id,amount:1,source:'hero'}]);}",
      " else if(kind==='win'){noPrelates();untough(s.villain);const t=throne();t.code='45105b';t.counters=0;t.attachedTo=s.villain.id;s.attachments.push(t);s.villain.hp=1;native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
      " else if(kind==='lose'){s.villain.code='45102b';s.villain.stage=4;s.villain.maxHp=11*players;s.villain.hp=11*players;s.scheme.threat=11*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='abyss'){noPrelates();const a=s.apocalypse.prelates.find(p=>p.code==='45181b');s.apocalypse.prelates=s.apocalypse.prelates.filter(p=>p.id!==a.id);a.engagedWith='p1';untough(a);s.minions.push(a);result.id=a.id;result.deck=s.player.deck.length;native([{type:'enemyAttack',id:a.id,actorId:'p1'}]);}",
      " else if(kind==='riders'){const p=take('45117');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
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
    // The set-aside Prelates and The Tyrant's Throne.
    ...(s.apocalypse?.prelates || []),
    ...(s.apocalypse?.throne ? [s.apocalypse.throne] : []),
  ];
}
/** Every physical card of the Apocalypse set (the main scheme and the
 * villain are tracked by the game itself), the Prelates, the Dark Riders
 * and the Infinites set with Gene Pool. */
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
  const set = of("apocalypse");
  assert.equal(set.length, 12, `The Apocalypse set: ${set.map((p) => p.code)}`);
  const prelates = of("prelates");
  assert.equal(prelates.length, 5, "The five Prelates");
  const riders = of("dark_riders");
  assert.equal(riders.length, 6, "The Dark Riders set");
  const infinites = of("infinites");
  assert.equal(infinites.length, 8, "The Infinites set with Gene Pool");
  return [...set, ...prelates, ...riders, ...infinites].map((p) => p.id).sort();
}
const isPrelate = (p) => /Prelate/.test(definition(p).traits || "");
const scheme = (s, code) => s.sideSchemes.find((p) => p.code === code);
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("apocalypse-check")) return;
    sessionStorage.setItem("apocalypse-check", "1");
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
          .getByRole("button", { name: "Apocalypse", exact: true })
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
        await page.locator("#mission-seed").fill("45101");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "apocalypse");
        assert.deepEqual(s.modules, ["dark_riders", "infinites"]);
        const [code, stage, x] =
          difficulty === "expert" ? ["45102a", "III", 10] : ["45101b", "II", 9];
        assert.equal(s.villain.code, code);
        assert.equal(s.villain.maxHp, x * players);
        assert.equal(s.scheme.code, "45103b");
        assert.equal(scheme(s, "45104a")?.counters, 2, "Heart of the Empire");
        const prelate = s.minions.filter(isPrelate);
        assert.equal(prelate.length, 1, "The first player's Prelate");
        assert.equal(prelate[0].engagedWith, s.firstPlayerId);
        assert.equal(s.apocalypse.prelates.length, 4, "Four set aside");
        assert.equal(s.apocalypse.throne?.code, "45105a");
        await shown(`VILLAIN · STAGE ${stage} · REGENERATES`);
        await shown(`At 0 he heals and the main scheme loses ${x} threat`);
        await shown("Storm the citadel · 0 of 3 cleared");
        await shown(
          `Completed: Apocalypse ${stage === "II" ? "III" : "IV"} rises`,
        );
        await shown("Locked by a Prelate");
        await shown("Clear it: a Prelate · then The Towering Citadel");
        await artwork([code, "45103b", "45104a", prelate[0].code]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "advance", width };
    let f = fixture("advance");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(s.villain.code, "45102a", "Apocalypse (III) rises");
    assert.equal(s.scheme.threat, 0, "The scheme's threat is removed");
    assert.equal(s.villain.hp, 10);
    assert.ok(s.villain.tough, "Toughness");
    await shown("VILLAIN · STAGE III · REGENERATES");
    await shown("Completed: Apocalypse IV rises");
    await artwork(["45102a"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("advance", width);
    checks.push({ ...current });

    current = { kind: "reset", width };
    f = fixture("reset");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.notEqual(s.phase, "won");
    assert.equal(s.villain.hp, f.max, "He heals all damage");
    assert.ok(!s.attachments.some((p) => p.id === f.id), "Discarded");
    assert.equal(s.scheme.threat, 15 - 9, "The scheme loses X threat");
    await shown("VILLAIN · STAGE II · REGENERATES");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("reset", width);
    checks.push({ ...current });

    current = { kind: "citadel", width };
    f = fixture("citadel");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(scheme(s, "45104b")?.id, f.id, "The Towering Citadel");
    assert.equal(scheme(s, "45104b")?.counters, 3);
    assert.equal(s.minions.filter(isPrelate).length, 1, "A new Prelate");
    await shown("Storm the citadel · 1 of 3 cleared");
    await shown("Clear it: a Prelate · then The Tyrant's Throne");
    await shown("Locked by a Prelate");
    await artwork(["45104b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("citadel", width);
    checks.push({ ...current });

    current = { kind: "worthy", width };
    f = fixture("worthy");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    const worthy = s.attachments.find((p) => p.code === "45105b");
    assert.equal(worthy?.id, f.id, "No Longer Worthy");
    assert.equal(worthy.attachedTo, s.villain.id);
    assert.equal(s.villain.hp, Math.min(s.villain.maxHp, f.hp + 5));
    assert.equal(s.minions.filter(isPrelate).length, 1, "A new Prelate");
    await shown("VILLAIN · STAGE II · NO LONGER WORTHY");
    await shown("No Longer Worthy · no damage while a Prelate is in play");
    await shown("Defeat Apocalypse · No Longer Worthy");
    await artwork(["45105b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("worthy", width);
    checks.push({ ...current });

    current = { kind: "abyss", width };
    f = fixture("abyss");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    const abyss = s.minions.find((p) => p.id === f.id);
    assert.equal(abyss?.storedCards?.length, 1, "One facedown card");
    assert.equal(s.player.deck.length, f.deck - 1);
    await shown("1 facedown card · +2 hit points");
    await artwork(["45181b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("abyss", width);
    checks.push({ ...current });

    current = { kind: "riders", width };
    f = fixture("riders");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(scheme(s, "45117"), "The Dark Riders");
    const rider = s.minions.find(
      (p) => definition(p).set_code === "dark_riders",
    );
    assert.ok(rider, "A Dark Rider is revealed");
    assert.ok(rider.tough, "Each Dark Riders minion gains toughness");
    await artwork(["45117", rider.code]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("riders", width);
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
