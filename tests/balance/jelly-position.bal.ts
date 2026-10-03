import { it } from "vitest";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, stepWorld } from "../../src/sim/world";
import { CORAL } from "../../src/world/maps/coral";
import { Bot, SKILLS } from "./bot";
import { STEP, mean } from "./harness";

// Onde a Água-viva fica em relação ao jogador: "acima dele" o tempo todo era o problema da luta
// fácil. Mede, com o robô lutando 60 s por fase, a fração do tempo em cada lado e o quanto
// o ângulo dela em volta do jogador varia (0 = sempre do mesmo lado; 1 = todos os lados).

const SEEDS = Array.from({ length: 10 }, (_, i) => i + 1);

function sample(seed: number, frac: number) {
  const w = createMapWorld(CORAL, seed);
  const bot = new Bot(SKILLS.veterano);
  debugSkipToBoss(w);
  w.player.hp = 1e6;
  const boss = w.phase?.boss;
  if (!boss) throw new Error("sem chefe");
  let started = false;
  let above = 0, below = 0, left = 0, right = 0, n = 0, sx = 0, sy = 0, dist = 0, top = 0;
  for (let i = 0; i < 60 * 90 && n < 60 * 60; i++) {
    if (w.hitStopMs > 0) { w.hitStopMs -= STEP; continue; }
    if (boss.active && !started) { boss.hp = boss.maxHp * frac; started = true; }
    stepWorld(w, bot.intent(w), STEP);
    if (!started) continue;
    boss.hp = boss.maxHp * frac;
    // espera a parede cair (e a pausa da troca de fase) antes de medir
    if (frac < 0.65 && w.timeMs < 0) continue;
    const dx = boss.x - w.player.x;
    const dy = boss.y - w.player.y;
    const d = Math.hypot(dx, dy) || 1;
    if (dy < -25) above++;
    if (dy > 25) below++;
    if (dx < -25) left++;
    if (dx > 25) right++;
    sx += dx / d; sy += dy / d; dist += d;
    if (boss.y < 200) top++;
    n++;
  }
  // comprimento médio do vetor unitário: 1 = sempre na mesma direção, 0 = todas por igual
  const r = Math.hypot(sx / n, sy / n);
  return { above: above / n, below: below / n, left: left / n, right: right / n, spread: 1 - r, dist: dist / n, top: top / n };
}

it("Água-viva: posição em relação ao jogador", () => {
  const lines: string[] = [];
  for (const [label, frac] of [["fase 1", 0.9], ["fase 2", 0.5], ["fase 3", 0.2]] as const) {
    const rs = SEEDS.map((s) => sample(s, frac));
    const f = (k: keyof (typeof rs)[number]) => (mean(rs.map((r) => r[k])) * 100).toFixed(0).padStart(3) + "%";
    lines.push(`${label}: acima ${f("above")}  abaixo ${f("below")}  esquerda ${f("left")}  direita ${f("right")}  | variação do ângulo ${mean(rs.map((r) => r.spread)).toFixed(2)}  | distância média ${mean(rs.map((r) => r.dist)).toFixed(0)} px  | colada no teto (y<200) ${f("top")}`);
  }
  console.log("\n" + lines.join("\n"));
});
