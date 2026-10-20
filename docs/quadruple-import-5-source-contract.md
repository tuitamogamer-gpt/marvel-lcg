# Four-hero continuation: Nightcrawler, Magneto, Maria Hill and Nick Fury

This continuation covers the complete imported Nightcrawler and Magneto Hero Packs and the two hero/player sections of Agents of S.H.I.E.L.D. It includes Crazy Gang and Hellfire as selectable modular sets. Boxed scenarios, their modular sets and campaign progression remain outside this hero import.

| Source boundary | Faces | Physical cards |
| --- | ---: | ---: |
| Nightcrawler, `48001a/b` through `48038` | 39 | 59 |
| Magneto, `49001a/b` through `49042` | 43 | 59 |
| Maria Hill positional section, `50001a/b` through `50033` | 34 | 48 |
| Nick Fury positional section, `50034a/b` through `50063`, including `50035a/b` | 32 | 47 |
| **Combined source** | **148** | **213** |

These are catalogued gameplay cards; reference inserts and packaging are excluded. A hero/alter-ego pair is one physical card. Nick's linked Assault/Stealth upgrade is also one physical card. Counting all faces or stripping letter suffixes without consulting declared links would give incorrect physical quantities.

Maria's and Nick's positional counts are not their source-assigned physical totals. Super Spies `50024` has printed quantity two and appears in Maria's positional section, while the official starter lists allocate one physical copy to each hero. Maria therefore receives 47 physical cards and Nick 48, preserving their combined 95. Nick's source closure includes `50024` outside positions 34–63; it must not create a third copy.

Agents of S.H.I.E.L.D. contributes exactly **66 of 221 imported faces**, through `50063`. Its scenarios begin at `50064`; the remaining 155 faces and the campaign are outside this continuation. Source inclusion and executable runtime registration remain separate assertions.

## Immutable evidence

The source is the pinned [MarvelCDB data snapshot](https://github.com/zzorba/marvelsdb-json-data/tree/44b7f2c9b01faa50f5a96cb40a9c0ecbbace7776), with maintained [DragnCards starter-list provenance](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747). No implementation code from either external game plugin is incorporated.

Published card evidence is available in the [Nightcrawler gallery](https://hallofheroeslcg.com/nightcrawler/), [Magneto gallery](https://hallofheroeslcg.com/magneto/) and [Agents of S.H.I.E.L.D. gallery](https://hallofheroeslcg.com/agents-of-shield/). The [official Agents of S.H.I.E.L.D. rulebook](https://images-cdn.fantasyflightgames.com/filer_public/79/12/7912adc3-2461-4ea2-8606-4715880b8d1d/mc50_rulebook-web.pdf) defines suit forms on page 3, all-purpose counters on page 4 and the printed starter lists on page 7. The importer already preserves Nick's corrected Super Spies allocation from that list.

| Immutable file | SHA-256 |
| --- | --- |
| `src/data/catalog-cards.json` | `c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb` |
| `src/data/catalog-decks.json` | `6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886` |
| `src/data/catalog-images.json` | `fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d` |

All eight original identity scans and both suit scans were visually checked against the imported names, statistics and face assignments. Hero ATK/THW/DEF/HP values are Nightcrawler 1/2/3/9, Magneto 2/2/2/10, Maria Hill 1/2/2/9 and Nick Fury 2/2/2/10. Recovery values are 3, 3, 3 and 4 respectively. All four use hand sizes 5/6. Original English artwork bytes, face codes and source lists remain unchanged.

## Exact source compositions and setup

- Nightcrawler's Protection source contains 40 playing cards: 15 signatures, 20 Protection and five Basic. Its three Bamf! copies `48006` are ordinary counted cards, not extra Permanent reserves. Obligation `48026` and nemeses `48027`–`48030` contribute one and five physical cards. Off-aspect cards `48031`/`48032` each have three physical copies; Crazy Gang `48033`–`48038` has six faces and six physical cards within the complete pack.
- Magneto's Leadership source contains 40 playing cards: 15 signatures, 17 Leadership and eight Basic. New Recruits `49020` refers to four set-aside New allies, `49033`–`49036`; each is one physical card outside the playing deck. Their printed Linked condition supplies this setup requirement even though the immutable import's supplementary map is empty. The runtime must model that source-grounded pool explicitly. Obligation `49027` and nemeses `49028`–`49032` contribute one and five physical cards. Children of the Atom `49037` has three additional player-pool copies. Hellfire `49038`–`49042` has five faces and five physical cards within the pack.
- Maria Hill's printed starter is Leadership. Its 40 playing cards comprise 15 signatures, 12 Leadership, three off-aspect S.H.I.E.L.D. supports and ten Basic cards. Imported aspect metadata remains `multi` because it records all four represented aspects; her printed deckbuilding exception permits the maximum copies of three S.H.I.E.L.D. support types from other aspects. Her starter's three are The Bellerophon `50018`, The Douglass `50019` and The Pericles `50020`, one each. There are no setup or reserve cards. Obligation `50029` and nemeses `50030`–`50033` contribute one and five physical cards.
- Nick Fury's Justice source contains **40 playing cards plus one Permanent setup card**. Its 15 counted signatures, 17 Justice and eight Basic cards include one Super Spies `50024`. The imported composition totals 41 because Assault `50035a` is included once; it begins in play and does not count toward deck size. Stealth `50035b` is its declared reverse, not another physical piece. Identity changes and suit-form changes are distinct. Obligation `50059` and nemeses `50060`–`50063` contribute one and five physical cards.

All-purpose counters adopt the receiving card's defined counter type; without one, they remain all-purpose counters (official rulebook page 4). Threat tokens are a separate track. Super Spies permits a total of three all-purpose counters and/or threat tokens on S.H.I.E.L.D. supports and/or suit forms. Its printed wording does not restrict the pairing of token type and eligible card; counter conversion must never silently turn an all-purpose counter into threat or let a threat token pay a support's Uses cost.

## Native rules and verification boundary

The independent source-contract tests pin all 148 faces, 213 physical cards, four exact source maps, special setup distinctions, shared Super Spies quantities, obligations/nemeses, module boundaries and local artwork mappings. They deliberately do not depend on the new native modules. Passing them establishes source consistency rather than complete executable support.

Implementation must preserve actual physical piece IDs, owners, original printing or declared reverse, payment origins, nested timing and saved continuations. A player card turned facedown by Controlled Innocents remains that same owned card; its public presentation must conceal its printed face and its later destination must restore the owner's card. Orion's unlimited tough statuses require the native damage/status pipeline rather than a detached damage shortcut. Native integration tests, full source missions, browser behavior and exact-commit deployment evidence are separate release gates recorded when complete.
