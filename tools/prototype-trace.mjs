// Grava rastros passo a passo do PROTÓTIPO ORIGINAL, para os testes de paridade
// (tests/sim/parity.test.ts). Roda o próprio `prototipo/index.html` num Chromium headless,
// com o requestAnimationFrame desligado, e chama `step()` à mão numa arena aberta.
//
// Uso (o Playwright não é dependência do projeto):
//   npm i --no-save playwright && npx playwright install chromium
//   node tools/prototype-trace.mjs
//
// Ao mudar os roteiros aqui, mude os mesmos roteiros no teste de paridade.
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const root = new URL("..", import.meta.url);
const protoPath = new URL("prototipo/index.html", root);
const outPath = new URL("tests/fixtures/prototype-traces.json", root);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.addInitScript(() => { window.requestAnimationFrame = () => 0; });
await page.goto(protoPath.href);

const traces = await page.evaluate(() => {
  // arena aberta: só a borda de 2 blocos; jogador no centro; nada nasce
  function setup() {
    resetGame();
    grid.fill(0);
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++)
      if (x < 2 || y < 2 || x >= COLS - 2 || y >= ROWS - 2) grid[y * COLS + x] = 1;
    player.x = 480; player.y = 270; player.vx = 0; player.vy = 0;
    game.spawnTimerMs = 1e12;
    for (const k in keys) keys[k] = false;
    mouse.down = false; mouse.pressed = false; mouse.moved = false;
    // mira para a direita (a arena da caverna tem o tamanho da tela: câmera parada)
    mouse.viewX = 2000; mouse.viewY = 270;
  }
  // cada passo recebe {keys:[], mouseDown, mousePressed, aimY}
  function run(script, n, extra) {
    setup();
    if (extra) extra();
    const out = [];
    for (let i = 0; i < n; i++) {
      const s = script(i) || {};
      for (const k in keys) keys[k] = false;
      for (const k of s.keys || []) keys[k] = true;
      for (const k of s.pressed || []) keyPressed[k] = true;
      mouse.down = !!s.mouseDown; mouse.pressed = !!s.mousePressed;
      mouse.viewY = player.y;   // mira sempre na horizontal, para a direita
      if (game.hitStopMs > 0) { game.hitStopMs -= DTMS; out.push(null); continue; }
      step();
      out.push({
        x: player.x, y: player.y, vx: player.vx, vy: player.vy,
        phase: player.spear.state, dashMs: player.dashMs, hitStop: game.hitStopMs,
        ex: enemies[0] ? enemies[0].x : null, evx: enemies[0] ? enemies[0].vx : null,
      });
    }
    return out;
  }
  const inertFish = () => {
    spawnFish({ x: player.x + 50, y: player.y });
    const e = enemies[0];
    e.state = "inerte";   // nenhum ramo da IA: só teto de 118, arrasto e colisão
  };
  return {
    swim: run((i) => ({ keys: i < 30 ? ["KeyD"] : [] }), 90),
    swimDiagonal: run((i) => ({ keys: i < 20 ? ["KeyD", "KeyS"] : [] }), 60),
    dash: run((i) => ({ keys: i === 0 ? ["Space"] : [] }), 40),
    dashWhileSwimming: run((i) => ({ keys: i < 25 ? ["KeyD", "KeyW"].concat(i === 12 ? ["Space"] : []) : [] }), 60),
    dashHeld: run(() => ({ keys: ["Space"] }), 160),
    tap: run((i) => ({ mouseDown: i === 0, mousePressed: i === 0 }), 40),
    charged: run((i) => ({ mouseDown: i < 45, mousePressed: i === 0 }), 90),
    halfCharge: run((i) => ({ mouseDown: i < 18, mousePressed: i === 0 }), 60),
    keyAttack: run((i) => ({ keys: i === 0 ? ["KeyJ"] : [], pressed: i === 0 ? ["KeyJ"] : [] }), 40),
    dashCancelsRecovery: run((i) => ({ mouseDown: i === 0, mousePressed: i === 0, keys: i === 14 ? ["Space"] : [] }), 50),
    hitFish: run((i) => ({ mouseDown: i === 0, mousePressed: i === 0 }), 50, inertFish),
  };
});
writeFileSync(outPath, JSON.stringify(traces));
console.log(Object.fromEntries(Object.entries(traces).map(([k, v]) => [k, v.length])));
await browser.close();
