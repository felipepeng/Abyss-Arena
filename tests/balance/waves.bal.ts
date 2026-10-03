import { describe, it } from "vitest";
import { MAP_LIST } from "../../src/world/maps/registry";
import { SKILLS } from "./bot";
import { playPhase } from "./harness";

// A vida do jogador-robô ao fim de cada onda, com as levas (GDD §3.1). Serve para comparar uma
// mudança nas ondas com a anterior, não para dizer se está justo: o robô joga pior que uma pessoa.
// (O Leito fica de fora enquanto o robô não vence o Ermitão blindado: nenhuma onda dele termina.)

const SEEDS = [1, 2, 3, 4, 5, 6];

describe("vida do robô ao fim de cada onda", () => {
  for (const map of MAP_LIST) {
    it(map.id, () => {
      const rows: string[] = [];
      for (const seed of SEEDS) {
        const r = playPhase(map, seed, SKILLS.regular, { maxMs: 4 * 60_000 });
        rows.push(
          `  semente ${seed}: vida ${r.hpAfterWave.map((h) => h.toFixed(0)).join(" → ") || "-"}  dano ${r.damageTaken}  curas ${r.heals}  ${r.diedAt ? "morreu na " + r.diedAt : r.outcome}`,
        );
      }
      console.log(`\n${map.id}\n${rows.join("\n")}`);
    });
  }
});
