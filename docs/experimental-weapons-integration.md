# Experimental Weapons modular encounter integration

Experimental Weapons is the four-card modular encounter set from The Rise of Red Skull. The selectable module `exper_weapon` uses exactly one original instance of each printing, 04072–04075. It is appended to the existing module list so every earlier module index and deterministic mission seed remains unchanged. This import does not enable a Rise of Red Skull scenario or campaign.

Laser Rifle (04072) adds its printed +1 ATK. Its Forced Interrupt grants Ranged to each actual attack made by the attached villain; that grant survives removal or blanking of the rifle later in the same attack. Status-replaced activations do not create an attack. Its Hero Action spends one Energy and one Physical resource to discard the rifle.

Energy Shield (04073) gives the attached villain Retaliate 1, added to other active Retaliate sources. The shield's text must be active, and native Ranged attacks bypass the resulting Retaliate. Its Hero Action spends one Energy and one Mental resource to discard it.

Power Gauntlets (04074) requires the attached villain to complete an attack that actually damages the attacked identity. Its Forced Response makes that player choose and discard one current hand card. Tough, full prevention, a status-replaced attack, damage solely to an ally, and unrelated damage do not trigger it. The recipient follows native teammate defense; Overkill damage to that identity does satisfy the trigger. The Hero Action costs one Mental and one Physical resource.

Exo-Suit (04075) adds its printed +1 ATK and +1 SCH. Its Hero Action spends one Energy, one Mental and one Physical resource. Blanking removes a weapon's text abilities but retains its printed stat modifiers. Every removal uses native resource selection, wild substitution, cancellation and actual physical discard. Once the payment is accepted, its queued effect completes normally.

The source catalog, source decks, images and printed metadata remain unchanged. Focused module and engine tests preserve the original player decks and all four encounter instances through reveal, payment, attack, discard and JSON reload. They cover typed resource requirements, multiplayer control, prevention and retaliation boundaries; browser checks exercise the visible removal controls and native choices. Measured release verification is recorded separately after the final runtime is frozen.
