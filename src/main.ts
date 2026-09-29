import { BINDINGS } from "./config/input";
import { DEBUG, SCENE, SIM, VIEW } from "./config/system";
import { Display } from "./core/display";
import { attachDomInput, Input } from "./core/input";
import { FixedStepLoop, runLoop } from "./core/loop";
import { parseSeed, randomSeed } from "./core/rng";
import { AudioEngine } from "./audio/engine";
import { Settings } from "./core/settings";
import { DebugOverlay } from "./debug/overlay";
import type { App } from "./scenes/app";
import { GameScene } from "./scenes/game";
import { SceneManager } from "./scenes/manager";
import { TitleScene } from "./scenes/title";
import { MAPS } from "./world/maps/registry";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas #game não encontrado");
const display = new Display(canvas, VIEW.width, VIEW.height);
const g = canvas.getContext("2d");
if (!g) throw new Error("Canvas 2D indisponível");

const params = new URLSearchParams(location.search);
// `?seed=` reproduz uma semente vista no overlay. Vale para a primeira fase; as seguintes
// sorteiam a sua (a fase reaproveita a dela ao tentar de novo).
const urlSeed = parseSeed(params.get("seed"));
let firstSeed = urlSeed;
const nextSeed = (): number => {
  const s = firstSeed ?? randomSeed();
  firstSeed = null;
  lastSeed = s;
  return s;
};
let lastSeed = urlSeed ?? 0;

const input = new Input(BINDINGS);
// antes de o mouse se mexer, o cursor conta como no centro da tela (como no protótipo)
input.mouseX = VIEW.width / 2;
input.mouseY = VIEW.height / 2;
attachDomInput(input, canvas, VIEW.width, VIEW.height);

const debug = new DebugOverlay(DEBUG.fpsSampleMs, params.has("debug"));
const scenes = new SceneManager(SCENE.fadeMs, SCENE.fadeColor);
const settings = new Settings();
const audio = new AudioEngine(settings);
// Os navegadores só deixam tocar som depois de um gesto do jogador: o primeiro toque de tecla ou
// clique cria o contexto de áudio (e a trilha que as cenas já pediram começa aí).
for (const type of ["keydown", "pointerdown"] as const) window.addEventListener(type, () => audio.unlock());
document.addEventListener("visibilitychange", () => audio.setHidden(document.hidden));
const app: App = { input, scenes, debug, settings, audio, nextSeed };

// O jogo abre no título. Atalhos de desenvolvimento, que pulam os menus:
//   `?map=rift|coral|abyss`  abre direto a fase daquele mapa (Arena livre)
//   `?arena=test`            a arena de teste do M1–M2 (sacos de pancada, nascimento por tempo)
const shortcutMap = MAPS[params.get("map") ?? ""];
if (params.get("arena") === "test") {
  scenes.start(new GameScene(app, { mode: { kind: "test" }, seed: nextSeed(), flow: { kind: "test" } }));
} else if (shortcutMap) {
  scenes.start(new GameScene(app, { mode: { kind: "map", map: shortcutMap }, seed: nextSeed(), flow: { kind: "free" } }));
} else {
  scenes.start(new TitleScene(app));
}

const loop = new FixedStepLoop(SIM.stepMs, SIM.maxFrameMs, {
  step(dtMs) {
    if (input.wasPressed("debugOverlay")) debug.toggle();
    if (debug.enabled && input.wasPressed("debugSlowMo")) {
      loop.timeScale = loop.timeScale === 1 ? DEBUG.slowMoScale : 1;
    }
    // sem depuração, a câmera lenta não pode ficar ligada
    if (!debug.enabled) loop.timeScale = 1;
    scenes.step(dtMs);
    input.endStep();
    audio.update();
  },
  consumeHitStop: (dtMs) => scenes.consumeHitStop(dtMs),
  render(alpha) {
    display.begin(g);
    scenes.render(g, alpha);
    const top = scenes.top;
    if (debug.enabled) top?.renderDebug?.(g, alpha);
    const extra = top?.debugLines?.() ?? [];
    if (loop.timeScale !== 1) extra.push(`CÂMERA LENTA ${loop.timeScale}×`);
    debug.render(g, lastSeed, extra);
  },
});

runLoop(loop, (elapsedMs) => debug.frame(elapsedMs));
