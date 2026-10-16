# Cyclops, Phoenix, Wolverine and Storm original-source contract

The four-pack batch covers **151 English catalog faces representing 234 physical cards**. It includes each complete Hero Pack: identities, signature cards, original preconstructed player cards, obligation, nemesis set, additional player cards, and the two included modular encounter sets. This is a four-product scope; it does not change the app's existing one-to-three-player mission limit.

| Product   | Catalog pack code | Face range                              |   Faces | Physical cards |
| --------- | ----------------- | --------------------------------------- | ------: | -------------: |
| Cyclops   | `cyclops`         | `33001a/b`, `33002`–`33035`             |      36 |             59 |
| Phoenix   | `phoenix`         | `34001a/b`, `34002a/b`, `34003`–`34035` |      37 |             58 |
| Wolverine | `wolv`            | `35001a/b`, `35002`–`35037`             |      38 |             58 |
| Storm     | `storm`           | `36001a/b`, `36002`–`36039`             |      40 |             59 |
| Total     |                   |                                         | **151** |        **234** |

Each identity's two faces count as one physical card. Phoenix Force also has two faces on one physical card. Storm's four Weather supports are four separate physical cards. The canonical Wolverine hero ID is `wolverine`, while its product code is `wolv`; `wolv:wolverine` and both identity codes must resolve to the same hero.

## Evidence and immutable imports

The original source galleries are [Cyclops / Scott Summers](https://hallofheroeslcg.com/scott-summers-cyclops/), [Phoenix / Jean Grey](https://hallofheroeslcg.com/jean-grey-phoenix/), [Wolverine / Logan](https://hallofheroeslcg.com/logan-wolverine/), and [Storm / Ororo Munroe](https://hallofheroeslcg.com/ororo-munroe-storm/). All four gallery pages returned HTTP 200 during this audit. The checked-in source deck records identify the pinned [DragnCards source import](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747). The repository's original catalog and local English scans remain the input evidence, separate from runtime corrections.

| Immutable file                 | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `src/data/catalog-cards.json`  | `c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb` |
| `src/data/catalog-decks.json`  | `6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886` |
| `src/data/catalog-images.json` | `fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d` |

The independent audit counted every source face and physical quantity and compared the imported numerical fields across the full scope. Visual inspection independently confirmed all eight identity faces, both Phoenix Force faces, Wolverine's Claws and the reprinted Colossus. It does not claim that a full rules implementation has been verified by source metadata alone.

Two presentation repairs are required without rewriting those original imports:

- All four identity scan pairs are reversed relative to the catalog's runtime code convention. The original `33001a.webp`, `34001a.webp`, `35001a.webp` and `36001a.webp` scans show **alter-ego** sides; their `b.webp` partners show **hero** sides. The catalog calls its `a` codes hero and its `b` codes alter-ego. `imageFor()` must map each identity code to the other image filename, preserving the actual card code and both original files. Phoenix Force `34002a/b` is correctly mapped and must not be swapped.
- Colossus `35021`, a reprint of `32048`, visibly prints the secondary title **Piotr Rasputin**. The original JSON omitted it. Playable metadata must restore the subtitle for both printings so uniqueness and identity matching work with the Colossus hero. The original JSON remains unchanged.

The snapshot already includes published text errata for Storm's Claustrophobia (`36030`: “cannot change to hero form”) and Possessed (`36038`: “Attached ally engages its controller”). Their older original artwork does not authorize reversing those corrections. Runtime rules tests remain responsible for current Rules Reference timing and restrictions.

## Original decks and setup

| Hero      | Playing cards | Physical composition | Original factions, excluding Permanent setup                            | Separate supplementary pieces |
| --------- | ------------: | -------------------: | ----------------------------------------------------------------------- | ----------------------------- |
| Cyclops   |            40 |                   40 | 15 hero, 12 Leadership, 1 Aggression, 1 Protection, 1 Justice, 10 Basic | None                          |
| Phoenix   |            40 |                   41 | 15 hero, 16 Justice, 9 Basic                                            | None                          |
| Wolverine |            40 |                   41 | 15 hero, 19 Aggression, 6 Basic                                         | None                          |
| Storm     |            40 |                   40 | 15 hero, 15 Leadership, 10 Basic                                        | Four Weather supports         |

The four source compositions contain **162 physical cards**: 160 playing cards and two Permanent setup cards. Storm adds four supplementary Weather cards. Identities, obligations and nemesis sets do not enter these player-deck totals. The source records and actual printed card codes are retained exactly; Core reprints are not replaced with Core printing codes.

- **Cyclops:** signature quantities are `33002×1`, `33003×1`, `33004×1`, `33005×2`, `33006×2`, `33007×2`, `33008×1`, `33009×2`, `33010×3`. There is no extra Permanent setup card. The raw source labels its aspect `multi` because its original list contains four colors. Its actual selected deckbuilding aspect is Leadership. Scott Summers allows **X-Men allies** from any aspect; this does not grant off-aspect events, upgrades, non-X-Men allies or a second selected aspect. The source's Dust (`33012`), Rockslide (`33013`) and Blindfold (`33014`) remain legal original cards. Both validation and the deck editor's card options must recognize the exception.
- **Phoenix:** `34002a×1` is the same physical Phoenix Force card that later flips to `34002b`. It is Permanent, retained in the required composition and excluded from the forty-card playing count. The other fifteen signature cards are `34003`–`34009×1` each, and `34010`–`34013×2` each. Jean Grey's Setup puts Phoenix Force into play **Restrained** with **four power counters**. The Unleashed face is never an additional deck/editor card. The four-power threshold flips that same physical card back to Restrained; the zero-power transition flips the same card to Unleashed.
- **Wolverine:** Wolverine's Claws `35002×1` is Permanent and is required in the composition outside the forty playing cards. The other fifteen signatures are `35003`–`35007×1` each and `35008`–`35012×2` each. Logan's Setup searches for and puts the actual Claws into play; it must not fabricate a second copy. The Claws' printed dash cost is not zero, and the card cannot be an optional customizable upgrade.
- **Storm:** fifteen signatures are `36006×1`, `36007×1`, `36008×1`, `36009×3`, `36010×3`, `36011×2`, `36012×2`, `36013×2`. The Weather deck is exactly `36002×1` Clear Skies, `36003×1` Hurricane, `36004×1` Thunderstorm and `36005×1` Blizzard. All four remain outside the ordinary deck and its forty-card count. Ororo's Setup chooses one of those four supports and moves that actual physical card into play; the remaining three stay in the Weather deck. Swapping weather moves the existing cards instead of creating new copies. Weather supports are not extra customizable cards.

All four heroes choose one aspect. Every supported aspect starter retains each mandatory signature quantity and Permanent setup card, with a legal forty-card playing deck. Missing or surplus signatures, additional identity faces and Phoenix Force's extra reverse face are invalid deck compositions.

## Identity numbers, obligation and nemesis quantities

The printed base identity numbers are:

| Hero      | ATK | THW | DEF | REC |  HP | Hero hand | Alter-ego hand |
| --------- | --: | --: | --: | --: | --: | --------: | -------------: |
| Cyclops   |   1 |   2 |   2 |   3 |  10 |         5 |              6 |
| Phoenix   |   1 |   3 |   2 |   3 |   9 |         5 |              6 |
| Wolverine |   2 |   2 |   2 |   6 |  10 |         5 |              6 |
| Storm     |   2 |   1 |   1 |   3 |  10 |         5 |              6 |

Phoenix's Unleashed modifier, Storm's chosen Weather and other in-play modifiers are separate from these printed base numbers.

| Hero      | One obligation         | Five physical nemesis cards                                                                                   |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| Cyclops   | `33027` Lost Visor     | `33028×1` Mister Sinister, `33029×1` Genetic Manipulation, `33030×2` Gene Therapy, `33031×1` Concussive Force |
| Phoenix   | `34028` Burning Hunger | `34029×1` Dark Phoenix, `34030×1` Consume the World, `34031×3` Fiery Rage                                     |
| Wolverine | `35027` Past Demons    | `35028×1` Omega Red, `35029×1` The Carbonadium Synthesizer, `35030×2` Death Factor, `35031×1` Tentacle Strike |
| Storm     | `36030` Claustrophobia | `36031×1` Callisto, `36032×1` Leader of the Morlocks, `36033×1` Switchblade, `36034×2` Knife Fight            |

Opening missions include each player's one physical obligation in the encounter deck and keep their five actual nemesis cards set aside until an effect brings them in. They are not generic replacement cards. Distinct player ownership and unique physical IDs must survive JSON saves and multi-seat setup.

## Additional player cards and modular sets

The complete scope includes Cyclops's additional Marked `33032×3`, Befuddle `33033×3`, Pinned Down `33034×3`, Honorary X-Men `33035×3`; Phoenix's Psychic Assault `34032×3`, Psychic Misdirection `34033×3`, Psychic Kicker `34034×3`, Soul Sisters `34035×1`; Wolverine's Command Center `35032×3`, Longshot `35033×1`; and Storm's Hangar Bay `36035×3`.

The two included modular sets must also be selectable and use exact imported quantities:

| Set              | Catalog set ID | Physical quantities                        | Total |
| ---------------- | -------------- | ------------------------------------------ | ----: |
| Lady Deathstrike | `deathstrike`  | `35034×1`, `35035×1`, `35036×2`, `35037×2` |     6 |
| Shadow King      | `shadow_king`  | `36036×1`, `36037×1`, `36038×2`, `36039×1` |     5 |

Lady Deathstrike prints ATK 2, SCH 1 and HP 6. The Shadow King prints ATK 3, SCH 3 and HP 6. Seeking Vengeance starts at a **fixed five** threat; Ruler of the Astral Plane starts at a **fixed six**. Their quantities must not be inferred from the number of distinct faces. Possessed needs its current controlled-minion rules; the metadata registration does not alone establish those rules are implemented.

## Reprints and cross-pack integration

There are **25 imported reprint faces** in the four products:

| Printing                     | Original rules printing   |
| ---------------------------- | ------------------------- |
| `33017` Teamwork             | `06032`                   |
| `33024`, `33025`, `33026`    | `01088`, `01089`, `01090` |
| `34019` Swift Retribution    | `15014`                   |
| `34023` Psychic Rapport      | `33023`                   |
| `34024` Down Time            | `05033`                   |
| `34025`, `34026`, `34027`    | `01088`, `01089`, `01090` |
| `35015` Battle Fury          | `06018`                   |
| `35019` Mean Swing           | `06015`                   |
| `35020` Aggressive Energy    | `32047`                   |
| `35021` Colossus             | `32048`                   |
| `35024`, `35025`, `35026`    | `01088`, `01089`, `01090` |
| `36021` Effective Leadership | `33018`                   |
| `36023` The X-Jet            | `32020`                   |
| `36024` Utopia               | `33020`                   |
| `36025` X-Mansion            | `32049`                   |
| `36026` Endurance            | `05023`                   |
| `36027`, `36028`, `36029`    | `01088`, `01089`, `01090` |

The Storm pack depends on the same-batch Cyclops implementation for Effective Leadership and Utopia; Phoenix likewise depends on Psychic Rapport. These dependencies must work after the independent pack branches are combined. Their physical codes and pack ownership remain those of the actual source printing. Effective Leadership and Aggressive Energy each have a shared maximum of two across reprints. Utopia and Colossus remain unique across printings. Psychic Rapport has a shared maximum of one, including `33023` plus `34023`; adding the other printing cannot bypass that limit.

Original source decks may contain allies matching another player's identity: Cyclops's signature Phoenix `33002`, Phoenix's signature Cyclops `34003`, Phoenix's basic Storm `34021`, and Wolverine's basic Colossus `35021`. They remain in their original source lists; ordinary uniqueness rules govern whether they can enter play in a particular team. Deck selection must not silently substitute unrelated cards.

## Independent validation boundary

`tests/quadruple-import-source-contract.test.ts` pins the source hashes; exact 151-face and 234-card scope; every printed numeric, resource, trait, faction and link field; all original deck compositions and four aspect starters; mandatory and supplementary setup metadata; identity/artwork mapping; opening physical cards, ownership, obligations, nemeses and JSON preservation; both modular quantities; and cross-pack deckbuilding/copy-limit rules. Two three-player source rosters cover all four new heroes under the existing application limit.

This suite is intentionally independent of each pack's exported implementation code lists. Its initial execution against the preceding release is expected to fail where the four packs are not yet integrated. Passing source checks establishes metadata and source-composition agreement; native gameplay tests, browser acceptance, production build and deployed production checks provide the separate behavior and release evidence.
