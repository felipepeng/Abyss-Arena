// Nascimento PROVISÓRIO por tempo, igual ao do protótipo (CONTEXTO §5.3). Existe só para a
// arena de teste do M2; no M3 é substituído pelas ondas (GDD §3).

export const TEST_SPAWN = {
  firstDelayMs: 1200,
  intervalMs: 2600,
  /** O intervalo encurta a cada nascimento, até o piso. */
  intervalDecayMs: 90,
  intervalMinMs: 1100,
  maxAlive: 9,
  fishChance: 0.6,
  minDistFromPlayer: 220,
  /** Tentativas de achar um ponto livre antes de desistir naquele tique. */
  placementTries: 400,
} as const;

/** Anel de projéteis de teste (F8): serve para testar o pool, o estouro e a erosão. */
export const DEBUG_RING = {
  count: 24,
  radius: 260,
  speed: 200,
  damage: 10,
  lifeMs: 5000,
  r: 6,
  color: "#ffe07a",
} as const;
