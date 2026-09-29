import { INPUT } from "../config/input";
import { PLAYER } from "../config/player";
import { SPEAR } from "../config/spear";
import { makeBody, type Body } from "./body";
import { moveBody } from "./collision";
import { hitTarget } from "./combat";
import { accelerate, applyDrag, clampSpeed } from "./physics";
import type { World } from "./world";

// Jogador: nado, dash e a lança. Porte do `updatePlayer` do protótipo (CONTEXTO §3 e §4).
// A ORDEM dentro do passo é parte do feel e segue o protótipo: mira → cronômetros → dash →
// lança (o acerto é checado aqui, antes do movimento) → nado → arrasto → teto → colisão.

/** O que a entrada pede neste passo, já traduzido para o mundo. A simulação não vê teclas. */
export interface PlayerIntent {
  /** −1, 0 ou 1 em cada eixo, sem normalizar. */
  moveX: number;
  moveY: number;
  /** Cursor em coordenadas de mundo. */
  aimX: number;
  aimY: number;
  /** O mouse se mexeu desde o último passo: a mira volta ao cursor. */
  mouseMoved: boolean;
  attackHeld: boolean;
  attackPressed: boolean;
  /** O toque de ataque veio do mouse (e não de uma tecla), o que decide o modo de mira. */
  attackPressedByMouse: boolean;
  dashHeld: boolean;
}

export const NO_INTENT: Readonly<PlayerIntent> = {
  moveX: 0, moveY: 0, aimX: 0, aimY: 0, mouseMoved: false,
  attackHeld: false, attackPressed: false, attackPressedByMouse: false, dashHeld: false,
};

export type SpearPhase = "idle" | "anticipation" | "thrust" | "recovery";

export interface Spear {
  phase: SpearPhase;
  /** Tempo restante na fase atual. Na antecipação, fica em 0 enquanto a carga continua. */
  t: number;
  chargeMs: number;
  charging: boolean;
  dirX: number;
  dirY: number;
  /** Alcance e dano desta estocada, fixados quando ela sai. */
  reach: number;
  damage: number;
  /** Um acerto por alvo por estocada. Limpo quando o golpe começa. */
  readonly hitIds: Set<number>;
}

export type AimMode = "mouse" | "keys";

export interface Player extends Body {
  aim: number;
  prevAim: number;
  aimMode: AimMode;
  keyAim: number;
  hp: number;
  /** Invulnerabilidade depois de sofrer dano (M2). */
  invulnMs: number;
  /** Tempo restante do dash; > 0 durante o dash. */
  dashMs: number;
  dashCdMs: number;
  readonly spear: Spear;
}

export function createPlayer(x: number, y: number): Player {
  return {
    ...makeBody(x, y, PLAYER.radius, PLAYER.radius * PLAYER.collScale),
    aim: 0,
    prevAim: 0,
    aimMode: "mouse",
    keyAim: 0,
    hp: PLAYER.hp,
    invulnMs: 0,
    dashMs: 0,
    dashCdMs: 0,
    spear: {
      phase: "idle", t: 0, chargeMs: 0, charging: false, dirX: 1, dirY: 0,
      reach: SPEAR.reach, damage: SPEAR.damage, hitIds: new Set(),
    },
  };
}

/** Nos primeiros `dash.invulnMs` do dash o jogador atravessa dano (GDD §4.2). */
export function inDashInvuln(p: Player): boolean {
  if (p.dashMs <= 0) return false;
  const elapsed = PLAYER.dash.durationMs - p.dashMs;
  // tolerância: 6 passos de 16,667 ms somam 100,000…01 ms e não podem contar como < 100
  return elapsed < PLAYER.dash.invulnMs - 1e-6;
}

export function isInvulnerable(p: Player): boolean {
  return p.invulnMs > 0 || inDashInvuln(p);
}

export function stepPlayer(w: World, intent: PlayerIntent, dtMs: number): void {
  const p = w.player;
  const sp = p.spear;
  const dt = dtMs / 1000;

  let mx = intent.moveX;
  let my = intent.moveY;
  const ml = Math.hypot(mx, my);
  if (ml > 0) {
    mx /= ml;
    my /= ml;
  }

  // mira: cursor por padrão; no modo teclado segue a direção do nado
  if (intent.mouseMoved) p.aimMode = "mouse";
  if (p.aimMode === "keys") {
    if (INPUT.keyboardAimFollowsMovement && ml > 0) p.keyAim = Math.atan2(my, mx);
    p.aim = p.keyAim;
  } else {
    p.aim = Math.atan2(intent.aimY - p.y, intent.aimX - p.x);
  }

  if (p.invulnMs > 0) p.invulnMs -= dtMs;
  if (p.dashCdMs > 0) p.dashCdMs -= dtMs;

  // dash na direção da mira; segurar a tecla redispara assim que a recarga zera
  if (intent.dashHeld && p.dashCdMs <= 0 && p.dashMs <= 0) {
    p.dashMs = PLAYER.dash.durationMs;
    p.dashCdMs = PLAYER.dash.cooldownMs;
    const dx = Math.cos(p.aim);
    const dy = Math.sin(p.aim);
    p.vx = dx * PLAYER.dash.speed;
    p.vy = dy * PLAYER.dash.speed;
    // a única forma de encurtar o comprometimento de um ataque
    if (sp.phase === "recovery") {
      sp.phase = "idle";
      sp.t = 0;
    }
    w.events.push({ t: "dash", x: p.x, y: p.y, dirX: dx, dirY: dy });
  }

  // lança: clique ou tecla; segurar carrega nos dois casos
  if (intent.attackPressed && sp.phase === "idle") {
    if (intent.attackPressedByMouse) {
      p.aimMode = "mouse";
    } else {
      // atacar pelo teclado passa a mira para o nado; mexer o mouse devolve ao cursor
      p.aimMode = "keys";
      p.keyAim = ml > 0 ? Math.atan2(my, mx) : p.aim;
      p.aim = p.keyAim;
    }
    sp.phase = "anticipation";
    sp.t = SPEAR.anticipationMs;
    sp.chargeMs = 0;
    sp.charging = true;
    sp.dirX = Math.cos(p.aim);
    sp.dirY = Math.sin(p.aim);
  }
  if (!intent.attackHeld) sp.charging = false;

  if (sp.phase === "anticipation") {
    if (sp.charging) sp.chargeMs = Math.min(SPEAR.chargeMaxMs, sp.chargeMs + dtMs);
    // a direção ainda acompanha a mira até o golpe sair
    sp.dirX = Math.cos(p.aim);
    sp.dirY = Math.sin(p.aim);
    sp.t -= dtMs;
    if (sp.t <= 0 && (!sp.charging || sp.chargeMs >= SPEAR.chargeMaxMs)) startThrust(w);
    // segurando depois da antecipação: continua carregando
    else if (sp.t < 0) sp.t = 0;
  } else if (sp.phase === "thrust") {
    sp.t -= dtMs;
    if (sp.t <= 0) {
      sp.phase = "recovery";
      sp.t = SPEAR.recoveryMs;
    } else {
      spearHitCheck(w);
    }
  } else if (sp.phase === "recovery") {
    sp.t -= dtMs;
    if (sp.t <= 0) {
      sp.phase = "idle";
      sp.t = 0;
    }
  }

  // nado: sem controle durante o dash e o golpe
  const boosted = p.dashMs > 0 || sp.phase === "thrust";
  if (ml > 0 && !boosted) accelerate(p, mx, my, PLAYER.accel, dt);

  if (p.dashMs > 0) p.dashMs -= dtMs;

  // O arrasto menor e a falta de teto são checados DEPOIS de descontar o dash, como no
  // protótipo: o último passo do dash já volta ao arrasto e ao teto normais.
  const free = p.dashMs <= 0 && sp.phase !== "thrust";
  applyDrag(p, free ? PLAYER.drag : PLAYER.drag * PLAYER.boostDragScale, dt);
  if (free) clampSpeed(p, PLAYER.maxSpeed);

  moveBody(p, w.grid, dt);
}

function startThrust(w: World): void {
  const p = w.player;
  const sp = p.spear;
  const k = sp.chargeMs / SPEAR.chargeMaxMs;
  sp.phase = "thrust";
  sp.t = SPEAR.thrustMs;
  sp.reach = SPEAR.reach + SPEAR.reachChargeBonus * k;
  sp.damage = SPEAR.damage + SPEAR.damageChargeBonus * k;
  sp.hitIds.clear();
  const lunge = SPEAR.lungeSpeed + SPEAR.lungeChargeBonus * k;
  p.vx += sp.dirX * lunge;
  p.vy += sp.dirY * lunge;
  w.events.push({ t: "thrust", x: p.x, y: p.y, dirX: sp.dirX, dirY: sp.dirY, charge: k });
}

export interface SpearTip {
  x: number;
  y: number;
  dirX: number;
  dirY: number;
  /** Extensão atual, em fração do alcance (negativa quando recolhida). */
  k: number;
  reach: number;
}

export const makeSpearTip = (): SpearTip => ({ x: 0, y: 0, dirX: 1, dirY: 0, k: 0, reach: 0 });

/**
 * Onde está a ponta da lança. Escreve em `out` para não alocar por passo. O render passa a
 * posição e a mira interpoladas; a simulação usa as atuais.
 */
export function spearTip(p: Player, out: SpearTip, x = p.x, y = p.y, aim = p.aim): SpearTip {
  const sp = p.spear;
  let k: number;
  if (sp.phase === "anticipation") k = SPEAR.anticipationPullback;
  else if (sp.phase === "thrust") k = 1 - sp.t / SPEAR.thrustMs;
  else if (sp.phase === "recovery") k = SPEAR.recoveryStartExtend * (sp.t / SPEAR.recoveryMs);
  else k = SPEAR.idleExtend;
  const idle = sp.phase === "idle";
  out.dirX = idle ? Math.cos(aim) : sp.dirX;
  out.dirY = idle ? Math.sin(aim) : sp.dirY;
  out.reach = idle ? SPEAR.reach : sp.reach;
  // saída rápida, chegada suave
  out.k = k < 0 ? k : 1 - (1 - k) * (1 - k);
  out.x = x + out.dirX * out.reach * out.k;
  out.y = y + out.dirY * out.reach * out.k;
  return out;
}

const tip = makeSpearTip();

function spearHitCheck(w: World): void {
  const p = w.player;
  const sp = p.spear;
  spearTip(p, tip);
  // segundo círculo, atrás da ponta: um alvo pequeno não passa entre dois passos
  const back = Math.max(0, tip.k - SPEAR.midBack);
  const midX = p.x + tip.dirX * tip.reach * back;
  const midY = p.y + tip.dirY * tip.reach * back;

  for (const target of w.dummies) {
    if (!target.alive || sp.hitIds.has(target.id)) continue;
    const rr = target.radius + SPEAR.tipRadius;
    const hit =
      Math.hypot(target.x - tip.x, target.y - tip.y) <= rr ||
      Math.hypot(target.x - midX, target.y - midY) <= rr;
    if (!hit) continue;
    sp.hitIds.add(target.id);
    hitTarget(w, target, sp.damage, tip.dirX, tip.dirY);
    // hit-stop e recuo só quando acerta: errar não tem recompensa
    w.hitStopMs = SPEAR.hitStopMs;
    p.vx = -tip.dirX * SPEAR.selfRecoil;
    p.vy = -tip.dirY * SPEAR.selfRecoil;
  }
}
