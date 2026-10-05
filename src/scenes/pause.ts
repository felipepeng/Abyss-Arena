import { FONT_FAMILY, VIEW } from "../config/system";
import { Menu } from "../ui/menu";
import type { App } from "./app";
import { AudioScene } from "./audio";
import type { GameScene } from "./game";
import type { Scene } from "./manager";
import { goToTitle, retry } from "./navigation";

// Pausa (GDD §11): sobreposta ao jogo, que não recebe passo enquanto ela está por cima.
// Continuar, tentar a fase de novo, áudio e sair para o menu.

export class PauseScene implements Scene {
  readonly overlay = true;
  private readonly menu: Menu;

  constructor(
    private readonly app: App,
    game: GameScene,
  ) {
    const { scenes } = app;
    this.menu = new Menu(
      [
        {
          kind: "button",
          label: "Continuar",
          onSelect: () => {
            app.audio.ui("resume");
            scenes.pop();
          },
        },
        { kind: "button", label: "Tentar a fase de novo", onSelect: () => retry(app, game.gameParams) },
        { kind: "button", label: "Áudio", onSelect: () => scenes.push(new AudioScene(app, true)) },
        { kind: "button", label: "Sair para o menu", onSelect: () => goToTitle(app) },
      ],
      220,
      app.audio,
    );
  }

  enter(): void {
    this.app.audio.ui("pause");
  }

  step(): void {
    const { input, scenes } = this.app;
    if (input.wasPressed("pause") || input.wasPressed("menuBack")) {
      this.app.audio.ui("resume");
      scenes.pop();
      return;
    }
    this.menu.step(input);
  }

  render(g: CanvasRenderingContext2D): void {
    const { width: W, height: H } = VIEW;
    g.fillStyle = "rgba(2, 5, 11, 0.62)";
    g.fillRect(0, 0, W, H);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#cfe6ff";
    g.font = `bold 32px ${FONT_FAMILY}`;
    g.fillText("PAUSA", W / 2, 160);
    this.menu.render(g);
    g.textAlign = "left";
  }
}
