import { BINDINGS } from "./config/input";
import { DEBUG, SCENE, SIM, VIEW } from "./config/system";
import { Display } from "./core/display";
import { attachDomInput, Input } from "./core/input";
import { FixedStepLoop, runLoop } from "./core/loop";
import { parseSeed, randomSeed } from "./core/rng";
import { DebugOverlay } from "./debug/overlay";
import { GameScene } from "./scenes/game";
import { SceneManager } from "./scenes/manager";
import { MAPS } from "./world/maps/registry";
import { RIFT } from "./world/maps/rift";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas #game não encontrado");
const display = new Display(canvas, VIEW.width, VIEW.height);
const g = canvas.getContext("2d");
if (!g) throw new Error("Canvas 2D indisponível");

const params = new URLSearchParams(location.search);
// `?seed=` reproduz uma semente vista no overlay
const seed = parseSeed(params.get("seed")) ?? randomSeed();

const input = new Input(BINDINGS);
// antes de o mouse se mexer, o cursor conta como no centro da tela (como no protótipo)
input.mouseX = VIEW.width / 2;
input.mouseY = VIEW.height / 2;
attachDomInput(input, canvas, VIEW.width, VIEW.height);

const debug = new DebugOverlay(DEBUG.fpsSampleMs, params.has("debug"));
const scenes = new SceneManager(SCENE.fadeMs, SCENE.fadeColor);
// Até existirem os menus (M6), o mapa vem da URL: `?map=rift|coral|abyss` (padrão: rift).
// `?arena=test` abre a arena de teste do M1–M2 (sacos de pancada, nascimento por tempo).
const map = MAPS[params.get("map") ?? "rift"] ?? RIFT;
const mode = params.get("arena") === "test" ? ({ kind: "test" } as const) : ({ kind: "map", map } as const);
scenes.start(new GameScene(input, scenes, debug, seed, mode));

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
  },
  consumeHitStop: (dtMs) => scenes.consumeHitStop(dtMs),
  render(alpha) {
    display.begin(g);
    scenes.render(g, alpha);
    const top = scenes.top;
    if (debug.enabled) top?.renderDebug?.(g, alpha);
    const extra = top?.debugLines?.() ?? [];
    if (loop.timeScale !== 1) extra.push(`CÂMERA LENTA ${loop.timeScale}×`);
    debug.render(g, seed, extra);
  },
});

runLoop(loop, (elapsedMs) => debug.frame(elapsedMs));
