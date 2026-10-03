import { LINE_OF_SIGHT } from "../../config/combat";
import { JELLY } from "../../config/bosses/jelly";
import { JELLYLING } from "../../config/enemies/jellyling";
import { TAU, angDiff, angLerp, clamp, len, lerp } from "../../core/math";
import { overlapsRock } from "../collision";
import { startBarrierBreak } from "../barrier";
import { hurtPlayer } from "../combat";
import { spawnEnemy } from "../enemies/runner";
import { distInRay, hasLineOfSight, rayLength } from "../geometry";
import { fireProjectile } from "../projectiles";
import type { World } from "../world";
import type { Boss, BossDef } from "./types";

// Água-viva Colossal: controle de espaço (CONTEXTO §6.2, GDD §8.2). Porte do `updateJelly` do
// protótipo (anel, raio e sucção), mais três fases e três ataques acrescentados depois do M8:
// onda de choque, chamado das medusinhas e farol. Flutua longe, enche a água de esporos, varre
// com o raio e suga o jogador. Não tem ataque corpo a corpo.
//
// O raio é o ataque que precisou de três versões no protótipo. As sete regras continuam:
// a ponta viaja para fora (tempo de reação), não gira enquanto estica, vão interno seguro, a
// rocha faz sombra, um acerto por varredura, piso de reação, e ω · 215 < 250 (config).
// O `b.t += DTMS` do protótipo virou dois subestágios explícitos: esticar e varrer.

/** O valor da fase atual numa lista por fase (uma lista mais curta vale para as fases seguintes). */
const byPhase = <T>(b: Boss, list: readonly T[]): T => list[Math.min(b.phase, list.length - 1)] as T;

/**
 * Combo: com a chance da fase, emenda um anel de esporos com aviso curto, sem pensar. Não sorteia
 * nada quando a chance é zero, para não mexer na sequência aleatória das fases sem combo.
 */
function combo(b: Boss, w: World, chances: readonly number[]): { attack: string; telegraphMs: number } | null {
  const p = byPhase(b, chances);
  return p > 0 && w.rng.chance(p) ? { attack: "ring", telegraphMs: JELLY.chain.telegraphMs } : null;
}

/** O centro da elipse por onde ela vagueia: o do mapa, puxado um pouco para o jogador. */
function roamCenter(w: World): { x: number; y: number } {
  return { x: lerp(w.grid.width / 2, w.player.x, JELLY.roam.follow), y: lerp(w.grid.height / 2, w.player.y, JELLY.roam.follow) };
}

/** Vagueia pela elipse e recua se o jogador cola (a mesma ideia do Olho). */
function roam(b: Boss, w: World, dt: number, aim: { dx: number; dy: number; d: number }): void {
  const R = JELLY.roam;
  const drift = (b.data.driftAng ?? 0) + dt * byPhase(b, R.driftRate);
  b.data.driftAng = drift;
  const c = roamCenter(w);
  let tx = c.x + Math.cos(drift) * R.driftR;
  let ty = c.y + Math.sin(drift) * R.driftR * R.driftYScale;
  if (aim.d < R.keepDist) {
    tx = b.x - (aim.dx / aim.d) * R.retreatDist;
    ty = b.y - (aim.dy / aim.d) * R.retreatDist;
  }
  tx = clamp(tx, R.edgeMargin, w.grid.width - R.edgeMargin);
  ty = clamp(ty, R.edgeMargin, w.grid.height - R.edgeMargin);
  const ox = tx - b.x;
  const oy = ty - b.y;
  const od = len(ox, oy) || 1;
  b.vx += (ox / od) * JELLY.accel * dt;
  b.vy += (oy / od) * JELLY.accel * dt;
}

// índices em `data`, para não repetir strings
const EXTEND = 0;
const SWEEP = 1;

export const JELLY_DEF: BossDef = {
  kind: "jelly",
  name: JELLY.name,
  rageLabel: JELLY.rageLabel,
  stats: {
    hp: JELLY.hp,
    radius: JELLY.radius,
    collRadius: JELLY.collRadius,
    speed: JELLY.speed,
    accel: JELLY.accel,
    drag: JELLY.drag,
    contactDamage: JELLY.contactDamage,
  },
  phases: [
    {
      hpBelow: JELLY.phaseBelow[0],
      thinkMs: JELLY.thinkMs[0],
      pool: ["ring", "beam", "pull", "shock"],
      rerollRepeatChance: JELLY.rerollRepeatChance,
    },
    {
      hpBelow: JELLY.phaseBelow[1],
      thinkMs: JELLY.thinkMs[1],
      // anel e raio cobrem mais água: pesam mais; chega o chamado das medusinhas, a onda de choque
      // pesa em dobro e a sucção (que quase não fere sozinha) sai
      pool: ["ring", "beam", "ring", "beam", "shock", "shock", "call"],
      rerollRepeatChance: JELLY.rerollRepeatChance,
    },
    {
      hpBelow: JELLY.phaseBelow[2],
      thinkMs: JELLY.thinkMs[2],
      // a fase final: chega o farol, e a sucção some quase por completo
      pool: ["ring", "beam", "pull", "shock", "shock", "call", "lighthouse", "lighthouse"],
      rerollRepeatChance: JELLY.rerollRepeatChance,
    },
  ],
  phaseChangeThinkMs: JELLY.phaseChangeThinkMs,
  attackBrake: JELLY.anchorBrake,
  contactRadiusScale: JELLY.contactRadiusScale,

  init(b) {
    b.data.pulse = 0;
    b.data.beamAng = 0;
    b.data.beamDir = 1;
    b.data.beamLen = JELLY.beam.length;
    b.data.beamTip = JELLY.beam.innerGap;
    b.data.beamStage = EXTEND;
    b.data.shockR = 0;
    b.data.shockGap = 0;
    b.data.callN = 0;
    b.data.lhBase = 0;
    b.data.lhDir = 1;
    b.data.lhSwept = 0;
    b.data.lhTip = JELLY.lighthouse.innerGap;
    b.data.lhStage = EXTEND;
  },

  animate(b, dt) {
    b.data.pulse = (b.data.pulse ?? 0) + dt * byPhase(b, JELLY.pulseRate);
  },

  maxSpeed: (b) => byPhase(b, JELLY.speedByPhase),

  // Ao entrar na fase 2 a parede que fecha a arena cede (a onda de destruição parte dela) e ela
  // passa a vaguear a partir de onde está, sem um salto. Uma troca que pula uma fase chama de novo,
  // e a segunda chamada não faz nada.
  onPhaseEnter(b, w, phase) {
    if (phase < 1) return;
    const c = roamCenter(w);
    b.data.driftAng = Math.atan2((b.y - c.y) / JELLY.roam.driftYScale, b.x - c.x);
    startBarrierBreak(w, b.x, b.y);
  },

  think(b, w, dt, aim) {
    if (b.phase >= 1 && JELLY.roam.enabled) {
      roam(b, w, dt, aim);
      return;
    }
    // fase 1: flutua a `hoverDist` do jogador, um pouco acima dele
    const ax = aim.d > 1 ? -aim.dx / aim.d : 1;
    const ay = aim.d > 1 ? -aim.dy / aim.d : 0;
    const tx = w.player.x + ax * JELLY.hoverDist;
    const ty = w.player.y + ay * JELLY.hoverDist + JELLY.hoverBias;
    const ox = tx - b.x;
    const oy = ty - b.y;
    const od = len(ox, oy) || 1;
    b.vx += (ox / od) * JELLY.accel * dt;
    b.vy += (oy / od) * JELLY.accel * dt;
  },

  orient(b, aimAng) {
    b.ang = angLerp(b.ang, aimAng, JELLY.turnLerp);
  },

  attacks: {
    // anel de esporos em todas as direções; nas fases seguintes, várias ondas giradas
    ring: {
      telegraphMs: (b) => byPhase(b, JELLY.ring.telegraphMs),
      executeMs: () => Infinity,
      onStart(b, w) {
        b.data.wave = 0;
        b.data.twist = w.rng.range(0, TAU);
        b.data.gapT = 0;
      },
      onExecute(b, w, _dt, _aim, dtMs) {
        b.data.gapT = (b.data.gapT ?? 0) - dtMs;
        if ((b.data.gapT ?? 0) > 0) return false;
        const R = JELLY.ring;
        const count = byPhase(b, R.count);
        const twist = b.data.twist ?? 0;
        for (let i = 0; i < count; i++) {
          const a = twist + (i / count) * TAU;
          const r = b.radius * R.spawnRadiusScale;
          fireProjectile(w, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, a, R.speed, byPhase(b, R.damage), R.r, R.lifeMs, R.color);
        }
        w.events.push({ t: "bossVolley", x: b.x, y: b.y, boss: b.kind, attack: "ring" });
        b.data.twist = twist + R.waveTwist;
        b.data.wave = (b.data.wave ?? 0) + 1;
        if ((b.data.wave ?? 0) >= byPhase(b, R.waves)) return true;
        b.data.gapT = R.waveGapMs;
        return false;
      },
    },

    beam: {
      telegraphMs: (b) => byPhase(b, JELLY.beam.telegraphMs),
      onTelegraph(b, w, _dt, aim) {
        // a mira acompanha o jogador até travar; o sentido do giro é sorteado no começo do
        // aviso, e o aviso desenha a seta (antes era decidido só na varredura)
        b.data.beamAng = Math.atan2(aim.dy, aim.dx);
        if (b.data.beamLocked !== 1) {
          b.data.beamDir = w.rng.next() < 0.5 ? -1 : 1;
          b.data.beamLocked = 1;
        }
        b.data.beamLen = rayLength(w.grid, b.x, b.y, b.data.beamAng, JELLY.beam.length, JELLY.beam.rayStep);
      },
      executeMs: () => Infinity,
      onStart(b) {
        b.data.beamLocked = 0;
        b.data.beamHit = 0;
        b.data.beamTip = JELLY.beam.innerGap;
        b.data.beamStage = EXTEND;
        b.data.beamActiveMs = 0;
        b.data.sweepLeft = byPhase(b, JELLY.beam.sweepMs);
      },
      onExecute(b, w, dt, _aim, dtMs) {
        const B = JELLY.beam;
        const len0 = rayLength(w.grid, b.x, b.y, b.data.beamAng ?? 0, B.length, B.rayStep);
        b.data.beamLen = len0;
        const reach = Math.min(len0, B.length);
        if (b.data.beamStage === EXTEND) {
          // esticar: a ponta viaja para fora e o raio ainda não gira; a varredura não corre
          const tip = (b.data.beamTip ?? B.innerGap) + B.growSpeed * dt;
          if (tip >= reach) {
            b.data.beamTip = reach;
            b.data.beamStage = SWEEP;
          } else {
            b.data.beamTip = tip;
          }
        } else {
          b.data.sweepLeft = (b.data.sweepLeft ?? 0) - dtMs;
          b.data.beamTip = reach;
          b.data.beamAng = (b.data.beamAng ?? 0) + byPhase(b, B.sweepSpeed) * (b.data.beamDir ?? 1) * dt;
        }
        // o dano só vale até onde a ponta chegou, e nunca antes do piso de reação
        b.data.beamActiveMs = (b.data.beamActiveMs ?? 0) + dtMs;
        const p = w.player;
        const canHurt = b.data.beamHit !== 1 && (b.data.beamActiveMs ?? 0) >= B.armDelayMs;
        if (canHurt && distInRay(b.x, b.y, b.data.beamAng ?? 0, B.innerGap, b.data.beamTip ?? 0, p.x, p.y) < B.halfWidth + p.radius) {
          hurtPlayer(w, byPhase(b, B.damage), b.x, b.y);
          b.data.beamHit = 1;
        }
        return b.data.beamStage === SWEEP && (b.data.sweepLeft ?? 0) <= 0;
      },
    },

    // sucção: puxa o jogador para o alcance dos ferrões
    pull: {
      telegraphMs: (b) => byPhase(b, JELLY.pull.telegraphMs),
      executeMs: () => JELLY.pull.durationMs,
      onStart(b) {
        b.data.stingerT = 0;
      },
      onExecute(b, w, dt, aim, dtMs) {
        const P = JELLY.pull;
        const p = w.player;
        if (aim.d < P.radius) {
          p.vx -= (aim.dx / aim.d) * P.force * dt;
          p.vy -= (aim.dy / aim.d) * P.force * dt;
          // bolha na corrente: visual, mas sorteada aqui para manter a sequência do protótipo
          if (w.rng.next() < P.streamBubbleChance) {
            w.events.push({ t: "pullStream", x: p.x + aim.dx * 0.3, y: p.y + aim.dy * 0.3 });
          }
        }
        b.data.stingerT = (b.data.stingerT ?? 0) - dtMs;
        if ((b.data.stingerT ?? 0) <= 0) {
          b.data.stingerT = byPhase(b, P.stingerEveryMs);
          const a = Math.atan2(aim.dy, aim.dx) + w.rng.range(-P.stingerSpread, P.stingerSpread);
          const r = b.radius * P.spawnRadiusScale;
          fireProjectile(w, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, a, P.stingerSpeed, P.damage, P.r, P.lifeMs, P.color);
        }
      },
    },

    // onda de choque: um anel que se expande, com uma fresta marcada no aviso
    shock: {
      telegraphMs: (b) => byPhase(b, JELLY.shock.telegraphMs),
      onTelegraph(b, w, _dt, aim) {
        // a fresta é sorteada no primeiro passo do aviso e fica fixa: o jogador a lê e vai até ela
        if (b.data.shockLocked === 1) return;
        const S = JELLY.shock;
        const side = w.rng.next() < 0.5 ? -1 : 1;
        const past = w.rng.range(S.gapMinPast, S.gapMaxPast);
        b.data.shockGap = Math.atan2(aim.dy, aim.dx) + side * (byPhase(b, S.gapHalf) + past);
        b.data.shockLocked = 1;
      },
      executeMs: () => Infinity,
      onStart(b) {
        b.data.shockLocked = 0;
        b.data.shockR = b.radius;
        b.data.shockHit = 0;
      },
      onExecute(b, w, dt) {
        const S = JELLY.shock;
        const r = (b.data.shockR ?? b.radius) + S.speed * dt;
        b.data.shockR = r;
        const p = w.player;
        const dx = p.x - b.x;
        const dy = p.y - b.y;
        if (b.data.shockHit !== 1 && !w.playerDead && Math.abs(len(dx, dy) - r) < S.band / 2 + p.radius) {
          const inGap = Math.abs(angDiff(b.data.shockGap ?? 0, Math.atan2(dy, dx))) <= byPhase(b, S.gapHalf);
          // a rocha para o anel, como para o raio: atrás de uma coluna ele não chega
          if (!inGap && hasLineOfSight(w.grid, b.x, b.y, p.x, p.y, LINE_OF_SIGHT.stepPx)) {
            if (hurtPlayer(w, byPhase(b, S.damage), b.x, b.y)) b.data.shockHit = 1;
          }
        }
        return r >= S.maxRadius;
      },
      next: (b, w) => combo(b, w, JELLY.chain.afterShock),
    },

    // chamado das medusinhas: crias ao redor, nos pontos marcados durante o aviso
    call: {
      telegraphMs: (b) => byPhase(b, JELLY.call.telegraphMs),
      onTelegraph(b, w) {
        if (b.data.callLocked === 1) return;
        b.data.callLocked = 1;
        const C = JELLY.call;
        let alive = 0;
        for (let i = 0; i < w.enemies.count; i++) {
          const e = w.enemies.get(i);
          if (!e.dead && e.kind === "jellyling" && e.noDrop) alive++;
        }
        const want = Math.min(byPhase(b, C.count), C.maxAlive - alive);
        const r = JELLYLING.radius * JELLYLING.collScale;
        let n = 0;
        for (let i = 0; i < want; i++) {
          // sorteia alguns ângulos até achar um ponto livre de rocha
          for (let tries = 0; tries < 8; tries++) {
            const a = w.rng.range(0, TAU);
            const x = b.x + Math.cos(a) * (b.radius + C.ringGap);
            const y = b.y + Math.sin(a) * (b.radius + C.ringGap);
            if (x < r || y < r || x > w.grid.width - r || y > w.grid.height - r || overlapsRock(w.grid, x, y, r)) continue;
            let crowded = false;
            for (let j = 0; j < n; j++) {
              if (len(x - (b.data[`callX${j}`] ?? 0), y - (b.data[`callY${j}`] ?? 0)) < C.minSeparation) crowded = true;
            }
            if (crowded) continue;
            b.data[`callX${n}`] = x;
            b.data[`callY${n}`] = y;
            n++;
            break;
          }
        }
        b.data.callN = n;
      },
      executeMs: () => 0,
      onStart(b, w) {
        const n = b.data.callN ?? 0;
        for (let i = 0; i < n; i++) {
          // crias de chefe: não soltam cura e não contam para a onda (GDD §5)
          spawnEnemy(w, "jellyling", b.data[`callX${i}`] ?? b.x, b.data[`callY${i}`] ?? b.y, true);
        }
        b.data.callLocked = 0;
      },
      next: (b, w) => combo(b, w, JELLY.chain.afterCall),
    },

    // farol: 3 raios a 120° que giram juntos; entre eles, cunhas seguras
    lighthouse: {
      telegraphMs: () => JELLY.lighthouse.telegraphMs,
      onTelegraph(b, w, _dt, aim) {
        // o layout trava no primeiro passo do aviso e o jogador está dentro da varredura do
        // primeiro raio (entre 25% e 75% dela): ele tem que se mexer para uma cunha segura
        if (b.data.lhLocked === 1) return;
        const L = JELLY.lighthouse;
        const dir = w.rng.next() < 0.5 ? -1 : 1;
        b.data.lhDir = dir;
        b.data.lhBase = Math.atan2(aim.dy, aim.dx) - dir * w.rng.range(0.25, 0.75) * L.sweepRad;
        b.data.lhLocked = 1;
      },
      executeMs: () => Infinity,
      onStart(b) {
        b.data.lhLocked = 0;
        b.data.lhSwept = 0;
        b.data.lhTip = JELLY.lighthouse.innerGap;
        b.data.lhStage = EXTEND;
        b.data.lhHit = 0;
        b.data.lhActiveMs = 0;
      },
      onExecute(b, w, dt, _aim, dtMs) {
        const L = JELLY.lighthouse;
        if (b.data.lhStage === EXTEND) {
          // esticar: as pontas viajam para fora e os raios ainda não giram
          const tip = (b.data.lhTip ?? L.innerGap) + L.growSpeed * dt;
          if (tip >= L.length) {
            b.data.lhTip = L.length;
            b.data.lhStage = SWEEP;
          } else {
            b.data.lhTip = tip;
          }
        } else {
          b.data.lhSwept = (b.data.lhSwept ?? 0) + L.sweepSpeed * dt;
        }
        b.data.lhActiveMs = (b.data.lhActiveMs ?? 0) + dtMs;
        const p = w.player;
        if (b.data.lhHit !== 1 && (b.data.lhActiveMs ?? 0) >= L.armDelayMs) {
          const base = (b.data.lhBase ?? 0) + (b.data.lhDir ?? 1) * (b.data.lhSwept ?? 0);
          for (let i = 0; i < L.arms; i++) {
            const a = base + (i / L.arms) * TAU;
            // cada raio para na primeira rocha (a sombra) e só vale até onde a ponta chegou
            const reach = Math.min(rayLength(w.grid, b.x, b.y, a, L.length, L.rayStep), b.data.lhTip ?? 0);
            if (distInRay(b.x, b.y, a, L.innerGap, reach, p.x, p.y) < L.halfWidth + p.radius) {
              if (hurtPlayer(w, L.damage, b.x, b.y)) b.data.lhHit = 1;
              break;
            }
          }
        }
        return b.data.lhStage === SWEEP && (b.data.lhSwept ?? 0) >= L.sweepRad;
      },
      next: (b, w) => combo(b, w, JELLY.chain.afterLighthouse),
    },
  },
};
