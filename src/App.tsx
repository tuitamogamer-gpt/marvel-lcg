import { visionCanAttack } from "./game/vision";
import { ironheartProgress, ironheartVersion } from "./game/ironheart";
import { valkyrieCannotBasicAttack } from "./game/valkyrie";
import {
  doctorStrangeAbilityOptions,
  doctorStrangeTopInvocation,
} from "./game/doctor-strange";
import {
  msMarvelAbilityOptions,
  msMarvelDiscardPlayable,
} from "./game/ms-marvel";
import { thorAbilityOptions } from "./game/thor";
import { hawkeyeStoredPlayable } from "./game/hawkeye";
import {
  heroDeckAspects,
  heroDeckRule,
  heroSetupCards,
} from "./game/hero-runtime";
import { deckSizeFor } from "./game/decks";
import { resourcesFor } from "./game/payment";
import {
  SPECTRUM_FORM_CODES,
  spectrumEnergyForm,
  spectrumFormFaceup,
} from "./game/spectrum";
import { riskyBlankPower } from "./game/risky-business";
import { mutagenAttachmentActions } from "./game/mutagen-formula";
import {
  goblinModuleAttachmentActions,
  goblinIdentityLocked,
} from "./game/goblin-modules";
import { useCallback, useEffect, useRef, useState } from "react";
import { CardPreview } from "./CardPreview";
import {
  Collection,
  ContentBrowser,
  DeckProvenance,
  ProductSource,
} from "./ContentBrowser";
import { CATALOG_SUMMARY, productForCard } from "./game/catalog";
import { captainAbilityOptions } from "./game/captain-america";
import { hulkAbilityOptions } from "./game/hulk";
import { AccountPage } from "./account/AccountPage";
import { useAccount, useMissionSync } from "./account/useAccount";
import type { SavedDeck, MissionRecord } from "./account/types";
import { CombatCinematic } from "./CombatCinematic";
import { HeroEmblem } from "./HeroEmblem";
import { KeywordGuide, TutorialCoach } from "./Onboarding";
import { readTutorial, saveTutorial, TUTORIAL_SETUP } from "./tutorial";
import { shortReason } from "./game/glossary";
import { DefenseCrest, DefensePlaque } from "./DefenseCrest";
import "./minion-damage.css";
import { createPortal } from "react-dom";
import type { CSSProperties, ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  ArrowsClockwise,
  ArrowsOut,
  BookOpen,
  Check,
  CheckCircle,
  CaretDown,
  CaretRight as ChevronRight,
  Clock,
  Crosshair,
  Eye,
  HandFist as Fist,
  Heart,
  Lightning,
  ListBullets,
  Play,
  Shield,
  ShieldCheck,
  Skull,
  Sparkle,
  Stack,
  Target,
  Trash,
  User,
  Users,
  Warning,
  X,
  MagnifyingGlass,
  Atom,
  Spiral,
  StarFour,
  ShootingStar,
  Brain,
  Star,
  SpeakerHigh,
  SpeakerSlash,
  CaretRight,
  Cards,
  Info,
  Palette,
  FastForward,
  ClockCounterClockwise,
  ArrowCounterClockwise,
  Copy,
  DiceFive,
  CalendarBlank,
  Lightbulb,
} from "@phosphor-icons/react";
import {
  PLAYMATS,
  TABLE_STYLE_KEY,
  readPlaymat,
  playmatForHero,
} from "./tabletop-assets";
import type { PlaymatPreference } from "./tabletop-assets";
import {
  ASPECTS,
  HEROES,
  MODULES,
  VILLAINS,
  card,
  deckCodes,
  handSize,
  heroCard,
  heroStats,
  imageFor,
  maxHP,
  pieceHP,
  plain,
  resources,
} from "./game/cards";
import {
  SAVE_KEY,
  abilityOptions,
  allyLimit,
  allyCount,
  dispatch,
  newGame,
  paymentSources,
  canPay,
  warMachinePackStoredPlayable,
  visionPackStoredPlayable,
  ghostSpiderStoredPlayable,
  playable,
  cardCost,
  summarize,
  schemeLimit,
  escalation,
  nativeHeroAbilityOptions,
  canChangeIdentityForm,
} from "./game/engine";
import { seatView, upgradeSave } from "./game/team";
import { grootGrowthCounters } from "./game/groot";
import { warMachineAmmo } from "./game/war-machine";
import { effectTitle } from "./game/review";
import { paymentStatus, paymentSubject, suggestPayment } from "./game/payment";
import type { PaymentSource } from "./game/payment";
import { dailySeedText, parseSeed } from "./game/seed";
import { advisePrompt } from "./game/advisor";
import type { Advice } from "./game/advisor";
import { planAction } from "./game/lookahead";
import { attachmentsFor, attackContext } from "./game/presentation";
import type {
  ActionReview,
  CombatEvent,
  Aspect,
  Command,
  GameState,
  Pacing,
  VillainStep,
  Piece,
  Resource,
} from "./game/types";

type Screen = "lobby" | "game" | "collection" | "account";
type Inspect = {
  code: string;
  piece?: Piece;
  hand?: boolean;
  playerId?: string;
};
const resIcon = {
  energy: Lightning,
  mental: Atom,
  physical: Fist,
  wild: StarFour,
};
const aspectStyle = (color: string) => ({ "--accent": color }) as CSSProperties;
const PACING_KEY = "champions.pacing";
const PACINGS: { id: Pacing; name: string; text: string }[] = [
  {
    id: "guided",
    name: "Guided",
    text: "Pause after every resolved step. Best while learning the game.",
  },
  {
    id: "brisk",
    name: "Brisk",
    text: "Pause for decisions, damage to your side, revealed encounters, placed threat and villain stage changes.",
  },
  {
    id: "expert",
    name: "Expert",
    text: "Pause only for decisions and damage to your side. Everything else flows into the recent-steps timeline.",
  },
];
/** One line for a resolved step: the most consequential change, else its first message. */
function timelineSummary(entry: ActionReview) {
  const change =
    entry.changes.find((c) => c.kind === "health" || c.kind === "threat") ||
    entry.changes[0];
  return change
    ? `${change.label}: ${change.before} → ${change.after}`
    : entry.messages[0] || entry.actor;
}
const HISTORY_KEY = "champions.history.v1";
type GuestRecord = {
  id: string;
  date: string;
  heroes: { heroId: string; aspect: Aspect }[];
  villainId: string;
  difficulty: "standard" | "expert";
  heroic: number;
  round: number;
  outcome: "won" | "lost";
  seed: number;
};
function readHistory(): GuestRecord[] {
  try {
    const list = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(list) ? list.filter((r) => r && r.id) : [];
  } catch {
    return [];
  }
}
function writeHistory(list: GuestRecord[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
  } catch {
    // Blocked storage only loses the guest history.
  }
}
function missionSummary(g: GameState) {
  const heroes = g.players
    .map(
      (p) =>
        `${HEROES.find((h) => h.id === p.heroId)!.name} (${ASPECTS.find((a) => a.id === p.aspect)!.name})`,
    )
    .join(", ");
  const villain = VILLAINS.find((v) => v.id === g.villainId)!.name;
  const st = g.stats;
  return [
    `Marvel Champions · ${heroes} vs ${villain} · ${g.difficulty}${g.heroic ? ` · Heroic ${g.heroic}` : ""}`,
    `${g.phase === "won" ? "Victory" : "Defeat"} in ${g.round} round${g.round === 1 ? "" : "s"}`,
    st
      ? `Damage dealt ${st.damageDealt} · taken ${st.damageTaken} · threat removed ${st.threatRemoved} · placed ${st.threatPlaced} · cards played ${st.cardsPlayed} · enemies defeated ${st.enemiesDefeated}`
      : "",
    `Seed ${g.startSeed || "?"} · https://marvel-lcg.vercel.app`,
  ]
    .filter(Boolean)
    .join("\n");
}
function readPacing(): Pacing {
  try {
    const value = localStorage.getItem(PACING_KEY);
    return PACINGS.some((p) => p.id === value) ? (value as Pacing) : "guided";
  } catch {
    return "guided";
  }
}
function TempoMenu({
  value,
  onChange,
}: {
  value: Pacing;
  onChange: (pacing: Pacing) => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const current = PACINGS.find((p) => p.id === value) || PACINGS[0];
  return (
    <details className="tempo-menu" ref={details}>
      <summary
        aria-label={`Tempo: ${current.name}. Change how often the game pauses`}
      >
        <FastForward size={14} weight="fill" />
        TEMPO · {current.name.toUpperCase()}
        <CaretDown size={12} />
      </summary>
      <div className="tempo-options" role="radiogroup" aria-label="Tempo">
        {PACINGS.map((p) => (
          <button
            key={p.id}
            role="radio"
            aria-checked={p.id === value}
            className={p.id === value ? "selected" : ""}
            onClick={() => {
              onChange(p.id);
              if (details.current) details.current.open = false;
            }}
          >
            <b>{p.name}</b>
            <small>{p.text}</small>
          </button>
        ))}
        <p>
          Decisions always pause. Skipped steps stay in the log and timeline.
        </p>
      </div>
    </details>
  );
}
const VILLAIN_STEPS: { id: VillainStep; name: string; icon: typeof Target }[] =
  [
    { id: "threat", name: "Threat", icon: Target },
    { id: "activation", name: "Villain acts", icon: Skull },
    { id: "encounters", name: "Encounters", icon: Cards },
    { id: "newRound", name: "New round", icon: ArrowsClockwise },
  ];
/** The spine of the villain phase: the same four stops in every round. */
function VillainSteps({
  current,
  compact = false,
}: {
  current?: VillainStep;
  compact?: boolean;
}) {
  const at = VILLAIN_STEPS.findIndex((step) => step.id === current);
  return (
    <ol
      className={`villain-steps ${compact ? "compact" : ""} ${current ? "" : "upcoming"}`}
      aria-label="Villain phase progress"
    >
      {VILLAIN_STEPS.map((step, i) => {
        const Icon = step.icon;
        const state = i < at ? "done" : i === at ? "current" : "next";
        return (
          <li
            key={step.id}
            className={state}
            aria-current={state === "current" ? "step" : undefined}
          >
            <span className="villain-step-mark">
              {state === "done" ? (
                <Check size={11} weight="bold" />
              ) : (
                <Icon
                  size={12}
                  weight={state === "current" ? "fill" : "bold"}
                />
              )}
            </span>
            <span className="villain-step-name">{step.name}</span>
          </li>
        );
      })}
    </ol>
  );
}
function ResourceIcons({ items }: { items: Resource[] }) {
  return (
    <span
      className="resources"
      role="img"
      aria-label={
        items.length ? items.join(", ") + " resources" : "No resources"
      }
    >
      {items.map((r, i) => {
        const Icon = resIcon[r];
        return (
          <span key={i} className={`resource ${r}`} title={r}>
            <Icon size={13} weight="fill" />
          </span>
        );
      })}
    </span>
  );
}
function CardImage({
  code,
  className = "",
  onClick,
  lazy = false,
}: {
  code: string;
  className?: string;
  onClick?: () => void;
  lazy?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [loadedCode, setLoadedCode] = useState<string | null>(null);
  useEffect(() => setFailed(false), [code]);
  const landscape = ["main_scheme", "side_scheme"].includes(
    card(code)?.type_code,
  );
  return (
    <div
      className={`card-image ${className}`}
      data-card-preview={code}
      onClick={onClick}
    >
      {!failed ? (
        <>
          <img
            draggable={false}
            loading={lazy ? "lazy" : undefined}
            decoding="async"
            width={landscape ? 419 : 300}
            height={landscape ? 300 : 419}
            src={imageFor(code)}
            alt={card(code)?.name || "Card"}
            onLoad={() => setLoadedCode(code)}
            onError={() => setFailed(true)}
          />
          {loadedCode !== code && (
            <span className="card-loading" aria-hidden="true">
              <Shield size={24} weight="duotone" />
              <span>{card(code)?.name || "Card"}</span>
              <small>Loading artwork…</small>
            </span>
          )}
        </>
      ) : (
        <div className="card-fallback">
          <Shield size={32} />
          <strong>{card(code)?.name}</strong>
          <p>{plain(card(code)?.text)}</p>
        </div>
      )}
    </div>
  );
}
function spectrumEnergyFormInfo(s: GameState, p: Piece) {
  if (!(Object.values(SPECTRUM_FORM_CODES) as string[]).includes(p.code))
    return null;
  const owner =
    s.players.find((seat) => seat.id === p.ownerId) ||
    s.players.find(
      (seat) =>
        seat.heroId === "spectrum" &&
        seatView(s, seat).player.inPlay.some((piece) => piece.id === p.id),
    );
  if (!owner) return { faceup: false, current: "None" };
  const view = seatView(s, owner),
    form = spectrumEnergyForm(view);
  return {
    faceup: spectrumFormFaceup(view, p),
    current: form ? card(SPECTRUM_FORM_CODES[form]).name : "None",
  };
}
/** The physical owner's saved form determines the face in every table view. */
export function PlayerCardImage({
  game,
  piece,
}: {
  game: GameState;
  piece: Piece;
}) {
  return spectrumEnergyFormInfo(game, piece)?.faceup === false ? (
    <CardBack kind="hero" />
  ) : (
    <CardImage code={piece.code} />
  );
}
function Brand({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="brand"
      onClick={onClick}
      aria-label="Marvel Champions home"
    >
      <span className="marvel-logo">MARVEL</span>
      <span className="brand-title">
        CHAMPIONS<small>THE CARD GAME</small>
      </span>
    </button>
  );
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
  className = "",
  eyebrow = "MARVEL CHAMPIONS",
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
  className?: string;
  eyebrow?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const prev = document.activeElement as HTMLElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const target = ref.current?.querySelector<HTMLElement>(
      "button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, a[href]",
    );
    target?.focus();
    const key = (e: KeyboardEvent) => {
      const dialogs = Array.from(
        document.querySelectorAll('[role="dialog"]'),
      ).filter((node) => node.getClientRects().length);
      if (dialogs.at(-1) !== ref.current) return;
      if (e.key === "Escape") closeRef.current?.();
      if (e.key === "Tab") {
        const nodes = Array.from(
          ref.current?.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),summary,a[href],[tabindex="0"]',
          ) || [],
        ).filter(
          (node) =>
            node.getClientRects().length &&
            getComputedStyle(node).visibility !== "hidden",
        );
        if (!nodes?.length) return;
        const first = nodes[0],
          last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("keydown", key);
      document.body.style.overflow = overflow;
      if (prev?.isConnected) prev.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
      >
        <div className="modal-heading">
          <div>
            <span className="modal-eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          {onClose && (
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <X size={21} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
function Difficulty({ level }: { level: number }) {
  return (
    <span className="difficulty">
      {Array.from({ length: 3 }, (_, i) => (
        <i key={i} className={i < level ? "on" : ""} />
      ))}
    </span>
  );
}
function Status({
  piece,
}: {
  piece: {
    tough?: boolean;
    stunned?: boolean;
    confused?: boolean;
    toughCards?: number;
    stunCards?: number;
    confuseCards?: number;
  };
}) {
  const statuses = [
    {
      key: "tough",
      name: "Tough",
      Icon: ShieldCheck,
      hint: "Prevent next damage",
      rule: "Prevents the next instance of damage, then discard this status.",
    },
    {
      key: "stunned",
      name: "Stunned",
      Icon: ShootingStar,
      hint: "Skip next attack",
      rule: "Your next attack removes this status instead of attacking. Pay its costs as usual.",
    },
    {
      key: "confused",
      name: "Confused",
      Icon: Spiral,
      hint: "Skip next THW / SCH",
      rule: "Your next thwart or scheme removes this status instead. Pay its costs as usual.",
    },
  ] as const;
  return (
    <span className="statuses">
      {statuses
        .filter(
          ({ key }) =>
            piece[key] ||
            (key === "stunned"
              ? piece.stunCards
              : key === "confused"
                ? piece.confuseCards
                : piece.toughCards),
        )
        .map(({ key, name, Icon, hint, rule }) => (
          <span
            className={`status-card ${key}`}
            key={key}
            title={rule}
            aria-label={`${name}: ${rule}`}
          >
            <span className="status-emblem">
              <Icon size={23} weight="bold" />
            </span>
            <span className="status-copy">
              <b>
                {name}
                {(
                  key === "stunned"
                    ? piece.stunCards
                    : key === "confused"
                      ? piece.confuseCards
                      : piece.toughCards
                )
                  ? ` ×${key === "stunned" ? piece.stunCards : key === "confused" ? piece.confuseCards : piece.toughCards}`
                  : ""}
              </b>
              <small>{piece[key] ? hint : "Steady · one more required"}</small>
            </span>
          </span>
        ))}
    </span>
  );
}
function readSave(): GameState | null {
  try {
    const a = JSON.parse(localStorage.getItem(SAVE_KEY) || "null");
    if (
      a?.version === 1 &&
      HEROES.some((h) => h.id === a.heroId) &&
      a.player?.hand &&
      a.attachments
    )
      return upgradeSave(a);
    return null;
  } catch {
    return null;
  }
}
const fanCards: Record<string, [string, string]> = {
  spider_man: ["01005", "01009"],
  captain_marvel: ["01013", "01018"],
  iron_man: ["01036", "01032"],
  black_panther: ["01043a", "01047"],
  she_hulk: ["01021", "01028"],
  captain_america: ["03004", "03006"],
  hulk: ["10003", "10005"],
};
export default function App() {
  const account = useAccount();
  const [combat, setCombat] = useState<{
    id: number;
    events: CombatEvent[];
  } | null>(null);
  const combatId = useRef(0);
  const finishCombat = useCallback(() => setCombat(null), []);
  const [screen, setScreen] = useState<Screen>("lobby");
  const [game, setGame] = useState<GameState | null>(readSave);
  const [gameOwner, setGameOwner] = useState<string | null>(null);
  const missionSync = useMissionSync(account, game, gameOwner);
  const [team, setTeam] = useState<
    {
      heroId: string;
      aspect: Aspect;
      deckCards?: string[];
      deckAspects?: Aspect[];
      deckName?: string;
      deckOrigin?: "source";
    }[]
  >([{ heroId: HEROES[0].id, aspect: "justice" }]);
  const [setupSeat, setSetupSeat] = useState(0);
  const hero = HEROES.find((h) => h.id === team[setupSeat].heroId)!;
  const aspect = team[setupSeat].aspect;
  const allFourAspects =
    heroDeckRule(hero.id)?.aspects === "four-equal-singleton";
  const setupDeckCards =
    team[setupSeat].deckCards || deckCodes(hero.id, aspect);
  const setupDeckSize = deckSizeFor(setupDeckCards);
  const setupCardCount = Object.values(heroSetupCards(hero.id)).reduce(
    (total, count) => total + count,
    0,
  );
  const chosenAspects =
    (allFourAspects ? undefined : team[setupSeat].deckAspects) ||
    heroDeckAspects(
      hero.id,
      team[setupSeat].deckCards || deckCodes(hero.id, aspect),
      aspect,
    );
  const setHero = (h: (typeof HEROES)[number]) =>
    setTeam((a) =>
      a.map((p, i) =>
        i === setupSeat ? { heroId: h.id, aspect: h.aspect } : p,
      ),
    );
  const setAspect = (aspect: Aspect, second?: Aspect) =>
    setTeam((a) =>
      a.map((p, i) => {
        if (i !== setupSeat) return p;
        if (p.heroId === "spider_woman") {
          const previous =
            p.deckAspects ||
            (heroDeckAspects(
              p.heroId,
              p.deckCards || deckCodes(p.heroId, p.aspect),
              p.aspect,
            ) as Aspect[]);
          const other =
            second ||
            previous.find((value) => value !== aspect) ||
            (aspect === "aggression" ? "justice" : "aggression");
          const source =
            [aspect, other].includes("aggression") &&
            [aspect, other].includes("justice");
          return {
            heroId: p.heroId,
            aspect,
            deckCards: deckCodes(p.heroId, aspect, [aspect, other]),
            deckAspects: [aspect, other],
            deckName: source
              ? "Spider-Woman Starter Deck"
              : "Two-aspect starter deck",
            ...(source ? { deckOrigin: "source" as const } : {}),
          };
        }
        return (["hawkeye", "ant"].includes(p.heroId) &&
          aspect === "leadership") ||
          (p.heroId === "wsp" && aspect === "aggression") ||
          (p.heroId === "qsv" && aspect === "protection") ||
          (p.heroId === "scw" && aspect === "justice")
          ? {
              heroId: p.heroId,
              aspect,
              deckCards: deckCodes(p.heroId, aspect),
              deckName: `${HEROES.find((h) => h.id === p.heroId)!.name} Starter Deck`,
              deckOrigin: "source" as const,
            }
          : { heroId: p.heroId, aspect };
      }),
    );
  function setTeamSize(size: number) {
    setTeam((prev) => {
      const next = prev.slice(0, size);
      while (next.length < size) {
        const h = HEROES.find((h) => !next.some((p) => p.heroId === h.id))!;
        next.push({ heroId: h.id, aspect: h.aspect });
      }
      return next;
    });
    setSetupSeat((i) => Math.min(i, size - 1));
  }
  const [villain, setVillain] = useState(VILLAINS[0]);
  const [difficulty, setDifficulty] = useState<"standard" | "expert">(
    "standard",
  );
  const [module, setModule] = useState("bomb_scare");
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const inspectedEnergyForm =
    game && inspect?.piece ? spectrumEnergyFormInfo(game, inspect.piece) : null;
  const [help, setHelp] = useState(false);
  const [deckView, setDeckView] = useState(false);
  const [contentView, setContentView] = useState(false);
  const [endTurn, setEndTurn] = useState(false);
  const [restart, setRestart] = useState(false);
  const [tutorialRequested, setTutorialRequested] = useState(false);
  const [tutorialMissionId, setTutorialMissionId] = useState(
    () => readTutorial()?.missionId || null,
  );
  const [toast, setToast] = useState("");
  const [logOpen, setLogOpen] = useState(true);
  const [sound, setSound] = useState(
    () => localStorage.getItem("champions.sound") === "on",
  );
  const [pacing, setPacingState] = useState<Pacing>(readPacing);
  const [heroic, setHeroic] = useState(0);
  const [seedText, setSeedText] = useState("");
  const history = useRef<GameState[]>([]);
  const [undoDepth, setUndoDepth] = useState(0);
  const [guestHistory, setGuestHistory] = useState<GuestRecord[]>(readHistory);
  const clearHistory = () => {
    history.current = [];
    setUndoDepth(0);
  };
  function choosePacing(next: Pacing) {
    setPacingState(next);
    try {
      localStorage.setItem(PACING_KEY, next);
    } catch {
      // Blocked storage only loses the preference for the next visit.
    }
    if (game && game.pacing !== next && !["won", "lost"].includes(game.phase)) {
      const updated = dispatch(game, { type: "SET_PACING", pacing: next });
      if (!updated.error) setGame(updated);
    }
  }
  const [storageError, setStorageError] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  const sendRef = useRef<(command: Command) => void>(() => {});
  sendRef.current = send;
  const undoRef = useRef<() => void>(() => {});
  undoRef.current = undo;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => {
    if (game && !gameOwner)
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(game));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
  }, [game, gameOwner]);
  useEffect(() => {
    if (
      gameOwner &&
      account.session &&
      account.session.user?.id !== gameOwner
    ) {
      setGame(readSave());
      setGameOwner(null);
      setScreen("account");
      missionSync.reset();
    }
  }, [account.session?.user?.id, gameOwner]);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === "f" &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(
          (e.target as HTMLElement).tagName,
        )
      ) {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen().catch(() => {});
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    // Enter or Space acknowledges the current step when focus is not on a control.
    const key = (e: KeyboardEvent) => {
      if (
        (e.key !== "Enter" && e.key !== " ") ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "SELECT", "TEXTAREA", "BUTTON", "A", "SUMMARY"].includes(
          target.tagName,
        ) ||
        target.isContentEditable
      )
        return;
      if (screen !== "game" || !gameRef.current?.review) return;
      // A help, inspection or nested dialog must not advance the table behind it.
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      if (dialogs.some((dialog) => !dialog.querySelector("[data-proceed]")))
        return;
      e.preventDefault();
      sendRef.current({ type: "PROCEED" });
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [screen]);
  useEffect(() => {
    // Ctrl/Cmd+Z takes back the last action of the current hero phase.
    const key = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() !== "z" ||
        !(e.metaKey || e.ctrlKey) ||
        e.shiftKey
      )
        return;
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) ||
        target.isContentEditable ||
        Array.from(document.querySelectorAll('[role="dialog"]')).some(
          (dialog) => !dialog.querySelector("[data-proceed]"),
        ) ||
        screen !== "game"
      )
        return;
      e.preventDefault();
      undoRef.current();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [screen]);
  useEffect(() => {
    // Guests keep a local record of finished missions; accounts record theirs on the server.
    if (
      !game ||
      gameOwner ||
      !["won", "lost"].includes(game.phase) ||
      !game.accountMission
    )
      return;
    const record: GuestRecord = {
      id: game.accountMission.id,
      date: new Date().toISOString(),
      heroes: game.players.map((p) => ({ heroId: p.heroId, aspect: p.aspect })),
      villainId: game.villainId,
      difficulty: game.difficulty,
      heroic: game.heroic || 0,
      round: game.round,
      outcome: game.phase as "won" | "lost",
      seed: game.startSeed || 0,
    };
    setGuestHistory((list) => {
      if (list.some((r) => r.id === record.id)) return list;
      const next = [record, ...list].slice(0, 30);
      writeHistory(next);
      return next;
    });
  }, [game?.phase, game?.accountMission?.id, gameOwner]);
  useEffect(() => {
    (window as any).render_game_to_text = () =>
      JSON.stringify(
        gameRef.current && screen === "game"
          ? summarize(gameRef.current)
          : {
              screen,
              selectedHero: hero.name,
              team,
              selectedVillain: villain.name,
              aspect,
              difficulty,
              catalogOpen: contentView,
              catalogSummary: CATALOG_SUMMARY,
            },
      );
    (window as any).advanceTime = () => {};
  }, [screen, hero, villain, aspect, difficulty, team, contentView]);
  function tone() {
    if (!sound) return;
    try {
      const ctx = new AudioContext();
      const o = ctx.createOscillator(),
        g = ctx.createGain();
      o.connect(g);
      g.connect(ctx.destination);
      o.frequency.setValueAtTime(440, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(660, ctx.currentTime + 0.08);
      g.gain.setValueAtTime(0.03, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      o.start();
      o.stop(ctx.currentTime + 0.15);
      o.onended = () => void ctx.close();
    } catch {}
  }
  function send(command: Command) {
    if (!game) return;
    const next = dispatch(game, command);
    if (next.error) {
      setToast(next.error);
      return;
    }
    // Undo is fair only while no hidden card has been revealed since the state
    // being restored, and only within the current hero phase.
    if (
      next.hiddenInfo !== game.hiddenInfo ||
      next.phase !== "player" ||
      game.phase !== "player"
    )
      history.current = [];
    else if (!["PROCEED", "SET_PACING"].includes(command.type))
      history.current = [...history.current.slice(-19), game];
    setUndoDepth(history.current.length);
    setGame(next);
    if (next.combatEvents?.length)
      setCombat({ id: ++combatId.current, events: next.combatEvents });
    tone();
  }
  function undo() {
    const previous = history.current.pop();
    if (!previous) return;
    setUndoDepth(history.current.length);
    setCombat(null);
    setGame(previous);
  }
  function randomizeSetup() {
    const pick = <T,>(list: readonly T[]) =>
      list[Math.floor(Math.random() * list.length)];
    const free = HEROES.filter(
      (h) => !team.some((p, i) => i !== setupSeat && p.heroId === h.id),
    );
    const h = pick(free);
    const a = pick(ASPECTS).id;
    const v = pick(VILLAINS);
    setTeam((list) =>
      list.map((p, i) => (i === setupSeat ? { heroId: h.id, aspect: a } : p)),
    );
    setVillain(v);
    setModule(pick(MODULES).id);
  }
  function dailySetup() {
    const text = dailySeedText();
    const n = parseSeed(text)!;
    const h = HEROES[n % HEROES.length];
    const a = ASPECTS[(n >>> 3) % ASPECTS.length].id;
    const v = VILLAINS[(n >>> 5) % VILLAINS.length];
    setTeam([{ heroId: h.id, aspect: a }]);
    setSetupSeat(0);
    setVillain(v);
    setModule(MODULES[(n >>> 8) % MODULES.length].id);
    setDifficulty("standard");
    setHeroic(0);
    setSeedText(text);
    setToast(
      `Today's mission: ${h.name} (${ASPECTS.find((x) => x.id === a)!.name}) vs ${v.name}. Everyone playing the daily seed sees the same shuffles.`,
    );
  }
  async function copyResult() {
    if (!game) return;
    const summary = missionSummary(game);
    try {
      await navigator.clipboard.writeText(summary);
      setToast("Result copied. Paste it anywhere.");
    } catch {
      setToast(summary);
    }
  }
  async function start(replay = false, sameSeed = false, tutorial = false) {
    await missionSync.flush();
    if (missionSync.hasUnsaved()) {
      setToast(
        "Save the current mission before starting another. Use Retry save or open your profile.",
      );
      return;
    }
    setCombat(null);
    clearHistory();
    missionSync.reset();
    setGameOwner(account.session?.user?.id || null);
    const mission = {
      ...newGame(
        tutorial
          ? { ...TUTORIAL_SETUP, guided: true, pacing: "guided" }
          : replay && game
            ? {
                heroId: game.players[0].heroId,
                aspect: game.players[0].aspect,
                heroes: game.players.map((p) => ({
                  heroId: p.heroId,
                  aspect: p.aspect,
                  deckCards: p.deckCards,
                  deckAspects: p.deckAspects,
                })),
                villainId: game.villainId,
                difficulty: game.difficulty,
                module: game.module,
                guided: true,
                pacing,
                heroic: game.heroic || 0,
                seed: sameSeed ? game.startSeed || undefined : undefined,
              }
            : {
                heroId: hero.id,
                aspect,
                heroes: team,
                guided: true,
                villainId: villain.id,
                difficulty,
                module,
                pacing,
                heroic,
                seed: parseSeed(seedText),
              },
      ),
      accountMission: {
        id: crypto.randomUUID(),
        startedAt: new Date().toISOString(),
      },
    };
    if (tutorial) {
      setPacingState("guided");
      try {
        localStorage.setItem(PACING_KEY, "guided");
      } catch {
        /* The mission still uses guided pacing. */
      }
      saveTutorial({ missionId: mission.accountMission.id, index: 0 });
      setTutorialMissionId(mission.accountMission.id);
    } else {
      saveTutorial(null);
      setTutorialMissionId(null);
    }
    setGame(mission);
    setTutorialRequested(false);
    setScreen("game");
    setRestart(false);
    tone();
  }
  function startRequest(tutorial = false) {
    setTutorialRequested(tutorial);
    if (game && !["won", "lost"].includes(game.phase)) setRestart(true);
    else void start(false, false, tutorial);
  }
  function useSavedDeck(deck: SavedDeck) {
    const existing = team.findIndex((p) => p.heroId === deck.heroId);
    const seat = existing >= 0 ? existing : setupSeat;
    setTeam((a) =>
      a.map((p, i) =>
        i === seat
          ? {
              heroId: deck.heroId,
              aspect: deck.aspect,
              deckCards: [...deck.cards],
              deckAspects: deck.aspects,
              deckName: deck.name,
            }
          : p,
      ),
    );
    setSetupSeat(seat);
    setScreen("lobby");
    setToast(
      `${deck.name} loaded for ${HEROES.find((h) => h.id === deck.heroId)?.name}. Choose a villain and start your mission.`,
    );
  }
  async function resumeAccountMission(record: MissionRecord) {
    if (!record.state) return;
    await missionSync.flush();
    if (
      missionSync.hasUnsaved() &&
      !window.confirm(
        "There are unsaved changes at this table. Discard them and load the selected saved mission?",
      )
    )
      return;
    missionSync.adopt(record);
    clearHistory();
    setGameOwner(account.session!.user!.id);
    setGame(
      upgradeSave({
        ...structuredClone(record.state),
        accountMission: { id: record.id, startedAt: record.startedAt },
      }),
    );
    setCombat(null);
    setScreen("game");
  }
  async function signOut() {
    await missionSync.flush();
    if (missionSync.hasUnsaved())
      throw Error(
        "Your mission has unsaved changes. Retry saving before signing out.",
      );
    await account.request("logout");
    setGame(readSave());
    setGameOwner(null);
    clearHistory();
    missionSync.reset();
  }
  async function saveSetupDeck() {
    if (!account.session?.user) {
      setDeckView(false);
      setScreen("account");
      return;
    }
    try {
      await account.request("deck.save", {
        name:
          team[setupSeat].deckName ||
          `${hero.name} / ${allFourAspects ? "All four aspects" : ASPECTS.find((a) => a.id === aspect)!.name}`,
        heroId: hero.id,
        aspect,
        aspects: chosenAspects,
        cards: team[setupSeat].deckCards || deckCodes(hero.id, aspect),
      });
      setToast("Deck saved to your profile.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "Could not save deck.");
    }
  }
  const active = game && !["won", "lost"].includes(game.phase);
  // Without a configured database the account features would only show an apology.
  const accountsAvailable = account.session?.storage !== "unavailable";
  return (
    <div
      className={`app ${screen === "game" ? "playing" : ""}`}
      style={
        {
          "--hero-color": (screen === "game" && game
            ? HEROES.find((h) => h.id === game.heroId)
            : hero
          )?.color,
        } as CSSProperties
      }
    >
      <a className="skip-link" href="#main-content">
        Skip to main content
      </a>
      <header className="topbar">
        <Brand onClick={() => setScreen("lobby")} />
        <nav aria-label="Main navigation">
          <button
            className={screen === "lobby" ? "active" : ""}
            onClick={() => setScreen("lobby")}
          >
            <Shield size={17} /> Play<small>01</small>
          </button>
          <button
            className={screen === "collection" ? "active" : ""}
            onClick={() => setScreen("collection")}
          >
            <Cards size={17} /> Card library<small>02</small>
          </button>
          <button onClick={() => setHelp(true)}>
            How to play
            <ArrowUpRight size={13} />
          </button>
        </nav>
        <div className="top-tools">
          {accountsAvailable && (
            <button
              className="account-nav"
              aria-label={
                account.session?.user
                  ? "Open player profile"
                  : "Sign in or create account"
              }
              onClick={() => setScreen("account")}
            >
              <User size={18} />
              <span>{account.session?.user?.displayName || "Sign in"}</span>
            </button>
          )}
          <span className="edition">
            <span>CARD GAME</span>
            <b>LCG</b>
          </span>
          <button
            className="icon-button"
            aria-label={sound ? "Mute sound" : "Enable sound"}
            title={sound ? "Mute sound" : "Enable sound"}
            onClick={() => {
              setSound(!sound);
              localStorage.setItem("champions.sound", sound ? "off" : "on");
            }}
          >
            {sound ? <SpeakerHigh size={19} /> : <SpeakerSlash size={19} />}
          </button>
          {screen === "game" && (
            <button
              className="icon-button"
              aria-label="Toggle battle log"
              onClick={() => setLogOpen(!logOpen)}
            >
              <ListBullets size={20} />
            </button>
          )}
        </div>
      </header>
      {gameOwner && (
        <div
          className={`account-sync ${missionSync.status === "error" ? "error" : ""}`}
          role="status"
        >
          <ShieldCheck size={15} />
          {missionSync.status === "error"
            ? missionSync.error
            : missionSync.status === "saving"
              ? "Saving mission to your account…"
              : missionSync.status === "saved"
                ? "Mission saved to your account"
                : "Account autosave is ready"}
          {missionSync.status === "error" && (
            <>
              <button onClick={missionSync.retry}>Retry save</button>
              <button onClick={() => setScreen("account")}>Open profile</button>
            </>
          )}
        </div>
      )}
      {screen === "account" && (
        <AccountPage
          key={account.session?.user?.id || "guest"}
          account={account}
          onUseDeck={useSavedDeck}
          onResume={resumeAccountMission}
          onSignOut={signOut}
          onMissionDeleted={(id) => {
            if (gameOwner && game?.accountMission?.id === id) {
              setGame(null);
              setGameOwner(null);
              missionSync.reset();
            }
          }}
          onImportGuest={
            game &&
            !gameOwner &&
            account.session?.user &&
            !["won", "lost"].includes(game.phase)
              ? async () => {
                  const snapshot = {
                    ...structuredClone(game),
                    accountMission: {
                      id: crypto.randomUUID(),
                      startedAt: new Date().toISOString(),
                    },
                  };
                  const response = await account.request("mission.save", {
                    ...snapshot.accountMission,
                    revision: 0,
                    state: snapshot,
                  });
                  const record = response.library.missions.find(
                    (m) => m.id === snapshot.accountMission.id,
                  )!;
                  missionSync.adopt(record);
                  setGame(snapshot);
                  setGameOwner(response.user!.id);
                }
              : undefined
          }
        />
      )}
      {screen === "lobby" && (
        <main id="main-content" className="lobby page-width">
          <div className="lobby-kicker">
            <span>
              <span className="live-dot" />A NEW MISSION AWAITS
            </span>
            <span>{HEROES.length} HEROES. ONE EXTRAORDINARY UNIVERSE.</span>
          </div>
          {active && (
            <button className="resume-banner" onClick={() => setScreen("game")}>
              <div>
                <Clock size={18} />
                <span>
                  Unfinished business{" "}
                  <strong>
                    {HEROES.find((h) => h.id === game!.heroId)!.name} vs.{" "}
                    {VILLAINS.find((v) => v.id === game!.villainId)!.name} ·
                    Round {game!.round}
                  </strong>
                </span>
              </div>
              <span>
                Resume mission <ArrowRight size={18} />
              </span>
            </button>
          )}
          <section className="hero-banner" style={aspectStyle(hero.color)}>
            <div
              className="hero-illustration"
              role="img"
              aria-label="Marvel heroes assemble over New York"
            />
            <div className="banner-grain" aria-hidden="true" />
            <div className="banner-copy">
              <span className="comic-caption">
                YOUR NEXT GREAT ORIGIN STORY
              </span>
              <h1>
                THE WORLD
                <br />
                <span>NEEDS YOU.</span>
              </h1>
              <p>
                The villains have a plan. You have a deck.
                <br />
                Suit up. Take a stand. Become a champion.
              </p>
              <div className="banner-actions">
                <button
                  className="primary-button"
                  onClick={() =>
                    document.getElementById("hero-setup")?.scrollIntoView({
                      behavior: window.matchMedia(
                        "(prefers-reduced-motion: reduce)",
                      ).matches
                        ? "instant"
                        : "smooth",
                      block: "start",
                    })
                  }
                >
                  Choose your hero <ArrowRight size={21} />
                </button>
                <button
                  className="text-button"
                  onClick={() => startRequest(true)}
                >
                  <BookOpen size={17} /> Play your first mission
                </button>
              </div>
              <div className="banner-meta">
                <span>
                  <User size={16} /> 1–3 hero hot-seat
                </span>
                <span>
                  <ShieldCheck size={17} /> {HEROES.length} iconic heroes
                </span>
                <span>
                  <Skull size={17} /> {VILLAINS.length} villain scenarios
                </span>
              </div>
            </div>
            <span className="cover-tag">
              <b>BIG HEROES.</b>
              <span>BIGGER DECISIONS.</span>
            </span>
          </section>
          <div className="setup-heading">
            <div>
              <span className="small-label">MISSION CONTROL</span>
              <h2>ASSEMBLE YOUR ADVENTURE.</h2>
            </div>
            <span>Pick your hero. Build your approach. Save the day.</span>
          </div>
          <section
            className="team-builder"
            aria-label="Team size and hero seats"
          >
            <div className="team-builder-top">
              <div>
                <span className="small-label">
                  SOLO COMMAND. ASSEMBLED TOGETHER.
                </span>
                <h3>How many heroes will you command?</h3>
                <p>
                  One player, one device. Take each hero’s turn in sequence.
                </p>
              </div>
              <div className="team-size" aria-label="Number of heroes">
                {[1, 2, 3].map((n) => (
                  <button
                    key={n}
                    aria-pressed={team.length === n}
                    onClick={() => setTeamSize(n)}
                  >
                    <Users size={18} />
                    {n} {n === 1 ? "hero" : "heroes"}
                  </button>
                ))}
              </div>
            </div>
            <div className="setup-seats">
              {team.map((p, i) => {
                const h = HEROES.find((h) => h.id === p.heroId)!;
                return (
                  <button
                    key={i}
                    className={`setup-seat ${setupSeat === i ? "selected" : ""}`}
                    style={aspectStyle(h.color)}
                    aria-pressed={setupSeat === i}
                    onClick={() => setSetupSeat(i)}
                    aria-label={`Configure hero ${i + 1}: ${h.name}`}
                  >
                    <span className="seat-number">0{i + 1}</span>
                    <img
                      data-card-preview={h.code}
                      src={imageFor(h.code)}
                      alt=""
                    />
                    <span>
                      <b>{h.name}</b>
                      <small>
                        {p.heroId === "warlock"
                          ? "All four aspects"
                          : ASPECTS.find((a) => a.id === p.aspect)?.name}{" "}
                        ·{" "}
                        {deckSizeFor(
                          p.deckCards || deckCodes(p.heroId, p.aspect),
                        )}{" "}
                        cards
                      </small>
                    </span>
                    {setupSeat === i ? (
                      <CheckCircle size={20} weight="fill" />
                    ) : (
                      <ChevronRight size={20} />
                    )}
                  </button>
                );
              })}
            </div>
          </section>
          <div className="setup-grid">
            <section id="hero-setup" className="hero-setup">
              <div className="section-heading">
                <div>
                  <span className="step-number">01</span>
                  <h2>CHOOSE HERO {setupSeat + 1}</h2>
                </div>
                <span className="muted">Find your superpower.</span>
              </div>
              <div className="hero-roster">
                {HEROES.map((h) => (
                  <button
                    key={h.id}
                    className={`hero-tile ${h.id === hero.id ? "selected" : ""}`}
                    style={aspectStyle(h.color)}
                    onClick={() => {
                      setHero(h);
                      setAspect(h.aspect);
                    }}
                    disabled={team.some(
                      (p, i) => i !== setupSeat && p.heroId === h.id,
                    )}
                    title={
                      team.some((p, i) => i !== setupSeat && p.heroId === h.id)
                        ? "Already assigned to another hero seat"
                        : h.name
                    }
                    aria-pressed={hero.id === h.id}
                  >
                    <div className="portrait">
                      <img
                        data-card-preview={h.code}
                        src={imageFor(h.code)}
                        alt={h.name}
                      />
                    </div>
                    {hero.id === h.id && (
                      <span className="selected-check">
                        <Check size={14} weight="bold" />
                      </span>
                    )}
                    <div className="hero-tile-copy">
                      <strong>{h.name}</strong>
                      <small>{h.identity}</small>
                    </div>
                    <span className="tile-border" />
                  </button>
                ))}
              </div>
              <button
                className="content-entry"
                onClick={() => setContentView(true)}
              >
                <BookOpen size={24} weight="duotone" />
                <span>
                  <b>All heroes & starter decks</b>
                  <small>
                    {CATALOG_SUMMARY.heroes} heroes · Core Set, expansions &
                    standalone Hero Packs · Explore where each deck comes from
                  </small>
                </span>
                <ArrowUpRight size={18} />
              </button>
              <div className="hero-details">
                <div>
                  <div className="hero-name">
                    <h3>{hero.name}</h3>
                    <span className="hero-style">{hero.style}</span>
                  </div>
                  <p>{hero.description}</p>
                  <div className="signature-links">
                    <button
                      className="text-button"
                      onClick={() => setInspect({ code: hero.code })}
                    >
                      <Eye size={15} /> Identity card
                    </button>
                    <button
                      className="text-button"
                      onClick={() =>
                        setInspect({
                          code:
                            fanCards[hero.id]?.[0] ||
                            deckCodes(hero.id, aspect).find(
                              (code) =>
                                card(code).type_code === "event" &&
                                card(code).faction_code === "hero",
                            ) ||
                            hero.code,
                        })
                      }
                    >
                      <Lightning size={15} /> Signature move
                    </button>
                    <span className="complexity-label">
                      <Difficulty level={hero.complexity} />{" "}
                      {hero.complexity === 1
                        ? "Easy to learn"
                        : hero.complexity === 2
                          ? "A little strategy"
                          : "Plan your combos"}
                    </span>
                  </div>
                </div>
                <div className="hero-stat-group">
                  {[
                    ["ATK", card(hero.code).attack],
                    ["THW", card(hero.code).thwart],
                    ["DEF", card(hero.code).defense],
                    ["HP", card(hero.code).health],
                  ].map(([name, n]) => (
                    <div key={name}>
                      <strong>{n}</strong>
                      <small>{name}</small>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hero-product-source">
                <ProductSource code={hero.code} compact />
              </div>
              <div className="aspect-heading">
                <div>
                  <span className="step-number">02</span>
                  <h2>CHOOSE YOUR APPROACH</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setDeckView(true)}
                >
                  View {setupDeckSize}-card deck <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="aspect-grid">
                {ASPECTS.map((a) => {
                  const I =
                    a.id === "justice"
                      ? Target
                      : a.id === "aggression"
                        ? Fist
                        : a.id === "leadership"
                          ? Users
                          : Shield;
                  return (
                    <button
                      style={aspectStyle(a.color)}
                      key={a.id}
                      className={`aspect-option ${allFourAspects || aspect === a.id ? "selected" : ""}`}
                      onClick={() => setAspect(a.id)}
                      aria-pressed={allFourAspects || aspect === a.id}
                      disabled={allFourAspects}
                    >
                      <I
                        size={21}
                        weight={
                          allFourAspects || aspect === a.id ? "fill" : "regular"
                        }
                      />
                      <span>{a.name}</span>
                      {(allFourAspects || aspect === a.id) && (
                        <Check size={13} />
                      )}
                    </button>
                  );
                })}
              </div>
              {hero.id === "spider_woman" && (
                <label className="aspect-description">
                  Second aspect{" "}
                  <select
                    aria-label="Spider-Woman second aspect"
                    value={chosenAspects.find((value) => value !== aspect)}
                    onChange={(event) =>
                      setAspect(aspect, event.target.value as Aspect)
                    }
                  >
                    {ASPECTS.filter((value) => value.id !== aspect).map(
                      (value) => (
                        <option key={value.id} value={value.id}>
                          {value.name}
                        </option>
                      ),
                    )}
                  </select>
                  <span>
                    Equal cards from both chosen aspects, including their
                    signature cards.
                  </span>
                </label>
              )}
              <p className="aspect-description">
                {allFourAspects
                  ? "Adam Warlock uses all four aspects with equal card totals and only one copy of each non-signature card."
                  : ASPECTS.find((a) => a.id === aspect)!.description}{" "}
                {setupCardCount > 0 &&
                  (hero.id === "vision"
                    ? `One Permanent mass card stays outside the ${setupDeckSize}-card deck and enters play after you keep your opening hand. `
                    : `${setupCardCount} Permanent energy forms start in play outside the ${setupDeckSize}-card deck. `)}
                <span>
                  {team[setupSeat].deckName
                    ? `${team[setupSeat].deckName} is ready to play.`
                    : "A complete starter deck is ready to play."}
                </span>
              </p>
              {accountsAvailable && (
                <div className="account-setup-deck">
                  <span>
                    {team[setupSeat].deckName || `${hero.name} starter deck`}
                  </span>
                  <div>
                    <button
                      className="text-button"
                      onClick={() => void saveSetupDeck()}
                    >
                      <Cards size={16} /> Save deck
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setScreen("account")}
                    >
                      My decks <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              )}
            </section>
            <section className="mission-panel">
              <div className="section-heading">
                <div>
                  <span className="step-number">03</span>
                  <h2>CHOOSE YOUR VILLAIN</h2>
                </div>
              </div>
              <div className="villain-tabs">
                {VILLAINS.map((v) => (
                  <button
                    key={v.id}
                    className={v.id === villain.id ? "active" : ""}
                    aria-pressed={v.id === villain.id}
                    onClick={() => {
                      setVillain(v);
                      setModule(v.module);
                    }}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
              <div className="mission-preview">
                <div className="mission-portrait">
                  <img
                    data-card-preview={villain.codes[0]}
                    tabIndex={0}
                    src={imageFor(villain.codes[0])}
                    alt={villain.name}
                  />
                </div>
                <div className="mission-info">
                  <span className="small-label">{villain.location}</span>
                  <h3>{villain.name.toUpperCase()}</h3>
                  <span className="mission-subtitle">{villain.title}</span>
                  <div className="mission-level">
                    <Difficulty level={villain.difficulty} />
                    {
                      [
                        "",
                        "A good first fight",
                        "A tactical challenge",
                        "An all-out war",
                      ][villain.difficulty]
                    }
                  </div>
                </div>
              </div>
              <p className="mission-description">{villain.description}</p>
              <div className="setting-line">
                <span>Difficulty</span>
                <div className="segmented">
                  {(["standard", "expert"] as const).map((d) => (
                    <button
                      key={d}
                      className={difficulty === d ? "selected" : ""}
                      aria-pressed={difficulty === d}
                      onClick={() => setDifficulty(d)}
                    >
                      {d === "standard" ? "Standard" : "Expert"}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setting-line tempo-line">
                <span>Tempo</span>
                <div className="segmented">
                  {PACINGS.map((p) => (
                    <button
                      key={p.id}
                      className={pacing === p.id ? "selected" : ""}
                      aria-pressed={pacing === p.id}
                      title={p.text}
                      onClick={() => choosePacing(p.id)}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
              <p className="setting-help">
                {PACINGS.find((p) => p.id === pacing)!.text} Decisions always
                pause.
              </p>
              <div className="setting-line heroic-line">
                <span>Heroic</span>
                <div className="segmented">
                  {[0, 1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className={heroic === n ? "selected" : ""}
                      aria-pressed={heroic === n}
                      title={
                        n
                          ? `Each hero is dealt ${n} extra encounter card${n === 1 ? "" : "s"} every villain phase.`
                          : "Standard dealing: one encounter card per hero."
                      }
                      onClick={() => setHeroic(n)}
                    >
                      {n === 0 ? "Off" : n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="seed-line">
                <label>
                  Seed
                  <input
                    id="mission-seed"
                    value={seedText}
                    maxLength={40}
                    placeholder="Optional · same seed, same shuffles"
                    onChange={(e) => setSeedText(e.target.value)}
                  />
                </label>
                <div className="seed-actions">
                  <button
                    className="text-button"
                    title="Same hero, villain and shuffles for everyone today"
                    onClick={dailySetup}
                  >
                    <CalendarBlank size={15} /> Daily mission
                  </button>
                  <button
                    className="text-button"
                    title="Random hero, aspect, villain and modular set for this seat"
                    onClick={randomizeSetup}
                  >
                    <DiceFive size={15} /> Surprise me
                  </button>
                </div>
              </div>
              <label className="module-label">
                Modular encounter
                <select
                  value={module}
                  onChange={(e) => setModule(e.target.value)}
                >
                  {MODULES.map((m) => (
                    <option value={m.id} key={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="mission-team-summary">
                {team.map((p, i) => (
                  <div className="mission-loadout" key={p.heroId}>
                    <span className="seat-number">0{i + 1}</span>
                    <span>
                      <b>{HEROES.find((h) => h.id === p.heroId)!.name}</b>
                      <small>
                        {p.heroId === "warlock"
                          ? "All four aspects"
                          : ASPECTS.find((a) => a.id === p.aspect)?.name}{" "}
                        ·{" "}
                        {deckSizeFor(
                          p.deckCards || deckCodes(p.heroId, p.aspect),
                        )}
                        -card deck
                      </small>
                    </span>
                    <CheckCircle size={19} weight="fill" />
                  </div>
                ))}
                <div className="scaling-summary">
                  <span>
                    <Heart size={16} />
                    {card(villain.codes[difficulty === "expert" ? 1 : 0])
                      .health! * team.length}{" "}
                    villain HP
                  </span>
                  <span>
                    <Target size={16} />
                    {card(villain.schemes[0]).threat! * team.length} threat
                    limit
                  </span>
                </div>
              </div>
              <button
                id="start-btn"
                className="primary-button start-button"
                onClick={() => startRequest()}
              >
                <Play size={17} weight="fill" /> START MISSION{" "}
                <ArrowRight size={20} />
              </button>
              <span className="save-note">
                <ShieldCheck size={13} /> Your progress saves automatically.
              </span>
            </section>
          </div>
          {!account.session?.user && guestHistory.length > 0 && (
            <section className="recent-missions" aria-label="Recent missions">
              <div>
                <span className="small-label">ON THIS DEVICE</span>
                <h2>
                  RECENT MISSIONS{" "}
                  <span>
                    {guestHistory.filter((r) => r.outcome === "won").length} /{" "}
                    {guestHistory.length} won
                  </span>
                </h2>
              </div>
              <ol>
                {guestHistory.slice(0, 5).map((r) => (
                  <li key={r.id} className={r.outcome}>
                    <b>{r.outcome === "won" ? "WIN" : "LOSS"}</b>
                    <span>
                      {r.heroes
                        .map((p) => HEROES.find((h) => h.id === p.heroId)?.name)
                        .join(", ")}{" "}
                      vs {VILLAINS.find((v) => v.id === r.villainId)?.name}
                      <small>
                        {r.difficulty}
                        {r.heroic ? ` · Heroic ${r.heroic}` : ""} · {r.round}{" "}
                        rounds · {new Date(r.date).toLocaleDateString()}
                      </small>
                    </span>
                    <button
                      className="text-button"
                      title="Load this mission's seed and setup"
                      onClick={() => {
                        setTeam(r.heroes.map((p) => ({ ...p })));
                        setSetupSeat(0);
                        setVillain(
                          VILLAINS.find((v) => v.id === r.villainId) ||
                            VILLAINS[0],
                        );
                        setDifficulty(r.difficulty);
                        setHeroic(r.heroic);
                        setSeedText(r.seed ? String(r.seed) : "");
                        setToast(
                          "Setup and seed loaded. Start the mission to replay it.",
                        );
                      }}
                    >
                      Replay <ArrowRight size={14} />
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
          <section className="field-guide">
            <div>
              <BookOpen size={29} />
              <span className="small-label">YOUR MISSION, AT A GLANCE</span>
              <h2>
                GREAT POWER.
                <br /> YOUR CALL.
              </h2>
              <button className="text-button" onClick={() => setHelp(true)}>
                Read the field guide <ArrowUpRight size={17} />
              </button>
            </div>
            <article>
              <Fist size={28} />
              <h3>Take down the villain.</h3>
              <p>
                Fight through both villain stages. Your cards and allies are
                your greatest weapons.
              </p>
            </article>
            <article>
              <Target size={28} />
              <h3>Keep the city safe.</h3>
              <p>
                Remove threat before the main scheme completes. Every turn is a
                balancing act.
              </p>
            </article>
            <article>
              <ArrowsClockwise size={28} />
              <h3>Embrace both identities.</h3>
              <p>
                Switch between hero and alter-ego to fight, recover, and use
                your unique abilities.
              </p>
            </article>
          </section>
          <section
            className="official-resources"
            aria-labelledby="official-resources-title"
          >
            <div className="official-resources-heading">
              <BookOpen size={26} weight="duotone" />
              <div>
                <span className="small-label">FROM THE ORIGINAL CREATORS</span>
                <h2 id="official-resources-title">
                  THE GAME BEHIND THE HEROES.
                </h2>
              </div>
            </div>
            <nav aria-label="Official Marvel Champions resources">
              <a
                href="https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf"
                target="_blank"
                rel="noopener noreferrer"
              >
                <BookOpen size={21} />
                <span>
                  <b>Learn to Play</b>
                  <small>Official introductory rulebook · PDF</small>
                </span>
                <ArrowUpRight size={18} />
              </a>
              <a
                href="https://www.fantasyflightgames.com/en/products/marvel-champions-the-card-game/#support-section"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ListBullets size={21} />
                <span>
                  <b>Official rules &amp; updates</b>
                  <small>Rules Reference and current rulings · FFG</small>
                </span>
                <ArrowUpRight size={18} />
              </a>
              <a
                href="https://www.fantasyflightgames.com/en/products/marvel-champions-the-card-game/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Cards size={21} />
                <span>
                  <b>Discover the original game</b>
                  <small>Marvel Champions: The Card Game · FFG</small>
                </span>
                <ArrowUpRight size={18} />
              </a>
            </nav>
            <p className="fan-project-note">
              <strong>An unofficial fan project.</strong> Made out of love for
              Marvel Champions. This project is not affiliated with, endorsed
              by, or sponsored by Marvel, Fantasy Flight Games, or Asmodee. Card
              artwork, characters, names, and game content belong to their
              respective owners. Support the creators by playing the original
              tabletop game.
            </p>
          </section>
          <footer className="footer">
            <span>Built for the love of the game.</span>
            <span>
              Unofficial fan project · © Marvel / Fantasy Flight Games
            </span>
            <a
              href="https://marvelcdb.com/api/"
              target="_blank"
              rel="noreferrer"
            >
              Card data by MarvelCDB <ArrowUpRight size={12} />
            </a>
          </footer>
        </main>
      )}
      {screen === "collection" && (
        <Collection
          onInspect={(code) => setInspect({ code })}
          renderCard={(code) => <CardImage code={code} lazy />}
        />
      )}
      {screen === "game" && game && (
        <Tabletop
          game={game}
          saveLabel={
            gameOwner
              ? missionSync.status === "saved"
                ? "Progress saved to your account"
                : missionSync.status === "error"
                  ? "Account save needs attention"
                  : "Saving to your account…"
              : storageError
                ? "Device save needs attention"
                : "Progress saved on this device"
          }
          send={send}
          inspect={setInspect}
          logOpen={logOpen}
          onEnd={() =>
            game.playerCount > 1 ? send({ type: "END_TURN" }) : setEndTurn(true)
          }
          onHome={() => setScreen("lobby")}
          onHelp={() => setHelp(true)}
          pacing={pacing}
          onPacing={choosePacing}
          canUndo={undoDepth > 0}
          onUndo={undo}
          coach={
            tutorialMissionId === game.accountMission?.id ? (
              <TutorialCoach
                key={tutorialMissionId}
                game={game}
                onClose={() => {
                  saveTutorial(null);
                  setTutorialMissionId(null);
                }}
              />
            ) : undefined
          }
        />
      )}
      {game?.error && <span className="sr-only">{game.error}</span>}
      {screen === "game" && game?.phase === "mulligan" && !game.review && (
        <CardSelection
          key={game.activePlayerId}
          title={`${HEROES.find((h) => h.id === game.heroId)!.name} · opening hand`}
          text="Keep the cards you want. Select any cards to replace once before your first turn."
          pieces={game.player.hand}
          min={0}
          max={game.player.hand.length}
          mode="mulligan"
          onConfirm={(ids) => send({ type: "MULLIGAN", ids })}
        />
      )}
      {screen === "game" && game?.prompt && !game.review && !inspect && (
        <Decision
          key={`${game.prompt.title}-${game.prompt.kind}-${game.nextId}`}
          game={game}
          send={send}
          inspect={setInspect}
        />
      )}
      {endTurn && game && (
        <CardSelection
          title="Ready for the villain?"
          text={`Choose any cards to discard, then draw up to your ${handSize(game)}-card hand size and ready your cards. The villain will ${game.player.form === "hero" ? "attack" : "scheme"}.`}
          pieces={game.player.hand}
          min={Math.max(0, game.player.hand.length - handSize(game))}
          max={game.player.hand.length}
          onClose={() => setEndTurn(false)}
          onConfirm={(ids) => {
            setEndTurn(false);
            send({ type: "END_TURN", discard: ids });
          }}
          mode="end"
        />
      )}
      {contentView && (
        <Modal
          title="All heroes & starter decks"
          wide
          className="content-browser-modal"
          eyebrow="THE COMPLETE MARVEL CHAMPIONS CATALOG"
          onClose={() => setContentView(false)}
        >
          <ContentBrowser
            initialHeroCode={hero.code}
            assignedHeroIds={team
              .filter((_, index) => index !== setupSeat)
              .map((seat) => seat.heroId)}
            onInspect={(code) => setInspect({ code })}
            onChooseHero={(id, selectedAspect, codes, deckName) => {
              const selected = HEROES.find((h) => h.id === id);
              if (selected) {
                const nextAspect =
                  ASPECTS.find((a) => a.id === selectedAspect)?.id ||
                  selected.aspect;
                setTeam((list) =>
                  list.map((seat, index) =>
                    index === setupSeat
                      ? {
                          heroId: id,
                          aspect: nextAspect,
                          ...(codes
                            ? {
                                deckCards: [...codes],
                                deckName,
                                deckOrigin: "source" as const,
                              }
                            : {}),
                        }
                      : seat,
                  ),
                );
                setContentView(false);
              }
            }}
          />
        </Modal>
      )}
      {inspect && (
        <Modal title={card(inspect.code).name} onClose={() => setInspect(null)}>
          <div className="inspect-content">
            <CardImage code={inspect.code} />
            <div>
              <span className="card-type">
                {card(inspect.code).faction_code || "card"} ·{" "}
                {(card(inspect.code).type_code || "card").replace("_", " ")}
              </span>
              {inspectedEnergyForm && (
                <p className="modal-intro" role="status">
                  {inspectedEnergyForm.faceup ? "Faceup" : "Facedown"} energy
                  form. Current energy form: {inspectedEnergyForm.current}.
                  {!inspectedEnergyForm.faceup &&
                    " Its text is inactive while facedown."}
                </p>
              )}
              {(inspect.piece?.accelerationTokens || 0) > 0 && (
                <p className="modal-intro" role="status">
                  Acceleration tokens: {inspect.piece!.accelerationTokens}
                </p>
              )}
              <p className="rules-text">
                {plain(card(inspect.code).text) ||
                  (card(inspect.code).type_code === "resource"
                    ? "A resource card. Spend it when paying a resource cost."
                    : "No printed rules text on this face.")}
              </p>
              <KeywordGuide text={card(inspect.code).text} />
              <ProductSource code={inspect.code} />
              {card(inspect.code).errata && (
                <p className="hint">
                  Updated card text ·{" "}
                  <a
                    className="text-link"
                    href={card(inspect.code).errata!.url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {card(inspect.code).errata!.reference}
                  </a>
                  . The card image shows the original printing.
                </p>
              )}
              <div className="inspect-resources">
                <ResourceIcons items={resources(card(inspect.code))} />
                <span>{card(inspect.code).traits}</span>
              </div>
              <a
                className="text-link"
                href={`https://marvelcdb.com/card/${inspect.code}`}
                target="_blank"
                rel="noreferrer"
              >
                View on MarvelCDB <ArrowUpRight size={15} />
              </a>
              {inspect.hand && game && inspect.piece && (
                <>
                  <p className="hint">
                    {playable(
                      inspect.playerId
                        ? seatView(game, inspect.playerId)
                        : game,
                      inspect.piece,
                    ) ||
                      `Pay ${cardCost(game, card(inspect.code))} resources to play this card.`}
                  </p>
                  <button
                    className="primary-button"
                    disabled={
                      !!playable(
                        inspect.playerId
                          ? seatView(game, inspect.playerId)
                          : game,
                        inspect.piece,
                      )
                    }
                    onClick={() => {
                      const id = inspect.piece!.id;
                      setInspect(null);
                      send({ type: "PLAY", id, playerId: inspect.playerId });
                    }}
                  >
                    Play card <ArrowRight size={18} />
                  </button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
      {deckView && (
        <Modal
          title={`${hero.name} / ${chosenAspects.map((value) => ASPECTS.find((a) => a.id === value)?.name).join(" + ")}`}
          wide
          onClose={() => setDeckView(false)}
        >
          <p className="modal-intro">
            {setupDeckSize} cards ·{" "}
            {team[setupSeat].deckName || "App starter deck"}. Includes the
            complete required hero set.
          </p>
          {setupCardCount > 0 && (
            <p className="modal-intro">
              {hero.id === "vision"
                ? "One reversible Intangible / Dense mass card stays outside the 40-card deck and enters play after you keep your opening hand."
                : `${setupCardCount} Permanent energy forms start in play and stay outside the deck count.`}
            </p>
          )}
          <DeckProvenance
            codes={team[setupSeat].deckCards || deckCodes(hero.id, aspect)}
            custom={!!team[setupSeat].deckCards}
            sourceName={
              team[setupSeat].deckOrigin === "source"
                ? team[setupSeat].deckName
                : undefined
            }
          />
          <div className="deck-list">
            {[
              "hero",
              ...new Set(
                (team[setupSeat].deckCards || deckCodes(hero.id, aspect))
                  .map((code) => card(code).faction_code)
                  .filter((faction) => faction !== "hero"),
              ),
            ].map((f) => {
              const counts = (
                team[setupSeat].deckCards || deckCodes(hero.id, aspect)
              ).reduce(
                (a, c) => ({ ...a, [c]: (a[c] || 0) + 1 }),
                {} as Record<string, number>,
              );
              return (
                <section key={f}>
                  <h3>{f.toUpperCase()}</h3>
                  {Object.entries(counts)
                    .filter(([c]) => card(c).faction_code === f)
                    .map(([code, n]) => (
                      <button
                        key={code}
                        data-card-preview={code}
                        onClick={() => {
                          setDeckView(false);
                          setInspect({ code });
                        }}
                      >
                        <span className="deck-card-source">
                          {card(code).name}
                          <small>{productForCard(code)?.name}</small>
                        </span>
                        <b>×{n}</b>
                      </button>
                    ))}
                </section>
              );
            })}
          </div>
          <div className="modal-actions">
            <button
              className="primary-button"
              onClick={() => void saveSetupDeck()}
            >
              <Cards size={18} /> Save to my decks
            </button>
          </div>
        </Modal>
      )}
      {help && (
        <Help onClose={() => setHelp(false)} accounts={accountsAvailable} />
      )}
      {restart && (
        <Modal title="Start a new mission?" onClose={() => setRestart(false)}>
          <p className="modal-intro">
            {gameOwner
              ? "Your current mission will remain in your profile. Open a new table for "
              : "Your current guest mission will be replaced by "}
            {tutorialRequested
              ? "Spider-Man vs. Rhino (first mission)"
              : `${hero.name} vs. ${villain.name}`}
            .
          </p>
          <div className="modal-actions">
            <button
              className="secondary-button"
              onClick={() => {
                setRestart(false);
                setScreen("game");
              }}
            >
              Resume current mission
            </button>
            <button
              className="primary-button"
              onClick={() => void start(false, false, tutorialRequested)}
            >
              Start new mission <ArrowRight size={18} />
            </button>
          </div>
        </Modal>
      )}
      {screen === "game" &&
        game &&
        ["won", "lost"].includes(game.phase) &&
        !game.review && (
          <Modal
            title={
              game.phase === "won" ? "THE CITY IS SAFE." : "EVERY HERO FALLS."
            }
          >
            <div className={`result-banner ${game.phase}`}>
              <div className="result-icon">
                {game.phase === "won" ? (
                  <ShieldCheck size={60} weight="fill" />
                ) : (
                  <Skull size={60} />
                )}
              </div>
              <span className="small-label">
                {game.phase === "won" ? "MISSION COMPLETE" : "MISSION FAILED"}
              </span>
              <h3>
                {game.phase === "won"
                  ? "A true champion."
                  : "Rise. And try again."}
              </h3>
              <p>{game.result}</p>
              {game.stats && (
                <dl className="result-stats">
                  {(
                    [
                      ["Damage dealt", game.stats.damageDealt],
                      ["Damage taken", game.stats.damageTaken],
                      ["Threat removed", game.stats.threatRemoved],
                      ["Threat placed", game.stats.threatPlaced],
                      ["Cards played", game.stats.cardsPlayed],
                      ["Enemies defeated", game.stats.enemiesDefeated],
                    ] as const
                  ).map(([label, value]) => (
                    <div key={label}>
                      <dd>{value}</dd>
                      <dt>{label}</dt>
                    </div>
                  ))}
                </dl>
              )}
              <span className="result-rounds">
                {game.round} rounds ·{" "}
                {game.players
                  .map((p) => HEROES.find((h) => h.id === p.heroId)!.name)
                  .join(", ")}{" "}
                · {game.difficulty}
                {game.heroic ? ` · Heroic ${game.heroic}` : ""}
                {game.startSeed ? ` · seed ${game.startSeed}` : ""}
              </span>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setScreen("lobby")}
                >
                  Choose a mission
                </button>
                <button
                  className="secondary-button"
                  onClick={() => void copyResult()}
                >
                  <Copy size={16} /> Copy result
                </button>
                <button
                  className="secondary-button"
                  title="Same setup and the same shuffles"
                  onClick={() => void start(true, true)}
                >
                  <ArrowCounterClockwise size={16} /> Replay this seed
                </button>
                <button
                  className="primary-button"
                  onClick={() => void start(true)}
                >
                  <ArrowsClockwise size={17} /> Play again
                </button>
              </div>
            </div>
          </Modal>
        )}
      <CardPreview />
      {screen === "game" && combat && (
        <CombatCinematic
          key={combat.id}
          events={combat.events}
          onComplete={finishCombat}
        />
      )}
      {(toast || storageError) && (
        <div className="toast" role="alert">
          <Info size={20} />
          {toast || "Browser storage is full. This session cannot be saved."}
          <button aria-label="Dismiss message" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
function CardSelection({
  title,
  text,
  pieces,
  min,
  max,
  onConfirm,
  onClose,
  mode,
}: {
  title: string;
  text: string;
  pieces: Piece[];
  min: number;
  max: number;
  onConfirm: (ids: string[]) => void;
  onClose?: () => void;
  mode: "mulligan" | "end";
}) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <Modal
      title={title}
      wide
      onClose={onClose}
      eyebrow={
        mode === "mulligan"
          ? "YOUR ORIGIN STORY STARTS HERE"
          : "THE VILLAIN STRIKES NEXT"
      }
    >
      <p className="modal-intro">{text}</p>
      {mode === "end" && <VillainSteps />}
      <div className="selection-cards">
        {pieces.map((p) => (
          <button
            key={p.id}
            className={`selection-card ${selected.includes(p.id) ? "selected" : ""}`}
            aria-pressed={selected.includes(p.id)}
            onClick={() =>
              setSelected(
                selected.includes(p.id)
                  ? selected.filter((id) => id !== p.id)
                  : selected.length < max
                    ? [...selected, p.id]
                    : selected,
              )
            }
          >
            <CardImage code={p.code} />
            <span>
              {selected.includes(p.id) ? (
                <>
                  <ArrowsClockwise size={14} />{" "}
                  {mode === "mulligan" ? "Replace" : "Discard"}
                </>
              ) : (
                card(p).name
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="selection-footer">
        <span aria-live="polite">
          {selected.length} selected
          {min > 0 ? ` · discard at least ${min}` : ""}
        </span>
        <button
          className="primary-button"
          disabled={selected.length < min || selected.length > max}
          onClick={() => onConfirm(selected)}
        >
          {mode === "mulligan"
            ? selected.length
              ? `Replace ${selected.length} & begin`
              : "Keep hand & begin"
            : "Begin villain phase"}{" "}
          <ArrowRight size={18} />
        </button>
      </div>
    </Modal>
  );
}
function PaymentDecision({
  game: s,
  send,
}: {
  game: GameState;
  send: (c: Command) => void;
}) {
  const p = s.prompt!;
  const [selected, setSelected] = useState<string[]>([]);
  const [wild, setWild] = useState<Resource>(p.wildAs || "energy");
  const [preview, setPreview] = useState<string | null>(null);
  const sources = paymentSources(
    s,
    p.card?.id,
    p.paymentTarget,
    p.handOnly,
    p.alliance,
  );
  const status = paymentStatus(
    sources,
    selected,
    p.cost || 0,
    p.requirements,
    p.retainOneOfIds,
    p.sourceRequirement,
    p.retainAlternatives,
  );
  const subject = paymentSubject(s, p);
  // Spend the least valuable resources first: Scientist and printed resource
  // cards, then cards that cannot be played this turn, then playable cards by cost.
  const rank = (x: PaymentSource) => {
    if (x.id === "scientist") return 0;
    const piece = s.player.hand.find((h) => h.id === x.id);
    if (!piece) return x.name === "Pepper Potts" ? 1.5 : 4;
    const c = card(piece);
    if (c.type_code === "resource") return 1;
    const open = { ...s, prompt: null, review: null };
    return (playable(open, piece) ? 2 : 3) + (c.cost || 0) / 100;
  };
  const suggestion = suggestPayment(
    sources,
    p.cost || 0,
    p.requirements,
    rank,
    p.retainOneOfIds,
    p.sourceRequirement,
    p.retainAlternatives,
  );
  const discards = status.selected.filter((x) => x.kind === "card").length;
  const abilities = status.selected.length - discards;
  const toggle = (id: string) =>
    setSelected((ids) =>
      ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    );
  if (preview)
    return (
      <Modal
        key="resource-inspection"
        title={card(preview).name}
        eyebrow="RESOURCE CARD · READ BEFORE SPENDING"
        onClose={() => setPreview(null)}
        className="resource-inspection"
      >
        <CardImage code={preview} />
        <button className="primary-button" onClick={() => setPreview(null)}>
          <ArrowLeft size={18} /> Back to payment
        </button>
      </Modal>
    );
  return (
    <Modal
      key="payment"
      title={`Pay for ${p.title}`}
      className="payment-modal"
      wide
      eyebrow={`${HEROES.find((h) => h.id === s.heroId)!.name.toUpperCase()} · RESOURCE PAYMENT`}
      onClose={p.cancelable ? () => send({ type: "CANCEL" }) : undefined}
    >
      <div className="payment-steps" aria-label="Payment steps">
        <span className="active">
          <b>1</b> Choose resources
        </span>
        <ChevronRight size={14} />
        <span>
          <b>2</b> Confirm payment
        </span>
        <ChevronRight size={14} />
        <span>
          <b>3</b> Resolve action
        </span>
      </div>
      <div className="payment-workspace">
        <aside className="payment-target">
          <span className="small-label">
            {p.card ? "YOU ARE PLAYING" : "YOU ARE PAYING FOR"}
          </span>
          {subject && (
            <button
              className="payment-target-card"
              aria-label={`Read ${card(subject).name}`}
              onClick={() => setPreview(subject)}
            >
              <CardImage code={subject} />
              <span>
                <ArrowsOut size={13} /> Read card
              </span>
            </button>
          )}
          <h3>{p.title}</h3>
          <div className="payment-cost">
            <span>
              <Lightning size={19} weight="fill" /> RESOURCE COST
            </span>
            <b>{p.cost || 0}</b>
          </div>
          {!!p.requirements?.length && (
            <div className="payment-required">
              <span>Must include</span>
              <ResourceIcons items={p.requirements} />
            </div>
          )}
          <p>
            Confirm payment to play the card. Your resources and the result
            appear together in the action summary.
          </p>
        </aside>
        <section
          className="payment-pool"
          aria-label="Available resource cards"
          tabIndex={0}
        >
          <div className="payment-pool-heading">
            <div>
              <h3>Choose what to spend</h3>
              <p>
                Click a card to select it. Use <ArrowsOut size={13} /> to read
                it up close.
              </p>
            </div>
            <span>
              {sources.filter((x) => x.kind === "card").length} CARDS AVAILABLE
            </span>
          </div>
          {(["ability", "card"] as const).map((kind) => {
            const group = sources.filter((x) => x.kind === kind);
            if (!group.length) return null;
            return (
              <div
                className={`payment-source-group ${kind}-sources`}
                key={kind}
              >
                <div className="payment-group-heading">
                  {kind === "card" ? (
                    <Trash size={14} />
                  ) : (
                    <Lightning size={14} />
                  )}
                  <b>
                    {kind === "card"
                      ? p.alliance
                        ? "FROM PLAYERS’ HANDS"
                        : "FROM YOUR HAND"
                      : "RESOURCE ABILITIES"}
                  </b>
                  <span>
                    {kind === "card"
                      ? p.alliance
                        ? "Selected cards go to their owner’s discard pile"
                        : "Selected cards go to your discard pile"
                      : "Use the ability shown below each card"}
                  </span>
                </div>
                <div className="payment-sources">
                  {group.map((x) => (
                    <div className="resource-option" key={x.id}>
                      <button
                        className={`payment-source ${selected.includes(x.id) ? "selected" : ""}`}
                        aria-label={`${x.name} · ${x.resources.join(" + ")} · ${x.description}`}
                        aria-pressed={selected.includes(x.id)}
                        onClick={() => toggle(x.id)}
                      >
                        <span className="payment-art">
                          <CardImage code={x.code} />
                          <span className="resource-value">
                            <ResourceIcons items={x.resources} />
                          </span>
                          <span className="payment-mark">
                            <Check size={17} weight="bold" />
                          </span>
                        </span>
                        <span className="payment-source-caption">
                          <b>
                            {x.id === "scientist"
                              ? "Peter Parker · Scientist"
                              : x.name}
                          </b>
                          <small>{x.description}</small>
                          <span className="payment-selection-label">
                            {selected.includes(x.id)
                              ? kind === "card"
                                ? "WILL BE DISCARDED"
                                : "ABILITY SELECTED"
                              : `${x.resources.length} RESOURCE${x.resources.length === 1 ? "" : "S"}`}
                          </span>
                        </span>
                      </button>
                      <button
                        className="resource-zoom"
                        aria-label={`Read resource card ${x.name}`}
                        onClick={() => setPreview(x.code)}
                      >
                        <ArrowsOut size={16} weight="bold" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {!sources.length && (
            <p className="payment-empty">
              No resources are available for this payment.
            </p>
          )}
        </section>
      </div>
      <div className="payment-footer">
        <div
          className={`payment-summary ${status.ready ? "ready" : ""}`}
          role="status"
        >
          <span className="payment-meter">
            <strong>{status.total}</strong>
            <span>
              / {p.cost || 0}
              <small>RESOURCES</small>
            </span>
          </span>
          <span>
            <b>
              {status.total < (p.cost || 0)
                ? `Choose ${(p.cost || 0) - status.total} more resource${(p.cost || 0) - status.total === 1 ? "" : "s"}`
                : status.missing.length
                  ? `Still need ${status.missing.join(" + ")}`
                  : !status.retained
                    ? "Keep an eligible ally in hand for Sneak Attack"
                    : !status.retainedAlternative
                      ? "Keep an Avenger and a Guardian in hand for Joining Forces"
                      : !status.sourceRequirementMet
                        ? p.sourceRequirement?.label
                        : "Payment ready to confirm"}
            </b>
            <small>
              {selected.length
                ? `${discards} card${discards === 1 ? "" : "s"} to discard${abilities ? ` · ${abilities} abilit${abilities === 1 ? "y" : "ies"} to use` : ""}`
                : "Nothing selected yet. Your hand is unchanged."}
              {status.total > (p.cost || 0)
                ? ` · ${status.total - (p.cost || 0)} extra resource(s) will be spent.`
                : ""}
            </small>
          </span>
          {status.selected.some((x) => x.resources.includes("wild")) && (
            <label className="wild-label">
              Optional wild type
              <select
                value={wild}
                onChange={(e) => setWild(e.target.value as Resource)}
              >
                <option value="energy">Energy</option>
                <option value="mental">Mental</option>
                <option value="physical">Physical</option>
              </select>
            </label>
          )}
        </div>
        <div className="payment-confirm-row">
          <span>
            <ShieldCheck size={16} /> Nothing is spent until you confirm.
          </span>
          <div>
            {p.cancelable && (
              <button
                className="secondary-button"
                onClick={() => send({ type: "CANCEL" })}
              >
                Cancel
              </button>
            )}
            <button
              className="secondary-button"
              disabled={!suggestion}
              title={
                suggestion
                  ? "Select the least valuable resources that pay this cost. You can still change them."
                  : "Your available resources cannot pay this cost."
              }
              onClick={() => suggestion && setSelected(suggestion)}
            >
              <Sparkle size={15} /> Suggest resources
            </button>
            <button
              className="primary-button"
              disabled={!status.ready}
              onClick={() => send({ type: "PAY", ids: selected, wildAs: wild })}
            >
              Confirm payment <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
function Decision({
  game: s,
  send,
  inspect,
}: {
  game: GameState;
  send: (c: Command) => void;
  inspect: (c: Inspect) => void;
}) {
  const p = s.prompt!;
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  if (p.kind === "payment") return <PaymentDecision game={s} send={send} />;
  const hint = advisePrompt(s);
  return (
    <Modal
      title={p.title}
      className={`action-decision ${s.attack ? "attack-decision" : ""}`}
      eyebrow={
        s.phase === "villain"
          ? `${HEROES.find((h) => h.id === s.heroId)!.name.toUpperCase()} · YOUR RESPONSE`
          : `${HEROES.find((h) => h.id === s.heroId)!.name.toUpperCase()} · YOUR DECISION`
      }
      onClose={p.cancelable ? () => send({ type: "CANCEL" }) : undefined}
    >
      {s.phase === "villain" && (
        <VillainSteps current={p.context?.step || s.villainStep || "threat"} />
      )}
      <p className="modal-intro">{p.text}</p>
      {hint && (
        <div className="advisor-hint" role="note">
          <Lightbulb size={16} weight="fill" />
          <span>
            <b>Advisor: {hint.title}.</b> <small>{hint.reason}</small>
          </span>
          <button className="text-button" onClick={() => send(hint.command)}>
            Choose this <ArrowRight size={14} />
          </button>
        </div>
      )}
      {p.context ? (
        <ReviewDetails review={p.context} inspect={inspect} decision />
      ) : (
        <AttackParticipants attack={attackContext(s)} inspect={inspect} />
      )}
      {p.kind === "select" ? (
        <>
          <div className="decision-options">
            {p.options.map((o) => (
              <button
                key={o.id}
                className={`decision-option ${selected.includes(o.id) ? "selected" : ""}`}
                aria-pressed={selected.includes(o.id)}
                onClick={() => toggle(o.id)}
              >
                {o.image && (
                  <img
                    data-card-preview={o.image}
                    src={imageFor(o.image)}
                    alt=""
                  />
                )}
                <span>
                  <strong>{o.label}</strong>
                  <small>{o.detail}</small>
                </span>
                <span className="check-square">
                  {selected.includes(o.id) && <Check size={14} />}
                </span>
              </button>
            ))}
          </div>
          <div className="selection-footer">
            <span>
              {selected.length} selected · {p.min}–{p.max}
            </span>
            <button
              className="primary-button"
              disabled={
                selected.length < (p.min || 0) || selected.length > (p.max || 0)
              }
              onClick={() => send({ type: "SELECT", ids: selected })}
            >
              Confirm selection <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : (
        <div className="decision-options">
          {p.options.map((o) => (
            <button
              key={o.id}
              className="decision-option"
              onClick={() => send({ type: "CHOOSE", id: o.id })}
            >
              {o.image && (
                <img
                  data-card-preview={o.image}
                  src={imageFor(o.image)}
                  alt=""
                />
              )}
              <span>
                <strong>{o.label}</strong>
                {o.detail && <small>{o.detail}</small>}
              </span>
              <ArrowRight size={19} />
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
function PremiumToken({
  kind,
}: {
  kind: "health" | "threat" | "defense" | "counter";
}) {
  const Icon = {
    health: Heart,
    threat: Warning,
    defense: Shield,
    counter: Star,
  }[kind];
  return (
    <span className={`premium-token token-${kind}`} aria-hidden="true">
      {kind === "defense" ? <DefenseCrest /> : <Icon weight="fill" />}
    </span>
  );
}

function CardBack({ kind }: { kind: "hero" | "encounter" }) {
  return (
    <span
      className={`premium-card-back back-${kind}`}
      data-card-preview={`back:${kind}`}
      aria-hidden="true"
    >
      <span className="card-back-mark">MARVEL</span>
    </span>
  );
}

function TableStylePicker({
  selected,
  heroId,
  onSelect,
  onClose,
}: {
  selected: PlaymatPreference;
  heroId: string;
  onSelect: (id: PlaymatPreference) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="Make the table yours."
      eyebrow="YOUR PLAY AREA"
      className="table-style-modal"
      wide
      onClose={onClose}
    >
      <p className="table-style-intro">
        A home for every hero. Follow your team, or keep a favorite on the
        table.
      </p>
      <button
        className={`playmat-auto ${selected === "match-hero" ? "selected" : ""}`}
        aria-pressed={selected === "match-hero"}
        onClick={() => onSelect("match-hero")}
      >
        <span className="playmat-auto-emblem">
          <HeroEmblem heroId={heroId} />
        </span>
        <span>
          <strong>Match your hero</strong>
          <small>
            Follows the play area you’re viewing · {playmatForHero(heroId).name}
          </small>
        </span>
        {selected === "match-hero" ? (
          <CheckCircle size={24} weight="fill" />
        ) : (
          <ArrowsClockwise size={24} />
        )}
      </button>
      <div
        className="playmat-options"
        role="group"
        aria-label="Choose a playmat"
      >
        {[
          ...PLAYMATS.filter((mat) => mat.heroId),
          ...PLAYMATS.filter((mat) => !mat.heroId),
        ].map((mat) => (
          <button
            key={mat.id}
            className={`playmat-option ${selected === mat.id ? "selected" : ""}`}
            aria-pressed={selected === mat.id}
            onClick={() => onSelect(mat.id)}
          >
            <span className="playmat-option-art">
              <img src={mat.image} alt="" width={640} height={360} />
              <span className="playmat-edition">{mat.hero}</span>
              {selected === mat.id && <CheckCircle size={23} weight="fill" />}
            </span>
            <span className="playmat-option-copy">
              <strong>{mat.name}</strong>
              <small>{mat.detail}</small>
              {mat.heroId === heroId && (
                <span className="playmat-match">YOUR HERO’S PLAYMAT</span>
              )}
            </span>
          </button>
        ))}
      </div>
      <div className="table-accessories">
        <div className="sleeve-collection">
          <div className="sleeve-pair" aria-hidden="true">
            <CardBack kind="hero" />
            <CardBack kind="encounter" />
          </div>
          <div>
            <span className="accessory-eyebrow">PLAYER & ENCOUNTER DECKS</span>
            <h3>Two sides. One battle.</h3>
            <p>Blue for your heroes. Orange for the encounter deck.</p>
          </div>
        </div>
        <div className="token-collection">
          <span className="accessory-eyebrow">TOKENS & COUNTERS</span>
          <h3>Every point matters.</h3>
          <div className="token-collection-row">
            {(
              [
                ["health", "Health"],
                ["threat", "Threat"],
                ["defense", "Defense"],
                ["counter", "Counters"],
              ] as const
            ).map(([kind, label]) => (
              <span key={kind}>
                <PremiumToken kind={kind} />
                <small>{label}</small>
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="table-style-footer">
        <span>
          <Check size={14} /> Your table, remembered on this device.
        </span>
        <button className="primary-button" onClick={onClose}>
          Back to the game <ArrowRight size={17} />
        </button>
      </div>
    </Modal>
  );
}

function StatToken({
  kind,
  value,
  max,
  label,
  compact = false,
}: {
  kind: "health" | "threat" | "attack" | "defense" | "counter";
  value: number;
  max?: number;
  label: string;
  compact?: boolean;
}) {
  const Icon =
    kind === "health"
      ? Heart
      : kind === "attack"
        ? Fist
        : kind === "defense"
          ? Shield
          : Target;
  return (
    <div
      className={`stat-token ${kind} ${compact ? "compact" : ""}`}
      aria-label={`${label}: ${value}${max !== undefined ? ` of ${max}` : ""}`}
    >
      <span className="token-emblem" aria-hidden="true">
        {kind === "attack" ? (
          <Icon size={compact ? 15 : 22} weight="fill" />
        ) : (
          <PremiumToken kind={kind} />
        )}
      </span>
      <span className="token-value">
        <strong>{value}</strong>
        {max !== undefined && <small>/ {max}</small>}
      </span>
      <span className="token-label">{label}</span>
    </div>
  );
}
function AttackParticipants({
  attack,
  inspect,
}: {
  attack?: ActionReview["attack"];
  inspect?: (c: Inspect) => void;
}) {
  if (!attack) return null;
  return (
    <div className="attack-participants" aria-label="Current attack">
      {[attack.attacker, attack.target].map((participant, i) => (
        <div
          className={`attack-participant ${i ? "attack-target" : "attack-enemy"}`}
          key={i}
        >
          <small>{i ? attack.label : "ATTACKER"}</small>
          {inspect ? (
            <button
              aria-label={`Inspect ${participant.name} · ${i ? "attack target" : "attacker"}`}
              onClick={() => inspect({ code: participant.code })}
            >
              <CardImage code={participant.code} />
            </button>
          ) : (
            <CardImage code={participant.code} />
          )}
          <b>{participant.name}</b>
          {i === 1 && attack.target.code !== attack.identity.code && (
            <span>Protecting {attack.identity.name}</span>
          )}
        </div>
      ))}
      <ArrowRight className="attack-direction" size={22} aria-hidden="true" />
    </div>
  );
}
function ReviewDetails({
  review,
  inspect,
  decision = false,
}: {
  review: ActionReview;
  decision?: boolean;
  inspect: (c: Inspect) => void;
}) {
  const participantSource =
    !!review.attack &&
    [review.attack.attacker.code, review.attack.target.code].includes(
      review.source || "",
    );
  // The headline belongs to the card shown beside it: a merged step may open with
  // another card's line (the hero readying before the villain places threat).
  const headline = participantSource
    ? -1
    : Math.max(
        0,
        review.source
          ? review.messages.findIndex((m) =>
              m.includes(card(review.source!).name),
            )
          : -1,
      );
  const messages = review.messages.filter((_, i) => i !== headline);
  return (
    <div
      className={`review-details ${review.cards?.length ? "has-cards" : ""} ${review.cards?.length === 1 ? "one-card" : ""} ${review.attack ? "attack-review" : ""}`}
    >
      {review.attack && (
        <div className="review-combat">
          <AttackParticipants attack={review.attack} inspect={inspect} />
          {messages.length > 0 && (
            <ul className="review-messages">
              {messages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="review-explanation">
        {!decision && (
          <div className="resolution-paused" role="status">
            <CheckCircle size={14} />{" "}
            {review.calculation?.label.startsWith("Incoming")
              ? "Review before resolving"
              : "Action summary"}
          </div>
        )}
        {review.source && !participantSource && (
          <div className="review-source">
            <button
              className="review-source-image"
              aria-label={`Read action card ${card(review.source).name}`}
              onClick={() => inspect({ code: review.source! })}
            >
              <img
                data-card-preview={review.source}
                src={imageFor(review.source)}
                alt={card(review.source).name}
              />
              <ArrowsOut size={13} />
            </button>
            <span>
              <small>IN THIS ACTION</small>
              <b>{card(review.source).name}</b>
              <span>
                {review.messages[headline] ||
                  "The table has updated. Review the changes below."}
              </span>
            </span>
          </div>
        )}
        {!review.attack && messages.length > 0 && (
          <ul className="review-messages">
            {messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        )}
        {review.payment && (
          <div className="review-payment">
            <Lightning size={22} weight="fill" />
            <span>
              <b>
                {review.payment.total} / {review.payment.cost} resources paid
              </b>
              <small>Payment confirmed · included in this action.</small>
            </span>
          </div>
        )}
        {review.calculation && (
          <div className="review-calculation">
            <div className="calculation-heading">
              <span>{review.calculation.label}</span>
              <b>
                {review.calculation.total}
                <small>
                  {(review.calculation.unit || "damage").toUpperCase()}
                </small>
              </b>
            </div>
            <div className="calculation-parts">
              {review.calculation.parts.map((part, i) => (
                <span key={part.label}>
                  <b>
                    {i === 1 ? "+" : ""}
                    {part.value}
                  </b>
                  <small>{part.label}</small>
                </span>
              ))}
            </div>
            <p>{review.calculation.note}</p>
          </div>
        )}
        {review.changes.length > 0 && (
          <div className="review-changes">
            <div className="change-heading">
              <span>WHAT CHANGED</span>
              <span>BEFORE → AFTER</span>
            </div>
            {review.changes.map((c, i) => {
              const Icon =
                c.kind === "health"
                  ? Heart
                  : c.kind === "threat"
                    ? Target
                    : c.kind === "cards"
                      ? Cards
                      : ArrowsClockwise;
              return (
                <div className={`change-row ${c.kind}`} key={i}>
                  <Icon size={16} />
                  <span>{c.label}</span>
                  <div>
                    <del>{c.before}</del>
                    <ArrowRight size={12} />
                    <b>{c.after}</b>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {!!review.cards?.length && (
        <div className="review-card-section">
          <div className="change-heading">
            <span>RELATED CARDS</span>
            <span>
              {review.cards.length}{" "}
              {review.cards.length === 1 ? "CARD" : "CARDS"}
            </span>
          </div>
          <div className="review-cards">
            {review.cards.map((c) => (
              <div className={`review-card ${c.kind}`} key={c.id}>
                {c.code ? (
                  <button
                    aria-label={`Read ${c.name} · ${c.label}`}
                    onClick={() => inspect({ code: c.code! })}
                  >
                    <CardImage code={c.code} />
                    <span className="review-card-zoom">
                      <ArrowsOut size={13} />
                    </span>
                  </button>
                ) : (
                  <div className="review-card-back">
                    <CardBack kind="encounter" />
                    <span>FACE DOWN</span>
                  </div>
                )}
                <span className="review-card-label">{c.label}</span>
                <b>{c.name}</b>
                {c.resources && <ResourceIcons items={c.resources} />}
                <small>{c.detail}</small>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function ActionDirector({
  game: s,
  send,
  inspect,
  pacing,
  onPacing,
  onEnd,
}: {
  game: GameState;
  send: (c: Command) => void;
  inspect: (c: Inspect) => void;
  pacing: Pacing;
  onPacing: (pacing: Pacing) => void;
  onEnd: () => void;
}) {
  const review = s.review;
  const button = useRef<HTMLButtonElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const director = useRef<HTMLElement>(null);
  const [collapsedId, setCollapsedId] = useState<number | null>(null);
  const [timelineOpen, setTimelineOpen] = useState<ActionReview | null>(null);
  const timeline = (s.timeline || []).slice(-5).reverse();
  const [suggestion, setSuggestion] = useState<Advice | null>(null);
  const [thinking, setThinking] = useState(false);
  const thought = useRef<ReturnType<typeof setTimeout> | null>(null);
  const advisorState = useRef(s);
  advisorState.current = s;
  const canAct =
    s.phase === "player" &&
    !s.prompt &&
    !s.review &&
    s.activePlayerId === s.turnPlayerId;
  useEffect(() => {
    setSuggestion(null);
    setThinking(false);
    if (thought.current) clearTimeout(thought.current);
    return () => {
      if (thought.current) clearTimeout(thought.current);
    };
  }, [s]);
  const think = () => {
    setThinking(true);
    // Let the button repaint before the planner runs its rollouts.
    thought.current = setTimeout(() => {
      if (advisorState.current !== s) return;
      const advice = planAction(s, { rollouts: 3 }) || {
        command: { type: "END_TURN" } as Command,
        title: "End the hero phase",
        reason:
          "Nothing left in hand or in play is clearly better than ending the turn now.",
      };
      setSuggestion(advice);
      setThinking(false);
    }, 30);
  };
  const focused = !!review && collapsedId !== review.id;
  const next = s.prompt
    ? s.prompt.title
    : s.phase === "mulligan"
      ? "The next opening hand"
      : ["won", "lost"].includes(s.phase)
        ? "Mission results"
        : effectTitle(s.queue[0]);
  useEffect(() => {
    const resize = () => {
      const node = director.current;
      if (node)
        node.style.setProperty(
          "--director-height",
          `${Math.max(280, innerHeight - Math.max(18, node.getBoundingClientRect().top) - 18)}px`,
        );
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("scroll", resize, { passive: true });
    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", resize);
    };
  }, [review?.id]);
  useEffect(() => {
    if (review)
      (focused ? focusButton : button).current?.focus({ preventScroll: true });
  }, [review?.id, focused]);
  const activeHero = HEROES.find((h) => h.id === s.heroId)!;
  // The new-round step closes the villain phase even though the table has moved on.
  const villainPhase = s.phase === "villain" || !!review?.step;
  const waiting =
    s.phase === "mulligan"
      ? "Confirm your opening hand"
      : s.prompt
        ? "A decision needs you"
        : ["won", "lost"].includes(s.phase)
          ? "Mission complete"
          : `Your move, ${activeHero.name}.`;
  return (
    <>
      <section
        ref={director}
        aria-hidden={focused || undefined}
        className={`action-director ${review ? "has-review" : ""}`}
        aria-label="Action resolution"
      >
        <div className="director-top">
          <span>
            <Eye size={17} />
            ACTION RESOLUTION
          </span>
          <div className="director-tools">
            <TempoMenu value={pacing} onChange={onPacing} />
          </div>
        </div>
        <div
          className="director-body"
          key={review?.id || "idle"}
          tabIndex={0}
          role="region"
          aria-label="Current action details"
        >
          <div className="director-actor">
            <span className={`resolution-dot ${villainPhase ? "enemy" : ""}`} />
            {review?.actor || activeHero.name}
            {review && <b>{`STEP ${String(review.id).padStart(2, "0")}`}</b>}
            <small>{villainPhase ? "VILLAIN PHASE" : "HERO PHASE"}</small>
          </div>
          {villainPhase && (
            <VillainSteps
              compact
              current={review?.step || s.villainStep || "threat"}
            />
          )}
          <h2>{review?.title || waiting}</h2>
          {review ? (
            focused ? (
              <p className="director-idle">
                Read the current action in the focus window. The mission is
                paused until you click Proceed.
              </p>
            ) : (
              <ReviewDetails review={review} inspect={inspect} />
            )
          ) : (
            <div className="director-idle">
              <ShieldCheck size={34} weight="duotone" />
              <p>
                {pacing === "guided"
                  ? "Play a card, use an ability, or change form. Every resolved action will appear here."
                  : "Play a card, use an ability, or change form. Steps that need no pause are listed below as recent steps."}
              </p>
              <span>
                <CheckCircle size={14} />
                No timers. You control the pace.
              </span>
              {suggestion && (
                <div className="advisor-box">
                  <span className="advisor-title">
                    <Lightbulb size={15} weight="fill" /> {suggestion.title}
                  </span>
                  <p>{suggestion.reason}</p>
                </div>
              )}
              {timeline.length > 0 && (
                <div className="director-timeline">
                  <div className="change-heading">
                    <span>
                      <ClockCounterClockwise size={13} /> RECENT STEPS
                    </span>
                    <span>NO PAUSE NEEDED</span>
                  </div>
                  {timeline.map((entry) => (
                    <button
                      key={entry.id}
                      className="timeline-item"
                      onClick={() => setTimelineOpen(entry)}
                    >
                      <b>{entry.title}</b>
                      <small>{timelineSummary(entry)}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="director-footer">
          {review ? (
            <>
              <button
                className="review-expand"
                onClick={() => setCollapsedId(null)}
              >
                <ArrowsOut size={14} /> Open action details
              </button>
              <div className="next-step">
                <small>UP NEXT</small>
                <span>{next}</span>
              </div>
              <button
                ref={button}
                data-proceed
                className="primary-button proceed-button"
                onClick={() => send({ type: "PROCEED" })}
              >
                Proceed <ArrowRight size={21} />
              </button>
              <span className="pace-note">
                Continue only when you’re ready.
              </span>
            </>
          ) : (
            <>
              <div className="director-advisor-controls">
                {suggestion ? (
                  <div className="advisor-actions">
                    <button
                      className="primary-button"
                      disabled={!canAct}
                      onClick={() => {
                        if (suggestion.command.type === "END_TURN") onEnd();
                        else send(suggestion.command);
                        setSuggestion(null);
                      }}
                    >
                      Do it <ArrowRight size={16} />
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setSuggestion(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                ) : (
                  <button
                    className="secondary-button advisor-button"
                    disabled={thinking || !canAct}
                    title="The advisor plays the round out on a copy of the table with the hidden cards reshuffled, then suggests the move that scored best."
                    onClick={think}
                  >
                    <Lightbulb size={15} weight="fill" />{" "}
                    {thinking ? "Thinking…" : "Suggest a move"}
                  </button>
                )}
              </div>
              <span className="pace-note">
                <ShieldCheck size={14} /> Every step is saved automatically.
              </span>
            </>
          )}
        </div>
      </section>
      {timelineOpen && (
        <Modal
          key={`timeline-${timelineOpen.id}`}
          title={timelineOpen.title}
          wide={!!timelineOpen.cards?.length}
          className={`review-focus ${timelineOpen.cards?.length ? "with-cards" : ""} ${timelineOpen.attack ? "with-attack" : ""}`}
          eyebrow={`RECENT STEP ${String(timelineOpen.id).padStart(2, "0")} · ${timelineOpen.actor.toUpperCase()} · ALREADY RESOLVED`}
          onClose={() => setTimelineOpen(null)}
        >
          <div
            className="review-focus-body"
            tabIndex={0}
            role="region"
            aria-label="Resolved step details and cards"
          >
            <ReviewDetails
              review={timelineOpen}
              inspect={(c) => {
                setTimelineOpen(null);
                inspect(c);
              }}
            />
          </div>
          <div className="review-focus-footer">
            <div className="next-step">
              <small>THIS STEP</small>
              <span>Already resolved · nothing to confirm</span>
            </div>
            <div>
              <button
                className="primary-button"
                onClick={() => setTimelineOpen(null)}
              >
                Back to the table
              </button>
            </div>
          </div>
        </Modal>
      )}
      {focused && review && (
        // One window stays open across consecutive steps so each Proceed
        // swaps the content instead of re-opening the dialog.
        <Modal
          key="review-focus"
          title={review.title}
          wide={!!review.cards?.length}
          className={`review-focus ${review.cards?.length ? "with-cards" : ""} ${review.attack ? "with-attack" : ""} ${review.step ? "villain-step" : ""}`}
          eyebrow={`STEP ${String(review.id).padStart(2, "0")} · ${review.actor.toUpperCase()} · ${review.phase === "villain" || review.step ? "VILLAIN PHASE" : "HERO PHASE"}`}
          onClose={() => setCollapsedId(review.id)}
        >
          {review.step && <VillainSteps current={review.step} />}
          <div
            className="review-focus-body"
            key={review.id}
            tabIndex={0}
            role="region"
            aria-label="Action details and cards"
          >
            <ReviewDetails
              review={review}
              inspect={(c) => {
                setCollapsedId(review.id);
                inspect(c);
              }}
            />
          </div>
          <div className="review-focus-footer">
            <div className="next-step">
              <small>ON YOUR NEXT CLICK</small>
              <span>{next}</span>
            </div>
            <div>
              <button
                className="secondary-button"
                onClick={() => setCollapsedId(review.id)}
              >
                View table
              </button>
              <button
                ref={focusButton}
                data-proceed
                className="primary-button"
                onClick={() => send({ type: "PROCEED" })}
              >
                Proceed <ArrowRight size={20} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
// Physical components keep public cards face up and hidden decks face down.
function HealthDial({
  value,
  max,
  label,
  villain = false,
}: {
  value: number;
  max: number;
  label: string;
  villain?: boolean;
}) {
  return (
    <div
      className={`health-dial ${villain ? "villain-dial" : "hero-dial"} ${value <= max * 0.25 ? "low" : ""}`}
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.max(0, value)}
    >
      <PremiumToken kind="health" />
      <strong>{String(Math.max(0, value)).padStart(2, "0")}</strong>
      <span>
        <b>HP</b>
        <small>/ {max}</small>
      </span>
    </div>
  );
}
function TablePile({
  kind,
  count,
  top,
  onOpen,
  label,
}: {
  kind: "hero" | "encounter" | "discard";
  count: number;
  top?: Piece;
  onOpen?: () => void;
  label: string;
}) {
  const face = (
    <>
      <span className={`pile-face ${count ? "has-cards" : "empty-pile"}`}>
        {top ? (
          <CardImage code={top.code} />
        ) : kind === "discard" ? (
          <Trash size={23} weight="thin" />
        ) : count === 0 ? (
          <Stack size={23} weight="thin" />
        ) : (
          <CardBack kind={kind} />
        )}
        <b className="pile-count">{count}</b>
      </span>
      <span className="table-pile-label">
        {label}
        {onOpen && <Eye size={11} />}
      </span>
    </>
  );
  return onOpen ? (
    <button
      className={`table-pile ${kind}-pile`}
      onClick={onOpen}
      aria-label={`${label}, ${count} cards. Inspect pile`}
    >
      {face}
    </button>
  ) : (
    <div
      className={`table-pile ${kind}-pile`}
      aria-label={`${label}, ${count} cards${count ? ", face down" : ", empty"}`}
    >
      {face}
    </div>
  );
}
function AttachedCards({
  game,
  host,
  inspect,
  send,
}: {
  game: GameState;
  host: Piece;
  inspect: (c: Inspect) => void;
  send?: (c: Command) => void;
}) {
  const attachments = attachmentsFor(game, host.id);
  if (!attachments.length) return null;
  return (
    <div
      className="attached-cards"
      aria-label={`Attached to ${card(host).name}`}
    >
      <span className="attachment-connection">
        ATTACHED · {attachments.length}
      </span>
      <div className="attached-card-list">
        {attachments.map((p) => (
          <div className="attached-piece" key={p.id}>
            <button
              className="attached-card"
              onClick={() => inspect({ code: p.code, piece: p })}
              aria-label={`Inspect ${card(p).name}, attached to ${card(host).name}`}
            >
              <CardImage code={p.code} />
              <span>{card(p).name}</span>
            </button>
            {game.playerCount > 1 && p.ownerId && (
              <small>
                {
                  HEROES.find(
                    (h) =>
                      h.id ===
                      game.players.find((seat) => seat.id === p.ownerId)
                        ?.heroId,
                  )?.name
                }
              </small>
            )}
            {[
              "01100",
              "01118",
              "01119",
              "01141",
              "01142",
              "01152",
              "01153",
            ].includes(p.code) && (
              <button
                className="text-button"
                disabled={!send || game.player.form !== "hero"}
                onClick={() => send?.({ type: "ABILITY", id: p.id })}
              >
                Remove
              </button>
            )}
            {[
              ...mutagenAttachmentActions(game, p),
              ...goblinModuleAttachmentActions(game, p),
              ...(p.code === "25032" ? abilityOptions(game, p) : []),
            ].map((a) => (
              <button
                key={a.id}
                className="text-button"
                disabled={!send}
                onClick={() =>
                  send?.({ type: "ABILITY", id: p.id, action: a.id })
                }
              >
                {a.label}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
function Tabletop({
  game,
  saveLabel,
  send,
  inspect,
  logOpen,
  onEnd,
  onHome,
  onHelp,
  pacing,
  onPacing,
  canUndo,
  onUndo,
  coach,
}: {
  game: GameState;
  saveLabel: string;
  send: (c: Command) => void;
  inspect: (c: Inspect) => void;
  logOpen: boolean;
  onEnd: () => void;
  onHome: () => void;
  onHelp: () => void;
  pacing: Pacing;
  onPacing: (pacing: Pacing) => void;
  canUndo: boolean;
  onUndo: () => void;
  coach?: ReactNode;
}) {
  const [viewId, setViewId] = useState(game.activePlayerId);
  const [playmatId, setPlaymatId] = useState(readPlaymat);
  const [tableStyleOpen, setTableStyleOpen] = useState(false);
  const selectPlaymat = (id: PlaymatPreference) => {
    setPlaymatId(id);
    try {
      localStorage.setItem(TABLE_STYLE_KEY, id);
    } catch {
      // A blocked storage API must not prevent table customization or play.
    }
  };
  const s = seatView(
    game,
    game.players.some((p) => p.id === viewId) ? viewId : game.activePlayerId,
  );
  useEffect(() => {
    setViewId(game.activePlayerId);
    setHandFilter("all");
  }, [game.activePlayerId, game.review?.id]);
  const h = HEROES.find((h) => h.id === s.heroId)!;
  const playmat =
    playmatId === "match-hero"
      ? playmatForHero(s.heroId)
      : PLAYMATS.find((mat) => mat.id === playmatId)!;
  const v = VILLAINS.find((v) => v.id === s.villainId)!;
  const stats = heroStats(s);
  const acting =
    s.phase === "player" &&
    !s.prompt &&
    !s.review &&
    game.activePlayerId === s.activePlayerId &&
    s.turnPlayerId === s.activePlayerId &&
    !game.players.find((p) => p.id === s.activePlayerId)!.eliminated;
  const canUseAction =
    game.phase === "player" &&
    !game.review &&
    !game.prompt &&
    !game.players.find((p) => p.id === s.activePlayerId)!.eliminated;
  const sendAction = (c: Command) =>
    send(
      c.type === "PLAY" || c.type === "ABILITY"
        ? { ...c, playerId: s.activePlayerId }
        : c,
    );
  const [handFilter, setHandFilter] = useState<"all" | "playable">("all");
  const [resourceHelp, setResourceHelp] = useState(false);
  const combat = attackContext(game);
  const playableHand = s.player.hand.filter((p) => !playable(s, p));
  const visibleHand = handFilter === "playable" ? playableHand : s.player.hand;
  const threatLimit = schemeLimit(s);
  const threatCritical = s.scheme.threat >= threatLimit - 2;
  const [pile, setPile] = useState<{ title: string; cards: Piece[] } | null>(
    null,
  );
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [s.log.length]);
  useEffect(() => {
    // Warm the browser cache for the cards this hero is about to look at.
    const codes = new Set([
      s.villain.code,
      s.scheme.code,
      ...s.player.hand.map((p) => p.code),
      ...s.player.inPlay.map((p) => p.code),
      ...s.minions.map((p) => p.code),
      ...s.sideSchemes.map((p) => p.code),
      ...(s.environments || []).map((p) => p.code),
    ]);
    for (const code of codes) {
      const img = new Image();
      img.decoding = "async";
      img.src = imageFor(code);
    }
  }, [s.round, s.activePlayerId, s.player.hand.length]);
  const importedIdentityAbility = [
    ...nativeHeroAbilityOptions(s),
    ...doctorStrangeAbilityOptions(s, "identity"),
    ...thorAbilityOptions(s, "identity"),
    ...msMarvelAbilityOptions(s, "identity"),
  ][0];
  const visibleInvocation = doctorStrangeTopInvocation(s);
  const spellUnavailable =
    importedIdentityAbility?.id === "spell" &&
    (!visibleInvocation ||
      !canPay(
        s,
        card(visibleInvocation).cost || 0,
        [],
        undefined,
        visibleInvocation.code,
      ));
  const abilityActive =
    !!importedIdentityAbility ||
    captainAbilityOptions(s, "identity").length > 0 ||
    hulkAbilityOptions(s, "identity").length > 0 ||
    (s.player.form === "alter" &&
      ((s.heroId === "iron_man" && !s.flags.futurist) ||
        (s.heroId === "captain_marvel" && !s.flags.commander))) ||
    (s.player.form === "hero" &&
      s.heroId === "captain_marvel" &&
      !s.flags.rechannel &&
      s.player.hp < maxHP(s));
  return (
    <main id="main-content" className="tabletop physical-table">
      <div className="tabletop-top">
        <button className="back-button" onClick={onHome}>
          <ArrowLeft size={16} /> Mission control
        </button>
        <div className="round-tracker">
          <span className="round-number">
            ROUND <b>{String(s.round).padStart(2, "0")}</b>
          </span>
          <span
            className={
              s.phase === "player" || s.phase === "mulligan" ? "current" : ""
            }
          >
            <User size={14} /> Hero phase
          </span>
          <ChevronRight size={12} />
          <span className={s.phase === "villain" ? "current" : ""}>
            <Skull size={14} /> Villain phase
          </span>
        </div>
        <span className="table-game-meta">
          {s.difficulty} <span>·</span>{" "}
          {MODULES.find((m) => m.id === s.module)?.name}
          {s.heroic ? (
            <>
              {" "}
              <span>·</span> Heroic {s.heroic}
            </>
          ) : null}
          {s.startSeed ? (
            <>
              {" "}
              <span>·</span>{" "}
              <span title="Mission seed: replay it from the result screen or the lobby">
                #{s.startSeed}
              </span>
            </>
          ) : null}
        </span>
      </div>
      <div
        className={`table-heading ${game.playerCount === 1 ? "solo-heading" : ""}`}
      >
        <div className="mission-brief">
          <div>
            <span className="small-label">
              {v.location} · MISSION IN PROGRESS
            </span>
            <h1>
              {s.playerCount > 1 ? "The team" : h.name} <span>vs.</span>{" "}
              {v.name}
            </h1>
          </div>
          <div className="mission-objectives">
            <span>
              <Crosshair size={18} />
              <b>Defeat stage {s.difficulty === "expert" ? "III" : "II"}</b>
            </span>
            <span className={threatCritical ? "danger" : ""}>
              <Target size={18} />
              <b>Keep threat below {threatLimit}</b>
            </span>
          </div>
        </div>
        <div
          className={`team-strip ${game.playerCount === 1 ? "solo-strip" : ""}`}
          aria-label="Hero team"
        >
          {game.players.map((seat) => {
            const view = seatView(game, seat),
              h = HEROES.find((h) => h.id === seat.heroId)!;
            const current = seat.id === game.activePlayerId;
            return (
              <button
                key={seat.id}
                className={`team-seat ${current ? "acting" : ""} ${seat.id === viewId ? "viewing" : ""} ${seat.eliminated ? "eliminated" : ""}`}
                style={aspectStyle(h.color)}
                aria-pressed={seat.id === viewId}
                onClick={() => {
                  setViewId(seat.id);
                  setHandFilter("all");
                }}
                aria-label={`View ${h.name}${current ? ", active hero" : ""}`}
              >
                <img data-card-preview={h.code} src={imageFor(h.code)} alt="" />
                <div className="team-seat-copy">
                  <span className="team-seat-state">
                    {seat.eliminated
                      ? "DEFEATED"
                      : current
                        ? s.phase === "villain"
                          ? "RESOLVING"
                          : "ACTIVE HERO"
                        : seat.ended && s.phase === "player"
                          ? "TURN COMPLETE"
                          : "TEAMMATE"}
                    {seat.id === s.firstPlayerId && (
                      <span
                        className="first-player-token"
                        title="First player this round"
                      >
                        <span className="first-player-mark" aria-hidden="true">
                          !!!
                        </span>
                        1ST
                      </span>
                    )}
                  </span>
                  <strong>{h.name}</strong>
                  <span className="seat-vitals">
                    <span>
                      <Heart size={13} weight="fill" />
                      {view.player.hp}
                      <small>/{maxHP(view)}</small>
                    </span>
                    <span>
                      <Cards size={13} />
                      {view.player.hand.length}
                    </span>
                    <small>
                      {view.player.form === "hero" ? "Hero" : "Alter-ego"} ·{" "}
                      {view.player.exhausted ? "Exhausted" : "Ready"}
                    </small>
                  </span>
                  <div className="seat-health-bar">
                    <i
                      style={{
                        width: `${(Math.max(0, view.player.hp) / maxHP(view)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
          {game.playerCount === 1 && (
            <div className="team-strip-note">
              <span className="table-mode-label">
                <Cards size={17} /> TABLETOP VIEW
              </span>
              <span>
                <b>A seat at the table.</b>
                <small>Click any face-up card to take a closer look.</small>
              </span>
            </div>
          )}
        </div>
      </div>
      {s.activePlayerId !== game.activePlayerId && (
        <div className="viewing-banner">
          <Eye size={17} />
          <span>
            Viewing {h.name}’s cards.{" "}
            {HEROES.find((h) => h.id === game.heroId)!.name} is resolving the
            current action.
          </span>
          <button onClick={() => setViewId(game.activePlayerId)}>
            Return to active hero <ArrowRight size={15} />
          </button>
        </div>
      )}
      <div className="table-layout with-director">
        <div
          className="playmat illustrated-playmat"
          data-playmat={playmat.id}
          style={
            {
              "--playmat-art": `url("${playmat.image}")`,
              "--playmat-accent": playmat.accent,
            } as CSSProperties
          }
        >
          <div className="table-finish-bar">
            <span className="table-finish-name">
              <span className="table-finish-dot" />
              {playmat.name}
              <small>PLAYMAT</small>
            </span>
            <button
              className="table-customize-button"
              onClick={() => setTableStyleOpen(true)}
            >
              <Palette size={15} /> Customize table
            </button>
          </div>
          <div className="table-play-area">
            <div className="zone-label">
              <span>
                <Skull size={17} weight="fill" /> VILLAIN PLAY AREA
              </span>
              <span>
                {s.playerCount} {s.playerCount === 1 ? "HERO" : "HEROES"} ·
                SHARED PLAY AREA
              </span>
            </div>
            <section className="opposition">
              <div className="villain-area">
                <div className="host-card-stack">
                  <button
                    className="table-card villain-card"
                    onClick={() => inspect({ code: s.villain.code })}
                  >
                    <CardImage code={s.villain.code} />
                    <span className="inspect-hint">
                      <Eye size={13} /> Inspect
                    </span>
                  </button>
                  <AttachedCards
                    game={s}
                    host={s.villain}
                    inspect={inspect}
                    send={canUseAction ? sendAction : undefined}
                  />
                </div>
                <div className="villain-info">
                  <span className="small-label">
                    VILLAIN · STAGE {["", "I", "II", "III"][s.villain.stage]}
                  </span>
                  <h2>{card(s.villain).name.toUpperCase()}</h2>
                  <HealthDial
                    value={s.villain.hp}
                    max={s.villain.maxHp}
                    label="Villain HP"
                    villain
                  />
                  <div className="enemy-stats stat-row">
                    <StatToken
                      kind="attack"
                      value={
                        riskyBlankPower(s, "attack", s.villain.id)
                          ? 0
                          : (card(s.villain).attack || 0) +
                            s.attachments
                              .filter((p) => p.attachedTo === s.villain.id)
                              .reduce((n, p) => n + (card(p).attack || 0), 0)
                      }
                      label="ATK"
                      compact
                    />
                    <StatToken
                      kind="threat"
                      value={
                        riskyBlankPower(s, "scheme", s.villain.id)
                          ? 0
                          : (card(s.villain).scheme || 0) +
                            s.attachments
                              .filter((p) => p.attachedTo === s.villain.id)
                              .reduce((n, p) => n + (card(p).scheme || 0), 0)
                      }
                      label="SCH"
                      compact
                    />
                  </div>
                  <span className="stat-caption">
                    Before boosts & triggered abilities
                  </span>
                  <Status piece={s.villain} />
                </div>
              </div>
              <div className="scheme-area">
                <div
                  className={`main-scheme ${threatCritical ? "critical" : ""}`}
                >
                  <div className="scheme-heading">
                    <span className="small-label">MAIN SCHEME</span>
                    <span className="scheme-stage">{s.scheme.index + 1}B</span>
                  </div>
                  <button
                    onClick={() => inspect({ code: s.scheme.code })}
                    className="scheme-card"
                  >
                    <CardImage code={s.scheme.code} />
                  </button>
                  <AttachedCards
                    game={s}
                    host={{
                      ...s.villain,
                      id: `main:${s.scheme.code}`,
                      code: s.scheme.code,
                    }}
                    inspect={inspect}
                  />
                  <StatToken
                    kind="threat"
                    value={s.scheme.threat}
                    max={threatLimit}
                    label="Main scheme threat"
                  />
                  <div className="threat-track">
                    {Array.from({ length: threatLimit }, (_, i) => (
                      <i
                        className={i < s.scheme.threat ? "filled" : ""}
                        key={i}
                      />
                    ))}
                  </div>
                  <p>
                    +
                    {escalation(s) +
                      s.encounter.acceleration +
                      s.sideSchemes.reduce(
                        (n, p) =>
                          n +
                          (card(p).scheme_acceleration || 0) +
                          (p.accelerationTokens || 0),
                        0,
                      )}{" "}
                    threat each villain phase
                  </p>
                  {threatCritical && (
                    <span className="threat-warning">
                      <Warning size={15} weight="fill" /> Threat is critical
                    </span>
                  )}
                </div>
                {(s.environments || []).map((p) => (
                  <div className="scenario-environment" key={p.id}>
                    <button
                      className="environment-card"
                      onClick={() => inspect({ code: p.code, piece: p })}
                      aria-label={`Inspect ${card(p).name}`}
                    >
                      <CardImage code={p.code} />
                    </button>
                    <div>
                      <span className="small-label">ENVIRONMENT</span>
                      <strong>{card(p).name}</strong>
                      <span className="environment-counter">
                        <PremiumToken kind="counter" />
                        {p.counters}{" "}
                        {p.code === "02006a" ? "Infamy" : "Madness"}
                      </span>
                    </div>
                  </div>
                ))}
                {s.sideSchemes.map((p) => (
                  <div className="table-side-scheme" key={p.id}>
                    <span className="table-group-label">SIDE SCHEME</span>
                    <button
                      className="scheme-card"
                      onClick={() => inspect({ code: p.code, piece: p })}
                      aria-label={`Inspect ${card(p).name}`}
                    >
                      <CardImage code={p.code} />
                    </button>
                    <div className="side-scheme-counter">
                      <span className="threat-chip">
                        <PremiumToken kind="threat" />
                        <b>{p.counters}</b>
                      </span>
                      <span>
                        {card(p).scheme_crisis
                          ? "CRISIS"
                          : card(p).scheme_hazard
                            ? "HAZARD"
                            : card(p).scheme_acceleration
                              ? "ACCELERATION"
                              : "THREAT"}
                      </span>
                      {(p.accelerationTokens || 0) > 0 && (
                        <span>Acceleration tokens: {p.accelerationTokens}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="encounter-zone">
                <span className="table-group-label">ENCOUNTER DECK</span>
                <div className="table-piles">
                  <TablePile
                    kind="encounter"
                    count={s.encounter.deck.length}
                    label="Draw pile"
                  />
                  <TablePile
                    kind="discard"
                    count={s.encounter.discard.length}
                    top={s.encounter.discard.at(-1)}
                    label="Encounter discard"
                    onOpen={() =>
                      setPile({
                        title: "Encounter discard",
                        cards: s.encounter.discard,
                      })
                    }
                  />
                </div>
                {s.encounter.dealt.length > 0 && (
                  <span className="encounter-dealt">
                    {s.encounter.dealt.length} dealt across the team
                  </span>
                )}
                {s.encounter.acceleration > 0 && (
                  <span className="encounter-dealt">
                    +{s.encounter.acceleration} acceleration
                  </span>
                )}
              </div>
              {s.minions.length > 0 && (
                <div className="encounter-field" aria-label="Engaged minions">
                  <span className="table-group-label">ENGAGED MINIONS</span>
                  {s.minions.map((p) => (
                    <div className="enemy-unit" key={p.id}>
                      <button
                        className="enemy-tile"
                        key={p.id}
                        onClick={() => inspect({ code: p.code })}
                      >
                        <span className="minion-card-face">
                          <CardImage code={p.code} />
                          {p.damage > 0 && (
                            <span
                              className="minion-damage"
                              key={p.damage}
                              aria-label={`${p.damage} damage`}
                            >
                              <img
                                src="/art/tabletop/damage-counter.png"
                                alt=""
                                width={192}
                                height={192}
                              />
                              <b aria-hidden="true">{p.damage}</b>
                              <span aria-hidden="true">DAMAGE</span>
                            </span>
                          )}
                        </span>
                        <span className="minion-info">
                          <strong>{card(p).name}</strong>
                          <span className="engagement-label">
                            Engaged with{" "}
                            {
                              HEROES.find(
                                (h) =>
                                  h.id ===
                                  game.players.find(
                                    (seat) =>
                                      seat.id ===
                                      (p.engagedWith || game.activePlayerId),
                                  )?.heroId,
                              )?.name
                            }
                          </span>
                          <span className="minion-stats">
                            <span
                              className="minion-health"
                              aria-label={`${pieceHP(s, p) - p.damage} of ${pieceHP(s, p)} hit points remaining`}
                            >
                              <b>{pieceHP(s, p) - p.damage}</b>
                              <span>
                                / {pieceHP(s, p)}
                                <small>HP LEFT</small>
                              </span>
                            </span>
                            <span className="minion-attack">
                              <b>
                                {p.code === "drone"
                                  ? pieceHP(s, p)
                                  : p.code === "01162"
                                    ? pieceHP(s, p) - p.damage
                                    : card(p).attack}
                              </b>
                              <small>ATK</small>
                            </span>
                          </span>
                          {card(p).text?.includes("Guard.") && (
                            <span className="minion-keyword">GUARD</span>
                          )}
                          <Status piece={p} />
                        </span>
                      </button>
                      <AttachedCards
                        game={s}
                        host={p}
                        inspect={inspect}
                        send={canUseAction ? sendAction : undefined}
                      />
                      {msMarvelAbilityOptions(s, p.id).map((a) => (
                        <button
                          key={a.id}
                          className="ability-button"
                          disabled={!canUseAction}
                          onClick={() =>
                            sendAction({
                              type: "ABILITY",
                              id: p.id,
                              action: a.id,
                            })
                          }
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
            <div className="battle-divider">
              <i />
              <span>
                <Shield size={13} /> {h.name.toUpperCase()}’S PLAY AREA{" "}
                <span className="table-form-label">
                  {s.player.form === "hero" ? "HERO" : "ALTER-EGO"}
                </span>
              </span>
              <i />
            </div>
            <section className="player-area">
              <div className="identity-area">
                <div
                  className={`identity-card-space ${combat?.target.playerId === s.activePlayerId ? "under-attack" : ""}`}
                >
                  {combat?.target.playerId === s.activePlayerId && (
                    <span className="attack-identity-label">
                      {combat.target.code === combat.identity.code
                        ? combat.label
                        : "ALLY DEFENDING"}
                    </span>
                  )}
                  <button
                    className={`table-card identity-card ${s.player.exhausted ? "is-exhausted" : ""}`}
                    onClick={() => inspect({ code: heroCard(s).code })}
                  >
                    <CardImage code={heroCard(s).code} />
                    {s.player.exhausted && (
                      <span className="exhausted-badge">EXHAUSTED</span>
                    )}
                  </button>
                  <AttachedCards
                    game={s}
                    host={{
                      ...s.villain,
                      id: `hero:${s.activePlayerId}`,
                      code: heroCard(s).code,
                    }}
                    inspect={inspect}
                    send={canUseAction ? sendAction : undefined}
                  />
                  <span
                    className={`readiness-label ${s.player.exhausted ? "spent" : ""}`}
                  >
                    {s.player.exhausted ? "EXHAUSTED" : "READY"}
                  </span>
                </div>
                <div className="identity-info">
                  <span className="small-label">
                    {s.heroId === "ironheart"
                      ? `VERSION ${ironheartVersion(s)} ${s.player.form === "hero" ? "HERO" : "ALTER-EGO"}`
                      : s.player.form === "hero"
                        ? ["ant", "wsp"].includes(s.heroId)
                          ? `${(s.player.heroForm || "tiny").toUpperCase()} HERO`
                          : "YOUR HERO"
                        : "YOUR ALTER-EGO"}
                  </span>
                  <h2>{heroCard(s).name}</h2>
                  <HealthDial
                    value={s.player.hp}
                    max={maxHP(s)}
                    label="Hero HP"
                  />
                  <div className="identity-stats stat-row">
                    {s.player.form === "hero" ? (
                      <>
                        <StatToken
                          kind="attack"
                          value={stats.attack}
                          label="ATK"
                          compact
                        />
                        <StatToken
                          kind="threat"
                          value={stats.thwart}
                          label="THW"
                          compact
                        />
                        <StatToken
                          kind="defense"
                          value={stats.defense}
                          label="DEF"
                          compact
                        />
                      </>
                    ) : (
                      <StatToken
                        kind="health"
                        value={stats.recover}
                        label="REC"
                        compact
                      />
                    )}
                  </div>
                  <Status piece={s.player} />
                  {s.heroId === "groot" && (
                    <div className="identity-stats stat-row">
                      <StatToken
                        kind="counter"
                        value={grootGrowthCounters(s)}
                        label="GROWTH"
                        compact
                      />
                    </div>
                  )}
                  {s.heroId === "warm" && (
                    <div className="identity-stats stat-row">
                      <StatToken
                        kind="counter"
                        value={warMachineAmmo(s)}
                        label="AMMO"
                        compact
                      />
                    </div>
                  )}
                  {s.heroId === "ironheart" && (
                    <div className="identity-stats stat-row">
                      <StatToken
                        kind="counter"
                        value={ironheartProgress(s)}
                        label="PROGRESS"
                        compact
                      />
                    </div>
                  )}
                  <p className="identity-power">{plain(heroCard(s).text)}</p>
                  {abilityActive && (
                    <button
                      className="ability-button"
                      title={
                        spellUnavailable
                          ? "Not enough resources to pay this Invocation's printed cost."
                          : undefined
                      }
                      disabled={!canUseAction || spellUnavailable}
                      onClick={() =>
                        sendAction({
                          type: "ABILITY",
                          id: "identity",
                          action: importedIdentityAbility?.id,
                        })
                      }
                    >
                      <Sparkle size={13} />
                      {importedIdentityAbility
                        ? importedIdentityAbility.label
                        : s.heroId === "iron_man"
                          ? "Use Futurist"
                          : s.heroId === "hulk"
                            ? "Experimental Research"
                            : s.heroId === "captain_america"
                              ? "I Can Do This All Day!"
                              : s.player.form === "hero"
                                ? "Use Rechannel"
                                : "Use Commander"}
                    </button>
                  )}
                  <button
                    className="flip-button hero-form-button"
                    data-form={s.player.form}
                    style={{ "--hero-accent": h.color } as CSSProperties}
                    disabled={
                      !acting || s.player.flipped || !canChangeIdentityForm(s)
                    }
                    onClick={() => send({ type: "FLIP" })}
                  >
                    <span className="hero-form-emblem">
                      <HeroEmblem heroId={s.heroId} />
                      <span className="hero-form-switch">
                        <ArrowsClockwise size={12} weight="bold" />
                      </span>
                    </span>
                    <span className="hero-form-copy">
                      <strong>
                        {["ant", "wsp"].includes(s.heroId)
                          ? "Change form"
                          : s.player.form === "hero"
                            ? `Become ${h.identity}`
                            : "Suit up"}
                      </strong>
                      <small>
                        {s.player.flipped ? "Used this turn" : "Once per turn"}
                      </small>
                    </span>
                  </button>
                </div>
                {s.heroId === "spider_man" && (
                  <div
                    className={`identity-resource ${s.flags.scientist ? "used" : ""}`}
                  >
                    <div className="scientist-art" aria-hidden="true">
                      <img
                        data-card-preview="01001b"
                        src={imageFor("01001b")}
                        alt=""
                      />
                    </div>
                    <div className="scientist-copy">
                      <span className="ability-kicker">
                        PETER PARKER · RESOURCE
                      </span>
                      <b>
                        Scientist{" "}
                        <span className="scientist-output">
                          <ResourceIcons items={["mental"]} />
                          <span>+1</span>
                        </span>
                      </b>
                      <small>
                        {s.flags.scientist
                          ? "Used · returns next round"
                          : s.player.form === "hero"
                            ? "Available in alter-ego form"
                            : "Once per round · no exhaust"}
                      </small>
                      <button
                        className="ability-button"
                        disabled={
                          !canUseAction ||
                          s.player.form !== "alter" ||
                          !!s.flags.scientist
                        }
                        onClick={() => setResourceHelp(true)}
                      >
                        Use Scientist… <ArrowUpRight size={15} />
                      </button>
                    </div>
                  </div>
                )}
              </div>{" "}
              <div className="in-play-area">
                <div className="zone-label">
                  <span>
                    <Shield size={15} /> YOUR PLAY AREA
                  </span>
                  <span>
                    {allyCount(s)} / {allyLimit(s)} allies
                  </span>
                </div>
                {s.player.discard
                  .filter((p) => msMarvelDiscardPlayable(s, p))
                  .map((p) => (
                    <button
                      className="ability-button discard-play-action"
                      key={p.id}
                      disabled={!canUseAction || !!playable(s, p)}
                      onClick={() => sendAction({ type: "PLAY", id: p.id })}
                    >
                      <CardImage code={p.code} />
                      <span>
                        Play Lockjaw from discard · {cardCost(s, card(p))}{" "}
                        resources
                      </span>
                    </button>
                  ))}
                <div className="tableau-groups">
                  {[
                    {
                      key: "allies",
                      title: "ALLIES",
                      pieces: s.player.inPlay.filter(
                        (p) => card(p).type_code === "ally",
                      ),
                      empty: "Your allies join you here",
                    },
                    {
                      key: "setup",
                      title: "UPGRADES & SUPPORTS",
                      pieces: s.player.inPlay.filter(
                        (p) => card(p).type_code !== "ally" && !p.attachedTo,
                      ),
                      empty: "Build your hero’s setup",
                    },
                  ].map((group) => (
                    <div
                      className={`tableau-group ${group.key}`}
                      key={group.key}
                    >
                      <span className="table-group-label">
                        {group.title}
                        <b>
                          {group.key === "allies"
                            ? allyCount(s)
                            : group.pieces.length}
                          {group.key === "allies" && ` / ${allyLimit(s)}`}
                        </b>
                      </span>
                      <div className="in-play-cards">
                        {group.pieces.map((p) => (
                          <div
                            className={`in-play-card ${p.exhausted ? "exhausted" : ""}`}
                            key={p.id}
                          >
                            <button
                              className="in-play-image"
                              onClick={() =>
                                inspect({
                                  code: p.code,
                                  piece: p,
                                  playerId: s.activePlayerId,
                                })
                              }
                              aria-label={
                                spectrumEnergyFormInfo(s, p)?.faceup === false
                                  ? `${card(p).name} · facedown energy form`
                                  : `Inspect ${card(p).name}`
                              }
                            >
                              <PlayerCardImage game={s} piece={p} />

                              {card(p).type_code === "ally" && (
                                <span className="mini-token">
                                  <PremiumToken kind="health" />
                                  {pieceHP(s, p) - p.damage}
                                </span>
                              )}
                              {!!p.storedCards?.length && (
                                <span className="mini-token stored-token">
                                  <PremiumToken kind="counter" />
                                  {p.storedCards.length}
                                  <small>STORED</small>
                                </span>
                              )}
                              {p.counters > 0 && (
                                <span className="mini-token counter-token">
                                  <PremiumToken kind="counter" />
                                  {p.counters}
                                  <small>
                                    {p.code === "01066"
                                      ? "ARROWS"
                                      : p.code === "01018"
                                        ? "ENERGY"
                                        : [
                                              "16034",
                                              "16036",
                                              "16037",
                                              "16038",
                                              "16046",
                                            ].includes(p.code)
                                          ? "CHARGES"
                                          : "USES"}
                                  </small>
                                </span>
                              )}
                            </button>
                            <AttachedCards
                              game={s}
                              host={p}
                              inspect={inspect}
                            />
                            <span className="in-play-name">{card(p).name}</span>
                            {p.exhausted && (
                              <span className="card-spent-label">
                                EXHAUSTED
                              </span>
                            )}
                            <Status piece={p} />
                            <div className="in-play-actions">
                              {abilityOptions(s, p).map((a) => (
                                <button
                                  key={a.id}
                                  disabled={
                                    !canUseAction ||
                                    !!a.disabled ||
                                    (!acting &&
                                      (["attack", "thwart"].includes(a.id) ||
                                        !card(p).text?.includes("Action")))
                                  }
                                  title={a.disabled || a.label}
                                  onClick={() =>
                                    sendAction({
                                      type: "ABILITY",
                                      id: p.id,
                                      action: a.id,
                                    })
                                  }
                                >
                                  {a.id === "attack" ? (
                                    <Fist size={13} weight="fill" />
                                  ) : a.id === "thwart" ? (
                                    <Target size={13} weight="bold" />
                                  ) : (
                                    <Sparkle size={13} />
                                  )}
                                  {a.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                        {!group.pieces.length && (
                          <div className="table-empty-slot">
                            <span>
                              {group.key === "allies" ? (
                                <Users size={22} weight="thin" />
                              ) : (
                                <Stack size={22} weight="thin" />
                              )}
                            </span>
                            <small>{group.empty}</small>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="hero-pile-area">
                <span className="table-group-label">
                  {h.name.toUpperCase()}’S DECK
                </span>
                <div className="table-piles">
                  <TablePile
                    kind="hero"
                    count={s.player.deck.length}
                    label="Draw pile"
                  />
                  <TablePile
                    kind="discard"
                    count={s.player.discard.length}
                    top={s.player.discard.at(-1)}
                    label="Your discard"
                    onOpen={() =>
                      setPile({
                        title: "Your discard pile",
                        cards: s.player.discard,
                      })
                    }
                  />
                </div>
                {hawkeyeStoredPlayable(s).length > 0 && (
                  <section
                    className="invocation-area"
                    aria-label="Hawkeye's Quiver"
                  >
                    <span className="table-group-label">
                      FACEUP ARROWS · QUIVER
                    </span>
                    <div className="attached-card-list">
                      {hawkeyeStoredPlayable(s).map((arrow) => {
                        const reason = playable(s, arrow);
                        return (
                          <div className="attached-piece" key={arrow.id}>
                            <button
                              className="attached-card"
                              aria-label={`Inspect ${card(arrow).name} in Quiver`}
                              onClick={() =>
                                inspect({
                                  code: arrow.code,
                                  piece: arrow,
                                  hand: true,
                                  playerId: s.activePlayerId,
                                })
                              }
                            >
                              <CardImage code={arrow.code} />
                              <span>{card(arrow).name}</span>
                            </button>
                            <button
                              className="ability-button"
                              aria-label={`Play from Quiver: ${card(arrow).name}`}
                              title={
                                reason ||
                                `Pay ${cardCost(s, card(arrow))} resources`
                              }
                              disabled={!canUseAction || !!reason}
                              onClick={() =>
                                sendAction({ type: "PLAY", id: arrow.id })
                              }
                            >
                              Play Arrow · {cardCost(s, card(arrow))}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                {warMachinePackStoredPlayable(s).length > 0 && (
                  <section
                    className="invocation-area"
                    aria-label="Black Panther attached events"
                  >
                    <span className="table-group-label">
                      ATTACHED EVENTS · BLACK PANTHER
                    </span>
                    <div className="attached-card-list">
                      {warMachinePackStoredPlayable(s).map((event) => {
                        const reason = playable(s, event);
                        return (
                          <div className="attached-piece" key={event.id}>
                            <button
                              className="attached-card"
                              aria-label={`Inspect ${card(event).name} attached to Black Panther`}
                              onClick={() =>
                                inspect({
                                  code: event.code,
                                  piece: event,
                                  hand: true,
                                  playerId: s.activePlayerId,
                                })
                              }
                            >
                              <CardImage code={event.code} />
                              <span>{card(event).name}</span>
                            </button>
                            <button
                              className="ability-button"
                              aria-label={`Play from Black Panther: ${card(event).name}`}
                              title={
                                reason ||
                                `Pay ${cardCost(s, card(event))} resources`
                              }
                              disabled={!canUseAction || !!reason}
                              onClick={() =>
                                sendAction({ type: "PLAY", id: event.id })
                              }
                            >
                              Play Event · {cardCost(s, card(event))}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                {ghostSpiderStoredPlayable(s).length > 0 && (
                  <section
                    className="attached-event-area"
                    aria-label="George Stacy stored events"
                  >
                    <span className="table-group-label">
                      GEORGE STACY · STORED EVENTS
                    </span>
                    <div className="attached-card-list">
                      {ghostSpiderStoredPlayable(s).map((event) => {
                        const reason = playable(s, event);
                        const cost = cardCost(s, card(event), event);
                        return (
                          <div className="attached-piece" key={event.id}>
                            <button
                              className="attached-card"
                              aria-label={`Inspect ${card(event).name} stored with George Stacy`}
                              onClick={() =>
                                inspect({
                                  code: event.code,
                                  piece: event,
                                  hand: true,
                                  playerId: s.activePlayerId,
                                })
                              }
                            >
                              <CardImage code={event.code} />
                              <span>{card(event).name}</span>
                            </button>
                            <button
                              className="ability-button"
                              aria-label={`Play from George Stacy: ${card(event).name}`}
                              title={reason || `Pay ${cost} resources`}
                              disabled={!canUseAction || !!reason}
                              onClick={() =>
                                sendAction({ type: "PLAY", id: event.id })
                              }
                            >
                              Play Event · {cost}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                {visionPackStoredPlayable(s).length > 0 && (
                  <section
                    className="attached-event-area"
                    aria-label="Jocasta attached Defense events"
                  >
                    <span className="table-group-label">
                      JOCASTA · ATTACHED DEFENSE
                    </span>
                    <div className="attached-card-list">
                      {visionPackStoredPlayable(s).map((event) => {
                        const reason = playable(s, event);
                        const cost = cardCost(s, card(event), event);
                        return (
                          <div className="attached-piece" key={event.id}>
                            <button
                              className="attached-card"
                              aria-label={`Inspect ${card(event).name} attached to Jocasta`}
                              onClick={() =>
                                inspect({
                                  code: event.code,
                                  piece: event,
                                  playerId: s.activePlayerId,
                                })
                              }
                            >
                              <CardImage code={event.code} />
                              <span>{card(event).name}</span>
                            </button>
                            <button
                              className="ability-button"
                              aria-label={`Play from Jocasta: ${card(event).name}`}
                              title={reason || `Pay ${cost} resources`}
                              disabled={!canUseAction || !!reason}
                              onClick={() =>
                                sendAction({ type: "PLAY", id: event.id })
                              }
                            >
                              Play Event · {cost}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                )}
                {s.heroId === "doctor_strange" &&
                  s.phase !== "mulligan" &&
                  doctorStrangeTopInvocation(s) && (
                    <section
                      className="invocation-area"
                      aria-label="Invocation deck"
                    >
                      <span className="table-group-label">INVOCATION DECK</span>
                      <div className="table-piles">
                        <TablePile
                          kind="hero"
                          count={s.player.invocationDeck?.length || 0}
                          top={doctorStrangeTopInvocation(s)}
                          label="Faceup Invocation"
                          onOpen={() =>
                            inspect({
                              code: doctorStrangeTopInvocation(s)!.code,
                              piece: doctorStrangeTopInvocation(s),
                            })
                          }
                        />
                        <TablePile
                          kind="discard"
                          count={s.player.invocationDiscard?.length || 0}
                          top={s.player.invocationDiscard?.at(-1)}
                          label="Invocation discard"
                          onOpen={() =>
                            setPile({
                              title: "Invocation discard",
                              cards: s.player.invocationDiscard || [],
                            })
                          }
                        />
                      </div>
                      <small>
                        {card(doctorStrangeTopInvocation(s)!).name} ·{" "}
                        {card(doctorStrangeTopInvocation(s)!).cost || 0}{" "}
                        resources
                      </small>
                    </section>
                  )}
                {s.encounter.dealt.filter((p) => p.dealtTo === s.activePlayerId)
                  .length > 0 && (
                  <div
                    className="dealt-encounters"
                    aria-label="Facedown encounters"
                  >
                    <CardBack kind="encounter" />
                    <span>
                      {
                        s.encounter.dealt.filter(
                          (p) => p.dealtTo === s.activePlayerId,
                        ).length
                      }{" "}
                      facedown encounter(s)
                    </span>
                  </div>
                )}
              </div>
            </section>
            {game.playerCount > 1 && (
              <section
                className="teammate-tableaux"
                aria-label="Other heroes at the table"
              >
                {game.players
                  .filter((seat) => seat.id !== s.activePlayerId)
                  .map((seat) => {
                    const view = seatView(game, seat);
                    const teammate = HEROES.find(
                      (hero) => hero.id === seat.heroId,
                    )!;
                    return (
                      <div
                        className={`teammate-tableau ${seat.eliminated ? "eliminated" : ""}`}
                        key={seat.id}
                      >
                        <button
                          className="teammate-identity"
                          onClick={() => {
                            setViewId(seat.id);
                            setHandFilter("all");
                          }}
                          aria-label={`Switch to ${teammate.name}’s play area`}
                        >
                          <CardImage code={heroCard(view).code} />
                          <span>
                            <strong>{teammate.name}</strong>
                            <small>
                              <Heart size={11} weight="fill" />
                              {view.player.hp}/{maxHP(view)} ·{" "}
                              {view.player.exhausted ? "Exhausted" : "Ready"}
                            </small>
                            <small>
                              {view.player.hand.length} in hand ·{" "}
                              {view.player.deck.length} in deck
                            </small>
                          </span>
                          <ArrowRight size={14} />
                        </button>
                        <div className="teammate-cards">
                          {view.player.inPlay
                            .filter((p) => !p.attachedTo)
                            .map((p) => (
                              <div className="teammate-card-stack" key={p.id}>
                                <button
                                  key={p.id}
                                  className={p.exhausted ? "spent" : ""}
                                  onClick={() =>
                                    inspect({
                                      code: p.code,
                                      piece: p,
                                      playerId: seat.id,
                                    })
                                  }
                                  aria-label={
                                    spectrumEnergyFormInfo(game, p)?.faceup ===
                                    false
                                      ? `${teammate.name}’s ${card(p).name} · facedown energy form`
                                      : `Inspect ${teammate.name}’s ${card(p).name}`
                                  }
                                >
                                  <PlayerCardImage game={game} piece={p} />
                                </button>
                                <AttachedCards
                                  game={game}
                                  host={p}
                                  inspect={inspect}
                                />
                              </div>
                            ))}
                          {!view.player.inPlay.length && (
                            <small>No cards in play yet</small>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </section>
            )}
          </div>
          <div className="table-bottom">
            <div className="action-bar">
              <div className="basic-actions">
                {s.player.form === "hero" ? (
                  <>
                    <button
                      className="attack-action"
                      title={
                        valkyrieCannotBasicAttack(s)
                          ? "Seduced prevents basic attacks."
                          : !visionCanAttack(s)
                            ? "Intangible prevents attack abilities."
                            : "Attack an enemy. Exhaust your identity."
                      }
                      disabled={
                        !acting ||
                        s.player.exhausted ||
                        valkyrieCannotBasicAttack(s) ||
                        !visionCanAttack(s)
                      }
                      onClick={() => send({ type: "BASIC", action: "attack" })}
                    >
                      <span className="action-emblem">
                        <Fist size={25} weight="fill" />
                      </span>
                      <span className="action-copy">
                        Attack <small>Deal damage</small>
                      </span>
                      <b className="action-value">{stats.attack}</b>
                    </button>
                    <button
                      className="thwart-action"
                      title="Remove threat from a scheme. Exhaust your identity."
                      disabled={!acting || s.player.exhausted}
                      onClick={() => send({ type: "BASIC", action: "thwart" })}
                    >
                      <span className="action-emblem">
                        <Target size={25} weight="bold" />
                      </span>
                      <span className="action-copy">
                        Thwart <small>Remove threat</small>
                      </span>
                      <b className="action-value">{stats.thwart}</b>
                    </button>
                    <DefensePlaque
                      value={stats.defense}
                      exhausted={s.player.exhausted}
                    />
                  </>
                ) : (
                  <button
                    className="recover-action"
                    title="Heal your identity. Exhaust your identity."
                    disabled={
                      !acting || s.player.exhausted || s.player.hp >= maxHP(s)
                    }
                    onClick={() => send({ type: "BASIC", action: "recover" })}
                  >
                    <Heart size={20} />
                    <span>
                      Recover <b>{stats.recover}</b>
                    </span>
                  </button>
                )}
              </div>
              <div className="turn-action">
                <span>
                  {s.phase === "villain"
                    ? "The villain is acting"
                    : s.player.exhausted
                      ? "Your identity is exhausted"
                      : "Choose your next move"}
                </span>
                <button
                  className="secondary-button undo-button"
                  disabled={!canUndo || s.phase !== "player"}
                  title="Take back your last action (Ctrl+Z or ⌘Z). Not available once a hidden card was revealed."
                  onClick={onUndo}
                >
                  <ArrowCounterClockwise size={15} /> Undo
                </button>
                <button
                  className="primary-button"
                  disabled={!acting}
                  onClick={onEnd}
                >
                  {s.playerCount > 1 ? "End hero turn" : "End hero phase"}{" "}
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
            <section className="hand-section">
              <div className="zone-label">
                <span>
                  YOUR HAND <b>{s.player.hand.length}</b>
                </span>
                <span>
                  Select a card to read or play{" "}
                  <button
                    className="icon-button"
                    aria-label="Open rules"
                    onClick={onHelp}
                  >
                    <Info size={14} />
                  </button>
                </span>
              </div>
              <div className="hand-tools">
                <div className="hand-filter" aria-label="Filter hand">
                  <button
                    className={handFilter === "all" ? "selected" : ""}
                    aria-pressed={handFilter === "all"}
                    onClick={() => setHandFilter("all")}
                  >
                    All cards <b>{s.player.hand.length}</b>
                  </button>
                  <button
                    className={handFilter === "playable" ? "selected" : ""}
                    aria-pressed={handFilter === "playable"}
                    onClick={() => setHandFilter("playable")}
                  >
                    Ready to play <b>{playableHand.length}</b>
                  </button>
                </div>
                <span>
                  <Lightning size={15} /> Other cards in hand can pay resource
                  costs.
                </span>
              </div>
              <div className="hand-layout">
                <div className="hand-cards">
                  {visibleHand.map((p, i) => {
                    const disabled = playable(s, p);
                    return (
                      <div
                        className={`hand-slot ${!disabled ? "playable" : ""}`}
                        style={
                          {
                            "--tilt": `${(i - (visibleHand.length - 1) / 2) * 1.2}deg`,
                          } as CSSProperties
                        }
                        key={p.id}
                      >
                        <button
                          className={`hand-card ${!disabled ? "playable" : ""}`}
                          onClick={() =>
                            inspect({
                              code: p.code,
                              piece: p,
                              hand: true,
                              playerId: s.activePlayerId,
                            })
                          }
                          aria-label={`Inspect ${card(p).name}`}
                          title={disabled || `Read ${card(p).name}`}
                        >
                          <CardImage code={p.code} />
                          <span className="hand-card-name">{card(p).name}</span>
                          <span className="hand-card-footer">
                            <ResourceIcons items={resourcesFor(s, p)} />
                            {!disabled ? (
                              <span className="hand-card-cost">
                                COST {card(p).cost ?? 0}
                              </span>
                            ) : (
                              <span
                                className="hand-reason"
                                aria-label={disabled || undefined}
                              >
                                {shortReason(disabled || "")}
                              </span>
                            )}
                          </span>
                        </button>
                        {!disabled && (
                          <button
                            className="hand-play"
                            aria-label={`Play now: ${card(p).name}`}
                            title={`Play ${card(p).name} · cost ${card(p).cost ?? 0}`}
                            onClick={() =>
                              sendAction({ type: "PLAY", id: p.id })
                            }
                          >
                            PLAY <CaretRight size={11} weight="fill" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {!visibleHand.length && (
                    <div className="empty-hand">
                      <Cards size={30} />
                      <strong>
                        {handFilter === "playable"
                          ? "No cards ready to play"
                          : "Your hand is empty"}
                      </strong>
                      <span>
                        {handFilter === "playable"
                          ? "You can still use basic powers, change form, or activate cards in play."
                          : "End your hero phase to draw a new hand."}
                      </span>
                      {handFilter === "playable" && (
                        <button
                          className="text-button"
                          onClick={() => setHandFilter("all")}
                        >
                          Show all cards <ArrowRight size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
        <aside className="mission-rail">
          {coach}
          <ActionDirector
            game={game}
            send={send}
            inspect={inspect}
            pacing={pacing}
            onPacing={onPacing}
            onEnd={onEnd}
          />
          {logOpen && (
            <section className="battle-log">
              <div className="log-heading">
                <span>
                  <ListBullets size={17} /> MISSION COMMS
                </span>
                <span className="live-dot" />
              </div>
              <div
                className="log-entries"
                ref={logRef}
                tabIndex={0}
                role="region"
                aria-label="Mission history"
              >
                {s.log.map((l) => (
                  <div className={`log-entry ${l.kind}`} key={l.id}>
                    {l.kind === "phase" ? (
                      <span className="log-phase">{l.text}</span>
                    ) : (
                      <>
                        <span className="log-round">
                          {String(l.round).padStart(2, "0")}
                        </span>
                        <p>{l.text}</p>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="log-footer">
                <ShieldCheck size={14} /> {saveLabel}
              </div>
            </section>
          )}
        </aside>
      </div>
      {tableStyleOpen && (
        <TableStylePicker
          selected={playmatId}
          heroId={s.heroId}
          onSelect={selectPlaymat}
          onClose={() => setTableStyleOpen(false)}
        />
      )}
      {resourceHelp && (
        <Modal
          title="Use Peter Parker’s Scientist"
          eyebrow="RESOURCE ABILITY · ONCE PER ROUND"
          onClose={() => setResourceHelp(false)}
        >
          <p className="modal-intro">
            Choose a card to play, then select Scientist in the payment window
            to generate 1 mental resource. Scientist does not exhaust Peter. The
            ability is used only when you confirm payment.
          </p>
          <div className="decision-options">
            {playableHand
              .filter(
                (p) => (card(p).cost || 0) > Number(s.flags.discount || 0),
              )
              .map((p) => (
                <button
                  className="decision-option"
                  key={p.id}
                  onClick={() => {
                    setResourceHelp(false);
                    sendAction({ type: "PLAY", id: p.id });
                  }}
                >
                  <img
                    data-card-preview={p.code}
                    src={imageFor(p.code)}
                    alt=""
                  />
                  <span>
                    <strong>Play {card(p).name}</strong>
                    <small>
                      Pay{" "}
                      {Math.max(
                        0,
                        (card(p).cost || 0) - Number(s.flags.discount || 0),
                      )}{" "}
                      resources · Scientist can provide 1 mental
                    </small>
                  </span>
                  <ArrowRight size={18} />
                </button>
              ))}
          </div>
          {!playableHand.some(
            (p) => (card(p).cost || 0) > Number(s.flags.discount || 0),
          ) && (
            <p className="modal-intro">
              No card in your hand can use this resource right now. Scientist is
              also available when another ability asks you to pay a resource
              cost.
            </p>
          )}
        </Modal>
      )}
      {pile && (
        <Modal title={pile.title} wide onClose={() => setPile(null)}>
          {pile.cards.length ? (
            <div className="pile-grid">
              {[...pile.cards].reverse().map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setPile(null);
                    inspect({ code: p.code });
                  }}
                >
                  <CardImage code={p.code} />
                  <span>{card(p).name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="modal-intro">
              There are no cards in this discard pile yet.
            </p>
          )}
        </Modal>
      )}
    </main>
  );
}
function Help({
  onClose,
  accounts = true,
}: {
  onClose: () => void;
  accounts?: boolean;
}) {
  return (
    <Modal title="YOUR FIRST MISSION" wide onClose={onClose}>
      <p className="modal-intro">
        Defeat both villain stages before your hit points reach zero or the
        final main scheme completes. The table handles the bookkeeping.
      </p>
      <div className="help-grid">
        {[
          {
            icon: ArrowsClockwise,
            title: "Two sides of a hero",
            text: "You begin as your alter-ego. Change form once each turn. Hero form lets you attack and thwart; alter-ego form lets you recover.",
          },
          {
            icon: Lightning,
            title: "Your hand is your fuel",
            text: "Click a card, choose Play, then select other cards to spend as resources. Double-resource cards pay for two. Unspent cards stay in your hand.",
          },
          {
            icon: Target,
            title: "Control the battlefield",
            text: "Attack enemies, or thwart to remove threat. Guard minions protect the villain. Crisis side schemes stop you thwarting the main scheme.",
          },
          {
            icon: Shield,
            title: "Ready for the villain",
            text: "After every hero has taken a turn, choose each hero’s discards, refill all hands, and ready all cards. The villain then activates against each hero and reveals each hero’s encounters.",
          },
          {
            icon: Users,
            title: "One player. Up to three heroes.",
            text: "Choose 1–3 heroes at mission setup. Each has a separate deck, hand, and health. The first-player token rotates each round. Click a team portrait to inspect that hero’s table.",
          },
          {
            icon: BookOpen,
            title: "Read. React. Repeat.",
            text: "The action panel groups each action into one summary. Click Proceed (or press Enter) to continue; nothing advances on a timer. Set the Tempo to Brisk or Expert to pause only when something costs you.",
          },
        ].map(({ icon: Icon, title, text }, i) => (
          <div className="help-step" key={title}>
            <span>
              <Icon size={24} />
              <small>0{i + 1}</small>
            </span>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      <div className="help-bottom">
        <a
          className="text-link"
          href="https://images-cdn.fantasyflightgames.com/filer_public/ab/be/abbef836-d5ef-4241-b2bd-1062df73f367/mvc01_learn_to_play_eng-compressed.pdf"
          target="_blank"
          rel="noreferrer"
        >
          Official Learn to Play <ArrowUpRight size={16} />
        </a>
        <button className="primary-button" onClick={onClose}>
          Let’s play <ArrowRight size={18} />
        </button>
      </div>
      <p className="help-scope">
        Core-set missions support 1–3 heroes controlled by you.
        {accounts
          ? " Create a player account to build and save decks, resume missions, and keep your results."
          : ""}{" "}
        Online co-op is not included.
      </p>
    </Modal>
  );
}
