import { it } from "vitest";
import { PROJECTILES } from "../../src/config/combat";
import { debugSkipToBoss } from "../../src/sim/phase";
import { fireProjectile } from "../../src/sim/projectiles";
import { createMapWorld, stepWorld } from "../../src/sim/world";
import { ABYSS } from "../../src/world/maps/abyss";
import { Bot, SKILLS } from "./bot";
import { STEP } from "./harness";

// M8: o custo da simulação no pico de projéteis do Olho. O render é medido no navegador
// (ver ROADMAP); aqui só o passo, que roda 60 vezes por segundo em cima do render.

const pctile = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(xs.length * p))] as number;

it("pico real de projéteis numa luta contra o Olho", () => {
  const rows: string[] = [];
  for (const frac of [0.9, 0.5, 0.2]) {
    let peak = 0;
    let sum = 0;
    let n = 0;
    for (const seed of [1, 2, 3, 4]) {
      const w = createMapWorld(ABYSS, seed);
      const bot = new Bot(SKILLS.veterano);
      debugSkipToBoss(w);
      w.player.hp = 1e9;
      const boss = w.phase?.boss;
      if (!boss) throw new Error("sem chefe");
      let started = false;
      for (let i = 0; i < 90 * 60; i++) {
        if (w.hitStopMs > 0) { w.hitStopMs -= STEP; continue; }
        if (boss.active && !started) { boss.hp = boss.maxHp * frac; started = true; }
        stepWorld(w, bot.intent(w), STEP);
        if (started) boss.hp = boss.maxHp * frac;
        peak = Math.max(peak, w.projectiles.count);
        sum += w.projectiles.count;
        n++;
      }
    }
    rows.push(`fase com vida ${Math.round(frac * 100)}%: pico ${peak} projéteis, média ${(sum / n).toFixed(0)}`);
  }
  console.log("\n" + rows.join("\n"));
});

it("custo do passo da simulação com o pool cheio", () => {
  const w = createMapWorld(ABYSS, 1);
  debugSkipToBoss(w);
  w.godMode = true;
  for (let i = 0; i < 200 && !w.phase?.boss?.active; i++) stepWorld(w, { ...bot0(w) }, STEP);
  const fill = (count: number) => {
    // projéteis lentos e de vida longa, espalhados pelo mapa: o pior caso de trabalho por passo
    while (w.projectiles.count < count) {
      const a = w.projectiles.count * 0.37;
      fireProjectile(w, 200 + (w.projectiles.count * 53) % (w.grid.width - 400), 200 + (w.projectiles.count * 31) % (w.grid.height - 400), a, 30, 8, 5, 60_000, "#fff");
    }
  };
  for (const count of [0, 100, 300, 600, PROJECTILES.maxAlive]) {
    w.projectiles.clear?.();
    fill(count);
    const times: number[] = [];
    for (let i = 0; i < 600; i++) {
      // repõe os que sumiram, para o pool ficar no tamanho pedido
      fill(count);
      const t0 = performance.now();
      stepWorld(w, bot0(w), STEP);
      times.push((performance.now() - t0) * 1000);
    }
    console.log(`pool ${String(w.projectiles.count).padStart(4)}: passo médio ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(0)} µs, p99 ${pctile(times, 0.99).toFixed(0)} µs, máximo ${Math.max(...times).toFixed(0)} µs (orçamento de um quadro: 16667 µs)`);
  }
});

function bot0(w: ReturnType<typeof createMapWorld>) {
  return new Bot(SKILLS.veterano).intent(w);
}
