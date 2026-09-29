import { TAU } from "../../src/core/math";
import { rayLength } from "../../src/sim/geometry";
import type { Grid } from "../../src/world/grid";

// Cobertura do raio (GDD §7.2): de cada ponto de água, em quantas das 64 direções o raio é
// cortado pela rocha antes de `range` px. Média sobre pontos de água aberta amostrados a cada
// `stride` blocos (pontos colados na rocha ficam de fora: ali a Água-viva não flutua).

export function beamCoverage(grid: Grid, range = 300, directions = 64, stride = 3): number {
  const t = grid.tile;
  let sum = 0;
  let n = 0;
  for (let cy = 2; cy < grid.rows - 2; cy += stride) {
    for (let cx = 2; cx < grid.cols - 2; cx += stride) {
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
