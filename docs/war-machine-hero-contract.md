# War Machine original Hero Pack source and registration

War Machine uses canonical identity ID `warm`, with the original `23001a/b` identity faces. The pack released on 5 November 2021 and contains **36 imported faces**: sixteen dedicated identity/signature/obligation/nemesis faces, fifteen dedicated player-pool faces and five exact Core reprints. `WAR_MACHINE_SCRIPT_CODES` and `WAR_MACHINE_PACK_SCRIPT_CODES` register the two native modules. Reverse identity faces count separately from physical cards.

## Original Leadership source

The [immutable source snapshot](../src/data/catalog-decks.json) and its [pinned starter source](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747) supply exactly **40 physical cards: 15 signatures, 19 Leadership and 6 Basic**. The [original card gallery](https://hallofheroeslcg.com/war-machine/) supplies printed-rules provenance. The source list has no Permanent setup cards or supplementary deck. Playing cards retain their actual `230xx` printings and individual IDs.

| Signature printing       | Physical quantity |
| ------------------------ | ----------------: |
| `23002` Iron Man         |                 1 |
| `23003` Munitions Bunker |                 1 |
| `23004` Upgraded Chassis |                 1 |
| `23005` Gauntlet Gun     |                 2 |
| `23006` Missile Launcher |                 1 |
| `23007` Shoulder Cannon  |                 1 |
| `23008` Repulsor Beam    |                 2 |
| `23009` Targeted Strike  |                 2 |
| `23010` Scorched Earth   |                 2 |
| `23011` Full Auto        |                 2 |

War Machine follows the ordinary one-aspect rule. The generic deck editor locks those exact signature quantities, validates 40–50 playing cards and applies logical copy limits across printings. Innovation and Two Against the World are limited to one per deck. Matching James Rhodes ally printings are excluded by the identity uniqueness rule. Alternate-aspect starters retain every required signature copy.

War Machine has HP10, ATK2, THW1, DEF2 and a five-card hero hand; James Rhodes has REC3 and a six-card hand. An active, unblank Upgraded Chassis grants Aerial only in hero form. The generic `aerial` provider reads `warMachineTraits` without altering printed combat stats.

## Physical nemesis source and printed boosts

The obligation is `23028` (one physical card). The separate set-aside nemesis source is `23029` Living Laser, `23030` Deadly Light Show and **three distinct physical `23031` Laser Strike cards**. The initializer runs only when the source zone is absent; save/reload retains its existing IDs, and an existing empty source is never replenished.

Original scans [Deadly Light Show](../public/cards/catalog/23030.webp) and [Laser Strike](../public/cards/catalog/23031.webp) verify **three numeric boost triangles** and **one numeric triangle plus a separate boost star**, respectively. Together with `23028` and `23029`, numeric boosts are **2, 2, 3, 1**. The immutable imported values already match these scans. No War Machine numeric correction is added. Previously verified Drax boost/+2ATK corrections and Nebula Lethal Weapon's +1ATK overlay remain intact.

## Exact Core aliases

| Physical War Machine printing | Existing Core rules |
| ----------------------------- | ------------------- |
| `23020` Make the Call         | `01071`             |
| `23022` Mockingbird           | `01083`             |
| `23025` Energy                | `01088`             |
| `23026` Genius                | `01089`             |
| `23027` Strength              | `01090`             |

Existing mechanical fingerprints supply these five aliases. Falcon `23014`, Goliath `23015`, Innovation `23021` and Quincarrier `23023` are reprints of other expansion cards and keep dedicated physical adapters. They add no Core aliases.

## Measured registration and verification boundary

The read-only live audit measures **31 newly executable and 31 dedicated faces** beyond the Nebula baseline. The registry contains **1,140 executable faces, 3,411 unsupported faces and 665 dedicated faces**, with 27 registered identities. War Machine's product and original starter/obligation/nemesis dependencies have installed registration closure. The auditor hashes 69 source files, including both new modules. This is a registration measure; it does not certify arbitrary interactions or remote publication.

`tests/war-machine-metadata-decks.test.ts` verifies canonical identity aliases, original source quantities, all 36 retail registrations, exact Core aliases, alternate aspects, cross-printing copy limits, locked editor signatures, rendered original-deck launch, immutable printed metadata, Aerial blanking and forty distinct owned player pieces. It also checks five actual set-aside nemesis pieces and reload/idempotence behavior. [Identity integration](war-machine-integration.md) and [player-pool integration](war-machine-pack-integration.md) describe the native module contracts. Native host, full mission matrix and production-browser results are recorded below against the corrected frozen release snapshot; remote publication remains a separate checkpoint.

## Corrected frozen local release preparation — 2026-10-08

The corrected production build and configured formatting pass; native Node 24.19.0 startup returns HTTP 200 with **56 runtime modules and six JSON dependencies**. All **69 source hashes** match the frozen inventory, recording **1,140 executable faces, 665 dedicated faces, 3,411 unsupported faces and 27 identities**. The sole entry is `index-CAjIDySW.js`, SHA-256 `caf7f52800b283acb8f9cbb62b5dedf082e3ec62732dd7ea8d658a440a90bd8a`. Evidence: `output/warm-build-goliath-final.log`, `output/warm-api-goliath-final.log` and `output/warm-style-goliath-final.log`.

Gauntlet Gun retains its printed War Machine-event resource restriction, including Alliance payments. An allied Gamora cannot use it to fund a non-War-Machine event. Committed Gun payment adds ammo before the event’s ammo cost; cancellation leaves both unchanged. Sneak Attack retains an actual eligible ally while paying, and Black Panther stores and replays actual physical events. Saved continuations include nested stored cards and the five separately held nemesis IDs.

The corrected ordinary Goliath attack/thwart route retains his independent special ability, physical Command Team ready and phase-end discard. The focused player-pool run passes **91 cases: 58 pure and 33 native**; all **90 War Machine source mission configurations** pass. The corrected full regression passes **6,138 tests, one existing intentional skip and 132 files**, including all **1,980 original-source mission configurations** (`output/warm-regression-goliath-final.log`). The same corrected entry passes twelve native flows plus the original source launch at 1440/1280/390/320: **137 accessibility audits, 136 layout checks and 137 distinct screenshots**, zero browser errors or accessibility violations. The new Goliath flow exercises ordinary THW while his special remains available, actual Command Team ready, boosted ATK5 and the same physical ally's end-phase discard. Every saved continuation conserves the original forty player-card IDs, nested stored events and five separately held nemesis IDs. Evidence: `output/war-machine-production-goliath-final/report.json`; immutable raw reports are retained in `output/war-machine-production-goliath-desktop/` and `output/war-machine-production-goliath-mobile/`. The ten-image manual review of the same corrected entry is recorded in `output/war-machine-goliath-visual-review.json`. Exact commit/push, READY deployment identity, canonical live controls and official CI remain pending.
