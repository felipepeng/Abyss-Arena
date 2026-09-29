import { TAU, clamp, lerp } from "../core/math";
import type { Bubbles } from "../fx/particles";

// Bolhas como contorno de 1,5 px; a opacidade e o raio caem com a vida restante.

export function drawBubbles(g: CanvasRenderingContext2D, bubbles: Bubbles, alpha: number): void {
  const pool = bubbles.pool;
  g.lineWidth = 1.5;
  for (let i = 0; i < pool.count; i++) {
    const b = pool.get(i);
    const a = clamp(b.life / b.maxLife, 0, 1);
    g.globalAlpha = a * 0.85;
    g.strokeStyle = b.color;
    g.beginPath();
    g.arc(lerp(b.prevX, b.x, alpha), lerp(b.prevY, b.y, alpha), b.r * (0.5 + a * 0.8), 0, TAU);
    g.stroke();
  }
  g.globalAlpha = 1;
}
