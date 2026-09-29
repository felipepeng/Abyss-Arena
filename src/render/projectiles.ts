import { PROJECTILES } from "../config/combat";
import { TAU, lerp } from "../core/math";
import type { Pool } from "../core/pool";
import type { Projectile } from "../sim/projectiles";

// Projéteis em quatro camadas (CONTEXTO §2.4): halo, corpo, reflexo e 4 farpas girando. A
// rotação existe só para o olho ler que aquilo é vivo, e não um ponto. A cor identifica o
// ataque: é a única linguagem para distinguir padrões sobrepostos.

export function drawProjectiles(g: CanvasRenderingContext2D, pool: Pool<Projectile>, alpha: number): void {
  for (let i = 0; i < pool.count; i++) {
    const p = pool.get(i);
    if (p.dead) continue;
    const x = lerp(p.prevX, p.x, alpha);
    const y = lerp(p.prevY, p.y, alpha);
    const r = p.r;
    g.fillStyle = p.color;
    g.globalAlpha = 0.28;
    g.beginPath();
    g.arc(x, y, r * 2.1, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.arc(x - r * 0.25, y - r * 0.25, r * 0.35, 0, TAU);
    g.fill();
    g.strokeStyle = p.color;
    g.lineWidth = 1.5;
    g.globalAlpha = 0.7;
    const spin = p.spin + (p.ageMs / 1000) * PROJECTILES.spinRate;
    g.beginPath();
    for (let k = 0; k < 4; k++) {
      const a = spin + (k / 4) * TAU;
      g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      g.lineTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
    }
    g.stroke();
    g.globalAlpha = 1;
  }
}
