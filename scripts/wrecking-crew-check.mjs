import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/wrecking-crew/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.WRECKING_CREW_VIEWPORTS || "1280,768,390,320")
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
      "import {crewVillain,crewScheme} from './src/game/wrecking-crew.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'the_wrecking_crew',difficulty:'standard',seed:7001,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.wreckingCrew)throw Error('Original Wrecking Crew setup incomplete');",
      " const wc=s.wreckingCrew;",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,...Object.values(wc.decks).flatMap(d=>[d.deck,d.discard])]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Wrecking Crew effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " const result={};",
      " if(kind==='outfocus'){const v=crewVillain(s,'piledriver');result.id=v.id;result.hp=v.hp;result.heroHp=s.player.hp;}",
      " else if(kind==='breakout'){crewScheme(s,'thunderball').counters=8;native([{type:'villainStepOne'}]);}",
      " else if(kind==='hit'){const d=crewScheme(s,'wrecker');d.counters=9;result.id=d.id;result.heroHp=s.player.hp;native([{type:'threat',target:d.id,amount:1}]);}",
      " else if(kind==='hostage'){const h=take('07036');h.attachedTo=crewScheme(s,'wrecker').id;s.attachments.push(h);s.encounter.deck.unshift(take('07013'));delete s.encounter.knownTop;result.id=h.id;result.heroHp=s.player.hp;}",
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
const KEYS = ["wrecker", "thunderball", "piledriver", "bulldozer"];
const NAMES = {
  wrecker: "Wrecker",
  thunderball: "Thunderball",
  piledriver: "Piledriver",
  bulldozer: "Bulldozer",
};
const SCHEMES = {
  wrecker: "07004",
  thunderball: "07019",
  piledriver: "07034",
  bulldozer: "07048",
};
const villainOf = (s, key) =>
  s.wreckingCrew.focus === key ? s.villain : s.wreckingCrew.bench[key];
const schemeOf = (s, key) => s.sideSchemes.find((p) => p.code === SCHEMES[key]);
function pieces(s) {
  const wc = s.wreckingCrew;
  return [
    s.villain,
    ...KEYS.map((key) => wc.bench[key]).filter(Boolean),
    ...KEYS.flatMap((key) => [
      ...(wc.decks[key]?.deck || []),
      ...(wc.decks[key]?.discard || []),
    ]),
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
  assert.equal(
    all.filter((p) => definition(p).pack_code === "twc").length,
    68,
    "Four villains, four side schemes and sixty encounter cards",
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
    if (sessionStorage.getItem("wrecking-crew-check")) return;
    sessionStorage.setItem("wrecking-crew-check", "1");
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
      (s.prompt.options.length === 1 || s.prompt.title === "Forced responses"
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    // A defense declaration is a decision panel, not a dialog.
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
  throw Error("Native Wrecking Crew continuation did not finish");
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
    "The four villains, their decks and the active counter survive reload",
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
  assert.equal(s.villainId, "the_wrecking_crew");
  assert.deepEqual(s.modules, []);
  const version = difficulty === "expert" ? 1 : 0;
  const codes = {
    wrecker: ["07002", "07003"],
    thunderball: ["07017", "07018"],
    piledriver: ["07032", "07033"],
    bulldozer: ["07046", "07047"],
  };
  for (const key of KEYS)
    assert.equal(villainOf(s, key).code, codes[key][version], key);
  assert.equal(s.wreckingCrew.active, "wrecker");
  assert.deepEqual(
    KEYS.map((key) => schemeOf(s, key).counters),
    [6, 5, 3, 4],
  );
  assert.deepEqual(s.scheme, { code: "07001b", threat: 0, index: 0 });
  await page.getByText("Defeat all four villains · 0 of 4 defeated").waitFor();
  await page
    .getByRole("group", { name: "Wrecker, the active villain" })
    .waitFor();
  for (const key of KEYS.slice(1))
    await page.getByRole("group", { name: NAMES[key], exact: true }).waitFor();
  await page
    .getByLabel("Wrecker's encounter deck: 15 cards, 0 in the discard pile")
    .waitFor();
  await page.getByText("WRECKER'S SIDE SCHEME", { exact: true }).waitFor();
  await page.getByText("ENCOUNTER DECK · WRECKER", { exact: true }).waitFor();
  for (const code of [villainOf(s, "wrecker").code, "07001b", "07004"]) {
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
        .getByRole("button", { name: "The Wrecking Crew", exact: true })
        .click();
      assert.equal(
        await page.getByRole("combobox", { name: /Modular encounter/ }).count(),
        0,
        "The Wrecking Crew uses no modular sets",
      );
      await page.getByText(/No modular sets: Wrecker, Thunderball/).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("7001");
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
    current = { kind: "attack-out-of-focus", width };
    let f = fixture("outfocus");
    const owned = originals(f.state);
    await open(width, f.state);
    await page.getByRole("button", { name: /^Attack Deal damage/ }).click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: /^Piledriver/ })
      .first()
      .click();
    let s = await settle();
    assert.equal(villainOf(s, "piledriver").hp, f.hp - 2, "Piledriver takes 2");
    assert.equal(s.player.hp, f.heroHp - 1, "Piledriver retaliates");
    assert.equal(s.villain.code, villainOf(s, "wrecker").code);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("attack-out-of-focus", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "breakout", width };
    f = fixture("breakout");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(s.wreckingCrew.active, "thunderball");
    assert.equal(s.scheme.threat, 1);
    await page
      .getByRole("group", { name: "Thunderball, the active villain" })
      .waitFor();
    await page
      .getByText("ENCOUNTER DECK · THUNDERBALL", { exact: true })
      .waitFor();
    await audit("breakout", width);
    checks.push({ ...current });

    current = { kind: "hard-hitter", width };
    f = fixture("hit");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(schemeOf(s, "wrecker").counters, 3, "all but 3 removed");
    assert.equal(s.player.hp, f.heroHp - 2, "2 damage to each character");
    await audit("hard-hitter", width);
    checks.push({ ...current });

    current = { kind: "held-hostage", width };
    f = fixture("hostage");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Wrecker attacks you · discard Held Hostage",
        exact: true,
      })
      .click();
    s = await settle();
    assert.ok(
      !s.attachments.some((p) => p.id === f.id),
      "Held Hostage discarded",
    );
    assert.equal(s.player.hp, f.heroHp - 5, "Wrecker's undefended attack");
    await audit("held-hostage", width);
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
