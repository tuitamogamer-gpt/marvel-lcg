import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/mysterio/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.MYSTERIO_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'mysterio',difficulty:'standard',seed:27084,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}]});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;}}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " function native(effects){s.prompt={kind:'choice',title:'Original Mysterio effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function resource(){const i=s.player.deck.findIndex(p=>card(p).resource_physical&&!card(p).resource_wild);return s.player.deck.splice(i,1)[0];}",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " const result={};",
      " const inDeck=()=>s.player.deck.filter(p=>card(p).faction_code==='encounter').length;",
      " if(kind==='maze'){const f=take('27093');s.player.deck.unshift(f);result.id=f.id;native([{type:'draw',amount:1,actorId:'p1'}]);}",
      " else if(kind==='hallucination'){const h=take('27089');h.attachedTo=s.villain.id;s.attachments.push(h);const r=resource();s.player.hand.push(r);result.id=h.id;result.paid=[r.id];result.inDeck=inDeck();}",
      " else if(kind==='panic'){const p=take('27153');p.attachedTo='hero:p1';s.attachments.push(p);s.player.form='alter';const i=s.player.deck.findIndex(q=>card(q).faction_code==='hero');const h=s.player.deck.splice(i,1)[0];s.player.hand.push(h);result.id=p.id;result.card=h.id;}",
      " else if(kind==='manipulated'){const i=s.player.deck.findIndex(q=>card(q).type_code==='ally');const a=s.player.deck.splice(i,1)[0];a.ownerId='p1';s.player.inPlay.push(a);const m=take('27171');result.id=a.id;native([{type:'reveal',piece:m,actorId:'p1'}]);result.held=[{id:m.id,code:m.code}];}",
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
  assert.equal(
    set("mysterio").length,
    11,
    "The 11 encounter cards of Mysterio: " + set("mysterio"),
  );
  assert.equal(
    set("personal_nightmare").length,
    7,
    "The 7 cards of Personal Nightmare: " + set("personal_nightmare"),
  );
  assert.equal(
    set("whispers_of_paranoia").length,
    5,
    "The 5 cards of Whispers of Paranoia: " + set("whispers_of_paranoia"),
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
    if (sessionStorage.getItem("mysterio-check")) return;
    sessionStorage.setItem("mysterio-check", "1");
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
  throw Error("Native Mysterio continuation did not finish");
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
    "The encounter cards in your deck and the dealt cards survive reload",
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
        .getByRole("button", { name: "Mysterio", exact: true })
        .click();
      assert.equal(
        await page
          .getByRole("combobox", { name: "Modular encounter", exact: true })
          .inputValue(),
        "whispers_of_paranoia",
      );
      await page.getByText(/Personal Nightmare is always included/).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("27084");
      await page.locator("#start-btn").click();
      const s = await begin();
      assert.equal(s.villainId, "mysterio");
      assert.deepEqual(s.modules, ["whispers_of_paranoia"]);
      assert.equal(s.villain.code, difficulty === "expert" ? "27085" : "27084");
      assert.equal(s.scheme.code, "27087b");
      assert.equal(s.scheme.threat, 2, "Maze of Mirrors: 2 per player");
      assert.equal(
        s.minions.filter((p) => p.code === "27091" && p.engagedWith === "p1")
          .length,
        1,
        "A Shifting Apparition engages the player",
      );
      await artwork([s.villain.code, "27087b", "27091"]);
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
    current = { kind: "maze-of-mirrors", width };
    let f = fixture("maze");
    let owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    let s = await settle();
    assert.ok(
      s.encounter.dealt.some((p) => p.id === f.id && p.dealtTo === "p1"),
      "the drawn encounter card is dealt facedown",
    );
    assert.equal(s.player.hand.length, 1, "a replacement card is drawn");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("maze-of-mirrors", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "humongous-hallucination", width };
    f = fixture("hallucination");
    owned = originals(f.state);
    await open(width, f.state);
    await artwork(["27089"]);
    await page
      .getByRole("button", {
        name: /Spend 1 resource · shuffle 2 encounter cards/,
      })
      .first()
      .click();
    s = await saved();
    assert.equal(
      s.prompt?.kind,
      "payment",
      "Humongous Hallucination's resource",
    );
    await pay(f.paid);
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "discarded");
    assert.equal(
      s.player.deck.filter((p) => definition(p).faction_code === "encounter")
        .length,
      f.inDeck + 2,
      "two encounter cards join your deck",
    );
    assert.deepEqual(originals(s), owned);
    await audit("humongous-hallucination", width);
    checks.push({ ...current });

    current = { kind: "induced-panic", width };
    f = fixture("panic");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: /Discard a random identity-specific card · discard Induced Panic/,
      })
      .first()
      .click();
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "discarded");
    assert.ok(s.player.discard.some((p) => p.id === f.card));
    assert.deepEqual(originals(s), owned);
    await audit("induced-panic", width);
    checks.push({ ...current });

    current = { kind: "manipulated-mind", width };
    f = fixture("manipulated");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    const minion = s.minions.find((p) => p.id === f.id);
    assert.ok(minion?.treatedAsMinion, "the ally is treated as a minion");
    assert.equal(minion?.engagedWith, "p1");
    await artwork([minion.code]);
    assert.deepEqual(originals(s), owned);
    await audit("manipulated-mind", width);
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
