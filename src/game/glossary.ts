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
    pattern: /\bGuard\b/,
    text: "While a Guard minion is engaged with you, you cannot attack the villain until that minion is defeated.",
  },
  {
    term: "Tough",
    pattern: /\bTough(ness)?\b/,
    text: "A Tough status card prevents the next instance of damage to that character, then is discarded. Toughness gives it when the card enters play.",
  },
  {
    term: "Stunned",
    pattern: /\bStun(ned)?\b/,
    text: "A stunned character removes the status card instead of attacking the next time it would attack.",
  },
  {
    term: "Confused",
    pattern: /\bConfuse[d]?\b/,
    text: "A confused character removes the status card instead of thwarting or scheming the next time it would.",
  },
  {
    term: "Surge",
    pattern: /\bSurge\b/,
    text: "When revealed, deal yourself one more facedown encounter card; it is revealed after this one.",
  },
  {
    term: "Quickstrike",
    pattern: /\bQuickstrike\b/,
    text: "After this minion engages you, it attacks you immediately.",
  },
  {
    term: "Retaliate",
    pattern: /\bRetaliate\b/,
    text: "After a character with Retaliate X is attacked, it deals X damage to the attacker, even if the attack was prevented.",
  },
  {
    term: "Overkill",
    pattern: /\bOverkill\b/,
    text: "Damage from an Overkill attack that exceeds a minion's remaining hit points is dealt to the villain.",
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
    pattern: /\bAerial\b/,
    text: "A trait some heroes gain or have; certain cards get stronger while your hero is Aerial.",
  },
  {
    term: "Villainous",
    pattern: /\bVillainous\b/,
    text: "When this minion attacks or schemes, deal it a boost card as if it were the villain.",
  },
  {
    term: "Boost",
    pattern: /\bboost\b/i,
    text: "Facedown encounter cards dealt to a villain attack or scheme; each adds its boost icons, and a star means its boost ability also resolves.",
  },
  {
    term: "Setup",
    pattern: /\bSetup\b/,
    text: "Put this card into play at the start of the mission, before the first turn.",
  },
  {
    term: "Forced Interrupt",
    pattern: /\bForced Interrupt\b/,
    text: "Must be resolved just before the named event happens.",
  },
  {
    term: "Forced Response",
    pattern: /\bForced Response\b/,
    text: "Must be resolved just after the named event happens.",
  },
  {
    term: "Interrupt",
    pattern: /\bInterrupt\b/,
    text: "An optional ability you may use just before the named event happens.",
  },
  {
    term: "Response",
    pattern: /\bResponse\b/,
    text: "An optional ability you may use just after the named event happens.",
  },
  {
    term: "Hero Action",
    pattern: /\bHero Action\b/,
    text: "An action you can take only while in hero form.",
  },
  {
    term: "Alter-Ego Action",
    pattern: /\bAlter-Ego Action\b/,
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
    pattern: /\bRecover\b|\bREC\b/,
    text: "The alter-ego basic power: exhaust your identity to heal this many hit points.",
  },
  {
    term: "Thwart",
    pattern: /\bThwart\b|\bTHW\b/,
    text: "Remove threat from a scheme. If the main scheme fills up, the villain wins.",
  },
  {
    term: "Escalation",
    pattern: /\bescalation\b/i,
    text: "Threat the main scheme gains every villain phase, before any acceleration.",
  },
  {
    term: "Obligation",
    pattern: /\bObligation\b/,
    text: "A card from your hero's set shuffled into the encounter deck; when revealed, it forces a hard choice on that hero.",
  },
  {
    term: "Nemesis",
    pattern: /\bNemesis\b/,
    text: "Your hero's personal villain. Shadows of the Past brings the nemesis set into play.",
  },
  {
    term: "Exhaust",
    pattern: /\bExhaust\b/,
    text: "Turn a card sideways to use it; it readies again at the end of the hero phase.",
  },
  {
    term: "Uses",
    pattern: /\bUses \(/,
    text: "Counters placed on the card when it enters play; each use spends one.",
  },
  {
    term: "Unique",
    pattern: /\bUnique\b|\bunique\b/,
    text: "Only one copy of a unique card can be in play at a time across all players.",
  },
];
/** The glossary entries that apply to a printed card text. */
export function keywordsIn(text: string | undefined) {
  if (!text) return [];
  const plainText = text.replace(/<[^>]*>/g, "");
  return GLOSSARY.filter((g) => g.pattern.test(plainText));
}
/** A short label for a card that cannot be played right now. */
export function shortReason(reason: string) {
  if (/reaction window/i.test(reason)) return "REACTION";
  if (/pay for another/i.test(reason)) return "RESOURCE";
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
