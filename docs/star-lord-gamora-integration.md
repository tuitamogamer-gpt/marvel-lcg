# Star-Lord and Gamora native integration

Star-Lord and Gamora launch with their original 40-card Leadership and
Aggression starter decks. The saved physical cards retain their source printing
codes and quantities. The two retail products register all 65 faces: Star-Lord
32 and Gamora 33. Four native modules supply 58 dedicated faces; seven exact
Core printings use the existing native rules.

The installed collection has 21 of 69 native identities, 966 executable
registrations and 489 dedicated faces. Five scenarios and nine modular sets
remain available; boxed campaigns and other scenario products are pending.
These registration counts describe implemented dispatch paths and do not
certify exhaustive rules coverage.

## Identities and source decks

The [Star-Lord contract](star-lord-integration.md) records Peter Quill's actual
Element Gun setup search after all mulligans, Smooth Talker's physical-card
swap, the committed encounter-card play interrupt, controlled Guardian allies,
Leader of the Guardians, Helmet hand size, Jet Boots, Bad Boy, signatures,
obligation and nemesis. The play-cost reduction belongs to one physical hand
card, can make an otherwise unaffordable card playable, and keeps its dealt
encounter cost and round limit if the subsequent payment is canceled. Refill
rechecks hand size after every draw because deck exhaustion can deal an
encounter card and increase Helmet's limit during the refill.

Mister Knife snapshots the first treachery at its actual reveal, including a
treachery whose effects are canceled. Shadows of the Past cannot retroactively
gain Surge from the Knife it puts into play. The gained keyword does not stack
with another instance of Surge on the same revealed card.

The [Gamora contract](gamora-integration.md) records actual played-event turn
history, independent optional Finesse/Precision/Sword responses, Keen Instincts,
Crosscounter, signatures, obligation and nemesis. Her deck editor permits up to
six off-aspect Attack or Thwart event copies. The original Aggression source
retains its three Protection First Hit and three Justice Impede cards.

In a Bind blanks identity text on both faces. Its ordinary Hero Action can be
paid by a teammate using that teammate's own Attack event; the one damage is
dealt to the Gamora who owns the attachment. Sibling Rivalry accepts threat
removal only by an actual Gamora actor. Non-thwart Finesse bypasses Confused and
Patrol, while Crisis still prevents removing main-scheme threat.

## Current status and defense rules

The [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf)
replaces an entire multi-label ability when a matching Stun or Confuse is
present. Every matching status is removed. A canceled Hit and Run or
Crosscounter is still paid and played, so Gamora's after-play responses and
played-event history remain available even though its printed ability did not
resolve. Older single-label-choice Gamora contact rulings do not override the
current published rule.

Crosscounter can declare Gamora the defender of an undefended actual enemy
attack without exhausting or adding basic DEF. If an ally already defends,
Crosscounter can prevent identity Overkill damage while retaining the ally as
defender (RRG 1.8, p. 16). Direct and Retaliate packets can trigger its
prevention without creating a hero defense or a True Grit response.

## Shared player cards

Native player-pack effects include physical Guardian attachments, printed and
granted traits, Knowhere under its owner's control, C.I.T.T. ability payments,
Cosmo's named card type and chosen deck, optional physical Target Practice
copies, actual Adam Warlock resource types, and Beta Ray Bill's actual minion
defeat. Laser Blaster, Yondu and Comms Implant modify the actual ally's basic
power and consequential damage. Drax cannot attack minions; Guard can leave
him no legal attack target.

Blaze of Glory resolves its damage against current Guardians before the saved
phase boundary continues. Godslayer is offered only against an actually
declared unique enemy. Clobber and Impede return the original physical event
only for its first actual play occurrence as the controller's first played
card that round. Spending a card as a resource and putting an ally into play
do not create a played-card occurrence.

First Hit responds when a minion initiates an attack, including Quickstrike.
It can defeat that minion before defense or incoming damage. If Stun cancels
the paid attack event, the minion's attack continues. Enhanced Awareness and
Enhanced Reflexes spend actual counters, exhaust their physical source and
discard it when Uses reaches zero. Pulse Grenade stops its specified discard
when the encounter deck empties; boost-star abilities are not resolved.

## Validation

Native and independent review suites exercise actual commands with JSON
reloads, original source quantities, committed costs, statuses, response
ordering, physical conservation and second-seat ownership. The source-deck
mission matrix covers 1,440 configurations across sixteen expansion
identities, five scenarios, both difficulties and nine modular sets.

`npm run test:star-lord-gamora` verifies both source launches and native
identity, event, payment, prevention and shared-weapon interactions. Its
`SG_VIEWPORTS`, `SG_SCENARIOS`, `SG_FIXTURE_ONLY` and `SG_OUTPUT` options support
separate production and viewport checks. Final frozen-source verification
covers 4,284 passing cases across 94 files, with the existing opt-in advisor
measurement skipped. The broad run passed 4,282 cases; its two account tests
hit the five-second limit under concurrent browser load. A fresh account-only
run passed all 100 cases. All 1,440 source mission configurations pass. The
Nova Prime/Ultron Drone regression also checks the discarded captured physical
card; all eighteen Star-Lord/Ultron configurations pass.

The production build, configured formatting and whitespace checks pass. The
native Node production entry returns HTTP 200 with 44 runtime modules and six
JSON dependencies. Unconfigured cloud storage remains unavailable. All 57
inventory source hashes match the final source.

The four-width development browser run passes 118 accessibility audits and
116 layout checks at 1440, 1280, 390 and 320 px. The final production preview
passes 31 audits and 29 layouts, including both original source decks and nine
native interaction flows. The general action flow passes six checks and six
audits. Final reports contain no browser errors or accessibility violations;
evidence is in `output/star-lord-gamora/`,
`output/star-lord-gamora-production/` and `output/flow/`.

The next chronological Hero Packs are Drax (18 June 2021) and Venom
(16 July 2021).
