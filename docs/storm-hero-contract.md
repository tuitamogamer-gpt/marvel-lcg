# Storm and Shadow King source contract

The native product is `storm`, including the original Storm identity pair, her signatures and Weather deck, the complete player pool, her obligation and five nemesis cards, and the five-card Shadow King modular encounter set. The pinned catalog contains **40 distinct faces / 59 physical cards**. Source JSON and downloaded artwork remain unchanged.

The [original card gallery](https://hallofheroeslcg.com/ororo-munroe-storm/) and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf) govern the integration. Claustrophobia `36030` and Possessed `36038` already contain their RRG 1.6 corrections in the source snapshot. The locally downloaded `36001a` scan shows Ororo and `36001b` shows Storm, opposite the source application's hero-a convention; `imageFor` swaps those two image lookups without changing the original metadata or image bytes.

## Composition and setup

The [original source starter](../src/data/catalog-decks.json) retains **40 playing cards: 15 signatures, 15 Leadership, 10 Basic**. Storm's Crown `36006`, Storm's Cape `36007`, and Ororo's Garden `36008` occur once; Weather Goddess `36009` and Torrential Rain `36010` occur three times; Lightning Bolt `36011`, Flash Freeze `36012`, and Blast of Wind `36013` occur twice.

Havok `36014`, Mirage `36015`, Gentle `36016`, and Pixie `36017` occur once; Uncanny X-Men `36018`, Leadership Skill `36019`, and “To Me, My X-Men!” `36020` occur three times; Effective Leadership `36021` occurs twice. Forge `36022`, The X-Jet `36023`, Utopia `36024`, and X-Mansion `36025` occur once; Endurance `36026` occurs three times; Energy/Genius/Strength `36027`–`36029` occur once. Hangar Bay `36035` is part of the full player pool but not this preconstructed deck.

The four supplementary Weather supports `36002`–`36005` are separate physical cards, outside the ordinary deck and mulligan. Native initialization preserves four distinct owned IDs in the set-aside area. After the six-card opener and mulligan, Ororo chooses one actual support to put into play. Setup does **not** resolve its Special or draw an extra card. The other three remain in the Weather reserve, separate from the encounter nemesis reserve. Later swaps move these same physical IDs and survive JSON reload.

Storm has 10 HP, ATK 2 / THW 1 / DEF 1, five hero cards, and Ororo has REC 3 and six alter-ego cards. Custom decks retain the mandatory signature composition and choose one ordinary aspect. Claustrophobia enters the encounter deck separately. Callisto `36031`, Leader of the Morlocks `36032`, Switchblade `36033`, and two Knife Fights `36034` begin as the five physical set-aside nemesis pieces.

## Execution and timing

An active Weather support affects **every character**, including enemies, allies, teammate identities and scenario allies. Its text continues to apply while Ororo is in alter ego. Clear Skies grants Stalwart and removes/prevents stun and confusion; Hurricane adds Retaliate 1; Thunderstorm adds 1 ATK; Blizzard subtracts 1 ATK. Signed attack modifiers remain signed until boost icons and the other attack modifiers are combined.

Weather Control uses the hero face and its once-per-round limit. Weather Goddess can swap independently. A swap resolves the new support's Special; Weather Specials are not attacks or thwarts. Blizzard's blanking follows the actual non-Elite minion through this round, removes only its text box and expires when that physical minion leaves play. Storm's Cape offers a separate optional response after a resolved Special. The [official ruling #148](https://hallofheroeslcg.com/latest-ffg-rulings/#148) specifically forbids a Cape ready when Blizzard has no legal minion; an already-blank minion remains a legal choice.

Lightning Bolt completes its eight-damage attack and then resolves Thunderstorm's separate Special. Torrential Rain saves its allocation among schemes before committing the three threat removal and then resolves Hurricane. Stun/confusion replaces the entire corresponding paid event before any follow-up Special. Blast of Wind commits simultaneous nonattack damage to the villain and the chosen player's minions before resolving the Weather Special.

Flash Freeze is a real paid defense interrupt to the villain attacking Storm. It snapshots the villain and currently engaged minions, applies -3 ATK only while those physical enemies attack that player during the same phase, and resolves Blizzard if active. Multiple same-phase copies stack per affected physical enemy; earlier phases cannot leak into a later cast. The original attack recipient controls initiation eligibility; a later attack's actual target controls the existing lasting reduction.

Havok uses only numerical boost icons for both his current attack and its extra consequential damage. Gentle adds his printed extra consequential damage only against the villain. Leadership Skill offers each controlled copy's interrupt once per actual ally basic action and removes a Uses card when its final counter is spent. Mirage compares current SCH and THW. Pixie's return requires actual play from hand; Forge searches the original deck/discard pieces. “To Me, My X-Men!” searches the top five, shuffles on successful/declined/empty searches, puts the actual ally into play, and returns that surviving physical ally at phase end. Leaving play clears the delayed return. Hangar Bay responds only after the defending ally survives.

Callisto's Forced Interrupt gives Tough before Knife Fight's cancellable reveal ability. Switchblade chooses highest **printed** ATK and gives +2 ATK plus Piercing. Claustrophobia forces Ororo, remains as the actual physical obligation, blocks changing to hero, and requires exhausting Ororo to remove it. Leader of the Morlocks searches for and reveals a physical Knife Fight when defeated.

## Shadow King and control

The registered modular set `shadow_king` contains The Shadow King `36036` ×1, Ruler of the Astral Plane `36037` ×1, Possessed `36038` ×2, and Astral Attack `36039` ×1. Ruler starts with six fixed threat, including multiplayer. Its boost star has no invented numerical boost icons and reveals the same physical card when a Controlled minion engages that player.

Possessed selects an ally with the lowest current THW, including Robert Kelly in his scenario zone, and moves that same piece into the minion zone with its controller as engagement target. It retains physical ownership, damage and exhaustion, gains Controlled, loses printed text and consequential damage, and uses printed THW as SCH. Removing the attachment restores the same piece to its physical owner without an enter-play trigger, unless a remaining control effect applies; Kelly returns to his scenario zone. The Shadow King cannot take damage while any Controlled minion is in play. Astral Attack performs actual native activations and its boost shuffles the actual Shadow King discard pieces into the encounter deck.

Control-changing source attachments carry a monotonic `controlOrder`. The latest active Mind Control, Possessed or Beguiled attachment determines the current type; this ordering cooperates with the Phoenix integration from the same batch. Source ownership and current controller remain distinct. Leaving play clears delayed effects and stale controller receipts.

## Shared reprint providers and validation

The scope has **37 dedicated physical registrations and three exact Core aliases**. Energy/Genius/Strength use the existing exact-Core handler mapping. Endurance uses its complete declarative static/recipient/max-one script. Storm's X-Jet and X-Mansion printings share the existing Mutant Genesis native providers, including cross-player resource generation and legal alter-ego actors.

Effective Leadership `36021` and Utopia `36024` intentionally execute through the **Cyclops module included in this four-pack release**, alongside `33018` and `33020`. The standalone Storm worktree registers its printings but must be merged with Cyclops before complete release acceptance; two native providers must never fire for one physical card.

[Storm's native suite](../tests/storm-engine.test.ts) covers original setup, physical Weather conservation, all Weather constants/Specials, signature payments, attack/thwart/status replacement, player-pool abilities, nemesis reveals, and Shadow King lifecycle. [The independent review suite](../tests/storm-independent-review.test.ts) checks top-five search shuffling, per-phase/recipient Flash Freeze modifiers, expanded-health Garden, X-Mansion actor rules, Kelly possession/restoration and the no-target Blizzard/Cape ruling. Both use native commands/effects and JSON hydration. Combined batch acceptance separately verifies cross-pack Utopia/Effective Leadership, control attachment ordering, full regression, production build and browser publication.
