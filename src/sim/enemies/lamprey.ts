import { LAMPREY } from "../../config/enemies/lamprey";
import { angLerp, clamp, len, TAU } from "../../core/math";
import { pathTarget } from "../nav";
import type { EnemyDef } from "./types";

// Lampreia: pequena e rápida, vem em enxame. Persegue direto, avisa (a boca se abre e
// brilha), morde numa arrancada curta e se recupera (GDD §6.2).

export const LAMPREY_DEF: EnemyDef = {
  kind: "lamprey",
  stats: {
    radius: LAMPREY.radius,
    collRadius: LAMPREY.radius * LAMPREY.collScale,
    hp: LAMPREY.hp,
    drag: LAMPREY.drag,
    contactDamage: LAMPREY.contactDamage,
    dropChance: LAMPREY.dropChance,
  },
  // nasce perseguindo com o cronômetro zerado: pode morder assim que chegar perto
  initial: "chase",

  init(e, w) {
    // ponto deslocado do jogador que ela persegue; se fecha ao chegar perto
    const a = w.rng.range(0, TAU);
    const r = w.rng.range(0, LAMPREY.spreadR);
    e.data.offX = Math.cos(a) * r;
    e.data.offY = Math.sin(a) * r;
  },

  orient(e) {
    e.ang = angLerp(e.ang, Math.atan2(e.vy, e.vx), LAMPREY.turnLerp);
  },

  states: {
    chase: {
      maxSpeed: LAMPREY.speed,
      enter(e, w) {
        e.t = w.rng.range(LAMPREY.rechargeDelayMs[0], LAMPREY.rechargeDelayMs[1]);
      },
      update(e, w, dt) {
        const p = w.player;
        const dist = len(p.x - e.x, p.y - e.y) || 1;
        // o deslocamento some conforme ela chega perto: de longe espalha, de perto ataca de frente
        const spread = clamp((dist - LAMPREY.attackRange) / LAMPREY.spreadFadeDist, 0, 1);
        // com a rocha entre os dois, em vez do ponto deslocado vai pelo desvio até o jogador
        pathTarget(w, e);
        const detour = w.nav.detour;
        const tx = (detour ? w.nav.wx : p.x + (e.data.offX ?? 0) * spread) - e.x;
        const ty = (detour ? w.nav.wy : p.y + (e.data.offY ?? 0) * spread) - e.y;
        const td = len(tx, ty) || 1;
        if (dist < LAMPREY.sightR) {
          e.vx += (tx / td) * LAMPREY.accel * dt;
          e.vy += (ty / td) * LAMPREY.accel * dt;
        } else if (len(e.vx, e.vy) < LAMPREY.farSpeed) {
          // sem ver o jogador, vai devagar até ele em vez de ficar parada
          e.vx += (tx / td) * LAMPREY.accel * dt;
          e.vy += (ty / td) * LAMPREY.accel * dt;
        }
        if (dist < LAMPREY.attackRange && e.t <= 0 && !detour) return "telegraph";
      },
    },

    telegraph: {
      maxSpeed: LAMPREY.speed,
      telegraph: true,
      enter(e, w) {
        e.t = LAMPREY.telegraphMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "lamprey", attack: "bite" });
      },
      update(e, w, dt) {
        e.vx *= 1 - LAMPREY.telegraphBrake * dt;
        e.vy *= 1 - LAMPREY.telegraphBrake * dt;
        // a mira acompanha o jogador até o último passo do aviso
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const d = len(dx, dy) || 1;
        e.dirX = dx / d;
        e.dirY = dy / d;
        if (e.t <= 0) return "bite";
      },
    },

    bite: {
      maxSpeed: LAMPREY.biteSpeed,
      harmful: true,
      enter(e, w) {
        e.t = LAMPREY.biteMs;
        e.vx = e.dirX * LAMPREY.biteSpeed;
        e.vy = e.dirY * LAMPREY.biteSpeed;
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "lamprey", attack: "bite" });
      },
      update(e) {
        if (e.t <= 0 || e.blockedX || e.blockedY) return "recover";
      },
    },

    recover: {
      maxSpeed: LAMPREY.speed,
      enter(e) {
        e.t = LAMPREY.recoverMs;
      },
      update(e, _w, dt) {
        e.vx *= 1 - LAMPREY.recoverBrake * dt;
        e.vy *= 1 - LAMPREY.recoverBrake * dt;
        if (e.t <= 0) return "chase";
      },
    },
  },
};
