import { EventBuffer } from "../core/events";
import { Rng } from "../core/rng";
import type { Grid } from "../world/grid";
import { buildTestArena, type TestArena } from "../world/testArena";
import { savePrev } from "./body";
import { createCamera, stepCamera, type Camera } from "./camera";
import { overlapsRock } from "./collision";
import { createDummy, stepDummy, type Dummy } from "./dummy";
import type { SimEvent } from "./events";
import { createPlayer, stepPlayer, type Player, type PlayerIntent } from "./player";

// Estado do mundo e o passo da simulação. Determinístico dada a semente e a sequência de
// intenções: nada aqui lê relógio, DOM ou `Math.random`.

export interface World {
  readonly seed: number;
  readonly rng: Rng;
  readonly grid: Grid;
  readonly player: Player;
  readonly dummies: Dummy[];
  readonly camera: Camera;
  readonly events: EventBuffer<SimEvent>;
  /** > 0 congela a simulação (o laço consulta isso antes de cada passo). */
  hitStopMs: number;
  timeMs: number;
}

export function createWorld(seed: number, arena: TestArena = buildTestArena()): World {
  const player = createPlayer(arena.playerStart.x, arena.playerStart.y);
  let nextId = 1;
  const dummies = arena.dummies.map((d) => createDummy(nextId++, d.kind, d.x, d.y));
  // invariante da colisão: ninguém nasce dentro da rocha
  for (const b of [player, ...dummies]) {
    if (overlapsRock(arena.grid, b.x, b.y, b.collR)) throw new Error(`corpo nasce na rocha em (${b.x}, ${b.y})`);
  }
  return {
    seed,
    rng: new Rng(seed),
    grid: arena.grid,
    player,
    dummies,
    camera: createCamera(player, arena.grid),
    events: new EventBuffer(),
    hitStopMs: 0,
    timeMs: 0,
  };
}

export function stepWorld(w: World, intent: PlayerIntent, dtMs: number): void {
  w.events.clear();
  w.timeMs += dtMs;

  const p = w.player;
  savePrev(p);
  p.prevAim = p.aim;
  for (const d of w.dummies) savePrev(d);
  w.camera.prevX = w.camera.x;
  w.camera.prevY = w.camera.y;

  stepPlayer(w, intent, dtMs);
  for (const d of w.dummies) stepDummy(d, w, dtMs);
  stepCamera(w.camera, p, w.grid);
}
