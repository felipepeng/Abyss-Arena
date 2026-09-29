// Olho do Abismo: bullet hell (CONTEXTO §6.3, GDD §8.3). Números do protótipo.
// Trios [fase 1, fase 2, fase 3].

export const EYE = {
  name: "OLHO DO ABISMO",
  rageLabel: "DESPERTO",
  hp: 560,
  radius: 46,
  collRadius: 30,
  speed: 72,
  accel: 430,
  drag: 2.4,
  contactDamage: 14,
  contactRadiusScale: 0.85,
  /** Leque e espiral saem da borda do olho, a esta fração do raio. */
  muzzleScale: 0.8,
  /** Recua se o jogador chegar mais perto que isto. */
  keepDist: 300,
  /** Recuando, mira um ponto a esta distância, do lado oposto ao jogador. */
  retreatDist: 120,
  /** Vagueia numa elipse em volta do centro do mapa (o eixo vertical é `driftR · driftYScale`). */
  driftR: 260,
  driftYScale: 0.6,
  driftRate: 0.45,
  /** Durante os ataques fica ancorado. */
  anchorBrake: 3.5,
  turnLerp: 0.08,
  /** Pulsação, rad/s: base + por fase (só visual; o olho enlouquece). */
  pulseRate: { base: 1.4, perPhase: 0.7 },

  /** Limiares de fase: 100–66%, 66–33%, abaixo de 33% (com ≤, como no protótipo). */
  phaseAt: [1, 0.66, 0.33],
  thinkMs: [700, 520, 380],
  /** Pausa antes do primeiro ataque, maior que a da fase 1 (como no protótipo). */
  firstThinkMs: 900,
  phaseChangeThinkMs: 420,
  rerollRepeatChance: 0.65,
  /** Fração dos pilares que sobra em cada fase: a cobertura é aprendida e depois retirada. */
  pillarKeepByPhase: [1, 0.45, 0],
  /** Chance de cada bloco de pilar dissolvido soltar uma bolha (sorteada na simulação). */
  dissolveBubbleChance: 0.45,

  fan: {
    telegraphMs: [520, 520, 380],
    count: [5, 7, 9],
    volleys: [2, 2, 3],
    volleyGapMs: 170,
    spread: 0.85,
    speed: 230,
    damage: 10,
    lifeMs: 5000,
    r: 6,
    color: "#ffe07a",
    /** Raio do setor desenhado no aviso. */
    warnRadius: 640,
  },
  spiral: {
    telegraphMs: 600,
    durationMs: [2000, 2400, 2600],
    arms: [1, 2, 3],
    emitEveryMs: 70,
    /**
     * Rotação dos braços. Não é uma varredura contínua (regra 3 não se aplica): os projéteis
     * saem em linha reta, e o jogador passa entre eles, não na frente de um braço sólido.
     */
    spinSpeed: 2.3,
    speed: 200,
    damage: 10,
    lifeMs: 6000,
    r: 6,
    color: "#9ad8ff",
  },
  siege: {
    telegraphMs: 700,
    /** Nasce num anel em volta do JOGADOR e fecha: esconder atrás de uma pedra não resolve. */
    ringR: 430,
    count: [18, 24, 30],
    speed: 215,
    damage: 12,
    lifeMs: 5000,
    r: 7,
    color: "#ff9ad8",
  },
  seekers: {
    telegraphMs: 620,
    count: [0, 5, 8],
    /** Espalhamento aleatório do ângulo de saída de cada perseguidor. */
    jitter: 0.2,
    speed: 135,
    /** Curvam com taxa limitada (dá para driblar) e ATRAVESSAM a rocha. */
    turnRate: 1.5,
    damage: 11,
    lifeMs: 7000,
    r: 8,
    color: "#c8a0ff",
  },
  rain: {
    telegraphMs: 700,
    durationMs: 2200,
    everyMs: 90,
    perEmit: 3,
    /** Cai numa faixa centrada no jogador. */
    spreadX: 620,
    /** Nasce logo abaixo da borda de cima: 2 blocos + 10 px. */
    spawnY: 50,
    /** Margem lateral, para não nascer dentro da borda. */
    edgeMargin: 48,
    angleJitter: 0.14,
    speed: 260,
    damage: 10,
    lifeMs: 6000,
    r: 6,
    color: "#a8ffd8",
  },
} as const;
