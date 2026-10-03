import { it } from "vitest";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, stepWorld } from "../../src/sim/world";
import { CORAL } from "../../src/world/maps/coral";
import { Bot, SKILLS } from "./bot";
import { STEP, mean } from "./harness";

// De onde vem o dano da Água-viva: por ataque, em cada fase (o dano é atribuído ao último ataque
// que começou). Serve para achar o ataque que não pesa e o que pesa demais.

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const FRACS: readonly [string, number][] = [["fase 1", 0.9], ["fase 2", 0.5], ["fase 3", 0.2]];

function run(seed: number, frac: number, seconds: number) {
  const w = createMapWorld(CORAL, seed);
  const bot = new Bot(SKILLS.veterano);
  debugSkipToBoss(w);
  w.player.hp = 1e6;
  const boss = w.phase?.boss;
  if (!boss) throw new Error("sem chefe");
  const dmg = new Map<string, number>();
  const starts = new Map<string, number>();
  const busy = new Map<string, number>();
  let last = "";
  let started = false;
  let elapsed = 0;
  for (let i = 0; i < 60 * 300 && elapsed < seconds * 1000; i++) {
    if (w.hitStopMs > 0) { w.hitStopMs -= STEP; if (started) elapsed += STEP; continue; }
    if (boss.active && !started) { boss.hp = boss.maxHp * frac; started = true; }
    stepWorld(w, bot.intent(w), STEP);
    if (started) { boss.hp = boss.maxHp * frac; elapsed += STEP; if (boss.state !== "think") busy.set(boss.attack, (busy.get(boss.attack) ?? 0) + STEP); }
    for (const e of w.events.list) {
      if (e.t === "attackStart" && e.source === "jelly") { last = e.attack; starts.set(last, (starts.get(last) ?? 0) + 1); }
      if (e.t === "playerHurt") dmg.set(last || "contato", (dmg.get(last || "contato") ?? 0) + e.amount);
    }
  }
  return { dmg, starts, busy };
}

it("Água-viva: dano por ataque", () => {
  const lines: string[] = [];
  for (const [label, frac] of FRACS) {
    const runs = SEEDS.map((s) => run(s, frac, 60));
    const names = new Set<string>();
    for (const r of runs) for (const k of [...r.dmg.keys(), ...r.starts.keys()]) names.add(k);
    const rows = [...names].map((n) => ({
      n,
      dmg: mean(runs.map((r) => r.dmg.get(n) ?? 0)),
      starts: mean(runs.map((r) => r.starts.get(n) ?? 0)),
      busy: mean(runs.map((r) => (r.busy.get(n) ?? 0) / 1000)),
    })).sort((a, b) => b.dmg - a.dmg);
    lines.push(`${label} (vida ${Math.round(frac * 100)}%): total ${rows.reduce((s, r) => s + r.dmg, 0).toFixed(0)}/min`);
    for (const r of rows) lines.push(`   ${r.n.padEnd(11)} dano ${r.dmg.toFixed(0).padStart(4)}   usos ${r.starts.toFixed(1).padStart(4)}   tempo em ataque ${r.busy.toFixed(1).padStart(5)} s`);
  }
  console.log("\n" + lines.join("\n"));
});
