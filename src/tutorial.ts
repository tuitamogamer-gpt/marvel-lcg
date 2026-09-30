import type { GameState } from "./game/types";

export const TUTORIAL_KEY = "champions.tutorial";
export const TUTORIAL_SETUP = {
  heroId: "spider_man",
  aspect: "justice" as const,
  villainId: "rhino",
  module: "bomb_scare",
  difficulty: "standard" as const,
  seed: 20260929,
};
export interface TutorialProgress {
  missionId: string;
  index: number;
}
export function readTutorial(): TutorialProgress | null {
  try {
    const saved = JSON.parse(localStorage.getItem(TUTORIAL_KEY) || "null");
    return saved &&
      typeof saved.missionId === "string" &&
      Number.isInteger(saved.index) &&
      saved.index >= 0 &&
      saved.index <= TUTORIAL_STEPS.length
      ? saved
      : null;
  } catch {
    return null;
  }
}
export function saveTutorial(progress: TutorialProgress | null) {
  try {
    if (progress) localStorage.setItem(TUTORIAL_KEY, JSON.stringify(progress));
    else localStorage.removeItem(TUTORIAL_KEY);
  } catch {
    /* Coaching continues when device storage is unavailable. */
  }
}
export interface TutorialStep {
  id: string;
  title: string;
  text: string;
  done: (s: GameState) => boolean;
  optional?: boolean;
}
export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "hand",
    title: "Keep your opening hand",
    text: "Start with six cards. Choose Keep hand & begin in the opening-hand window. You can also select cards to replace once.",
    done: (s) => s.phase !== "mulligan",
  },
  {
    id: "suit-up",
    title: "Become Spider-Man",
    text: "Choose Suit up beside Peter Parker's identity. Hero form lets you attack and thwart. You can change form once each turn.",
    done: (s) =>
      s.phase !== "mulligan" && (s.player.form === "hero" || s.round > 1),
  },
  {
    id: "play",
    title: "Your hand is your fuel",
    text: "Choose PLAY beneath a highlighted hand card. Other cards pay its cost: use Suggest resources, check the selection, then confirm. An ally or support is a useful first investment. Proceed resolves each paused step.",
    done: (s) => (s.stats?.cardsPlayed || 0) >= 1,
    optional: true,
  },
  {
    id: "attack",
    title: "Put pressure on Rhino",
    text: "Choose Attack in your action bar, then Rhino. A basic attack deals 2 damage and exhausts Spider-Man. Cards and allies can attack too. Guard minions must be dealt with before attacking the villain.",
    done: (s) => (s.stats?.damageDealt || 0) >= 1,
    optional: true,
  },
  {
    id: "end",
    title: "Let the villain act",
    text: "Choose End hero phase. Keep or discard your remaining cards, draw up to your hand size, and ready your cards. Rhino then adds threat and activates against you.",
    done: (s) => s.round >= 2 || s.phase === "villain",
  },
  {
    id: "defend",
    title: "Choose how to take the hit",
    text: "During Rhino's attack, choose a defender. Spider-Man's 3 DEF reduces damage but exhausts him for the next turn. Taking the hit keeps him ready. Read the boost and encounter reviews, then Proceed until your next turn.",
    done: (s) => s.round >= 2 && s.phase === "player",
  },
  {
    id: "thwart",
    title: "Protect the city",
    text: "Rhino wins when the main scheme reaches 7 threat. Use Thwart, an ally or a thwart event to remove threat. If Spider-Man defended, he is exhausted: use cards or allies, or ready him next round. When hurt, switch to alter-ego and Recover, allowing for Rhino to scheme instead of attacking.",
    done: (s) => (s.stats?.threatRemoved || 0) >= 1,
    optional: true,
  },
];
/** Later form changes and defeated allies cannot undo a completed lesson. */
export function currentStep(
  s: GameState,
  fromIndex = 0,
): { index: number; step: TutorialStep } | null {
  if (["won", "lost"].includes(s.phase)) return null;
  let index = Math.max(0, fromIndex);
  while (index < TUTORIAL_STEPS.length && TUTORIAL_STEPS[index].done(s))
    index++;
  return index < TUTORIAL_STEPS.length
    ? { index, step: TUTORIAL_STEPS[index] }
    : null;
}
