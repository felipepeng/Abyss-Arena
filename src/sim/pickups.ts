import { HEAL } from "../config/pickups";
import { PLAYER } from "../config/player";
import { len, TAU } from "../core/math";
import { resetBody, UNSET, type Body } from "./body";
import { moveBody } from "./collision";
import type { World } from "./world";

// Bolha de cura (GDD §5). Sobe devagar oscilando, é puxada quando o jogador chega perto e
// cura ao ser tocada. É a única cura do jogo.

export interface HealPickup extends Body {
  life: number;
  /** Fase da oscilação lateral. */
  wob: number;
  dead: boolean;
}

export function makeHealSlot(): HealPickup {
  // os campos numéricos nascem double; são todos escritos em `dropHeal` (ver sim/body.ts)
  const F = UNSET;
  return {
    x: F, y: F, vx: F, vy: F, prevX: F, prevY: F, radius: F, collR: F,
    blockedX: false, blockedY: false, life: F, wob: F, dead: false,
  };
}

export function dropHeal(w: World, x: number, y: number): void {
  const h = w.pickups.obtain();
  if (!h) return;
  resetBody(h, x, y, HEAL.radius, HEAL.radius);
  h.life = HEAL.lifeMs;
  h.wob = w.rng.range(0, TAU);
  h.dead = false;
}

export function stepPickups(w: World, dtMs: number): void {
  const dt = dtMs / 1000;
  const p = w.player;
  const pool = w.pickups;
  for (let i = pool.count - 1; i >= 0; i--) {
    const h = pool.get(i);
    h.prevX = h.x;
    h.prevY = h.y;
    h.life -= dtMs;
    if (h.life <= 0) {
      pool.removeAt(i);
      continue;
    }
    const dx = p.x - h.x;
    const dy = p.y - h.y;
    const d = len(dx, dy);
    if (!w.playerDead && d < HEAL.attractR && d > 0) {
      h.vx = (dx / d) * HEAL.attractSpeed;
      h.vy = (dy / d) * HEAL.attractSpeed;
    } else {
      h.wob += HEAL.wobbleRate * dt;
      h.vx = Math.sin(h.wob) * HEAL.wobbleSpeed;
      h.vy = -HEAL.riseSpeed;
    }
    moveBody(h, w.grid, dt);

    if (!w.playerDead && len(p.x - h.x, p.y - h.y) < HEAL.collectR) {
      const amount = Math.min(HEAL.amount, PLAYER.hp - p.hp);
      p.hp += amount;
      w.events.push({ t: "pickup", x: h.x, y: h.y, amount });
      pool.removeAt(i);
    }
  }
}
