# Vision source and registration contract

Vision's canonical hero, product and signature-set ID is `vision`, with hero `26001a` and alter ego `26001b`. The retail Hero Pack contains **38 imported faces**: nineteen identity/signature/encounter faces, thirteen dedicated player-pool faces and six exact Core aliases. Reverse identity and mass-form faces count separately in the registry. Intangible `26002` and Dense `26002b` are two faces of **one physical Permanent**, not two cards in the constructed source.

## Original source and mass-form setup

The immutable [original Protection source](../src/data/catalog-decks.json) contains **forty playing cards: fifteen signatures, seventeen Protection cards and eight Basic cards**, plus one physical Intangible/Dense Permanent. Its full source composition therefore has forty-one physical pieces. The required front printing is `26002` ×1; alternate app starters retain it exactly once and exclude `26002b` as an additional constructed printing. The deck editor counts forty playing cards, locks the single setup row and offers no independent Dense selector. Generic deck validation rejects an extra or substituted reverse face.

The ordinary signatures are Vivian `26003`, 616 Hickory Branch Lane `26004`, Solar Gem `26005` and Vision's Cape `26006` ×1, Density Control `26007` ×2, Solar Beam `26008` ×3, Superdense Strike `26009` and Just Passing Through `26010` ×2, and Phase Disruption `26011` and Mass Increase `26012` ×1. All fifteen playing signatures and the one physical Permanent remain mandatory in every selected aspect.

The Protection source uses Jocasta `26013`, Protector `26014` and Victor Mancha `26015` ×1, Flow Like Water `26016` ×3, Indomitable `26017` ×2, Defiance `26018` and Side Step `26019` ×3, Get Behind Me! `26020` ×2 and Preservation `26021` ×1. Its Basic source uses Machine Man `26022` and Avengers Mansion `26023` ×1, Reboot `26024` ×3 and Energy/Genius/Strength `26025`–`26027` ×1.

Intangible has Permanent but no Setup keyword. Native initialization holds the same actual mass piece aside before shuffling and opening draw; the alter-ego Setup ability puts it into play Intangible **after mulligan**. The printed alter ego has a five-card hand, so its normal opener has five cards. Intangible then makes its current maximum hand size six without retroactively drawing another opening card. Changing the mass face retains the same physical ID and owner. This sequence follows the [identity contract](vision-integration.md) and current Rules Reference setup order.

Vision has printed HP11, ATK0, THW2 and DEF0 with a five-card hero hand. The printed alter ego has **REC3 and a five-card hand**, as recorded in the unchanged catalog and original product evidence. Dense adds +2 ATK/+2 DEF in hero form and +2 REC through alter-ego text; Intangible adds +1 alter-ego hand size. These are derived bonuses, not metadata replacements.

## Exact Core aliases

| Physical printing        | Core rules |
| ------------------------ | ---------- |
| Indomitable `26017`      | `01082`    |
| Get Behind Me! `26020`   | `01078`    |
| Avengers Mansion `26023` | `01091`    |
| Energy `26025`           | `01088`    |
| Genius `26026`           | `01089`    |
| Strength `26027`         | `01090`    |

All six pairs match the complete printed text, traits, resources, card type, faction, cost, numeric stats, uniqueness and deck limits. Execution preserves the physical Hero Pack code. Side Step `26019` and Preservation `26021` retain dedicated physical adapters for their other-product reprints and add no Core aliases.

Corrupted Programming `26028` is the obligation. The five physical nemesis cards are Ultron `26029`, Ultron Unleashed `26030` and Ultron Drones `26031` ×1, plus Relentless Android `26032` ×2. They remain separate from the forty-one-piece player source composition.

## Verification boundary

`tests/vision-metadata-decks.test.ts` checks the exact source, required quantities, all four aspect starters, single physical mass-form construction, reverse-face rejection, six complete Core equivalences, reprint limits, identity uniqueness and actual deck-editor/source-browser presentation. All sixteen cases pass against the connected native host, including the five-card opening, same-ID setup after mulligan, derived REC/hand-size/power values and preservation of Valkyrie’s sixteen ordinary required signatures. Together with the existing Spectrum/Adam Warlock and Valkyrie metadata suites, the focused run passes all forty-eight cases in three files (`output/vision-metadata-final.log`). Full identity timing, player-pool behavior, mission matrix, production browser, inventory hashes and publication are separate checks and are not certified by static registration alone.

The standalone comparison records all thirty-eight faces, the exact 15/17/8 playing split, the one physical Permanent and all sixteen checked fields for each Core pair in `output/vision-static-source-check.json`. All six Core pairs match without changing either imported data file.

The read-only registry measurement in `output/vision-registry-measurement.json` reports **1,204 executable faces, 729 dedicated faces, 3,347 unsupported faces and 29 registered identities**. This measures the live support predicate and staged code lists; mission, browser and publication checks remain separate from this metadata proof. The final generated inventory contains the same registry counts; all 73 frozen source hashes match.

## Local release preparation — 2026-10-08

Focused native integration passes **220 cases across seven files**: 64 pure identity, 36 native identity, 55 pure player pool, 26 native player pool, 31 Jocasta compatibility and eight generic Alliance/payment controls (`output/vision-host-final-focused.log`). Jocasta exposes actual stored Defense events through the same source extraction path, including Mass Increase and older printings. Joining Forces retains both actual allies during Alliance payment and enters both before response windows; Meditation carries its before-benefit exhaust receipt through the nested physical PLAY.

The corrected production build and configured formatting pass; native Node 24.19.0 API startup returns HTTP 200 with **60 runtime modules and six JSON dependencies**. All **73 inventory source hashes** match, recording **1,204 executable faces, 729 dedicated faces, 3,347 unsupported faces and 29 registered identities**. The sole frozen entry is `index-DBaGMbml.js`, SHA-256 `f28c7956e2fa228960850e3eff97d10e4abca38e5669e54edca78282c80d3d93`. Evidence: `output/vision-negative-build-final.log`, `output/vision-negative-api-final.log`, `output/vision-negative-style-final.log`, `output/vision-negative-audit-check-final.log` and `output/vision-negative-entry-sha256.json`.

The corrected frozen full regression passes **6,752 tests, one existing intentional skip and 145 files**, including all **2,160 original-source mission configurations** (`output/vision-regression-certified-final.log`). The five Vision Core-driver controls and eight guided continuation controls also pass. The same frozen entry passes thirteen native flows plus the original-source launch at 1440/1280/390/320: **133 accessibility audits, 132 layout checks and 133 distinct screenshots**, zero browser errors or accessibility violations. Saved payments, native choices and source actions conserve all forty playing-card IDs and the same physical reversible Permanent, with the normal five-card opening followed by setup after mulligan. The exercised continuations include native mass changes, printed Solar Beam modes, Piercing, Just Passing Through choosing the main scheme while Crisis is present, physical attachment removal, stored Jocasta Defense events, hidden Defiance boosts, Machine Man, retained Joining Forces allies and Meditation's nested PLAY. Evidence: `output/vision-production/report.json`; immutable raw reports remain in `output/vision-production-desktop/` and `output/vision-production-mobile/`. The ten-image manual review of this same entry is recorded in `output/vision-visual-review.json`. Exact commit/push, READY deployment identity, canonical live behavior and official CI remain pending.
