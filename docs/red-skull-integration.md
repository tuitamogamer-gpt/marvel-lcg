# Red Skull native scenario

This continuation starts from `cb7cb226c481e80dcfd2429b391c795dbd7d82c9` and adds the fifth Rise of Red Skull scenario.

## Original source and scope

Red Skull registers all 22 original faces `04125`–`04144`, including both sides of The Rise of Red Skull and New World Hydra. The source contains 28 printed physical cards; selecting two villain stages leaves 27 physical scenario cards in each game. Standard selects I/II, Expert II/III. Two distinct replaceable modular sets default to Hydra Assault and Hydra Patrol. All thirty installed modular sets are legal selections.

The scenario uses original physical villain and main-scheme cards, a separate side-scheme deck and discard pile, and the original set-aside Sleeper. The Red House starts in play. Side-scheme reveals, defeat effects and saved choices use the native serializable engine. Imported catalog data, original source decks and artwork remain unchanged.

Native rules cover the villain's side-scheme attack bonus, both main stages, The Red House's damage protection and optional stat substitution, The Sleeper's entry and removal, all four attachments, treacheries and side-scheme rewards. Side-scheme recycling preserves original IDs without adding acceleration. Player-owned schemes and Victory cards keep their appropriate destinations. Twisted Reality uses its current Forced Interrupt erratum and triggers once before a valid defeat.

Red House choices remain thwarts, including ally consequential damage and Wasp's Giant distribution. Authored stat contributions also support True Grit, Askani'son and Push Ahead without replacing fixed amounts or the latter card's separate ATK and DEF contributions. Tests also cover a Hydra Exo-Soldier boost during Dark Phoenix's activation: the extra boost is stored for Red Skull, while the minion's current activation continues normally. Master Strategist resolves before Spider-Sense's draw and consumes at most one copy per activation.

The editable Rise of Red Skull preset now includes Crossbones, Absorbing Man, Taskmaster, Zola and Red Skull. These remain standalone sequences with the campaign manager's saved teams, decks and journals. Official campaign special rules, rewards and carry-over are still pending.

## Coverage boundaries

The executable registry contains 2,377 faces, including 1,938 dedicated faces, with 2,174 imported faces still unsupported. There are 57 playable identities, fifteen scenarios and thirty modular sets. Rise of Red Skull has 165 of its 181 faces registered; sixteen campaign faces remain pending. The inventory pins 133 source files.

The configured source matrix contains 46,280 cases in eight disjoint shards of 5,785. Red Skull adds 3,120 cases across 52 expansion starter identities, both difficulties and thirty primary modular selections. Its second distinct modular slot is filled deterministically; this does not enumerate every two-module pair. Manifest hashes retain all 43,160 previous mission names and seeds. Configuration totals are separate from executed validation results.

Rules references: the [Rise of Red Skull rulebook](https://hallofheroeslcg.com/wp-content/uploads/2020/09/rorsrulesspoilers.pdf), [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), and the original imported card texts and scans.

## Measured local validation — 2026-10-29

- The complete regular regression passes 10,440 tests across 286 files, with one intentional skip (`regular.log`).
- All 3,120 new source configurations pass across eight filtered global shards, each executing 390 Red Skull missions and one complete-manifest assertion. Every shard's 133 recorded source hashes match the final runtime. Original player/scenario cards are audited through native actions and reloads. The other 43,160 configured source cases were not rerun locally.
- All 58 focused Red Skull cases pass, including actual payments, multiplayer ownership, original physical cards, pending choices across reloads, stat substitution and defeat timing.
- The inventory and campaign suites pass 47 cases. A historical inventory subtotal initially omitted the new 22-face exclusion; correcting that test arithmetic needed no runtime change. The complete two-file rerun passes, including all 133 live source hashes and an exact campaign backup/restore during Censor the Past's multi-card selection.
- Production build, formatting and native API entry pass. The unconfigured local API returns HTTP 200 with account storage unavailable; 117 runtime modules and six JSON dependencies load on Node 24.19.0.
- Red Skull's full browser suite passes 29 flows, 44 accessibility audits and 44 layout checks across 1280, 768, 390 and 320 px. Retained campaign coverage passes ten flows, nine audits and nine layout checks; retained Zola coverage passes 21 flows, 24 audits and 24 layout checks. All three suites report zero browser errors.
- Desktop and mobile screenshots were reviewed, including original attachments, side-scheme piles and typed-resource payment. Browser positions that exercise specific effects are explicit fixtures using original card instances, separate from complete source-mission simulations.

Evidence is retained locally under `output/red-skull-release/`; early smoke and pilot logs remain separate from final checks. Remote CI and deployment status are separate from local checks.
