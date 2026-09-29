import { PLAYER } from "../../src/config/player";
import { SPEAR } from "../../src/config/spear";
import { angDiff, len } from "../../src/core/math";
import { ENEMY_DEFS } from "../../src/sim/enemies/registry";
import type { Enemy } from "../../src/sim/enemies/types";
import { hasLineOfSight } from "../../src/sim/geometry";
import { NO_INTENT, type PlayerIntent } from "../../src/sim/player";
import type { World } from "../../src/sim/world";
import type { Grid } from "../../src/world/grid";

// Um jogador-robô para medir o equilíbrio (M8). NÃO é um jogador de verdade: ele não lê o
// desenho, não improvisa e joga sempre do mesmo jeito. Serve para comparar cenários entre si
// (a mesma habilidade, com e sem uma mudança) e para achar o que é impossível ou trivial, e
// não para dizer se o jogo é divertido ou justo. Os números que ele produz são relativos.

export interface BotSkill {
  name: string;
  /** Ameaças com menos que isto para o impacto não são evitadas: o tempo de reação humano. */
  reactionMs: number;
  /** Quanto à frente ele enxerga um projétil vindo. */
  horizonMs: number;
  usesDash: boolean;
  /**
   * Usa o dash como escudo: aperta no instante em que um tiro que não dá mais para desviar
   * andando está a ~50 ms de acertar, e os quadros de invulnerabilidade o absorvem. É o TETO do
   * que a invulnerabilidade permite a um jogador com o tempo perfeito.
   */
  dashShield?: boolean;
}

export const SKILLS = {
  novato: { name: "novato", reactionMs: 400, horizonMs: 700, usesDash: false },
  regular: { name: "regular", reactionMs: 280, horizonMs: 800, usesDash: true },
  veterano: { name: "veterano", reactionMs: 170, horizonMs: 950, usesDash: true },
  /** O teto: reação de veterano e o dash cronometrado como escudo. */
  mestre: { name: "mestre", reactionMs: 170, horizonMs: 950, usesDash: true, dashShield: true },
} as const satisfies Record<string, BotSkill>;

const PR = PLAYER.radius;
const STAB_REACH = SPEAR.reach;

interface Danger {
  /** Soma dos empurrões para longe das ameaças. */
  x: number;
  y: number;
  /** Direção do dash de esquiva, se uma ameaça está prestes a acertar. */
  dashX: number;
  dashY: number;
  urgent: boolean;
}

interface Target {
  x: number;
  y: number;
  radius: number;
  enemy?: Enemy;
  boss?: boolean;
}

export class Bot {
  private retreatUntilMs = 0;
  private stabsInRow = 0;
  private lastStabMs = -1e9;
  private path: { x: number; y: number }[] = [];
  private pathAtMs = -1e9;
  private lastX = 0;
  private lastY = 0;
  private stuckSteps = 0;
  private nudgeUntilMs = 0;
  private nudgeSign = 1;

  constructor(readonly skill: BotSkill) {}

  intent(w: World): PlayerIntent {
    const out: PlayerIntent = { ...NO_INTENT, mouseMoved: true, attackPressedByMouse: true };
    const p = w.player;
    out.aimX = p.x + Math.cos(p.aim) * 100;
    out.aimY = p.y + Math.sin(p.aim) * 100;
    if (w.playerDead) return out;

    const danger: Danger = { x: 0, y: 0, dashX: 0, dashY: 0, urgent: false };
    this.projectileDanger(w, danger);
    const engagedElsewhere = this.enemyDanger(w, danger);
    this.bossDanger(w, danger);

    let gx = 0;
    let gy = 0;
    let aimX = p.x + 100;
    let aimY = p.y;
    const heal = this.nearestHeal(w);
    const target = this.chooseTarget(w);
    if (heal && p.hp < PLAYER.hp * 0.8) {
      const s = this.steer(w, heal.x, heal.y);
      gx = s.gx;
      gy = s.gy;
      aimX = heal.x;
      aimY = heal.y;
    } else if (target) {
      const r = this.engage(w, target, out, engagedElsewhere);
      gx = r.gx;
      gy = r.gy;
      aimX = target.x;
      aimY = target.y;
    }
    out.aimX = aimX;
    out.aimY = aimY;

    // preso contra a rocha sem progresso: empurra de lado por um instante
    this.trackStuck(w, target !== null && !danger.urgent);
    if (w.timeMs < this.nudgeUntilMs) {
      const l = len(gx, gy);
      const ux = l > 1e-6 ? gx / l : 1;
      const uy = l > 1e-6 ? gy / l : 0;
      gx = -uy * this.nudgeSign;
      gy = ux * this.nudgeSign;
    }

    const mx = gx + danger.x;
    const my = gy + danger.y;
    const ml = len(mx, my);
    if (ml > 1e-6) {
      out.moveX = mx / ml;
      out.moveY = my / ml;
    }

    // esquiva com dash: a direção do dash é a da mira neste passo
    if (this.skill.usesDash && danger.urgent && p.dashCdMs <= 0 && p.dashMs <= 0) {
      out.dashHeld = true;
      out.aimX = p.x + danger.dashX * 100;
      out.aimY = p.y + danger.dashY * 100;
      out.attackPressed = false;
      out.attackHeld = false;
    }
    return out;
  }

  private trackStuck(w: World, wantsToMove: boolean): void {
    const p = w.player;
    const moved = len(p.x - this.lastX, p.y - this.lastY);
    this.lastX = p.x;
    this.lastY = p.y;
    if (wantsToMove && moved < 0.6 && p.spear.phase === "idle") this.stuckSteps++;
    else this.stuckSteps = 0;
    if (this.stuckSteps > 50) {
      this.stuckSteps = 0;
      this.nudgeUntilMs = w.timeMs + 700;
      this.nudgeSign = -this.nudgeSign;
      this.path = [];
      this.pathAtMs = -1e9;
    }
  }

  // --- ameaças ---------------------------------------------------------------------------

  private projectileDanger(w: World, d: Danger): void {
    const p = w.player;
    const pool = w.projectiles;
    const horizon = this.skill.horizonMs / 1000;
    const reaction = this.skill.reactionMs / 1000;
    for (let i = 0; i < pool.count; i++) {
      const s = pool.get(i);
      if (s.dead) continue;
      const rx = s.x - p.x;
      const ry = s.y - p.y;
      if (rx * rx + ry * ry > 340 * 340) continue;
      const v2 = s.vx * s.vx + s.vy * s.vy;
      if (v2 < 1) continue;
      // instante da maior aproximação, contando o jogador parado
      const t = -(rx * s.vx + ry * s.vy) / v2;
      if (t < 0 || t > horizon) continue;
      const cx = rx + s.vx * t;
      const cy = ry + s.vy * t;
      const dmin = len(cx, cy);
      if (dmin > s.r + PR + 9) continue;
      if (t < reaction) {
        // rápido demais para desviar andando; o mestre cronometra o dash para o tiro cair nos
        // quadros de invulnerabilidade (aperta a ~30–90 ms do impacto)
        if (this.skill.dashShield && t > 0.03 && t < 0.09) {
          d.urgent = true;
          d.dashX = s.vx / Math.sqrt(v2);
          d.dashY = s.vy / Math.sqrt(v2);
        }
        continue;
      }
      let ax = -cx;
      let ay = -cy;
      let l = len(ax, ay);
      if (l < 1e-3) {
        ax = -s.vy;
        ay = s.vx;
        l = len(ax, ay);
      }
      ax /= l;
      ay /= l;
      const wgt = 1.6 / (t + 0.15);
      d.x += ax * wgt;
      d.y += ay * wgt;
      if (t < reaction + 0.16) {
        d.urgent = true;
        d.dashX = ax;
        d.dashY = ay;
      }
    }
  }

  /** Devolve true se há um inimigo em ataque por perto (não é hora de entrar num outro). */
  private enemyDanger(w: World, d: Danger): boolean {
    const p = w.player;
    let near = false;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.get(i);
      if (e.dead) continue;
      const state = ENEMY_DEFS[e.kind].states[e.state];
      {
        // espaço pessoal: encostar dói, e só se chega tão perto para estocar
        const px = p.x - e.x;
        const py = p.y - e.y;
        const pd = len(px, py) || 1;
        const space = e.radius + PR + 16;
        if (pd < space) {
          d.x += (px / pd) * 0.9 * (1 - pd / space);
          d.y += (py / pd) * 0.9 * (1 - pd / space);
        }
      }
      if (!state || !(state.telegraph || state.harmful)) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = len(dx, dy) || 1;
      const reach = 150 + e.radius;
      if (dist > reach) continue;
      near = true;
      // ataques em linha travada (peixe, circulador, lampreia, enguia): sai da faixa, de lado
      const lane = e.kind === "fish" || e.kind === "circler" || e.kind === "lamprey";
      if (lane && (e.dirX !== 0 || e.dirY !== 0)) {
        const along = dx * e.dirX + dy * e.dirY;
        const side = dx * -e.dirY + dy * e.dirX;
        if (along > -20 && Math.abs(side) < e.radius + PR + 26) {
          const sgn = side >= 0 ? 1 : -1;
          d.x += -e.dirY * sgn * 2.4;
          d.y += e.dirX * sgn * 2.4;
          if (state.harmful && along < 130) {
            d.urgent = true;
            d.dashX = -e.dirY * sgn;
            d.dashY = e.dirX * sgn;
          }
          continue;
        }
      }
      const wgt = 1.4 * (1 - dist / reach);
      d.x += (dx / dist) * wgt;
      d.y += (dy / dist) * wgt;
      if (state.harmful && dist < e.radius + PR + 30) {
        d.urgent = true;
        d.dashX = dx / dist;
        d.dashY = dy / dist;
      }
    }
    return near;
  }

  private bossDanger(w: World, d: Danger): void {
    const p = w.player;
    for (const b of w.bosses) {
      if (!b.active || b.dead) continue;
      const dx = p.x - b.x;
      const dy = p.y - b.y;
      const dist = len(dx, dy) || 1;
      const acting = b.state === "telegraph" || b.state === "execute";
      if (b.kind === "crab" && acting) {
        if (b.attack === "dash" || b.attack === "dash2") {
          // fora da faixa da investida: perpendicular à direção travada
          const along = dx * b.dirX + dy * b.dirY;
          const side = dx * -b.dirY + dy * b.dirX;
          if (along > -80 && Math.abs(side) < 110) {
            const s = side >= 0 ? 1 : -1;
            d.x += -b.dirY * s * 2.2;
            d.y += b.dirX * s * 2.2;
            if (b.state === "execute" && Math.abs(side) < 60 && along < 220) {
              d.urgent = true;
              d.dashX = -b.dirY * s;
              d.dashY = b.dirX * s;
            }
          }
        } else if (dist < 190) {
          d.x += (dx / dist) * 2;
          d.y += (dy / dist) * 2;
        }
      } else if (b.kind === "jelly" && acting && (b.attack === "beam" || b.attack === "pull")) {
        // o raio alcança ~300 px e a sucção puxa de longe: sai do alcance
        if (dist < 360) {
          d.x += (dx / dist) * 1.8;
          d.y += (dy / dist) * 1.8;
        }
      } else if (b.kind === "eye" && dist < 100) {
        d.x += (dx / dist) * 1.2;
        d.y += (dy / dist) * 1.2;
      }
    }
  }

  // --- objetivo --------------------------------------------------------------------------

  private nearestHeal(w: World): { x: number; y: number } | null {
    const p = w.player;
    let best: { x: number; y: number } | null = null;
    let bd = 260;
    for (let i = 0; i < w.pickups.count; i++) {
      const h = w.pickups.get(i);
      const dd = len(h.x - p.x, h.y - p.y);
      if (dd < bd) {
        bd = dd;
        best = h;
      }
    }
    return best;
  }

  private chooseTarget(w: World): Target | null {
    const p = w.player;
    for (const b of w.bosses) {
      if (b.active && !b.dead) return { x: b.x, y: b.y, radius: b.radius, boss: true };
    }
    let best: Enemy | null = null;
    let bd = Infinity;
    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.get(i);
      if (e.dead) continue;
      const dd = len(e.x - p.x, e.y - p.y);
      if (dd < bd) {
        bd = dd;
        best = e;
      }
    }
    return best ? { x: best.x, y: best.y, radius: best.radius, enemy: best } : null;
  }

  /** Aproxima, ataca e recua. Devolve a direção do objetivo. */
  private engage(w: World, t: Target, out: PlayerIntent, busy: boolean): { gx: number; gy: number } {
    const p = w.player;
    const dx = t.x - p.x;
    const dy = t.y - p.y;
    const dist = len(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const inReach = dist <= STAB_REACH + t.radius + SPEAR.tipRadius - 10;

    // depois de duas estocadas, sai (entrar, estocar duas vezes, sair)
    if (w.timeMs < this.retreatUntilMs) return { gx: -ux, gy: -uy };

    // chefe: entra na pausa entre os ataques e sai quando ele começa o aviso (a janela de punição)
    if (t.boss) {
      const b = w.bosses.find((x) => x.active && !x.dead);
      if (b && b.state !== "think" && dist < 240) return { gx: -ux * 0.5, gy: -uy * 0.5 };
    }

    // o alvo está atacando: espera o aviso passar a uma distância segura e pune a recuperação
    const def = t.enemy ? ENEMY_DEFS[t.enemy.kind].states[t.enemy.state] : undefined;
    const attacking = !!def && (def.telegraph || def.harmful);
    if (attacking && dist < 140 && t.enemy?.kind !== "urchin") return { gx: -ux * 0.4, gy: -uy * 0.4 };
    if (busy && !inReach) return { gx: 0, gy: 0 };

    // ermitão: a frente é blindada, então contorna até as costas
    if (t.enemy?.kind === "hermit") {
      const toBot = Math.atan2(-dy, -dx);
      const off = angDiff(t.enemy.ang, toBot);
      if (Math.abs(off) < 1.3 && dist < 150) {
        const s = off >= 0 ? 1 : -1;
        // tangente, e para fora se chegou perto demais (a pinça alcança 40 px + a frente é blindada)
        const radial = dist < 80 ? -0.7 : 0.05;
        // (ux, uy) aponta do jogador para o ermitão; a tangente anti-horária em volta dele é (uy, -ux)
        return { gx: uy * s * 1.1 + ux * radial, gy: -ux * s * 1.1 + uy * radial };
      }
    }

    if (inReach && p.spear.phase === "idle") {
      out.attackPressed = true;
      out.attackHeld = true;
      if (w.timeMs - this.lastStabMs < 900) this.stabsInRow++;
      else this.stabsInRow = 1;
      this.lastStabMs = w.timeMs;
      if (this.stabsInRow >= 2) this.retreatUntilMs = w.timeMs + 480;
    }
    if (dist < 130) return { gx: ux, gy: uy };
    return this.steer(w, t.x, t.y);
  }

  // --- caminho ---------------------------------------------------------------------------

  /** Direção para (tx, ty): reta se a visão está livre, senão pelo caminho na grade. */
  private steer(w: World, tx: number, ty: number): { gx: number; gy: number } {
    const p = w.player;
    if (clearLine(w.grid, p.x, p.y, tx, ty)) {
      const l = len(tx - p.x, ty - p.y) || 1;
      return { gx: (tx - p.x) / l, gy: (ty - p.y) / l };
    }
    if (w.timeMs - this.pathAtMs > 250 || this.path.length === 0) {
      this.path = findPath(w.grid, p.x, p.y, tx, ty);
      this.pathAtMs = w.timeMs;
    }
    // o ponto mais adiante do caminho que ainda se enxerga em linha reta
    let pick: { x: number; y: number } | null = null;
    for (let i = 0; i < Math.min(this.path.length, 14); i++) {
      const c = this.path[i] as { x: number; y: number };
      if (clearLine(w.grid, p.x, p.y, c.x, c.y)) pick = c;
    }
    if (!pick) pick = this.path[0] ?? { x: tx, y: ty };
    const l = len(pick.x - p.x, pick.y - p.y) || 1;
    return { gx: (pick.x - p.x) / l, gy: (pick.y - p.y) / l };
  }
}

/** Linha livre para o corpo do jogador: o eixo e duas linhas paralelas a ±8 px. */
function clearLine(g: Grid, x0: number, y0: number, x1: number, y1: number): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l = len(dx, dy);
  if (l < 1) return true;
  const nx = (-dy / l) * 8;
  const ny = (dx / l) * 8;
  return (
    hasLineOfSight(g, x0, y0, x1, y1, 6) &&
    hasLineOfSight(g, x0 + nx, y0 + ny, x1 + nx, y1 + ny, 6) &&
    hasLineOfSight(g, x0 - nx, y0 - ny, x1 - nx, y1 - ny, 6)
  );
}

/**
 * Caminho na grade (busca em largura, 8 vizinhos, sem cortar quina). Tenta primeiro só por
 * células com folga em volta e, se não houver caminho, por qualquer célula livre. Devolve os
 * centros das células, do primeiro passo ao destino.
 */
function findPath(g: Grid, x0: number, y0: number, x1: number, y1: number): { x: number; y: number }[] {
  const t = g.tile;
  const sx = Math.floor(x0 / t);
  const sy = Math.floor(y0 / t);
  const gx = Math.floor(x1 / t);
  const gy = Math.floor(y1 / t);
  for (const clearance of [true, false]) {
    const path = bfs(g, sx, sy, gx, gy, clearance);
    if (path) return path.map(([cx, cy]) => ({ x: (cx + 0.5) * t, y: (cy + 0.5) * t }));
  }
  return [];
}

const DIRS: readonly [number, number][] = [
  [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1],
];

function bfs(g: Grid, sx: number, sy: number, gx: number, gy: number, clearance: boolean): [number, number][] | null {
  const cols = g.cols;
  const free = (cx: number, cy: number): boolean => {
    if (g.isSolid(cx, cy)) return false;
    if (!clearance) return true;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (g.isSolid(cx + dx, cy + dy)) return false;
    return true;
  };
  const prev = new Int32Array(cols * g.rows).fill(-2);
  const start = sy * cols + sx;
  prev[start] = -1;
  const queue: number[] = [start];
  let goal = -1;
  for (let qi = 0; qi < queue.length; qi++) {
    const cur = queue[qi] as number;
    const cx = cur % cols;
    const cy = Math.floor(cur / cols);
    if (Math.abs(cx - gx) <= 1 && Math.abs(cy - gy) <= 1) {
      goal = cur;
      break;
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!g.inBounds(nx, ny) || !free(nx, ny)) continue;
      if (dx !== 0 && dy !== 0 && (g.isSolid(cx + dx, cy) || g.isSolid(cx, cy + dy))) continue;
      const ni = ny * cols + nx;
      if (prev[ni] !== -2) continue;
      prev[ni] = cur;
      queue.push(ni);
    }
  }
  if (goal < 0) return null;
  const out: [number, number][] = [];
  for (let c = goal; c !== start && c >= 0; c = prev[c] as number) out.push([c % cols, Math.floor(c / cols)]);
  return out.reverse();
}
