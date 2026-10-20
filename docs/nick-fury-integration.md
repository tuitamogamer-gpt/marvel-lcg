# Nick Fury native integration

The Nick Fury source boundary is `50034a/b`, `50035a/b`, and `50036`–`50063`: 32 faces. Nick receives one of the two retail `50024` Super Spies copies; its sole native implementation lives in `nick-fury.ts`. The imported Justice composition has 41 physical cards: exactly 40 shuffled playing cards and one linked Permanent suit, extracted by physical ID at setup and initially Assault. Identity, obligation, and the five set-aside nemesis cards bring Nick's assigned physical count to 48. Catalog JSON, composition, and original scans are unchanged.

Sources: [official Agents of S.H.I.E.L.D. rulebook](https://images-cdn.fantasyflightgames.com/filer_public/79/12/7912adc3-2461-4ea2-8606-4715880b8d1d/mc50_rulebook-web.pdf), original card scans, [official FFG rulings, January 24, 2025, #67](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/), and the current Rules Reference. The rulebook's suit-form and counter rules are on pages 3–4; its Nick Fury FAQ is on page 19.

## Runtime state and interfaces

- The same suit Piece changes `code` between `50035a` and `50035b`. `counters` stores **threat**, never Uses. Exhaustion, owner, physical ID and threat remain intact across form changes and reload.
- `nickAllPurposeCounters` stores inert all-purpose counters placed on a suit. `nickThreatTokens` stores inert threat placed on a support. Super Spies literally permits either token type on either eligible zone; an all-purpose counter adopts a support's defined counter type, and threat never becomes a counter. The receiving support's actual counter store remains `counters`. These cross-type placements are based on the printed text and rulebook, not a card-specific FFG ruling.
- AE identity action: `infiltrate`. Basic-thwart response: `gather-intel`. Assault's optional payment chooser uses `0`–`3`. Safe House, Flying Car and Leo Fitz actions are exposed through the common native ability interfaces.
- `Prompt.nickWatchSelections` persists each physical Watch's chosen generation (one or two mental resources). Payment restores the same pending card, source IDs and resource allocations, and commits exhaustion plus that amount of actual suit threat only after final validation.
- `MutagenActivation.nickStealthSuit` and the matching scheme receipt retain the actual suit ID. Stunned replaces the original attack first; Stealth then changes an enemy attack into a scheme. The placement packet diverts one positive threat while the suit has at most five. The same split applies before Informant's remaining activation removes threat. Serve and Protect can prevent the main-scheme remainder, not the already diverted suit threat.

## Effects and timing

All signatures, new Justice/Basic cards, obligation, nemesis and Super Spies execute through native effect programs. Assault uses a receipt per attack program, paying once for a multi-target Spray Fire and increasing each damage packet. Zero is a real allocation. Break Cover resolves before Assault; form-change reactions remain queued ahead of the attack continuation. Flying Car's Aerial lasts through the current round.

Preparation costs move the original card to its owner's discard before Practiced Plan can return it. Preparation effects then finish before Secret Agent/Black Widow after-Preparation reactions. A Stunned attack replacement does not count as resolving a Preparation ability. The same lifecycle covers legacy Black Widow Preparations and ordinary controlled-Preparation discards. Intelligence's dealt-card response precedes queued encounter reveals and swaps physical cards while retaining dealt recipients.

Orion's Tough allowance is a transient native status modifier; only finite status counts are serialized. Acquire the Infinity Formula finds the actual reserved/deck/discard/dealt/resolving Orion rather than manufacturing a replacement. Leviathan Soldier's forced damage follows a completed scheme even at printed zero SCH. Native text blanking, Merc with the Mouth, status replacement, defense restrictions, ownership and normal attack/thwart legality remain in the host paths.

Five reprints use their established native handlers while retaining actual printing codes: `50047`→`08011`, `50048`→`08012`, `50049`→`27043`, `50053`→`06031`, and `50057`→`27055`. Under Surveillance also shares attachment, uniqueness, threshold and scheme-advance cleanup. Printed SHIELD trait comparison normalizes one trailing separator period and preserves the internal periods.

## Verification and merge points

`nick-fury-engine.test.ts` covers real PLAY/PAY/BASIC/ABILITY commands, setup, suit identity, attack and activation timing, all new Preparation windows, source-printing aliases, co-op targets/owners, inert token controls and reloads. `nick-fury-source-contract.test.ts` freezes the exact source composition, 32-face boundary, shared-copy allocation, identity/suit links, local original scans and native aliases. Existing Black Widow, Sinister player pack, Thor and Jubilee suites exercise the shared hooks.

Maria Hill's worker owns `mariaHillTrait`, `mariaHillSupports` and `mariaHillChangeCounters`. At merge, compose Maria's dynamic SHIELD trait grant into `nickFuryPorts.hasTrait` and delegate its support counter changes to `mariaHillChangeCounters`. This keeps Maria-granted SHIELD support/ally effects and named Uses cleanup on the single shared implementation. Nick's `50024` must remain the sole script owner. Root owns public browser acceptance, batch inventory and release-wide matrices.
