import { BUBBLES, type BubbleBurst } from "../config/fx";
import { TAU } from "../core/math";
import { Pool } from "../core/pool";

// Bolhas: o único tipo de partícula (CONTEXTO §2.5). São apresentação, não simulação, então
// podem usar Math.random. Mesmo assim andam em passo fixo, para congelar no hit-stop junto
// com o resto.

export interface Bubble {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  maxLife: number;
  color: string;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

export class Bubbles {
  readonly pool = new Pool<Bubble>(
    () => ({ x: 0, y: 0, prevX: 0, prevY: 0, vx: 0, vy: 0, r: 0, life: 0, maxLife: 0, color: "" }),
    BUBBLES.maxAlive,
  );

  /** Solta `burst.count` bolhas em (x, y). `spread` substitui o do burst quando informado. */
  emit(x: number, y: number, burst: BubbleBurst, spread = burst.spread): void {
    for (let i = 0; i < burst.count; i++) {
      const b = this.pool.obtain();
      if (!b) return;
      const a = rand(0, TAU);
      const sp = rand(BUBBLES.speedJitter[0], BUBBLES.speedJitter[1]) * burst.speed;
      b.x = b.prevX = x + rand(-spread, spread);
      b.y = b.prevY = y + rand(-spread, spread);
      b.vx = Math.cos(a) * sp;
      b.vy = Math.sin(a) * sp - BUBBLES.riseBias;
      b.r = rand(BUBBLES.radius[0], BUBBLES.radius[1]);
      b.maxLife = BUBBLES.lifeMs;
      b.life = BUBBLES.lifeMs * rand(BUBBLES.lifeJitter[0], BUBBLES.lifeJitter[1]);
      b.color = burst.color;
    }
  }

  step(dtMs: number): void {
    const dt = dtMs / 1000;
    const pool = this.pool;
    for (let i = pool.count - 1; i >= 0; i--) {
      const b = pool.get(i);
      b.life -= dtMs;
      if (b.life <= 0) {
        pool.removeAt(i);
        continue;
      }
      b.prevX = b.x;
      b.prevY = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy -= BUBBLES.buoyancy * dt;
      b.vx *= 1 - BUBBLES.dragX * dt;
      b.vy *= 1 - BUBBLES.dragY * dt;
    }
  }

  clear(): void {
    this.pool.clear();
  }
}
