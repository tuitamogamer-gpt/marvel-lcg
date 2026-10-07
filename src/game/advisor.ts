import {
  doctorStrangeAbilityOptions,
  doctorStrangeTopInvocation,
} from "./doctor-strange.js";
import {
  card,
  handSize,
  heroCard,
  heroStats,
  maxHP,
  pieceHP,
  plain,
} from "./cards.js";
import {
  abilityOptions,
  canPay,
  canChangeIdentityForm,
  dispatch,
  escalation,
  paymentSources,
  playable,
  schemeLimit,
  targets,
} from "./engine.js";
import { suggestPayment } from "./payment.js";
import type { PaymentSource } from "./payment.js";
import { engaged } from "./team.js";
import type { Command, GameState, Piece, Prompt } from "./types.js";

/**
 * A rules-aware heuristic player. It suggests the next command for the hero
 * whose turn it is and answers prompts (defenders, targets, payments). The UI
 * shows the suggestion; tests use it to check that every scenario stays winnable.
 * It never mutates the state it is given.
 */
export interface Advice {
  command: Command;
  title: string;
  reason: string;
}

function villainAtk(s: GameState) {
  return (
    (card(s.villain).attack || 0) +
    s.attachments
      .filter((p) => p.attachedTo === s.villain.id)
      .reduce((n, p) => n + (card(p).attack || 0), 0)
  );
}
function villainSch(s: GameState) {
  return (
    (card(s.villain).scheme || 0) +
    s.attachments
      .filter((p) => p.attachedTo === s.villain.id)
      .reduce((n, p) => n + (card(p).scheme || 0), 0)
  );
}
/** Threat the next villain phase is likely to add if the hero ends the turn in this form. */
export function incomingThreat(s: GameState, form = s.player.form) {
  const accel =
    s.encounter.acceleration +
    s.sideSchemes.reduce((n, p) => n + (card(p).scheme_acceleration || 0), 0);
  const scheming =
    form === "alter"
      ? villainSch(s) +
        engaged(s).reduce((n, p) => n + (card(p).scheme || 0), 0) +
        1
      : 1;
  return escalation(s) + accel + scheming;
}
/** Damage the next villain phase is likely to deal if the hero ends the turn in hero form. */
export function incomingDamage(s: GameState, form = s.player.form) {
  if (form !== "hero") return 0;
  return (
    villainAtk(s) +
    2 +
    engaged(s).reduce((n, p) => n + (card(p).attack || 0), 0)
  );
}
function pressure(s: GameState) {
  const limit = schemeLimit(s);
  const room = limit - (s.scheme.threat + incomingThreat(s, "hero"));
  return {
    limit,
    room,
    danger: room <= 1,
    pressed: room <= 3 || s.sideSchemes.some((p) => card(p).scheme_crisis),
  };
}
const num = (text: string | undefined, re: RegExp) => {
  const m = plain(text).match(re);
  return m ? Number(m[1]) : 0;
};
/** Rough worth of a card in hand, used both for plays and for what to spend. */
export function cardValue(s: GameState, p: Piece) {
  const c = card(p);
  const text = c.text || "";
  const { pressed } = pressure(s);
  if (c.type_code === "ally")
    return 3 + (c.attack || 0) + (c.thwart || 0) + (c.health || 0) * 0.3;
  if (c.type_code === "upgrade" || c.type_code === "support")
    return s.round <= 3 ? 3 : 1.8;
  if (c.type_code === "resource") return 0.5;
  if (c.type_code === "event") {
    const damage = num(text, /deal (\d+) damage/i);
    const threat = num(text, /remove (\d+) threat/i);
    const draw = num(text, /draw (\d+) card/i);
    const heal = num(text, /heal (\d+) damage/i);
    let value = 1;
    if (damage) value = Math.max(value, damage * (pressed ? 0.8 : 1.1));
    if (threat) value = Math.max(value, threat * (pressed ? 1.6 : 1.1));
    if (draw) value = Math.max(value, draw * 0.9);
    if (heal && s.player.hp < maxHP(s))
      value = Math.max(value, Math.min(heal, maxHP(s) - s.player.hp) * 0.6);
    return value;
  }
  return 1;
}
/** What a card is worth as payment: cards that cannot be played now are cheap fuel. */
export function spendValue(s: GameState, p: Piece) {
  const c = card(p);
  if (c.type_code === "resource") return 0.3;
  if (p.code === "01003") return 3.5; // Backflip prevents a whole attack
  if (p.code === "01004") return 2.5; // Enhanced Spider-Sense cancels a treachery
  const open = { ...s, prompt: null, review: null };
  if (playable(open, p)) return c.type_code === "event" ? 0.8 : 0.6;
  return cardValue(s, p);
}
function rankSource(s: GameState) {
  return (x: PaymentSource) => {
    if (x.id === "scientist") return 0;
    const piece = s.player.hand.find((h) => h.id === x.id);
    if (!piece) return x.name === "Pepper Potts" ? 1.5 : 4;
    return 1 + spendValue(s, piece) / 10;
  };
}
function playCost(s: GameState, p: Piece) {
  return Math.max(0, (card(p).cost || 0) - Number(s.flags.discount || 0));
}
/** The best card to play now, if paying for it costs less than it is worth. */
function bestPlay(s: GameState): Advice | null {
  let best: { piece: Piece; score: number } | null = null;
  for (const p of s.player.hand) {
    if (playable(s, p)) continue;
    const cost = playCost(s, p);
    const sources = paymentSources(s, p.id, p.code);
    const requirements = /Power of/.test(card(p).name) ? [] : undefined;
    const ids = suggestPayment(sources, cost, requirements, rankSource(s));
    if (!ids) continue;
    // Hands refill every round, so spending cards is cheap; only avoid burning
    // something clearly better than what it buys.
    const spent = ids.reduce((n, id) => {
      const piece = s.player.hand.find((h) => h.id === id);
      return n + (piece ? spendValue(s, piece) : 0.4);
    }, 0);
    const score = cardValue(s, p) - spent * 0.35;
    if (score < 0.4) continue;
    if (!best || score > best.score) best = { piece: p, score };
  }
  if (!best) return null;
  return {
    command: { type: "PLAY", id: best.piece.id },
    title: `Play ${card(best.piece).name}`,
    reason:
      card(best.piece).type_code === "ally"
        ? "An ally adds attacks or thwarts every round and can block an attack."
        : `Its effect is worth more than the cards it costs (cost ${playCost(s, best.piece)}).`,
  };
}
function readyAllies(s: GameState) {
  return s.player.inPlay.filter(
    (p) => card(p).type_code === "ally" && !p.exhausted,
  );
}
/** True when the hero should keep a defender ready instead of spending every action. */
function needsBlocker(s: GameState) {
  return (
    s.player.form === "hero" && s.player.hp <= incomingDamage(s, "hero") + 2
  );
}
function allyAction(s: GameState): Advice | null {
  const { pressed } = pressure(s);
  const enemies = targets(s, "enemy", true);
  const schemes = targets(s, "scheme");
  const ready = readyAllies(s);
  for (const ally of ready) {
    const c = card(ally);
    const remaining = pieceHP(s, ally) - ally.damage;
    const finishes = s.minions.some(
      (m) => pieceHP(s, m) - m.damage <= (c.attack || 0),
    );
    // Keep the last ready ally as a blocker while the next hit is dangerous.
    if (needsBlocker(s) && ready.length <= 1 && !finishes && !pressed) continue;
    const wantThwart = pressed && (c.thwart || 0) > 0 && schemes.length;
    const wantAttack = (c.attack || 0) > 0 && enemies.length;
    if (!wantThwart && !wantAttack) continue;
    // Keep a one-hit-point ally as a blocker unless it can finish a minion.
    if (
      remaining <= 1 &&
      !s.minions.some((m) => pieceHP(s, m) - m.damage <= (c.attack || 0))
    )
      continue;
    return {
      command: {
        type: "ABILITY",
        id: ally.id,
        action: wantThwart ? "thwart" : "attack",
      },
      title: `${c.name}: ${wantThwart ? "thwart" : "attack"}`,
      reason: wantThwart
        ? "Threat is close to the limit, so every point removed matters."
        : "Allies deal damage without spending your hero's action.",
    };
  }
  return null;
}
function usefulAbility(s: GameState): Advice | null {
  const good = new Set([
    "01026",
    "01037",
    "01064",
    "01038",
    "01056",
    "01091",
    "01045",
    "01015",
  ]);
  for (const p of s.player.inPlay) {
    if (p.used) continue;
    const options = abilityOptions(s, p).filter((o) => !o.disabled);
    const special = options.find((o) => o.id === "special");
    if (!special) continue;
    if (p.code === "01026" && !canPay(s, 1, ["mental"])) continue;
    if (
      (p.code === "01080" || p.code === "01006") &&
      s.player.hp < maxHP(s) - 1
    )
      return {
        command: { type: "ABILITY", id: p.id, action: "special" },
        title: special.label,
        reason: "Healing while it is free.",
      };
    if (
      ["01026", "01037", "01064"].includes(p.code) &&
      !targets(s, "scheme").length
    )
      continue;
    if (
      ["01038", "01056"].includes(p.code) &&
      !targets(s, "enemy", true).length
    )
      continue;
    if (good.has(p.code))
      return {
        command: { type: "ABILITY", id: p.id, action: "special" },
        title: special.label,
        reason:
          p.code === "01026"
            ? "Spend a mental resource to remove 2 threat."
            : "A card ability that costs no cards.",
      };
  }
  return null;
}
function identityAbility(s: GameState): Advice | null {
  const top = doctorStrangeTopInvocation(s);
  const strange = doctorStrangeAbilityOptions(s, "identity").find(
    (o) =>
      o.id !== "spell" ||
      (top && canPay(s, card(top).cost || 0, [], undefined, top.code)),
  );
  if (strange)
    return {
      command: { type: "ABILITY", id: "identity", action: strange.id },
      title: strange.label,
      reason: "Use the visible Invocation and your printed identity ability.",
    };
  if (s.player.form === "alter") {
    if (s.heroId === "iron_man" && !s.flags.futurist)
      return {
        command: { type: "ABILITY", id: "identity" },
        title: "Use Futurist",
        reason: "Look at the top cards and keep the best one.",
      };
    if (s.heroId === "captain_marvel" && !s.flags.commander)
      return {
        command: { type: "ABILITY", id: "identity" },
        title: "Use Commander",
        reason: "A free card every round.",
      };
  } else if (
    s.heroId === "captain_marvel" &&
    !s.flags.rechannel &&
    s.player.hp < maxHP(s) &&
    canPay(s, 1, ["energy"])
  )
    return {
      command: { type: "ABILITY", id: "identity" },
      title: "Use Rechannel",
      reason: "Spend an energy resource to heal 1 damage and draw a card.",
    };
  return null;
}
/** Which cards to discard at the end of the hero phase (solo only): the required number, least valuable first. */
export function endTurnDiscards(s: GameState) {
  const required = Math.max(0, s.player.hand.length - handSize(s));
  return [...s.player.hand]
    .sort((a, b) => cardValue(s, a) - cardValue(s, b))
    .slice(0, required)
    .map((p) => p.id);
}
/** The next suggested action for the active hero, or null when only ending the turn remains. */
export function adviseAction(s: GameState): Advice | null {
  if (s.phase !== "player" || s.prompt || s.review) return null;
  if (s.activePlayerId !== s.turnPlayerId) return null;
  const { pressed, danger } = pressure(s);
  const hp = s.player.hp;
  const max = maxHP(s);
  const stats = heroStats(s);
  const identity = identityAbility(s);
  if (identity) return identity;
  if (s.player.form === "alter") {
    const hurt = hp < max - 2;
    const stayHome = hp <= Math.ceil(max * 0.5) && !danger;
    if (hurt && !s.player.exhausted && !danger)
      return {
        command: { type: "BASIC", action: "recover" },
        title: `Recover ${stats.recover}`,
        reason: `Alter-ego recovery heals ${stats.recover} while the villain only schemes.`,
      };
    const play = bestPlay(s);
    if (play && (stayHome || s.player.exhausted)) return play;
    if (!s.player.flipped && !stayHome && canChangeIdentityForm(s))
      return {
        command: { type: "FLIP" },
        title: "Suit up",
        reason: pressed
          ? "Threat is rising, and only your hero form can thwart and attack."
          : "Hero form lets you attack, thwart and block this round.",
      };
    if (play) return play;
    const ally = allyAction(s);
    if (ally) return ally;
    const ability = usefulAbility(s);
    if (ability) return ability;
    return null;
  }
  const play = bestPlay(s);
  if (play) return play;
  const ally = allyAction(s);
  if (ally) return ally;
  if (!s.player.exhausted) {
    const schemes = targets(s, "scheme");
    const enemies = targets(s, "enemy", true);
    if (pressed && (schemes.length || s.player.confused))
      return {
        command: { type: "BASIC", action: "thwart" },
        title: s.player.confused ? "Clear Confused" : `Thwart ${stats.thwart}`,
        reason: s.player.confused
          ? "Use a thwart to remove Confused so you can control threat next turn."
          : "The main scheme is close to completing; remove threat now.",
      };
    if (enemies.length || s.player.stunned)
      return {
        command: { type: "BASIC", action: "attack" },
        title: s.player.stunned ? "Clear Stunned" : `Attack ${stats.attack}`,
        reason: s.player.stunned
          ? "Use an attack to remove Stunned so your next attack can deal damage."
          : "Threat is under control, so press the attack.",
      };
    if (schemes.length)
      return {
        command: { type: "BASIC", action: "thwart" },
        title: `Thwart ${stats.thwart}`,
        reason: "No enemy can be attacked; keep the scheme low instead.",
      };
  }
  const ability = usefulAbility(s);
  if (ability) return ability;
  const room = pressure(s).room;
  if (
    !s.player.flipped &&
    canChangeIdentityForm(s) &&
    ((hp <= incomingDamage(s, "hero") && !readyAllies(s).length) ||
      (hp <= 4 && room >= 3) ||
      (hp <= Math.ceil(max * 0.4) && !pressed && s.player.exhausted))
  )
    return {
      command: { type: "FLIP" },
      title: `Become ${heroCard(s).name.includes(" ") ? "your alter-ego" : "alter-ego"}`,
      reason:
        "The next villain attack could defeat you; in alter-ego the villain schemes instead.",
    };
  return null;
}
function best<T>(list: T[], score: (x: T) => number) {
  let pick: T | undefined;
  let top = -Infinity;
  for (const x of list) {
    const v = score(x);
    if (v > top) {
      top = v;
      pick = x;
    }
  }
  return pick;
}
/** Answers the pending prompt. */
export function advisePrompt(s: GameState): Advice | null {
  const p = s.prompt;
  if (!p) return null;
  if (p.kind === "payment") {
    const sources = paymentSources(s, p.card?.id, p.paymentTarget);
    const ids = suggestPayment(
      sources,
      p.cost || 0,
      p.requirements,
      rankSource(s),
    );
    if (ids)
      return {
        command: { type: "PAY", ids, wildAs: p.requirements?.[0] || "energy" },
        title: "Pay with the least valuable cards",
        reason: "Printed resources and unplayable cards go first.",
      };
    if (p.cancelable)
      return {
        command: { type: "CANCEL" },
        title: "Cancel",
        reason: "This cost cannot be paid.",
      };
    return null;
  }
  if (p.kind === "select") {
    const ranked = [...p.options].sort(
      (a, b) => valueOfOption(s, a) - valueOfOption(s, b),
    );
    const ids = ranked.slice(0, p.min || 0).map((o) => o.id);
    return {
      command: { type: "SELECT", ids },
      title: ids.length
        ? "Give up the least valuable cards"
        : "Keep everything",
      reason: "Only the required number is selected.",
    };
  }
  const ids = p.options.map((o) => o.id);
  // Defense: keep the hero ready to attack next turn; block only when the hit
  // would leave the hero in real danger. Allies absorb a hit up to their hit points.
  if (ids.includes("take") && /attacks$/.test(p.title)) {
    const base = Number(p.text.match(/^(\d+) base ATK/)?.[1] || 0);
    const villain = p.text.includes("boost");
    const expected = base + (villain ? 2 : 0);
    const hp = s.player.hp;
    const allies = p.options.filter(
      (o) => !["take", "hero"].includes(o.id) && !o.id.startsWith("hero:"),
    );
    const heroOption = p.options.find((o) => o.id === "hero");
    const allyHp = (o: (typeof allies)[number]) =>
      Number(o.detail?.match(/(\d+) hit points/)?.[1] || 1);
    const blocker = best(
      allies,
      (o) => (allyHp(o) >= expected ? 10 : 0) + allyHp(o),
    );
    const left = hp - expected;
    if (left <= 2) {
      if (blocker)
        return {
          command: { type: "CHOOSE", id: blocker.id },
          title: blocker.label,
          reason:
            left <= 0
              ? "This hit could defeat your hero; the ally absorbs it."
              : "Blocking keeps your hero out of the danger zone.",
        };
      if (heroOption && left <= 1)
        return {
          command: { type: "CHOOSE", id: "hero" },
          title: heroOption.label,
          reason:
            "Defending costs next turn's basic power, but keeps your hero standing.",
        };
    }
    return {
      command: { type: "CHOOSE", id: "take" },
      title: "Take the attack",
      reason: `About ${expected} damage leaves ${Math.max(0, left)} hit points; everyone stays ready to strike back.`,
    };
  }
  if (ids.includes("backflip") || ids.includes("flight")) {
    const damage = Number(
      p.options.find((o) => o.id === "resolve")?.label.match(/(\d+)/)?.[1] || 0,
    );
    if (ids.includes("backflip") && damage >= 2)
      return {
        command: { type: "CHOOSE", id: "backflip" },
        title: "Backflip",
        reason: "Prevents all of the damage for one card.",
      };
    if (ids.includes("flight") && damage >= 3)
      return {
        command: { type: "CHOOSE", id: "flight" },
        title: "Cosmic Flight",
        reason: "Prevents three damage.",
      };
    const resolve =
      ids.find((id) => ["resolve", "allow", "take"].includes(id)) || ids[0];
    return {
      command: { type: "CHOOSE", id: resolve },
      title: "Resolve the damage",
      reason: "Too little damage to spend a card on.",
    };
  }
  const preferred = ids.find((id) => id.startsWith("object"));
  if (preferred)
    return {
      command: { type: "CHOOSE", id: preferred },
      title: "I Object!",
      reason: "One threat prevented for free.",
    };
  // Targets: finish a minion if possible, otherwise the villain; schemes by urgency.
  const enemyIds = new Set(targets(s, "enemy").map((t) => t.id));
  if (ids.length && ids.every((id) => enemyIds.has(id))) {
    const damage = heroStats(s).attack;
    const minion = best(
      p.options.filter((o) => o.id !== s.villain.id),
      (o) => {
        const m = s.minions.find((x) => x.id === o.id);
        if (!m) return -99;
        const remaining = pieceHP(s, m) - m.damage;
        return (
          (remaining <= damage ? 10 : 0) -
          remaining +
          (card(m).text?.includes("Guard") ? 3 : 0)
        );
      },
    );
    if (minion) {
      const m = s.minions.find((x) => x.id === minion.id)!;
      if (
        pieceHP(s, m) - m.damage <= damage ||
        !ids.includes(s.villain.id) ||
        pressure(s).pressed
      )
        return {
          command: { type: "CHOOSE", id: minion.id },
          title: minion.label,
          reason: "Removing a minion stops its attacks and schemes.",
        };
    }
    const villain =
      p.options.find((o) => o.id === s.villain.id) || p.options[0];
    return {
      command: { type: "CHOOSE", id: villain.id },
      title: villain.label,
      reason: "Damage on the villain is progress toward the win.",
    };
  }
  const schemeIds = new Set(targets(s, "scheme").map((t) => t.id));
  if (ids.length && ids.every((id) => schemeIds.has(id))) {
    const pick = best(p.options, (o) => {
      if (o.id === "main") return pressure(s).pressed ? 8 : 2;
      const side = s.sideSchemes.find((x) => x.id === o.id);
      if (!side) return 0;
      const c = card(side);
      return (
        (c.scheme_crisis ? 9 : 0) +
        (c.scheme_hazard ? 5 : 0) +
        (c.scheme_acceleration ? 6 : 0) +
        3 -
        side.counters * 0.2
      );
    })!;
    return {
      command: { type: "CHOOSE", id: pick.id },
      title: pick.label,
      reason:
        pick.id === "main"
          ? "The main scheme decides the game."
          : "Side schemes make every villain phase worse.",
    };
  }
  const fallback =
    p.options.find((o) =>
      [
        "resolve",
        "allow",
        "take",
        "skip",
        "pass",
        "threat",
        "exhaust",
      ].includes(o.id),
    ) || p.options[0];
  return {
    command: { type: "CHOOSE", id: fallback.id },
    title: fallback.label,
    reason: "The standard resolution.",
  };
}
function valueOfOption(s: GameState, o: Prompt["options"][number]) {
  const piece = s.player.hand.find((p) => p.id === o.id);
  return piece ? cardValue(s, piece) : 1;
}
/** The advisor's next command in any situation, or null when the turn should end. */
export function advise(s: GameState): Advice | null {
  if (["won", "lost"].includes(s.phase)) return null;
  if (s.review)
    return {
      command: { type: "PROCEED" },
      title: "Proceed",
      reason: "Read the step, then continue.",
    };
  if (s.prompt) return advisePrompt(s);
  if (s.phase === "mulligan") {
    const ids = s.player.hand
      .filter((p) => (card(p).cost || 0) >= 4 && card(p).type_code !== "ally")
      .map((p) => p.id);
    return {
      command: { type: "MULLIGAN", ids },
      title: "Opening hand",
      reason: "Expensive non-ally cards are replaced.",
    };
  }
  return adviseAction(s);
}
/** Plays a mission with the advisor. Tests use it to check that scenarios stay winnable. */
export function autoplay(start: GameState, maxRounds = 30, maxCommands = 6000) {
  let s = start;
  let commands = 0;
  while (
    !["won", "lost"].includes(s.phase) &&
    commands < maxCommands &&
    s.round <= maxRounds
  ) {
    const advice = advise(s);
    const command: Command = advice
      ? advice.command
      : {
          type: "END_TURN",
          discard: s.playerCount === 1 ? endTurnDiscards(s) : undefined,
        };
    const next = dispatch(s, command);
    if (next.error) {
      // Never loop on a rejected suggestion: end the turn instead.
      const ended = dispatch(s, {
        type: "END_TURN",
        discard: s.playerCount === 1 ? endTurnDiscards(s) : undefined,
      });
      if (ended.error)
        throw Error(
          `${command.type}: ${next.error} / END_TURN: ${ended.error}`,
        );
      s = ended;
    } else s = next;
    commands++;
  }
  return { state: s, commands };
}
