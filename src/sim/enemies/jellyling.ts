import { JELLYLING } from "../../config/enemies/jellyling";
import { angLerp, len, TAU } from "../../core/math";
import { fireProjectile } from "../projectiles";
import { canSee } from "./perception";
import type { EnemyDef } from "./types";

// Medusinha: flutua a ~260 px do jogador, sobe e desce, e atira um esporo mirado depois de um
// aviso (o sino incha e o núcleo brilha). Só atira com linha de visão: o coral é cobertura.
// Sem visão, desliza em volta do jogador até achar um ângulo (GDD §6.2).

export const JELLYLING_DEF: EnemyDef = {
  kind: "jellyling",
  stats: {
    radius: JELLYLING.radius,
    collRadius: JELLYLING.radius * JELLYLING.collScale,
    hp: JELLYLING.hp,
    drag: JELLYLING.drag,
    contactDamage: JELLYLING.contactDamage,
    dropChance: JELLYLING.dropChance,
    fullContact: true,
  },
  initial: "hover",

  init(e, w) {
    e.data.bob = w.rng.range(0, TAU);
    e.data.strafeDir = w.rng.next() < 0.5 ? -1 : 1;
    // não atira logo que nasce
    e.t = w.rng.range(JELLYLING.cooldownMs[0], JELLYLING.cooldownMs[1]);
  },

  orient(e) {
    // só visual: o sino se inclina para onde ela anda
    e.ang = angLerp(e.ang, Math.atan2(e.vy, e.vx), 0.1);
  },

  states: {
    hover: {
      maxSpeed: JELLYLING.speed,
      enter(e, w) {
        e.t = w.rng.range(JELLYLING.cooldownMs[0], JELLYLING.cooldownMs[1]);
      },
      update(e, w, dt) {
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const dist = len(dx, dy) || 1;
        // radial: aproxima se longe, afasta se perto, sem corrigir dentro da faixa
        const radial = Math.max(-1, Math.min(1, (dist - JELLYLING.keepDist) / JELLYLING.keepBand));
        e.vx += (dx / dist) * radial * JELLYLING.accel * dt;
        e.vy += (dy / dist) * radial * JELLYLING.accel * dt;
        // tangencial: dá a volta no jogador, o que também a tira de trás de um pilar
        const s = (e.data.strafeDir ?? 1) * JELLYLING.strafeAccel * JELLYLING.accel * dt;
        e.vx += (-dy / dist) * s;
        e.vy += (dx / dist) * s;
        // sobe e desce
        const bob = (e.data.bob ?? 0) + JELLYLING.bobRate * dt;
        e.data.bob = bob;
        e.vy += Math.sin(bob) * JELLYLING.bobAccel * dt;
        if (e.t <= 0 && canSee(e, w, JELLYLING.sightR)) return "telegraph";
      },
    },

    telegraph: {
      maxSpeed: JELLYLING.speed,
      telegraph: true,
      enter(e, w) {
        e.t = JELLYLING.telegraphMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "jellyling", attack: "spore" });
      },
      update(e, w, dt) {
        e.vx *= 1 - JELLYLING.telegraphBrake * dt;
        e.vy *= 1 - JELLYLING.telegraphBrake * dt;
        // a mira acompanha o jogador até o último passo do aviso
        const dx = w.player.x - e.x;
        const dy = w.player.y - e.y;
        const dist = len(dx, dy) || 1;
        e.dirX = dx / dist;
        e.dirY = dy / dist;
        if (e.t > 0) return;
        fireProjectile(
          w, e.x + e.dirX * e.radius, e.y + e.dirY * e.radius, Math.atan2(e.dirY, e.dirX),
          JELLYLING.shotSpeed, JELLYLING.shotDamage, JELLYLING.shotRadius, JELLYLING.shotLifeMs,
          JELLYLING.shotColor,
        );
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "jellyling", attack: "spore" });
        return "hover";
      },
    },
  },
};
