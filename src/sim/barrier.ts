import { ARENA_BREAK } from "../config/world";
import { Cell } from "../world/grid";
import type { World } from "./world";

// A parede quebrável (`Cell.Barrier`) que fecha uma parte do mapa até um chefe quebrá-la (a
// Água-viva, ao entrar na fase 2). Quebrar não é instantâneo: os blocos vão cedendo em onda, dos
// mais perto do chefe aos mais longe, o que dá tempo de ver a arena se abrir (e de o tremor e o
// som acompanharem). Sem sorteio de ordem: a onda é determinística.

/** O estilhaçar em andamento: os blocos que faltam, do primeiro ao último a ceder. */
export interface BarrierBreak {
  order: number[];
  next: number;
  /** Fração de bloco acumulada entre os passos (o ritmo não é múltiplo do passo). */
  carry: number;
}

/**
 * Começa a quebrar a parede a partir de (`ox`, `oy`). Se ela já está quebrando ou quebrou, não faz
 * nada, então dá para chamar de novo sem medo (uma troca que pula duas fases chama duas vezes).
 */
export function startBarrierBreak(w: World, ox: number, oy: number): void {
  if (w.breaking || w.barrier.length === 0) return;
  const cols = w.grid.cols;
  const t = w.grid.tile;
  const dist = (idx: number): number => {
    const dx = (idx % cols) * t + t / 2 - ox;
    const dy = Math.floor(idx / cols) * t + t / 2 - oy;
    return dx * dx + dy * dy;
  };
  const order = w.barrier.slice().sort((a, b) => dist(a) - dist(b));
  w.barrier.length = 0;
  w.breaking = { order, next: 0, carry: 0 };
  w.events.push({ t: "arenaBreak", x: ox, y: oy });
}

/** Solta os blocos que cabem neste passo. */
export function stepBarrierBreak(w: World, dtMs: number): void {
  const br = w.breaking;
  if (!br) return;
  br.carry += (ARENA_BREAK.cellsPerSec * dtMs) / 1000;
  const n = Math.floor(br.carry);
  br.carry -= n;
  const cols = w.grid.cols;
  const t = w.grid.tile;
  for (let i = 0; i < n && br.next < br.order.length; i++) {
    const idx = br.order[br.next++] as number;
    const cx = idx % cols;
    const cy = Math.floor(idx / cols);
    if (w.grid.get(cx, cy) !== Cell.Barrier) continue;
    w.grid.set(cx, cy, Cell.Water);
    if (w.rng.next() < ARENA_BREAK.bubbleChance) w.events.push({ t: "pillarCrumble", x: cx * t + t / 2, y: cy * t + t / 2 });
  }
  if (br.next >= br.order.length) w.breaking = null;
}
