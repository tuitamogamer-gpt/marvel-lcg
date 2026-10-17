import { card } from "./card-definitions.js";
import { isTextBlank } from "./card-text.js";
import { allInPlay, playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { Effect, GameState, Option, Piece, Resource } from "./types.js";

const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const D = (type: string, args: Record<string, unknown> = {}): Effect =>
  E(`domino:${type}`, args);
const O = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (ok: unknown, message: string) => {
  if (!ok) throw Error(message);
};
const live = (s: GameState, code: string) =>
  s.player.inPlay.filter((p) => p.code === code && !isTextBlank(s, p));
const identityActive = (s: GameState) =>
  s.heroId === "domino" &&
  !isTextBlank(s, {
    code: s.player.form === "hero" ? "40037a" : "40037b",
    id: `hero:${s.activePlayerId}`,
  });
const own = (s: GameState, id: string) =>
  s.player.inPlay.find((p) => p.id === id);
const sourceCard = (s: GameState, p: Piece) => card(p).set_code === s.heroId;
const powerTypes = ["energy", "mental", "physical", "wild"] as const;
export const DOMINO_SCRIPT_CODES = [
  "40037a",
  "40037b",
  ...Array.from({ length: 32 }, (_, i) => String(40038 + i)),
].filter((c) => !["40061", "40062", "40063"].includes(c));

export interface DominoPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  enemies(s: GameState, attack: boolean): AntManTarget[];
  schemes(s: GameState, thwart: boolean): AntManTarget[];
  characters(s: GameState): AntManTarget[];
  hasTrait(s: GameState, id: string, trait: string): boolean;
  hidden(s: GameState): void;
  mill(s: GameState, after: Effect): void;
  shuffle(s: GameState): void;
  shuffleEncounter(s: GameState): void;
  discard(s: GameState, id: string): void;
  discardHand(s: GameState, id: string): void;
  makePiece(s: GameState, code: string): Piece;
  put(s: GameState, p: Piece): void;
  canPut(s: GameState, p: Piece): boolean;
  canDamage(s: GameState, p: Piece): boolean;
  damageCost(s: GameState, p: Piece, after: Effect[]): void;
  attach(s: GameState, p: Piece, target: string): void;
  keepObligation(s: GameState, p: Piece): void;
  cancelReveal(s: GameState, p: Piece): void;
  cancelBoost(s: GameState, id: string): void;
  additionalBoost(s: GameState): void;
  drawEncounter(s: GameState): Piece | undefined;
  claimDefense(s: GameState): void;
  maxHP(s: GameState): number;
  canReady(s: GameState, id: string): boolean;
  attack(s: GameState, effects: Effect[], after: Effect[]): void;
}

/** Count printed icons, not payment values. Domino's constant only doubles wilds in hero form. */
export function dominoResources(s: GameState, p?: Piece): Resource[] {
  if (!p) return [];
  return powerTypes.flatMap((r) =>
    Array(
      (card(p)[`resource_${r}`] || 0) *
        (r === "wild" && s.player.form === "hero" && identityActive(s) ? 2 : 1),
    ).fill(r),
  );
}
export function dominoInitialize(s: GameState, make: DominoPorts["makePiece"]) {
  if (s.heroId !== "domino") return;
  for (const code of ["40066", "40067", "40068", "40069", "40069"]) {
    const p = make(s, code);
    p.ownerId = s.activePlayerId;
    (s.player.setAside ||= []).push(p);
  }
}
export function dominoFeedback(s: GameState): Effect[] {
  return s.attachments
    .filter(
      (p) =>
        p.code === "40069" &&
        ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || "") &&
        !isTextBlank(s, p),
    )
    .map(() => E("damage", { target: "hero", amount: 1 }));
}
export function dominoAbilityOptions(
  s: GameState,
  id: string,
  ports: DominoPorts,
): Option[] {
  if (
    ["hero", "identity"].includes(id) &&
    identityActive(s) &&
    s.player.hand.length &&
    s.flags[`dominoSwap:${s.player.form}`] !== s.round &&
    (s.player.form === "hero" ? s.player.deck.length : s.player.discard.length)
  )
    return [
      O(
        "swap",
        s.player.form === "hero"
          ? "Domino · swap a card with the top of your deck"
          : "Neena Thurman · swap a card with the top of your discard pile",
        [D("swap")],
        s.player.form === "hero" ? "40037a" : "40037b",
      ),
    ];
  const p = own(s, id);
  if (p && !isTextBlank(s, p)) {
    if (p.code === "40065" && s.player.form === "alter" && !s.player.exhausted)
      return [
        O(
          "memories",
          "Exhaust to discard Memories of Armageddon",
          [D("memories", { id })],
          p.code,
        ),
      ];
    if (p.exhausted) return [];
    if (p.code === "40038" && s.player.deck.length && ports.canDamage(s, p))
      return [
        O(
          "diamondback",
          "Diamondback · discard and damage each enemy",
          [D("diamondback", { id })],
          p.code,
        ),
      ];
    if (
      p.code === "40044" &&
      s.player.form === "alter" &&
      s.player.discard.some(
        (q) =>
          card(q).set_code === "domino" || card(q).traits?.includes("Posse."),
      )
    )
      return [
        O(
          "pip",
          "Pip the Pug · return a Domino or Posse card",
          [D("pip", { id })],
          p.code,
        ),
      ];
    if (
      p.code === "40045" &&
      s.player.form === "alter" &&
      p.storedCards?.length
    )
      return [
        O(
          "painted-lady",
          "The Painted Lady · take an attached card",
          [D("lady", { id })],
          p.code,
        ),
      ];
    if (
      p.code === "40046" &&
      s.player.form === "hero" &&
      s.player.deck.length &&
      ports.enemies(s, true).length
    )
      return [
        O(
          "pistol",
          "Domino's Pistol · ranged attack",
          [D("pistol", { id })],
          p.code,
        ),
      ];
    if (
      p.code === "40056" &&
      playerOrder(s).some((seat) => seatView(s, seat).player.deck.length)
    )
      return [
        O(
          "atlas",
          "Atlas Bear · look at a player's top card",
          [D("atlas", { id })],
          p.code,
        ),
      ];
  }
  const feedback = s.attachments.find(
    (p) =>
      p.id === id &&
      p.code === "40069" &&
      ["hero", `hero:${s.activePlayerId}`].includes(p.attachedTo || ""),
  );
  if (
    feedback &&
    s.player.form === "alter" &&
    s.player.hand.some((p) => sourceCard(s, p))
  )
    return [
      O(
        "feedback",
        "Discard an identity-specific card to discard Superpower Feedback",
        [D("feedback-remove", { id })],
        feedback.code,
      ),
    ];
  return [];
}
export function dominoAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: DominoPorts,
): Effect[] | null {
  if (action === "attack" || action === "thwart") return null;
  const opts = dominoAbilityOptions(s, id, ports);
  const p = own(s, id) || s.attachments.find((p) => p.id === id);
  if (
    !opts.length &&
    !(["identity", "hero"].includes(id) && s.heroId === "domino") &&
    !["40038", "40044", "40045", "40046", "40056", "40065", "40069"].includes(
      p?.code || "",
    )
  )
    return null;
  const opt =
    opts.find((o) => o.id === action) ||
    (!action && opts.length === 1 ? opts[0] : undefined);
  need(opt, "This Domino ability is unavailable.");
  return opt!.effects;
}
export function dominoPlayRestriction(
  s: GameState,
  p: Piece,
  ports: DominoPorts,
) {
  if (
    ["40040", "40041", "40042", "40053", "40058"].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "Hero form required.";
  if (p.code === "40064" && live(s, p.code).length) return "Max 1 per player.";
  if (p.code === "40053" && !s.sideSchemes.length)
    return "A side scheme is required.";
  if (p.code === "40058") {
    const count =
      (ports.hasTrait(s, "hero", "Posse") ? 1 : 0) +
      s.player.inPlay.filter(
        (p) => card(p).type_code === "ally" && ports.hasTrait(s, p.id, "Posse"),
      ).length;
    if (count < 3) return "Control at least three Posse characters.";
  }
}
export function dominoEvent(s: GameState, p: Piece): Effect[] | null {
  return ["40040", "40041", "40042", "40053", "40058"].includes(p.code)
    ? [D("event", { piece: p })]
    : null;
}
export function dominoDiscardedTop(s: GameState, pieces: Piece[]): Effect[] {
  if (
    !pieces.length ||
    !(
      pieces.some((p) => ["40043", "40057", "40060"].includes(p.code)) ||
      live(s, "40045").some((p) => (p.storedCards?.length || 0) < 3)
    )
  )
    return [];
  return [
    D("discarded-top", {
      ids: pieces.map((p) => p.id),
      actorId: s.activePlayerId,
    }),
  ];
}
export function dominoBeforeAlly(
  s: GameState,
  p: Piece,
  e: Effect,
): Effect[] | null {
  if (
    p.code !== "40039" ||
    isTextBlank(s, p) ||
    e.kind !== "attack" ||
    p.stunned ||
    e.dominoOutlawHandled ||
    !s.player.deck.length
  )
    return null;
  return [D("outlaw", { id: p.id, packet: e })];
}
export function dominoAfterAlly(
  s: GameState,
  p: Piece,
  attack: boolean,
): Effect[] {
  if (attack || isTextBlank(s, p)) return [];
  return ["40050", "40051"].includes(p.code)
    ? [D("ally-after", { piece: { ...p } })]
    : [];
}
export function dominoBasicOptions(s: GameState, e: Effect): Option[] {
  if (e.dominoProbabilityHandled || !s.player.deck.length) return [];
  return live(s, "40049").map((p) =>
    O(
      p.id,
      "Probability Field · discard to boost this basic power",
      [D("probability", { id: p.id, packet: e })],
      p.code,
    ),
  );
}
export function dominoRangedOptions(s: GameState, e: Effect): Option[] {
  if (
    s.player.form !== "hero" ||
    !e.ranged ||
    !e.attack ||
    e.dominoSharpHandled ||
    !s.player.deck.length ||
    (e.source && !["hero", `hero:${s.activePlayerId}`].includes(e.source))
  )
    return [];
  return live(s, "40064").map((p) =>
    O(
      p.id,
      "Sharpshooter · discard to boost this ranged attack",
      [D("sharpshooter", { id: p.id, packet: e })],
      p.code,
    ),
  );
}
export function dominoBoostOptions(s: GameState, p: Piece): Option[] {
  if (
    s.player.form !== "hero" ||
    s.attack?.targetPlayerId !== s.activePlayerId ||
    s.boostCancellations?.[p.id]?.icons
  )
    return [];
  return live(s, "40047")
    .filter((q) => !q.exhausted)
    .map((q) =>
      O(
        q.id,
        "Lucky and Good · replace this boost card",
        [D("lucky-good", { id: q.id, piece: p })],
        q.code,
      ),
    );
}
export function dominoRevealOptions(s: GameState, p: Piece): Option[] {
  return s.player.form === "hero"
    ? live(s, "40048").map((q) =>
        O(
          q.id,
          "Lucky Break · replace this encounter card",
          [D("lucky-break", { id: q.id, piece: p })],
          q.code,
        ),
      )
    : [];
}
export function dominoSideSchemeDefeated(s: GameState, p: Piece): Effect[] {
  if (!["40054", "40059"].includes(p.code)) return [];
  return playerOrder(s).map((seat) =>
    D("side-reward", { code: p.code, actorId: seat.id }),
  );
}
export function dominoEncounter(s: GameState, p: Piece): Effect[] | null {
  return ["40065", "40066", "40067", "40068", "40069"].includes(p.code)
    ? [D("encounter", { piece: p })]
    : null;
}
export function dominoShadows(s: GameState): Effect[] | null {
  if (s.heroId !== "domino") return null;
  if (s.flags.nemesis) return [E("surge")];
  s.flags.nemesis = true;
  return [D("shadows")];
}
const select = (
  s: GameState,
  title: string,
  targets: AntManTarget[],
  action: Effect,
  ports: DominoPorts,
) => {
  if (targets.length)
    ports.choose(
      s,
      title,
      "Choose a target.",
      targets.map((t) =>
        O(t.id, t.label, [{ ...action, target: t.id }], t.code),
      ),
    );
};

export function resolveDominoEffect(
  s: GameState,
  e: Effect,
  ports: DominoPorts,
): boolean {
  if (!e.type.startsWith("domino:")) return false;
  const q = (...effects: Effect[]) => ports.queue(s, ...effects);
  const feedback = () => q(...dominoFeedback(s));
  switch (e.type) {
    case "domino:feedback":
      feedback();
      break;
    case "domino:swap":
      ports.choose(
        s,
        "Swap a card",
        s.player.form === "hero"
          ? "Swap a hand card with the top card of your deck."
          : "Swap a hand card with the top of your discard pile.",
        s.player.hand.map((p) =>
          O(
            p.id,
            card(p).name,
            [D("swap-use", { id: p.id, form: s.player.form })],
            p.code,
          ),
        ),
      );
      break;
    case "domino:swap-use": {
      need(
        identityActive(s) &&
          e.form === s.player.form &&
          s.flags[`dominoSwap:${s.player.form}`] !== s.round,
        "The identity swap is unavailable.",
      );
      const index = s.player.hand.findIndex((p) => p.id === e.id);
      const zone = s.player.form === "hero" ? s.player.deck : s.player.discard;
      const top = s.player.form === "hero" ? 0 : zone.length - 1;
      need(index >= 0 && zone.length, "Both swap cards must exist.");
      [s.player.hand[index], zone[top]] = [zone[top], s.player.hand[index]];
      s.flags[`dominoSwap:${s.player.form}`] = s.round;
      ports.hidden(s);
      break;
    }
    case "domino:discarded-top": {
      const options: Option[] = [];
      for (const id of e.ids as string[]) {
        const p = [...s.player.discard, ...s.player.deck].find(
          (p) => p.id === id,
        );
        if (!p) continue;
        if (p.code === "40043")
          options.push(
            O(
              `jackpot:${id}`,
              "Jackpot! · shuffle into your deck",
              [D("discard-response", { id, action: "jackpot", receipt: e })],
              p.code,
            ),
          );
        if (p.code === "40060")
          options.push(
            O(
              `digging:${id}`,
              "Digging Deep · add to hand",
              [D("discard-response", { id, action: "digging", receipt: e })],
              p.code,
            ),
          );
        if (p.code === "40057" && ports.canPut(s, p))
          options.push(
            O(
              `fox:${id}`,
              "White Fox · put into play",
              [D("discard-response", { id, action: "fox", receipt: e })],
              p.code,
            ),
          );
        for (const lady of live(s, "40045").filter(
          (q) => (q.storedCards?.length || 0) < 3,
        ))
          options.push(
            O(
              `lady:${lady.id}:${id}`,
              `The Painted Lady · attach ${card(p).name} facedown`,
              [
                D("discard-response", {
                  id,
                  ladyId: lady.id,
                  action: "lady",
                  receipt: e,
                }),
              ],
              p.code,
            ),
          );
      }
      if (options.length)
        ports.choose(
          s,
          "After discarding from your deck",
          "Resolve a response, or continue.",
          [...options, O("continue", "Continue", [])],
        );
      break;
    }
    case "domino:discard-response": {
      const zone = s.player.discard.some((p) => p.id === e.id)
        ? s.player.discard
        : s.player.deck;
      const i = zone.findIndex((p) => p.id === e.id);
      if (i < 0) break;
      const p = zone[i];
      if (e.action === "lady") {
        const lady = own(s, e.ladyId);
        need(
          lady && !isTextBlank(s, lady) && (lady.storedCards?.length || 0) < 3,
          "The Painted Lady is full or unavailable.",
        );
        zone.splice(i, 1);
        (lady!.storedCards ||= []).push(p);
      } else if (e.action === "fox") {
        need(ports.canPut(s, p), "White Fox cannot enter play.");
        zone.splice(i, 1);
        ports.put(s, p);
      } else {
        zone.splice(i, 1);
        if (e.action === "jackpot") {
          s.player.deck.push(p);
          ports.shuffle(s);
        } else s.player.hand.push(p);
      }
      q(
        ...(e.action === "lady" || p.code === "40043" ? dominoFeedback(s) : []),
        {
          ...e.receipt,
          ids: e.receipt.ids.filter((id: string) => id !== p.id),
        },
      );
      break;
    }
    case "domino:pip":
    case "domino:lady": {
      const p = own(s, e.id);
      need(p && !p.exhausted, "A ready support is required.");
      const cards =
        e.type === "domino:pip"
          ? s.player.discard.filter(
              (q) =>
                card(q).set_code === "domino" ||
                card(q).traits?.includes("Posse."),
            )
          : p!.storedCards || [];
      ports.choose(
        s,
        card(p!).name,
        "Choose the physical card.",
        cards.map((c) =>
          O(
            c.id,
            card(c).name,
            [
              D("retrieve", {
                id: p!.id,
                cardId: c.id,
                lady: e.type === "domino:lady",
              }),
            ],
            c.code,
          ),
        ),
      );
      break;
    }
    case "domino:retrieve": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && s.player.form === "alter",
        "A ready support and alter-ego form are required.",
      );
      const zone = e.lady ? p!.storedCards || [] : s.player.discard;
      const i = zone.findIndex((p) => p.id === e.cardId);
      need(i >= 0, "The selected card moved.");
      p!.exhausted = true;
      const [c] = zone.splice(i, 1);
      if (e.lady) s.player.hand.push(c);
      else {
        s.player.deck.unshift(c);
        ports.hidden(s);
      }
      break;
    }
    case "domino:diamondback": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && ports.canDamage(s, p) && s.player.deck.length,
        "Diamondback cannot pay her costs.",
      );
      p!.exhausted = true;
      ports.damageCost(s, p!, [D("diamondback-discard")]);
      break;
    }
    case "domino:diamondback-discard":
      ports.mill(s, D("diamondback-hit"));
      break;
    case "domino:diamondback-hit":
      q(
        ...[s.villain, ...s.minions].map((p) =>
          E("damage", { target: p.id, amount: e.resources.length }),
        ),
      );
      break;
    case "domino:pistol":
      select(
        s,
        "Domino's Pistol",
        ports.enemies(s, true),
        D("pistol-pay", { id: e.id }),
        ports,
      );
      break;
    case "domino:pistol-pay": {
      const p = own(s, e.id);
      need(
        p && !p.exhausted && s.player.deck.length,
        "Domino's Pistol cannot pay its costs.",
      );
      p!.exhausted = true;
      ports.mill(s, D("pistol-hit", { target: e.target }));
      break;
    }
    case "domino:pistol-hit":
      q(
        E("damage", {
          target: e.target,
          amount: e.resources.length,
          attack: true,
          source: "hero",
          ranged: true,
        }),
      );
      break;
    case "domino:outlaw":
      ports.choose(
        s,
        "Outlaw",
        "Discard the top card to increase this attack?",
        [
          O("discard", "Discard top card", [
            D("outlaw-pay", { packet: e.packet }),
          ]),
          O("continue", "Continue", [
            { ...e.packet, dominoOutlawHandled: true },
          ]),
        ],
      );
      break;
    case "domino:outlaw-pay":
      ports.mill(s, D("outlaw-hit", { packet: e.packet }));
      break;
    case "domino:outlaw-hit":
      q(...dominoFeedback(s), {
        ...e.packet,
        amount: (e.packet.amount ?? 1) + e.resources.length,
        dominoOutlawHandled: true,
      });
      break;
    case "domino:probability":
    case "domino:sharpshooter":
      ports.mill(
        s,
        D("power-hit", {
          packet: e.packet,
          probability: e.type === "domino:probability",
        }),
      );
      break;
    case "domino:power-hit":
      q(...(e.probability ? dominoFeedback(s) : []), {
        ...e.packet,
        amount: (e.packet.amount || 0) + e.resources.length,
        ...(e.probability
          ? { dominoProbabilityHandled: true }
          : { dominoSharpHandled: true }),
      });
      break;
    case "domino:event": {
      const p = e.piece as Piece;
      if (p.code === "40040")
        select(
          s,
          card(p).name,
          ports.enemies(s, true),
          D("workout", { piece: p }),
          ports,
        );
      if (p.code === "40041") ports.mill(s, D("luck"));
      if (p.code === "40042")
        select(
          s,
          card(p).name,
          ports.schemes(s, true),
          D("right-place", { piece: p }),
          ports,
        );
      if (p.code === "40053")
        select(
          s,
          card(p).name,
          ports.schemes(s, false).filter((t) => t.id !== "main"),
          E("thwart", { amount: 3 * s.playerCount, source: "hero" }),
          ports,
        );
      if (p.code === "40058")
        q(
          ...ports
            .characters(s)
            .filter((t) => ports.hasTrait(s, t.id, "Posse"))
            .flatMap((t) => [
              E("heal", { target: t.id, amount: 1 }),
              ...(ports.canReady(s, t.id) ? [E("ready", { id: t.id })] : []),
            ]),
        );
      break;
    }
    case "domino:workout":
      ports.attack(
        s,
        [
          E("damage", {
            target: e.target,
            amount: 4,
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
          D("workout-mill"),
        ],
        [],
      );
      break;
    case "domino:workout-mill":
      ports.mill(s, D("workout-extra"));
      break;
    case "domino:workout-extra":
      if (e.resources.length)
        select(
          s,
          "A Good Workout",
          ports.enemies(s, true),
          E("damage", {
            amount: e.resources.length,
            attack: true,
            source: "hero",
            attackInitiated: true,
          }),
          ports,
        );
      break;
    case "domino:right-place":
      ports.mill(s, D("right-hit", { target: e.target }));
      break;
    case "domino:right-hit":
      q(
        E("thwart", {
          target: e.target,
          amount: 3 + e.resources.length,
          source: "hero",
          action: true,
        }),
      );
      break;
    case "domino:luck": {
      const resources = e.resources as Resource[];
      if (!resources.length) break;
      const [resource, ...rest] = resources;
      const effects =
        resource === "wild" ? ["energy", "mental", "physical"] : [resource];
      const opts = effects.flatMap((r) => {
        const targets =
          r === "energy"
            ? ports.characters(s)
            : r === "mental"
              ? ports.schemes(s, false)
              : ports.enemies(s, false);
        return targets.map((t) =>
          O(
            `${r}:${t.id}`,
            `${r === "energy" ? "Heal 2" : r === "mental" ? "Remove 2 threat" : "Deal 3 damage"} · ${t.label}`,
            [
              E(
                r === "energy" ? "heal" : r === "mental" ? "thwart" : "damage",
                { target: t.id, amount: r === "physical" ? 3 : 2 },
              ),
              D("luck", { resources: rest }),
            ],
            t.code,
          ),
        );
      });
      if (opts.length)
        ports.choose(
          s,
          "Luck Be a Lady",
          "Resolve this discarded resource icon.",
          opts,
        );
      else q(D("luck", { resources: rest }));
      break;
    }
    case "domino:ally-after":
      ports.choose(s, card(e.piece).name, "Use this ally's response?", [
        O("yes", "Use response", [
          D(e.piece.code === "40050" ? "feral" : "wolfsbane"),
        ]),
        O("continue", "Continue", []),
      ]);
      break;
    case "domino:feral":
      ports.mill(s, D("feral-hit"));
      break;
    case "domino:feral-hit":
      q(E("damage", { target: s.villain.id, amount: e.resources.length }));
      break;
    case "domino:wolfsbane":
      ports.choose(
        s,
        "Wolfsbane",
        "Name a card type.",
        [
          "ally",
          "event",
          "resource",
          "support",
          "upgrade",
          "player_side_scheme",
        ].map((type) =>
          O(type, type.replaceAll("_", " "), [
            D("wolfsbane-mill", { cardType: type }),
          ]),
        ),
      );
      break;
    case "domino:wolfsbane-mill":
      ports.mill(s, D("wolfsbane-take", { cardType: e.cardType }));
      break;
    case "domino:wolfsbane-take": {
      const p = s.player.discard.find(
        (p) => p.id === e.piece?.id && card(p).type_code === e.cardType,
      );
      if (p)
        ports.choose(s, "Wolfsbane", "Add the named card to your hand?", [
          O(
            p.id,
            `Take ${card(p).name}`,
            [D("take-discard", { id: p.id })],
            p.code,
          ),
          O("continue", "Leave it in discard", []),
        ]);
      break;
    }
    case "domino:take-discard": {
      const i = s.player.discard.findIndex((p) => p.id === e.id);
      if (i >= 0) s.player.hand.push(s.player.discard.splice(i, 1)[0]);
      break;
    }
    case "domino:atlas":
      ports.choose(
        s,
        "Atlas Bear",
        "Choose a player's deck.",
        playerOrder(s)
          .filter((seat) => seatView(s, seat).player.deck.length)
          .map((seat) =>
            O(seat.id, seat.heroId, [
              D("atlas-look", { id: e.id, playerId: seat.id }),
            ]),
          ),
      );
      break;
    case "domino:atlas-look": {
      const p = own(s, e.id),
        view = seatView(s, e.playerId);
      need(
        p && !p.exhausted && view.player.deck.length,
        "Atlas Bear cannot look at that deck.",
      );
      p!.exhausted = true;
      ports.hidden(s);
      const top = view.player.deck[0];
      ports.choose(s, "Atlas Bear", `Top card: ${card(top).name}`, [
        ...(card(top).type_code === "event" && ports.canDamage(s, p!)
          ? [
              O(
                "take",
                "Deal 1 damage to Atlas Bear and take the event",
                [
                  D("atlas-take", {
                    id: p!.id,
                    playerId: e.playerId,
                    cardId: top.id,
                  }),
                ],
                top.code,
              ),
            ]
          : []),
        O("continue", "Leave it on top", []),
      ]);
      break;
    }
    case "domino:atlas-take": {
      const p = own(s, e.id);
      need(p && ports.canDamage(s, p), "Atlas Bear cannot pay damage.");
      ports.damageCost(s, p!, [
        D("atlas-draw", { playerId: e.playerId, cardId: e.cardId }),
      ]);
      break;
    }
    case "domino:atlas-draw": {
      const view = seatView(s, e.playerId);
      if (view.player.deck[0]?.id === e.cardId)
        q(E("draw", { amount: 1, actorId: e.playerId }));
      break;
    }
    case "domino:lucky-good": {
      const p = own(s, e.id);
      need(p && !p.exhausted && s.attack, "Lucky and Good is unavailable.");
      p!.exhausted = true;
      ports.claimDefense(s);
      ports.cancelBoost(s, e.piece.id);
      ports.additionalBoost(s);
      q(...dominoFeedback(s), E("boostInterruptWindow", { piece: e.piece }));
      break;
    }
    case "domino:lucky-break":
      ports.discard(s, e.id);
      ports.cancelReveal(s, e.piece);
      q(...dominoFeedback(s), D("replacement-encounter"));
      break;
    case "domino:replacement-encounter": {
      const piece = ports.drawEncounter(s);
      if (piece) q(E("reveal", { piece, fromEncounterDeck: true }));
      break;
    }
    case "domino:memories":
      s.player.exhausted = true;
      ports.discard(s, e.id);
      break;
    case "domino:feedback-remove":
      ports.choose(
        s,
        "Superpower Feedback",
        "Discard an identity-specific card.",
        s.player.hand
          .filter((p) => sourceCard(s, p))
          .map((p) =>
            O(
              p.id,
              card(p).name,
              [D("feedback-discard", { id: e.id, cardId: p.id })],
              p.code,
            ),
          ),
      );
      break;
    case "domino:feedback-discard":
      need(
        s.player.form === "alter" &&
          s.player.hand.some((p) => p.id === e.cardId && sourceCard(s, p)),
        "An identity-specific hand card is required.",
      );
      ports.discardHand(s, e.cardId);
      ports.discard(s, e.id);
      break;
    case "domino:side-reward": {
      if (e.code === "40054") {
        const ms = s.minions.filter((p) => !ports.hasTrait(s, p.id, "Elite"));
        if (ms.length)
          ports.choose(
            s,
            "Take Out the Guards",
            "You may discard a non-Elite minion.",
            [
              ...ms.map((p) =>
                O(
                  p.id,
                  card(p).name,
                  [E("discardPiece", { id: p.id })],
                  p.code,
                ),
              ),
              O("continue", "Continue", []),
            ],
          );
      } else {
        ports.hidden(s);
        const candidates = [...s.player.deck, ...s.player.discard].filter(
          (p) =>
            sourceCard(s, p) &&
            card(p).type_code === "upgrade" &&
            ports.canPut(s, p),
        );
        ports.choose(
          s,
          "Superpower Training",
          "Search your deck and discard for an identity-specific upgrade.",
          [
            ...candidates.map((p) =>
              O(p.id, card(p).name, [D("training", { id: p.id })], p.code),
            ),
            O("continue", "Finish search and shuffle", [D("training")]),
          ],
        );
      }
      break;
    }
    case "domino:training": {
      if (e.id) {
        const zone = s.player.deck.some((p) => p.id === e.id)
          ? s.player.deck
          : s.player.discard;
        const index = zone.findIndex((p) => p.id === e.id);
        need(
          index >= 0 && ports.canPut(s, zone[index]),
          "The upgrade cannot enter play.",
        );
        ports.put(s, zone.splice(index, 1)[0]);
      }
      ports.shuffle(s);
      break;
    }
    case "domino:encounter": {
      const p = e.piece as Piece;
      if (p.code === "40065") ports.keepObligation(s, p);
      if (p.code === "40069") ports.attach(s, p, `hero:${s.activePlayerId}`);
      if (p.code === "40068") {
        const actual = s.minions.find((q) => q.id === p.id);
        if (actual) actual.counters = ports.maxHP(s) - s.player.hp;
      }
      if (p.code === "40067")
        q(
          ...playerOrder(s).map((seat) =>
            D("unlucky", { id: p.id, actorId: seat.id }),
          ),
        );
      if (p.code === "40066") {
        const zones = [
          s.encounter.deck,
          s.encounter.discard,
          ...s.players.map((seat) => seatView(s, seat).player.setAside || []),
        ];
        const zone = zones.find((zone) => zone.some((q) => q.code === "40069"));
        if (zone) {
          const [feedback] = zone.splice(
            zone.findIndex((q) => q.code === "40069"),
            1,
          );
          ports.attach(s, feedback, `hero:${s.activePlayerId}`);
        }
        ports.shuffleEncounter(s);
      }
      break;
    }
    case "domino:unlucky":
      ports.choose(
        s,
        "Not My Lucky Day",
        "Take 1 damage or place 2 threat on this scheme.",
        [
          O("damage", "Take 1 damage", [
            E("damage", { target: "hero", amount: 1 }),
          ]),
          O("threat", "Place 2 threat", [
            E("threat", { target: e.id, amount: 2 }),
          ]),
        ],
      );
      break;
    case "domino:shadows": {
      const zone = s.player.setAside || [];
      const minion = zone.find((p) => p.code === "40066"),
        scheme = zone.find((p) => p.code === "40067");
      const shuffled = zone.filter((p) => ["40068", "40069"].includes(p.code));
      s.player.setAside = zone.filter(
        (p) =>
          ![minion?.id, scheme?.id, ...shuffled.map((p) => p.id)].includes(
            p.id,
          ),
      );
      s.encounter.deck.push(...shuffled);
      ports.shuffleEncounter(s);
      q(
        ...(minion ? [E("reveal", { piece: minion })] : [E("surge")]),
        ...(scheme ? [E("reveal", { piece: scheme })] : []),
      );
      break;
    }
    default:
      throw Error(`Unknown Domino effect: ${e.type}`);
  }
  return true;
}
