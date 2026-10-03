import type { Palette } from "../palette";
import { makeWave, type WaveSpec } from "../waves";

// Leito das Fendas (GDD §7.1, 🟡 proposta): números de ajuste do mapa. A estrutura desenhada
// está em world/maps/rift.ts.

export const RIFT_PALETTE: Palette = {
  bg: ["#2b4a5e", "#183040", "#0a1822"],
  light: { color: "#ffe6b0", alpha: 0.06 },
  rockBody: "#5a4632",
  rockTop: "#7a6040",
  rockLight: "#b89a64",
  rockShadow: "rgba(0,0,0,0.18)",
};

export const RIFT_TITLE = {
  name: "LEITO DAS FENDAS",
  depth: "40 m",
  line: "Algo arrasta as pinças no escuro.",
} as const;

/**
 * Relevo por soma de senos, como a caverna do protótipo (CONTEXTO §2.2), só nas células `~`.
 * O teto cresce da linha 2 para baixo; o chão, da linha 33 para cima, sobre o chão estrutural.
 */
export const RIFT_PROCEDURAL = {
  ceiling: { fromRow: 2, base: 1.6, amp1: 1.1, freq1: 0.19, amp2: 0.6, freq2: 0.43, noise: 0.4 },
  floor: { fromRow: 33, base: 1.4, amp1: 1.3, freq1: 0.24, amp2: 0.8, freq2: 0.61, noise: 0.5 },
  stalactites: { count: 6, length: [2, 4] as const, fromTopChance: 0.5 },
  blobs: { count: [3, 5] as const, rx: [1.2, 2.2] as const, ry: [1.0, 2.0] as const, edgeNoise: 0.18 },
};

/**
 * Ondas (GDD §3.2 e §3.3). Os totais por tipo são os do GDD; o que muda é como chegam: cada onda é
 * uma sequência de levas (config/waves.ts). Os ouriços ocupam posições fixas (RIFT_URCHIN_SPOTS).
 */
export const RIFT_WAVES: readonly WaveSpec[] = [
  makeWave("CARDUME", [
    { enemies: [{ kind: "fish", count: 2 }], pattern: "scatter" },
    { enemies: [{ kind: "fish", count: 2 }], pattern: "flank", afterMs: 6500, whenAliveAtMost: 1 },
  ]),
  makeWave("PINÇA", [
    { enemies: [{ kind: "fish", count: 2 }, { kind: "circler", count: 2 }], pattern: "scatter" },
    { enemies: [{ kind: "fish", count: 1 }, { kind: "hermit", count: 2 }], pattern: "pincer", afterMs: 9000, whenAliveAtMost: 2 },
  ]),
  makeWave("CERCO", [
    { enemies: [{ kind: "fish", count: 3 }, { kind: "urchin", count: 2 }], pattern: "scatter" },
    { enemies: [{ kind: "circler", count: 2 }], pattern: "flank", afterMs: 8000, whenAliveAtMost: 2 },
    { enemies: [{ kind: "hermit", count: 3 }], pattern: "ring", afterMs: 9000, whenAliveAtMost: 2 },
  ]),
];

