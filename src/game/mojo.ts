import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** MojoMania, the box's third scenario: Mojo puts threat on the heroes'
 * characters, and the Wheel of Genres brings in a set-aside modular set
 * each time the encounter deck resets. Also the one-card Longshot modular
 * set, which joins any scenario. */
export const MOJO_SCRIPT_CODES = [
  "39022",
  "39023",
  "39024",
  "39025a",
  "39025b",
  "39026a",
  "39026b",
  "39027",
  "39028",
  "39029",
  "39030",
  "39031",
  "39032",
  "39033",
  "39034",
] as const;
export const LONGSHOT_CODES = ["39071"] as const;

export const MOJOMANIA = "39025b";
export const WHEEL_SPINNING = "39026a";
export const WHEEL_STOPPED = "39026b";
export const MAJOR_DOMO = "39027";
export const STINGER_TAIL = "39028";
const SUPPORTING_ACTOR = "39029";
export const PAPARAZZI = "39030";
export const UNDERCOVER_MOJO = "39031";
const CURTAIN_CALL = "39032";
const DIRECTORS_DIRECTIONS = "39033";
const TOP_BILLING = "39034";
export const LONGSHOT = "39071";
/** Cards Mojo discards after each hero's turn, by stage. */
const MOJO_DISCARDS: Record<string, number> = {
  "39022": 3,
  "39023": 4,
  "39024": 5,
};
/** Threat Mojo (II) and (III) put on each friendly character when revealed. */
const MOJO_REVEAL_THREAT: Record<string, number> = { "39023": 2, "39024": 3 };

export interface MojoSetAside {
  set: string;
  pieces: Piece[];
}
export interface MojoState {
  /** The chosen modular sets not in the encounter deck yet. */
  setAside: MojoSetAside[];
}

export interface MojoPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  putEnvironment(s: GameState, p: Piece): void;
  makePiece(s: GameState, code: string): Piece;
  shuffle(s: GameState, pieces: Piece[]): Piece[];
  pick(s: GameState, n: number): number;
  endGame(s: GameState, won: boolean, reason: string): void;
  revealShow(s: GameState, p: Piece): void;
  dealPiece(s: GameState, p: Piece, playerId: string): void;
  /** Each character a player controls: their identity and allies. */
  characters(s: GameState, playerId: string): string[];
  heal(s: GameState, target: string, amount: number, playerId: string): void;
  revealBoostCard(s: GameState, p: Piece): void;
  discardHandCard(s: GameState, playerId: string, id: string): void;
  /** Spend two resources of different types; not cancelable. */
  canPayDifferent(s: GameState, code: string): boolean;
  payDifferent(s: GameState, title: string, code: string): void;
  /** Resolve an ally entering play under the active player's control. */
  allyEntered(s: GameState, p: Piece): void;
  characterName(s: GameState, target: string): string;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const MJ = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `mojo:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const over = (s: GameState) => s.phase === "won" || s.phase === "lost";
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);

export const mojoScenario = (s: GameState) => !!s.mojo;
/** Cards Mojo's current stage discards after each hero's turn. */
export const mojoDiscards = (s: GameState) =>
  MOJO_DISCARDS[s.villain?.code || ""] || 0;

// ------------------------------------------------------ threat on characters

/** Threat on a character: an identity ("hero:p1") or a piece in play. */
export function characterThreat(s: GameState, target: string): number {
  if (target.startsWith("hero:"))
    return seatView(s, target.slice(5)).player.mojoThreat || 0;
  const p =
    s.minions.find((q) => q.id === target) ||
    s.players
      .flatMap((seat) => seatView(s, seat).player.inPlay)
      .find((q) => q.id === target);
  return p?.mojoThreat || 0;
}
function setCharacterThreat(s: GameState, target: string, n: number) {
  if (target.startsWith("hero:")) {
    seatView(s, target.slice(5)).player.mojoThreat = Math.max(0, n);
    return;
  }
  const p =
    s.minions.find((q) => q.id === target) ||
    s.players
      .flatMap((seat) => seatView(s, seat).player.inPlay)
      .find((q) => q.id === target);
  if (p) p.mojoThreat = Math.max(0, n);
}
/** MojoMania's Forced Interrupt: when a character flips or leaves play, all
 * of its threat moves to the main scheme. Returns the threat to place. */
export function mojoCharacterThreatLeaves(
  s: GameState,
  target: string,
): Effect[] {
  if (!s.mojo || s.scheme.code !== MOJOMANIA) return [];
  const n = characterThreat(s, target);
  if (!n) return [];
  setCharacterThreat(s, target, 0);
  return [{ type: "threat", target: "main", amount: n }];
}
/** Paparazzi stays in play and its Hinder 10 places threat on the card
 * itself, which is not a scheme. */
export function mojoThreatCard(s: GameState, target: string) {
  if (!s.mojo) return undefined;
  for (const seat of s.players) {
    const p = seatView(s, seat.id).player.inPlay.find(
      (q) => q.id === target && q.code === PAPARAZZI,
    );
    if (p) return p;
  }
  return undefined;
}
/** Place threat on characters; each target is "hero:<seat>" or a piece id. */
function placeThreat(targets: string[], amount: number): Effect[] {
  return amount > 0
    ? targets.map((target) => MJ("place", { target, amount }))
    : [];
}
/** Each friendly character: every identity and every ally in play. */
function friendly(s: GameState, ports: Pick<MojoPorts, "characters">) {
  return playerOrder(s)
    .filter((seat) => !seat.eliminated)
    .flatMap((seat) => ports.characters(s, seat.id));
}

// ------------------------------------------------------------------- setup

/** MojoMania (1A): the chosen modular sets are set aside and the Wheel of
 * Genres enters play Spinning; 1B's When Revealed then brings one set in at
 * random. */
export function mojoSetup(s: GameState, ports: MojoPorts, sets: string[]) {
  const setAside: MojoSetAside[] = [];
  for (const set of sets) {
    const pieces = s.encounter.deck.filter((p) => def(p)?.set_code === set);
    if (!pieces.length) continue;
    s.encounter.deck = s.encounter.deck.filter((p) => !pieces.includes(p));
    setAside.push({ set, pieces });
  }
  s.mojo = { setAside };
  ports.putEnvironment(s, ports.makePiece(s, WHEEL_SPINNING));
  s.scheme.threat = (def(MOJOMANIA)?.base_threat || 0) * s.playerCount;
  // MojoMania (1B) When Revealed: one set-aside set at random reveals its
  // Show and shuffles its other cards into the encounter deck.
  if (!setAside.length) return;
  const [group] = setAside.splice(ports.pick(s, setAside.length), 1);
  const show = group.pieces.find(isShowPiece);
  const rest = group.pieces.filter((p) => p !== show);
  s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, ...rest]);
  if (show) ports.putEnvironment(s, show);
}
const isShowPiece = (p: Piece) =>
  (def(p)?.traits || "").split(/\.\s*/).includes("Show");

// --------------------------------------------------------------- the wheel

/** Wheel of Genres (Spinning): after the encounter deck resets, the players
 * lose with no set-aside set left; otherwise it flips to Stopped. */
export function mojoEncounterReset(s: GameState): Effect[] {
  const wheel = (s.environments || []).find((p) => p.code === WHEEL_SPINNING);
  return s.mojo && wheel && active(s, wheel) ? [MJ("wheel-reset")] : [];
}
/** Wheel of Genres (Stopped): at the start of villain phase step three. */
export function mojoDealStep(s: GameState): Effect[] {
  const wheel = (s.environments || []).find((p) => p.code === WHEEL_STOPPED);
  return s.mojo && wheel && active(s, wheel)
    ? [MJ("wheel-stop", { actorId: s.firstPlayerId })]
    : [];
}

// ------------------------------------------------------------ the villain

/** Mojo (Hero): after your turn ends, discard 3/4/5 encounter cards and put
 * 1 threat on your hero for each that is not from the Mojo set. */
export function mojoTurnEnded(s: GameState, playerId: string): Effect[] {
  if (over(s)) return [];
  const out: Effect[] = [];
  // Paparazzi (interrupt): when your turn ends, its threat moves to the main
  // scheme. Mojo's response follows.
  for (const p of seatView(s, playerId).player.inPlay.filter(
    (q) => q.code === PAPARAZZI && active(s, q),
  ))
    out.push(MJ("paparazzi-end", { id: p.id, playerId }));
  const n =
    s.mojo && s.villain && active(s, s.villain)
      ? MOJO_DISCARDS[s.villain.code]
      : 0;
  if (n && seatView(s, playerId).player.form === "hero")
    out.push(MJ("ratings-discard", { playerId, n }));
  return out;
}
/** Mojo (II) and (III) When Revealed: threat on each friendly character. */
export function mojoVillainRevealed(
  s: GameState,
  ports: Pick<MojoPorts, "characters">,
): Effect[] {
  const n = MOJO_REVEAL_THREAT[s.villain?.code || ""];
  return s.mojo && n && active(s, s.villain)
    ? placeThreat(friendly(s, ports), n)
    : [];
}

// ----------------------------------------------------------- encounter cards

/** Stinger Tail: retaliate 2 while attached to Mojo. */
export function mojoKeyword(s: GameState, p: Piece, keyword: string): number {
  if (keyword !== "Retaliate" || !s.villain || p.id !== s.villain.id) return 0;
  return s.attachments.some(
    (a) => a.attachedTo === p.id && a.code === STINGER_TAIL && active(s, a),
  )
    ? 2
    : 0;
}
/** Damage that would be dealt to Mojo: Stinger Tail takes it, or Undercover
 * Mojo loses that much threat instead. Returns the damage still dealt. */
export function mojoDamageReplaced(
  s: GameState,
  target: string,
  n: number,
): { amount: number; effects: Effect[] } {
  if (!s.mojo || !s.villain || target !== s.villain.id || n <= 0)
    return { amount: n, effects: [] };
  const tail = s.attachments.find(
    (a) =>
      a.attachedTo === s.villain.id && a.code === STINGER_TAIL && active(s, a),
  );
  if (tail) {
    tail.damage = (tail.damage || 0) + n;
    return {
      amount: 0,
      effects: tail.damage >= 5 ? [{ type: "discardPiece", id: tail.id }] : [],
    };
  }
  const undercover = s.sideSchemes.find(
    (p) => p.code === UNDERCOVER_MOJO && active(s, p) && p.counters > 0,
  );
  if (undercover)
    return {
      amount: 0,
      effects: [
        { type: "thwart", target: undercover.id, amount: n, source: "mojo" },
      ],
    };
  return { amount: n, effects: [] };
}
/** Supporting Actor, after it activates against you; Major Domo, after Mojo
 * attacks. */
export function mojoActivated(
  s: GameState,
  enemyId: string,
  attack: boolean,
  damage: number,
): Effect[] {
  if (!s.mojo || over(s)) return [];
  const out: Effect[] = [];
  const m = s.minions.find((q) => q.id === enemyId);
  if (m?.code === SUPPORTING_ACTOR && active(s, m))
    out.push(MJ("place", { target: m.id, amount: 2 }));
  if (
    attack &&
    enemyId === s.villain?.id &&
    damage > 0 &&
    s.attachments.some(
      (a) => a.attachedTo === enemyId && a.code === MAJOR_DOMO && active(s, a),
    )
  )
    out.push(MJ("domo-discard", { n: damage }));
  return out;
}

export function mojoReveal(s: GameState, p: Piece): Effect[] | null {
  if (p.code === LONGSHOT) return [MJ("longshot", { piece: p })];
  if (!(MOJO_SCRIPT_CODES as readonly string[]).includes(p.code)) return null;
  if (p.code === MAJOR_DOMO || p.code === STINGER_TAIL)
    return [MJ("attach", { piece: p })];
  if (isTextBlank(s, p)) return [];
  const playerId = s.activePlayerId;
  switch (p.code) {
    case CURTAIN_CALL:
      return [MJ("curtain-call", { playerId })];
    case DIRECTORS_DIRECTIONS:
      return [MJ("directions", { playerId, id: p.id })];
    case TOP_BILLING:
      return [MJ("top-billing", { playerId })];
    default:
      return [];
  }
}
export function mojoBoost(s: GameState, p: Piece): Effect[] | null {
  // Longshot as a boost card has no boost icons.
  if (p.code === LONGSHOT) return [];
  if (!(MOJO_SCRIPT_CODES as readonly string[]).includes(p.code)) return null;
  if (isTextBlank(s, p)) return [];
  const playerId = s.attack?.targetPlayerId || s.activePlayerId;
  switch (p.code) {
    case STINGER_TAIL:
      return [MJ("boost-attach", { id: p.id })];
    case CURTAIN_CALL:
      return [MJ("boost-reveal", { id: p.id })];
    case SUPPORTING_ACTOR:
    case TOP_BILLING:
      return [MJ("each-mine", { playerId, amount: 1 })];
    default:
      return [];
  }
}

// ----------------------------------------------------------------- actions

/** Paparazzi's Action and Major Domo's Hero Action belong to no player
 * card. */
export function mojoActionSource(s: GameState, id: string): Piece | undefined {
  if (!s.mojo) return undefined;
  return (
    s.player.inPlay.find((p) => p.id === id && p.code === PAPARAZZI) ||
    s.attachments.find((p) => p.id === id && p.code === MAJOR_DOMO)
  );
}
export function mojoActions(
  s: GameState,
  p: Piece,
  ports: Pick<MojoPorts, "canPay" | "characters">,
): Option[] {
  if (!s.mojo || !active(s, p) || s.phase !== "player") return [];
  // Paparazzi: exhaust a character you control or discard a card from your
  // hand → remove 2 threat from here, 3 in alter-ego form.
  if (
    p.code === PAPARAZZI &&
    s.player.inPlay.some((q) => q.id === p.id) &&
    p.counters > 0
  ) {
    const amount = s.player.form === "alter" ? 3 : 2;
    const out: Option[] = [];
    if (s.player.hand.length)
      out.push({
        id: "discard",
        label: `Action · discard a card from your hand · remove ${amount} threat`,
        image: p.code,
        effects: [MJ("paparazzi-discard", { id: p.id, amount })],
      });
    if (
      !s.player.exhausted ||
      s.player.inPlay.some((q) => def(q)?.type_code === "ally" && !q.exhausted)
    )
      out.push({
        id: "exhaust",
        label: `Action · exhaust a character you control · remove ${amount} threat`,
        image: p.code,
        effects: [MJ("paparazzi-exhaust", { id: p.id, amount })],
      });
    return out;
  }
  // Major Domo: spend an energy, a mental and a physical resource → discard.
  if (
    p.code === MAJOR_DOMO &&
    s.player.form === "hero" &&
    ports.canPay(s, 3, ["energy", "mental", "physical"])
  )
    return [
      {
        id: "discard",
        label:
          "Hero Action · spend energy, mental and physical · discard Major Domo",
        image: p.code,
        effects: [MJ("domo-pay", { id: p.id })],
      },
    ];
  return [];
}

// ---------------------------------------------------------------- resolver

export function resolveMojoEffect(
  s: GameState,
  e: Effect,
  ports: MojoPorts,
): boolean {
  if (!e.type.startsWith("mojo:")) return false;
  const st = s.mojo;
  switch (e.type) {
    case "mojo:place": {
      if (over(s)) break;
      setCharacterThreat(s, e.target, characterThreat(s, e.target) + e.amount);
      break;
    }
    case "mojo:each-mine":
      if (alive(s, e.playerId))
        ports.queue(
          s,
          ...placeThreat(ports.characters(s, e.playerId), e.amount),
        );
      break;
    case "mojo:bring-in": {
      if (!st?.setAside.length) break;
      const [group] = st.setAside.splice(ports.pick(s, st.setAside.length), 1);
      const show = group.pieces.find(isShowPiece);
      const rest = group.pieces.filter((p) => p !== show);
      ports.log(
        s,
        `The Wheel of Genres lands on ${name(show || group.pieces[0])}.`,
      );
      if (e.shuffle)
        s.encounter.deck = ports.shuffle(s, [...s.encounter.deck, ...rest]);
      else s.encounter.deck.unshift(...ports.shuffle(s, rest));
      delete s.encounter.knownTop;
      if (show) ports.revealShow(s, show);
      break;
    }
    case "mojo:wheel-reset": {
      const wheel = (s.environments || []).find(
        (p) => p.code === WHEEL_SPINNING,
      );
      if (!wheel) break;
      if (!st?.setAside.length) {
        ports.endGame(
          s,
          false,
          "The Wheel of Genres has nothing left to spin. MojoMania wins.",
        );
        break;
      }
      wheel.code = WHEEL_STOPPED;
      ports.log(s, "The Wheel of Genres stops.", "bad");
      break;
    }
    case "mojo:wheel-stop": {
      const wheel = (s.environments || []).find(
        (p) => p.code === WHEEL_STOPPED,
      );
      if (!wheel) break;
      ports.queue(
        s,
        MJ("bring-in", { shuffle: false }),
        MJ("deal-first", { n: 2, actorId: s.firstPlayerId }),
        MJ("wheel-spin"),
      );
      break;
    }
    case "mojo:deal-first":
      for (let i = 0; i < e.n; i++) ports.dealEncounter(s, s.firstPlayerId);
      break;
    case "mojo:wheel-spin": {
      const wheel = (s.environments || []).find(
        (p) => p.code === WHEEL_STOPPED,
      );
      if (wheel) wheel.code = WHEEL_SPINNING;
      break;
    }
    case "mojo:ratings-discard": {
      // Mojo: discard the top cards; each one not from the Mojo set puts 1
      // threat on your hero.
      if (!alive(s, e.playerId)) break;
      let outsiders = 0;
      for (let i = 0; i < e.n; i++) {
        const { piece, emptied } = ports.discardTop(s);
        if (piece && def(piece)?.set_code !== "mojo") outsiders++;
        if (emptied) break;
      }
      if (outsiders)
        ports.queue(
          s,
          MJ("place", { target: `hero:${e.playerId}`, amount: outsiders }),
        );
      break;
    }
    case "mojo:domo-discard":
      for (let i = 0; i < e.n; i++) {
        const { emptied } = ports.discardTop(s);
        if (emptied) break;
      }
      break;
    case "mojo:attach": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "mojo:boost-attach": {
      const p = s.resolving.find((q) => q.id === e.id);
      if (p && s.villain) ports.revealBoostCard(s, p);
      break;
    }
    case "mojo:boost-reveal": {
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.revealBoostCard(s, p);
      break;
    }
    case "mojo:paparazzi-end": {
      const view = seatView(s, e.playerId);
      const p = view.player.inPlay.find((q) => q.id === e.id);
      if (!p) break;
      const n = p.counters;
      p.counters = 0;
      ports.queue(
        s,
        ...(n ? [{ type: "threat", target: "main", amount: n }] : []),
        { type: "discardPiece", id: p.id },
      );
      break;
    }
    case "mojo:curtain-call": {
      // Move all threat from the character with the most threat to the main
      // scheme; with no threat moved, 1 threat on each character you control.
      // Minions are characters too: a Supporting Actor can hold threat.
      const all = [...friendly(s, ports), ...s.minions.map((m) => m.id)].map(
        (target) => ({ target, n: characterThreat(s, target) }),
      );
      const most = Math.max(0, ...all.map((x) => x.n));
      const tied = all.filter((x) => most && x.n === most);
      if (tied.length === 1)
        ports.queue(s, MJ("curtain-move", { target: tied[0].target }));
      else if (tied.length)
        ports.choose(
          s,
          name(CURTAIN_CALL),
          `Choose the character with ${most} threat whose threat moves to the main scheme.`,
          tied.map(({ target }) => ({
            id: target,
            label: ports.characterName(s, target),
            effects: [MJ("curtain-move", { target })],
          })),
        );
      else if (alive(s, e.playerId))
        ports.queue(s, ...placeThreat(ports.characters(s, e.playerId), 1));
      break;
    }
    case "mojo:curtain-move": {
      const n = characterThreat(s, e.target);
      if (!n) break;
      setCharacterThreat(s, e.target, 0);
      ports.queue(s, { type: "threat", target: "main", amount: n });
      break;
    }
    case "mojo:top-billing": {
      if (!alive(s, e.playerId)) break;
      const mine = ports.characters(s, e.playerId);
      for (const target of mine) ports.heal(s, target, 1, e.playerId);
      ports.queue(s, ...placeThreat(mine, 2));
      break;
    }
    case "mojo:directions": {
      if (!alive(s, e.playerId)) break;
      const n = characterThreat(s, `hero:${e.playerId}`);
      const options: Option[] = [
        {
          id: "damage",
          label: `Take ${n} damage${n < 2 ? " · this card gains surge" : ""}`,
          effects: [
            ...(n
              ? [
                  {
                    type: "damage",
                    target: "hero",
                    amount: n,
                    source: e.id,
                    actorId: e.playerId,
                  },
                ]
              : []),
            ...(n < 2
              ? [{ type: "surge", sourceCode: DIRECTORS_DIRECTIONS }]
              : []),
          ],
        },
        {
          id: "scheme",
          label: "Mojo schemes",
          effects: s.villain
            ? [{ type: "enemyScheme", id: s.villain.id, actorId: e.playerId }]
            : [],
        },
      ];
      if (ports.canPayDifferent(s, DIRECTORS_DIRECTIONS))
        options.unshift({
          id: "pay",
          label: "Spend 2 different resources",
          effects: [MJ("directions-pay")],
        });
      ports.choose(s, name(DIRECTORS_DIRECTIONS), "Choose one.", options);
      break;
    }
    case "mojo:directions-pay":
      ports.payDifferent(s, name(DIRECTORS_DIRECTIONS), DIRECTORS_DIRECTIONS);
      break;
    case "mojo:longshot": {
      // Put Longshot into play under your control; it gains surge.
      const p = e.piece as Piece;
      s.resolving = s.resolving.filter((q) => q.id !== p.id);
      p.ownerId = undefined;
      seatView(s, s.activePlayerId).player.inPlay.push(p);
      ports.log(s, "Longshot joins the heroes.", "good");
      ports.queue(s, { type: "surge", sourceCode: LONGSHOT });
      ports.allyEntered(s, p);
      break;
    }
    case "mojo:discard-hand":
      ports.discardHandCard(s, s.activePlayerId, e.id);
      break;
    case "mojo:paparazzi-remove": {
      const p = s.player.inPlay.find((q) => q.id === e.id);
      if (p) p.counters = Math.max(0, p.counters - e.amount);
      break;
    }
    case "mojo:domo-pay":
      ports.pay(
        s,
        3,
        ["energy", "mental", "physical"],
        [{ type: "discardPiece", id: e.id }],
        name(MAJOR_DOMO),
        true,
      );
      break;
    case "mojo:paparazzi-discard":
      ports.choose(
        s,
        name(PAPARAZZI),
        "Discard a card from your hand.",
        s.player.hand.map((q) => ({
          id: q.id,
          label: name(q),
          image: q.code,
          effects: [
            MJ("discard-hand", { id: q.id }),
            MJ("paparazzi-remove", { id: e.id, amount: e.amount }),
          ],
        })),
      );
      break;
    case "mojo:paparazzi-exhaust": {
      const options: Option[] = [];
      if (!s.player.exhausted)
        options.push({
          id: "hero",
          label: "Exhaust your identity",
          effects: [
            { type: "exhaust", id: "hero" },
            MJ("paparazzi-remove", { id: e.id, amount: e.amount }),
          ],
        });
      for (const q of s.player.inPlay.filter(
        (x) => def(x)?.type_code === "ally" && !x.exhausted,
      ))
        options.push({
          id: q.id,
          label: `Exhaust ${name(q)}`,
          image: q.code,
          effects: [
            { type: "exhaust", id: q.id },
            MJ("paparazzi-remove", { id: e.id, amount: e.amount }),
          ],
        });
      ports.choose(
        s,
        name(PAPARAZZI),
        "Exhaust a character you control.",
        options,
      );
      break;
    }
    default:
      throw Error(`Unknown Mojo effect: ${e.type}`);
  }
  return true;
}
