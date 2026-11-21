import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/fear-no-evil/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const widths = (process.env.FEAR_NO_EVIL_VIEWPORTS || "1280,768,390,320")
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
      "import {card} from './src/game/cards.ts';",
      "import {syncSeat} from './src/game/team.ts';",
      "export {UNDERLINGS,fneAttachmentCaption,fneEnvironmentCaption,fneInPlayCaption,fneMainNote,fneMinionCaption,fneObjective,fneSideSchemeCaption} from './src/game/fear-no-evil.ts';",
      "export const definition=p=>card(p);",
      "export function fixture(kind){",
      " const mission=kind==='heist'||kind==='typhoid'?'fne_art_museum_heist':kind==='bugle'||kind==='tracksuit'?'fne_stop_the_presses':'fne_the_getaway';",
      " const underling=kind==='drained'?'electro':kind==='vehicle'?'hammerhead':kind==='bugle'||kind==='converted'?'purple_man':kind==='typhoid'?'typhoid_mary':'bullseye';",
      " const difficulty=kind==='spine'?'expert':'standard';",
      " let s=newGame({heroId:'captain_marvel',aspect:'aggression',villainId:mission,difficulty,seed:60128,pacing:'expert',underling});",
      " function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}",
      " function settle(){for(let n=0;n<200;n++){",
      "  if(s.review){command({type:'PROCEED'});continue;}",
      "  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none|take|bonus|resolve|allow|done)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}",
      "  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;",
      " }}",
      " settle();",
      " if(s.phase!=='player'||s.prompt||s.review)throw Error('Original setup incomplete');",
      " for(const seat of s.players){const p=seat.id===s.activePlayerId?s.player:seat.player;p.deck.push(...p.hand.splice(0));p.form='hero';}",
      " s.encounter.deck.push(...s.encounter.dealt.splice(0));",
      " s.villain.tough=false;s.villain.toughCards=0;s.villain.stunned=false;s.villain.confused=false;",
      " function native(effects){s.prompt={kind:'choice',title:'Original encounter effect',text:'Resolve the original effect.',options:[{id:'go',label:'Resolve original effect',effects}]};}",
      " function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}",
      " const result={};",
      " if(kind==='outfront'){s.scheme.threat=3;native([{type:'damage',target:s.villain.id,amount:3,source:'hero'}]);}",
      " else if(kind==='spine'){s.attachments=s.attachments.filter(p=>p.code!=='60129a'||(s.removed.push(p),false));native([{type:'damage',target:s.villain.id,amount:7,source:'hero'}]);}",
      " else if(kind==='heist'){const p=take('60126');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='drained'){const p=take('60080');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='vehicle'){const p=take('60186');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='bugle'){s.player.form='alter';}",
      " else if(kind==='typhoid'){native([{type:'damage',target:s.villain.id,amount:s.villain.hp,source:'hero'}]);}",
      " else if(kind==='tracksuit'){const p=take('60204');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
      " else if(kind==='converted'){const ally=makePiece(s,'01030');ally.ownerId='p1';s.player.inPlay.push(ally);const p=take('60100');result.pending=[p];native([{type:'reveal',piece:p,actorId:'p1'}]);}",
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
const {
  fixture,
  definition,
  UNDERLINGS,
  fneAttachmentCaption,
  fneEnvironmentCaption,
  fneInPlayCaption,
  fneMainNote,
  fneMinionCaption,
  fneObjective,
  fneSideSchemeCaption,
} = await import(pathToFileURL(fixturePath).href);
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
    ...s.minions.flatMap((p) => p.inheritorBoosts || []),
    ...Object.values(s.fearNoEvil?.tucked || {}).flat(),
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...(s.fearNoEvil?.setAside || []),
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
/** The physical encounter cards of each set, other than the villains and
 * main schemes; each double-sided card is one physical card. */
const SET_SIZES = {
  fne_bullseye: 11,
  fne_electro: 11,
  fne_hammerhead: 11,
  fne_the_getaway: 7,
  fne_art_museum_heist: 8,
  fne_cops: 5,
  fne_drive: 5,
  fne_the_owl: 5,
  // Part two: Disturbed Psyche and Establish Trust count with Typhoid Mary's
  // set, the Daily Bugle and its four supports with Stop the Presses!.
  fne_purple_man: 12,
  fne_typhoid_mary: 13,
  fne_stop_the_presses: 8,
  fne_tombstone: 5,
  fne_tracksuit_mafia: 7,
};
function originals(s, held = []) {
  const all = [...pieces(s), ...held];
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
  );
  const sets = [
    UNDERLINGS[s.fearNoEvil.underling].set,
    s.villainId,
    ...s.modules,
  ];
  const owned = [];
  for (const set of sets) {
    const cards = all.filter(
      (p) =>
        definition(p).set_code === set &&
        !["main_scheme", "villain"].includes(definition(p).type_code),
    );
    assert.equal(
      cards.length,
      SET_SIZES[set],
      `The ${set} set: ${cards.map((p) => p.code)}`,
    );
    owned.push(...cards);
  }
  return owned.map((p) => p.id).sort();
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
    if (sessionStorage.getItem("fear-no-evil-check")) return;
    sessionStorage.setItem("fear-no-evil-check", "1");
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
    if (state) localStorage.setItem("champions.save.v1", JSON.stringify(state));
  }, state);
  await page.goto(url);
  if (state) await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function until(test, what) {
  for (let n = 0; n < 100; n++) {
    const s = await saved();
    if (test(s)) return s;
    await page.waitForTimeout(50);
  }
  throw Error("Timed out waiting for " + what);
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
        /^(pass|skip|continue|none|resolve|take|allow|no|done|bonus|hero)$/.test(
          o.id,
        ),
      ) ||
      (s.prompt.options.length === 1 ||
      s.prompt.title === "Forced responses" ||
      s.prompt.title === "Discard a card" ||
      /ability order/.test(s.prompt.title)
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    await choose(s, o.label);
  }
  throw Error("Native encounter continuation did not finish");
}
async function choose(s, label) {
  const dialog = page
    .locator("[role=dialog]")
    .last()
    .getByRole("button", { name: label, exact: true });
  if (await dialog.count()) await dialog.first().click();
  else
    await page
      .getByRole("button", {
        name: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
      })
      .first()
      .click();
  await until(
    (next) => JSON.stringify(next) !== JSON.stringify(s),
    "the choice " + label,
  );
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
/** The text is shown in full: not clipped by an ellipsis or its box. */
async function shown(text) {
  const el = page.getByText(text, { exact: true }).first();
  await el.waitFor();
  await page.evaluate(() => document.fonts.ready);
  const clipped = await el.evaluate((node) => {
    if (
      node.scrollWidth > node.clientWidth + 1 &&
      getComputedStyle(node).overflow !== "visible"
    )
      return "ellipsis";
    node.scrollIntoView({ block: "center", inline: "nearest" });
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const line of range.getClientRects()) {
      if (line.width < 2) continue;
      for (const x of [line.left + 1, line.right - 1]) {
        const hit = document.elementFromPoint(x, line.top + line.height / 2);
        if (!hit || !(hit === node || node.contains(hit)))
          return `covered by ${hit?.className || hit?.tagName}`;
      }
    }
    const r = range.getBoundingClientRect();
    for (let box = node.parentElement; box; box = box.parentElement) {
      const style = getComputedStyle(box);
      if (style.overflowX === "visible" && style.overflowY === "visible")
        continue;
      const b = box.getBoundingClientRect();
      if (
        r.left < b.left - 1 ||
        r.right > b.right + 1 ||
        r.top < b.top - 1 ||
        r.bottom > b.bottom + 1
      )
        return box.className || box.tagName;
    }
    return "";
  });
  assert.equal(clipped, "", `Clipped: ${text}`);
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
  await until((s) => s.prompt?.title !== "Original encounter effect", "it");
  return settle();
}
/** The captions of this import's attachments, environments, side schemes
 * and minions in play. */
async function captions(s) {
  for (const p of s.attachments) {
    const caption = fneAttachmentCaption(s, p);
    if (caption) await shown(caption);
  }
  for (const p of s.environments || []) {
    const caption = fneEnvironmentCaption(s, p);
    if (caption) await shown(caption);
  }
  for (const p of s.sideSchemes) {
    const caption = fneSideSchemeCaption(s, p);
    if (caption) await shown(caption);
  }
  for (const p of s.minions) {
    const caption = fneMinionCaption(s, p);
    if (caption) await shown(caption);
  }
  for (const p of s.player.inPlay) {
    const caption = fneInPlayCaption(s, p);
    if (caption) await shown(caption);
  }
}
const BUGLE_SUPPORTS = ["60153", "60154", "60155", "60156"];
const TYPHOID_SIDES = { "60110a": "60110b", "60111a": "60111b" };
const MISSIONS = {
  fne_the_getaway: {
    name: "The Getaway",
    help: /Out Front, the villain cannot be hurt/,
    scheme: "60128b",
    modules: ["fne_cops", "fne_drive"],
    threat: 2,
  },
  fne_art_museum_heist: {
    name: "Art Museum Heist",
    help: /One random Art piece starts on the villain/,
    scheme: "60121b",
    modules: ["fne_cops", "fne_the_owl"],
    threat: 1,
  },
  fne_stop_the_presses: {
    name: "Stop the Presses!",
    help: /Each hero controls a random Daily Bugle support/,
    scheme: "60151b",
    modules: ["fne_tombstone", "fne_tracksuit_mafia"],
    threat: 1,
  },
};
const SETUPS = [
  ["fne_the_getaway", "standard", "bullseye"],
  ["fne_the_getaway", "expert", "electro"],
  ["fne_art_museum_heist", "standard", "hammerhead"],
  ["fne_art_museum_heist", "expert", "bullseye"],
  ["fne_stop_the_presses", "standard", "purple_man"],
  ["fne_stop_the_presses", "expert", "typhoid_mary"],
];
try {
  for (const width of widths)
    for (const [villainId, difficulty, underling] of SETUPS) {
      const m = MISSIONS[villainId];
      current = { kind: "setup", width, villainId, difficulty, underling };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: m.name, exact: true })
        .click();
      await page.getByText(m.help).waitFor();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Underling$/ }) })
        .getByRole("button", { name: UNDERLINGS[underling].name, exact: true })
        .click();
      if (underling === "typhoid_mary")
        await page.getByText(/^Typhoid Mary is never defeated/).waitFor();
      await page.locator("#mission-seed").fill("60128");
      await page.locator("#start-btn").click();
      let s = await settle();
      await page
        .getByRole("button", { name: "Keep hand & begin", exact: true })
        .click();
      s = await settle();
      assert.equal(s.phase, "player");
      assert.equal(s.villainId, villainId);
      assert.ok(s.fearNoEvil, "Fear No Evil's rules are on");
      assert.equal(s.fearNoEvil.underling, underling);
      assert.deepEqual(s.modules, m.modules);
      const stage = difficulty === "expert" ? 1 : 0;
      const code = UNDERLINGS[underling].codes[stage];
      assert.ok(
        [code, TYPHOID_SIDES[code]].includes(s.villain.code),
        "the Underling's stage, on either side for Typhoid Mary",
      );
      assert.equal(s.scheme.code, m.scheme);
      assert.equal(s.scheme.threat, m.threat);
      if (villainId === "fne_the_getaway") {
        assert.equal(s.fearNoEvil.speed, difficulty === "expert" ? 2 : 1);
        assert.ok(
          s.attachments.some(
            (p) => p.code === "60129a" && p.attachedTo === s.villain.id,
          ),
          "Out Front on the villain",
        );
      } else if (villainId === "fne_art_museum_heist")
        assert.equal(
          s.attachments.filter(
            (p) =>
              ["60122", "60123", "60124", "60125"].includes(p.code) &&
              p.attachedTo === s.villain.id,
          ).length,
          1,
          "one Art on the villain",
        );
      else {
        assert.ok(
          (s.environments || []).some((p) => p.code === "60152"),
          "the Daily Bugle in play",
        );
        const support = s.player.inPlay.find((p) =>
          BUGLE_SUPPORTS.includes(p.code),
        );
        assert.equal(support?.counters, 3, "a Daily Bugle support, 3 stamina");
        await artwork(["60152", support.code]);
      }
      if (underling === "typhoid_mary") {
        assert.ok(
          (s.environments || []).some((p) => p.code === "60112"),
          "Disturbed Psyche in play",
        );
        assert.equal(
          s.sideSchemes.find((p) => p.code === "60113a")?.counters,
          11,
          "Establish Trust: 8 threat and hinder 3 in Expert",
        );
      }
      await shown(fneObjective(s));
      await shown(fneMainNote(s));
      await captions(s);
      await artwork([
        s.villain.code,
        m.scheme,
        ...s.attachments.map((p) => p.code),
      ]);
      const owned = originals(s);
      await resumeExact();
      assert.deepEqual(originals(await saved()), owned);
      await audit(`setup-${villainId}-${difficulty}`, width);
      checks.push({ ...current, physicalCards: owned.length });
    }
  for (const width of [widths[0], widths.at(-1)]) {
    current = { kind: "outfront", width };
    let f = fixture("outfront");
    let owned = originals(f.state);
    await open(width, f.state);
    let s = await resolveFixture();
    assert.equal(s.scheme.threat, 0, "Out Front removes the threat instead");
    assert.ok(
      s.attachments.some((p) => p.code === "60129b"),
      "Out Front flips to Alongside",
    );
    assert.equal(s.villain.hp, 12, "Alongside: the villain takes 2 damage");
    await shown(fneObjective(s));
    await shown(fneMainNote(s));
    await artwork(["60129b"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("outfront", width);
    checks.push({ ...current });

    current = { kind: "spine", width };
    f = fixture("spine");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    const spine = s.attachments.find((p) => p.code === "60068a");
    assert.equal(spine.damage, 4, "Adamantium-Laced Spine holds 4 damage");
    assert.equal(s.villain.hp, 13);
    await captions(s);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("spine", width);
    checks.push({ ...current });

    current = { kind: "heist", width };
    f = fixture("heist");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    assert.equal(
      s.attachments.filter(
        (p) =>
          ["60122", "60123", "60124", "60125"].includes(p.code) &&
          p.attachedTo === s.villain.id,
      ).length,
      2,
      "Art Thief brings another Art to the villain",
    );
    await shown(fneMainNote(s));
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("heist", width);
    checks.push({ ...current });

    current = { kind: "drained", width };
    f = fixture("drained");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    const drained = s.attachments.find((p) => p.code === "60080");
    assert.equal(drained.attachedTo, "hero:p1");
    assert.equal(drained.counters, 3);
    await captions(s);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("drained", width);
    checks.push({ ...current });

    current = { kind: "vehicle", width };
    f = fixture("vehicle");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    const car = s.attachments.find((p) => p.code === "60186");
    assert.equal(car.attachedTo, s.villain.id, "Sports Car on the villain");
    await captions(s);
    await artwork(["60186"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("vehicle", width);
    checks.push({ ...current });

    current = { kind: "bugle", width };
    f = fixture("bugle");
    owned = originals(f.state);
    await open(width, f.state);
    s = await saved();
    const support = s.player.inPlay.find((p) =>
      BUGLE_SUPPORTS.includes(p.code),
    );
    await captions(s);
    await page
      .getByRole("button", {
        name: new RegExp(
          "^Alter-Ego Action · exhaust .*: 1 stamina counter on it$",
        ),
      })
      .first()
      .click();
    s = await until(
      (next) =>
        next.player.inPlay.find((p) => p.id === support.id)?.counters === 4,
      "the Daily Bugle's Alter-Ego Action",
    );
    assert.ok(s.player.inPlay.find((p) => p.id === support.id).exhausted);
    await captions(s);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("bugle", width);
    checks.push({ ...current });

    current = { kind: "typhoid", width };
    f = fixture("typhoid");
    owned = originals(f.state);
    await open(width, f.state);
    s = await resolveFixture();
    assert.deepEqual(s.fearNoEvil.psyche, { damage: 1, threat: 0 });
    assert.equal(s.villain.hp, s.villain.maxHp, "her hit points reset");
    await shown(fneObjective(s));
    await captions(s);
    await artwork(["60112", "60113a"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("typhoid", width);
    checks.push({ ...current });

    current = { kind: "tracksuit", width };
    f = fixture("tracksuit");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    const mafia = s.sideSchemes.find((p) => p.code === "60204");
    assert.equal(s.fearNoEvil.tucked[mafia.id].length, 1, "a minion tucked");
    await captions(s);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("tracksuit", width);
    checks.push({ ...current });

    current = { kind: "converted", width };
    f = fixture("converted");
    owned = originals(f.state, f.pending);
    await open(width, f.state);
    s = await resolveFixture();
    assert.ok(
      s.minions.some((p) => p.code === "01030" && p.fneConverted),
      "the ally is a Converted minion",
    );
    await captions(s);
    await artwork(["60100"]);
    assert.deepEqual(originals(s), owned);
    await resumeExact();
    await audit("converted", width);
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
