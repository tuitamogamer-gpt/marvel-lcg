import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const output = "output/expansion";
await mkdir(output, { recursive: true });
const bundle = await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
      import {newGame,dispatch} from './src/game/engine.ts';
      export function fixtures() {
        function begin(heroId,aspect) {
          let s=newGame({heroId,aspect,villainId:'mutagen_formula',seed:8021,pacing:'expert'});
          s=dispatch(s,{type:'MULLIGAN',ids:[]});
          if(s.error) throw Error(s.error);
          s.player.form='hero';
          return s;
        }
        const hulk=begin('hulk','aggression');
        const pool=[...hulk.player.hand,...hulk.player.deck];
        const chosen=['10003','10007'].map(code=>pool.splice(pool.findIndex(p=>p.code===code),1)[0]);
        hulk.player.hand=chosen; hulk.player.deck=pool;
        const indirect=begin('spider_man','justice');
        indirect.player.discard.push(...indirect.player.hand); indirect.player.hand=[];
        const ally=indirect.player.deck.splice(indirect.player.deck.findIndex(p=>p.code==='01083'),1)[0];
        if(!ally) throw Error('Mockingbird fixture needs its real player card');
        indirect.player.inPlay.push(ally);
        const bombs=indirect.encounter.deck.splice(indirect.encounter.deck.findIndex(p=>p.code==='02021'),1)[0];
        bombs.attachedTo=indirect.villain.id; indirect.attachments.push(bombs);
        const knight=indirect.encounter.deck.splice(indirect.encounter.deck.findIndex(p=>p.code==='02022'),1)[0];
        indirect.encounter.deck.unshift(knight);
        indirect.player.tough=true; indirect.player.toughCards=1;
        indirect.queue=[{type:'enemyAttack',id:'villain'}];
        indirect.prompt={kind:'choice',title:'Scenario fixture',text:'Start the real enemy activation.',options:[{id:'go',label:'Begin enemy attack',effects:[]}]};
        return {hulk,indirect,allyId:ally.id,knightId:knight.id};
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
  await load(data.hulk);
  await page.getByRole("button", { name: /^Attack/ }).click();
  await settle();
  const thrall = (await save()).minions[0];
  if ((await save()).prompt?.options.some((o) => o.id === thrall.id))
    await choice(thrall.id);
  await settle();
  let s = await save();
  assert.match(s.prompt.title, /Hulk Smash/);
  const smash = s.player.hand.find((p) => p.code === "10003");
  await choice(smash.id);
  await settle();
  s = await save();
  assert.equal(s.prompt.kind, "payment");
  await screenshot("hulk-smash-payment");
  await audit("Hulk Smash payment");
  await page
    .getByRole("button", { name: "Suggest resources", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Confirm payment", exact: true })
    .click();
  await settle();
  s = await save();
  if (s.prompt?.kind === "choice") await choice("continue");
  await settle();
  s = await save();
  assert.equal(s.minions.length, 0);
  assert.ok(s.villain.hp < data.hulk.villain.hp);
  assert.ok(s.player.discard.some((p) => p.id === smash.id));
  assert.equal(s.player.stunned, false);
  await screenshot("hulk-smash-result");
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual(await save(), s);
  checks.push(
    "Hulk Smash uses physical payment, defeats Guard, applies Overkill and survives reload",
  );

  await load(data.indirect);
  await choice("go");
  await settle();
  await choice("take");
  await settle();
  s = await save();
  assert.match(s.prompt.title, /Pumpkin Bombs/);
  assert.equal(s.player.tough, false);
  assert.ok(s.encounter.deck.some((p) => p.id === data.knightId));
  assert.ok(!s.resolving.some((p) => p.id === data.knightId));
  const hp = s.player.hp;
  await screenshot("pumpkin-bombs-allocation");
  await audit("Pumpkin Bombs indirect allocation");
  await choice(data.allyId);
  s = await save();
  await page.reload();
  await page.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual((await save()).prompt, s.prompt);
  await choice("hero");
  await settle();
  s = await save();
  assert.equal(s.player.hp, hp - 1);
  assert.equal(s.player.inPlay.find((p) => p.id === data.allyId).damage, 1);
  assert.equal(s.attachments.length, 0);
  checks.push(
    "Delayed boost shuffle precedes responses; indirect damage allocates to two characters and resumes saved decisions",
  );
  await screenshot("mutagen-allocation-result");
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: width > 1000 ? 1000 : 844 });
    const metrics = await page.evaluate(() => ({
      width: innerWidth,
      document: document.documentElement.scrollWidth,
    }));
    layouts.push(metrics);
    assert.ok(metrics.document <= width + 1);
    await screenshot(`mutagen-result-${width}`);
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await load(data.indirect);
  await page.setViewportSize({ width: 320, height: 844 });
  await choice("go");
  await settle();
  await choice("take");
  await settle();
  await screenshot("pumpkin-bombs-320");
  await audit("Pumpkin Bombs320");
  assert.deepEqual(errors, []);
  assert.ok(
    audits.every((a) => a.violations.length === 0),
    JSON.stringify(audits),
  );
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, audits, layouts, errors }, null, 2),
  );
  console.log(
    JSON.stringify({ checks, audits: audits.length, layouts, errors }, null, 2),
  );
} finally {
  await browser.close();
}
