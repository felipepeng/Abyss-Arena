import { Cell } from "../world/grid";
import type { World } from "./world";

// Pilares do Fosso do Abismo (GDD §7.3): cada pilar é a lista dos blocos dele, guardada no
// mundo (e não em globais, CONTEXTO §7.4 item 6). O Olho os dissolve por fase: a cobertura
// existe para ser aprendida na fase 1 e retirada depois.

/** Dissolve pilares inteiros, sorteados, até sobrar `keepFrac` do total original. */
export function dissolvePillars(w: World, keepFrac: number, bubbleChance: number): void {
  const target = Math.floor(w.pillarsTotal * keepFrac);
  const t = w.grid.tile;
  const cols = w.grid.cols;
  while (w.pillars.length > target) {
    const [group] = w.pillars.splice(w.rng.int(0, w.pillars.length - 1), 1);
    for (const idx of group ?? []) {
      const cx = idx % cols;
      const cy = Math.floor(idx / cols);
      w.grid.set(cx, cy, Cell.Water);
      // a bolha é visual, mas sorteada aqui para manter a sequência do protótipo
      if (w.rng.next() < bubbleChance) w.events.push({ t: "pillarCrumble", x: cx * t + t / 2, y: cy * t + t / 2 });
    }
  }
}
