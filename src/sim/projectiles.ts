import { PROJECTILES } from "../config/combat";
import { angLerp, clamp, len, TAU } from "../core/math";
import { Cell } from "../world/grid";
import { UNSET } from "./body";
import { hurtPlayer } from "./combat";
import { isInvulnerable } from "./player";
import type { World } from "./world";

// Projéteis: um tipo só, com campos opcionais de comportamento (ARCHITECTURE §5.5). Vivem
// num pool com teto e remoção por swap-remove, então nada é alocado por passo.

export interface Projectile {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  /** Módulo da velocidade (os perseguidores giram mantendo a velocidade). */
  speed: number;
  r: number;
  damage: number;
  life: number;
  color: string;
  /** Ângulo inicial das farpas (visual; sorteado aqui para o desenho não usar Math.random). */
  spin: number;
  /** Idade, para girar as farpas. */
  ageMs: number;
  /** Atravessa a rocha (perseguidores do Olho). */
  ignoresRock: boolean;
  /** Curva na direção do jogador a esta taxa, rad/s (0 = reto). */
  turnRate: number;
  /** O impacto pode erodir o bloco atingido (só projéteis do Olho, GDD §7.3). */
  erodes: boolean;
  /** Some depois de percorrer esta distância (espinhos do Ouriço); 0 = sem limite. */
  maxDist: number;
  traveled: number;
  dead: boolean;
}

export function makeProjectileSlot(): Projectile {
  // os campos numéricos nascem double; são todos escritos em `fireProjectile` (ver sim/body.ts)
  const F = UNSET;
  return {
    x: F, y: F, prevX: F, prevY: F, vx: F, vy: F, speed: F, r: F, damage: F, life: F, color: "",
    spin: F, ageMs: F, ignoresRock: false, turnRate: F, erodes: false, maxDist: F, traveled: F,
    dead: false,
  };
}

export interface FireOptions {
  ignoresRock?: boolean;
  turnRate?: number;
  erodes?: boolean;
  maxDist?: number;
}

/** Dispara um projétil. Com o pool cheio, o disparo é ignorado (como no protótipo). */
export function fireProjectile(
  w: World, x: number, y: number, ang: number, speed: number, damage: number, r: number,
  lifeMs: number, color: string, opts: FireOptions = {},
): Projectile | null {
  const p = w.projectiles.obtain();
  if (!p) return null;
  p.x = p.prevX = x;
  p.y = p.prevY = y;
  p.vx = Math.cos(ang) * speed;
  p.vy = Math.sin(ang) * speed;
  p.speed = speed;
  p.r = r;
  p.damage = damage;
  p.life = lifeMs;
  p.color = color;
  p.spin = w.rng.range(0, TAU);
  p.ageMs = 0;
  p.ignoresRock = opts.ignoresRock ?? false;
  p.turnRate = opts.turnRate ?? 0;
  p.erodes = opts.erodes ?? false;
  p.maxDist = opts.maxDist ?? 0;
  p.traveled = 0;
  p.dead = false;
  return p;
}

export function stepProjectiles(w: World, dtMs: number): void {
  const dt = dtMs / 1000;
  const pl = w.player;
  const grid = w.grid;
  const pool = w.projectiles;
  // Em ordem de criação, e os que somem só saem no fim (compactação estável): quando dois
  // acertam o jogador no mesmo passo, o primeiro criado é o que empurra, como no protótipo.
  for (let i = 0; i < pool.count; i++) {
    const p = pool.get(i);
    if (p.dead) continue;
    p.prevX = p.x;
    p.prevY = p.y;
    p.life -= dtMs;
    p.ageMs += dtMs;
    if (p.turnRate) {
      // curva com taxa limitada: dá para driblar
      const target = Math.atan2(pl.y - p.y, pl.x - p.x);
      const ang = angLerp(Math.atan2(p.vy, p.vx), target, clamp(p.turnRate * dt, 0, 1));
      p.vx = Math.cos(ang) * p.speed;
      p.vy = Math.sin(ang) * p.speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.traveled += p.speed * dt;

    let gone = p.life <= 0 || (p.maxDist > 0 && p.traveled >= p.maxDist);
    if (!gone && (p.x < 0 || p.y < 0 || p.x > grid.width || p.y > grid.height)) {
      w.events.push({ t: "projectileBurst", x: p.x, y: p.y, color: p.color });
      gone = true;
    }
    if (!gone && !p.ignoresRock && grid.isSolidAt(p.x, p.y)) {
      w.events.push({ t: "projectileBurst", x: p.x, y: p.y, color: p.color });
      if (p.erodes) erodeAt(w, p.x, p.y);
      gone = true;
    }
    // Na invulnerabilidade (a de depois do dano e a do começo do dash), o projétil
    // atravessa o jogador sem estourar (GDD §4.2).
    if (!gone && !w.playerDead && !isInvulnerable(pl) && len(p.x - pl.x, p.y - pl.y) < p.r + pl.radius) {
      if (hurtPlayer(w, p.damage, p.x, p.y)) {
        w.events.push({ t: "projectileHit", x: p.x, y: p.y, color: p.color });
        gone = true;
      }
    }
    if (gone) p.dead = true;
  }
  pool.removeWhere(isDead);
}

const isDead = (p: Projectile): boolean => p.dead;

/** O impacto pode destruir o bloco atingido. Só rocha comum: a protegida nunca erode. */
function erodeAt(w: World, x: number, y: number): void {
  if (!w.rng.chance(PROJECTILES.erodeChance)) return;
  const t = w.grid.tile;
  const cx = Math.floor(x / t);
  const cy = Math.floor(y / t);
  if (w.grid.get(cx, cy) !== Cell.Rock) return;
  w.grid.set(cx, cy, Cell.Water);
  w.events.push({ t: "rockEroded", x: cx * t + t / 2, y: cy * t + t / 2 });
}
