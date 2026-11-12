import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/ronan/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.RONAN_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'ronan',difficulty:'standard',seed:16103,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'},{heroId:'captain_marvel',aspect:'aggression'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.ronan)throw Error('Original Ronan setup incomplete');",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Ronan effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " const result={};",
      " if(kind==='ship-cancel'){s.player.form='alter';const p=take('16116');s.encounter.dealt.push(p);result.id=p.id;result.threat=s.scheme.threat;result.resource=card(s.player.hand[0]).name;native([{type:'revealDealt'}]);}",
      " else if(kind==='weapon'){s.player.form='hero';s.player.exhausted=false;result.hp=s.player.hp;result.weapon=s.attachments.find(p=>p.code==='16109').id;}",
      " else if(kind==='take'){native([{type:'threat',target:'main',amount:20}]);}",
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
    s.ronan.currentMain,
    ...s.ronan.mainDeck,
    ...s.ronan.villainDeck,
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
    if (sessionStorage.getItem("ronan-check")) return;
    sessionStorage.setItem("ronan-check", "1");
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
  throw Error("Native Ronan continuation did not finish");
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
    "The Power Stone, the Milano and physical cards survive reload",
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
const milanoAction = () =>
  page.getByRole("button", { name: "Milano · remove 3 threat", exact: true });
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "ronan");
  assert.deepEqual(s.modules, ["kree_militant"]);
  assert.equal(s.villain.code, difficulty === "expert" ? "16104" : "16103");
  assert.equal(s.villain.hp, difficulty === "expert" ? 18 : 14);
  assert.ok(s.villain.tough, "Toughness");
  assert.equal(s.ronan.currentMain.code, "16106b");
  assert.equal(s.scheme.threat, 2);
  assert.deepEqual(
    s.environments.map((p) => p.code),
    ["16108"],
  );
  assert.ok(s.player.inPlay.some((p) => p.code === "16142"));
  assert.ok(
    s.attachments.some(
      (p) => p.code === "16109" && p.attachedTo === s.villain.id,
    ),
  );
  assert.ok(
    s.attachments.some(
      (p) => p.code === "16149" && p.attachedTo === "hero:" + s.firstPlayerId,
    ),
    "The first player starts with the Power Stone",
  );
  assert.equal(
    s.sideSchemes.some((p) => p.code === "16111"),
    difficulty === "expert",
  );
  for (const [set, count] of [
    ["ronan", 19],
    ["power_stone", 1],
    ["ship_command", 7],
    ["kree_militant", 9],
  ])
    assert.equal(
      pieces(s).filter((p) => definition(p).set_code === set).length,
      count,
      set,
    );
  await milanoAction().waitFor();
  for (const code of [s.villain.code, s.ronan.currentMain.code, "16108"]) {
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
        .getByRole("button", { name: "Ronan the Accuser", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "kree_militant",
      );
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("16103");
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
    current = { kind: "ship-cancel", width };
    let f = fixture("ship-cancel");
    const owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .getByRole("button", {
        name: /^Kree Command Ship · exhaust the Milano and spend 1 resource · cancel When Revealed/,
      })
      .click();
    assert.equal((await saved()).prompt.kind, "payment");
    await page
      .getByRole("button", {
        name: new RegExp(
          "^" + f.resource.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " ·",
        ),
      })
      .first()
      .click();
    await page
      .getByRole("button", { name: "Confirm payment", exact: true })
      .click();
    let s = await settle();
    assert.equal(s.scheme.threat, f.threat, "When Revealed was cancelled");
    assert.ok(s.encounter.discard.some((p) => p.id === f.id));
    assert.ok(s.player.inPlay.find((p) => p.code === "16142").exhausted);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("ship-cancel", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "universal-weapon", width };
    f = fixture("weapon");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Take 2 damage and deal yourself a facedown encounter card · shuffle Universal Weapon into the encounter deck",
        exact: true,
      })
      .click();
    s = await settle();
    assert.equal(s.player.hp, f.hp - 2);
    assert.equal(s.encounter.dealt.length, 1);
    assert.ok(s.encounter.deck.some((p) => p.id === f.weapon));
    await audit("universal-weapon", width);
    checks.push({ ...current });

    current = { kind: "take-what-is-mine", width };
    f = fixture("take");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(s.ronan.currentMain.code, "16107b");
    assert.equal(
      s.attachments.find((p) => p.code === "16149").attachedTo,
      s.villain.id,
    );
    assert.equal(await milanoAction().count(), 0, "No Milano action on 2B");
    await audit("take-what-is-mine", width);
    checks.push({ ...current, threat: s.scheme.threat });
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
