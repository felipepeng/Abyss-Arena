import { WORLD } from "../config/world";
import { TAU } from "../core/math";
import type { Grid } from "../world/grid";
import type { Body } from "./body";

// Corpo × grade. Substitui as cinco redes de segurança do protótipo (CONTEXTO §9):
//
// - Separação por eixo com margem: move em X e resolve, depois em Y. A resolução encosta o
//   corpo na face do bloco (mais `skin`) pela posição do bloco, sem laço de "empurra 1 px".
//   Resolver eixo por eixo dá o deslize na parede de graça.
// - Sub-passos: nenhum sub-passo anda mais que `collR`, então a caixa sempre toca qualquer
//   bloco que atravessaria. Cobre o dash (≈10,7 px por passo) e as investidas.
// - Invariante: nenhum corpo começa um passo dentro da rocha. Se começar, é bug; `unstick`
//   roda como fallback e avisa no console, para o bug aparecer em vez de ser escondido.

export function overlapsRock(grid: Grid, x: number, y: number, r: number): boolean {
  return grid.overlapsSolid(x - r, y - r, x + r, y + r);
}

/** Move o corpo por `v · dt` (dt em segundos) contra a grade. */
export function moveBody(b: Body, grid: Grid, dt: number): void {
  b.blockedX = false;
  b.blockedY = false;
  const r = b.collR;
  if (overlapsRock(grid, b.x, b.y, r)) {
    console.warn(`corpo começou o passo dentro da rocha em (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`);
    unstick(b, grid);
  }

  const dx = b.vx * dt;
  const dy = b.vy * dt;
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / r));
  for (let i = 0; i < n; i++) {
    if (!b.blockedX) moveX(b, grid, dx / n);
    if (!b.blockedY) moveY(b, grid, dy / n);
  }
}

function moveX(b: Body, grid: Grid, d: number): void {
  if (d === 0) return;
  const t = grid.tile;
  const r = b.collR;
  b.x += d;
  const cy0 = Math.floor((b.y - r) / t);
  const cy1 = Math.ceil((b.y + r) / t) - 1;
  const cx0 = Math.floor((b.x - r) / t);
  const cx1 = Math.ceil((b.x + r) / t) - 1;
  // procura o bloco mais próximo na direção do movimento: é nele que o corpo encosta
  const step = d > 0 ? 1 : -1;
  for (let cx = d > 0 ? cx0 : cx1; cx >= cx0 && cx <= cx1; cx += step) {
    for (let cy = cy0; cy <= cy1; cy++) {
      if (!grid.isSolid(cx, cy)) continue;
      b.x = d > 0 ? cx * t - r - WORLD.skin : (cx + 1) * t + r + WORLD.skin;
      b.vx = 0;
      b.blockedX = true;
      return;
    }
  }
}

function moveY(b: Body, grid: Grid, d: number): void {
  if (d === 0) return;
  const t = grid.tile;
  const r = b.collR;
  b.y += d;
  const cx0 = Math.floor((b.x - r) / t);
  const cx1 = Math.ceil((b.x + r) / t) - 1;
  const cy0 = Math.floor((b.y - r) / t);
  const cy1 = Math.ceil((b.y + r) / t) - 1;
  const step = d > 0 ? 1 : -1;
  for (let cy = d > 0 ? cy0 : cy1; cy >= cy0 && cy <= cy1; cy += step) {
    for (let cx = cx0; cx <= cx1; cx++) {
      if (!grid.isSolid(cx, cy)) continue;
      b.y = d > 0 ? cy * t - r - WORLD.skin : (cy + 1) * t + r + WORLD.skin;
      b.vy = 0;
      b.blockedY = true;
      return;
    }
  }
}

/**
 * Fallback: recoloca o corpo no ponto livre mais próximo, procurando em anéis. Devolve
 * false se não achou (o corpo fica onde está).
 */
export function unstick(b: Body, grid: Grid): boolean {
  const { ringStep, maxRadius, directions } = WORLD.unstick;
  const r = b.collR;
  for (let ring = ringStep; ring <= maxRadius; ring += ringStep) {
    for (let i = 0; i < directions; i++) {
      const a = (i / directions) * TAU;
      const x = b.x + Math.cos(a) * ring;
      const y = b.y + Math.sin(a) * ring;
      if (!overlapsRock(grid, x, y, r)) {
        b.x = x;
        b.y = y;
        b.prevX = x;
        b.prevY = y;
        b.vx *= WORLD.unstick.keepSpeed;
        b.vy *= WORLD.unstick.keepSpeed;
        return true;
      }
    }
  }
  console.warn("unstick não achou espaço livre");
  return false;
}
