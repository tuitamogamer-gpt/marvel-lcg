# Rogue native integration

This import covers all 36 printed faces (59 physical cards) in Rogue Hero Pack 38, including the complete Reavers modular encounter set. Original catalog JSON and artwork remain unchanged. `imageFor` corrects the swapped source identity scan filenames: printed Rogue uses 38001b artwork, and Anna Marie uses 38001a artwork. Runtime card definitions remain in the cycle-free `card-definitions.ts` leaf, including Ultron Drone and controlled character overlays.

## Source and rules

- [Official card scans, Hall of Heroes](https://hallofheroeslcg.com/rogue-anna-marie/).
- [FFG rulings after RRG 1.7](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/): October 9, 2026 dynamic trait grants; January 17, 2026 Bulletproof Belle and piercing; December 17, 2025 Med Lab and removed-from-game cards.
- [Earlier FFG rulings](https://hallofheroeslcg.com/latest-ffg-rulings/#300): March 23, 2023 Touched counts toward deck size. The Energy Transfer ruling clarifies movement to a different target and healing/readying when its damage cost defeats that target.
- [Rules Reference 1.8](https://hallofheroeslcg.com/wp-content/uploads/2026/07/mc_rulesreference_v18_compressed.pdf), Classifications, Cost, Control, Setup, Teamwork and When Revealed timing. Dealing damage as a cost succeeds when Tough prevents damage; all aspects share the aspect classification.

## Original deck and physical lifecycle

The original Protection list is 41 cards: 16 signatures, including the one physical Touched, plus the source Protection and Basic cards. Touched is not Permanent and counts toward deckbuilding size. Normal opening draw and mulligan occur before Setup finds that same instance and sets it aside. There is no replacement draw when Touched was in the opening hand. Other aspect defaults retain all 16 signatures and have 41 cards. The five physical nemesis cards are reserved per Rogue seat, outside the player deck.

Skin Contact and Energy Transfer attach the original Touched. Its current character type grants Overkill, Retaliate 1, Aerial or Stalwart, and determines Jacket's bonus. Copied traits are independent lasting effects that follow each original target's changing traits through round end. Moving Touched does not replace an earlier grant. Actual target departure clears its grant permanently for that round, even if the same physical card returns. The next player phase and change to Anna Marie set Touched aside.

Superpower Adaptation moves the original event from the touched character owner's discard, preserving owner ID. Identity-specific, any aspect, and Basic are distinct classifications. Both playing and spending borrowed events return them to their actual owner's discard. All effects and control receipts survive JSON save/load.

Karma shares physical control precedence with Mind Control, Possessed and Beguiled. The latest active control effect determines the one canonical zone and derived type; removing it restores the preceding effect or owner. Karma creates a blank Controlled ally with printed SCH as THW and two consequential damage. Karma's lasting target reference ends when that character leaves play. No replacement character is manufactured.

## Native coverage

| Faces               | Native behavior                                                                                                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 38001a/b, 38002     | Identity setup, Skin Contact, phase/form cleanup, dynamic traits and four Touched grants                                                                                                    |
| 38003–38009         | Gambit counters and attack interrupt, Jacket, conditional attack/thwart/status/draw events, Energy Transfer cost, Bulletproof Belle, cross-owner Adaptation                                 |
| 38010–38012         | Iceman entry response, Karma control, Armor trait gate and Toughness                                                                                                                        |
| 38013, 38015, 38017 | Existing Unflappable, Preemptive Strike and Defensive Energy rules, retaining Rogue printing IDs                                                                                            |
| 38014, 38016        | Judoka counters and attack modifier; Not Today defense modifier and no-damage thwart response                                                                                               |
| 38018–38020         | Moira across player seats, X-Gene identity-event resource, Beauty and the Thief attack/thwart Team-Up                                                                                       |
| 38021–38023         | Exact Core resource aliases through the existing compiler; excluded from dedicated scripts                                                                                                  |
| 38024–38027         | Both Deadly Touch branches; original nemesis reservation/Shadows; Mystique engagement search; Manipulations defeat search; Misled hand-entry observer and encounter discard routing         |
| 38028               | Med Lab can store an ally defeated by consequential damage from any player, preserves its owner, and uses normal payment/play with exhausted entry; removed-from-game cards are unavailable |
| 38029–38035         | Selectable Reavers: entry-only Teamwork, printed engagement responses, original Cybernetic search/attachment, damage prohibition, post-attack discard, and scheme-defeat search/reveal      |

Beauty and the Thief also has a standalone Rogue handler so this pack can run independently. Gambit's shared handler recognizes the Rogue printing after combined integration; the null-coalescing dispatcher resolves exactly one handler.

## Verification

`tests/rogue-engine.test.ts` uses original physical starter cards, actual PLAY/PAY actions, native attack/reveal windows, multiplayer seats, and JSON round trips. It covers setup in every aspect, signature conditionals, defensive interruption and recalculation, piercing, printed resource aliases, ally/support entry, classification and ownership, Karma precedence/lifetime, obligation/nemesis and Reavers behavior. Shared control integration and import-entry regressions protect existing Mind Control/Possessed/Beguiled behavior and initialization order. Repository-wide source matrix, inventory, browser checks and final release verification are run by the combined batch integration.
