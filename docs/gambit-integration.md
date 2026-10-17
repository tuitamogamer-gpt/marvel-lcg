# Gambit Hero Pack native integration

The original Gambit catalog contributes 36 printed faces and 59 physical cards, including the 40-card Justice starter, the five-card nemesis set, obligation, additional player cards, and the six-card Exodus modular encounter set. Catalog JSON and downloaded artwork remain unchanged. The two identity image filenames are mapped to the correct displayed face in `imageFor`.

`src/game/gambit.ts` implements both identity abilities, charge counters, all signature cards, the Justice and Basic player pool, additional player cards, obligation and nemesis, and Exodus. The module reads the cycle-free card definitions leaf. Its narrow host adapter uses native paid actions, reaction windows, enemy activations, physical card zones, attack scopes, damage, thwarting, and encounter searches. All four standard aspects have legal native decks; Justice preserves the exact original source list.

## Rules boundaries

- Charge de Card is once per round. Counters survive flips, rounds, and serialized reloads. Throw de Card pays up to three counters when an attack event is played, after resource-payment interrupts and before resolution, including reaction events. Its bonus belongs to that physical event's current resolution and is cleared afterward.
- Thief Extraordinaire pays exhaustion and encounter-card look/discard costs before confused replaces the thwart. The Thieves Guild responds only when the ability resolves. Operative Skill modifies identity thwart attempts, with physical counter expenditure and discard after the last counter.
- Royal Flush is one attack with three sequential damage instances. Throw de Card modifies every instance; Tough can stop the first instance and Retaliate resolves once per surviving attacked enemy. This follows Rules Reference 1.8, Attack, and the official Royal Flush/Flurry ruling.
- Natural Agility, Gambit's Staff, Guild Armor, and Bishop use native interrupt/response windows. Bishop's “attacks you” refers to the attacked player, including an ally defender. War Room requires an ally attack to defeat the minion.
- Psionic Shield replaces a minion leaving play after defeat interrupts, so Priority Target can resolve before the Shield restores the minion. A surviving minion can trigger a later defeat interrupt again. Non-defeat movement also honors the replacement.
- Assassination Attempt makes all Assassin minions attack the resolving player, including in alter-ego form. Nemesis cards retain their owned physical IDs. Exodus searches actual encounter zones for its Shield; Herald of Avalon uses the defeating player's context; Acolyte Frenzy resolves activations and both printed boost statuses.

## Reprints and shared cards

Energy, Genius, and Strength use the existing exact Core aliases. Professor X and X-Mansion add their physical Gambit printing to the Mutant Genesis handlers. Passion for Justice uses the Phoenix resource handler. Beauty and the Thief recognizes both `37019` and Rogue printing `38020`, with native dispatch selecting one handler. Registration here includes only the Gambit printing; Rogue can provide its own isolated fallback. Mutant Education and X-Men Instruction shuffle selected physical cards and honor any friendly X-Mansion printing.

## Verification

`tests/gambit-native.test.ts` exercises source registration, exact source deck and nemesis inventory, actual paid events and reaction windows, identity charges, physical searches/shuffles, face mapping, printed reprints, Exodus, and the Royal Flush/Psionic Shield ordering boundaries. Retained Phoenix, Mutant Genesis player-pack, import-order, pacing, and seeded Gambit scenario tests cover the shared integration seams. Browser source-launch acceptance and the combined scenario matrix are maintained by the parent integration task.
