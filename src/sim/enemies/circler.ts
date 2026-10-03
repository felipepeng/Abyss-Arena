import { CIRCLER } from "../../config/enemies/circler";
import { len, TAU } from "../../core/math";
import { pathTarget } from "../nav";
import type { EnemyDef } from "./types";

// Circulador: orbita o jogador, avisa (freia e trava a mira), dá uma estocada curta e
// descansa. Porte do protótipo (CONTEXTO §5.2).

export const CIRCLER_DEF: EnemyDef = {
  kind: "circler",
  stats: {
    radius: CIRCLER.radius,
    collRadius: CIRCLER.radius * CIRCLER.collScale,
    hp: CIRCLER.hp,
    drag: CIRCLER.drag,
    contactDamage: CIRCLER.contactDamage,
    dropChance: CIRCLER.dropChance,
  },
  initial: "orbit",

  init(e, w) {
    e.data.orbitAng = w.rng.range(0, TAU);
    // sentido da órbita sorteado no nascimento
    e.data.orbitDir = w.rng.next() < 0.5 ? -1 : 1;
  },

  orient(e, dt) {
    e.ang += dt * CIRCLER.spinRate;
  },

  states: {
    orbit: {
      maxSpeed: CIRCLER.speed,
      // voltando do descanso: recalcula o ângulo da órbita a partir da posição atual, para
      // não "teleportar" o ponto que ele persegue
      enter(e, w) {
        e.t = w.rng.range(CIRCLER.orbitDelayMs[0], CIRCLER.orbitDelayMs[1]);
        e.data.orbitAng = Math.atan2(e.y - w.player.y, e.x - w.player.x);
      },
      update(e, w, dt) {
        const p = w.player;
        const ang = (e.data.orbitAng ?? 0) + CIRCLER.orbitSpeed * (e.data.orbitDir ?? 1) * dt;
        e.data.orbitAng = ang;
        // com a rocha entre os dois, em vez do ponto da órbita vai pelo desvio até o jogador
        pathTarget(w, e);
        const detour = w.nav.detour;
        const ox = (detour ? w.nav.wx : p.x + Math.cos(ang) * CIRCLER.orbitR) - e.x;
        const oy = (detour ? w.nav.wy : p.y + Math.sin(ang) * CIRCLER.orbitR) - e.y;
        const od = len(ox, oy) || 1;
        e.vx += (ox / od) * CIRCLER.accel * dt;
        e.vy += (oy / od) * CIRCLER.accel * dt;
        const d = len(p.x - e.x, p.y - e.y) || 1;
        if (e.t <= 0 && d < CIRCLER.orbitR * CIRCLER.windupRangeScale && !detour) return "windup";
      },
    },

    windup: {
      maxSpeed: CIRCLER.speed,
      telegraph: true,
      enter(e, w) {
        e.t = CIRCLER.windupMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "circler", attack: "strike" });
      },
      update(e, w, dt) {
        e.vx *= 1 - CIRCLER.windupBrake * dt;
        e.vy *= 1 - CIRCLER.windupBrake * dt;
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const d = len(dx, dy) || 1;
        e.dirX = dx / d;
        e.dirY = dy / d;
        if (e.t <= 0) return "strike";
      },
    },

    strike: {
      maxSpeed: CIRCLER.strikeSpeed,
      harmful: true,
      enter(e, w) {
        e.t = CIRCLER.strikeMs;
        e.vx = e.dirX * CIRCLER.strikeSpeed;
        e.vy = e.dirY * CIRCLER.strikeSpeed;
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "circler", attack: "strike" });
      },
      update(e) {
        if (e.t <= 0) return "rest";
      },
    },

    rest: {
      maxSpeed: CIRCLER.speed,
      enter(e) {
        e.t = CIRCLER.restMs;
      },
      update(e, _w, dt) {
        e.vx *= 1 - CIRCLER.restBrake * dt;
        e.vy *= 1 - CIRCLER.restBrake * dt;
        if (e.t <= 0) return "orbit";
      },
    },
  },
};
