import { WORLD } from "../config/world";
import type { EnemyKind } from "../sim/enemies/types";
import { Cell, Grid } from "./grid";

// Arena de teste (M1–M2): borda e alguns blocos, maior que a tela para exercitar a câmera.
// Não usa `MapDef` (que chega no M3). Tem de propósito uma parede de 1 bloco de espessura,
// para ver que o dash não atravessa, e um corredor para sentir o deslize na parede.

export interface TestArena {
  grid: Grid;
  playerStart: { x: number; y: number };
  /** Criaturas presentes desde o início (sacos de pancada). */
  enemies: { kind: EnemyKind; x: number; y: number }[];
  /** Liga o nascimento provisório por tempo. */
  spawner: boolean;
}

// Tudo em blocos de 20 px. 72 × 40 blocos = 1440 × 800 px.
const COLS = 72;
const ROWS = 40;
const BORDER = 2;

/** Blocos sólidos: [cx0, cy0, cx1, cy1], extremos incluídos. */
const BLOCKS: readonly (readonly [number, number, number, number])[] = [
  [14, 8, 17, 11], // bloco solto no alto
  [36, 6, 36, 17], // parede de 1 bloco: o dash não pode atravessar
  [58, 5, 60, 14], // coluna
  [50, 25, 55, 29], // bloco baixo
  [24, 30, 31, 30], // plataforma fina
  [8, 36, 20, 37], // relevo no chão
  [62, 33, 69, 37], // degrau no canto
  [4, 22, 9, 22], // corredor: duas lajes paralelas a 3 blocos uma da outra
  [4, 26, 9, 26],
];

export function buildTestArena(): TestArena {
  const t = WORLD.tile;
  const grid = new Grid(COLS, ROWS, t);
  grid.fill(0, 0, COLS - 1, BORDER - 1, Cell.Protected);
  grid.fill(0, ROWS - BORDER, COLS - 1, ROWS - 1, Cell.Protected);
  grid.fill(0, 0, BORDER - 1, ROWS - 1, Cell.Protected);
  grid.fill(COLS - BORDER, 0, COLS - 1, ROWS - 1, Cell.Protected);
  for (const [x0, y0, x1, y1] of BLOCKS) grid.fill(x0, y0, x1, y1, Cell.Rock);

  return {
    grid,
    playerStart: { x: 22 * t, y: 20 * t },
    enemies: [
      { kind: "dummy", x: 30 * t, y: 20 * t },
      { kind: "dummyBig", x: 46 * t, y: 21 * t },
    ],
    spawner: true,
  };
}
