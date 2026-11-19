import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/magog/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.MAGOG_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'magog',difficulty:'standard',seed:39001,pacing:'expert',module:'crime',heroes});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const crowd=side=>s.environments.find(p=>(side==='champion'?['39003a','39003b']:['39004a','39004b']).includes(p.code));",
      " const result={};",
      " function single(code){const p=take(code);result.id=p.id;result.held=[{id:p.id,code:p.code}];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " if(kind==='reset'){native([{type:'damage',target:s.villain.id,amount:10*players,source:'hero'}]);}",
      " else if(kind==='tag-team'){crowd('challengers').counters=5*players-1;native([{type:'magog:ratings',side:'challengers',n:1}]);}",
      " else if(kind==='win'){crowd('challengers').code='39004b';crowd('challengers').counters=10*players-1;native([{type:'magog:ratings',side:'challengers',n:1}]);}",
      " else if(kind==='lose'){crowd('champion').code='39003b';crowd('champion').counters=10*players-1;native([{type:'magog:ratings',side:'champion',n:1}]);}",
      " else if(kind==='break'){crowd('challengers').counters=1;single('39009');}",
      " else if(kind==='jolt')single('39005');",
      " else if(kind==='main'){s.scheme.threat=6*players-1;native([{type:'threat',target:'main',amount:2}]);}",
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
/** Every physical encounter card of the MaGog set (the villain and main
 * scheme are tracked by the game itself). */
function originals(s, held = []) {
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const set = all.filter(
    (p) =>
      definition(p).set_code === "magog" &&
      !["villain", "main_scheme"].includes(definition(p).type_code),
  );
  // The Champion, The Challengers and eight encounter cards.
  assert.equal(set.length, 10, `The MaGog set: ${set.map((p) => p.code)}`);
  return set.map((p) => p.id).sort();
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
    if (sessionStorage.getItem("magog-check")) return;
    sessionStorage.setItem("magog-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no|done)$/.test(o.id),
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
async function begin() {
  await settle();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  const s = await settle();
  assert.equal(s.phase, "player");
  return s;
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
const crowd = (s, side) =>
  s.environments.find((p) =>
    (side === "champion"
      ? ["39003a", "39003b"]
      : ["39004a", "39004b"]
    ).includes(p.code),
  );
try {
  for (const width of widths)
    for (const difficulty of ["standard", "expert"])
      for (const players of [1, 2]) {
        current = { kind: "setup", width, difficulty, players };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "MaGog", exact: true })
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
        await page.locator("#mission-seed").fill("39001");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "magog");
        assert.equal(
          s.villain.code,
          difficulty === "expert" ? "39001b" : "39001a",
        );
        assert.equal(s.villain.hp, 10 * players);
        assert.equal(crowd(s, "champion")?.code, "39003a");
        assert.equal(crowd(s, "challengers")?.code, "39004a");
        assert.equal(s.scheme.threat, players);
        assert.equal(await page.locator(".magog-crowds .crowd-row").count(), 2);
        assert.equal(
          await page.getByText("BOOING", { exact: true }).count(),
          2,
        );
        await page
          .getByText(`Flips at ${5 * players}`)
          .first()
          .waitFor();
        await page
          .getByText(`Wow the crowd · 0 of ${10 * players} ratings`)
          .waitFor();
        await artwork([
          difficulty === "expert" ? "39001b" : "39001a",
          "39003a",
          "39004a",
        ]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "reset", width };
    let f = fixture("reset", 2);
    let owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    let s = await settle();
    assert.equal(s.villain.hp, 20, "MaGog's hit points reset");
    assert.equal(crowd(s, "challengers").counters, 6);
    assert.equal(s.encounter.dealt.length, 2, "Each player is dealt a card");
    await page
      .locator('[aria-label="The Challengers: 6 ratings counters"]')
      .waitFor();
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("reset", width);
    checks.push({ ...current });

    current = { kind: "tag-team", width };
    f = fixture("tag-team");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(crowd(s, "challengers").code, "39004b");
    assert.equal(
      s.minions.find((p) => p.code === "39007")?.engagedWith,
      "p1",
      "Surprise Contender engages the first player",
    );
    assert.equal(await page.getByText("CHEERING", { exact: true }).count(), 1);
    await page.getByText("You win at 10").first().waitFor();
    await artwork(["39004b", "39007"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("tag-team", width);
    checks.push({ ...current });

    current = { kind: "break-a-leg", width };
    f = fixture("break");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle((s) => s.prompt?.title === "Break a Leg");
    const hp = s.player.hp;
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "Place 2 ratings counters on The Champion · take 2 damage",
        exact: true,
      })
      .click();
    s = await settle();
    assert.equal(s.player.hp, hp - 2, "4 damage reduced by 2");
    assert.equal(crowd(s, "champion").counters, 2);
    assert.ok(s.player.stunned, "Break a Leg stuns you");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("break-a-leg", width);
    checks.push({ ...current });

    current = { kind: "jolt-of-adrenaline", width };
    f = fixture("jolt");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(
      s.attachments.find((p) => p.id === f.id)?.attachedTo,
      s.villain.id,
      "Jolt of Adrenaline attaches to MaGog",
    );
    await artwork(["39005"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("jolt-of-adrenaline", width);
    checks.push({ ...current });

    current = { kind: "main-scheme", width };
    f = fixture("main");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(s.scheme.threat, 0, "All threat is removed instead");
    assert.equal(crowd(s, "champion").counters, 2);
    assert.equal(s.phase, "player");
    await resumeExact();
    await audit("main-scheme", width);
    checks.push({ ...current });

    for (const [kind, phase, text] of [
      ["win", "won", "MISSION COMPLETE"],
      ["lose", "lost", "MISSION FAILED"],
    ]) {
      current = { kind, width };
      f = fixture(kind);
      await open(width, f.state);
      await page
        .getByRole("button", { name: "Resolve original effect", exact: true })
        .click();
      s = await settle();
      assert.equal(s.phase, phase);
      await page.getByText(text).first().waitFor();
      await audit(kind, width);
      checks.push({ ...current });
    }
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
