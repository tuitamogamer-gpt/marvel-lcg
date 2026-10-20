# Four-hero continuation: Bishop, Magik, Iceman and Jubilee

This batch covers the two hero/player sections of The Age of Apocalypse and the complete imported Iceman and Jubilee Hero Packs, including the Sauron and Arcade modular sets. Bishop and Magik are not separate retail products. The Age of Apocalypse scenarios, campaign and other encounter cards remain outside this hero import.

| Content                             | Face codes                                                                      |   Faces | Physical cards |
| ----------------------------------- | ------------------------------------------------------------------------------- | ------: | -------------: |
| Bishop hero/player section          | `45001a/b`, `45002`–`45029`                                                     |      30 |             47 |
| Magik hero/player section           | `45030a/b`, `45031`–`45058`                                                     |      30 |             47 |
| Iceman complete imported Hero Pack  | `46001a/b`, `46002`–`46032`                                                     |      33 |             59 |
| Jubilee complete imported Hero Pack | `47001a/b`, `47002`–`47034`, with the nine distinct `a/b/c` signature printings |      41 |             59 |
| Total                               |                                                                                 | **134** |        **212** |

These are catalogued gameplay cards; reference inserts and packaging are excluded. An identity's hero and alter-ego faces share one physical card. Jubilee's Firecracker, Flash of Light and Plasmoid Energy variants are separate physical cards, not reverse faces. The Age of Apocalypse hero slice contains 60 of its 220 imported faces; the other 160 faces are outside this batch's source scope. Registration counts remain a separate runtime inventory result.

## Immutable evidence

The imported catalog, published source lists and checked-in original English scans remain immutable. Primary product evidence is the [Age of Apocalypse gallery](https://hallofheroeslcg.com/the-age-of-apocalypse/), [official rulebook](https://hallofheroeslcg.com/wp-content/uploads/2024/04/mc45_age_of_apocalypse_rulebook.pdf#page=22), [Iceman gallery](https://hallofheroeslcg.com/iceman/), [Iceman rules insert](https://hallofheroeslcg.com/wp-content/uploads/2024/05/img_3025.jpg), [Iceman printed deck list](https://hallofheroeslcg.com/wp-content/uploads/2024/07/img_3355.jpg), [Jubilee gallery](https://hallofheroeslcg.com/jubilee/), [Jubilee rules insert](https://hallofheroeslcg.com/wp-content/uploads/2024/07/img_3359.jpg) and [Jubilee printed deck list](https://hallofheroeslcg.com/wp-content/uploads/2024/07/img_3357.jpg). The source records retain their pinned [DragnCards provenance](https://github.com/hone/dragncards-mc-plugin/blob/11c6ee54909e01910434dfa1cd890524b760843e/src/cli/decks.rs#L747); no implementation code from that project is incorporated.

| Immutable file                 | SHA-256                                                            |
| ------------------------------ | ------------------------------------------------------------------ |
| `src/data/catalog-cards.json`  | `c1f5fb1788175cbe13e35b57c8c5c27b7368ee29c44733eebc54956ba4d617fb` |
| `src/data/catalog-decks.json`  | `6d75a9c883223b59a9b9d950696de7b6876f8921ffe025d40e352495c1a2b886` |
| `src/data/catalog-images.json` | `fe7cc930e8df428b687a36af16d0d450f33327c81d58d42e44886598a55b007d` |

Independent visual inspection confirmed all eight identity scans, their printed statistics and their original face-to-image mappings. No identity scan or stat correction is needed.

| Identity | ATK | THW | DEF | REC |  HP | Hero hand | Alter-ego hand |
| -------- | --: | --: | --: | --: | --: | --------: | -------------: |
| Bishop   |   2 |   2 |   1 |   4 |  12 |         5 |              6 |
| Magik    |   2 |   1 |   2 |   3 |  10 |         5 |              6 |
| Iceman   |   2 |   1 |   2 |   4 |  11 |         5 |              6 |
| Jubilee  |   1 |   1 |   2 |   3 |   9 |         5 |              6 |

## Original source compositions and setup

| Hero    | Counted playing cards | Counted factions                 | Separately set aside          | Chosen aspect |
| ------- | --------------------: | -------------------------------- | ----------------------------- | ------------- |
| Bishop  |                    40 | 15 hero, 20 Leadership, 5 Basic  | None                          | Leadership    |
| Magik   |                    40 | 15 hero, 16 Aggression, 9 Basic  | None                          | Aggression    |
| Iceman  |                    40 | 15 hero, 15 Aggression, 10 Basic | Six actual Frostbite upgrades | Aggression    |
| Jubilee |                    40 | 15 hero, 14 Justice, 11 Basic    | None                          | Justice       |

The four source playing decks contain **160 physical cards**. Iceman additionally owns **six supplementary Frostbites**, for 166 player cards including that dependency. Identities, obligations, nemeses and the two modular sets are outside those totals. All original printing IDs and quantities must survive setup, payments, effects and save/reload.

- Bishop's fifteen signatures are `45002`–`45005×1`, `45006`–`45009×2`, and `45010×3`.
- Magik's fifteen signatures are `45031`–`45036×1`, `45037×3`, and `45038`–`45040×2`. Limbo is an ordinary support in the forty-card deck, not a Permanent setup card.
- Iceman's fifteen counted signatures are `46003×2`, `46004`–`46006×1`, `46007×2`, `46008×1`, `46009`–`46010×2`, and `46011×3`. Frostbite `46002×6` is outside the deck, supplied by Bobby Drake's beginning-of-game text before opening draws. The published source record correctly represents it in `supplementaryCards`, with an empty `setupCards` object.
- Jubilee's fifteen signatures include one each of `47002`–`47006`, `47007a/b/c`, `47008a/b/c`, `47009`, and `47010a/b/c`. Shopping Spree remains in the playing deck until played or found by Mall Rat. Mall Rat is an alter-ego Action, not Setup; it searches only the deck. The original source includes one Unlikely Duo `47022`, although the retail pack contains two copies. Its printed maximum is one per deck.

The Iceman insert explicitly says that each Frostbite returns to the place where it was set aside at the beginning of the game after the attached enemy activates or leaves play. Each physical upgrade keeps its original owner and returns to that owner's reserve; no replacement copy is created. The six copies do not count toward deck size. Their printed text does not impose a one-per-enemy attachment limit.

## Distinct Jubilee resource printings

| Physical printing  | Printed resources |
| ------------------ | ----------------- |
| `47007a`, `47008a` | Energy            |
| `47007b`, `47008b` | Mental            |
| `47007c`, `47008c` | Physical          |
| `47010a`           | Energy + Mental   |
| `47010b`           | Energy + Physical |
| `47010c`           | Mental + Physical |

Each row's printing IDs identify actual separate cards, with distinct source IDs, artwork files and OCTGN IDs. Do not collapse the suffixes into reversible cards or substitute three copies of a single resource printing. Firecracker and Plasmoid Energy resource fields were visually checked against the original scans; the immutable catalog matches them.

## Obligations, nemeses and modular sets

| Hero    | Obligation              | Five physical nemesis cards                |
| ------- | ----------------------- | ------------------------------------------ |
| Bishop  | `45025` Fear the Future | `45026×1`, `45027×1`, `45028×1`, `45029×2` |
| Magik   | `45053` Darkchilde      | `45054`–`45058×1` each                     |
| Iceman  | `46024` Hot-Headed      | `46025×1`, `46026×1`, `46027×1`, `46028×2` |
| Jubilee | `47023` Grounded        | `47024×1`, `47025×1`, `47026×1`, `47027×2` |

Sauron is a separate six-card modular set on four faces: `46029×1`, `46030×1`, `46031×1`, `46032×3`. Arcade is a separate five-card modular set on five faces: `47030`–`47034×1` each. These sets are selectable encounter modules, not automatic hero setup dependencies.

Original scans show that Battle for Limbo `45058`, Burn! `46028` and Sauron `46029` have **zero numeric boost icons and a separate boost star**. The missing numeric `boost` field in the imported data is correct; do not invent a positive numeric boost. Battle Suit `47026` prints +1 ATK in its left-hand modifier field in addition to its text granting +3 HP and Aerial. “Lost” Child `47027` prints a separate −1 SCH modifier; its corrected base-SCH interpretation is recorded below.

## Player side schemes and copied source wording

| Code    | Name                 | Cost | Starting threat       | Victory |
| ------- | -------------------- | ---: | --------------------- | ------- |
| `46018` | Keep Up the Pressure |    0 | 2 per starting player | 0       |
| `47003` | Shopping Spree       |    0 | **2 fixed**           | None    |
| `47016` | Generation X         |    0 | 3 per starting player | 0       |

Shopping Spree's original card has no Victory keyword and goes to its owner's discard when defeated. The Jubilee insert's general sentence that every player side scheme in the product has Victory is incorrect for Shopping Spree; use the actual card. The November 19, 2024 FFG answer #45 on the post-1.6 rulings page also distinguishes ordinary player-side-scheme discard from the Victory replacement. Shopping Spree forbids threat removal by heroes and allies. Its printed alter-ego Action can be used by any player, costs that player's identity exhaustion and removes one threat. Its defeat reward belongs to the player who defeated it and puts an actual Item from that player's deck/discard into play; ordinary put-into-play attachment eligibility still applies.

The three Arcade Trap! schemes `47031`–`47033` each have **two fixed** base threat plus **Hinder 1 per starting player**. Their hazard, amplify and crisis icons are distinct printed icons, respectively.

## Current rules and independently checked FFG answers

The current primary rules source is [Rules Reference v1.8](https://hallofheroeslcg.com/wp-content/uploads/2026/07/mc_rulesreference_v18_compressed.pdf), retrieved October 20, 2026, together with the dated official answers reproduced on the [post-1.5](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/), [post-1.6](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-6/) and [post-1.7](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-7/) pages. Later corrections supersede older answers.

- **Paid resource types:** RRG p48 allows each generated Wild resource to be independently declared Energy, Mental, Physical or Wild, including two separately doubled Wild resources. Outside generating resources for a cost, a printed Wild icon is only Wild. RRG p13 explicitly says resources generated beyond the specified cost are overpaid and **were not paid for that cost**. Jubilee's “used to pay” effects therefore inspect the chosen actual payment, with individual Wild assignments, rather than every generated icon. The January 17, 2026 answer allowing a declared type for an overpaid Wild does not change that distinction. The May 16, 2024 answer #187 permits the player to identify three Physical resources as paid for Drop Kick and an accompanying Energy as overpaid.
- **Bishop timing and damage:** Energy Absorption responds during damage step 4, before responses to the completed attack and before Retaliate; both Super-Charged upgrades can boost one attack, up to +16 combined (May 10, 2024, #159). RRG p32 stops a discard effect when the original deck empties even though it immediately reshuffles and deals an encounter card; it must not continue milling the new deck. Energy Conversion caps damage **taken**, after damage-dealt calculation/DEF and before damage-taken prevention such as Side Step; six dealt becomes three under the cap, then Side Step can prevent those three (June 6, 2024, #205–206). Bishop's Rifle may clear Stun with no resource cards in hand (May 10, 2024, #174).
- **Suit Up:** the current RRG erratum changes an upgrade attachable to “that ally” to an upgrade attachable to **“an ally.”** A search does not test whether the particular ally currently has the right traits or allows attachments; an upgrade that attaches and does not specify an exclusively non-ally target is eligible (October 10, 2025). Finding only an ally is legal (July 18, 2025). This differs from Deathlok, whose actual attachment must satisfy attach-to requirements; Sidekick cannot attach to non-identity-specific Deathlok. Keep the raw imported text and apply the current rule in the runtime overlay.
- **Magik's public top card:** RRG p64 says a played top card moves onto the table during initiation step 3, immediately revealing the next top card before payment. The played card is absent from Scrying's look or Spiritual Meditation's draw and is discarded only after its effects finish (January 25, 2024, #140). Clobber can return to hand as the first played card that round, and Scrying remains legal with only one or two deck cards (May 2, 2024, #157).
- **Magik's as-if-hand permission:** any play-from-hand opportunity can use the top card once per phase, including Colossus's villain-phase Interrupt and Team-Building Exercise; after-play-from-hand responses also trigger. It does not put the top card into hand for resource/discard costs, and it does not authorize putting that card into play with Mutant Protectors (RRG p64; May 16, 2024, #189). Paying away Mutant Protectors' only valid ally after initiation causes its effect to fizzle; it remains played and uses the phase allowance (September 26, 2024, #16). If Magik's text is blank, the top card is facedown and its resources cannot be inspected for her other effects, even if previously known (May 10, 2024, #159). A chosen multi-card discard count is committed before discarding; the player cannot stop after seeing successive revealed cards (October 10, 2025).
- **Full-Body Charge:** check HP after paying costs, before resolving the attack, so Wolverine's Claws or Symbiotic Bond may enable Overkill (May 10, 2024, #160).
- **Iceman's nested interrupts:** Cryokinetic Perception resolves immediately after Freeze! inside the basic-defense interrupt window; other defense interrupts remain available afterward (May 16, 2024, #186). Freeze! can attach a Frostbite before Surprise Move checks its upgrade requirement because both share the same interrupt window (June 13/20, 2024, #209/#217).
- **Iceman's delayed Frostbite:** Ice Wall attaches its Frostbite after the current enemy attack finishes, so that copy remains through the next activation (May 30, 2024, #199). Arctic Attack's first bullet deals damage and attaches Frostbite simultaneously before enemy defeat, still triggering Hot-Headed (June 6, 2024, #204). Ice Blast damages every enemy with Frostbite, including enemies engaged with other players (June 13, 2024, #213). Rogue copying Chill Out! may use Iceman's set-aside Frostbite because no uncontrolled card is being paid as a cost (June 20, 2024, #216). Only Suppressing Fire's controller can trigger its interrupt, not another player who defeats the minion (June 13, 2024, #214).
- **Canceled activations:** RRG p41 says an enemy attack replaced by Stun is not an attack; p13 says the same for a scheme replaced by Confuse. Since an activation is an attack or scheme (p6), those replacements do not trigger Frostbite's after-activation response. Frozen Solid's activation replacement likewise does not complete an activation. This is an application of the current RRG, not a separate card-specific FFG answer.
- **Three Steps Ahead:** current iterations are **sequential**, superseding the October 7, 2024 simultaneous answer #19. A first iteration can defeat a Crisis side scheme, allowing a later iteration to target the main scheme. Repeated targets are legal; Overwatch responds to one two-threat instance, not their total (November 23, 2024, #46/#49).
- **Blinding Flash:** “choose X enemies” means different enemies; it cannot choose the same Steady enemy repeatedly (#19/#37, October 7/November 19, 2024). This differs from a “for each, choose” effect, whose iterations may choose the same target.
- **“Lost” Child:** treat the attached ally's **base SCH** as its printed THW, then apply the attachment's printed −1 SCH and any other modifiers. The original “equal to its printed THW” wording did not convey that correctly (October 7, 2024, #21). A converted ally retains its actual physical identity and returns to its owner's appropriate zone when it leaves play; removing the control-changing attachment in play restores its prior ownership/control according to RRG p30. Do not create an unrelated minion copy.

## Verification boundary

The independent source-contract suite pins immutable bytes, exact original printing IDs and quantities, all 134 faces/212 physical cards, four forty-card source lists, the six-card Frostbite reserve, obligations/nemeses, modular sets, resource variants, image mappings and the cited printed fields. It deliberately does not depend on newly installed native modules. Passing these static checks does not establish executable card support. Native rule/ownership tests, source missions, public browser behavior and exact-commit production verification remain separate release gates.
