import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const output = process.env.OUTPUT_DIR || "output/red-skull/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
const widths = (process.env.RED_SKULL_VIEWPORTS || "1280,768,390,320")
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
    contents: `
import {newGame,dispatch} from './src/game/engine.ts';
import {card} from './src/game/cards.ts';
import {heroStarterCodes} from './src/game/hero-runtime.ts';
import {syncSeat} from './src/game/team.ts';
export const definition=p=>card(p);
export function fixture(kind){
 let s=newGame({heroId:'spider_man',aspect:'justice',deckCards:heroStarterCodes('spider_man'),villainId:'red_skull',difficulty:'standard',seed:4128,pacing:'expert'});
 function command(c){s=dispatch(s,c);if(s.error)throw Error(s.error);}
 for(let n=0;n<100;n++){
  if(s.review){command({type:'PROCEED'});continue;}
  if(s.prompt?.kind==='choice'){const o=s.prompt.options.find(o=>/^(pass|skip|continue|none)$/.test(o.id))||s.prompt.options[0];command({type:'CHOOSE',id:o.id});continue;}
  if(s.phase==='mulligan'&&!s.prompt){command({type:'MULLIGAN',ids:[]});continue;}break;
 }
 if(s.phase!=='player'||s.prompt||s.review||!s.redSkull)throw Error('Original Red Skull setup incomplete');
 function take(code){for(const zone of[s.encounter.deck,s.encounter.discard,s.encounter.dealt,s.redSkull.sideDeck,s.redSkull.sideDiscard]){const i=zone.findIndex(p=>p.code===code);if(i>=0)return zone.splice(i,1)[0];}throw Error('Missing original encounter '+code);}
 function native(effects){s.prompt={kind:'choice',title:'Original Red Skull encounter',text:'Resolve the original encounter effect.',options:[{id:'go',label:'Resolve original encounter',effects}]};}
 const house=s.sideSchemes.find(p=>p.code==='04139');
 if(!house)throw Error('Original Red House missing');
 const result={houseId:house.id};
 if(kind==='side-deck-entry'){
  const side=take('04141');s.redSkull.sideDeck.unshift(side);result.sideId=side.id;
  native([{type:'villainStepOne',actorId:s.firstPlayerId}]);
 } else if(kind==='red-house-thwart'){
  house.counters=2;s.player.form='hero';s.player.exhausted=false;
 } else if(kind==='sleeper-entry'){
  const side=take('04140');s.redSkull.sideDeck.unshift(side);result.sideId=side.id;result.sleeperId=s.redSkull.sleeper.id;
  native([{type:'villainStepOne',actorId:s.firstPlayerId}]);
 } else if(kind==='twisted-reality'){
  house.counters=2;s.player.form='hero';s.player.exhausted=false;
  const attachment=take('04135');s.resolving.push(attachment);result.attachmentId=attachment.id;
  native([{type:'reveal',piece:attachment,skip:true,actorId:s.firstPlayerId}]);
 } else if(kind==='luger-payment'){
  s.player.form='hero';s.player.deck.push(...s.player.hand.splice(0));result.resourceIds=[];
  for(const code of ['01088','01089','01090']){const i=s.player.deck.findIndex(p=>p.code===code);if(i<0)throw Error('Missing original resource '+code);const p=s.player.deck.splice(i,1)[0];s.player.hand.push(p);result.resourceIds.push(p.id);}
  const attachment=take('04132');s.resolving.push(attachment);result.attachmentId=attachment.id;
  native([{type:'reveal',piece:attachment,skip:true,actorId:s.firstPlayerId}]);
 } else throw Error('Unknown fixture '+kind);
 syncSeat(s);return{state:s,...result};
}
`,
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
function pieces(s) {
  const nested = (p) => [
    p,
    ...(p.captured || []).flatMap(nested),
    ...(p.storedCards || []).flatMap(nested),
  ];
  return [
    s.villain,
    s.redSkull.currentMain,
    ...s.redSkull.mainDeck,
    ...s.redSkull.villainDeck,
    ...s.redSkull.sideDeck,
    ...s.redSkull.sideDiscard,
    ...(s.redSkull.sleeper ? [s.redSkull.sleeper] : []),
    ...s.players.flatMap((seat) => {
      const p = seat.id === s.activePlayerId ? s.player : seat.player;
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
    ...s.environments,
    ...s.removed,
    ...s.resolving,
    ...s.victoryDisplay,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...(s.encounter.storedBoosts || []),
    ...(s.attack?.pendingBoosts || []),
  ].flatMap(nested);
}
function originals(s) {
  const all = pieces(s);
  assert.equal(
    new Set(all.map((p) => p.id)).size,
    all.length,
    "Each physical card has one owner",
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
    if (sessionStorage.getItem("red-skull-check")) return;
    sessionStorage.setItem("red-skull-check", "1");
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
        /^(pass|skip|continue|none|resolve|take|allow|no)$/.test(o.id),
      ) ||
      (s.prompt.options.length === 1 || s.prompt.title === "Forced responses"
        ? s.prompt.options[0]
        : undefined);
    assert.ok(o, "Unhandled native prompt: " + JSON.stringify(s.prompt));
    await page.getByRole("button", { name: o.label, exact: true }).click();
  }
  throw Error("Native Red Skull continuation did not finish");
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
    "Native counters, queues and physical cards survive reload",
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
async function setupEvidence(s, difficulty) {
  assert.equal(s.villainId, "red_skull");
  assert.deepEqual(s.modules, ["hydra_assault", "hydra_patrol"]);
  assert.equal(s.villain.code, difficulty === "expert" ? "04126" : "04125");
  assert.equal(s.scheme.code, "04128b");
  assert.equal(s.redSkull.sleeper.code, "04130");
  assert.equal(s.sideSchemes.length, 1);
  assert.equal(s.sideSchemes[0].code, "04139");
  assert.equal(s.sideSchemes[0].counters, 3);
  assert.equal(s.redSkull.sideDeck.length, 6);
  assert.equal(s.redSkull.sideDiscard.length, 0);
  assert.ok(
    s.redSkull.sideDeck.every((p) => definition(p).type_code === "side_scheme"),
  );
  assert.ok(
    s.encounter.deck.every((p) => definition(p).type_code !== "side_scheme"),
  );
  assert.equal(s.encounter.dealt.length, difficulty === "expert" ? 1 : 0);
  assert.equal(
    pieces(s).filter((p) => definition(p).set_code === "red_skull").length,
    27,
    "Two villain stages select twenty-seven original physical Red Skull cards",
  );
  assert.equal(
    s.player.hand.length +
      s.player.deck.length +
      s.player.discard.length +
      s.player.inPlay.length,
    40,
  );
  await page
    .getByLabel("Side-scheme draw pile, 6 cards, face down", { exact: true })
    .waitFor();
  await page
    .getByRole("button", {
      name: "Side-scheme discard, 0 cards. Inspect pile",
      exact: true,
    })
    .waitFor();
  await page
    .getByText("Protected by the Red House · cannot take damage", {
      exact: true,
    })
    .waitFor();
  for (const code of [s.villain.code, s.scheme.code, "04139"]) {
    const img = page.locator('img[src*="' + code + '"]').first();
    await img.waitFor();
    await img.evaluate(async (image) => {
      await image.decode();
      if (!image.naturalWidth) throw Error("Missing original artwork");
    });
  }
}
async function thwartHouse(houseId) {
  await page.locator(".thwart-action").click();
  for (let n = 0; n < 60; n++) {
    const s = await saved();
    assert.ok(!s.error, s.error);
    if (s.review) {
      await page.locator("[role=dialog] [data-proceed]").last().click();
      continue;
    }
    if (!s.prompt) return s;
    const option =
      s.prompt.options?.find((o) => o.id === houseId) ||
      s.prompt.options?.find((o) => /ATK|attack/i.test(o.label)) ||
      s.prompt.options?.find((o) =>
        /^(pass|skip|continue|none|resolve|take|allow|no)$/.test(o.id),
      ) ||
      (s.prompt.options?.length === 1 ? s.prompt.options[0] : undefined);
    assert.ok(
      option,
      "Unexpected Red House thwart choice: " + JSON.stringify(s.prompt),
    );
    await page.getByRole("button", { name: option.label, exact: true }).click();
  }
  throw Error("Red House thwart did not finish");
}

try {
  for (const width of widths) {
    for (const difficulty of ["standard", "expert"]) {
      current = { kind: "standalone-setup", width, difficulty };
      await open(width);
      await page
        .locator(".villain-tabs")
        .getByRole("button", { name: "Red Skull", exact: true })
        .click();
      for (const [i, id] of ["hydra_assault", "hydra_patrol"].entries())
        assert.equal(
          await page
            .getByRole("combobox", {
              name: "Modular encounter " + (i + 1),
              exact: true,
            })
            .inputValue(),
          id,
        );
      await page
        .locator(".setting-line")
        .filter({ has: page.locator("span", { hasText: /^Difficulty$/ }) })
        .getByRole("button", {
          name: difficulty === "expert" ? "Expert" : "Standard",
          exact: true,
        })
        .click();
      await page.locator("#mission-seed").fill("4128");
      if (difficulty === "standard") await audit("mission-setup", width);
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
    for (const kind of [
      "side-deck-entry",
      "red-house-thwart",
      "sleeper-entry",
      "twisted-reality",
      "luger-payment",
    ]) {
      current = { kind, width };
      const f = fixture(kind),
        owned = originals(f.state);
      await open(width, f.state);
      await resumeExact();
      if (kind === "red-house-thwart") await thwartHouse(f.houseId);
      else
        await page
          .getByRole("button", {
            name: "Resolve original encounter",
            exact: true,
          })
          .click();
      let s = await settle();
      assert.equal(
        s.phase,
        "player",
        "The focused native effect finishes without ending the mission",
      );
      if (kind === "side-deck-entry") {
        assert.ok(
          s.sideSchemes.some(
            (p) => p.id === f.sideId && p.code === "04141" && p.counters === 3,
          ),
        );
        assert.equal(s.redSkull.sideDeck.length, 5);
        await page
          .getByLabel("Side-scheme draw pile, 5 cards, face down", {
            exact: true,
          })
          .waitFor();
      } else if (kind === "sleeper-entry") {
        assert.ok(s.sideSchemes.some((p) => p.id === f.sideId));
        assert.ok(
          s.minions.some(
            (p) =>
              p.id === f.sleeperId &&
              p.code === "04130" &&
              p.tough &&
              p.engagedWith === s.firstPlayerId,
          ),
        );
        assert.ok(!s.redSkull.sleeper);
        const tile = page.locator('[data-piece-id="' + f.sleeperId + '"]');
        await tile.scrollIntoViewIfNeeded();
        await tile
          .getByLabel("5 of 5 hit points remaining", { exact: true })
          .waitFor();
        await tile.getByText("GUARD", { exact: true }).waitFor();
      } else if (kind === "twisted-reality") {
        assert.ok(
          s.attachments.some(
            (p) => p.id === f.attachmentId && p.attachedTo === f.houseId,
          ),
        );
        await page
          .getByRole("button", {
            name: "Inspect Twisted Reality, attached to The Red House",
            exact: true,
          })
          .waitFor();
        await audit("twisted-reality-attached", width);
        s = await thwartHouse(f.houseId);
        assert.equal(
          s.encounter.dealt.length,
          1,
          "Twisted Reality deals first player an encounter card before defeat",
        );
        assert.ok(s.encounter.discard.some((p) => p.id === f.attachmentId));
      } else if (kind === "luger-payment") {
        assert.ok(
          s.attachments.some(
            (p) => p.id === f.attachmentId && p.attachedTo === s.villain.id,
          ),
        );
        await page
          .locator(".attached-piece")
          .filter({ has: page.locator('img[src*="04132"]') })
          .locator(".text-button")
          .click();
        assert.equal((await saved()).prompt.kind, "payment");
        await resumeExact();
        await audit("luger-typed-payment", width);
        const confirm = page.getByRole("button", {
          name: "Confirm payment",
          exact: true,
        });
        assert.ok(await confirm.isDisabled());
        await page.getByRole("button", { name: /^Energy ·/ }).click();
        assert.ok(await confirm.isDisabled());
        await page.getByRole("button", { name: /^Genius ·/ }).click();
        assert.ok(await confirm.isDisabled());
        await page.getByRole("button", { name: /^Strength ·/ }).click();
        assert.ok(await confirm.isEnabled());
        await confirm.click();
        s = await settle();
        assert.ok(!s.attachments.some((p) => p.id === f.attachmentId));
        assert.ok(s.encounter.discard.some((p) => p.id === f.attachmentId));
        assert.ok(
          f.resourceIds.every((id) =>
            s.player.discard.some((p) => p.id === id),
          ),
        );
      }
      if (kind === "red-house-thwart" || kind === "twisted-reality") {
        assert.ok(!s.sideSchemes.some((p) => p.id === f.houseId));
        assert.ok(s.redSkull.sideDiscard.some((p) => p.id === f.houseId));
        assert.ok(!s.encounter.discard.some((p) => p.id === f.houseId));
        assert.equal(
          await page
            .getByText("Protected by the Red House · cannot take damage", {
              exact: true,
            })
            .count(),
          0,
        );
        await page
          .getByRole("button", {
            name: "Side-scheme discard, 1 cards. Inspect pile",
            exact: true,
          })
          .click();
        await page
          .getByRole("heading", { name: "Side-scheme discard", exact: true })
          .waitFor();
        await page.locator('[role=dialog] img[src*="04139"]').first().waitFor();
        await page
          .locator("[role=dialog]")
          .getByRole("button", { name: /Close/ })
          .first()
          .click();
      }
      assert.deepEqual(originals(s), owned);
      await resumeExact();
      await audit(kind, width);
      checks.push({
        ...current,
        physicalCards: owned.length,
        exactReload: true,
      });
    }
  }
  current = { kind: "campaign-setup" };
  await open(1280);
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page
    .getByLabel("Mission preset", { exact: true })
    .selectOption("hydra");
  for (const [i, id] of [
    "crossbones",
    "absorbing_man",
    "taskmaster",
    "zola",
    "red_skull",
  ].entries())
    assert.equal(
      await page
        .getByLabel("Mission " + (i + 1) + " scenario", { exact: true })
        .inputValue(),
      id,
    );
  await page
    .getByText(
      "Official campaign rewards, obligations and carry-over rules are not applied.",
      { exact: false },
    )
    .waitFor();
  for (let i = 0; i < 4; i++)
    await page
      .getByRole("button", { name: "Remove mission 1", exact: true })
      .click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Red Skull finale");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  const campaign = await begin();
  await setupEvidence(campaign, "standard");
  assert.ok(campaign.campaign);
  await page.reload();
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(await saved(), campaign);
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await audit("campaign-table", width);
  }
  checks.push({ ...current, exactReload: true });
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
