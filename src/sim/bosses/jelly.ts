import { JELLY } from "../../config/bosses/jelly";
import { TAU, angLerp, len } from "../../core/math";
import { hurtPlayer } from "../combat";
import { distInRay, rayLength } from "../geometry";
import { fireProjectile } from "../projectiles";
import type { Boss, BossDef } from "./types";

// Água-viva Colossal: controle de espaço (CONTEXTO §6.2, GDD §8.2). Porte do `updateJelly` do
// protótipo. Flutua longe, enche a água de esporos, varre com o raio e suga o jogador. Não tem
// ataque corpo a corpo.
//
// O raio é o ataque que precisou de três versões no protótipo. As sete regras continuam:
// a ponta viaja para fora (tempo de reação), não gira enquanto estica, vão interno seguro, a
// rocha faz sombra, um acerto por varredura, piso de reação, e ω · 215 < 250 (config).
// O `b.t += DTMS` do protótipo virou dois subestágios explícitos: esticar e varrer.

const byPhase = <T>(b: Boss, pair: readonly [T, T]): T => (b.phase >= 1 ? pair[1] : pair[0]);

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
    { hpBelow: 1, thinkMs: JELLY.thinkMs[0], pool: ["ring", "beam", "pull"], rerollRepeatChance: JELLY.rerollRepeatChance },
    {
      hpBelow: JELLY.phase2Below,
      thinkMs: JELLY.thinkMs[1],
      // anel e raio cobrem mais água: pesam mais na fase 2
      pool: ["ring", "beam", "ring", "beam", "pull"],
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
  },

  animate(b, dt) {
    b.data.pulse = (b.data.pulse ?? 0) + dt * byPhase(b, JELLY.pulseRate);
  },

  // flutua a `hoverDist` do jogador, um pouco acima dele
  think(b, w, dt, aim) {
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
    // anel de esporos em todas as direções; na fase 2, três ondas giradas
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
          fireProjectile(w, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, a, R.speed, R.damage, R.r, R.lifeMs, R.color);
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
          hurtPlayer(w, B.damage, b.x, b.y);
          b.data.beamHit = 1;
        }
        return b.data.beamStage === SWEEP && (b.data.sweepLeft ?? 0) <= 0;
      },
    },

    // sucção: puxa o jogador para o alcance dos ferrões
    pull: {
      telegraphMs: () => JELLY.pull.telegraphMs,
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
          b.data.stingerT = P.stingerEveryMs;
          const a = Math.atan2(aim.dy, aim.dx) + w.rng.range(-P.stingerSpread, P.stingerSpread);
          const r = b.radius * P.spawnRadiusScale;
          fireProjectile(w, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, a, P.stingerSpeed, P.damage, P.r, P.lifeMs, P.color);
        }
      },
    },
  },
};
