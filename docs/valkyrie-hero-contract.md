# Valkyrie source and registration contract

Valkyrie's canonical hero, product and signature-set ID is `valk`, with hero `25001a` and alter ego `25001b`. The retail Hero Pack contains **37 imported faces**. Its identity module owns eighteen faces (`25001a`, `25001b`, `25002`–`25012`, `25028`–`25032`); the player-pool scope comprises nineteen faces, of which fourteen need dedicated physical-printing adapters and five use exact Core rules. Native identity and player-pool hosts are installed and independently exercised; mission, browser and publication verification remain separate assertions.

## Exact original source

The immutable [original source list](../src/data/catalog-decks.json) contains **41 physical cards: sixteen signature cards, eighteen Aggression cards and seven Basic cards**. All original printing codes and quantities are retained.

Death-Glow `25002` is **not Permanent** and counts toward the constructed deck size. Its one required physical copy remains a locked signature row in the deck editor; it is not labeled as a Permanent setup card. Before shuffling and drawing, native setup moves that same owned card into its owner's set-aside zone. The original forty-one-card composition therefore leaves forty ordinary player cards. A legal custom composition of forty cards leaves thirty-nine ordinary cards after setup. No replacement card is generated.

The signatures are `25002`–`25007` ×1, Flight of the Valkyrior `25008` ×2, Visit Valhalla `25009` ×1, Chooser of the Slain `25010` and Shieldmaiden `25011` ×2, and Have at Thee! `25012` ×3. All sixteen signatures remain mandatory in every selected aspect.

The original Aggression pool is `25013`–`25016` ×1, Combat Training `25017` ×2, Quick Strike `25018`, Smash the Problem `25019` and The Best Defense… `25020` ×3, Audacity `25021` ×1 and The Power of Aggression `25022` ×2. The Basic pool is The Bifrost `25023` ×1, Godlike Stamina `25024` ×3 and Energy/Genius/Strength `25025`–`25027` ×1.

## Exact Core aliases

| Physical printing               | Core rules |
| ------------------------------- | ---------- |
| Combat Training `25017`         | `01057`    |
| The Power of Aggression `25022` | `01055`    |
| Energy `25025`                  | `01088`    |
| Genius `25026`                  | `01089`    |
| Strength `25027`                | `01090`    |

These five pairs match the complete printed text, traits, resource icons, cost, card type, faction, numeric stats, uniqueness and deck limits. Runtime execution keeps each physical Hero Pack code. Angela `25015`, Hall of Heroes `25016`, Quick Strike `25018` and The Best Defense… `25020` are other-product reprints and retain dedicated physical-printing adapters; they do not become Core aliases.

Valkyrie's obligation is Trouble in Otherworld `25028`. The five actual nemesis cards are Enchantress `25029` ×1, Powerful Enchantments `25030` ×1, Beguiled `25031` ×1 and Seduced `25032` ×2. They are separate from the forty-one-card source composition and retain their physical IDs through saved continuations.

## Verification boundary

`tests/valkyrie-metadata-decks.test.ts` checks the exact forty-one-card source, sixteen required signatures, Death-Glow's constructed-card count, all five complete Core equivalences, printing ownership and native deck-editor presentation. The connected identity setup also passes actual original-source 41→40 and custom-deck 40→39 physical-zone tests, including saved Death-Glow and nemesis IDs. The [identity contract](valkyrie-integration.md) describes Death-Glow, target-specific weapons, encounter ownership and current rulings. Native identity and player-pool evidence is recorded in their linked contracts. Full mission regression, production browser checks and publication evidence are recorded only when their respective checks complete; pending release gates are not claimed as passed.

The standalone source comparison records all thirty-seven retail faces, the exact 16/18/7 source split and all sixteen checked printed fields for each Core pair in `output/valkyrie-static-source-check.json`. All five pairs match without altering either imported data file. All seventeen metadata/source/editor/native-setup cases pass in `output/valkyrie-metadata-final.log`. The frozen five-suite identity/player-pool/Thor proof passes 186 tests (`output/valk-pool-native-certified.log`). The inventory has 1,172 executable registrations, 697 dedicated faces, 3,379 unsupported faces and 28 identities, and all 71 runtime/data source hashes match. The final full mission and production-browser certification are recorded below.

## Packaging and source conservation — 2026-10-08

The matrix uses the declared original **41-card** composition rather than a
forty-card assumption, and includes the same physical Death-Glow from set-aside
when taking its initial source snapshot. Its physical-zone walker traverses
actual player/encounter zones, set-aside cards, stored and captured cards and
native `droneCard` children without deduplication. Saved prompts, queued effect
snapshots and attack snapshots are excluded. This catches both missing IDs and
duplicate physical placements while leaving the five separate nemesis cards
outside the source composition. Generic engine and account starter validation
use the printed source/deck count. Their focused checks each pass 112 cases; the
remaining filtered cases are not a full-regression claim.

`output/valkyrie-release-copy-manifest.json` records an explicit changed-file copy
against the frozen War Machine stage, without deletes. Its release-ready flag is true after the final full unit and browser checks pass. It records
baseline/current hashes and preserves published MAIN history separately from
local Valkyrie checks.

## Frozen local release preparation — 2026-10-08

The final production build and configured formatting pass; native Node 24.19.0 API startup returns HTTP 200 with **58 runtime modules and six JSON dependencies**. All **71 inventory source hashes** match, with **1,172 executable faces, 697 dedicated faces, 3,379 unsupported faces and 28 registered identities**. The sole frozen entry is `index-BTl78Eo6.js`, SHA-256 `75f97640797dcf3dd53824633aa4b8c416eaa333ae0ca6931b7f5b618b8b457f`. Evidence: `output/valk-release-final-build.log`, `output/valk-release-final-api.log`, `output/valk-release-final-style.log` and `output/valk-release-final-audit.log`.

All **90 Valkyrie original-source mission configurations** pass in `output/valk-thor-drone-ninety-clean-final.log`; the native Thor/public-Drone and Seduced controls pass **48 cases across two files** in `output/valk-thor-seduced-native-final.log`. The full source matrix includes **2,070 configurations across twenty-three installed expansion identities**. The clean frozen full regression passes **6,415 tests, one existing intentional skip and 137 files**, including all **2,070 original-source mission configurations** (`output/valk-regression-certified-final.log`). Exact commit/push, READY deployment, canonical live behavior and official CI remain pending for Valkyrie at this checkpoint.

The same frozen entry passes fourteen native flows plus the original-source launch at 1440/1280/390/320: **165 accessibility audits, 164 layout checks and 165 distinct screenshots**, zero browser errors or accessibility violations. Actual paid and chosen continuations conserve all forty-one original source IDs, including the same set-aside Death-Glow, physical stored/captured cards and the separately held nemesis IDs. Thor's new flow attacks a publicly named synthetic Ultron Drone, preserves its hidden actual source, orders a single attack batch, pays two consequential damage once and leaves Valkyrie's exhaustion unchanged. Evidence: `output/valkyrie-production/report.json`; immutable raw reports remain in `output/valkyrie-production-desktop/` and `output/valkyrie-production-mobile/`. The ten-image manual review of this same entry is recorded in `output/valkyrie-visual-review.json`.
