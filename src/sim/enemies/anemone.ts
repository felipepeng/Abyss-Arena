import { LINE_OF_SIGHT } from "../../config/combat";
import { ANEMONE } from "../../config/enemies/anemone";
import { len } from "../../core/math";
import { hurtPlayer } from "../combat";
import { rayLength } from "../geometry";
import type { World } from "../world";
import type { Enemy, EnemyDef } from "./types";

// Anêmona-chicote: presa a um coral. Descansa, avisa (o braço se ergue e brilha, com o arco da
// varredura marcado) e gira 270° com um braço de 110 px. O braço é cortado pela rocha, como o raio
// da Água-viva: o coral dá cobertura (GDD §6.2).

const SWEEP_MS = (ANEMONE.sweepRad / ANEMONE.omega) * 1000;

/** Comprimento útil do braço nesta direção: cortado pela rocha. */
const armLength = (e: Enemy, w: World, ang: number): number =>
  rayLength(w.grid, e.x, e.y, ang, ANEMONE.armLen, LINE_OF_SIGHT.stepPx);

/** Distância do ponto (px, py) ao segmento (ax, ay) → (bx, by). */
function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const abx = bx - ax;
  const aby = by - ay;
  const l2 = abx * abx + aby * aby;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / l2));
  return len(px - (ax + abx * t), py - (ay + aby * t));
}

export const ANEMONE_DEF: EnemyDef = {
  kind: "anemone",
  stats: {
    radius: ANEMONE.radius,
    collRadius: ANEMONE.radius * ANEMONE.collScale,
    hp: ANEMONE.hp,
    drag: ANEMONE.drag,
    contactDamage: ANEMONE.contactDamage,
    dropChance: ANEMONE.dropChance,
    placement: "spot",
  },
  initial: "rest",

  init(e, w) {
    // cada anêmona tem o seu relógio: duas na onda não varrem juntas
    e.t = w.rng.range(0, ANEMONE.restMs);
    // campos que o desenho lê: sempre números (o slot vem com NaN)
    e.data.dir = 1;
    e.data.arm0 = 0;
    e.data.armAng = 0;
    e.data.armLen = 0;
  },

  states: {
    rest: {
      maxSpeed: 0,
      enter(e) {
        e.t = ANEMONE.restMs;
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
        e.t = ANEMONE.telegraphMs;
        e.data.dir = w.rng.next() < 0.5 ? -1 : 1;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "anemone", attack: "sweep" });
      },
      update(e, w) {
        e.vx = e.vy = 0;
        // o arco acompanha o jogador até o último passo do aviso e o tem no meio: o braço passa
        // por onde ele está depois de 135° (~1,2 s), tempo de sair do alcance ou de atravessá-lo
        // no dash. Só a cunha de 90° do lado oposto do arco não é varrida
        const aim = Math.atan2(w.player.y - e.y, w.player.x - e.x);
        const dir = e.data.dir ?? 1;
        const arm0 = aim - (dir * ANEMONE.sweepRad) / 2;
        e.data.arm0 = arm0;
        e.data.armAng = arm0;
        e.data.armLen = armLength(e, w, arm0);
        if (e.t <= 0) return "sweep";
      },
    },

    sweep: {
      maxSpeed: 0,
      harmful: true,
      enter(e, w) {
        e.t = SWEEP_MS;
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "anemone", attack: "sweep", size: ANEMONE.armLen });
      },
      update(e, w, dt) {
        e.vx = e.vy = 0;
        const dir = e.data.dir ?? 1;
        const ang = (e.data.armAng ?? 0) + dir * ANEMONE.omega * dt;
        const l = armLength(e, w, ang);
        e.data.armAng = ang;
        e.data.armLen = l;
        const p = w.player;
        if (!w.playerDead) {
          const d = distToSegment(p.x, p.y, e.x, e.y, e.x + Math.cos(ang) * l, e.y + Math.sin(ang) * l);
          // a invulnerabilidade do funil de dano garante uma pancada só por passada do braço
          if (d <= p.radius + ANEMONE.armRadius) hurtPlayer(w, ANEMONE.contactDamage, e.x, e.y);
        }
        if (e.t <= 0) return "rest";
      },
    },
  },
};
