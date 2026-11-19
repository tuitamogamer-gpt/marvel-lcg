# Age of Apocalypse: Four Horsemen

This import adds Age of Apocalypse's second scenario, Four Horsemen, with the Hounds modular set. War, Famine, Pestilence and Death ride together: only the Horseman with the active counter activates, the counter moves on after every villain activation, and none of them falls while another still has hit points.

## Original source and scope

`src/game/four-horsemen.ts` registers 25 original faces:

- **Four Horsemen (21):** both sides of War, Famine, Pestilence and Death, both sides of The Horsemen of Apocalypse, The Ravages of War, A Time of Famine, Plague and Pestilence, The Specter of Death, Golden Horse (3), Metal Wings, Horseman of War, Horseman of Famine, Horseman of Pestilence, Horseman of Death and Rough Riders (3).
- **Hounds (4):** Ahab, Hound (4), Ahab's Energy Spear and Release the Hounds.

The imported catalog, original source decks and artwork remain unchanged.

Standard uses each Horseman's side A, Expert side B. The encounter deck holds the Four Horsemen and Standard sets and two modular sets, with the Expert set in Expert. Dystopian Nightmare and Hounds are preselected, and Hounds can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** the four Horsemen are shuffled and enter play in a row, each with its printed hit points per player. The leftmost has the active counter. Each player reveals a random Four Horsemen side scheme from the encounter deck.
- **The Horsemen of Apocalypse (1B):** after a villain activates, the active counter moves to the next villain, from the rightmost back to the leftmost. The players lose if it is completed.
- **The active villain:** only the Horseman with the active counter activates in the villain phase, and encounter cards that refer to the villain refer to him. The players can attack any Horseman.
- **Defeat:** a Horseman cannot be defeated while another villain has at least 1 hit point, so he stays at 0. The players win when no Horseman has any.
- **Forced Responses:** after a Horseman attacks you, if he has at least 1 hit point:
  - **War:** you discard an upgrade or support you control.
  - **Famine:** you discard the top 10 cards of your deck.
  - **Pestilence:** your identity's text box is blank, except for its traits, until the next villain phase begins.
  - **Death:** each character you control takes 1 damage.
- **Four Horsemen encounter cards:**
  - **The four side schemes:** the player who defeats one suffers its Horseman's Forced Response.
  - **Golden Horse:** attaches to the villain with the fewest hit points without the Aerial trait, the player choosing among ties. He gains Aerial and counts as having at least 1 hit point.
  - **Metal Wings:** attaches to Death, who takes the active counter, gains retaliate 1 and counts as having at least 1 hit point.
  - **Both mounts:** after you attack the villain carrying one, a Hero Response resolves his Forced Response as if he had just attacked you to discard it.
  - **Horseman of War, Famine, Pestilence and Death:** that Horseman heals 2 damage, gets a tough status card and activates against you. As a boost, he activates against you after the activation, without a boost card.
  - **Rough Riders:** the active villain's Forced Response resolves as if he had attacked you, then the counter moves on and the next Horseman's resolves the same way.
- **Hounds:**
  - **Ahab:** toughness. When revealed, Release the Hounds gains 3 threat, or it is found and revealed.
  - **Hound:** guard. When revealed, he attacks you in hero form; otherwise you change to hero form.
  - **Ahab's Energy Spear:** attaches to Ahab, otherwise to the villain. The attached enemy's attack gains overkill and piercing, and the Spear is discarded at the end of that attack.
  - **Release the Hounds:** the first Hound revealed each phase gains surge. The player who defeats it deals themself a Hound from the encounter deck or discard pile, facedown.

## Interface

- Mission setup explains the active counter and the Horsemen's defeat rule, and preselects Dystopian Nightmare and Hounds.
- The four Horsemen sit in their row with hit points, ATK, SCH and status cards. The active one is marked, and each one at 0 hit points says he falls once all four are at 0.
- The objective counts the Horsemen at 0, and the main scheme names the active Horseman.

## Coverage boundaries

- Player cards that refer to "the villain" without attacking affect the Horseman in focus, normally the active one.
- The campaign log is not automated.
- The executable registry contains 3,187 faces, including 2,749 dedicated faces, with 1,364 imported faces still unsupported. There are 57 playable identities, forty-three scenarios and seventy-eight modular sets. The inventory pins 165 source files.

The configured source matrix contains 335,920 cases in sixteen disjoint shards of 20,995; CI runs the sixteen shards in parallel. This import adds 12,376 cases:

- 8,112 for Four Horsemen: 52 expansion starter identities × two difficulties × all 78 modular sets as the first of their two;
- 104 with Standard II and Expert II;
- 4,160 for Hounds in the 40 other scenarios with modular sets.

Manifest hashes retain all 323,544 previous mission names and seeds, checked against the complete grid of `cf2fe78`.

Rules references: the Age of Apocalypse rulebook (Four Horsemen: multiple villains, the active villain and adjustable difficulty) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Guard, Overkill, Piercing, Retaliate, Surge, Toughness).
