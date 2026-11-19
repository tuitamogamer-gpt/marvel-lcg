# MojoMania: Mojo and Longshot

This import adds MojoMania's third and last scenario, MojoMania itself, and the one-card Longshot modular set. Mojo puts threat on the heroes' identities and allies, and it floods the main scheme when they flip or leave play. His Wheel of Genres brings another set-aside modular set into the encounter deck each time the deck resets, until none is left. With this import every one of the box's 81 faces is executable.

## Original source and scope

`src/game/mojo.ts` registers the Mojo set's 15 original faces on 16 physical cards: Mojo (I), (II) and (III), both sides of MojoMania, both sides of the Wheel of Genres, Major Domo, Stinger Tail, Supporting Actor (2), Paparazzi, Undercover Mojo, Curtain Call (2), Director's Directions (2) and Top Billing. It also registers Longshot, a one-card modular set. The imported catalog, original source decks and artwork remain unchanged.

Standard uses Mojo (I) and (II), Expert Mojo (II) and (III). The encounter deck holds the Mojo and Standard sets, with the Expert set in Expert. The rulebook sets aside one MojoMania modular set plus one per player, so the mission setup asks for that many sets. It preselects the six genre sets in order (Crime, Fantasy, Horror, Sci-Fi, Sitcom, Western) and picks again when the team size changes.

## Native rules

- **Setup:** MojoMania (1A) sets the chosen modular sets aside and puts the Wheel of Genres into play on its Spinning side. MojoMania (1B)'s When Revealed brings one set-aside set in at random: its Show enters play and its other cards are shuffled into the encounter deck. The main scheme starts with 10 threat per player and its threshold is 25 per player.
- **Threat on characters:** after each player's turn, if that player is in hero form, Mojo discards the top 3 encounter cards (4 for Mojo (II), 5 for Mojo (III)). That hero gets 1 threat for each card discarded from outside the Mojo set. Mojo (II) and (III) put 2 and 3 threat on each identity and ally when they enter play, including Mojo (II) at the start of an Expert game. MojoMania's Forced Interrupt moves all threat from a character to the main scheme when it flips or leaves play. That covers an identity changing form, an ally or minion leaving play, and the identity of a defeated hero.
- **The Wheel of Genres:** Spinning, it stops after the encounter deck resets, or the players lose if no set-aside set remains. Stopped, at the start of step three of the villain phase it reveals a random set-aside set's Show, which discards the other Setting environments and does not surge. The rest of that set is shuffled and placed on top of the encounter deck, the first player is dealt 2 facedown encounter cards, and the Wheel spins again.
- **Encounter cards:**
  - **Major Domo:** +1 ATK and SCH. After Mojo attacks, it discards as many encounter cards as that attack dealt damage. Its Hero Action spends an energy, a mental and a physical resource to discard it.
  - **Stinger Tail:** +1 ATK and retaliate 2. Damage that would be dealt to Mojo is placed on it instead, and it is discarded at 5. Its boost attaches it.
  - **Supporting Actor:** puts 2 threat on itself after it activates against you. Its boost puts 1 threat on each character you control.
  - **Paparazzi:** a Hinder 10 obligation that stays in your play area. Its Action exhausts a character you control or discards a card from your hand to remove 2 threat (3 in alter-ego form). When your turn ends, its threat moves to the main scheme and it is discarded.
  - **Undercover Mojo:** enters with a fixed 2 threat plus Hinder 2 per player. Damage Mojo would take removes that much threat from it instead.
  - **Curtain Call:** moves all threat from the character with the most threat to the main scheme. Minions count, and the player chooses among tied characters. If no threat moves, you put 1 threat on each character you control. Its boost reveals it.
  - **Director's Directions:** choose to spend two resources of different types, to let Mojo scheme, or to take 1 damage for each threat on your identity. Taking less than 2 damage gives it surge.
  - **Top Billing:** heals 1 damage from each character you control, then puts 2 threat on each. Its boost puts 1 threat on each.
- **Longshot:** selectable as a modular set in every scenario that uses them. When revealed he enters play under your control and gains surge, and that cannot be canceled. He does not count against your ally limit and his attacks gain piercing. As a boost card he has no boost icons. When he leaves play he goes to the encounter discard pile.

## Interface

- Mission setup explains the set-aside sets and the Wheel of Genres, and asks for one modular set plus one per hero.
- Mojo's caption says how many encounter cards he discards after each turn in hero form.
- Threat on an identity shows as a THREAT token on its play area, with a note that it moves when the identity flips. Each hero in the team strip shows their identity's threat. An ally's threat sits on a token at the card's lower left, and a minion's threat is noted beneath it.
- The Wheel of Genres is labelled SPINNING or STOPPED. Spinning, it counts the set-aside sets and says what the next reset does; Stopped, it says that it brings in a set at the next villain phase.
- Paparazzi shows its threat and its Action buttons, Stinger Tail its damage out of 5 and Major Domo its Hero Action. Undercover Mojo notes that damage to Mojo removes threat from it instead.

## Coverage boundaries

- With non-MojoMania modular sets, a set brought in without a Show is shuffled in or placed on top of the deck as it is.
- Cards brought in by the Wheel are revealed or dealt without an encounter reveal window for the Show itself, so player cards cannot cancel that Show.
- Threat on characters is a MojoMania counter. Player cards that remove threat from schemes cannot remove it.
- With both Stinger Tail and Undercover Mojo in play, damage that would be dealt to Mojo goes onto Stinger Tail first; the players do not choose the order of the two interrupts.
- The executable registry contains 3,002 faces, including 2,564 dedicated faces, with 1,549 imported faces still unsupported. There are 57 playable identities, thirty-six scenarios and sixty-nine modular sets. The inventory pins 158 source files.

The configured source matrix contains 246,792 cases in sixteen disjoint shards of 15,424 or 15,425; CI runs the sixteen shards in parallel. This import adds 10,712 cases. Mojo has 7,176 (52 expansion starter identities × two difficulties × all 69 modular sets as the first of his sets) and 104 with Standard II and Expert II. Longshot adds 3,432 (52 identities × two difficulties in each of the 33 other scenarios with modular sets). Manifest hashes retain all 236,080 previous mission names and seeds, checked against the complete grid of `d80558d`.

Rules references: MojoMania and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Boost, Environment, Hinder, Piercing, Surge).
