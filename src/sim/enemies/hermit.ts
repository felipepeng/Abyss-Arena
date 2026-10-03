import { HERMIT } from "../../config/enemies/hermit";
import { angDiff, len } from "../../core/math";
import { hurtPlayer } from "../combat";
import { pathTarget } from "../nav";
import type { World } from "../world";
import type { Enemy, EnemyDef } from "./types";

// Ermitão: persegue devagar, avisa (a pinça se abre e brilha), golpeia à frente e se recupera.
// A frente dele é blindada: um acerto de lança dentro de ±60° é bloqueado. Ele só gira a
// 1,8 rad/s, então o jogador vence circulando (GDD §6.2).

/** Vira a frente para o jogador, no máximo `turnRate`. */
function faceTarget(e: Enemy, w: World, dt: number): void {
  const target = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  const d = angDiff(e.ang, target);
  const max = HERMIT.turnRate * dt;
  e.ang += Math.abs(d) <= max ? d : Math.sign(d) * max;
}

export const HERMIT_DEF: EnemyDef = {
  kind: "hermit",
  stats: {
    radius: HERMIT.radius,
    collRadius: HERMIT.radius * HERMIT.collScale,
    hp: HERMIT.hp,
    drag: HERMIT.drag,
    contactDamage: HERMIT.contactDamage,
    dropChance: HERMIT.dropChance,
  },
  initial: "chase",

  init(e, w) {
    // nasce olhando para o jogador (prevAng junto, para o render não girar no primeiro quadro)
    e.ang = e.prevAng = Math.atan2(w.player.y - e.y, w.player.x - e.x);
  },

  onHit(e, w) {
    const toPlayer = Math.atan2(w.player.y - e.y, w.player.x - e.x);
    return Math.abs(angDiff(e.ang, toPlayer)) <= HERMIT.frontHalfArc ? "block" : "damage";
  },

  states: {
    chase: {
      maxSpeed: HERMIT.speed,
      enter(e, w) {
        e.t = w.rng.range(HERMIT.rechargeDelayMs[0], HERMIT.rechargeDelayMs[1]);
      },
      update(e, w, dt) {
        faceTarget(e, w, dt);
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const dist = len(dx, dy) || 1;
        pathTarget(w, e);
        const ax = w.nav.wx - e.x;
        const ay = w.nav.wy - e.y;
        const ad = len(ax, ay) || 1;
        if (dist > HERMIT.holdDist) {
          e.vx += (ax / ad) * HERMIT.accel * dt;
          e.vy += (ay / ad) * HERMIT.accel * dt;
        }
        if (dist < HERMIT.attackRange && e.t <= 0 && !w.nav.detour) return "telegraph";
      },
    },

    telegraph: {
      maxSpeed: HERMIT.speed,
      telegraph: true,
      enter(e, w) {
        e.t = HERMIT.telegraphMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "hermit", attack: "claw" });
      },
      update(e, w, dt) {
        e.vx *= 1 - HERMIT.telegraphBrake * dt;
        e.vy *= 1 - HERMIT.telegraphBrake * dt;
        // continua girando, a 1,8 rad/s: quem contorna durante o aviso sai da linha do golpe
        faceTarget(e, w, dt);
        if (e.t <= 0) return "strike";
      },
    },

    strike: {
      maxSpeed: HERMIT.speed,
      harmful: true,
      enter(e, w) {
        e.t = HERMIT.strikeMs;
        e.dirX = Math.cos(e.ang);
        e.dirY = Math.sin(e.ang);
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "hermit", attack: "claw", size: HERMIT.strikeReach });
      },
      update(e, w, dt) {
        e.vx *= 1 - HERMIT.telegraphBrake * dt;
        e.vy *= 1 - HERMIT.telegraphBrake * dt;
        // a pinça alcança `strikeReach` do centro até a borda do jogador, dentro do arco da
        // frente. A invulnerabilidade do funil de dano garante um golpe só por ataque.
        const p = w.player;
        const dx = p.x - e.x;
        const dy = p.y - e.y;
        const inArc = Math.abs(angDiff(e.ang, Math.atan2(dy, dx))) <= HERMIT.frontHalfArc;
        if (!w.playerDead && inArc && len(dx, dy) - p.radius <= HERMIT.strikeReach) {
          hurtPlayer(w, HERMIT.contactDamage, e.x, e.y);
        }
        if (e.t <= 0) return "recover";
      },
    },

    recover: {
      maxSpeed: HERMIT.speed,
      enter(e) {
        e.t = HERMIT.recoverMs;
      },
      update(e, w, dt) {
        e.vx *= 1 - HERMIT.recoverBrake * dt;
        e.vy *= 1 - HERMIT.recoverBrake * dt;
        faceTarget(e, w, dt);
        if (e.t <= 0) return "chase";
      },
    },
  },
};
