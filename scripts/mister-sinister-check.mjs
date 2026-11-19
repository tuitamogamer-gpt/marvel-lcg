import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/mister-sinister/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.SINISTER_VIEWPORTS || "1280,768,390,320")
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
      " let s=newGame({heroId:'spider_man',aspect:'justice',villainId:'mister_sinister',difficulty:'standard',seed:40136,pacing:'expert',heroes});",
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
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,...s.sinister.setAside.map(g=>g.pieces)]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const result={};",
      " if(kind==='advance'){s.scheme.threat=5*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='ends'){const st=s.sinister;const other=['40140b','40141b','40142b'].find(c=>c!==st.removed&&!st.visited.includes(c));st.visited.push(other);s.scheme.threat=5*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='status'){s.villain.tough=false;s.villain.toughCards=0;result.threat=s.scheme.threat;native([{type:'status',target:s.villain.id,status:'stunned'}]);}",
      " else if(kind==='disguise'){const p=take('40144');p.attachedTo=s.villain.id;s.attachments.push(p);s.villain.tough=false;s.villain.toughCards=0;result.hp=s.villain.hp;native([{type:'damage',target:s.villain.id,amount:2,source:'hero'}]);}",
      " else if(kind==='impervious'){const p=take('40156');p.attachedTo=s.villain.id;s.attachments.push(p);result.id=p.id;s.villain.tough=false;s.villain.toughCards=0;const cards=s.player.deck.filter((q,i,a)=>card(q).resource_physical>0&&a.findIndex(x=>x.code===q.code)===i).slice(0,2);for(const q of cards){s.player.deck.splice(s.player.deck.indexOf(q),1);s.player.hand.push(q);}result.ids=cards.map(q=>q.id);}",
      " else if(kind==='lose'){s.scheme.code='40143b';s.scheme.index=4;s.scheme.threat=7*players-1;native([{type:'threat',target:'main',amount:1}]);}",
      " else if(kind==='win'){s.villain.code='40137';s.villain.stage=2;s.villain.hp=1;s.villain.tough=false;s.villain.toughCards=0;native([{type:'damage',target:s.villain.id,amount:1,source:'hero'}]);}",
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
    ...(s.sinister?.setAside.flatMap((g) => g.pieces) || []),
  ];
}
/** Every physical card of the Mister Sinister set (the main schemes and
 * the villain are tracked by the game itself), the three superpower sets and
 * the Hope Summers set. */
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
  const set = of("mister_sinister");
  assert.equal(
    set.length,
    9,
    `The Mister Sinister set: ${set.map((p) => p.code)}`,
  );
  const powers = ["flight", "super_strength", "telepathy"].flatMap((x) => {
    const cards = of(x);
    assert.equal(cards.length, 5, `The ${x} set`);
    return cards;
  });
  const hope = of("hope_summers");
  assert.equal(hope.length, 2, "Hope Summers and Captive Hope");
  return [...set, ...powers, ...hope].map((p) => p.id).sort();
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
    if (sessionStorage.getItem("sinister-check")) return;
    sessionStorage.setItem("sinister-check", "1");
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
const POWER = { "40140b": "40151", "40141b": "40155", "40142b": "40159" };
try {
  for (const width of widths)
    for (const difficulty of ["standard", "expert"])
      for (const players of [1, 2]) {
        current = { kind: "setup", width, difficulty, players };
        await open(width);
        await page
          .locator(".villain-tabs")
          .getByRole("button", { name: "Mister Sinister", exact: true })
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
        await page.locator("#mission-seed").fill("40136");
        await page.locator("#start-btn").click();
        let s = await settle();
        for (let i = 0; i < players; i++) {
          await page
            .getByRole("button", { name: "Keep hand & begin", exact: true })
            .click();
          s = await settle();
        }
        assert.equal(s.phase, "player");
        assert.equal(s.villainId, "mister_sinister");
        assert.deepEqual(s.modules, ["nasty_boys"]);
        const stage = difficulty === "expert" ? "II" : "I";
        assert.equal(
          s.villain.code,
          difficulty === "expert" ? "40137" : "40136",
        );
        const st = s.sinister;
        assert.equal(st.visited.length, 1);
        assert.equal(s.scheme.code, st.visited[0]);
        assert.equal(
          s.attachments.find((p) => p.code === POWER[st.visited[0]])
            ?.attachedTo,
          s.villain.id,
        );
        const first = seatPlayer(
          s,
          s.players.find((seat) => seat.id === s.firstPlayerId),
        );
        assert.ok(
          first.inPlay.some((p) => p.code === "40130"),
          "Hope Summers",
        );
        await page
          .getByText(`VILLAIN · STAGE ${stage} · 1 SUPERPOWER`)
          .waitFor();
        await page
          .getByText(
            `each status card places ${stage === "I" ? 1 : 2} threat`,
            {
              exact: false,
            },
          )
          .waitFor();
        await page.getByText("Completed: the other stage 2").waitFor();
        await artwork([
          s.villain.code,
          st.visited[0],
          POWER[st.visited[0]],
          "40130",
        ]);
        const owned = originals(s);
        await resumeExact();
        assert.deepEqual(originals(await saved()), owned);
        await audit(`setup-${difficulty}-${players}p`, width);
        checks.push({ ...current, physicalCards: owned.length });
      }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "advance", width };
    let f = fixture("advance");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.notEqual(s.phase, "lost");
    assert.equal(s.sinister.visited.length, 2);
    assert.equal(s.scheme.code, s.sinister.visited[1]);
    await page.getByText("VILLAIN · STAGE I · 2 SUPERPOWERS").waitFor();
    await page.getByText("Completed: Sinister Ends").waitFor();
    await artwork([s.scheme.code, POWER[s.scheme.code]]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("advance", width);
    checks.push({ ...current });

    current = { kind: "ends", width };
    f = fixture("ends");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.scheme.code, "40143b");
    await page.getByText("Sinister attacks Hope Summers").waitFor();
    await artwork(["40143b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("ends", width);
    checks.push({ ...current });

    current = { kind: "status", width };
    f = fixture("status");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(s.scheme.threat, f.threat + 1, "A status card places threat");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("status", width);
    checks.push({ ...current });

    current = { kind: "disguise", width };
    f = fixture("disguise");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", { name: "Resolve original effect", exact: true })
      .click();
    await page
      .locator("[role=dialog]")
      .last()
      .getByRole("button", {
        name: "Deal 2 damage to the friendly character with the fewest remaining hit points",
        exact: true,
      })
      .click();
    s = await settle();
    assert.equal(s.villain.hp, f.hp, "Sinister Disguise protects him");
    assert.ok(!s.attachments.some((p) => p.code === "40144"));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("disguise", width);
    checks.push({ ...current });

    current = { kind: "impervious", width };
    f = fixture("impervious");
    owned = originals(f.state);
    await open(width, f.state);
    await page
      .getByRole("button", {
        name: "Hero Action · spend 2 physical resources · give the villain a tough status card and discard Impervious",
        exact: true,
      })
      .click();
    await payWith(f.ids);
    s = await settle();
    assert.ok(!s.attachments.some((p) => p.id === f.id), "Impervious is gone");
    assert.ok(s.villain.tough, "The villain gets a tough status card");
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("impervious", width);
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
