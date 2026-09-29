import { maxHP } from "./game/cards";
import type { GameState } from "./game/types";

/**
 * The first-mission tutorial: a fixed Spider-Man versus Rhino game with a
 * coach panel whose steps complete by watching the real game state.
 */
export const TUTORIAL_KEY = "champions.tutorial";
export const TUTORIAL_SETUP = {
  heroId: "spider_man",
  aspect: "justice" as const,
  villainId: "rhino",
  module: "bomb_scare",
  difficulty: "standard" as const,
  seed: 20260929,
};
export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  done: (s: GameState) => boolean;
}
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "hand",
    title: "Keep your opening hand",
    text: "You start with six cards. Keeping them is fine for this mission: click Keep hand & begin.",
    done: (s) => s.phase !== "mulligan",
  },
  {
    id: "suit-up",
    title: "Suit up",
    text: "Peter Parker begins in alter-ego form, which can only recover. Click Suit up on the identity card to become Spider-Man; you can change form once per turn.",
    done: (s) =>
      s.phase !== "mulligan" && (s.player.form === "hero" || s.round > 1),
  },
  {
    id: "play",
    title: "Play a card",
    text: "Every card is also a resource. Click PLAY on a highlighted card, then choose other cards from your hand to pay its cost. Suggest resources picks the least valuable ones for you.",
    done: (s) => (s.stats?.cardsPlayed || 0) >= 1,
  },
  {
    id: "attack",
    title: "Attack Rhino",
    text: "Your basic attack deals 2 damage and exhausts your identity. Click Attack, then choose Rhino. Thwart would remove threat instead.",
    done: (s) => (s.stats?.damageDealt || 0) >= 1,
  },
  {
    id: "end",
    title: "End the hero phase",
    text: "Click End hero phase. You may discard cards, then you draw back up to your hand size and everything readies. Then the villain acts.",
    done: (s) => s.round >= 2 || s.phase === "villain",
  },
  {
    id: "defend",
    title: "Survive the villain phase",
    text: "Rhino places threat, attacks, and reveals an encounter card. When he attacks you choose a defender: taking the hit keeps everyone ready, defending with Spider-Man uses his 3 DEF but exhausts him for your next turn.",
    done: (s) => s.round >= 2 && s.phase === "player",
  },
  {
    id: "thwart",
    title: "Keep the scheme in check",
    text: "The main scheme completes at 7 threat and the villain wins. Remove threat with Thwart, allies or events when it climbs. Try a basic thwart or a thwart event this turn.",
    done: (s) => (s.stats?.threatRemoved || 0) >= 1,
  },
  {
    id: "ally",
    title: "Bring in an ally",
    text: "Allies attack and thwart for you and can block an attack. Play one when you can afford it; the advisor's Suggest a move will point one out.",
    done: (s) =>
      s.players.some((p) =>
        (p.id === s.activePlayerId ? s.player : p.player).inPlay.some((c) =>
          ["01059", "01060", "01062", "01005", "01006"].includes(c.code),
        ),
      ) || (s.stats?.cardsPlayed || 0) >= 4,
  },
  {
    id: "recover",
    title: "Recover when hurt",
    text: "When Spider-Man is low on hit points, end a turn in alter-ego form: Rhino schemes instead of attacking, and next turn Recover heals 3. Finish the mission at your own pace; Undo takes back a slip.",
    done: (s) =>
      s.round >= 4 ||
      s.player.hp < maxHP(s) - 3 ||
      ["won", "lost"].includes(s.phase),
  },
];
export function currentStep(
  s: GameState,
): { index: number; step: TutorialStep } | null {
  const index = TUTORIAL_STEPS.findIndex((step) => !step.done(s));
  return index < 0 ? null : { index, step: TUTORIAL_STEPS[index] };
}
