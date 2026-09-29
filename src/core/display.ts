// Resolução de desenho. O jogo pensa num espaço LÓGICO fixo (960 × 540, ver config/system),
// mas a imagem interna do canvas tem o tamanho REAL em que ele aparece na tela, já contando o
// `devicePixelRatio`. Cada frame começa com uma escala lógico → real, então nenhum desenhador
// precisa saber disso.
//
// Por que não desenhar em 960 × 540 e deixar o CSS esticar: isso é técnica de pixel art. Com
// arte vetorial, esticar só borra: o texto, as linhas finas da lança e as bolhas perdem nitidez.

export class Display {
  /** Pixels reais por unidade lógica. */
  scale = 1;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly logicalWidth: number,
    private readonly logicalHeight: number,
  ) {
    this.resize(logicalWidth * devicePixelRatio, logicalHeight * devicePixelRatio);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = entry.contentRect.width * devicePixelRatio;
      const h = entry.contentRect.height * devicePixelRatio;
      // O tamanho em pixels do próprio dispositivo é exato (a conta com devicePixelRatio pode
      // errar por um pixel e borrar tudo levemente), mas só vale quando concorda com a conta:
      // com zoom emulado (Chromium headless) ele informa o tamanho em CSS.
      const device = entry.devicePixelContentBoxSize?.[0];
      if (device && Math.abs(device.inlineSize - w) <= 2 && Math.abs(device.blockSize - h) <= 2) {
        this.resize(device.inlineSize, device.blockSize);
      } else {
        this.resize(w, h);
      }
    });
    try {
      observer.observe(canvas, { box: "device-pixel-content-box" });
    } catch {
      observer.observe(canvas);
    }
  }

  /** Começa um frame: limpa e aplica a escala lógico → real. */
  begin(g: CanvasRenderingContext2D): void {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  }

  private resize(pixelWidth: number, pixelHeight: number): void {
    const w = Math.max(1, Math.round(pixelWidth));
    const h = Math.max(1, Math.round(pixelHeight));
    // mudar o tamanho apaga o canvas, então só quando mudou de fato
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    // o CSS mantém 16:9, então as duas escalas coincidem; a menor evita cortar a borda
    this.scale = Math.min(w / this.logicalWidth, h / this.logicalHeight);
  }
}

/** Escala real atual de um contexto (quantos pixels por unidade lógica). */
export const contextScale = (g: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D): number =>
  g.getTransform().a;
