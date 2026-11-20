import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import type { MutagenEnginePorts } from "./mutagen-formula.js";
import { playerOrder, seatView } from "./team.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

/** Age of Apocalypse's fifth scenario, En Sabah Nur: the game's first
 * three-sided villain. Apocalypse shifts between his Biomorph, Cyberpath
 * and Giant forms, each with its own keyword and a Forced Response when he
 * changes to it, while power counters on his main scheme dig out his
 * Superpowers. With the Celestial Tech and Clan Akkaba modular sets, which
 * join any scenario with modular sets. */

export const EN_SABAH_NUR_SCRIPT_CODES = [
  "45147a",
  "45147b",
  "45148a",
  "45148b",
  "45149",
  "45150",
  "45151",
  "45152",
  "45153",
  "45154",
  "45155",
  "45184a",
  "45184b",
  "45184c",
  "45185a",
  "45185b",
  "45185c",
  "45186a",
  "45186b",
  "45186c",
] as const;
export const CELESTIAL_TECH_CODES = ["45156", "45157", "45158"] as const;
export const CLAN_AKKABA_CODES = [
  "45159",
  "45160",
  "45161",
  "45162",
  "45163",
] as const;
/** The two modular sets, which join any scenario with modular sets. */
export const EN_SABAH_NUR_MODULAR_SETS = [
  "celestial_tech",
  "clan_akkaba",
] as const;
const ALL_CODES: readonly string[] = [
  ...EN_SABAH_NUR_SCRIPT_CODES,
  ...CELESTIAL_TECH_CODES,
  ...CLAN_AKKABA_CODES,
];

/** Apocalypse (I) to (III); a, b and c are his Biomorph, Cyberpath and
 * Giant forms. */
const STAGES = ["45184", "45185", "45186"];
export type EsnForm = "Biomorph" | "Cyberpath" | "Giant";
const FORMS: EsnForm[] = ["Biomorph", "Cyberpath", "Giant"];
const FORM_LETTER: Record<EsnForm, string> = {
  Biomorph: "a",
  Cyberpath: "b",
  Giant: "c",
};
export const PYRAMID = "45147b";
export const RISE = "45148b";
const STAGGERING = "45149";
const BIOMORPHIC_BLAST = "45150";
const INTERFACE = "45151";
const DESPOT = "45152";
const SOURCE_OF_POWER = "45153";
const PLUGGED_IN = "45154";
const GIANT_GROWTH = "45155";
const ARMOR = "45156";
const WEAPON = "45157";
const CELESTIAL_TECH = "45158";
const OZYMANDIAS = "45159";
const SCARAB = "45160";
const ZEALOT = "45161";
const TYRANT_WORSHIP = "45162";
export const ANCIENT_RITUAL = "45163";
/** The form each Superpower treachery and side scheme calls for. */
const FORM_OF: Record<string, EsnForm> = {
  [BIOMORPHIC_BLAST]: "Biomorph",
  [SOURCE_OF_POWER]: "Biomorph",
  [INTERFACE]: "Cyberpath",
  [PLUGGED_IN]: "Cyberpath",
  [DESPOT]: "Giant",
  [GIANT_GROWTH]: "Giant",
};
/** Power counters it takes to dig out a Superpower. */
export const POWER_LIMIT = 4;
/** Ancient Ritual's Forced Response threshold, and what it removes. */
const RITUAL_LIMIT = 10;
const RITUAL_REMOVE = 5;

export interface EnSabahNurState {
  /** Power counters on the main scheme. */
  power: number;
}

export interface EnSabahNurPorts extends MutagenEnginePorts {
  log(s: GameState, text: string, kind?: "info" | "good" | "bad"): void;
  /** Reveal an encounter card, removing it from its zone first. */
  reveal(s: GameState, p: Piece, playerId: string): void;
  indirect(
    s: GameState,
    playerId: string,
    amount: number,
    sourceId: string,
    title: string,
  ): void;
  /** Discard the top cards of the player's deck and return them. */
  mill(s: GameState, playerId: string, n: number): Piece[];
  discardFromHand(s: GameState, playerId: string, id: string): void;
}

const definitions = new Map(
  (catalog as unknown as Card[]).map((c) => [c.code, c]),
);
const def = (p: Piece | string) =>
  definitions.get(typeof p === "string" ? p : p.code);
const name = (p: Piece | string) =>
  def(p)?.name || (typeof p === "string" ? p : p.code);
const traits = (p: Piece | string) =>
  (def(p)?.traits || "").split(/\.\s*/).map((t) => t.trim());
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type: `esn:${type}`,
  ...args,
});
const alive = (s: GameState, playerId: string) =>
  s.players.some((p) => p.id === playerId && !p.eliminated);
const active = (s: GameState, p: Piece) => !isTextBlank(s, p);
const seats = (s: GameState) => playerOrder(s).filter((x) => !x.eliminated);
export const enSabahNur = (s: GameState) => !!s.enSabahNur;
const apocalypseInPlay = (s: GameState) =>
  !!s.villain && STAGES.includes(s.villain.code.slice(0, 5));
/** Apocalypse's stage, 1 to 3: the X of his forms' Forced Responses. */
export const esnStage = (s: GameState) =>
  apocalypseInPlay(s) ? STAGES.indexOf(s.villain.code.slice(0, 5)) + 1 : 0;
/** Apocalypse's current form. */
export function esnForm(s: GameState): EsnForm | undefined {
  if (!apocalypseInPlay(s)) return undefined;
  const letter = s.villain.code.slice(5);
  return FORMS.find((f) => FORM_LETTER[f] === letter);
}
const superpower = (p: Piece) => traits(p).includes("Superpower");
const celestial = (p: Piece) => traits(p).includes("Celestial");
const ritual = (s: GameState) =>
  s.sideSchemes.find((q) => q.code === ANCIENT_RITUAL);
/** The activation a boost card belongs to. */
const activation = (s: GameState) => s.scheming || s.attack;
/** The player a boost card's activation is against. */
const boostPlayer = (s: GameState) =>
  s.attack?.originalPlayerId || s.attack?.targetPlayerId || s.activePlayerId;

// ------------------------------------------------------------- interface

/** The villain label's form. */
export const esnFormLabel = (s: GameState) => (esnForm(s) || "").toUpperCase();
/** The line under Apocalypse's stats: what this form gives him and does
 * when he changes to it. */
export function esnCaption(s: GameState): string {
  const x = esnStage(s);
  switch (esnForm(s)) {
    case "Biomorph":
      return `Attacks gain overkill · on changing to Biomorph: ${x} indirect damage to each player`;
    case "Cyberpath":
      return `Retaliate 1 · on changing to Cyberpath: ${x} threat on each scheme`;
    case "Giant":
      return `Stalwart · on changing to Giant: he heals ${x}`;
    default:
      return "";
  }
}
/** The main scheme's power counters. */
export const esnPower = (s: GameState) => s.enSabahNur?.power || 0;
/** Ancient Ritual's caption. */
export const ANCIENT_RITUAL_CAPTION = `Permanent · at ${RITUAL_LIMIT} threat, ${RITUAL_REMOVE} come off and each of you is dealt a facedown card`;

// --------------------------------------------------------------- setup

/** Ancient Ritual (Setup) is not shuffled into the encounter deck. */
export const esnSetupCard = (code: string) => code === ANCIENT_RITUAL;
/** En Sabah Nur's Pyramid (1A): Apocalypse begins in his Biomorph form,
 * the first stage card's default face. */
export function esnSetup(s: GameState) {
  s.enSabahNur = { power: 0 };
  const c = def(PYRAMID);
  s.scheme.threat =
    (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
}
/** Ancient Ritual (Permanent, Setup) begins the game in play with the Clan
 * Akkaba set. */
export function esnRitualSetup(
  s: GameState,
  ports: { makePiece(s: GameState, code: string): Piece },
): void {
  if (ritual(s)) return;
  const p = ports.makePiece(s, ANCIENT_RITUAL);
  const c = def(ANCIENT_RITUAL);
  p.counters =
    (c?.base_threat || 0) * (c?.base_threat_fixed ? 1 : s.playerCount);
  s.sideSchemes.push(p);
}
/** En Sabah Nur's Pyramid (1A): each player is dealt a facedown encounter
 * card. */
export function esnSetupEffects(s: GameState): Effect[] {
  return s.enSabahNur
    ? seats(s).map((seat) => E("deal", { playerId: seat.id }))
    : [];
}

// ------------------------------------------------------------ main scheme

/** After step one of the villain phase: 1 power counter; at 4, the first
 * player removes 4 and digs out a Superpower. */
export function esnStepOne(s: GameState): Effect[] {
  if (!s.enSabahNur || ![PYRAMID, RISE].includes(s.scheme.code)) return [];
  return [E("power", { n: 1, check: true })];
}
/** The main scheme advanced: the old card's power counters leave with it,
 * and The Rise of Apocalypse (2A)'s When Revealed digs out a Superpower. */
export function esnMainAdvanced(s: GameState): Effect[] {
  if (!s.enSabahNur) return [];
  s.enSabahNur.power = 0;
  return s.scheme.code === RISE
    ? [E("dig", { playerId: s.firstPlayerId })]
    : [];
}

// ----------------------------------------------------------------- forms

/** Change Apocalypse to a form: not a defeat or a reveal, so he keeps his
 * damage, statuses and attachments. */
const changeForm = (form: EsnForm): Effect => E("form", { form });
/** Biomorph: Apocalypse's attacks gain overkill. */
export function esnOverkill(s: GameState, attackerId: string): boolean {
  return (
    esnForm(s) === "Biomorph" &&
    s.villain.id === attackerId &&
    active(s, s.villain)
  );
}

// ----------------------------------------------------------------- reveals

export function esnReveal(s: GameState, p: Piece): Effect[] | null {
  if (!ALL_CODES.includes(p.code)) return null;
  const playerId = s.activePlayerId;
  const resolving = s.resolving.some((q) => q.id === p.id);
  // Staggering Strength attaches to Apocalypse and changes him to Giant.
  if (p.code === STAGGERING)
    return resolving ? [E("staggering", { piece: p })] : [];
  // The Celestial attachments attach to the villain.
  if (p.code === ARMOR || p.code === WEAPON)
    return resolving ? [E("celestial-attach", { piece: p })] : [];
  if (isTextBlank(s, p)) return [];
  const form = FORM_OF[p.code];
  if (form && def(p)?.type_code === "treachery")
    return [E("superpower", { form, playerId })];
  switch (p.code) {
    case CELESTIAL_TECH:
      return [E("celestial-tech", { playerId })];
    case TYRANT_WORSHIP:
      return [E("ritual", { n: 5 })];
    default:
      return [];
  }
}

export function esnBoost(s: GameState, p: Piece): Effect[] | null {
  if (
    ![
      STAGGERING,
      BIOMORPHIC_BLAST,
      INTERFACE,
      DESPOT,
      OZYMANDIAS,
      ZEALOT,
      TYRANT_WORSHIP,
    ].includes(p.code)
  )
    return null;
  if (isTextBlank(s, p) || !activation(s)) return [];
  const playerId = boostPlayer(s);
  switch (p.code) {
    case STAGGERING:
      // After this activation, reveal this card.
      return [
        E("after", {
          id: p.id,
          effects: [E("reveal-boost", { id: p.id, playerId })],
        }),
      ];
    case BIOMORPHIC_BLAST:
    case INTERFACE:
    case DESPOT:
      // After this activation, change Apocalypse to that form.
      return [E("after", { effects: [changeForm(FORM_OF[p.code])] })];
    case ZEALOT:
      return [E("ritual", { n: 1 })];
    default:
      // Ozymandias and Tyrant Worship: 3 threat on Ancient Ritual, or this
      // card gains three boost icons.
      return [
        E("ritual-or-icons", {
          id: p.id,
          code: p.code,
          playerId,
          actorId: playerId,
        }),
      ];
  }
}
/** Ozymandias' and Tyrant Worship's chosen boost icons. */
export function esnBoostIcons(s: GameState, p: Piece): number {
  const a = activation(s);
  return a ? Number(s.flags[`esnIcons:${a.id}:${p.id}`] || 0) : 0;
}

// ------------------------------------------------------------- windows

/** The Superpower side schemes' When Defeated. */
export function esnSchemeDefeated(
  s: GameState,
  p: Piece,
  playerId: string,
): Effect[] {
  const form = FORM_OF[p.code];
  if (!form || def(p)?.type_code !== "side_scheme" || !active(s, p)) return [];
  return [E("superpower", { form, playerId, tough: true })];
}
/** Clan Akkaba Zealot's When Defeated: 2 threat on Ancient Ritual. */
export function esnMinionDefeated(s: GameState, m: Piece): Effect[] {
  return m.code === ZEALOT && active(s, m) ? [E("ritual", { n: 2 })] : [];
}
/** Scarab's Forced Response after it attacks: 1 threat on Ancient Ritual,
 * 3 if the attack defeated an ally. */
export function esnAttacked(
  s: GameState,
  attackerId: string,
  defeatedAlly: boolean,
): Effect[] {
  const m = s.minions.find((q) => q.id === attackerId);
  return m?.code === SCARAB && active(s, m)
    ? [E("ritual", { n: defeatedAlly ? 3 : 1 })]
    : [];
}
/** Ozymandias: when he schemes, the threat goes on Ancient Ritual. */
export function esnSchemeTarget(s: GameState, p: Piece): string | undefined {
  if (p.code !== OZYMANDIAS || !active(s, p)) return undefined;
  return ritual(s)?.id;
}
/** Ancient Ritual's Forced Response after threat is placed on it. */
export function esnThreatPlaced(s: GameState, p: Piece, n: number): Effect[] {
  return n > 0 && p.code === ANCIENT_RITUAL && active(s, p)
    ? [E("ritual-check")]
    : [];
}
/** The Forced Interrupts when an enemy activates against a player:
 * Staggering Strength stuns you when Apocalypse attacks you, Celestial
 * Weapon resolves when its villain attacks you and Celestial Armor when its
 * villain schemes against you. */
export function esnActivationInitiated(
  s: GameState,
  enemyId: string,
  playerId: string,
  kind: "attack" | "scheme",
): Effect[] {
  if (!alive(s, playerId)) return [];
  const out: Effect[] = [];
  for (const a of s.attachments.filter(
    (q) => q.attachedTo === enemyId && active(s, q),
  )) {
    if (
      kind === "attack" &&
      a.code === STAGGERING &&
      apocalypseInPlay(s) &&
      enemyId === s.villain.id
    )
      out.push(E("staggering-stun", { id: a.id, playerId }));
    if (kind === "attack" && a.code === WEAPON)
      out.push(E("weapon", { id: a.id, playerId }));
    if (kind === "scheme" && a.code === ARMOR)
      out.push(E("armor", { id: a.id, playerId }));
  }
  return out;
}

// ---------------------------------------------------------------- resolver

const resourceOf = (p: Piece) => {
  const c = def(p);
  return {
    energy: Number(c?.resource_energy || 0) > 0,
    mental: Number(c?.resource_mental || 0) > 0,
    physical: Number(c?.resource_physical || 0) > 0,
    wild: Number(c?.resource_wild || 0) > 0,
  };
};

export function resolveEnSabahNurEffect(
  s: GameState,
  e: Effect,
  ports: EnSabahNurPorts,
): boolean {
  if (!e.type.startsWith("esn:")) return false;
  const st = s.enSabahNur;
  switch (e.type) {
    case "esn:deal":
      if (alive(s, e.playerId)) ports.dealEncounter(s, e.playerId);
      break;
    case "esn:power": {
      // A power counter on the main scheme. After step one, at 4 the first
      // player removes 4 and digs out a Superpower.
      if (!st) break;
      st.power += Number(e.n);
      if (e.check && st.power >= POWER_LIMIT) {
        st.power -= POWER_LIMIT;
        ports.log(
          s,
          `${POWER_LIMIT} power counters come off the main scheme: the first player digs out a Superpower.`,
          "bad",
        );
        ports.queue(s, E("dig", { playerId: s.firstPlayerId }));
      }
      break;
    }
    case "esn:dig":
      // Discard until a Superpower card is discarded, and reveal it.
      for (let n = 0; n < 500; n++) {
        const { piece, emptied } = ports.discardTop(s);
        if (piece && superpower(piece)) {
          ports.reveal(
            s,
            piece,
            alive(s, e.playerId) ? String(e.playerId) : s.firstPlayerId,
          );
          break;
        }
        if (!piece || emptied) break;
      }
      break;
    case "esn:form": {
      // Not a defeat or a reveal: damage, statuses and attachments stay.
      const form = e.form as EsnForm;
      if (!apocalypseInPlay(s) || esnForm(s) === form) break;
      const stage = esnStage(s);
      s.villain.code = `${STAGES[stage - 1]}${FORM_LETTER[form]}`;
      ports.log(s, `Apocalypse changes to his ${form} form.`, "bad");
      // The new form's Forced Response.
      if (!active(s, s.villain)) break;
      if (form === "Biomorph")
        for (const seat of seats(s))
          ports.indirect(s, seat.id, stage, s.villain.id, name(s.villain));
      else if (form === "Cyberpath")
        ports.queue(
          s,
          { type: "threat", target: "main", amount: stage },
          ...s.sideSchemes.map((q) => ({
            type: "threat",
            target: q.id,
            amount: stage,
          })),
        );
      else
        ports.queue(s, {
          type: "heal",
          target: s.villain.id,
          amount: stage,
          origin: "encounter",
        });
      break;
    }
    case "esn:superpower": {
      // In that form he activates against you; otherwise he changes to it
      // with 1 power counter (treacheries) or a tough status card (side
      // schemes).
      if (!apocalypseInPlay(s)) break;
      if (esnForm(s) === e.form) {
        if (!alive(s, e.playerId)) break;
        ports.activate(s, {
          enemyId: s.villain.id,
          playerId: e.playerId,
          kind:
            seatView(s, e.playerId).player.form === "hero"
              ? "attack"
              : "scheme",
          modifier: 0,
        });
        break;
      }
      ports.queue(
        s,
        changeForm(e.form as EsnForm),
        e.tough
          ? { type: "status", target: s.villain.id, status: "tough" }
          : E("power", { n: 1 }),
      );
      break;
    }
    case "esn:staggering": {
      // Attach to Apocalypse and change him to his Giant form.
      const p = e.piece as Piece;
      if (!apocalypseInPlay(s)) {
        ports.discardPiece(s, p.id);
        break;
      }
      ports.attach(s, p, s.villain.id);
      ports.queue(s, changeForm("Giant"));
      break;
    }
    case "esn:staggering-stun": {
      // You are stunned; discard this card after this activation.
      if (!alive(s, e.playerId)) break;
      ports.queue(s, {
        type: "status",
        target: "hero",
        status: "stunned",
        actorId: e.playerId,
      });
      const a = activation(s);
      if (a) (a.afterActivation ||= []).push(E("discard", { id: e.id }));
      break;
    }
    case "esn:discard":
      if (s.attachments.some((q) => q.id === e.id)) ports.discardPiece(s, e.id);
      break;
    case "esn:celestial-attach": {
      const p = e.piece as Piece;
      if (s.villain) ports.attach(s, p, s.villain.id);
      else ports.discardPiece(s, p.id);
      break;
    }
    case "esn:celestial-tech": {
      // Each Celestial attachment resolves as if its villain had just
      // schemed against you and attacked you; with none on the villain, a
      // Celestial attachment is found and revealed.
      if (!alive(s, e.playerId)) break;
      const attached = s.attachments.filter(
        (a) => (a.code === ARMOR || a.code === WEAPON) && active(s, a),
      );
      if (attached.length) {
        ports.queue(
          s,
          ...attached.map((a) =>
            E(a.code === ARMOR ? "armor" : "weapon", {
              id: a.id,
              playerId: e.playerId,
            }),
          ),
        );
        break;
      }
      const found = [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) => celestial(p) && def(p)?.type_code === "attachment",
      );
      const choices = found.filter(
        (p, i) => found.findIndex((q) => q.code === p.code) === i,
      );
      if (!choices.length) {
        ports.shuffleEncounter(s);
        break;
      }
      if (choices.length === 1) {
        ports.queue(
          s,
          E("celestial-reveal", { id: choices[0].id, playerId: e.playerId }),
        );
        break;
      }
      ports.choose(
        s,
        name(CELESTIAL_TECH),
        "Search for a Celestial attachment and reveal it.",
        choices.map((p): Option => ({
          id: p.id,
          label: name(p),
          image: p.code,
          effects: [E("celestial-reveal", { id: p.id, playerId: e.playerId })],
        })),
      );
      break;
    }
    case "esn:celestial-reveal": {
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (q) => q.id === e.id,
      );
      if (!p) break;
      s.encounter.deck = s.encounter.deck.filter((q) => q.id !== p.id);
      s.encounter.discard = s.encounter.discard.filter((q) => q.id !== p.id);
      ports.shuffleEncounter(s);
      ports.reveal(s, p, String(e.playerId));
      break;
    }
    case "esn:armor": {
      // Celestial Armor: the resource on the top card of your deck decides.
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a || !alive(s, e.playerId)) break;
      const [p] = ports.mill(s, e.playerId, 1);
      if (!p) break;
      const r = resourceOf(p);
      const host = a.attachedTo || "";
      const out: Effect[] = [];
      if (r.energy || r.wild)
        out.push({
          type: "heal",
          target: host,
          amount: 2,
          origin: "encounter",
        });
      if (r.mental || r.wild)
        out.push(
          {
            type: "status",
            target: "hero",
            status: "confused",
            actorId: e.playerId,
          },
          E("discard", { id: a.id }),
        );
      if (r.physical || r.wild)
        out.push({ type: "status", target: host, status: "tough" });
      ports.log(s, `Celestial Armor discards ${name(p)}.`, "bad");
      ports.queue(s, ...out);
      break;
    }
    case "esn:weapon": {
      // Celestial Weapon: the resource on the top card of your deck decides.
      const a = s.attachments.find((q) => q.id === e.id);
      if (!a || !alive(s, e.playerId)) break;
      const [p] = ports.mill(s, e.playerId, 1);
      if (!p) break;
      const r = resourceOf(p);
      const out: Effect[] = [];
      if (r.energy || r.wild)
        out.push({
          type: "damage",
          target: "hero",
          amount: 2,
          source: a.id,
          actorId: e.playerId,
        });
      if (r.mental || r.wild)
        out.push(E("hand-discard", { playerId: e.playerId }));
      if (r.physical || r.wild)
        out.push(
          {
            type: "status",
            target: "hero",
            status: "stunned",
            actorId: e.playerId,
          },
          E("discard", { id: a.id }),
        );
      ports.log(s, `Celestial Weapon discards ${name(p)}.`, "bad");
      ports.queue(s, ...out);
      break;
    }
    case "esn:hand-discard": {
      // Discard a card from your hand, of your choice.
      if (!alive(s, e.playerId)) break;
      const hand = seatView(s, e.playerId).player.hand;
      if (hand.length === 1) ports.discardFromHand(s, e.playerId, hand[0].id);
      else if (hand.length)
        ports.choose(
          s,
          name(WEAPON),
          "Discard a card from your hand.",
          hand.map((q): Option => ({
            id: q.id,
            label: name(q),
            image: q.code,
            effects: [
              E("hand-discard-one", {
                playerId: e.playerId,
                id: q.id,
                actorId: e.playerId,
              }),
            ],
          })),
        );
      break;
    }
    case "esn:hand-discard-one":
      ports.discardFromHand(s, e.playerId, e.id);
      break;
    case "esn:ritual": {
      // Threat on Ancient Ritual; its Forced Response follows the threat.
      const r = ritual(s);
      if (r) ports.queue(s, { type: "threat", target: r.id, amount: e.n });
      break;
    }
    case "esn:ritual-check": {
      // At 10 threat: remove 5 and deal each player a facedown card.
      const r = ritual(s);
      if (!r || !active(s, r) || r.counters < RITUAL_LIMIT) break;
      r.counters -= RITUAL_REMOVE;
      ports.log(
        s,
        `Ancient Ritual reaches ${RITUAL_LIMIT} threat: ${RITUAL_REMOVE} come off and each player is dealt a facedown encounter card.`,
        "bad",
      );
      ports.queue(
        s,
        ...seats(s).map((seat) => E("deal", { playerId: seat.id })),
      );
      break;
    }
    case "esn:ritual-or-icons": {
      // Choose: 3 threat on Ancient Ritual, or three more boost icons.
      if (!activation(s)) break;
      const options: Option[] = [
        {
          id: "icons",
          label: `${name(String(e.code))} gains three boost icons`,
          effects: [E("icons", { id: e.id, n: 3 })],
        },
      ];
      if (ritual(s))
        options.unshift({
          id: "ritual",
          label: "Place 3 threat on Ancient Ritual",
          effects: [E("ritual", { n: 3 })],
        });
      ports.choose(s, name(String(e.code)), "Choose one.", options);
      break;
    }
    case "esn:icons": {
      const a = activation(s);
      if (!a) break;
      const key = `esnIcons:${a.id}:${e.id}`;
      s.flags[key] = Number(s.flags[key] || 0) + Number(e.n);
      (a.afterActivation ||= []).push(E("clear-icons", { key }));
      break;
    }
    case "esn:clear-icons":
      delete s.flags[String(e.key)];
      break;
    case "esn:after": {
      // After this activation.
      const a = activation(s);
      if (!a) break;
      if (e.id && !a.retainedBoostIds?.includes(e.id))
        (a.retainedBoostIds ||= []).push(e.id);
      (a.afterActivation ||= []).push(...(e.effects as Effect[]));
      break;
    }
    case "esn:reveal-boost": {
      // Staggering Strength's boost: revealed after the activation.
      const p = s.resolving.find((q) => q.id === e.id);
      if (p) ports.reveal(s, p, String(e.playerId));
      break;
    }
    default:
      throw Error(`Unknown En Sabah Nur effect: ${e.type}`);
  }
  return true;
}
