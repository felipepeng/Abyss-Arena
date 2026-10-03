// Paletas de fundo e rocha. Cada mapa terá a sua (GDD §7); até o M3 só existe a do protótipo,
// usada na arena de teste (CONTEXTO §2.1 e §2.2).

export interface Palette {
  /** Gradiente vertical do fundo, nas paradas 0 / 0,45 / 1. */
  bg: readonly [string, string, string];
  /** Colunas de luz: cor e opacidade; `null` quando não chega luz (Fosso). */
  light: { color: string; alpha: number } | null;
  rockBody: string;
  /** Bloco com o de cima vazio (topo exposto). */
  rockTop: string;
  /** Faixa de 3 px no alto do topo exposto: a "luz" que dá relevo. */
  rockLight: string;
  rockShadow: string;
  /** Paredes quebráveis (`Cell.Barrier`), se o mapa tiver: rachadas, para o jogador ler que cedem. */
  barrier?: { body: string; top: string; light: string; crack: string };
}

export const PROTOTYPE_PALETTE: Palette = {
  bg: ["#123a63", "#0a2444", "#04101f"],
  light: { color: "#9fd8ff", alpha: 0.05 },
  rockBody: "#22333c",
  rockTop: "#3c5a52",
  rockLight: "#587f6f",
  rockShadow: "rgba(0,0,0,0.18)",
};

/** Colunas de luz: quantas, largura no topo e na base, e o parallax em relação à câmera. */
export const LIGHT_COLUMNS = { count: 5, topHalfWidth: 26, bottomHalfWidth: 70, parallax: 0.25 } as const;
