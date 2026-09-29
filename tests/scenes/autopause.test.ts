import { describe, expect, it } from "vitest";
import { SilentAudio } from "../../src/audio/api";
import { BINDINGS } from "../../src/config/input";
import { Input } from "../../src/core/input";
import { Settings } from "../../src/core/settings";
import type { App } from "../../src/scenes/app";
import { pauseIfPlaying } from "../../src/scenes/autopause";
import { GameScene } from "../../src/scenes/game";
import { SceneManager } from "../../src/scenes/manager";
import { PauseScene } from "../../src/scenes/pause";
import { TitleScene } from "../../src/scenes/title";
import { RIFT } from "../../src/world/maps/rift";

// Perder o foco da janela no meio da luta pausa o jogo (M8).

const STEP = 1000 / 60;

function makeApp(): App {
  return {
    input: new Input(BINDINGS),
    scenes: new SceneManager(300, "#000"),
    debug: { enabled: false },
    settings: new Settings(),
    audio: new SilentAudio(),
    nextSeed: () => 1,
  };
}

const tick = (app: App, n = 1): void => {
  for (let i = 0; i < n; i++) {
    app.scenes.step(STEP);
    app.input.endStep();
  }
};

const game = (app: App) => new GameScene(app, { mode: { kind: "map", map: RIFT }, seed: 1, flow: { kind: "free" } });

describe("Input.trigger", () => {
  it("vale como um toque só, até o fim do passo", () => {
    const input = new Input(BINDINGS);
    input.trigger("pause");
    expect(input.wasPressed("pause")).toBe(true);
    expect(input.isDown("pause")).toBe(false);
    input.endStep();
    expect(input.wasPressed("pause")).toBe(false);
  });
});

describe("pausa automática", () => {
  it("durante a fase, perder o foco abre a pausa", () => {
    const app = makeApp();
    app.scenes.start(game(app));
    tick(app, 30);
    expect(pauseIfPlaying(app)).toBe(true);
    tick(app, 1);
    tick(app, 30); // fade
    expect(app.scenes.top).toBeInstanceOf(PauseScene);
  });

  it("com a pausa já aberta, um segundo pedido não a fecha", () => {
    const app = makeApp();
    app.scenes.start(game(app));
    tick(app, 30);
    pauseIfPlaying(app);
    tick(app, 31);
    expect(app.scenes.top).toBeInstanceOf(PauseScene);
    expect(pauseIfPlaying(app)).toBe(false);
    tick(app, 40);
    expect(app.scenes.top).toBeInstanceOf(PauseScene);
  });

  it("nos menus não faz nada", () => {
    const app = makeApp();
    app.scenes.start(new TitleScene(app));
    tick(app, 30);
    expect(pauseIfPlaying(app)).toBe(false);
    tick(app, 40);
    expect(app.scenes.top).toBeInstanceOf(TitleScene);
  });

  it("no meio de uma troca de tela não faz nada", () => {
    const app = makeApp();
    app.scenes.start(game(app));
    tick(app, 30);
    app.scenes.resetTo(new TitleScene(app));
    expect(pauseIfPlaying(app)).toBe(false);
  });
});
