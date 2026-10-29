# Zola native scenario

This import continues from `a2a3c22d05939da0239e95684e4bad4341881e64`. That main-branch checkpoint passed all 46 jobs in [CI 40746776090](https://github.com/tuitamogamer-gpt/marvel-lcg/actions/runs/40746776090), including all 40,040 configured source missions and all 37 browser groups.

## Original source and scope

Zola registers all eighteen original faces `04109`–`04124`, including both sides of The Island of Dr. Zola and The Mad Doctor. The source contains 31 printed physical cards; selecting two villain stages leaves 30 physical scenario cards in each game. Standard selects I/II, Expert II/III. Under Attack is the recommended replaceable modular set; all thirty installed modular sets are legal. There is no additional fixed modular set.

The implementation uses original physical villain, main-scheme, minion, attachment and side-scheme instances. Hydra Prison stores actual hero-specific allies from their owners' decks, hands or discard piles and returns them when rescued. Setup puts each player's original Ultimate Bio-Servant into play. Main-scheme test counters are stored on the current physical scheme. The UI displays those counters and the number of allies held beneath Hydra Prison without exposing hidden card faces.

Native handlers cover both main stages, villain stage-reveal searches, test-counter minion entry, Ultimate Bio-Servant's attachment bonus, Zola's Mutate's Tech search, Berserk Mutate's boost, all three Tech attachments, Mind Ray, Technological Enhancements, Hydra Prison, Test Subjects and Zola's Experiments. Deck searches, discard-until effects, payments, choices and active encounters use the existing serializable engine rather than replacing original cards with synthesized copies.

The editable Rise of Red Skull preset now includes Crossbones, Absorbing Man, Taskmaster and Zola. These remain standalone sequences with the campaign manager's saved teams, decks and journals. Red Skull and official campaign rewards and carry-over rules remain pending.

The continuation also corrects Hunted by Hydra's damage source: every player's damage packet retains the original treachery's physical ID. A two-player Cable/Force Field regression fails on the previous seat-ID shadowing bug and passes with the correction, including reloads during the prevention windows.

## Coverage boundaries

The executable registry contains 2,355 faces, including 1,916 dedicated faces, with 2,196 imported faces still unsupported. There are 57 playable identities, fourteen scenarios and thirty modular sets. Rise of Red Skull has 143 of its 181 faces registered; 38 remain pending. The inventory pins 132 source files.

The configured source matrix contains 43,160 cases in eight disjoint shards of 5,395. Zola adds 3,120 cases across 52 expansion starter identities, both difficulties and thirty modular sets. Manifest hashes retain all 40,040 previous mission names and seeds. Configuration totals are separate from executed validation results.

Rules references: the [Rise of Red Skull rulebook](https://hallofheroeslcg.com/wp-content/uploads/2020/09/rorsrulesspoilers.pdf), [Rules Reference 1.8](https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf), and the original imported card texts and scans.

## Measured local validation — 2026-10-29

- Regular regression covers 10,323 cases across 285 files, with one intentional skip. The broad run passed 10,322 and found one obsolete campaign fixture that still expected Zola to be unsupported. That fixture now checks Red Skull; the complete 27-case campaign suite passes on rerun. No runtime change was needed for this fixture correction. Both logs are retained (`regular.log` and `campaign-domain-final.log`).
- All 42 focused Zola cases pass, including actual Guard targeting, one combined Hydra Prison threat packet, Mind Ray's original-player targeting after elimination, and Zola's Experiments timing. The Hunted by Hydra regression and all 35 Taskmaster cases also pass.
- All 3,120 Zola source configurations pass on the final runtime across eight filtered global shards, with 390 cases and one full-manifest assertion per shard. Every original scenario and player card is audited through native actions and reloads. The other 40,040 configured cases were not rerun locally; their previous main checkpoint passed full CI as recorded above.
- Final production build, formatting and native API entry pass. The unconfigured local API returns HTTP 200 with account storage unavailable; 116 runtime modules and six JSON dependencies load on Node 24.19.0.
- The full Zola browser suite passes 21 flows, 24 accessibility audits and 24 layout checks across 1280, 768, 390 and 320 px with zero browser errors. Existing campaign browser coverage passes ten flows, nine audits and nine layout checks.
- Desktop and mobile screenshots were reviewed, including the original Defensive Programming attachment artwork. The original catalog, deck data and assets are unchanged.

Evidence is retained locally under `output/zola-release/`. Browser positions that exercise a specific native effect are explicit fixtures using original card instances; they do not claim complete human-played browser missions. Remote CI and deployment status are separate from local checks.
