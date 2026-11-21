import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

// Echo (Fear No Evil) through the public UI: the events tucked under Echo
// and Photographic Reflexes, the Starting offer before the opening hand, and
// the board with Raised by the Kingpin and Kingpin's nemesis set, at four
// widths, with accessibility and layout audits and exact reloads. Card rules
// are covered by the engine tests.
const output = process.env.OUTPUT_DIR || "output/echo/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.ECHO_VIEWPORTS || "1280,768,390,320")
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
      " const config={heroId:'echo',aspect:'protection',villainId:'rhino',difficulty:'standard',seed:60037,pacing:'expert',heroes:[{heroId:'echo',aspect:'protection'}]};",
      " let s=newGame(config);",
      " if(kind==='starting'){if(s.prompt?.title!=='Innate Reflexes')throw Error('No Starting offer');return{state:s};}",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|done)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " s.player.form='hero';s.player.deck.push(...s.player.hand.splice(0));s.scheme.threat=4;",
      " s.villain.tough=false;s.villain.toughCards=0;s.villain.hp=20;",
      " const put=(code,zone)=>{const p=makePiece(s,code);zone.push(p);return p;};",
      " const enemy=(code)=>{const p=makePiece(s,code);delete p.ownerId;p.tough=false;p.engagedWith=s.activePlayerId;s.minions.push(p);return p;};",
      " const result={};",
      " if(kind==='tucked'){const harm=makePiece(s,'60050');const attention=makePiece(s,'60049');s.player.echoTucked=[harm,attention];result.harm=harm.id;result.attention=attention.id;result.reflexes=put('60040a',s.player.hand).id;result.resource=put('60059',s.player.hand).id;}",
      " else if(kind==='board'){s.player.echoTucked=[makePiece(s,'60050'),makePiece(s,'60048')];const raised=makePiece(s,'60060');delete raised.ownerId;raised.counters=2;raised.dealtTo=s.activePlayerId;s.player.inPlay.push(raised);enemy('60061');enemy('60063');const mm=makePiece(s,'60062');delete mm.ownerId;mm.counters=2;s.sideSchemes.push(mm);for(const code of ['60045','60046','60043','60042','60047','60053'])put(code,s.player.inPlay);put('60040b',s.player.hand);}",
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
    if (sessionStorage.getItem("echo-check")) return;
    sessionStorage.setItem("echo-check", "1");
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
    // The tucked events: Photographic Reflexes plays one as if from hand for
    // 2 less; a reaction event waits for its window.
    let data = fixture("tucked");
    await open(width, data.state);
    const area = page.locator('section[aria-label="Events tucked under Echo"]');
    await area.waitFor();
    assert.ok((await area.innerText()).includes("TUCKED UNDER ECHO"));
    assert.ok((await area.innerText()).includes("In Harm's Way"));
    await audit("tucked", width);
    const attention = page.getByRole("button", {
      name: "Photographic Reflexes: play Get Their Attention",
    });
    assert.equal(await attention.isDisabled(), true, "A reaction event waits");
    await page
      .getByRole("button", {
        name: "Photographic Reflexes: play In Harm's Way",
      })
      .click();
    let s = await saved();
    if (s.prompt?.kind === "payment") s = await pay();
    s = await until((next) => !next.prompt, "In Harm's Way to resolve");
    assert.ok(s.player.discard.some((p) => p.id === data.harm));
    assert.ok(s.player.discard.some((p) => p.id === data.reflexes));
    assert.deepEqual(
      (s.player.echoTucked || []).map((p) => p.id),
      [data.attention],
      "One tucked event remains",
    );
    assert.equal(s.villain.hp, 18, "X is Echo's DEF");
    await resumeExact();
    await audit("tucked-played", width);
    checks.push(`${width}: Photographic Reflexes plays a tucked event`);

    // Starting: Innate Reflexes is offered before the opening hand.
    data = fixture("starting");
    await open(width, data.state);
    await page.locator(".decision-option").first().waitFor();
    await audit("starting", width);
    s = await choice("yes");
    s = await until((next) => next.player.hand.length > 0, "the opening hand");
    assert.equal(s.player.hand[0].code, "60038", "Innate Reflexes comes first");
    assert.equal(s.player.hand.length, 6, "It counts against the hand size");
    await resumeExact();
    checks.push(`${width}: Starting adds Innate Reflexes to the opening hand`);

    // The board: Raised by the Kingpin, Kingpin, his Henchman, Master
    // Manipulator, Echo's upgrades and supports and her tucked events.
    data = fixture("board");
    await open(width, data.state);
    await page
      .locator('section[aria-label="Events tucked under Echo"]')
      .waitFor();
    for (const name of [
      "Raised by the Kingpin",
      "Kingpin",
      "Master Manipulator",
      "Echo's Katana",
      "Improvisation",
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
    checks.push(`${width}: the Echo board passes its audits`);
  }
  assert.deepEqual(errors, [], "No page errors");
  await writeFile(
    resolve(output, "report.json"),
    JSON.stringify({ checks, audits, layouts }, null, 2),
  );
  console.log(
    `Echo browser check: ${checks.length} flows, ${audits.length} accessibility audits, ${layouts.length} layout checks.`,
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
