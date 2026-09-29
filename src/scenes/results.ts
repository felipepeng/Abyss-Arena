import { FONT_FAMILY, VIEW } from "../config/system";
import { Ambient } from "../render/ambient";
import { BOSS_DEFS } from "../sim/bosses/registry";
import { Menu, type MenuItem } from "../ui/menu";
import type { App } from "./app";
import { formatTime, nextInDescent, type DescentSession } from "./flow";
import type { GameScene } from "./game";
import type { Scene } from "./manager";
import { continueDescent, goToArenaSelect, goToTitle, retry } from "./navigation";

// Telas de fim (GDD §11): derrota, fase concluída e fim da Descida. Uma cena só, configurada
// por um `ResultSpec`: título, linhas de texto e as opções.

interface ResultSpec {
  title: string;
  titleColor: string;
  lines: readonly string[];
  items: readonly MenuItem[];
  /** `dim` escurece o jogo por baixo (derrota, fase concluída); `ambient` é a tela cheia do final. */
  backdrop: "dim" | "ambient";
}

const LINE_H = 24;

export class ResultScene implements Scene {
  readonly overlay: boolean;
  /** O título da tela (os testes distinguem derrota, fase concluída e final por ele). */
  readonly title: string;
  private readonly menu: Menu;
  private readonly ambient: Ambient | null;

  constructor(
    private readonly app: App,
    private readonly spec: ResultSpec,
  ) {
    this.overlay = spec.backdrop === "dim";
    this.title = spec.title;
    this.ambient = spec.backdrop === "ambient" ? new Ambient() : null;
    this.menu = new Menu(spec.items, 230 + spec.lines.length * LINE_H, app.audio);
  }

  enter(): void {
    // a tela final (sem jogo por baixo) volta à trilha calma; derrota e vitória deixam a do mapa
    if (!this.overlay) this.app.audio.playTrack("menu");
  }

  step(dtMs: number): void {
    this.ambient?.step(dtMs);
    this.menu.step(this.app.input);
  }

  render(g: CanvasRenderingContext2D): void {
    const { width: W, height: H } = VIEW;
    if (this.ambient) this.ambient.draw(g);
    else {
      g.fillStyle = "rgba(2, 5, 11, 0.62)";
      g.fillRect(0, 0, W, H);
    }
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    g.fillStyle = this.spec.titleColor;
    g.font = `bold 40px ${FONT_FAMILY}`;
    g.fillText(this.spec.title, W / 2, 150);
    g.fillStyle = "#cfe0f0";
    g.font = `16px ${FONT_FAMILY}`;
    this.spec.lines.forEach((line, i) => g.fillText(line, W / 2, 200 + i * LINE_H));
    this.menu.render(g);
    g.textAlign = "left";
  }
}

/** "VOCÊ AFUNDOU": tentar de novo (mesma semente) ou voltar ao menu. Devolve false se não deu para empilhar. */
export function showDefeat(game: GameScene): boolean {
  const { app } = game;
  const params = game.gameParams;
  const session = params.flow.kind === "descent" ? params.flow.session : null;
  const lines = session ? [`Mortes na Descida: ${session.deaths + 1}`] : [];
  const pushed = app.scenes.push(
    new ResultScene(app, {
      title: "VOCÊ AFUNDOU",
      titleColor: "#ff8f8f",
      lines,
      backdrop: "dim",
      items: [
        { kind: "button", label: "Tentar de novo", onSelect: () => retry(app, params) },
        { kind: "button", label: "Menu", onSelect: () => goToTitle(app) },
      ],
    }),
  );
  if (pushed && session) session.deaths++;
  return pushed;
}

/** "FASE CONCLUÍDA": na Descida segue para o próximo mapa; na Arena livre volta à seleção. */
export function showCleared(game: GameScene): boolean {
  const { app } = game;
  const params = game.gameParams;
  const map = params.mode.kind === "map" ? params.mode.map : null;
  const lines = map ? [map.titleCard.name, `${BOSS_DEFS[map.boss].name} derrotado`] : [];
  let items: MenuItem[];
  if (params.flow.kind === "descent") {
    const session = params.flow.session;
    const next = map ? nextInDescent(map) : null;
    items = [
      {
        kind: "button",
        label: "Continuar",
        hint: next ? `Próximo: ${next.titleCard.name}` : "O fundo do abismo",
        onSelect: () => continueDescent(app, params, session),
      },
    ];
  } else {
    items = [
      { kind: "button", label: "Voltar à seleção", onSelect: () => goToArenaSelect(app) },
      { kind: "button", label: "Menu", onSelect: () => goToTitle(app) },
    ];
  }
  return app.scenes.push(new ResultScene(app, { title: "FASE CONCLUÍDA", titleColor: "#ffe9a8", lines, items, backdrop: "dim" }));
}

/** Depois do Olho: tempo total e mortes (GDD §2.4). */
export function showFinal(app: App, session: DescentSession): void {
  app.scenes.resetTo(
    new ResultScene(app, {
      title: "FIM DA DESCIDA",
      titleColor: "#9fe6ff",
      lines: [`Tempo total: ${formatTime(session.timeMs)}`, `Mortes: ${session.deaths}`],
      backdrop: "ambient",
      items: [{ kind: "button", label: "Menu", onSelect: () => goToTitle(app) }],
    }),
  );
}
