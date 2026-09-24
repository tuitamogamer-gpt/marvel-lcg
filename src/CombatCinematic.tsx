import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { imageFor } from "./game/cards";
import type { CombatEvent } from "./game/types";

export function CombatCinematic({
  events,
  onComplete,
}: {
  events: CombatEvent[];
  onComplete: () => void;
}) {
  const [index, setIndex] = useState(0);
  const event = events[index];
  useEffect(() => {
    if (!event) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = setTimeout(
      () => {
        if (index + 1 < events.length) setIndex(index + 1);
        else onComplete();
      },
      reduced ? 800 : 1500,
    );
    return () => clearTimeout(timer);
  }, [event, events.length, index, onComplete]);
  if (!event) return null;
  return createPortal(
    <div
      key={index}
      className={`combat-cinematic ${event.enemy ? "enemy-strike" : "hero-strike"} ${event.blocked ? "blocked-strike" : "landed-strike"}`}
      aria-hidden="true"
    >
      <div className="combat-vignette" />
      <div className="combat-strip">
        <div className="combat-speed-lines" />
        <span className="combat-kicker">
          {event.enemy ? "ENEMY ATTACK" : "HERO ATTACK"}
        </span>
        <div className="combat-portrait combat-attacker">
          <img src={imageFor(event.attacker.code)} alt="" />
          <b>{event.attacker.name}</b>
        </div>
        <div className="combat-impact">
          <span className="combat-burst" />
          <strong>
            {event.blocked ? "CLANG!" : event.enemy ? "KRAKOOM!" : "WHAM!"}
          </strong>
          <span className="combat-result">
            {event.blocked ? "NO HEALTH LOST" : "ATTACK RESOLVED"}
          </span>
        </div>
        <div className="combat-portrait combat-target">
          <img src={imageFor(event.target.code)} alt="" />
          <b>{event.target.name}</b>
        </div>
        <div className="combat-ink-splinters">
          {Array.from({ length: 8 }, (_, i) => (
            <i key={i} style={{ rotate: `${i * 45}deg` }} />
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
