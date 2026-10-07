# Scarlet Witch integration contract

Scarlet Witch (`scw`) is the seventeenth native playable identity. Her original
Justice preconstructed deck preserves all 40 physical source printings. The
Scarlet Witch Hero Pack contains 32 catalog faces: 27 dedicated native faces
and five verified Core reprint aliases. The immutable catalog remains the
source of printed text, quantities, resources and images.

## Identity and signatures

Scarlet Witch has 10 HP, 1 ATK, 2 THW and 2 DEF; Wanda Maximoff has 3 REC.
Their printed hand sizes are 5 and 6. The identity module covers the two
identity faces, eight signature definitions, Slipping Sanity and the four
nemesis definitions (`15001a/b`, `15002–15009`, `15023–15027`).

- Chaos Control is an optional interrupt from the actual Scarlet Witch hero
  face, once per phase. It discards the actual top encounter card, immediately
  recycles an exhausted encounter deck and substitutes that card's numerical
  icon count. Its boost star never becomes a boost ability.
- Superpowered Siblings discards exactly two distinct physical hand cards as a
  cost before drawing. Pietro Maximoff must be in play under that exact name
  or subtitle: the Quicksilver ally counts, a faceup Quicksilver hero does not,
  and a faceup Pietro alter-ego does. The action is once per round.
- The Quicksilver ally readies its actual physical copy once per phase. Its
  ordinary attack, thwart, consequential damage and defense use native ally
  machinery.
- Chaos Magic completes an ordinary legal play from the actual hand, including
  event choices and entry responses, before its encounter discard. It ignores
  the resource cost while retaining other restrictions and additional costs.
  The later discard uses the printed resource cost, independent of reducers
  and Magical Suspension. A player-chosen printed X remains chosen. Costs
  before an ability arrow, including Lightning Strike's X energy and Master of
  the Mystic Arts' Invocation cost, must still be paid separately.
- Hex Bolt discards the entire top-three batch before any count decision. A
  batch stops when the encounter deck empties, even though recycling happens
  immediately. The original physical faces remain available in the serialized
  count program. The player resolves the counted results in any order. Damage
  and threat removal are separate nonattack and nonthwart effects; Crisis still
  blocks main-scheme threat removal. Status results respect native eligibility,
  Steady and Stalwart.
- Molecular Decay chooses a legal attack target, discards and counts up to two
  actual encounter cards and deals one attack packet of 5 plus the complete
  numerical count. Tough prevents the complete packet; a villain stage change
  does not turn its bonus into a second attack.
- Warp Reality responds only to a reveal originating from the encounter deck.
  Its payment and actual event resolution cancel all encounter-card effects,
  including entry, keywords and text, and discard that card once. Only then
  does its second sentence count the canceled card's icons and discard that
  many encounter cards.
- Agatha Harkness exhausts as a cost in alter-ego, reveals the actual top three
  deck cards, puts one into hand and places the others on the bottom in the
  chosen order. Small decks create no extra cards or premature shuffle.
- Magic Shield belongs to its controller and requires that controller's hero
  face. It can protect any actual friendly character, including another
  player's hero or ally. Its actual upgrade is discarded and the same native
  damage packet receives three points of prevention.
- Scarlet Witch's Crest is an optional interrupt in either form. It exhausts
  its actual controlled upgrade and modifies one numerical count by one,
  floored at zero. Chaos Control's replacement window precedes the Crest
  window, so the Crest modifies the final replacement count.

## Shared exact-count program

`scarletWitchCountBoosts` is an asynchronous, JSON-serializable native effect
program. It accepts snapshots of actual physical encounter cards and returns
the individual `boostCounts` and combined `boostTotal` to each continuation.
Every count offers eligible Chaos Control interrupts before eligible Crest
interrupts. Phase limits are stored on the controlling player, and exhaustion
modifies actual controlled upgrades without changing the original actor.

The Next Evolution adds one numerical boost icon to each encounter-card count,
including discarded cards, zero-icon cards and Chaos Control replacements.
Amplify applies only to an actual activation boost card. A discarded
replacement is not a boost card, so Chaos Control removes that original
Amplify modifier. Stars are never numerical boost icons.

The host retains the original activation boost card and its boost ability.
Native attacks and schemes resolve that original ability before their natural
icon count. An earlier cancel-card interrupt may count icons while paying its
own ability; canceled icons receive no later natural count. Each physical
boost instance retains its actual counted value for cancellation bookkeeping.
The same count adapter is used for the existing Quicksilver-pack Scarlet Witch
ally, Black Widow's Attacrobatics, Ms. Marvel's Preemptive Strike and the new
pack effects that count discarded encounter cards.

## Obligation and nemesis

Both physical copies of Slipping Sanity are distinct. The owner may flip
without consuming their normal once-per-round form change. Exhausting Wanda
removes only the resolving obligation copy. The other branch discards up to
five actual encounter cards, stops at exhaustion and places main-scheme threat
for printed boost-area stars. Numerical icon modifiers and replacement
interrupts cannot modify this star count.

The Next Evolution is a continuous global numerical icon modifier while its
text is active. Luminous's forced response follows a completed actual attack
or scheme activation and counts a real top discard before dealing an encounter
card at two or more icons. Magical Suspension attaches to the actual revealed
player's identity and adds one to that player's card-play resource cost. Only
that attached identity's player may trigger its encounter Hero Action,
exhausting their hero to discard the actual attachment. Chaos Manipulation searches the actual
encounter deck and discard for Luminous, reveals and shuffles normally and puts
the physical copy into play. It then independently discards and counts. An
already-in-play Luminous can activate against the revealer even when engaged
with another player; this activation does not change engagement.

## Validation

The identity module has 46 focused cases covering exact counts, replacement,
stars, modifiers, serialized continuations, phase limits, physical hand costs,
deck ordering, nested-play continuations, batch exhaustion, chosen Hex Bolt
order, the combined Molecular Decay packet, friendly prevention, full reveal
cancellation and nemesis behavior. Completed local verification:

- The five Scarlet Witch suites pass 199 cases: 46 identity, 41 pack, 60 native
  acceptance, 42 independent rules review and 10 Chaos Magic free-play cases.
- `npm test`: 3,220 passing cases and one existing skipped case across 72 files.
  The source-deck mission matrix covers 1,080 supported configurations.
- `npm run build`, `npm run format:check` and `git diff --check` pass.
- `npm run test:production-entry` returns HTTP 200 under native Node 24.19.0,
  loading 37 modules and six JSON dependencies.
- `npm run test:flow` passes six existing gameplay checks and six accessibility
  audits without runtime errors.
- `npm run test:scarlet-witch` passes 73 accessibility audits and 72 layout
  checks at 1440, 1280, 390 and 320 pixels. Source-deck launch, Siblings,
  Hex Bolt with Chaos Control and Crest, Agatha with Chaos Magic, Warp Reality,
  Magic Shield and Quicksilver readying preserve all 40 physical source cards
  and saved choices through reload. Reviewed desktop and mobile screenshots
  show contained, readable controls.
- The production bundle passes the same desktop flows, with 22 accessibility
  audits, 21 layout checks and no browser errors. Preview HTML and all four
  referenced assets return HTTP 200; asset names match the built entry.

The regenerated inventory records 861 executable registrations, 382 dedicated
faces, 3,690 unsupported faces, 17 registered identities and 50 source hashes.
Scarlet Witch has all 32 retail faces registered. Reports are saved locally in
`output/scarlet-witch-dev`, `output/scarlet-witch-production` and
`output/scarlet-witch-local`. These results describe the local build and preview.

## Rules sources

- [Official Scarlet Witch rules insert](https://images-cdn.fantasyflightgames.com/filer_public/92/cd/92cdc983-81ec-40a6-801d-f1377bc17241/mc15_scarlet_witch_rulesheet.pdf):
  count modifiers, Chaos Control, Crest and The Next Evolution.
- [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf):
  Ability and Alteration Effect (pages 4 and 7), Action (page 6), Amplify
  (page 7), Attack (page 8), Initiating Abilities and Interrupt (page 24),
  Non-Numerical Variable (page 30), Requirement (page 37) and Scheme (page 39).
- [Archived official FFG rulings](https://hallofheroeslcg.com/official-ffg-rulings/):
  discarded encounter-card batches stop at exhaustion, ordered Hex Bolt
  results, Crest before canceled numerical counts and shared encounter
  attachment actions, including the specific Wrapped in Metal ruling that
  confines personal identity exhaustion to the attached identity's player.

The player-chosen X distinction and recursive replacement by another eligible
Scarlet Witch follow the general rules for defined variables and interrupts;
they are not presented as bespoke card-specific FFG rulings.
