import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/on-the-run/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.ON_THE_RUN_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'on_the_run',difficulty:'standard',seed:40103,pacing:'expert',heroes});",
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
      // An original encounter card with boost icons but no boost ability on
      // top of the encounter deck.
      " function plain(){const i=s.encounter.deck.findIndex(p=>!card(p).boost_star&&card(p).boost>=1&&card(p).type_code!=='minion');const[p]=s.encounter.deck.splice(i,1);s.encounter.deck.unshift(p);delete s.encounter.knownTop;}",
      " function clear(){s.encounter.deck.push(...s.minions.splice(0));}",
      " const captor=()=>s.attachments.find(a=>a.code.startsWith('40105'));",
      " const hit=n=>[{type:'damage',target:s.villain.id,amount:n,source:'hero'}];",
      " const result={printed:card(s.villain).health*players};",
      " if(kind==='reset'){s.villain.hp=1;native(hit(1));}",
      " else if(kind==='schemes'){plain();result.threat=s.scheme.threat;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}",
      " else if(kind==='clutter'){clear();plain();const p=take('40106');result.id=p.id;result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='slab'){const p=take('40116');p.engagedWith='p1';s.minions.push(p);result.id=p.id;native([{type:'enemyAttack',id:p.id,actorId:'p1'}]);}",
      " else if(kind==='win'){captor().code='40105b';s.villain.hp=1;native(hit(1));}",
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
/** Every physical card of the On the Run set (the main schemes are tracked
 * by the game itself), the Mutant Slayers and Nasty Boys sets, and the one
 * Marauder in play. */
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
        definition(p).type_code !== "main_scheme",
    );
  // Hope's Captor and eight encounter cards.
  const run = of("on_the_run");
  assert.equal(run.length, 9, `The On the Run set: ${run.map((p) => p.code)}`);
  assert.equal(
    run.filter((p) => p.code.startsWith("40105")).length,
    1,
    "One Hope's Captor",
  );
  const slayers = of("mutant_slayers");
  assert.equal(slayers.length, 10, "The Mutant Slayers set");
  const nasty = of("nasty_boys");
  assert.equal(nasty.length, 6, "The Nasty Boys set");
  const marauders = of("marauders");
  assert.equal(marauders.length, 1, "One Marauder villain");
  return [...run, ...slayers, ...nasty, ...marauders].map((p) => p.id).sort();
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
    if (sessionStorage.getItem("on-the-run-check")) return;
    sessionStorage.setItem("on-the-run-check", "1");
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
      s.prompt.title === "Search the encounter deck" ||
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
function nativeSave(state, effects) {
  state.prompt = {
    kind: "choice",
    title: "Original encounter effect",
    text: "Resolve the original effect.",
    options: [{ id: "go", label: "Resolve original effect", effects }],
  };
  return state;
}
const villainHit = (s, amount) => [
  { type: "damage", target: s.villain.id, amount, source: "hero" },
];
try {
  for (const width of widths)
    for (const difficulty of ["standard", "expert"])
      for (const players of [1, 2]) {
        current = { kind: "setup", width, difficulty, players };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "On the Run", exact: true })
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
        await page.locator("#mission-seed").fill("40103");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "on_the_run");
        assert.deepEqual(s.modules, ["military_grade", "nasty_boys"]);
        const side = difficulty === "expert" ? "B" : "A";
        assert.ok(s.villain.code.endsWith(side.toLowerCase()));
        assert.equal(s.scheme.code, "40103b");
        assert.equal(
          s.attachments.find((p) => p.code === "40105a")?.attachedTo,
          s.villain.id,
          "Hope's Captor holds Hope",
        );
        // A Marauder minion is engaged with each player.
        for (const seat of s.players)
          assert.equal(
            s.minions.filter(
              (m) =>
                definition(m).set_code === "mutant_slayers" &&
                (m.engagedWith || s.activePlayerId) === seat.id,
            ).length,
            1,
            seat.id,
          );
        await page.getByText(`VILLAIN · ${side} · CONFIDENT`).waitFor();
        await page
          .getByText("Hope's Captor · resets instead of being defeated once")
          .waitFor();
        const name = definition(s.villain).name;
        await page.getByText(`Defeat ${name} twice · 0 of 2`).waitFor();
        await artwork([s.villain.code, "40105a", "40103b"]);
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
    assert.notEqual(s.phase, "won");
    assert.equal(
      s.attachments.find((p) => p.code.startsWith("40105"))?.code,
      "40105b",
    );
    assert.equal(s.villain.hp, f.printed + 6);
    assert.equal(s.scheme.code, "40104b");
    assert.ok(s.villain.tough, "Each Marauder enemy gets a tough status card");
    await page.getByText("VILLAIN · A · DESPERATE").waitFor();
    await page.getByText("Desperate · defeat the villain to win").waitFor();
    await page
      .getByText(`Defeat ${definition(s.villain).name} twice · 1 of 2`)
      .waitFor();
    await artwork(["40105b", "40104b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("reset", width);
    checks.push({ ...current });

    current = { kind: "schemes", width };
    f = fixture("schemes");
    owned = originals(f.state);
    await open(width, f.state);
    const hp = f.state.player.hp;
    s = await resolveFixture();
    assert.equal(s.player.hp, hp, "The villain does not attack");
    assert.ok(s.scheme.threat > f.threat, "The villain schemes instead");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("schemes", width);
    checks.push({ ...current });

    current = { kind: "clutter", width };
    f = fixture("clutter");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(
      s.attachments.find((p) => p.id === f.id)?.attachedTo,
      s.villain.id,
    );
    await page.getByText("0/3 damage", { exact: true }).waitFor();
    await artwork(["40106"]);
    const villainHp = s.villain.hp;
    await open(width, nativeSave(await saved(), villainHit(s, 2)));
    s = await resolveFixture();
    assert.equal(s.villain.hp, villainHp, "Hidden in the Clutter takes it");
    await page.getByText("2/3 damage", { exact: true }).waitFor();
    const before = s.player.hp;
    await open(width, nativeSave(await saved(), villainHit(s, 1)));
    s = await resolveFixture();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "It is discarded");
    assert.equal(s.villain.hp, villainHp);
    assert.ok(s.player.hp < before, "The villain attacks the dealer");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("clutter", width);
    checks.push({ ...current });

    current = { kind: "slab", width };
    f = fixture("slab");
    owned = originals(f.state);
    await open(width, f.state);
    const slabHp = f.state.player.hp;
    s = await resolveFixture();
    assert.equal(s.minions.find((p) => p.id === f.id)?.counters, 1);
    assert.ok(slabHp - s.player.hp >= 2, "Slab attacks with +1 ATK");
    await page
      .getByText("1 growth counter · +1 ATK when he attacks", { exact: false })
      .waitFor();
    await artwork(["40116"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("slab", width);
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
