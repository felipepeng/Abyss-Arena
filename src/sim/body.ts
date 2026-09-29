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

export function makeBody(x: number, y: number, radius: number, collR: number): Body {
  return { x, y, vx: 0, vy: 0, prevX: x, prevY: y, radius, collR, blockedX: false, blockedY: false };
}

export function savePrev(b: Body): void {
  b.prevX = b.x;
  b.prevY = b.y;
}
