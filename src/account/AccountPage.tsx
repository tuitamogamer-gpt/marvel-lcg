import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  ArrowsClockwise,
  Cards,
  CheckCircle,
  Clock,
  ShieldCheck,
  SignOut,
  Trash,
  User,
  Warning,
} from "@phosphor-icons/react";
import {
  ASPECTS,
  HEROES,
  VILLAINS,
  card,
  deckCodes,
  imageFor,
} from "../game/cards.js";
import {
  copyLimit,
  countsFor,
  deckErrors,
  deckOptions,
} from "../game/decks.js";
import {
  heroDeckAspects,
  heroDeckRule,
  heroRequiredCards,
  heroStarterAspects,
} from "../game/hero-runtime.js";
import type { Aspect } from "../game/types.js";
import type { AccountController } from "./useAccount.js";
import type { DeckDraft, MissionRecord, SavedDeck } from "./types.js";
import "./account.css";

const date = (value: string) =>
  new Date(value).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const heroName = (id: string) => HEROES.find((h) => h.id === id)?.name || id;

function editorAspects(
  heroId: string,
  primary: Aspect,
  codes: string[] = [],
  declared?: Aspect[],
): Aspect[] {
  if (heroDeckRule(heroId)?.aspects !== "two-equal") return [primary];
  const candidates = [
    ...(declared || heroDeckAspects(heroId, codes, primary)),
    ...heroStarterAspects(heroId),
    ...ASPECTS.map((a) => a.id),
  ];
  const secondary = candidates.find(
    (a): a is Aspect =>
      a !== primary && ASPECTS.some((option) => option.id === a),
  )!;
  return [primary, secondary];
}

const savedDeckAspects = (deck: SavedDeck) =>
  editorAspects(deck.heroId, deck.aspect, deck.cards, deck.aspects);

function AuthForm({ account }: { account: AccountController }) {
  const [mode, setMode] = useState<"login" | "register" | "recover">(
    "register",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const data = Object.fromEntries(new FormData(event.currentTarget));
    if (mode !== "login" && data.password !== data.confirmPassword) {
      setError("The passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      await account.request(mode, data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  const unavailable = account.session?.storage === "unavailable";
  return (
    <div className="account-welcome">
      <section className="account-pitch">
        <span className="small-label">YOUR CHAMPIONS DOSSIER</span>
        <ShieldCheck size={54} weight="duotone" />
        <h1>
          EVERY HERO
          <br />
          HAS A STORY.
        </h1>
        <p>
          Build your decks. Pick up unfinished missions. Keep a record of every
          victory and every comeback.
        </p>
        <ul>
          <li>
            <Cards size={21} /> Your own library of Core Set decks
          </li>
          <li>
            <Clock size={21} /> Up to 5 missions ready to resume
          </li>
          <li>
            <ShieldCheck size={21} /> Your last 100 mission results
          </li>
        </ul>
        <span className="account-guest-note">
          Guest play is always available from Play.
        </span>
      </section>
      <section className="account-auth" aria-label="Player account">
        <div className="account-tabs" aria-label="Account access">
          <button
            aria-pressed={mode === "register"}
            onClick={() => {
              setMode("register");
              setError("");
            }}
          >
            Create account
          </button>
          <button
            aria-pressed={mode === "login"}
            onClick={() => {
              setMode("login");
              setError("");
            }}
          >
            Sign in
          </button>
        </div>
        <h2>
          {mode === "register"
            ? "Your secret identity."
            : mode === "recover"
              ? "Back in action."
              : "Welcome back, champion."}
        </h2>
        <p>
          {mode === "register"
            ? "Choose a username and a memorable passphrase. No email required."
            : mode === "recover"
              ? "Use the recovery code you saved when creating your account."
              : "Sign in to open your decks and mission journal."}
        </p>
        {unavailable && (
          <p className="account-notice" role="status">
            Accounts are not available on this server yet. You can still play as
            a guest.
          </p>
        )}
        {account.loadError && (
          <div className="account-error" role="alert">
            {account.loadError}{" "}
            <button
              className="text-button"
              onClick={() => void account.refresh()}
            >
              Retry connection
            </button>
          </div>
        )}
        <form key={mode} onSubmit={submit} className="account-form">
          {mode === "register" && (
            <label>
              Player name
              <input
                name="displayName"
                autoComplete="nickname"
                required
                maxLength={40}
                placeholder="Your name at the table"
              />
            </label>
          )}
          <label>
            Username
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              pattern="[A-Za-z0-9_]{3,24}"
              title="3–24 letters, numbers, or underscores"
              required
              minLength={3}
              maxLength={24}
              placeholder="e.g. friendly_neighbour"
            />
          </label>
          {mode === "recover" && (
            <label>
              Recovery code
              <input
                name="recoveryCode"
                required
                autoComplete="off"
                spellCheck={false}
                maxLength={48}
              />
            </label>
          )}
          <label>
            {mode === "recover" ? "New password" : "Password"}
            <input
              name="password"
              type="password"
              required
              minLength={mode === "login" ? 1 : 15}
              maxLength={128}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              aria-describedby={mode !== "login" ? "password-hint" : undefined}
            />
          </label>
          {mode !== "login" && (
            <>
              <small id="password-hint">
                At least 15 characters. A few memorable words work well.
              </small>
              <label>
                Confirm password
                <input
                  name="confirmPassword"
                  type="password"
                  required
                  minLength={15}
                  maxLength={128}
                  autoComplete="new-password"
                />
              </label>
            </>
          )}
          {error && (
            <p className="account-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="primary-button"
            disabled={busy || unavailable || !account.session}
          >
            {busy
              ? "One moment…"
              : mode === "register"
                ? "CREATE ACCOUNT"
                : mode === "recover"
                  ? "RESET PASSWORD"
                  : "SIGN IN"}
            <ArrowRight size={19} />
          </button>
          {mode === "login" && (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setMode("recover");
                setError("");
              }}
            >
              Forgot your password?
            </button>
          )}
        </form>
      </section>
    </div>
  );
}

export function DeckEditor({
  initial,
  busy,
  error,
  onSave,
  onCancel,
}: {
  initial?: SavedDeck;
  busy: boolean;
  error: string;
  onSave: (deck: DeckDraft) => void;
  onCancel: () => void;
}) {
  const [heroId, setHero] = useState(initial?.heroId || "spider_man");
  const [aspect, setAspect] = useState<Aspect>(initial?.aspect || "justice");
  const initialAspects = editorAspects(
    heroId,
    aspect,
    initial?.cards,
    initial?.aspects,
  );
  const [secondAspect, setSecondAspect] = useState<Aspect>(
    initialAspects[1] || "aggression",
  );
  const [name, setName] = useState(initial?.name || "");
  const [codes, setCodes] = useState(
    initial?.cards || deckCodes(heroId, aspect, initialAspects),
  );
  const dualAspect = heroDeckRule(heroId)?.aspects === "two-equal";
  const aspects = dualAspect ? [aspect, secondAspect] : [aspect];
  const required = heroRequiredCards(heroId);
  const counts = countsFor(codes);
  const errors = deckErrors(heroId, aspect, codes, aspects);
  const options = deckOptions(heroId, aspect, aspects);
  function reset(h: string, a: Aspect, secondary?: Aspect) {
    const next = editorAspects(
      h,
      a,
      [],
      secondary ? [a, secondary === a ? aspect : secondary] : undefined,
    );
    setHero(h);
    setAspect(a);
    setSecondAspect(next[1] || "aggression");
    setCodes(deckCodes(h, a, next));
  }
  return (
    <section className="account-editor" aria-label="Deck builder">
      <div className="account-section-heading">
        <div>
          <span className="small-label">DECK BUILDER</span>
          <h2>{initial ? "Refine your strategy." : "Make it your own."}</h2>
        </div>
        <button className="secondary-button" onClick={onCancel} disabled={busy}>
          Back to decks
        </button>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSave({
            id: initial?.id,
            revision: initial?.revision,
            name,
            heroId,
            aspect,
            aspects,
            cards: codes,
          });
        }}
      >
        <div className="account-editor-settings account-form">
          <label>
            Deck name
            <input
              value={name}
              required
              maxLength={60}
              placeholder="Name your deck"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label>
            Hero
            <select
              aria-label="Hero"
              value={heroId}
              onChange={(e) => reset(e.target.value, aspect)}
            >
              {HEROES.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Aspect
            <select
              aria-label="Aspect"
              value={aspect}
              onChange={(e) =>
                reset(heroId, e.target.value as Aspect, secondAspect)
              }
            >
              {ASPECTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          {dualAspect && (
            <label>
              Second aspect
              <select
                aria-label="Second aspect"
                value={secondAspect}
                onChange={(e) =>
                  reset(heroId, aspect, e.target.value as Aspect)
                }
              >
                {ASPECTS.filter((a) => a.id !== aspect).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <p className="account-hint">
          Changing hero or aspect loads its starter list. Keep all 15 hero cards
          and choose 25–35 aspect or basic cards.
          {dualAspect &&
            " Include equal numbers of your two chosen aspects, counting required hero cards of those colors."}
        </p>
        <div className="account-deck-columns">
          {["hero", ...aspects, "basic"].map((faction) => (
            <section key={faction}>
              <h3>{faction.toUpperCase()}</h3>
              {options
                .filter((c) =>
                  faction === "hero"
                    ? Object.hasOwn(required, c.code)
                    : !Object.hasOwn(required, c.code) &&
                      c.faction_code === faction,
                )
                .map((c) => (
                  <div className="account-card-row" key={c.code}>
                    <span data-card-preview={c.code} tabIndex={0}>
                      {c.name}
                      <small>
                        {c.type_code}{" "}
                        {c.cost !== undefined ? `· cost ${c.cost}` : ""}
                      </small>
                    </span>
                    {Object.hasOwn(required, c.code) ? (
                      <strong className="account-fixed-count">
                        ×{counts[c.code] || 0}
                      </strong>
                    ) : (
                      <label>
                        <span className="sr-only">Copies of {c.name}</span>
                        <select
                          aria-label={`Copies of ${c.name}`}
                          value={counts[c.code] || 0}
                          onChange={(e) =>
                            setCodes([
                              ...codes.filter((code) => code !== c.code),
                              ...Array(Number(e.target.value)).fill(c.code),
                            ])
                          }
                        >
                          {Array.from({ length: copyLimit(c) + 1 }, (_, n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                ))}
            </section>
          ))}
        </div>
        <div className="account-editor-footer">
          <div>
            <strong>{codes.length} / 50 cards</strong>
            <p role="status">
              {errors[0] || "Deck ready. All card and copy limits are valid."}
            </p>
          </div>
          <button
            className="primary-button"
            disabled={busy || errors.length > 0}
          >
            {busy ? "Saving…" : "SAVE DECK"}
            <CheckCircle size={20} />
          </button>
        </div>
        {error && (
          <p className="account-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}

export function AccountPage({
  account,
  onUseDeck,
  onResume,
  onSignOut,
  onMissionDeleted,
  onImportGuest,
}: {
  account: AccountController;
  onUseDeck: (deck: SavedDeck) => void;
  onResume: (mission: MissionRecord) => Promise<void>;
  onSignOut: () => Promise<void>;
  onMissionDeleted: (id: string) => void;
  onImportGuest?: () => Promise<void>;
}) {
  const [tab, setTab] = useState<"decks" | "active" | "history">("decks");
  const [editing, setEditing] = useState<SavedDeck | "new" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);
  const recoveryCode = account.session?.recoveryCode;
  const user = account.session?.user;
  const library = account.session?.library;
  async function run(task: () => Promise<unknown>, success = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
      setNotice(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }
  if (!user || !library)
    return (
      <main id="main-content" className="account-page page-width">
        <AuthForm account={account} />
      </main>
    );
  const wins = library.missions.filter((m) => m.outcome === "won").length;
  const history = library.missions.filter((m) => m.outcome !== "active");
  const active = library.missions.filter((m) => m.outcome === "active");
  return (
    <main id="main-content" className="account-page page-width">
      <header className="account-masthead">
        <div className="account-avatar">
          <User size={34} weight="duotone" />
        </div>
        <div>
          <span className="small-label">PLAYER DOSSIER · @{user.username}</span>
          <h1>{user.displayName}</h1>
          <p>At the table since {date(user.createdAt)}</p>
        </div>
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() => void run(onSignOut)}
        >
          <SignOut size={18} /> Sign out
        </button>
      </header>
      {account.session?.storage === "local" && (
        <p className="account-notice">
          Local development account. Your library is stored on this server; it
          is separate from the live website.
        </p>
      )}
      {recoveryCode && (
        <section
          className="account-recovery"
          aria-label="Save your recovery code"
        >
          <ShieldCheck size={28} />
          <div>
            <h2>Keep your recovery code.</h2>
            <p>
              This is the only way to reset your password. Store it somewhere
              safe. It is shown only once.
            </p>
            <code>{recoveryCode}</code>
            <button
              className="secondary-button"
              onClick={() => {
                const url = URL.createObjectURL(
                  new Blob(
                    [
                      `Marvel Champions account: ${user.username}\nRecovery code: ${recoveryCode}\nKeep this private. It can reset your password.\n`,
                    ],
                    { type: "text/plain" },
                  ),
                );
                const link = document.createElement("a");
                link.href = url;
                link.download = "champions-recovery-code.txt";
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              Download recovery code
            </button>
            <button
              className="text-button"
              onClick={account.dismissRecoveryCode}
            >
              I have saved my code
            </button>
          </div>
        </section>
      )}
      <div className="account-stats" aria-label="Your record">
        <span>
          <b>{library.decks.length}</b> saved decks
        </span>
        <span>
          <b>{active.length}</b> unfinished missions
        </span>
        <span>
          <b>{wins}</b> victories
        </span>
        <span>
          <b>
            {history.length ? Math.round((wins / history.length) * 100) : 0}%
          </b>{" "}
          win rate
        </span>
      </div>
      {onImportGuest && (
        <div className="account-import">
          <div>
            <strong>A guest mission is open on this device.</strong>
            <p>Add it to your account to keep playing here.</p>
          </div>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={() =>
              void run(onImportGuest, "Guest mission added to your account.")
            }
          >
            Save guest mission
          </button>
        </div>
      )}
      <nav className="account-tabs" aria-label="Your library">
        {(
          [
            ["decks", "Saved decks", library.decks.length],
            ["active", "Continue playing", active.length],
            ["history", "Mission history", history.length],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            aria-pressed={tab === id}
            onClick={() => {
              setTab(id);
              setEditing(null);
              setError("");
              setRemoving(null);
            }}
          >
            {label}
            <span>{count}</span>
          </button>
        ))}
        <button
          className="account-refresh"
          disabled={busy}
          onClick={() =>
            void run(() => account.request(), "Library refreshed.")
          }
        >
          <ArrowsClockwise size={18} /> Refresh
        </button>
      </nav>
      {error && (
        <p className="account-error" role="alert">
          <Warning size={20} />
          {error}
        </p>
      )}
      {notice && (
        <p className="account-success" role="status">
          <CheckCircle size={20} />
          {notice}
        </p>
      )}
      {tab === "decks" &&
        (editing ? (
          <DeckEditor
            key={editing === "new" ? "new" : editing.id}
            initial={editing === "new" ? undefined : editing}
            busy={busy}
            error=""
            onCancel={() => setEditing(null)}
            onSave={(draft) =>
              void run(async () => {
                await account.request("deck.save", { ...draft });
                setEditing(null);
              }, "Deck saved to your library.")
            }
          />
        ) : (
          <>
            <div className="account-section-heading">
              <div>
                <h2>Your next great strategy.</h2>
                <p>
                  Build a supported hero deck, then bring it straight to the
                  table.
                </p>
              </div>
              <button
                className="primary-button"
                onClick={() => setEditing("new")}
              >
                BUILD A DECK <Cards size={20} />
              </button>
            </div>
            {!library.decks.length ? (
              <div className="account-empty">
                <Cards size={44} weight="duotone" />
                <h3>Your deck box is ready.</h3>
                <p>
                  Start with a complete starter deck and adjust it to your play
                  style. You can also save a deck from mission setup.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => setEditing("new")}
                >
                  Create your first deck <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <div className="account-deck-grid">
                {library.decks.map((deck) => {
                  const hero = HEROES.find((h) => h.id === deck.heroId)!;
                  return (
                    <article className="account-deck" key={deck.id}>
                      <img src={imageFor(hero.code)} alt={hero.name} />
                      <div>
                        <span className="small-label">
                          {hero.name} · {savedDeckAspects(deck).join(" + ")}
                        </span>
                        <h3>{deck.name}</h3>
                        <p>
                          {deck.cards.length} cards · Updated{" "}
                          {date(deck.updatedAt)}
                        </p>
                        <div className="account-item-actions">
                          <button
                            className="primary-button"
                            onClick={() => onUseDeck(deck)}
                          >
                            USE DECK <ArrowRight size={17} />
                          </button>
                          <button
                            className="secondary-button"
                            onClick={() => {
                              setEditing(deck);
                              setError("");
                            }}
                          >
                            Edit
                          </button>
                          <button
                            className="icon-button"
                            aria-label={`Delete ${deck.name}`}
                            onClick={() => setRemoving(deck.id)}
                          >
                            <Trash size={20} />
                          </button>
                        </div>
                        {removing === deck.id && (
                          <div className="account-delete-confirm">
                            <p>Remove “{deck.name}” from your library?</p>
                            <button
                              disabled={busy}
                              className="secondary-button"
                              onClick={() =>
                                void run(async () => {
                                  await account.request("deck.delete", {
                                    id: deck.id,
                                    revision: deck.revision,
                                  });
                                  setRemoving(null);
                                }, "Deck removed.")
                              }
                            >
                              Delete deck
                            </button>
                            <button
                              className="text-button"
                              onClick={() => setRemoving(null)}
                            >
                              Keep deck
                            </button>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ))}
      {tab !== "decks" && (
        <>
          <div className="account-section-heading">
            <div>
              <h2>
                {tab === "active"
                  ? "Unfinished business."
                  : "The story so far."}
              </h2>
              <p>
                {tab === "active"
                  ? "Resume the exact turn, payment, or decision where you left off."
                  : "Your last 100 completed missions. Results appear automatically when a mission ends."}
              </p>
            </div>
          </div>
          {!(tab === "active" ? active : history).length ? (
            <div className="account-empty">
              <Clock size={44} weight="duotone" />
              <h3>
                {tab === "active"
                  ? "A fresh table awaits."
                  : "Your story starts at the table."}
              </h3>
              <p>
                {tab === "active"
                  ? "Start a mission while signed in. It will save here automatically."
                  : "Complete a mission while signed in to record its result here."}
              </p>
            </div>
          ) : (
            <div className="account-missions">
              {(tab === "active" ? active : history).map((m) => (
                <article className="account-mission" key={m.id}>
                  <div className={`account-outcome ${m.outcome}`}>
                    {m.outcome === "active" ? (
                      <Clock size={25} />
                    ) : (
                      <ShieldCheck size={25} />
                    )}
                    <b>
                      {m.outcome === "won"
                        ? "VICTORY"
                        : m.outcome === "lost"
                          ? "DEFEAT"
                          : "IN PLAY"}
                    </b>
                  </div>
                  <div className="account-mission-copy">
                    <h3>
                      {m.heroes.map((h) => heroName(h.heroId)).join(" + ")}{" "}
                      <span>vs.</span>{" "}
                      {VILLAINS.find((v) => v.id === m.villainId)?.name}
                    </h3>
                    <p>
                      Round {m.round} · {m.difficulty} · {date(m.updatedAt)}
                    </p>
                    {m.result && <p>{m.result}</p>}
                  </div>
                  <div className="account-item-actions">
                    {m.outcome === "active" && (
                      <button
                        className="primary-button"
                        disabled={busy}
                        onClick={() => void run(() => onResume(m))}
                      >
                        RESUME <ArrowRight size={17} />
                      </button>
                    )}
                    <button
                      className="icon-button"
                      aria-label={`Delete mission ${m.id}`}
                      onClick={() => setRemoving(m.id)}
                    >
                      <Trash size={20} />
                    </button>
                  </div>
                  {removing === m.id && (
                    <div className="account-delete-confirm">
                      <p>
                        {m.outcome === "active"
                          ? "Delete this unfinished mission? Its progress cannot be restored."
                          : "Remove this result from your history?"}
                      </p>
                      <button
                        disabled={busy}
                        className="secondary-button"
                        onClick={() =>
                          void run(async () => {
                            await account.request("mission.delete", {
                              id: m.id,
                              revision: m.revision,
                            });
                            onMissionDeleted(m.id);
                            setRemoving(null);
                          }, "Mission removed.")
                        }
                      >
                        Delete mission
                      </button>
                      <button
                        className="text-button"
                        onClick={() => setRemoving(null)}
                      >
                        Keep mission
                      </button>
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
