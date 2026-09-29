// Fluxo de uma fase e ondas (GDD §2.2 e §3.1).

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
} as const;
