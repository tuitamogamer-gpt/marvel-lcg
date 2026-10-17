# Four-pack import: Gambit, Rogue, Psylocke and Angel

The second four-pack continuation imports the complete retail products, including their additional player cards and included modular encounter sets. It does not reduce the scope to the four preconstructed decks.

| Product  | Prefix | Face codes                              |   Faces | Physical cards |
| -------- | ------ | --------------------------------------- | ------: | -------------: |
| Gambit   | `37`   | `37001a/b`, `37002`–`37035`             |      36 |             59 |
| Rogue    | `38`   | `38001a/b`, `38002`–`38035`             |      36 |             59 |
| Psylocke | `41`   | `41001a/b`, `41002a/b`, `41003`–`41033` |      35 |             59 |
| Angel    | `42`   | `42001a/b/c`, `42002`–`42032`           |      34 |             59 |
| Total    |        |                                         | **141** |        **236** |

Double-sided and folding identity faces describe one physical identity card. Psylocke's two `41002a` cards each have their own `41002b` reverse; there are two physical Psi-Energy upgrades, not four. Angel's three faces are one folding identity, not three deck cards.

## Immutable source evidence

The repository's original imported catalog, original source decks and checked-in English scans remain the source evidence. Original retail galleries are [Gambit](https://hallofheroeslcg.com/gambit-remy-lebeau/), [Rogue](https://hallofheroeslcg.com/rogue-anna-marie/), [Psylocke](https://hallofheroeslcg.com/psylocke-betsy-braddock/) and [Angel](https://hallofheroeslcg.com/angel-warren-worthington-iii/). Source deck records point to the pinned [DragnCards import](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747). Rules validation uses the [Rules Reference v1.8](https://hallofheroeslcg.com/wp-content/uploads/2026/07/mc_rulesreference_v18_compressed.pdf) and later dated [FFG rulings](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/). The rules PDF and current ruling page were retrieved on 2026-10-17.

| Immutable file                 | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `src/data/catalog-cards.json`  | `c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb` |
| `src/data/catalog-decks.json`  | `6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886` |
| `src/data/catalog-images.json` | `fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d` |

Independent visual inspection covered all nine identity faces, both Psi-Energy faces, Touched and both player side schemes. This confirms presentation and printed quantities; source metadata alone does not prove gameplay implementation.

- Gambit and Rogue have reversed scan filenames relative to the catalog code convention: `37001a.webp` depicts Remy LeBeau and `38001a.webp` depicts Anna Marie; their `b.webp` files depict the heroes. Map those four runtime images to the opposite filename without changing physical codes or source JSON.
- Psylocke, Betsy Braddock, Psi-Knife, Psi-Katana, Angel, Warren Worthington III and Archangel already match their source image filenames. Their images must not be swapped.
- Touched visibly has a dash resource cost and **does not have Permanent**. Its setup placement is not an exemption from deck-size counting.
- Archangel visibly prints an acceleration icon, ATK 2, THW 0 and DEF 3. Angel's normal face prints ATK 1, THW 2 and DEF 2. Both hero faces have hand size 5 and share 12 hit points.

## Exact original decks and setup

| Hero     | Playing count | Physical composition | Original factions excluding Permanents | Setup                                                |
| -------- | ------------: | -------------------: | -------------------------------------- | ---------------------------------------------------- |
| Gambit   |            40 |                   40 | 15 hero, 13 Justice, 12 Basic          | None                                                 |
| Rogue    |        **41** |               **41** | 16 hero, 17 Protection, 8 Basic        | Set the actual Touched aside after draw and mulligan |
| Psylocke |            40 |               **42** | 15 hero, 12 Justice, 13 Basic          | Two physical Permanent Psi-Knives                    |
| Angel    |            40 |                   40 | 15 hero, 17 Protection, 8 Basic        | Three identity forms, no extra deck card             |

The four original source compositions contain **163 physical player cards**, of which **161 count toward deck size** and two are Permanent. Identities, obligations and nemeses are outside these totals. The actual source codes are preserved, including all reprints. All four heroes choose one deckbuilding aspect.

- **Gambit:** required signatures are `37002`–`37005×1` each, `37006×3`, and `37007`–`37010×2` each. There is no Permanent or extra setup piece.
- **Rogue:** required signatures are `38002`–`38004×1` each, `38005×3`, `38006×3`, `38007×2`, `38008×2`, `38009×3`, totaling sixteen. Touched `38002` remains in the 41-card original composition and participates in the initial draw and mulligan. Anna Marie's Setup then moves that same physical card from its current zone to the set-aside area. If it was kept in the opening hand, setting it aside does not draw a replacement. It is neither a fabricated supplementary piece nor a Permanent. A customized 40-card deck can still include all sixteen required signatures.
- **Psylocke:** the physical required composition has `41002a×2`, `41003×1`, `41004×3`, `41005×3`, `41006×2`, `41007×2`, and `41008`–`41011×1` each. The two `41002a` Permanents remain outside the playing deck and begin play Psi-Knife faceup. Their two physical IDs must remain distinct as either copy independently flips to `41002b`; flipping never creates another card. The reverse face is not an extra deck/editor option.
- **Angel:** signatures are `42002×1`, `42003`–`42008×2` each, `42009×1` and `42010×1`. Angel `42001a`, Warren `42001b` and Archangel `42001c` are all faces of one identity; none is a player-deck card.

The printed identity base numbers are:

| Identity  | ATK | THW | DEF | REC |  HP | Hero hand | Alter-ego hand |
| --------- | --: | --: | --: | --: | --: | --------: | -------------: |
| Gambit    |   2 |   1 |   3 |   3 |   9 |         5 |              6 |
| Rogue     |   2 |   2 |   2 |   3 |  11 |         5 |              6 |
| Psylocke  |   1 |   1 |   2 |   3 |  10 |     **4** |              6 |
| Angel     |   1 |   2 |   2 |   3 |  12 |         5 |              6 |
| Archangel |   2 |   0 |   3 |   3 |  12 |         5 |              6 |

Psylocke's in-play Psi-Knife/Psi-Katana modifiers are separate from her printed base numbers. Hero stat code must not mistake the two initial knives' +2 THW for the identity's printed THW.

## Obligations, nemeses and included modules

| Hero     | One obligation                | Five physical nemesis cards                                                                                     |
| -------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Gambit   | `37025` Guild Business        | `37026×1` Belladonna, `37027×1` The Assassins Guild, `37028×2` Guild Assassin, `37029×1` Assassination Attempt  |
| Rogue    | `38024` Deadly Touch          | `38025×1` Mystique, `38026×1` Mystique's Manipulations, `38027×3` Misled                                        |
| Psylocke | `41025` Body Swapped          | `41026×1` Chimera, `41027×1` Interdimensional Plunder, `41028×1` Psionic Illusion, `41029×2` Telekinetic Dragon |
| Angel    | `42024` Apocalyptic Influence | `42025×1` Harpoon, `42026×1` Hook, Line, and Sinker, `42027×1` Harpoon's Harpoon, `42028×2` Spear Shot          |

Each opening source mission includes the player's actual obligation and keeps five physical nemesis cards set aside. Misled is a real encounter card that can enter a player deck and hand; that transition must preserve its physical ID and encounter origin rather than substituting a player card.

| Included modular set | Set ID    | Exact source quantities                    | Faces | Physical cards |
| -------------------- | --------- | ------------------------------------------ | ----: | -------------: |
| Exodus               | `exodus`  | `37032×1`, `37033×1`, `37034×2`, `37035×2` |     4 |              6 |
| Reavers              | `reavers` | `38029`–`38034×1` each, `38035×2`          |     7 |              8 |

Exodus includes Psionic Shield's replacement of the attached minion leaving play, rather than merely preventing lethal damage. The Reavers include Teamwork, Villainous and Cybernetic Enhancements' damage prevention and after-attack discard. Metadata registration alone is insufficient to establish these native behaviors.

Additional cards outside the starter lists are Gambit's War Room `37030×3` and X-Men Instruction `37031×3`; Rogue's Med Lab `38028×3`; Psylocke's Psi-Bow Attack `41030×3`, Domino `41031×1`, Psi-Flail Strike `41032×3`, Telekinesis `41033×3`; and Angel's Bombs Away `42029×3`, Eyes in the Sky `42030×3`, Flying Formation `42031×3`, X-Force Recruit `42032×3`. These remain part of full-pack support.

## Reprints and shared rules

The products contain nineteen reprint faces. The imported physical code and ownership remain unchanged when their mechanics use a shared implementation.

| Source printing               | Original rules printing   |
| ----------------------------- | ------------------------- |
| `37014` Stealth Strike        | `08013`                   |
| `37016` Passion for Justice   | `34020`                   |
| `37017` Professor X           | `32019`                   |
| `37018` X-Mansion             | `32049`                   |
| `37020` Hit and Run           | `18020`                   |
| `37022`, `37023`, `37024`     | `01088`, `01089`, `01090` |
| `38013` Unflappable           | `09020`                   |
| `38015` Preemptive Strike     | `05014`                   |
| `38017` Defensive Energy      | `32018`                   |
| `38020` Beauty and the Thief  | `37019`                   |
| `38021`, `38022`, `38023`     | `01088`, `01089`, `01090` |
| `41014` Concussive Blow       | `05031`                   |
| `41021` The Power of the Mind | `40028`                   |
| `42015` Ever Vigilant         | `17030`                   |
| `42021` Soaring Hearts        | `41020`                   |

Beauty and the Thief and Soaring Hearts are dependencies within this batch. The Power of the Mind `41021` implements the same printed behavior as `40028`; the original NeXt Evolution printing `40028` remains unregistered, along with the rest of that product. Its double-resource condition is Psionic; the Power of Flight doubles only for Aerial. Both have the ordinary maximum of three, while Passion for Justice and Defensive Energy share a maximum of two across reprints. The two team-up titles share a maximum of one across printings.

The original source decks retain identity-matching allies: Gambit's Rogue `37002`, Rogue's Gambit `38003`, Psylocke's Angel `41003`, and Angel's Psylocke `42002`. Deck selection must not silently replace them when those identities are on the team; ordinary uniqueness rules determine whether each can enter play.

## Independent timing clarifications

These points were checked against current rules rather than inferred from implementation:

- **Finding Touched:** RRG v1.8 p69 corrects Anna Marie's Setup and Withdrawn, Rogue's Skin Contact and Energy Transfer to explicitly **find** Touched. The runtime errata overlay updates `38001a`, `38001b` and `38007` without changing imported text or scans. RRG p19 permits Find to search all game areas except facedown encounter cards in an in-play area, the victory display and cards removed from the game. A player-owned Touched captured beneath Operation Zero Tolerance is searchable. The [FFG ruling of July 13, 2023, #44](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/) explicitly permits finding Touched even when it is a facedown Ultron drone. Recover the original physical card, preserving its owner; removing a drone's physical card also removes the drone without defeating it. The August 10, 2023, #65 ruling on the same page requires shuffling any deck searched to find Touched, with no shuffle when found elsewhere.
- **Scenario setup before Touched:** RRG v1.8 p51 resolves scenario Setup and When Revealed abilities at step 12, then opening draws at 14, mulligans at 15 and player Setup at 16. Project Wideawake's initial captures therefore remain before the opening hand. Anna Marie's later Find may recover the same captured Touched and reduce the captured-card count; neither the setup order nor the original deck composition changes.
- **Mystique's Manipulations:** RRG v1.8 p69 explicitly assigns its When Defeated search and Misled shuffle to the defeating player. The `38026` runtime overlay records that wording while retaining the original imported printing.
- **Rogue's copied traits:** the FFG answer dated **October 9, 2026** on the [current ruling page](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/) corrects the earlier snapshot interpretation. The lasting effect continues to refer to the chosen character's current traits. Those traits update as the target changes traits and cease to be provided if the target leaves play. Moving Touched alone does not replace a previously created lasting effect. Each grant expires at round end.
- **Superpower Adaptation:** “aspect” is one classification containing Aggression, Justice, Leadership, Protection and 'Pool, not five separate classifications (RRG v1.8 p12). An aspect ally permits an event from any aspect in that character owner's discard. Identity-specific is likewise a classification, not a restriction to that character's specific identity set. The physical borrowed event retains its original owner.
- **Energy Transfer:** its cost is to **deal** two damage. RRG v1.8 p14 expressly permits a dealing-damage cost to be paid even if prevention, including Tough, prevents all damage. Costs requiring damage to be **taken** follow a different rule.
- **Gambit's Thief Extraordinaire:** exhausting, looking at two cards and discarding one are all before the cost arrow. Confused still requires those costs, then replaces the thwart; The Thieves Guild's “after you resolve” window does not occur for the replaced ability (RRG v1.8 pp13–14).
- **Royal Flush and Flurry of Blades:** each is one attack with sequential damage instances. Repeated damage to the same enemy triggers Retaliate only once; Tough can prevent the first packet while subsequent packets deal damage. Attack damage bonuses apply to each non-additional packet (RRG v1.8 p10; FFG rulings October 5 and November 29, 2023).
- **Psionic Shield:** the replacement occurs when the minion would leave play, after defeat interrupts such as Priority Target and printed When Defeated abilities have resolved. It heals the same minion without causing a fresh engagement (FFG rulings July 20, 2023 and September 5, 2024).
- **Bishop:** “after an enemy attacks you” refers to the attacked player even when that player's ally defended. A teammate taking over the defense changes the attacked player (RRG v1.8 p49).

## Player side schemes

Lay the Trap `41016` and Render Medical Aid `42017` each visibly print **3 threat per starting player** and Victory 0. Lay the Trap costs one resource and deals **5 damage per starting player** to the villain, credited to the player who defeated it. Render Medical Aid costs zero and heals a total of **five damage for each player**, distributed among characters that player controls.

RRG v1.8 pp31,34,46,48 establishes the shared framework:

- A player side scheme enters play next to the main scheme under its owner's control, retaining its physical player-card identity. Playing it does not reveal an encounter card.
- The global limit is one if one or two players **started** the game, or two if three or four started. Eliminating a player does not reduce that limit or per-player printed values.
- A player may play a scheme at the limit and chooses a player side scheme to discard. Other excess-limit enforcement belongs to the first player. Discarding for the limit is not defeating a scheme and does not trigger its reward or Victory.
- No threat remaining causes defeat, including when no threat remains immediately upon entry. “When Defeated” is a Forced Interrupt and resolves before the card leaves play; Victory then directs the defeated card to the shared victory display.
- Player side schemes are schemes for normal thwart targeting, crisis and patrol restrictions, attachment legality, and relevant scheme effects. They are not encounter side schemes for rules explicitly restricted to encounter cards.
- Elimination moves cards owned by the eliminated player to that player's discard before removing that play area from the game. Moving a player card into a shared scheme area does not discard its owner metadata.

## Validation boundary

`tests/quadruple-import-2-source-contract.test.ts` is independent of pack implementation code lists. It pins all three immutable source hashes, full product face and physical counts, original printed fields, exact original compositions, legal aspect alternatives, mandatory quantities, invalid reverse/identity additions, correct artwork mapping, actual setup pieces, obligations, nemeses, modular quantities, title-based copy limits, identity-matching allies and three-seat physical ownership through JSON.

The Touched setup test samples deterministic opening hands to cover the actual card starting in either hand or deck and verifies no replacement draw. The Psi-Energy setup test requires two original distinct physical IDs to enter play. These source and setup tests complement dedicated native gameplay tests, mission simulations, browser acceptance, build checks and deployment verification; they do not replace those checks.

The independent `tests/quadruple-import-2-cross-pack.test.ts` exercises Karma with Possessed and Mind Control, retaining the original physical IDs and owners through competing control effects and JSON restoration. Both printings of each shared Team-Up resolve once across two hero seats. A separate case follows Rogue's original Angel target through actual Metamorphosis changes to Archangel and Warren after Touched moves elsewhere, checking current Aerial, X-Force and Mutant consumers.
