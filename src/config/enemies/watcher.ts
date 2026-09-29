// Vigia: olho menor com pedúnculo, atira em leque de longe e precisa ver o jogador
// (GDD §6.2). Ensina os padrões de leque do Olho.

export const WATCHER = {
  radius: 12,
  collScale: 0.85,
  hp: 36,
  speed: 95,
  accel: 520,
  drag: 2.8,
  /** Mantém esta distância; recua com mais força se o jogador chegar mais perto que a faixa. */
  keepDist: 320,
  keepBand: 50,
  retreatBoost: 1.4,
  /** Desliza em volta do jogador quando não o vê (fração da aceleração). */
  strafeAccel: 0.3,
  sightR: 520,
  /** Interpolação angular por passo do olhar (só visual). */
  turnLerp: 0.2,

  telegraphMs: 500,
  telegraphBrake: 5,
  /** Leque: `shots` tiros, `fanStep` rad entre eles. O aviso mostra um setor de 0,6 rad. */
  shots: 3,
  fanStep: 0.3,
  shotSpeed: 200,
  shotDamage: 9,
  shotLifeMs: 4000,
  shotRadius: 4,
  shotColor: "#ff8a6a",
  cooldownMs: [1800, 2600],

  contactDamage: 5,
  dropChance: 0.35,
} as const;
