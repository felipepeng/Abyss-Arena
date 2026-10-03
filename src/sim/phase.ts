import type { BossKind, EnemyKind } from "../config/kinds";
import { PHASE_FLOW, SURGES, WAVES, type SurgeDef, type SurgePattern } from "../config/waves";
import { TAU, len } from "../core/math";
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
// O nascimento das ondas mora aqui (GDD §3.1). Uma onda é uma sequência de LEVAS: a primeira vem
// com a onda e as outras quando sobram poucos inimigos ou passa um tempo. Cada leva tem o seu jeito
// de aparecer (espalhada, por um flanco, em pinça, em anel), e todo nascimento é telegrafado por
// 500 ms no ponto.

export type PhaseStateName = "intro" | "wave" | "interlude" | "bossIntro" | "boss" | "cleared" | "failed";

/** O que a fase precisa saber do mapa. */
export interface PhaseSetup {
  waves: readonly WaveDef[];
  boss: BossKind;
  bossSpawn: { x: number; y: number };
  spawnZones: readonly PxRect[];
  /**
   * Posições fixas dos inimigos que não nascem numa zona (`placement: "spot"`): os ouriços
   * do Leito e as tocas de enguia do Coral. Cada onda que os lista ocupa uma posição livre.
   */
  spots?: Readonly<Partial<Record<EnemyKind, readonly { x: number; y: number }[]>>>;
  /**
   * Onde as ondas podem nascer quando nenhuma zona serve. Sem isto, valeria o mapa inteiro, e uma
   * câmara fechada atrás da parede quebrável (o Coral) prenderia inimigos fora do alcance.
   */
  playArea?: PxRect;
}

interface PendingSpawn {
  kind: EnemyKind;
  x: number;
  y: number;
  t: number;
}

/** Um inimigo de uma leva que já entrou na fila, com o que o padrão da leva decidiu para ele. */
interface QueuedSpawn {
  kind: EnemyKind;
  pattern: SurgePattern;
  /** Zona de nascimento escolhida para o flanco ou a pinça (índice em `spawnZones`); -1 = qualquer. */
  zone: number;
  /** Ângulo dele no anel do cerco, em volta do jogador. */
  ang: number;
}

export interface PhaseFlow {
  readonly setup: PhaseSetup;
  state: PhaseStateName;
  /** Tempo restante no estado (estados sem duração ficam em 0). */
  t: number;
  stateMs: number;
  /** Onda atual (durante a onda) ou a última que terminou (no intervalo). */
  wave: number;
  /** Inimigos da onda que já foram liberados por uma leva e ainda vão nascer. */
  queue: QueuedSpawn[];
  pending: PendingSpawn[];
  spawnTimerMs: number;
  /** Levas da onda que ainda não entraram. */
  surges: SurgeDef[];
  /** Tempo desde a última leva liberada. */
  sinceSurgeMs: number;
  /** Nome da onda atual (`WaveDef.title`). */
  title: string;
  /** Aviso da leva que acabou de entrar ("PINÇA!"), com o tempo que ainda fica na tela. */
  banner: string;
  bannerMs: number;
  boss: Boss | null;
}

export function createPhaseFlow(setup: PhaseSetup): PhaseFlow {
  return {
    setup, state: "intro", t: PHASE_FLOW.introMs, stateMs: PHASE_FLOW.introMs, wave: 0,
    queue: [], pending: [], spawnTimerMs: 0, surges: [], sinceSurgeMs: 0, title: "", banner: "", bannerMs: 0, boss: null,
  };
}

/** Quantos inimigos da onda faltam: nas levas que ainda não entraram, na fila, anunciados e vivos. */
export function remainingInWave(w: World, f: PhaseFlow): number {
  let later = 0;
  for (const s of f.surges) for (const g of s.enemies) later += g.count;
  return later + f.queue.length + f.pending.length + aliveFromWave(w);
}

/** Quantos da onda já estão em campo ou a caminho (vivos, anunciados e na fila), sem as levas futuras. */
function inField(w: World, f: PhaseFlow): number {
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
  if (f.bannerMs > 0) f.bannerMs -= dtMs;

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
  f.title = def?.title ?? "";
  f.surges = def ? [...def.surges] : [];
  f.queue.length = 0;
  f.pending.length = 0;
  f.spawnTimerMs = 0;
  f.banner = "";
  f.bannerMs = 0;
  setState(w, f, "wave", 0);
  // a primeira leva vem com a onda (o nome da onda já está na tela, então sem aviso próprio)
  releaseSurge(w, f, false);
}

/** Libera a próxima leva: põe os inimigos dela na fila, já com o que o padrão decidiu para cada um. */
function releaseSurge(w: World, f: PhaseFlow, announce: boolean): void {
  const s = f.surges.shift();
  if (!s) return;
  f.sinceSurgeMs = 0;
  const kinds: EnemyKind[] = [];
  for (const g of s.enemies) for (let i = 0; i < g.count; i++) kinds.push(g.kind);
  // a ordem de entrada é sorteada (com a semente): a leva não vem sempre na mesma sequência
  for (let i = kinds.length - 1; i > 0; i--) {
    const j = w.rng.int(0, i);
    const tmp = kinds[i] as EnemyKind;
    kinds[i] = kinds[j] as EnemyKind;
    kinds[j] = tmp;
  }
  // flanco: uma zona para todos. Pinça: a zona mais distante dela para metade deles.
  let zoneA = -1;
  let zoneB = -1;
  if (s.pattern === "flank" || s.pattern === "pincer") {
    zoneA = pickZoneIndex(w, f);
    if (s.pattern === "pincer" && zoneA >= 0) zoneB = farthestZone(f, zoneA, w);
  }
  const base = w.rng.range(0, TAU);
  for (let i = 0; i < kinds.length; i++) {
    const kind = kinds[i] as EnemyKind;
    // os estáticos (ouriço, anêmona) não seguem o padrão: ocupam as posições fixas do mapa
    const spot = ENEMY_DEFS[kind].stats.placement === "spot";
    f.queue.push({
      kind,
      pattern: spot ? "scatter" : s.pattern,
      zone: s.pattern === "pincer" && i % 2 === 1 ? zoneB : zoneA,
      ang: base + (i / kinds.length) * TAU,
    });
  }
  if (announce) {
    f.banner = SURGES.banner[s.pattern];
    f.bannerMs = SURGES.bannerMs;
  }
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

  // a próxima leva entra quando sobram poucos em campo (quem joga bem não espera) ou quando passa
  // o tempo dela (quem demora é pressionado): o que vier primeiro
  f.sinceSurgeMs += dtMs;
  const next = f.surges[0];
  if (next) {
    const byTime = next.afterMs !== undefined && f.sinceSurgeMs >= next.afterMs;
    const byClear = next.whenAliveAtMost !== undefined && inField(w, f) <= next.whenAliveAtMost;
    if (byTime || byClear) releaseSurge(w, f, true);
  }

  f.spawnTimerMs -= dtMs;
  if (f.spawnTimerMs > 0 || f.queue.length === 0) return;
  const out = aliveFromWave(w) + f.pending.length;
  // O primeiro da fila que tem onde nascer: um estático sem posição livre (o jogador está em
  // cima de todas) não trava a onda. Sem lugar para ninguém agora, tenta no próximo intervalo.
  let underCap = false;
  for (let i = 0; i < f.queue.length; i++) {
    const q = f.queue[i] as QueuedSpawn;
    const scatter = q.pattern === "scatter";
    if (out >= (scatter ? WAVES.maxAlive : SURGES.maxAlive)) continue;
    underCap = true;
    const spot = pickSpawnPoint(w, f, q);
    if (!spot) continue;
    f.queue.splice(i, 1);
    // flanco, pinça e cerco entram quase juntos; o espalhado, um a cada intervalo
    f.spawnTimerMs = scatter ? WAVES.spawnIntervalMs : SURGES.staggerMs;
    f.pending.push({ kind: q.kind, x: spot.x, y: spot.y, t: WAVES.spawnWarnMs });
    w.events.push({ t: "spawnWarn", x: spot.x, y: spot.y });
    return;
  }
  if (underCap) f.spawnTimerMs = WAVES.spawnIntervalMs;
}

/** Uma zona de nascimento longe o bastante do jogador para servir de flanco: sorteia entre as que servem. */
function pickZoneIndex(w: World, f: PhaseFlow): number {
  const zones = f.setup.spawnZones;
  const usable: number[] = [];
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i] as PxRect;
    if (len(z.x + z.w / 2 - w.player.x, z.y + z.h / 2 - w.player.y) >= SURGES.zoneMinDist) usable.push(i);
  }
  return usable.length === 0 ? -1 : (usable[w.rng.int(0, usable.length - 1)] as number);
}

/** A zona (que também serve) mais distante da zona `from`: o outro lado da pinça. */
function farthestZone(f: PhaseFlow, from: number, w: World): number {
  const zones = f.setup.spawnZones;
  const a = zones[from] as PxRect;
  let best = from;
  let bestD = -1;
  for (let i = 0; i < zones.length; i++) {
    if (i === from) continue;
    const z = zones[i] as PxRect;
    if (len(z.x + z.w / 2 - w.player.x, z.y + z.h / 2 - w.player.y) < SURGES.zoneMinDist) continue;
    const d = len(z.x + z.w / 2 - (a.x + a.w / 2), z.y + z.h / 2 - (a.y + a.h / 2));
    if (d > bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Ponto de nascimento de um inimigo da fila. O padrão da leva manda: no anel, em volta do jogador;
 * no flanco ou na pinça, na zona escolhida. Se isso não der (rocha, jogador perto), cai no jeito
 * de sempre: numa zona do mapa a pelo menos 220 px do jogador e, só se nenhuma servir, um ponto
 * livre qualquer com a mesma distância (GDD §3.1).
 */
function pickSpawnPoint(w: World, f: PhaseFlow, q: QueuedSpawn): { x: number; y: number } | null {
  const stats = ENEMY_DEFS[q.kind].stats;
  if (stats.placement === "spot") return pickSpot(w, f, q.kind, stats.collRadius);
  const r = stats.collRadius;
  const p = w.player;
  const g = w.grid;
  const area = f.setup.playArea ?? { x: 0, y: 0, w: g.width, h: g.height };
  const ok = (x: number, y: number) =>
    !overlapsRock(g, x, y, r) && len(x - p.x, y - p.y) >= WAVES.minDistFromPlayer;
  const zones = f.setup.spawnZones;

  if (q.pattern === "ring") {
    for (let i = 0; i < WAVES.placementTries; i++) {
      // a primeira tentativa é o ângulo certo do anel; as seguintes abrem o leque para fugir da rocha
      const spread = i === 0 ? 0 : SURGES.ringJitter * (1 + i / 12);
      const a = q.ang + (spread === 0 ? 0 : w.rng.range(-spread, spread));
      const d = w.rng.range(SURGES.ringRadius[0], SURGES.ringRadius[1]);
      const x = p.x + Math.cos(a) * d;
      const y = p.y + Math.sin(a) * d;
      const inside = x >= area.x + r && x <= area.x + area.w - r && y >= area.y + r && y <= area.y + area.h - r;
      if (inside && ok(x, y)) return { x, y };
    }
  } else if (q.zone >= 0 && q.zone < zones.length) {
    const z = zones[q.zone] as PxRect;
    for (let i = 0; i < WAVES.placementTries; i++) {
      const x = w.rng.range(z.x + r, z.x + z.w - r);
      const y = w.rng.range(z.y + r, z.y + z.h - r);
      if (ok(x, y)) return { x, y };
    }
  }

  for (let i = 0; i < WAVES.placementTries && zones.length > 0; i++) {
    const z = zones[w.rng.int(0, zones.length - 1)] as PxRect;
    const x = w.rng.range(z.x + r, z.x + z.w - r);
    const y = w.rng.range(z.y + r, z.y + z.h - r);
    if (ok(x, y)) return { x, y };
  }
  for (let i = 0; i < WAVES.placementTries; i++) {
    const x = w.rng.range(area.x + r, area.x + area.w - r);
    const y = w.rng.range(area.y + r, area.y + area.h - r);
    if (ok(x, y)) return { x, y };
  }
  return null;
}

/**
 * Posição fixa livre de um estático: sem outro da mesma espécie nela (vivo ou anunciado), sem
 * rocha e a pelo menos 220 px do jogador. Sorteia entre as que servem.
 */
function pickSpot(w: World, f: PhaseFlow, kind: EnemyKind, r: number): { x: number; y: number } | null {
  const spots = f.setup.spots?.[kind];
  if (!spots) return null;
  const p = w.player;
  const usable: { x: number; y: number }[] = [];
  for (const s of spots) {
    if (overlapsRock(w.grid, s.x, s.y, r) || len(s.x - p.x, s.y - p.y) < WAVES.minDistFromPlayer) continue;
    if (spotTaken(w, f, kind, s.x, s.y)) continue;
    usable.push(s);
  }
  return usable.length === 0 ? null : (usable[w.rng.int(0, usable.length - 1)] as { x: number; y: number });
}

function spotTaken(w: World, f: PhaseFlow, kind: EnemyKind, x: number, y: number): boolean {
  for (let i = 0; i < w.enemies.count; i++) {
    const e = w.enemies.get(i);
    if (!e.dead && e.kind === kind && len(e.x - x, e.y - y) < WAVES.spotSize) return true;
  }
  for (const s of f.pending) if (s.kind === kind && len(s.x - x, s.y - y) < WAVES.spotSize) return true;
  return false;
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
  f.surges.length = 0;
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
  f.surges.length = 0;
  f.pending.length = 0;
  for (let i = 0; i < w.enemies.count; i++) w.enemies.get(i).dead = true;
  f.wave = f.setup.waves.length;
  startBossIntro(w, f);
}
