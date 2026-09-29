import { LIGHT_COLUMNS, type Palette } from "../config/palette";
import { VIEW } from "../config/system";

// Fundo em espaço de tela: gradiente em cache (desenhado uma vez por paleta) e colunas de
// luz por cima, deslizando com parallax barato.

export class Background {
  private readonly cache: OffscreenCanvas;

  constructor(private readonly palette: Palette) {
    this.cache = new OffscreenCanvas(VIEW.width, VIEW.height);
    const g = this.cache.getContext("2d");
    if (!g) throw new Error("OffscreenCanvas 2D indisponível");
    const grad = g.createLinearGradient(0, 0, 0, VIEW.height);
    grad.addColorStop(0, palette.bg[0]);
    grad.addColorStop(0.45, palette.bg[1]);
    grad.addColorStop(1, palette.bg[2]);
    g.fillStyle = grad;
    g.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  draw(g: CanvasRenderingContext2D, camX: number): void {
    g.drawImage(this.cache, 0, 0);
    const light = this.palette.light;
    if (!light) return;
    const { width: W, height: H } = VIEW;
    const { count, topHalfWidth: top, bottomHalfWidth: bottom, parallax } = LIGHT_COLUMNS;
    const gap = W / count;
    g.globalAlpha = light.alpha;
    g.fillStyle = light.color;
    for (let i = 0; i < count; i++) {
      const x = (i + 0.5) * gap - ((camX * parallax) % gap);
      g.beginPath();
      g.moveTo(x - top, 0);
      g.lineTo(x + top, 0);
      g.lineTo(x + bottom, H);
      g.lineTo(x - bottom, H);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}
