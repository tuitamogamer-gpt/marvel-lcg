import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SOUND_VOLUME,
  MilestoneAudioController,
  readSoundPreferences,
  saveSoundPreferences,
  type MilestoneAudioBackend,
  type PreparedSound,
  type SoundPlayback,
  type SoundPreferences,
} from "../src/milestone-audio";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = async () => {
  for (let index = 0; index < 12; index++) await Promise.resolve();
};
const enabled: SoundPreferences = { enabled: true, volume: 0.45 };

function harness(preferences = enabled) {
  const starts: {
    src: string;
    volume: number;
    playback: SoundPlayback;
    finish: () => void;
  }[] = [];
  const active = new Set<SoundPlayback>();
  let maximumOverlap = 0;
  const prepared = (src: string): PreparedSound => ({
    start(volume, onEnded) {
      const playback: SoundPlayback = {
        stop: vi.fn(() => active.delete(playback)),
        setVolume: vi.fn(),
      };
      active.add(playback);
      maximumOverlap = Math.max(maximumOverlap, active.size);
      starts.push({
        src,
        volume,
        playback,
        finish: () => {
          active.delete(playback);
          onEnded();
        },
      });
      return playback;
    },
  });
  const backend = {
    unlock: vi.fn(async () => true),
    prepare: vi.fn(async (src: string) => prepared(src)),
    dispose: vi.fn(),
  } satisfies MilestoneAudioBackend;
  const create = vi.fn(() => backend);
  const controller = new MilestoneAudioController(preferences, create);
  return {
    controller,
    backend,
    create,
    starts,
    active,
    prepared,
    maximumOverlap: () => maximumOverlap,
  };
}

describe("milestone sound preferences", () => {
  it("keeps the existing opt-in, saves volume zero, and tolerates blocked storage", () => {
    const data = new Map<string, string>([["champions.sound", "on"]]);
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
    };
    expect(readSoundPreferences(storage)).toEqual(enabled);
    saveSoundPreferences({ enabled: false, volume: 0 }, storage);
    expect(readSoundPreferences(storage)).toEqual({
      enabled: false,
      volume: 0,
    });
    const blocked = {
      getItem: () => {
        throw new Error("Storage is disabled");
      },
      setItem: () => {
        throw new Error("Storage is disabled");
      },
    };
    expect(readSoundPreferences(blocked)).toEqual({
      enabled: false,
      volume: DEFAULT_SOUND_VOLUME,
    });
    expect(() => saveSoundPreferences(enabled, blocked)).not.toThrow();
    expect(readSoundPreferences(null).enabled).toBe(false);
  });

  it("bounds corrupt persisted volume without enabling sound", () => {
    for (const [saved, expected] of [
      ["20", 1],
      ["-4", 0],
      ["NaN", DEFAULT_SOUND_VOLUME],
      ["Infinity", DEFAULT_SOUND_VOLUME],
      ["", DEFAULT_SOUND_VOLUME],
    ] as const) {
      expect(
        readSoundPreferences({
          getItem: (key) => (key.endsWith(".volume") ? saved : "other"),
          setItem: () => {},
        }),
      ).toEqual({ enabled: false, volume: expected });
    }
  });
});

describe("milestone audio lifecycle", () => {
  it("requires both opt-in and a gesture, and does not replay missed events", async () => {
    const h = harness({ enabled: false, volume: 0.45 });
    h.controller.unlock();
    h.controller.play({ kind: "victory" }, 1);
    expect(h.create).not.toHaveBeenCalled();
    h.controller.setPreferences(enabled);
    h.controller.play({ kind: "upgrade" }, 2);
    expect(h.create).not.toHaveBeenCalled();
    h.controller.unlock();
    await settle();
    expect(h.starts).toHaveLength(0);
    h.controller.play({ kind: "victory" }, 1);
    h.controller.play({ kind: "upgrade" }, 2);
    await settle();
    expect(h.starts).toHaveLength(0);
    h.controller.play({ kind: "stage" }, 3);
    await settle();
    expect(h.starts.map((s) => s.src)).toEqual(["/audio/milestones/stage.mp3"]);
  });

  it("consumes repeated and older event IDs after natural completion or stop", async () => {
    const h = harness();
    h.controller.unlock();
    h.controller.play({ kind: "upgrade" }, 10);
    await settle();
    h.starts[0].finish();
    h.controller.play({ kind: "upgrade" }, 10);
    h.controller.play({ kind: "stage" }, 9);
    h.controller.stop();
    h.controller.play({ kind: "upgrade" }, 10);
    await settle();
    expect(h.starts).toHaveLength(1);
    h.controller.play({ kind: "stage" }, 11);
    await settle();
    expect(h.starts).toHaveLength(2);
  });

  it("loads local clips once after enabling, without playing during preload", async () => {
    const h = harness();
    h.controller.unlock();
    await settle();
    expect(h.backend.prepare).toHaveBeenCalledTimes(4);
    expect(h.starts).toHaveLength(0);
    expect(
      h.backend.prepare.mock.calls.every(([src]) =>
        src.startsWith("/audio/milestones/"),
      ),
    ).toBe(true);
    h.controller.unlock();
    h.controller.play({ kind: "stage" }, 1);
    await settle();
    h.controller.play({ kind: "stage" }, 2);
    await settle();
    expect(h.backend.prepare).toHaveBeenCalledTimes(4);
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("lets an outcome interrupt a stage and drops lower-priority overlapping sounds", async () => {
    const h = harness();
    h.controller.unlock();
    h.controller.play({ kind: "stage" }, 1);
    await settle();
    h.controller.play({ kind: "upgrade" }, 2);
    await settle();
    expect(h.starts).toHaveLength(1);
    h.controller.play({ kind: "victory" }, 3);
    await settle();
    expect(h.starts[0].playback.stop).toHaveBeenCalledOnce();
    h.controller.play({ kind: "stage" }, 4);
    await settle();
    expect(h.starts.map((s) => s.src)).toEqual([
      "/audio/milestones/stage.mp3",
      "/audio/milestones/victory.mp3",
    ]);
    expect(h.maximumOverlap()).toBe(1);
    h.starts[1].finish();
    await settle();
    expect(h.active.size).toBe(0);
    expect(h.starts).toHaveLength(2);
  });

  it("replaces a pending stage with an outcome before audio decoding finishes", async () => {
    const h = harness();
    const stage = deferred<PreparedSound>();
    h.backend.prepare.mockImplementation(async (src) =>
      src.endsWith("stage.mp3") ? stage.promise : h.prepared(src),
    );
    h.controller.unlock();
    h.controller.play({ kind: "stage" }, 1);
    await settle();
    h.controller.play({ kind: "defeat" }, 2);
    await settle();
    stage.resolve(h.prepared("/audio/milestones/stage.mp3"));
    await settle();
    expect(h.starts.map((s) => s.src)).toEqual([
      "/audio/milestones/defeat.mp3",
    ]);
  });

  it("does not play delayed audio after undo, navigation, hiding or disabling", async () => {
    for (const interrupt of [
      (c: MilestoneAudioController) => c.stop(),
      (c: MilestoneAudioController) => c.resetSession(),
      (c: MilestoneAudioController) => c.setVisible(false),
      (c: MilestoneAudioController) =>
        c.setPreferences({ ...enabled, enabled: false }),
      (c: MilestoneAudioController) =>
        c.setPreferences({ ...enabled, volume: 0 }),
      (c: MilestoneAudioController) => c.dispose(),
    ]) {
      const h = harness();
      const pending = deferred<PreparedSound>();
      h.backend.prepare.mockImplementation(() => pending.promise);
      h.controller.unlock();
      h.controller.play({ kind: "victory" }, 1);
      await settle();
      interrupt(h.controller);
      pending.resolve(h.prepared("victory"));
      await settle();
      expect(h.starts).toHaveLength(0);
    }
  });

  it("cancels a gesture-unlock promise when the table is left before it resolves", async () => {
    const h = harness();
    const unlocking = deferred<boolean>();
    h.backend.unlock.mockReturnValue(unlocking.promise);
    h.controller.unlock();
    h.controller.play({ kind: "victory" }, 1);
    h.controller.stop();
    unlocking.resolve(true);
    await settle();
    expect(h.starts).toHaveLength(0);
  });

  it("stops an audible clip when hidden, and never replays it on return", async () => {
    const h = harness();
    h.controller.unlock();
    h.controller.play({ kind: "victory" }, 1);
    await settle();
    h.controller.setVisible(false);
    expect(h.starts[0].playback.stop).toHaveBeenCalledOnce();
    h.controller.play({ kind: "stage" }, 2);
    h.controller.setVisible(true);
    h.controller.unlock();
    h.controller.play({ kind: "stage" }, 2);
    await settle();
    expect(h.starts).toHaveLength(1);
    h.controller.play({ kind: "upgrade" }, 3);
    await settle();
    expect(h.starts).toHaveLength(2);
  });

  it("updates active gain, while zero and mute stop rather than queue audio", async () => {
    const h = harness();
    h.controller.unlock();
    h.controller.play({ kind: "upgrade" }, 1);
    await settle();
    expect(h.starts[0].volume).toBe(0.45);
    h.controller.setPreferences({ ...enabled, volume: 0.2 });
    expect(h.starts[0].playback.setVolume).toHaveBeenCalledWith(0.2);
    h.controller.setPreferences({ ...enabled, volume: 0 });
    expect(h.starts[0].playback.stop).toHaveBeenCalledOnce();
    h.controller.play({ kind: "stage" }, 2);
    h.controller.setPreferences(enabled);
    h.controller.play({ kind: "stage" }, 2);
    await settle();
    expect(h.starts).toHaveLength(1);
    h.controller.play({ kind: "stage" }, 3);
    await settle();
    h.controller.setPreferences({ ...enabled, enabled: false });
    expect(h.starts[1].playback.stop).toHaveBeenCalledOnce();
  });

  it("allows a new mission's event sequence after resetting, without old pending audio", async () => {
    const h = harness();
    h.controller.unlock();
    h.controller.play({ kind: "victory" }, 20);
    await settle();
    h.controller.resetSession();
    expect(h.starts[0].playback.stop).toHaveBeenCalledOnce();
    h.controller.play({ kind: "upgrade" }, 1);
    await settle();
    expect(h.starts.map((s) => s.src)).toEqual([
      "/audio/milestones/victory.mp3",
      "/audio/milestones/upgrade.mp3",
    ]);
  });

  it("recovers on a later gesture after autoplay is rejected without replaying the failure", async () => {
    const h = harness();
    h.backend.unlock.mockRejectedValueOnce(new Error("NotAllowedError"));
    h.controller.unlock();
    h.controller.play({ kind: "stage" }, 1);
    await settle();
    expect(h.starts).toHaveLength(0);
    h.controller.unlock();
    h.controller.play({ kind: "stage" }, 1);
    await settle();
    expect(h.starts).toHaveLength(0);
    h.controller.play({ kind: "stage" }, 2);
    await settle();
    expect(h.starts).toHaveLength(1);
  });

  it("survives an unavailable asset and can play a later event", async () => {
    const h = harness();
    h.backend.prepare.mockRejectedValueOnce(new Error("HTTP 404"));
    h.controller.unlock();
    await settle();
    h.controller.play({ kind: "victory" }, 1);
    await settle();
    expect(h.starts).toHaveLength(1);
    h.controller.play({ kind: "stage" }, 2);
    await settle();
    expect(h.starts).toHaveLength(1);
    h.starts[0].finish();
    h.controller.play({ kind: "stage" }, 3);
    await settle();
    expect(h.starts).toHaveLength(2);
  });

  it("is safe without an audio API and releases its backend once on unmount", async () => {
    const unsupported = new MilestoneAudioController(enabled, () => null);
    unsupported.unlock();
    unsupported.play({ kind: "stage" }, 1);
    unsupported.dispose();
    const h = harness();
    h.controller.unlock();
    h.controller.play({ kind: "victory" }, 1);
    await settle();
    h.controller.dispose();
    h.controller.dispose();
    h.controller.unlock();
    h.controller.play({ kind: "stage" }, 2);
    expect(h.starts[0].playback.stop).toHaveBeenCalledOnce();
    expect(h.backend.dispose).toHaveBeenCalledOnce();
    expect(h.create).toHaveBeenCalledOnce();
    expect(h.starts).toHaveLength(1);
  });
});
