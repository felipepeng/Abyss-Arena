import { FONT_FAMILY, VIEW } from "../config/system";
import { formatSeed } from "../core/rng";

// Overlay de depuração (F1 ou `?debug` na URL). No M0 mostra FPS e a semente; hitboxes,
// estados e contagem dos pools entram junto com os sistemas que os têm (ARCHITECTURE §10.1).
// A semente fica visível para que um bug de mapa possa ser reproduzido com `?seed=`.

export class DebugOverlay {
  enabled: boolean;
  private fps = 0;
  private sampleAcc = 0;
  private sampleFrames = 0;

  constructor(
    private readonly sampleMs: number,
    enabled: boolean,
  ) {
    this.enabled = enabled;
  }

  toggle(): void {
    this.enabled = !this.enabled;
  }

  /** Conta o frame em tempo real, mesmo desligado, para o número já estar pronto ao ligar. */
  frame(elapsedMs: number): void {
    this.sampleAcc += elapsedMs;
    this.sampleFrames++;
    if (this.sampleAcc >= this.sampleMs) {
      this.fps = (this.sampleFrames * 1000) / this.sampleAcc;
      this.sampleAcc = 0;
      this.sampleFrames = 0;
    }
  }

  render(g: CanvasRenderingContext2D, seed: number, extra: readonly string[] = []): void {
    if (!this.enabled) return;
    const lines = [`FPS ${this.fps.toFixed(0)}`, `semente ${formatSeed(seed)}`, ...extra];
    const lineH = 15;
    // em coordenadas lógicas: a escala do frame (Display) já está aplicada
    g.save();
    g.font = `12px ${FONT_FAMILY}`;
    g.textBaseline = "top";
    let w = 0;
    for (const line of lines) w = Math.max(w, g.measureText(line).width);
    const x = VIEW.width - w - 16;
    g.fillStyle = "rgba(0, 0, 0, 0.55)";
    g.fillRect(x - 6, 6, w + 12, lines.length * lineH + 8);
    g.fillStyle = "#9dffb0";
    lines.forEach((line, i) => g.fillText(line, x, 10 + i * lineH));
    g.restore();
  }
}
