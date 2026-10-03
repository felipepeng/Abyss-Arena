// Navegação dos inimigos (sim/nav.ts). Sem ela, todo perseguidor anda em linha reta e fica
// encostado no primeiro pilar de coral ou de rocha que o jogador deixa no meio do caminho.

export const NAV = {
  /**
   * Distância mínima da rocha, em blocos, para um bloco servir de caminho. 1 bloco (20 px) cobre o
   * maior corpo de inimigo (raio de colisão ~12 px) com folga, e os corredores do coral (80 px)
   * ainda deixam 2 blocos livres no meio.
   */
  clearanceCells: 1,
  /** Quantos blocos do caminho se olha à frente atrás do ponto mais longe que ainda se vê. */
  lookAheadCells: 10,
  /** Folga, em px, somada ao raio de colisão do corpo ao testar se o caminho está livre. */
  bodyMarginPx: 2,
  /** Passo da amostragem do caminho livre. Menor que meio bloco, como a linha de visão. */
  stepPx: 6,
  /** Ao jogador estar colado na rocha: raio, em blocos, onde se procuram blocos abertos para partir. */
  seedRadiusCells: 3,
} as const;
