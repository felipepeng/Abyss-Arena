import { WORLD } from "../../src/config/world";
import type { DummyKind } from "../../src/config/dummy";
import { NO_INTENT, type PlayerIntent } from "../../src/sim/player";
import { createWorld, stepWorld, type World } from "../../src/sim/world";
import { Cell, Grid } from "../../src/world/grid";

export const STEP = 1000 / 60;

/** Arena aberta de 100 × 60 blocos com borda de 2, para medir sem esbarrar em nada. */
export function openGrid(cols = 100, rows = 60): Grid {
  const g = new Grid(cols, rows, WORLD.tile);
  g.fill(0, 0, cols - 1, 1, Cell.Protected);
  g.fill(0, rows - 2, cols - 1, rows - 1, Cell.Protected);
  g.fill(0, 0, 1, rows - 1, Cell.Protected);
  g.fill(cols - 2, 0, cols - 1, rows - 1, Cell.Protected);
  return g;
}

export function openWorld(opts: { grid?: Grid; dummies?: { kind: DummyKind; x: number; y: number }[] } = {}): World {
  const grid = opts.grid ?? openGrid();
  return createWorld(1, { grid, playerStart: { x: 600, y: 600 }, dummies: opts.dummies ?? [] });
}

export function intent(over: Partial<PlayerIntent> = {}): PlayerIntent {
  return { ...NO_INTENT, ...over };
}

/** Mira fixa para a direita do jogador, onde quer que ele esteja. */
export function aimRight(w: World, over: Partial<PlayerIntent> = {}): PlayerIntent {
  return intent({ aimX: w.player.x + 1000, aimY: w.player.y, ...over });
}

export function steps(w: World, n: number, make: (w: World, i: number) => PlayerIntent): void {
  for (let i = 0; i < n; i++) stepWorld(w, make(w, i), STEP);
}

export const speed = (w: World): number => Math.hypot(w.player.vx, w.player.vy);
