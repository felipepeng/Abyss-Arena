import { AMBIENT } from "../config/ui";
import { VIEW } from "../config/system";
import { TAU } from "../core/math";

// Fundo animado do título e dos menus: um gradiente de profundidade, colunas de luz que se
// movem devagar e bolhas subindo. É apresentação pura (não faz parte da simulação), então usa
// Math.random.

interface AmbientBubble {
  x: number;
  y: number;
  r: number;
  speed: number;
  phase: number;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class Ambient {
  private readonly bubbles: AmbientBubble[] = [];
  private timeMs = 0;

  constructor(private readonly colors: readonly [string, string, string] = ["#123a4e", "#0a2233", "#040d18"]) {
    for (let i = 0; i < AMBIENT.bubbles; i++) this.bubbles.push(this.spawn(true));
  }

  private spawn(anywhere: boolean): AmbientBubble {
    return {
      x: rand(0, VIEW.width),
      y: anywhere ? rand(0, VIEW.height) : VIEW.height + 10,
      r: rand(AMBIENT.radius[0], AMBIENT.radius[1]),
      speed: rand(AMBIENT.riseSpeed[0], AMBIENT.riseSpeed[1]),
      phase: rand(0, TAU),
    };
  }

  step(dtMs: number): void {
    this.timeMs += dtMs;
    const dt = dtMs / 1000;
    for (let i = 0; i < this.bubbles.length; i++) {
      const b = this.bubbles[i] as AmbientBubble;
      b.y -= b.speed * dt;
      if (b.y < -10) this.bubbles[i] = this.spawn(false);
    }
  }

  draw(g: CanvasRenderingContext2D): void {
    const { width: W, height: H } = VIEW;
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, this.colors[0]);
    grad.addColorStop(0.5, this.colors[1]);
    grad.addColorStop(1, this.colors[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // colunas de luz: faixas largas e apagadas que balançam
    const t = this.timeMs / 1000;
    g.fillStyle = "#cfeaff";
    for (let i = 0; i < AMBIENT.lightColumns; i++) {
      const cx = ((i + 0.5) / AMBIENT.lightColumns) * W + Math.sin(t * 0.15 + i * 1.7) * 60;
      g.globalAlpha = 0.035 + 0.02 * Math.sin(t * 0.3 + i);
      g.beginPath();
      g.moveTo(cx - 30, 0);
      g.lineTo(cx + 30, 0);
      g.lineTo(cx + 110, H);
      g.lineTo(cx - 110, H);
      g.closePath();
      g.fill();
    }

    g.strokeStyle = "#bfe6ff";
    g.lineWidth = 1.2;
    for (const b of this.bubbles) {
      g.globalAlpha = 0.18 + 0.22 * (b.r / AMBIENT.radius[1]);
      g.beginPath();
      g.arc(b.x + Math.sin(t * 1.2 + b.phase) * 6, b.y, b.r, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
}
