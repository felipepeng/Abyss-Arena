import { EYE } from "../../config/bosses/eye";
import { TAU, angLerp, clamp, len } from "../../core/math";
import { dissolvePillars } from "../pillars";
import { fireProjectile } from "../projectiles";
import type { Boss, BossDef } from "./types";

// Olho do Abismo: bullet hell (CONTEXTO §6.3, GDD §8.3). Porte do `updateEye` do protótipo.
// Fica longe, quase não se move e enche a arena de padrões. Três coisas impedem o jogador de
// só acampar atrás de uma pedra:
//   1. o CERCO nasce num anel em volta dele e vem de todos os lados;
//   2. os PERSEGUIDORES atravessam a rocha;
//   3. os impactos erodem a pedra, e as fases 2 e 3 a dissolvem.
// Diferença do protótipo: ele não troca de arena ao nascer (o Fosso já é a arena dele).

const byPhase = <T>(b: Boss, trio: readonly [T, T, T]): T => trio[Math.min(b.phase, 2)] as T;

export const EYE_DEF: BossDef = {
  kind: "eye",
  name: EYE.name,
  rageLabel: EYE.rageLabel,
  stats: {
    hp: EYE.hp,
    radius: EYE.radius,
    collRadius: EYE.collRadius,
    speed: EYE.speed,
    accel: EYE.accel,
    drag: EYE.drag,
    contactDamage: EYE.contactDamage,
  },
  phases: [
    { hpBelow: EYE.phaseAt[0], inclusive: true, thinkMs: EYE.thinkMs[0], pool: ["fan", "spiral", "siege"], rerollRepeatChance: EYE.rerollRepeatChance },
    {
      hpBelow: EYE.phaseAt[1],
      inclusive: true,
      thinkMs: EYE.thinkMs[1],
      pool: ["fan", "spiral", "siege", "seek", "spiral"],
      rerollRepeatChance: EYE.rerollRepeatChance,
    },
    {
      hpBelow: EYE.phaseAt[2],
      inclusive: true,
      thinkMs: EYE.thinkMs[2],
      pool: ["spiral", "siege", "seek", "rain", "siege", "fan"],
      rerollRepeatChance: EYE.rerollRepeatChance,
    },
  ],
  phaseChangeThinkMs: EYE.phaseChangeThinkMs,
  firstThinkMs: EYE.firstThinkMs,
  phaseChangeSkipsStep: true,
  attackBrake: EYE.anchorBrake,
  contactRadiusScale: EYE.contactRadiusScale,

  init(b, w) {
    b.data.pulse = 0;
    b.data.driftAng = w.rng.range(0, TAU);
    b.data.aimAng = 0;
    b.data.siegeX = w.player.x;
    b.data.siegeY = w.player.y;
  },

  animate(b, dt) {
    b.data.pulse = (b.data.pulse ?? 0) + dt * (EYE.pulseRate.base + (b.phase + 1) * EYE.pulseRate.perPhase);
  },

  // a cada fase, parte dos pilares some
  onPhaseEnter(_b, w, phase) {
    dissolvePillars(w, EYE.pillarKeepByPhase[Math.min(phase, 2)] ?? 0, EYE.dissolveBubbleChance);
  },

  // vagueia devagar perto do centro, sem deixar o jogador colar
  think(b, w, dt, aim) {
    const drift = (b.data.driftAng ?? 0) + dt * EYE.driftRate;
    b.data.driftAng = drift;
    let tx = w.grid.width / 2 + Math.cos(drift) * EYE.driftR;
    let ty = w.grid.height / 2 + Math.sin(drift) * EYE.driftR * EYE.driftYScale;
    if (aim.d < EYE.keepDist) {
      tx = b.x - (aim.dx / aim.d) * EYE.retreatDist;
      ty = b.y - (aim.dy / aim.d) * EYE.retreatDist;
    }
    const ox = tx - b.x;
    const oy = ty - b.y;
    const od = len(ox, oy) || 1;
    b.vx += (ox / od) * EYE.accel * dt;
    b.vy += (oy / od) * EYE.accel * dt;
  },

  orient(b, aimAng) {
    b.ang = angLerp(b.ang, aimAng, EYE.turnLerp);
  },

  attacks: {
    // leque mirado, em salvas: a cobertura funciona contra este
    fan: {
      telegraphMs: (b) => byPhase(b, EYE.fan.telegraphMs),
      onTelegraph(b, _w, _dt, aim) {
        b.data.aimAng = Math.atan2(aim.dy, aim.dx);
      },
      executeMs: () => Infinity,
      onStart(b) {
        b.data.volley = 0;
        b.data.volleyT = 0;
      },
      onExecute(b, w, _dt, aim, dtMs) {
        b.data.volleyT = (b.data.volleyT ?? 0) - dtMs;
        if ((b.data.volleyT ?? 0) > 0) return false;
        const F = EYE.fan;
        const n: number = byPhase(b, F.count);
        // cada salva mira de novo no jogador
        const aimAng = Math.atan2(aim.dy, aim.dx);
        b.data.aimAng = aimAng;
        for (let k = 0; k < n; k++) {
          const a = aimAng + (n === 1 ? 0 : (k / (n - 1) - 0.5) * F.spread);
          const r = b.radius * EYE.muzzleScale;
          fireProjectile(w, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, a, F.speed, F.damage, F.r, F.lifeMs, F.color, { erodes: true });
        }
        w.events.push({ t: "bossVolley", x: b.x, y: b.y, boss: b.kind, attack: "fan" });
        b.data.volley = (b.data.volley ?? 0) + 1;
        if ((b.data.volley ?? 0) >= byPhase(b, F.volleys)) return true;
        b.data.volleyT = F.volleyGapMs;
        return false;
      },
    },

    // espiral: braços girando que enchem a água
    spiral: {
      telegraphMs: () => EYE.spiral.telegraphMs,
      executeMs: (b) => byPhase(b, EYE.spiral.durationMs),
      onStart(b, w) {
        b.data.spiralAng = w.rng.range(0, TAU);
        b.data.emitT = 0;
        b.data.spiralDir = w.rng.next() < 0.5 ? -1 : 1;
      },
      onExecute(b, w, dt, _aim, dtMs) {
        const S = EYE.spiral;
        const ang = (b.data.spiralAng ?? 0) + S.spinSpeed * (b.data.spiralDir ?? 1) * dt;
        b.data.spiralAng = ang;
        b.data.emitT = (b.data.emitT ?? 0) - dtMs;
        if ((b.data.emitT ?? 0) <= 0) {
          b.data.emitT = S.emitEveryMs;
          const arms = byPhase(b, S.arms);
          for (let k = 0; k < arms; k++) {
            const a = ang + (k / arms) * TAU;
            const r = b.radius * EYE.muzzleScale;
            fireProjectile(w, b.x + Math.cos(a) * r, b.y + Math.sin(a) * r, a, S.speed, S.damage, S.r, S.lifeMs, S.color, { erodes: true });
          }
        }
      },
    },

    // CERCO: nasce em volta do jogador (a posição acompanha durante o aviso e trava no fim)
    siege: {
      telegraphMs: () => EYE.siege.telegraphMs,
      onTelegraph(b, w) {
        b.data.siegeX = w.player.x;
        b.data.siegeY = w.player.y;
      },
      executeMs: () => 0,
      onStart(b, w) {
        const S = EYE.siege;
        const n = byPhase(b, S.count);
        const off = w.rng.range(0, TAU);
        const sx = b.data.siegeX ?? w.player.x;
        const sy = b.data.siegeY ?? w.player.y;
        for (let k = 0; k < n; k++) {
          const a = off + (k / n) * TAU;
          fireProjectile(w, sx + Math.cos(a) * S.ringR, sy + Math.sin(a) * S.ringR, a + Math.PI, S.speed, S.damage, S.r, S.lifeMs, S.color, { erodes: true });
        }
        w.events.push({ t: "bossVolley", x: sx, y: sy, boss: b.kind, attack: "siege" });
      },
    },

    // perseguidores: curvam na direção do jogador e ATRAVESSAM a rocha
    seek: {
      telegraphMs: () => EYE.seekers.telegraphMs,
      executeMs: () => 0,
      onStart(b, w) {
        const S = EYE.seekers;
        const n = byPhase(b, S.count);
        for (let k = 0; k < n; k++) {
          const a = (k / Math.max(1, n)) * TAU + w.rng.range(-S.jitter, S.jitter);
          fireProjectile(w, b.x + Math.cos(a) * b.radius, b.y + Math.sin(a) * b.radius, a, S.speed, S.damage, S.r, S.lifeMs, S.color, {
            ignoresRock: true,
            turnRate: S.turnRate,
            erodes: true,
          });
        }
      },
    },

    // chuva do alto do mapa, numa faixa centrada no jogador (fase 3)
    rain: {
      telegraphMs: () => EYE.rain.telegraphMs,
      executeMs: () => EYE.rain.durationMs,
      onStart(b) {
        b.data.emitT = 0;
      },
      onExecute(b, w, _dt, _aim, dtMs) {
        const R = EYE.rain;
        b.data.emitT = (b.data.emitT ?? 0) - dtMs;
        if ((b.data.emitT ?? 0) > 0) return;
        b.data.emitT = R.everyMs;
        for (let k = 0; k < R.perEmit; k++) {
          const px = clamp(w.player.x + w.rng.range(-R.spreadX, R.spreadX), R.edgeMargin, w.grid.width - R.edgeMargin);
          const ang = Math.PI / 2 + w.rng.range(-R.angleJitter, R.angleJitter);
          fireProjectile(w, px, R.spawnY, ang, R.speed, R.damage, R.r, R.lifeMs, R.color, { erodes: true });
        }
      },
    },
  },
};
