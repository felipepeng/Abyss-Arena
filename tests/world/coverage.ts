import { TAU } from "../../src/core/math";
import { rayLength } from "../../src/sim/geometry";
import type { Grid } from "../../src/world/grid";

// Cobertura do raio (GDD §7.2): de cada ponto de água, em quantas das 64 direções o raio é
// cortado pela rocha antes de `range` px. Média sobre pontos de água aberta amostrados a cada
// `stride` blocos (pontos colados na rocha ficam de fora: ali a Água-viva não flutua).

export interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** `region`, em blocos, restringe a média a uma parte do mapa (a arena interna, por exemplo). */
export function beamCoverage(grid: Grid, range = 300, directions = 64, stride = 3, region?: Region): number {
  const t = grid.tile;
  let sum = 0;
  let n = 0;
  const r = region ?? { x0: 2, y0: 2, x1: grid.cols - 2, y1: grid.rows - 2 };
  for (let cy = r.y0; cy < r.y1; cy += stride) {
    for (let cx = r.x0; cx < r.x1; cx += stride) {
      const x = (cx + 0.5) * t;
      const y = (cy + 0.5) * t;
      if (grid.overlapsSolid(x - 30, y - 30, x + 30, y + 30)) continue;
      let blocked = 0;
      for (let i = 0; i < directions; i++) if (rayLength(grid, x, y, (i / directions) * TAU, range, 8) < range) blocked++;
      sum += blocked;
      n++;
    }
  }
  return n > 0 ? sum / n : 0;
}
