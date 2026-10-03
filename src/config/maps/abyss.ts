import type { Palette } from "../palette";
import { makeWave, type WaveSpec } from "../waves";

// Fosso do Abismo (GDD §7.3): números de ajuste do mapa. A estrutura desenhada (borda e
// posições dos pilares) está em world/maps/abyss.ts.

export const ABYSS_PALETTE: Palette = {
  bg: ["#1a1030", "#0d0820", "#050310"],
  // não chega luz aqui
  light: null,
  rockBody: "#2a2238",
  rockTop: "#3e3058",
  rockLight: "#6a5a90",
  rockShadow: "rgba(0,0,0,0.22)",
};

export const ABYSS_TITLE = {
  name: "FOSSO DO ABISMO",
  depth: "??? m",
  line: "Ele já te viu.",
} as const;

export const ABYSS_PROCEDURAL = {
  /** Pequena variação na borda de cada pilar; a forma e a posição são fixas. */
  pillarEdgeNoise: 0.15,
};

/**
 * Ondas (GDD §3.2 e §3.3). Os totais por tipo são os do GDD (a onda 3 tem 17 inimigos, §13); o que
 * muda é como chegam: cada onda é uma sequência de levas (config/waves.ts).
 */
export const ABYSS_WAVES: readonly WaveSpec[] = [
  makeWave("OLHARES", [
    { enemies: [{ kind: "fish", count: 2 }, { kind: "watcher", count: 2 }], pattern: "scatter" },
    { enemies: [{ kind: "fish", count: 2 }], pattern: "flank", afterMs: 6500, whenAliveAtMost: 1 },
  ]),
  makeWave("ENXAME", [
    { enemies: [{ kind: "circler", count: 3 }, { kind: "watcher", count: 2 }], pattern: "scatter" },
    { enemies: [{ kind: "lamprey", count: 4 }], pattern: "flank", afterMs: 8000, whenAliveAtMost: 2 },
  ]),
  makeWave("ENXURRADA", [
    { enemies: [{ kind: "fish", count: 3 }, { kind: "watcher", count: 3 }], pattern: "scatter" },
    { enemies: [{ kind: "circler", count: 3 }, { kind: "lamprey", count: 4 }], pattern: "pincer", afterMs: 9000, whenAliveAtMost: 3 },
    { enemies: [{ kind: "lamprey", count: 4 }], pattern: "ring", afterMs: 9000, whenAliveAtMost: 3 },
  ]),
];

