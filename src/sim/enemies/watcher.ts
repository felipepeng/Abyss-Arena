import { WATCHER } from "../../config/enemies/watcher";
import { angLerp, len } from "../../core/math";
import { fireProjectile } from "../projectiles";
import { canSee } from "./perception";
import type { EnemyDef } from "./types";

// Vigia: olho com pedúnculo. Mantém ~320 px do jogador, recua se ele chegar perto, e atira 3
// projéteis em leque depois de um aviso (a pupila contrai e aparece um setor de 0,6 rad). Só
// atira com linha de visão: os pilares são cobertura (GDD §6.2).

export const WATCHER_DEF: EnemyDef = {
  kind: "watcher",
  stats: {
    radius: WATCHER.radius,
    collRadius: WATCHER.radius * WATCHER.collScale,
    hp: WATCHER.hp,
    drag: WATCHER.drag,
    contactDamage: WATCHER.contactDamage,
    dropChance: WATCHER.dropChance,
    fullContact: true,
  },
  initial: "keep",

  init(e, w) {
    e.data.strafeDir = w.rng.next() < 0.5 ? -1 : 1;
    e.t = w.rng.range(WATCHER.cooldownMs[0], WATCHER.cooldownMs[1]);
    e.ang = e.prevAng = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  },

  states: {
    keep: {
      maxSpeed: WATCHER.speed,
      enter(e, w) {
        e.t = w.rng.range(WATCHER.cooldownMs[0], WATCHER.cooldownMs[1]);
      },
      update(e, w, dt) {
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const dist = len(dx, dy) || 1;
        e.ang = angLerp(e.ang, Math.atan2(dy, dx), WATCHER.turnLerp);
        // aproxima se longe; recua com mais força se perto; nada dentro da faixa
        const raw = (dist - WATCHER.keepDist) / WATCHER.keepBand;
        const radial = Math.max(-1, Math.min(1, raw)) * (raw < 0 ? WATCHER.retreatBoost : 1);
        e.vx += (dx / dist) * radial * WATCHER.accel * dt;
        e.vy += (dy / dist) * radial * WATCHER.accel * dt;
        // dá a volta no jogador, o que também o tira de trás de um pilar
        const s = (e.data.strafeDir ?? 1) * WATCHER.strafeAccel * WATCHER.accel * dt;
        e.vx += (-dy / dist) * s;
        e.vy += (dx / dist) * s;
        if (e.t <= 0 && canSee(e, w, WATCHER.sightR)) return "telegraph";
      },
    },

    telegraph: {
      maxSpeed: WATCHER.speed,
      telegraph: true,
      enter(e, w) {
        e.t = WATCHER.telegraphMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "watcher", attack: "fan" });
      },
      update(e, w, dt) {
        e.vx *= 1 - WATCHER.telegraphBrake * dt;
        e.vy *= 1 - WATCHER.telegraphBrake * dt;
        // a mira acompanha o jogador até o último passo do aviso
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const dist = len(dx, dy) || 1;
        e.dirX = dx / dist;
        e.dirY = dy / dist;
        e.ang = Math.atan2(dy, dx);
        if (e.t > 0) return;
        for (let k = 0; k < WATCHER.shots; k++) {
          const a = e.ang + (k - (WATCHER.shots - 1) / 2) * WATCHER.fanStep;
          fireProjectile(
            w, e.x + Math.cos(a) * e.radius, e.y + Math.sin(a) * e.radius, a, WATCHER.shotSpeed,
            WATCHER.shotDamage, WATCHER.shotRadius, WATCHER.shotLifeMs, WATCHER.shotColor,
          );
        }
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "watcher", attack: "fan" });
        return "keep";
      },
    },
  },
};
