// Trilhas procedurais (GDD §10.2): uma por mapa e uma do menu. Cada trilha é uma escala, um
// andamento, uma progressão de 8 compassos e as linhas escritas à mão (tema, baixo, bateria); o
// sequenciador (`audio/sequencer.ts`) toca tudo isso na grade de semicolcheias. Três camadas de
// intensidade se somam sem corte: ondas (0) → chefe (1) → última fase do chefe (2).
//
//   0  ondas: pad grave + pulso lento + o tema, suave e abafado
//   1  chefe nasce: + baixo em movimento, bateria, o tema do chefe (mais rápido e brilhante)
//   2  última fase do chefe: + o tema dobrado na oitava, arpejo, bateria cheia
//
// Notação das linhas: um texto por compasso, com notas separadas por espaço no formato
// `passo:grau/duração`. O passo vai de 0 a 15 (semicolcheias), o grau é o da escala da trilha
// (passar do fim sobe uma oitava; negativo desce) e a duração, em passos, é opcional (padrão 2).
// Texto vazio é compasso de pausa. Nas linhas de baixo o grau é relativo à fundamental do acorde.

export type MusicLevel = 0 | 1 | 2;
export type TrackId = "menu" | "rift" | "coral" | "abyss";

/** Passos (de 16 por compasso) em que cada peça da bateria soa, por nível de intensidade. */
export interface DrumPattern {
  kick: { 1: readonly number[]; 2: readonly number[] };
  snare: { 1: readonly number[]; 2: readonly number[] };
  hat: { 1: readonly number[]; 2: readonly number[] };
}

/** O que entra quando o chefe nasce (nível 1) e o que cresce na última fase dele (nível 2). */
export interface BossSection {
  /** Tema do chefe: um compasso por entrada, em ciclo (mesmo tamanho da progressão). */
  theme: readonly string[];
  /** Baixo do chefe: padrões relativos ao acorde, repetidos em ciclo, um por compasso. */
  bass: readonly string[];
  drums: DrumPattern;
}

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
  /** Tema das ondas: um compasso por entrada, em ciclo. */
  theme: readonly string[];
  /** Voz do tema, e o quanto o filtro a abafa em cada nível (Hz): o chefe abre o brilho. */
  leadWave: "sine" | "triangle" | "sawtooth" | "square";
  leadCutoffHz: readonly [number, number, number];
  /** Chance de cada semicolcheia soar no arpejo do nível 2. */
  arpChance: number;
  /** O arpejo usa a onda e a oitava (acima do pad). */
  arpWave: "sine" | "triangle" | "square";
  arpOctaves: readonly number[];
  /** Voz do baixo e o quanto o filtro o abafa (Hz). */
  bassWave: "triangle" | "sawtooth" | "square";
  bassCutoffHz: number;
  /** Só as trilhas de fase têm chefe; a do menu fica sempre nas ondas. */
  boss?: BossSection;
  seed: number;
}

/** Ganho de cada camada por nível de intensidade, e a rapidez com que ele muda (sem corte). */
export const MUSIC_LAYERS = {
  gains: {
    //                  pad   pulso  baixo  tema  percussão  arpejo
    0: { pad: 1.0, pulse: 0.9, bass: 0.0, lead: 0.55, perc: 0.0, arp: 0.0 },
    1: { pad: 0.85, pulse: 0.3, bass: 1.4, lead: 1.4, perc: 1.3, arp: 0.0 },
    2: { pad: 0.85, pulse: 0.3, bass: 1.6, lead: 1.6, perc: 1.6, arp: 1.1 },
  },
  /**
   * Constante de tempo da mudança de camada, s. Curta o bastante para a música reagir ao
   * nascimento do chefe (a introdução dele dura 1,5 s), longa o bastante para não cortar.
   */
  rampS: 0.4,
  /** Notas são geradas com esta antecedência, s. */
  lookAheadS: 0.5,
  /** Intervalo do agendador, ms. */
  tickMs: 80,
  /** Ganho geral da música dentro do barramento dela. */
  bus: 0.35,
  /** Pad: volume por nota, desafinação do par de osciladores (cents) e ataque/soltura (fração do compasso). */
  pad: { noteGain: 0.16, detuneCents: 7, attack: 0.35, release: 0.4 },
  pulse: { gain: 0.32, wave: "sine" as const, decay: 0.85 },
  /**
   * Tema: oitava (sobre a fundamental), volume por nota, ataque (s), a fração final da nota que
   * é soltura e o Q do filtro. No nível 2 cada nota ganha uma cópia `doubleOct` oitavas acima,
   * com `doubleGain` do volume.
   */
  lead: { octave: 2, gain: 0.13, attackS: 0.02, releaseFrac: 0.35, q: 1.2, doubleOct: 1, doubleGain: 0.5 },
  /** Baixo: oitava, volume, ataque (s) e o filtro que "mastiga" a nota (corte inicial e final, em múltiplos do corte da trilha). */
  bass: { octave: 0, gain: 0.3, attackS: 0.008, filterSweep: [2.2, 1] as const, q: 2 },
  kick: { hz: [120, 45] as const, gain: 0.7, durS: 0.2 },
  snare: { gain: 0.3, durS: 0.14, bandpassHz: 1900, toneHz: [230, 150] as const, toneGain: 0.3 },
  hat: { gain: 0.16, durS: 0.05, highpassHz: 6500 },
  arp: { gain: 0.11, decayS: 0.28 },
} as const;

export const MUSIC: Readonly<Record<TrackId, MusicParams>> = {
  // Menu: calma, uma pentatônica maior; a melodia balança devagar sobre um acorde que respira
  menu: {
    bpm: 58,
    rootHz: 110,
    scale: [0, 2, 4, 7, 9],
    chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [2, 4, 6]],
    pulse: [0, null, 2, null],
    padWave: "triangle",
    padCutoffHz: 1100,
    theme: [
      "0:4/6 8:3/4 12:2/4",
      "0:3/6 8:5/8",
      "0:4/4 4:2/4 8:3/8",
      "0:5/6 8:4/4 12:2/4",
    ],
    leadWave: "sine",
    leadCutoffHz: [1600, 1600, 1600],
    arpChance: 0.3,
    arpWave: "sine",
    arpOctaves: [2],
    bassWave: "triangle",
    bassCutoffHz: 500,
    seed: 11,
  },

  // Leito das Fendas, o Caranguejo. Sol dórico, grave e firme: uma marcha de pedra. Nas ondas
  // o tema desce devagar; com o chefe, a bateria pisa em meio-tempo e o tema vira pergunta e
  // resposta, como pinças que fecham.
  rift: {
    bpm: 72,
    rootHz: 98,
    scale: [0, 2, 3, 5, 7, 9, 10],
    //        Gm      Gm      C       C       Gm      Dm      C       Dm
    chords: [[0, 2, 4], [0, 2, 4], [3, 5, 7], [3, 5, 7], [0, 2, 4], [4, 6, 8], [3, 5, 7], [4, 6, 8]],
    pulse: [0, null, 4, null],
    padWave: "sawtooth",
    padCutoffHz: 620,
    theme: [
      "0:4/6 8:2/3 12:4/4",
      "0:5/4 6:4/2 8:2/8",
      "0:3/6 8:5/3 12:4/4",
      "0:3/8 10:2/6",
      "0:4/4 6:6/2 8:4/4 12:2/4",
      "0:4/6 8:6/3 12:5/4",
      "0:3/4 4:5/4 8:7/4 12:5/4",
      "0:6/8 8:4/8",
    ],
    leadWave: "triangle",
    leadCutoffHz: [900, 1900, 2800],
    arpChance: 0.4,
    arpWave: "triangle",
    arpOctaves: [1, 2],
    bassWave: "sawtooth",
    bassCutoffHz: 420,
    boss: {
      theme: [
        "0:4/3 3:4/1 4:2/2 6:0/2 8:4/3 11:4/1 12:5/2 14:4/2",
        "0:4/3 3:4/1 4:2/2 6:0/2 8:2/4 12:4/4",
        "0:5/3 3:5/1 4:3/2 6:3/2 8:5/3 11:5/1 12:7/2 14:5/2",
        "0:5/3 3:5/1 4:3/2 6:3/2 8:2/4 12:3/4",
        "0:4/2 2:6/2 4:4/2 6:2/2 8:4/2 10:6/2 12:7/4",
        "0:6/3 3:6/1 4:4/2 6:4/2 8:6/3 11:6/1 12:8/2 14:6/2",
        "0:7/2 2:5/2 4:3/2 6:5/2 8:7/2 10:9/2 12:7/4",
        "0:8/3 3:6/1 4:4/4 8:6/2 10:4/2 12:5/2 14:6/2",
      ],
      // oitavas e quintas em colcheias: o chão que treme a cada passo do Caranguejo
      bass: [
        "0:0/3 3:0/1 4:0/2 6:0/2 8:0/3 11:0/1 12:0/2 14:2/2",
        "0:0/3 3:0/1 4:0/2 6:4/2 8:0/3 11:0/1 12:2/2 14:0/2",
      ],
      drums: {
        kick: { 1: [0, 8, 11], 2: [0, 3, 6, 8, 10, 14] },
        snare: { 1: [8], 2: [4, 12] },
        hat: { 1: [2, 6, 10, 14], 2: [0, 2, 4, 6, 8, 10, 12, 14] },
      },
    },
    seed: 22,
  },

  // Jardim de Corais, a Água-viva. Lá lídio, aberto e brilhante. Nas ondas, sinos que flutuam;
  // com o chefe, as notas caem em grupos de três (3+3+3+3+4) e a bateria pulsa como a própria
  // água-viva se contraindo.
  coral: {
    bpm: 84,
    rootHz: 110,
    scale: [0, 2, 4, 6, 7, 9, 11],
    //        A       B       A       E       F#m     B       C#m     B
    chords: [[0, 2, 4], [1, 3, 5], [0, 2, 4], [4, 6, 8], [5, 7, 9], [1, 3, 5], [2, 4, 6], [1, 3, 5]],
    pulse: [0, 4, null, 4],
    padWave: "triangle",
    padCutoffHz: 1500,
    theme: [
      "0:4/4 4:2/2 6:4/2 8:6/6",
      "0:5/4 4:3/2 6:5/2 8:8/6",
      "0:4/4 4:6/2 6:4/2 8:2/6",
      "0:6/4 4:4/2 6:6/2 8:8/6",
      "0:5/4 4:7/2 6:5/2 8:9/6",
      "0:5/3 3:3/3 6:1/2 8:3/4 12:5/4",
      "0:4/4 4:6/2 6:8/2 8:6/4 12:4/4",
      "0:5/4 4:3/4 8:1/8",
    ],
    leadWave: "sine",
    leadCutoffHz: [2200, 3600, 5000],
    arpChance: 0.55,
    arpWave: "sine",
    arpOctaves: [1, 2, 3],
    bassWave: "triangle",
    bassCutoffHz: 700,
    boss: {
      theme: [
        "0:4/2 3:6/2 6:4/2 8:7/2 11:6/2 14:4/2",
        "0:5/2 3:7/2 6:5/2 8:8/2 11:7/2 14:5/2",
        "0:4/2 3:6/2 6:9/2 8:7/2 11:6/2 14:4/2",
        "0:6/2 3:8/2 6:6/2 8:11/2 11:8/2 14:6/2",
        "0:5/2 3:7/2 6:9/2 8:7/2 11:5/2 14:7/2",
        "0:5/2 3:8/2 6:10/2 8:8/2 11:5/2 14:3/2",
        "0:4/2 3:6/2 6:9/2 8:6/2 11:4/2 14:2/2",
        "0:5/2 3:8/2 6:10/2 8:12/4 12:10/2 14:8/2",
      ],
      // síncope em 3+3+3+3+4: o baixo contrai e solta
      bass: [
        "0:0/2 3:0/2 6:0/2 9:4/2 12:0/3",
        "0:0/2 3:0/2 6:2/2 9:0/2 12:4/3",
      ],
      drums: {
        kick: { 1: [0, 6, 10], 2: [0, 3, 6, 10, 12] },
        snare: { 1: [8], 2: [4, 12, 15] },
        hat: { 1: [3, 7, 11, 15], 2: [0, 2, 3, 6, 7, 8, 10, 11, 14, 15] },
      },
    },
    seed: 33,
  },

  // Fosso do Abismo, o Olho. Mi lócrio, cheio de segundas menores e trítono: o mais dissonante.
  // Nas ondas, linhas que rastejam; com o chefe, a bateria vira um coração (tum-tum) e o tema
  // vira estocadas agudas fora do tempo, como o olho que pisca e procura.
  abyss: {
    bpm: 66,
    rootHz: 82.4,
    scale: [0, 1, 3, 5, 6, 8, 10],
    //        Em/F/Bb E/Bb/D  F/A/Bb  E/A/Bb  Em/F/Bb F/A/Bb  E/Bb/D  F/Bb/D
    chords: [[0, 1, 4], [0, 4, 6], [1, 3, 4], [0, 3, 4], [0, 1, 4], [1, 3, 4], [0, 4, 6], [1, 4, 6]],
    pulse: [0, 1, null, 4],
    padWave: "sawtooth",
    padCutoffHz: 480,
    theme: [
      "0:0/8 8:1/6",
      "2:4/6 8:6/4 12:4/4",
      "0:3/6 8:4/8",
      "0:1/4 4:0/4 8:3/8",
      "0:0/8 8:4/8",
      "4:3/4 8:1/4 12:3/4",
      "0:6/6 8:4/4 12:1/4",
      "0:4/8 8:0/8",
    ],
    leadWave: "triangle",
    leadCutoffHz: [700, 1600, 2600],
    arpChance: 0.5,
    arpWave: "square",
    arpOctaves: [1, 2],
    bassWave: "square",
    bassCutoffHz: 380,
    boss: {
      theme: [
        "0:7/2 2:8/1 3:7/1 4:4/2 8:7/2 10:8/1 11:7/1 12:4/4",
        "0:7/2 2:10/2 4:8/2 6:7/2 8:4/4 12:6/4",
        "0:8/2 2:10/2 4:11/2 6:10/2 8:8/4 12:11/4",
        "0:7/2 3:10/2 6:11/2 8:10/2 11:8/2 14:7/2",
        "0:7/2 2:8/1 3:7/1 4:4/2 8:7/2 10:8/1 11:7/1 12:11/2 14:4/2",
        "0:8/3 3:8/1 4:10/2 6:11/2 8:8/3 11:8/1 12:10/2 14:11/2",
        "0:7/2 2:11/2 4:13/2 6:11/2 8:10/4 12:7/4",
        "0:11/4 4:13/4 8:11/2 10:10/2 12:8/2 14:7/2",
      ],
      // semínimas que se arrastam e uma segunda menor que volta a cada compasso
      bass: [
        "0:0/2 2:0/2 4:0/2 6:1/2 8:0/2 10:0/2 12:0/2 14:1/2",
        "0:0/2 2:0/2 4:1/2 6:0/2 8:0/2 10:1/2 12:0/2 14:0/2",
      ],
      drums: {
        kick: { 1: [0, 3, 8, 11], 2: [0, 3, 6, 8, 11, 14] },
        snare: { 1: [12], 2: [4, 12] },
        hat: { 1: [6, 14], 2: [0, 2, 4, 6, 8, 10, 12, 14, 15] },
      },
    },
    seed: 44,
  },
};
