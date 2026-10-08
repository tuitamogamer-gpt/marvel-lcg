import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { consumeStatus } from "./keywords.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManPorts } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type { Card, Effect, GameState, Option, Piece } from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const W = (type: string, args: Record<string, unknown> = {}) =>
  E(`war-machine:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (value: unknown, message: string) => {
  if (!value) throw Error(message);
};
const active = (s: GameState) =>
  ["warm", "wmach", "war_machine"].includes(s.heroId);
const definition = (p: Piece | string) =>
  cards.get(typeof p === "string" ? p : p.code)!;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const warmCard = (p: Piece | string) =>
  definition(p)?.set_code === "warm" && definition(p)?.faction_code === "hero";
const warmEvent = (p: Piece | string | undefined) =>
  !!p && warmCard(p) && definition(p)?.type_code === "event";
const ammoCost = (p: Piece) =>
  (
    ({ "23008": 1, "23009": 1, "23010": 3, "23011": 4 }) as Record<
      string,
      number
    >
  )[p.code] || 0;
type TextPorts = Pick<WarMachinePorts, "isTextBlank">;
const defaultTextPorts: TextPorts = { isTextBlank };

export const WAR_MACHINE_SCRIPT_CODES = [
  "23001a",
  "23001b",
  "23002",
  "23003",
  "23004",
  "23005",
  "23006",
  "23007",
  "23008",
  "23009",
  "23010",
  "23011",
  "23028",
  "23029",
  "23030",
  "23031",
] as const;
export const WAR_MACHINE_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const WAR_MACHINE_ORIGINAL_SOURCE =
  "https://hallofheroeslcg.com/war-machine/";
export const WAR_MACHINE_RULINGS_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#warmachine";

export interface WarMachinePorts extends AntManPorts {
  makePiece(s: GameState, code: string): Piece;
  shuffleEncounter(s: GameState): void;
  /** Shuffle the actual deck, then resume after any actual exhaustion/reset
   * windows. Do not reset a nonempty deck or discard cards from a new deck. */
  shufflePlayerDeck(s: GameState, after: Effect[]): void;
  canDiscardUpgrade(s: GameState, p: Piece): boolean;
  canReadyPiece?(s: GameState, p: Piece): boolean;
  /** One simultaneous NONATTACK damage batch with ordinary prevention/defeat;
   * accepts enemies or identity IDs. No Guard, Overkill or Retaliate. */
  damageBatch(
    s: GameState,
    ids: string[],
    amount: number,
    source: string,
  ): void;
  isIdentityTextBlank?(s: GameState): boolean;
  /** Count actual selectable resource sources AND their Gauntlet ammo gains
   * together, excluding the physical card being played. Ammo gains commit
   * before the additional ammo cost. Do not treat a gun as free ammo. */
  canPayEventWithAmmo?(s: GameState, p: Piece, neededAmmo: number): boolean;
}

/** Identity counters are distinct from counters on a physical Bunker. */
export function warMachineAmmo(s: GameState): number {
  return active(s) ? Math.max(0, Number(s.flags.warMachineAmmo || 0)) : 0;
}
function placeAmmo(s: GameState, count: number) {
  need(active(s), "Ammo must be placed on War Machine's identity.");
  s.flags.warMachineAmmo = warMachineAmmo(s) + count;
}
function removeAmmo(s: GameState, count: number) {
  need(
    active(s) &&
      Number.isInteger(count) &&
      count >= 0 &&
      warMachineAmmo(s) >= count,
    "War Machine cannot pay this ammo cost.",
  );
  s.flags.warMachineAmmo = warMachineAmmo(s) - count;
}
export function warMachineTraits(
  s: GameState,
  ports: TextPorts = defaultTextPorts,
): string[] {
  return active(s) &&
    s.player.form === "hero" &&
    s.player.inPlay.some((p) => p.code === "23004" && !ports.isTextBlank(s, p))
    ? ["Aerial"]
    : [];
}
export function warMachineEnemyKeywords(
  s: GameState,
  p: Piece,
  ports: TextPorts = defaultTextPorts,
) {
  return { piercing: p.code === "23029" && !ports.isTextBlank(s, p) };
}
export function warMachinePhaseEnded(s: GameState) {
  for (const seat of s.players)
    delete seatView(s, seat).flags.warMachineRecoverPhase;
}

/** Host calls after an actual form change, not initial setup or an unchanged
 * form. Forced AE counter loss precedes every optional form response. */
export function warMachineFormChanged(
  s: GameState,
  from: "hero" | "alter",
  to: "hero" | "alter",
  ports: Pick<
    WarMachinePorts,
    "isTextBlank" | "isIdentityTextBlank"
  > = defaultTextPorts,
): Effect[] {
  if (!active(s) || from === to || s.player.form !== to) return [];
  if (to === "alter") {
    if (!ports.isIdentityTextBlank?.(s)) s.flags.warMachineAmmo = 0;
    return [];
  }
  const ids = [
    ...(!ports.isIdentityTextBlank?.(s) ? ["identity"] : []),
    ...s.player.inPlay
      .filter((p) => p.code === "23004" && !ports.isTextBlank(s, p))
      .map((p) => p.id),
  ];
  return ids.length ? [W("form-responses", { ids, used: [] })] : [];
}
export function warMachineResourceSources(
  s: GameState,
  targetCode?: string,
  ports: TextPorts = defaultTextPorts,
): PaymentSource[] {
  if (!active(s) || !warmEvent(targetCode)) return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === "23005" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) => ({
      id: p.id,
      code: p.code,
      name: "Gauntlet Gun",
      resources: ["wild"],
      description:
        "Exhaust Gauntlet Gun · generate 1 wild for a War Machine event and place 1 ammo",
      kind: "ability",
    }));
}
export function warMachineResourceSpent(
  s: GameState,
  id: string,
  targetCode?: string,
  ports: TextPorts = defaultTextPorts,
): boolean {
  const p = own(s, id, "23005");
  if (!p) return false;
  need(
    active(s) &&
      warmEvent(targetCode) &&
      !p.exhausted &&
      !ports.isTextBlank(s, p),
    "Gauntlet Gun requires a War Machine event payment.",
  );
  p.exhausted = true;
  placeAmmo(s, 1);
  return true;
}
export function warMachinePlayRestriction(
  s: GameState,
  p: Piece,
  ports?: Pick<WarMachinePorts, "canPayEventWithAmmo">,
): string | null {
  const cost = ammoCost(p);
  if (!cost) return null;
  if (!active(s) || s.player.form !== "hero")
    return "This War Machine event requires hero form.";
  if (ports?.canPayEventWithAmmo)
    return ports.canPayEventWithAmmo(s, p, cost)
      ? null
      : "This event needs its resource cost and enough actual ammo after any paid Gauntlet Gun sources.";
  // Pure callers without a payment host can validate committed ammo only.
  return warMachineAmmo(s) >= cost
    ? null
    : "This event needs more ammo (Gauntlet Gun payment may supply it).";
}
/** Resource payment commits FIRST, including actual Gauntlet ammo gains. This
 * additional cost must then run before native Stun/Confuse replacement. */
export function warMachineBeforeEvent(
  _s: GameState,
  p: Piece,
  after: Effect[],
): Effect[] | null {
  return ammoCost(p) ? [W("event-cost", { piece: p, after })] : null;
}
export function warMachineEvent(
  _s: GameState,
  p: Piece,
  target?: string,
): Effect[] | null {
  return ammoCost(p) ? [W("event", { piece: p, target })] : null;
}
export function warMachineAllyEnter(
  _s: GameState,
  p: Piece,
  ports: TextPorts = defaultTextPorts,
): Effect[] | null {
  if (p.code !== "23002") return null;
  return !ports.isTextBlank(_s, p)
    ? [
        E("optional", {
          title: "Iron Man",
          text: "Search your deck and discard pile for a Tech upgrade?",
          effects: [W("iron-man", { id: p.id })],
          image: p.code,
        }),
      ]
    : [];
}

export function warMachineAbilityOptions(
  s: GameState,
  id: string,
  ports: WarMachinePorts,
): Option[] {
  if (["hero", "identity"].includes(id)) {
    return active(s) &&
      s.player.form === "alter" &&
      !ports.isIdentityTextBlank?.(s) &&
      s.flags.warMachineRecoverPhase !== phaseKey(s) &&
      s.player.discard.some(warmCard)
      ? [
          option(
            "recover-war-machine",
            "Shuffle a War Machine card from discard into your deck",
            [W("recover")],
            "23001b",
          ),
        ]
      : [];
  }
  const p = own(s, id);
  if (!p || !active(s) || ports.isTextBlank(s, p)) return [];
  if (p.code === "23003" && !p.exhausted) {
    if (s.player.form === "alter")
      return [
        option(
          "store-ammo",
          "Exhaust Munitions Bunker · place 2 ammo here",
          [W("bunker", { id, mode: "store" })],
          p.code,
        ),
      ];
    if (p.counters > 0)
      return [
        option(
          "transfer-ammo",
          "Exhaust Munitions Bunker · move all its ammo to War Machine",
          [W("bunker", { id, mode: "transfer" })],
          p.code,
        ),
      ];
  }
  if (
    s.player.form === "hero" &&
    ["23006", "23007"].includes(p.code) &&
    !p.exhausted &&
    (p.code !== "23006" || warMachineAmmo(s) >= 1) &&
    (s.player.stunned || ports.enemyTargets(s, true).length)
  )
    return [
      option(
        "attack",
        p.code === "23006"
          ? "Missile Launcher · spend 1 ammo and deal 2 ranged damage"
          : "Shoulder Cannon · deal 1 damage",
        [W("weapon", { id })],
        p.code,
      ),
    ];
  return [];
}
export function warMachineAbility(
  s: GameState,
  id: string,
  ports: WarMachinePorts,
  action?: string,
): boolean {
  const options = warMachineAbilityOptions(s, id, ports);
  if (!options.length) return false;
  const chosen = action
    ? options.find((o) => o.id === action)
    : options.length === 1
      ? options[0]
      : undefined;
  if (chosen) ports.queue(s, ...chosen.effects);
  else {
    need(!action, "War Machine's action is unavailable.");
    ports.choose(s, "War Machine", "Choose an action.", options);
  }
  return true;
}
export function warMachineInitializeNemesis(
  s: GameState,
  ports: Pick<WarMachinePorts, "makePiece">,
) {
  if (active(s) && s.player.setAside === undefined)
    s.player.setAside = ["23029", "23030", "23031", "23031", "23031"].map(
      (code) => ports.makePiece(s, code),
    );
}
const reserved = (s: GameState) =>
  new Set(
    String(s.flags.warMachineReservedNemesis || "")
      .split(",")
      .filter(Boolean),
  );
const release = (s: GameState, id: string) => {
  const ids = reserved(s);
  ids.delete(id);
  s.flags.warMachineReservedNemesis = [...ids].join(",");
};
export function warMachineShadowOfPast(s: GameState): Effect[] | null {
  if (!active(s)) return null;
  if (s.flags.nemesis) return [E("surge", { sourceCode: "01190" })];
  s.flags.nemesis = true;
  const zone = s.player.setAside || [],
    chosen = zone.filter((p) => ["23029", "23030"].includes(p.code)),
    rest = zone.filter((p) => p.code === "23031");
  s.flags.warMachineReservedNemesis = [...chosen, ...rest]
    .map((p) => p.id)
    .join(",");
  return [
    ...chosen.map((p) => W("reveal-setaside", { id: p.id })),
    W("shuffle-nemesis", { ids: rest.map((p) => p.id) }),
    ...(!chosen.some((p) => p.code === "23029")
      ? [E("surge", { sourceCode: "01190" })]
      : []),
  ];
}
export function warMachineEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  if (p.code === "23028") {
    const owner = playerOrder(s).find((seat) => active(seatView(s, seat)));
    return owner ? [W("obligation", { piece: p, actorId: owner.id })] : [];
  }
  if (p.code === "23031") return [W("laser-strike", { surge: true })];
  return ["23029", "23030"].includes(p.code) ? [] : null;
}
export function warMachineBoost(s: GameState, p: Piece): Effect[] | null {
  if (p.code !== "23031")
    return ["23028", "23029", "23030"].includes(p.code) ? [] : null;
  return s.attack && (!s.attack.defender || s.attack.defender === "none")
    ? [W("laser-strike", { surge: false })]
    : [];
}
export function warMachineSchemeDefeated(_s: GameState, p: Piece): Effect[] {
  return p.code === "23030" ? [W("light-show", { sourceCode: p.code })] : [];
}

function attack(
  s: GameState,
  p: Piece,
  target: string,
  amount: number,
  keywords: Record<string, boolean>,
  tail: Effect[],
  ports: WarMachinePorts,
) {
  ports.attackProgram(
    s,
    [
      E("damage", {
        target,
        amount,
        source: "hero",
        attack: true,
        abilitySource: p.id,
        attackInitiated: true,
        ...keywords,
      }),
      ...tail,
    ],
    [],
  );
}
function receipt(after: Effect[], target?: string) {
  return after.map((e) => ({
    ...e,
    warMachineAmmoCostPaid: true,
    ...(target ? { warMachineTarget: target } : {}),
  }));
}
function upgradeChoices(s: GameState, ports: WarMachinePorts) {
  return s.player.inPlay.filter(
    (p) =>
      definition(p)?.type_code === "upgrade" && ports.canDiscardUpgrade(s, p),
  );
}
export function resolveWarMachineEffect(
  s: GameState,
  e: Effect,
  ports: WarMachinePorts,
): boolean {
  if (!e.type.startsWith("war-machine:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "war-machine:form-responses": {
      if (!active(s) || s.player.form !== "hero") break;
      const choices: Option[] = [];
      for (const id of e.ids || []) {
        if ((e.used || []).includes(id)) continue;
        const next = W("form-responses", {
          ids: e.ids,
          used: [...(e.used || []), id],
        });
        if (id === "identity" && !ports.isIdentityTextBlank?.(s))
          choices.push(
            option(
              id,
              "Locked and Loaded · place 5 ammo",
              [W("load"), next],
              "23001a",
            ),
          );
        const p = own(s, id, "23004");
        if (
          p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          ports.canGiveStatus(s, `hero:${s.activePlayerId}`, "tough")
        )
          choices.push(
            option(
              id,
              "Upgraded Chassis · exhaust and become Tough",
              [W("chassis", { id }), next],
              p.code,
            ),
          );
      }
      if (choices.length)
        ports.choose(
          s,
          "War Machine · form responses",
          "Resolve responses in your chosen order.",
          [...choices, option("continue", "Continue", [])],
        );
      break;
    }
    case "war-machine:load":
      need(
        active(s) &&
          s.player.form === "hero" &&
          !ports.isIdentityTextBlank?.(s),
        "Locked and Loaded is unavailable.",
      );
      placeAmmo(s, 5);
      break;
    case "war-machine:chassis": {
      const p = own(s, e.id, "23004");
      need(
        p &&
          !p.exhausted &&
          !ports.isTextBlank(s, p) &&
          s.player.form === "hero" &&
          ports.canGiveStatus(s, `hero:${s.activePlayerId}`, "tough"),
        "Upgraded Chassis is unavailable.",
      );
      p!.exhausted = true;
      ports.queue(
        s,
        E("status", { target: `hero:${s.activePlayerId}`, status: "tough" }),
      );
      break;
    }
    case "war-machine:recover": {
      need(
        warMachineAbilityOptions(s, "hero", ports).length,
        "James Rhodes's action is unavailable.",
      );
      ports.choose(
        s,
        "James Rhodes",
        "Choose an actual War Machine card in discard.",
        s.player.discard
          .filter(warmCard)
          .map((p) =>
            option(
              p.id,
              definition(p).name,
              [W("recover-card", { id: p.id })],
              p.code,
            ),
          ),
      );
      break;
    }
    case "war-machine:recover-card": {
      const index = s.player.discard.findIndex(
        (p) => p.id === e.id && warmCard(p),
      );
      need(
        index >= 0 && warMachineAbilityOptions(s, "hero", ports).length,
        "Choose an actual discarded War Machine card with the unused phase limit.",
      );
      s.player.deck.push(s.player.discard.splice(index, 1)[0]);
      s.flags.warMachineRecoverPhase = phaseKey(s);
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "war-machine:bunker": {
      const p = own(s, e.id, "23003");
      need(
        p &&
          warMachineAbilityOptions(s, e.id, ports).some(
            (o) =>
              o.id === (e.mode === "store" ? "store-ammo" : "transfer-ammo"),
          ),
        "Munitions Bunker is unavailable.",
      );
      p!.exhausted = true;
      if (e.mode === "store") p!.counters += 2;
      else {
        placeAmmo(s, p!.counters);
        p!.counters = 0;
      }
      ports.queue(s, ...after);
      break;
    }
    case "war-machine:weapon": {
      const p = own(s, e.id);
      need(
        p &&
          warMachineAbilityOptions(s, e.id, ports).some(
            (o) => o.id === "attack",
          ),
        "War Machine's weapon is unavailable.",
      );
      if (s.player.stunned) {
        p!.exhausted = true;
        if (p!.code === "23006") removeAmmo(s, 1);
        consumeStatus(s.player, "stunned");
        ports.queue(s, ...after);
        break;
      }
      ports.choose(
        s,
        definition(p!).name,
        "Choose the enemy for this attack.",
        ports
          .enemyTargets(s, true)
          .map((t) =>
            option(
              t.id,
              t.label,
              [W("weapon-attack", { id: e.id, target: t.id, after })],
              t.code,
            ),
          ),
      );
      break;
    }
    case "war-machine:weapon-attack": {
      const p = own(s, e.id);
      need(
        p &&
          warMachineAbilityOptions(s, e.id, ports).some(
            (o) => o.id === "attack",
          ) &&
          ports.enemyTargets(s, true).some((t) => t.id === e.target),
        "The weapon or its enemy is unavailable.",
      );
      p!.exhausted = true;
      if (p!.code === "23006") removeAmmo(s, 1);
      attack(
        s,
        p!,
        e.target,
        p!.code === "23006" ? 2 : 1,
        { ranged: p!.code === "23006" },
        p!.code === "23007"
          ? [W("shoulder-ready", { id: p!.id }), ...after]
          : after,
        ports,
      );
      break;
    }
    case "war-machine:shoulder-ready": {
      const p = own(s, e.id, "23007");
      if (
        p &&
        p.exhausted &&
        s.player.form === "hero" &&
        warMachineAmmo(s) > 0 &&
        (!ports.canReadyPiece || ports.canReadyPiece(s, p))
      )
        ports.choose(
          s,
          "Shoulder Cannon",
          "Remove 1 ammo to ready the actual Shoulder Cannon?",
          [
            option("ready", "Remove 1 ammo · ready Shoulder Cannon", [
              W("shoulder-pay", { id: p.id }),
            ]),
            option("continue", "Leave it exhausted", []),
          ],
        );
      break;
    }
    case "war-machine:shoulder-pay": {
      const p = own(s, e.id, "23007");
      need(
        p &&
          p.exhausted &&
          warMachineAmmo(s) >= 1 &&
          (!ports.canReadyPiece || ports.canReadyPiece(s, p)),
        "Shoulder Cannon cannot be readied.",
      );
      removeAmmo(s, 1);
      p!.exhausted = false;
      break;
    }
    case "war-machine:event-cost": {
      const p: Piece = e.piece;
      need(
        active(s) &&
          s.player.form === "hero" &&
          ammoCost(p) > 0 &&
          warMachineAmmo(s) >= ammoCost(p),
        "The event's actual ammo cost cannot be paid.",
      );
      if (p.code === "23011") {
        const targets = ports.enemyTargets(s, !s.player.stunned);
        need(
          targets.length,
          "Full Auto must choose an actual enemy as its cost.",
        );
        ports.choose(
          s,
          "Full Auto · additional cost",
          "Choose the enemy and remove 4 ammo before resolving the attack.",
          targets.map((t) =>
            option(
              t.id,
              t.label,
              [W("full-auto-cost", { piece: p, target: t.id, after })],
              t.code,
            ),
          ),
        );
      } else {
        removeAmmo(s, ammoCost(p));
        ports.queue(s, ...receipt(after));
      }
      break;
    }
    case "war-machine:full-auto-cost": {
      need(
        ports.enemyTargets(s, !s.player.stunned).some((t) => t.id === e.target),
        "Full Auto's chosen enemy is unavailable.",
      );
      removeAmmo(s, 4);
      ports.queue(s, ...receipt(after, e.target));
      break;
    }
    case "war-machine:event": {
      const p: Piece = e.piece;
      if (p.code === "23010") {
        ports.damageBatch(
          s,
          [s.villain.id, ...s.minions.map((p) => p.id)],
          3,
          "hero",
        );
        break;
      }
      if (p.code === "23011") {
        need(
          ports.enemyTargets(s, true).some((t) => t.id === e.target),
          "Full Auto's cost target is no longer attackable.",
        );
        attack(s, p, e.target, 8, { overkill: true }, after, ports);
        break;
      }
      const targets =
        p.code === "23009"
          ? ports.schemeTargets(s, true)
          : ports.enemyTargets(s, true);
      if (targets.length)
        ports.choose(
          s,
          definition(p).name,
          "Choose a target.",
          targets.map((t) =>
            option(
              t.id,
              t.label,
              [W("event-target", { piece: p, target: t.id, after })],
              t.code,
            ),
          ),
        );
      else ports.queue(s, ...after);
      break;
    }
    case "war-machine:event-target": {
      const p: Piece = e.piece;
      if (p.code === "23009") {
        need(
          ports.schemeTargets(s, true).some((t) => t.id === e.target),
          "Targeted Strike's scheme is unavailable.",
        );
        ports.queue(
          s,
          E("thwart", {
            target: e.target,
            amount: 3,
            source: "hero",
            action: true,
            abilitySource: p.id,
            thwartInitiated: true,
          }),
          ...after,
        );
      } else {
        need(
          p.code === "23008" &&
            ports.enemyTargets(s, true).some((t) => t.id === e.target),
          "Repulsor Beam's enemy is unavailable.",
        );
        attack(s, p, e.target, 4, {}, after, ports);
      }
      break;
    }
    case "war-machine:iron-man": {
      const source = own(s, e.id, "23002");
      need(source && !ports.isTextBlank(s, source), "Iron Man is unavailable.");
      const choices = [...s.player.deck, ...s.player.discard].filter(
        (p) =>
          definition(p)?.type_code === "upgrade" &&
          (definition(p).traits || "").split(/\.\s*/).includes("Tech"),
      );
      ports.revealHidden(s);
      if (choices.length)
        ports.choose(
          s,
          "Iron Man",
          "Choose a physical Tech upgrade from deck or discard.",
          choices.map((p) =>
            option(
              p.id,
              definition(p).name,
              [W("iron-man-card", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      else ports.shufflePlayerDeck(s, after);
      break;
    }
    case "war-machine:iron-man-card": {
      const zone = [s.player.deck, s.player.discard].find((zone) =>
        zone.some(
          (p) =>
            p.id === e.id &&
            definition(p)?.type_code === "upgrade" &&
            (definition(p).traits || "").split(/\.\s*/).includes("Tech"),
        ),
      );
      need(zone, "Iron Man must find the actual Tech upgrade.");
      s.player.hand.push(
        zone!.splice(
          zone!.findIndex((p) => p.id === e.id),
          1,
        )[0],
      );
      ports.shufflePlayerDeck(s, after);
      break;
    }
    case "war-machine:reveal-setaside": {
      const zone = s.player.setAside || [],
        index = zone.findIndex((p) => p.id === e.id);
      if (index >= 0 && reserved(s).has(e.id)) {
        const p = zone.splice(index, 1)[0];
        release(s, p.id);
        ports.queue(s, E("reveal", { piece: p }));
      }
      break;
    }
    case "war-machine:shuffle-nemesis": {
      for (const id of e.ids || []) {
        const zone = s.player.setAside || [],
          index = zone.findIndex((p) => p.id === id);
        if (index >= 0 && reserved(s).has(id))
          s.encounter.deck.push(zone.splice(index, 1)[0]);
        release(s, id);
      }
      ports.shuffleEncounter(s);
      break;
    }
    case "war-machine:light-show":
      ports.damageBatch(
        s,
        playerOrder(s).map((seat) => `hero:${seat.id}`),
        1,
        e.sourceCode,
      );
      break;
    case "war-machine:laser-strike": {
      const upgrades = upgradeChoices(s, ports);
      if (upgrades.length)
        ports.choose(
          s,
          "Laser Strike",
          "Choose an actual upgrade you control to discard.",
          upgrades.map((p) =>
            option(
              p.id,
              definition(p).name,
              [W("discard-upgrade", { id: p.id, after })],
              p.code,
            ),
          ),
        );
      else
        ports.queue(
          s,
          ...(e.surge ? [E("surge", { sourceCode: "23031" })] : []),
          ...after,
        );
      break;
    }
    case "war-machine:discard-upgrade": {
      const p = upgradeChoices(s, ports).find((p) => p.id === e.id);
      need(p, "Laser Strike needs an actual discardable controlled upgrade.");
      ports.discardPiece(s, p!.id);
      ports.queue(s, ...after);
      break;
    }
    case "war-machine:obligation": {
      need(active(s), "Equipment Malfunction belongs to James Rhodes.");
      if (s.player.form === "hero" && ports.canChangeForm(s))
        ports.choose(
          s,
          "Equipment Malfunction",
          "You may change to alter-ego form.",
          [
            option("alter", "Change to alter-ego", [
              E("flip", { counts: false, target: "alter" }),
              W("obligation-choices", { piece: e.piece }),
            ]),
            option("stay", "Stay in hero form", [
              W("obligation-choices", { piece: e.piece }),
            ]),
          ],
        );
      else ports.queue(s, W("obligation-choices", { piece: e.piece }));
      break;
    }
    case "war-machine:obligation-choices": {
      const choices = [
        option(
          "ammo",
          "Remove all identity ammo · Surge if 2 or fewer removed",
          [W("obligation-ammo", { piece: e.piece })],
        ),
      ];
      if (s.player.form === "alter" && !s.player.exhausted)
        choices.unshift(
          option("exhaust", "Exhaust James Rhodes · remove this obligation", [
            W("obligation-exhaust", { piece: e.piece }),
          ]),
        );
      ports.choose(s, "Equipment Malfunction", "Choose an option.", choices);
      break;
    }
    case "war-machine:obligation-exhaust":
      need(
        s.player.form === "alter" && !s.player.exhausted,
        "Equipment Malfunction needs ready James Rhodes.",
      );
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: e.piece }));
      break;
    case "war-machine:obligation-ammo": {
      const count = warMachineAmmo(s);
      removeAmmo(s, count);
      ports.queue(
        s,
        ...(count <= 2 ? [E("surge", { sourceCode: "23028" })] : []),
        E("discardEncounter", { piece: e.piece }),
      );
      break;
    }
    default:
      throw Error(`Unknown War Machine effect: ${e.type}`);
  }
  return true;
}
