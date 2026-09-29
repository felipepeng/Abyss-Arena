import { DUMMY } from "../../config/enemies/dummy";
import { len } from "../../core/math";
import type { EnemyDef, EnemyKind } from "./types";

// Saco de pancada (depuração). Parado, volta devagar ao ponto de origem depois de empurrado
// e, ao zerar a vida, volta cheio para lá. Usa o mesmo runner dos inimigos, então o impacto
// que ele recebe é exatamente o que um inimigo de mesmo raio e teto receberia.

function dummyDef(kind: EnemyKind, spec: (typeof DUMMY)["small" | "big"]): EnemyDef {
  return {
    kind,
    stats: {
      radius: spec.radius,
      collRadius: spec.collRadius,
      hp: spec.hp,
      drag: spec.drag,
      contactDamage: 0,
      dropChance: 0,
    },
    initial: "idle",
    init(e) {
      e.data.anchorX = e.x;
      e.data.anchorY = e.y;
    },
    onDeath(e) {
      e.hp = e.maxHp;
      e.x = e.prevX = e.data.anchorX ?? e.x;
      e.y = e.prevY = e.data.anchorY ?? e.y;
      e.vx = 0;
      e.vy = 0;
      return true;
    },
    states: {
      idle: {
        maxSpeed: spec.speed,
        update(e, _w, dt) {
          const ox = (e.data.anchorX ?? e.x) - e.x;
          const oy = (e.data.anchorY ?? e.y) - e.y;
          const od = len(ox, oy);
          if (od > DUMMY.returnDeadZone) {
            e.vx += (ox / od) * DUMMY.returnAccel * dt;
            e.vy += (oy / od) * DUMMY.returnAccel * dt;
          }
        },
      },
    },
  };
}

export const DUMMY_DEF = dummyDef("dummy", DUMMY.small);
export const DUMMY_BIG_DEF = dummyDef("dummyBig", DUMMY.big);
