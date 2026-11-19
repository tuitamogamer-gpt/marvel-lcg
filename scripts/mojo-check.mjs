import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/mojo/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.MOJO_VIEWPORTS || "1280,768,390,320")
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
      " const longshot=kind==='longshot';",
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:longshot?'rhino':'mojo',difficulty:'standard',seed:39022,pacing:'expert',heroes,...(longshot?{modules:['longshot']}:{})});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " function fromDeck(code){const i=s.player.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing deck card '+code);const p=s.player.deck.splice(i,1)[0];s.player.hand.push(p);return p;}",
      " const result={};",
      " if(kind==='wheel'){s.environments.find(p=>p.code==='39026a').code='39026b';result.old=s.environments.find(p=>p.code!=='39026b').code;result.aside=s.mojo.setAside.map(g=>g.set);native([{type:'mojo:wheel-stop',actorId:'p1'}]);}",
      " else if(kind==='threat'){const i=s.player.deck.findIndex(p=>p.code==='01058');const dd=s.player.deck.splice(i,1)[0];s.player.inPlay.push(dd);result.ally=dd.id;native([{type:'mojo:place',target:'hero:p1',amount:3},{type:'mojo:place',target:dd.id,amount:2},{type:'mojo:place',target:'hero:p2',amount:1}]);}",
      " else if(kind==='paparazzi'){const p=take('39030');result.id=p.id;result.held=[{id:p.id,code:p.code}];result.card=fromDeck('01003').id;native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='domo'){const p=take('39027');result.id=p.id;result.held=[{id:p.id,code:p.code}];result.cards=[fromDeck('01063').id,fromDeck('01004').id,fromDeck('01003').id];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='tail'){const p=take('39028');result.id=p.id;result.held=[{id:p.id,code:p.code}];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='longshot'){const p=take('39071');result.id=p.id;result.held=[{id:p.id,code:p.code}];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='win'){s.villain.code='39023';s.villain.stage=2;s.villain.hp=1;s.villain.maxHp=18*players;native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
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
    ...(s.mojo?.setAside.flatMap((group) => group.pieces) || []),
  ];
}
/** Every physical encounter card of the Mojo set (the villain and main
 * scheme are tracked by the game itself), or the Longshot card. */
function originals(s, held = [], set = "mojo") {
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const cards = all.filter(
    (p) =>
      definition(p).set_code === set &&
      !["villain", "main_scheme"].includes(definition(p).type_code),
  );
  // The Wheel of Genres and eleven encounter cards; Longshot is one card.
  assert.equal(
    cards.length,
    set === "mojo" ? 12 : 1,
    `The ${set} set: ${cards.map((p) => p.code)}`,
  );
  return cards.map((p) => p.id).sort();
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
    if (sessionStorage.getItem("mojo-check")) return;
    sessionStorage.setItem("mojo-check", "1");
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
          .getByRole("button", { name: "Mojo", exact: true })
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
        await page.locator("#mission-seed").fill("39022");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "mojo");
        // One modular set plus one per hero, the genre sets in order.
        assert.deepEqual(
          s.modules,
          ["crime", "fantasy", "horror"].slice(0, players + 1),
        );
        assert.equal(s.mojo.setAside.length, players);
        const code = difficulty === "expert" ? "39023" : "39022";
        assert.equal(s.villain.code, code);
        await page.getByText("ENVIRONMENT · SPINNING").waitFor();
        await page
          .getByText(
            `${players} set${players === 1 ? "" : "s"} set aside · stops when the encounter deck resets`,
          )
          .waitFor();
        await page
          .getByText(`discards ${difficulty === "expert" ? 4 : 3} encounter`, {
            exact: false,
          })
          .waitFor();
        if (difficulty === "expert") {
          // Mojo (II) put 2 threat on each identity.
          await page.getByLabel("THREAT: 2", { exact: true }).waitFor();
          await page
            .getByText("Moves to the main scheme when you flip")
            .waitFor();
        }
        await artwork([code, "39026a"]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "wheel", width };
    let f = fixture("wheel", 2);
    let owned = originals(f.state);
    await open(width, f.state);
    await page.getByText("ENVIRONMENT · STOPPED").waitFor();
    let s = await resolveFixture();
    assert.equal(s.mojo.setAside.length, 1);
    const show = s.environments.find((p) => !p.code.startsWith("39026"));
    assert.ok(show && show.code !== f.old, "A new Show enters play");
    assert.ok(f.aside.includes(definition(show).set_code));
    assert.equal(
      s.encounter.dealt.filter((p) => p.dealtTo === "p1").length,
      2,
      "The first player is dealt 2 cards",
    );
    await page.getByText("ENVIRONMENT · SPINNING").waitFor();
    await page
      .getByText("1 set set aside · stops when the encounter deck resets")
      .waitFor();
    await artwork([show.code]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("wheel", width);
    checks.push({ ...current });

    current = { kind: "threat", width };
    f = fixture("threat", 2);
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    await page.getByLabel("THREAT: 3", { exact: true }).waitFor();
    await page.getByLabel("Threat on Daredevil: 2", { exact: true }).waitFor();
    await page
      .getByLabel("1 threat on this identity", { exact: true })
      .waitFor();
    const threat = s.scheme.threat;
    await page.locator(".flip-button").click();
    s = await settle();
    assert.equal(s.player.form, "alter");
    assert.equal(s.player.mojoThreat, 0);
    assert.equal(s.scheme.threat, threat + 3, "Flipping moves its threat");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("threat", width);
    checks.push({ ...current });

    current = { kind: "paparazzi", width };
    f = fixture("paparazzi");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.player.inPlay.find((p) => p.id === f.id)?.counters, 10);
    await page.getByLabel("Threat on Paparazzi: 10", { exact: true }).waitFor();
    await page
      .getByRole("button", {
        name: "Action · discard a card from your hand · remove 2 threat",
      })
      .first()
      .click();
    s = await settle();
    assert.equal(s.player.inPlay.find((p) => p.id === f.id)?.counters, 8);
    assert.ok(s.player.discard.some((p) => p.id === f.card));
    await page.getByLabel("Threat on Paparazzi: 8", { exact: true }).waitFor();
    await artwork(["39030"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("paparazzi", width);
    checks.push({ ...current });

    current = { kind: "domo", width };
    f = fixture("domo");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(
      s.attachments.find((p) => p.id === f.id)?.attachedTo,
      s.villain.id,
    );
    await page
      .getByRole("button", {
        name: "Hero Action · spend energy, mental and physical · discard Major Domo",
        exact: true,
      })
      .click();
    await payWith(f.cards);
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id));
    assert.ok(s.encounter.discard.some((p) => p.id === f.id));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("domo", width);
    checks.push({ ...current });

    current = { kind: "tail", width };
    f = fixture("tail");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    await page
      .getByLabel("Stinger Tail damage: 0 of 5", { exact: true })
      .waitFor();
    await page.getByText("0/5 damage · retaliate 2").waitFor();
    await artwork(["39028"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("tail", width);
    checks.push({ ...current });

    current = { kind: "longshot", width };
    f = fixture("longshot");
    owned = originals(f.state, f.held, "longshot");
    await open(width, f.state);
    s = await resolveFixture();
    const longshot = s.player.inPlay.find((p) => p.id === f.id);
    assert.ok(longshot, "Longshot is under your control");
    assert.equal(
      s.encounter.dealt.filter((p) => p.dealtTo === "p1").length,
      1,
      "Longshot surges",
    );
    await page
      .locator(`[data-piece-id="${f.id}"]`)
      .getByRole("button", { name: "Inspect Longshot" })
      .waitFor();
    // Longshot does not count against the ally limit.
    await page
      .locator(".tableau-group.allies .table-group-label b")
      .filter({ hasText: /^0 \/ 3$/ })
      .waitFor();
    await artwork(["39071"]);
    assert.deepEqual(originals(s, [], "longshot"), owned);
    await resumeExact();
    await audit("longshot", width);
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
