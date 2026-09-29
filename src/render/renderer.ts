import type { Palette } from "../config/palette";
import { VIEW } from "../config/system";
import { lerp } from "../core/math";
import type { Fx } from "../fx/fx";
import type { World } from "../sim/world";
import { Background } from "./background";
import { drawDummy } from "./creatures/dummy";
import { drawPlayer } from "./creatures/player";
import { drawBubbles } from "./particles";
import { RockLayer } from "./rocks";

// Orquestra as camadas do mundo. Só lê o estado; nunca escreve na simulação.
// Ordem: fundo → rocha → bolhas → criaturas → jogador (lança por baixo do corpo). As bolhas
// ficam sob as criaturas, como no protótipo: as do acerto nascem atrás do alvo.
// O HUD é desenhado fora daqui, sem tremor.

export class WorldRenderer {
  private readonly background: Background;
  private readonly rocks: RockLayer;

  constructor(palette: Palette) {
    this.background = new Background(palette);
    this.rocks = new RockLayer(palette);
  }

  draw(g: CanvasRenderingContext2D, w: World, fx: Fx, alpha: number): void {
    const camX = lerp(w.camera.prevX, w.camera.x, alpha);
    const camY = lerp(w.camera.prevY, w.camera.y, alpha);

    this.background.draw(g, camX);

    g.save();
    g.translate(fx.shake.offsetX() - camX, fx.shake.offsetY() - camY);
    this.rocks.draw(g, w.grid, camX, camY, VIEW.width, VIEW.height);
    drawBubbles(g, fx.bubbles, alpha);
    for (const d of w.dummies) drawDummy(g, d, alpha);
    drawPlayer(g, w.player, alpha);
    g.restore();
  }
}
