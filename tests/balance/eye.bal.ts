import { it } from "vitest";
import { ABYSS } from "../../src/world/maps/abyss";
import { SKILLS } from "./bot";
import { bossPressure, mean, withDashInvuln } from "./harness";

// GDD §8.3 / ROADMAP M8: o bullet hell do Olho foi calibrado sem invulnerabilidade no dash.
// Mede a pressão (dano tomado por minuto) com e sem os 100 ms de invulnerabilidade, na fase 1
// (vida 90%), 2 (50%) e 3 (20%), com o mesmo robô nas mesmas sementes.

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const PHASES: readonly [string, number][] = [["fase 1", 0.9], ["fase 2", 0.5], ["fase 3", 0.2]];

it("Olho: dano por minuto com e sem invulnerabilidade do dash", () => {
  const rows: string[] = [];
  for (const skill of [SKILLS.novato, SKILLS.regular, SKILLS.veterano, SKILLS.mestre]) {
    for (const [label, frac] of PHASES) {
      const run = (invuln: number) =>
        withDashInvuln(invuln, () => SEEDS.map((s) => bossPressure(ABYSS, s, skill, frac, 60)));
      const without = run(0);
      const withI = run(100);
      const dmgA = mean(without.map((r) => r.damagePerMin));
      const dmgB = mean(withI.map((r) => r.damagePerMin));
      const delta = dmgA === 0 ? 0 : (100 * (dmgB - dmgA)) / dmgA;
      rows.push(
        `${skill.name.padEnd(9)} ${label}  sem i-frames ${dmgA.toFixed(0).padStart(4)} /min  com ${dmgB.toFixed(0).padStart(4)} /min  (${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%)  golpes/min ${mean(without.map((r) => r.hits)).toFixed(1)} → ${mean(withI.map((r) => r.hits)).toFixed(1)}`,
      );
    }
  }
  console.log("\n" + rows.join("\n"));
});
