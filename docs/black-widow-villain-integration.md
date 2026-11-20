# Agents of S.H.I.E.L.D.: Black Widow

This import adds Agents of S.H.I.E.L.D.'s first scenario, Black Widow, with the A.I.M. Abduction and A.I.M. Science sets. Yelena Belova is always one step ahead: her encounter cards carry "Preparation" abilities instead of boosts, and every attack on her draws one from the encounter deck before the attack resolves.

## Original source and scope

`src/game/black-widow-villain.ts` registers 23 original faces:

- **Black Widow (17):** Black Widow (I), (II) and (III), both sides of The Widow's Web, Black Widow's Gauntlet (2), Grappling Hook, Night Vision Goggles, Stun Net, A.I.M. Commando (2), A.I.M. Grunt (2), Automated Defenses, Destroy Evidence, Attacrobatics (2), Covert Ops (2), Dance of Death (2) and Widow's Bite (2).
- **A.I.M. Abduction (3):** A.I.M. Abductor (2), Abduct Superhumans and Nabbed! (2).
- **A.I.M. Science (3):** A.I.M. Scientist, A.I.M. Soldier (3) and Mad Science.

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Black Widow (I) and (II), Expert (II) and (III). The encounter deck holds the Black Widow and Standard sets and two modular sets, with the Expert set in Expert. A.I.M. Abduction and A.I.M. Science are preselected, and each can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** each player searches the encounter deck for a minion and puts it into play engaged with them, then the deck is shuffled.
- **The Widow's Web (1B):** 2 threat per player to start and X more per player each villain phase, X being Black Widow's stage. The players lose when it reaches 10 threat per player.
- **Black Widow (II) and (III):** when revealed, 2 or 3 threat per player on the main scheme.
- **Black Widow's Forced Interrupt:** when a hero or ally attacks her, including with attack-labelled abilities, she removes 1 threat from the main scheme, ignoring crisis icons. If no threat comes off, nothing else happens. Otherwise the attacking player discards the top card of the encounter deck and resolves each of its Preparation abilities before the attack. It resolves once per attack, and damage that does not come from an attack does not trigger it.
- **Preparation abilities:** they replace boost abilities, so they do not resolve when the card is turned faceup as a boost card.
  - **Black Widow's Gauntlet:** attaches to her; she gains retaliate 1 for each one. After an attack on her in which no Preparation resolved, the attacking player may discard it, after the retaliate.
  - **Grappling Hook:** you discard an event card from your hand. Revealed, it attaches to her, and the next event a player plays is cancelled and discarded, then so is the Hook.
  - **Night Vision Goggles:** attaches to her. Each encounter card without a printed Preparation gains one: all damage from this attack is prevented, then the Goggles are discarded.
  - **Stun Net:** after this attack, it attaches to the attacking character. Revealed, it attaches to your identity. The attached character cannot attack; any player's Hero Action exhausts a character they control to discard it.
  - **A.I.M. Commando:** quickstrike; after this attack, it enters play engaged with you.
  - **A.I.M. Grunt:** guard; it enters play engaged with you and the attack resolves against it instead.
  - **Attacrobatics:** all damage from this attack is prevented; in Expert the attacking character takes that damage. Revealed, you change to hero form if you are in alter-ego form, and she attacks you with an additional boost card.
  - **Covert Ops:** 1 threat on each scheme. Revealed, you are confused and she schemes.
  - **Dance of Death:** 1 damage to each character you control. Revealed, 1, 2 and 3 damage to three different characters you control.
  - **Widow's Bite:** after this attack, the attacking character is stunned. Revealed, you are stunned and take 1 damage, or 2 if you were already stunned.
  - **Automated Defenses:** hinder 1 per player. Each encounter card without a printed Preparation gains one: 1 damage to the attacking character.
  - **Destroy Evidence:** hinder 2 per player. Each other encounter card gains incite 1.
- **A.I.M. Abduction:**
  - **Abduct Superhumans:** surge. When an ally leaves play, it is tucked under the scheme, which gains threat equal to the ally's cost and an acceleration token. When it is defeated, each tucked ally enters play under its owner's control.
  - **A.I.M. Abductor:** when revealed, your ally with the most remaining hit points is tucked under Abduct Superhumans; with no ally, 2 threat goes on it instead. Abduct Superhumans is found and put into play first if it is not in play.
  - **Nabbed!:** Abduct Superhumans enters play if needed, then you discard cards from the top of your deck until an ally is discarded, and that ally is tucked under it with threat equal to its cost and an acceleration token.
- **A.I.M. Science:**
  - **A.I.M. Soldier:** patrol. When revealed, A.I.M. Scientist is found and enters play engaged with you, or engages you if it is in play; otherwise 1 threat goes on the main scheme.
  - **A.I.M. Scientist:** surge and vulnerable. It cannot be attacked while the player it is engaged with is engaged with another minion.
  - **Mad Science:** hinder 2 per player. Each A.I.M. minion gains an acceleration icon.

## Interface

- Mission setup explains Black Widow's Forced Interrupt and the Preparation abilities, and preselects A.I.M. Abduction and A.I.M. Science.
- The caption under Black Widow's stats says what attacking her does.
- The main scheme's one-line note gives the threat The Widow's Web gains each villain phase at her stage.
- Stun Net's Hero Action is a button on the card, and the basic attack button of an identity caught in it is disabled and says why.
- Abduct Superhumans' caption names the allies tucked under it.

## Coverage boundaries

- A Preparation that changes the attack resolves before its damage: the prevention of Attacrobatics and Night Vision Goggles, A.I.M. Grunt taking the attack, and the Gauntlet and Goggles attaching, whose retaliate then applies. The other Preparations resolve as soon as the attack ends: threat from Covert Ops, damage from Dance of Death and Automated Defenses, the Grappling Hook's discard, and the cards that act "after this attack".
- "Per player" values use the number of players who started the game.
- If Nabbed! empties your deck, your discard pile is reshuffled into a new deck as usual. Once every card has been discarded without finding an ally, the search stops.
- The S.H.I.E.L.D. campaign, its evidence and the Executive Board are not automated.
- The executable registry contains 3,302 faces, including 2,864 dedicated faces, with 1,249 imported faces still unsupported. There are 57 playable identities, forty-seven scenarios and eighty-six modular sets. The inventory pins 170 source files.

The configured source matrix contains 410,592 cases in sixteen disjoint shards of 25,662; CI runs the sixteen shards in parallel. This import adds 18,304 cases:

- 8,944 for Black Widow: 52 expansion starter identities × two difficulties × all 86 modular sets as the first of her two;
- 208 with Standard II and Expert II or with Standard III;
- 9,152 for the A.I.M. Abduction and A.I.M. Science sets in the 44 other scenarios with modular sets.

Manifest hashes retain all 392,288 previous mission names and seeds, checked against the complete grid of `d9ad0bd`.

Rules references: the Agents of S.H.I.E.L.D. rulebook (Black Widow, Preparation abilities, Hinder, Patrol, Vulnerable) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Acceleration, Guard, Incite, Quickstrike, Retaliate, Surge).
