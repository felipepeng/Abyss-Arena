import { FONT_FAMILY, VIEW } from "../config/system";
import { Ambient } from "../render/ambient";
import { Menu } from "../ui/menu";
import type { App } from "./app";
import type { Scene } from "./manager";

// Tabela de controles (GDD §4.5 e §11).

const ROWS: readonly (readonly [string, string])[] = [
  ["Nadar", "WASD / setas"],
  ["Mirar", "mouse (sem mouse, a mira segue o nado)"],
  ["Estocar (segure para carregar)", "clique esquerdo · J · K · Enter"],
  ["Dash", "Espaço · Shift · L"],
  ["Pausar", "Esc · P"],
  ["Modo de depuração", "F1"],
];

export class ControlsScene implements Scene {
  private readonly menu: Menu;
  private readonly ambient = new Ambient();

  constructor(private readonly app: App) {
    this.menu = new Menu([{ kind: "button", label: "Voltar", onSelect: () => app.scenes.pop() }], 430, app.audio);
  }

  step(dtMs: number): void {
    this.ambient.step(dtMs);
    if (this.app.input.wasPressed("menuBack")) {
      this.app.scenes.pop();
      return;
    }
    this.menu.step(this.app.input);
  }

  render(g: CanvasRenderingContext2D): void {
    const { width: W } = VIEW;
    this.ambient.draw(g);
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#cfe6ff";
    g.font = `bold 32px ${FONT_FAMILY}`;
    g.fillText("CONTROLES", W / 2, 90);

    const left = W / 2 - 300;
    const right = W / 2 + 300;
    ROWS.forEach(([action, keys], i) => {
      const y = 160 + i * 42;
      g.fillStyle = "rgba(4,10,20,0.5)";
      g.fillRect(left - 12, y - 24, right - left + 24, 34);
      g.textAlign = "left";
      g.font = `16px ${FONT_FAMILY}`;
      g.fillStyle = "#dff0ff";
      g.fillText(action, left, y);
      g.textAlign = "right";
      g.fillStyle = "#8fd8ff";
      g.fillText(keys, right, y);
    });
    this.menu.render(g);
    g.textAlign = "left";
  }
}
