// Ermitão: blindado, lento, com uma pinça à frente (GDD §6.2). Ensina a flanquear.

export const HERMIT = {
  radius: 14,
  collScale: 0.85,
  hp: 60,
  speed: 70,
  accel: 500,
  drag: 3.0,
  /**
   * Velocidade máxima de giro do corpo, rad/s. A frente do ermitão (onde fica a blindagem e a
   * pinça) só segue o jogador a esta taxa, então circular por ele funciona.
   * Regra 3 (ω · distância < 250 px/s): 2,2 · 56 (o alcance do aviso) = 123 px/s.
   */
  turnRate: 2.2,
  /** Meio arco da frente: um acerto dentro dele é bloqueado e a pinça alcança dentro dele. */
  frontHalfArc: Math.PI / 3,
  /** Começa o aviso quando o jogador está a menos disto do centro dele. */
  attackRange: 56,
  /** Alcance da pinça, do centro do ermitão até a borda do jogador. */
  strikeReach: 40,
  telegraphMs: 450,
  telegraphBrake: 5,
  strikeMs: 160,
  recoverMs: 600,
  recoverBrake: 4,
  /** Depois de se recuperar, espera um sorteio neste intervalo antes de poder atacar de novo. */
  rechargeDelayMs: [500, 1200],
  /** Não empurra o jogador para dentro de si: para de acelerar a esta distância. */
  holdDist: 34,

  /** Dano da pinça; encostar fora dela dói a metade (6). */
  contactDamage: 12,
  dropChance: 0.45,
} as const;
