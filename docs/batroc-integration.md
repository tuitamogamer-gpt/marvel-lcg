# Agents of S.H.I.E.L.D.: Batroc

This import adds Agents of S.H.I.E.L.D.'s second scenario, Batroc, with the Batroc's Brigade set. The players do not win by defeating Batroc, who cannot be defeated, but by advancing through the three stages of the main scheme: they break into the A.I.M. Island embassy, free the captives held there and escape with them, while the Alert Level rises.

## Original source and scope

`src/game/batroc.ts` registers 22 original faces:

- **Batroc (17):** both sides of Batroc, Infiltrate A.I.M. Island Embassy, Locate Missing Person, Extract Captives and Alert Level, Rescued Captive (4), Heightened Reflexes, Embassy Guard (2), Embassy Patrol (2), Commandeer Security Office, Leaping Kick (2) and Security Cameras (4).
- **Batroc's Brigade (5):** Machete, Rapido, Zaran, Batroc's Brigade and Soldiers of Fortune.

The imported catalog, original source decks and artwork remain unchanged.

Standard uses Batroc (A), Expert Batroc (B). The encounter deck holds the Batroc and Standard sets and two modular sets, with the Expert set in Expert. A.I.M. Science, imported with [Black Widow](black-widow-villain-integration.md), and Batroc's Brigade are preselected, and Batroc's Brigade can be chosen in every other scenario with modular sets.

## Native rules

- **Setup (1A):** the four Rescued Captive allies are set aside, and Alert Level enters play on its Low side, with 2 threat per player in Expert.
- **Batroc:** 8 hit points (A) or 12 (B), without a per-player icon. When he would be defeated, his hit points reset instead and 6 threat comes off the main scheme. After he attacks, Alert Level gains 1 threat.
- **Infiltrate A.I.M. Island Embassy (1B):** 6 threat per player to start and 1 more per player each villain phase. When the last threat is removed, the players advance. Completing this stage, or any later one, loses the game.
- **Locate Missing Person (2B):** 3 threat per player to start. When the last threat is removed, a set-aside Rescued Captive enters play exhausted under a player's control, then the players advance, or stay and place 3 threat per player here to free another.
- **Extract Captives (3A and 3B):** when revealed, with Alert Level on its High side each player is dealt a facedown encounter card; otherwise all its threat comes off and it flips to High. In Expert, Alert Level gains 2 threat per player either way. Stage 3B begins with 12 threat per player. Each enemy attack goes to a Rescued Captive instead, and the players choose which. The players win when it has no threat and lose with no Rescued Captive in play. In Expert each minion gains quickstrike.
- **Alert Level:** at 4 threat per player its Low side loses all its threat and flips to High. On High, Batroc gets +1 ATK and +1 SCH, and the players lose at 4 threat per player. After a character is defeated, except by consequential damage, it gains 1 threat. Its Hero Action spends 1 resource to remove 1 threat.
- **Rescued Captive:** does not count against the ally limit. Its Hero Action exhausts it to remove 1 threat per player from the main scheme. Victory -1: a defeated Rescued Captive enters the victory display.
- **Heightened Reflexes:** attaches to Batroc with 4 leap counters. Whenever he would take damage, 2 of it is prevented and a counter comes off; with none left it is discarded. As a boost, it attaches to him.
- **Embassy Guard and Embassy Patrol:** guard or patrol, and vulnerable. On High, the Guard gains surge and the Patrol incite 1. Each places 1 threat on Alert Level when defeated.
- **Commandeer Security Office:** an acceleration token when revealed with Alert Level on High; when defeated, 1 threat per player comes off Alert Level.
- **Leaping Kick:** in alter-ego form, Batroc schemes. In hero form he attacks the ally in play with the most remaining hit points, with overkill, or you with no ally in play.
- **Security Cameras:** in alter-ego form, 1 threat comes off Alert Level and it gains surge. In hero form, each character you control is exhausted or places 1 threat on Alert Level, 2 on High.
- **Batroc's Brigade:**
  - **Machete:** surge and vulnerable. Its attacks gain piercing, and when defeated it is shuffled into the encounter deck.
  - **Rapido:** its attacks gain ranged and deal indirect damage. When revealed, and as a boost, 1 damage to each character you control.
  - **Zaran:** when revealed, a Weapon upgrade you control is tucked under him, or with none the top card of your deck. He gets +X ATK, X being its printed cost, and it returns to its owner's discard pile when he leaves play.
  - **Batroc's Brigade:** each minion gains toughness, and each enemy gets a tough status card when it is revealed. Its Hero Interrupt, when you reveal a non-Elite minion, spends 3 resources to cancel and discard it.
  - **Soldiers of Fortune:** you spend 3 resources, or a Mercenary minion is found and revealed, with surge if none enters play. As a boost, you spend 1 resource or it gains three boost icons.

## Interface

- Mission setup explains the scenario and preselects A.I.M. Science and Batroc's Brigade.
- The objective reads "Clear all threat · stage N of 3". Batroc's label shows his side and that he resets, and his caption says what defeating him and his attacks do.
- The main scheme's note says how the stage is won and lost, with the captives left to free or in play.
- Alert Level is labelled with its side, captioned with its threat against the limit, and offers its Hero Action as a button.
- Each Rescued Captive's Hero Action is a button on the card.

## Coverage boundaries

- "Per player" values use the number of players who started the game.
- Locate Missing Person's choice is the first player's. With no Rescued Captive in play, advancing is offered second, since it loses at once.
- A Permanent Weapon upgrade cannot leave play, so Zaran takes the top card of the deck instead.
- Card abilities that would remove a Rescued Captive from play are not separately blocked, as with the Morlocks. A Rescued Captive tucked under Abduct Superhumans goes to the encounter discard pile when that scheme is defeated.
- If Batroc's text is blank when he would be defeated, he is defeated and the players win, as with the last villain of any scenario.
- The S.H.I.E.L.D. campaign, its evidence and the Executive Board are not automated.
- The executable registry contains 3,324 faces, including 2,886 dedicated faces, with 1,227 imported faces still unsupported. There are 57 playable identities, forty-eight scenarios and eighty-seven modular sets. The inventory pins 171 source files.

The configured source matrix contains 424,528 cases in sixteen disjoint shards of 26,533; CI runs the sixteen shards in parallel. This import adds 13,936 cases:

- 9,048 for Batroc: 52 expansion starter identities × two difficulties × all 87 modular sets as the first of his two;
- 208 with Standard II and Expert II or with Standard III;
- 4,680 for the Batroc's Brigade set in the 45 other scenarios with modular sets.

Manifest hashes retain all 410,592 previous mission names and seeds, checked against the complete grid of `a308934`. The unsharded matrix registers more cases than the default 2 GB Node heap holds; run it in shards, as CI does, or with a larger heap.

Rules references: the Agents of S.H.I.E.L.D. rulebook (Batroc, infiltrating the embassy, Patrol, Vulnerable) and the original card texts, [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) (Guard, Incite, Indirect Damage, Overkill, Permanent, Piercing, Quickstrike, Ranged, Surge, Toughness, Uses).
