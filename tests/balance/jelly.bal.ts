import { it } from "vitest";
import { CORAL } from "../../src/world/maps/coral";
import { SKILLS } from "./bot";
import { bossPressure, mean } from "./harness";

// Pressão da Água-viva (dano por minuto que o robô toma, vida do chefe travada por fase), para
// comparar antes e depois de mexer na luta. Frações de vida: dentro de cada fase.

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const FRACS = (process.env.JELLY_FRACS ?? "0.9,0.3").split(",").map(Number);

it("Água-viva: pressão por fase", () => {
  const rows: string[] = [];
  for (const skill of [SKILLS.novato, SKILLS.regular, SKILLS.veterano]) {
    for (const frac of FRACS) {
      const rs = SEEDS.map((s) => bossPressure(CORAL, s, skill, frac, 60));
      rows.push(`${skill.name.padEnd(9)} vida ${String(Math.round(frac * 100)).padStart(3)}%  dano ${mean(rs.map((r) => r.damagePerMin)).toFixed(0).padStart(4)} /min  golpes ${mean(rs.map((r) => r.hits)).toFixed(1).padStart(4)} /min  dano causado ${mean(rs.map((r) => r.bossDamagePerMin)).toFixed(0).padStart(4)} /min`);
    }
  }
  console.log("\n" + rows.join("\n"));
});
