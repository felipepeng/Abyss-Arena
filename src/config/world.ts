// Grade de colisão.

export const WORLD = {
  /** Lado do bloco da grade, em px. */
  tile: 20,
  /**
   * Folga com que a colisão deixa o corpo encostado na face do bloco. Sem ela, o corpo
   * pararia exatamente na face e o arredondamento o colocaria dentro da rocha.
   */
  skin: 0.01,
  /** Busca do ponto livre mais próximo quando um corpo aparece dentro da rocha (fallback). */
  unstick: { ringStep: 10, maxRadius: 200, directions: 16, keepSpeed: 0.2 },
} as const;
