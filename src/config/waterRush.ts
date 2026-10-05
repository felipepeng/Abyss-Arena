import type { SfxDef } from "./sfx";

// O som da água da cena de descida (GDD §10.1): o mergulhador se movendo por ela. Sem música e
// sem o ambiente do mapa; só ruído filtrado cujo corte e volume acompanham a velocidade dele
// (`level`, de 0 a 1), um rumor grave e bolhas que ficam mais frequentes quando ele acelera.
// Tudo é dado; o motor (`audio/waterRush.ts`) é genérico.

export interface WaterRushDef {
  /** Ganho geral no barramento de efeitos. */
  gain: number;
  fadeInS: number;
  /** Constante de tempo com que o corte e o ganho seguem o `level` (`setTargetAtTime`). */
  smoothS: number;
  /** O sopro da água passando: ruído com filtro passa-baixa. Cada par é [parado, velocidade máxima]. */
  swish: { q: number; freqHz: readonly [number, number]; gain: readonly [number, number]; lfoHz: number; lfoDepthHz: number };
  /** O rumor grave da massa de água. */
  rumble: { freqHz: number; q: number; gain: readonly [number, number] };
  /** Bolhas: o intervalo entre elas vai do [parado] ao [velocidade máxima], s. */
  bubbleEveryS: readonly [readonly [number, number], readonly [number, number]];
  bubbles: readonly SfxDef[];
}

const bubble = (from: number, to: number, gain: number, durMs: number): SfxDef => ({
  layers: [{ kind: "osc", wave: "sine", freq: [from, to], gain, durMs, attackMs: 3 }],
});

export const WATER_RUSH: WaterRushDef = {
  gain: 0.6,
  fadeInS: 0.5,
  smoothS: 0.18,
  swish: { q: 0.6, freqHz: [380, 2600], gain: [0.1, 0.5], lfoHz: 0.45, lfoDepthHz: 90 },
  rumble: { freqHz: 140, q: 0.7, gain: [0.08, 0.34] },
  bubbleEveryS: [[0.5, 1.5], [0.1, 0.4]],
  bubbles: [bubble(320, 900, 0.07, 90), bubble(460, 1250, 0.06, 70), bubble(260, 700, 0.07, 110), bubble(700, 1700, 0.045, 55)],
};
