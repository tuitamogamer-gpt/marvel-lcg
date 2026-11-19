import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/morlock/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.MORLOCK_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'morlock_siege',difficulty:'standard',seed:40070,pacing:'expert',heroes});",
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
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,s.morlockSiege.setAside]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function lead(number){const code=number+'a';const other=s.morlockSiege.villainDeck.find(p=>p.code===code);if(other)other.code=s.villain.code;s.villain.code=code;s.villain.hp=s.villain.maxHp=card(code).health*players;}",
      " const result={};",
      " if(kind==='rout'){result.next=s.morlockSiege.villainDeck[0].code;s.villain.hp=1;native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
      " else if(kind==='knock'){s.morlockSiege.knocks=2;native([{type:'msg:knock',actorId:'p1'}]);}",
      " else if(kind==='massacre'){s.morlockSiege.knocks=2;native([{type:'msg:knock',actorId:'p1'}]);const hide=s.morlockSiege.setAside.find(p=>p.code==='40080');result.hide=hide.id;}",
      " else if(kind==='marauder'){lead('40071');native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}",
      " else if(kind==='collar'){const p=take('40092');result.id=p.id;result.held=[];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='win'){const st=s.morlockSiege;st.routed.push(st.villainDeck.pop(),st.villainDeck.pop());s.villain.hp=1;native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
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
    ...(s.morlockSiege?.villainDeck || []),
    ...(s.morlockSiege?.routed || []),
    ...(s.morlockSiege?.setAside || []),
  ];
}
/** Every physical card of the Morlock Siege set (the main schemes are
 * tracked by the game itself) and the seven Marauders. */
function originals(s, held = []) {
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const set = all.filter(
    (p) =>
      definition(p).set_code === "morlock_siege" &&
      definition(p).type_code !== "main_scheme",
  );
  // Four Morlocks, Hide!, Routed and eleven encounter cards.
  assert.equal(
    set.length,
    17,
    `The Morlock Siege set: ${set.map((p) => p.code)}`,
  );
  const marauders = all.filter((p) => definition(p).set_code === "marauders");
  assert.equal(marauders.length, 7, "The seven Marauders");
  return [...set, ...marauders].map((p) => p.id).sort();
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
    if (sessionStorage.getItem("morlock-check")) return;
    sessionStorage.setItem("morlock-check", "1");
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
          .getByRole("button", { name: "Marauders", exact: true })
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
        await page.locator("#mission-seed").fill("40070");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "morlock_siege");
        assert.deepEqual(s.modules, ["military_grade", "mutant_slayers"]);
        const side = difficulty === "expert" ? "B" : "A";
        assert.ok(s.villain.code.endsWith(side.toLowerCase()));
        assert.equal(s.morlockSiege.villainDeck.length, 6);
        await page.getByText(`VILLAIN · ${side} · 0 OF 3 ROUTED`).waitFor();
        await page
          .getByText("6 Marauders in the villain deck", { exact: false })
          .waitFor();
        await page.getByText("0 of 3 knock counters").waitFor();
        const routed = difficulty === "expert" ? "40081b" : "40081a";
        await artwork([s.villain.code, routed]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "rout", width };
    let f = fixture("rout");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(s.morlockSiege.routed.length, 1);
    assert.equal(s.villain.code, f.next);
    await page.getByText("VILLAIN · A · 1 OF 3 ROUTED").waitFor();
    await page.getByText("1 of 3 Marauders routed", { exact: false }).waitFor();
    await artwork([f.next]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("rout", width);
    checks.push({ ...current });

    current = { kind: "knock", width };
    f = fixture("knock");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.scheme.code, "40078b");
    const morlocks = s.player.inPlay.filter((p) => p.code === "40079");
    assert.equal(morlocks.length, 2, "Two Morlocks in a solo game");
    assert.ok(morlocks.every((p) => p.tough));
    await page.getByText("Lose with no Morlock in play").waitFor();
    await artwork(["40078b", "40079"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("knock", width);
    checks.push({ ...current });

    current = { kind: "massacre-action", width };
    f = fixture("massacre");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    // Put Hide! in the encounter discard pile through a reload of the save.
    const saveWithHide = await saved();
    const i = saveWithHide.encounter.deck.findIndex((p) => p.id === f.hide);
    saveWithHide.encounter.discard.push(
      ...saveWithHide.encounter.deck.splice(i, 1),
    );
    await open(width, saveWithHide);
    await page
      .getByRole("button", {
        name: "Action · exhaust this Morlock · shuffle Hide! into the encounter deck",
      })
      .first()
      .click();
    s = await settle();
    assert.ok(s.encounter.deck.some((p) => p.id === f.hide));
    assert.ok(
      s.player.inPlay.some((p) => p.code === "40079" && p.exhausted),
      "A Morlock is exhausted",
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("massacre-action", width);
    checks.push({ ...current });

    current = { kind: "marauder", width };
    f = fixture("marauder");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "Give Blockbuster a tough status card",
        exact: true,
      })
      .waitFor();
    const hp = (await saved()).player.hp;
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "Blockbuster gets +2 ATK for this attack",
        exact: true,
      })
      .click();
    s = await settle();
    assert.ok(hp - s.player.hp >= 4, "Blockbuster attacks with +2 ATK");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("marauder", width);
    checks.push({ ...current });

    current = { kind: "collar", width };
    f = fixture("collar");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(
      s.attachments.find((p) => p.id === f.id)?.attachedTo,
      "hero:p1",
    );
    const before = s.player.hp;
    await page
      .getByRole("button", {
        name: "Action · take 3 damage · discard Inhibitor Collar",
        exact: true,
      })
      .click();
    s = await settle();
    assert.equal(s.player.hp, before - 3);
    assert.ok(!s.attachments.some((p) => p.id === f.id));
    await artwork(["40092"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("collar", width);
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
