# Agents of S.H.I.E.L.D.: Baron Zemo

This import adds Agents of S.H.I.E.L.D.'s fifth scenario, Baron Zemo, with the S.H.I.E.L.D. modular set, the S.H.I.E.L.D. Executive Board set and the nine evidence cards. A mole on the S.H.I.E.L.D. Executive Board works for A.I.M.: the players gather evidence to find out who it is while Baron Zemo turns the board members against them, then make their accusation and defeat Zemo unmasked.

## Original source and scope

`src/game/baron-zemo.ts` registers 39 original faces:

- **Baron Zemo (18):** both sides of Baron Zemo (A1/A2) and (B1/B2), of Zemo's Manipulations, of The Accusation and of Fighting Zemo, Baron Zemo's Sword, Reluctant Foe, S.H.I.E.L.D. Agent (2), Divided Loyalties, Undermine Support, Battle of Wits (2), Might Makes Right (2) and The Ends Justify the Means (2).
- **S.H.I.E.L.D. (3):** S.H.I.E.L.D. Trooper (3), Arrest Warrant and Disavowed.
- **S.H.I.E.L.D. Executive Board (9):** both sides of Chief Medical Officer, Chief Surveillance Officer and Chief Tactical Officer, and the three A.I.M. Interference.
- **Executive Board Evidence (9):** Medical Records, Wiretap, Security Scanner, Money, Blackmail, Ideology, Security Clearance, Travel and Authority.

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Baron Zemo (A1), Expert Baron Zemo (B1). The encounter deck holds the Baron Zemo, S.H.I.E.L.D. Executive Board and Standard sets and two modular sets, with the Expert set in Expert. Scientist Supreme and S.H.I.E.L.D. are preselected, and S.H.I.E.L.D. can be chosen in every other scenario with modular sets. The S.H.I.E.L.D. Executive Board can be added to any other scenario with modular sets without counting as one.

## Native rules

- **Setup (1A):** the evidence is prepared: one random means, motive and opportunity go into the A.I.M. envelope, and the other six, shuffled, into the S.H.I.E.L.D. envelope. Each board member enters play with 2 secret counters.
- **Baron Zemo:** 12 hit points (A1) or 16 (B1), without a per-player icon. Masked, when he would be defeated his hit points reset instead and 3 secret counters come off the board members. Unmasked (A2/B2), he has 18 hit points per player, and when he activates against you he places 1 secret counter (2 in Expert) on a board member or gets an additional boost card; B2 is steady. Defeating him unmasked wins.
- **Zemo's Manipulations (1B):** 2 threat per player to start. After the player phase ends, the first player may place 2 secret counters on a board member without any to gain 2 evidence cards from the S.H.I.E.L.D. envelope, crossing out each combination that uses their icons, and the players may advance to make their accusation. Completing it loses.
- **The Accusation (2A/2B):** the players guess a means, a motive and an opportunity among the combinations not crossed out; the board member listed with them is the accused. The A.I.M. envelope names the mole: for each wrong guess, a secret counter goes on each board member, and 3 more go on a wrongly accused one.
- **Fighting Zemo (3A/3B):** Baron Zemo is unmasked with his printed hit points and his Sword attaches to him; the mole joins him, and 1 threat per player goes on the main scheme for each secret counter on the board members at his side. Completing it loses.
- **The board members:** with 4 secret counters (3 in Expert) a board member joins the villain, attached with its counters; with all three at his side, the players lose. Each Hero Action spends its two resources (energy, mental or physical) to remove a secret counter, then heals 1 damage from a friendly character, removes 2 threat from a scheme or deals 2 damage to an enemy. At the villain's side, Medical Officer's Aid gives +1 ATK and, after a secret counter goes on it, heals 2 damage from the villain or deals 1 damage to the friendly character with the fewest remaining hit points; Surveillance Officer's Aid gives +1 SCH and places 2 threat on the main scheme; Tactical Officer's Aid gives +1 ATK and deals 2 damage to a friendly character.
- **Baron Zemo's Sword:** +2 ATK. After he attacks and defeats a character, a secret counter goes on the board member with the fewest. Its Hero Action spends 3 physical or 3 energy resources to remove a secret counter and discard it.
- **Reluctant Foe:** a hero from the players' collection whose title matches no character in play enters play engaged with you as an Elite, villainous minion with its printed hit points and ATK and its THW as SCH; when defeated, the hero and Reluctant Foe are removed from the game.
- **S.H.I.E.L.D. Agent:** quickstrike and vulnerable; when it activates or is defeated, a secret counter goes on the board member with the fewest.
- **Divided Loyalties and Undermine Support:** hinder 1 per player. Attacking, thwarting or defending with an ally costs 1 more resource while Divided Loyalties is in play, and readying a support costs 1 resource while Undermine Support is. When either is defeated, 1 secret counter per player comes off.
- **Battle of Wits:** Baron Zemo schemes, and before the threat lands on the main scheme you may spend mental resources one at a time, each preventing 1 threat and removing 1 secret counter.
- **Might Makes Right:** in alter-ego form, 2 secret counters go on the board member with the fewest; in hero form, Baron Zemo attacks you, and if no character takes damage, 3 secret counters come off.
- **The Ends Justify the Means:** Baron Zemo defeats the minion with the fewest remaining hit points and schemes, or you discard an ally or support to remove secret counters equal to its printed cost.
- **A.I.M. Interference:** incite 1; a secret counter goes on each board member, and each resource of its type spent prevents one. As a boost it does the same.
- **S.H.I.E.L.D.:** S.H.I.E.L.D. Trooper has patrol and vulnerable; when defeated, the engaged player discards a S.H.I.E.L.D. ally or support, or 2 threat goes on the main scheme. Arrest Warrant stays in your play area; its Alter-Ego Action exhausts your identity or a S.H.I.E.L.D. card to reveal a S.H.I.E.L.D. minion from the encounter deck or discard pile, and discards it. Disavowed raises the cost of each S.H.I.E.L.D. card by 1 and enters with 1 threat for each S.H.I.E.L.D. card in play.

## Interface

- Mission setup explains the scenario and preselects Scientist Supreme and S.H.I.E.L.D.; every other scenario with modular sets offers an Executive Board setting, Off or Added.
- The objective reads "Expose the mole · N combinations left · M suspects", then "Defeat Baron Zemo, unmasked". His label shows his side, A1, B1, A2 or B2, and when he is unmasked; his caption gives his reset or his interrupt.
- The main scheme's note lists the evidence gained and the cards left in the S.H.I.E.L.D. envelope, and on Fighting Zemo that completing it loses.
- Each board member is labelled and captioned with its secret counters, the count at which it joins the villain and, during Zemo's Manipulations, the combinations that still implicate it; its Hero Action is a button. The board members at the villain's side are listed among his attachments with their counters, and Baron Zemo's Sword offers its Hero Action.

## Coverage boundaries

- "Per player" values use the number of players who started the game.
- The evidence cards' Setup abilities apply only in campaign mode, and the S.H.I.E.L.D. campaign is not automated.
- The players choose among ties for the board member with the fewest secret counters and the minion with the fewest remaining hit points, and they choose for Medical Officer's Aid.
- Undermine Support's cost applies in the ready step at the end of the player phase; card abilities that ready a support ignore it. Divided Loyalties' cost is paid as an ally's attack or thwart resolves, after its target is chosen.
- Several secret counters placed at once on a board member at the villain's side trigger its Forced Response once.
- In scenarios with more than one villain, the board members at the villain's side stay with whichever villain is in play.
- Reluctant Foe's hero is removed from the game even when its text is blank.
- The executable registry contains 3,434 faces, including 2,996 dedicated faces, with 1,117 imported faces still unsupported. There are 57 playable identities, fifty-one scenarios and ninety-five modular sets. The inventory pins 174 source files.

The configured source matrix contains 488,800 cases in sixteen disjoint shards of 30,550; CI runs the sixteen shards in parallel. This import adds 19,968 cases:

- 9,880 for Baron Zemo: 52 expansion starter identities × two difficulties × all 95 modular sets as the first of his two;
- 208 with Standard II and Expert II or with Standard III;
- 4,888 for the S.H.I.E.L.D. set in the 47 other scenarios that allow it;
- 4,992 with the S.H.I.E.L.D. Executive Board added to each of the 48 other scenarios with modular sets.

Manifest hashes retain all 468,832 previous mission names and seeds, checked against the complete grid of `8c9a194`. The unsharded matrix registers more cases than the default 2 GB Node heap holds; run it in shards, as CI does, or with a larger heap.

Rules references: the Agents of S.H.I.E.L.D. rulebook (The S.H.I.E.L.D. Executive Board, Preparing the Evidence, Baron Zemo, The Accusation and the Reluctant Foe FAQ) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Elite, Hinder, Incite, Patrol, Permanent, Quickstrike, Steady, Surge, Villainous, Vulnerable).
