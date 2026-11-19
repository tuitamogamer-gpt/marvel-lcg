# MojoMania: MaGog (Melee in the Mojo-seum)

This import adds MojoMania's first scenario, Melee in the Mojo-seum. MaGog cannot be defeated: the players win only by wowing the crowd as The Challengers before The Champion's fans see MaGog win again. Any modular set can be chosen; the rulebook adds one random MojoMania genre set, and Crime is preselected.

## Original source and scope

`src/game/magog.ts` registers the MaGog set's 15 original faces on 12 physical cards: MaGog (A) and (B), both sides of Melee in the Mojo-seum, both sides of The Champion and of The Challengers, Jolt of Adrenaline, Surge of Aggression, Surprise Contender, Pump Up the Crowd, Break a Leg, Defend the Title (2) and Stage Fright, eight encounter cards in all. The imported catalog, original source decks and artwork remain unchanged.

Standard uses MaGog (A), Expert MaGog (B). The encounter deck holds the MaGog and Standard sets and one modular set, with the Expert set in Expert.

## Native rules

- **Setup:** The Champion and The Challengers enter play with their Booing Crowd sides faceup and no ratings counters. Melee in the Mojo-seum starts with 1 threat per player; its threshold is 6 per player.
- **The crowds:** a crowd flips to its Cheering Crowd side, keeping its ratings counters, as soon as it holds 5 ratings counters per player. When The Champion flips, each player draws 1 card; when The Challengers flip, Surprise Contender is found in the encounter deck or discard pile and enters play engaged with the first player, or gains a tough status if it is already in play. At 10 ratings counters per player on its Cheering side, The Challengers win the game for the players and The Champion loses it.
- **MaGog:** when he would be defeated, his hit points reset to 10 per player instead, The Challengers gain 3 ratings counters per player (2 with MaGog (B)) and each player is dealt 1 facedown encounter card. After he attacks and damages a character, The Champion gains 1 ratings counter (2 with MaGog (B)).
- **Melee in the Mojo-seum:** the players cannot win unless they wow the crowd as The Challengers. When it would be completed, The Champion gains 2 ratings counters per player and all of its threat is removed instead.
- **Encounter cards:** Jolt of Adrenaline (retaliate 1 and stalwart) and Surge of Aggression (+1 ATK and +1 SCH) attach to MaGog; after his hit points reset, each puts 1 ratings counter per player on The Challengers and is discarded, and as a boost each is revealed. Surprise Contender is villainous; after it attacks and damages a character The Champion gains 1 ratings counter, and when it is defeated The Challengers gain 2 per player. Pump Up the Crowd gains 1 more threat per player while The Champion is cheering, and its defeat puts 1 ratings counter per player on The Challengers. Break a Leg stuns you and deals you 2 damage, 4 while The Challengers have more ratings counters than The Champion; you may put ratings counters on The Champion to reduce that damage by 1 each. Defend the Title puts 2 ratings counters on The Champion against an alter-ego; against a hero MaGog attacks, and a hero who defends and takes no damage puts 2 on The Challengers. Stage Fright confuses you and places 2 threat on the main scheme, 4 while The Challengers lead; as a boost it confuses you.

## Interface

- Mission setup explains the ratings war and that Crime is preselected as the random genre set.
- MaGog is labelled with his side, A or B, and notes that he resets instead of being defeated.
- The scheme row shows a Ratings war panel with both crowds together: each crowd's side, ratings counters, a meter toward 10 per player with its flip marked half way, and when it flips, wins or loses. On the narrowest phones the panel moves below the main scheme.
- The objectives count The Challengers' and The Champion's ratings counters out of 10 per player, and the main scheme notes what its completion gives The Champion.

## Coverage boundaries

- No card in the engine blanks a villain's text box. If one did, MaGog would not reset; the players still could not win by defeating him, so he would stay in play with 0 hit points.
- "After MaGog's hit points are reset" follows his Forced Interrupt only. Jolt of Adrenaline and Surge of Aggression with blank text boxes grant nothing and stay attached.
- Defend the Title's attack counts as defended without damage when a hero, not an ally, defends and the hero's identity takes no damage.
- The executable registry contains 2,972 faces, including 2,534 dedicated faces, with 1,579 imported faces still unsupported. There are 57 playable identities, thirty-four scenarios and sixty-eight modular sets. The inventory pins 156 source files.

The configured source matrix contains 228,904 cases in sixteen disjoint shards of 14,306 or 14,307; CI runs the sixteen shards in parallel. This import adds 7,176 cases: 7,072 for MaGog (52 expansion starter identities × two difficulties × all 68 modular sets) and 104 with Standard II and Expert II. Manifest hashes retain all 221,728 previous mission names and seeds, checked against the complete grid of `ae73f23`.

Rules references: Melee in the Mojo-seum and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Boost, Confused, Environment, Retaliate, Stalwart, Stunned, Tough, Villainous).
