import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/sandman/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.SANDMAN_VIEWPORTS || "1280,768,390,320")
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
      "export const definition=p=>card(p);",
      "export const payment=s=>{const p=s.prompt;return paymentSources(s,p.card?.id,p.paymentTarget,p.handOnly,p.alliance);};",
      "export function fixture(kind){",
      // Down to Earth also joins ordinary scenarios as their modular set.
      " const modular=['criminal','family','volunteer'].includes(kind);",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:modular?'rhino':'sandman',difficulty:'standard',seed:27061,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}],...(modular?{module:'down_to_earth'}:{})});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;}}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " function native(effects){s.prompt={kind:'choice',title:'Original Sandman effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function resource(kind){const i=s.player.deck.findIndex(p=>card(p)['resource_'+kind]&&!card(p).resource_wild);if(i<0)throw Error('Missing '+kind+' resource');return s.player.deck.splice(i,1)[0];}",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " const result={};",
      " const streets=(s.environments||[]).find(p=>p.code==='27065');",
      " if(kind==='streets'){result.id=streets.id;result.counters=streets.counters;}",
      " else if(kind==='sand-form'){const f=take('27066');f.attachedTo=s.villain.id;s.attachments.push(f);result.id=f.id;result.hp=s.villain.hp;result.counters=streets.counters;result.discard=s.encounter.discard.length;native([{type:'damage',target:s.villain.id,amount:2,source:'hero',attack:true,actorId:'p1'}]);}",
      " else if(kind==='storm'){const p=take('27071');result.id=p.id;result.hp=s.player.hp;result.counters=streets.counters;native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='criminal'){const c=take('27131');c.engagedWith='p1';s.minions.push(c);s.player.form='alter';const r=resource('physical');s.player.hand.push(r);result.id=c.id;result.paid=[r.id];}",
      " else if(kind==='family'){const f=take('27132');s.player.inPlay.push(f);s.player.form='alter';const i=s.player.deck.findIndex(p=>card(p).faction_code==='hero');const h=s.player.deck.splice(i,1)[0];s.player.hand.push(h);result.id=f.id;result.card=h.id;}",
      " else if(kind==='volunteer'){const v=take('27133');v.counters=3;s.sideSchemes.push(v);s.player.form='alter';const paid=[resource('energy'),resource('mental')];s.player.hand.push(...paid);result.id=v.id;result.paid=paid.map(p=>p.id);}",
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
const { fixture, definition, payment } = await import(
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
const streets = (s) => (s.environments || []).find((p) => p.code === "27065");
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
  if (s.sandman) {
    assert.equal(
      set("sandman").length,
      14,
      "The 14 encounter cards of Sandman: " + set("sandman"),
    );
    assert.equal(
      set("city_in_chaos").length,
      5,
      "The 5 cards of City in Chaos: " + set("city_in_chaos"),
    );
  }
  assert.equal(
    set("down_to_earth").length,
    7,
    "The 7 cards of Down to Earth: " + set("down_to_earth"),
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
    if (sessionStorage.getItem("sandman-check")) return;
    sessionStorage.setItem("sandman-check", "1");
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
  throw Error("Native Sandman continuation did not finish");
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
    "City Streets, its sand counters and the dealt cards survive reload",
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
        "^\\s*" + count + " sand counter" + (count === 1 ? "" : "s") + "\\s*$",
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
        .getByRole("button", { name: "Sandman", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "down_to_earth",
      );
      await page.getByText(/City in Chaos is always included/).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("27061");
      await page.locator("#start-btn").click();
      const s = await begin();
      assert.equal(s.villainId, "sandman");
      assert.deepEqual(s.modules, ["down_to_earth"]);
      assert.equal(s.villain.code, difficulty === "expert" ? "27062" : "27061");
      assert.equal(s.scheme.code, "27064b");
      assert.equal(s.scheme.threat, 2, "Hapless Pedestrians: 2 per player");
      // Sandman (II)'s When Revealed resolves Surging Sands at Expert setup.
      const sand = difficulty === "expert" ? 5 : 4;
      assert.equal(streets(s)?.counters, sand);
      await counterText(sand);
      await artwork([s.villain.code, "27064b", "27065"]);
      const owned = originals(s);
      await resumeExact();
      assert.deepEqual(originals(await saved()), owned);
      await audit("standalone-" + difficulty, width);
      checks.push({
        ...current,
        sandCounters: sand,
        physicalCards: owned.length,
        exactReload: true,
      });
    }
  }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "city-streets", width };
    let f = fixture("streets");
    let owned = originals(f.state);
    await open(width, f.state);
    await counterText(f.counters);
    await page
      .getByRole("button", {
        name: "Exhaust a character · remove sand counters equal to its ATK",
        exact: true,
      })
      .click();
    let s = await settle();
    assert.equal(streets(s).counters, f.counters - 2, "Spider-Man's ATK 2");
    assert.equal(s.player.exhausted, true, "the identity exhausts");
    await counterText(f.counters - 2);
    assert.equal(
      await page
        .getByRole("button", {
          name: "Exhaust a character · remove sand counters equal to its ATK",
        })
        .count(),
      0,
      "once per round per player",
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("city-streets", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "sand-form", width };
    f = fixture("sand-form");
    owned = originals(f.state);
    await open(width, f.state);
    await artwork(["27066"]);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(s.villain.hp, f.hp, "Sand Form is discarded instead");
    assert.ok(!s.attachments.some((p) => p.id === f.id));
    assert.ok(s.encounter.discard.some((p) => p.id === f.id));
    assert.equal(streets(s).counters, f.counters + 1, "Surging Sands");
    assert.equal(
      s.encounter.discard.length,
      f.discard + 1 + f.counters + 1,
      "Surging Sands discards as many cards as there are sand counters",
    );
    await counterText(f.counters + 1);
    assert.deepEqual(originals(s), owned);
    await audit("sand-form", width);
    checks.push({ ...current });

    current = { kind: "sand-storm", width };
    f = fixture("storm");
    owned = originals(f.state, [{ id: f.id, code: "27071" }]);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(
      s.player.hp,
      f.hp - f.counters,
      "Sand Storm deals indirect damage equal to the sand counters",
    );
    assert.deepEqual(originals(s), owned);
    await audit("sand-storm", width);
    checks.push({ ...current });

    // Down to Earth as the modular set of another scenario.
    current = { kind: "common-criminal", width };
    f = fixture("criminal");
    owned = originals(f.state);
    await open(width, f.state);
    await artwork(["27131"]);
    await page
      .getByRole("button", {
        name: "Spend a physical resource · deal 3 damage to Common Criminal",
        exact: true,
      })
      .click();
    s = await saved();
    assert.equal(s.prompt?.kind, "payment", "Common Criminal's resource");
    await pay(f.paid);
    s = await settle();
    assert.ok(!s.minions.some((p) => p.id === f.id), "defeated");
    assert.equal(s.player.hand.length, 1, "draws 1 card as its reward");
    assert.deepEqual(originals(s), owned);
    await audit("common-criminal", width);
    checks.push({ ...current });

    current = { kind: "friends-and-family", width };
    f = fixture("family");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Discard an identity-specific card · discard Friends and Family",
        exact: true,
      })
      .click();
    s = await settle();
    assert.ok(!s.player.inPlay.some((p) => p.id === f.id), "discarded");
    assert.ok(s.player.discard.some((p) => p.id === f.card));
    assert.deepEqual(originals(s), owned);
    await audit("friends-and-family", width);
    checks.push({ ...current });

    current = { kind: "volunteer-work", width };
    f = fixture("volunteer");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Spend 2 resources · remove threat equal to your REC",
        exact: true,
      })
      .click();
    s = await saved();
    assert.equal(s.prompt?.kind, "payment", "Volunteer Work's resources");
    await pay(f.paid);
    s = await settle();
    assert.ok(
      !s.sideSchemes.some((p) => p.id === f.id),
      "Peter Parker's REC 3 clears its 3 threat",
    );
    assert.deepEqual(originals(s), owned);
    await audit("volunteer-work", width);
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
