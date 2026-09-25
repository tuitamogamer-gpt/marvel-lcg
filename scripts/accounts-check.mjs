import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const base = process.env.BASE_URL || "http://127.0.0.1:5186";
const output = "output/accounts";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
const errors = [],
  audits = [],
  checks = [];
let expectedStorageFailure = false;
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (
    m.type() === "error" &&
    !(expectedStorageFailure && m.text().includes("503"))
  )
    errors.push(m.text());
});
const username = `qa_${Date.now()}`;
const password = "four friendly testing champions";
const session = () =>
  page.evaluate(() => fetch("/api/account").then((r) => r.json()));
const account = () =>
  page
    .getByRole("button", { name: "Open player profile", exact: true })
    .click();
async function poll(fn, label) {
  for (let i = 0; i < 60; i++) {
    if (await fn()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error(`Timed out: ${label}`);
}
async function audit(label) {
  await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  audits.push({
    label,
    violations: result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  });
}
async function shot(label) {
  await page.screenshot({ path: `${output}/${label}.png`, fullPage: true });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > innerWidth,
  );
  assert.equal(overflow, false, `Horizontal overflow: ${label}`);
}
try {
  await page.goto(base);
  await page
    .getByRole("button", { name: "Sign in or create account", exact: true })
    .click();
  await page
    .getByLabel("Player name", { exact: true })
    .fill("Friendly Champion");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password", { exact: true }).fill(password);
  await audit("registration");
  await shot("01-registration");
  await page
    .getByRole("button", { name: "CREATE ACCOUNT", exact: true })
    .click();
  await page
    .getByRole("heading", { name: "Keep your recovery code.", exact: true })
    .waitFor();
  const recovery = await page.locator(".account-recovery code").textContent();
  assert.equal(recovery.length, 48);
  assert.equal(
    await page.evaluate(() => document.cookie.includes("champions_session")),
    false,
  );
  const cookie = (await context.cookies()).find(
    (c) => c.name === "champions_session",
  );
  assert.equal(cookie.httpOnly, true);
  checks.push("Registration, one-time recovery code and HttpOnly cookie");
  await page.getByRole("button", { name: "I have saved my code" }).click();
  await page.getByRole("button", { name: "BUILD A DECK", exact: true }).click();
  await page
    .getByLabel("Deck name", { exact: true })
    .fill("Queens night patrol");
  await page
    .getByRole("combobox", { name: "Copies of For Justice!", exact: true })
    .selectOption("3");
  await shot("02-deck-builder");
  await audit("deck builder");
  await page.getByRole("button", { name: "SAVE DECK", exact: true }).click();
  await page
    .getByRole("heading", { name: "Queens night patrol", exact: true })
    .waitFor();
  assert.equal((await session()).library.decks[0].cards.length, 41);
  await shot("03-saved-decks");
  await page.getByRole("button", { name: "USE DECK", exact: true }).click();
  await page
    .getByRole("button", { name: "View 41-card deck", exact: false })
    .waitFor();
  await page
    .getByRole("button", { name: "START MISSION", exact: false })
    .click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  await poll(
    async () => (await session()).library.missions.length === 1,
    "initial mission save",
  );
  const opening = (await session()).library.missions[0];
  assert.equal(
    opening.state.player.hand.length + opening.state.player.deck.length,
    41,
  );
  assert.equal(
    await page.evaluate(() => localStorage.getItem("champions.save.v1")),
    null,
  );
  checks.push(
    "Saved 41-card custom deck is used by the engine; account saves stay out of guest localStorage",
  );
  await page.reload();
  await account();
  await page.getByRole("button", { name: /^Continue playing/ }).click();
  await shot("04-saved-missions");
  await page.getByRole("button", { name: "RESUME", exact: true }).click();
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .waitFor();
  await poll(
    async () =>
      (await session()).library.missions[0].revision > opening.revision,
    "resumed save",
  );
  assert.deepEqual(
    (await session()).library.missions[0].state.player,
    opening.state.player,
  );
  checks.push("Reload and resume restores the exact pending opening hand");
  expectedStorageFailure = true;
  let failSave = true;
  await page.route("**/api/account", async (route) => {
    if (
      failSave &&
      route.request().method() === "POST" &&
      route.request().postDataJSON()?.action === "mission.save"
    ) {
      failSave = false;
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Test storage interruption. Please retry.",
        }),
      });
    } else await route.continue();
  });
  await page
    .getByRole("button", { name: "Keep hand & begin", exact: true })
    .click();
  await page.locator(".account-sync.error").waitFor();
  const viewTable = page.getByRole("button", {
    name: "View table",
    exact: true,
  });
  if (await viewTable.count()) await viewTable.last().click();
  await page.getByRole("button", { name: "Retry save", exact: true }).click();
  await poll(
    async () =>
      (await session()).library.missions[0].state.phase !== "mulligan",
    "mulligan saved",
  );
  await page.unroute("**/api/account");
  expectedStorageFailure = false;
  checks.push(
    "Failed autosave is visible and Retry save preserves the pending mission",
  );
  // Seed a near-victory fixture, then finish it through the real gameplay UI.
  await page.evaluate(async () => {
    const account = await fetch("/api/account").then((r) => r.json());
    const record = account.library.missions[0],
      s = record.state;
    s.phase = "player";
    s.prompt = null;
    s.review = null;
    s.queue = [];
    s.minions = [];
    s.attachments = [];
    s.player.form = "hero";
    s.player.exhausted = false;
    s.player.stunned = false;
    s.players[0].player = s.player;
    s.villain.stage = 2;
    s.villain.code = "01095";
    s.villain.hp = 1;
    s.villain.tough = false;
    const response = await fetch("/api/account", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Champions-Client": "1",
      },
      body: JSON.stringify({
        action: "mission.save",
        accountId: account.user.id,
        id: record.id,
        revision: record.revision,
        startedAt: record.startedAt,
        state: s,
      }),
    });
    if (!response.ok) throw Error(await response.text());
  });
  await page.reload();
  await account();
  await page.getByRole("button", { name: /^Continue playing/ }).click();
  await page.getByRole("button", { name: "RESUME", exact: true }).click();
  await page.getByRole("button", { name: /^Attack/ }).click();
  for (let i = 0; i < 10; i++) {
    const won = (await session()).library.missions.some(
      (m) => m.outcome === "won",
    );
    if (won) break;
    const proceed = page.getByRole("button", { name: /^Proceed/ });
    if (await proceed.count()) await proceed.last().click();
    else {
      const villain = page
        .getByRole("dialog")
        .getByRole("button", { name: /Rhino/ });
      if (await villain.count()) await villain.first().click();
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  await poll(
    async () =>
      (await session()).library.missions.some((m) => m.outcome === "won"),
    "automatic victory history",
  );
  await page.reload();
  await account();
  await page.getByRole("button", { name: /^Mission history/ }).click();
  await page.getByText("VICTORY", { exact: true }).waitFor();
  assert.equal((await session()).library.missions.length, 1);
  await shot("05-history");
  await audit("profile history");
  checks.push("Real engine victory is recorded once in mission history");
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await shot(`06-history-${width}`);
    await audit(`profile ${width}`);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await page
    .getByRole("button", { name: "Sign in", exact: true })
    .last()
    .click();
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "SIGN IN", exact: true }).click();
  await page
    .getByRole("heading", { name: "Friendly Champion", exact: true })
    .waitFor();
  assert.equal((await session()).library.decks[0].name, "Queens night patrol");
  checks.push("Sign out and sign in preserve the private library");
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await page
    .getByLabel("Deck name", { exact: true })
    .fill("Queens updated patrol");
  await page.getByRole("button", { name: "SAVE DECK", exact: true }).click();
  await page
    .getByRole("heading", { name: "Queens updated patrol", exact: true })
    .waitFor();
  assert.equal((await session()).library.decks[0].revision, 2);
  await page
    .getByRole("button", { name: "Delete Queens updated patrol", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete deck", exact: true }).click();
  await poll(
    async () => (await session()).library.decks.length === 0,
    "deck deletion",
  );
  checks.push("Existing decks can be edited and explicitly deleted on mobile");
  const isolated = await browser.newContext();
  const other = await isolated.request.get(`${base}/api/account`);
  assert.equal((await other.json()).user, null);
  await isolated.close();
  assert.equal(errors.length, 0, errors.join("\n"));
  assert.equal(
    audits.flatMap((a) => a.violations).length,
    0,
    JSON.stringify(audits, null, 2),
  );
  console.log(JSON.stringify({ checks, errors, audits }, null, 2));
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors, audits }, null, 2),
  );
  await browser.close();
}
