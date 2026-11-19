# NeXt Evolution: Stryfe

This import adds NeXt Evolution's fifth and last scenario, Stryfe, with the Extreme Measures and Mutant Insurrection modular sets. Stryfe reads the players' hands. His attacks and his main scheme grow with the most common card type each player holds. Stryfe's Grasp holds Hope Summers until it turns into the Living Bomb, and then Left to Your Fate squeezes every player card.

## Original source and scope

`src/game/stryfe.ts` registers 30 original faces:

- **Stryfe (20):** Stryfe (I), (II) and (III), both sides of Uncontrollable Power, of Left to Your Fate and of Stryfe's Grasp / Living Bomb, Mental Transferal, Mind Alteration, Mind Trap, Psionic Amnesia, Psychic Inertia (2), Zero, Cerebral Erasure, Telepathic Camouflage, Psionic Surge, Psychic Override (2) and Telekinetic Wave (3).
- **Extreme Measures (5):** the minions Strobe, Tempo, Thumbelina and Wildside, and the Extreme Measures side scheme.
- **Mutant Insurrection (5):** the minions Dragoness, Forearm, Reaper and Samurai, and the Mutant Insurrection side scheme.

The scenario also uses the Hope Summers set imported with [Juggernaut](juggernaut-integration.md). The imported catalog, original source decks and artwork remain unchanged.

Standard uses Stryfe (I) and (II), Expert (II) and (III). The encounter deck holds the Stryfe, Hope Summers and Standard sets and two modular sets, with the Expert set in Expert. Extreme Measures and Mutant Insurrection are preselected and can be chosen in every other scenario with modular sets.

## Native rules

- **The most common card type:** X is the number of cards of the most common card type in a player's hand.
- **Setup (Uncontrollable Power 1A):** Hope Summers enters play under the first player's control and Stryfe's Grasp is revealed. It is a single card kept out of the encounter deck, with 4 threat and hinder 6 per player.
- **Uncontrollable Power (1B):** after step one of the villain phase, each player may discard a card from their hand, then places X threat on it. The players lose if it is completed.
- **Stryfe:** while Stryfe attacks you, he gets +X ATK.
  - **Stryfe (II):** when revealed, each player discards from the encounter deck until a Psionic attachment is discarded and reveals it.
  - **Stryfe (III):** after your identity attacks him, you take X damage.
- **Stryfe's Grasp:** permanent. Hope Summers can attack only Stryfe and thwart only this scheme. After Stryfe is defeated, or when its last threat is removed, it flips to the Living Bomb with any threat still on it.
- **Living Bomb:** 3 threat, victory 1, and Stryfe cannot be defeated while it is in play. Stryfe then stays at 0 hit points, and he is defeated once the Living Bomb is gone. Revealing it advances the main scheme to Left to Your Fate, which cannot be canceled.
- **Left to Your Fate (2B):** Stryfe is stalwart. Each identity gets +2 hand size and each player card costs 1 more. The players lose if it is completed.
- **Hope Summers:** as in Juggernaut. She does not count against the ally limit, uses her controller's hero ATK and THW, and losing her loses the game.
- **Stryfe encounter cards:**
  - **Mental Transferal:** attaches to Hope Summers while Stryfe's Grasp is in play, otherwise to your identity. After Stryfe takes damage, the attached character takes as much and the card is discarded.
  - **Mind Alteration:** after you play an event or upgrade, you take 1 damage. After you recover, you may spend a mental resource to discard it.
  - **Mind Trap:** your allies, upgrades and supports enter play exhausted. Its Alter-Ego Action exhausts 3 cards you control to discard it.
  - **Psionic Amnesia:** each ally and support you play costs 2 more. After you play one, you may exhaust your identity to discard it.
  - **Psychic Inertia:** -1 ATK and -1 THW for your hero. Its Hero Action discards it once your hero has attacked and thwarted this phase.
  - **Zero:** guard, patrol and toughness. When defeated, he is shuffled back into the encounter deck unless the player who defeated him holds 3 cards of one type.
  - **Cerebral Erasure:** when revealed, and again for its defeater when defeated, an upgrade or support you control returns to your hand.
  - **Telepathic Camouflage:** enters with X threat from each player.
  - **Psionic Surge:** discards the top X encounter cards and deals you each Psionic one facedown.
  - **Psychic Override:** you choose a card type, discard every other card from your hand, draw up to your hand size and place 1 threat for each card of that type. Its boost discards a card from your hand and draws one.
  - **Telekinetic Wave:** an upgrade or support you control returns to your hand, then Stryfe activates against you. Its boost places 3 threat with 3 cards of one type in your hand.
- **Extreme Measures:**
  - **Strobe:** patrol. When revealed, you stun each character you control or deal 1 damage to each.
  - **Tempo:** +1 hand size while engaged with you. After he activates against you, you discard twice as many cards as you hold from the top of your deck.
  - **Thumbelina:** 1 less damage from each attack unless the attacker is Tiny. When revealed, your highest-cost upgrade returns to your hand.
  - **Wildside:** when revealed, he attacks you or your highest-cost support returns to your hand.
  - **Extreme Measures:** hinder 2 per player. After a player card enters play, its controller takes indirect damage equal to its printed cost.
- **Mutant Insurrection:**
  - **Dragoness:** when she activates against you, she gets +1 SCH and ATK for each printed energy resource in your hand.
  - **Forearm:** after he attacks you, you discard a card from your deck for each printed physical resource in your hand.
  - **Reaper:** when he attacks you, 2 printed mental resources in your hand stun your identity and 4 also exhaust it.
  - **Samurai:** after he attacks you, he gains a charge counter. You then take that much damage or discard a card you control that costs at least that much.
  - **Mutant Insurrection:** assault, and each minion gains toughness. It enters with 2 more threat for each Mutant Liberation Front character in play, or surges.

## Interface

- Mission setup explains the hand reading, Stryfe's Grasp and the Living Bomb, and preselects both modular sets.
- The villain is labelled with its stage and the ATK he gains against the active player. Its caption gives that player's most common card type and the Living Bomb's protection.
- The main scheme notes the threat the active player adds after step one, or Left to Your Fate's hand size and cost.
- The Hero and Alter-Ego Actions on Psychic Inertia and Mind Trap are buttons, and Samurai shows his charge counters.

## Coverage boundaries

- Psychic Inertia counts the hero's basic attacks and thwarts.
- Mind Trap and Extreme Measures follow player cards that are played. Cards put into play by other effects are not covered.
- The campaign log is not automated.
- The executable registry contains 3,145 faces, including 2,707 dedicated faces, with 1,406 imported faces still unsupported. There are 57 playable identities, forty-one scenarios and seventy-five modular sets. The inventory pins 163 source files.

The configured source matrix contains 307,424 cases in sixteen disjoint shards of 19,214; CI runs the sixteen shards in parallel. This import adds 15,808 cases:

- 7,800 for Stryfe: 52 expansion starter identities × two difficulties × all 75 modular sets as the first of its two;
- 104 with Standard II and Expert II;
- 7,904 for Extreme Measures and Mutant Insurrection in the 38 other scenarios with modular sets.

Manifest hashes retain all 291,616 previous mission names and seeds, checked against the complete grid of `1b5971c`.

Rules references: the NeXt Evolution rulebook (Stryfe) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Assault, Guard, Hinder, Patrol, Permanent, Stalwart, Surge, Toughness, Victory).
