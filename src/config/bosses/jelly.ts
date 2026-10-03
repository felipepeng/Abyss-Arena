// Água-viva Colossal: controle de espaço (CONTEXTO §6.2, GDD §8.2). Números do protótipo, mais a
// dificuldade e os ataques que o jogo acrescentou depois do M8 (3 fases, onda de choque, chamado
// das medusinhas e farol). Trios [fase 1, fase 2, fase 3].
//
// Os números originais do protótipo (2 fases) estão congelados em tests/sim/protoJelly.ts, e os
// testes de paridade rodam com eles: o código dos ataques antigos continua idêntico ao do
// protótipo, e só os números mudaram.

export const JELLY = {
  name: "ÁGUA-VIVA COLOSSAL",
  rageLabel: "INCANDESCENTE",
  hp: 460,
  radius: 42,
  collRadius: 25,
  /** Teto de velocidade da fase 1 (a do protótipo). As fases seguintes usam `speedByPhase`. */
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
  /** Teto de velocidade por fase, px/s: ela se mexe mais rápido conforme enfurece. */
  speedByPhase: [80, 110, 130],
  /**
   * Da fase 2 em diante ela NÃO paira mais sobre o jogador (o que a deixava colada no alto da
   * tela): vagueia numa elipse em volta do centro do mapa, como o Olho, e é o jogador quem dá a
   * volta nela. Recua se ele cola. `follow` puxa o centro da elipse para o jogador (0 = o centro
   * do mapa, 1 = ele), para ela continuar ao alcance. `enabled` existe para os testes de paridade
   * com o protótipo, que a voltam a pairar.
   */
  roam: {
    enabled: 1,
    keepDist: 230,
    retreatDist: 150,
    driftR: 330,
    driftYScale: 0.75,
    /** rad/s por fase (a fase 1 não vagueia). */
    driftRate: [0, 0.32, 0.42],
    follow: 0.3,
    /** O alvo nunca fica mais perto que isto das bordas do mapa. */
    edgeMargin: 110,
  },

  /** Respiração do sino, rad/s por fase (só visual). */
  pulseRate: [2.2, 3.6, 5.0],

  /** A fase `n` começa quando a fração de vida fica abaixo de `phaseBelow[n]`. */
  phaseBelow: [1, 0.65, 0.3],
  thinkMs: [700, 470, 260],
  phaseChangeThinkMs: 300,
  rerollRepeatChance: 0.6,

  ring: {
    telegraphMs: [600, 430, 370],
    count: [15, 20, 24],
    waves: [1, 3, 4],
    waveGapMs: 180,
    /** Cada onda sai girada, abrindo brechas diferentes. */
    waveTwist: 0.22,
    speed: 200,
    damage: [11, 12, 13],
    lifeMs: 4200,
    r: 6,
    /** Os esporos saem da borda do sino. */
    spawnRadiusScale: 0.7,
    color: "#8affe0",
  },
  beam: {
    telegraphMs: [680, 510, 440],
    sweepMs: [1100, 1400, 1500],
    /**
     * Regra 3: a velocidade tangencial do raio na distância de flutuação é ω · 215 px.
     * 0,9 · 215 = 194, 1,0 · 215 = 215 e 1,1 · 215 = 237 px/s, todos abaixo de 250 (o nado).
     * Acima de ~1,16 rad/s o raio fica impossível de superar nadando. O teste de config confere
     * a conta.
     */
    sweepSpeed: [0.9, 1.0, 1.1],
    length: 640,
    halfWidth: 11,
    damage: [16, 16, 18],
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
    telegraphMs: [520, 480, 440],
    durationMs: 1100,
    force: 640,
    radius: 330,
    stingerEveryMs: [150, 130, 105],
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

  /**
   * Onda de choque: um anel que se expande a partir dela. Tem uma FRESTA, marcada no aviso. Passa-se
   * pela fresta, atravessa-se no dash (a invulnerabilidade) ou some-se atrás de uma coluna de
   * coral (a rocha para o anel, como para o raio).
   */
  shock: {
    telegraphMs: [760, 640, 540],
    /** Expansão, px/s. Chega ao jogador (a ~215 px) em ~0,65 s. */
    speed: 270,
    /** Passa bem do jogador (215 px) e some: um anel que dura mais só deixa a luta parada. */
    maxRadius: 470,
    /** Espessura do anel. */
    band: 16,
    /** Meia abertura da fresta, rad: 71°, 63° e 57° de abertura. */
    gapHalf: [0.62, 0.55, 0.5],
    /**
     * A borda da fresta fica a esta distância angular do jogador (sorteada entre as duas), então ele
     * nunca começa dentro dela e sempre tem que se mexer. Com 215 px de raio, 0,75 rad são ~160 px:
     * alcançável em 0,65 s, e o aviso (820 ms) mais os 0,7 s até o anel chegar dão bem mais.
     */
    gapMinPast: 0.25,
    gapMaxPast: 0.75,
    damage: [14, 15, 16],
    color: "#9ff4ff",
  },

  /**
   * Chamado das medusinhas: ela solta crias ao redor (GDD §6.2). Não soltam cura e somem quando ela
   * morre. Os pontos aparecem marcados durante o aviso.
   */
  call: {
    telegraphMs: [850, 750, 650],
    /** Quantas crias por chamado, e o teto de crias vivas ao mesmo tempo. */
    count: [2, 2, 3],
    maxAlive: 4,
    /** Distância da borda do sino até onde a cria nasce. */
    ringGap: 55,
    /** Duas crias nunca nascem mais perto que isto uma da outra. */
    minSeparation: 48,
  },

  /**
   * Farol (só na fase 3): 3 raios a 120° que giram juntos. Cada raio varre `sweepRad`, então entre
   * os raios sobram cunhas seguras que se movem com eles. O aviso desenha as cunhas que serão varridas.
   * Regra 3: 0,8 · 215 = 172 px/s, abaixo de 250.
   */
  lighthouse: {
    telegraphMs: 850,
    arms: 3,
    sweepRad: 1.1,
    sweepSpeed: 0.8,
    length: 620,
    halfWidth: 9,
    innerGap: 48,
    growSpeed: 820,
    armDelayMs: 130,
    damage: 16,
    rayStep: 8,
  },

  /**
   * Combos (como a investida dupla do Caranguejo): ao acabar, o ataque pode emendar um anel de
   * esporos com um aviso curto, sem a pausa de pensar. Chance por fase [1, 2, 3]. Cada ataque do
   * combo ainda avisa (regra 2), só que por menos tempo.
   */
  chain: {
    /** Aviso do anel emendado, ms. */
    telegraphMs: 320,
    afterShock: [0, 0.45, 0.55],
    afterCall: [0, 0.4, 0.6],
    afterLighthouse: [0, 0, 0.45],
  },
} as const;
