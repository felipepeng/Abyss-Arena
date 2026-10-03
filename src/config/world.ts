// Grade de colisão.

/** Parede quebrável (`Cell.Barrier`): o ritmo do estilhaçar e as bolhas que sobem dos blocos. */
export const ARENA_BREAK = {
  /**
   * Blocos por segundo, do mais perto do chefe ao mais longe: uma onda de destruição. A parede do
   * Coral tem 296 blocos, então 210 por segundo dão ~1,4 s.
   */
  cellsPerSec: 210,
  /** Chance de cada bloco solto subir uma bolha (visual, sorteada na simulação). */
  bubbleChance: 0.5,
} as const;

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
