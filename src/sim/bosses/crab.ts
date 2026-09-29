import { CRAB } from "../../config/bosses/crab";
import { FISH } from "../../config/enemies/fish";
import { TAU, angLerp, clamp, len } from "../../core/math";
import { overlapsRock } from "../collision";
import { hurtPlayer } from "../combat";
import { spawnEnemy } from "../enemies/runner";
import type { World } from "../world";
import type { Boss, BossDef } from "./types";

// Caranguejo Abissal: pressão corpo a corpo (CONTEXTO §6.1, GDD §8.1). Porte do `updateCrab`
// do protótipo. Fase 2 abaixo de 50%: pausa menor, investida e pinça em dobro no sorteio e
// 55% de chance de emendar uma segunda investida com aviso encurtado.

/** Valor da fase atual num par [fase 1, fase 2]. */
const byPhase = <T>(b: Boss, pair: readonly [T, T]): T => (b.phase >= 1 ? pair[1] : pair[0]);

export const CRAB_DEF: BossDef = {
  kind: "crab",
  name: CRAB.name,
  rageLabel: CRAB.rageLabel,
  stats: {
    hp: CRAB.hp,
    radius: CRAB.radius,
    collRadius: CRAB.collRadius,
    speed: CRAB.speed,
    accel: CRAB.accel,
    drag: CRAB.drag,
    contactDamage: CRAB.contactDamage,
  },
  phases: [
    { hpBelow: 1, thinkMs: CRAB.thinkMs[0], pool: ["dash", "pinch", "call"], rerollRepeatChance: CRAB.rerollRepeatChance },
    {
      hpBelow: CRAB.phase2Below,
      thinkMs: CRAB.thinkMs[1],
      pool: ["dash", "pinch", "dash", "pinch", "call"],
      rerollRepeatChance: CRAB.rerollRepeatChance,
    },
  ],
  phaseChangeThinkMs: CRAB.phaseChangeThinkMs,
  slide: CRAB.slide,

  // enquanto pensa, se aproxima devagar: nunca está realmente parado
  think(b, _w, dt, aim) {
    const a = CRAB.accel * CRAB.thinkAccelScale * dt;
    b.vx += (aim.dx / aim.d) * a;
    b.vy += (aim.dy / aim.d) * a;
  },

  orient(b, aimAng) {
    b.ang = angLerp(b.ang, aimAng, CRAB.turnLerp);
  },

  attacks: {
    dash: {
      telegraphMs: (b) => byPhase(b, CRAB.dash.telegraphMs),
      onTelegraph(b, _w, dt, aim) {
        b.vx *= 1 - CRAB.dash.brake * dt;
        b.vy *= 1 - CRAB.dash.brake * dt;
        // a faixa de aviso acompanha o jogador até o último passo
        b.dirX = aim.dx / aim.d;
        b.dirY = aim.dy / aim.d;
      },
      executeMs: () => CRAB.dash.durationMs,
      onStart(b) {
        const s = byPhase(b, CRAB.dash.speed);
        b.vx = b.dirX * s;
        b.vy = b.dirY * s;
      },
      onExecute(b, w) {
        const blocked = b.blockedX || b.blockedY;
        // a investida checa o dano mesmo no passo em que termina, como no protótipo
        const p = w.player;
        if (len(p.x - b.x, p.y - b.y) < b.radius + p.radius + CRAB.dash.reach) hurtPlayer(w, CRAB.dash.damage, b.x, b.y);
        if (blocked) {
          // bateu numa formação: para e fica exposto
          w.events.push({ t: "bossImpact", x: b.x, y: b.y, boss: b.kind });
          return true;
        }
        return false;
      },
      next(b, w) {
        // fase 2: emenda uma segunda investida, com aviso mais curto
        if (b.phase >= 1 && w.rng.next() < CRAB.dash.chainChance) {
          return { attack: "dash", telegraphMs: CRAB.dash.telegraphMs[1] * CRAB.dash.chainTelegraphScale };
        }
        return null;
      },
      uncapped: true,
      ownContact: true,
      slides: true,
    },

    pinch: {
      telegraphMs: (b) => byPhase(b, CRAB.pinch.telegraphMs),
      onTelegraph(b, _w, dt) {
        b.vx *= 1 - CRAB.pinch.brake * dt;
        b.vy *= 1 - CRAB.pinch.brake * dt;
      },
      executeMs: () => CRAB.pinch.activeMs,
      fxSize: (b) => byPhase(b, CRAB.pinch.radius),
      onExecute(b, w, _dt, aim) {
        // o golpe inteiro dura `activeMs`; o raio é o da fase atual
        if (aim.d < byPhase(b, CRAB.pinch.radius)) hurtPlayer(w, CRAB.pinch.damage, b.x, b.y);
      },
    },

    call: {
      telegraphMs: () => CRAB.call.telegraphMs,
      onTelegraph(b, _w, dt) {
        b.vx *= 1 - CRAB.call.brake * dt;
        b.vy *= 1 - CRAB.call.brake * dt;
      },
      // instantâneo: os peixes aparecem no fim do aviso
      executeMs: () => 0,
      onStart(b, w) {
        const g = w.grid;
        const margin = FISH.radius + 5;
        for (let i = 0; i < CRAB.call.count; i++) {
          const a = w.rng.range(0, TAU);
          const r = b.radius + CRAB.call.ringGap;
          let x = clamp(b.x + Math.cos(a) * r, margin, g.width - margin);
          let y = clamp(b.y + Math.sin(a) * r, margin, g.height - margin);
          if (overlapsRock(g, x, y, FISH.radius)) {
            const spot = freeSpotAround(w, FISH.radius, CRAB.call.fallbackMinDist);
            if (!spot) continue;
            x = spot.x;
            y = spot.y;
          }
          // capangas de chefe: não soltam cura e não contam para a onda (GDD §5)
          spawnEnemy(w, "fish", x, y, true);
        }
      },
    },
  },
};

/** Ponto livre a pelo menos `minDist` do jogador, por tentativa (só no chamado, raro). */
function freeSpotAround(w: World, r: number, minDist: number): { x: number; y: number } | null {
  const g = w.grid;
  for (let i = 0; i < CRAB.call.fallbackTries; i++) {
    const x = w.rng.range(r, g.width - r);
    const y = w.rng.range(r, g.height - r);
    if (!overlapsRock(g, x, y, r) && len(x - w.player.x, y - w.player.y) >= minDist) return { x, y };
  }
  return null;
}
