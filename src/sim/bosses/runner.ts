import { len } from "../../core/math";
import { savePrev, UNSET } from "../body";
import { moveBody } from "../collision";
import { hurtPlayer } from "../combat";
import { applyDrag, clampSpeed } from "../physics";
import type { World } from "../world";
import { BOSS_DEFS } from "./registry";
import type { Aim, AttackDef, Boss, BossDef, BossKind } from "./types";

// Runner genérico de chefe. A ORDEM do passo segue os `updateCrab`, `updateJelly` e
// `updateEye` do protótipo, porque é parte do feel:
//   piscada → troca de fase → cronômetro → estado (pensar / aviso / execução) → âncora →
//   teto de velocidade → arrasto → colisão → orientação → deslize na parede → contato.
// Os ataques checam o próprio dano ANTES do movimento (como no protótipo); o contato de
// encostar é checado DEPOIS. O movimento de "pensar" e a âncora dos ataques dependem do estado
// no COMEÇO do passo: no passo em que um ataque é sorteado, o chefe ainda se move como pensando.
//
// Cronômetros em ms são descontados com o passo EXATO (`dtMs`), nunca com `dt · 1000`: os
// dois podem diferir no último bit, e um intervalo múltiplo do passo (150 ms = 9 passos) cairia
// para o outro lado do zero, adiantando ou atrasando uma salva em um passo.

export function createBoss(w: World, kind: BossKind, x: number, y: number): Boss {
  const def = BOSS_DEFS[kind];
  const s = def.stats;
  const F = UNSET;
  const b: Boss = {
    x: F, y: F, vx: F, vy: F, prevX: F, prevY: F, radius: F, collR: F, blockedX: false, blockedY: false,
    id: w.nextId++, kind, hp: F, maxHp: F, phase: 0, state: "think", attack: "", lastAttack: "",
    t: F, stateMs: F, ang: F, prevAng: F, dirX: F, dirY: F, flashMs: F, active: false, dead: false,
    slideMs: F, slideDir: F, data: {},
  };
  b.x = b.prevX = x;
  b.y = b.prevY = y;
  b.vx = b.vy = 0;
  b.radius = s.radius;
  b.collR = s.collRadius;
  b.hp = b.maxHp = s.hp;
  b.t = b.stateMs = def.firstThinkMs ?? def.phases[0]?.thinkMs ?? 0;
  b.ang = b.prevAng = 0;
  b.dirX = 1;
  b.dirY = 0;
  b.flashMs = 0;
  b.slideMs = 0;
  b.slideDir = 1;
  def.init?.(b, w);
  w.bosses.push(b);
  return b;
}

const aim: Aim = { dx: 0, dy: 0, d: 1 };

export function stepBosses(w: World, dtMs: number): void {
  for (const b of w.bosses) {
    savePrev(b);
    b.prevAng = b.ang;
    if (b.active && !b.dead) stepBoss(b, w, dtMs);
  }
}

function stepBoss(b: Boss, w: World, dtMs: number): void {
  const def = BOSS_DEFS[b.kind];
  const dt = dtMs / 1000;
  const p = w.player;
  if (b.flashMs > 0) b.flashMs -= dtMs;

  // o Olho gasta o passo inteiro na troca de fase (o protótipo fazia `return`)
  if (enterPhaseIfDue(b, w, def) && def.phaseChangeSkipsStep) return;

  b.t -= dtMs;
  aim.dx = p.x - b.x;
  aim.dy = p.y - b.y;
  aim.d = len(aim.dx, aim.dy) || 1;
  const aimAng = Math.atan2(aim.dy, aim.dx);
  def.animate?.(b, dt);

  const startedThinking = b.state === "think";
  if (b.state === "think") {
    def.think(b, w, dt, aim);
    if (b.t <= 0) startTelegraph(b, w, pickAttack(b, w, def), null);
  } else if (b.state === "telegraph") {
    attackOf(def, b).onTelegraph?.(b, w, dt, aim, dtMs);
    if (b.t <= 0) startExecute(b, w, def);
  } else {
    const atk = attackOf(def, b);
    const endedEarly = atk.onExecute?.(b, w, dt, aim, dtMs) === true;
    if (b.t <= 0 || endedEarly) finish(b, w, def);
  }

  // ancorado durante os ataques (a Água-viva e o Olho); o Caranguejo freia dentro de cada aviso
  if (!startedThinking && def.attackBrake) {
    b.vx *= 1 - def.attackBrake * dt;
    b.vy *= 1 - def.attackBrake * dt;
  }

  const executing = b.state === "execute" ? attackOf(def, b) : null;
  if (!executing?.uncapped) clampSpeed(b, def.maxSpeed?.(b) ?? def.stats.speed);
  applyDrag(b, def.stats.drag, dt);
  moveBody(b, w.grid, dt);
  def.orient?.(b, aimAng);

  // bateu na rocha pensando (ou num ataque que desliza): desliza pela tangente em vez de moer a
  // parede. Não é rede de segurança da colisão; é o chefe contornando o obstáculo.
  if (def.slide) {
    if (b.slideMs > 0) b.slideMs -= dtMs;
    const slides = b.state === "think" || executing?.slides === true;
    if ((b.blockedX || b.blockedY) && slides) {
      if (b.slideMs <= 0) {
        b.slideDir = w.rng.next() < 0.5 ? -1 : 1;
        b.slideMs = def.slide.durationMs;
      }
      const a = def.stats.accel * def.slide.accelScale * dt;
      b.vx += (-aim.dy / aim.d) * b.slideDir * a;
      b.vy += (aim.dx / aim.d) * b.slideDir * a;
    }
  }

  const contactR = b.radius * (def.contactRadiusScale ?? 1) + p.radius;
  if (!executing?.ownContact && !w.playerDead && len(p.x - b.x, p.y - b.y) < contactR) {
    hurtPlayer(w, def.stats.contactDamage, b.x, b.y);
  }
}

/**
 * Troca de fase quando a vida cruza o limiar. Vai direto para a fase mais funda devida.
 * Devolve true se trocou.
 */
function enterPhaseIfDue(b: Boss, w: World, def: BossDef): boolean {
  const frac = b.hp / b.maxHp;
  let target = b.phase;
  for (let i = b.phase + 1; i < def.phases.length; i++) {
    const ph = def.phases[i];
    if (ph && (ph.inclusive ? frac <= ph.hpBelow : frac < ph.hpBelow)) target = i;
  }
  if (target === b.phase) return false;
  b.phase = target;
  b.state = "think";
  b.t = b.stateMs = def.phaseChangeThinkMs;
  w.events.push({ t: "bossPhase", x: b.x, y: b.y, boss: b.kind, phase: target });
  def.onPhaseEnter?.(b, w, target);
  return true;
}

function pickAttack(b: Boss, w: World, def: BossDef): string {
  const phase = def.phases[b.phase];
  if (!phase) throw new Error(`${b.kind}: fase ${b.phase} não existe`);
  const pool = phase.pool;
  const draw = (): string => pool[w.rng.int(0, pool.length - 1)] ?? "";
  let next = draw();
  // sem isso, sequências repetidas eram comuns e a luta ficava monótona (CONTEXTO §6)
  if (next === b.lastAttack && w.rng.chance(phase.rerollRepeatChance)) next = draw();
  b.lastAttack = next;
  return next;
}

function attackOf(def: BossDef, b: Boss): AttackDef {
  const atk = def.attacks[b.attack];
  if (!atk) throw new Error(`${b.kind}: ataque desconhecido "${b.attack}"`);
  return atk;
}

function startTelegraph(b: Boss, w: World, attack: string, ms: number | null): void {
  const def = BOSS_DEFS[b.kind];
  b.state = "telegraph";
  b.attack = attack;
  b.t = b.stateMs = ms ?? attackOf(def, b).telegraphMs(b);
  w.events.push({ t: "telegraph", x: b.x, y: b.y, source: b.kind, attack });
}

function startExecute(b: Boss, w: World, def: BossDef): void {
  const atk = attackOf(def, b);
  b.state = "execute";
  b.t = b.stateMs = atk.executeMs(b);
  atk.onStart?.(b, w);
  w.events.push({ t: "attackStart", x: b.x, y: b.y, source: b.kind, attack: b.attack, size: atk.fxSize?.(b) });
  // ataque instantâneo (o chamado): acontece no fim do aviso e volta a pensar no mesmo passo
  if (b.t <= 0) finish(b, w, def);
}

function finish(b: Boss, w: World, def: BossDef): void {
  const chain = attackOf(def, b).next?.(b, w) ?? null;
  if (chain) {
    startTelegraph(b, w, chain.attack, chain.telegraphMs);
    return;
  }
  b.state = "think";
  b.t = b.stateMs = def.phases[b.phase]?.thinkMs ?? 0;
}

/** Ativa o chefe no fim da entrada (GDD §2.2). */
export function activateBoss(b: Boss): void {
  b.active = true;
}
