import type { EnemyKind } from "../config/kinds";
import { WORLD } from "../config/world";
import { TAU } from "../core/math";
import { Rng } from "../core/rng";
import { Cell, Grid } from "./grid";
import type { MapDef, ReliefParams, TileRect } from "./mapdef";

// MapDef + semente → grade + marcadores em px. O procedural só escreve em células `~`: a
// estrutura desenhada nunca muda. A mesma semente gera o mesmo mapa ("tentar de novo" reusa a
// semente, GDD §2.3).

export interface PxRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface BuiltMap {
  def: MapDef;
  grid: Grid;
  playerStart: { x: number; y: number };
  bossSpawn: { x: number; y: number };
  spawnZones: PxRect[];
  fixedEnemies: { kind: EnemyKind; x: number; y: number }[];
}

const CHAR_CELL: Record<string, Cell> = {
  "#": Cell.Rock,
  P: Cell.Protected,
  C: Cell.Coral,
  ".": Cell.Water,
  "~": Cell.Water,
};

/** Constrói o mapa. `rng` recebe uma semente própria do mapa, separada da simulação. */
export function buildMap(def: MapDef, seed: number): BuiltMap {
  const rows = def.layout.length;
  const cols = def.layout[0]?.length ?? 0;
  const grid = new Grid(cols, rows, WORLD.tile);
  /** Células onde o procedural pode escrever. */
  const free = new Uint8Array(cols * rows);

  def.layout.forEach((line, cy) => {
    if (line.length !== cols) throw new Error(`${def.id}: linha ${cy} tem ${line.length} colunas, esperado ${cols}`);
    for (let cx = 0; cx < cols; cx++) {
      const ch = line[cx] ?? ".";
      const cell = CHAR_CELL[ch];
      if (cell === undefined) throw new Error(`${def.id}: caractere desconhecido "${ch}" em (${cx}, ${cy})`);
      grid.set(cx, cy, cell);
      if (ch === "~") free[cy * cols + cx] = 1;
    }
  });

  const rng = new Rng(seed);
  const canWrite = (cx: number, cy: number): boolean => grid.inBounds(cx, cy) && free[cy * cols + cx] === 1;
  const rock = (cx: number, cy: number): void => {
    if (canWrite(cx, cy)) grid.set(cx, cy, Cell.Rock);
  };
  const p = def.procedural;

  // relevo do teto e do chão por soma de senos, como no protótipo (CONTEXTO §2.2)
  const relief = (r: ReliefParams, x: number, p1: number, p2: number): number =>
    Math.round(r.base + r.amp1 * Math.sin(x * r.freq1 + p1) + r.amp2 * Math.sin(x * r.freq2 + p2) + rng.range(-r.noise, r.noise));
  const phase1 = rng.range(0, TAU);
  const phase2 = rng.range(0, TAU);
  if (p.ceiling) {
    for (let cx = 0; cx < cols; cx++) {
      const depth = relief(p.ceiling, cx, -phase2, phase1);
      for (let k = 0; k < depth; k++) rock(cx, p.ceiling.fromRow + k);
    }
  }
  if (p.floor) {
    for (let cx = 0; cx < cols; cx++) {
      const height = relief(p.floor, cx, phase1, phase2);
      for (let k = 0; k < height; k++) rock(cx, p.floor.fromRow - k);
    }
  }

  // estalactites e estalagmites: colunas que crescem da rocha para dentro das células `~`
  if (p.stalactites) {
    for (let i = 0; i < p.stalactites.count; i++) {
      const cx = rng.int(1, cols - 2);
      const len = rng.int(p.stalactites.length[0], p.stalactites.length[1]);
      const fromTop = rng.chance(p.stalactites.fromTopChance);
      // começa na primeira célula livre depois da rocha, no sentido escolhido
      let cy = fromTop ? 0 : rows - 1;
      const dir = fromTop ? 1 : -1;
      while (grid.inBounds(cx, cy) && grid.isSolid(cx, cy)) cy += dir;
      for (let k = 0; k < len && canWrite(cx, cy); k++, cy += dir) rock(cx, cy);
    }
  }

  // blobs elípticos, centrados numa célula `~`
  if (p.blobs) {
    const b = p.blobs;
    const n = rng.int(b.count[0], b.count[1]);
    for (let i = 0; i < n; i++) {
      let bx = -1;
      let by = -1;
      for (let tries = 0; tries < 200; tries++) {
        const x = rng.int(0, cols - 1);
        const y = rng.int(0, rows - 1);
        if (canWrite(x, y)) {
          bx = x;
          by = y;
          break;
        }
      }
      if (bx < 0) continue;
      const rx = rng.range(b.rx[0], b.rx[1]);
      const ry = rng.range(b.ry[0], b.ry[1]);
      const reach = Math.ceil(Math.max(rx, ry)) + 1;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          if ((dx / rx) ** 2 + (dy / ry) ** 2 <= 1 + rng.range(-b.edgeNoise, b.edgeNoise)) rock(bx + dx, by + dy);
        }
      }
    }
  }

  const t = WORLD.tile;
  const center = (pt: { x: number; y: number }) => ({ x: (pt.x + 0.5) * t, y: (pt.y + 0.5) * t });
  const toPx = (r: TileRect): PxRect => ({ x: r.x * t, y: r.y * t, w: r.w * t, h: r.h * t });
  return {
    def,
    grid,
    playerStart: center(def.markers.playerStart),
    bossSpawn: center(def.markers.bossSpawn),
    spawnZones: def.markers.spawnZones.map(toPx),
    fixedEnemies: def.markers.fixedEnemies.map((f) => ({ kind: f.kind, ...center(f.at) })),
  };
}
