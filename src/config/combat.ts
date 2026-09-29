// Regras gerais de combate que não pertencem a uma criatura só.

export const COMBAT = {
  /**
   * Durante o ataque, o contato alcança alguns px a mais que a soma dos raios: a investida
   * "pega" de raspão. Fora do ataque, só a soma dos raios (CONTEXTO §4.4).
   */
  harmfulContactReach: 4,
  /** Fora do ataque, encostar causa esta fração do dano, arredondada para cima. */
  idleContactScale: 0.5,
} as const;

/** Teto do pool de inimigos (ondas têm no máximo 6 vivos, mais capangas e alvos de teste). */
export const ENEMY_POOL_SIZE = 64;

export const PROJECTILES = {
  /** Teto global (o pico medido no protótipo foi 109). */
  maxAlive: 900,
  /** Chance de um impacto que erode destruir o bloco atingido (só rocha comum, nunca protegida). */
  erodeChance: 0.3,
  /** Rotação das farpas, rad/s (só visual, mas o ângulo inicial vem do sorteio da simulação). */
  spinRate: 8,
} as const;
