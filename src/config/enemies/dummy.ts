// Sacos de pancada: alvos de depuração para sentir o impacto da lança. Não atacam, não
// soltam cura e, ao "morrer", voltam cheios ao ponto de origem.
//
// Cada um imita a física de uma criatura do protótipo: o empurrão da lança é somado à
// velocidade e, no mesmo passo, cortado pelo teto de velocidade da criatura (o peixe tem
// teto de 118 px/s). É por isso que o empurrão de 430 px/s nunca aparece inteiro.

export const DUMMY = {
  /** Aceleração que o traz de volta ao ponto de origem depois de empurrado. */
  returnAccel: 240,
  /** Perto disto do ponto de origem ele não se corrige mais (evita tremer no lugar). */
  returnDeadZone: 3,
  /** Com a física do peixe (CONTEXTO §5.1): recebe o empurrão cheio. */
  small: { radius: 11, collRadius: 11 * 0.85, hp: 34, speed: 118, drag: 3.0 },
  /** Com a física do caranguejo (CONTEXTO §6.1): r 38 recebe 32% do empurrão. */
  big: { radius: 38, collRadius: 23, hp: 420, speed: 90, drag: 2.6 },
} as const;
