import type { Action } from "../config/input";
import { FONT_FAMILY, VIEW } from "../config/system";
import type { Input } from "../core/input";
import type { Scene, SceneManager } from "./manager";

// Pausa mínima: sobreposta ao jogo, que não recebe passo enquanto ela está por cima.
// As opções (tentar de novo, áudio, sair) chegam no M6.

export class PauseScene implements Scene {
  readonly overlay = true;

  constructor(
    private readonly input: Input<Action>,
    private readonly scenes: SceneManager,
  ) {}

  step(): void {
    if (this.input.wasPressed("pause")) this.scenes.pop();
  }

  render(g: CanvasRenderingContext2D): void {
    const { width: W, height: H } = VIEW;
    g.fillStyle = "rgba(2, 5, 11, 0.6)";
    g.fillRect(0, 0, W, H);
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#cfe6ff";
    g.font = `bold 28px ${FONT_FAMILY}`;
    g.fillText("PAUSA", W / 2, H / 2 - 12);
    g.font = `13px ${FONT_FAMILY}`;
    g.fillStyle = "#7fa6c8";
    g.fillText("Esc ou P para continuar", W / 2, H / 2 + 22);
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
  }
}
