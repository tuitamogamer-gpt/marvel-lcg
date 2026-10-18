# X-23 retail Hero Pack

The dedicated `src/game/x23.ts` leaf installs all 41 original faces,
`43001a/b`–`43040`, representing 59 physical retail cards. The source Aggression
deck has 40 playing cards plus the original physical Permanent X-23's Claws.
The downloaded catalog and original card scans remain unchanged.

The original source composition includes Specialized Training. Each actual deck
containing that scheme sets aside one physical copy of each of its four Linked
Specialization upgrades. These are supplementary cards, excluded from deck
construction. Specialized Training selects across the set-aside pool and changes
the selected physical upgrade's owner to its new controller. Once introduced,
those upgrades use ordinary play and discard rules, including their printed
resource costs if subsequently played from hand.

## Native behavior

- Living Weapon responds to actual damage, including Claws and Grim Resolve
  costs, with a strict once-per-phase allowance. Prevented damage does not ready
  X-23. Resource-payment damage responses resolve before the paid event.
- Honey Badger follows her current controller's Hero Response window and readies
  the actual named X-23 seat. Damage that defeats Honey Badger does not open her
  response. Her attack/thwart events and optional responses preserve physical
  instances through saves and multiplayer control changes.
- Animal Instinct, Sisterly Bond, Claw Mastery, Regenerative Longevity,
  Sisterhood, Adamantium Lacing, Grim Resolve, Pain Tolerance and Puncture Wound
  use native payment, attack, healing, damage and response windows. Animal
  Instinct can be stacked. Puncture Wound tracks actual attacks this turn,
  modifies its attached enemy's ATK and discards before its next-phase damage.
- Boom Boom's optional detonation uses one simultaneous non-attack damage batch.
  Rictor discards through the shared native player-deck path and counts printed
  resources; his response precedes consequential damage. Shatterstar offers his
  optional engagement interrupt and only adds ATK if already engaged.
- Critical Hit, Moment of Triumph, Predictable Ploy and Anticipated Attack use
  their actual printed response/interrupt windows. Ploy cancels only When
  Revealed text, retaining reveal keywords and physical discard. Victory checks
  include both encounter and player side schemes.
- Keep Them Busy, The Direct Approach, Specialized Training and Rally the Troops
  use native player side schemes and physical Victory 0 destinations. Assault
  substitutes ATK and printed ATK consequential icons for a basic thwart while
  retaining thwart timing. THW-only Animal Instinct and Sisterly Bond bonuses do
  not increase an Assault thwart.
- The four Specializations add the proper stat or identity HP and open their
  native once-per-exhaust draw responses. Surveillance Specialist granted by the
  defeating basic thwart can respond to that same thwart.
- Now I'm Mad uses printed starting HP; Endurance, the resource trio, IPAC and
  X-Bunker retain the actual X-23 printing while using shared native behavior.
- Self-Isolation tucks the actual Honey Badger, discards her attachments through
  native leaving-play cleanup, and clears on basic recovery. Lady Deathstrike's
  When Defeated interrupt precedes discarding her; Cybermods shuffles the same
  physical minion instead. In the Name of Vengeance grants enemy Retaliate;
  Critical Wound fires once at its attached identity's turn end; Hack 'n' Slash
  uses a real random hand discard for both reveal and boost. Shadows moves the
  five original set-aside nemesis instances.

## Sources and validation

- [Original X-23 cards](https://hallofheroeslcg.com/x-23/), mirrored by the
  unchanged `public/cards/catalog/430*.webp` scans.
- [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/08/mc_rulesreference_v18_compressed-1.pdf):
  player attack sequence p10, Linked p27 and Honey Badger FAQ p64.
- [FFG rulings after RRG 1.5](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/):
  Self-Isolation #139; Puncture Wound and Grim Resolve #207 (June 13, 2024);
  Surveillance Specialist #219 (July 11, 2024).
- [FFG rulings after RRG 1.6](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/):
  Linked ownership and Animal Instinct against Assault.

`tests/x23-engine.test.ts` exercises the public dispatcher, real payments and
choice continuations, source composition, optional abilities, damage prevention,
phase limits, multiplayer ownership, same-window Specialization triggers,
Assault, reveal/boost effects, physical conservation and JSON save/reload.
The prior Psylocke/Angel and cross-pack regression suites cover the shared
support and engine integration.
