# Rise of Red Skull modular encounters

Hydra Assault (`hydra_assault`), Weapon Master (`weap_master`) and Hydra Patrol (`hydra_patrol`) complete the remaining standalone modular sets from The Rise of Red Skull. Their ten original faces, `04145`–`04154`, represent seventeen physical cards. They append after Experimental Weapons at module indices 27–29, preserving every previous index and deterministic mission seed. Crossbones is implemented in a subsequent [scenario integration](crossbones-integration.md); the other four boxed scenarios and campaign remain unsupported.

| Module | Original faces | Physical quantities | Total |
| --- | --- | --- | ---: |
| Hydra Assault | 04145, 04146, 04147 | 3, 2, 1 | 6 |
| Weapon Master | 04148, 04149, 04150, 04151 | 1, 1, 2, 1 | 5 |
| Hydra Patrol | 04152, 04153, 04154 | 2, 3, 1 | 6 |

## Printed source and metadata

The imported catalog, original starter lists and image mappings remain unchanged. All ten original English scans were reviewed. Hydra Flame-Soldier (`04145`) visibly has one numeric boost icon and a separate star; the imported card omitted the numeric value. A narrow `printed-card-metadata.ts` overlay restores `boost: 1` while keeping the imported field absent. A second overlay restores Weapon Master's (`04150`) printed "When Revealed" headings, which the import misspelled "When Reveled", so native reveal windows recognize both form-specific abilities. Hydra Jet-Trooper (`04146`) has a star and no numeric boost icon. Hydra Patrol (`04154`) starts with two threat per player, has Crisis, and provides two boost icons.

The source images are the existing `public/cards/catalog/<code>.webp` files, corresponding to the catalog's original English image URLs. Relevant SHA-256 evidence:

- `04145.webp`: `3b33cd59b101523375ac6c333fad6052969988a8fed694af9125edc9f848c043`
- `04146.webp`: `e3711983c9f1567dcc5ae6eab6809d69d27aa30600a02e296f3d73c097c81f53`
- `04150.webp`: `9ccd1e37e81840ea1db9166c753022d6df39d85fd9b81e416ec6243c68921e4c`
- `04154.webp`: `12767935203ff718c00b0e14640a75b95be8b2583914d1ad26828c22905d4115`

## Native rules

Hydra Flame-Soldier discards one support controlled by the attacked player after a completed undefended attack, even if that attack dealt no damage. Its boost ability checks whether the current attack is undefended when the boost resolves and discards a support at that time. Defending with an event counts as defense. Actual attack and defense receipts determine the response rather than reconstructing whether damage happened.

Hydra Jet-Trooper has Quickstrike. Its boost ability checks whether the player is in hero form, then schedules a villain attack after the current activation and its responses finish. That additional attack does not deal new boost cards; the original activation keeps its own boost resolution and physical cards.

Hail Hydra! makes every Hydra minion engaged with a hero attack that hero, then makes every player who was not actually attacked this way search the encounter deck and discard pile for a Hydra minion and put it into play engaged with them. Stunned or Webbed Up replacements are not attacks. The native attack receipt follows the final attacked player when a teammate defends. The search retains the actual physical minion and uses put-into-play timing, including engagement and Quickstrike, without When Revealed or Incite. Its published Rules Reference 1.4 erratum shuffles only when the encounter deck was searched.

Combat Knife adds its printed +1 ATK and continuously gives the attached villain's attacks Piercing. Hydra Sidearm adds its printed +1 ATK and grants Ranged to an actual attack when it begins; that attack retains the grant after Sidearm leaves or becomes blank. Blanking removes the text abilities while retaining printed attack modifiers. Each Hero Action discards its attachment after paying one Mental and one Physical resource through the native payment prompt, including wild substitution and cancellation.

Weapon Master makes the villain scheme against an alter-ego or attack a hero, then gains surge if the villain has a Weapon attachment. The trait check occurs after the activation, and a blank Weapon attachment still has its printed trait. Concussion Grenade gives Confused and places one threat in alter-ego form, or gives Stunned and deals one damage in hero form; its amount is two if that identity was already affected by the respective status before this card. Native Steady and Stalwart rules still apply when giving the status.

Hydra Regular has Incite 1 when revealed, but not when merely put into play. Hydra Soldier has Guard and deals its engaged player an encounter card when defeated. Hydra Patrol is a Crisis side scheme with two starting threat per player. Its defeat makes every player search for and put into play an actual Hydra minion, then shuffles the encounter deck as its printed instruction requires.

## Registration and verification boundaries

This modular checkpoint configured 30,888 source missions: `52 × 2 × (10 × 30 − 3)`. Eight disjoint shards contained 3,861 missions each, with every expansion hero represented in every shard. Its global manifest preserves all 27,768 previous names and seeds and every earlier retained subset. The additional three modules contribute 3,120 configurations.

At this modular checkpoint, 74 of the box's 181 imported faces were executable and 107 remained unsupported. Closing these three modular sets did not enable its scenarios or campaign; the subsequent Crossbones integration records the expanded scope.

Registration closure and matrix configuration are separate from completed runtime tests, source-mission execution, browser acceptance and publication. Release measurements belong to the final frozen runtime and are recorded after the corresponding checks finish.

## Measured local validation — 2026-10-25

The frozen regular regression passes **9,860 tests across 279 files**, with one existing intentional skip. Its scope includes **46 new native module tests** and the **292 neighboring regression tests** also checked separately; these are not additional tests to add to the full-suite total. The inventory suite passes all **17 cases**, including exact modular quantities, both metadata overlays, unchanged prior executable registrations and all **128 source hashes**.

All **3,120 new original-source missions** pass: **1,040 for each module**, covering all 52 expansion heroes, ten scenarios and both difficulties. Every run retains the existing physical-card conservation and bounded-game assertions. The separately filtered structural checks pass in both complete and sharded collection modes, preserving the complete 27,768-configuration previous manifest and every earlier retained subset. These measured new-module runs do not claim execution of the entire current 30,888-configuration CI matrix.

Evidence is retained in `output/red-skull-modules/inventory-verification.json`, `mission-verification.json`, the inventory/structure logs and the three `missions/*.log` files. Browser and preview publication evidence are recorded separately after their checks finish.

The frozen production build also passed **63 distinct browser cases across four targeted runs**, with **81 accessibility audits and 81 layout checks**, no browser errors, exact physical source conservation and JSON reload checks. The combined report explicitly records the separate runs. All cases used `index-DZDRMWHC.js`; its actual browser response SHA-256 is `caca6673c16ead37eaec1cc1f631bd98753d5d98a732d40b5c9f5217c3a9c835`. Representative 320 px payment/search dialogs and the 390 px table were visually reviewed.

The merged-interface regression passed seven experience flows (ten accessibility audits, nine layout checks). Mobile Fish Audio acceptance passed fifteen checks, ten accessibility audits and ten layout checks, with four real verified assets and no errors. TypeScript, production build, formatting and the production API entry also passed. Publication remains preview-only; these local results do not claim completed remote CI or a production deployment.
