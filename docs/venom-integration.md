# Venom integration

`src/game/venom.ts` implements the original Venom Hero Pack with canonical hero
ID `vnm`. The dedicated face list is `VENOM_SCRIPT_CODES`: `20001a/b`,
`20002–20010`, `20023`, `20024`, and `20025` (14 faces). The nine player
definitions `20002–20010` supply **15 actual signature cards**: two Behind
Enemy Lines, two Grasping Tendrils, one Locked and Loaded, three Run and Gun,
two Savage Attack, one Project Rebirth 2.0, one Multi-Gun, one Spider-Sense,
and two Venom's Pistols. Original catalog faces provide stats, traits,
resources, printed costs, names, art, and encounter icons.

Sources are the original faces in `src/data/catalog-cards.json`, the
[Venom pack insert](https://hallofheroeslcg.com/wp-content/uploads/2021/07/venominsert.jpg),
and the [official Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).
The current rules settle full damage costs and overpayment (pp. 13–14), Crisis
(p. 14), resource generation and payment (p. 37), and Grasping Tendrils counting
as a hero defense when the attack is canceled (p. 62). The Focused Rage FAQ
also forbids attempting a take-damage cost merely to remove Tough (p. 57).

## Physical setup and nemesis ownership

`player.setAside?: Piece[]` is a serialized, seat-owned physical card zone.
`venomInitializeNemesis` creates exactly one Klyntar Frenzy and four distinct
Enraged Symbiotes only when that zone is **missing**. A present empty zone means
the cards have already left it and must never be replenished. The host calls
this helper during new hero creation and its one-time old-save migration. The
zone belongs in ownership/conservation traversals and elimination handling.

After all mulligans, queue `venomSetup`: Armed and Ready discards actual top
cards until it discards a Weapon **upgrade**, then moves that same physical
card into hand. `discardPlayerTop` performs ordinary deck exhaustion handling
and reports whether the original deck emptied, even after an immediate recycle.
The search stops there if no Weapon was found, preventing an infinite search
through a reshuffled deck. A Weapon discarded last may already be in the
recycled deck; the module removes its exact ID from that zone before adding it
to hand.

`venomShadowOfPast` replaces the ordinary one-minion procedure. The pack insert
requires **all remaining** set-aside Enraged Symbiotes to enter play engaged
with Venom, followed by the actual set-aside Klyntar Frenzy and the encounter
shuffle. Selected IDs are reserved in `venomReservedNemesis`, and each actual
card remains in its set-aside zone until its own reveal starts. Entry-response
pauses therefore conserve every card across reload, while nested obligations
cannot take a card already committed to Shadows. Each reveal carries its owner
as `actorId`. No fresh minion is made at
this point. If an obligation already moved one Symbiote to the first player,
Shadows reveals the other three. If no set-aside minion remains, Shadows gains
surge while still revealing any remaining scheme. Subsequent Shadows also
surges once the player's nemesis flag is set.

Struggle for Control is assigned to Flash's actual seat, optionally changes to
alter-ego without consuming the normal form change, then offers either:

- Exhaust Flash **and actually take all 2 damage**, then **discard** the actual
  obligation. This option is unavailable through Tough or damage immunity; no
  part of an unpayable cost is spent. The obligation is never removed from the
  game by this option. Exhaustion and TAKE are committed together, and the
  discard benefit is queued separately so the host checks lethal damage before
  resolving it.
- Move exactly one actual remaining set-aside Symbiote into play engaged with
  the **first player**, without revealing it. Gain surge if that move cannot be
  made, then discard the obligation.

Enraged Symbiote's boost uses `putBoostMinion` to move the actual boost piece
into play and retain its ID from activation cleanup. Generic Guard, Patrol,
hazard icons, minion statistics, and ordinary defeat handling stay in the host.

## Payment and windows

`venomResourceSources` and `venomResourceSpent` expose `symbiotic-bond`, a wild
resource in hero form, once per phase. The host's `canTakeDamageCost` rejects
Tough, damage immunity, and compulsory prevention. `takeDamageCost` must
commit the **full** actual take-damage cost atomically before the generated
resource can pay another cost. A failed commit does not spend the phase limit.
`venomPhaseEnded` clears that serialized phase marker for every seat.

`venomEvent(s,p,paid)` receives the actual typed resources allocated to that
card's resource cost, after wild-type choices. RRG p. 13 explicitly says
resources generated beyond a specified cost **were not paid for that cost**.
The host must therefore retain the chosen allocation when a mixed generated
pool contains surplus icons; the module never chooses an allocation by slicing
or sorting. A bonus requires a nonempty allocation entirely of the named type.
Free play cannot earn a bonus by generating excess resources.

`venomAttackInitiatedOptions` runs for the initial attacked hero before boosts
or defender declaration. Its saved `VenomAttackInitiation` carries attacker,
initial target player, villain/minion discrimination, and physical Spider-Sense
IDs already used for this attack. Spider-Sense draws before the repeated window,
so it can draw Grasping Tendrils and offer that actual new hand card immediately.
It does not exhaust and may trigger again for the next attack. A flat serialized
`sharedWindow` continuation reopens the native union of Spider-Sense, Tendrils,
First Hit, Subdue, Nova, and Mockingbird after an interrupt resolves. Enemy
attacks against another enemy still offer First Hit/Subdue and abort when their
attacker is defeated. Moondragon's redirected attack uses actual native attack
damage, preserving Tough, attack reductions, Piercing, Overkill to the villain,
and one Retaliate window. It opens no identity defense or incoming identity
damage responses. Tendrils uses a
normal cancelable `payRequest` and `resolveHandEvent` for its actual physical
hand card; it supplies no continuation that resumes the canceled attack.

The host's `cancelVillainAttack(s,clauses)` must resolve the optional
all-physical stun, finish the actual event and its paid-event aftermath, and
open native defense completion with `heroDefended=true`, `basicDefense=false`,
and zero identity damage. This allows Indomitable and Unflappable. It must
preserve end-of-activation cleanup and the surrounding phase queue while
skipping boosts, defender declaration, damage, Retaliate, and responses that
require an actual attack or activation to have resolved. Venom does not exhaust
to play this defense event. Forced attack-initiation interrupts precede this
optional window.

`venomBasicPowerOptions` offers each actual ready, unblanked Pistol when Venom
uses a native basic attack, thwart, or defense. Both copies can stack. The host
opens this after Stun/Confuse replacement checks; alter-ego recovery, ally basic
powers, and defense events do not qualify. Saved `basicPower.amount` increases
by one per exhausted Pistol; `venomBasicBonus` records the same increase for
adapters whose native amount has not yet been captured. Do not count both
fields twice. Basic defense adds to the current `attack.defenseBonus`. These
bonuses affect only that physical basic power use and survive save/reload.

## Actions and continuous rules

The host adds `venomRestrictedAllowance(s)` to its general Restricted capacity
in **both** forms. Side Holster's additional Weapon-only slot remains a separate
constraint; combining the two allowances does not turn every restricted
upgrade into a Weapon.

The native ability IDs are `rebirth-draw` / `rebirth-heal` for Project Rebirth,
and `multi-damage` / `multi-minions` / `multi-threat` for Multi-Gun. Each commits
the actual support/upgrade's exhaustion before resolving its chosen effect.
Project Rebirth is alter-ego only and heals no higher than maximum HP.
Multi-Gun is hero only. Its damage is **not an attack** and its threat removal
is **not a thwart**: Guard, Stun, Confuse, and Patrol do not apply to those
effects. Crisis still prevents every player-card main-scheme removal. The
chosen player's minions receive one simultaneous damage batch, with ordinary
Tough and defeat handling supplied by `damageBatch`.

`venomSchemeLocked(s,target)` belongs in the host's common threat-removal
legality and execution paths, including every other hero/player effect. An
unblanked Klyntar Frenzy prevents threat removal while **any Symbiote enemy** is
in play, even one engaged with another player or a Symbiote villain. An enemy
retains its traits when its printed abilities are blanked. Friendly heroes and
allies do not create this lock.

Locked and Loaded searches actual Weapon upgrades in the deck, adds the chosen
card to hand, and shuffles the searched deck even with no result. It is usable
in either form. Run and Gun readies Venom and each controlled Weapon upgrade;
it does not ready another player's Weapon, a support, or a Weapon attachment.
Behind Enemy Lines removes threat before separately selecting its all-mental
confusion target. Savage Attack's all-energy bonus gives its attack Overkill.
Native attack/thwart event status replacement must run before the module's
event effects, so a replaced event cannot resolve a conditional bonus.

The module's continuations consist only of serializable effect records and
actual physical IDs/pieces. Unit tests in `tests/venom.test.ts` cover these
physical zones, costs, phase limits, conditional receipts, basic power windows,
timing order, target restrictions, and save/reload. Native engine acceptance
is maintained separately in `tests/venom-engine.test.ts`; shared interruption
and Moondragon attack regressions are in `tests/venom-shared-interrupts.test.ts`.
