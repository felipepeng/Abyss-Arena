// Bolhas e tremor de tela (CONTEXTO §2.5 e §2.6). Os cinco efeitos de impacto disparam
// juntos e só no acerto: hit-stop, empurrão, recuo, tremor e bolhas.

export const BUBBLES = {
  maxAlive: 800,
  /** Vida base, multiplicada por um sorteio em `lifeJitter`. */
  lifeMs: 720,
  lifeJitter: [0.6, 1.3],
  radius: [1.5, 4.5],
  /** Velocidade inicial = `speed` do evento × sorteio em `speedJitter`. */
  speedJitter: [0.25, 1],
  /** Empurrão inicial para cima, somado à direção sorteada. */
  riseBias: 40,
  /** Aceleração para cima (bolhas sobem), px/s². */
  buoyancy: 120,
  dragX: 2.2,
  dragY: 1.4,
} as const;

export interface BubbleBurst {
  count: number;
  color: string;
  /** Espalhamento da posição inicial, ±px. */
  spread: number;
  speed: number;
}

export const FX = {
  spearHit: {
    bubbles: { count: 10, color: "#dff3ff", spread: 6, speed: 190 },
    shake: { ms: 140, amp: 4 },
  },
  dash: { bubbles: { count: 10, color: "#cfeaff", spread: 6, speed: 140 } },
  thrust: {
    bubbles: { count: 6, color: "#e6f6ff", spread: 4, speed: 120 },
    /** As bolhas saem à frente do jogador, na direção da estocada. */
    offset: 16,
  },
  enemyDied: {
    bubbles: { count: 18, color: "#9fe0ff", spread: 0, speed: 260 },
    /** O espalhamento da morte é proporcional ao raio da criatura. */
    spreadScale: 0.6,
  },
  playerHurt: {
    bubbles: { count: 14, color: "#ff9aa6", spread: 8, speed: 220 },
    shake: { ms: 180, amp: 5 },
  },
  playerDied: { shake: { ms: 500, amp: 8 } },
  /** O peixe começando a investida. */
  fishCharge: { bubbles: { count: 8, color: "#ffd48a", spread: 5, speed: 160 } },
  /** Bolhas na cor do projétil. */
  projectilePopped: { count: 5, spread: 4, speed: 150 },
  projectileBurst: { count: 4, spread: 3, speed: 90 },
  projectileHit: { count: 6, spread: 4, speed: 140 },
  rockEroded: { bubbles: { count: 3, color: "#7f9e94", spread: 7, speed: 120 } },
  /**
   * Bloqueio da blindagem do Ermitão (GDD §9.1): a fagulha (bolhas claras e rápidas) mais 4
   * bolhas. Sem tremor: não é um acerto (regra 6).
   */
  spearBlocked: {
    spark: { count: 6, color: "#fff4cf", spread: 2, speed: 320 },
    bubbles: { count: 4, color: "#ffe9a8", spread: 4, speed: 130 },
  },
  /** GDD §9.1. */
  pickup: { bubbles: { count: 8, color: "#7dffb0", spread: 6, speed: 120 } },
  /** Redemoinho no ponto onde um inimigo vai nascer (GDD §9.1). */
  spawnWarn: { bubbles: { count: 12, color: "#cfeaff", spread: 10, speed: 60 } },
  /** Chefe: entrada, fase nova e morte. */
  bossAppeared: { shake: { ms: 260, amp: 6 } },
  bossDied: {
    bubbles: { count: 18, color: "#ffd2b0", spread: 0, speed: 260 },
    spreadScale: 0.6,
    shake: { ms: 420, amp: 9 },
  },
  /** Caranguejo (CONTEXTO §6.1). */
  crab: {
    phase2: { bubbles: { count: 26, color: "#ffb27a", spread: 24, speed: 300 }, shake: { ms: 400, amp: 8 } },
    dash: { bubbles: { count: 18, color: "#ffd9b0", spread: 20, speed: 240 }, shake: { ms: 160, amp: 4 } },
    /** A investida bateu numa formação. */
    impact: { shake: { ms: 220, amp: 6 } },
    /** O espalhamento das bolhas da pinça é proporcional ao raio do golpe. */
    pinch: { bubbles: { count: 24, color: "#ffc9a0", spread: 0, speed: 320 }, spreadScale: 0.5, shake: { ms: 220, amp: 7 } },
    call: { bubbles: { count: 22, color: "#a8ffd8", spread: 22, speed: 280 } },
  },
  /** Água-viva (CONTEXTO §6.2). */
  jelly: {
    phase2: { bubbles: { count: 30, color: "#b9fff0", spread: 30, speed: 320 }, shake: { ms: 380, amp: 7 } },
    /** Cada onda do anel; o espalhamento é proporcional ao raio do sino. */
    ring: { bubbles: { count: 12, color: "#8affe0", spread: 0, speed: 180 }, spreadScale: 0.5, shake: { ms: 110, amp: 3 } },
    beam: { shake: { ms: 160, amp: 4 } },
    pullStream: { bubbles: { count: 1, color: "#a8e6ff", spread: 8, speed: 40 } },
  },
  /** Olho (CONTEXTO §6.3). */
  eye: {
    phase: { bubbles: { count: 36, color: "#ffc2f0", spread: 32, speed: 340 }, shake: { ms: 480, amp: 9 } },
    fan: { shake: { ms: 90, amp: 2 } },
    siege: { bubbles: { count: 14, color: "#ff9ad8", spread: 30, speed: 200 }, shake: { ms: 180, amp: 4 } },
    seek: { bubbles: { count: 16, color: "#c8a0ff", spread: 24, speed: 220 } },
  },
  /** Bloco de pilar dissolvendo. */
  pillarCrumble: { bubbles: { count: 1, color: "#7f9e94", spread: 7, speed: 130 } },
} as const;
