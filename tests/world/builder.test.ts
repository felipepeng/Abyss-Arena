import { describe, expect, it } from "vitest";
import { CRAB } from "../../src/config/bosses/crab";
import { PLAYER } from "../../src/config/player";
import { overlapsRock } from "../../src/sim/collision";
import { buildMap } from "../../src/world/builder";
import { Cell } from "../../src/world/grid";
import { RIFT } from "../../src/world/maps/rift";

// ARCHITECTURE §10.2, mapas: mesma semente → mesma grade; o procedural não toca células
// fixas; toda zona de nascimento está em água.

const cellsOf = (seed: number) => Array.from(buildMap(RIFT, seed).grid.cells);

describe("construtor de mapas", () => {
  it("a mesma semente gera o mesmo mapa", () => {
    expect(cellsOf(123)).toEqual(cellsOf(123));
  });

  it("sementes diferentes mudam os detalhes", () => {
    expect(cellsOf(1)).not.toEqual(cellsOf(2));
  });

  it("o procedural só escreve em células `~`", () => {
    for (const seed of [1, 2, 3, 99, 0xdeadbeef]) {
      const { grid } = buildMap(RIFT, seed);
      RIFT.layout.forEach((line, cy) => {
        for (let cx = 0; cx < line.length; cx++) {
          const ch = line[cx];
          const cell = grid.get(cx, cy);
          if (ch === "~") expect([Cell.Water, Cell.Rock], `(${cx}, ${cy})`).toContain(cell);
          else if (ch === "P") expect(cell, `(${cx}, ${cy})`).toBe(Cell.Protected);
          else if (ch === ".") expect(cell, `(${cx}, ${cy})`).toBe(Cell.Water);
          else if (ch === "#") expect(cell, `(${cx}, ${cy})`).toBe(Cell.Rock);
        }
      });
    }
  });

  it("o procedural põe algum detalhe (não deixa todo `~` vazio)", () => {
    const { grid } = buildMap(RIFT, 5);
    let rock = 0;
    RIFT.layout.forEach((line, cy) => {
      for (let cx = 0; cx < line.length; cx++) if (line[cx] === "~" && grid.get(cx, cy) === Cell.Rock) rock++;
    });
    expect(rock).toBeGreaterThan(20);
  });

  it("todas as linhas do layout têm o mesmo tamanho", () => {
    const width = RIFT.layout[0]?.length ?? 0;
    for (const line of RIFT.layout) expect(line.length).toBe(width);
    expect(width * 20).toBe(1440);
    expect(RIFT.layout.length * 20).toBe(800);
  });

  it("zonas de nascimento em água fixa; jogador e chefe nascem livres", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const map = buildMap(RIFT, seed);
      for (const z of RIFT.markers.spawnZones) {
        for (let cy = z.y; cy < z.y + z.h; cy++) {
          for (let cx = z.x; cx < z.x + z.w; cx++) expect(RIFT.layout[cy]?.[cx], `zona (${cx}, ${cy})`).toBe(".");
        }
      }
      const p = map.playerStart;
      expect(overlapsRock(map.grid, p.x, p.y, PLAYER.radius * PLAYER.collScale)).toBe(false);
      const b = map.bossSpawn;
      expect(overlapsRock(map.grid, b.x, b.y, CRAB.collRadius)).toBe(false);
    }
  });

  it("as fendas cabem o jogador e não cabem o Caranguejo", () => {
    // fendas nas colunas 14–15 e 56–57, de 40 px: o jogador tem 15,3 px de colisão, o chefe 46
    const { grid } = buildMap(RIFT, 1);
    for (const cx of [14, 56]) {
      const x = (cx + 1) * 20;
      const y = 35.5 * 20;
      expect(overlapsRock(grid, x, y, PLAYER.radius * PLAYER.collScale), `fenda ${cx}`).toBe(false);
      expect(overlapsRock(grid, x, y, CRAB.collRadius), `fenda ${cx}`).toBe(true);
    }
  });
});
