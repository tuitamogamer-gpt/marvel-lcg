# MojoMania: Spiral (Across the Mojoverse)

This import adds MojoMania's second scenario, Across the Mojoverse. Spiral teleports from Show to Show: while she is Escaped she cannot be hurt, so the players search the show deck for Cornered! and must defeat her Cornered side before her teleport counters carry her away again. Any three modular sets can be chosen; the rulebook uses three MojoMania genre sets, and Crime, Fantasy and Horror are preselected.

## Original source and scope

`src/game/spiral.ts` registers the Spiral set's 14 original faces on 12 physical cards: Spiral (I), (II) and (III), each with an Escaped and a Cornered side, both sides of Across the Mojoverse, The Search for Spiral, Cornered!, Spiral's Swords (2), Erratic Teleportation (2), The Show Must Go On and Well-Armed. The imported catalog, original source decks and artwork remain unchanged.

Standard uses Spiral (I) and (II), Expert Spiral (II) and (III). The encounter deck holds the Spiral and Standard sets and three modular sets, with the Expert set in Expert.

## Native rules

- **Setup:** The Search for Spiral enters play with 3 threat per player and one random Show from the modular sets enters play. The other Shows and Cornered! are shuffled into the show deck, a separate pile. Spiral starts on her Escaped side, and Across the Mojoverse starts with 1 threat per player; its threshold is 15 per player.
- **Escaped:** Spiral cannot take damage or be stunned, threat cannot be removed from the main scheme, and when she would attack she schemes instead.
- **Cornered:** Spiral can be damaged. After she activates she gains a teleport counter; at 3 per player (2 for Spiral (II)) she removes them all and flips back to her Escaped side. When she is defeated, her next stage enters play on the same side, Cornered, and her teleport counters carry over, as the rulebook says. Whenever Spiral (III) enters play or flips onto her Cornered side, she attacks each player in player order, even in alter-ego form.
- **The show deck:** when the last threat is removed from The Search for Spiral, which is permanent, the player who removed it reveals the top card of the show deck and the scheme gets 3 threat per player again. A Show revealed from the show deck discards each other Setting environment and does not surge, and while Across the Mojoverse is in play a Show that would be discarded goes to the bottom of the show deck instead. Cornered! flips Spiral to her Cornered side, reveals the next card of the show deck and is shuffled back into it; it cannot be canceled. The Search for Spiral's Hero Action deals your identity 2 damage to remove 3 threat from it.
- **Encounter cards:** Spiral's Swords attach to Spiral with 3 sword counters, +1 ATK for each; while Spiral is Cornered, a Hero Action spends two physical resources to remove one, and a Sword is discarded with its last counter. Erratic Teleportation (surge) gives a Cornered Spiral a teleport counter; while she is Escaped you may spend a mental resource to look at the top card of the show deck and leave it there or put it on the bottom. The Show Must Go On deals each player a facedown encounter card of the current Show's set. Well-Armed makes Spiral attack you, even in alter-ego form, if a Sword is attached to her, and otherwise attaches a Sword from the encounter deck or discard pile.

## Interface

- Mission setup explains how to corner Spiral and preselects Crime, Fantasy and Horror.
- Spiral is labelled with her stage and side, ESCAPED or CORNERED; Escaped lists what she ignores, Cornered counts her teleport counters against the number that flips her.
- The Search for Spiral notes that it is permanent and how many cards the show deck holds, with its Hero Action as a button. The current Show sits with the environments.
- Spiral's Swords show their sword counters and ATK bonus, with their Hero Action as a button while Spiral is Cornered.
- The objective reads "Corner Spiral · defeat stage II", or stage III in Expert.

## Coverage boundaries

- With non-MojoMania modular sets the show deck holds only Cornered!; revealing it still flips Spiral and returns it to the show deck.
- Cards revealed from the show deck do not pass through the encounter reveal window, so player cards cannot cancel them; Cornered! cannot be canceled anyway.
- The show deck has no discard pile and player cards cannot affect it.
- The executable registry contains 2,986 faces, including 2,548 dedicated faces, with 1,565 imported faces still unsupported. There are 57 playable identities, thirty-five scenarios and sixty-eight modular sets. The inventory pins 157 source files.

The configured source matrix contains 236,080 cases in sixteen disjoint shards of 14,755; CI runs the sixteen shards in parallel. This import adds 7,176 cases: 7,072 for Spiral (52 expansion starter identities × two difficulties × all 68 modular sets as the first of her three) and 104 with Standard II and Expert II. Manifest hashes retain all 228,904 previous mission names and seeds, checked against the complete grid of `deb8ed9`.

Rules references: Across the Mojoverse and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Boost, Environment, Permanent, Surge, Uses).
