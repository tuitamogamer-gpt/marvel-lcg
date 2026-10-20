# Jubilee Hero Pack

The complete original retail pack is native: 41 faces, representing 59 physical cards. The immutable source includes Jubilee/Jubilation Lee, all signature and additional player cards, the obligation and five-card nemesis set, and the five-card Arcade modular set. The original Justice starter retains its exact 40 physical printing codes. Firecracker, Flash of Light and Plasmoid Energy keep their distinct a/b/c resource printings; X-Gene keeps 47020 while sharing the installed 38019 rules handler.

`src/game/jubilee.ts` provides the native programs through engine ports. Registration includes the hero, editor/deck validation, original starter, encounter set, Arcade selection and all retail faces. Imported card/deck/image JSON is unchanged. Mall Rat is an alter-ego action rather than automatic setup: it searches only the deck, moves the actual Shopping Spree instance into play, and shuffles without exhausting the identity.

## Payment and timing

- Wild icons are independently declared as energy, mental, physical or wild, including doubled resources. The serialized choice retains the exact payment source IDs and resumes without prematurely discarding or exhausting sources. A changed selection starts new declarations.
- Jubilee's event and upgrade benefits use the exact resources allocated to the actual cost. Overpaid icons are excluded. Free replay of the same physical event clears its previous receipt. Husk uses the same receipt for its optional resource cost.
- Blinding Flash chooses different legal enemies. Grande Finale and Three Steps Ahead resolve sequential choices, allowing a defeated Guard or Crisis to change subsequent legal targets. Guard, Patrol, Stalwart, status replacement and actual attack/thwart response windows use the shared native engine.
- Unlikely Duo treats its status-only target as attacked. Retaliate waits until the attack ends and resolves once for each surviving attacked enemy. Float Like a Butterfly uses confusion at initiation, before the event adds a confuse status.
- Synch supports ATK, THW, DEF and REC. Cell Phone uses an actual controlled character's basic power, legal targets, exhaust cost and ordinary consequences, with one appropriate +1 even against Assault. Generation X's +1 THW does not increase an ATK-based Assault thwart.
- Mutant Mayhem returns two different qualifying allies as additional costs, then their owners play those same physical cards without resource costs. Serve and Protect pays its two different exhaust costs together with its resource payment; canceling payment preserves the pending threat.

## Encounters and physical state

- Shopping Spree has two fixed threat, no Victory, and blocks heroes/allies from removing threat. Its alter-ego action is available to any player. Defeat searches for an eligible Item to put into play and moves the actual scheme to its owner's discard. Generation X has its printed per-player threat and Victory 0, and searches for any identity-specific event in each player's own deck/discard.
- Player side scheme triggered rewards follow the scheme controller under The Merc with the Mouth. Delegated searches retain that ability's controller while new entry abilities use their own controller. Normal defeat movement still completes when a reward is prohibited.
- Grounded remains a physical obligation in play, changes Jubilee to alter-ego when revealed, charges the printed same-type form-change cost during her turn, and can leave after a Jubilee event.
- Nanny retrieves a real Lost Child from the encounter deck/discard or reserved nemesis set. Lost Child converts the same ally into a blank Regressed minion, with its printed THW as base SCH before the attachment's printed -1 SCH. Complete text-box blanking removes printed traits while retaining externally granted traits. Control precedence and restoration share the existing physical control chronology.
- Battle Suit chooses a minion with the fewest remaining HP and grants its printed statistics and Aerial. Arcade cannot take damage while a Trap! scheme is in play. Trap schemes apply Hinder and their printed icons and defeat effects. Elaborate Trap resolves those abilities without defeating the schemes. Discard-until stops when the original encounter deck empties, including when the matched last card has already entered the mandatory reshuffle.

## Sources

- Original scans: `public/cards/catalog/47001a.webp` through `47034.webp`, including the alternate resource printings, with original image references preserved in the catalog.
- Jubilee gallery: https://hallofheroeslcg.com/jubilee-jubilation-lee/
- Rules Reference 1.8: https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf — costs/overpayment p.13, encounter deck exhaustion p.17, text boxes p.44, Wild resources p.48.
- Official FFG ruling archives: https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/ (#197, May 30, 2024: status-only attack targets and Retaliate); https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/ (#21: Lost Child base SCH; #37: different Blinding Flash targets; #49, November 23, 2024: sequential Three Steps Ahead, superseding the earlier simultaneous ruling); https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/ (June 26, 2025: Multitalented labels; January 17, 2026: declaring Wild overpayment does not change the cost's paid subset).

## Validation

`tests/jubilee-engine.test.ts` exercises retail registration, exact starter codes, public identity actions, physical nemesis/Arcade instances, independently declared Wilds and doubled resources, generated resources, canceled/nested payment reload, overpayment and free replay, sequential targets, status legality, response timing, basic powers, cooperative ownership, additional costs, control restoration and scheme reward restrictions. Targeted payment, Rogue, SP//dr, Venom, Psylocke, Wasp/Assault, Cable, Deadpool and Wolverine suites exercise the affected shared hooks. TypeScript and formatting checks pass. The parent import batch owns release-wide inventory, mission, browser and deployment validation.
