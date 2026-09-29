import { WORLD } from "../../src/config/world";
import type { Enemy, EnemyKind } from "../../src/sim/enemies/types";
import { NO_INTENT, type PlayerIntent } from "../../src/sim/player";
import { createWorld, stepWorld, type World } from "../../src/sim/world";
import { Cell, Grid } from "../../src/world/grid";

export const STEP = 1000 / 60;

/** Arena aberta com borda de 2 blocos, para medir sem esbarrar em nada. */
export function openGrid(cols = 100, rows = 60): Grid {
  const g = new Grid(cols, rows, WORLD.tile);
  g.fill(0, 0, cols - 1, 1, Cell.Protected);
  g.fill(0, rows - 2, cols - 1, rows - 1, Cell.Protected);
  g.fill(0, 0, 1, rows - 1, Cell.Protected);
  g.fill(cols - 2, 0, cols - 1, rows - 1, Cell.Protected);
  return g;
}

export interface OpenWorldOptions {
  grid?: Grid;
  start?: { x: number; y: number };
  enemies?: { kind: EnemyKind; x: number; y: number }[];
  spawner?: boolean;
}

/** Mundo numa arena aberta, sem nascimento automático. */
export function openWorld(opts: OpenWorldOptions = {}): World {
  return createWorld(1, {
    grid: opts.grid ?? openGrid(),
    playerStart: opts.start ?? { x: 600, y: 600 },
    enemies: opts.enemies ?? [],
    spawner: opts.spawner ?? false,
  });
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

/** O primeiro inimigo do pool (os testes costumam ter um só). */
export function firstEnemy(w: World): Enemy {
  if (w.enemies.count === 0) throw new Error("nenhum inimigo no mundo");
  return w.enemies.get(0);
}

/** Troca a RNG do mundo por uma que devolve sempre `value` (para comparar com o protótipo). */
export function pinRng(w: World, value = 0.5): void {
  w.rng.next = () => value;
}
