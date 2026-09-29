// Ouriço: estático, nega área com uma rajada de espinhos em todas as direções (GDD §6.2).
// Ensina a ler zonas.

export const URCHIN = {
  radius: 12,
  collScale: 0.85,
  hp: 30,
  drag: 3.0,
  /** Um ciclo inteiro: descanso + aviso. */
  cycleMs: 2400,
  telegraphMs: 500,
  spikes: 8,
  spikeSpeed: 170,
  /** O espinho some depois de percorrer esta distância (a partir da borda do ouriço). */
  spikeRange: 110,
  /** Folga para o espinho não sumir por tempo antes de por distância: 110 / 170 = 647 ms. */
  spikeLifeMs: 1000,
  spikeDamage: 8,
  spikeRadius: 3,
  spikeColor: "#e8d9a0",

  /** Encostar no ouriço sempre dói isto: ele não tem um "fora do ataque". */
  contactDamage: 8,
  dropChance: 0.25,
} as const;
