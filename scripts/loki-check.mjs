import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/loki/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.LOKI_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'loki',difficulty:'standard',seed:21160,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.loki)throw Error('Original Loki setup incomplete');",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.sideSchemes]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function deckCard(code){const i=s.player.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing deck card '+code);return s.player.deck.splice(i,1)[0];}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Loki effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " if(s.villain.code==='21160')throw Error('Fixture expects a Loki who can take damage');",
      " const result={};",
      " if(kind==='defeat'){s.player.form='hero';s.encounter.discard.push(take('21167'));const b=take('21169');s.encounter.deck.unshift(b);delete s.encounter.knownTop;result.id=s.villain.id;result.scheme=b.id;native([{type:'damage',target:s.villain.id,amount:s.villain.hp}]);}",
      " else if(kind==='swap'){const war=s.sideSchemes.find(p=>p.code==='21167');result.id=s.villain.id;s.villain.hp-=7;result.hp=s.villain.hp;native([{type:'thwart',target:war.id,amount:war.counters}]);}",
      " else if(kind==='seduced'){s.player.form='alter';const f=take('21179');f.attachedTo='hero:'+s.activePlayerId;s.attachments.push(f);const e=deckCard('01088'),m=deckCard('01089');s.player.hand.push(e,m);result.cards=[card(e).name,card(m).name];result.id=f.id;}",
      " else if(kind==='staff'){s.player.form='hero';s.encounter.discard.push(take('21167'));const a=take('21170');a.attachedTo=s.villain.id;s.attachments.push(a);const e=deckCard('01088'),m=deckCard('01090');s.player.hand.push(e,m);result.cards=[card(e).name,card(m).name];result.id=a.id;}",
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
    ...s.loki.setAside,
    ...s.loki.stoneDeck,
    ...s.loki.stoneDiscard,
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
    if (sessionStorage.getItem("loki-check")) return;
    sessionStorage.setItem("loki-check", "1");
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
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: o.label, exact: true })
      .click();
  }
  throw Error("Native Loki continuation did not finish");
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
    "Loki, the set-aside Lokis and the Infinity Stones survive reload",
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
const LOKIS = ["21160", "21161", "21162", "21163", "21164"];
const stonesInPlay = (s) =>
  (s.environments || []).filter((p) => p.code >= "21130" && p.code <= "21135");
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "loki");
  assert.deepEqual(s.modules, ["enchantress", "frost_giants"]);
  const expert = difficulty === "expert";
  assert.ok(LOKIS.includes(s.villain.code), "a random Loki is in play");
  assert.equal(s.villain.hp, 20);
  assert.deepEqual(s.scheme, { code: "21165b", threat: 1, index: 0 });
  assert.equal(s.loki.victoryCondition, expert ? 3 : 2);
  assert.equal(s.loki.setAside.length, 4);
  assert.deepEqual(
    s.attachments
      .filter((p) => p.attachedTo === s.villain.id)
      .map((p) => p.code),
    ["21129"],
  );
  assert.equal(stonesInPlay(s).length, 1, "The first Stone is in play");
  assert.equal(s.loki.stoneDeck.length, 5);
  assert.deepEqual(
    s.sideSchemes.map((p) => [p.code, p.counters]),
    [["21167", 6]],
  );
  for (const [set, count] of [
    ["loki", 20],
    ["infinity_gauntlet", 7],
    ["enchantress", 5],
    ["frost_giants", 6],
  ])
    assert.equal(
      pieces(s).filter((p) => definition(p).set_code === set).length,
      count,
      set,
    );
  await page
    .getByLabel(
      `Lokis in the victory display: 0 of ${expert ? 3 : 2}; 4 set aside`,
    )
    .waitFor();
  await page.getByLabel("Infinity Stone deck: 5 cards, 0 discarded").waitFor();
  await page.getByText("INFINITY STONE", { exact: true }).first().waitFor();
  for (const code of [s.villain.code, "21165b", "21167"]) {
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
        .getByRole("button", { name: "Loki", exact: true })
        .click();
      for (const [slot, module] of [
        [1, "enchantress"],
        [2, "frost_giants"],
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
      await page.locator("#mission-seed").fill("21160");
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
    current = { kind: "loki-defeated", width };
    let f = fixture("defeat");
    const owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    let s = await settle();
    assert.notEqual(s.phase, "won");
    assert.ok(
      s.victoryDisplay.some((p) => p.id === f.id),
      "Victory 1",
    );
    assert.notEqual(s.villain.id, f.id, "another Loki takes his place");
    assert.equal(s.villain.hp, 20);
    assert.ok(
      s.sideSchemes.some((p) => p.id === f.scheme),
      "When Defeated reveals a side scheme",
    );
    assert.deepEqual(originals(s), owned);
    await page
      .getByLabel("Lokis in the victory display: 1 of 2; 3 set aside")
      .waitFor();
    await resumeExact();
    await audit("loki-defeated", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "loki-swap", width };
    f = fixture("swap");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.notEqual(s.villain.id, f.id, "Loki swaps");
    assert.equal(s.villain.hp, f.hp, "he keeps his damage");
    assert.ok(s.loki.setAside.some((p) => p.id === f.id));
    assert.equal(stonesInPlay(s).length, 2, "War in Asgard reveals a Stone");
    await page
      .getByLabel("Infinity Stone deck: 4 cards, 0 discarded")
      .waitFor();
    await audit("loki-swap", width);
    checks.push({ ...current });

    current = { kind: "seduced", width };
    f = fixture("seduced");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Spend energy and mental · discard Seduced",
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
    assert.ok(!s.attachments.some((p) => p.id === f.id), "Seduced discarded");
    await audit("seduced", width);
    checks.push({ ...current });

    current = { kind: "loki-staff", width };
    f = fixture("staff");
    await open(width, f.state);
    await page.getByRole("button", { name: /^Attack Deal damage/ }).click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "Spend energy and physical · discard Loki's Staff",
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
    assert.ok(!s.attachments.some((p) => p.id === f.id), "Staff discarded");
    await audit("loki-staff", width);
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
