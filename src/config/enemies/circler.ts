// Circulador: orbitador com estocada curta (CONTEXTO §5.2, GDD §6.1). Números do protótipo.

export const CIRCLER = {
  radius: 13,
  collScale: 0.85,
  hp: 46,
  speed: 132,
  accel: 1000,
  drag: 3.2,
  /**
   * Persegue um PONTO que gira em volta do jogador, não o jogador: o movimento circular sai
   * sem nenhuma matemática de órbita. 1,9 rad/s a 92 px = 175 px/s, abaixo do nado (250).
   */
  orbitR: 92,
  orbitSpeed: 1.9,
  /** Começa o aviso quando está a menos de `orbitR · windupRangeScale` (138 px). */
  windupRangeScale: 1.5,
  /** Rotação própria do corpo, rad/s (só visual). */
  spinRate: 4,

  windupMs: 300,
  windupBrake: 5,
  strikeMs: 220,
  strikeSpeed: 380,
  restMs: 700,
  restBrake: 3,
  /** Depois do descanso, espera um sorteio neste intervalo antes de poder atacar de novo. */
  orbitDelayMs: [400, 1100],

  contactDamage: 11,
  dropChance: 0.3,
} as const;
