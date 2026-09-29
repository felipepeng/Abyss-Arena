import { PLAYER } from "../../src/config/player";
import { BOSS_DEFS } from "../../src/sim/bosses/registry";
import type { SimEvent } from "../../src/sim/events";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, stepWorld, type World } from "../../src/sim/world";
import type { MapDef } from "../../src/world/mapdef";
import { Bot, type BotSkill } from "./bot";

// Bancada de simulação (M8): joga uma fase inteira ou só a luta contra o chefe, sem tela, com
// o jogador-robô, e devolve números. Determinística: mesma semente e habilidade, mesmo
// resultado.

export const STEP = 1000 / 60;

export interface PhaseResult {
  map: string;
  seed: number;
  outcome: "cleared" | "dead" | "timeout";
  /** Onde morreu: "onda 2", "chefe fase 1"... */
  diedAt: string | null;
  /** Vida ao entrar no intervalo depois de cada onda (a última é a da chegada ao chefe). */
  hpAfterWave: number[];
  /** Quantas curas o jogador pegou. */
  heals: number;
  /** Quantas ele deixou sumir no chão. */
  timeMs: number;
  bossMs: number;
  damageTaken: number;
  kills: number;
}

export interface RunOptions {
  maxMs?: number;
}

/** Joga uma fase (ondas → chefe) até o fim, a morte ou o limite de tempo. */
export function playPhase(map: MapDef, seed: number, skill: BotSkill, opts: RunOptions = {}): PhaseResult {
  const w = createMapWorld(map, seed);
  const bot = new Bot(skill);
  const maxMs = opts.maxMs ?? 9 * 60_000;
  const hpAfterWave: number[] = [];
  let heals = 0;
  let damage = 0;
  let bossStart = -1;
  let diedAt: string | null = null;

  while (w.timeMs < maxMs) {
    if (w.hitStopMs > 0) {
      w.hitStopMs -= STEP;
      continue;
    }
    stepWorld(w, bot.intent(w), STEP);
    for (const e of w.events.list) {
      if (e.t === "pickup") heals++;
      if (e.t === "playerHurt") damage += e.amount;
      if (e.t === "phaseChanged" && e.state === "interlude") hpAfterWave.push(w.player.hp);
      if (e.t === "phaseChanged" && e.state === "bossIntro") bossStart = w.timeMs;
    }
    const f = w.phase;
    if (w.playerDead) {
      const b = f?.boss;
      diedAt = b && f?.state !== "wave" ? `chefe fase ${b.phase + 1}` : `onda ${f?.wave ?? 0}`;
      break;
    }
    if (f?.state === "cleared") break;
  }
  const cleared = w.phase?.state === "cleared";
  return {
    map: map.id,
    seed,
    outcome: cleared ? "cleared" : w.playerDead ? "dead" : "timeout",
    diedAt,
    hpAfterWave,
    heals,
    timeMs: w.timeMs,
    bossMs: bossStart < 0 ? 0 : w.timeMs - bossStart,
    damageTaken: damage,
    kills: w.kills,
  };
}

export interface BossPressure {
  /** Dano por minuto que o robô tomou. */
  damagePerMin: number;
  /** Quantos golpes distintos o atingiram. */
  hits: number;
  /** Dano por minuto que ele causou ao chefe (o chefe é mantido vivo). */
  bossDamagePerMin: number;
}

/**
 * A pressão de uma fase do chefe: o chefe fica travado na fração de vida `hpFrac` (para a fase
 * não mudar) e o robô, com vida enorme, luta por `seconds`. O dano tomado por minuto é a medida
 * de quanto o chefe aperta.
 */
export function bossPressure(map: MapDef, seed: number, skill: BotSkill, hpFrac: number, seconds: number): BossPressure {
  const w = createMapWorld(map, seed);
  const bot = new Bot(skill);
  debugSkipToBoss(w);
  const BIG = 1e6;
  w.player.hp = BIG;
  let hits = 0;
  let bossLost = 0;
  const f = w.phase;
  if (!f?.boss) throw new Error("sem chefe");
  const boss = f.boss;
  const def = BOSS_DEFS[boss.kind];
  void def;
  // deixa a entrada do chefe passar e ele começar na fração de vida pedida
  let elapsed = 0;
  let started = false;
  const total = seconds * 1000;
  for (let guard = 0; guard < 60 * 60 * 20 && elapsed < total; guard++) {
    if (w.hitStopMs > 0) {
      w.hitStopMs -= STEP;
      if (started) elapsed += STEP;
      continue;
    }
    if (boss.active) {
      if (!started) {
        boss.hp = boss.maxHp * hpFrac;
        started = true;
      }
      const before = boss.hp;
      // trava a vida na fração pedida: a fase do chefe não muda
      stepWorld(w, bot.intent(w), STEP);
      bossLost += Math.max(0, before - boss.hp);
      boss.hp = boss.maxHp * hpFrac;
      elapsed += STEP;
    } else {
      stepWorld(w, bot.intent(w), STEP);
    }
    for (const e of w.events.list as readonly SimEvent[]) if (e.t === "playerHurt") hits++;
  }
  const minutes = seconds / 60;
  return {
    damagePerMin: (BIG - w.player.hp) / minutes,
    hits: hits / minutes,
    bossDamagePerMin: bossLost / minutes,
  };
}

/** Roda `fn` com a invulnerabilidade do dash trocada (regra 7: o config volta ao valor original). */
export function withDashInvuln<T>(ms: number, fn: () => T): T {
  const dash = PLAYER.dash as { invulnMs: number };
  const old = dash.invulnMs;
  dash.invulnMs = ms;
  try {
    return fn();
  } finally {
    dash.invulnMs = old;
  }
}

export const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);
export const pct = (n: number, d: number): string => `${d === 0 ? 0 : Math.round((100 * n) / d)}%`;
export type { World };
