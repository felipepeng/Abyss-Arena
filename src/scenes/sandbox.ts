import { BINDINGS, type Action } from "../config/input";
import { FONT_FAMILY, VIEW } from "../config/system";
import type { Input } from "../core/input";
import { len } from "../core/math";
import type { Scene, SceneManager } from "./manager";

// Cena provisória do M0: mostra cada ação e se ela está ativa, a posição do mouse e a
// direção do nado. `Esc`/`P` empilha uma pausa de teste para exercitar o fade e a
// sobreposição. Sai quando a cena de jogo real existir (M1).

/** Quanto tempo a linha fica acesa depois de um toque, para toques curtos serem visíveis. */
const PRESS_FLASH_MS = 250;

const KEY_LABELS: Record<string, string> = {
  ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
  Space: "Espaço", ShiftLeft: "Shift", ShiftRight: "Shift dir.", Escape: "Esc",
  NumpadEnter: "Enter num.",
};

const keyLabel = (code: string): string =>
  KEY_LABELS[code] ?? (code.startsWith("Key") ? code.slice(3) : code);

function bindingLabel(action: Action): string {
  const labels = BINDINGS.keys[action].map(keyLabel);
  if (BINDINGS.mouseButtons[action]?.includes(0)) labels.unshift("clique");
  return labels.join(" · ");
}

export class SandboxScene implements Scene {
  private readonly flash = new Map<Action, number>();
  private moveX = 0;
  private moveY = 0;

  constructor(
    private readonly input: Input<Action>,
    private readonly scenes: SceneManager,
  ) {}

  step(dtMs: number): void {
    const input = this.input;
    for (const action of input.actions) {
      if (input.wasPressed(action)) this.flash.set(action, PRESS_FLASH_MS);
      else this.flash.set(action, Math.max((this.flash.get(action) ?? 0) - dtMs, 0));
    }

    let x = 0;
    let y = 0;
    if (input.isDown("moveLeft")) x -= 1;
    if (input.isDown("moveRight")) x += 1;
    if (input.isDown("moveUp")) y -= 1;
    if (input.isDown("moveDown")) y += 1;
    const l = len(x, y);
    this.moveX = l > 0 ? x / l : 0;
    this.moveY = l > 0 ? y / l : 0;

    if (input.wasPressed("pause")) this.scenes.push(new PauseTestScene(input, this.scenes));
  }

  render(g: CanvasRenderingContext2D): void {
    const { width: W, height: H } = VIEW;
    // gradiente de fundo do protótipo (CONTEXTO §2.1)
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#123a63");
    bg.addColorStop(0.45, "#0a2444");
    bg.addColorStop(1, "#04101f");
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    g.textBaseline = "middle";
    g.fillStyle = "#cfe6ff";
    g.font = `bold 20px ${FONT_FAMILY}`;
    g.fillText("ABYSS ARENA · M0", 32, 36);
    g.font = `12px ${FONT_FAMILY}`;
    g.fillStyle = "#7fa6c8";
    g.fillText("Teste de entrada. F1 liga o overlay; Esc/P testa a pausa e o fade.", 32, 60);

    const rowH = 22;
    const top = 92;
    this.input.actions.forEach((action, i) => {
      const y = top + i * rowH;
      const held = this.input.isDown(action);
      const flash = (this.flash.get(action) ?? 0) / PRESS_FLASH_MS;
      if (held || flash > 0) {
        g.globalAlpha = held ? 0.9 : flash * 0.6;
        g.fillStyle = "#2f7fd0";
        g.fillRect(28, y - rowH / 2 + 1, 470, rowH - 2);
        g.globalAlpha = 1;
      }
      g.fillStyle = held ? "#ffe9a8" : "#cfe6ff";
      g.font = `13px ${FONT_FAMILY}`;
      g.fillText(action, 40, y);
      g.fillStyle = held ? "#ffe9a8" : "#7fa6c8";
      g.fillText(bindingLabel(action), 220, y);
    });

    // direção do nado
    const cx = 720;
    const cy = 200;
    g.strokeStyle = "#35587a";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(cx, cy, 60, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = "#ffe9a8";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + this.moveX * 60, cy + this.moveY * 60);
    g.stroke();
    g.fillStyle = "#7fa6c8";
    g.font = `12px ${FONT_FAMILY}`;
    g.textAlign = "center";
    g.fillText("nado", cx, cy + 80);
    const mouseText = this.input.hasMouse
      ? `mouse ${this.input.mouseX.toFixed(0)}, ${this.input.mouseY.toFixed(0)}`
      : "mouse: mexa sobre o canvas";
    g.fillText(mouseText, cx, cy + 100);
    g.textAlign = "left";

    // mira no cursor, em coordenadas do canvas interno
    if (this.input.hasMouse) {
      const mx = this.input.mouseX;
      const my = this.input.mouseY;
      g.strokeStyle = this.input.isDown("attack") ? "#fff3c4" : "#cdd8e2";
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(mx, my, 8, 0, Math.PI * 2);
      g.moveTo(mx - 14, my);
      g.lineTo(mx - 4, my);
      g.moveTo(mx + 4, my);
      g.lineTo(mx + 14, my);
      g.moveTo(mx, my - 14);
      g.lineTo(mx, my - 4);
      g.moveTo(mx, my + 4);
      g.lineTo(mx, my + 14);
      g.stroke();
    }
  }
}

class PauseTestScene implements Scene {
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
    g.fillStyle = "#cfe6ff";
    g.font = `bold 28px ${FONT_FAMILY}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("PAUSA (teste)", W / 2, H / 2 - 12);
    g.font = `13px ${FONT_FAMILY}`;
    g.fillStyle = "#7fa6c8";
    g.fillText("A cena de baixo não recebe passo. Esc/P volta.", W / 2, H / 2 + 22);
    g.textAlign = "left";
  }
}
