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
} as const;
