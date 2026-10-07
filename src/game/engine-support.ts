import { ANT_MAN_SCRIPT_CODES } from "./ant-man.js";
import { ANT_MAN_PACK_SCRIPT_CODES } from "./ant-man-pack.js";
import { WASP_SCRIPT_CODES } from "./wasp.js";
import { WASP_PACK_SCRIPT_CODES } from "./wasp-pack.js";
import { QUICKSILVER_SCRIPT_CODES } from "./quicksilver.js";
import { QUICKSILVER_PACK_SCRIPT_CODES } from "./quicksilver-pack.js";
import { GOBLIN_MODULE_SCRIPT_CODES } from "./goblin-modules.js";
import { BLACK_WIDOW_SCRIPT_CODES } from "./black-widow.js";
import { DOCTOR_STRANGE_SCRIPT_CODES } from "./doctor-strange.js";
import { THOR_SCRIPT_CODES } from "./thor.js";
import { MS_MARVEL_SCRIPT_CODES } from "./ms-marvel.js";
import { RISKY_BUSINESS_SCRIPT_CODES } from "./risky-business.js";
import { CAPTAIN_AMERICA_SCRIPT_CODES } from "./captain-america.js";
import { HULK_SCRIPT_CODES } from "./hulk.js";
import { HULK_PACK_SCRIPT_CODES } from "./hulk-pack.js";
import { MUTAGEN_FORMULA_SCRIPT_CODES } from "./mutagen-formula.js";
import { CAPTAIN_PACK_SCRIPT_CODES } from "./captain-pack.js";
import { HAWKEYE_SCRIPT_CODES, HAWKEYE_EXISTING_CODES } from "./hawkeye.js";
import { SPIDER_WOMAN_SCRIPT_CODES } from "./spider-woman.js";

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
  "hawkeye",
  "spider_woman",
  "ant",
  "wsp",
  "qsv",
]);
export const EXPLICIT_CARD_SCRIPTS = new Set<string>([
  ...ANT_MAN_SCRIPT_CODES,
  ...ANT_MAN_PACK_SCRIPT_CODES,
  ...WASP_SCRIPT_CODES,
  ...WASP_PACK_SCRIPT_CODES,
  ...QUICKSILVER_SCRIPT_CODES,
  ...QUICKSILVER_PACK_SCRIPT_CODES,
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
  ...HAWKEYE_SCRIPT_CODES,
  ...HAWKEYE_EXISTING_CODES,
  ...SPIDER_WOMAN_SCRIPT_CODES,
]);
