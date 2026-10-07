# Groot integration contract

Groot (`groot`, `16001a/b`) uses the immutable Galaxy's Most Wanted card
printings. His identity module registers 16 faces: both identity faces, the ten
signature definitions (`16002–16011`), Wilt and the three nemesis definitions
(`16025–16028`). Printed signature quantities total 15 physical player cards.
His original preconstructed deck is Protection and preserves 40 source cards.

## Counters, damage and form

Groot has 10 HP, 2 ATK, 1 THW and 3 DEF; his alter-ego has 4 REC. Printed hand
sizes are 5 and 6. Growth counters are stored on the actual player's identity
as `flags.grootGrowthCounters`, initially zero, with a maximum of ten. They
persist through changes of form and saved-game hydration. The public
`grootGrowthCounters` accessor and `grootAddGrowthCounters` mutator also support
the Flora and Fauna team-up through the actual Groot player's seat view.

Flora Colossus is a forced damage interrupt on the hero face. Tough resolves
first and prevents the complete packet without consuming growth counters.
Otherwise Groot removes as many counters as possible, preventing one damage
per counter, before optional damage interrupts. Any remaining damage proceeds
through the native damage path. This applies to attack, direct, retaliate,
overkill and allocated indirect damage received by Groot, including when he
defends another player. It does not protect his allies, a different hero or his
alter-ego. The host runs this mandatory interrupt exactly once per native
packet, using the actual recipient's seat view.

Indirect damage is allocated among the affected player's controlled characters
before prevention. Native allocation respects remaining HP rather than adding
Groot's growth counters to his available HP. Each allocated packet then uses
the same status and damage interrupt ordering.

## Native actions and signatures

- Growth Spurt is an alter-ego action, once per round, that places two capped
  counters without exhausting Groot. Its serialized limit is
  `flags.grootGrowthSpurtRound` and its action ID is `growth-spurt`.
- Fruition places two capped counters in either form. The growth-based attack
  and thwart events use the counter total at their actual resolution without
  spending those counters. Their ordinary attack and thwart labels retain
  native Guard, Crisis, Patrol and Stun/Confuse rules.
- Root Stomp deals one five-damage attack packet. A native checkpoint records
  the exact target instance and villain stage. Only an actual defeat caused
  by that attack places one capped counter; prevention, surviving enemies or
  status replacement cannot produce a reward.
- We Are Groot lets the player remove up to four actual counters as a cost
  before choosing that many distinct legal friendly characters. Its saved
  effect program retains chosen physical IDs and supports other players'
  heroes and allies. Already Tough characters are excluded. Steady and
  Stalwart prevent or alter Stun/Confuse; they do not prohibit gaining Tough.
- Fertile Ground is an alter-ego action (`fertile-ground`). It exhausts the
  actual support, places one capped counter and draws one card. Its draw
  still resolves when Groot already has ten counters.
- Entangling Vines and Vine Spikes remove one actual counter and exhaust the
  actual upgrade before adding two THW or ATK to that single basic use.
  Stun/Confuse replaces the basic power before those interrupts are offered,
  leaving the upgrade and counters untouched.
- Vine Shield applies only when Groot is the actual basic defender. Removing
  one counter and exhausting it gives three DEF for that attack. It cannot
  claim another hero's or ally's defense.
- Lashing Vines responds after an actual basic power, including defense. It
  removes two counters and exhausts the actual upgrade before readying Groot.
  It respects the current hero form, the actual controlling player and shared
  ready restrictions. A Stun/Confuse replacement produces no response window.

## Obligation and nemesis

Wilt resolves for the actual Groot player. The optional change to alter-ego
does not consume their normal voluntary change of form. Exhausting alter-ego
removes the exact resolving obligation from the game. The other branch
removes up to three available counters and discards the obligation. Removing
one or two counters still satisfies the "if no counters" check: only zero
removed counters gives surge and deals a facedown encounter card.

Blazing Inferno deals two indirect damage to each live player after the villain
phase begins. Furnax deals two indirect damage to each live player after an
actual completed activation, including either attack or scheme. Replacing that
activation with Stun/Confuse does not trigger it. Blank or departed sources
cannot trigger their own response. Fan the Flames combines its two base
indirect damage with one additional point for each actual in-play Blazing
Inferno and Furnax, yielding one native allocation packet of two, three or
four. These encounter faces have no printed boost-star abilities.

## Adapter contract

`GrootPorts` extends the shared `AntManPorts` with `friendlyTargets`. Effects
use only JSON-serializable physical IDs, counter costs and continuation arrays.
The host connects `grootBasicOptions`, `grootDefenseOptions`,
`grootAfterBasicOptions` / `grootAfterBasicPower`, `grootPreventDamage`,
`grootEnemyActivated` and `grootVillainPhaseBegin` to the corresponding native
windows. `grootPreventDamage` returns the amount prevented and commits the
counter cost; the caller applies that prevention to the same existing packet.

## Validation and sources

The 54 focused module cases pass. They cover actual counter ownership, cap and
round limits, form persistence, Tough priority, foreign-seat defense, partial
and complete packet prevention, event status replacement, physical defeat checkpoints, Vines costs,
shared ready restrictions, distinct friendly targets, saved continuations,
Wilt's partial-counter behavior and every native nemesis clause. Native engine,
browser and full regression results are recorded after the shared integration
is complete.

- [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf):
  Ability and Alteration Effect (pages 4 and 7), Basic Power (page 10), Damage
  (page 13), Forced (page 20), Change Form (page 21), Indirect Damage and
  Initiating Abilities (page 24), Status Cards (page 41) and Tough (page 44).
- [Galaxy's Most Wanted rulebook](https://hallofheroeslcg.com/wp-content/uploads/2021/07/mc16_galaxys_most_wanted_rules_website-compressed.pdf):
  original deck, Groot's growth counters, partial damage prevention and
  explicit Tough-before-Flora-Colossus FAQ.
- [Archived official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/):
  Alex's status-card priority clarification, the Groot FAQ and the ruling that
  a named alter-ego can satisfy a Team-Up card with the same printed title.
