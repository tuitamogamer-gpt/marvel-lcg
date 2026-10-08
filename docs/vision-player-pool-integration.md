# Vision player-card pool adapter

`src/game/vision-pack.ts` implements thirteen actual-code player-card adapters.
Six mechanically exact Core reprints use explicit aliases while retaining their
original physical IDs. Native registration and integration proof are complete;
production-browser certification is recorded separately by the release checks.

| Physical code          | Adapter behavior                                                                                                                                                                 |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 26013 Jocasta          | Optional ENTER response stores the same discarded Defense event facedown; actual stored-card PLAY getter and extraction preserve its ID/owner. Works after PUT as well as PLAY.  |
| 26014 Protector        | Typed Mental resource ability before positive damage TAKEN; optional payment commits its physical once-per-round limit before spend responses and prevents one actual damage.    |
| 26015 Victor Mancha    | Constant reduction of one damage TAKEN from each attack; apply once before Tough, excluding consequential and other nonattack damage.                                            |
| 26016 Flow Like Water  | Choose actual controller, max one per player; optional response to actual PLAY of a Defense-traited card damages the actual attacking enemy for one nonattack damage.            |
| 26018 Defiance         | Native interrupt BEFORE the current facedown boost flips: discard its physical card, canceling its icons and ability together without exposing its face.                         |
| 26019 Side Step        | Dedicated actual-code reprint: prevent three native damage; one nonattack damage to the actual source enemy only if Energy was spent FOR the card.                               |
| 26021 Preservation     | Dedicated actual-code reprint: optional healing of one from the actual wounded Hero after SPEND, never discard and never AE.                                                     |
| 26022 Machine Man      | Optional one-to-three resource ability; saved bonus applies to exactly the current attack/thwart continuation, following current “for this use” erratum.                         |
| 26024 Reboot           | Choose the same actual friendly Android identity/ally, ready it and heal one; available if either clause can change its state, including AE.                                     |
| 26033 Assault Training | Two Uses counters; AE exhaustion/counter cost, physical Aggression event shuffled from controller's discard; final counter discards actual support before benefit.               |
| 26034 Chance Encounter | Attach to actual side scheme, max one per scheme; optional BEFORE-defeat interrupt searches controller's actual deck/discard for an ally and shuffles, including failed search.  |
| 26035 Joining Forces   | Printed Alliance payment must retain two distinct eligible hand allies, one Avenger and one Guardian; PUT both actual owners' allies in one native batch before entry responses. |
| 26036 Meditation       | AE exhaust cost precedes effect; actual legal hand card is PLAYED with a temporary three-resource discount, preserving normal costs/targets and nested continuation.             |

Exact Core aliases: `26017→01082` Indomitable, `26020→01078` Get Behind Me!,
`26023→01091` Avengers Mansion and `26025/26/27→01088/89/90` Energy/Genius/Strength.
Side Step and Preservation are non-Core reprints and retain dedicated adapters.
Together with the identity adapter, the release boundary is 38 raw Vision faces:
19 identity faces, 13 dedicated pool faces and six Core aliases. The original
source remains 40 playable cards (15 signature, 17 Protection, eight Basic)
plus one reversible Permanent mass card outside that count.

The reference is
[RRG 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf)
and the [original physical cards](https://hallofheroeslcg.com/vision/). Machine
Man's current erratum on p67 is already represented in the raw text. Costs using
“up to” need at least one actual resource when the interrupt is initiated;
declining its optional window spends zero and gives no bonus.

Jocasta's getter must feed **all** native Defense event source providers,
including Vision's Mass Increase and existing cards from older packs. Stored
cards stay outside the hand and cannot generate printed hand resources. Native
PLAY extraction removes the same nested instance only when its play commits;
ordinary Jocasta leave-play handling discards nested owned cards correctly.

The host's `canUseDefense` port must use the actual timing window. Intangible
prohibits Defiance and other defense during an attack, but does not prohibit a
Side Step used for nonattack damage outside an attack. Existing presence of a
pending `s.attack` object alone does not identify a damage window. A Defense
ability used while an ally defends does not replace that ally with the identity.
Defiance must run before revealing the boost and preserve the hidden-information
boundary, rather than exposing a card and subsequently canceling it.

Side Step receives the typed `paidForCard` receipt, excluding overpaid Energy.
Its damage target comes from the actual source enemy; unrelated nonattack damage
does not invent a villain target. Native payment must expose the relevant typed
allocation for this benefit, including its `14015` predecessor where applicable.
Protector and Machine Man pay **ability** costs with no card-payment target code:
Power of Protection/Power in All of Us therefore generate their ordinary single
wild rather than doubling as though an ally card were being played.

`visionPackJoiningPairs` exposes actual held pairs. Before any Alliance resources
commit, `visionPackPaymentAllowed` verifies that a legal pair remains, receiving
normalized actual physical resource-card IDs from all contributing players.
`canPayKeepingAllies` performs the same affordability probe excluding both held
ally IDs and the event. Native payment suggestions and the Pay button must enforce
this condition too. `putAlliesFromHand` commits both allies before entry/ally-limit
windows, preserving physical ownership and each player's controller. PUT does not
trigger Flow Like Water or other PLAY responses.

`visionPackBeforeEvent` pays Meditation's exhaust cost before ordinary benefit.
The host carries `visionMeditationCostPaid` into `visionPackEvent` as
`{meditationCostPaid:true}`. Its direct body rejects a missing cost receipt.
Discount probes do not mutate the ordinary next-card discount; the actual nested
PLAY applies three only to the chosen physical card and retains the parent event's
continuation through payment, entry, responses and discard.

Pure validation: **55 tests passed** in `tests/vision-pack.test.ts`, recorded in
`output/vision-pack-pure-final.log`. Coverage includes physical alias fields,
saved Jocasta events, typed damage costs, multiplayer control and search actors,
facedown boost movement, Energy allocation, single-use Machine Man continuations,
actual Android targets, Uses depletion, retained Alliance pairs, batch entry and
Meditation cost receipts.

The native supplementary suite passes **26 tests** in
`tests/vision-pack-engine.test.ts`. Every command reloads serialized game state,
and the physical walker proves each original source ID and owner occurs exactly
once, including the same outside-deck Permanent mass card. Tests use real PLAY,
Alliance payment, boost reveal, damage, ally actions and nested continuations.
They cover saved Mass Increase, actual Defiance before its facedown boost flips,
Flow Like Water after stored Defense PLAY, Energy allocated FOR Side Step rather
than overpaid Energy, Protector's Mental ability cost and pre-SPEND round limit,
Victor Mancha before Tough, Preservation after actual spend, Machine Man's
single-use bonus, teammate Android Reboot, last-Uses Training and Chance
Encounter before physical scheme defeat. Joining Forces retains both real hand
allies through owner-qualified Alliance payment and commits their entire PUT
batch before Jocasta's entry response. Meditation exhausts before benefit,
retains the parent event continuation through nested PLAY, and restores its
temporary discount when that nested payment is canceled.

Jocasta's owner-visible table list exposes actual IDs, current cost and timing
restriction. Its stored sources join Mass Increase and Core Backflip as well as
all **15 older Defense printings** through `defenseEventSources` in
`card-text.ts`. The shared source compatibility suite adds **31 cases**, with
**736 focused tests across 15 files** passing in
`output/jocasta-defense-compatibility-final.log`. Actual stored cards stay outside
the hand and payment sources; cancellation retains them, committed PLAY extracts
them once, and actual Jocasta leave-play discards them once. Native controls also
prove saved legacy Side Step `14015` obeys its typed FOR-card receipt, Intangible
rejects attack-defense use, and Defiance preserves an existing ally defender.

Final focused integration: **220 tests pass across seven files**, comprising
26 native pool, 55 pure pool, 36 native identity, 64 pure identity, 31 shared
Jocasta compatibility and eight generic Alliance/retained-pair payment controls.
The log is `output/vision-host-final-focused.log`; TypeScript validation is
recorded in `output/vision-pool-native-types.log`. Release-wide scenario and
browser checks remain separate from this focused proof.
