import { URCHIN } from "../../config/enemies/urchin";
import { TAU } from "../../core/math";
import { fireProjectile } from "../projectiles";
import type { World } from "../world";
import type { Enemy, EnemyDef } from "./types";

// Ouriço: estático. A cada 2400 ms os espinhos crescem e piscam por 500 ms (o aviso mostra as
// 8 direções) e saem todos de uma vez. Encostar sempre dói (GDD §6.2).

const REST_MS = URCHIN.cycleMs - URCHIN.telegraphMs;

function fireSpikes(e: Enemy, w: World): void {
  for (let k = 0; k < URCHIN.spikes; k++) {
    const a = (e.data.spin ?? 0) + (k / URCHIN.spikes) * TAU;
    fireProjectile(
      w, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, a, URCHIN.spikeSpeed,
      URCHIN.spikeDamage, URCHIN.spikeRadius, URCHIN.spikeLifeMs, URCHIN.spikeColor,
      { maxDist: URCHIN.spikeRange },
    );
  }
}

export const URCHIN_DEF: EnemyDef = {
  kind: "urchin",
  stats: {
    radius: URCHIN.radius,
    collRadius: URCHIN.radius * URCHIN.collScale,
    hp: URCHIN.hp,
    drag: URCHIN.drag,
    contactDamage: URCHIN.contactDamage,
    dropChance: URCHIN.dropChance,
    fullContact: true,
    placement: "spot",
  },
  initial: "rest",

  init(e, w) {
    // cada ouriço tem o seu relógio e o seu ângulo, para dois ouriços não dispararem juntos
    e.t = w.rng.range(0, REST_MS);
    e.data.spin = w.rng.range(0, TAU / URCHIN.spikes);
  },

  states: {
    rest: {
      maxSpeed: 0,
      enter(e) {
        e.t = REST_MS;
      },
      update(e) {
        e.vx = e.vy = 0;
        if (e.t <= 0) return "telegraph";
      },
    },

    telegraph: {
      maxSpeed: 0,
      telegraph: true,
      enter(e, w) {
        e.t = URCHIN.telegraphMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "urchin", attack: "spikes" });
      },
      update(e, w) {
        e.vx = e.vy = 0;
        if (e.t > 0) return;
        fireSpikes(e, w);
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "urchin", attack: "spikes" });
        return "rest";
      },
    },
  },
};
