// Água-viva Colossal: controle de espaço (CONTEXTO §6.2, GDD §8.2). Números do protótipo.
// Pares [fase 1, fase 2].

export const JELLY = {
  name: "ÁGUA-VIVA COLOSSAL",
  rageLabel: "INCANDESCENTE",
  hp: 380,
  radius: 42,
  collRadius: 25,
  speed: 80,
  accel: 540,
  drag: 2.2,
  contactDamage: 10,
  /** O contato vale dentro de `radius · contactRadiusScale` (o sino, não os tentáculos). */
  contactRadiusScale: 0.8,
  /** Flutua a esta distância do jogador e um pouco acima dele (y negativo = para cima). */
  hoverDist: 215,
  hoverBias: -55,
  /** Durante os ataques fica ancorada: freia a esta taxa (1/s). */
  anchorBrake: 4,
  turnLerp: 0.04,
  /** Respiração do sino, rad/s por fase (só visual). */
  pulseRate: [2.2, 3.6],

  phase2Below: 0.5,
  thinkMs: [800, 440],
  phaseChangeThinkMs: 300,
  rerollRepeatChance: 0.6,

  ring: {
    telegraphMs: [620, 440],
    count: [14, 20],
    waves: [1, 3],
    waveGapMs: 190,
    /** Cada onda sai girada, abrindo brechas diferentes. */
    waveTwist: 0.22,
    speed: 195,
    damage: 11,
    lifeMs: 4200,
    r: 6,
    /** Os esporos saem da borda do sino. */
    spawnRadiusScale: 0.7,
    color: "#8affe0",
  },
  beam: {
    telegraphMs: [700, 520],
    sweepMs: [1100, 1400],
    /**
     * Regra 3: a velocidade tangencial do raio na distância de flutuação é ω · 215 px.
     * 0,85 · 215 = 183 px/s e 1,0 · 215 = 215 px/s, abaixo de 250 (o nado). Acima de ~1,16 rad/s
     * o raio fica impossível de superar nadando. O teste de config confere a conta.
     */
    sweepSpeed: [0.85, 1.0],
    length: 640,
    halfWidth: 11,
    damage: 16,
    /** Colar nela é seguro: o raio só começa a esta distância. */
    innerGap: 48,
    /**
     * A ponta SAI da água-viva e viaja até você. Sem isso ele nascia com o comprimento inteiro
     * já sobre o jogador. Na distância de flutuação dá ~280 ms de reação.
     */
    growSpeed: 620,
    /** Piso de reação: de perto, a ponta chegaria quase junto. */
    armDelayMs: 130,
    /** A rocha faz sombra: o raio para no primeiro bloco. Passo do teste, em px. */
    rayStep: 8,
  },
  pull: {
    telegraphMs: 520,
    durationMs: 1100,
    force: 640,
    radius: 330,
    stingerEveryMs: 150,
    stingerSpeed: 250,
    stingerSpread: 0.5,
    damage: 9,
    lifeMs: 2600,
    r: 5,
    spawnRadiusScale: 0.6,
    /** Chance por passo de uma bolha na corrente (visual, mas sorteada na simulação como no protótipo). */
    streamBubbleChance: 0.25,
    color: "#ffd6f5",
  },
} as const;
