# War Machine supplementary cards

This is an original native implementation of the 20 supplementary physical
faces in the War Machine pack, using its original printed cards and the current
[Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).
Original scans are in `public/cards/catalog/230xx.webp`; current
[official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/) clarify
Black Panther, Sneak Attack, and Innovation. It imports no third-party gameplay.

| Physical source faces       | Native handling                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 23012 Black Panther         | Actual discarded Leadership event stored facedown; play as if in hand                                        |
| 23013 Captain Marvel        | Original top-four physical batch; count printed energy icons; nonattack damage and same surviving enemy stun |
| 23014 Falcon                | Original encounter top-three preview; separate nonthwart threat removal for each treachery                   |
| 23015 Goliath               | Shared global phase maximum with the Hawkeye printing; +4 ATK and physical phase-end discard                 |
| 23016 Command Team          | Three Uses; last counter discards support before readying any player's ally                                  |
| 23017 Sneak Attack          | Current identity traits; chosen actual hand ally; entry responses before delayed discard clause              |
| 23018 Save the Day          | Controlled ally discard cost; printed-cost nonthwart threat removal                                          |
| 23019 Go Down Swinging      | Controlled ally discard cost; printed-cost nonattack damage                                                  |
| 23021 Innovation            | Actual card-spend response in hero form; heal a controlled ally                                              |
| 23023 Quincarrier           | Current identity Avenger play restriction; physical wild-resource exhaust in either form                     |
| 23024 Two Against the World | Actual current named characters; actual deck Tech upgrade put into play, shuffle, ready both                 |
| 23032 As One!               | Alliance resources and distinct character exhaustion costs; current combined ATK; one Overkill attack        |
| 23033 Vigilante Training    | Two Uses; actual Justice discard event shuffled into own deck in alter ego                                   |
| 23034 Stand Together        | Alliance paid hand interrupt; exhaust two distinct characters, prevent all damage, reflect nonattack damage  |
| 23035 Sidearm               | Any player's ally attachment; max one per ally; +1 ATK and Ranged                                            |

These 15 faces are exported by `WAR_MACHINE_PACK_SCRIPT_CODES`. Falcon,
Goliath, Innovation, and Quincarrier are other-pack reprints whose actual source
codes are not mapped by the Core-only `rulesCode` mechanism, so they need these
native adapters.

The five mechanically equal Core reprints in
`WAR_MACHINE_PACK_CORE_ALIASES` are 23020→01071 Make the Call,
23022→01083 Mockingbird, 23025→01088 Energy, 23026→01089 Genius,
and 23027→01090 Strength. Actual physical pieces retain their original 230xx
source codes and IDs.

## Physical state and saved timing

Black Panther stores actual pieces in the existing `Piece.storedCards` field.
They are out of play and absent from the hand. Only the unblank controlled
Panther's Leadership events are exposed by `warMachinePackStoredPlayable`;
they are playable as if in hand, never hand resources. The host must validate
ordinary play, timing, and payment before calling
`warMachinePackTakeStoredForPlay`. Every leave-play path disposes these actual
pieces to their owners' discard piles and clears the nested storage. Physical
conservation and saved-game accounting must include this existing nested zone.

The latest official Black Panther ruling supersedes the older crossed-out
answer: he cannot attach the Sneak Attack that summoned him. Sneak Attack's
first sentence puts him into play and opens his entry response; its second
sentence then creates the delayed phase-end discard. The event is still
resolving during the entry response. A final-clause put-into-play event such as
Summoning Spell has different event-discard timing.

`putAllyFromHand(s,id,after)` moves the actual hand ally, resolves the ally
limit before entry responses, resolves those responses, then resumes `after`.
Putting into play is not playing an ally and does not consume an ally-play
discount or trigger hand-play responses. Sneak Attack marks
`flags["warMachinePackSneak:"+id]` with the serialized round/phase after the
entry response. `warMachinePackCardLeftPlay` clears this marker on actual
leave-play, so returning and replaying the same physical ID creates a new
entry. Control transfer preserves the marker; global phase-end cleanup follows
the original physical ally across controllers.

Goliath uses the existing global `hawkeyeGoliathPhase` marker, shared across
players and printings. Its actual source receives `bonusAtk += 4` and a
separate physical phase-end marker. Call the global phase-end adapter before
generic bonus/reset cleanup and before moving to the next phase.

Captain Marvel's `discardPlayerCards` port captures a simultaneous original
top-four batch and resumes with actual `discarded: Piece[]` after all real deck
exhaustion/reset response windows. It stops at exhaustion and never mills
recycled cards. Printed energy icons are counted, so a single double-Energy
card qualifies for stun; wild icons are not energy. A captured target code
prevents stunning a replacement villain stage after the damage defeats the
previous stage. Falcon only previews the original top three without changing
encounter order or causing an encounter reset.

## Costs, actions, and host adapters

`warMachinePackBeforeEvent` pays the printed additional costs before operation
status replacement. Its continuation records
`warMachinePackCostPaid: true` and a serializable
`warMachinePackReceipt: {allyId?,amount?}`. Pass that receipt to
`warMachinePackEvent`. Save the Day and Go Down Swinging use the sacrificed
ally's printed cost rather than its current ATK or reduced play cost.

As One and Stand Together have Alliance. RRG 1.8 page 6 permits any player to
help pay all costs, including character exhaustion. The characters must be
distinct actual ready physical characters; one character with both traits
cannot be exhausted twice. A qualifying alter ego is a character and can
contribute; its unprinted ATK is zero. Capture current modified ATK at the
exhaustion cost, including ally bonuses and Sidearm, for As One. Ally status
cards do not replace an exhaustion that pays another character's event cost.
The event owner's Stun does replace As One's attack after these costs are paid.

Sneak Attack's additional-cost ally must remain in hand while paying its
resource cost. `canPayKeepingHandAlly` checks correlated affordability with
both the event and one actual eligible ally excluded from payment sources.
The native host records the eligible physical IDs in `retainOneOfIds` and
validates the retained-ally constraint before committing any selected resources.
Payment suggestions and the payment UI use that same constraint.
Spending the sole eligible ally cannot leave a committed payment with no legal
printed additional cost. A zero-cost discounted Sneak remains playable with
that same sole ally, and another eligible ally may fund the event when a
different eligible physical ally remains.

The host must support Alliance resource contributions in its payment provider
and pass `alliance: true` from paid Stand Together requests. Ordinary As One
payments require the same native keyword check. Only the player playing the
event resolves its effects. All such costs still use each contributing
player's legal resource restrictions and actual controlled sources.

Stand Together accepts the actual friendly damage recipient, current positive
amount, and actual attacking enemy ID in a saved packet. It queues
`payRequest → resolveHandEvent` with a custom serialized body and continuation,
so the physical event leaves hand, resolves, and is discarded once before the
original damage window resumes. It has no defense label and must not declare a
defender or trigger defense-only responses. Its reflection is nonattack damage
and does not invoke Guard, hero Stun, or Retaliate. The prevention port handles
both normal attack and Overkill packets at the host's real prevention window.
Damage already prevented or replaced by Tough cannot be counted a second time.

Save the Day and Falcon are not thwart actions; Confuse and Patrol do not
replace them, while Crisis and absolute player-card threat-removal locks still
apply. Go Down Swinging and Captain Marvel are not attacks; hero Stun, Guard,
and Retaliate do not apply. As One is one event attack with Overkill, not two
basic attacks and not two ally consequential-damage steps.

Command Team and Vigilante Training use ordinary Actions in their printed
forms. Their exact physical support exhausts and loses a counter as cost; Uses
discards it immediately when its last counter is removed, before the ready or
shuffle effect. Vigilante Training only searches its controller's discarded
Justice events. Innovation responds to spending even while paying a zero-cost
card and only offers when a controlled ally has damage.

Two Against the World is a Hero Action with Team-Up, so use the actual current
in-play names Iron Man and War Machine. James Rhodes and Tony Stark are alter
ego names, not the required hero names. The searched Tech upgrade must pass
native attachment, ownership, uniqueness, and Restricted constraints through
`canPutUpgrade`. The host puts that exact deck piece into play without a play
cost, resolves its entry windows, shuffles, then readies both named characters
through their actual native ready permissions. No available Tech still allows
the remaining shuffle and ready effects.

Sidearm's adapter returns `{attack,ranged}` for an ally from actual unblank
attached sources across controllers. Apply this once: the generic compiler
must not independently double its ATK or Ranged modifier. A blank Sidearm loses
its modifier but still occupies the printed max-one-per-ally attachment limit.

## Validation

The pure suite verifies the exact 20-face partition and actual-code reprints,
saved physical choices, Panther's nested card conservation, original deck
batches, nonattack/nonthwart status behavior, global Goliath limits, last-Uses
cost ordering, multi-player contributors and ally readiness, Team-Up put/shuffle
ordering, and the paid Stand Together event lifecycle.

The supplementary native suite passes 33 cases with a JSON round-trip before
every command and exact original 40-card source conservation for every seat.
It verifies actual Panther storage and replay, Sneak versus Summoning Spell
entry ordering, zero-cost Innovation, owner-qualified donor responses and one
donor deck reset after all contributed cards are committed, legal Quincarrier
and Scientist contributions, and Gauntlet's printed War Machine-event restriction.
Captain Marvel stops at the original exhausted deck and counts both printed
Energy icons on one physical resource card. Stand Together preserves the real
defender and attacked character, reflects only damage remaining after Groot
prevention, can prevent only Overkill spill, preserves a surviving defender's
Retaliate, and aborts a minion attack when reflection defeats its attacker.
As One uses current modified ATK for one Overkill attack, allows a qualifying
alter ego's zero ATK contribution, commits exhaustions before Stun replacement,
and causes no ally consequential damage. Together with the 58 pure module
cases, all 91 tests pass.

The final native controls also exercise Goliath’s ordinary attack and thwart while his special ability remains available, Command Team ready, boosted ATK5 and same-ID phase-end discard. Ordinary ally actions use the common ally route; only his printed special action enters the player-pool ability adapter.
