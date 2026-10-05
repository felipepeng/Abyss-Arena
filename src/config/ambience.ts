import type { TrackId } from "./music";
import type { SfxDef } from "./sfx";

// Ambiente sonoro de cada mapa (GDD §10.2): o som da água do lugar, por baixo da música. Três
// partes: uma cama contínua (ruído filtrado cujo corte oscila devagar), um zumbido grave
// opcional e sons esporádicos, que sorteiam o próximo instante entre dois limites. Os esporádicos
// são `SfxDef` comuns, tocados pelo mesmo renderizador dos efeitos. O menu não tem ambiente.

export interface AmbienceBed {
  type: "lowpass" | "bandpass";
  freqHz: number;
  q: number;
  gain: number;
  /** O corte oscila `lfoDepthHz` para cada lado, `lfoHz` vezes por segundo: a água "respira". */
  lfoHz: number;
  lfoDepthHz: number;
}

export interface AmbienceDrone {
  wave: "sine" | "triangle" | "sawtooth";
  /** Um oscilador por frequência; duas muito próximas batem devagar (e incomodam de propósito). */
  hz: readonly number[];
  cutoffHz: number;
  gain: number;
}

export interface AmbienceEvent {
  sfx: SfxDef;
  /** O próximo disparo cai a um tempo sorteado entre os dois valores, s. */
  everyS: readonly [number, number];
}

export interface AmbienceDef {
  /** Ganho geral dentro do barramento de efeitos. */
  gain: number;
  bed: AmbienceBed;
  drone?: AmbienceDrone;
  events: readonly AmbienceEvent[];
}

/** Intervalo com que o ambiente confere se algum som esporádico venceu, ms. */
export const AMBIENCE_TICK_MS = 250;

// Um sino do Jardim: o tom e um parcial inarmônico mais agudo, que some antes
const bell = (hz: number): SfxDef => ({
  layers: [
    { kind: "osc", wave: "sine", freq: [hz, hz], gain: 0.07, durMs: 1500, attackMs: 3 },
    { kind: "osc", wave: "sine", freq: [hz * 2.76, hz * 2.76], gain: 0.025, durMs: 700, attackMs: 3 },
  ],
});

export const AMBIENCE: Readonly<Partial<Record<TrackId, AmbienceDef>>> = {
  // Leito das Fendas: um rumor de pedra e correnteza, uma rocha que range, bolhas soltas
  rift: {
    gain: 0.3,
    bed: { type: "lowpass", freqHz: 300, q: 0.7, gain: 0.5, lfoHz: 0.07, lfoDepthHz: 100 },
    events: [
      {
        everyS: [9, 20],
        sfx: {
          layers: [
            { kind: "osc", wave: "sawtooth", freq: [88, 70], gain: 0.09, durMs: 1200, attackMs: 400, filter: { type: "lowpass", freq: [260, 180] } },
            { kind: "noise", gain: 0.1, durMs: 900, attackMs: 300, filter: { type: "bandpass", freq: [420, 300], q: 7 } },
          ],
        },
      },
      {
        everyS: [4, 10],
        sfx: {
          layers: [
            { kind: "osc", wave: "sine", freq: [520, 980], gain: 0.07, durMs: 70 },
            { kind: "osc", wave: "sine", freq: [560, 1040], gain: 0.07, durMs: 70, delayMs: 110 },
            { kind: "osc", wave: "sine", freq: [480, 900], gain: 0.06, durMs: 70, delayMs: 200 },
          ],
        },
      },
      {
        everyS: [6, 14],
        sfx: { layers: [{ kind: "noise", gain: 0.06, durMs: 40, attackMs: 2, filter: { type: "bandpass", freq: [1500, 800], q: 2 } }] },
      },
    ],
  },

  // Jardim de Corais: água clara e cintilante, com sinos nas notas do Lá lídio da música
  coral: {
    gain: 0.3,
    bed: { type: "bandpass", freqHz: 650, q: 0.5, gain: 0.25, lfoHz: 0.11, lfoDepthHz: 250 },
    events: [
      { everyS: [7, 16], sfx: bell(880) },
      { everyS: [8, 18], sfx: bell(1109) },
      { everyS: [9, 20], sfx: bell(1318) },
      {
        everyS: [4, 9],
        sfx: {
          layers: [
            { kind: "osc", wave: "sine", freq: [900, 1500], gain: 0.05, durMs: 60 },
            { kind: "osc", wave: "sine", freq: [1000, 1700], gain: 0.05, durMs: 60, delayMs: 90 },
          ],
        },
      },
    ],
  },

  // Fosso do Abismo: um zumbido grave que bate (mi e fá), um chamado distante, um brilho de olho
  abyss: {
    gain: 0.3,
    bed: { type: "lowpass", freqHz: 150, q: 0.8, gain: 0.6, lfoHz: 0.05, lfoDepthHz: 55 },
    drone: { wave: "sawtooth", hz: [82.4, 87.3], cutoffHz: 170, gain: 0.07 },
    events: [
      {
        everyS: [16, 32],
        sfx: { layers: [{ kind: "osc", wave: "sine", freq: [160, 100], gain: 0.09, durMs: 2600, attackMs: 1100, filter: { type: "lowpass", freq: [500, 250] } }] },
      },
      {
        everyS: [18, 34],
        sfx: { layers: [{ kind: "osc", wave: "sine", freq: [210, 150], gain: 0.08, durMs: 2200, attackMs: 900, filter: { type: "lowpass", freq: [500, 250] } }] },
      },
      {
        everyS: [10, 22],
        sfx: { layers: [{ kind: "osc", wave: "sine", freq: [1900, 1900], gain: 0.03, durMs: 120, attackMs: 3 }] },
      },
    ],
  },
};
