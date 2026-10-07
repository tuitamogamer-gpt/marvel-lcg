# Groot and Rocket Raccoon native integration

Groot and Rocket Raccoon are playable from their original Galaxy's Most Wanted
Protection and Aggression starter lists. Each list contains exactly 40 physical
cards with the original GMW printing codes. Both identities, their signatures,
the shared player pool, obligations and nemeses register all 59 faces from
`16001a/b` through `16057`. The 49 dedicated faces use `groot.ts`, `rocket.ts`
and `gmw-player-pack.ts`; ten exact Core printings use existing native rules.

The installed collection now has 19 of 69 native identities, 910 executable
registrations and 431 dedicated faces. The box has 60 of its 207 faces
registered because `16079` was already Core-equivalent. Its five scenarios,
remaining modular encounters, market and campaign are pending. These counts
describe the local implementation and do not establish remote publication.

## Identity rules and shared engine

The [Groot contract](groot-integration.md) records growth counters, their cap,
form and round persistence, Vines costs, distinct We Are Groot targets, and his
obligation and nemesis. Tough precedes the forced Flora Colossus interrupt;
DEF precedes damage, growth precedes optional prevention, and each actual
recipient's counters are spent exactly once for that packet. Direct, attack,
retaliate, overkill and allocated indirect damage share the same rules.

The [Rocket contract](rocket-integration.md) records Tech charges, physical
Tinkering and Salvage costs, repeated basic-thwart responses, simultaneous
Rocket Launcher damage, and his obligation and nemesis. Zero-charge signature
weapons remain in play. Schadenfreude heals for each enemy actually damaged;
Murdered You responds to actual excess from Rocket's identity sources.
Allies, supports, prevented damage and absorbing attachments cannot create
false identity damage responses. A final event is discarded before Rocket's
damage response and that response precedes the surviving enemy's Retaliate.
Separate event sentences retain response windows between their clauses.

Follow Through modifies positive excess rather than the attack's base damage.
Each physical copy is optional and usable once per attack packet. Into the
Fray counts modified excess; Crisis still prevents removing main-scheme threat.
The shared interrupt also covers Captain America's Heroic Strike and Shield
Toss, and Black Panther's Vibranium Suit. Captain's simultaneous packets retain
the first player's forced-response choice, and a saved Suit continuation never
heals its controller twice.
Hand Cannon supplies a basic attack bonus and overkill, including Wasp's
distributed Giant attack, and its Uses keyword discards it at zero counters.
Rocket Raccoon's ally interrupt is optional and supplies +3 ATK and overkill
against the chosen minion. Starhawk can return before exact net lethal damage;
the declared ally defender remains the attack's target after he leaves play.

Dauntless and Fighting Fit compare current HP to printed starting identity HP.
Deft Focus discounts the next Superpower played during the current turn.
Looking for Trouble completes its encounter-discard additional cost before
Confused can replace its thwart. Flora and Fauna supports actual identities
and named allies, preserving physical target, counter and control ownership.
All choices, payments and programs remain serializable across saved games.

## Current Overkill rule

The [Rules Reference 1.8, page 31](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf)
requires the initial minion or ally to be defeated before transferring excess.
FFG's [Mission Updates, 18 September 2026](https://www.fantasyflightgames.com/mission-updates/)
explains the changed keyword timing and the precedence of published rules over
preliminary contact-form answers. A Loki or minion healed instead of defeat
therefore produces no Overkill transfer. Rocket can still respond to the
original actual excess damage. The engine preserves these existing Thor and
Biomechanical Upgrades regressions; older archived Loki rulings do not override
the current published rule.

## Validation

Focused modules, native adapters and independent review tests cover original
source decks, physical card conservation, costs, statuses, enemy damage,
multiplayer recipients and saved decisions. The source-deck mission matrix
covers 1,260 configurations across fourteen expansion identities, five
scenarios, both difficulties and nine modular sets.

`npm run test:gmw-heroes` checks both catalog source launches and visible growth
and charge counters, Groot's growth actions and Tough priority, distinct Tough
targets, Rocket's Tinkering and Salvage, Cannon/Follow Through, Reload and
Flora and Fauna at desktop and phone widths.

Final production verification passes the TypeScript/Vite build and native Node
account API entry (HTTP 200, 40 TypeScript modules and six JSON dependencies).
The production browser run verifies both exact 40-card source launches and all
six native scenarios at 1440px: 26 accessibility audits, 24 layout checks and
no violations or browser errors. The general action-flow browser check passes
six checks and six audits on the development server; its source-module imports
require that server. All 53 inventory source hashes match the frozen files.
Local evidence is in `output/gmw-production-verification/report.json`,
`output/gmw-heroes-production/report.json` and `output/flow/report.json`.

The final frozen-source suite passes **3,724 tests**, with one existing skipped
test across 83 files, including all 1,260 source-deck mission configurations.
The GMW modules, native adapters and independent rules reviews contribute 294
passing cases. Formatting and `git diff --check` pass. The complete regression
log is `output/gmw-final-regression.log`.

The final development browser run passes eight checks, 98 accessibility audits
and 96 layout checks at 1440, 1280, 390 and 320px, with no violations, overflow
failures or browser errors. Both source launches and all six native flows retain
all 40 physical source IDs through choices, payments and reloads. It captures
98 screenshots in `output/gmw-heroes`; the report is
`output/gmw-heroes/report.json`. The combined local verification record is
`output/gmw-heroes-local/report.json`.

The next chronological Hero Packs are Star-Lord and Gamora (14 May 2021).
