import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle, X } from "@phosphor-icons/react";
import type { GameState } from "./game/types";
import { keywordsIn } from "./game/glossary";
import {
  currentStep,
  readTutorial,
  saveTutorial,
  TUTORIAL_STEPS,
} from "./tutorial";

export function TutorialCoach({
  game,
  onClose,
}: {
  game: GameState;
  onClose: () => void;
}) {
  const missionId = game.accountMission!.id;
  const [index, setIndex] = useState(() => {
    const saved = readTutorial();
    return saved?.missionId === missionId ? saved.index : 0;
  });
  const current = currentStep(game, index);
  const nextIndex = current?.index ?? TUTORIAL_STEPS.length;
  useEffect(() => {
    setIndex(nextIndex);
    saveTutorial({ missionId, index: nextIndex });
  }, [missionId, nextIndex]);
  return (
    <section className="tutorial-coach" aria-label="First mission coach">
      <div className="coach-heading">
        <span>
          <BookOpen size={16} /> FIRST MISSION
        </span>
        <button
          className="icon-button"
          aria-label="Dismiss first mission coach"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>
      <div
        className="coach-progress"
        role="progressbar"
        aria-label="First mission lessons"
        aria-valuemin={0}
        aria-valuemax={TUTORIAL_STEPS.length}
        aria-valuenow={nextIndex}
      >
        {TUTORIAL_STEPS.map((step, i) => (
          <span
            key={step.id}
            className={
              i < nextIndex ? "complete" : i === nextIndex ? "current" : ""
            }
          />
        ))}
      </div>
      <div aria-live="polite" aria-atomic="true">
        <h3>
          {current
            ? `${current.index + 1}. ${current.step.title}`
            : "You know your way around."}
        </h3>
        <p>
          {current?.step.text ||
            "Keep playing this mission. Defeat both Rhino stages while protecting your health and the scheme. Suggest a move offers a hint; you make the decisions."}
        </p>
      </div>
      {current?.step.optional ? (
        <button
          className="text-button"
          onClick={() => setIndex(current.index + 1)}
        >
          Skip this lesson <ArrowRight size={14} />
        </button>
      ) : !current ? (
        <button className="text-button" onClick={onClose}>
          <CheckCircle size={16} /> Continue on my own
        </button>
      ) : null}
    </section>
  );
}

export function KeywordGuide({ text }: { text?: string }) {
  const entries = keywordsIn(text);
  return entries.length ? (
    <section className="keyword-guide" aria-label="Card keyword explanations">
      <span className="small-label">KEYWORDS · SELECT TO EXPLAIN</span>
      <div>
        {entries.map((entry) => (
          <details key={entry.term} className="keyword-chip">
            <summary>{entry.term}</summary>
            <p>{entry.text}</p>
          </details>
        ))}
      </div>
    </section>
  ) : null;
}
