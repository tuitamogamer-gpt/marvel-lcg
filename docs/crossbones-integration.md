# Crossbones scenario integration

Crossbones is the first enabled standalone scenario from The Rise of Red Skull. Its seventeen original faces, `04058`–`04071`, represent nineteen physical cards: three villain stages, three reversible main schemes and thirteen encounter cards. Standard uses stages I–II and Expert uses II–III, so each game conserves eighteen selected physical Crossbones cards. The box's other four scenarios and campaign remain unsupported.

## Original source and setup

The original catalog, starter lists and image mappings remain unchanged. All seventeen original English card scans were reviewed. The imported `04061b` omitted its printed ability, **When Revealed: Reveal the top card of the Experimental Weapons deck.** A narrow `printed-card-metadata.ts` overlay restores that exact instruction. No numerical metadata correction is required. The first scheme's printed Hydra Patrol recommendation has the published RRG 1.4 correction to Hydra Assault; the existing import already contains that erratum.

The scenario requires three distinct modular sets, defaulting to Hydra Assault, Weapon Master and Legions of Hydra. Each slot can be replaced with another supported module. Experimental Weapons cannot occupy a modular slot because its four original physical cards form a separate shuffled deck. The first main scheme immediately reveals its top weapon, leaving three in the separate deck. A revealed weapon enters normal play and subsequently goes to the ordinary encounter discard; it never returns to the separate deck or replenishes that deck. Revealing an exhausted separate deck does nothing. This follows [The Rise of Red Skull rulebook, page 5](https://hallofheroeslcg.com/wp-content/uploads/2020/09/rorsrulesspoilers.pdf).

| Original face | Physical copies | Native behavior |
| --- | ---: | --- |
| 04058–04060 | 1 each; two selected | Villain stages I/II/III, conditional Piercing; II searches for the actual Machine Gun, III reveals a separate weapon |
| 04061a/b–04063a/b | 1 of each reversible card | Three main schemes with per-player threat limits 3/6/5; each reverse reveals a separate weapon |
| 04064 | 1 | Machine Gun: 2 ammo per player, spend ammo and discard one encounter card for indirect damage when Crossbones attacks |
| 04065 | 1 | Armor: printed +1 ATK/+1 SCH, replace damage with damage placed on Armor, discard at five or more |
| 04066 | 2 | Hydra Bomber: choose two damage or one main-scheme threat when revealed |
| 04067 | 2 | Full Auto: Surge in alter-ego, otherwise discard current ATK cards and take indirect damage for their boost icons |
| 04068 | 2 | Hard as Nails: give Tough, or heal three if unable; same boost ability |
| 04069 | 2 | Raid the Armory: Incite 1, discard until a Weapon attachment is found, reveal that same physical card |
| 04070 | 2 | Crossbones' Assault: two starting threat per player and acceleration; activate against the player who defeated it |
| 04071 | 1 | Cornered Staff: three fixed starting threat and Crisis; discard one encounter card per player and add their boost icons as threat |

Selected scan SHA-256 evidence:

- `04061b.webp`: `2f2de0a7fe0173b9bdcdd5befa23b12e25c7e9390238a4e7d7712699b4b38b50`
- `04064.webp`: `ceb21351b4c4cd1e43633b4557425d87b30968643af4375cf644b91cf48b56b6`
- `04065.webp`: `b17d5f4f5166f5cf153e71464cc0e4d8639cdd2ac635bf19fab8cbe13907db7b`

## Rules and physical state

The saved scenario state owns the original weapon deck, pending villain stage, pending main schemes and current main-scheme card. The ordinary villain, encounter, attachment, resolving and removed zones own their actual physical instances. Queue entries, prompt choices and public scheme counters are views or continuations, never duplicate physical cards. JSON reload retains deck order, ammo, Armor damage and pending choices. Effects already resolving against Crossbones follow the continuing villain across a stage transition, including remaining status instructions after damage defeats the previous stage. Retired stage cards retain their original physical IDs.

Machine Gun resolves within an initiated attack, before ordinary attack step 1 and defense selection. Stun or another replacement that prevents the attack also prevents its forced interrupt. The Gun spends a counter and discards the actual top encounter card; its indirect damage counts only numeric boost icons, with the native player allocation and damage-response windows. After the last ammo counter is spent and its effect resolves, Uses discards the Gun. The current ruling permits defense events during this indirect damage; see [FFG ruling, 18 October 2024, question 25](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/). Conditional Piercing checks whether Crossbones currently has a Weapon attachment. Armor's replacement follows Tough and other native damage ordering, absorbs the whole applicable damage amount, and discards once it holds at least five damage. Printed attack and scheme modifiers remain separate from text blanking. Relevant rules are in [RRG 1.8, pages 14, 25, 31 and 46](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).

Numeric icon counts for Machine Gun, Full Auto and Cornered Staff pass through the native boost-counting window. Scarlet Witch's Chaos Control and Scarlet Witch's Crest can replace or adjust the individual counts before the resulting indirect damage or threat is applied. Counting a discarded card never executes its boost-star ability.

When Weapon Master triggers an attack, its weapon condition resolves after that activation fully resolves. RRG 1.8 page 6 explicitly defines an effect initiating an enemy activation as resolved only after the activation fully resolves; this supersedes the older pre-resolution example. Machine Gun's forced interrupt precedes optional interrupts at the same attack-initiation timing, including Spider-Sense. Current Cosmo errata do not grant access to the separate weapon deck. Source-mission validation also exposed an existing Quicksilver legality gap: For ordinary play, Speed Cyclone now requires a payable positive X before it is offered as playable, using the same native payment choices as the actual play command. Effects that ignore its resource cost retain their existing legal play path.

## Coverage and validation boundaries

The installed registry contains 2,302 executable faces, including 1,863 dedicated faces, and 2,249 unsupported faces. It retains all 2,286 prior executable registrations and closes sixteen previously unsupported Crossbones faces; Hydra Bomber (`04066`) already had a Core-equivalent registration and now uses the dedicated scenario adapter. There are 57 identities, eleven scenarios, thirty modular sets and 129 source-hash paths. Rise of Red Skull has 90 executable faces out of 181; ninety-one remain pending. No automated campaign is enabled.

The configured original-source mission matrix contains 33,904 configurations, `52 × 2 × (11 × 30 − 4)`, in eight disjoint shards of 4,238. All 30,888 preceding mission names and seeds and all older retained subsets are preserved. The additional 3,016 Crossbones configurations cover fifty-two expansion heroes, both difficulties and twenty-nine legal primary module choices, with two deterministic distinct companion modules. This is not exhaustive coverage of all module triples. Physical conservation checks include all eighteen selected scenario cards, all four Experimental Weapons and every original player-source instance.

Registration and matrix counts describe configured support. Publication remains preview-only at the user's request; local validation does not claim completed remote CI or a production deployment.

## Measured local validation — 2026-10-26

The final frozen regular regression passes **10,013 tests across 281 files**, with one existing intentional skip, in **1,066.31 seconds**. It includes the **74 native Crossbones tests**, **19 original-source contract tests** and **18 inventory tests**; those subsets must not be added again to the full total. Real card-play regressions cover continuing villain targets after a stage changes, Speed Cyclone's normal affordability and ignored-cost contexts, and native Chaos Control/Crest counting for all three affected Crossbones abilities.

All **3,016 new Crossbones original-source missions** pass on that same runtime, covering all 52 expansion heroes, both difficulties and all 29 legal primary modules. Eight filtered global shards passed **364, 364, 390, 390, 364, 364, 390 and 390** cases, with four running concurrently; total wall time was **1,089.52 seconds**. Every mission retains the complete original player source and all eighteen selected Crossbones cards plus four Experimental Weapons. All **129 source hashes** match before and after execution. The structural gate preserves the full 33,904-configuration manifest, every preceding 30,888 name and seed, and all older retained subsets. These local mission results do not claim execution of the entire 33,904-configuration matrix.

The complete final browser run passes **84 cases, 120 accessibility audits and 120 layout checks** at **1280, 768, 390 and 320 px**, with no browser errors. Its actual served entry is `index-47xNtrsF.js`, SHA-256 `a73e788a1ecfa71b4f8601d2e7c099e42222c072ec1087a4846f26daaa296053`. The retained experience gate passes **seven flows, ten accessibility audits and nine layout checks**, and final visual review passes. TypeScript, production build, formatting and the production API entry also pass.

Final evidence is retained in `output/crossbones/mission-verification.json`, `inventory-verification.json`, `missions/final-shards/`, `final-regular-tests.log`, `final-build.log`, `final-format.log`, `final-production-entry.log`, `final-local/report.json`, and `output/experience/crossbones-final/report.json`. Earlier failed or interrupted snapshots are explicitly archived as superseded and are excluded from these final measurements.
