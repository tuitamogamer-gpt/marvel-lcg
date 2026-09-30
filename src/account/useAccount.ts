import { useCallback, useEffect, useRef, useState } from "react";
import type { AccountSession } from "./types";
import type { GameState } from "../game/types";

export class AccountError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export function useAccount() {
  const [session, setSession] = useState<AccountSession | null>(null);
  const [loadError, setLoadError] = useState("");
  const current = useRef(session);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const channel = useRef<BroadcastChannel | null>(null);
  const request = useCallback(
    (action?: string, data: Record<string, unknown> = {}) => {
      const accountId = current.current?.user?.id;
      const run = async () => {
        const response = await fetch("/api/account", {
          method: action ? "POST" : "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: action
            ? { "Content-Type": "application/json", "X-Champions-Client": "1" }
            : {},
          ...(action
            ? { body: JSON.stringify({ ...data, action, accountId }) }
            : {}),
          signal: AbortSignal.timeout(20_000),
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || !payload || !("storage" in payload)) {
          if (
            response.status === 401 &&
            !["login", "recover"].includes(action || "")
          ) {
            current.current = {
              user: null,
              library: { decks: [], missions: [] },
              storage: current.current?.storage || "unavailable",
            };
            setSession(current.current);
          }
          throw new AccountError(
            payload?.error ||
              "Could not connect to your account. Please try again.",
            response.status,
          );
        }
        // Keep the one-time code in memory until the player acknowledges it.
        // Refreshes and autosaves must not erase their only recovery method.
        const previousSession = current.current;
        if (
          payload.user &&
          payload.user.id === previousSession?.user?.id &&
          !payload.recoveryCode &&
          previousSession?.recoveryCode
        )
          payload.recoveryCode = previousSession.recoveryCode;
        current.current = payload;
        setSession(payload);
        setLoadError("");
        if (
          action &&
          ["register", "login", "logout", "recover"].includes(action)
        )
          channel.current?.postMessage("session-changed");
        return payload as AccountSession;
      };
      const result = chain.current.then(run);
      chain.current = result.catch(() => {});
      return result;
    },
    [],
  );
  const refresh = useCallback(
    () =>
      request().catch((error) => {
        setLoadError(error.message);
      }),
    [request],
  );
  const dismissRecoveryCode = useCallback(() => {
    if (!current.current?.recoveryCode) return;
    const { recoveryCode: _, ...next } = current.current;
    current.current = next;
    setSession(next);
  }, []);
  useEffect(() => {
    void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    if (typeof BroadcastChannel !== "undefined") {
      channel.current = new BroadcastChannel("champions-account");
      channel.current.onmessage = () => void refresh();
    }
    return () => {
      window.removeEventListener("online", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
      channel.current?.close();
      channel.current = null;
    };
  }, [refresh]);
  return { session, current, request, refresh, loadError, dismissRecoveryCode };
}
export type AccountController = ReturnType<typeof useAccount>;

export function useMissionSync(
  account: AccountController,
  game: GameState | null,
  owner: string | null,
) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [error, setError] = useState("");
  const latest = useRef({ game, owner });
  latest.current = { game, owner };
  const saved = useRef<GameState | null>(null);
  const revision = useRef(new Map<string, number>());
  const inFlight = useRef<Promise<void> | null>(null);
  const blocked = useRef(false);
  const mounted = useRef(true);
  const ownerId = account.session?.user?.id;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const flush = useCallback(async () => {
    while (inFlight.current) await inFlight.current;
    if (blocked.current) return;
    const task = async () => {
      while (mounted.current) {
        const { game: snapshot, owner: snapshotOwner } = latest.current;
        const identity = snapshot?.accountMission;
        if (
          !snapshot ||
          !identity ||
          !snapshotOwner ||
          account.current.current?.user?.id !== snapshotOwner ||
          saved.current === snapshot
        )
          return;
        const existing = account.current.current.library.missions.find(
          (m) => m.id === identity.id,
        );
        // Finished missions are recorded once, even when presentation-only checkpoints change.
        if (existing && existing.outcome !== "active") {
          if (snapshot.phase !== "won" && snapshot.phase !== "lost") {
            blocked.current = true;
            setError(
              "This mission was completed in another tab or device. Open your profile to view its result.",
            );
            setStatus("error");
          } else {
            saved.current = snapshot;
            setStatus("saved");
          }
          return;
        }
        setStatus("saving");
        setError("");
        try {
          const result = await account.request("mission.save", {
            ...identity,
            revision:
              revision.current.get(identity.id) ?? existing?.revision ?? 0,
            state: snapshot,
          });
          const record = result.library.missions.find(
            (m) => m.id === identity.id,
          );
          if (record) revision.current.set(identity.id, record.revision);
          saved.current = snapshot;
          if (latest.current.owner !== snapshotOwner) return;
          setStatus("saved");
        } catch (e) {
          blocked.current = true;
          setError(
            e instanceof Error
              ? e.message
              : "Could not save your mission. Please retry.",
          );
          setStatus("error");
          return;
        }
      }
    };
    const work = task();
    inFlight.current = work;
    await work;
    if (inFlight.current === work) inFlight.current = null;
  }, [account.current, account.request]);
  useEffect(() => {
    if (owner !== ownerId || !owner) return;
    const timer = setTimeout(() => void flush(), 600);
    return () => clearTimeout(timer);
  }, [game, owner, ownerId, flush]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current.owner && latest.current.game !== saved.current) {
        event.preventDefault();
      }
    };
    const hidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [flush]);
  const adopt = useCallback((record: { id: string; revision: number }) => {
    revision.current.set(record.id, record.revision);
    blocked.current = false;
    setError("");
    setStatus("saved");
  }, []);
  const reset = useCallback(() => {
    blocked.current = false;
    saved.current = null;
    setStatus("idle");
    setError("");
  }, []);
  const retry = useCallback(() => {
    blocked.current = false;
    void flush();
  }, [flush]);
  return {
    status,
    error,
    flush,
    adopt,
    reset,
    retry,
    hasUnsaved: () =>
      !!latest.current.owner && latest.current.game !== saved.current,
  };
}
