import { ENEMY_POOL_SIZE, PROJECTILES } from "../config/combat";
import { HEAL } from "../config/pickups";
import { EventBuffer } from "../core/events";
import { Pool } from "../core/pool";
import { Rng } from "../core/rng";
import type { Grid } from "../world/grid";
import { buildTestArena, type TestArena } from "../world/testArena";
import { savePrev } from "./body";
import { createCamera, stepCamera, type Camera } from "./camera";
import { overlapsRock } from "./collision";
import { makeEnemySlot, removeDeadEnemies, spawnEnemy, stepEnemies } from "./enemies/runner";
import type { Enemy } from "./enemies/types";
import type { SimEvent } from "./events";
import { makeHealSlot, stepPickups, type HealPickup } from "./pickups";
import { createPlayer, stepPlayer, type Player, type PlayerIntent } from "./player";
import { makeProjectileSlot, stepProjectiles, type Projectile } from "./projectiles";
import { createTestSpawner, stepTestSpawner, type TestSpawner } from "./spawner";

// Estado do mundo e o passo da simulação. Determinístico dada a semente e a sequência de
// intenções: nada aqui lê relógio, DOM ou `Math.random`.

export interface World {
  readonly seed: number;
  readonly rng: Rng;
  readonly grid: Grid;
  readonly player: Player;
  readonly enemies: Pool<Enemy>;
  readonly projectiles: Pool<Projectile>;
  readonly pickups: Pool<HealPickup>;
  readonly camera: Camera;
  readonly events: EventBuffer<SimEvent>;
  readonly spawner: TestSpawner;
  /** > 0 congela a simulação (o laço consulta isso antes de cada passo). */
  hitStopMs: number;
  timeMs: number;
  nextId: number;
  kills: number;
  playerDead: boolean;
  /** Depuração (F2): o funil de dano ignora tudo. */
  godMode: boolean;
}

export function createWorld(seed: number, arena: TestArena = buildTestArena()): World {
  const player = createPlayer(arena.playerStart.x, arena.playerStart.y);
  const w: World = {
    seed,
    rng: new Rng(seed),
    grid: arena.grid,
    player,
    enemies: new Pool(makeEnemySlot, ENEMY_POOL_SIZE),
    projectiles: new Pool(makeProjectileSlot, PROJECTILES.maxAlive),
    pickups: new Pool(makeHealSlot, HEAL.maxAlive),
    camera: createCamera(player, arena.grid),
    events: new EventBuffer(),
    spawner: createTestSpawner(arena.spawner),
    hitStopMs: 0,
    timeMs: 0,
    nextId: 1,
    kills: 0,
    playerDead: false,
    godMode: false,
  };
  for (const s of arena.enemies) spawnEnemy(w, s.kind, s.x, s.y);
  // invariante da colisão: ninguém nasce dentro da rocha
  const bodies = [player, ...Array.from({ length: w.enemies.count }, (_, i) => w.enemies.get(i))];
  for (const b of bodies) {
    if (overlapsRock(arena.grid, b.x, b.y, b.collR)) throw new Error(`corpo nasce na rocha em (${b.x}, ${b.y})`);
  }
  return w;
}

export function stepWorld(w: World, intent: PlayerIntent, dtMs: number): void {
  w.events.clear();
  w.timeMs += dtMs;

  const p = w.player;
  savePrev(p);
  p.prevAim = p.aim;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.get(i);
    savePrev(e);
    e.prevAng = e.ang;
  }
  w.camera.prevX = w.camera.x;
  w.camera.prevY = w.camera.y;

  // mesma ordem do protótipo: jogador → inimigos → projéteis → nascimento → câmera
  if (!w.playerDead) stepPlayer(w, intent, dtMs);
  stepEnemies(w, dtMs);
  stepProjectiles(w, dtMs);
  stepPickups(w, dtMs);
  stepTestSpawner(w, dtMs);
  stepCamera(w.camera, p, w.grid);
  removeDeadEnemies(w);
}
