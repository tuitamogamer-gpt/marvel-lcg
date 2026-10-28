# Saved campaigns and Absorbing Man

This continuation starts at `bfd94b47b4a130674b30ccd197e47dd72b044563` (`codex/crossbones-import`). It adds a playable Absorbing Man scenario and a local campaign manager for sequences of implemented standalone scenarios. No existing imported card, deck list, artwork or audio file is changed.

## Campaigns

The new Campaigns navigation opens a builder and a saved campaign library. Select one to three heroes and their decks in Play, then name a campaign, choose and order 1–12 scenarios, and choose their legal modular sets. Core Set, Mutant Genesis and the two imported Rise of Red Skull scenarios provide editable sequence presets. These are standalone sequences, not implementations of the corresponding official campaign rulebooks.

Each campaign snapshots the actual original deck order, aspects, difficulty, Heroic level and modular selections. Missions start with fresh heroes and those same decks. Only a victory unlocks the next mission. A defeat records an attempt and allows a retry with a new mission ID and seed. Completing the last mission closes the campaign. Results are idempotent by mission ID; stale saves and unrelated missions cannot advance another attempt.

Up to ten campaigns are stored on this device, including for signed-in players. The active table (hands, shuffled decks, payments, decisions and review checkpoints) and result journal share one versioned local-storage envelope. Switching campaigns preserves each table. Notes are saved on blur; JSON export includes the in-memory library and active tables. A failed storage write keeps progress in memory, shows a persistent warning, offers retry, and warns on navigation away. Malformed saves are left untouched and can be exported for recovery. Deleting a campaign requires an explicit confirmation in the interface. Campaign tables are not silently imported into account storage.

Official campaign rewards, campaign obligations, deck changes between scenarios, expert persistent damage and other product-specific campaign rules remain unsupported. The inventory's `campaignSupport` list continues to denote official rules implementations, not standalone mission sequencing. Taskmaster, Zola and Red Skull remain catalog-only. No preset presents the two available Rise of Red Skull missions as the full five-scenario official campaign.

## Absorbing Man source and native rules

The original eighteen English faces `04076`–`04092` describe 25 physical scenario cards. A game selects two of the three villain stages, so physical-zone conservation covers 24 scenario cards. Standard uses I/II; Expert uses II/III. None Shall Pass starts with 2 threat per player, escalates by 1 per player, and loses at 12 per player. Hydra Patrol is the recommended replaceable modular set.

Setup discards to an original environment, puts it into play without revealing/Surge, then shuffles the discarded cards back into the encounter deck. Stage II reveals Super Absorbing Power or deals an encounter to each player if it is already in play. Delay increases after villain-phase step one. An entering environment discards other non-Permanent environments. Absorbing Man gains the environment traits; Super Absorbing Power independently grants all four material traits. Native trait queries expose these grants to other cards, including Rogue.

The native module implements all four environment responses, their five-delay thresholds, their put-into-play boost effects, Ball and Chain's typed payment and shuffle, every treachery and boost ability, and Avalanche's separate per-player choice. Environment responses require an undefended attack: an ally killed by attack damage still defended, while an ally removed during boosts is handled by the existing attack target calculation. Stage III's material response applies after completed attacks and schemes, not Stun/Confuse replacements. Native cancellation, damage allocation and payment windows remain serializable.

Printed sources were checked against the local scans for `04077`, `04078`, `04079b` and `04080`–`04092`. Numerical metadata already agrees with the scans; no source overlay was needed. Rules references are the [Rise of Red Skull rulebook](https://hallofheroeslcg.com/wp-content/uploads/2020/09/rorsrulesspoilers.pdf) and [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf).

## Coverage

The executable registry now contains 2,320 faces, including 1,881 dedicated faces, with 2,231 imported faces still unsupported. There are 57 playable identities, twelve scenarios and thirty modular sets. Rise of Red Skull has 108 of 181 faces registered; 73 remain pending. The audit retains all previous registered faces and pins 130 source files.

The original-source mission manifest now contains 37,024 configurations, including 3,120 new Absorbing Man configurations. All 33,904 prior mission names and seeds remain unchanged. Eight shards contain 4,628 configurations each. Configured cases are not a claim that every case was executed locally. Focused native tests audit exact original card ownership across setup, environment replacement, boosts, villain transitions, payments and save/reload.

`npm run test:campaigns` runs the production browser flow for creation, exact reload, native terminal effects, advancement, retry, completion, export, storage failure/retry and responsive accessibility. Terminal positions use explicit native-effect fixtures rather than claiming complete human-played browser missions. `tests/campaigns.test.ts` covers legal snapshots, loss/win progression, duplicate/stale results, independent campaigns, corrupt saves and blocked storage. `tests/absorbing-man.test.ts` covers the original scenario rules and physical instances.

## Measured local validation — 2026-10-28

- Full regular regression: 10,116 passed across 283 files, with one intentional skip, in 438.15 seconds. Source-mission configurations are measured separately below.
- Focused campaign, Absorbing Man and retained Crossbones tests: 139 passed across four files.
- Original-source missions: all 104 Absorbing Man/Hydra Patrol missions passed across 52 expansion identities and Standard/Expert, plus the complete manifest/partition assertion (105 passing tests; 36,920 unselected cases). This is a measured subset of the configured matrix.
- Production build and native API entry passed. The API returned HTTP 200 with account storage intentionally unavailable in the unconfigured local environment; 114 runtime modules and six JSON dependencies loaded on Node 24.19.0.
- Campaign browser suite: five behavior flows, seven accessibility audits and seven layout checks passed with zero browser errors, at widths from 320 to 1280 px. The retained experience suite passed seven behavior flows, ten accessibility audits and nine layout checks with zero errors.
- Formatting and whitespace checks passed; the regenerated inventory's 130 source hashes match the tested runtime and data.

Evidence is retained locally under `output/campaigns/`: `final-regular-tests.log`, `final-source-missions.log`, `final-build.log`, `production-entry.log`, `audit-final.log`, `browser/report.json` and `experience/report.json`. Superseded browser failures are archived separately. Publication is a draft continuation of the Crossbones branch; these local results do not claim completed remote CI or a production deployment.
