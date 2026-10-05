import { describe, expect, it } from "vitest";
import type { AudioApi, UiSound } from "../../src/audio/api";
import { musicLevel } from "../../src/audio/level";
import { BINDINGS, type Action } from "../../src/config/input";
import type { MusicLevel, TrackId } from "../../src/config/music";
import { Input } from "../../src/core/input";
import { Settings } from "../../src/core/settings";
import type { App } from "../../src/scenes/app";
import { GameScene } from "../../src/scenes/game";
import { SceneManager } from "../../src/scenes/manager";
import { TitleScene } from "../../src/scenes/title";
import { BOSS_DEFS } from "../../src/sim/bosses/registry";
import { hurtPlayer } from "../../src/sim/combat";
import type { SimEvent } from "../../src/sim/events";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, type World } from "../../src/sim/world";
import { Menu } from "../../src/ui/menu";
import { ABYSS } from "../../src/world/maps/abyss";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";

// M7 nas cenas: quem pede qual trilha, de onde vem a intensidade e o clique dos menus.

const STEP = 1000 / 60;

class Spy implements AudioApi {
  tracks: TrackId[] = [];
  levels: MusicLevel[] = [];
  ui_: UiSound[] = [];
  events: SimEvent[] = [];
  onEvents(events: readonly SimEvent[]): void {
    this.events.push(...events);
  }
  ui(kind: UiSound): void {
    this.ui_.push(kind);
  }
  playTrack(track: TrackId): void {
    this.tracks.push(track);
  }
  setIntensity(level: MusicLevel): void {
    this.levels.push(level);
  }
}

function makeApp(): App & { spy: Spy } {
  const spy = new Spy();
  return {
    spy,
    input: new Input(BINDINGS),
    scenes: new SceneManager(300, "#000"),
    debug: { enabled: false },
    settings: new Settings(),
    audio: spy,
    nextSeed: () => 7,
  };
}

const tick = (app: App, n = 1): void => {
  for (let i = 0; i < n; i++) {
    app.scenes.step(STEP);
    app.input.endStep();
  }
};

describe("nível de intensidade da música", () => {
  const boss = (kind: "crab" | "jelly" | "eye"): World => {
    const map = { crab: RIFT, jelly: CORAL, eye: ABYSS }[kind];
    const w = createMapWorld(map, 1);
    debugSkipToBoss(w);
    return w;
  };

  it("nas ondas, na entrada e nos intervalos é 0", () => {
    const w = createMapWorld(RIFT, 1);
    expect(musicLevel(w)).toBe(0);
    for (const s of ["intro", "wave", "interlude"] as const) {
      if (w.phase) w.phase.state = s;
      expect(musicLevel(w)).toBe(0);
    }
  });

  it.each(["crab", "jelly", "eye"] as const)("%s: chefe é 1, e a última fase dele é 2", (kind) => {
    const w = boss(kind);
    const last = BOSS_DEFS[kind].phases.length - 1;
    const b = w.phase?.boss;
    if (!b || !w.phase) throw new Error("sem chefe");
    expect(w.phase.state).toBe("bossIntro");
    expect(musicLevel(w)).toBe(1);
    w.phase.state = "boss";
    for (let phase = 0; phase < last; phase++) {
      b.phase = phase;
      expect(musicLevel(w), `${kind} fase ${phase + 1}`).toBe(1);
    }
    b.phase = last;
    expect(musicLevel(w)).toBe(2);
  });

  it("o Olho tem três fases: a do meio ainda é 1", () => {
    expect(BOSS_DEFS.eye.phases).toHaveLength(3);
    const w = boss("eye");
    if (!w.phase?.boss) throw new Error("sem chefe");
    w.phase.state = "boss";
    w.phase.boss.phase = 1;
    expect(musicLevel(w)).toBe(1);
  });

  it("chefe morto ou jogador morto voltam a 0", () => {
    const w = boss("crab");
    if (!w.phase?.boss) throw new Error("sem chefe");
    w.phase.state = "boss";
    w.phase.boss.phase = 1;
    expect(musicLevel(w)).toBe(2);
    w.phase.boss.dead = true;
    expect(musicLevel(w)).toBe(0);
    w.phase.boss.dead = false;
    hurtPlayer(w, 999, 0, 0);
    expect(musicLevel(w)).toBe(0);
  });
});

describe("cenas e música", () => {
  it("o título pede a trilha do menu; cada mapa, a sua", () => {
    const app = makeApp();
    app.scenes.start(new TitleScene(app));
    expect(app.spy.tracks).toEqual(["menu"]);
    for (const [map, id] of [[RIFT, "rift"], [CORAL, "coral"], [ABYSS, "abyss"]] as const) {
      const spy = new Spy();
      const a = { ...makeApp(), audio: spy };
      a.scenes.start(new GameScene(a, { mode: { kind: "map", map }, seed: 1, flow: { kind: "free" } }));
      expect(spy.tracks).toEqual([id]);
    }
  });

  it("a fase manda a intensidade e os eventos da simulação a cada passo", () => {
    const app = makeApp();
    const game = new GameScene(app, { mode: { kind: "map", map: RIFT }, seed: 1, flow: { kind: "free" } });
    app.scenes.start(game);
    tick(app, 30); // fade
    tick(app, 200); // o cartão de título (2,5 s) passa e a onda 1 começa a nascer
    expect(app.spy.levels.length).toBeGreaterThan(150);
    expect(new Set(app.spy.levels)).toEqual(new Set([0]));
    // a fase começa com o nascimento de inimigos: o áudio recebe esses eventos
    expect(app.spy.events.some((e) => e.t === "spawnWarn")).toBe(true);

    debugSkipToBoss(game.world);
    tick(app, 5);
    expect(app.spy.levels.at(-1)).toBe(1);
  });

  it("depois do fim da Descida, a tela final volta à trilha calma", () => {
    const app = makeApp();
    const game = new GameScene(app, { mode: { kind: "map", map: ABYSS }, seed: 1, flow: { kind: "descent", session: { timeMs: 0, deaths: 0 } } });
    app.scenes.start(game);
    tick(app, 30);
    const f = game.world.phase;
    if (!f) throw new Error("sem fase");
    f.state = "cleared";
    f.t = 0;
    tick(app, 40);
    // "Continuar" na fase concluída do último mapa
    app.input.keyDown("Enter");
    tick(app);
    app.input.keyUp("Enter");
    tick(app, 40);
    expect(app.spy.tracks.at(-1)).toBe("menu");
  });
});

describe("sons de interface nas cenas", () => {
  const key = (app: App, code: string, n = 2) => {
    app.input.keyDown(code);
    tick(app);
    app.input.keyUp(code);
    tick(app, n);
  };

  it("cada fase toca o cartão do mapa ao entrar (a arena de teste não)", () => {
    const app = makeApp();
    app.scenes.start(new GameScene(app, { mode: { kind: "map", map: CORAL }, seed: 1, flow: { kind: "free" } }));
    expect(app.spy.ui_).toEqual(["title"]);
    const test = makeApp();
    test.scenes.start(new GameScene(test, { mode: { kind: "test" }, seed: 1, flow: { kind: "free" } }));
    expect(test.spy.ui_).toEqual([]);
  });

  it("pausar toca 'pause'; continuar (Esc, P ou o botão) toca 'resume'", () => {
    for (const close of ["Escape", "KeyP", "Enter"]) {
      const app = makeApp();
      app.scenes.start(new GameScene(app, { mode: { kind: "map", map: RIFT }, seed: 1, flow: { kind: "free" } }));
      tick(app, 30);
      app.spy.ui_.length = 0;
      key(app, "Escape", 30);
      expect(app.spy.ui_, "abrir").toEqual(["pause"]);
      app.spy.ui_.length = 0;
      key(app, close, 30);
      // o botão "Continuar" é o primeiro da pausa: confirmar, e depois continuar
      expect(app.spy.ui_, close).toEqual(close === "Enter" ? ["confirm", "resume"] : ["resume"]);
    }
  });

  it("voltar com Esc toca 'back' nas telas do menu", () => {
    const app = makeApp();
    app.scenes.start(new TitleScene(app));
    tick(app, 30);
    // título → Arena livre (segundo item) → Esc volta
    key(app, "ArrowDown");
    key(app, "Enter", 40);
    tick(app, 30);
    app.spy.ui_.length = 0;
    key(app, "Escape", 40);
    expect(app.spy.ui_).toEqual(["back"]);
  });
});

describe("cliques do menu", () => {
  const build = (spy: Spy) =>
    new Menu(
      [
        { kind: "button", label: "A", onSelect: () => {} },
        { kind: "button", label: "B", onSelect: () => {} },
        { kind: "slider", label: "V", get: () => 0.5, set: () => {} },
      ],
      100,
      spy,
    );
  const press = (input: Input<Action>, menu: Menu, code: string) => {
    input.keyDown(code);
    menu.step(input);
    input.keyUp(code);
    input.endStep();
  };

  it("navegar toca 'move', confirmar toca 'confirm', e nada acontece sem tecla", () => {
    const spy = new Spy();
    const menu = build(spy);
    const input = new Input(BINDINGS);
    menu.step(input);
    expect(spy.ui_).toEqual([]);
    press(input, menu, "ArrowDown");
    press(input, menu, "Enter");
    expect(spy.ui_).toEqual(["move", "confirm"]);
  });

  it("ajustar um volume toca 'move'", () => {
    const spy = new Spy();
    const menu = build(spy);
    const input = new Input(BINDINGS);
    press(input, menu, "ArrowUp"); // dá a volta até o controle: um "move"
    press(input, menu, "ArrowRight");
    expect(spy.ui_).toEqual(["move", "move"]);
  });
});
