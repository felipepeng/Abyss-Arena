// Medusinha: cria da Água-viva, atira de longe e precisa ver o jogador (GDD §6.2). Ensina a
// pressão à distância e o uso do coral como cobertura.

export const JELLYLING = {
  radius: 10,
  collScale: 0.85,
  hp: 28,
  speed: 90,
  accel: 420,
  drag: 2.6,
  /** Distância que tenta manter do jogador, com uma faixa em que não corrige. */
  keepDist: 260,
  keepBand: 40,
  /** Sem linha de visão, ela desliza em volta do jogador (fração da aceleração) até achar um ângulo. */
  strafeAccel: 0.35,
  /** Sobe e desce: aceleração vertical senoidal. */
  bobRate: 1.6,
  bobAccel: 140,
  /** Só atira dentro deste raio (e com linha de visão). */
  sightR: 420,

  telegraphMs: 600,
  telegraphBrake: 4,
  shotSpeed: 150,
  shotDamage: 8,
  shotLifeMs: 3500,
  shotRadius: 4,
  shotColor: "#b8f0ff",
  cooldownMs: [2200, 3000],

  /** Só encostar: ela não ataca em contato. */
  contactDamage: 4,
  dropChance: 0.25,
} as const;
