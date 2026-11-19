import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/sinister-six/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.SINISTER_SIX_VIEWPORTS || "1280,768,390,320")
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
      "import {sixVillains,sixActiveVillain,lightThreat} from './src/game/sinister-six.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'sinister_six',difficulty:'standard',seed:27094,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.sinisterSix)throw Error('Original Sinister Six setup incomplete');",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " const st=s.sinisterSix;",
      " const light=s.sideSchemes.find(p=>p.code==='27102a');",
      " const result={id:light.id,setAside:[...st.setAside],inPlay:sixVillains(s).map(v=>v.code)};",
      " if(kind==='trap'){light.counters=1;result.chase=lightThreat(s,'27102b');}",
      " else if(kind==='chase'){light.code='27102b';light.counters=1;}",
      " else if(kind==='defeat'){const v=sixActiveVillain(s);v.hp=1;result.villain=v.id;result.code=v.code;result.light=light.counters;result.next=result.inPlay.find(c=>c!==v.code);}",
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
const nameOf = (code) => definition({ code }).name;
/** The villains in play by activation order, wherever the focus is. */
const villainsOf = (s) =>
  [
    ...(s.sinisterSix.absent ? [] : [s.villain]),
    ...Object.values(s.sinisterSix.bench),
  ].sort((a, b) => a.code.localeCompare(b.code));
const lightOf = (s) =>
  s.sideSchemes.find((p) => ["27102a", "27102b"].includes(p.code));
function pieces(s) {
  return [
    s.villain,
    ...Object.values(s.sinisterSix?.bench || {}),
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
/** Every physical card but the villains, which enter and leave play as
 * fresh cards. Light at the End is one card whichever side is up. */
function originals(s) {
  const all = pieces(s);
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const cards = all.filter(
    (p) => !["villain", "main_scheme"].includes(definition(p).type_code),
  );
  const set = (code) =>
    cards
      .filter((p) => definition(p).set_code === code)
      .map((p) => p.code)
      .sort();
  assert.equal(
    set("sinister_six").length,
    17,
    "The 17 encounter cards of the Sinister Six: " + set("sinister_six"),
  );
  assert.equal(
    set("guerrilla_tactics").length,
    7,
    "The 7 cards of Guerrilla Tactics: " + set("guerrilla_tactics"),
  );
  return cards
    .map((p) => p.id + ":" + (p.code === "27102b" ? "27102a" : p.code))
    .sort();
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
    if (sessionStorage.getItem("sinister-six-check")) return;
    sessionStorage.setItem("sinister-six-check", "1");
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
  throw Error("Native Sinister Six continuation did not finish");
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
    "The villains in play, the set-aside villains and the active counter survive reload",
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
async function activeVillainShown(s) {
  const active = s.sinisterSix.active;
  await page
    .getByRole("group", { name: nameOf(active) + ", the active villain" })
    .waitFor();
  for (const v of villainsOf(s).filter((v) => v.code !== active))
    await page
      .getByRole("group", { name: nameOf(v.code), exact: true })
      .waitFor();
  await page
    .getByText(
      `${villainsOf(s).length} in play · ${s.sinisterSix.setAside.length} set aside, ready to ambush`,
    )
    .waitFor();
}
async function thwartLight() {
  await page.getByRole("button", { name: /^Thwart Remove threat/ }).click();
  await page
    .locator("[role=dialog]")
    .last()
    .getByRole("button", { name: /^Light at the End/ })
    .first()
    .click();
}
try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "The Sinister Six", exact: true })
        .click();
      assert.equal(
        await page.getByRole("combobox", { name: /Modular encounter/ }).count(),
        0,
        "The Sinister Six uses no modular set",
      );
      await page.getByText(/No modular set: Guerrilla Tactics/).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("27094");
      await page.locator("#start-btn").click();
      const s = await begin();
      assert.equal(s.villainId, "sinister_six");
      const villains = villainsOf(s);
      assert.equal(villains.length, 2, "one more villain than players");
      assert.equal(s.sinisterSix.setAside.length, 4);
      assert.equal(
        s.sinisterSix.active,
        villains[0].code,
        "the first villain in activation order has the active counter",
      );
      assert.equal(s.villain.code, s.sinisterSix.active);
      assert.equal(s.scheme.code, "27100b");
      assert.equal(
        s.scheme.threat,
        2,
        "Sinister Synchronization: 2 per player",
      );
      const light = lightOf(s);
      assert.equal(light.code, "27102a");
      assert.equal(
        light.counters,
        20,
        "Light at the End: 10 and 10 per player",
      );
      await page.getByText("Escape: clear the Light at the End").waitFor();
      await page
        .getByText("Trap! · clearing it ambushes you and starts the Chase")
        .waitFor();
      await activeVillainShown(s);
      await artwork([...villains.map((v) => v.code), "27100b", "27102a"]);
      const owned = originals(s);
      await resumeExact();
      assert.deepEqual(originals(await saved()), owned);
      await audit("standalone-" + difficulty, width);
      checks.push({
        ...current,
        villains: villains.map((v) => v.code),
        physicalCards: owned.length,
        exactReload: true,
      });
    }
  }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "light-at-the-end-trap", width };
    let f = fixture("trap");
    let owned = originals(f.state);
    await open(width, f.state);
    await thwartLight();
    let s = await settle();
    let light = lightOf(s);
    assert.equal(light.id, f.id);
    assert.equal(light.code, "27102b", "Light at the End flips to the Chase");
    assert.equal(light.counters, f.chase, "the Chase: 5 and 10 per player");
    assert.ok(
      f.setAside.includes(s.sinisterSix.active),
      "Ambush!: a set-aside villain enters with the active counter",
    );
    assert.equal(villainsOf(s).length, f.inPlay.length + 1);
    assert.equal(s.villain.code, s.sinisterSix.active);
    await page.getByText("Chase! · clear it to escape and win").waitFor();
    await activeVillainShown(s);
    await artwork([s.sinisterSix.active, "27102b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("light-at-the-end-trap", width);
    checks.push({
      ...current,
      ambush: s.sinisterSix.active,
      exactReload: true,
    });

    current = { kind: "light-at-the-end-chase", width };
    f = fixture("chase");
    owned = originals(f.state);
    await open(width, f.state);
    await thwartLight();
    s = await settle();
    assert.equal(s.phase, "won", "clearing the Chase wins the game");
    assert.deepEqual(originals(s), owned);
    await audit("light-at-the-end-chase", width);
    checks.push({ ...current });

    current = { kind: "villain-defeated", width };
    f = fixture("defeat");
    owned = originals(f.state);
    await open(width, f.state);
    await page.getByRole("button", { name: /^Attack Deal damage/ }).click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: new RegExp("^" + nameOf(f.code)) })
      .first()
      .click();
    s = await settle();
    assert.ok(
      s.sinisterSix.setAside.includes(f.code),
      "the defeated villain is set aside",
    );
    assert.deepEqual(
      villainsOf(s).map((v) => v.code),
      [f.next],
      "the other villain stays in play",
    );
    assert.equal(
      s.sinisterSix.active,
      f.next,
      "the active counter moves to the next villain",
    );
    assert.equal(
      lightOf(s).counters,
      f.light - 4,
      "4 threat leaves Light at the End while a villain remains",
    );
    await activeVillainShown(s);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("villain-defeated", width);
    checks.push({ ...current, defeated: f.code, exactReload: true });
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
