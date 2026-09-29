// Jogador. Números do protótipo (CONTEXTO §3, §4, §8); a única mudança aprovada é a
// invulnerabilidade do dash (GDD §4.2). Regra 7: nada aqui muda sem motivo registrado.

export const PLAYER = {
  /** Raio do corpo. A colisão usa `radius · collScale` = 7,65 px. */
  radius: 9,
  collScale: 0.85,
  /**
   * Aceleração alta + teto baixo + arrasto implícito: chega a 250 px/s em ~267 ms e desliza
   * ~70 px ao soltar. A terminal teórica (accel/drag = 441 px/s) fica acima do teto, então é
   * o teto que manda. Reduzir `accel` mata a resposta; reduzir `drag` vira patinação.
   */
  accel: 1500,
  maxSpeed: 250,
  drag: 3.4,
  /** Fração do arrasto durante dash e estocada (sem teto), para o impulso ter peso. */
  boostDragScale: 0.35,
  hp: 100,

  dash: {
    speed: 640,
    /** 140 ms: 82,4 px no passo fixo, medidos no protótipo (o nominal 640 × 0,14 ≈ 89 px ignora o arrasto). */
    durationMs: 140,
    cooldownMs: 1200,
    /**
     * Invulnerável nos primeiros 100 ms (GDD §4.2). Os 40 ms finais sem proteção existem de
     * propósito: um dash mal cronometrado ainda termina dentro do perigo.
     */
    invulnMs: 100,
  },

  hurt: {
    /** 40 passos a 60 Hz. Janela única e global: impede que um enxame mate de uma vez. */
    invulnMs: 667,
    knockback: 330,
    blinkMs: 80,
  },
} as const;
