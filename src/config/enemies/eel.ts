// Enguia: mora numa toca e dá um bote quando o jogador chega perto (GDD §6.2). Ensina que o
// terreno também ataca. Escondida, não pode ser atingida.

export const EEL = {
  radius: 9,
  collScale: 0.85,
  hp: 40,
  drag: 3.0,
  /** O jogador a menos disto da toca dispara o aviso. */
  triggerR: 160,
  telegraphMs: 450,
  /**
   * Bote: 520 px/s · 0,3 s = 156 px de alcance, do tamanho do gatilho (160). Quem dispara o
   * aviso está, no máximo, na ponta do bote.
   */
  strikeMs: 300,
  strikeSpeed: 520,
  /** Tempo da volta à toca (o jogador pune aqui). */
  returnMs: 600,
  /** Velocidade mínima da volta, para uma enguia que mal saiu não se arrastar. */
  returnMinSpeed: 140,
  /** A volta acaba a esta distância da toca (e o corpo é colocado nela). */
  returnSnapDist: 6,
  /** Depois de esconder, espera isto antes de poder reagir de novo. */
  rehideMs: 1400,
  /** Logo que nasce, espera isto: o jogador precisa de um respiro. */
  spawnGraceMs: 600,

  contactDamage: 13,
  dropChance: 0.35,
} as const;
