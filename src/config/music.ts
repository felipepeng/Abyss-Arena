// Trilhas procedurais (GDD §10.2): uma por mapa e uma do menu. Cada trilha é uma escala, um
// andamento e progressões; o sequenciador (`audio/sequencer.ts`) faz o resto. Três camadas de
// intensidade se somam sem corte: ondas (0) → chefe (1) → última fase do chefe (2).
//
//   0  pads graves + pulso lento
//   1  + percussão (bumbo e chimbal)
//   2  + arpejo denso e percussão mais cheia

export type MusicLevel = 0 | 1 | 2;
export type TrackId = "menu" | "rift" | "coral" | "abyss";

export interface MusicParams {
  bpm: number;
  /** Fundamental da escala, Hz. */
  rootHz: number;
  /** Semitons acima da fundamental. Define o caráter: consonante no Leito, dissonante no Fosso. */
  scale: readonly number[];
  /** Um acorde por compasso, em graus da escala (passar do fim sobe uma oitava). */
  chords: readonly (readonly number[])[];
  /** Grau do baixo em cada tempo do compasso (4 tempos); null é pausa. */
  pulse: readonly (number | null)[];
  /** Onda do pad e o quanto o filtro o abafa (Hz). */
  padWave: "sine" | "triangle" | "sawtooth";
  padCutoffHz: number;
  /** Chance de cada semicolcheia soar no arpejo do nível 2. */
  arpChance: number;
  /** O arpejo usa a onda e a oitava (acima do pad). */
  arpWave: "sine" | "triangle" | "square";
  arpOctaves: readonly number[];
  seed: number;
}

/** Ganho de cada camada por nível de intensidade, e a rapidez com que ele muda (sem corte). */
export const MUSIC_LAYERS = {
  gains: {
    //                  pad   pulso  percussão  arpejo
    0: { pad: 1.0, pulse: 0.9, perc: 0.0, arp: 0.0 },
    1: { pad: 1.0, pulse: 1.0, perc: 0.9, arp: 0.0 },
    2: { pad: 1.0, pulse: 1.0, perc: 1.0, arp: 0.9 },
  },
  /** Constante de tempo da mudança de camada, s: ~2 s para assentar. */
  rampS: 0.7,
  /** Notas são geradas com esta antecedência, s. */
  lookAheadS: 0.5,
  /** Intervalo do agendador, ms. */
  tickMs: 80,
  /**
   * Passos (de 16 por compasso, semicolcheias) em que a percussão soa em cada nível. O nível 1
   * marca só o pulso; o 2 enche o compasso.
   */
  patterns: {
    kick: { 1: [0, 8], 2: [0, 6, 8, 14] },
    hat: { 1: [2, 6, 10, 14], 2: [0, 2, 4, 6, 8, 10, 12, 14] },
  },
  /** Ganho geral da música dentro do barramento dela. */
  bus: 0.35,
  /** Pad: volume por nota, desafinação do par de osciladores (cents) e ataque/soltura (fração do compasso). */
  pad: { noteGain: 0.16, detuneCents: 7, attack: 0.35, release: 0.4 },
  pulse: { gain: 0.32, wave: "sine" as const, decay: 0.85 },
  kick: { hz: [120, 45] as const, gain: 0.7, durS: 0.2 },
  hat: { gain: 0.16, durS: 0.05, highpassHz: 6500 },
  arp: { gain: 0.11, decayS: 0.28 },
} as const;

export const MUSIC: Readonly<Record<TrackId, MusicParams>> = {
  // menu: calma, uma pentatônica maior com um acorde que balança devagar
  menu: {
    bpm: 58,
    rootHz: 110,
    scale: [0, 2, 4, 7, 9],
    chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [2, 4, 6]],
    pulse: [0, null, 2, null],
    padWave: "triangle",
    padCutoffHz: 1100,
    arpChance: 0.3,
    arpWave: "sine",
    arpOctaves: [2],
    seed: 11,
  },
  // Leito das Fendas: o mais consonante (dórico), grave e firme
  rift: {
    bpm: 72,
    rootHz: 98,
    scale: [0, 2, 3, 5, 7, 9, 10],
    chords: [[0, 2, 4], [3, 5, 7], [0, 2, 4], [4, 6, 8]],
    pulse: [0, null, 4, null],
    padWave: "sawtooth",
    padCutoffHz: 620,
    arpChance: 0.4,
    arpWave: "triangle",
    arpOctaves: [1, 2],
    seed: 22,
  },
  // Jardim de Corais: lídio, mais aberto e brilhante, com arpejos que cintilam
  coral: {
    bpm: 84,
    rootHz: 110,
    scale: [0, 2, 4, 6, 7, 9, 11],
    chords: [[0, 2, 4], [1, 3, 5], [3, 5, 7], [1, 3, 5]],
    pulse: [0, 4, null, 4],
    padWave: "triangle",
    padCutoffHz: 1500,
    arpChance: 0.55,
    arpWave: "sine",
    arpOctaves: [1, 2, 3],
    seed: 33,
  },
  // Fosso do Abismo: lócrio, cheio de segundas menores e trítono. O mais dissonante
  abyss: {
    bpm: 66,
    rootHz: 82.4,
    scale: [0, 1, 3, 5, 6, 8, 10],
    chords: [[0, 1, 4], [0, 4, 6], [1, 3, 4], [0, 3, 4]],
    pulse: [0, 1, null, 4],
    padWave: "sawtooth",
    padCutoffHz: 480,
    arpChance: 0.5,
    arpWave: "square",
    arpOctaves: [1, 2],
    seed: 44,
  },
};
