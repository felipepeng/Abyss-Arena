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
          const expected = ch === "P" ? Cell.Protected : ch === "#" ? Cell.Rock : ch === "C" ? Cell.Coral : Cell.Water;
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

describe("Jardim de Corais", () => {
  it("o raio é cortado antes de 300 px em 35 a 50 das 64 direções (GDD §7.2)", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const c = beamCoverage(buildMap(CORAL, seed).grid);
      expect(c, `semente ${seed}`).toBeGreaterThanOrEqual(35);
      expect(c, `semente ${seed}`).toBeLessThanOrEqual(50);
    }
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
