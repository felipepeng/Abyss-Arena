import { JELLY } from "../../src/config/bosses/jelly";
import { BOSS_DEFS } from "../../src/sim/bosses/registry";
import type { BossPhase } from "../../src/sim/bosses/types";

// A Água-viva do protótipo, congelada. O jogo depois a deixou mais difícil (3 fases, mais vida,
// pausas menores, ataques mais rápidos) e acrescentou ataques (onda de choque, chamado, farol),
// mas o CÓDIGO dos ataques antigos (anel, raio, sucção) continua o do protótipo. A paridade
// passo a passo (tests/sim/parity.test.ts) roda com estes números originais: assim ela continua
// provando que o porte é fiel, e mudar o equilíbrio do jogo não a quebra.

type Loose = Record<string, unknown>;

const PROTO_CONFIG: Loose = {
  pulseRate: [2.2, 3.6],
  // o protótipo não tinha velocidade por fase nem vagar: ela sempre pairava sobre o jogador
  speedByPhase: [80],
  roam: { enabled: 0 },
  phaseBelow: [1, 0.5],
  thinkMs: [800, 440],
  ring: { telegraphMs: [620, 440], count: [14, 20], waves: [1, 3], waveGapMs: 190, speed: 195, damage: [11] },
  beam: { telegraphMs: [700, 520], sweepMs: [1100, 1400], sweepSpeed: [0.85, 1.0], damage: [16] },
  pull: { telegraphMs: [520], stingerEveryMs: [150] },
};

const PROTO_HP = 380;

const PROTO_PHASES: readonly BossPhase[] = [
  { hpBelow: 1, thinkMs: 800, pool: ["ring", "beam", "pull"], rerollRepeatChance: 0.6 },
  { hpBelow: 0.5, thinkMs: 440, pool: ["ring", "beam", "ring", "beam", "pull"], rerollRepeatChance: 0.6 },
];

/** Troca os campos de `target` pelos de `patch` (recursivo) e devolve a função que desfaz. */
function patch(target: Loose, over: Loose): () => void {
  const undo: (() => void)[] = [];
  for (const [key, value] of Object.entries(over)) {
    const old = target[key];
    if (value && typeof value === "object" && !Array.isArray(value)) {
      undo.push(patch(old as Loose, value as Loose));
    } else {
      target[key] = value;
      undo.push(() => {
        target[key] = old;
      });
    }
  }
  return () => undo.reverse().forEach((u) => u());
}

/** Põe a Água-viva do protótipo no lugar da atual. Devolve a função que desfaz. */
export function usePrototypeJelly(): () => void {
  const def = BOSS_DEFS.jelly as unknown as { stats: { hp: number }; phases: readonly BossPhase[] };
  const undoConfig = patch(JELLY as unknown as Loose, PROTO_CONFIG);
  const oldHp = def.stats.hp;
  const oldPhases = def.phases;
  def.stats.hp = PROTO_HP;
  def.phases = PROTO_PHASES;
  return () => {
    undoConfig();
    def.stats.hp = oldHp;
    def.phases = oldPhases;
  };
}
