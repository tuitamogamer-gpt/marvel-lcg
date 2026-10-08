# Nova and Ironheart original source and registration contract

This hero import covers Nova, Ironheart, their signature cards, player pools, obligations and nemeses. It covers **66 faces from 76 retail faces**: 28 Nova faces and 38 Ironheart faces. The five Armadillo faces `28028`–`28032` and five Zzzax faces `29036`–`29040` belong to separate modular encounter sets and remain outside this release. Importing the hero packs does not claim those modules, scenarios or campaigns.

## Original sources and canonical identities

Nova uses canonical ID `nova`, pack/set alias `nova:nova`, hero `28001a` and alter ego `28001b`. The original Aggression source contains **40 physical player cards: 15 signatures, 20 Aggression and 5 Basic**. The printed signature quantities are Ms. Marvel `28002` ×1; Forcefield Projection `28003` ×2; Lightspeed Flight `28004` and Pot Shot `28005` ×3; Unleash Nova Force `28006` and Connection to the Worldmind `28007` ×2; Jesse Alexander `28008` and Supernova Helmet `28009` ×1. Neither the identity nor the obligation and nemeses belong to the 40-card draw deck. Nova has no Permanent setup piece or supplementary identity deck. Supernova Helmet starts in the player composition and reaches play through a card or identity ability.

Ironheart uses canonical ID `ironheart`, pack/set alias `ironheart:ironheart` and all six original identity faces `29001a`/`29001b`, `29002a`/`29002b` and `29003a`/`29003b`. These are **three physical two-sided identities**, representing Version 1, Version 2 and Version 3. They are one playable hero and one catalog selection. The original Leadership source contains **40 physical player cards: 15 signatures, 17 Leadership and 8 Basic**. Its signatures are Brawn `29004` ×1; Fly Over `29005` ×2; Photon Beam `29006` ×3; New and Improved `29007` ×2; Sector Scan `29008` ×1; Stroke of Genius `29009` ×2; Ronnie Williams `29010`, Tony Stark A.I. `29011`, Photon Blasters `29012` and Propulsion Jets `29013` ×1. Each Stroke of Genius retains its one printed Mental icon.

The downloaded source-deck JSON keeps its original 40-card lists and empty setup/supplementary maps unchanged. The playable catalog/runtime adapter supplies Ironheart's two additional physical identities as `supplementaryCards: { "29002a": 1, "29003a": 1 }`. These pieces do not enter the draw deck, affect deck size or act as Permanent player cards. Version 1 Riri Williams `29001b` is the active starting face, with Version 2 and Version 3 set aside. A saved game holds one actual Version 1 identity piece plus two actual owned set-aside pieces, not a separate piece for every face.

The [original Nova starter card](https://hallofheroeslcg.com/wp-content/uploads/2022/05/deck1.jpeg) and [original Ironheart starter card](https://hallofheroeslcg.com/wp-content/uploads/2022/04/card.jpg) were inspected directly. Every printed quantity agrees with the unchanged [source-deck JSON](../src/data/catalog-decks.json). Each source launcher offers its exact original 40 cards. The account editor locks all 15 signature copies, excludes identity faces from customizable card choices, and accepts ordinary single-aspect 40–50-card decks. All four supported app starter aspects retain the same exact signature quantities.

## Ironheart progressing identities and printed stats

The [original Ironheart insert](https://hallofheroeslcg.com/wp-content/uploads/2022/04/insert.jpg) says there are three identity cards in total. During setup the weakest identity enters play and the other two are set aside. Swapping identities preserves the single hit point dial and all game elements on or attached to the former identity, including counters, status cards, player cards and encounter cards. Defeating one version defeats all versions and eliminates that player. The identity swap is separate from an ordinary hero/alter-ego form change.

| Original face                | ATK | THW | DEF |  HP | Hero hand | Hero traits                 |
| ---------------------------- | --: | --: | --: | --: | --------: | --------------------------- |
| Nova `28001a`                |   1 |   1 |   2 |  10 |         5 | Champion                    |
| Ironheart Version 1 `29001a` |   2 |   1 |   3 |  10 |         4 | Champion; Version 1         |
| Ironheart Version 2 `29002a` |   2 |   2 |   3 |  10 |         5 | Aerial; Champion; Version 2 |
| Ironheart Version 3 `29003a` |   2 |   3 |   3 |  10 |         6 | Aerial; Champion; Version 3 |

Sam Alexander and all three Riri Williams faces have printed REC3 and alter-ego hand6. Child Prodigy spends a Mental resource on Version 1; a Mental resource or two resources of any type on Version 2; and one resource of any type on Version 3. Each carries its printed once-per-round limit. The Version 1 Level Up action removes six progress counters, readies the identity and swaps to Version 2. The Version 2 action also grants a Tough status card before swapping to Version 3. Maximum Efficiency removes one progress counter to deal two damage to an enemy; it has no printed per-round or per-phase limit.

Original gallery faces were inspected alongside the insert: [Version 1 hero](https://hallofheroeslcg.com/wp-content/uploads/2022/05/i0d.jpg), [Version 2 hero](https://hallofheroeslcg.com/wp-content/uploads/2022/05/i0e.jpg), [Version 3 hero](https://hallofheroeslcg.com/wp-content/uploads/2022/05/i0f.jpg), [Version 1 alter ego](https://hallofheroeslcg.com/wp-content/uploads/2022/05/i0a.jpg) and [Version 2 alter ego](https://hallofheroeslcg.com/wp-content/uploads/2022/05/i0b.jpg). No numeric-stat overlay changes those identity numbers.

## Confirmed printed metadata corrections

Two downloaded metadata defects affect Ironheart identity legality. The original Version 1 hero visibly has a unique diamond, while downloaded `29001a.is_unique` is false. The original Basic Ironheart ally `13018` visibly has subtitle **Riri Williams**, while the downloaded ally lacks that subtitle. The [original Wasp-pack ally scan](https://hallofheroeslcg.com/wp-content/uploads/2020/12/a8.jpg) confirms the latter directly.

The targeted printed-metadata adapter corrects `29001a.is_unique` to true and `13018.subname` to `Riri Williams`. It preserves the downloaded catalog bytes, card codes, printed numeric stats and rules text. The same verified fields must reach identity matching and deck validation, so that the editor and runtime agree. An Ironheart deck cannot include the matching Riri Williams Ironheart ally. Nova likewise cannot include the matching Sam Alexander Nova ally `05012`.

Secondary-title uniqueness continues to distinguish Falcon/Joaquin Torres `29015` from Falcon/Sam Wilson `03011` and `23014`; they are different unique characters. Wasp/Nadia Van Dyne `29034` matches the Nadia Van Dyne identity and the same-subtitle signature ally `12002`, but differs from Wasp/Janet Van Dyne `13012`. Agent 13/Sharon Carter `29022` and its Sinister Motives printing `27046` share one unique deck limit. These checks use the complete identity across its faces, regardless of the active version or form.

## Core and inherited printing equivalences

All six pairs below match **16 complete printed rule/stat fields**: name, type, faction, cost, traits, text, all four resource-icon fields, ATK, THW, DEF, HP, deck limit and uniqueness. Physical card codes, IDs, pack provenance and retail quantities remain distinct.

| Physical printing               | Existing rules source    | Ownership                |
| ------------------------------- | ------------------------ | ------------------------ |
| Chase Them Down `28011`         | Core `01052`             | Core equivalent          |
| The Power of Aggression `28015` | Core `01055`             | Core equivalent          |
| The Power of Leadership `29021` | Core `01072`             | Core equivalent          |
| Helicarrier `29026`             | Core `01092`             | Core equivalent          |
| Morale Boost `29019`            | Ms. Marvel `05032`       | Inherited non-Core rules |
| Agent 13 `29022`                | Sinister Motives `27046` | Inherited non-Core rules |

There are 30 physical player-pool faces: 13 Nova printings and 17 Ironheart printings. Four use exact Core equivalence. The remaining 26 require dedicated physical registration, including native ownership for both inherited non-Core printings. The two heroes contribute 36 identity/signature/obligation/nemesis faces. The release measurement must distinguish native dedicated registration from mechanically equivalent Core behavior and must never replace the actual retail printing or run a provider twice.

## Separate obligations and nemeses

Nova's obligation is Weight of the World `28021`. The five separate nemesis cards are "Bring the War!" `28022` ×1, Warbringer `28023` ×1, War Delivery `28024` ×2 and "The War's Been Brought" `28025` ×1. Ironheart's obligation is A Minor Setback `29028`. Her five separate nemesis cards are Rule by Force `29029` ×1, Lucia von Bardas `29030` ×1, Cyborg Tech `29031` ×1 and Political Retribution `29032` ×2. These encounter pieces never change either original 40-card player deck.

## Verification boundary

Vivian's printed Hero Response chooses an actual **attachment card**, **non-Elite minion** or **non-Permanent side scheme**. A player upgrade does not become an attachment card merely because it occupies an attachment zone. Elite is a printed trait; Permanent side schemes remain ineligible. The response blanks that physical card's printed text until the end of the round, preserving traits and numeric stats/icons outside the text box. Text effects such as Guard, granted Retaliate, defeat replacements and continuous hit-point bonuses are suppressed and resume when the effect expires. Printed attachment ATK modifiers remain, and removing/restoring a continuous hit-point bonus preserves existing damage.

`tests/vivian-text-blanking.test.ts` independently exercises actual original-source Vivian PLAY, PAY and entry choices, with JSON reload before each command and all original owned physical IDs retained. It covers legal target exclusions and the installed Core/Goblin text interactions, including inherited module compatibility. Its negative Permanent-scheme target does not run or register that scheme's scenario. These controls and compatibility fixes do not add faces to the 66-face hero-pack scope or claim new scenario/campaign automation.

`tests/nova-ironheart-metadata-decks.test.ts` is the independent source, metadata, editor and setup acceptance suite. It covers original quantities, canonical aliases, all four ordinary aspects, signature and single-aspect enforcement, source launch readiness, actual source ID conservation, Ironheart's three physical identity cards, all six 16-field equivalences, the two verified printed metadata corrections, matching versus differently subtitled allies and shared printing limits. Its raw catalog/deck hash assertions preserve the downloaded sources while exercising the playable adapters.

The read-only source comparison is `output/nova-ironheart-static-source-check.json`. The original scans inspected for this review are saved in `output/nova-ironheart-original-source/`. After root registration and native setup, the independent metadata/source/editor suite passes **28 tests in one file** (`output/nova-ironheart-metadata-final.log`). It verifies the exact 66 scoped executable faces, all four equivalent Core printings, all eight legal aspect starters, both original 40-card source launches, the original metadata corrections and 48 distinct Ironheart setup IDs: 40 source cards, three physical identities and five separate set-aside nemesis cards. Nova's Worldmind constant does not change the printed six-card setup draw or setup hand-size display; it becomes active for ordinary hand-size checks after setup, matching RRG 1.8's setup ability restriction.

This metadata evidence is separate from native timing, the whole regression, production build, browser validation, GitHub CI and deployment. The completed frozen local release gates are recorded in [the engine coverage report](engine-expansion-coverage.md#nova-and-ironheart-frozen-local-release--2026-10-08); publication is checked separately.
