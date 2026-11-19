# Sinister Motives: Venom and Symbiotic Strength

This import adds the second scenario of the Sinister Motives campaign expansion: Venom, with the Symbiotic Strength encounter set that the scenario always uses. Its recommended modular set is Down to Earth, imported with Sandman. Symbiotic Strength can also be chosen as the modular set of every other scenario that uses modular sets.

## Original source and scope

`src/game/venom-villain.ts` registers 19 original faces on 25 physical cards. The scenario module is separate from `src/game/venom.ts`, which holds the Venom hero (Flash Thompson). The Venom set has 13 faces: Venom (I), (II) and (III), both sides of "Leave Us Alone!", both sides of the Bell Tower, "Now We're Angry!" (2), Guard the Bell Tower, Lashing Out, Tooth and Nail, Biting Retort (2) and For Whom the Bell Tolls (2), ten encounter cards in all. Symbiotic Strength has Improvised Weapons, Violent Tendencies, Webbed Up, Enraged Symbiote (3), Swinging Assault (2) and Unstable Sentience, nine cards. The imported catalog, original source decks and artwork remain unchanged.

Standard uses Venom (I) and (II), Expert Venom (II) and (III), as "Leave Us Alone!" states. The encounter deck holds the Venom, Symbiotic Strength and Standard sets and one modular set, Down to Earth unless another is chosen.

## Native rules

- **Setup ("Leave Us Alone!" 1A):** the Bell Tower is taken from the encounter deck and put into play, Quiet side faceup. "Leave Us Alone!" (1B) starts with 2 threat per player, gains 1 per player each villain phase and completes at 10 per player, when the players lose.
- **Facedown boost cards:** Venom (I) and (II)'s Vengeance places 1 facedown boost card, the top card of the encounter deck, on your identity after you or an ally you control attacks and damages him; Venom (III)'s Retribution places 2 for the first attack against him in a turn and 1 for each later one. Venom (III) places 2 on each identity when revealed. When Venom activates against you, "Leave Us Alone!" moves every facedown boost card on your identity to him as boost cards for that activation. Venom (II) puts Tooth and Nail into play from the encounter deck or discard pile when revealed, also at Expert setup. Every Venom has toughness; (II) and (III) are steady and (III) has retaliate 1.
- **The Bell Tower:** on its Quiet side, when an attack would damage Venom, the attacking player may place that many chime counters on the Bell Tower instead; at 3 chime counters per player it flips to its Ringing side. Ringing, Venom takes 1 more damage from everything, and when his attack would damage an identity, chime counters are removed to prevent 1 damage each; with no chime counters left it flips back to Quiet.
- **Venom encounter cards:** "Now We're Angry!" attaches to Venom with 2 rage counters, gives him +1 ATK and overkill, and loses a counter each time an attack damages him, leaving with the last; as a boost it is revealed and attaches. Guard the Bell Tower removes every chime counter, turns the Bell Tower Quiet and blanks its text while in play. Lashing Out and Tooth and Nail lose threat equal to the damage an attack deals to Venom; as boosts Lashing Out deals you 2 indirect damage and Tooth and Nail gives the attack piercing. Biting Retort makes Venom activate against you with +1 boost icon on each of that activation's boost cards, and as a boost removes a chime counter. For Whom the Bell Tolls removes 2 chime counters, then deals you 1 damage if the Bell Tower is Quiet or removes 1 threat from the main scheme if it is Ringing (also as a boost).
- **Symbiotic Strength:** Improvised Weapons attaches to the villain and adds its amplify icon; a Hero Action spending a mental, a physical and an energy resource discards it. Violent Tendencies attaches to the villain and gives him a facedown boost card for his next activation each time an attack damages him, leaving after an attack that deals 3 or more. Webbed Up attaches to your identity: when your hero would attack, it is discarded instead and you are stunned; as a boost you are stunned, or take 2 damage if already stunned. Enraged Symbiote (guard, patrol) enters play engaged with you as a boost. Swinging Assault changes an alter-ego to hero form before the villain attacks, and gives the villain an additional boost card against a hero. Unstable Sentience (surge) gives the villain a facedown boost card for his next activation; as a boost it adds 2 boost icons and overkill to an attack.

## Interface

- Mission setup notes that Symbiotic Strength is always included and preselects Down to Earth as Venom's modular set; Symbiotic Strength is not offered as his modular choice.
- The Bell Tower shows its chime counters and a caption for its current side: on the Quiet side, when it rings; on the Ringing side, what it does. An attack that could place chime counters asks "Place N chime counters instead" or "Deal the damage to Venom".
- The identity panel counts the facedown boost cards on it and says they join Venom's next activation against you.
- Improvised Weapons' Hero Action appears in Venom's attachment row.

## Coverage boundaries

- The Bell Tower's choice is offered for any attack that would damage Venom while it is Quiet, with the attack's damage before toughness; choosing chime counters means Venom takes no damage from that attack.
- Lashing Out's and Tooth and Nail's responses, which only benefit the players, resolve automatically.
- Retribution counts every attack against Venom in the current turn, whether or not it damaged him.
- Peril and other keywords on cards outside this import keep their earlier coverage.
- The executable registry contains 2,832 faces, including 2,394 dedicated faces, with 1,719 imported faces still unsupported. There are 57 playable identities, thirty scenarios and fifty-five modular sets. The inventory pins 149 source files.

The configured source matrix contains 168,272 cases in sixteen disjoint shards of 10,517; CI runs the sixteen shards in parallel. This import adds 8,632 cases: 5,616 for Venom (52 expansion starter identities × two difficulties × his 54 selectable modular sets), 104 for Venom with Standard II and Expert II, and 2,912 for Symbiotic Strength in the 28 other scenarios with modular sets. Manifest hashes retain all 159,640 previous mission names and seeds, checked against the complete grid of `18bbd63`.

Rules references: "Leave Us Alone!" and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Boost, Toughness, Steady, Retaliate, Overkill, Piercing, Guard, Patrol, Surge, Uses, Amplify, Blank).
