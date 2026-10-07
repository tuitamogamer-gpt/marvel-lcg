# Automated engine expansion coverage

The collection contains all 4,551 imported card faces from 63 released products, with 69 hero identities and 69 published starter lists. Importing a card gives it text, artwork and product provenance. Automated play additionally requires executable effects, legal costs and targets, timing windows, setup rules and scenario transitions. This document does not certify perfect play of the imported collection.

Run `node scripts/audit-engine-expansion.mjs` to regenerate [the machine-readable inventory](engine-expansion-inventory.json). It records every face exactly once, its timing labels, keywords, required mechanics, ability fingerprints, conservative reprint groups, hero starter dependencies and scenario-set membership. Source SHA-256 hashes identify the exact data and engine snapshot. Lexical matches are triage clues, never a substitute for executable rules or tests. Printed-text triage retains the immutable import, while compiler recognition uses the corrected runtime database. `runtimeRuleCorrections` records those differences and their rule references; source hashes include the native Hero Pack modules, the errata overlay and their host adapters.

## Baseline and executable scripts

The pre-expansion engine has 209 Core card faces, five identities, three scenarios and five modular sets. Those entries remain identified as `native_core_baseline`; that label includes the documented limitations in [rules-coverage.md](rules-coverage.md). It does not mean that every interaction with a new expansion card is already valid.

The new declarative registry in `src/game/scripts/` compiles complete, bounded rules into typed programs, modifiers, costs, form requirements and triggers. Its `supported` result means the whole card matched an authored rule or a mechanically equivalent Core printing. An unmatched operative clause must yield `unsupported` with a reason. A script still needs its engine adapter and integration tests before a deck can be offered for automated play. Card support and complete hero/scenario support are separate assertions.

The audit's `imported_requires_implementation` field describes membership outside the original Core baseline. It intentionally stays separate from the live registry's support status, so an audit regex cannot silently enable a card. The audit currently finds 5,608 normalized ability blocks, 3,988 distinct rules texts and 4,180 conservative mechanical fingerprints. These are text/data counts, not counts of successfully implemented abilities.

The generated `compilerCoverage` snapshot currently recognizes 432 Core-equivalent faces and 63 declarative faces; 4,056 faces remain unsupported by that compiler. Each face retains its rule or unsupported reason. Dedicated hero/scenario modules are separate from this compiler snapshot. Hero dependency records include nemeses and use `compiledCardClosure` only as an inventory check; whole-game certification additionally requires the dedicated rules and their engine integration evidence.

The separate `installedRegistryCoverage` runs the live `hasExecutableScript` predicate, including dedicated modules: **910 executable registrations and 3,641 unsupported faces**, with 431 faces in dedicated modules. Groot, Rocket Raccoon and their shared player pool add 49 dedicated registrations to the previous local snapshot. It records 19 registered identities (the five Core identities, Captain America, Hulk, Ms. Marvel, Thor, Black Widow, Doctor Strange, Hawkeye, Spider-Woman, Ant-Man, Wasp, Quicksilver, Scarlet Witch, Groot and Rocket Raccoon) and five registered scenarios (Rhino, Klaw, Ultron, Mutagen Formula and Risky Business); 50 imported identities remain pending. There is **no automated campaign support**. This local registration snapshot must not be reported as completion of the 69-hero collection, perfect rules coverage or verification of a remote deployment. Every chosen deck and modular set still needs dependency closure; native mission tests establish only the behavior they actually exercise.

Product records separately show exact imported face counts, executable registration counts and unsupported codes. The Green Goblin retail product has 57 faces registered across both scenarios and its four modular sets; reverse faces count separately from physical cards. Black Widow registers all 34 imported faces and Doctor Strange all 40. Their exact 40-card source precons validate; the latter adds five separately modeled Invocation cards. Ant-Man registers **35 of 35 retail faces**, comprising 31 dedicated faces and four exact Core reprints, with Scott Lang, Tiny and Giant identity forms and the exact 40-card Leadership source deck. Wasp registers **36 of 36 retail faces**, comprising 31 dedicated faces, four Core reprints and compiled Boot Camp, with Nadia, Tiny and Giant forms and the exact 40-card Aggression source deck. Quicksilver registers **33 of 33 retail faces**, comprising 29 dedicated faces and four Core reprints, with Pietro Maximoff, optional Super Speed readying once per phase, and the exact 40-card Protection source deck. Scarlet Witch registers **32 of 32 retail faces**, comprising 27 dedicated faces and five exact Core reprints, with Wanda Maximoff, Chaos Control and the exact 40-card Justice source deck. The Galaxy's Most Wanted registers all **59 hero, player-card, obligation and nemesis faces** through card 16057: 49 dedicated faces and ten exact Core reprints. Its product record has **60 of 207** executable faces because the separate card 16079 was already Core-equivalent. The remaining 147 faces, five boxed scenarios and campaign are pending; this is partial box support. Groot uses his exact 40-card Protection source deck, and Rocket Raccoon his exact 40-card Aggression source deck. Product registration closure remains distinct from rule/interaction certification. The [Hero Pack native integration contract](engine-hero-pack-integration.md), [Ant-Man native integration contract](ant-man-integration.md), [Wasp native integration contract](wasp-integration.md), [Quicksilver native integration contract](quicksilver-integration.md), [Scarlet Witch native integration contract](scarlet-witch-integration.md) and [Groot and Rocket native integration contract](gmw-heroes-integration.md) record timing, costs, special zones and verification boundaries. The [Risky Business and Goblin modular integration contract](risky-business-integration.md) records native evidence, current Core/Goblin When Revealed ordering and the boundaries of that scheduler.

Hero and scenario records retain both compiler closure and installed-registry closure. A dedicated hero can be installed while its printed text remains unsupported by the bounded compiler. Scenario-set closure alone is insufficient: setup, Standard/Expert/modular sets, obligations, nemeses, special zones and victory/advancement rules all belong to the full dependency graph. The [Mutagen Formula integration contract](mutagen-formula-integration.md) documents those native hooks and its explicit verification boundary.

## Narrow patterns and larger dependencies

Nine intentionally strict text families find only 49 candidate faces. Each candidate consumes the entire normalized rules text, including every operative qualifier. Optional responses remain optional; a self-entrance response must name the actual ally, rather than any character entering play.

| Candidate family            | Faces | Distinct rules texts |
| --------------------------- | ----: | -------------------: |
| Fixed attack event          |     8 |                    5 |
| Fixed thwart event          |     3 |                    3 |
| Fixed healing event         |     3 |                    1 |
| Ready event                 |     2 |                    1 |
| Simple ally self-entrance   |     7 |                    5 |
| Fixed identity stat upgrade |    20 |                    7 |
| Fixed ally-health support   |     2 |                    1 |
| Keyword-only ally           |     4 |                    3 |

The zero-result draw family is retained in the script so the inventory exposes its boundary. More useful patterns can be implemented, but partial interpretation is unsafe. For example, reading only the damage sentence of an event would miss its payment restriction, extra attack, delayed effect or response window. Spider-Woman `52033` responds to any qualifying Web-Warrior ally entering play; it must never be compiled as a self-only entrance response.

Counts below include overlapping lexical references across all printings. They identify where shared primitives have the greatest reach; they do not promise that one primitive implements every matching card.

| Required area           | Faces mentioning it | Required shared implementation                                                                 |
| ----------------------- | ------------------: | ---------------------------------------------------------------------------------------------- |
| Attack/damage           |               1,903 | Explicit source, attacker and target contexts; actual damage, defeat and excess-damage results |
| Conditional effects     |               1,570 | Conditions, `then` dependencies and rechecking changed state                                   |
| Continuous modifiers    |               1,183 | Derived stats, traits, keywords, limits, restrictions and durations                            |
| Responses               |                 978 | Forced and optional windows, ordering, passing and nested triggers                             |
| Interrupt/replacement   |                 841 | Pending event context, replacement priority and cancel/replacement restart                     |
| Typed payments          |                 658 | Payment origins, typed costs, generated resources and collective payment                       |
| Named counters          |                 509 | Counter maps on identities and every card instance, transfers and caps                         |
| Victory rules           |                 169 | Global victory display, queryable contents and removal/persistence                             |
| Tucked/under-card zones |                  74 | Owner, face, visibility and play-from-zone permissions                                         |
| Auxiliary decks         |                  45 | Named ordered zones with deck-specific setup and recycling                                     |

The imported schema additionally contains 108 environment faces, 39 player side-scheme faces, 24 leader faces and nine evidence faces. They need explicit game zones and lifecycle rules. Ordinary player/encounter card handling cannot stand in for those card types.

## Required architecture

The existing effect queue and prompts provide a useful execution substrate. They do not yet provide a complete general timing system. The expansion implementation needs these shared components, in dependency order:

1. **Rules values and card instances.** Model printed variable/star statistics, per-player and per-group scaling, named counters, counted statuses, owner and controller, face orientation and linked identity/form cards. Preserve all relevant information through saves, reloads and zone transitions. Ignore printing quantity when identifying a reprint, but retain every mechanical field and context that affects legality.
2. **Typed event contexts.** Carry initiating source, actor, original/current target, paid resources, card origin, actual damage/threat moved, basic/labeled action identity, defeat results and last-known information. Costs are atomic. The optional decision to use an ability precedes payment; payment never substitutes for a missing legal target.
3. **Timing scheduler.** Represent pending game events and their forced/optional interrupts and responses. Resolve applicable ordering choices explicitly, then re-evaluate legality after each state change. Delayed abilities and limits need instance-aware duration/reset scopes. Keywords and statuses use the same event system as card abilities.
4. **Derived-state layer.** Compute statistics, traits, keywords, immunities, hand size, ally/restricted limits and legal targets from all active continuous effects. Temporary changes belong to their event or duration. A printed keyword lookup alone cannot represent granted, removed or conditional keywords.
5. **General zones.** Add set-aside, victory, environment, auxiliary decks and cards-under zones with visibility and owner routing. Generalize attachments and play-as-hand permissions. A card leaving play resets its instance state except where a particular rule explicitly preserves it.
6. **Scenario and campaign definitions.** Define setup, mandatory/optional modular sets, special assets, villain/main-scheme stage graphs, custom win/loss checks and multiplayer routing as authored data. Campaign rules need versioned logs, deck changes, rewards, loss consequences and scenario transitions. The card JSON does not encode the rulebooks or campaign logs.
7. **Dependency closure and proof.** A playable hero requires its identity forms, setup cards, complete chosen deck, obligations, nemeses, special decks and all associated rules. A playable scenario requires its entire setup and encounter dependency graph. Tests must exercise those complete paths, including save/reload during choices and interrupted resolution.

Several existing assumptions require explicit migration: one `GameState.villain`, one `GameState.scheme`, identity progression beyond the authored Ant-Man and Wasp three-form adapters, one anonymous `Piece.counters`, three-player maximum, four selectable aspects and individually hardcoded resource generators. Imported fields such as `cost_per_hero`, `health_per_group`, `scheme_amplify`, star annotations, `deck_options`, `deck_requirements` and `permanent` must be interpreted or rejected explicitly, rather than defaulting to zero.

## High-risk fixtures

Use these concrete cards and products to verify the shared architecture before enabling their complete content:

| Fixture                                                         | Rules that must be represented                                                                     |
| --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Ant-Man/Wasp and Ironheart                                      | More than two identity faces; voluntary form changes vs swaps and version progression              |
| SP//dr `31001`/`31002`                                          | Two separate identity cards, pilot/suit state, linked support/upgrade faces and interface payments |
| Vision `26002`/`26002b`, Shadowcat and Phoenix                  | Persistent linked form upgrades; form-specific derived powers and mandatory transitions            |
| Colossus `32001a`, Luke Cage `62001b`                           | Multiple tough cards, maximum status-card counts and removal of piercing                           |
| Groot, Drax, War Machine, Gambit and Spider-Ham                 | Identity counters, damage prevention/replacement and counters spent as resources                   |
| Storm, Hercules and Daredevil                                   | Weather, Labor/Gift and Sense decks; distinct top-card/return/recycling rules                      |
| Silk, Echo and Wonder Man                                       | Tucked encounter/player cards, owner-safe discard and play from under-card zones                   |
| Gamora, Adam Warlock, Cyclops, Cable, Maria Hill and Wonder Man | Hero-specific cross-aspect deck construction and copy/equality restrictions                        |
| Cable and player side schemes                                   | Player-owned scheme costs/limits, thwarting, defeat and victory display                            |
| Wrecking Crew, Kang and Sinister Six                            | Several villains, active-villain routing and isolated/parallel player scenario areas               |
| Hela, Loki and alternate villain forms                          | Scenario-specific defeat and progression instead of generic Core stage advancement                 |
| Civil War and Trickster Takeover                                | Leaders/teams and per-group values; bespoke scenario setup and victory logic                       |
| Fear No Evil and Jessica Jones                                  | Evidence card types/decks, cases, evidence counters and investigation state                        |
| Every campaign expansion                                        | Authored campaign log and scenario transition rules, including failure and deck persistence        |

The current registry and keyword adapters implement bounded parts of this list. Ant-Man and Wasp now have authored three-form identity adapters with voluntary and effect-driven changes, optional form responses and saved choices; Wasp also has simultaneous basic-power target allocation. Ironheart's identity progression remains pending. Doctor Strange implements its Invocation lifecycle, including actual card IDs, separate discard/reset, a visible top card and hidden-information boundaries; that does not implement the other auxiliary-deck families. A complete closure requires all dependent rules, rather than a successful isolated test of the hero's basic attack.

## Rules and external implementation review

Use [FFG Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/08/mc_rulesreference_v18_compressed-1.pdf), the [official update notes](https://www.fantasyflightgames.com/mission-updates/) and each product's rulesheet/rulebook from the [official support index](https://www.fantasyflightgames.com/product/marvel-champions-the-card-game/) as the primary rules sources. Important expansion regression cases include status priority, same-timing keyword/ability ordering, post-reveal Quickstrike, queued Surge, piercing before damage, overkill after defeat, and restrictions checked before payment. Special decks and campaign modes need their product rules, not an inference from card text.

No external engine code was copied or executed during this audit.

| Candidate inspected on 2026-09-30                                                                                                           | License evidence                                                                                                                                                                                                                         | Coverage evidence and reuse conclusion                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [frwololo/warnel-chawpiovs](https://github.com/frwololo/warnel-chawpiovs/tree/080bad24288936248dea2f228450f5c463dbebb4)                     | [Pinned README declares AGPL3](https://github.com/frwololo/warnel-chawpiovs/blob/080bad24288936248dea2f228450f5c463dbebb4/README.md#license). GitHub's detected-license field is null; the only separate license file is a font license. | Author reports 46 heroes/38 villains and about 55% of official cards, with no campaign mode. Parallel player turns and fixed minion ordering intentionally differ from printed rules. AGPL obligations and dependencies require deliberate review before any code incorporation. It cannot supply complete/perfect coverage. |
| [irefrixs/marvel-lcg](https://github.com/irefrixs/marvel-lcg/tree/2ac194abcba0d0a396716e4aeda5b76b233453a8)                                 | No license grant in the README or LICENSE/COPYING/COPYRIGHT path in its 4,814-file tree.                                                                                                                                                 | Contains Python card scripts and an engine, but public availability does not establish permission to reuse them. Complete validated release coverage was not demonstrated. Do not copy code without a license grant.                                                                                                         |
| [Ouroboros009/OCTGN-Marvel-Champions](https://github.com/Ouroboros009/OCTGN-Marvel-Champions/tree/21d3d6f797a74d4992b44a0cd95e84cc822208ed) | No license grant located in its README or 627-file tree.                                                                                                                                                                                 | The plugin supplies setup/table operations and card data. An exhaustive card-rules engine was not established. Card data provenance and implementation-code licensing are separate concerns.                                                                                                                                 |
| [hone/dragncards-mc-plugin](https://github.com/hone/dragncards-mc-plugin/tree/11c6ee54909e01910434dfa1cd890524b760843e)                     | No license grant in Cargo.toml or LICENSE/COPYING/COPYRIGHT path in its 162-file tree.                                                                                                                                                   | Table/plugin automation and data ingestion are useful research references; fully enforced gameplay was not established. Do not copy unlicensed implementation code.                                                                                                                                                          |

These findings are pinned observations, not a general assertion that the projects have no permissions elsewhere. Recheck their licensing if reuse is proposed later.

## Validation gate

The inventory tests verify complete face coverage, starter/identity dependency linkage, negative parser cases, conservative reprint discrimination and detection of concrete hard mechanics. The script registry's separate tests prove its recognized programs and unsupported fallback. Integration tests must then demonstrate payment, targets, ownership, forms, keyword effects and timing through the actual engine.

Record supported scripts, enabled complete heroes/scenarios and campaign support separately. Unknown or partially interpreted rules must remain visible and unavailable for automated play. A passing catalog/build/smoke suite proves import or runtime health; it does not prove the complete Marvel rules corpus.

## Rise of Red Skull draft checkpoint — 2026-10-03

At this checkpoint, Hawkeye and Spider-Woman had separate authored native modules and standalone module fixtures, with intended ownership of 31 and 28 faces. Neither module was connected to the installed dispatcher or enabled hero registry.

The final run before publication reported 1,902 passing tests, 58 failing native acceptance tests and one skipped. The identities were unavailable, Hawkeye's source deck was rejected, and Spider-Woman's colored signature cards needed correct deck-equality accounting. The unfinished acceptance fixtures were retained as pending files; [the saved checkpoint](seven-hour-imports-2026-10-02.md) preserves the failed run and its scope.

The compiler correction refused to treat a hand-play-only response as an arbitrary entrance, removing premature registrations 04040, 13018 and 56011. That checkpoint had 703 installed faces, 11 heroes, five scenarios and no campaigns.

Publication was requested without additional tests. The production build verifies compilation and packaging only. Pending heroes and the complete imported catalog are not certified as fully scripted.

## Installed Rise of Red Skull heroes — 2026-10-05

Hawkeye and Spider-Woman now have installed native adapters, exact source decks, origin-aware ally triggers, Quiver play/inspection and two-aspect deck accounting. Their active native test suites replace the pending files. The live counts at the top of this document include both heroes; 04040 has its native hand-play adapter, while 13018 and 56011 remain unsupported. [The native integration contract](rise-of-red-skull-heroes-integration.md) records timing, ownership, tests and browser evidence. Further boxed scenarios and campaigns remain outstanding; this continuation is local.

## Installed Ant-Man — 2026-10-07

Ant-Man now has native Scott Lang, Tiny and Giant forms, all 35 retail faces and his exact 40-card Leadership source list. The native acceptance suite exercises actual engine commands, optional response ordering, payments, nemeses and JSON reloads, including exact physical-card conservation and stacked form statistics. `npm run test:ant-man` runs the browser checks against the configured local server. The [integration contract](ant-man-integration.md) records current verification results and limits. This continuation does not implement Wasp's Hero Pack, additional scenarios or campaigns, and does not establish remote publication.


## Installed Wasp — 2026-10-07

Wasp now has native Nadia, Tiny and Giant forms, all 36 retail faces and her exact 40-card Aggression source list. Giant powers and split signature events resolve against a legal target snapshot with simultaneous damage/threat removal and native per-target aftermath. The native acceptance and independent review suites exercise identity attribution, physical resources, saved choices, nemesis errata, status priority and teammate timing. `npm run test:wasp` exercises the actual browser controls. The [integration contract](wasp-integration.md) records verification and remaining scope. This checkpoint preceded the Quicksilver integration below; additional boxed scenarios and campaigns remain pending.


## Installed Quicksilver — 2026-10-07

Quicksilver now has native Pietro Maximoff and hero faces, all 33 retail faces and his exact 40-card Protection source list. Optional Super Speed and Friction Resistance responses preserve per-phase timing and shared ready restrictions; signature powers, Scarlet Witch, source-deck allies, defense events and nemesis effects use native payment, target and encounter windows. `npm run test:quicksilver` exercises the browser controls, and the [integration contract](quicksilver-integration.md) records the verified scope. This checkpoint preceded the Scarlet Witch integration below; additional boxed scenarios and campaigns remain pending.


## Installed Scarlet Witch — 2026-10-07

Scarlet Witch now has native Wanda Maximoff and hero faces, all 32 retail faces and her exact 40-card Justice source list. Chaos Control, the Crest and signature spells use boost counts and the physical encounter deck; allies, Justice responses, obligations and nemesis effects resolve through native timing and choice windows. `npm run test:scarlet-witch` exercises the browser controls, and the [integration contract](scarlet-witch-integration.md) records the verified scope. This checkpoint preceded the Groot and Rocket Raccoon integration below; additional boxed scenarios and campaigns remain pending.


## Installed Groot and Rocket Raccoon — 2026-10-07

The two heroes from The Galaxy's Most Wanted (2 April 2021) have native identity faces, growth and charge counters, signature cards, the shared Protection/Aggression/Basic player pool, obligations and nemeses. Their exact 40-card Protection and Aggression source lists retain the original GMW printing IDs. All 59 faces through card 16057 are registered; Drang begins the separate scenario pool at 16058. `npm run test:gmw-heroes` exercises browser controls, and the [integration contract](gmw-heroes-integration.md) records the verified scope. The source-deck mission matrix contains 1,260 configurations across the fourteen installed expansion identities, five scenarios, both difficulties and nine modular sets. The five GMW scenarios, modular encounter sets, market and campaign progression remain pending. The next chronological Hero Packs are Star-Lord and Gamora, both released on 14 May 2021.
