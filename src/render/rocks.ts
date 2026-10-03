import type { Palette } from "../config/palette";
import { contextScale } from "../core/display";
import { Cell, type Grid } from "../world/grid";

// Rocha em cache do tamanho do mundo. Só é redesenhada quando a grade muda (erosão, pilar
// dissolvido) ou quando a escala da tela muda; no frame, copia-se apenas a região da câmera.
// O protótipo redesenhava bloco a bloco todo frame.
//
// O cache é feito na escala real da tela (pixels por unidade lógica), senão as bordas dos
// blocos ficariam borradas ao ampliar.

const SHADOW_PX = 3;
/** Margem copiada além da câmera, para o tremor de tela não mostrar a borda do recorte. */
const MARGIN_PX = 16;
/**
 * Teto de área do cache, em pixels. Alguns navegadores (Safari) recusam canvas acima de ~16,7
 * milhões de pixels; com o teto, um mapa grande numa tela 4K fica um pouco menos nítido em vez
 * de falhar.
 */
const MAX_CACHE_PIXELS = 16_000_000;

export class RockLayer {
  private cache: OffscreenCanvas | null = null;
  private cacheScale = 0;
  private drawnVersion = -1;
  /** A grade desenhada: ao reiniciar ou trocar de mapa, a grade nova pode ter a mesma versão. */
  private drawnGrid: Grid | null = null;

  constructor(private readonly palette: Palette) {}

  /** Desenha em coordenadas de mundo a região [camX, camX + w] × [camY, camY + h]. */
  draw(g: CanvasRenderingContext2D, grid: Grid, camX: number, camY: number, w: number, h: number): void {
    const cache = this.update(grid, contextScale(g));
    const s = this.cacheScale;
    const sx = Math.max(0, Math.floor(camX) - MARGIN_PX);
    const sy = Math.max(0, Math.floor(camY) - MARGIN_PX);
    const sw = Math.min(w + 2 * MARGIN_PX, grid.width - sx);
    const sh = Math.min(h + 2 * MARGIN_PX, grid.height - sy);
    if (sw > 0 && sh > 0) g.drawImage(cache, sx * s, sy * s, sw * s, sh * s, sx, sy, sw, sh);
  }

  private update(grid: Grid, screenScale: number): OffscreenCanvas {
    const scale = Math.min(screenScale, Math.sqrt(MAX_CACHE_PIXELS / (grid.width * grid.height)));
    const pw = Math.ceil(grid.width * scale);
    const ph = Math.ceil(grid.height * scale);
    if (!this.cache || this.cache.width !== pw || this.cache.height !== ph) {
      this.cache = new OffscreenCanvas(pw, ph);
      this.drawnVersion = -1;
    }
    this.cacheScale = scale;
    if (this.drawnVersion !== grid.version || this.drawnGrid !== grid) {
      this.redraw(this.cache, grid, scale);
      this.drawnVersion = grid.version;
      this.drawnGrid = grid;
    }
    return this.cache;
  }

  private redraw(cache: OffscreenCanvas, grid: Grid, scale: number): void {
    const g = cache.getContext("2d");
    if (!g) throw new Error("OffscreenCanvas 2D indisponível");
    const p = this.palette;
    const t = grid.tile;
    g.clearRect(0, 0, cache.width, cache.height);
    // Em pixels do cache, com as bordas de cada bloco arredondadas: numa escala fracionária
    // (tela em 125%), blocos vizinhos cairiam em meios-pixels e mostrariam emendas.
    const px = (v: number): number => Math.round(v * scale);
    const shadow = Math.max(1, px(SHADOW_PX));
    for (let cy = 0; cy < grid.rows; cy++) {
      const y0 = px(cy * t);
      const y1 = px((cy + 1) * t);
      for (let cx = 0; cx < grid.cols; cx++) {
        if (!grid.isSolid(cx, cy)) continue;
        const x0 = px(cx * t);
        const x1 = px((cx + 1) * t);
        const exposedTop = !grid.isSolid(cx, cy - 1);
        const barrier = p.barrier && grid.get(cx, cy) === Cell.Barrier ? p.barrier : null;
        g.fillStyle = barrier ? (exposedTop ? barrier.top : barrier.body) : exposedTop ? p.rockTop : p.rockBody;
        g.fillRect(x0, y0, x1 - x0, y1 - y0);
        g.fillStyle = p.rockShadow;
        g.fillRect(x1 - shadow, y0, shadow, y1 - y0);
        g.fillRect(x0, y1 - shadow, x1 - x0, shadow);
        if (exposedTop) {
          g.fillStyle = barrier ? barrier.light : p.rockLight;
          g.fillRect(x0, y0, x1 - x0, shadow);
        }
        if (barrier) {
          // rachaduras: um traço em zigue-zague por bloco, com a posição sorteada pelo próprio
          // bloco (sem aleatório: o cache é redesenhado e não pode piscar)
          const h = (cx * 73856093) ^ (cy * 19349663);
          const ox = x0 + ((h >>> 3) % 5) * ((x1 - x0) / 6) + (x1 - x0) / 6;
          g.strokeStyle = barrier.crack;
          g.globalAlpha = 0.55;
          g.lineWidth = Math.max(1, px(1.2));
          g.beginPath();
          g.moveTo(ox, y0);
          g.lineTo(ox + ((h >>> 7) % 2 ? 1 : -1) * (x1 - x0) * 0.25, y0 + (y1 - y0) * 0.45);
          g.lineTo(ox + ((h >>> 9) % 2 ? 1 : -1) * (x1 - x0) * 0.12, y1);
          g.stroke();
          g.globalAlpha = 1;
        }
      }
    }
  }
}
