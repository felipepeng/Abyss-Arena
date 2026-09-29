import { COMBAT } from "../../config/combat";
import { len } from "../../core/math";
import { resetBody, UNSET } from "../body";
import { moveBody } from "../collision";
import { hurtPlayer } from "../combat";
import { applyDrag, clampSpeed } from "../physics";
import type { World } from "../world";
import { ENEMY_DEFS } from "./registry";
import type { Enemy, EnemyKind } from "./types";

// Runner genérico dos inimigos: o que é comum a todos os tipos. A ORDEM do passo segue o
// integrador do protótipo (CONTEXTO §5), porque ela é parte do feel:
//   piscada e cronômetro → estado (aceleração e transições) → teto de velocidade do estado →
//   orientação → arrasto → colisão → contato com o jogador.

/** Põe um inimigo no mundo. Devolve null se o pool estiver cheio. */
export function spawnEnemy(w: World, kind: EnemyKind, x: number, y: number, noDrop = false): Enemy | null {
  const e = w.enemies.obtain();
  if (!e) return null;
  const def = ENEMY_DEFS[kind];
  const s = def.stats;
  // o objeto do pool vem sujo do uso anterior: todos os campos são reescritos, um a um
  // (sem Object.assign, ver sim/body.ts)
  resetBody(e, x, y, s.radius, s.collRadius);
  e.id = w.nextId++;
  e.kind = kind;
  e.hp = s.hp;
  e.maxHp = s.hp;
  e.state = def.initial;
  e.t = 0;
  e.stateMs = 0;
  e.ang = 0;
  e.prevAng = 0;
  e.flashMs = 0;
  e.dirX = 1;
  e.dirY = 0;
  e.noDrop = noDrop;
  e.dead = false;
  // Sobrescreve em vez de apagar: `delete` põe o objeto em modo dicionário, e aí cada número
  // guardado nele aloca. UNSET, e não 0, para o campo continuar double (ver sim/body.ts).
  // Campos de outro tipo que sobrem do uso anterior do slot não são lidos por este tipo; os
  // deste tipo são escritos no `init`.
  for (const key in e.data) e.data[key] = UNSET;
  def.init?.(e, w);
  return e;
}

/** Um objeto vazio para o pool preencher em `spawnEnemy`. */
export function makeEnemySlot(): Enemy {
  // os campos numéricos nascem double: ver UNSET em sim/body.ts
  const F = UNSET;
  return {
    x: F, y: F, vx: F, vy: F, prevX: F, prevY: F, radius: F, collR: F, blockedX: false, blockedY: false,
    id: 0, kind: "fish", hp: F, maxHp: F, state: "", t: F, stateMs: F, ang: F, prevAng: F,
    flashMs: F, dirX: F, dirY: F, noDrop: false, dead: false, data: {},
  };
}

/** Troca de estado e roda o `enter` dele. */
export function setState(e: Enemy, w: World, state: string): void {
  const def = ENEMY_DEFS[e.kind];
  const next = def.states[state];
  if (!next) throw new Error(`${e.kind}: estado desconhecido "${state}"`);
  e.state = state;
  e.t = 0;
  next.enter?.(e, w);
  e.stateMs = e.t;
}

export function stepEnemies(w: World, dtMs: number): void {
  const dt = dtMs / 1000;
  const p = w.player;
  const pool = w.enemies;
  for (let i = 0; i < pool.count; i++) {
    const e = pool.get(i);
    // morto pela lança neste passo: não age mais (o protótipo ainda o deixava atacar)
    if (e.dead) continue;
    const def = ENEMY_DEFS[e.kind];
    if (e.flashMs > 0) e.flashMs -= dtMs;
    e.t -= dtMs;

    const next = def.states[e.state]?.update(e, w, dt);
    if (next) setState(e, w, next);
    const state = def.states[e.state];
    if (!state) throw new Error(`${e.kind}: estado desconhecido "${e.state}"`);

    clampSpeed(e, state.maxSpeed);
    def.orient?.(e, dt);
    applyDrag(e, def.stats.drag, dt);
    moveBody(e, w.grid, dt);

    // contato: dano cheio (e um pouco mais de alcance) durante o ataque; metade fora dele
    const dmg = def.stats.contactDamage;
    if (dmg > 0 && !w.playerDead) {
      const reach = e.radius + p.radius + (state.harmful ? COMBAT.harmfulContactReach : 0);
      if (len(p.x - e.x, p.y - e.y) < reach) {
        hurtPlayer(w, state.harmful ? dmg : Math.ceil(dmg * COMBAT.idleContactScale), e.x, e.y);
      }
    }
  }
}

/** Tira do pool os mortos do passo. No fim do passo, como o `filter` do protótipo. */
export function removeDeadEnemies(w: World): void {
  const pool = w.enemies;
  for (let i = pool.count - 1; i >= 0; i--) if (pool.get(i).dead) pool.removeAt(i);
}
