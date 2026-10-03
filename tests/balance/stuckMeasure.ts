import { len } from "../../src/core/math";
import { hasLineOfSight } from "../../src/sim/geometry";
import { NO_INTENT } from "../../src/sim/player";
import { createMapWorld, stepWorld } from "../../src/sim/world";
import { MAP_LIST } from "../../src/world/maps/registry";
import { STEP } from "./harness";

// Mede quantos inimigos ficam presos atrás da rocha (usado pela bancada e por tests/sim/nav.test.ts).
// Um inimigo "preso" está vivo, longe do jogador, fora de um ataque, sem ver o jogador e quase
// parado há pelo menos STUCK_MS. O jogador fica parado (e imortal) num ponto fixo, o pior caso
// para a perseguição: quem se perde atrás de um pilar nunca se acha.

export const STUCK_MS = 2500;
const MIN_DIST = 140;
export const SEEDS = [1, 2, 3, 4, 5, 6];

interface Track {
  x: number;
  y: number;
  sinceMs: number;
}

export function measureStuck(
  mapIndex: number, seed: number, maxMs: number,
): { stuckEver: number; stuckMsTotal: number; waveMs: number[]; kinds: Record<string, number> } {
  const map = MAP_LIST[mapIndex]!;
  const w = createMapWorld(map, seed);
  w.godMode = true;
  const track = new Map<number, Track>();
  const everStuck = new Set<number>();
  const kinds: Record<string, number> = {};
  let stuckMsTotal = 0;
  const waveMs: number[] = [];
  let waveStart = 0;
  while (w.timeMs < maxMs) {
    if (w.hitStopMs > 0) {
      w.hitStopMs -= STEP;
      continue;
    }
    // o jogador não faz nada: não ataca, não nada
    stepWorld(w, NO_INTENT, STEP);
    for (const ev of w.events.list) {
      if (ev.t === "phaseChanged" && (ev.state === "interlude" || ev.state === "bossIntro")) {
        waveMs.push(w.timeMs - waveStart);
        waveStart = w.timeMs;
      }
    }
    if (w.phase?.state === "boss" || w.phase?.state === "bossIntro") break;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.get(i);
      // Ouriço e Anêmona ficam parados de propósito
      if (e.dead || !e.fromWave || e.kind === "urchin" || e.kind === "anemone") continue;
      const t = track.get(e.id);
      const moved = t ? len(e.x - t.x, e.y - t.y) : Infinity;
      // anda menos de 40 px em 1 s? Reinicia a janela quando se mexe de verdade
      if (!t || moved > 40) {
        track.set(e.id, { x: e.x, y: e.y, sinceMs: w.timeMs });
        continue;
      }
      const idle = w.timeMs - t.sinceMs;
      const far = len(w.player.x - e.x, w.player.y - e.y) > MIN_DIST;
      const attacking = e.state === "telegraph" || e.state === "charge" || e.state === "strike" || e.state === "bite";
      // sem linha de visão: parado ao alcance do jogador, atirando, não é estar preso
      const blind = !hasLineOfSight(w.grid, e.x, e.y, w.player.x, w.player.y, 8);
      if (idle > STUCK_MS && far && !attacking && blind) {
        if (!everStuck.has(e.id)) kinds[e.kind] = (kinds[e.kind] ?? 0) + 1;
        everStuck.add(e.id);
        stuckMsTotal += STEP;
      }
    }
  }
  return { stuckEver: everStuck.size, stuckMsTotal, waveMs, kinds };
}

