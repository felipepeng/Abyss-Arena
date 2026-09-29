// Lança: três fases e estocada carregada (CONTEXTO §4, GDD §4.3).
//
// Carregar dá MENOS DPS (36 / 0,9 s = 40,0/s contra 16 / 0,37 s = 43,2/s) e mais alcance,
// burst e mobilidade. É decisão consciente (GDD §4.3): carregar é abrir ou punir.

export const SPEAR = {
  anticipationMs: 70,
  /** Única fase com hitbox. */
  thrustMs: 120,
  /** Cancelável pelo dash. */
  recoveryMs: 180,

  reach: 52,
  reachChargeBonus: 40,
  /** A carga corre junto com a antecipação: carga cheia sai 600 ms depois do clique, não 670. */
  chargeMaxMs: 600,
  lungeSpeed: 320,
  lungeChargeBonus: 280,
  damage: 16,
  damageChargeBonus: 20,

  /**
   * A hitbox são dois círculos de raio `alvo.raio + tipRadius`: na ponta e `midBack` do
   * alcance atrás dela. Com um ponto só, um inimigo pequeno passava entre dois passos.
   */
  tipRadius: 10,
  midBack: 0.35,

  /** Posição da ponta (fração do alcance) fora do golpe. Só visual e da hitbox do golpe. */
  idleExtend: 0.12,
  anticipationPullback: -0.22,
  recoveryStartExtend: 0.55,

  /** Congela a simulação ao acertar criatura. Estourar projétil não dispara (regra 6). */
  hitStopMs: 60,
  /** Dividido por max(1, raio/knockbackRefRadius): criaturas maiores são empurradas menos. */
  enemyKnockback: 430,
  knockbackRefRadius: 12,
  /** Substitui a velocidade do jogador, só quando acerta. Errar não recua. */
  selfRecoil: 230,
  /** Quanto tempo o alvo acertado fica branco. */
  targetFlashMs: 120,
} as const;
