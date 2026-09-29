// Utilidades numéricas sem conhecimento de jogo. Ângulos em radianos.

export const TAU = Math.PI * 2;

export const clamp = (v: number, lo: number, hi: number): number =>
  v < lo ? lo : v > hi ? hi : v;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const len = (x: number, y: number): number => Math.hypot(x, y);

/** Menor diferença assinada de `a` para `b`, em [−π, π). */
export function angDiff(a: number, b: number): number {
  return ((((b - a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
}

/** Interpola ângulos pelo caminho mais curto (não dá a volta pelo lado errado em ±π). */
export const angLerp = (a: number, b: number, t: number): number => a + angDiff(a, b) * t;
