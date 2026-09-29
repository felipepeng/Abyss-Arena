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
