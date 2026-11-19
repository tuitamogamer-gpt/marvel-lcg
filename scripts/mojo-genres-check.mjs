import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/mojo-genres/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.MOJO_GENRES_VIEWPORTS || "1280,768,390,320")
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
      " const module={dial:'crime',csi:'crime',case:'crime',dragon:'fantasy',bounty:'western'}[kind];",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'rhino',difficulty:'standard',seed:39035,pacing:'expert',module,heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const result={module};",
      " function single(code){const p=take(code);result.id=p.id;result.held=[{id:p.id,code:p.code}];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      // The Show surges: Advance from the Standard set is its next card.
      " if(kind==='dial'){const advance=take('01186');s.encounter.deck.unshift(advance);delete s.encounter.knownTop;single('39035');}",
      " else if(kind==='csi'){const names=new Set();const m=s.player.deck.filter(c=>{const d=card(c);if(d.resource_mental!==1||d.resource_wild||names.has(d.name))return false;names.add(d.name);return true;}).slice(0,2);s.player.deck=s.player.deck.filter(c=>!m.includes(c));s.player.hand.push(...m);result.cards=m.map(c=>card(c).name);single('39037');}",
      " else if(kind==='case')single('39036');",
      " else if(kind==='dragon')single('39042');",
      " else if(kind==='bounty'){const shark=take('39068'),bounty=take('39067');result.id=bounty.id;result.shark=shark.id;result.held=[{id:shark.id,code:shark.code},{id:bounty.id,code:bounty.code}];native([{type:'reveal',piece:shark,actorId:'p1'},{type:'reveal',piece:bounty,actorId:'p1'}]);}",
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
  ];
}
/** Every physical card of the chosen modular set. */
function originals(s, module, held = []) {
  // A card revealed by a native effect is held by that effect, not a zone.
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const set = all.filter((p) => definition(p).set_code === module);
  assert.equal(
    set.length,
    6,
    `The 6 cards of ${module}: ${set.map((p) => p.code)}`,
  );
  return set.map((p) => p.id + ":" + p.code).sort();
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
    if (sessionStorage.getItem("mojo-genres-check")) return;
    sessionStorage.setItem("mojo-genres-check", "1");
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
  throw Error("Native encounter continuation did not finish");
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
    "The modular encounter cards survive reload",
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
try {
  for (const width of widths) {
    for (const module of ["crime", "fantasy", "western"])
      for (const difficulty of ["standard", "expert"]) {
        current = { kind: "standalone-setup", width, module, difficulty };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Rhino", exact: true })
          .click();
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .selectOption(module);
        await page
          .locator(".setting-line")
          .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
          .getByRole("button", {
            name: difficulty === "expert" ? "Expert" : "Standard",
            exact: true,
          })
          .click();
        await page.locator("#mission-seed").fill("39035");
        await page.locator("#start-btn").click();
        const s = await begin();
        assert.equal(s.villainId, "rhino");
        assert.deepEqual(s.modules, [module]);
        const owned = originals(s, module);
        await resumeExact();
        assert.deepEqual(originals(await saved(), module), owned);
        await audit(`standalone-${module}-${difficulty}`, width);
        checks.push({
          ...current,
          physicalCards: owned.length,
          exactReload: true,
        });
      }
  }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "dial-m-for-mojo", width };
    let f = fixture("dial");
    let owned = originals(f.state, f.module, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    let s = await settle();
    assert.ok(
      s.environments.some((p) => p.id === f.id),
      "Dial M for Mojo stays in play as a Setting",
    );
    assert.ok(
      s.encounter.dealt.some((p) => p.code === "01186"),
      "Revealed from the encounter deck, its surge deals you Advance facedown",
    );
    assert.equal(await page.getByText("SETTING · SHOW").count(), 1);
    await page
      .getByText("friendly characters get +1 THW", { exact: false })
      .first()
      .waitFor();
    await artwork(["39035"]);
    assert.deepEqual(originals(s, f.module), owned);
    await resumeExact();
    await audit("dial-m-for-mojo", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "crime-scene-investigation", width };
    f = fixture("csi");
    owned = originals(f.state, f.module, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    const scene = s.sideSchemes.find((p) => p.id === f.id);
    assert.equal(scene?.counters, 6, "Hinder 1 per player");
    await page
      .getByText("Threat cannot be removed from other schemes")
      .first()
      .waitFor();
    await page
      .getByRole("button", {
        name: "Hero Action · spend X mental resources · remove X threat",
        exact: true,
      })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "X = 2 · spend 2 mental · remove 2 threat",
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
    assert.equal(
      s.sideSchemes.find((p) => p.id === f.id)?.counters,
      4,
      "X = 2 removes 2 threat",
    );
    assert.equal(s.player.hand.length, 0, "Both mental cards are spent");
    await artwork(["39037"]);
    assert.deepEqual(originals(s, f.module), owned);
    await resumeExact();
    await audit("crime-scene-investigation", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "build-the-case", width };
    f = fixture("case");
    owned = originals(f.state, f.module, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.ok(
      s.player.inPlay.some((p) => p.id === f.id),
      "Build the Case stays in your play area",
    );
    await artwork(["39036"]);
    assert.deepEqual(originals(s, f.module), owned);
    await resumeExact();
    await audit("build-the-case", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "dragon", width };
    f = fixture("dragon");
    owned = originals(f.state, f.module, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    const dragon = s.minions.find((p) => p.id === f.id);
    assert.equal(dragon?.engagedWith, "p1", "The Dragon engages you");
    assert.ok(dragon.tough, "Toughness");
    await artwork(["39042"]);
    assert.deepEqual(originals(s, f.module), owned);
    await resumeExact();
    await audit("dragon", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "dead-or-alive", width };
    f = fixture("bounty");
    owned = originals(f.state, f.module, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(
      s.attachments.find((p) => p.id === f.id)?.attachedTo,
      f.shark,
      "Dead or Alive attaches to the minion with the highest printed hit points",
    );
    await artwork(["39068", "39067"]);
    assert.deepEqual(originals(s, f.module), owned);
    await resumeExact();
    await audit("dead-or-alive", width);
    checks.push({ ...current, exactReload: true });
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
