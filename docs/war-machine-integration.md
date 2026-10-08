# War Machine native integration

`src/game/war-machine.ts` implements original `23001a/b`, `23002–23011`, and
`23028–23031`. The canonical catalog hero/set/pack ID is **`warm`**; `wmach`
and `war_machine` are compatibility aliases only. `WAR_MACHINE_SCRIPT_CODES`
contains sixteen dedicated faces. Signature quantities total fifteen actual
cards: Iron Man, Bunker, Chassis, two Gauntlets, Missile Launcher, Shoulder
Cannon, and two copies of each event. The obligation is one physical card;
the nemesis is Living Laser, Deadly Light Show, and three Laser Strikes.

The original 40-card starter contains 15 signature cards, 19 Leadership cards,
and six Basic cards. It uses one Two Against the World despite two physical
copies being supplied in the pack; its printed max-one-per-deck still applies.

Sources are original scans in `public/cards/catalog/230xx.webp`,
[the original hero gallery](https://hallofheroeslcg.com/war-machine/),
[official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/#warmachine),
and [RRG 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).
The current erratum on RRG p. 67 adds **once per phase** to James Rhodes's
printed alter-ego action. No third-party gameplay implementation is used.

The printed hero is HP 10, ATK 2, THW 1, DEF 2, hand size 5, Avenger/Soldier.
Alter ego has REC 3, hand size 6, S.H.I.E.L.D./Soldier. Upgraded Chassis grants
Aerial to the **War Machine hero**, including while the physical Chassis is
exhausted; blanking the upgrade suppresses that grant. It does not give
James Rhodes Aerial. `warMachineTraits(view)` belongs in the common trait
provider.

## Identity counters and actual form changes

`flags.warMachineAmmo` stores the receiving seat's scalar identity ammo;
`warMachineAmmo(view)` reads it. `Piece.counters` on each actual Munitions
Bunker stores that Bunker's separate ammo. Neither the identity nor Bunker
counter records contain virtual cards. Both survive ordinary JSON reload.

Call `warMachineFormChanged(view,from,to,ports)` only after a real form change,
including free obligation changes. Initial setup in alter ego does not trigger
Locked and Loaded. The forced alter-ego response immediately removes every
**identity** ammo counter before optional form responses. Bunker counters
remain. A blank identity suppresses its own text; the physical Chassis can
still respond independently.

The hero response is optional and adds **five**, rather than setting ammo to
five. The same serialized response window offers each captured physical
Chassis, allowing the player to resolve Tough and ammo in either order or
decline. An already Tough identity cannot exhaust Chassis merely for another
Tough card. Physical `ids` and `used` receipts prevent a source responding
twice or a newly entered Chassis joining an old window.

`warMachineAbilityOptions` and `warMachineAbility` accept `hero`/`identity` for
the alter-ego `recover-war-machine` action. It selects an actual **War Machine
card** (`set_code:warm`, hero faction) in discard, moves that same instance to
deck, shuffles, and spends `warMachineRecoverPhase = round:phase`. It cannot
shuffle the basic Two Against the World merely because that event names War
Machine. Call `warMachinePhaseEnded` at both phase boundaries for every seat.

Munitions Bunker's `store-ammo` action exhausts the actual support and adds two
counters there in alter ego. Its `transfer-ammo` hero action exhausts it and
moves **every** counter to War Machine; zero counters cannot trigger a
zero-effect transfer. Identity exhaustion is irrelevant to either action.

## Resource payment and additional costs

`warMachineResourceSources(view,targetCode,ports)` exposes each ready,
unblanked Gauntlet Gun as one physical wild resource source **only** for a
War Machine event. `warMachineResourceSpent` validates the same target,
exhausts that actual Gun, then adds one identity ammo when payment commits.
Do not generate the ammo on opening/canceling a payment dialog, while paying
for Missile Launcher/Shoulder Cannon, or while playing Relentless Assault,
Two Against the World or another aspect/basic event. Printed Resource has
no form restriction of its own; the event's ordinary form restriction applies.

The official ruling explicitly allows both a zero-ammo Repulsor Beam paid
with one Gun and Full Auto starting with two ammo and paid with two Guns.
Play availability must therefore evaluate resource funding **together with**
the ammo from selected Gun sources. `canPayEventWithAmmo` is the native host
contract for that correlated check; counting every ready Gun as free ammo is
incorrect. Payment must consume the actual resource sources and apply Gun
ammo before checking the additional ammo cost. The generic payment target is
the actual event, so printed resource restrictions and Power-card doubling
continue to use the existing card payment rules.

`warMachineBeforeEvent(view,p,after)` runs after committed resource payment,
before native Stun/Confuse replacement. Repulsor Beam and Targeted Strike each
remove one ammo; Scorched Earth removes three; Full Auto removes four and
**chooses its enemy before the printed cost arrow**. Receipts carry
`warMachineAmmoCostPaid:true` and, for Full Auto, `warMachineTarget:<physicalId>`
into the saved continuation. The host checks the marker before offering the
cost again, then passes that fixed target into `warMachineEvent`. The event's
cost remains paid even if Stun/Confuse replaces its attack/thwart. A stunned
Full Auto still pays its choose-enemy cost; its canceled attack does not use
Guard to restrict that nonattack cost selection.

Repulsor Beam is one four-damage attack. Full Auto is one eight-damage attack
with Overkill against the already chosen enemy. Targeted Strike is one
three-threat thwart. Use common native attack/thwart modifiers, Guard,
Patrol/Crisis, Tough, Retaliate, event history and physical event resolution.
None are basic powers. Scorched Earth is a simultaneous **nonattack** batch
of three damage to every enemy in play, including minions engaged with other
players. Stun, Guard, Overkill and Retaliate do not apply to that batch.

## Physical weapons and entry response

Missile Launcher's `attack` action exhausts its physical source and spends one
identity ammo to make one two-damage **Ranged** attack. Shoulder Cannon's
`attack` action exhausts its physical source and deals one damage without an
upfront ammo cost. Its optional later clause spends one ammo to ready that
same Cannon. The clause belongs inside the attack's card-resolution program,
before deferred attack aftermath, and carries the physical source ID through
reload. A canceled Stun replacement still pays the initial costs and cancels
all attack text, including the Cannon ready sentence. `canReadyPiece` applies
to the actual Cannon; an effect preventing the identity from readying does not
prevent a weapon from readying. No weapon exhausts the identity.

`warMachineAllyEnter` observes Iron Man's **enters play** trigger, including
put-into-play effects. Its optional response searches the actual owner's deck
and discard for any Tech **upgrade**, chooses the physical ID, adds it to
hand and shuffles. It can find aspect/basic Tech upgrades. It is not limited
to War Machine signatures and does not trigger only on hand play.
`shufflePlayerDeck(view,after)` must resume after actual deck exhaustion/reset
windows when searching the last card empties the deck; no callbacks appear
in saved effects.

## Physical encounter cards and native hooks

`warMachineInitializeNemesis` creates exactly five real pieces only when the
seat's `setAside` field is missing. Never replenish an existing empty zone.
Migration must allocate IDs from the root state's shared `nextId` across all
seats. `warMachineShadowOfPast` reserves real IDs and delays physical movement
until each reveal continuation begins. It reveals the actual Laser and Light
Show, then shuffles the three actual Strikes. An already moved source is not
reconstructed. Use this helper before generic Shadows generation, and retain
the ordinary encounter/set-aside/resolving/removed conservation accounting.

Living Laser keeps native Quickstrike. `warMachineEnemyKeywords(view,p)`
adds Piercing only to that unblanked physical minion's attacks. The star by
its ATK/text marks the referenced attack ability; it is not a boost ability.
Deadly Light Show has fixed base threat three, Hinder one per player and
Crisis. On actual defeat, `warMachineSchemeDefeated` deals one simultaneous
nonattack damage to **each identity**, including alter egos, with ordinary
Tough/prevention and defeat handling.

Laser Strike's When Revealed chooses and discards one actual discardable
controlled upgrade. If none can be discarded, it emits native `surge` with
`sourceCode:23031`. Its Boost discards an upgrade only during an **undefended
attack**; it does nothing during scheming or a defended attack and does not
gain Surge when no upgrade exists. Permanent/cannot-discard upgrades are
excluded by `canDiscardUpgrade`. Equipment Malfunction freely offers alter
ego, then either exhausts ready James Rhodes to remove the physical obligation
or removes every identity ammo, gains native Surge if zero, one or two were
removed, and discards the obligation. Free alter-ego change clears ammo first,
so the second option after that change removes zero and gains Surge. Bunker
counters do not count toward that threshold.

**Original-scan boost verification:** `23030.webp` shows three numeric boost
chevrons. `23031.webp` shows one numeric boost chevron and a separate star for
its printed Boost ability. The raw catalog's numeric values 3 and 1 are correct;
the star does not add a numeric boost. Obligation `23028` and Living Laser
`23029` correctly show two numeric boosts in the catalog.

All module state and choices are serialized scalar flags, physical IDs and
plain Effect records. `tests/war-machine.test.ts` checks original quantities,
optional form ordering, phase limits, separate counter zones, actual searches,
Gun funding/timing, pre-status costs, one-packet attacks, nonattack batches,
physical nemesis movement, obligation thresholds and boost conditions.

## Native engine verification

The host connects the module through ordinary payment, actual form changes,
native ability and event resolution, physical ally entry, phase boundaries,
enemy keywords, encounter reveals and boost windows. Save migration creates
missing nemesis cards with the root allocator across every player seat; an
existing empty set-aside zone stays empty.

On 2026-10-08, the identity suite passed **102 tests**: 64 pure module cases and
38 native engine cases in `tests/war-machine-engine.test.ts`. Native checks
retain all forty original player IDs and all five real nemesis IDs. They cover
p2 Gun ownership and saved payments, atomic refusal/cancel, paid Guns at zero
resource cost, ammo paid before Stun/Confuse, Shoulder Cannon readiness before
Retaliate, and actual Overkill without a second attack. Simultaneous Light Show
damage reaches both identities before first-seat elimination, including a
second-seat Drax defeat replacement. A p2 Iron Man put into play by actual
Sneak Attack searches the final actual deck card, preserves that upgrade ID,
resets its owner's deck once, and advances the shared seed/hidden-information
records without changing the other player's zones. Physical Chassis blanking
and stunned Missile Launcher cost payment have native controls as well.

This focused evidence covers the identity host. Full regression, production
browser checks and publication are recorded separately in the release log.
