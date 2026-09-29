import { WAVES } from "../config/waves";
import { TAU } from "../core/math";
import type { PhaseFlow } from "../sim/phase";

// Aviso de nascimento (GDD §3.1): um redemoinho no ponto onde o inimigo vai aparecer. Nascer
// também é telegrafado. As bolhas saem do evento; aqui fica o anel que gira e fecha.

export function drawSpawnWarnings(g: CanvasRenderingContext2D, flow: PhaseFlow | null, timeMs: number): void {
  if (!flow) return;
  for (const s of flow.pending) {
    const k = 1 - Math.max(s.t, 0) / WAVES.spawnWarnMs;
    const r = 22 - 12 * k;
    g.strokeStyle = "#cfeaff";
    g.lineWidth = 2;
    g.globalAlpha = 0.35 + 0.5 * k;
    const spin = (timeMs / 1000) * 6;
    for (let i = 0; i < 3; i++) {
      const a = spin + (i / 3) * TAU;
      g.beginPath();
      g.arc(s.x, s.y, r, a, a + 1.4);
      g.stroke();
    }
  }
  g.globalAlpha = 1;
}
