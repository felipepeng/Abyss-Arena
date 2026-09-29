import { it } from "vitest";
import { HEAL } from "../../src/config/pickups";
import { PLAYER } from "../../src/config/player";
import { ENEMY_DEFS } from "../../src/sim/enemies/registry";
import { ABYSS } from "../../src/world/maps/abyss";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";

// GDD §13 (itens 1 e 4): quanto de cura cada onda pode render e quantos inimigos ela tem.
// Análise dos números do jogo, sem simulação: o valor esperado se o jogador pegar tudo.

it("economia de cura por mapa", () => {
  const lines: string[] = [];
  for (const map of [RIFT, CORAL, ABYSS]) {
    let total = 0;
    let drops = 0;
    const rows: string[] = [];
    map.waves.forEach((wave, i) => {
      const n = wave.enemies.reduce((s, g) => s + g.count, 0);
      const d = wave.enemies.reduce((s, g) => s + g.count * ENEMY_DEFS[g.kind].stats.dropChance, 0);
      const hp = wave.enemies.reduce((s, g) => s + g.count * ENEMY_DEFS[g.kind].stats.hp, 0);
      total += d * HEAL.amount;
      drops += d;
      rows.push(`onda ${i + 1}: ${String(n).padStart(2)} inimigos, ${hp.toFixed(0).padStart(4)} de vida somada, ${d.toFixed(1)} curas (${(d * HEAL.amount).toFixed(0)} HP)`);
    });
    lines.push(`${map.titleCard.name}\n  ${rows.join("\n  ")}\n  total: ${drops.toFixed(1)} curas = ${total.toFixed(0)} HP possíveis (vida máxima ${PLAYER.hp}; cada cura ${HEAL.amount} HP, ${HEAL.lifeMs / 1000} s no chão)`);
  }
  console.log("\n" + lines.join("\n"));
});
