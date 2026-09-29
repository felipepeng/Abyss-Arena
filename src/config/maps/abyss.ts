import type { Palette } from "../palette";

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
 * Ondas (GDD §3.2). O GDD pede também vigias e lampreias, que entram no M5. Até lá, as ondas
 * têm só peixes e circuladores.
 */
export const ABYSS_WAVES = [
  { enemies: [{ kind: "fish", count: 4 }] },
  { enemies: [{ kind: "circler", count: 3 }] },
  { enemies: [{ kind: "fish", count: 3 }, { kind: "circler", count: 3 }] },
] as const;
