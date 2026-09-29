import type { BossKind, EnemyKind } from "../config/kinds";
import { PHASE_FLOW, WAVES } from "../config/waves";
import { len } from "../core/math";
import type { PxRect } from "../world/builder";
import type { WaveDef } from "../world/mapdef";
import { activateBoss, createBoss } from "./bosses/runner";
import type { Boss } from "./bosses/types";
import { overlapsRock } from "./collision";
import { ENEMY_DEFS } from "./enemies/registry";
import { spawnEnemy } from "./enemies/runner";
import type { World } from "./world";

// Máquina de estados da fase (ARCHITECTURE §9.2, GDD §2.2):
//
//   intro → wave(1) → interlude → wave(2) → interlude → wave(3) → interlude
//     → bossIntro → boss → cleared
//   qualquer estado (exceto cleared) → failed   (vida do jogador = 0)
//
// O nascimento das ondas mora aqui (GDD §3.1): uma fila por onda, um nascimento a cada
// 600 ms até o teto de 6 vivos, e cada nascimento é telegrafado por 500 ms no ponto.

export type PhaseStateName = "intro" | "wave" | "interlude" | "bossIntro" | "boss" | "cleared" | "failed";

/** O que a fase precisa saber do mapa. */
export interface PhaseSetup {
  waves: readonly WaveDef[];
  boss: BossKind;
  bossSpawn: { x: number; y: number };
  spawnZones: readonly PxRect[];
}

interface PendingSpawn {
  kind: EnemyKind;
  x: number;
  y: number;
  t: number;
}

export interface PhaseFlow {
  readonly setup: PhaseSetup;
  state: PhaseStateName;
  /** Tempo restante no estado (estados sem duração ficam em 0). */
  t: number;
  stateMs: number;
  /** Onda atual (durante a onda) ou a última que terminou (no intervalo). */
  wave: number;
  /** Inimigos da onda que ainda vão nascer. */
  queue: EnemyKind[];
  pending: PendingSpawn[];
  spawnTimerMs: number;
  boss: Boss | null;
}

export function createPhaseFlow(setup: PhaseSetup): PhaseFlow {
  return {
    setup, state: "intro", t: PHASE_FLOW.introMs, stateMs: PHASE_FLOW.introMs, wave: 0,
    queue: [], pending: [], spawnTimerMs: 0, boss: null,
  };
}

/** Quantos inimigos da onda faltam: na fila, anunciados e vivos. */
export function remainingInWave(w: World, f: PhaseFlow): number {
  return f.queue.length + f.pending.length + aliveFromWave(w);
}

function aliveFromWave(w: World): number {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.get(i);
    if (e.fromWave && !e.dead) n++;
  }
  return n;
}

function setState(w: World, f: PhaseFlow, state: PhaseStateName, ms: number): void {
  f.state = state;
  f.t = f.stateMs = ms;
  w.events.push({ t: "phaseChanged", state, wave: f.wave });
}

export function stepPhase(w: World, dtMs: number): void {
  const f = w.phase;
  if (!f) return;
  if (w.playerDead && f.state !== "failed" && f.state !== "cleared") {
    setState(w, f, "failed", 0);
    return;
  }
  f.t -= dtMs;

  switch (f.state) {
    case "intro":
      if (f.t <= 0) startWave(w, f, 1);
      break;
    case "wave":
      stepWaveSpawner(w, f, dtMs);
      if (remainingInWave(w, f) === 0) {
        setState(w, f, "interlude", f.wave < f.setup.waves.length ? PHASE_FLOW.interludeMs : PHASE_FLOW.preBossMs);
      }
      break;
    case "interlude":
      if (f.t <= 0) {
        if (f.wave < f.setup.waves.length) startWave(w, f, f.wave + 1);
        else startBossIntro(w, f);
      }
      break;
    case "bossIntro":
      if (f.t <= 0 && f.boss) {
        activateBoss(f.boss);
        setState(w, f, "boss", 0);
      }
      break;
    case "boss":
      if (f.boss?.dead) setState(w, f, "cleared", PHASE_FLOW.clearDelayMs);
      break;
    case "cleared":
    case "failed":
      break;
  }
}

function startWave(w: World, f: PhaseFlow, n: number): void {
  f.wave = n;
  const def = f.setup.waves[n - 1];
  const queue: EnemyKind[] = [];
  for (const group of def?.enemies ?? []) for (let i = 0; i < group.count; i++) queue.push(group.kind);
  // a ordem de entrada é sorteada (com a semente): a onda não vem sempre na mesma sequência
  for (let i = queue.length - 1; i > 0; i--) {
    const j = w.rng.int(0, i);
    const tmp = queue[i] as EnemyKind;
    queue[i] = queue[j] as EnemyKind;
    queue[j] = tmp;
  }
  f.queue = queue;
  f.pending.length = 0;
  f.spawnTimerMs = 0;
  setState(w, f, "wave", 0);
}

function stepWaveSpawner(w: World, f: PhaseFlow, dtMs: number): void {
  // anúncios que venceram viram inimigos
  for (let i = f.pending.length - 1; i >= 0; i--) {
    const s = f.pending[i];
    if (!s) continue;
    s.t -= dtMs;
    if (s.t > 0) continue;
    spawnEnemy(w, s.kind, s.x, s.y, false, true);
    f.pending.splice(i, 1);
  }
  f.spawnTimerMs -= dtMs;
  if (f.spawnTimerMs > 0 || f.queue.length === 0) return;
  if (aliveFromWave(w) + f.pending.length >= WAVES.maxAlive) return;
  const kind = f.queue[0] as EnemyKind;
  const spot = pickSpawnPoint(w, f, ENEMY_DEFS[kind].stats.collRadius);
  // sem lugar agora: tenta de novo no próximo intervalo
  f.spawnTimerMs = WAVES.spawnIntervalMs;
  if (!spot) return;
  f.queue.shift();
  f.pending.push({ kind, x: spot.x, y: spot.y, t: WAVES.spawnWarnMs });
  w.events.push({ t: "spawnWarn", x: spot.x, y: spot.y });
}

/**
 * Ponto de nascimento: numa zona do mapa a pelo menos 220 px do jogador. Só se nenhuma zona
 * servir, um ponto livre qualquer com a mesma distância (GDD §3.1).
 */
function pickSpawnPoint(w: World, f: PhaseFlow, r: number): { x: number; y: number } | null {
  const p = w.player;
  const g = w.grid;
  const ok = (x: number, y: number) =>
    !overlapsRock(g, x, y, r) && len(x - p.x, y - p.y) >= WAVES.minDistFromPlayer;
  const zones = f.setup.spawnZones;
  for (let i = 0; i < WAVES.placementTries && zones.length > 0; i++) {
    const z = zones[w.rng.int(0, zones.length - 1)] as PxRect;
    const x = w.rng.range(z.x + r, z.x + z.w - r);
    const y = w.rng.range(z.y + r, z.y + z.h - r);
    if (ok(x, y)) return { x, y };
  }
  for (let i = 0; i < WAVES.placementTries; i++) {
    const x = w.rng.range(r, g.width - r);
    const y = w.rng.range(r, g.height - r);
    if (ok(x, y)) return { x, y };
  }
  return null;
}

function startBossIntro(w: World, f: PhaseFlow): void {
  const s = f.setup.bossSpawn;
  f.boss = createBoss(w, f.setup.boss, s.x, s.y);
  w.events.push({ t: "bossAppeared", x: s.x, y: s.y, boss: f.setup.boss });
  setState(w, f, "bossIntro", PHASE_FLOW.bossIntroMs);
}

// --- depuração (F3, F4, F5) -------------------------------------------------------------

/** Encerra a onda atual: mata os inimigos dela (sem drop) e esvazia a fila. */
export function debugSkipWave(w: World): void {
  const f = w.phase;
  if (!f || f.state !== "wave") return;
  f.queue.length = 0;
  f.pending.length = 0;
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.get(i);
    if (e.fromWave) e.dead = true;
  }
}

/** Pula direto para a entrada do chefe. */
export function debugSkipToBoss(w: World): void {
  const f = w.phase;
  if (!f || f.boss || f.state === "failed" || f.state === "cleared") return;
  f.queue.length = 0;
  f.pending.length = 0;
  for (let i = 0; i < w.enemies.count; i++) w.enemies.get(i).dead = true;
  f.wave = f.setup.waves.length;
  startBossIntro(w, f);
}
