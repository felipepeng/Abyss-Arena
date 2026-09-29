// Lampreia: pequena, rápida, vem em enxame (GDD §6.2). Ensina a gerir quantidade e a usar a
// estocada carregada para abrir caminho.

export const LAMPREY = {
  radius: 8,
  collScale: 0.85,
  // 18: sobrevive a uma estocada sem carga (16), morre na segunda. Questão em aberto: 18 ou 16
  // (GDD §13).
  hp: 18,
  speed: 190,
  accel: 1100,
  drag: 3.0,
  sightR: 560,
  /** Fora do raio de visão avança devagar até o jogador, em vez de ficar parada. */
  farSpeed: 70,
  /**
   * Cada uma mira um ponto deslocado do jogador (sorteado ao nascer) que se fecha sobre ele ao
   * chegar perto. Os inimigos não colidem entre si, e sem isto o enxame virava uma bola só.
   */
  spreadR: 46,
  spreadFadeDist: 120,
  turnLerp: 0.3,
  /** Começa o aviso a menos disto do jogador. */
  attackRange: 80,

  telegraphMs: 300,
  telegraphBrake: 6,
  biteMs: 180,
  biteSpeed: 320,
  recoverMs: 450,
  recoverBrake: 3,
  rechargeDelayMs: [200, 700],

  /** Mordida; encostar fora dela dói a metade (arredondada para cima). */
  contactDamage: 7,
  dropChance: 0.1,
} as const;
