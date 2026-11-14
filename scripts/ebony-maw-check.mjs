import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/ebony-maw/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.EBONY_MAW_VIEWPORTS || "1280,768,390,320")
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
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'ebony_maw',difficulty:'standard',seed:21071,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.ebonyMaw)throw Error('Original Ebony Maw setup incomplete');",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,s.environments||[]]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function deckCard(code){const i=s.player.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing deck card '+code);return s.player.deck.splice(i,1)[0];}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Ebony Maw effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " for(const p of [...(s.environments||[])]){s.environments=s.environments.filter(q=>q.id!==p.id);delete p.playAreaOf;p.counters=0;s.encounter.deck.push(p);}",
      " const result={};",
      " if(kind==='invoke'){s.player.form='alter';const p=take('21076');p.playAreaOf=s.activePlayerId;p.counters=1;s.environments.push(p);result.id=p.id;result.hp=s.player.hp;native([{type:'enemyScheme',id:s.villain.id}]);}",
      " else if(kind==='restrained'){s.player.form='hero';s.player.deck.push(...s.player.hand.splice(0));const e=deckCard('01088'),m=deckCard('01090');s.player.hand.push(e,m);result.cards=[card(e).name,card(m).name];const p=take('21083');p.attachedTo='hero:'+s.activePlayerId;s.attachments.push(p);s.player.exhausted=true;result.id=p.id;}",
      " else if(kind==='reactor'){const p=take('21084');result.id=p.id;native([{type:'reveal',piece:p,actorId:s.activePlayerId}]);}",
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
    s.ebonyMaw.currentMain,
    ...s.ebonyMaw.mainDeck,
    ...s.ebonyMaw.villainDeck,
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
function originals(s) {
  const all = pieces(s);
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  return all.map((p) => p.id + ":" + p.code).sort();
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
    if (sessionStorage.getItem("ebony-maw-check")) return;
    sessionStorage.setItem("ebony-maw-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no|damage)$/.test(o.id),
      ) ||
      (s.prompt.options.length === 1 || s.prompt.title === "Forced responses"
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: o.label, exact: true })
      .click();
  }
  throw Error("Native Ebony Maw continuation did not finish");
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
  assert.deepEqual(
    await saved(),
    before,
    "Spells, their counters and physical cards survive reload",
  );
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
const SPELLS = { 21076: 4, 21077: 2, 21078: 3, 21079: 3 };
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "ebony_maw");
  assert.deepEqual(s.modules, ["armies_of_titan", "black_order"]);
  assert.equal(s.villain.code, difficulty === "expert" ? "21072" : "21071");
  assert.equal(s.villain.hp, difficulty === "expert" ? 18 : 14);
  assert.equal(s.ebonyMaw.currentMain.code, "21074b");
  assert.equal(s.scheme.threat, 1);
  const spells = (s.environments || []).filter((p) => p.code in SPELLS);
  assert.equal(spells.length, difficulty === "expert" ? 2 : 1);
  for (const p of spells) {
    assert.equal(p.playAreaOf, s.activePlayerId, "Spells are in your area");
    assert.equal(p.counters, SPELLS[p.code], "Spells enter with counters");
  }
  assert.equal(s.encounter.discard.length, 0, "Discard reshuffled");
  for (const [set, count] of [
    ["ebony_maw", 21],
    ["black_order", 4],
    ["armies_of_titan", 6],
  ])
    assert.equal(
      pieces(s).filter((p) => definition(p).set_code === set).length,
      count,
      set,
    );
  await page.getByLabel("Spell in Spider-Man's play area").first().waitFor();
  assert.equal(
    await page.getByLabel("Spell in Spider-Man's play area").count(),
    spells.length,
  );
  for (const code of [s.villain.code, s.ebonyMaw.currentMain.code]) {
    const img = page.locator('img[src*="' + code + '"]').first();
    await img.waitFor();
    await img.evaluate(async (image) => {
      await image.decode();
      if (!image.naturalWidth) throw Error("Missing original artwork");
    });
  }
}
try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "Ebony Maw", exact: true })
        .click();
      for (const [slot, module] of [
        [1, "armies_of_titan"],
        [2, "black_order"],
      ])
        assert.equal(
          await page
            .getByRole("combobox", {
              name: "Modular encounter " + slot,
              exact: true,
            })
            .inputValue(),
          module,
        );
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("21071");
      await page.locator("#start-btn").click();
      const s = await begin();
      await setupEvidence(s, difficulty);
      const owned = originals(s);
      await resumeExact();
      assert.deepEqual(originals(await saved()), owned);
      await audit("standalone-" + difficulty, width);
      checks.push({
        ...current,
        physicalCards: owned.length,
        exactReload: true,
      });
    }
  }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "invocation", width };
    let f = fixture("invoke");
    const owned = originals(f.state);
    await open(width, f.state);
    assert.equal(
      await page.getByLabel("Spell in Spider-Man's play area").count(),
      1,
    );
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    let s = await settle();
    assert.equal(s.player.hp, f.hp - 4, "Fireball deals 4 damage");
    assert.ok(s.encounter.discard.some((p) => p.id === f.id));
    assert.equal(
      await page.getByLabel("Spell in Spider-Man's play area").count(),
      0,
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("invocation", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "restrained", width };
    f = fixture("restrained");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Spend energy and physical · discard Restrained",
        exact: true,
      })
      .click();
    assert.equal((await saved()).prompt.kind, "payment");
    for (const name of f.cards)
      await page
        .getByRole("button", {
          name: new RegExp(
            "^" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " ·",
          ),
        })
        .first()
        .click();
    await page
      .getByRole("button", { name: "Confirm payment", exact: true })
      .click();
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id));
    assert.ok(s.encounter.discard.some((p) => p.id === f.id));
    await audit("restrained", width);
    checks.push({ ...current });

    current = { kind: "reactor-overload", width };
    f = fixture("reactor");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "Place 2 threat on Reactor Overload",
        exact: true,
      })
      .click();
    s = await settle();
    assert.equal(s.sideSchemes.find((p) => p.id === f.id).counters, 3 + 2);
    await audit("reactor-overload", width);
    checks.push({ ...current });
  }
  assert.deepEqual(errors, []);
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify(
      { checks, audits, layouts, errors, widths, baseURL: url },
      null,
      2,
    ),
  );
  console.log(
    JSON.stringify({
      flows: checks.length,
      audits: audits.length,
      layouts: layouts.length,
      errors: errors.length,
    }),
  );
} catch (error) {
  await writeFile(
    resolve(output, "failure.txt"),
    String(error) +
      "\n" +
      JSON.stringify(current) +
      "\n" +
      (page ? await page.locator("body").innerText() : ""),
  );
  if (page)
    await page
      .screenshot({ path: resolve(output, "failure.png"), fullPage: true })
      .catch(() => {});
  throw error;
} finally {
  if (context) await context.close();
  await browser.close();
}
