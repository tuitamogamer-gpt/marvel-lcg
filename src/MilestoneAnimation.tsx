import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Player, type PlayerRef } from "@remotion/player";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { gsap } from "gsap";
import { milestoneTimeline } from "../motion/milestones/timeline.js";
import type { Milestone } from "./milestones";
import "./milestones.css";

function Ribbon({ event }: { event: Milestone }) {
  return (
    <div className={`milestone-panel milestone-${event.kind}`}>
      <img className="milestone-ink" src="/motion/milestone-ink.png" alt="" />
      <strong className="milestone-title">{event.title}</strong>
      <span className="milestone-detail">{event.detail}</span>
    </div>
  );
}
export function MilestoneComposition({ event }: { event: Milestone }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const root = useRef<HTMLDivElement>(null);
  const timeline = useRef<gsap.core.Timeline | null>(null);
  useLayoutEffect(() => {
    if (!root.current) return;
    timeline.current = milestoneTimeline(gsap, root.current);
    return () => {
      timeline.current?.kill();
      timeline.current = null;
    };
  }, []);
  useLayoutEffect(() => {
    timeline.current?.seek(frame / fps, false);
  }, [frame, fps]);
  return (
    <AbsoluteFill ref={root} style={{ justifyContent: "center", padding: 20 }}>
      <Ribbon event={event} />
    </AbsoluteFill>
  );
}
export default function MilestoneAnimation({
  event,
  onComplete,
}: {
  event: Milestone;
  onComplete: () => void;
}) {
  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const player = useRef<PlayerRef>(null);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (reduced) {
      const timer = setTimeout(onComplete, 1000);
      return () => clearTimeout(timer);
    }
    const current = player.current;
    current?.addEventListener("ended", onComplete);
    const timer = setTimeout(onComplete, 2200);
    return () => {
      clearTimeout(timer);
      current?.removeEventListener("ended", onComplete);
    };
  }, [reduced, onComplete]);
  return createPortal(
    <div
      className="milestone-animation"
      aria-hidden="true"
      data-milestone={event.kind}
    >
      {reduced ? (
        <Ribbon event={event} />
      ) : (
        <Player
          ref={player}
          component={MilestoneComposition}
          inputProps={{ event }}
          durationInFrames={48}
          fps={30}
          compositionWidth={720}
          compositionHeight={240}
          autoPlay
          controls={false}
          loop={false}
          clickToPlay={false}
          doubleClickToFullscreen={false}
          spaceKeyToPlayOrPause={false}
          style={{ width: "100%" }}
        />
      )}
    </div>,
    document.body,
  );
}
