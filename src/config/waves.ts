// Fluxo de uma fase e ondas (GDD §2.2 e §3.1).
import type { EnemyKind } from "./kinds";

export const PHASE_FLOW = {
  /** Cartão de título: o jogador já nada, mas nada nasce. */
  introMs: 2500,
  /** Pausa entre ondas, com o texto "ONDA n". */
  interludeMs: 2500,
  /** Pausa depois da onda 3, antes da entrada do chefe. */
  preBossMs: 3000,
  /** Entrada do chefe: nome na tela e barra enchendo; ele não ataca nem sofre dano. */
  bossIntroMs: 1500,
  /** Depois da morte do chefe, antes de a fase contar como concluída. */
  clearDelayMs: 1200,
} as const;

export const WAVES = {
  /** Um nascimento a cada intervalo, até o teto de vivos. */
  spawnIntervalMs: 600,
  maxAlive: 6,
  /** Nascer também é telegrafado: redemoinho de bolhas antes de o inimigo aparecer. */
  spawnWarnMs: 500,
  minDistFromPlayer: 220,
  /** Tentativas de achar um ponto livre dentro de uma zona (e, na falta, no mapa). */
  placementTries: 60,
  /** Duas posições fixas da mesma espécie a menos disto contam como a mesma. */
  spotSize: 12,
} as const;

// --- Levas (GDD §3.1) -------------------------------------------------------------------------
//
// Uma onda não é uma fila só: é uma sequência de LEVAS, cada uma entrando de um jeito. A primeira
// vem com a onda; as outras vêm quando sobram poucos inimigos (quem joga bem não espera) ou depois
// de um tempo (quem demora é pressionado), o que chegar primeiro.

/** Como uma leva aparece no mapa. */
export type SurgePattern =
  /** Cada um numa zona de nascimento qualquer, um a cada intervalo (o jeito antigo). */
  | "scatter"
  /** Todos de uma mesma zona, quase juntos: um bando que chega por um lado só. */
  | "flank"
  /** De duas zonas opostas ao mesmo tempo: o jogador fica no meio. */
  | "pincer"
  /** Em anel em volta do jogador, a uma distância que dá tempo de reagir. */
  | "ring";

export interface SurgeDef {
  readonly enemies: readonly { readonly kind: EnemyKind; readonly count: number }[];
  readonly pattern: SurgePattern;
  /** Entra quando passou este tempo desde a leva anterior. Sem isto, só pelo outro critério. */
  readonly afterMs?: number;
  /** Entra quando restam até tanto da onda em campo (vivos, anunciados e na fila). */
  readonly whenAliveAtMost?: number;
}

/** Uma onda como os mapas a descrevem: um nome, as levas e o total por tipo (derivado das levas). */
export interface WaveSpec {
  readonly title: string;
  readonly surges: readonly SurgeDef[];
  readonly enemies: readonly { readonly kind: EnemyKind; readonly count: number }[];
}

/** Monta uma onda e soma o total de cada tipo, para o GDD §3.2 continuar sendo a tabela de totais. */
export function makeWave(title: string, surges: readonly SurgeDef[]): WaveSpec {
  const total = new Map<EnemyKind, number>();
  for (const s of surges) for (const g of s.enemies) total.set(g.kind, (total.get(g.kind) ?? 0) + g.count);
  return { title, surges, enemies: [...total].map(([kind, count]) => ({ kind, count })) };
}

export const SURGES = {
  /** Intervalo entre nascimentos de uma leva que não é `scatter`: quase juntos, mas escalonados. */
  staggerMs: 150,
  /** Teto de vivos da onda quando há levas de bando, pinça ou cerco (o `scatter` usa `WAVES.maxAlive`). */
  maxAlive: 10,
  /** Distância do anel do cerco ao jogador, px: longe o bastante para dar tempo de olhar em volta. */
  ringRadius: [270, 340] as const,
  /** Quanto o ângulo de um nascimento do anel pode variar para fugir da rocha, rad. */
  ringJitter: 0.4,
  /** Uma zona só serve de flanco ou pinça a esta distância do jogador, px. */
  zoneMinDist: 260,
  /** Quanto dura o aviso "PELO FLANCO!" no HUD. */
  bannerMs: 1700,
  banner: {
    scatter: "REFORÇOS!",
    flank: "PELO FLANCO!",
    pincer: "PINÇA!",
    ring: "CERCADO!",
  } satisfies Record<SurgePattern, string>,
} as const;
