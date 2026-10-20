# Maria Hill native integration

Maria Hill uses the immutable Agents of S.H.I.E.L.D. source cards, scans and starter list. Positions 50001a/b–50033 contain 34 retail faces and 48 positional physical cards. The two physical Super Spies cards (50024) are split between the two heroes, giving Maria 47 assigned physical cards. Her starter contains exactly 40 cards: 15 identity-specific, 12 Leadership, three other-aspect S.H.I.E.L.D. supports, and ten Basic cards. The printed starter aspect is Leadership; the imported `multi` metadata remains unchanged.

`maria-hill.ts` owns 33 native faces. Nick Fury's module owns the sole shared Super Spies implementation. Dum Dum Dugan and the three double resources retain their original printing IDs and use existing rule aliases. Maria can include maximum copies of three logical S.H.I.E.L.D. support types from other aspects; copies across reprints share the normal name limit.

## Rules and physical state

- Maria grants S.H.I.E.L.D. only to allies she controls while her hero text is active. Support effects target any player's eligible cards unless their printed text says “you control.”
- All-purpose counters use the receiving support's normal counter pool, including staff, supply, deployment, mission, missile and operation counters. Removing the last Uses counter invokes normal discard cleanup. Threat is a different token type and does not silently become a support counter.
- Organizational Support has one physical payment-source ID. Payment first selects up to three actual eligible cards, preserves their printed resource icons through reload, and exhausts them only when payment commits. Special Funding records which physical resource cards contributed to the actual cost; wholly overpaid cards do not earn its response. Funding resolves after the played support's initial Uses counters.
- Front Organization receives an explicit encounter-discard instruction through `discardEncounterControlled(state, targetId, sourceId?, after: Effect[] = [])`. Scalar discard and player discard costs have no encounter-origin heuristic, including nested costs during the villain phase. Core encounter discard instructions mark their effects explicitly. Other native encounter modules use the dedicated port. Serialized `discardPiece` effects carry `encounterDiscard: true`, the actual source ID and an optional `after` continuation, which resumes after either replacement choice.
- Controlled Innocents move the actual top player card into the minion zone with its original ID, code and owner. `mariaControlled` supplies the public Controlled minion overlay and player card back. Defeat restores the same physical card to its original owner's discard and adds threat while the environment is active. Army of the Controlled discards these minions without triggering their defeat response.
- Slingshot retains her original owner across a change of controller and returns to that owner's hand at the end of the phase if still in play. Grant Ward cannot defend, uses current ATK for his forced response, and leaves after its damage instruction.
- The Controller scan and unchanged imported row both print SCH 2★, ATK 1★, HP 6 and three boost icons.

The five physical nemesis cards are retained in the engine's internal `setAside` reserve until Shadows of the Past or a native search moves them. They are not extra setup cards or part of the 40-card player deck.

## Presentation and integration

The host installs initialization, abilities/events, support entry, payment preflight/commit, post-basic-power responses, actual activation completion, reveal cancellation, scheme defeat and phase-end hooks. Shared exports are `mariaHillTrait`, `mariaHillSupports` and `mariaHillChangeCounters`.

The App's minion rendering and piece-aware inspector show the player back and Controlled public text; printing links and target thumbnails cannot reveal the original face. Combat character snapshots likewise carry the player-back presentation code. Persistent game state retains the original printing for conservation and restoration.

## Evidence

- [Official Agents of S.H.I.E.L.D. rulebook](https://images-cdn.fantasyflightgames.com/filer_public/79/12/7912adc3-2461-4ea2-8606-4715880b8d1d/mc50_rulebook-web.pdf), especially page 4, counters versus threat.
- [Original-card scan gallery](https://hallofheroeslcg.com/agents-of-shield/), checked against the repository's actual card scans for Special Funding, Organizational Support, Front Organization, Grant Ward, The Pericles and all five nemesis faces.
- The batch source contract records the shared Super Spies allocation and printed Leadership starter. Imported catalog rows, starter data and images are unchanged.
- Native command tests cover real payment, cooperative support scope, counters/Uses, defense, reveal windows, phase return, nemesis activation and actual owned facedown cards. Contract tests verify source counts, original IDs and scanned statistics.
