import { describe, expect, it } from "vitest";
import { EYE } from "../../src/config/bosses/eye";
import { JELLY } from "../../src/config/bosses/jelly";
import { CRAB } from "../../src/config/bosses/crab";
import { PLAYER } from "../../src/config/player";
import { overlapsRock } from "../../src/sim/collision";
import { buildMap } from "../../src/world/builder";
import { Cell } from "../../src/world/grid";
import type { MapDef } from "../../src/world/mapdef";
import { ABYSS } from "../../src/world/maps/abyss";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";
import { beamCoverage } from "./coverage";

// Regras comuns aos três mapas (ARCHITECTURE §10.2) e as de cada um (GDD §7).

const MAPS: readonly [string, MapDef, number][] = [
  ["Leito", RIFT, CRAB.collRadius],
  ["Coral", CORAL, JELLY.collRadius],
  ["Fosso", ABYSS, EYE.collRadius],
];

describe.each(MAPS)("%s", (_name, def, bossR) => {
  it("a mesma semente gera o mesmo mapa; sementes diferentes mudam os detalhes", () => {
    const a = Array.from(buildMap(def, 7).grid.cells);
    expect(Array.from(buildMap(def, 7).grid.cells)).toEqual(a);
    expect(Array.from(buildMap(def, 8).grid.cells)).not.toEqual(a);
  });

  it("o procedural só escreve em células `~`", () => {
    for (const seed of [1, 2, 3]) {
      const { grid } = buildMap(def, seed);
      def.layout.forEach((line, cy) => {
        for (let cx = 0; cx < line.length; cx++) {
          const ch = line[cx];
          const cell = grid.get(cx, cy);
          if (ch === "~") continue;
          const expected =
            ch === "P" ? Cell.Protected : ch === "#" ? Cell.Rock : ch === "B" ? Cell.Barrier : ch === "C" ? Cell.Coral : Cell.Water;
          expect(cell, `(${cx}, ${cy})`).toBe(expected);
        }
      });
    }
  });

  it("zonas de nascimento em água fixa; jogador e chefe nascem livres", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const map = buildMap(def, seed);
      for (const z of def.markers.spawnZones) {
        for (let cy = z.y; cy < z.y + z.h; cy++) {
          for (let cx = z.x; cx < z.x + z.w; cx++) expect(def.layout[cy]?.[cx], `zona (${cx}, ${cy})`).toBe(".");
        }
      }
      expect(overlapsRock(map.grid, map.playerStart.x, map.playerStart.y, PLAYER.radius * PLAYER.collScale)).toBe(false);
      expect(overlapsRock(map.grid, map.bossSpawn.x, map.bossSpawn.y, bossR)).toBe(false);
    }
  });
});

/** A arena interna do Coral (sem a borda de 2 blocos), em blocos. */
const INNER = (() => {
  const a = CORAL.playArea;
  if (!a) throw new Error("o Coral define a arena interna");
  return { x0: a.x + 2, y0: a.y + 2, x1: a.x + a.w - 2, y1: a.y + a.h - 2 };
})();

/** Quebra a parede quebrável, como a Água-viva faz na fase 2. */
function breakWall(map: ReturnType<typeof buildMap>): void {
  for (const idx of map.barrier) map.grid.set(idx % map.grid.cols, Math.floor(idx / map.grid.cols), Cell.Water);
}

describe("Jardim de Corais", () => {
  it("na arena interna, o raio é cortado antes de 300 px em 35 a 50 das 64 direções (GDD §7.2)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const c = beamCoverage(buildMap(CORAL, seed).grid, 300, 64, 3, INNER);
      expect(c, `semente ${seed}`).toBeGreaterThanOrEqual(35);
      expect(c, `semente ${seed}`).toBeLessThanOrEqual(50);
    }
  });

  it("com a parede quebrada, o salão aberto ainda dá cobertura (25 a 45 das 64 direções)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const map = buildMap(CORAL, seed);
      breakWall(map);
      const c = beamCoverage(map.grid);
      expect(c, `semente ${seed}`).toBeGreaterThanOrEqual(25);
      expect(c, `semente ${seed}`).toBeLessThanOrEqual(45);
    }
  });

  it("a parede fecha a arena: de dentro não se chega à câmara externa até ela quebrar", () => {
    const reach = (map: ReturnType<typeof buildMap>): Set<number> => {
      const g = map.grid;
      const seen = new Set<number>();
      const start = Math.floor(map.playerStart.y / g.tile) * g.cols + Math.floor(map.playerStart.x / g.tile);
      const stack = [start];
      while (stack.length > 0) {
        const cur = stack.pop() as number;
        if (seen.has(cur)) continue;
        const cx = cur % g.cols;
        const cy = Math.floor(cur / g.cols);
        if (g.isSolid(cx, cy)) continue;
        seen.add(cur);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) if (g.inBounds(cx + dx, cy + dy)) stack.push((cy + dy) * g.cols + cx + dx);
      }
      return seen;
    };
    for (const seed of [1, 2, 3]) {
      const map = buildMap(CORAL, seed);
      const a = CORAL.playArea;
      if (!a) throw new Error("sem arena interna");
      const before = reach(map);
      // tudo o que se alcança está dentro da arena interna
      for (const idx of before) {
        const cx = idx % map.grid.cols;
        const cy = Math.floor(idx / map.grid.cols);
        expect(cx >= a.x && cx < a.x + a.w && cy >= a.y && cy < a.y + a.h, `(${cx}, ${cy}) fora da arena`).toBe(true);
      }
      // e, quebrada a parede, o alcance cresce muito: a câmara externa se abre
      breakWall(map);
      expect(reach(map).size).toBeGreaterThan(before.size * 1.8);
    }
  });

  it("a parede é de bloco próprio, e os índices batem com o layout", () => {
    const map = buildMap(CORAL, 1);
    const fromLayout: number[] = [];
    CORAL.layout.forEach((line, cy) => {
      for (let cx = 0; cx < line.length; cx++) if (line[cx] === "B") fromLayout.push(cy * map.grid.cols + cx);
    });
    expect([...map.barrier].sort((a, b) => a - b)).toEqual(fromLayout);
    expect(map.barrier.length).toBeGreaterThan(200);
    for (const idx of map.barrier) expect(map.grid.cells[idx]).toBe(Cell.Barrier);
    // os outros mapas não têm parede quebrável
    expect(buildMap(RIFT, 1).barrier).toHaveLength(0);
    expect(buildMap(ABYSS, 1).barrier).toHaveLength(0);
  });

  it("os corredores entre as colunas têm pelo menos 80 px, mesmo com os galhos", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const { grid } = buildMap(CORAL, seed);
      // em cada linha, a água entre dois corais seguidos tem pelo menos 4 blocos
      for (let cy = 2; cy < grid.rows - 2; cy++) {
        let lastCoral = -1;
        for (let cx = 0; cx < grid.cols; cx++) {
          if (grid.get(cx, cy) !== Cell.Coral) continue;
          if (lastCoral >= 0 && cx - lastCoral > 1) {
            expect((cx - lastCoral - 1) * grid.tile, `linha ${cy}, entre ${lastCoral} e ${cx}`).toBeGreaterThanOrEqual(80);
          }
          lastCoral = cx;
        }
      }
    }
  });
});

describe("Fosso do Abismo", () => {
  it("26 pilares, cada um com a lista dos seus blocos, nenhum a menos de 7 blocos do centro", () => {
    const map = buildMap(ABYSS, 1);
    expect(map.pillars.length).toBe(26);
    const cols = map.grid.cols;
    for (const group of map.pillars) {
      expect(group.length).toBeGreaterThan(0);
      for (const idx of group) expect(map.grid.cells[idx]).toBe(Cell.Rock);
    }
    for (const p of ABYSS.markers.pillars ?? []) {
      expect(Math.hypot(p.x - cols / 2, p.y - map.grid.rows / 2)).toBeGreaterThanOrEqual(7);
    }
  });
});
