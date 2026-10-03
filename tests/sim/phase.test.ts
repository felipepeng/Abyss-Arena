import { describe, expect, it } from "vitest";
import { CRAB } from "../../src/config/bosses/crab";
import { PHASE_FLOW, WAVES } from "../../src/config/waves";
import { hurtPlayer } from "../../src/sim/combat";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, stepWorld, type World } from "../../src/sim/world";
import { RIFT } from "../../src/world/maps/rift";
import { intent, STEP } from "./helpers";

// ARCHITECTURE §10.2, fase: sequência de estados; a onda só termina com todos mortos;
// `failed` a partir de qualquer estado. E o nascimento das ondas (GDD §3.1).

const idle = intent();

/** Roda até a fase chegar em `state` (ou estourar o limite de passos). */
function runUntil(w: World, pred: (w: World) => boolean, maxSteps = 20000, each?: (w: World) => void): number {
  for (let i = 0; i < maxSteps; i++) {
    if (pred(w)) return i;
    if (w.hitStopMs > 0) {
      w.hitStopMs -= STEP;
      continue;
    }
    stepWorld(w, idle, STEP);
    each?.(w);
  }
  throw new Error(`condição não alcançada em ${maxSteps} passos (fase: ${w.phase?.state})`);
}

/** Mata todos os inimigos das ondas, como um jogador perfeito. */
const killWave = (w: World) => {
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.get(i);
    if (e.fromWave) e.dead = true;
  }
};

describe("fluxo da fase", () => {
  it("segue intro → onda 1 → intervalo → onda 2 → intervalo → onda 3 → intervalo → chefe", () => {
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    const states: string[] = [];
    runUntil(w, (w) => w.phase?.state === "boss", 40000, (w) => {
      killWave(w);
      for (const e of w.events.list) if (e.t === "phaseChanged") states.push(`${e.state}${e.state === "wave" ? e.wave : ""}`);
    });
    expect(states).toEqual(["wave1", "interlude", "wave2", "interlude", "wave3", "interlude", "bossIntro", "boss"]);
  });

  it("o cartão de título dura 2,5 s e nada nasce durante ele", () => {
    const w = createMapWorld(RIFT, 1);
    const steps = runUntil(w, (w) => w.phase?.state === "wave");
    expect(steps * STEP).toBeCloseTo(PHASE_FLOW.introMs, -2);
    expect(w.enemies.count).toBe(0);
  });

  it("a onda só termina quando todos os inimigos dela morrem", () => {
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    runUntil(w, (w) => w.phase?.state === "wave");
    // espera a onda 1 inteira nascer (4 peixes, em duas levas)
    runUntil(w, (w) => w.phase?.surges.length === 0 && w.phase.queue.length === 0 && w.phase.pending.length === 0);
    for (let i = 0; i < 600; i++) stepWorld(w, idle, STEP);
    expect(w.phase?.state).toBe("wave");
    killWave(w);
    stepWorld(w, idle, STEP);
    stepWorld(w, idle, STEP);
    expect(w.phase?.state).toBe("interlude");
  });

  it("nascimento: um a cada 600 ms, avisado 500 ms antes, no máximo 6 vivos", () => {
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    // uma fila grande para testar o teto
    runUntil(w, (w) => w.phase?.state === "wave");
    const f = w.phase;
    if (!f) throw new Error("sem fase");
    f.surges.length = 0;
    f.queue = Array.from({ length: 12 }, () => ({ kind: "fish" as const, pattern: "scatter" as const, zone: -1, ang: 0 }));
    const warnAt: number[] = [];
    let firstSpawnAt = -1;
    let maxAlive = 0;
    for (let i = 0; i < 900; i++) {
      stepWorld(w, idle, STEP);
      for (const e of w.events.list) if (e.t === "spawnWarn") warnAt.push(w.timeMs);
      let alive = 0;
      for (let k = 0; k < w.enemies.count; k++) if (w.enemies.get(k).fromWave) alive++;
      if (alive > 0 && firstSpawnAt < 0) firstSpawnAt = w.timeMs;
      // os anunciados contam para o teto: senão um sétimo poderia estar a caminho
      maxAlive = Math.max(maxAlive, alive + f.pending.length);
    }
    expect(maxAlive).toBe(WAVES.maxAlive);
    // intervalo entre avisos consecutivos (enquanto há vaga): 600 ms
    expect((warnAt[1] ?? 0) - (warnAt[0] ?? 0)).toBeCloseTo(WAVES.spawnIntervalMs, -1);
    // o primeiro nasce 500 ms depois do primeiro aviso
    expect(firstSpawnAt - (warnAt[0] ?? 0)).toBeCloseTo(WAVES.spawnWarnMs, -1);
  });

  it("os inimigos nascem nas zonas, a pelo menos 220 px do jogador", () => {
    const w = createMapWorld(RIFT, 3);
    w.godMode = true;
    let checked = 0;
    runUntil(w, (w) => w.phase?.state === "wave");
    for (let i = 0; i < 2000 && checked < 10; i++) {
      stepWorld(w, idle, STEP);
      for (const e of w.events.list) {
        if (e.t !== "spawnWarn") continue;
        checked++;
        expect(Math.hypot(e.x - w.player.x, e.y - w.player.y)).toBeGreaterThanOrEqual(WAVES.minDistFromPlayer);
        const inZone = RIFT.markers.spawnZones.some(
          (z) => e.x >= z.x * 20 && e.x <= (z.x + z.w) * 20 && e.y >= z.y * 20 && e.y <= (z.y + z.h) * 20,
        );
        expect(inZone).toBe(true);
      }
      killWave(w);
    }
    expect(checked).toBeGreaterThan(3);
  });

  it("vai para `failed` de qualquer estado quando o jogador morre", () => {
    for (const target of ["intro", "wave", "interlude", "bossIntro", "boss"] as const) {
      const w = createMapWorld(RIFT, 1);
      w.godMode = true;
      if (target === "bossIntro" || target === "boss") debugSkipToBoss(w);
      runUntil(w, (w) => w.phase?.state === target, 40000, killWave);
      w.godMode = false;
      w.player.invulnMs = 0;
      hurtPlayer(w, 1000, 0, 0);
      stepWorld(w, idle, STEP);
      expect(w.phase?.state, `a partir de ${target}`).toBe("failed");
    }
  });

  it("tentar de novo com a mesma semente reconstrói o mesmo mapa", () => {
    const a = createMapWorld(RIFT, 77);
    const b = createMapWorld(RIFT, 77);
    expect(Array.from(a.grid.cells)).toEqual(Array.from(b.grid.cells));
  });
});

describe("chefe", () => {
  it("durante a entrada não age e não sofre dano; depois, sim", () => {
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    debugSkipToBoss(w);
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    // jogador colado no chefe, estocando
    w.player.x = boss.x - 50;
    w.player.y = boss.y;
    const atk = intent({ aimX: boss.x, aimY: boss.y, attackPressed: true, attackHeld: true, attackPressedByMouse: true });
    const x0 = boss.x;
    for (let i = 0; i < 30; i++) {
      stepWorld(w, i % 25 === 0 ? atk : { ...idle, aimX: boss.x, aimY: boss.y }, STEP);
      w.player.x = boss.x - 50;
      w.player.y = boss.y;
    }
    expect(boss.hp).toBe(CRAB.hp);
    expect(boss.x).toBe(x0);
    runUntil(w, (w) => w.phase?.state === "boss");
    expect(boss.active).toBe(true);
  });

  it("a investida bate numa formação e termina antes do tempo", () => {
    // jogador atrás da formação da direita (baixo): a investida para na rocha
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    debugSkipToBoss(w);
    runUntil(w, (w) => w.phase?.state === "boss");
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    let impacts = 0;
    let dashes = 0;
    for (let i = 0; i < 3000 && impacts === 0; i++) {
      // o jogador fica escondido atrás da formação de baixo à direita
      w.player.x = 66 * 20;
      w.player.y = 25 * 20;
      w.player.vx = w.player.vy = 0;
      stepWorld(w, idle, STEP);
      for (const e of w.events.list) {
        if (e.t === "bossImpact") impacts++;
        if (e.t === "attackStart" && e.attack === "dash") dashes++;
      }
    }
    expect(dashes).toBeGreaterThan(0);
    expect(impacts).toBeGreaterThan(0);
  });

  it("sorteio: sem repetir demais o mesmo ataque (reroll de 60%)", () => {
    const w = createMapWorld(RIFT, 11);
    w.godMode = true;
    debugSkipToBoss(w);
    const attacks: string[] = [];
    runUntil(w, () => attacks.length >= 200, 400000, (w) => {
      for (const e of w.events.list) if (e.t === "telegraph" && e.source === "crab") attacks.push(e.attack);
    });
    let repeats = 0;
    for (let i = 1; i < attacks.length; i++) if (attacks[i] === attacks[i - 1]) repeats++;
    // sem reroll, ~1/3 das trocas repetiriam; com reroll de 60%, ~1/3 × 0,4 + ... ≈ 13–20%
    expect(repeats / (attacks.length - 1)).toBeLessThan(0.25);
    expect(new Set(attacks)).toEqual(new Set(["dash", "pinch", "call"]));
  });

  it("muda de fase abaixo de 50% da vida", () => {
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    debugSkipToBoss(w);
    runUntil(w, (w) => w.phase?.state === "boss");
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    boss.hp = CRAB.hp * 0.5;
    stepWorld(w, idle, STEP);
    expect(boss.phase).toBe(0);
    boss.hp -= 0.01;
    stepWorld(w, idle, STEP);
    expect(boss.phase).toBe(1);
  });

  it("a morte do chefe conclui a fase", () => {
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    debugSkipToBoss(w);
    runUntil(w, (w) => w.phase?.state === "boss");
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    boss.hp = 1;
    // estocadas até acertar
    runUntil(w, (w) => w.phase?.state === "cleared", 5000, (w) => {
      w.player.x = boss.x - 60;
      w.player.y = boss.y;
      stepWorld(w, intent({ aimX: boss.x, aimY: boss.y, attackPressed: true, attackHeld: true, attackPressedByMouse: true }), STEP);
    });
    expect(boss.dead).toBe(true);
  });
});
