import { GOBLIN_MODULE_SCRIPT_CODES } from "./goblin-modules";
import { BLACK_WIDOW_SCRIPT_CODES } from "./black-widow";
import { DOCTOR_STRANGE_SCRIPT_CODES } from "./doctor-strange";
import { THOR_SCRIPT_CODES } from "./thor";
import { MS_MARVEL_SCRIPT_CODES } from "./ms-marvel";
import { RISKY_BUSINESS_SCRIPT_CODES } from "./risky-business";
import { CAPTAIN_AMERICA_SCRIPT_CODES } from "./captain-america";
import { HULK_SCRIPT_CODES } from "./hulk";
import { HULK_PACK_SCRIPT_CODES } from "./hulk-pack";
import { MUTAGEN_FORMULA_SCRIPT_CODES } from "./mutagen-formula";
import { CAPTAIN_PACK_SCRIPT_CODES } from "./captain-pack";

/** Modules installed in the dispatcher and verified by actual mission tests. */
export const SCRIPTED_HERO_IDS = new Set([
  "spider_man",
  "captain_marvel",
  "iron_man",
  "black_panther",
  "she_hulk",
  "captain_america",
  "hulk",
  "ms_marvel",
  "thor",
  "black_widow",
  "doctor_strange",
]);
export const EXPLICIT_CARD_SCRIPTS = new Set<string>([
  ...CAPTAIN_AMERICA_SCRIPT_CODES,
  ...HULK_SCRIPT_CODES,
  ...CAPTAIN_PACK_SCRIPT_CODES,
  ...HULK_PACK_SCRIPT_CODES,
  ...MUTAGEN_FORMULA_SCRIPT_CODES,
  ...RISKY_BUSINESS_SCRIPT_CODES,
  ...MS_MARVEL_SCRIPT_CODES,
  ...THOR_SCRIPT_CODES,
  ...GOBLIN_MODULE_SCRIPT_CODES,
  ...BLACK_WIDOW_SCRIPT_CODES,
  ...DOCTOR_STRANGE_SCRIPT_CODES,
]);
