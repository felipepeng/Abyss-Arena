// Bolha de cura (GDD §5, 🟡 proposta: os valores são chutes a medir no M8).

export const HEAL = {
  amount: 12,
  lifeMs: 8000,
  /** Pisca nos últimos ms de vida, para avisar que vai sumir. */
  blinkLastMs: 2000,
  blinkPeriodMs: 160,
  /** A menos disto do jogador, é puxada para ele. */
  attractR: 70,
  attractSpeed: 300,
  /** Coletada quando o centro chega a esta distância do jogador. */
  collectR: 14,
  radius: 6,
  /** Sobe devagar, como uma bolha, oscilando para os lados. */
  riseSpeed: 15,
  wobbleRate: 3,
  wobbleSpeed: 12,
  maxAlive: 64,
} as const;
