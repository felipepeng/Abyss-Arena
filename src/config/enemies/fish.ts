// Peixe: perseguidor com investida (CONTEXTO §5.1, GDD §6.1). Números do protótipo.

export const FISH = {
  radius: 11,
  collScale: 0.85,
  hp: 34,
  /** Teto de velocidade fora da investida. */
  speed: 118,
  accel: 900,
  drag: 3.0,
  /** Só persegue o jogador dentro deste raio. */
  sightR: 300,
  /**
   * Fora do raio de visão ele avança em direção ao jogador a esta velocidade, em vez de ficar
   * parado até o jogador chegar perto (o protótipo ficava). Só acelera enquanto estiver mais
   * lento que isto; o arrasto cuida do resto, então não há tranco ao sair da investida.
   */
  farSpeed: 40,
  /** Perto disto (e com o cronômetro zerado) começa o aviso da investida. */
  chargeRange: 200,
  /**
   * Serpenteio: um termo perpendicular `sen(wob) · wobbleAccel`, com `wob` crescendo a
   * `wobbleRate` rad/s. É o detalhe que faz ele parecer um peixe e não um míssil.
   */
  wobbleRate: 6,
  wobbleAccel: 600,
  /** Interpolação angular por passo, da direção atual para a da velocidade (só visual). */
  turnLerp: 0.25,

  /** Aviso: freia e trava a direção até o último passo. */
  telegraphMs: 400,
  telegraphBrake: 4,
  chargeMs: 480,
  chargeSpeed: 430,
  recoverMs: 520,
  recoverBrake: 3,
  /** Depois de se recuperar, espera um sorteio neste intervalo antes de poder investir de novo. */
  rechargeDelayMs: [300, 900],

  /** Dano investindo; encostar fora da investida dói a metade (arredondada para cima). */
  contactDamage: 9,
  dropChance: 0.2,
} as const;
