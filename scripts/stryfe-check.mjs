import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/stryfe/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.STRYFE_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'stryfe',difficulty:'standard',seed:40163,pacing:'expert',heroes});",
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
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const grasp=()=>s.sideSchemes.find(p=>p.code.startsWith('40168'));",
      " const hope=()=>s.player.inPlay.find(p=>p.code==='40130');",
      " function events(n){const cards=s.player.deck.filter(p=>card(p).type_code==='event').slice(0,n);for(const p of cards){s.player.deck.splice(s.player.deck.indexOf(p),1);s.player.hand.push(p);}}",
      " const result={};",
      " if(kind==='grasp'){const g=grasp();native([{type:'thwart',target:g.id,amount:g.counters,source:'hero'}]);}",
      " else if(kind==='power'){events(3);result.threat=s.scheme.threat;native([{type:'stryfe:power',playerId:'p1',actorId:'p1'}]);}",
      " else if(kind==='inertia'){const p=take('40173');result.held=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='transferal'){const p=take('40169');result.held=[p];s.villain.tough=false;s.villain.toughCards=0;native([{type:'reveal',piece:p,actorId:'p1'},{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
      " else if(kind==='lose'){s.scheme.threat=9*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='win'){s.villain.code='40164';s.villain.stage=2;s.villain.hp=1;s.villain.tough=false;s.villain.toughCards=0;native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
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
  ];
}
/** Every physical card of the Stryfe set (the main schemes and the villain
 * are tracked by the game itself), its two modular sets and the Hope
 * Summers set. */
function originals(s, held = []) {
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const of = (set) =>
    all.filter(
      (p) =>
        definition(p).set_code === set &&
        !["main_scheme", "villain"].includes(definition(p).type_code),
    );
  // Stryfe's Grasp and fifteen encounter cards.
  const set = of("stryfe");
  assert.equal(set.length, 16, `The Stryfe set: ${set.map((p) => p.code)}`);
  const modular = ["extreme_measures", "mutant_insurrection"].flatMap((x) => {
    const cards = of(x);
    assert.equal(cards.length, 5, `The ${x} set`);
    return cards;
  });
  const hope = of("hope_summers");
  assert.equal(hope.length, 2, "Hope Summers and Captive Hope");
  return [...set, ...modular, ...hope].map((p) => p.id).sort();
}
/** The most common card type in a player's hand. */
const common = (s, playerId) => {
  const counts = {};
  for (const p of seatPlayer(
    s,
    s.players.find((seat) => seat.id === playerId),
  ).hand)
    counts[definition(p).type_code] =
      (counts[definition(p).type_code] || 0) + 1;
  return Math.max(0, ...Object.values(counts));
};
async function open(width, state) {
  if (context) await context.close();
  context = await browser.newContext({
    viewport: { width, height: 900 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript((state) => {
    if (sessionStorage.getItem("stryfe-check")) return;
    sessionStorage.setItem("stryfe-check", "1");
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
      s.prompt.title === "Search the encounter deck" ||
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
          .getByRole("button", { name: "Stryfe", exact: true })
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
        await page.locator("#mission-seed").fill("40163");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "stryfe");
        assert.deepEqual(s.modules, [
          "extreme_measures",
          "mutant_insurrection",
        ]);
        const stage = difficulty === "expert" ? "II" : "I";
        assert.equal(
          s.villain.code,
          difficulty === "expert" ? "40164" : "40163",
        );
        assert.equal(s.scheme.code, "40166b");
        const grasp = s.sideSchemes.find((p) => p.code === "40168a");
        assert.ok(grasp, "Stryfe's Grasp");
        const first = seatPlayer(
          s,
          s.players.find((seat) => seat.id === s.firstPlayerId),
        );
        assert.ok(
          first.inPlay.some((p) => p.code === "40130"),
          "Hope Summers",
        );
        const x = common(s, s.activePlayerId);
        await page
          .getByText(`VILLAIN · STAGE ${stage} · +${x} ATK VS YOU`)
          .waitFor();
        await page.getByText(`Your most common card type: ${x}`).waitFor();
        await page.getByText(`After step one: +${x} from you`).waitFor();
        await artwork([s.villain.code, "40166b", "40168a", "40130"]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "grasp", width };
    let f = fixture("grasp");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(
      s.sideSchemes.find((p) => p.code.startsWith("40168"))?.code,
      "40168b",
    );
    assert.equal(s.scheme.code, "40167b");
    await page.getByText("+2 hand size · cards cost 1 more").waitFor();
    await page
      .getByText("Living Bomb: he cannot be defeated", { exact: false })
      .waitFor();
    await artwork(["40168b", "40167b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("grasp", width);
    checks.push({ ...current });

    current = { kind: "power", width };
    f = fixture("power");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    const x = common(await saved(), "p1");
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", { name: "Do not discard", exact: true })
      .click();
    s = await settle();
    assert.equal(s.scheme.threat, f.threat + x, "Uncontrollable Power");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("power", width);
    checks.push({ ...current });

    current = { kind: "inertia", width };
    f = fixture("inertia");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(
      s.attachments.find((p) => p.code === "40173")?.attachedTo,
      "hero:p1",
    );
    await artwork(["40173"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("inertia", width);
    checks.push({ ...current });

    current = { kind: "transferal", width };
    f = fixture("transferal");
    owned = originals(f.state, f.held);
    await open(width, f.state);
    s = await resolveFixture();
    const hope = s.player.inPlay.find((p) => p.code === "40130");
    assert.equal(hope?.damage, 1, "Mental Transferal hurts Hope Summers");
    assert.ok(!s.attachments.some((p) => p.code === "40169"));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("transferal", width);
    checks.push({ ...current });

    current = { kind: "lose", width };
    f = fixture("lose");
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.phase, "lost");
    await page.getByText("MISSION FAILED").first().waitFor();
    await audit("lose", width);
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
