import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/venom-villain/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.VENOM_VIEWPORTS || "1280,768,390,320")
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
      "import {newGame,dispatch,paymentSources} from './src/game/engine.ts';",
      "import {card} from './src/game/cards.ts';",
      "import {syncSeat} from './src/game/team.ts';",
      "import {venomStoredPieces} from './src/game/venom-villain.ts';",
      "export const definition=p=>card(p);",
      "export const stored=s=>venomStoredPieces(s);",
      "export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};",
      "export function fixture(kind){",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'venom',difficulty:'standard',seed:27073,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;}}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " function native(effects){s.prompt={kind:'choice',title:'Original Venom effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function resource(kind){const i=s.player.deck.findIndex(p=>card(p)['resource_'+kind]&&!card(p).resource_wild);if(i<0)throw Error('Missing '+kind+' resource');return s.player.deck.splice(i,1)[0];}",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " s.villain.tough=false;",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " const result={};",
      " const tower=(s.environments||[]).find(p=>p.code==='27077a');",
      " const hit={type:'damage',target:s.villain.id,amount:2,attack:true,source:'hero',actorId:'p1'};",
      " if(kind==='chime'||kind==='vengeance'){result.hp=s.villain.hp;native([hit]);}",
      " else if(kind==='ringing'){tower.code='27077b';tower.counters=3;const i=s.encounter.deck.findIndex(p=>card(p).boost===1&&!card(p).boost_star);s.encounter.deck.unshift(...s.encounter.deck.splice(i,1));delete s.encounter.knownTop;result.hp=s.player.hp;native([{type:'enemyAttack',id:s.villain.id,actorId:'p1'}]);}",
      " else if(kind==='weapons'){const w=take('27164');w.attachedTo=s.villain.id;s.attachments.push(w);const paid=[resource('mental'),resource('physical'),resource('energy')];s.player.hand.push(...paid);result.id=w.id;result.paid=paid.map(p=>p.id);}",
      " else if(kind==='webbed'){const w=take('27166');w.attachedTo='hero:p1';s.attachments.push(w);result.id=w.id;result.hp=s.villain.hp;native([hit]);}",
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
const { fixture, definition, payment, stored } = await import(
  pathToFileURL(fixturePath).href
);
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
const tower = (s) =>
  (s.environments || []).find((p) => ["27077a", "27077b"].includes(p.code));
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
    // The facedown boost cards on each identity.
    ...stored(s),
  ];
}
function originals(s, held = []) {
  // A card revealed by a native effect is held by that effect, not a zone.
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const set = (code) =>
    all
      .filter(
        (p) =>
          definition(p).set_code === code &&
          !["villain", "main_scheme"].includes(definition(p).type_code),
      )
      .map((p) => p.code)
      .sort();
  // The Bell Tower is one physical card whatever side is faceup.
  assert.equal(
    set("venom").length,
    10,
    "The 10 encounter cards of Venom: " + set("venom"),
  );
  assert.equal(
    set("symbiotic_strength").length,
    9,
    "The 9 cards of Symbiotic Strength: " + set("symbiotic_strength"),
  );
  assert.equal(
    set("down_to_earth").length,
    7,
    "The 7 cards of Down to Earth: " + set("down_to_earth"),
  );
  return all
    .map((p) => p.id + ":" + (p.code === "27077b" ? "27077a" : p.code))
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
    if (sessionStorage.getItem("venom-villain-check")) return;
    sessionStorage.setItem("venom-villain-check", "1");
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
  throw Error("Native Venom continuation did not finish");
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
    "The Bell Tower, its chime counters and the facedown boost cards survive reload",
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
async function counterText(count) {
  await page
    .locator(".environment-counter")
    .filter({
      hasText: new RegExp(
        "^\\s*" + count + " chime counter" + (count === 1 ? "" : "s") + "\\s*$",
      ),
    })
    .first()
    .waitFor();
}
async function pay(ids) {
  for (const id of ids) {
    const state = await saved();
    const sources = payment(state);
    const source = sources.find((p) => p.id === id);
    assert.ok(source, "Original payment source " + id);
    const index = sources
      .filter((p) => p.kind === source.kind)
      .findIndex((p) => p.id === id);
    await page
      .locator(`.payment-source-group.${source.kind}-sources .payment-source`)
      .nth(index)
      .click();
  }
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
}
try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "Venom", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "down_to_earth",
      );
      await page.getByText(/Symbiotic Strength is always included/).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("27073");
      await page.locator("#start-btn").click();
      const s = await begin();
      assert.equal(s.villainId, "venom");
      assert.deepEqual(s.modules, ["down_to_earth"]);
      assert.equal(s.villain.code, difficulty === "expert" ? "27074" : "27073");
      assert.equal(s.villain.tough, true, "Venom enters play tough");
      assert.equal(s.scheme.code, "27076b");
      assert.equal(s.scheme.threat, 2, '"Leave Us Alone!": 2 per player');
      assert.deepEqual(
        { code: tower(s)?.code, counters: tower(s)?.counters },
        { code: "27077a", counters: 0 },
      );
      // Venom (II)'s When Revealed puts Tooth and Nail into play.
      assert.equal(
        s.sideSchemes.some((p) => p.code === "27081"),
        difficulty === "expert",
      );
      await counterText(0);
      await artwork([s.villain.code, "27076b", "27077a"]);
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
    current = { kind: "bell-tower-chime", width };
    let f = fixture("chime");
    let owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: "Place 2 chime counters instead" })
      .click();
    let s = await settle();
    assert.equal(s.villain.hp, f.hp, "the chime counters replace the damage");
    assert.equal(tower(s).counters, 2);
    await counterText(2);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("bell-tower-chime", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "vengeance", width };
    f = fixture("vengeance");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: "Deal the damage to Venom", exact: true })
      .click();
    s = await settle();
    assert.equal(s.villain.hp, f.hp - 2);
    assert.equal(stored(s).length, 1, "Vengeance: 1 facedown boost card");
    await page
      .locator(".venom-boost-caption")
      .filter({ hasText: /1 facedown boost card/ })
      .waitFor();
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("vengeance", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "ringing", width };
    f = fixture("ringing");
    owned = originals(f.state);
    await open(width, f.state);
    await page.getByText(/Ringing · Venom takes \+1 damage/).waitFor();
    await artwork(["27077b"]);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    // Venom (I): ATK 2 and a boost card of 1 icon; 3 chime counters
    // prevent all 3 damage and the Bell Tower falls Quiet.
    assert.equal(s.player.hp, f.hp, "the chime counters prevent the damage");
    assert.deepEqual(
      { code: tower(s).code, counters: tower(s).counters },
      { code: "27077a", counters: 0 },
    );
    assert.deepEqual(originals(s), owned);
    await audit("ringing", width);
    checks.push({ ...current });

    current = { kind: "improvised-weapons", width };
    f = fixture("weapons");
    owned = originals(f.state);
    await open(width, f.state);
    await artwork(["27164"]);
    await page
      .getByRole("button", {
        name: /Spend mental, physical, energy · discard Improvised Weapons/,
      })
      .first()
      .click();
    s = await saved();
    assert.equal(s.prompt?.kind, "payment", "Improvised Weapons' resources");
    await pay(f.paid);
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "discarded");
    assert.deepEqual(originals(s), owned);
    await audit("improvised-weapons", width);
    checks.push({ ...current });

    current = { kind: "webbed-up", width };
    f = fixture("webbed");
    owned = originals(f.state);
    await open(width, f.state);
    await artwork(["27166"]);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(s.villain.hp, f.hp, "Webbed Up replaces the attack");
    assert.ok(!s.attachments.some((p) => p.id === f.id), "discarded");
    assert.ok(s.player.stunned, "the hero is stunned");
    assert.deepEqual(originals(s), owned);
    await audit("webbed-up", width);
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
