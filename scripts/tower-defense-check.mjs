import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/tower-defense/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.TOWER_DEFENSE_VIEWPORTS || "1280,768,390,320")
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
      "import {towerVillain} from './src/game/tower-defense.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'tower_defense',difficulty:'standard',seed:21092,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<100;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|tower)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review||!s.towerDefense)throw Error('Original Tower Defense setup incomplete');",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.minions]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function deckCard(code){const i=s.player.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing deck card '+code);return s.player.deck.splice(i,1)[0];}",
      " function native(effects){s.prompt={kind:'choice',title:'Original Tower Defense effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function stack(...codes){for(const code of codes.reverse())s.encounter.deck.unshift(take(code));delete s.encounter.knownTop;}",
      " for(const m of [...s.minions]){s.minions=s.minions.filter(q=>q.id!==m.id);delete m.engagedWith;s.encounter.deck.push(m);}",
      " s.environments.find(p=>p.code==='21100a').damage=0;",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " const result={};",
      " if(kind==='attack'){s.player.form='hero';result.id=towerVillain(s,'proxima').id;result.hp=towerVillain(s,'proxima').hp;}",
      " else if(kind==='focus'){s.player.form='alter';stack('01186','21109');}",
      " else if(kind==='tower'){native([{type:'tower:damage',amount:9}]);}",
      " else if(kind==='spear'){s.player.form='hero';const e=deckCard('01088'),m=deckCard('01089');s.player.hand.push(e,m);result.cards=[card(e).name,card(m).name];const p=take('21103');p.attachedTo=towerVillain(s,'proxima').id;s.attachments.push(p);result.id=p.id;result.hp=s.player.hp;}",
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
const villain = (s, key) =>
  s.towerDefense.focus === key ? s.villain : s.towerDefense.other.villain;
const scheme = (s, key) =>
  s.towerDefense.focus === key ? s.scheme : s.towerDefense.other.scheme;
function pieces(s) {
  const td = s.towerDefense;
  return [
    s.villain,
    td.other.villain,
    td.mains.proxima,
    td.mains.corvus,
    ...td.villainDecks.proxima,
    ...td.villainDecks.corvus,
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
    if (sessionStorage.getItem("tower-defense-check")) return;
    sessionStorage.setItem("tower-defense-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no|tower)$/.test(o.id),
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
  throw Error("Native Tower Defense continuation did not finish");
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
    "Both villains, both main schemes and Avengers Tower survive reload",
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
  assert.equal(s.villainId, "tower_defense");
  assert.deepEqual(s.modules, ["armies_of_titan"]);
  const stage = difficulty === "expert" ? 1 : 0;
  assert.equal(s.towerDefense.active, "corvus");
  assert.equal(villain(s, "proxima").code, ["21092", "21093"][stage]);
  assert.equal(villain(s, "corvus").code, ["21095", "21096"][stage]);
  assert.equal(villain(s, "proxima").hp, [9, 12][stage]);
  assert.equal(villain(s, "corvus").hp, [8, 11][stage]);
  assert.equal(scheme(s, "proxima").code, "21098b");
  assert.equal(scheme(s, "corvus").code, "21099b");
  assert.equal(scheme(s, "proxima").threat, 1);
  assert.equal(scheme(s, "corvus").threat, 1);
  const tower = s.environments.find((p) => p.code === "21100a");
  assert.equal(tower.damage, 1, "The Besieger's price damaged the Tower");
  assert.equal(
    s.attachments.find((p) => p.code === "21101").attachedTo,
    "main:21099b",
  );
  assert.deepEqual(
    s.minions.map((p) => [p.code, p.engagedWith]),
    [["21102", s.activePlayerId]],
  );
  for (const [set, count] of [
    ["tower_defense", 25],
    ["armies_of_titan", 6],
  ])
    assert.equal(
      pieces(s).filter((p) => definition(p).set_code === set).length,
      count,
      set,
    );
  await page
    .getByRole("group", { name: "Corvus Glaive, the active villain" })
    .waitFor();
  await page
    .getByRole("group", { name: "Proxima Midnight", exact: true })
    .waitFor();
  await page.getByLabel("Avengers Tower damage: 1 of 9").waitFor();
  await page
    .getByRole("button", {
      name: "Focused Defense is attached to The Armies of Thanos. Inspect Focused Defense",
    })
    .waitFor();
  for (const code of [
    villain(s, "proxima").code,
    villain(s, "corvus").code,
    "21098b",
    "21099b",
  ]) {
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
        .getByRole("button", { name: "Tower Defense", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "armies_of_titan",
      );
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("21092");
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
    current = { kind: "attack-the-other-villain", width };
    let f = fixture("attack");
    const owned = originals(f.state);
    await open(width, f.state);
    await page.getByRole("button", { name: /^Attack Deal damage/ }).click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: "Proxima Midnight", exact: true })
      .click();
    let s = await settle();
    assert.equal(villain(s, "proxima").hp, f.hp - 2, "Proxima takes the hit");
    assert.equal(villain(s, "corvus").hp, 8, "Corvus is untouched");
    assert.equal(s.towerDefense.focus, s.towerDefense.active, "Back at rest");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("attack-the-other-villain", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "focused-defense", width };
    f = fixture("focus");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "End hero phase", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Begin villain phase", exact: true })
      .click();
    s = await settle();
    assert.equal(s.towerDefense.active, "proxima", "Focused Defense moved");
    assert.equal(
      s.attachments.find((p) => p.code === "21101").attachedTo,
      "main:21098b",
    );
    assert.equal(scheme(s, "proxima").threat, 3, "Only Proxima schemed");
    assert.equal(scheme(s, "corvus").threat, 2);
    await page
      .getByRole("group", { name: "Proxima Midnight, the active villain" })
      .waitFor();
    await page
      .getByRole("button", {
        name: "Focused Defense is attached to Under Siege. Inspect Focused Defense",
      })
      .waitFor();
    await audit("focused-defense", width);
    checks.push({ ...current });

    current = { kind: "tower-flips", width };
    f = fixture("tower");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    const tower = s.environments.find((p) => p.code === "21100b");
    assert.ok(tower, "Avengers Tower flipped to its Damaged side");
    assert.equal(tower.damage, 0);
    await page.getByText("ENVIRONMENT · DAMAGED").waitFor();
    await page.getByLabel("Avengers Tower damage: 0 of 9").waitFor();
    await audit("tower-flips", width);
    checks.push({ ...current });

    current = { kind: "proximas-spear", width };
    f = fixture("spear");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Take 1 damage, spend energy and mental · discard Proxima's Spear",
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
    assert.equal(s.player.hp, f.hp - 1, "Taking 1 damage is part of the cost");
    await audit("proximas-spear", width);
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
