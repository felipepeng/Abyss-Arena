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
    // Sorteios fixos em 0,5 (serpenteio, órbita, cronômetros): o teste de paridade fixa a
    // RNG da simulação nova no mesmo valor, e os dois lados ficam comparáveis passo a passo.
    Math.random = () => 0.5;
    // As bolhas do protótipo também sorteiam: desligadas, só a lógica de jogo consome a
    // sequência aleatória, e ela pode ser comparada com a RNG da simulação nova.
    window.bubbles = () => {};
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
      const e = enemies[0];
      const b = boss;
      out.push({
        pblocked: !!(player.blockedX || player.blockedY),
        bx: b ? b.x : null, by: b ? b.y : null, bvx: b ? b.vx : null, bvy: b ? b.vy : null,
        bstate: b ? b.state : null, bt: b ? b.t : null, bhp: b ? b.hp : null,
        bphase2: b ? b.phase2 : null, bblocked: b ? !!(b.blockedX || b.blockedY) : null,
        x: player.x, y: player.y, vx: player.vx, vy: player.vy,
        phase: player.spear.state, dashMs: player.dashMs, hitStop: game.hitStopMs,
        hp: player.hp, invulnMs: player.invulnMs, dead: game.dead, enemies: enemies.length,
        ex: e ? e.x : null, ey: e ? e.y : null, evx: e ? e.vx : null, evy: e ? e.vy : null,
        estate: e ? e.state : null, et: e ? e.t : null, ehp: e ? e.hp : null,
      });
    }
    return out;
  }
  const inertFish = () => {
    spawnFish({ x: player.x + 50, y: player.y });
    const e = enemies[0];
    e.state = "inerte";   // nenhum ramo da IA: só teto de 118, arrasto e colisão
  };
  const fishAt = (dx, dy) => () => spawnFish({ x: player.x + dx, y: player.y + dy });
  // mesmos campos do spawnCircler, mas numa posição escolhida (ele sorteia o lugar)
  const circlerAt = (dx, dy) => () => {
    enemies.push({
      id: game.nextId++, type: "circler", x: player.x + dx, y: player.y + dy, vx: 0, vy: 0,
      radius: CONFIG.circler.radius, hp: CONFIG.circler.hp, maxHp: CONFIG.circler.hp,
      state: "orbit", t: 0, orbitAng: Math.random() * Math.PI * 2, orbitDir: Math.random() < 0.5 ? -1 : 1,
      dirX: 1, dirY: 0, flash: 0, ang: 0,
    });
  };
  // Caranguejo a (dx, dy) do jogador, com a sequência aleatória a partir daqui vinda de um
  // gerador congruencial com semente. O teste usa o mesmo gerador na RNG do mundo.
  const lcg = (seed) => {
    let s = seed >>> 0;
    return () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 4294967296;
    };
  };
  const crabAt = (dx, dy, hp, seed) => () => {
    spawnBoss();
    boss.x = boss.lastX = player.x + dx;
    boss.y = boss.lastY = player.y + dy;
    if (hp) boss.hp = hp;
    Math.random = lcg(seed);
  };
  // estocadas repetidas, com carga curta
  const poke = (every) => (i) => ({ mouseDown: i % every < 3, mousePressed: i % every === 0 });
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
    // inimigos: IA, avisos, ataques, contato, funil de dano e morte
    fishAttacks: run(() => ({}), 240, fishAt(220, 0)),
    fishWhileSwimming: run((i) => ({ keys: i < 40 ? ["KeyW"] : i < 80 ? ["KeyA", "KeyS"] : [] }), 240, fishAt(180, 90)),
    fishFarAway: run(() => ({}), 60, fishAt(340, 0)),
    circlerAttacks: run(() => ({}), 300, circlerAt(150, -40)),
    // Os roteiros ficam longe das paredes: ali a colisão nova (encosta na face do bloco)
    // difere de propósito da do protótipo (empurra 1 px por vez), ARCHITECTURE §6.2.
    circlerWhileSwimming: run((i) => ({ keys: i < 60 ? ["KeyD"] : i < 100 ? ["KeyS"] : [] }), 300, circlerAt(-120, 60)),
    killFish: run(poke(25), 200, fishAt(120, 0)),
    killCircler: run(poke(25), 220, circlerAt(100, 0)),
    // Caranguejo: pensar, sortear (com reroll), investida, pinça, chamado, contato, fase 2,
    // investida dupla. O teste compara até o primeiro passo em que alguém encosta na parede.
    crabVsIdle: run(() => ({}), 600, crabAt(240, 0, 0, 1)),
    crabVsSwimmer: run((i) => ({ keys: (i % 160) < 50 ? ["KeyW"] : (i % 160) < 100 ? ["KeyS"] : [] }), 600, crabAt(-220, 40, 0, 7)),
    crabPhase2: run(poke(20), 600, crabAt(150, 0, 216, 42)),
  };
});
writeFileSync(outPath, JSON.stringify(traces));
console.log(Object.fromEntries(Object.entries(traces).map(([k, v]) => [k, v.length])));
await browser.close();
