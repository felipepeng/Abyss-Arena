import { FONT_FAMILY, VIEW } from "../config/system";
import { Ambient } from "../render/ambient";
import { Menu } from "../ui/menu";
import type { App } from "./app";
import { AudioScene } from "./audio";
import { ControlsScene } from "./controls";
import type { Scene } from "./manager";
import { goToArenaSelect, startDescent } from "./navigation";

// Título (GDD §11): nome do jogo sobre o fundo animado com bolhas, e as quatro opções.

export class TitleScene implements Scene {
  private readonly menu: Menu;
  private readonly ambient = new Ambient(["#14465c", "#0a2436", "#03080f"]);
  private timeMs = 0;

  constructor(private readonly app: App) {
    const { scenes } = app;
    this.menu = new Menu(
      [
        { kind: "button", label: "Descida", hint: "Leito → Coral → Fosso, em sequência", onSelect: () => startDescent(app) },
        { kind: "button", label: "Arena livre", hint: "Escolha qualquer mapa", onSelect: () => goToArenaSelect(app) },
        { kind: "button", label: "Controles", onSelect: () => scenes.push(new ControlsScene(app)) },
        { kind: "button", label: "Áudio", onSelect: () => scenes.push(new AudioScene(app, false)) },
      ],
      196,
    );
  }

  step(dtMs: number): void {
    this.timeMs += dtMs;
    this.ambient.step(dtMs);
    this.menu.step(this.app.input);
  }

  render(g: CanvasRenderingContext2D): void {
    const { width: W, height: H } = VIEW;
    this.ambient.draw(g);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    // o título respira devagar, como tudo aqui embaixo
    const glow = 0.55 + 0.25 * Math.sin(this.timeMs / 900);
    g.save();
    g.shadowColor = `rgba(120, 220, 255, ${glow})`;
    g.shadowBlur = 24;
    g.fillStyle = "#eaf8ff";
    g.font = `bold 62px ${FONT_FAMILY}`;
    g.fillText("ABYSS ARENA", W / 2, 100);
    g.restore();
    g.font = `italic 15px ${FONT_FAMILY}`;
    g.fillStyle = "#a9d0e8";
    g.fillText("Um mergulhador. Uma lança. O abismo.", W / 2, 134);
    this.menu.render(g);
    g.font = `12px ${FONT_FAMILY}`;
    g.fillStyle = "rgba(160,200,225,0.6)";
    g.fillText("W S ou setas navegam · Enter, Espaço ou clique confirmam", W / 2, H - 18);
    g.textAlign = "left";
  }
}
