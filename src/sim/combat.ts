import { DUMMY } from "../config/dummy";
import { SPEAR } from "../config/spear";
import type { Dummy } from "./dummy";
import type { World } from "./world";

// Combate. No M1 só existe dano a alvo; o funil de dano ao jogador (regra 5) chega no M2,
// junto com o primeiro inimigo que ataca.

/** Aplica um acerto da lança: dano, piscada, empurrão e, se zerar a vida, morte. */
export function hitTarget(w: World, target: Dummy, damage: number, dirX: number, dirY: number): void {
  target.hp -= damage;
  target.flashMs = SPEAR.targetFlashMs;
  // criaturas maiores são empurradas menos: o peixe (r 11) leva o empurrão cheio,
  // o caranguejo (r 38) leva 32% dele
  const m = 1 / Math.max(1, target.radius / SPEAR.knockbackRefRadius);
  target.vx += dirX * SPEAR.enemyKnockback * m;
  target.vy += dirY * SPEAR.enemyKnockback * m;
  w.events.push({ t: "spearHit", x: target.x, y: target.y, dirX, dirY, targetR: target.radius });

  if (target.hp <= 0) {
    target.alive = false;
    target.respawnMs = DUMMY.respawnMs;
    w.events.push({ t: "enemyDied", x: target.x, y: target.y, radius: target.radius, kind: "dummy" });
  }
}
