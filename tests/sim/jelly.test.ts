import { describe, expect, it } from "vitest";
import { JELLY } from "../../src/config/bosses/jelly";
import { PLAYER } from "../../src/config/player";
import { angDiff, len } from "../../src/core/math";
import { hitBoss } from "../../src/sim/combat";
import { BOSS_DEFS } from "../../src/sim/bosses/registry";
import { activateBoss, createBoss } from "../../src/sim/bosses/runner";
import type { Boss } from "../../src/sim/bosses/types";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, stepWorld, type World } from "../../src/sim/world";
import { Cell } from "../../src/world/grid";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";
import { intent, openGrid, openWorld, STEP } from "./helpers";

// A Água-viva depois do M8: 3 fases, mais dificuldade e três ataques novos (onda de choque,
// chamado das medusinhas e farol). O código dos ataques antigos é o do protótipo (a paridade
// roda com os números originais, ver protoJelly.ts).

const idle = intent();
const DEF = BOSS_DEFS.jelly;

/**
 * Uma Água-viva ativa numa arena aberta, com o jogador a `dist` px à direita. Os combos ficam
 * desligados (a chance nunca sai): os testes de um ataque querem só aquele ataque. Os testes dos
 * combos ligam de volta.
 */
function arena(dist = 215, phase = 0): { w: World; b: Boss } {
  const w = openWorld({ grid: openGrid(60, 40), start: { x: 500 + dist, y: 400 } });
  w.rng.chance = () => false;
  const b = createBoss(w, "jelly", 500, 400);
  activateBoss(b);
  b.phase = phase;
  return { w, b };
}

/** Começa o aviso de `attack` agora, como o runner faz ao sortear. */
function force(b: Boss, attack: string): void {
  const atk = DEF.attacks[attack];
  if (!atk) throw new Error(`sem ataque ${attack}`);
  b.state = "telegraph";
  b.attack = attack;
  b.t = b.stateMs = atk.telegraphMs(b);
}

/** Roda até o chefe voltar a pensar (o ataque acabou). Devolve os passos. */
function runAttack(w: World, b: Boss, each?: () => void, max = 60 * 12): number {
  let n = 0;
  for (; n < max; n++) {
    stepWorld(w, idle, STEP);
    each?.();
    if (b.state === "think") break;
  }
  return n;
}

describe("Água-viva: escalada de dificuldade", () => {
  it("tem 3 fases, nos limiares do config", () => {
    expect(DEF.phases).toHaveLength(3);
    expect(DEF.phases.map((p) => p.hpBelow)).toEqual([...JELLY.phaseBelow]);
  });

  it("a cada fase, as pausas encurtam, os avisos encurtam e os padrões enchem", () => {
    const nonIncreasing = (xs: readonly number[]) => xs.every((x, i) => i === 0 || x <= (xs[i - 1] as number));
    const nonDecreasing = (xs: readonly number[]) => xs.every((x, i) => i === 0 || x >= (xs[i - 1] as number));
    expect(nonIncreasing(JELLY.thinkMs)).toBe(true);
    for (const list of [JELLY.ring.telegraphMs, JELLY.beam.telegraphMs, JELLY.pull.telegraphMs, JELLY.shock.telegraphMs, JELLY.call.telegraphMs]) {
      expect(nonIncreasing(list), `${list}`).toBe(true);
    }
    expect(nonIncreasing(JELLY.pull.stingerEveryMs)).toBe(true);
    expect(nonDecreasing(JELLY.ring.count)).toBe(true);
    expect(nonDecreasing(JELLY.ring.waves)).toBe(true);
    expect(nonDecreasing(JELLY.beam.sweepSpeed)).toBe(true);
    expect(nonDecreasing(JELLY.call.count)).toBe(true);
    for (const list of [JELLY.ring.damage, JELLY.shock.damage, JELLY.beam.damage, JELLY.chain.afterShock, JELLY.chain.afterCall, JELLY.chain.afterLighthouse]) {
      expect(nonDecreasing(list), `${list}`).toBe(true);
    }
    expect(nonIncreasing(JELLY.shock.gapHalf)).toBe(true);
  });

  it("os ataques novos entram aos poucos: choque na 1, chamado na 2, farol só na 3", () => {
    const pools = DEF.phases.map((p) => new Set(p.pool));
    expect(pools.map((p) => p.has("shock"))).toEqual([true, true, true]);
    expect(pools.map((p) => p.has("call"))).toEqual([false, true, true]);
    expect(pools.map((p) => p.has("lighthouse"))).toEqual([false, false, true]);
    for (const phase of DEF.phases) for (const name of phase.pool) expect(DEF.attacks[name], name).toBeDefined();
  });

  it("regra 3: ω · distância de flutuação < 250 px/s no raio e no farol, em todas as fases", () => {
    for (const w of JELLY.beam.sweepSpeed) expect(w * JELLY.hoverDist).toBeLessThan(PLAYER.maxSpeed);
    expect(JELLY.lighthouse.sweepSpeed * JELLY.hoverDist).toBeLessThan(PLAYER.maxSpeed);
  });

  it("os capangas somem com o chefe (os dela e os peixes do Caranguejo)", () => {
    const { w, b } = arena(215, 1);
    force(b, "call");
    runAttack(w, b);
    expect(w.enemies.count).toBeGreaterThan(0);
    hitBoss(w, b, b.maxHp + 1, 1, 0);
    expect(b.dead).toBe(true);
    for (let i = 0; i < w.enemies.count; i++) expect(w.enemies.get(i).dead).toBe(true);
  });
});

describe("Água-viva: onda de choque", () => {
  /** Roda o aviso e devolve o ângulo da fresta e o do jogador. */
  function lockGap(w: World, b: Boss): { gap: number; player: number } {
    stepWorld(w, idle, STEP);
    return { gap: b.data.shockGap ?? 0, player: Math.atan2(w.player.y - b.y, w.player.x - b.x) };
  }

  it("a fresta nunca abre em cima do jogador: ele sempre tem que se mexer", () => {
    for (let seed = 1; seed <= 40; seed++) {
      for (const phase of [0, 1, 2]) {
        const { w, b } = arena(215, phase);
        w.rng.next = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed * 977 + phase);
        force(b, "shock");
        const { gap, player } = lockGap(w, b);
        const past = Math.abs(angDiff(gap, player)) - (JELLY.shock.gapHalf[phase] as number);
        expect(past, `semente ${seed} fase ${phase + 1}`).toBeGreaterThanOrEqual(JELLY.shock.gapMinPast - 1e-9);
        expect(past).toBeLessThanOrEqual(JELLY.shock.gapMaxPast + 1e-9);
      }
    }
  });

  it("o anel fere quem está fora da fresta, uma vez só, quando chega nele", () => {
    const { w, b } = arena(215);
    force(b, "shock");
    lockGap(w, b);
    const hpBefore = w.player.hp;
    let hurtAt = -1;
    runAttack(w, b, () => {
      if (hurtAt < 0 && w.player.hp < hpBefore) hurtAt = b.data.shockR ?? -1;
    });
    expect(w.player.hp).toBe(hpBefore - (JELLY.shock.damage[0] as number));
    // acertou quando o anel chegou à distância do jogador
    expect(hurtAt).toBeGreaterThan(215 - 30);
    expect(hurtAt).toBeLessThan(215 + 30);
  });

  it("dentro da fresta, o anel passa e não fere", () => {
    const { w, b } = arena(215);
    force(b, "shock");
    const { gap } = lockGap(w, b);
    w.player.x = b.x + Math.cos(gap) * 215;
    w.player.y = b.y + Math.sin(gap) * 215;
    runAttack(w, b);
    expect(w.player.hp).toBe(PLAYER.hp);
  });

  it("a rocha para o anel: atrás de uma coluna de coral, não fere", () => {
    const w = openWorld({ grid: openGrid(60, 40), start: { x: 760, y: 400 } });
    w.grid.fill(30, 8, 31, 32, Cell.Coral); // x = 600..640, entre ela (500) e o jogador (760)
    const b = createBoss(w, "jelly", 500, 400);
    activateBoss(b);
    force(b, "shock");
    lockGap(w, b);
    // o jogador fica no eixo da coluna, fora da fresta (que abre a >0,25 rad da borda)
    runAttack(w, b);
    expect(w.player.hp).toBe(PLAYER.hp);
  });

  it("o dash atravessa o anel: a invulnerabilidade absorve o toque", () => {
    const { w, b } = arena(215);
    force(b, "shock");
    lockGap(w, b);
    const hpBefore = w.player.hp;
    let dashed = false;
    runAttack(w, b, () => {
      const r = b.data.shockR ?? 0;
      // dá o dash EM DIREÇÃO a ela quando o anel está a ~45 px: os dois se cruzam nos 100 ms de
      // invulnerabilidade (fugir do anel para fora só o adiaria)
      if (!dashed && r > 215 - 45) {
        dashed = true;
        stepWorld(w, intent({ dashHeld: true, aimX: w.player.x - 100, aimY: w.player.y }), STEP);
      }
    });
    expect(dashed).toBe(true);
    expect(w.player.hp).toBe(hpBefore);
  });

  it("termina quando o anel chega ao raio máximo", () => {
    const { w, b } = arena(215);
    force(b, "shock");
    const steps = runAttack(w, b);
    const ms = steps * STEP;
    const expected = JELLY.shock.telegraphMs[0] + ((JELLY.shock.maxRadius - b.radius) / JELLY.shock.speed) * 1000;
    expect(ms).toBeGreaterThan(expected - 100);
    expect(ms).toBeLessThan(expected + 100);
  });
});

describe("Água-viva: chamado das medusinhas", () => {
  const minions = (w: World) => {
    const out = [];
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.get(i);
      if (!e.dead && e.kind === "jellyling") out.push(e);
    }
    return out;
  };

  it("chama 2 na fase 2 e 3 na fase 3, sem cura e fora da contagem da onda", () => {
    for (const [phase, want] of [[1, 2], [2, 3]] as const) {
      const { w, b } = arena(215, phase);
      force(b, "call");
      runAttack(w, b);
      const ms = minions(w);
      expect(ms, `fase ${phase + 1}`).toHaveLength(want);
      for (const m of ms) {
        expect(m.noDrop).toBe(true);
        expect(m.fromWave).toBe(false);
        // nascem ao redor do sino, longe da rocha
        expect(len(m.x - b.x, m.y - b.y)).toBeGreaterThan(b.radius);
      }
    }
  });

  it("os pontos aparecem marcados durante o aviso, e é neles que as crias nascem", () => {
    const { w, b } = arena(215, 2);
    force(b, "call");
    stepWorld(w, idle, STEP);
    const n = b.data.callN ?? 0;
    expect(n).toBe(3);
    const marked = Array.from({ length: n }, (_, i) => [b.data[`callX${i}`] as number, b.data[`callY${i}`] as number]);
    runAttack(w, b);
    for (const [x, y] of marked) {
      expect(minions(w).some((m) => len(m.x - (x as number), m.y - (y as number)) < 20)).toBe(true);
    }
  });

  it("as crias de um mesmo chamado nascem afastadas umas das outras", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const { w, b } = arena(215, 2);
      w.rng.next = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed * 131);
      force(b, "call");
      stepWorld(w, idle, STEP);
      const n = b.data.callN ?? 0;
      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const d = len((b.data[`callX${i}`] ?? 0) - (b.data[`callX${j}`] ?? 0), (b.data[`callY${i}`] ?? 0) - (b.data[`callY${j}`] ?? 0));
          expect(d, `semente ${seed}`).toBeGreaterThanOrEqual(JELLY.call.minSeparation - 1e-6);
        }
      }
    }
  });

  it("respeita o teto de crias vivas", () => {
    const { w, b } = arena(215, 2);
    for (let k = 0; k < 3; k++) {
      force(b, "call");
      runAttack(w, b);
      b.state = "think";
    }
    expect(minions(w).length).toBeLessThanOrEqual(JELLY.call.maxAlive);
  });
});

describe("Água-viva: farol", () => {
  const L = JELLY.lighthouse;
  const fresh = () => {
    const { w, b } = arena(215, 2);
    force(b, "lighthouse");
    stepWorld(w, idle, STEP); // trava o layout
    return { w, b, base: b.data.lhBase ?? 0, dir: b.data.lhDir ?? 1 };
  };
  const at = (b: Boss, ang: number, d = 215) => ({ x: b.x + Math.cos(ang) * d, y: b.y + Math.sin(ang) * d });

  it("o jogador começa dentro da varredura do primeiro raio: tem que se mexer", () => {
    for (let seed = 1; seed <= 30; seed++) {
      const { w, b } = arena(215, 2);
      w.rng.next = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed * 313);
      force(b, "lighthouse");
      stepWorld(w, idle, STEP);
      const base = b.data.lhBase ?? 0;
      const dir = b.data.lhDir ?? 1;
      const pa = Math.atan2(w.player.y - b.y, w.player.x - b.x);
      const frac = (dir * angDiff(base, pa)) / L.sweepRad;
      expect(frac, `semente ${seed}`).toBeGreaterThan(0.2);
      expect(frac).toBeLessThan(0.8);
    }
  });

  it("varre 1,1 rad com 3 raios a 120°: quem fica onde o primeiro passa é atingido, uma vez", () => {
    const { w, b, base, dir } = fresh();
    const p = at(b, base + dir * L.sweepRad * 0.5);
    w.player.x = p.x;
    w.player.y = p.y;
    const hpBefore = w.player.hp;
    runAttack(w, b, () => {
      w.player.x = p.x; // parado, sem o empurrão do dano
      w.player.y = p.y;
      w.player.vx = w.player.vy = 0;
    });
    expect(w.player.hp).toBe(hpBefore - L.damage);
  });

  it("na cunha segura entre dois raios, nada acerta", () => {
    const { w, b, base, dir } = fresh();
    // o meio do vão entre o fim da varredura do raio 0 e o começo da do raio 1
    const safe = base + dir * (L.sweepRad + ((2 * Math.PI) / L.arms - L.sweepRad) / 2);
    const p = at(b, safe);
    runAttack(w, b, () => {
      w.player.x = p.x;
      w.player.y = p.y;
      w.player.vx = w.player.vy = 0;
    });
    expect(w.player.hp).toBe(PLAYER.hp);
  });

  it("perto dela (dentro do vão interno) é seguro, como no raio", () => {
    const { w, b, base, dir } = fresh();
    // logo depois do raio de contato do sino (33,6 + 9 = 42,6 px) e antes de onde o raio começa (48)
    const p = at(b, base + dir * L.sweepRad * 0.5, 45.5);
    runAttack(w, b, () => {
      w.player.x = p.x;
      w.player.y = p.y;
      w.player.vx = w.player.vy = 0;
    });
    expect(w.player.hp).toBe(PLAYER.hp);
  });

  it("a rocha faz sombra nos raios", () => {
    const w = openWorld({ grid: openGrid(60, 40), start: { x: 760, y: 400 } });
    w.grid.fill(30, 8, 31, 32, Cell.Coral);
    const b = createBoss(w, "jelly", 500, 400);
    activateBoss(b);
    b.phase = 2;
    force(b, "lighthouse");
    stepWorld(w, idle, STEP);
    const dir = b.data.lhDir ?? 1;
    // o jogador no eixo da coluna, no meio da varredura de um raio: o coral o protege
    const target = Math.atan2(w.player.y - b.y, w.player.x - b.x);
    b.data.lhBase = target - dir * L.sweepRad * 0.5;
    runAttack(w, b, () => {
      w.player.x = 760;
      w.player.y = 400;
      w.player.vx = w.player.vy = 0;
    });
    expect(w.player.hp).toBe(PLAYER.hp);
  });

  it("dura o tempo de esticar mais o de varrer", () => {
    const { w, b } = fresh();
    // jogador longe: o dano não interfere
    w.player.x = 1400;
    w.player.y = 100;
    const steps = runAttack(w, b);
    const expected =
      L.telegraphMs + ((L.length - L.innerGap) / L.growSpeed) * 1000 + (L.sweepRad / L.sweepSpeed) * 1000;
    expect(steps * STEP).toBeGreaterThan(expected - 250);
    expect(steps * STEP).toBeLessThan(expected + 250);
  });
});

describe("Água-viva: combos", () => {
  it("os combos só existem nas fases finais, e nunca sem aviso", () => {
    const { w, b } = arena(215, 0);
    for (const [name] of [["shock"], ["call"]] as const) {
      force(b, name);
      expect(DEF.attacks[name]?.next?.(b, w)).toBeNull();
    }
    const chained = (phase: number, name: string): number => {
      let n = 0;
      for (let seed = 1; seed <= 200; seed++) {
        const { w: ww, b: bb } = arena(215, phase);
        // sorteio de verdade (a chance real), não o desligado do helper
        const lcg = ((s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296))(seed * 7919);
        ww.rng.next = lcg;
        ww.rng.chance = (p: number) => lcg() < p;
        const c = DEF.attacks[name]?.next?.(bb, ww);
        if (c) {
          n++;
          expect(c.attack).toBe("ring");
          expect(c.telegraphMs).toBe(JELLY.chain.telegraphMs);
        }
      }
      return n;
    };
    // a chance medida bate com a do config (com folga estatística)
    expect(chained(1, "shock") / 200).toBeGreaterThan(JELLY.chain.afterShock[1] - 0.12);
    expect(chained(1, "shock") / 200).toBeLessThan(JELLY.chain.afterShock[1] + 0.12);
    expect(chained(2, "shock") / 200).toBeGreaterThan(JELLY.chain.afterShock[2] - 0.12);
    expect(chained(2, "lighthouse") / 200).toBeGreaterThan(JELLY.chain.afterLighthouse[2] - 0.12);
    expect(chained(1, "lighthouse")).toBe(0);
  });

  it("um combo emenda o anel logo depois, com o aviso curto", () => {
    const { w, b } = arena(215, 2);
    // sorteio que sempre emenda
    w.rng.chance = () => true;
    force(b, "shock");
    let comboWarn = -1;
    for (let i = 0; i < 60 * 8 && comboWarn < 0; i++) {
      stepWorld(w, idle, STEP);
      if (b.state === "telegraph" && b.attack === "ring") comboWarn = b.stateMs;
    }
    expect(comboWarn).toBe(JELLY.chain.telegraphMs);
  });
});

describe("Água-viva: a luta inteira", () => {
  it("na fase 3 usa os ataques novos, e todo ataque avisa antes (regra 2)", () => {
    const w = createMapWorld(CORAL, 4);
    w.godMode = true;
    debugSkipToBoss(w);
    for (let i = 0; i < 2000 && w.phase?.state !== "boss"; i++) stepWorld(w, idle, STEP);
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    const telegraphAt = new Map<string, number>();
    const seen = new Set<string>();
    for (let i = 0; i < 60 * 120; i++) {
      boss.hp = boss.maxHp * 0.15; // trava na fase 3
      stepWorld(w, idle, STEP);
      for (const e of w.events.list) {
        if (e.t === "telegraph" && e.source === "jelly") telegraphAt.set(e.attack, w.timeMs);
        if (e.t === "attackStart" && e.source === "jelly") {
          seen.add(e.attack);
          const t0 = telegraphAt.get(e.attack);
          expect(t0, `${e.attack} atacou sem aviso`).toBeDefined();
          const atk = DEF.attacks[e.attack];
          // o anel emendado de um combo avisa por menos tempo (mas avisa)
          const minWarn = Math.min(atk?.telegraphMs(boss) ?? 0, JELLY.chain.telegraphMs);
          expect(w.timeMs - (t0 ?? 0)).toBeGreaterThanOrEqual(minWarn - 2 * STEP);
        }
      }
    }
    expect(boss.phase).toBe(2);
    for (const name of ["shock", "call", "lighthouse", "ring", "beam"]) expect(seen.has(name), name).toBe(true);
  });

  it("o Leito e o Coral ainda têm os mapas de sempre (o teste de sombra continua valendo)", () => {
    expect(RIFT.boss).toBe("crab");
    expect(CORAL.boss).toBe("jelly");
  });
});
