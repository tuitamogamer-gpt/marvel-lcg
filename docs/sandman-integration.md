# Sinister Motives: Sandman, City in Chaos and Down to Earth

This import adds the first scenario of the Sinister Motives campaign expansion: Sandman, with the City in Chaos encounter set that the scenario always uses and its recommended modular set, Down to Earth. City in Chaos and Down to Earth can also be chosen as the modular set of every other scenario that uses modular sets.

## Original source and scope

`src/game/sandman.ts` registers 22 original faces on 26 physical cards. The Sandman set has 13 faces: Sandman (I), (II) and (III), both sides of Hapless Pedestrians, City Streets, Sand Form (2), Sand Clone (4), Dirt Trap (2), Tidal Sands, Sandslide, Sand Storm and Sand Smash (2), fourteen encounter cards in all. City in Chaos has Panic in the Streets, Rhino, Calling in Favors and Now or Never (2), five cards. Down to Earth has Common Criminal (3), Friends and Family, Volunteer Work, "Threat or Menace?" and Loose Ends, seven cards. The imported catalog, original source decks and artwork remain unchanged.

Standard uses Sandman (I) and (II), Expert Sandman (II) and (III), as Hapless Pedestrians states. The encounter deck holds the Sandman, City in Chaos and Standard sets and one modular set, Down to Earth unless another is chosen.

## Native rules

- **Setup (Hapless Pedestrians 1A):** City Streets is taken from the encounter deck and put into play with 4 sand counters. Hapless Pedestrians (1B) starts with 2 threat per player, gains 1 per player each villain phase and completes at 9 per player, when the players lose. After an acceleration token is placed on it, the first player takes 3 indirect damage, once for each token.
- **Surging Sands:** City Streets gets 1 sand counter, then the encounter deck is discarded from the top by as many cards as City Streets has sand counters. An encounter deck that runs out is reshuffled and places an acceleration token as usual. City Streets' Hero Action exhausts a character you control to remove sand counters equal to its ATK, once per round per player.
- **The villain:** Sandman (I) and (II)'s attacks deal indirect damage (Sand Blast); Sandman (III)'s attacks gain overkill (Sand Wave). When such an attack damages your identity, Surging Sands resolves. Sandman (II) resolves Surging Sands when revealed, also at Expert setup; Sandman (III) places 1 sand counter and then resolves it. Defeating the last stage wins.
- **Sandman encounter cards:** Sand Form attaches to Sandman; damage a player would deal to him discards it instead and resolves Surging Sands. As a boost it is revealed and attaches. Sand Clone's ATK is the number of sand counters on City Streets, and it resolves Surging Sands when defeated. Dirt Trap resolves Surging Sands twice when defeated. Tidal Sands enters with additional threat equal to the sand counters. Sandslide places 2 sand counters and resolves Surging Sands, stunning you if at least one Sandman card was discarded (also as a boost). Sand Storm deals indirect damage equal to the sand counters, which the revealing player divides among the players; with no sand counters it places 3 and shuffles itself back into the encounter deck. Sand Smash makes Sandman attack you with +1 ATK in hero form; in alter-ego form it resolves Surging Sands and gains surge.
- **City in Chaos:** Panic in the Streets treats the printed text box of each Location and Persona support as blank, except for traits. Rhino (steady) attacks with overkill and piercing. Calling in Favors makes Rhino scheme with +2 SCH; if he is not in play, it puts him into play engaged with you from the encounter deck or discard pile and shuffles the encounter deck. Now or Never (peril) places an acceleration token on the main scheme, or you exhaust a character you control and spend 1 resource; without a ready character or a resource the token is placed.
- **Down to Earth:** Common Criminal (surge) has an Alter-Ego Action that spends a physical resource to deal 3 damage to it; if that defeats it, you draw 1 card or remove 3 threat from a side scheme. Friends and Family stays in play in front of its player: in hero form each event they play costs 1 more, and an Alter-Ego Action discards an identity-specific card from their hand to discard it. Volunteer Work cannot be thwarted; its Alter-Ego Action spends 2 resources to remove threat equal to your REC and draws a card if your identity has the Civilian trait. "Threat or Menace?" lets you change form; then in hero form 2 threat is placed on the main scheme, and in alter-ego form you cannot change form during your next turn. Loose Ends finds a copy of your obligation in the encounter deck, its discard pile, the set-aside area or the removed-from-game area and reveals it; if you change to alter-ego form during that reveal, you discard a random card from your hand. Without an obligation to reveal, Loose Ends gains surge.

## Interface

- Mission setup notes that City in Chaos is always included and preselects Down to Earth as Sandman's modular set; City in Chaos is not offered as his modular choice.
- City Streets shows its sand counters and the Hero Action that removes them. Common Criminal's Alter-Ego Action appears on the minion, Friends and Family's in its player's play area and Volunteer Work's on the side scheme.
- Environment counters appear only on environments that use them. The Hood pack's Settings and Formidable Foe no longer show a "0 Madness" counter.
- A villain's name now shrinks before it would break inside a word. "SANDMAN" broke into "SANDMA / N" beside the villain card at desktop width.

## Coverage boundaries

- Peril is not enforced: other players may still respond while a player resolves Now or Never.
- Panic in the Streets blanks supports whose printed traits include Location or Persona; it does not affect upgrades or allies with those traits.
- "Threat or Menace?" is tracked for the player who revealed it, through the end of their next turn; revealed during their own turn, it lasts through the following one as well.
- Removing threat from Volunteer Work or with Common Criminal's reward is not a thwart, so effects that respond to thwarting do not trigger.
- The executable registry contains 2,813 faces, including 2,375 dedicated faces, with 1,738 imported faces still unsupported. There are 57 playable identities, twenty-nine scenarios and fifty-four modular sets. The inventory pins 148 source files.

The configured source matrix contains 159,640 cases in sixteen disjoint shards of 9,977 or 9,978; CI runs the sixteen shards in parallel. This import adds 11,232 cases: 5,512 for Sandman (52 expansion starter identities × two difficulties × his 53 selectable modular sets), 104 for Sandman with Standard II and Expert II, and 5,616 for City in Chaos and Down to Earth in the 27 other scenarios with modular sets. Manifest hashes retain all 148,408 previous mission names and seeds, checked against the complete grid of `a97d297`.

Rules references: Hapless Pedestrians and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Indirect Damage, Overkill, Piercing, Peril, Surge, Steady, Acceleration Token, Blank, Obligation).
