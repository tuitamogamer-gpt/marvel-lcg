import catalog from "../data/catalog-cards.json" with { type: "json" };
import { isTextBlank } from "./card-text.js";
import { playerOrder, seatView } from "./team.js";
import type { AntManTarget } from "./ant-man.js";
import type { PaymentSource } from "./payment.js";
import type {
  Card,
  Effect,
  GameState,
  Option,
  Piece,
  Resource,
} from "./types.js";

const cards = new Map((catalog as unknown as Card[]).map((c) => [c.code, c]));
const E = (type: string, args: Record<string, unknown> = {}): Effect => ({
  type,
  ...args,
});
const S = (type: string, args: Record<string, unknown> = {}) =>
  E(`spectrum:${type}`, args);
const option = (
  id: string,
  label: string,
  effects: Effect[],
  image?: string,
): Option => ({ id, label, effects, image });
const need = (condition: unknown, message: string) => {
  if (!condition) throw Error(message);
};
const active = (s: GameState) => s.heroId === "spectrum";
const phaseKey = (s: GameState) => `${s.round}:${s.phase}`;
const own = (s: GameState, id: string, code?: string) =>
  s.player.inPlay.find((p) => p.id === id && (!code || p.code === code));

export type SpectrumEnergyForm = "gamma" | "photon" | "pulsar";
export const SPECTRUM_FORM_CODES = {
  gamma: "21002",
  photon: "21003",
  pulsar: "21004",
} as const;
export const SPECTRUM_SCRIPT_CODES = [
  "21001a",
  "21001b",
  "21002",
  "21003",
  "21004",
  "21005",
  "21006",
  "21007",
  "21008",
  "21009",
  "21010",
  "21026",
  "21027",
  "21028",
  "21029",
  "21030",
] as const;
export const SPECTRUM_RULES_SOURCE =
  "https://cdn.svc.asmodee.net/production-fantasyflightgames/uploads/2026/09/mc_rulesreference_v18_compressed.pdf";
export const SPECTRUM_INSERT_SOURCE =
  "https://hallofheroeslcg.com/wp-content/uploads/2021/08/mad-titans-shadow-insert.pdf";
export const SPECTRUM_FAQ_SOURCE =
  "https://hallofheroeslcg.com/official-ffg-rulings/#spectrum";

export interface SpectrumPorts {
  queue(s: GameState, ...effects: Effect[]): void;
  choose(s: GameState, title: string, text: string, options: Option[]): void;
  makePiece(s: GameState, code: string): Piece;
  isTextBlank(s: GameState, p: Piece): boolean;
  identityTextBlank(s: GameState): boolean;
  /** Generic absolute form locks apply to energy forms as well. Do not use the
   * voluntary Hero/AE flip budget or restrict this to the player's own turn. */
  canChangeForm(s: GameState): boolean;
  canReadyIdentity(s: GameState, playerId: string): boolean;
  canPay(
    s: GameState,
    cost: number,
    requirements?: Resource[],
    excludeId?: string,
    targetCode?: string,
  ): boolean;
  cardCost(s: GameState, p: Piece): number;
  heroMaxHP(s: GameState): number;
  enemyTargets(s: GameState, attack: boolean): AntManTarget[];
  /** ignoreCrisis overrides Crisis only; Patrol and other thwart restrictions
   * must still apply. Non-thwart removal ignores Patrol but still obeys Crisis. */
  schemeTargets(
    s: GameState,
    thwart: boolean,
    ignoreCrisis?: boolean,
  ): AntManTarget[];
  /** Notify the host of this actual additional-form change; do not open a
   * response window here, inside the still-resolving card ability. */
  energyFormChanged(
    s: GameState,
    from: SpectrumEnergyForm | undefined,
    to: SpectrumEnergyForm,
  ): void;
  /** Common optional form responses (Moxie, Ready to Rumble), each continuing
   * into after. The module combines these with the energy card's response so
   * the player chooses their order in one saved window. */
  formResponseOptions(s: GameState, after: Effect[]): Option[];
  /** Recalculate the pending basic defense after changing the +2 DEF form;
   * preserve all already-declared defender/defense-event state. */
  refreshDefense(s: GameState): void;
  /** One simultaneous non-attack batch with normal Tough/prevention/defeat
   * windows. Explicit seat-qualified hero IDs preserve multiplayer actors. */
  damageBatch(
    s: GameState,
    ids: string[],
    amount: number,
    source: string,
  ): void;
  /** Move the exact resolving obligation into the named owner's play area. */
  giveObligation(s: GameState, p: Piece, playerId: string): void;
  /** Move the exact resolving attachment onto the named player's identity. */
  attachIdentity(s: GameState, p: Piece, playerId: string): void;
}
type TextPorts = Pick<SpectrumPorts, "isTextBlank">;
const blank = (s: GameState, p: Piece, ports?: TextPorts) =>
  ports ? ports.isTextBlank(s, p) : isTextBlank(s, p);
const formEntries = Object.entries(SPECTRUM_FORM_CODES) as [
  SpectrumEnergyForm,
  string,
][];
const formName = (form: SpectrumEnergyForm) =>
  cards.get(SPECTRUM_FORM_CODES[form])!.name;
const formPiece = (s: GameState) =>
  active(s) ? own(s, String(s.flags.spectrumEnergyFormId || "")) : undefined;

/** A physical setup card stays in play facedown unless this helper returns true.
 * The flag identifies the face, not a second copy or an additional card zone. */
export function spectrumFormFaceup(s: GameState, p: Piece): boolean {
  return (
    !!formEntries.find(([, code]) => code === p.code) &&
    formPiece(s)?.id === p.id
  );
}
export function spectrumEnergyForm(
  s: GameState,
): SpectrumEnergyForm | undefined {
  const p = formPiece(s);
  return p ? formEntries.find(([, code]) => code === p.code)?.[0] : undefined;
}
export function spectrumStats(
  s: GameState,
  ports?: TextPorts,
): { attack: number; thwart: number; defense: number } {
  const p = s.player.form === "hero" ? formPiece(s) : undefined;
  const form = p && !blank(s, p, ports) ? spectrumEnergyForm(s) : undefined;
  return {
    attack: form === "gamma" ? 2 : 0,
    thwart: form === "photon" ? 2 : 0,
    defense: form === "pulsar" ? 2 : 0,
  };
}
export function spectrumRetaliate(s: GameState): number {
  return active(s) &&
    s.player.form === "hero" &&
    s.flags.spectrumRetaliatePhase === phaseKey(s)
    ? Math.max(0, Number(s.flags.spectrumRetaliateAmount || 0))
    : 0;
}
export function spectrumCanChangeEnergyForm(
  s: GameState,
  ports: Pick<SpectrumPorts, "canChangeForm" | "isTextBlank">,
): boolean {
  return (
    active(s) &&
    ports.canChangeForm(s) &&
    !s.player.inPlay.some(
      (p) =>
        p.code === "21026" &&
        (p.dealtTo || p.ownerId || s.activePlayerId) === s.activePlayerId &&
        !ports.isTextBlank(s, p),
    )
  );
}
export function spectrumSetup(s: GameState): Effect[] {
  return active(s) ? [S("setup")] : [];
}
/** Call only after an actual Hero/AE change. Energy transitions do not recurse
 * through the identity Forced Response or consume the voluntary flip budget. */
export function spectrumChangedForm(
  s: GameState,
  ports: Pick<SpectrumPorts, "identityTextBlank">,
): Effect[] {
  if (!active(s) || ports.identityTextBlank(s)) return [];
  if (s.player.form === "alter") {
    delete s.flags.spectrumEnergyFormId;
    return [];
  }
  return [S("hero-entry")];
}
export function spectrumPhaseEnded(s: GameState): void {
  for (const seat of s.players) {
    const flags = seatView(s, seat).flags;
    delete flags.spectrumRetaliatePhase;
    delete flags.spectrumRetaliateAmount;
  }
}

function changeOptions(
  s: GameState,
  ports: SpectrumPorts,
  after: Effect[],
  title: string,
): Option[] {
  if (!spectrumCanChangeEnergyForm(s, ports)) return [];
  return formEntries.flatMap(([form, code]) =>
    s.player.inPlay
      .filter((p) => p.code === code && !spectrumFormFaceup(s, p))
      .map((p) =>
        option(
          p.id,
          `Change to ${formName(form)} energy form`,
          [S("change", { id: p.id, form, after, title })],
          p.code,
        ),
      ),
  );
}
/** All transition aftermath is serialized and delayed to the end of the card
 * ability. Official Gamma Blast ruling: first 7 damage, then Gamma response. */
function change(
  s: GameState,
  form: SpectrumEnergyForm,
  ports: SpectrumPorts,
): Effect[] {
  const from = spectrumEnergyForm(s);
  if (from === form || !spectrumCanChangeEnergyForm(s, ports)) return [];
  const p = s.player.inPlay.find((p) => p.code === SPECTRUM_FORM_CODES[form]);
  if (!p) return [];
  s.flags.spectrumEnergyFormId = p.id;
  ports.refreshDefense(s);
  ports.energyFormChanged(s, from, form);
  return [S("form-response", { id: p.id, form, used: [] })];
}
function targets(
  s: GameState,
  title: string,
  choices: AntManTarget[],
  action: Effect,
  after: Effect[],
  ports: SpectrumPorts,
): void {
  if (!choices.length) {
    ports.queue(s, ...after);
    return;
  }
  ports.choose(
    s,
    title,
    "Choose a target.",
    choices.map((t) =>
      option(t.id, t.label, [{ ...action, target: t.id }, ...after], t.code),
    ),
  );
}
function formResponse(
  s: GameState,
  id: string,
  form: SpectrumEnergyForm,
  ports: SpectrumPorts,
): Effect[] {
  const p = own(s, id, SPECTRUM_FORM_CODES[form]);
  if (!p || !spectrumFormFaceup(s, p) || ports.isTextBlank(s, p)) return [];
  if (form === "gamma" && ports.enemyTargets(s, false).length)
    return [S("gamma-response", { id })];
  if (form === "photon" && ports.schemeTargets(s, false).length)
    return [S("photon-response", { id })];
  if (form === "pulsar" && s.player.hp < ports.heroMaxHP(s))
    return [E("heal", { target: "hero", amount: 1 })];
  return [];
}
export interface SpectrumFormSnapshot {
  id: string;
  form: SpectrumEnergyForm;
}
export function spectrumFormResponseOptions(
  s: GameState,
  snapshot: SpectrumFormSnapshot,
  used: string[],
  after: Effect[],
  ports: SpectrumPorts,
): Option[] {
  if (used.includes(snapshot.id)) return [];
  const effects = formResponse(s, snapshot.id, snapshot.form, ports);
  return effects.length
    ? [
        option(
          snapshot.id,
          `${formName(snapshot.form)} · resolve response`,
          [...effects, ...after],
          SPECTRUM_FORM_CODES[snapshot.form],
        ),
      ]
    : [];
}
export function spectrumResourceSources(
  s: GameState,
  ports: TextPorts,
): PaymentSource[] {
  const form = formPiece(s);
  if (!active(s) || s.player.form !== "hero" || !spectrumEnergyForm(s) || !form)
    return [];
  const c = cards.get(form.code)!;
  const resources: Resource[] = (
    ["energy", "mental", "physical", "wild"] as const
  ).flatMap((r) =>
    Array.from({ length: Number(c[`resource_${r}`] || 0) }, () => r),
  );
  if (!resources.length) return [];
  return s.player.inPlay
    .filter(
      (p) => p.code === "21006" && !p.exhausted && !ports.isTextBlank(s, p),
    )
    .map((p) => ({
      id: p.id,
      name: "Energy Duplication",
      code: p.code,
      resources,
      description: `Exhaust · generate ${resources.join(", ")} from ${c.name}`,
      kind: "ability",
    }));
}
export function spectrumResourceSpent(
  s: GameState,
  id: string,
  ports: TextPorts,
): boolean {
  const p = own(s, id, "21006");
  if (!p) return false;
  need(
    spectrumResourceSources(s, ports).some((source) => source.id === id),
    "Energy Duplication requires a ready source and a faceup energy form.",
  );
  p.exhausted = true;
  return true;
}
export function spectrumAllyEntersPlay(
  s: GameState,
  p: Piece,
  ports: SpectrumPorts,
): Effect[] {
  if (
    s.player.form !== "hero" ||
    p.code !== "21005" ||
    !own(s, p.id) ||
    ports.isTextBlank(s, p) ||
    !changeOptions(s, ports, [], "Blue Marvel").length
  )
    return [];
  return [
    E("optional", {
      title: "Blue Marvel",
      text: "Change energy forms?",
      effects: [S("choose-change", { title: "Blue Marvel" })],
    }),
  ];
}
export function spectrumPlayRestriction(s: GameState, p: Piece): string | null {
  if (
    ["21007", "21008", "21009", "21010"].includes(p.code) &&
    s.player.form !== "hero"
  )
    return "This event requires hero form.";
  if (p.code === "21009" && !spectrumIsDefending(s))
    return "Pulsar Shield requires Spectrum to be defending.";
  return null;
}
export function spectrumEvent(_s: GameState, p: Piece): Effect[] | null {
  switch (p.code) {
    case "21007":
      return [S("gamma-blast")];
    case "21008":
      return [S("photon-speed")];
    case "21009":
      return [S("pulsar-shield")];
    case "21010":
      return [
        S("choose-change", {
          title: "Speed of Light",
          after: [E("draw", { amount: 1 })],
        }),
      ];
    default:
      return null;
  }
}
function spectrumIsDefending(s: GameState): boolean {
  if (!active(s) || s.player.form !== "hero" || !s.attack) return false;
  const defender = s.attack.defender;
  return (
    defender === `hero:${s.activePlayerId}` ||
    (defender === "hero" &&
      (s.attack.targetPlayerId || s.activePlayerId) === s.activePlayerId)
  );
}
/** Open at actual Spectrum defense declaration, including defending another
 * player. Merely being attacked or declaring an ally does not meet the trigger. */
export function spectrumDefenseOptions(
  s: GameState,
  used: string[],
  after: Effect[],
  ports: SpectrumPorts,
): Option[] {
  if (!spectrumIsDefending(s)) return [];
  return s.player.hand
    .filter(
      (p) =>
        p.code === "21009" &&
        !used.includes(p.id) &&
        ports.canPay(s, ports.cardCost(s, p), [], p.id, p.code) &&
        (spectrumEnergyForm(s) === "pulsar" ||
          spectrumCanChangeEnergyForm(s, ports) ||
          (s.player.exhausted && ports.canReadyIdentity(s, s.activePlayerId))),
    )
    .map((p) =>
      option(
        p.id,
        "Pulsar Shield · change to Pulsar and ready Spectrum",
        [S("shield-pay", { id: p.id, used, after })],
        p.code,
      ),
    );
}
export function spectrumAttachmentOptions(
  s: GameState,
  id: string,
  ports: SpectrumPorts,
): Option[] {
  const p = s.attachments.find(
    (p) =>
      p.id === id &&
      p.code === "21029" &&
      p.attachedTo === `hero:${s.activePlayerId}`,
  );
  // Sap Power uses 'your', restricting its action and payment to this owner (RRG7/8).
  if (
    !p ||
    s.player.form !== "alter" ||
    ports.isTextBlank(s, p) ||
    !ports.canPay(s, 2, ["energy", "energy"])
  )
    return [];
  return [
    option(
      "discard",
      "Spend 2 energy resources · discard Sap Power",
      [S("sap-pay", { id })],
      p.code,
    ),
  ];
}
export function spectrumObligationOptions(
  s: GameState,
  id: string,
  ports: SpectrumPorts,
): Option[] {
  const p = s.player.inPlay.find(
    (p) =>
      p.id === id &&
      p.code === "21026" &&
      (p.dealtTo || p.ownerId || s.activePlayerId) === s.activePlayerId,
  );
  if (
    !active(s) ||
    !p ||
    s.player.form !== "alter" ||
    s.player.exhausted ||
    ports.isTextBlank(s, p)
  )
    return [];
  return [
    option(
      "remove",
      "Exhaust Monica Rambeau · remove Loss of Control",
      [S("obligation-remove", { id })],
      p.code,
    ),
  ];
}
export function spectrumAbility(
  s: GameState,
  id: string,
  action: string | undefined,
  ports: SpectrumPorts,
): Effect[] | null {
  const options = [
    ...spectrumAttachmentOptions(s, id, ports),
    ...spectrumObligationOptions(s, id, ports),
  ];
  return options.find((o) => o.id === action)?.effects || null;
}
export function spectrumTurnEnded(
  s: GameState,
  endedPlayerId = s.turnPlayerId,
  ports?: TextPorts,
): Effect[] {
  return s.attachments
    .filter(
      (p) =>
        p.code === "21029" &&
        p.attachedTo === `hero:${endedPlayerId}` &&
        !blank(s, p, ports),
    )
    .map((p) =>
      E("damage", {
        target: p.attachedTo,
        amount: 1,
        source: p.id,
        actorId: endedPlayerId,
      }),
    );
}
export function spectrumEnemyActivated(
  s: GameState,
  p: Piece,
  playerId: string,
  ports: TextPorts,
): Effect[] {
  return p.code === "21027" && !ports.isTextBlank(s, p)
    ? [S("controlled-damage", { playerId, source: p.id })]
    : [];
}
export function spectrumSideSchemeDefeated(
  _s: GameState,
  p: Piece,
  ports: TextPorts,
): Effect[] {
  return p.code === "21028" && !ports.isTextBlank(_s, p)
    ? [S("friendly-damage", { source: p.id })]
    : [];
}
export function spectrumEncounterReveal(
  s: GameState,
  p: Piece,
): Effect[] | null {
  switch (p.code) {
    case "21026": {
      const owner = s.players.find(
        (seat) => seat.heroId === "spectrum" && !seat.eliminated,
      );
      return owner ? [S("obligation", { piece: p, playerId: owner.id })] : [];
    }
    case "21027":
    case "21028":
      return [];
    case "21029":
      return [S("attach", { piece: p, playerId: s.activePlayerId })];
    case "21030":
      return s.player.form === "hero"
        ? [E("damage", { target: "hero", amount: 2, source: p.id })]
        : [E("threat", { target: "main", amount: 2 })];
    default:
      return null;
  }
}
export function spectrumBoost(s: GameState, p: Piece): Effect[] | null {
  return p.code === "21027"
    ? [
        S("controlled-damage", {
          playerId: s.attack?.targetPlayerId || s.activePlayerId,
          source: p.id,
        }),
      ]
    : null;
}

export function resolveSpectrumEffect(
  s: GameState,
  e: Effect,
  ports: SpectrumPorts,
): boolean {
  if (!e.type.startsWith("spectrum:")) return false;
  const after: Effect[] = e.after || [];
  switch (e.type) {
    case "spectrum:setup": {
      need(active(s), "Spectrum's energy forms belong to Monica Rambeau.");
      if (s.flags.spectrumSetupComplete) break;
      for (const [, code] of formEntries) {
        const existing = [
          s.player.deck,
          s.player.hand,
          s.player.discard,
          s.player.inPlay,
        ]
          .flat()
          .filter((p) => p.code === code);
        need(
          existing.length <= 1,
          "Each energy form has one physical setup card.",
        );
        const p = existing[0] || ports.makePiece(s, code);
        for (const zone of [s.player.deck, s.player.hand, s.player.discard]) {
          const index = zone.findIndex((card) => card.id === p.id);
          if (index >= 0) zone.splice(index, 1);
        }
        p.ownerId ||= s.activePlayerId;
        if (!own(s, p.id)) s.player.inPlay.push(p);
      }
      delete s.flags.spectrumEnergyFormId;
      s.flags.spectrumSetupComplete = true;
      break;
    }
    case "spectrum:hero-entry": {
      const options = changeOptions(s, ports, after, "Energy Transformation");
      if (options.length)
        ports.choose(
          s,
          "Energy Transformation",
          "Choose a facedown energy form upgrade.",
          options,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "spectrum:choose-change": {
      const options = changeOptions(
        s,
        ports,
        after,
        e.title || "Change energy forms",
      );
      if (options.length)
        ports.choose(
          s,
          e.title || "Change energy forms",
          "Choose a different energy form.",
          options,
        );
      else ports.queue(s, ...after);
      break;
    }
    case "spectrum:change": {
      const options = changeOptions(
        s,
        ports,
        after,
        e.title || "Change energy forms",
      );
      need(
        options.some(
          (o) =>
            o.id === e.id &&
            o.image === SPECTRUM_FORM_CODES[e.form as SpectrumEnergyForm],
        ),
        "Choose an actual facedown energy form that can be changed to.",
      );
      const responses = change(s, e.form, ports);
      ports.queue(s, ...after, ...responses);
      break;
    }
    case "spectrum:form-response": {
      const used: string[] = e.used || [];
      const resume = S("form-response", {
        id: e.id,
        form: e.form,
        used,
        after,
      });
      const ownResume = S("form-response", {
        id: e.id,
        form: e.form,
        used: [...used, e.id],
        after,
      });
      const options = [
        ...spectrumFormResponseOptions(
          s,
          { id: e.id, form: e.form },
          used,
          [ownResume],
          ports,
        ),
        ...ports.formResponseOptions(s, [resume]),
      ];
      if (options.length)
        ports.choose(
          s,
          `${formName(e.form)} energy form`,
          "Resolve form-change responses in your chosen order, or continue.",
          [...options, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "spectrum:gamma-response":
      targets(
        s,
        "Gamma energy form",
        ports.enemyTargets(s, false),
        E("damage", { amount: 1, source: "hero" }),
        [],
        ports,
      );
      break;
    case "spectrum:photon-response":
      targets(
        s,
        "Photon energy form",
        ports.schemeTargets(s, false),
        E("thwart", { amount: 1, action: false, source: "hero" }),
        [],
        ports,
      );
      break;
    case "spectrum:gamma-blast": {
      need(s.player.form === "hero", "Gamma Blast requires hero form.");
      const already = spectrumEnergyForm(s) === "gamma";
      const responses = change(s, "gamma", ports);
      targets(
        s,
        "Gamma Blast",
        ports.enemyTargets(s, true),
        E("damage", {
          amount: 7,
          attack: true,
          attackInitiated: true,
          overkill: already,
          source: "hero",
        }),
        [...after, ...responses],
        ports,
      );
      break;
    }
    case "spectrum:photon-speed": {
      need(s.player.form === "hero", "Photon Speed requires hero form.");
      const already = spectrumEnergyForm(s) === "photon";
      const responses = change(s, "photon", ports);
      targets(
        s,
        "Photon Speed",
        ports.schemeTargets(s, true, already),
        E("thwart", {
          amount: 4,
          action: true,
          thwartInitiated: true,
          ignoreCrisis: already,
          source: "hero",
        }),
        [...after, ...responses],
        ports,
      );
      break;
    }
    case "spectrum:shield-pay": {
      const p = s.player.hand.find((p) => p.id === e.id && p.code === "21009");
      need(
        p &&
          spectrumDefenseOptions(s, e.used || [], after, ports).some(
            (o) => o.id === e.id,
          ),
        "Pulsar Shield requires an actual Spectrum defense and payable event.",
      );
      ports.queue(
        s,
        E("payRequest", {
          title: "Pulsar Shield",
          cost: ports.cardCost(s, p!),
          piece: p,
          cancelable: false,
          after: [
            E("resolveHandEvent", {
              id: p!.id,
              after: [S("pulsar-shield")],
              continuation: [
                S("defense-window", {
                  used: [...(e.used || []), p!.id],
                  after,
                }),
              ],
            }),
          ],
        }),
      );
      break;
    }
    case "spectrum:pulsar-shield": {
      need(
        spectrumIsDefending(s),
        "Pulsar Shield triggers when Spectrum defends.",
      );
      const already = spectrumEnergyForm(s) === "pulsar";
      const responses = change(s, "pulsar", ports);
      if (already) {
        if (s.flags.spectrumRetaliatePhase !== phaseKey(s))
          s.flags.spectrumRetaliateAmount = 0;
        s.flags.spectrumRetaliatePhase = phaseKey(s);
        s.flags.spectrumRetaliateAmount =
          Number(s.flags.spectrumRetaliateAmount || 0) + 1;
      }
      ports.queue(s, E("ready", { target: "hero" }), ...after, ...responses);
      break;
    }
    case "spectrum:defense-window": {
      const options = spectrumDefenseOptions(s, e.used || [], after, ports);
      if (options.length)
        ports.choose(
          s,
          "Spectrum defense interrupts",
          "Play another Pulsar Shield?",
          [...options, option("continue", "Continue", after)],
        );
      else ports.queue(s, ...after);
      break;
    }
    case "spectrum:obligation":
      ports.giveObligation(s, e.piece, e.playerId);
      break;
    case "spectrum:attach":
      ports.attachIdentity(s, e.piece, e.playerId);
      break;
    case "spectrum:obligation-remove": {
      need(
        spectrumObligationOptions(s, e.id, ports).length,
        "Monica Rambeau must pay the full exhaustion cost.",
      );
      const p = s.player.inPlay.find((p) => p.id === e.id)!;
      s.player.exhausted = true;
      ports.queue(s, E("removeEncounter", { piece: p }));
      break;
    }
    case "spectrum:sap-pay": {
      need(
        spectrumAttachmentOptions(s, e.id, ports).length,
        "Sap Power requires its attached player in alter-ego form and two energy resources.",
      );
      const p = s.attachments.find((p) => p.id === e.id)!;
      ports.queue(
        s,
        E("payRequest", {
          title: "Sap Power",
          cost: 2,
          requirements: ["energy", "energy"],
          cancelable: false,
          after: [E("discardEncounter", { piece: p })],
        }),
      );
      break;
    }
    case "spectrum:controlled-damage": {
      const seat = s.players.find(
        (seat) => seat.id === e.playerId && !seat.eliminated,
      );
      if (!seat) break;
      const view = seatView(s, seat);
      ports.damageBatch(
        s,
        [
          `hero:${seat.id}`,
          ...view.player.inPlay
            .filter((p) => cards.get(p.code)?.type_code === "ally")
            .map((p) => p.id),
        ],
        1,
        e.source,
      );
      break;
    }
    case "spectrum:friendly-damage":
      ports.damageBatch(
        s,
        playerOrder(s).flatMap((seat) => [
          `hero:${seat.id}`,
          ...seatView(s, seat)
            .player.inPlay.filter(
              (p) => cards.get(p.code)?.type_code === "ally",
            )
            .map((p) => p.id),
        ]),
        1,
        e.source,
      );
      break;
    default:
      throw Error(`Unknown Spectrum effect: ${e.type}`);
  }
  return true;
}
