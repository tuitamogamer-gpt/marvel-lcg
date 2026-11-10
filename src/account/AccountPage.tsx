import { useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowCounterClockwise,
  ArrowRight,
  ArrowsClockwise,
  Cards,
  CheckCircle,
  ClipboardText,
  Clock,
  Copy,
  MagnifyingGlass,
  ShieldCheck,
  SignOut,
  Trash,
  User,
  Warning,
} from "@phosphor-icons/react";
import {
  ASPECTS,
  HEROES,
  MODULES,
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
  deckSizeFor,
} from "../game/decks.js";
import {
  heroDeckAspects,
  heroSetupCards,
  heroDeckRule,
  heroRequiredCards,
  heroStarterAspects,
  heroAllowsOffAspectEvent,
} from "../game/hero-runtime.js";
import type { Aspect, Card } from "../game/types.js";
import type { AccountController } from "./useAccount.js";
import {
  TYPE_LABELS,
  costBucket,
  deckSummary,
  formatDeckList,
  groupPrintings,
  normalizeName,
  parseDeckList,
  setRowCount,
} from "./deck-list.js";
import type { DeckRow } from "./deck-list.js";
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
  if (heroDeckRule(heroId)?.aspects === "four-equal-singleton")
    return declared?.length === 4
      ? declared
      : heroDeckAspects(heroId, codes, primary);
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
            <Cards size={21} /> Up to 30 saved hero decks
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

const COST_FILTERS = ["0", "1", "2", "3", "4", "5+", "X"] as const;
const searchCache = new WeakMap<Card, string>();
function searchText(c: Card) {
  let text = searchCache.get(c);
  if (text === undefined) {
    text = normalizeName(
      `${c.name} ${c.subname || ""} ${c.traits || ""} ${(c.text || "").replace(/<[^>]*>/g, " ")}`,
    );
    searchCache.set(c, text);
  }
  return text;
}
const costOrder = (c: Card) => {
  const bucket = costBucket(c);
  return bucket === "none" ? 99 : bucket === "X" ? 98 : c.cost!;
};
const cards = (n: number) => `${n} ${n === 1 ? "card" : "cards"}`;

function DeckGlance({ codes }: { codes: string[] }) {
  const summary = deckSummary(codes);
  const tallest = Math.max(1, ...Object.values(summary.curve));
  const resources = [
    ["Energy", summary.resources.energy],
    ["Mental", summary.resources.mental],
    ["Physical", summary.resources.physical],
    ["Wild", summary.resources.wild],
  ] as const;
  return (
    <div className="deck-glance" role="group" aria-label="Deck at a glance">
      <div className="deck-curve">
        <span className="deck-glance-label">Cost curve</span>
        <ol>
          {COST_FILTERS.map((bucket) => (
            <li key={bucket}>
              <b>{summary.curve[bucket]}</b>
              <span
                aria-hidden="true"
                style={{
                  height: `${Math.round((summary.curve[bucket] / tallest) * 56)}px`,
                }}
              />
              <small>
                <span className="sr-only">
                  {summary.curve[bucket] === 1 ? "card" : "cards"} costing{" "}
                </span>
                {bucket}
              </small>
            </li>
          ))}
        </ol>
        <small>
          {summary.averageCost === null
            ? "No cards with a cost yet"
            : `Average cost ${summary.averageCost.toFixed(1)}`}
        </small>
      </div>
      <div className="deck-breakdown">
        <span className="deck-glance-label">Card types</span>
        <dl>
          {summary.types.map((t) => (
            <div key={t.type}>
              <dt>{t.label}</dt>
              <dd>{t.count}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="deck-breakdown">
        <span className="deck-glance-label">Printed resources</span>
        <dl>
          {resources.map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
      </div>
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
  const [fourChosenAspects, setFourChosenAspects] =
    useState<Aspect[]>(initialAspects);
  const [name, setName] = useState(initial?.name || "");
  const [codes, setCodes] = useState(
    initial?.cards || deckCodes(heroId, aspect, initialAspects),
  );
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [costFilter, setCostFilter] = useState("any");
  const [sort, setSort] = useState<"release" | "name" | "cost">("release");
  const [inDeckOnly, setInDeckOnly] = useState(false);
  const [listMode, setListMode] = useState<"closed" | "paste" | "copy">(
    "closed",
  );
  const [listText, setListText] = useState("");
  const [listMessage, setListMessage] = useState("");
  const [undoCodes, setUndoCodes] = useState<string[] | null>(null);
  const dualAspect = heroDeckRule(heroId)?.aspects === "two-equal";
  const fourAspects = heroDeckRule(heroId)?.aspects === "four-equal-singleton";
  const aspects = fourAspects
    ? fourChosenAspects
    : dualAspect
      ? [aspect, secondAspect]
      : [aspect];
  const setup = heroSetupCards(heroId);
  const setupCount = Object.values(setup).reduce((total, n) => total + n, 0);
  const required = heroRequiredCards(heroId);
  const requiredPlayingCount =
    Object.values(required).reduce((total, count) => total + count, 0) -
    setupCount;
  const counts = countsFor(codes);
  const errors = deckErrors(heroId, aspect, codes, aspects);
  const options = deckOptions(heroId, aspect, aspects);
  const crossAspectEvents =
    heroDeckRule(heroId)?.exception === "six-attack-thwart-events";
  const offAspectCount = codes.filter((code) => {
    const c = card(code);
    return (
      c && c.faction_code !== aspect && heroAllowsOffAspectEvent(heroId, c)
    );
  }).length;
  const pools = [
    "hero",
    ...aspects,
    ...ASPECTS.filter(
      (a) =>
        !aspects.includes(a.id) &&
        options.some(
          (c) => c.faction_code === a.id && !Object.hasOwn(required, c.code),
        ),
    ).map((a) => a.id),
    "basic",
  ];
  const needle = normalizeName(query);
  const filtering =
    needle !== "" || typeFilter !== "all" || costFilter !== "any" || inDeckOnly;
  const rowCount = (row: DeckRow) =>
    row.codes.reduce((total, code) => total + (counts[code] || 0), 0);
  const shows = (row: DeckRow) =>
    (!needle || searchText(row.card).includes(needle)) &&
    (typeFilter === "all" || row.card.type_code === typeFilter) &&
    (costFilter === "any" || costBucket(row.card) === costFilter) &&
    (!inDeckOnly || rowCount(row) > 0);
  const sorted = (rows: DeckRow[]) =>
    sort === "release"
      ? rows
      : [...rows].sort(
          (a, b) =>
            (sort === "cost" ? costOrder(a.card) - costOrder(b.card) : 0) ||
            a.card.name.localeCompare(b.card.name),
        );
  const poolRows = pools.map((faction) => {
    const rows =
      faction === "hero"
        ? options
            .filter((c) => Object.hasOwn(required, c.code))
            .map((c) => ({ key: c.code, card: c, codes: [c.code] }))
        : groupPrintings(
            options.filter(
              (c) =>
                !Object.hasOwn(required, c.code) && c.faction_code === faction,
            ),
          );
    return { faction, total: rows.length, rows: sorted(rows.filter(shows)) };
  });
  const totalRows = poolRows.reduce((total, pool) => total + pool.total, 0);
  const shownRows = poolRows.reduce(
    (total, pool) => total + pool.rows.length,
    0,
  );
  const typesInPool = Object.keys(TYPE_LABELS).filter((type) =>
    options.some((c) => c.type_code === type),
  );
  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setCostFilter("any");
    setInDeckOnly(false);
  }
  const heroLabel = (() => {
    const hero = HEROES.find((h) => h.id === heroId);
    return hero ? `${hero.name} (${hero.identity})` : heroId;
  })();
  const listHeading = `${heroLabel} · ${ASPECTS.filter((a) =>
    aspects.includes(a.id),
  )
    .map((a) => a.name)
    .join(" / ")}`;
  async function copyList() {
    const text = formatDeckList({ name, heading: listHeading, codes });
    try {
      await navigator.clipboard.writeText(text);
      setListMode("closed");
      setUndoCodes(null);
      setListMessage("Deck list copied to the clipboard.");
    } catch {
      setListText(text);
      setListMode("copy");
      setListMessage("");
    }
  }
  function applyList() {
    const parsed = parseDeckList(listText, {
      heroId,
      options,
      fixed: required,
    });
    if (!parsed.codes.length && !parsed.fixed) {
      setListMessage(
        "No cards found. Write one card per line, such as \u201c2x Energy (Core Set)\u201d.",
      );
      return;
    }
    setUndoCodes(codes);
    setCodes([
      ...codes.filter((code) => Object.hasOwn(required, code)),
      ...parsed.codes,
    ]);
    const skipped = [
      ...parsed.unavailable.map((n) => `${n} (not in this deck's pool)`),
      ...parsed.unknown.map((n) => `${n} (unknown card)`),
    ];
    setListMessage(
      [
        `Loaded ${cards(parsed.codes.length)}; hero cards stay as they are.`,
        parsed.limited.length &&
          `Reduced to the copy limit: ${parsed.limited.join(", ")}.`,
        skipped.length && `Skipped ${skipped.join(", ")}.`,
      ]
        .filter(Boolean)
        .join(" "),
    );
    setListText("");
    setListMode("closed");
  }
  const stopEnter = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") e.preventDefault();
  };
  function reset(h: string, a: Aspect, secondary?: Aspect, four?: Aspect[]) {
    const next = editorAspects(
      h,
      a,
      [],
      four ||
        (secondary ? [a, secondary === a ? aspect : secondary] : undefined),
    );
    setHero(h);
    setAspect(a);
    setSecondAspect(next[1] || "aggression");
    setFourChosenAspects(next);
    setCodes(deckCodes(h, a, next));
    setUndoCodes(null);
    setListMessage("");
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
                  {HEROES.some(
                    (other) => other.id !== h.id && other.name === h.name,
                  )
                    ? ` · ${h.identity}`
                    : ""}
                </option>
              ))}
            </select>
          </label>
          {!fourAspects && (
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
          )}
          {fourAspects && (
            <label>
              Aspect to leave out
              <select
                aria-label="Adam Warlock excluded aspect"
                value={
                  ASPECTS.find((a) => !aspects.includes(a.id))?.id || "pool"
                }
                onChange={(e) => {
                  const selected = ASPECTS.filter(
                    (a) => a.id !== e.target.value,
                  ).map((a) => a.id);
                  reset(
                    heroId,
                    selected.includes(aspect) ? aspect : selected[0],
                    undefined,
                    selected,
                  );
                }}
              >
                {ASPECTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {fourAspects && (
            <p className="account-hint">
              Four chosen aspects ·{" "}
              {ASPECTS.filter((a) => aspects.includes(a.id))
                .map(
                  (a) =>
                    `${a.name} ${codes.filter((code) => card(code).faction_code === a.id).length}`,
                )
                .join(" · ")}
            </p>
          )}
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
          Changing hero or aspect loads its starter list. Keep all{" "}
          {requiredPlayingCount} hero cards and choose{" "}
          {40 - requiredPlayingCount}–{50 - requiredPlayingCount} aspect or
          basic cards.
          {dualAspect &&
            " Include equal numbers of your two chosen aspects, counting required hero cards of those colors."}
          {fourAspects &&
            " Choose any four aspects with equal card totals, and only one copy of each other card. Your signature cards stay fixed."}
          {aspects.includes("pool") &&
            " Choosing 'Pool adds Crisis of Infinite Deadpools to the encounter deck."}
          {heroId === "cable" &&
            " Cable may include player side schemes from every aspect. Off-aspect cards do not change your chosen aspect."}
          {setupCount > 0 &&
            (heroId === "vision"
              ? " Your mass form is one Permanent card and does not count toward the 40–50 card deck. It enters play Intangible after your mulligan."
              : heroId === "shadowcat"
                ? " Your Solid / Phased mass form is one reversible Permanent card and does not count toward the 40–50 card deck. It enters play Solid after your mulligan."
                : ` Your ${setupCount} Permanent energy forms start in play and do not count toward the 40–50 card deck.`)}
        </p>
        {crossAspectEvents && (
          <p className="account-hint">
            Gamora may include up to 6 Attack or Thwart events from other
            aspects. {offAspectCount} / 6 selected.
          </p>
        )}
        <div className="deck-glance-row">
          <DeckGlance codes={codes} />
        </div>
        <div className="deck-list-actions">
          <button type="button" className="text-button" onClick={copyList}>
            <Copy size={18} aria-hidden="true" />
            Copy deck list
          </button>
          <button
            type="button"
            className="text-button"
            aria-expanded={listMode === "paste"}
            onClick={() => {
              setListMode(listMode === "paste" ? "closed" : "paste");
              setListText("");
              setListMessage("");
              setUndoCodes(null);
            }}
          >
            <ClipboardText size={18} aria-hidden="true" />
            Paste a deck list
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setUndoCodes(codes);
              setCodes(deckCodes(heroId, aspect, aspects));
              setListMessage("Starter list restored.");
            }}
          >
            <ArrowCounterClockwise size={18} aria-hidden="true" />
            Restore starter list
          </button>
        </div>
        {listMode !== "closed" && (
          <div className="deck-list-panel">
            <label>
              {listMode === "paste" ? "Deck list to load" : "Your deck list"}
              <textarea
                value={listText}
                readOnly={listMode === "copy"}
                rows={8}
                spellCheck={false}
                placeholder={"3x Energy (Core Set)\n2x For Justice! (Core Set)"}
                onFocus={(e) => listMode === "copy" && e.target.select()}
                onChange={(e) => setListText(e.target.value)}
              />
            </label>
            <p className="account-hint">
              {listMode === "paste"
                ? "Choose the hero and aspects first. Write one card per line, such as \u201c2x Energy (Core Set)\u201d. Hero cards stay fixed; the list replaces your other cards."
                : "The clipboard is not available here. Select the list and copy it."}
            </p>
            <div className="deck-list-buttons">
              {listMode === "paste" && (
                <button
                  type="button"
                  className="secondary-button"
                  disabled={!listText.trim()}
                  onClick={applyList}
                >
                  Load this list
                </button>
              )}
              <button
                type="button"
                className="text-button"
                onClick={() => setListMode("closed")}
              >
                {listMode === "paste" ? "Cancel" : "Close"}
              </button>
            </div>
          </div>
        )}
        {listMessage && (
          <p className="deck-list-message" aria-live="polite">
            {listMessage}
            {undoCodes && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setCodes(undoCodes);
                  setUndoCodes(null);
                  setListMessage("Your previous cards are back.");
                }}
              >
                Undo
              </button>
            )}
          </p>
        )}
        <div className="deck-tools" role="search" aria-label="Find cards">
          <label className="deck-search">
            Search
            <span>
              <MagnifyingGlass size={18} aria-hidden="true" />
              <input
                type="search"
                value={query}
                placeholder="Name, trait or text"
                onKeyDown={stopEnter}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>
          <label>
            Type
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
            >
              <option value="all">All types</option>
              {typesInPool.map((type) => (
                <option key={type} value={type}>
                  {TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Cost
            <select
              value={costFilter}
              onChange={(e) => setCostFilter(e.target.value)}
            >
              <option value="any">Any cost</option>
              {COST_FILTERS.map((bucket) => (
                <option key={bucket} value={bucket}>
                  {bucket}
                </option>
              ))}
              <option value="none">No cost</option>
            </select>
          </label>
          <label>
            Sort
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
            >
              <option value="release">Release order</option>
              <option value="name">Name</option>
              <option value="cost">Cost</option>
            </select>
          </label>
          <label className="deck-check">
            <input
              type="checkbox"
              checked={inDeckOnly}
              onKeyDown={stopEnter}
              onChange={(e) => setInDeckOnly(e.target.checked)}
            />
            In deck only
          </label>
          <p className="deck-tools-count" aria-live="polite">
            {filtering
              ? `Showing ${shownRows} of ${cards(totalRows)}`
              : cards(totalRows)}
          </p>
          {filtering && (
            <button
              type="button"
              className="text-button"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          )}
        </div>
        {filtering && shownRows === 0 && (
          <p className="deck-empty">
            No cards match these filters.{" "}
            <button
              type="button"
              className="text-button"
              onClick={clearFilters}
            >
              Show all cards
            </button>
          </p>
        )}
        <div className="account-deck-columns">
          {poolRows
            .filter((pool) => !filtering || pool.rows.length > 0)
            .map(({ faction, rows }) => (
              <section key={faction}>
                <h3>{faction.toUpperCase()}</h3>
                {rows.map((row) => {
                  const c = row.card;
                  const count = rowCount(row);
                  const label = c.subname ? `${c.name} (${c.subname})` : c.name;
                  return (
                    <div className="account-card-row" key={row.key}>
                      <span data-card-preview={c.code} tabIndex={0}>
                        {c.name}
                        <small>
                          {[
                            c.subname,
                            TYPE_LABELS[c.type_code] || c.type_code,
                            c.cost !== undefined &&
                              `cost ${c.cost < 0 ? "X" : c.cost}`,
                            Object.hasOwn(setup, c.code) && "starts in play",
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </small>
                      </span>
                      {Object.hasOwn(required, c.code) ? (
                        <strong className="account-fixed-count">
                          ×{count}
                        </strong>
                      ) : (
                        <label>
                          <span className="sr-only">Copies of {label}</span>
                          <select
                            aria-label={`Copies of ${label}`}
                            value={count}
                            onChange={(e) => {
                              setCodes(
                                setRowCount(codes, row, Number(e.target.value)),
                              );
                              setUndoCodes(null);
                            }}
                          >
                            {Array.from(
                              {
                                length:
                                  Math.max(copyLimit(c, heroId), count) + 1,
                              },
                              (_, n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ),
                            )}
                          </select>
                        </label>
                      )}
                    </div>
                  );
                })}
              </section>
            ))}
        </div>
        <div className="account-editor-footer">
          <div>
            <strong>{deckSizeFor(codes)} / 50 cards</strong>
            {setupCount > 0 && (
              <small>
                {" "}
                · {setupCount} Permanent setup{" "}
                {setupCount === 1 ? "card" : "cards"}
              </small>
            )}
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
                          {deckSizeFor(deck.cards)} cards · Updated{" "}
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
                    <p>
                      {(m.modules || [m.module])
                        .map(
                          (id) =>
                            MODULES.find((set) => set.id === id)?.name || id,
                        )
                        .join(" + ")}
                      {m.villainId === "sabretooth" &&
                      m.senatorDamage !== undefined
                        ? ` · Kelly starts with ${m.senatorDamage} damage`
                        : ""}
                      {m.villainId === "project_wideawake" &&
                      m.captureAllocation
                        ? ` · ${m.captureAllocation.reduce((sum, n) => sum + n, 0)} starting captures`
                        : ""}
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
