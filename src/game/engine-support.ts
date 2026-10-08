import { ANT_MAN_SCRIPT_CODES } from "./ant-man.js";
import { ANT_MAN_PACK_SCRIPT_CODES } from "./ant-man-pack.js";
import { WASP_SCRIPT_CODES } from "./wasp.js";
import { WASP_PACK_SCRIPT_CODES } from "./wasp-pack.js";
import { QUICKSILVER_SCRIPT_CODES } from "./quicksilver.js";
import { QUICKSILVER_PACK_SCRIPT_CODES } from "./quicksilver-pack.js";
import { SCARLET_WITCH_SCRIPT_CODES } from "./scarlet-witch.js";
import { SCARLET_WITCH_PACK_SCRIPT_CODES } from "./scarlet-witch-pack.js";
import { GROOT_SCRIPT_CODES } from "./groot.js";
import { ROCKET_SCRIPT_CODES } from "./rocket.js";
import { GMW_PLAYER_PACK_SCRIPT_CODES } from "./gmw-player-pack.js";
import { STAR_LORD_SCRIPT_CODES } from "./star-lord.js";
import { GAMORA_SCRIPT_CODES } from "./gamora.js";
import { STAR_LORD_PACK_SCRIPT_CODES } from "./star-lord-pack.js";
import { GAMORA_PACK_SCRIPT_CODES } from "./gamora-pack.js";
import { DRAX_SCRIPT_CODES } from "./drax.js";
import { DRAX_PACK_SCRIPT_CODES } from "./drax-pack.js";
import { VENOM_PACK_SCRIPT_CODES } from "./venom-pack.js";
import { VENOM_SCRIPT_CODES } from "./venom.js";
import { SPECTRUM_SCRIPT_CODES } from "./spectrum.js";
import { WARLOCK_SCRIPT_CODES } from "./warlock.js";
import { MTS_PLAYER_PACK_SCRIPT_CODES } from "./mts-player-pack.js";
import { NEBULA_SCRIPT_CODES } from "./nebula.js";
import { NEBULA_PACK_SCRIPT_CODES } from "./nebula-pack.js";
import { WAR_MACHINE_SCRIPT_CODES } from "./war-machine.js";
import { WAR_MACHINE_PACK_SCRIPT_CODES } from "./war-machine-pack.js";
import { VALKYRIE_SCRIPT_CODES } from "./valkyrie.js";
import { VALKYRIE_PACK_SCRIPT_CODES } from "./valkyrie-pack.js";
import { VISION_SCRIPT_CODES } from "./vision.js";
import { VISION_PACK_SCRIPT_CODES } from "./vision-pack.js";
import { GHOST_SPIDER_SCRIPT_CODES } from "./ghost-spider.js";
import { MILES_MORALES_SCRIPT_CODES } from "./miles-morales.js";
import { SINISTER_PLAYER_PACK_SCRIPT_CODES } from "./sinister-player-pack.js";
import { NOVA_SCRIPT_CODES } from "./nova.js";
import { IRONHEART_SCRIPT_CODES } from "./ironheart.js";
import { NOVA_IRONHEART_PACK_SCRIPT_CODES } from "./nova-ironheart-pack.js";
import { ARMADILLO_SCRIPT_CODES } from "./armadillo.js";
import { ZZZAX_SCRIPT_CODES } from "./zzzax.js";
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
  "scw",
  "groot",
  "rocket",
  "stld",
  "gam",
  "drax",
  "vnm",
  "spectrum",
  "warlock",
  "nebu",
  "warm",
  "valk",
  "vision",
  "ghost_spider",
  "spider_man_morales",
  "nova",
  "ironheart",
]);
export const EXPLICIT_CARD_SCRIPTS = new Set<string>([
  ...ANT_MAN_SCRIPT_CODES,
  ...ANT_MAN_PACK_SCRIPT_CODES,
  ...WASP_SCRIPT_CODES,
  ...WASP_PACK_SCRIPT_CODES,
  ...QUICKSILVER_SCRIPT_CODES,
  ...QUICKSILVER_PACK_SCRIPT_CODES,
  ...SCARLET_WITCH_SCRIPT_CODES,
  ...SCARLET_WITCH_PACK_SCRIPT_CODES,
  ...GROOT_SCRIPT_CODES,
  ...ROCKET_SCRIPT_CODES,
  ...GMW_PLAYER_PACK_SCRIPT_CODES,
  ...STAR_LORD_SCRIPT_CODES,
  ...GAMORA_SCRIPT_CODES,
  ...STAR_LORD_PACK_SCRIPT_CODES,
  ...GAMORA_PACK_SCRIPT_CODES,
  ...DRAX_SCRIPT_CODES,
  ...DRAX_PACK_SCRIPT_CODES,
  ...VENOM_PACK_SCRIPT_CODES,
  ...VENOM_SCRIPT_CODES,
  ...SPECTRUM_SCRIPT_CODES,
  ...WARLOCK_SCRIPT_CODES,
  ...MTS_PLAYER_PACK_SCRIPT_CODES,
  ...NEBULA_SCRIPT_CODES,
  ...NEBULA_PACK_SCRIPT_CODES,
  ...WAR_MACHINE_SCRIPT_CODES,
  ...WAR_MACHINE_PACK_SCRIPT_CODES,
  ...VALKYRIE_SCRIPT_CODES,
  ...VALKYRIE_PACK_SCRIPT_CODES,
  ...VISION_SCRIPT_CODES,
  ...VISION_PACK_SCRIPT_CODES,
  ...GHOST_SPIDER_SCRIPT_CODES,
  ...MILES_MORALES_SCRIPT_CODES,
  ...SINISTER_PLAYER_PACK_SCRIPT_CODES,
  ...NOVA_SCRIPT_CODES,
  ...IRONHEART_SCRIPT_CODES,
  ...NOVA_IRONHEART_PACK_SCRIPT_CODES,
  ...CAPTAIN_AMERICA_SCRIPT_CODES,
  ...HULK_SCRIPT_CODES,
  ...CAPTAIN_PACK_SCRIPT_CODES,
  ...HULK_PACK_SCRIPT_CODES,
  ...MUTAGEN_FORMULA_SCRIPT_CODES,
  ...RISKY_BUSINESS_SCRIPT_CODES,
  ...MS_MARVEL_SCRIPT_CODES,
  ...THOR_SCRIPT_CODES,
  ...GOBLIN_MODULE_SCRIPT_CODES,
  ...ARMADILLO_SCRIPT_CODES,
  ...ZZZAX_SCRIPT_CODES,
  ...BLACK_WIDOW_SCRIPT_CODES,
  ...DOCTOR_STRANGE_SCRIPT_CODES,
  ...HAWKEYE_SCRIPT_CODES,
  ...HAWKEYE_EXISTING_CODES,
  ...SPIDER_WOMAN_SCRIPT_CODES,
]);
