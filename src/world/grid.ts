// Grade de blocos: 1 byte por bloco. Fora da grade conta como rocha protegida, então a
// borda do mundo é sólida sem caso especial.

export const Cell = {
  Water: 0,
  Rock: 1,
  /** Rocha que a erosão nunca destrói (borda e blocos estruturais). */
  Protected: 2,
  /** Sólido, com visual próprio (Jardim de Corais). */
  Coral: 3,
  /**
   * Parede que um chefe quebra no meio da luta para abrir a arena (a Água-viva, na fase 2). Sólida
   * como a rocha, mas a erosão dos projéteis não a toca: só o chefe a quebra.
   */
  Barrier: 4,
} as const;
export type Cell = (typeof Cell)[keyof typeof Cell];

export class Grid {
  readonly cells: Uint8Array;
  /**
   * Cresce a cada mudança. O render guarda a última versão que desenhou e refaz o cache
   * quando ela muda; assim o render não precisa escrever em estado da simulação.
   */
  version = 0;

  constructor(
    readonly cols: number,
    readonly rows: number,
    readonly tile: number,
  ) {
    this.cells = new Uint8Array(cols * rows);
  }

  get width(): number {
    return this.cols * this.tile;
  }

  get height(): number {
    return this.rows * this.tile;
  }

  inBounds(cx: number, cy: number): boolean {
    return cx >= 0 && cy >= 0 && cx < this.cols && cy < this.rows;
  }

  get(cx: number, cy: number): Cell {
    return this.inBounds(cx, cy) ? (this.cells[cy * this.cols + cx] as Cell) : Cell.Protected;
  }

  set(cx: number, cy: number, value: Cell): void {
    if (!this.inBounds(cx, cy)) return;
    const i = cy * this.cols + cx;
    if (this.cells[i] === value) return;
    this.cells[i] = value;
    this.version++;
  }

  /** Preenche o retângulo de blocos [cx0, cx1] × [cy0, cy1], extremos incluídos. */
  fill(cx0: number, cy0: number, cx1: number, cy1: number, value: Cell): void {
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.set(cx, cy, value);
  }

  isSolid(cx: number, cy: number): boolean {
    return this.get(cx, cy) !== Cell.Water;
  }

  isSolidAt(px: number, py: number): boolean {
    return this.isSolid(Math.floor(px / this.tile), Math.floor(py / this.tile));
  }

  /**
   * O retângulo aberto (x0, x1) × (y0, y1), em px, toca algum bloco sólido? Encostar
   * exatamente na face de um bloco não conta.
   */
  overlapsSolid(x0: number, y0: number, x1: number, y1: number): boolean {
    const t = this.tile;
    const cx1 = Math.ceil(x1 / t) - 1;
    const cy1 = Math.ceil(y1 / t) - 1;
    for (let cy = Math.floor(y0 / t); cy <= cy1; cy++) {
      for (let cx = Math.floor(x0 / t); cx <= cx1; cx++) if (this.isSolid(cx, cy)) return true;
    }
    return false;
  }
}
