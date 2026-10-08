import * as antMan from "./ant-man.js";
import * as antPack from "./ant-man-pack.js";
import * as wasp from "./wasp.js";
import * as quicksilver from "./quicksilver.js";
import * as quicksilverPack from "./quicksilver-pack.js";
import * as scarletWitch from "./scarlet-witch.js";
import * as scarletPack from "./scarlet-witch-pack.js";
import * as groot from "./groot.js";
import * as rocket from "./rocket.js";
import * as gmwPack from "./gmw-player-pack.js";
import * as gamora from "./gamora.js";
import * as gamoraPack from "./gamora-pack.js";
import * as starLord from "./star-lord.js";
import * as starLordPack from "./star-lord-pack.js";
import * as drax from "./drax.js";
import * as draxPack from "./drax-pack.js";
import * as venom from "./venom.js";
import * as warlock from "./warlock.js";
import * as venomPack from "./venom-pack.js";
import * as mtsPlayerPack from "./mts-player-pack.js";
import { spectrumResourceSpent } from "./spectrum.js";
import { warlockResourceSpent } from "./warlock.js";
import * as spectrum from "./spectrum.js";
import * as waspPack from "./wasp-pack.js";
import {
  hawkeyePlayRestriction,
  hawkeyeEvent,
  hawkeyeCardEntered,
  hawkeyeStoredPlayable,
  hawkeyeTakeStoredForPlay,
  hawkeyeAbilityOptions,
  hawkeyeAbility,
  hawkeyeAttackInitiatedOptions,
  hawkeyeEncounterReveal,
  hawkeyeBoost,
  hawkeyeSchemeDefeated,
  hawkeyePhaseEnded,
  hawkeyeEnemyAttackTraits,
  hawkeyeAllyAttackTraits,
  HAWKEYE_SCRIPT_CODES,
  resolveHawkeyeEffect,
  type HawkeyePorts,
} from "./hawkeye.js";
import {
  spiderWomanCardPlayed,
  spiderWomanResourceSpent,
  spiderWomanPlayRestriction,
  spiderWomanEvent,
  spiderWomanAllyEnter,
  spiderWomanAllyBasicUsed,
  spiderWomanSchemeDefeated,
  spiderWomanAbilityOptions,
  spiderWomanAbility,
  spiderWomanEncounterReveal,
  spiderWomanBoost,
  resolveSpiderWomanEffect,
  SPIDER_WOMAN_SCRIPT_CODES,
  type SpiderWomanPorts,
} from "./spider-woman.js";
import {
  doctorStrangeSetup,
  doctorStrangeMasterInvocation,
  doctorStrangeAdditionalPlayCost,
  doctorStrangeCostModifier,
  doctorStrangeCardPlayed,
  doctorStrangeBeforeEvent,
  doctorStrangeTraits,
  doctorStrangeAttachedUpgradeDiscount,
  doctorStrangePhaseEnded,
  doctorStrangeRoundEnded,
  doctorStrangePlayRestriction,
  doctorStrangeEvent,
  doctorStrangeAllyEnter,
  doctorStrangeCardEntered,
  doctorStrangeAbilityOptions,
  doctorStrangeAbility,
  doctorStrangeResourceSpent,
  doctorStrangeBeforeAllyAttack,
  doctorStrangeDefeatOptions,
  doctorStrangeDefenseOptions,
  doctorStrangeAfterDefense,
  doctorStrangeDamageOptions,
  doctorStrangeSchemeBoostOptions,
  doctorStrangeBasicAttackWindow,
  doctorStrangeTreacheryOptions,
  doctorStrangeEnemyAttackInitiated,
  doctorStrangeEncounterReveal,
  doctorStrangeSchemeDefeated,
  resolveDoctorStrangeEffect,
  DOCTOR_STRANGE_SCRIPT_CODES,
  type DoctorStrangePorts,
} from "./doctor-strange.js";
import {
  blackWidowAllyDiscount,
  blackWidowPlayRestriction,
  blackWidowCardPlayed,
  blackWidowAbilityOptions,
  blackWidowAbility,
  blackWidowResourceSpent,
  blackWidowEvent,
  blackWidowAllyEnter,
  blackWidowBoostOptions,
  blackWidowRevealOptions,
  blackWidowMinionEntered,
  blackWidowThreatOptions,
  blackWidowDamageOptions,
  blackWidowAttackResponses,
  blackWidowAllyDefeated,
  blackWidowMinionSchemed,
  blackWidowSurgeOptions,
  blackWidowEnemyModifier,
  blackWidowEncounterReveal,
  blackWidowBoost,
  resolveBlackWidowEffect,
  BLACK_WIDOW_SCRIPT_CODES,
  type BlackWidowPorts,
} from "./black-widow.js";
import {
  beginRevealWindow,
  revealWindowGainSurge,
  resolveRevealWindowEffect,
} from "./reveal-window.js";
import {
  GOBLIN_MODULE_SCRIPT_CODES,
  goblinModuleReveal,
  goblinModuleBoost,
  goblinModuleDefeated,
  goblinModuleAttackResponses,
  goblinIdentityLocked,
  goblinWhenRevealedCopies,
  goblinModuleAttachmentActions,
  resolveGoblinModuleEffect,
  type GoblinModuleEnginePorts,
} from "./goblin-modules.js";
import {
  thorStats,
  thorAllyDiscount,
  thorPlayRestriction,
  thorLightningPaymentOptions,
  thorEvent,
  thorAllyEnter,
  thorCardEntered,
  thorAbilityOptions,
  thorAbility,
  thorResourceSpent,
  thorEngagementResponses,
  thorBasicPowerWindow,
  thorAfterHeroAttack,
  thorMinionDefeated,
  thorPreventsDefeat,
  thorEncounterReveal,
  thorBoost,
  resolveThorEffect,
  type ThorEnginePorts,
} from "./thor.js";
import {
  msMarvelEventAmountModifier,
  msMarvelBeforeEvent,
  msMarvelAfterEvent,
  msMarvelStats,
  msMarvelDiscount,
  msMarvelCardPlayed,
  msMarvelPhaseEnded,
  msMarvelPlayRestriction,
  msMarvelEvent,
  msMarvelAllyEnter,
  msMarvelCardEntered,
  msMarvelAbilityOptions,
  msMarvelAbility,
  msMarvelResourceSpent,
  msMarvelDamageOptions,
  msMarvelAttackInitiatedOptions,
  msMarvelBoostOptions,
  msMarvelRedDaggerOptions,
  msMarvelDiscardPlayable,
  msMarvelDamageImmune,
  msMarvelEncounterReveal,
  resolveMsMarvelEffect,
  type MsMarvelPorts,
} from "./ms-marvel.js";
import {
  RISKY_BUSINESS_SCRIPT_CODES,
  riskySetup,
  riskyVillainRevealed,
  riskySchemeValues,
  riskyMainCompleted,
  riskyActivationReplacement,
  riskyDamageReplacement,
  riskyNextVillainFace,
  riskyBlankPower,
  riskyEnvironmentEffects,
  riskyEncounterReveal,
  riskyBoost,
  resolveRiskyEffect,
  type RiskyBusinessEnginePorts,
} from "./risky-business.js";
import { uniqueConflict } from "./unique.js";
import { isTextBlank, textActiveState } from "./card-text.js";
import { rulesCode } from "./rules-code.js";
import {
  CARDS,
  CATALOG_CARDS,
  DB,
  HEROES,
  ASPECTS,
  MODULES,
  VILLAINS,
  card,
  deckCodes,
  resources,
  heroCard,
  heroStats,
  handSize,
  has,
  maxHP,
  aerial,
  pieceHP,
  plain,
} from "./cards.js";
import type {
  Aspect,
  Attack,
  Card,
  Command,
  Effect,
  GameState,
  MissionStats,
  Option,
  Pacing,
  Piece,
  Prompt,
  Resource,
} from "./types.js";
import {
  activateSeat,
  allInPlay,
  controller,
  engaged,
  playerOrder,
  seatView,
  syncSeat,
  upgradeSave,
} from "./team.js";
import {
  boardSnapshot,
  recordReview,
  continuesReview,
  isMeaningful,
  mergeReviews,
  pacingOf,
  stopsFor,
} from "./review.js";
import {
  paymentSources,
  paymentStatus,
  paidResourceAllocations,
  venomPaymentDamageCostAvailable,
} from "./payment.js";
import { combatCharacter, recordCombat } from "./combat.js";
import { deckErrors } from "./decks.js";
import {
  captainSetup,
  captainAbilityOptions,
  captainAbility,
  captainEvent,
  captainAllyEnter,
  captainStats,
  captainAllyDiscount,
  captainCardPlayed,
  captainPhaseEnded,
  captainShieldBlockOptions,
  captainHelmetOptions,
  captainEncounterReveal,
  captainMinionDefeated,
  captainThwartBlocked,
  captainPlayRestriction,
  resolveCaptainEffect,
  CAPTAIN_AMERICA_SCRIPT_CODES,
} from "./captain-america.js";
import {
  cardScript,
  hasExecutableScript,
  scriptedModifier,
} from "./script-registry.js";
import { checkScriptLegality, scriptEffects } from "./scripts/runtime.js";
import type { ScriptContext, ScriptSelector } from "./scripts/types.js";
import {
  printedKeyword,
  scaledKeyword,
  giveStatus,
  consumeStatus,
  consumeTough,
  discardToughForPiercing,
  syncStatuses,
  statusCards,
} from "./keywords.js";
import type { PrintedKeyword, StatusKind, StatusState } from "./keywords.js";
import {
  hulkStats,
  hulkFormChanged,
  hulkTurnEnds,
  hulkAbilityOptions,
  hulkAbility,
  hulkPaymentAllowed,
  hulkPlayRestriction,
  hulkBasicAttackWindow,
  hulkEvent,
  hulkThreatLocked,
  hulkAfterEnemyAttack,
  hulkEncounterReveal,
  resolveHulkEffect,
} from "./hulk.js";
import {
  captainPackModifiers,
  captainPackHasTrait as captainPrintedHasTrait,
  captainPackStats,
  captainPackAllyLimit,
  captainPackDiscount,
  captainPackCardPlayed,
  captainPackPhaseEnded,
  captainPackPlayRestriction,
  captainPackEvent,
  captainPackAllyEnter,
  captainPackAllyAttackCost,
  captainPackCardEntered,
  captainPackTurnStart,
  captainPackAbilityOptions,
  captainPackAbility,
  captainPackResourceSpent,
  captainPackSchemeDefeated,
  captainPackExpertDefenseOptions,
  resolveCaptainPackEffect,
} from "./captain-pack.js";
import {
  hulkPackModifiers,
  hulkPackPlayRestriction,
  hulkPackEvent,
  hulkPackAllyEnter,
  hulkPackAllyResponse,
  hulkPackCardEntered,
  hulkPackAbilityOptions,
  hulkPackAbility,
  hulkPackResourceSpent,
  hulkPackAttackResponseOptions,
  resolveHulkPackEffect,
} from "./hulk-pack.js";
export { paymentSources } from "./payment.js";
import {
  MUTAGEN_FORMULA_SCRIPT_CODES,
  mutagenSetup,
  mutagenVillainRevealed,
  mutagenSchemeValues,
  mutagenMainCompleted,
  mutagenAttackModifiers,
  mutagenAdditionalBoosts,
  mutagenAttackResponses,
  mutagenDefeated,
  mutagenAttachmentActions,
  mutagenEncounterReveal,
  mutagenBoost,
  resolveMutagenEffect,
} from "./mutagen-formula.js";
import type {
  MutagenEnginePorts,
  MutagenActivation,
} from "./mutagen-formula.js";
export const SAVE_KEY = "champions.save.v1";
const E = (type: string, args: Record<string, any> = {}): Effect => ({
  type,
  ...args,
});
const option = (
  id: string,
  label: string,
  effects: Effect[],
  detail?: string,
  image?: string,
): Option => ({ id, label, effects, detail, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
export const emptyStats = (): MissionStats => ({
  damageDealt: 0,
  damageTaken: 0,
  threatRemoved: 0,
  threatPlaced: 0,
  cardsPlayed: 0,
  enemiesDefeated: 0,
});
function track(s: GameState, key: keyof MissionStats, n: number) {
  if (n <= 0) return;
  (s.stats ||= emptyStats())[key] += n;
}
/** Hidden information came into view (or the RNG advanced): earlier states can no longer be restored fairly. */
function revealHidden(s: GameState) {
  s.hiddenInfo = (s.hiddenInfo || 0) + 1;
}
export function log(
  s: GameState,
  text: string,
  kind: "info" | "good" | "bad" | "phase" = "info",
) {
  s.log.push({
    id: s.nextId++,
    round: s.round,
    text:
      s.playerCount > 1
        ? `${HEROES.find((h) => h.id === s.heroId)!.name} · ${text}`
        : text,
    kind,
  });
  if (s.log.length > 350) s.log.shift();
}
function random(s: GameState) {
  revealHidden(s);
  let x = s.seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  s.seed = x >>> 0;
  return s.seed / 4294967296;
}
function shuffle<T>(s: GameState, a: T[]) {
  if (a === (s.encounter?.deck as unknown)) delete s.encounter.knownTop;
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(s) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function makePiece(s: GameState, code: string): Piece {
  return {
    id: `c${s.nextId++}`,
    code,
    ownerId:
      card(code).faction_code !== "encounter" ? s.activePlayerId : undefined,
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: keyword(code, "Toughness"),
    stunned: false,
    confused: false,
  };
}
function keyword(p: Piece | string, name: string) {
  return printedKeyword(card(p), name as PrintedKeyword) > 0;
}
function giveCharacterStatus(
  s: GameState,
  p: StatusState,
  kind: StatusKind,
  definition?: Card,
) {
  const c = definition || ("code" in p ? card(p as Piece) : heroCard(s));
  const changed = giveStatus(p, c, kind);
  if (
    changed &&
    "code" in p &&
    keyword(p as Piece, "Vulnerable") &&
    (p.stunned || p.confused)
  )
    discardPiece(s, (p as Piece).id);
  return changed;
}
/** All identity-ready effects share absolute restrictions and actual ready responses. */
function canReadyIdentity(s: GameState) {
  return !goblinIdentityLocked(s) && quicksilver.quicksilverCanReady(s);
}
function readyIdentity(s: GameState) {
  if (!s.player.exhausted || !canReadyIdentity(s)) return false;
  s.player.exhausted = false;
  add(s, ...quicksilver.quicksilverReadied(s));
  return true;
}
function sourceKeyword(s: GameState, source: string, name: PrintedKeyword) {
  if (source.startsWith("hero:"))
    return sourceKeyword(seatView(s, source.slice(5)), "hero", name);
  if (source === "hero")
    return (
      printedKeyword(heroCard(s), name) +
      (name === "Ranged" && s.player.inPlay.some((p) => p.code === "04002")
        ? 1
        : 0) +
      (name === "Retaliate"
        ? captainStats(s).retaliate +
          hulkStats(s).retaliate +
          drax.draxStats(s).retaliate +
          spectrum.spectrumRetaliate(s) +
          wasp.waspRetaliate(textActiveState(s)) +
          gmwPack.gmwPlayerPackRetaliate(textActiveState(s), gmwPorts)
        : 0)
    );
  const p = find(s, source);
  if (!p) return 0;
  const granted = hawkeyeEnemyAttackTraits(s, p);
  const allyTraits = hawkeyeAllyAttackTraits(p);
  const packTraits = starLordPack.starLordPackModifiers(
    s,
    p.id,
    starLordPackPorts,
  );
  return Math.max(
    printedKeyword(card(p), name),
    Number(
      name === "Piercing" &&
        (granted.piercing ||
          allyTraits.piercing ||
          (s.attack?.attacker === p.id && s.attack.piercing)),
    ),
    Number(
      name === "Ranged" &&
        (granted.ranged ||
          allyTraits.ranged ||
          packTraits.ranged ||
          venomPack.venomPackAllyKeywords(s, p).ranged),
    ),
    Number(name === "Overkill" && packTraits.overkill),
  );
}
// A card that leaves play loses all memory of its previous instance (RRG 27).
function resetPiece(p: Piece, entering = false): Piece {
  return {
    id: p.id,
    code: p.code,
    ownerId: p.ownerId,
    exhausted: false,
    damage: 0,
    counters: 0,
    tough: entering && keyword(p, "Toughness"),
    stunned: false,
    confused: false,
    stunCards: undefined,
    confuseCards: undefined,
    toughCards: undefined,
  };
}
function beginResolution(s: GameState, p: Piece) {
  if (!s.resolving.some((x) => x.id === p.id)) s.resolving.push(p);
}
function finishResolution(s: GameState, id: string) {
  const index = s.resolving.findIndex((p) => p.id === id);
  if (index < 0) return;
  const [p] = s.resolving.splice(index, 1);
  if (
    card(p).faction_code === "encounter" ||
    mtsPlayerPack.mtsIsCosmicEntity(p)
  )
    s.encounter.discard.push(resetPiece(p));
  else {
    const owner = s.players.find((seat) => seat.id === p.ownerId);
    if (owner?.eliminated) s.removed.push(resetPiece(p));
    else (owner ? seatView(s, owner) : s).player.discard.push(resetPiece(p));
  }
}
function effectContext(s: GameState, e: Effect): Effect {
  return {
    actorId: s.activePlayerId,
    eventId: s.currentEventId,
    attackProgramId: s.currentAttackProgramId,
    responseGroup: s.currentResponseGroup,
    mandatory: s.currentResponseMandatory,
    revealWindowId: s.currentRevealWindowId,
    ...e,
  };
}
function add(s: GameState, ...effects: Effect[]) {
  const queued = effects.map((e) => effectContext(s, e));
  // Responses created by a defeated character must wait for every mandatory
  // effect of the same simultaneous attack, including other targets' Retaliate.
  const deferred = queued.filter(
    (e) => e.responseGroup && e.mandatory === false,
  );
  s.queue.unshift(...queued.filter((e) => !deferred.includes(e)));
  for (const e of deferred.reverse()) {
    let lastMandatory = -1;
    s.queue.forEach((x, i) => {
      if (x.responseGroup === e.responseGroup && x.mandatory) lastMandatory = i;
    });
    s.queue.splice(lastMandatory + 1, 0, e);
  }
}
function choose(
  s: GameState,
  title: string,
  text: string,
  options: Option[],
  cancelable = false,
) {
  if (!options.length) {
    log(s, `${title}: no eligible target.`);
    return;
  }
  s.prompt = {
    kind: "choice",
    title,
    text,
    options: options.map((o) => ({
      ...o,
      effects: o.effects.map((e) => effectContext(s, e)),
    })),
    cancelable,
  };
}
function select(
  s: GameState,
  title: string,
  text: string,
  pieces: Piece[],
  min: number,
  max: number,
  action: Effect,
) {
  s.prompt = {
    kind: "select",
    title,
    text,
    options: pieces.map((p) =>
      option(p.id, card(p).name, [], plain(card(p).text), p.code),
    ),
    min,
    max,
    selectAction: effectContext(s, action),
  };
}
const allPieces = (s: GameState) => [
  s.villain,
  ...s.minions,
  ...s.sideSchemes,
  ...allInPlay(s),
  ...s.attachments,
  ...(s.environments || []),
];
const find = (s: GameState, id: string) =>
  allPieces(s).find((p) => p.id === id);
const friends = (s: GameState) =>
  s.player.inPlay.filter((p) => card(p).type_code === "ally");
export function allyCount(s: GameState) {
  return friends(s).filter((p) => !antPack.antManPackAllyExcluded(s, p)).length;
}
export function allyLimit(s: GameState) {
  return (
    3 +
    Number(has(s, "01073")) +
    captainPackAllyLimit(s) +
    starLordPack.starLordPackAllyLimit(s) +
    mtsPlayerPack.mtsPlayerPackAllyLimit(s, mtsPlayerPackPorts) +
    scriptedModifier(s, "ally_limit")
  );
}
function putAllyFromHand(s: GameState, id: string) {
  const index = s.player.hand.findIndex((p) => p.id === id);
  need(
    index >= 0 && card(s.player.hand[index]).type_code === "ally",
    "The ally is no longer in hand.",
  );
  if (uniqueConflict(s, card(s.player.hand[index]))) return;
  const [p] = s.player.hand.splice(index, 1);
  Object.assign(p, resetPiece(p, true));
  if (rulesCode(p) === "01066") p.counters = 4;
  s.player.inPlay.push(p);
  add(
    s,
    ...mtsPlayerPack.mtsPlayerPackCardEntered(s, p),
    E("allyLimit"),
    ...(rulesCode(p) !== "01002" ? [E("allyEnter", { id: p.id })] : []),
  );
}
function attachPackUpgrade(s: GameState, upgradeId: string, target: string) {
  const p = find(s, upgradeId),
    source = controller(s, upgradeId);
  const targetSeat = target.startsWith("hero:")
    ? s.players.find((seat) => seat.id === target.slice(5))
    : controller(s, target);
  need(
    p &&
      source &&
      (targetSeat || s.sideSchemes.some((piece) => piece.id === target)),
    "Attachment target is unavailable.",
  );
  const targetView = targetSeat ? seatView(s, targetSeat) : undefined;
  const healthBefore = targetView ? maxHP(targetView) : 0;
  p!.attachedTo = target;
  if (targetSeat && source!.id !== targetSeat.id) {
    const zone = seatView(s, source!).player.inPlay;
    zone.splice(zone.indexOf(p!), 1);
    targetView!.player.inPlay.push(p!);
  }
  if (targetView && target.startsWith("hero:"))
    targetView.player.hp += maxHP(targetView) - healthBefore;
}
const villainAt = (s: GameState, code: string) =>
  s.attachments.filter(
    (p) => rulesCode(p) === rulesCode(code) && p.attachedTo === s.villain.id,
  );
function discardHand(s: GameState, id: string) {
  const i = s.player.hand.findIndex((p) => p.id === id);
  need(i >= 0, "That card is no longer in your hand.");
  const [p] = s.player.hand.splice(i, 1);
  s.player.discard.push(p);
  return p;
}
function randomDiscard(s: GameState) {
  if (!s.player.hand.length) return undefined;
  return discardHand(
    s,
    s.player.hand[Math.floor(random(s) * s.player.hand.length)].id,
  );
}
function recyclePlayer(s: GameState) {
  if (s.player.deck.length) {
    s.flags.warlockDeckEmptyObserved = false;
    return;
  }
  const exhausted = !s.flags.warlockDeckEmptyObserved
    ? warlock.warlockDeckExhausted(s)
    : [];
  s.flags.warlockDeckEmptyObserved = true;
  if (!s.player.deck.length && s.player.discard.length) {
    s.player.deck = shuffle(s, s.player.discard.splice(0));
    s.flags.warlockDeckEmptyObserved = false;
    dealEncounter(s);
    // This forced response has no choice. Commit it at the real reset so
    // end-of-phase readiness which follows a draw retains its printed timing.
    for (const e of warlock.warlockDeckReset(s)) {
      const church = s.sideSchemes.find((p) => p.id === e.id);
      if (church && !isTextBlank(s, church)) {
        s.player.exhausted = true;
        giveCharacterStatus(s, s.player, "stunned");
      }
    }
    log(
      s,
      "Your deck reshuffles. You are dealt an extra encounter card.",
      "bad",
    );
  }
  add(s, ...exhausted);
}
function takePlayer(s: GameState) {
  recyclePlayer(s);
  const p = s.player.deck.shift();
  if (p) {
    revealHidden(s);
    recyclePlayer(s);
  }
  return p;
}
function draw(s: GameState, n: number) {
  let count = 0;
  for (let i = 0; i < n; i++) {
    const p = takePlayer(s);
    if (p) {
      s.player.hand.push(p);
      count++;
    }
  }
  if (count) log(s, `Draw ${count} card${count === 1 ? "" : "s"}.`);
}
function mill(s: GameState, n: number) {
  const a: Piece[] = [];
  const available = Math.min(n, s.player.deck.length);
  for (let i = 0; i < available; i++) {
    const p = s.player.deck.shift();
    if (p) {
      revealHidden(s);
      a.push(p);
      s.player.discard.push(p);
    }
  }
  recyclePlayer(s);
  return a;
}
function recycleEncounter(s: GameState) {
  if (!s.encounter.deck.length && s.encounter.discard.length) {
    delete s.encounter.knownTop;
    s.encounter.deck = shuffle(s, s.encounter.discard.splice(0));
    s.encounter.acceleration++;
    log(s, "Encounter deck reshuffles: +1 acceleration token.", "bad");
  }
}
function drawEncounter(s: GameState) {
  recycleEncounter(s);
  const p = s.encounter.deck.shift();
  if (s.encounter.knownTop?.id === p?.id) delete s.encounter.knownTop;
  if (p) revealHidden(s);
  recycleEncounter(s);
  return p;
}
function dealEncounter(s: GameState, playerId = s.activePlayerId) {
  if (s.players.find((seat) => seat.id === playerId)?.eliminated) return;
  const p = drawEncounter(s);
  if (p) {
    p.dealtTo = playerId;
    s.encounter.dealt.push(p);
  }
}
function discardPiece(s: GameState, id: string) {
  movePieceFromPlay(s, id, false);
}
function removePlayerCard(s: GameState, id: string) {
  const p = allInPlay(s).find((p) => p.id === id);
  need(
    p && card(p).faction_code !== "encounter",
    "The owned player card is no longer in play.",
  );
  movePieceFromPlay(s, id, true);
}
/** Leaving-play cleanup is shared; a removed source never enters a discard
 * pile. Attached and stored cards keep their ordinary native destinations. */
function movePieceFromPlay(s: GameState, id: string, removed: boolean) {
  const controlling = controller(s, id);
  const viewBefore = controlling ? seatView(s, controlling) : s;
  const healthBefore = maxHP(viewBefore);
  const removedSource = find(s, id);
  // Spectrum's three physical setup upgrades remain in play even facedown.
  // Player elimination removes them through its ordinary whole-seat cleanup.
  if (
    removedSource &&
    Object.values(spectrum.SPECTRUM_FORM_CODES).includes(
      removedSource.code as (typeof spectrum.SPECTRUM_FORM_CODES)[keyof typeof spectrum.SPECTRUM_FORM_CODES],
    )
  )
    return;
  const blankBefore = !!removedSource && isTextBlank(s, removedSource);
  const teamHealthBefore =
    removedSource?.code === "12026"
      ? s.players.map((seat) => ({ id: seat.id, hp: maxHP(seatView(s, seat)) }))
      : [];
  let p: Piece | undefined;
  for (const zone of [
    ...s.players.map((x) => seatView(s, x).player.inPlay),
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.environments || [],
  ]) {
    const i = zone.findIndex((x) => x.id === id);
    if (i >= 0) {
      [p] = zone.splice(i, 1);
      break;
    }
  }
  if (!p) return;
  if (p.code === "13029" && p.attachedTo === s.villain.id) {
    s.villain.maxHp -= 4;
    s.villain.hp -= 4;
  }
  for (const before of teamHealthBefore) {
    const view = seatView(s, before.id);
    view.player.hp += maxHP(view) - before.hp;
  }
  for (const stored of p.storedCards || []) {
    const owner = s.players.find((seat) => seat.id === stored.ownerId);
    if (!owner || owner.eliminated) s.removed.push(resetPiece(stored));
    else seatView(s, owner).player.discard.push(resetPiece(stored));
  }
  for (const a of [...allInPlay(s), ...s.attachments].filter(
    (a) => a.attachedTo === id,
  ))
    discardPiece(s, a.id);
  if (p.code === "drone") {
    if (p.droneCard) {
      const owner = s.players.find((x) => x.id === p!.droneCard!.ownerId);
      if (owner && !owner.eliminated)
        seatView(s, owner).player.discard.push(p.droneCard);
      else s.removed.push(p.droneCard);
    }
  } else if (card(p).faction_code === "encounter")
    s.encounter.discard.push(resetPiece(p));
  else {
    const owner =
      s.players.find((x) => x.id === p!.ownerId) ||
      controlling ||
      s.players.find((x) => x.id === s.activePlayerId)!;
    const discarded = resetPiece(p);
    if (removed || owner.eliminated) s.removed.push(discarded);
    else seatView(s, owner).player.discard.push(discarded);
    const view = controlling ? seatView(s, controlling) : s;
    if (rulesCode(p) === "01036" && !blankBefore) view.player.hp -= 6;
    if (rulesCode(p) === "01039" && !blankBefore) view.player.hp--;
    if (p.code === "10010") view.player.hp -= 4;
    if (
      cardScript(p)?.implementation === "script" ||
      p.code === "16035" ||
      (p.code === "03025" && p.attachedTo?.startsWith("hero:"))
    )
      view.player.hp -= healthBefore - maxHP(view);
    view.player.hp = Math.min(view.player.hp, maxHP(view));
  }
}
function endGame(s: GameState, won: boolean, reason: string) {
  s.encounter.discard.push(
    ...(s.attack?.pendingBoosts || []),
    ...(s.scheming?.pendingBoosts || []),
  );
  if (s.attack) s.attack.pendingBoosts = [];
  if (s.scheming) s.scheming.pendingBoosts = [];
  for (const p of [...s.resolving]) finishResolution(s, p.id);
  s.phase = won ? "won" : "lost";
  s.result = reason;
  s.queue = [];
  s.prompt = null;
  log(s, reason, won ? "good" : "bad");
}
/** Extra Weapon slots cannot absorb non-Weapon Restricted cards. */
function restrictedLimitExceeded(s: GameState) {
  const restricted = s.player.inPlay.filter((p) => keyword(p, "Restricted"));
  const general = 2 + venom.venomRestrictedAllowance(s);
  const weapons = restricted.filter(
    (p) =>
      card(p).type_code === "upgrade" &&
      /(?:^|\.)\s*Weapon\s*(?:\.|$)/i.test(card(p).traits || ""),
  ).length;
  const weaponSlots = venomPack.venomPackRestrictedWeaponAllowance(s);
  return restricted.length - Math.min(weapons, weaponSlots) > general;
}
function check(s: GameState) {
  // Simultaneous Spectrum batches place every prepared packet before checking
  // hero elimination. This flag exists only during the synchronous commit.
  if (
    s.players.some(
      (seat) => seatView(s, seat).flags.spectrumDamageBatchApplying,
    )
  )
    return;
  add(s, ...riskyEnvironmentEffects(s));
  syncSeat(s);
  const active = s.activePlayerId;
  for (const seat of playerOrder(s)) {
    if (seatView(s, seat).player.hp <= 0) continue;
    activateSeat(s, seat.id);
    recyclePlayer(s);
  }
  activateSeat(s, active);
  recycleEncounter(s);
  for (const p of [
    ...s.minions,
    ...allInPlay(s).filter((x) => card(x).type_code === "ally"),
  ]) {
    if (find(s, p.id) && p.damage >= pieceHP(s, p))
      defeatCharacter(s, p, String(s.flags.spectrumBatchDefeatSource || ""));
  }
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    if (
      restrictedLimitExceeded(view) &&
      !(
        s.prompt?.title === "Restricted limit" && s.activePlayerId === seat.id
      ) &&
      !s.queue.some(
        (e) =>
          ["restrictedLimit", "discardRestricted"].includes(e.type) &&
          e.actorId === seat.id,
      )
    )
      add(s, E("restrictedLimit", { actorId: seat.id }));
    if (
      allyCount(view) > allyLimit(view) &&
      !(s.prompt?.title === "Ally limit" && s.activePlayerId === seat.id) &&
      !s.queue.some(
        (e) =>
          ["allyLimit", "discardForLimit"].includes(e.type) &&
          (e.actorId || s.activePlayerId) === seat.id,
      )
    )
      add(s, E("allyLimit", { actorId: seat.id }));
  }
  for (const seat of s.players) {
    seat.player.hp = Math.max(0, seat.player.hp);
    if (seat.player.hp > 0 || seat.eliminated || s.phase === "won") continue;
    const view = seatView(s, seat);
    if (view.flags.captainHelmetPending || view.flags.draxStubbornPending)
      continue;
    if (!view.flags.captainHelmetDeclined) {
      const choices = captainHelmetOptions(view, [
        E("captainAllowDefeat", { actorId: seat.id }),
      ]);
      if (choices.length && s.prompt) continue;
      if (choices.length && !s.prompt) {
        activateSeat(s, seat.id);
        s.flags.captainHelmetPending = true;
        choose(
          s,
          "Captain America’s Helmet",
          "Your identity would be defeated. Use its printed replacement?",
          choices,
        );
        return;
      }
    }
    if (!view.flags.draxStubbornDeclined) {
      const after = [E("draxDefeatResume", { actorId: seat.id })];
      const choices = drax.draxDefeatOptions(view, after, draxPorts);
      if (choices.length) {
        // Finish an existing payment or ally choice before opening this
        // identity interrupt. A pending replacement must not eliminate Drax.
        if (s.prompt) continue;
        activateSeat(s, seat.id);
        s.flags.draxStubbornPending = true;
        choose(
          s,
          "Too Stubborn to Die",
          "Your identity would be defeated. Use its printed replacement?",
          [
            ...choices,
            option("defeat", "Let Drax be defeated", [
              E("draxAllowDefeat", { actorId: seat.id }),
            ]),
          ],
        );
        return;
      }
    }
    seat.eliminated = true;
    seat.ended = true;
    if (s.attack?.targetPlayerId === seat.id) {
      s.encounter.discard.push(...(s.attack.pendingBoosts || []));
      for (const id of s.attack.boostIds || []) finishResolution(s, id);
      // Established delayed effects still resolve when elimination ends the
      // attack early, including elimination during an earlier boost ability.
      add(
        s,
        ...antMan.antManEnemyActivated(s, s.attack.attacker),
        ...(s.attack.afterActivation || []),
      );
      s.attack.afterActivation = [];
      s.attack = null;
    }
    const i = s.players.indexOf(seat);
    const next = [...s.players.slice(i + 1), ...s.players.slice(0, i)].find(
      (p) => !p.eliminated,
    );
    log(
      s,
      `${HEROES.find((h) => h.id === seat.heroId)!.name} is defeated.${next ? " The remaining heroes continue the mission." : ""}`,
      "bad",
    );
    if (!next) {
      endGame(s, false, "Every hero has been defeated. The villain wins.");
      return;
    }
    if (s.firstPlayerId === seat.id) s.firstPlayerId = next.id;
    for (const m of s.minions)
      if (m.engagedWith === seat.id) m.engagedWith = next.id;
    for (const other of s.players) {
      const state = seatView(s, other).player;
      for (const key of [
        "hand",
        "deck",
        "discard",
        "inPlay",
        "invocationDeck",
        "invocationDiscard",
      ] as const) {
        const zone = state[key];
        if (!zone) continue;
        for (const piece of [...zone])
          if (piece.ownerId === seat.id || other.id === seat.id) {
            if (key === "inPlay") discardPiece(s, piece.id);
            else {
              zone.splice(zone.indexOf(piece), 1);
              s.removed.push(piece);
            }
          }
      }
    }
    s.encounter.discard.push(
      ...s.encounter.dealt.filter((p) => p.dealtTo === seat.id),
    );
    s.encounter.dealt = s.encounter.dealt.filter((p) => p.dealtTo !== seat.id);
  }
}
export function schemeLimit(s: GameState) {
  const value = riskySchemeValues(s) || mutagenSchemeValues(s);
  const surveillance =
    allInPlay(s).filter(
      (p) =>
        p.code === "06031" &&
        ["main", `main:${s.scheme.code}`].includes(p.attachedTo || ""),
    ).length * 4;
  if (value) return value.threshold + surveillance;
  return (
    (card(s.scheme.code).threat || 0) *
      (card(s.scheme.code).threat_fixed ? 1 : s.playerCount) +
    surveillance
  );
}
export function escalation(s: GameState) {
  const value = riskySchemeValues(s) || mutagenSchemeValues(s);
  if (value) return value.escalation;
  return (
    (card(s.scheme.code).escalation_threat || 0) *
    (card(s.scheme.code).escalation_threat_fixed ? 1 : s.playerCount)
  );
}
function eachPlayer(s: GameState, effect: Effect) {
  return playerOrder(s).map((p) => ({ ...effect, actorId: p.id }));
}
function choosePlayer(
  s: GameState,
  title: string,
  effects: Effect[],
  eligible = playerOrder(s),
) {
  if (eligible.length === 1) {
    add(s, ...effects.map((e) => ({ ...e, actorId: eligible[0].id })));
    return;
  }
  choose(
    s,
    title,
    "Choose which hero receives this effect.",
    eligible.map((p) =>
      option(
        p.id,
        HEROES.find((h) => h.id === p.heroId)!.name,
        effects.map((e) => ({ ...e, actorId: p.id })),
        undefined,
        heroCard(seatView(s, p)).code,
      ),
    ),
  );
}
function heal(s: GameState, target: string, n: number): number {
  if (target?.startsWith("hero:"))
    return heal(seatView(s, target.slice(5)), "hero", n);
  if (target === "hero") {
    const amount = Math.min(n, maxHP(s) - s.player.hp);
    s.player.hp += amount;
    log(s, `Heal ${amount} damage.`, "good");
  } else if (target === s.villain.id) {
    const amount = Math.min(n, s.villain.maxHp - s.villain.hp);
    s.villain.hp += amount;
    log(s, `${card(s.villain).name} heals ${amount}.`, "bad");
    return amount;
  } else {
    const p = find(s, target);
    if (p) p.damage = Math.max(0, p.damage - n);
  }
  return n;
}
interface DamageTraits {
  /** Original dealt amount, before damage-taken prevention. */
  damageDealt?: number;
  /** Overkill is attack damage, but is not a new attack on its recipient. */
  damageFromAttack?: boolean;
  /** P31 specifically excludes prevented excess from damage dealt by Overkill. */
  overkillDamage?: boolean;
  enemyAttack?: boolean;
  piercing?: boolean;
  ranged?: boolean;
  excessToMain?: boolean;
  excessBonus?: number;
  grootHandled?: boolean;
  aftermathChooser?: string;
}
interface DamageTakenResult {
  actualDamage: number;
  excessDamage: number;
  /** An instead effect or damage prohibition can replace damage dealt. */
  damageDealt?: number;
}
interface DamageResult extends DamageTakenResult {
  damageDealt: number;
}
function damageProhibition(s: GameState, target: string, panther: boolean) {
  if (msMarvelDamageImmune(s, target)) return "This enemy cannot take damage.";
  if (
    target === s.villain.id &&
    s.villainId === "ultron" &&
    s.villain.stage === 3 &&
    s.minions.some((p) => card(p).traits?.includes("Drone."))
  )
    return "Ultron is protected by his drones.";
  const p = find(s, target);
  if (p && rulesCode(p) === "01157" && panther)
    return "Killmonger is immune to Black Panther upgrades.";
  if (
    p &&
    rulesCode(p) === "01181" &&
    s.sideSchemes.some((x) => rulesCode(x) === "01180")
  )
    return "Legions of Hydra protects Madame Hydra.";
  return undefined;
}
function attackExcess(s: GameState, packet: Effect): number {
  const target = find(s, packet.target);
  if (!target || !packet.attack) return 0;
  const source = packet.source || "hero";
  let amount = Number(packet.amount || 0);
  if (["hero", `hero:${s.activePlayerId}`].includes(source))
    amount += msMarvelEventAmountModifier(s, s.currentEventId, "damage");
  const resistance = s.attachments.filter(
    (p) =>
      p.code === "14027" && p.attachedTo === target.id && !isTextBlank(s, p),
  ).length;
  const used = s.currentAttackProgramId
    ? Number(
        s.flags[`qsvVibration:${s.currentAttackProgramId}:${target.id}`] || 0,
      )
    : 0;
  amount = Math.max(0, amount - Math.max(0, resistance - used));
  if (
    target.tough &&
    !(packet.piercing ?? !!sourceKeyword(s, source, "Piercing"))
  )
    return 0;
  if (msMarvelDamageImmune(s, target.id)) return 0;
  if (target.id === s.villain.id) {
    if (
      riskyDamageReplacement(s, target.id, amount) ||
      villainAt(s, "01098").length ||
      (s.villainId === "ultron" &&
        s.villain.stage === 3 &&
        s.minions.some((p) => card(p).traits?.includes("Drone.")))
    )
      return 0;
  } else if (
    (rulesCode(target) === "01157" && packet.panther) ||
    (rulesCode(target) === "01181" &&
      s.sideSchemes.some((p) => rulesCode(p) === "01180"))
  )
    return 0;
  const remaining =
    target.id === s.villain.id
      ? s.villain.hp
      : pieceHP(s, target) - target.damage;
  const excess = Math.max(0, amount - remaining);
  return excess > 0 ? excess + Number(packet.excessBonus || 0) : 0;
}
function dealDamage(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  attack = false,
  overkill = false,
  panther = false,
  traits: DamageTraits = {},
): DamageResult {
  if (
    attack &&
    n > 0 &&
    (source === "hero" || source === `hero:${s.activePlayerId}`) &&
    target !== "hero" &&
    !target.startsWith("hero:")
  )
    n += msMarvelEventAmountModifier(s, s.currentEventId, "damage");
  const original = find(s, target);
  const dealt = Math.max(0, traits.damageDealt ?? n);
  const code = original?.code;
  const originalStage = target === s.villain.id ? s.villain.stage : undefined;
  const sourceIsIdentity = rocket.rocketIsIdentitySource(s, source);
  const wasHero = s.player.form === "hero";
  const targetPiece = target === "hero" ? s.player : original;
  const damageFromAttack = attack || !!traits.damageFromAttack;
  // A prohibition cannot be bypassed by Tough or Piercing. A dealt-damage
  // replacement resolves before Tough and damage-taken prevention (RRG1.8 p14).
  // Keep the actual attack's aftermath even when its damage is prohibited.
  let replaced: DamageTakenResult | undefined;
  const prohibition =
    dealt > 0 ? damageProhibition(s, target, panther) : undefined;
  if (prohibition) {
    log(s, prohibition);
    replaced = { actualDamage: 0, excessDamage: 0, damageDealt: 0 };
  } else if (dealt > 0 && target === s.villain.id) {
    const armor = villainAt(s, "01098")[0];
    if (armor) {
      armor.damage += dealt;
      track(s, "damageDealt", dealt);
      log(s, `Armored Rhino Suit absorbs ${dealt} damage.`);
      if (armor.damage >= 5) discardPiece(s, armor.id);
      replaced = { actualDamage: 0, excessDamage: 0, damageDealt: 0 };
    }
  }
  // Piercing discards Tough only if the attack would deal damage to the
  // attacked character; Armor replaces that damage entirely (RRG1.8 p32).
  if (!replaced && targetPiece && attack)
    discardToughForPiercing(
      targetPiece,
      n,
      traits.piercing ?? !!sourceKeyword(s, source, "Piercing"),
    );
  // Constant reductions precede Tough (RRG1.8 FAQ). Multiple packets of the
  // same attack share one Vibration Resistance allowance.
  if (!replaced && damageFromAttack && n > 0 && original) {
    const resistance = s.attachments.filter(
      (a) =>
        a.code === "14027" && a.attachedTo === target && !isTextBlank(s, a),
    ).length;
    if (resistance) {
      const key = s.currentAttackProgramId
        ? `qsvVibration:${s.currentAttackProgramId}:${target}`
        : undefined;
      const used = key ? Number(s.flags[key] || 0) : 0;
      const reduced = Math.min(n, Math.max(0, resistance - used));
      n -= reduced;
      if (key) s.flags[key] = used + reduced;
      if (reduced)
        log(s, `Vibration Resistance prevents ${reduced} attack damage.`);
    }
  }
  const previousQueue = new Set(s.queue);
  const taken =
    replaced ??
    applyDamage(s, target, n, source, attack, overkill, panther, traits);
  const result: DamageResult = {
    ...taken,
    damageDealt:
      taken.damageDealt ?? (traits.overkillDamage ? taken.actualDamage : dealt),
  };
  if (damageFromAttack && original && !["won", "lost"].includes(s.phase))
    add(
      s,
      ...drax.draxDamageDealt(
        s,
        {
          target,
          attack: true,
          sourceIsDrax: s.heroId === "drax" && sourceIsIdentity,
          damageDealt: result.damageDealt,
        },
        draxPorts,
      ),
    );
  if (
    traits.excessToMain &&
    original &&
    card(original).type_code === "minion" &&
    result.excessDamage > 0
  ) {
    // This is a removal effect, so Crisis still protects the main scheme.
    add(
      s,
      E("thwart", { target: "main", amount: result.excessDamage, source }),
    );
  }
  if (
    attack &&
    source === "hero" &&
    original &&
    !["won", "lost"].includes(s.phase)
  )
    add(
      s,
      E("heroAttackResponses", {
        target,
        wasMinion: card(original).type_code === "minion",
        defeatedCode: code,
        excessDamage: result.excessDamage,
        mandatory: false,
        afterAttack: true,
      }),
    );
  if (
    s.heroId === "rocket" &&
    sourceIsIdentity &&
    original &&
    (target === s.villain.id || card(original).type_code === "minion") &&
    result.damageDealt > 0 &&
    !["won", "lost"].includes(s.phase)
  )
    add(
      s,
      E("rocketDamageResponses", {
        snapshot: {
          target,
          code,
          stage: originalStage,
          playerId: s.activePlayerId,
          ...result,
          sourceIsIdentity,
          wasHero,
        },
        mandatory: true,
      }),
    );
  // Retaliate responds to the attack, even when its damage is prevented.
  // A same-title villain stage is the same character for card abilities (RRG).
  if (
    attack &&
    original &&
    (find(s, target)?.code === code ||
      (target === s.villain.id &&
        card(find(s, target)!).name === card(code!).name)) &&
    !["won", "lost"].includes(s.phase)
  ) {
    const amount =
      (traits.ranged ?? !!sourceKeyword(s, source, "Ranged"))
        ? 0
        : (isTextBlank(s, original)
            ? 0
            : printedKeyword(card(original), "Retaliate")) +
          antMan.antManEnemyRetaliate(s, original) +
          (target === s.villain.id
            ? villainAt(s, "01119").length + villainAt(s, "01153").length
            : 0);
    if (amount)
      add(
        s,
        E("damage", {
          target: source,
          amount,
          source: "retaliate",
          retaliateSource: original.id,
          title: `${card(original).name} · Retaliate ${amount}`,
          mandatory: true,
          afterAttack: true,
        }),
      );
  }
  if (attack && original && !["won", "lost"].includes(s.phase)) {
    const aftermathChooser =
      traits.aftermathChooser ||
      (s.flags.waspDeferDefeats ? s.activePlayerId : undefined);
    const generated = s.queue.filter((e) => !previousQueue.has(e));
    const continuation = s.queue.filter((e) => previousQueue.has(e));
    const responseGroup = s.currentAttackProgramId
      ? `attackProgram:${s.currentAttackProgramId}`
      : s.currentEventId && source === "hero"
        ? `eventAttack:${s.currentEventId}`
        : s.currentResponseGroup || `attack${s.nextId++}`;
    const effects: Effect[] = generated.map((e) => ({
      ...e,
      responseGroup,
      mandatory: e.mandatory ?? true,
    }));
    const isBoundary = (e: Effect) =>
      s.currentAttackProgramId
        ? e.type === "attackProgramEnd" && e.id === s.currentAttackProgramId
        : e.type === "finishResolution" && e.id === s.currentEventId;
    const finish =
      s.currentAttackProgramId || (s.currentEventId && source === "hero")
        ? continuation.findIndex(isBoundary)
        : -1;
    if (finish >= 0) {
      const immediate = effects.filter((e) => !e.afterAttack);
      immediate.sort(
        (a, b) =>
          Number(a.type === "rocketDamageResponses") -
          Number(b.type === "rocketDamageResponses"),
      );
      const previousAfter = continuation.filter(
        (e) => e.responseGroup === responseGroup && e.afterAttack,
      );
      const after = [...previousAfter];
      for (const effect of effects.filter((e) => e.afterAttack)) {
        const previous = after.findIndex(
          (x) =>
            x.type === effect.type &&
            (effect.type === "heroAttackResponses"
              ? x.target === effect.target
              : effect.retaliateSource &&
                x.retaliateSource === effect.retaliateSource),
        );
        if (previous < 0) after.push(effect);
        // One attack can hit the same enemy twice (Giant Stomp). Keep its
        // lethal packet's excess damage while offering each aftermath once.
        else if (
          effect.type === "heroAttackResponses" &&
          effect.excessDamage > after[previous].excessDamage
        )
          after[previous] = effect;
      }
      const remaining = continuation.filter((e) => !previousAfter.includes(e));
      const boundary = remaining.findIndex(isBoundary);
      remaining.splice(
        boundary,
        0,
        E("attackAftermathOrder", {
          responseGroup,
          actorId: aftermathChooser || s.firstPlayerId,
          chooserId: aftermathChooser,
          mandatory: true,
        }),
        ...after.filter((e) => e.mandatory),
        ...after.filter((e) => !e.mandatory),
      );
      for (let i = remaining.length - 1; i >= 0; i--)
        if (
          remaining[i].type === "attackAftermathOrder" &&
          remaining[i].responseGroup === responseGroup &&
          i !== boundary
        )
          remaining.splice(i, 1);
      s.queue = [
        ...immediate.filter((e) => e.mandatory),
        ...immediate.filter((e) => !e.mandatory),
        ...remaining,
      ];
    } else {
      const immediate = effects.filter((e) => !e.afterAttack);
      immediate.sort(
        (a, b) =>
          Number(a.type === "rocketDamageResponses") -
          Number(b.type === "rocketDamageResponses"),
      );
      s.queue = [
        ...immediate.filter((e) => e.mandatory),
        ...immediate.filter((e) => !e.mandatory),
        E("attackAftermathOrder", {
          responseGroup,
          actorId: aftermathChooser || s.firstPlayerId,
          chooserId: aftermathChooser,
          mandatory: true,
        }),
        ...effects.filter((e) => e.afterAttack && e.mandatory),
        ...effects.filter((e) => e.afterAttack && !e.mandatory),
        ...continuation,
      ];
    }
  }
  return result;
}
function applyDamage(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  attack = false,
  overkill = false,
  panther = false,
  traits: DamageTraits = {},
): DamageTakenResult {
  const none = { actualDamage: 0, excessDamage: 0 };
  if (target?.startsWith("hero:")) {
    const prev = s.activePlayerId;
    activateSeat(s, target.slice(5));
    const result = dealDamage(
      s,
      "hero",
      n,
      source,
      attack,
      overkill,
      panther,
      traits,
    );
    activateSeat(s, prev);
    return result;
  }
  if (n <= 0) return none;
  const p = target === "hero" ? s.player : find(s, target);
  if (!p) return none;
  if (p.tough && !s.flags.ignoreToughPacket) {
    consumeTough(p);
    log(s, "Tough prevents the damage.");
    return none;
  }
  if (target === "hero") {
    if (!traits.grootHandled) n -= groot.grootPreventDamage(s, "hero", n);
    if (n <= 0) return none;
    s.player.hp -= n;
    track(s, "damageTaken", n);
    log(s, `You take ${n} damage.`, "bad");
    check(s);
    return { actualDamage: n, excessDamage: 0 };
  }
  if (target === s.villain.id) {
    const replaced = riskyDamageReplacement(s, target, n);
    if (replaced) {
      add(s, ...replaced);
      // Norman modifies damage TAKEN, unlike Rhino's dealt-damage replacement.
      // Overkill still credits its unprevented amount when a TAKE replacement
      // redirects it; only prevention invokes the specific p31 exception.
      return traits.overkillDamage ? { ...none, damageDealt: n } : none;
    }
    const excess = Math.max(0, n - s.villain.hp);
    const result = {
      actualDamage: n,
      excessDamage: excess > 0 ? excess + Number(traits.excessBonus || 0) : 0,
    };
    s.villain.hp -= n;
    track(s, "damageDealt", n);
    log(s, `${card(s.villain).name} takes ${n} damage.`, "good");
    if (s.villain.hp <= 0) {
      if (s.flags.waspDeferDefeats) return result;
      advanceVillain(s);
      return result;
    }
    if (villainAt(s, "01152").length)
      giveCharacterStatus(s, s.villain, "tough");
    return result;
  }
  const m = find(s, target)!;
  const remain = pieceHP(s, m) - m.damage;
  const excess = Math.max(0, n - remain);
  const result = {
    actualDamage: n,
    excessDamage: excess > 0 ? excess + Number(traits.excessBonus || 0) : 0,
  };
  m.damage += n;
  track(
    s,
    s.minions.some((x) => x.id === m.id) ? "damageDealt" : "damageTaken",
    n,
  );
  log(s, `${card(m).name} takes ${n} damage.`, "good");
  if (m.damage >= pieceHP(s, m)) {
    const deferred = !!s.flags.waspDeferDefeats;
    const defeated =
      deferred ||
      defeatCharacter(s, m, source, attack, false, !!traits.enemyAttack);
    if (
      card(m).type_code === "minion" &&
      defeated &&
      overkill &&
      result.excessDamage > 0
    ) {
      // RRG 1.8 requires an actual defeat. A saved Loki or a minion healed
      // by Biomechanical Upgrades still dealt excess, but does not spill it.
      const spill = E("gmwOverkillDamage", {
        actorId: s.activePlayerId,
        minionId: m.id,
        target: s.villain.id,
        amount: result.excessDamage,
        source,
        damageFromAttack: true,
        overkillDamage: true,
      });
      if (m.pendingDefeat) {
        const i = s.queue.findIndex(
          (e) => e.type === "finishDefeat" && e.id === m.id,
        );
        s.queue.splice(i + 1, 0, effectContext(s, spill));
      } else add(s, spill);
    }
  }
  return result;
}
/** A Major Victory interrupt resolves while the actual ally is still pending
 * defeat. Its physical source receipt prevents another ready when this saved
 * window resumes, while leaving other defeat interrupts available. */
function allyDefeatInterruptOptions(
  s: GameState,
  m: Piece,
  source: string,
  attack: boolean,
  enemyAttack: boolean,
  usedMajorIds: string[] = [],
  originalActorId = s.activePlayerId,
) {
  const owner = controller(s, m.id);
  const view = owner ? seatView(s, owner) : s;
  return [
    ...doctorStrangeDefeatOptions(view, m, []),
    ...msMarvelRedDaggerOptions(view, m, [], msPorts),
    ...(!usedMajorIds.includes(m.id)
      ? mtsPlayerPack
          .mtsPlayerPackAllyDefeatOptions(
            view,
            m,
            [
              E("mtsMajorDefeatWindow", {
                id: m.id,
                piece: { ...m },
                source,
                attack,
                enemyAttack,
                usedMajorIds: [...usedMajorIds, m.id],
                originalActorId,
                actorId: owner?.id,
              }),
            ],
            mtsPlayerPackPorts,
          )
          .map((o) => ({
            ...o,
            effects: o.effects.map((effect) => ({
              ...effect,
              actorId: owner?.id || s.activePlayerId,
            })),
          }))
      : []),
    ...(enemyAttack && card(m).type_code === "ally"
      ? draxPack.draxPackRegroupOptions(
          s,
          m,
          { attack: true, enemySource: true },
          [
            E("dvRegroupDefeatAfter", {
              piece: { ...m },
              playerId: owner?.id,
              actorId: originalActorId,
            }),
          ],
          draxPackPorts,
        )
      : []),
  ];
}
function defeatCharacter(
  s: GameState,
  m: Piece,
  source = "",
  attack = false,
  interrupted = false,
  enemyAttack = false,
) {
  if (m.pendingDefeat && !interrupted) return true;
  if (!interrupted && thorPreventsDefeat(s, m, thorPorts)) return false;
  if (!interrupted) {
    const options = allyDefeatInterruptOptions(
      s,
      m,
      source,
      attack,
      enemyAttack,
    );
    if (options.length) {
      m.pendingDefeat = true;
      choose(
        s,
        card(m).name,
        "Use an interrupt before this ally is defeated?",
        [
          ...options,
          option("defeat", "Let this ally be defeated", [
            E("finishDefeat", { id: m.id, source, attack, enemyAttack }),
          ]),
        ],
      );
      return true;
    }
  }
  const interrupts = interrupted
    ? []
    : (wasp.waspDefeatInterrupt(s, m, source, attack) ?? mutagenDefeated(s, m));
  if (interrupts?.length) {
    m.pendingDefeat = true;
    add(
      s,
      ...interrupts.map((e) => ({ ...e, mandatory: true })),
      E("finishDefeat", { id: m.id, source, attack, mandatory: true }),
    );
    return true;
  }
  const bio = s.attachments.find(
    (a) => rulesCode(a) === "01185" && a.attachedTo === m.id,
  );
  if (bio) {
    m.damage = 0;
    discardPiece(s, bio.id);
    log(s, "Biomechanical Upgrades restores the minion.");
    return false;
  }
  const minion = s.minions.some((x) => x.id === m.id);
  const tracers = allInPlay(s).filter(
    (a) =>
      rulesCode(a) === "01007" && a.attachedTo === m.id && !isTextBlank(s, a),
  );
  const name = card(m).name;
  const allyController = controller(s, m.id)?.id;
  discardPiece(s, m.id);
  if (!minion && allyController)
    add(
      s,
      E("bwAllyDefeated", {
        piece: m,
        playerId: allyController,
        actorId: allyController,
      }),
    );
  log(s, `${name} is defeated.`, "good");
  if (minion) {
    if (rulesCode(m) !== "01182")
      add(
        s,
        ...captainMinionDefeated(s, m).map((e) => ({ ...e, mandatory: false })),
      );
    const identitySource =
      source === "hero" ||
      source === `hero:${s.activePlayerId}` ||
      s.resolving.some(
        (p) =>
          p.id === s.currentEventId &&
          p.ownerId === s.activePlayerId &&
          card(p).type_code === "event" &&
          (p.id === source || p.code === source),
      ) ||
      !!allInPlay(s).find(
        (p) =>
          p.id === source &&
          card(p).type_code === "upgrade" &&
          controller(s, p.id)?.id === s.activePlayerId,
      );
    add(
      s,
      ...thorMinionDefeated(s, identitySource).map((e) => ({
        ...e,
        mandatory: false,
      })),
    );
    track(s, "enemiesDefeated", 1);
    add(s, ...wasp.waspDefeated(s, "minion", source, s.currentEventId, attack));
    s.flags.defeatedMinion = true;
    if (source === "hero" && attack) s.flags.heroKill = true;
    for (const tracer of tracers)
      add(
        s,
        E("target", {
          mandatory: false,
          actorId: tracer.ownerId || s.activePlayerId,
          group: "scheme",
          action: E("thwart", { amount: 3 }),
          title: "Spider-Tracer",
        }),
      );
    const room = s.player.inPlay.find(
      (p) => rulesCode(p) === "01063" && !p.exhausted,
    );
    if (room)
      add(
        s,
        E("optional", {
          mandatory: false,
          title: "Interrogation Room",
          text: "Exhaust Interrogation Room to remove 1 threat?",
          effects: [
            E("exhaust", { id: room.id }),
            E("target", {
              group: "scheme",
              action: E("thwart", { amount: 1, source: room.id }),
              title: "Interrogation Room",
            }),
          ],
        }),
      );
    if (rulesCode(m) === "01143")
      add(
        s,
        E("drone", {
          actorId: m.engagedWith || s.activePlayerId,
          mandatory: true,
        }),
      );
    if (rulesCode(m) === "01182") dealEncounter(s, m.engagedWith);
    const tigra = find(s, source);
    if (tigra && rulesCode(tigra) === "01051")
      tigra.damage = Math.max(0, tigra.damage - 1);
  }
  return true;
}
function advanceVillain(s: GameState) {
  const previousTitle = card(s.villain).name;
  const last = s.difficulty === "expert" ? 3 : 2;
  if (s.villain.stage === last) {
    endGame(
      s,
      true,
      `${card(s.villain).name} is defeated. The city is safe — for now.`,
    );
    return;
  }
  const config = VILLAINS.find((v) => v.id === s.villainId)!;
  s.villain.stage++;
  s.villain.code =
    riskyNextVillainFace(s, config.codes[s.villain.stage - 1]) ||
    config.codes[s.villain.stage - 1];
  s.villain.maxHp =
    card(s.villain).health! * s.playerCount +
    wasp.waspEnemyHP(s, s.villain) +
    (s.sideSchemes.some((p) => rulesCode(p) === "01127") ? 10 : 0);
  s.villain.hp = s.villain.maxHp;
  if (card(s.villain).name !== previousTitle) {
    for (const p of [...allInPlay(s), ...s.attachments].filter(
      (p) => p.attachedTo === s.villain.id,
    ))
      discardPiece(s, p.id);
    s.villain.stunned = s.villain.confused = s.villain.tough = false;
    s.villain.stunCards = s.villain.confuseCards = s.villain.toughCards = 0;
    s.villain.counters = 0;
  }
  syncStatuses(s.villain, card(s.villain));
  if (keyword(s.villain, "Toughness"))
    giveCharacterStatus(s, s.villain, "tough");
  log(s, `${config.name} advances to stage ${s.villain.stage}!`, "bad");
  villainSetup(s);
}
function villainSetup(s: GameState) {
  add(s, ...riskyVillainRevealed(s), ...mutagenVillainRevealed(s));
  if (rulesCode(s.villain) === "01095")
    add(s, E("searchEncounter", { code: "01107", reveal: true }));
  if (rulesCode(s.villain) === "01096")
    for (const seat of playerOrder(s))
      if (seatView(s, seat).player.form === "hero")
        giveCharacterStatus(
          s,
          seatView(s, seat).player,
          "stunned",
          heroCard(seatView(s, seat)),
        );
  if (rulesCode(s.villain) === "01114")
    add(s, E("searchEncounter", { code: "01127", reveal: true }));
  if (rulesCode(s.villain) === "01136")
    add(s, E("searchEncounter", { code: "01150", reveal: true }));
}
function threat(
  s: GameState,
  target: string,
  n: number,
  skipInterrupt = false,
) {
  if (n <= 0) return;
  if (!skipInterrupt) {
    const opts: Option[] = [];
    for (const seat of playerOrder(s)) {
      const v = seatView(s, seat),
        name = HEROES.find((h) => h.id === seat.heroId)!.name;
      if (
        v.heroId === "she_hulk" &&
        v.player.form === "alter" &&
        !v.flags.objection
      )
        opts.push(
          option(
            `object${s.playerCount > 1 ? `:${seat.id}` : ""}`,
            `${s.playerCount > 1 ? `${name} · ` : ""}I Object!`,
            [
              E("flag", { actorId: seat.id, key: "objection", value: true }),
              E("threat", {
                actorId: s.activePlayerId,
                target,
                amount: Math.max(0, n - 1),
                skip: true,
              }),
            ],
            "Prevent 1 threat.",
          ),
        );
      const gr = v.player.hand.find((p) => rulesCode(p) === "01061");
      if (gr && v.player.form === "hero")
        opts.push(
          option(
            `responsibility${s.playerCount > 1 ? `:${seat.id}` : ""}`,
            `${s.playerCount > 1 ? `${name} · ` : ""}Great Responsibility`,
            [
              E("resolveHandEvent", {
                actorId: seat.id,
                id: gr.id,
                after: [E("damage", { target: "hero", amount: n })],
              }),
            ],
            `Take ${n} damage instead.`,
          ),
        );
    }
    if (opts.length) {
      opts.push(
        option("allow", `Place ${n} threat`, [
          E("threat", { target, amount: n, skip: true }),
        ]),
      );
      choose(
        s,
        "Threat incoming",
        `${n} threat will be placed on ${target === "main" ? card(s.scheme.code).name : card(find(s, target)!).name}.`,
        opts,
      );
      return;
    }
  }
  if (target === "main") {
    s.scheme.threat += n;
    track(s, "threatPlaced", n);
    log(s, `+${n} threat on ${card(s.scheme.code).name}.`, "bad");
    if (s.scheme.threat >= schemeLimit(s)) {
      const mutagen = riskyMainCompleted(s) ?? mutagenMainCompleted(s);
      if (mutagen !== null) {
        if (!s.pendingMainCompletion) {
          s.pendingMainCompletion = true;
          add(s, ...mutagen, E("clearMainCompletion"));
        }
        return;
      }
      const v = VILLAINS.find((v) => v.id === s.villainId)!;
      if (s.scheme.index >= v.schemes.length - 1) {
        endGame(
          s,
          false,
          `${card(s.scheme.code).name} is complete. The villain's plan succeeds.`,
        );
        return;
      }
      discardMainAttachments(s);
      s.scheme.index++;
      s.scheme.code = v.schemes[s.scheme.index];
      s.scheme.threat =
        (card(s.scheme.code).base_threat || 0) *
        (card(s.scheme.code).base_threat_fixed ? 1 : s.playerCount);
      log(s, `The main scheme advances: ${card(s.scheme.code).name}.`, "bad");
      add(
        s,
        ...(s.villainId === "klaw"
          ? [E("findMinion", { actorId: s.firstPlayerId })]
          : eachPlayer(s, E("drone"))),
      );
    }
  } else {
    const p = s.sideSchemes.find((p) => p.id === target);
    if (p) {
      p.counters += n;
      track(s, "threatPlaced", n);
    }
  }
}
function thwart(
  s: GameState,
  target: string,
  n: number,
  ignoreCrisis = false,
  source = "hero",
) {
  if (n > 0 && !s.flags.additionalThwartPacket)
    n += msMarvelEventAmountModifier(s, s.currentEventId, "thwart");
  if (
    hulkThreatLocked(s, target) ||
    !gamora.gamoraCanRemoveThreat(s, target) ||
    venom.venomSchemeLocked(s, target) ||
    warlock.warlockSchemeLocked(s, target)
  )
    return 0;
  if (target === "main") {
    if (
      (!ignoreCrisis && s.sideSchemes.some((p) => card(p).scheme_crisis)) ||
      rulesCode(s.scheme) === "01139b"
    ) {
      log(s, "Threat cannot be removed from the main scheme.");
      return 0;
    }
    const removed = Math.min(n, s.scheme.threat);
    s.scheme.threat -= removed;
    track(s, "threatRemoved", removed);
    log(s, `Remove ${removed} threat from the main scheme.`, "good");
    return removed;
  } else {
    const p = s.sideSchemes.find((p) => p.id === target);
    if (!p) return 0;
    const removed = Math.min(n, p.counters);
    p.counters = Math.max(0, p.counters - n);
    track(s, "threatRemoved", removed);
    log(s, `Remove ${removed} threat from ${card(p).name}.`, "good");
    if (!p.counters) {
      add(
        s,
        ...(goblinModuleDefeated(s, p) || []),
        ...(mutagenDefeated(s, p) || []),
        ...captainPackSchemeDefeated(s, p),
        E("defeatScheme", { id: p.id, source }),
      );
    }
    return removed;
  }
}
function defeatScheme(s: GameState, p: Piece, source = "hero") {
  if (p.counters || !s.sideSchemes.some((x) => x.id === p.id)) return;
  log(s, `${card(p).name} is defeated.`, "good");
  if (rulesCode(p) === "01166" && p.captured)
    for (const x of p.captured) {
      const owner = s.players.find((a) => a.id === x.ownerId);
      if (owner && !owner.eliminated) seatView(s, owner).player.hand.push(x);
      else s.removed.push(x);
    }
  if (rulesCode(p) === "01127") {
    s.villain.maxHp -= 10;
    s.villain.hp -= 10;
  }
  doctorStrangeSchemeDefeated(s, p, dsPorts);
  add(s, ...hawkeyeSchemeDefeated(s, p), ...spiderWomanSchemeDefeated(s, p));
  add(
    s,
    ...wasp.waspDefeated(s, "side_scheme", source, s.currentEventId, false),
  );
  add(s, ...spectrum.spectrumSideSchemeDefeated(s, p, spectrumPorts));
  discardPiece(s, p.id);
  if (s.villain.hp <= 0) advanceVillain(s);
}
export function targets(
  s: GameState,
  group: string,
  attack = false,
  thwarting = true,
): { id: string; label: string; code?: string }[] {
  switch (group) {
    case "character":
      return [...targets(s, "friendly"), ...targets(s, "enemy")];
    case "enemy":
      return [
        ...(!attack || !engaged(s).some((p) => card(p).text?.includes("Guard."))
          ? [
              {
                id: s.villain.id,
                label: card(s.villain).name,
                code: s.villain.code,
              },
            ]
          : []),
        ...s.minions.map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        })),
      ];
    case "minion":
      return s.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      }));
    case "scheme":
      return [
        ...(!s.sideSchemes.some((p) => card(p).scheme_crisis) &&
        !(thwarting && engaged(s).some((p) => keyword(p, "Patrol"))) &&
        rulesCode(s.scheme) !== "01139b" &&
        s.scheme.threat > 0
          ? [
              {
                id: "main",
                label: card(s.scheme.code).name,
                code: s.scheme.code,
              },
            ]
          : []),
        ...s.sideSchemes
          .filter(
            (p) =>
              p.counters > 0 &&
              !hulkThreatLocked(s, p.id) &&
              gamora.gamoraCanRemoveThreat(s, p.id) &&
              !venom.venomSchemeLocked(s, p.id) &&
              !warlock.warlockSchemeLocked(s, p.id),
          )
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
      ];
    case "ally":
      return allInPlay(s)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        }));
    case "controlled":
      return [
        { id: "hero", label: heroCard(s).name, code: heroCard(s).code },
        ...friends(s).map((p) => ({
          id: p.id,
          label: card(p).name,
          code: p.code,
        })),
      ];
    case "friendly":
      return [
        ...playerOrder(s).map((p) => ({
          id: p.id === s.activePlayerId ? "hero" : `hero:${p.id}`,
          label: heroCard(seatView(s, p)).name,
          code: heroCard(seatView(s, p)).code,
        })),
        ...targets(s, "ally"),
      ];
    default:
      return [];
  }
}
function scriptContext(
  s: GameState,
  source: Piece,
  paid?: Resource[],
): ScriptContext {
  const hero = HEROES.find((h) => h.id === s.heroId)!;
  return {
    state: s,
    source,
    paid,
    identityNames: [card(hero.code).name, card(hero.alter).name],
    targets: (selector: ScriptSelector, intent) =>
      targets(
        s,
        selector === "controlled-ally" ? "ally" : selector,
        !!intent?.attack,
        !!intent?.thwart,
      ).filter(
        (entry) =>
          selector !== "controlled-ally" ||
          s.player.inPlay.some((p) => p.id === entry.id),
      ),
    canAffect: (node, id) => {
      const target =
        id === "hero"
          ? s.player
          : id?.startsWith("hero:")
            ? seatView(s, id.slice(5)).player
            : find(s, id || "");
      if (node.op === "draw")
        return s.player.deck.length + s.player.discard.length > 0;
      if (node.op === "ready")
        return (
          !!target?.exhausted &&
          (!id?.startsWith("hero") ||
            canReadyIdentity(id === "hero" ? s : seatView(s, id.slice(5))))
        );
      if (node.op === "heal")
        return id?.startsWith("hero")
          ? !!target &&
              (target as GameState["player"]).hp <
                maxHP(id === "hero" ? s : seatView(s, id.slice(5)))
          : !!target && (target as Piece).damage > 0;
      if (node.op === "thwart")
        return id === "main"
          ? s.scheme.threat > 0
          : !!target && (target as Piece).counters > 0;
      if (node.op === "status") {
        if (!target) return false;
        const definition = id?.startsWith("hero")
          ? heroCard(id === "hero" ? s : seatView(s, id.slice(5)))
          : card(target as Piece);
        return giveStatus({ ...target }, definition, node.status);
      }
      return true;
    },
  };
}
export function cardCost(s: GameState, c: Card, physical?: Piece) {
  if (s.flags.scwIgnoreResourceCost) return 0;
  return Math.max(
    0,
    (c.cost || 0) * (c.cost_per_hero ? s.playerCount : 1) -
      Number(s.flags.discount || 0) -
      captainAllyDiscount(s, c) -
      captainPackDiscount(s, c) -
      msMarvelDiscount(s) -
      drax.draxCardCostReduction(s, physical || c) -
      venomPack.venomPackCardCostReduction(s, c) -
      mtsPlayerPack.mtsPlayerPackCardCostReduction(
        s,
        physical || c,
        mtsPlayerPackPorts,
      ) -
      (physical ? starLord.starLordCardCostReduction(s, physical) : 0) -
      gmwPack.gmwPlayerPackCardCostReduction(s, c) -
      thorAllyDiscount(s, c) -
      blackWidowAllyDiscount(s, c) +
      doctorStrangeCostModifier(s, c) +
      scarletWitch.scarletWitchCardCostBonus(s),
  );
}
function captainPackHasTrait(
  s: GameState,
  target: string,
  trait: string,
): boolean {
  if (captainPrintedHasTrait(s, target, trait)) return true;
  const identityId =
    target === "hero"
      ? s.activePlayerId
      : target.startsWith("hero:")
        ? target.slice(5)
        : undefined;
  if (identityId) {
    const view = seatView(s, identityId);
    return (
      (trait.toLowerCase() === "aerial" && aerial(view)) ||
      starLord
        .starLordHeroTraits(view)
        .some((t) => t.toLowerCase() === trait.toLowerCase())
    );
  }
  const p = allInPlay(s).find((p) => p.id === target);
  const seat = p && controller(s, p.id);
  return (
    !!p &&
    !!seat &&
    starLord
      .starLordAllyTraits(seatView(s, seat), p)
      .some((t) => t.toLowerCase() === trait.toLowerCase())
  );
}
function targetPrompt(s: GameState, e: Effect) {
  const source = e.action.source || e.action.id || "hero";
  const character = source === "hero" ? s.player : find(s, source);
  if (
    (e.action.attack && character?.stunned) ||
    ((e.action.action ||
      (e.action.type === "allyAction" && e.action.kind === "thwart")) &&
      character?.confused)
  ) {
    add(s, { ...e.action, target: "" });
    return;
  }
  const list = targets(s, e.group, !!e.action.attack, !!e.action.action).filter(
    (t) =>
      (!e.exclude || t.id !== e.exclude) &&
      (!e.scriptSelector?.controller ||
        s.player.inPlay.some((p) => p.id === t.id)) &&
      (e.action.type !== "allyAction" ||
        e.action.kind !== "attack" ||
        !character ||
        gamoraPack.gamoraPackAllyCanAttack(s, character as Piece, t.id)),
  );
  if (list.length === 1) {
    add(s, { ...e.action, target: list[0].id });
    return;
  }
  choose(
    s,
    e.title || "Choose a target",
    e.text || "Select the target for this effect.",
    list.map((t) =>
      option(t.id, t.label, [{ ...e.action, target: t.id }], undefined, t.code),
    ),
  );
}
function attackAction(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  overkill = false,
  panther = false,
  traits: {
    basic?: boolean;
    piercing?: boolean;
    ranged?: boolean;
    initiated?: boolean;
    excessToMain?: boolean;
    excessBonus?: number;
    aftermathChooser?: string;
  } = {},
) {
  const p = source === "hero" ? s.player : find(s, source);
  if (!p) return;
  if (p.stunned && !traits.initiated) {
    consumeStatus(p, "stunned");
    if (source === "hero") s.flags.basicAttack = false;
    log(s, "Stunned is removed instead of attacking.");
    return;
  }
  if (
    !traits.initiated &&
    !targets(s, "enemy", true).some((t) => t.id === target)
  ) {
    log(s, "The attack has no eligible target.");
    return;
  }
  const attacker = combatCharacter(s, source);
  const defender = combatCharacter(s, target);
  const previousEffects = new Set(s.queue);
  const result = dealDamage(
    s,
    target,
    n,
    source,
    true,
    overkill || !!sourceKeyword(s, source, "Overkill"),
    panther,
    traits,
  );
  if (source === "hero" && traits.basic)
    for (const e of s.queue)
      if (!previousEffects.has(e) && e.type === "heroAttackResponses")
        e.draxBasicAttack = true;
  recordCombat(s, attacker, defender, target, false);
  if (source === "hero") {
    const strengths = s.player.inPlay.filter((p) => rulesCode(p) === "01028");
    for (const st of strengths) {
      const enemy = find(s, target);
      if (enemy && !enemy.stunned) {
        giveCharacterStatus(s, enemy, "stunned");
        discardPiece(s, st.id);
      }
    }
  }
  return result;
}
function thwartAction(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  initiated = false,
  ignoreCrisis = false,
  statusChecked = false,
) {
  const p = source === "hero" ? s.player : find(s, source);
  if (!p) return;
  if (!initiated && source === "hero" && captainThwartBlocked(s)) {
    log(s, "Baron Zemo prevents this identity from thwarting.");
    return;
  }
  if (p.confused && !statusChecked) {
    consumeStatus(p, "confused");
    log(s, "Confused is removed instead of thwarting.");
    return;
  }
  if (
    !(
      ignoreCrisis
        ? hawkeyePorts.schemeTargets(s, true)
        : targets(s, "scheme", false, true)
    ).some((entry) => entry.id === target)
  )
    return;
  const beforeThreat =
    target === "main"
      ? s.scheme.threat
      : s.sideSchemes.find((piece) => piece.id === target)?.counters || 0;
  const wasHero = source === "hero" && s.player.form === "hero";
  const previousQueue = new Set(s.queue);
  const removed = thwart(s, target, n, ignoreCrisis, source);
  if (!wasHero || removed <= 0 || removed !== beforeThreat) return removed;

  const responseGroup = s.currentEventId
    ? `eventThwart:${s.currentEventId}`
    : s.currentResponseGroup || `thwart${s.nextId++}`;
  const generated = s.queue
    .filter((effect) => !previousQueue.has(effect))
    .map((effect) => ({
      ...effect,
      responseGroup,
      mandatory: effect.mandatory ?? true,
    }));
  const continuation = s.queue.filter((effect) => previousQueue.has(effect));
  const response = effectContext(
    s,
    E("scarletHeroThwartResponse", {
      snapshot: {
        scheme: target,
        beforeThreat,
        removed,
        playerId: s.activePlayerId,
        wasHero,
      },
      responseGroup,
      mandatory: false,
    }),
  );
  const finish = s.currentEventId
    ? continuation.findIndex(
        (effect) =>
          effect.type === "finishResolution" && effect.id === s.currentEventId,
      )
    : -1;
  // Finish every printed clause of the triggering event before its optional
  // response. Scheme defeats remain immediate; their nested mandatory effects
  // share this group and also finish before Turn the Tide can be chosen.
  if (finish >= 0) continuation.splice(finish, 0, response);
  else continuation.unshift(response);
  s.queue = [...generated, ...continuation];
  return removed;
}
/** Whether the hero's hand and resource abilities can meet a cost right now. */
export function canPay(
  s: GameState,
  cost: number,
  requirements: Resource[] = [],
  excludeId?: string,
  targetCode?: string,
  allowStarLordHandCost = true,
) {
  const handCard = excludeId
    ? s.player.hand.find((p) => p.id === excludeId)
    : undefined;
  // Reaction option builders ask about the actual hand event before its play
  // interrupt opens. Ability costs have no excluded physical hand event.
  if (
    allowStarLordHandCost &&
    handCard &&
    card(handCard).type_code === "event" &&
    (!targetCode || targetCode === handCard.code) &&
    cost === cardCost(s, card(handCard), handCard) &&
    starLord.starLordCanReduceHandCost(s, handCard, cost)
  )
    cost = Math.max(0, cost - 3);
  if (cost === 0 && !requirements.length) return true;
  const sources = paymentSources(s, excludeId, targetCode);
  return paymentStatus(
    sources,
    sources.map((p) => p.id),
    cost,
    requirements,
  ).ready;
}
function requestPayment(
  s: GameState,
  title: string,
  cost: number,
  after: Effect[],
  requirements: Resource[] = [],
  piece?: Piece,
  cancelable = false,
  targetCode?: string,
  forcePayment = false,
  paymentCommit: Effect[] = [],
  starLordCostHandled = false,
  starLordApplyDiscount = false,
  handOnly = false,
  abilityCost = false,
) {
  if (
    !abilityCost &&
    !starLordCostHandled &&
    piece &&
    after.some(
      (e) =>
        (e.type === "resolveHandEvent" && e.id === piece.id) ||
        (e.type === "play" && e.piece?.id === piece.id),
    )
  ) {
    const resume = [
      E("payRequest", {
        title,
        cost,
        requirements,
        piece,
        cancelable,
        targetCode,
        forcePayment,
        commit: paymentCommit,
        after,
        starLordCostHandled: true,
        starLordApplyDiscount: true,
        handOnly,
        abilityCost,
      }),
    ];
    const interrupts = starLord.starLordHandPlayOptions(
      s,
      piece,
      resume,
      starLordPorts,
    );
    if (interrupts.length) {
      const ordinary = canPay(
        s,
        cost,
        requirements,
        piece.id,
        targetCode || piece.code,
        false,
      );
      choose(
        s,
        '"What could go wrong?"',
        `Interrupt the play of ${card(piece).name} before paying its resource cost?`,
        [
          ...interrupts,
          ...(ordinary
            ? [option("continue", "Pay the ordinary cost", resume)]
            : []),
        ],
        cancelable,
      );
      if (cancelable && s.attack) s.prompt!.cancellationQueue = [...s.queue];
      return;
    }
  }
  if (!abilityCost && starLordApplyDiscount && piece)
    cost = Math.max(0, cost - starLord.starLordCardCostReduction(s, piece));
  if (cost === 0 && !requirements.length && !forcePayment) {
    const zeroAfter = after.map((e) => ({
      ...e,
      paid: [],
      ...(["20002", "20003", "20006"].includes(piece?.code || "")
        ? { paidForCard: [] }
        : {}),
    }));
    const spentResponseCards = s.player.hand.filter((p) => p.id !== piece?.id);
    if (
      mtsPlayerPack.mtsPlayerPackResourcesSpent(
        s,
        spentResponseCards,
        mtsPlayerPackPorts,
      ).length
    ) {
      choose(
        s,
        title,
        "This costs 0 resources. You may spend extra resources to use their printed responses.",
        [
          option("continue", "Pay 0 resources", zeroAfter),
          option("spend", "Choose resources to spend", [
            E("payRequest", {
              title,
              cost,
              requirements,
              piece,
              cancelable,
              targetCode,
              forcePayment: true,
              commit: paymentCommit,
              after,
              starLordCostHandled,
              starLordApplyDiscount,
              handOnly,
              abilityCost,
            }),
          ]),
        ],
        cancelable,
      );
      if (cancelable && s.attack) s.prompt!.cancellationQueue = [...s.queue];
    } else add(s, ...zeroAfter);
    return;
  }
  // A cost that cannot be paid must not open a dialog with no way out.
  const availableSources = paymentSources(
    s,
    piece?.id,
    targetCode || piece?.code,
    handOnly,
  );
  if (
    !paymentStatus(
      availableSources,
      availableSources.map((source) => source.id),
      cost,
      requirements,
    ).ready
  ) {
    log(s, `${title}: not enough resources to pay the cost.`);
    return;
  }
  s.prompt = {
    kind: "payment",
    title,
    text: "Choose cards to spend as resources. Cards spent from your hand are discarded.",
    options: [],
    cost,
    requirements,
    card: piece,
    cancellationQueue: cancelable && s.attack ? [...s.queue] : undefined,
    after: after.map((e) => effectContext(s, e)),
    paymentCommit: paymentCommit.map((e) => effectContext(s, e)),
    cancelable,
    paymentTarget: targetCode || piece?.code,
    ...(handOnly ? { handOnly: true } : {}),
    ...(abilityCost ? { abilityCost: true } : {}),
    wildAs: requirements[0] || "energy",
  };
}
function pay(
  s: GameState,
  ids: string[],
  wildAs: Resource = "energy",
  actualAllocation?: Resource[],
) {
  const p = s.prompt!;
  need(p?.kind === "payment", "No payment is pending.");
  need(new Set(ids).size === ids.length, "Choose each resource source once.");
  const sources = paymentSources(s, p.card?.id, p.paymentTarget, p.handOnly);
  const selected = ids.map((id) => sources.find((x) => x.id === id));
  need(selected.every(Boolean), "A selected resource is unavailable.");
  const { printed, missing } = paymentStatus(
    sources,
    ids,
    p.cost || 0,
    p.requirements,
  );
  need(printed.length >= (p.cost || 0), "Not enough resources.");
  need(!missing.length, `You need a ${missing[0]} resource.`);
  const req = [...(p.requirements || [])];
  need(
    !p.card || hulkPaymentAllowed(p.card, printed, wildAs),
    "Crushing Blow can only be paid with physical resources.",
  );
  let paidForCard: Resource[] | undefined;
  if (["20002", "20003", "20006"].includes(p.card?.code || "")) {
    const allocations = paidResourceAllocations(
      printed,
      p.cost || 0,
      req,
      wildAs,
    );
    need(
      allocations.length,
      "The selected resources cannot cover the actual typed cost.",
    );
    if (actualAllocation) {
      const canonical = (resources: Resource[]) =>
        [...resources].sort().join(":");
      need(
        allocations.some(
          (paid) => canonical(paid) === canonical(actualAllocation),
        ),
        "The selected allocation cannot pay this cost.",
      );
      paidForCard = actualAllocation;
    } else if (allocations.length > 1) {
      choose(
        s,
        "Allocate payment resources",
        "Choose the resources paid for the card's cost. Other generated resources are overpaid.",
        allocations.map((allocated) => {
          const pure =
            allocated.length &&
            allocated.every((resource) => resource === allocated[0]);
          const label = [...new Set(allocated)]
            .map(
              (resource) =>
                `${allocated.filter((r) => r === resource).length} ${resource}`,
            )
            .join(" + ");
          return option(pure ? allocated[0] : allocated.join("+"), label, [
            E("commitPaymentAllocation", {
              payment: p,
              ids,
              wildAs,
              paidForCard: allocated,
            }),
          ]);
        }),
        true,
      );
      s.prompt!.cancellationQueue = [
        E("restorePaymentPrompt", {
          actorId: s.activePlayerId,
          payment: p,
          queue: [...s.queue],
        }),
      ];
      return;
    } else paidForCard = allocations[0];
  }
  const spentResponses: Effect[] = [];
  for (const id of ids) {
    if (id === "scientist") s.flags.scientist = true;
    else if (id === "symbiotic-bond") {
      need(
        venom.venomResourceSpent(s, id, venomPorts),
        "Symbiotic Bond is unavailable.",
      );
    } else if (s.player.hand.some((x) => x.id === id)) {
      const spent = discardHand(s, id);
      spentResponses.push(...antMan.antManResourceSpent(s, spent, antManPorts));
      spentResponses.push(...wasp.waspResourceSpent(s, spent, waspPorts));
      spentResponses.push(...rocket.rocketResourceSpent(s, spent));
      spentResponses.push(
        ...mtsPlayerPack.mtsPlayerPackResourcesSpent(
          s,
          [spent],
          mtsPlayerPackPorts,
        ),
      );
    } else {
      const source = find(s, id)!;
      const msSpent = msMarvelResourceSpent(s, source);
      const dsSpent = doctorStrangeResourceSpent(s, source);
      spiderWomanResourceSpent(s, source, p.paymentTarget);
      gamoraPack.gamoraPackResourceSpent(s, source.id, { discardPiece });
      starLordPack.starLordPackResourceSpent(s, source.id, { discardPiece });
      draxPack.draxPackResourceSpent(s, source.id, { discardPiece });
      venomPack.venomPackResourceSpent(s, source.id, { discardPiece });
      spectrumResourceSpent(s, source.id, { isTextBlank });
      warlockResourceSpent(s, source.id, { isTextBlank });
      source.exhausted = true;
      for (const effect of [
        ...(msSpent || []),
        ...thorResourceSpent(s, source),
        ...(dsSpent || []),
        ...(blackWidowResourceSpent(s, source, p.paymentTarget) || []),
        ...captainPackResourceSpent(s, source),
        ...hulkPackResourceSpent(s, source, p.paymentTarget),
      ])
        if (effect.type === "discardPiece") discardPiece(s, effect.id);
      if (rulesCode(source) === "01008") {
        source.counters--;
        if (!source.counters) discardPiece(s, id);
      }
    }
  }
  // The resource cards are spent together. An empty player deck can reset
  // once the entire committed payment has reached discard, rather than
  // recycling between individual resources and splitting the same cost.
  const beforeReset = new Set(s.queue);
  recyclePlayer(s);
  const resetResponses = s.queue.filter((effect) => !beforeReset.has(effect));
  s.queue = s.queue.filter((effect) => beforeReset.has(effect));
  spentResponses.push(...resetResponses);
  const paid = [...printed];
  const allocated = new Set<number>();
  for (const required of req) {
    let index = printed.findIndex(
      (r, i) => !allocated.has(i) && r === required,
    );
    if (index < 0)
      index = printed.findIndex((r, i) => !allocated.has(i) && r === "wild");
    allocated.add(index);
    paid[index] = required;
  }
  for (let i = 0; i < paid.length; i++)
    if (paid[i] === "wild") paid[i] = wildAs;
  s.prompt = null;
  log(
    s,
    `Paid ${printed.length} resource${printed.length === 1 ? "" : "s"} for ${p.title}: ${selected.map((x) => x!.name).join(", ")}.`,
  );
  for (const commit of p.paymentCommit || []) resolve(s, commit);
  add(
    s,
    ...spentResponses,
    ...(p.after || []).map((e) => ({
      ...e,
      paid,
      ...(paidForCard !== undefined ? { paidForCard } : {}),
      overpaid: Math.max(0, printed.length - (p.cost || 0)),
    })),
  );
}
export function newGame(config: {
  heroId: string;
  aspect: Aspect;
  villainId: string;
  difficulty?: "standard" | "expert";
  module?: string;
  seed?: number;
  heroes?: {
    heroId: string;
    aspect: Aspect;
    deckCards?: string[];
    deckAspects?: Aspect[];
  }[];
  guided?: boolean;
  pacing?: Pacing;
  heroic?: number;
}): GameState {
  const team = config.heroes || [
    { heroId: config.heroId, aspect: config.aspect },
  ];
  need(team.length >= 1 && team.length <= 3, "Choose one to three heroes.");
  need(
    new Set(team.map((p) => p.heroId)).size === team.length,
    "Each hero may only join the team once.",
  );
  need(
    team.every((p) => HEROES.some((h) => h.id === p.heroId)),
    "Unknown hero.",
  );
  need(
    team.every((p) => ASPECTS.some((a) => a.id === p.aspect)),
    "Choose a valid aspect for every hero.",
  );
  need(
    config.difficulty === undefined ||
      ["standard", "expert"].includes(config.difficulty),
    "Choose Standard or Expert difficulty.",
  );
  need(
    [0, 1, 2, 3].includes(config.heroic ?? 0),
    "Heroic mode adds 0 to 3 encounter cards per player.",
  );
  for (const seat of team) {
    if (seat.deckCards) {
      const errors = deckErrors(
        seat.heroId,
        seat.aspect,
        seat.deckCards,
        seat.deckAspects,
      );
      need(!errors.length, errors[0]);
    }
  }
  const foundScenario = VILLAINS.find((v) => v.id === config.villainId);
  need(
    foundScenario,
    "This scenario’s complete rules are not implemented yet.",
  );
  const v = foundScenario!;
  need(
    MODULES.some((m) => m.id === (config.module || v.module)),
    "This modular set’s complete rules are not implemented yet.",
  );
  const scenarioPack = card(v.codes[0]).pack_code;
  const difficulty = config.difficulty || "standard",
    stage = difficulty === "expert" ? 2 : 1;
  const players = team.map((h, i) => ({
    id: `p${i + 1}`,
    ...h,
    ended: false,
    eliminated: false,
    mulliganDone: false,
    flags: {},
    player: {
      form: "alter" as const,
      hp: card(HEROES.find((x) => x.id === h.heroId)!.code).health!,
      exhausted: false,
      flipped: false,
      stunned: false,
      confused: false,
      tough: false,
      hand: [] as Piece[],
      deck: [] as Piece[],
      discard: [] as Piece[],
      inPlay: [] as Piece[],
    },
  }));
  const hp = card(v.codes[stage - 1]).health! * team.length;
  const s: GameState = {
    version: 1,
    seed: config.seed || Date.now() >>> 0 || 1,
    startSeed: 0,
    nextId: 1,
    heroId: team[0].heroId,
    aspect: team[0].aspect,
    villainId: v.id,
    difficulty,
    module: config.module || v.module,
    phase: "mulligan",
    round: 1,
    players,
    activePlayerId: "p1",
    firstPlayerId: "p1",
    turnPlayerId: "p1",
    playerCount: team.length,
    guided: config.guided ?? false,
    pacing: config.pacing || "guided",
    timeline: [],
    heroic: config.heroic || 0,
    hiddenInfo: 0,
    stats: emptyStats(),
    review: null,
    reviewCount: 0,
    player: players[0].player,
    villain: {
      id: "villain",
      code: v.codes[stage - 1],
      hp,
      maxHp: hp,
      stage,
      exhausted: false,
      damage: 0,
      counters: 0,
      tough: keyword(v.codes[stage - 1], "Toughness"),
      stunned: false,
      confused: false,
    },
    scheme: { code: v.schemes[0], threat: 0, index: 0 },
    minions: [],
    sideSchemes: [],
    attachments: [],
    environments: [],
    encounter: { deck: [], discard: [], dealt: [], acceleration: 0 },
    removed: [],
    resolving: [],
    prompt: null,
    queue: [],
    log: [],
    flags: players[0].flags,
    attack: null,
  };
  s.startSeed = s.seed;
  for (const seat of players) {
    activateSeat(s, seat.id);
    s.player.deck = shuffle(
      s,
      (seat.deckCards || deckCodes(seat.heroId, seat.aspect)).map((c) =>
        makePiece(s, c),
      ),
    );
    doctorStrangeSetup(s, dsPorts);
    venom.venomInitializeNemesis(s, { makePiece });
    warlock.warlockInitializeNemesis(s, { makePiece });
    // Extract the SAME three source-composition IDs before drawing an opening
    // hand. The ordinary40-card deck never contains the setup upgrades.
    for (const effect of spectrum.spectrumSetup(s))
      spectrum.resolveSpectrumEffect(s, effect, spectrumPorts);
  }
  activateSeat(s, "p1");
  s.encounter.deck = shuffle(
    s,
    CATALOG_CARDS.filter(
      (c) =>
        c.faction_code === "encounter" &&
        ((((c.set_code === s.module &&
          c.pack_code ===
            ([
              "goblin_gimmicks",
              "a_mess_of_things",
              "power_drain",
              "running_interference",
            ].includes(s.module)
              ? "gob"
              : "core")) ||
          (c.set_code === v.id && c.pack_code === scenarioPack) ||
          (c.set_code === "standard" && c.pack_code === "core") ||
          (difficulty === "expert" &&
            c.set_code === "expert" &&
            c.pack_code === "core")) &&
          !["villain", "main_scheme", "environment"].includes(c.type_code)) ||
          (team.some(
            (h) =>
              h.heroId === c.set_code &&
              c.pack_code ===
                card(HEROES.find((profile) => profile.id === h.heroId)!.code)
                  .pack_code,
          ) &&
            c.type_code === "obligation")),
    ).flatMap((c) =>
      Array.from({ length: c.quantity }, () => makePiece(s, c.code)),
    ),
  );
  if (v.id === "mutagen_formula") {
    add(s, ...mutagenSetup(), E("openingHands", { actorId: s.firstPlayerId }));
    run(s);
  } else if (v.id === "risky_business") {
    add(s, ...riskySetup(), E("openingHands", { actorId: s.firstPlayerId }));
    run(s);
  } else openingHands(s);
  log(
    s,
    `${team.length} hero${team.length > 1 ? "es" : ""} vs. ${v.name} · ${difficulty}. Confirm each opening hand.`,
    "phase",
  );
  syncSeat(s);
  return s;
}
function openingHands(s: GameState) {
  for (const seat of s.players) {
    activateSeat(s, seat.id);
    draw(s, handSize(s));
  }
  activateSeat(s, s.firstPlayerId);
}
function initialSetup(s: GameState) {
  activateSeat(s, s.firstPlayerId);
  s.phase = "player";
  log(s, "Round 1 · Hero phase", "phase");
  const setup: Effect[] = [];
  for (const seat of playerOrder(s))
    setup.push(
      ...captainSetup(seatView(s, seat)).map((e) => ({
        ...e,
        actorId: seat.id,
      })),
      ...starLord.starLordSetup(seatView(s, seat)).map((e) => ({
        ...e,
        actorId: seat.id,
      })),
      ...venom.venomSetup(seatView(s, seat)).map((e) => ({
        ...e,
        actorId: seat.id,
      })),
    );
  for (const seat of playerOrder(s))
    if (seat.heroId === "black_panther")
      setup.push(
        E("searchDeck", {
          actorId: seat.id,
          trait: "Black Panther.",
          title: "Foresight",
        }),
      );
  if (s.villainId === "klaw")
    setup.push(
      E("searchEncounter", {
        code: "01125",
        reveal: true,
        actorId: s.firstPlayerId,
      }),
      E("findMinion", { actorId: s.firstPlayerId }),
    );
  if (s.villainId === "ultron") setup.push(...eachPlayer(s, E("drone")));
  // Queue stage setup after scenario setup and before the first turn.
  add(
    s,
    ...setup,
    E("stageSetup"),
    E("beginTurn", { actorId: s.firstPlayerId }),
  );
}
const reactionCards = [
  "01003",
  "01004",
  "01061",
  "01077",
  "01078",
  "01085",
  "09007",
  "09015",
  "09021",
  "09037",
  "09038",
];
export function playable(s: GameState, p: Piece): string | null {
  const c = card(p);
  if (goblinIdentityLocked(s) && ["01024", "01025"].includes(rulesCode(p)))
    return "All Tied Up prevents this identity from readying or changing form.";
  if (s.phase !== "player" || s.prompt || s.review)
    return "Finish the current decision first.";
  if (
    s.activePlayerId !== s.turnPlayerId &&
    !(c.type_code === "event" && c.text?.includes("Action"))
  )
    return "Only Action events can be played during a teammate’s turn.";
  if (c.type_code === "resource")
    return "Spend this card to pay for another card.";
  if (
    c.type_code === "event" &&
    /<b>(?:Hero )?Action\s*\(thwart\)/i.test(c.text || "") &&
    captainThwartBlocked(s)
  )
    return "Baron Zemo prevents this identity from thwarting.";
  if (
    p.code === "06006" &&
    !thorLightningPaymentOptions(s, p, cardCost(s, c), thorPorts).length
  )
    return "Lightning Strike requires its card cost and at least one energy.";
  const dsRestriction = doctorStrangePlayRestriction(s, p, dsPorts);
  if (dsRestriction) return dsRestriction;
  const bwRestriction = blackWidowPlayRestriction(s, p, bwPorts);
  if (bwRestriction) return bwRestriction;
  const thorRestriction = thorPlayRestriction(s, p, thorPorts);
  if (thorRestriction) return thorRestriction;
  const msRestriction = msMarvelPlayRestriction(s, p);
  if (msRestriction) return msRestriction;
  const antRestriction =
    antMan.antManPlayRestriction(
      s,
      p.code === "13020" ? { ...p, code: "12020" } : p,
      antManPorts,
    ) ||
    antPack.antManPackPlayRestriction(s, p, antPackPorts) ||
    wasp.waspPlayRestriction(s, p, waspPorts) ||
    waspPack.waspPackPlayRestriction(s, p, waspPackPorts) ||
    quicksilver.quicksilverPlayRestriction(s, p, quicksilverPorts) ||
    quicksilverPack.quicksilverPackPlayRestriction(
      s,
      p,
      quicksilverPackPorts,
    ) ||
    scarletWitch.scarletWitchPlayRestriction(s, p, scarletPorts) ||
    scarletPack.scarletWitchPackPlayRestriction(s, p, scarletPackPorts) ||
    rocket.rocketPlayRestriction(s, p) ||
    groot.grootPlayRestriction(s, p, grootPorts) ||
    gmwPack.gmwPlayerPackPlayRestriction(s, p, gmwPorts) ||
    starLord.starLordPlayRestriction(s, p) ||
    gamora.gamoraPlayRestriction(s, p, gamoraPorts) ||
    drax.draxPlayRestriction(s, p, draxPorts) ||
    venom.venomPlayRestriction(s, p) ||
    warlock.warlockPlayRestriction(s, p) ||
    spectrum.spectrumPlayRestriction(s, p) ||
    starLordPack.starLordPackPlayRestriction(s, p, starLordPackPorts) ||
    gamoraPack.gamoraPackPlayRestriction(s, p, gamoraPackPorts) ||
    draxPack.draxPackPlayRestriction(s, p, draxPackPorts) ||
    venomPack.venomPackPlayRestriction(s, p, venomPackPorts) ||
    mtsPlayerPack.mtsPlayerPackPlayRestriction(s, p, mtsPlayerPackPorts);
  if (antRestriction) return antRestriction;
  const hawkeyeRestriction = hawkeyePlayRestriction(s, p, hawkeyePorts);
  if (hawkeyeRestriction) return hawkeyeRestriction;
  const spiderWomanRestriction = spiderWomanPlayRestriction(s, p, swPorts);
  if (spiderWomanRestriction) return spiderWomanRestriction;
  const captainRestriction = captainPlayRestriction(s, p);
  if (captainRestriction) return captainRestriction;
  const hulkRestriction = hulkPlayRestriction(s, p);
  if (hulkRestriction) return hulkRestriction;
  const hulkPackRestriction = hulkPackPlayRestriction(s, p);
  if (hulkPackRestriction) return hulkPackRestriction;
  const packRestriction = captainPackPlayRestriction(s, p);
  if (packRestriction) return packRestriction;
  const script = cardScript(p);
  if (
    !hasExecutableScript(p) &&
    !(CAPTAIN_AMERICA_SCRIPT_CODES as readonly string[]).includes(p.code)
  )
    return "This card’s full rules are not implemented yet.";
  if (
    script?.implementation === "script" &&
    script.trigger === "event-action"
  ) {
    if (script.action === "thwart" && captainThwartBlocked(s))
      return "Baron Zemo prevents this identity from thwarting.";
    const reason = checkScriptLegality(script, scriptContext(s, p));
    if (reason) return reason;
  }
  if (reactionCards.includes(rulesCode(p)))
    return "Available automatically during its reaction window.";
  if (
    ((c.type_code === "event" && c.text?.includes("<b>Hero Action")) ||
      c.text?.includes("Hero form only")) &&
    s.player.form !== "hero"
  )
    return "Change to hero form first.";
  if (
    c.type_code === "event" &&
    c.text?.includes("<b>Alter-Ego Action") &&
    s.player.form !== "alter"
  )
    return "Change to alter-ego form first.";
  if (uniqueConflict(s, c)) return "This unique card is already in play.";
  if (
    !["10018", "10031"].includes(p.code) &&
    c.text?.includes("Max 1 per player") &&
    (c.text?.includes("any player")
      ? playerOrder(s).every((p) => has(seatView(s, p), c.code))
      : has(s, c.code))
  )
    return "You already control one.";
  if (rulesCode(p) === "01024" && !s.flags.basicAttack)
    return "Play immediately after your basic attack.";
  if (rulesCode(p) === "01023" && s.player.hand.length < 2)
    return "Legal Practice requires at least one other card to discard.";
  if (rulesCode(p) === "01052" && !s.flags.heroKill)
    return "Play after your hero attacks and defeats an enemy.";
  if (rulesCode(p) === "01007" && !s.minions.length)
    return "A minion must be in play.";
  if (
    ["01069", "01074"].includes(rulesCode(p)) &&
    !allInPlay(s).some((p) => card(p).type_code === "ally")
  )
    return "You need an ally in play.";
  if (rulesCode(p) === "01053" && !s.minions.length && !s.player.stunned)
    return "There is no minion to attack.";
  if (
    rulesCode(p).startsWith("01043") &&
    !s.player.inPlay.some((p) => card(p).traits?.includes("Black Panther."))
  )
    return "Play a Black Panther upgrade first.";
  if (
    rulesCode(p) === "01071" &&
    !s.players
      .flatMap((p) => seatView(s, p).player.discard)
      .some(
        (x) =>
          card(x).type_code === "ally" &&
          !allInPlay(s).some((p) => card(p).name === card(x).name) &&
          paymentSources(s, p.id, x.code).reduce(
            (n, p) => n + p.resources.length,
            0,
          ) >= card(x).cost!,
      )
  )
    return "No affordable ally in your discard pile.";
  const available = paymentSources(s, p.id, p.code).reduce(
    (n, p) => n + p.resources.length,
    0,
  );
  if (
    available <
    cardCost(s, c, p) +
      doctorStrangeAdditionalPlayCost(s, p) -
      maximumAllyUpgradeDiscount(s, p) -
      (starLord.starLordCanReduceHandCost(s, p, cardCost(s, c, p)) ? 3 : 0)
  )
    return "Not enough resources in your hand or play area.";
  if (
    p.code === "10002" &&
    !canPay(
      s,
      cardCost(s, c),
      Array(cardCost(s, c)).fill("physical"),
      p.id,
      p.code,
    )
  )
    return "Crushing Blow can only be paid with physical resources.";
  return null;
}
function requestPlay(s: GameState, p: Piece, discountHandled = false) {
  const after = [E("playRequest", { piece: p, discountHandled: true })];
  const discounts = !discountHandled
    ? starLord.starLordHandPlayOptions(s, p, after, starLordPorts)
    : [];
  if (discounts.length) {
    const cost =
      cardCost(s, card(p), p) + doctorStrangeAdditionalPlayCost(s, p);
    const requirements: Resource[] =
      p.code === "10002"
        ? Array(cost).fill("physical")
        : p.code === "15012" &&
            !s.player.confused &&
            s.sideSchemes.some((scheme) => card(scheme).scheme_crisis)
          ? ["mental"]
          : [];
    const ordinary = canPay(
      s,
      Math.max(0, cost - maximumAllyUpgradeDiscount(s, p)),
      requirements,
      p.id,
      p.code,
      false,
    );
    choose(
      s,
      '"What could go wrong?"',
      `Interrupt the play of ${card(p).name} before paying its resource cost?`,
      [
        ...discounts,
        ...(ordinary
          ? [option("continue", "Pay the ordinary cost", after)]
          : []),
      ],
      true,
    );
    return;
  }
  const allyTargets = allyUpgradeTargets(s, p!);
  if (allyTargets.length && maximumAllyUpgradeDiscount(s, p!) > 0) {
    choose(
      s,
      card(p!).name,
      "Choose the ally before paying this upgrade's cost.",
      allyTargets.map((target) =>
        option(
          target.id,
          target.label,
          [E("allyUpgradePayment", { piece: p, target: target.id })],
          undefined,
          target.code,
        ),
      ),
      true,
    );
    return;
  }
  const masterInvocationId = doctorStrangeMasterInvocation(s, p!)?.id;
  const cost =
    cardCost(s, card(p!), p) + doctorStrangeAdditionalPlayCost(s, p!);
  if (p!.code === "14006") {
    const options = quicksilver.quicksilverCyclonePaymentOptions(
      s,
      p!,
      quicksilverPorts,
    );
    need(options.length, "Speed Cyclone requires a payable positive X.");
    choose(
      s,
      "Speed Cyclone",
      "Choose X before paying its cost.",
      options,
      true,
    );
    return;
  }
  if (p!.code === "06006") {
    const options = thorLightningPaymentOptions(s, p!, cost, thorPorts);
    need(
      options.length,
      "Lightning Strike requires at least one energy and its card cost.",
    );
    choose(
      s,
      "Lightning Strike",
      "Choose X before paying the complete cost.",
      options,
      true,
    );
    return;
  }
  const requirements: Resource[] =
    p!.code === "10002"
      ? Array(cost).fill("physical")
      : p!.code === "15012" &&
          !s.player.confused &&
          s.sideSchemes.some((piece) => card(piece).scheme_crisis)
        ? ["mental"]
        : [];
  need(
    canPay(s, cost, requirements, p!.id, p!.code, false),
    `You cannot pay ${cost} for ${card(p!).name} right now.`,
  );
  requestPayment(
    s,
    card(p!).name,
    cost,
    [E("play", { piece: p, masterInvocationId })],
    requirements,
    p,
    true,
    undefined,
    ["12011", "13012"].includes(p!.code),
    [],
    true,
  );
}
function play(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
  lightningX?: number,
  masterInvocationId?: string,
  attachedTarget?: string,
  agilityHandled = false,
  overpaid = 0,
  paidForCard?: Resource[],
) {
  const c = card(p);
  const agility = !agilityHandled ? spiderWomanCardPlayed(s, c) : [];
  if (agility.length) {
    add(
      s,
      ...agility,
      E("play", {
        piece: p,
        paid,
        lightningX,
        masterInvocationId,
        attachedTarget,
        agilityHandled: true,
        overpaid,
        paidForCard,
      }),
    );
    return;
  }
  const stored = hawkeyeStoredPlayable(s).some((x) => x.id === p.id);
  const fromHand = s.player.hand.some((x) => x.id === p.id);
  const zone = fromHand
    ? s.player.hand
    : msMarvelDiscardPlayable(s, p)
      ? s.player.discard
      : s.player.hand;
  const i = zone.findIndex((x) => x.id === p.id);
  need(stored || i >= 0, "Card is no longer available to play.");
  if (stored)
    need(hawkeyeTakeStoredForPlay(s, p.id), "The stored Arrow is unavailable.");
  else zone.splice(i, 1);
  starLord.starLordHandPlayFinished(s, p.id);
  for (const e of doctorStrangeCardPlayed(s, c)) discardPiece(s, e.id);
  msMarvelCardPlayed(s);
  captainCardPlayed(s, c);
  captainPackCardPlayed(s, c);
  gmwPack.gmwPlayerPackCardPlayed(s, c);
  gamora.gamoraCardPlayed(s, c);
  gamoraPack.gamoraPackCardPlayed(s, p);
  venomPack.venomPackCardPlayed(s, c);
  mtsPlayerPack.mtsPlayerPackCardPlayed(s, c);
  s.flags.discount = 0;
  track(s, "cardsPlayed", 1);
  log(s, `Play ${c.name}.`, "good");
  s.flags.basicAttack = false;
  s.flags.heroKill = false;
  if (c.type_code === "event") {
    beginResolution(s, p);
    add(
      s,
      ...venomPack.venomPackBeforeEvent(
        s,
        p,
        gmwPack.gmwPlayerPackBeforeEvent(
          s,
          p,
          starLord.starLordBeforeEvent(
            s,
            p,
            msMarvelBeforeEvent(s, p, [
              E("eventResolve", {
                piece: p,
                paid,
                paidForCard,
                lightningX,
                masterInvocationId,
                eventId: p.id,
              }),
            ]),
          ),
        ),
      ),
      E("finishResolution", { id: p.id, eventId: p.id, playedEvent: { ...p } }),
    );
  } else {
    const healthBefore = maxHP(s);
    Object.assign(p, resetPiece(p, true));
    if (attachedTarget) p.attachedTo = attachedTarget;
    s.player.inPlay.push(p);
    antPack.antManPackAllyPlayed(s, p, overpaid);
    waspPack.waspPackAllyPlayed(
      s,
      p,
      paid,
      Math.max(0, paid.length - overpaid),
    );
    add(
      s,
      ...antMan.antManCardEntered(s, p, antManPorts),
      ...antPack.antManPackCardEntered(s, p),
      ...quicksilverPack.quicksilverPackCardEntered(s, p),
      ...(rocket.rocketEnterPlay(s, p) || []),
      ...gmwPack.gmwPlayerPackCardEntered(s, p),
      ...starLordPack.starLordPackCardEntered(s, p),
      ...gamoraPack.gamoraPackCardEntered(s, p),
      ...draxPack.draxPackCardEntered(s, p),
      ...venomPack.venomPackCardEntered(s, p),
      ...mtsPlayerPack.mtsPlayerPackCardEntered(s, p),
      ...captainPackCardEntered(s, p),
      ...hulkPackCardEntered(s, p),
      ...msMarvelCardEntered(s, p),
      ...thorCardEntered(s, p),
      ...doctorStrangeCardEntered(s, p),
      ...blackWidowCardPlayed(s, p),
      ...hawkeyeCardEntered(s, p),
    );
    if (cardScript(p)?.implementation === "script" || p.code === "16035")
      s.player.hp += maxHP(s) - healthBefore;
    if (["01057", "01065", "01081"].includes(rulesCode(p)) && s.playerCount > 1)
      choosePlayer(
        s,
        c.name,
        [E("transferUpgrade", { id: p.id })],
        playerOrder(s).filter(
          (seat) =>
            !seatView(s, seat).player.inPlay.some(
              (x) => rulesCode(x) === rulesCode(p) && x.id !== p.id,
            ),
        ),
      );
    if (["01008", "01056", "01064", "01080"].includes(rulesCode(p)))
      p.counters = 3;
    if (rulesCode(p) === "01066") p.counters = 4;
    if (rulesCode(p) === "01036" && !isTextBlank(s, p)) s.player.hp += 6;
    if (rulesCode(p) === "01039" && !isTextBlank(s, p)) s.player.hp++;
    if (p.code === "10010") s.player.hp += 4;
    if (c.type_code === "ally")
      add(
        s,
        E("allyLimit"),
        E("allyEnter", { id: p.id, paid, fromHand }),
        ...starLordPack.starLordPackAllyPlayed(
          s,
          p,
          s.activePlayerId,
          starLordPackPorts,
        ),
      );
    const script = cardScript(p);
    if (
      script?.implementation === "script" &&
      p.code !== "04016" &&
      script.constraints.playUnderAnyPlayer &&
      s.playerCount > 1
    )
      choosePlayer(
        s,
        c.name,
        [E("transferUpgrade", { id: p.id })],
        playerOrder(s).filter(
          (seat) =>
            !script.constraints.maxPerPlayer ||
            !seatView(s, seat).player.inPlay.some(
              (x) => x.id !== p.id && card(x).name === c.name,
            ),
        ),
      );
    if (
      !attachedTarget &&
      script?.implementation === "script" &&
      script.constraints.attachTo
    )
      add(
        s,
        E("target", {
          group:
            script.constraints.attachTo === "controlled-ally"
              ? "ally"
              : script.constraints.attachTo,
          scriptSelector:
            script.constraints.attachTo === "controlled-ally"
              ? { controller: "active", type: "ally" }
              : undefined,
          title: c.name,
          action: E("attachPlayer", { id: p.id }),
        }),
      );
    if (!attachedTarget && ["01007", "01009", "01074"].includes(rulesCode(p)))
      add(
        s,
        E("target", {
          group:
            rulesCode(p) === "01007"
              ? "minion"
              : rulesCode(p) === "01009"
                ? "enemy"
                : "ally",
          title: c.name,
          action: E("attachPlayer", { id: p.id }),
        }),
      );
  }
}
function allyEnter(
  s: GameState,
  p: Piece,
  paid: Resource[] = [],
  fromHand = false,
) {
  if (isTextBlank(s, p)) return;
  if (p.code === "21005") {
    add(s, ...spectrum.spectrumAllyEntersPlay(s, p, spectrumPorts));
    return;
  }
  const starLordAlly = starLord.starLordAllyEnter(s, p, fromHand);
  if (starLordAlly !== null) {
    add(s, ...starLordAlly);
    return;
  }
  const gamoraAlly = gamora.gamoraAllyEnter(s, p, gamoraPorts);
  if (gamoraAlly !== null) {
    add(s, ...gamoraAlly);
    return;
  }
  const playerPackAlly =
    starLordPack.starLordPackAllyEnter(s, p) ??
    gamoraPack.gamoraPackAllyEnter(s, p) ??
    draxPack.draxPackAllyEnter(s, p) ??
    venomPack.venomPackAllyEnter(s, p) ??
    mtsPlayerPack.mtsPlayerPackAllyEnter(s, p, fromHand);
  if (playerPackAlly !== null) {
    add(s, ...playerPackAlly);
    return;
  }
  const gmwAlly = gmwPack.gmwPlayerPackAllyEnter(s, p);
  if (gmwAlly !== null) {
    add(s, ...gmwAlly);
    return;
  }
  const quicksilverAlly = quicksilverPack.quicksilverPackAllyEnter(s, p);
  if (quicksilverAlly !== null) {
    add(s, ...quicksilverAlly);
    return;
  }
  const scarletAlly = scarletPack.scarletWitchPackAllyEnter(s, p);
  if (scarletAlly !== null) {
    add(s, ...scarletAlly);
    return;
  }
  const waspAlly =
    p.code === "13002" ? [] : waspPack.waspPackAllyEnter(s, p, paid, fromHand);
  if (waspAlly !== null) {
    add(s, ...waspAlly);
    return;
  }
  const ant = antPack.antManPackAllyEnter(s, p);
  if (ant !== null) {
    add(s, ...ant);
    return;
  }
  const sw = spiderWomanAllyEnter(s, p, fromHand);
  if (sw !== null) {
    add(s, ...sw);
    return;
  }
  const ds = doctorStrangeAllyEnter(s, p);
  if (ds !== null) {
    add(s, ...ds);
    return;
  }
  const bw = blackWidowAllyEnter(s, p);
  if (bw !== null) {
    add(s, ...bw);
    return;
  }
  const thor = thorAllyEnter(s, p, paid);
  if (thor !== null) {
    add(s, ...thor);
    return;
  }
  const ms = msMarvelAllyEnter(s, p);
  if (ms !== null) {
    add(s, ...ms);
    return;
  }
  const hulkPack = hulkPackAllyEnter(s, p);
  if (hulkPack !== null) {
    add(s, ...hulkPack);
    return;
  }
  const pack = captainPackAllyEnter(s, p);
  if (pack !== null) {
    add(s, ...pack);
    return;
  }
  const custom = captainAllyEnter(p);
  if (custom.length) {
    add(s, ...custom);
    return;
  }
  const script = cardScript(p);
  if (script?.implementation === "script") {
    add(s, ...scriptEffects(script, "ally-enter", scriptContext(s, p)));
    return;
  }
  switch (rulesCode(p)) {
    case "01002": {
      const cards = mill(s, 2);
      for (const x of cards)
        if (
          card(x).resource_mental &&
          s.player.discard.some((p) => p.id === x.id)
        ) {
          s.player.discard = s.player.discard.filter((y) => y.id !== x.id);
          s.player.hand.push(x);
        }
      break;
    }
    case "01011":
      giveCharacterStatus(s, s.villain, "confused");
      break;
    case "01041":
      add(s, E("searchDeck", { typeCode: "upgrade", title: "Shuri" }));
      break;
    case "01067":
      add(s, ...eachPlayer(s, E("draw", { amount: 1 })));
      break;
    case "01083":
      add(
        s,
        E("target", {
          group: "enemy",
          title: "Mockingbird",
          action: E("status", { status: "stunned" }),
        }),
      );
      break;
    case "01084":
      choose(s, "Nick Fury", "Choose Nick Fury’s entrance effect.", [
        option("draw", "Draw 3 cards", [E("draw", { amount: 3 })]),
        option("damage", "Deal 4 damage", [
          E("target", {
            group: "enemy",
            action: E("damage", { amount: 4, source: p.id }),
            title: "Nick Fury",
          }),
        ]),
        option("thwart", "Remove 2 threat", [
          E("target", {
            group: "scheme",
            action: E("thwart", { amount: 2, source: p.id }),
            title: "Nick Fury",
          }),
        ]),
      ]);
      break;
  }
}
function event(
  s: GameState,
  p: Piece,
  paid: Resource[],
  lightningX?: number,
  masterInvocationId?: string,
  paidForCard?: Resource[],
  warlockDiscarded: Piece[] = [],
) {
  const ant =
    antMan.antManEvent(s, p.code === "13020" ? { ...p, code: "12020" } : p) ??
    antPack.antManPackEvent(s, p, paid) ??
    wasp.waspEvent(s, p) ??
    waspPack.waspPackEvent(s, p, paid) ??
    quicksilver.quicksilverEvent(s, p, lightningX) ??
    quicksilverPack.quicksilverPackEvent(s, p, paid) ??
    scarletWitch.scarletWitchEvent(s, p) ??
    scarletPack.scarletWitchPackEvent(s, p, paid) ??
    rocket.rocketEvent(s, p) ??
    groot.grootEvent(s, p) ??
    starLord.starLordEvent(s, p) ??
    gamora.gamoraEvent(s, p) ??
    drax.draxEvent(s, p) ??
    venom.venomEvent(s, p, paidForCard ?? paid) ??
    warlock.warlockEvent(s, p, warlockDiscarded) ??
    spectrum.spectrumEvent(s, p) ??
    gmwPack.gmwPlayerPackEvent(s, p) ??
    starLordPack.starLordPackEvent(s, p) ??
    gamoraPack.gamoraPackEvent(s, p) ??
    draxPack.draxPackEvent(s, p) ??
    venomPack.venomPackEvent(s, p) ??
    mtsPlayerPack.mtsPlayerPackEvent(s, p);
  if (ant !== null) {
    add(s, ...ant);
    return;
  }
  const hawkeye = hawkeyeEvent(s, p);
  if (hawkeye !== null) {
    add(s, ...hawkeye);
    return;
  }
  const sw = spiderWomanEvent(s, p);
  if (sw !== null) {
    add(s, ...sw);
    return;
  }
  const ds = doctorStrangeEvent(s, p, paid, masterInvocationId);
  if (ds !== null) {
    add(
      s,
      ...ds.filter((e) => p.code !== "09016" || e.type !== "ds:momentum-cost"),
    );
    return;
  }
  const bw = blackWidowEvent(s, p);
  if (bw !== null) {
    add(s, ...bw);
    return;
  }
  const thor = thorEvent(s, p, paid, lightningX);
  if (thor !== null) {
    add(s, ...thor);
    return;
  }
  const ms = msMarvelEvent(s, p, paid);
  if (ms !== null) {
    add(s, ...ms);
    return;
  }
  const hulkPack = hulkPackEvent(s, p);
  if (hulkPack !== null) {
    add(s, ...hulkPack);
    return;
  }
  const pack = captainPackEvent(s, p);
  if (pack !== null) {
    add(s, ...pack);
    return;
  }
  const hulk = hulkEvent(s, p, paid);
  if (hulk !== null) {
    add(s, ...hulk);
    return;
  }
  const custom = captainEvent(s, p, paid);
  if (custom !== null) {
    add(s, ...custom);
    return;
  }
  const script = cardScript(p);
  if (script?.implementation === "script") {
    add(s, ...scriptEffects(script, "event-action", scriptContext(s, p, paid)));
    return;
  }
  const a = (amount: number, extra: Record<string, any> = {}) =>
    E("target", {
      group: "enemy",
      title: card(p).name,
      action: E("damage", { amount, attack: true, ...extra }),
    });
  const t = (amount: number) =>
    E("target", {
      group: "scheme",
      title: card(p).name,
      action: E("thwart", { amount, action: true }),
    });
  switch (rulesCode(p)) {
    case "01005":
      add(s, a(8));
      break;
    case "01012":
      add(
        s,
        E("target", {
          group: "scheme",
          title: "Crisis Interdiction",
          action: E("crisisInterdiction"),
        }),
      );
      break;
    case "01013":
      add(
        s,
        a(5),
        ...(paid.includes("energy") ? [E("draw", { amount: 1 })] : []),
      );
      break;
    case "01021":
      add(s, a(Math.min(15, maxHP(s) - s.player.hp)));
      break;
    case "01022":
      add(
        s,
        ...targets(s, "enemy").map((x) =>
          E("damage", { target: x.id, amount: 1 }),
        ),
      );
      break;
    case "01023":
      select(
        s,
        "Legal Practice",
        s.player.confused
          ? "Discard 1–5 cards to pay the additional cost. Confused then cancels the thwart: remove Confused, but no threat."
          : "Discard 1–5 cards to pay the additional cost. Remove 1 threat per card.",
        s.player.hand,
        1,
        Math.min(5, s.player.hand.length),
        E("legalPractice"),
      );
      break;
    case "01024":
      readyIdentity(s);
      s.flags.basicAttack = false;
      break;
    case "01025":
      flip(s, false);
      draw(s, Math.max(0, heroCard(s).hand_size! - s.player.hand.length));
      break;
    case "01031": {
      const aCards = mill(s, 5);
      const amount =
        1 + aCards.reduce((n, p) => n + (card(p).resource_energy || 0) * 2, 0);
      log(
        s,
        `Repulsor Blast reveals ${aCards.map((p) => card(p).name).join(", ")}: ${amount} damage.`,
      );
      add(s, a(amount));
      break;
    }
    case "01032":
      add(s, a(aerial(s) ? 8 : 4));
      break;
    case "01042": {
      const unique = s.player.discard.filter(
        (p, i, a) => a.findIndex((x) => card(x).name === card(p).name) === i,
      );
      select(
        s,
        "Ancestral Knowledge",
        "Shuffle up to 3 different cards into your deck.",
        unique,
        0,
        3,
        E("ancestral"),
      );
      break;
    }
    case "01043a":
    case "01043b":
    case "01043c":
    case "01043d":
      add(
        s,
        E("wakanda", {
          remaining: s.player.inPlay
            .filter((x) => card(x).traits?.includes("Black Panther."))
            .map((x) => x.id),
        }),
      );
      break;
    case "01052":
      add(s, t(2));
      break;
    case "01053":
      add(
        s,
        E("target", {
          group: "minion",
          title: "Relentless Assault",
          action: E("damage", {
            amount: 5,
            attack: true,
            overkill: paid.includes("physical"),
          }),
        }),
      );
      break;
    case "01054":
      add(s, a(5));
      break;
    case "01060":
      add(s, t(paid.includes("mental") ? 4 : 3));
      break;
    case "01069":
      add(
        s,
        E("target", { group: "ally", title: "Get Ready", action: E("ready") }),
      );
      break;
    case "01070":
      choosePlayer(s, "Lead from the Front", [E("lead")]);
      break;
    case "01071": {
      const opts = s.players
        .filter((p) => !p.eliminated)
        .flatMap((p) => seatView(s, p).player.discard)
        .filter(
          (x) =>
            card(x).type_code === "ally" &&
            !uniqueConflict(s, card(x)) &&
            paymentSources(s, undefined, x.code).reduce(
              (n, p) => n + p.resources.length,
              0,
            ) >= card(x).cost!,
        )
        .map((x) =>
          option(
            x.id,
            card(x).name,
            [
              E("payRequest", {
                title: "Make the Call",
                cost: card(x).cost,
                targetCode: x.code,
                after: [E("returnAlly", { id: x.id })],
              }),
            ],
            `Cost ${card(x).cost}`,
            x.code,
          ),
        );
      choose(
        s,
        "Make the Call",
        "Choose an ally from any hero’s discard pile.",
        opts,
      );
      break;
    }
    case "01086":
      add(
        s,
        E("target", {
          group: "character",
          title: "First Aid",
          action: E("heal", { amount: 2 }),
        }),
      );
      break;
    case "01087":
      add(s, a(3));
      break;
    default:
      throw Error(`No player event script for ${p.code}.`);
  }
}
export function canChangeIdentityForm(s: GameState) {
  return !goblinIdentityLocked(s) && !s.flags.antManCannotChangeUntilTurnEnd;
}
function flip(
  s: GameState,
  counts = true,
  target?: "alter" | "tiny" | "giant",
) {
  const previousForm = s.player.form;
  if (!canChangeIdentityForm(s)) {
    need(
      !counts,
      goblinIdentityLocked(s)
        ? "All Tied Up prevents changing form."
        : "Care for Cassie prevents changing form.",
    );
    return;
  }
  if (counts) need(!s.player.flipped, "You already changed form this turn.");
  if (["ant", "wsp"].includes(s.heroId)) {
    const profile = HEROES.find((h) => h.id === s.heroId)!;
    const giantCode = s.heroId === "ant" ? "12001c" : "13001c";
    const current =
      s.player.form === "alter" ? "alter" : s.player.heroForm || "tiny";
    if (!target && counts) {
      choose(
        s,
        "Change form",
        `Choose ${profile.name}'s next form.`,
        (["alter", "tiny", "giant"] as const)
          .filter((form) => form !== current)
          .map((form) =>
            option(
              form,
              form === "alter"
                ? `${profile.identity} · Alter-ego`
                : `${profile.name} · ${form === "tiny" ? "Tiny" : "Giant"}`,
              [E("flip", { counts, target: form })],
              undefined,
              form === "alter"
                ? profile.alter
                : form === "tiny"
                  ? profile.code
                  : giantCode,
            ),
          ),
        true,
      );
      return;
    }
    target ||= s.player.form === "hero" ? "alter" : "tiny";
    need(current !== target, "Choose a different form.");
    s.player.form = target === "alter" ? "alter" : "hero";
    if (target !== "alter") s.player.heroForm = target;
  } else {
    need(
      !target || target === "alter",
      "This identity has only one hero form.",
    );
    s.player.form = s.player.form === "hero" ? "alter" : "hero";
  }
  if (counts) s.player.flipped = true;
  add(s, ...hulkFormChanged(s));
  add(s, ...drax.draxChangedForm(s, previousForm));
  const responses = antMan.antManFormChanged(s, antManPorts);
  if (
    responses.length ||
    antPack.antManPackFormResponseOptions(s, antPackPorts).length ||
    waspPack.waspPackFormResponseOptions(s, waspPackPorts).length
  )
    add(s, E("antFormResponses", { responses }));
  if (
    mtsPlayerPack.mtsPlayerPackFormResponseOptions(s, [], mtsPlayerPackPorts)
      .length
  )
    add(s, E("mtsPackFormResponses"));
  add(s, ...spectrum.spectrumChangedForm(s, spectrumPorts));
  log(
    s,
    `Change form to ${heroCard(s).name}${["ant", "wsp"].includes(s.heroId) && s.player.form === "hero" ? ` (${s.player.heroForm})` : ""}.`,
  );
  if (s.player.form === "hero" && s.heroId === "she_hulk")
    add(
      s,
      E("target", {
        group: "enemy",
        title: "Do You Even Lift?",
        action: E("damage", { amount: 2 }),
      }),
    );
}

export function abilityOptions(
  s: GameState,
  p: Piece,
): { id: string; label: string; disabled?: string }[] {
  const c = card(p);
  if (
    Object.values(spectrum.SPECTRUM_FORM_CODES).some((code) => code === p.code)
  )
    return [];
  if (isTextBlank(s, p) && c.type_code !== "ally") return [];
  const hero = s.player.form === "hero";
  const riseOptions = nativeHeroAbilityOptions(s, p.id);
  if (riseOptions.length && c.type_code !== "ally") return riseOptions;
  const dsOptions = doctorStrangeAbilityOptions(s, p.id, dsPorts);
  if (dsOptions.length && card(p).type_code !== "ally")
    return dsOptions.map(({ id, label }) => ({ id, label }));
  const bwOptions = blackWidowAbilityOptions(s, p.id);
  if (bwOptions.length)
    return bwOptions.map(({ id, label }) => ({ id, label }));
  const thorOptions = thorAbilityOptions(s, p.id);
  if (thorOptions.length)
    return thorOptions.map(({ id, label }) => ({ id, label }));
  const msOptions = msMarvelAbilityOptions(s, p.id);
  if (msOptions.length)
    return msOptions.map(({ id, label }) => ({ id, label }));
  const hulkPackOptions = hulkPackAbilityOptions(s, p.id);
  if (hulkPackOptions.length)
    return hulkPackOptions.map(({ id, label }) => ({ id, label }));
  const attachmentOptions = [
    ...goblinModuleAttachmentActions(s, p),
    ...mutagenAttachmentActions(s, p),
    ...scarletWitch.scarletWitchAttachmentActions(s, p, scarletPorts),
    ...rocket.rocketAttachmentActions(s, p, rocketPorts),
    ...gamora.gamoraAttachmentActions(s, p, gamoraPorts),
    ...spectrum.spectrumAttachmentOptions(s, p.id, spectrumPorts),
  ];
  if (attachmentOptions.length)
    return attachmentOptions.map(({ id, label }) => ({ id, label }));
  const packOptions = captainPackAbilityOptions(s, p.id);
  if (packOptions.length)
    return packOptions.map(({ id, label }) => ({ id, label }));
  const captainOptions = captainAbilityOptions(s, p.id);
  if (captainOptions.length)
    return captainOptions.map(({ id, label }) => ({ id, label }));
  const script = cardScript(p);
  const scriptedOptions =
    script?.implementation === "script" && script.trigger === "activate"
      ? [
          {
            id: "special",
            label: card(p).name,
            disabled:
              checkScriptLegality(script, scriptContext(s, p)) || undefined,
          },
        ]
      : [];
  if (c.type_code === "ally")
    return [
      {
        id: "attack",
        label: `Attack ${allyStat(s, p, "attack")}`,
        disabled: p.exhausted
          ? "Exhausted"
          : p.code === "03014" && !s.player.hand.length
            ? "Discard one card from hand to attack."
            : p.code === "18019" &&
                !p.stunned &&
                !targets(s, "enemy", true).some((target) =>
                  gamoraPack.gamoraPackAllyCanAttack(s, p, target.id),
                )
              ? "No legal enemy to attack."
              : undefined,
      },
      {
        id: "thwart",
        label: `Thwart ${allyStat(s, p, "thwart")}`,
        disabled: p.exhausted ? "Exhausted" : undefined,
      },
      ...scriptedOptions,
      ...riseOptions,
      ...dsOptions.map(({ id, label }) => ({ id, label })),
      ...(["01020", "01030", "01068"].includes(rulesCode(p))
        ? [
            {
              id: "special",
              label:
                rulesCode(p) === "01020"
                  ? "Return to hand"
                  : rulesCode(p) === "01030"
                    ? "Suppressive fire"
                    : "Density control",
              disabled:
                rulesCode(p) === "01020" || rulesCode(p) === "01068"
                  ? undefined
                  : p.exhausted
                    ? "Exhausted"
                    : undefined,
            },
          ]
        : []),
    ];
  const labels: Record<string, string> = {
    "01006": "Heal Peter Parker · 4",
    "01015": "Cycle a card",
    "01018": "Charge energy",
    "01026": "Remove 2 threat",
    "01027": "Take 1 damage · draw 1",
    "01034": "Recover a Tech upgrade",
    "01035": "Ready Iron Man",
    "01037": "Remove 1 threat",
    "01038": `Deal ${aerial(s) ? 2 : 1} damage`,
    "01039": "Gain Aerial",
    "01045": "Draw 2 cards",
    "01056": "Deal 2 damage",
    "01064": "Remove 1 threat",
    "01080": "Heal 2 damage",
    "01091": "Draw 1 card",
    "01092": "Next card costs 1 less",
    "01093": "Ready your hero",
  };
  if (!labels[rulesCode(p)]) return scriptedOptions;
  const alterOnly = ["01006", "01026", "01034", "01045"].includes(rulesCode(p));
  const heroOnly = [
    "01027",
    "01035",
    "01037",
    "01038",
    "01039",
    "01093",
  ].includes(rulesCode(p));
  const disabled = p.exhausted
    ? "Exhausted"
    : alterOnly && hero
      ? "Alter-ego form required"
      : heroOnly && !hero
        ? "Hero form required"
        : undefined;
  return [
    { id: "special", label: labels[rulesCode(p)], disabled },
    ...(rulesCode(p) === "01018"
      ? [
          {
            id: "fire",
            label: `Release ${Math.min(10, p.counters * 2)} damage`,
            disabled: !hero
              ? "Hero form required"
              : !p.counters
                ? "Charge first"
                : undefined,
          },
        ]
      : []),
  ];
}
function allyStat(s: GameState, p: Piece, kind: "attack" | "thwart") {
  return (
    (card(p)[kind] || 0) +
    Number(s.flags.lead || 0) +
    allInPlay(s).filter(
      (x) => rulesCode(x) === "01074" && x.attachedTo === p.id,
    ).length +
    (kind === "attack"
      ? p.bonusAtk || 0
      : (p.bonusThw || 0) +
        (rulesCode(p) === "01059" ? s.sideSchemes.length : 0)) +
    wasp.waspAllyStats(
      textActiveState(
        controller(s, p.id) ? seatView(s, controller(s, p.id)!) : s,
      ),
      p,
    )[kind] +
    scriptedModifier(s, kind, p) +
    antPack.antManPackModifiers(s, p.id, { maxAllyHP: pieceHP })[kind] +
    starLordPack.starLordPackModifiers(s, p.id, starLordPackPorts)[kind] +
    mtsPlayerPack.mtsPlayerPackModifiers(s, p.id, mtsPlayerPackPorts)[kind] +
    (kind === "thwart"
      ? starLord.starLordAllyThwartBonus(
          controller(s, p.id) ? seatView(s, controller(s, p.id)!) : s,
          p,
        ) + gamoraPack.gamoraPackAllyThwart(s, p)
      : 0) +
    (kind === "attack"
      ? captainPackModifiers(textActiveState(s), p.id).attack +
        hulkPackModifiers(textActiveState(s), p.id).attack +
        scarletPack.scarletWitchPackAllyAttackBonus(s, p)
      : 0)
  );
}
function ability(s: GameState, id: string, action = "special") {
  if (
    mtsPlayerPack.mtsPlayerPackAbility(
      s,
      id,
      mtsPlayerPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  const source = find(s, id);
  need(
    !source ||
      !isTextBlank(s, source) ||
      (card(source).type_code === "ally" &&
        ["attack", "thwart"].includes(action)),
    "This card's printed text is blank.",
  );
  if (
    warlock.warlockAbility(
      s,
      id,
      warlockPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  const ant =
    antMan.antManAbility(
      s,
      id,
      action === "special" ? undefined : action,
      antManPorts,
    ) ??
    antPack.antManPackAbility(
      s,
      id,
      action === "special" ? undefined : action,
      antPackPorts,
    ) ??
    wasp.waspAbility(
      s,
      id,
      action === "special" ? undefined : action,
      waspPorts,
    ) ??
    quicksilver.quicksilverAbility(
      s,
      id,
      action === "special" ? undefined : action,
      quicksilverPorts,
    ) ??
    scarletWitch.scarletWitchAbility(
      s,
      id,
      action === "special" ? undefined : action,
      scarletPorts,
    ) ??
    rocket.rocketAbility(
      s,
      id,
      action === "special" ? undefined : action,
      rocketPorts,
    ) ??
    groot.grootAbility(
      s,
      id,
      action === "special" ? undefined : action,
      grootPorts,
    ) ??
    starLord.starLordAbility(
      s,
      id,
      action === "special" ? undefined : action,
      starLordPorts,
    ) ??
    gamora.gamoraAbility(
      s,
      id,
      action === "special" ? undefined : action,
      gamoraPorts,
    ) ??
    drax.draxAbility(
      s,
      id,
      action === "special" ? undefined : action,
      draxPorts,
    ) ??
    venom.venomAbility(
      s,
      id,
      action === "special" ? undefined : action,
      venomPorts,
    ) ??
    spectrum.spectrumAbility(s, id, action, spectrumPorts);
  if (ant) {
    add(s, ...ant);
    return;
  }
  if (
    starLordPack.starLordPackAbility(
      s,
      id,
      starLordPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    draxPack.draxPackAbility(
      s,
      id,
      draxPackPorts,
      action === "special" ? undefined : action,
    ) ||
    venomPack.venomPackAbility(
      s,
      id,
      venomPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    gmwPack.gmwPlayerPackAbility(
      s,
      id,
      gmwPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    quicksilverPack.quicksilverPackAbility(
      s,
      id,
      quicksilverPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  const rise =
    hawkeyeAbility(
      s,
      id,
      action === "special" ? undefined : action,
      hawkeyePorts,
    ) ??
    spiderWomanAbility(
      s,
      id,
      action === "special" ? undefined : action,
      swPorts,
    );
  if (rise) {
    add(s, ...rise);
    return;
  }
  if (!(
    find(s, id) &&
    card(find(s, id)!).type_code === "ally" &&
    ["attack", "thwart"].includes(action)
  )) {
    const ds = doctorStrangeAbility(
      s,
      id,
      action === "special" ? undefined : action,
      dsPorts,
    );
    if (ds) {
      add(s, ...ds);
      return;
    }
  }
  const bw = blackWidowAbility(
    s,
    id,
    action === "special" ? undefined : action,
  );
  if (bw) {
    add(s, ...bw);
    return;
  }
  const thor = thorAbility(s, id, action === "special" ? undefined : action);
  if (thor) {
    add(s, ...thor);
    return;
  }
  const ms = msMarvelAbility(s, id, action === "special" ? undefined : action);
  if (ms) {
    add(s, ...ms);
    return;
  }
  const hulkPack = hulkPackAbility(
    s,
    id,
    action === "special" ? undefined : action,
  );
  if (hulkPack) {
    add(s, ...hulkPack);
    return;
  }
  const pack = captainPackAbility(
    s,
    id,
    action === "special" ? undefined : action,
  );
  if (pack) {
    add(s, ...pack);
    return;
  }
  const hulk = hulkAbility(s, id, action === "special" ? undefined : action);
  if (hulk) {
    add(s, ...hulk);
    return;
  }
  const captain = captainAbility(
    s,
    id,
    action === "special" ? undefined : action,
  );
  if (captain) {
    add(s, ...captain);
    return;
  }
  if (id === "identity") {
    if (s.player.form === "alter") {
      if (s.heroId === "captain_marvel") {
        need(!s.flags.commander, "Commander has been used this round.");
        s.flags.commander = true;
        choosePlayer(s, "Commander", [E("draw", { amount: 1 })]);
      } else if (s.heroId === "iron_man") {
        need(!s.flags.futurist, "Futurist has been used this round.");
        need(s.player.deck.length, "There are no cards to look at.");
        s.flags.futurist = true;
        const looked = s.player.deck.slice(0, 3);
        revealHidden(s);
        const options = looked.map((p) =>
          option(
            p.id,
            card(p).name,
            [E("futurist", { id: p.id, ids: looked.map((x) => x.id) })],
            plain(card(p).text),
            p.code,
          ),
        );
        choose(
          s,
          "Futurist",
          "Keep one of the top 3 cards. Discard the others.",
          options,
        );
      } else
        throw Error(
          "This identity ability is automatic or available during payment.",
        );
    } else if (s.heroId === "captain_marvel") {
      need(
        !s.flags.rechannel && s.player.hp < maxHP(s),
        "Rechannel requires damage and is once per round.",
      );
      requestPayment(
        s,
        "Rechannel",
        1,
        [
          E("flag", { key: "rechannel", value: true }),
          E("heal", { target: "hero", amount: 1 }),
          E("draw", { amount: 1 }),
        ],
        ["energy"],
        undefined,
        true,
      );
    } else throw Error("This hero ability triggers automatically.");
    return;
  }
  const p = s.player.inPlay.find((p) => p.id === id);
  need(p, "This hero does not control that card.");
  const x = p!;
  const choices = abilityOptions(s, x);
  const selected = choices.find((o) => o.id === action);
  need(
    selected && !selected.disabled,
    selected?.disabled || "Ability unavailable.",
  );
  if (card(x).type_code === "ally" && ["attack", "thwart"].includes(action)) {
    const cost = action === "attack" ? captainPackAllyAttackCost(s, x) : null;
    if (cost) {
      add(s, ...cost);
      return;
    }
    x.exhausted = true;
    add(
      s,
      E("target", {
        group: action === "attack" ? "enemy" : "scheme",
        title: card(x).name,
        action: E("allyAction", {
          id,
          kind: action,
          attack: action === "attack",
          action: action === "thwart",
          amount: allyStat(s, x, action as "attack" | "thwart"),
        }),
      }),
    );
    return;
  }
  const script = cardScript(x);
  if (script?.implementation === "script" && script.trigger === "activate") {
    add(s, ...scriptEffects(script, "activate", scriptContext(s, x)));
    return;
  }
  const activate = (...eff: Effect[]) => add(s, E("exhaust", { id }), ...eff);
  switch (rulesCode(x)) {
    case "01006":
      need(s.player.hp < maxHP(s), "Peter Parker is already at full health.");
      activate(E("heal", { target: "hero", amount: 4 }));
      break;
    case "01015":
      need(s.player.hand.length, "You need a card to discard.");
      select(
        s,
        "Alpha Flight Station",
        "Choose 1 card to discard.",
        s.player.hand,
        1,
        1,
        E("alpha", { id }),
      );
      break;
    case "01018":
      if (action === "fire") {
        const n = Math.min(10, x.counters * 2);
        discardPiece(s, id);
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Energy Channel",
            action: E("damage", { amount: n, attack: true }),
          }),
        );
      } else
        requestPayment(
          s,
          "Energy Channel",
          1,
          [E("chargeEnergy", { id })],
          ["energy"],
          undefined,
          true,
        );
      break;
    case "01020":
      s.player.inPlay = s.player.inPlay.filter((p) => p.id !== id);
      for (const a of s.player.inPlay.filter((p) => p.attachedTo === id))
        discardPiece(s, a.id);
      s.player.hand.push({ ...x, damage: 0, exhausted: false });
      break;
    case "01026":
      requestPayment(
        s,
        "Superhuman Law Division",
        1,
        [
          E("exhaust", { id }),
          E("target", {
            group: "scheme",
            title: "Superhuman Law Division",
            action: E("thwart", { amount: 2 }),
          }),
        ],
        ["mental"],
        undefined,
        true,
      );
      break;
    case "01027":
      need(!s.player.tough, "Tough prevents paying the take-damage cost.");
      x.exhausted = true;
      dealDamage(s, "hero", 1, "cost");
      add(s, E("draw", { amount: 1 }));
      break;
    case "01030":
      need(
        pieceHP(s, x) - x.damage >= 2,
        "War Machine needs at least 2 remaining hit points.",
      );
      activate(
        E("damage", { target: id, amount: 2 }),
        ...targets(s, "enemy").map((t) =>
          E("damage", { target: t.id, amount: 1, source: id }),
        ),
      );
      break;
    case "01034": {
      const eligible = playerOrder(s).filter((p) =>
        seatView(s, p).player.discard.some(
          (x) =>
            card(x).type_code === "upgrade" &&
            card(x).traits?.includes("Tech."),
        ),
      );
      need(eligible.length, "No Tech upgrade in the team's discard piles.");
      x.exhausted = true;
      choosePlayer(s, "Stark Tower", [E("recoverTech")], eligible);
      break;
    }
    case "01035":
      need(s.player.exhausted, "Iron Man is already ready.");
      activate(E("ready", { target: "hero" }));
      break;
    case "01037":
      activate(
        ...(aerial(s)
          ? [E("thwartAll", { amount: 1 })]
          : [
              E("target", {
                group: "scheme",
                title: "Mark V Helmet",
                action: E("thwart", { amount: 1, action: true }),
              }),
            ]),
      );
      break;
    case "01038":
      activate(
        E("target", {
          group: "enemy",
          title: "Powered Gauntlets",
          action: E("damage", { amount: aerial(s) ? 2 : 1, attack: true }),
        }),
      );
      break;
    case "01039":
      requestPayment(
        s,
        "Rocket Boots",
        1,
        [E("exhaust", { id }), E("flag", { key: "aerial", value: true })],
        ["mental"],
        undefined,
        true,
      );
      break;
    case "01045":
      activate(E("draw", { amount: 2 }));
      break;
    case "01056":
    case "01064":
    case "01080": {
      const group =
        rulesCode(x) === "01056"
          ? "enemy"
          : rulesCode(x) === "01064"
            ? "scheme"
            : "friendly";
      const type =
        rulesCode(x) === "01056"
          ? "damage"
          : rulesCode(x) === "01064"
            ? "thwart"
            : "heal";
      activate(
        E("useCounter", { id }),
        E("target", {
          group,
          title: card(x).name,
          action: E(type, {
            amount: rulesCode(x) === "01064" ? 1 : 2,
            source: id,
          }),
        }),
      );
      break;
    }
    case "01068":
      need(!x.used, "Vision already used Density Control this round.");
      choose(
        s,
        "Density Control",
        "Spend an energy resource to boost one power by 2 this phase.",
        ["attack", "thwart"].map((kind) =>
          option(kind, kind === "attack" ? "+2 ATK" : "+2 THW", [
            E("payRequest", {
              title: "Density Control",
              targetCode: x.code,
              cost: 1,
              requirements: ["energy"],
              after: [E("vision", { id, kind })],
            }),
          ]),
        ),
      );
      break;
    case "01091":
      x.exhausted = true;
      choosePlayer(s, "Avengers Mansion", [E("draw", { amount: 1 })]);
      break;
    case "01092":
      x.exhausted = true;
      choosePlayer(s, "Helicarrier", [E("discount")]);
      break;
    case "01093":
      need(s.player.exhausted, "Your hero is already ready.");
      requestPayment(
        s,
        "Tenacity",
        1,
        [E("discardPiece", { id }), E("ready", { target: "hero" })],
        ["physical"],
        undefined,
        true,
      );
      break;
    default:
      throw Error("This card has no action ability.");
  }
}
function addDrone(s: GameState) {
  const p = takePlayer(s);
  if (!p) return;
  const drone = makePiece(s, "drone");
  drone.droneCard = p;
  drone.engagedWith = s.activePlayerId;
  s.minions.push(drone);
  log(s, "An Ultron Drone engages you.", "bad");
  minionEntered(s, drone);
}
function removeEncounterInstance(s: GameState, id: string) {
  for (const zone of [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    s.encounter.storedBoosts || [],
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
  ]) {
    const index = zone.findIndex((p) => p.id === id);
    if (index >= 0) zone.splice(index, 1);
  }
}
const hulkPackPorts = {
  queue: add,
  choose,
  discardPiece,
  dealEncounter,
  transferControl: (s: GameState, id: string, playerId: string) => {
    const old = controller(s, id),
      target = s.players.find((p) => p.id === playerId && !p.eliminated);
    need(old && target, "Upgrade recipient is unavailable.");
    const zone = seatView(s, old!).player.inPlay,
      index = zone.findIndex((p) => p.id === id);
    const [p] = zone.splice(index, 1);
    seatView(s, target!).player.inPlay.push(p);
  },
  moveThreat: thwart,
  cardCost: (s: GameState, p: Piece) => cardCost(s, card(p)),
  canPay: (s: GameState, cost: number, exclude: string, targetCode: string) =>
    canPay(s, cost, [], exclude, targetCode),
};
const mutagenPorts: MutagenEnginePorts = {
  queue: add,
  choose,
  pay: (s, cost, req, after, title, cancelable) =>
    requestPayment(s, title, cost, after, req, undefined, cancelable),
  canPay: (s, cost, req) => canPay(s, cost, req),
  discardTop: (s) => {
    recycleEncounter(s);
    const p = s.encounter.deck.shift();
    if (p) {
      revealHidden(s);
      s.encounter.discard.push(p);
    }
    const emptied = !!p && !s.encounter.deck.length;
    recycleEncounter(s);
    return { piece: p, emptied };
  },
  putMinion: (s, p, playerId) => {
    removeEncounterInstance(s, p.id);
    const previous = s.activePlayerId;
    activateSeat(s, playerId);
    minionWillEnter(s, p);
    s.minions.push(p);
    minionEntered(s, p);
    activateSeat(s, previous);
  },
  putSideScheme: (s, p) => {
    removeEncounterInstance(s, p.id);
    Object.assign(p, resetPiece(p, true));
    p.counters =
      (card(p).base_threat || 0) *
      (card(p).base_threat_fixed ? 1 : s.playerCount);
    s.sideSchemes.push(p);
  },
  attach: (s, p, enemyId) => {
    removeEncounterInstance(s, p.id);
    p.attachedTo = enemyId;
    s.attachments.push(p);
  },
  discardPiece,
  shuffleIntoEncounter: (s, p) => {
    removeEncounterInstance(s, p.id);
    s.encounter.deck.push(resetPiece(p));
    s.encounter.deck = shuffle(s, s.encounter.deck);
  },
  shuffleEncounter: (s) => {
    s.encounter.deck = shuffle(s, s.encounter.deck);
  },
  dealEncounter,
  giveBoost: (s, villainId, scope) => {
    const p = drawEncounter(s);
    if (!p) return;
    if (scope === "next") (s.encounter.storedBoosts ||= []).push(p);
    else if (s.attack?.attacker === villainId)
      (s.attack.pendingBoosts ||= []).push(p);
    else if (s.scheming?.attacker === villainId)
      s.scheming.pendingBoosts.push(p);
    else throw Error("No current villain activation for this boost.");
  },
  activate: (s, request) => {
    activateSeat(s, request.playerId);
    if (request.kind === "attack")
      enemyAttack(s, request.enemyId, undefined, request);
    else enemyScheme(s, request.enemyId, undefined, request);
  },
};
function discardMainAttachments(s: GameState) {
  for (const p of [...allInPlay(s), ...s.attachments].filter((p) =>
    ["main", `main:${s.scheme.code}`].includes(p.attachedTo || ""),
  ))
    discardPiece(s, p.id);
}
function openMsDamageWindow(s: GameState, packet: Effect): boolean {
  if (packet.amount <= 0 || s.player.tough) return false;
  packet.damageWindowId ||= `damage${s.nextId++}`;
  const key = packet.damageWindowId;
  const amount = Math.max(
    0,
    packet.amount - Number(s.flags[`msPrevent:${key}`] || 0),
  );
  if (amount === 0) return false;
  const used = String(s.flags[`msUsed:${key}`] || "").split(",");
  const options = [
    ...drax.draxDamageOptions(s, packet, amount, [packet], draxPorts),
    ...draxPack.draxPackDamageOptions(
      s,
      packet,
      amount,
      [packet],
      draxPackPorts,
    ),
    ...mtsPlayerPack.mtsPlayerPackDamageOptions(
      s,
      packet,
      amount,
      [packet],
      mtsPlayerPackPorts,
    ),
    ...starLord.starLordDamageOptions(
      s,
      packet,
      amount,
      [packet],
      starLordPorts,
    ),
    ...gamora.gamoraDamageOptions(s, packet, amount, [packet], gamoraPorts),
    ...scarletWitch.scarletWitchDamageOptions(
      s,
      packet,
      amount,
      [packet],
      scarletPorts,
    ),
    ...wasp.waspDamageOptions(s, packet, amount, [packet], waspPorts),
    ...quicksilverPack.quicksilverPackDamageOptions(
      s,
      {
        target: "hero",
        playerId: s.activePlayerId,
        amount,
        packet,
        source: packet.retaliateSource || packet.source,
      },
      [packet],
      quicksilverPackPorts,
    ),
    ...msMarvelDamageOptions(
      s,
      { target: "hero", amount, packet },
      [packet],
      msPorts,
    ),
    ...blackWidowDamageOptions(
      s,
      { target: "hero", playerId: s.activePlayerId, amount, packet },
      [packet],
    ),
    ...warningOptions(
      s,
      { target: "hero", playerId: s.activePlayerId, amount, packet },
      [packet],
    ),
  ].filter((o) => !used.includes(o.id));
  if (!options.length) return false;
  choose(
    s,
    "Incoming damage",
    `${heroCard(s).name} would take ${amount} damage.`,
    [
      ...options.map((o) => ({
        ...o,
        effects: [
          ...(s.player.inPlay.some((p) => p.id === o.id)
            ? [
                E("flag", {
                  key: `msUsed:${key}`,
                  value: [...used, o.id].join(","),
                }),
              ]
            : []),
          ...o.effects,
        ],
      })),
      option("allow", `Take ${amount} damage`, [
        { ...packet, msDamageDone: true },
      ]),
    ],
  );
  return true;
}
function activationAmplify(s: GameState): number {
  const definitions = [
    card(s.scheme.code),
    ...[
      s.villain,
      ...s.minions,
      ...s.sideSchemes,
      ...s.attachments,
      ...(s.environments || []),
    ]
      .filter((p) => !isTextBlank(s, p))
      .map(card),
  ];
  return definitions.filter(
    (c) => (c as Card & { scheme_amplify?: boolean }).scheme_amplify,
  ).length;
}
function activationBoostValue(s: GameState, id: string, code?: string): number {
  const activation = s.scheming || s.attack;
  const printedCode = code || s.resolving.find((p) => p.id === id)?.code;
  return (
    activation?.boostValues?.[id] ??
    (printedCode ? card(printedCode).boost || 0 : 0)
  );
}
function countActivationBoost(s: GameState, id: string, after: Effect[]): void {
  const p = s.resolving.find((piece) => piece.id === id) || find(s, id);
  if (!p) {
    add(s, ...after);
    return;
  }
  add(
    s,
    ...scarletWitch.scarletWitchCountBoosts(
      s,
      [p],
      [E("scarletBoostCounted", { id, after })],
      { sourceTitle: "Boost icons", amplify: activationAmplify(s) },
    ),
  );
}
const bwPorts: BlackWidowPorts = {
  queue: add,
  choose,
  discardPiece,
  revealHidden,
  flip,
  shufflePlayerDeck: (s) => {
    s.player.deck = shuffle(s, s.player.deck);
    recyclePlayer(s);
  },
  canChangeForm: canChangeIdentityForm,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  identityHasTrait: (s, id, trait) =>
    [
      ...(heroCard(seatView(s, id)).traits?.split(/\.\s*/) || []),
      ...doctorStrangeTraits(seatView(s, id)),
    ].includes(trait),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  attackProgram: (s, effects, after) => {
    const id = `program${s.nextId++}`;
    const eventId =
      s.resolving.find((p) => p.id === s.currentEventId)?.code === "08004"
        ? s.currentEventId
        : undefined;
    add(
      s,
      ...effects.map((e) => ({
        ...e,
        attackProgramId: id,
        responseGroup: undefined,
        eventId,
      })),
      E("attackProgramEnd", { id, attackProgramId: id, eventId }),
      ...after.map((e) => ({
        ...e,
        attackProgramId: undefined,
        responseGroup: undefined,
        eventId,
      })),
    );
  },
  numericBoostIcons: (s, id) => {
    const p = s.resolving.find((p) => p.id === id);
    return !p || s.boostCancellations?.[id]?.icons
      ? 0
      : ((s.scheming || s.attack)?.boostValues?.[id] ??
          (card(p).boost || 0) +
            scarletWitch.scarletWitchBoostIconBonus(textActiveState(s)) +
            activationAmplify(s));
  },
  countBoostIcons: countActivationBoost,
  cancelBoostIcons: (s, id) => {
    const amount = bwPorts.numericBoostIcons(s, id);
    const a = s.scheming || s.attack;
    need(a, "No activation owns this boost.");
    (a!.boostValues ||= {})[id] = 0;
    ((s.boostCancellations ||= {})[id] ||= {}).icons = true;
    return amount;
  },
  hasBoostAbility: (s, id) =>
    !!s.resolving.find((p) => p.id === id && card(p).boost_star) &&
    !s.boostCancellations?.[id]?.ability,
  cancelBoostAbility: (s, id) => {
    ((s.boostCancellations ||= {})[id] ||= {}).ability = true;
  },
  cancelEncounter: (s, p) => {
    s.queue = s.queue.filter(
      (e) =>
        e.revealWindowId !== p.id &&
        !(
          e.piece?.id === p.id &&
          [
            "reveal",
            "repeatWhenRevealed",
            "treacheryText",
            "finishResolution",
          ].includes(e.type)
        ),
    );
    if (s.revealWindows) delete s.revealWindows[p.id];
    finishResolution(s, p.id);
    log(s, `${card(p).name}: all effects canceled.`, "good");
  },
  revealReplacement: (s, id) => {
    add(s, E("revealNext", { actorId: id }));
  },
  preventDamage: (s, window, amount) => {
    const previous = s.activePlayerId;
    activateSeat(s, window.playerId);
    resolve(s, E("ms:prevent-damage", { packet: window.packet, amount }));
    activateSeat(s, previous);
  },
  returnDefeatedAlly: (s, id, playerId, damage, after) => {
    activateSeat(s, playerId);
    const index = s.player.discard.findIndex((p) => p.id === id);
    need(index >= 0, "The defeated ally is no longer in your discard pile.");
    const p = resetPiece(s.player.discard.splice(index, 1)[0], true);
    s.player.inPlay.push(p);
    // The return and damage happen together before entrance/defeat responses.
    const prior = new Set(s.queue);
    dealDamage(s, p.id, damage, "08031");
    const generated = s.queue.filter((e) => !prior.has(e));
    s.queue = s.queue.filter((e) => prior.has(e));
    add(
      s,
      ...generated,
      E("allyLimit"),
      E("allyEnter", { id: p.id }),
      ...after,
    );
  },
  activationModifier: (s, atk, sch) => {
    if (s.attack)
      s.attack.extraBoostIcons = (s.attack.extraBoostIcons || 0) + atk;
    else if (s.scheming)
      s.scheming.extraBoostIcons = (s.scheming.extraBoostIcons || 0) + sch;
  },
  log,
};

function warningOptions(
  s: GameState,
  window: Parameters<typeof doctorStrangeDamageOptions>[1],
  after: Effect[],
) {
  const original = s.activePlayerId;
  return playerOrder(s).flatMap((seat) =>
    doctorStrangeDamageOptions(
      seatView(s, seat),
      window,
      after.map((e) => ({ ...e, actorId: original })),
      dsPorts,
    ).map((o) => ({
      ...o,
      id: `${seat.id}:${o.id}`,
      effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
    })),
  );
}
function allyUpgradeTargets(s: GameState, p: Piece) {
  if (["17019", "18030"].includes(p.code))
    return (
      p.code === "17019"
        ? starLordPack.starLordPackAttachmentTargets(
            s,
            p.code,
            starLordPackPorts,
          )
        : gamoraPack.gamoraPackAttachmentTargets(s, gamoraPackPorts)
    ).map((target) => ({
      id: target.id,
      label: card(target).name,
      code: target.code,
    }));
  if (["12017", "12018"].includes(p.code))
    return antPack
      .antManPackAttachmentTargets(s, p.code, {
        hasTrait: captainPackHasTrait,
      })
      .map((target) => ({
        id: target.id,
        label: card(target).name,
        code: target.code,
      }));
  const script = cardScript(p);
  const attach =
    script?.implementation === "script"
      ? script.constraints.attachTo
      : undefined;
  if (
    !["ally", "controlled-ally"].includes(attach || "") &&
    rulesCode(p) !== "01074"
  )
    return [];
  return targets(s, "ally").filter(
    (x) =>
      attach !== "controlled-ally" ||
      s.player.inPlay.some((p) => p.id === x.id),
  );
}
function maximumAllyUpgradeDiscount(s: GameState, p: Piece) {
  return Math.max(
    0,
    ...allyUpgradeTargets(s, p).map((x) =>
      doctorStrangeAttachedUpgradeDiscount(s, x.id),
    ),
  );
}
const dsPorts: DoctorStrangePorts = {
  queue: add,
  choose,
  select,
  makePiece,
  shuffle,
  revealHidden,
  discardPiece,
  flip,
  canChangeForm: canChangeIdentityForm,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  discardTop: (s, id, n) => {
    const previous = s.activePlayerId;
    activateSeat(s, id);
    const cards: Piece[] = [];
    for (let i = 0; i < n; i++) {
      recyclePlayer(s);
      const p = s.player.deck.shift();
      if (p) {
        cards.push(p);
        s.player.discard.push(resetPiece(p));
        revealHidden(s);
      }
      recyclePlayer(s);
    }
    activateSeat(s, previous);
    return cards;
  },
  peekEncounter: (s) => {
    recycleEncounter(s);
    const p = s.encounter.deck[0];
    if (p) {
      s.encounter.knownTop = { id: p.id, playerId: s.activePlayerId };
      revealHidden(s);
    }
    return p;
  },
  cardCost: (s, p) => cardCost(s, card(p)),
  canPay: (s, cost, exclude, target) => canPay(s, cost, [], exclude, target),
  pay: (s, title, cost, requirements, after, piece, targetCode) =>
    requestPayment(
      s,
      title,
      cost,
      after,
      requirements,
      piece,
      false,
      targetCode,
    ),
  transferControl: (s, id, playerId) =>
    hulkPackPorts.transferControl(s, id, playerId),
  shuffleAllyIntoOwnerDeck: (s, id) => {
    const p = find(s, id);
    need(p, "The ally is no longer in play.");
    const owner = s.players.find(
      (seat) => seat.id === p!.ownerId && !seat.eliminated,
    );
    need(owner, "The ally's owner is unavailable.");
    discardPiece(s, id);
    const v = seatView(s, owner!);
    const index = v.player.discard.findIndex((x) => x.id === id);
    need(index >= 0, "The physical ally could not be returned.");
    v.player.deck.push(v.player.discard.splice(index, 1)[0]);
    v.player.deck = shuffle(s, v.player.deck);
  },
  heroMaxHP: (s, id) => maxHP(seatView(s, id)),
  removeStatus: (s, target, status) => {
    const v = target.startsWith("hero:") ? seatView(s, target.slice(5)) : s;
    const piece =
      target === "hero" || target.startsWith("hero:")
        ? v.player
        : find(s, target);
    need(piece, "The selected character is unavailable.");
    const key =
      status === "tough"
        ? "toughCards"
        : status === "stunned"
          ? "stunCards"
          : "confuseCards";
    piece![key] = Math.max(
      0,
      Number(piece![key] ?? Number(piece![status])) - 1,
    );
    syncStatuses(
      piece!,
      target === "hero" || target.startsWith("hero:")
        ? heroCard(v)
        : card(find(s, target)!),
    );
  },
  canAddStatus: (s, target, status) => {
    const v = target.startsWith("hero:") ? seatView(s, target.slice(5)) : s;
    const piece =
      target === "hero" || target.startsWith("hero:")
        ? v.player
        : find(s, target);
    return (
      !!piece &&
      giveStatus(
        structuredClone(piece),
        target === "hero" || target.startsWith("hero:")
          ? heroCard(v)
          : card(find(s, target)!),
        status,
      )
    );
  },
  cancelBoost: (s, id) => bwPorts.cancelBoostIcons(s, id),
};

const hawkeyePorts: HawkeyePorts = {
  queue: add,
  choose,
  revealHidden,
  shufflePlayerDeck: (s) => {
    s.player.deck = shuffle(s, s.player.deck);
    recyclePlayer(s);
  },
  recyclePlayer,
  discardHand,
  discardPiece,
  returnAlly: (s, id) => msPorts.returnAlly(s, id),
  transferControl: (s, id, playerId) =>
    hulkPackPorts.transferControl(s, id, playerId),
  canChangeForm: canChangeIdentityForm,
  flip,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  identityHasTrait: (s, id, trait) => bwPorts.identityHasTrait(s, id, trait),
  characterHasTrait: captainPackHasTrait,
  canPay,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, ignoreCrisis) => {
    if (captainThwartBlocked(s)) return [];
    const ordinary = targets(s, "scheme", false, true);
    if (
      ignoreCrisis &&
      !ordinary.some((p) => p.id === "main") &&
      !engaged(s).some((p) => keyword(p, "Patrol")) &&
      rulesCode(s.scheme) !== "01139b" &&
      s.scheme.threat > 0
    ) {
      ordinary.unshift({
        id: "main",
        label: card(s.scheme.code).name,
        code: s.scheme.code,
      });
    }
    return ordinary;
  },
  preventAllAttackDamage: (s) => {
    if (s.attack) s.attack.preventAllDamage = true;
  },
  log,
};
const swPorts: SpiderWomanPorts = {
  queue: add,
  choose,
  revealHidden,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  identityMaxHP: (s, id) => maxHP(seatView(s, id)),
  canReadyIdentity: hawkeyePorts.canReadyIdentity,
  canGiveStatus: (s, id, status) => dsPorts.canAddStatus(s, id, status),
  enemyTargets: hawkeyePorts.enemyTargets,
  schemeTargets: (s, thwarting) => targets(s, "scheme", false, thwarting),
  peekableDecks: (s) => [
    ...playerOrder(s).map((seat) => ({
      id: `player:${seat.id}`,
      label: `${heroCard(seatView(s, seat)).name}'s deck`,
      top: seatView(s, seat).player.deck[0],
    })),
    { id: "encounter", label: "Encounter deck", top: s.encounter.deck[0] },
    ...playerOrder(s).flatMap((seat) => {
      const inv = seatView(s, seat).player.invocationDeck;
      return inv
        ? [
            {
              id: `invocation:${seat.id}`,
              label: `${heroCard(seatView(s, seat)).name}'s Invocation deck`,
              top: inv[0],
            },
          ]
        : [];
    }),
  ],
  thwartDistribution: (s, packets) => {
    const legal = targets(s, "scheme", false, true);
    need(
      packets.every(
        (p) => p.amount >= 0 && legal.some((x) => x.id === p.target),
      ),
      "Invalid threat distribution.",
    );
    const defeated: Piece[] = [];
    for (const packet of packets) {
      const piece = s.sideSchemes.find((p) => p.id === packet.target);
      const available =
        packet.target === "main" ? s.scheme.threat : piece?.counters || 0;
      const removed = Math.min(packet.amount, available);
      if (packet.target === "main") s.scheme.threat -= removed;
      else if (piece) {
        piece.counters -= removed;
        if (!piece.counters) defeated.push(piece);
      }
      track(s, "threatRemoved", removed);
      log(
        s,
        `Remove ${removed} threat from ${packet.target === "main" ? "the main scheme" : card(piece!).name}.`,
        "good",
      );
    }
    // Defeat interrupts still see the schemes and their attachments in play.
    // After they finish, remove the whole simultaneous batch before responses.
    add(
      s,
      ...defeated.flatMap((p) => [
        ...(goblinModuleDefeated(s, p) || []),
        ...(mutagenDefeated(s, p) || []),
        ...captainPackSchemeDefeated(s, p),
      ]),
      E("defeatSchemes", { ids: defeated.map((p) => p.id) }),
    );
  },
  attackMinion: (s, id, playerId, after) => {
    activateSeat(s, playerId);
    enemyAttack(s, id, undefined, {
      after,
      playerId,
      enemyId: id,
      kind: "attack",
      modifier: 0,
    });
  },
  putMinion: (s, p, playerId) => {
    Object.assign(p, resetPiece(p, true));
    mutagenPorts.putMinion(s, p, playerId);
  },
  log,
};
const antManPorts: antMan.AntManPorts = {
  queue: add,
  choose,
  canChangeForm: canChangeIdentityForm,
  flip,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  canPay,
  canGiveStatus: dsPorts.canAddStatus,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwarting) => {
    if (thwarting && captainThwartBlocked(s)) return [];
    const list = targets(s, "scheme", false, thwarting);
    if (
      !thwarting &&
      !list.some((t) => t.id === "main") &&
      rulesCode(s.scheme) !== "01139b" &&
      s.scheme.threat > 0 &&
      !hulkThreatLocked(s, "main")
    )
      list.unshift({
        id: "main",
        label: card(s.scheme.code).name,
        code: s.scheme.code,
      });
    return list;
  },
  isTextBlank,
  discardHand,
  discardPiece,
  revealHidden,
  recycleEncounter,
  attackProgram: bwPorts.attackProgram,
  log,
};
const antPackPorts: antPack.AntManPackPorts = {
  queue: add,
  choose,
  attach: attachPackUpgrade,
  mill,
  maxAllyHP: pieceHP,
  maxHeroHP: maxHP,
  hasTrait: (s, target, trait) =>
    (trait.toLowerCase() === "aerial" &&
      (target === "hero" || target.startsWith("hero:")) &&
      aerial(target === "hero" ? s : seatView(s, target.slice(5)))) ||
    captainPackHasTrait(s, target, trait),
  friendlyTargets: (s) => targets(s, "friendly"),
  canGiveStatus: dsPorts.canAddStatus,
  schemeTargets: (s) =>
    captainThwartBlocked(s) ? [] : targets(s, "scheme", false, true),
  cardCost: (s, p) => cardCost(s, card(p)),
  canPay: (s, cost, exclude, code) => canPay(s, cost, [], exclude, code),
  playableWithDiscount: (s, p, discount) =>
    !playable(
      {
        ...s,
        turnPlayerId: s.activePlayerId,
        flags: {
          ...s.flags,
          discount: Number(s.flags.discount || 0) + discount,
        },
      },
      p,
    ),
  playFromHand: (s, id, discount) => {
    const p = s.player.hand.find((p) => p.id === id);
    need(
      p && antPackPorts.playableWithDiscount(s, p, discount),
      "That card cannot be played now.",
    );
    const choices = allyUpgradeTargets(s, p!);
    if (choices.length && maximumAllyUpgradeDiscount(s, p!) > 0) {
      choose(
        s,
        card(p!).name,
        "Choose the ally before paying this upgrade's reduced cost.",
        choices.map((target) =>
          option(
            target.id,
            target.label,
            [E("antTeamPayment", { piece: p, discount, target: target.id })],
            undefined,
            target.code,
          ),
        ),
      );
    } else add(s, E("antTeamPayment", { piece: p, discount }));
  },
};
const waspPorts: wasp.WaspPorts = {
  ...antManPorts,
  select,
  cardCost: (s, p) => cardCost(s, card(p)),
  heroStat: (s, power) => heroStats(s)[power],
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  attackDistribution: (s, packets, options) => {
    const id = `program${s.nextId++}`;
    add(
      s,
      E("waspDistributedAttack", {
        ...options.metadata,
        packets,
        ...options,
        piercing:
          options.piercing ||
          (options.basic &&
            quicksilverPack.quicksilverPackBasicPiercing(textActiveState(s))),
        attackProgramId: id,
        title: options.basic ? "Basic attack" : undefined,
      }),
      E("attackProgramEnd", { id, attackProgramId: id }),
    );
  },
  thwartDistribution: (s, packets, metadata) => {
    const before = packets.map((p) => ({
      target: p.target,
      threat:
        p.target === "main"
          ? s.scheme.threat
          : s.sideSchemes.find((x) => x.id === p.target)?.counters || 0,
    }));
    const queuedBefore = s.queue.length;
    swPorts.thwartDistribution(s, packets);
    const responses = s.queue.splice(0, s.queue.length - queuedBefore);
    const removedAllThreat = before.some(
      (p) =>
        p.threat > 0 &&
        (p.target === "main"
          ? s.scheme.threat
          : s.sideSchemes.find((x) => x.id === p.target)?.counters || 0) === 0,
    );
    add(
      s,
      ...responses,
      ...venomPack.venomPackBasicThwartEnded(
        s,
        (metadata as Effect) || E("thwart"),
        removedAllThreat,
      ),
    );
  },
  preventDamage: (s, packet, amount) => {
    if (packet?.kind === "overkill" && s.attack)
      s.attack.identityPrevented = (s.attack.identityPrevented || 0) + amount;
    else if (packet?.damageWindowId) {
      const key = `msPrevent:${packet.damageWindowId}`;
      s.flags[key] = Number(s.flags[key] || 0) + amount;
    } else if (s.attack) s.attack.prevented += amount;
  },
  startEnemyAttack: (s, id, modifier) => {
    const p = s.minions.find((p) => p.id === id);
    if (!p) return false;
    const performed =
      !p.stunned &&
      !allInPlay(s).some(
        (a) => rulesCode(a) === "01009" && a.attachedTo === id,
      );
    enemyAttack(s, id, undefined, {
      playerId: s.activePlayerId,
      enemyId: id,
      kind: "attack",
      modifier,
    });
    return performed;
  },
  finishMinionDefeat: (s, id, source, attack, shouldShuffle) => {
    const p = s.minions.find((p) => p.id === id);
    if (!p) return;
    defeatCharacter(s, p, source, attack, true);
    if (shouldShuffle) {
      const index = s.encounter.discard.findIndex((piece) => piece.id === id);
      need(
        index >= 0,
        "The physical Beetle is missing from the encounter discard.",
      );
      s.encounter.deck.push(s.encounter.discard.splice(index, 1)[0]);
      s.encounter.deck = shuffle(s, s.encounter.deck);
    }
  },
};
const waspPackPorts: waspPack.WaspPackPorts = {
  queue: add,
  choose,
  discardPiece,
  discardHeroStatus: (s, kind) => dsPorts.removeStatus(s, "hero", kind),
  hasTrait: antPackPorts.hasTrait,
  enemyTargets: (s) => targets(s, "enemy", true),
  minionTargets: (s) =>
    targets(s, "enemy", true).filter((p) => p.id !== s.villain.id),
  schemeTargets: antPackPorts.schemeTargets,
  canGiveStatus: dsPorts.canAddStatus,
  cardCost: antPackPorts.cardCost,
  canPay: antPackPorts.canPay,
};
const quicksilverPorts: quicksilver.QuicksilverPorts = {
  ...antManPorts,
  select: (s, title, text, pieces, min, max, action) => {
    select(s, title, text, pieces, min, max, action);
    if (action.type === "qsv:siblings-discard") s.prompt!.cancelable = true;
  },
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  discardEncounterTop: mutagenPorts.discardTop,
  countBoostIcons: (s, pieces, after) =>
    add(
      s,
      ...scarletWitch.scarletWitchCountBoosts(s, pieces, after, {
        sourceTitle: "Scarlet Witch",
      }),
    ),
};
const quicksilverPackPorts: quicksilverPack.QuicksilverPackPorts = {
  queue: add,
  choose,
  discardPiece,
  hasTrait: antPackPorts.hasTrait,
  friendlyTargets: antPackPorts.friendlyTargets,
  maxHeroHP: (s, id) => maxHP(seatView(s, id)),
  cardCost: antPackPorts.cardCost,
  canPay: (s, cost, exclude, code, requirements = []) =>
    canPay(s, cost, requirements, exclude, code),
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  revealHidden,
  putAllyIntoPlay: (s, p, beforeResponses = []) => {
    need(!uniqueConflict(s, card(p)), "This unique ally is already in play.");
    Object.assign(p, resetPiece(p, true));
    s.player.inPlay.push(p);
    add(s, E("allyLimit"), ...beforeResponses, E("allyEnter", { id: p.id }));
  },
  damageDistribution: (s, packets, options) =>
    add(s, E("quicksilverDamageDistribution", { packets, ...options })),
  preventDamage: (s, amount, packet) => {
    resolve(s, E("ms:prevent-damage", { packet, amount }));
    if (
      s.attack &&
      !packet &&
      (!s.attack.defender || s.attack.defender === "none")
    ) {
      s.attack.defender = "hero";
      s.attack.basicDefense = false;
      s.attack.defense = 0;
      s.attack.targetPlayerId = s.activePlayerId;
      add(s, E("quicksilverLateDefense"));
    }
  },
  transferControl: hulkPackPorts.transferControl,
  cancelWhenRevealed: (s, p, after) => {
    const revealer =
      after.find((e) => e.type === "reveal")?.actorId || s.activePlayerId;
    const window = beginRevealWindow(
      s,
      p,
      card(p),
      revealer,
      1 + goblinWhenRevealedCopies(s),
    );
    s.revealWindows![p.id].pending = s.revealWindows![p.id].pending.filter(
      (id) => id !== "text",
    );
    log(s, `${card(p).name}: When Revealed effects canceled.`, "good");
    add(s, ...after.filter((e) => e.type !== "reveal"), ...window);
  },
};
const scarletPorts: scarletWitch.ScarletWitchPorts = {
  ...antManPorts,
  select: (s, title, text, pieces, min, max, action) => {
    select(s, title, text, pieces, min, max, action);
    if (action.type === "scw:siblings-discard") s.prompt!.cancelable = true;
  },
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  discardEncounterTop: mutagenPorts.discardTop,
  friendlyTargets: antPackPorts.friendlyTargets,
  cardCost: antPackPorts.cardCost,
  canPlayIgnoringCost: (s, p) => {
    // Requirement is an absolute play restriction, even when the resource
    // cost is ignored. Other costs before an arrow still use ordinary play.
    if (/\bRequirement\s*\(/i.test(card(p).text || "")) return false;
    // An inner Chaos Magic can choose another legal card. Remove this exact
    // prospective event from its future hand so recursive legality always
    // terminates, including two Chaos Magics with no other playable card.
    const view = {
      ...s,
      player:
        p.code === "15003"
          ? {
              ...s.player,
              hand: s.player.hand.filter((card) => card.id !== p.id),
            }
          : s.player,
      prompt: null,
      review: null,
      flags: { ...s.flags, scwIgnoreResourceCost: true },
    };
    if (
      p.code === "15012" &&
      !s.player.confused &&
      s.sideSchemes.some((piece) => card(piece).scheme_crisis)
    )
      return false;
    return !playable(view, p);
  },
  playIgnoringCost: (s, p, after) => {
    need(
      s.player.hand.some((piece) => piece.id === p.id) &&
        scarletPorts.canPlayIgnoringCost(s, p),
      "This card cannot be played by Chaos Magic.",
    );
    add(s, E("scwFreePlayRequest", { piece: p, after }));
  },
  preventDamage: (s, packet, amount) => {
    if (packet?.kind === "attack" && s.attack) s.attack.prevented += amount;
    else resolve(s, E("ms:prevent-damage", { packet, amount }));
  },
  searchEncounter: (s, code) => {
    revealHidden(s);
    let found: Piece | undefined;
    for (const pile of [s.encounter.deck, s.encounter.discard]) {
      const index = pile.findIndex((piece) => piece.code === code);
      if (index >= 0) {
        found = pile.splice(index, 1)[0];
        break;
      }
    }
    s.encounter.deck = shuffle(s, s.encounter.deck);
    return found;
  },
  putMinion: mutagenPorts.putMinion,
  cancelEncounter: bwPorts.cancelEncounter,
};
const scarletPackPorts: scarletPack.ScarletWitchPackPorts = {
  queue: add,
  choose,
  discardPiece,
  hasTrait: antPackPorts.hasTrait,
  enemyTargets: (s, attack = false) => targets(s, "enemy", attack),
  schemeTargets: (s, ignoreCrisis = false) =>
    captainThwartBlocked(s)
      ? []
      : ignoreCrisis
        ? hawkeyePorts.schemeTargets(s, true)
        : targets(s, "scheme", false, true),
  cardCost: antPackPorts.cardCost,
  canPay: (s, cost, exclude, code, requirements = []) =>
    canPay(s, cost, requirements, exclude, code),
  heroREC: (s) => heroStats(s).recover,
  discardEncounterTop: mutagenPorts.discardTop,
};
const grootPorts: groot.GrootPorts = {
  ...antManPorts,
  friendlyTargets: antPackPorts.friendlyTargets,
};
function preventNativeIdentityDamage(
  s: GameState,
  packet: Effect | undefined,
  amount: number,
) {
  if (packet?.kind === "attack" && s.attack) s.attack.prevented += amount;
  else if (packet?.kind === "overkill" && s.attack)
    s.attack.identityPrevented =
      Number(s.attack.identityPrevented || 0) + amount;
  else resolve(s, E("ms:prevent-damage", { packet, amount }));
}
const starLordPorts: starLord.StarLordPorts = {
  ...antManPorts,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  cardCost: (s, p) => cardCost(s, card(p), p),
  dealEncounter: (s) => {
    const before = new Set(s.encounter.dealt.map((p) => p.id));
    dealEncounter(s);
    return s.encounter.dealt.find((p) => !before.has(p.id));
  },
  preventDamage: preventNativeIdentityDamage,
  defeatMinion: (s, id) => {
    const p = s.minions.find((p) => p.id === id);
    need(p, "The selected minion is no longer in play.");
    defeatCharacter(s, p!, "17002");
  },
  hasTrait: captainPackHasTrait,
};
const gamoraPorts: gamora.GamoraPorts = {
  ...antManPorts,
  select,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  cardCost: (s, p) => cardCost(s, card(p), p),
  heroMaxHP: maxHP,
  preventDamage: preventNativeIdentityDamage,
  claimDefense: (s, packet) => {
    const a = s.attack;
    if (
      !a ||
      packet?.kind !== "attack" ||
      (packet.target && packet.target !== "hero")
    )
      return;
    if (!a.defender || a.defender === "none") {
      a.defender = "hero";
      a.basicDefense = false;
      a.defense = 0;
      a.targetPlayerId = s.activePlayerId;
      add(s, E("quicksilverLateDefense"));
    }
  },
};
const starLordPackPorts: starLordPack.StarLordPackPorts = {
  ...antPackPorts,
  hasTrait: captainPackHasTrait,
  discardPiece,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  minionTargets: (s) =>
    targets(s, "enemy", true).filter((t) =>
      s.minions.some((p) => p.id === t.id),
    ),
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  randomIndex: (s, length) => Math.floor(random(s) * length),
  discardEncounterTop: mutagenPorts.discardTop,
  discardPlayerTop: (s, playerId) => {
    const previous = s.activePlayerId;
    activateSeat(s, playerId);
    const p = mill(s, 1)[0];
    activateSeat(s, previous);
    return p;
  },
  attackProgram: (s, effects, after = []) =>
    bwPorts.attackProgram(s, effects, after),
  damageDistribution: quicksilverPackPorts.damageDistribution,
  threatDistribution: swPorts.thwartDistribution,
  canReady: (s, target) =>
    target === "hero"
      ? canReadyIdentity(s)
      : target.startsWith("hero:")
        ? canReadyIdentity(seatView(s, target.slice(5)))
        : !!find(s, target),
};
const gamoraPackPorts: gamoraPack.GamoraPackPorts = {
  queue: add,
  choose,
  discardPiece,
  hasTrait: captainPackHasTrait,
  attach: attachPackUpgrade,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  putMinion: mutagenPorts.putMinion,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s) => targets(s, "scheme", false, true),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, exclude, code) => canPay(s, cost, [], exclude, code),
  heroThwart: (s) => heroStats(s).thwart,
  enemyUnique: (s, target) =>
    !!card(target === s.villain.id ? s.villain : find(s, target) || "")
      .is_unique,
};
function discardNativePlayerTop(s: GameState) {
  const length = s.player.deck.length;
  return { piece: mill(s, 1)[0], emptied: length <= 1 };
}
const draxPorts: drax.DraxPorts = {
  ...antManPorts,
  identityTargets: (s) =>
    playerOrder(s)
      .filter((seat) => seatView(s, seat).player.hp < maxHP(seatView(s, seat)))
      .map((seat) => ({
        id: `hero:${seat.id}`,
        label: heroCard(seatView(s, seat)).name,
        code: heroCard(seatView(s, seat)).code,
      })),
  heroAttack: (s) => heroStats(s).attack,
  enemyAttack: (s, p) => enemyATK(s, p, s.activePlayerId),
  cardCost: (s, p) => cardCost(s, card(p), p),
  preventDamage: preventNativeIdentityDamage,
  claimDefense: gamoraPorts.claimDefense,
  removePlayerCard,
  startEnemyAttack: (s, id, modifier, after) =>
    enemyAttack(s, id, undefined, {
      enemyId: id,
      playerId: s.activePlayerId,
      kind: "attack",
      modifier,
      after: E("dvEnemyAttackComplete", { after }),
    }),
  enemyAttackCount: (s, id) => s.enemyAttackCounts?.[id] || 0,
};
const draxPackPorts: draxPack.DraxPackPorts = {
  queue: add,
  choose,
  discardPiece,
  hasTrait: captainPackHasTrait,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  minionTargets: (s) =>
    targets(s, "enemy", false).filter((t) =>
      s.minions.some((p) => p.id === t.id),
    ),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, exclude, code) => canPay(s, cost, [], exclude, code),
  discardPlayerTop: discardNativePlayerTop,
  discardEncounterTop: mutagenPorts.discardTop,
  preventDamage: (s, amount, packet) =>
    preventNativeIdentityDamage(s, packet, amount),
  removeStatus: (s, target, status) => {
    const p =
      target === "hero"
        ? s.player
        : target.startsWith("hero:")
          ? seatView(s, target.slice(5)).player
          : find(s, target);
    if (p) consumeStatus(p, status);
  },
  canGiveTough: (s, target) => dsPorts.canAddStatus(s, target, "tough"),
  returnAllyToHand: (s, id) => {
    const p = allInPlay(s).find((p) => p.id === id);
    need(p, "The defeated ally is no longer in play.");
    const owner =
      s.players.find((seat) => seat.id === p!.ownerId) || controller(s, id)!;
    discardPiece(s, id);
    const view = seatView(s, owner);
    const index = view.player.discard.findIndex((p) => p.id === id);
    need(index >= 0, "The returned physical ally is missing.");
    view.player.hand.push(
      resetPiece(view.player.discard.splice(index, 1)[0], true),
    );
  },
  minionAttackEnemy: (s, id, target) => {
    const p = s.minions.find((p) => p.id === id);
    if (!p || !find(s, target) || target === id) return;
    enemyAttack(s, id, undefined, undefined, target);
  },
  attackProgram: (s, effects, after = []) =>
    bwPorts.attackProgram(s, effects, after),
};
const venomPackPorts: venomPack.VenomPackPorts = {
  queue: add,
  choose,
  discardPiece,
  hasTrait: captainPackHasTrait,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, exclude, code) => canPay(s, cost, [], exclude, code),
  transferControl: hulkPackPorts.transferControl,
  maxHeroHP: (s, id) => maxHP(seatView(s, id)),
  canGiveTough: (s, target) => dsPorts.canAddStatus(s, target, "tough"),
};
const mtsPlayerPackPorts: mtsPlayerPack.MtsPlayerPackPorts = {
  queue: add,
  choose,
  discardPiece,
  hasTrait: captainPackHasTrait,
  characterTraits: (s, target) => {
    const id =
      target === "hero"
        ? s.activePlayerId
        : target.startsWith("hero:")
          ? target.slice(5)
          : undefined;
    if (id) {
      const view = seatView(s, id);
      return [
        ...new Set([
          ...(heroCard(view).traits || "").split(/\.\s*/).filter(Boolean),
          ...starLord.starLordHeroTraits(view),
          ...(aerial(view) ? ["Aerial"] : []),
        ]),
      ];
    }
    const p = allInPlay(s).find((p) => p.id === target);
    if (!p) return [];
    const view = controller(s, target)
      ? seatView(s, controller(s, target)!)
      : s;
    return [
      ...new Set([
        ...(card(p).traits || "").split(/\.\s*/).filter(Boolean),
        ...starLord.starLordAllyTraits(view, p),
        ...(!isTextBlank(view, p)
          ? wasp.waspAllyTraits(textActiveState(view), p)
          : []),
        ...captainPackModifiers(view, target).traits,
      ]),
    ];
  },
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  friendlyTargets: (s) => targets(s, "friendly"),
  heroAttack: (s) => heroStats(s).attack,
  allyAttack: (s, p) => allyStat(s, p, "attack"),
  maxHeroHP: maxHP,
  canReady: (s, target) =>
    target === "hero"
      ? s.player.exhausted && canReadyIdentity(s)
      : target.startsWith("hero:")
        ? seatView(s, target.slice(5)).player.exhausted &&
          canReadyIdentity(seatView(s, target.slice(5)))
        : !!find(s, target)?.exhausted,
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, exclude, code, requirements = [], handOnly = false) => {
    if (!handOnly) return canPay(s, cost, requirements, exclude, code);
    const sources = paymentSources(s, exclude, code, true);
    return paymentStatus(
      sources,
      sources.map((source) => source.id),
      cost,
      requirements,
    ).ready;
  },
  discardPlayerTop: discardNativePlayerTop,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  revealHidden,
  canPutAlly: (s, p) =>
    card(p).type_code === "ally" && !uniqueConflict(s, card(p)),
  putAllyFromDiscard: (s, id) => {
    const i = s.player.discard.findIndex((p) => p.id === id);
    if (i < 0 || uniqueConflict(s, card(s.player.discard[i]))) return;
    const [p] = s.player.discard.splice(i, 1);
    Object.assign(p, resetPiece(p, true));
    if (rulesCode(p) === "01066") p.counters = 4;
    s.player.inPlay.push(p);
    add(s, ...mtsPlayerPack.mtsPlayerPackCardEntered(s, p), E("allyLimit"));
    const enter = effectContext(
      s,
      E("allyEnter", { id: p.id, fromHand: false, eventId: undefined }),
    );
    const finish = s.queue.findIndex(
      (e) => e.type === "finishResolution" && e.id === s.currentEventId,
    );
    if (finish >= 0) s.queue.splice(finish + 1, 0, enter);
    else add(s, enter);
  },
  transferControl: hulkPackPorts.transferControl,
  shuffleResolvingIntoEncounter: (s, id) => {
    const i = s.resolving.findIndex(
      (p) => p.id === id && mtsPlayerPack.mtsIsCosmicEntity(p),
    );
    need(i >= 0, "The actual Cosmic Entity event is no longer resolving.");
    s.encounter.deck.push(...s.resolving.splice(i, 1));
    mutagenPorts.shuffleEncounter(s);
  },
  removeResolvingOwnedToRemoved: (s, id) => {
    const i = s.resolving.findIndex(
      (p) => p.id === id && mtsPlayerPack.mtsIsCosmicEntity(p),
    );
    if (i >= 0) s.removed.push(resetPiece(s.resolving.splice(i, 1)[0]));
  },
  preventAllAttackDamage: (s, packet, amount) => {
    if (s.attack && ["attack", "overkill"].includes(packet.kind))
      s.attack.preventAllDamage = true;
    else preventNativeIdentityDamage(s, packet, amount);
  },
  claimDefense: gamoraPorts.claimDefense,
};
const warlockPorts: warlock.WarlockPorts = {
  ...antManPorts,
  makePiece,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  discardHand: (s, id) => {
    discardHand(s, id);
    recyclePlayer(s);
  },
  discardPlayerCards: mill,
  heroMaxHP: maxHP,
  removeIdentityStatusCard: (s, status) => {
    const count = statusCards(s.player, status);
    if (!count) return false;
    const key =
      status === "stunned"
        ? "stunCards"
        : status === "confused"
          ? "confuseCards"
          : "toughCards";
    s.player[key] = count - 1;
    syncStatuses(s.player, heroCard(s));
    return true;
  },
  canPutAlly: (s, p) => !uniqueConflict(s, card(p)),
  putAllyFromHand: (s, id, playerId) => {
    const index = s.player.hand.findIndex(
      (p) => p.id === id && p.code === "21032",
    );
    const target = s.players.find(
      (seat) => seat.id === playerId && !seat.eliminated,
    );
    need(
      index >= 0 && target && !uniqueConflict(s, card(s.player.hand[index])),
      "Pip cannot enter play.",
    );
    const p = s.player.hand.splice(index, 1)[0];
    Object.assign(p, resetPiece(p, true));
    seatView(s, target!).player.inPlay.push(p);
    add(
      s,
      E("allyLimit", { actorId: playerId }),
      E("allyEnter", { id: p.id, actorId: playerId, fromHand: false }),
    );
  },
  canCancelTreachery: (s, p) =>
    card(p).type_code === "treachery" &&
    s.resolving.some((x) => x.id === p.id) &&
    !/cannot be cancel(?:ed|led)/i.test(card(p).text || ""),
  cancelWhenRevealed: (s, p, after, context) => {
    const c = card(p);
    const revealCard = context?.knifeSurge
      ? { ...c, text: `Surge.\n${c.text || ""}` }
      : c;
    const windows = beginRevealWindow(
      s,
      p,
      revealCard,
      context?.playerId || s.activePlayerId,
      1 + goblinWhenRevealedCopies(s),
    );
    s.revealWindows![p.id].pending = s.revealWindows![p.id].pending.filter(
      (id) => id !== "text",
    );
    log(s, `${c.name}: Cosmic Ward cancels its When Revealed effects.`, "good");
    add(s, ...after, ...windows);
  },
  findAndRevealEncounter: (s, code) => {
    const reserved = new Set(
      s.players.flatMap((seat) =>
        String(seatView(s, seat).flags.warlockReservedNemesis || "").split(","),
      ),
    );
    let found: Piece | undefined;
    for (const zone of [
      s.encounter.deck,
      s.encounter.discard,
      ...s.players.map((seat) => seatView(s, seat).player.setAside || []),
    ]) {
      const index = zone.findIndex(
        (p) => p.code === code && !reserved.has(p.id),
      );
      if (index >= 0) {
        found = zone.splice(index, 1)[0];
        break;
      }
    }
    mutagenPorts.shuffleEncounter(s);
    if (found) add(s, E("reveal", { piece: found }));
  },
  putBoostMinion: mutagenPorts.putMinion,
  revealBoostCard: (s, p) => {
    const activation = s.scheming || s.attack;
    if (activation) (activation.retainedBoostIds ||= []).push(p.id);
    removeEncounterInstance(s, p.id);
    add(s, E("reveal", { piece: p }));
  },
};
const venomPorts: venom.VenomPorts = {
  ...antManPorts,
  makePiece,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  discardPlayerTop: discardNativePlayerTop,
  cardCost: (s, p) => cardCost(s, card(p), p),
  heroMaxHP: maxHP,
  canTakeDamageCost: venomPaymentDamageCostAvailable,
  takeDamageCost: (s, amount) => {
    if (!venomPorts.canTakeDamageCost(s, amount)) return false;
    s.player.hp -= amount;
    track(s, "damageTaken", amount);
    log(s, `Take ${amount} damage as a cost.`);
    return true;
  },
  damageBatch: (s, ids, amount, source) =>
    rocketPorts.damageBatch(s, ids, amount, source),
  putMinion: mutagenPorts.putMinion,
  putBoostMinion: (s, p, playerId) => mutagenPorts.putMinion(s, p, playerId),
  cancelVillainAttack: (s, clauses) => {
    const a = s.attack;
    need(a?.isVillain, "No villain attack is pending.");
    const attacker = a!.attacker;
    s.encounter.discard.push(...(a!.pendingBoosts || []));
    for (const id of a!.boostIds || []) finishResolution(s, id);
    s.queue = s.queue.filter(
      (e) =>
        ![
          "enemyAttackInitiationWindow",
          "prepareAttackBoosts",
          "declareDefense",
          "defensePrompt",
          "boostAttack",
          "damageWindow",
          "finishAttack",
          "quicksilverLateDefense",
        ].includes(e.type),
    );
    s.attack = null;
    const response = E("defenseResponses", {
      defended: true,
      attacker,
      snapshot: {
        attacker,
        isVillain: true,
        heroDefended: true,
        basicDefense: false,
        heroDamage: 0,
        identityDamage: 0,
        playerId: s.activePlayerId,
        defender: "hero",
        originalTarget: "hero",
        damage: 0,
      },
    });
    const finish = s.queue.findIndex(
      (e) => e.type === "finishResolution" && e.id === s.currentEventId,
    );
    const completion = [
      response,
      ...(a!.activationAfter
        ? [
            {
              ...a!.activationAfter,
              performed: false,
              damagePlaced: 0,
              threatPlaced: 0,
            },
          ]
        : []),
    ];
    if (finish >= 0) s.queue.splice(finish + 1, 0, ...completion);
    else add(s, ...completion);
    add(s, ...clauses);
  },
};
const spectrumPorts: spectrum.SpectrumPorts = {
  queue: add,
  choose,
  makePiece,
  isTextBlank,
  identityTextBlank: (s) => isTextBlank(s, heroCard(s).code),
  canChangeForm: canChangeIdentityForm,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  canPay,
  cardCost: (s, p) => cardCost(s, card(p), p),
  heroMaxHP: maxHP,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwarting, ignoreCrisis = false) => {
    if (thwarting && captainThwartBlocked(s)) return [];
    const list = targets(s, "scheme", false, thwarting);
    if (
      ignoreCrisis &&
      !list.some((t) => t.id === "main") &&
      !(thwarting && engaged(s).some((p) => keyword(p, "Patrol"))) &&
      rulesCode(s.scheme) !== "01139b" &&
      s.scheme.threat > 0 &&
      !hulkThreatLocked(s, "main")
    )
      list.unshift({
        id: "main",
        label: card(s.scheme.code).name,
        code: s.scheme.code,
      });
    return list;
  },
  energyFormChanged: (s, from, to) =>
    log(s, `Change energy form from ${from || "powered down"} to ${to}.`),
  formResponseOptions: (s, after) =>
    mtsPlayerPack.mtsPlayerPackFormResponseOptions(
      s,
      after,
      mtsPlayerPackPorts,
    ),
  refreshDefense: (s) => {
    if (
      s.attack?.basicDefense &&
      s.attack.defender === "hero" &&
      s.attack.targetPlayerId === s.activePlayerId
    )
      s.attack.defense = heroStats(s).defense + (s.attack.defenseBonus || 0);
  },
  damageBatch: (s, ids, amount, source) => {
    // Interrupt/prevention windows prepare saved packet amounts before any HP
    // changes. Each physical recipient belongs to this original snapshot.
    const batchId = `spectrum-batch-${s.nextId++}`;
    const ownerId = s.activePlayerId;
    add(
      s,
      ...ids.map((target, index) =>
        E("damage", {
          target,
          amount,
          source,
          spectrumBatchId: batchId,
          spectrumBatchIndex: index,
          spectrumBatchOwnerId: ownerId,
        }),
      ),
      E("spectrumBatchCommit", { batchId, ids, amount, source, ownerId }),
    );
  },
  giveObligation: (s, p, playerId) => {
    s.resolving = s.resolving.filter((card) => card.id !== p.id);
    p.dealtTo = playerId;
    const player = seatView(s, playerId).player;
    if (!player.inPlay.some((card) => card.id === p.id)) player.inPlay.push(p);
  },
  attachIdentity: (s, p, playerId) => {
    s.resolving = s.resolving.filter((card) => card.id !== p.id);
    p.attachedTo = `hero:${playerId}`;
    if (!s.attachments.some((card) => card.id === p.id)) s.attachments.push(p);
  },
};
const rocketPorts: rocket.RocketPorts = {
  ...antManPorts,
  select,
  cardCost: antPackPorts.cardCost,
  discardEncounterTop: mutagenPorts.discardTop,
  damageBatch: (s, ids, amount, source) => {
    s.flags.waspDeferDefeats = true;
    try {
      for (const id of ids) dealDamage(s, id, amount, source);
    } finally {
      delete s.flags.waspDeferDefeats;
    }
    for (const p of s.minions.filter((p) => p.damage >= pieceHP(s, p)))
      defeatCharacter(s, p, source);
    if (s.villain.hp <= 0) advanceVillain(s);
  },
};
const gmwPorts: gmwPack.GmwPlayerPackPorts = {
  queue: add,
  choose,
  discardPiece,
  hasTrait: captainPackHasTrait,
  cardCost: antPackPorts.cardCost,
  canPay: (s, cost, exclude, code, requirements = []) =>
    canPay(s, cost, requirements, exclude, code),
  minionTargets: (s) =>
    targets(s, "enemy", true).filter((t) =>
      s.minions.some((p) => p.id === t.id),
    ),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  startingHeroHP: (s) =>
    card(HEROES.find((h) => h.id === s.heroId)!.code).health || 0,
  allyMaxHP: pieceHP,
  discardEncounterTop: mutagenPorts.discardTop,
  putMinion: mutagenPorts.putMinion,
  discardPlayerTop: (s) => mill(s, 1)[0],
  preventDamage: (s, amount, packet) => {
    if (packet?.kind === "attack" && s.attack) s.attack.prevented += amount;
    else resolve(s, E("ms:prevent-damage", { packet, amount }));
  },
  returnAllyToHand: (s, id) => {
    const p = allInPlay(s).find((p) => p.id === id);
    need(p, "The ally is no longer in play.");
    const owner =
      s.players.find((seat) => seat.id === p!.ownerId) || controller(s, id)!;
    if (s.attack?.defender === id) s.attack.gmwReturnedDefender = id;
    discardPiece(s, id);
    const view = seatView(s, owner);
    const index = view.player.discard.findIndex((p) => p.id === id);
    need(index >= 0, "The returned ally's physical card is missing.");
    view.player.hand.push(view.player.discard.splice(index, 1)[0]);
  },
  transferControl: hulkPackPorts.transferControl,
  canRemoveMainThreat: (s) =>
    s.scheme.threat > 0 &&
    !s.sideSchemes.some((p) => card(p).scheme_crisis) &&
    rulesCode(s.scheme) !== "01139b" &&
    !hulkThreatLocked(s, "main"),
  canReady: (s, target) =>
    target === "hero"
      ? canReadyIdentity(s)
      : !target.startsWith("hero:") ||
        canReadyIdentity(seatView(s, target.slice(5))),
  growthCounters: (s, target) =>
    target.startsWith("hero:")
      ? groot.grootGrowthCounters(seatView(s, target.slice(5)))
      : find(s, target)?.counters || 0,
  addGrowthCounters: (s, target, amount) => {
    if (target.startsWith("hero:"))
      groot.grootAddGrowthCounters(seatView(s, target.slice(5)), amount);
    else {
      const p = find(s, target);
      if (p) p.counters += amount;
    }
  },
  attackExcess: (s, packet) => attackExcess(s, packet),
};
export function nativeHeroAbilityOptions(s: GameState, id = "identity") {
  return [
    ...antMan.antManAbilityOptions(s, id, antManPorts),
    ...antPack.antManPackAbilityOptions(s, id, antPackPorts),
    ...wasp.waspAbilityOptions(s, id, waspPorts),
    ...quicksilver.quicksilverAbilityOptions(s, id, quicksilverPorts),
    ...scarletWitch.scarletWitchAbilityOptions(s, id, scarletPorts),
    ...rocket.rocketAbilityOptions(s, id, rocketPorts),
    ...groot.grootAbilityOptions(s, id, grootPorts),
    ...starLord.starLordAbilityOptions(s, id, starLordPorts),
    ...gamora.gamoraAbilityOptions(s, id, gamoraPorts),
    ...drax.draxAbilityOptions(s, id, draxPorts),
    ...venom.venomAbilityOptions(s, id, venomPorts),
    ...spectrum.spectrumObligationOptions(s, id, spectrumPorts),
    ...spectrum.spectrumAttachmentOptions(s, id, spectrumPorts),
    ...warlock.warlockAbilityOptions(s, id, warlockPorts),
    ...gmwPack.gmwPlayerPackAbilityOptions(s, id, gmwPorts),
    ...starLordPack.starLordPackAbilityOptions(s, id, starLordPackPorts),
    ...draxPack.draxPackAbilityOptions(s, id, draxPackPorts),
    ...venomPack.venomPackAbilityOptions(s, id, venomPackPorts),
    ...mtsPlayerPack.mtsPlayerPackAbilityOptions(s, id, mtsPlayerPackPorts),
    ...quicksilverPack.quicksilverPackAbilityOptions(
      s,
      id,
      quicksilverPackPorts,
    ),
    ...hawkeyeAbilityOptions(s, id, hawkeyePorts),
    ...spiderWomanAbilityOptions(s, id, swPorts),
  ].map(({ id, label }) => ({ id, label }));
}
export { hawkeyeStoredPlayable };

const thorPorts: ThorEnginePorts = {
  queue: add,
  choose,
  revealHidden,
  discardHand,
  discardPiece,
  mill,
  flip,
  canChangeForm: canChangeIdentityForm,
  paymentSources,
  canPay,
  shufflePlayerDeck: (s) => {
    s.player.deck = shuffle(s, s.player.deck);
  },
  returnUpgrade: (s, id) => msPorts.returnAlly(s, id),
  discardEncounterTop: mutagenPorts.discardTop,
  putMinion: mutagenPorts.putMinion,
  engageMinion: (s, id, playerId) => {
    const p = s.minions.find((p) => p.id === id);
    if (!p || p.engagedWith === playerId) return;
    const old = p.engagedWith;
    p.engagedWith = playerId;
    add(s, ...thorEngagementResponses(s, p, old, false));
  },
  identityMaxHP: (s, id) => maxHP(seatView(s, id)),
  allyPower: allyStat,
  transferControl: (s, id, playerId) =>
    hulkPackPorts.transferControl(s, id, playerId),
  log,
  aerial,
  recycleEncounter,
};
const resourcePairs: Resource[][] = [
  ["energy", "mental"],
  ["energy", "physical"],
  ["mental", "physical"],
];
const msPorts: MsMarvelPorts = {
  queue: add,
  choose,
  select,
  discardPiece,
  discardTop: (s, playerId, n) => {
    const previous = s.activePlayerId;
    activateSeat(s, playerId);
    const cards = mill(s, n);
    activateSeat(s, previous);
    return cards;
  },
  cardCost: (s, p) => cardCost(s, card(p)),
  canPay: (s, cost, exclude, target, req = []) =>
    canPay(s, cost, req, exclude, target),
  pay: (s, title, cost, req, after, p, target) =>
    requestPayment(s, title, cost, after, req, p, false, target),
  canPayDifferentTypes: (s, count, target) =>
    count === 2 &&
    resourcePairs.some((req) => canPay(s, 2, req, undefined, target)),
  payDifferentTypes: (s, title, count, after, target) => {
    need(count === 2, "Unsupported distinct resource count.");
    const pairs = resourcePairs.filter((req) =>
      canPay(s, 2, req, undefined, target),
    );
    need(pairs.length, "Two different resource types are required.");
    const effects = (req: Resource[]) => [
      E("payRequest", {
        title,
        cost: 2,
        requirements: req,
        after,
        targetCode: target,
      }),
    ];
    if (pairs.length === 1) add(s, ...effects(pairs[0]));
    else
      choose(
        s,
        title,
        "Choose the two resource types to spend.",
        pairs.map((req) =>
          option(req.join("+"), req.join(" + "), effects(req)),
        ),
      );
  },
  transferControl: (s, id, playerId) => {
    const old = controller(s, id),
      target = s.players.find(
        (seat) => seat.id === playerId && !seat.eliminated,
      );
    need(old && target, "Upgrade recipient is unavailable.");
    const oldView = seatView(s, old!),
      targetView = seatView(s, target!);
    const oldMax = maxHP(oldView),
      newMax = maxHP(targetView);
    hulkPackPorts.transferControl(s, id, playerId);
    oldView.player.hp += maxHP(oldView) - oldMax;
    targetView.player.hp += maxHP(targetView) - newMax;
  },
  returnEvent: (s, id) => {
    const p =
      s.resolving.find((p) => p.id === id) ||
      s.players
        .flatMap((seat) => seatView(s, seat).player.discard)
        .find((p) => p.id === id);
    need(p, "The played event is no longer available.");
    s.resolving = s.resolving.filter((p) => p.id !== id);
    const owner = s.players.find((seat) => seat.id === p!.ownerId);
    need(
      owner && !owner.eliminated,
      "The event owner is no longer in the mission.",
    );
    const view = seatView(s, owner!);
    view.player.discard = view.player.discard.filter((p) => p.id !== id);
    view.player.hand.push(resetPiece(p!));
  },
  returnAlly: (s, id) => {
    const p = find(s, id);
    need(p, "The ally is no longer in play.");
    const owner = s.players.find((seat) => seat.id === p!.ownerId);
    need(
      owner && !owner.eliminated,
      "The ally owner is no longer in the mission.",
    );
    discardPiece(s, id);
    const view = seatView(s, owner!);
    const index = view.player.discard.findIndex((p) => p.id === id);
    need(index >= 0, "The ally could not be returned.");
    view.player.hand.push(view.player.discard.splice(index, 1)[0]);
  },
  cancelBoost: (s, id) => {
    const a = s.attack,
      p = s.resolving.find((p) => p.id === id);
    need(a && p, "The boost card is no longer resolving.");
    const amount = bwPorts.cancelBoostIcons(s, id);
    if (!a!.defender || a!.defender === "none") {
      a!.defender = "hero";
      a!.basicDefense = false;
      a!.defense = 0;
      add(s, E("quicksilverLateDefense"));
    }
    a!.targetPlayerId = s.activePlayerId;
    return amount;
  },
  flip,
};
const goblinPorts: GoblinModuleEnginePorts = { ...mutagenPorts, discardHand };
const riskyPorts: RiskyBusinessEnginePorts = {
  queue: add,
  choose,
  putEnvironment: (s, code, counters) => {
    const p = makePiece(s, code);
    p.counters = counters;
    (s.environments ||= []).push(p);
    return p;
  },
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  discardPlayerCards: (s, playerId, n) => {
    const previous = s.activePlayerId;
    activateSeat(s, playerId);
    mill(s, n);
    activateSeat(s, previous);
  },
  giveBoost: mutagenPorts.giveBoost,
  activate: mutagenPorts.activate,
};
function minionWillEnter(s: GameState, p: Piece) {
  gamora.gamoraMinionWillEnter(s, p, gamoraPorts);
}
function minionEntered(s: GameState, p: Piece) {
  minionWillEnter(s, p);
  if (uniqueConflict(s, card(p), p.id)) {
    discardPiece(s, p.id);
    s.resolving = s.resolving.filter((x) => x.id !== p.id);
    return;
  }
  const underlying = p.droneCard;
  Object.assign(p, resetPiece(p, true));
  if (underlying) p.droneCard = underlying;
  p.engagedWith = s.activePlayerId;
  s.resolving = s.resolving.filter((x) => x.id !== p.id);
  log(
    s,
    `${card(p).name} engages ${HEROES.find((h) => h.id === s.heroId)!.name}.`,
    "bad",
  );
  add(s, E("minionReactions", { id: p.id }), ...thorEngagementResponses(s, p));
}
function minionResponses(s: GameState, p: Piece) {
  add(s, ...waspPack.waspPackMinionEngaged(s, p));
  add(s, E("bwEntryResponses", { id: p.id }));
  const hawk = allInPlay(s).find(
    (x) => rulesCode(x) === "01066" && x.counters > 0,
  );
  if (hawk)
    add(
      s,
      E("optional", {
        actorId: controller(s, hawk.id)?.id,
        title: "Hawkeye",
        text: `Spend an arrow to deal 2 damage to ${card(p).name}?`,
        effects: [
          E("counter", { id: hawk.id, amount: -1 }),
          E("damage", { target: p.id, amount: 2, source: hawk.id }),
        ],
      }),
    );
}
function enemyAttack(
  s: GameState,
  id: string,
  extra?: string,
  activation?: MutagenActivation,
  originalTarget?: string,
) {
  const canceled = () => {
    if (activation?.after)
      add(s, {
        ...activation.after,
        performed: false,
        damagePlaced: 0,
        threatPlaced: 0,
      });
  };
  const p = find(s, id);
  if (!p) {
    canceled();
    return;
  }
  if (p.stunned) {
    consumeStatus(p, "stunned");
    log(s, `${card(p).name} loses stunned instead of attacking.`);
    canceled();
    return;
  }
  const web = allInPlay(s).find(
    (a) => rulesCode(a) === "01009" && a.attachedTo === id,
  );
  if (web) {
    discardPiece(s, web.id);
    giveCharacterStatus(s, p, "stunned");
    log(
      s,
      `Webbed Up prevents ${card(p).name}'s attack and stuns them.`,
      "good",
    );
    canceled();
    return;
  }
  const replacement = riskyActivationReplacement(s, "attack", id);
  if (replacement) {
    add(s, ...replacement);
    canceled();
    return;
  }
  const isVillain = id === s.villain.id;
  if (isVillain && s.heroId === "spider_man" && s.player.form === "hero")
    draw(s, 1);
  const base = enemyATK(s, p, s.activePlayerId);
  log(
    s,
    `${card(p).name} attacks ${originalTarget && find(s, originalTarget) ? card(find(s, originalTarget)!).name : heroCard(s).name}: ${base} base ATK${isVillain ? " before boost cards" : ""}.`,
    "bad",
  );
  s.flags.attacksPerformed = Number(s.flags.attacksPerformed || 0) + 1;
  s.attack = {
    targetPlayerId: s.activePlayerId,
    originalPlayerId: s.activePlayerId,
    originalTarget,
    attacker: id,
    isVillain,
    base,
    boostCodes: [],
    boostIds: [],
    boostEffects: [],
    defense: 0,
    prevented: 0,
    damage: 0,
    overkill: isVillain && !!villainAt(s, "01099").length,
    extra,
    modifier: activation?.modifier || 0,
    omitNormalBoost: activation?.omitNormalBoost,
    activationAfter: activation?.after,
    attackerSnapshot: structuredClone(p),
  };
  if (rulesCode(p) === "01130" && extra !== "whirlwind")
    add(
      s,
      ...playerOrder(s)
        .filter(
          (seat) =>
            seat.id !== s.activePlayerId &&
            seatView(s, seat).player.form === "hero",
        )
        .map((seat) =>
          E("enemyAttack", { id, extra: "whirlwind", actorId: seat.id }),
        ),
    );
  add(s, E("prepareAttackBoosts"), E("declareDefense"));
  add(
    s,
    E("enemyAttackInitiationWindow", {
      attacker: id,
      playerId: s.activePlayerId,
      isVillain,
      modifier: s.attack.modifier || 0,
      usedIds: [],
    }),
  );
  // Forced entry and its responses precede every optional initiation interrupt.
  if (isVillain && rulesCode(s.villain) === "01135") add(s, E("drone"));
  const forced = doctorStrangeEnemyAttackInitiated(s, p);
  if (forced.length) {
    if (s.prompt) {
      add(s, E("resumePrompt", { prompt: s.prompt }));
      s.prompt = null;
    }
    add(s, ...forced);
  }
}
function enemyATK(s: GameState, p: Piece, originalPlayerId: string): number {
  if (riskyBlankPower(s, "attack", p.id)) return 0;
  const bonus = (p.bonusAtk || 0) + mutagenAttackModifiers(s, p).goblinNation;
  const attachments = s.attachments
    .filter((a) => a.attachedTo === p.id)
    .reduce((n, a) => n + (card(a).attack || 0), 0);
  const base =
    p.id === s.villain.id
      ? (card(p).attack || 0) +
        (rulesCode(p) === "01135"
          ? engaged(s, originalPlayerId).filter((m) =>
              card(m).traits?.includes("Drone."),
            ).length
          : 0)
      : p.code === "drone"
        ? pieceHP(s, p)
        : rulesCode(p) === "01162"
          ? pieceHP(s, p) - p.damage
          : (card(p).attack || 0) +
            (rulesCode(s.villain) === "01136" &&
            card(p).traits?.includes("Drone.")
              ? 1
              : 0);
  return (
    base +
    bonus +
    attachments +
    blackWidowEnemyModifier(s, p, originalPlayerId) +
    rocket.rocketEnemyStats(s, p).attack +
    drax.draxEnemyStats(s, p).attack +
    antMan.antManEnemyStats(s, p).attack -
    s.attachments
      .filter((a) => a.code === "12028" && a.attachedTo === p.id)
      .reduce((n, a) => n + (card(a).attack || 0), 0)
  );
}
function abortAttack(s: GameState) {
  const a = s.attack;
  if (!a) return;
  s.encounter.discard.push(...(a.pendingBoosts || []));
  for (const id of a.boostIds || []) finishResolution(s, id);
  add(
    s,
    ...antMan.antManEnemyActivated(s, a.attacker),
    ...(a.afterActivation || []),
    ...(a.basicDefense
      ? [
          E("quicksilverBasicUsed", {
            power: "defense",
            actorId: a.targetPlayerId || s.activePlayerId,
          }),
        ]
      : []),
    ...(a.activationAfter
      ? [
          {
            ...a.activationAfter,
            performed: true,
            attackedPlayerId: a.targetPlayerId || s.activePlayerId,
            damagePlaced: 0,
            threatPlaced: 0,
          },
        ]
      : []),
  );
  s.attack = null;
}
function prepareAttackBoosts(s: GameState) {
  const a = s.attack;
  if (!a || a.pendingBoosts) return;
  a.pendingBoosts = [];
  const attacker = find(s, a.attacker);
  if (!attacker) {
    abortAttack(s);
    return;
  }
  const normal = a.omitNormalBoost
    ? 0
    : a.isVillain
      ? s.villainId === "klaw"
        ? 2
        : 1
      : attacker && keyword(attacker, "Villainous")
        ? 1
        : 0;
  if (a.isVillain)
    a.pendingBoosts.push(...(s.encounter.storedBoosts || []).splice(0));
  const n = a.omitNormalBoost
    ? 0
    : normal + mutagenAdditionalBoosts(s, a.attacker);
  for (let i = 0; i < n; i++) {
    const p = drawEncounter(s);
    if (p) a.pendingBoosts.push(p);
  }
}
/** Only an enemy recipient uses redirected outgoing attack resolution.
 * Clash can target a friendly ally and retains ordinary defense/after-you
 * windows. Keep classification stable if an enemy recipient has left play. */
function attackTargetsEnemy(
  s: GameState,
  a: NonNullable<GameState["attack"]>,
): a is NonNullable<GameState["attack"]> & { originalTarget: string } {
  const id = a.originalTarget;
  if (!id || id === "hero" || id.startsWith("hero:")) return false;
  if (id === s.villain.id) return true;
  const p =
    find(s, id) ||
    [...s.encounter.discard, ...s.resolving, ...s.removed].find(
      (p) => p.id === id,
    );
  return !!p && ["minion", "villain"].includes(card(p).type_code);
}
function declareDefense(s: GameState) {
  const a = s.attack;
  if (!a) return;
  const p = find(s, a.attacker);
  if (!p) {
    abortAttack(s);
    return;
  }
  if (attackTargetsEnemy(s, a)) {
    a.defender = "none";
    a.basicDefense = false;
    a.defense = 0;
    add(s, E("boostAttack"));
    return;
  }
  const base =
    enemyATK(s, p, a.originalPlayerId || s.activePlayerId) + (a.modifier || 0);
  a.base = base;
  const opts: Option[] = [
    option(
      "take",
      "Take the attack",
      [E("defender", { id: "none" }), E("boostAttack")],
      "Keep your characters ready.",
    ),
  ];
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    if (view.player.form === "hero" && !view.player.exhausted)
      opts.push(
        option(
          seat.id === s.activePlayerId ? "hero" : `hero:${seat.id}`,
          `Defend with ${heroCard(view).name} · ${heroStats(view).defense} DEF`,
          [
            E("defender", { id: "hero", actorId: seat.id }),
            E("boostAttack", { actorId: seat.id }),
          ],
          "Exhaust this hero; this hero becomes the attack's target.",
          heroCard(view).code,
        ),
      );
    for (const ally of friends(view).filter((p) => !p.exhausted))
      opts.push(
        option(
          ally.id,
          `Defend with ${card(ally).name}`,
          [
            E("defender", { id: ally.id, actorId: seat.id }),
            E("boostAttack", { actorId: seat.id }),
          ],
          `${HEROES.find((h) => h.id === seat.heroId)!.name} · ${pieceHP(s, ally) - ally.damage} hit points`,
          ally.code,
        ),
      );
  }
  const allowed =
    rulesCode(p) === "01132" && friends(s).some((p) => !p.exhausted)
      ? opts.filter((o) => o.id !== "take" && !o.id.startsWith("hero"))
      : opts;
  // Hawkeye's optional window must resolve before declaring a defender.
  add(
    s,
    E("defensePrompt", {
      options: allowed,
      name: card(p).name,
      base,
      isVillain: a.isVillain,
    }),
  );
}
function boostEffects(s: GameState, p: Piece) {
  const rise =
    starLord.starLordBoost(s, p) ??
    gamora.gamoraBoost(s, p) ??
    drax.draxBoost(s, p) ??
    venom.venomBoost(s, p) ??
    spectrum.spectrumBoost(s, p) ??
    warlock.warlockBoost(s, p) ??
    mtsPlayerPack.mtsPlayerPackBoost(s, p) ??
    rocket.rocketBoost(s, p) ??
    groot.grootBoost(s, p) ??
    scarletWitch.scarletWitchBoost(s, p) ??
    quicksilver.quicksilverBoost(s, p) ??
    hawkeyeBoost(s, p) ??
    spiderWomanBoost(s, p);
  if (rise !== null) {
    add(s, ...rise);
    return;
  }
  const bw = blackWidowBoost(s, p);
  if (bw !== null) {
    add(s, ...bw);
    return;
  }
  const goblinModule = goblinModuleBoost(s, p, s.activePlayerId);
  if (goblinModule !== null) {
    add(s, ...goblinModule);
    return;
  }
  const thor = thorBoost(s, p);
  if (thor !== null) {
    add(s, ...thor);
    return;
  }
  const risky = riskyBoost(s, p);
  if (risky !== null) {
    add(s, ...risky);
    return;
  }
  const activation = s.scheming || s.attack;
  if (activation) {
    const module = mutagenBoost(s, p, {
      attackerId: activation.attacker,
      playerId: s.activePlayerId,
    });
    if (module) {
      activation.extraBoostIcons =
        (activation.extraBoostIcons || 0) + module.extraIcons;
      (activation.afterActivation ||= []).push(...module.afterActivation);

      add(s, ...module.effects);
      return;
    }
  }
  const code = rulesCode(p);
  switch (code) {
    case "01121":
      s.encounter.discard = s.encounter.discard.filter((x) => x.id !== p.id);
      s.minions.push(p);
      minionEntered(s, p);
      break;
    case "01129":
      randomDiscard(s);
      break;
    case "01130":
      add(
        s,
        ...playerOrder(s)
          .filter((p) => seatView(s, p).player.form === "hero")
          .map((p) =>
            E("damage", {
              actorId: p.id,
              target: "hero",
              amount: 1,
              source: "boost",
            }),
          ),
      );
      break;
    case "01131":
    case "01158":
      giveCharacterStatus(s, s.villain, "tough");
      break;
    case "01132":
      friends(s).forEach((p) => (p.exhausted = true));
      break;
    case "01144a":
    case "01144b":
    case "01144c": {
      const resource = code.endsWith("a")
        ? "energy"
        : code.endsWith("b")
          ? "mental"
          : "physical";
      add(s, E("boostDroneChoice", { resource }));
      break;
    }
    case "01146":
      heal(
        s,
        s.villain.id,
        engaged(s).filter((p) => card(p).traits?.includes("Drone.")).length,
      );
      break;
    case "01154":
      add(
        s,
        ...targets(s, "controlled").map((t) =>
          E("damage", { target: t.id, amount: 1, source: "boost" }),
        ),
      );
      break;
    case "01164":
      if (s.scheming || s.attack) {
        const boost = drawEncounter(s);
        if (boost) {
          if (s.scheming) s.scheming.pendingBoosts.push(boost);
          else if (s.attack!.pendingBoosts) s.attack!.pendingBoosts.push(boost);
          else add(s, E("legacyBoost", { piece: boost }));
        }
      }
      break;
    case "01123":
    case "01168":
      if (s.attack) s.attack.boostEffects.push(E("afterBoost", { code }));
      break;
    case "01173":
      if (s.attack?.defender === "none")
        add(s, E("chooseDiscard", { filter: "upgrade" }));
      break;
    case "01178":
      if (s.attack?.defender === "none")
        add(s, E("threat", { target: "main", amount: 1 }));
      break;
  }
}
function enemyScheme(
  s: GameState,
  id: string,
  extra?: string,
  request?: MutagenActivation,
) {
  const p = find(s, id);
  if (!p) return;
  if (p.confused) {
    consumeStatus(p, "confused");
    log(s, `${card(p).name} loses confused instead of scheming.`);
    if (request?.after)
      add(s, {
        ...request.after,
        performed: false,
        damagePlaced: 0,
        threatPlaced: 0,
      });
    return;
  }
  const replacement = riskyActivationReplacement(s, "scheme", id);
  if (replacement) {
    add(
      s,
      ...replacement,
      ...(request?.after
        ? [
            {
              ...request.after,
              performed: false,
              damagePlaced: 0,
              threatPlaced: 0,
            },
          ]
        : []),
    );
    return;
  }
  const pendingBoosts: Piece[] = [];
  if (id === s.villain.id)
    pendingBoosts.push(...(s.encounter.storedBoosts || []).splice(0));
  const normal = request?.omitNormalBoost
    ? 0
    : id === s.villain.id || keyword(p, "Villainous")
      ? 1
      : 0;
  const n = request?.omitNormalBoost
    ? 0
    : normal + mutagenAdditionalBoosts(s, id);
  for (let i = 0; i < n; i++) {
    const boost = drawEncounter(s);
    if (boost) pendingBoosts.push(boost);
  }
  s.scheming = {
    attacker: id,
    boostCodes: [],
    boostIds: [],
    pendingBoosts,
    extra,
    modifier: request?.modifier || 0,
    activationAfter: request?.after,
  };
  add(s, E(pendingBoosts.length ? "revealSchemeBoost" : "finishScheme"));
}
function finishScheme(s: GameState) {
  const activation = s.scheming;
  if (!activation) return;
  const { attacker: id, extra } = activation;
  const p = find(s, id);
  if (!p) return;
  const amount =
    (riskyBlankPower(s, "scheme", p.id)
      ? 0
      : (card(p).scheme || 0) +
        (activation.modifier || 0) +
        (activation.extraBoostIcons || 0) +
        blackWidowEnemyModifier(s, p, s.activePlayerId) +
        s.attachments
          .filter((a) => a.attachedTo === id)
          .reduce((n, a) => n + (card(a).scheme || 0), 0)) +
    activation.boostCodes.reduce(
      (n, code, index) =>
        n + activationBoostValue(s, activation.boostIds[index], code),
      0,
    );
  log(s, `${card(p).name} schemes for ${amount} threat.`, "bad");
  activation.threatBefore = s.stats?.threatPlaced || 0;
  const after = [
    E("threat", { target: "main", amount }),
    ...(extra === "rage" ? [E("mill", { amount })] : []),
    ...(id === s.villain.id && villainAt(s, "01141").length
      ? s.sideSchemes.map((p) => E("threat", { target: p.id, amount: 1 }))
      : []),
    ...(rulesCode(p) === "01181"
      ? s.sideSchemes
          .filter((p) => rulesCode(p) === "01180")
          .map((p) => E("threat", { target: p.id, amount: 2 }))
      : []),
    ...antMan.antManEnemyActivated(s, id),
    ...spectrum.spectrumEnemyActivated(s, p, s.activePlayerId, spectrumPorts),
    ...(activation.afterActivation || []),
    ...activation.boostIds.map((id) => E("finishResolution", { id })),
    E("scarletEnemyActivated", { id }),
    E("bwMinionSchemeResponses", { id }),
    E("endScheme"),
  ];
  schemeWindow(s, id, amount, after);
}
function calculateAttack(s: GameState) {
  const a = s.attack;
  if (!a) return;
  const attacker = find(s, a.attacker);
  if (attacker)
    a.base =
      enemyATK(
        s,
        attacker,
        a.originalPlayerId || a.targetPlayerId || s.activePlayerId,
      ) +
      (a.modifier || 0) +
      (a.extraBoostIcons || 0) +
      a.boostCodes.reduce(
        (n, code, index) =>
          n + activationBoostValue(s, a.boostIds?.[index] || "", code),
        0,
      );
  if (
    a.defender &&
    !["none", "hero"].includes(a.defender) &&
    !find(s, a.defender)
  ) {
    a.defender = "none";
    a.basicDefense = false;
    log(
      s,
      `The ally defender left play. ${heroCard(s).name} is now the attack target.`,
      "bad",
    );
  }
  if (a.basicDefense) a.defense = heroStats(s).defense + (a.defenseBonus || 0);
}
function schemeWindow(
  s: GameState,
  id: string,
  amount: number,
  after: Effect[],
) {
  const original = s.activePlayerId;
  const follow = after.map((e) => ({ actorId: original, ...e }));
  const opts: Option[] = [];
  if (id === s.villain.id)
    for (const seat of playerOrder(s)) {
      const emergency = seatView(s, seat).player.hand.find(
        (p) => rulesCode(p) === "01085",
      );
      if (emergency)
        opts.push(
          option(
            seat.id === original ? "reduce" : `reduce:${seat.id}`,
            `Play Emergency${s.playerCount > 1 ? ` · ${heroCard(seatView(s, seat)).name}` : ""}`,
            [
              E("resolveHandEvent", {
                actorId: seat.id,
                id: emergency.id,
                after: [E("emergency", { amount, after: follow })],
              }),
            ],
          ),
        );
    }
  if (opts.length)
    choose(s, "Emergency", `The villain will place ${amount} threat.`, [
      ...opts,
      option("allow", "Let the scheme resolve", follow),
    ]);
  else add(s, ...follow);
}
function finishAttack(s: GameState, effect: Effect = E("finishAttack")) {
  const a = s.attack!;
  if (!a) return;
  const p = find(s, a.attacker);
  if (attackTargetsEnemy(s, a)) {
    // A redirected enemy attack uses native outgoing attack damage. This keeps
    // Tough, Vibration Resistance, Piercing, Overkill and one Retaliate window,
    // while no player is attacked or given a hero defense response.
    if (!p || !find(s, a.originalTarget)) {
      abortAttack(s);
      return;
    }
    add(s, E("enemyTargetAttackComplete", { snapshot: a }));
    if (!a.completionRecorded) {
      s.enemyAttackCounts ||= {};
      s.enemyAttackCounts[a.attacker] =
        Number(s.enemyAttackCounts[a.attacker] || 0) + 1;
      a.completionRecorded = true;
    }
    const result = attackAction(
      s,
      a.originalTarget,
      Math.max(0, a.base - a.defense - a.prevented),
      a.attacker,
      !!a.overkill || !!sourceKeyword(s, a.attacker, "Overkill"),
      false,
      {
        initiated: true,
        piercing: !!a.piercing || !!sourceKeyword(s, a.attacker, "Piercing"),
        ranged: !!sourceKeyword(s, a.attacker, "Ranged"),
      },
    );
    a.damage = result?.actualDamage || 0;
    a.damagePlaced = a.damage;
    a.identityDamage = 0;
    return;
  }
  const target =
    a.defender && a.defender !== "none"
      ? a.defender
      : a.originalTarget || "hero";
  const visualAttacker = combatCharacter(s, a.attacker);
  const visualTarget = combatCharacter(s, target);
  const damage =
    a.gmwReturnedDefender === target || a.preventAllDamage
      ? 0
      : Math.max(0, a.base - a.defense - a.prevented);
  const before =
    target === "hero"
      ? s.player.hp
      : find(s, target)
        ? pieceHP(s, find(s, target)!) - find(s, target)!.damage
        : 0;
  const receiving = target === "hero" ? s.player : find(s, target);
  if (receiving)
    discardToughForPiercing(
      receiving,
      damage,
      !!sourceKeyword(s, a.attacker, "Piercing"),
    );
  const wasTough = receiving?.tough;
  if (receiving && target !== "hero" && !effect.gmwStarhawkHandled) {
    const continuation = { ...effect, gmwStarhawkHandled: true };
    const options = gmwPack.gmwPlayerPackStarhawkDamageOptions(
      s,
      receiving as Piece,
      damage,
      [continuation],
      gmwPorts,
    );
    if (options.length) {
      choose(
        s,
        "Starhawk",
        "Return Starhawk before this exact attack damage packet?",
        [...options, option("allow", `Take ${damage} damage`, [continuation])],
      );
      return;
    }
  }
  log(
    s,
    `${a.base} ATK − ${a.defense} DEF − ${Math.min(a.prevented, Math.max(0, a.base - a.defense))} prevented = ${damage} incoming damage to ${target === "hero" ? heroCard(s).name : find(s, target) ? card(find(s, target)!).name : "the defender"}.`,
    "bad",
  );
  const recipientId = s.activePlayerId;
  const identityBefore = seatView(s, recipientId).player.hp;
  if (p && !a.completionRecorded) {
    s.enemyAttackCounts ||= {};
    s.enemyAttackCounts[a.attacker] =
      Number(s.enemyAttackCounts[a.attacker] || 0) + 1;
    a.completionRecorded = true;
  }
  const result = dealDamage(
    s,
    target,
    damage,
    a.attacker,
    false,
    false,
    false,
    {
      grootHandled: !!a.grootDamageHandled,
      enemyAttack: true,
      damageDealt: Math.max(0, a.base - a.defense),
    },
  );
  a.damage = result.actualDamage;
  if (a.overkill && target !== "hero" && damage > before && !wasTough)
    dealDamage(
      s,
      "hero",
      Math.max(0, damage - before - (a.identityPrevented || 0)),
      a.attacker,
      false,
      false,
      false,
      {
        grootHandled: !!a.grootOverkillHandled,
        enemyAttack: true,
        damageDealt: Math.max(0, damage - before),
        damageFromAttack: true,
        overkillDamage: true,
      },
    );
  a.identityDamage = Math.max(
    0,
    identityBefore - seatView(s, recipientId).player.hp,
  );
  a.damagePlaced = a.damage + (target === "hero" ? 0 : a.identityDamage);
  recordCombat(s, visualAttacker, visualTarget, target, true);
  if (s.phase === "lost" || s.phase === "won") return;
  const retaliation =
    !sourceKeyword(s, a.attacker, "Ranged") &&
    ((target === "hero" && s.player.hp > 0 && s.player.form === "hero") ||
      (target !== "hero" && !!find(s, target)))
      ? target === "hero"
        ? sourceKeyword(s, "hero", "Retaliate")
        : printedKeyword(card(find(s, target)!), "Retaliate")
      : 0;
  if (a.isVillain) {
    for (const c of [...villainAt(s, "01099")]) discardPiece(s, c.id);
    if (rulesCode(s.villain) === "01134")
      add(s, E("ultronChoice", { amount: 1 }));
    if (
      (a.extra === "stampede" || villainAt(s, "01118").length) &&
      a.damage > 0
    ) {
      const x = target === "hero" ? s.player : find(s, target);
      if (x) giveCharacterStatus(s, x, "stunned");
    }
    if (a.extra === "vengeance" && a.damage > 0)
      add(s, E("threat", { target: "main", amount: 1 }));
    if (a.extra === "rage") mill(s, a.damage);
  }
  if (rulesCode(p) === "01129") randomDiscard(s);
  if (p && rulesCode(p) === "01131") giveCharacterStatus(s, p, "tough");
  if (rulesCode(p) === "01177")
    add(
      s,
      ...s.sideSchemes
        .filter((p) => rulesCode(p) === "01176")
        .map((p) => E("threat", { target: p.id, amount: 1 })),
    );
  if (rulesCode(p) === "01181")
    add(
      s,
      ...s.sideSchemes
        .filter((p) => rulesCode(p) === "01180")
        .map((p) => E("threat", { target: p.id, amount: 2 })),
    );
  add(
    s,
    ...antMan.antManEnemyActivated(s, a.attacker),
    ...(a.afterActivation || []),
    ...(a.damage > 0
      ? [
          E("dvAttackDamageResponse", {
            snapshot: {
              target: target === "hero" ? `hero:${recipientId}` : target,
              actualDamage: a.damage,
              attack: true,
            },
          }),
        ]
      : []),
    ...(target !== "hero" && a.identityDamage
      ? [
          E("dvAttackDamageResponse", {
            snapshot: {
              target: `hero:${recipientId}`,
              actualDamage: a.identityDamage,
              attack: true,
            },
          }),
        ]
      : []),
    E("forcedResponses", {
      responses: [
        ...(p &&
        spectrum.spectrumEnemyActivated(s, p, recipientId, spectrumPorts).length
          ? [
              {
                id: `${p.id}:spectrum-activation`,
                sourceId: p.id,
                title: "Radioactive Man",
                effects: spectrum.spectrumEnemyActivated(
                  s,
                  p,
                  recipientId,
                  spectrumPorts,
                ),
              },
            ]
          : []),
        ...goblinModuleAttackResponses(s, {
          attacker: a.attackerSnapshot || p!,
          playerId: recipientId,
          performed: true,
          identityDamage: a.identityDamage || 0,
          damaged: [
            ...(target !== "hero" && a.damage > 0
              ? [
                  {
                    target,
                    playerId: recipientId,
                    amount: Math.min(a.damage, before),
                  },
                ]
              : []),
            ...(a.identityDamage
              ? [
                  {
                    target: `hero:${recipientId}`,
                    playerId: recipientId,
                    amount: a.identityDamage,
                  },
                ]
              : []),
          ],
        }),
        ...mutagenAttackResponses(s, {
          attacker: a.attackerSnapshot || p!,
          playerId: s.activePlayerId,
          performed: true,
          identityDamage: a.identityDamage || 0,
        }),
        ...(retaliation
          ? [
              {
                id: "retaliate",
                sourceId: target === "hero" ? undefined : target,
                title: "Retaliate",
                effects: [
                  E("retaliateAfterAttack", {
                    target: a.attacker,
                    sourceTarget: target,
                    amount: retaliation,
                    actorId: s.activePlayerId,
                  }),
                ],
              },
            ]
          : []),
        ...(p && hulkAfterEnemyAttack(s, p).length
          ? [
              {
                id: "hulk-forced",
                sourceId: p.id,
                title: card(p).name,
                effects: hulkAfterEnemyAttack(s, p),
              },
            ]
          : []),
      ].map((r) => ({
        ...r,
        effects: r.effects.map((e) => ({ actorId: s.activePlayerId, ...e })),
      })),
      actorId: s.firstPlayerId,
    }),
    ...a.boostEffects,
    ...(a.boostIds || []).map((id) => E("finishResolution", { id })),
    E("scarletEnemyActivated", {
      id: a.attacker,
      actorId: a.originalPlayerId || recipientId,
    }),
    E("defenseResponses", {
      defended: target === "hero" && a.defender !== "none",
      attacker: a.attacker,
      snapshot: {
        attacker: a.attacker,
        attackerCode: a.attackerSnapshot?.code || p?.code,
        attackerStage: a.isVillain
          ? (a.attackerSnapshot as GameState["villain"] | undefined)?.stage
          : undefined,
        isVillain: a.isVillain,
        playerId: recipientId,
        identityAttacked: target === "hero",
        defender: target,
        heroDamage: a.identityDamage || 0,
        heroDefended: target === "hero" && a.defender !== "none",
        basicDefense: !!a.basicDefense,
        neverBackDownCount:
          (a as typeof a & { neverBackDownCount?: number })
            .neverBackDownCount || 0,
      },
    }),
    ...(a.activationAfter
      ? [
          {
            ...a.activationAfter,
            performed: true,
            attackedPlayerId: recipientId,
            damagePlaced: a.damagePlaced || 0,
            threatPlaced: 0,
          },
        ]
      : []),
  );
}
function affordable(
  s: GameState,
  cost: number,
  req: Resource[] = [],
  exclude?: string,
) {
  const handCard = s.player.hand.find((p) => p.id === exclude);
  return canPay(s, cost, req, exclude, handCard?.code);
}
function reveal(
  s: GameState,
  p: Piece,
  skip = false,
  repeat = false,
  fromEncounterDeck = false,
  savedKnifeSurge?: number,
) {
  if (!repeat && card(p).type_code === "obligation") {
    const owner = s.players.find(
      (seat) => seat.heroId === card(p).set_code && !seat.eliminated,
    );
    if (owner) activateSeat(s, owner.id);
  }
  // A canceled treachery is still revealed. Save Knife's modifier before the
  // interrupt window so its first-card limit is consumed exactly once.
  const knifeSurge = repeat
    ? 0
    : (savedKnifeSurge ?? starLord.starLordTreacherySurge(s, p));
  if (!repeat) beginResolution(s, p);
  s.lastEncounter = p.code;
  log(s, `${skip ? "Resolve" : "Encounter"}: ${card(p).name}.`, "bad");
  if (!skip) {
    const forced = warlock.warlockForcedTreacheryInterrupt(s, p, warlockPorts, {
      playerId: s.activePlayerId,
      knifeSurge,
    });
    if (forced) {
      add(s, ...forced);
      return;
    }
    const opts: Option[] = [];
    const revealing = s.activePlayerId;
    for (const seat of playerOrder(s))
      opts.push(
        ...doctorStrangeTreacheryOptions(seatView(s, seat), p, dsPorts).map(
          (o) => ({
            ...o,
            id: `${seat.id}:${o.id}`,
            effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
          }),
        ),
      );
    opts.push(
      ...blackWidowRevealOptions(s, p, revealing, [
        E("reveal", {
          piece: p,
          skip: true,
          actorId: revealing,
          fromEncounterDeck,
          knifeSurge,
        }),
      ]),
    );
    for (const seat of playerOrder(s)) {
      const view = seatView(s, seat);
      opts.push(
        ...scarletWitch
          .scarletWitchRevealOptions(
            view,
            p,
            [
              E("reveal", {
                piece: p,
                skip: true,
                actorId: revealing,
                fromEncounterDeck,
                knifeSurge,
              }),
            ],
            scarletPorts,
            fromEncounterDeck,
          )
          .map((o) => ({
            ...o,
            id: `${seat.id}:${o.id}`,
            effects: o.effects.map((effect) => ({
              ...effect,
              actorId: seat.id,
            })),
          })),
      );
      opts.push(
        ...quicksilverPack
          .quicksilverPackEncounterOptions(
            view,
            p,
            fromEncounterDeck,
            [
              E("reveal", {
                piece: p,
                skip: true,
                actorId: revealing,
                fromEncounterDeck,
                knifeSurge,
              }),
            ],
            quicksilverPackPorts,
          )
          .map((o) => ({
            ...o,
            id: `${seat.id}:${o.id}`,
            effects: o.effects.map((effect) => ({
              ...effect,
              actorId: seat.id,
            })),
          })),
      );
      if (card(p).type_code === "treachery" && view.player.form === "hero")
        for (const code of ["01004", "01078"]) {
          const interrupt = view.player.hand.find(
            (x) => rulesCode(x) === rulesCode(code),
          );
          if (interrupt && affordable(view, 1, [], interrupt.id))
            opts.push(
              option(
                code + (seat.id === revealing ? "" : `:${seat.id}`),
                `Play ${card(code).name}${s.playerCount > 1 ? ` · ${heroCard(view).name}` : ""}`,
                [
                  E("payRequest", {
                    actorId: seat.id,
                    title: card(code).name,
                    cost: 1,
                    piece: interrupt,
                    after: [
                      E("resolveHandEvent", {
                        id: interrupt.id,
                        after: [
                          E("cancelEncounter", {
                            actorId: revealing,
                            piece: p,
                          }),
                          ...(code === "01078"
                            ? [
                                E("enemyAttack", {
                                  actorId: seat.id,
                                  id: s.villain.id,
                                }),
                              ]
                            : []),
                        ],
                      }),
                    ],
                  }),
                ],
                "Spend 1 resource.",
                code,
              ),
            );
        }
      const widow = view.player.inPlay.find(
        (p) => rulesCode(p) === "01075" && !p.exhausted,
      );
      if (widow && affordable(view, 1, ["mental"]))
        opts.push(
          option(
            `widow${seat.id === revealing ? "" : `:${seat.id}`}`,
            `Use Black Widow · ${heroCard(view).name}`,
            [
              E("payRequest", {
                actorId: seat.id,
                title: "Black Widow",
                cost: 1,
                requirements: ["mental"],
                after: [
                  E("exhaust", { id: widow.id }),
                  E("discardEncounter", { piece: p }),
                  E("revealNext"),
                ],
              }),
            ],
            "Her controller pays and reveals the replacement encounter.",
            "01075",
          ),
        );
    }
    if (opts.length) {
      opts.push(
        option("resolve", "Resolve the encounter", [
          E("reveal", { piece: p, skip: true, fromEncounterDeck, knifeSurge }),
        ]),
      );
      choose(s, card(p).name, "You have an interrupt available.", opts);
      return;
    }
    // Reveal first; the player acknowledges the card before its text resolves.
    add(
      s,
      E("reveal", { piece: p, skip: true, fromEncounterDeck, knifeSurge }),
    );
    return;
  }
  const c = card(p);
  const revealCard = knifeSurge ? { ...c, text: `Surge.\n${c.text || ""}` } : c;
  const cosmic = mtsPlayerPack.mtsPlayerPackEncounterReveal(s, p);
  if (cosmic !== null) {
    add(s, ...cosmic);
    return;
  }
  if (!repeat && c.type_code === "minion") minionWillEnter(s, p);
  if (!repeat && uniqueConflict(s, c)) {
    finishResolution(s, p.id);
    dealEncounter(s);
    return;
  }
  if (!repeat && p.code === "14026") {
    // Enter once, then let the first player order Incite and When Revealed.
    s.resolving = s.resolving.filter((x) => x.id !== p.id);
    s.minions.push(p);
    minionEntered(s, p);
    add(
      s,
      ...beginRevealWindow(
        s,
        p,
        c,
        s.activePlayerId,
        1 + goblinWhenRevealedCopies(s),
      ),
    );
    return;
  }
  if (
    !repeat &&
    ["treachery", "attachment"].includes(c.type_code) &&
    /<b>When Revealed(?:\s*\([^)]*\))?<\/b>\s*:/i.test(c.text || "") &&
    ([
      ...GOBLIN_MODULE_SCRIPT_CODES,
      ...RISKY_BUSINESS_SCRIPT_CODES,
      ...MUTAGEN_FORMULA_SCRIPT_CODES,
      ...BLACK_WIDOW_SCRIPT_CODES,
      ...DOCTOR_STRANGE_SCRIPT_CODES,
      ...HAWKEYE_SCRIPT_CODES,
      ...SPIDER_WOMAN_SCRIPT_CODES,
      ...quicksilver.QUICKSILVER_SCRIPT_CODES,
      ...scarletWitch.SCARLET_WITCH_SCRIPT_CODES,
      ...rocket.ROCKET_SCRIPT_CODES,
      ...groot.GROOT_SCRIPT_CODES,
      ...starLord.STAR_LORD_SCRIPT_CODES,
      ...gamora.GAMORA_SCRIPT_CODES,
      ...drax.DRAX_SCRIPT_CODES,
      ...venom.VENOM_SCRIPT_CODES,
      ...spectrum.SPECTRUM_SCRIPT_CODES,
      ...warlock.WARLOCK_SCRIPT_CODES,
    ].some((code) => code === p.code) ||
      CARDS.some(
        (core) => core.code === rulesCode(p) && core.type_code === "treachery",
      ))
  ) {
    add(
      s,
      ...beginRevealWindow(
        s,
        p,
        revealCard,
        s.activePlayerId,
        1 + goblinWhenRevealedCopies(s),
      ),
    );
    return;
  }
  if (
    !repeat &&
    c.type_code === "attachment" &&
    [...GOBLIN_MODULE_SCRIPT_CODES, ...MUTAGEN_FORMULA_SCRIPT_CODES].some(
      (code) => code === p.code,
    )
  ) {
    const window = beginRevealWindow(
      s,
      p,
      c,
      s.activePlayerId,
      1 + goblinWhenRevealedCopies(s),
    );
    const entry = goblinModuleReveal(s, p) ?? mutagenEncounterReveal(s, p);
    need(entry !== null, "No native encounter attachment entry handler.");
    add(s, ...entry!.map((e) => ({ ...e, revealWindowId: p.id })), ...window);
    return;
  }
  if (!repeat) {
    add(s, E("finishResolution", { id: p.id }));
    const copies = goblinWhenRevealedCopies(s);
    if (copies)
      add(
        s,
        ...Array.from({ length: copies }, () =>
          E("repeatWhenRevealed", { piece: p }),
        ),
      );
  }
  if (
    repeat &&
    c.type_code === "attachment" &&
    !c.text?.includes("When Revealed")
  )
    return;
  const incite = scaledKeyword(c, "Incite", s.playerCount);
  if (incite) add(s, E("threat", { target: "main", amount: incite }));
  const ds = doctorStrangeEncounterReveal(s, p);
  if (ds !== null && c.type_code === "attachment") {
    add(s, ...ds);
    return;
  }
  const bw = blackWidowEncounterReveal(s, p);
  const captain = captainEncounterReveal(s, p);
  const hulk = hulkEncounterReveal(s, p);
  const thor = thorEncounterReveal(s, p);
  const ms = msMarvelEncounterReveal(s, p);
  const goblinModule = goblinModuleReveal(s, p);
  const risky = riskyEncounterReveal(s, p);
  const mutagen = mutagenEncounterReveal(s, p);
  const rise =
    starLord.starLordEncounterReveal(s, p) ??
    gamora.gamoraEncounterReveal(s, p) ??
    drax.draxEncounterReveal(s, p) ??
    venom.venomEncounterReveal(s, p) ??
    spectrum.spectrumEncounterReveal(s, p) ??
    warlock.warlockEncounterReveal(s, p) ??
    rocket.rocketEncounterReveal(s, p) ??
    groot.grootEncounterReveal(s, p) ??
    scarletWitch.scarletWitchEncounterReveal(s, p) ??
    quicksilver.quicksilverEncounterReveal(s, p) ??
    wasp.waspEncounterReveal(s, p) ??
    antMan.antManEncounterReveal(s, p) ??
    hawkeyeEncounterReveal(s, p) ??
    spiderWomanEncounterReveal(s, p);
  if (
    rise !== null &&
    ["obligation", "treachery", "attachment"].includes(c.type_code)
  ) {
    if (c.type_code === "attachment" && !repeat) {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      s.attachments.push(p);
    }
    add(s, ...rise);
    return;
  }
  if (
    goblinModule !== null &&
    ["treachery", "attachment"].includes(c.type_code)
  ) {
    add(
      s,
      ...goblinModule,
      ...(keyword(p, "Surge") ? [E("surge", { sourceCode: p.code })] : []),
    );
    return;
  }
  if (ds !== null && ["obligation", "treachery"].includes(c.type_code)) {
    add(s, ...ds);
    return;
  }
  if (bw !== null && ["obligation", "treachery"].includes(c.type_code)) {
    add(s, ...bw);
    return;
  }
  if (thor !== null && ["obligation", "treachery"].includes(c.type_code)) {
    add(s, ...thor);
    return;
  }
  if (ms !== null && ["obligation", "treachery"].includes(c.type_code)) {
    add(s, ...ms);
    return;
  }
  if (risky !== null && c.type_code === "treachery") {
    add(
      s,
      ...risky,
      ...(keyword(p, "Surge") ? [E("surge", { sourceCode: p.code })] : []),
    );
    return;
  }
  if (mutagen !== null && ["attachment", "treachery"].includes(c.type_code)) {
    add(
      s,
      ...mutagen,
      ...(keyword(p, "Surge") ? [E("surge", { sourceCode: p.code })] : []),
    );
    return;
  }
  if (hulk !== null && ["obligation", "treachery"].includes(c.type_code)) {
    add(s, ...hulk);
    return;
  }
  if (captain !== null && ["obligation", "treachery"].includes(c.type_code)) {
    add(s, ...captain);
    return;
  }
  if (c.type_code === "minion") {
    if (!repeat) {
      s.minions.push(p);
      minionEntered(s, p);
    }
    if (goblinModule !== null) add(s, ...goblinModule);
    if (ds !== null) add(s, ...ds);
    if (bw !== null) add(s, ...bw);
    if (thor !== null) add(s, ...thor);
    if (ms !== null) add(s, ...ms);
    if (risky !== null) add(s, ...risky);
    if (mutagen !== null) add(s, ...mutagen);
    if (rise !== null) add(s, ...rise);
    if (rulesCode(p) === "01103")
      add(
        s,
        ...playerOrder(s)
          .filter((p) => seatView(s, p).player.form === "hero")
          .map((p) =>
            E("damage", { actorId: p.id, target: "hero", amount: 1 }),
          ),
      );
    if (rulesCode(p) === "01110")
      choose(s, "Hydra Bomber", "Choose the consequence of the explosion.", [
        option("damage", "Take 2 damage", [
          E("damage", { target: "hero", amount: 2 }),
        ]),
        option("threat", "Place 1 threat", [
          E("threat", { target: "main", amount: 1 }),
        ]),
      ]);
  } else if (c.type_code === "side_scheme") {
    s.resolving = s.resolving.filter((x) => x.id !== p.id);
    if (!repeat) {
      p.counters =
        (c.base_threat || 0) * (c.base_threat_fixed ? 1 : s.playerCount);
      const healthBefore = s.players.map((seat) => ({
        id: seat.id,
        hp: maxHP(seatView(s, seat)),
      }));
      s.sideSchemes.push(p);
      if (p.code === "12026")
        for (const before of healthBefore) {
          const view = seatView(s, before.id);
          view.player.hp += maxHP(view) - before.hp;
        }
    }
    if (captain !== null) add(s, ...captain);
    if (goblinModule !== null) add(s, ...goblinModule);
    if (bw !== null) add(s, ...bw);
    if (thor !== null) add(s, ...thor);
    if (ms !== null) add(s, ...ms);
    if (rise !== null) add(s, ...rise);
    if (risky !== null) add(s, ...risky);
    if (mutagen !== null) add(s, ...mutagen);
    if (ds !== null) add(s, ...ds);
    const hinder = scaledKeyword(c, "Hinder", s.playerCount);
    if (hinder) add(s, E("threat", { target: p.id, amount: hinder }));
    if (
      ["01107", "01109", "01125", "01126", "01161", "01171", "01176"].includes(
        p.code,
      )
    )
      add(s, E("threat", { target: p.id, amount: s.playerCount }));
    if (!repeat && rulesCode(p) === "01127") {
      s.villain.maxHp += 10;
      s.villain.hp += 10;
    }
    if (rulesCode(p) === "01128")
      add(
        s,
        E("findMinion", {
          trait: "Masters of Evil.",
          actorId: s.firstPlayerId,
        }),
      );
    if (rulesCode(p) === "01148")
      add(s, ...eachPlayer(s, E("drone")), E("factoryThreat", { id: p.id }));
    if (rulesCode(p) === "01149")
      add(s, ...eachPlayer(s, E("mill", { amount: 3 })));
    if (rulesCode(p) === "01150")
      add(
        s,
        E("drone", { actorId: s.firstPlayerId }),
        E("drone", { actorId: s.firstPlayerId }),
      );
    if (rulesCode(p) === "01151")
      add(s, ...eachPlayer(s, E("underAttack", { id: p.id })));
    if (rulesCode(p) === "01166")
      add(s, ...eachPlayer(s, E("capture", { id: p.id })));
    if (rulesCode(p) === "01180")
      add(
        s,
        E("searchEncounter", { code: "01181", reveal: false }),
        E("hydraThreat", { id: p.id }),
      );
    if (rulesCode(p) === "01183")
      add(s, E("searchEncounter", { code: "01184", reveal: false }));
  } else if (c.type_code === "attachment") {
    s.resolving = s.resolving.filter((x) => x.id !== p.id);
    if (["01163", "01185"].includes(rulesCode(p))) {
      const candidates = [...s.minions]
        .filter(
          (x) =>
            rulesCode(p) !== "01185" ||
            !s.attachments.some(
              (a) => rulesCode(a) === "01185" && a.attachedTo === x.id,
            ),
        )
        .sort((a, b) => (card(b).health || 1) - (card(a).health || 1));
      if (candidates.length) {
        p.attachedTo = candidates[0].id;
        s.attachments.push(p);
      } else {
        s.encounter.discard.push(p);
        if (rulesCode(p) === "01163")
          add(s, E("surge", { sourceCode: p.code }));
      }
    } else {
      p.attachedTo = s.villain.id;
      s.attachments.push(p);
    }
  } else if (c.type_code === "obligation") {
    obligation(s, p);
    return;
  } else {
    if (keyword(p, "Surge") && c.text?.includes("When Revealed")) {
      choose(
        s,
        `${c.name} · When Revealed`,
        "Choose the order of the card’s When Revealed ability and Surge.",
        [
          option("text-first", "Card ability, then Surge", [
            E("treacheryText", { piece: p }),
            E("surge", { sourceCode: p.code }),
          ]),
          option("surge-first", "Surge, then card ability", [
            E("surge", { sourceCode: p.code }),
            E("treacheryText", { piece: p }),
          ]),
        ],
      );
      return;
    }
    treachery(s, p);
  }
  if (keyword(p, "Surge")) add(s, E("surge", { sourceCode: p.code }));
}
function obligation(s: GameState, p: Piece) {
  const owner = s.players.find(
    (seat) => seat.heroId === card(p).set_code && !seat.eliminated,
  );
  if (!owner) {
    finishResolution(s, p.id);
    return;
  }
  activateSeat(s, owner.id);
  const second: Effect[] =
    rulesCode(p) === "01155"
      ? [E("chooseDiscard", { filter: "panther" })]
      : rulesCode(p) === "01160"
        ? [E("accelerate")]
        : rulesCode(p) === "01165"
          ? [E("randomDiscard"), E("surge", { sourceCode: p.code })]
          : rulesCode(p) === "01170"
            ? [E("exhaustUpgrades")]
            : [
                E("status", { target: "hero", status: "stunned" }),
                E("surge", { sourceCode: p.code }),
              ];
  const opts = [
    option(
      "penalty",
      "Accept the obligation",
      [...second, E("discardEncounter", { piece: p })],
      rulesCode(p) === "01155"
        ? "Discard a Black Panther upgrade."
        : rulesCode(p) === "01160"
          ? "Add an acceleration token."
          : rulesCode(p) === "01165"
            ? "Discard a random card; surge."
            : rulesCode(p) === "01170"
              ? "Exhaust every upgrade."
              : "Become stunned; surge.",
    ),
  ];
  if (
    !s.player.exhausted &&
    (s.player.form === "alter" || !goblinIdentityLocked(s))
  )
    opts.unshift(
      option(
        "resolve",
        "Settle your affairs",
        [E("settle", { piece: p })],
        `Change to ${HEROES.find((h) => h.id === s.heroId)!.identity} and exhaust to remove this obligation.`,
      ),
    );
  choose(
    s,
    card(p).name,
    "Your life outside the mask needs your attention.",
    opts,
  );
}
function treachery(s: GameState, p: Piece) {
  const hulk = hulkEncounterReveal(s, p);
  if (hulk !== null) {
    add(s, ...hulk);
    return;
  }
  const captain = captainEncounterReveal(s, p);
  if (captain !== null) {
    add(s, ...captain);
    return;
  }
  const script = cardScript(p);
  if (script?.implementation === "script") {
    add(s, ...scriptEffects(script, "encounter-reveal", scriptContext(s, p)));
    return;
  }
  const hero = s.player.form === "hero";
  const att = (extra?: string) => E("enemyAttack", { id: s.villain.id, extra });
  const sch = (extra?: string) => E("enemyScheme", { id: s.villain.id, extra });
  const surge = () => add(s, E("surge", { sourceCode: p.code }));
  switch (rulesCode(p)) {
    case "01104":
    case "01124":
      if (rulesCode(p) === "01124" && hero)
        add(
          s,
          E("damage", { target: "hero", amount: 2 }),
          E("heal", { target: s.villain.id, amount: 2 }),
        );
      else if (!heal(s, s.villain.id, 4)) surge();
      break;
    case "01105":
      if (s.villain.tough) surge();
      else giveCharacterStatus(s, s.villain, "tough");
      break;
    case "01106":
      if (hero) add(s, att("stampede"));
      else surge();
      break;
    case "01111": {
      const scheme = s.sideSchemes.find((p) => rulesCode(p) === "01109");
      if (scheme) add(s, E("assignDamage", { remaining: scheme.counters }));
      else surge();
      break;
    }
    case "01112":
      if (s.player.confused) surge();
      else giveCharacterStatus(s, s.player, "confused");
      break;
    case "01122":
      if (hero) add(s, att("vengeance"));
      else randomDiscard(s);
      break;
    case "01123": {
      const opts = [
        option("exhaust", "Exhaust all your characters", [
          E("exhaustCharacters"),
        ]),
      ];
      if (affordable(s, 3, ["energy", "mental", "physical"]))
        opts.unshift(
          option("pay", "Spend 3 different resources", [
            E("payRequest", {
              title: "Sonic Boom",
              cost: 3,
              requirements: ["energy", "mental", "physical"],
              after: [],
            }),
          ]),
        );
      choose(
        s,
        "Sonic Boom",
        "Spend energy, mental, and physical resources, or exhaust your characters.",
        opts,
      );
      break;
    }
    case "01133": {
      const minions = s.minions.filter(
        (p) =>
          card(p).traits?.includes("Masters of Evil.") &&
          seatView(s, p.engagedWith || s.activePlayerId).player.form === "hero",
      );
      add(
        s,
        E("attackSequence", {
          attacks: minions.map((p) =>
            E("enemyAttack", {
              id: p.id,
              actorId: p.engagedWith || s.activePlayerId,
            }),
          ),
          fallback: [
            E("searchEncounter", { trait: "Masters of Evil.", reveal: false }),
          ],
        }),
      );
      break;
    }
    case "01144a":
    case "01144b":
    case "01144c":
      add(s, ...eachPlayer(s, E("drone")));
      break;
    case "01145":
      add(s, hero ? att("rage") : sch("rage"));
      break;
    case "01146":
      if (
        !heal(
          s,
          s.villain.id,
          2 *
            engaged(s).filter((p) => card(p).traits?.includes("Drone.")).length,
        )
      )
        surge();
      break;
    case "01147": {
      const drones = engaged(s).filter((p) =>
        card(p).traits?.includes("Drone."),
      );
      add(
        s,
        E("attackSequence", {
          attacks: hero
            ? drones.map((p) => E("enemyAttack", { id: p.id }))
            : [],
          fallback: [E("drone")],
        }),
      );
      break;
    }
    case "01154":
      add(
        s,
        ...targets(s, "friendly").map((t) =>
          E("damage", { target: t.id, amount: 1 }),
        ),
      );
      break;
    case "01158":
      giveCharacterStatus(s, s.villain, "tough");
      engaged(s).forEach((p) => giveCharacterStatus(s, p, "tough"));
      break;
    case "01159": {
      const b = drawEncounter(s);
      if (b) s.encounter.discard.push(b);
      const amount = 1 + (b ? card(b).boost || 0 : 0);
      choose(
        s,
        "Ritual Combat",
        `The boost card sets the amount to ${amount}.`,
        [
          option("damage", `Take ${amount} damage`, [
            E("damage", { target: "hero", amount }),
          ]),
          option("threat", `Place ${amount} threat`, [
            E("threat", { target: "main", amount }),
          ]),
        ],
      );
      break;
    }
    case "01164": {
      const titania = s.minions.find((p) => rulesCode(p) === "01162");
      add(
        s,
        E("attackSequence", {
          attacks:
            titania && hero ? [E("enemyAttack", { id: titania.id })] : [],
          fallback: [
            ...(titania
              ? [E("heal", { target: titania.id, amount: titania.damage })]
              : []),
            E("surge", { sourceCode: p.code }),
          ],
        }),
      );
      break;
    }
    case "01168":
      if (hero) giveCharacterStatus(s, s.player, "stunned");
      if (s.minions.some((p) => rulesCode(p) === "01167")) surge();
      break;
    case "01169":
      add(s, E("vulturePlans"));
      break;
    case "01173": {
      const up = s.player.inPlay.filter(
        (p) =>
          card(p).type_code === "upgrade" &&
          (!Object.values(spectrum.SPECTRUM_FORM_CODES).some(
            (code) => code === p.code,
          ) ||
            spectrum.spectrumFormFaceup(s, p)),
      );
      const opts = [
        option("damage", `Take ${up.length} damage`, [
          E("damage", { target: "hero", amount: up.length }),
        ]),
      ];
      if (
        up.some(
          (p) =>
            !Object.values(spectrum.SPECTRUM_FORM_CODES).some(
              (code) => code === p.code,
            ),
        )
      )
        opts.push(
          option("discard", "Discard an upgrade", [
            E("chooseDiscard", { filter: "upgrade" }),
          ]),
        );
      choose(s, "Electric Whip Attack", "Choose the consequence.", opts);
      break;
    }
    case "01174":
      add(s, ...eachPlayer(s, E("backlash")));
      break;
    case "01178":
      add(s, E("threat", { target: "main", amount: 1 }));
      break;
    case "01179": {
      const cards = s.player.hand.filter((p) => card(p).resource_energy);
      if (!cards.length) surge();
      else cards.forEach((p) => discardHand(s, p.id));
      break;
    }
    case "01186":
      add(s, sch());
      break;
    case "01187":
      if (hero) add(s, att());
      else surge();
      break;
    case "01188":
      if (
        s.player.inPlay.some(
          (p) =>
            ["support", "upgrade"].includes(card(p).type_code) &&
            !Object.values(spectrum.SPECTRUM_FORM_CODES).some(
              (code) => code === p.code,
            ),
        )
      )
        add(s, E("chooseDiscard", { filter: "supportUpgrade" }));
      else surge();
      break;
    case "01189":
      if (hero)
        add(s, att(), ...engaged(s).map((p) => E("enemyAttack", { id: p.id })));
      else surge();
      break;
    case "01190": {
      const warlockNemesis = warlock.warlockShadowOfPast(s);
      if (warlockNemesis !== null) {
        add(s, ...warlockNemesis);
        log(
          s,
          "Adam Warlock's actual set-aside nemesis cards enter the fight!",
          "bad",
        );
        break;
      }
      const venomNemesis = venom.venomShadowOfPast(s);
      if (venomNemesis !== null) {
        add(s, ...venomNemesis);
        log(
          s,
          "Venom's remaining set-aside nemesis cards enter the fight!",
          "bad",
        );
        break;
      }
      if (s.flags.nemesis) {
        surge();
        break;
      }
      s.flags.nemesis = true;
      const set = CATALOG_CARDS.filter(
        (c) =>
          c.set_code === `${s.heroId}_nemesis` &&
          c.pack_code === heroCard(s).pack_code,
      );
      const minion = set.find((c) => c.type_code === "minion")!;
      const scheme = set.find((c) => c.type_code === "side_scheme")!;
      s.encounter.deck.push(
        ...set
          .filter((c) => c !== minion && c !== scheme)
          .flatMap((c) =>
            Array.from({ length: c.quantity }, () => makePiece(s, c.code)),
          ),
      );
      shuffle(s, s.encounter.deck);
      add(
        s,
        E("reveal", { piece: makePiece(s, minion.code) }),
        E("reveal", { piece: makePiece(s, scheme.code) }),
      );
      log(s, `Your nemesis enters the fight!`, "bad");
      break;
    }
    case "01191":
      s.player.exhausted = true;
      break;
    case "01192":
      if (s.sideSchemes.length)
        add(
          s,
          ...s.sideSchemes.map((p) => E("threat", { target: p.id, amount: 4 })),
        );
      else add(s, E("findEncounter", { typeCode: "side_scheme" }));
      break;
    case "01193":
      add(s, E("revealNext"));
      break;
    default:
      throw Error(`No encounter script for ${p.code}.`);
  }
}
function resolve(s: GameState, e: Effect) {
  if (e.retaliateSource && !find(s, e.retaliateSource)) return;
  if (e.type === "ms:preemptive" && !e.scarletCounted) {
    countActivationBoost(s, e.boostId, [{ ...e, scarletCounted: true }]);
    return;
  }
  if (
    e.type === "wasp:basic-resolve" &&
    !e.thorWindowHandled &&
    s.player.hand.some((p) =>
      e.power === "attack"
        ? ["06015", "06032"].includes(p.code)
        : p.code === "06032",
    )
  ) {
    add(
      s,
      ...thorBasicPowerWindow(s, { ...e, thorWindowHandled: true }, e.power),
    );
    return;
  }
  if (antMan.resolveAntManEffect(s, e, antManPorts)) return;
  if (antPack.resolveAntManPackEffect(s, e, antPackPorts)) return;
  if (wasp.resolveWaspEffect(s, e, waspPorts)) return;
  if (waspPack.resolveWaspPackEffect(s, e, waspPackPorts)) return;
  if (quicksilver.resolveQuicksilverEffect(s, e, quicksilverPorts)) return;
  if (quicksilverPack.resolveQuicksilverPackEffect(s, e, quicksilverPackPorts))
    return;
  if (scarletWitch.resolveScarletWitchEffect(s, e, scarletPorts)) return;
  if (scarletPack.resolveScarletWitchPackEffect(s, e, scarletPackPorts)) return;
  if (rocket.resolveRocketEffect(s, e, rocketPorts)) return;
  if (groot.resolveGrootEffect(s, e, grootPorts)) return;
  if (gmwPack.resolveGmwPlayerPackEffect(s, e, gmwPorts)) return;
  if (starLord.resolveStarLordEffect(s, e, starLordPorts)) return;
  if (gamora.resolveGamoraEffect(s, e, gamoraPorts)) return;
  if (drax.resolveDraxEffect(s, e, draxPorts)) return;
  if (venom.resolveVenomEffect(s, e, venomPorts)) return;
  if (spectrum.resolveSpectrumEffect(s, e, spectrumPorts)) return;
  if (warlock.resolveWarlockEffect(s, e, warlockPorts)) return;
  if (starLordPack.resolveStarLordPackEffect(s, e, starLordPackPorts)) return;
  if (gamoraPack.resolveGamoraPackEffect(s, e, gamoraPackPorts)) return;
  if (draxPack.resolveDraxPackEffect(s, e, draxPackPorts)) return;
  if (venomPack.resolveVenomPackEffect(s, e, venomPackPorts)) return;
  if (mtsPlayerPack.resolveMtsPlayerPackEffect(s, e, mtsPlayerPackPorts))
    return;
  if (resolveHawkeyeEffect(s, e, hawkeyePorts)) return;
  if (resolveSpiderWomanEffect(s, e, swPorts)) return;
  if (resolveDoctorStrangeEffect(s, e, dsPorts)) return;
  if (resolveBlackWidowEffect(s, e, bwPorts)) return;
  if (
    resolveRevealWindowEffect(s, e, {
      queue: add,
      choose,
      resolveText: (state, piece, windowId) => {
        const previous = state.currentRevealWindowId;
        state.currentRevealWindowId = windowId;
        const effects =
          goblinModuleReveal(state, piece) ??
          riskyEncounterReveal(state, piece) ??
          mutagenEncounterReveal(state, piece) ??
          blackWidowEncounterReveal(state, piece) ??
          doctorStrangeEncounterReveal(state, piece) ??
          starLord.starLordEncounterReveal(state, piece) ??
          gamora.gamoraEncounterReveal(state, piece) ??
          drax.draxEncounterReveal(state, piece) ??
          venom.venomEncounterReveal(state, piece) ??
          spectrum.spectrumEncounterReveal(state, piece) ??
          warlock.warlockEncounterReveal(state, piece) ??
          rocket.rocketEncounterReveal(state, piece) ??
          groot.grootEncounterReveal(state, piece) ??
          scarletWitch.scarletWitchEncounterReveal(state, piece) ??
          quicksilver.quicksilverEncounterReveal(state, piece) ??
          wasp.waspEncounterReveal(state, piece) ??
          antMan.antManEncounterReveal(state, piece) ??
          hawkeyeEncounterReveal(state, piece) ??
          spiderWomanEncounterReveal(state, piece);
        if (effects !== null) add(state, ...effects);
        else treachery(state, piece);
        state.currentRevealWindowId = previous;
      },
      dealEncounter: (state, playerId) => dealEncounter(state, playerId),
      afterSurge: (_state, piece, playerId) => [
        E("bwSurgeResponses", { piece, actorId: playerId }),
      ],
      finish: (state, piece) =>
        add(state, E("finishResolution", { id: piece.id })),
    })
  )
    return;
  if (resolveGoblinModuleEffect(s, e, goblinPorts)) return;
  if (resolveThorEffect(s, e, thorPorts)) return;
  if (resolveMsMarvelEffect(s, e, msPorts)) return;
  if (["risky:advance-main", "mutagen:advance-main"].includes(e.type))
    discardMainAttachments(s);
  if (resolveRiskyEffect(s, e, riskyPorts)) return;
  if (resolveHulkPackEffect(s, e, hulkPackPorts)) return;
  if (resolveMutagenEffect(s, e, mutagenPorts)) return;
  if (
    resolveCaptainPackEffect(s, e, {
      queue: add,
      choose,
      select,
      discardHand,
      revealHidden,
      putAllyFromHand,
      attach: attachPackUpgrade,
    })
  )
    return;
  if (
    resolveHulkEffect(s, e, {
      queue: add,
      choose,
      select,
      discardHand,
      discardPiece,
      mill,
      flip,
      heroATK: (state, playerId) =>
        heroStats(playerId ? seatView(state, playerId) : state).attack,
      allyATK: (state, piece, playerId) =>
        allyStat(seatView(state, playerId), piece, "attack"),
      enemyATK: (state, piece) => enemyATK(state, piece, state.activePlayerId),
      cardCost: (state, piece) => cardCost(state, card(piece)),
      canPay: (state, cost, excludeId, targetCode) =>
        canPay(state, cost, [], excludeId, targetCode),
      startEnemyAttack: (state, attackerId, targetId, ownerId) => {
        activateSeat(state, ownerId);
        const before = Number(state.flags.attacksPerformed || 0);
        enemyAttack(state, attackerId);
        if (
          !state.attack ||
          Number(state.flags.attacksPerformed || 0) === before
        )
          return false;
        state.attack.originalTarget = targetId;
        return true;
      },
    })
  )
    return;
  if (
    resolveCaptainEffect(s, e, {
      queue: add,
      choose,
      select,
      shuffle,
      discardHand,
      discardPiece,
      attackBatch: (state, ids, amount) => {
        if (state.player.stunned) {
          consumeStatus(state.player, "stunned");
          return false;
        }
        need(
          new Set(ids).size === ids.length &&
            ids.every((id) =>
              targets(state, "enemy", true).some((t) => t.id === id),
            ),
          "Illegal attack targets.",
        );
        if (
          state.player.inPlay.some(
            (p) => p.code === "16045" && !isTextBlank(state, p),
          )
        ) {
          const target = find(state, ids[0]);
          add(
            state,
            E("waspDistributedAttack", {
              packets: ids.map((target) => ({ target, amount })),
              chooserId: state.firstPlayerId,
            }),
            ...(e.type === "cap:strike" && e.physical && target
              ? [
                  E("gmwCaptainStrikeAfter", {
                    target: target.id,
                    code: target.code,
                  }),
                ]
              : []),
          );
          // The saved continuation applies Heroic Strike's status after damage.
          return false;
        }
        const previousQueue = new Set(state.queue);
        for (const id of ids) {
          dealDamage(state, id, amount, "hero", true);
        }
        if (!["won", "lost"].includes(state.phase)) {
          const responseGroup = state.currentEventId
            ? `eventAttack:${state.currentEventId}`
            : `attackBatch${state.nextId++}`;
          const generated: Effect[] = state.queue
            .filter((e) => !previousQueue.has(e))
            .map((e) => ({ ...e, responseGroup }));
          const immediate = generated.filter(
            (e) => !e.afterAttack && e.type !== "attackAftermathOrder",
          );
          const after = generated.filter((e) => e.afterAttack);
          const continuation = state.queue.filter((e) => previousQueue.has(e));
          const finish = state.currentEventId
            ? continuation.findIndex(
                (e) =>
                  e.type === "finishResolution" &&
                  e.id === state.currentEventId,
              )
            : -1;
          const ordered = [
            E("attackAftermathOrder", {
              responseGroup,
              actorId: state.firstPlayerId,
              mandatory: true,
            }),
            ...after.filter((e) => e.mandatory),
            ...after.filter((e) => !e.mandatory),
          ];
          if (finish >= 0) continuation.splice(finish, 0, ...ordered);
          else continuation.unshift(...ordered);
          state.queue = [
            ...immediate.filter((e) => e.mandatory),
            ...immediate.filter((e) => !e.mandatory),
            ...continuation,
          ];
        }
        return true;
      },
      drawEncounter,
      dealEncounter,
      revealHidden,
    })
  ) {
    if (e.type === "cap:helmet") delete s.flags.captainHelmetPending;
    return;
  }
  switch (e.type) {
    case "scarletBoostCounted": {
      const activation = s.scheming || s.attack;
      if (activation) (activation.boostValues ||= {})[e.id] = e.boostTotal;
      add(s, ...(e.after || []));
      break;
    }
    case "scarletEnemyActivated": {
      const p = find(s, e.id);
      if (p)
        add(
          s,
          ...groot.grootEnemyActivated(s, p, grootPorts),
          ...scarletWitch.scarletWitchEnemyActivated(s, p),
          ...(e.againstPlayer === false
            ? []
            : warlock.warlockEnemyActivated(s, p.id)),
        );
      break;
    }
    case "scarletHeroThwartResponse": {
      const options = scarletPack.scarletWitchPackAfterHeroThwart(
        s,
        e.snapshot,
        [],
        scarletPackPorts,
      );
      if (options.length)
        choose(
          s,
          "Turn the Tide",
          "Respond after removing all threat from a scheme?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    case "scarletAfterAllyAttack": {
      add(s, ...scarletPack.scarletWitchPackAfterAllyAttack(s, e.id));
      break;
    }
    case "scriptCheckpoint": {
      const p = find(s, e.target);
      const snapshot = {
        target: e.target,
        code: p?.code,
        stage: p?.id === s.villain.id ? s.villain.stage : undefined,
        threat: e.target === "main" ? s.scheme.threat : p?.counters,
        existed: !!p || e.target === "main",
      };
      ((s.scriptCheckpoints ||= {})[e.key] ||= []).push(snapshot);
      break;
    }
    case "scriptIfDefeated":
    case "scriptIfThreatRemoved": {
      const snapshot = s.scriptCheckpoints?.[e.key]?.pop();
      if (!snapshot) break;
      const p = find(s, snapshot.target);
      const qualifies =
        e.type === "scriptIfDefeated"
          ? snapshot.existed &&
            (!p ||
              p.code !== snapshot.code ||
              (snapshot.stage !== undefined &&
                s.villain.stage !== snapshot.stage))
          : (snapshot.threat || 0) > 0 &&
            (snapshot.target === "main"
              ? s.scheme.threat === 0
              : !p || p.counters === 0);
      if (qualifies)
        add(
          s,
          ...e.effects.map((effect: Effect) => ({
            ...effect,
            target: effect.target || snapshot.target,
          })),
        );
      break;
    }
    case "captainAllowDefeat":
      delete s.flags.captainHelmetPending;
      s.flags.captainHelmetDeclined = true;
      break;
    case "draxDefeatResume":
      delete s.flags.draxStubbornPending;
      delete s.flags.draxStubbornDeclined;
      break;
    case "draxAllowDefeat":
      delete s.flags.draxStubbornPending;
      s.flags.draxStubbornDeclined = true;
      break;
    case "scriptSequence": {
      const source =
        e.source === "hero" || !e.source ? s.player : find(s, e.source);
      if (e.attack && source?.stunned) {
        consumeStatus(source, "stunned");
        break;
      }
      if (e.action && source?.confused) {
        consumeStatus(source, "confused");
        break;
      }
      add(
        s,
        ...e.effects.map((effect: Effect) => ({
          ...effect,
          target: effect.target || e.target,
        })),
      );
      break;
    }
    case "scriptChoice":
      choose(s, e.title, e.text, e.options);
      break;
    case "minionEntered": {
      const p = find(s, e.id);
      if (p) minionEntered(s, p);
      break;
    }
    case "removeEncounter":
      if (e.piece.code === "21026")
        for (const seat of s.players)
          seatView(s, seat).player.inPlay = seatView(
            s,
            seat,
          ).player.inPlay.filter((p) => p.id !== e.piece.id);
      s.resolving = s.resolving.filter((p) => p.id !== e.piece.id);
      s.encounter.discard = s.encounter.discard.filter(
        (p) => p.id !== e.piece.id,
      );
      s.removed.push(resetPiece(e.piece));
      break;
    case "resumePrompt":
      s.prompt = e.prompt;
      break;
    case "attackProgramEnd":
      for (const key of Object.keys(s.flags))
        if (key.startsWith(`qsvVibration:${e.id}:`)) delete s.flags[key];
      break;
    case "bwMinionSchemeResponses": {
      const p = find(s, e.id);
      const options = p ? blackWidowMinionSchemed(s, p, [e]) : [];
      if (options.length)
        choose(s, "Quake", "Use a response after this minion schemes?", [
          ...options,
          option("pass", "Continue", []),
        ]);
      break;
    }
    case "bwEntryResponses": {
      const p = find(s, e.id);
      const options = p ? blackWidowMinionEntered(s, p, [e], bwPorts) : [];
      if (options.length)
        choose(
          s,
          "Minion entered play",
          "Use a Preparation after the minion enters?",
          [...options, option("pass", "Continue", [])],
        );
      break;
    }
    case "bwAllyDefeated": {
      const options = blackWidowAllyDefeated(s, e.piece, e.playerId, [e]);
      if (options.length)
        choose(s, "Ally defeated", "Use Rapid Response?", [
          ...options,
          option("pass", "Continue", []),
        ]);
      break;
    }
    case "bwSurgeResponses": {
      const options = blackWidowSurgeOptions(s, e.piece, [e]);
      if (options.length)
        choose(s, "Surge resolved", "Use Espionage?", [
          ...options,
          option("pass", "Continue", []),
        ]);
      break;
    }
    case "eventResolve": {
      const p: Piece = e.piece,
        c = card(p);
      if (
        !e.mtsPackAdditionalCostPaid &&
        ["21016", "21043", "21050", "21055"].includes(p.code)
      ) {
        add(
          s,
          ...mtsPlayerPack.mtsPlayerPackBeforeEvent(s, p, [
            { ...e, mtsPackAdditionalCostPaid: true },
          ]),
        );
        break;
      }
      if (!e.warlockDiscardCostPaid) {
        const cost = warlock.warlockBeforeEvent(s, p, [
          { ...e, warlockDiscardCostPaid: true },
        ]);
        if (cost) {
          add(s, ...cost);
          break;
        }
      }
      const multipleLabels = (c.text || "").match(
        /\((?:attack|defense|thwart)(?:\/(?:attack|defense|thwart))+\)/gi,
      );
      if (
        multipleLabels &&
        gamora.gamoraReplaceMultiLabel(s, [
          ...(multipleLabels.some((label) => label.includes("attack"))
            ? ["attack" as const]
            : []),
          ...(multipleLabels.some((label) => label.includes("thwart"))
            ? ["thwart" as const]
            : []),
        ])
      )
        break;
      if (c.text?.includes("(thwart)") && captainThwartBlocked(s)) break;
      if (p.code === "09016") {
        need(
          maxHP(s) - s.player.hp >= 2,
          "Momentum Shift requires its heal-2 cost.",
        );
        heal(s, "hero", 2);
      }
      if (
        !["03006", "06005", "08004", "04005", "04007", "04009"].includes(
          p.code,
        ) &&
        c.text?.includes("(attack)") &&
        s.player.stunned
      ) {
        consumeStatus(s.player, "stunned");
        break;
      }
      if (
        !["01023", "06003", "04008"].includes(rulesCode(p)) &&
        c.text?.includes("(thwart)") &&
        s.player.confused
      ) {
        consumeStatus(s.player, "confused");
        break;
      }
      add(
        s,
        ...doctorStrangeBeforeEvent(s, p, [{ ...e, type: "nativeEvent" }]),
      );
      break;
    }
    case "nativeEvent": {
      event(
        s,
        e.piece,
        e.paid ?? [],
        e.lightningX,
        e.masterInvocationId,
        e.paidForCard,
        e.warlockDiscarded || [],
      );
      break;
    }
    case "ms:mark-attack-interrupt":
      if (s.attack) (s.attack.interruptsUsed ||= []).push(e.id);
      break;
    case "ms:prevent-damage":
      if (e.packet?.kind === "overkill" && s.attack)
        s.attack.identityPrevented =
          (s.attack.identityPrevented || 0) + e.amount;
      else if (e.packet) {
        const key = `msPrevent:${e.packet.damageWindowId}`;
        s.flags[key] = Number(s.flags[key] || 0) + e.amount;
      } else if (s.attack) s.attack.prevented += e.amount;
      break;
    case "resolveHandEvent": {
      const i = s.player.hand.findIndex((p) => p.id === e.id);
      need(i >= 0, "The reaction card is no longer in hand.");
      const agility = !e.agilityHandled
        ? spiderWomanCardPlayed(s, card(s.player.hand[i]))
        : [];
      if (agility.length) {
        add(s, ...agility, { ...e, agilityHandled: true });
        break;
      }
      const [p] = s.player.hand.splice(i, 1);
      starLord.starLordHandPlayFinished(s, p.id);
      beginResolution(s, p);
      s.flags.discount = 0;
      msMarvelCardPlayed(s);
      captainCardPlayed(s, card(p));
      captainPackCardPlayed(s, card(p));
      gmwPack.gmwPlayerPackCardPlayed(s, card(p));
      gamora.gamoraCardPlayed(s, card(p));
      gamoraPack.gamoraPackCardPlayed(s, p);
      mtsPlayerPack.mtsPlayerPackCardPlayed(s, card(p));
      track(s, "cardsPlayed", 1);
      log(s, `Play ${card(p).name}.`, "good");
      if (["21016", "21043", "21050", "21055"].includes(p.code)) {
        add(
          s,
          E("eventResolve", {
            piece: p,
            paid: e.paid || [],
            paidForCard: e.paidForCard,
            eventId: p.id,
          }),
          E("finishResolution", {
            id: p.id,
            eventId: p.id,
            playedEvent: { ...p },
          }),
          ...(e.continuation || e.resume || []).map((x: Effect) => ({
            ...x,
            eventId: undefined,
          })),
        );
        break;
      }
      const labels =
        (card(p).text || "").match(
          /\((?:attack|defense|thwart)(?:\/(?:attack|defense|thwart))*\)/gi,
        ) || [];
      const statusCanceled = gamora.gamoraReplaceMultiLabel(s, [
        ...(labels.some((label) => label.includes("attack"))
          ? ["attack" as const]
          : []),
        ...(labels.some((label) => label.includes("thwart"))
          ? ["thwart" as const]
          : []),
      ]);
      for (const e of doctorStrangeCardPlayed(s, card(p)))
        discardPiece(s, e.id);
      const eventEffects: Effect[] = e.after ?? [
        E("nativeEvent", {
          piece: p,
          paid: e.paid || [],
          paidForCard: e.paidForCard,
        }),
      ];
      add(
        s,
        ...msMarvelBeforeEvent(
          s,
          p,
          statusCanceled
            ? []
            : doctorStrangeBeforeEvent(
                s,
                p,
                eventEffects.map((x: Effect) => ({ ...x, eventId: p.id })),
              ),
        ),
        E("finishResolution", {
          id: p.id,
          eventId: p.id,
          playedEvent: { ...p },
        }),
        ...(e.continuation || e.resume || []).map((x: Effect) => ({
          ...x,
          eventId: undefined,
        })),
      );
      break;
    }
    case "basicPower": {
      const power = e.power as "attack" | "thwart";
      const extraCost = power === "attack" ? wasp.waspBasicAttackCost(s) : 0;
      if (extraCost && !e.costPaid) {
        requestPayment(
          s,
          "Mother's Orders · basic attack",
          extraCost,
          [{ ...e, costPaid: true }],
          [],
          undefined,
          true,
          undefined,
          false,
          [E("exhaust", { id: "hero" })],
        );
        break;
      }
      s.player.exhausted = true;
      if (power === "attack") s.flags.basicAttack = true;
      const replaced =
        power === "attack" ? s.player.stunned : s.player.confused;
      const base = heroStats(s)[power];
      const continuation = {
        ...e,
        basic: true,
        amount: e.amount ?? base,
        basicStatAmount: e.basicStatAmount ?? base,
      };
      if (!replaced && !e.grootBasicHandled) {
        const after = [{ ...continuation, grootBasicHandled: true }];
        const options = groot.grootBasicOptions(s, power, after, grootPorts);
        if (options.length) {
          choose(
            s,
            "Basic power interrupts",
            "Use a Vines upgrade before resolving this basic power?",
            [...options, option("continue", "Continue", after)],
          );
          break;
        }
      }
      if (!replaced && power === "attack" && !e.gmwBasicHandled) {
        const packet = { ...continuation, grootBasicHandled: true };
        const options = gmwPack.gmwPlayerPackBasicAttackOptions(
          s,
          packet,
          [],
          gmwPorts,
        );
        if (options.length) {
          choose(
            s,
            "Basic attack interrupts",
            "Use a Hand Cannon before resolving this basic attack?",
            [
              ...options,
              option("continue", "Continue", [
                { ...packet, gmwBasicHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      if (!replaced && power === "attack" && !e.draxBasicHandled) {
        const packet = {
          ...continuation,
          grootBasicHandled: true,
          gmwBasicHandled: true,
        };
        const options = drax.draxBasicAttackOptions(s, packet, [], draxPorts);
        if (options.length) {
          choose(
            s,
            "Basic attack interrupts",
            "Play Knife Leap before resolving this basic attack?",
            [
              ...options,
              option("continue", "Continue", [
                { ...packet, draxBasicHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      if (!replaced && !e.venomPistolHandled) {
        const after = [{ ...continuation, venomPistolHandled: true }];
        const options = venom.venomBasicPowerOptions(
          s,
          power,
          after,
          venomPorts,
        );
        if (options.length) {
          choose(
            s,
            "Basic power interrupts",
            "Use Venom's Pistol for this basic power?",
            [...options, option("continue", "Continue", after)],
          );
          break;
        }
      }
      if (!replaced && !e.dvBasicHandled) {
        const packet = { ...continuation, dvBasicHandled: false };
        const options =
          power === "attack"
            ? draxPack.draxPackBasicAttackOptions(s, packet, [], draxPackPorts)
            : venomPack.venomPackBasicThwartOptions(
                s,
                packet,
                [],
                venomPackPorts,
              );
        if (options.length) {
          choose(
            s,
            "Basic power interrupts",
            power === "attack"
              ? "Use Leading Blow before resolving this basic attack?"
              : "Use Making an Entrance before resolving this basic thwart?",
            [
              ...options,
              option("continue", "Continue", [
                { ...packet, dvBasicHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      const metadata = {
        draxPackLeadingBlows: e.draxPackLeadingBlows,
        venomPackEntrances: e.venomPackEntrances,
        gmwBasicBonus: e.gmwBasicBonus,
      };
      const native = wasp.waspBasicPower(
        s,
        power,
        continuation.amount - continuation.basicStatAmount,
        { overkill: !!e.overkill, metadata },
      );
      if (native)
        add(
          s,
          ...native,
          ...(!replaced ? [E("quicksilverBasicUsed", { power })] : []),
        );
      else {
        const amount = continuation.amount;
        add(
          s,
          E("target", {
            group: power === "attack" ? "enemy" : "scheme",
            title: power === "attack" ? "Basic attack" : "Basic thwart",
            action: E(power === "attack" ? "damage" : "thwart", {
              ...metadata,
              amount,
              basicStatAmount: continuation.basicStatAmount,
              gmwBasicBonus: e.gmwBasicBonus,
              basic: true,
              ...(power === "attack"
                ? {
                    attack: true,
                    overkill: !!e.overkill,
                    piercing:
                      !!e.piercing ||
                      quicksilverPack.quicksilverPackBasicPiercing(
                        textActiveState(s),
                      ),
                  }
                : { action: true }),
            }),
          }),
          ...(!replaced ? [E("quicksilverBasicUsed", { power })] : []),
        );
      }
      break;
    }
    case "quicksilverBasicUsed":
      add(
        s,
        ...(e.power === "attack"
          ? [
              ...quicksilverPack.quicksilverPackAfterBasicAttack(s),
              ...gmwPack.gmwPlayerPackAfterBasicAttack(s),
            ]
          : []),
        ...groot.grootAfterBasicPower(s, e.power, grootPorts),
        ...(e.power === "thwart" &&
        rocket.rocketAfterBasicThwart(s, [], rocketPorts).length
          ? [E("rocket:plan-window", { after: [] })]
          : []),
        ...quicksilver.quicksilverBasicUsed(s, e.power),
      );
      break;
    case "dvBasicDamageAfter":
      add(
        s,
        ...draxPack.draxPackBasicAttackDamageResolved(
          s,
          e.packet,
          Number(e.damageDealt || 0),
        ),
      );
      break;
    case "dvAttackDamageResponse": {
      const snapshot = e.snapshot as venomPack.VenomPackAttackDamageSnapshot;
      const identity = snapshot.target.startsWith("hero:")
        ? playerOrder(s).find((seat) => seat.id === snapshot.target.slice(5))
        : undefined;
      const ally = allInPlay(s).find(
        (p) => p.id === snapshot.target && card(p).type_code === "ally",
      );
      const surviving = identity
        ? !identity.eliminated && seatView(s, identity).player.hp > 0
        : !!ally && !ally.pendingDefeat && ally.damage < pieceHP(s, ally);
      if (!surviving || snapshot.actualDamage <= 0) break;
      const original = s.activePlayerId;
      const options = playerOrder(s).flatMap((seat) => {
        const view = seatView(s, seat);
        if (seat.eliminated || view.player.hp <= 0) return [];
        return venomPack
          .venomPackAfterAttackDamageOptions(
            view,
            snapshot,
            [{ ...e, actorId: original }],
            venomPackPorts,
          )
          .map((o) => ({
            ...o,
            id: `${seat.id}:${o.id}`,
            effects: o.effects.map((effect) => ({
              ...effect,
              actorId: seat.id,
            })),
          }));
      });
      if (options.length)
        choose(
          s,
          "Shake it Off",
          "Give the Guardian that took attack damage a tough status?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    case "quicksilverLateDefense": {
      const options = [
        ...quicksilverPack.quicksilverPackDefenseOptions(
          s,
          [e],
          quicksilverPackPorts,
        ),
        ...spectrum.spectrumDefenseOptions(s, [], [e], spectrumPorts),
      ];
      if (options.length)
        choose(
          s,
          "After defending",
          "Use an interrupt after your defense event makes you the defender?",
          [...options, option("continue", "Continue the attack", [])],
        );
      break;
    }
    case "quicksilverDamageDistribution": {
      const packets = e.packets as { target: string; amount: number }[];
      s.flags.waspDeferDefeats = true;
      try {
        for (const packet of packets)
          dealDamage(s, packet.target, packet.amount, e.source);
      } finally {
        delete s.flags.waspDeferDefeats;
      }
      for (const p of s.minions.filter((p) => p.damage >= pieceHP(s, p)))
        defeatCharacter(s, p, e.source);
      if (s.villain.hp <= 0) advanceVillain(s);
      break;
    }
    case "sgDistributedGodslayer": {
      const continuation = E("sgDistributedGodslayerAllocate", {
        batch: e.batch,
        packets: e.batch.packets,
        remaining: Number(e.amount || 0),
        gamoraPackGodslayers: e.gamoraPackGodslayers || [],
      });
      const options = gamoraPack.gamoraPackBasicAttackOptions(
        s,
        e,
        [],
        gamoraPackPorts,
      );
      if (options.length)
        choose(s, "Godslayer", "Increase the total ATK of this basic attack?", [
          ...options,
          option("continue", "Continue", [continuation]),
        ]);
      else add(s, continuation);
      break;
    }
    case "sgDistributedGodslayerAllocate": {
      const packets = e.packets as wasp.WaspPacket[];
      if (!e.remaining) {
        add(s, {
          ...e.batch,
          packets,
          gamoraGodslayerHandled: true,
          gamoraPackGodslayers: e.gamoraPackGodslayers,
        });
        break;
      }
      const allocate = (index: number, amount: number) => ({
        ...e,
        remaining: e.remaining - amount,
        packets: packets.map((packet, i) =>
          i === index ? { ...packet, amount: packet.amount + amount } : packet,
        ),
      });
      if (packets.length === 1) {
        add(s, allocate(0, e.remaining));
        break;
      }
      choose(
        s,
        "Godslayer damage",
        `Divide ${e.remaining} additional damage among the enemies already chosen for this basic attack.`,
        packets.flatMap((packet, index) =>
          Array.from({ length: e.remaining }, (_, i) => {
            const amount = i + 1;
            const enemy = find(s, packet.target);
            return option(
              `${packet.target}:${amount}`,
              `${enemy ? card(enemy).name : packet.target} · +${amount} damage`,
              [allocate(index, amount)],
              undefined,
              enemy?.code,
            );
          }),
        ),
      );
      break;
    }
    case "waspDistributedAttack": {
      const packets = e.packets as wasp.WaspPacket[];
      if (e.basic && !e.gamoraGodslayerHandled) {
        const unique = packets.find((packet) =>
          gamoraPackPorts.enemyUnique(s, packet.target),
        );
        if (unique) {
          const request = E("sgDistributedGodslayer", {
            basic: true,
            target: unique.target,
            amount: 0,
            batch: e,
            gamoraPackGodslayers: e.gamoraPackGodslayers || [],
          });
          if (
            gamoraPack.gamoraPackBasicAttackOptions(
              s,
              request,
              [],
              gamoraPackPorts,
            ).length
          ) {
            add(s, request);
            break;
          }
        }
        e.gamoraGodslayerHandled = true;
      }
      if (!e.gmwExcessHandled) {
        const index = packets.findIndex(
          (_, i) => !(e.gmwExcessChecked || []).includes(i),
        );
        if (index >= 0) {
          const packet = packets[index] as wasp.WaspPacket & {
            excessBonus?: number;
          };
          add(
            s,
            E("gmwDistributedExcess", {
              target: packet.target,
              amount: packet.amount,
              excessBonus: packet.excessBonus,
              attack: true,
              source: "hero",
              piercing: e.piercing,
              batch: e,
              index,
            }),
          );
          break;
        }
      }
      const legal = targets(s, "enemy", true);
      need(
        packets.every(
          (p) =>
            Number.isInteger(p.amount) &&
            p.amount > 0 &&
            legal.some((target) => target.id === p.target),
        ),
        "Invalid damage distribution.",
      );
      // Keep every target and continuous effect in play until all damage has
      // been placed. Native defeat interrupts and responses follow the batch.
      let damageDealt = 0;
      s.flags.waspDeferDefeats = true;
      try {
        for (const packet of packets) {
          const result = attackAction(
            s,
            packet.target,
            packet.amount,
            "hero",
            !!e.overkill,
            false,
            {
              basic: !!e.basic,
              initiated: true,
              piercing: e.piercing,
              excessBonus: (
                packet as wasp.WaspPacket & { excessBonus?: number }
              ).excessBonus,
              aftermathChooser: e.chooserId,
            },
          );
          damageDealt += Number(result?.damageDealt || 0);
        }
      } finally {
        delete s.flags.waspDeferDefeats;
      }
      const defeated = s.minions.filter((p) => p.damage >= pieceHP(s, p));
      for (const p of defeated) defeatCharacter(s, p, "hero", true);
      if (s.villain.hp <= 0) advanceVillain(s);
      if (e.basic) add(s, E("dvBasicDamageAfter", { packet: e, damageDealt }));
      break;
    }
    case "gmwDistributedExcess": {
      const options = gmwPack.gmwPlayerPackExcessOptions(
        s,
        e,
        attackExcess(s, e),
        [],
        gmwPorts,
      );
      const packets = [...e.batch.packets];
      packets[e.index] = {
        ...packets[e.index],
        excessBonus: Number(e.excessBonus || 0),
      };
      const continuation = {
        ...e.batch,
        packets,
        gmwExcessChecked: [...(e.batch.gmwExcessChecked || []), e.index],
      };
      if (options.length)
        choose(s, "Follow Through", "Increase this attack's excess damage?", [
          ...options,
          option("continue", "Continue", [continuation]),
        ]);
      else add(s, continuation);
      break;
    }
    case "gmwOverkillDamage":
      if (!find(s, e.minionId)) add(s, { ...e, type: "damage" });
      break;
    case "gmwCaptainStrikeAfter": {
      const target = find(s, e.target);
      if (
        target &&
        (target.code === e.code ||
          (target.id === s.villain.id &&
            card(target).name === card(e.code).name))
      )
        giveCharacterStatus(s, target, "stunned");
      break;
    }
    case "rocketDamageResponses": {
      const effects = rocket.rocketDamageResolved(s, e.snapshot);
      if (!effects.length) break;
      // Finish a final event sentence before its damage response. Other
      // sentences retain their physical event in the resolving area.
      const finish = s.queue.findIndex(
        (x) => x.type === "finishResolution" && x.id === e.eventId,
      );
      const pendingSentence = s.queue
        .slice(0, finish)
        .some(
          (x) =>
            !x.afterAttack &&
            ![
              "attackAftermathOrder",
              "rocketDamageResponses",
              "heroAttackResponses",
              "attackProgramEnd",
            ].includes(x.type),
        );
      const discard =
        finish >= 0 && !pendingSentence ? s.queue.splice(finish, 1) : [];
      add(
        s,
        ...discard,
        ...effects.map((x) => ({ ...x, responseGroup: undefined })),
      );
      break;
    }
    case "heroAttackResponses":
      if (
        e.excessDamage > 0 &&
        (!find(s, e.target) || find(s, e.target)?.code !== e.defeatedCode)
      )
        add(s, ...antPack.antManPackAfterAttackDefeat(s, e.excessDamage));
      add(
        s,
        ...thorAfterHeroAttack(s, {
          target: e.target,
          defeatedMinion: e.wasMinion && !find(s, e.target),
          actorId: s.activePlayerId,
        }).map((x) => ({ ...x, mandatory: false })),
        ...(e.draxBasicAttack ? drax.draxAfterBasicAttack(s, draxPorts) : []),
      );
      break;
    case "attackAftermathOrder": {
      const forced = s.queue.filter(
        (x) =>
          x.responseGroup === e.responseGroup && x.afterAttack && x.mandatory,
      );
      s.queue = s.queue.filter((x) => !forced.includes(x));
      if (forced.length < 2) add(s, ...forced);
      else
        add(
          s,
          E("forcedResponses", {
            actorId: e.chooserId || s.firstPlayerId,
            chooserId: e.chooserId,
            responses: forced.map((x, i) => ({
              id: `retaliate:${i}`,
              title: x.title,
              sourceId: x.retaliateSource,
              effects: [x],
            })),
          }),
        );
      break;
    }
    case "repeatWhenRevealed":
      reveal(s, e.piece, true, true);
      break;
    case "treacheryText":
      treachery(s, e.piece);
      break;
    case "finishResolution": {
      const p =
        (e.playedEvent as Piece | undefined) ||
        s.resolving.find((p) => p.id === e.id);
      finishResolution(s, e.id);
      if (p && card(p).type_code === "event") {
        const previous = s.activePlayerId;
        if (e.actorId || p.ownerId) activateSeat(s, e.actorId || p.ownerId);
        mtsPlayerPack.mtsPlayerPackEventFinished(s, p);
        add(
          s,
          ...gamora.gamoraAfterEvent(
            s,
            p,
            e.skipMs ? [] : msMarvelAfterEvent(s, p, []),
            gamoraPorts,
          ),
        );
        activateSeat(s, previous);
      }
      break;
    }
    case "retaliateAfterAttack":
      if (
        e.sourceTarget === "hero" ? s.player.hp > 0 : !!find(s, e.sourceTarget)
      )
        dealDamage(s, e.target, e.amount, "retaliate");
      break;
    case "forcedResponses": {
      const remaining = (
        e.responses as {
          id: string;
          title: string;
          effects: Effect[];
          sourceId?: string;
        }[]
      ).filter((r) => !r.sourceId || !!find(s, r.sourceId));
      if (!remaining.length) break;
      const next = (r: (typeof remaining)[number]) => [
        ...r.effects,
        E("forcedResponses", {
          responses: remaining.filter((x) => x.id !== r.id),
          actorId: e.chooserId || s.firstPlayerId,
          chooserId: e.chooserId,
        }),
      ];
      if (remaining.length === 1) add(s, ...next(remaining[0]));
      else
        choose(
          s,
          "Forced responses",
          "The first player chooses which simultaneous response resolves next.",
          remaining.map((r) => option(r.id, r.title, next(r))),
        );
      break;
    }
    case "indirect": {
      const allocations = e.allocations || {};
      const choices = targets(s, "controlled").filter((t) => {
        const hp =
          t.id === "hero"
            ? s.player.hp
            : pieceHP(s, find(s, t.id)!) - find(s, t.id)!.damage;
        return hp > (allocations[t.id] || 0);
      });
      if (e.amount <= 0 || !choices.length) {
        add(
          s,
          ...Object.entries(allocations).map(([target, amount]) =>
            E("damage", { target, amount, source: e.source }),
          ),
        );
        break;
      }
      choose(
        s,
        e.sourceTitle || e.source || "Indirect damage",
        `Allocate ${e.amount} remaining indirect damage. Each character can receive up to its remaining health.`,
        choices.map((t) =>
          option(t.id, t.label, [
            E("indirect", {
              ...e,
              amount: e.amount - 1,
              allocations: {
                ...allocations,
                [t.id]: (allocations[t.id] || 0) + 1,
              },
            }),
          ]),
        ),
      );
      break;
    }
    case "openingHands":
      openingHands(s);
      break;
    case "clearMainCompletion":
      s.pendingMainCompletion = false;
      break;
    case "mtsMajorDefeatWindow": {
      const p = allInPlay(s).find(
        (p) => p.id === e.id && p.code === e.piece?.code,
      );
      if (!p?.pendingDefeat) break;
      const options = allyDefeatInterruptOptions(
        s,
        p,
        e.source,
        !!e.attack,
        !!e.enemyAttack,
        e.usedMajorIds || [],
        e.originalActorId,
      );
      const after = E("finishDefeat", {
        id: p.id,
        source: e.source,
        attack: e.attack,
        enemyAttack: e.enemyAttack,
      });
      if (options.length)
        choose(
          s,
          card(p).name,
          "Resolve another defeat interrupt, or finish this ally's defeat.",
          [...options, option("defeat", "Let this ally be defeated", [after])],
        );
      else add(s, after);
      break;
    }
    case "finishDefeat": {
      const p = find(s, e.id);
      if (p) defeatCharacter(s, p, e.source, e.attack, true, !!e.enemyAttack);
      break;
    }
    case "defeatScheme": {
      const p = s.sideSchemes.find((x) => x.id === e.id);
      if (p) defeatScheme(s, p, e.source);
      break;
    }
    case "defeatSchemes": {
      const responses: Effect[] = [];
      for (const id of e.ids as string[]) {
        const p = s.sideSchemes.find((p) => p.id === id && !p.counters);
        if (!p) continue;
        const queued = s.queue.length;
        defeatScheme(s, p);
        responses.push(...s.queue.splice(0, s.queue.length - queued));
      }
      add(s, ...responses);
      break;
    }
    case "minionReactions": {
      const p = find(s, e.id);
      if (p)
        add(
          s,
          ...(keyword(p, "Quickstrike") && s.player.form === "hero"
            ? [E("enemyAttack", { id: p.id })]
            : []),
          E("minionResponses", { id: p.id }),
        );
      break;
    }
    case "minionResponses": {
      const p = find(s, e.id);
      if (p) minionResponses(s, p);
      break;
    }
    case "attackSequence":
      add(
        s,
        ...e.attacks,
        E("noAttack", {
          before: s.players.reduce(
            (n, p) => n + Number(seatView(s, p).flags.attacksPerformed || 0),
            0,
          ),
          fallback: e.fallback,
        }),
      );
      break;
    case "noAttack":
      if (
        s.players.reduce(
          (n, p) => n + Number(seatView(s, p).flags.attacksPerformed || 0),
          0,
        ) === e.before
      )
        add(s, ...e.fallback);
      break;
    case "allyEnter": {
      const p = find(s, e.id);
      if (p) allyEnter(s, p, e.paid || [], !!e.fromHand);
      break;
    }
    case "restrictedLimit":
      if (restrictedLimitExceeded(s))
        choose(
          s,
          "Restricted limit",
          "Choose a Restricted card to discard to meet your limit. Extra Weapon slots apply only to Weapon upgrades.",
          s.player.inPlay
            .filter((p) => keyword(p, "Restricted"))
            .map((p) =>
              option(p.id, card(p).name, [
                E("discardRestricted", { id: p.id }),
                E("restrictedLimit"),
              ]),
            ),
        );
      break;
    case "discardRestricted":
      discardPiece(s, e.id);
      break;
    case "allyLimit":
      if (allyCount(s) > allyLimit(s))
        choose(
          s,
          "Ally limit",
          "Choose an ally to discard to make room.",
          friends(s).map((p) =>
            option(
              p.id,
              card(p).name,
              [E("discardForLimit", { id: p.id })],
              undefined,
              p.code,
            ),
          ),
        );
      break;
    case "discardForLimit":
      discardPiece(s, e.id);
      break;
    case "mtsPackFormResponses": {
      const options = mtsPlayerPack.mtsPlayerPackFormResponseOptions(
        s,
        [{ ...e }],
        mtsPlayerPackPorts,
      );
      if (options.length)
        choose(s, "After changing form", "Choose a response, or continue.", [
          ...options,
          option("pass", "Continue", []),
        ]);
      break;
    }
    case "antFormResponses": {
      const responses: Effect[] = e.responses || [];
      const native = responses.map((response, index) =>
        option(
          `form-response:${index}`,
          response.title,
          [
            ...response.effects,
            E("antFormResponses", {
              responses: responses.filter((_, i) => i !== index),
            }),
          ],
          response.text,
          response.effects[0]?.id
            ? find(s, response.effects[0].id)?.code
            : heroCard(s).code,
        ),
      );
      const hand = [
        ...antPack.antManPackFormResponseOptions(s, antPackPorts),
        ...waspPack.waspPackFormResponseOptions(s, waspPackPorts),
      ].map((entry) => ({
        ...entry,
        effects: entry.effects.map((effect) => ({
          ...effect,
          continuation: [E("antFormResponses", { responses })],
        })),
      }));
      if (native.length || hand.length)
        choose(
          s,
          "After changing form",
          "Choose a response in any order, or continue.",
          [...native, ...hand, option("pass", "Continue", [])],
        );
      break;
    }
    case "draw":
      draw(s, e.amount);
      break;
    case "mill":
      mill(s, e.amount);
      break;
    case "attackAction":
      add(s, { ...e, type: "damage", attack: true });
      break;
    case "damage":
      if (
        e.basic &&
        !e.strangeBasicHandled &&
        s.player.form === "hero" &&
        !s.player.stunned &&
        s.player.hand.some(
          (p) =>
            p.code === "09037" &&
            canPay(s, cardCost(s, card(p)), [], p.id, p.code),
        )
      ) {
        add(s, ...doctorStrangeBasicAttackWindow(s, e, dsPorts));
        break;
      }
      if (
        e.basic &&
        !e.thorWindowHandled &&
        s.player.hand.some((p) => ["06015", "06032"].includes(p.code)) &&
        !s.player.stunned
      ) {
        add(
          s,
          ...thorBasicPowerWindow(
            s,
            { ...e, thorWindowHandled: true },
            "attack",
          ),
        );
        break;
      }
      if (
        e.basic &&
        !e.hulkWindowHandled &&
        s.heroId === "hulk" &&
        s.player.form === "hero" &&
        !s.player.stunned &&
        s.player.hand.some(
          (p) =>
            p.code === "10003" &&
            canPay(s, cardCost(s, card(p)), [], p.id, p.code),
        )
      ) {
        add(s, ...hulkBasicAttackWindow(s, { ...e, hulkWindowHandled: true }));
        break;
      }
      if (e.target?.startsWith("hero:")) {
        add(s, { ...e, target: "hero", actorId: e.target.slice(5) });
        break;
      }
      if (e.target === "hero" && e.damageDealt === undefined)
        e.damageDealt = e.amount;
      if (e.target === "hero" && !e.grootDamageHandled) {
        if (e.attack)
          discardToughForPiercing(
            s.player,
            e.amount,
            e.piercing ?? !!sourceKeyword(s, e.source || "hero", "Piercing"),
          );
        const prevented = groot.grootPreventDamage(s, "hero", e.amount);
        e.amount = Math.max(0, e.amount - prevented);
        e.grootDamageHandled = true;
        if (prevented)
          log(
            s,
            `Flora Colossus prevents ${prevented} damage with growth counters.`,
          );
      }
      if (
        !e.attack &&
        e.target === "hero" &&
        !e.msDamageDone &&
        openMsDamageWindow(s, e)
      )
        break;
      if (
        !e.attack &&
        e.target !== "hero" &&
        !e.scarletDamageDone &&
        e.amount > 0
      ) {
        const friendly = allInPlay(s).find(
          (p) => p.id === e.target && card(p).type_code === "ally",
        );
        if (friendly && !friendly.tough) {
          e.damageWindowId ||= `damage${s.nextId++}`;
          const amount = Math.max(
            0,
            e.amount - Number(s.flags[`msPrevent:${e.damageWindowId}`] || 0),
          );
          const options = scarletWitch.scarletWitchDamageOptions(
            s,
            e,
            amount,
            [e],
            scarletPorts,
          );
          if (options.length) {
            choose(
              s,
              "Incoming damage",
              `${card(friendly).name} would take ${amount} damage.`,
              [
                ...options,
                option("allow", `Take ${amount} damage`, [
                  { ...e, scarletDamageDone: true },
                ]),
              ],
            );
            break;
          }
        }
      }
      if (e.damageWindowId) {
        e.amount = Math.max(
          0,
          e.amount - Number(s.flags[`msPrevent:${e.damageWindowId}`] || 0),
        );
        delete s.flags[`msPrevent:${e.damageWindowId}`];
        delete s.flags[`msUsed:${e.damageWindowId}`];
        delete e.damageWindowId;
      }
      if (
        !e.attack &&
        e.target === "hero" &&
        !e.skip &&
        e.amount > 0 &&
        !s.player.tough &&
        e.amount > 0
      ) {
        const captainOptions = captainShieldBlockOptions(s, [
          { ...e, amount: 0, skip: true },
        ]);
        if (captainOptions.length) {
          choose(
            s,
            "Incoming damage",
            `${heroCard(s).name} would take ${e.amount} damage.`,
            [
              ...captainOptions,
              option("allow", `Take ${e.amount} damage`, [
                { ...e, skip: true },
              ]),
            ],
          );
          break;
        }
        const flight = s.player.inPlay.find((p) => rulesCode(p) === "01017");
        if (flight && s.player.form === "hero") {
          choose(
            s,
            "Incoming damage",
            `${heroCard(s).name} would take ${e.amount} damage.`,
            [
              option(
                "flight",
                "Discard Cosmic Flight · prevent 3",
                [
                  E("discardPiece", { id: flight.id }),
                  { ...e, amount: Math.max(0, e.amount - 3) },
                ],
                undefined,
                flight.code,
              ),
              option("allow", `Take ${e.amount} damage`, [
                { ...e, skip: true },
              ]),
            ],
          );
          break;
        }
      }
      if (e.heroAttackAmount) e.amount = heroStats(s).attack;
      if (e.basic && e.basicStatAmount !== undefined) {
        e.amount += heroStats(s).attack - e.basicStatAmount;
        delete e.basicStatAmount;
      }
      if (
        e.attack &&
        e.basic &&
        !e.gamoraGodslayerHandled &&
        !s.player.stunned
      ) {
        const options = gamoraPack.gamoraPackBasicAttackOptions(
          s,
          e,
          [],
          gamoraPackPorts,
        );
        if (options.length) {
          choose(
            s,
            "Godslayer",
            "Increase this basic attack against a unique enemy?",
            [
              ...options,
              option("continue", "Continue", [
                { ...e, gamoraGodslayerHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      if (!e.attack && !e.gmwStarhawkHandled && e.amount > 0) {
        const ally = allInPlay(s).find(
          (p) => p.id === e.target && card(p).type_code === "ally",
        );
        if (ally) {
          const continuation = { ...e, gmwStarhawkHandled: true };
          const options = gmwPack.gmwPlayerPackStarhawkDamageOptions(
            s,
            ally,
            e.amount,
            [continuation],
            gmwPorts,
          );
          if (options.length) {
            choose(
              s,
              "Starhawk",
              "Return Starhawk before this exact damage packet?",
              [
                ...options,
                option("allow", `Take ${e.amount} damage`, [continuation]),
              ],
            );
            break;
          }
        }
      }
      if (
        e.attack &&
        !e.gmwExcessHandled &&
        !(
          e.source && !["hero", `hero:${s.activePlayerId}`].includes(e.source)
        ) &&
        !s.player.stunned
      ) {
        const packet = {
          ...e,
          source: e.source || "hero",
          attackInitiated: true,
        };
        const options = gmwPack.gmwPlayerPackExcessOptions(
          s,
          packet,
          attackExcess(s, packet),
          [],
          gmwPorts,
        );
        if (options.length) {
          choose(s, "Follow Through", "Increase this attack's excess damage?", [
            ...options,
            option("continue", "Continue", [
              { ...packet, gmwExcessHandled: true },
            ]),
          ]);
          break;
        }
      }
      if (e.spectrumBatchId) {
        // Saved pre-placement amounts preserve all paid interrupt costs and
        // preparation windows while every recipient still has its original HP.
        seatView(s, e.spectrumBatchOwnerId).flags[
          `${e.spectrumBatchId}:${e.spectrumBatchIndex}`
        ] = e.amount;
        break;
      }
      if (e.attack) {
        const result = attackAction(
          s,
          e.target,
          e.amount,
          e.source || "hero",
          e.overkill,
          e.panther,
          {
            basic: !!e.basic,
            piercing: e.piercing,
            ranged: e.ranged,
            excessToMain: e.excessToMain,
            excessBonus: e.excessBonus,
            initiated: e.attackInitiated || e.attackAlreadyInitiated,
          },
        );
        if (e.basic && result)
          add(
            s,
            E("dvBasicDamageAfter", {
              packet: e,
              damageDealt: result.damageDealt,
            }),
          );
        if (result?.actualDamage)
          add(
            s,
            E("dvAttackDamageResponse", {
              snapshot: {
                target:
                  e.target === "hero" ? `hero:${s.activePlayerId}` : e.target,
                actualDamage: result.actualDamage,
                attack: true,
              },
            }),
          );
      } else {
        if (e.ignoreTough) s.flags.ignoreToughPacket = true;
        dealDamage(
          s,
          e.target,
          e.amount,
          e.source,
          e.attack,
          e.overkill,
          e.panther,
          {
            grootHandled: !!e.grootDamageHandled,
            damageDealt: e.damageDealt,
            damageFromAttack: !!e.damageFromAttack,
            overkillDamage: !!e.overkillDamage,
          },
        );
        delete s.flags.ignoreToughPacket;
      }
      break;
    case "heal":
      heal(s, e.target, e.amount);
      break;
    case "spectrumBatchCommit": {
      const receipts = seatView(s, e.ownerId).flags;
      const previousDefer = s.flags.waspDeferDefeats;
      s.flags.spectrumDamageBatchApplying = true;
      s.flags.waspDeferDefeats = true;
      try {
        for (const [index, target] of (e.ids as string[]).entries()) {
          const key = `${e.batchId}:${index}`;
          const amount = Number(receipts[key] ?? 0);
          delete receipts[key];
          if (
            target.startsWith("hero:") &&
            s.players.find((seat) => seat.id === target.slice(5))?.eliminated
          )
            continue;
          // Hero Flora Colossus already resolved during the saved preparation.
          dealDamage(s, target, amount, e.source, false, false, false, {
            grootHandled: true,
            damageDealt: e.amount,
          });
        }
      } finally {
        delete s.flags.spectrumDamageBatchApplying;
        if (previousDefer !== undefined)
          s.flags.waspDeferDefeats = previousDefer;
        else delete s.flags.waspDeferDefeats;
      }
      const batchFlags = s.flags;
      batchFlags.spectrumBatchDefeatSource = e.source;
      try {
        check(s);
      } finally {
        delete batchFlags.spectrumBatchDefeatSource;
      }
      // Native run/check now handles every ally/identity defeat after all
      // damage is placed, retaining the surrounding activation continuation.
      break;
    }
    case "threat":
      {
        const options = e.bwThreatDone ? [] : blackWidowThreatOptions(s, e);
        if (options.length)
          choose(
            s,
            "Main scheme threat",
            `Prevent some of the incoming ${e.amount} threat?`,
            [
              ...options,
              option("allow", `Continue with ${e.amount} threat`, [
                { ...e, bwThreatDone: true },
              ]),
            ],
          );
        else threat(s, e.target, e.amount, e.skip);
      }
      break;
    case "thwart": {
      if (
        e.basic &&
        !e.thorWindowHandled &&
        s.player.hand.some((p) => p.code === "06032") &&
        !s.player.confused
      ) {
        add(
          s,
          ...thorBasicPowerWindow(
            s,
            { ...e, thorWindowHandled: true },
            "thwart",
          ),
        );
        break;
      }
      if (e.additional) s.flags.additionalThwartPacket = true;
      if (e.basic && e.basicStatAmount !== undefined) {
        e.amount += heroStats(s).thwart - e.basicStatAmount;
        delete e.basicStatAmount;
      }
      const beforeThreat =
        e.target === "main"
          ? s.scheme.threat
          : s.sideSchemes.find((p) => p.id === e.target)?.counters || 0;
      const queuedBefore = s.queue.length;
      const removed = e.action
        ? thwartAction(
            s,
            e.target,
            e.amount,
            e.source,
            e.thwartInitiated,
            !!e.ignoreCrisis,
            !!e.thwartStatusChecked,
          )
        : thwart(s, e.target, e.amount, !!e.ignoreCrisis, e.source);
      if (e.basic && e.venomPackEntrances?.length) {
        const responses = s.queue.splice(0, s.queue.length - queuedBefore);
        add(
          s,
          ...responses,
          ...venomPack.venomPackBasicThwartEnded(
            s,
            e,
            beforeThreat > 0 && removed === beforeThreat,
          ),
        );
      }
      delete s.flags.additionalThwartPacket;
      break;
    }
    case "target":
      targetPrompt(s, e);
      break;
    case "flag":
      s.flags[e.key] = e.value;
      break;
    case "status": {
      if (e.target?.startsWith("hero:")) {
        add(s, { ...e, target: "hero", actorId: e.target.slice(5) });
        break;
      }
      const p = e.target === "hero" ? s.player : find(s, e.target);
      if (p) giveCharacterStatus(s, p, e.status);
      break;
    }
    case "exhaust":
      if (e.id === "hero") s.player.exhausted = true;
      else {
        const p = find(s, e.id);
        if (p) p.exhausted = true;
      }
      break;
    case "flip":
      flip(s, e.counts ?? false, e.target);
      break;
    case "ready":
      e.target ||= e.id;
      if (e.target?.startsWith("hero:")) {
        add(s, { ...e, target: "hero", actorId: e.target.slice(5) });
      } else if (e.target === "hero") readyIdentity(s);
      else {
        const p = find(s, e.target);
        if (p) p.exhausted = false;
      }
      break;
    case "discardHand":
      discardHand(s, e.id);
      break;
    case "discardPiece":
      discardPiece(s, e.id);
      break;
    case "counter": {
      const p = find(s, e.id);
      if (p) p.counters += e.amount;
      break;
    }
    case "useCounter": {
      const p = find(s, e.id);
      if (p) {
        p.counters--;
        if (p.counters <= 0) discardPiece(s, p.id);
      }
      break;
    }
    case "antTeamPayment": {
      const p: Piece = e.piece;
      need(
        s.player.hand.some((card) => card.id === p.id),
        "The chosen card is no longer in hand.",
      );
      if (e.target)
        need(
          allyUpgradeTargets(s, p).some((t) => t.id === e.target),
          "The chosen ally is unavailable.",
        );
      const cost =
        Math.max(
          0,
          cardCost(s, card(p)) -
            e.discount -
            (e.target ? doctorStrangeAttachedUpgradeDiscount(s, e.target) : 0),
        ) + doctorStrangeAdditionalPlayCost(s, p);
      if (p.code === "06006") {
        const options = thorLightningPaymentOptions(s, p, cost, thorPorts).map(
          (entry) => ({
            ...entry,
            effects: entry.effects.map((effect) => ({
              ...effect,
              cancelable: false,
            })),
          }),
        );
        choose(
          s,
          "Lightning Strike",
          "Choose X before paying the reduced cost.",
          options,
        );
      } else
        requestPayment(
          s,
          card(p).name,
          cost,
          [
            E("play", {
              piece: p,
              attachedTarget: e.target,
              masterInvocationId: doctorStrangeMasterInvocation(s, p)?.id,
            }),
          ],
          p.code === "10002" ? Array(cost).fill("physical") : [],
          p,
          false,
          undefined,
          p.code === "12011",
        );
      break;
    }
    case "allyUpgradePayment": {
      const p: Piece = e.piece;
      need(
        allyUpgradeTargets(s, p).some((x) => x.id === e.target),
        "The selected ally is unavailable.",
      );
      const cost = Math.max(
        0,
        cardCost(s, card(p)) -
          doctorStrangeAttachedUpgradeDiscount(s, e.target),
      );
      requestPayment(
        s,
        card(p).name,
        cost,
        [E("play", { piece: p, attachedTarget: e.target })],
        [],
        p,
        true,
      );
      break;
    }
    case "scwFreePlayRequest": {
      const p: Piece = e.piece;
      need(
        s.player.hand.some((piece) => piece.id === p.id) &&
          (e.additionalPaid ||
            e.lightningX !== undefined ||
            scarletPorts.canPlayIgnoringCost(s, p)),
        "Chaos Magic's selected card is no longer legal.",
      );
      const after = e.after || [];
      if (p.code === "14006" && e.cycloneX === undefined) {
        const enemies = quicksilverPorts
          .enemyTargets(s, false)
          .filter((target) =>
            quicksilverPorts.canGiveStatus(s, target.id, "stunned"),
          );
        need(enemies.length, "Speed Cyclone has no legal stun target.");
        choose(
          s,
          "Speed Cyclone",
          "Choose X. Chaos Magic ignores the resource cost, then discards X encounter cards.",
          enemies.map((_, index) => {
            const x = index + 1;
            return option(
              String(x),
              `X = ${x} · stun ${x} ${x === 1 ? "enemy" : "enemies"}`,
              [E("scwFreePlayRequest", { piece: p, after, cycloneX: x })],
              undefined,
              p.code,
            );
          }),
        );
        break;
      }
      if (p.code === "06006" && e.lightningX === undefined) {
        // The printed resource cost is ignored, but the X-energy cost before
        // the event's arrow remains payable and is committed atomically.
        const options = thorLightningPaymentOptions(s, p, 0, thorPorts).map(
          (option) => ({
            ...option,
            effects: option.effects.map((effect) => ({
              ...effect,
              cancelable: false,
              after: [
                E("scwFreePlayRequest", {
                  piece: p,
                  after,
                  lightningX: effect.after[0].lightningX,
                }),
              ],
            })),
          }),
        );
        need(
          options.length,
          "Lightning Strike still requires its additional X-energy cost.",
        );
        choose(
          s,
          "Lightning Strike",
          "Choose X and pay the additional energy cost. Chaos Magic ignores the printed card cost.",
          options,
        );
        break;
      }
      const masterInvocationId =
        e.masterInvocationId || doctorStrangeMasterInvocation(s, p)?.id;
      const additionalCost = doctorStrangeAdditionalPlayCost(s, p);
      if (additionalCost > 0 && !e.additionalPaid) {
        requestPayment(
          s,
          "Master of the Mystic Arts · Invocation cost",
          additionalCost,
          [
            E("scwFreePlayRequest", {
              piece: p,
              after,
              masterInvocationId,
              additionalPaid: true,
            }),
          ],
          [],
          p,
          false,
        );
        break;
      }
      const printedCost =
        card(p).cost === -1
          ? Number(e.cycloneX || 0)
          : Math.max(0, Number(card(p).cost || 0));
      add(
        s,
        E("play", {
          piece: p,
          paid: p.code === "06006" ? e.paid || [] : [],
          lightningX: e.lightningX,
          cycloneX: e.cycloneX,
          masterInvocationId,
        }),
        ...after.map((effect: Effect) =>
          effect.type === "scw:discard-batch"
            ? { ...effect, amount: printedCost }
            : effect,
        ),
      );
      break;
    }
    case "play":
      play(
        s,
        e.piece,
        e.paid,
        e.lightningX ?? e.cycloneX,
        e.masterInvocationId,
        e.attachedTarget,
        !!e.agilityHandled,
        e.overpaid || 0,
        e.paidForCard,
      );
      break;
    case "commitPaymentAllocation":
      s.prompt = e.payment;
      pay(s, e.ids, e.wildAs, e.paidForCard);
      break;
    case "restorePaymentPrompt":
      s.prompt = e.payment;
      s.queue = e.queue;
      break;
    case "playRequest":
      requestPlay(s, e.piece, !!e.discountHandled);
      break;
    case "dvEnemyAttackComplete":
      add(s, ...(e.after || []));
      break;
    case "payRequest":
      requestPayment(
        s,
        e.title,
        e.cost,
        e.after,
        e.requirements,
        e.piece,
        e.cancelable,
        e.targetCode,
        e.forcePayment,
        e.commit,
        !!e.starLordCostHandled,
        !!e.starLordApplyDiscount,
        !!e.handOnly,
        !!e.abilityCost,
      );
      break;
    case "attachPlayer": {
      const p = find(s, e.id);
      if (p) {
        const duplicate = allInPlay(s).some(
          (x) =>
            x.id !== p.id &&
            rulesCode(x) === rulesCode(p) &&
            x.attachedTo === e.target,
        );
        if (duplicate && rulesCode(p) !== "01007") {
          discardPiece(s, p.id);
          log(s, "This target already has that upgrade.");
        } else {
          p.attachedTo = e.target;
          const allyController =
            rulesCode(p) === "01074" ? controller(s, e.target) : undefined;
          if (allyController && allyController.id !== s.activePlayerId) {
            s.player.inPlay.splice(s.player.inPlay.indexOf(p), 1);
            seatView(s, allyController).player.inPlay.push(p);
          }
        }
      }
      break;
    }
    case "optional":
      choose(s, e.title, e.text, [
        option("yes", "Use ability", e.effects),
        option("skip", "Pass", []),
      ]);
      break;
    case "fromDiscard": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(...s.player.discard.splice(i, 1));
      break;
    }
    case "futurist": {
      for (const id of e.ids as string[]) {
        const i = s.player.deck.findIndex((p) => p.id === id);
        if (i >= 0) {
          const [p] = s.player.deck.splice(i, 1);
          (id === e.id ? s.player.hand : s.player.discard).push(p);
        }
      }
      recyclePlayer(s);
      break;
    }
    case "searchDeck": {
      revealHidden(s);
      const opts = s.player.deck
        .filter(
          (p) =>
            (!e.trait || card(p).traits?.includes(e.trait)) &&
            (!e.typeCode || card(p).type_code === e.typeCode),
        )
        .map((p) =>
          option(
            p.id,
            card(p).name,
            [E("fromDeck", { id: p.id })],
            plain(card(p).text),
            p.code,
          ),
        );
      choose(
        s,
        e.title,
        "Choose a card to add to your hand. Your deck will be shuffled.",
        opts,
      );
      break;
    }
    case "fromDeck": {
      const i = s.player.deck.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(...s.player.deck.splice(i, 1));
      shuffle(s, s.player.deck);
      break;
    }
    case "legalPractice":
      e.ids.forEach((id: string) => discardHand(s, id));
      if (s.player.confused) {
        consumeStatus(s.player, "confused");
        log(
          s,
          "Confused cancels Legal Practice after its discard cost is paid.",
        );
        break;
      }
      add(
        s,
        E("target", {
          group: "scheme",
          title: "Legal Practice",
          action: E("thwart", { amount: e.ids.length, action: true }),
        }),
      );
      break;
    case "ancestral":
      for (const id of e.ids) {
        const i = s.player.discard.findIndex((p) => p.id === id);
        if (i >= 0) s.player.deck.push(...s.player.discard.splice(i, 1));
      }
      shuffle(s, s.player.deck);
      break;
    case "alpha":
      e.ids.forEach((id: string) => discardHand(s, id));
      find(s, e.id)!.exhausted = true;
      draw(s, s.player.form === "alter" ? 2 : 1);
      break;
    case "chargeEnergy": {
      const p = find(s, e.id);
      if (p)
        p.counters += (e.paid as Resource[]).filter(
          (r) => r === "energy",
        ).length;
      break;
    }
    case "vision": {
      const p = find(s, e.id);
      if (p) {
        p.used = true;
        if (e.kind === "attack") p.bonusAtk = 2;
        else p.bonusThw = 2;
      }
      break;
    }
    case "thwartAll":
      if (s.player.confused) {
        consumeStatus(s.player, "confused");
        log(s, "Confused cancels the thwart ability.");
      } else for (const t of targets(s, "scheme")) thwart(s, t.id, e.amount);
      break;
    case "crisisInterdiction": {
      if (s.player.confused) {
        consumeStatus(s.player, "confused");
        log(s, "Confused cancels Crisis Interdiction.");
        break;
      }
      const removed = thwart(s, e.target, 2);
      if (
        removed ===
          2 + msMarvelEventAmountModifier(s, s.currentEventId, "thwart") &&
        aerial(s)
      )
        add(
          s,
          E("target", {
            group: "scheme",
            exclude: e.target,
            title: "Crisis Interdiction · Aerial",
            action: E("thwart", { amount: 2 }),
          }),
        );
      break;
    }
    case "returnAlly": {
      const pile = s.players
        .map((p) => seatView(s, p).player.discard)
        .find((a) => a.some((p) => p.id === e.id));
      const i = pile?.findIndex((p) => p.id === e.id) ?? -1;
      if (pile && i >= 0 && !uniqueConflict(s, card(pile[i]))) {
        const [p] = pile.splice(i, 1);
        Object.assign(p, resetPiece(p, true));
        p.counters = rulesCode(p) === "01066" ? 4 : 0;
        s.player.inPlay.push(p);
        /* put into play responses do not include Black Cat's after-you-play effect */ add(
          s,
          ...mtsPlayerPack.mtsPlayerPackCardEntered(s, p),
          E("allyLimit"),
          ...(rulesCode(p) !== "01002" ? [E("allyEnter", { id: p.id })] : []),
        );
      }
      break;
    }
    case "allyAction": {
      const p = find(s, e.id);
      if (!p) break;
      const attack = e.kind === "attack";
      if (attack && !e.mtsMarvelBoyHandled && !p.stunned) {
        const packet = { ...e, amount: e.amount ?? allyStat(s, p, "attack") };
        const options = mtsPlayerPack.mtsPlayerPackAllyBasicOptions(
          s,
          p,
          packet,
          [],
          mtsPlayerPackPorts,
        );
        if (options.length) {
          p.exhausted = true;
          choose(
            s,
            "Marvel Boy",
            "Spend a physical resource before this ally attacks?",
            [
              ...options,
              option("continue", "Continue", [
                { ...packet, mtsMarvelBoyHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      need(
        !attack ||
          p.stunned ||
          gamoraPack.gamoraPackAllyCanAttack(s, p, e.target),
        "Drax cannot attack minions.",
      );
      if (!e.starPackBeforeAllyHandled && !(attack ? p.stunned : p.confused)) {
        const packet = {
          ...e,
          amount: e.amount ?? allyStat(s, p, attack ? "attack" : "thwart"),
        };
        const options = starLordPack.starLordPackBeforeAllyBasicOptions(
          s,
          p,
          packet,
          [],
          starLordPackPorts,
        );
        if (options.length) {
          p.exhausted = true;
          choose(
            s,
            "Ally initiates basic power",
            "Use an interrupt before this ally's attack or thwart?",
            [
              ...options,
              option("continue", "Continue", [
                { ...packet, starPackBeforeAllyHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      if (attack && !e.gmwRocketAllyHandled && !p.stunned) {
        const packet = { ...e, amount: e.amount ?? allyStat(s, p, "attack") };
        const options = gmwPack.gmwPlayerPackAllyAttackOptions(
          s,
          p,
          packet,
          [],
          gmwPorts,
        );
        if (options.length) {
          p.exhausted = true;
          choose(
            s,
            "Rocket Raccoon",
            "Use Rocket's interrupt against this minion?",
            [
              ...options,
              option("continue", "Continue", [
                { ...packet, gmwRocketAllyHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      if (attack && !e.scarletLastHandled && !p.stunned) {
        const continuation = {
          ...e,
          amount: e.amount ?? allyStat(s, p, "attack"),
          scarletLastHandled: true,
        };
        const options = scarletPack.scarletWitchPackAllyAttackOptions(
          s,
          p,
          [continuation],
          scarletPackPorts,
        );
        if (options.length) {
          p.exhausted = true;
          choose(s, "Last Stand", "Increase this ally's attack?", [
            ...options,
            option("continue", "Continue", [continuation]),
          ]);
          break;
        }
      }
      if (
        p.code === "14002" &&
        !e.quicksilverAllyHandled &&
        !(attack ? p.stunned : p.confused) &&
        !isTextBlank(s, p)
      ) {
        p.exhausted = true;
        add(
          s,
          ...(quicksilver.quicksilverBeforeAllyBasic(
            s,
            p,
            attack ? "attack" : "thwart",
            [
              {
                ...e,
                amount:
                  e.amount ?? allyStat(s, p, attack ? "attack" : "thwart"),
                quicksilverAllyHandled: true,
              },
            ],
            quicksilverPorts,
          ) || []),
        );
        break;
      }
      if (attack && p.code === "09014" && !e.strangeAllyHandled && !p.stunned) {
        p.exhausted = true;
        add(
          s,
          ...doctorStrangeBeforeAllyAttack(s, p, e.target, [
            { ...e, strangeAllyHandled: true },
          ]),
        );
        break;
      }
      if (p.code === "03014" && attack) p.exhausted = true;
      const stunned = attack ? p.stunned : p.confused;
      const minionTarget = attack
        ? s.minions.find((minion) => minion.id === e.target)
        : undefined;
      const enemyTarget = attack ? find(s, e.target) : undefined;
      const attackedEnemySnapshot = enemyTarget
        ? {
            id: enemyTarget.id,
            code: enemyTarget.code,
            stage:
              enemyTarget.id === s.villain.id ? s.villain.stage : undefined,
          }
        : undefined;
      const queuedBefore = s.queue.length;
      const bonus = attack
        ? scarletPack.scarletWitchPackAllyAttackBonus(s, p)
        : 0;
      const amount =
        (e.amount ?? allyStat(s, p, attack ? "attack" : "thwart") - bonus) +
        bonus;
      if (attack)
        attackAction(s, e.target, amount, p.id, !!e.overkill, false, {
          piercing: e.piercing,
          ranged: e.ranged,
        });
      else thwartAction(s, e.target, amount, p.id);
      if (stunned) break;
      const responses = s.queue.splice(0, s.queue.length - queuedBefore);
      const defeatKey = `dvAllyDefeat:${p.id}:${s.nextId++}`;
      add(
        s,
        ...responses,
        E("dvAllyAttackSnapshot", {
          key: defeatKey,
          attackedEnemy: attackedEnemySnapshot,
        }),
        E("allyResponse", {
          id: p.id,
          attack,
          attackedMinion: minionTarget
            ? { id: minionTarget.id, code: minionTarget.code }
            : undefined,
        }),
        E("allyConsequence", {
          id: p.id,
          attack,
          defeatKey,
          amount: starLordPack.starLordPackConsequentialDamage(
            e,
            attack
              ? (card(p).attack_cost || 0) +
                  captainPackModifiers(s, p.id).consequentialAttack
              : card(p).thwart_cost || 0,
          ),
        }),
        ...(attack ? [E("scarletAfterAllyAttack", { id: p.id })] : []),
      );
      break;
    }
    case "allyResponse": {
      const p = find(s, e.id);
      if (!p) break;
      add(
        s,
        ...starLordPack.starLordPackAfterAllyBasic(s, p, {
          attack: !!e.attack,
          defeatedMinion:
            !!e.attackedMinion &&
            !s.minions.some(
              (minion) =>
                minion.id === e.attackedMinion.id &&
                minion.code === e.attackedMinion.code,
            ),
        }),
      );
      if (!e.attack)
        add(
          s,
          ...scarletPack.scarletWitchPackAfterAllyThwart(s, p),
          ...venomPack.venomPackAfterAllyThwart(s, p),
        );
      add(s, ...draxPack.draxPackAfterAllyBasic(s, p));
      add(s, ...mtsPlayerPack.mtsPlayerPackAfterAllyBasic(s, p));
      add(s, ...hulkPackAllyResponse(s, p, !!e.attack));
      add(
        s,
        ...spiderWomanAllyBasicUsed(s, p, e.attack ? "attack" : "thwart"),
        ...antPack.antManPackAfterAllyBasic(s, p),
      );
      if (rulesCode(p) === "01058" && !e.attack)
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Daredevil",
            action: E("damage", { amount: 1, source: p.id }),
          }),
        );
      if (rulesCode(p) === "01050" && e.attack)
        add(s, E("hulk", { source: p.id }));
      break;
    }
    case "allyConsequence": {
      const p = find(s, e.id);
      const defeatedEnemy = !!s.flags[e.defeatKey];
      if (e.defeatKey) delete s.flags[e.defeatKey];
      if (p && e.amount)
        add(
          s,
          E("damage", {
            target: p.id,
            amount: e.amount,
            source: "consequential",
          }),
          E("dvAllyConsequenceAfter", {
            id: p.id,
            beforeDamage: p.damage,
            attack: !!e.attack,
            defeatedEnemy,
          }),
        );
      break;
    }
    case "dvAllyAttackSnapshot":
      s.flags[e.key] =
        !!e.attackedEnemy &&
        (!find(s, e.attackedEnemy.id) ||
          find(s, e.attackedEnemy.id)?.code !== e.attackedEnemy.code ||
          (e.attackedEnemy.id === s.villain.id &&
            s.villain.stage !== e.attackedEnemy.stage));
      break;
    case "dvRegroupDefeatAfter":
      if (e.playerId)
        add(
          s,
          E("bwAllyDefeated", {
            piece: e.piece,
            playerId: e.playerId,
            actorId: e.playerId,
          }),
        );
      log(
        s,
        `${card(e.piece).name} is defeated and returns to its owner's hand.`,
        "good",
      );
      break;
    case "dvAllyConsequenceAfter": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      if (p)
        add(
          s,
          ...draxPack.draxPackAfterAllyConsequence(
            s,
            p,
            {
              attack: !!e.attack,
              defeatedEnemy: !!e.defeatedEnemy,
              actualDamage: Math.max(0, p.damage - e.beforeDamage),
            },
            draxPackPorts,
          ),
        );
      break;
    }
    case "hulk": {
      const p = mill(s, 1)[0];
      if (!p) break;
      const res = resources(card(p));
      log(s, `Hulk reveals ${card(p).name}.`);
      if (res.includes("physical") || res.includes("wild"))
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Hulk",
            action: E("damage", { amount: 2, source: e.source }),
          }),
        );
      if (res.includes("energy") || res.includes("wild"))
        add(
          s,
          ...[...targets(s, "enemy"), ...targets(s, "friendly")].map((t) =>
            E("damage", { target: t.id, amount: 1, source: e.source }),
          ),
        );
      if (res.includes("mental") || res.includes("wild")) {
        const h = s.player.inPlay.find((p) => rulesCode(p) === "01050");
        if (h) add(s, E("discardPiece", { id: h.id }));
      }
      break;
    }
    case "wakanda": {
      const remaining = (e.remaining as string[]).filter((id) => find(s, id));
      if (!remaining.length) break;
      choose(
        s,
        "Wakanda Forever!",
        remaining.length === 1
          ? "Resolve the final upgrade with its enhanced effect."
          : "Choose the next upgrade. The last one gets its enhanced effect.",
        remaining.map((id) => {
          const p = find(s, id)!;
          return option(
            id,
            card(p).name,
            [
              E("pantherSpecial", { id, final: remaining.length === 1 }),
              E("wakanda", { remaining: remaining.filter((x) => x !== id) }),
            ],
            plain(card(p).text),
            p.code,
          );
        }),
      );
      break;
    }
    case "pantherSpecial": {
      const p = find(s, e.id);
      if (!p) break;
      const k = e.final ? 2 : 1;
      if (rulesCode(p) === "01046")
        choose(
          s,
          "Energy Daggers",
          "Choose a hero’s engaged enemies. The villain is also hit.",
          playerOrder(s).map((seat) =>
            option(
              seat.id,
              HEROES.find((h) => h.id === seat.heroId)!.name,
              [s.villain, ...engaged(s, seat.id)].map((p) =>
                E("damage", { target: p.id, amount: k, panther: true }),
              ),
            ),
          ),
        );
      if (rulesCode(p) === "01047")
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Panther Claws",
            action: E("damage", { amount: k * 2, attack: true, panther: true }),
          }),
        );
      if (rulesCode(p) === "01048")
        add(
          s,
          E("target", {
            group: "scheme",
            title: "Tactical Genius",
            action: E("thwart", { amount: k, action: true }),
          }),
        );
      if (rulesCode(p) === "01049" && s.player.hp < maxHP(s))
        add(
          s,
          E("target", {
            group: "enemy",
            title: "Vibranium Suit",
            action: E("moveDamage", {
              amount: Math.min(k, maxHP(s) - s.player.hp),
              attack: true,
            }),
          }),
        );
      break;
    }
    case "moveDamage":
      if (s.player.stunned) {
        consumeStatus(s.player, "stunned");
        break;
      }
      if (find(s, e.target)?.code === "01157") {
        log(s, "Killmonger is immune to Vibranium Suit.");
        break;
      }
      heal(s, "hero", e.amount);
      add(
        s,
        E("damage", {
          target: e.target,
          amount: e.amount,
          source: "hero",
          attack: true,
          panther: true,
          attackInitiated: true,
        }),
      );
      break;
    case "emergency": {
      const reduction = s.player.confused ? 0 : 1;
      if (s.player.confused) {
        consumeStatus(s.player, "confused");
        log(s, "Confused cancels Emergency.");
      }
      add(
        s,
        ...e.after.map((effect: Effect) =>
          (effect.type === "threat" && effect.target === "main") ||
          effect.type === "mill"
            ? { ...effect, amount: Math.max(0, effect.amount - reduction) }
            : effect,
        ),
      );
      break;
    }
    case "schemeWindow":
      schemeWindow(s, e.id, e.amount, e.after);
      break;
    case "revealSchemeBoost": {
      const a = s.scheming;
      if (!a) break;
      const p = a.pendingBoosts.shift();
      if (p) {
        beginResolution(s, p);
        a.boostCodes.push(p.code);
        a.boostIds.push(p.id);
        log(
          s,
          `Scheme boost: ${card(p).name} adds ${card(p).boost || 0}.`,
          "bad",
        );
        add(s, E("boostInterruptWindow", { piece: p, scheme: true }));
      }
      break;
    }
    case "finishScheme":
      finishScheme(s);
      break;
    case "endScheme": {
      const activation = s.scheming;
      if (activation?.activationAfter)
        add(s, {
          ...activation.activationAfter,
          performed: true,
          damagePlaced: 0,
          threatPlaced:
            (s.stats?.threatPlaced || 0) - (activation.threatBefore || 0),
        });
      delete s.scheming;
      break;
    }
    case "declareDefense":
      declareDefense(s);
      break;
    case "drone":
      addDrone(s);
      break;
    case "enemyAttack":
      enemyAttack(s, e.id, e.extra);
      break;
    case "enemyTargetAttackComplete": {
      const a = e.snapshot as NonNullable<GameState["attack"]>;
      s.attack = null;
      add(
        s,
        ...antMan.antManEnemyActivated(s, a.attacker),
        ...(a.completionRecorded && a.attackerSnapshot
          ? spectrum.spectrumEnemyActivated(
              s,
              a.attackerSnapshot,
              a.targetPlayerId || s.activePlayerId,
              spectrumPorts,
            )
          : []),
        ...(a.afterActivation || []),
        ...a.boostEffects,
        ...(a.boostIds || []).map((id) => E("finishResolution", { id })),
        E("scarletEnemyActivated", {
          id: a.attacker,
          actorId: a.originalPlayerId || s.activePlayerId,
          againstPlayer: false,
        }),
        ...(a.activationAfter
          ? [
              {
                ...a.activationAfter,
                performed: true,
                damagePlaced: a.damagePlaced || 0,
                threatPlaced: 0,
              },
            ]
          : []),
      );
      break;
    }
    case "enemyAttackInitiationWindow": {
      const a = s.attack;
      if (!a || a.attacker !== e.attacker) break;
      const attacker = find(s, a.attacker);
      if (!attacker) {
        abortAttack(s);
        break;
      }
      a.modifier = e.modifier ?? a.modifier;
      const usedIds: string[] = e.usedIds || [];
      const packet = {
        ...e,
        actorId: e.playerId,
        modifier: a.modifier || 0,
        usedIds,
      };
      const resume = (id: string) => ({
        ...packet,
        usedIds: [...usedIds, id],
      });
      const scoped = (seatId: string, options: Option[]) =>
        options.map((entry) => ({
          ...entry,
          id: seatId === s.activePlayerId ? entry.id : `${seatId}:${entry.id}`,
          effects: entry.effects.map((effect) => ({
            ...effect,
            actorId: seatId,
          })),
        }));
      const options: Option[] = [];
      for (const seat of playerOrder(s)) {
        const view = seatView(s, seat);
        const nova = msMarvelAttackInitiatedOptions(view, attacker, [], msPorts)
          .filter((entry) => !usedIds.includes(entry.id))
          .map((entry) => ({
            ...entry,
            effects: entry.effects.map((effect) => ({
              ...effect,
              after: [resume(entry.id)],
            })),
          }));
        const againstPlayer =
          !a.originalTarget ||
          a.originalTarget === "hero" ||
          a.originalTarget.startsWith("hero:");
        const mockingbird = (
          againstPlayer
            ? hawkeyeAttackInitiatedOptions(view, attacker, hawkeyePorts)
            : []
        )
          .filter((entry) => !usedIds.includes(entry.id))
          .map((entry) => ({
            ...entry,
            effects: entry.effects.map((effect) =>
              effect.type === "payRequest"
                ? {
                    ...effect,
                    after: [...(effect.after || []), resume(entry.id)],
                  }
                : effect,
            ),
          }));
        const firstHit = a.isVillain
          ? []
          : gamoraPack.gamoraPackFirstHitOptions(
              view,
              attacker,
              [packet],
              gamoraPackPorts,
            );
        const subdue = draxPack.draxPackAttackInitiatedOptions(
          view,
          attacker,
          packet,
          [],
          draxPackPorts,
        );
        const identity = againstPlayer
          ? venom.venomAttackInitiatedOptions(
              view,
              {
                attacker: a.attacker,
                playerId: e.playerId,
                isVillain: a.isVillain,
                usedIds,
                sharedWindow: packet,
              },
              [],
              venomPorts,
            )
          : [];
        const pip = againstPlayer
          ? warlock.warlockAttackInitiatedOptions(
              view,
              e.playerId,
              [packet],
              warlockPorts,
            )
          : [];
        options.push(
          ...scoped(seat.id, [
            ...nova,
            ...mockingbird,
            ...firstHit,
            ...subdue,
            ...identity,
            ...pip,
          ]),
        );
      }
      if (options.length)
        choose(
          s,
          "Enemy initiates attack",
          "Use an interrupt before revealing boost cards?",
          [...options, option("continue", "Continue the attack", [])],
        );
      break;
    }
    case "attackKeyword":
      if (s.attack && e.keyword === "piercing") s.attack.piercing = true;
      break;
    case "enemyScheme":
      enemyScheme(s, e.id, e.extra);
      break;
    case "defensePrompt":
      choose(
        s,
        `${e.name} attacks`,
        `${e.base} base ATK${e.isVillain ? " + facedown boost cards" : ""}. Choose your defender before boosts are revealed.`,
        e.options,
      );
      break;
    case "defender":
      if (s.attack) {
        s.attack.defender = e.id;
        s.attack.targetPlayerId = s.activePlayerId;
        log(
          s,
          e.id === "none"
            ? `${heroCard(s).name} takes the attack undefended.`
            : `${e.id === "hero" ? heroCard(s).name : card(find(s, e.id)!).name} defends the attack.`,
        );
        if (e.id === "hero") {
          s.attack.basicDefense = true;
          s.player.exhausted = true;
          s.attack.defense = heroStats(s).defense;
        } else if (e.id !== "none") {
          const p = find(s, e.id);
          if (p) p.exhausted = true;
        }
        if (e.id === "hero") add(s, E("spectrumDefenseWindow", { used: [] }));
      }
      break;
    case "spectrumDefenseWindow": {
      const options = spectrum.spectrumDefenseOptions(
        s,
        e.used || [],
        [],
        spectrumPorts,
      );
      if (options.length)
        choose(
          s,
          "Spectrum defense interrupts",
          "Play Pulsar Shield when Spectrum defends?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    case "boostAttack": {
      const a = s.attack;
      if (!a) break;
      if (!e.venomPistolHandled) {
        const after = [{ ...e, venomPistolHandled: true }];
        const options = venom.venomBasicPowerOptions(
          s,
          "defense",
          after,
          venomPorts,
        );
        if (options.length) {
          choose(
            s,
            "Basic power interrupts",
            "Use Venom's Pistol for this basic defense?",
            [...options, option("continue", "Continue", after)],
          );
          break;
        }
      }
      if (!e.expertChecked) {
        const options = [
          ...groot.grootDefenseOptions(s, [E("boostAttack")], grootPorts),
          ...gmwPack.gmwPlayerPackDefenseOptions(
            s,
            [E("boostAttack")],
            gmwPorts,
          ),
          ...wasp.waspDefenseOptions(s, [E("boostAttack")], waspPorts),
          ...quicksilverPack.quicksilverPackDefenseOptions(
            s,
            [E("boostAttack")],
            quicksilverPackPorts,
          ),
          ...doctorStrangeDefenseOptions(s, [E("boostAttack")], dsPorts),
          ...captainPackExpertDefenseOptions(s, [E("boostAttack")]),
        ];
        if (options.length) {
          choose(
            s,
            "Defense interrupts",
            "Use a defense interrupt before revealing boost cards?",
            [
              ...options,
              option("continue", "Continue the attack", [
                E("boostAttack", { expertChecked: true }),
              ]),
            ],
          );
          break;
        }
      }
      if (!a.pendingBoosts) prepareAttackBoosts(s);
      add(s, E(a.pendingBoosts?.length ? "revealBoost" : "damageWindow"));
      break;
    }
    case "prepareAttackBoosts":
      prepareAttackBoosts(s);
      break;
    case "revealBoost": {
      const a = s.attack;
      if (!a) break;
      // Saves from before the 1.8 update stored individual reveal steps.
      const legacy = !a.pendingBoosts;
      const p =
        e.piece || (legacy ? drawEncounter(s) : a.pendingBoosts!.shift());
      if (p) {
        beginResolution(s, p);
        const boostIds = (a.boostIds ||= []);
        // Legacy saves retained already revealed codes without physical IDs.
        // Keep their positions aligned before adding this newly revealed face.
        while (boostIds.length < a.boostCodes.length) boostIds.push("");
        boostIds.push(p.id);
        a.base += card(p).boost || 0;
        a.boostCodes.push(p.code);
        add(s, E("boostInterruptWindow", { piece: p, legacy }));
      }
      log(
        s,
        `Attack total: ${a.base}${a.boostCodes.length ? ` · Boost: ${a.boostCodes.map((c) => `${card(c).name} (+${card(c).boost || 0})`).join(", ")}` : ""}.`,
        "bad",
      );
      break;
    }
    case "boostInterruptWindow": {
      const after = [{ ...e }];
      const original = s.activePlayerId;
      const options = blackWidowBoostOptions(
        s,
        e.piece,
        "interrupt",
        after,
        bwPorts,
      );
      if (!e.scheme && bwPorts.numericBoostIcons(s, e.piece.id) > 0)
        options.push(
          ...playerOrder(s).flatMap((seat) =>
            msMarvelBoostOptions(
              seatView(s, seat),
              e.piece,
              after.map((x) => ({ ...x, actorId: original })),
              msPorts,
            ).map((o) => ({
              ...o,
              id: `${seat.id}:${o.id}`,
              effects: o.effects.map((x) => ({ ...x, actorId: seat.id })),
            })),
          ),
        );
      if (e.scheme && bwPorts.numericBoostIcons(s, e.piece.id) > 0)
        options.push(
          ...playerOrder(s).flatMap((seat) =>
            doctorStrangeSchemeBoostOptions(
              seatView(s, seat),
              e.piece,
              after.map((e) => ({ ...e, actorId: original })),
              dsPorts,
            ).map((o) => ({
              ...o,
              id: `${seat.id}:${o.id}`,
              effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
            })),
          ),
        );
      if (options.length)
        choose(
          s,
          "Boost card revealed",
          "Use an interrupt before resolving this boost?",
          [
            ...options,
            option("continue", "Continue", [
              { ...e, type: "boostResponseWindow" },
            ]),
          ],
        );
      else add(s, { ...e, type: "boostResponseWindow" });
      break;
    }
    case "boostResponseWindow": {
      const options = blackWidowBoostOptions(
        s,
        e.piece,
        "response",
        [e],
        bwPorts,
      );
      const after = [
        ...(card(e.piece).boost_star
          ? [E("boostEffect", { piece: e.piece })]
          : []),
        E("completeBoost", {
          id: e.piece.id,
          scheme: e.scheme,
          legacy: e.legacy,
        }),
      ];
      if (options.length)
        choose(s, "Boost ability", "Cancel this boost ability?", [
          ...options,
          option("continue", "Resolve the boost card", after),
        ]);
      else add(s, ...after);
      break;
    }
    case "completeBoost":
      if (!e.scarletCounted && !s.boostCancellations?.[e.id]?.icons) {
        countActivationBoost(s, e.id, [{ ...e, scarletCounted: true }]);
        break;
      }
      if (s.boostCancellations) delete s.boostCancellations[e.id];
      if (s.attack?.targetPlayerId && !e.scheme)
        activateSeat(s, s.attack.targetPlayerId);
      if (!(s.scheming || s.attack)?.retainedBoostIds?.includes(e.id))
        finishResolution(s, e.id);
      if (e.legacy) break;
      if (e.scheme && s.scheming)
        add(
          s,
          E(
            s.scheming.pendingBoosts.length
              ? "revealSchemeBoost"
              : "finishScheme",
          ),
        );
      else if (!e.scheme && s.attack)
        add(
          s,
          E(s.attack.pendingBoosts?.length ? "revealBoost" : "damageWindow"),
        );
      break;
    case "legacyBoost":
      resolve(s, { ...e, type: "revealBoost" });
      break;
    case "boostEffect":
      if (s.boostCancellations?.[e.piece.id]?.ability) break;
      if (s.attack?.targetPlayerId) activateSeat(s, s.attack.targetPlayerId);
      boostEffects(s, e.piece);
      break;
    case "damageWindow": {
      const a = s.attack;
      if (!a) break;
      if (!find(s, a.attacker)) {
        abortAttack(s);
        break;
      }
      calculateAttack(s);
      if (a.preventAllDamage) {
        add(s, E("finishAttack"));
        break;
      }
      if (attackTargetsEnemy(s, a)) {
        add(s, E("finishAttack"));
        break;
      }
      const damageTarget =
        a.defender && a.defender !== "none"
          ? a.defender
          : a.originalTarget || "hero";
      const heroTarget = damageTarget === "hero";
      const receiving = heroTarget ? s.player : find(s, damageTarget);
      const incoming = a.preventAllDamage
        ? 0
        : Math.max(0, a.base - a.defense - a.prevented);
      if (receiving)
        discardToughForPiercing(
          receiving,
          incoming,
          !!sourceKeyword(s, a.attacker, "Piercing"),
        );
      if (heroTarget && !a.grootDamageHandled) {
        const prevented = groot.grootPreventDamage(s, "hero", incoming);
        a.prevented += prevented;
        a.grootDamageHandled = true;
        if (prevented)
          log(
            s,
            `Flora Colossus prevents ${prevented} damage with growth counters.`,
          );
      }
      if (
        !heroTarget &&
        !a.originalTarget &&
        a.overkill &&
        !a.grootOverkillHandled
      ) {
        const ally = find(s, damageTarget);
        const excess =
          ally && !ally.tough
            ? Math.max(
                0,
                incoming -
                  (pieceHP(s, ally) - ally.damage) -
                  (a.identityPrevented || 0),
              )
            : 0;
        const prevented = groot.grootPreventDamage(s, "hero", excess);
        a.identityPrevented = (a.identityPrevented || 0) + prevented;
        a.grootOverkillHandled = true;
        if (prevented)
          log(
            s,
            `Flora Colossus prevents ${prevented} overkill damage with growth counters.`,
          );
      }
      const opts = [
        option(
          "resolve",
          `Resolve ${Math.max(0, a.base - a.defense - a.prevented)} damage`,
          [E("finishAttack")],
        ),
      ];
      const shieldTarget = damageTarget;
      if (heroTarget) {
        const packet = {
          type: "attackDamage",
          kind: "attack",
          target: "hero",
          attack: true,
        };
        const amount = Math.max(0, a.base - a.defense - a.prevented);
        opts.unshift(
          ...drax.draxDamageOptions(
            s,
            packet,
            amount,
            [E("damageWindow")],
            draxPorts,
          ),
          ...draxPack.draxPackDamageOptions(
            s,
            packet,
            amount,
            [E("damageWindow")],
            draxPackPorts,
          ),
          ...mtsPlayerPack.mtsPlayerPackDamageOptions(
            s,
            packet,
            a.preventAllDamage ? 0 : amount,
            [E("damageWindow")],
            mtsPlayerPackPorts,
          ),
          ...starLord.starLordDamageOptions(
            s,
            packet,
            amount,
            [E("damageWindow")],
            starLordPorts,
          ),
          ...gamora.gamoraDamageOptions(
            s,
            packet,
            amount,
            [E("damageWindow")],
            gamoraPorts,
          ),
        );
      }
      if (!(heroTarget ? s.player.tough : find(s, shieldTarget)?.tough))
        opts.unshift(
          ...scarletWitch.scarletWitchDamageOptions(
            s,
            { type: "attackDamage", kind: "attack", target: shieldTarget },
            Math.max(0, a.base - a.defense - a.prevented),
            [E("damageWindow")],
            scarletPorts,
          ),
        );
      if (heroTarget)
        opts.unshift(
          ...gmwPack.gmwPlayerPackDamageOptions(
            s,
            { type: "attackDamage", kind: "attack", target: "hero" },
            Math.max(0, a.base - a.defense - a.prevented),
            [E("damageWindow")],
            gmwPorts,
          ),
        );
      if (heroTarget)
        opts.unshift(
          ...quicksilverPack.quicksilverPackDamageOptions(
            s,
            {
              target: "hero",
              playerId: s.activePlayerId,
              amount: Math.max(0, a.base - a.defense - a.prevented),
              attack: true,
              source: a.attacker,
            },
            [E("damageWindow")],
            quicksilverPackPorts,
          ),
        );
      if (heroTarget)
        opts.unshift(
          ...wasp.waspDamageOptions(
            s,
            undefined,
            Math.max(0, a.base - a.defense - a.prevented),
            [E("damageWindow")],
            waspPorts,
          ),
        );
      if (heroTarget)
        opts.unshift(
          ...warningOptions(
            s,
            {
              target: "hero",
              playerId: s.activePlayerId,
              amount: Math.max(0, a.base - a.defense - a.prevented),
              attack: true,
            },
            [E("damageWindow")],
          ),
        );
      if (heroTarget)
        opts.unshift(
          ...blackWidowDamageOptions(
            s,
            {
              target: "hero",
              playerId: s.activePlayerId,
              amount: Math.max(0, a.base - a.defense - a.prevented),
              attack: true,
            },
            [E("damageWindow")],
          ),
        );
      if (heroTarget)
        opts.unshift(
          ...msMarvelDamageOptions(
            s,
            {
              target: "hero",
              amount: Math.max(0, a.base - a.defense - a.prevented),
              attack: true,
            },
            [E("damageWindow")],
            msPorts,
          )
            .filter((o) => !a.interruptsUsed?.includes(o.id))
            .map((o) => ({
              ...o,
              effects: [
                ...(s.player.inPlay.some((p) => p.id === o.id)
                  ? [E("ms:mark-attack-interrupt", { id: o.id })]
                  : []),
                ...o.effects,
              ],
            })),
        );
      if (!heroTarget && a.overkill) {
        const ally = find(s, damageTarget);
        const excess =
          ally && !ally.tough
            ? Math.max(
                0,
                a.base -
                  a.defense -
                  a.prevented -
                  (pieceHP(s, ally) - ally.damage) -
                  (a.identityPrevented || 0),
              )
            : 0;
        if (!s.player.tough)
          opts.unshift(
            ...drax.draxDamageOptions(
              s,
              {
                type: "damage",
                kind: "overkill",
                target: "hero",
                attack: true,
              },
              excess,
              [E("damageWindow")],
              draxPorts,
            ),
            ...draxPack.draxPackDamageOptions(
              s,
              {
                type: "damage",
                kind: "overkill",
                target: "hero",
                attack: true,
              },
              excess,
              [E("damageWindow")],
              draxPackPorts,
            ),
            ...mtsPlayerPack.mtsPlayerPackDamageOptions(
              s,
              {
                type: "damage",
                kind: "overkill",
                target: "hero",
                attack: true,
              },
              a.preventAllDamage ? 0 : excess,
              [E("damageWindow")],
              mtsPlayerPackPorts,
            ),
            ...starLord.starLordDamageOptions(
              s,
              { type: "damage", kind: "overkill", target: "hero" },
              excess,
              [E("damageWindow")],
              starLordPorts,
            ),
            ...gamora.gamoraDamageOptions(
              s,
              { type: "damage", kind: "overkill", target: "hero" },
              excess,
              [E("damageWindow")],
              gamoraPorts,
            ),
            ...scarletWitch.scarletWitchDamageOptions(
              s,
              { type: "damage", kind: "overkill", target: "hero" },
              excess,
              [E("damageWindow")],
              scarletPorts,
            ),
          );
        opts.unshift(
          ...gmwPack.gmwPlayerPackDamageOptions(
            s,
            { type: "damage", kind: "overkill", target: "hero" },
            excess,
            [E("damageWindow")],
            gmwPorts,
          ),
        );
        opts.unshift(
          ...quicksilverPack.quicksilverPackDamageOptions(
            s,
            {
              target: "hero",
              playerId: s.activePlayerId,
              amount: excess,
              attack: true,
              source: a.attacker,
              packet: { type: "damage", kind: "overkill" },
            },
            [E("damageWindow")],
            quicksilverPackPorts,
          ),
        );
        opts.unshift(
          ...wasp.waspDamageOptions(
            s,
            { type: "damage", kind: "overkill" },
            excess,
            [E("damageWindow")],
            waspPorts,
          ),
        );
        opts.unshift(
          ...warningOptions(
            s,
            {
              target: "hero",
              playerId: s.activePlayerId,
              amount: excess,
              attack: true,
              packet: { type: "damage", kind: "overkill" },
            },
            [E("damageWindow")],
          ),
        );
        opts.unshift(
          ...blackWidowDamageOptions(
            s,
            {
              target: "hero",
              playerId: s.activePlayerId,
              amount: excess,
              attack: true,
              packet: { type: "damage", kind: "overkill" },
            },
            [E("damageWindow")],
          ),
        );
        opts.unshift(
          ...msMarvelDamageOptions(
            s,
            {
              target: "hero",
              amount: excess,
              attack: true,
              packet: { type: "damage", kind: "overkill" },
            },
            [E("damageWindow")],
            msPorts,
          )
            .filter((o) => !a.interruptsUsed?.includes(o.id))
            .map((o) => ({
              ...o,
              effects: [
                ...(s.player.inPlay.some((p) => p.id === o.id)
                  ? [E("ms:mark-attack-interrupt", { id: o.id })]
                  : []),
                ...o.effects,
              ],
            })),
        );
      }
      if (heroTarget && a.base - a.defense - a.prevented > 0)
        opts.unshift(
          ...captainShieldBlockOptions(s, [
            E("preventAttack", {
              amount: Math.max(0, a.base - a.defense - a.prevented),
            }),
            E("finishAttack"),
          ]),
        );
      if (
        heroTarget &&
        !s.player.tough &&
        s.player.form === "hero" &&
        a.base - a.defense - a.prevented > 0
      ) {
        const back = s.player.hand.find((p) => rulesCode(p) === "01003");
        if (back)
          opts.unshift(
            option(
              "backflip",
              "Backflip · prevent all damage",
              [
                E("resolveHandEvent", {
                  id: back.id,
                  after: [E("preventAttack", { amount: 99 })],
                }),
                E("finishAttack"),
              ],
              undefined,
              "01003",
            ),
          );
        const flight = s.player.inPlay.find((p) => rulesCode(p) === "01017");
        if (flight && s.player.form === "hero")
          opts.unshift(
            option(
              "flight",
              "Discard Cosmic Flight · prevent 3",
              [
                E("discardPiece", { id: flight.id }),
                E("preventAttack", { amount: 3 }),
                E("damageWindow"),
              ],
              undefined,
              "01017",
            ),
          );
      }
      if (opts.length === 1) add(s, E("finishAttack"));
      else
        choose(
          s,
          "Incoming attack",
          `Total ATK ${a.base} − defense ${a.defense}.`,
          opts,
        );
      break;
    }
    case "preventAttack":
      if (s.attack) {
        s.attack.prevented += e.amount;
        if (!s.attack.defender || s.attack.defender === "none") {
          s.attack.defender = "hero";
          add(s, E("quicksilverLateDefense"));
        }
      }
      break;
    case "finishAttack":
      finishAttack(s, e);
      break;
    case "afterBoost": {
      const a = s.attack;
      if (!a) break;
      if (
        rulesCode(e.code) === "01123" &&
        a.damage > 0 &&
        (!a.defender || ["none", "hero"].includes(a.defender))
      )
        s.player.exhausted = true;
      if (rulesCode(e.code) === "01168" && a.damage > 0) {
        const p =
          a.defender && a.defender !== "none" && a.defender !== "hero"
            ? find(s, a.defender)
            : s.player;
        if (p) giveCharacterStatus(s, p, "stunned");
      }
      break;
    }
    case "defenseResponses": {
      s.attack = null;
      if (!e.gmwHandled && e.snapshot) {
        add(
          s,
          ...gmwPack.gmwPlayerPackAfterDefense(s, e.snapshot, gmwPorts),
          ...(e.snapshot.basicDefense
            ? groot.grootAfterBasicPower(s, "defense", grootPorts)
            : []),
          { ...e, gmwHandled: true },
        );
        break;
      }
      if (!e.quicksilverHandled) {
        add(
          s,
          ...quicksilverPack.quicksilverPackAfterDefense(
            s,
            e.snapshot || {
              attacker: e.attacker,
              heroDefended: e.defended,
              heroDamage: 0,
              playerId: s.activePlayerId,
              isVillain: e.attacker === s.villain.id,
            },
          ),
          ...(e.snapshot?.basicDefense
            ? quicksilver.quicksilverBasicUsed(s, "defense")
            : []),
          { ...e, quicksilverHandled: true },
        );
        break;
      }
      s.attack = null;
      if (!e.strangeDone && e.snapshot) {
        add(s, ...doctorStrangeAfterDefense(s, e.snapshot), {
          ...e,
          strangeDone: true,
        });
        break;
      }
      const bwOptions = e.snapshot
        ? blackWidowAttackResponses(s, e.snapshot, [e])
        : [];
      const packOptions = e.snapshot
        ? hulkPackAttackResponseOptions(
            s,
            e.snapshot,
            hulkPackPorts,
            e.used || [],
          )
        : [];
      const gamoraOptions = gamoraPack.gamoraPackAfterDefenseOptions(
        s,
        e.snapshot || {
          heroDefended: !!e.defended,
          playerId: s.activePlayerId,
        },
        [e],
        gamoraPackPorts,
      );
      const draxOptions = e.snapshot
        ? drax.draxVillainAttackResponseOptions(
            s,
            e.snapshot,
            e.draxUsed || [],
            [e],
            draxPorts,
          )
        : [];
      if (
        !e.defended &&
        !packOptions.length &&
        !bwOptions.length &&
        !gamoraOptions.length &&
        !draxOptions.length
      )
        break;
      const ind = s.player.inPlay.find((p) => rulesCode(p) === "01082");
      const counter = s.player.hand.find((p) => rulesCode(p) === "01077");
      const opts = [
        option("pass", "Continue", []),
        ...bwOptions,
        ...gamoraOptions,
        ...draxOptions,
        ...packOptions.map((o) => ({
          ...o,
          effects: [
            ...o.effects,
            E("defenseResponses", { ...e, used: [...(e.used || []), o.id] }),
          ],
        })),
      ];
      if (ind && e.defended)
        opts.unshift(
          option(
            "indomitable",
            "Indomitable · ready your hero",
            [
              E("discardPiece", { id: ind.id }),
              E("ready", { target: "hero" }),
              E("defenseResponses", { ...e, defended: true }),
            ],
            undefined,
            "01082",
          ),
        );
      if (
        counter &&
        e.defended &&
        (s.player.stunned ||
          targets(s, "enemy", true).some((t) => t.id === e.attacker))
      )
        opts.unshift(
          option(
            "counter",
            "Counter-Punch",
            [
              E("resolveHandEvent", {
                id: counter.id,
                after: [
                  E("damage", {
                    target: e.attacker,
                    amount: heroStats(s).attack,
                    heroAttackAmount: true,
                    attack: true,
                  }),
                ],
              }),
              E("defenseResponses", { ...e, defended: true }),
            ],
            `Deal ${heroStats(s).attack} damage.`,
            "01077",
          ),
        );
      if (opts.length > 1)
        choose(
          s,
          e.defended ? "After defending" : "Drax · after the villain attacks",
          "You can trigger a response.",
          opts,
        );
      break;
    }
    case "boostDroneChoice": {
      const opts = [option("drone", "Create a drone", [E("drone")])];
      if (affordable(s, 1, [e.resource]))
        opts.unshift(
          option("pay", `Spend a ${e.resource} resource`, [
            E("payRequest", {
              title: "Android Efficiency",
              cost: 1,
              requirements: [e.resource],
              after: [],
            }),
          ]),
        );
      choose(s, "Android Efficiency", "Resolve the boost ability.", opts);
      break;
    }
    case "ultronChoice":
      choose(s, "Ultron adapts", "Choose how Ultron advances his plan.", [
        option("threat", `Place ${e.amount} threat`, [
          E("threat", { target: "main", amount: e.amount }),
        ]),
        option("drone", "Create a drone", [E("drone")]),
      ]);
      break;
    case "revealNext": {
      const p = drawEncounter(s);
      if (p) reveal(s, p, false, false, true);
      break;
    }
    case "reveal":
      reveal(s, e.piece, e.skip, false, !!e.fromEncounterDeck, e.knifeSurge);
      break;
    case "discardEncounter":
      if (e.piece.code === "21029")
        s.attachments = s.attachments.filter((p) => p.id !== e.piece.id);
      beginResolution(s, e.piece);
      finishResolution(s, e.piece.id);
      break;
    case "cancelEncounter":
      finishResolution(s, e.piece.id);
      log(s, `${card(e.piece).name}: When Revealed effects canceled.`, "good");
      break;
    case "surge":
      if (
        s.currentRevealWindowId &&
        revealWindowGainSurge(s, s.currentRevealWindowId)
      )
        break;
      dealEncounter(s);
      add(
        s,
        E("bwSurgeResponses", {
          piece: s.resolving.find((p) => p.code === e.sourceCode) || {
            code: e.sourceCode,
          },
        }),
      );
      log(
        s,
        "Surge deals one facedown encounter card. Reveal it after this hero’s other dealt cards during the villain phase.",
        "bad",
      );
      break;
    case "searchEncounter": {
      if (e.code && s.minions.some((p) => p.code === e.code)) break;
      let found: Piece | undefined;
      let foundInDeck = false;
      for (const pile of [s.encounter.deck, s.encounter.discard]) {
        const i = pile.findIndex((p) =>
          e.code ? p.code === e.code : card(p).traits?.includes(e.trait),
        );
        if (i >= 0) {
          foundInDeck = pile === s.encounter.deck;
          [found] = pile.splice(i, 1);
          break;
        }
      }
      shuffle(s, s.encounter.deck);
      if (found) {
        if (e.reveal) reveal(s, found, false, false, foundInDeck);
        else {
          s.minions.push(found);
          minionEntered(s, found);
        }
      }
      break;
    }
    case "findMinion":
    case "findEncounter": {
      revealHidden(s);
      const max = s.encounter.deck.length;
      for (let i = 0; i < max; i++) {
        const p = s.encounter.deck.shift();
        if (!p) break;
        if (
          card(p).type_code === (e.typeCode || "minion") &&
          (!e.trait || card(p).traits?.includes(e.trait))
        ) {
          if (e.type === "findMinion") {
            s.minions.push(p);
            minionEntered(s, p);
          } else reveal(s, p, false, false, true);
          break;
        }
        s.encounter.discard.push(p);
      }
      recycleEncounter(s);
      break;
    }
    case "chooseDiscard": {
      const eligible = s.player.inPlay.filter(
        (p) =>
          !Object.values(spectrum.SPECTRUM_FORM_CODES).some(
            (code) => code === p.code,
          ) &&
          (e.filter === "panther"
            ? card(p).traits?.includes("Black Panther.")
            : e.filter === "upgrade"
              ? card(p).type_code === "upgrade"
              : ["support", "upgrade"].includes(card(p).type_code)),
      );
      choose(
        s,
        "Discard a card",
        "Choose a card to discard from play.",
        eligible.map((p) =>
          option(
            p.id,
            card(p).name,
            [E("discardPiece", { id: p.id })],
            undefined,
            p.code,
          ),
        ),
      );
      break;
    }
    case "assignDamage":
      if (e.remaining > 0)
        add(
          s,
          E("target", {
            group: "friendly",
            title: `Explosion · ${e.remaining} damage to assign`,
            text: "Assign damage before applying it simultaneously to each chosen character.",
            action: E("assignOne", {
              remaining: e.remaining,
              assigned: e.assigned || {},
            }),
          }),
        );
      break;
    case "assignOne": {
      const assigned = {
        ...e.assigned,
        [e.target]: (e.assigned?.[e.target] || 0) + 1,
      };
      if (e.remaining > 1)
        add(s, E("assignDamage", { remaining: e.remaining - 1, assigned }));
      else
        add(
          s,
          ...Object.entries(assigned).map(([target, amount]) =>
            E("damage", { target, amount, source: "explosion" }),
          ),
        );
      break;
    }
    case "hydraThreat": {
      const p = find(s, e.id);
      if (p)
        add(
          s,
          E("threat", {
            target: p.id,
            amount:
              s.minions.filter((p) => card(p).traits?.includes("Hydra."))
                .length * 2,
          }),
        );
      break;
    }
    case "randomDiscard":
      randomDiscard(s);
      break;
    case "accelerate":
      s.encounter.acceleration++;
      break;
    case "exhaustCharacters":
      s.player.exhausted = true;
      friends(s).forEach((p) => (p.exhausted = true));
      break;
    case "exhaustUpgrades":
      s.player.inPlay
        .filter((p) => card(p).type_code === "upgrade")
        .forEach((p) => (p.exhausted = true));
      break;
    case "settle":
      need(
        !s.player.exhausted &&
          (s.player.form === "alter" || !goblinIdentityLocked(s)),
        "This obligation cannot be settled in the current form.",
      );
      s.player.form = "alter";
      s.player.exhausted = true;
      s.removed.push(e.piece);
      s.resolving = s.resolving.filter((p) => p.id !== e.piece.id);
      log(s, `${card(e.piece).name} is removed from the game.`, "good");
      break;
    case "nextMulligan": {
      const next = s.players.find((p) => !p.mulliganDone);
      if (next) activateSeat(s, next.id);
      else initialSetup(s);
      break;
    }
    case "stageSetup":
      if (s.difficulty === "expert" && s.villainId !== "mutagen_formula")
        villainSetup(s);
      break;
    case "beginTurn":
      s.turnPlayerId = s.activePlayerId;
      log(s, `${heroCard(s).name} takes their turn.`, "phase");
      add(s, ...captainPackTurnStart(s));
      break;
    case "prepareDiscard": {
      if (e.selected) {
        for (const id of e.selected)
          if (s.player.hand.some((p) => p.id === id)) discardHand(s, id);
        need(
          s.player.hand.length <= handSize(s),
          "Discard down to your hand size.",
        );
        break;
      }
      select(
        s,
        `${heroCard(s).name} · end of hero phase`,
        `Discard any unwanted cards. You will draw up to ${handSize(s)} cards after the whole team has finished.`,
        s.player.hand,
        Math.max(0, s.player.hand.length - handSize(s)),
        s.player.hand.length,
        E("endDiscard"),
      );
      break;
    }
    case "endDiscard":
      for (const id of e.ids) discardHand(s, id);
      log(s, `Discarded ${e.ids.length} card(s) before refilling.`);
      break;
    case "allReady":
      hawkeyePhaseEnded(s, hawkeyePorts);
      antMan.antManPhaseEnded(s);
      add(s, ...eachPlayer(s, E("refill")));
      break;
    case "refill":
      doctorStrangePhaseEnded(s);
      msMarvelPhaseEnded(s);
      captainPhaseEnded(s);
      captainPackPhaseEnded(s);
      // Encounter cards dealt by deck exhaustion can increase Star-Lord's
      // Helmet hand size during this refill. Recheck after each actual draw.
      while (s.player.hand.length < handSize(s)) {
        const before = s.player.hand.length;
        draw(s, 1);
        if (s.player.hand.length === before) break;
      }
      antPack.antManPackPhaseEnded(s);
      for (const p of s.player.inPlay) {
        p.exhausted = false;
        p.bonusAtk = 0;
        p.bonusThw = 0;
      }
      readyIdentity(s);
      s.flags.lead = 0;
      s.flags.aerial = false;
      s.flags.discount = 0;
      log(s, `${heroCard(s).name} and their cards are ready.`, "phase");
      break;
    case "beginVillain":
      if (!e.starLordBlazeEnded) {
        const damage = starLordPack.starLordPackPhaseEnded(
          s,
          starLordPackPorts,
        );
        if (damage.length) {
          add(s, ...damage, { ...e, starLordBlazeEnded: true });
          break;
        }
      }
      gamora.gamoraPhaseEnded(s);
      spectrum.spectrumPhaseEnded(s);
      venomPack.venomPackPhaseEnded(s);
      venom.venomPhaseEnded(s);
      warlock.warlockPhaseEnded(s);
      scarletWitch.scarletWitchPhaseEnded(s);
      rocket.rocketPhaseEnded(s);
      for (const seat of s.players) {
        antPack.antManPackPhaseEnded(seatView(s, seat));
        mtsPlayerPack.mtsPlayerPackPhaseEnded(seatView(s, seat));
        waspPack.waspPackPhaseEnded(seatView(s, seat));
        quicksilver.quicksilverPhaseEnded(seatView(s, seat));
        quicksilverPack.quicksilverPackPhaseEnded(seatView(s, seat));
      }
      hawkeyePhaseEnded(s, hawkeyePorts);
      antMan.antManPhaseEnded(s);
      s.phase = "villain";
      s.villainStep = "threat";
      log(s, "Villain phase · threat, activations, then encounters.", "phase");
      add(
        s,
        ...groot.grootVillainPhaseBegin(s, grootPorts),
        ...gamora.gamoraVillainPhaseBegin(s, gamoraPorts),
        E("villainStepOne"),
        ...eachPlayer(s, E("villainActivate")),
        E("dealEncounters"),
        E("newRound"),
      );
      break;
    case "villainStepOne":
      log(
        s,
        `Place ${escalation(s)} threat for ${s.playerCount} starting hero(es), plus ${s.encounter.acceleration + s.sideSchemes.reduce((n, p) => n + (card(p).scheme_acceleration || 0), 0)} acceleration.`,
        "bad",
      );
      add(
        s,
        E("threat", {
          target: "main",
          amount:
            escalation(s) +
            s.encounter.acceleration +
            s.sideSchemes.reduce(
              (n, p) => n + (card(p).scheme_acceleration || 0),
              0,
            ),
        }),
        ...(rulesCode(s.scheme) === "01138b"
          ? eachPlayer(s, E("ultronChoice", { amount: 2 }))
          : []),
      );
      break;
    case "villainActivate":
      s.villainStep = "activation";
      add(
        s,
        E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
          id: s.villain.id,
        }),
        E("minionActivations"),
      );
      break;
    case "minionActivations": {
      const remaining =
        (e.remaining as string[] | undefined) || engaged(s).map((p) => p.id);
      const minions = remaining
        .map((id) => find(s, id))
        .filter((p): p is Piece => !!p);
      const effects = (p: Piece) => [
        E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
          id: p.id,
        }),
        E("minionActivations", {
          remaining: remaining.filter((id) => id !== p.id),
        }),
      ];
      if (minions.length === 1) add(s, ...effects(minions[0]));
      else if (minions.length > 1)
        choose(
          s,
          "Minions activate",
          "Choose the next engaged minion to activate.",
          minions.map((p) =>
            option(p.id, card(p).name, effects(p), undefined, p.code),
          ),
        );
      break;
    }
    case "minionActivate": {
      const p = s.minions.find((p) => p.id === e.id);
      if (p) {
        const playerId = e.playerId || p.engagedWith || s.activePlayerId;
        const view = seatView(s, playerId);
        add(
          s,
          E(view.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
            id: p.id,
            actorId: playerId,
          }),
        );
      }
      break;
    }
    case "dealEncounter":
      dealEncounter(s, e.playerId || s.activePlayerId);
      break;
    case "dealEncounters": {
      s.villainStep = "encounters";
      const order = playerOrder(s);
      for (const seat of order)
        for (let i = 0; i <= (s.heroic || 0); i++) dealEncounter(s, seat.id);
      const hazard =
        (card(s.scheme.code).scheme_hazard || 0) +
        s.sideSchemes.reduce((n, p) => n + (card(p).scheme_hazard || 0), 0);
      for (let i = 0; i < hazard; i++)
        dealEncounter(s, order[i % order.length].id);
      log(
        s,
        `Deal ${1 + (s.heroic || 0)} encounter card${s.heroic ? "s" : ""} to each hero${s.heroic ? ` (Heroic ${s.heroic})` : ""}${hazard ? ` and ${hazard} additional hazard card(s) in player order` : ""}.`,
        "bad",
      );
      add(s, ...eachPlayer(s, E("revealDealt")));
      break;
    }
    case "revealDealt": {
      const i = s.encounter.dealt.findIndex(
        (p) => (p.dealtTo || s.activePlayerId) === s.activePlayerId,
      );
      if (i >= 0) {
        const [p] = s.encounter.dealt.splice(i, 1);
        add(s, E("revealDealt"));
        reveal(s, p, false, false, true);
      }
      break;
    }
    case "newRound": {
      if (!e.draxPackRegroupEnded) {
        const expired = draxPack.draxPackRoundEnded(s);
        if (expired.length) {
          add(s, ...expired, { ...e, draxPackRegroupEnded: true });
          break;
        }
      }
      if (!e.starLordBlazeEnded) {
        const damage = starLordPack.starLordPackPhaseEnded(
          s,
          starLordPackPorts,
        );
        if (damage.length) {
          add(s, ...damage, { ...e, starLordBlazeEnded: true });
          break;
        }
      }
      gamora.gamoraPhaseEnded(s);
      venomPack.venomPackPhaseEnded(s);
      venom.venomPhaseEnded(s);
      warlock.warlockPhaseEnded(s);
      scarletWitch.scarletWitchPhaseEnded(s);
      rocket.rocketPhaseEnded(s);
      rocket.rocketRoundEnded(s);
      spectrum.spectrumPhaseEnded(s);
      starLord.starLordRoundEnded(s);
      warlock.warlockRoundEnded(s);
      for (const seat of s.players) {
        waspPack.waspPackPhaseEnded(seatView(s, seat));
        mtsPlayerPack.mtsPlayerPackPhaseEnded(seatView(s, seat));
        mtsPlayerPack.mtsPlayerPackRoundEnded(seatView(s, seat));
        quicksilver.quicksilverPhaseEnded(seatView(s, seat));
        quicksilver.quicksilverRoundEnded(seatView(s, seat));
        quicksilverPack.quicksilverPackPhaseEnded(seatView(s, seat));
      }
      hawkeyePhaseEnded(s, hawkeyePorts);
      antMan.antManPhaseEnded(s);
      add(s, ...doctorStrangeRoundEnded(s));
      const prev = s.activePlayerId;
      for (const seat of playerOrder(s)) {
        activateSeat(s, seat.id);
        for (const p of [...s.player.inPlay].filter(
          (p) => rulesCode(p) === "01084",
        ))
          discardPiece(s, p.id);
        s.flags = {
          nemesis: s.flags.nemesis || false,
          ...(s.heroId === "groot"
            ? { grootGrowthCounters: groot.grootGrowthCounters(s) }
            : {}),
          ...(s.heroId === "drax"
            ? { draxVengeanceCounters: drax.draxVengeanceCounters(s) }
            : {}),
          ...(s.flags.spectrumSetupComplete
            ? { spectrumSetupComplete: true }
            : {}),
          ...(s.flags.spectrumEnergyFormId
            ? { spectrumEnergyFormId: s.flags.spectrumEnergyFormId }
            : {}),
          ...(typeof s.flags.warlockDeckEmptyObserved === "boolean"
            ? { warlockDeckEmptyObserved: s.flags.warlockDeckEmptyObserved }
            : {}),
          ...(s.flags.qsvCannotReadyUntilTurnEnd
            ? { qsvCannotReadyUntilTurnEnd: s.flags.qsvCannotReadyUntilTurnEnd }
            : {}),
          ...(s.flags.antManCannotChangeUntilTurnEnd
            ? {
                antManCannotChangeUntilTurnEnd:
                  s.flags.antManCannotChangeUntilTurnEnd,
              }
            : {}),
        };
        s.player.flipped = false;
        seat.ended = false;
        for (const p of s.player.inPlay) {
          p.used = false;
          p.bonusAtk = 0;
          p.bonusThw = 0;
        }
      }
      activateSeat(s, prev);
      const order = playerOrder(s);
      s.firstPlayerId = (order[1] || order[0]).id;
      s.round++;
      s.phase = "player";
      s.villainStep = "newRound";
      s.attack = null;
      activateSeat(s, s.firstPlayerId);
      s.turnPlayerId = s.firstPlayerId;
      log(
        s,
        `Round ${s.round} · ${heroCard(s).name} holds the first-player token.`,
        "phase",
      );
      break;
    }
    case "lead":
      log(
        s,
        "Each character you control gets +1 ATK and +1 THW until the end of this phase.",
        "good",
      );
      s.flags.lead = Number(s.flags.lead || 0) + 1;
      break;
    case "discount":
      log(s, "Your next card this phase costs 1 fewer resource.", "good");
      s.flags.discount = Number(s.flags.discount || 0) + 1;
      break;
    case "recoverTech": {
      const tech = [...s.player.discard]
        .reverse()
        .find(
          (p) =>
            card(p).type_code === "upgrade" &&
            card(p).traits?.includes("Tech."),
        );
      if (tech) add(s, E("fromDiscard", { id: tech.id }));
      break;
    }
    case "transferUpgrade": {
      const owner = controller(s, e.id);
      const p = find(s, e.id);
      if (owner && p && owner.id !== s.activePlayerId) {
        const ownerView = seatView(s, owner);
        const ownerHealth = maxHP(ownerView),
          targetHealth = maxHP(s);
        const zone = ownerView.player.inPlay;
        zone.splice(zone.indexOf(p), 1);
        s.player.inPlay.push(p);
        ownerView.player.hp += maxHP(ownerView) - ownerHealth;
        s.player.hp += maxHP(s) - targetHealth;
        log(s, `${card(p).name} is now controlled by ${heroCard(s).name}.`);
      }
      break;
    }
    case "factoryThreat": {
      const p = find(s, e.id);
      if (p)
        add(
          s,
          E("threat", {
            target: p.id,
            amount: s.minions.filter((m) => card(m).traits?.includes("Drone."))
              .length,
          }),
        );
      break;
    }
    case "underAttack":
      choose(
        s,
        "Under Attack",
        `${heroCard(s).name} must choose a consequence.`,
        [
          option("threat", "Place 2 threat on Under Attack", [
            E("threat", { target: e.id, amount: 2 }),
          ]),
          ...(s.player.form === "hero"
            ? [
                option("damage", "Deal 3 damage to your hero", [
                  E("damage", { target: "hero", amount: 3 }),
                ]),
              ]
            : []),
        ],
      );
      break;
    case "capture": {
      const p = find(s, e.id);
      if (p && s.player.hand.length) {
        const [x] = s.player.hand.splice(
          Math.floor(random(s) * s.player.hand.length),
          1,
        );
        (p.captured ||= []).push(x);
        log(s, "Highway Robbery captures a card from your hand.");
      }
      break;
    }
    case "backlash": {
      const cards = mill(s, 5);
      add(
        s,
        E("damage", {
          target: "hero",
          amount: cards.reduce((n, p) => n + (card(p).resource_energy || 0), 0),
        }),
      );
      break;
    }
    case "vulturePlans": {
      const prev = s.activePlayerId;
      const types = new Set<Resource>();
      for (const seat of playerOrder(s)) {
        activateSeat(s, seat.id);
        const p = randomDiscard(s);
        if (p) resources(card(p)).forEach((r) => types.add(r));
      }
      activateSeat(s, prev);
      add(s, E("threat", { target: "main", amount: types.size }));
      break;
    }
    default:
      throw Error(`Unimplemented effect: ${e.type}`);
  }
}
function run(s: GameState) {
  let pending = s.review;
  s.review = null;
  let n = 0;
  while (
    !s.review &&
    !s.prompt &&
    s.queue.length &&
    !["won", "lost"].includes(s.phase)
  ) {
    need(n++ < 600, "Effect loop exceeded its limit.");
    const e = s.queue.shift()!;
    const actor = s.players.find(
      (p) => p.id === (e.actorId || s.activePlayerId),
    );
    const global =
      [
        "newRound",
        "spectrumBatchCommit",
        "dealEncounters",
        "beginVillain",
        "villainStepOne",
        "nextMulligan",
        "allReady",
        "finishResolution",
        "endScheme",
        "completeBoost",
        "mutagen:return-boost",
        "reveal-window:step",
        "reveal-window:execute",
        "reveal-window:text",
        "attackAftermathOrder",
        "forcedResponses",
        "threat",
        "risky:reveal-each",
        "risky:main-completed",
        "risky:discard-each",
        "risky:advance-main",
        "risky:loss",
        "mutagen:deal-each-player",
        "mutagen:deal",
        "mutagen:advance-main",
        "mutagen:loss",
        "goblin-module:power-drain-each",
        "goblin-module:interference-each",
      ].includes(e.type) || e.type.startsWith("sw:hydra");
    if (actor?.eliminated && !global) continue;
    activateSeat(
      s,
      e.type === "reveal-window:text"
        ? e.actorId || s.activePlayerId
        : actor?.eliminated
          ? s.firstPlayerId
          : e.actorId || s.activePlayerId,
    );
    const before = boardSnapshot(s);
    s.currentEventId = e.eventId;
    s.currentAttackProgramId = e.attackProgramId;
    s.currentResponseGroup = e.responseGroup;
    s.currentResponseMandatory = e.mandatory;
    s.currentRevealWindowId = e.revealWindowId;
    resolve(s, e);
    delete s.currentEventId;
    delete s.currentAttackProgramId;
    delete s.currentResponseGroup;
    delete s.currentResponseMandatory;
    delete s.currentRevealWindowId;
    check(s);
    syncSeat(s);
    recordReview(s, before, e);
    const current = s.review;
    if (current) pending = mergeReviews(pending, current);
    s.review = null;
    if (s.prompt) break;
    if (pending && !continuesReview(s, e, current)) {
      s.review = pending;
      pending = null;
      break;
    }
  }
  if (s.prompt && pending) s.prompt.context = pending;
  else if (!s.review && pending && isMeaningful(pending)) {
    // Cleanup alone is already visible in the log and previous action card.
    const ended = ["won", "lost"].includes(s.phase);
    if (ended || stopsFor(s, pending, pacingOf(s))) s.review = pending;
    // The faster tempos keep the player's own resolved actions in a short timeline.
    else s.timeline = [...(s.timeline || []), pending].slice(-8);
  }
  if (!s.review && !s.prompt && !s.queue.length && s.phase === "player") {
    const turn = s.players.find((p) => p.id === s.turnPlayerId);
    if (turn && !turn.eliminated) activateSeat(s, turn.id);
    else {
      const next = playerOrder(s).find((p) => !p.ended);
      if (next) {
        activateSeat(s, next.id);
        s.turnPlayerId = next.id;
      } else {
        add(
          s,
          ...eachPlayer(s, E("prepareDiscard")),
          E("allReady"),
          E("beginVillain", { actorId: s.firstPlayerId }),
        );
        run(s);
      }
    }
  }
}
export function dispatch(state: GameState, command: Command): GameState {
  const s = upgradeSave(structuredClone(state));
  s.combatEvents = [];
  delete s.error;
  try {
    if (
      (command.type === "PLAY" || command.type === "ABILITY") &&
      command.playerId &&
      command.playerId !== s.activePlayerId
    ) {
      need(
        s.phase === "player" && !s.review && !s.prompt,
        "Finish the current action before requesting a teammate’s action.",
      );
      const seat = s.players.find(
        (p) => p.id === command.playerId && !p.eliminated,
      );
      need(seat, "That hero is not in the mission.");
      activateSeat(s, command.playerId);
    }
    if (command.type === "ABILITY" && s.activePlayerId !== s.turnPlayerId) {
      const p =
        command.id === "identity"
          ? heroCard(s)
          : card(find(s, command.id) || "");
      need(
        p?.text?.includes("Action") &&
          !["attack", "thwart"].includes(command.action || ""),
        "Basic powers and ally attacks or thwarts require that hero’s own turn.",
      );
    }
    if (command.type === "SET_PACING") {
      need(
        ["guided", "brisk", "expert"].includes(command.pacing),
        "Unknown tempo.",
      );
      s.pacing = command.pacing;
      syncSeat(s);
      return s;
    }
    const before = boardSnapshot(s);
    if (command.type === "PROCEED") {
      need(s.review, "There is no action to acknowledge.");
      s.review = null;
      run(s);
      syncSeat(s);
      return s;
    }
    need(!s.review, "Read the current action and click Proceed first.");
    if (command.type === "MULLIGAN") {
      need(s.phase === "mulligan", "Mulligan is finished.");
      need(
        new Set(command.ids).size === command.ids.length,
        "Select each card once.",
      );
      const discarded = command.ids.map((id) => {
        const i = s.player.hand.findIndex((p) => p.id === id);
        need(i >= 0, "Unknown card.");
        return s.player.hand.splice(i, 1)[0];
      });
      draw(s, discarded.length);
      s.player.discard.push(...discarded);
      log(
        s,
        discarded.length
          ? `Mulligan: replaced ${discarded.length} cards.`
          : "Opening hand kept.",
      );
      s.players.find((p) => p.id === s.activePlayerId)!.mulliganDone = true;
      add(s, E("nextMulligan"));
    } else if (command.type === "CHOOSE") {
      need(s.prompt?.kind === "choice", "No choice is pending.");
      const opt = s.prompt!.options.find((o) => o.id === command.id);
      need(opt, "Invalid choice.");
      log(s, `${s.prompt!.title}: ${opt!.label}.`);
      s.prompt = null;
      add(s, ...opt!.effects);
    } else if (command.type === "SELECT") {
      const p = s.prompt!;
      need(p?.kind === "select", "No selection is pending.");
      need(
        new Set(command.ids).size === command.ids.length &&
          command.ids.every((id) => p.options.some((o) => o.id === id)),
        "Invalid selection.",
      );
      need(
        command.ids.length >= (p.min || 0) &&
          command.ids.length <= (p.max || 0),
        "Choose the requested number of cards.",
      );
      s.prompt = null;
      add(s, { ...p.selectAction!, ids: command.ids });
    } else if (command.type === "PAY") pay(s, command.ids, command.wildAs);
    else if (command.type === "CANCEL") {
      need(s.prompt?.cancelable, "This decision cannot be canceled.");
      const resume = s.prompt?.cancellationQueue;
      if (!resume?.some((e) => e.type === "restorePaymentPrompt"))
        starLord.starLordHandPlayFinished(s);
      s.prompt = null;
      s.queue = resume || [];
    } else {
      need(
        s.phase === "player" &&
          !s.prompt &&
          (["PLAY", "ABILITY"].includes(command.type) ||
            s.activePlayerId === s.turnPlayerId) &&
          !s.players.find((p) => p.id === s.activePlayerId)!.eliminated,
        "Finish the pending decision first.",
      );
      if (command.type === "PLAY") {
        const p =
          s.player.hand.find((p) => p.id === command.id) ||
          s.player.discard.find(
            (p) => p.id === command.id && msMarvelDiscardPlayable(s, p),
          ) ||
          hawkeyeStoredPlayable(s).find((p) => p.id === command.id);
        need(p, "Card is not available to play.");
        const reason = playable(s, p!);
        need(!reason, reason || "");
        add(s, E("playRequest", { piece: p }));
      } else {
        s.flags.basicAttack = false;
        s.flags.heroKill = false;
        if (command.type === "FLIP") flip(s, true, command.target);
        else if (command.type === "BASIC") {
          need(!s.player.exhausted, "Your identity is exhausted.");
          if (command.action === "thwart")
            need(
              !captainThwartBlocked(s),
              "Baron Zemo prevents this identity from thwarting.",
            );
          const stats = heroStats(s);
          if (command.action === "recover") {
            need(s.player.form === "alter", "Recover in alter-ego form.");
            need(s.player.hp < maxHP(s), "You are at full health.");
            s.player.exhausted = true;
            heal(s, "hero", stats.recover);
          } else {
            need(s.player.form === "hero", "Change to hero form first.");
            need(
              (command.action === "attack"
                ? s.player.stunned
                : s.player.confused) ||
                targets(
                  s,
                  command.action === "attack" ? "enemy" : "scheme",
                  command.action === "attack",
                ).length,
              "There are no eligible targets.",
            );
            const extraCost =
              command.action === "attack" ? wasp.waspBasicAttackCost(s) : 0;
            need(
              canPay(s, extraCost),
              "Mother's Orders requires an additional resource for a basic attack.",
            );
            // Keep ordinary exhaustion in the command snapshot so its review
            // stays with the power instead of introducing a separate stop.
            if (!extraCost) s.player.exhausted = true;
            add(s, E("basicPower", { power: command.action }));
          }
        } else if (command.type === "ABILITY") {
          if (s.attachments.some((p) => p.id === command.id)) {
            const p = find(s, command.id)!;
            const custom = [
              ...hawkeyeAbilityOptions(s, p.id, hawkeyePorts),
              ...goblinModuleAttachmentActions(s, p),
              ...mutagenAttachmentActions(s, p),
              ...scarletWitch.scarletWitchAttachmentActions(s, p, scarletPorts),
              ...rocket.rocketAttachmentActions(s, p, rocketPorts),
              ...gamora.gamoraAttachmentActions(s, p, gamoraPorts),
              ...spectrum.spectrumAttachmentOptions(s, p.id, spectrumPorts),
              ...quicksilver.quicksilverAttachmentActions(
                s,
                p,
                quicksilverPorts,
              ),
            ];
            if (custom.length) {
              const selected = custom.find(
                (o) => o.id === (command.action || "remove"),
              );
              need(selected, "Choose an available attachment action.");
              add(s, ...selected!.effects);
            } else {
              need(s.player.form === "hero", "Hero form required.");
              const req: Record<string, Resource[]> = {
                "01100": ["physical", "physical", "physical"],
                "01118": ["energy", "mental", "physical"],
                "01119": ["energy", "mental", "physical"],
                "01141": ["mental", "mental"],
                "01142": ["energy", "mental", "physical"],
                "01152": ["physical", "physical"],
                "01153": ["energy", "energy"],
              };
              const r = req[rulesCode(p)];
              need(r, "This attachment has no removal action.");
              const exhaust = ["01141", "01152", "01153"].includes(
                rulesCode(p),
              );
              need(!exhaust || !s.player.exhausted, "Your hero must be ready.");
              requestPayment(
                s,
                `Remove ${card(p).name}`,
                r.length,
                [
                  ...(exhaust ? [E("exhaust", { id: "hero" })] : []),
                  E("discardPiece", { id: p.id }),
                ],
                r,
                undefined,
                true,
              );
            }
          } else ability(s, command.id, command.action);
        } else if (command.type === "END_TURN") {
          if (command.discard)
            need(
              new Set(command.discard).size === command.discard.length &&
                command.discard.every((id) =>
                  s.player.hand.some((p) => p.id === id),
                ),
              "Choose distinct cards currently in your hand.",
            );
          // Discard/refill happens after the entire team has finished its turns.
          const seat = s.players.find((p) => p.id === s.activePlayerId)!;
          antMan.antManTurnEnded(s);
          quicksilver.quicksilverTurnEnded(s);
          rocket.rocketTurnEnded(s);
          gamora.gamoraTurnEnded(s);
          gmwPack.gmwPlayerPackTurnEnded(s);
          seat.ended = true;
          log(s, `${heroCard(s).name} ends their turn.`, "phase");
          const next = playerOrder(s).find((p) => !p.ended);
          if (next) add(s, E("beginTurn", { actorId: next.id }));
          else {
            const order = playerOrder(s);
            add(
              s,
              ...order.map((p) =>
                E("prepareDiscard", {
                  actorId: p.id,
                  selected:
                    s.playerCount === 1 ? command.discard || [] : undefined,
                }),
              ),
              E("allReady", { actorId: s.firstPlayerId }),
              E("beginVillain", { actorId: s.firstPlayerId }),
            );
          }
          add(s, ...hulkTurnEnds(s));
          add(
            s,
            ...spectrum.spectrumTurnEnded(s, s.turnPlayerId, spectrumPorts),
          );
        }
      }
    }
    check(s);
    syncSeat(s);
    recordReview(s, before, command);
    // A click on a choice/payment/basic power is already confirmation. Resolve
    // to the next real decision or result, carrying its receipt into that view.
    if (["CHOOSE", "SELECT"].includes(command.type) && before.prompt?.context)
      s.review = s.review
        ? mergeReviews(before.prompt.context, s.review)
        : before.prompt.context;
    run(s);
    syncSeat(s);
    return s;
  } catch (error) {
    return {
      ...state,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
export function summarize(s: GameState) {
  return {
    phase: s.phase,
    activePlayerId: s.activePlayerId,
    firstPlayerId: s.firstPlayerId,
    turnPlayerId: s.turnPlayerId,
    players: s.players.map((p) => ({
      id: p.id,
      heroId: p.heroId,
      name: HEROES.find((h) => h.id === p.heroId)!.name,
      hp: seatView(s, p).player.hp,
      statusCards: {
        stunned:
          seatView(s, p).player.stunCards ||
          Number(seatView(s, p).player.stunned),
        confused:
          seatView(s, p).player.confuseCards ||
          Number(seatView(s, p).player.confused),
        tough:
          seatView(s, p).player.toughCards ||
          Number(seatView(s, p).player.tough),
      },
      form: seatView(s, p).player.form,
      heroForm: seatView(s, p).player.heroForm,
      hand: seatView(s, p).player.hand.length,
      deck: seatView(s, p).player.deck.length,
      invocation:
        p.heroId === "doctor_strange"
          ? {
              top:
                s.phase !== "mulligan"
                  ? seatView(s, p).player.invocationDeck?.[0]?.code
                  : undefined,
              deck: seatView(s, p).player.invocationDeck?.length || 0,
              discard: seatView(s, p).player.invocationDiscard?.length || 0,
            }
          : undefined,
      exhausted: seatView(s, p).player.exhausted,
      statuses: {
        tough: seatView(s, p).player.tough,
        stunned: seatView(s, p).player.stunned,
        confused: seatView(s, p).player.confused,
      },
      ended: p.ended,
      eliminated: p.eliminated,
    })),
    review: s.review,
    pacing: pacingOf(s),
    timeline: (s.timeline || []).map((r) => r.title),
    heroic: s.heroic || 0,
    seed: s.startSeed,
    hiddenInfo: s.hiddenInfo || 0,
    missionStats: s.stats,
    round: s.round,
    identity: heroCard(s).name,
    heroHP: s.player.hp,
    quiverArrows: hawkeyeStoredPlayable(s).map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      cost: cardCost(s, card(p)),
      playable: playable(s, p) === null,
      disabled: playable(s, p) || undefined,
    })),
    maxHP: maxHP(s),
    exhausted: s.player.exhausted,
    form: s.player.form,
    heroForm: s.player.heroForm,
    stats: heroStats(s),
    statuses: {
      stunned: s.player.stunned,
      confused: s.player.confused,
      tough: s.player.tough,
    },
    villain: {
      name: card(s.villain).name,
      hp: s.villain.hp,
      stage: s.villain.stage,
    },
    scheme: {
      name: card(s.scheme.code).name,
      threat: s.scheme.threat,
      limit: schemeLimit(s),
    },
    hand: s.player.hand.map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      cost: card(p).cost,
      playable: playable(s, p) === null,
    })),
    inPlay: s.player.inPlay.map((p) => ({
      id: p.id,
      name: card(p).name,
      exhausted: p.exhausted,
      counters: p.counters,
      storedCards: p.storedCards?.length || 0,
    })),
    minions: s.minions.map((p) => ({
      id: p.id,
      name: card(p).name,
      hp: pieceHP(s, p) - p.damage,
      engagedWith: p.engagedWith,
    })),
    environments: (s.environments || []).map((p) => ({
      id: p.id,
      name: card(p).name,
      counters: p.counters,
    })),
    sideSchemes: s.sideSchemes.map((p) => ({
      id: p.id,
      name: card(p).name,
      threat: p.counters,
    })),
    deck: s.player.deck.length,
    discard: s.player.discard.length,
    prompt: s.prompt
      ? {
          kind: s.prompt.kind,
          title: s.prompt.title,
          text: s.prompt.text,
          context: s.prompt.context,
          cost: s.prompt.cost,
          min: s.prompt.min,
          max: s.prompt.max,
          requirements: s.prompt.requirements,
          options: s.prompt.options.map((o) => ({ id: o.id, label: o.label })),
          sources:
            s.prompt.kind === "payment"
              ? paymentSources(
                  s,
                  s.prompt.card?.id,
                  s.prompt.paymentTarget,
                  s.prompt.handOnly,
                )
              : undefined,
        }
      : null,
    error: s.error,
    result: s.result,
  };
}
