# Sinister Motives hero player pool contract

`src/game/sinister-player-pack.ts` owns **33 original non-set player faces**:
Ghost-Spider's supplementary `27010–27024`, Miles Morales's supplementary
`27040–27055`, and the genuine optional player cards `27190` Venom and `27191`
Symbiote Suit. Hero signatures, nemeses, obligations, scenario/modular cards,
campaign cards and S.H.I.E.L.D. Tech rewards are outside this module.

`SINISTER_PLAYER_PACK_SCRIPT_CODES` contains **26 dedicated original faces**.
`SINISTER_PLAYER_PACK_CORE_ALIASES` contains only seven exact Core reprints.
The comparison uses sixteen gameplay fields: name, type, faction, cost, text,
traits, ATK, THW, DEF, HP, both consequential-damage values, and all four
printed resource values. Physical source code, quantity and ID remain original.

| Original                | Exact Core script |
| ----------------------- | ----------------- |
| 27020 / 27051 Energy    | 01088             |
| 27021 / 27052 Genius    | 01089             |
| 27022 / 27053 Strength  | 01090             |
| 27045 Surveillance Team | 01064             |

Bait and Switch is a non-Core reprint with its own original `27013` script;
both Young Love faces `27019` and `27050` remain dedicated. They share printed
behavior, not invented Core aliases. Young Love's Max 1 per deck applies by
card title across both printings. Its controller's chosen identity must be
Gwen Stacy or Miles Morales, both named characters must be in play, and at
least one must have damage to heal. Current hero/alter-ego face does not
change a chosen identity's printed alter-ego name.

Source starters remain exactly **40** cards. Ghost-Spider has 15 signature,
15 Protection and 10 Basic cards. Miles has 15 signature, 13 Justice and 12
Basic cards. Neither has a setup reserve. Optional Venom and the four supplied
Symbiote Suits are **not inserted into either starter**. Suit is Max 1 per deck;
its printed quantity four does not authorize four copies in one constructed
deck. No artificial resource cards are added.

Sources are original `public/cards/catalog/27xxx.webp` scans,
[the original Sinister Motives gallery](https://hallofheroeslcg.com/sinister-motives/),
[official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/), and
[RRG 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).
RRG's Across the Spider-Verse FAQ confirms that its repeat clause can itself
repeat. The official rulings permit its PUT effect to ignore Requirement and
permit Jump Flip against nonattack damage. The hazard ruling distributes extra
cards in ordinary player order, independent of the Suit/Venom controller.

## Printed closure

| Code          | Dedicated face             | Native hook / effect                                                                           |
| ------------- | -------------------------- | ---------------------------------------------------------------------------------------------- |
| 27010         | Silk                       | Hand-PLAY response; search actual encounter treachery, discard, shuffle                        |
| 27011         | Spider-Man — Miles Morales | Hand-PLAY response; 3 controlled Web-Warriors, stun/confuse enemy                              |
| 27012         | Spider-UK                  | Actual ally-defense Interrupt; damage its attacker by controlled Web-Warrior count             |
| 27013         | Bait and Switch            | Native villain attack, then 4-threat main-scheme thwart                                        |
| 27014         | Jump Flip                  | Actual damage-window defense PLAY; prevent 2, Energy bonus ordinary threat removal             |
| 27015         | Return the Favor           | Discard/reveal actual treachery as additional cost, then 5-damage villain attack               |
| 27016         | What Doesn't Kill Me       | Physical Requirement; exactly 2 healing as cost, then ready hero                               |
| 27017         | Spider-Man — Hobie Brown   | Before-leave Interrupt; actual discard 3, numeric-only boost damage                            |
| 27018         | Across the Spider-Verse    | Exhaust own Web-Warrior, PUT actual discard ally, optional paid recursive repeat               |
| 27019 / 27050 | Young Love                 | Actual Gwen/Miles identity or ally targets; heal 3 each in alter ego                           |
| 27023         | Web of Life and Destiny    | Identity-trait cost waiver; after actual Web-Warrior ally leave choose who draws               |
| 27024         | Plan B                     | Actual controller/max 1 per player; random true-hand discard cost, 2 nonattack damage          |
| 27040         | Monica Chang               | Any-entry response; PUT actual Surveillance Team, then counter on every controlled Team        |
| 27041         | Spider-Woman               | Cost reduction for every actually confused enemy in play                                       |
| 27042         | Homeland Intervention      | Exhaust up to 3 actual controlled S.H.I.E.L.D. cards; ordinary threat removal                  |
| 27043         | Global Logistics           | Exhaust actual S.H.I.E.L.D. source; inspect actual top 4 IDs and arrange/discard them          |
| 27044         | Field Agent                | Native consequential-damage Interrupt; exhaust, spend counter, prevent 1                       |
| 27046         | Agent 13                   | After performed ally attack/thwart; ready any legal S.H.I.E.L.D. support                       |
| 27047         | Dum Dum Dugan              | Actual basic-use Interrupt; distinct controlled S.H.I.E.L.D. exhaustion and scoped power bonus |
| 27048         | Ghost-Spider — Gwen Stacy  | Before-leave Interrupt; search actual identity event, add same ID, shuffle                     |
| 27049         | Spider-Man — Peter Parker  | Three distinct Requirements; after attack/thwart ready another Web-Warrior character           |
| 27054         | Government Liaison         | Actual hand PLAY of S.H.I.E.L.D. card with 1 discount after exhausting source                  |
| 27055         | Sky-Destroyer              | Actual S.H.I.E.L.D. PLAY response; exhaust source for 2 nonattack damage                       |
| 27190         | Venom — Eddie Brock        | After own encounter reveal; deal 1 damage cost, actual numeric + star count, nonattack damage  |
| 27191         | Symbiote Suit              | +1 ATK/THW/DEF/REC, +1 hand size, +10 HP and printed hazard                                    |

## Provider and source interfaces

`sinisterPlayerPackRequirements` retains Physical on `27016` and Energy,
Mental and Physical on `27049`, even after discounts reduce resource cost to
zero. Ordinary native Wild allocation can substitute for a required resource;
the three listed requirements each need a separate spent resource. PUT by
Across the Spider-Verse does not PLAY the ally and does not pay Requirement.

`sinisterPlayerPackCostReduction` applies Web of Life's full printed cost
waiver only when the **current identity** has Web-Warrior, rather than merely
controlling an ally. Spider-Woman counts each actually confused villain/minion,
including other players' minions; one Confuse card on a Steady enemy is not
enough to make that enemy confused.

`sinisterPlayerPackIdentityModifiers` supplies Suit modifiers in both forms,
including REC. Use normal native maximum/current HP modifier handling on
entry, departure and blanking; do not model its +10 HP as ordinary healing.
Its text bonuses disappear while blank. `sinisterPlayerPackHazards` counts the
actual printed icons on **both** Venom and Suit; those icons are outside their
ability text and survive text blanking. The normal hazard step distributes
those additional encounter cards in first-player order.

Trait ports must preserve the complete abbreviation **`S.H.I.E.L.D.`**;
splitting every period into a separate trait is incorrect. `controlledTraitCards`
includes actual controlled allies/supports/upgrades and the actual identity
when its current traits qualify. Identity references use `hero:<playerId>`;
they are not temporary physical Piece clones. `characterTargets` includes only
actual exhausted readyable identities/allies across players, not Web-Warrior
supports such as Web of Life. `identityName` supplies the printed alter-ego
identity name independent of the current face for Team-Up matching.

`handPlayableCards` supplies true hand cards plus actual events permitted to
PLAY as if in hand, including George Stacy storage. Jump Flip and Government
Liaison can use those actual sources. This permission does **not** expose
stored events as resources or random hand-discard costs. Native PLAY preserves
the selected physical ID and original `ownerId`; canceled payment leaves its
source in place. Plan B's printed random discard uses only the true hand,
updates the native shared random seed/hidden-information record, and discards
to the actual owner before its damage benefit.

## Entry, powers, departures and timing

Silk and Miles's ally only respond to actual **PLAY from hand**; Bifrost PLAY
from deck and ordinary PUT do not satisfy that condition. Silk needs another
controlled Web-Warrior, which may be the hero or Web of Life. Miles needs
three, including his own actual ally. Spider-UK's Interrupt resolves after
actual defender declaration and before incoming damage. Its damage is
nonattack, and killing the actual attacker ends the native attack. No hero
identity exhaustion or fictitious defense receipt is introduced.

Monica responds to any actual entry, including PUT. Its search covers the
controller's deck, hand and discard and recognizes actual Surveillance Team
printings by name. `putCard` performs native uniqueness, source movement and
Uses entry; then Monica adds one counter to each currently controlled Team,
including the new one and blanked Teams. Preserve the actual original ID and
shuffle through ordinary native deck exhaustion windows.

Dugan's receipt identifies one ongoing actual ally **basic-use token**. Its
bonus belongs only to that use and is read after exhausting up to three
distinct controlled ready S.H.I.E.L.D. cards. Dugan himself has already paid
basic exhaustion and cannot be exhausted again for this cost. Agent 13 and
Peter respond after performed ally attacks/thwarts, before normal consequential
damage. A replaced basic power does not produce their receipt. Agent 13 can
ready another player's support; Peter chooses another actual Web-Warrior
character and cannot ready himself or a support.

Field Agent requires its controller's hero form and a real pending
consequential-damage receipt for a S.H.I.E.L.D. ally. Each selected source
exhausts, spends one backup counter and prevents one of that specific damage
instance. Ordinary ally self-damage costs, enemy damage and event damage are
not consequential damage. Discard the actual Field Agent after its last
counter through native leave-play handling. Fresh sources can respond only
while positive consequential damage remains.

Hobie and Gwen are optional **before-leave Interrupts** on their actual ally
instances. Keep normal pending native departure/defeat until they resolve or
decline. Hobie discards three actual encounter cards and counts numeric boosts
only, including native encounter exhaustion/count controls. Gwen searches the
controller's actual deck for any Hero-faction event, adds its same ID to hand
and shuffles. Web of Life instead responds **after the actual departure** using
the leaving ally's captured traits; it may draw for any surviving player and
then resumes the support controller's context.

Plan B's entry chooses any legal controller without another Plan B. Transfer
the same actual Piece, retaining original ownership. Its action uses the
controller's true hand and enemies. Max 1 per player is a control limit, not
an invented Max 1 per deck; the original Ghost source legitimately contains
three physical copies.

## Event costs, damage windows and repetition

`sinisterPlayerPackBeforeEvent` runs after native resource payment and before
Stun/Confuse replacement. Return the Favor discards until an actual treachery
is found, then reveals **that same discarded card as an additional cost**.
Resolve its full reveal, Peril/Surge and other native windows before the
five-damage attack benefit or Stun replacement. Replay pays a fresh cost;
the discarded source is not regenerated. What Doesn't Kill Me heals exactly
two damage as cost; one damage cannot pay it, and the ready benefit requires
an exhausted identity that can ready. Native health modifiers determine the
actual two-damage deficit.

Bait's complete villain attack precedes its four-threat thwart. Confuse
replacement cancels the entire thwart-labeled event body, including that
villain attack. Its later threat removal is an actual hero thwart action.
Homeland and Jump Flip's Energy bonus instead remove threat without a thwart
label or native thwart-response window; Confuse does not replace them.

Jump Flip uses `SinisterPlayerDamageReceipt` for an actual positive pending
damage instance aimed at its controller's hero. It works against attack and
nonattack damage. During an attack its actual paid defense PLAY establishes
the identity defender/late-defense ownership through the native defense
program; outside an attack it prevents damage without creating an attack,
defender or after-defense trigger. Keep classification attached to the actual
damage receipt, rather than treating any still-retained attack object as proof
that unrelated damage is attack damage. Count actual paid Energy for its
bonus. Its completed Interrupt is also a normal event-resolution receipt for
Ghost-Spider, where at least one effect resolved.

Across the Spider-Verse exhausts one actual ready controlled Web-Warrior and
PUTs a legal actual Web-Warrior ally from that actor's discard. Its optional
chosen contributor pays three real resources and repeats **the whole ability,
including the recursive clause and another actual exhaustion cost**. A repeat
is card-instructed resolution, not a new event PLAY or Hero Action initiation;
an alter-ego contributor can repeat with a ready controlled Web-Warrior ally
or support. Payment cancellation leaves that contributor's cards unchanged.
Selected contributors use their own resource restrictions, discard and
controlled sources. The three-resource repeat is an ability cost: native
`payRepeat` uses `abilityCost: true`, so resources that double only while
paying for a Basic card do not double here. After the chain the original
event controller resumes.

Global Logistics exhausts its actual source before looking at a chosen
player/encounter deck. `lookDeck` captures up to four actual top IDs without
moving them or resetting a deck merely for looking. Serialized choices assign
discard/top/bottom destinations and an explicit order. `arrangeDeck` atomically
commits those same IDs, invokes native owner-aware discard and legitimate
reset windows, and retains untouched deck cards. Top and bottom arrays use
normal deck reading order, nearest top first. No temporary hidden cards or
replacement resource cards are created.

Government Liaison exhausts as cost then initiates one ordinary paid PLAY
from the selected permitted hand source with a one-resource discount. It is
not a resource ability; cancellation keeps the support exhausted and the
selected card in its source. Native PLAY/Requirement/entry responses still
apply. Sky-Destroyer observes actual S.H.I.E.L.D. PLAY, including a played
event whose effects were canceled; PUT does not qualify. Source IDs captured
at that trigger and a unique per-PLAY token prevent a source responding twice
if it is readied during the same window.

Venom observes only the revealing player's completed actual encounter reveal.
The receipt preserves that card's physical ID. Dealing one damage to Venom is
a cost, which remains paid when Tough/prevention prevents taking that damage.
A lethal cost can remove Venom before the retained benefit. Count numeric
boost **and star** icons through native count controls, then deal that count
as nonattack damage; retain the physical source and chosen target through
departure. A unique reveal token prevents repeating the same source's response
to the same reveal.

## Verification scope

The frozen pure suite has **56 passing tests**; combined with Ghost-Spider's
67 pure tests it passes **123/123**. Full `npx tsc -b` passes on the current
shared Sinister baseline.

Pure tests hydrate JSON before every choice and inspect exact source movements,
cost-before-benefit order, native packet flags, actor restoration and receipt
limits. They cover the explicit33-face closure/7exact aliases, both40-card
starters without optional additions, both Suit forms/icons, ally entry/leave
distinctions, basic-use bonuses, pre-status costs, damage/consequential windows,
actual deck arrangements, ownership/control, repeat contribution and PLAY
receipts. Native host installation, native acceptance suites, full regression
and browser verification are separate prerequisites. This module does not
claim any Sinister scenario or campaign implementation.

`tests/sinister-player-pack-engine.test.ts` supplies 24 independent native
acceptance tests using real Ghost/Miles initialization, ordinary commands and
JSON reloads. Both original forty-card source-ID sets remain conserved;
extra optional fixture cards use their actual printed codes and owners.
All 24 acceptance cases pass. Together with the native host's 15 controls,
the module has **39 passing native tests and 56 passing pure tests (95 total)**.
Government Liaison PLAYs the actual George-stored S.H.I.E.L.D. event. A paid
Jump Flip's actual PLAY token combines Flow Like Water and Web-Bracelet in
the same response window before the original incoming-damage continuation.
Native Scarlet Witch counting retains star icons when a replacement card
is counted for Venom; numeric-only Hobie counting excludes them.

Return the Favor requires an initially legal villain attack target, preserving
ordinary Stun replacement. Its actual treachery reveal remains a paid cost
when that reveal introduces Guard or otherwise removes the remaining attack's
legal target. After the cost, consume Stun normally; if the target becomes
illegal, retain the paid PLAY and resolve the remainder as far as possible
without throwing. Hero Action form requirements are checked at initiation
(RRG 1.8 p24–25), so a change to alter-ego during the reveal cost does not
stop an already-initiated attack against a still-legal villain. The pure
control proves this five-damage attack after the form change. The native
control reveals the actual Wicked
Ambitions ID, puts its actual Goblin Thrall Guard into play, and preserves
both IDs while omitting the now-illegal villain attack.

Homeland Intervention requires a scheme with removable threat before PLAY.
Its ordinary threat removal uses non-thwart scheme legality, so Confuse and
Patrol do not provide an exception or block its removal. This target gate
does not apply to Global Logistics's independent deck inspection.

The native Government Liaison host supplies `canPlayWithDiscount(s, piece, discount, exhaustId?)` to check actual ordinary PLAY legality before initiation, after the support exhausts and on selection. Its availability preview temporarily treats the same physical support as exhausted, then restores it; a Homeland Intervention needing that sole ready S.H.I.E.L.D. source cannot start an empty play choice. Native validation preserves form, uniqueness, Requirements and actual George-stored permissions. The exact Rhino/expert/running-interference failure seed `34012` now passes alongside no-threat and sole-cost-source controls (`output/sinister-government-fix-final.log`).
