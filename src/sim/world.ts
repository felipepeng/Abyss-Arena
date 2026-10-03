import { ENEMY_POOL_SIZE, PROJECTILES } from "../config/combat";
import type { EnemyKind } from "../config/kinds";
import { HEAL } from "../config/pickups";
import { EventBuffer } from "../core/events";
import { Pool } from "../core/pool";
import { Rng } from "../core/rng";
import { buildMap } from "../world/builder";
import type { Grid } from "../world/grid";
import type { MapDef } from "../world/mapdef";
import { savePrev } from "./body";
import { stepBosses } from "./bosses/runner";
import type { Boss } from "./bosses/types";
import { createCamera, stepCamera, type Camera } from "./camera";
import { overlapsRock } from "./collision";
import { makeEnemySlot, removeDeadEnemies, spawnEnemy, stepEnemies } from "./enemies/runner";
import type { Enemy } from "./enemies/types";
import type { SimEvent } from "./events";
import { stepBarrierBreak, type BarrierBreak } from "./barrier";
import { createNav, updateNav, type Nav } from "./nav";
import { createPhaseFlow, stepPhase, type PhaseFlow, type PhaseSetup } from "./phase";
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
  readonly bosses: Boss[];
  readonly projectiles: Pool<Projectile>;
  readonly pickups: Pool<HealPickup>;
  readonly camera: Camera;
  readonly events: EventBuffer<SimEvent>;
  /** Nascimento provisório por tempo (arena de teste). */
  readonly spawner: TestSpawner;
  /** Mapa de distâncias até o jogador: como os inimigos contornam a rocha (sim/nav.ts). */
  readonly nav: Nav;
  /** Fluxo de fase (ondas → chefe). Nulo na arena de teste. */
  readonly phase: PhaseFlow | null;
  /** Pilares do Fosso: índices de bloco de cada um. O Olho os dissolve por fase. */
  readonly pillars: number[][];
  /** Quantos pilares o mapa tinha no começo. */
  readonly pillarsTotal: number;
  /** Blocos da parede quebrável que ainda estão de pé e não começaram a ceder. */
  readonly barrier: number[];
  /** O estilhaçar da parede em andamento (a Água-viva na fase 2), ou nulo. */
  breaking: BarrierBreak | null;
  /** > 0 congela a simulação (o laço consulta isso antes de cada passo). */
  hitStopMs: number;
  timeMs: number;
  nextId: number;
  kills: number;
  playerDead: boolean;
  /** Depuração (F2): o funil de dano ignora tudo. */
  godMode: boolean;
}

/** Tudo que um mundo precisa para começar. Vem de um mapa (`createMapWorld`) ou dos testes. */
export interface WorldSetup {
  grid: Grid;
  playerStart: { x: number; y: number };
  /** Criaturas presentes desde o início (sacos de pancada, inimigos fixos). */
  enemies: readonly { kind: EnemyKind; x: number; y: number }[];
  /** Liga o nascimento provisório por tempo. */
  spawner: boolean;
  /** Ondas e chefe. Sem isto, não há fluxo de fase. */
  phase?: PhaseSetup;
  /** Pilares dissolvíveis (índices de bloco de cada um). */
  pillars?: number[][];
  /** Blocos da parede quebrável (índices). */
  barrier?: number[];
}

/**
 * A simulação usa uma sequência aleatória separada da do mapa, derivada da mesma semente:
 * mexer no gerador do mapa não muda o que acontece na luta, e vice-versa.
 */
const SIM_SEED_SALT = 0x5bd1e995;

export function createWorld(seed: number, setup: WorldSetup): World {
  const player = createPlayer(setup.playerStart.x, setup.playerStart.y);
  const w: World = {
    seed,
    rng: new Rng(seed ^ SIM_SEED_SALT),
    grid: setup.grid,
    player,
    enemies: new Pool(makeEnemySlot, ENEMY_POOL_SIZE),
    bosses: [],
    projectiles: new Pool(makeProjectileSlot, PROJECTILES.maxAlive),
    pickups: new Pool(makeHealSlot, HEAL.maxAlive),
    camera: createCamera(player, setup.grid),
    events: new EventBuffer(),
    spawner: createTestSpawner(setup.spawner),
    nav: createNav(setup.grid),
    phase: setup.phase ? createPhaseFlow(setup.phase) : null,
    pillars: setup.pillars ? setup.pillars.map((p) => [...p]) : [],
    pillarsTotal: setup.pillars?.length ?? 0,
    barrier: setup.barrier ? [...setup.barrier] : [],
    breaking: null,
    hitStopMs: 0,
    timeMs: 0,
    nextId: 1,
    kills: 0,
    playerDead: false,
    godMode: false,
  };
  for (const s of setup.enemies) spawnEnemy(w, s.kind, s.x, s.y);
  // invariante da colisão: ninguém nasce dentro da rocha
  const bodies = [player, ...Array.from({ length: w.enemies.count }, (_, i) => w.enemies.get(i))];
  for (const b of bodies) {
    if (overlapsRock(setup.grid, b.x, b.y, b.collR)) throw new Error(`corpo nasce na rocha em (${b.x}, ${b.y})`);
  }
  if (setup.phase && overlapsRock(setup.grid, setup.phase.bossSpawn.x, setup.phase.bossSpawn.y, 1)) {
    throw new Error("o chefe nasceria na rocha");
  }
  return w;
}

/** Mundo de uma fase de verdade: o mapa construído com a semente, com ondas e chefe. */
export function createMapWorld(def: MapDef, seed: number): World {
  const map = buildMap(def, seed);
  // posições fixas dos estáticos das ondas (ouriços, anêmonas)
  const spots: Partial<Record<EnemyKind, { x: number; y: number }[]>> = {};
  for (const f of map.fixedEnemies) (spots[f.kind] ??= []).push({ x: f.x, y: f.y });
  return createWorld(seed, {
    grid: map.grid,
    playerStart: map.playerStart,
    enemies: [],
    spawner: false,
    phase: { waves: def.waves, boss: def.boss, bossSpawn: map.bossSpawn, spawnZones: map.spawnZones, spots, playArea: map.playArea },
    pillars: map.pillars,
    barrier: map.barrier,
  });
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

  // mesma ordem do protótipo: jogador → inimigos → chefe → projéteis → nascimento → câmera
  if (!w.playerDead) stepPlayer(w, intent, dtMs);
  updateNav(w);
  stepEnemies(w, dtMs);
  stepBosses(w, dtMs);
  stepBarrierBreak(w, dtMs);
  stepProjectiles(w, dtMs);
  stepPickups(w, dtMs);
  stepTestSpawner(w, dtMs);
  stepPhase(w, dtMs);
  stepCamera(w.camera, p, w.grid);
  removeDeadEnemies(w);
}
