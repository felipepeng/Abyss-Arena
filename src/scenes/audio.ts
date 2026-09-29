import { FONT_FAMILY, VIEW } from "../config/system";
import { Ambient } from "../render/ambient";
import { Menu } from "../ui/menu";
import type { App } from "./app";
import type { Scene } from "./manager";

// Volume de música e de efeitos (GDD §10.3), separados. Aberta do título e da pausa. Sem
// salvar na v1: vale até fechar o jogo. O motor de áudio (M7) lê os valores de `Settings`.

export class AudioScene implements Scene {
  readonly overlay: boolean;
  private readonly menu: Menu;
  private readonly ambient: Ambient | null;

  /** `overlay`: aberta da pausa, por cima do jogo; senão, do título, com o fundo animado. */
  constructor(
    private readonly app: App,
    overlay: boolean,
  ) {
    this.overlay = overlay;
    this.ambient = overlay ? null : new Ambient();
    const { settings, scenes } = app;
    this.menu = new Menu(
      [
        { kind: "slider", label: "Música", get: () => settings.musicVolume, set: (v) => settings.setMusicVolume(v) },
        { kind: "slider", label: "Efeitos", get: () => settings.sfxVolume, set: (v) => settings.setSfxVolume(v) },
        { kind: "button", label: "Voltar", onSelect: () => scenes.pop() },
      ],
      220,
    );
  }

  step(dtMs: number): void {
    this.ambient?.step(dtMs);
    if (this.app.input.wasPressed("menuBack")) {
      this.app.scenes.pop();
      return;
    }
    this.menu.step(this.app.input);
  }

  render(g: CanvasRenderingContext2D): void {
    const { width: W, height: H } = VIEW;
    if (this.ambient) this.ambient.draw(g);
    else {
      g.fillStyle = "rgba(2, 5, 11, 0.86)";
      g.fillRect(0, 0, W, H);
    }
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = "#cfe6ff";
    g.font = `bold 32px ${FONT_FAMILY}`;
    g.fillText("ÁUDIO", W / 2, 160);
    this.menu.render(g);
    g.font = `12px ${FONT_FAMILY}`;
    g.fillStyle = "#7fa6c8";
    g.fillText("← → ajustam · as configurações valem até fechar o jogo", W / 2, Math.min(420, H - 30));
    g.textAlign = "left";
  }
}
