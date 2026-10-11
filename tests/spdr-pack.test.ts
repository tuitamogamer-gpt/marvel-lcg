import { describe, expect, it } from "vitest";
import { card } from "../src/game/cards.js";
import { makePiece, newGame } from "../src/game/engine.js";
import { activateSeat, allInPlay, seatView } from "../src/game/team.js";
import type { Effect, GameState, Piece } from "../src/game/types.js";
import * as pack from "../src/game/spdr-pack.js";

function fixture() {
  let s = newGame({
    heroId: "spiderham",
    aspect: "justice",
    villainId: "rhino",
    seed: 31014,
    pacing: "expert",
    heroes: [
      { heroId: "spiderham", aspect: "justice" },
      { heroId: "spider_man", aspect: "justice" },
    ],
  });
  s.villain.hp = s.villain.maxHp = 50;
  s.encounter.acceleration = 0;
  s.phase = "player";
  s.queue = [];
  s.prompt = null;
  s.review = null;
  s.resolving = [];
  s.minions = [];
  s.sideSchemes = [];
  s.attachments = [];
  s.encounter.deck = [];
  s.encounter.discard = [];
  s.encounter.dealt = [];
  for (const seat of s.players) {
    const v = seatView(s, seat);
    v.player.hand = [];
    v.player.deck = [];
    v.player.discard = [];
    v.player.inPlay = [];
    v.player.form = "hero";
    v.player.exhausted = true;
    v.player.hp = 12;
    v.flags = seat.flags = {};
  }
  s.flags = s.players[0].flags;
  const log: string[] = [];
  const qualify = (v: GameState, e: Effect): Effect => ({
    actorId: v.activePlayerId,
    ...e,
  });
  const traits = (v: GameState, p: Piece) =>
    v.flags[`traits:${p.id}`] === undefined
      ? (card(p).traits || "").split(/\.\s*/).filter(Boolean)
      : String(v.flags[`traits:${p.id}`]).split("|");
  const hasTrait = (v: GameState, id: string, trait: string) =>
    id === "hero" || id.startsWith("hero:")
      ? trait === "Web-Warrior" && !v.flags.noWebWarrior
      : traits(
          v,
          allInPlay(v).find((p) => p.id === id)!,
        ).includes(trait);
  const ports: pack.SpdrPackPorts = {
    queue: (v, ...effects) =>
      v.queue.unshift(...effects.map((e) => qualify(v, e))),
    choose: (v, title, text, options) => {
      v.prompt = {
        kind: "choice",
        title,
        text,
        options: options.map((o) => ({
          ...o,
          effects: o.effects.map((e) => qualify(v, e)),
        })),
      };
    },
    isTextBlank: (v, p) => !!v.flags[`blank:${p.id}`],
    traits,
    hasTrait,
    characterTargets: (v) => [
      ...v.players
        .filter((seat) => !seat.eliminated)
        .map((seat) => ({ id: `hero:${seat.id}`, label: seat.heroId })),
      ...allInPlay(v)
        .filter((p) => card(p).type_code === "ally")
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    controlledTraitCards: (v, trait) => [
      ...(!v.flags.noWebWarrior && trait === "Web-Warrior"
        ? [{ id: `hero:${v.activePlayerId}`, label: "identity" }]
        : []),
      ...v.player.inPlay
        .filter((p) => traits(v, p).includes(trait))
        .map((p) => ({ id: p.id, label: card(p).name, code: p.code })),
    ],
    enemyTargets: (v) => [
      { id: v.villain.id, label: "Rhino" },
      ...v.minions.map((p) => ({
        id: p.id,
        label: card(p).name,
        code: p.code,
      })),
    ],
    printedHP: (v) => Number(v.flags.printedHP ?? 14),
    canDiscardControlled: (v, p) => !v.flags[`permanent:${p.id}`],
    discardControlledCost: (v, id, after) => {
      const p = v.player.inPlay.find((p) => p.id === id)!;
      v.player.inPlay.splice(v.player.inPlay.indexOf(p), 1);
      seatView(v, p.ownerId || v.activePlayerId).player.discard.push(p);
      log.push(`discard:${id}`);
      ports.queue(v, after);
    },
    discardControlled: (v, id, after) => {
      const p = v.player.inPlay.find((p) => p.id === id)!;
      v.player.inPlay.splice(v.player.inPlay.indexOf(p), 1);
      seatView(v, p.ownerId || v.activePlayerId).player.discard.push(p);
      log.push(`discard:${id}`);
      ports.queue(v, ...after);
    },
    attach: (v, id, target) => {
      v.player.inPlay.find((p) => p.id === id)!.attachedTo = target;
    },
    canDealDamageCost: (v, target) =>
      !v.flags[`cannotDamage:${target}`] &&
      ports
        .characterTargets(v)
        .some((t) => t.id === target || target === "hero"),
    dealDamageCost: (v, target, amount, source, after) => {
      const id =
        target === "hero"
          ? v.activePlayerId
          : target.startsWith("hero:")
            ? target.slice(5)
            : undefined;
      if (id) {
        const p = seatView(v, id).player;
        if (p.tough) p.tough = false;
        else p.hp -= amount;
      } else {
        const p = allInPlay(v).find((p) => p.id === target)!;
        if (p.tough) p.tough = false;
        else p.damage += amount;
        if (p.damage >= Number(card(p).health))
          ports.discardControlled(v, p.id, []);
      }
      log.push(`damage:${target}:${source}`);
      ports.queue(v, ...after);
    },
    moveDamage: (v, source, target, amount) => {
      allInPlay(v).find((p) => p.id === source)!.damage -= amount;
      if (target === v.villain.id) v.villain.hp -= amount;
      else v.minions.find((p) => p.id === target)!.damage += amount;
      log.push(`move:${source}:${target}`);
    },
    discardEncounterTop: (v, after) => {
      if (!v.encounter.deck.length && v.encounter.discard.length) {
        v.encounter.deck = v.encounter.discard.splice(0);
        v.encounter.acceleration++;
      }
      const p = v.encounter.deck.shift();
      if (p) {
        v.encounter.discard.push(p);
        ports.queue(v, { ...after, discardedPiece: p });
      }
    },
    revealAvailable: (v, r) =>
      v.encounter.dealt.some((p) => p.id === r.pieceId),
    revealType: (v, r) => {
      const p = v.encounter.dealt.find((p) => p.id === r.pieceId);
      return p && card(p).type_code;
    },
    cancelWhenRevealed: (_v, r) => log.push(`cancel-wr:${r.pieceId}`),
    resolvedTreacheryAvailable: (v, r) =>
      v.resolving.some(
        (p) => p.id === r.pieceId && card(p).type_code === "treachery",
      ),
    captureResolvedTreachery: (v, r, allyId) => {
      const p = v.resolving.find((p) => p.id === r.pieceId)!;
      v.resolving.splice(v.resolving.indexOf(p), 1);
      (v.player.inPlay.find((p) => p.id === allyId)!.storedCards ||= []).push(
        p,
      );
    },
    preventDamage: (_v, packet, amount) => {
      packet.amount -= amount;
      log.push(`prevent:${amount}`);
    },
  };
  const put = (code: string, owner = s.activePlayerId) => {
    const p = makePiece(s, code);
    p.ownerId = owner;
    seatView(s, owner).player.inPlay.push(p);
    return p;
  };
  const piece = (code: string) => makePiece(s, code);
  const run = () => {
    for (let n = 0; s.queue.length && !s.prompt && n < 100; n++) {
      const e = s.queue.shift()!;
      if (e.actorId) activateSeat(s, e.actorId);
      if (pack.resolveSpdrPackEffect(s, e, ports)) continue;
      if (e.type === "optional") {
        ports.choose(s, e.title, "Respond?", [
          { id: "yes", label: "Use response", effects: e.effects },
          { id: "skip", label: "Skip", effects: [] },
        ]);
      } else if (e.type === "ready") s.player.exhausted = false;
      else if (e.type === "draw")
        for (let i = 0; i < e.amount; i++) {
          const p = s.player.deck.shift();
          if (p) s.player.hand.push(p);
        }
      else if (e.type === "damage") {
        const p = allInPlay(s).find((p) => p.id === e.target);
        if (p) {
          p.damage += e.amount;
          if (p.damage >= Number(card(p).health))
            ports.discardControlled(s, p.id, []);
        }
      } else if (e.type === "status") {
        if (e.target === s.villain.id) s.villain.stunned = true;
        else s.minions.find((p) => p.id === e.target)!.stunned = true;
      } else log.push(e.type);
    }
  };
  const choose = (id: string) => {
    s = JSON.parse(JSON.stringify(s));
    const seat = s.players.find((seat) => seat.id === s.activePlayerId)!;
    seat.player = s.player;
    seat.flags = s.flags;
    const o = s.prompt?.options.find((o) => o.id === id);
    expect(o, JSON.stringify(s.prompt)).toBeTruthy();
    s.prompt = null;
    ports.queue(s, ...o!.effects);
    run();
  };
  const start = (...effects: Effect[]) => {
    ports.queue(s, ...effects);
    run();
  };
  return {
    get s() {
      return s;
    },
    ports,
    log,
    put,
    piece,
    run,
    start,
    choose,
  };
}

describe("SP//dr original player pool", () => {
  it("registers twelve native cards and the original Energy Barrier printing", () => {
    expect(pack.SPDR_PACK_SCRIPT_CODES).toHaveLength(12);
    expect(pack.SPDR_PACK_NATIVE_ALIAS_PAIRS).toEqual([["31018", "05017"]]);
    for (const code of [...pack.SPDR_PACK_SCRIPT_CODES, "31018"])
      expect(card(code).pack_code).toBe("spdr");
  });
  it.each(["31023", "31024"])(
    "%s checks printed health instead of current or enhanced health",
    (code) => {
      const f = fixture(),
        p = f.piece(code);
      f.s.player.hp = 1;
      f.s.flags.printedHP = 14;
      expect(pack.spdrPackPlayRestriction(f.s, p, f.ports)).toBeUndefined();
      f.s.player.hp = 30;
      f.s.flags.printedHP = 13;
      expect(pack.spdrPackPlayRestriction(f.s, p, f.ports)).toMatch(/printed/);
    },
  );
  it("Limitless Stamina and Repurpose require hero form", () => {
    const f = fixture();
    f.put("31019");
    f.s.player.form = "alter";
    for (const code of ["31016", "31017", "31023"])
      expect(pack.spdrPackPlayRestriction(f.s, f.piece(code), f.ports)).toMatch(
        /Hero Action/,
      );
  });
  it("checks controlled Web-Warrior cards, not only a hero trait", () => {
    const f = fixture();
    f.s.flags.noWebWarrior = true;
    expect(
      pack.spdrPackPlayRestriction(f.s, f.piece("31022"), f.ports),
    ).toMatch(/Web-Warrior/);
    f.put("31015");
    expect(
      pack.spdrPackPlayRestriction(f.s, f.piece("31022"), f.ports),
    ).toBeUndefined();
  });
  it("Repurpose really discards Tech and uses printed cost despite modifiers", () => {
    const f = fixture(),
      tech = f.put("31019"),
      event = f.piece("31016");
    f.s.flags[`discount:${tech.id}`] = 3;
    f.start(
      ...pack.spdrPackBeforeEvent(f.s, event, pack.spdrPackEvent(f.s, event)!)!,
    );
    f.choose(tech.id);
    expect(f.s.player.discard.some((p) => p.id === tech.id)).toBe(true);
    f.choose("defense");
    expect(f.s.player.exhausted).toBe(false);
    expect(pack.spdrPackCharacterModifiers(f.s, "hero:p1").defense).toBe(3);
    expect(pack.spdrPackCharacterModifiers(f.s, "hero:p2").defense).toBe(0);
  });
  it("Repurpose excludes non-Tech and permanent controlled upgrades", () => {
    const f = fixture(),
      tech = f.put("31019");
    f.put("31024");
    f.s.flags[`permanent:${tech.id}`] = true;
    expect(
      pack.spdrPackPlayRestriction(f.s, f.piece("31016"), f.ports),
    ).toMatch(/discardable/);
  });
  it("Repurpose round bonuses stack and expire for all seats", () => {
    const f = fixture();
    f.start(
      { type: "spdr-pack:repurpose-bonus", power: "attack", amount: 2 },
      { type: "spdr-pack:repurpose-bonus", power: "attack", amount: 3 },
    );
    expect(pack.spdrPackCharacterModifiers(f.s, "hero").attack).toBe(5);
    f.s.round++;
    expect(pack.spdrPackCharacterModifiers(f.s, "hero").attack).toBe(0);
    pack.spdrPackRoundEnded(f.s);
    expect(
      Object.keys(f.s.flags).filter((k) => k.startsWith("spdrRepurpose:")),
    ).toEqual([]);
  });
  it("Thwip Thwip! pays DEAL damage through Tough before either stun", () => {
    const f = fixture(),
      event = f.piece("31017");
    f.s.player.tough = true;
    f.start(
      ...pack.spdrPackBeforeEvent(f.s, event, pack.spdrPackEvent(f.s, event)!)!,
    );
    f.choose("hero:p1");
    expect(f.s.player.hp).toBe(12);
    expect(f.s.player.tough).toBe(false);
    expect(f.s.villain.stunned).toBe(false);
    f.choose(f.s.villain.id);
    f.choose(f.s.villain.id);
    expect(f.s.villain.stunned).toBe(true);
    expect(f.log[0]).toMatch(/^damage:/);
  });
  it("damage cost cannot select another player's Web-Warrior character", () => {
    const f = fixture(),
      other = f.put("31022", "p2");
    f.start(...pack.spdrPackBeforeEvent(f.s, f.piece("31017"), [])!);
    expect(f.s.prompt!.options.map((o) => o.id)).not.toContain(other.id);
    expect(f.s.prompt!.options.map((o) => o.id)).not.toContain("hero:p2");
  });
  it("Otto responds to play from hand, not put into play", () => {
    const f = fixture(),
      otto = f.put("31022");
    f.put("31019");
    expect(pack.spdrPackAllyEntered(f.s, otto, false, f.ports)).toEqual([]);
    expect(pack.spdrPackAllyEntered(f.s, otto, true, f.ports)).toHaveLength(1);
  });
  it.each([
    ["31019", 1],
    ["31024", 0],
  ] as const)("Otto readies %s and draws only for Tech", (code, draw) => {
    const f = fixture(),
      otto = f.put("31022"),
      upgrade = f.put(code);
    upgrade.exhausted = true;
    f.s.player.deck.push(f.piece("31023"));
    f.start(...pack.spdrPackAllyEntered(f.s, otto, true, f.ports)!);
    f.choose("yes");
    f.choose(upgrade.id);
    expect(f.s.player.inPlay.find((p) => p.id === upgrade.id)!.exhausted).toBe(
      false,
    );
    expect(f.s.player.hand).toHaveLength(draw);
  });
  it("Otto cannot ready a different player's upgrade", () => {
    const f = fixture(),
      otto = f.put("31022"),
      own = f.put("31024"),
      other = f.put("31019", "p2");
    f.start(...pack.spdrPackAllyEntered(f.s, otto, true, f.ports)!);
    f.choose("yes");
    expect(f.s.prompt!.options.map((o) => o.id)).toEqual([own.id]);
    expect(f.s.prompt!.options.map((o) => o.id)).not.toContain(other.id);
  });
  it("Daredevil moves damage to actual attacker without damaging through Tough", () => {
    const f = fixture(),
      dd = f.put("31014");
    dd.damage = 2;
    f.s.villain.tough = true;
    f.start(...pack.spdrPackAllyDefended(f.s, dd, f.s.villain.id, f.ports));
    f.choose("yes");
    expect(f.s.player.inPlay.find((p) => p.id === dd.id)!.damage).toBe(1);
    expect(f.s.villain.hp).toBe(49);
    expect(f.s.villain.tough).toBe(true);
  });
  it("defeated or blank Daredevil cannot respond", () => {
    const f = fixture(),
      dd = f.put("31014");
    dd.damage = 1;
    f.s.flags[`blank:${dd.id}`] = true;
    expect(pack.spdrPackAllyDefended(f.s, dd, f.s.villain.id, f.ports)).toEqual(
      [],
    );
    delete f.s.flags[`blank:${dd.id}`];
    f.s.player.inPlay.splice(0, 1);
    expect(pack.spdrPackAllyDefended(f.s, dd, f.s.villain.id, f.ports)).toEqual(
      [],
    );
  });
  it("Noir captures only actual resolved physical treachery and saves it facedown", () => {
    const f = fixture(),
      noir = f.put("31015"),
      treachery = f.piece("01104");
    f.s.resolving.push(treachery);
    const receipt = {
      token: "real",
      playerId: "p1",
      pieceId: treachery.id,
      resolved: true,
    };
    f.start(...pack.spdrPackTreacheryResolved(f.s, receipt, f.ports));
    f.choose("yes");
    const saved = JSON.parse(JSON.stringify(f.s)) as GameState;
    const actual = saved.player.inPlay.find((p) => p.id === noir.id)!;
    expect(actual.storedCards?.map((p) => p.id)).toEqual([treachery.id]);
    expect(saved.resolving).toEqual([]);
    expect(pack.spdrPackAllyStats(saved, actual, f.ports)).toEqual({
      attack: 1,
      thwart: 1,
    });
  });
  it.each([false, true])(
    "Noir checks resolved=%s and maximum three",
    (resolved) => {
      const f = fixture(),
        noir = f.put("31015"),
        t = f.piece("01104");
      f.s.resolving.push(t);
      const receipt = {
        token: "real",
        playerId: "p1",
        pieceId: t.id,
        resolved,
      };
      expect(
        pack.spdrPackTreacheryResolved(f.s, receipt, f.ports),
      ).toHaveLength(resolved ? 1 : 0);
      noir.storedCards = [f.piece("01104"), f.piece("01104"), f.piece("01104")];
      expect(pack.spdrPackTreacheryResolved(f.s, receipt, f.ports)).toEqual([]);
    },
  );
  it("Noir needs another controlled Web-Warrior card, not itself or teammate", () => {
    const f = fixture(),
      noir = f.put("31015"),
      t = f.piece("01104");
    f.s.flags.noWebWarrior = true;
    f.put("31022", "p2");
    f.s.resolving.push(t);
    const r = { token: "real", playerId: "p1", pieceId: t.id, resolved: true };
    expect(pack.spdrPackTreacheryResolved(f.s, r, f.ports)).toEqual([]);
    f.put("31022");
    expect(pack.spdrPackTreacheryResolved(f.s, r, f.ports)).toHaveLength(1);
    expect(noir.storedCards).toBeUndefined();
  });
  it("Noir blank text resets X to zero without exposing stored cards", () => {
    const f = fixture(),
      noir = f.put("31015");
    noir.storedCards = [f.piece("01104"), f.piece("01104")];
    f.s.flags[`blank:${noir.id}`] = true;
    expect(pack.spdrPackAllyStats(f.s, noir, f.ports)).toEqual({
      attack: 0,
      thwart: 0,
    });
    expect(noir.storedCards).toHaveLength(2);
  });
  it.each([
    ["01104", true],
    ["01103", false],
  ] as const)(
    "Spider-Tingle blind %s costs damage and cancels only treachery WR",
    (code, cancels) => {
      const f = fixture(),
        tingle = f.put("31020"),
        encounter = f.piece(code);
      f.s.encounter.dealt.push(encounter);
      const r = { token: "blind", playerId: "p1", pieceId: encounter.id };
      const options = pack.spdrPackEncounterRevealOptions(
        f.s,
        r,
        [{ type: "resume-reveal" }],
        f.ports,
      );
      expect(options[0].image).toBe("31020");
      expect(JSON.stringify(options)).not.toContain(encounter.code);
      f.start(...options[0].effects);
      f.choose("hero:p1");
      expect(f.s.player.hp).toBe(11);
      expect(f.log.includes(`cancel-wr:${encounter.id}`)).toBe(cancels);
      expect(f.s.player.inPlay.some((p) => p.id === tingle.id)).toBe(!cancels);
      expect(f.log.at(-1)).toBe("resume-reveal");
      expect(pack.spdrPackEncounterRevealOptions(f.s, r, [], f.ports)).toEqual(
        [],
      );
    },
  );
  it("Spider-Tingle requires its source still in play after damage cost", () => {
    const f = fixture(),
      tingle = f.put("31020"),
      encounter = f.piece("01104");
    f.s.encounter.dealt.push(encounter);
    const r = { token: "blind", playerId: "p1", pieceId: encounter.id };
    f.s.player.inPlay = [];
    f.start({
      type: "spdr-pack:tingle-paid",
      id: tingle.id,
      receipt: r,
      after: [{ type: "resume-reveal" }],
    });
    expect(f.log).toEqual(["resume-reveal"]);
  });
  it("Spider-Ham discards actual encounter top and counts only boost icons", () => {
    const f = fixture(),
      ham = f.put("31021"),
      boost = f.piece("01106");
    f.s.encounter.deck.push(boost);
    f.start(...pack.spdrPackAllyUsed(f.s, ham, "attack", true, f.ports));
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([boost.id]);
    expect(f.s.player.inPlay.find((p) => p.id === ham.id)!.damage).toBe(
      card(boost).boost,
    );
  });
  it("Spider-Ham response reshuffles a real empty encounter deck and keeps actual card", () => {
    const f = fixture(),
      ham = f.put("31021"),
      boost = f.piece("01106");
    f.s.encounter.discard.push(boost);
    const before = f.s.encounter.acceleration;
    f.start(...pack.spdrPackAllyUsed(f.s, ham, "thwart", true, f.ports));
    expect(f.s.encounter.acceleration).toBe(before + 1);
    expect(f.s.encounter.discard.map((p) => p.id)).toEqual([boost.id]);
  });
  it("Spider-Ham does not discard after stun replacement or blank text", () => {
    const f = fixture(),
      ham = f.put("31021");
    expect(pack.spdrPackAllyUsed(f.s, ham, "attack", false, f.ports)).toEqual(
      [],
    );
    f.s.flags[`blank:${ham.id}`] = true;
    expect(pack.spdrPackAllyUsed(f.s, ham, "thwart", true, f.ports)).toEqual(
      [],
    );
  });
  it("Forcefield Generator enters with six uses and obeys max one", () => {
    const f = fixture(),
      generator = f.put("31019");
    pack.spdrPackCardEntered(f.s, generator);
    expect(generator.counters).toBe(6);
    expect(
      pack.spdrPackPlayRestriction(f.s, f.piece("31019"), f.ports),
    ).toMatch(/max 1/);
  });
  it.each([2, 8])(
    "Forcefield prevents min(6,%s) mandatory damage and discards at zero",
    (damage) => {
      const f = fixture(),
        g = f.put("31019");
      pack.spdrPackCardEntered(f.s, g);
      const packet = {
        type: "actual-packet",
        target: "hero",
        amount: damage,
        source: f.s.villain.id,
      };
      f.start(...pack.spdrPackForcedDamage(f.s, packet, f.ports)!);
      expect(f.log[0]).toBe(`prevent:${Math.min(6, damage)}`);
      expect(f.s.player.inPlay.some((p) => p.id === g.id)).toBe(damage < 6);
      if (damage >= 6)
        expect(f.s.player.discard.map((p) => p.id)).toContain(g.id);
    },
  );
  it("Forcefield protects only its controller's identity", () => {
    const f = fixture(),
      g = f.put("31019");
    pack.spdrPackCardEntered(f.s, g);
    expect(
      pack.spdrPackForcedDamage(
        f.s,
        { type: "damage", target: "hero:p2", amount: 4 },
        f.ports,
      ),
    ).toBeNull();
    expect(
      pack.spdrPackForcedDamage(
        f.s,
        { type: "damage", target: "hero", amount: 0 },
        f.ports,
      ),
    ).toBeNull();
  });
  it("Tough takes precedence over Forcefield mandatory would-take prevention", () => {
    const f = fixture(),
      g = f.put("31019");
    pack.spdrPackCardEntered(f.s, g);
    f.s.player.tough = true;
    expect(
      pack.spdrPackForcedDamage(
        f.s,
        { type: "damage", target: "hero", amount: 4 },
        f.ports,
      ),
    ).toBeNull();
    expect(g.counters).toBe(6);
  });
  it("Unshakable adds steady to controller's identity in either form and respects blank", () => {
    const f = fixture(),
      u = f.put("31024");
    f.s.player.form = "alter";
    expect(pack.spdrPackCharacterSteady(f.s, "hero", f.ports)).toBe(true);
    expect(pack.spdrPackCharacterSteady(f.s, "hero:p2", f.ports)).toBe(false);
    f.s.flags[`blank:${u.id}`] = true;
    expect(pack.spdrPackCharacterSteady(f.s, "hero", f.ports)).toBe(false);
  });
  it("Clarity attaches to friendly characters, max one per actual character", () => {
    const f = fixture(),
      c = f.put("31029"),
      second = f.piece("31029"),
      ally = f.put("31022");
    f.start(...pack.spdrPackCardEntered(f.s, c));
    f.choose("hero:p2");
    expect(f.s.player.inPlay.find((p) => p.id === c.id)!.attachedTo).toBe(
      "hero:p2",
    );
    expect(
      pack.spdrPackAttachmentTargets(f.s, second, f.ports)?.map((t) => t.id),
    ).not.toContain("hero:p2");
    expect(
      pack.spdrPackAttachmentTargets(f.s, second, f.ports)?.map((t) => t.id),
    ).toContain(ally.id);
  });
  it("Clarity pays actual damage before generated-resource continuation", () => {
    const f = fixture(),
      c = f.put("31029");
    c.attachedTo = "hero:p2";
    expect(pack.spdrPackResourceSources(f.s, f.ports)[0].resources).toEqual([
      "wild",
    ]);
    expect(
      pack.spdrPackResourceSpent(
        f.s,
        c.id,
        [{ type: "generate-wild" }],
        f.ports,
      ),
    ).toBe(true);
    f.run();
    expect(seatView(f.s, "p2").player.hp).toBe(11);
    expect(f.log).toEqual([`damage:hero:p2:${c.id}`, "generate-wild"]);
    expect(pack.spdrPackResourceSources(f.s, f.ports)).toEqual([]);
  });
  it("Clarity remains a paid deal-damage cost through Tough", () => {
    const f = fixture(),
      c = f.put("31029");
    c.attachedTo = "hero:p1";
    f.s.player.tough = true;
    pack.spdrPackResourceSpent(f.s, c.id, [{ type: "generate-wild" }], f.ports);
    f.run();
    expect(f.s.player.hp).toBe(12);
    expect(f.s.player.tough).toBe(false);
    expect(f.log.at(-1)).toBe("generate-wild");
  });
  it("Clarity Hero Resource cannot act in alter ego or while blank", () => {
    const f = fixture(),
      c = f.put("31029");
    c.attachedTo = "hero:p1";
    f.s.player.form = "alter";
    expect(pack.spdrPackResourceSources(f.s, f.ports)).toEqual([]);
    f.s.player.form = "hero";
    f.s.flags[`blank:${c.id}`] = true;
    expect(pack.spdrPackResourceSources(f.s, f.ports)).toEqual([]);
  });
});
