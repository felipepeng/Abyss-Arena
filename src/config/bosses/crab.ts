// Caranguejo Abissal: pressão corpo a corpo (CONTEXTO §6.1, GDD §8.1). Números do protótipo.

export const CRAB = {
  name: "CARANGUEJO ABISSAL",
  rageLabel: "ENFURECIDO",
  hp: 420,
  /** Raio visual (e da hitbox da lança). */
  radius: 38,
  /** Colisão menor que o visual, para caber entre as formações. */
  collRadius: 23,
  speed: 90,
  accel: 700,
  drag: 2.6,
  /** Contato fora da investida (o valor já é o reduzido). */
  contactDamage: 12,
  /** Enquanto pensa, se aproxima com esta fração da aceleração: nunca fica realmente parado. */
  thinkAccelScale: 0.45,
  /** Orientação do corpo: interpolação angular por passo na direção do jogador (visual). */
  turnLerp: 0.06,

  /** Abaixo de 50% da vida (estritamente), entra na fase 2. */
  phase2Below: 0.5,
  /** Pausa entre ataques, por fase. */
  thinkMs: [900, 520],
  /** Pausa curta logo depois de mudar de fase. */
  phaseChangeThinkMs: 260,
  /** Sorteio: se repetir o último ataque, sorteia de novo com esta chance. */
  rerollRepeatChance: 0.6,

  /** Bateu na rocha pensando ou investindo: desliza pela tangente em vez de moer a parede. */
  slide: { durationMs: 700, accelScale: 0.9 },

  dash: {
    telegraphMs: [620, 420],
    durationMs: 620,
    speed: [520, 640],
    damage: 20,
    /** A investida pega de raspão: alcance de contato além da soma dos raios. */
    reach: 6,
    brake: 6,
    /** Fase 2: chance de emendar outra investida, com aviso encurtado por este fator. */
    chainChance: 0.55,
    chainTelegraphScale: 0.7,
    /** Comprimento da faixa de aviso (a investida anda ~520 px). */
    laneLength: 520,
    laneHalfWidth: 26,
  },
  pinch: {
    telegraphMs: [520, 360],
    activeMs: 180,
    radius: [118, 150],
    damage: 24,
    brake: 5,
  },
  call: {
    telegraphMs: 700,
    count: 3,
    brake: 4,
    /** Os peixes nascem num anel a esta distância além do raio do chefe. */
    ringGap: 34,
    /** Se o ponto do anel cair na rocha, tenta um ponto livre a esta distância do jogador. */
    fallbackMinDist: 120,
    fallbackTries: 400,
  },
} as const;
