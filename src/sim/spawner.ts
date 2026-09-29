import { TEST_SPAWN } from "../config/spawn";
import { len } from "../core/math";
import { overlapsRock } from "./collision";
import { ENEMY_DEFS } from "./enemies/registry";
import { spawnEnemy } from "./enemies/runner";
import type { EnemyKind } from "./enemies/types";
import type { World } from "./world";

// Nascimento PROVISÓRIO por tempo (CONTEXTO §5.3), só para a arena de teste do M2. No M3 é
// substituído pelas ondas, com zonas de nascimento desenhadas no mapa (GDD §3).

export interface TestSpawner {
  enabled: boolean;
  timerMs: number;
  intervalMs: number;
}

export function createTestSpawner(enabled: boolean): TestSpawner {
  return { enabled, timerMs: TEST_SPAWN.firstDelayMs, intervalMs: TEST_SPAWN.intervalMs };
}

export function stepTestSpawner(w: World, dtMs: number): void {
  const s = w.spawner;
  if (!s.enabled || w.playerDead) return;
  s.timerMs -= dtMs;
  if (s.timerMs > 0) return;
  s.timerMs = s.intervalMs;
  s.intervalMs = Math.max(TEST_SPAWN.intervalMinMs, s.intervalMs - TEST_SPAWN.intervalDecayMs);
  if (countHostiles(w) >= TEST_SPAWN.maxAlive) return;
  const kind: EnemyKind = w.rng.chance(TEST_SPAWN.fishChance) ? "fish" : "circler";
  const spot = freeSpot(w, ENEMY_DEFS[kind].stats.collRadius);
  if (spot) spawnEnemy(w, kind, spot.x, spot.y);
}

/** Inimigos que contam para o teto (os sacos de pancada não contam). */
function countHostiles(w: World): number {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const k = w.enemies.get(i).kind;
    if (k !== "dummy" && k !== "dummyBig") n++;
  }
  return n;
}

/** Ponto livre longe do jogador, por tentativa e erro. Provisório: no M3 vêm as zonas. */
function freeSpot(w: World, r: number): { x: number; y: number } | null {
  const g = w.grid;
  for (let i = 0; i < TEST_SPAWN.placementTries; i++) {
    const x = w.rng.range(r, g.width - r);
    const y = w.rng.range(r, g.height - r);
    if (overlapsRock(g, x, y, r)) continue;
    if (len(x - w.player.x, y - w.player.y) < TEST_SPAWN.minDistFromPlayer) continue;
    return { x, y };
  }
  return null;
}
