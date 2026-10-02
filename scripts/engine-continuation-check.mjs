import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const output = "output/engine-continuation";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch,makePiece} from './src/game/engine.ts';
      export function fixtures() {
        function begin(heroId,aspect,villainId) {
          let s=newGame({heroId,aspect,villainId,seed:22031,pacing:'expert'});
          s=dispatch(s,{type:'MULLIGAN',ids:[]});
          if(s.error) throw Error(s.error);s.player.form='hero';
          return s;
        }
        function take(s,code) {
          for(const zone of [s.player.hand,s.player.deck,s.player.discard]) {
            const i=zone.findIndex(p=>p.code===code);if(i>=0) return zone.splice(i,1)[0];
          }
          return makePiece(s,code);
        }
        function hand(s,codes) {
          const pieces=codes.map(code=>take(s,code));s.player.deck.push(...s.player.hand);s.player.hand=pieces;return pieces;
        }
        const thor=begin('thor','aggression','risky_business');
        const th=hand(thor,['06006','01088','01090']);
        const ms=begin('ms_marvel','protection','rhino');
        const mh=hand(ms,['05003','01088']);
        const embiggen=take(ms,'05010'),bruno=take(ms,'05007');bruno.storedCards=[take(ms,'01090')];ms.player.inPlay.push(embiggen,bruno);
        const block=begin('ms_marvel','protection','risky_business');
        const allTied=makePiece(block,'02048');allTied.attachedTo='hero:p1';block.attachments.push(allTied);block.player.exhausted=true;
        hand(block,['01089','01090']);
        const media=makePiece(block,'02049');media.attachedTo='hero:p1';block.attachments.push(media);
        const lockjaw=take(block,'05018');block.player.discard.push(lockjaw);
        const robot=makePiece(block,'05028');robot.engagedWith='p1';block.minions.push(robot);
        const tower=begin('ms_marvel','leadership','rhino');
        for(const code of ['03024','03011','03013','03014','01066']) tower.player.inPlay.push(take(tower,code));
        let retaliate=begin('captain_america','aggression','klaw');
        retaliate.player.hp=2;retaliate.player.tough=true;retaliate.player.toughCards=1;
        const sh=retaliate.player.inPlay.find(p=>p.code==='03009');if(!sh) retaliate.player.inPlay.push(take(retaliate,'03009'));
        const modok=makePiece(retaliate,'01184');modok.engagedWith='p1';retaliate.minions=[modok];
        const armor=makePiece(retaliate,'01153');armor.attachedTo=retaliate.villain.id;retaliate.attachments.push(armor);
        const tossHand=hand(retaliate,['03006','03003','03003']);
        function cmd(s,c) {s=dispatch(s,c);if(s.error) throw Error(s.error);let n=0;while(s.review&&n++<50)s=dispatch(s,{type:'PROCEED'});return s;}
        retaliate=cmd(retaliate,{type:'PLAY',id:tossHand[0].id});
        retaliate=cmd(retaliate,{type:'SELECT',ids:tossHand.slice(1).map(p=>p.id)});
        retaliate=cmd(retaliate,{type:'SELECT',ids:[modok.id,retaliate.villain.id]});
        return {thor,ms,block,tower,retaliate,thorEventId:th[0].id,msEventId:mh[0].id,brunoId:bruno.id,allTiedId:allTied.id};
      }`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false,
});
const { fixtures } = await import(
  `data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString("base64")}`
);
const data = fixtures();
const browser = await chromium.launch({ headless: true });
let context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
let page = await context.newPage();
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
const url = process.env.BASE_URL || "http://127.0.0.1:5174";
const save = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
async function load(s) {
  await context.close();
  context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
  });
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.addInitScript((s) => {
    if (sessionStorage.getItem("expansion-fixture-loaded")) return;
    localStorage.setItem("champions.save.v1", JSON.stringify(s));
    localStorage.setItem("champions.sound", "off");
    localStorage.setItem("champions.pacing", "expert");
    sessionStorage.setItem("expansion-fixture-loaded", "yes");
  }, s);
  await page.goto(url);
  await page.getByRole("button", { name: /Resume mission/ }).click();
}
async function choice(id) {
  const s = await save();
  assert.equal(s.prompt?.kind, "choice");
  const index = s.prompt.options.findIndex((o) => o.id === id);
  assert.ok(
    index >= 0,
    `${s.prompt.title}: missing ${id}; options ${s.prompt.options.map((o) => o.id).join(", ")}; hand ${s.player.hand.map((p) => p.id + ":" + p.code).join(", ")}; seats ${s.players[0].player.hand.map((p) => p.id + ":" + p.code).join(", ")}`,
  );
  await page.locator(".decision-option").nth(index).click();
}
async function settle() {
  for (let i = 0; i < 50; i++) {
    const s = await save();
    if (!s.review) return s;
    await page.getByRole("button", { name: "Proceed", exact: true }).click();
  }
  throw Error("Review queue did not settle");
}
async function screenshot(name) {
  await page.locator(".combat-cinematic").waitFor({ state: "hidden" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      [...document.images]
        .filter((i) => i.getClientRects().length && i.loading !== "lazy")
        .map((i) => i.decode()),
    );
  });
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
async function audit(name) {
  const require = createRequire(import.meta.url);
  await page.evaluate(
    await readFile(require.resolve("axe-core/axe.min.js"), "utf8"),
  );
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  audits.push({
    name,
    violations: result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  });
}
try {
  await load(data.thor);
  await page
    .getByRole("button", { name: "Play now: Lightning Strike", exact: true })
    .click();
  await settle();
  assert.equal((await save()).prompt.title, "Lightning Strike");
  await screenshot("lightning-x-choice");
  await audit("Lightning X choice");
  await choice("2");
  await settle();
  assert.equal((await save()).prompt.cost, 3);
  await page
    .getByRole("button", { name: "Suggest resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  await settle();
  let s = await save();
  while (s.prompt) {
    assert.equal(s.prompt.kind, "choice");
    await choice(
      s.prompt.options.find((o) => o.id === "hero")?.id ||
        s.prompt.options[0].id,
    );
    await settle();
    s = await save();
  }
  assert.equal(s.villain.code, "02001b");
  assert.equal(s.environments[0].code, "02006b");
  assert.equal(s.environments[0].counters, 2);
  assert.equal(s.player.hp, data.thor.player.hp - 3);
  await screenshot("thor-goblin-form");
  await audit("Goblin environment and identity");
  assert.match(
    await page.locator(".scenario-environment").innerText(),
    /State of Madness/,
  );
  assert.match(
    await page.locator(".villain-info h2").innerText(),
    /GREEN GOBLIN/,
  );
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(await save(), s);
  checks.push(
    "Lightning atomic X-energy payment, Risky flip with reveal damage, actual environment counters and save/reload",
  );
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    const metric = await page.evaluate(() => ({
      width: innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    layouts.push(metric);
    assert.ok(metric.document <= width + 1);
    await screenshot("risky-" + width);
  }
  await load(data.ms);
  await page
    .getByRole("button", { name: "Play now: Big Hands", exact: true })
    .click();
  await settle();
  await page
    .getByRole("button", { name: "Suggest resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  await settle();
  assert.equal((await save()).prompt.title, "Embiggen!");
  await choice("use");
  await settle();
  assert.equal((await save()).prompt.title, "Morphogenetics");
  await screenshot("morphogenetics-response");
  await audit("Morphogenetics response");
  await choice("yes");
  await settle();
  s = await save();
  assert.equal(s.villain.hp, data.ms.villain.hp - 6);
  assert.equal(s.player.exhausted, true);
  assert.ok(s.player.hand.some((p) => p.id === data.msEventId));
  assert.match(await page.locator(".stored-token").innerText(), /1/);
  await screenshot("ms-event-return-and-storage");
  await page.getByRole("button", { name: /Bruno.*retrieve/ }).click();
  await settle();
  assert.equal((await save()).prompt.kind, "select");
  await page.locator(".decision-option").first().click();
  await page
    .getByRole("button", { name: "Confirm selection", exact: true })
    .click();
  await settle();
  s = await save();
  assert.equal(
    s.player.inPlay.find((p) => p.id === data.brunoId).storedCards.length,
    0,
  );
  checks.push(
    "Embiggen 6 damage, actual discard then Morph return, explicit Bruno storage/retrieval",
  );
  await load(data.block);
  assert.equal(
    await page
      .getByRole("button", { name: /Suit up|Become Kamala/ })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page
      .getByRole("button", { name: /Play Lockjaw from discard/ })
      .count(),
    1,
  );
  assert.equal(
    await page.getByRole("button", { name: /blank the Robot/ }).count(),
    1,
  );
  await page.getByRole("button", { name: /discard All Tied Up/ }).click();
  await settle();
  assert.equal((await save()).prompt.kind, "payment");
  await screenshot("all-tied-up-payment");
  await audit("Identity attachments and atomic payment");
  await page
    .getByRole("button", { name: "Suggest resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  await settle();
  s = await save();
  assert.ok(!s.attachments.some((p) => p.id === data.allTiedId));
  checks.push(
    "Identity attachment removal, form lock, Lockjaw discard button and Robot action visible",
  );
  await load(data.tower);
  assert.equal(
    await page
      .locator(".zone-label")
      .filter({ hasText: "YOUR PLAY AREA" })
      .innerText()
      .then((t) => /4\s*\/\s*4\s*allies/.test(t)),
    true,
  );
  assert.match(
    await page.locator(".tableau-group.allies .table-group-label").innerText(),
    /4\s*\/\s*4/,
  );
  await screenshot("avengers-tower-limit");
  await audit("Native ally capacity");
  checks.push(
    "Avengers Tower ally capacity matches the native rules in both play-area labels",
  );
  await load(data.retaliate);
  assert.equal((await save()).prompt?.title, "Forced responses");
  await screenshot("retaliate-order");
  await audit("Mandatory attack response order");
  await page.reload();
  assert.equal((await save()).prompt?.title, "Forced responses");
  await page.getByRole("button", { name: /Resume mission/ }).click();
  const beforeOrder = await save();
  const response = beforeOrder.prompt.options.find((o) =>
    o.label.includes("M.O.D.O.K."),
  );
  assert.ok(response, "M.O.D.O.K. must be a visible forced-response choice");
  await choice(response.id);
  await settle();
  assert.equal((await save()).player.hp, 1);
  assert.equal((await save()).player.tough, false);
  checks.push(
    "Saved mandatory Retaliate order choice resolves actual Tough and identity damage through browser controls",
  );
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((a) => a.violations.length === 0),
    JSON.stringify(audits),
  );
  await writeFile(
    output + "/report.json",
    JSON.stringify({ checks, audits, layouts, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ checks, audits: audits.length, layouts, errors }, null, 2),
  );
} finally {
  await browser.close();
}
