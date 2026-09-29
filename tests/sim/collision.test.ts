import { describe, expect, it } from "vitest";
import { WORLD } from "../../src/config/world";
import { Rng } from "../../src/core/rng";
import { makeBody } from "../../src/sim/body";
import { moveBody, overlapsRock } from "../../src/sim/collision";
import { Cell } from "../../src/world/grid";
import { openGrid } from "./helpers";

const DT = 1 / 60;
const T = WORLD.tile;

describe("colisão", () => {
  it("um corpo a 640 px/s não atravessa uma parede de 1 bloco", () => {
    const grid = openGrid(40, 20);
    grid.fill(20, 2, 20, 17, Cell.Rock);
    for (const vx of [640, -640]) {
      const b = makeBody(vx > 0 ? 17 * T : 24 * T, 10 * T, 9, 7.65);
      b.vx = vx;
      for (let i = 0; i < 60; i++) {
        moveBody(b, grid, DT);
        b.vx = vx;
      }
      if (vx > 0) expect(b.x).toBeLessThan(20 * T);
      else expect(b.x).toBeGreaterThan(21 * T);
      expect(overlapsRock(grid, b.x, b.y, b.collR)).toBe(false);
    }
  });

  it("encosta na face do bloco, com a margem, e zera só a velocidade do eixo que bateu", () => {
    const grid = openGrid(40, 20);
    grid.fill(20, 2, 20, 17, Cell.Rock);
    const b = makeBody(19 * T, 10 * T, 9, 7.65);
    b.vy = 120;
    for (let i = 0; i < 10; i++) {
      b.vx = 300; // continua empurrando contra a parede
      moveBody(b, grid, DT);
    }
    expect(b.x).toBeCloseTo(20 * T - 7.65 - WORLD.skin, 9);
    expect(b.vx).toBe(0);
    expect(b.vy).toBe(120);
    expect(b.blockedX).toBe(true);
    // deslizou pela parede
    expect(b.y).toBeGreaterThan(10 * T + 15);
  });

  it("para no chão sem afundar", () => {
    const grid = openGrid(20, 20);
    const b = makeBody(10 * T, 10 * T, 9, 7.65);
    b.vy = 640;
    for (let i = 0; i < 120; i++) {
      moveBody(b, grid, DT);
      b.vy = 640;
    }
    expect(b.y).toBeCloseTo(18 * T - 7.65 - WORLD.skin, 9);
  });

  it("nenhum corpo termina um passo dentro da rocha (teste aleatório)", () => {
    const rng = new Rng(2024);
    for (let trial = 0; trial < 40; trial++) {
      const grid = openGrid(40, 30);
      for (let k = 0; k < 60; k++) {
        const x = rng.int(3, 36);
        const y = rng.int(3, 26);
        grid.fill(x, y, x + rng.int(0, 2), y + rng.int(0, 2), Cell.Rock);
      }
      const r = rng.pick([7.65, 9.35, 11, 23]);
      let b = makeBody(0, 0, r, r);
      // acha um ponto livre para nascer
      for (let tries = 0; tries < 1000; tries++) {
        b = makeBody(rng.range(60, 740), rng.range(60, 540), r, r);
        if (!overlapsRock(grid, b.x, b.y, r)) break;
      }
      if (overlapsRock(grid, b.x, b.y, r)) continue;
      for (let i = 0; i < 300; i++) {
        if (i % 20 === 0) {
          const a = rng.range(0, Math.PI * 2);
          const s = rng.range(50, 900);
          b.vx = Math.cos(a) * s;
          b.vy = Math.sin(a) * s;
        }
        moveBody(b, grid, DT);
        expect(overlapsRock(grid, b.x, b.y, r), `tentativa ${trial}, passo ${i}`).toBe(false);
      }
    }
  });

  it("um corpo que aparece dentro da rocha é recolocado no espaço livre mais próximo", () => {
    const grid = openGrid(20, 20);
    grid.fill(8, 8, 11, 11, Cell.Rock);
    const b = makeBody(10 * T, 10 * T, 9, 7.65);
    const warn = console.warn;
    console.warn = () => {};
    try {
      moveBody(b, grid, DT);
    } finally {
      console.warn = warn;
    }
    expect(overlapsRock(grid, b.x, b.y, b.collR)).toBe(false);
  });
});
