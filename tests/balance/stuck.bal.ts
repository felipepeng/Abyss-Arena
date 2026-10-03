import { describe, it } from "vitest";
import { createMapWorld, stepWorld } from "../../src/sim/world";
import { MAP_LIST } from "../../src/world/maps/registry";
import { Bot, SKILLS } from "./bot";
import { STEP } from "./harness";
import { measureStuck, SEEDS } from "./stuckMeasure";

// Quantos inimigos ficam presos atrás da rocha? Um inimigo "preso" está vivo, longe do jogador,
// fora de um ataque, sem ver o jogador e quase parado há pelo menos `STUCK_MS`. O jogador fica parado (e imortal) num
// ponto fixo, o pior caso para a perseguição: quem se perde atrás de um pilar nunca se acha.
// Imprime uma tabela por mapa; não afirma nada (npm run balance).

describe("inimigos presos (jogador parado)", () => {
  for (let m = 0; m < MAP_LIST.length; m++) {
    it(MAP_LIST[m]!.id, () => {
      const rows: string[] = [];
      let total = 0;
      for (const seed of SEEDS) {
        const r = measureStuck(m, seed, 4 * 60_000);
        total += r.stuckEver;
        rows.push(
          `  semente ${seed}: presos ${r.stuckEver} ${JSON.stringify(r.kinds)}, ondas ${r.waveMs.map((x) => (x / 1000).toFixed(0)).join("/")} s`,
        );
      }
      console.log(`\n${MAP_LIST[m]!.id}: ${total} presos em ${SEEDS.length} sementes\n${rows.join("\n")}`);
    });
  }
});

// O mesmo, com o jogador-robô nadando e lutando: quanto tempo cada onda leva até acabar. Uma onda
// que nunca acaba é um inimigo que não chega no jogador.
describe("ondas com o jogador-robô", () => {
  for (let m = 0; m < MAP_LIST.length; m++) {
    it(MAP_LIST[m]!.id, () => {
      const rows: string[] = [];
      for (const seed of SEEDS) {
        const w = createMapWorld(MAP_LIST[m]!, seed);
        w.godMode = true;
        const bot = new Bot(SKILLS.regular);
        const waveMs: number[] = [];
        let waveStart = 0;
        while (w.timeMs < 6 * 60_000 && w.phase?.state !== "bossIntro" && w.phase?.state !== "boss") {
          if (w.hitStopMs > 0) {
            w.hitStopMs -= STEP;
            continue;
          }
          stepWorld(w, bot.intent(w), STEP);
          for (const ev of w.events.list) {
            if (ev.t === "phaseChanged" && ev.state === "interlude") {
              waveMs.push(w.timeMs - waveStart);
              waveStart = w.timeMs;
            }
          }
          if (w.phase?.state === "interlude" && w.phase.t === w.phase.stateMs) waveStart = w.timeMs;
        }
        rows.push(`  semente ${seed}: ondas ${waveMs.map((x) => (x / 1000).toFixed(0)).join("/")} s${waveMs.length < 3 ? "  (NÃO TERMINOU)" : ""}`);
      }
      console.log(`\n${MAP_LIST[m]!.id}\n${rows.join("\n")}`);
    });
  }
});
