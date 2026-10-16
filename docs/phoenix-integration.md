# Phoenix native integration

The original Phoenix Hero Pack is playable as Phoenix (`phoenix`, Justice).
The source starter retains its forty playing cards plus the actual permanent
Phoenix Force card. Setup extracts that same physical card before drawing six
cards, sets it Restrained with four power counters, and reserves the five actual
nemesis cards. The raw catalog, starter JSON and artwork files are unchanged.

Source: [original English gallery](https://hallofheroeslcg.com/jean-grey-phoenix/),
the checked-in original scans `public/cards/catalog/34001a.webp`–`34035.webp`,
and the pinned source-preconstructed deck in `catalog-decks.json`.
`34001a`/`34001b` retain catalog identity codes; image selection corrects the
original image filenames' reversed hero/alter-ego orientation. Printed metadata
restores the omitted Burning Hunger and Fiery Rage text from their original scans.

The native module executes the Phoenix Force resource/flip thresholds, recovery,
White Hot Room, Phoenix Suit, all signature events and upgrades, the full Justice
preconstructed pack, supplementary Psionic events and both team-ups. Swift
Retribution and Down Time reuse exact existing scripts while preserving physical
printing codes. Energy/Genius/Strength use existing Core aliases.

Mind Control preserves the physical minion ID, printed faction and attachment
ownership. Its derived ally has printed SCH as THW, one consequential damage,
Controlled and a blank text box. Removing its actual upgrade restores the minion;
defeating the controlled ally routes it to the encounter discard and its upgrade
to its owner's discard. Control-changing attachments carry application order so
later Mind Control, Possessed or Beguiled effects can supersede earlier effects
without cloning a card. The Storm integration consumes the same ordering contract.

Telekinetic Shield replaces the entire incoming enemy-attack damage occurrence,
retaining native damage continuation and physical attachment, and discards at five
damage without spillover. Rise from the Ashes replaces identity defeat, removes
itself, restores printed hit points and clears Phoenix Force counters. Psychic
Manipulation and Psychic Misdirection are actual paid event interrupts in native
scheme/attack windows. Consume the World is permanent at zero, loses Amplify at
zero, receives Dark Phoenix's scheme threat and ends the game at twelve threat.

Passion for Justice alters every actual threat-removal occurrence of its paid
Thwart event. This follows the identical event-scoped alteration wording in
[FFG's Aggressive Energy ruling](https://hallofheroeslcg.com/official-ffg-rulings/):
each instance of an event is increased, including both attacks of Slice and Dice.
The native Multitasking regression therefore removes three threat twice. Mutant
Peacekeepers has one distributed total; the bonus is added once to that total,
not to the UI's one-point allocation steps.

Validation: `tests/phoenix-engine.test.ts` exercises physical source conservation,
JSON hydration, native payments, form changes, restrictions, actual attack/scheme
windows, all distinct pack abilities, nemesis branches and loss conditions.
Existing Ms. Marvel and Shadowcat integration tests cover the shared alias and
permanent/control seams. The root batch owns browser coverage and cross-pack
Possessed/Mind Control acceptance after combining the independent commits.
