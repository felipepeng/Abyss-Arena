import { BINDINGS } from "./config/input";
import { DEBUG, SCENE, SIM, VIEW } from "./config/system";
import { attachDomInput, Input } from "./core/input";
import { FixedStepLoop, runLoop } from "./core/loop";
import { parseSeed, randomSeed } from "./core/rng";
import { DebugOverlay } from "./debug/overlay";
import { SceneManager } from "./scenes/manager";
import { SandboxScene } from "./scenes/sandbox";

const canvas = document.getElementById("game");
if (!(canvas instanceof HTMLCanvasElement)) throw new Error("canvas #game não encontrado");
canvas.width = VIEW.width;
canvas.height = VIEW.height;
const g = canvas.getContext("2d");
if (!g) throw new Error("Canvas 2D indisponível");

const params = new URLSearchParams(location.search);
// `?seed=` reproduz uma semente vista no overlay
const seed = parseSeed(params.get("seed")) ?? randomSeed();

const input = new Input(BINDINGS);
attachDomInput(input, canvas);

const debug = new DebugOverlay(DEBUG.fpsSampleMs, params.has("debug"));
const scenes = new SceneManager(SCENE.fadeMs, SCENE.fadeColor);
scenes.start(new SandboxScene(input, scenes));

const loop = new FixedStepLoop(SIM.stepMs, SIM.maxFrameMs, {
  step(dtMs) {
    if (input.wasPressed("debugOverlay")) debug.toggle();
    scenes.step(dtMs);
    input.endStep();
  },
  consumeHitStop: (dtMs) => scenes.consumeHitStop(dtMs),
  render(alpha) {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, VIEW.width, VIEW.height);
    scenes.render(g, alpha);
    debug.render(g, seed);
  },
});

runLoop(loop, (elapsedMs) => debug.frame(elapsedMs));
