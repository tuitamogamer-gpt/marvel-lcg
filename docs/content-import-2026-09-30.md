# Released-content import — 30 September 2026

The import covers the Core Set, 44 Hero Packs, nine campaign expansions, the Civil War custom scenario expansion, seven Scenario Packs, and the free Ronan modular set: 62 retail products plus one free download, with 69 hero identities. Cards retain their printing-specific product code, including reprints; a deck's origin lists every product that supplies its actual card codes.

The pinned import cutoff remains 30 September 2026 for this 2 October 2026 release continuation. Fear No Evil, Jessica Jones and Luke Cage are included. Shadowland (16 October 2026), Elektra and Iron Fist (20 November 2026) are announced products outside this import. The source catalog's dates are retail catalog dates; territories and announcement dates can differ. In particular, Civil War's FFG available-now article and Asmodee US retail catalog give different dates; the import retains the catalog's 17 October 2025 rather than replacing it with the article's 19 September date.

## Sources and completeness

- [MarvelCDB data repository, pinned revision](https://github.com/zzorba/marvelsdb-json-data/tree/44b7f2c9b01faa50f5a96cb40a9c0ecbbace7776): product metadata, split card faces and encounter/hero set definitions. Each snapshot is imported from a pinned commit, not mutable runtime API responses.
- [DragnCards Marvel Champions plugin, pinned revision](https://github.com/hone/dragncards-mc-plugin/tree/11c6ee54909e01910434dfa1cd890524b760843e): maintained Cerebro fixtures supplement the missing Fear No Evil encounter records. Only official cards and printings belonging to released products are admitted.
- [Fear No Evil OCTGN card definitions](https://github.com/Ouroboros009/OCTGN-Marvel-Champions/blob/master/055c536f-adba-4bc2-acbf-9aefb9756046/Sets/fear_no_evil_by_ffg/set.xml): an independent cross-check of printed positions and quantities, totaling the official 276 physical cards. A face count differs from a physical-card count because double-sided cards and duplicate copies are represented differently.
- [DragnCards preconstructed-deck source](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs): maintained source starter lists, including its Core Set fixture and pack-order rules. These lists are distinguished from the app's constructed starter decks and retain their source URLs. They are not presented as an independent certification by FFG.
- Official released products: [Fear No Evil](https://store.asmodee.com/products/marvel-champions-the-card-game-fear-no-evil-expansion), [Jessica Jones](https://store.asmodee.com/products/marvel-champions-the-card-game-jessica-jones-hero-pack), [Luke Cage](https://store.asmodee.com/products/marvel-champions-the-card-game-luke-cage-hero-pack).

The primary source lacked Fear No Evil's scenarios, containing only the heroes' obligations and nemeses. The supplementary import includes Bullseye, Electro, Hammerhead, Purple Man, Typhoid Mary/Bloody Mary, Kingpin, their main schemes, modular sets and campaign cards. Its original Daredevil record also contained outdated preview text and THW; the published card's THW 2 and Forced Interrupt are restored. Vision's embedded Dense reverse is expanded into its own face. The resulting catalog contains **4,551 unique card faces**, including all 239 Fear No Evil faces and its 210 printed positions. Product records alone would not have constituted a complete import.

The import contains 69 source preconstructed compositions and five separately labeled app starters. Published lists correct Nebula's missing second Power of Justice and Nick Fury's shared Super Spies. Permanent cards remain visible in the composition but start in play and are excluded from deck-size counts, following Rules Reference 1.8. Extra Sense/Invocation/Weather and other hero special cards are recorded separately. The 69 source starter decks have legal deck sizes: 67 contain 40 cards, while Valkyrie and Rogue contain 41.

`src/data/catalog-provenance.json` records retrieval details, source commits, per-product coverage and artwork results. Generic counters and duplicate physical copies do not become additional unique card-face records. Upstream `size` is a product's physical-card count and must not be displayed as the number of unique faces.

Every one of the 4,551 faces has locally cached artwork. Cerebro supplies the main image cache; verified published scans from FFG/Hall of Heroes and Skilled Investigator complete the latest Hero Packs and free Ronan set. The exact URLs are retained in the image provenance and `scripts/catalog-art-overrides.json`. Imported scans use WebP at quality 80 with an 800-pixel maximum dimension, without upscaling; Core Set images remain intact. The 4,342 imported images total 420,635,566 bytes (401 MiB), compared with roughly 1.5 GB of source scans. FFmpeg decodes every imported scan during conversion, and the enlarged card text was visually checked.

`npm run sync:cards` recreates the pinned import and uses FFmpeg for artwork optimization. `--skip-images` imports metadata alone, `--images-only` resumes cached artwork, and `--skip-optimize` retains original scans. The cutoff accepts `--as-of YYYY-MM-DD`; source refreshes require an exact `--revision` commit SHA. Full source and coverage checks run before imported metadata is saved.

## Using the collection

The existing hero setup includes **All heroes & starter decks**. Search by hero, alter ego or product, or filter Core Set/campaign/Hero Pack origins. Each hero shows the product, release date, sales format, all available identity forms and its source starter list. Each deck row shows the printing's product; the deck also summarizes all contributing products.

Collection includes player, encounter, campaign and Pool cards. Product, faction and card-type filters combine with text search. Pagination limits image loading and keeps thousands of records out of the visible DOM. Card inspection and hover previews share the same database.

## Automation boundary

The automated mission pool contains 11 identities: the five Core heroes, Captain America, Hulk, Ms. Marvel, Thor, Black Widow and Doctor Strange. Rhino, Klaw, Ultron, Mutagen Formula and Risky Business provide five scenarios, with nine supported modular sets. `CATALOG_CARDS` and the shared lookup include the complete import for browsing. Adding a record does not supply that card's triggered abilities, setup instructions, multi-villain rules or campaign state transitions.

Supported heroes can configure a mission from an original source deck when every card and deck requirement validates. The other 58 imported identities remain unavailable for automated missions. Account custom decks validate against the same executable registry. The live registry contains 703 executable face registrations and 3,848 unsupported faces; campaigns remain pending. [Exact automation scope and native verification](engine-expansion-coverage.md) distinguish product registration from tested rules behavior.

This document records import and implementation scope. Deployment status is established separately by the committed revision, remote revision, successful deployment and live browser verification.
