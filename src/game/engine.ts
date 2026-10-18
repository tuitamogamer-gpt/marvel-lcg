import * as domino from "./domino.js";
import * as cable from "./cable.js";
import * as x23 from "./x23.js";
import * as deadpool from "./deadpool.js";
import * as gambit from "./gambit.js";
import * as cyclops from "./cyclops.js";
import {
  beginPlayerSideSchemeDefeat,
  enterPlayerSideScheme,
  isPlayerSideScheme,
  playerSideSchemeHasVictory,
  playerSideSchemeLimit,
  playerSideSchemes,
} from "./player-side-schemes.js";
import * as acolytes from "./acolytes.js";
import * as armadillo from "./armadillo.js";
import * as inheritors from "./inheritors.js";
import * as brotherhood from "./brotherhood.js";
import * as zzzax from "./zzzax.js";
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
import * as warMachine from "./war-machine.js";
import * as valkyrie from "./valkyrie.js";
import * as vision from "./vision.js";
import * as miles from "./miles-morales.js";
import * as ghostSpider from "./ghost-spider.js";
import * as nova from "./nova.js";
import * as ironheart from "./ironheart.js";
import * as ironspider from "./ironspider-sinister.js";
import * as rogue from "./rogue.js";
import * as phoenix from "./phoenix.js";
import * as spdr from "./spdr.js";
import * as spdrPack from "./spdr-pack.js";
import * as spiderHam from "./spider-ham.js";
import * as spiderHamPack from "./spider-ham-pack.js";
import * as niPack from "./nova-ironheart-pack.js";
import * as wolverine from "./wolverine.js";
import * as psylocke from "./psylocke.js";
import * as angel from "./angel.js";
import * as storm from "./storm.js";
import * as colossus from "./colossus.js";
import * as shadowcat from "./shadowcat.js";
import * as mgPack from "./mutant-genesis-player-pack.js";
import * as sabretooth from "./sabretooth.js";
import * as mystique from "./mystique.js";
import * as sentinels from "./sentinels.js";
import * as wideawake from "./project-wideawake.js";
import * as masterMold from "./master-mold.js";
import * as magneto from "./magneto.js";
import * as mansionAttack from "./mansion-attack.js";
import * as zeroTolerance from "./zero-tolerance.js";
import * as nebula from "./nebula.js";
import { heroDeckAspects, isPermanent } from "./hero-runtime.js";
import * as venomPack from "./venom-pack.js";
import * as mtsPlayerPack from "./mts-player-pack.js";
import * as nebulaPack from "./nebula-pack.js";
import * as warmPack from "./war-machine-pack.js";
import * as valkPack from "./valkyrie-pack.js";
import * as visionPack from "./vision-pack.js";
import * as sinisterPlayerPack from "./sinister-player-pack.js";
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
import {
  isTextBlank,
  textActiveState,
  defenseEventSources,
  eventPlaySources,
} from "./card-text.js";
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
  enemyAttachmentModifier,
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
  PlayerSeat,
  Prompt,
  Resource,
} from "./types.js";
import {
  activateSeat,
  allInPlay,
  controller,
  controlledNPCs,
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
  suggestPayment,
  paidResourceAllocations,
  generatedResourceAllocations,
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
function keyword(p: Piece | string, name: string, s?: GameState) {
  const printed =
    !(s && isTextBlank(s, p)) &&
    printedKeyword(card(p), name as PrintedKeyword) > 0;
  const inherited =
    s && typeof p !== "string"
      ? inheritors.inheritorsModifiers(s, p)
      : undefined;
  return (
    printed ||
    !!(
      s &&
      typeof p !== "string" &&
      name === "Guard" &&
      acolytes.acolytesGuard(s, p)
    ) ||
    !!(
      s &&
      typeof p !== "string" &&
      name === "Guard" &&
      masterMold.masterMoldModifiers(s, p, {
        isTextBlank,
        hasTrait: captainPackHasTrait,
      }).guard
    ) ||
    !!inherited?.[name.toLowerCase() as keyof typeof inherited] ||
    !!(
      s &&
      typeof p !== "string" &&
      name === "Quickstrike" &&
      brotherhood.brotherhoodModifiers(s, p, {
        isTextBlank,
        hasTrait: captainPackHasTrait,
      }).quickstrike
    ) ||
    !!(
      s &&
      typeof p !== "string" &&
      sabretooth.sabretoothModifiers(s, p.id)[
        name.toLowerCase() as "piercing" | "stalwart"
      ]
    ) ||
    !!(
      s &&
      typeof p !== "string" &&
      name === "Patrol" &&
      mgPack.mutantGenesisPlayerPackMinionModifiers(s, p, { isTextBlank })
        .patrol
    )
  );
}
function nativeStatusModifiers(s: GameState, p: StatusState) {
  if (!("code" in p))
    return s.villainId === "mansion_attack"
      ? {
          steady: mansionAttack.mansionAttackModifiers(s, "hero", {
            isTextBlank,
          }).steady,
        }
      : {};
  const piece = p as Piece;
  const magnetic = magneto.magnetoModifiers(s, piece, { isTextBlank });
  const inherited = inheritors.inheritorsModifiers(s, piece);
  return {
    ...(isTextBlank(s, piece)
      ? { stalwart: false, steady: false }
      : armadillo.armadilloStatusModifiers(s, piece)),
    ...(storm.stormGlobal(s).stalwart ||
    inherited.stalwart ||
    sabretooth.sabretoothModifiers(s, piece.id).stalwart
      ? { stalwart: true }
      : {}),
    ...(magnetic.losesSteady ? { steady: false } : {}),
    ...(mansionAttack.mansionAttackModifiers(s, piece, { isTextBlank }).steady
      ? { steady: true }
      : {}),
  };
}
function giveCharacterStatus(
  s: GameState,
  p: StatusState,
  kind: StatusKind,
  definition?: Card,
) {
  const c = definition || ("code" in p ? card(p as Piece) : heroCard(s));
  const identity = playerOrder(s)
    .map((seat) => seatView(s, seat))
    .find((view) => view.player === p);
  const magnetic =
    "code" in p
      ? magneto.magnetoModifiers(s, p as Piece, { isTextBlank })
      : undefined;
  if (
    (kind === "stunned" && magnetic?.cannotStun) ||
    (kind === "confused" && magnetic?.cannotConfuse)
  )
    return false;
  const changed = giveStatus(
    p,
    c,
    kind,
    identity
      ? {
          stalwart:
            rogue.rogueModifiers(identity).stalwart ||
            storm.stormGlobal(s).stalwart ||
            !!printedKeyword(heroCard(identity), "Stalwart") ||
            nebula.nebulaAttackKeywords(identity).stalwart ||
            vision.visionStalwart(identity),
          toughLimit: colossus.colossusToughLimit(identity, colossusPorts),
          steady:
            phoenix.phoenixSuit(identity).steady ||
            spdrPack.spdrPackCharacterSteady(identity, "hero", {
              isTextBlank,
            }) ||
            mansionAttack.mansionAttackModifiers(identity, "hero", {
              isTextBlank,
            }).steady,
        }
      : nativeStatusModifiers(s, p),
  );
  if (
    changed &&
    "code" in p &&
    keyword(p as Piece, "Vulnerable", s) &&
    (p.stunned || p.confused)
  )
    discardPiece(s, (p as Piece).id);
  return changed;
}
/** All identity-ready effects share absolute restrictions and actual ready responses. */
function syncNebulaIdentityStatuses(s: GameState) {
  const magneticCap = magneto.magnetoDamageCap(s, { isTextBlank });
  if (magneticCap !== undefined && s.villain.maxHp - s.villain.hp > magneticCap)
    s.villain.hp = s.villain.maxHp - magneticCap;
  for (const seat of playerOrder(s)) {
    const view = seatView(s, seat);
    if (
      rogue.rogueModifiers(view).stalwart ||
      storm.stormGlobal(s).stalwart ||
      nebula.nebulaAttackKeywords(view).stalwart ||
      vision.visionStalwart(view)
    )
      syncStatuses(view.player, heroCard(view), { stalwart: true });
    else if (s.villainId === "mansion_attack" || view.heroId === "phoenix") {
      const steady =
        mansionAttack.mansionAttackModifiers(view, "hero", { isTextBlank })
          .steady ||
        phoenix.phoenixSuit(view).steady ||
        spdrPack.spdrPackCharacterSteady(view, "hero", { isTextBlank });
      if (!steady && !printedKeyword(heroCard(view), "Steady")) {
        view.player.stunCards = Math.min(
          1,
          statusCards(view.player, "stunned"),
        );
        view.player.confuseCards = Math.min(
          1,
          statusCards(view.player, "confused"),
        );
      }
      syncStatuses(view.player, heroCard(view), {
        steady,
      });
    }
  }
  for (const p of [
    s.villain,
    ...s.minions,
    ...allInPlay(s).filter((piece) => card(piece).type_code === "ally"),
    ...playerOrder(s).flatMap((seat) => controlledNPCs(s, seat.id)),
  ])
    if (
      storm.stormGlobal(s).stalwart ||
      printedKeyword(card(p), "Steady") ||
      printedKeyword(card(p), "Stalwart") ||
      inheritors.inheritorsModifiers(s, p).stalwart ||
      sabretooth.sabretoothModifiers(s, p.id).stalwart ||
      s.villainId === "mansion_attack"
    ) {
      const modifiers = nativeStatusModifiers(s, p);
      if (
        ["mansion_attack", "magneto"].includes(s.villainId) &&
        !(modifiers.steady ?? printedKeyword(card(p), "Steady"))
      ) {
        p.stunCards = Math.min(1, statusCards(p, "stunned"));
        p.confuseCards = Math.min(1, statusCards(p, "confused"));
      }
      syncStatuses(p, card(p), nativeStatusModifiers(s, p));
    }
}
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
      Number(
        name === "Stalwart" &&
          (rogue.rogueModifiers(s).stalwart ||
            storm.stormGlobal(s).stalwart ||
            nebula.nebulaAttackKeywords(s).stalwart ||
            vision.visionStalwart(s)),
      ) +
      Number(
        name === "Piercing" &&
          (nebula.nebulaAttackKeywords(s).piercing ||
            nebula.nebulaNamedCharacterModifiers(s, heroCard(s).name).piercing),
      ) +
      Number(
        name === "Overkill" &&
          (nebula.nebulaAttackKeywords(s).overkill || x23.x23Stats(s).overkill),
      ) +
      (name === "Ranged" && s.player.inPlay.some((p) => p.code === "04002")
        ? 1
        : 0) +
      (name === "Retaliate"
        ? x23.x23Stats(s).retaliate +
          psylocke.psylockeStats(s).retaliate +
          (s.attack?.angelRetaliatePlayerId === s.activePlayerId
            ? s.attack.angelRetaliate || 0
            : 0) +
          rogue.rogueModifiers(s).retaliate +
          phoenix.phoenixSuit(s).retaliate +
          storm.stormGlobal(s).retaliate +
          captainStats(s).retaliate +
          mansionAttack.mansionAttackModifiers(s, "hero", { isTextBlank })
            .retaliate +
          hulkStats(s).retaliate +
          drax.draxStats(s).retaliate +
          spectrum.spectrumRetaliate(s) +
          nebula.nebulaRetaliate(s) +
          vision.visionRetaliate(s) +
          wasp.waspRetaliate(textActiveState(s)) +
          gmwPack.gmwPlayerPackRetaliate(textActiveState(s), gmwPorts)
        : 0)
    );
  const p = find(s, source);
  if (!p) return 0;
  if (name === "Piercing" && p.code === "44015" && !isTextBlank(s, p)) return 1;
  const wideawakeKeywords = wideawake.projectWideawakeModifiers(s, p, {
    isTextBlank,
  });
  const moldKeywords = masterMold.masterMoldModifiers(s, p, {
    isTextBlank,
    hasTrait: captainPackHasTrait,
  });
  const mansionKeywords = mansionAttack.mansionAttackModifiers(s, p, {
    isTextBlank,
  });
  if (name === "Overkill" && ironspider.ironspiderSinisterOverkill(s, p))
    return 1;
  const granted = hawkeyeEnemyAttackTraits(s, p);
  const allyTraits = hawkeyeAllyAttackTraits(p);
  const packTraits = starLordPack.starLordPackModifiers(
    s,
    p.id,
    starLordPackPorts,
  );
  const intrinsic = Math.max(
    isTextBlank(s, p) ? 0 : printedKeyword(card(p), name),
    Number(
      name === "Guard" && (moldKeywords.guard || acolytes.acolytesGuard(s, p)),
    ),
    Number(
      name === "Stalwart" &&
        (storm.stormGlobal(s).stalwart ||
          sabretooth.sabretoothModifiers(s, p.id).stalwart),
    ),
    Number(
      name === "Quickstrike" &&
        brotherhood.brotherhoodModifiers(s, p, {
          isTextBlank,
          hasTrait: captainPackHasTrait,
        }).quickstrike,
    ),
    Number(
      !!(
        name === "Piercing" &&
        (storm.stormPiercing(s, p) ||
          acolytes.acolytesPiercing(s, p) ||
          granted.piercing ||
          nebula.nebulaNamedCharacterModifiers(s, card(p).name).piercing ||
          warMachine.warMachineEnemyKeywords(s, p).piercing ||
          sabretooth.sabretoothModifiers(s, p.id).piercing ||
          wideawakeKeywords.piercing ||
          wideawake.projectWideawakeAllyAttackModifiers(s, p, { isTextBlank })
            .piercing ||
          miles.milesEnemyAttackKeywords(s, p, { isTextBlank }).piercing ||
          allyTraits.piercing ||
          mgPack.mutantGenesisPlayerPackPiercing(
            controller(s, p.id) ? seatView(s, controller(s, p.id)!) : s,
            p,
            { isTextBlank },
          ) ||
          nebulaPack.nebulaPackModifiers(s, p.id, nebulaPackPorts).piercing ||
          (s.attack?.attacker === p.id && s.attack?.piercing))
      ),
    ),
    Number(
      !!(
        name === "Ranged" &&
        (granted.ranged ||
          wideawakeKeywords.ranged ||
          allyTraits.ranged ||
          packTraits.ranged ||
          warmPack.warMachinePackAllyModifiers(s, p, warMachinePackPorts)
            .ranged ||
          venomPack.venomPackAllyKeywords(s, p).ranged)
      ),
    ),
    Number(
      !!(
        name === "Overkill" &&
        (packTraits.overkill ||
          niPack.novaIronheartPackCharacterModifiers(s, p.id, niPackPorts)
            .overkill)
      ),
    ),
    name === "Retaliate"
      ? niPack.novaIronheartPackCharacterModifiers(s, p.id, niPackPorts)
          .retaliate +
          ironheart.ironheartEnemyKeywords(s, p, { isTextBlank }).retaliate +
          wideawakeKeywords.retaliate +
          moldKeywords.retaliate
      : 0,
  );
  const inherited = inheritors.inheritorsModifiers(s, p);
  const grantedValue = Number(
    inherited[name.toLowerCase() as keyof typeof inherited] || 0,
  );
  return name === "Retaliate"
    ? storm.stormGlobal(s).retaliate +
        intrinsic +
        grantedValue +
        mansionKeywords.retaliate
    : Math.max(intrinsic, grantedValue);
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
function removeDefeatedIronheartIdentities(s: GameState, seat: PlayerSeat) {
  if (seat.heroId !== "ironheart") return;
  const view = seatView(s, seat);
  const versions = new Set(["29001a", "29002a", "29003a"]);
  const identities = [
    ...(view.player.ironheartIdentity ? [view.player.ironheartIdentity] : []),
    ...(view.player.setAside || []).filter((p) => versions.has(p.code)),
  ];
  const identityIds = new Set(identities.map((p) => p.id));
  view.player.ironheartIdentity = undefined;
  view.player.setAside = (view.player.setAside || []).filter(
    (p) => !identityIds.has(p.id),
  );
  for (const p of identities) {
    for (const stored of p.storedCards || []) {
      const owner = s.players.find((other) => other.id === stored.ownerId);
      if (owner && !owner.eliminated)
        seatView(s, owner).player.discard.push(resetPiece(stored));
      else s.removed.push(resetPiece(stored));
    }
    if (!s.removed.some((piece) => piece.id === p.id))
      s.removed.push(resetPiece(p));
  }
  const attachmentTargets = new Set([
    ...identityIds,
    `hero:${seat.id}`,
    ...(s.activePlayerId === seat.id ? ["hero"] : []),
  ]);
  for (const p of [...allInPlay(s), ...s.attachments].filter((piece) =>
    attachmentTargets.has(piece.attachedTo || ""),
  ))
    movePieceFromPlay(s, p.id, p.ownerId === seat.id);
}
function removeDefeatedSpdrIdentities(s: GameState, seat: PlayerSeat) {
  if (seat.heroId !== "spdr") return;
  const view = seatView(s, seat);
  const ids = new Set([view.player.spdrSuitId, view.player.spdrPilotId]);
  const identities = [
    ...(view.player.spdrIdentity ? [view.player.spdrIdentity] : []),
    ...view.player.inPlay.filter((p) => ids.has(p.id)),
  ];
  view.player.spdrIdentity = undefined;
  view.player.inPlay = view.player.inPlay.filter((p) => !ids.has(p.id));
  for (const p of identities)
    if (!s.removed.some((piece) => piece.id === p.id))
      s.removed.push(resetPiece(p));
  const attachmentTargets = new Set([
    ...ids,
    `hero:${seat.id}`,
    ...(s.activePlayerId === seat.id ? ["hero"] : []),
  ]);
  for (const p of [...allInPlay(s), ...s.attachments].filter((piece) =>
    attachmentTargets.has(piece.attachedTo),
  ))
    movePieceFromPlay(s, p.id, p.ownerId === seat.id);
}
function beginResolution(s: GameState, p: Piece) {
  if (!s.resolving.some((x) => x.id === p.id)) s.resolving.push(p);
}
function finishResolution(s: GameState, id: string) {
  phoenix.phoenixEventFinished(s, id);
  gambit.gambitEventFinished(s, id);
  const index = s.resolving.findIndex((p) => p.id === id);
  if (index < 0) return;
  const [p] = s.resolving.splice(index, 1);
  if (
    card(p).type_code === "event" &&
    card(p).set_code === s.heroId &&
    !s.flags[`ghostCancelled:${p.id}`]
  )
    add(s, ...domino.dominoFeedback(s));
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
    ...(s.villainId === "mansion_attack" && (s.attack?.id || s.scheming?.id)
      ? { mansionActivationId: s.attack?.id || s.scheming?.id }
      : {}),
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
  // Every labeled defense ability, including attack/defense interrupts, must
  // respect the identity's defense restrictions during an actual attack.
  if (s.attack)
    options = options.filter((o) => {
      if (o.effects.some((e) => e.type === "magneto:missile-discard"))
        return true;
      const c = o.image ? card(o.image) : undefined;
      const actorId =
        o.effects.find((e) => e.actorId)?.actorId || s.activePlayerId;
      return (
        (!/\([^)]*\bdefense\b/i.test(c?.text || "") ||
          (!magneto.magnetoIdentityRestricted(s, actorId, { isTextBlank }) &&
            vision.visionCanDefend(seatView(s, actorId)) &&
            shadowcat.shadowcatCanDefend(
              seatView(s, actorId),
              shadowcatPorts,
            ))) &&
        (!/\([^)]*\bdefense\b/i.test(c?.text || "") ||
          !armadillo.armadilloDefenseBlocked(s, s.attack!.attacker))
      );
    });
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
  ...(!s.mansionAttack?.activeVillainRetired ? [s.villain] : []),
  ...s.minions,
  ...s.sideSchemes,
  ...allInPlay(s),
  ...s.attachments,
  ...(s.environments || []),
  ...(s.sabretooth?.kelly ? [s.sabretooth.kelly] : []),
];
const find = (s: GameState, id: string) =>
  allPieces(s).find((p) => p.id === (id === "villain" ? s.villain.id : id)) ||
  s.players
    .flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.spiderHamIdentity, p.spdrIdentity];
    })
    .find((p) => p?.id === id);
const friends = (s: GameState) =>
  [...s.player.inPlay, ...controlledNPCs(s)].filter(
    (p) => card(p).type_code === "ally",
  );
export function allyCount(s: GameState) {
  return friends(s).filter(
    (p) =>
      !antPack.antManPackAllyExcluded(s, p) &&
      masterMold.masterMoldMagnetoCountsAgainstAllyLimit(s, p, {
        isTextBlank,
      }) &&
      wideawake.projectWideawakeJubileeCountsAgainstAllyLimit(s, p, {
        isTextBlank,
      }) &&
      (p.id !== sabretooth.sabretoothKelly(s)?.id ||
        sabretooth.sabretoothKellyCountsAgainstAllyLimit(s)),
  ).length;
}
export function allyLimit(s: GameState) {
  return (
    3 +
    cyclops.cyclopsAllyLimit(s, captainPackHasTrait) +
    Number(has(s, "01073")) +
    captainPackAllyLimit(s) +
    starLordPack.starLordPackAllyLimit(s) +
    mtsPlayerPack.mtsPlayerPackAllyLimit(s, mtsPlayerPackPorts) +
    nebulaPack.nebulaPackAllyLimit(s, nebulaPackPorts) +
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
    !p ||
      target !== sabretooth.sabretoothKelly(s)?.id ||
      sabretooth.sabretoothKellyCanAttach(s, card(p)),
    "Robert Kelly cannot have player cards or upgrades attached.",
  );
  need(
    p &&
      source &&
      (targetSeat ||
        target === "main" ||
        s.sideSchemes.some((piece) => piece.id === target)),
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
    (p) =>
      rulesCode(p) === rulesCode(code) &&
      p.attachedTo === s.villain.id &&
      !isTextBlank(s, p),
  );
type MystiquePlayerSource = { playerId: string; ids: string[] };
function mystiqueNativeSourceSnapshot(s: GameState): MystiquePlayerSource[] {
  const sources: MystiquePlayerSource[] = [];
  for (const seat of s.players) {
    const player = seatView(s, seat).player;
    let ids: string[] | undefined;
    for (const zone of [player.hand, player.deck])
      for (const p of zone)
        if (mystique.mystiqueDiscardFromPlayerZone(p, "hand"))
          (ids ||= []).push(p.id);
    if (ids) sources.push({ playerId: seat.id, ids });
  }
  return sources;
}
function mystiqueNativeSeedHands(s: GameState): void {
  s.mystiqueHandPresence ||= Object.fromEntries(
    s.players.map((seat) => [
      seat.id,
      seatView(s, seat)
        .player.hand.filter((p) => ["32082", "32083", "38027"].includes(p.code))
        .map((p) => p.id),
    ]),
  );
}
function mystiqueNativeReconcileDiscards(
  s: GameState,
  sources?: MystiquePlayerSource[],
): void {
  const raw = s.players[0]?.flags.mystiqueNativeSources;
  if (!sources && !raw) return;
  const snapshot =
    sources || (JSON.parse(String(raw)) as MystiquePlayerSource[]);
  if (!snapshot.length) return;
  const sourceIds = new Set(snapshot.flatMap((p) => p.ids));
  for (const seat of s.players) {
    const discard = seatView(s, seat).player.discard;
    for (let i = discard.length - 1; i >= 0; i--) {
      const p = discard[i];
      if (
        sourceIds.has(p.id) &&
        mystique.mystiqueDiscardFromPlayerZone(p, "hand")
      ) {
        discard.splice(i, 1);
        need(
          !s.encounter.discard.some((a) => a.id === p.id),
          "A physical Shapeshifter cannot occupy two discard piles.",
        );
        s.encounter.discard.push(p);
      }
    }
  }
}
function mystiqueNativeObserveHands(s: GameState): Effect[] {
  mystiqueNativeSeedHands(s);
  const effects: Effect[] = [];
  const returnActor = s.activePlayerId;
  for (const seat of s.players) {
    const view = seatView(s, seat),
      before = s.mystiqueHandPresence![seat.id] || [];
    let currentIds: string[] | undefined;
    for (const p of view.player.hand) {
      if (!["32082", "32083", "38027"].includes(p.code)) continue;
      (currentIds ||= []).push(p.id);
      if (!before.includes(p.id)) {
        const receipt: mystique.MystiqueHandEntryReceipt = {
          token: `mystique-entry:${s.nextId++}`,
          playerId: seat.id,
          pieceId: p.id,
          code: p.code,
        };
        effects.push(
          ...(p.code === "38027"
            ? [{ type: "rogue:misled-hand", actorId: seat.id }]
            : mystique.mystiqueHandEntered(s, receipt, mystiquePorts)
          ).map((e) => ({
            ...e,
            mandatory: true,
            after: [
              E("mystique-native:return-actor", {
                playerId: returnActor,
                actorId: returnActor,
              }),
            ],
          })),
        );
      }
    }
    if (currentIds || before.length)
      s.mystiqueHandPresence![seat.id] = currentIds || [];
  }
  return effects;
}
function mystiqueNativeQueueHandEntries(s: GameState, effects: Effect[]): void {
  if (!effects.length) return;
  const prompt = s.prompt,
    actorId = s.activePlayerId;
  if (prompt) s.prompt = null;
  add(
    s,
    ...effects,
    ...(prompt ? [E("resumePrompt", { prompt, actorId })] : []),
  );
}
function mystiqueNativeBeginMovement(s: GameState): MystiquePlayerSource[] {
  mystiqueNativeSeedHands(s);
  const sources = mystiqueNativeSourceSnapshot(s);
  if (sources.length && s.players[0])
    s.players[0].flags.mystiqueNativeSources = JSON.stringify(sources);
  return sources;
}
function mystiqueNativeFinishMovement(
  s: GameState,
  sources: MystiquePlayerSource[],
): void {
  mystiqueNativeReconcileDiscards(s, sources);
  if (s.players[0]) delete s.players[0].flags.mystiqueNativeSources;
  mystiqueNativeQueueHandEntries(s, mystiqueNativeObserveHands(s));
}
function discardHand(s: GameState, id: string) {
  mystiqueNativeQueueHandEntries(s, mystiqueNativeObserveHands(s));
  const i = s.player.hand.findIndex((p) => p.id === id);
  need(i >= 0, "That card is no longer in your hand.");
  const [p] = s.player.hand.splice(i, 1);
  if (mystique.mystiqueDiscardFromPlayerZone(p, "hand"))
    s.encounter.discard.push(p);
  else {
    const owner = s.players.find((seat) => seat.id === p.ownerId);
    if (owner?.eliminated) s.removed.push(p);
    else (owner ? seatView(s, owner) : s).player.discard.push(p);
  }
  if (s.mystiqueHandPresence?.[s.activePlayerId])
    s.mystiqueHandPresence[s.activePlayerId] = s.mystiqueHandPresence[
      s.activePlayerId
    ].filter((physicalId) => physicalId !== id);
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
  mystiqueNativeReconcileDiscards(s);
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
function draw(s: GameState, n: number): boolean {
  mystiqueNativeSeedHands(s);
  let count = 0;
  let interrupted = false;
  for (let i = 0; i < n; i++) {
    const queuedBefore = s.queue.length;
    const p = takePlayer(s);
    if (p) {
      s.player.hand.push(p);
      count++;
      const entries = mystiqueNativeObserveHands(s);
      if (entries.length) {
        const exhaustion = s.queue.splice(0, s.queue.length - queuedBefore);
        add(
          s,
          ...exhaustion,
          ...entries,
          ...(i + 1 < n ? [E("draw", { amount: n - i - 1 })] : []),
        );
        interrupted = true;
        break;
      }
    }
  }
  if (count) log(s, `Draw ${count} card${count === 1 ? "" : "s"}.`);
  return interrupted;
}
function mystiqueNativeDrawToHandSize(
  s: GameState,
  continuation: Effect,
): boolean {
  while (s.player.hand.length < handSize(s)) {
    const beforeCards = s.player.hand.length,
      beforeQueue = s.queue.length;
    if (draw(s, 1)) {
      const generated = s.queue.splice(0, s.queue.length - beforeQueue);
      add(s, ...generated, continuation);
      return true;
    }
    if (s.player.hand.length === beforeCards) break;
  }
  return false;
}
function mill(s: GameState, n: number) {
  const a: Piece[] = [];
  const available = Math.min(n, s.player.deck.length);
  for (let i = 0; i < available; i++) {
    const p = s.player.deck.shift();
    if (p) {
      revealHidden(s);
      a.push(p);
      if (mystique.mystiqueDiscardFromPlayerZone(p, "deck"))
        s.encounter.discard.push(p);
      else s.player.discard.push(p);
    }
  }
  recyclePlayer(s);
  add(s, ...domino.dominoDiscardedTop(s, a));
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
function removedByPlayerElimination(s: GameState, p: Piece) {
  return s.players.some(
    (seat) =>
      seat.eliminated &&
      (p.ownerId === seat.id ||
        seatView(s, seat).player.inPlay.some((q) => q.id === p.id)),
  );
}
function discardPiece(s: GameState, id: string) {
  const p = find(s, id);
  need(
    !p || !isPermanent(card(p)) || removedByPlayerElimination(s, p),
    "Permanent cards cannot be discarded from play.",
  );
  need(
    !p || valkyrie.valkyrieCanDiscardAttachment(s, p),
    "Powerful Enchantments prevents discarding this attachment.",
  );
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
function movePieceFromPlay(
  s: GameState,
  id: string,
  removed: boolean,
  setAsideOwnerId?: string,
  victory = false,
) {
  const controlling = controller(s, id);
  const viewBefore = controlling ? seatView(s, controlling) : s;
  const healthBefore = maxHP(viewBefore);
  const removedSource = find(s, id);
  if (
    removedSource &&
    gambit.gambitShield(s, removedSource, { discard: discardPiece })
  )
    return;
  const angelHealthTarget =
    removedSource?.code === "42032" &&
    removedSource.attachedTo?.startsWith("hero:") &&
    !isTextBlank(s, removedSource)
      ? removedSource.attachedTo.slice(5)
      : undefined;
  if (removedSource && !removed && x23.x23Cybermods(s, removedSource, x23Ports))
    return;
  if (removedSource) cyclops.cyclopsCardLeft(s, removedSource);
  need(
    !removedSource ||
      ((!isPermanent(card(removedSource)) ||
        removedByPlayerElimination(s, removedSource)) &&
        !zeroTolerance.zeroToleranceIsPermanent(s, removedSource)),
    "Permanent cards cannot leave play.",
  );
  if (removedSource && removedSource.id === sabretooth.sabretoothKelly(s)?.id) {
    delete s.spiderHamConsequentialReceipts?.[id];
    const minionIndex = s.minions.findIndex((p) => p.id === id);
    if (minionIndex >= 0) s.minions.splice(minionIndex, 1);
    for (const attached of [...allInPlay(s), ...s.attachments].filter(
      (piece) => piece.attachedTo === id,
    ))
      discardPiece(s, attached.id);
    (removed ? s.removed : s.encounter.discard).push(resetPiece(removedSource));
    sabretooth.sabretoothKellyLeftPlay(s, id, {
      lose: (state, reason) => endGame(state, false, reason),
    });
    return;
  }
  // Spectrum's three physical setup upgrades remain in play even facedown.
  // Player elimination removes them through its ordinary whole-seat cleanup.
  if (
    removedSource &&
    !removedByPlayerElimination(s, removedSource) &&
    Object.values(spectrum.SPECTRUM_FORM_CODES).includes(
      removedSource.code as (typeof spectrum.SPECTRUM_FORM_CODES)[keyof typeof spectrum.SPECTRUM_FORM_CODES],
    )
  )
    return;
  if (
    removedSource &&
    controlling &&
    ["27017", "27048"].includes(removedSource.code) &&
    !seatView(s, controlling).flags[`sinisterLeaveCommitted:${id}`] &&
    !controlling.eliminated
  ) {
    removedSource.pendingDefeat = true;
    add(
      s,
      E("sinisterNativeLeave", {
        id,
        removed,
        setAsideOwnerId,
        actorId: controlling.id,
      }),
    );
    return;
  }
  if (
    removedSource &&
    !removed &&
    !victory &&
    !setAsideOwnerId &&
    card(removedSource).faction_code !== "encounter" &&
    !s.flags[`niLeaveCommitted:${id}`]
  ) {
    const ownerId =
      removedSource.ownerId || controlling?.id || s.activePlayerId;
    const receipt: niPack.NovaIronheartLeaveReceipt = {
      token: `leave:${s.nextId++}`,
      pieceId: id,
      code: removedSource.code,
      ownerId,
      playerCard: true,
      fromPlay: true,
      toDiscard: true,
    };
    const players = playerOrder(s).map((seat) => seat.id);
    if (
      players.some((pid) =>
        niPack.novaIronheartPackLeaveInterrupt(
          seatView(s, pid),
          receipt,
          niPackPorts,
        ),
      )
    ) {
      add(
        s,
        E("niNativeLeaveWindow", {
          receipt,
          players,
          index: 0,
          originalActorId: s.activePlayerId,
          removed,
          setAsideOwnerId,
        }),
      );
      return;
    }
  }
  if (removedSource) add(s, ...phoenix.phoenixCardLeft(s, removedSource));
  if (removedSource) mgPack.mutantGenesisPlayerPackCardLeft(s, id);
  const leaveReceipt =
    removedSource && controlling && card(removedSource).type_code === "ally"
      ? {
          token: `leave:${s.nextId++}`,
          playerId: controlling.id,
          pieceId: removedSource.id,
          code: removedSource.code,
          traits: sinisterNativeTraits(viewBefore, removedSource),
        }
      : undefined;
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
  rogue.rogueCardLeft(s, id);
  wideawake.projectWideawakeEnemyLeftPlay(s, id);
  if (
    rulesCode(p) === "01127" &&
    ((p as ImmortalKlawScheme).immortalKlawHealthActive ?? !blankBefore)
  ) {
    s.villain.maxHp -= 10;
    s.villain.hp -= 10;
  }
  if (leaveReceipt)
    for (const seat of playerOrder(s))
      add(
        s,
        ...(
          sinisterPlayerPack.sinisterPlayerPackAllyLeftPlay(
            seatView(s, seat),
            leaveReceipt,
            sinisterPlayerPackPorts,
          ) || []
        ).map((e) => ({ ...e, actorId: seat.id })),
      );
  if (leaveReceipt)
    add(
      s,
      ...(spiderHamPack.spiderHamPackAllyLeftPlay(
        s,
        leaveReceipt,
        spiderHamPackPorts,
      ) || []),
    );
  spiderHamPack.spiderHamPackCardLeftPlay(s, p);
  delete s.spiderHamConsequentialReceipts?.[p.id];
  storm.stormLeftPlay(s, p);
  warmPack.warMachinePackCardLeftPlay(s, p);
  visionPack.visionPackCardLeftPlay(s, p);
  niPack.novaIronheartPackCardLeftPlay(s, p);
  add(s, ...valkyrie.valkyrieAttachmentDiscarded(s, p));
  if (
    p.code === "13029" &&
    p.attachedTo === s.villain.id &&
    ((p as BeetleArmorAttachment).beetleArmorHealthActive ?? !blankBefore)
  ) {
    s.villain.maxHp -= 4;
    s.villain.hp -= 4;
  }
  if (
    p.code === "32096" &&
    p.attachedTo === s.villain.id &&
    (p as AdaptiveArmorAttachment).wideawakeArmorHealthActive
  ) {
    s.villain.maxHp -= 8;
    s.villain.hp -= 8;
  }
  for (const before of teamHealthBefore) {
    const view = seatView(s, before.id);
    view.player.hp += maxHP(view) - before.hp;
  }
  s.encounter.discard.push(
    ...(p.inheritorBoosts || []).map((boost) => resetPiece(boost)),
  );
  for (const stored of [...(p.storedCards || []), ...(p.captured || [])]) {
    const owner = s.players.find((seat) => seat.id === stored.ownerId);
    if (["32088b", "32172b"].includes(stored.code))
      s.removed.push(resetPiece(stored));
    else if (
      card(stored).faction_code === "encounter" &&
      !(wideawakeCaptive(stored) && stored.ownerId)
    )
      s.encounter.discard.push(resetPiece(stored));
    else if (!owner || owner.eliminated) s.removed.push(resetPiece(stored));
    else seatView(s, owner).player.discard.push(resetPiece(stored));
  }
  for (const a of [
    ...allInPlay(s),
    ...s.attachments,
    ...(sabretooth.sabretoothKelly(s) ? [sabretooth.sabretoothKelly(s)!] : []),
  ].filter((a) => a.attachedTo === id))
    discardPiece(s, a.id);
  if (p.code === "drone") {
    if (p.droneCard) {
      const owner = s.players.find((x) => x.id === p!.droneCard!.ownerId);
      if (owner && !owner.eliminated)
        seatView(s, owner).player.discard.push(p.droneCard);
      else s.removed.push(p.droneCard);
    }
  } else if (["32088b", "32172b"].includes(p.code) && !victory)
    s.removed.push(resetPiece(p));
  else if (p.code === "32172b" && victory)
    (s.victoryDisplay ||= []).push(resetPiece(p));
  else if (isPlayerSideScheme(p) && victory)
    (s.victoryDisplay ||= []).push(resetPiece(p));
  else if (
    card(p).faction_code === "encounter" &&
    !(wideawakeCaptive(p) && p.ownerId)
  )
    (victory ? (s.victoryDisplay ||= []) : s.encounter.discard).push(
      resetPiece(p),
    );
  else {
    const owner =
      s.players.find((x) => x.id === p!.ownerId) ||
      controlling ||
      s.players.find((x) => x.id === s.activePlayerId)!;
    const discarded = resetPiece(p);
    if (setAsideOwnerId) {
      const view = seatView(s, setAsideOwnerId);
      view.player.setAside ||= [];
      view.player.setAside.push(discarded);
    } else if (s.flags[`spiderHamReturnHand:${id}`] && !owner.eliminated) {
      seatView(s, owner).player.hand.push(discarded);
      delete s.flags[`spiderHamReturnHand:${id}`];
    } else if (removed || owner.eliminated) s.removed.push(discarded);
    else if (s.flags[`niLeaveShuffle:${id}`]) {
      const target =
        s.players.find((seat) => seat.id === s.flags[`niLeaveShuffle:${id}`]) ||
        owner;
      seatView(s, target).player.deck.push(discarded);
      seatView(s, target).player.deck = shuffle(
        s,
        seatView(s, target).player.deck,
      );
      delete s.flags[`niLeaveShuffle:${id}`];
    } else {
      seatView(s, owner).player.discard.push(discarded);
      // A discard cost is paid at this native destination commit. Keep the
      // receipt even if a later response moves that physical card again.
      for (const seat of s.players) {
        const flags = seatView(s, seat).flags;
        if (flags[`zzzaxDiscardPending:${id}`])
          flags[`zzzaxDiscardPaid:${id}`] = true;
      }
    }
    delete s.flags[`niLeaveCommitted:${id}`];
    const view = controlling ? seatView(s, controlling) : s;
    if (rulesCode(p) === "01036" && !blankBefore) view.player.hp -= 6;
    if (rulesCode(p) === "01039" && !blankBefore) view.player.hp--;
    if (p.code === "10010") view.player.hp -= 4;
    if (
      cardScript(p)?.implementation === "script" ||
      p.code === "16035" ||
      p.code === "25007" ||
      p.code === "27191" ||
      ["29012", "29013", "35004", "43009", "43036"].includes(p.code) ||
      (p.code === "22035" && p.attachedTo?.startsWith("hero:")) ||
      (p.code === "03025" && p.attachedTo?.startsWith("hero:"))
    )
      view.player.hp -= healthBefore - maxHP(view);
    if (angelHealthTarget) seatView(s, angelHealthTarget).player.hp--;
    view.player.hp = Math.min(view.player.hp, maxHP(view));
  }
}
function endGame(s: GameState, won: boolean, reason: string) {
  // A saved Mystique callback owns the outer activation's real facedown
  // cards until that activation resumes. Terminal loss clears those callbacks.
  const pending = new Map<string, Piece>();
  const collect = (activation: GameState["attack"] | GameState["scheming"]) => {
    if (!activation) return;
    for (const p of activation.pendingBoosts || []) pending.set(p.id, p);
    activation.pendingBoosts = [];
    const callback = activation.activationAfter;
    if (
      callback &&
      [
        "mystique-native:activation-finish",
        "mansion-native:activation-finish",
      ].includes(callback.type)
    ) {
      collect(callback.outerAttack);
      collect(callback.outerScheme);
    }
  };
  collect(s.attack);
  collect(s.scheming);
  for (const callback of s.queue.filter((e) =>
    [
      "mystique-native:activation-finish",
      "mansion-native:activation-finish",
    ].includes(e.type),
  )) {
    collect(callback.outerAttack);
    collect(callback.outerScheme);
  }
  s.encounter.discard.push(...pending.values());
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
function nativeIdentityDamageSource(s: GameState, source: string) {
  if (source === "hero" || source === "audacity")
    return `hero:${s.activePlayerId}`;
  if (source.startsWith("hero:")) return source;
  const p = find(s, source);
  if (p && card(p).type_code === "upgrade") {
    const seat = controller(s, p.id);
    return seat ? `hero:${seat.id}` : undefined;
  }
  const event = s.resolving.find(
    (p) =>
      (p.id === source || p.code === source) && card(p).type_code === "event",
  );
  return event?.ownerId ? `hero:${event.ownerId}` : undefined;
}
function syncValkyrieConvertedCards(s: GameState) {
  phoenix.phoenixSyncControlled(s);
  for (const p of [...s.minions]) {
    const poolized = phoenix.phoenixLatestControl(s, p)?.code === "44041";
    if (poolized) {
      p.treatedAsMinion = true;
      p.deadpoolMinion = true;
      delete p.treatedAsAlly;
      continue;
    }
    if (p.deadpoolMinion) {
      delete p.deadpoolMinion;
      delete p.treatedAsMinion;
      if (!phoenix.phoenixLatestControl(s, p)) {
        const owner = s.players.find(
          (seat) => seat.id === (p.ownerId || p.deadpoolController),
        );
        if (owner) {
          s.minions.splice(s.minions.indexOf(p), 1);
          delete p.engagedWith;
          seatView(s, owner).player.inPlay.push(p);
          continue;
        }
      }
    }
    const possessed = storm.stormLatestControl(s, p) === "36038";
    if (possessed) {
      p.treatedAsMinion = true;
      p.stormControlled = true;
      delete (p as Piece & { treatedAsAlly?: boolean }).treatedAsAlly;
      continue;
    }
    if (p.stormControlled) {
      delete p.stormControlled;
      delete p.treatedAsMinion;
      const remainingControl = storm.stormLatestControl(s, p);
      if (
        remainingControl === "25031" ||
        (card(p.code).type_code === "minion" &&
          !["34009", "38011"].includes(remainingControl || ""))
      ) {
        if (remainingControl === "25031") p.treatedAsMinion = true;
        for (const seat of s.players)
          delete seatView(s, seat).flags[`stormController:${p.id}`];
        continue;
      }
      s.minions.splice(s.minions.indexOf(p), 1);
      const owner =
        s.players.find((seat) => seat.id === p.ownerId && !seat.eliminated) ||
        playerOrder(s).find(
          (seat) => seatView(s, seat).flags[`stormController:${p.id}`],
        ) ||
        s.players.find((seat) => seat.id === (p.engagedWith || p.ownerId));
      delete p.engagedWith;
      for (const seat of s.players)
        delete seatView(s, seat).flags[`stormController:${p.id}`];
      if (p.id === s.sabretooth?.kellyId) {
        s.sabretooth.kelly = p;
        sabretooth.sabretoothFirstPlayerChanged(s);
      } else if (owner) seatView(s, owner).player.inPlay.push(p);
      continue;
    }
    if (
      valkyrie.valkyrieBeguiledEnemy(s, p) &&
      !["34009", "38011"].includes(
        phoenix.phoenixLatestControl(s, p)?.code || "",
      )
    ) {
      p.treatedAsMinion = true;
      continue;
    }
    delete p.treatedAsMinion;
    if (card(p.code).type_code !== "ally") continue;
    if (p.id === s.sabretooth?.kellyId) {
      s.minions.splice(s.minions.indexOf(p), 1);
      delete p.engagedWith;
      s.sabretooth.kelly = p;
      sabretooth.sabretoothFirstPlayerChanged(s);
      continue;
    }
    const savedController = valkyrie.valkyrieBeguiledController(s, p.id);
    const attachment = s.attachments.some(
      (a) => a.code === "25031" && a.attachedTo === p.id,
    );
    if (!savedController && !attachment) continue;
    const seat = s.players.find(
      (seat) =>
        seat.id === (savedController || p.engagedWith) && !seat.eliminated,
    );
    if (!seat) continue;
    s.minions.splice(s.minions.indexOf(p), 1);
    delete p.engagedWith;
    seatView(s, seat).player.inPlay.push(p);
  }
  for (const p of allInPlay(s)) {
    if (phoenix.phoenixLatestControl(s, p)?.code === "44041") {
      const seat = controller(s, p.id);
      if (seat) {
        seatView(s, seat).player.inPlay.splice(
          seatView(s, seat).player.inPlay.indexOf(p),
          1,
        );
        p.engagedWith = seat.id;
        p.deadpoolController = seat.id;
        p.deadpoolMinion = true;
        p.treatedAsMinion = true;
        delete p.treatedAsAlly;
        s.minions.push(p);
      }
      continue;
    }
    if (storm.stormLatestControl(s, p) === "36038") {
      const seat = controller(s, p.id);
      if (seat) {
        const v = seatView(s, seat);
        v.flags[`stormController:${p.id}`] = seat.id;
        v.player.inPlay.splice(v.player.inPlay.indexOf(p), 1);
        p.engagedWith = seat.id;
        p.treatedAsMinion = true;
        p.stormControlled = true;
        delete (p as Piece & { treatedAsAlly?: boolean }).treatedAsAlly;
        s.minions.push(p);
      }
      continue;
    }
    if (
      !valkyrie.valkyrieBeguiledEnemy(s, p) ||
      ["34009", "38011"].includes(
        phoenix.phoenixLatestControl(s, p)?.code || "",
      )
    )
      continue;
    const controlling = controller(s, p.id);
    const seat = s.players.find(
      (seat) =>
        seat.id ===
          (valkyrie.valkyrieBeguiledController(s, p.id) || controlling?.id) &&
        !seat.eliminated,
    );
    if (!controlling || !seat) continue;
    const zone = seatView(s, controlling).player.inPlay;
    zone.splice(zone.indexOf(p), 1);
    p.engagedWith = seat.id;
    p.treatedAsMinion = true;
    s.minions.push(p);
  }
  const npc = s.sabretooth?.kelly;
  if (
    npc &&
    s.attachments.some(
      (a) =>
        a.code === "36038" && a.attachedTo === npc.id && !isTextBlank(s, a),
    )
  ) {
    const seat = controller(s, npc.id);
    if (seat) {
      delete s.sabretooth!.kelly;
      npc.engagedWith = seat.id;
      npc.treatedAsMinion = true;
      npc.stormControlled = true;
      seatView(s, seat).flags[`stormController:${npc.id}`] = seat.id;
      s.minions.push(npc);
    }
  }
  if (npc && !npc.stormControlled && valkyrie.valkyrieBeguiledEnemy(s, npc)) {
    const controlling = controller(s, npc.id);
    if (controlling && !controlling.eliminated) {
      delete s.sabretooth!.kelly;
      npc.engagedWith = controlling.id;
      npc.treatedAsMinion = true;
      s.minions.push(npc);
    }
  }
  for (const seat of s.players)
    for (const p of [
      ...seatView(s, seat).player.inPlay,
      ...seatView(s, seat).player.discard,
      ...seatView(s, seat).player.deck,
      ...seatView(s, seat).player.hand,
    ]) {
      delete p.treatedAsMinion;
      delete p.stormControlled;
    }
}
type ImmortalKlawScheme = Piece & { immortalKlawHealthActive?: boolean };
type BeetleArmorAttachment = Piece & { beetleArmorHealthActive?: boolean };
type AdaptiveArmorAttachment = Piece & { wideawakeArmorHealthActive?: boolean };
function syncVillainTextHealth(s: GameState) {
  let decreased = false;
  for (const p of s.attachments.filter(
    (p) => p.code === "32096" && p.attachedTo === s.villain.id,
  ) as AdaptiveArmorAttachment[]) {
    const previous = p.wideawakeArmorHealthActive ?? false;
    const active = !isTextBlank(s, p);
    p.wideawakeArmorHealthActive = active;
    if (active === previous) continue;
    const change = active ? 8 : -8;
    s.villain.maxHp += change;
    s.villain.hp += change;
    decreased ||= change < 0;
  }
  for (const p of s.sideSchemes.filter(
    (piece) => rulesCode(piece) === "01127",
  ) as ImmortalKlawScheme[]) {
    // Earlier saves already applied the continuous bonus when this physical
    // scheme entered play. Preserve that state before observing blanking.
    const previous = p.immortalKlawHealthActive ?? true;
    const active = !isTextBlank(s, p);
    p.immortalKlawHealthActive = active;
    if (active === previous) continue;
    const change = active ? 10 : -10;
    s.villain.maxHp += change;
    s.villain.hp += change;
    decreased ||= change < 0;
  }
  for (const p of s.attachments.filter(
    (piece) => piece.code === "13029" && piece.attachedTo === s.villain.id,
  ) as BeetleArmorAttachment[]) {
    const previous = p.beetleArmorHealthActive ?? true;
    const active = !isTextBlank(s, p);
    p.beetleArmorHealthActive = active;
    if (active === previous) continue;
    const change = active ? 4 : -4;
    s.villain.maxHp += change;
    s.villain.hp += change;
    decreased ||= change < 0;
  }
  if (decreased && s.villain.hp <= 0 && !["won", "lost"].includes(s.phase))
    advanceVillain(s);
}
function check(s: GameState) {
  for (const p of allInPlay(s).filter(
    (p) =>
      (p.code === "40021" && !allInPlay(s).some((q) => q.code === "40015")) ||
      (p.code === "40012" &&
        seatView(s, controller(s, p.id) || s.activePlayerId).player.form !==
          "hero"),
  ))
    if (!isTextBlank(s, p)) discardPiece(s, p.id);
  syncValkyrieConvertedCards(s);
  syncVillainTextHealth(s);
  if (
    s.villainId === "mansion_attack" &&
    mansionAttack.mansionAttackCheckOutcome(s, mansionAttackPorts)
  )
    return;
  wideawake.projectWideawakeFirstPlayerChanged(s, wideawakePorts);
  masterMold.masterMoldFirstPlayerChanged(s, masterMoldPorts);
  if (zeroTolerance.zeroToleranceCheckLoss(s, zeroTolerancePorts)) return;
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
    ...(s.sabretooth?.kelly ? [s.sabretooth.kelly] : []),
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
    if (deadpool.deadpoolRescue(view, deadpoolPorts)) continue;
    if (
      view.flags.captainHelmetPending ||
      view.flags.draxStubbornPending ||
      view.flags.phoenixDefeatPending
    )
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
    if (!view.flags.phoenixDefeatDeclined) {
      const choices = phoenix.phoenixDefeatOptions(view);
      if (choices.length) {
        if (s.prompt) continue;
        activateSeat(s, seat.id);
        s.flags.phoenixDefeatPending = true;
        choose(
          s,
          "Rise from the Ashes",
          "Your identity would be defeated. Restore it instead?",
          [
            ...choices,
            option("defeat", "Allow defeat", [E("phoenix:allow-defeat")]),
          ],
        );
        return;
      }
    }
    if (view.flags.wolverineDefeatPending) continue;
    if (
      view.flags.wolverineLethalAttack &&
      !view.flags.wolverineDefeatDeclined
    ) {
      const choices = wolverine.wolverineDefeatOptions(view, []);
      if (choices.length) {
        if (s.prompt) continue;
        activateSeat(s, seat.id);
        s.flags.wolverineDefeatPending = true;
        choose(s, '"I Got Better"', "Replace defeat by this enemy attack?", [
          ...choices,
          option("defeat", "Allow defeat", [
            { type: "wolverine:allow-defeat" },
          ]),
        ]);
        return;
      }
    }
    seat.eliminated = true;
    seat.ended = true;
    removeDefeatedIronheartIdentities(s, seat);
    removeDefeatedSpdrIdentities(s, seat);
    if (s.attack?.targetPlayerId === seat.id) {
      s.encounter.discard.push(...(s.attack.pendingBoosts || []));
      for (const id of s.attack.boostIds || []) finishResolution(s, id);
      // Established delayed effects still resolve when elimination ends the
      // attack early, including elimination during an earlier boost ability.
      add(
        s,
        ...antMan.antManEnemyActivated(s, s.attack.attacker),
        ...armadillo
          .armadilloActivationResponses(s, s.attack.attacker)
          .flatMap((r) => r.effects),
        ...(s.attack.afterActivation || []),
        ...(s.attack.visionAfterAttack || []),
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
    if (s.firstPlayerId === seat.id) {
      s.firstPlayerId = next.id;
      sabretooth.sabretoothFirstPlayerChanged(s);
      wideawake.projectWideawakeFirstPlayerChanged(s, wideawakePorts);
      masterMold.masterMoldFirstPlayerChanged(s, masterMoldPorts);
    }
    const remainingNPC = sabretooth.sabretoothKelly(s);
    if (remainingNPC && controller(s, remainingNPC.id)?.id === seat.id) {
      movePieceFromPlay(s, remainingNPC.id, false);
      if (s.phase === "lost") return;
    }
    for (const m of s.minions)
      if (m.engagedWith === seat.id) {
        m.engagedWith = next.id;
        add(
          s,
          ...masterMold.masterMoldMinionEngaged(
            s,
            {
              token: `engagement:${s.nextId++}`,
              minionId: m.id,
              playerId: next.id,
            },
            { isTextBlank },
          ),
        );
        add(s, ...rogue.rogueMinionEngaged(s, m));
        add(s, ...spiderHam.spiderHamMinionEngaged(s, m, next.id));
        add(
          s,
          ...ironspider.ironspiderSinisterEngagementResponses(s, m, next.id),
        );
      }
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
    for (const scheme of playerSideSchemes(s).filter(
      (p) => p.ownerId === seat.id,
    ))
      movePieceFromPlay(s, scheme.id, true);
    s.encounter.discard.push(
      ...s.encounter.dealt.filter((p) => p.dealtTo === seat.id),
    );
    s.encounter.dealt = s.encounter.dealt.filter((p) => p.dealtTo !== seat.id);
  }
}
export function schemeLimit(s: GameState) {
  const magneticLimit = magneto.magnetoMainThreatLimit(s);
  if (magneticLimit !== undefined) return magneticLimit;
  const mansionLimit = mansionAttack.mansionAttackMainThreatLimit(s);
  const wideawakeLimit = wideawake.projectWideawakeMainThreatLimit(s);
  if (wideawakeLimit !== undefined) return wideawakeLimit;
  const sabretoothLimit = sabretooth.sabretoothMainThreatLimit(s);
  if (sabretoothLimit === 0) return 0;
  const value = riskySchemeValues(s) || mutagenSchemeValues(s);
  const surveillance =
    deadpool.deadpoolSchemeBonus(s) +
    allInPlay(s).filter(
      (p) =>
        p.code === "06031" &&
        ["main", `main:${s.scheme.code}`].includes(p.attachedTo || ""),
    ).length *
      4;
  if (mansionLimit !== undefined) return mansionLimit + surveillance;
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
function heal(
  s: GameState,
  target: string,
  n: number,
  origin: "player" | "encounter" = "player",
): number {
  if (
    target === sabretooth.sabretoothKelly(s)?.id &&
    !sabretooth.sabretoothKellyCanHeal(s, origin)
  )
    return 0;
  if (target?.startsWith("hero:"))
    return heal(seatView(s, target.slice(5)), "hero", n, origin);
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
function playerHealingTarget(s: GameState, target: string): boolean {
  if (
    target === sabretooth.sabretoothKelly(s)?.id &&
    !sabretooth.sabretoothKellyCanHeal(s, "player")
  )
    return false;
  if (target === "hero") return s.player.hp < maxHP(s);
  if (target.startsWith("hero:")) {
    const view = seatView(s, target.slice(5));
    return view.player.hp < maxHP(view);
  }
  if (target === s.villain.id) return s.villain.hp < s.villain.maxHp;
  return (find(s, target)?.damage || 0) > 0;
}
function playerAttachmentTarget(s: GameState, source: Piece, target: string) {
  return (
    target !== sabretooth.sabretoothKelly(s)?.id ||
    sabretooth.sabretoothKellyCanAttach(s, card(source))
  );
}
/** Kelly's prohibitions are checked while the actual card is still in hand. */
function npcPlayerPlayRestriction(s: GameState, p: Piece): string | null {
  if (!sabretooth.sabretoothKelly(s)) return null;
  if (
    rulesCode(p) === "01086" &&
    !targets(s, "character").some((t) => playerHealingTarget(s, t.id))
  )
    return "There is no eligible character to heal. Robert Kelly cannot be healed by player card effects.";
  const script = cardScript(p);
  const selector =
    script?.implementation === "script"
      ? script.constraints.attachTo
      : rulesCode(p) === "01074"
        ? "ally"
        : undefined;
  if (
    selector &&
    !targets(s, selector === "controlled-ally" ? "ally" : selector).some(
      (t) =>
        playerAttachmentTarget(s, p, t.id) &&
        (selector !== "controlled-ally" ||
          controller(s, t.id)?.id === s.activePlayerId),
    )
  )
    return "There is no eligible attachment target. Robert Kelly cannot have player cards or upgrades attached.";
  return null;
}
interface DamageTraits {
  /** An attack can lack a damage instruction while retaining its aftermath. */
  noDamageInstance?: boolean;
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
  mutantGenesisBonusApplied?: boolean;
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
function recordMilesEnemyAttackDefeat(
  s: GameState,
  source: string,
  enemyAttack: boolean,
) {
  const after = s.attack?.activationAfter;
  if (enemyAttack && after?.milesAttackToken && source === s.attack?.attacker)
    seatView(s, after.actorId || s.activePlayerId).flags[
      `milesAttackDefeat:${after.milesAttackToken}`
    ] = true;
}
function recordZeroToleranceAllyDefeat(
  s: GameState,
  p: Piece,
  source: string,
  enemyAttack: boolean,
  controllerId?: string,
) {
  const attack = s.attack;
  if (
    enemyAttack &&
    attack?.attacker === source &&
    card(p).type_code === "ally" &&
    !p.treatedAsMinion
  ) {
    attack.magnetoAllyDefeated = true;
    add(
      s,
      ...(attack.magnetoAllyDefeatBoostIds || []).flatMap((sourceId) =>
        magneto.magnetoBoostAllyDefeated(s, {
          attackId: attack.id!,
          sourceId,
          allyId: p.id,
        }),
      ),
    );
  }
  if (
    !zeroToleranceNativePresent(s) ||
    !enemyAttack ||
    !attack ||
    attack.attacker !== source ||
    p.treatedAsMinion ||
    card(p).type_code !== "ally"
  )
    return;
  const receipts = ((s.zeroToleranceDefeats ||= {})[attack.id!] ||= []);
  if (!receipts.some((r) => r.id === p.id))
    receipts.push({
      id: p.id,
      code: p.code,
      ownerId: p.ownerId,
      controllerId: controllerId || controller(s, p.id)?.id,
      actualAlly: true,
    });
}
function zeroToleranceNativePresent(s: GameState) {
  return (
    s.villainId === "project_wideawake" ||
    (s.modules || [s.module]).includes("zero_tolerance") ||
    s.sideSchemes.some((p) => p.code === "32104")
  );
}
function damageProhibition(s: GameState, target: string, panther: boolean) {
  if (rogue.rogueProtected(s, target))
    return "Cybernetic Enhancements prevents damage.";
  const shadowKing = s.minions.find((p) => p.id === target);
  if (shadowKing && storm.stormProtected(s, shadowKing))
    return "The Shadow King is protected by a Controlled minion.";
  if (niPack.novaIronheartPackCannotTakeDamage(s, target, niPackPorts))
    return "This Champion cannot take damage this round.";
  if (msMarvelDamageImmune(s, target)) return "This enemy cannot take damage.";
  if (
    target === s.villain.id &&
    s.villainId === "ultron" &&
    s.villain.stage === 3 &&
    s.minions.some((p) => card(p).traits?.includes("Drone."))
  )
    return "Ultron is protected by his drones.";
  const identityId =
    target === "hero"
      ? s.activePlayerId
      : target.startsWith("hero:")
        ? target.slice(5)
        : undefined;
  if (
    identityId &&
    ((s.attack?.defender === "hero" &&
      (s.attack.targetPlayerId || s.activePlayerId) === identityId) ||
      mystiqueNativeOuterDefending(s, identityId)) &&
    shadowcat.shadowcatPreventsDamage(
      seatView(s, identityId),
      true,
      shadowcatPorts,
    )
  )
    return "Phased prevents damage while defending.";
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
  if (packet.noDamageInstance) return 0;
  const target = find(s, packet.target);
  if (!target || !packet.attack) return 0;
  const source = packet.source || "hero";
  let amount =
    Number(packet.amount || 0) +
    (packet.mutantGenesisBonusApplied
      ? 0
      : Number(s.flags[`niHoned:${s.currentEventId}`] || 0) +
        mgPack.mutantGenesisPlayerPackAttackEventBonus(
          s,
          s.currentEventId || "",
        ));
  if (
    !packet.mutantGenesisBonusApplied &&
    ["hero", `hero:${s.activePlayerId}`].includes(source)
  )
    amount += msMarvelEventAmountModifier(s, s.currentEventId, "damage");
  amount += psylocke.psylockeDamageBonus(s, source, target.id);
  if (
    !packet.mutantGenesisBonusApplied &&
    ["hero", `hero:${s.activePlayerId}`].includes(source)
  )
    amount += gambit.gambitDamageBonus(s);
  amount += cyclops.cyclopsAttackModifiers(s, target.id).damage;
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
  if (traits.noDamageInstance) n = 0;
  if (
    attack &&
    !traits.noDamageInstance &&
    !traits.mutantGenesisBonusApplied &&
    (source === "hero" || source === `hero:${s.activePlayerId}`) &&
    target !== "hero" &&
    !target.startsWith("hero:")
  )
    n +=
      msMarvelEventAmountModifier(s, s.currentEventId, "damage") +
      Number(s.flags[`niHoned:${s.currentEventId}`] || 0) +
      mgPack.mutantGenesisPlayerPackAttackEventBonus(s, s.currentEventId || "");
  if (attack && !traits.noDamageInstance)
    n += psylocke.psylockeDamageBonus(s, source, target);
  if (
    attack &&
    !traits.noDamageInstance &&
    !traits.mutantGenesisBonusApplied &&
    (source === "hero" || source === `hero:${s.activePlayerId}`) &&
    target !== "hero" &&
    !target.startsWith("hero:")
  )
    n += gambit.gambitDamageBonus(s);
  const original = find(s, target);
  const dealt = traits.noDamageInstance
    ? 0
    : Math.max(0, traits.damageDealt ?? n);
  // Exploit Weakness modifies damage TAKEN. Preserve the original dealt amount
  // for replacement effects such as Armored Rhino Suit and dealt-damage receipts.
  if (
    attack &&
    !traits.noDamageInstance &&
    (target === s.villain.id || s.minions.some((p) => p.id === target))
  )
    n += cyclops.cyclopsAttackModifiers(s, target).damage;

  const code = original?.code;
  const originalStage = target === s.villain.id ? s.villain.stage : undefined;
  const sourceIsIdentity = rocket.rocketIsIdentitySource(s, source);
  const wasHero = s.player.form === "hero";
  const cap =
    target === s.villain.id
      ? magneto.magnetoDamageCap(s, { isTextBlank })
      : undefined;
  if (cap !== undefined)
    n = Math.min(n, Math.max(0, cap - (s.villain.maxHp - s.villain.hp)));
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
  if (
    !replaced &&
    targetPiece &&
    attack &&
    (n > 0 || (cap !== undefined && dealt > 0)) &&
    (traits.piercing ?? !!sourceKeyword(s, source, "Piercing"))
  )
    colossusNativeDiscardTough(
      s,
      [{ targetId: target, amount: statusCards(targetPiece, "tough") }],
      [],
    );
  const previousQueue = new Set(s.queue);
  const taken =
    replaced ??
    applyDamage(s, target, n, source, attack, overkill, panther, traits);
  const result: DamageResult = {
    ...taken,
    damageDealt:
      taken.damageDealt ?? (traits.overkillDamage ? taken.actualDamage : dealt),
  };
  add(
    s,
    ...x23.x23Damaged(
      s,
      target,
      result.actualDamage,
      !!traits.enemyAttack,
      x23Ports,
    ),
  );
  if (s.currentEventId && attack)
    s.flags[`shadowcatDealt:${s.currentEventId}:${target}`] =
      result.damageDealt > 0 || (!replaced && dealt === 0);
  if (target === "hero" && !["won", "lost"].includes(s.phase)) {
    const responses = spiderHam.spiderHamAfterDamage(
      s,
      {
        token: `damage:${s.nextId++}`,
        playerId: s.activePlayerId,
        actualDamage: result.actualDamage,
      },
      spiderHamPorts,
    );
    add(s, ...responses);
  }
  if (original)
    add(
      s,
      ...ironspider.ironspiderSinisterDamageResponses(s, {
        piece: original,
        actualDamage: result.actualDamage,
        fromAttack: damageFromAttack,
      }),
    );
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
        actualDamage: result.actualDamage,
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
          storm.stormGlobal(s).retaliate +
          inheritors.inheritorsModifiers(s, original).retaliate +
          ironheart.ironheartEnemyKeywords(s, original, { isTextBlank })
            .retaliate +
          niPack.novaIronheartPackCharacterModifiers(
            s,
            original.id,
            niPackPorts,
          ).retaliate +
          wideawake.projectWideawakeModifiers(s, original, { isTextBlank })
            .retaliate +
          masterMold.masterMoldModifiers(s, original, {
            isTextBlank,
            hasTrait: captainPackHasTrait,
          }).retaliate +
          mansionAttack.mansionAttackModifiers(s, original, { isTextBlank })
            .retaliate +
          magneto.magnetoModifiers(s, original, { isTextBlank }).retaliate +
          x23.x23EnemyRetaliate(s) +
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
          inheritorRetaliate: inheritors.inheritorsModifiers(s, original)
            .retaliate,
          mansionRetaliate: mansionAttack.mansionAttackModifiers(s, original, {
            isTextBlank,
          }).retaliate,
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
  if (
    (target === s.villain.id || s.minions.some((p) => p.id === target)) &&
    (((source === "hero" ||
      source.startsWith("hero:") ||
      allInPlay(s).some((p) => p.id === source)) &&
      !cable.cableCanDamage(s, target)) ||
      cable.cableForcedDamage(s, target, n, cablePorts))
  )
    return none;
  const p = target === "hero" ? s.player : find(s, target);
  if (!p) return none;
  if (p.tough && !s.flags.ignoreToughPacket) {
    colossusNativeDiscardTough(
      s,
      [{ targetId: target, amount: 1 }],
      [],
      !!traits.enemyAttack,
    );
    log(s, "Tough prevents the damage.");
    return none;
  }
  const cableAlly = allInPlay(s).find((p) => p.id === target);
  if (
    cableAlly &&
    cable.cableDeadpool(s, cableAlly, n, source, pieceHP(s, cableAlly))
  )
    return none;
  if (target === "hero") {
    if (!traits.grootHandled) n -= groot.grootPreventDamage(s, "hero", n);
    if (n <= 0) return none;
    s.player.hp -= n;
    deadpool.deadpoolDamageTaken(s);
    if (s.player.hp <= 0 && traits.enemyAttack)
      s.flags.wolverineLethalAttack = true;
    if (s.player.hp <= 0)
      recordMilesEnemyAttackDefeat(s, source, !!traits.enemyAttack);
    track(s, "damageTaken", n);
    log(s, `You take ${n} damage.`, "bad");
    check(s);
    return { actualDamage: n, excessDamage: 0 };
  }
  if (target === s.villain.id) {
    const magnetic = magneto.magnetoReplaceDamage(s, target, n, magnetoPorts);
    if (magnetic !== undefined) return none;
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
      advanceVillain(s, source, attack);
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
  if (card(m).type_code === "ally")
    (s.spiderHamConsequentialReceipts ||= {})[m.id] = {
      token: `consequential:${s.nextId++}`,
      playerId: controller(s, m.id)?.id || s.activePlayerId,
      consequential: source === "consequential",
      amount: n,
      remainingHP: remain,
      textBlank: isTextBlank(s, m),
    };
  m.damage += n;
  track(
    s,
    s.minions.some((x) => x.id === m.id) ? "damageDealt" : "damageTaken",
    n,
  );
  log(s, `${card(m).name} takes ${n} damage.`, "good");
  if (m.damage >= pieceHP(s, m)) {
    s.flags[`ironspiderExcess:${m.id}`] = result.excessDamage;
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
    ...(enemyAttack &&
    card(m).type_code === "ally" &&
    !(["32088b", "32172b"].includes(m.code) && !isTextBlank(s, m))
      ? draxPack.draxPackRegroupOptions(
          s,
          m,
          { attack: true, enemySource: true },
          [
            E("dvRegroupDefeatAfter", {
              piece: { ...m },
              enemySource: source,
              enemyAttackId: s.attack?.id,
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
  valkyrieReceipts?: valkyrie.ValkyrieDefeatReceipt[],
) {
  if (wolverine.wolverineCannotDefeat(s, m)) return false;
  if (m.pendingDefeat && !interrupted) return true;
  const hamReceipt = s.spiderHamConsequentialReceipts?.[m.id];
  if (hamReceipt) {
    const effects = spiderHamPack.spiderHamPackAllyDefeated(s, m, hamReceipt);
    if (effects.length) {
      m.pendingDefeat = true;
      add(s, ...effects);
      return true;
    }
  }

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
    (a) =>
      rulesCode(a) === "01185" && a.attachedTo === m.id && !isTextBlank(s, a),
  );
  if (bio) {
    m.damage = 0;
    discardPiece(s, bio.id);
    log(s, "Biomechanical Upgrades restores the minion.");
    return false;
  }
  if (
    !s.flags[`cyclopsPriority:${m.id}`] &&
    s.minions.some((p) => p.id === m.id)
  ) {
    const winner = source.startsWith("hero:")
      ? source.slice(5)
      : controller(s, source)?.id || s.activePlayerId;
    const effects = cyclops.cyclopsPriorityTarget(s, m.id, winner);
    if (effects.length) {
      s.flags[`cyclopsPriority:${m.id}`] = true;
      m.pendingDefeat = true;
      add(
        s,
        ...effects,
        E("finishDefeat", {
          id: m.id,
          source,
          attack,
          enemyAttack,
          valkyrieReceipts,
        }),
      );
      return true;
    }
  }
  const minion = s.minions.some((x) => x.id === m.id);
  if (minion && !s.flags[`mutantGenesisGatekeeperHandled:${m.id}`]) {
    const token = `mutant-defeat:${s.nextId++}`;
    const exists = playerOrder(s).some(
      (seat) =>
        mgPack.mutantGenesisPlayerPackMinionDefeatOptions(
          seatView(s, seat),
          m.id,
          token,
          [],
          { isTextBlank },
        ).length > 0,
    );
    if (exists) {
      m.pendingDefeat = true;
      add(
        s,
        E("mutant-genesis-player:gatekeeper-window", {
          minionId: m.id,
          token,
          originalActorId: s.activePlayerId,
          after: [
            E("finishDefeat", {
              id: m.id,
              source,
              attack,
              enemyAttack,
              valkyrieReceipts,
            }),
          ],
        }),
      );
      return true;
    }
  }
  const receipts =
    valkyrieReceipts ??
    (minion
      ? valkyrie.valkyrieDefeatReceipt(s, m.id, {
          identityId: nativeIdentityDamageSource(s, source),
          attack,
        })
      : []);
  if (receipts.length && valkyrieReceipts === undefined) {
    m.pendingDefeat = true;
    add(
      s,
      ...receipts.flatMap((r) => valkyrie.valkyrieEnemyDefeatInterrupt(s, r)),
      E("finishDefeat", {
        id: m.id,
        source,
        attack,
        enemyAttack,
        valkyrieReceipts: receipts,
      }),
    );
    return true;
  }
  if (minion && !s.flags[`acolytesDefeat:${m.id}`]) {
    const actor = source.startsWith("hero:")
      ? source.slice(5)
      : controller(s, source)?.id || s.activePlayerId;
    const effects = acolytes.acolytesDefeated(s, m, actor, [
      E("finishDefeat", {
        id: m.id,
        source,
        attack,
        enemyAttack,
        valkyrieReceipts: receipts,
      }),
    ]);
    if (effects) {
      m.pendingDefeat = true;
      s.flags[`acolytesDefeat:${m.id}`] = true;
      add(s, ...effects);
      return true;
    }
  }
  if (minion && !s.flags[`magnetoDefeat:${m.id}`]) {
    const effects = magneto.magnetoMinionDefeated(s, m, s.activePlayerId, {
      isTextBlank,
    });
    if (effects?.length) {
      m.pendingDefeat = true;
      s.flags[`magnetoDefeat:${m.id}`] = true;
      add(
        s,
        ...effects,
        E("finishDefeat", {
          id: m.id,
          source,
          attack,
          enemyAttack,
          valkyrieReceipts: receipts,
        }),
      );
      return true;
    }
  }
  if (
    minion &&
    m.code === "43029" &&
    !isTextBlank(s, m) &&
    !s.flags[`x23Deathstrike:${m.id}`]
  ) {
    s.flags[`x23Deathstrike:${m.id}`] = true;
    m.pendingDefeat = true;
    add(
      s,
      ...x23.x23Defeated(s, m),
      E("finishDefeat", {
        id: m.id,
        source,
        attack,
        enemyAttack,
        valkyrieReceipts: receipts,
      }),
    );
    return true;
  }
  if (gambit.gambitShield(s, m, { discard: discardPiece })) return false;
  const tracers = allInPlay(s).filter(
    (a) =>
      rulesCode(a) === "01007" && a.attachedTo === m.id && !isTextBlank(s, a),
  );
  const name = card(m).name;
  const textWasBlank = isTextBlank(s, m);
  const defeatedSentinel = minion && captainPackHasTrait(s, m.id, "Sentinel");
  const allyController = controller(s, m.id)?.id;
  const sabretoothDefeat = (m as SabretoothAttackDefeatPiece)
    .sabretoothAttackDefeatReceipt;
  if (!minion) recordMilesEnemyAttackDefeat(s, source, enemyAttack);
  if (!minion)
    recordZeroToleranceAllyDefeat(s, m, source, enemyAttack, allyController);
  if (!minion && ["32088b", "32172b"].includes(m.code) && !textWasBlank)
    movePieceFromPlay(s, m.id, false, undefined, true);
  else discardPiece(s, m.id);
  if (!textWasBlank)
    add(s, ...deadpool.deadpoolDefeated(s, m, source, allyController));
  if (!minion) add(s, ...rogue.rogueAllyDefeated(s, m, source, allyController));
  if (!minion && enemyAttack && sabretoothDefeat?.attackerId === source) {
    delete (m as SabretoothAttackDefeatPiece).sabretoothAttackDefeatReceipt;
    add(
      s,
      ...sabretoothDefeat.sourceIds.flatMap((sourceId) =>
        sabretooth
          .sabretoothBoostAllyDefeated(s, {
            attackId: sabretoothDefeat.attackId,
            sourceId,
            allyId: m.id,
          })
          .map((effect) => ({ ...effect, actorId: sabretoothDefeat.playerId })),
      ),
    );
  }
  if (!minion && allyController)
    add(
      s,
      E("bwAllyDefeated", {
        piece: m,
        playerId: allyController,
        actorId: allyController,
      }),
    );
  delete s.flags[`x23Deathstrike:${m.id}`];
  delete s.flags[`acolytesDefeat:${m.id}`];
  delete s.flags[`magnetoDefeat:${m.id}`];
  log(s, `${name} is defeated.`, "good");
  if (minion) {
    if (
      attack &&
      source &&
      find(s, source)?.code === "32172b" &&
      defeatedSentinel
    )
      s.flags[`masterMoldMinionDefeat:${source}`] = true;
    if (attack && source && find(s, source)?.code === "32091")
      s.flags[`wideawakeMinionDefeat:${source}`] = true;
    const excess = Number(s.flags[`ironspiderExcess:${m.id}`] || 0);
    delete s.flags[`ironspiderExcess:${m.id}`];
    if (!textWasBlank)
      add(s, ...ironspider.ironspiderSinisterDefeatResponses(s, m, excess));
    niNativeAchievement(s, source, "enemy-defeat", m.id);
    if (rulesCode(m) !== "01182" && !textWasBlank)
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
      ...valkPack.valkyriePackMinionDefeated(
        s,
        identitySource,
        s.activePlayerId,
        valkyriePackPorts,
      ),
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
    if (rulesCode(m) === "01143" && !textWasBlank)
      add(
        s,
        E("drone", {
          actorId: m.engagedWith || s.activePlayerId,
          mandatory: true,
        }),
      );
    if (rulesCode(m) === "01182" && !textWasBlank)
      dealEncounter(s, m.engagedWith);
    const tigra = find(s, source);
    if (tigra && rulesCode(tigra) === "01051")
      tigra.damage = Math.max(0, tigra.damage - 1);
  }
  add(s, ...receipts.flatMap((r) => valkyrie.valkyrieEnemyDefeated(s, r)));
  return true;
}
function advanceVillain(
  s: GameState,
  source = "",
  attack = false,
  captured?: valkyrie.ValkyrieDefeatReceipt[],
) {
  const priorityKey = `cyclopsPriority:${s.villain.id}:${s.villain.stage}`;
  if (!s.flags[priorityKey]) {
    const winner = source.startsWith("hero:")
      ? source.slice(5)
      : controller(s, source)?.id || s.activePlayerId;
    const effects = cyclops.cyclopsPriorityTarget(s, s.villain.id, winner);
    if (effects.length) {
      s.flags[priorityKey] = true;
      add(
        s,
        ...effects,
        E("cyclops-native:advance", { source, attack, captured }),
      );
      return;
    }
  }
  const receipts =
    captured ??
    valkyrie.valkyrieDefeatReceipt(s, s.villain.id, {
      identityId: nativeIdentityDamageSource(s, source),
      attack,
    });
  if (receipts.length && captured === undefined) {
    add(
      s,
      ...receipts.flatMap((r) => valkyrie.valkyrieEnemyDefeatInterrupt(s, r)),
      E("valkyrieAdvanceVillain", { source, attack, receipts }),
    );
    return;
  }
  add(s, ...receipts.flatMap((r) => valkyrie.valkyrieEnemyDefeated(s, r)));
  niNativeAchievement(
    s,
    source,
    "enemy-defeat",
    `${s.villain.id}:${s.villain.stage}`,
  );
  if (s.villainId === "mansion_attack") {
    if (s.villain.pendingDefeat || s.mansionAttack?.activeVillainRetired)
      return;
    s.villain.pendingDefeat = true;
    const defeated = s.villain;
    mansionAttackEndDepartedActivation(s, defeated.id);
    add(
      s,
      ...mansionAttack.mansionAttackVillainDefeated(
        s,
        {
          token: `mansion-defeat:${defeated.id}`,
          piece: defeated,
        },
        { isTextBlank },
      ),
    );
    return;
  }
  if (s.villainId === "magneto") {
    const next = s.magneto?.villainDeck?.shift();
    if (!next) {
      endGame(s, true, "Magneto is defeated. Asteroid M is safe.");
      return;
    }
    const old = s.villain;
    Object.assign(next, {
      hp: card(next).health! * s.playerCount,
      maxHp: card(next).health! * s.playerCount,
      stage: old.stage + 1,
      stunned: old.stunned,
      confused: old.confused,
      tough: old.tough,
      stunCards: old.stunCards,
      confuseCards: old.confuseCards,
      toughCards: old.toughCards,
    });
    s.villain = next as GameState["villain"];
    if (s.attack?.attacker === old.id) s.attack.attacker = next.id;
    if (s.scheming?.attacker === old.id) s.scheming.attacker = next.id;
    for (const p of [...s.attachments, ...allInPlay(s)])
      if (p.attachedTo === old.id) p.attachedTo = next.id;
    s.removed.push(resetPiece(old));
    if (keyword(s.villain, "Toughness", s))
      giveCharacterStatus(s, s.villain, "tough");
    syncNebulaIdentityStatuses(s);
    villainSetup(s);
    return;
  }
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
  wideawake.projectWideawakeEnemyLeftPlay(s, s.villain.id);
  s.villain.stage++;
  s.villain.code =
    riskyNextVillainFace(s, config.codes[s.villain.stage - 1]) ||
    config.codes[s.villain.stage - 1];
  s.villain.maxHp =
    card(s.villain).health! * s.playerCount +
    wideawake.projectWideawakeModifiers(s, s.villain, { isTextBlank }).health +
    wasp.waspEnemyHP(s, s.villain) +
    s.sideSchemes.filter((p) => rulesCode(p) === "01127" && !isTextBlank(s, p))
      .length *
      10;
  for (const p of s.sideSchemes.filter(
    (piece) => rulesCode(piece) === "01127",
  ) as ImmortalKlawScheme[])
    p.immortalKlawHealthActive = !isTextBlank(s, p);
  for (const p of s.attachments.filter(
    (piece) => piece.code === "13029" && piece.attachedTo === s.villain.id,
  ) as BeetleArmorAttachment[])
    p.beetleArmorHealthActive = !isTextBlank(s, p);
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
  add(s, ...(magneto.magnetoReveal(s, s.villain, { isTextBlank }) || []));
  add(
    s,
    ...(wideawake.projectWideawakeReveal(s, s.villain, { isTextBlank }) || []),
  );
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
    if (s.villainId === "project_wideawake")
      add(
        s,
        ...wideawake.projectWideawakeAfterMainThreatPlaced(
          s,
          {
            token: `main-threat:${s.nextId++}`,
            schemeCode: s.scheme.code,
            actualAmount: n,
            threatAfter: s.scheme.threat,
          },
          { isTextBlank },
        ),
      );
    if (schemeLimit(s) > 0 && s.scheme.threat >= schemeLimit(s)) {
      if (s.villainId === "mansion_attack") {
        if (!s.pendingMainCompletion) {
          s.pendingMainCompletion = true;
          add(
            s,
            ...mansionAttack.mansionAttackMainCompleted(
              s,
              {
                token: `mansion-main:${s.mansionAttack?.currentMain?.id}`,
                schemeCode: s.scheme.code,
              },
              { isTextBlank },
            ),
            E("clearMainCompletion"),
          );
        }
        return;
      }
      if (s.villainId === "magneto") {
        if (s.pendingMainCompletion) return;
        const next = s.magneto?.mainDeck?.shift();
        if (!next) {
          endGame(s, false, "Rule of Magnus is complete. The players lose.");
          return;
        }
        s.pendingMainCompletion = true;
        discardMainAttachments(s);
        if (s.magneto?.currentMain)
          s.removed.push(resetPiece(s.magneto.currentMain));
        s.magneto!.currentMain = next;
        s.magneto!.magnetCounters = 0;
        s.scheme.index++;
        s.scheme.code = next.code;
        s.scheme.threat = 0;
        magneto.magnetoMainChanged(s, s.scheme.code);
        add(
          s,
          ...magneto.magnetoMainRevealed(s, next.code),
          E("magneto-native:main-back", { actorId: s.firstPlayerId }),
        );
        return;
      }
      if (s.villainId === "master_mold") {
        if (s.scheme.code === "32113b") {
          endGame(
            s,
            false,
            "Master Mold's Agenda is complete. The players lose.",
          );
        } else if (!s.pendingMainCompletion) {
          s.pendingMainCompletion = true;
          discardMainAttachments(s);
          s.scheme.index = 1;
          s.scheme.code = "32113a";
          s.scheme.threat = 0;
          add(
            s,
            ...masterMold.masterMoldMainRevealed(s, "32113a"),
            E("mastermold-native:main-back", { actorId: s.firstPlayerId }),
            E("clearMainCompletion"),
          );
        }
        return;
      }
      const mutagen =
        sabretooth.sabretoothMainCompleted(s) ??
        riskyMainCompleted(s) ??
        mutagenMainCompleted(s);
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
      phoenix.phoenixThreatPlaced(s, p, phoenixPorts);
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
  if (!cable.cableCanRemoveThreat(s, target, source)) return 0;
  if (n > 0 && !s.flags.additionalThwartPacket) {
    n += phoenix.phoenixThwartBonus(s);
  }
  if (n > 0 && !s.flags.additionalThwartPacket)
    n += msMarvelEventAmountModifier(s, s.currentEventId, "thwart");
  if (
    (s.sideSchemes.find((p) => p.id === target) &&
      ironspider.ironspiderSinisterThwartBlocked(
        s,
        s.sideSchemes.find((p) => p.id === target)!,
        ironspiderPorts,
      )) ||
    hulkThreatLocked(s, target) ||
    !gamora.gamoraCanRemoveThreat(s, target) ||
    venom.venomSchemeLocked(s, target) ||
    warlock.warlockSchemeLocked(s, target)
  )
    return 0;
  if (target === "main") {
    if (
      (!ignoreCrisis &&
        !nebula.nebulaIgnoresRestrictions(s).crisis &&
        (deadpool.deadpoolPlayerIcons(s, "scheme_crisis") > 0 ||
          s.sideSchemes.some((p) => card(p).scheme_crisis))) ||
      rulesCode(s.scheme) === "01139b"
    ) {
      log(s, "Threat cannot be removed from the main scheme.");
      return 0;
    }
    const removed = Math.min(n, s.scheme.threat);
    s.scheme.threat -= removed;
    track(s, "threatRemoved", removed);
    log(s, `Remove ${removed} threat from the main scheme.`, "good");
    if (removed > 0 && s.scheme.threat === 0)
      niNativeAchievement(s, source, "last-threat", `main:${s.scheme.code}`);
    return removed;
  } else {
    const p = s.sideSchemes.find((p) => p.id === target);
    if (!p) return 0;
    const removed = Math.min(n, p.counters);
    p.counters = Math.max(0, p.counters - n);
    track(s, "threatRemoved", removed);
    log(s, `Remove ${removed} threat from ${card(p).name}.`, "good");
    if (removed > 0 && !p.counters)
      niNativeAchievement(s, source, "last-threat", p.id);
    if (
      !p.counters &&
      !isPermanent(card(p)) &&
      !zeroTolerance.zeroToleranceIsPermanent(s, p)
    ) {
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
function defeatScheme(
  s: GameState,
  p: Piece,
  source = "hero",
  playerSchemeRewardHandled = false,
) {
  if (
    p.pendingDefeat &&
    ["32144a", "32144b", "32145a", "32158"].includes(p.code)
  )
    return;
  if (p.counters || !s.sideSchemes.some((x) => x.id === p.id)) return;
  if (isPermanent(card(p)) || zeroTolerance.zeroToleranceIsPermanent(s, p))
    return;
  if (isPlayerSideScheme(p) && !playerSchemeRewardHandled) {
    add(s, ...beginPlayerSideSchemeDefeat(s, p, source));
    return;
  }
  if (!s.flags[`deadpoolAmbush:${p.id}`]) {
    const ambush = deadpool.deadpoolSchemeDefeating(s, p);
    if (ambush.length) {
      s.flags[`deadpoolAmbush:${p.id}`] = true;
      add(s, ...ambush, E("defeatScheme", { id: p.id, source }));
      return;
    }
  }
  log(s, `${card(p).name} is defeated.`, "good");
  if (rulesCode(p) === "01166" && p.captured && !isTextBlank(s, p))
    for (const x of p.captured.splice(0)) {
      const owner = s.players.find((a) => a.id === x.ownerId);
      if (owner && !owner.eliminated) seatView(s, owner).player.hand.push(x);
      else s.removed.push(x);
    }
  doctorStrangeSchemeDefeated(s, p, dsPorts);
  add(s, ...hawkeyeSchemeDefeated(s, p), ...spiderWomanSchemeDefeated(s, p));
  add(
    s,
    ...wasp.waspDefeated(s, "side_scheme", source, s.currentEventId, false),
  );
  if (!isTextBlank(s, p)) add(s, ...cyclops.cyclopsSideSchemeDefeated(s, p));
  add(s, ...spectrum.spectrumSideSchemeDefeated(s, p, spectrumPorts));
  add(s, ...storm.stormSideDefeated(s, p));
  if (!isTextBlank(s, p)) add(s, ...gambit.gambitSchemeDefeated(s, p));
  add(s, ...rogue.rogueSchemeDefeated(s, p));
  add(s, ...warMachine.warMachineSchemeDefeated(s, p));
  add(
    s,
    ...shadowcat.shadowcatSideSchemeDefeated(
      s,
      p,
      s.activePlayerId,
      shadowcatPorts,
    ),
  );
  const nativeDefeat = sabretooth.sabretoothSideSchemeDefeated(
    s,
    p,
    s.activePlayerId,
  );
  const mystiqueDefeat = mystique.mystiqueSideSchemeDefeated(
    s,
    p,
    s.activePlayerId,
  );
  const wideawakeDefeat = wideawake.projectWideawakeSideSchemeDefeated(
    s,
    p,
    s.activePlayerId,
    { isTextBlank },
  );
  const moldDefeat = masterMold.masterMoldSideSchemeDefeated(
    s,
    p,
    s.activePlayerId,
    { isTextBlank },
  );
  const magneticDefeat = magneto.magnetoSideSchemeDefeated(
    s,
    p,
    s.activePlayerId,
    { isTextBlank },
  );
  if (
    magneticDefeat?.length &&
    ["32144a", "32144b", "32145a", "32158"].includes(p.code)
  )
    p.pendingDefeat = true;
  const mansionDefeat = mansionAttack.mansionAttackSideSchemeDefeated(
    s,
    p,
    s.activePlayerId,
    { isTextBlank },
  );
  const victory =
    (["32071", "32100", "32120"].includes(p.code) ||
      (isPlayerSideScheme(p) && playerSideSchemeHasVictory(p))) &&
    !isTextBlank(s, p);
  const retainFind =
    ["32065a", "32088a", "32144a", "32144b", "32145a", "32158"].includes(
      p.code,
    ) && !isTextBlank(s, p);
  if (!victory && !retainFind) discardPiece(s, p.id);
  const responses = [
    ...(magneticDefeat?.length
      ? [
          {
            id: `${p.id}:magneto-defeated`,
            title: card(p).name,
            effects: magneticDefeat,
          },
        ]
      : []),
    ...(mansionDefeat?.length
      ? [
          {
            id: `${p.id}:mansion-defeated`,
            title: card(p).name,
            effects: mansionDefeat,
          },
        ]
      : []),
    ...(moldDefeat?.length
      ? [
          {
            id: `${p.id}:mastermold-defeated`,
            title: card(p).name,
            effects: moldDefeat,
          },
        ]
      : []),
    ...(wideawakeDefeat?.length
      ? [
          {
            id: `${p.id}:wideawake-defeated`,
            title: card(p).name,
            effects: wideawakeDefeat,
          },
        ]
      : []),
    ...(nativeDefeat?.length
      ? [{ id: `${p.id}:defeated`, title: card(p).name, effects: nativeDefeat }]
      : []),
    ...(mystiqueDefeat.length
      ? [
          {
            id: `${p.id}:mystique-defeated`,
            title: card(p).name,
            effects: mystiqueDefeat,
          },
        ]
      : []),
    ...(victory
      ? [
          {
            id: `${p.id}:victory`,
            title: isPlayerSideScheme(p)
              ? "Victory 0"
              : p.code === "32100"
                ? "Victory 2"
                : "Victory 1",
            effects: [E("encounterVictory", { id: p.id })],
          },
        ]
      : []),
  ];
  add(
    s,
    ...(responses.length
      ? [E("forcedResponses", { responses, actorId: s.firstPlayerId })]
      : []),
    ...cable.cableSideDefeated(s, p, source),
  );
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
        ...(!attack ||
        nebula.nebulaIgnoresRestrictions(s).guard ||
        psylocke.psylockeIgnoresGuardPatrol(s) ||
        shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts) ||
        !engaged(s).some((p) => keyword(p, "Guard", s))
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
      ].filter(
        (t) =>
          cable.cableCanDamage(s, t.id) &&
          (!attack ||
            (valkyrie.valkyrieCanAttackTarget(s, t.id) &&
              (t.id !== s.villain.id ||
                !mystique.mystiqueVillainAttackProhibited(s, mystiquePorts)))),
      );
    case "minion":
      return s.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      }));
    case "scheme":
      return [
        ...((!(
          deadpool.deadpoolPlayerIcons(s, "scheme_crisis") > 0 ||
          s.sideSchemes.some((p) => card(p).scheme_crisis)
        ) ||
          nebula.nebulaIgnoresRestrictions(s).crisis ||
          shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts)) &&
        !(
          thwarting &&
          !nebula.nebulaIgnoresRestrictions(s).patrol &&
          !psylocke.psylockeIgnoresGuardPatrol(s) &&
          !shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts) &&
          engaged(s).some((p) => keyword(p, "Patrol", s))
        ) &&
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
              !ironspider.ironspiderSinisterThwartBlocked(
                s,
                p,
                ironspiderPorts,
              ) &&
              (!thwarting ||
                p.code !== "31026" ||
                isTextBlank(s, p) ||
                s.flags.spdrGiantThwartCostPaid ||
                canPay(s, 1, ["energy"])) &&
              !hulkThreatLocked(s, p.id) &&
              gamora.gamoraCanRemoveThreat(s, p.id) &&
              !venom.venomSchemeLocked(s, p.id) &&
              !warlock.warlockSchemeLocked(s, p.id) &&
              (!thwarting ||
                sentinels.sentinelsCanThwart(
                  s,
                  p.id,
                  s.activePlayerId,
                  sentinelsPorts,
                )),
          )
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
      ];
    case "ally":
      return [
        ...allInPlay(s),
        ...playerOrder(s).flatMap((seat) => controlledNPCs(s, seat.id)),
      ]
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
          controller(s, entry.id)?.id === s.activePlayerId,
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
        return id === sabretooth.sabretoothKelly(s)?.id &&
          !sabretooth.sabretoothKellyCanHeal(s, "player")
          ? false
          : id?.startsWith("hero")
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
        return giveStatus(
          { ...target },
          definition,
          node.status,
          id?.startsWith("hero")
            ? {
                toughLimit: colossus.colossusToughLimit(
                  id === "hero" ? s : seatView(s, id.slice(5)),
                  colossusPorts,
                ),
                stalwart: !!sourceKeyword(
                  id === "hero" ? s : seatView(s, id.slice(5)),
                  "hero",
                  "Stalwart",
                ),
                steady: spdrPack.spdrPackCharacterSteady(
                  id === "hero" ? s : seatView(s, id.slice(5)),
                  "hero",
                  { isTextBlank },
                ),
              }
            : nativeStatusModifiers(s, target),
        );
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
      ironheart.ironheartCostReduction(
        s,
        physical || ({ code: c.code } as Piece),
      ) -
      (c.code === "34021" &&
      (sinisterNativeHasTrait(s, "hero", "Mutant") ||
        sinisterNativeHasTrait(s, "hero", "X-Men"))
        ? 1
        : 0) -
      wolverine.wolverineCostReduction(s, physical || c, wolverinePorts) -
      cable.cableDiscount(s, physical || c, cablePorts) -
      deadpool.deadpoolDiscount(s, physical || c) -
      angel.angelDiscount(s, physical || c) -
      storm.stormDiscount(
        s,
        physical || ({ code: c.code } as Piece),
        stormPorts,
      ) -
      gambit.gambitDiscount(s, c) -
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
      (physical
        ? sinisterPlayerPack.sinisterPlayerPackCostReduction(
            s,
            physical,
            sinisterPlayerPackPorts,
          )
        : 0) -
      spiderHamPack.spiderHamPackCostReduction(
        s,
        physical || ({ code: c.code } as Piece),
        spiderHamPackPorts,
      ) -
      (c.code === "33019" &&
      (captainPackHasTrait(s, "hero", "Mutant") ||
        captainPackHasTrait(s, "hero", "X-Men"))
        ? 1
        : 0) -
      mgPack.mutantGenesisPlayerPackCostReduction(
        s,
        physical || ({ code: c.code } as Piece),
        mutantGenesisPackPorts,
      ) -
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
  if (
    trait.toLowerCase() === "x-force" &&
    angel.angelRecruitBonus(s, target) > 0
  )
    return true;
  if (
    trait.toLowerCase() === "x-men" &&
    cyclops.cyclopsCharacterModifiers(s, target).xmen
  )
    return true;
  if (captainPrintedHasTrait(s, target, trait)) return true;
  if (
    spiderHamPack
      .spiderHamPackCharacterTraits(s, target, spiderHamPackPorts)
      .some((value) => value.toLowerCase() === trait.toLowerCase())
  )
    return true;
  const enemy = s.minions.find((p) => p.id === target);
  if (
    enemy &&
    spiderHam
      .spiderHamEnemyTraits(s, enemy)
      .some((value) => value.toLowerCase() === trait.toLowerCase())
  )
    return true;
  if (
    enemy &&
    ghostSpider
      .ghostSpiderEnemyModifiers(s, enemy)
      .traits.some((t) => t.toLowerCase() === trait.toLowerCase())
  )
    return true;
  if (
    trait.toLowerCase() === "guardian" &&
    nebulaPack.nebulaPackModifiers(s, target, nebulaPackPorts).guardian
  )
    return true;
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
      rogue
        .rogueTraits(view, rogueNativeTraits)
        .some((t) => t.toLowerCase() === trait.toLowerCase()) ||
      spiderHam
        .spiderHamTraits(view)
        .some((value) => value.toLowerCase() === trait.toLowerCase()) ||
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
    ((trait.toLowerCase() === "aerial" &&
      p.code === "29023" &&
      p.counters === 2 &&
      !isTextBlank(s, p)) ||
      starLord
        .starLordAllyTraits(seatView(s, seat), p)
        .some((t) => t.toLowerCase() === trait.toLowerCase()))
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
  const list = (
    character && source !== "hero" && e.action.type === "allyAction"
      ? niAllyTargets(s, character as Piece, e.action.kind)
      : targets(s, e.group, !!e.action.attack, !!e.action.action)
  ).filter(
    (t) =>
      (!e.exclude || t.id !== e.exclude) &&
      (!e.scriptSelector?.controller ||
        controller(s, t.id)?.id === s.activePlayerId) &&
      (e.action.type !== "heal" ||
        !sabretooth.sabretoothKelly(s) ||
        playerHealingTarget(s, t.id)) &&
      (e.action.type !== "attachPlayer" ||
        !find(s, e.action.id) ||
        playerAttachmentTarget(s, find(s, e.action.id)!, t.id)) &&
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
function shadowcatNativeIgnoreReceipts(
  s: GameState,
  kind: "attack" | "thwart",
  target: string,
  source = "hero",
): shadowcat.ShadowcatIgnoreReceipt[] {
  if (
    source !== "hero" ||
    !shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts)
  )
    return [];
  const receipts: shadowcat.ShadowcatIgnoreReceipt[] = [];
  const capture = (
    keywordKind: shadowcat.ShadowcatIgnoreReceipt["kind"],
    sourceIds: string[],
  ) => {
    if (sourceIds.length)
      receipts.push({
        token: `ignore:${s.nextId++}`,
        playerId: s.activePlayerId,
        kind: keywordKind,
        sourceIds,
        performed: true,
      });
  };
  if (kind === "attack" && target === s.villain.id)
    capture(
      "guard",
      engaged(s)
        .filter((p) => keyword(p, "Guard", s))
        .map((p) => p.id),
    );
  if (kind === "thwart" && target === "main") {
    capture(
      "patrol",
      engaged(s)
        .filter((p) => keyword(p, "Patrol", s))
        .map((p) => p.id),
    );
    capture(
      "crisis",
      s.sideSchemes.filter((p) => card(p).scheme_crisis).map((p) => p.id),
    );
  }
  return receipts;
}
function shadowcatNativeIgnoreWindow(
  s: GameState,
  e: Effect,
  kind: "attack" | "thwart",
): boolean {
  if (
    e.shadowcatIgnoreHandled ||
    (e.source || "hero") !== "hero" ||
    !shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts)
  )
    return false;
  if (
    kind === "attack" &&
    (!shadowcat.shadowcatCanAttack(s) ||
      (!e.attackInitiated && s.player.stunned) ||
      !targets(s, "enemy", true).some((t) => t.id === e.target))
  )
    return false;
  if (
    kind === "thwart" &&
    ((!e.thwartStatusChecked && s.player.confused) ||
      captainThwartBlocked(s) ||
      !targets(s, "scheme", false, true).some((t) => t.id === e.target))
  )
    return false;
  const receipts = shadowcatNativeIgnoreReceipts(
    s,
    kind,
    e.target,
    e.source || "hero",
  );
  if (
    !receipts.some(
      (r) =>
        shadowcat.shadowcatIgnoredKeywordOptions(s, r, [], shadowcatPorts)
          .length,
    )
  )
    return false;
  const continuation: Effect = { ...e, shadowcatIgnoreHandled: true };
  if (kind === "attack") continuation.attackInitiated = true;
  else {
    continuation.thwartInitiated = true;
    continuation.thwartStatusChecked = true;
    continuation.ignoreCrisis = true;
    continuation.ignorePatrol = true;
  }
  add(s, E("shadowcat:ignored-window", { receipts, after: [continuation] }));
  return true;
}
function attackAction(
  s: GameState,
  target: string,
  n: number,
  source = "hero",
  overkill = false,
  panther = false,
  traits: {
    noDamageInstance?: boolean;
    basic?: boolean;
    piercing?: boolean;
    ranged?: boolean;
    initiated?: boolean;
    excessToMain?: boolean;
    excessBonus?: number;
    aftermathChooser?: string;
    mutantGenesisBonusApplied?: boolean;
  } = {},
) {
  overkill ||= cyclops.cyclopsAttackModifiers(s, target).overkill;
  const p = source === "hero" ? s.player : find(s, source);
  if (!p) return;
  if (
    traits.basic ||
    (source !== "hero" && card(p as Piece)?.type_code === "ally")
  )
    n += wolverine.wolverineBasicBonus(s, source, target);
  if (source === "hero" && traits.basic && psylocke.psylockeStats(s).piercing)
    traits.piercing = true;
  if (
    (source === "hero" || source === `hero:${s.activePlayerId}`) &&
    rogue.rogueModifiers(s).overkill
  )
    overkill = true;
  if (source === "hero" && traits.basic && wolverine.wolverineStats(s).piercing)
    traits.piercing = true;
  if (
    source === "hero" &&
    s.currentEventId &&
    s.flags[`wolverineClaws:${s.currentEventId}`]
  ) {
    const key = `wolverineClawsAttack:${s.currentEventId}`;
    const token = s.currentAttackProgramId || s.currentEventId;
    s.flags[key] ||= token;
    if (s.flags[key] === token) traits.piercing = true;
  }
  if (
    !traits.initiated &&
    target === s.villain.id &&
    mystique.mystiqueVillainAttackProhibited(s, mystiquePorts)
  )
    return;
  if (
    source === "hero" &&
    (magneto.magnetoIdentityRestricted(s, s.activePlayerId, { isTextBlank }) ||
      !valkyrie.valkyrieCanAttackTarget(s, target) ||
      !vision.visionCanAttack(s) ||
      !shadowcat.shadowcatCanAttack(s) ||
      !cyclops.cyclopsCanAttack(s))
  )
    return;
  if (p.stunned && !traits.initiated) {
    consumeStatus(p, "stunned");
    if (source === "hero") s.flags.basicAttack = false;
    log(s, "Stunned is removed instead of attacking.");
    return;
  }
  if (
    !traits.initiated &&
    !(
      source !== "hero"
        ? niAllyTargets(s, p as Piece, "attack")
        : targets(s, "enemy", true)
    ).some((t) => t.id === target)
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
  if (source === "hero" && s.currentEventId && result)
    s.flags[`shadowcatAttackPerformed:${s.currentEventId}`] = true;
  if (
    source === "hero" &&
    result &&
    !s.currentEventId &&
    !traits.basic &&
    s.currentAttackProgramId
  )
    s.flags[`shadowcatProgramPerformed:${s.currentAttackProgramId}`] = true;
  if (
    source === "hero" &&
    result &&
    !s.currentEventId &&
    !s.currentAttackProgramId &&
    !traits.basic
  )
    for (const e of s.queue)
      if (!previousEffects.has(e) && e.type === "heroAttackResponses")
        e.shadowcatAbilityAttack = true;
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
  basic = false,
  ignorePatrol = false,
) {
  const p = source === "hero" ? s.player : find(s, source);
  if (!p) return;
  if (
    source === "hero" &&
    magneto.magnetoIdentityRestricted(s, s.activePlayerId, { isTextBlank })
  )
    return;
  if (
    !sentinels.sentinelsCanThwart(s, target, s.activePlayerId, sentinelsPorts)
  )
    return;
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
    source !== "hero" &&
    (niPack.novaIronheartPackWaspIgnores(s, p as Piece, niPackPorts) ||
      colossus.colossusAllyModifiers(s, p as Piece, colossusPorts).ignoreCrisis)
  ) {
    ignorePatrol = true;
    ignoreCrisis = true;
  }
  if (
    source === "hero" &&
    shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts)
  ) {
    ignorePatrol = true;
    ignoreCrisis = true;
  }
  if (
    !(
      source !== "hero"
        ? niAllyTargets(s, p as Piece, "thwart")
        : ignorePatrol
          ? visionPorts.schemeTargets(s, true, ignoreCrisis, true)
          : ignoreCrisis
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
  if (removed > 0)
    add(
      s,
      E("spiderHamSchemeThwartInterrupts", {
        receipt: {
          token: `thwart:${s.nextId++}`,
          playerId: s.activePlayerId,
          sourceId: source,
          target,
          amount: removed,
          performed: true,
          thwart: true,
          basic,
        },
      }),
    );
  if (!wasHero) return removed;

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
        source,
        basic,
        thwart: true,
        removedAllThreat: beforeThreat > 0 && removed === beforeThreat,
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
  const alliance = !!targetCode && keyword(targetCode, "Alliance");
  const sources = paymentSources(s, excludeId, targetCode, false, alliance);
  return paymentStatus(
    sources,
    sources.map((p) => p.id),
    cost,
    requirements,
  ).ready;
}
/** Printed Alliance costs can use resources generated by any active player. */
export function canPayAlliance(
  s: GameState,
  cost: number,
  requirements: Resource[] = [],
  excludeId?: string,
  targetCode?: string,
) {
  const sources = paymentSources(s, excludeId, targetCode, false, true);
  return paymentStatus(
    sources,
    sources.map((source) => source.id),
    cost,
    requirements,
  ).ready;
}
function sinisterPlayRequirements(p: Piece): Resource[] {
  return [
    ...sinisterPlayerPack.sinisterPlayerPackRequirements(p),
    ...ghostSpider.ghostSpiderEventRequirements(p),
    ...niPack.novaIronheartPackRequirements(p),
    ...spiderHamPack.spiderHamPackRequirements(p),
  ];
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
  const paymentTarget = abilityCost ? targetCode : targetCode || piece?.code;
  need(
    !s.attack ||
      !armadillo.armadilloDefenseBlocked(s, s.attack.attacker) ||
      !/\([^)]*\bdefense\b/i.test(
        paymentTarget ? card(paymentTarget).text || "" : "",
      ),
    "Rollin’, Rollin’ prevents characters from defending this attack.",
  );
  if (!abilityCost && piece) {
    const printedRequirements = sinisterPlayRequirements(piece);
    for (const resource of new Set(printedRequirements)) {
      const missing =
        printedRequirements.filter((r) => r === resource).length -
        requirements.filter((r) => r === resource).length;
      if (missing > 0)
        requirements = [
          ...requirements,
          ...Array<Resource>(missing).fill(resource),
        ];
    }
  }
  if (!abilityCost && piece?.code === "27032" && !milesPorts.canChangeForm(s)) {
    if (cost === 0) {
      log(
        s,
        `${title}: a zero-cost payment cannot allocate Physical to ready under a form lock.`,
      );
      return;
    }
    if (!requirements.includes("physical"))
      requirements = [...requirements, "physical"];
  }
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
  const alliance =
    !abilityCost && !!paymentTarget && keyword(paymentTarget!, "Alliance");
  const retainOneOfIds =
    !abilityCost && piece?.code === "23017"
      ? warmPack
          .warMachinePackSneakAllies(s, warMachinePackPorts)
          .map((ally) => ally.id)
      : [];
  const retainAlternatives =
    !abilityCost && piece?.code === "26035"
      ? visionPack
          .visionPackJoiningPairs(s, visionPackPorts)
          .map((pair) => pair.map((ally) => ally.id))
      : [];
  if (!abilityCost && piece?.code === "26035" && !retainAlternatives.length) {
    log(s, `${title}: keep an eligible Avenger and Guardian in hand.`);
    return;
  }
  if (!abilityCost && piece?.code === "23017" && !retainOneOfIds.length) {
    log(s, `${title}: no eligible ally remains in hand.`);
    return;
  }
  if (
    cost === 0 &&
    piece &&
    warMachine.warMachinePlayRestriction(s, piece, {
      canPayEventWithAmmo: (state, _piece, neededAmmo) =>
        warMachine.warMachineAmmo(state) >= neededAmmo,
    })
  )
    forcePayment = true;
  if (cost === 0 && !requirements.length && !forcePayment) {
    const zeroAfter = after.map((e) => ({
      ...e,
      paid: [],
      ...(e.paymentReceipt ||
      (piece &&
        ["nova", "ironheart", "spdr"].includes(card(piece).pack_code || ""))
        ? { paidForCard: [], generatedForCard: [], generated: [] }
        : {}),
      ...([
        "20002",
        "20003",
        "20006",
        "26019",
        "27014",
        "27032",
        "27033",
        "27034",
      ].includes(piece?.code || "")
        ? { paidForCard: [] }
        : {}),
    }));
    const spentResponseCards = s.player.hand.filter((p) => p.id !== piece?.id);
    if (
      mtsPlayerPack.mtsPlayerPackResourcesSpent(
        s,
        spentResponseCards,
        mtsPlayerPackPorts,
      ).length ||
      nebulaPack.nebulaPackResourcesSpent(s, spentResponseCards).length ||
      warmPack.warMachinePackResourcesSpent(s, spentResponseCards).length ||
      valkPack.valkyriePackResourcesSpent(s, spentResponseCards).length ||
      visionPack.visionPackResourcesSpent(
        s,
        spentResponseCards,
        visionPackPorts,
      ).length ||
      warMachine.warMachineResourceSources(s, paymentTarget).length ||
      spentResponseCards.some((p) => p.code === "29009") ||
      niPack.novaIronheartPackResourcesSpent(
        s,
        spentResponseCards,
        s.activePlayerId,
        niPackPorts,
      ).length ||
      spentResponseCards.some(
        (p) =>
          ["33018", "36021"].includes(p.code) &&
          !!piece &&
          card(piece).type_code === "ally" &&
          !abilityCost,
      ) ||
      mgPack.mutantGenesisPlayerPackPaymentInterrupts(s, spentResponseCards, {
        token: "zero-payment-probe",
        playerId: s.activePlayerId,
        eventId: piece?.id || "",
        eventCode: piece?.code || "",
        playing: !!piece && !abilityCost,
        resourceIds: spentResponseCards.map((p) => p.id),
      }).length
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
  let neededGunSources = 0;
  if (!abilityCost && piece)
    warMachine.warMachinePlayRestriction(s, piece, {
      canPayEventWithAmmo: (state, _piece, ammo) => {
        neededGunSources = Math.max(0, ammo - warMachine.warMachineAmmo(state));
        return true;
      },
    });
  // A cost that cannot be paid must not open a dialog with no way out.
  const availableSources = paymentSources(
    s,
    piece?.id,
    paymentTarget,
    handOnly,
    alliance,
  );
  const sourceRequirement = neededGunSources
    ? {
        ids: availableSources
          .filter(
            (source) =>
              source.kind === "ability" &&
              source.code === "23005" &&
              !source.playerId,
          )
          .map((source) => source.id),
        minimum: neededGunSources,
        label: `Generate ${neededGunSources} ammo with Gauntlet Gun`,
      }
    : undefined;
  if (
    suggestPayment(
      availableSources,
      cost,
      requirements,
      () => 0,
      retainOneOfIds,
      sourceRequirement,
      retainAlternatives,
    ) === null
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
    paymentTarget: paymentTarget,
    ...(handOnly ? { handOnly: true } : {}),
    ...(abilityCost ? { abilityCost: true } : {}),
    ...(alliance ? { alliance: true } : {}),
    ...(retainOneOfIds.length ? { retainOneOfIds } : {}),
    ...(retainAlternatives.length ? { retainAlternatives } : {}),
    ...(sourceRequirement ? { sourceRequirement } : {}),
    wildAs: requirements[0] || "energy",
  };
}
function pay(
  s: GameState,
  ids: string[],
  wildAs: Resource = "energy",
  actualAllocation?: Resource[],
  actualGeneration?: Resource[],
  actualSyncPaid?: number,
) {
  const p = s.prompt!;
  need(p?.kind === "payment", "No payment is pending.");
  need(new Set(ids).size === ids.length, "Choose each resource source once.");
  const sources = paymentSources(
    s,
    p.card?.id,
    p.paymentTarget,
    p.handOnly,
    p.alliance,
  );
  const selected = ids.map((id) => sources.find((x) => x.id === id));
  need(selected.every(Boolean), "A selected resource is unavailable.");
  if (p.card && !p.abilityCost)
    mgPack.mutantGenesisPlayerPackPaymentPreflight(
      s,
      p.card,
      mutantGenesisPackPorts,
      selected.map((source) => source!.localId || source!.id),
    );
  const {
    printed,
    missing,
    retained,
    retainedAlternative,
    sourceRequirementMet,
  } = paymentStatus(
    sources,
    ids,
    p.cost || 0,
    p.requirements,
    p.retainOneOfIds,
    p.sourceRequirement,
    p.retainAlternatives,
  );
  need(
    sourceRequirementMet,
    p.sourceRequirement?.label || "The additional cost is not funded.",
  );
  need(retained, "Keep an eligible ally in hand for Sneak Attack.");
  need(
    retainedAlternative,
    "Keep an Avenger and Guardian in hand for Joining Forces.",
  );
  need(
    !p.card ||
      visionPack.visionPackPaymentAllowed(
        s,
        p.card,
        selected.map((source) => source!.localId || source!.id),
        visionPackPorts,
      ),
    "Keep an eligible Avenger and Guardian in hand for Joining Forces.",
  );
  need(printed.length >= (p.cost || 0), "Not enough resources.");
  need(!missing.length, `You need a ${missing[0]} resource.`);
  if (p.card) {
    const reason = warMachine.warMachinePlayRestriction(s, p.card, {
      canPayEventWithAmmo: (state, _piece, neededAmmo) =>
        warMachine.warMachineAmmo(state) +
          selected.filter(
            (source) =>
              source?.kind === "ability" &&
              source.code === "23005" &&
              !source.playerId,
          ).length >=
        neededAmmo,
    });
    need(
      !reason,
      reason || "The actual selected payment cannot cover the ammo cost.",
    );
  }
  const req = [...(p.requirements || [])];
  need(
    !p.card || hulkPaymentAllowed(p.card, printed, wildAs),
    "Crushing Blow can only be paid with physical resources.",
  );
  let paidForCard: Resource[] | undefined;
  let generatedForCard: Resource[] | undefined;
  let spentAssignment: Resource[] | undefined;
  const trackGeneration =
    !!p.after?.some((e) => e.paymentReceipt) ||
    !!(
      p.card &&
      !p.abilityCost &&
      (["nova", "ironheart", "spdr"].includes(card(p.card).pack_code || "") ||
        niPack.novaIronheartPackAttackEventBonus(
          s,
          p.card,
          ["mental"],
          niPackPorts,
        ))
    );
  if (trackGeneration) {
    const allocations = generatedResourceAllocations(
      printed,
      p.cost || 0,
      req,
      wildAs,
    );
    need(
      allocations.length,
      "The generated resources cannot pay the actual cost.",
    );
    if (actualAllocation && actualGeneration) {
      const key = (rs: Resource[]) => [...rs].sort().join(":");
      const assignment = allocations.find(
        (a) =>
          key(a.paid) === key(actualAllocation) &&
          key(a.generated) === key(actualGeneration),
      );
      need(
        assignment,
        "The selected generated-resource allocation cannot pay this cost.",
      );
      paidForCard = actualAllocation;
      generatedForCard = actualGeneration;
      spentAssignment = assignment!.spent;
    } else if (allocations.length > 1) {
      choose(
        s,
        "Allocate payment resources",
        "Choose the generated resources that pay the actual cost. Other generated resources are overpaid.",
        allocations.map((a, index) => {
          const generatedLabel = [...new Set(a.generated)]
            .map((r) => `${a.generated.filter((v) => v === r).length} ${r}`)
            .join(" + ");
          const sameGenerated = allocations.filter(
            (other) =>
              [...other.generated].sort().join(":") ===
              [...a.generated].sort().join(":"),
          ).length;
          const label =
            sameGenerated > 1
              ? `${generatedLabel} as ${a.paid.join(" + ")}`
              : generatedLabel;
          const id =
            sameGenerated === 1 &&
            a.generated.length &&
            a.generated.every((r) => r === a.generated[0])
              ? a.generated[0]
              : `allocation:${index}`;
          return option(id, label, [
            E("commitPaymentAllocation", {
              payment: p,
              ids,
              wildAs,
              paidForCard: a.paid,
              generatedForCard: a.generated,
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
    } else {
      paidForCard = allocations[0].paid;
      generatedForCard = allocations[0].generated;
      spentAssignment = allocations[0].spent;
    }
  }
  if (
    !trackGeneration &&
    [
      "14015",
      "20002",
      "20003",
      "20006",
      "22011",
      "26019",
      "27014",
      "27032",
      "27033",
      "27034",
    ].includes(p.card?.code || "")
  ) {
    const allocations = paidResourceAllocations(
      printed,
      p.cost || 0,
      req,
      wildAs,
      p.card?.code === "22011",
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
  need(
    !p.card ||
      miles.milesPaymentAllowed(
        s,
        p.card,
        { paidForCard: paidForCard ?? [] },
        milesPorts,
      ),
    "Double Life needs an actual Physical allocation to ready under this form lock.",
  );
  const syncCount = selected.flatMap((info) =>
    info!.resources.map(() =>
      (info!.localId || info!.id).startsWith("spdr-sync:"),
    ),
  );
  let syncPaid = 0;
  if (p.card && ["31003", "31005", "31006"].includes(p.card.code)) {
    const needed = p.cost || 0;
    const counts = new Set<number>();
    const assigned =
      spentAssignment || printed.map((r) => (r === "wild" ? wildAs : r));
    const wanted = (paidForCard || assigned.slice(0, needed))
      .slice()
      .sort()
      .join(":");
    const visit = (i: number, chosen: number[], count: number) => {
      if (chosen.length === needed) {
        if (
          chosen
            .map((n) => assigned[n])
            .sort()
            .join(":") === wanted
        )
          counts.add(count);
        return;
      }
      if (i >= assigned.length || chosen.length + assigned.length - i < needed)
        return;
      visit(i + 1, [...chosen, i], count + Number(syncCount[i]));
      visit(i + 1, chosen, count);
    };
    visit(0, [], 0);
    if (actualSyncPaid !== undefined) {
      need(
        counts.has(actualSyncPaid),
        "The actual Sync Ratio payment allocation is unavailable.",
      );
      syncPaid = actualSyncPaid;
    } else if (counts.size > 1) {
      choose(
        s,
        "Allocate Sync Ratio resources",
        "Choose how many generated Interface resources pay the card; the others are overpaid.",
        [...counts].sort().map((count) =>
          option(
            `sync:${count}`,
            `${count} Sync Ratio resource${count === 1 ? "" : "s"} paid`,
            [
              E("commitPaymentAllocation", {
                payment: p,
                ids,
                wildAs,
                paidForCard,
                generatedForCard,
                syncPaid: count,
              }),
            ],
          ),
        ),
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
    } else syncPaid = [...counts][0] || 0;
  }
  const clarity = selected.find(
    (info) =>
      info!.code === "31029" && !s.flags[`spdrClarityCommitted:${info!.id}`],
  );
  if (clarity) {
    const paymentActor = s.activePlayerId;
    const contributor = clarity.playerId || paymentActor;
    s.prompt = null;
    activateSeat(s, contributor);
    try {
      need(
        spdrPack.spdrPackResourceSpent(
          s,
          clarity.localId || clarity.id,
          [
            E("spdrPaymentResume", {
              actorId: paymentActor,
              payment: p,
              ids,
              wildAs,
              paidForCard,
              generatedForCard,
              syncPaid,
              committedId: clarity.id,
              committedSource: { ...clarity, playerId: contributor },
            }),
          ],
          spdrPackPorts,
        ),
        "Clarity of Purpose is unavailable.",
      );
    } finally {
      activateSeat(s, paymentActor);
    }
    return;
  }
  const paymentActor = s.activePlayerId;
  const contributors = new Set<string>([paymentActor]);
  for (const selectedSource of selected) {
    const info = selectedSource!;
    const contributor = info.playerId || paymentActor;
    const id = info.localId || info.id;
    contributors.add(contributor);
    activateSeat(s, contributor);
    const responseStart = spentResponses.length;
    try {
      if (id === "scientist") s.flags.scientist = true;
      else if (id === "symbiotic-bond") {
        need(
          venom.venomResourceSpent(s, id, venomPorts),
          "Symbiotic Bond is unavailable.",
        );
      } else if (
        seatView(s, paymentActor).flags[`spdrClarityCommitted:${info.id}`]
      ) {
        delete seatView(s, paymentActor).flags[
          `spdrClarityCommitted:${info.id}`
        ];
      } else if (find(s, id)?.code === "43010") {
        spentResponses.push(...(x23.x23ResourceSpent(s, id, x23Ports) || []));
      } else if (psylocke.psylockeIsResource(s, id)) {
        spentResponses.push(...psylocke.psylockeResourceSpent(s, id));
      } else if (cable.cableSpendResource(s, id)) {
      } else if (rogue.rogueSpendResource(s, id)) {
        // The physical X-Gene exhausts only when payment commits.
      } else if (phoenix.phoenixResourceSpent(s, id)) {
        // The actual Phoenix Force counter pays this phase-limited resource.
      } else if (spdr.spdrResourceSpent(s, id)) {
        // Sync Ratio exhausts the actual selected Interface card.
      } else if (cyclops.cyclopsResourceSpent(s, id, p.paymentTarget)) {
        // Only the actual Visor can generate this Optic Blast resource.
      } else if (storm.stormSpendResource(s, id)) {
      } else if (colossus.colossusResourceSpent(s, id, { isTextBlank })) {
        // Exhaust the actual ready Titanium Muscles, retaining current Tough.
      } else if (
        shadowcat.shadowcatResourceSpent(s, id, p.paymentTarget, {
          isTextBlank,
        })
      ) {
        // The physical Solid mass-form upgrade pays its own exhaust cost.
      } else if (spiderHam.spiderHamResourceSpent(s, id, spiderHamPorts)) {
        // Counter resources are validated together and spent individually.
      } else if (s.player.hand.some((x) => x.id === id)) {
        const spent = discardHand(s, id);
        phoenix.phoenixPayment(seatView(s, paymentActor), spent, p.card);
        spentResponses.push(...gambit.gambitPayment(s, spent));
        if (!p.abilityCost)
          spentResponses.push(...angel.angelResourceSpent(s, spent, p.card));
        spentResponses.push(
          ...cyclops.cyclopsResourceCardSpent(
            s,
            spent,
            p.card,
            !!p.card && !p.abilityCost,
          ),
        );
        spentResponses.push(
          ...mgPack.mutantGenesisPlayerPackPaymentInterrupts(s, [spent], {
            token: `mutant-payment:${s.nextId++}`,
            playerId: contributor,
            eventId: p.card?.id || "",
            eventCode: p.card?.code || p.paymentTarget || "",
            playing: !!p.card && !p.abilityCost,
            resourceIds: [spent.id],
          }),
        );
        spentResponses.push(
          ...antMan.antManResourceSpent(s, spent, antManPorts),
        );
        spentResponses.push(...wasp.waspResourceSpent(s, spent, waspPorts));
        spentResponses.push(
          ...ironheart.ironheartResourceCardSpent(s, {
            token: `spend:${s.nextId++}`,
            playerId: s.activePlayerId,
            piece: spent,
          }),
          ...niPack.novaIronheartPackResourcesSpent(
            s,
            [spent],
            paymentActor,
            niPackPorts,
          ),
        );
        spentResponses.push(...rocket.rocketResourceSpent(s, spent));
        spentResponses.push(...nebulaPack.nebulaPackResourcesSpent(s, [spent]));
        spentResponses.push(
          ...warmPack.warMachinePackResourcesSpent(s, [spent]),
          ...valkPack.valkyriePackResourcesSpent(s, [spent]),
          ...visionPack.visionPackResourcesSpent(s, [spent], visionPackPorts),
        );
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
        nova.novaResourceSpent(s, source.id, { isTextBlank });
        ironheart.ironheartResourceSpent(s, source.id, p.paymentTarget, {
          isTextBlank,
        });
        niPack.novaIronheartPackResourceSpent(s, source.id, { isTextBlank });
        spectrumResourceSpent(s, source.id, { isTextBlank });
        warlockResourceSpent(s, source.id, { isTextBlank });
        nebula.nebulaResourceSpent(s, source.id, { isTextBlank });
        warmPack.warMachinePackResourceSpent(s, source.id, { isTextBlank });
        warMachine.warMachineResourceSpent(
          s,
          source.id,
          p.paymentTarget,
          warMachinePorts,
        );
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
      for (let index = responseStart; index < spentResponses.length; index++)
        spentResponses[index] = effectContext(s, spentResponses[index]);
    } finally {
      activateSeat(s, paymentActor);
    }
  }
  for (const contributor of contributors) {
    activateSeat(s, contributor);
    const generatedCount = selected
      .filter((info) => (info!.playerId || paymentActor) === contributor)
      .reduce((n, info) => n + info!.resources.length, 0);
    spentResponses.push(
      ...spdr
        .spdrResourcesGenerated(s, generatedCount)
        .map((e) => effectContext(s, e)),
    );
  }
  activateSeat(s, paymentActor);
  // The resource cards are spent together. An empty player deck can reset
  // once the entire committed payment has reached discard, rather than
  // recycling between individual resources and splitting the same cost.
  for (const contributor of contributors) {
    activateSeat(s, contributor);
    try {
      const beforeReset = new Set(s.queue);
      recyclePlayer(s);
      const resetResponses = s.queue.filter(
        (effect) => !beforeReset.has(effect),
      );
      s.queue = s.queue.filter((effect) => beforeReset.has(effect));
      spentResponses.push(
        ...resetResponses.map((effect) => effectContext(s, effect)),
      );
    } finally {
      activateSeat(s, paymentActor);
    }
  }
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
  const after = (p.after || []).map((e) => ({
    ...e,
    paid: spentAssignment ?? paid,
    ...(paidForCard !== undefined ? { paidForCard } : {}),
    ...(generatedForCard !== undefined ? { generatedForCard } : {}),
    syncPaid,
    generated: [...printed],
    overpaid: Math.max(0, printed.length - (p.cost || 0)),
  }));
  if (p.card && ["21043", "21050", "21055"].includes(p.card.code)) {
    // Printed costs before the arrow and resource costs are paid together.
    // A spent-resource Response cannot alter a target between those costs.
    add(
      s,
      ...mtsPlayerPack.mtsPlayerPackBeforeEvent(s, p.card, [
        E("mtsPackCommittedPayment", {
          pieceId: p.card.id,
          spentResponses,
          after,
        }),
      ]),
    );
    return;
  }
  if (p.card?.code === "31017") {
    // The selected resource payment and printed damage are one card cost.
    // Resource-generation responses wait until its damage cost is complete.
    s.flags.spdrThwipPaymentCost = p.card.id;
    add(
      s,
      ...(spdrPack.spdrPackBeforeEvent(s, p.card, [
        E("spdrCommittedPayment", {
          pieceId: p.card.id,
          spentResponses,
          after,
        }),
      ]) || []),
    );
    return;
  }
  add(s, ...spentResponses, ...after);
}
export function newGame(config: {
  heroId: string;
  aspect: Aspect;
  villainId: string;
  difficulty?: "standard" | "expert";
  module?: string;
  modules?: string[];
  senatorDamage?: number;
  captureAllocation?: number[];
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
  const moduleCount = v.moduleCount || 1;
  const primary = config.module || v.module;
  const selectedModules = config.modules
    ? [...config.modules]
    : moduleCount === 2
      ? [primary, v.defaultModules!.find((id) => id !== primary) || "mystique"]
      : [primary];
  need(
    selectedModules.length === moduleCount &&
      new Set(selectedModules).size === selectedModules.length,
    `Choose ${moduleCount} distinct modular encounter set${moduleCount === 1 ? "" : "s"}.`,
  );
  need(
    selectedModules.every(
      (id) => MODULES.some((m) => m.id === id) && !v.fixedSets?.includes(id),
    ),
    "This modular set’s complete rules are not implemented yet.",
  );
  const scenarioPack = card(v.codes[0]).pack_code;
  if (v.id === "project_wideawake" && config.captureAllocation !== undefined)
    need(
      Array.isArray(config.captureAllocation) &&
        config.captureAllocation.length === team.length &&
        config.captureAllocation.every((n) => Number.isInteger(n) && n >= 0) &&
        config.captureAllocation.reduce((n, value) => n + value, 0) <=
          team.length + 2,
      "Choose one nonnegative setup capture count per player, below Operation Zero Tolerance's loss threshold.",
    );
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
    module: selectedModules[0],
    modules: selectedModules,
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
    victoryDisplay: [],
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
    const codes =
      seat.deckCards || deckCodes(seat.heroId, seat.aspect, seat.deckAspects);
    seat.deckAspects ||= heroDeckAspects(seat.heroId, codes, seat.aspect);
    s.player.deck = codes.map((c) => makePiece(s, c));
    valkyrie.valkyrieSetup(s);
    vision.visionInitializeMass(s, { makePiece });
    shadowcat.shadowcatInitializeMass(s, { makePiece });
    wolverine.wolverineInitialize(s, { makePiece });
    psylocke.psylockeInitialize(s, { makePiece });
    x23.x23Initialize(s, { makePiece });
    s.player.deck = shuffle(s, s.player.deck);
    doctorStrangeSetup(s, dsPorts);
    venom.venomInitializeNemesis(s, { makePiece });
    warlock.warlockInitializeNemesis(s, { makePiece });
    warMachine.warMachineInitializeNemesis(s, { makePiece });
    valkyrie.valkyrieInitializeNemesis(s, { makePiece });
    vision.visionInitializeNemesis(s, { makePiece });
    shadowcat.shadowcatInitializeNemesis(s, { makePiece });
    miles.milesInitializeNemesis(s, { makePiece });
    ghostSpider.ghostSpiderInitializeNemesis(s, { makePiece });
    nova.novaInitializeNemesis(s, { makePiece });
    phoenix.phoenixInitialize(s, { makePiece });
    rogue.rogueInitialize(s, { makePiece });
    spdr.spdrInitialize(s, { makePiece });
    spdr.spdrInitializeNemesis(s, { makePiece });
    spiderHam.spiderHamInitializeIdentity(s, { makePiece });
    spiderHam.spiderHamInitializeNemesis(s, { makePiece });
    cyclops.cyclopsInitializeNemesis(s, { makePiece });
    storm.stormInitialize(s, { makePiece });
    gambit.gambitInitialize(s, makePiece);
    domino.dominoInitialize(s, makePiece);
    angel.angelInitialize(s, { makePiece });
    cable.cableInitialize(s, { makePiece });
    deadpool.deadpoolInitialize(s, makePiece);
    colossus.colossusInitializeNemesis(s, { makePiece });
    ironheart.ironheartInitialize(s, { makePiece });
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
        ((((selectedModules.includes(c.set_code || "") &&
          c.pack_code ===
            ([
              "brotherhood",
              "mystique",
              "zero_tolerance",
              "sentinels",
              "acolytes",
            ].includes(c.set_code || "")
              ? "mut_gen"
              : c.set_code === "exodus"
                ? "gambit"
                : c.set_code === "reavers"
                  ? "rogue"
                  : c.set_code === "deathstrike"
                    ? "wolv"
                    : c.set_code === "shadow_king"
                      ? "storm"
                      : c.set_code === "ironspider_sinister"
                        ? "spdr"
                        : c.set_code === "inheritors"
                          ? "spiderham"
                          : c.set_code === "zzzax"
                            ? "ironheart"
                            : c.set_code === "armadillo"
                              ? "nova"
                              : [
                                    "goblin_gimmicks",
                                    "a_mess_of_things",
                                    "power_drain",
                                    "running_interference",
                                  ].includes(c.set_code || "")
                                ? "gob"
                                : "core")) ||
          (c.set_code === (v.id === "magneto" ? "magneto_villain" : v.id) &&
            c.pack_code === scenarioPack) ||
          (v.fixedSets?.includes(c.set_code || "") &&
            c.pack_code === scenarioPack) ||
          (c.set_code === "standard" && c.pack_code === "core") ||
          (difficulty === "expert" &&
            c.set_code === "expert" &&
            c.pack_code === "core")) &&
          !["villain", "main_scheme"].includes(c.type_code) &&
          c.code !== "32088b" &&
          !(v.id === "magneto" && ["32144b", "32145b"].includes(c.code)) &&
          (c.type_code !== "environment" ||
            selectedModules.includes(c.set_code || ""))) ||
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
  if (v.id === "magneto") {
    const boarding = s.encounter.deck.find((p) => p.code === "32144a");
    const orbital = s.encounter.deck.find((p) => p.code === "32145a");
    need(
      boarding && orbital,
      "Magneto requires its original progress side schemes.",
    );
    s.encounter.deck = s.encounter.deck.filter(
      (p) => p.id !== boarding!.id && p.id !== orbital!.id,
    );
    const data = magneto.magnetoInitialize(s);
    data.mainDeck = ["32142a", "32143a"].map((code) => makePiece(s, code));
    data.currentMain = makePiece(s, "32141b");
    data.mainCode = "32141b";
    const active = makePiece(s, v.codes[stage - 1]);
    s.villain = Object.assign(active, { hp, maxHp: hp, stage });
    data.villainDeck = [makePiece(s, v.codes[stage])];
    s.scheme.threat = s.playerCount;
    magneto.magnetoSetup(
      s,
      { boarding: boarding!, orbital: orbital! },
      magnetoPorts,
    );
    s.queue.push(
      effectContext(
        s,
        E("magneto-native:setup-stage", { actorId: s.firstPlayerId }),
      ),
      effectContext(s, E("openingHands", { actorId: s.firstPlayerId })),
    );
    const pacing = s.pacing;
    s.pacing = "expert";
    run(s);
    s.pacing = pacing;
  } else if (v.id === "mansion_attack") {
    mansionAttack.mansionAttackSetup(
      s,
      {
        villains: v.codes.map((code) => makePiece(s, code)),
        rooms: ["32126a", "32127a", "32128a", "32129a"].map((code) =>
          makePiece(s, code),
        ),
        opening: makePiece(s, "32125a"),
        saveSchool: makePiece(s, "32130"),
      },
      mansionAttackPorts,
    );
    s.queue.push(
      effectContext(s, E("openingHands", { actorId: s.firstPlayerId })),
    );
    const pacing = s.pacing;
    s.pacing = "expert";
    run(s);
    s.pacing = pacing;
  } else if (v.id === "master_mold") {
    s.scheme.threat = s.playerCount;
    masterMold.masterMoldSetup(s, makePiece(s, "32172b"), masterMoldPorts);
    s.queue.push(
      ...masterMold
        .masterMoldMainRevealed(s, "32112b")
        .map((e) => effectContext(s, e)),
      effectContext(s, E("openingHands", { actorId: s.firstPlayerId })),
    );
    const pacing = s.pacing;
    s.pacing = "expert";
    run(s);
    s.pacing = pacing;
  } else if (v.id === "project_wideawake") {
    const captives = s.encounter.deck.filter((p) =>
      ["32089", "32090", "32091", "32092"].includes(p.code),
    );
    const mall = s.encounter.deck.find((p) => p.code === "32088a");
    const operation = s.encounter.deck.find((p) => p.code === "32104");
    need(
      mall && operation,
      "Project Wideawake requires its original physical setup schemes.",
    );
    const setupIds = new Set([
      ...captives.map((p) => p.id),
      mall!.id,
      operation!.id,
    ]);
    s.encounter.deck = s.encounter.deck.filter((p) => !setupIds.has(p.id));
    s.scheme.threat = s.playerCount;
    wideawake.projectWideawakeSetup(
      s,
      { captives, mall: mall!, operation: operation! },
      wideawakePorts,
      config.captureAllocation,
    );
    s.queue.push(
      effectContext(
        s,
        E("wideawake-native:setup-stage", { actorId: s.firstPlayerId }),
      ),
      effectContext(s, E("openingHands", { actorId: s.firstPlayerId })),
    );
    const pacing = s.pacing;
    s.pacing = "expert";
    run(s);
    s.pacing = pacing;
  } else if (v.id === "sabretooth") {
    const find = s.encounter.deck.find((p) => p.code === "32065a");
    const kelly = s.encounter.deck.find((p) => p.code === "32066");
    need(
      find && kelly,
      "Sabretooth requires its original physical setup cards.",
    );
    s.encounter.deck = s.encounter.deck.filter(
      (p) => p.id !== find!.id && p.id !== kelly!.id,
    );
    sabretooth.sabretoothSetup(
      s,
      find!,
      kelly!,
      sabretoothPorts,
      config.senatorDamage,
    );
    openingHands(s);
  } else if (v.id === "mutagen_formula") {
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
      ...cable
        .cableSetup(seatView(s, seat))
        .map((e) => ({ ...e, actorId: seat.id })),
      ...rogue
        .rogueSetup(seatView(s, seat))
        .map((e) => ({ ...e, actorId: seat.id })),
      ...vision
        .visionSetup(seatView(s, seat), { makePiece })
        .map((e) => ({ ...e, actorId: seat.id })),
      ...shadowcat
        .shadowcatSetup(seatView(s, seat), { makePiece })
        .map((e) => ({ ...e, actorId: seat.id })),
      ...x23
        .x23Setup(seatView(s, seat))
        .map((e) => ({ ...e, actorId: seat.id })),
      ...psylocke
        .psylockeSetup(seatView(s, seat))
        .map((e) => ({ ...e, actorId: seat.id })),
      ...wolverine
        .wolverineSetup(seatView(s, seat))
        .map((e) => ({ ...e, actorId: seat.id })),
      ...storm
        .stormSetup(seatView(s, seat))
        .map((e) => ({ ...e, actorId: seat.id })),
      ...colossus.colossusSetup(seatView(s, seat)).map((e) => ({
        ...e,
        actorId: seat.id,
      })),
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
    E("wolverinePlayerPhase"),
    E("beginTurn", { actorId: cyclops.cyclopsFirstTurn(s) }),
  );
}
const reactionCards = [
  "44005",
  "44017",
  "44022",
  "44047",
  "32014",
  "32017",
  "32021",
  "32050",
  "32040",
  "27014",
  "26012",
  "23034",
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
  if (deadpool.deadpoolTriggeredBlocked(s))
    return "The Merc with the Mouth prevents another player’s triggered card abilities during this turn.";
  const deadpoolRestriction = deadpool.deadpoolPlayRestriction(s, p);
  if (deadpoolRestriction) return deadpoolRestriction;
  const c = card(p);
  if (
    c.type_code === "event" &&
    /\([^)]*\b(?:attack|thwart|defense|recover)\b/i.test(c.text || "") &&
    magneto.magnetoIdentityRestricted(s, s.activePlayerId, { isTextBlank })
  )
    return "Wrapped in Metal prevents this identity from attacking, thwarting, defending or recovering.";
  const npcRestriction = npcPlayerPlayRestriction(s, p);
  if (npcRestriction) return npcRestriction;
  if (
    s.attack &&
    /\([^)]*\bdefense\b/i.test(c.text || "") &&
    armadillo.armadilloDefenseBlocked(s, s.attack.attacker)
  )
    return "Rollin’, Rollin’ prevents characters from defending this attack.";
  if (c.type_code === "event" && ghostSpider.ghostSpiderCannotPlayEvents(s))
    return "In Cold Blood prevents this player from playing events during the attack.";
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
    c.text?.includes("(attack)") &&
    (angel.angelEventAction(s, p) || vision.visionEventAction(s, p)) !==
      "thwart" &&
    (!vision.visionCanAttack(s) ||
      !shadowcat.shadowcatCanAttack(s, shadowcatPorts) ||
      !cyclops.cyclopsCanAttack(s))
  )
    return "This identity cannot attack in its current form.";
  if (
    c.type_code === "event" &&
    c.text?.includes("(defense)") &&
    s.attack &&
    !vision.visionCanDefend(s)
  )
    return "Vision cannot defend in Intangible mass form.";
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
  if (
    p.code === "22010" &&
    !canPay(s, cardCost(s, { ...c, cost: 1 }, p), [], p.id, p.code, false)
  )
    return "Lethal Intent requires a payable positive X.";
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
    domino.dominoPlayRestriction(s, p, dominoPorts) ||
    x23.x23PlayRestriction(s, p, x23Ports) ||
    gambit.gambitPlayRestriction(s, p, gambitPorts) ||
    cyclops.cyclopsPlayRestriction(s, p, cyclopsPorts) ||
    psylocke.psylockePlayRestriction(s, p, psylockePorts) ||
    rogue.roguePlayRestriction(s, p, roguePorts) ||
    wolverine.wolverinePlayRestriction(s, p, wolverinePorts) ||
    cable.cablePlayRestriction(s, p) ||
    angel.angelPlayRestriction(s, p, angelPorts) ||
    storm.stormPlayRestriction(s, p, stormPorts) ||
    colossus.colossusPlayRestriction(s, p, colossusPorts) ||
    shadowcat.shadowcatPlayRestriction(s, p, shadowcatPorts) ||
    mgPack.mutantGenesisPlayerPackPlayRestriction(
      s,
      p,
      mutantGenesisPackPorts,
    ) ||
    venom.venomPlayRestriction(s, p) ||
    warlock.warlockPlayRestriction(s, p) ||
    warMachine.warMachinePlayRestriction(s, p, warMachinePorts) ||
    valkyrie.valkyriePlayRestriction(s, p, valkyriePorts) ||
    vision.visionPlayRestriction(s, p, visionPorts) ||
    miles.milesPlayRestriction(s, p, milesPorts) ||
    ghostSpider.ghostSpiderPlayRestriction(s, p) ||
    nova.novaPlayRestriction(s, p, novaPorts) ||
    phoenix.phoenixPlayRestriction(s, p, phoenixPorts) ||
    spdr.spdrPlayRestriction(s, p, spdrPorts) ||
    spdrPack.spdrPackPlayRestriction(s, p, spdrPackPorts) ||
    spiderHam.spiderHamPlayRestriction(s, p, spiderHamPorts) ||
    spiderHamPack.spiderHamPackPlayRestriction(s, p, spiderHamPackPorts) ||
    ironheart.ironheartPlayRestriction(s, p, ironheartPorts) ||
    nebula.nebulaPlayRestriction(s, p, nebulaPorts) ||
    spectrum.spectrumPlayRestriction(s, p) ||
    starLordPack.starLordPackPlayRestriction(s, p, starLordPackPorts) ||
    gamoraPack.gamoraPackPlayRestriction(s, p, gamoraPackPorts) ||
    draxPack.draxPackPlayRestriction(s, p, draxPackPorts) ||
    venomPack.venomPackPlayRestriction(s, p, venomPackPorts) ||
    mtsPlayerPack.mtsPlayerPackPlayRestriction(s, p, mtsPlayerPackPorts) ||
    nebulaPack.nebulaPackPlayRestriction(s, p, nebulaPackPorts) ||
    warmPack.warMachinePackPlayRestriction(s, p, warMachinePackPorts) ||
    valkPack.valkyriePackPlayRestriction(s, p, valkyriePackPorts) ||
    visionPack.visionPackPlayRestriction(s, p, visionPackPorts) ||
    niPack.novaIronheartPackPlayRestriction(s, p, niPackPorts) ||
    sinisterPlayerPack.sinisterPlayerPackPlayRestriction(
      s,
      p,
      sinisterPlayerPackPorts,
    );
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
    !targets(s, "ally").some(
      (t) => rulesCode(p) !== "01074" || playerAttachmentTarget(s, p, t.id),
    )
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
  const available = paymentSources(
    s,
    p.id,
    p.code,
    false,
    keyword(p.code, "Alliance"),
  ).reduce((n, p) => n + p.resources.length, 0);
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
  const printedRequirements = sinisterPlayRequirements(p);
  if (
    printedRequirements.length &&
    !canPay(
      s,
      Math.max(0, cardCost(s, c, p) - maximumAllyUpgradeDiscount(s, p)),
      printedRequirements,
      p.id,
      p.code,
    )
  )
    return "The printed resource requirements must still be paid after discounts.";
  return null;
}
function requestPlay(s: GameState, p: Piece, discountHandled = false) {
  const npcRestriction = npcPlayerPlayRestriction(s, p);
  need(!npcRestriction, npcRestriction || "This card has no eligible target.");
  const strikeCost = mgPack.mutantGenesisPlayerPackBeforeEvent(s, p, [
    E("playRequest", { piece: p, discountHandled }),
  ]);
  if (strikeCost) {
    add(s, ...strikeCost);
    return;
  }
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
          : sinisterPlayRequirements(p);
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
  if (
    allyTargets.length &&
    (maximumAllyUpgradeDiscount(s, p!) > 0 ||
      phoenix.phoenixAttachmentTargets(s, p, phoenixPorts) !== null)
  ) {
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
  if (p.code === "22010") {
    const techniques = s.player.inPlay.filter(
      (piece) =>
        card(piece).type_code === "upgrade" &&
        card(piece).traits?.includes("Technique."),
    );
    need(
      techniques.some((piece) =>
        nebula.nebulaSpecialAvailable(s, piece, nebulaPorts),
      ),
      "Lethal Intent has no Technique Special to resolve.",
    );
    const options = techniques.flatMap((_, index) => {
      const x = index + 1;
      const xCost = cardCost(s, { ...card(p), cost: x }, p);
      return canPay(s, xCost, [], p.id, p.code, false)
        ? [
            option(
              String(x),
              `X = ${x} · resolve up to ${x} ${x === 1 ? "Technique" : "Techniques"}`,
              [
                E("payRequest", {
                  title: card(p).name,
                  cost: xCost,
                  piece: p,
                  after: [E("play", { piece: p, lightningX: x })],
                  cancelable: true,
                  starLordCostHandled: true,
                }),
              ],
              undefined,
              p.code,
            ),
          ]
        : [];
    });
    need(options.length, "Lethal Intent requires a payable positive X.");
    choose(
      s,
      "Lethal Intent",
      "Choose X before paying its cost.",
      options,
      true,
    );
    return;
  }
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
        : sinisterPlayRequirements(p!);
  need(
    canPay(s, cost, requirements, p!.id, p!.code, false),
    `You cannot pay ${cost} for ${card(p!).name} right now.`,
  );
  const additionalCommit = mgPack.mutantGenesisPlayerPackPaymentCommit(s, p);
  requestPayment(
    s,
    card(p!).name,
    cost,
    [E("play", { piece: p, masterInvocationId })],
    requirements,
    p,
    true,
    undefined,
    ["12011", "13012"].includes(p!.code) || additionalCommit.length > 0,
    additionalCommit,
    true,
  );
  if (p.code === "32045" && s.prompt?.cancelable)
    s.prompt.cancellationQueue = [
      E("mutant-genesis-player:strike-cancel", { id: p.id }),
      ...(s.prompt.cancellationQueue || s.queue),
    ];
}
function nativeCardPlayCommitted(s: GameState, p: Piece) {
  add(s, ...cable.cablePlayed(s, p));
  angel.angelCardPlayed(s, p);
  add(s, ...x23.x23Played(s, p));
  deadpool.deadpoolCardPlayed(s);
  const playToken = `play:${s.nextId++}`;
  miles.milesCardPlayCommitted(s, p, playToken);
  nova.novaCardPlayCommitted(s, p, playToken);
  if (card(p).type_code === "event") {
    const kind = /Interrupt/i.test(card(p).text || "")
      ? "interrupt"
      : /Response/i.test(card(p).text || "")
        ? "response"
        : "action";
    s.flags[`ghostEvent:${p.id}`] = JSON.stringify({
      token: playToken,
      playerId: s.activePlayerId,
      eventId: p.id,
      code: p.code,
      kind,
      resolved: false,
    });
    delete s.flags[`ghostCancelled:${p.id}`];
  }
  add(
    s,
    E("sinisterNativePlayed", {
      receipt: {
        token: playToken,
        playerId: s.activePlayerId,
        pieceId: p.id,
        code: p.code,
        traits: sinisterNativeTraits(s, p),
        fromHand: true,
      },
    }),
  );
  return playToken;
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
  fromDeck = false,
  generatedForCard?: Resource[],
  novaDamageContext?: nova.NovaDamageContext,
  syncPaid = 0,
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
        fromDeck,
        generatedForCard,
        novaDamageContext,
      }),
    );
    return;
  }
  const storedArrow = hawkeyeStoredPlayable(s).some((x) => x.id === p.id);
  const storedPanther = warmPack
    .warMachinePackStoredPlayable(s, warMachinePackPorts)
    .some((x) => x.id === p.id);
  const storedDefense = visionPack
    .visionPackStoredPlayable(s, visionPackPorts)
    .some((x) => x.id === p.id);
  const fromSetAside =
    p.code === "25002" && !!s.player.setAside?.some((x) => x.id === p.id);
  const storedGeorge = ghostSpider
    .ghostSpiderStoredPlayable(s, ghostSpiderPorts)
    .some((x) => x.id === p.id);
  const stored = storedArrow || storedPanther || storedDefense || storedGeorge;
  const fromHand = s.player.hand.some((x) => x.id === p.id);
  const zone = fromHand
    ? s.player.hand
    : fromSetAside
      ? s.player.setAside!
      : fromDeck
        ? s.player.deck
        : msMarvelDiscardPlayable(s, p)
          ? s.player.discard
          : s.player.hand;
  const i = zone.findIndex((x) => x.id === p.id);
  need(stored || i >= 0, "Card is no longer available to play.");
  if (storedArrow)
    need(hawkeyeTakeStoredForPlay(s, p.id), "The stored Arrow is unavailable.");
  else if (storedPanther)
    need(
      warmPack.warMachinePackTakeStoredForPlay(s, p.id, warMachinePackPorts),
      "The attached Black Panther event is unavailable.",
    );
  else if (storedDefense)
    need(
      visionPack.visionPackTakeStoredForPlay(s, p.id, visionPackPorts),
      "The stored Jocasta Defense event is unavailable.",
    );
  else if (storedGeorge)
    need(
      ghostSpider.ghostSpiderTakeStoredForPlay(s, p.id, ghostSpiderPorts),
      "The stored George Stacy event is unavailable.",
    );
  else zone.splice(i, 1);
  const playToken = nativeCardPlayCommitted(s, p);
  const niBonus = niPack.novaIronheartPackAttackEventBonus(
    s,
    p,
    paidForCard || [],
    niPackPorts,
  );
  if (c.type_code === "event") {
    for (const key of Object.keys(s.flags))
      if (
        [
          `psylockeDirected:${p.id}`,
          `psylockeDirectedBonus:${p.id}`,
          `psylockeIllusionChecked:${p.id}`,
          `psylockeIllusionTarget:${p.id}`,
        ].includes(key) ||
        key.startsWith(`psylockeIllusionChecked:${p.id}:`)
      )
        delete s.flags[key];
    delete s.flags[`wolverineWarriorBonus:${p.id}`];
    for (const key of Object.keys(s.flags))
      if (key.startsWith(`wolverineWarriorUsed:${p.id}:`)) delete s.flags[key];
  }
  if (niBonus) s.flags[`niHoned:${p.id}`] = niBonus;
  const niPlayed = {
    token: playToken,
    playerId: s.activePlayerId,
    pieceId: p.id,
    code: p.code,
    traits: sinisterNativeTraits(s, p),
    paid: paidForCard || [],
    fromHand:
      !fromDeck &&
      !storedArrow &&
      !storedPanther &&
      !storedDefense &&
      !storedGeorge,
  };
  if (c.type_code !== "event")
    add(s, E("niNativePlayed", { receipt: niPlayed }));
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
  nebulaPack.nebulaPackCardPlayed(s, p);
  add(s, E("visionPackFlowPlayed", { piece: p, attacker: s.attack?.attacker }));
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
                generatedForCard,
                syncPaid,
                novaDamageContext,
                lightningX,
                masterInvocationId,
                eventId: p.id,
                playToken,
              }),
            ]),
          ),
        ),
      ),
      E("finishResolution", {
        id: p.id,
        eventId: p.id,
        playToken,
        playedEvent: { ...p },
        niPlayed,
      }),
    );
  } else if (isPlayerSideScheme(p)) {
    Object.assign(p, resetPiece(p, true));
    add(s, ...enterPlayerSideScheme(s, p));
  } else {
    const healthBefore = maxHP(s);
    Object.assign(p, resetPiece(p, true));
    if (
      attachedTarget &&
      !["22032", "22035", "23035", "40030"].includes(p.code)
    )
      p.attachedTo = attachedTarget;
    s.player.inPlay.push(p);
    cyclops.cyclopsEffectiveLeadership(s, p);
    if (p.code === "36019") p.counters = 3;
    if (p.code === "37013") p.counters = 3;
    rogue.rogueCardEntered(s, p, false);
    miles.milesCardEntered(s, p);
    add(s, ...ghostSpider.ghostSpiderCardEntered(s, p));
    if (attachedTarget && ["22032", "22035", "23035", "40030"].includes(p.code))
      attachPackUpgrade(s, p.id, attachedTarget);
    antPack.antManPackAllyPlayed(s, p, overpaid);
    waspPack.waspPackAllyPlayed(
      s,
      p,
      paid,
      Math.max(0, paid.length - overpaid),
    );
    add(
      s,
      ...psylocke.psylockeCardEntered(s, p),
      ...angel.angelCardEntered(s, p),

      ...x23.x23Entered(s, p),
      ...deadpool.deadpoolCardEntered(s, p),
      ...cyclops.cyclopsCardEntered(s, p),
      ...phoenix.phoenixCardEntered(s, p),
      ...rogue.rogueCardEntered(s, p, fromHand),
      ...wolverine
        .wolverineCardEntered(s, p, false)
        .filter(() => !["35003", "35014"].includes(p.code)),
      ...colossus.colossusCardEntered(s, p),
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
      ...warmPack.warMachinePackCardEntered(s, p),
      ...valkPack.valkyriePackCardEntered(s, p),
      ...visionPack.visionPackCardEntered(s, p),
      ...niPack.novaIronheartPackCardEntered(s, p),
      ...spdrPack.spdrPackCardEntered(s, p),
      ...mgPack.mutantGenesisPlayerPackCardEntered(s, p),
      ...spiderHamPack.spiderHamPackCardEntered(s, p),
      ...sinisterPlayerPack.sinisterPlayerPackCardEntered(s, p),
      ...valkyrie.valkyrieCardEntered(s, p),
      ...nebulaPack
        .nebulaPackCardEntered(s, p)
        .filter((e) => !attachedTarget || e.type !== "nebula-pack:attach"),
      ...captainPackCardEntered(s, p),
      ...hulkPackCardEntered(s, p),
      ...msMarvelCardEntered(s, p),
      ...thorCardEntered(s, p),
      ...doctorStrangeCardEntered(s, p),
      ...blackWidowCardPlayed(s, p),
      ...hawkeyeCardEntered(s, p),
      ...nebula.nebulaCardPlayed(s, p, nebulaPorts),
      ...(c.type_code === "upgrade"
        ? [
            E("nebulaPackUpgradePlayed", {
              id: p.id,
              playedPlayerId: s.activePlayerId,
            }),
          ]
        : []),
    );
    if (
      cardScript(p)?.implementation === "script" ||
      p.code === "16035" ||
      p.code === "25007" ||
      p.code === "27191" ||
      ["29012", "29013", "35004", "43009", "43036"].includes(p.code)
    )
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
        E("allyEnter", { id: p.id, paid, paidForCard, fromHand, syncPaid }),
        E("nebulaPackAllyPlayed", {
          id: p.id,
          playedPlayerId: s.activePlayerId,
        }),
        ...(nebula.nebulaAllyPlayed(s, p, nebulaPorts) || []),
        ...starLordPack.starLordPackAllyPlayed(
          s,
          p,
          s.activePlayerId,
          starLordPackPorts,
        ),
      );
    if (["42023", "43019"].includes(p.code) && s.playerCount > 1)
      choosePlayer(
        s,
        c.name,
        [E("transferUpgrade", { id: p.id })],
        playerOrder(s).filter(
          (seat) =>
            !seatView(s, seat).player.inPlay.some(
              (q) => q.code === p.code && q.id !== p.id,
            ),
        ),
      );
    if (["36018", "40022"].includes(p.code) && s.playerCount > 1)
      choosePlayer(
        s,
        c.name,
        [E("transferUpgrade", { id: p.id })],
        playerOrder(s).filter(
          (seat) =>
            !seatView(s, seat).player.inPlay.some(
              (other) =>
                other.id !== p.id &&
                (card(other).traits || "").split(/\.\s*/).includes("Team"),
            ),
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
    if (!attachedTarget && ["23035", "40030"].includes(p.code))
      add(s, E("warmPackAttach", { id: p.id }));
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
  paidForCard: Resource[] = [],
  syncPaid = 0,
) {
  add(
    s,
    ...cable.cableCardEntered(
      s,
      p,
      paidForCard.length ? paidForCard : paid,
      fromHand,
    ),
  );
  add(s, ...cyclops.cyclopsAllyEntered(s, p));
  if (mansionAttack.mansionAttackModifiers(s, p, { isTextBlank }).toughness)
    giveCharacterStatus(s, p, "tough");
  if (isTextBlank(s, p)) return;
  if (p.code === "41003") {
    add(s, ...psylocke.psylockeCardEntered(s, p, fromHand));
    return;
  }
  if (p.code === "37012") {
    add(s, ...gambit.gambitEntered(s, p));
    return;
  }
  if (["35003", "35014"].includes(p.code)) {
    add(s, ...wolverine.wolverineCardEntered(s, p, fromHand));
    return;
  }
  if (["36014", "36015", "36016", "36017", "36022"].includes(p.code)) {
    add(s, ...storm.stormCardEntered(s, p, fromHand));
    return;
  }
  if (p.code === "32032") {
    add(s, ...shadowcat.shadowcatCardEntered(s, p, shadowcatPorts));
    return;
  }
  if (p.code === "32002") return;
  const mutantAlly = mgPack.mutantGenesisPlayerPackAllyEntered(
    s,
    p,
    fromHand,
    mutantGenesisPackPorts,
  );
  if (
    mutantAlly !== null ||
    (
      mgPack.MUTANT_GENESIS_PLAYER_PACK_SCRIPT_CODES as readonly string[]
    ).includes(p.code)
  ) {
    add(s, ...(mutantAlly || []));
    return;
  }
  const spdrAlly =
    phoenix.phoenixAllyEntered(s, p) ??
    spdr.spdrAllyEntered(s, p, { syncPaid }) ??
    spdrPack.spdrPackAllyEntered(s, p, fromHand, spdrPackPorts);
  if (spdrAlly !== null) {
    add(s, ...spdrAlly);
    return;
  }
  const spiderHamAlly =
    spiderHam.spiderHamAllyEnter(s, p, spiderHamPorts) ??
    spiderHamPack.spiderHamPackAllyEntered(s, p, spiderHamPackPorts);
  if (spiderHamAlly !== null) {
    add(s, ...spiderHamAlly);
    return;
  }
  const niAlly = niPack.novaIronheartPackAllyEntered(s, p, niPackPorts);
  if (niAlly !== null) {
    add(s, ...niAlly);
    return;
  }
  const warMachineAlly = warMachine.warMachineAllyEnter(s, p, warMachinePorts);
  if (warMachineAlly !== null) {
    add(s, ...warMachineAlly);
    return;
  }
  if (p.code === "22002") return;
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
  const sinisterAlly = sinisterPlayerPack.sinisterPlayerPackAllyEntered(
    s,
    p,
    fromHand,
    sinisterPlayerPackPorts,
  );
  if (
    sinisterAlly !== null ||
    (
      sinisterPlayerPack.SINISTER_PLAYER_PACK_SCRIPT_CODES as readonly string[]
    ).includes(p.code)
  ) {
    add(s, ...(sinisterAlly || []));
    return;
  }
  const playerPackAlly =
    starLordPack.starLordPackAllyEnter(s, p) ??
    gamoraPack.gamoraPackAllyEnter(s, p) ??
    draxPack.draxPackAllyEnter(s, p) ??
    venomPack.venomPackAllyEnter(s, p) ??
    mtsPlayerPack.mtsPlayerPackAllyEnter(s, p, fromHand) ??
    nebulaPack.nebulaPackAllyEnter(
      s,
      p,
      fromHand,
      paidForCard,
      nebulaPackPorts,
    ) ??
    warmPack.warMachinePackAllyEnter(s, p, warMachinePackPorts) ??
    valkPack.valkyriePackAllyEnter(s, p, valkyriePackPorts) ??
    visionPack.visionPackAllyEnter(s, p, visionPackPorts);
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
  warMachineTarget?: string,
  warMachinePackReceipt: { allyId?: string; amount?: number } = {},
  valkyriePackReceipt: { amount?: number } = {},
  visionMeditationCostPaid = false,
  playToken?: string,
  generatedForCard?: Resource[],
  syncPaid = 0,
) {
  const ant =
    psylocke.psylockeEvent(s, p, paid) ??
    domino.dominoEvent(s, p) ??
    x23.x23Event(s, p) ??
    gambit.gambitEvent(s, p) ??
    cyclops.cyclopsEvent(s, p) ??
    rogue.rogueEvent(s, p) ??
    wolverine.wolverineEvent(s, p) ??
    cable.cableEvent(s, p) ??
    deadpool.deadpoolEvent(s, p) ??
    angel.angelEvent(s, p) ??
    storm.stormEvent(s, p) ??
    colossus.colossusEvent(s, p) ??
    shadowcat.shadowcatEvent(s, p) ??
    mgPack.mutantGenesisPlayerPackEvent(s, p) ??
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
    warMachine.warMachineEvent(s, p, warMachineTarget) ??
    valkyrie.valkyrieEvent(s, p) ??
    vision.visionEvent(s, p) ??
    miles.milesEvent(s, p, { paid, paidForCard, playToken }) ??
    ghostSpider.ghostSpiderEvent(s, p) ??
    nova.novaEvent(s, p, { paidForCard, generatedForCard, playToken }) ??
    phoenix.phoenixEvent(s, p) ??
    spdr.spdrEvent(s, p, { syncPaid }) ??
    spdrPack.spdrPackEvent(s, p) ??
    spiderHam.spiderHamEvent(s, p) ??
    spiderHamPack.spiderHamPackEvent(s, p) ??
    ironheart.ironheartEvent(s, p, { paid, paidForCard, playToken }) ??
    warlock.warlockEvent(s, p, warlockDiscarded) ??
    nebula.nebulaEvent(s, p, lightningX ?? 0) ??
    spectrum.spectrumEvent(s, p) ??
    gmwPack.gmwPlayerPackEvent(s, p) ??
    starLordPack.starLordPackEvent(s, p) ??
    gamoraPack.gamoraPackEvent(s, p) ??
    draxPack.draxPackEvent(s, p) ??
    venomPack.venomPackEvent(s, p) ??
    mtsPlayerPack.mtsPlayerPackEvent(s, p) ??
    nebulaPack.nebulaPackEvent(s, p) ??
    warmPack.warMachinePackEvent(s, p, warMachinePackReceipt) ??
    valkPack.valkyriePackEvent(s, p, valkyriePackReceipt) ??
    visionPack.visionPackEvent(s, p, {
      meditationCostPaid: visionMeditationCostPaid,
    }) ??
    sinisterPlayerPack.sinisterPlayerPackEvent(s, p, paidForCard ?? paid) ??
    niPack.novaIronheartPackEvent(s, p, paidForCard || []);
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
      mystiqueNativeDrawToHandSize(s, E("mystique-native:draw-to-hand-size"));
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
export function canChangeIdentityForm(
  s: GameState,
  target?: "alter" | "hero" | "tiny" | "giant" | "angel" | "archangel",
) {
  const to = target
    ? target === "alter"
      ? "alter"
      : "hero"
    : s.player.form === "alter"
      ? "hero"
      : ["ant", "wsp", "angel"].includes(s.heroId)
        ? "hero"
        : "alter";
  return (
    !goblinIdentityLocked(s) &&
    storm.stormCanChangeForm(s, to) &&
    !s.flags.antManCannotChangeUntilTurnEnd &&
    sentinels.sentinelsCanChangeForm(
      s,
      s.activePlayerId,
      s.player.form,
      to,
      sentinelsPorts,
    )
  );
}
function flip(
  s: GameState,
  counts = true,
  target?: "alter" | "tiny" | "giant" | "angel" | "archangel",
) {
  const previousForm = s.player.form;
  const wasMutant =
    previousForm === "alter" && captainPackHasTrait(s, "hero", "Mutant");
  if (!canChangeIdentityForm(s, target)) {
    need(
      !counts,
      goblinIdentityLocked(s)
        ? "All Tied Up prevents changing form."
        : !storm.stormCanChangeForm(s, target || "hero")
          ? "Claustrophobia prevents changing to hero form."
          : s.flags.antManCannotChangeUntilTurnEnd
            ? "Care for Cassie prevents changing form."
            : "Targeted for Elimination prevents changing to alter-ego form.",
    );
    return;
  }
  if (counts) need(!s.player.flipped, "You already changed form this turn.");
  if (s.heroId === "angel") {
    const current = angel.angelForm(s);
    if (!target) {
      choose(
        s,
        "Change form",
        "Choose Angel's next form.",
        (["alter", "angel", "archangel"] as const)
          .filter((form) => form !== current && canChangeIdentityForm(s, form))
          .map((form) =>
            option(
              form,
              form === "alter"
                ? "Warren Worthington III"
                : form === "angel"
                  ? "Angel"
                  : "Archangel",
              [E("flip", { counts, target: form })],
              undefined,
              form === "alter"
                ? "42001b"
                : form === "angel"
                  ? "42001a"
                  : "42001c",
            ),
          ),
        counts,
      );
      return;
    }
    need(
      ["alter", "angel", "archangel"].includes(target) && target !== current,
      "Choose a different Angel form.",
    );
    s.player.form = target === "alter" ? "alter" : "hero";
    if (target === "angel" || target === "archangel")
      s.player.angelForm = target;
  } else if (["ant", "wsp"].includes(s.heroId)) {
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
          .filter((form) => form !== current && canChangeIdentityForm(s, form))
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
    if (!canChangeIdentityForm(s, target)) return;
    need(current !== target, "Choose a different form.");
    s.player.form = target === "alter" ? "alter" : "hero";
    if (target === "tiny" || target === "giant") s.player.heroForm = target;
  } else {
    need(
      !target || target === "alter",
      "This identity has only one hero form.",
    );
    s.player.form = s.player.form === "hero" ? "alter" : "hero";
  }
  if (counts) s.player.flipped = true;
  spdr.spdrChangedForm(s, previousForm, s.player.form);
  add(s, ...phoenix.phoenixFormChanged(s));
  add(s, ...rogue.rogueFormChanged(s, wasMutant, roguePorts));
  if (s.player.spiderHamIdentity)
    s.player.spiderHamIdentity.code =
      s.player.form === "hero" ? "30001a" : "30001b";
  const warMachineResponses = warMachine.warMachineFormChanged(
    s,
    previousForm,
    s.player.form,
    warMachinePorts,
  );
  const formToken = `form:${s.nextId++}`;
  add(
    s,
    ...miles.milesFormChanged(
      s,
      {
        token: formToken,
        playerId: s.activePlayerId,
        from: previousForm,
        to: s.player.form,
      },
      milesPorts,
    ),
  );
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
  add(s, ...warMachineResponses);
  add(s, ...wolverine.wolverineFormChanged(s));
  add(s, ...colossus.colossusFormChanged(s, colossusPorts));
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
  if (p.id === sabretooth.sabretoothKelly(s)?.id) return [];
  const c = card(p);
  if (
    c.type_code !== "ally" &&
    /\([^)]*\b(?:attack|thwart|defense|recover)\b/i.test(c.text || "") &&
    magneto.magnetoIdentityRestricted(s, s.activePlayerId, { isTextBlank })
  )
    return [];
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
    ...(c.type_code !== "ally"
      ? wideawake.projectWideawakeActionOptions(s, p.id, wideawakePorts)
      : []),
    ...magneto.magnetoActionOptions(s, p.id, magnetoPorts),
    ...sentinels.sentinelsAbilityOptions(s, p.id, sentinelsPorts),
    ...zzzax.zzzaxActions(s, p, zzzaxPorts),
    ...goblinModuleAttachmentActions(s, p),
    ...mutagenAttachmentActions(s, p),
    ...scarletWitch.scarletWitchAttachmentActions(s, p, scarletPorts),
    ...rocket.rocketAttachmentActions(s, p, rocketPorts),
    ...gamora.gamoraAttachmentActions(s, p, gamoraPorts),
    ...spectrum.spectrumAttachmentOptions(s, p.id, spectrumPorts),
    ...nebula.nebulaAttachmentActions(s, p, nebulaPorts),
    ...valkyrie.valkyrieAttachmentActions(s, p, valkyriePorts),
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
        disabled: p.exhausted
          ? "Exhausted"
          : !p.confused &&
              s.sideSchemes.some((p) => p.code === "32108") &&
              !niAllyTargets(s, p, "thwart").length
            ? "There are no eligible schemes to thwart."
            : undefined,
      },
      ...scriptedOptions,
      ...wideawake
        .projectWideawakeActionOptions(s, p.id, wideawakePorts)
        .map(({ id, label }) => ({ id, label })),
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
        : rulesCode(p) === "01080" &&
            sabretooth.sabretoothKelly(s) &&
            !targets(s, "friendly").some((t) => playerHealingTarget(s, t.id))
          ? "There is no eligible friendly character to heal."
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
  const phoenixBonus = phoenix.phoenixAllyModifiers(s, p);
  const noir = spdrPack.spdrPackAllyStats(s, p, spdrPackPorts);
  return (
    (kind === "thwart" && cable.cableXForceTeam(s, cablePorts) ? 1 : 0) +
    deadpool.deadpoolAllyBonus(s, p) +
    gambit.gambitAllyBonus(s, p, kind) +
    cyclops.cyclopsCharacterModifiers(s, p.id)[kind] +
    (kind === "attack" ? storm.stormGlobal(s).attack : 0) +
    (p.code === "31003" && !isTextBlank(s, p) ? p.counters : 0) +
    (noir ? noir[kind] - (card(p)[kind] || 0) : 0) +
    (card(p)[kind] || 0) +
    phoenixBonus[kind] +
    (kind === "attack"
      ? mansionAttack.mansionAttackModifiers(s, p, { isTextBlank }).attack
      : 0) +
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
    vision.visionAllyStats(s, p)[kind] +
    niPack.novaIronheartPackCharacterModifiers(s, p.id, niPackPorts)[kind] +
    (kind === "attack"
      ? mgPack.mutantGenesisPlayerPackCharacterModifiers(s, p.id, {
          isTextBlank,
        }).attack
      : 0) +
    (kind === "attack"
      ? spiderHamPack.spiderHamPackCharacterModifiers(s, p.id).attack
      : 0) +
    scriptedModifier(s, kind, p) +
    antPack.antManPackModifiers(s, p.id, { maxAllyHP: pieceHP })[kind] +
    starLordPack.starLordPackModifiers(s, p.id, starLordPackPorts)[kind] +
    mtsPlayerPack.mtsPlayerPackModifiers(s, p.id, mtsPlayerPackPorts)[kind] +
    (kind === "attack"
      ? nebulaPack.nebulaPackModifiers(s, p.id, nebulaPackPorts).attack
      : 0) +
    (kind === "attack"
      ? warmPack.warMachinePackAllyModifiers(s, p, warMachinePackPorts).attack
      : 0) +
    nebula.nebulaNamedCharacterModifiers(s, card(p).name)[kind] +
    (kind === "attack"
      ? s.attachments
          .filter(
            (attachment) =>
              attachment.code === "22030" && attachment.attachedTo === p.id,
          )
          .reduce(
            (total, attachment) => total + (card(attachment).attack || 0),
            0,
          )
      : 0) +
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
  need(
    !deadpool.deadpoolTriggeredBlocked(s),
    "The Merc with the Mouth prevents another player’s triggered card abilities during this turn.",
  );
  const deadpoolOptions = deadpool.deadpoolAbilityOptions(s, id, deadpoolPorts);
  const deadpoolSelected =
    action === "special"
      ? deadpoolOptions[0]
      : deadpoolOptions.find((o) => o.id === action);
  if (deadpoolSelected) {
    add(s, ...deadpoolSelected.effects);
    return;
  }
  const cableOptions = cable.cableAbilityOptions(s, id, cablePorts);
  const cableSelected =
    action === undefined
      ? cableOptions[0]
      : cableOptions.find((o) => o.id === action);
  if (cableSelected) {
    add(s, ...cableSelected.effects);
    return;
  }
  const x23Options = x23.x23AbilityOptions(s, id, x23Ports);
  const x23Selected =
    action === "special"
      ? x23Options[0]
      : x23Options.find((o) => o.id === action);
  if (x23Selected) {
    add(s, ...x23Selected.effects);
    return;
  }
  const angelOptions = angel.angelAbilityOptions(s, id, angelPorts);
  const angelSelected =
    action === "special"
      ? angelOptions[0]
      : angelOptions.find((o) => o.id === action);
  if (angelSelected) {
    add(s, ...angelSelected.effects);
    return;
  }
  const stormOptions = storm.stormAbilityOptions(s, id, stormPorts);
  const stormSelected =
    action === "special"
      ? stormOptions[0]
      : stormOptions.find((o) => o.id === action);
  if (stormSelected) {
    add(s, ...stormSelected.effects);
    return;
  }
  const magneticActions = magneto.magnetoActionOptions(s, id, magnetoPorts);
  const magneticSelected =
    action === "special"
      ? magneticActions[0]
      : magneticActions.find((o) => o.id === action);
  if (magneticSelected) {
    add(s, ...magneticSelected.effects);
    return;
  }
  const actionSource = find(s, id);
  need(
    !(
      actionSource &&
      card(actionSource).type_code !== "ally" &&
      /\([^)]*\b(?:attack|thwart|defense|recover)\b/i.test(
        card(actionSource).text || "",
      ) &&
      magneto.magnetoIdentityRestricted(s, s.activePlayerId, { isTextBlank })
    ),
    "Wrapped in Metal prevents this identity from using this ability.",
  );
  if (!["attack", "thwart"].includes(action)) {
    const native = wideawake.projectWideawakeActionOptions(
      s,
      id,
      wideawakePorts,
    );
    const selected =
      action === "special" ? native[0] : native.find((o) => o.id === action);
    if (selected) {
      add(s, ...selected.effects);
      return;
    }
  }
  need(
    id !== sabretooth.sabretoothKelly(s)?.id ||
      !["attack", "thwart"].includes(action),
    "Robert Kelly has no basic ATK or THW power.",
  );
  const sabretoothAttachment = s.attachments.find(
    (p) => p.id === id && ["32067", "32068"].includes(p.code),
  );
  if (sabretoothAttachment) {
    const options = sabretooth.sabretoothActionOptions(s, id, sabretoothPorts);
    const selected =
      action === "special" ? options[0] : options.find((o) => o.id === action);
    need(
      selected,
      "This Sabretooth Hero Action requires energy, mental and physical resources.",
    );
    add(s, ...selected!.effects);
    return;
  }
  if (
    mgPack.mutantGenesisPlayerPackAbility(
      s,
      id,
      mutantGenesisPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  const moduleSource = find(s, id);
  if (moduleSource) {
    const effects = ironspider.ironspiderSinisterActionEffects(
      s,
      moduleSource,
      action,
      ironspiderPorts,
    );
    if (effects) {
      add(s, ...effects);
      return;
    }
  }
  const zzzaxSource = find(s, id);
  if (zzzaxSource) {
    const effects = zzzax.zzzaxActionEffects(
      s,
      zzzaxSource,
      action,
      zzzaxPorts,
    );
    if (effects !== null) {
      add(s, ...effects);
      return;
    }
  }
  if (
    miles.milesAbility(
      s,
      id,
      milesPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (ghostSpider.ghostSpiderAbility(s, id, ghostSpiderPorts, action)) return;
  if (id === "identity" && nova.novaHeroAbility(s, novaPorts, action)) return;
  if (nova.novaAbility(s, id, novaPorts, action)) return;
  const dominoAbility = domino.dominoAbility(
    s,
    id,
    action === "special" ? undefined : action,
    dominoPorts,
  );
  if (dominoAbility !== null) {
    add(s, ...dominoAbility);
    return;
  }
  const gambitAbility = gambit.gambitAbility(
    s,
    id,
    action === "special" ? undefined : action,
    gambitPorts,
  );
  if (gambitAbility !== null) {
    add(s, ...gambitAbility);
    return;
  }
  const cyclopsAbility = cyclops.cyclopsAbility(
    s,
    id,
    cyclopsPorts,
    action === "special" ? undefined : action,
  );
  if (cyclopsAbility !== null) {
    add(s, ...cyclopsAbility);
    return;
  }
  const psylockeAbility = psylocke.psylockeAbility(
    s,
    id,
    action,
    psylockePorts,
  );
  if (psylockeAbility !== null) {
    add(s, ...psylockeAbility);
    return;
  }
  const wolverineAbility = wolverine.wolverineAbility(
    s,
    id,
    action,
    wolverinePorts,
  );
  if (wolverineAbility !== null) {
    add(s, ...wolverineAbility);
    return;
  }
  const colossusAbility = colossus.colossusAbility(
    s,
    id,
    colossusPorts,
    action === "special" ? undefined : action,
  );
  if (colossusAbility !== null) {
    add(s, ...colossusAbility);
    return;
  }
  const rogueOption = rogue
    .rogueAbilityOptions(s, id, roguePorts)
    .find((o) => o.id === action);
  if (rogueOption) {
    add(s, ...rogueOption.effects);
    return;
  }
  const phoenixAbility = phoenix.phoenixAbility(s, id, action, phoenixPorts);
  if (phoenixAbility !== null) {
    add(s, ...phoenixAbility);
    return;
  }
  const spdrAbility = spdr.spdrAbility(
    s,
    id,
    action === "special" ? undefined : action,
    spdrPorts,
  );
  if (spdrAbility !== null) {
    add(s, ...spdrAbility);
    return;
  }
  const spiderHamAbility = spiderHam.spiderHamAbility(
    s,
    id,
    action === "special" ? undefined : action,
    spiderHamPorts,
  );
  if (spiderHamAbility !== null) {
    add(s, ...spiderHamAbility);
    return;
  }
  if (
    spiderHamPack.spiderHamPackAbility(
      s,
      id,
      spiderHamPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    ironheart.ironheartAbility(
      s,
      id === "identity" ? "hero" : id,
      ironheartPorts,
    )
  )
    return;
  const niAbility = niPack.novaIronheartPackAbility(
    s,
    id,
    action ||
      niPack.novaIronheartPackAbilityOptions(s, id, niPackPorts)[0]?.id ||
      "",
    niPackPorts,
  );
  if (niAbility !== null) {
    add(s, ...niAbility);
    return;
  }
  if (
    sinisterPlayerPack.sinisterPlayerPackAbility(
      s,
      id,
      sinisterPlayerPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    visionPack.visionPackAbility(
      s,
      id,
      visionPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  const visionAbilitySource = find(s, id);
  if (
    shadowcat.shadowcatAbility(
      s,
      id,
      shadowcatPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    visionAbilitySource &&
    ["upgrade", "support"].includes(card(visionAbilitySource).type_code) &&
    card(visionAbilitySource).text?.includes("(attack)")
  )
    need(
      vision.visionCanAttack(s),
      "Vision cannot attack in Intangible mass form.",
    );
  if (
    vision.visionAbility(
      s,
      id,
      visionPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    valkPack.valkyriePackAbility(
      s,
      id,
      valkyriePackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    valkyrie.valkyrieAbility(
      s,
      id,
      valkyriePorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    warMachine.warMachineAbility(
      s,
      id,
      warMachinePorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    nebulaPack.nebulaPackAbility(
      s,
      id,
      nebulaPackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
  if (
    warmPack.warMachinePackAbility(
      s,
      id,
      warMachinePackPorts,
      action === "special" ? undefined : action,
    )
  )
    return;
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
      if (rulesCode(x) === "01080" && sabretooth.sabretoothKelly(s))
        need(
          targets(s, "friendly").some((t) => playerHealingTarget(s, t.id)),
          "There is no eligible friendly character to heal.",
        );
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
    const actual = find(s, id);
    if (actual && wideawakeCaptive(actual)) actual.ownerId = playerId;
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
    ...spiderHamNativePhysicsOptions(s, { ...packet, amount }, [packet]),
    ...warmPackDamageOptions(s, { ...packet, amount }, [packet]),
    ...visionPackNativeDamageOptions(s, { ...packet, amount }, [packet]),
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
      .filter(
        (p) => !isTextBlank(s, p) && !(p.code === "34030" && p.counters === 0),
      )
      .map(card),
  ];
  return (
    deadpool.deadpoolPlayerIcons(s, "scheme_amplify") +
    definitions.filter(
      (c) => (c as Card & { scheme_amplify?: boolean }).scheme_amplify,
    ).length
  );
}
function activationBoostValue(s: GameState, id: string, code?: string): number {
  if (!s.scheming && s.attack?.angelIgnoreBoosts) return 0;
  const activation = s.scheming || s.attack;
  const printedCode = code || s.resolving.find((p) => p.id === id)?.code;
  return (
    activation?.boostValues?.[id] ??
    (printedCode ? card(printedCode).boost || 0 : 0)
  );
}
function countActivationBoost(s: GameState, id: string, after: Effect[]): void {
  const p =
    s.resolving.find((piece) => piece.id === id) ||
    find(s, id) ||
    s.encounter.dealt.find(
      (piece) => piece.id === id && piece.code === "32106",
    );
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
function warmPackDamageOptions(s: GameState, packet: Effect, after: Effect[]) {
  const original = s.activePlayerId;
  const target = packet.target === "hero" ? `hero:${original}` : packet.target;
  const attacker = packet.attacker || s.attack?.attacker || packet.source;
  const actual = { ...packet, target, attacker, damageOwnerId: original };
  return playerOrder(s).flatMap((seat) =>
    warmPack
      .warMachinePackDamageOptions(
        seatView(s, seat),
        actual,
        after.map((e) => ({ ...e, actorId: original })),
        warMachinePackPorts,
      )
      .map((o) => ({
        ...o,
        id: `${seat.id}:${o.id}:${packet.kind || "attack"}:${target}`,
        label: `${o.label} · ${target.startsWith("hero:") ? heroCard(seatView(s, target.slice(5))).name : card(find(s, target)!).name}`,
        effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
      })),
  );
}
function visionPackNativeDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
) {
  const original = s.activePlayerId;
  const target = packet.target === "hero" ? `hero:${original}` : packet.target;
  const owner = target?.startsWith("hero:")
    ? s.players.find((seat) => seat.id === target.slice(5))
    : controller(s, target);
  if (!owner) return [];
  const inAttack =
    packet.kind === "attack" || packet.kind === "overkill" || !!packet.inAttack;
  const options = visionPack
    .visionPackDamageOptions(
      seatView(s, owner),
      {
        target,
        amount: packet.amount,
        source: packet.attacker || packet.retaliateSource || packet.source,
        attack: !!packet.attack,
        inAttack,
        packet,
      },
      after.map((e) => ({ ...e, actorId: original })),
      visionPackPorts,
    )
    .map((o) => ({
      ...o,
      id: `vision:${owner.id}:${o.id}`,
      effects: o.effects.map((e) => ({ ...e, actorId: owner.id })),
    }));
  return [...options, ...sinisterNativeDamageOptions(s, packet, after)];
}
function allyUpgradeTargets(s: GameState, p: Piece) {
  const cyclopsTargets = cyclops.cyclopsAttachmentTargets(s, p, cyclopsPorts);
  if (cyclopsTargets !== null) return cyclopsTargets;
  return rawAllyUpgradeTargets(s, p).filter((t) =>
    playerAttachmentTarget(s, p, t.id),
  );
}
function rawAllyUpgradeTargets(s: GameState, p: Piece) {
  const phoenixTargets = phoenix.phoenixAttachmentTargets(s, p, phoenixPorts);
  if (phoenixTargets !== null) return phoenixTargets;
  const mutantTargets = mgPack.mutantGenesisPlayerPackAttachmentTargets(
    s,
    p,
    mutantGenesisPackPorts,
  );
  if (mutantTargets !== null) return mutantTargets;
  const shadowcatTargets = shadowcat.shadowcatAttachmentTargets(
    s,
    p,
    shadowcatPorts,
  );
  if (shadowcatTargets !== null) return shadowcatTargets;
  if (p.code === "26034")
    return visionPack.visionPackAttachmentTargets(s, p) || [];
  if (["23035", "40030"].includes(p.code))
    return warmPack.warMachinePackAttachmentTargets(s, p) || [];
  if (["22032", "22035"].includes(p.code))
    return nebulaPack.nebulaPackAttachmentTargets(s, p.code, nebulaPackPorts);
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
      controller(s, x.id)?.id === s.activePlayerId,
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
    const cards = mill(s, n);
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
    if (status === "tough") {
      colossusNativeDiscardTough(s, [{ targetId: target, amount: 1 }], []);
      return;
    }
    const key = status === "stunned" ? "stunCards" : "confuseCards";
    piece![key] = Math.max(
      0,
      Number(piece![key] ?? Number(piece![status])) - 1,
    );
    syncStatuses(
      piece!,
      target === "hero" || target.startsWith("hero:")
        ? heroCard(v)
        : card(find(s, target)!),
      nativeStatusModifiers(s, piece!),
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
        target === "hero" || target.startsWith("hero:")
          ? {
              stalwart: !!sourceKeyword(v, "hero", "Stalwart"),
              toughLimit: colossus.colossusToughLimit(v, colossusPorts),
              steady: spdrPack.spdrPackCharacterSteady(v, "hero", {
                isTextBlank,
              }),
            }
          : nativeStatusModifiers(s, piece),
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
      !engaged(s).some((p) => keyword(p, "Patrol", s)) &&
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
    if (
      !s.flags.spdrGiantThwartCostPaid &&
      packets.some(
        (packet) =>
          packet.amount > 0 &&
          s.sideSchemes.some(
            (p) =>
              p.id === packet.target &&
              p.code === "31026" &&
              !isTextBlank(s, p),
          ),
      )
    ) {
      requestPayment(
        s,
        "Giant Monster Attack · additional thwart cost",
        1,
        [E("spdrDistributedThwart", { packets, spdrThwartCostPaid: true })],
        ["energy"],
        undefined,
        false,
      );
      return;
    }
    const legal = targets(s, "scheme", false, true);
    need(
      packets.every(
        (p) => p.amount >= 0 && legal.some((x) => x.id === p.target),
      ),
      "Invalid threat distribution.",
    );
    const defeated: Piece[] = [];
    const receipts: spiderHamPack.SpiderHamPackThwartReceipt[] = [];
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
      if (removed > 0)
        receipts.push({
          token: `thwart:${s.nextId++}`,
          playerId: s.activePlayerId,
          sourceId: "hero",
          target: packet.target,
          amount: removed,
          performed: true,
          thwart: true,
        });
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
      ...receipts.map((receipt) =>
        E("spiderHamSchemeThwartInterrupts", { receipt }),
      ),
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
    if (
      !s.flags.spdrGiantThwartCostPaid &&
      packets.some(
        (packet) =>
          packet.amount > 0 &&
          s.sideSchemes.some(
            (p) =>
              p.id === packet.target &&
              p.code === "31026" &&
              !isTextBlank(s, p),
          ),
      )
    ) {
      requestPayment(
        s,
        "Giant Monster Attack · additional thwart cost",
        1,
        [
          E("spdrDistributedThwart", {
            packets,
            metadata,
            wasp: true,
            spdrThwartCostPaid: true,
          }),
        ],
        ["energy"],
        undefined,
        false,
      );
      return;
    }
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
      ...spiderHamPack.spiderHamPackBasicThwartEnded(
        s,
        (metadata as Effect) || E("thwart"),
        removedAllThreat,
      ),
      ...venomPack.venomPackBasicThwartEnded(
        s,
        (metadata as Effect) || E("thwart"),
        removedAllThreat,
      ),
      E("scarletHeroThwartResponse", {
        snapshot: {
          playerId: s.activePlayerId,
          source: "hero",
          thwart: true,
          basic: !!metadata,
          removedAllThreat,
          wasHero: s.player.form === "hero",
          beforeThreat: removedAllThreat ? 1 : 0,
          removed: removedAllThreat ? 1 : 0,
        },
      }),
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
  patrolBlocksMain: (s) =>
    !shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts) &&
    engaged(s).some((p) => keyword(p, "Patrol", s)),
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
    need(
      !armadillo.armadilloDefenseBlocked(s, a.attacker),
      "Rollin’, Rollin’ prevents characters from defending this attack.",
    );
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
      ?.is_unique,
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
    const p = find(s, id);
    need(p, "The defeated ally is no longer in play.");
    if (p!.id === sabretooth.sabretoothKelly(s)?.id || p!.code === "32088b") {
      movePieceFromPlay(s, id, false);
      return;
    }
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
const nebulaPackPorts: nebulaPack.NebulaPackPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  friendlyTargets: (s) => targets(s, "friendly"),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  canGiveStatus: dsPorts.canAddStatus,
  canReady: (s, target) =>
    target === "hero"
      ? s.player.exhausted && canReadyIdentity(s)
      : target.startsWith("hero:")
        ? seatView(s, target.slice(5)).player.exhausted &&
          canReadyIdentity(seatView(s, target.slice(5)))
        : !!find(s, target)?.exhausted,
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, exclude, code) => canPay(s, cost, [], exclude, code),
  heroThwart: (s) => heroStats(s).thwart,
  discardPiece,
  attach: attachPackUpgrade,
  transferControl: hulkPackPorts.transferControl,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  revealHidden,
  revealEncounterFromDeck: (s, id, after) => {
    const i = s.encounter.deck.findIndex(
      (p) => p.id === id && card(p).type_code === "side_scheme",
    );
    need(i >= 0, "The selected encounter side scheme is unavailable.");
    const [piece] = s.encounter.deck.splice(i, 1);
    add(s, E("reveal", { piece, fromEncounterDeck: true }), ...after);
  },
  discardPlayerTop: (s, playerId) => {
    // A seat view shares zones but copies scalar RNG/hidden-information state.
    // Commit the physical discard/reset against the actual global game.
    const previous = s.activePlayerId;
    activateSeat(s, playerId);
    try {
      return discardNativePlayerTop(s).piece;
    } finally {
      activateSeat(s, previous);
    }
  },
  discardEncounterTop: (s) => mutagenPorts.discardTop(s).piece,
  canCancelBoostAbility: (s, p) =>
    !!(s.attack || s.scheming) &&
    bwPorts.hasBoostAbility(s, p.id) &&
    !/cannot be cancel(?:ed|led)/i.test(card(p).text || ""),
  cancelBoostAbility: bwPorts.cancelBoostAbility,
};
const warMachinePackPorts: warmPack.WarMachinePackPorts = {
  queue: add,
  choose,
  isTextBlank,
  characters: (s) =>
    playerOrder(s).flatMap((seat) => {
      const view = seatView(s, seat);
      return [
        {
          id: `hero:${seat.id}`,
          label: heroCard(view).name,
          code: heroCard(view).code,
          name: heroCard(view).name,
          playerId: seat.id,
          type:
            view.player.form === "hero"
              ? ("hero" as const)
              : ("alter_ego" as const),
          exhausted: view.player.exhausted,
        },
        ...view.player.inPlay
          .filter((p) => card(p).type_code === "ally")
          .map((p) => ({
            id: p.id,
            label: card(p).name,
            code: p.code,
            name: card(p).name,
            playerId: seat.id,
            type: "ally" as const,
            exhausted: p.exhausted,
          })),
      ];
    }),
  hasTrait: captainPackHasTrait,
  characterAttack: (s, id) => {
    if (id.startsWith("hero:")) {
      const view = seatView(s, id.slice(5));
      return view.player.form === "hero" ? heroStats(view).attack : 0;
    }
    const p = find(s, id),
      seat = controller(s, id);
    return p && seat ? allyStat(seatView(s, seat), p, "attack") : 0;
  },
  exhaustCharacter: (s, id) => {
    const p = id.startsWith("hero:")
      ? seatView(s, id.slice(5)).player
      : find(s, id);
    if (!p || p.exhausted) return false;
    p.exhausted = true;
    return true;
  },
  canReady: (s, id) =>
    id.startsWith("hero:")
      ? canReadyIdentity(seatView(s, id.slice(5)))
      : !!find(s, id) &&
        !allInPlay(s).some(
          (p) =>
            p.code === "21083" && p.attachedTo === id && !isTextBlank(s, p),
        ),
  canDiscardAlly: (s, p) =>
    s.player.inPlay.some((a) => a.id === p.id) &&
    card(p).type_code === "ally" &&
    !isPermanent(card(p)),
  canPutAlly: (s, p) =>
    card(p).type_code === "ally" && !uniqueConflict(s, card(p)),
  canPutUpgrade: (s, p) =>
    !x23.x23PlayRestriction(s, p, x23Ports, true) &&
    card(p).type_code === "upgrade" &&
    !isPermanent(card(p)) &&
    !uniqueConflict(s, card(p)) &&
    !(
      card(p).text?.includes("Max 1 per player") &&
      s.player.inPlay.some((a) => card(a).name === card(p).name)
    ),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPayKeepingHandAlly: (s, event, ally) => {
    const cost = cardCost(s, card(event), event),
      reduced = starLord.starLordCanReduceHandCost(s, event, cost)
        ? Math.max(0, cost - 3)
        : cost;
    const sources = paymentSources(s, event.id, event.code).filter(
      (source) => source.id !== ally.id,
    );
    return paymentStatus(
      sources,
      sources.map((source) => source.id),
      reduced,
      [],
    ).ready;
  },
  canPay: (s, cost, exclude, code, alliance) =>
    alliance
      ? canPayAlliance(s, cost, [], exclude, code)
      : canPay(s, cost, [], exclude, code),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  discardPiece,
  putAllyFromHand: (s, id, after) => {
    putAllyFromHand(s, id);
    const entry = s.queue.findIndex(
      (e) => e.type === "allyEnter" && e.id === id,
    );
    if (entry >= 0)
      s.queue.splice(entry + 1, 0, ...after.map((e) => effectContext(s, e)));
    else add(s, ...after);
  },
  putUpgradeFromDeck: (s, id, after) => {
    const i = s.player.deck.findIndex(
      (p) => p.id === id && warMachinePackPorts.canPutUpgrade(s, p),
    );
    need(i >= 0, "The actual Tech upgrade is no longer available.");
    const before = maxHP(s),
      [p] = s.player.deck.splice(i, 1);
    Object.assign(p, resetPiece(p, true));
    s.player.inPlay.push(p);
    s.player.hp += maxHP(s) - before;
    rogue.rogueCardEntered(s, p, false);
    miles.milesCardEntered(s, p);
    add(s, ...ghostSpider.ghostSpiderCardEntered(s, p));
    add(
      s,
      ...psylocke.psylockeCardEntered(s, p),
      ...angel.angelCardEntered(s, p),
      ...cable.cableCardEntered(s, p),
      ...x23.x23Entered(s, p),
      ...deadpool.deadpoolCardEntered(s, p),
      ...cyclops.cyclopsCardEntered(s, p),
      ...wolverine
        .wolverineCardEntered(s, p, false)
        .filter(() => !["35003", "35014"].includes(p.code)),
      ...colossus.colossusCardEntered(s, p),
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
      ...warmPack.warMachinePackCardEntered(s, p),
      ...valkPack.valkyriePackCardEntered(s, p),
      ...visionPack.visionPackCardEntered(s, p),
      ...niPack.novaIronheartPackCardEntered(s, p),
      ...sinisterPlayerPack.sinisterPlayerPackCardEntered(s, p),
      ...captainPackCardEntered(s, p),
      ...hulkPackCardEntered(s, p),
      ...msMarvelCardEntered(s, p),
      ...thorCardEntered(s, p),
      ...doctorStrangeCardEntered(s, p),
      ...hawkeyeCardEntered(s, p),
      ...after,
    );
  },
  discardPlayerCards: (s, count, continuation) => {
    const before = s.queue.length,
      discarded = mill(s, count),
      exhaustion = s.queue.splice(0, s.queue.length - before);
    add(s, ...exhaustion, { ...continuation, discarded });
  },
  shufflePlayerDeck: (s, after) => {
    hawkeyePorts.shufflePlayerDeck(s);
    add(s, ...after);
  },
  revealHidden,
  attackProgram: (s, effects, after) =>
    bwPorts.attackProgram(s, effects, after),
  preventAttackDamage: (s, packet, amount) => {
    const view = packet.damageOwnerId ? seatView(s, packet.damageOwnerId) : s;
    preventNativeIdentityDamage(view, packet, amount);
  },
};
const valkyriePackPorts: valkPack.ValkyriePackPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  characters: warMachinePackPorts.characters,
  characterThwart: (s, id) => {
    if (id.startsWith("hero:")) {
      const view = seatView(s, id.slice(5));
      return view.player.form === "hero" ? heroStats(view).thwart : 0;
    }
    const p = find(s, id),
      seat = controller(s, id);
    return p && seat ? allyStat(seatView(s, seat), p, "thwart") : 0;
  },
  exhaustCharacter: warMachinePackPorts.exhaustCharacter,
  canReady: warMachinePackPorts.canReady,
  canDiscardPiece: (s, p) =>
    !isPermanent(card(p)) && valkyrie.valkyrieCanDiscardAttachment(s, p),
  discardPiece,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwarting) =>
    captainThwartBlocked(s) && thwarting
      ? []
      : targets(s, "scheme", false, thwarting),
  heroAttack: (s, target, attacking) =>
    heroStats(s).attack +
    (attacking && target
      ? valkyrie.valkyrieAttackBonusForTarget(s, target)
      : 0),
  maxHeroHP: maxHP,
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, requirements = [], exclude, code, alliance) =>
    alliance
      ? canPayAlliance(s, cost, requirements, exclude, code)
      : canPay(s, cost, requirements, exclude, code),
  revealHidden,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  shufflePlayerDeck: (s, after) => warMachinePortsShufflePlayer(s, after),
  canPutMinion: (s, p) => valkyriePorts.canPutMinion(s, p),
  putMinion: (s, id, playerId, after) =>
    valkyriePorts.putMinion(s, id, playerId, after),
  canPlayDeckAlly: (s, p) => {
    if (
      !s.player.deck.some((a) => a.id === p.id) ||
      card(p).type_code !== "ally"
    )
      return false;
    return !playable(
      {
        ...s,
        prompt: null,
        review: null,
        phase: "player",
        turnPlayerId: s.activePlayerId,
      },
      p,
    );
  },
  playDeckAlly: (s, id, after) => {
    const p = s.player.deck.find((p) => p.id === id);
    need(
      p && valkyriePackPorts.canPlayDeckAlly(s, p),
      "The Bifrost needs its actual playable deck ally.",
    );
    const continuation = after.map((e) => effectContext(s, e));
    requestPayment(
      s,
      `The Bifrost · ${card(p!).name}`,
      cardCost(s, card(p!), p),
      [E("play", { piece: p, fromDeck: true }), ...continuation],
      [],
      p,
      true,
      p!.code,
    );
    if (s.prompt?.cancelable)
      s.prompt.cancellationQueue = [...continuation, ...s.queue];
  },
  attackProgram: (s, effects, after) =>
    bwPorts.attackProgram(s, effects, after),
  thwartBatch: (s, ids, amount, after) => {
    const before = s.queue.length;
    waspPorts.thwartDistribution(
      s,
      ids.map((target) => ({ target, amount })),
    );
    const generated = s.queue.splice(0, s.queue.length - before);
    add(s, ...generated, ...after);
  },
  allyAttackBatch: (s, allyId, targetIds, after) => {
    const key = `valkPackThorPacket:${allyId}`;
    const original: Effect = JSON.parse(String(s.flags[key] || "{}"));
    delete s.flags[key];
    const ally = s.player.inPlay.find((p) => p.id === allyId);
    if (!ally) {
      add(s, ...after);
      return;
    }
    const bonus =
      Number(original.amount ?? allyStat(s, ally, "attack")) -
      allyStat(s, ally, "attack");
    bwPorts.attackProgram(
      s,
      targetIds.map((target) =>
        E("valkPackThorAttackPacket", {
          ...original,
          type: "valkPackThorAttackPacket",
          id: allyId,
          target,
          extraAmount: bonus,
        }),
      ),
      [
        E("allyResponse", { id: allyId, attack: true }),
        E("allyConsequence", {
          id: allyId,
          attack: true,
          amount: starLordPack.starLordPackConsequentialDamage(
            original,
            (card(ally).attack_cost || 0) +
              captainPackModifiers(s, allyId).consequentialAttack,
          ),
        }),
        E("scarletAfterAllyAttack", { id: allyId }),
        ...after,
      ],
    );
  },
  useAttackForDefense: (s) => {
    if (!s.attack || s.attack.defender !== "hero") return;
    s.attack.valkyriePackAttackDefensePlayerId = s.activePlayerId;
    s.attack.defense = heroStats(s).attack;
  },
  usesAttackForDefense: (s) =>
    s.attack?.defender === "hero" &&
    s.attack.valkyriePackAttackDefensePlayerId === s.activePlayerId,
  discardIdentityStatus: (s, status) => dsPorts.removeStatus(s, "hero", status),
};

const visionPackPorts: visionPack.VisionPackPorts = {
  queue: add,
  choose,
  isTextBlank,
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, exclude, code, requirements = [], alliance) =>
    alliance
      ? canPayAlliance(s, cost, requirements, exclude, code)
      : canPay(s, cost, requirements, exclude, code),
  maxHeroHP: (s, id) => maxHP(seatView(s, id)),
  canReady: warMachinePackPorts.canReady,
  hasTrait: captainPackHasTrait,
  friendlyTargets: (s) => targets(s, "friendly"),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  canPutAlly: (s, p, playerId) =>
    seatView(s, playerId).player.hand.some((a) => a.id === p.id) &&
    card(p).type_code === "ally" &&
    !uniqueConflict(s, card(p)),
  canPayKeepingAllies: (s, event, allies) => {
    const held = new Set(allies.map((p) => p.id));
    const sources = paymentSources(s, event.id, event.code, false, true).filter(
      (source) => !held.has(source.localId || source.id),
    );
    const cost = cardCost(s, card(event), event);
    const reduced = starLord.starLordCanReduceHandCost(s, event, cost)
      ? Math.max(0, cost - 3)
      : cost;
    return suggestPayment(sources, reduced, []) !== null;
  },
  canPlayWithDiscount: (s, p, discount) =>
    antPackPorts.playableWithDiscount(s, p, discount),
  playFromHandDiscount: (s, id, discount, after) =>
    add(s, E("visionPackMeditationPlay", { id, discount, after })),
  putAlliesFromHand: (s, allies, after) => {
    const original = s.activePlayerId;
    const before = s.queue.length;
    for (const entry of allies) {
      const p = seatView(s, entry.playerId).player.hand.find(
        (p) => p.id === entry.id,
      );
      need(
        p && visionPackPorts.canPutAlly(s, p, entry.playerId),
        "Joining Forces needs its actual eligible hand allies.",
      );
    }
    const generated: Effect[] = [];
    try {
      for (const entry of allies) {
        activateSeat(s, entry.playerId);
        putAllyFromHand(s, entry.id);
        generated.push(...s.queue.splice(0, s.queue.length - before));
      }
    } finally {
      activateSeat(s, original);
    }
    add(s, ...generated, ...after);
  },
  transferControl: hulkPackPorts.transferControl,
  attach: attachPackUpgrade,
  discardPiece,
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  revealHidden,
  canUseDefense: (s, _p, inAttack) =>
    s.player.form === "hero" && (!inAttack || vision.visionCanDefend(s)),
  pendingBoosts: (s) => s.attack?.pendingBoosts || [],
  discardBoostBeforeFlip: (s, id) => {
    const pending = s.attack?.pendingBoosts;
    const index = pending?.findIndex((p) => p.id === id) ?? -1;
    need(pending && index >= 0, "The actual facedown boost is unavailable.");
    s.encounter.discard.push(resetPiece(pending!.splice(index, 1)[0]));
  },
  claimDefense: (s, packet) =>
    gamoraPorts.claimDefense(
      s,
      packet || E("attackDamage", { kind: "attack", target: "hero" }),
    ),
  preventDamage: (s, amount, packet) =>
    preventNativeIdentityDamage(s, packet, amount),
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
          ...(heroCard(view).traits || "")
            .replace(/\.$/, "")
            .split(/\.\s+/)
            .filter(Boolean),
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
  discardPlayerCards: (s, count) => {
    const before = s.queue.length;
    const pieces = mill(s, count);
    const responses = s.queue.splice(0, s.queue.length - before);
    return { pieces, responses };
  },
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
    if (status === "tough") {
      colossusNativeDiscardTough(
        s,
        [{ targetId: `hero:${s.activePlayerId}`, amount: 1 }],
        [],
      );
      return true;
    }
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
  canChangeForm: (s) => canChangeIdentityForm(s, "hero"),
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
      !(thwarting && engaged(s).some((p) => keyword(p, "Patrol", s))) &&
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
      s.attack.defense =
        heroStats(s).defense +
        valkyrie.valkyrieDefenseBonusForAttacker(s, s.attack.attacker) +
        (s.attack.defenseBonus || 0);
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
    if (p!.code === "32088b") {
      discardPiece(s, id);
      return;
    }
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
    !(
      deadpool.deadpoolPlayerIcons(s, "scheme_crisis") > 0 ||
      s.sideSchemes.some((p) => card(p).scheme_crisis)
    ) &&
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
  if (deadpool.deadpoolTriggeredBlocked(s)) return [];
  return [
    ...cable.cableAbilityOptions(s, id, cablePorts),
    ...x23.x23AbilityOptions(s, id, x23Ports),
    ...deadpool.deadpoolAbilityOptions(s, id, deadpoolPorts),
    ...angel.angelAbilityOptions(s, id, angelPorts),
    ...storm.stormAbilityOptions(s, id, stormPorts),
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
    ...(s.attachments.find((p) => p.id === id)
      ? nebula.nebulaAttachmentActions(
          s,
          s.attachments.find((p) => p.id === id)!,
          nebulaPorts,
        )
      : []),
    ...warlock.warlockAbilityOptions(s, id, warlockPorts),
    ...warMachine.warMachineAbilityOptions(s, id, warMachinePorts),
    ...valkyrie.valkyrieAbilityOptions(s, id, valkyriePorts),
    ...vision.visionAbilityOptions(s, id, visionPorts),
    ...shadowcat.shadowcatAbilityOptions(s, id, shadowcatPorts),
    ...miles.milesAbilityOptions(s, id, milesPorts),
    ...ghostSpider.ghostSpiderAbilityOptions(s, id, ghostSpiderPorts),
    ...(id === "identity" ? nova.novaHeroAbilityOptions(s, novaPorts) : []),
    ...nova.novaAbilityOptions(s, id, novaPorts),
    ...domino.dominoAbilityOptions(s, id, dominoPorts),
    ...gambit.gambitAbilityOptions(s, id, gambitPorts),
    ...cyclops.cyclopsAbilityOptions(s, id, cyclopsPorts),
    ...psylocke.psylockeAbilityOptions(s, id, psylockePorts),
    ...wolverine.wolverineAbilityOptions(s, id, wolverinePorts),
    ...colossus.colossusAbilityOptions(s, id, colossusPorts),
    ...sabretooth.sabretoothActionOptions(s, id, sabretoothPorts),
    ...(find(s, id)
      ? ironspider.ironspiderSinisterActions(s, find(s, id)!, ironspiderPorts)
      : []),
    ...rogue.rogueAbilityOptions(s, id, roguePorts),
    ...phoenix.phoenixAbilityOptions(s, id, phoenixPorts),
    ...spdr.spdrAbilityOptions(s, id, spdrPorts),
    ...mgPack.mutantGenesisPlayerPackAbilityOptions(
      s,
      id,
      mutantGenesisPackPorts,
    ),
    ...spiderHam.spiderHamAbilityOptions(s, id, spiderHamPorts),
    ...spiderHamPack.spiderHamPackAbilityOptions(s, id, spiderHamPackPorts),
    ...ironheart.ironheartAbilityOptions(
      s,
      id === "identity" ? "hero" : id,
      ironheartPorts,
    ),
    ...niPack.novaIronheartPackAbilityOptions(s, id, niPackPorts),
    ...(s.attachments.find((p) => p.id === id)
      ? valkyrie.valkyrieAttachmentActions(
          s,
          s.attachments.find((p) => p.id === id)!,
          valkyriePorts,
        )
      : []),
    ...gmwPack.gmwPlayerPackAbilityOptions(s, id, gmwPorts),
    ...starLordPack.starLordPackAbilityOptions(s, id, starLordPackPorts),
    ...draxPack.draxPackAbilityOptions(s, id, draxPackPorts),
    ...venomPack.venomPackAbilityOptions(s, id, venomPackPorts),
    ...mtsPlayerPack.mtsPlayerPackAbilityOptions(s, id, mtsPlayerPackPorts),
    ...nebulaPack.nebulaPackAbilityOptions(s, id, nebulaPackPorts),
    ...warmPack.warMachinePackAbilityOptions(s, id, warMachinePackPorts),
    ...valkPack.valkyriePackAbilityOptions(s, id, valkyriePackPorts),
    ...visionPack.visionPackAbilityOptions(s, id, visionPackPorts),
    ...sinisterPlayerPack.sinisterPlayerPackAbilityOptions(
      s,
      id,
      sinisterPlayerPackPorts,
    ),
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
export const warMachinePackStoredPlayable = (s: GameState) =>
  warmPack.warMachinePackStoredPlayable(s, warMachinePackPorts);
export const warMachinePackSneakAllies = (s: GameState) =>
  warmPack.warMachinePackSneakAllies(s, warMachinePackPorts);
export const visionPackStoredPlayable = (s: GameState) =>
  visionPack.visionPackStoredPlayable(s, visionPackPorts);
export const ghostSpiderStoredPlayable = (s: GameState) =>
  ghostSpider.ghostSpiderStoredPlayable(s, ghostSpiderPorts);

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
    add(
      s,
      ...masterMold.masterMoldMinionEngaged(
        s,
        { token: `engagement:${s.nextId++}`, minionId: p.id, playerId },
        { isTextBlank },
      ),
      ...rogue.rogueMinionEngaged(s, p),
      ...spiderHam.spiderHamMinionEngaged(s, p, playerId),
      ...ironspider.ironspiderSinisterEngagementResponses(s, p, playerId),
      E("valkPackEngagementWindow", { id: p.id, actorId: playerId }),
      ...thorEngagementResponses(s, p, old, false),
    );
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
  canChangeForm: (s) => canChangeIdentityForm(s, "alter"),
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
    if (p!.id === sabretooth.sabretoothKelly(s)?.id || p!.code === "32088b") {
      movePieceFromPlay(s, id, false);
      return;
    }
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
const armadilloPorts: armadillo.ArmadilloPorts = {
  ...mutagenPorts,
  shuffleEncounter: (s) => {
    revealHidden(s);
    mutagenPorts.shuffleEncounter(s);
  },
  giveTough: (s, id) => {
    const p = find(s, id);
    return !!p && giveCharacterStatus(s, p, "tough");
  },
};
function zzzaxCanTakeCostDamage(s: GameState, target: string): boolean {
  if (damageProhibition(s, target, false)) return false;
  if (target !== "hero") return !find(s, target)?.tough;
  return (
    !s.player.tough &&
    !(
      s.heroId === "groot" &&
      s.player.form === "hero" &&
      !isTextBlank(s, heroCard(s)) &&
      groot.grootGrowthCounters(s) > 0
    )
  );
}
const zzzaxPorts: zzzax.ZzzaxPorts = {
  ...mutagenPorts,
  discardControlledCost: (s, costId, after) => {
    const playerId = s.activePlayerId;
    s.flags[`zzzaxDiscardPending:${costId}`] = true;
    // Leave-play interrupts and responses prepend ahead of this saved commit.
    add(s, E("zzzaxDiscardCostCommit", { costId, playerId, after }));
    discardPiece(s, costId);
  },
  canDiscardControlled: (s, p) =>
    s.player.inPlay.some((x) => x.id === p.id) &&
    !isPermanent(card(p)) &&
    valkyrie.valkyrieCanDiscardAttachment(s, p),
  canTakeIndirectCost: (s, amount) => {
    const heroAvailable = zzzaxCanTakeCostDamage(s, "hero")
      ? Math.max(0, s.player.hp)
      : 0;
    const alliesAvailable = s.player.inPlay
      .filter(
        (p) => card(p).type_code === "ally" && zzzaxCanTakeCostDamage(s, p.id),
      )
      .reduce((n, p) => n + Math.max(0, pieceHP(s, p) - p.damage), 0);
    return heroAvailable + alliesAvailable >= amount;
  },
  indirect: (s, request) => {
    add(
      s,
      E("indirect", {
        actorId: request.playerId,
        amount: request.amount,
        source: request.sourceId,
        sourceTitle: request.sourceTitle,
        zzzaxBatchId: `zzzax-indirect:${s.nextId++}`,
        zzzaxBatchOwner: request.playerId,
        zzzaxAfter: request.after,
        zzzaxTakeCost: request.after?.type === "zzzax:remove-damage-after",
      }),
    );
  },
};
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
const ironspiderPorts: ironspider.IronspiderSinisterPorts = {
  ...mutagenPorts,
  hasTrait: sinisterNativeHasTrait,
  controlledCharacters: (s) => [
    {
      id: `hero:${s.activePlayerId}`,
      label: heroCard(s).name,
      code: heroCard(s).code,
    },
    ...friends(s).map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
  ],
  enemyAttack: (s, p) => enemyATK(s, p, s.activePlayerId),
  attachHand: (s, p, id) => {
    const i = s.player.hand.findIndex((q) => q.id === p.id);
    need(i >= 0, "Electro needs the actual hand card.");
    const [actual] = s.player.hand.splice(i, 1);
    actual.attachedTo = id;
    s.attachments.push(actual);
  },
  indirect: (s, r) =>
    add(
      s,
      E("indirect", {
        actorId: r.playerId,
        amount: r.amount,
        source: r.sourceId,
        sourceTitle: r.sourceTitle,
        zzzaxBatchId: `ironspider-indirect:${s.nextId++}`,
        zzzaxBatchOwner: r.playerId,
        zzzaxAfter: r.after,
        exhaustDamaged: r.exhaustDamaged,
      }),
    ),
  attackDamage: (s, r) => {
    const batchId = `ironspider-attack:${s.nextId++}`;
    add(
      s,
      ...r.allocations.map((packet, index) =>
        E("damage", {
          ...packet,
          source: r.sourceId,
          damageFromAttack: true,
          zzzaxBatchId: batchId,
          zzzaxBatchOwner: r.playerId,
          zzzaxBatchIndex: index,
          actorId: r.playerId,
        }),
      ),
      E("zzzaxIndirectCommit", {
        packets: r.allocations,
        batchId,
        playerId: r.playerId,
        source: r.sourceId,
        after: r.after,
        attackDamage: true,
        actorId: r.playerId,
      }),
    );
  },
};

function rogueNativeTraits(
  s: GameState,
  id: string,
  visited: string[] = [],
): string[] {
  const seatId =
    id === "hero"
      ? s.activePlayerId
      : id.startsWith("hero:")
        ? id.slice(5)
        : undefined;
  if (seatId) {
    const seat = s.players.find((p) => p.id === seatId && !p.eliminated);
    if (!seat) return [];
    const view = seatView(s, seat);
    return [
      ...new Set([
        ...(heroCard(view).traits || "")
          .replace(/\.$/, "")
          .split(/\.\s+/)
          .filter(Boolean),
        ...(aerial(view, visited) ? ["Aerial"] : []),
        ...rogue.rogueTraits(view, rogueNativeTraits, visited),
      ]),
    ];
  }
  const p = find(s, id);
  return p ? sinisterNativeTraits(s, p) : [];
}
/** FIND includes facedown player cards beneath scenario cards and Ultron drones,
 * but never the victory display or removed-from-game area (RRG 1.8, p.19).
 * Only canonical physical zones are searched, not effect/receipt snapshots. */
function rogueTouchedLocation(s: GameState) {
  type Location = {
    piece: Piece;
    zone?: Piece[];
    deck?: Piece[];
    inPlay?: boolean;
    drone?: Piece;
  };
  const zones: { zone: Piece[]; deck?: Piece[]; inPlay?: boolean }[] = [];
  for (const seat of s.players) {
    const p = seatView(s, seat).player;
    zones.push(
      { zone: p.inPlay, inPlay: true },
      { zone: p.setAside || [] },
      { zone: p.hand },
      { zone: p.discard },
      { zone: p.deck, deck: p.deck },
      { zone: p.invocationDeck || [], deck: p.invocationDeck },
      { zone: p.invocationDiscard || [] },
    );
  }
  zones.push(
    { zone: s.minions, inPlay: true },
    { zone: s.sideSchemes, inPlay: true },
    { zone: s.attachments, inPlay: true },
    { zone: s.environments || [], inPlay: true },
    { zone: s.resolving },
    { zone: s.encounter.discard },
    { zone: s.encounter.dealt },
    { zone: s.encounter.storedBoosts || [] },
    { zone: s.attack?.pendingBoosts || [] },
    { zone: s.scheming?.pendingBoosts || [] },
    { zone: s.encounter.deck, deck: s.encounter.deck },
    { zone: s.projectWideawake?.setAsideCaptives || [] },
    { zone: [s.villain] },
  );
  const matches = (p: Piece) =>
    p.code === "38002" && p.ownerId === s.activePlayerId;
  const search = (
    location: Omit<Location, "piece"> & { zone: Piece[] },
  ): Location | undefined => {
    for (const p of location.zone) {
      if (matches(p)) return { ...location, piece: p };
      if (p.droneCard && matches(p.droneCard))
        return { piece: p.droneCard, drone: p };
      for (const zone of [p.storedCards, p.captured, p.inheritorBoosts]) {
        const nested = zone && search({ zone });
        if (nested) return nested;
      }
    }
  };
  for (const location of zones) {
    const found = search(location);
    if (found) return found;
  }
}
function rogueFindTouched(s: GameState): Piece | undefined {
  const found = rogueTouchedLocation(s);
  if (!found) return;
  const { piece, zone, deck, inPlay, drone } = found;
  if (zone === s.player.setAside) return piece;
  if (inPlay) {
    movePieceFromPlay(s, piece.id, false, s.activePlayerId);
    return s.player.setAside?.find((p) => p.id === piece.id);
  }
  if (drone) {
    // The recovered player card is not discarded with its synthetic wrapper.
    // Ordinary leave-play cleanup still removes attachments and trait grants;
    // this is not a defeat and awards no defeat response or mission credit.
    delete drone.droneCard;
    movePieceFromPlay(s, drone.id, false);
    if (find(s, drone.id)) {
      drone.droneCard = piece;
      return;
    }
  } else
    zone!.splice(
      zone!.findIndex((p) => p.id === piece.id),
      1,
    );
  if (deck) {
    revealHidden(s);
    shuffle(s, deck);
  }
  const recovered = resetPiece(piece);
  (s.player.setAside ||= []).push(recovered);
  return recovered;
}
const roguePorts: rogue.RoguePorts = {
  queue: add,
  choose,
  makePiece,
  targets: (s, kind, action) =>
    kind === "character"
      ? [...spdrPackPorts.characterTargets(s), ...targets(s, "enemy")]
      : targets(
          s,
          kind,
          kind === "enemy" && !!action,
          kind === "scheme" && !!action,
        ),
  traits: rogueNativeTraits,
  hasTrait: sinisterNativeHasTrait,
  keyword: (s, name) => sourceKeyword(s, "hero", name as PrintedKeyword),
  canPay: (s, p) => canPay(s, cardCost(s, card(p), p), [], p.id, p.code),
  playReaction: (s, p, effects, after) =>
    add(
      s,
      E("payRequest", {
        title: card(p).name,
        cost: cardCost(s, card(p), p),
        piece: p,
        cancelable: true,
        after: [
          E("resolveHandEvent", {
            id: p.id,
            after: effects,
            continuation: after,
          }),
        ],
        cancellationQueue: after,
      }),
    ),
  discard: discardPiece,
  findTouched: rogueFindTouched,
  canFindTouched: (s, asCost) => {
    const location = rogueTouchedLocation(s);
    if (!location) return false;
    // Energy Transfer must actually attach Touched to pay its arrow cost.
    // A mandatory Psionic Shield replacement prevents that move from a drone.
    return (
      !asCost ||
      !location.drone ||
      !s.attachments.some(
        (p) =>
          p.code === "37034" &&
          p.attachedTo === location.drone!.id &&
          !isTextBlank(s, p),
      )
    );
  },
  shufflePlayer: (s) => {
    revealHidden(s);
    s.player.deck = shuffle(s, s.player.deck);
  },
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  revealHidden,
  damageCost: (s, id, amount) => {
    dealDamage(s, id, amount, "38007");
    return true;
  },
  claimDefense: (s) => {
    if (s.attack) {
      s.attack.defender = "hero";
      s.attack.targetPlayerId = s.activePlayerId;
      s.attack.basicDefense = false;
      s.attack.defense = 0;
      s.attack.eventDefense = true;
    }
  },
  playStored: (s, lab, p) => {
    const restriction = playable(s, p);
    need(!restriction, restriction || "The stored ally cannot be played.");
    add(
      s,
      E("payRequest", {
        title: "Med Lab",
        cost: cardCost(s, card(p), p),
        piece: p,
        cancelable: true,
        commit: [{ type: "rogue:med-commit", id: lab.id }],
        after: [{ type: "rogueNativeMedPlay", id: p.id, labId: lab.id }],
      }),
    );
  },
  activate: (s, id, playerId) =>
    mystiquePorts.activateMystique(s, id, playerId, []),
  discardUntil: (s, trait, after) =>
    brotherhoodPorts.discardUntilMinion(s, trait, after),
};

const phoenixPorts: phoenix.PhoenixPorts = {
  queue: add,
  choose,
  makePiece,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  characterTargets: (s) => spdrPackPorts.characterTargets(s),
  hasTrait: sinisterNativeHasTrait,
  allyStat,
  heroThwart: (s) => heroStats(s).thwart,
  canReady: (s, id) =>
    id === "hero" || id.startsWith("hero:")
      ? canReadyIdentity(id === "hero" ? s : seatView(s, id.slice(5))) &&
        (id === "hero" ? s : seatView(s, id.slice(5))).player.exhausted
      : !!find(s, id)?.exhausted,
  discard: discardPiece,
  remove: (s, id) => movePieceFromPlay(s, id, true),
  shufflePlayer: (s) => {
    revealHidden(s);
    s.player.deck = shuffle(s, s.player.deck);
  },
  shuffleEncounter: (s) => {
    revealHidden(s);
    mutagenPorts.shuffleEncounter(s);
  },
  canPay: (s, p) => canPay(s, cardCost(s, card(p), p), [], p.id, p.code),
  playReaction: (s, p, after) =>
    add(
      s,
      E("payRequest", {
        title: card(p).name,
        cost: cardCost(s, card(p), p),
        piece: p,
        cancelable: true,
        after: [
          E("resolveHandEvent", {
            id: p.id,
            after: phoenix.phoenixEvent(s, p) || [],
            continuation: after,
          }),
        ],
        cancellationQueue: after,
      }),
    ),
  preventDamage: (s, p, amount) => spdrPackPorts.preventDamage(s, p, amount),
  declareDefense: (s) => {
    if (s.attack) {
      s.attack.defender = "hero";
      s.attack.targetPlayerId = s.activePlayerId;
      s.attack.basicDefense = false;
      s.attack.defense = 0;
      s.attack.eventDefense = true;
    }
  },
  moveThreat: (s, from, to, n) => {
    const source = s.sideSchemes.find((p) => p.id === from);
    const amount = Math.min(
      n,
      from === "main" ? s.scheme.threat : source?.counters || 0,
    );
    if (from === "main") s.scheme.threat -= amount;
    else if (source) source.counters -= amount;
    threat(s, to, amount);
    if (source && !source.counters && !isPermanent(card(source)))
      add(s, E("defeatScheme", { id: source.id }));
  },
  maxHP,
  revealHidden,
  printedHP: (s) => heroCard(s).health || 0,
  lose: (s, reason) => endGame(s, false, reason),
  reveal: (s, p) => add(s, E("reveal", { piece: p })),
  removeEncounter: (s, p) => milesPorts.removeEncounter(s, p),
  discardEncounter: (s, p) => milesPorts.discardEncounter(s, p),
};
const spdrPorts: spdr.SpdrPorts = {
  queue: add,
  choose,
  isTextBlank,
  makePiece,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  canChangeForm: (s) =>
    canChangeIdentityForm(s) && antMan.antManCanChangeForm(s),
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  discardControlledCost: (s, id, after) =>
    zzzaxPorts.discardControlledCost(s, id, E("spdrContinue", { after })),
  discardHand,
  mill: (s, count, after) => niPackPorts.discardTopPlayer(s, count, after),
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  canPay: (s, cost, req) => canPay(s, cost, req),
  pay: (s, title, cost, req, after) =>
    requestPayment(s, title, cost, after, req, undefined, false),
  giveObligation: (s, p) =>
    spectrumPorts.giveObligation(s, p, s.activePlayerId),
  removeEncounter: (s, p) => milesPorts.removeEncounter(s, p),
  discardEncounter: (s, p) => milesPorts.discardEncounter(s, p),
  revealEncounter: (s, p) => add(s, E("reveal", { piece: p })),
  addDefense: (s, amount) => {
    if (s.attack && s.attack.defender === "hero") {
      s.attack.defenseBonus = Number(s.attack.defenseBonus || 0) + amount;
      s.attack.defense += amount;
    }
  },
};
const spdrPackPorts: spdrPack.SpdrPackPorts = {
  queue: add,
  choose,
  isTextBlank,
  traits: (s, p) => sinisterNativeTraits(s, p),
  hasTrait: sinisterNativeHasTrait,
  characterTargets: (s) => [
    ...playerOrder(s).map((seat) => ({
      id: `hero:${seat.id}`,
      label: heroCard(seatView(s, seat)).name,
      code: heroCard(seatView(s, seat)).code,
    })),
    ...allInPlay(s)
      .filter((p) => card(p).type_code === "ally")
      .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
  ],
  controlledTraitCards: (s, trait) => [
    ...(sinisterNativeHasTrait(s, `hero:${s.activePlayerId}`, trait)
      ? [
          {
            id: `hero:${s.activePlayerId}`,
            label: heroCard(s).name,
            code: heroCard(s).code,
          },
        ]
      : []),
    ...s.player.inPlay
      .filter((p) => sinisterNativeTraits(s, p).includes(trait))
      .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
  ],
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  printedHP: (s) =>
    card(HEROES.find((h) => h.id === s.heroId)!.code).health || 0,
  canDiscardControlled: (s, p) =>
    s.player.inPlay.some((q) => q.id === p.id) &&
    !isPermanent(card(p)) &&
    valkyrie.valkyrieCanDiscardAttachment(s, p),
  discardControlledCost: zzzaxPorts.discardControlledCost,
  discardControlled: (s, id, after) => {
    const before = new Set(s.queue);
    discardPiece(s, id);
    const generated = s.queue.filter((q) => !before.has(q));
    s.queue = s.queue.filter((q) => before.has(q));
    add(s, ...generated, ...after);
  },
  attach: (s, id, target) => {
    const p = find(s, id);
    need(p, "The actual upgrade is missing.");
    p!.attachedTo = target;
  },
  canDealDamageCost: (s, target, amount) => {
    const id =
      target === "hero"
        ? s.activePlayerId
        : target.startsWith("hero:")
          ? target.slice(5)
          : undefined;
    return (
      amount > 0 &&
      (id
        ? !!s.players.find((seat) => seat.id === id && !seat.eliminated)
        : allInPlay(s).some(
            (p) => p.id === target && card(p).type_code === "ally",
          )) &&
      !damageProhibition(s, target, false)
    );
  },
  dealDamageCost: (s, target, amount, sourceId, after) =>
    add(
      s,
      E("damage", {
        target,
        amount,
        source:
          after.some((q) => q.type === "spdr-pack:thwip-paid") &&
          s.flags.spdrThwipPaymentCost
            ? s.flags.spdrThwipPaymentCost
            : sourceId,
        spdrPaymentCostId: after.some((q) => q.type === "spdr-pack:thwip-paid")
          ? s.flags.spdrThwipPaymentCost
          : undefined,
        afterResolved: after.map((q) => effectContext(s, q)),
      }),
    ),
  moveDamage: (s, id, target, amount) => {
    const p = find(s, id);
    need(p && p.damage >= amount, "The actual damage cannot be moved.");
    p!.damage -= amount;
    if (target === s.villain.id) s.villain.hp -= amount;
    else {
      const enemy = find(s, target);
      if (enemy) enemy.damage += amount;
    }
    check(s);
  },
  discardEncounterTop: (s, after) => {
    const before = new Set(s.queue);
    const { piece } = mutagenPorts.discardTop(s);
    const generated = s.queue.filter((q) => !before.has(q));
    s.queue = s.queue.filter((q) => before.has(q));
    add(s, ...generated, { ...after, discardedPiece: piece });
  },
  revealAvailable: (s, r) =>
    s.resolving.some((p) => p.id === r.pieceId) &&
    !s.flags[`spiderHamCanceledReveal:${r.pieceId}`],
  revealType: (s, r) => {
    const p = s.resolving.find((p) => p.id === r.pieceId);
    return p ? card(p).type_code : undefined;
  },
  cancelWhenRevealed: (s, r) => {
    s.flags[`ghostCancelReveal:${r.pieceId}`] = true;
  },
  resolvedTreacheryAvailable: (s, r) =>
    s.resolving.some(
      (p) => p.id === r.pieceId && card(p).type_code === "treachery",
    ),
  captureResolvedTreachery: (s, r, allyId) => {
    const ally = find(s, allyId);
    const i = s.resolving.findIndex((p) => p.id === r.pieceId);
    need(ally && i >= 0, "The actual resolved treachery is unavailable.");
    const [p] = s.resolving.splice(i, 1);
    p.attachedTo = allyId;
    (ally!.storedCards ||= []).push(p);
  },
  preventDamage: (s, packet, amount) => {
    if (packet.kind === "attack" && s.attack) s.attack.prevented += amount;
    else if (packet.kind === "overkill" && s.attack)
      s.attack.identityPrevented =
        Number(s.attack.identityPrevented || 0) + amount;
    else packet.amount = Math.max(0, packet.amount - amount);
  },
};

const spiderHamPorts: spiderHam.SpiderHamPorts = {
  queue: add,
  choose,
  isTextBlank,
  makePiece,
  isIdentityTextBlank: (s) =>
    isTextBlank(s, {
      code: heroCard(s).code,
      id: `hero:${s.activePlayerId}`,
    }) ||
    (!!s.player.spiderHamIdentity &&
      isTextBlank(s, s.player.spiderHamIdentity)),
  canChangeForm: canChangeIdentityForm,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  attackProgram: niAttackProgram,
  attackVillain: (s, id, after) =>
    add(
      s,
      E("enemyAttack", {
        id: s.villain.id,
        actorId: id,
        activation: {
          enemyId: s.villain.id,
          playerId: id,
          kind: "attack",
          after: E("spiderHamContinue", { after }),
        },
      }),
    ),
  enemyAttack: (s, id, playerId, after) => {
    if (find(s, id))
      add(
        s,
        E("enemyAttack", {
          id,
          actorId: playerId,
          activation: {
            enemyId: id,
            playerId,
            kind: "attack",
            after: E("spiderHamContinue", { after }),
          },
        }),
      );
    else add(s, ...after);
  },
  addIdentityToonCounters: (s, count) => {
    if (s.player.spiderHamIdentity)
      spiderHam.spiderHamAddToonCounters(s, count);
    else
      s.flags.spiderHamForeignToonCounters =
        Number(s.flags.spiderHamForeignToonCounters || 0) + count;
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  canPayWithToonCost: (s, p, count) =>
    spiderHam.spiderHamToonCounters(s) >= count &&
    canPay(
      s,
      cardCost(s, card(p), p),
      sinisterPlayRequirements(p),
      p.id,
      p.code,
    ),
  canDiscardPiece: (s, p) => zzzaxPorts.canDiscardControlled(s, p),
  discardControlledCost: (s, id, after) =>
    zzzaxPorts.discardControlledCost(s, id, E("spiderHamContinue", { after })),
  preventDamage: (s, context, amount) =>
    novaPorts.preventAttackDamage(
      s,
      { ...context, fromAttack: true, friendly: true },
      amount,
    ),
  damageRemaining: (s, context) => {
    const flags = seatView(s, context.playerId).flags;
    const kind = flags[`novaDamageKind:${context.token}`];
    const offset =
      kind === "attack"
        ? Number(s.attack?.prevented || 0)
        : kind === "overkill"
          ? Number(s.attack?.identityPrevented || 0)
          : Number(flags[`msPrevent:${context.token}`] || 0);
    const initial = Number(
      flags[`spiderHamDamageOffset:${context.token}`] || 0,
    );
    return Math.max(0, context.amount - offset + initial);
  },
  reactionEvents: eventPlaySources,
  canPlayRevealReaction: (s, p) =>
    !ghostSpider.ghostSpiderCannotPlayEvents(s) &&
    !isTextBlank(s, p) &&
    canPay(
      s,
      cardCost(s, card(p), p),
      sinisterPlayRequirements(p),
      p.id,
      p.code,
    ),
  playRevealReaction: (s, id, receipt, after) => {
    const p = eventPlaySources(s).find((p) => p.id === id);
    need(p, "The actual encounter interrupt is unavailable.");
    requestPayment(
      s,
      card(p!).name,
      cardCost(s, card(p!), p),
      [E("spiderHamRevealCommit", { piece: p, receipt, after })],
      sinisterPlayRequirements(p!),
      p,
      true,
    );
    if (s.prompt?.cancelable)
      s.prompt.cancellationQueue = [...after, ...s.queue];
  },
  cancelEncounter: (s, p) => {
    bwPorts.cancelEncounter(s, p);
    delete s.flags[`spiderHamCanceledReveal:${p.id}`];
  },
  putMinion: (s, p, playerId, after) => {
    const before = new Set(s.queue);
    mutagenPorts.putMinion(s, p, playerId);
    const generated = s.queue.filter((e) => !before.has(e));
    s.queue = s.queue.filter((e) => before.has(e));
    add(s, ...generated, ...after);
  },
  revealEncounter: (s, p) => add(s, E("reveal", { piece: p })),
  attach: (s, p, target) => {
    s.resolving = s.resolving.filter((x) => x.id !== p.id);
    mutagenPorts.attach(s, p, target);
  },
  clearControlledCounters: (s, playerId) => {
    const view = seatView(s, playerId);
    for (const p of [
      ...view.player.inPlay,
      ...s.attachments.filter((p) => controller(s, p.id)?.id === playerId),
    ])
      p.counters = 0;
    if (view.player.spiderHamIdentity)
      view.player.spiderHamIdentity.counters = 0;
    if (view.player.ironheartIdentity)
      view.player.ironheartIdentity.counters = 0;
    for (const key of [
      "grootGrowthCounters",
      "draxVengeanceCounters",
      "warMachineAmmo",
      "spiderHamForeignToonCounters",
    ])
      if (key in view.flags) view.flags[key] = 0;
  },
};
const spiderHamPackPorts: spiderHamPack.SpiderHamPackPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  traits: sinisterNativeTraits,
  controlledTraitCards: (s, trait) => [
    ...(captainPackHasTrait(s, `hero:${s.activePlayerId}`, trait)
      ? [{ id: `hero:${s.activePlayerId}`, label: heroCard(s).name }]
      : []),
    ...[
      ...s.player.inPlay,
      ...s.attachments.filter(
        (p) => controller(s, p.id)?.id === s.activePlayerId,
      ),
    ]
      .filter((p) => captainPackHasTrait(s, p.id, trait))
      .map((p) => ({ id: p.id, label: card(p).name })),
  ],
  characterTargets: (s) =>
    playerOrder(s).flatMap((seat) => {
      const view = seatView(s, seat);
      return [
        { id: `hero:${seat.id}`, label: heroCard(view).name },
        ...view.player.inPlay
          .filter((p) => card(p).type_code === "ally")
          .map((p) => ({ id: p.id, label: card(p).name })),
      ];
    }),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay,
  handPlayableCards: eventPlaySources,
  canPlayWithDiscount: (s, p, discount, exhaustId) => {
    const source = exhaustId
      ? s.player.inPlay.find((p) => p.id === exhaustId)
      : undefined;
    const exhausted = source?.exhausted;
    if (source) source.exhausted = true;
    try {
      return antPackPorts.playableWithDiscount(s, p, discount);
    } finally {
      if (source) source.exhausted = !!exhausted;
    }
  },
  playFromHand: (s, id, discount, after) =>
    add(
      s,
      E("visionPackMeditationPlay", {
        id,
        discount,
        after,
        sinisterGovernment: true,
      }),
    ),
  discardControlled: (s, id, after) => {
    add(s, ...after);
    discardPiece(s, id);
  },
  attach: attachPackUpgrade,
  removeThreat: (s, target, amount, source, after) =>
    add(
      s,
      E("thwart", {
        target,
        amount,
        source,
        ignoreCrisis: true,
        additional: true,
      }),
      ...after,
    ),
  thwartBatch: (s, targets, sourceId, after) =>
    add(
      s,
      E("spiderHamThwartBatch", {
        targets,
        sourceId,
        after,
        token: `spider-ham-batch:${s.nextId++}`,
      }),
    ),
  addBasicThwartBonus: (_s, packet, amount) => {
    packet.amount += amount;
  },
  playThwartInterrupt: (s, id, _packet, after) => {
    s.flags[`spiderHamEntrancePaid:${id}`] = true;
    niNativeReactionPlay(s, id, after);
  },
  revealHidden,
  revealAvailable: (s, receipt) =>
    s.resolving.some((p) => p.id === receipt.pieceId) &&
    !s.flags[`spiderHamCanceledReveal:${receipt.pieceId}`],
  lookEncounter: (s, id) => {
    const p = s.resolving.find((p) => p.id === id);
    need(p, "The actual pending encounter is unavailable.");
    return card(p!).type_code;
  },
  revealEncounterFromDeck: (s, id, after) => {
    const index = s.encounter.deck.findIndex((p) => p.id === id);
    need(index >= 0, "The actual side scheme is unavailable.");
    const [p] = s.encounter.deck.splice(index, 1);
    beginResolution(s, p);
    add(s, E("reveal", { piece: p, fromEncounterDeck: true }), ...after);
  },
  shuffleEncounter: (s, after) => {
    revealHidden(s);
    mutagenPorts.shuffleEncounter(s);
    add(s, ...after);
  },
  damageAlly: (s, id, amount, after) =>
    add(s, E("damage", { target: id, amount, source: "30020" }), ...after),
  returnDefeatedAlly: (s, snapshot, ownerId) => {
    const p = find(s, snapshot.id),
      controlling = controller(s, snapshot.id)?.id;
    need(
      p && p.ownerId === ownerId,
      "The actual defeated ally is unavailable.",
    );
    s.flags[`spiderHamReturnHand:${p!.id}`] = ownerId;
    movePieceFromPlay(s, p!.id, false);
    delete s.spiderHamConsequentialReceipts?.[p!.id];
    if (controlling)
      add(
        s,
        E("bwAllyDefeated", {
          piece: p,
          playerId: controlling,
          actorId: controlling,
        }),
      );
  },
};
function spiderHamNativePhysicsOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
) {
  if (
    packet.amount <= 1 ||
    !(packet.target === "hero" || packet.target === `hero:${s.activePlayerId}`)
  )
    return [];
  packet.damageWindowId ||= `spider-ham-damage:${s.nextId++}`;
  const token = packet.damageWindowId,
    kind = packet.kind || "packet";
  s.flags[`novaDamageKind:${token}`] = kind;
  s.flags[`spiderHamDamageOffset:${token}`] =
    kind === "attack"
      ? Number(s.attack?.prevented || 0)
      : kind === "overkill"
        ? Number(s.attack?.identityPrevented || 0)
        : Number(s.flags[`msPrevent:${token}`] || 0);
  return spiderHam.spiderHamDamageOptions(
    s,
    {
      token,
      playerId: s.activePlayerId,
      targetId: `hero:${s.activePlayerId}`,
      amount: packet.amount,
    },
    after,
    spiderHamPorts,
  );
}
/** Saved native callbacks preserve physical source cards across immediate
 * deck resets and finish their native windows before the authored continuation. */
function resolveBrotherhoodNativeEffect(s: GameState, e: Effect): boolean {
  if (!e.type.startsWith("brotherhood-native:")) return false;
  switch (e.type) {
    case "brotherhood-native:after":
      add(s, ...e.after);
      break;
    case "brotherhood-native:discard-player-top": {
      const previous = s.activePlayerId;
      activateSeat(s, e.playerId);
      const before = new Set(s.queue);
      const result = discardNativePlayerTop(s);
      const generated = s.queue.filter((effect) => !before.has(effect));
      s.queue = s.queue.filter((effect) => before.has(effect));
      activateSeat(s, previous);
      add(
        s,
        ...generated,
        ...e.after.map((effect: Effect) => ({
          ...effect,
          actorId: e.playerId,
          discardedPiece: result.piece,
          deckEmptied: result.emptied,
        })),
      );
      break;
    }
    case "brotherhood-native:random-hand": {
      const previous = s.activePlayerId;
      activateSeat(s, e.playerId);
      const before = new Set(s.queue);
      if (s.player.hand.length) revealHidden(s);
      randomDiscard(s);
      const generated = s.queue.filter((effect) => !before.has(effect));
      s.queue = s.queue.filter((effect) => before.has(effect));
      activateSeat(s, previous);
      add(s, ...generated, ...e.after);
      break;
    }
    case "brotherhood-native:scheme-result": {
      const entered = !!s.brotherhoodEntered?.[e.id];
      if (s.brotherhoodEntered) delete s.brotherhoodEntered[e.id];
      revealHidden(s);
      mutagenPorts.shuffleEncounter(s);
      add(s, ...e.after.map((effect: Effect) => ({ ...effect, entered })));
      break;
    }
    case "brotherhood-native:discard-until": {
      const before = new Set(s.queue);
      const result = mutagenPorts.discardTop(s);
      const generated = s.queue.filter((effect) => !before.has(effect));
      s.queue = s.queue.filter((effect) => before.has(effect));
      const found =
        result.piece &&
        card(result.piece).type_code === "minion" &&
        !!card(result.piece).traits?.includes(e.trait);
      // RRG 1.8 p17: the discard effect stops at the first empty boundary,
      // even though native recycling has already moved the physical card.
      if (found || !result.piece || result.emptied)
        add(
          s,
          ...generated,
          ...e.after.map((effect: Effect) => ({
            ...effect,
            discardedPiece: found ? result.piece : undefined,
            deckEmptied: result.emptied,
          })),
        );
      else add(s, ...generated, e);
      break;
    }
    default:
      throw Error(`Unknown Brotherhood native callback: ${e.type}`);
  }
  return true;
}
const brotherhoodPorts: brotherhood.BrotherhoodPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  controlledCharacters: ironspiderPorts.controlledCharacters,
  canExhaustCharacter: (s, id) => {
    const p = id.startsWith("hero:")
      ? seatView(s, id.slice(5)).player
      : find(s, id);
    return !!p && !p.exhausted;
  },
  exhaustCharacter: (s, id) => {
    const p = id.startsWith("hero:")
      ? seatView(s, id.slice(5)).player
      : find(s, id);
    need(
      p && !p.exhausted,
      "The selected controlled character is unavailable.",
    );
    p!.exhausted = true;
  },
  statusEligible: dsPorts.canAddStatus,
  addStatus: (s, id, status) => add(s, E("status", { target: id, status })),
  discardPlayerTop: (s, playerId, after) =>
    add(
      s,
      E("brotherhood-native:discard-player-top", {
        playerId,
        after,
        actorId: playerId,
      }),
    ),
  discardRandomHand: (s, playerId, after) =>
    add(
      s,
      E("brotherhood-native:random-hand", {
        playerId,
        after,
        actorId: playerId,
      }),
    ),
  indirectDamage: (s, playerId, amount, sourceId, after) =>
    ironspiderPorts.indirect(s, {
      playerId,
      amount,
      sourceId,
      sourceTitle: "Pyro",
      after: E("brotherhood-native:after", { after, actorId: playerId }),
    }),
  attachMinion: (s, id, minionId, boost) => {
    const p = sinisterNativePiece(s, id);
    need(
      p?.code === "32077" && s.minions.some((m) => m.id === minionId),
      "Homo Superior requires its actual physical card and a live minion.",
    );
    if (boost) {
      const activation = s.scheming || s.attack;
      need(activation, "The actual boost activation is unavailable.");
      if (!activation!.retainedBoostIds?.includes(id))
        (activation!.retainedBoostIds ||= []).push(id);
    }
    // This removes zones only, preserving boostIds/boostCodes/value receipts.
    // countActivationBoost subsequently finds this same live attachment.
    removeEncounterInstance(s, id);
    p!.attachedTo = minionId;
    s.attachments.push(p!);
  },
  searchAndRevealSideScheme: (s, code, after) => {
    let found: Piece | undefined;
    let fromEncounterDeck = false;
    for (const zone of [s.encounter.deck, s.encounter.discard]) {
      const index = zone.findIndex((p) => p.code === code);
      if (index >= 0) {
        fromEncounterDeck = zone === s.encounter.deck;
        found = zone.splice(index, 1)[0];
        break;
      }
    }
    if (found) {
      delete (s.brotherhoodEntered ||= {})[found.id];
      beginResolution(s, found);
      add(
        s,
        E("reveal", { piece: found, fromEncounterDeck }),
        E("brotherhood-native:scheme-result", { id: found.id, after }),
      );
    } else add(s, E("brotherhood-native:scheme-result", { after }));
  },
  discardUntilMinion: (s, trait, after) =>
    add(s, E("brotherhood-native:discard-until", { trait, after })),
  revealDiscardedMinion: (s, piece, playerId, after) => {
    const actual = sinisterNativePiece(s, piece.id);
    need(
      actual && card(actual).type_code === "minion",
      "The actual discarded Brotherhood minion is unavailable.",
    );
    removeEncounterInstance(s, actual!.id);
    beginResolution(s, actual!);
    add(s, E("reveal", { piece: actual!, actorId: playerId }), ...after);
  },
};
const wideawakeCaptive = (p: Piece) =>
  ["32089", "32090", "32091", "32092"].includes(p.code);
function wideawakePhysicalZones(s: GameState): Piece[][] {
  const zones = [
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.inPlay, p.hand, p.deck, p.discard, p.setAside || []];
    }),
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    s.removed,
    s.victoryDisplay || [],
    s.minions,
    s.sideSchemes,
    s.attachments,
    s.environments || [],
    s.projectWideawake?.setAsideCaptives || [],
    s.encounter.storedBoosts || [],
    s.magneto?.mainDeck || [],
    s.magneto?.villainDeck || [],
    ...(s.magneto?.currentMain ? [[s.magneto.currentMain]] : []),
    ...(s.magneto?.orbital ? [[s.magneto.orbital]] : []),
    s.attack?.pendingBoosts || [],
    s.scheming?.pendingBoosts || [],
  ];
  const nested = (pieces: Piece[]) => {
    for (const p of pieces)
      for (const children of [p.storedCards || [], p.captured || []]) {
        zones.push(children);
        nested(children);
      }
  };
  for (const pieces of [...zones]) nested(pieces);
  return zones;
}
function wideawakePhysicalPiece(s: GameState, id: string): Piece | undefined {
  return wideawakePhysicalZones(s)
    .flat()
    .find((p) => p.id === id);
}
function takeWideawakePiece(s: GameState, id: string): Piece | undefined {
  for (const zone of wideawakePhysicalZones(s)) {
    const index = zone.findIndex((p) => p.id === id);
    if (index >= 0) return zone.splice(index, 1)[0];
  }
}
function wideawakeSearch(
  s: GameState,
  code: string | undefined,
  trait: string | undefined,
  playerId: string,
  after: Effect[],
) {
  const matches = [...s.encounter.deck, ...s.encounter.discard].filter((p) =>
    code
      ? p.code === code
      : card(p).type_code === "minion" && captainPackHasTrait(s, p.id, trait!),
  );
  // Traits of out-of-play candidates come from their actual printed source.
  const candidates = trait
    ? [...s.encounter.deck, ...s.encounter.discard].filter(
        (p) =>
          card(p).type_code === "minion" &&
          (card(p).traits || "")
            .split(/\.\s*/)
            .some((t) => t.toLowerCase() === trait.toLowerCase()),
      )
    : matches;
  if (!candidates.length) {
    mutagenPorts.shuffleEncounter(s);
    add(s, ...after);
    return;
  }
  const effects = (id: string) => [
    E("wideawake-native:reveal-searched", {
      id,
      playerId,
      after,
      actorId: playerId,
    }),
  ];
  if (
    candidates.length === 1 ||
    (code && candidates.every((p) => p.code === code))
  )
    add(s, ...effects(candidates[0].id));
  else
    choose(
      s,
      "Search encounter cards",
      "Choose an actual card to reveal.",
      candidates.map((p) =>
        option(p.id, card(p).name, effects(p.id), undefined, p.code),
      ),
    );
}
function wideawakeCapture(
  s: GameState,
  schemeId: string,
  id: string,
  after: Effect[],
) {
  const operation = s.sideSchemes.find(
    (p) => p.id === schemeId && p.code === "32104",
  );
  const piece =
    operation && !s.removed.some((p) => p.id === id)
      ? takeWideawakePiece(s, id)
      : undefined;
  if (operation && piece) {
    (operation.captured ||= []).push(piece);
    log(s, "Place one card facedown under Operation Zero Tolerance.", "bad");
    zeroTolerance.zeroToleranceCheckLoss(s, {
      lose: (state, reason) => endGame(state, false, reason),
    });
  }
  if (!["lost", "won"].includes(s.phase))
    add(s, ...after.map((e) => ({ ...e, captured: !!piece })));
}
const sentinelsPorts: sentinels.SentinelsPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  isEngagedWith: (s, p, playerId) =>
    !p.engagedWith || p.engagedWith === playerId,
  canExhaustIdentity: (s, playerId) => !seatView(s, playerId).player.exhausted,
  exhaustIdentity: (s, playerId) => {
    need(
      !seatView(s, playerId).player.exhausted,
      "Your identity is exhausted.",
    );
    seatView(s, playerId).player.exhausted = true;
  },
  attachIdentity: (s, id, playerId) => {
    const p = wideawakePhysicalPiece(s, id);
    need(p, "The actual Targeted for Elimination source is unavailable.");
    mutagenPorts.attach(s, p!, `hero:${playerId}`);
  },
  discardPiece,
  searchAndRevealTargeted: (s, playerId, after) =>
    wideawakeSearch(s, "32107", undefined, playerId, after),
  startAttack: (s, id, playerId, after) =>
    add(
      s,
      E("enemyAttack", {
        id,
        actorId: playerId,
        activation: {
          enemyId: id,
          playerId,
          kind: "attack",
          after: E("dvEnemyAttackComplete", { after, actorId: playerId }),
        },
      }),
    ),
  dealBoostFacedown: (s, id, playerId) => {
    const p = wideawakePhysicalPiece(s, id);
    need(p, "The actual Sentinel boost card is unavailable.");
    const activation = s.scheming || s.attack;
    if (activation) (activation.retainedBoostIds ||= []).push(id);
    removeEncounterInstance(s, id);
    p!.dealtTo = playerId;
    s.encounter.dealt.push(p!);
  },
};
const zeroTolerancePorts: zeroTolerance.ZeroTolerancePorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  hasStatus: (s, target, status) =>
    !!(
      target === "hero"
        ? s.player
        : target.startsWith("hero:")
          ? seatView(s, target.slice(5)).player
          : find(s, target)
    )?.[status],
  addStatus: (s, target, status) => add(s, E("status", { target, status })),
  damage: (s, target, amount, source, after) =>
    add(s, E("damage", { target, amount, source, afterResolved: after })),
  attachBarrier: (s, id, minionId, after) => {
    const p = wideawakePhysicalPiece(s, id);
    if (p && s.minions.some((m) => m.id === minionId))
      mutagenPorts.attach(s, p, minionId);
    add(s, ...after);
  },
  revealSearchedSideScheme: (s, id, playerId, after) =>
    add(
      s,
      E("wideawake-native:reveal-searched", {
        id,
        playerId,
        after,
        actorId: playerId,
        shuffled: true,
      }),
    ),
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  revealHidden,
  captureDefeatedAlly: (s, schemeId, ally, after) =>
    wideawakeCapture(s, schemeId, ally.id, after),
  lose: (s, reason) => endGame(s, false, reason),
};
const wideawakePorts: wideawake.ProjectWideawakePorts = {
  queue: add,
  choose,
  isTextBlank,
  findPiece: wideawakePhysicalPiece,
  findAlly: (s, id) => {
    const seat = controller(s, id),
      piece = find(s, id);
    return seat &&
      piece &&
      card(piece).type_code === "ally" &&
      !piece.treatedAsMinion
      ? { piece, playerId: seat.id }
      : undefined;
  },
  revealSetupSideScheme: (s, p, after) =>
    add(s, E("reveal", { piece: p, actorId: s.firstPlayerId }), ...after),
  searchAndRevealSideScheme: (s, code, playerId, after) =>
    wideawakeSearch(s, code, undefined, playerId, after),
  searchAndRevealMinion: (s, trait, playerId, after) =>
    wideawakeSearch(s, undefined, trait, playerId, after),
  flipMallToJubilee: (s, p, playerId) => {
    takeWideawakePiece(s, p.id);
    p.code = "32088b";
    Object.assign(p, resetPiece(p, true));
    if (uniqueConflict(s, card(p))) {
      s.removed.push(p);
      return;
    }
    seatView(s, playerId).player.inPlay.push(p);
    add(
      s,
      E("allyLimit", { actorId: playerId }),
      E("allyEnter", { id: p.id, actorId: playerId, fromHand: false }),
    );
  },
  discardOtherJubilees: (s, exceptId) => {
    for (const p of allInPlay(s).filter(
      (p) =>
        p.id !== exceptId &&
        card(p).type_code === "ally" &&
        card(p).name === "Jubilee",
    ))
      discardPiece(s, p.id);
  },
  transferAllyControl: (s, id, playerId) =>
    hulkPackPorts.transferControl(s, id, playerId),
  putAlly: (s, p, playerId) => {
    Object.assign(p, resetPiece(p, true));
    p.ownerId = playerId;
    if (uniqueConflict(s, card(p))) {
      seatView(s, playerId).player.discard.push(p);
      return;
    }
    seatView(s, playerId).player.inPlay.push(p);
    add(
      s,
      E("allyLimit", { actorId: playerId }),
      E("allyEnter", { id: p.id, actorId: playerId, fromHand: false }),
    );
  },
  randomIndex: (s, length) => Math.floor(random(s) * length),
  canCapturePlayerTop: (s, playerId) =>
    !!s.sideSchemes.find((p) => p.code === "32104") &&
    seatView(s, playerId).player.deck.length +
      seatView(s, playerId).player.discard.length >
      0,
  capturePlayerTop: (s, playerId, sourceId, after) =>
    add(
      s,
      E("wideawake-native:capture-top", {
        playerId,
        sourceId,
        after,
        actorId: playerId,
      }),
    ),
  captureCard: (s, p, playerId, after) =>
    add(
      s,
      E("wideawake-native:capture-card", {
        id: p.id,
        playerId,
        after,
        actorId: playerId,
      }),
    ),
  removeMainThreat: (s, amount, source) =>
    thwart(s, "main", amount, true, source),
  dealEncounter,
  enemyAttack: (s, id, playerId) =>
    sentinelsPorts.startAttack(s, id, playerId, []),
  damageBatch: (s, targets, source, playerId) =>
    add(
      s,
      E("wideawake-native:damage-batch", {
        targets,
        source,
        playerId,
        actorId:
          s.players.find((p) => p.id === playerId && !p.eliminated)?.id ||
          s.firstPlayerId,
      }),
    ),
  enemyTargets: (s) => targets(s, "enemy", false),
  canExhaust: (s, id) =>
    id === "hero"
      ? !s.player.exhausted
      : !!find(s, id) && !find(s, id)!.exhausted,
  exhaust: (s, id) => {
    need(wideawakePorts.canExhaust(s, id), "This character is exhausted.");
    if (id === "hero") s.player.exhausted = true;
    else find(s, id)!.exhausted = true;
  },
  canPay,
  pay: (s, title, cost, requirements, after, sourceId, commit = []) => {
    const piece = find(s, sourceId);
    need(piece, "The actual Wideawake ability source is unavailable.");
    add(
      s,
      E("payRequest", {
        title,
        cost,
        requirements,
        after,
        piece,
        paymentCommit: commit,
        abilityCost: true,
        cancelable: true,
        cancellationQueue: [...s.queue],
      }),
    );
  },
  attach: (s, p, target, boost) => {
    if (boost) {
      const activation = s.scheming || s.attack;
      if (activation) (activation.retainedBoostIds ||= []).push(p.id);
    }
    mutagenPorts.attach(s, p, target);
    syncVillainTextHealth(s);
  },
  putBoostMinion: mutagenPorts.putMinion,
  discardPiece,
  clearVillainStatuses: (s) => {
    colossusNativeDiscardTough(
      s,
      [
        {
          targetId: s.villain.id,
          amount: s.villain.toughCards ?? Number(s.villain.tough),
        },
      ],
      [],
    );
    s.villain.stunned = s.villain.confused = false;
    s.villain.stunCards = s.villain.confuseCards = 0;
  },
  giveVillainTough: (s) => giveCharacterStatus(s, s.villain, "tough"),
  healVillain: (s, amount, source) =>
    add(
      s,
      E("heal", { target: s.villain.id, amount, source, origin: "encounter" }),
    ),
};
/** Cancel the departed physical villain's activation, including saved nested
 * continuations. A different Brotherhood member never inherits that attack. */
function mansionAttackEndDepartedActivation(s: GameState, villainId: string) {
  const cancelled = (s.mansionAttack!.cancelledActivations ||= []);
  const clean = (activation: GameState["attack"] | GameState["scheming"]) => {
    if (!activation) return false;
    const callback = activation.activationAfter;
    if (
      callback &&
      [
        "mystique-native:activation-finish",
        "mansion-native:activation-finish",
      ].includes(callback.type)
    ) {
      if (clean(callback.outerAttack)) delete callback.outerAttack;
      if (clean(callback.outerScheme)) delete callback.outerScheme;
    }
    if (activation.attacker !== villainId) return false;
    if (
      !("completionRecorded" in activation && activation.completionRecorded) &&
      activation.id &&
      !cancelled.includes(activation.id)
    )
      cancelled.push(activation.id);
    const pending = activation.pendingBoosts || [];
    activation.pendingBoosts = [];
    for (const p of pending)
      if (!s.encounter.discard.some((q) => q.id === p.id))
        s.encounter.discard.push(resetPiece(p));
    for (const id of activation.boostIds || []) finishResolution(s, id);
    return true;
  };
  if (clean(s.attack)) s.attack = null;
  if (clean(s.scheming)) delete s.scheming;
  for (const callback of s.queue) {
    if (clean(callback.outerAttack)) delete callback.outerAttack;
    if (clean(callback.outerScheme)) delete callback.outerScheme;
  }
}
const mansionAttackPorts: mansionAttack.MansionAttackPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  isEngagedWith: (s, p, playerId) =>
    !p.engagedWith || p.engagedWith === playerId,
  randomIndex: (s, length) => Math.floor(random(s) * length),
  putEnvironment: (s, p) => {
    removeEncounterInstance(s, p.id);
    (s.environments ||= []).push(p);
  },
  revealVillain: (s, p, after) => {
    const previous = s.villain;
    Object.assign(p, resetPiece(p));
    const hp = card(p).health! * s.playerCount;
    s.villain = Object.assign(p, {
      hp,
      maxHp: hp,
      stage: s.difficulty === "expert" ? 2 : 1,
    });
    s.mansionAttack!.activeVillainRetired = false;
    // Permanent attachments survive the villain change with their original IDs.
    for (const a of [...allInPlay(s), ...s.attachments])
      if (a.attachedTo === previous.id && isPermanent(card(a)))
        a.attachedTo = p.id;
    if (keyword(p, "Toughness", s)) giveCharacterStatus(s, p, "tough");
    revealHidden(s);
    log(s, `${card(p).name} is revealed from the villain deck.`, "bad");
    add(s, ...after);
  },
  revealMain: (s, p, after) => {
    discardMainAttachments(s);
    p.code = `${p.code.slice(0, -1)}b`;
    s.scheme = {
      code: p.code,
      threat:
        (card(p).base_threat || 0) *
        (card(p).base_threat_fixed ? 1 : s.playerCount),
      index: p.code === "32125b" ? 0 : (s.scheme.index || 0) + 1,
    };
    revealHidden(s);
    log(s, `The main scheme is revealed: ${card(p).name}.`, "bad");
    add(
      s,
      ...(mansionAttack.mansionAttackReveal(s, p, { isTextBlank }) || []),
      ...after,
    );
  },
  addToVictory: (s, p) => {
    if (card(p).type_code === "villain") {
      mansionAttackEndDepartedActivation(s, p.id);
      for (const a of [...allInPlay(s), ...s.attachments])
        if (a.attachedTo === p.id && !isPermanent(card(a)))
          discardPiece(s, a.id);
      wideawake.projectWideawakeEnemyLeftPlay(s, p.id);
      // The required native villain field becomes a presentation snapshot until
      // another physical villain enters. Only victoryDisplay owns this card.
      s.mansionAttack!.activeVillainRetired = true;
      s.villain = structuredClone(s.villain);
    } else discardMainAttachments(s);
    if (!(s.victoryDisplay ||= []).some((q) => q.id === p.id))
      s.victoryDisplay.push(resetPiece(p));
    log(s, `${card(p).name} enters the victory display.`, "good");
  },
  removeDefeatedVillain: (s, p) => {
    mansionAttackEndDepartedActivation(s, p.id);
    for (const a of [...allInPlay(s), ...s.attachments])
      if (a.attachedTo === p.id && !isPermanent(card(a))) discardPiece(s, a.id);
    wideawake.projectWideawakeEnemyLeftPlay(s, p.id);
    s.mansionAttack!.activeVillainRetired = true;
    s.villain = structuredClone(s.villain);
    if (!s.removed.some((q) => q.id === p.id)) s.removed.push(resetPiece(p));
    log(s, `${card(p).name} is defeated and leaves play.`, "good");
  },
  dealEncounter,
  win: (s, reason) => endGame(s, true, reason),
  lose: (s, reason) => endGame(s, false, reason),
  discardPiece,
  activateEnemy: (s, enemyId, playerId, kind, sourceId) =>
    add(
      s,
      E("mansion-native:activate", {
        enemyId,
        playerId,
        kind,
        sourceId,
        actorId: playerId,
      }),
    ),
  searchAndRevealMinion: (s, name, playerId, after) => {
    revealHidden(s);
    const candidates = [...s.encounter.deck, ...s.encounter.discard].filter(
      (p) => card(p).type_code === "minion" && card(p).name === name,
    );
    if (!candidates.length) {
      mutagenPorts.shuffleEncounter(s);
      add(s, ...after);
    } else {
      const effects = (id: string) => [
        E("wideawake-native:reveal-searched", {
          id,
          playerId,
          after,
          actorId: playerId,
        }),
      ];
      if (candidates.length === 1) add(s, ...effects(candidates[0].id));
      else
        choose(
          s,
          name,
          "Choose a minion to reveal.",
          candidates.map((p) =>
            option(p.id, card(p).name, effects(p.id), undefined, p.code),
          ),
        );
    }
  },
  additionalBoost: (s) => {
    const activation = s.scheming || s.attack;
    if (!activation || activation.attacker !== s.villain.id) return;
    const p = drawEncounter(s);
    if (p) (activation.pendingBoosts ||= []).push(p);
  },
  exhaustIdentity: (s, playerId) => {
    seatView(s, playerId).player.exhausted = true;
  },
  stun: (s, target, source) =>
    add(s, E("status", { target, status: "stunned", source })),
  indirectDamage: (s, playerId, amount, sourceId) =>
    ironspiderPorts.indirect(s, {
      playerId,
      amount,
      sourceId,
      sourceTitle: "Pyro",
      after: E("mansion-native:after", { after: [], actorId: playerId }),
    }),
  discardRandomHand: (s, playerId) =>
    brotherhoodPorts.discardRandomHand(s, playerId, []),
  exhaustAlly: (s, id) => {
    const p = find(s, id);
    if (p) p.exhausted = true;
  },
  discardPlayerTop: (s, playerId, count, after) =>
    add(
      s,
      E("mansion-native:discard-player-top", {
        playerId,
        count,
        after,
        actorId: playerId,
      }),
    ),
  searchPlayerAlly: (s, playerId, sourceId) =>
    add(
      s,
      E("mansion-native:search-ally", {
        playerId,
        sourceId,
        actorId: playerId,
      }),
    ),
  addSideThreat: (s, target, amount, source) =>
    add(s, E("threat", { target, amount, source })),
};
function resolveMansionAttackNativeEffect(s: GameState, e: Effect): boolean {
  if (!e.type.startsWith("mansion-native:")) return false;
  switch (e.type) {
    case "mansion-native:after":
      add(s, ...(e.after || []));
      break;
    case "mansion-native:activate": {
      if (!find(s, e.enemyId)) break;
      const outerAttack = s.attack,
        outerScheme = s.scheming;
      s.attack = null;
      delete s.scheming;
      const request: MutagenActivation = {
        enemyId: e.enemyId,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
        after: E("mansion-native:activation-finish", {
          outerAttack,
          outerScheme,
          actorId: e.playerId,
        }),
      };
      if (e.kind === "attack") enemyAttack(s, e.enemyId, undefined, request);
      else enemyScheme(s, e.enemyId, undefined, request);
      break;
    }
    case "mansion-native:activation-finish":
      s.attack =
        e.outerAttack && find(s, e.outerAttack.attacker) ? e.outerAttack : null;
      if (e.outerScheme && find(s, e.outerScheme.attacker))
        s.scheming = e.outerScheme;
      else delete s.scheming;
      break;
    case "mansion-native:discard-player-top": {
      const previous = s.activePlayerId;
      activateSeat(s, e.playerId);
      const before = new Set(s.queue);
      let printedResourceIcons = 0;
      for (let i = 0; i < e.count; i++) {
        const result = discardNativePlayerTop(s);
        if (result.piece)
          printedResourceIcons += brotherhood.brotherhoodPrintedResources(
            result.piece,
          );
        if (!result.piece || result.emptied) break;
      }
      const generated = s.queue.filter((effect) => !before.has(effect));
      s.queue = s.queue.filter((effect) => before.has(effect));
      activateSeat(s, previous);
      add(
        s,
        ...generated,
        ...e.after.map((effect: Effect) => ({
          ...effect,
          printedResourceIcons,
          actorId: e.playerId,
        })),
      );
      break;
    }
    case "mansion-native:search-ally": {
      revealHidden(s);
      const player = seatView(s, e.playerId).player;
      const candidates = [...player.deck, ...player.discard].filter(
        (p) => card(p).type_code === "ally",
      );
      const effects = (id?: string) => [
        E("mansion-native:take-ally", {
          id,
          playerId: e.playerId,
          actorId: e.playerId,
        }),
      ];
      choose(
        s,
        "Protect the Students",
        "Search your deck and discard pile for an ally to add to your hand.",
        [
          ...candidates.map((p) =>
            option(p.id, card(p).name, effects(p.id), undefined, p.code),
          ),
          option("none", "Finish search", effects()),
        ],
      );
      break;
    }
    case "mansion-native:take-ally": {
      const player = seatView(s, e.playerId).player;
      for (const zone of [player.deck, player.discard]) {
        const index = zone.findIndex((p) => p.id === e.id);
        if (index >= 0) {
          player.hand.push(...zone.splice(index, 1));
          break;
        }
      }
      player.deck = shuffle(s, player.deck);
      break;
    }
    default:
      throw Error(`Unknown native Mansion Attack effect: ${e.type}`);
  }
  return true;
}
/** All Magneto ports move the existing source instance through native zones. */
const magnetoPorts: magneto.MagnetoPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  findPiece: (s, id) =>
    id === s.villain.id ? s.villain : wideawakePhysicalPiece(s, id),
  revealEncounter: (s, p, playerId, after) => {
    const actual = takeWideawakePiece(s, p.id) || p;
    removeEncounterInstance(s, p.id);
    beginResolution(s, actual);
    add(s, E("reveal", { piece: actual, actorId: playerId }), ...after);
  },
  revealSide: (s, p, playerId, after) => {
    const actual = takeWideawakePiece(s, p.id) || p;
    if (s.magneto?.orbital?.id === p.id) delete s.magneto.orbital;
    delete actual.pendingDefeat;
    actual.counters = 0;
    beginResolution(s, actual);
    add(s, E("reveal", { piece: actual, actorId: playerId }), ...after);
  },
  attach: (s, p, targetId) => {
    const actual = takeWideawakePiece(s, p.id) || p;
    delete actual.pendingDefeat;
    mutagenPorts.attach(s, actual, targetId);
    syncNebulaIdentityStatuses(s);
  },
  addToVictory: (s, p) => {
    const actual = takeWideawakePiece(s, p.id) || p;
    delete actual.pendingDefeat;
    (s.victoryDisplay ||= []).push(resetPiece(actual));
  },
  discardPiece,
  discardTop: (s, after) => {
    const before = new Set(s.queue);
    const result = mutagenPorts.discardTop(s);
    if (after) {
      const generated = s.queue.filter((effect) => !before.has(effect));
      s.queue = s.queue.filter((effect) => before.has(effect));
      add(s, ...generated, {
        ...after,
        id: result.piece?.id,
        code: result.piece?.code,
        emptied: result.emptied,
      });
    }
    return result;
  },
  searchAndReveal: (s, kind, playerId, after) => {
    const matches = [...s.encounter.deck, ...s.encounter.discard].filter((p) =>
      kind === "sentinel"
        ? p.code === "32146"
        : card(p).type_code === "attachment" &&
          /\bMagnetic\./i.test(card(p).traits || ""),
    );
    if (!matches.length) {
      mutagenPorts.shuffleEncounter(s);
      add(s, ...after);
      return;
    }
    const options = matches.map((p) =>
      option(
        p.id,
        card(p).name,
        [
          E("magneto-native:searched-reveal", {
            id: p.id,
            playerId,
            after,
            actorId: playerId,
          }),
        ],
        undefined,
        p.code,
      ),
    );
    if (options.length === 1) add(s, ...options[0].effects);
    else
      choose(
        s,
        "Search encounter deck and discard",
        "Choose the original encounter card to reveal.",
        options,
      );
  },
  dealEncounter,
  giveTough: (s, id) => {
    const p = find(s, id);
    return !!p && giveCharacterStatus(s, p, "tough");
  },
  giveFacedownBoost: (s, p) => {
    const actual = p ? takeWideawakePiece(s, p.id) || p : drawEncounter(s);
    if (actual) {
      removeEncounterInstance(s, actual.id);
      const activation = s.scheming || s.attack;
      if (
        activation?.attacker === s.villain.id &&
        !("completionRecorded" in activation && activation.completionRecorded)
      )
        (activation.pendingBoosts ||= []).push(resetPiece(actual));
      else (s.encounter.storedBoosts ||= []).push(resetPiece(actual));
    }
  },
  activateEnemy: (s, enemyId, playerId, kind, sourceId, after) =>
    add(
      s,
      E("magneto-native:activate", {
        enemyId,
        playerId,
        kind,
        sourceId,
        after,
        actorId: playerId,
      }),
    ),
  damageBatch: (s, targets, sourceId, playerId) =>
    wideawakePorts.damageBatch(s, targets, sourceId, playerId),
  status: (s, targetId, status, sourceId) =>
    add(s, E("status", { target: targetId, status, source: sourceId })),
  addMainThreat: (s, amount, sourceId) =>
    add(s, E("threat", { target: "main", amount, source: sourceId })),
  exhaustIdentity: (s, playerId) => {
    seatView(s, playerId).player.exhausted = true;
  },
  exhaustControlled: (s, playerId, kind) => {
    for (const p of seatView(s, playerId).player.inPlay)
      if (
        kind === "ally"
          ? card(p).type_code === "ally"
          : ["upgrade", "support"].includes(card(p).type_code)
      )
        p.exhausted = true;
  },
  defeatMinion: (s, id, playerId, after) => {
    const p = s.minions.find((p) => p.id === id);
    const before = new Set(s.queue);
    if (p) defeatCharacter(s, p, `hero:${playerId}`);
    const generated = s.queue.filter((effect) => !before.has(effect));
    s.queue = s.queue.filter((effect) => before.has(effect));
    add(s, ...generated, ...after);
  },
  discardPlayerTopUnder: (s, playerId, count, schemeId, after) =>
    add(
      s,
      E("magneto-native:store-player-top", {
        playerId,
        count,
        schemeId,
        after,
        actorId: playerId,
      }),
    ),
  discardStoredCards: (s, schemeId) => {
    const p = wideawakePhysicalPiece(s, schemeId);
    for (const stored of p?.storedCards?.splice(0) || []) {
      const owner = s.players.find((seat) => seat.id === stored.ownerId);
      if (!owner || owner.eliminated) s.removed.push(resetPiece(stored));
      else seatView(s, owner).player.discard.push(resetPiece(stored));
    }
  },
  discardHandCard: (s, playerId, id) => discardHand(seatView(s, playerId), id),
  canPay,
  pay: (s, title, cost, requirements, after, sourceId, exhaustPlayerId) => {
    const source = find(s, sourceId);
    need(source, "The original Magneto attachment is unavailable.");
    add(
      s,
      E("payRequest", {
        title,
        cost,
        requirements,
        after,
        piece: source,
        abilityCost: true,
        cancelable: true,
        cancellationQueue: [...s.queue],
        paymentCommit: exhaustPlayerId
          ? [E("exhaust", { id: "hero", actorId: exhaustPlayerId })]
          : undefined,
      }),
    );
  },
  canExhaustIdentity: (s, playerId) => !seatView(s, playerId).player.exhausted,
  registerAllyDefeatBoost: (s, sourceId, attackId) => {
    const attack = s.attack;
    if (attack?.id === attackId) {
      const ids = (attack.magnetoAllyDefeatBoostIds ||= []);
      if (!ids.includes(sourceId)) ids.push(sourceId);
    }
  },
};
function resolveMagnetoNativeEffect(s: GameState, e: Effect): boolean {
  if (!e.type.startsWith("magneto-native:")) return false;
  switch (e.type) {
    case "magneto-native:after":
      add(s, ...(e.after || []));
      break;
    case "magneto-native:setup-stage":
      villainSetup(s);
      break;
    case "magneto-native:main-back": {
      const p = s.magneto?.currentMain;
      need(
        p && p.code.endsWith("a"),
        "The original Magneto main front must resolve before its back.",
      );
      p!.code = p!.code.replace(/a$/, "b");
      s.scheme.code = p!.code;
      s.scheme.threat = (card(p!).base_threat || 0) * s.playerCount;
      delete s.pendingMainCompletion;
      add(s, ...(e.after || []));
      break;
    }
    case "magneto-native:searched-reveal": {
      const p = takeWideawakePiece(s, e.id);
      mutagenPorts.shuffleEncounter(s);
      if (p) magnetoPorts.revealEncounter(s, p, e.playerId, e.after || []);
      else add(s, ...(e.after || []));
      break;
    }
    case "magneto-native:store-player-top": {
      const previous = s.activePlayerId;
      activateSeat(s, e.playerId);
      const scheme = s.sideSchemes.find((p) => p.id === e.schemeId);
      const before = new Set(s.queue);
      if (scheme) {
        // Place the actual top-card cohort together. This is not a discard
        // effect or six sequential draws; empty-deck reset follows the move.
        const pieces = s.player.deck.splice(0, e.count);
        (scheme.storedCards ||= []).push(...pieces);
        if (pieces.length) revealHidden(s);
        recyclePlayer(s);
      }
      const generated = s.queue.filter((effect) => !before.has(effect));
      s.queue = s.queue.filter((effect) => before.has(effect));
      activateSeat(s, previous);
      add(s, ...generated, ...(e.after || []));
      break;
    }
    case "magneto-native:activate": {
      if (!find(s, e.enemyId)) break;
      // RRG 1.8: an activation initiated during an activation waits until the
      // first activation and its triggered abilities have completely finished.
      if (s.attack || s.scheming) {
        const boundary = s.queue.findIndex((q) =>
          ["defenseResponses", "endScheme"].includes(q.type),
        );
        if (boundary >= 0) {
          s.queue.splice(boundary + 1, 0, effectContext(s, e));
          break;
        }
        // During boost resolution, completion effects have not been queued
        // yet. The retained continuation will encounter their real boundary.
        const activation = s.scheming || s.attack;
        (activation!.afterActivation ||= []).push(effectContext(s, e));
        break;
      }
      const request: MutagenActivation = {
        enemyId: e.enemyId,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
        after: E("magneto-native:after", {
          after: e.after || [],
          actorId: e.playerId,
        }),
      };
      if (e.kind === "attack") enemyAttack(s, e.enemyId, undefined, request);
      else enemyScheme(s, e.enemyId, undefined, request);
      break;
    }
    case "magneto-native:basic-response": {
      const options = magneto.magnetoBasicAttackResponseOptions(
        s,
        e.receipt,
        magnetoPorts,
      );
      if (options.length)
        choose(
          s,
          "After your basic attack",
          "Spend energy, mental and physical resources to discard an attachment?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    default:
      throw Error(`Unknown Magneto native effect: ${e.type}`);
  }
  return true;
}

const masterMoldPorts: masterMold.MasterMoldPorts = {
  queue: add,
  choose,
  isTextBlank,
  hasTrait: captainPackHasTrait,
  isEngagedWith: (s, p, playerId) =>
    !p.engagedWith || p.engagedWith === playerId,
  findPiece: wideawakePhysicalPiece,
  findAlly: (s, id) => wideawakePorts.findAlly(s, id),
  putMagneto: (s, p, playerId) => {
    Object.assign(p, resetPiece(p, true));
    delete p.ownerId;
    need(
      !uniqueConflict(s, card(p)),
      "The unique Magneto ally is already in play.",
    );
    seatView(s, playerId).player.inPlay.push(p);
    add(s, E("allyEnter", { id: p.id, actorId: playerId, fromHand: false }));
  },
  transferAllyControl: hulkPackPorts.transferControl,
  healAlly: (s, id, amount, source) =>
    add(s, E("heal", { target: id, amount, source, origin: "player" })),
  discardTop: mutagenPorts.discardTop,
  putMinion: (s, p, playerId, after) => {
    const outerAttack = s.attack,
      outerScheme = s.scheming;
    const actorId = s.activePlayerId;
    s.attack = null;
    delete s.scheming;
    add(
      s,
      E("mystique-native:activation-finish", {
        outerAttack,
        outerScheme,
        after,
        actorId,
      }),
    );
    mutagenPorts.putMinion(s, p, playerId);
  },
  shuffleEncounterDiscard: (s) => {
    s.encounter.deck.push(...s.encounter.discard.splice(0));
    mutagenPorts.shuffleEncounter(s);
  },
  attach: (s, p, targetId, boost) => {
    if (boost) {
      const activation = s.scheming || s.attack;
      if (activation && !activation.retainedBoostIds?.includes(p.id))
        (activation.retainedBoostIds ||= []).push(p.id);
    }
    mutagenPorts.attach(s, p, targetId);
  },
  activateEnemy: (s, enemyId, playerId, kind, sourceId) =>
    add(
      s,
      E("mastermold-native:activate", {
        enemyId,
        playerId,
        kind,
        sourceId,
        actorId: playerId,
      }),
    ),
  giveTough: (s, id) => {
    const p = find(s, id);
    return !!p && giveCharacterStatus(s, p, "tough");
  },
  surge: (s, playerId, sourceId, sourceCode) =>
    add(s, E("surge", { sourceId, sourceCode, actorId: playerId })),
  damageBatch: (s, targets, sourceId, playerId) =>
    wideawakePorts.damageBatch(s, targets, sourceId, playerId),
  stun: (s, target, source) =>
    add(s, E("status", { target, status: "stunned", source })),
};
function resolveMasterMoldNativeEffect(s: GameState, e: Effect): boolean {
  if (!e.type.startsWith("mastermold-native:")) return false;
  switch (e.type) {
    case "mastermold-native:main-back":
      s.scheme.code = "32113b";
      s.scheme.threat = s.playerCount;
      log(s, "The main scheme advances: Master Mold's Agenda.", "bad");
      break;
    case "mastermold-native:activate": {
      if (!find(s, e.enemyId)) break;
      const outerAttack = s.attack,
        outerScheme = s.scheming;
      s.attack = null;
      delete s.scheming;
      const request: MutagenActivation = {
        enemyId: e.enemyId,
        playerId: e.playerId,
        kind: e.kind,
        modifier: 0,
        after: E("mystique-native:activation-finish", {
          outerAttack,
          outerScheme,
          after: [],
          actorId: e.playerId,
        }),
      };
      if (e.kind === "attack") enemyAttack(s, e.enemyId, undefined, request);
      else enemyScheme(s, e.enemyId, undefined, request);
      break;
    }
    case "mastermold-native:ally-response": {
      const options = masterMold.masterMoldAllyAttackResponseOptions(
        s,
        e.receipt,
        masterMoldPorts,
      );
      if (options.length)
        choose(
          s,
          "Magneto",
          "Heal 1 damage after defeating a Sentinel minion?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    default:
      throw Error(`Unknown Master Mold native effect: ${e.type}`);
  }
  return true;
}
function resolveWideawakeNativeEffect(s: GameState, e: Effect): boolean {
  if (!e.type.startsWith("wideawake-native:")) return false;
  switch (e.type) {
    case "wideawake-native:setup-stage":
      villainSetup(s);
      break;
    case "wideawake-native:damage-batch":
      resolve(
        s,
        E("quicksilverDamageDistribution", {
          packets: e.targets.map((t: { id: string; amount: number }) => ({
            target: t.id,
            amount: t.amount,
          })),
          source: e.source,
        }),
      );
      break;
    case "wideawake-native:ally-response": {
      const options = wideawake.projectWideawakeAllyAttackResponseOptions(
        s,
        e.receipt,
        wideawakePorts,
      );
      if (options.length)
        choose(
          s,
          "After this ally attacks",
          "Use the ally's printed response?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    case "wideawake-native:attack-forced": {
      const receipt = e.receipt as zeroTolerance.ZeroToleranceAttackReceipt;
      receipt.defeatedAllies = s.zeroToleranceDefeats?.[receipt.token] || [];
      if (s.zeroToleranceDefeats) delete s.zeroToleranceDefeats[receipt.token];
      const effects = zeroTolerance.zeroToleranceAfterAttack(
        s,
        receipt,
        zeroTolerancePorts,
      );
      const responses = effects.map((effect, index) => ({
        id: `${receipt.token}:zero-tolerance:${index}`,
        title: effect.schemeId ? "Operation Zero Tolerance" : "Energy Barrier",
        effects: [effect],
      }));
      add(
        s,
        E("forcedResponses", {
          responses: [...responses, ...e.responses],
          actorId: s.firstPlayerId,
        }),
      );
      break;
    }
    case "wideawake-native:reveal-searched": {
      const inDeck = s.encounter.deck.some((p) => p.id === e.id);
      const p = [...s.encounter.deck, ...s.encounter.discard].find(
        (p) => p.id === e.id,
      );
      if (p) removeEncounterInstance(s, p.id);
      if (!e.shuffled) mutagenPorts.shuffleEncounter(s);
      add(
        s,
        ...(p
          ? [
              E("reveal", {
                piece: p,
                actorId: e.playerId,
                fromEncounterDeck: inDeck,
              }),
            ]
          : []),
        ...e.after,
      );
      break;
    }
    case "wideawake-native:capture-top": {
      const before = new Set(s.queue);
      recyclePlayer(s);
      const operation = s.sideSchemes.find((p) => p.code === "32104");
      const piece = operation ? s.player.deck.shift() : undefined;
      if (piece && operation) {
        (operation.captured ||= []).push(piece);
        log(
          s,
          "Place one deck card facedown under Operation Zero Tolerance.",
          "bad",
        );
      }
      recyclePlayer(s);
      const generated = s.queue.filter((q) => !before.has(q));
      s.queue = s.queue.filter((q) => before.has(q));
      zeroTolerance.zeroToleranceCheckLoss(s, zeroTolerancePorts);
      if (!["won", "lost"].includes(s.phase))
        add(
          s,
          ...generated,
          ...e.after.map((effect: Effect) => ({
            ...effect,
            captured: !!piece,
          })),
        );
      break;
    }
    case "wideawake-native:capture-card": {
      const operation = s.sideSchemes.find((p) => p.code === "32104");
      if (operation) wideawakeCapture(s, operation.id, e.id, e.after);
      else add(s, ...e.after);
      break;
    }
    default:
      throw Error(`Unknown Wideawake native effect: ${e.type}`);
  }
  return true;
}
const sabretoothPorts: sabretooth.SabretoothPorts = {
  queue: add,
  choose,
  putSetupSideScheme: (s, p, threat) => {
    mutagenPorts.putSideScheme(s, p);
    p.counters = threat;
  },
  advanceMain: (s, frontCode, after) => {
    discardMainAttachments(s);
    s.scheme.index = 1;
    s.scheme.code = frontCode;
    s.scheme.threat = 0;
    s.pendingMainCompletion = false;
    log(s, `The main scheme advances: ${card(frontCode).name}.`, "bad");
    add(
      s,
      ...sabretooth.sabretoothMainRevealed(s, frontCode),
      E("sabretooth-native:main-back", { after, actorId: s.firstPlayerId }),
    );
  },
  flipFind: (s, p) => {
    const index = s.sideSchemes.findIndex((source) => source.id === p.id);
    need(
      index >= 0 && p.code === "32065a",
      "The actual Find the Senator source is unavailable.",
    );
    for (const attached of [...allInPlay(s), ...s.attachments].filter(
      (source) => source.attachedTo === p.id,
    ))
      discardPiece(s, attached.id);
    s.sideSchemes.splice(index, 1);
    p.code = "32065b";
    p.counters = 0;
    delete p.pendingDefeat;
    (s.environments ||= []).push(p);
    log(s, "Find the Senator flips to Protect the Senator.", "good");
  },
  attach: (s, p, target) => {
    const activation = s.scheming || s.attack;
    if (activation?.boostIds?.includes(p.id)) {
      const retained = (activation.retainedBoostIds ||= []);
      if (!retained.includes(p.id)) retained.push(p.id);
    }
    mutagenPorts.attach(s, p, target);
  },
  discardPiece,
  discardTop: mutagenPorts.discardTop,
  damage: (s, target, amount, source) =>
    add(s, E("damage", { target, amount, source, origin: "encounter" })),
  heal: (s, target, amount, source) =>
    add(s, E("heal", { target, amount, source, origin: "encounter" })),
  defeatKelly: (s, id, source) =>
    add(s, E("sabretooth-native:defeat-kelly", { id, source })),
  lose: (s, reason) => endGame(s, false, reason),
  dealEncounter,
  canExhaustHero: (s) => s.player.form === "hero" && !s.player.exhausted,
  exhaustHero: (s) => {
    need(
      s.player.form === "hero" && !s.player.exhausted,
      "Sabretooth Strikes requires a ready hero.",
    );
    s.player.exhausted = true;
  },
  canReadyHero: (s) => s.player.exhausted && canReadyIdentity(s),
  readyHero: (s) => {
    readyIdentity(s);
  },
  canPay,
  pay: (s, title, cost, requirements, after, sourceId) => {
    const source = find(s, sourceId);
    need(source, "The actual Sabretooth ability source is unavailable.");
    add(
      s,
      E("payRequest", {
        title,
        cost,
        requirements,
        after,
        piece: source,
        abilityCost: true,
        cancelable: true,
        cancellationQueue: [...s.queue],
      }),
    );
  },
  registerAllyDefeatBoost: (s, sourceId, attackId) => {
    const attack = s.attack;
    if (!attack || attack.id !== attackId) return;
    const sources = (attack.sabretoothAllyDefeatBoostIds ||= []);
    if (!sources.includes(sourceId)) sources.push(sourceId);
  },
};
function resolveSabretoothNativeEffect(s: GameState, e: Effect): boolean {
  if (!e.type.startsWith("sabretooth-native:")) return false;
  switch (e.type) {
    case "sabretooth-native:main-back":
      need(
        s.scheme.code === "32064a",
        "The Injured Senator front must resolve before its back.",
      );
      s.scheme.code = "32064b";
      s.scheme.threat = (card(s.scheme.code).base_threat || 0) * s.playerCount;
      add(s, ...(e.after || []));
      break;
    case "sabretooth-native:defeat-kelly": {
      const kelly = sabretooth.sabretoothKelly(s);
      if (kelly && kelly.id === e.id) defeatCharacter(s, kelly, e.source);
      break;
    }
    default:
      throw Error(`Unknown native Sabretooth effect: ${e.type}`);
  }
  return true;
}

function mystiqueNativePhysicalZones(s: GameState): Piece[][] {
  return [
    s.encounter.deck,
    s.encounter.discard,
    s.encounter.dealt,
    s.resolving,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [p.deck, p.hand, p.discard, p.inPlay, p.setAside || []];
    }),
  ];
}
function mystiqueNativeTake(s: GameState, id: string): Piece {
  const zones = mystiqueNativePhysicalZones(s);
  need(
    zones.flatMap((z) => z.filter((p) => p.id === id)).length === 1,
    "Mystique requires one actual physical card in its source zone.",
  );
  const zone = zones.find((z) => z.some((p) => p.id === id))!;
  return zone.splice(
    zone.findIndex((p) => p.id === id),
    1,
  )[0];
}
/** Outer defense persists while a nested explicit Mystique activation runs. */
function mystiqueNativeOuterDefending(s: GameState, playerId: string): boolean {
  const callbacks = [
    s.attack?.activationAfter,
    s.scheming?.activationAfter,
    ...s.queue.filter((e) => e.type === "mystique-native:activation-finish"),
  ];
  const defending = (e: Effect | undefined): boolean => {
    const a = e?.outerAttack as GameState["attack"] | undefined;
    return (
      !!a &&
      ((a.defender === "hero" &&
        (a.targetPlayerId || a.originalPlayerId) === playerId) ||
        a.defender === `hero:${playerId}` ||
        defending(a.activationAfter))
    );
  };
  return callbacks.some(defending);
}
function resolveMystiqueNativeEffect(s: GameState, e: Effect): boolean {
  if (!e.type.startsWith("mystique-native:")) return false;
  switch (e.type) {
    case "mystique-native:draw-to-hand-size":
      mystiqueNativeDrawToHandSize(s, { ...e });
      break;
    case "mystique-native:return-actor":
      if (s.players.some((p) => p.id === e.playerId && !p.eliminated))
        activateSeat(s, e.playerId);
      break;
    case "mystique-native:activate": {
      if (!s.minions.some((p) => p.id === e.enemyId)) {
        add(s, ...(e.after || []));
        break;
      }
      const outerAttack = s.attack,
        outerScheme = s.scheming;
      const after = E("mystique-native:activation-finish", {
        outerAttack,
        outerScheme,
        after: e.after || [],
        actorId: e.playerId,
        eventId: undefined,
        attackProgramId: undefined,
        responseGroup: undefined,
      });
      s.attack = null;
      delete s.scheming;
      const request: MutagenActivation = {
        playerId: e.playerId,
        enemyId: e.enemyId,
        kind: s.player.form === "hero" ? "attack" : "scheme",
        modifier: 0,
        after,
      };
      if (request.kind === "attack")
        enemyAttack(s, e.enemyId, undefined, request);
      else enemyScheme(s, e.enemyId, undefined, request);
      break;
    }
    case "mystique-native:activation-finish":
      s.attack = e.outerAttack || null;
      if (e.outerScheme) s.scheming = e.outerScheme;
      else delete s.scheming;
      add(s, ...(e.after || []));
      break;
    default:
      throw Error(`Unknown Mystique native callback: ${e.type}`);
  }
  return true;
}
const mystiquePorts: mystique.MystiquePorts = {
  queue: add,
  choose,
  isTextBlank,
  villainStats: (s) => enemyStats(s, s.villain),
  controlledPieces: (s) => [...s.player.inPlay, ...controlledNPCs(s)],
  canDiscardControlled: (s, p) =>
    [...s.player.inPlay, ...controlledNPCs(s)].some((a) => a.id === p.id) &&
    !isPermanent(card(p)) &&
    valkyrie.valkyrieCanDiscardAttachment(s, p),
  discardControlled: (s, id, after) => {
    const before = s.queue.length;
    discardPiece(s, id);
    const generated = s.queue.splice(0, s.queue.length - before);
    add(s, ...generated, ...after);
  },
  shuffleIntoPlayerDeck: (s, ids, playerId, after) => {
    need(
      new Set(ids).size === ids.length,
      "Shuffle each physical Shapeshifter once.",
    );
    const pieces = ids.map((id) => mystiqueNativeTake(s, id));
    const view = seatView(s, playerId);
    view.player.deck.push(...pieces);
    view.player.deck = shuffle(s, view.player.deck);
    view.flags.warlockDeckEmptyObserved = false;
    add(s, ...after);
  },
  activateMystique: (s, enemyId, playerId, after) =>
    add(
      s,
      E("mystique-native:activate", {
        enemyId,
        playerId,
        after,
        actorId: playerId,
        eventId: undefined,
        attackProgramId: undefined,
        responseGroup: undefined,
      }),
    ),
  revealSearchedMystique: (s, id, playerId, after) => {
    const fromEncounterDeck = s.encounter.deck.some((p) => p.id === id);
    const p = mystiqueNativeTake(s, id);
    const before = s.queue.length;
    if (fromEncounterDeck) recycleEncounter(s);
    const exhaustion = s.queue.splice(0, s.queue.length - before);
    add(
      s,
      ...exhaustion,
      E("reveal", { piece: p, actorId: playerId, fromEncounterDeck }),
      ...after,
    );
  },
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  revealHidden,
};

const acolytesPorts: acolytes.AcolytesPorts = {
  queue: add,
  activate: (s, id, playerId) =>
    mystiquePorts.activateMystique(s, id, playerId, []),
  discardUntil: (s, trait, after) =>
    brotherhoodPorts.discardUntilMinion(s, trait, after),
  reveal: (s, p, playerId, after) =>
    brotherhoodPorts.revealDiscardedMinion(s, p, playerId, after),
  put: (s, p, playerId, after) => {
    const before = s.queue.length;
    mutagenPorts.putMinion(s, p, playerId);
    const entered = s.queue.splice(0, s.queue.length - before);
    // Fabian's When Defeated finishes and he leaves play BEFORE the new
    // minion's Teamwork window (official June 17, 2025 ruling).
    add(s, ...after, ...entered);
  },
  boost: (s) => {
    const p = drawEncounter(s);
    if (p) (s.encounter.storedBoosts ||= []).push(p);
  },
  clearVillainStatuses: (s) => {
    s.villain.stunCards = s.villain.confuseCards = 0;
    s.villain.stunned = s.villain.confused = false;
  },
  shuffle: (s) => {
    const selected = s.encounter.discard.filter(acolytes.acolyte);
    s.encounter.discard = s.encounter.discard.filter(
      (p) => !selected.includes(p),
    );
    s.encounter.deck.push(...selected);
    mutagenPorts.shuffleEncounter(s);
    revealHidden(s);
  },
};

const inheritorsPorts: inheritors.InheritorsPorts = {
  queue: add,
  choose,
  discardTop: mutagenPorts.discardTop,
  putMinion: mutagenPorts.putMinion,
  hasTrait: captainPackHasTrait,
  controlledCharacters: (s) => targets(s, "controlled"),
  statusEligible: dsPorts.canAddStatus,
  canDiscardControlled: (s, p) => zzzaxPorts.canDiscardControlled(s, p),
  discardControlled: discardPiece,
  giveBoost: (s, id) => {
    const enemy = s.minions.find((p) => p.id === id);
    if (!enemy) return;
    const boost = drawEncounter(s);
    if (boost) (enemy.inheritorBoosts ||= []).push(boost);
  },
  damageSimultaneously: (s, ids, amount, source) =>
    spectrumPorts.damageBatch(
      s,
      ids.map((id) => (id === "hero" ? `hero:${s.activePlayerId}` : id)),
      amount,
      source,
    ),
};
function inheritorsAcceleration(s: GameState) {
  return s.minions.reduce(
    (total, p) => total + inheritors.inheritorsModifiers(s, p).acceleration,
    0,
  );
}
function minionWillEnter(s: GameState, p: Piece) {
  gamora.gamoraMinionWillEnter(s, p, gamoraPorts);
  nebula.nebulaMinionWillEnter(s, p, nebulaPorts);
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
  if (mansionAttack.mansionAttackModifiers(s, p, { isTextBlank }).toughness)
    giveCharacterStatus(s, p, "tough");
  if (underlying) p.droneCard = underlying;
  p.engagedWith = s.activePlayerId;
  s.resolving = s.resolving.filter((x) => x.id !== p.id);
  log(
    s,
    `${card(p).name} engages ${HEROES.find((h) => h.id === s.heroId)!.name}.`,
    "bad",
  );
  add(
    s,
    ...masterMold.masterMoldMinionEngaged(
      s,
      {
        token: `engagement:${s.nextId++}`,
        minionId: p.id,
        playerId: s.activePlayerId,
      },
      { isTextBlank },
    ),
    ...rogue.rogueMinionEntered(s, p),
    ...acolytes.acolytesEngaged(s, p),
    ...ironspider.ironspiderSinisterEngagementResponses(s, p),
    ...spiderHam.spiderHamMinionEngaged(s, p),
    E("valkPackEngagementWindow", { id: p.id }),
    E("minionReactions", { id: p.id }),
    ...thorEngagementResponses(s, p),
  );
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
/** Old Rivals retains the actual player source in a saved activation receipt.
 * A hero projection supplies printed identity metadata only; no duplicate card
 * enters a zone and status costs always mutate the original player's identity. */
function nebulaAttackSource(s: GameState) {
  return s.attack?.activationAfter?.nebulaGamoraSource as
    nebula.NebulaAttackSource | undefined;
}
function nebulaNativeAttacker(
  s: GameState,
  id: string,
  source = nebulaAttackSource(s),
): Piece | undefined {
  if (source?.kind !== "hero") return find(s, id);
  const seat = s.players.find(
    (seat) => seat.id === source.playerId && !seat.eliminated,
  );
  if (!seat) return;
  const view = seatView(s, seat);
  if (view.player.form !== "hero" || heroCard(view).name !== "Gamora") return;
  return {
    ...view.player,
    id: source.id,
    code: heroCard(view).code,
    damage: 0,
    counters: 0,
    ownerId: seat.id,
  };
}
function nebulaNativeAttackStrength(
  s: GameState,
  p: Piece,
  recipientId: string,
  source = nebulaAttackSource(s),
) {
  if (source?.kind === "hero")
    return heroStats(seatView(s, source.playerId!)).attack;
  if (source?.kind === "ally") {
    const seat = controller(s, source.id);
    return seat ? allyStat(seatView(s, seat), p, "attack") : 0;
  }
  return enemyATK(s, p, recipientId);
}
function sinisterNativeTraits(s: GameState, p: Piece): string[] {
  const traits = (card(p).traits || "")
    .split(/\.\s+/)
    .map((t) => t.replace(/\.$/, ""))
    .filter(Boolean);
  if ((card(p).traits || "").includes("S.H.I.E.L.D."))
    traits.push("S.H.I.E.L.D.");
  for (const t of [
    "Avenger",
    "Guardian",
    "Aerial",
    "Web-Warrior",
    "S.H.I.E.L.D.",
  ])
    if (captainPackHasTrait(s, p.id, t) && !traits.includes(t)) traits.push(t);
  return traits;
}
function sinisterNativeHasTrait(s: GameState, id: string, trait: string) {
  const identityId =
    id === "hero"
      ? s.activePlayerId
      : id.startsWith("hero:")
        ? id.slice(5)
        : undefined;
  const printed = identityId
    ? heroCard(seatView(s, identityId))
    : card(find(s, id)!);
  return (
    (!!identityId &&
      cable.cableTraits(seatView(s, identityId)).includes(trait)) ||
    (trait === "X-Force" && angel.angelRecruitBonus(s, id) > 0) ||
    (trait === "S.H.I.E.L.D." && !!printed.traits?.includes(trait)) ||
    captainPackHasTrait(s, id, trait) ||
    (!!identityId &&
      (phoenix.phoenixTraits(seatView(s, identityId)).includes(trait) ||
        rogue
          .rogueTraits(seatView(s, identityId), rogueNativeTraits)
          .includes(trait)))
  );
}
function sinisterNativePiece(s: GameState, id: string) {
  return [
    ...allInPlay(s),
    ...s.minions,
    ...s.sideSchemes,
    ...s.attachments,
    ...(s.environments || []),
    ...s.resolving,
    ...s.encounter.deck,
    ...s.encounter.discard,
    ...s.encounter.dealt,
    ...s.players.flatMap((seat) => {
      const p = seatView(s, seat).player;
      return [...p.hand, ...p.deck, ...p.discard];
    }),
  ].find((p) => p.id === id);
}
function sinisterNativeDamageOptions(
  s: GameState,
  packet: Effect,
  after: Effect[],
): Option[] {
  const actor = s.activePlayerId;
  const target = packet.target === "hero" ? `hero:${actor}` : packet.target;
  if (!target?.startsWith("hero:")) return [];
  const owner = target.slice(5);
  const token =
    packet.damageWindowId ||
    (packet.sinisterDamageToken ||= `sinister-damage:${s.nextId++}`);
  const receipt: sinisterPlayerPack.SinisterPlayerDamageReceipt = {
    token,
    playerId: owner,
    target,
    amount: packet.amount,
    attack:
      packet.kind === "attack" ||
      packet.kind === "overkill" ||
      !!packet.inAttack ||
      !!packet.attack,
  };
  seatView(s, owner).flags[`sinisterDamage:${token}`] = JSON.stringify(packet);
  return sinisterPlayerPack
    .sinisterPlayerPackJumpFlipOptions(
      seatView(s, owner),
      receipt,
      after.map((e) => ({ ...e, actorId: actor })),
      sinisterPlayerPackPorts,
    )
    .map((o) => ({
      ...o,
      id: `sinister:${owner}:${o.id}`,
      effects: o.effects.map((e) => ({ ...e, actorId: owner })),
    }));
}
const sinisterPlayerPackPorts: sinisterPlayerPack.SinisterPlayerPackPorts = {
  queue: add,
  choose,
  isTextBlank,
  traits: sinisterNativeTraits,
  identityHasTrait: (s, trait) => sinisterNativeHasTrait(s, "hero", trait),
  identityName: (s) => card(HEROES.find((h) => h.id === s.heroId)!.alter).name,
  identityMaxHP: maxHP,
  canReadyIdentity: (s, id) => {
    const v = seatView(s, id);
    return v.player.exhausted && canReadyIdentity(v);
  },
  canReadyPiece: (s, p) =>
    !!p.exhausted && warMachinePackPorts.canReady(s, p.id),
  canGiveStatus: dsPorts.canAddStatus,
  controlledTraitCards: (s, trait, readyOnly) => {
    const list = s.player.inPlay
      .filter(
        (p) =>
          sinisterNativeHasTrait(s, p.id, trait) &&
          (!readyOnly || !p.exhausted),
      )
      .map((p) => ({ id: p.id, label: card(p).name, code: p.code }));
    if (
      sinisterNativeHasTrait(s, "hero", trait) &&
      (!readyOnly || !s.player.exhausted)
    )
      list.unshift({
        id: `hero:${s.activePlayerId}`,
        label: heroCard(s).name,
        code: heroCard(s).code,
      });
    return list;
  },
  characterTargets: (s, trait, exclude) =>
    targets(s, "friendly")
      .map((t) => ({
        ...t,
        id: t.id === "hero" ? `hero:${s.activePlayerId}` : t.id,
      }))
      .filter(
        (t) =>
          t.id !== exclude &&
          sinisterNativeHasTrait(s, t.id, trait) &&
          (t.id.startsWith("hero:")
            ? sinisterPlayerPackPorts.canReadyIdentity(s, t.id.slice(5))
            : !!find(s, t.id)?.exhausted &&
              card(find(s, t.id)!).type_code === "ally" &&
              sinisterPlayerPackPorts.canReadyPiece(s, find(s, t.id)!)),
      ),
  exhaustCards: (s, ids) => {
    need(
      new Set(ids).size === ids.length &&
        ids.every((id) =>
          id === `hero:${s.activePlayerId}`
            ? !s.player.exhausted
            : s.player.inPlay.some((p) => p.id === id && !p.exhausted),
        ),
      "The additional cost needs distinct ready controlled cards.",
    );
    for (const id of ids)
      if (id === `hero:${s.activePlayerId}`) s.player.exhausted = true;
      else s.player.inPlay.find((p) => p.id === id)!.exhausted = true;
  },
  cardCost: (s, p) => cardCost(s, card(p), p),
  handPlayableCards: (s) => [
    ...s.player.hand,
    ...visionPack.visionPackStoredPlayable(s, visionPackPorts),
    ...ghostSpider.ghostSpiderStoredPlayable(s, ghostSpiderPorts),
  ],
  canPlayWithDiscount: (s, p, discount, exhaustId) => {
    const costSource = exhaustId
      ? s.player.inPlay.find((p) => p.id === exhaustId)
      : undefined;
    const wasExhausted = costSource?.exhausted;
    if (costSource) costSource.exhausted = true;
    try {
      return antPackPorts.playableWithDiscount(s, p, discount);
    } finally {
      if (costSource) costSource.exhausted = !!wasExhausted;
    }
  },
  canPay: (s, cost, requirements = [], exclude, code) =>
    canPay(s, cost, requirements, exclude, code),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  attackProgram: bwPorts.attackProgram,
  attackVillain: (s, playerId, after) =>
    add(s, E("sinisterNativeAttack", { playerId, after })),
  discardHand: (s, id) => {
    const i = s.player.hand.findIndex((p) => p.id === id);
    need(i >= 0, "The actual hand discard cost is unavailable.");
    s.player.discard.push(resetPiece(s.player.hand.splice(i, 1)[0]));
  },
  discardControlled: discardPiece,
  discardRandomHand: (s, after) => {
    revealHidden(s);
    randomDiscard(s);
    add(s, ...after);
  },
  revealHidden,
  shuffleEncounter: (s, after) => {
    mutagenPorts.shuffleEncounter(s);
    add(s, ...after);
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  discardTopEncounter: (s, count, after) => {
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const p = drawEncounter(s);
      if (!p) break;
      s.encounter.discard.push(p);
      ids.push(p.id);
    }
    add(s, ...after.map((e) => ({ ...e, discardedIds: ids })));
  },
  discardUntilTreachery: (s, after) => {
    let found: Piece | undefined;
    const available = s.encounter.deck.length + s.encounter.discard.length;
    for (let i = 0; i < available; i++) {
      const p = drawEncounter(s);
      if (!p) break;
      s.encounter.discard.push(p);
      if (card(p).type_code === "treachery") {
        found = p;
        break;
      }
    }
    add(s, ...after.map((e) => ({ ...e, treacheryId: found?.id })));
  },
  revealDiscardedCost: (s, id, after) => {
    const p = s.encounter.discard.find((p) => p.id === id);
    need(
      p && card(p).type_code === "treachery",
      "The actual discarded treachery is unavailable.",
    );
    removeEncounterInstance(s, id);
    add(s, E("reveal", { piece: p }), ...after);
  },
  countEncounterIcons: (s, ids, includeStar, after) => {
    const pieces = ids
      .map((id) => sinisterNativePiece(s, id))
      .filter((p): p is Piece => !!p);
    add(
      s,
      ...scarletWitch.scarletWitchCountBoosts(s, pieces, after, {
        sourceTitle: "Encounter icons",
        includeStar,
      }),
    );
  },
  healIdentityCost: (s, amount, after) =>
    add(s, E("heal", { target: `hero:${s.activePlayerId}`, amount }), ...after),
  damageAllyCost: (s, id, amount, after) =>
    add(
      s,
      E("damage", { target: id, amount, source: id, attack: false }),
      ...after,
    ),
  canPutCard: (s, p) =>
    ["ally", "support", "upgrade"].includes(card(p).type_code) &&
    !uniqueConflict(s, card(p)),
  putCard: (s, id, after) => add(s, E("sinisterNativePut", { id, after })),
  playFromHand: (s, id, discount, after) =>
    add(
      s,
      E("visionPackMeditationPlay", {
        id,
        discount,
        after,
        sinisterGovernment: true,
      }),
    ),
  payRepeat: (s, playerId, cost, afterSuccess, afterDecline) =>
    add(
      s,
      E("payRequest", {
        actorId: playerId,
        title: "Across the Spider-Verse · repeat ability",
        cost,
        abilityCost: true,
        cancelable: true,
        after: afterSuccess,
        cancellationQueue: afterDecline,
      }),
    ),
  addBasicPowerBonus: (s, receipt, amount) => {
    s.flags[`sinisterPower:${receipt.token}`] =
      Number(s.flags[`sinisterPower:${receipt.token}`] || 0) + amount;
  },
  damageAvailable: (s, receipt) =>
    !!s.flags[`sinisterDamage:${receipt.token}`] && receipt.amount > 0,
  preventDamage: (s, receipt, amount, after) => {
    const packet = JSON.parse(
      String(s.flags[`sinisterDamage:${receipt.token}`] || "null"),
    ) as Effect;
    need(packet, "This actual damage window has ended.");
    preventNativeIdentityDamage(s, packet, amount);
    add(s, ...after);
  },
  playJumpFlip: (s, id, receipt, after) => {
    const p = sinisterPlayerPackPorts.handPlayableCards!(s).find(
      (p) => p.id === id,
    );
    need(p && p.code === "27014", "Jump Flip needs its actual playable event.");
    const packet = JSON.parse(
      String(s.flags[`sinisterDamage:${receipt.token}`] || "null"),
    ) as Effect;
    add(
      s,
      E("payRequest", {
        title: "Jump Flip",
        cost: cardCost(s, card(p!), p),
        piece: p,
        cancelable: true,
        after: [
          E("resolveHandEvent", {
            id,
            after: [E("sinisterNativeJump", { receipt })],
            continuation: after,
          }),
        ],
        commit: receipt.attack
          ? [E("sinisterNativeClaimDefense", { packet })]
          : [],
        cancellationQueue: after,
      }),
    );
  },
  consequentialAvailable: (s, receipt) =>
    !!find(s, receipt.allyId) &&
    Number(s.flags[`sinisterConsequential:${receipt.token}`]) > 0,
  preventConsequential: (s, receipt, amount, after) => {
    const key = `sinisterConsequential:${receipt.token}`;
    need(
      sinisterPlayerPackPorts.consequentialAvailable(s, receipt),
      "This consequential damage packet is no longer pending.",
    );
    s.flags[key] = Math.max(0, Number(s.flags[key]) - amount);
    add(s, ...after);
  },
  lookDeck: (s, playerId, encounter, count, after) => {
    revealHidden(s);
    const deck = encounter
      ? s.encounter.deck
      : seatView(s, playerId!).player.deck;
    const deckReceipt = {
      token: `look:${s.nextId++}`,
      playerId,
      encounter,
      ids: deck.slice(0, count).map((p) => p.id),
    };
    add(s, ...after.map((e) => ({ ...e, deckReceipt })));
  },
  arrangeDeck: (s, receipt, discard, top, bottom, after) => {
    const ids = [...discard, ...top, ...bottom];
    need(
      ids.length === receipt.ids.length &&
        new Set(ids).size === ids.length &&
        ids.every((id) => receipt.ids.includes(id)),
      "Global Logistics must arrange every actual looked-at card once.",
    );
    const view = receipt.encounter ? s : seatView(s, receipt.playerId!);
    const deck = receipt.encounter ? s.encounter.deck : view.player.deck;
    need(
      receipt.ids.every((id) => deck.some((p) => p.id === id)),
      "A looked-at card is no longer in the actual deck.",
    );
    const held = new Map(
      deck.filter((p) => receipt.ids.includes(p.id)).map((p) => [p.id, p]),
    );
    const rest = deck.filter((p) => !held.has(p.id));
    deck.splice(
      0,
      deck.length,
      ...top.map((id) => held.get(id)!),
      ...rest,
      ...bottom.map((id) => held.get(id)!),
    );
    const pile = receipt.encounter ? s.encounter.discard : view.player.discard;
    pile.push(...discard.map((id) => resetPiece(held.get(id)!)));
    if (receipt.encounter) recycleEncounter(s);
    else {
      const actor = s.activePlayerId;
      activateSeat(s, receipt.playerId!);
      recyclePlayer(s);
      activateSeat(s, actor);
    }
    add(s, ...after);
  },
};

function ghostNativeActivationWindow(
  s: GameState,
  enemyId: string,
  kind: "attack" | "scheme",
  continuation: Effect,
): boolean {
  if (s.flags.ghostActivationResuming) return false;
  const actor = s.activePlayerId;
  const receipt: ghostSpider.GhostSpiderActivationReceipt = {
    token: `activation:${s.nextId++}`,
    enemyId,
    playerId: actor,
    kind,
  };
  const next = E("ghostNativeActivationResume", {
    receipt,
    continuation,
    actorId: actor,
  });
  s.flags[`ghostActivation:${receipt.token}`] = true;
  const options = playerOrder(s).flatMap((seat) =>
    ghostSpider
      .ghostSpiderActivationOptions(
        seatView(s, seat),
        receipt,
        [next],
        ghostSpiderPorts,
      )
      .map((o) => ({
        ...o,
        id: `${seat.id}:${o.id}`,
        effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
      })),
  );
  if (!options.length) {
    delete s.flags[`ghostActivation:${receipt.token}`];
    return false;
  }
  choose(
    s,
    "Enemy would activate",
    "Choose an interrupt before this actual activation.",
    [...options, option("continue", "Continue activation", [next])],
  );
  return true;
}
function ghostNativeEventReceipt(
  s: GameState,
  id?: string,
): ghostSpider.GhostSpiderEventReceipt | undefined {
  if (!id || !s.flags[`ghostEvent:${id}`]) return;
  return JSON.parse(String(s.flags[`ghostEvent:${id}`]));
}
function ghostNativeEventOptions(
  s: GameState,
  id: string | undefined,
  after: Effect[],
  resolved: boolean,
): Option[] {
  const receipt = ghostNativeEventReceipt(s, id);
  return receipt && !s.flags[`ghostCancelled:${id}`]
    ? ghostSpider.ghostSpiderEventResolutionOptions(
        s,
        { ...receipt, resolved },
        after,
        ghostSpiderPorts,
      )
    : [];
}
const ghostSpiderPorts: ghostSpider.GhostSpiderPorts = {
  queue: add,
  choose,
  isTextBlank,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  canReadyPiece: (s, p) => warMachinePackPorts.canReady(s, p.id),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, cost, req = [], exclude, code) =>
    canPay(s, Math.max(cost, req.length), req, exclude, code),
  canPlayReaction: (s, p, context) =>
    !ghostSpider.ghostSpiderCannotPlayEvents(s) &&
    !(
      context.kind === "reveal" &&
      context.reveal.playerId !== s.activePlayerId &&
      /Peril/i.test(
        card(sinisterNativePiece(s, context.reveal.pieceId)!).text || "",
      )
    ),
  playReaction: (s, id, context, after) => {
    const p = [
      ...s.player.hand,
      ...ghostSpider.ghostSpiderStoredPlayable(s, ghostSpiderPorts),
    ].find((p) => p.id === id);
    need(p, "The actual Ghost-Spider event is unavailable.");
    add(
      s,
      E("payRequest", {
        title: card(p!).name,
        cost: cardCost(s, card(p!), p),
        requirements: ghostSpider.ghostSpiderEventRequirements(p!),
        piece: p,
        cancelable: true,
        after: [
          E("resolveHandEvent", {
            id,
            ghostContext: context,
            after: ghostSpider.ghostSpiderReactionEffects(s, p!, context),
            continuation: after,
          }),
        ],
        cancellationQueue: after,
      }),
    );
  },
  enemyTargets: (s, attacking) => targets(s, "enemy", attacking),
  schemeTargets: (s, thwarting) =>
    thwarting && captainThwartBlocked(s)
      ? []
      : targets(s, "scheme", false, thwarting),
  attackProgram: bwPorts.attackProgram,
  countEncounterBoostIcons: (s, id, after) => {
    const p = sinisterNativePiece(s, id);
    need(p, "The actual revealed encounter is unavailable.");
    add(
      s,
      ...scarletWitch.scarletWitchCountBoosts(s, [p!], after, {
        sourceTitle: "Pirouette and Punch",
      }),
    );
  },
  cancelWhenRevealed: (s, receipt, after) => {
    const p = sinisterNativePiece(s, receipt.pieceId);
    need(p, "The actual encounter is unavailable.");
    s.flags[`ghostCancelReveal:${p!.id}`] = true;
    add(s, ...after);
  },
  activationAvailable: (s, receipt) =>
    !!seatView(s, receipt.playerId).flags[`ghostActivation:${receipt.token}`],
  cancelActivation: (s, receipt) => {
    const flags = seatView(s, receipt.playerId).flags;
    if (!flags[`ghostActivation:${receipt.token}`]) return false;
    flags[`ghostActivationCancelled:${receipt.token}`] = true;
    return true;
  },
  discardHand,
  removeControlledCard: (s, id) => {
    const p = find(s, id);
    need(p && !isPermanent(card(p)), "This actual card cannot be removed.");
    movePieceFromPlay(s, p!.id, true);
    if (card(p!).faction_code === "encounter") {
      const i = s.encounter.discard.findIndex((x) => x.id === id);
      if (i >= 0) s.removed.push(s.encounter.discard.splice(i, 1)[0]);
    }
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleDiscardIntoDeck: (s, after) => {
    s.player.deck.push(...s.player.discard.splice(0));
    warMachinePortsShufflePlayer(s, after);
  },
  handSize,
  revealHidden,
  makePiece,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  enemyRemainingHP: (s, p) => Math.max(0, pieceHP(s, p) - p.damage),
  captureGeorgeForObligation: (s, id) => {
    const ob = s.player.inPlay.find((p) => p.id === id);
    need(ob, "The actual obligation is unavailable.");
    const zones = [
      s.player.hand,
      s.player.deck,
      s.player.discard,
      s.player.inPlay,
    ];
    const zone = zones.find((z) => z.some((p) => p.code === "27007"));
    if (!zone) return;
    const g = zone.find((p) => p.code === "27007")!;
    for (const event of g.storedCards || []) {
      const owner = seatView(s, event.ownerId || s.activePlayerId);
      owner.player.discard.push(resetPiece(event));
    }
    g.storedCards = [];
    if (zone === s.player.inPlay) {
      movePieceFromPlay(s, g.id, true);
      const i = s.removed.findIndex((p) => p.id === g.id);
      need(i >= 0, "George must leave play once.");
      const left = s.removed.splice(i, 1)[0];
      left.storedCards = [];
      (ob!.storedCards ||= []).push(left);
    } else (ob!.storedCards ||= []).push(zone.splice(zone.indexOf(g), 1)[0]);
  },
  attackLizard: (s, enemyId, playerId, completion) =>
    enemyAttack(s, enemyId, undefined, {
      playerId,
      enemyId,
      kind: "attack",
      modifier: 0,
      after: completion,
    }),
};

const milesPorts: miles.MilesMoralesPorts = {
  queue: add,
  choose,
  isTextBlank,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwarting) =>
    thwarting && captainThwartBlocked(s)
      ? []
      : targets(s, "scheme", false, thwarting),
  canGiveStatus: dsPorts.canAddStatus,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  canChangeForm: canChangeIdentityForm,
  canPay: (s, cost, requirements = [], exclude, code) =>
    !(code === "27032" && cost < requirements.length) &&
    canPay(s, cost, requirements, exclude, code),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canDiscardPiece: (s, p) =>
    !isPermanent(card(p)) && valkyrie.valkyrieCanDiscardAttachment(s, p),
  discardPiece,
  discardHand,
  flip: (s, counts, after, target) => {
    const before = s.queue.length;
    flip(s, counts, target === "alter" ? "alter" : undefined);
    const generated = s.queue.splice(0, s.queue.length - before);
    add(s, ...generated, ...after);
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  makePiece,
  attackProgram: bwPorts.attackProgram,
  enemyAttack: (s, enemyId, playerId, allowAlter, continuation) => {
    const seat = s.players.find(
      (seat) => seat.id === playerId && !seat.eliminated,
    );
    if (
      !seat ||
      !s.minions.some((p) => p.id === enemyId) ||
      (!allowAlter && seatView(s, seat).player.form !== "hero")
    )
      return false;
    const token = `miles-attack:${s.nextId++}`;
    add(
      s,
      E("milesNativeAttackStart", {
        enemyId,
        playerId,
        continuation,
        token,
        returnPlayerId: s.activePlayerId,
        actorId: playerId,
      }),
    );
    return true;
  },
  placeAccelerationToken: (s, id, amount) => {
    const p = s.sideSchemes.find((p) => p.id === id);
    need(p, "Tracking Prey needs its actual side scheme.");
    p!.accelerationTokens = Number(p!.accelerationTokens || 0) + amount;
  },
  attachEncounter: (s, p, id) => {
    removeEncounterInstance(s, p.id);
    p.attachedTo = id;
    if (!s.attachments.some((a) => a.id === p.id)) s.attachments.push(p);
  },
  giveObligation: spectrumPorts.giveObligation,
  removeEncounter: (s, p) => {
    if (allInPlay(s).some((a) => a.id === p.id)) discardPiece(s, p.id);
    removeEncounterInstance(s, p.id);
    s.removed.push(resetPiece(p));
  },
  discardEncounter: (s, p) => {
    if (allInPlay(s).some((a) => a.id === p.id)) discardPiece(s, p.id);
    else {
      removeEncounterInstance(s, p.id);
      s.encounter.discard.push(resetPiece(p));
    }
  },
};

function niNativeAchievement(
  s: GameState,
  source: string,
  kind: nova.NovaAchievementReceipt["kind"],
  targetId: string,
) {
  const identity = nativeIdentityDamageSource(s, source);
  if (!identity) return;
  const playerId = identity.slice(5);
  add(
    s,
    ...nova.novaAchievement(s, {
      token: `achievement:${s.nextId++}`,
      playerId,
      kind,
      targetId,
      attributedToIdentity: true,
      performed: true,
    }),
  );
}
function niAllyTargets(s: GameState, p: Piece, kind: "attack" | "thwart") {
  const kitty = colossus.colossusAllyModifiers(s, p, colossusPorts);
  if (
    !niPack.novaIronheartPackWaspIgnores(s, p, niPackPorts) &&
    !kitty.ignoreGuard &&
    !kitty.ignorePatrol &&
    !kitty.ignoreCrisis
  ) {
    const ordinary = targets(
      s,
      kind === "attack" ? "enemy" : "scheme",
      kind === "attack",
      kind === "thwart",
    );
    if (!shadowcat.shadowcatIgnoresGuardPatrolCrisis(s, shadowcatPorts))
      return ordinary;
    // The identity's permission does not extend to an ordinary ally's action.
    return ordinary.filter((t) =>
      kind === "attack"
        ? t.id !== s.villain.id ||
          !engaged(s).some((m) => keyword(m, "Guard", s))
        : t.id !== "main" ||
          (!s.sideSchemes.some((ss) => card(ss).scheme_crisis) &&
            !engaged(s).some((m) => keyword(m, "Patrol", s))),
    );
  }
  if (kind === "attack")
    return targets(s, "enemy", false).filter(
      (t) =>
        t.id !== s.villain.id ||
        !mystique.mystiqueVillainAttackProhibited(s, mystiquePorts),
    );
  const schemes = targets(s, "scheme", false, false);
  if (
    !schemes.some((t) => t.id === "main") &&
    s.scheme.threat > 0 &&
    rulesCode(s.scheme) !== "01139b" &&
    !hulkThreatLocked(s, "main") &&
    gamora.gamoraCanRemoveThreat(s, "main") &&
    !venom.venomSchemeLocked(s, "main") &&
    !warlock.warlockSchemeLocked(s, "main")
  )
    schemes.unshift({
      id: "main",
      code: s.scheme.code,
      label: card(s.scheme.code).name,
    });
  return schemes.filter((scheme) =>
    sentinels.sentinelsCanThwart(
      s,
      scheme.id,
      s.activePlayerId,
      sentinelsPorts,
    ),
  );
}
function niAttackProgram(s: GameState, effects: Effect[], after: Effect[]) {
  if (s.player.stunned) {
    consumeStatus(s.player, "stunned");
    add(s, ...after);
    return;
  }
  const id = `program${s.nextId++}`;
  add(
    s,
    ...effects.map((e) => ({
      ...e,
      attackProgramId: id,
      eventId: s.currentEventId,
      responseGroup: undefined,
    })),
    E("attackProgramEnd", {
      id,
      attackProgramId: id,
      eventId: s.currentEventId,
    }),
    ...after.map((e) => ({
      ...e,
      attackProgramId: undefined,
      responseGroup: undefined,
    })),
  );
}
function niNativeReactionPlay(
  s: GameState,
  id: string,
  after: Effect[],
  context?: nova.NovaDamageContext,
  cancellationAfter: Effect[] = after,
) {
  const p = eventPlaySources(s).find((p) => p.id === id);
  need(p, "The actual owned reaction event is unavailable.");
  requestPayment(
    s,
    card(p!).name,
    cardCost(s, card(p!), p),
    [E("niNativeReactionCommit", { piece: p, after, context })],
    sinisterPlayRequirements(p!),
    p,
    true,
  );
  if (s.prompt?.cancelable)
    s.prompt.cancellationQueue = [...cancellationAfter, ...s.queue];
}
function niNativeDamageOptions(s: GameState, packet: Effect, after: Effect[]) {
  if (!packet.attack || packet.amount <= 0) return [];
  const targetId =
    packet.target === "hero" ? `hero:${s.activePlayerId}` : packet.target;
  const friendly =
    targetId?.startsWith("hero:") ||
    allInPlay(s).some((p) => p.id === targetId && card(p).type_code === "ally");
  if (!friendly) return [];
  packet.damageWindowId ||= `nova-damage:${s.nextId++}`;
  const context: nova.NovaDamageContext = {
    token: packet.damageWindowId,
    playerId: s.activePlayerId,
    targetId,
    fromAttack: true,
    amount: packet.amount,
    friendly: true,
  };
  s.flags[`novaDamageKind:${context.token}`] = packet.kind || "packet";
  const original = s.activePlayerId;
  const victim = targetId?.startsWith("hero:")
    ? heroCard(seatView(s, targetId.slice(5))).name
    : card(allInPlay(s).find((p) => p.id === targetId)!).name;
  return [
    ...spiderHamNativePhysicsOptions(s, packet, after),
    ...playerOrder(s).flatMap((seat) =>
      nova
        .novaDamageOptions(
          seatView(s, seat),
          context,
          after.map((e) => ({ ...e, actorId: original })),
          novaPorts,
        )
        .map((o) => ({
          ...o,
          id: `nova:${seat.id}:${context.token}:${context.targetId}:${o.id}`,
          label: `${o.label} (${packet.kind === "overkill" ? "overkill damage to" : "damage to"} ${victim})`,
          effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
        })),
    ),
  ];
}
function niQueuePacketReceipt(
  s: GameState,
  e: Effect,
  result: DamageResult | undefined,
  snapshot: { id: string; code?: string; stage?: number },
) {
  if (!e.afterResolved?.length) return;
  const receipt = effectContext(
    s,
    E("niNativeDamageReceipt", {
      snapshot,
      result: result || { actualDamage: 0, damageDealt: 0, excessDamage: 0 },
      performed: !!result,
      after: e.afterResolved,
    }),
  );
  const boundary = s.queue.findIndex(
    (q) =>
      q.afterAttack ||
      q.type === "attackAftermathOrder" ||
      (q.mandatory === false && q.responseGroup),
  );
  s.queue.splice(boundary < 0 ? 0 : boundary, 0, receipt);
}
const novaPorts: nova.NovaPorts = {
  queue: add,
  choose,
  isTextBlank,
  makePiece,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  canReadyPiece: (s, p) =>
    nova.novaCanReadyPiece(s, p, { isTextBlank }) &&
    warMachinePackPorts.canReady(s, p.id),
  canDraw: (s) => s.player.deck.length + s.player.discard.length > 0,
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay,
  pay: (s, title, cost, req, after, targetCode) =>
    requestPayment(
      s,
      title,
      cost,
      after.map((e) => ({ ...e, paymentReceipt: true })),
      req,
      undefined,
      true,
      targetCode,
      false,
      [],
      true,
      false,
      false,
      true,
    ),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  attackProgram: niAttackProgram,
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  putPlayerCard: (s, p, after) => {
    const before = maxHP(s);
    Object.assign(p, resetPiece(p, true));
    s.player.inPlay.push(p);
    s.player.hp += maxHP(s) - before;
    add(s, ...niPack.novaIronheartPackCardEntered(s, p), ...after);
  },
  canDiscardPiece: (s, p) =>
    !isPermanent(card(p)) && valkyrie.valkyrieCanDiscardAttachment(s, p),
  discardPiece,
  canPayAllyDamageCost: (s, p, n) =>
    !p.exhausted &&
    !p.tough &&
    pieceHP(s, p) - p.damage >= n &&
    !niPack.novaIronheartPackCannotTakeDamage(s, p.id, niPackPorts),
  payAllyDamageCost: (s, id, amount, after) => {
    const p = find(s, id);
    need(
      p && novaPorts.canPayAllyDamageCost(s, p, amount),
      "Ms. Marvel cannot pay the actual damage cost.",
    );
    p!.exhausted = true;
    const before = new Set(s.queue);
    dealDamage(s, id, amount, id);
    const generated = s.queue.filter((e) => !before.has(e));
    s.queue = s.queue.filter((e) => before.has(e));
    add(s, ...generated, ...after);
  },
  reactionEvents: eventPlaySources,
  canPlayDamageReaction: (s, p) =>
    !ghostSpider.ghostSpiderCannotPlayEvents(s) &&
    s.player.form === "hero" &&
    !isTextBlank(s, p),
  playDamageReaction: (s, id, context, after) =>
    niNativeReactionPlay(s, id, after, context),
  preventAttackDamage: (s, context, amount) => {
    // A teammate pays and reacts in their own seat, but the pending damage
    // receipt and its prevention belong to the originally attacked seat.
    const flags = seatView(s, context.playerId).flags;
    const kind = String(flags[`novaDamageKind:${context.token}`] || "packet");
    if (kind === "attack" && s.attack) s.attack.prevented += amount;
    else if (kind === "overkill" && s.attack)
      s.attack.identityPrevented =
        Number(s.attack.identityPrevented || 0) + amount;
    else
      flags[`msPrevent:${context.token}`] =
        Number(flags[`msPrevent:${context.token}`] || 0) + amount;
  },
  giveObligation: spectrumPorts.giveObligation,
  removeEncounter: milesPorts.removeEncounter,
  controlledCards: (s) => [
    ...s.player.inPlay,
    ...s.attachments.filter(
      (p) => controller(s, p.id)?.id === s.activePlayerId,
    ),
  ],
  enemyAttack: (s, id, playerId, _allowAlter, continuation) => {
    if (!find(s, id)) return false;
    add(
      s,
      E("enemyAttack", {
        id,
        actorId: playerId,
        activation: {
          enemyId: id,
          playerId,
          kind: "attack",
          after: continuation,
        },
      }),
    );
    return true;
  },
  discardEncounterTop: (s, count, after) => {
    for (let n = 0; n < count; n++) {
      const p = drawEncounter(s);
      if (!p) break;
      s.encounter.discard.push(p);
    }
    add(s, ...after);
  },
};
const ironheartPorts: ironheart.IronheartPorts = {
  queue: add,
  choose,
  isTextBlank,
  makePiece,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canPay,
  payAbility: (s, cost, requirements, after, commit = []) =>
    requestPayment(
      s,
      "Child Prodigy",
      cost,
      after,
      requirements,
      undefined,
      true,
      undefined,
      false,
      commit,
      true,
      false,
      false,
      true,
    ),
  canReadyIdentity: novaPorts.canReadyIdentity,
  canGiveStatus: quicksilverPorts.canGiveStatus,
  enemyTargets: novaPorts.enemyTargets,
  schemeTargets: novaPorts.schemeTargets,
  attack: (s, target, amount, continuation) =>
    niAttackProgram(
      s,
      [
        E("damage", {
          target,
          amount,
          attack: true,
          attackInitiated: true,
          source: "hero",
          afterResolved: [continuation],
        }),
      ],
      [],
    ),
  thwart: (s, target, amount, continuation) =>
    add(
      s,
      E("thwart", {
        target,
        amount,
        action: true,
        source: "hero",
        afterResolved: [continuation],
      }),
    ),
  lookPlayerDeck: (s, count, continuation) => {
    const ids = s.player.deck.slice(0, count).map((p) => p.id);
    if (ids.length) revealHidden(s);
    add(s, { ...continuation, ids });
  },
  addDeckCardToHand: (s, id) => {
    const i = s.player.deck.findIndex((p) => p.id === id);
    need(i >= 0, "The actual looked deck card is unavailable.");
    s.player.hand.push(s.player.deck.splice(i, 1)[0]);
  },
  discardDeckCard: (s, id) => {
    const i = s.player.deck.findIndex((p) => p.id === id);
    need(i >= 0, "The actual looked deck card is unavailable.");
    s.player.discard.push(resetPiece(s.player.deck.splice(i, 1)[0]));
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  enemyTraits: (s, p) => sinisterNativeTraits(s, p),
  attachEncounter: milesPorts.attachEncounter,
  giveObligation: spectrumPorts.giveObligation,
  discardEncounter: milesPorts.discardEncounter,
  shuffleObligationIntoEncounter: (s, p) => {
    if (find(s, p.id)) {
      movePieceFromPlay(s, p.id, true);
      s.removed = s.removed.filter((q) => q.id !== p.id);
    }
    removeEncounterInstance(s, p.id);
    s.encounter.deck.push(resetPiece(p));
    mutagenPorts.shuffleEncounter(s);
  },
  dealEncounter,
  dealBoostCard: (s, p, playerId) => {
    const a = s.scheming || s.attack;
    if (a) (a.retainedBoostIds ||= []).push(p.id);
    removeEncounterInstance(s, p.id);
    p.dealtTo = playerId;
    s.encounter.dealt.push(p);
  },
  enemyScheme: (s, id, continuation) =>
    add(
      s,
      E("enemyScheme", {
        id,
        activation: {
          enemyId: id,
          playerId: s.activePlayerId,
          kind: "scheme",
          after: continuation,
        },
      }),
    ),
  placeThreat: threat,
  revealEncounter: (s, p, after) => add(s, E("reveal", { piece: p }), ...after),
};
const niPackPorts: niPack.NovaIronheartPackPorts = {
  queue: add,
  choose,
  isTextBlank,
  identityHasTrait: (s, t) => captainPackHasTrait(s, "hero", t),
  hasTrait: captainPackHasTrait,
  friendlyTargets: antPackPorts.friendlyTargets,
  enemyTargets: novaPorts.enemyTargets,
  schemeTargets: novaPorts.schemeTargets,
  allEnemies: (s) =>
    [s.villain, ...s.minions].map((p) => ({
      id: p.id,
      code: p.code,
      label: card(p).name,
    })),
  shieldSupportTargets: (s) =>
    allInPlay(s)
      .filter(
        (p) =>
          card(p).type_code === "support" &&
          sinisterNativeHasTrait(s, p.id, "S.H.I.E.L.D.") &&
          p.exhausted &&
          warMachinePackPorts.canReady(s, p.id),
      )
      .map((p) => ({ id: p.id, code: p.code, label: card(p).name })),
  blankableTargets: (s) =>
    [
      ...s.attachments.filter((p) => card(p).type_code === "attachment"),
      ...s.minions.filter(
        (p) => !(card(p).traits || "").split(/\.\s*/).includes("Elite"),
      ),
      ...s.sideSchemes.filter((p) => !isPermanent(card(p))),
    ].map((p) => ({ id: p.id, code: p.code, label: card(p).name })),
  canReady: (s, id) =>
    id === "hero"
      ? !!s.player.exhausted && canReadyIdentity(s)
      : id.startsWith("hero:")
        ? !!seatView(s, id.slice(5)).player.exhausted &&
          canReadyIdentity(seatView(s, id.slice(5)))
        : !!find(s, id)?.exhausted && warMachinePackPorts.canReady(s, id),
  heroStats: (s) => {
    const { attack, thwart, defense } = heroStats(s);
    return { attack, thwart, defense };
  },
  canExhaustIdentity: (s) => s.player.form === "hero" && !s.player.exhausted,
  exhaustIdentity: (s) => {
    need(!s.player.exhausted, "Your hero is exhausted.");
    s.player.exhausted = true;
  },
  canPay,
  handPlayableCards: eventPlaySources,
  cardCost: novaPorts.cardCost,
  playResponse: (s, id, after) =>
    niNativeReactionPlay(
      s,
      id,
      after,
      undefined,
      after.map((e) =>
        e.type === "nova-ironheart-pack:aerial-played"
          ? { ...e, type: "nova-ironheart-pack:aerial-window" }
          : e,
      ),
    ),
  payAbility: (s, cost, req, after) =>
    requestPayment(
      s,
      "Falcon",
      cost,
      after,
      req,
      undefined,
      true,
      undefined,
      false,
      [],
      true,
      false,
      false,
      true,
    ),
  attackProgram: niAttackProgram,
  thwartProgram: (s, effects, after) => {
    if (s.player.confused) {
      consumeStatus(s.player, "confused");
      add(s, ...after);
    } else add(s, ...effects, ...after);
  },
  attackDamage: (s, _source, target, amount, after) =>
    add(
      s,
      E("damage", {
        target,
        amount,
        source: "hero",
        attack: true,
        attackInitiated: true,
        afterResolved: after,
      }),
    ),
  discardTopPlayer: (s, count, after) => {
    const before = new Set(s.queue);
    const availableBefore = s.player.deck.length;
    const pieces = mill(s, count);
    const generated = s.queue.filter((e) => !before.has(e));
    s.queue = s.queue.filter((e) => before.has(e));
    add(
      s,
      ...generated,
      ...after.map((e) => ({
        ...e,
        discardedIds: pieces.map((p) => p.id),
        deckExhausted: count > 0 && availableBefore <= count,
      })),
    );
  },
  discardHand,
  discardPiece,
  removeResolvingFromGame: (s, id) => {
    const i = s.resolving.findIndex((p) => p.id === id);
    need(i >= 0, "The actual played event is unavailable for its remove cost.");
    s.removed.push(resetPiece(s.resolving.splice(i, 1)[0]));
  },
  replaceLeaveWithShuffle: (s, receipt, after) => {
    need(
      niPackPorts.leaveAvailable(s, receipt),
      "The actual pending card is unavailable.",
    );
    s.flags[`niLeaveShuffle:${receipt.pieceId}`] = receipt.ownerId;
    add(s, E("niNativeLeaveCommit", { receipt, replaced: true }), ...after);
  },
  leaveAvailable: (s, r) =>
    !!find(s, r.pieceId) && !s.flags[`niLeaveComplete:${r.token}`],
  revealHidden,
  maxHP: (s, id) => maxHP(seatView(s, id)),
  spendUseCost: (s, id, after) => {
    const p = find(s, id);
    need(p && p.counters > 0, "The actual research counter is unavailable.");
    p!.counters--;
    add(s, ...after);
  },
  finishUse: (s, id, after) => {
    const p = find(s, id);
    if (p && p.counters === 0) {
      const before = new Set(s.queue);
      discardPiece(s, id);
      const generated = s.queue.filter((e) => !before.has(e));
      s.queue = s.queue.filter((e) => before.has(e));
      add(s, ...generated, ...after);
    } else add(s, ...after);
  },
};

const visionPorts: vision.VisionPorts = {
  defenseEventSources: (s) =>
    visionPack.visionPackDefenseEvents(s, visionPackPorts),
  ...antManPorts,
  makePiece,
  cardCost: (s, p) => cardCost(s, card(p), p),
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canChangeMassForm: canChangeIdentityForm,
  massFormChanged: (s, from, to) => {
    log(s, `Change mass form from ${from} to ${to}.`);
    spectrumPorts.refreshDefense(s);
    syncNebulaIdentityStatuses(s);
  },
  formResponseOptions: spectrumPorts.formResponseOptions,
  schemeTargets: (s, thwarting, ignoreCrisis = false, ignorePatrol = false) => {
    if (thwarting && captainThwartBlocked(s)) return [];
    const ordinary = targets(s, "scheme", false, thwarting);
    if (
      !ordinary.some((p) => p.id === "main") &&
      (!(
        deadpool.deadpoolPlayerIcons(s, "scheme_crisis") > 0 ||
        s.sideSchemes.some((p) => card(p).scheme_crisis)
      ) ||
        ignoreCrisis ||
        nebula.nebulaIgnoresRestrictions(s).crisis) &&
      (!thwarting ||
        !engaged(s).some((p) => keyword(p, "Patrol", s)) ||
        ignorePatrol ||
        nebula.nebulaIgnoresRestrictions(s).patrol) &&
      rulesCode(s.scheme) !== "01139b" &&
      s.scheme.threat > 0 &&
      !hulkThreatLocked(s, "main")
    )
      ordinary.unshift({
        id: "main",
        label: card(s.scheme.code).name,
        code: s.scheme.code,
      });
    return ordinary;
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  canDiscardAttachment: (s, p) =>
    !isPermanent(card(p)) && valkyrie.valkyrieCanDiscardAttachment(s, p),
  canDiscardUpgrade: (s, p) =>
    s.player.inPlay.some((q) => q.id === p.id) && !isPermanent(card(p)),
  preventAllAttackDamage: hawkeyePorts.preventAllAttackDamage,
  afterAttack: (s, effects) => {
    if (s.attack)
      (s.attack.visionAfterAttack ||= []).push(
        ...effects.map((e) => effectContext(s, e)),
      );
  },
  giveObligation: spectrumPorts.giveObligation,
  putEnvironment: (s, p) => {
    removeEncounterInstance(s, p.id);
    if (!(s.environments ||= []).some((q) => q.id === p.id))
      s.environments.push(p);
  },
  discardRandomHand: (s, count) => {
    if (count > 0 && s.player.hand.length) revealHidden(s);
    for (let n = 0; n < count; n++) randomDiscard(s);
  },
};
const valkyriePorts: valkyrie.ValkyriePorts = {
  ...antManPorts,
  cardCost: (s, p) => cardCost(s, card(p), p),
  makePiece,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canPutMinion: (s, p) =>
    card(p).type_code === "minion" && !uniqueConflict(s, card(p), p.id),
  putMinion: (s, id, playerId, after) => {
    const p = [...s.encounter.deck, ...s.encounter.discard].find(
      (p) => p.id === id,
    );
    if (!p || !valkyriePorts.canPutMinion(s, p)) return false;
    const before = s.queue.length;
    mutagenPorts.putMinion(s, p, playerId);
    const entry = s.queue.splice(0, s.queue.length - before);
    add(s, ...entry, ...after);
    return s.minions.some((m) => m.id === id);
  },
  playSetAside: (s, id, after) => {
    const p = s.player.setAside?.find((p) => p.id === id && p.code === "25002");
    need(p, "Death Perception requires the same set-aside Death-Glow.");
    const reason = playable({ ...s, turnPlayerId: s.activePlayerId }, p!);
    need(!reason, reason || "Death-Glow cannot be played.");
    requestPlay(s, p!);
    if (s.prompt?.kind === "payment")
      s.prompt.after!.push(...after.map((e) => effectContext(s, e)));
    else add(s, ...after);
  },
  setAsideOwnedPiece: (s, id) => {
    const p = s.player.inPlay.find((p) => p.id === id);
    if (!p) return false;
    movePieceFromPlay(s, id, false, s.activePlayerId);
    return !!s.player.setAside?.some((p) => p.id === id);
  },
  canDeclareIdentityDefender: (s, playerId) => {
    const seat = s.players.find(
      (seat) => seat.id === playerId && !seat.eliminated,
    );
    return (
      !!s.attack &&
      !!seat &&
      seatView(s, seat).player.form === "hero" &&
      !attackTargetsEnemy(s, s.attack) &&
      !armadillo.armadilloDefenseBlocked(s, s.attack.attacker) &&
      !(
        rulesCode(find(s, s.attack.attacker) || s.attack.attackerSnapshot!) ===
          "01132" && friends(seatView(s, seat)).some((p) => !p.exhausted)
      )
    );
  },
  declareIdentityDefender: (s, playerId, bonus, after) => {
    need(
      valkyriePorts.canDeclareIdentityDefender(s, playerId),
      "Valkyrie cannot defend this attack.",
    );
    activateSeat(s, playerId);
    const a = s.attack!;
    a.defender = "hero";
    a.targetPlayerId = playerId;
    a.basicDefense = false;
    a.valkyrieDefense = true;
    a.defenseBonus = (a.defenseBonus || 0) + bonus;
    a.defense =
      heroStats(s).defense +
      valkyrie.valkyrieDefenseBonusForAttacker(s, a.attacker) +
      a.defenseBonus;
    log(
      s,
      `Shieldmaiden declares ${heroCard(s).name} the defender with ${a.defense} DEF without exhausting.`,
    );
    add(s, E("spectrumDefenseWindow", { used: [] }), ...after);
  },
};
function warMachinePortsShufflePlayer(s: GameState, after: Effect[]) {
  const before = s.queue.length;
  recyclePlayer(s);
  hawkeyePorts.shufflePlayerDeck(s);
  const exhaustion = s.queue.splice(0, s.queue.length - before);
  add(s, ...exhaustion, ...after);
}
const warMachinePorts: warMachine.WarMachinePorts = {
  ...antManPorts,
  makePiece,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canDiscardUpgrade: (s, p) =>
    s.player.inPlay.some((piece) => piece.id === p.id) &&
    card(p).type_code === "upgrade" &&
    !isPermanent(card(p)),
  canReadyPiece: (s, p) => s.player.inPlay.some((piece) => piece.id === p.id),
  damageBatch: (s, ids, amount, source) =>
    spectrumPorts.damageBatch(s, ids, amount, source),
  shufflePlayerDeck: (s, after) => {
    const queuedBefore = s.queue.length;
    recyclePlayer(s);
    hawkeyePorts.shufflePlayerDeck(s);
    const exhaustion = s.queue.splice(0, s.queue.length - queuedBefore);
    add(s, ...exhaustion, ...after);
  },
  canPayEventWithAmmo: (s, p, neededAmmo) => {
    const sources = paymentSources(s, p.id, p.code);
    const guns = sources.filter(
      (source) => source.kind === "ability" && source.code === "23005",
    );
    return (
      warMachine.warMachineAmmo(s) + guns.length >= neededAmmo &&
      paymentStatus(
        sources,
        sources.map((source) => source.id),
        cardCost(s, card(p), p),
        [],
      ).ready
    );
  },
};

const nebulaPorts: nebula.NebulaPorts = {
  ...antManPorts,
  select,
  shufflePlayerDeck: hawkeyePorts.shufflePlayerDeck,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canDiscardUpgrade: (s, p) =>
    s.player.inPlay.some((piece) => piece.id === p.id) &&
    card(p).type_code === "upgrade" &&
    !isPermanent(card(p)),
  discardUntilTechnique: (s, continuation) => {
    const queuedBefore = s.queue.length;
    const index = s.player.deck.findIndex(
      (p) =>
        card(p).type_code === "upgrade" &&
        (card(p).traits || "").split(/\.\s*/).includes("Technique"),
    );
    const discarded = mill(s, index < 0 ? s.player.deck.length : index + 1);
    const found = index < 0 ? undefined : discarded[index];
    // Immediate reset can move the found physical card back into the deck.
    // Exhaustion interrupts/responses precede retrieving that same instance.
    const exhaustion = s.queue.splice(0, s.queue.length - queuedBefore);
    add(s, ...exhaustion, { ...continuation, id: found?.id });
  },
  putDiscardedTechnique: (s, id, after) => {
    for (const zone of [s.player.discard, s.player.deck]) {
      const index = zone.findIndex((p) => p.id === id);
      if (index < 0) continue;
      const [p] = zone.splice(index, 1);
      need(
        card(p).type_code === "upgrade" &&
          (card(p).traits || "").split(/\.\s*/).includes("Technique"),
        "Combat Ready requires the actual discarded Technique.",
      );
      Object.assign(p, resetPiece(p, true));
      s.player.inPlay.push(p);
      add(
        s,
        ...psylocke.psylockeCardEntered(s, p),
        ...angel.angelCardEntered(s, p),
        ...cable.cableCardEntered(s, p),
        ...x23.x23Entered(s, p),
        ...deadpool.deadpoolCardEntered(s, p),
        ...cyclops.cyclopsCardEntered(s, p),
        ...wolverine
          .wolverineCardEntered(s, p, false)
          .filter(() => !["35003", "35014"].includes(p.code)),
        ...colossus.colossusCardEntered(s, p),
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
        ...after,
      );
      return true;
    }
    return false;
  },
  gamoraAttack: (s, source, playerId, continuation) => {
    const recipient = s.players.find(
      (seat) => seat.id === playerId && !seat.eliminated,
    );
    if (!recipient || !nebulaNativeAttacker(s, source.id, source)) return false;
    add(
      s,
      E("nebulaGamoraAttackStart", {
        source,
        playerId,
        continuation,
        actorId: source.kind === "ally" ? source.playerId : playerId,
      }),
    );
    return true;
  },
};

function colossusNativeDiscardTough(
  s: GameState,
  targets: { targetId: string; amount: number }[],
  after: Effect[],
  deferToAttack = false,
) {
  const receipts: colossus.ColossusToughDiscardReceipt[] = [];
  for (const item of targets) {
    const targetId =
      item.targetId === "hero" ? `hero:${s.activePlayerId}` : item.targetId;
    const seatId = targetId.startsWith("hero:")
      ? targetId.slice(5)
      : controller(s, targetId)?.id || s.activePlayerId;
    const view = seatView(s, seatId);
    const subject = targetId.startsWith("hero:")
      ? view.player
      : find(s, targetId);
    if (!subject) continue;
    const count = Math.min(
      statusCards(subject, "tough"),
      Math.max(0, item.amount),
    );
    if (!count) continue;
    subject.toughCards = statusCards(subject, "tough") - count;
    subject.tough = subject.toughCards > 0;
    receipts.push({
      token: `tough-discard:${s.nextId++}`,
      playerId: seatId,
      targetId,
      count,
      wasHero: view.player.form === "hero",
    });
  }
  // Piercing is part of the native incoming damage occurrence. Its responses
  // open after damage/defeat, so newly generated Tough is kept for later damage.
  if (deferToAttack && s.attack) {
    const attack = s.attack as NonNullable<GameState["attack"]> & {
      colossusToughDiscardReceipts?: colossus.ColossusToughDiscardReceipt[];
    };
    (attack.colossusToughDiscardReceipts ||= []).push(...receipts);
    add(s, ...after);
    return;
  }
  // Do not insert a response between two mutations from the same effect.
  add(
    s,
    ...receipts.flatMap((receipt) =>
      colossus.colossusToughDiscarded(
        seatView(s, receipt.playerId),
        receipt,
        colossusPorts,
      ),
    ),
    ...after,
  );
}

const dominoPorts: domino.DominoPorts = {
  queue: add,
  choose,
  enemies: (s, attack) => targets(s, "enemy", attack),
  schemes: (s, thwart) => targets(s, "scheme", false, thwart),
  characters: (s) => targets(s, "friendly"),
  hasTrait: sinisterNativeHasTrait,
  hidden: revealHidden,
  mill: (s, after) => {
    const before = s.queue.length;
    const piece = mill(s, 1)[0];
    const resources = domino.dominoResources(s, piece);
    const responses = s.queue.splice(0, s.queue.length - before);
    add(s, ...responses, { ...after, piece, resources });
  },
  shuffle: (s) => {
    revealHidden(s);
    s.player.deck = shuffle(s, s.player.deck);
  },
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  discard: discardPiece,
  discardHand,
  makePiece,
  canPut: nativeCanPutIntoPlay,
  put: nativePutIntoPlay,
  canDamage: (s, p) =>
    !p.tough &&
    pieceHP(s, p) - p.damage >= 1 &&
    !niPack.novaIronheartPackCannotTakeDamage(s, p.id, niPackPorts),
  damageCost: (s, p, after) => {
    const before = s.queue.length;
    dealDamage(s, p.id, 1, p.id);
    const generated = s.queue.splice(0, s.queue.length - before);
    add(s, ...generated, ...after);
  },
  attach: (s, p, target) => {
    removeEncounterInstance(s, p.id);
    mutagenPorts.attach(s, p, target);
  },
  keepObligation: (s, p) =>
    spectrumPorts.giveObligation(s, p, s.activePlayerId),
  cancelReveal: (s, p) => angelPorts.cancelReveal(s, p),
  cancelBoost: (s, id) => {
    bwPorts.cancelBoostIcons(s, id);
    bwPorts.cancelBoostAbility(s, id);
  },
  additionalBoost: (s) => {
    const p = drawEncounter(s);
    if (p && s.attack) (s.attack.pendingBoosts ||= []).push(p);
  },
  drawEncounter,
  claimDefense: (s) =>
    gamoraPorts.claimDefense(s, {
      type: "damage",
      kind: "attack",
      target: "hero",
    }),
  maxHP,
  canReady: (s, id) =>
    id === "hero"
      ? canReadyIdentity(s)
      : id.startsWith("hero:")
        ? canReadyIdentity(seatView(s, id.slice(5)))
        : !!find(s, id)?.exhausted &&
          nova.novaCanReadyPiece(s, find(s, id)!, { isTextBlank }),
  attack: niAttackProgram,
};

const gambitPorts: gambit.GambitPorts = {
  queue: add,
  choose,
  enemies: (s, attack) => targets(s, "enemy", attack),
  schemes: (s, thwart) => targets(s, "scheme", false, thwart),
  hasTrait: sinisterNativeHasTrait,
  canReady: canReadyIdentity,
  pay: (s, title, cost, after, requirements = [], commit = []) =>
    requestPayment(
      s,
      title,
      cost,
      after,
      requirements,
      undefined,
      true,
      undefined,
      false,
      commit,
    ),
  canPay: (s, p) => canPay(s, cardCost(s, card(p), p), [], p.id, p.code),
  reactionEvents: eventPlaySources,
  reaction: (s, p, effects, after) => {
    requestPayment(
      s,
      card(p).name,
      cardCost(s, card(p), p),
      [
        E("resolveHandEvent", {
          id: p.id,
          after: effects,
          continuation: after,
        }),
      ],
      [],
      p,
      true,
    );
    if (s.prompt?.cancelable)
      s.prompt.cancellationQueue = [...after, ...s.queue];
  },
  attack: niAttackProgram,
  makePiece,
  discard: discardPiece,
  shufflePlayer: (s) => {
    revealHidden(s);
    s.player.deck = shuffle(s, s.player.deck);
  },
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  hidden: revealHidden,
  attach: (s, p, target) => {
    removeEncounterInstance(s, p.id);
    mutagenPorts.attach(s, p, target);
  },
  keepObligation: (s, p) =>
    spectrumPorts.giveObligation(s, p, s.activePlayerId),
  removeObligation: (s, p) => {
    s.player.inPlay = s.player.inPlay.filter((q) => q.id !== p.id);
    removeEncounterInstance(s, p.id);
    s.removed.push(p);
  },
};
const cyclopsPorts: cyclops.CyclopsPorts = {
  queue: add,
  choose,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", thwart),
  friendlyTargets: (s) =>
    playerOrder(s).flatMap((seat) => [
      { id: `hero:${seat.id}`, label: heroCard(seatView(s, seat)).name },
      ...seatView(s, seat)
        .player.inPlay.filter((p) => card(p).type_code === "ally")
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ]),
  hasTrait: captainPackHasTrait,
  canReady: (s, id) =>
    id.startsWith("hero:")
      ? canReadyIdentity(seatView(s, id.slice(5))) &&
        seatView(s, id.slice(5)).player.exhausted
      : !!find(s, id)?.exhausted &&
        nova.novaCanReadyPiece(s, find(s, id)!, { isTextBlank }),
  canPay,
  pay: (s, title, cost, after, targetCode) =>
    requestPayment(
      s,
      title,
      cost,
      after,
      [],
      undefined,
      true,
      targetCode,
      false,
      [],
      false,
      false,
      false,
      true,
    ),
  cardCost: (s, p) => cardCost(s, card(p), p),
  attackProgram: niAttackProgram,
  reactionEvents: (s) =>
    ghostSpider.ghostSpiderCannotPlayEvents(s) ? [] : eventPlaySources(s),
  playReaction: (s, id, effects, after) => {
    const p = eventPlaySources(s).find((p) => p.id === id);
    need(p, "Full Blast is unavailable.");
    requestPayment(
      s,
      card(p!).name,
      cardCost(s, card(p!), p),
      [E("resolveHandEvent", { id, after: [], continuation: after })],
      [],
      p,
      true,
      undefined,
      false,
      effects,
    );
    if (s.prompt?.cancelable)
      s.prompt.cancellationQueue = [...after, ...s.queue];
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  makePiece,
  discardPiece,
  attach: (s, id, target) => {
    const p = find(s, id);
    need(p, "The physical upgrade is missing.");
    const before = target.startsWith("hero:")
      ? maxHP(seatView(s, target.slice(5)))
      : 0;
    p!.attachedTo = target;
    if (target.startsWith("hero:")) {
      const v = seatView(s, target.slice(5));
      v.player.hp += maxHP(v) - before;
    }
  },
  revealEncounter: (s, p) => add(s, E("reveal", { piece: p })),
  attachEncounter: (s, p, target) => {
    removeEncounterInstance(s, p.id);
    mutagenPorts.attach(s, p, target);
  },
  keepObligation: (s, p) =>
    spectrumPorts.giveObligation(s, p, s.activePlayerId),
  removeEncounter: (s, p) => {
    s.player.inPlay = s.player.inPlay.filter((q) => q.id !== p.id);
    removeEncounterInstance(s, p.id);
    s.removed.push(p);
  },
  revealHidden,
};

const psylockePorts: psylocke.PsylockePorts = {
  ...antManPorts,
  attackProgram: niAttackProgram,
  makePiece,
  hasTrait: captainPackHasTrait,
  cardCost: (s, p) => cardCost(s, card(p), p),
  pay: (s, title, cost, req, after) =>
    requestPayment(s, title, cost, after, req, undefined, true),
  playReaction: (s, p, effects, after) => {
    requestPayment(
      s,
      card(p).name,
      cardCost(s, card(p), p),
      [
        E("resolveHandEvent", {
          id: p.id,
          after: effects,
          continuation: after,
        }),
      ],
      [],
      p,
      true,
    );
    if (s.prompt?.cancelable)
      s.prompt.cancellationQueue = [...after, ...s.queue];
  },
  shufflePlayer: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  discardTop: discardNativePlayerTop,
  friendlyTargets: (s) => targets(s, "friendly"),
  transferControl: venomPackPorts.transferControl,
  dealEncounter,
  indirect: (s, amount, source) =>
    zzzaxPorts.indirect(s, {
      playerId: s.activePlayerId,
      amount,
      sourceId: source,
      sourceTitle: "Telekinetic Dragon",
    }),
  keyword: (s, id, name) => !!sourceKeyword(s, id, name as PrintedKeyword),
  prevent: (s, p, amount) => {
    if (p.kind === "attack" && s.attack) s.attack.prevented += amount;
    else if (p.kind === "overkill" && s.attack)
      s.attack.identityPrevented = (s.attack.identityPrevented || 0) + amount;
    else p.amount = Math.max(0, p.amount - amount);
  },
  declareDefense: (s) => {
    if (s.attack && (!s.attack.defender || s.attack.defender === "none")) {
      s.attack.defender = "hero";
      s.attack.targetPlayerId = s.activePlayerId;
      s.attack.basicDefense = false;
      s.attack.eventDefense = true;
    }
  },
};
const wolverinePorts: wolverine.WolverinePorts = {
  ...antManPorts,
  attackProgram: niAttackProgram,
  makePiece,
  maxHP,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canTakeDamageCost: (s, amount) =>
    amount === 0 ||
    (venomPaymentDamageCostAvailable(s, amount) &&
      !damageProhibition(s, "hero", false) &&
      !groot.grootGrowthCounters(s)),
  takeDamageCost: (s, amount) => {
    if (!wolverinePorts.canTakeDamageCost(s, amount)) return false;
    s.player.hp -= amount;
    track(s, "damageTaken", amount);
    return true;
  },
  damageBatch: (s, ids, amount, source) =>
    rocketPorts.damageBatch(s, ids, amount, source),
  canPlayIgnoringCost: (s, p) => scarletPorts.canPlayIgnoringCost(s, p),
  playIgnoringCost: (s, p, after) => scarletPorts.playIgnoringCost(s, p, after),
  playMeanSwing: (s, p, after) => {
    add(s, ...after);
    play(s, p, []);
  },
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  discardPlayerTop: discardNativePlayerTop,
  discardEncounterTop: (s) => mutagenPorts.discardTop(s).piece,
  discardRandomHand: randomDiscard,
  putMinion: mutagenPorts.putMinion,
  attach: (s, p, target) => {
    s.resolving = s.resolving.filter((q) => q.id !== p.id);
    p.attachedTo = target;
    if (!s.attachments.some((q) => q.id === p.id)) s.attachments.push(p);
  },
  pay: (s, title, cost, requirements, after) =>
    requestPayment(s, title, cost, after, requirements, undefined, true),
  hasTrait: captainPackHasTrait,
  hasEnemyKeyword: (s, id, name) =>
    !!sourceKeyword(s, id, name as PrintedKeyword),
  namedAttack: (s, name) => {
    for (const seat of playerOrder(s)) {
      const view = seatView(s, seat);
      if (heroCard(view).name === name && view.player.form === "hero")
        return heroStats(view).attack;
    }
    const p = allInPlay(s).find(
      (p) => card(p).type_code === "ally" && card(p).name === name,
    );
    return p ? allyStat(s, p, "attack") : undefined;
  },
  defeatEnemy: (s, id, source) => {
    const p = s.minions.find((q) => q.id === id);
    if (p) defeatCharacter(s, p, source, false);
  },
  canDiscardAttachment: (s, p) =>
    visionPorts.canDiscardAttachment?.(s, p) ?? !isPermanent(card(p)),
  transferControl: venomPackPorts.transferControl,
};

/** Put into play is not play: retain original ownership and run entry hooks,
 * without paying costs, spending discounts, or firing after-you-play responses. */
export function nativeCanPutIntoPlay(s: GameState, p: Piece) {
  const c = card(p);
  if (
    !["ally", "support", "upgrade", "player_side_scheme"].includes(
      c.type_code,
    ) ||
    uniqueConflict(s, c)
  )
    return false;
  if (
    /(?:Max|Limit) 1 per player/i.test(c.text || "") &&
    s.player.inPlay.some((q) => card(q).name === c.name)
  )
    return false;
  if (
    /(?:Max|Limit) 1 \[\[TEAM\]\] card per player/i.test(c.text || "") &&
    s.player.inPlay.some((q) =>
      (card(q).traits || "").split(/\.\s*/).includes("Team"),
    )
  )
    return false;
  if (/Attach to/i.test(c.text || ""))
    return nativePutAttachmentTargets(s, p).length > 0;
  return true;
}
function nativePutAttachmentTargets(s: GameState, p: Piece) {
  const native =
    x23.x23AttachmentTargets(s, p, x23Ports) ??
    cyclops.cyclopsAttachmentTargets(s, p, cyclopsPorts) ??
    phoenix.phoenixAttachmentTargets(s, p, phoenixPorts) ??
    shadowcat.shadowcatAttachmentTargets(s, p, shadowcatPorts) ??
    mgPack.mutantGenesisPlayerPackAttachmentTargets(
      s,
      p,
      mutantGenesisPackPorts,
    );
  if (native !== null)
    return native.filter((t) => playerAttachmentTarget(s, p, t.id));
  const ally = allyUpgradeTargets(s, p);
  if (
    ally.length ||
    /Attach to (?:a |an |a friendly |a controlled |an? \[\[[^\]]+\]\] )?ally/i.test(
      card(p).text || "",
    )
  )
    return ally;
  const script = cardScript(p),
    text = card(p).text || "";
  const selector =
    script?.implementation === "script"
      ? script.constraints.attachTo
      : undefined;
  const group =
    selector === "controlled-ally"
      ? "ally"
      : selector ||
        (/Attach to.*minion/i.test(text)
          ? "minion"
          : /Attach to.*(?:side )?scheme/i.test(text)
            ? "scheme"
            : /Attach to.*enemy/i.test(text)
              ? "enemy"
              : "friendly");
  return targets(s, group, false, false).filter(
    (t) =>
      playerAttachmentTarget(s, p, t.id) &&
      (!/(?:Max|Limit) 1 per (?:enemy|minion|character|scheme)/i.test(text) ||
        !allInPlay(s).some(
          (q) =>
            q.id !== p.id &&
            card(q).name === card(p).name &&
            q.attachedTo === t.id,
        )),
  );
}
export function nativePutIntoPlay(
  s: GameState,
  p: Piece,
  attachedTarget?: string,
) {
  need(nativeCanPutIntoPlay(s, p), `${card(p).name} cannot enter play.`);
  const c = card(p),
    healthBefore = maxHP(s);
  Object.assign(p, resetPiece(p, true));
  p.ownerId ||= s.activePlayerId;
  if (isPlayerSideScheme(p)) {
    add(
      s,
      ...enterPlayerSideScheme(s, p).map((e) =>
        e.type === "playerSideSchemeLimit"
          ? { ...e, actorId: s.firstPlayerId, playerId: s.firstPlayerId }
          : e,
      ),
    );
    return;
  }
  if (c.type_code === "ally") {
    s.player.hand.push(p);
    putAllyFromHand(s, p.id);
    return;
  }
  s.player.inPlay.push(p);
  const printedUses = /Uses\s*\((\d+)\b/i.exec(c.text || "");
  if (printedUses) p.counters = Number(printedUses[1]);
  if (attachedTarget) {
    need(
      nativePutAttachmentTargets(s, p).some((t) => t.id === attachedTarget),
      "The original upgrade cannot attach to this character.",
    );
    if (
      attachedTarget === s.villain.id ||
      s.minions.some((q) => q.id === attachedTarget)
    )
      p.attachedTo = attachedTarget;
    else attachPackUpgrade(s, p.id, attachedTarget);
  }
  if (["01008", "01056", "01064", "01080"].includes(rulesCode(p)))
    p.counters = 3;
  if (["36019", "37013"].includes(p.code)) p.counters = 3;
  rogue.rogueCardEntered(s, p, false);
  miles.milesCardEntered(s, p);
  const entered: Effect[] = [
    ...ghostSpider.ghostSpiderCardEntered(s, p),
    ...psylocke.psylockeCardEntered(s, p),
    ...angel.angelCardEntered(s, p),
    ...cable.cableCardEntered(s, p),
    ...x23.x23Entered(s, p),
    ...deadpool.deadpoolCardEntered(s, p),
    ...cyclops.cyclopsCardEntered(s, p),
    ...phoenix.phoenixCardEntered(s, p),
    ...wolverine.wolverineCardEntered(s, p, false),
    ...colossus.colossusCardEntered(s, p),
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
    ...warmPack.warMachinePackCardEntered(s, p),
    ...valkPack.valkyriePackCardEntered(s, p),
    ...visionPack.visionPackCardEntered(s, p),
    ...niPack.novaIronheartPackCardEntered(s, p),
    ...spdrPack.spdrPackCardEntered(s, p),
    ...mgPack.mutantGenesisPlayerPackCardEntered(s, p),
    ...spiderHamPack.spiderHamPackCardEntered(s, p),
    ...sinisterPlayerPack.sinisterPlayerPackCardEntered(s, p),
    ...valkyrie.valkyrieCardEntered(s, p),
    ...nebulaPack.nebulaPackCardEntered(s, p),
    ...captainPackCardEntered(s, p),
    ...hulkPackCardEntered(s, p),
    ...msMarvelCardEntered(s, p),
    ...thorCardEntered(s, p),
    ...doctorStrangeCardEntered(s, p),
    ...hawkeyeCardEntered(s, p),
  ];
  s.player.hp += maxHP(s) - healthBefore;
  if (attachedTarget) {
    // Attachment destination was paid/selected by the parent ability (Deathlok).
    add(s, ...entered.filter((e) => !/attach|recipient|control/.test(e.type)));
  } else if (/Attach to/i.test(c.text || "")) {
    // Preserve native attachment hooks, which enforce card-specific target rules.
    const nativeAttachment = entered.some((e) => /attach/.test(e.type));
    add(s, ...entered);
    if (!nativeAttachment) {
      const possible = nativePutAttachmentTargets(s, p);
      choose(
        s,
        c.name,
        "Choose an attachment target.",
        possible.map((t) =>
          option(
            t.id,
            t.label,
            [E("cableAttach", { id: p.id, target: t.id })],
            undefined,
            t.code,
          ),
        ),
      );
    }
  } else add(s, ...entered);
  add(s, E("restrictedLimit"));
}

const cablePorts: cable.CablePorts = {
  discardDeck: mill,
  queue: add,
  choose,
  find,
  makePiece,
  shuffle: (s) => {
    s.player.deck = shuffle(s, s.player.deck);
    s.hiddenInfo = (s.hiddenInfo || 0) + 1;
  },
  shuffleEncounter: (s) => {
    s.encounter.deck = shuffle(s, s.encounter.deck);
  },
  discard: discardPiece,
  flip: (s) => flip(s, false),
  ready: (s, id) => {
    if (id === "hero") readyIdentity(s);
    else {
      const p = find(s, id);
      if (p) p.exhausted = false;
    }
  },
  canReady: (s, id) =>
    id === "hero"
      ? s.player.exhausted && canReadyIdentity(s)
      : !!find(s, id)?.exhausted,
  hasTrait: sinisterNativeHasTrait,
  canPay: (s, n, req = []) => canPay(s, n, req),
  thw: (s) => heroStats(s).thwart,
  friendly: (s) => targets(s, "friendly"),
  enemies: (s, attack) => targets(s, "enemy", attack),
  schemes: (s, thwarting) => targets(s, "scheme", false, thwarting),
  canPut: nativeCanPutIntoPlay,
  put: nativePutIntoPlay,
  attachmentTargets: allyUpgradeTargets,
  heal,
  attach: (s, p, target) => {
    removeEncounterInstance(s, p.id);
    mutagenPorts.attach(s, p, target);
  },
  removeEncounter: removeEncounterInstance,
  dealEncounter,
  damage: (s, id) =>
    id === "hero" ? maxHP(s) - s.player.hp : find(s, id)?.damage || 0,
};

const deadpoolPorts: deadpool.DeadpoolPorts = {
  queue: add,
  choose,
  makePiece,
  maxHP,
  handSize,
  heal,
  discard: discardPiece,
  remove: removePlayerCard,
  discardHand,
  enemies: (s, a) => targets(s, "enemy", a),
  schemes: (s, t, i) =>
    i
      ? [
          { id: "main", label: card(s.scheme.code).name },
          ...s.sideSchemes.map((p) => ({
            id: p.id,
            label: card(p).name,
            code: p.code,
          })),
        ]
      : targets(s, "scheme", false, t),
  friendly: (s) => targets(s, "friendly"),
  canReady: (s, id) => angelPorts.canReady(s, id),
  ready: (s, id) => angelPorts.ready(s, id),
  damage: (s, id, n, source) =>
    dealDamage(s, id, n, source, false).actualDamage,
  shuffle: (s) => {
    s.player.deck = shuffle(s, s.player.deck);
    revealHidden(s);
  },
  shuffleEncounter: (s) => {
    s.encounter.deck = shuffle(s, s.encounter.deck);
  },
  drawEncounter,
  discardPlayerTop: (s) => mill(s, 1)[0],
  dealEncounter,
  attach: (s, p, id) => angelPorts.attach(s, p, id),
  reveal: (s, p) => angelPorts.reveal(s, p),
  cancelReveal: (s, p, onlyWhenRevealed) => {
    s.queue = s.queue.filter(
      (e) => !(e.type === "reveal" && e.piece?.id === p.id),
    );
    if (onlyWhenRevealed) {
      const window = beginRevealWindow(
        s,
        p,
        card(p),
        p.dealtTo || s.activePlayerId,
        1 + goblinWhenRevealedCopies(s),
      );
      s.revealWindows![p.id].pending = s.revealWindows![p.id].pending.filter(
        (id) => id !== "text",
      );
      add(s, ...window);
    } else {
      removeEncounterInstance(s, p.id);
      s.encounter.discard.push(resetPiece(p));
    }
  },
  pay: (s, title, cost, after, requirements = [], commit = []) =>
    requestPayment(
      s,
      title,
      cost,
      after,
      requirements,
      undefined,
      true,
      undefined,
      commit.length > 0,
      commit,
    ),
  canPay: (s, p) => canPay(s, cardCost(s, card(p), p), [], p.id, p.code),
  reaction: (s, p, effects, after) =>
    angelPorts.playReaction(s, p, effects, after),
  collectionWeapons: (s) =>
    CATALOG_CARDS.filter(
      (c) =>
        c.type_code === "upgrade" &&
        c.traits?.includes("Weapon.") &&
        ["aggression", "justice", "leadership", "protection", "pool"].includes(
          c.faction_code,
        ) &&
        hasExecutableScript(c.code) &&
        !s.removed.some((p) => p.code === c.code),
    ),
  canEnter: (s, p) =>
    !card(p).is_unique ||
    !allInPlay(s).some((q) => card(q).name === card(p).name),
  enterWeapon: (s, p) => {
    p.exhausted = false;
    p.counters = Number(/Uses\s*\(?(\d+)/i.exec(card(p).text || "")?.[1] || 0);
    add(
      s,
      ...(rocket.rocketEnterPlay(s, p) || []),
      ...venomPack.venomPackCardEntered(s, p),
      ...valkPack.valkyriePackCardEntered(s, p),
      ...spdrPack.spdrPackCardEntered(s, p),
    );
  },
  putAlly: (s, p) => {
    s.player.inPlay.push(p);
    if (printedKeyword(card(p), "Toughness"))
      giveCharacterStatus(s, p, "tough");
    add(s, ...deadpool.deadpoolCardEntered(s, p), E("allyLimit"));
  },
  defeat: (s, id) => {
    const p = find(s, id);
    if (p) defeatCharacter(s, p, "hero");
  },
  hasTrait: sinisterNativeHasTrait,
  attackEnemy: (s, id, target) =>
    enemyAttack(s, id, undefined, undefined, target),
};

const angelPorts: angel.AngelPorts = {
  queue: add,
  choose,
  find,
  makePiece,
  hasTrait: sinisterNativeHasTrait,
  identityBlank: (s) =>
    isTextBlank(s, { code: heroCard(s).code, id: `hero:${s.activePlayerId}` }),
  maxHP,
  permanent: (s, p) =>
    isPermanent(card(p)) || zeroTolerance.zeroToleranceIsPermanent(s, p),
  friendly: (s) => targets(s, "friendly"),
  controlled: (s) => targets(s, "controlled"),
  enemies: (s, attack) => targets(s, "enemy", attack),
  schemes: (s, thwart, ignore) =>
    ignore
      ? [
          { id: "main", label: card(s.scheme.code).name },
          ...s.sideSchemes.map((p) => ({
            id: p.id,
            label: card(p).name,
            code: p.code,
          })),
        ]
      : targets(s, "scheme", false, thwart),
  damage: (s, id) =>
    id === "hero"
      ? maxHP(s) - s.player.hp
      : id.startsWith("hero:")
        ? maxHP(seatView(s, id.slice(5))) - seatView(s, id.slice(5)).player.hp
        : find(s, id)?.damage || 0,
  canReady: (s, id) =>
    id === "hero"
      ? s.player.exhausted && canReadyIdentity(s)
      : id.startsWith("hero:")
        ? seatView(s, id.slice(5)).player.exhausted &&
          canReadyIdentity(seatView(s, id.slice(5)))
        : !!find(s, id)?.exhausted &&
          nova.novaCanReadyPiece(s, find(s, id)!, { isTextBlank }),
  ready: (s, id) => {
    if (id === "hero") readyIdentity(s);
    else if (id.startsWith("hero:")) readyIdentity(seatView(s, id.slice(5)));
    else {
      const p = find(s, id);
      if (p && nova.novaCanReadyPiece(s, p, { isTextBlank }))
        p.exhausted = false;
    }
  },
  exhaust: (s, id) => {
    if (id === "hero") s.player.exhausted = true;
    else if (id.startsWith("hero:"))
      seatView(s, id.slice(5)).player.exhausted = true;
    else {
      const p = find(s, id);
      need(p && !p.exhausted, "A ready character is required.");
      p!.exhausted = true;
    }
  },
  heal,
  discard: discardPiece,
  shuffle: (s) => {
    s.player.deck = shuffle(s, s.player.deck);
  },
  shuffleEncounter: (s) => {
    s.encounter.deck = shuffle(s, s.encounter.deck);
  },
  cost: (s, p) => cardCost(s, card(p), p),
  canPay: (s, p) => canPay(s, cardCost(s, card(p), p), [], p.id, p.code),
  playReaction: (s, p, effects, after) =>
    add(
      s,
      E("payRequest", {
        title: card(p).name,
        cost: cardCost(s, card(p), p),
        piece: p,
        cancelable: true,
        after: [
          E("resolveHandEvent", {
            id: p.id,
            after: effects,
            continuation: after,
          }),
        ],
        cancellationQueue: after,
      }),
    ),
  canPlayAction: (s, p) =>
    !playable(
      {
        ...s,
        phase: "player",
        prompt: null,
        review: null,
        turnPlayerId: s.activePlayerId,
      },
      p,
    ),
  playAction: requestPlay,
  flip: (s, form) => flip(s, false, form),
  attack: (s, id, after, taunt) => {
    enemyAttack(s, id, undefined, {
      playerId: s.activePlayerId,
      enemyId: id,
      kind: "attack",
      modifier: 0,
      after: E("angelAttackEnd", { after }),
    });
    if (taunt && s.attack?.attacker === id)
      s.attack.angelTauntPlayerId = s.activePlayerId;
  },
  batch: spectrumPorts.damageBatch,
  attach: (s, p, target) => {
    removeEncounterInstance(s, p.id);
    mutagenPorts.attach(s, p, target);
  },
  reveal: (s, p) => {
    removeEncounterInstance(s, p.id);
    add(s, E("reveal", { piece: p }));
  },
  cancelReveal: (s, p) => {
    removeEncounterInstance(s, p.id);
    s.queue = s.queue.filter(
      (e) => !(e.type === "reveal" && e.piece?.id === p.id),
    );
    s.encounter.discard.push(resetPiece(p));
  },
  discardPlayerCards: mill,
  dealEncounter,
};

const x23Ports: x23.X23Ports = {
  queue: add,
  choose,
  makePiece,
  find,
  maxHP,
  stats: heroStats,
  allyStat,
  allyHP: pieceHP,
  damageCostResponses: (s, amount) =>
    spiderHam.spiderHamAfterDamage(
      s,
      {
        token: `x23-cost:${s.nextId++}`,
        playerId: s.activePlayerId,
        actualDamage: amount,
      },
      spiderHamPorts,
    ),
  canReady: (s) => s.player.exhausted && canReadyIdentity(s),
  ready: (s) => {
    readyIdentity(s);
  },
  canTakeDamageCost: (s, n) => wolverinePorts.canTakeDamageCost(s, n),
  takeDamageCost: (s, n) => {
    const paid = wolverinePorts.takeDamageCost(s, n);
    check(s);
    return paid;
  },
  canPay: angelPorts.canPay,
  reaction: gambitPorts.reaction,
  discard: discardPiece,
  discardHand,
  discardTop: discardNativePlayerTop,
  discardEncounterTop: (s) => mutagenPorts.discardTop(s).piece,
  randomDiscard,
  shuffle: (s) => {
    revealHidden(s);
    s.player.deck = shuffle(s, s.player.deck);
  },
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  hidden: revealHidden,
  attach: (s, p, target) => {
    removeEncounterInstance(s, p.id);
    s.attachments = s.attachments.filter((q) => q.id !== p.id);
    p.attachedTo = target;
    s.attachments.push(p);
  },
  keepObligation: gambitPorts.keepObligation,
  putMinion: (s, p) => mutagenPorts.putMinion(s, p, s.activePlayerId),
  indirect: (s, amount, source) =>
    zzzaxPorts.indirect(s, {
      playerId: s.activePlayerId,
      amount,
      sourceId: source,
      sourceTitle: "Lady Deathstrike",
    }),
  heal,
  batch: spectrumPorts.damageBatch,
  canStatus: antManPorts.canGiveStatus,
  cancelReveal: angelPorts.cancelReveal,
  declareDefense: psylockePorts.declareDefense,
  permanent: angelPorts.permanent,
};

const stormPorts: storm.StormPorts = {
  queue: add,
  choose,
  makePiece,
  isTextBlank,
  identityBlank: (s) =>
    isTextBlank(s, { code: heroCard(s).code, id: `hero:${s.activePlayerId}` }),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  schemeTargets: (s, thwart) => targets(s, "scheme", false, thwart),
  friendlyTargets: (s) =>
    targets(s, "friendly").filter((t) => playerHealingTarget(s, t.id)),
  hasTrait: sinisterNativeHasTrait,
  enemyStats: (s, p) => enemyStats(s, p),
  allyStat,
  heroAttack: (s) => heroStats(s).attack,
  maxHeroHP: maxHP,
  alliedPieces: (s) =>
    [
      ...allInPlay(s),
      ...playerOrder(s).flatMap((seat) => controlledNPCs(s, seat.id)),
    ].filter((p) => card(p).type_code === "ally"),
  canReady: (s, id) =>
    id === "hero"
      ? s.player.exhausted && canReadyIdentity(s)
      : !!find(s, id)?.exhausted,
  canStatus: quicksilverPorts.canGiveStatus,
  canPay,
  cost: (s, p) => cardCost(s, card(p), p),
  playDefense: (s, p, after) => {
    add(
      s,
      E("payRequest", {
        title: card(p).name,
        cost: cardCost(s, card(p), p),
        piece: p,
        cancelable: true,
        after: [
          E("resolveHandEvent", {
            id: p.id,
            after: storm.stormEvent(s, p) || [],
            continuation: after,
          }),
        ],
        cancellationQueue: after,
      }),
    );
  },
  attackProgram: niAttackProgram,
  thwartDistribution: (s, packets, after) => {
    const before = new Set(s.queue);
    waspPorts.thwartDistribution(s, packets);
    const generated = s.queue.filter((e) => !before.has(e));
    s.queue = s.queue.filter((e) => before.has(e));
    add(s, ...generated, ...after);
  },
  damageBatch: spectrumPorts.damageBatch,
  shufflePlayer: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  reveal: (s, p) => {
    removeEncounterInstance(s, p.id);
    add(s, E("reveal", { piece: p }));
  },
  discard: discardPiece,
  returnAlly: (s, id) => {
    if (allInPlay(s).some((p) => p.id === id))
      mutantGenesisPackPorts.returnAllyToHand(s, id, []);
  },
  putAlly: (s, id, after) => {
    const i = s.player.deck.findIndex((p) => p.id === id),
      p = s.player.deck[i];
    if (!p || uniqueConflict(s, card(p))) {
      add(s, ...after);
      return;
    }
    s.player.deck.splice(i, 1);
    Object.assign(p, resetPiece(p, true));
    s.player.inPlay.push(p);
    add(
      s,
      E("allyLimit"),
      E("allyEnter", { id: p.id, fromHand: false }),
      ...after,
    );
  },
  discardEncounterTop: (s) => mutagenPorts.discardTop(s).piece,
  flipAlter: (s) => flip(s, false, "alter"),
  attach: (s, p, id) => {
    removeEncounterInstance(s, p.id);
    s.attachments = s.attachments.filter((a) => a.id !== p.id);
    if (p.code === "36038") {
      p.controlOrder = s.nextId++;
      for (const seat of s.players)
        delete seatView(s, seat).flags[`stormController:${id}`];
      const seat = controller(s, id);
      if (seat) seatView(s, seat).flags[`stormController:${id}`] = seat.id;
    }
    mutagenPorts.attach(s, p, id);
  },
  remove: (s, p) => {
    removeEncounterInstance(s, p.id);
    for (const zone of [
      s.attachments,
      s.removed,
      ...s.players.map((seat) => seatView(s, seat).player.inPlay),
    ]) {
      const i = zone.findIndex((q) => q.id === p.id);
      if (i >= 0) zone.splice(i, 1);
    }
  },
  searchEncounter: (s, codes, includeSetAside, after) => {
    const zones = [
      s.encounter.deck,
      s.encounter.discard,
      ...(includeSetAside
        ? s.players.map((seat) => seatView(s, seat).player.setAside || [])
        : []),
    ];
    const found = zones.flat().find((p) => codes.includes(p.code));
    if (found)
      for (const zone of zones) {
        const i = zone.findIndex((p) => p.id === found.id);
        if (i >= 0) zone.splice(i, 1);
      }
    mutagenPorts.shuffleEncounter(s);
    add(s, ...(found ? [E("reveal", { piece: found })] : []), ...after);
  },
  activate: (s, id, after) =>
    mystiquePorts.activateMystique(s, id, s.activePlayerId, after),
};

const colossusPorts: colossus.ColossusPorts = {
  queue: add,
  choose,
  isTextBlank,
  isIdentityTextBlank: (s) =>
    isTextBlank(s, { code: heroCard(s).code, id: `hero:${s.activePlayerId}` }),
  canDraw: (s) => s.player.deck.length + s.player.discard.length > 0,
  canReadyIdentity: (s, id) => canReadyIdentity(seatView(s, id)),
  canChangeForm: canChangeIdentityForm,
  flip: (s, counts, target) =>
    flip(s, counts, target === "hero" ? undefined : target),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay,
  canGiveStatus: quicksilverPorts.canGiveStatus,
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  friendlyTargets: (s) =>
    playerOrder(s).flatMap((seat) => {
      const view = seatView(s, seat);
      return [
        { id: `hero:${seat.id}`, label: heroCard(view).name },
        ...view.player.inPlay
          .filter((p) => card(p).type_code === "ally")
          .map((p) => ({ id: p.id, code: p.code, label: card(p).name })),
      ];
    }),
  attackProgram: niAttackProgram,
  shufflePlayerDeck: warMachinePortsShufflePlayer,
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  makePiece,
  revealEncounter: (s, p) => add(s, E("reveal", { piece: p })),
  attach: (s, p, target) => {
    removeEncounterInstance(s, p.id);
    mutagenPorts.attach(s, p, target);
  },
  discardPiece,
  discardTough: colossusNativeDiscardTough,
  discardUntilColossus: (s, after) => {
    const before = s.queue.length;
    const index = s.player.deck.findIndex(
      (p) => card(p).set_code === "colossus" && card(p).faction_code === "hero",
    );
    const discarded = mill(s, index < 0 ? s.player.deck.length : index + 1);
    const found = index < 0 ? undefined : discarded[index];
    const exhaustion = s.queue.splice(0, s.queue.length - before);
    add(
      s,
      ...exhaustion,
      E("colossusNativeStudioFound", { id: found?.id, after }),
    );
  },
  reactionEvents: eventPlaySources,
  canPlayReaction: (s, p) =>
    !ghostSpider.ghostSpiderCannotPlayEvents(s) && !isTextBlank(s, p),
  playReaction: (s, id, context, after) => {
    const p = eventPlaySources(s).find((p) => p.id === id);
    need(p, "The actual owned Colossus interrupt event is unavailable.");
    const cancellation =
      context.kind === "basic-attack"
        ? [{ ...context.packet, colossusRageHandled: true }, ...after]
        : after;
    requestPayment(
      s,
      card(p!).name,
      cardCost(s, card(p!), p),
      [
        E("resolveHandEvent", {
          id,
          after: colossus.colossusReaction(s, p!, context),
          continuation: after,
        }),
      ],
      sinisterPlayRequirements(p!),
      p,
      true,
    );
    if (s.prompt?.cancelable)
      s.prompt.cancellationQueue = [...cancellation, ...s.queue];
  },
  activationAvailable: (s, receipt) =>
    !!seatView(s, receipt.playerId).flags[
      `colossusActivation:${receipt.token}`
    ] &&
    receipt.isVillain &&
    receipt.enemyId === s.villain.id,
  resumeBasicAttack: (s, packet, after) => {
    const next = effectContext(s, {
      ...packet,
      eventId: packet.eventId,
      attackProgramId: packet.attackProgramId,
    });
    const boundary = s.queue.findIndex(
      (e) => e.type === "finishResolution" && e.id === s.currentEventId,
    );
    if (boundary < 0) add(s, next, ...after);
    else
      s.queue.splice(
        boundary + 1,
        0,
        next,
        ...after.map((e) => effectContext(s, e)),
      );
  },
};

const shadowcatPorts: shadowcat.ShadowcatPorts = {
  ...antManPorts,
  attackProgram: niAttackProgram,
  makePiece,
  cardCost: (s, p) => cardCost(s, card(p), p),
  maxHeroHP: maxHP,
  isIdentityTextBlank: (s) => isTextBlank(s, heroCard(s)),
  canChangeMassForm: canChangeIdentityForm,
  massFormChanged: (s, from, to) => {
    log(s, `Change mass form from ${from} to ${to}.`);
    spectrumPorts.refreshDefense(s);
    syncNebulaIdentityStatuses(s);
  },
  formResponseOptions: spectrumPorts.formResponseOptions,
  enemyTargets: (s, attacking, ignoreGuard = false) => {
    const ordinary = targets(s, "enemy", attacking);
    if (
      ignoreGuard &&
      attacking &&
      !ordinary.some((t) => t.id === s.villain.id) &&
      valkyrie.valkyrieCanAttackTarget(s, s.villain.id)
    )
      ordinary.unshift({
        id: s.villain.id,
        label: card(s.villain).name,
        code: s.villain.code,
      });
    return ordinary;
  },
  schemeTargets: (s, thwarting, ignoreCrisis, ignorePatrol) =>
    thwarting
      ? visionPorts.schemeTargets(s, thwarting, ignoreCrisis, ignorePatrol)
      : antManPorts.schemeTargets(s, false),
  canDiscardAttachment: visionPorts.canDiscardAttachment,
  defenseEventSources: (s) =>
    visionPack.visionPackDefenseEvents(s, visionPackPorts),
  canPlayDefenseEvent: (s, p) => {
    const a = s.attack;
    return (
      !!a &&
      s.player.form === "hero" &&
      shadowcat.shadowcatCanDefend(s) &&
      vision.visionCanDefend(s) &&
      !attackTargetsEnemy(s, a) &&
      !armadillo.armadilloDefenseBlocked(s, a.attacker) &&
      !(
        rulesCode(find(s, a.attacker) || a.attackerSnapshot!) === "01132" &&
        friends(s).some((p) => !p.exhausted)
      ) &&
      (!a.defender ||
        a.defender === "none" ||
        (a.defender === "hero" &&
          (a.targetPlayerId || s.activePlayerId) === s.activePlayerId))
    );
  },
  playDefenseEvent: (s, id, after) => {
    const p = visionPack
      .visionPackDefenseEvents(s, visionPackPorts)
      .find((p) => p.id === id);
    need(
      p && shadowcatPorts.canPlayDefenseEvent!(s, p),
      "Quick Shift's actual source or defense window is unavailable.",
    );
    add(
      s,
      E("payRequest", {
        title: card(p!).name,
        cost: cardCost(s, card(p!), p),
        piece: p,
        cancelable: true,
        after: [
          E("resolveHandEvent", {
            id,
            after: shadowcat.shadowcatDefenseEvent(s, p!) || [],
            continuation: after,
          }),
        ],
        cancellationQueue: after,
      }),
    );
  },
  declareDefense: (s, _eventId) => {
    const a = s.attack;
    need(
      a &&
        s.player.form === "hero" &&
        shadowcat.shadowcatCanDefend(s) &&
        vision.visionCanDefend(s),
      "This identity cannot defend.",
    );
    need(
      !a!.defender ||
        a!.defender === "none" ||
        (a!.defender === "hero" &&
          (a!.targetPlayerId || s.activePlayerId) === s.activePlayerId),
      "Another character already defends this attack.",
    );
    const basic =
      a!.defender === "hero" &&
      (a!.targetPlayerId || s.activePlayerId) === s.activePlayerId &&
      a!.basicDefense;
    a!.defender = "hero";
    a!.targetPlayerId = s.activePlayerId;
    a!.basicDefense = !!basic;
    if (!basic) a!.defense = 0;
    // Event defense retains its defender without adding basic DEF or exhaustion.
    a!.eventDefense = true;
  },
  giveObligation: spectrumPorts.giveObligation,
  putMinion: (s, p, playerId) => {
    removeEncounterInstance(s, p.id);
    Object.assign(p, resetPiece(p, true));
    mutagenPorts.putMinion(s, p, playerId);
  },
  shuffleEncounter: mutagenPorts.shuffleEncounter,
  giveStatus: (s, target, status) => {
    const view = target.startsWith("hero:") ? seatView(s, target.slice(5)) : s;
    if (target === "hero" || target.startsWith("hero:"))
      giveCharacterStatus(view, view.player, status);
    else {
      const p = find(s, target);
      if (p) giveCharacterStatus(s, p, status);
    }
  },
  // Retain the native DamageResult.damageDealt before the printed
  // Phased Strike continuation, with false for wholly redirected/replaced
  // damage and true for damage dealt to the original enemy but prevented.
  wasDamageDealtTo: (s, abilitySource, target) =>
    s.flags[`shadowcatDealt:${abilitySource}:${target}`] !== false,
};

const mutantGenesisPackPorts: mgPack.MutantGenesisPlayerPackPorts = {
  queue: add,
  attackEventTotalBonus: (s, eventId) =>
    Number(s.flags[`gambitEvent:${eventId}`] || 0) +
    mgPack.mutantGenesisPlayerPackAttackEventBonus(s, eventId) +
    Number(s.flags[`niHoned:${eventId}`] || 0) +
    msMarvelEventAmountModifier(s, eventId, "damage"),
  choose,
  isTextBlank,
  identityHasTrait: (s, trait) => sinisterNativeHasTrait(s, "hero", trait),
  identityHeroName: (s) =>
    card(HEROES.find((h) => h.id === s.heroId)!.code).name,
  hasTrait: (s, target, trait) => {
    if (target === "hero" || target.startsWith("hero:"))
      return sinisterNativeHasTrait(s, target, trait);
    const p = sinisterNativePiece(s, target);
    return (
      !!p &&
      (card(p).traits || "").split(/\.\s*/).filter(Boolean).includes(trait)
    );
  },
  friendlyTargets: (s) =>
    playerOrder(s).flatMap((seat) => {
      const view = seatView(s, seat);
      return [
        {
          id: `hero:${seat.id}`,
          label: heroCard(view).name,
          code: heroCard(view).code,
        },
        ...view.player.inPlay
          .filter((p) => card(p).type_code === "ally")
          .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
      ];
    }),
  enemyTargets: (s, attack) => targets(s, "enemy", attack),
  canReady: (s, target) => {
    const id =
      target === "hero"
        ? s.activePlayerId
        : target.startsWith("hero:")
          ? target.slice(5)
          : undefined;
    return id
      ? seatView(s, id).player.exhausted && canReadyIdentity(seatView(s, id))
      : !!find(s, target)?.exhausted && warMachinePackPorts.canReady(s, target);
  },
  canHeal: (s, target) => {
    const id =
      target === "hero"
        ? s.activePlayerId
        : target.startsWith("hero:")
          ? target.slice(5)
          : undefined;
    return id
      ? seatView(s, id).player.hp < maxHP(seatView(s, id))
      : Number(find(s, target)?.damage || 0) > 0;
  },
  canGiveStatus: dsPorts.canAddStatus,
  canExhaustIdentity: (s) => s.player.form === "hero" && !s.player.exhausted,
  exhaustCards: sinisterPlayerPackPorts.exhaustCards,
  heroAttack: (s) => heroStats(s).attack,
  allyAttack: (s, p) => allyStat(s, p, "attack"),
  cardCost: (s, p) => cardCost(s, card(p), p),
  canPay,
  handPlayableCards: eventPlaySources,
  canPutAlly: (s, p) =>
    card(p).type_code === "ally" && !uniqueConflict(s, card(p)),
  putAlly: (s, id, after) => {
    const before = new Set(s.queue);
    putAllyFromHand(s, id);
    const generated = s.queue.filter((q) => !before.has(q));
    s.queue = s.queue.filter((q) => before.has(q));
    add(s, ...generated, ...after);
  },
  canDeclareAllyDefender: (s, r, id) => {
    const p = allInPlay(s).find((p) => p.id === id),
      seat = controller(s, id);
    return (
      !!s.attack &&
      s.attack.attacker === r.attackerId &&
      s.attack.id === r.token &&
      !!p &&
      !!seat &&
      !seat.eliminated &&
      !p.exhausted &&
      card(p).type_code === "ally" &&
      !armadillo.armadilloDefenseBlocked(s, r.attackerId)
    );
  },
  declareAllyDefender: (s, r, id) => {
    need(
      mutantGenesisPackPorts.canDeclareAllyDefender(s, r, id),
      "The actual put ally cannot defend this attack.",
    );
    const p = allInPlay(s).find((p) => p.id === id)!,
      seat = controller(s, id)!;
    p.exhausted = true;
    s.attack!.defender = p.id;
    s.attack!.targetPlayerId = seat.id;
    s.attack!.basicDefense = false;
    s.attack!.defense = 0;
    // Retain this actual event-created defender through declareDefense.
    s.attack!.eventDefense = true;
    s.attack!.mutantProtectorsDefender = { allyId: p.id, playerId: seat.id };
    add(
      s,
      ...(
        sinisterPlayerPack.sinisterPlayerPackAllyDefenseInterrupt(
          seatView(s, seat),
          p.id,
          r.attackerId,
          sinisterPlayerPackPorts,
        ) || []
      ).map((e) => ({ ...e, actorId: seat.id })),
    );
  },
  returnAllyToHand: (s, id, after) => {
    const p = allInPlay(s).find((p) => p.id === id),
      seat = controller(s, id);
    need(p && seat, "Returning Nightcrawler requires the same physical ally.");
    const before = new Set(s.queue);
    // RETURN is not a discard. Avoid Pinpoint's discard-only replacement;
    // generic leave effects and attached-card cleanup still run natively.
    s.flags[`niLeaveCommitted:${id}`] = true;
    s.flags[`spiderHamReturnHand:${id}`] = p!.ownerId || seat!.id;
    if (s.attack?.defender === id) s.attack.gmwReturnedDefender = id;
    movePieceFromPlay(s, id, false);
    delete s.flags[`niLeaveCommitted:${id}`];
    const generated = s.queue.filter((q) => !before.has(q));
    s.queue = s.queue.filter((q) => before.has(q));
    add(s, ...generated, ...after);
  },
  shuffleMinionIntoEncounter: (s, id, after) => {
    const p = s.minions.find((p) => p.id === id);
    need(p, "The actual Magik minion is unavailable.");
    const before = new Set(s.queue);
    const ownedCard =
      p!.droneCard || (card(p!).faction_code !== "encounter" ? p! : undefined);
    if (ownedCard) s.flags[`niLeaveCommitted:${id}`] = true;
    // Leave without defeat, retaining this physical minion and discarding its
    // actual attached player/encounter cards through their ordinary cleanup.
    movePieceFromPlay(s, id, false);
    delete s.flags[`niLeaveCommitted:${id}`];
    if (ownedCard) {
      // Official Magik ruling #175 and RRG1.8 Ownership and Control: a player
      // card treated as a minion goes to its owner's equivalent player deck.
      const owner = s.players.find(
        (seat) => seat.id === ownedCard.ownerId && !seat.eliminated,
      );
      if (owner) {
        const view = seatView(s, owner);
        for (const zone of [
          view.player.hand,
          view.player.deck,
          view.player.discard,
          s.removed,
        ]) {
          const index = zone.findIndex((card) => card.id === ownedCard.id);
          if (index >= 0) zone.splice(index, 1);
        }
        view.player.deck.push(resetPiece(ownedCard, true));
        const originalActor = s.activePlayerId;
        activateSeat(s, owner.id);
        s.player.deck = shuffle(s, s.player.deck);
        activateSeat(s, originalActor);
      }
    } else {
      removeEncounterInstance(s, id);
      s.encounter.deck.push(resetPiece(p!, true));
      mutagenPorts.shuffleEncounter(s);
    }
    const generated = s.queue.filter((q) => !before.has(q));
    s.queue = s.queue.filter((q) => before.has(q));
    add(s, ...generated, ...after);
  },
  attach: (s, id, target) => {
    const p = allInPlay(s).find((p) => p.id === id);
    need(p, "This actual player upgrade must remain in play.");
    p!.attachedTo = target;
    // Training and Gatekeeper remain under the playing player's control.
  },
  attackAvailable: (s, r) =>
    !!s.attack &&
    s.attack.attacker === r.attackerId &&
    s.attack.id === r.token &&
    !!nebulaNativeAttacker(s, r.attackerId),
  playEvent: (s, id, effects, r, after) => {
    const p = eventPlaySources(s).find((p) => p.id === id);
    need(p, "The actual attack-interrupt event is unavailable.");
    add(
      s,
      E("payRequest", {
        title: card(p!).name,
        cost: cardCost(s, card(p!), p),
        piece: p,
        requirements: sinisterPlayRequirements(p!),
        cancelable: true,
        commit: [
          E("mutant-genesis-player:attack-paid", {
            id,
            code: p!.code,
            receipt: r,
          }),
        ],
        after: [
          E("resolveHandEvent", { id, after: effects, continuation: after }),
        ],
        cancellationQueue: after,
      }),
    );
  },
  claimDefense: (s, r) => {
    need(
      mutantGenesisPackPorts.attackAvailable(s, r) &&
        !armadillo.armadilloDefenseBlocked(s, r.attackerId),
      "This pending attack cannot be defended.",
    );
    const a = s.attack!;
    if (!a.defender || a.defender === "none") {
      a.defender = "hero";
      a.basicDefense = false;
      a.defense = 0;
      a.targetPlayerId = s.activePlayerId;
      a.eventDefense = true;
      add(s, E("quicksilverLateDefense"));
    }
  },
  preventAttack: (s, r) => {
    if (mutantGenesisPackPorts.attackAvailable(s, r))
      s.attack!.preventAllDamage = true;
  },
  damageAvailable: (s, packet) => {
    const a = s.attack;
    return (
      !!a &&
      packet.damageWindowId === a.id &&
      packet.amount > 0 &&
      (packet.attacker === undefined || packet.attacker === a.attacker) &&
      !a.preventAllDamage &&
      !!nebulaNativeAttacker(s, a.attacker)
    );
  },
  preventDamage: (s, packet, amount) => {
    if (packet.kind === "overkill")
      s.attack!.identityPrevented =
        Number(s.attack!.identityPrevented || 0) + amount;
    else if (s.attack) s.attack.prevented += amount;
  },
  simultaneousAttack: (s, allocations, after) =>
    niAttackProgram(
      s,
      [
        E("waspDistributedAttack", {
          packets: allocations,
          basic: false,
          chooserId: s.firstPlayerId,
          mutantGenesisBonusApplied: true,
        }),
      ],
      after,
    ),
};

function shadowcatNativeCompletion(
  s: GameState,
  kind: "attack" | "defense",
  performed: boolean,
  token = `mass-completion:${s.nextId++}`,
): Effect[] {
  if (s.heroId !== "shadowcat" || !performed) return [];
  const mass = s.player.inPlay.find((p) =>
    ["32031a", "32031b"].includes(p.code),
  );
  const receipt: shadowcat.ShadowcatCompletionReceipt = {
    token,
    playerId: s.activePlayerId,
    kind,
    performed,
    massId: mass?.id,
    massForm: shadowcat.shadowcatMassForm(s),
    massTextBlank: shadowcat.shadowcatMassTextBlank(s, shadowcatPorts),
  };
  return [
    E("shadowcatNativeCompletionWindow", {
      receipt,
      actorId: s.activePlayerId,
    }),
  ];
}
function mutantGenesisAttackOptions(
  s: GameState,
  stage: "initiated" | "attacks",
  after: Effect[],
): Option[] {
  const a = s.attack;
  if (!a || !nebulaNativeAttacker(s, a.attacker) || attackTargetsEnemy(s, a))
    return [];
  const receipt: mgPack.MutantGenesisAttackReceipt = {
    token: a.id!,
    playerId: a.originalPlayerId || s.activePlayerId,
    attackerId: a.attacker,
    stage,
  };
  return playerOrder(s).flatMap((seat) => {
    const view = seatView(s, seat);
    if (a.angelTauntPlayerId && a.angelTauntPlayerId !== seat.id) return [];
    const opts = mgPack
      .mutantGenesisPlayerPackAttackOptions(
        view,
        receipt,
        after,
        mutantGenesisPackPorts,
      )
      .filter((o) => !a.angelTauntPlayerId || o.image !== "32017");
    if (stage === "attacks")
      opts.push(
        ...angel.angelDefenseOptions(view, after, angelPorts),
        ...rogue.rogueDefenseOptions(view, "attacks", after, roguePorts),
        ...storm.stormDefenseOptions(view, after, stormPorts),
        ...shadowcat.shadowcatDefenseOptions(view, [], after, shadowcatPorts),
      );
    return opts.map((o) => ({
      ...o,
      id: `${seat.id}:${o.id}`,
      effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
    }));
  });
}
function mutantGenesisDamageOptions(
  s: GameState,
  target: string,
  amount: number,
  after: Effect[],
): Option[] {
  const a = s.attack;
  if (!a || amount <= 0) return [];
  const packet = {
    type: "attackDamage",
    kind: "attack",
    target: target === "hero" ? `hero:${s.activePlayerId}` : target,
    amount,
    attack: true,
    attacker: a.attacker,
    damageWindowId: a.id,
  };
  return playerOrder(s).flatMap((seat) =>
    [
      ...cable.cableDamageOptions(seatView(s, seat), packet, after, cablePorts),
      ...angel.angelDamageOptions(seatView(s, seat), packet, after, angelPorts),
      ...mgPack.mutantGenesisPlayerPackDamageOptions(
        seatView(s, seat),
        packet,
        after,
        mutantGenesisPackPorts,
      ),
    ].map((o) => ({
      ...o,
      id: `${seat.id}:${o.id}`,
      effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
    })),
  );
}
function mutantGenesisIncomingPiercing(
  s: GameState,
  target: string,
  amount: number,
) {
  const a = s.attack;
  const targetId = target === "hero" ? `hero:${s.activePlayerId}` : target;
  if (
    !a ||
    amount <= 0 ||
    a.piercingTargets?.includes(targetId) ||
    !(a.piercing || sourceKeyword(s, a.attacker, "Piercing"))
  )
    return;
  (a.piercingTargets ||= []).push(targetId);
  const p = target === "hero" ? s.player : find(s, target);
  if (
    p &&
    amount > 0 &&
    (a.piercing || sourceKeyword(s, a.attacker, "Piercing"))
  )
    colossusNativeDiscardTough(
      s,
      [{ targetId: target, amount: statusCards(p, "tough") }],
      [],
      true,
    );
}

/** Armor Up interrupts this retained activation, before attack/scheme-specific
 * abilities. Explicit extra activations retain their printed activation kind. */
function colossusNativeActivationWindow(
  s: GameState,
  enemyId: string,
  kind: "attack" | "scheme",
  continuation: Effect,
): boolean {
  if (enemyId !== s.villain.id) return false;
  const receipt: colossus.ColossusActivationReceipt = {
    token: `colossus-activation:${s.nextId++}`,
    enemyId,
    playerId: s.activePlayerId,
    kind,
    isVillain: true,
  };
  s.flags[`colossusActivation:${receipt.token}`] = true;
  const next = {
    ...continuation,
    colossusActivationHandled: true,
    colossusActivationReceipt: receipt,
    actorId: receipt.playerId,
  };
  const choices = playerOrder(s).flatMap((seat) =>
    colossus
      .colossusActivationOptions(
        seatView(s, seat),
        receipt,
        [next],
        colossusPorts,
      )
      .map((choice) => ({
        ...choice,
        id: `${seat.id}:${choice.id}`,
        effects: choice.effects.map((effect) => ({
          ...effect,
          actorId: seat.id,
        })),
      })),
  );
  if (!choices.length) {
    delete s.flags[`colossusActivation:${receipt.token}`];
    return false;
  }
  choose(
    s,
    "Villain would activate",
    "Play Armor Up before the villain activates?",
    [...choices, option("continue", "Continue activation", [next])],
  );
  return true;
}

function enemyAttack(
  s: GameState,
  id: string,
  extra?: string,
  activation?: MutagenActivation,
  originalTarget?: string,
  colossusActivationHandled = false,
  colossusActivationReceipt?: colossus.ColossusActivationReceipt,
) {
  if (
    !phoenix.phoenixCanActivate(s, id) ||
    allInPlay(s).some(
      (p) => p.code === "44054" && p.attachedTo === id && !isTextBlank(s, p),
    )
  )
    return;
  if (colossusActivationReceipt)
    delete seatView(s, colossusActivationReceipt.playerId).flags[
      `colossusActivation:${colossusActivationReceipt.token}`
    ];
  if (
    !activation?.after?.nebulaGamoraSource &&
    find(s, id) &&
    ghostNativeActivationWindow(
      s,
      id,
      "attack",
      E("ghostNativeEnemyAttack", {
        id,
        extra,
        activation,
        originalTarget,
        colossusActivationHandled,
      }),
    )
  )
    return;
  const canceled = () => {
    if (activation?.after)
      add(s, {
        ...activation.after,
        performed: false,
        damagePlaced: 0,
        threatPlaced: 0,
      });
  };
  const nebulaSource = activation?.after?.nebulaGamoraSource as
    nebula.NebulaAttackSource | undefined;
  const friendlySource = !!nebulaSource && nebulaSource.kind !== "enemy";
  if (
    nebulaSource?.kind === "hero" &&
    !vision.visionCanAttack(seatView(s, nebulaSource.playerId!))
  ) {
    canceled();
    return;
  }
  const p = nebulaNativeAttacker(s, id, nebulaSource);
  if (!p) {
    canceled();
    return;
  }
  if (p.stunned) {
    consumeStatus(
      nebulaSource?.kind === "hero"
        ? seatView(s, nebulaSource.playerId!).player
        : p,
      "stunned",
    );
    log(s, `${card(p).name} loses stunned instead of attacking.`);
    canceled();
    return;
  }
  if (
    !friendlySource &&
    !colossusActivationHandled &&
    colossusNativeActivationWindow(
      s,
      id,
      "attack",
      E("ghostNativeEnemyAttack", { id, extra, activation, originalTarget }),
    )
  )
    return;
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
  const shadowcatReplacement = shadowcat.shadowcatEnemyAttackReplacement(
    s,
    id,
    shadowcatPorts,
  );
  if (shadowcatReplacement) {
    add(s, ...shadowcatReplacement);
    canceled();
    return;
  }
  const moduleReplacement = ironspider.ironspiderSinisterAttackReplacement(
    s,
    p,
  );
  if (moduleReplacement) {
    add(s, ...moduleReplacement);
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
  const novaModifiers = friendlySource
    ? { attack: 0, overkill: false }
    : nova.novaEnemyAttackModifiers(s, p, s.activePlayerId, { isTextBlank });
  const base =
    nebulaNativeAttackStrength(s, p, s.activePlayerId, nebulaSource) +
    novaModifiers.attack;
  log(
    s,
    `${card(p).name} attacks ${originalTarget && find(s, originalTarget) ? card(find(s, originalTarget)!).name : heroCard(s).name}: ${base} base ATK${isVillain ? " before boost cards" : ""}.`,
    "bad",
  );
  s.flags.attacksPerformed = Number(s.flags.attacksPerformed || 0) + 1;
  s.attack = {
    id: `enemy-attack:${s.nextId++}`,
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
    overkill:
      novaModifiers.overkill ||
      (isVillain && !!villainAt(s, "01099").length) ||
      (!!nebulaSource && !!sourceKeyword(s, id, "Overkill")),
    extra,
    modifier:
      (activation?.modifier || 0) +
      novaModifiers.attack +
      psylocke.psylockeActivationBonus(s, id),
    omitNormalBoost: activation?.omitNormalBoost,
    activationAfter: activation?.after,
    attackerSnapshot: structuredClone(p),
  };
  if (rulesCode(p) === "01130" && extra !== "whirlwind" && !isTextBlank(s, p))
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
  add(
    s,
    E("prepareAttackBoosts"),
    E("mutantGenesisAttacksWindow"),
    E("declareDefense"),
  );
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
  add(s, ...cyclops.cyclopsEnemyAttackStarted(s, id));
  add(s, ...wolverine.wolverineEnemyAttackStarted(s, id));
  add(s, ...colossus.colossusEnemyAttackStarted(s, id, colossusPorts));
  // Forced entry and its responses precede every optional initiation interrupt.
  if (isVillain && rulesCode(s.villain) === "01135") add(s, E("drone"));
  if (!friendlySource)
    add(
      s,
      ...vision.visionEnemyAttackInitiated(s, p, s.attack.originalPlayerId!),
    );
  const forced = friendlySource ? [] : doctorStrangeEnemyAttackInitiated(s, p);
  if (forced.length) {
    if (s.prompt) {
      add(s, E("resumePrompt", { prompt: s.prompt }));
      s.prompt = null;
    }
    add(s, ...forced);
  }
}
function enemyDashPower(p: Piece, power: "attack" | "scheme") {
  return power === "attack"
    ? card(p).attack === null && !card(p).attack_star
    : (card(p).scheme === null && !card(p).scheme_star) ||
        (p.treatedAsMinion && card(p.code).thwart === null);
}
function enemyATK(s: GameState, p: Piece, originalPlayerId: string): number {
  if (enemyDashPower(p, "attack")) return 0;
  if (riskyBlankPower(s, "attack", p.id)) return 0;
  const bonus =
    angel.angelEnemyAttackModifier(s, p, angelPorts) +
    cyclops.cyclopsEnemyAttackModifier(s, p.id) +
    (p.bonusAtk || 0) +
    mutagenAttackModifiers(s, p).goblinNation +
    armadillo.armadilloAttackBonus(s, p) +
    zzzax.zzzaxEnemyStats(s, p).attack +
    inheritors.inheritorsModifiers(s, p).attack +
    mansionAttack.mansionAttackModifiers(s, p, { isTextBlank }).attack;
  const attachments = enemyAttachmentModifier(s, p.id, "attack");
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
          : (mystique.mystiqueStats(s, p, mystiquePorts)?.attack ??
              card(p).attack ??
              0) +
            (rulesCode(s.villain) === "01136" &&
            card(p).traits?.includes("Drone.")
              ? 1
              : 0);
  return (
    base +
    storm.stormGlobal(s).attack +
    (s.attack?.attacker === p.id
      ? storm.stormFreezeModifier(
          s,
          p,
          s.attack.targetPlayerId || originalPlayerId,
        )
      : 0) +
    bonus +
    x23.x23EnemyAttackModifier(s, p.id) +
    attachments +
    ironheart.ironheartEnemyStats(s, p, { isTextBlank }).attack +
    blackWidowEnemyModifier(s, p, originalPlayerId) +
    rocket.rocketEnemyStats(s, p).attack +
    drax.draxEnemyStats(s, p).attack +
    nebula.nebulaNamedCharacterModifiers(s, card(p).name).attack +
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
    ...armadillo
      .armadilloActivationResponses(s, a.attacker)
      .flatMap((r) => r.effects),
    ...(a.afterActivation || []),
    ...(a.visionAfterAttack || []),
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
  if (a.defender === "hero") {
    const previous = s.activePlayerId;
    activateSeat(s, a.targetPlayerId || previous);
    add(s, ...shadowcatNativeCompletion(s, "defense", true));
    activateSeat(s, previous);
  }
  s.attack = null;
}
function prepareAttackBoosts(s: GameState) {
  const a = s.attack;
  if (!a || a.pendingBoosts) return;
  a.pendingBoosts = [];
  const attacker = nebulaNativeAttacker(s, a.attacker);
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
      : attacker && keyword(attacker, "Villainous", s)
        ? 1
        : 0;
  if (a.isVillain)
    a.pendingBoosts.push(...(s.encounter.storedBoosts || []).splice(0));
  a.pendingBoosts.push(...(attacker.inheritorBoosts || []).splice(0));
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
  const p = nebulaNativeAttacker(s, a.attacker);
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
  if (a.valkyrieDefense || a.eventDefense) {
    add(s, E("boostAttack", { actorId: a.targetPlayerId }));
    return;
  }
  const base =
    nebulaNativeAttackStrength(s, p, a.originalPlayerId || s.activePlayerId) +
    (a.modifier || 0);
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
    if (armadillo.armadilloDefenseBlocked(s, a.attacker)) break;
    const view = seatView(s, seat);
    if (a.angelTauntPlayerId && a.angelTauntPlayerId !== seat.id) continue;
    if (
      view.player.form === "hero" &&
      !view.player.exhausted &&
      vision.visionCanDefend(view) &&
      shadowcat.shadowcatCanDefend(view) &&
      !magneto.magnetoIdentityRestricted(s, seat.id, { isTextBlank })
    )
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
    for (const ally of friends(view).filter(
      (p) => !p.exhausted && !a.angelTauntPlayerId,
    ))
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
  if (!s.scheming && s.attack?.angelIgnoreBoosts) return;
  const cableBoost = cable.cableBoost(s, p);
  if (cableBoost !== null) {
    add(s, ...cableBoost);
    return;
  }
  const xboost = x23.x23Boost(p);
  if (xboost !== null) {
    add(s, ...xboost);
    return;
  }
  const deadpoolBoost = deadpool.deadpoolBoost(s, p);
  if (deadpoolBoost !== null) {
    add(s, ...deadpoolBoost);
    return;
  }
  const angelBoost = angel.angelBoost(s, p);
  if (angelBoost !== null) {
    add(s, ...angelBoost);
    return;
  }
  const mutantScenarioBoost =
    magneto.magnetoBoost(s, p) ??
    acolytes.acolytesBoost(s, p) ??
    mansionAttack.mansionAttackBoost(s, p) ??
    masterMold.masterMoldBoost(s, p) ??
    wideawake.projectWideawakeBoost(s, p) ??
    zeroTolerance.zeroToleranceBoost(s, p) ??
    sentinels.sentinelsBoost(s, p) ??
    sabretooth.sabretoothBoost(s, p) ??
    brotherhood.brotherhoodBoost(s, p) ??
    mystique.mystiqueBoost(s, p);
  if (mutantScenarioBoost !== null) {
    if (["32067", "32068"].includes(p.code)) {
      const activation = s.scheming || s.attack;
      if (activation) (activation.retainedBoostIds ||= []).push(p.id);
    }
    add(s, ...mutantScenarioBoost);
    return;
  }
  if (p.code === "32058") {
    const activation = s.scheming || s.attack;
    if (activation) (activation.retainedBoostIds ||= []).push(p.id);
  }
  const gambitBoost = gambit.gambitBoost(s, p);
  if (gambitBoost !== null) {
    add(s, ...gambitBoost);
    return;
  }
  const cyclopsBoost = cyclops.cyclopsBoost(s, p);
  if (cyclopsBoost !== null) {
    add(s, ...cyclopsBoost);
    return;
  }
  const psylockeBoost = psylocke.psylockeBoost(s, p);
  if (psylockeBoost !== null) {
    add(s, ...psylockeBoost);
    return;
  }
  const wolverineBoost = wolverine.wolverineBoost(s, p);
  if (wolverineBoost !== null) {
    add(s, ...wolverineBoost);
    return;
  }
  const stormBoost = storm.stormBoost(s, p);
  if (stormBoost !== null) {
    if (stormBoost.some((e) => e.type === "storm:reveal-boost")) {
      const a = s.scheming || s.attack;
      if (a) (a.retainedBoostIds ||= []).push(p.id);
    }
    add(s, ...stormBoost);
    return;
  }
  const colossusBoost = colossus.colossusBoost(s, p);
  if (colossusBoost !== null) {
    if (p.code === "32029" && colossusBoost.length) {
      const activation = s.scheming || s.attack;
      if (activation) (activation.retainedBoostIds ||= []).push(p.id);
    }
    add(s, ...colossusBoost);
    return;
  }
  const moduleBoost = ironspider.ironspiderSinisterBoost(
    s,
    p,
    s.activePlayerId,
  );
  if (moduleBoost !== null) {
    if (moduleBoost.retainsCard) {
      const a = s.scheming || s.attack;
      if (a) (a.retainedBoostIds ||= []).push(p.id);
    }
    add(s, ...moduleBoost.effects);
    return;
  }
  const zzzaxBoost = zzzax.zzzaxBoost(s, p, s.activePlayerId);
  if (zzzaxBoost !== null) {
    if (zzzaxBoost.retainsCard) {
      const activation = s.scheming || s.attack;
      if (activation) (activation.retainedBoostIds ||= []).push(p.id);
    }
    add(s, ...zzzaxBoost.effects);
    return;
  }
  const rise =
    starLord.starLordBoost(s, p) ??
    shadowcat.shadowcatBoost(s, p) ??
    gamora.gamoraBoost(s, p) ??
    drax.draxBoost(s, p) ??
    venom.venomBoost(s, p) ??
    nebula.nebulaBoost(s, p) ??
    warMachine.warMachineBoost(s, p) ??
    valkyrie.valkyrieBoost(s, p) ??
    vision.visionBoost(s, p) ??
    miles.milesBoost(s, p) ??
    ghostSpider.ghostSpiderBoost(s, p) ??
    nova.novaBoost(s, p) ??
    spiderHam.spiderHamBoost(s, p) ??
    ironheart.ironheartBoost(s, p) ??
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
  colossusActivationHandled = false,
  colossusActivationReceipt?: colossus.ColossusActivationReceipt,
) {
  if (
    !phoenix.phoenixCanActivate(s, id) ||
    allInPlay(s).some(
      (p) => p.code === "44054" && p.attachedTo === id && !isTextBlank(s, p),
    )
  )
    return;
  if (colossusActivationReceipt)
    delete seatView(s, colossusActivationReceipt.playerId).flags[
      `colossusActivation:${colossusActivationReceipt.token}`
    ];
  const p = find(s, id);
  if (!p) return;
  if (
    ghostNativeActivationWindow(
      s,
      id,
      "scheme",
      E("ghostNativeEnemyScheme", {
        id,
        extra,
        request,
        colossusActivationHandled,
      }),
    )
  )
    return;
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
  if (
    !colossusActivationHandled &&
    colossusNativeActivationWindow(
      s,
      id,
      "scheme",
      E("ghostNativeEnemyScheme", { id, extra, request }),
    )
  )
    return;
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
  const moldReceipt: masterMold.MasterMoldSchemeReceipt = {
    token: `scheme${s.nextId++}`,
    enemyId: id,
    enemyCode: p.code,
    playerId: s.activePlayerId,
    performed: true,
  };
  const omitNewBoost =
    request?.omitNormalBoost ||
    masterMold.masterMoldSuppressesBoost(s, moldReceipt, { isTextBlank });
  const pendingBoosts: Piece[] = [];
  if (id === s.villain.id)
    pendingBoosts.push(...(s.encounter.storedBoosts || []).splice(0));
  pendingBoosts.push(...(p.inheritorBoosts || []).splice(0));
  const normal = omitNewBoost
    ? 0
    : id === s.villain.id || keyword(p, "Villainous", s)
      ? 1
      : 0;
  const n = omitNewBoost ? 0 : normal + mutagenAdditionalBoosts(s, id);
  for (let i = 0; i < n; i++) {
    const boost = drawEncounter(s);
    if (boost) pendingBoosts.push(boost);
  }
  s.scheming = {
    id: moldReceipt.token,
    attacker: id,
    boostCodes: [],
    boostIds: [],
    pendingBoosts,
    extra,
    modifier:
      (request?.modifier || 0) + psylocke.psylockeActivationBonus(s, id),
    activationAfter: request?.after,
  };
  add(
    s,
    E("phoenixSchemeInterrupt", { id, activationId: moldReceipt.token }),
    ...masterMold.masterMoldBeforeScheme(s, moldReceipt, { isTextBlank }),
    E(pendingBoosts.length ? "revealSchemeBoost" : "finishScheme"),
  );
}
function enemySCH(s: GameState, p: Piece, playerId: string): number {
  if (enemyDashPower(p, "scheme")) return 0;
  if (riskyBlankPower(s, "scheme", p.id)) return 0;
  return (
    (mystique.mystiqueStats(s, p, mystiquePorts)?.scheme ??
      vision.visionDroneStats(s, p)?.scheme ??
      card(p).scheme ??
      0) +
    blackWidowEnemyModifier(s, p, playerId) +
    ironheart.ironheartEnemyStats(s, p, { isTextBlank }).scheme +
    enemyAttachmentModifier(s, p.id, "scheme")
  );
}
export function enemyStats(
  s: GameState,
  p: Piece,
  playerId = p.engagedWith || s.activePlayerId,
) {
  let attack = enemyATK(s, p, playerId);
  if (p.id === s.villain.id && rulesCode(p) === "01135") {
    const liveUltron = (a: GameState["attack"]) =>
      a?.attacker === p.id &&
      (!a.attackerSnapshot || rulesCode(a.attackerSnapshot) === "01135")
        ? a
        : undefined;
    const seen = new Set<Effect>();
    const savedUltron = (e?: Effect): GameState["attack"] | undefined => {
      if (!e || e.type !== "mystique-native:activation-finish" || seen.has(e))
        return undefined;
      seen.add(e);
      return (
        liveUltron(e.outerAttack) ||
        savedUltron(e.outerAttack?.activationAfter) ||
        savedUltron(e.outerScheme?.activationAfter)
      );
    };
    const current =
      liveUltron(s.attack) ||
      savedUltron(s.attack?.activationAfter) ||
      savedUltron(s.scheming?.activationAfter) ||
      s.queue.map(savedUltron).find((a) => !!a);
    const drones = (id: string) =>
      engaged(s, id).filter((m) => card(m).traits?.includes("Drone.")).length;
    // The private attack calculator includes Ultron II's prospective interrupt
    // bonus. Current statistics include that grant only during his real attack,
    // including an outer attack suspended by a native Mystique activation.
    attack -= drones(playerId);
    if (current)
      attack += drones(
        current.originalPlayerId || current.targetPlayerId || playerId,
      );
  }
  return {
    attack: Math.max(0, attack),
    scheme: Math.max(0, enemySCH(s, p, playerId)),
  };
}
function finishScheme(s: GameState) {
  const activation = s.scheming;
  if (!activation) return;
  const { attacker: id, extra } = activation;
  const p = find(s, id);
  if (!p) return;
  const amount = enemyDashPower(p, "scheme")
    ? 0
    : (riskyBlankPower(s, "scheme", p.id)
        ? 0
        : enemySCH(s, p, s.activePlayerId) +
          (activation.modifier || 0) +
          (activation.extraBoostIcons || 0)) +
      activation.boostCodes.reduce(
        (n, code, index) =>
          n + activationBoostValue(s, activation.boostIds[index], code),
        0,
      );
  log(s, `${card(p).name} schemes for ${amount} threat.`, "bad");
  activation.threatBefore = s.stats?.threatPlaced || 0;
  const after = [
    E(s.flags[`phoenixManipulation:${activation.id}`] ? "thwart" : "threat", {
      target:
        p.code === "44033" &&
        !isTextBlank(s, p) &&
        s.sideSchemes.some((q) => q.code === "44034")
          ? s.sideSchemes.find((q) => q.code === "44034")!.id
          : phoenix.phoenixSchemeTarget(s, p),
      amount:
        amount +
        Number(s.flags[`phoenixManipulationBonus:${activation.id}`] || 0),
      additional: !!s.flags[`phoenixManipulation:${activation.id}`],
      ignoreCrisis: true,
    }),
    ...(extra === "rage" ? [E("mill", { amount })] : []),
    ...(id === s.villain.id && villainAt(s, "01141").length
      ? s.sideSchemes.map((p) => E("threat", { target: p.id, amount: 1 }))
      : []),
    ...(rulesCode(p) === "01181"
      ? s.sideSchemes
          .filter((p) => rulesCode(p) === "01180")
          .map((p) => E("threat", { target: p.id, amount: 2 }))
      : []),
    ...sabretooth.sabretoothAfterActivation(s, {
      token: (activation.id ||= `scheme${s.nextId++}`),
      enemyId: id,
      enemyCode: p.code,
      playerId: s.activePlayerId,
      kind: "scheme",
      performed: true,
    }),
    ...(p.code === "44036" && !isTextBlank(s, p)
      ? [E("heal", { target: p.id, amount: p.damage })]
      : []),
    ...antMan.antManEnemyActivated(s, id),
    ...armadillo.armadilloActivationResponses(s, id).flatMap((r) => r.effects),
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
  const attacker = nebulaNativeAttacker(s, a.attacker);
  if (attacker)
    a.base = enemyDashPower(attacker, "attack")
      ? 0
      : nebulaNativeAttackStrength(
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
    a.defender =
      a.mutantProtectorsDefender?.allyId === a.defender ? "hero" : "none";
    if (a.defender === "hero")
      a.targetPlayerId = a.mutantProtectorsDefender!.playerId;
    a.basicDefense = false;
    a.defense = 0;
    log(
      s,
      `The ally defender left play. ${heroCard(s).name} is now the attack target.`,
      "bad",
    );
  }
  if (a.basicDefense || a.valkyrieDefense)
    a.defense =
      heroStats(s).defense +
      valkyrie.valkyrieDefenseBonusForAttacker(s, a.attacker) +
      (a.defenseBonus || 0);
  if (
    a.defender === "hero" &&
    a.valkyriePackAttackDefensePlayerId === s.activePlayerId
  )
    a.defense = heroStats(s).attack;
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
function enemyAttackDamageTarget(
  s: GameState,
  a: NonNullable<GameState["attack"]>,
) {
  const target =
    a.defender && a.defender !== "none"
      ? a.defender
      : a.originalTarget || "hero";
  return (
    sabretooth.sabretoothUndefendedTarget(s, {
      playerId: a.targetPlayerId || s.activePlayerId,
      undefended: !a.defender || a.defender === "none",
      target,
    }) || target
  );
}
type SabretoothAttackDefeatPiece = Piece & {
  sabretoothAttackDefeatReceipt?: {
    attackId: string;
    attackerId: string;
    playerId: string;
    sourceIds: string[];
  };
};
function finishAttack(s: GameState, effect: Effect = E("finishAttack")) {
  if (
    s.attack &&
    Object.keys(s.flags).some((k) => k.startsWith("deadpoolFront:"))
  ) {
    s.flags.deadpoolOtherDefended =
      !!s.attack.defender &&
      s.attack.defender !== "none" &&
      (s.attack.defender !== "hero" ||
        s.attack.targetPlayerId !== s.attack.originalPlayerId);
  }
  const a = s.attack!;
  if (!a) return;
  const p = nebulaNativeAttacker(s, a.attacker);
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
  const target = enemyAttackDamageTarget(s, a);
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
  if (p && damage > 0 && angel.angelIndirectAttack(s, p)) {
    add(
      s,
      E("indirect", {
        amount: damage,
        source: a.attacker,
        sourceTitle: "Hook, Line, and Sinker",
        zzzaxBatchId: `angel-attack:${s.nextId++}`,
        zzzaxBatchOwner: s.activePlayerId,
        attackDamage: true,
        exhaustDamaged: true,
        zzzaxAfter: E("ironspiderAttackComplete", {
          attack: structuredClone(a),
          target,
          before,
          recipientId: s.activePlayerId,
        }),
      }),
    );
    return;
  }
  if (target === "hero") {
    const forced = spdrPack.spdrPackForcedDamage(
      s,
      { ...effect, target, amount: damage, kind: "attack" },
      spdrPackPorts,
    );
    if (forced) {
      add(s, ...forced);
      return;
    }
  }
  if (
    s.flags[`rogueBelle:${a.id}`] &&
    a.base > a.defense &&
    (a.piercing || sourceKeyword(s, a.attacker, "Piercing"))
  )
    colossusNativeDiscardTough(s, [{ targetId: target, amount: 1 }], [], true);
  const phoenixShield = phoenix.phoenixForcedDamage(
    s,
    { ...effect, target, amount: damage, kind: "attack" },
    phoenixPorts,
  );
  if (phoenixShield) {
    add(s, ...phoenixShield);
    return;
  }
  const receiving = target === "hero" ? s.player : find(s, target);
  const prohibited = damageProhibition(s, target, false);
  mutantGenesisIncomingPiercing(s, target, prohibited ? 0 : damage);
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
  a.primaryTargetControllerId =
    target === "hero" ? recipientId : controller(s, target)?.id;
  a.primaryTargetOwnerId =
    target === "hero"
      ? recipientId
      : (receiving as Piece | undefined)?.ownerId ||
        a.primaryTargetControllerId;
  if (
    receiving &&
    "code" in receiving &&
    card(receiving).type_code === "ally" &&
    a.sabretoothAllyDefeatBoostIds?.length &&
    damage > 0
  )
    (receiving as SabretoothAttackDefeatPiece).sabretoothAttackDefeatReceipt = {
      attackId: a.id!,
      attackerId: a.attacker,
      playerId: recipientId,
      sourceIds: [...a.sabretoothAllyDefeatBoostIds],
    };
  const beforeDamageQueue = new Set(s.queue);
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
  if (receiving && "code" in receiving && !receiving.pendingDefeat)
    delete (receiving as SabretoothAttackDefeatPiece)
      .sabretoothAttackDefeatReceipt;
  if (
    (a.overkill || !!sourceKeyword(s, a.attacker, "Overkill")) &&
    !!a.defender &&
    a.defender !== "none" &&
    target !== "hero" &&
    damage > before &&
    !wasTough
  )
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
  const generated = s.queue.filter((q) => !beforeDamageQueue.has(q));
  if (
    generated.some(
      (q) => q.type === "optional" && q.title === "Spider-Nonsense",
    )
  ) {
    s.queue = s.queue.filter((q) => beforeDamageQueue.has(q));
    add(
      s,
      ...generated,
      E("spiderHamAttackDamageComplete", { target, before, recipientId }),
    );
    return;
  }
  const receipts = a.colossusToughDiscardReceipts || [];
  a.colossusToughDiscardReceipts = [];
  if (receipts.length) {
    add(
      s,
      ...receipts.flatMap((r) =>
        colossus.colossusToughDiscarded(
          seatView(s, r.playerId),
          r,
          colossusPorts,
        ),
      ),
      E("mutantGenesisAttackDamageComplete", {
        target,
        before,
        recipientId,
        snapshot: a,
      }),
    );
    return;
  }
  finishAttackAfterDamage(s, target, before, recipientId, a);
}
function mansionAttackEnemyAttackAfter(
  s: GameState,
  a: NonNullable<GameState["attack"]>,
  target: string,
  recipientId: string,
): Effect[] {
  if (s.villainId !== "mansion_attack") return [];
  // Redirected attacks against an enemy do not attack a player. Blob's
  // character-damage response still applies to the actual damaged character.
  if (
    attackTargetsEnemy(s, a) &&
    card(a.attackerSnapshot || s.villain).name !== "Blob"
  )
    return [];
  const damaged = a.attackDamageReceipts || [
    {
      target: target === "hero" ? `hero:${recipientId}` : target,
      actualDamage: a.damage,
    },
    ...(target !== "hero"
      ? [{ target: `hero:${recipientId}`, actualDamage: a.identityDamage || 0 }]
      : []),
  ];
  return mansionAttack.mansionAttackAfterEnemyAttack(
    s,
    {
      token: a.id!,
      enemyId: a.attacker,
      enemyCode: a.attackerSnapshot?.code || "",
      playerId: recipientId,
      performed: !!a.completionRecorded,
      damagedTargets: damaged.map((r) => ({
        targetId: r.target,
        actualDamage: r.actualDamage,
        playerId: r.target.startsWith("hero:")
          ? r.target.slice(5)
          : r.target === target
            ? a.primaryTargetControllerId || controller(s, r.target)?.id
            : controller(s, r.target)?.id,
      })),
    },
    { isTextBlank },
  );
}
function finishAttackAfterDamage(
  s: GameState,
  target: string,
  before: number,
  recipientId: string,
  a: GameState["attack"] = s.attack,
) {
  // Lethal damage can clear the live attack during player elimination. Its
  // already established continuation still uses the retained activation.
  if (!a) return;
  const p = nebulaNativeAttacker(s, a.attacker) || a.attackerSnapshot;

  const brotherhoodAfter = brotherhood.brotherhoodAfterAttack(s, {
    token: a.id!,
    attackerId: a.attacker,
    attackerCode: a.attackerSnapshot?.code || p?.code || "",
    playerId: recipientId,
    performed: !!a.completionRecorded,
    textBlank: !p || isTextBlank(s, p),
    targetId: target === "hero" ? `hero:${recipientId}` : target,
    damageTaken: a.damage,
    targetControllerId: a.primaryTargetControllerId,
  });
  const sabretoothAfter = sabretooth.sabretoothAfterActivation(s, {
    token: a.id!,
    enemyId: a.attacker,
    enemyCode: a.attackerSnapshot?.code || p?.code || "",
    playerId: recipientId,
    kind: "attack",
    performed: !!a.completionRecorded,
  });
  const moldAfter = masterMold.masterMoldAfterEnemyAttack(
    s,
    {
      token: a.id!,
      enemyId: a.attacker,
      enemyCode: a.attackerSnapshot?.code || p?.code || "",
      performed: !!a.completionRecorded,
      damagedTargets: a.attackDamageReceipts
        ? a.attackDamageReceipts.map((r) => ({
            targetId: r.target,
            actualDamage: r.actualDamage,
          }))
        : [
            {
              targetId: target === "hero" ? `hero:${recipientId}` : target,
              actualDamage: a.damage,
            },
            ...(target !== "hero"
              ? [
                  {
                    targetId: `hero:${recipientId}`,
                    actualDamage: a.identityDamage || 0,
                  },
                ]
              : []),
          ],
    },
    { isTextBlank },
  );
  const mansionAfter = mansionAttackEnemyAttackAfter(s, a, target, recipientId);
  const magneticAfter = magneto.magnetoAfterEnemyAttack(
    s,
    {
      token: a.id!,
      enemyId: a.attacker,
      enemyCode: a.attackerSnapshot?.code || p?.code || "",
      playerId: recipientId,
      performed: !!a.completionRecorded,
    },
    { isTextBlank },
  );
  const zeroReceipt: zeroTolerance.ZeroToleranceAttackReceipt = {
    token: a.id!,
    attackerId: a.attacker,
    attackerCode: a.attackerSnapshot?.code || p?.code || "",
    playerId: recipientId,
    performed: !!a.completionRecorded,
    enemyAttack:
      !a.activationAfter?.nebulaGamoraSource ||
      a.activationAfter.nebulaGamoraSource.kind === "enemy",
    defeatedAllies: [],
    barrierSources: zeroTolerance.zeroToleranceBarrierSources(
      s,
      a.attacker,
      zeroTolerancePorts,
    ),
    schemeSources: zeroTolerance.zeroToleranceSchemeSources(
      s,
      zeroTolerancePorts,
    ),
  };

  if (s.phase === "lost" || s.phase === "won") return;
  const retaliation =
    !sourceKeyword(s, a.attacker, "Ranged") &&
    ((target === "hero" && s.player.hp > 0) ||
      (target !== "hero" && !!find(s, target)))
      ? target === "hero"
        ? s.player.form === "hero"
          ? sourceKeyword(s, "hero", "Retaliate")
          : storm.stormGlobal(s).retaliate
        : sourceKeyword(s, target, "Retaliate")
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
  if (p && rulesCode(p) === "01131" && !isTextBlank(s, p))
    giveCharacterStatus(s, p, "tough");
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
    ...gambit.gambitEnemyAfter(
      s,
      p?.code || a.attackerSnapshot?.code || "",
      target,
      !p || isTextBlank(s, p),
    ),
    ...wolverine.wolverineAfterEnemyAttack(s, {
      enemyCode: p?.code || a.attackerSnapshot?.code || "",
      target,
      damage: a.damage,
      identityDamage: target === "hero" ? a.damage : a.identityDamage || 0,
      playerId: recipientId,
      targetControllerId: a.primaryTargetControllerId,
      targetOwnerId: a.primaryTargetOwnerId,
      enemyTextBlank: !p || isTextBlank(s, p),
    }),
    ...antMan.antManEnemyActivated(s, a.attacker),
    ...(a.afterActivation || []),
    ...(a.visionAfterAttack || []),
    ...(a.attackDamageReceipts
      ? a.attackDamageReceipts
          .filter((receipt) => receipt.actualDamage > 0)
          .map((snapshot) =>
            E("dvAttackDamageResponse", {
              snapshot: { ...snapshot, attack: true },
            }),
          )
      : a.damage > 0
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
    ...(!a.attackDamageReceipts && target !== "hero" && a.identityDamage
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
    E(
      zeroToleranceNativePresent(s) ||
        zeroReceipt.barrierSources!.length ||
        zeroReceipt.schemeSources!.length
        ? "wideawake-native:attack-forced"
        : "forcedResponses",
      {
        receipt: zeroReceipt,
        responses: [
          ...(find(s, a.attacker)?.code === "44036" &&
          !isTextBlank(s, find(s, a.attacker)!)
            ? [
                {
                  id: `${a.id}:mutated`,
                  title: "Mutated Soldier",
                  effects: [
                    E("heal", {
                      target: a.attacker,
                      amount: find(s, a.attacker)!.damage,
                    }),
                  ],
                },
              ]
            : []),
          ...angel
            .angelAfterEnemyAttack(s, a.attacker)
            .map((effect, index) => ({
              id: `${a.id}:angel-after:${index}`,
              title: "Harpoon’s Harpoon",
              effects: [effect],
            })),
          ...magneticAfter.map((effect, index) => ({
            id: `${a.id}:magneto-after:${index}`,
            title: "Magneto",
            effects: [effect],
          })),
          ...mansionAfter.map((effect, index) => ({
            id: `${a.id}:mansion-after:${index}`,
            sourceId: a.attacker,
            title: card(a.attackerSnapshot || p!).name,
            effects: [effect],
          })),
          ...moldAfter.map((effect, index) => ({
            id: `${a.id}:stun-beam:${index}`,
            title: "Stun Beam",
            effects: [effect],
          })),
          ...(brotherhoodAfter.length
            ? [
                {
                  id: `${a.id}:brotherhood-after`,
                  sourceId: a.attacker,
                  title: card(a.attackerSnapshot || p!).name,
                  effects: brotherhoodAfter,
                },
              ]
            : []),
          ...(sabretoothAfter.length
            ? [
                {
                  id: `${a.id}:sabretooth-after`,
                  sourceId: a.attacker,
                  title: "Sabretooth · Regeneration",
                  effects: sabretoothAfter,
                },
              ]
            : []),
          ...(p &&
          spectrum.spectrumEnemyActivated(s, p, recipientId, spectrumPorts)
            .length
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
          ...(p &&
          nebula.nebulaGamoraAttackEnded(
            s,
            p,
            recipientId,
            a.identityDamage || 0,
            nebulaPorts,
          ).length
            ? [
                {
                  id: `${p.id}:nebula-gamora`,
                  sourceId: p.id,
                  title: "Gamora",
                  effects: nebula.nebulaGamoraAttackEnded(
                    s,
                    p,
                    recipientId,
                    a.identityDamage || 0,
                    nebulaPorts,
                  ),
                },
              ]
            : []),
          ...ironspider.ironspiderSinisterActivationResponses(s, a.attacker),
          ...armadillo.armadilloActivationResponses(s, a.attacker),
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
                      mansionRetaliate: mansionAttack.mansionAttackModifiers(
                        s,
                        target === "hero" ? "hero" : find(s, target)!,
                        { isTextBlank },
                      ).retaliate,
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
      },
    ),
    ...rogue.rogueAfterEnemyAttack(s, a.attacker),
    ...a.boostEffects,
    ...(a.boostIds || []).map((id) => E("finishResolution", { id })),
    E("scarletEnemyActivated", {
      id: a.attacker,
      actorId: a.originalPlayerId || recipientId,
    }),
    ...(a.activationAfter?.type === "ghost-spider:cold-blood-after"
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
    E("defenseResponses", {
      defended: target === "hero" && a.defender !== "none",
      attacker: a.attacker,
      snapshot: {
        attackId: a.id,
        enemyCode: a.attackerSnapshot?.code || p?.code,
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
    ...(a.activationAfter &&
    a.activationAfter.type !== "ghost-spider:cold-blood-after"
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
  if (s.flags[`spiderHamCanceledReveal:${p.id}`]) {
    delete s.flags[`spiderHamCanceledReveal:${p.id}`];
    return;
  }
  if (!repeat && !skip && p.code === "36034")
    for (const callisto of s.minions.filter(
      (m) => m.code === "36031" && !isTextBlank(s, m),
    ))
      giveCharacterStatus(s, callisto, "tough");
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
  if (!repeat && !skip)
    add(
      s,
      E("sinisterNativeRevealed", {
        receipt: {
          token: `reveal:${s.nextId++}`,
          playerId: s.activePlayerId,
          pieceId: p.id,
          code: p.code,
        },
      }),
    );
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
    const opts: Option[] = psylocke.psylockeRevealOptions(
      s,
      p,
      fromEncounterDeck,
      [E("reveal", { piece: p, skip: true, fromEncounterDeck, knifeSurge })],
      psylockePorts,
    );
    opts.push(...domino.dominoRevealOptions(s, p));
    for (const seat of playerOrder(s))
      opts.push(
        ...deadpool
          .deadpoolRevealOptions(
            seatView(s, seat),
            p,
            fromEncounterDeck,
            deadpoolPorts,
          )
          .map((o) => ({
            ...o,
            id: `${seat.id}:${o.id}`,
            effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
          })),
      );
    opts.push(...angel.angelRevealOptions(s, p, angelPorts));
    for (const seat of playerOrder(s))
      opts.push(
        ...x23
          .x23RevealOptions(
            seatView(s, seat),
            p,
            fromEncounterDeck,
            [
              E("reveal", {
                piece: p,
                skip: true,
                actorId: s.activePlayerId,
                fromEncounterDeck,
                knifeSurge,
              }),
            ],
            x23Ports,
          )
          .map((o) => ({
            ...o,
            id: `${seat.id}:${o.id}`,
            effects: o.effects.map((q) => ({ ...q, actorId: seat.id })),
          })),
      );
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
        ...spiderHam
          .spiderHamRevealOptions(
            view,
            {
              token: `reveal:${p.id}`,
              pieceId: p.id,
              code: p.code,
              playerId: revealing,
              fromEncounterDeck,
            },
            [
              E("reveal", {
                piece: p,
                skip: true,
                actorId: revealing,
                fromEncounterDeck,
                knifeSurge,
              }),
            ],
            spiderHamPorts,
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
        ...ghostSpider
          .ghostSpiderRevealOptions(
            view,
            {
              token: `reveal:${p.id}`,
              pieceId: p.id,
              code: p.code,
              playerId: revealing,
              fromEncounterDeck,
            },
            [
              E("reveal", {
                piece: p,
                skip: true,
                actorId: revealing,
                fromEncounterDeck,
                knifeSurge,
              }),
            ],
            ghostSpiderPorts,
          )
          .map((o) => ({
            ...o,
            id: `${seat.id}:${o.id}`,
            effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
          })),
      );
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
          const interrupt = eventPlaySources(view).find(
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
  const moduleSurge = ironspider.ironspiderSinisterCriminalSurge(
    s,
    p,
    ironspiderPorts,
  );
  const revealCard =
    knifeSurge || moduleSurge ? { ...c, text: `Surge.\n${c.text || ""}` } : c;
  if (!repeat && s.flags[`ghostCancelReveal:${p.id}`]) {
    delete s.flags[`ghostCancelReveal:${p.id}`];
    if (c.type_code === "minion") {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      p.engagedWith = s.activePlayerId;
      s.minions.push(p);
      minionWillEnter(s, p);
      minionEntered(s, p);
    } else if (c.type_code === "side_scheme") {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      p.counters =
        magneto.magnetoSideSchemeBaseThreat(s, p) ??
        mansionAttack.mansionAttackSideSchemeBaseThreat(s, p) ??
        (c.base_threat || 0) * (c.base_threat_fixed ? 1 : s.playerCount);
      s.sideSchemes.push(p);
      if (p.code === "32079") (s.brotherhoodEntered ||= {})[p.id] = true;
    } else if (c.type_code === "attachment") {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      s.attachments.push(p);
    }
    const effects = beginRevealWindow(
      s,
      p,
      revealCard,
      s.activePlayerId,
      1 + goblinWhenRevealedCopies(s),
    );
    s.revealWindows![p.id].pending = s.revealWindows![p.id].pending.filter(
      (id) => id !== "text",
    );
    add(s, ...effects);
    return;
  }
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
  // Ordinary attachment instructions are not a printed
  // When Revealed ability. Keep this same source resolving until it attaches.
  if (
    !repeat &&
    [
      "32067",
      "32068",
      "32077",
      "32094",
      "32095",
      "32096",
      "32103",
      "32107",
      "32115",
      "32116",
      "32145b",
      "32147",
      "32148",
      "32149",
      "32150",
    ].includes(p.code)
  ) {
    add(
      s,
      ...((magneto.magnetoReveal(s, p, { isTextBlank }) ??
        masterMold.masterMoldReveal(s, p, { isTextBlank }) ??
        wideawake.projectWideawakeReveal(s, p, { isTextBlank }) ??
        zeroTolerance.zeroToleranceReveal(s, p, zeroTolerancePorts) ??
        sentinels.sentinelsReveal(s, p, sentinelsPorts) ??
        sabretooth.sabretoothReveal(s, p) ??
        brotherhood.brotherhoodReveal(s, p, { isTextBlank })) ||
        []),
      E("finishResolution", { id: p.id }),
    );
    return;
  }
  if (
    !repeat &&
    ((rogue.REAVERS_SCRIPT_CODES.includes(p.code) &&
      c.type_code !== "attachment") ||
      ["38025", "38026"].includes(p.code) ||
      magneto.MAGNETO_SCRIPT_CODES.some((code) => code === p.code) ||
      acolytes.ACOLYTES_SCRIPT_CODES.some((code) => code === p.code) ||
      mansionAttack.MANSION_ATTACK_SCRIPT_CODES.some(
        (code) => code === p.code,
      ) ||
      masterMold.MASTER_MOLD_SCRIPT_CODES.some((code) => code === p.code) ||
      wideawake.PROJECT_WIDEAWAKE_SCRIPT_CODES.some(
        (code) => code === p.code,
      ) ||
      zeroTolerance.ZERO_TOLERANCE_SCRIPT_CODES.some(
        (code) => code === p.code,
      ) ||
      sentinels.SENTINELS_SCRIPT_CODES.some((code) => code === p.code) ||
      sabretooth.SABRETOOTH_SCRIPT_CODES.some((code) => code === p.code) ||
      brotherhood.BROTHERHOOD_SCRIPT_CODES.some((code) => code === p.code) ||
      mystique.MYSTIQUE_SCRIPT_CODES.some((code) => code === p.code) ||
      ironspider.IRONSPIDER_SINISTER_SCRIPT_CODES.some(
        (code) => code === p.code,
      ) ||
      moduleSurge)
  ) {
    if (c.type_code === "minion") {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      s.minions.push(p);
      minionEntered(s, p);
    } else if (c.type_code === "side_scheme") {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      p.counters =
        magneto.magnetoSideSchemeBaseThreat(s, p) ??
        mansionAttack.mansionAttackSideSchemeBaseThreat(s, p) ??
        (c.base_threat || 0) * (c.base_threat_fixed ? 1 : s.playerCount);
      s.sideSchemes.push(p);
      if (p.code === "32079") (s.brotherhoodEntered ||= {})[p.id] = true;
    } else if (c.type_code === "environment") visionPorts.putEnvironment(s, p);
    if (c.type_code === "obligation" && p.code === "32099") {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      if (!s.player.inPlay.some((x) => x.id === p.id)) s.player.inPlay.push(p);
    }
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
      ...armadillo.ARMADILLO_SCRIPT_CODES,
      ...zzzax.ZZZAX_SCRIPT_CODES,
      ...inheritors.INHERITORS_SCRIPT_CODES,
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
      ...nebula.NEBULA_SCRIPT_CODES,
      ...spectrum.SPECTRUM_SCRIPT_CODES,
      ...warlock.WARLOCK_SCRIPT_CODES,
      ...warMachine.WAR_MACHINE_SCRIPT_CODES,
      ...valkyrie.VALKYRIE_SCRIPT_CODES,
      ...vision.VISION_SCRIPT_CODES,
      ...rogue.ROGUE_SCRIPT_CODES,
      ...phoenix.PHOENIX_SCRIPT_CODES,
      ...spdr.SPDR_SCRIPT_CODES,
      ...spiderHam.SPIDER_HAM_SCRIPT_CODES,
      ...gambit.GAMBIT_SCRIPT_CODES,
      ...cyclops.CYCLOPS_SCRIPT_CODES,
      ...psylocke.PSYLOCKE_SCRIPT_CODES,
      ...wolverine.WOLVERINE_SCRIPT_CODES,
      ...storm.STORM_SCRIPT_CODES,
      ...deadpool.DEADPOOL_SCRIPT_CODES,
      ...angel.ANGEL_SCRIPT_CODES,
      ...cable.CABLE_SCRIPT_CODES,
      ...x23.X23_SCRIPT_CODES,
      ...colossus.COLOSSUS_SCRIPT_CODES,
    ].some((code) => code === p.code) ||
      CARDS.some(
        (core) => core.code === rulesCode(p) && core.type_code === "treachery",
      ))
  ) {
    if (c.type_code === "attachment" && ["25031", "25032"].includes(p.code)) {
      s.resolving = s.resolving.filter((x) => x.id !== p.id);
      if (!s.attachments.some((x) => x.id === p.id)) s.attachments.push(p);
    }
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
    [
      ...GOBLIN_MODULE_SCRIPT_CODES,
      ...MUTAGEN_FORMULA_SCRIPT_CODES,
      ...armadillo.ARMADILLO_SCRIPT_CODES,
      ...zzzax.ZZZAX_SCRIPT_CODES,
      ...inheritors.INHERITORS_SCRIPT_CODES,
      "30027",
      "33030",
      "32028",
      "35030",
      "35036",
      "41028",
      "38035",
      "36033",
      "37034",
      "42027",
      "40069",
      "40034",
    ].some((code) => code === p.code)
  ) {
    const window = beginRevealWindow(
      s,
      p,
      c,
      s.activePlayerId,
      1 + goblinWhenRevealedCopies(s),
    );
    const entry =
      goblinModuleReveal(s, p) ??
      mutagenEncounterReveal(s, p) ??
      armadillo.armadilloReveal(s, p) ??
      zzzax.zzzaxReveal(s, p) ??
      domino.dominoEncounter(s, p) ??
      gambit.gambitEncounter(s, p) ??
      cyclops.cyclopsEncounterReveal(s, p) ??
      psylocke.psylockeEncounterReveal(s, p) ??
      wolverine.wolverineEncounterReveal(s, p) ??
      cable.cableEncounter(s, p) ??
      x23.x23Encounter(s, p) ??
      deadpool.deadpoolEncounter(s, p) ??
      angel.angelEncounter(s, p) ??
      rogue.rogueEncounterReveal(s, p) ??
      storm.stormEncounterReveal(s, p) ??
      colossus.colossusEncounterReveal(s, p) ??
      spiderHam.spiderHamEncounterReveal(s, p);
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
  const milesReveal = miles.milesEncounterReveal(s, p);
  if (milesReveal !== null && c.type_code === "attachment") {
    add(s, ...milesReveal);
    return;
  }
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
    domino.dominoEncounter(s, p) ??
    psylocke.psylockeEncounterReveal(s, p) ??
    cable.cableEncounter(s, p) ??
    x23.x23Encounter(s, p) ??
    deadpool.deadpoolEncounter(s, p) ??
    angel.angelEncounter(s, p) ??
    rogue.rogueEncounterReveal(s, p) ??
    storm.stormEncounterReveal(s, p) ??
    magneto.magnetoReveal(s, p, { isTextBlank }) ??
    acolytes.acolytesReveal(s, p) ??
    mansionAttack.mansionAttackReveal(s, p, { isTextBlank }) ??
    masterMold.masterMoldReveal(s, p, { isTextBlank }) ??
    wideawake.projectWideawakeReveal(s, p, { isTextBlank }) ??
    zeroTolerance.zeroToleranceReveal(s, p, zeroTolerancePorts) ??
    sentinels.sentinelsReveal(s, p, sentinelsPorts) ??
    sabretooth.sabretoothReveal(s, p) ??
    brotherhood.brotherhoodReveal(s, p, { isTextBlank }) ??
    mystique.mystiqueReveal(s, p) ??
    armadillo.armadilloReveal(s, p) ??
    zzzax.zzzaxReveal(s, p) ??
    inheritors.inheritorsReveal(s, p) ??
    starLord.starLordEncounterReveal(s, p) ??
    gamora.gamoraEncounterReveal(s, p) ??
    drax.draxEncounterReveal(s, p) ??
    venom.venomEncounterReveal(s, p) ??
    nebula.nebulaEncounterReveal(s, p) ??
    spectrum.spectrumEncounterReveal(s, p) ??
    warMachine.warMachineEncounterReveal(s, p) ??
    valkyrie.valkyrieEncounterReveal(s, p) ??
    vision.visionEncounterReveal(s, p) ??
    wolverine.wolverineEncounterReveal(s, p) ??
    shadowcat.shadowcatEncounterReveal(s, p) ??
    miles.milesEncounterReveal(s, p) ??
    ghostSpider.ghostSpiderEncounterReveal(s, p) ??
    nova.novaEncounterReveal(s, p) ??
    gambit.gambitEncounter(s, p) ??
    cyclops.cyclopsEncounterReveal(s, p) ??
    colossus.colossusEncounterReveal(s, p) ??
    phoenix.phoenixEncounterReveal(s, p) ??
    spdr.spdrEncounterReveal(s, p) ??
    spiderHam.spiderHamEncounterReveal(s, p) ??
    ironheart.ironheartEncounterReveal(s, p) ??
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
    c.type_code === "environment" &&
    (vision.visionEncounterReveal(s, p) !== null || p.code === "29039")
  ) {
    if (!repeat) visionPorts.putEnvironment(s, p);
    add(s, ...(rise || []));
    return;
  }
  if (
    rise !== null &&
    ["obligation", "treachery", "attachment"].includes(c.type_code)
  ) {
    if (
      c.type_code === "attachment" &&
      !repeat &&
      !["30027", "32077"].includes(p.code)
    ) {
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
      const active = !isTextBlank(s, p);
      (p as ImmortalKlawScheme).immortalKlawHealthActive = active;
      if (active) {
        s.villain.maxHp += 10;
        s.villain.hp += 10;
      }
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
  if (p.code === "40031") {
    add(s, ...cable.cableEncounter(s, p)!);
    return;
  }
  if (p.code === "44032") {
    add(s, ...deadpool.deadpoolEncounter(s, p)!);
    return;
  }
  if (p.code === "42024") {
    add(s, ...angel.angelEncounter(s, p)!);
    return;
  }
  if (p.code === "33027") {
    add(s, ...(cyclops.cyclopsEncounterReveal(s, p) || []));
    return;
  }
  if (p.code === "36030") {
    add(s, ...(storm.stormEncounterReveal(s, p) || []));
    return;
  }
  const colossusObligation = colossus.colossusEncounterReveal(s, p);
  if (colossusObligation !== null && p.code === "32025") {
    add(s, ...colossusObligation);
    return;
  }
  const owner = s.players.find(
    (seat) => seat.heroId === card(p).set_code && !seat.eliminated,
  );
  if (!owner) {
    finishResolution(s, p.id);
    return;
  }
  activateSeat(s, owner.id);
  if (p.code === "41025") {
    add(s, ...psylocke.psylockeEncounterReveal(s, p)!);
    return;
  }
  if (p.code === "40065") {
    add(s, ...domino.dominoEncounter(s, p)!);
    return;
  }
  if (p.code === "37025") {
    add(s, ...gambit.gambitEncounter(s, p)!);
    return;
  }
  if (p.code === "35027") {
    add(s, ...wolverine.wolverineEncounterReveal(s, p)!);
    return;
  }
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
    (s.player.form === "alter" || canChangeIdentityForm(s, "alter"))
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
  const deadpoolReveal = deadpool.deadpoolEncounter(s, p);
  if (deadpoolReveal !== null) {
    add(s, ...deadpoolReveal);
    return;
  }
  const psy = psylocke.psylockeEncounterReveal(s, p);
  if (psy !== null) {
    add(s, ...psy);
    return;
  }
  const xreveal = x23.x23Encounter(s, p);
  if (xreveal !== null) {
    add(s, ...xreveal);
    return;
  }
  const gambitReveal = gambit.gambitEncounter(s, p);
  if (gambitReveal !== null) {
    add(s, ...gambitReveal);
    return;
  }
  const wolverineReveal = wolverine.wolverineEncounterReveal(s, p);
  if (wolverineReveal !== null) {
    add(s, ...wolverineReveal);
    return;
  }
  const stormReveal =
    cable.cableEncounter(s, p) ??
    x23.x23Encounter(s, p) ??
    deadpool.deadpoolEncounter(s, p) ??
    angel.angelEncounter(s, p) ??
    storm.stormEncounterReveal(s, p);
  if (stormReveal !== null) {
    add(s, ...stormReveal);
    return;
  }
  const shadowcatReveal = shadowcat.shadowcatEncounterReveal(s, p);
  if (shadowcatReveal !== null) {
    add(s, ...shadowcatReveal);
    return;
  }
  const cyclopsTreachery = cyclops.cyclopsEncounterReveal(s, p);
  if (cyclopsTreachery !== null) {
    add(s, ...cyclopsTreachery);
    return;
  }
  const colossusTreachery = colossus.colossusEncounterReveal(s, p);
  if (colossusTreachery !== null) {
    add(s, ...colossusTreachery);
    return;
  }
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
            !isPermanent(card(p)) &&
            valkyrie.valkyrieCanDiscardAttachment(s, p) &&
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
            !isPermanent(card(p)) &&
            valkyrie.valkyrieCanDiscardAttachment(s, p) &&
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
      const dominoNemesis = domino.dominoShadows(s);
      if (dominoNemesis !== null) {
        add(s, ...dominoNemesis);
        break;
      }
      const deadpoolNemesis = deadpool.deadpoolShadows(s);
      if (deadpoolNemesis !== null) {
        add(s, ...deadpoolNemesis);
        break;
      }
      const gambitNemesis = gambit.gambitShadows(s);
      if (gambitNemesis !== null) {
        add(s, ...gambitNemesis);
        break;
      }
      const rogueNemesis = rogue.rogueShadows(s);
      if (rogueNemesis !== null) {
        add(s, ...rogueNemesis);
        break;
      }
      const cyclopsNemesis = cyclops.cyclopsShadowOfPast(s);
      if (cyclopsNemesis !== null) {
        add(s, ...cyclopsNemesis);
        break;
      }
      const phoenixNemesis = phoenix.phoenixShadowOfPast(s);
      if (phoenixNemesis !== null) {
        add(s, ...phoenixNemesis);
        break;
      }
      const psyNemesis = psylocke.psylockeShadowOfPast(s);
      if (psyNemesis !== null) {
        add(s, ...psyNemesis);
        return;
      }
      const wolverineNemesis = wolverine.wolverineShadowOfPast(s);
      if (wolverineNemesis !== null) {
        add(s, ...wolverineNemesis);
        return;
      }
      const cableNemesis = cable.cableShadows(s);
      if (cableNemesis !== null) {
        add(s, ...cableNemesis);
        break;
      }
      const xnemesis = x23.x23Shadows(s);
      if (xnemesis !== null) {
        add(s, ...xnemesis);
        break;
      }
      const angelNemesis = angel.angelShadows(s);
      if (angelNemesis !== null) {
        add(s, ...angelNemesis);
        break;
      }
      const stormNemesis = storm.stormShadows(s);
      if (stormNemesis !== null) {
        add(s, ...stormNemesis);
        break;
      }
      const colossusNemesis = colossus.colossusShadowOfPast(s);
      if (colossusNemesis !== null) {
        add(s, ...colossusNemesis);
        break;
      }
      const spdrNemesis = spdr.spdrShadowOfPast(s);
      if (spdrNemesis !== null) {
        add(s, ...spdrNemesis);
        break;
      }
      const spiderHamNemesis = spiderHam.spiderHamShadowOfPast(s);
      if (spiderHamNemesis !== null) {
        add(s, ...spiderHamNemesis);
        break;
      }
      const novaNemesis = nova.novaShadowOfPast(s);
      if (novaNemesis !== null) {
        add(s, ...novaNemesis);
        break;
      }
      const ironheartNemesis = ironheart.ironheartShadowOfPast(s);
      if (ironheartNemesis !== null) {
        add(s, ...ironheartNemesis);
        break;
      }
      const ghostNemesis = ghostSpider.ghostSpiderShadowOfPast(s);
      if (ghostNemesis !== null) {
        add(s, ...ghostNemesis);
        break;
      }
      const visionNemesis = vision.visionShadowOfPast(s);
      const shadowcatNemesis = shadowcat.shadowcatShadowOfPast(s);
      if (shadowcatNemesis !== null) {
        add(s, ...shadowcatNemesis);
        break;
      }
      if (visionNemesis !== null) {
        add(s, ...visionNemesis);
        break;
      }
      const valkyrieNemesis = valkyrie.valkyrieShadowOfPast(s);
      if (valkyrieNemesis !== null) {
        add(s, ...valkyrieNemesis);
        break;
      }
      const warMachineNemesis = warMachine.warMachineShadowOfPast(s);
      const milesNemesis = miles.milesShadowOfPast(s);
      if (milesNemesis !== null) {
        add(s, ...milesNemesis);
        break;
      }
      if (warMachineNemesis !== null) {
        add(s, ...warMachineNemesis);
        break;
      }
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
/** Continuous Retaliate grants are read when their after-attack window opens,
 * after all simultaneous damage and defeats. Retain unrelated native grants. */
function refreshInheritorsRetaliate(
  s: GameState,
  e: Effect,
): Effect | undefined {
  if (e.inheritorRetaliate === undefined) return e;
  const recipient = find(s, e.retaliateSource);
  if (!recipient) return undefined;
  const inherited = inheritors.inheritorsModifiers(s, recipient).retaliate;
  const mansion = mansionAttack.mansionAttackModifiers(s, recipient, {
    isTextBlank,
  }).retaliate;
  const amount =
    e.amount -
    e.inheritorRetaliate +
    inherited -
    (e.mansionRetaliate || 0) +
    mansion;
  return amount > 0
    ? {
        ...e,
        amount,
        inheritorRetaliate: inherited,
        mansionRetaliate: mansion,
        title: `${card(recipient).name} · Retaliate ${amount}`,
      }
    : undefined;
}
function resolve(s: GameState, e: Effect) {
  if (
    e.mansionActivationId &&
    s.mansionAttack?.cancelledActivations?.includes(e.mansionActivationId) &&
    !e.eventId &&
    e.type !== "finishResolution" &&
    !(e.piece && card(e.piece).faction_code !== "encounter")
  )
    return;
  // Capture the canonical alias as the current original-source villain ID.
  if (["mansion_attack", "magneto"].includes(s.villainId)) {
    for (const key of ["target", "targetId", "enemyId", "attacker"])
      if (
        e[key] === "villain" ||
        (s.villainId === "magneto" &&
          s.removed.some(
            (p) =>
              p.id === e[key] && ["32138", "32139", "32140"].includes(p.code),
          ))
      )
        e[key] = s.villain.id;
  }
  if (e.type === "acolytes-native:order") {
    choose(
      s,
      "Zeal for the Cause",
      "Choose the next When Defeated ability to resolve.",
      e.options,
    );
    return;
  }
  if (resolveMagnetoNativeEffect(s, e)) return;
  if (magneto.resolveMagnetoEffect(s, e, magnetoPorts)) return;
  if (acolytes.resolveAcolytesEffect(s, e, acolytesPorts)) return;
  if (resolveMansionAttackNativeEffect(s, e)) return;
  if (mansionAttack.resolveMansionAttackEffect(s, e, mansionAttackPorts))
    return;
  if (resolveMasterMoldNativeEffect(s, e)) return;
  if (masterMold.resolveMasterMoldEffect(s, e, masterMoldPorts)) return;
  if (resolveSabretoothNativeEffect(s, e)) return;
  if (sabretooth.resolveSabretoothEffect(s, e, sabretoothPorts)) return;
  if (resolveBrotherhoodNativeEffect(s, e)) return;
  if (brotherhood.resolveBrotherhoodEffect(s, e, brotherhoodPorts)) return;
  if (resolveMystiqueNativeEffect(s, e)) return;
  if (mystique.resolveMystiqueEffect(s, e, mystiquePorts)) return;
  if (e.spdrThwartCostPaid && !s.flags.spdrGiantThwartCostPaid) {
    const previous = s.flags.spdrGiantThwartCostPaid;
    s.flags.spdrGiantThwartCostPaid = true;
    try {
      resolve(s, e);
    } finally {
      if (previous === undefined) delete s.flags.spdrGiantThwartCostPaid;
      else s.flags.spdrGiantThwartCostPaid = previous;
    }
    return;
  }
  if (e.type === "cyclops-native:advance") {
    advanceVillain(s, e.source, e.attack, e.captured);
    return;
  }
  if (domino.resolveDominoEffect(s, e, dominoPorts)) return;
  if (gambit.resolveGambitEffect(s, e, gambitPorts)) return;
  if (cyclops.resolveCyclopsEffect(s, e, cyclopsPorts)) return;
  if (psylocke.resolvePsylockeEffect(s, e, psylockePorts)) return;
  if (wolverine.resolveWolverineEffect(s, e, wolverinePorts)) return;
  if (e.type === "cableAttach") {
    const p = find(s, e.id);
    need(
      p && nativePutAttachmentTargets(s, p).some((t) => t.id === e.target),
      "This attachment target is no longer legal.",
    );
    if (e.target === s.villain.id || s.minions.some((q) => q.id === e.target))
      p!.attachedTo = e.target;
    else attachPackUpgrade(s, e.id, e.target);
    return;
  }
  if (cable.resolveCableEffect(s, e, cablePorts)) return;
  if (x23.resolveX23Effect(s, e, x23Ports)) return;
  if (deadpool.resolveDeadpoolEffect(s, e, deadpoolPorts)) return;
  if (angel.resolveAngelEffect(s, e, angelPorts)) return;
  if (storm.resolveStormEffect(s, e, stormPorts)) return;
  if (colossus.resolveColossusEffect(s, e, colossusPorts)) return;
  if (shadowcat.resolveShadowcatEffect(s, e, shadowcatPorts)) return;
  if (mgPack.resolveMutantGenesisPlayerPackEffect(s, e, mutantGenesisPackPorts))
    return;
  if (ironspider.resolveIronspiderSinisterEffect(s, e, ironspiderPorts)) return;
  if (rogue.resolveRogueEffect(s, e, roguePorts)) return;
  if (phoenix.resolvePhoenixEffect(s, e, phoenixPorts)) return;
  if (spdr.resolveSpdrEffect(s, e, spdrPorts)) return;
  if (spdrPack.resolveSpdrPackEffect(s, e, spdrPackPorts)) return;
  if (spiderHam.resolveSpiderHamEffect(s, e, spiderHamPorts)) return;
  if (spiderHamPack.resolveSpiderHamPackEffect(s, e, spiderHamPackPorts))
    return;
  if (
    sinisterPlayerPack.resolveSinisterPlayerPackEffect(
      s,
      e,
      sinisterPlayerPackPorts,
    )
  )
    return;
  if (miles.resolveMilesMoralesEffect(s, e, milesPorts)) return;
  if (ghostSpider.resolveGhostSpiderEffect(s, e, ghostSpiderPorts)) return;
  if (e.retaliateSource && !find(s, e.retaliateSource)) return;
  if (e.inheritorRetaliate !== undefined) {
    const refreshed = refreshInheritorsRetaliate(s, e);
    if (!refreshed) return;
    e = { ...refreshed, inheritorRetaliate: undefined };
  }
  if (e.type === "ms:preemptive" && !e.scarletCounted) {
    countActivationBoost(s, e.boostId, [{ ...e, scarletCounted: true }]);
    return;
  }
  if (
    e.type === "wasp:basic-resolve" &&
    !e.thorWindowHandled &&
    s.player.hand.some((p) =>
      e.power === "attack"
        ? ["06015", "06032", "33017"].includes(p.code)
        : ["06032", "33017"].includes(p.code),
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
  if (nebula.resolveNebulaEffect(s, e, nebulaPorts)) return;
  if (spectrum.resolveSpectrumEffect(s, e, spectrumPorts)) return;
  if (warlock.resolveWarlockEffect(s, e, warlockPorts)) return;
  if (warMachine.resolveWarMachineEffect(s, e, warMachinePorts)) return;
  if (valkyrie.resolveValkyrieEffect(s, e, valkyriePorts)) return;
  if (vision.resolveVisionEffect(s, e, visionPorts)) return;
  if (nova.resolveNovaEffect(s, e, novaPorts)) return;
  if (ironheart.resolveIronheartEffect(s, e, ironheartPorts)) return;
  if (niPack.resolveNovaIronheartPackEffect(s, e, niPackPorts)) return;
  if (starLordPack.resolveStarLordPackEffect(s, e, starLordPackPorts)) return;
  if (gamoraPack.resolveGamoraPackEffect(s, e, gamoraPackPorts)) return;
  if (draxPack.resolveDraxPackEffect(s, e, draxPackPorts)) return;
  if (venomPack.resolveVenomPackEffect(s, e, venomPackPorts)) return;
  if (mtsPlayerPack.resolveMtsPlayerPackEffect(s, e, mtsPlayerPackPorts))
    return;
  if (nebulaPack.resolveNebulaPackEffect(s, e, nebulaPackPorts)) return;
  if (warmPack.resolveWarMachinePackEffect(s, e, warMachinePackPorts)) return;
  if (valkPack.resolveValkyriePackEffect(s, e, valkyriePackPorts)) return;
  if (visionPack.resolveVisionPackEffect(s, e, visionPackPorts)) return;
  if (resolveHawkeyeEffect(s, e, hawkeyePorts)) return;
  if (resolveSpiderWomanEffect(s, e, swPorts)) return;
  if (resolveDoctorStrangeEffect(s, e, dsPorts)) return;
  if (resolveBlackWidowEffect(s, e, bwPorts)) return;
  const spdrCompletedWindow = s.revealWindows?.[e.windowId];
  if (
    resolveRevealWindowEffect(s, e, {
      queue: add,
      choose,
      resolveText: (state, piece, windowId) => {
        const previous = state.currentRevealWindowId;
        state.currentRevealWindowId = windowId;
        const effects =
          magneto.magnetoReveal(state, piece, { isTextBlank }) ??
          acolytes.acolytesReveal(state, piece) ??
          mansionAttack.mansionAttackReveal(state, piece, { isTextBlank }) ??
          masterMold.masterMoldReveal(state, piece, { isTextBlank }) ??
          wideawake.projectWideawakeReveal(state, piece, { isTextBlank }) ??
          zeroTolerance.zeroToleranceReveal(state, piece, zeroTolerancePorts) ??
          sentinels.sentinelsReveal(state, piece, sentinelsPorts) ??
          sabretooth.sabretoothReveal(state, piece) ??
          brotherhood.brotherhoodReveal(state, piece, { isTextBlank }) ??
          mystique.mystiqueReveal(state, piece) ??
          ironspider.ironspiderSinisterReveal(state, piece) ??
          armadillo.armadilloReveal(state, piece) ??
          zzzax.zzzaxReveal(state, piece) ??
          inheritors.inheritorsReveal(state, piece) ??
          goblinModuleReveal(state, piece) ??
          riskyEncounterReveal(state, piece) ??
          mutagenEncounterReveal(state, piece) ??
          blackWidowEncounterReveal(state, piece) ??
          doctorStrangeEncounterReveal(state, piece) ??
          starLord.starLordEncounterReveal(state, piece) ??
          gamora.gamoraEncounterReveal(state, piece) ??
          drax.draxEncounterReveal(state, piece) ??
          venom.venomEncounterReveal(state, piece) ??
          nebula.nebulaEncounterReveal(state, piece) ??
          spectrum.spectrumEncounterReveal(state, piece) ??
          warMachine.warMachineEncounterReveal(state, piece) ??
          valkyrie.valkyrieEncounterReveal(state, piece) ??
          vision.visionEncounterReveal(state, piece) ??
          psylocke.psylockeEncounterReveal(state, piece) ??
          wolverine.wolverineEncounterReveal(state, piece) ??
          shadowcat.shadowcatEncounterReveal(state, piece) ??
          miles.milesEncounterReveal(state, piece) ??
          ghostSpider.ghostSpiderEncounterReveal(state, piece) ??
          nova.novaEncounterReveal(state, piece) ??
          gambit.gambitEncounter(state, piece) ??
          cyclops.cyclopsEncounterReveal(state, piece) ??
          cable.cableEncounter(state, piece) ??
          x23.x23Encounter(state, piece) ??
          deadpool.deadpoolEncounter(state, piece) ??
          angel.angelEncounter(state, piece) ??
          storm.stormEncounterReveal(state, piece) ??
          colossus.colossusEncounterReveal(state, piece) ??
          rogue.rogueEncounterReveal(state, piece) ??
          phoenix.phoenixEncounterReveal(state, piece) ??
          spdr.spdrEncounterReveal(state, piece) ??
          spiderHam.spiderHamEncounterReveal(state, piece) ??
          ironheart.ironheartEncounterReveal(state, piece) ??
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
        add(
          state,
          ...(card(piece).type_code === "treachery" && spdrCompletedWindow
            ? [
                E("spdrTreacheryResolved", {
                  receipt: {
                    token: `resolved:${piece.id}:${state.nextId++}`,
                    pieceId: piece.id,
                    playerId: spdrCompletedWindow.playerId,
                    resolved: spdrCompletedWindow.resolved.length > 0,
                    whenRevealedResolved:
                      spdrCompletedWindow.resolved.includes("text"),
                  },
                  actorId: spdrCompletedWindow.playerId,
                }),
              ]
            : []),
          ...(["25031", "25032"].includes(piece.code)
            ? [E("valkyrieFinishReveal", { id: piece.id })]
            : []),
          E("finishResolution", { id: piece.id }),
        ),
    })
  )
    return;
  if (armadillo.resolveArmadilloEffect(s, e, armadilloPorts)) return;
  if (zzzax.resolveZzzaxEffect(s, e, zzzaxPorts)) return;
  if (inheritors.resolveInheritorsEffect(s, e, inheritorsPorts)) return;
  if (resolveGoblinModuleEffect(s, e, goblinPorts)) return;
  if (resolveWideawakeNativeEffect(s, e)) return;
  if (wideawake.resolveProjectWideawakeEffect(s, e, wideawakePorts)) return;
  if (zeroTolerance.resolveZeroToleranceEffect(s, e, zeroTolerancePorts))
    return;
  if (sentinels.resolveSentinelsEffect(s, e, sentinelsPorts)) return;
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
      canChangeForm: (s) => canChangeIdentityForm(s, "alter"),
      select,
      shuffle,
      discardHand,
      discardPiece,
      attackTargets: (state) =>
        targets(state, "enemy", true).map((target) => find(state, target.id)!),
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
      if (s.scheming?.attacker === e.id)
        add(
          s,
          E("forcedResponses", {
            responses: ironspider.ironspiderSinisterActivationResponses(
              s,
              e.id,
            ),
            actorId: s.firstPlayerId,
          }),
        );
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
      if (!e.psylockeHandled) {
        add(s, ...psylocke.psylockeThwartFinished(s), {
          ...e,
          psylockeHandled: true,
        });
        break;
      }
      if (!e.niPowerHandled) {
        add(
          s,
          ...(niPack.novaIronheartPackPowerResponses(
            s,
            {
              token: `thwart:${s.nextId++}`,
              playerId: e.snapshot.playerId,
              sourceId: "hero",
              power: "thwart",
              performed: true,
              hero: true,
            },
            niPackPorts,
          ) || []),
          { ...e, niPowerHandled: true },
        );
        break;
      }
      const after = [{ ...e }];
      const poolOptions = nebulaPack.nebulaPackAfterThwartOptions(
        s,
        {
          playerId: e.snapshot.playerId,
          source: e.snapshot.source || "hero",
          thwart: e.snapshot.thwart !== false,
          basic: !!e.snapshot.basic,
          removedAllThreat:
            e.snapshot.removedAllThreat ??
            (e.snapshot.beforeThreat > 0 &&
              e.snapshot.removed === e.snapshot.beforeThreat),
        },
        after,
        nebulaPackPorts,
      );
      const options = [
        ...ghostNativeEventOptions(s, e.eventId, after, true),
        ...scarletPack.scarletWitchPackAfterHeroThwart(
          s,
          e.snapshot,
          after,
          scarletPackPorts,
        ),
        ...poolOptions,
      ];
      if (options.length)
        choose(
          s,
          poolOptions.length ? "After your hero thwarts" : "Turn the Tide",
          poolOptions.length
            ? "Choose a response after this thwart, or continue."
            : "Respond after removing all threat from a scheme?",
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
      if (["21026", "26028", "32055"].includes(e.piece.code))
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
      if (!e.eventId && s.flags[`shadowcatProgramPerformed:${e.id}`]) {
        delete s.flags[`shadowcatProgramPerformed:${e.id}`];
        add(
          s,
          ...shadowcatNativeCompletion(
            s,
            "attack",
            true,
            `program-complete:${e.id}`,
          ),
        );
      }
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
      if (!e.gambitThrowHandled) {
        const before = gambit.gambitBeforeEvent(s, e.piece, [
          { ...e, gambitThrowHandled: true },
        ]);
        if (before) {
          add(s, ...before);
          break;
        }
      }
      if (s.flags[`mtsPackPaymentCostPaid:${e.piece.id}`]) {
        delete s.flags[`mtsPackPaymentCostPaid:${e.piece.id}`];
        e.mtsPackAdditionalCostPaid = true;
      }
      if (!e.colossusCostHandled && e.piece?.code === "32009") {
        add(s, ...colossus.colossusAdditionalCost(s, e.piece), {
          ...e,
          colossusCostHandled: true,
        });
        break;
      }
      if (
        e.piece.code === "31017" &&
        s.flags[`spdrThwipPaymentCostPaid:${e.piece.id}`]
      ) {
        delete s.flags[`spdrThwipPaymentCostPaid:${e.piece.id}`];
        e.spdrPackAdditionalCostPaid = true;
      }
      const hamRevealRaw = s.flags[`spiderHamPaidReveal:${e.piece.id}`];
      const hamReveal =
        typeof hamRevealRaw === "string" ? JSON.parse(hamRevealRaw) : undefined;
      if (e.piece.code === "30005" && hamReveal) {
        delete s.flags[`spiderHamPaidReveal:${e.piece.id}`];
        add(
          s,
          ...spiderHam.spiderHamRevealCancelEffects(
            s,
            e.piece,
            hamReveal.receipt,
          ),
          ...hamReveal.after,
        );
        break;
      }
      if (
        e.piece.code === "30016" &&
        s.flags[`spiderHamEntrancePaid:${e.piece.id}`]
      ) {
        delete s.flags[`spiderHamEntrancePaid:${e.piece.id}`];
        break;
      }
      if (!e.spiderHamAdditionalCostPaid) {
        const cost = spiderHam.spiderHamBeforeEvent(s, e.piece, [
          { ...e, spiderHamAdditionalCostPaid: true },
        ]);
        if (cost !== null) {
          add(s, ...cost);
          break;
        }
      }
      if (!e.spiderHamPackAdditionalCostPaid) {
        const cost = spiderHamPack.spiderHamPackBeforeEvent(s, e.piece, [
          { ...e, spiderHamPackAdditionalCostPaid: true },
        ]);
        if (cost !== null) {
          add(s, ...cost);
          break;
        }
      }
      if (e.spiderHamPackAdditionalCostPaid && e.piece.code === "30017") {
        spiderHamPack.spiderHamPackCardPlayed(s, e.piece);
        s.flags.nebulaPackOneWayRound = s.round;
      }
      if (e.novaDamageContext && e.piece.code === "28003") {
        add(
          s,
          ...nova.novaForcefieldEffects(s, e.piece, e.novaDamageContext, {
            paidForCard: e.paidForCard,
            generatedForCard: e.generatedForCard,
            playToken: e.playToken,
          }),
        );
        break;
      }
      if (!e.spdrPackAdditionalCostPaid) {
        const effects = spdrPack.spdrPackBeforeEvent(s, e.piece, [
          { ...e, spdrPackAdditionalCostPaid: true },
        ]);
        if (effects) {
          add(s, ...effects);
          break;
        }
      }
      if (!e.niAdditionalCostPaid) {
        const effects = niPack.novaIronheartPackBeforeEvent(s, e.piece, [
          { ...e, niAdditionalCostPaid: true },
        ]);
        if (effects) {
          add(s, ...effects);
          break;
        }
      }
      if (!e.sinisterAdditionalCostPaid) {
        const cost = sinisterPlayerPack.sinisterPlayerPackBeforeEvent(
          s,
          e.piece,
          [{ ...e, sinisterAdditionalCostPaid: true }],
        );
        if (cost) {
          add(s, ...cost);
          break;
        }
      }
      if (!e.visionMeditationCostPaid) {
        const cost = visionPack.visionPackBeforeEvent(s, e.piece, [e]);
        if (cost) {
          add(s, ...cost);
          break;
        }
      }
      if (!e.valkyriePackCostPaid) {
        const cost = valkPack.valkyriePackBeforeEvent(s, e.piece, [e]);
        if (cost) {
          add(s, ...cost);
          break;
        }
      }
      if (!e.warMachinePackCostPaid) {
        const cost = warmPack.warMachinePackBeforeEvent(s, e.piece, [e]);
        if (cost) {
          add(s, ...cost);
          break;
        }
      }
      if (!e.warMachineAmmoCostPaid) {
        const cost = warMachine.warMachineBeforeEvent(s, e.piece, [e]);
        if (cost) {
          add(s, ...cost);
          break;
        }
      }
      if (e.piece.code === "22015" && !e.nebulaPackAdditionalCostPaid) {
        add(
          s,
          ...nebulaPack.nebulaPackBeforeEvent(s, e.piece, [
            { ...e, nebulaPackAdditionalCostPaid: true },
          ]),
        );
        break;
      }
      const p: Piece = e.piece,
        c = card(p);
      const stryfe = s.minions.find(
        (q) => q.code === "40032" && !isTextBlank(s, q),
      );
      if (
        stryfe &&
        c.type_code === "event" &&
        c.traits?.split(/\.\s*/).includes("Psionic")
      ) {
        s.flags[`ghostCancelled:${p.id}`] = true;
        add(
          s,
          E("damage", { target: stryfe.id, amount: 1, source: stryfe.id }),
        );
        break;
      }
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
      const visionAction =
        angel.angelEventAction(s, p) || vision.visionEventAction(s, p);
      const multipleLabels =
        !visionAction &&
        (c.text || "").match(
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
      if (
        (visionAction
          ? visionAction === "thwart"
          : c.text?.includes("(thwart)")) &&
        captainThwartBlocked(s)
      )
        break;
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
        (visionAction
          ? visionAction === "attack"
          : c.text?.includes("(attack)")) &&
        s.player.stunned
      ) {
        consumeStatus(s.player, "stunned");
        s.flags[`ghostCancelled:${p.id}`] = true;
        break;
      }
      if (
        !["01023", "06003", "04008"].includes(rulesCode(p)) &&
        (visionAction
          ? visionAction === "thwart"
          : c.text?.includes("(thwart)")) &&
        s.player.confused
      ) {
        consumeStatus(s.player, "confused");
        s.flags[`ghostCancelled:${p.id}`] = true;
        break;
      }
      add(
        s,
        ...doctorStrangeBeforeEvent(s, p, [{ ...e, type: "nativeEvent" }]),
      );
      break;
    }
    case "mutantGenesisAttackDamageComplete":
      finishAttackAfterDamage(s, e.target, e.before, e.recipientId, e.snapshot);
      break;
    case "shadowcatNativeOptionalAttackWindow": {
      const queued = s.queue.filter(
        (effect) =>
          effect.responseGroup === e.responseGroup &&
          effect.afterAttack &&
          effect.mandatory === false &&
          effect.type !== "shadowcatNativeOptionalAttackWindow",
      );
      s.queue = s.queue.filter((effect) => !queued.includes(effect));
      const responses: Effect[] = [...(e.responses || []), ...queued];
      const after: Effect[] = e.after || [];
      const resume = (remaining: Effect[]): Effect => ({
        ...e,
        responses: remaining,
        afterAttack: false,
      });
      const solid = shadowcat.shadowcatAttackDefenseOptions(
        s,
        e.receipt,
        [resume(responses)],
        shadowcatPorts,
      );
      if (!solid.length) {
        add(s, ...responses, ...after);
        break;
      }
      choose(
        s,
        "After attacking",
        "Resolve a response to this attack, or continue.",
        [
          ...solid,
          ...responses.map((effect, index) =>
            option(
              `attack-response:${index}`,
              effect.title || "Other responses after attacking",
              [effect, resume(responses.filter((_, other) => other !== index))],
            ),
          ),
          option("continue", "Continue", [...responses, ...after]),
        ],
      );
      break;
    }
    case "shadowcatNativeCompletionWindow": {
      const after = e.after || [];
      if (!e.forcedHandled) {
        add(
          s,
          ...shadowcat.shadowcatAttackDefenseCompletion(
            s,
            e.receipt,
            shadowcatPorts,
          ),
          { ...e, forcedHandled: true },
        );
        break;
      }
      const opts = shadowcat.shadowcatAttackDefenseOptions(
        s,
        e.receipt,
        after,
        shadowcatPorts,
      );
      if (opts.length)
        choose(
          s,
          "Mass form",
          "Resolve this completed attack or defense response?",
          [...opts, option("continue", "Continue", after)],
        );
      else add(s, ...after);
      break;
    }
    case "mutantGenesisInitiatedWindow":
    case "mutantGenesisAttacksWindow": {
      const after = e.after || [];
      const again = { ...e };
      const opts = mutantGenesisAttackOptions(
        s,
        e.type === "mutantGenesisInitiatedWindow" ? "initiated" : "attacks",
        [again],
      );
      if (opts.length)
        choose(
          s,
          "Attack interrupts",
          "Play an interrupt for this actual enemy attack?",
          [...opts, option("continue", "Continue", after)],
        );
      else add(s, ...after);
      break;
    }
    case "colossusNativeStudioFound": {
      if (e.id)
        for (const zone of [s.player.discard, s.player.deck]) {
          const i = zone.findIndex((p) => p.id === e.id);
          if (i >= 0) {
            s.player.hand.push(zone.splice(i, 1)[0]);
            break;
          }
        }
      add(s, ...(e.after || []));
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
        e.warMachineTarget,
        e.warMachinePackReceipt,
        e.valkyriePackReceipt,
        !!e.visionMeditationCostPaid,
        e.playToken,
        e.generatedForCard,
        e.syncPaid || 0,
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
      const available =
        s.player.hand[i] ||
        visionPack
          .visionPackStoredPlayable(s, visionPackPorts)
          .find((p) => p.id === e.id) ||
        ghostSpider
          .ghostSpiderStoredPlayable(s, ghostSpiderPorts)
          .find((p) => p.id === e.id);
      need(available, "The reaction card is no longer available.");
      const agility = !e.agilityHandled
        ? spiderWomanCardPlayed(s, card(available!))
        : [];
      if (agility.length) {
        add(s, ...agility, { ...e, agilityHandled: true });
        break;
      }
      const p =
        i >= 0
          ? s.player.hand.splice(i, 1)[0]
          : visionPack.visionPackTakeStoredForPlay(s, e.id, visionPackPorts) ||
            ghostSpider.ghostSpiderTakeStoredForPlay(
              s,
              e.id,
              ghostSpiderPorts,
            )!;
      const playToken = nativeCardPlayCommitted(s, p);
      if (e.ghostContext)
        ghostSpider.ghostSpiderCommitReaction(s, p, e.ghostContext);
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
      nebulaPack.nebulaPackCardPlayed(s, p);
      add(
        s,
        E("visionPackFlowPlayed", { piece: p, attacker: s.attack?.attacker }),
      );
      track(s, "cardsPlayed", 1);
      log(s, `Play ${card(p).name}.`, "good");
      if (
        [
          "21016",
          "21043",
          "21050",
          "21055",
          "22015",
          "23017",
          "23018",
          "23019",
          "23032",
        ].includes(p.code)
      ) {
        add(
          s,
          E("eventResolve", {
            piece: p,
            paid: e.paid || [],
            paidForCard: e.paidForCard,
            eventId: p.id,
            playToken,
          }),
          E("finishResolution", {
            id: p.id,
            eventId: p.id,
            playedEvent: { ...p },
            playToken,
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
      if (statusCanceled) s.flags[`ghostCancelled:${p.id}`] = true;
      const eventDefenseDeclared = !!(
        !statusCanceled &&
        labels.some((label) => label.includes("defense")) &&
        s.attack &&
        (!s.attack.defender || s.attack.defender === "none")
      );
      if (eventDefenseDeclared && s.attack) {
        s.attack.defender = "hero";
        s.attack.targetPlayerId = s.activePlayerId;
        s.attack.basicDefense = false;
        s.attack.defense = 0;
        s.attack.eventDefense = true;
      }
      const eventEffects: Effect[] = e.after ?? [
        E("nativeEvent", {
          piece: p,
          paid: e.paid || [],
          paidForCard: e.paidForCard,
          playToken,
        }),
      ];
      add(
        s,
        ...gambit.gambitBeforeReaction(
          s,
          p,
          msMarvelBeforeEvent(
            s,
            p,
            statusCanceled
              ? []
              : doctorStrangeBeforeEvent(
                  s,
                  p,
                  [
                    ...(eventDefenseDeclared
                      ? [E("quicksilverLateDefense")]
                      : []),
                    ...eventEffects,
                  ].map((x: Effect) => ({
                    ...x,
                    paid: x.paid ?? e.paid ?? [],
                    paidForCard: x.paidForCard ?? e.paidForCard,
                    eventId: p.id,
                    playToken,
                  })),
                ),
          ),
        ),
        E("finishResolution", {
          id: p.id,
          eventId: p.id,
          playedEvent: { ...p },
          playToken,
        }),
        ...(e.continuation || e.resume || []).map((x: Effect) => ({
          ...x,
          eventId: undefined,
        })),
      );
      break;
    }
    case "basicPower": {
      if (!(e.power === "attack" ? s.player.stunned : s.player.confused)) {
        const packet = {
          ...e,
          amount: e.amount ?? heroStats(s)[e.power as "attack" | "thwart"],
        };
        const options = domino.dominoBasicOptions(s, packet);
        if (options.length) {
          choose(s, "Probability Field", "Boost this basic power?", [
            ...options,
            option("continue", "Continue", [
              { ...packet, dominoProbabilityHandled: true },
            ]),
          ]);
          break;
        }
      }
      const xopts = x23.x23BasicOptions(s, e, x23Ports);
      if (xopts.length) {
        choose(s, "Animal Instinct", "Boost this basic thwart?", [
          ...xopts,
          option("continue", "Continue", [{ ...e, x23Handled: true }]),
        ]);
        break;
      }
      if (
        !e.angelAcrobaticsHandled &&
        !(e.power === "attack" ? s.player.stunned : s.player.confused)
      ) {
        const packet = {
          ...e,
          angelAcrobaticsHandled: true,
          amount: e.amount ?? heroStats(s)[e.power as "attack" | "thwart"],
        };
        const options = angel.angelBasicOptions(
          s,
          "hero",
          e.power,
          [packet],
          angelPorts,
        );
        if (options.length) {
          choose(s, "Soaring Acrobatics", "Boost this basic power?", [
            ...options,
            option("continue", "Continue", [packet]),
          ]);
          break;
        }
      }
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
      if (
        !e.psylockeBasicHandled &&
        !(power === "attack" ? s.player.stunned : s.player.confused)
      ) {
        const opts = psylocke.psylockeBasicOptions(s, e);
        if (opts.length) {
          choose(
            s,
            "Psi-Energy Control",
            "Flip one Psi-Energy upgrade before this basic power?",
            [
              ...opts,
              option("continue", "Continue without flipping", [
                { ...e, psylockeBasicHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      e.basicUseToken ||= `basic:${s.nextId++}`;
      e.basicWasHero ??= s.player.form === "hero";
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
      if (!replaced && !e.spdrBasicHandled) {
        const options = spdr.spdrBasicOptions(
          s,
          power,
          continuation,
          spdrPorts,
        );
        if (options.length) {
          choose(
            s,
            "SP//dr basic power interrupts",
            "Exhaust the Interface for +2 to this basic power?",
            [
              ...options,
              option("continue", "Continue", [
                { ...continuation, spdrBasicHandled: true },
              ]),
            ],
          );
          break;
        }
      }
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
      if (!replaced && power === "attack" && !e.spiderHamHammerHandled) {
        const packet = { ...continuation };
        const options = spiderHam.spiderHamBasicAttackOptions(
          s,
          packet,
          [],
          spiderHamPorts,
        );
        if (options.length) {
          choose(s, "Basic attack interrupts", "Use Huge Wooden Hammer?", [
            ...options,
            option("continue", "Continue", [
              { ...packet, spiderHamHammerHandled: true },
            ]),
          ]);
          break;
        }
      }
      if (!replaced && power === "thwart" && !e.spiderHamEntranceHandled) {
        const packet = { ...continuation };
        const options = spiderHamPack.spiderHamPackBasicThwartOptions(
          s,
          packet,
          [],
          spiderHamPackPorts,
        );
        if (options.length) {
          choose(s, "Basic thwart interrupts", "Play Making an Entrance?", [
            ...options,
            option("continue", "Continue", [
              { ...packet, spiderHamEntranceHandled: true },
            ]),
          ]);
          break;
        }
      }
      const metadata = {
        spiderHamPackEntrances: e.spiderHamPackEntrances,
        draxPackLeadingBlows: e.draxPackLeadingBlows,
        venomPackEntrances: e.venomPackEntrances,
        gmwBasicBonus: e.gmwBasicBonus,
        x23AnimalBonus: e.x23AnimalBonus,
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
          ...(!replaced
            ? [
                E("quicksilverBasicUsed", {
                  power,
                  basicUseToken: e.basicUseToken,
                  basicWasHero: e.basicWasHero,
                }),
              ]
            : []),
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
                      x23.x23Stats(s).piercing ||
                      !!e.piercing ||
                      quicksilverPack.quicksilverPackBasicPiercing(
                        textActiveState(s),
                      ),
                  }
                : { action: true }),
            }),
          }),
          ...(!replaced
            ? [
                E("quicksilverBasicUsed", {
                  power,
                  basicUseToken: e.basicUseToken,
                  basicWasHero: e.basicWasHero,
                }),
              ]
            : []),
        );
      }
      break;
    }
    case "quicksilverBasicUsed":
      add(s, ...x23.x23BasicUsed(s, e.power));
      add(
        s,
        ...nova.novaAfterBasicPower(
          s,
          {
            token: e.basicUseToken || `basic:${s.nextId++}`,
            playerId: s.activePlayerId,
            power: e.power,
            performed: true,
            wasHero: !!e.basicWasHero,
          },
          novaPorts,
        ),
      );
      add(
        s,
        ...miles.milesAfterBasicPower(
          s,
          {
            token: e.basicUseToken || `basic:${s.nextId++}`,
            playerId: s.activePlayerId,
            power: e.power,
            performed: true,
            wasHero: !!e.basicWasHero,
          },
          milesPorts,
        ),
        ...ghostSpider.ghostSpiderAfterBasicPower(s, {
          token: e.basicUseToken || `basic:${s.nextId++}`,
          playerId: s.activePlayerId,
          power: e.power,
          performed: true,
          wasHero: !!e.basicWasHero,
        }),
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
              mutantGenesisBonusApplied: e.mutantGenesisBonusApplied,
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
              mutantGenesisBonusApplied: !!e.mutantGenesisBonusApplied,
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
      if (!e.x23Handled) {
        add(s, ...x23.x23HeroAttack(s, e, x23Ports), {
          ...e,
          x23Handled: true,
        });
        break;
      }
      if (!e.psylockeHandled) {
        add(s, ...psylocke.psylockeAttackFinished(s, e, psylockePorts), {
          ...e,
          psylockeHandled: true,
        });
        break;
      }
      if (
        (e.draxBasicAttack || e.shadowcatAbilityAttack) &&
        !e.shadowcatCompletionHandled
      ) {
        add(s, ...shadowcatNativeCompletion(s, "attack", true), {
          ...e,
          shadowcatCompletionHandled: true,
        });
        break;
      }
      if (!e.niPowerHandled) {
        add(
          s,
          ...(niPack.novaIronheartPackPowerResponses(
            s,
            {
              token: `attack:${s.nextId++}`,
              playerId: s.activePlayerId,
              sourceId: "hero",
              power: "attack",
              performed: true,
              hero: true,
            },
            niPackPorts,
          ) || []),
          { ...e, niPowerHandled: true },
        );
        break;
      }
      if (
        e.excessDamage > 0 &&
        (!find(s, e.target) || find(s, e.target)?.code !== e.defeatedCode)
      )
        add(s, ...antPack.antManPackAfterAttackDefeat(s, e.excessDamage));
      add(
        s,
        ...wolverine.wolverineAfterDefeat(
          s,
          "hero",
          e.wasMinion && !find(s, e.target),
          true,
        ),
        ...thorAfterHeroAttack(s, {
          target: e.target,
          defeatedMinion: e.wasMinion && !find(s, e.target),
          actorId: s.activePlayerId,
        }).map((x) => ({ ...x, mandatory: false })),
        ...(e.draxBasicAttack ? drax.draxAfterBasicAttack(s, draxPorts) : []),
        ...(e.draxBasicAttack
          ? [
              E("magneto-native:basic-response", {
                receipt: {
                  token: `magneto-basic:${s.nextId++}`,
                  playerId: s.activePlayerId,
                  targetId: e.target,
                  targetCode: e.defeatedCode,
                  performed: true,
                },
              }),
            ]
          : []),
      );
      break;
    case "attackAftermathOrder": {
      const heroResponses = s.queue.filter(
        (x) =>
          x.responseGroup === e.responseGroup &&
          x.type === "heroAttackResponses",
      );
      const response = heroResponses.find(
        (x) =>
          seatView(s, x.actorId || s.activePlayerId).heroId === "shadowcat",
      );
      if (response && !response.shadowcatCompletionHandled) {
        const previous = s.activePlayerId;
        activateSeat(s, response.actorId || previous);
        const performed = !!(
          response.draxBasicAttack ||
          response.shadowcatAbilityAttack ||
          s.flags[`shadowcatAttackPerformed:${response.eventId}`] ||
          s.flags[`shadowcatProgramPerformed:${response.attackProgramId}`]
        );
        if (performed) {
          const windows = shadowcatNativeCompletion(
            s,
            "attack",
            true,
            `attack-complete:${e.responseGroup}`,
          );
          delete s.flags[`shadowcatAttackPerformed:${response.eventId}`];
          delete s.flags[
            `shadowcatProgramPerformed:${response.attackProgramId}`
          ];
          for (const window of windows) {
            const forced = shadowcat.shadowcatAttackDefenseCompletion(
              s,
              window.receipt,
              shadowcatPorts,
            );
            const additions = forced.length
              ? forced.map((effect) => ({
                  ...effect,
                  title: "Phased · flip to Solid",
                  mandatory: true,
                  afterAttack: true,
                  responseGroup: e.responseGroup,
                }))
              : [
                  {
                    ...window,
                    type: "shadowcatNativeOptionalAttackWindow",
                    mandatory: false,
                    afterAttack: true,
                    responseGroup: e.responseGroup,
                  },
                ];
            s.queue.unshift(
              ...additions.map((effect) => effectContext(s, effect)),
            );
          }
          for (const x of heroResponses) x.shadowcatCompletionHandled = true;
        }
        activateSeat(s, previous);
      }
      const queued = s.queue.filter(
        (x) =>
          x.responseGroup === e.responseGroup && x.afterAttack && x.mandatory,
      );
      s.queue = s.queue.filter((x) => !queued.includes(x));
      const forced = queued.flatMap((x) => {
        const current = refreshInheritorsRetaliate(s, x);
        return current ? [current] : [];
      });
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
      delete s.flags[`niHoned:${e.id}`];
      if (p && card(p).type_code === "event") {
        const previous = s.activePlayerId;
        if (e.actorId || p.ownerId) activateSeat(s, e.actorId || p.ownerId);
        mtsPlayerPack.mtsPlayerPackEventFinished(s, p);
        mgPack.mutantGenesisPlayerPackEventFinished(s, p.id);
        add(s, ...angel.angelEventFinished(s, p, angelPorts));
        const pendingFlow = s.queue.find(
          (effect) =>
            effect.type === "visionPackFlowPlayed" && effect.piece?.id === p.id,
        );
        s.queue = s.queue.filter(
          (effect) =>
            !(
              effect.type === "visionPackFlowPlayed" &&
              effect.piece?.id === p.id
            ),
        );
        add(
          s,
          E("nativeEventPlayResponses", {
            id: p.id,
            piece: p,
            attacker: pendingFlow?.attacker,
            usedFlow: [],
            playToken: e.playToken,
            ghostAllowed: !s.flags[`ghostCancelled:${p.id}`],
            niPlayed: e.niPlayed,
          }),
        );
        add(
          s,
          ...gamora.gamoraAfterEvent(
            s,
            p,
            e.skipMs ? [] : msMarvelAfterEvent(s, p, []),
            gamoraPorts,
          ),
        );
        if (
          s.flags[`shadowcatAttackPerformed:${p.id}`] &&
          !s.flags[`ghostCancelled:${p.id}`]
        ) {
          add(
            s,
            ...shadowcatNativeCompletion(
              s,
              "attack",
              true,
              `event-complete:${p.id}`,
            ),
          );
          delete s.flags[`shadowcatAttackPerformed:${p.id}`];
        }
        activateSeat(s, previous);
      }
      break;
    }
    case "nativeEventPlayResponses": {
      if (!e.niPlayedHandled) {
        add(
          s,
          ...(e.niPlayed
            ? niPack.novaIronheartPackCardPlayed(s, e.niPlayed, niPackPorts) ||
              []
            : []),
          ...nova.novaAfterEventPlayed(
            s,
            {
              token: e.playToken || `play:${s.nextId++}`,
              playerId: s.activePlayerId,
              eventId: e.id,
              code: e.piece.code,
              played: true,
            },
            novaPorts,
          ),
          { ...e, niPlayedHandled: true },
        );
        break;
      }
      const again = { ...e };
      const ghostOptions = e.ghostAllowed
        ? ghostNativeEventOptions(s, e.id, [again], true)
        : [];
      const flow = visionPack.visionPackCardPlayed(
        s,
        e.piece,
        e.attacker,
        visionPackPorts,
      );
      const flowOptions = flow
        .filter((effect) => !e.usedFlow.includes(effect.effects?.[0]?.source))
        .map((effect) => {
          const id = effect.effects[0].source;
          return option(
            `flow:${id}`,
            "Flow Like Water · deal 1 damage",
            [...effect.effects, { ...e, usedFlow: [...e.usedFlow, id] }],
            undefined,
            "26016",
          );
        });
      const options = [...ghostOptions, ...flowOptions];
      if (options.length)
        choose(
          s,
          "After resolving the event",
          "Resolve the available event and play responses in any order.",
          [...options, option("pass", "Continue", [])],
        );
      break;
    }
    case "retaliateAfterAttack":
      if (
        e.sourceTarget === "hero" ? s.player.hp > 0 : !!find(s, e.sourceTarget)
      )
        dealDamage(
          s,
          e.target,
          e.amount -
            (e.mansionRetaliate || 0) +
            (e.mansionRetaliate !== undefined
              ? mansionAttack.mansionAttackModifiers(
                  s,
                  e.sourceTarget === "hero" ? "hero" : find(s, e.sourceTarget)!,
                  { isTextBlank },
                ).retaliate
              : 0),
          "retaliate",
        );
      break;
    case "forcedResponses": {
      const remaining = (
        e.responses as {
          id: string;
          title: string;
          effects: Effect[];
          sourceId?: string;
        }[]
      )
        .filter((r) => !r.sourceId || !!find(s, r.sourceId))
        .flatMap((r) => {
          const effects = r.effects.flatMap((effect) => {
            const current = refreshInheritorsRetaliate(s, effect);
            return current ? [current] : [];
          });
          return effects.length ? [{ ...r, effects }] : [];
        });
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
      if (angel.angelIndirectExhaust(s)) {
        e.exhaustDamaged = true;
        e.zzzaxBatchId ||= `angel-indirect:${s.nextId++}`;
        e.zzzaxBatchOwner ||= s.activePlayerId;
      }
      const allocations = e.allocations || {};
      const choices = targets(s, "controlled").filter((t) => {
        if (e.zzzaxTakeCost && !zzzaxCanTakeCostDamage(s, t.id)) return false;
        const hp =
          t.id === "hero"
            ? s.player.hp
            : pieceHP(s, find(s, t.id)!) - find(s, t.id)!.damage;
        return hp > (allocations[t.id] || 0);
      });
      if (e.amount <= 0 || !choices.length) {
        if (e.zzzaxBatchId) {
          const packets = Object.entries(allocations).map(
            ([target, amount]) => ({
              target: target === "hero" ? `hero:${e.zzzaxBatchOwner}` : target,
              amount,
            }),
          );
          add(
            s,
            ...packets.map((packet, index) =>
              E("damage", {
                ...packet,
                damageDealt: packet.amount,
                source: e.source,
                zzzaxBatchId: e.zzzaxBatchId,
                zzzaxBatchOwner: e.zzzaxBatchOwner,
                zzzaxBatchIndex: index,
                damageFromAttack: !!e.attackDamage,
                actorId: e.zzzaxBatchOwner,
              }),
            ),
            E("zzzaxIndirectCommit", {
              packets,
              batchId: e.zzzaxBatchId,
              playerId: e.zzzaxBatchOwner,
              source: e.source,
              after: e.zzzaxAfter,
              exhaustDamaged: e.exhaustDamaged,
              attackDamage: e.attackDamage,
              actorId: e.zzzaxBatchOwner,
            }),
          );
          break;
        }
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
    case "valkyrieFinishReveal": {
      const p = s.attachments.find((p) => p.id === e.id);
      if (p && !p.attachedTo) discardPiece(s, p.id);
      break;
    }
    case "valkyrieAdvanceVillain":
      advanceVillain(s, e.source, e.attack, e.receipts);
      break;
    case "finishDefeat": {
      const p = find(s, e.id);
      if (p)
        defeatCharacter(
          s,
          p,
          e.source,
          e.attack,
          true,
          !!e.enemyAttack,
          e.valkyrieReceipts,
        );
      break;
    }
    case "encounterVictory":
      movePieceFromPlay(s, e.id, false, undefined, true);
      break;
    case "playerSideSchemeLimit": {
      const schemes = playerSideSchemes(s);
      const limit = playerSideSchemeLimit(s);
      if (schemes.length <= limit) break;
      const chooserId = e.playerId || s.firstPlayerId;
      activateSeat(s, chooserId);
      choose(
        s,
        "Player side scheme limit",
        `Choose a player side scheme to discard. The shared limit is ${limit}. Discarding it does not defeat it.`,
        schemes.map((p) =>
          option(
            p.id,
            `Discard ${card(p).name}`,
            [
              E("playerSideSchemeDiscard", { id: p.id }),
              E("playerSideSchemeLimit", { playerId: chooserId }),
            ],
            undefined,
            p.code,
          ),
        ),
      );
      break;
    }
    case "playerSideSchemeDiscard": {
      const p = playerSideSchemes(s).find((p) => p.id === e.id);
      need(p, "The selected player side scheme is no longer in play.");
      discardPiece(s, p!.id);
      break;
    }
    case "playerSideSchemeCheckDefeat": {
      const p = playerSideSchemes(s).find((p) => p.id === e.id);
      if (p && !p.counters) add(s, E("defeatScheme", { id: p.id }));
      break;
    }
    case "playerSideSchemeReward": {
      const p = playerSideSchemes(s).find((p) => p.id === e.id);
      if (!p || !p.pendingDefeat || isTextBlank(s, p)) break;
      add(
        s,
        ...domino.dominoSideSchemeDefeated(s, p),
        ...psylocke.psylockeSideSchemeDefeated(s, p, s.activePlayerId),
        ...angel.angelPlayerSideSchemeDefeated(s, p),
        ...cable.cableSideReward(s, p),
        ...x23.x23SchemeDefeated(s, p),
      );
      break;
    }
    case "playerSideSchemeFinishDefeat": {
      const p = playerSideSchemes(s).find((p) => p.id === e.id);
      if (p?.pendingDefeat) {
        delete p.pendingDefeat;
        defeatScheme(s, p, e.source, true);
      }
      break;
    }
    case "defeatScheme": {
      const p = s.sideSchemes.find((x) => x.id === e.id);
      if (p && zeroTolerance.zeroToleranceIsPermanent(s, p)) break;
      const interrupts =
        p && !e.visionPackChanceChecked
          ? visionPack.visionPackSchemeDefeating(s, p, visionPackPorts)
          : [];
      if (interrupts.length) {
        add(s, ...interrupts, { ...e, visionPackChanceChecked: true });
        break;
      }
      if (p && !p.counters && !e.spiderHamDefeatHandled) {
        const effects = [
          ...(spiderHam.spiderHamSideDefeated(s, p, s.activePlayerId) || []),
          ...spiderHamPack.spiderHamPackSchemeDefeating(
            s,
            p,
            spiderHamPackPorts,
          ),
        ];
        if (effects.length) {
          add(s, ...effects, { ...e, spiderHamDefeatHandled: true });
          break;
        }
      }
      if (p && !p.counters) {
        defeatScheme(s, p, e.source);
        if (e.spiderHamBatchToken) {
          const key = `spiderHamBatchDefeated:${e.spiderHamBatchToken}`;
          const flags = seatView(s, e.actorId || s.activePlayerId).flags;
          const ids = String(flags[key] || "")
            .split(",")
            .filter(Boolean);
          ids.push(p.id);
          flags[key] = ids.join(",");
        }
      }
      break;
    }
    case "defeatSchemes": {
      if (!e.visionPackChanceChecked) {
        const interrupts = (e.ids as string[]).flatMap((id) => {
          const p = s.sideSchemes.find((p) => p.id === id && !p.counters);
          return p
            ? visionPack.visionPackSchemeDefeating(s, p, visionPackPorts)
            : [];
        });
        if (interrupts.length) {
          add(s, ...interrupts, { ...e, visionPackChanceChecked: true });
          break;
        }
      }
      if (!e.spiderHamDefeatHandled) {
        const interrupts = (e.ids as string[]).flatMap((id) => {
          const p = s.sideSchemes.find((p) => p.id === id && !p.counters);
          return p
            ? [
                ...(spiderHam.spiderHamSideDefeated(s, p, s.activePlayerId) ||
                  []),
                ...spiderHamPack.spiderHamPackSchemeDefeating(
                  s,
                  p,
                  spiderHamPackPorts,
                ),
              ]
            : [];
        });
        if (interrupts.length) {
          add(s, ...interrupts, { ...e, spiderHamDefeatHandled: true });
          break;
        }
      }
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
          ...(keyword(p, "Quickstrike", s) && s.player.form === "hero"
            ? [E("enemyAttack", { id: p.id })]
            : []),
          E("minionResponses", { id: p.id }),
        );
      break;
    }
    case "valkPackEngagementWindow": {
      const p = s.minions.find((p) => p.id === e.id);
      const options = p
        ? valkPack.valkyriePackEngagementOptions(s, p.id, [], valkyriePackPorts)
        : [];
      if (options.length)
        choose(
          s,
          "Minion engagement interrupts",
          "Use Anticipation before resolving this minion's engagement responses?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    case "visionPackFlowPlayed":
      add(
        s,
        ...visionPack.visionPackCardPlayed(
          s,
          e.piece,
          e.attacker,
          visionPackPorts,
        ),
      );
      break;
    case "visionPackMeditationPlay": {
      const p = (
        e.sinisterGovernment
          ? sinisterPlayerPackPorts.handPlayableCards!(s)
          : s.player.hand
      ).find((p) => p.id === e.id);
      need(
        p && visionPackPorts.canPlayWithDiscount(s, p, e.discount),
        e.sinisterGovernment
          ? "Government Liaison needs its actual playable S.H.I.E.L.D. hand card."
          : "Meditation needs its actual playable hand card.",
      );
      const prior = Number(s.flags.discount || 0),
        queued = s.queue.length;
      const continuation = [...s.queue];
      s.flags.discount = prior + e.discount;
      requestPlay(s, p!);
      const generated = s.queue.splice(0, s.queue.length - queued);
      add(
        s,
        ...generated,
        E("flag", { key: "discount", value: 0 }),
        ...(e.after || []),
      );
      if (s.prompt?.cancelable)
        s.prompt.cancellationQueue = [
          E("flag", { key: "discount", value: prior }),
          ...(e.after || []),
          ...continuation,
        ];
      break;
    }
    case "valkPackThorRemember":
      s.flags[`valkPackThorPacket:${e.id}`] = JSON.stringify(e.packet);
      break;
    case "valkPackThorAttackPacket": {
      const ally = s.player.inPlay.find((p) => p.id === e.id),
        target = s.minions.find((p) => p.id === e.target);
      if (ally && target)
        attackAction(
          s,
          target.id,
          allyStat(s, ally, "attack") + Number(e.extraAmount || 0),
          ally.id,
          !!e.overkill,
          false,
          { initiated: true, piercing: e.piercing, ranged: e.ranged },
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
      if (p)
        allyEnter(
          s,
          p,
          e.paid || [],
          !!e.fromHand,
          e.paidForCard || [],
          e.syncPaid || 0,
        );
      break;
    }
    case "warmPackAttach": {
      const p = find(s, e.id);
      if (!p) break;
      const possible = warmPack.warMachinePackAttachmentTargets(s, p) || [];
      need(possible.length, "Sidearm has no legal ally attachment target.");
      choose(
        s,
        "Sidearm",
        "Choose an ally to attach Sidearm to.",
        possible.map((t) =>
          option(
            t.id,
            t.label,
            [E("warmPackAttachChosen", { id: p.id, target: t.id })],
            undefined,
            t.code,
          ),
        ),
      );
      break;
    }
    case "warmPackAttachChosen": {
      const p = find(s, e.id);
      need(
        p &&
          (warmPack.warMachinePackAttachmentTargets(s, p) || []).some(
            (t) => t.id === e.target,
          ),
        "Sidearm's actual ally target is no longer legal.",
      );
      attachPackUpgrade(s, e.id, e.target);
      break;
    }
    case "nebulaPackAllyPlayed": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      if (p)
        add(
          s,
          ...nebulaPack.nebulaPackAllyPlayed(
            s,
            p,
            e.playedPlayerId,
            nebulaPackPorts,
          ),
        );
      break;
    }
    case "nebulaPackUpgradePlayed": {
      const p = allInPlay(s).find((p) => p.id === e.id);
      if (p)
        add(
          s,
          ...nebulaPack.nebulaPackUpgradePlayed(
            s,
            p,
            e.playedPlayerId,
            nebulaPackPorts,
          ),
        );
      break;
    }
    case "restrictedLimit":
      if (restrictedLimitExceeded(s))
        choose(
          s,
          "Restricted limit",
          "Choose a Restricted card to discard to meet your limit. Extra Weapon slots apply only to Weapon upgrades.",
          s.player.inPlay
            .filter((p) => keyword(p, "Restricted") && !isPermanent(card(p)))
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
      if (!s.player.stunned) {
        const options = domino.dominoRangedOptions(s, {
          ...e,
          ranged: e.ranged ?? !!sourceKeyword(s, e.source || "hero", "Ranged"),
        });
        if (options.length) {
          choose(s, "Sharpshooter", "Boost this ranged attack?", [
            ...options,
            option("continue", "Continue", [
              { ...e, dominoSharpHandled: true },
            ]),
          ]);
          break;
        }
      }
      if (e.amount > 0 && !e.cableFieldHandled) {
        const packet = {
          ...e,
          actorId: e.actorId || s.activePlayerId,
          cableFieldHandled: true,
        };
        const options = playerOrder(s).flatMap((seat) =>
          cable
            .cableDamageOptions(seatView(s, seat), packet, [packet], cablePorts)
            .map((o) => ({
              ...o,
              id: `${seat.id}:${o.id}`,
              effects: o.effects.map((q) => ({
                ...q,
                actorId: q.actorId || seat.id,
              })),
            })),
        );
        if (options.length) {
          choose(s, "Telekinetic Force Field", "Prevent this damage?", [
            ...options,
            option("continue", "Continue", [packet]),
          ]);
          break;
        }
      }
      if (
        !e.deadpoolHandled &&
        (e.attack || e.damageFromAttack || e.enemyAttack)
      ) {
        const next = { ...e, deadpoolHandled: true };
        const opts = deadpool.deadpoolDamageOptions(
          s,
          { ...next, attack: true },
          [next],
          deadpoolPorts,
        );
        if (opts.length) {
          choose(s, "Attack damage", "Prevent damage with Barely a Scratch?", [
            ...opts,
            option("allow", "Take damage", [next]),
          ]);
          break;
        }
      }
      if (e.attack) {
        e.psylockeToken ||=
          s.currentAttackProgramId ||
          s.currentEventId ||
          `psylocke-attack:${s.nextId++}`;
        const illusion = psylocke.psylockeIllusion(s, e);
        if (illusion) {
          add(s, ...illusion);
          break;
        }
        if (!e.psylockeDirectedHandled) {
          const options = psylocke.psylockeAttackOptions(s, e, psylockePorts);
          if (options.length) {
            choose(s, "Directed Force", "Play an attack interrupt?", [
              ...options,
              option("continue", "Continue attack", [
                { ...e, psylockeDirectedHandled: true },
              ]),
            ]);
            break;
          }
        }
        if (!e.psylockeDirectedBonusApplied) {
          e.amount += Number(
            s.flags[`psylockeDirectedBonus:${e.psylockeToken}`] || 0,
          );
          e.psylockeDirectedBonusApplied = true;
        }
      }
      if (e.attack && e.amount > 0 && !e.angelDamageHandled) {
        const packet = {
          ...e,
          angelDamageHandled: true,
          angelPacketId: `angel-damage:${s.nextId++}`,
        };
        const options = playerOrder(s).flatMap((seat) =>
          angel
            .angelDamageOptions(seatView(s, seat), packet, [packet], angelPorts)
            .map((o) => ({
              ...o,
              id: `${seat.id}:${o.id}`,
              effects: o.effects.map((q) => ({ ...q, actorId: seat.id })),
            })),
        );
        if (options.length) {
          choose(s, "Aerial Intervention", "Prevent attack damage?", [
            ...options,
            option("continue", "Continue", [packet]),
          ]);
          break;
        }
      }
      if (
        e.basic &&
        e.attack &&
        !e.cyclopsBefuddleHandled &&
        cyclops.cyclopsAttackModifiers(s, e.target).befuddle &&
        !s.player.stunned
      ) {
        choose(
          s,
          "Befuddle",
          "Use your THW instead of ATK for this basic attack?",
          [
            option("thw", "Use THW", [
              {
                ...e,
                amount:
                  (e.amount ?? heroStats(s).attack) -
                  heroStats(s).attack +
                  heroStats(s).thwart,
                cyclopsBefuddleHandled: true,
              },
            ]),
            option("atk", "Use ATK", [{ ...e, cyclopsBefuddleHandled: true }]),
          ],
        );
        break;
      }
      {
        const shield = phoenix.phoenixForcedDamage(s, e, phoenixPorts);
        if (shield) {
          add(s, ...shield);
          break;
        }
      }
      if (e.attack && !e.wolverineAttackHandled) {
        e.wolverineAttackToken ||=
          s.currentAttackProgramId ||
          s.currentEventId ||
          `wolverine-attack:${s.nextId++}`;
        const opts = wolverine.wolverineAttackOptions(s, e, wolverinePorts);
        if (opts.length) {
          choose(s, "Attack interrupts", "Use an attack modifier?", [
            ...opts,
            option("continue", "Continue attack", [
              { ...e, wolverineAttackHandled: true },
            ]),
          ]);
          break;
        }
      }
      if (e.attack && !e.wolverineBonusApplied) {
        e.amount += Number(
          s.flags[`wolverineWarriorBonus:${e.wolverineAttackToken}`] || 0,
        );
        e.wolverineBonusApplied = true;
      }
      if (e.attack && shadowcatNativeIgnoreWindow(s, e, "attack")) break;
      if (e.basic && !e.colossusRageHandled) {
        const next = { ...e, colossusRageHandled: true };
        const opts = colossus.colossusBasicAttackOptions(
          s,
          e,
          [],
          colossusPorts,
        );
        if (opts.length) {
          choose(s, "Made of Rage", "Enhance this actual basic attack?", [
            ...opts,
            option("continue", "Continue", [next]),
          ]);
          break;
        }
      }
      if (e.target === "hero" || e.target === `hero:${s.activePlayerId}`) {
        const forced = spdrPack.spdrPackForcedDamage(s, e, spdrPackPorts);
        if (forced) {
          add(s, ...forced);
          break;
        }
      }
      if (
        e.basic &&
        !e.strangeBasicHandled &&
        s.player.form === "hero" &&
        !s.player.stunned &&
        eventPlaySources(s).some(
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
        s.player.hand.some((p) =>
          ["06015", "06032", "33017"].includes(p.code),
        ) &&
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
      if (
        (e.attack || e.damageFromAttack) &&
        !e.novaDamageHandled &&
        e.amount > 0 &&
        (e.target === "hero" ||
          allInPlay(s).some(
            (p) => p.id === e.target && card(p).type_code === "ally",
          ))
      ) {
        e.damageWindowId ||= `damage${s.nextId++}`;
        const amount = Math.max(
          0,
          e.amount - Number(s.flags[`msPrevent:${e.damageWindowId}`] || 0),
        );
        const opts = niNativeDamageOptions(s, { ...e, attack: true, amount }, [
          { ...e },
        ]);
        if (opts.length) {
          choose(
            s,
            "Forcefield Projection",
            "Prevent damage from this actual attack?",
            [
              ...opts,
              option("allow", `Take ${amount} damage`, [
                { ...e, novaDamageHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      if (e.target === "hero" && e.damageDealt === undefined)
        e.damageDealt = e.amount;
      if (e.target === "hero" && !e.grootDamageHandled) {
        if (
          e.attack &&
          e.amount > 0 &&
          !damageProhibition(s, "hero", false) &&
          (e.piercing ?? !!sourceKeyword(s, e.source || "hero", "Piercing"))
        )
          colossusNativeDiscardTough(
            s,
            [{ targetId: "hero", amount: statusCards(s.player, "tough") }],
            [],
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
          const options = [
            ...warmPackDamageOptions(s, { ...e, amount }, [e]),
            ...visionPackNativeDamageOptions(s, { ...e, amount }, [e]),
            ...scarletWitch.scarletWitchDamageOptions(
              s,
              e,
              amount,
              [e],
              scarletPorts,
            ),
          ];
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
        const captainOptions = magneto.magnetoIdentityRestricted(
          s,
          s.activePlayerId,
          { isTextBlank },
        )
          ? []
          : captainShieldBlockOptions(s, [{ ...e, amount: 0, skip: true }]);
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
        if (
          flight &&
          s.player.form === "hero" &&
          !magneto.magnetoIdentityRestricted(s, s.activePlayerId, {
            isTextBlank,
          })
        ) {
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
      if (e.basic && e.attack && !e.valkyrieTargetAttackHandled && e.target) {
        e.amount += valkyrie.valkyrieAttackBonusForTarget(s, e.target);
        e.valkyrieTargetAttackHandled = true;
      }
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
      if (e.attack && !e.visionPackManchaHandled) {
        const recipient = find(s, e.target);
        const reduction = recipient
          ? visionPack.visionPackAttackDamageReduction(
              s,
              recipient,
              visionPackPorts,
            )
          : 0;
        if (reduction > 0) e.amount = Math.max(0, e.amount - reduction);
        e.visionPackManchaHandled = true;
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
      if (e.zzzaxBatchId) {
        // Run native prevention windows for every allocated character before
        // placing any damage. The saved packet retains dealt and taken amounts.
        seatView(s, e.zzzaxBatchOwner).flags[
          `${e.zzzaxBatchId}:${e.zzzaxBatchIndex}`
        ] = JSON.stringify({ amount: e.amount, damageDealt: e.damageDealt });
        break;
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
        const targetPiece = find(s, e.target);
        const receiptSnapshot = {
          id: e.target,
          code: targetPiece?.code,
          stage: e.target === s.villain.id ? s.villain.stage : undefined,
        };
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
            noDamageInstance: e.noDamageInstance,
            mutantGenesisBonusApplied: e.mutantGenesisBonusApplied,
          },
        );
        if (e.abilitySource && result)
          s.flags[`shadowcatDealt:${e.abilitySource}:${e.target}`] =
            result.damageDealt > 0;
        niQueuePacketReceipt(s, e, result, receiptSnapshot);
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
        const receiptPiece = find(s, e.target);
        const receiptQueue = new Set(s.queue);
        const result = dealDamage(
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
        if (e.afterResolved?.length && !["won", "lost"].includes(s.phase)) {
          const generated = s.queue.filter((q) => !receiptQueue.has(q));
          s.queue = s.queue.filter((q) => receiptQueue.has(q));
          const optional = e.spdrPaymentCostId
            ? generated.filter(
                (q) =>
                  q.type === "optional" ||
                  q.mandatory === false ||
                  [
                    "bwAllyDefeated",
                    "sinister-player:web-life-window",
                  ].includes(q.type),
              )
            : [];
          if (e.spdrPaymentCostId)
            s.flags[`spdrThwipDamageResponses:${e.spdrPaymentCostId}`] =
              JSON.stringify(optional);
          add(
            s,
            ...generated.filter((q) => !optional.includes(q)),
            E("niNativeDamageReceipt", {
              snapshot: {
                id: e.target,
                code: receiptPiece?.code,
                stage: e.target === s.villain.id ? s.villain.stage : undefined,
              },
              result,
              performed: true,
              after: e.afterResolved,
            }),
          );
        }
      }
      break;
    case "heal":
      heal(s, e.target, e.amount, e.origin || "player");
      break;
    case "zzzaxIndirectCommit": {
      const owner = seatView(s, e.playerId);
      const flags = owner.flags;
      const previousDefer = s.flags.waspDeferDefeats;
      s.flags.spectrumDamageBatchApplying = true;
      s.flags.waspDeferDefeats = true;
      let identityDamageDealt = 0;
      let identityDamageTaken = 0;
      let damageTaken = 0;
      const damageReceipts: { target: string; actualDamage: number }[] = [];
      const receipt = effectContext(
        s,
        E("zzzaxIndirectAfter", {
          batchId: e.batchId,
          playerId: e.playerId,
          after: e.after,
          identityDamageDealt: 0,
          damageTaken: 0,
        }),
      );
      // Every native damage/defeat response must resolve before the card's
      // continuation. This receipt is serializable if a response pauses play.
      s.queue.unshift(receipt);
      try {
        for (const [index, packet] of (
          e.packets as { target: string; amount: number }[]
        ).entries()) {
          const key = `${e.batchId}:${index}`;
          const prepared = JSON.parse(String(flags[key] || "null"));
          delete flags[key];
          if (!prepared) continue;
          const identity = packet.target === `hero:${e.playerId}`;
          if (!identity && !find(s, packet.target)) continue;
          const result = dealDamage(
            s,
            packet.target,
            prepared.amount,
            e.source,
            false,
            false,
            false,
            {
              grootHandled: true,
              damageFromAttack: !!e.attackDamage,
              enemyAttack: !!e.attackDamage,
              damageDealt: prepared.damageDealt ?? packet.amount,
            },
          );
          damageTaken += result.actualDamage;
          damageReceipts.push({
            target: packet.target,
            actualDamage: result.actualDamage,
          });
          if (result.actualDamage > 0 && e.exhaustDamaged) {
            if (identity) owner.player.exhausted = true;
            else {
              const p = find(s, packet.target);
              if (p) p.exhausted = true;
            }
          }
          if (identity) {
            identityDamageDealt += result.damageDealt;
            identityDamageTaken += result.actualDamage;
          }
        }
      } finally {
        delete flags.spectrumDamageBatchApplying;
        if (previousDefer !== undefined) flags.waspDeferDefeats = previousDefer;
        else delete flags.waspDeferDefeats;
      }
      receipt.identityDamageDealt = identityDamageDealt;
      receipt.identityDamageTaken = identityDamageTaken;
      receipt.damageTaken = damageTaken;
      receipt.damageReceipts = damageReceipts;
      flags.spectrumBatchDefeatSource = e.source;
      try {
        check(s);
      } finally {
        delete flags.spectrumBatchDefeatSource;
      }
      break;
    }
    case "zzzaxIndirectAfter": {
      const original = s.players.find((p) => p.id === e.playerId);
      if (
        e.after &&
        (!original?.eliminated ||
          ["zzzax:remove-damage-after", "ironspiderAttackComplete"].includes(
            e.after.type,
          ))
      )
        add(s, {
          ...e.after,
          actorId: original?.eliminated ? s.activePlayerId : e.playerId,
          identityDamageDealt: e.identityDamageDealt,
          identityDamageTaken: e.identityDamageTaken,
          damageTaken: e.damageTaken,
          damageReceipts: e.damageReceipts,
        });
      break;
    }
    case "zzzaxDiscardCostCommit": {
      const flags = seatView(s, e.playerId).flags;
      const paid = flags[`zzzaxDiscardPaid:${e.costId}`];
      delete flags[`zzzaxDiscardPaid:${e.costId}`];
      delete flags[`zzzaxDiscardPending:${e.costId}`];
      if (paid) add(s, { ...e.after, actorId: s.activePlayerId });
      break;
    }
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
        if (
          e.target === "main" &&
          !e.cableTemporalHandled &&
          schemeLimit(s) > 0 &&
          s.scheme.threat + e.amount >= schemeLimit(s)
        ) {
          const after = [
            {
              ...e,
              actorId: e.actorId || s.activePlayerId,
              cableTemporalHandled: true,
            },
          ];
          const options = playerOrder(s).flatMap((seat) =>
            cable.cableTemporalOptions(seatView(s, seat), after).map((o) => ({
              ...o,
              id: `${seat.id}:${o.id}`,
              effects: o.effects.map((q) => ({ ...q, actorId: seat.id })),
            })),
          );
          if (options.length) {
            choose(
              s,
              "Temporal Leap",
              "Interrupt completion of the main scheme?",
              [...options, option("continue", "Continue", after)],
            );
            break;
          }
        }
        if (!e.deadpoolHandled && e.amount > 0) {
          const next = { ...e, deadpoolHandled: true };
          const choices = playerOrder(s).flatMap((seat) =>
            deadpool
              .deadpoolThreatOptions(seatView(s, seat), next, deadpoolPorts)
              .map((o) => ({
                ...o,
                id: `${seat.id}:${o.id}`,
                effects: o.effects.map((q) => ({ ...q, actorId: seat.id })),
              })),
          );
          if (choices.length) {
            choose(
              s,
              "Threat would be placed",
              "Replace this threat with damage?",
              [...choices, option("allow", "Place the threat", [next])],
            );
            break;
          }
        }
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
      const operative = gambit.gambitThwartWindow(s, e);
      if (operative) {
        add(s, ...operative);
        break;
      }
      if (e.action && shadowcatNativeIgnoreWindow(s, e, "thwart")) break;
      if (
        (e.action || e.basic) &&
        !e.spdrThwartCostPaid &&
        s.sideSchemes.some(
          (p) => p.id === e.target && p.code === "31026" && !isTextBlank(s, p),
        )
      ) {
        requestPayment(
          s,
          "Giant Monster Attack · additional thwart cost",
          1,
          [{ ...e, spdrThwartCostPaid: true }],
          ["energy"],
          undefined,
          false,
        );
        break;
      }
      if (
        e.basic &&
        !e.thorWindowHandled &&
        s.player.hand.some((p) => ["06032", "33017"].includes(p.code)) &&
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
      if (e.basic && !e.x23AssaultHandled && x23.x23Assault(s, e.target)) {
        e.amount =
          e.amount -
          (e.basicStatAmount ?? heroStats(s).thwart) +
          heroStats(s).attack -
          Number(e.x23AnimalBonus || 0);
        delete e.basicStatAmount;
        e.x23AssaultHandled = true;
      }
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
            !!e.basic,
            !!e.ignorePatrol,
          )
        : thwart(s, e.target, e.amount, !!e.ignoreCrisis, e.source);
      if (e.basic && e.spiderHamPackEntrances?.length) {
        const responses = s.queue.splice(0, s.queue.length - queuedBefore);
        add(
          s,
          ...responses,
          ...spiderHamPack.spiderHamPackBasicThwartEnded(
            s,
            e,
            beforeThreat > 0 && removed === beforeThreat,
          ),
        );
      }
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
      if (e.afterResolved?.length)
        add(
          s,
          ...e.afterResolved.map((q: Effect) => ({
            ...q,
            removed: Number(removed || 0),
            lastThreatRemoved: beforeThreat > 0 && removed === beforeThreat,
          })),
        );
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
        if (p && nova.novaCanReadyPiece(s, p, { isTextBlank }))
          p.exhausted = false;
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
        !!e.fromDeck,
        e.generatedForCard,
        e.novaDamageContext,
        e.syncPaid || 0,
      );
      break;
    case "commitPaymentAllocation":
      s.prompt = e.payment;
      pay(s, e.ids, e.wildAs, e.paidForCard, e.generatedForCard, e.syncPaid);
      break;
    case "niNativeLeaveWindow": {
      if (
        !find(s, e.receipt.pieceId) ||
        s.flags[`niLeaveComplete:${e.receipt.token}`]
      )
        break;
      const next = { ...e, index: e.index + 1, actorId: e.originalActorId };
      if (e.index >= e.players.length) {
        add(
          s,
          E("niNativeLeaveCommit", {
            receipt: e.receipt,
            actorId: e.originalActorId,
          }),
        );
        break;
      }
      const playerId = e.players[e.index];
      const effects = niPack.novaIronheartPackLeaveInterrupt(
        seatView(s, playerId),
        e.receipt,
        niPackPorts,
        [next],
      );
      if (effects)
        add(s, ...effects.map((q: Effect) => ({ ...q, actorId: playerId })));
      else add(s, next);
      break;
    }
    case "niNativeLeaveCommit":
      if (
        find(s, e.receipt.pieceId) &&
        !s.flags[`niLeaveComplete:${e.receipt.token}`]
      ) {
        s.flags[`niLeaveComplete:${e.receipt.token}`] = true;
        s.flags[`niLeaveCommitted:${e.receipt.pieceId}`] = true;
        movePieceFromPlay(s, e.receipt.pieceId, false);
      }
      break;
    case "niNativePlayed":
      add(
        s,
        ...(niPack.novaIronheartPackCardPlayed(s, e.receipt, niPackPorts) ||
          []),
      );
      break;
    case "niNativeReactionCommit":
      add(s, ...e.after);
      play(
        s,
        e.piece,
        e.paid || [],
        undefined,
        undefined,
        undefined,
        false,
        e.overpaid || 0,
        e.paidForCard,
        false,
        e.generatedForCard,
        e.context,
      );
      break;
    case "niNativeDamageReceipt": {
      const p = find(s, e.snapshot.id);
      const defeated =
        e.performed &&
        (e.snapshot.stage !== undefined
          ? s.villain.stage !== e.snapshot.stage
          : !p);
      const damageReceipt = {
        target: e.snapshot.id,
        damageDealt: e.result.damageDealt,
        actualDamage: e.result.actualDamage,
        excessDamage: e.result.excessDamage,
        defeated: !!defeated,
      };
      add(
        s,
        ...e.after.map((q: Effect) => ({
          ...q,
          damageReceipt,
          defeatedEnemy: !!defeated,
        })),
      );
      break;
    }
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
        e.paymentCommit || e.commit,
        !!e.starLordCostHandled,
        !!e.starLordApplyDiscount,
        !!e.handOnly,
        !!e.abilityCost,
      );
      if (s.prompt && e.cancelable && e.cancellationQueue)
        s.prompt.cancellationQueue = e.cancellationQueue.map((effect: Effect) =>
          effectContext(s, effect),
        );
      break;
    case "attachPlayer": {
      const p = find(s, e.id);
      if (p) {
        need(
          playerAttachmentTarget(s, p, e.target),
          "Robert Kelly cannot have player cards or upgrades attached.",
        );
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
        option("yes", "Use ability", e.effects, undefined, e.image),
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
      } else
        swPorts.thwartDistribution(
          s,
          targets(s, "scheme").map((t) => ({
            target: t.id,
            amount: e.amount,
          })),
        );
      break;
    case "crisisInterdiction": {
      if (
        !e.spdrThwartCostPaid &&
        !s.player.confused &&
        s.sideSchemes.some(
          (p) => p.id === e.target && p.code === "31026" && !isTextBlank(s, p),
        )
      ) {
        requestPayment(
          s,
          "Giant Monster Attack · additional thwart cost",
          1,
          [{ ...e, spdrThwartCostPaid: true }],
          ["energy"],
          undefined,
          false,
        );
        break;
      }
      if (s.player.confused) {
        consumeStatus(s.player, "confused");
        log(s, "Confused cancels Crisis Interdiction.");
        break;
      }
      const before = new Set(s.queue);
      const removed = thwartAction(s, e.target, 2, "hero", true, false, true);
      if (
        removed ===
          2 + msMarvelEventAmountModifier(s, s.currentEventId, "thwart") &&
        aerial(s)
      ) {
        const generated = s.queue.filter((q) => !before.has(q));
        s.queue = s.queue.filter((q) => before.has(q));
        add(
          s,
          ...generated,
          E("target", {
            group: "scheme",
            exclude: e.target,
            title: "Crisis Interdiction · Aerial",
            responseGroup: `eventThwart:${s.currentEventId}`,
            mandatory: true,
            action: E("thwart", {
              amount: 2,
              action: true,
              thwartInitiated: true,
              thwartStatusChecked: true,
            }),
          }),
        );
      }
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
      need(
        e.id !== sabretooth.sabretoothKelly(s)?.id,
        "Robert Kelly has no basic ATK or THW power.",
      );
      if (
        e.kind === "thwart" &&
        !e.spdrThwartCostPaid &&
        s.sideSchemes.some(
          (p) => p.id === e.target && p.code === "31026" && !isTextBlank(s, p),
        )
      ) {
        requestPayment(
          s,
          "Giant Monster Attack · additional thwart cost",
          1,
          [{ ...e, spdrThwartCostPaid: true }],
          ["energy"],
          undefined,
          false,
        );
        break;
      }
      const p = find(s, e.id);
      if (!p) break;
      const attack = e.kind === "attack";
      if (x23.x23Shatterstar(s, p, e, x23Ports)) break;
      const xopts = x23.x23AllyOptions(s, p, e, x23Ports);
      if (xopts.length) {
        choose(s, "Sisterly Bond", "Add X-23’s matching power?", [
          ...xopts,
          option("continue", "Continue", [{ ...e, x23Handled: true }]),
        ]);
        break;
      }
      if (!attack && !e.x23AssaultHandled && x23.x23Assault(s, e.target)) {
        e.amount =
          (e.amount ?? allyStat(s, p, "thwart")) -
          allyStat(s, p, "thwart") +
          allyStat(s, p, "attack");
        e.x23AssaultHandled = true;
      }
      if (!e.angelAcrobaticsHandled && !(attack ? p.stunned : p.confused)) {
        const packet = {
          ...e,
          angelAcrobaticsHandled: true,
          amount: e.amount ?? allyStat(s, p, attack ? "attack" : "thwart"),
        };
        const options = angel.angelBasicOptions(
          s,
          p.id,
          attack ? "attack" : "thwart",
          [packet],
          angelPorts,
        );
        if (options.length) {
          choose(s, "Soaring Acrobatics", "Boost this basic power?", [
            ...options,
            option("continue", "Continue", [packet]),
          ]);
          break;
        }
      }
      if (
        attack &&
        !e.cyclopsDustHandled &&
        p.code === "33012" &&
        !p.stunned &&
        !isTextBlank(s, p) &&
        s.minions.some((m) => m.id === e.target)
      ) {
        const packet = { ...e, cyclopsDustHandled: true };
        choose(
          s,
          "Dust",
          "Attack every minion and take +1 consequential damage?",
          [
            option("all", "Attack each minion", [
              { ...packet, cyclopsDust: true },
            ]),
            option("single", "Attack only the chosen minion", [packet]),
          ],
        );
        break;
      }
      if (attack && e.cyclopsConsequenceReduction === undefined)
        e.cyclopsConsequenceReduction = (
          e.cyclopsDust ? s.minions.map((m) => m.id) : [e.target]
        ).reduce(
          (n: number, id: string) =>
            n + cyclops.cyclopsAttackModifiers(s, id).consequence,
          0,
        );
      if (
        attack &&
        !e.cyclopsBefuddleHandled &&
        cyclops.cyclopsAttackModifiers(s, e.target).befuddle &&
        !p.stunned
      ) {
        choose(s, "Befuddle", "Use this ally's THW instead of ATK?", [
          option("thw", "Use THW", [
            {
              ...e,
              amount: allyStat(s, p, "thwart"),
              cyclopsBefuddleHandled: true,
            },
          ]),
          option("atk", "Use ATK", [{ ...e, cyclopsBefuddleHandled: true }]),
        ]);
        break;
      }
      const dominoBefore = domino.dominoBeforeAlly(s, p, {
        ...e,
        amount: e.amount ?? allyStat(s, p, attack ? "attack" : "thwart"),
      });
      if (dominoBefore) {
        add(s, ...dominoBefore);
        break;
      }
      const gambitBefore = gambit.gambitBeforeAlly(s, p, e);
      if (gambitBefore) {
        add(s, ...gambitBefore);
        break;
      }
      const rogueBefore = rogue.rogueBeforeAlly(s, p, e);
      if (rogueBefore) {
        add(s, ...rogueBefore);
        break;
      }
      const phoenixBefore = phoenix.phoenixBeforeAlly(s, p, e);
      if (phoenixBefore) {
        add(s, ...phoenixBefore);
        break;
      }
      if (attack && !e.wolverinePsylockeHandled) {
        const options = wolverine.wolverineAllyAttackOptions(s, p, e);
        if (options.length) {
          choose(s, "Psylocke", "Spend a psionic counter?", [
            ...options,
            option("continue", "Continue attack", [
              { ...e, wolverinePsylockeHandled: true },
            ]),
          ]);
          break;
        }
      }
      const wolverineThreatBefore =
        e.target === "main"
          ? s.scheme.threat
          : s.sideSchemes.find((q) => q.id === e.target)?.counters || 0;
      if (!e.nebulaPackCosmoHandled && !(attack ? p.stunned : p.confused)) {
        const packet = {
          ...e,
          amount: e.amount ?? allyStat(s, p, attack ? "attack" : "thwart"),
        };
        const options = nebulaPack.nebulaPackBeforeAllyBasicOptions(
          s,
          p,
          packet,
          [],
          nebulaPackPorts,
        );
        if (options.length) {
          p.exhausted = true;
          choose(
            s,
            "Ally initiates basic power",
            "Use Cosmo's interrupt before this attack or thwart?",
            [
              ...options,
              option("continue", "Continue", [
                { ...packet, nebulaPackCosmoHandled: true },
              ]),
            ],
          );
          break;
        }
      }
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
      if (
        !e.stormAllyHandled &&
        !(attack ? p.stunned : p.confused) &&
        (p.code === "36014" ||
          allInPlay(s).some(
            (a) => a.code === "36019" && a.counters > 0 && !isTextBlank(s, a),
          ))
      ) {
        add(
          s,
          ...storm.stormAllyAction(
            s,
            p,
            { ...e, attack, stormAllyHandled: true },
            stormPorts,
          ),
        );
        break;
      }
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
      if (attack && !e.valkPackThorHandled && !p.stunned) {
        const packet = {
          ...e,
          amount: e.amount ?? allyStat(s, p, "attack"),
          valkPackThorHandled: true,
        };
        const options = valkPack
          .valkyriePackAllyAttackOptions(s, p, e.target, [], valkyriePackPorts)
          .map((o) => ({
            ...o,
            effects: [
              E("valkPackThorRemember", { id: p.id, packet }),
              ...o.effects,
            ],
          }));
        if (options.length) {
          choose(
            s,
            "Thor attack interrupts",
            "Spend an energy resource to resolve this one attack against each minion engaged with that player?",
            [...options, option("continue", "Continue this attack", [packet])],
          );
          break;
        }
      }
      if (!e.sinisterPowerHandled && !(attack ? p.stunned : p.confused)) {
        const packet = {
          ...e,
          sinisterPowerHandled: true,
          sinisterPowerToken:
            e.sinisterPowerToken || `ally-basic:${s.nextId++}`,
        };
        const receipt = {
          token: packet.sinisterPowerToken,
          playerId: s.activePlayerId,
          allyId: p.id,
          power: attack ? ("attack" as const) : ("thwart" as const),
          performed: true,
          basic: true,
        };
        const effects =
          sinisterPlayerPack.sinisterPlayerPackBasicPowerInterrupt(
            s,
            receipt,
            sinisterPlayerPackPorts,
            [packet],
          );
        if (effects) {
          p.exhausted = true;
          add(s, ...effects);
          break;
        }
      }
      if (!e.visionPackMachineHandled) {
        const packet = { ...e, visionPackMachineHandled: true };
        const options = visionPack.visionPackAllyUseOptions(
          s,
          p,
          attack ? "attack" : "thwart",
          [packet],
          visionPackPorts,
        );
        if (options.length) {
          choose(s, "Machine Man", "Spend resources for this use?", [
            ...options,
            option("continue", "Continue without a bonus", [packet]),
          ]);
          break;
        }
      }
      const stunned = attack ? p.stunned : p.confused;
      const minionTarget = attack
        ? s.minions.find((minion) => minion.id === e.target)
        : undefined;
      const enemyTarget = attack ? find(s, e.target) : undefined;
      const cableSchemeCode = !attack
        ? s.sideSchemes.find((q) => q.id === e.target)?.code
        : undefined;
      const attackedEnemySnapshot = enemyTarget
        ? {
            id: enemyTarget.id,
            code: enemyTarget.code,
            stage:
              enemyTarget.id === s.villain.id ? s.villain.stage : undefined,
          }
        : undefined;
      const queuedBefore = s.queue.length;
      if (attack && p.code === "32091")
        delete s.flags[`wideawakeMinionDefeat:${p.id}`];
      if (attack && p.code === "32172b")
        delete s.flags[`masterMoldMinionDefeat:${p.id}`];
      const bonus = attack
        ? scarletPack.scarletWitchPackAllyAttackBonus(s, p)
        : 0;
      const sinisterBonus = Number(
        s.flags[`sinisterPower:${e.sinisterPowerToken}`] || 0,
      );
      if (e.sinisterPowerToken)
        delete s.flags[`sinisterPower:${e.sinisterPowerToken}`];
      const amount =
        Number(e.stormBonus || 0) +
        sinisterBonus +
        (e.amount ?? allyStat(s, p, attack ? "attack" : "thwart") - bonus) +
        bonus +
        (e.visionPackMachineId === p.id &&
        e.visionPackMachineAction === (attack ? "attack" : "thwart")
          ? Number(e.visionPackMachineBonus || 0)
          : 0);
      if (
        attack &&
        p.code === "29033" &&
        !isTextBlank(s, p) &&
        !p.stunned &&
        !e.bombshellPackets
      ) {
        const divisions = niPack.novaIronheartPackBombshellDivisions(
          amount,
          [s.villain, ...s.minions].map((q) => q.id),
        );
        choose(
          s,
          "Bombshell",
          "Divide this attack's damage as evenly as possible among every enemy.",
          divisions.map((d) =>
            option(
              d.id,
              d.allocations
                .map(
                  (a) =>
                    `${find(s, a.target) ? card(find(s, a.target)!).name : "Enemy"}: ${a.amount}`,
                )
                .join(" · "),
              [{ ...e, bombshellPackets: d.allocations, amount }],
              undefined,
              p.code,
            ),
          ),
        );
        break;
      }
      if (attack && e.cyclopsDust)
        e.bombshellPackets = s.minions.map((m) => ({ target: m.id, amount }));
      if (attack && e.bombshellPackets) {
        const program = `program${s.nextId++}`;
        s.currentAttackProgramId = program;
        const previousDefer = s.flags.waspDeferDefeats;
        s.flags.waspDeferDefeats = true;
        try {
          for (const packet of e.bombshellPackets)
            if (packet.amount > 0)
              attackAction(
                s,
                packet.target,
                packet.amount,
                p.id,
                !!e.overkill,
                false,
                { initiated: true, piercing: e.piercing, ranged: e.ranged },
              );
        } finally {
          s.flags.waspDeferDefeats = previousDefer;
        }
        for (const enemy of [...s.minions].filter(
          (q) => q.damage >= pieceHP(s, q),
        ))
          defeatCharacter(s, enemy, p.id, true);
        if (s.villain.hp <= 0) advanceVillain(s, p.id, true);
        add(
          s,
          E("attackProgramEnd", { id: program, attackProgramId: program }),
        );
      } else if (attack) {
        const confused = !!find(s, e.target)?.confused;
        const result = attackAction(
          s,
          e.target,
          amount,
          p.id,
          !!e.overkill,
          false,
          { piercing: e.piercing, ranged: e.ranged },
        );
        if (result)
          add(
            s,
            ...psylocke.psylockeCypher(s, p, confused, result.actualDamage),
          );
      } else {
        const removed = thwartAction(s, e.target, amount, p.id);
        if (Number(removed) > 0) {
          const interrupts = s.queue.splice(0, s.queue.length - queuedBefore);
          add(
            s,
            ...interrupts,
            E("spiderHamAllyThwartResponses", {
              receipt: {
                token: `ally-thwart:${s.nextId++}`,
                playerId: s.activePlayerId,
                sourceId: p.id,
                target: e.target,
                amount: Number(removed),
                performed: true,
                thwart: true,
                basic: true,
              },
            }),
          );
        }
      }
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
        ...psylocke.psylockeAllyUsed(s, p),
        ...x23.x23AllyUsed(s, p, e.target, attack),
        ...gambit.gambitAfterAlly(s, p, e.target, attack && !!minionTarget),
        ...angel.angelAllyUsed(s, p, attack),
        ...domino.dominoAfterAlly(s, p, attack),
        ...phoenix.phoenixAllyUsed(s, p, attack ? "attack" : "thwart"),
        E("wolverine:ally-after", {
          piece: { ...p },
          target: e.target,
          attack,
          before: wolverineThreatBefore,
        }),
        ...spdrPack.spdrPackAllyUsed(
          s,
          p,
          attack ? "attack" : "thwart",
          true,
          spdrPackPorts,
        ),
        E("allyResponse", {
          id: p.id,
          wideawakeTargetId: e.target,
          wideawakeTargetCode:
            attackedEnemySnapshot?.code || cableSchemeCode || "",
          attack,
          sinisterPowerToken:
            e.sinisterPowerToken || `ally-basic:${s.nextId++}`,
          attackedMinion: minionTarget
            ? { id: minionTarget.id, code: minionTarget.code }
            : undefined,
        }),
        E("allyConsequence", {
          id: p.id,
          wideawakeTargetId: e.target,
          wideawakeTargetCode:
            attackedEnemySnapshot?.code || cableSchemeCode || "",
          attack,
          defeatKey,
          nebulaPackCosmoHandled: e.nebulaPackCosmoHandled,
          nebulaPackCosmoId: e.nebulaPackCosmoId,
          nebulaPackCosmoSafe: e.nebulaPackCosmoSafe,
          amount: starLordPack.starLordPackConsequentialDamage(
            e,
            attack
              ? Math.max(
                  0,
                  (card(p).attack_cost || 0) +
                    Number(!!e.cyclopsDust) -
                    Number(e.cyclopsConsequenceReduction || 0) -
                    psylocke.psylockeConsequence(s, p, e.target, true) +
                    captainPackModifiers(s, p.id).consequentialAttack +
                    Number(e.stormHavok || 0) +
                    Number(
                      p.code === "36016" &&
                        e.target === s.villain.id &&
                        !isTextBlank(s, p),
                    ),
                )
              : Math.max(
                  0,
                  ((e.x23AssaultHandled
                    ? card(p).attack_cost
                    : card(p).thwart_cost) || 0) -
                    psylocke.psylockeConsequence(s, p, e.target, false),
                ),
          ),
        }),
        ...(attack ? [E("scarletAfterAllyAttack", { id: p.id })] : []),
      );
      break;
    }
    case "allyResponse": {
      const headpool = find(s, e.id);
      if (
        headpool?.code === "44014" &&
        !isTextBlank(s, headpool) &&
        e.attack &&
        e.attackedMinion &&
        s.minions.some((p) => p.id === e.attackedMinion.id) &&
        e.damage > 0
      )
        add(
          s,
          E("optional", {
            title: "Headpool",
            text: "Have the damaged minion attack another enemy?",
            effects: [E("deadpool:headpool", { id: e.attackedMinion.id })],
          }),
        );
      add(
        s,
        ...(niPack.novaIronheartPackPowerResponses(
          s,
          {
            token: e.sinisterPowerToken || `ally-basic:${s.nextId++}`,
            playerId: s.activePlayerId,
            sourceId: e.id,
            power: e.attack ? "attack" : "thwart",
            performed: true,
            hero: false,
          },
          niPackPorts,
        ) || []),
      );
      const p = find(s, e.id);
      if (!p) break;
      add(
        s,
        ...(sinisterPlayerPack.sinisterPlayerPackAllyPowerResponses(
          s,
          {
            token: e.sinisterPowerToken || `ally-basic:${s.nextId++}`,
            playerId: s.activePlayerId,
            allyId: p.id,
            power: e.attack ? "attack" : "thwart",
            performed: true,
            basic: true,
          },
          sinisterPlayerPackPorts,
        ) || []),
      );
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
      if (e.attack && ["32089", "32090"].includes(p.code))
        add(
          s,
          E("wideawake-native:ally-response", {
            receipt: {
              token: e.sinisterPowerToken,
              allyId: p.id,
              allyCode: p.code,
              playerId: s.activePlayerId,
              performed: true,
              targetId: e.wideawakeTargetId,
              targetCode: e.wideawakeTargetCode,
              defeatedMinion: !!s.flags[`wideawakeMinionDefeat:${p.id}`],
            },
          }),
        );
      if (e.attack && p.code === "32172b") {
        const defeatedSentinelMinion =
          !!s.flags[`masterMoldMinionDefeat:${p.id}`];
        delete s.flags[`masterMoldMinionDefeat:${p.id}`];
        add(
          s,
          E("mastermold-native:ally-response", {
            receipt: {
              token: e.sinisterPowerToken,
              allyId: p.id,
              allyCode: p.code,
              playerId: s.activePlayerId,
              performed: true,
              defeatedSentinelMinion,
            },
          }),
        );
      }
      break;
    }
    case "allyConsequence": {
      const angelAlly = find(s, e.id);
      if (angelAlly && !e.angelConsequenceHandled) {
        const reduced = angel.angelConsequential(s, angelAlly, e.amount);
        if (reduced < e.amount) {
          choose(
            s,
            "Cannonball",
            "Reduce consequential damage for Aerial cards in your hand?",
            [
              option("reduce", `Reduce to ${reduced}`, [
                { ...e, amount: reduced, angelConsequenceHandled: true },
              ]),
              option("continue", "Take the full consequential damage", [
                { ...e, angelConsequenceHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      const p = find(s, e.id);
      const defeatedEnemy = !!s.flags[e.defeatKey];
      if (e.defeatKey) delete s.flags[e.defeatKey];
      const baseAmount = p
        ? nebulaPack.nebulaPackConsequentialDamage(
            s,
            p,
            e,
            e.amount,
            nebulaPackPorts,
          )
        : 0;
      const reduction =
        p?.code === "32091"
          ? wideawake.projectWideawakeConsequentialReduction(
              s,
              {
                token: e.sinisterPowerToken || `cannonball:${p.id}`,
                allyId: p.id,
                allyCode: p.code,
                playerId: s.activePlayerId,
                performed: !!e.attack,
                targetId: e.wideawakeTargetId,
                targetCode: e.wideawakeTargetCode,
                defeatedMinion: !!s.flags[`wideawakeMinionDefeat:${p.id}`],
              },
              wideawakePorts,
            )
          : 0;
      if (p?.code === "32091") delete s.flags[`wideawakeMinionDefeat:${p.id}`];
      const amount = p
        ? cable.cableConsequential(
            s,
            p,
            e,
            Math.max(0, baseAmount - reduction),
            cablePorts,
          )
        : 0;
      if (p && amount) {
        const token = `consequence:${s.nextId++}`;
        s.flags[`sinisterConsequential:${token}`] = amount;
        add(
          s,
          E("sinisterNativeConsequential", {
            token,
            id: p.id,
            attack: !!e.attack,
            beforeDamage: p.damage,
            defeatedEnemy,
            amount,
          }),
        );
      }
      break;
    }
    case "sinisterNativeConsequential": {
      const p = find(s, e.id);
      const amount = Number(s.flags[`sinisterConsequential:${e.token}`] || 0);
      const receipt = { token: e.token, allyId: e.id, amount };
      const options = sinisterPlayerPack.sinisterPlayerPackConsequentialOptions(
        s,
        receipt,
        [e],
        sinisterPlayerPackPorts,
      );
      if (options.length) {
        choose(
          s,
          "Consequential damage",
          "Prevent this actual consequential damage?",
          [
            ...options,
            option("continue", "Take consequential damage", [
              { ...e, type: "sinisterNativeConsequentialFinish" },
            ]),
          ],
        );
        break;
      }
      add(s, { ...e, type: "sinisterNativeConsequentialFinish" });
      break;
    }
    case "sinisterNativeConsequentialFinish": {
      const p = find(s, e.id);
      const amount = Number(s.flags[`sinisterConsequential:${e.token}`] || 0);
      delete s.flags[`sinisterConsequential:${e.token}`];
      if (p && amount)
        add(
          s,
          E("damage", {
            target: p.id,
            amount,
            source: "consequential",
          }),
          E("dvAllyConsequenceAfter", {
            id: p.id,
            beforeDamage: p.damage,
            attack: !!e.attack,
            defeatedEnemy: e.defeatedEnemy,
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
      if (s.attack?.id === e.enemyAttackId)
        recordZeroToleranceAllyDefeat(
          s,
          e.piece,
          e.enemySource,
          true,
          e.playerId,
        );
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
    case "rogueNativeMedPlay": {
      const lab = find(s, e.labId),
        p = lab?.storedCards?.find((p) => p.id === e.id);
      if (p) {
        lab!.storedCards = lab!.storedCards!.filter((q) => q.id !== p.id);
        s.player.hand.push(p);
        play(s, p, []);
        add(s, { type: "rogue:med-exhaust", id: p.id });
      }
      break;
    }
    case "phoenixSchemeInterrupt": {
      if (
        e.id !== s.villain.id ||
        !s.scheming ||
        s.scheming.id !== e.activationId
      )
        break;
      const choices = phoenix.phoenixReactionOptions(
        s,
        "scheme",
        [],
        phoenixPorts,
      );
      if (choices.length)
        choose(
          s,
          "Villain schemes",
          "Play Psychic Manipulation before revealing boosts?",
          [...choices, option("pass", "Continue", [])],
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
    case "ghostNativeActivationResume": {
      const key = `ghostActivation:${e.receipt.token}`;
      const canceled = !!s.flags[`ghostActivationCancelled:${e.receipt.token}`];
      delete s.flags[key];
      delete s.flags[`ghostActivationCancelled:${e.receipt.token}`];
      if (!canceled) add(s, e.continuation);
      else if (
        e.continuation.activation?.after ||
        e.continuation.request?.after
      )
        add(s, {
          ...(e.continuation.activation?.after ||
            e.continuation.request?.after),
          performed: false,
          damagePlaced: 0,
          threatPlaced: 0,
        });
      break;
    }
    case "ghostNativeEnemyAttack":
      s.flags.ghostActivationResuming = true;
      try {
        enemyAttack(
          s,
          e.id,
          e.extra,
          e.activation,
          e.originalTarget,
          !!e.colossusActivationHandled,
          e.colossusActivationReceipt,
        );
      } finally {
        delete s.flags.ghostActivationResuming;
      }
      break;
    case "ghostNativeEnemyScheme":
      s.flags.ghostActivationResuming = true;
      try {
        enemyScheme(
          s,
          e.id,
          e.extra,
          e.request,
          !!e.colossusActivationHandled,
          e.colossusActivationReceipt,
        );
      } finally {
        delete s.flags.ghostActivationResuming;
      }
      break;
    case "enemyAttack":
      enemyAttack(
        s,
        e.id,
        e.extra,
        e.activation,
        e.originalTarget,
        !!e.colossusActivationHandled,
        e.colossusActivationReceipt,
      );
      break;
    case "sinisterNativePlayed":
      add(
        s,
        ...(sinisterPlayerPack.sinisterPlayerPackCardPlayed(
          s,
          e.receipt,
          sinisterPlayerPackPorts,
        ) || []),
      );
      break;
    case "sinisterNativeRevealed":
      add(
        s,
        ...(sinisterPlayerPack.sinisterPlayerPackEncounterRevealed(
          s,
          e.receipt,
          sinisterPlayerPackPorts,
        ) || []),
      );
      break;
    case "sinisterNativeClaimDefense":
      gamoraPorts.claimDefense(s, e.packet);
      break;
    case "sinisterNativeJump": {
      const p = s.resolving.find((p) => p.id === s.currentEventId);
      need(
        p && p.code === "27014",
        "The actual Jump Flip event is no longer resolving.",
      );
      add(
        s,
        ...(sinisterPlayerPack.sinisterPlayerPackEvent(
          s,
          p!,
          e.paidForCard ?? e.paid ?? [],
          e.receipt,
        ) || []),
      );
      break;
    }
    case "sinisterNativeAttack":
      enemyAttack(s, s.villain.id, undefined, {
        playerId: e.playerId,
        enemyId: s.villain.id,
        kind: "attack",
        modifier: 0,
        after: E("sinisterNativeAfter", { after: e.after }),
      });
      break;
    case "sinisterNativeAfter":
      add(s, ...(e.after || []));
      break;
    case "sinisterNativePut": {
      let p: Piece | undefined;
      for (const zone of [s.player.hand, s.player.deck, s.player.discard]) {
        const i = zone.findIndex((p) => p.id === e.id);
        if (i >= 0) {
          p = zone.splice(i, 1)[0];
          break;
        }
      }
      need(
        p && sinisterPlayerPackPorts.canPutCard(s, p),
        "The actual owned card cannot enter play.",
      );
      Object.assign(p!, resetPiece(p!, true));
      s.player.inPlay.push(p!);
      if (rulesCode(p!) === "01064") p!.counters = 3;
      add(
        s,
        ...sinisterPlayerPack.sinisterPlayerPackCardEntered(s, p!),
        ...mtsPlayerPack.mtsPlayerPackCardEntered(s, p!),
        ...(card(p!).type_code === "ally"
          ? [E("allyLimit"), E("allyEnter", { id: p!.id })]
          : []),
        ...(e.after || []),
      );
      break;
    }
    case "sinisterNativeLeave": {
      const p = find(s, e.id);
      if (!p) break;
      const receipt = {
        token: `leave:${s.nextId++}`,
        playerId: s.activePlayerId,
        pieceId: p.id,
        code: p.code,
        traits: sinisterNativeTraits(s, p),
      };
      const effects = sinisterPlayerPack.sinisterPlayerPackAllyLeaveInterrupt(
        s,
        receipt,
        sinisterPlayerPackPorts,
        [
          E("sinisterNativeLeaveCommit", {
            id: e.id,
            removed: e.removed,
            setAsideOwnerId: e.setAsideOwnerId,
          }),
        ],
      );
      if (effects) add(s, ...effects);
      else
        add(
          s,
          E("sinisterNativeLeaveCommit", {
            id: e.id,
            removed: e.removed,
            setAsideOwnerId: e.setAsideOwnerId,
          }),
        );
      break;
    }
    case "sinisterNativeLeaveCommit":
      s.flags[`sinisterLeaveCommitted:${e.id}`] = true;
      movePieceFromPlay(s, e.id, !!e.removed, e.setAsideOwnerId);
      delete s.flags[`sinisterLeaveCommitted:${e.id}`];
      break;
    case "milesNativeAttackStart":
      enemyAttack(s, e.enemyId, undefined, {
        playerId: e.playerId,
        enemyId: e.enemyId,
        kind: "attack",
        modifier: 0,
        after: E("milesNativeAttackComplete", {
          continuation: e.continuation,
          milesAttackToken: e.token,
          actorId: e.returnPlayerId,
        }),
      });
      break;
    case "milesNativeAttackComplete": {
      const key = `milesAttackDefeat:${e.milesAttackToken}`;
      const defeatedCharacter = !!s.flags[key];
      delete s.flags[key];
      add(s, {
        ...e.continuation,
        performed: !!e.performed,
        defeatedCharacter,
      });
      break;
    }
    case "enemyTargetAttackComplete": {
      const a = e.snapshot as NonNullable<GameState["attack"]>;
      const moldAfter = masterMold.masterMoldAfterEnemyAttack(
        s,
        {
          token: a.id!,
          enemyId: a.attacker,
          enemyCode: a.attackerSnapshot?.code || "",
          performed: !!a.completionRecorded,
          damagedTargets: a.originalTarget
            ? [{ targetId: a.originalTarget, actualDamage: a.damage }]
            : [],
        },
        { isTextBlank },
      );
      const mansionAfter = mansionAttackEnemyAttackAfter(
        s,
        a,
        a.originalTarget || "",
        a.targetPlayerId || s.activePlayerId,
      );
      s.attack = null;
      add(
        s,
        ...(moldAfter.length || mansionAfter.length
          ? [
              E("forcedResponses", {
                responses: [...moldAfter, ...mansionAfter].map(
                  (effect, index) => ({
                    id: `${a.id}:stun-beam:${index}`,
                    title: "Stun Beam",
                    effects: [effect],
                  }),
                ),
                actorId: s.firstPlayerId,
              }),
            ]
          : []),
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
    case "nebulaGamoraAttackStart": {
      const source = e.source as nebula.NebulaAttackSource;
      const p = nebulaNativeAttacker(s, source.id, source);
      if (!p || !playerOrder(s).some((seat) => seat.id === e.playerId)) {
        add(s, { ...e.continuation, performed: false });
        break;
      }
      if (source.kind === "ally" && !p.stunned) {
        const seat = controller(s, source.id)!;
        activateSeat(s, seat.id);
        const baseAmount = e.baseAmount ?? allyStat(s, p, "attack");
        const packet = {
          ...e,
          kind: "attack",
          amount: e.amount ?? baseAmount,
          baseAmount,
          actorId: seat.id,
        };
        const resume = {
          ...packet,
          starPackTargetPracticeHandled: true,
          scarletLastHandled: true,
        };
        const options = [
          ...starLordPack.starLordPackBeforeAllyBasicOptions(
            s,
            p,
            packet,
            [],
            starLordPackPorts,
          ),
          ...(!e.scarletLastHandled
            ? scarletPack.scarletWitchPackAllyAttackOptions(
                s,
                p,
                [{ ...packet, scarletLastHandled: true }],
                scarletPackPorts,
              )
            : []),
        ];
        if (options.length) {
          choose(
            s,
            "Gamora · attack interrupts",
            "Use an attack interrupt before Gamora attacks without exhausting?",
            [...options, option("continue", "Continue the attack", [resume])],
          );
          break;
        }
      }
      activateSeat(s, e.playerId);
      enemyAttack(s, source.id, undefined, {
        playerId: e.playerId,
        enemyId: source.id,
        kind: "attack",
        modifier: Math.max(
          0,
          Number(e.amount || 0) - Number(e.baseAmount || 0),
        ),
        after: E("nebulaGamoraAttackComplete", {
          nebulaGamoraSource: source,
          continuation: e.continuation,
          actorId: e.playerId,
        }),
      });
      break;
    }
    case "nebulaGamoraAttackComplete": {
      const source = e.nebulaGamoraSource as nebula.NebulaAttackSource;
      const after = [{ ...e.continuation, performed: !!e.performed }];
      if (!e.performed) {
        if (source.kind === "ally" && source.playerId)
          add(
            s,
            ...scarletPack.scarletWitchPackAfterAllyAttack(
              seatView(s, source.playerId),
              source.id,
              false,
            ),
            ...after,
          );
        else add(s, ...after);
        break;
      }
      if (source.kind === "ally") {
        const p = find(s, source.id),
          seat = controller(s, source.id);
        if (p && seat) {
          const view = seatView(s, seat);
          add(
            s,
            E("allyResponse", { id: p.id, attack: true, actorId: seat.id }),
            E("allyConsequence", {
              id: p.id,
              attack: true,
              actorId: seat.id,
              amount:
                (card(p).attack_cost || 0) +
                captainPackModifiers(view, p.id).consequentialAttack,
            }),
            E("scarletAfterAllyAttack", { id: p.id, actorId: seat.id }),
            ...after,
          );
          break;
        }
      } else if (source.kind === "hero") {
        add(
          s,
          E("heroAttackResponses", {
            actorId: source.playerId,
            target: `hero:${e.attackedPlayerId || s.activePlayerId}`,
            wasMinion: false,
            excessDamage: 0,
          }),
          ...after,
        );
        break;
      }
      add(s, ...after);
      break;
    }
    case "enemyAttackInitiationWindow": {
      if (!e.mutantGenesisInitiationHandled) {
        add(
          s,
          E("mutantGenesisInitiatedWindow", {
            after: [{ ...e, mutantGenesisInitiationHandled: true }],
          }),
        );
        break;
      }
      const a = s.attack;
      if (!a || a.attacker !== e.attacker) break;
      const attacker = nebulaNativeAttacker(s, a.attacker);
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
      const friendlySource =
        nebulaAttackSource(s)?.kind === "hero" ||
        nebulaAttackSource(s)?.kind === "ally";
      for (const seat of playerOrder(s)) {
        const view = seatView(s, seat);
        const nova = (
          friendlySource
            ? []
            : msMarvelAttackInitiatedOptions(view, attacker, [], msPorts)
        )
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
          againstPlayer && !friendlySource
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
        const firstHit =
          a.isVillain || friendlySource
            ? []
            : gamoraPack.gamoraPackFirstHitOptions(
                view,
                attacker,
                [packet],
                gamoraPackPorts,
              );
        const subdue = friendlySource
          ? []
          : draxPack.draxPackAttackInitiatedOptions(
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
        const shieldmaiden =
          againstPlayer &&
          !friendlySource &&
          (!a.angelTauntPlayerId || a.angelTauntPlayerId === seat.id)
            ? valkyrie
                .valkyrieAttackInitiationOptions(
                  view,
                  a.attacker,
                  [],
                  valkyriePorts,
                )
                .filter((entry) => !usedIds.includes(entry.id))
                .map((entry) => ({
                  ...entry,
                  effects: entry.effects.map((effect) => ({
                    ...effect,
                    after: [resume(entry.id)],
                  })),
                }))
            : [];
        const pip =
          againstPlayer && !a.angelTauntPlayerId
            ? warlock.warlockAttackInitiatedOptions(
                view,
                e.playerId,
                [packet],
                warlockPorts,
              )
            : [];
        options.push(
          ...scoped(seat.id, [
            ...gambit.gambitAttackOptions(view, []).map((entry) => ({
              ...entry,
              effects: entry.effects.map((effect) => ({
                ...effect,
                after: [resume(entry.id)],
              })),
            })),
            ...(!friendlySource
              ? x23
                  .x23DefenseOptions(view, [packet], x23Ports)
                  .filter((o) => !usedIds.includes(o.id))
              : []),
            ...nova,
            ...mockingbird,
            ...firstHit,
            ...subdue,
            ...identity,
            ...(againstPlayer && seat.id === e.playerId
              ? phoenix.phoenixReactionOptions(view, "attack", [], phoenixPorts)
              : []),
            ...shieldmaiden,
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
    case "angelAttackEnd":
      add(s, ...(e.after || []));
      break;
    case "enemyScheme":
      enemyScheme(
        s,
        e.id,
        e.extra,
        e.activation,
        !!e.colossusActivationHandled,
        e.colossusActivationReceipt,
      );
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
      if (e.id === "hero") {
        const packet = { ...e, amount: e.amount ?? heroStats(s).defense };
        const opts = domino.dominoBasicOptions(s, packet);
        if (opts.length) {
          choose(s, "Probability Field", "Boost this basic defense?", [
            ...opts,
            option("continue", "Continue", [
              { ...packet, dominoProbabilityHandled: true },
            ]),
          ]);
          break;
        }
      }
      if (e.id === "hero" && !e.psylockeBasicHandled) {
        const opts = psylocke.psylockeBasicOptions(s, e);
        if (opts.length) {
          choose(
            s,
            "Psi-Energy Control",
            "Flip one Psi-Energy upgrade before defending?",
            [
              ...opts,
              option("continue", "Continue without flipping", [
                { ...e, psylockeBasicHandled: true },
              ]),
            ],
          );
          break;
        }
      }
      if (s.attack) {
        need(
          !s.attack.angelTauntPlayerId ||
            (s.activePlayerId === s.attack.angelTauntPlayerId &&
              ["hero", "none"].includes(e.id)),
          "Taunt prevents other characters from defending.",
        );
        s.attack.defender = e.id;
        s.attack.targetPlayerId = s.activePlayerId;
        log(
          s,
          e.id === "none"
            ? `${heroCard(s).name} takes the attack undefended.`
            : `${e.id === "hero" ? heroCard(s).name : card(find(s, e.id)!).name} defends the attack.`,
        );
        if (e.id === "hero") {
          need(
            !magneto.magnetoIdentityRestricted(s, s.activePlayerId, {
              isTextBlank,
            }),
            "Wrapped in Metal prevents this identity from defending.",
          );
          s.attack.basicDefense = true;
          s.player.exhausted = true;
          s.attack.defenseBonus =
            (s.attack.defenseBonus || 0) +
            (e.amount === undefined ? 0 : e.amount - heroStats(s).defense);
          s.attack.defense =
            heroStats(s).defense +
            (s.attack.defenseBonus || 0) +
            valkyrie.valkyrieDefenseBonusForAttacker(s, s.attack.attacker);
        } else if (e.id !== "none") {
          const p = find(s, e.id);
          if (p) p.exhausted = true;
        }
        if (e.id !== "none" && e.id !== "hero")
          add(
            s,
            ...(sinisterPlayerPack.sinisterPlayerPackAllyDefenseInterrupt(
              s,
              e.id,
              s.attack.attacker,
              sinisterPlayerPackPorts,
            ) || []),
          );
        if (e.id === "hero") add(s, E("spectrumDefenseWindow", { used: [] }));
      }
      break;
    case "spectrumDefenseWindow": {
      const options = [
        ...gambit.gambitDefenseOptions(s, gambitPorts),
        ...spdr.spdrDefenseOptions(s, spdrPorts),
        ...spectrum.spectrumDefenseOptions(s, e.used || [], [], spectrumPorts),
        ...vision.visionDefenseOptions(s, e.used || [], [], visionPorts),
      ];
      if (options.length)
        choose(
          s,
          "Identity defense interrupts",
          "Play an interrupt when your identity defends?",
          [...options, option("continue", "Continue", [])],
        );
      break;
    }
    case "boostAttack": {
      const a = s.attack;
      if (!a) break;
      if (a.basicDefense && !e.angelAcrobaticsHandled) {
        const after = [{ ...e, angelAcrobaticsHandled: true }];
        const options = angel.angelBasicOptions(
          s,
          "hero",
          "defense",
          after,
          angelPorts,
        );
        if (options.length) {
          choose(s, "Soaring Acrobatics", "Boost this basic defense?", [
            ...options,
            option("continue", "Continue", after),
          ]);
          break;
        }
      }
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
          ...valkPack.valkyriePackDefenseOptions(
            s,
            [E("boostAttack")],
            valkyriePackPorts,
          ),
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
          ...rogue.rogueDefenseOptions(
            s,
            "defends",
            [E("boostAttack")],
            roguePorts,
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
      if (a.pendingBoosts && !a.pendingBoosts.length) {
        add(s, E("damageWindow"));
        break;
      }
      const facedown = a.pendingBoosts?.[0];
      if (facedown && e.visionPackDefianceChecked !== facedown.id) {
        const after = [{ ...e, visionPackDefianceChecked: facedown.id }];
        const options = visionPack.visionPackBoostOptions(
          s,
          facedown.id,
          after,
          visionPackPorts,
        );
        if (options.length) {
          choose(
            s,
            "Before revealing boost",
            "Discard the actual facedown boost with Defiance?",
            [...options, option("continue", "Reveal the boost", after)],
          );
          break;
        }
      }
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
      if (!e.scheme) options.push(...domino.dominoBoostOptions(s, e.piece));
      options.push(
        ...playerOrder(s).flatMap((seat) =>
          nebulaPack
            .nebulaPackBoostInterruptOptions(
              seatView(s, seat),
              e.piece,
              after.map((effect) => ({ ...effect, actorId: original })),
              nebulaPackPorts,
            )
            .map((o) => ({
              ...o,
              id: `${seat.id}:${o.id}`,
              effects: o.effects.map((effect) => ({
                ...effect,
                actorId: seat.id,
              })),
            })),
        ),
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
      if (!nebulaNativeAttacker(s, a.attacker)) {
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
      const redirect = s.flags[`phoenixMisdirection:${a.id}`];
      if (typeof redirect === "string") {
        delete s.flags[`phoenixMisdirection:${a.id}`];
        const amount = Math.max(0, a.base - a.defense - a.prevented);
        a.prevented += amount;
        add(
          s,
          E("damage", {
            target: redirect,
            amount,
            source: a.attacker,
            enemyAttack: true,
          }),
          { ...e },
        );
        break;
      }
      const damageTarget = enemyAttackDamageTarget(s, a);
      if (
        !e.deadpoolHandled &&
        ["hero", `hero:${s.activePlayerId}`].includes(damageTarget)
      ) {
        const opts = deadpool.deadpoolDamageOptions(
          s,
          {
            attack: true,
            target: "hero",
            amount: Math.max(0, a.base - a.defense - a.prevented),
            attackWindow: true,
            type: "damage",
          },
          [{ ...e, deadpoolHandled: true }],
          deadpoolPorts,
        );
        if (opts.length) {
          choose(s, "Attack damage", "Prevent damage with Barely a Scratch?", [
            ...opts,
            option("allow", "Continue attack", [
              { ...e, deadpoolHandled: true },
            ]),
          ]);
          break;
        }
      }
      const shield = phoenix.phoenixForcedDamage(
        s,
        {
          ...e,
          target: damageTarget,
          kind: "attack",
          amount: Math.max(0, a.base - a.defense - a.prevented),
        },
        phoenixPorts,
      );
      if (shield) {
        add(s, ...shield);
        break;
      }
      const kellyReplacement =
        damageTarget === sabretooth.sabretoothKelly(s)?.id &&
        (!a.defender || a.defender === "none");
      const heroTarget = damageTarget === "hero";
      if (damageProhibition(s, damageTarget, false)) {
        a.preventAllDamage = true;
        add(s, E("finishAttack"));
        break;
      }
      const attackingPiece = nebulaNativeAttacker(s, a.attacker);
      if (attackingPiece) {
        const before =
          damageTarget === "hero"
            ? s.player.hp
            : find(s, damageTarget)
              ? pieceHP(s, find(s, damageTarget)!) -
                find(s, damageTarget)!.damage
              : 0;
        const replacement =
          ironspider.ironspiderSinisterAttackDamageReplacement(
            s,
            attackingPiece,
            Math.max(0, a.base - a.defense - a.prevented),
            E("ironspiderAttackComplete", {
              attack: a,
              target: damageTarget,
              before,
              recipientId: s.activePlayerId,
            }),
          );
        if (replacement) {
          add(s, ...replacement);
          break;
        }
      }

      if (!heroTarget && !a.visionPackManchaHandled) {
        const recipient = find(s, damageTarget);
        if (recipient)
          a.prevented += Math.min(
            Math.max(0, a.base - a.defense - a.prevented),
            visionPack.visionPackAttackDamageReduction(
              s,
              recipient,
              visionPackPorts,
            ),
          );
        a.visionPackManchaHandled = true;
      }
      if (heroTarget && !a.nebulaDamageHandled) {
        const prevented = Math.min(
          Math.max(0, a.base - a.defense - a.prevented),
          nebula.nebulaAttackDamageReduction(s) +
            vision.visionAttackDamageReduction(s) +
            niPack.novaIronheartPackAttackDamageReduction(
              s,
              "hero",
              niPackPorts,
            ),
        );
        a.prevented += prevented;
        a.nebulaDamageHandled = true;
        if (prevented)
          log(
            s,
            `Continuous effects prevent ${prevented} attack damage.`,
            "good",
          );
      }
      const receiving = heroTarget ? s.player : find(s, damageTarget);
      const incoming = a.preventAllDamage
        ? 0
        : Math.max(0, a.base - a.defense - a.prevented);
      mutantGenesisIncomingPiercing(s, damageTarget, incoming);
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
        !kellyReplacement &&
        (a.overkill || !!sourceKeyword(s, a.attacker, "Overkill")) &&
        !a.nebulaOverkillHandled
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
        const prevented = Math.min(
          excess,
          nebula.nebulaAttackDamageReduction(s) +
            vision.visionAttackDamageReduction(s) +
            niPack.novaIronheartPackAttackDamageReduction(
              s,
              "hero",
              niPackPorts,
            ),
        );
        a.identityPrevented = (a.identityPrevented || 0) + prevented;
        a.nebulaOverkillHandled = true;
        if (prevented)
          log(
            s,
            `Continuous effects prevent ${prevented} overkill damage.`,
            "good",
          );
      }
      if (
        !heroTarget &&
        !a.originalTarget &&
        !kellyReplacement &&
        (a.overkill || !!sourceKeyword(s, a.attacker, "Overkill")) &&
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
      if (heroTarget) {
        const forced = spdrPack.spdrPackForcedDamage(
          s,
          {
            ...e,
            type: "damageWindow",
            target: "hero",
            kind: "attack",
            amount: Math.max(0, a.base - a.defense - a.prevented),
          },
          spdrPackPorts,
        );
        if (forced) {
          add(s, ...forced);
          break;
        }
      } else if (
        !kellyReplacement &&
        (a.overkill || sourceKeyword(s, a.attacker, "Overkill"))
      ) {
        const ally = find(s, damageTarget);
        const amount =
          ally && !ally.tough
            ? Math.max(
                0,
                a.base -
                  a.defense -
                  a.prevented -
                  (pieceHP(s, ally) - ally.damage) -
                  Number(a.identityPrevented || 0),
              )
            : 0;
        const forced = spdrPack.spdrPackForcedDamage(
          s,
          {
            ...e,
            type: "damageWindow",
            target: "hero",
            kind: "overkill",
            amount,
          },
          spdrPackPorts,
        );
        if (forced) {
          add(s, ...forced);
          break;
        }
      }
      const opts = [
        ...(heroTarget
          ? psylocke.psylockeDamageOptions(
              s,
              {
                type: "attackDamage",
                target: "hero",
                amount: Math.max(0, a.base - a.defense - a.prevented),
                kind: "attack",
                attacker: a.attacker,
              },
              [E("damageWindow")],
              psylockePorts,
            )
          : []),
        ...(!(heroTarget ? s.player.tough : find(s, damageTarget)?.tough)
          ? niNativeDamageOptions(
              s,
              {
                type: "attackDamage",
                kind: "attack",
                target: heroTarget ? "hero" : damageTarget,
                attack: true,
                amount: Math.max(0, a.base - a.defense - a.prevented),
              },
              [E("damageWindow")],
            )
          : []),
        option(
          "resolve",
          `Resolve ${Math.max(0, a.base - a.defense - a.prevented)} damage`,
          [E("finishAttack")],
        ),
      ];
      if (!(heroTarget ? s.player.tough : find(s, damageTarget)?.tough))
        opts.unshift(
          ...visionPackNativeDamageOptions(
            s,
            {
              type: "attackDamage",
              kind: "attack",
              target: heroTarget ? "hero" : damageTarget,
              attack: true,
              amount: Math.max(0, a.base - a.defense - a.prevented),
              attacker: a.attacker,
            },
            [E("damageWindow")],
          ),
        );
      if (!receiving?.tough)
        opts.unshift(
          ...mutantGenesisDamageOptions(
            s,
            damageTarget,
            Math.max(0, a.base - a.defense - a.prevented),
            [E("damageWindow", { actorId: a.targetPlayerId })],
          ),
        );
      if (
        !heroTarget &&
        !receiving?.tough &&
        !kellyReplacement &&
        (a.overkill || sourceKeyword(s, a.attacker, "Overkill"))
      ) {
        const ally = find(s, damageTarget);
        const excess = ally
          ? Math.max(
              0,
              a.base -
                a.defense -
                a.prevented -
                (pieceHP(s, ally) - ally.damage) -
                Number(a.identityPrevented || 0),
            )
          : 0;
        const packet = {
          type: "attackDamage",
          kind: "overkill",
          target: `hero:${s.activePlayerId}`,
          amount: excess,
          attack: true,
          attacker: a.attacker,
          damageWindowId: a.id,
        };
        if (excess > 0)
          opts.unshift(
            ...psylocke.psylockeDamageOptions(
              s,
              packet,
              [E("damageWindow")],
              psylockePorts,
            ),
            ...playerOrder(s).flatMap((seat) =>
              mgPack
                .mutantGenesisPlayerPackDamageOptions(
                  seatView(s, seat),
                  packet,
                  [E("damageWindow", { actorId: a.targetPlayerId })],
                  mutantGenesisPackPorts,
                )
                .map((o) => ({
                  ...o,
                  id: `${seat.id}:${o.id}`,
                  effects: o.effects.map((e) => ({ ...e, actorId: seat.id })),
                })),
            ),
          );
      }
      const shieldTarget = damageTarget;
      if (!(heroTarget ? s.player.tough : find(s, shieldTarget)?.tough))
        opts.unshift(
          ...warmPackDamageOptions(
            s,
            {
              type: "attackDamage",
              kind: "attack",
              target: heroTarget ? "hero" : shieldTarget,
              attack: true,
              amount: Math.max(0, a.base - a.defense - a.prevented),
              attacker: a.attacker,
            },
            [E("damageWindow")],
          ),
        );
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
      if (
        !heroTarget &&
        !kellyReplacement &&
        (a.overkill || !!sourceKeyword(s, a.attacker, "Overkill"))
      ) {
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
            ...niNativeDamageOptions(
              s,
              {
                type: "attackDamage",
                kind: "overkill",
                target: "hero",
                attack: true,
                amount: excess,
              },
              [E("damageWindow")],
            ),
          );
        if (!s.player.tough)
          opts.unshift(
            ...warmPackDamageOptions(
              s,
              {
                type: "attackDamage",
                kind: "overkill",
                target: "hero",
                attack: true,
                amount: excess,
                attacker: a.attacker,
              },
              [E("damageWindow")],
            ),
          );
        if (!s.player.tough)
          opts.unshift(
            ...visionPackNativeDamageOptions(
              s,
              {
                type: "attackDamage",
                kind: "overkill",
                target: "hero",
                attack: true,
                amount: excess,
                attacker: a.attacker,
              },
              [E("damageWindow")],
            ),
          );
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
        const back = defenseEventSources(s).find(
          (p) => rulesCode(p) === "01003",
        );
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
        if (
          flight &&
          s.player.form === "hero" &&
          !magneto.magnetoIdentityRestricted(s, s.activePlayerId, {
            isTextBlank,
          })
        )
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
        if (
          (!s.attack.defender || s.attack.defender === "none") &&
          !armadillo.armadilloDefenseBlocked(s, s.attack.attacker)
        ) {
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
      if (!e.psylockeHandled) {
        add(s, ...psylocke.psylockeDefenseFinished(s, e), {
          ...e,
          psylockeHandled: true,
        });
        break;
      }
      if (!e.gambitAfterHandled) {
        add(s, ...gambit.gambitDefenseAfter(s, e), {
          ...e,
          gambitAfterHandled: true,
        });
        break;
      }
      if (!e.cableHandled) {
        add(
          s,
          ...cable.cableDefenseResponses(s, e.snapshot || {}, cablePorts),
          { ...e, cableHandled: true },
        );
        break;
      }
      if (!e.angelHandled) {
        add(
          s,
          ...angel.angelDefenseResponses(s, e.snapshot || {}, angelPorts),
          { ...e, angelHandled: true },
        );
        break;
      }
      if (!e.rogueAfterHandled) {
        add(s, ...rogue.rogueAfterAttack(s, e.snapshot || {}), {
          ...e,
          rogueAfterHandled: true,
        });
        break;
      }
      if (!e.shadowcatCompletionHandled && e.snapshot?.heroDefended) {
        const completion = shadowcatNativeCompletion(s, "defense", true);
        const receipt = completion[0]?.receipt as
          shadowcat.ShadowcatCompletionReceipt | undefined;
        if (receipt?.massForm === "solid") {
          e.shadowcatCompletionHandled = true;
          e.shadowcatSolidCompletionReceipt = receipt;
        } else {
          add(s, ...completion, {
            ...e,
            shadowcatCompletionHandled: true,
          });
          break;
        }
      }
      if (e.snapshot?.defender && !e.stormHangarHandled) {
        const ally = find(s, e.snapshot.defender);
        if (ally && card(ally).type_code === "ally") {
          add(s, ...storm.stormHangar(s, ally), {
            ...e,
            stormHangarHandled: true,
          });
          break;
        }
      }
      if (e.snapshot?.defender && !e.spdrDefendedHandled) {
        const ally = find(s, e.snapshot.defender);
        if (ally)
          add(
            s,
            ...spdrPack.spdrPackAllyDefended(
              s,
              ally,
              e.attacker,
              spdrPackPorts,
            ),
            { ...e, spdrDefendedHandled: true },
          );
        if (ally) break;
      }
      if (e.snapshot?.basicDefense && !e.novaBasicHandled) {
        add(
          s,
          ...nova.novaAfterBasicPower(
            s,
            {
              token: `basic:${s.nextId++}`,
              playerId: e.snapshot.playerId,
              power: "defense",
              performed: true,
              wasHero: true,
            },
            novaPorts,
          ),
          { ...e, novaBasicHandled: true },
        );
        break;
      }
      if (e.snapshot?.basicDefense && !e.ghostBasicReceipt)
        e.ghostBasicReceipt = {
          token: `basic:${s.nextId++}`,
          playerId: e.snapshot.playerId,
          power: "defense",
          performed: true,
          wasHero: true,
        };
      if (e.snapshot?.basicDefense && !e.milesBasicReceipt)
        e.milesBasicReceipt = {
          token: `basic:${s.nextId++}`,
          playerId: e.snapshot.playerId,
          power: "defense",
          performed: true,
          wasHero: true,
        };
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
          ...(e.snapshot?.basicDefense ? x23.x23BasicUsed(s, "defense") : []),
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
      const ghostOptions = e.ghostBasicReceipt
        ? ghostSpider.ghostSpiderBasicPowerOptions(
            s,
            e.ghostBasicReceipt,
            [e],
            ghostSpiderPorts,
          )
        : [];
      const milesOptions = e.milesBasicReceipt
        ? miles.milesBasicPowerOptions(s, e.milesBasicReceipt, [e], milesPorts)
        : [];
      const sabretoothOptions = e.snapshot?.attackId
        ? sabretooth.sabretoothHeroDefended(
            s,
            {
              attackId: e.snapshot.attackId,
              enemyId: e.snapshot.attacker,
              enemyCode: e.snapshot.enemyCode || e.snapshot.attackerCode || "",
              playerId: e.snapshot.playerId,
              heroDefended: !!e.snapshot.heroDefended,
            },
            sabretoothPorts,
          )
        : [];
      if (
        !e.defended &&
        !packOptions.length &&
        !bwOptions.length &&
        !gamoraOptions.length &&
        !draxOptions.length &&
        !milesOptions.length &&
        !sabretoothOptions.length &&
        !ghostOptions.length
      )
        break;
      const ind = s.player.inPlay.find((p) => rulesCode(p) === "01082");
      const counter = eventPlaySources(s).find((p) => rulesCode(p) === "01077");
      const opts = [
        option("pass", "Continue", []),
        ...(e.shadowcatSolidCompletionReceipt
          ? shadowcat.shadowcatAttackDefenseOptions(
              s,
              e.shadowcatSolidCompletionReceipt,
              [{ ...e }],
              shadowcatPorts,
            )
          : []),
        ...bwOptions,
        ...gamoraOptions,
        ...draxOptions,
        ...milesOptions,
        ...ghostOptions,
        ...sabretoothOptions.map((o) => ({
          ...o,
          effects: [...o.effects, { ...e }],
        })),
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
      if (p) add(s, E("reveal", { piece: p, fromEncounterDeck: true }));
      break;
    }
    case "reveal": {
      if (s.flags[`spiderHamCanceledReveal:${e.piece.id}`]) {
        delete s.flags[`spiderHamCanceledReveal:${e.piece.id}`];
        break;
      }
      if (!e.skip && !e.spdrWouldHandled) {
        beginResolution(s, e.piece);
        const after = [{ ...e, spdrWouldHandled: true }];
        const receipt = {
          token: `spdr-reveal:${s.nextId++}`,
          playerId: s.activePlayerId,
          pieceId: e.piece.id,
        };
        const options = spdrPack.spdrPackEncounterRevealOptions(
          s,
          receipt,
          after,
          spdrPackPorts,
        );
        if (options.length) {
          choose(
            s,
            "Encounter reveal interrupts",
            "Use Spider-Tingle before looking at the encounter?",
            [...options, option("continue", "Continue", after)],
          );
          break;
        }
      }
      if (!e.skip && !e.spiderHamWouldHandled) {
        beginResolution(s, e.piece);
        const after = [{ ...e, spiderHamWouldHandled: true }];
        const options = spiderHamPack.spiderHamPackEncounterRevealOptions(
          s,
          {
            token: `would-reveal:${s.nextId++}`,
            playerId: s.activePlayerId,
            pieceId: e.piece.id,
          },
          after,
          spiderHamPackPorts,
        );
        if (options.length) {
          choose(
            s,
            "Encounter reveal interrupts",
            "Name the pending encounter card's type before looking at it?",
            [...options, option("continue", "Continue", after)],
          );
          break;
        }
      }
      reveal(s, e.piece, e.skip, false, !!e.fromEncounterDeck, e.knifeSurge);
      break;
    }
    case "spiderHamAttackDamageComplete":
      finishAttackAfterDamage(s, e.target, e.before, e.recipientId);
      break;
    case "ironspiderAttackComplete": {
      const a = e.attack as NonNullable<GameState["attack"]>;
      a.attackDamageReceipts = e.damageReceipts || [];
      const actualTarget =
        e.target === "hero" ? `hero:${e.recipientId}` : e.target;
      a.damage = a
        .attackDamageReceipts!.filter(
          (receipt) => receipt.target === actualTarget,
        )
        .reduce((amount, receipt) => amount + receipt.actualDamage, 0);
      a.damagePlaced = e.damageTaken || 0;
      a.identityDamage = e.identityDamageTaken || 0;
      s.enemyAttackCounts ||= {};
      s.enemyAttackCounts[a.attacker] =
        Number(s.enemyAttackCounts[a.attacker] || 0) + 1;
      a.completionRecorded = true;
      finishAttackAfterDamage(s, e.target, e.before, e.recipientId, a);
      break;
    }
    case "mtsPackCommittedPayment":
      s.flags[`mtsPackPaymentCostPaid:${e.pieceId}`] = true;
      add(s, ...(e.spentResponses || []), ...(e.after || []));
      break;
    case "spdrCommittedPayment": {
      const key = `spdrThwipDamageResponses:${e.pieceId}`;
      const optional = JSON.parse(String(s.flags[key] || "[]")) as Effect[];
      delete s.flags[key];
      delete s.flags.spdrThwipPaymentCost;
      s.flags[`spdrThwipPaymentCostPaid:${e.pieceId}`] = true;
      // Forced generation responses precede the optional responses to the
      // committed cost. The paid card's effect remains the final continuation.
      const responses = e.spentResponses as Effect[];
      add(
        s,
        ...responses.filter(
          (q) => q.type !== "optional" && q.mandatory !== false,
        ),
        ...optional,
        ...responses.filter(
          (q) => q.type === "optional" || q.mandatory === false,
        ),
        ...(e.after || []),
      );
      break;
    }
    case "spdrDistributedThwart":
      if (e.wasp) waspPorts.thwartDistribution(s, e.packets, e.metadata);
      else swPorts.thwartDistribution(s, e.packets);
      break;
    case "spdrPaymentResume":
      s.flags[`spdrClarityCommitted:${e.committedId}`] = true;
      s.prompt = e.payment;
      s.prompt!.committedResources = [
        ...(s.prompt!.committedResources || []),
        e.committedSource,
      ];
      s.prompt!.cancelable = false;
      pay(s, e.ids, e.wildAs, e.paidForCard, e.generatedForCard, e.syncPaid);
      break;
    case "spdrTreacheryResolved":
      if (e.receipt.whenRevealedResolved)
        add(s, ...psylocke.psylockeTreacheryResolved(s, e.receipt.playerId));
      add(
        s,
        ...spdrPack.spdrPackTreacheryResolved(s, e.receipt, spdrPackPorts),
      );
      break;
    case "spdrContinue":
      add(s, ...(e.after || []));
      break;
    case "spiderHamContinue":
      add(s, ...(e.after || []));
      break;
    case "spiderHamAllyThwartResponses":
      // Actual removal interrupts and scheme defeats finish before an ally's
      // response. Recheck Lady Spider's targets here: Overwatch can have
      // already defeated her only other scheme during its interrupt.
      add(
        s,
        ...spiderHamPack.spiderHamPackAllyThwarted(
          s,
          e.receipt,
          spiderHamPackPorts,
        ),
      );
      break;
    case "spiderHamSchemeThwartInterrupts":
      // Earlier interrupts in a simultaneous thwart may have defeated a
      // different attached scheme. Offer only sources still in play now.
      add(
        s,
        ...spiderHamPack.spiderHamPackSchemeThwarting(
          s,
          e.receipt,
          spiderHamPackPorts,
        ),
      );
      break;
    case "spiderHamRevealCommit":
      s.flags[`spiderHamPaidReveal:${e.piece.id}`] = JSON.stringify({
        receipt: e.receipt,
        after: e.after || [],
      });
      play(
        s,
        e.piece,
        e.paid || [],
        undefined,
        undefined,
        undefined,
        false,
        e.overpaid || 0,
        e.paidForCard,
        false,
        e.generatedForCard,
      );
      break;
    case "spiderHamThwartBatch": {
      if (
        !e.spdrThwartCostPaid &&
        e.targets.some(
          (target: { id: string; amount: number }) =>
            target.amount > 0 &&
            s.sideSchemes.some(
              (p) =>
                p.id === target.id && p.code === "31026" && !isTextBlank(s, p),
            ),
        )
      ) {
        requestPayment(
          s,
          "Giant Monster Attack · additional thwart cost",
          1,
          [{ ...e, spdrThwartCostPaid: true }],
          ["energy"],
          undefined,
          false,
        );
        break;
      }
      const before = new Set(s.queue);
      const receipts: spiderHamPack.SpiderHamPackThwartReceipt[] = [];
      s.flags.additionalThwartPacket = true;
      for (const t of e.targets) {
        if (
          !targets(s, "scheme", false, true).some((x) => x.id === t.id) ||
          !(s.sideSchemes.find((p) => p.id === t.id)?.counters || 0)
        )
          continue;
        const removed = thwart(s, t.id, t.amount, true, e.sourceId);
        if (removed > 0)
          receipts.push({
            token: `${e.token}:${t.id}`,
            playerId: s.activePlayerId,
            sourceId: e.sourceId,
            target: t.id,
            amount: removed,
            performed: true,
            thwart: true,
          });
      }
      delete s.flags.additionalThwartPacket;
      const generated = s.queue
        .filter((q) => !before.has(q))
        .map((q) =>
          q.type === "defeatScheme"
            ? { ...q, spiderHamBatchToken: e.token }
            : q,
        );
      s.queue = s.queue.filter((q) => before.has(q));
      add(
        s,
        ...receipts.map((receipt) =>
          E("spiderHamSchemeThwartInterrupts", { receipt }),
        ),
        ...generated,
        E("spiderHamBatchReceipt", { token: e.token, after: e.after }),
      );
      break;
    }
    case "spiderHamBatchReceipt": {
      const flags = seatView(s, e.actorId || s.activePlayerId).flags;
      const defeatedIds = String(
        flags[`spiderHamBatchDefeated:${e.token}`] || "",
      )
        .split(",")
        .filter(Boolean);
      delete flags[`spiderHamBatchDefeated:${e.token}`];
      add(s, ...(e.after || []).map((q: Effect) => ({ ...q, defeatedIds })));
      break;
    }
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
        if (e.reveal)
          add(s, E("reveal", { piece: found, fromEncounterDeck: foundInDeck }));
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
          } else add(s, E("reveal", { piece: p, fromEncounterDeck: true }));
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
          !isPermanent(card(p)) &&
          valkyrie.valkyrieCanDiscardAttachment(s, p) &&
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
          (s.player.form === "alter" || canChangeIdentityForm(s, "alter")),
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
      if (
        s.difficulty === "expert" &&
        ![
          "mutagen_formula",
          "project_wideawake",
          "mansion_attack",
          "magneto",
        ].includes(s.villainId)
      )
        villainSetup(s);
      break;
    case "wolverinePlayerPhase":
      add(
        s,
        ...playerOrder(s).flatMap((seat) =>
          deadpool
            .deadpoolPhaseBegan(seatView(s, seat))
            .map((e) => ({ ...e, actorId: seat.id })),
        ),
      );
      add(
        s,
        ...playerOrder(s).flatMap((seat) =>
          rogue
            .roguePhaseBegan(seatView(s, seat))
            .map((e) => ({ ...e, actorId: seat.id })),
        ),
        ...playerOrder(s).flatMap((seat) =>
          wolverine
            .wolverinePhaseBegan(seatView(s, seat), wolverinePorts)
            .map((e) => ({ ...e, actorId: seat.id })),
        ),
      );
      break;
    case "beginTurn":
      add(s, ...mgPack.mutantGenesisPlayerPackTurnBegan(s, { isTextBlank }));
      add(s, ...niPack.novaIronheartPackTurnBegan(s, s.activePlayerId));
      s.turnPlayerId = s.activePlayerId;
      log(s, `${heroCard(s).name} takes their turn.`, "phase");
      add(s, ...captainPackTurnStart(s));
      add(s, ...nebula.nebulaTurnBegan(s, s.turnPlayerId, nebulaPorts));
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
      if (!e.deadpoolEnded) {
        const effects = deadpool.deadpoolPhaseEnded(s);
        if (effects.length) {
          add(s, ...effects, { ...e, deadpoolEnded: true });
          break;
        }
      }
      if (!e.stormEnded) {
        const effects = storm.stormPhaseEnded(s);
        if (effects.length) {
          add(s, ...effects, { ...e, stormEnded: true });
          break;
        }
      }
      hawkeyePhaseEnded(s, hawkeyePorts);
      antMan.antManPhaseEnded(s);
      add(s, ...eachPlayer(s, E("refill")));
      break;
    case "refill":
      if (!e.mystiqueRefillResuming) {
        doctorStrangePhaseEnded(s);
        msMarvelPhaseEnded(s);
        captainPhaseEnded(s);
        captainPackPhaseEnded(s);
      }
      // Encounter cards dealt by deck exhaustion can increase Star-Lord's
      // Helmet hand size during this refill. Recheck after each actual draw.
      if (
        mystiqueNativeDrawToHandSize(s, { ...e, mystiqueRefillResuming: true })
      )
        break;
      antPack.antManPackPhaseEnded(s);
      for (const p of [...s.player.inPlay, ...controlledNPCs(s)]) {
        if (nova.novaCanReadyPiece(s, p, { isTextBlank })) p.exhausted = false;
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
      if (!e.wideawakePlayerPhaseEnded) {
        const effects = wideawake.projectWideawakeEndPlayerPhase(s);
        if (effects.length) {
          add(s, ...effects, { ...e, wideawakePlayerPhaseEnded: true });
          break;
        }
      }
      niPack.novaIronheartPackPhaseEnded(s);
      spiderHam.spiderHamPhaseEnded(s);
      spiderHamPack.spiderHamPackPhaseEnded(s);
      warmPack.warMachinePackPhaseEnded(s, warMachinePackPorts);
      warMachine.warMachinePhaseEnded(s);
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
        E("villainPhaseForcedInterrupts", {
          remaining: [
            ...inheritors.inheritorsVillainPhaseInterrupts(s),
            ...(s.environments || [])
              .filter((p) => p.code === "29039" && !isTextBlank(s, p))
              .map((p) =>
                E("zzzax:static-source", {
                  id: p.id,
                  actorId: s.firstPlayerId,
                }),
              ),
          ],
          actorId: s.firstPlayerId,
        }),
        ...groot.grootVillainPhaseBegin(s, grootPorts),
        ...ghostSpider.ghostSpiderVillainPhaseBegins(s, ghostSpiderPorts),
        ...gamora.gamoraVillainPhaseBegin(s, gamoraPorts),
        E("villainStepOne"),
        ...eachPlayer(s, E("villainActivate")),
        E("dealEncounters"),
        E("newRound"),
      );
      break;
    case "villainPhaseForcedInterrupts": {
      const remaining = (e.remaining as Effect[])
        .filter((effect) => {
          const p = find(s, effect.id);
          return !!p && !isTextBlank(s, p);
        })
        .map((effect): Effect => ({ ...effect, actorId: s.firstPlayerId }));
      if (remaining.length === 1) add(s, remaining[0]);
      else if (remaining.length > 1)
        choose(
          s,
          "Villain phase · forced interrupt order",
          "Choose the next effect to resolve.",
          remaining.map((effect, index) => ({
            id: effect.id,
            label: card(find(s, effect.id)!).name,
            image: find(s, effect.id)!.code,
            effects: [
              effect,
              {
                ...e,
                remaining: remaining.filter((_, i) => i !== index),
                actorId: s.firstPlayerId,
              },
            ],
          })),
        );
      break;
    }
    case "villainStepOne":
      log(
        s,
        `Place ${escalation(s)} threat for ${s.playerCount} starting hero(es), plus ${s.encounter.acceleration + inheritorsAcceleration(s) + s.sideSchemes.reduce((n, p) => n + (card(p).scheme_acceleration || 0) + ironheart.ironheartSchemeIcons(s, p, { isTextBlank }).acceleration + Number(p.accelerationTokens || 0), 0)} acceleration.`,
        "bad",
      );
      add(
        s,
        E("threat", {
          target: "main",
          amount:
            escalation(s) +
            s.encounter.acceleration +
            inheritorsAcceleration(s) +
            angel.angelAcceleration(s) +
            s.attachments.filter(
              (p) => p.code === "40031" && !isTextBlank(s, p),
            ).length +
            deadpool.deadpoolPlayerIcons(s, "scheme_acceleration") +
            s.sideSchemes.reduce(
              (n, p) =>
                n +
                (card(p).scheme_acceleration || 0) +
                ironheart.ironheartSchemeIcons(s, p, { isTextBlank })
                  .acceleration +
                Number(p.accelerationTokens || 0),
              0,
            ),
        }),
        ...(rulesCode(s.scheme) === "01138b"
          ? eachPlayer(s, E("ultronChoice", { amount: 2 }))
          : []),
        ...sabretooth.sabretoothVillainPhaseStepOne(s),
      );
      break;
    case "villainActivate": {
      s.villainStep = "activation";
      if (!e.colossusActivationHandled) {
        const kind = s.player.form === "hero" ? "attack" : "scheme";
        const replaced =
          kind === "attack" ? s.villain.stunned : s.villain.confused;
        if (
          !replaced &&
          colossusNativeActivationWindow(s, s.villain.id, kind, {
            ...e,
            type: "villainActivate",
          })
        )
          break;
      } else if (e.colossusActivationReceipt) {
        const receipt =
          e.colossusActivationReceipt as colossus.ColossusActivationReceipt;
        delete seatView(s, receipt.playerId).flags[
          `colossusActivation:${receipt.token}`
        ];
      }
      add(
        s,
        E(s.player.form === "hero" ? "enemyAttack" : "enemyScheme", {
          id: s.villain.id,
          colossusActivationHandled: true,
        }),
        E("minionActivations"),
      );
      break;
    }
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
        allInPlay(s).filter((p) => p.code === "37025" && !isTextBlank(s, p))
          .length +
        angel.angelHazards(s) +
        deadpool.deadpoolPlayerIcons(s, "scheme_hazard") +
        sinisterPlayerPack.sinisterPlayerPackHazards(s) +
        (card(s.scheme.code).scheme_hazard || 0) +
        s.sideSchemes.reduce(
          (n, p) =>
            n +
            (card(p).scheme_hazard || 0) +
            ironheart.ironheartSchemeIcons(s, p, { isTextBlank }).hazard,
          0,
        );
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
        add(s, E("reveal", { piece: p, fromEncounterDeck: true }));
      }
      break;
    }
    case "newRound": {
      if (!e.stormEnded) {
        const effects = storm.stormPhaseEnded(s);
        if (effects.length) {
          add(s, ...effects, { ...e, stormEnded: true });
          break;
        }
      }
      spdrPack.spdrPackRoundEnded(s);
      if (!e.ironheartEnded) {
        const ended = ironheart.ironheartVillainPhaseEnded(s, ironheartPorts);
        if (ended.length) {
          add(s, ...ended, { ...e, ironheartEnded: true });
          break;
        }
      }
      nova.novaRoundEnded(s);
      niPack.novaIronheartPackPhaseEnded(s);
      spiderHam.spiderHamPhaseEnded(s);
      spiderHamPack.spiderHamPackPhaseEnded(s);
      niPack.novaIronheartPackRoundEnded(s);
      if (!e.cyclopsRoundEnded) {
        const ending = cyclops.cyclopsRoundEnded(s);
        if (ending.length) {
          add(s, ...ending, { ...e, cyclopsRoundEnded: true });
          break;
        }
      }
      if (!e.mutantGenesisRoundEnded) {
        const ending = mgPack.mutantGenesisPlayerPackRoundEnded(s);
        if (ending.length) {
          add(s, ...ending, { ...e, mutantGenesisRoundEnded: true });
          break;
        }
      }
      syncValkyrieConvertedCards(s);
      syncVillainTextHealth(s);
      warMachine.warMachinePhaseEnded(s);
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
      nebulaPack.nebulaPackRoundEnded(s);
      warmPack.warMachinePackPhaseEnded(s, warMachinePackPorts);
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
        for (const p of [
          ...s.player.inPlay,
          ...s.minions.filter(
            (p) => p.treatedAsMinion && p.ownerId === seat.id,
          ),
        ].filter((p) => rulesCode(p) === "01084"))
          discardPiece(s, p.id);
        s.flags = {
          nemesis: s.flags.nemesis || false,
          ...Object.fromEntries(
            Object.entries(s.flags).filter(
              ([key]) =>
                key.startsWith("deadpool") ||
                key === "gambitCharges" ||
                key === "cyclopsNemesisInitialized" ||
                key.startsWith("stormController:") ||
                key === "stormInitialized" ||
                key === "angelInitialized" ||
                key === "cableInitialized" ||
                key === "x23Initialized" ||
                key === "stormSetupComplete" ||
                key.startsWith("valkyrie") ||
                key.startsWith("vision") ||
                key.startsWith("nova") ||
                key.startsWith("ironheart") ||
                key === "wolverineInitialized" ||
                key === "psylockeInitialized",
            ),
          ),
          ...(s.heroId === "warm"
            ? { warMachineAmmo: warMachine.warMachineAmmo(s) }
            : {}),
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
      sabretooth.sabretoothFirstPlayerChanged(s);
      wideawake.projectWideawakeFirstPlayerChanged(s, wideawakePorts);
      s.round++;
      s.phase = "player";
      s.villainStep = "newRound";
      s.attack = null;
      activateSeat(s, s.firstPlayerId);
      s.turnPlayerId = cyclops.cyclopsFirstTurn(s);
      activateSeat(s, s.turnPlayerId);
      log(
        s,
        `Round ${s.round} · ${heroCard(seatView(s, s.firstPlayerId)).name} holds the first-player token.`,
        "phase",
      );
      add(
        s,
        ...x23.x23PhaseStart(s),
        E("wolverinePlayerPhase"),
        ...nebula.nebulaTurnBegan(s, s.turnPlayerId, nebulaPorts),
        ...niPack.novaIronheartPackTurnBegan(s, s.turnPlayerId),
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
function syncMutantGenesisStatuses(s: GameState) {
  const previous = s.activePlayerId;
  for (const seat of playerOrder(s)) {
    if (seat.eliminated) continue;
    activateSeat(s, seat.id);
    shadowcat.shadowcatRefreshContinuousStatuses(s, shadowcatPorts);
    colossus.colossusEnforceToughLimit(s, colossusPorts);
  }
  activateSeat(s, previous);
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
    mystiqueNativeQueueHandEntries(s, mystiqueNativeObserveHands(s));
    const e = s.queue.shift()!;
    const actor = s.players.find(
      (p) => p.id === (e.actorId || s.activePlayerId),
    );
    const global =
      [
        "newRound",
        "spectrumBatchCommit",
        "zzzaxIndirectAfter",
        "ironspiderAttackComplete",
        "zzzaxDiscardCostCommit",
        "dealEncounters",
        "beginVillain",
        "villainPhaseForcedInterrupts",
        "villainStepOne",
        "nextMulligan",
        "vision:stun-after",
        "allReady",
        "finishResolution",
        "defeatScheme",
        "defeatSchemes",
        "encounterVictory",
        "playerSideSchemeLimit",
        "playerSideSchemeCheckDefeat",
        "playerSideSchemeReward",
        "playerSideSchemeFinishDefeat",
        "spiderHamBatchReceipt",
        "spiderHamSchemeThwartInterrupts",
        "spider-ham-pack:odds-after",
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
      ].includes(e.type) ||
      e.type.startsWith("sw:hydra") ||
      e.type.startsWith("sabretooth:") ||
      e.type.startsWith("sabretooth-native:") ||
      e.type.startsWith("wideawake:") ||
      e.type.startsWith("wideawake-native:") ||
      e.type.startsWith("mastermold:") ||
      e.type.startsWith("mastermold-native:") ||
      e.type.startsWith("zero-tolerance:") ||
      e.type.startsWith("sentinels:") ||
      e.type.startsWith("magneto:") ||
      e.type.startsWith("magneto-native:") ||
      e.type.startsWith("acolytes:") ||
      e.type.startsWith("acolytes-native:") ||
      e.type === "mystique-native:activation-finish";
    if (actor?.eliminated && !global) continue;
    activateSeat(
      s,
      [
        "reveal-window:text",
        "defeatScheme",
        "defeatSchemes",
        "spiderHamBatchReceipt",
      ].includes(e.type)
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
    syncNebulaIdentityStatuses(s);
    syncMutantGenesisStatuses(s);
    const mystiqueMovement = mystiqueNativeBeginMovement(s);
    resolve(s, e);
    mystiqueNativeFinishMovement(s, mystiqueMovement);
    syncValkyrieConvertedCards(s);
    syncNebulaIdentityStatuses(s);
    syncMutantGenesisStatuses(s);
    delete s.currentEventId;
    delete s.currentAttackProgramId;
    delete s.currentResponseGroup;
    delete s.currentResponseMandatory;
    delete s.currentRevealWindowId;
    check(s);
    spdr.spdrSyncIdentity(s);
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
  const mystiqueCommandMovement = mystiqueNativeBeginMovement(s);
  for (const seat of s.players)
    warMachine.warMachineInitializeNemesis(seatView(s, seat), {
      makePiece: (_view, code) => makePiece(s, code),
    });
  syncValkyrieConvertedCards(s);
  syncNebulaIdentityStatuses(s);
  syncMutantGenesisStatuses(s);
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
      mystiqueNativeFinishMovement(s, mystiqueCommandMovement);
      syncSeat(s);
      return s;
    }
    const before = boardSnapshot(s);
    if (command.type === "PROCEED") {
      need(s.review, "There is no action to acknowledge.");
      s.review = null;
      run(s);
      mystiqueNativeFinishMovement(s, mystiqueCommandMovement);
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
          hawkeyeStoredPlayable(s).find((p) => p.id === command.id) ||
          warmPack
            .warMachinePackStoredPlayable(s, warMachinePackPorts)
            .find((p) => p.id === command.id) ||
          visionPack
            .visionPackStoredPlayable(s, visionPackPorts)
            .find((p) => p.id === command.id) ||
          ghostSpider
            .ghostSpiderStoredPlayable(s, ghostSpiderPorts)
            .find((p) => p.id === command.id);
        need(p, "Card is not available to play.");
        const reason = playable(s, p!);
        need(!reason, reason || "");
        add(s, E("playRequest", { piece: p }));
      } else {
        s.flags.basicAttack = false;
        s.flags.heroKill = false;
        if (command.type === "FLIP") flip(s, true, command.target);
        else if (command.type === "BASIC") {
          if (command.action === "attack")
            need(
              cyclops.cyclopsCanAttack(s),
              "Lost Visor prevents Cyclops from attacking.",
            );
          need(!s.player.exhausted, "Your identity is exhausted.");
          need(
            !magneto.magnetoIdentityRestricted(s, s.activePlayerId, {
              isTextBlank,
            }),
            "Wrapped in Metal prevents basic attacks, thwarts, defenses and recoveries.",
          );
          if (command.action === "thwart")
            need(
              !captainThwartBlocked(s),
              "Baron Zemo prevents this identity from thwarting.",
            );
          const stats = heroStats(s);
          if (command.action === "recover") {
            need(s.player.form === "alter", "Recover in alter-ego form.");
            const deathFactor = wolverine.wolverineRecoverOptions(s, []);
            need(
              s.player.hp < maxHP(s) || deathFactor.length,
              "You are at full health.",
            );
            s.player.exhausted = true;
            if (deathFactor.length)
              choose(
                s,
                "Death Factor",
                "Discard an attachment instead of healing?",
                [
                  ...deathFactor,
                  option("heal", "Heal normally", [
                    E("heal", { target: "hero", amount: stats.recover }),
                  ]),
                ],
              );
            else {
              const packet = E("heal", {
                target: "hero",
                amount: stats.recover,
              });
              const opts = domino.dominoBasicOptions(s, packet);
              if (opts.length)
                choose(s, "Probability Field", "Boost this basic recovery?", [
                  ...opts,
                  option("continue", "Continue", [packet]),
                ]);
              else heal(s, "hero", stats.recover);
            }
            add(s, ...phoenix.phoenixRecovered(s), ...x23.x23Recovered(s));
            add(s, ...deadpool.deadpoolRecovered(s));
            add(
              s,
              ...spiderHam.spiderHamAfterBasicRecover(
                s,
                {
                  token: `recover:${s.nextId++}`,
                  playerId: s.activePlayerId,
                  performed: true,
                  wasAlter: true,
                },
                spiderHamPorts,
              ),
            );
          } else {
            need(s.player.form === "hero", "Change to hero form first.");
            if (command.action === "attack")
              need(
                !valkyrie.valkyrieCannotBasicAttack(s),
                "Seduced prevents basic attacks.",
              );
            if (command.action === "attack")
              need(
                vision.visionCanAttack(s),
                "Vision cannot attack in Intangible mass form.",
              );
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
              ...domino.dominoAbilityOptions(s, p.id, dominoPorts),
              ...wolverine.wolverineAbilityOptions(s, p.id, wolverinePorts),
              ...wideawake.projectWideawakeActionOptions(
                s,
                p.id,
                wideawakePorts,
              ),
              ...magneto.magnetoActionOptions(s, p.id, magnetoPorts),
              ...sentinels.sentinelsAbilityOptions(s, p.id, sentinelsPorts),
              ...sabretooth.sabretoothActionOptions(s, p.id, sabretoothPorts),
              ...zzzax.zzzaxActions(s, p, zzzaxPorts),
              ...hawkeyeAbilityOptions(s, p.id, hawkeyePorts),
              ...goblinModuleAttachmentActions(s, p),
              ...mutagenAttachmentActions(s, p),
              ...scarletWitch.scarletWitchAttachmentActions(s, p, scarletPorts),
              ...rocket.rocketAttachmentActions(s, p, rocketPorts),
              ...gamora.gamoraAttachmentActions(s, p, gamoraPorts),
              ...spectrum.spectrumAttachmentOptions(s, p.id, spectrumPorts),
              ...nebula.nebulaAttachmentActions(s, p, nebulaPorts),
              ...valkyrie.valkyrieAttachmentActions(s, p, valkyriePorts),
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
          } else {
            const source = find(s, command.id);
            const identity = ["identity", "hero"].includes(command.id);
            const affected =
              !["attack", "thwart"].includes(command.action || "") &&
              (identity ||
                (!!source &&
                  card(source).faction_code === "hero" &&
                  card(source).set_code === s.heroId));
            const before = s.queue.length;
            ability(s, command.id, command.action);
            if (affected && domino.dominoFeedback(s).length) {
              const generated = s.queue.splice(0, s.queue.length - before);
              add(s, ...generated, E("domino:feedback"));
            }
          }
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
          const wolverineTurnEnd = wolverine.wolverineTurnEnded(s);
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
          add(s, ...deadpool.deadpoolTurnEnded(s));
          add(s, ...hulkTurnEnds(s));
          if (s.player.inPlay.some((p) => p.code === "32099"))
            add(
              s,
              ...wideawake.projectWideawakeEndPlayerTurn(
                s,
                s.activePlayerId,
                `turn-end:${s.nextId++}`,
                { isTextBlank },
              ),
            );
          add(
            s,
            ...spectrum.spectrumTurnEnded(s, s.turnPlayerId, spectrumPorts),
          );
          add(s, ...wolverineTurnEnd, ...x23.x23TurnEnd(s));
        }
      }
    }
    mystiqueNativeFinishMovement(s, mystiqueCommandMovement);
    check(s);
    spdr.spdrSyncIdentity(s);
    syncSeat(s);
    recordReview(s, before, command);
    // A click on a choice/payment/basic power is already confirmation. Resolve
    // to the next real decision or result, carrying its receipt into that view.
    if (["CHOOSE", "SELECT"].includes(command.type) && before.prompt?.context)
      s.review = s.review
        ? mergeReviews(before.prompt.context, s.review)
        : before.prompt.context;
    run(s);
    spdr.spdrSyncIdentity(s);
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
    jocastaDefenseEvents: visionPack
      .visionPackStoredPlayable(s, visionPackPorts)
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: card(p).name,
        cost: cardCost(s, card(p), p),
        playable: !playable(s, p),
        disabled: playable(s, p) || undefined,
      })),
    quiverArrows: hawkeyeStoredPlayable(s).map((p) => ({
      id: p.id,
      code: p.code,
      name: card(p).name,
      cost: cardCost(s, card(p)),
      playable: playable(s, p) === null,
      disabled: playable(s, p) || undefined,
    })),
    attachedEvents: warmPack
      .warMachinePackStoredPlayable(s, warMachinePackPorts)
      .map((p) => ({
        id: p.id,
        code: p.code,
        name: card(p).name,
        cost: cardCost(s, card(p), p),
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
                  s.prompt.alliance,
                )
              : undefined,
        }
      : null,
    error: s.error,
    result: s.result,
  };
}
