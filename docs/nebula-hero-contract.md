# Nebula original Hero Pack integration

Nebula uses canonical identity ID `nebu` and original faces `22001a/b`. Her Hero Pack contains **36 imported faces**: sixteen dedicated identity/signature/obligation/nemesis faces, fourteen dedicated player-pool faces and six exact Core reprints. The executable namespaces are `NEBULA_SCRIPT_CODES` in `nebula.ts` and `NEBULA_PACK_SCRIPT_CODES` in `nebula-pack.ts`. Reverse identity faces count separately from physical cards. Nebula's Ship `22003` was already recognized by the declarative resource compiler, so the thirty dedicated registrations add twenty-nine newly executable faces to the prior registry.

## Original Justice source

The [immutable starter snapshot](../src/data/catalog-decks.json) supplies exactly **40 physical cards: 15 signatures, 17 Justice and 8 Basic**. It has no Permanent setup cards or separate player decks. Source launch and saved-deck editing preserve the original `22` printing codes instead of replacing them with equivalent older printings. The source provenance links to the [original printed starter list](https://hallofheroeslcg.com/wp-content/uploads/2021/09/nebula-starter-deck.jpg) and the pinned starter table recorded in the import.

| Signature printing             | Physical quantity |
| ------------------------------ | ----------------: |
| `22002` Gamora                 |                 1 |
| `22003` Nebula's Ship          |                 1 |
| `22004` Cutthroat Ambition     |                 2 |
| `22005` Evasive Maneuvering    |                 1 |
| `22006` Unyielding Persistence |                 1 |
| `22007` Weapons Master         |                 2 |
| `22008` Wide Stance            |                 2 |
| `22009` Combat Ready           |                 2 |
| `22010` Lethal Intent          |                 3 |

Alternate-aspect decks retain those exact signature quantities. Nebula follows the ordinary one-aspect deck rule; her generic editor locks signatures and validates 40–50 playing cards, unique-card identity restrictions and logical copy limits across reprints. Daughters of Thanos is limited to one per deck despite two physical copies in the retail pack.

Nebula's hero has HP9, ATK2, THW2, DEF2 and a five-card hand. Her alter ego has REC3 and a six-card hand. `nebulaStats` supplies active Technique bonuses; `nebulaNamedCharacterModifiers` supplies Self-Preservation's modifiers to each named character separately. `heroStats` combines them once. The host's ally/enemy contexts use the named-character helper directly. Honorary Guardian's actual attached card contributes one HP through `nebulaPackModifiers` to the recipient's maximum; its Guardian trait belongs to the same recipient.

## Printed metadata, current errata and Core aliases

Original scans in `public/cards/catalog/22027.webp`–`22031.webp` verify numeric boosts **2, 3, 2, 2, 1**. Gamora `22028` has ATK2 with its attack star, SCH2 and HP6. Old Rivals `22031` has two physical copies. Self-Preservation `22029` begins with two threat per player and has no encounter icon. Lethal Weapon `22030` has a printed **+1 ATK icon outside its text box**; the imported catalog omits this field. `printedCardMetadata` restores `attack:1` without modifying its imported text or quantity. The machine inventory records the scan URL and numeric correction independently from text errata.

[Published RRG1.8 p67](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf#page=67) corrects Eros `22011` to: “After you play Eros from your hand, for each [mental] resource you used to pay for him, choose a minion and confuse it.” The playable database and card inspector use this correction; the raw downloaded printing remains unchanged. Each actually paid Mental generates a separate selection, so the same eligible Steady minion may be selected twice. Overpaid resources do not count. Cosmo `22020` already contains the current player-deck/encounter-deck restriction in the imported snapshot and needs no further text replacement.

| Physical Nebula printing     | Existing Core rules |
| ---------------------------- | ------------------- |
| `22017` The Power of Justice | `01062`             |
| `22019` Heroic Intuition     | `01065`             |
| `22023` First Aid            | `01086`             |
| `22024` Energy               | `01088`             |
| `22025` Genius               | `01089`             |
| `22026` Strength             | `01090`             |

Determination `22016`, Cosmo `22020` and Knowhere `22021` retain dedicated physical adapters despite earlier expansion printings. They add no Core aliases. The fourteen dedicated pool faces are `22011`–`22016`, `22018`, `22020`–`22022` and `22032`–`22035`.

## Verification boundary

`tests/nebula-metadata-decks.test.ts` verifies source quantities, both identity faces, all thirty-six retail registrations, the six exact aliases, alternate aspects, cross-printing copy limits, locked signatures, rendered source launch/editor rows, immutable printed metadata and Eros's current text. `tests/expansion-missions.test.ts` adds Nebula to the native source-deck mission matrix and retains the forty original player IDs throughout each exercised mission. The machine inventory includes both new module hashes and the same shared runtime/metadata source hashes as prior heroes.

`tests/nebula-engine.test.ts` adds 39 native dispatch cases with JSON hydration at each pending decision. They verify the original forty player IDs and five actual Shadows nemesis IDs, mandatory own-turn and new-round Specials, continuous sources surviving until the final Protocols discard, actual PLAY versus put-into-play responses, last-original-card reset, paid X and cancellation, both-form/current-controller Ship payment, physical obligation routing, and enemy/ally/hero Old Rivals attacks. Friendly ally attacks retain Target Practice and Last Stand interrupts, after-attack responses and consequential damage without exhausting Gamora. An initiated attack ending before damage reports an attack made under current RRG1.8 p9/p58; pre-initiation Stun replacements report no attack and grant native facedown Surge.

Registration and metadata closure alone do not certify every interaction. Final native acceptance, mission matrix, browser and publication results belong to the frozen release snapshot; later product interactions, unimplemented scenarios and campaigns remain outside this Hero Pack's proof.

## Frozen local release verification — 2026-10-08

The corrected production build and configured formatting pass; native Node 24.19.0 API startup returns HTTP 200 with **54 runtime modules and six JSON dependencies**. All **67 inventory source hashes** match the registry snapshot of **1,109 executable registrations, 634 dedicated faces, 3,442 unsupported faces and 26 identities**. The corrected entry is `index-CY5NltRL.js`, SHA-256 `744f04b12ff03951e2dcc018a168579060fcbf1fbec5d2c39c281f2acbdfec90`. Evidence: `output/nebula-build-corrected-final.log`, `output/nebula-style-corrected-final.log` and `output/nebula-api-corrected-final.log`.

The corrected full regression passes **5,822 tests, one existing intentional skip and 126 files**, including all **1,890 original-source mission configurations** (`output/nebula-regression-corrected-final.log`). Eros now labels and selects actual synthesized Ultron Drones without inspecting their hidden player-card source. The same corrected entry passes ten native flows and the original-source launch at 1440/1280/390/320: **129 accessibility audits, 128 layout checks and 129 distinct screenshots**, zero browser errors or accessibility violations. Every exercised saved payment/choice retains the original forty player-card IDs, including the actual player card beneath an Ultron Drone. Final evidence: `output/nebula-production-eros-final/report.json`, with raw reports retained in `output/nebula-production-eros-desktop/` and `output/nebula-production-eros-mobile/`. The seven-image manual review is recorded in `output/nebula-eros-visual-review.json`.

The forty original player cards remain the source composition. Shadows creates five actual nemesis cards at reveal; they are not an initial nemesis setup reserve. Nebula commit/push, exact READY deployment SHA, canonical live controls and official CI remain pending. The previously committed MTS snapshot is `5776a4179e2dcb04852fff3a8ea7f6b3a0d247fe`; its finalized local evidence and earlier Drax/Venom and Star-Lord/Gamora contracts remain preserved separately.
