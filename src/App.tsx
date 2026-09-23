import { useEffect, useRef, useState } from "react";
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
} from "./game/engine";
import type { Aspect, Command, GameState, Piece, Resource } from "./game/types";

type Screen = "lobby" | "game" | "collection";
type Inspect = { code: string; piece?: Piece; hand?: boolean };
const resIcon = {
  energy: Lightning,
  mental: Brain,
  physical: Fist,
  wild: Star,
};
const aspectStyle = (color: string) => ({ "--accent": color }) as CSSProperties;
function ResourceIcons({ items }: { items: Resource[] }) {
  return (
    <span className="resources">
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
  useEffect(() => setFailed(false), [code]);
  return (
    <div className={`card-image ${className}`} onClick={onClick}>
      {!failed ? (
        <img
          draggable={false}
          src={imageFor(code)}
          alt={card(code)?.name || "Card"}
          onError={() => setFailed(true)}
        />
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
  eyebrow = "MARVEL CHAMPIONS",
}: {
  title: string;
  children: ReactNode;
  onClose?: () => void;
  wide?: boolean;
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
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={`modal ${wide ? "wide" : ""}`}
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
    </div>
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
  return (
    <span className="statuses">
      {piece.tough && <span className="tough">Tough</span>}
      {piece.stunned && <span className="stunned">Stunned</span>}
      {piece.confused && <span className="confused">Confused</span>}
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
      return a;
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
  const [hero, setHero] = useState(HEROES[0]);
  const [aspect, setAspect] = useState<Aspect>("justice");
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
              selectedVillain: villain.name,
              aspect,
              difficulty,
            },
      );
    (window as any).advanceTime = () => {};
  }, [screen, hero, villain, aspect, difficulty]);
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
                  <User size={16} /> Solo adventure
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
          <div className="setup-grid">
            <section id="hero-setup" className="hero-setup">
              <div className="section-heading">
                <div>
                  <span className="step-number">01</span>
                  <h2>CHOOSE YOUR HERO</h2>
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
              <div className="mission-loadout">
                <Shield size={20} />
                <span>
                  <b>{hero.name}</b>
                  <small>
                    {ASPECTS.find((a) => a.id === aspect)?.name} · 40-card
                    starter deck
                  </small>
                </span>
                <CheckCircle size={19} weight="fill" />
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
          onEnd={() => setEndTurn(true)}
          onHome={() => setScreen("lobby")}
          onHelp={() => setHelp(true)}
        />
      )}
      {game?.error && <span className="sr-only">{game.error}</span>}
      {screen === "game" && game?.phase === "mulligan" && (
        <CardSelection
          title="Your opening hand"
          text="Keep the cards you want. Select any cards to replace once before your first turn."
          pieces={game.player.hand}
          min={0}
          max={game.player.hand.length}
          mode="mulligan"
          onConfirm={(ids) => send({ type: "MULLIGAN", ids })}
        />
      )}
      {screen === "game" && game?.prompt && !inspect && (
        <Decision
          key={`${game.prompt.title}-${game.prompt.kind}-${game.nextId}`}
          game={game}
          send={send}
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
                    {playable(game, inspect.piece) ||
                      `Pay ${Math.max(0, (card(inspect.code).cost || 0) - Number(game.flags.discount || 0))} resources to play this card.`}
                  </p>
                  <button
                    className="primary-button"
                    disabled={!!playable(game, inspect.piece)}
                    onClick={() => {
                      const id = inspect.piece!.id;
                      setInspect(null);
                      send({ type: "PLAY", id });
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
      {screen === "game" && game && ["won", "lost"].includes(game.phase) && (
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
                      heroId: game.heroId,
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
function Decision({
  game: s,
  send,
}: {
  game: GameState;
  send: (c: Command) => void;
}) {
  const p = s.prompt!;
  const [selected, setSelected] = useState<string[]>([]);
  const [wild, setWild] = useState<Resource>(p.wildAs || "energy");
  const toggle = (id: string) =>
    setSelected(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  const sources =
    p.kind === "payment" ? paymentSources(s, p.card?.id, p.paymentTarget) : [];
  const total = sources
    .filter((x) => selected.includes(x.id))
    .reduce((n, x) => n + x.resources.length, 0);
  return (
    <Modal
      title={p.title}
      wide={p.kind === "payment"}
      eyebrow={
        p.kind === "payment"
          ? "POWER YOUR NEXT MOVE"
          : s.phase === "villain"
            ? "INCOMING THREAT · YOUR RESPONSE"
            : "THE NEXT MOVE IS YOURS"
      }
      onClose={p.cancelable ? () => send({ type: "CANCEL" }) : undefined}
    >
      <p className="modal-intro">{p.text}</p>
      {p.kind === "payment" ? (
        <>
          <div
            className={`payment-summary ${total >= (p.cost || 0) ? "ready" : ""}`}
            role="status"
          >
            <Lightning size={21} weight="fill" />
            <span>
              <b>
                {Math.max(0, (p.cost || 0) - total) > 0
                  ? `${(p.cost || 0) - total} more resources needed`
                  : "Resource cost covered"}
              </b>
              <small>
                {total > (p.cost || 0)
                  ? `${total - (p.cost || 0)} extra resources will be spent.`
                  : "Select cards to spend or abilities to use below."}
              </small>
            </span>
            <strong>
              {total}
              <small> / {p.cost || 0}</small>
            </strong>
          </div>
          <div className="payment-layout">
            {p.card && (
              <div className="payment-card">
                <CardImage code={p.card.code} />
                <div className="payment-total">
                  <strong>{total}</strong>
                  <span>/ {p.cost} resources</span>
                </div>
              </div>
            )}
            <div className="payment-sources">
              <span className="small-label">AVAILABLE RESOURCES</span>
              {sources.map((x) => (
                <button
                  key={x.id}
                  className={`payment-source ${selected.includes(x.id) ? "selected" : ""}`}
                  aria-pressed={selected.includes(x.id)}
                  onClick={() => toggle(x.id)}
                >
                  <span className="check-square">
                    {selected.includes(x.id) && (
                      <Check size={14} weight="bold" />
                    )}
                  </span>
                  <span>
                    <b>{x.name}</b>
                    <small>{x.description}</small>
                  </span>
                  <ResourceIcons items={x.resources} />
                </button>
              ))}
              {!sources.length && <p>No resources available.</p>}
              {sources.some(
                (x) => selected.includes(x.id) && x.resources.includes("wild"),
              ) && (
                <label className="wild-label">
                  Use wild resources as
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
              {!!p.requirements?.length && (
                <p className="payment-required">
                  Required: <ResourceIcons items={p.requirements} />
                </p>
              )}
            </div>
          </div>
          <div className="modal-actions">
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
              disabled={total < (p.cost || 0)}
              onClick={() => send({ type: "PAY", ids: selected, wildAs: wild })}
            >
              Spend {total} & resolve <ArrowRight size={18} />
            </button>
          </div>
        </>
      ) : p.kind === "select" ? (
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
function Tabletop({
  game: s,
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
  const h = HEROES.find((h) => h.id === s.heroId)!;
  const v = VILLAINS.find((v) => v.id === s.villainId)!;
  const stats = heroStats(s);
  const acting = s.phase === "player" && !s.prompt;
  const [handFilter, setHandFilter] = useState<"all" | "playable">("all");
  const playableHand = s.player.hand.filter((p) => !playable(s, p));
  const visibleHand = handFilter === "playable" ? playableHand : s.player.hand;
  const threatLimit = card(s.scheme.code).threat || 7;
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
    <main id="main-content" className="tabletop">
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
      <div className="mission-brief">
        <div>
          <span className="small-label">
            {v.location} · MISSION IN PROGRESS
          </span>
          <h1>
            {h.name} <span>vs.</span> {v.name}
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
      <div className={`table-layout ${logOpen ? "with-log" : ""}`}>
        <div className="playmat">
          <div className="zone-label">
            <span>
              <Skull size={17} weight="fill" /> VILLAIN TERRITORY
            </span>
            <span>{v.location}</span>
          </div>
          <section className="opposition">
            <div className="villain-area">
              <button
                className="table-card villain-card"
                onClick={() => inspect({ code: s.villain.code })}
              >
                <CardImage code={s.villain.code} />
                <span className="inspect-hint">
                  <Eye size={13} /> Inspect
                </span>
              </button>
              <div className="villain-info">
                <span className="small-label">
                  VILLAIN · STAGE {["", "I", "II", "III"][s.villain.stage]}
                </span>
                <h2>{v.name.toUpperCase()}</h2>
                <div className="health-display enemy">
                  <Heart size={19} weight="fill" />
                  <strong>{s.villain.hp}</strong>
                  <span>/ {s.villain.maxHp}</span>
                </div>
                <div className="health-track">
                  <i
                    style={{
                      width: `${(100 * s.villain.hp) / s.villain.maxHp}%`,
                    }}
                  />
                </div>
                <div className="enemy-stats">
                  <span>
                    <Fist size={13} />
                    {card(s.villain).attack} ATK
                  </span>
                  <span>
                    <Target size={13} />
                    {card(s.villain).scheme} SCH
                  </span>
                </div>
                <Status piece={s.villain} />
                {s.attachments
                  .filter((p) => p.attachedTo === s.villain.id)
                  .map((p) => (
                    <div className="attachment-row" key={p.id}>
                      <button onClick={() => inspect({ code: p.code })}>
                        {card(p).name} <Eye size={11} />
                      </button>
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
                          disabled={!acting || s.player.form !== "hero"}
                          onClick={() => send({ type: "ABILITY", id: p.id })}
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
              </div>
            </div>
            <div className={`main-scheme ${threatCritical ? "critical" : ""}`}>
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
              <div className="threat-display">
                <span>
                  <Target size={16} /> THREAT
                </span>
                <strong>
                  {s.scheme.threat}
                  <small> / {card(s.scheme.code).threat}</small>
                </strong>
              </div>
              <div className="threat-track">
                {Array.from(
                  { length: card(s.scheme.code).threat || 7 },
                  (_, i) => (
                    <i
                      className={i < s.scheme.threat ? "filled" : ""}
                      key={i}
                    />
                  ),
                )}
              </div>
              <p>
                +
                {(card(s.scheme.code).escalation_threat || 0) +
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
            <div className="encounter-zone">
              <div className="card-back encounter-back">
                <Skull size={32} />
                <span>ENCOUNTER</span>
                <b>{s.encounter.deck.length}</b>
              </div>
              <button
                className="pile-label"
                onClick={() =>
                  setPile({
                    title: "Encounter discard",
                    cards: s.encounter.discard,
                  })
                }
              >
                <Stack size={14} /> {s.encounter.discard.length} discarded{" "}
                <Eye size={12} />
              </button>
              {s.encounter.dealt.length > 0 && (
                <span className="encounter-dealt">
                  {s.encounter.dealt.length} dealt to you
                </span>
              )}
              {s.encounter.acceleration > 0 && (
                <span className="encounter-dealt">
                  +{s.encounter.acceleration} acceleration
                </span>
              )}
            </div>
          </section>
          {(s.minions.length > 0 || s.sideSchemes.length > 0) && (
            <div className="encounter-field">
              {s.minions.map((p) => (
                <button
                  className="enemy-tile"
                  key={p.id}
                  onClick={() => inspect({ code: p.code })}
                >
                  <div className="enemy-crop">
                    <img src={imageFor(p.code)} alt="" />
                  </div>
                  <span>
                    <strong>{card(p).name}</strong>
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
              ))}
              {s.sideSchemes.map((p) => (
                <button
                  className="side-scheme-tile"
                  key={p.id}
                  onClick={() => inspect({ code: p.code })}
                >
                  <Target size={24} />
                  <span>
                    <strong>{card(p).name}</strong>
                    <small>
                      {card(p).scheme_crisis
                        ? "Crisis · blocks main scheme"
                        : card(p).scheme_hazard
                          ? "Hazard · extra encounter"
                          : card(p).scheme_acceleration
                            ? "Acceleration · +1 threat"
                            : "Side scheme"}
                    </small>
                  </span>
                  <b>{p.counters}</b>
                </button>
              ))}
            </div>
          )}
          <div className="battle-divider">
            <i />
            <span>
              {h.name} <b>VS</b> {v.name}
            </span>
            <i />
          </div>
          <section className="player-area">
            <div className="identity-area">
              <button
                className={`table-card identity-card ${s.player.exhausted ? "is-exhausted" : ""}`}
                onClick={() => inspect({ code: heroCard(s).code })}
              >
                <CardImage code={heroCard(s).code} />
                {s.player.exhausted && (
                  <span className="exhausted-badge">EXHAUSTED</span>
                )}
              </button>
              <div className="identity-info">
                <span className="small-label">
                  {s.player.form === "hero" ? "YOUR HERO" : "YOUR ALTER-EGO"}
                </span>
                <h2>{heroCard(s).name}</h2>
                <div className="health-display">
                  <Heart size={17} weight="fill" />
                  <strong>{s.player.hp}</strong>
                  <span>/ {maxHP(s)}</span>
                </div>
                <div
                  className={`hero-health-track ${s.player.hp <= 3 ? "low" : ""}`}
                  role="meter"
                  aria-label="Hero health"
                  aria-valuemin={0}
                  aria-valuemax={maxHP(s)}
                  aria-valuenow={s.player.hp}
                >
                  <i style={{ width: `${(100 * s.player.hp) / maxHP(s)}%` }} />
                </div>
                <Status piece={s.player} />
                <p className="identity-power">{plain(heroCard(s).text)}</p>
                {abilityActive && (
                  <button
                    className="ability-button"
                    disabled={!acting}
                    onClick={() => send({ type: "ABILITY", id: "identity" })}
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
            </div>
            <div className="in-play-area">
              <div className="zone-label">
                <span>
                  <Shield size={15} /> YOUR REINFORCEMENTS
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
              {s.player.inPlay.length ? (
                <div className="in-play-cards">
                  {s.player.inPlay.map((p) => (
                    <div
                      className={`in-play-card ${p.exhausted ? "exhausted" : ""}`}
                      key={p.id}
                    >
                      <button
                        className="in-play-image"
                        onClick={() => inspect({ code: p.code, piece: p })}
                      >
                        <CardImage code={p.code} />
                        {p.exhausted && (
                          <span className="exhausted-badge">EXHAUSTED</span>
                        )}
                        {card(p).type_code === "ally" && (
                          <span className="mini-token">
                            <Heart size={10} weight="fill" />
                            {pieceHP(s, p) - p.damage}
                          </span>
                        )}
                        {p.counters > 0 && (
                          <span className="mini-token counter-token">
                            {p.counters}
                          </span>
                        )}
                      </button>
                      <Status piece={p} />
                      <div className="in-play-actions">
                        {abilityOptions(s, p).map((a) => (
                          <button
                            key={a.id}
                            disabled={!acting || !!a.disabled}
                            title={a.disabled || a.label}
                            onClick={() =>
                              send({ type: "ABILITY", id: p.id, action: a.id })
                            }
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-play">
                  <Stack size={30} weight="thin" />
                  <div>
                    <strong>Every hero needs a little backup.</strong>
                    <span>
                      Play allies, supports, and upgrades from your hand.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </section>
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
                    <Fist size={20} />
                    <span>
                      Attack <b>{stats.attack}</b>
                    </span>
                  </button>
                  <button
                    className="thwart-action"
                    title="Remove threat from a scheme. Exhaust your identity."
                    disabled={!acting || s.player.exhausted}
                    onClick={() => send({ type: "BASIC", action: "thwart" })}
                  >
                    <Target size={20} />
                    <span>
                      Thwart <b>{stats.thwart}</b>
                    </span>
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
                End hero phase <ArrowRight size={17} />
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
              <div className="player-piles">
                <div className="card-back player-back">
                  <Shield size={28} />
                  <span>HERO DECK</span>
                  <b>{s.player.deck.length}</b>
                </div>
                <button
                  className="pile-label"
                  onClick={() =>
                    setPile({
                      title: "Your discard pile",
                      cards: s.player.discard,
                    })
                  }
                >
                  <Trash size={13} />
                  {s.player.discard.length} discarded <Eye size={12} />
                </button>
              </div>
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
                        inspect({ code: p.code, piece: p, hand: true })
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
        {logOpen && (
          <aside className="battle-log">
            <div className="log-heading">
              <span>
                <ListBullets size={17} /> MISSION COMMS
              </span>
              <span className="live-dot" />
            </div>
            <div className="log-entries" ref={logRef}>
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
          </aside>
        )}
      </div>
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
            text: "End your phase to discard unwanted cards, refill your hand, and ready your cards. The villain adds threat, attacks or schemes, then reveals encounters.",
          },
          {
            icon: Users,
            title: "Call in reinforcements",
            text: "Allies can attack and thwart in either form, and defend against attacks. They take their printed consequential damage when using a basic power.",
          },
          {
            icon: BookOpen,
            title: "Read. React. Repeat.",
            text: "Reaction windows appear when relevant. Choose a defender before boost cards are revealed. Tough, stunned, and confused each cancel one applicable effect.",
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
        This first build supports solo core-set missions. Online co-op and
        custom deck building are not included.
      </p>
    </Modal>
  );
}
