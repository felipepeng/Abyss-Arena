// Corpo físico comum a todas as criaturas.

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Posição no passo anterior, para o render interpolar. */
  prevX: number;
  prevY: number;
  /** Raio visual (e da hitbox da lança). */
  radius: number;
  /** Meia largura da caixa de colisão com a grade. Menor que o visual nos corpos grandes. */
  collR: number;
  /** Bateu na rocha neste passo, em cada eixo. */
  blockedX: boolean;
  blockedY: boolean;
}

/**
 * Valor inicial dos campos numéricos que mudam a cada passo, em objetos que vivem muitos
 * passos (criaturas, slots de pool). Os campos são sempre reescritos antes do primeiro uso.
 *
 * Por que NaN e não 0: um campo que nasce com um inteiro pequeno (0) e depois recebe frações
 * fica, no V8, com representação genérica, e aí CADA número gravado nele ganha uma caixa nova
 * no heap. Nascendo com um double (NaN é um), o campo já é de ponto flutuante e a gravação é
 * feita no lugar. Medido no Chrome com o profiler de heap: era a maior parte da alocação por
 * passo da simulação (savePrev, clampSpeed, applyDrag, moveBody...).
 */
export const UNSET = NaN;

export function makeBody(x: number, y: number, radius: number, collR: number): Body {
  return { x, y, vx: 0, vy: 0, prevX: x, prevY: y, radius, collR, blockedX: false, blockedY: false };
}

/** Reposiciona um corpo reaproveitado, parado, sem criar objeto. */
export function resetBody(b: Body, x: number, y: number, radius: number, collR: number): void {
  b.x = b.prevX = x;
  b.y = b.prevY = y;
  b.vx = 0;
  b.vy = 0;
  b.radius = radius;
  b.collR = collR;
  b.blockedX = false;
  b.blockedY = false;
}

export function savePrev(b: Body): void {
  b.prevX = b.x;
  b.prevY = b.y;
}
