import type { Grid } from "../world/grid";

// Consultas geométricas contra a grade, usadas por ataques em linha (o raio da Água-viva).

/**
 * Comprimento útil de um raio que sai de (ox, oy) no ângulo `ang`, até bater na rocha. É o
 * que faz a rocha dar cobertura. Amostra o raio em passos de `step` px, como o protótipo.
 */
export function rayLength(grid: Grid, ox: number, oy: number, ang: number, maxLen: number, step: number): number {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  for (let t = step; t <= maxLen; t += step) {
    if (grid.isSolidAt(ox + dx * t, oy + dy * t)) return t - step;
  }
  return maxLen;
}

/**
 * Distância perpendicular do ponto (px, py) ao raio, ou Infinity se o ponto estiver antes do
 * vão interno, depois da ponta ou atrás da origem.
 */
export function distInRay(
  ox: number, oy: number, ang: number, innerGap: number, maxLen: number, px: number, py: number,
): number {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const t = (px - ox) * dx + (py - oy) * dy;
  if (t < innerGap || t > maxLen) return Infinity;
  const ex = px - (ox + dx * t);
  const ey = py - (oy + dy * t);
  return Math.sqrt(ex * ex + ey * ey);
}

/**
 * Há linha de visão entre os dois pontos? Amostra o segmento em passos de `step` px; qualquer
 * bloco sólido no caminho corta a visão. É o que faz o coral e os pilares darem cobertura
 * contra a Medusinha e a Vigia.
 */
export function hasLineOfSight(grid: Grid, x0: number, y0: number, x1: number, y1: number, step: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d === 0) return true;
  for (let t = step; t < d; t += step) {
    if (grid.isSolidAt(x0 + (dx / d) * t, y0 + (dy / d) * t)) return false;
  }
  return true;
}
