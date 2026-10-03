# Automated engine expansion coverage

The collection contains all 4,551 imported card faces from 63 released products, with 69 hero identities and 69 published starter lists. Importing a card gives it text, artwork and product provenance. Automated play additionally requires executable effects, legal costs and targets, timing windows, setup rules and scenario transitions. This document does not certify perfect play of the imported collection.

Run `node scripts/audit-engine-expansion.mjs` to regenerate [the machine-readable inventory](engine-expansion-inventory.json). It records every face exactly once, its timing labels, keywords, required mechanics, ability fingerprints, conservative reprint groups, hero starter dependencies and scenario-set membership. Source SHA-256 hashes identify the exact data and engine snapshot. Lexical matches are triage clues, never a substitute for executable rules or tests. Printed-text triage retains the immutable import, while compiler recognition uses the corrected runtime database. `runtimeRuleCorrections` records those differences and their rule references; source hashes include both new Hero Pack modules, the errata overlay and their host adapters.

## Baseline and executable scripts

The pre-expansion engine has 209 Core card faces, five identities, three scenarios and five modular sets. Those entries remain identified as `native_core_baseline`; that label includes the documented limitations in [rules-coverage.md](rules-coverage.md). It does not mean that every interaction with a new expansion card is already valid.

The new declarative registry in `src/game/scripts/` compiles complete, bounded rules into typed programs, modifiers, costs, form requirements and triggers. Its `supported` result means the whole card matched an authored rule or a mechanically equivalent Core printing. An unmatched operative clause must yield `unsupported` with a reason. A script still needs its engine adapter and integration tests before a deck can be offered for automated play. Card support and complete hero/scenario support are separate assertions.

The audit's `imported_requires_implementation` field describes membership outside the original Core baseline. It intentionally stays separate from the live registry's support status, so an audit regex cannot silently enable a card. The audit currently finds 5,608 normalized ability blocks, 3,988 distinct rules texts and 4,180 conservative mechanical fingerprints. These are text/data counts, not counts of successfully implemented abilities.

The generated `compilerCoverage` snapshot currently recognizes 432 Core-equivalent faces and 63 declarative faces; 4,056 faces remain unsupported by that compiler. Each face retains its rule or unsupported reason. Dedicated hero/scenario modules are separate from this compiler snapshot. Hero dependency records include nemeses and use `compiledCardClosure` only as an inventory check; whole-game certification additionally requires the dedicated rules and their engine integration evidence.

The separate `installedRegistryCoverage` runs the live `hasExecutableScript` predicate, including dedicated modules: **703 executable registrations and 3,848 unsupported faces**, with 221 faces in dedicated modules. It records 11 registered identities (the five Core identities, Captain America, Hulk, Ms. Marvel, Thor, Black Widow and Doctor Strange) and five registered scenarios (Rhino, Klaw, Ultron, Mutagen Formula and Risky Business). There is **no automated campaign support**. This registration snapshot must not be reported as completion of the 69-hero collection or perfect rules coverage. Every chosen deck and modular set still needs dependency closure; native mission tests establish only the behavior they actually exercise.

Product records separately show exact imported face counts, executable registration counts and unsupported codes. The Green Goblin retail product has 57 faces registered across both scenarios and its four modular sets; reverse faces count separately from physical cards. Black Widow registers all 34 imported faces and Doctor Strange all 40. Their exact 40-card source precons validate; the latter adds five separately modeled Invocation cards. Product registration closure remains distinct from rule/interaction certification. The [Hero Pack native integration contract](engine-hero-pack-integration.md) records their timing, costs, special zones and verification boundary. The [Risky Business and Goblin modular integration contract](risky-business-integration.md) records native evidence, current Core/Goblin When Revealed ordering and the boundaries of that scheduler.

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

Several existing assumptions require explicit migration: one `GameState.villain`, one `GameState.scheme`, two identity forms, one anonymous `Piece.counters`, three-player maximum, four selectable aspects and individually hardcoded resource generators. Imported fields such as `cost_per_hero`, `health_per_group`, `scheme_amplify`, star annotations, `deck_options`, `deck_requirements` and `permanent` must be interpreted or rejected explicitly, rather than defaulting to zero.

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

The current registry and keyword adapters implement bounded parts of this list. Doctor Strange now implements its Invocation lifecycle, including actual card IDs, separate discard/reset, a visible top card and hidden-information boundaries; that does not implement the other auxiliary-deck families. A complete closure requires all dependent rules, rather than a successful isolated test of the hero's basic attack.

## Rules and external implementation review

Use [FFG Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), the [official update notes](https://www.fantasyflightgames.com/mission-updates/) and each product's rulesheet/rulebook from the [official support index](https://www.fantasyflightgames.com/product/marvel-champions-the-card-game/) as the primary rules sources. Important expansion regression cases include status priority, same-timing keyword/ability ordering, post-reveal Quickstrike, queued Surge, piercing before damage, overkill after defeat, and restrictions checked before payment. Special decks and campaign modes need their product rules, not an inference from card text.

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


## Pending Rise of Red Skull hero implementation — 2026-10-03

Hawkeye and Spider-Woman have separate authored native modules and standalone module fixtures, with intended ownership of 31 and 28 faces. Neither module is connected to the installed dispatcher or enabled hero registry; declarations do not increase live support.

The final run before publication reported 1,902 passing tests, 58 failing native acceptance tests and one skipped. The two native suites failed before gameplay could be verified: the identities are unavailable, Hawkeye's source deck is rejected, and Spider-Woman's colored signature cards need correct deck-equality accounting. The unfinished acceptance fixtures are retained as tests/hawkeye-engine.pending.ts and tests/spider-woman-engine.pending.ts, separate from implemented-feature suites. Their names do not certify the unfinished rules or erase the recorded failed run.

The compiler now refuses to treat a hand-play-only response as an arbitrary entrance. This removes premature registrations 04040, 13018 and 56011. Their hand-play adapters remain outstanding. Current installed coverage is 703 faces, 11 heroes, five scenarios and no campaigns.

Publication was requested without additional tests. The production build verifies compilation and packaging only. Pending heroes and the complete imported catalog are not certified as fully scripted.
