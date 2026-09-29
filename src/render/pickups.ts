import { HEAL } from "../config/pickups";
import { TAU, lerp } from "../core/math";
import type { Pool } from "../core/pool";
import type { HealPickup } from "../sim/pickups";

// Bolha de cura (GDD §5): círculo verde claro com brilho pulsante e uma cruz no centro. Pisca
// nos últimos 2 s. Nenhum projétil usa este verde, para não haver confusão.

const GREEN = "#7dffb0";

export function drawPickups(g: CanvasRenderingContext2D, pool: Pool<HealPickup>, alpha: number, timeMs: number): void {
  for (let i = 0; i < pool.count; i++) {
    const h = pool.get(i);
    if (h.life < HEAL.blinkLastMs && Math.floor(h.life / HEAL.blinkPeriodMs) % 2 === 0) continue;
    const x = lerp(h.prevX, h.x, alpha);
    const y = lerp(h.prevY, h.y, alpha);
    const r = h.radius;
    const pulse = 0.5 + 0.5 * Math.sin(timeMs / 180 + i);
    g.fillStyle = GREEN;
    g.globalAlpha = 0.18 + 0.17 * pulse;
    g.beginPath();
    g.arc(x, y, r * (2 + 0.4 * pulse), 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.strokeStyle = "#eafff2";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(x - r * 0.55, y);
    g.lineTo(x + r * 0.55, y);
    g.moveTo(x, y - r * 0.55);
    g.lineTo(x, y + r * 0.55);
    g.stroke();
  }
}
