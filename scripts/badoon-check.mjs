import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/badoon/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.BADOON_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'brotherhood_of_badoon',difficulty:'standard',seed:16058,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'},{heroId:'captain_marvel',aspect:'aggression'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.badoon)throw Error('Original Brotherhood of Badoon setup incomplete');",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Badoon encounter',text:'Resolve the original encounter effect.',options:[{id:'go',label:'Resolve original encounter',effects}]};}",
      " const result={};",
      " if(kind==='milano-threat'){s.scheme.threat=7;result.threat=7;}",
      " else if(kind==='barrage'){s.environments.find(p=>p.code==='16063').counters=3;result.hp=s.players.map(p=>p.player.hp);native([{type:'villainStepOne',actorId:s.firstPlayerId}]);}",
      " else if(kind==='hull-breach'){const p=take('16146');result.id=p.id;native([{type:'reveal',piece:p,actorId:s.firstPlayerId}]);}",
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
function pieces(s) {
  return [
    s.villain,
    s.badoon.currentMain,
    ...s.badoon.mainDeck,
    ...s.badoon.villainDeck,
    ...s.players.flatMap((seat) => {
      const p = seat.id === s.activePlayerId ? s.player : seat.player;
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
    ...s.environments,
    ...s.removed,
    ...s.resolving,
    ...s.victoryDisplay,
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
    if (sessionStorage.getItem("badoon-check")) return;
    sessionStorage.setItem("badoon-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no)$/.test(o.id),
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
  throw Error("Native Badoon continuation did not finish");
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
    "Barrage counters, the Milano and physical cards survive reload",
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
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "brotherhood_of_badoon");
  assert.deepEqual(s.modules, ["band_of_badoon"]);
  assert.equal(s.villain.code, difficulty === "expert" ? "16059" : "16058");
  assert.equal(s.scheme.code, "16061b");
  assert.equal(s.scheme.threat, 2);
  const ship = s.environments.find((p) => p.code === "16063");
  assert.equal(ship.counters, 0);
  assert.ok(
    s.player.inPlay.some((p) => p.code === "16142"),
    "The first player controls the original Milano",
  );
  assert.equal(
    pieces(s).filter((p) => definition(p).set_code === "brotherhood_of_badoon")
      .length,
    12,
    "Two villain stages select twelve original physical Badoon cards",
  );
  assert.equal(
    pieces(s).filter((p) => definition(p).set_code === "ship_command").length,
    7,
  );
  assert.equal(
    s.attachments.some((p) => p.code === "16064"),
    difficulty === "expert",
  );
  await page.getByText("Barrage · fires at 4").first().waitFor();
  await page
    .getByRole("button", { name: "Milano · remove 3 threat", exact: true })
    .waitFor();
  for (const code of [s.villain.code, s.scheme.code, "16063", "16142"]) {
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
        .getByRole("button", { name: "Drang", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "band_of_badoon",
      );
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("16058");
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
    current = { kind: "milano-threat", width };
    let f = fixture("milano-threat");
    await open(width, f.state);
    await resumeExact();
    await page
      .getByRole("button", { name: "Milano · remove 3 threat", exact: true })
      .click();
    let s = await settle();
    assert.equal(s.scheme.threat, f.threat - 3);
    assert.ok(
      s.player.inPlay.find((p) => p.code === "16142").exhausted,
      "The Milano is exhausted as the action's cost",
    );
    assert.equal(
      await page
        .getByRole("button", { name: "Milano · remove 3 threat", exact: true })
        .count(),
      0,
    );
    await resumeExact();
    await audit("milano-threat", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "barrage", width };
    f = fixture("barrage");
    const owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original encounter", exact: true })
      .click();
    s = await settle();
    const ship = s.environments.find((p) => p.code === "16063");
    assert.equal(ship.counters, 0, "Four barrage counters fire and reset");
    const lost = s.players.reduce(
      (n, seat, i) =>
        n +
        f.hp[i] -
        (seat.id === s.activePlayerId ? s.player.hp : seat.player.hp),
      0,
    );
    assert.equal(lost, 4, "Two indirect damage to each of two players");
    assert.deepEqual(originals(s), owned);
    await audit("barrage", width);
    checks.push({ ...current, damage: lost });

    current = { kind: "hull-breach", width };
    f = fixture("hull-breach");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original encounter", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Exhaust the Milano", exact: true })
      .click();
    s = await settle();
    assert.ok(s.player.inPlay.find((p) => p.code === "16142").exhausted);
    assert.ok(s.encounter.discard.some((p) => p.id === f.id));
    await audit("hull-breach", width);
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
