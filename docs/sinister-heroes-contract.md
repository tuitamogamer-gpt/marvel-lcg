# Sinister Motives hero source and registration contract

This native hero scope covers Ghost-Spider and Miles Morales, their original player pools, obligations and nemeses, plus optional Venom and Symbiote Suit player printings. It contains **64 imported faces** from the **214-face** Sinister Motives box: fifteen Ghost-Spider faces, sixteen Miles faces and thirty-three shared player faces. The box's scenarios, campaign progression and other encounter cards remain separate work.

## Canonical identities and original sources

Ghost-Spider uses canonical set/hero ID `ghost_spider`, hero `27001a` and alter ego `27001b`. Her original Protection source contains **forty physical cards: fifteen signatures, fifteen Protection and ten Basic**. Its required signature quantities are Ghost Kick `27002` ×3, Parental Guidance `27003` ×1, Phantom Flip `27004` ×3, Pirouette and Punch `27005` and Web Binding `27006` ×2, George Stacy `27007` and Ticket to the Multiverse `27008` ×1, and Web-Bracelet `27009` ×2. Ticket's printed **two wild resource icons** remain unchanged.

Miles uses canonical set/hero ID `spider_man_morales`, hero `27030a` and alter ego `27030b`. His original Justice source contains **forty physical cards: fifteen signatures, thirteen Justice and twelve Basic**. Its required quantities are Arachnobatics `27031`, Double Life `27032` and Swing In `27033` ×2, Web-Shot `27034` ×3, Ganke Lee `27035`, Jefferson Davis `27036`, Power Within `27037` and Defense Mechanism `27038` ×1, and Web-Shooter `27039` ×2.

Both immutable sources have empty setup and supplementary maps. Their normal six-card alter-ego opening draws come from the forty-card player source; there are no Permanent pieces to remove from deck size or inject into play. Alternate app starters retain all fifteen signatures, and custom decks follow ordinary single-aspect 40–50-card rules. The source browser offers each exact original list; the account editor locks signatures and distinguishes Spider-Man · Miles Morales from Spider-Man · Peter Parker.

Ghost-Spider's printed stats remain HP10, ATK2, THW1, DEF3 and hero hand5; Gwen Stacy has REC3 and hand6. Miles has HP9, ATK2, THW2, DEF2 and hero hand5; his alter ego has REC4 and hand6. No new printed-number overlay is applied. Original rules and quantities come from the [unchanged catalog](../src/data/catalog-cards.json), [source decks](../src/data/catalog-decks.json) and [original gallery](https://hallofheroeslcg.com/sinister-motives/).

## Physical player-pool and Core equivalences

`SINISTER_PLAYER_PACK_SCRIPT_CODES` exports **26 dedicated physical player faces**; `SINISTER_PLAYER_PACK_CORE_ALIASES` exports **seven supplementary Core reprints**.

| Physical printing         | Core rules |
| ------------------------- | ---------- |
| Energy `27020`            | `01088`    |
| Genius `27021`            | `01089`    |
| Strength `27022`          | `01090`    |
| Surveillance Team `27045` | `01064`    |
| Energy `27051`            | `01088`    |
| Genius `27052`            | `01089`    |
| Strength `27053`          | `01090`    |

Miles's physical signature Web-Shooter `27039` is also completely equivalent to Core `01008`. It remains in the sixteen-face Miles module export; its existing Core Uses/resource handling must execute once, retaining the original `27039` code and physical ID. All eight pairs match sixteen complete printed rule/stat fields. Physical retail quantities and source provenance remain distinct.

Bait and Switch `27013` retains its dedicated physical adapter for the Scarlet Witch reprint. Young Love `27019` and `27050` remain separate dedicated printings and share their printed one-copy deck limit. The matching Miles Morales Spider-Man ally `27011` is excluded from Miles's decks, and Ghost-Spider/Gwen Stacy `27048` is excluded from Gwen's decks. Peter Parker `27049` and Hobie Brown `27017` remain distinct legal Spider-Man allies for Miles under the current secondary-title uniqueness rule.

Venom `27190` and Symbiote Suit `27191` are optional counted Basic player cards, with one copy permitted per deck. Neither is injected into either original forty-card source. Each contributes its printed hazard icon. An actual unblank Suit adds +1 to each basic power, +1 hand size and +10 maximum HP for its controller, including the alter-ego REC bonus and Iron Man's separate Tech hand-size branch. Hazard icons remain separate from printed ability text; the native encounter host owns their additional-card scheduling.

## Separate obligation and nemesis pieces

Worried Father `27025` is Ghost-Spider's obligation. Her five nemesis pieces are The Lizard `27027`, Regenerative Research `27026` and Experimental Injection `27028` ×1, plus In Cold Blood `27029` ×2. Keeping Secrets `27056` is Miles's obligation. His five nemesis pieces are Tracking Prey `27057`, Prowler `27058` and Razor Claws `27059` ×1, plus Slice and Dice `27060` ×2. These separate encounter pieces do not change either forty-card player composition. Tracking Prey retains any actual acceleration tokens on its physical piece; the table and card inspection show a nonzero token count, and the main-scheme forecast includes it while the side scheme remains in play. [Ghost-Spider's identity contract](ghost-spider-integration.md) and [Miles's identity contract](miles-morales-integration.md) record original/current-rule timing and native ownership requirements.

## Verification boundary

The static/source/editor suite in `tests/sinister-heroes-metadata-decks.test.ts` covers both canonical identities, exact source quantities, all four legal aspect starters, signature enforcement, no setup injection, original printed stats, Ticket's two wild icons, eight complete Core equivalences, shared Young Love limits, matching versus differently subtitled Spider allies, actual forty-piece opening state and JSON conservation, optional campaign-player printings and Suit numeric modifiers without double counting. Its twenty-six cases pass alongside sixteen Vision and seventeen Valkyrie metadata cases: **59 passing cases in three files** (`output/sinister-metadata-final.log`).

The independent read-only source comparison records exact 15/15/10 and 15/13/12 splits, all eight sixteen-field Core pairs and unchanged imported file hashes in `output/sinister-static-source-check.json`. The staged live support measure in `output/sinister-registry-measurement.json` reports **1,260 executable faces, 786 dedicated faces, 3,291 unsupported faces and 31 registered identities**. The fifty-seven new dedicated registrations add fifty-six newly executable faces because Web-Shooter `27039` was already Core-equivalent.

This metadata evidence is separate from final native identity and player-pool timing, full mission matrix, production browser, frozen inventory hashes and publication. The release owner regenerates the machine inventory only after those native sources are frozen; imported box scenarios and campaigns remain outside this hero scope.

## Native release preparation — 2026-10-08

Ghost-Spider's identity integration passes 67 pure and 26 native controls, Miles Morales passes 68 pure and 52 native controls, and the shared player pool passes 56 pure and 39 native controls. Their native sources are frozen and full TypeScript compilation exits zero. Stored George events retain their actual IDs for ordinary paid PLAY and all existing reaction providers; storage never becomes a resource or random hand-discard source. Flow Like Water and Web-Bracelet share the completed event's actual PLAY token and response choices before the original incoming-damage packet resumes. Zero-cost What Doesn't Kill Me still spends an actual Physical resource, and native Chaos Control retains Venom's explicit star count while ordinary boost counting stays numeric.

The final generated inventory contains 1,260 executable faces, 786 dedicated faces, 3,291 unsupported faces, 31 identities and 76 source-hash paths. The production build and configured formatting pass, and native Node 24.19.0 API startup returns HTTP 200 with **63 runtime** modules and six JSON dependencies. Frozen final entry `index-CB4nVUo_.js` has SHA-256 `f9eb3f8f61280eae45e794612b1e8facb00167304e4ef662476425c2bcdb0438` (`output/sinister-entry-final.json`). The same entry passes fifteen native flows plus both original-source launches at 1440/1280/390/320: 98 accessibility audits, 96 layout checks and 98 distinct screenshots, with zero browser errors or accessibility violations (`output/sinister-production/report.json`). The ten-image manual review of this same entry passes (`output/sinister-visual-review.json`). The fresh frozen whole regression passes **7,277 tests, one existing intentional skip and 152 files**, including all **2,340 original-source mission configurations** (`output/sinister-regression-final-government.log`). All frozen local release gates pass. This document does not claim a Sinister deployment, official CI success or completed boxed scenarios/campaign.

The separate published-regression preservation check passes **107 tests in four files**, including thirteen additional previously published controls (`output/sinister-preserved-regressions.log`). Runtime sources and the exact CB4 production entry remain unchanged. The complete whole-run result remains 7,277 passing tests and one intentional skip in 152 files.
