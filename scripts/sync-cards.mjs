/** Released official catalog import; preserves the supported Core snapshots and art. */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import {
  readFile,
  writeFile,
  readdir,
  mkdir,
  mkdtemp,
  rename,
  unlink,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
const run = promisify(execFile);
const args = process.argv.slice(2);
const flag = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const asOf = flag("--as-of", "2026-09-30");
const imageConcurrency = Number(flag("--image-concurrency", "12"));
if (
  !Number.isInteger(imageConcurrency) ||
  imageConcurrency < 1 ||
  imageConcurrency > 24
)
  throw Error("--image-concurrency must be an integer from 1 to 24");
if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf))
  throw Error("--as-of must be YYYY-MM-DD");
const cutoffDate = new Date(`${asOf}T00:00:00Z`);
if (
  !Number.isFinite(cutoffDate.getTime()) ||
  cutoffDate.toISOString().slice(0, 10) !== asOf
)
  throw Error("--as-of must be a valid calendar date");
const revision = flag("--revision", "44b7f2c9b01faa50f5a96cb40a9c0ecbbace7776");
if (!/^[a-f\d]{40}$/i.test(revision))
  throw Error("--revision must be an exact 40-character Git commit SHA");
const supplementRevision = "11c6ee54909e01910434dfa1cd890524b760843e";
const octgnRevision = "21d3d6f797a74d4992b44a0cd95e84cc822208ed";
const repo = "https://github.com/zzorba/marvelsdb-json-data";
const supplementRepo = "https://github.com/hone/dragncards-mc-plugin";
const octgnPath =
  "055c536f-adba-4bc2-acbf-9aefb9756046/Sets/fear_no_evil_by_ffg/set.xml";
const octgnUrl = `https://raw.githubusercontent.com/Ouroboros009/OCTGN-Marvel-Champions/${octgnRevision}/${octgnPath}`;
const scratch = await mkdtemp(join(tmpdir(), "marvel-catalog-"));
const get = async (url) =>
  (
    await run(
      "curl",
      ["-L", "--fail", "--max-time", "60", "--retry", "1", "-sS", url],
      { maxBuffer: 25 * 1024 * 1024 },
    )
  ).stdout;
const json = async (path) => JSON.parse(await readFile(path, "utf8"));
const artOverrides = await json("scripts/catalog-art-overrides.json");
let previousImages = {};
try {
  previousImages =
    (await json("src/data/catalog-provenance.json")).images || {};
} catch {}
const save = async (path, value) => {
  await writeFile(`${path}.import-tmp`, JSON.stringify(value, null, 2) + "\n");
  await rename(`${path}.import-tmp`, path);
};
const hash = (data) => createHash("sha256").update(data).digest("hex");
const slug = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
async function sourceDirectory(repository, sha, option, prefix) {
  if (flag(option)) return flag(option);
  const archive = join(scratch, `${prefix}.tar.gz`);
  await run("curl", [
    "-L",
    "--fail",
    "--max-time",
    "90",
    "--retry",
    "1",
    "-sS",
    `${repository.replace("https://github.com/", "https://codeload.github.com/")}/tar.gz/${sha}`,
    "-o",
    archive,
  ]);
  await run("tar", ["-xzf", archive, "-C", scratch]);
  return join(scratch, `${repository.split("/").at(-1)}-${sha}`);
}
const xmlDecode = (text = "") =>
  text.replace(
    /&#(x[\da-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,
    (_, numeric, named) =>
      numeric
        ? String.fromCodePoint(
            numeric[0] === "x" ? parseInt(numeric.slice(1), 16) : +numeric,
          )
        : { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[named],
  );
const attrs = (text) =>
  Object.fromEntries(
    [...text.matchAll(/([\w-]+)="([^"]*)"/g)].map((m) => [
      m[1],
      xmlDecode(m[2]),
    ]),
  );
const properties = (text) =>
  Object.fromEntries(
    [
      ...text.matchAll(/<property\s+([^>]*?)(?:\/>|>([\s\S]*?)<\/property>)/g),
    ].map((m) => {
      const a = attrs(m[1]);
      return [a.name, a.value ?? xmlDecode(m[2] ?? "")];
    }),
  );
function fearNoEvilCards(xml, cerebroCards, cerebroSets, originalSets) {
  const packId = "95903495-80a0-4ec9-87a4-0a57b4a36d95";
  const printings = new Map();
  for (const c of cerebroCards.filter((c) => c.Official && !c.Deleted))
    for (const p of c.Printings.filter((p) => p.PackId === packId))
      printings.set(p.ArtificialId.toLowerCase(), { c, p });
  const setById = new Map(cerebroSets.map((s) => [s.Id, s]));
  const sets = new Map(originalSets.map((s) => [s.code, s]));
  const rows = [];
  let physicalCards = 0;
  const make = (a, p, octgnId) => {
    const code = p.CardNumber?.toLowerCase();
    if (!code || !/^60\d{3}[a-f]?$/.test(code)) return;
    const source = printings.get(code);
    if (!source) throw Error(`Supplemental metadata missing for ${code}`);
    const set = setById.get(source.p.SetId);
    let setCode;
    if (set) {
      const existing = originalSets.find(
        (s) =>
          slug(s.name) === slug(set.Name) &&
          s.card_set_type_code === slug(set.Type.replace(/ Set$/, "")),
      );
      setCode = existing?.code || `fne_${slug(set.Name)}`;
      sets.set(
        setCode,
        existing || {
          code: setCode,
          name: set.Name,
          card_set_type_code: slug(set.Type.replace(/ Set$/, "")),
          pack_code: "fne",
          source: "Cerebro",
        },
      );
    }
    const card = {
      code,
      name: a.name,
      type_code: p.Type,
      faction_code: p.Faction,
      pack_code: "fne",
      position: +p.Position,
      quantity: +p.Quantity,
      set_code: setCode,
      text: p.Text || "",
      octgn_id: octgnId,
      source: "OCTGN / Cerebro",
      image_url: `https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/${source.p.UniqueArt ? source.p.ArtificialId : source.c.Id}.jpg`,
    };
    const mapping = {
      HP: "health",
      Attack: "attack",
      Defense: "defense",
      Thwart: "thwart",
      Scheme: "scheme",
      HandSize: "hand_size",
      Recovery: "recover",
      Cost: "cost",
      Boost: "boost",
      BaseThreat: "base_threat",
      EscalationThreat: "escalation_threat",
      Threat: "threat",
      Stage: "stage",
      Attribute: "traits",
      Quote: "flavor",
      Subtitle: "subname",
      ResourcePhysical: "resource_physical",
      ResourceMental: "resource_mental",
      ResourceEnergy: "resource_energy",
      ResourceWild: "resource_wild",
      Resource_Physical: "resource_physical",
      Resource_Mental: "resource_mental",
      Resource_Energy: "resource_energy",
      Resource_Wild: "resource_wild",
      Scheme_Acceleration: "scheme_acceleration",
      Scheme_Crisis: "scheme_crisis",
      Scheme_Hazard: "scheme_hazard",
      AttackCost: "attack_cost",
      ThwartCost: "thwart_cost",
    };
    for (const [key, field] of Object.entries(mapping))
      if (p[key] !== undefined)
        card[field] = /^-?\d+$/.test(p[key]) ? +p[key] : p[key];
    for (const [key, field] of Object.entries({
      Unique: "is_unique",
      HPPerPlayer: "health_per_hero",
      HP_Per_Hero: "health_per_hero",
      BaseThreatFixed: "base_threat_fixed",
      EscalationThreatFixed: "escalation_threat_fixed",
      ThreatFixed: "threat_fixed",
    }))
      if (p[key] !== undefined) card[field] = p[key].toLowerCase() === "true";
    if (source.c.Stage && card.stage === undefined) card.stage = source.c.Stage;
    for (const [key, field] of Object.entries({
      Attack: "attack_star",
      Scheme: "scheme_star",
      Boost: "boost_star",
      Health: "health_star",
    }))
      if (source.c[key]?.includes("{s}")) card[field] = true;
    card.source_properties = p;
    rows.push(card);
    return card;
  };
  for (const m of xml.matchAll(/<card\s+([^>]+)>([\s\S]*?)<\/card>/g)) {
    const a = attrs(m[1]);
    const alternates = [
      ...m[2].matchAll(/<alternate\s+([^>]+)>([\s\S]*?)<\/alternate>/g),
    ];
    const primary = make(
      a,
      properties(m[2].replace(/<alternate\s[^>]+>[\s\S]*?<\/alternate>/g, "")),
      a.id,
    );
    if (!primary) continue;
    physicalCards += primary.quantity;
    for (const alt of alternates) {
      const back = make(attrs(alt[1]), properties(alt[2]), a.id);
      if (back) {
        primary.back_link ??= back.code;
        back.hidden = true;
        back.back_link = primary.code;
      }
    }
  }
  if (physicalCards !== 276 || rows.length < 230)
    throw Error(
      `Incomplete FNE: ${physicalCards} physical cards / ${rows.length} faces`,
    );
  return { cards: rows, sets: [...sets.values()], physicalCards };
}
function resolveReprints(raw) {
  const byCode = new Map(raw.map((c) => [c.code, c]));
  const resolved = new Map();
  const resolve = (code, trail = []) => {
    if (resolved.has(code)) return resolved.get(code);
    const row = byCode.get(code);
    if (!row || trail.includes(code))
      throw Error(`Missing/cyclic reprint ${[...trail, code].join(" -> ")}`);
    const card = {
      ...(row.duplicate_of ? resolve(row.duplicate_of, [...trail, code]) : {}),
      ...row,
    };
    if (row.duplicate_of) {
      delete card.set_code;
      delete card.set_position;
      delete card.back_link;
      delete card.hidden;
    }
    if (
      !card.name ||
      !card.type_code ||
      !card.faction_code ||
      !Number.isInteger(card.quantity) ||
      card.quantity < 1
    )
      throw Error(`Invalid card ${code}`);
    resolved.set(code, card);
    return card;
  };
  return raw.map((c) => resolve(c.code));
}
/** Reproduce the published maintained preconstructed-deck source, never auto-fill. */
function starterDecks(cards, packs, coreFixture) {
  const decks = [];
  for (const pack of packs.filter((p) =>
    ["hero", "story"].includes(p.pack_type_code),
  )) {
    const rows = cards
      .filter((c) => c.pack_code === pack.code)
      .sort((a, b) => a.position - b.position || a.code.localeCompare(b.code));
    for (const setCode of new Set(
      rows
        .filter((c) => c.type_code === "hero" && !c.hidden)
        .map((c) => c.set_code),
    )) {
      const hero = rows.find(
        (c) => c.type_code === "hero" && c.set_code === setCode && !c.hidden,
      );
      const segment = rows.filter(
        (c) =>
          c.position >= hero.position &&
          (!c.set_code || c.set_code === setCode),
      );
      const end = segment.findIndex((c) => c.type_code === "obligation");
      if (end < 0) throw Error(`Missing starter boundary for ${hero.code}`);
      const inDeck = segment
        .slice(0, end)
        .filter(
          (c) =>
            !["hero", "alter_ego", "obligation"].includes(c.type_code) &&
            (!c.hidden ||
              [
                "Firecracker",
                "Flash of Light",
                "Photographic Reflexes",
                "Plasmoid Energy",
              ].includes(c.name)),
        );
      const counts = Object.fromEntries(
        inDeck.map((c) => [
          c.code,
          Math.min(c.quantity, c.deck_limit ?? c.quantity),
        ]),
      );
      const sourceUrls = [];
      if (hero.code === "22001a") {
        counts["22017"] = 2;
        sourceUrls.push(
          "https://hallofheroeslcg.com/wp-content/uploads/2021/09/nebula-starter-deck.jpg",
        );
      }
      if (hero.code === "50034a") {
        counts["50024"] = 1;
        sourceUrls.push(
          "https://images-cdn.fantasyflightgames.com/filer_public/79/12/7912adc3-2461-4ea2-8606-4715880b8d1d/mc50_rulebook-web.pdf#page=7",
        );
      }
      const aspects = [
        ...new Set(
          inDeck
            .map((c) => c.faction_code)
            .filter((a) => !["basic", "hero", "campaign"].includes(a)),
        ),
      ];
      const size = Object.values(counts).reduce((sum, n) => sum + n, 0);
      if (size < 40 || size > 50)
        throw Error(`Starter ${hero.name} has unexpected source size ${size}`);
      decks.push({
        id: `starter-${hero.code}`,
        name: `${hero.name} Starter Deck`,
        heroCode: hero.code,
        packCode: pack.code,
        aspect: aspects.length === 1 ? aspects[0] : "multi",
        aspects,
        cards: counts,
        setupCards: Object.fromEntries(
          inDeck
            .filter((c) =>
              /(?:^|[.\n])\s*Permanent\b/.test(
                c.text?.replace(/<[^>]*>/g, "") || "",
              ),
            )
            .map((c) => [c.code, c.quantity]),
        ),
        deckSize: Object.entries(counts).reduce(
          (sum, [code, n]) =>
            sum +
            (/(?:^|[.\n])\s*Permanent\b/.test(
              cards
                .find((c) => c.code === code)
                ?.text?.replace(/<[^>]*>/g, "") || "",
            )
              ? 0
              : n),
          0,
        ),
        sourceUrl: `${supplementRepo}/blob/${supplementRevision}/src/cli/decks.rs#L747`,
        sourceType: "source-preconstructed",
        sourceUrls,
        supplementaryCards: Object.fromEntries(
          cards
            .filter(
              (c) =>
                c.pack_code === pack.code &&
                c.set_code !== setCode &&
                c.set_code?.startsWith(`${setCode}_`) &&
                !/nemesis/.test(c.set_code) &&
                !c.hidden,
            )
            .map((c) => [c.code, c.quantity]),
        ),
        sourceNote:
          "Permanent cards start in play and do not count toward deck size. Special hero decks are listed separately.",
      });
    }
  }
  for (const [name, rows] of Object.entries(coreFixture.heroes)) {
    const core = cards.filter((c) => c.pack_code === "core");
    const hero = core.find((c) => c.type_code === "hero" && c.name === name);
    const counts = {};
    for (const row of rows.filter((r) => r.loadGroupId === "playerNDeck")) {
      const printedName =
        row.name === "Vibranium Resource" ? "Vibranium" : row.name;
      const code = core
        .filter((c) => slug(c.name) === slug(printedName) && !c.hidden)
        .sort((a, b) => a.position - b.position)
        .find((c) => !counts[c.code] || c.quantity > counts[c.code])?.code;
      if (!code) throw Error(`Core starter card missing ${row.name}`);
      counts[code] = (counts[code] || 0) + row.quantity;
    }
    const aspect = Object.keys(counts)
      .map((code) => core.find((c) => c.code === code).faction_code)
      .find((a) => !["basic", "hero"].includes(a));
    decks.push({
      id: `starter-${hero.code}`,
      name: `${name} Starter Deck`,
      heroCode: hero.code,
      packCode: "core",
      aspect,
      aspects: [aspect],
      cards: counts,
      deckSize: Object.values(counts).reduce((sum, n) => sum + n, 0),
      sourceUrl: `${supplementRepo}/blob/${supplementRevision}/fixtures/core_set_hero_decks.json`,
      sourceType: "source-preconstructed",
    });
  }
  return decks.sort((a, b) => a.heroCode.localeCompare(b.heroCode));
}
let cards, packs, sets, decks, provenance;
if (args.includes("--images-only")) {
  [cards, packs, sets, decks, provenance] = await Promise.all([
    json("src/data/catalog-cards.json"),
    json("src/data/catalog-packs.json"),
    json("src/data/catalog-sets.json"),
    json("src/data/catalog-decks.json"),
    json("src/data/catalog-provenance.json"),
  ]);
} else {
  const primary = await sourceDirectory(
    repo,
    revision,
    "--source-dir",
    "primary",
  );
  const supplement = await sourceDirectory(
    supplementRepo,
    supplementRevision,
    "--supplement-dir",
    "supplement",
  );
  packs = (await json(join(primary, "packs.json")))
    .filter((p) => p.date_release && p.date_release <= asOf)
    .map((p) => ({
      ...p,
      product_type:
        p.code === "cw"
          ? "custom-scenario"
          : p.code === "ron"
            ? "printable-encounter"
            : {
                core: "core-set",
                hero: "hero-pack",
                story: "campaign-expansion",
                scenario: "scenario-pack",
                encounter: "encounter-set",
              }[p.pack_type_code],
      retail: p.code !== "ron",
      ...(p.code === "cw"
        ? {
            product_source_url:
              "https://www.fantasyflightgames.com/en/news/2025/6/26/civil-war-1/",
            release_source_url:
              "https://www.asmodeena.com/AUSA-Active-06012026.pdf",
          }
        : {}),
    }));
  const packCodes = new Set(packs.map((p) => p.code));
  const files = (await readdir(join(primary, "pack")))
    .filter(
      (p) =>
        p.endsWith(".json") &&
        packCodes.has(p.replace(/(?:_encounter)?\.json$/, "")),
    )
    .sort();
  const raw = (
    await Promise.all(files.map((p) => json(join(primary, "pack", p))))
  ).flat();
  sets = await json(join(primary, "sets.json"));
  const xml = flag("--fne-xml")
    ? await readFile(flag("--fne-xml"), "utf8")
    : await get(octgnUrl);
  const fne = fearNoEvilCards(
    xml,
    await json(join(supplement, "fixtures/cerebro/cards.json")),
    await json(join(supplement, "fixtures/cerebro/sets.json")),
    sets,
  );
  if (packCodes.has("fne")) {
    const existingCodes = new Set(raw.map((c) => c.code));
    raw.push(...fne.cards.filter((c) => !existingCodes.has(c.code)));
    for (const c of raw.filter((c) => c.pack_code === "fne")) {
      const supplied = fne.cards.find((s) => s.code === c.code);
      if (supplied) c.image_url = supplied.image_url;
      if (c.code === "60001a" && supplied) {
        c.upstream_thwart = c.thwart;
        c.upstream_text = c.text;
        c.thwart = supplied.thwart;
        c.text = supplied.text;
        c.text_source_url = supplied.image_url;
      }
    }
    sets = fne.sets;
  }
  const artByCode = new Map();
  for (const c of (
    await json(join(supplement, "fixtures/cerebro/cards.json"))
  ).filter((c) => c.Official && !c.Deleted))
    for (const p of c.Printings)
      artByCode.set(
        p.ArtificialId.toLowerCase(),
        `https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/${p.UniqueArt ? p.ArtificialId : c.Id}.jpg`,
      );
  for (const c of raw)
    if (artByCode.has(c.code)) c.image_url = artByCode.get(c.code);
  for (const c of raw)
    if (artOverrides[c.code]) c.image_url = artOverrides[c.code];
  for (const c of [...raw])
    if (c.double_sided && c.back_text && !c.back_link) {
      const backCode = `${c.code}b`;
      if (raw.some((card) => card.code === backCode))
        throw Error(`Embedded reverse code already exists: ${backCode}`);
      const back = {
        ...c,
        code: backCode,
        name: c.back_name || c.name,
        text: c.back_text,
        flavor: c.back_flavor,
        hidden: true,
        back_link: c.code,
        source: "Embedded upstream reverse face",
      };
      delete back.back_name;
      delete back.back_text;
      delete back.back_flavor;
      delete back.double_sided;
      c.back_link = backCode;
      c.image_url = artByCode.get(`${c.code}a`);
      back.image_url = artByCode.get(backCode);
      raw.push(back);
    }
  // Primary printed deck lists repair maintained-source quantity omissions.
  for (const c of raw) {
    if (c.code === "22017") {
      c.upstream_quantity = c.quantity;
      c.quantity = 2;
      c.quantity_source_url =
        "https://hallofheroeslcg.com/wp-content/uploads/2021/09/nebula-starter-deck.jpg";
    }
    if (c.code === "60031") {
      c.upstream_quantity = c.quantity;
      c.quantity = 1;
      c.quantity_source_url =
        "https://hallofheroeslcg.com/wp-content/uploads/2026/08/mc60_rulebook-web.pdf#page=25";
    }
    if (c.code === "61033b" || c.code === "61033c") {
      c.upstream_name = c.name;
      c.upstream_text = c.text;
      const oldIcon = c.code === "61033b" ? "mental" : "physical";
      const printedIcon = c.code === "61033b" ? "physical" : "mental";
      c.name = c.name.replace(`[${oldIcon}]`, `[${printedIcon}]`);
      c.text = c.text.replaceAll(`[${oldIcon}]`, `[${printedIcon}]`);
      c.text_source_url = artOverrides[c.code];
    }
  }
  if (new Set(raw.map((c) => c.code)).size !== raw.length)
    throw Error("Duplicate card codes");
  cards = resolveReprints(raw).sort((a, b) => a.code.localeCompare(b.code));
  const codes = new Set(cards.map((c) => c.code));
  for (const c of cards)
    if (c.back_link && !codes.has(c.back_link))
      throw Error(`Missing reverse ${c.code} -> ${c.back_link}`);
  const usedSets = new Set(cards.map((c) => c.set_code).filter(Boolean));
  sets = sets
    .filter((s) => usedSets.has(s.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  for (const c of cards)
    if (c.set_code && !sets.some((s) => s.code === c.set_code))
      throw Error(`Missing set ${c.set_code}`);
  decks = starterDecks(
    cards,
    packs,
    await json(join(supplement, "fixtures/core_set_hero_decks.json")),
  );
  const coverage = packs.map((p) => {
    const rows = cards.filter((c) => c.pack_code === p.code);
    if (!rows.length) throw Error(`Empty released product ${p.code}`);
    const positions = new Map();
    for (const c of rows)
      positions.set(
        c.position,
        Math.max(positions.get(c.position) || 0, c.quantity),
      );
    return {
      code: p.code,
      faces: rows.length,
      printedPositions: positions.size,
      declaredPhysicalSize: p.size,
      quantityByPosition: [...positions.values()].reduce((a, b) => a + b, 0),
      maxPosition: Math.max(...positions.keys()),
    };
  });
  provenance = {
    asOf,
    importedAt: new Date().toISOString(),
    sources: [
      {
        repository: repo,
        revision,
        files: ["packs.json", "sets.json", ...files.map((f) => `pack/${f}`)],
      },
      {
        repository: supplementRepo,
        revision: supplementRevision,
        purpose:
          "Cerebro metadata, image URLs and published starter-deck algorithm",
        files: [
          "fixtures/cerebro/cards.json",
          "fixtures/cerebro/sets.json",
          "fixtures/core_set_hero_decks.json",
          "src/cli/decks.rs",
        ],
      },
      {
        repository: "https://github.com/Ouroboros009/OCTGN-Marvel-Champions",
        revision: octgnRevision,
        files: [octgnPath],
        purpose: "Complete Fear No Evil encounter faces and printed quantities",
        sha256: hash(xml),
        physicalCards: fne.physicalCards,
      },
    ],
    cardFaces: cards.length,
    products: packs.length,
    retailProducts: packs.filter((p) => p.retail).length,
    starterDecks: decks.length,
    coverage,
    completenessNotes: [
      "Released products from the pinned catalog are imported. Fear No Evil's incomplete MarvelCDB encounter data are completed from OCTGN/Cerebro.",
      "Faces and position quantities exclude status/token/reference cards without catalog codes. Upstream physical pack sizes are not always accurate.",
      "Starter compositions reproduce maintained DragnCards source; this is not independent verification of every FFG printed decklist.",
      "Core snapshots, official errata and cached Core art are preserved. Imported cards do not implement game effects.",
    ],
    images: { cached: 0, missing: cards.map((c) => c.code) },
  };
  for (const [name, value] of [
    ["cards", cards],
    ["packs", packs],
    ["sets", sets],
    ["decks", decks],
    ["provenance", provenance],
  ])
    await save(`src/data/catalog-${name}.json`, value);
  try {
    await json("src/data/catalog-images.json");
  } catch {
    await save("src/data/catalog-images.json", {});
  }
  console.log(
    JSON.stringify({
      products: packs.length,
      cardFaces: cards.length,
      sets: sets.length,
      starterDecks: decks.length,
    }),
  );
}
if (args.includes("--skip-images")) process.exit(0);
for (const c of cards)
  if (artOverrides[c.code]) c.image_url = artOverrides[c.code];
const validImage = (b) =>
  b.length > 500 &&
  (b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ||
    (b[0] === 255 && b[1] === 216 && b[2] === 255) ||
    (b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP"));
const manifest = {},
  imageSources = { ...previousImages.sources },
  missing = [];
const previousManifest = await json("src/data/catalog-images.json");
const queue = [...cards].sort(
  (a, b) =>
    +["hero", "alter_ego"].includes(b.type_code) -
      +["hero", "alter_ego"].includes(a.type_code) ||
    a.code.localeCompare(b.code),
);
await mkdir("public/cards/catalog", { recursive: true });
let completed = 0;
await Promise.all(
  Array.from({ length: imageConcurrency }, async () => {
    while (queue.length) {
      const c = queue.shift(),
        target = `public/cards/catalog/${c.code}.jpg`;
      let cached = false;
      for (const path of [
        `public/cards/${c.code}.png`,
        previousManifest[c.code]
          ? `public${previousManifest[c.code]}`
          : undefined,
        `public/cards/catalog/${c.code}.webp`,
        target,
      ].filter(Boolean)) {
        try {
          if (validImage(await readFile(path))) {
            manifest[c.code] = path.replace(/^public/, "");
            if (c.image_url) imageSources[c.code] ??= c.image_url;
            cached = true;
            break;
          }
        } catch {}
      }
      if (!cached) {
        for (const url of [
          ...new Set(
            [
              c.image_url,
              `https://cerebrodatastorage.blob.core.windows.net/cerebro-cards/official/${c.code.toUpperCase()}.jpg`,
              `https://marvelcdb.com/bundles/cards/${c.code}.png`,
              `https://marvelcdb.com/bundles/cards/${c.code}.jpg`,
            ].filter(Boolean),
          ),
        ]) {
          const temporary = `${target}.download`;
          try {
            await run("curl", [
              "-L",
              "--fail",
              "--max-time",
              "18",
              "--retry",
              "1",
              "-sS",
              url,
              "-o",
              temporary,
            ]);
            if (!validImage(await readFile(temporary)))
              throw Error("Invalid image");
            await rename(temporary, target);
            manifest[c.code] = target.replace(/^public/, "");
            imageSources[c.code] = url;
            cached = true;
            break;
          } catch {
            await unlink(temporary).catch(() => {});
          }
        }
        if (!cached) missing.push(c.code);
      }
      completed++;
      if (
        completed % 250 === 0 ||
        completed ===
          cards.filter((c) => ["hero", "alter_ego"].includes(c.type_code))
            .length
      ) {
        await save(
          "src/data/catalog-images.json",
          Object.fromEntries(
            Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
          ),
        );
        console.log(
          `Artwork ${completed}/${cards.length}; missing ${missing.length}`,
        );
      }
    }
  }),
);
await save(
  "src/data/catalog-images.json",
  Object.fromEntries(
    Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b)),
  ),
);
provenance.images = {
  ...previousImages,
  checkedAt: new Date().toISOString(),
  cached: Object.keys(manifest).length,
  missing: missing.sort(),
  sources: imageSources,
  validation:
    "PNG/JPEG/WebP magic and minimum 500 bytes; invalid partial responses removed.",
};
await save("src/data/catalog-provenance.json", provenance);
console.log(
  JSON.stringify({
    cardFaces: cards.length,
    cachedImages: Object.keys(manifest).length,
    missingImages: missing.length,
  }),
);
if (!args.includes("--skip-optimize")) {
  const result = await run(
    process.execPath,
    ["scripts/optimize-catalog-images.mjs"],
    { maxBuffer: 2 * 1024 * 1024 },
  );
  if (result.stdout) console.log(result.stdout.trim());
}
