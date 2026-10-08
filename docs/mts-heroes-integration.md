# Spectrum and Adam Warlock integration

The Mad Titan's Shadow hero scope comprises **72 imported faces through card 21070**, including both identity faces, signature cards, player pools, obligations and nemeses. It uses **60 dedicated registrations and twelve exact Core aliases**. Spectrum's identity module registers sixteen faces, Adam Warlock's identity module registers sixteen, and the shared player module registers twenty-eight. Reverse identity faces count separately from physical cards.

The retail box contains 213 imported faces. This hero integration brings its executable registry to **73 of 213 faces**; one separate face was already Core-equivalent. The other 140 faces, boxed scenarios and campaign remain pending. Registration closure records the available rules handlers; native tests establish only their exercised behavior.

## Original source compositions

The immutable [imported starter lists](../src/data/catalog-decks.json) preserve physical printing codes and quantities. Their provenance points to the [pinned deck table](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747); card text and scans are attributed in [catalog provenance](../src/data/catalog-provenance.json). No upstream implementation code is incorporated by these registrations.

| Composition  | Signature deck cards |         Aspect deck cards | Basic deck cards | Permanent setup cards | Playing deck |
| ------------ | -------------------: | ------------------------: | ---------------: | --------------------: | -----------: |
| Spectrum     |                   15 |             16 Leadership |                9 |                     3 |           40 |
| Adam Warlock |                   15 | 6 of each of four aspects |                1 |                     0 |           40 |

Spectrum's source composition contains **43 physical cards**. Gamma `21002`, Photon `21003` and Pulsar `21004` each occur once, start in play facedown and stay outside the forty-card playing deck. Required composition validation locks all eighteen physical signature/setup cards. Alternate-aspect app decks retain all three setup forms. The saved deck editor shows the forty-card count and three setup cards, with each energy form fixed as a setup row. Source launch passes this same physical composition into the native setup pipeline.

Spectrum's ordinary signature cards are Blue Marvel `21005` ×1, Energy Duplication `21006` ×2, and Gamma Blast `21007`, Photon Speed `21008`, Pulsar Shield `21009` and Speed of Light `21010` ×3 each. Her hero has 11 HP, 1 ATK, 1 THW, 1 DEF and a five-card hand; Monica Rambeau has REC3 and a six-card hand. The one active physical energy form adds +2 to its matching stat. The other forms remain in play facedown with inactive text. The active physical ID persists through `spectrumEnergyFormId`; absence means all forms are facedown. [Spectrum's native contract](spectrum-integration.md) records form transitions, response costs and encounter behavior.

Adam Warlock's source signatures are `21032`–`21035` ×1, Cosmic Ward `21036` and Mystic Senses `21037` ×2, Karmic Blast `21038` ×3, and Cosmic Awareness `21039` and Quantum Magic `21040` ×2. Source pool cards `21041`–`21065` each occur once. His hero has 11 HP, 1 ATK, 1 THW, 2 DEF and a five-card hand; his alter ego has REC3 and a six-card hand.

Warlock automatically selects Aggression, Justice, Leadership and Protection. A valid custom deck contains equal physical quantities of the four colors and at most one copy of each non-signature logical card, including copies spread across reprints. His mandatory multi-copy signatures retain their exact printed source quantities. The editor presents all four aspect totals together, locks signatures and limits each other printing selector to one copy; the final validator also detects two matching printings selected separately. Basic cards count toward deck size and singleton limits without affecting aspect equality. Battle Mage's Leadership bonus belongs to its chosen receiving hero seat for the current round; `heroStats` reads the same serialized bonus for every hero, including teammates.

## Core aliases and expansion reprints

| Physical source printing | Existing Core rules |
| ------------------------ | ------------------- |
| `21021` Avengers Mansion | `01091`             |
| `21023` Energy           | `01088`             |
| `21024` Genius           | `01089`             |
| `21025` Strength         | `01090`             |
| `21044` Uppercut         | `01054`             |
| `21045` Combat Training  | `01057`             |
| `21049` For Justice!     | `01060`             |
| `21051` Heroic Intuition | `01065`             |
| `21056` Make the Call    | `01071`             |
| `21057` Inspired         | `01074`             |
| `21062` Counter-Punch    | `01077`             |
| `21063` Armored Vest     | `01081`             |

Moxie `21017` and Avengers Tower `21020` are expansion reprints with dedicated physical-printing adapters in `mts-player-pack.ts`. They remain among the twenty-eight dedicated player faces and never become additional Core aliases. Deck and unique-card checks compare logical identity across printings while execution preserves the physical code.

## Verification boundary

`tests/mts-metadata-decks.test.ts` checks canonical identities, both exact source compositions, Permanent setup exclusion, fixed setup quantities, all four Warlock pools, equal-color validation, singleton limits across physical reprints, native copy selectors and rendered deck totals. `tests/expansion-missions.test.ts` adds both identities to source-deck mission configurations and includes Spectrum's physical setup forms in the source-conservation invariant. The machine inventory separately checks all seventy-two hero-scope faces, both full starter/obligation/nemesis dependency closures and the remaining partial-box boundary.

The source hash manifest includes `spectrum.ts`, `warlock.ts`, `mts-player-pack.ts` and their shared metadata/runtime adapters. Final native mission, browser and release validation totals belong to the frozen publication snapshot. This contract does not certify the box's unimplemented scenarios or campaign, untested later-product interactions, or remote publication.

## Frozen local validation — 2026-10-08

- The full 118-file regression passes **5,485 tests**, with one existing intentional advisor-measurement skip. It includes all 1,800 original-source mission configurations across twenty installed expansion identities, five scenarios, two difficulties and nine modular sets. Evidence: `output/mts-regression-frozen-final.log`.
- The production build and configured formatting checks pass. Native Node 24.19.0 API startup returns HTTP 200 with **52 runtime modules and six JSON dependencies**. All **65 inventory source hashes** match. Evidence: `output/mts-build-certified-final.log`, `output/mts-style-certified-final.log` and `output/mts-api-certified-final.log`.
- The exact frozen entry is **`index-fEKriAFK.js`**, SHA-256 **`d5f19e077b5425910eccbaa3d034fe451ab802efd1c119794337273d2dc397c0`**. The exact production entry passes twelve native flows and both original-source launches at 1440/1280/390/320: **162 accessibility audits, 160 layout checks and 162 distinct screenshots**, with zero browser errors or accessibility violations. Evidence: `output/mts-heroes-production/report.json`, with its immutable desktop and mobile reports retained separately. The selected 21-screen visual review and supplemental 1280 Pulsar rail reachability control are documented separately in `output/mts-heroes-visual-review.json`.
- The generated registry contains **1,080 executable faces, 604 dedicated faces, 3,471 unsupported faces and 25 of 69 identities**. MTS has 73/213 registered faces, with its boxed scenarios and campaign excluded.

The published Drax/Venom release remains `a5d55c346554dde192d68fa7dc66eb85ad212352` on the previously verified READY canonical deployment. Its official [CI run 37705896285](https://github.com/tuitamogamer-gpt/marvel-lcg/actions/runs/37705896285) passes all seven jobs; the official unit run records 4,941 passing tests, one intentional skip and 108 passing files. That remote evidence belongs to Drax/Venom. The MTS results above establish local release readiness and do not claim MTS deployment or official MTS CI.
