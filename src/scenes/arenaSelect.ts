import { FONT_FAMILY, VIEW } from "../config/system";
import { Ambient } from "../render/ambient";
import { BOSS_DEFS } from "../sim/bosses/registry";
import { Menu, type MenuItem } from "../ui/menu";
import { MAP_LIST } from "../world/maps/registry";
import type { App } from "./app";
import type { Scene } from "./manager";
import { goToTitle, startFree } from "./navigation";

// Arena livre (GDD §2.1 e §11): os 3 mapas, todos disponíveis desde o início, cada um com o
// nome do chefe e a profundidade.

export class ArenaSelectScene implements Scene {
  private readonly menu: Menu;
  private readonly ambient = new Ambient();

  constructor(private readonly app: App) {
    const items: MenuItem[] = MAP_LIST.map((map) => ({
      kind: "button" as const,
      label: map.titleCard.name,
      hint: `Chefe: ${BOSS_DEFS[map.boss].name} · ${map.titleCard.depth}`,
      onSelect: () => startFree(app, map),
    }));
    items.push({ kind: "button", label: "Voltar", onSelect: () => goToTitle(app) });
    this.menu = new Menu(items, 190, app.audio);
  }

  enter(): void {
    this.app.audio.playTrack("menu");
  }

  step(dtMs: number): void {
    this.ambient.step(dtMs);
    if (this.app.input.wasPressed("menuBack")) {
      goToTitle(this.app);
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
    g.fillText("ARENA LIVRE", W / 2, 100);
    g.font = `14px ${FONT_FAMILY}`;
    g.fillStyle = "#8fb4d0";
    g.fillText("Escolha um mapa", W / 2, 130);
    this.menu.render(g);
    g.textAlign = "left";
  }
}
