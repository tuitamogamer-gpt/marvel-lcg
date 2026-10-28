import { useState } from "react";
import { HEROES, VILLAINS, scenarioModules } from "./game/cards";
import {
  CAMPAIGNS_KEY,
  CAMPAIGN_LIMIT,
  campaignStage,
  defaultCampaignStage,
} from "./campaigns";
import type { Campaign, CampaignStage } from "./campaigns";
import { readStorage } from "./browser-storage";
import "./campaigns.css";

export function Campaigns({
  campaigns,
  teamLabel,
  difficulty,
  warning,
  onCreate,
  onOpen,
  onDelete,
  onNotes,
  onBack,
}: {
  campaigns: Campaign[];
  teamLabel: string;
  difficulty: string;
  warning: string;
  onCreate: (name: string, stages: CampaignStage[]) => boolean;
  onOpen: (id: string) => Promise<void>;
  onDelete: (id: string) => void;
  onNotes: (id: string, notes: string) => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [stages, setStages] = useState<CampaignStage[]>(
    ["rhino", "klaw", "ultron"].map(defaultCampaignStage),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const update = (index: number, stage: CampaignStage) =>
    setStages((list) => list.map((s, i) => (i === index ? stage : s)));
  return (
    <main id="main-content" className="page-width campaigns-page">
      <header className="campaign-heading">
        <div>
          <span className="small-label">YOUR NEXT CHAPTER</span>
          <h1>Campaigns</h1>
        </div>
        <button className="secondary-button" onClick={onBack}>
          Choose team & decks
        </button>
      </header>
      <p>
        Build a sequence of standalone missions with the same heroes and decks.
        Win to advance, retry after a defeat, and resume your table at any time.
      </p>
      <p className="campaign-help">
        Saved on this device, including when signed in. Heroes start each
        mission fresh. Official campaign rewards, obligations and carry-over
        rules are not applied.
      </p>
      {warning && (
        <p role="alert" className="campaign-error">
          {warning}
        </p>
      )}
      <div className="campaign-layout">
        <section
          className="campaign-panel"
          aria-labelledby="new-campaign-title"
        >
          <h2 id="new-campaign-title">New campaign</h2>
          <p>
            <strong>{teamLabel}</strong>
            <br />
            {difficulty} · Uses the decks selected in Play.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError("");
              try {
                if (onCreate(name, stages)) setName("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to create campaign.",
                );
              }
            }}
          >
            <label className="campaign-field">
              Campaign name
              <input
                required
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Our next adventure"
              />
            </label>
            <label className="campaign-field">
              Mission preset
              <select
                aria-label="Mission preset"
                defaultValue="core"
                onChange={(e) => {
                  const presets: Record<string, string[]> = {
                    core: ["rhino", "klaw", "ultron"],
                    mutant: [
                      "sabretooth",
                      "project_wideawake",
                      "master_mold",
                      "mansion_attack",
                      "magneto",
                    ],
                    hydra: ["crossbones", "absorbing_man"],
                  };
                  if (presets[e.target.value])
                    setStages(
                      presets[e.target.value].map(defaultCampaignStage),
                    );
                }}
              >
                <option value="core">Core Set missions</option>
                <option value="mutant">
                  Mutant Genesis standalone missions
                </option>
                <option value="hydra">
                  Rise of Red Skull · imported missions
                </option>
              </select>
            </label>
            <ol className="campaign-stage-editor">
              {stages.map((stage, i) => (
                <li key={i}>
                  <label className="campaign-field">
                    Mission {i + 1}
                    <select
                      aria-label={`Mission ${i + 1} scenario`}
                      value={stage.villainId}
                      onChange={(e) =>
                        update(i, defaultCampaignStage(e.target.value))
                      }
                    >
                      {VILLAINS.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {stage.modules.map((id, slot) => (
                    <label key={slot} className="campaign-field">
                      Modular set {stage.modules.length > 1 ? slot + 1 : ""}
                      <select
                        aria-label={`Mission ${i + 1} modular set ${slot + 1}`}
                        value={id}
                        onChange={(e) => {
                          const modules = [...stage.modules];
                          const other = modules.indexOf(e.target.value);
                          if (other >= 0) modules[other] = modules[slot];
                          modules[slot] = e.target.value;
                          update(i, { ...stage, modules });
                        }}
                      >
                        {scenarioModules(stage.villainId).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <div className="campaign-row-actions">
                    <button
                      type="button"
                      disabled={i === 0}
                      aria-label={`Move mission ${i + 1} up`}
                      onClick={() =>
                        setStages((list) => {
                          const next = [...list];
                          [next[i - 1], next[i]] = [next[i], next[i - 1]];
                          return next;
                        })
                      }
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={stages.length === 1}
                      aria-label={`Remove mission ${i + 1}`}
                      onClick={() =>
                        setStages((list) =>
                          list.filter((_, index) => index !== i),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            <div className="campaign-row-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={stages.length >= 12}
                onClick={() =>
                  setStages((list) => [...list, defaultCampaignStage("rhino")])
                }
              >
                Add mission
              </button>
              <button
                className="primary-button"
                disabled={!!warning || campaigns.length >= CAMPAIGN_LIMIT}
              >
                Create campaign
              </button>
            </div>
            {campaigns.length >= CAMPAIGN_LIMIT && (
              <p>
                Ten campaigns are saved. Export your journal and remove a
                campaign to make room.
              </p>
            )}
            {error && (
              <p className="campaign-error" role="alert">
                {error}
              </p>
            )}
          </form>
        </section>
        <section
          className="campaign-library"
          aria-labelledby="campaign-library-title"
        >
          <div className="campaign-heading">
            <h2 id="campaign-library-title">Your campaigns</h2>
            <button
              className="secondary-button"
              onClick={() => {
                const content = warning
                  ? readStorage(CAMPAIGNS_KEY) || "[]"
                  : JSON.stringify(campaigns, null, 2);
                const url = URL.createObjectURL(
                  new Blob([content], { type: "application/json" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "marvel-campaigns.json";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Export saves
            </button>
          </div>
          {!campaigns.length && (
            <div className="campaign-panel">
              <h3>A story starts with a team.</h3>
              <p>
                Choose your heroes in Play, then create your first campaign
                here.
              </p>
            </div>
          )}
          {campaigns.map((c) => {
            const stage = campaignStage(c);
            const complete = stage === c.stages.length;
            const active = c.game && !["won", "lost"].includes(c.game.phase);
            return (
              <article key={c.id} className="campaign-panel">
                <span className="small-label">
                  {complete
                    ? "CAMPAIGN COMPLETE"
                    : active
                      ? "MISSION IN PROGRESS"
                      : "READY FOR A MISSION"}
                </span>
                <h3>{c.name}</h3>
                <p>
                  {c.heroes
                    .map((s) => HEROES.find((h) => h.id === s.heroId)?.name)
                    .join(" · ")}
                  <br />
                  {c.difficulty}
                  {c.heroic ? ` · Heroic ${c.heroic}` : ""}
                </p>
                <label className="campaign-progress">
                  {stage} of {c.stages.length} missions won
                  <progress max={c.stages.length} value={stage} />
                </label>
                <ol className="campaign-route">
                  {c.stages.map((s, i) => (
                    <li key={i}>
                      <span>{i < stage ? "✓" : i === stage ? "→" : "·"}</span>{" "}
                      {VILLAINS.find((v) => v.id === s.villainId)?.name}
                      <small>
                        {i < stage ? "Won" : i === stage ? "Current" : "Locked"}
                      </small>
                    </li>
                  ))}
                </ol>
                {!!c.attempts.length && (
                  <details>
                    <summary>Journal · {c.attempts.length} attempts</summary>
                    <ul className="campaign-journal">
                      {c.attempts.map((a) => (
                        <li key={a.missionId}>
                          {
                            VILLAINS.find(
                              (v) => v.id === c.stages[a.stage].villainId,
                            )?.name
                          }{" "}
                          · {a.outcome === "won" ? "Victory" : "Defeat"} · round{" "}
                          {a.round}
                          <small>
                            {new Date(a.finishedAt).toLocaleDateString()} · seed{" "}
                            {a.seed}
                          </small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <label className="campaign-field">
                  Campaign notes
                  <textarea
                    maxLength={4000}
                    defaultValue={c.notes}
                    onBlur={(e) => onNotes(c.id, e.target.value)}
                    placeholder="Plans and memories for your next session"
                  />
                </label>
                <div className="campaign-row-actions">
                  {!complete && (
                    <button
                      className="primary-button"
                      disabled={busy || !!warning}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          await onOpen(c.id);
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      {active
                        ? `Resume mission · round ${c.game!.round}`
                        : c.game?.phase === "lost"
                          ? "Retry mission"
                          : stage > 0
                            ? "Start next mission"
                            : "Start campaign"}
                    </button>
                  )}
                  <button
                    className="secondary-button"
                    onClick={() => {
                      if (
                        window.confirm(
                          `Delete “${c.name}” and its saved campaign table?`,
                        )
                      )
                        onDelete(c.id);
                    }}
                  >
                    Delete campaign
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
