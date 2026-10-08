# Vision identity adapter

The adapter in `src/game/vision.ts` and its native host implement Vision's
physical identity, signature cards, obligation and nemesis set. Original source
registration and native identity checks pass in this workspace. Player-pool
integration and production browser certification are tracked separately; this
document does not claim that Vision is deployed yet.

## Physical source and rules

- Canonical hero ID: `vision`; identity faces `26001a` / `26001b`.
- Hero: 11 HP, 0 ATK, 2 THW, 0 DEF, hand size 5; Android / Avenger.
- Alter-ego: printed 3 REC and hand size 5; Android. The original physical
  [Hall of Heroes scan](https://hallofheroeslcg.com/vision/) and upstream raw
  metadata agree on REC 3. A local reverse-face webp showing REC 5 is not a
  reason to change the printed base stat. Dense adds +2 REC through AE text.
- Original source: 40 playable cards, comprising 15 signature, 17 Protection
  and 8 Basic cards, plus one physical reversible Permanent mass-form upgrade.
  `26002` / `26002b` are two faces of that same card, preserving its physical ID.
- Adapter declares 19 raw faces: two identity faces, two mass faces, ten other
  signature definitions, one obligation and four nemesis definitions. The
  physical nemesis set has five cards: Ultron, Ultron Unleashed, Ultron Drones,
  and two Relentless Android copies.

The current authority is
[Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf),
with original card text and
[official Vision rulings](https://hallofheroeslcg.com/official-ffg-rulings/#vision).
RRG 1.8 Appendix II p51 resolves opening draw at step 14, mulligan at step 15,
and player Setup abilities at step 16. Intangible has **Permanent** but lacks
the **Setup keyword**: keep it outside the shuffled deck, then place that exact
card Intangible-side faceup through Vision's AE Setup after the mulligan. His
initial hand is five cards; the Intangible AE modifier subsequently supplies
the ordinary six-card hand limit. Initial Setup does not trigger Dense's draw
response.

RRG 1.8 Appendix IV p57 gives constant damage reductions priority over Tough.
Intangible's attack damage reduction can therefore preserve Tough when the
remaining damage becomes zero. The earlier Hall of Heroes answer giving Tough
priority over Intangible is superseded by this current reference.

## Public hooks and native integration contract

`visionInitializeMass` holds the original Permanent aside before opening draw.
`visionSetup` places it only at player Setup. `visionInitializeNemesis` reserves
the five real nemesis instances once. Source builders must exclude the mass
Permanent from the 40-card count and must not automatically put this particular
Permanent into play at the earlier Setup-keyword step.

`visionMassForm` reads the face of the physical card. `visionChangeMassForm`
changes its code while keeping its ID, owner, exhaust state and counters.
`visionAbility` supplies the Hero Action once per round, independently of
identity exhaustion and the voluntary Hero/AE flip budget. Absolute form locks
still apply through `canChangeMassForm`. The Dense draw, each physical Density
Control and ordinary form responses share one saved choice window, allowing
the player to order them. Density Control selects an actual discarded Vision
event, discards its physical upgrade as cost and returns that same event ID.

Apply `visionStats`, `visionAlterStats`, `visionAllyStats`, `visionTraits`,
`visionRetaliate` and `visionStalwart` in the ordinary modifier machinery. Cape's
Stalwart grant needs normal status synchronization on entry, face change,
blanking and departure: remove existing Stun/Confuse cards immediately when
Stalwart applies, and prevent further ones. Do not remove Cape or AE modifiers
merely because Corrupted Programming blanks the mass card. The physical face
still identifies the mass form, and Permanent remains a keyword.

`visionCanAttack` / `visionCanDefend` prohibit all attacking/defending while
unblanked Intangible applies, including basic powers, Attack events, attacks
from card abilities and Defense abilities during an attack. A Stunned Vision
cannot attempt an otherwise illegal attack to clear Stun. An ally may still
attack or defend normally. Defense-labelled cards used for nonattack damage
outside an attack need the ordinary native timing check; Intangible does not
prohibit a nonattack prevention effect simply for bearing a Defense trait.

`visionAttackDamageReduction` supplies two damage TAKEN reduction once for each
actual attack directed to Vision, including native overkill reaching him.
Preserve the damage DEALT receipt, use separate native primary/overkill guards,
apply constant reduction before Tough, and do not reduce boost-effect damage,
other nonattack damage or a defending ally's packet.

`visionEventAction` is required before native Stun/Confuse replacement. Solar
Beam's two printed action paragraphs use one current branch: Dense attacks for
seven; Intangible thwarts for five. Its two printed traits must not cause both
status replacements. Superdense Strike uses the native attack program with
Piercing; Just Passing Through overrides both Patrol and Crisis in target
availability and actual threat removal. Phase Disruption uses nonattack enemy
targets, confuses the chosen enemy, then discards one actual attachment on it
with printed Hero Action or Hero Response text. Its second clause still works
when the chosen enemy cannot become confused.

`visionResourceSources` and `visionResourceSpent` provide one actual wild from
Solar Gem and commit its exhaustion once. 616 Hickory Branch Lane exhausts only
in AE, searches the actual deck and discard for an Android ally, retains the
selected ID and shuffles the actual player deck once even after a failed search.
The host's shuffle continuation must preserve ordinary exhaustion/reset timing,
shared RNG and hidden-information boundaries.

`visionDefenseOptions` opens at Vision's actual defense declaration, including
when he defends for another player. Merely being attacked, declaring an ally,
or having a teammate defend does not trigger Mass Increase. Its ordinary card
payment and event resolution use the actual hand ID. The native
`preventAllAttackDamage` port prevents damage from this attack without extra
DEF/prevention counters; nonattack boost damage remains separate. The
effect-based `afterAttack` port stores a delayed stun of the original attacker,
resolving after that same attack before optional attack responses. A defeated
minion is not replaced with the villain.

`visionEncounterReveal` gives the exact Corrupted Programming obligation to
Vision even when another seat reveals it. It remains in his play area and
blanks only the mass upgrade's non-keyword text. Its AE action exhausts the
actual owning identity and removes that same obligation instance from the game.

`visionShadowOfPast` reveals the real reserved Ultron and Ultron Unleashed,
then shuffles only remaining physical nemesis cards. Ultron Unleashed searches
the encounter deck, discard and all players' set-aside areas for the existing
Ultron Drones environment (by printed title, including Core `01140`), **puts**
that same environment into play, shuffles
the encounter deck and queues one ordinary owner-qualified `drone` effect for
each player. Multiple matching physical copies in the searched zones use a
saved actual-ID choice; an environment already in play is outside those searched
zones. Ultron's forced attack interrupt queues a drone for the actual attacked
player when the named environment is in play, even if its text is blank.
Relentless Android queues two real top-card drones
or uses the host's shared-RNG random hand discard, according to the actual
environment state. Each native Drone must contain its original `droneCard`
with unchanged ID and owner; ordinary defeat/discard returns that card to its
owner's discard pile. Handle player-deck exhaustion through native movement
before creating any following Drone. The printed numeric boost icons remain
2 / 2 / 3 / 0 / 2, with no invented starred boost abilities.

## Validation boundary

The pure test suite exercises physical source counts, reversible-card ID
conservation, serialized response ordering, native-ready payment/defense
continuations, actual multiplayer obligation ownership and owner-qualified
Drone movement. Native integration tests exercise actual commands and original
source IDs. Production browser evidence remains pending.

The current focused pure identity proof passes **64 tests** in `tests/vision.test.ts`,
recorded in `output/vision-host-final-focused.log`. The earlier standalone freeze
passed 63 cases in `output/vision-pure-test-freeze-final.log`. The earlier `--noEmit` check at
`output/vision-types-freeze.log` did not traverse project references and is not
a full project TypeScript proof. The host integration requires `tsc -b`.

Native identity proof: **36 tests passed** in `tests/vision-engine.test.ts`,
recorded in `output/vision-native-permanent-final.log`. These use the original 40-card
source plus its one physical mass upgrade, actual reserved nemesis cards,
serialized commands and actual multiplayer ownership. They cover setup after
mulligan, attacks and damage reduction, status timing, printed events,
upgrades, response ordering, obligations and physical Drone movement. Defense
controls include Vision defending a teammate, real Rhino + Charge overkill,
and Whirlwind's separate nonattack boost damage. All five encounter faces also
pass native numeric boost controls without resolving their encounter text.

## Native host regions

The identity host adds the `vision` namespace and `visionPorts` to `engine.ts`.
Native hooks cover `newGame` / `initialSetup`, identity status synchronization and
keywords, legal basic/event/card-ability attacks and actual defense choices,
`eventResolve`'s Solar Beam action discriminator, actual ally stats, incoming
attack and Overkill prevention, serialized delayed `visionAfterAttack`, encounter
entry/boost/reveal-window routing, the Shadows of the Past reserve and retained
Vision round flags. `card-text.ts` handles Corrupted Programming on the physical
mass card; `cards.ts` supplies ordinary stats/traits and the native Drone base
health adapter. `payment.ts` registers Solar Gem in the existing source list;
`requestPayment`, `pay` and `canPay` retain the shared payment implementation.
The generic discard primitive and choices respect Permanent while retaining
ordinary elimination cleanup. Legacy MTS Audacity is attributed to its active
identity.

These regions were added to the final Valkyrie baseline. Later shared pool
changes must be propagated narrowly so the Vision hooks remain intact. Jocasta's
stored Defense events require the pool's source getter/extraction path to extend
Mass Increase; that pool integration is outside the identity proof above.

The native Permanent controls additionally prove that Electric Whip Attack counts
Mass as an upgrade for damage while offering no illegal discard, and ordinary
player elimination removes that same physical Mass while a teammate continues.
The final identity-host `npx tsc -b` completed successfully in
`output/vision-host-types-final.log`. A focused inherited cross regression passed
**192 tests** across the Vision pure/native and Valkyrie, War Machine and Nebula
native identity suites (`output/vision-host-cross-final.log`).

The subsequent focused integration passes **220 tests across seven files**, including **64 pure identity and 36 native identity cases**, 55 pure player-pool cases, 26 native player-pool cases, 31 shared Jocasta compatibility cases and eight Alliance/payment controls. Evidence: `output/vision-host-final-focused.log`. These focused results do not certify the still-pending corrected full regression, production browser or publication.
