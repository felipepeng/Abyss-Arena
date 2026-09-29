// Layout e ritmo dos menus (GDD §11). Só números de interface: nada aqui afeta o combate.

export const MENU = {
  /** Largura de um item, centrado na tela. */
  itemWidth: 380,
  /** Altura de um item com uma linha e com linha de detalhe (a seleção da Arena livre). */
  itemHeight: 38,
  itemHeightWithHint: 54,
  itemGap: 8,
  /** Corpo do rótulo e da linha de detalhe. */
  labelPx: 18,
  hintPx: 12,
  /** Trilho do controle de volume, à direita do rótulo. */
  sliderWidth: 150,
  sliderHeight: 8,
} as const;

/** Tempos das telas de fim de fase. */
export const RESULT = {
  /** Depois de morrer, espera isto (o jogador vê o que o matou) antes de "VOCÊ AFUNDOU". */
  defeatDelayMs: 900,
} as const;

/** Fundo animado do título e das telas de menu. */
export const AMBIENT = {
  bubbles: 46,
  /** Velocidade de subida, px/s. */
  riseSpeed: [14, 46] as const,
  radius: [1.5, 5] as const,
  /** Colunas de luz que se movem devagar. */
  lightColumns: 4,
} as const;
