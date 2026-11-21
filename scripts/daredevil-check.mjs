import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// Daredevil (Fear No Evil) through the public UI: the faceup Sense deck and
// Superhuman Senses, Contingency Planning's tucked upgrade, and the board
// with his signature cards, at four widths, with accessibility and layout
// audits and exact reloads. Card rules are covered by the engine tests.
const output = process.env.OUTPUT_DIR || "output/daredevil/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.DAREDEVIL_VIEWPORTS || "1280,768,390,320")
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
      "import {newGame,dispatch,makePiece} from './src/game/engine.ts';",
      "import {syncSeat} from './src/game/team.ts';",
      "export function fixture(kind){",
      " let s=newGame({heroId:'daredevil',aspect:'justice',villainId:'rhino',difficulty:'standard',seed:60001,pacing:'expert',heroes:[{heroId:'daredevil',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|done)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " s.player.form='hero';s.player.deck.push(...s.player.hand.splice(0));s.scheme.threat=2;",
      " s.villain.tough=false;s.villain.toughCards=0;",
      " const put=(code,zone)=>{const p=makePiece(s,code);zone.push(p);return p;};",
      " const minion=()=>{const p=makePiece(s,'01103');delete p.ownerId;p.tough=false;p.engagedWith=s.activePlayerId;s.minions.push(p);return p;};",
      " const sense=(code)=>{const d=s.player.senseDeck;const i=d.findIndex(p=>p.code===code);return d.splice(i,1)[0];};",
      " const result={};",
      " if(kind==='senses'){result.minion=minion().id;const d=s.player.senseDeck;d.unshift(sense('60005'));result.top=d[0].id;result.resource=put('60057',s.player.hand).id;}",
      " else if(kind==='contingency'){result.minion=minion().id;const plan=put('60030',s.player.inPlay);const legal=makePiece(s,'60026');plan.storedCards=[legal];result.legal=legal.id;result.resource=put('60057',s.player.hand).id;}",
      " else if(kind==='board'){const m=minion();const radar=sense('60005');radar.attachedTo=m.id;s.player.inPlay.push(radar);const taste=sense('60006');taste.attachedTo='main:'+s.scheme.code;s.player.inPlay.push(taste);put('60017',s.player.inPlay);put('60016',s.player.inPlay);put('60018',s.player.inPlay);const o=makePiece(s,'60032');delete o.ownerId;o.dealtTo=s.activePlayerId;s.player.inPlay.push(o);const f=makePiece(s,'60012');f.counters=4;f.playerSideSchemeController=s.activePlayerId;s.sideSchemes.push(f);put('60007',s.player.inPlay);}",
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
const { fixture } = await import(pathToFileURL(fixturePath).href);
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const browser = await chromium.launch({ headless: true });
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
let context, page;
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("daredevil-check")) return;
    sessionStorage.setItem("daredevil-check", "1");
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
    localStorage.setItem("champions.save.v1", JSON.stringify(state));
  }, state);
  await page.goto(url);
  await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function until(test, what) {
  for (let n = 0; n < 100; n++) {
    const s = await saved();
    if (test(s)) return s;
    await page.waitForTimeout(50);
  }
  throw Error("Timed out waiting for " + what);
}
async function choice(id) {
  const s = await saved();
  assert.equal(s.prompt?.kind, "choice", JSON.stringify(s.prompt));
  const index = s.prompt.options.findIndex((o) => o.id === id);
  assert.ok(index >= 0, `${s.prompt.title}: missing ${id}`);
  await page.locator(".decision-option").nth(index).click();
  return until((next) => JSON.stringify(next) !== JSON.stringify(s), id);
}
async function pay() {
  const s = await saved();
  assert.equal(s.prompt?.kind, "payment", JSON.stringify(s.prompt));
  await page
    .getByRole("button", { name: "Suggest resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  return until((next) => next.prompt?.kind !== "payment", "payment");
}
async function resumeExact() {
  const before = await saved();
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(await saved(), before, "The mission survives reload");
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

try {
  for (const width of widths) {
    // The Sense deck: Superhuman Senses plays its top card, paying its cost,
    // onto the chosen enemy; the deck keeps the other four in order.
    let data = fixture("senses");
    await open(width, data.state);
    const area = page.locator('section[aria-label="Sense deck"]');
    await area.waitFor();
    assert.ok((await area.innerText()).includes("SENSE DECK"));
    assert.ok((await area.innerText()).includes("Radar Sense"));
    await audit("sense-deck", width);
    const order = (await saved()).player.senseDeck.slice(1).map((p) => p.id);
    await page
      .getByRole("button", { name: "Superhuman Senses: play Radar Sense" })
      .click();
    let s = await pay();
    if (s.prompt?.kind === "choice") s = await choice(data.minion);
    s = await until((next) => !next.prompt, "the Sense upgrade to attach");
    const radar = s.player.inPlay.find((p) => p.id === data.top);
    assert.equal(radar?.attachedTo, data.minion, "Radar Sense attaches");
    assert.deepEqual(
      s.player.senseDeck.map((p) => p.id),
      order,
      "The Sense deck keeps its order",
    );
    assert.ok(s.player.discard.some((p) => p.id === data.resource));
    await resumeExact();
    await audit("sense-played", width);
    checks.push(`${width}: Superhuman Senses plays the top Sense upgrade`);

    // Contingency Planning: the tucked upgrade plays as if from hand.
    data = fixture("contingency");
    await open(width, data.state);
    const tucked = page.locator(
      'section[aria-label="Contingency Planning tucked upgrade"]',
    );
    await tucked.waitFor();
    assert.ok((await tucked.innerText()).includes("Legal Trouble"));
    await audit("contingency", width);
    await page
      .getByRole("button", {
        name: "Play from Contingency Planning: Legal Trouble",
      })
      .click();
    s = await saved();
    if (s.prompt?.kind === "payment") s = await pay();
    s = await until((next) => !next.prompt, "Legal Trouble to attach");
    assert.equal(
      s.player.inPlay.find((p) => p.id === data.legal)?.attachedTo,
      data.minion,
    );
    assert.equal(await tucked.count(), 0, "Nothing remains tucked");
    await resumeExact();
    checks.push(`${width}: Contingency Planning plays its tucked upgrade`);

    // The board: Sense upgrades on an enemy and the main scheme, Focus the
    // Senses, Sensory Overload and Daredevil's upgrades and supports.
    data = fixture("board");
    await open(width, data.state);
    await page.locator('section[aria-label="Sense deck"]').waitFor();
    for (const name of [
      "Focus the Senses",
      "Sensory Overload",
      "Radar Sense",
      "Superior Taste",
      "Elektra",
    ])
      assert.ok(
        (await page
          .locator(
            `[aria-label*="${name}"], [alt*="${name}"], [title*="${name}"]`,
          )
          .count()) +
          (await page.getByText(name).count()) >
          0,
        `${name} is shown on the board`,
      );
    await audit("board", width);
    await resumeExact();
    checks.push(`${width}: the Daredevil board passes its audits`);
  }
  assert.deepEqual(errors, [], "No page errors");
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ checks, audits, layouts }, null, 2),
  );
  console.log(
    `Daredevil browser check: ${checks.length} flows, ${audits.length} accessibility audits, ${layouts.length} layout checks.`,
  );
} catch (error) {
  await writeFile(
    resolve(output, "failure.txt"),
    String(error?.stack || error),
  );
  if (page)
    await page.screenshot({
      path: resolve(output, "failure.png"),
      fullPage: true,
    });
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
