import { describe, expect, it } from "vitest";
import type { EnemyKind } from "../../src/config/kinds";
import { len } from "../../src/core/math";
import { canSee } from "../../src/sim/enemies/perception";
import { stepWorld, type World } from "../../src/sim/world";
import { Cell } from "../../src/world/grid";
import { MAP_LIST } from "../../src/world/maps/registry";
import { measureStuck } from "../balance/stuckMeasure";
import { intent, openGrid, openWorld, STEP } from "./helpers";

// Navegação dos inimigos (sim/nav.ts): quem tem a rocha no caminho a contorna em vez de ficar
// encostado nela. O bug que isto cobre: no Jardim de Corais e no Fosso, peixes, medusinhas e
// vigias ficavam presos atrás de um pilar e a onda nunca terminava.

const idle = intent();

/**
 * Arena com uma parede no meio: o inimigo à esquerda e o jogador à direita não se veem. A parede
 * deixa passagem em cima e embaixo, e o inimigo nasce a menos de 300 px do jogador (o raio de visão
 * do peixe, fora do qual ele só se arrasta).
 */
function wallWorld(kind: EnemyKind): World {
  const grid = openGrid(100, 60);
  grid.fill(40, 20, 41, 40, Cell.Coral);
  const w = openWorld({ grid, start: { x: 940, y: 600 }, enemies: [{ kind, x: 700, y: 600 }] });
  w.godMode = true;
  return w;
}

function run(w: World, ms: number, each: (w: World) => void): void {
  for (let t = 0; t < ms; t += STEP) {
    if (w.hitStopMs > 0) w.hitStopMs -= STEP;
    else stepWorld(w, idle, STEP);
    each(w);
  }
}

describe("contornar a rocha", () => {
  it.each<EnemyKind>(["fish", "circler", "lamprey", "hermit"])("%s chega ao jogador atrás de uma parede", (kind) => {
    const w = wallWorld(kind);
    const e = w.enemies.get(0);
    let nearest = Infinity;
    run(w, 16000, () => {
      nearest = Math.min(nearest, len(w.player.x - e.x, w.player.y - e.y));
    });
    expect(nearest, `${kind} ficou a ${nearest.toFixed(0)} px`).toBeLessThan(150);
  });

  it.each<EnemyKind>(["jellyling", "watcher"])("%s acha um ângulo para ver o jogador atrás de uma parede", (kind) => {
    const w = wallWorld(kind);
    const e = w.enemies.get(0);
    let saw = false;
    run(w, 16000, () => {
      if (canSee(e, w, 2000)) saw = true;
    });
    expect(saw).toBe(true);
  });

  it("com o caminho livre anda em linha reta: o desvio só entra com a rocha no meio", () => {
    const w = openWorld({ start: { x: 1000, y: 600 }, enemies: [{ kind: "fish", x: 600, y: 600 }] });
    w.godMode = true;
    stepWorld(w, idle, STEP);
    expect(w.nav.detour).toBe(false);
    expect(w.nav.wx).toBe(w.player.x);
    expect(w.nav.wy).toBe(w.player.y);
  });

  it("não ataca com a rocha no meio: o peixe não avisa nem investe contra a parede", () => {
    const w = wallWorld("fish");
    const e = w.enemies.get(0);
    // perto o bastante para investir (chargeRange), mas com a parede entre os dois
    e.x = e.prevX = 760;
    w.player.x = w.player.prevX = 880;
    let telegraphed = false;
    run(w, 1200, () => {
      if (e.state === "telegraph" || e.state === "charge") telegraphed = true;
    });
    expect(telegraphed).toBe(false);
  });

  it("o mapa de distâncias se refaz quando a rocha muda", () => {
    const w = wallWorld("fish");
    const e = w.enemies.get(0);
    stepWorld(w, idle, STEP);
    expect(w.nav.detour).toBe(true);
    // abre a parede inteira: o caminho reto fica livre, e o mapa de distâncias se refaz sozinho
    w.grid.fill(40, 20, 41, 40, Cell.Water);
    run(w, 100, () => {});
    expect(w.nav.detour).toBe(false);
    expect(len(e.x - w.player.x, e.y - w.player.y)).toBeLessThan(len(700 - 940, 0));
  });
});

describe("ninguém fica preso nos mapas (jogador parado)", () => {
  for (let m = 0; m < MAP_LIST.length; m++) {
    it(MAP_LIST[m]?.id ?? "", () => {
      for (const seed of [1, 2, 3]) {
        const r = measureStuck(m, seed, 120_000);
        expect(r.stuckEver, `semente ${seed}: ${JSON.stringify(r.kinds)}`).toBe(0);
      }
    });
  }
});
