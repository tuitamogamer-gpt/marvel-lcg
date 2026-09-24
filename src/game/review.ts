import { card, heroCard, heroStats, HEROES } from "./cards";
import { allInPlay, seatView } from "./team";
import { paymentSources, paymentStatus, paymentSubject } from "./payment";
import { attackContext } from "./presentation";
import type {
  ActionReview,
  Effect,
  GameState,
  Piece,
  ReviewCard,
} from "./types";

type LocatedCard = {
  id: string;
  code: string;
  zone: string;
  owner: string;
  visible: boolean;
  exhausted: boolean;
  counters: number;
  attachedTo?: string;
};
function cardLocations(s: GameState) {
  const located: Record<string, LocatedCard> = {};
  const put = (
    pieces: Piece[],
    zone: string,
    owner = "Encounter",
    visible = true,
  ) => {
    for (const p of pieces)
      located[p.id] = {
        id: p.id,
        code: p.code,
        zone,
        owner,
        visible,
        exhausted: p.exhausted,
        counters: p.counters,
        attachedTo: p.attachedTo,
      };
  };
  for (const seat of s.players) {
    const name = HEROES.find((h) => h.id === seat.heroId)!.name;
    const p = seatView(s, seat).player;
    put(p.hand, "Hand", name);
    put(p.deck, "Deck", name, false);
    put(p.discard, "Discard", name);
    put(p.inPlay, "In play", name);
  }
  put(s.encounter.deck, "Deck", "Encounter", false);
  put(s.encounter.discard, "Discard");
  put(s.attack?.pendingBoosts || [], "Facedown boost", "Encounter", false);
  put(s.scheming?.pendingBoosts || [], "Facedown boost", "Encounter", false);
  for (const p of s.resolving || []) {
    const owner = s.players.find((seat) => seat.id === p.ownerId);
    put(
      [p],
      "Resolving",
      owner ? HEROES.find((h) => h.id === owner.heroId)!.name : "Encounter",
    );
  }
  for (const p of s.encounter.dealt) {
    const seat = s.players.find(
      (seat) => seat.id === (p.dealtTo || s.activePlayerId),
    );
    put(
      [p],
      "Dealt",
      HEROES.find((h) => h.id === seat?.heroId)?.name || "Encounter",
      false,
    );
  }
  put([...s.minions, ...s.sideSchemes, ...s.attachments], "In play");
  put(s.removed, "Removed");
  for (const p of s.minions)
    if (p.droneCard) put([p.droneCard], "Drone", "", false);
  for (const p of s.sideSchemes) put(p.captured || [], "Captured", "", false);
  return located;
}

type Value = {
  label: string;
  value: string | number;
  kind: ActionReview["changes"][number]["kind"];
};
export function boardSnapshot(s: GameState) {
  const values: Record<string, Value> = {};
  const put = (
    id: string,
    label: string,
    value: string | number,
    kind: Value["kind"],
  ) => {
    values[id] = { label, value, kind };
  };
  put("villain", `${card(s.villain).name} HP`, s.villain.hp, "health");
  put("stage", "Villain stage", s.villain.stage, "status");
  put("scheme", card(s.scheme.code).name, s.scheme.threat, "threat");
  put(
    "acceleration",
    "Acceleration tokens",
    s.encounter.acceleration,
    "threat",
  );
  for (const seat of s.players) {
    const v = seatView(s, seat),
      p = v.player,
      name = HEROES.find((h) => h.id === seat.heroId)!.name;
    const stats = heroStats(v);
    for (const [key, label] of [
      ["attack", "ATK"],
      ["thwart", "THW"],
      ["defense", "DEF"],
    ] as const)
      put(`${seat.id}:${key}`, `${name} ${label}`, stats[key], "status");
    put(`${seat.id}:hp`, `${name} HP`, p.hp, "health");
    put(
      `${seat.id}:form`,
      name,
      p.form === "hero" ? "Hero" : "Alter-ego",
      "status",
    );
    put(
      `${seat.id}:ready`,
      `${name} readiness`,
      p.exhausted ? "Exhausted" : "Ready",
      "status",
    );
    put(`${seat.id}:hand`, `${name} hand`, p.hand.length, "cards");
    put(`${seat.id}:deck`, `${name} deck`, p.deck.length, "cards");
    put(`${seat.id}:discard`, `${name} discard`, p.discard.length, "cards");
    put(
      `${seat.id}:encounters`,
      `${name} encounters`,
      s.encounter.dealt.filter(
        (p) => (p.dealtTo || s.activePlayerId) === seat.id,
      ).length,
      "cards",
    );
    for (const status of ["tough", "stunned", "confused"] as const)
      put(
        `${seat.id}:${status}`,
        `${name} · ${status}`,
        p[status] ? "Active" : "Clear",
        "status",
      );
  }
  for (const p of [
    s.villain,
    ...s.minions,
    ...s.sideSchemes,
    ...allInPlay(s),
    ...s.attachments,
  ]) {
    const name = card(p).name;
    put(`${p.id}:zone`, name, "In play", "cards");
    if (p.counters)
      put(
        `${p.id}:counters`,
        `${name} tokens`,
        p.counters,
        card(p).type_code === "side_scheme" ? "threat" : "status",
      );
    if (p.damage) put(`${p.id}:damage`, `${name} damage`, p.damage, "health");
    if (p.exhausted) put(`${p.id}:ready`, name, "Exhausted", "status");
    for (const status of ["tough", "stunned", "confused"] as const)
      if (p[status])
        put(`${p.id}:${status}`, `${name} · ${status}`, "Active", "status");
  }
  return {
    values,
    locations: cardLocations(s),
    logId: s.log.at(-1)?.id || 0,
    attack: s.attack ? structuredClone(s.attack) : null,
    prompt: s.prompt ? structuredClone(s.prompt) : null,
    paymentSources:
      s.prompt?.kind === "payment"
        ? paymentSources(s, s.prompt.card?.id, s.prompt.paymentTarget)
        : [],
    paymentSubject:
      s.prompt?.kind === "payment" ? paymentSubject(s, s.prompt) : undefined,
  };
}
const titles: Record<string, string> = {
  MULLIGAN: "Opening hand confirmed",
  CHOOSE: "Decision confirmed",
  SELECT: "Cards selected",
  PAY: "Resources spent",
  PLAY: "Play a card",
  BASIC: "Basic action",
  FLIP: "Change identity",
  ABILITY: "Activate ability",
  END_TURN: "Hero turn complete",
  CANCEL: "Action canceled",
  draw: "Draw cards",
  mill: "Discard from deck",
  damage: "Resolve damage",
  heal: "Recover hit points",
  threat: "Place threat",
  thwart: "Remove threat",
  flag: "Ability activated",
  status: "Status applied",
  exhaust: "Exhaust a card",
  ready: "Ready a card",
  play: "Card enters play",
  discardHand: "Spend a card",
  discardPiece: "Card leaves play",
  allyConsequence: "Ally consequential damage",
  enemyAttack: "Enemy attack begins",
  enemyScheme: "Enemy schemes",
  revealSchemeBoost: "Reveal scheme boost",
  finishScheme: "Calculate scheme threat",
  surge: "Surge · deal an encounter card",
  finishResolution: "Card resolution complete",
  completeBoost: "Boost resolved · discard card",
  prepareAttackBoosts: "Deal facedown boost cards",
  futurist: "Futurist · keep one card",
  minionReactions: "Minion engagement abilities",
  minionResponses: "Responses to a minion entering play",
  treacheryText: "Resolve When Revealed ability",
  resolveHandEvent: "Play a reaction card",
  allyResponse: "Ally response window",
  discardForLimit: "Discard an ally to meet the limit",
  declareDefense: "Prepare to defend",
  defender: "Defender declared",
  boostAttack: "Reveal attack boosts",
  revealBoost: "Reveal attack boosts",
  boostEffect: "Resolve boost ability",
  finishAttack: "Resolve the attack",
  reveal: "Reveal encounter",
  revealNext: "Reveal an additional encounter",
  revealDealt: "Reveal dealt encounter",
  drone: "Drone enters play",
  newRound: "Pass the first-player token",
  villainStepOne: "Villain phase · place threat",
  villainActivate: "Villain activation",
  dealEncounters: "Deal encounter cards",
  beginTurn: "Take the next hero’s turn",
  beginVillain: "Villain phase begins",
  refill: "Refill hand and ready",
  endDiscard: "Discard selection confirmed",
  initialSetup: "Mission setup",
  nextMulligan: "Opening hand confirmed",
  allReady: "The team readies",
  capture: "Highway Robbery",
  backlash: "Electromagnetic Backlash",
  vulturePlans: "The Vulture’s Plans",
  underAttack: "Under Attack",
  transferUpgrade: "Upgrade assigned",
  choosePlayer: "Choose a teammate",
  teamDraw: "Team ability",
  searchEncounter: "Encounter enters play",
  findMinion: "A minion engages",
  allyEnter: "Ally response",
  returnAlly: "An ally joins the team",
  settle: "Obligation resolved",
  pantherSpecial: "Black Panther special",
  minionActivations: "Minions activate",
  playerChoice: "Choose a hero",
  damageWindow: "Prevent damage or resolve the attack",
  defensePrompt: "Choose a defender",
  defenseResponses: "Responses after defending",
  target: "Choose a target",
  optional: "Optional card ability",
  payRequest: "Pay the resource cost",
  fromDiscard: "Return a card to hand",
  fromDeck: "Take the chosen card",
  searchDeck: "Search your deck",
  allyLimit: "Check the ally limit",
  counter: "Update counters",
  useCounter: "Spend a counter",
  preventAttack: "Prevent attack damage",
  afterBoost: "Resolve a boost ability",
  boostDroneChoice: "Resolve the drone boost",
  ultronChoice: "Choose threat or a drone",
  discardEncounter: "Discard the encounter",
  cancelEncounter: "Cancel the encounter effect",
  prepareDiscard: "Choose end-of-phase discards",
  recoverTech: "Recover a Tech upgrade",
  lead: "Boost the team's powers",
  discount: "Reduce the next card's cost",
  factoryThreat: "Count the drones in play",
  stageSetup: "Resolve the villain's setup",
  assignDamage: "Assign incoming damage",
  assignOne: "Assign damage to a character",
  exhaustCharacters: "Exhaust your characters",
  exhaustUpgrades: "Exhaust your upgrades",
  accelerate: "Add an acceleration token",
  randomDiscard: "Discard a random card",
  hydraThreat: "Add threat for Hydra enemies",
  chooseDiscard: "Choose a card to discard",
  findEncounter: "Find an encounter card",
  attachPlayer: "Attach an upgrade",
  legalPractice: "Resolve Legal Practice",
  ancestral: "Shuffle chosen cards into your deck",
  alpha: "Cycle cards with Alpha Flight Station",
  chargeEnergy: "Charge Energy Channel",
  vision: "Change Vision's density",
  thwartAll: "Remove threat across schemes",
  crisisInterdiction: "Resolve Crisis Interdiction",
  allyAction: "Resolve the ally's action",
  hulk: "Resolve Hulk's forced response",
  wakanda: "Choose your next Black Panther upgrade",
  moveDamage: "Move damage to an enemy",
  emergency: "Reduce incoming threat",
};
export function effectTitle(e?: Effect) {
  return e
    ? e.title ||
        (e.type === "reveal" && e.skip
          ? "Resolve encounter effect"
          : undefined) ||
        (e.type === "BASIC" ? `Basic ${e.action}` : titles[e.type]) ||
        "Resolve card effect"
    : "Your next action";
}
export function recordReview(
  s: GameState,
  before: ReturnType<typeof boardSnapshot>,
  effect: Effect,
) {
  if (!s.guided) return;
  // Suiting up is already an explicit click. Any triggered ability still
  // resolves through its own queued decision or review.
  if (effect.type === "FLIP" && s.player.form === "hero") return;
  const after = boardSnapshot(s);
  const changes: ActionReview["changes"] = [];
  for (const key of new Set([
    ...Object.keys(before.values),
    ...Object.keys(after.values),
  ])) {
    const a = before.values[key],
      b = after.values[key];
    const old =
      a?.value ??
      (key.endsWith(":zone")
        ? "Not in play"
        : key.endsWith(":ready")
          ? "Ready"
          : key.includes(":damage") || key.includes(":counters")
            ? 0
            : "Clear");
    const next =
      b?.value ??
      (key.endsWith(":zone")
        ? "Left play"
        : key.endsWith(":ready")
          ? "Ready"
          : key.includes(":damage") || key.includes(":counters")
            ? 0
            : "Clear");
    // A departed card gets one clear zone change, not a string of reset tokens.
    if (
      a &&
      !b &&
      !key.endsWith(":zone") &&
      before.values[`${key.split(":")[0]}:zone`] &&
      !after.values[`${key.split(":")[0]}:zone`]
    )
      continue;
    if (old !== next)
      changes.push({
        label: (b || a).label,
        before: old,
        after: next,
        kind: (b || a).kind,
      });
  }
  const messages = s.log.filter((l) => l.id > before.logId).map((l) => l.text);
  const cards: ReviewCard[] = [];
  for (const id of new Set([
    ...Object.keys(before.locations),
    ...Object.keys(after.locations),
  ])) {
    const a = before.locations[id],
      b = after.locations[id];
    if (!a?.visible && !b?.visible && b?.zone !== "Dealt") continue;
    if (
      a?.zone === b?.zone &&
      a?.owner === b?.owner &&
      a?.exhausted === b?.exhausted &&
      a?.counters === b?.counters &&
      a?.attachedTo === b?.attachedTo
    )
      continue;
    // Hidden decks stay hidden, including their order after a reshuffle.
    if (b?.zone === "Deck") continue;
    const p = b || a;
    if (!p) continue;
    let label =
      b?.zone === "Hand"
        ? "Added to hand"
        : b?.zone === "Discard"
          ? "Discarded"
          : b?.zone === "In play"
            ? "Entered play"
            : b?.zone === "Dealt"
              ? "Dealt face down"
              : b?.zone === "Removed"
                ? "Removed from game"
                : b?.zone || "Revealed";
    let kind: ReviewCard["kind"] =
      b?.zone === "Hand"
        ? "drawn"
        : b?.zone === "Discard"
          ? "discarded"
          : b?.zone === "Dealt"
            ? "dealt"
            : "moved";
    if (a?.zone === b?.zone) {
      label =
        b?.exhausted && !a?.exhausted
          ? "Exhausted"
          : !b?.exhausted && a?.exhausted
            ? "Readied"
            : "Tokens updated";
      kind = "ability";
    }
    if (effect.type === "play" && effect.piece?.id === id) {
      label = "Played";
      kind = "played";
    }
    const host =
      b?.attachedTo &&
      [s.villain, ...s.minions, ...allInPlay(s)].find(
        (piece) => piece.id === b.attachedTo,
      );
    if (host && a?.attachedTo !== b?.attachedTo) {
      label = `Attached to ${card(host).name}`;
      kind = "moved";
    }
    cards.push({
      id,
      code: p.visible ? p.code : undefined,
      name: p.visible
        ? card(p.code).name
        : p.zone === "Dealt"
          ? "Facedown encounter"
          : "Facedown card",
      label,
      kind,
      detail: host
        ? `${p.owner} · Attached to ${card(host).name}`
        : `${p.owner}${a?.zone !== b?.zone ? ` · ${a?.zone || "Deck"} → ${b?.zone || "Revealed"}` : ""}`,
    });
  }
  const prompt = before.prompt;
  let payment: ActionReview["payment"];
  if (effect.type === "PAY" && prompt?.kind === "payment") {
    const status = paymentStatus(
      before.paymentSources,
      effect.ids,
      prompt.cost || 0,
      prompt.requirements,
    );
    payment = {
      title: prompt.title,
      cost: prompt.cost || 0,
      total: status.total,
    };
    for (const p of status.selected) {
      const index = cards.findIndex((c) => c.id === p.id);
      if (index >= 0) cards.splice(index, 1);
      cards.push({
        id: p.id,
        code: p.code,
        name: p.name,
        label: p.kind === "card" ? "Spent → discard" : "Resource ability used",
        detail: p.description,
        kind: p.kind === "card" ? "spent" : "ability",
        resources: p.resources,
      });
    }
  }
  const revealing =
    ["reveal", "revealNext", "revealDealt"].includes(effect.type) &&
    messages.some((m) =>
      m.includes(`${effect.skip ? "Resolve" : "Encounter"}:`),
    ) &&
    s.lastEncounter;
  if (revealing) {
    const index = cards.findIndex(
      (c) => c.code === s.lastEncounter || c.kind === "dealt",
    );
    if (index >= 0) cards.splice(index, 1);
    cards.unshift({
      id: "encounter",
      code: s.lastEncounter,
      name: card(s.lastEncounter!).name,
      label: effect.skip ? "Encounter effect" : "Encounter revealed",
      kind: "revealed",
      detail: effect.skip
        ? "Resolving the revealed card"
        : "Read the card. Its effect waits for Proceed.",
    });
  }
  const a = s.attack || before.attack;
  const boostCodes =
    effect.type === "revealBoost" || effect.type === "boostAttack"
      ? (s.attack?.boostCodes || []).slice(
          before.attack?.boostCodes.length || 0,
        )
      : [];
  if (effect.type === "revealSchemeBoost") {
    for (const p of cards.filter(
      (c) => c.code && card(c.code).faction_code === "encounter",
    ))
      boostCodes.push(p.code!);
  }
  for (const [i, code] of boostCodes.entries()) {
    const existing = cards.findIndex((c) => c.code === code);
    if (existing >= 0) cards.splice(existing, 1);
    cards.unshift({
      id: `boost-${i}`,
      code,
      name: card(code).name,
      label: `+${card(code).boost || 0} boost`,
      detail: card(code).boost_star
        ? "Star ability follows on Proceed"
        : "Only the boost icons apply",
      kind: "boost",
    });
  }
  let calculation: ActionReview["calculation"];
  if (
    a &&
    ["revealBoost", "preventAttack", "damageWindow", "finishAttack"].includes(
      effect.type,
    )
  ) {
    const boost = a.boostCodes.reduce(
      (n, code) => n + (card(code).boost || 0),
      0,
    );
    calculation = {
      label:
        effect.type === "finishAttack" ? "Attack resolved" : "Incoming damage",
      parts: [
        { label: "Base ATK", value: a.base - boost },
        { label: "Boost", value: boost },
        { label: "DEF", value: -a.defense },
        {
          label: "Prevented",
          value: -Math.min(a.prevented, Math.max(0, a.base - a.defense)),
        },
      ],
      total: Math.max(0, a.base - a.defense - a.prevented),
      note:
        effect.type === "finishAttack"
          ? "The changes below show damage actually taken, including Tough and other effects."
          : "Damage has not been applied. Boost abilities, responses and Tough may still change the result.",
    };
  }
  if (effect.type === "finishScheme" && s.scheming) {
    const attacker = [s.villain, ...s.minions].find(
      (p) => p.id === s.scheming!.attacker,
    );
    const base =
      (attacker ? card(attacker).scheme || 0 : 0) +
      s.attachments
        .filter((p) => p.attachedTo === attacker?.id)
        .reduce((n, p) => n + (card(p).scheme || 0), 0);
    const boost = s.scheming.boostCodes.reduce(
      (n, code) => n + (card(code).boost || 0),
      0,
    );
    calculation = {
      label: "Incoming scheme threat",
      unit: "threat",
      parts: [
        { label: "Base SCH", value: base },
        { label: "Boost", value: boost },
      ],
      total: base + boost,
      note: "Threat has not been placed. Your interrupts may still reduce or prevent it.",
    };
  }
  if (!changes.length && !messages.length && !cards.length && !calculation)
    return;
  const p =
    effect.piece ||
    [...allInPlay(s), s.villain, ...s.minions].find((p) => p.id === effect.id);
  s.review = {
    id: ++s.reviewCount,
    title: effectTitle(effect),
    actor: HEROES.find((h) => h.id === s.heroId)!.name,
    phase: s.phase,
    source:
      effect.sourceCode ||
      (payment ? before.paymentSubject : undefined) ||
      (revealing ? s.lastEncounter : undefined) ||
      p?.code ||
      before.locations[effect.id]?.code ||
      ([
        "boostAttack",
        "revealBoost",
        "damageWindow",
        "finishAttack",
        "defender",
      ].includes(effect.type)
        ? [s.villain, ...s.minions].find((p) => p.id === s.attack?.attacker)
            ?.code
        : undefined) ||
      (["enemyScheme", "revealSchemeBoost", "finishScheme"].includes(
        effect.type,
      )
        ? [s.villain, ...s.minions].find((p) => p.id === s.scheming?.attacker)
            ?.code
        : undefined) ||
      heroCard(s).code,
    messages,
    changes,
    cards,
    payment,
    calculation,
    attack: attackContext(s, a),
  };
}
