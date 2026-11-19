import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/unus/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.UNUS_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'unus',difficulty:'standard',seed:45059,pacing:'expert',heroes});",
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
      " const pool=()=>s.sideSchemes.find(p=>p.code==='45071');",
      " const result={};",
      " if(kind==='pool'){result.pool=pool().counters;native([{type:'villainStepOne'}]);}",
      " else if(kind==='ally'){const i=s.player.deck.findIndex(p=>card(p).type_code==='ally');const a=s.player.deck.splice(i,1)[0];s.player.inPlay.push(a);result.id=a.id;native([{type:'damage',target:a.id,amount:20,source:s.villain.id}]);}",
      " else if(kind==='soldier'){pool().counters=3;result.hp=s.player.hp;const p=take('45069');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='hunted'){const p=take('45072');result.held=[p];s.player.form='alter';s.player.hand.push(s.player.deck.shift());result.hand=s.player.hand.length;native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='sidearm'){const p=take('45063');p.attachedTo=s.villain.id;s.attachments.push(p);result.id=p.id;const energy=s.player.deck.find(q=>card(q).resource_energy>0&&!card(q).resource_physical);const physical=s.player.deck.find(q=>card(q).resource_physical>0&&!card(q).resource_energy&&q.code!==energy.code);for(const q of[energy,physical]){s.player.deck.splice(s.player.deck.indexOf(q),1);s.player.hand.push(q);}result.ids=[energy.id,physical.id];native([{type:'unus:basic-response',actorId:'p1'}]);}",
      " else if(kind==='lose'){s.scheme.threat=11*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='win'){s.villain.code='45060';s.villain.stage=2;s.villain.hp=1;s.villain.tough=false;s.villain.toughCards=0;native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
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
/** Every physical card of the Unus set (the main scheme and the villain are
 * tracked by the game itself), the Infinites set with Gene Pool, and the
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
  const set = of("unus");
  assert.equal(set.length, 10, `The Unus set: ${set.map((p) => p.code)}`);
  const infinites = of("infinites");
  assert.equal(infinites.length, 8, "The Infinites set with Gene Pool");
  const nightmare = of("dystopian_nightmare");
  assert.equal(nightmare.length, 6, "The Dystopian Nightmare set");
  return [...set, ...infinites, ...nightmare].map((p) => p.id).sort();
}
const genePool = (s) => s.sideSchemes.find((p) => p.code === "45071");
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("unus-check")) return;
    sessionStorage.setItem("unus-check", "1");
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
          .getByRole("button", { name: "Unus", exact: true })
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
        await page.locator("#mission-seed").fill("45059");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "unus");
        assert.deepEqual(s.modules, ["dystopian_nightmare"]);
        const stage = difficulty === "expert" ? "II" : "I";
        assert.equal(
          s.villain.code,
          difficulty === "expert" ? "45060" : "45059",
        );
        assert.equal(s.scheme.code, "45062b");
        assert.equal(genePool(s)?.counters, 4, "Gene Pool starts at 4");
        // Expert: each player was dealt a facedown encounter card.
        assert.equal(
          s.encounter.dealt.length,
          difficulty === "expert" ? players : 0,
        );
        await page
          .getByText(`VILLAIN · STAGE ${stage} · GENE POOL 4`)
          .waitFor();
        await page.getByText("Retaliate 1 · next: stalwart at 6").waitFor();
        await page.getByText("After step one: +1 on Gene Pool").waitFor();
        await page.getByText("Permanent · next at 6").waitFor();
        await artwork([s.villain.code, "45062b", "45071"]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "pool", width };
    let f = fixture("pool");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(genePool(s).counters, f.pool + 1, "Hunting Gene Traitors");
    await page.getByText("VILLAIN · STAGE I · GENE POOL 5").waitFor();
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("pool", width);
    checks.push({ ...current });

    current = { kind: "ally", width };
    f = fixture("ally");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(!s.player.inPlay.some((p) => p.id === f.id), "Ally defeated");
    assert.equal(genePool(s).counters, 7, "Gene Pool: 3 for the ally");
    await page
      .getByText("Retaliate 1 · stalwart · next: an amplify icon at 9")
      .waitFor();
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("ally", width);
    checks.push({ ...current });

    current = { kind: "soldier", width };
    f = fixture("soldier");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(
      s.minions.some((p) => p.code === "45069"),
      "Infinite Soldier",
    );
    assert.equal(s.player.hp, f.hp - 2, "Quickstrike attack");
    await page.getByText("Gene Pool: quickstrike").first().waitFor();
    await artwork(["45069"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("soldier", width);
    checks.push({ ...current });

    current = { kind: "hunted", width };
    f = fixture("hunted");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(
      s.player.inPlay.some((p) => p.code === "45072"),
      "Hunted",
    );
    await page
      .getByRole("button", {
        name: "Alter-Ego Action · discard a card from your hand · discard Hunted",
        exact: true,
      })
      .click();
    const discard = (await saved()).prompt.options[0];
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: discard.label, exact: true })
      .first()
      .click();
    s = await settle();
    assert.ok(!s.player.inPlay.some((p) => p.code === "45072"), "Discarded");
    assert.equal(s.player.hand.length, f.hand - 1);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("hunted", width);
    checks.push({ ...current });

    current = { kind: "sidearm", width };
    f = fixture("sidearm");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "Spend energy and physical resources · discard Prelate Sidearm",
        exact: true,
      })
      .click();
    await payWith(f.ids);
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "Sidearm is gone");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("sidearm", width);
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
