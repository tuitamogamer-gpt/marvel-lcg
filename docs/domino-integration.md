# Domino and NeXt Evolution player cards

`src/game/domino.ts` implements the original Domino identity and signature cards, the NeXt Evolution Justice/Basic pool numbered 40050–40064, and obligation/nemesis 40065–40069. The exact source Justice starter contains 40 physical playing cards. Five owned nemesis cards begin set aside. Original catalog JSON and scans remain unchanged.

The native leaf imports the cycle-free card definitions. `engine.ts` supplies physical draws/discards, attack programs, payments, damage, thwarting, encounter windows, and entry/leave cleanup. Even the Odds and Overwatch use the existing Spider-Ham pack handlers through explicit canonical printing aliases, preserving their actual NeXt Evolution printing codes and physical IDs. Energy, Genius and Strength use the exact Core reprint aliases.

## Timing and physical ownership

- The two identity faces have independent once-per-round swaps. Swapping never counts as discarding. Neena swaps with the most recently discarded physical card. Domino's hero-side constant doubles each printed wild resource when counting a top-deck discard; it does not change payment values and is inactive in alter-ego or while Memories of Armageddon blanks the identity.
- Top-deck discard receipts preserve the actual card IDs, owner, and the full discarded cohort. Jackpot, Digging Deep, White Fox and The Painted Lady offer optional response ordering only after the complete discard. They move the same physical card once. A deck that empties resets immediately, before optional responses; responses still find the same physical discarded card in the reshuffled deck, as clarified by FFG ruling 92 for Digging Deep.
- Domino's Pistol resolves the discard cost and its responses before the Sharpshooter interrupt. Resource counts are recorded before those cards can move. Painted Lady stores up to three original facedown cards and normal leave-play cleanup returns them to their owners.
- Diamondback can pay her final hit point and finish the already initiated ability. Atlas Bear can inspect another player's deck and gives the actual event to its owner. Outlaw, Feral and Wolfsbane use the native basic ally timing windows.
- Probability Field modifies one basic ATK, THW, DEF or REC. Its defense modifier survives the native recalculation at attack resolution. Sharpshooter uses the actual ranged attack window. A Good Workout runs its two selected damage packets within one attack program, allowing different enemies while retaining attack aftermath.
- Lucky and Good cancels both boost icons and the boost ability and assigns an actual replacement boost. Lucky Break cancels the physical encounter and explicitly reveals a new physical card; it does not introduce a synthetic surge keyword.
- Superpower Feedback responds to resolved triggered identity/identity-specific abilities, including signature events and triggered discard responses. Basic powers and Domino's constant resource doubler do not trigger it. Both Memories of Armageddon and Superpower Feedback expose their printed alter-ego removal actions.
- Player side scheme rewards retain their physical source until each player's choice completes, then enter the victory display. Topaz searches actual encounter/set-aside zones for Feedback; Prototype's luck counters modify maximum hit points and blanking removes that modifier.

## Source rulings

The NeXt Evolution rulebook FAQ and [official FFG rulings collected by Hall of Heroes](https://hallofheroeslcg.com/latest-ffg-rulings-post-rrg-1-5/) supply the relevant clarifications: entries 69–71 (August 18, 2023) explain wild counting, Diamondback's last hit point and immediate deck reset; entry 77 (August 31, 2023) requires the whole discard cohort to finish before responses; entries 82–83 (September 7, 2023) distinguish constant abilities from resolved abilities and order Jackpot before Sharpshooter; entry 92 (September 21, 2023) preserves last-card Digging Deep after the immediate reset. Rules Reference 1.8 supplies the general basic-power and attack-program boundaries.

## Verification

`tests/domino-native.test.ts` exercises original face registration and source composition, all four legal starter aspects, actual paid events and public abilities, exact physical swaps/discard responses, native ally timing, multiplayer owner movement, upgrade defense/encounter interrupts, side-scheme victory rewards, source reprints, nemesis setup, and blanking. Existing Gambit and Spider-Ham pack tests cover the shared attack, discard and reprint seams. The integration task owns the full source mission matrix, browser acceptance and shared generic put-into-play adapter used by the NeXt Evolution search rewards.
