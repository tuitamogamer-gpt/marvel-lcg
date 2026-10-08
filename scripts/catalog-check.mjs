import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const output = "output/catalog";
await mkdir(output, { recursive: true });
const readJson = async (name) =>
  JSON.parse(await readFile(`src/data/${name}.json`, "utf8"));
const [packs, importedCards, sourceDecks, corePlayer, coreEncounter] =
  await Promise.all([
    readJson("catalog-packs"),
    readJson("catalog-cards"),
    readJson("catalog-decks"),
    readJson("core-player"),
    readJson("core-encounter"),
  ]);
const cards = [
  ...new Map(
    [...importedCards, ...corePlayer, ...coreEncounter].map((c) => [c.code, c]),
  ).values(),
];
const cardIndex = new Map(importedCards.map((c) => [c.code, c]));
const packIndex = new Map(packs.map((p) => [p.code, p]));
const expectedHeroes = new Set(
  importedCards
    .filter((c) => c.type_code === "hero" && c.set_code)
    .map((c) => `${c.pack_code}:${c.set_code}`),
).size;
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const errors = [],
  checks = [],
  audits = [],
  layouts = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(message.text());
});
const dialog = () =>
  page.getByRole("dialog", { name: "All heroes & starter decks", exact: true });
const detail = () => dialog().locator(".catalog-hero-detail");
const sourceProduct = () => detail().locator(":scope > .product-source");

async function audit(name) {
  if (!(await page.evaluate(() => !!window.axe)))
    await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
  const result = await page.evaluate(() =>
    window.axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
    }),
  );
  audits.push({
    name,
    violations: result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => ({
        target: n.target,
        message: n.failureSummary,
      })),
    })),
  });
}
async function capture(name) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(
      Array.from(document.images)
        .filter((img) => img.getClientRects().length && img.loading !== "lazy")
        .map((img) => img.decode()),
    );
    await new Promise(requestAnimationFrame);
  });
  await page.screenshot({
    path: `${output}/${name}.png`,
    fullPage: !(await page.getByRole("dialog").count()),
  });
}
async function fit(name, width) {
  await page.setViewportSize({ width, height: 900 });
  const metrics = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    dialogs: Array.from(document.querySelectorAll('[role="dialog"]')).map(
      (node) => ({ width: node.clientWidth, content: node.scrollWidth }),
    ),
  }));
  layouts.push({ name, ...metrics });
  assert.ok(
    metrics.document <= width + 1,
    `${name}: page overflow ${metrics.document}px / ${width}px`,
  );
  assert.ok(
    metrics.dialogs.every((item) => item.content <= item.width + 1),
    `${name}: dialog contents overflow`,
  );
}
async function openCatalog() {
  await page.locator(".content-entry").click();
  await dialog().waitFor();
}
async function selectHero(name, identity) {
  await dialog()
    .getByRole("textbox", { name: "Search heroes and products" })
    .fill(name);
  let row = dialog()
    .locator(".catalog-hero-row")
    .filter({ has: page.locator("b", { hasText: name }) });
  if (identity) row = row.filter({ hasText: identity });
  await row.first().click();
  assert.ok(
    (await detail().locator("h3").innerText())
      .toLowerCase()
      .includes(name.toLowerCase()),
  );
}
async function inspectDeckCard(selector = ".catalog-deck-list > button") {
  const row = detail().locator(selector).first();
  const code = await row.getAttribute("data-card-preview");
  await row.click();
  assert.equal(
    await page.getByRole("dialog").count(),
    2,
    "Card inspection should sit above the catalog",
  );
  assert.ok(
    (
      await page
        .getByRole("dialog")
        .last()
        .locator(".product-source")
        .innerText()
    ).includes(packIndex.get(cardIndex.get(code).pack_code).name),
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page.getByRole("dialog").count(),
    1,
    "Escape must close only the nested inspection",
  );
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.getAttribute("data-card-preview"),
    ),
    code,
    "Focus returns to the inspected deck row",
  );
}
async function collectionCodes() {
  return page
    .locator(".collection-card [data-card-preview]")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-card-preview")),
    );
}

try {
  await page.goto(process.env.BASE_URL || "http://localhost:5174");
  await page.evaluate(() => document.fonts.ready);
  await openCatalog();
  assert.ok(
    (await dialog().locator(".catalog-intro").innerText()).includes(
      `${expectedHeroes} heroes`,
    ),
  );
  assert.equal(await dialog().locator(".catalog-hero-row").count(), 14);
  assert.ok((await sourceProduct().innerText()).includes("Core Set"));
  await dialog().getByRole("button", { name: "Next hero page" }).click();
  assert.ok(
    (await dialog().locator(".catalog-pagination").innerText()).includes(
      "15–28",
    ),
  );
  await dialog()
    .getByRole("combobox", { name: "Filter hero product type" })
    .selectOption({ label: "Hero Pack" });
  assert.ok(
    (await dialog().locator(".catalog-result-count").innerText()).match(
      /\d+ heroes/,
    ),
  );
  assert.equal(
    await dialog()
      .locator(".catalog-hero-row")
      .evaluateAll((rows) =>
        rows.every((row) => !row.innerText.includes("Core Set")),
      ),
    true,
  );
  await dialog()
    .getByRole("combobox", { name: "Filter hero product type" })
    .selectOption("all");
  await dialog()
    .getByRole("combobox", { name: "Filter hero product", exact: true })
    .selectOption("fne");
  assert.equal(await dialog().locator(".catalog-hero-row").count(), 2);
  assert.ok(
    (await dialog().locator(".catalog-hero-list").innerText()).includes(
      "Daredevil",
    ),
  );
  await dialog()
    .getByRole("combobox", { name: "Filter hero product", exact: true })
    .selectOption("all");
  checks.push(
    "Complete roster, hero pagination, product-type and campaign-product filters",
  );

  await selectHero("Captain America");
  assert.ok((await sourceProduct().innerText()).includes("Hero Pack"));
  assert.ok((await sourceProduct().innerText()).includes("Sold separately"));
  assert.ok((await sourceProduct().innerText()).includes("Released"));
  assert.ok(
    (await detail().locator(".catalog-status").innerText()).includes(
      "Ready for automated missions",
    ),
  );
  assert.equal(
    await detail()
      .getByRole("button", { name: /Choose .* for mission/ })
      .count(),
    1,
  );
  const cap = sourceDecks.find(
    (deck) => cardIndex.get(deck.heroCode)?.name === "Captain America",
  );
  assert.ok(
    cap,
    "Captain America's source preconstructed list must be imported",
  );
  if (await detail().locator(".catalog-deck-select").count())
    await detail().locator(".catalog-deck-select").selectOption(cap.id);
  assert.equal(
    await detail().locator(".catalog-deck-list > button").count(),
    Object.keys(cap.cards).length,
  );
  assert.ok(
    (await detail().locator(".catalog-deck-title").innerText())
      .toLowerCase()
      .includes(`${Object.values(cap.cards).reduce((a, b) => a + b, 0)} cards`),
  );
  assert.equal(
    await detail()
      .getByRole("link", { name: "Deck list source" })
      .getAttribute("href"),
    cap.sourceUrl,
  );
  const visibleDeck = await detail()
    .locator(".catalog-deck-list > button")
    .evaluateAll((rows) =>
      Object.fromEntries(
        rows.map((row) => [
          row.getAttribute("data-card-preview"),
          Number(row.querySelector("strong").textContent.replace("×", "")),
        ]),
      ),
    );
  assert.deepEqual(visibleDeck, cap.cards);
  const sourceNames = [
    ...new Set(
      Object.keys(cap.cards).map(
        (code) => packIndex.get(cardIndex.get(code).pack_code).name,
      ),
    ),
  ];
  for (const name of sourceNames)
    assert.ok(
      (await detail().locator(".catalog-deck-products").innerText()).includes(
        name,
      ),
    );
  await capture("standalone-hero-deck-desktop");
  await audit("standalone-hero-deck-desktop");
  await inspectDeckCard();
  assert.ok(
    (await detail().locator(".catalog-default-deck-note").innerText()).includes(
      "exact 40-card source preconstructed list",
    ),
  );
  await detail()
    .getByRole("button", {
      name: "Choose Captain America for mission",
      exact: true,
    })
    .click();
  let setup = await page.evaluate(() =>
    JSON.parse(window.render_game_to_text()),
  );
  assert.equal(setup.team[0].heroId, "captain_america");
  assert.equal(setup.team[0].aspect, cap.aspect);
  assert.equal(setup.team[0].deckName, cap.name);
  assert.equal(setup.team[0].deckOrigin, "source");
  assert.deepEqual(
    [...setup.team[0].deckCards].sort(),
    Object.entries(cap.cards)
      .flatMap(([code, quantity]) => Array(quantity).fill(code))
      .sort(),
  );
  await page
    .getByRole("button", { name: "View 40-card deck", exact: false })
    .click();
  assert.ok(
    (await page.locator(".deck-provenance").innerText()).includes(
      "Source preconstructed list",
    ),
  );
  assert.ok(
    (await page.locator(".deck-provenance").innerText()).includes(
      "Captain America",
    ),
  );
  await page.keyboard.press("Escape");
  await openCatalog();
  checks.push(
    "Standalone product provenance, exact executable source deck configuration, source label in mission setup, nested Escape and focus restoration",
  );

  await selectHero("Daredevil");
  assert.ok((await sourceProduct().innerText()).includes("Fear No Evil"));
  assert.ok((await sourceProduct().innerText()).includes("Campaign Expansion"));
  assert.ok(!(await sourceProduct().innerText()).includes("Sold separately"));
  await capture("campaign-hero-desktop");
  await selectHero("Ironheart");
  assert.equal(
    await detail()
      .getByRole("combobox", { name: "Choose identity form" })
      .locator("option")
      .count(),
    6,
  );
  const identityForms = await detail()
    .getByRole("combobox", { name: "Choose identity form" })
    .locator("option")
    .evaluateAll((options) => options.map((option) => option.value));
  await detail()
    .getByRole("combobox", { name: "Choose identity form" })
    .selectOption(identityForms.at(-1));
  assert.equal(
    await detail()
      .locator(".catalog-identity-art")
      .getAttribute("data-card-preview"),
    identityForms.at(-1),
  );
  checks.push(
    "Boxed campaign heroes and all alternate Ironheart identity forms",
  );

  await selectHero("Spectrum");
  const spectrum = sourceDecks.find(
    (deck) => cardIndex.get(deck.heroCode)?.name === "Spectrum",
  );
  const spectrumSetup = Object.values(spectrum.setupCards).reduce(
    (a, b) => a + b,
    0,
  );
  const spectrumSize =
    Object.values(spectrum.cards).reduce((a, b) => a + b, 0) - spectrumSetup;
  assert.ok(
    (await detail().locator(".catalog-deck-title").innerText())
      .toLowerCase()
      .includes(`${spectrumSize} cards in deck`),
  );
  assert.equal(
    await detail()
      .locator(".catalog-starts-in-play .catalog-auxiliary-list > button")
      .count(),
    Object.keys(spectrum.setupCards).length,
  );
  assert.ok(
    (await detail().locator(".catalog-starts-in-play p").innerText()).includes(
      "included in the composition above",
    ),
  );
  assert.ok(
    (await detail().locator(".catalog-source-note").innerText()).includes(
      "Permanent",
    ),
  );
  await selectHero("Storm");
  const storm = sourceDecks.find(
    (deck) => cardIndex.get(deck.heroCode)?.name === "Storm",
  );
  assert.equal(
    await detail()
      .locator(".catalog-supplementary-cards .catalog-auxiliary-list > button")
      .count(),
    Object.keys(storm.supplementaryCards).length,
  );
  assert.ok(
    (
      await detail().locator(".catalog-supplementary-cards p").innerText()
    ).includes("separately from the starter composition"),
  );
  await inspectDeckCard(
    ".catalog-supplementary-cards .catalog-auxiliary-list > button",
  );
  checks.push(
    "Permanent cards begin in play within starter composition, deck-size excludes them, and supplementary Weather cards remain separate and inspectable",
  );

  await selectHero("Gamora");
  const gamora = sourceDecks.find(
    (deck) => cardIndex.get(deck.heroCode)?.name === "Gamora",
  );
  assert.ok(
    (await detail().locator(".catalog-deck-title").innerText())
      .toLowerCase()
      .includes(`card aspects: ${gamora.aspects.join(" / ")}`),
  );
  checks.push(
    "Multiple printed card aspects are named in the starter-deck caption",
  );

  await selectHero("Jessica Jones");
  const jessicaProduct = packIndex.get("jj");
  assert.ok((await sourceProduct().innerText()).includes(jessicaProduct.name));
  for (const width of [390, 320]) {
    await fit(`catalog-${width}`, width);
    await dialog().evaluate((node) => {
      node.scrollTop = 0;
    });
    await page.evaluate(() => new Promise(requestAnimationFrame));
    await capture(`catalog-roster-${width}`);
    await detail().evaluate((node) => node.scrollIntoView({ block: "start" }));
    await capture(`catalog-detail-${width}`);
    await audit(`catalog-${width}`);
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(
    await page.evaluate(() =>
      document.activeElement?.classList.contains("content-entry"),
    ),
    true,
  );
  await fit("lobby-1440", 1440);
  await page.locator(".hero-tile").filter({ hasText: "Peter Parker" }).click();
  assert.match(
    await page.locator(".hero-tile.selected").innerText(),
    /Peter Parker/,
    "The selected Spider-Man is Peter Parker rather than Miles Morales",
  );
  await page.getByRole("button", { name: "2 heroes", exact: true }).click();
  await openCatalog();
  await selectHero("Captain Marvel");
  assert.equal(
    await detail()
      .getByRole("button", { name: "Already assigned to another seat" })
      .isDisabled(),
    true,
  );
  await selectHero("She-Hulk");
  await detail()
    .getByRole("combobox", { name: "Choose starter deck" })
    .selectOption("app-she_hulk-aggression");
  assert.ok(
    (await detail().locator(".catalog-default-deck-note").innerText()).includes(
      "app starter deck shown below",
    ),
  );
  await detail()
    .getByRole("button", { name: "Choose She-Hulk for mission", exact: true })
    .click();
  setup = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
  assert.equal(setup.team[0].deckCards, undefined);
  assert.equal(setup.team[0].deckOrigin, undefined);
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.match(
    await page.locator(".hero-tile.selected").innerText(),
    /She-Hulk/i,
  );
  assert.match(
    await page.locator(".aspect-option.selected").innerText(),
    /Aggression/i,
  );
  await page.getByRole("button", { name: "1 hero", exact: true }).click();
  await page
    .getByRole("button", { name: "View 40-card deck", exact: false })
    .click();
  assert.ok(
    (await page.locator(".deck-provenance").innerText()).includes(
      "App-constructed starter deck",
    ),
  );
  assert.ok(
    (await page.locator(".deck-card-source").first().innerText()).includes(
      "Core Set",
    ),
  );
  await page.keyboard.press("Escape");
  checks.push(
    "320/390 catalog fit and accessibility, catalog close restores focus, duplicate-seat prevention, supported core selection and constructed starter provenance",
  );

  await page
    .getByRole("button", { name: "Card library", exact: false })
    .click();
  assert.ok(
    (await page.locator(".collection-title p").innerText()).includes(
      cards.length.toLocaleString(),
    ),
  );
  assert.ok(
    (await page.locator(".collection-title p").innerText()).includes(
      `${packs.length} released products`,
    ),
  );
  assert.equal(await page.locator(".collection-card").count(), 36);
  const firstPageCodes = await collectionCodes();
  await page
    .getByRole("button", { name: "Next card page", exact: true })
    .first()
    .click();
  const secondPageCodes = await collectionCodes();
  assert.equal(
    firstPageCodes.some((code) => secondPageCodes.includes(code)),
    false,
  );
  await page
    .getByRole("combobox", { name: "Filter card product" })
    .selectOption("jj");
  assert.equal(
    (await collectionCodes()).every(
      (code) => cardIndex.get(code).pack_code === "jj",
    ),
    true,
  );
  assert.ok(
    (await page.locator(".collection-toolbar").innerText()).includes(
      `${importedCards.filter((c) => c.pack_code === "jj").length} card faces`,
    ),
  );
  await page
    .getByRole("combobox", { name: "Filter card type" })
    .selectOption("hero");
  assert.equal(
    (await collectionCodes()).every(
      (code) => cardIndex.get(code).type_code === "hero",
    ),
    true,
  );
  await capture("collection-latest-hero-product");
  await page
    .getByRole("button", { name: "Clear filters", exact: false })
    .click();
  for (const faction of ["pool", "campaign"]) {
    await page
      .getByRole("combobox", { name: "Filter card faction" })
      .selectOption(faction);
    const expected = cards.filter((c) => c.faction_code === faction).length;
    assert.ok(expected > 0, `${faction} cards must be imported`);
    assert.ok(
      (await page.locator(".collection-toolbar").innerText()).includes(
        `${expected.toLocaleString()} card faces`,
      ),
    );
    assert.equal(
      (await collectionCodes()).every(
        (code) => cardIndex.get(code).faction_code === faction,
      ),
      true,
    );
  }
  await capture("collection-campaign-desktop");
  await audit("collection-campaign-desktop");
  await page
    .getByRole("combobox", { name: "Filter card faction" })
    .selectOption("all");
  await page
    .getByRole("combobox", { name: "Filter card product" })
    .selectOption("fne");
  await page
    .getByRole("combobox", { name: "Filter card type" })
    .selectOption("villain");
  assert.equal(
    (await collectionCodes()).every(
      (code) =>
        cardIndex.get(code).type_code === "villain" &&
        cardIndex.get(code).pack_code === "fne",
    ),
    true,
  );
  await page.getByRole("textbox", { name: "Search cards" }).fill("Kingpin");
  assert.ok(await page.locator(".collection-card").count());
  await page.locator(".collection-card").first().click();
  assert.ok(
    (
      await page.getByRole("dialog").locator(".product-source").innerText()
    ).includes("Fear No Evil"),
  );
  await page.keyboard.press("Escape");
  await page
    .getByRole("textbox", { name: "Search cards" })
    .fill("zzzz no such marvel card");
  assert.equal(await page.locator(".collection-card").count(), 0);
  await page
    .getByRole("button", { name: "Clear filters", exact: true })
    .last()
    .click();
  for (const width of [390, 320]) {
    await fit(`collection-${width}`, width);
    await capture(`collection-${width}`);
    await audit(`collection-${width}`);
  }
  checks.push(
    "Complete Collection faces, bounded DOM and unique page results, latest product/type filters, Pool/campaign content, encounter search, product inspection and empty-result recovery",
  );
  assert.deepEqual(errors, [], "No browser errors");
  assert.equal(
    audits.some((result) => result.violations.length),
    false,
    JSON.stringify(
      audits.filter((result) => result.violations.length),
      null,
      2,
    ),
  );
} finally {
  await writeFile(
    `${output}/report.json`,
    JSON.stringify({ checks, errors, audits, layouts }, null, 2),
  );
  await browser.close();
}
console.log(
  JSON.stringify(
    {
      checks,
      browserErrors: errors.length,
      accessibilityAudits: audits.length,
      layoutChecks: layouts.length,
      screenshots: output,
    },
    null,
    2,
  ),
);
