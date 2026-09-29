import type { Body } from "./body";

// Integrador de nado. Tempo em segundos aqui (dt = passo / 1000), porque as taxas são por
// segundo.

export function accelerate(b: Body, dirX: number, dirY: number, accel: number, dt: number): void {
  b.vx += dirX * accel * dt;
  b.vy += dirY * accel * dt;
}

/**
 * Arrasto implícito `v *= 1 / (1 + k·dt)`, não `v *= 0,94`: o decaimento não depende do
 * tamanho do passo e nunca inverte o sinal, mesmo com dt grande.
 */
export function applyDrag(b: Body, drag: number, dt: number): void {
  const f = 1 / (1 + drag * dt);
  b.vx *= f;
  b.vy *= f;
}

export function clampSpeed(b: Body, max: number): void {
  const s = Math.hypot(b.vx, b.vy);
  if (s > max) {
    b.vx = (b.vx / s) * max;
    b.vy = (b.vy / s) * max;
  }
}
