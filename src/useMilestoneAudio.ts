import { useCallback, useEffect, useRef, useState } from "react";
import type { Milestone } from "./milestones";
import {
  MilestoneAudioController,
  readSoundPreferences,
  saveSoundPreferences,
  soundVolume,
  type SoundPreferences,
} from "./milestone-audio";

export function useMilestoneAudio() {
  const [preferences, setPreferences] = useState(readSoundPreferences);
  const preferencesRef = useRef(preferences);
  const controllerRef = useRef<MilestoneAudioController | null>(null);

  useEffect(() => {
    const controller = new MilestoneAudioController(preferencesRef.current);
    controllerRef.current = controller;
    const gesture = () => controller.unlock();
    const visibility = () => controller.setVisible(!document.hidden);
    visibility();
    window.addEventListener("pointerdown", gesture, true);
    window.addEventListener("keydown", gesture, true);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("pointerdown", gesture, true);
      window.removeEventListener("keydown", gesture, true);
      document.removeEventListener("visibilitychange", visibility);
      controller.dispose();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, []);

  const update = useCallback((next: SoundPreferences) => {
    preferencesRef.current = next;
    setPreferences(next);
    saveSoundPreferences(next);
    controllerRef.current?.setPreferences(next);
  }, []);
  const setEnabled = useCallback(
    (enabled: boolean) => {
      update({ ...preferencesRef.current, enabled });
      if (enabled) controllerRef.current?.unlock();
    },
    [update],
  );
  const setVolume = useCallback(
    (volume: number) => {
      update({ ...preferencesRef.current, volume: soundVolume(volume) });
      controllerRef.current?.unlock();
    },
    [update],
  );
  const play = useCallback((event: Milestone, id: number) => {
    controllerRef.current?.play(event, id);
  }, []);
  const stop = useCallback(() => controllerRef.current?.stop(), []);
  const resetSession = useCallback(
    () => controllerRef.current?.resetSession(),
    [],
  );

  return {
    enabled: preferences.enabled,
    volume: preferences.volume,
    setEnabled,
    setVolume,
    play,
    stop,
    resetSession,
  };
}
