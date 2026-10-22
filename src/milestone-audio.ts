import type { Milestone } from "./milestones";

export const MILESTONE_AUDIO = {
  victory: { src: "/audio/milestones/victory.mp3", priority: 3 },
  defeat: { src: "/audio/milestones/defeat.mp3", priority: 3 },
  stage: { src: "/audio/milestones/stage.mp3", priority: 2 },
  upgrade: { src: "/audio/milestones/upgrade.mp3", priority: 1 },
} as const;

export const SOUND_ENABLED_KEY = "champions.sound";
export const SOUND_VOLUME_KEY = "champions.sound.volume";
export const DEFAULT_SOUND_VOLUME = 0.45;

export interface SoundPreferences {
  enabled: boolean;
  volume: number;
}
export interface SoundPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): SoundPreferenceStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function soundVolume(value: number): number {
  return Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : DEFAULT_SOUND_VOLUME;
}

export function readSoundPreferences(
  storage: SoundPreferenceStorage | null = browserStorage(),
): SoundPreferences {
  let enabled = false;
  let volume = DEFAULT_SOUND_VOLUME;
  try {
    enabled = storage?.getItem(SOUND_ENABLED_KEY) === "on";
    const saved = storage?.getItem(SOUND_VOLUME_KEY);
    if (saved?.trim()) volume = soundVolume(Number(saved));
  } catch {
    // Storage restrictions do not stop the current session from using audio.
  }
  return { enabled, volume };
}

export function saveSoundPreferences(
  preferences: SoundPreferences,
  storage: SoundPreferenceStorage | null = browserStorage(),
): void {
  try {
    storage?.setItem(SOUND_ENABLED_KEY, preferences.enabled ? "on" : "off");
    storage?.setItem(SOUND_VOLUME_KEY, String(soundVolume(preferences.volume)));
  } catch {
    // A blocked/full store only loses preferences on the next visit.
  }
}

export interface SoundPlayback {
  stop(): void;
  setVolume(volume: number): void;
}
export interface PreparedSound {
  start(volume: number, onEnded: () => void): SoundPlayback;
}
export interface MilestoneAudioBackend {
  unlock(): Promise<boolean>;
  prepare(src: string): Promise<PreparedSound>;
  dispose(): void;
}

/** One context, decoded local assets, and a single audible source at a time. */
export function createBrowserAudioBackend(): MilestoneAudioBackend | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass) return null;
  const context = new AudioContextClass();
  const requests = new AbortController();
  let disposed = false;
  return {
    async unlock() {
      if (disposed || context.state === "closed") return false;
      if (context.state !== "running") await context.resume();
      return context.state === "running";
    },
    async prepare(src) {
      const response = await fetch(src, { signal: requests.signal });
      if (!response.ok) throw new Error("Milestone audio is unavailable");
      const buffer = await context.decodeAudioData(
        await response.arrayBuffer(),
      );
      return {
        start(volume, onEnded) {
          // Do not schedule a stale clip in a suspended background context.
          if (disposed || context.state !== "running")
            throw new Error("Milestone audio is suspended");
          const source = context.createBufferSource();
          const gain = context.createGain();
          source.buffer = buffer;
          gain.gain.value = soundVolume(volume);
          source.connect(gain);
          gain.connect(context.destination);
          let stopped = false;
          const release = () => {
            source.disconnect();
            gain.disconnect();
          };
          source.onended = () => {
            if (stopped) return;
            stopped = true;
            release();
            onEnded();
          };
          source.start();
          return {
            stop() {
              if (stopped) return;
              stopped = true;
              source.onended = null;
              source.stop();
              release();
            },
            setVolume(next) {
              if (!stopped)
                gain.gain.setTargetAtTime(
                  soundVolume(next),
                  context.currentTime,
                  0.015,
                );
            },
          };
        },
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      requests.abort();
      void context.close().catch(() => {});
    },
  };
}

/**
 * Receives fresh command events, never restored game snapshots. IDs increase
 * within a mission; ignored/muted events are consumed as well as audible ones.
 */
export class MilestoneAudioController {
  private preferences: SoundPreferences;
  private backend: MilestoneAudioBackend | null = null;
  private unlocking: Promise<boolean> | null = null;
  private prepared = new Map<string, Promise<PreparedSound>>();
  private lastEventId = -1;
  private generation = 0;
  private current: { generation: number; priority: number } | null = null;
  private playback: SoundPlayback | null = null;
  private visible = true;
  private disposed = false;

  constructor(
    preferences: SoundPreferences,
    private readonly createBackend = createBrowserAudioBackend,
  ) {
    this.preferences = {
      enabled: preferences.enabled,
      volume: soundVolume(preferences.volume),
    };
  }

  setPreferences(preferences: SoundPreferences): void {
    this.preferences = {
      enabled: preferences.enabled,
      volume: soundVolume(preferences.volume),
    };
    if (!this.preferences.enabled || this.preferences.volume === 0) this.stop();
    else this.playback?.setVolume(this.preferences.volume);
  }

  /** Call synchronously from a pointer/keyboard gesture or the sound control. */
  unlock(): void {
    if (
      this.disposed ||
      !this.visible ||
      !this.preferences.enabled ||
      this.preferences.volume === 0
    )
      return;
    try {
      this.backend ||= this.createBackend();
      const backend = this.backend;
      if (!backend) return;
      // resume() is invoked here, inside the gesture, before any await.
      this.unlocking = backend.unlock().catch(() => false);
      void this.unlocking.then((ready) => {
        if (!ready || this.disposed || !this.preferences.enabled) return;
        for (const { src } of Object.values(MILESTONE_AUDIO))
          void this.prepare(src).catch(() => {});
      });
    } catch {
      this.unlocking = null;
    }
  }

  play(event: Pick<Milestone, "kind">, id: number): void {
    if (this.disposed || !Number.isFinite(id) || id <= this.lastEventId) return;
    this.lastEventId = id;
    const sound = MILESTONE_AUDIO[event.kind];
    if (
      !this.visible ||
      !this.preferences.enabled ||
      this.preferences.volume === 0 ||
      !this.backend ||
      !this.unlocking ||
      (this.current && sound.priority < this.current.priority)
    )
      return;
    this.stop();
    const generation = this.generation;
    this.current = { generation, priority: sound.priority };
    void this.unlocking
      .then(async (ready) => {
        if (!ready || !this.isCurrent(generation)) return;
        const prepared = await this.prepare(sound.src);
        if (!this.isCurrent(generation)) return;
        this.playback = prepared.start(this.preferences.volume, () => {
          if (!this.isCurrent(generation)) return;
          this.current = null;
          this.playback = null;
        });
      })
      .catch(() => {})
      .finally(() => {
        if (this.current?.generation === generation && !this.playback)
          this.current = null;
      });
  }

  private prepare(src: string): Promise<PreparedSound> {
    let request = this.prepared.get(src);
    if (!request) {
      request = this.backend!.prepare(src).catch((error: unknown) => {
        this.prepared.delete(src);
        throw error;
      });
      this.prepared.set(src, request);
    }
    return request;
  }

  private isCurrent(generation: number): boolean {
    return (
      !this.disposed &&
      this.visible &&
      this.preferences.enabled &&
      this.preferences.volume > 0 &&
      this.current?.generation === generation
    );
  }

  stop(): void {
    this.generation++;
    this.current = null;
    this.playback?.stop();
    this.playback = null;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    if (!visible) this.stop();
  }

  resetSession(): void {
    this.stop();
    this.lastEventId = -1;
  }

  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    this.backend?.dispose();
    this.backend = null;
    this.unlocking = null;
    this.prepared.clear();
  }
}
