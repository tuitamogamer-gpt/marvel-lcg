import { card, heroCard, heroStats, HEROES } from "./cards";
import { allInPlay, seatView } from "./team";
import type { ActionReview, Effect, GameState } from "./types";

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
  return { values, logId: s.log.at(-1)?.id || 0 };
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
  defender: "Defender declared",
  boostAttack: "Reveal attack boosts",
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
  if (!changes.length && !messages.length) return;
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
      p?.code ||
      (["boostAttack", "finishAttack", "defender"].includes(effect.type)
        ? [s.villain, ...s.minions].find((p) => p.id === s.attack?.attacker)
            ?.code
        : undefined) ||
      heroCard(s).code,
    messages,
    changes,
  };
}
