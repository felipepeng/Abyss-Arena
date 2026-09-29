import { describe, expect, it } from "vitest";
import { SilentAudio } from "../../src/audio/api";
import { BINDINGS } from "../../src/config/input";
import { PLAYER } from "../../src/config/player";
import { RESULT } from "../../src/config/ui";
import { Input } from "../../src/core/input";
import { Settings } from "../../src/core/settings";
import type { App } from "../../src/scenes/app";
import { ArenaSelectScene } from "../../src/scenes/arenaSelect";
import { DESCENT, formatTime, newSession, nextInDescent } from "../../src/scenes/flow";
import { GameScene } from "../../src/scenes/game";
import { SceneManager, type Scene } from "../../src/scenes/manager";
import { PauseScene } from "../../src/scenes/pause";
import { ResultScene } from "../../src/scenes/results";
import { TitleScene } from "../../src/scenes/title";
import { hurtPlayer } from "../../src/sim/combat";
import { ABYSS } from "../../src/world/maps/abyss";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";

// M6: o fluxo entre as telas (GDD §2 e §11), passo a passo, com a entrada e o gerenciador de
// cenas de verdade. Só o desenho (canvas) fica de fora.

const STEP = 1000 / 60;
const FADE = 300;

function makeApp(): App & { seeds: number[] } {
  const seeds: number[] = [];
  let next = 100;
  return {
    seeds,
    input: new Input(BINDINGS),
    scenes: new SceneManager(FADE, "#000"),
    debug: { enabled: false },
    settings: new Settings(),
    audio: new SilentAudio(),
    nextSeed: () => {
      seeds.push(next);
      return next++;
    },
  };
}

const tick = (app: App, n = 1): void => {
  for (let i = 0; i < n; i++) {
    app.scenes.step(STEP);
    app.input.endStep();
  }
};

/** Espera o fade acabar (300 ms) com folga. */
const settle = (app: App): void => tick(app, 30);

/** Um toque de tecla: aperta, deixa um passo ver, solta. */
function press(app: App, code: string): void {
  app.input.keyDown(code);
  tick(app);
  app.input.keyUp(code);
}

/** Confirma a opção selecionada e espera a troca de tela. */
function confirm(app: App): void {
  press(app, "Enter");
  settle(app);
}

const top = <T extends Scene>(app: App): T => app.scenes.top as T;

/** Do título até a primeira fase da Descida. */
function startDescent(): { app: ReturnType<typeof makeApp>; game: GameScene } {
  const app = makeApp();
  app.scenes.start(new TitleScene(app));
  settle(app);
  confirm(app); // "Descida" é a primeira opção
  return { app, game: top<GameScene>(app) };
}

function die(app: App, game: GameScene): void {
  hurtPlayer(game.world, PLAYER.hp + 1, 0, 0);
  tick(app, Math.ceil(RESULT.defeatDelayMs / STEP) + 5);
  settle(app);
}

function clear(app: App, game: GameScene): void {
  const f = game.world.phase;
  if (!f) throw new Error("sem fase");
  f.state = "cleared";
  f.t = 0;
  tick(app, 2);
  settle(app);
}

describe("formatTime e a ordem da Descida", () => {
  it("formata m:ss e h:mm:ss", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(65_400)).toBe("1:05");
    expect(formatTime(3_725_000)).toBe("1:02:05");
  });

  it("a Descida é Leito → Coral → Fosso, e o Fosso é o último", () => {
    expect(DESCENT).toEqual([RIFT, CORAL, ABYSS]);
    expect(nextInDescent(RIFT)).toBe(CORAL);
    expect(nextInDescent(CORAL)).toBe(ABYSS);
    expect(nextInDescent(ABYSS)).toBeNull();
  });
});

describe("volume (GDD §10.3)", () => {
  it("música e efeitos são separados, ficam entre 0 e 1 e andam de 0,1 em 0,1", () => {
    const s = new Settings();
    s.setMusicVolume(0.3);
    expect(s.musicVolume).toBe(0.3);
    expect(s.sfxVolume).toBe(0.7);
    s.setSfxVolume(5);
    expect(s.sfxVolume).toBe(1);
    s.setSfxVolume(-1);
    expect(s.sfxVolume).toBe(0);
    s.setMusicVolume(0.1 + 0.2);
    expect(s.musicVolume).toBe(0.3);
  });
});

describe("do título à Descida", () => {
  it("o jogo abre no título, e a primeira opção começa o Leito com fade", () => {
    const app = makeApp();
    app.scenes.start(new TitleScene(app));
    settle(app);
    expect(app.scenes.top).toBeInstanceOf(TitleScene);

    press(app, "Enter");
    // a troca não é instantânea: o título ainda está lá durante o fade
    expect(app.scenes.transitioning).toBe(true);
    expect(app.scenes.top).toBeInstanceOf(TitleScene);
    settle(app);

    const game = top<GameScene>(app);
    expect(game).toBeInstanceOf(GameScene);
    expect(game.gameParams.mode).toEqual({ kind: "map", map: RIFT });
    expect(game.gameParams.flow.kind).toBe("descent");
    expect(app.seeds).toHaveLength(1);
    expect(game.world.seed).toBe(app.seeds[0]);
  });

  it("navega pelo menu com as setas e abre Controles e Áudio por cima, e volta com Esc", () => {
    const app = makeApp();
    app.scenes.start(new TitleScene(app));
    settle(app);
    press(app, "ArrowDown");
    press(app, "ArrowDown"); // Controles
    confirm(app);
    expect(app.scenes.top?.constructor.name).toBe("ControlsScene");
    press(app, "Escape");
    settle(app);
    expect(app.scenes.top).toBeInstanceOf(TitleScene);
    press(app, "ArrowUp"); // volta para "Arena livre"; e de novo, para "Descida"
    press(app, "ArrowUp");
    press(app, "ArrowUp"); // dá a volta: "Áudio"
    confirm(app);
    expect(app.scenes.top?.constructor.name).toBe("AudioScene");
  });

  it("a Arena livre abre a seleção dos 3 mapas, e cada um começa a fase certa", () => {
    const app = makeApp();
    app.scenes.start(new TitleScene(app));
    settle(app);
    press(app, "ArrowDown");
    confirm(app);
    expect(app.scenes.top).toBeInstanceOf(ArenaSelectScene);
    press(app, "ArrowDown"); // Jardim de Corais
    confirm(app);
    const game = top<GameScene>(app);
    expect(game.gameParams.mode).toEqual({ kind: "map", map: CORAL });
    expect(game.gameParams.flow.kind).toBe("free");
  });
});

describe("morrer e tentar de novo", () => {
  it("depois de morrer aparece VOCÊ AFUNDOU; tentar de novo reusa a semente e conta a morte", () => {
    const { app, game } = startDescent();
    const seed = game.gameParams.seed;
    die(app, game);
    const result = top<ResultScene>(app);
    expect(result).toBeInstanceOf(ResultScene);
    expect(result.title).toBe("VOCÊ AFUNDOU");

    confirm(app); // "Tentar de novo"
    const again = top<GameScene>(app);
    expect(again).toBeInstanceOf(GameScene);
    expect(again).not.toBe(game);
    expect(again.gameParams.seed).toBe(seed);
    expect(again.world.player.hp).toBe(PLAYER.hp);
    expect(again.world.phase?.state).toBe("intro");
    if (again.gameParams.flow.kind !== "descent") throw new Error("devia ser a Descida");
    expect(again.gameParams.flow.session.deaths).toBe(1);
    // nenhuma semente nova foi sorteada
    expect(app.seeds).toHaveLength(1);
  });

  it("a opção Menu volta ao título", () => {
    const { app, game } = startDescent();
    die(app, game);
    press(app, "ArrowDown");
    confirm(app);
    expect(app.scenes.top).toBeInstanceOf(TitleScene);
  });

  it("a tela de derrota só aparece depois do atraso", () => {
    const { app, game } = startDescent();
    hurtPlayer(game.world, PLAYER.hp + 1, 0, 0);
    tick(app, 20); // ~333 ms
    expect(app.scenes.top).toBe(game);
  });
});

describe("a Descida inteira", () => {
  it("cada chefe leva ao próximo mapa, com sementes novas, e o Olho leva à tela final", () => {
    const { app, game: rift } = startDescent();
    clear(app, rift);
    const first = top<ResultScene>(app);
    expect(first.title).toBe("FASE CONCLUÍDA");
    confirm(app);

    const coral = top<GameScene>(app);
    expect(coral.gameParams.mode).toEqual({ kind: "map", map: CORAL });
    expect(coral.world.player.hp).toBe(PLAYER.hp); // vida cheia no mapa novo
    expect(app.seeds).toHaveLength(2);
    clear(app, coral);
    confirm(app);

    const abyss = top<GameScene>(app);
    expect(abyss.gameParams.mode).toEqual({ kind: "map", map: ABYSS });
    clear(app, abyss);
    confirm(app);

    const end = top<ResultScene>(app);
    expect(end).toBeInstanceOf(ResultScene);
    expect(end.title).toBe("FIM DA DESCIDA");
    // e dali só se sai para o menu
    confirm(app);
    expect(app.scenes.top).toBeInstanceOf(TitleScene);
  });

  it("morrer no Olho não devolve ao Leito: tentar de novo recomeça o Fosso", () => {
    const { app, game: rift } = startDescent();
    clear(app, rift);
    confirm(app);
    const coral = top<GameScene>(app);
    clear(app, coral);
    confirm(app);
    const abyss = top<GameScene>(app);
    die(app, abyss);
    confirm(app);
    expect(top<GameScene>(app).gameParams.mode).toEqual({ kind: "map", map: ABYSS });
  });

  it("o tempo da sessão soma os passos jogados e não conta a pausa", () => {
    const { app, game } = startDescent();
    const flow = game.gameParams.flow;
    if (flow.kind !== "descent") throw new Error("devia ser a Descida");
    settle(app);
    const before = flow.session.timeMs;
    tick(app, 60);
    expect(flow.session.timeMs - before).toBeCloseTo(1000, -1);

    press(app, "Escape");
    settle(app);
    expect(app.scenes.top).toBeInstanceOf(PauseScene);
    const paused = flow.session.timeMs;
    tick(app, 120);
    expect(flow.session.timeMs).toBe(paused);
  });
});

describe("Arena livre", () => {
  function freeGame(): { app: ReturnType<typeof makeApp>; game: GameScene } {
    const app = makeApp();
    app.scenes.start(new TitleScene(app));
    settle(app);
    press(app, "ArrowDown");
    confirm(app);
    confirm(app); // Leito
    return { app, game: top<GameScene>(app) };
  }

  it("vencer volta à seleção, sem seguir para o próximo mapa", () => {
    const { app, game } = freeGame();
    clear(app, game);
    expect(top<ResultScene>(app).title).toBe("FASE CONCLUÍDA");
    confirm(app); // "Voltar à seleção"
    expect(app.scenes.top).toBeInstanceOf(ArenaSelectScene);
  });

  it("morrer não conta numa sessão: tentar de novo reusa a semente", () => {
    const { app, game } = freeGame();
    const seed = game.gameParams.seed;
    die(app, game);
    confirm(app);
    expect(top<GameScene>(app).gameParams.seed).toBe(seed);
    expect(top<GameScene>(app).gameParams.flow.kind).toBe("free");
  });
});

describe("pausa", () => {
  it("Esc pausa; a simulação congela; Esc de novo continua", () => {
    const { app, game } = startDescent();
    settle(app);
    tick(app, 30);
    press(app, "Escape");
    settle(app);
    expect(app.scenes.top).toBeInstanceOf(PauseScene);
    const t = game.world.timeMs;
    tick(app, 60);
    expect(game.world.timeMs).toBe(t);
    press(app, "Escape");
    settle(app);
    expect(app.scenes.top).toBe(game);
  });

  it("Tentar a fase de novo recomeça com a mesma semente; Sair leva ao título", () => {
    const { app, game } = startDescent();
    settle(app);
    press(app, "Escape");
    settle(app);
    press(app, "ArrowDown"); // Tentar a fase de novo
    confirm(app);
    const again = top<GameScene>(app);
    expect(again).not.toBe(game);
    expect(again.gameParams.seed).toBe(game.gameParams.seed);

    settle(app);
    press(app, "Escape");
    settle(app);
    press(app, "ArrowUp"); // dá a volta: "Sair para o menu"
    confirm(app);
    expect(app.scenes.top).toBeInstanceOf(TitleScene);
  });

  it("o volume da pausa é o mesmo do título (as configurações são da sessão)", () => {
    const { app } = startDescent();
    settle(app);
    press(app, "Escape");
    settle(app);
    press(app, "ArrowDown");
    press(app, "ArrowDown"); // Áudio
    confirm(app);
    expect(app.scenes.top?.constructor.name).toBe("AudioScene");
    press(app, "ArrowLeft"); // primeiro controle: música
    expect(app.settings.musicVolume).toBeCloseTo(0.6, 6);
    press(app, "ArrowDown");
    press(app, "ArrowRight"); // efeitos
    expect(app.settings.sfxVolume).toBeCloseTo(0.8, 6);
    press(app, "Escape");
    settle(app);
    expect(app.scenes.top).toBeInstanceOf(PauseScene);
  });
});

describe("sessão", () => {
  it("newSession começa zerada", () => {
    expect(newSession()).toEqual({ timeMs: 0, deaths: 0 });
  });
});
