import { PLAYER } from "../config/player";
import { SPEAR } from "../config/spear";
import { len } from "../core/math";
import { ENEMY_DEFS } from "./enemies/registry";
import type { Boss } from "./bosses/types";
import type { Enemy } from "./enemies/types";
import { dropHeal } from "./pickups";
import { isInvulnerable } from "./player";
import type { World } from "./world";

// Combate: o funil único de dano ao jogador (regra 5) e o dano da lança nas criaturas.

/**
 * TODO dano ao jogador passa por aqui. Aplica a invulnerabilidade (a de depois de ser
 * ferido e a do começo do dash) e devolve false quando o dano foi ignorado.
 */
export function hurtPlayer(w: World, amount: number, fromX: number, fromY: number): boolean {
  const p = w.player;
  if (w.playerDead || w.godMode || isInvulnerable(p)) return false;
  p.hp -= amount;
  p.invulnMs = PLAYER.hurt.invulnMs;
  // empurrão para longe da fonte, somado à velocidade
  const dx = p.x - fromX;
  const dy = p.y - fromY;
  const d = len(dx, dy) || 1;
  p.vx += (dx / d) * PLAYER.hurt.knockback;
  p.vy += (dy / d) * PLAYER.hurt.knockback;
  w.events.push({ t: "playerHurt", x: p.x, y: p.y, amount });
  if (p.hp <= 0) {
    p.hp = 0;
    w.playerDead = true;
    w.events.push({ t: "playerDied", x: p.x, y: p.y });
  }
  return true;
}

/** Aplica um acerto da lança: dano, piscada, empurrão e, se zerar a vida, morte e drop. */
export function hitEnemy(w: World, e: Enemy, damage: number, dirX: number, dirY: number): void {
  e.hp -= damage;
  e.flashMs = SPEAR.targetFlashMs;
  // criaturas maiores são empurradas menos: o peixe (r 11) leva o empurrão cheio, o
  // caranguejo (r 38) leva 32% dele. O teto de velocidade do estado corta o resto no runner.
  const m = 1 / Math.max(1, e.radius / SPEAR.knockbackRefRadius);
  e.vx += dirX * SPEAR.enemyKnockback * m;
  e.vy += dirY * SPEAR.enemyKnockback * m;
  w.events.push({ t: "spearHit", x: e.x, y: e.y, dirX, dirY, targetR: e.radius });
  if (e.hp <= 0) killEnemy(w, e);
}

/**
 * Acerto da lança num chefe. Mesmas regras do inimigo comum: o empurrão cai com o raio
 * (o Caranguejo leva 32%) e o teto de velocidade do chefe corta o resto. Chefe não solta cura.
 */
export function hitBoss(w: World, b: Boss, damage: number, dirX: number, dirY: number): void {
  b.hp -= damage;
  b.flashMs = SPEAR.targetFlashMs;
  const m = 1 / Math.max(1, b.radius / SPEAR.knockbackRefRadius);
  b.vx += dirX * SPEAR.enemyKnockback * m;
  b.vy += dirY * SPEAR.enemyKnockback * m;
  w.events.push({ t: "spearHit", x: b.x, y: b.y, dirX, dirY, targetR: b.radius });
  if (b.hp <= 0) {
    b.hp = 0;
    b.dead = true;
    w.kills++;
    w.events.push({ t: "bossDied", x: b.x, y: b.y, radius: b.radius, boss: b.kind });
  }
}

function killEnemy(w: World, e: Enemy): void {
  const def = ENEMY_DEFS[e.kind];
  w.events.push({ t: "enemyDied", x: e.x, y: e.y, radius: e.radius, kind: e.kind });
  if (def.onDeath?.(e, w)) return;
  e.dead = true;
  w.kills++;
  // capangas de chefe não soltam cura (GDD §5)
  if (!e.noDrop && w.rng.chance(def.stats.dropChance)) dropHeal(w, e.x, e.y);
}
