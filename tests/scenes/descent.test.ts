import { describe, expect, it } from "vitest";
import type { AudioApi, UiSound } from "../../src/audio/api";
import { BINDINGS } from "../../src/config/input";
import { DESCENT_LIGHT, DESCENT_SCENE, SHAFT } from "../../src/config/descent";
import type { TrackId } from "../../src/config/music";
import { VIEW } from "../../src/config/system";
import { Input } from "../../src/core/input";
import { Settings } from "../../src/core/settings";
import { mixHex, shaftLeft, shaftRight } from "../../src/render/descent";
import type { App } from "../../src/scenes/app";
import { DESCENT_TOTAL_MS, DescentScene, descentLight, descentSpeed, exitDepth } from "../../src/scenes/descent";
import { DESCENT, newSession, type DescentSession } from "../../src/scenes/flow";
import { GameScene } from "../../src/scenes/game";
import { SceneManager } from "../../src/scenes/manager";
import { ResultScene } from "../../src/scenes/results";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";

// A cena de descida entre as fases (GDD §2.4): quando ela entra, quanto dura, como a luz cai,
// o que o áudio faz (só a água) e que ela devolve o jogador à fase seguinte, pulada ou não.

const STEP = 1000 / 60;

class Spy implements AudioApi {
  tracks: TrackId[] = [];
  ui_: UiSound[] = [];
  trackStops = 0;
  waterLevels: number[] = [];
  waterStops = 0;
  onEvents(): void {}
  setIntensity(): void {}
  ui(kind: UiSound): void {
    this.ui_.push(kind);
  }
  playTrack(track: TrackId): void {
    this.tracks.push(track);
  }
  stopTrack(): void {
    this.trackStops++;
  }
  water(level: number): void {
    this.waterLevels.push(level);
  }
  stopWater(): void {
    this.waterStops++;
  }
}

function makeApp(): App & { spy: Spy; seeds: number[] } {
  const spy = new Spy();
  const seeds: number[] = [];
  return {
    spy,
    seeds,
    input: new Input(BINDINGS),
    scenes: new SceneManager(300, "#000"),
    debug: { enabled: false },
    settings: new Settings(),
    audio: spy,
    nextSeed: () => {
      seeds.push(40 + seeds.length);
      return 40 + seeds.length - 1;
    },
  };
}

const tick = (app: App, n = 1): void => {
  for (let i = 0; i < n; i++) {
    app.scenes.step(STEP);
    app.input.endStep();
  }
};

const press = (app: App, code: string): void => {
  app.input.keyDown(code);
  tick(app);
  app.input.keyUp(code);
};

/** Vence o Leito e aperta "Continuar": devolve a cena de descida já no ar. */
function toDescent(): { app: ReturnType<typeof makeApp>; session: DescentSession; scene: DescentScene } {
  const app = makeApp();
  const session = newSession();
  const game = new GameScene(app, { mode: { kind: "map", map: RIFT }, seed: 1, flow: { kind: "descent", session } });
  app.scenes.start(game);
  tick(app, 30);
  const f = game.world.phase;
  if (!f) throw new Error("sem fase");
  f.state = "cleared";
  f.t = 0;
  tick(app, 40);
  expect(app.scenes.top).toBeInstanceOf(ResultScene);
  press(app, "Enter"); // "Continuar"
  tick(app, 30);
  const scene = app.scenes.top;
  if (!(scene instanceof DescentScene)) throw new Error("devia ser a cena de descida");
  return { app, session, scene };
}

describe("a luz da descida", () => {
  it("só diminui, dentro de cada descida e de uma para a outra", () => {
    for (let i = 0; i < DESCENT_LIGHT.length; i++) {
      let last = Infinity;
      for (let t = 0; t <= DESCENT_TOTAL_MS; t += 50) {
        const l = descentLight(i, t);
        expect(l).toBeLessThanOrEqual(last);
        last = l;
      }
      expect(descentLight(i, 0)).toBeGreaterThan(descentLight(i, DESCENT_TOTAL_MS));
    }
    // a segunda descida começa onde a primeira acabou e termina mais escura
    expect(descentLight(1, 0)).toBeCloseTo(descentLight(0, DESCENT_TOTAL_MS), 6);
    expect(descentLight(1, DESCENT_TOTAL_MS)).toBeLessThan(descentLight(0, DESCENT_TOTAL_MS));
  });

  it("fica entre 0 e 1 e um índice de fora da tabela usa o último", () => {
    for (const l of [descentLight(0, 0), descentLight(1, DESCENT_TOTAL_MS), descentLight(9, 1e9), descentLight(-3, -5)]) {
      expect(l).toBeGreaterThanOrEqual(0);
      expect(l).toBeLessThanOrEqual(1);
    }
    expect(descentLight(9, DESCENT_TOTAL_MS)).toBe(descentLight(1, DESCENT_TOTAL_MS));
  });
});

describe("o poço", () => {
  it("a parede esquerda fica sempre à esquerda da direita, e a boca de saída é mais larga que o poço", () => {
    const exitY = exitDepth();
    for (let wy = 0; wy <= exitY; wy += 7) {
      expect(shaftRight(wy, exitY) - shaftLeft(wy, exitY)).toBeGreaterThan(SHAFT.halfWidth * 1.5);
    }
    const mouth = shaftRight(exitY, exitY) - shaftLeft(exitY, exitY);
    expect(mouth).toBeGreaterThan(2 * SHAFT.halfWidth);
    // longe da boca, o poço tem a largura normal
    expect(shaftRight(0, exitY) - shaftLeft(0, exitY)).toBeLessThan(mouth);
  });

  it("mixHex mistura cores e devolve a primeira se alguma não for #rrggbb", () => {
    expect(mixHex("#000000", "#ffffff", 0.5)).toBe("#808080");
    expect(mixHex("#102030", "#ffffff", 0)).toBe("#102030");
    expect(mixHex("rgba(0,0,0,1)", "#ffffff", 0.5)).toBe("rgba(0,0,0,1)");
  });
});

describe("a cena: já descendo e saindo para a fase seguinte", () => {
  const run = (scene: DescentScene, ms: number): void => {
    while (scene.elapsedMs < ms) scene.step(STEP);
  };
  const fresh = (): DescentScene =>
    new DescentScene(makeApp(), { from: RIFT, next: { mode: { kind: "map", map: CORAL }, seed: 1, flow: { kind: "test" } } });

  it("começa já caindo, longe da boca de saída, sem mostrar a entrada no buraco", () => {
    const scene = fresh();
    expect(descentSpeed(0)).toBeCloseTo(DESCENT_SCENE.fallSpeedPxS * DESCENT_SCENE.startSpeedFrac, 6);
    expect(scene.diver.wy).toBe(SHAFT.fallScreenY);
    expect(scene.diver.aim).toBeCloseTo(Math.PI / 2, 6); // de cabeça para baixo
    expect(scene.diver.cam).toBe(0);
    expect(scene.mouthY).toBeGreaterThan(SHAFT.fallScreenY + 540); // a saída nem aparece na tela
    run(scene, 100);
    expect(scene.diver.wy).toBeGreaterThan(SHAFT.fallScreenY + 30);
  });

  it("a queda acaba na boca de saída, e dali ele freia, vira e nada para a direita fora do poço", () => {
    const scene = fresh();
    run(scene, DESCENT_SCENE.fallMs);
    expect(scene.diver.wy).toBeCloseTo(scene.mouthY, -1); // chegou à boca
    run(scene, DESCENT_TOTAL_MS - 30);
    const d = scene.diver;
    expect(d.wy).toBeGreaterThan(scene.mouthY + 100); // saiu do poço, para a água da fase seguinte
    expect(d.aim).toBeLessThan(0.3); // virou para a direita
    expect(d.x).toBeGreaterThan(VIEW.width / 2 + 40); // e já nadou para o lado
    expect(descentSpeed(DESCENT_TOTAL_MS)).toBeLessThan(1); // parou de cair
  });

  it("a câmera para depois da boca: o mergulhador sai da cena pela água, e o teto fica à vista", () => {
    const scene = fresh();
    run(scene, DESCENT_TOTAL_MS - 30);
    expect(scene.diver.cam).toBeCloseTo(scene.mouthY - SHAFT.exitCeilingScreenY, 6);
    // o teto fica na tela, e ele está abaixo dele
    expect(scene.diver.wy - scene.diver.cam).toBeGreaterThan(SHAFT.exitCeilingScreenY);
    expect(scene.diver.wy - scene.diver.cam).toBeLessThan(540);
  });
});

describe("da fase concluída ao próximo mapa", () => {
  it("'Continuar' leva à cena de descida, que já sorteou a semente e criou a fase seguinte", () => {
    const { app, scene } = toDescent();
    expect(app.seeds).toHaveLength(1);
    const next = scene.upcoming;
    expect(next).toBeInstanceOf(GameScene);
    expect(next?.gameParams.mode).toEqual({ kind: "map", map: CORAL });
    expect(next?.gameParams.seed).toBe(app.seeds[0]);
    // ainda não é a fase: nada de música dela
    expect(app.spy.tracks.at(-1)).toBe("rift");
  });

  it("dura o que o config diz e então entra o Coral, com a sessão preservada", () => {
    const { app, session, scene } = toDescent();
    const before = session.timeMs;
    expect(DESCENT_TOTAL_MS).toBe(DESCENT_SCENE.fallMs + DESCENT_SCENE.exitMs);
    tick(app, Math.floor((DESCENT_TOTAL_MS - 400) / STEP));
    expect(app.scenes.top).toBe(scene);
    // a cena não conta no tempo da sessão: só os "passos jogados"
    expect(session.timeMs).toBe(before);
    tick(app, Math.ceil(800 / STEP) + 40);
    const game = app.scenes.top;
    expect(game).toBeInstanceOf(GameScene);
    expect(game).toBe(scene.upcoming);
    if (!(game instanceof GameScene)) return;
    expect(game.gameParams.flow).toEqual({ kind: "descent", session });
    expect(app.spy.tracks.at(-1)).toBe("coral");
  });

  it("Enter pula, mas só depois do tempo de guarda (o Enter do 'Continuar' não pula a cena)", () => {
    const { app, scene } = toDescent();
    press(app, "Enter");
    tick(app, 40);
    expect(app.scenes.top).toBe(scene);
    // passa a guarda
    while (scene.elapsedMs < DESCENT_SCENE.skipLockMs + 100) tick(app);
    press(app, "Enter");
    tick(app, 40);
    expect(app.scenes.top).toBeInstanceOf(GameScene);
    expect(scene.elapsedMs).toBeLessThan(DESCENT_TOTAL_MS);
  });

  it("a Descida inteira passa pela cena duas vezes: Leito→Coral e Coral→Fosso", () => {
    expect(DESCENT).toHaveLength(DESCENT_LIGHT.length + 1);
  });
});

describe("o som da cena", () => {
  it("cala a música ao entrar e toca só a água, que sobe com a queda e para ao sair", () => {
    const { app, scene } = toDescent();
    expect(app.spy.trackStops).toBe(1);
    expect(app.spy.waterStops).toBe(0);
    // já começa na queda
    expect(app.spy.waterLevels[0]).toBeCloseTo(DESCENT_SCENE.startSpeedFrac, 1);

    tick(app, Math.floor((DESCENT_SCENE.fallMs - 200) / STEP));
    const levels = app.spy.waterLevels;
    expect(Math.max(...levels)).toBeCloseTo(1, 1);
    expect(Math.min(...levels)).toBeGreaterThan(0.85);
    // na saída ele freia e passa a nadar: a água se acalma
    tick(app, Math.floor((DESCENT_SCENE.exitMs - 200) / STEP));
    expect(Math.min(...levels)).toBeCloseTo(DESCENT_SCENE.swimLevel, 6);
    // não fala com o áudio a cada passo: só quando a velocidade muda
    expect(levels.length).toBeLessThan(scene.elapsedMs / STEP);
    // não há som de interface durante a cena (depois do clique do 'Continuar')
    const uiBefore = app.spy.ui_.length;
    tick(app, 10);
    expect(app.spy.ui_.length).toBe(uiBefore);

    tick(app, 200);
    expect(app.scenes.top).toBeInstanceOf(GameScene);
    expect(app.spy.waterStops).toBe(1);
  });
});

describe("desenho", () => {
  // um contexto 2D de mentira que aceita qualquer chamada: só confere que desenhar não quebra
  const fake = (): CanvasRenderingContext2D => {
    const make = (): unknown => new Proxy(function () {}, { get: () => make(), apply: () => make(), set: () => true });
    return make() as CanvasRenderingContext2D;
  };

  it("desenha a aproximação, a queda e a chegada das duas descidas, com a interpolação", () => {
    for (const from of [RIFT, CORAL]) {
      const app = makeApp();
      const next = { mode: { kind: "map", map: CORAL }, seed: 1, flow: { kind: "test" } } as const;
      const scene = new DescentScene(app, { from, next });
      const g = fake();
      scene.render(g, 0);
      for (let t = 0; t < DESCENT_TOTAL_MS - 40; t += STEP) {
        scene.step(STEP);
        scene.render(g, (t / STEP) % 1);
      }
      expect(scene.light).toBeLessThan(0.5);
    }
  });
});
