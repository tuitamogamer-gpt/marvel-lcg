import { chromium } from "playwright";
import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import assert from "node:assert/strict";
const output = process.env.OUTPUT_DIR || "output/campaigns/browser";
const url = process.env.BASE_URL || "http://127.0.0.1:4173";
await mkdir(output, { recursive: true });
const require = createRequire(import.meta.url);
const axe = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const bundlePath = resolve(output, "fixtures.mjs");
await build({
  stdin: {
    resolveDir: process.cwd(),
    contents: `
import {dispatch} from './src/game/engine.ts';
export function outcomeFixture(input, won) {
 const s=structuredClone(input);
 if(s.phase!=='player') throw Error('Start the actual mission first');
 s.review=null;s.queue=[];
 s.prompt={kind:'choice',title:'Campaign result fixture',text:'Resolve the final native game effect.',options:[{id:'finish',label:'Resolve final game effect',effects:won?[{type:'damage',target:s.villain.id,amount:999},{type:'damage',target:'villain',amount:999}]:[{type:'damage',target:'hero',amount:999}]}]};
 return s;
}
`,
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundlePath,
  logLevel: "silent",
});
const { outcomeFixture } = await import(pathToFileURL(bundlePath).href);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1280, height: 900 },
  reducedMotion: "reduce",
});
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
page.on("pageerror", (e) => errors.push(e.message));
const saved = () =>
  page.evaluate(() => JSON.parse(localStorage.getItem("champions.save.v1")));
const library = () =>
  page.evaluate(() =>
    JSON.parse(localStorage.getItem("champions.campaigns.v1")),
  );
async function journal() {
  await page.getByRole("button", { name: "Campaigns", exact: true }).click();
  await page.getByRole("heading", { name: "Campaigns", exact: true }).waitFor();
}
async function audit(name) {
  await page.evaluate(axe);
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  const violations = result.violations.map(({ id, nodes }) => ({
    id,
    nodes: nodes.map(({ target, failureSummary }) => ({
      target,
      failureSummary,
    })),
  }));
  audits.push({ name, violations });
  assert.deepEqual(violations, [], name);
  const fit = await page.evaluate(() => ({
    width: innerWidth,
    content: document.documentElement.scrollWidth,
  }));
  layouts.push({ name, ...fit });
  assert.ok(fit.content <= fit.width + 1, `${name}: overflow`);
}
async function proceed() {
  for (let i = 0; i < 80; i++) {
    const s = await saved();
    if (s.review) {
      await page.locator("[role=dialog] [data-proceed]").last().click();
      continue;
    }
    if (s.prompt) {
      const option =
        s.prompt.options.find((o) =>
          /^(pass|skip|continue|resolve|none)$/.test(o.id),
        ) || s.prompt.options[0];
      await page
        .getByRole("button", { name: option.label, exact: true })
        .click();
      continue;
    }
    break;
  }
}
async function begin() {
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  await proceed();
  assert.equal((await saved()).phase, "player");
}
async function outcome(won) {
  const s = outcomeFixture(await saved(), won);
  await page.evaluate((s) => {
    localStorage.setItem("champions.save.v1", JSON.stringify(s));
    const c = JSON.parse(localStorage.getItem("champions.campaigns.v1"));
    c.find((c) => c.id === s.campaign.id).game = s;
    localStorage.setItem("champions.campaigns.v1", JSON.stringify(c));
  }, s);
  await page.reload();
  await journal();
  await page.getByRole("button", { name: /Resume mission · round/ }).click();
  await page
    .getByRole("button", { name: "Resolve final game effect", exact: true })
    .click();
  await proceed();
  assert.equal((await saved()).phase, won ? "won" : "lost");
}
try {
  await page.goto(url);
  await journal();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Avengers field journal");
  await page
    .getByRole("button", { name: "Remove mission 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  assert.equal((await library()).length, 1);
  const card = page.locator(".campaign-library article");
  await card.getByLabel("Campaign notes").fill("Meet again on Friday.");
  await card.getByRole("heading").click();
  await page.reload();
  await journal();
  assert.equal(
    await card.getByLabel("Campaign notes").inputValue(),
    "Meet again on Friday.",
  );
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await audit(`campaigns-${width}`);
    await page.screenshot({
      path: `${output}/campaigns-${width}.png`,
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  await card
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  const opening = await saved();
  assert.equal(opening.villainId, "rhino");
  await page.reload();
  await journal();
  await card.getByRole("button", { name: /Resume mission/ }).click();
  assert.deepEqual((await saved()).player.hand, opening.player.hand);
  assert.deepEqual((await saved()).player.deck, opening.player.deck);
  await begin();
  checks.push(
    "Create with selected deck, save notes, reload and resume exact opening hand/deck.",
  );
  await outcome(true);
  assert.equal((await library())[0].attempts.length, 1);
  await page
    .getByRole("button", { name: "Continue campaign", exact: true })
    .click();
  await card
    .getByRole("button", { name: "Start next mission", exact: true })
    .click();
  const next = await saved();
  assert.equal(next.villainId, "klaw");
  assert.deepEqual(next.players[0].deckCards, opening.players[0].deckCards);
  await begin();
  await outcome(false);
  await page
    .getByRole("button", { name: "Continue campaign", exact: true })
    .click();
  assert.equal((await library())[0].attempts.length, 2);
  await card
    .getByRole("button", { name: "Retry mission", exact: true })
    .click();
  await begin();
  assert.equal((await saved()).villainId, "klaw");
  await outcome(true);
  await page
    .getByRole("button", { name: "View completed campaign", exact: true })
    .click();
  assert.deepEqual(
    (await library())[0].attempts.map((a) => a.outcome),
    ["won", "lost", "won"],
  );
  await page.reload();
  await journal();
  assert.equal((await library())[0].attempts.length, 3);
  assert.equal(
    await card
      .getByRole("button", { name: /Start next|Retry mission|Resume mission/ })
      .count(),
    0,
  );
  checks.push(
    "Native victory advances, defeat retries with a new mission ID, final victory completes once across reload.",
  );
  await page
    .getByLabel("Mission preset", { exact: true })
    .selectOption("hydra");
  await page
    .getByRole("button", { name: "Remove mission 5", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove mission 4", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove mission 3", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove mission 1", exact: true })
    .click();
  await page.getByLabel("Campaign name", { exact: true }).fill("Crusher Creel");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await page
    .locator(".campaign-library article")
    .filter({
      has: page.getByRole("heading", { name: "Crusher Creel", exact: true }),
    })
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  assert.equal((await saved()).villainId, "absorbing_man");
  const absorbingOpening = await saved();
  await begin();
  await page.getByLabel("Delay counters: 0", { exact: true }).waitFor();
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await audit(`absorbing-table-${width}`);
  }
  checks.push(
    "Absorbing Man starts inside a campaign with original environment and visible delay counter.",
  );
  const authoritative = (await library())[0].game;
  await page.evaluate(
    (old) => localStorage.setItem("champions.save.v1", JSON.stringify(old)),
    absorbingOpening,
  );
  await page.reload();
  await journal();
  assert.deepEqual((await library())[0].game, authoritative);
  await page
    .locator(".campaign-library article")
    .filter({
      has: page.getByRole("heading", { name: "Crusher Creel", exact: true }),
    })
    .getByRole("button", { name: /Resume mission/ })
    .click();
  assert.equal((await saved()).phase, "player");
  assert.deepEqual((await saved()).player.hand, authoritative.player.hand);
  checks.push(
    "An older guest save cannot rewind the campaign's authoritative checkpoint on reload.",
  );
  await journal();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("button", { name: "Export saves", exact: true }).click(),
  ]);
  await download.saveAs(`${output}/campaign-backup.json`);
  const exported = JSON.parse(
    await readFile(`${output}/campaign-backup.json`, "utf8"),
  );
  assert.equal(exported.length, 2);
  assert.equal(exported[0].game.villainId, "absorbing_man");
  checks.push(
    "Campaign export includes both the completed journal and active table.",
  );
  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByText("Restore a campaign backup", { exact: true }).click();
  const upload = async (data) =>
    page.getByLabel("Campaign backup file", { exact: true }).setInputFiles({
      name: "campaigns.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  const creel = page.locator(".campaign-library article").filter({
    has: page.getByRole("heading", { name: "Crusher Creel", exact: true }),
  });
  await creel
    .getByLabel("Campaign notes")
    .fill("Keep these current notes unless replacement is selected.");
  await creel.getByRole("heading").click();
  await upload(exported);
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page
    .getByText("These campaigns are already saved.", { exact: false })
    .waitFor();
  assert.equal(
    (await library())[0].notes,
    "Keep these current notes unless replacement is selected.",
  );
  await page
    .getByLabel("Replace matching campaigns with the backup versions", {
      exact: false,
    })
    .check();
  await audit("campaign-import-390");
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page.getByText("Backup restored.", { exact: false }).waitFor();
  assert.equal(
    await creel.getByLabel("Campaign notes").inputValue(),
    exported[0].notes,
  );
  assert.deepEqual((await saved()).player.hand, exported[0].game.player.hand);
  checks.push(
    "Backup collisions preserve current progress until explicit replacement; restored notes and active tables refresh together.",
  );
  const beforeInvalid = await library();
  const invalid = structuredClone(exported);
  invalid[0].game.flags = null;
  await upload(invalid);
  await page
    .getByText("Invalid saved table progress.", { exact: true })
    .waitFor();
  assert.deepEqual(await library(), beforeInvalid);
  checks.push(
    "Malformed nested table backups are rejected without changing any saved campaign.",
  );
  await page.evaluate(() =>
    localStorage.setItem("champions.campaigns.v1", "unreadable saved data"),
  );
  await page.reload();
  await journal();
  await page
    .getByText("The campaign library could not be read.", { exact: false })
    .waitFor();
  await page.getByText("Restore a campaign backup", { exact: true }).click();
  await upload(exported);
  assert.equal(
    await page
      .getByRole("button", { name: "Restore backup", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("champions.campaigns.v1")),
    "unreadable saved data",
  );
  await page
    .getByLabel("Replace the unreadable campaign library.", { exact: false })
    .check();
  await page
    .getByRole("button", { name: "Restore backup", exact: true })
    .click();
  await page.getByText("Backup restored.", { exact: false }).waitFor();
  assert.equal((await library()).length, 2);
  assert.equal((await library())[1].attempts.length, 3);
  checks.push(
    "An unreadable library remains intact until explicit replacement, then a validated backup recovers active and completed campaigns.",
  );
  await page.setViewportSize({ width: 1280, height: 900 });
  await page
    .getByLabel("Mission preset", { exact: true })
    .selectOption("hydra");
  await page
    .getByRole("button", { name: "Remove mission 5", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove mission 4", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove mission 1", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Remove mission 1", exact: true })
    .click();
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Taskmaster rescue");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await page
    .locator(".campaign-library article")
    .filter({
      has: page.getByRole("heading", {
        name: "Taskmaster rescue",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Start campaign", exact: true })
    .click();
  assert.equal((await saved()).villainId, "taskmaster");
  assert.equal((await saved()).taskmaster.captives.length, 4);
  await begin();
  const taskmasterDeck = (await saved()).encounter.deck.length;
  await page
    .getByRole("button", { name: "Suit up Once per turn", exact: true })
    .click();
  await proceed();
  assert.equal((await saved()).player.form, "hero");
  assert.equal((await saved()).encounter.deck.length, taskmasterDeck - 1);
  await audit("taskmaster-table-1280");
  checks.push(
    "The Rise of Red Skull preset includes Taskmaster with four original captive allies; suiting up resolves his native encounter-card discard response.",
  );
  await journal();
  await page.evaluate(() => {
    const set = Storage.prototype.setItem;
    window.restoreCampaignStorage = () => {
      Storage.prototype.setItem = set;
    };
    Storage.prototype.setItem = function (k, v) {
      if (k === "champions.campaigns.v1")
        throw new DOMException("Quota", "QuotaExceededError");
      return set.call(this, k, v);
    };
  });
  await page
    .getByLabel("Campaign name", { exact: true })
    .fill("Unsaved campaign");
  await page
    .getByRole("button", { name: "Create campaign", exact: true })
    .click();
  await page
    .getByText("Campaign progress is not saved.", { exact: false })
    .waitFor();
  await page.evaluate(() => window.restoreCampaignStorage());
  await page
    .getByRole("button", { name: "Retry campaign save", exact: true })
    .click();
  assert.equal((await library()).length, 4);
  checks.push(
    "Failed storage writes show a persistent warning and retry saves all in-memory progress.",
  );
  assert.deepEqual(errors, []);
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, audits, layouts, errors }, null, 2),
  );
  console.log(
    JSON.stringify({
      flows: checks.length,
      audits: audits.length,
      layouts: layouts.length,
      errors: errors.length,
    }),
  );
} catch (e) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true });
  await writeFile(
    `${output}/failure.txt`,
    String(e) + "\n" + (await page.locator("body").innerText()),
  );
  throw e;
} finally {
  await browser.close();
}
