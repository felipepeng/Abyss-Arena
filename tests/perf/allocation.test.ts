import { PerformanceObserver } from "node:perf_hooks";
import { getHeapStatistics } from "node:v8";
import { expect, it } from "vitest";
import { TAU } from "../../src/core/math";
import { spawnEnemy } from "../../src/sim/enemies/runner";
import { fireProjectile } from "../../src/sim/projectiles";
import { stepWorld, type World } from "../../src/sim/world";
import { intent, openGrid, openWorld, STEP } from "../sim/helpers";

// Critério do M2: nenhuma alocação por passo com 100+ projéteis. O que o teste garante: o
// passo NÃO aloca por projétil. O custo por passo é o mesmo com 0 e com 300 projéteis.
//
// Não é zero absoluto, e de propósito: o V8 empacota números fracionários passados como
// argumento entre funções que ele não embute (o `dt`, por exemplo), alguns bytes por criatura
// por passo, de vida curtíssima. Zerar isso exigiria distorcer o código todo; o que o
// protótipo fazia (um `filter` e um `concat` por passo, CONTEXTO §7.4 item 8) acabou.
//
// Como medir (cada cuidado já deu leitura errada):
// - o V8 não expõe um contador de bytes alocados; a medida é o crescimento do heap num trecho
//   sem coleta de lixo, confirmado por um observador de coletas;
// - as notificações de coleta chegam de forma assíncrona: é preciso esperar antes de ler;
// - aquecimento longo: código ainda não otimizado pelo JIT empacota todo número intermediário;
// - o objeto de intenção é fixo, para não medir o lixo do próprio teste.
//
// O que foi achado assim e corrigido: `Math.hypot` aloca a cada chamada (trocado por `len`);
// campos numéricos que nascem com 0 ficam com representação genérica e empacotam cada
// gravação (ver UNSET em sim/body.ts); `delete` e variáveis de módulo também empacotam.

const WARMUP_STEPS = 20000;
const MEASURED_STEPS = 2000;

function world(projectiles: number): World {
  const w = openWorld({ grid: openGrid(140, 90), start: { x: 1400, y: 900 } });
  w.godMode = true;
  // projéteis parados (o caminho de código é o mesmo), longe do jogador e das paredes
  for (let i = 0; i < projectiles; i++) {
    const a = (i / projectiles) * TAU;
    fireProjectile(w, 700 + Math.cos(a) * 200, 700 + Math.sin(a) * 200, a, 0, 1, 5, 1e9, "#fff");
  }
  for (let i = 0; i < 4; i++) spawnEnemy(w, "fish", 300 + i * 60, 300);
  spawnEnemy(w, "circler", 1500, 900);
  return w;
}

async function bytesPerStep(w: World): Promise<{ perStep: number; gcs: number }> {
  const it = intent({ aimX: 2000, aimY: 900, moveX: 1 });
  const run = (n: number) => {
    for (let i = 0; i < n; i++) {
      it.moveX = i % 120 < 60 ? 1 : -1;
      stepWorld(w, it, STEP);
    }
  };
  run(WARMUP_STEPS);
  let gcs = 0;
  const obs = new PerformanceObserver((list) => (gcs += list.getEntries().length));
  obs.observe({ entryTypes: ["gc"] });
  await new Promise((r) => setTimeout(r, 20));
  gcs = 0;
  const before = getHeapStatistics().used_heap_size;
  run(MEASURED_STEPS);
  const after = getHeapStatistics().used_heap_size;
  await new Promise((r) => setTimeout(r, 20));
  obs.disconnect();
  return { perStep: (after - before) / MEASURED_STEPS, gcs };
}

it("o passo da simulação não aloca por projétil (0 contra 300 projéteis)", async () => {
  const none = world(0);
  const many = world(300);
  const a = await bytesPerStep(none);
  const b = await bytesPerStep(many);
  expect(many.projectiles.count).toBe(300);
  // com uma coleta no meio, o crescimento do heap não mede nada
  expect(a.gcs).toBe(0);
  expect(b.gcs).toBe(0);
  // Meio byte por projétil por passo já daria 150 B de diferença. Uma alocação de verdade
  // por projétil (um número empacotado, um array) daria vários KB.
  expect(b.perStep - a.perStep).toBeLessThan(64);
});
