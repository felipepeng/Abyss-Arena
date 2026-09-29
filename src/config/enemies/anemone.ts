// Anêmona-chicote: fixa num coral, varre uma volta de 270° com um braço comprido (GDD §6.2).
// Ensina a ler uma varredura rotativa, que é o raio da Água-viva em miniatura.

export const ANEMONE = {
  radius: 13,
  /** Caixa de colisão de 9,1 px: cabe no bloco de 20 px encostado na coluna, onde ela mora. */
  collScale: 0.7,
  hp: 40,
  drag: 3.0,
  /** Descanso entre as varreduras. */
  restMs: 1800,
  telegraphMs: 600,
  /** Ângulo total da varredura, rad (270°). */
  sweepRad: (3 * Math.PI) / 2,
  /**
   * Velocidade angular do braço, rad/s, e o comprimento dele, px.
   * Regra 3 (ω · distância < 250 px/s): 2,0 · 110 = 220 px/s na ponta, abaixo do nado (250).
   * Uma varredura leva 270° / 2 rad/s = 2356 ms.
   */
  omega: 2.0,
  armLen: 110,
  /** O braço fere quem chega a esta distância do eixo dele, além do raio do jogador. */
  armRadius: 6,

  /** Dano do braço; encostar fora da varredura dói a metade (6). */
  contactDamage: 12,
  dropChance: 0.3,
} as const;
