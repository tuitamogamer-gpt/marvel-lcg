# Drax and Venom native integration

Drax uses his original 40-card Protection source deck, and Venom his original 40-card Justice source deck. Their physical printing codes, quantities, obligations and nemesis cards remain part of the source composition. The canonical runtime identity IDs are `drax` and `vnm`.

## Exact registration and printed metadata

| Product | Retail faces | Dedicated faces | Exact Core reprints |
| ------- | -----------: | --------------: | ------------------: |
| Drax    |           34 |              29 |                   5 |
| Venom   |           30 |              26 |                   4 |

Drax's Core aliases are `19014`, `19019` and `19022`–`19024`. Venom's are `20014` and `20017`–`20019`. Athletic Conditioning (`19021`), Enhanced Physique (`19033`) and Resourceful (`20020`) retain dedicated physical-printing adapters. They are reprints of other expansion cards, rather than Core aliases. Both products' installed starter, obligation and nemesis dependency closures are complete; registration closure is separate from full interaction certification.

The immutable imported catalog omits five Drax encounter boost values and Challenge Accepted's printed attack modifier. `printed-card-metadata.ts` overlays only the verified numeric fields:

| Face    | Printed boost icons | Other printed correction |
| ------- | ------------------: | ------------------------ |
| `19025` |                   2 | —                        |
| `19026` |                   2 | —                        |
| `19027` |                   3 | —                        |
| `19028` |                   1 | +2 attack                |
| `19029` |                   2 | —                        |

These values were verified against original English card scans in `public/cards/catalog/`, with the corresponding original image URLs recorded in the audit's `runtimeMetadataCorrections`. The imported JSON, printed text and physical quantities remain unchanged. Venom `20023` and `20024` already contain their numeric boosts; `20025` has a star and no numeric triangles, with four physical copies.

The runtime card database and every native local boost lookup consume the same numeric overlay. This includes Leading Blow, Pulse Grenade, Scarlet Witch's boost counting, Captain America's Hit Squad, Ms. Marvel, Doctor Strange and Goblin modules. Challenge Accepted's numeric attachment modifier survives text blanking; Cull the Weak's separate text modifier does not duplicate it.

## Identity and special-zone rules

The [Drax contract](drax-integration.md) documents vengeance counters, the optional identity response, Parry, Knife Leap, Dwi Theet Mastery, continuous Weapon modifiers and the obligation/nemesis flow. Vengeance counters persist across rounds and forms. The identity ability limits its own placement to three; it does not globally clamp counters placed by another effect.

The [Venom contract](venom-integration.md) documents weapon setup, optional Pistol basic-power interrupts, Symbiotic Bond payment, Multi-Gun, Spider-Sense and the obligation/nemesis flow. Venom's nemesis set contains five actual physical cards: one scheme and four separately identified minions. Saved set-aside state preserves these instances rather than replacing them with printing codes.

Venom grants one additional general Restricted slot in either identity form. Side Holster grants additional slots specifically for Restricted Weapon upgrades. The limit allocates Weapon upgrades to those extra slots before counting the remaining Restricted cards against the general allowance. The host rechecks the limit after control changes and cards leaving play.

## Shared basic powers and ally timing

Leading Blow discards a real encounter card and reduces the single basic attack's ATK by that card's printed numeric boost count. A negative modifier remains available for later bonuses to combine with it. Its delayed ready checks positive damage **dealt**, including positive damage prevented by Tough, rather than damage taken. Giant Wasp carries the played event's physical ID through her saved target distribution and checks the aggregate outcome once for the whole simultaneous basic attack, before its forced aftermath.

Making an Entrance adds two THW to the actual basic thwart. Its delayed heal requires positive threat removal that clears a scheme; an initially empty scheme, blocked removal or a Confused replacement does not qualify. Giant Wasp carries the same event instances through the entire simultaneous thwart and heals once per played copy if at least one chosen scheme was actually cleared.

Ordinary ally attack/thwart responses resolve before consequential damage. This follows the explicit Consequential Damage entry in Rules Reference 1.8: “Consequential damage is dealt to an ally after resolving abilities that are triggered by the ally attacking or thwarting.” Gamora's event search and Jack Flag's optional ammo response use this timing. Martyr's different printed trigger follows actual consequential damage: her attack must have defeated an enemy, and she must survive positive consequential damage taken. Tough prevention and a saved minion do not qualify.

Regroup interrupts an actual ally defeat caused by an enemy attack and replaces the discard destination with its physical owner's hand. It preserves the attack's declared defender and Overkill outcome. Consequential damage, Retaliate and damage from an enemy card ability do not count as enemy attacks. The ally is still defeated; responses requiring it to be in its owner's discard pile cannot use a card now in hand. Regroup remains in play until its forced round-end discard.

Shake it Off follows actual attack damage **taken** by a surviving Guardian identity or ally. Explicit recipient IDs and saved damage snapshots distinguish primary and Overkill recipients. All live Hero players may supply the payable event; changing the event's actor does not change the damaged character. Fully prevented damage, defeated allies and enemy targets do not qualify.

## Rules sources and verification boundary

The implementation uses the [official Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), original English card scans and the [archived official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/). The current Drax FAQ distinguishes the identity's local counter-placement maximum from a universal counter cap. The rules also distinguish damage dealt from damage taken and describe Giant Wasp's divided basic attack as one simultaneous attack.

Focused native adapters verify basic-power bonuses, five corrected boost counts, delayed ready/heal outcomes, status replacements, the Guardian and Restricted rules, Martyr, Regroup, teammate response payment, saved choices and source ownership. Separate metadata tests verify the exact 40-card original compositions, canonical identity IDs, copy limits, unchanged raw imports and printed numeric corrections. These product integrations do not add automated campaigns or certify every interaction with the full imported collection.

The shared damage adapter keeps distinct damage-dealt and damage-taken snapshots. Normal prevention retains damage dealt; the specific Overkill rule excludes prevented excess from damage dealt to the identity or villain. Damage prohibitions and Armored Rhino Suit's would-deal replacement precede Tough, while Norman Osborn's would-take replacement follows it. Twenty-three native damage-accounting regressions exercise these boundaries and saved aftermath.

C.I.T.T.'s resource cost now identifies its actual Basic source card. The Power in All of Us therefore generates two wild resources for that ability, following the official 18 January 2023 ruling and Rules Reference 1.8 resource-cost rules. Ability costs retain the identity of their card without satisfying Star-Lord's separate hand-play interrupt.

## Frozen local validation

- The full 108-file regression passes **4,940 cases**, with one existing opt-in advisor measurement skipped. It includes all **1,620** original-source mission configurations across eighteen expansion identities, five scenarios, two difficulties and nine modular sets. A separate **87-case** Star-Lord preservation run also passes, including the previously published Nova Prime/Ultron Drone physical-card regression.
- Native multiplayer initiation tests preserve Spider-Sense and defender context through guided steps, teammate Subdue payments and JSON reloads. Clash's friendly-ally recipient retains ordinary defense; Moondragon's enemy recipient uses outgoing attack damage and keywords.
- The production build, configured formatting check and native Node API entry pass. The API returns HTTP 200 with **49 runtime modules and six JSON dependencies** on Node 24.19.0. All **62 inventory source hashes** match the frozen files.
- Actual production-preview controls pass **134 accessibility audits and 132 layout checks**, with 134 distinct screenshots at 1440, 1280, 390 and 320 pixels. Both original forty-card source launches and all nine native flows preserve physical IDs through saved choices, payments and reloads. No browser errors or accessibility violations remain. Evidence: `output/drax-venom/report.json`; checked entry asset: `index-d4kGq3yh.js`.
- The regenerated registry records **1,020 executable faces**, **544 dedicated faces**, **3,531 unsupported faces** and **23 of 69 identities**. CI contains six independent browser groups and runs each of its thirteen browser commands once. Remote publication and CI results are recorded separately in `progress.md` after the push.
