/**
 * Short explanations of the core-set keywords and terms, written for a first
 * mission. They summarise the Rules Reference; the card text stays authoritative.
 */
export interface GlossaryEntry {
  term: string;
  /** Matches the keyword as printed on cards (case-insensitive). */
  pattern: RegExp;
  text: string;
}
export const GLOSSARY: GlossaryEntry[] = [
  {
    term: "Guard",
    pattern: /\bGuard\b/i,
    text: "While a Guard minion is engaged with you, you cannot attack the villain. Other effects can still deal damage to the villain.",
  },
  {
    term: "Tough",
    pattern: /\bTough(ness)?\b/i,
    text: "A Tough status card prevents the next instance of damage to that character, then is discarded. Toughness gives it when the card enters play.",
  },
  {
    term: "Stunned",
    pattern: /\bStun(ned)?\b/i,
    text: "A stunned character removes the status card instead of attacking the next time it would attack.",
  },
  {
    term: "Confused",
    pattern: /\bConfuse[d]?\b/i,
    text: "A confused character removes the status card instead of thwarting or scheming the next time it would.",
  },
  {
    term: "Surge",
    pattern: /\bSurge\b/i,
    text: "When revealed, deal yourself one more facedown encounter card. Reveal it after your earlier dealt cards during the villain phase.",
  },
  {
    term: "Quickstrike",
    pattern: /\bQuickstrike\b/i,
    text: "After this minion engages you, it attacks you if you are in hero form. Its When Revealed abilities resolve first.",
  },
  {
    term: "Retaliate",
    pattern: /\bRetaliate\b/i,
    text: "After a character with Retaliate X is attacked, it deals X damage to the attacker if it remains in play, even if the attack's damage was prevented.",
  },
  {
    term: "Overkill",
    pattern: /\bOverkill\b/i,
    text: "When an Overkill attack defeats a minion, excess damage goes to the villain. When it defeats an ally, excess damage goes to that ally controller's identity.",
  },
  {
    term: "Crisis",
    pattern: /\bcrisis\b/i,
    text: "While a side scheme with the crisis icon is in play, threat cannot be removed from the main scheme.",
  },
  {
    term: "Hazard",
    pattern: /\bhazard\b/i,
    text: "Each hazard icon in play deals one extra encounter card in the villain phase, to one player, in player order.",
  },
  {
    term: "Acceleration",
    pattern: /\bacceleration\b/i,
    text: "Each acceleration icon or token adds one threat to the main scheme every villain phase.",
  },
  {
    term: "Aerial",
    pattern: /\bAerial\b/i,
    text: "A trait some heroes gain or have; certain cards get stronger while your hero is Aerial.",
  },
  {
    term: "Villainous",
    pattern: /\bVillainous\b/i,
    text: "When this minion attacks or schemes, deal it a boost card as if it were the villain.",
  },
  {
    term: "Boost",
    pattern: /\bboost\b/i,
    text: "Facedown encounter cards dealt to a villain attack or scheme; each adds its boost icons, and a star means its boost ability also resolves.",
  },
  {
    term: "Setup",
    pattern: /\bSetup\b/i,
    text: "The Setup keyword puts a card into play during mission setup. A Setup ability gives mandatory instructions to resolve during setup.",
  },
  {
    term: "Forced Interrupt",
    pattern: /\bForced Interrupt\b/i,
    text: "Must be resolved just before the named event happens.",
  },
  {
    term: "Forced Response",
    pattern: /\bForced Response\b/i,
    text: "Must be resolved just after the named event happens.",
  },
  {
    term: "Interrupt",
    pattern: /\bInterrupt\b/i,
    text: "An optional ability you may use just before the named event happens.",
  },
  {
    term: "Response",
    pattern: /\bResponse\b/i,
    text: "An optional ability you may use just after the named event happens.",
  },
  {
    term: "Hero Action",
    pattern: /\bHero Action\b/i,
    text: "An action you can take only while in hero form.",
  },
  {
    term: "Alter-Ego Action",
    pattern: /\bAlter-Ego Action\b/i,
    text: "An action you can take only while in alter-ego form.",
  },
  {
    term: "Consequential damage",
    pattern: /\bconsequential damage\b/i,
    text: "After an ally attacks or thwarts, it takes damage equal to the small number next to that power.",
  },
  {
    term: "Hand size",
    pattern: /\bhand size\b/i,
    text: "At the end of the hero phase you draw up to this number (or discard down to it). Hero and alter-ego forms have different hand sizes.",
  },
  {
    term: "Recover",
    pattern: /\bRecover\b|\bREC\b/i,
    text: "The alter-ego basic power: exhaust your identity to heal this many hit points.",
  },
  {
    term: "Thwart",
    pattern: /\bThwart\b|\bTHW\b/i,
    text: "Remove threat from a scheme. Completing the final main scheme makes the heroes lose; earlier main schemes advance the scenario.",
  },
  {
    term: "Escalation",
    pattern: /\bescalation\b/i,
    text: "Threat the main scheme gains every villain phase, before any acceleration.",
  },
  {
    term: "Obligation",
    pattern: /\bObligation\b/i,
    text: "A card from your hero's set shuffled into the encounter deck; when revealed, it forces a hard choice on that hero.",
  },
  {
    term: "Nemesis",
    pattern: /\bNemesis\b/i,
    text: "Your hero's personal enemy. Shadows of the Past puts the nemesis minion and side scheme into play and shuffles the other nemesis cards into the encounter deck.",
  },
  {
    term: "Exhaust",
    pattern: /\bExhaust(?:ed)?\b/i,
    text: "Turn a card sideways when a cost or effect tells you to exhaust it. Player cards ready at the end of the hero phase, or through card effects.",
  },
  {
    term: "Uses",
    pattern: /\bUses\s*\(/i,
    text: "Place the stated counters on the card when it enters play. Its ability spends those counters; discard the card when the last counter is removed.",
  },
  {
    term: "Unique",
    pattern: /\bUnique\b/i,
    text: "Only one copy of a unique card can be in play at a time across all players.",
  },
];
/** The glossary entries that apply to a printed card text. */
export function keywordsIn(text: string | undefined) {
  if (!text) return [];
  const plainText = text.replace(/<[^>]*>/g, "");
  const optionalText = plainText.replace(
    /\bForced (Interrupt|Response)\b/gi,
    "",
  );
  return GLOSSARY.filter((g) =>
    g.pattern.test(
      ["Interrupt", "Response"].includes(g.term) ? optionalText : plainText,
    ),
  );
}
/** A short label for a card that cannot be played right now. */
export function shortReason(reason: string) {
  if (/reaction window/i.test(reason)) return "REACTION";
  if (/pay for another/i.test(reason)) return "RESOURCE";
  if (/not enough resources|cannot pay|insufficient resources/i.test(reason))
    return "NEED RESOURCES";
  if (/hero form/i.test(reason)) return "HERO FORM";
  if (/alter-ego form/i.test(reason)) return "ALTER-EGO";
  if (/teammate/i.test(reason)) return "OWN TURN";
  if (/already in play|already control/i.test(reason)) return "IN PLAY";
  if (
    /minion|enemy|ally|target|scheme|upgrade first|attacks and defeats|basic attack|other card/i.test(
      reason,
    )
  )
    return "NO TARGET";
  if (/decision/i.test(reason)) return "WAIT";
  return "NOT NOW";
}
