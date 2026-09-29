import { LINE_OF_SIGHT } from "../../config/combat";
import { hasLineOfSight } from "../geometry";
import type { World } from "../world";
import type { Enemy } from "./types";

// Percepção (ARCHITECTURE §5.3). O Peixe só usa distância, como no protótipo; a Medusinha e a
// Vigia também exigem linha de visão, para que o coral e os pilares deem cobertura.

/** A criatura vê o jogador: dentro de `range` px e sem rocha no caminho. */
export function canSee(e: Enemy, w: World, range: number): boolean {
  const p = w.player;
  const dx = p.x - e.x;
  const dy = p.y - e.y;
  if (dx * dx + dy * dy > range * range) return false;
  return hasLineOfSight(w.grid, e.x, e.y, p.x, p.y, LINE_OF_SIGHT.stepPx);
}
