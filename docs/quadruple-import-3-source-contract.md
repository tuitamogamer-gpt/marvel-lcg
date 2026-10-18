# Four-hero continuation: Cable, Domino, X-23 and Deadpool

This batch covers the two hero/player sections of NeXt Evolution and the complete X-23 and Deadpool Hero Packs. Cable and Domino are not separate retail products. This is partial NeXt Evolution box support: its five scenarios, encounter modules, campaign cards and separate Hope Summers player card `40204` remain outside this batch.

| Content                     | Face codes                  |   Faces | Physical cards |
| --------------------------- | --------------------------- | ------: | -------------: |
| Cable hero/player section   | `40001a/b`, `40002`–`40036` |      37 |             47 |
| Domino hero/player section  | `40037a/b`, `40038`–`40069` |      34 |             47 |
| X-23 complete Hero Pack     | `43001a/b`, `43002`–`43040` |      41 |             59 |
| Deadpool complete Hero Pack | `44001a/b`, `44002`–`44058` |      59 |             77 |
| Total                       |                             | **171** |        **230** |

An identity's two faces represent one physical card. X-23's four linked Specialization upgrades and Deadpool's seven-card Dreadpool encounter set are included in the product totals, not additional cards beyond them.

## Immutable evidence

The original imported catalog, source decks and checked-in English scans are immutable source evidence. Product galleries are [NeXt Evolution](https://hallofheroeslcg.com/next-evolution/), [X-23](https://hallofheroeslcg.com/x-23-laura-kinney/) and [Deadpool](https://hallofheroeslcg.com/deadpool/). Primary product instructions are the [NeXt Evolution rulebook](https://hallofheroeslcg.com/wp-content/uploads/2023/08/mc40_next_evolution_rulebook-compressed.pdf), [X-23 insert](https://hallofheroeslcg.com/wp-content/uploads/2023/11/x-23-insert.jpg) and [Deadpool insert](https://hallofheroeslcg.com/wp-content/uploads/2023/11/deadpool-insert.pdf). The source decks retain their pinned [DragnCards provenance](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747).

| Immutable file                 | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `src/data/catalog-cards.json`  | `c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb` |
| `src/data/catalog-decks.json`  | `6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886` |
| `src/data/catalog-images.json` | `fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d` |

Independent visual inspection verified all eight identity scans, X-23's Claws, Specialized Training, Live Dangerously and the three printed metagame boards. All identity image filenames match their source face codes; no identity artwork swapping is required. Deadpool's humorous extra zeroes explicitly say to ignore them: his printed ATK/THW/DEF are 2/2/1.

Critical Hit `43016` visibly has one Mental resource in its lower-left resource field; the original imported JSON already matches that field and needs no correction.

| Identity | ATK | THW | DEF | REC |  HP | Hero hand | Alter-ego hand |
| -------- | --: | --: | --: | --: | --: | --------: | -------------: |
| Cable    |   2 |   2 |   2 |   4 |  12 |         5 |              6 |
| Domino   |   2 |   1 |   3 |   3 |   9 |         5 |              6 |
| X-23     |   1 |   2 |   2 |   6 |  10 |         5 |              6 |
| Deadpool |   2 |   2 |   1 |   8 |   9 |         5 |              6 |

## Exact source compositions and setup

| Hero     | Playing cards | Physical composition | Counted factions                                             | Selected aspect |
| -------- | ------------: | -------------------: | ------------------------------------------------------------ | --------------- |
| Cable    |            40 |                   40 | 15 hero, 12 Leadership, 11 Basic, 1 Aggression, 1 Protection | Leadership      |
| Domino   |            40 |                   40 | 15 hero, 12 Justice, 13 Basic                                | Justice         |
| X-23     |            40 |                   41 | 15 hero, 16 Aggression, 9 Basic; plus one Permanent          | Aggression      |
| Deadpool |            40 |                   40 | 15 hero, 24 'Pool, 1 Basic                                   | 'Pool           |

The four original compositions contain **161 physical player cards**, of which **160 count toward deck size**. Identities, obligations, nemeses, linked Specializations and the Dreadpool set are outside these totals. Preserve every original printing ID and quantity; identity-matching allies remain in these original source compositions.

- Cable's fifteen signatures are `40002×1`, `40003×3`, `40004×1`, `40005×2`, and `40006`–`40013×1` each. His source record says `multi` because it includes three aspect colors; the chosen aspect is Leadership, with the two off-aspect player side schemes allowed by Nathan Summers's deckbuilding text. He may include player side schemes from any of the five aspects. His Setup searches his actual deck and discard pile after opening draws and mulligans; a scheme in his kept opening hand is not a legal setup search result.
- Domino's fifteen signatures are `40038×1`, `40039×1`, `40040×2`, `40041×1`, `40042×2`, `40043`–`40045×1` each, `40046×2`, and `40047`–`40049×1` each. She has no additional setup card.
- X-23's sixteen physical signatures are `43002×1`, `43003×1`, `43004×2`, `43005×3`, `43006×2`, `43007`–`43011×1` each and `43012×2`. Permanent X-23's Claws `43002` is outside the playing deck and starts in play; the same original physical piece is retained. Her fifteen other signatures count toward deck size.
- Deadpool's fifteen signatures are `44002×1`, `44003×1`, `44004×2`, `44005×1`, `44006×2`, `44007`–`44009×1` each, `44010×2`, `44011×1` and `44012×2`. Deadpool can choose any aspect. The Dreadpool dependency follows the chosen 'Pool aspect, not the identity.

## Linked Specializations

[Rules Reference v1.8](https://hallofheroeslcg.com/wp-content/uploads/2026/07/mc_rulesreference_v18_compressed.pdf#page=27), p27, defines Linked. `43034` Combat Specialist, `43035` Defense Specialist, `43036` Front Line Specialist and `43037` Surveillance Specialist cannot be included in a deck. Set aside one physical copy of each **for each deck containing Specialized Training `43021`**. They do not count toward deck size and are not automatically supplied merely because a player chose X-23. Thus X-23's original source deck requires all four, and a customized deck without Specialized Training does not.

When a player takes control of a linked card, that player becomes its owner. Once in the game, the card uses ordinary player zones: if discarded it goes to that owner's discard, not back to the set-aside supply. This is confirmed by the FFG answer of October 7, 2024, #18 on the [post-RRG 1.6 ruling page](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/). Front Line Specialist's current text grants +4 HP to the **identity**, including alter ego; the catalog already contains the RRG erratum (v1.8 p69), so no change to imported JSON is necessary.

## Obligations, nemeses and Dreadpool

| Hero     | Obligation                      | Five physical nemesis cards                |
| -------- | ------------------------------- | ------------------------------------------ |
| Cable    | `40031` Technovirus Resurgence  | `40032`–`40036×1` each                     |
| Domino   | `40065` Memories of Armageddon  | `40066`–`40068×1` each, `40069×2`          |
| X-23     | `43028` Self-Isolation          | `43029`–`43033×1` each                     |
| Deadpool | `44032` The Merc with the Mouth | `44033×1`, `44034×1`, `44035×1`, `44036×2` |

Each source mission uses the actual obligation and five separate physical set-aside nemesis cards. Self-Isolation moves the original Honey Badger under the obligation; it does not create a substitute or keep attached upgrades on the facedown card.

The Dreadpool set is `44037×1`, `44038×1`, `44039×1`, `44040×1`, `44041×2`, `44042×1`: six faces and seven physical cards. The official Deadpool insert specifies a special setup dependency: if at least one player **chooses 'Pool as an aspect**, shuffle exactly one Crisis of Infinite Deadpools `44037` into the encounter deck and set the remaining six cards aside. Revealing Crisis reveals the actual set-aside Dreadpool and Dreadful Deeds, shuffles the remaining four physical cards into the encounter deck and removes Crisis from the game.

RRG v1.8 p64 explicitly excludes decks that merely include off-aspect 'Pool cards through a deckbuilding exception. Cable including Live Dangerously and Gamora including Cutupper do not by themselves add Crisis. Multiple 'Pool players still add only one copy. This batch supplies the automatic dependency; it does not add Dreadpool to the ordinary modular-set picker.

The 'Pool aspect is available to other heroes and counts as an aspect for rules referencing aspects. Adam Warlock may choose any four of the five aspects, retaining equal quantities and singleton limits; the original four-aspect source remains unchanged. His Battle Mage can discard a 'Pool card and is considered resolved, but none of its four colored bullet effects applies. This is stated in the Deadpool insert and the FFG answer dated August 10, 2023, #61 on the [post-RRG 1.5 page](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/).

## Player side scheme values

| Code    | Name                 | Cost | Initial threat              |
| ------- | -------------------- | ---: | --------------------------- |
| `40006` | Technovirus Purge    |    0 | **5 fixed**, not per player |
| `40018` | Call for Backup      |    1 | 3 per starting player       |
| `40019` | Lock and Load        |    1 | 2 per starting player       |
| `40020` | Establish Perimeter  |    1 | 2 per starting player       |
| `40027` | Build Support        |    1 | 3 per starting player       |
| `40054` | Take Out the Guards  |    0 | 4 per starting player       |
| `40059` | Superpower Training  |    1 | 3 per starting player       |
| `43018` | Keep Them Busy       |    1 | 3 per starting player       |
| `43021` | Specialized Training |    1 | 5 per starting player       |
| `43039` | Rally the Troops     |    0 | 3 per starting player       |
| `44024` | Live Dangerously     |    0 | 3 per starting player       |

Each has Victory 0. Live Dangerously prints one each of crisis, acceleration, amplify and hazard; its +2 hand size applies to every identity while in play. Acceleration tokens are not acceleration icons (Deadpool insert). The shared player side scheme limit, ownership, When Defeated timing and Victory rules from [batch two](quadruple-import-2-source-contract.md#player-side-schemes) continue to apply.

## Reprints and other printed mechanics

Fourteen faces explicitly record `duplicate_of` in the immutable source:

| New printing              | Original printing         |
| ------------------------- | ------------------------- |
| `40030` Sidearm           | `23035`                   |
| `40052` Even the Odds     | `30014`                   |
| `40055` Overwatch         | `30019`                   |
| `40061`, `40062`, `40063` | `01088`, `01089`, `01090` |
| `43017` Moment of Triumph | `12030`                   |
| `43022`, `43023`, `43024` | `01088`, `01089`, `01090` |
| `43025` IPAC              | `41022`                   |
| `43026` X-Bunker          | `41023`                   |
| `43027` Endurance         | `05023`                   |
| `44031` Frenemies         | `40026`                   |

The Power of the Mind `40028` is now within scope; its earlier reprint `41021` already has the same mechanic. Frenemies uses one shared effect provider for both physical printings and keeps its one-per-deck limit across printings. Copies of The Power of the Mind share a maximum of three.

The visible metagame diagrams are operative source evidence absent from plain card text:

- Blackout `44053` has six spaces: two Energy, two Mental and two Physical. Filling all six discards Blackout and confuses the villain.
- Rock, Paper, Scissors `44056` has Energy beating Mental, Mental beating Physical and Physical beating Energy. Wild beats each of those three, but not Wild. No resource beats itself. Compare printed resource icons, not additional resources generated by an ability.
- Tic-Tac-Toe `44057` has a 3×3 grid: the top row is Energy, middle row Mental, bottom row Physical. A line is a row, column or diagonal. The completed ability deals **all** damage on the card, not merely the three tokens in the winning line. Moving damage off a character heals it and respects cannot-heal effects.

Break Time `44046` has a cost of **3 per starting player**, payable using Alliance. Its healing depends on elapsed whole minutes away from the game. Git Gud's previous-game discount and The Merc with the Mouth's speech condition need explicit, honest player information. The insert allows Git Gud's discount for a first game or an unknown previous result. Such information must not be silently invented by the automated engine.

## Independently checked timing rulings

Current rules review uses RRG v1.8 and dated FFG answers on the [post-1.5](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/), [post-1.6](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) and [post-1.7](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/) pages, retrieved on 2026-10-17.

- **Technovirus Purge:** Cable's events and upgrades can remove threat while he is Cable. Any player's support may remove threat because a support is neither a character nor an extension of an identity (August 10 and 31, 2023, #62/#78). Its Victory-display constant grants Psionic to both Nathan Summers and Cable, and +1 to Cable's printed basic powers. If Vivian blanks it, Victory is also blanked and ordinary defeat discards it.
- **Bodyslide:** another identity already in hero form can change to a different hero face, such as Tiny Ant-Man to Giant Ant-Man. Non-identity forms such as mass forms do not change (June 22, 2023, #22).
- **Graymalkin:** after defeating Feral Rage, it can ready before steps of the resulting Sabretooth attack resolve (September 7, 2023, #81).
- **Temporal Leap:** threat movement removes threat and cannot bypass a crisis icon. Preventing completion by moving four threat can still be insufficient against the impending placement (May 10 and October 11, 2024, #182/#22).
- **Deathlok:** putting an upgrade into play bypasses play restrictions, but its attachment must satisfy applicable attach-to requirements and attachment limits (August 31, 2023, #79).
- **Top-deck discard responses:** a discard-until batch completes before Jackpot!, White Fox, Digging Deep or The Painted Lady responds. Empty-deck reset happens immediately; a last-card Digging Deep can still be retrieved after that reset (August 31 and September 21, 2023, #77/#92). Jackpot! discarded as Domino's Pistol's cost resolves before the later Sharpshooter interrupt (September 7, 2023, #83).
- **Domino:** her constant doubling of Wild icons does not resolve an ability and does not itself trigger Superpower Feedback. Diamondback's initiated ability still completes if its damage cost defeats her (August 18 and September 7, 2023, #70/#82).
- **Assault:** basic thwarting uses ATK, including ATK modifiers and the ally's printed ATK consequential damage, but remains a thwart. Thwart-specific consequential modifiers apply. Animal Instinct's THW increase cannot increase Assault threat removal; Probability Field's basic-power increase can (RRG v1.8 p8; August 10 and 24, 2023, #66/#76; post-1.6 Animal Instinct answer).
- **X-23 and Honey Badger:** damage that defeats Honey Badger cannot trigger her Response (RRG v1.8 p64). Grim Resolve's paid damage can ready X-23 before the paid event resolves. Puncture Wound's prior-attack attachment requirement still applies when put into play (June 13, 2024, #207). Surveillance Specialist obtained by defeating Specialized Training with a basic thwart may immediately respond to that thwart (July 11, 2024, #219).
- **Deadpool:** paying all remaining HP to Maximum Effort triggers his defeat replacement before the event deals damage, but does not cancel the initiated attack; voluntary form change remains available if unused. The Merc with the Mouth blocks other players' triggered player abilities during his turn, including abilities in hand, but not constant abilities (June 13, 2024, #207). Exhausting Personality expressly permits paying its cost with another player's identity (June 2, 2026).
- **Armed to the Teeth:** the incoming Weapon occupies the outgoing Weapon's location, including its attachment target, disregarding the incoming card's attach-to instruction. It enters ready with its initial Uses; the outgoing card loses its counters (May 10, 2024, #168). The collection search is for an aspect Weapon, excluding Basic, identity-specific and campaign cards. A card removed from the game is not part of the collection and cannot return this way (Deadpool insert; December 17, 2025).
- **Metaknowledge:** villain and main-scheme When Revealed abilities cannot be canceled (November 23, 2024, #51). Cable ally's +3 maximum limits only his own ability, not bonuses from other cards (November 3, 2023, #120).

## Verification boundary

The independent source-contract tests pin immutable bytes, all 171 faces and 230 physical quantities, the four original compositions, required signatures, printed identities, original image mappings, legal aspect exceptions, forbidden linked/identity deck additions and physical setup ownership. These checks do not establish complete gameplay support by themselves. Native ability tests, cross-pack timing and ownership regressions, the complete source-mission matrix, public desktop/mobile acceptance and exact-commit deployment checks remain separate release gates.
