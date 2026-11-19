import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/hood/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.HOOD_VIEWPORTS || "1280,768,390,320")
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
      " const modular={setting:'streets_of_mayhem',armory:'ransacked_armory',fear:'crossfire_crew'}[kind];",
      " const rhino=kind==='formidable'||!!modular;",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:rhino?'rhino':'the_hood',difficulty:'standard',seed:24001,pacing:'expert',heroes:[{heroId:'spider_man',aspect:'justice'}],...(kind==='formidable'?{standardII:true}:{}),...(modular?{module:modular}:{})});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;}}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " function native(effects){s.prompt={kind:'choice',title:'Original Hood effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " s.player.deck.push(...s.player.hand.splice(0));",
      " s.player.form='hero';",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " const result={};",
      " if(kind==='foul'){const o=s.encounter.deck.find(p=>card(p).set_code!=='the_hood');s.encounter.deck=[o,...s.encounter.deck.filter(p=>p!==o)];result.id=o.id;native([{type:'hood:foul-play',playerId:'p1',actorId:'p1'}]);}",
      " else if(kind==='dominance'){const d=take('24007');d.attachedTo='hero:p1';s.attachments.push(d);s.player.form='alter';result.id=d.id;result.threat=s.scheme.threat;}",
      " else if(kind==='mantle'){const m=take('24008');m.attachedTo=s.villain.id;s.attachments.push(m);const pick=k=>{const i=s.player.deck.findIndex(p=>card(p)['resource_'+k]&&!card(p).resource_wild);return s.player.deck.splice(i,1)[0];};const paid=[pick('energy'),pick('mental'),pick('physical')];s.player.hand.push(...paid);result.id=m.id;result.paid=paid.map(p=>p.id);}",
      " else if(kind==='formidable'){result.code=s.environments[0]?.code;}",
      " else if(kind==='setting'){const p=take('24060');result.id=p.id;s.encounter.deck.unshift(take('01186'));delete s.encounter.knownTop;native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='armory'){const g=take('24041');g.engagedWith='p1';s.minions.push(g);const p=take('24037');result.id=p.id;result.guard=g.id;native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='fear'){const f=take('24027');f.engagedWith='p1';s.minions.push(f);s.player.exhausted=true;const i=s.player.deck.findIndex(p=>card(p).resource_mental&&!card(p).resource_wild);const m=s.player.deck.splice(i,1)[0];s.player.hand.push(m);result.paid=[m.id];native([{type:'ready',target:'hero',actorId:'p1'}]);}",
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
    ...(s.hood
      ? [
          s.hood.currentMain,
          ...s.hood.mainDeck,
          ...s.hood.villainDeck,
          ...s.hood.setAside,
        ]
      : []),
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
  if (s.hood)
    assert.equal(
      all.filter((p) => definition(p).set_code === "the_hood").length,
      15,
      "The 15 cards of The Hood set in use",
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
    if (sessionStorage.getItem("hood-check")) return;
    sessionStorage.setItem("hood-check", "1");
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
  throw Error("Native Hood continuation did not finish");
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
    "The Hood's stages, set-aside modular sets and dealt cards survive reload",
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
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "the_hood");
  assert.equal(s.modules.length, 7);
  const version = difficulty === "expert" ? 1 : 0;
  assert.equal(s.villain.code, ["24001", "24002"][version]);
  assert.deepEqual(s.scheme, { code: "24004b", threat: 1, index: 0 });
  assert.equal(
    new Set(s.hood.setAside.map((p) => definition(p).set_code)).size,
    difficulty === "expert" ? 5 : 6,
  );
  await page
    .getByText(/modular sets? set aside/)
    .first()
    .waitFor();
  await artwork([s.villain.code, "24004b"]);
}
try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "The Hood", exact: true })
        .click();
      // The rules insert's sets ranked 1-7 are the default seven.
      const ranked = [
        "streets_of_mayhem",
        "brothers_grimm",
        "ransacked_armory",
        "state_of_emergency",
        "beasty_boys",
        "mister_hyde",
        "sinister_syndicate",
      ];
      for (let i = 1; i <= 7; i++)
        assert.equal(
          await page
            .getByRole("combobox", { name: "Modular encounter " + i })
            .inputValue(),
          ranked[i - 1],
        );
      await page.getByText(/Choose seven modular sets/).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("24001");
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
    current = { kind: "foul-play", width };
    let f = fixture("foul");
    let owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    let s = await settle();
    assert.deepEqual(
      s.encounter.dealt.map((p) => p.id),
      [f.id],
      "Foul Play deals the discarded card",
    );
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("foul-play", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "established-dominance", width };
    f = fixture("dominance");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: /Exhaust and place 2 threat · discard Established Dominance/,
      })
      .first()
      .click();
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "discarded");
    assert.equal(s.scheme.threat, f.threat + 2);
    await audit("established-dominance", width);
    checks.push({ ...current });

    current = { kind: "mantle-hero-action", width };
    f = fixture("mantle");
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: /Spend energy, mental, physical · discard The Hood's Mantle/,
      })
      .first()
      .click();
    s = await saved();
    assert.equal(s.prompt?.kind, "payment");
    for (const id of f.paid) {
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
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "Mantle discarded");
    await audit("mantle-hero-action", width);
    checks.push({ ...current });

    current = { kind: "formidable-foe", width };
    f = fixture("formidable");
    await open(width, f.state);
    assert.equal(f.code, "24049a");
    await page
      .locator(".table-game-meta")
      .filter({ hasText: "Standard II" })
      .waitFor({ state: "attached" });
    await artwork(["24049a"]);
    await audit("formidable-foe", width);
    checks.push({ ...current });

    // The Hood scenario pack's modular sets in an ordinary scenario.
    current = { kind: "streets-of-mayhem", width };
    f = fixture("setting");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.ok(
      s.environments.some((p) => p.id === f.id),
      "Back-Alley Enclave is the Setting in play",
    );
    // The revealed card was held by the native effect, not in a zone.
    assert.deepEqual(originals(s), [...owned, f.id + ":24060"].sort());
    await artwork(["24060"]);
    await resumeExact();
    await audit("streets-of-mayhem", width);
    checks.push({ ...current, exactReload: true });

    current = { kind: "ransacked-armory", width };
    f = fixture("armory");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await settle();
    assert.equal(
      s.attachments.find((p) => p.id === f.id)?.attachedTo,
      f.guard,
      "Flamethrower attaches to the minion with the most hit points",
    );
    await artwork(["24037", "24041"]);
    await audit("ransacked-armory", width);
    checks.push({ ...current });

    current = { kind: "mister-fear", width };
    f = fixture("fear");
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    s = await saved();
    assert.equal(s.prompt?.kind, "payment", "Mister Fear's mental resource");
    for (const id of f.paid) {
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
    s = await settle();
    assert.equal(s.player.exhausted, false, "the hero readies after paying");
    await audit("mister-fear", width);
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
