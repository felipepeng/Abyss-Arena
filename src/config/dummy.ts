// Sacos de pancada da arena de teste (M1). Existem só para sentir o impacto da lança.
//
// Cada um imita a física de uma criatura do protótipo: o empurrão da lança é somado à
// velocidade e, no mesmo passo, cortado pelo teto de velocidade da criatura (o peixe em
// perseguição tem teto de 118 px/s). É por isso que o empurrão de 430 px/s nunca aparece
// inteiro. Sem esse teto, o impacto no saco pareceria diferente do impacto num peixe.

export interface DummySpec {
  radius: number;
  collRadius: number;
  hp: number;
  /** Teto de velocidade, px/s. */
  maxSpeed: number;
  drag: number;
}

export const DUMMY = {
  /** Aceleração que o traz de volta ao ponto de origem depois de empurrado. */
  returnAccel: 240,
  /** Perto disto do ponto de origem ele não se corrige mais (evita tremer no lugar). */
  returnDeadZone: 3,
  respawnMs: 1200,
  kinds: {
    /** Peixe (CONTEXTO §5.1): recebe o empurrão cheio. */
    fish: { radius: 11, collRadius: 11 * 0.85, hp: 34, maxSpeed: 118, drag: 3.0 },
    /** Caranguejo (CONTEXTO §6.1): r 38 recebe 32% do empurrão. */
    crab: { radius: 38, collRadius: 23, hp: 420, maxSpeed: 90, drag: 2.6 },
  } satisfies Record<string, DummySpec>,
} as const;

export type DummyKind = keyof typeof DUMMY.kinds;
