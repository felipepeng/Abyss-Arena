import { describe, expect, it } from "vitest";
import { JELLY } from "../../src/config/bosses/jelly";
import { ARENA_BREAK } from "../../src/config/world";
import { len } from "../../src/core/math";
import { startBarrierBreak } from "../../src/sim/barrier";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, stepWorld, type World } from "../../src/sim/world";
import { buildMap } from "../../src/world/builder";
import { Cell } from "../../src/world/grid";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";
import { intent, STEP } from "./helpers";

// A parede quebrável do Coral (M8+): fecha a arena até a Água-viva entrar na fase 2, quando cede
// em onda a partir dela.

const idle = intent();

/** O Coral até a Água-viva estar ativa, com o jogador invencível. */
function bossFight(seed = 1): World {
  const w = createMapWorld(CORAL, seed);
  w.godMode = true;
  debugSkipToBoss(w);
  for (let i = 0; i < 2000 && w.phase?.state !== "boss"; i++) stepWorld(w, idle, STEP);
  return w;
}

const standing = (w: World, cells: readonly number[]): number =>
  cells.filter((idx) => w.grid.get(idx % w.grid.cols, Math.floor(idx / w.grid.cols)) === Cell.Barrier).length;

describe("estilhaçar da parede", () => {
  it("cede em onda, dos blocos mais perto do chefe aos mais longe, no ritmo do config", () => {
    const w = createMapWorld(CORAL, 1);
    const all = buildMap(CORAL, 1).barrier;
    expect(standing(w, all)).toBe(all.length);
    const ox = 1130;
    const oy = 690;
    startBarrierBreak(w, ox, oy);
    expect(w.events.list.some((e) => e.t === "arenaBreak")).toBe(true);
    // depois de meio segundo, ~165 blocos caíram (ritmo do config), e são os mais perto
    for (let i = 0; i < 30; i++) stepWorld(w, idle, STEP);
    const left = standing(w, all);
    const fell = all.length - left;
    expect(fell).toBeGreaterThan(ARENA_BREAK.cellsPerSec * 0.5 - 12);
    expect(fell).toBeLessThan(ARENA_BREAK.cellsPerSec * 0.5 + 12);
    const cols = w.grid.cols;
    const d = (idx: number) => len((idx % cols) * 20 + 10 - ox, Math.floor(idx / cols) * 20 + 10 - oy);
    const farthestFallen = Math.max(...all.filter((i) => w.grid.get(i % cols, Math.floor(i / cols)) !== Cell.Barrier).map(d));
    const nearestStanding = Math.min(...all.filter((i) => w.grid.get(i % cols, Math.floor(i / cols)) === Cell.Barrier).map(d));
    expect(farthestFallen).toBeLessThanOrEqual(nearestStanding + 1e-6);
  });

  it("acaba em ~1,4 s, some com tudo e só mexe nos blocos da parede", () => {
    const w = createMapWorld(CORAL, 1);
    const all = buildMap(CORAL, 1).barrier;
    const before = Array.from(w.grid.cells);
    startBarrierBreak(w, 1130, 690);
    let steps = 0;
    while (w.breaking && steps < 600) {
      stepWorld(w, idle, STEP);
      steps++;
    }
    expect(steps * STEP).toBeGreaterThan((all.length / ARENA_BREAK.cellsPerSec) * 1000 - 100);
    expect(steps * STEP).toBeLessThan((all.length / ARENA_BREAK.cellsPerSec) * 1000 + 100);
    expect(standing(w, all)).toBe(0);
    // nenhum outro bloco mudou
    const set = new Set(all);
    w.grid.cells.forEach((c, i) => {
      if (!set.has(i)) expect(c, `bloco ${i}`).toBe(before[i]);
    });
  });

  it("chamar de novo não recomeça nem repete o evento; e mapas sem parede não fazem nada", () => {
    const w = createMapWorld(CORAL, 1);
    startBarrierBreak(w, 1130, 690);
    stepWorld(w, idle, STEP);
    startBarrierBreak(w, 400, 400); // ignorado: já está quebrando
    expect(w.events.list.filter((e) => e.t === "arenaBreak")).toHaveLength(0);
    const rift = createMapWorld(RIFT, 1);
    startBarrierBreak(rift, 100, 100);
    expect(rift.breaking).toBeNull();
  });

  it("a erosão dos projéteis não toca a parede (só o chefe a quebra)", () => {
    const w = createMapWorld(CORAL, 1);
    const all = buildMap(CORAL, 1).barrier;
    // o bloco da parede, quebrável por erosão? Só rocha comum erode
    const idx = all[0] as number;
    expect(w.grid.cells[idx]).toBe(Cell.Barrier);
    expect(w.grid.cells[idx]).not.toBe(Cell.Rock);
  });
});

describe("a Água-viva quebra a arena na fase 2", () => {
  it("a parede fica de pé na fase 1 e cede quando a vida cruza o limiar da fase 2", () => {
    const w = bossFight();
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    const all = buildMap(CORAL, 1).barrier;
    for (let i = 0; i < 120; i++) stepWorld(w, idle, STEP);
    expect(boss.phase).toBe(0);
    expect(standing(w, all)).toBe(all.length);
    expect(w.breaking).toBeNull();

    boss.hp = boss.maxHp * (JELLY.phaseBelow[1] as number) - 1;
    let broke = false;
    for (let i = 0; i < 4; i++) {
      stepWorld(w, idle, STEP);
      if (w.events.list.some((e) => e.t === "arenaBreak")) broke = true;
    }
    expect(boss.phase).toBe(1);
    expect(broke).toBe(true);
    for (let i = 0; i < 120; i++) stepWorld(w, idle, STEP);
    expect(standing(w, all)).toBe(0);
  });

  it("pular duas fases de uma vez (F5 duas vezes, um golpe forte) também quebra, uma vez só", () => {
    const w = bossFight(2);
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    boss.hp = boss.maxHp * 0.1;
    let breaks = 0;
    for (let i = 0; i < 200; i++) {
      stepWorld(w, idle, STEP);
      breaks += w.events.list.filter((e) => e.t === "arenaBreak").length;
    }
    expect(boss.phase).toBe(2);
    expect(breaks).toBe(1);
  });

  it("as ondas nascem só na arena interna, mesmo sem zona livre (a câmara externa é fechada)", () => {
    const w = createMapWorld(CORAL, 3);
    w.godMode = true;
    const a = CORAL.playArea;
    if (!a) throw new Error("sem arena interna");
    const t = w.grid.tile;
    for (let i = 0; i < 60 * 60; i++) {
      stepWorld(w, idle, STEP);
      for (let k = 0; k < w.enemies.count; k++) {
        const e = w.enemies.get(k);
        expect(e.x >= a.x * t && e.x <= (a.x + a.w) * t && e.y >= a.y * t && e.y <= (a.y + a.h) * t, `${e.kind} em ${e.x | 0},${e.y | 0}`).toBe(true);
      }
      if (w.phase?.state === "wave" && i > 60 * 20) break;
    }
  });
});

describe("Água-viva: vagar pelo salão (fase 2 em diante)", () => {
  /** Roda a luta com o jogador preso em (px, py) e devolve onde a Água-viva foi parar. */
  function settle(phase: number, px: number, py: number, seconds = 22) {
    const w = bossFight(1);
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    boss.hp = boss.maxHp * (phase === 0 ? 0.95 : phase === 1 ? 0.5 : 0.2);
    for (let i = 0; i < seconds * 60; i++) {
      w.player.x = w.player.prevX = px;
      w.player.y = w.player.prevY = py;
      w.player.vx = w.player.vy = 0;
      boss.hp = boss.maxHp * (phase === 0 ? 0.95 : phase === 1 ? 0.5 : 0.2);
      stepWorld(w, idle, STEP);
    }
    return { x: boss.x, y: boss.y, boss, w };
  }

  it("na fase 1 ela segue o jogador (paira sobre ele); da fase 2 em diante fica perto do centro", () => {
    // o jogador vai de um canto da arena interna ao outro: a fase 1 acompanha, a fase 2 quase não
    const A = { x: 620, y: 1100 };
    const B = { x: 1620, y: 1100 };
    for (const [phase, follows] of [[0, true], [1, false], [2, false]] as const) {
      const a = settle(phase, A.x, A.y);
      const b = settle(phase, B.x, B.y);
      const moved = len(a.x - b.x, a.y - b.y);
      const playerMoved = len(A.x - B.x, A.y - B.y);
      if (follows) expect(moved, `fase ${phase + 1}`).toBeGreaterThan(playerMoved * 0.6);
      else expect(moved, `fase ${phase + 1}`).toBeLessThan(playerMoved * 0.5);
    }
  });

  it("não fica grudada no alto: na fase 2 ela vagueia perto do meio do mapa", () => {
    const { boss } = settle(1, 1120, 1100);
    const midY = 1380 / 2;
    expect(Math.abs(boss.y - midY)).toBeLessThan(420);
    expect(boss.y).toBeGreaterThan(200); // longe do teto
  });

  it("recua se o jogador cola nela", () => {
    const w = bossFight(1);
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    boss.hp = boss.maxHp * 0.5;
    stepWorld(w, idle, STEP);
    for (let i = 0; i < 60 * 8; i++) {
      boss.hp = boss.maxHp * 0.5;
      // o jogador fica sempre a 90 px do lado direito dela
      w.player.x = w.player.prevX = boss.x + 90;
      w.player.y = w.player.prevY = boss.y;
      w.player.vx = w.player.vy = 0;
      stepWorld(w, idle, STEP);
    }
    // o jogador fica sempre à direita dela, então "recuar" é ter velocidade para a esquerda
    expect(boss.vx).toBeLessThanOrEqual(0.1);
  });

  it("acelera a cada fase (o teto de velocidade)", () => {
    expect(JELLY.speedByPhase[0]).toBe(JELLY.speed);
    expect(JELLY.speedByPhase[1]).toBeGreaterThan(JELLY.speedByPhase[0] as number);
    expect(JELLY.speedByPhase[2]).toBeGreaterThan(JELLY.speedByPhase[1] as number);
    const { boss } = settle(2, 1120, 1000);
    expect(Math.hypot(boss.vx, boss.vy)).toBeLessThanOrEqual(JELLY.speedByPhase[2] as number);
  });
});
