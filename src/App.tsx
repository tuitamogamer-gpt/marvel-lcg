import { useEffect, useRef, useState } from "react";
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
} from "@phosphor-icons/react";
import {
  ASPECTS,
  CARDS,
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
  dispatch,
  newGame,
  paymentSources,
  playable,
  summarize,
  schemeLimit,
  escalation,
} from "./game/engine";
import { seatView, upgradeSave } from "./game/team";
import { effectTitle } from "./game/review";
import { paymentStatus, paymentSubject } from "./game/payment";
import { attachmentsFor, attackContext } from "./game/presentation";
import type {
  ActionReview,
  Aspect,
  Command,
  GameState,
  Piece,
  Resource,
} from "./game/types";

type Screen = "lobby" | "game" | "collection";
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
}: {
  code: string;
  className?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loadedCode, setLoadedCode] = useState<string | null>(null);
  useEffect(() => setFailed(false), [code]);
  const landscape = ["main_scheme", "side_scheme"].includes(
    card(code)?.type_code,
  );
  return (
    <div className={`card-image ${className}`} onClick={onClick}>
      {!failed ? (
        <>
          <img
            draggable={false}
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
      "button, input, select",
    );
    target?.focus();
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current?.();
      if (e.key === "Tab") {
        const nodes = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),[tabindex="0"]',
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
  piece: { tough?: boolean; stunned?: boolean; confused?: boolean };
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
        .filter(({ key }) => piece[key])
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
              <b>{name}</b>
              <small>{hint}</small>
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
};
export default function App() {
  const [screen, setScreen] = useState<Screen>("lobby");
  const [game, setGame] = useState<GameState | null>(readSave);
  const [team, setTeam] = useState<{ heroId: string; aspect: Aspect }[]>([
    { heroId: HEROES[0].id, aspect: "justice" },
  ]);
  const [setupSeat, setSetupSeat] = useState(0);
  const hero = HEROES.find((h) => h.id === team[setupSeat].heroId)!;
  const aspect = team[setupSeat].aspect;
  const setHero = (h: (typeof HEROES)[number]) =>
    setTeam((a) =>
      a.map((p, i) =>
        i === setupSeat ? { heroId: h.id, aspect: h.aspect } : p,
      ),
    );
  const setAspect = (aspect: Aspect) =>
    setTeam((a) => a.map((p, i) => (i === setupSeat ? { ...p, aspect } : p)));
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
  const [help, setHelp] = useState(false);
  const [deckView, setDeckView] = useState(false);
  const [endTurn, setEndTurn] = useState(false);
  const [restart, setRestart] = useState(false);
  const [toast, setToast] = useState("");
  const [logOpen, setLogOpen] = useState(true);
  const [sound, setSound] = useState(
    () => localStorage.getItem("champions.sound") === "on",
  );
  const [storageError, setStorageError] = useState(false);
  const gameRef = useRef(game);
  gameRef.current = game;
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [screen]);
  useEffect(() => {
    if (game)
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(game));
        setStorageError(false);
      } catch {
        setStorageError(true);
      }
  }, [game]);
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
            },
      );
    (window as any).advanceTime = () => {};
  }, [screen, hero, villain, aspect, difficulty, team]);
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
    setGame(next);
    tone();
  }
  function start() {
    setGame(
      newGame({
        heroId: hero.id,
        aspect,
        heroes: team,
        guided: true,
        villainId: villain.id,
        difficulty,
        module,
      }),
    );
    setScreen("game");
    setRestart(false);
    tone();
  }
  function startRequest() {
    if (game && !["won", "lost"].includes(game.phase)) setRestart(true);
    else start();
  }
  const active = game && !["won", "lost"].includes(game.phase);
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
          <span className="edition">
            <span>CORE SET</span>
            <b>01</b>
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
      {screen === "lobby" && (
        <main id="main-content" className="lobby page-width">
          <div className="lobby-kicker">
            <span>
              <span className="live-dot" />A NEW MISSION AWAITS
            </span>
            <span>FIVE HEROES. ONE EXTRAORDINARY UNIVERSE.</span>
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
                <button className="text-button" onClick={() => setHelp(true)}>
                  <BookOpen size={17} /> Learn to play
                </button>
              </div>
              <div className="banner-meta">
                <span>
                  <User size={16} /> 1–3 hero hot-seat
                </span>
                <span>
                  <ShieldCheck size={17} /> 5 iconic heroes
                </span>
                <span>
                  <Skull size={17} /> 3 villain scenarios
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
                    <img src={imageFor(h.code)} alt="" />
                    <span>
                      <b>{h.name}</b>
                      <small>
                        {ASPECTS.find((a) => a.id === p.aspect)?.name} · 40
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
                      <img src={imageFor(h.code)} alt={h.name} />
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
                      onClick={() => setInspect({ code: fanCards[hero.id][0] })}
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
              <div className="aspect-heading">
                <div>
                  <span className="step-number">02</span>
                  <h2>CHOOSE YOUR APPROACH</h2>
                </div>
                <button
                  className="text-button"
                  onClick={() => setDeckView(true)}
                >
                  View 40-card deck <ArrowUpRight size={15} />
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
                      className={`aspect-option ${aspect === a.id ? "selected" : ""}`}
                      onClick={() => setAspect(a.id)}
                      aria-pressed={aspect === a.id}
                    >
                      <I
                        size={21}
                        weight={aspect === a.id ? "fill" : "regular"}
                      />
                      <span>{a.name}</span>
                      {aspect === a.id && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
              <p className="aspect-description">
                {ASPECTS.find((a) => a.id === aspect)!.description}{" "}
                <span>A complete starter deck is ready to play.</span>
              </p>
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
                  <img src={imageFor(villain.codes[0])} alt={villain.name} />
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
                        {ASPECTS.find((a) => a.id === p.aspect)?.name} · 40-card
                        deck
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
                onClick={startRequest}
              >
                <Play size={17} weight="fill" /> START MISSION{" "}
                <ArrowRight size={20} />
              </button>
              <span className="save-note">
                <ShieldCheck size={13} /> Your progress saves automatically.
              </span>
            </section>
          </div>
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
        <Collection onInspect={(code) => setInspect({ code })} />
      )}
      {screen === "game" && game && (
        <Tabletop
          game={game}
          send={send}
          inspect={setInspect}
          logOpen={logOpen}
          onEnd={() =>
            game.playerCount > 1 ? send({ type: "END_TURN" }) : setEndTurn(true)
          }
          onHome={() => setScreen("lobby")}
          onHelp={() => setHelp(true)}
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
      {inspect && (
        <Modal title={card(inspect.code).name} onClose={() => setInspect(null)}>
          <div className="inspect-content">
            <CardImage code={inspect.code} />
            <div>
              <span className="card-type">
                {card(inspect.code).faction_code} ·{" "}
                {card(inspect.code).type_code.replace("_", " ")}
              </span>
              <p className="rules-text">
                {plain(card(inspect.code).text) ||
                  "A resource card. Spend it when paying a resource cost."}
              </p>
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
                      `Pay ${Math.max(0, (card(inspect.code).cost || 0) - Number(game.flags.discount || 0))} resources to play this card.`}
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
          title={`${hero.name} / ${ASPECTS.find((a) => a.id === aspect)!.name}`}
          wide
          onClose={() => setDeckView(false)}
        >
          <p className="modal-intro">
            40 cards · 15 hero cards + 14 aspect cards + 11 basic cards. Based
            on the core-set starter deck lists.
          </p>
          <div className="deck-list">
            {(["hero", aspect, "basic"] as const).map((f) => {
              const counts = deckCodes(hero.id, aspect).reduce(
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
                        onClick={() => {
                          setDeckView(false);
                          setInspect({ code });
                        }}
                      >
                        <span>{card(code).name}</span>
                        <b>×{n}</b>
                      </button>
                    ))}
                </section>
              );
            })}
          </div>
        </Modal>
      )}
      {help && <Help onClose={() => setHelp(false)} />}
      {restart && (
        <Modal title="Start a new mission?" onClose={() => setRestart(false)}>
          <p className="modal-intro">
            Your current {HEROES.find((h) => h.id === game?.heroId)?.name}{" "}
            mission will be replaced by {hero.name} vs. {villain.name}.
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
            <button className="primary-button" onClick={start}>
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
              <span className="result-rounds">
                {game.round} rounds ·{" "}
                {HEROES.find((h) => h.id === game.heroId)!.name} ·{" "}
                {game.difficulty}
              </span>
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setScreen("lobby")}
                >
                  Choose a mission
                </button>
                <button
                  className="primary-button"
                  onClick={() =>
                    setGame(
                      newGame({
                        heroId: game.players[0].heroId,
                        heroes: game.players.map((p) => ({
                          heroId: p.heroId,
                          aspect: p.aspect,
                        })),
                        guided: true,
                        aspect: game.aspect,
                        villainId: game.villainId,
                        difficulty: game.difficulty,
                        module: game.module,
                      }),
                    )
                  }
                >
                  <ArrowsClockwise size={17} /> Play again
                </button>
              </div>
            </div>
          </Modal>
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
  const sources = paymentSources(s, p.card?.id, p.paymentTarget);
  const status = paymentStatus(sources, selected, p.cost || 0, p.requirements);
  const subject = paymentSubject(s, p);
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
                    {kind === "card" ? "FROM YOUR HAND" : "RESOURCE ABILITIES"}
                  </b>
                  <span>
                    {kind === "card"
                      ? "Selected cards go to your discard pile"
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
  return (
    <Modal
      title={p.title}
      className={s.attack ? "attack-decision" : ""}
      eyebrow={
        s.phase === "villain"
          ? `${HEROES.find((h) => h.id === s.heroId)!.name.toUpperCase()} · YOUR RESPONSE`
          : `${HEROES.find((h) => h.id === s.heroId)!.name.toUpperCase()} · YOUR DECISION`
      }
      onClose={p.cancelable ? () => send({ type: "CANCEL" }) : undefined}
    >
      <p className="modal-intro">{p.text}</p>
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
                {o.image && <img src={imageFor(o.image)} alt="" />}
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
              {o.image && <img src={imageFor(o.image)} alt="" />}
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
function StatToken({
  kind,
  value,
  max,
  label,
  compact = false,
}: {
  kind: "health" | "threat" | "attack" | "defense";
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
      <span className="token-emblem">
        <Icon size={compact ? 15 : 22} weight="fill" />
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
  const messages = participantSource
    ? review.messages
    : review.messages.slice(1);
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
                src={imageFor(review.source)}
                alt={card(review.source).name}
              />
              <ArrowsOut size={13} />
            </button>
            <span>
              <small>IN THIS ACTION</small>
              <b>{card(review.source).name}</b>
              <span>
                {review.messages[0] ||
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
                    <Shield size={30} weight="duotone" />
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
}: {
  game: GameState;
  send: (c: Command) => void;
  inspect: (c: Inspect) => void;
}) {
  const review = s.review;
  const button = useRef<HTMLButtonElement>(null);
  const focusButton = useRef<HTMLButtonElement>(null);
  const director = useRef<HTMLElement>(null);
  const [collapsedId, setCollapsedId] = useState<number | null>(null);
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
          <b>
            {review ? `STEP ${String(review.id).padStart(2, "0")}` : "GUIDED"}
          </b>
        </div>
        <div
          className="director-body"
          key={review?.id || "idle"}
          tabIndex={0}
          role="region"
          aria-label="Current action details"
        >
          <div className="director-actor">
            <span
              className={`resolution-dot ${s.phase === "villain" ? "enemy" : ""}`}
            />
            {review?.actor || activeHero.name}
            <small>
              {s.phase === "villain" ? "VILLAIN PHASE" : "HERO PHASE"}
            </small>
          </div>
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
                Play a card, use an ability, or change form. Every resolved
                action will appear here.
              </p>
              <span>
                <CheckCircle size={14} />
                No timers. You control the pace.
              </span>
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
            <span className="pace-note">
              <ShieldCheck size={14} />
              Every step is saved automatically.
            </span>
          )}
        </div>
      </section>
      {focused && review && (
        <Modal
          key={review.id}
          title={review.title}
          wide={!!review.cards?.length}
          className={`review-focus ${review.cards?.length ? "with-cards" : ""} ${review.attack ? "with-attack" : ""}`}
          eyebrow={`STEP ${String(review.id).padStart(2, "0")} · ${review.actor.toUpperCase()} · ${review.phase === "villain" ? "VILLAIN PHASE" : "HERO PHASE"}`}
          onClose={() => setCollapsedId(review.id)}
        >
          <div
            className="review-focus-body"
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
      <Heart size={13} weight="fill" aria-hidden="true" />
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
        ) : (
          <>
            <span className="deck-back-mark">
              <b>MARVEL</b>
              <strong>CHAMPIONS</strong>
              <small>THE CARD GAME</small>
            </span>
            {kind === "hero" ? (
              <Shield size={24} weight="duotone" />
            ) : (
              <Skull size={24} weight="duotone" />
            )}
          </>
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
      aria-label={`${label}, ${count} cards, face down`}
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
                disabled={!send}
                onClick={() => send?.({ type: "ABILITY", id: p.id })}
              >
                Remove
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
function Tabletop({
  game,
  send,
  inspect,
  logOpen,
  onEnd,
  onHome,
  onHelp,
}: {
  game: GameState;
  send: (c: Command) => void;
  inspect: (c: Inspect) => void;
  logOpen: boolean;
  onEnd: () => void;
  onHome: () => void;
  onHelp: () => void;
}) {
  const [viewId, setViewId] = useState(game.activePlayerId);
  const s = seatView(
    game,
    game.players.some((p) => p.id === viewId) ? viewId : game.activePlayerId,
  );
  useEffect(() => {
    setViewId(game.activePlayerId);
    setHandFilter("all");
  }, [game.activePlayerId, game.review?.id]);
  const h = HEROES.find((h) => h.id === s.heroId)!;
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
  const abilityActive =
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
                <img src={imageFor(h.code)} alt="" />
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
                        <Star size={11} weight="fill" />
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
        <div className="playmat">
          <div className="zone-label">
            <span>
              <Skull size={17} weight="fill" /> VILLAIN PLAY AREA
            </span>
            <span>
              {s.playerCount} {s.playerCount === 1 ? "HERO" : "HEROES"} · SHARED
              PLAY AREA
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
                  send={
                    canUseAction && s.player.form === "hero"
                      ? sendAction
                      : undefined
                  }
                />
              </div>
              <div className="villain-info">
                <span className="small-label">
                  VILLAIN · STAGE {["", "I", "II", "III"][s.villain.stage]}
                </span>
                <h2>{v.name.toUpperCase()}</h2>
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
                      (card(s.villain).attack || 0) +
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
                      (card(s.villain).scheme || 0) +
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
                      (n, p) => n + (card(p).scheme_acceleration || 0),
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
              {s.sideSchemes.map((p) => (
                <div className="table-side-scheme" key={p.id}>
                  <span className="table-group-label">SIDE SCHEME</span>
                  <button
                    className="scheme-card"
                    onClick={() => inspect({ code: p.code })}
                    aria-label={`Inspect ${card(p).name}`}
                  >
                    <CardImage code={p.code} />
                  </button>
                  <div className="side-scheme-counter">
                    <span className="threat-chip">
                      <Target size={13} />
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
          </section>
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
                    <CardImage code={p.code} />
                    <span>
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
                      <small>
                        <Heart size={12} />
                        {pieceHP(s, p) - p.damage} HP <Fist size={12} />
                        {p.code === "drone"
                          ? pieceHP(s, p)
                          : p.code === "01162"
                            ? pieceHP(s, p) - p.damage
                            : card(p).attack}{" "}
                        ATK{card(p).text?.includes("Guard.") && <b>GUARD</b>}
                      </small>
                      <Status piece={p} />
                    </span>
                  </button>
                  <AttachedCards game={s} host={p} inspect={inspect} />
                </div>
              ))}
            </div>
          )}
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
                <span
                  className={`readiness-label ${s.player.exhausted ? "spent" : ""}`}
                >
                  {s.player.exhausted ? "EXHAUSTED" : "READY"}
                </span>
              </div>
              <div className="identity-info">
                <span className="small-label">
                  {s.player.form === "hero" ? "YOUR HERO" : "YOUR ALTER-EGO"}
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
                <p className="identity-power">{plain(heroCard(s).text)}</p>
                {abilityActive && (
                  <button
                    className="ability-button"
                    disabled={!canUseAction}
                    onClick={() =>
                      sendAction({ type: "ABILITY", id: "identity" })
                    }
                  >
                    <Sparkle size={13} />
                    {s.heroId === "iron_man"
                      ? "Use Futurist"
                      : s.player.form === "hero"
                        ? "Use Rechannel"
                        : "Use Commander"}
                  </button>
                )}
                <button
                  className="flip-button"
                  disabled={!acting || s.player.flipped}
                  onClick={() => send({ type: "FLIP" })}
                >
                  <ArrowsClockwise size={14} />
                  {s.player.form === "hero"
                    ? `Become ${h.identity}`
                    : "Suit up"}
                  <small>
                    {s.player.flipped ? "Used this turn" : "Once per turn"}
                  </small>
                </button>
              </div>
              {s.heroId === "spider_man" && (
                <div
                  className={`identity-resource ${s.flags.scientist ? "used" : ""}`}
                >
                  <div className="scientist-art" aria-hidden="true">
                    <img src={imageFor("01001b")} alt="" />
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
                  {
                    s.player.inPlay.filter((p) => card(p).type_code === "ally")
                      .length
                  }{" "}
                  / {s.player.inPlay.some((p) => p.code === "01073") ? 4 : 3}{" "}
                  allies
                </span>
              </div>
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
                  <div className={`tableau-group ${group.key}`} key={group.key}>
                    <span className="table-group-label">
                      {group.title}
                      <b>
                        {group.pieces.length}
                        {group.key === "allies" &&
                          ` / ${s.player.inPlay.some((p) => p.code === "01073") ? 4 : 3}`}
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
                            onClick={() => inspect({ code: p.code, piece: p })}
                          >
                            <CardImage code={p.code} />

                            {card(p).type_code === "ally" && (
                              <span className="mini-token">
                                <Heart size={10} weight="fill" />
                                {pieceHP(s, p) - p.damage}
                              </span>
                            )}
                            {p.counters > 0 && (
                              <span className="mini-token counter-token">
                                <Lightning size={12} weight="fill" />
                                {p.counters}
                                <small>
                                  {p.code === "01066"
                                    ? "ARROWS"
                                    : p.code === "01018"
                                      ? "ENERGY"
                                      : "USES"}
                                </small>
                              </span>
                            )}
                          </button>
                          <AttachedCards game={s} host={p} inspect={inspect} />
                          <span className="in-play-name">{card(p).name}</span>
                          {p.exhausted && (
                            <span className="card-spent-label">EXHAUSTED</span>
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
              {s.encounter.dealt.filter((p) => p.dealtTo === s.activePlayerId)
                .length > 0 && (
                <div
                  className="dealt-encounters"
                  aria-label="Facedown encounters"
                >
                  <Skull size={14} />
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
                                aria-label={`Inspect ${teammate.name}’s ${card(p).name}`}
                              >
                                <CardImage code={p.code} />
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
          <div className="action-bar">
            <div className="basic-actions">
              {s.player.form === "hero" ? (
                <>
                  <button
                    className="attack-action"
                    title="Attack an enemy. Exhaust your identity."
                    disabled={!acting || s.player.exhausted}
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
                  <span className="defense-reminder">
                    <Shield size={18} />
                    {stats.defense} DEF <small>during attacks</small>
                  </span>
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
                    <button
                      className={`hand-card ${!disabled ? "playable" : ""}`}
                      style={
                        {
                          "--tilt": `${(i - (visibleHand.length - 1) / 2) * 1.2}deg`,
                        } as CSSProperties
                      }
                      key={p.id}
                      onClick={() =>
                        inspect({
                          code: p.code,
                          piece: p,
                          hand: true,
                          playerId: s.activePlayerId,
                        })
                      }
                      aria-label={`Inspect ${card(p).name}`}
                      title={disabled || `Play ${card(p).name}`}
                    >
                      <CardImage code={p.code} />
                      <span className="hand-card-name">{card(p).name}</span>
                      <span className="hand-card-footer">
                        <ResourceIcons items={resources(card(p))} />
                        {!disabled ? (
                          <span>
                            PLAY <CaretRight size={12} weight="fill" />
                          </span>
                        ) : card(p).type_code === "resource" ? (
                          <span>RESOURCE</span>
                        ) : reactionCardsUI.includes(p.code) ? (
                          <span>REACTION</span>
                        ) : (
                          <span>
                            <Eye size={12} />
                          </span>
                        )}
                      </span>
                    </button>
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
        <aside className="mission-rail">
          <ActionDirector game={game} send={send} inspect={inspect} />
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
                <ShieldCheck size={14} /> Progress saved on this device
              </div>
            </section>
          )}
        </aside>
      </div>
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
                  <img src={imageFor(p.code)} alt="" />
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
const reactionCardsUI = ["01003", "01004", "01061", "01077", "01078", "01085"];
function Collection({ onInspect }: { onInspect: (code: string) => void }) {
  const [q, setQ] = useState("");
  const [faction, setFaction] = useState("all");
  const [type, setType] = useState("all");
  const cards = CARDS.filter(
    (c) =>
      (!q ||
        `${c.name} ${c.traits || ""} ${plain(c.text)}`
          .toLowerCase()
          .includes(q.toLowerCase())) &&
      (faction === "all" || c.faction_code === faction) &&
      (type === "all" || c.type_code === type),
  );
  return (
    <main id="main-content" className="collection page-width">
      <div className="collection-title">
        <span className="comic-caption">THE S.H.I.E.L.D. ARCHIVES</span>
        <h1>
          KNOW YOUR <span>SUPERPOWERS.</span>
        </h1>
        <p>
          209 card faces. Every ally, every threat, every ace up your sleeve.
        </p>
      </div>
      <div className="collection-toolbar">
        <label className="search-box">
          <MagnifyingGlass size={19} />
          <input
            placeholder="Search by name, trait, or card text…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search cards"
          />
          {q && (
            <button
              className="icon-button"
              onClick={() => setQ("")}
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </label>
        <select
          value={faction}
          onChange={(e) => setFaction(e.target.value)}
          aria-label="Filter card faction"
        >
          <option value="all">All factions</option>
          {[
            "hero",
            "justice",
            "aggression",
            "leadership",
            "protection",
            "basic",
            "encounter",
          ].map((f) => (
            <option key={f} value={f}>
              {f[0].toUpperCase() + f.slice(1)}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          aria-label="Filter card type"
        >
          <option value="all">All card types</option>
          {[...new Set(CARDS.map((c) => c.type_code))].sort().map((t) => (
            <option value={t} key={t}>
              {t.replace("_", " ")}
            </option>
          ))}
        </select>
        <span aria-live="polite">{cards.length} card faces</span>
        {(faction !== "all" || type !== "all") && (
          <button
            className="text-button"
            onClick={() => {
              setFaction("all");
              setType("all");
              setQ("");
            }}
          >
            Clear filters <X size={14} />
          </button>
        )}
      </div>
      {cards.length ? (
        <div className="collection-grid">
          {cards.map((c) => (
            <button
              key={c.code}
              className="collection-card"
              onClick={() => onInspect(c.code)}
            >
              <CardImage code={c.code} />
              <strong>{c.name}</strong>
              <span>
                {c.type_code.replace("_", " ")}
                <small>#{c.code}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-results">
          <MagnifyingGlass size={40} />
          <h2>No cards found</h2>
          <p>Try a different name or clear the filters.</p>
          <button
            className="secondary-button"
            onClick={() => {
              setQ("");
              setFaction("all");
              setType("all");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
    </main>
  );
}
function Help({ onClose }: { onClose: () => void }) {
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
            text: "The action panel groups each action into one summary. Click Proceed to continue; nothing advances on a timer. Choose defenders before boosts. Any ready hero or ally can defend for a teammate.",
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
        Core-set missions support 1–3 heroes controlled by you. Online co-op and
        custom deck building are not included.
      </p>
    </Modal>
  );
}
