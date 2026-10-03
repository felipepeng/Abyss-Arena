import { FISH } from "../../config/enemies/fish";
import { TAU, angLerp, len } from "../../core/math";
import { pathTarget } from "../nav";
import type { EnemyDef } from "./types";

// Peixe: persegue serpenteando, avisa (freia e trava a mira), investe em linha reta e se
// recupera. Porte do protótipo (CONTEXTO §5.1).

export const FISH_DEF: EnemyDef = {
  kind: "fish",
  stats: {
    radius: FISH.radius,
    collRadius: FISH.radius * FISH.collScale,
    hp: FISH.hp,
    drag: FISH.drag,
    contactDamage: FISH.contactDamage,
    dropChance: FISH.dropChance,
  },
  // nasce perseguindo com o cronômetro zerado: pode investir assim que chegar perto
  initial: "chase",

  init(e, w) {
    e.data.wob = w.rng.range(0, TAU);
  },

  orient(e) {
    e.ang = angLerp(e.ang, Math.atan2(e.vy, e.vx), FISH.turnLerp);
  },

  states: {
    chase: {
      maxSpeed: FISH.speed,
      // voltando da recuperação: espera um pouco antes de poder investir de novo
      enter(e, w) {
        e.t = w.rng.range(FISH.rechargeDelayMs[0], FISH.rechargeDelayMs[1]);
      },
      update(e, w, dt) {
        // distância nunca zero, como o `|| 1` do protótipo
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const dist = len(dx, dy) || 1;
        // com a rocha no meio, vai pelo desvio (ax, ay); com o caminho livre é o próprio jogador
        pathTarget(w, e);
        const ax = w.nav.wx - e.x;
        const ay = w.nav.wy - e.y;
        const ad = len(ax, ay) || 1;
        if (dist < FISH.sightR) {
          e.vx += (ax / ad) * FISH.accel * dt;
          e.vy += (ay / ad) * FISH.accel * dt;
          const wob = (e.data.wob ?? 0) + dt * FISH.wobbleRate;
          e.data.wob = wob;
          // perpendicular à direção que ele segue: serpenteia em vez de vir reto
          e.vx += -(ay / ad) * Math.sin(wob) * FISH.wobbleAccel * dt;
          e.vy += (ax / ad) * Math.sin(wob) * FISH.wobbleAccel * dt;
        } else if (len(e.vx, e.vy) < FISH.farSpeed) {
          // sem ver o jogador, vai devagar até ele em vez de ficar parado
          e.vx += (ax / ad) * FISH.accel * dt;
          e.vy += (ay / ad) * FISH.accel * dt;
        }
        // não investe contra a rocha: só avisa com o caminho até o jogador livre
        if (dist < FISH.chargeRange && e.t <= 0 && !w.nav.detour) return "telegraph";
      },
    },

    telegraph: {
      maxSpeed: FISH.speed,
      telegraph: true,
      enter(e, w) {
        e.t = FISH.telegraphMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "fish", attack: "charge" });
      },
      update(e, w, dt) {
        e.vx *= 1 - FISH.telegraphBrake * dt;
        e.vy *= 1 - FISH.telegraphBrake * dt;
        // a mira acompanha o jogador até o último passo do aviso
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const dist = len(dx, dy) || 1;
        e.dirX = dx / dist;
        e.dirY = dy / dist;
        if (e.t <= 0) return "charge";
      },
    },

    charge: {
      maxSpeed: FISH.chargeSpeed,
      harmful: true,
      enter(e, w) {
        e.t = FISH.chargeMs;
        e.vx = e.dirX * FISH.chargeSpeed;
        e.vy = e.dirY * FISH.chargeSpeed;
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "fish", attack: "charge" });
      },
      // termina antes se bater na rocha
      update(e) {
        if (e.t <= 0 || e.blockedX || e.blockedY) return "recover";
      },
    },

    recover: {
      maxSpeed: FISH.speed,
      enter(e) {
        e.t = FISH.recoverMs;
      },
      update(e, _w, dt) {
        e.vx *= 1 - FISH.recoverBrake * dt;
        e.vy *= 1 - FISH.recoverBrake * dt;
        if (e.t <= 0) return "chase";
      },
    },
  },
};
