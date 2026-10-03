import { describe, expect, it } from "vitest";
import type { EnemyKind } from "../../src/config/kinds";
import { SURGES, type SurgeDef } from "../../src/config/waves";
import { len } from "../../src/core/math";
import { remainingInWave, type PhaseFlow } from "../../src/sim/phase";
import { createMapWorld, stepWorld, type World } from "../../src/sim/world";
import { ABYSS } from "../../src/world/maps/abyss";
import { CORAL } from "../../src/world/maps/coral";
import { RIFT } from "../../src/world/maps/rift";
import { intent, STEP } from "./helpers";

// Levas (GDD §3.1): cada onda é uma sequência de levas, e cada leva entra de um jeito.

const idle = intent();

/**
 * Uma leva que nunca entra (sem gatilho). Mantém a onda viva enquanto o teste esvazia o campo: sem
 * ela, a onda sem ninguém terminaria na hora e viraria intervalo.
 */
const SENTINEL: SurgeDef = { enemies: [{ kind: "fish", count: 1 }], pattern: "scatter" };

/** As levas que o teste pôs, com a sentinela no fim. */
const setSurges = (f: PhaseFlow, list: readonly SurgeDef[]): void => {
  f.surges = [...list, SENTINEL];
};
const waiting = (f: PhaseFlow): number => f.surges.filter((s) => s !== SENTINEL).length;

function step(w: World, n = 1): void {
  for (let i = 0; i < n; i++) {
    if (w.hitStopMs > 0) w.hitStopMs -= STEP;
    else stepWorld(w, idle, STEP);
  }
}

/** Mundo parado no começo da onda `n`, com a fila e as levas esvaziadas para o teste pôr as suas. */
function waveWorld(map = RIFT, n = 1, seed = 1): { w: World; f: PhaseFlow } {
  const w = createMapWorld(map, seed);
  w.godMode = true;
  const f = w.phase;
  if (!f) throw new Error("sem fase");
  for (let i = 0; i < 40000 && !(f.state === "wave" && f.wave === n); i++) {
    // as ondas anteriores acabam sozinhas: mata o que nascer
    for (let k = 0; k < w.enemies.count; k++) w.enemies.get(k).dead = true;
    step(w);
  }
  if (f.wave !== n) throw new Error("não chegou à onda");
  for (let k = 0; k < w.enemies.count; k++) w.enemies.get(k).dead = true;
  f.queue.length = 0;
  f.pending.length = 0;
  setSurges(f, []);
  step(w);
  return { w, f };
}

const alive = (w: World): number => {
  let n = 0;
  for (let i = 0; i < w.enemies.count; i++) if (w.enemies.get(i).fromWave && !w.enemies.get(i).dead) n++;
  return n;
};

/** Põe uma leva (liberada já) e devolve onde cada um dos `count` inimigos vai nascer. */
function releaseAndCollect(w: World, f: PhaseFlow, surge: SurgeDef): { x: number; y: number }[] {
  setSurges(f, [{ ...surge, afterMs: 0 }]);
  const spots: { x: number; y: number }[] = [];
  const total = surge.enemies.reduce((s, g) => s + g.count, 0);
  for (let i = 0; i < 600 && spots.length < total; i++) {
    step(w);
    for (const e of w.events.list) if (e.t === "spawnWarn") spots.push({ x: e.x, y: e.y });
  }
  return spots;
}

const zoneOf = (f: PhaseFlow, p: { x: number; y: number }): number =>
  f.setup.spawnZones.findIndex((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);

describe("levas: a onda inteira conta, também o que ainda não entrou", () => {
  it("as levas que ainda não entraram contam: faltam todos os inimigos da onda", () => {
    for (const map of [RIFT, CORAL, ABYSS]) {
      for (let n = 1; n <= 3; n++) {
        const { w, f } = waveWorld(map, n);
        // volta ao começo da onda: libera a primeira leva de novo e soma o resto
        const def = map.waves[n - 1];
        if (!def) throw new Error("sem onda");
        f.surges = [...def.surges];
        f.queue.length = 0;
        const total = def.enemies.reduce((s, g) => s + g.count, 0);
        expect(remainingInWave(w, f), `${map.id} onda ${n}`).toBe(total);
      }
    }
  });

  it("toda onda tem nome, as levas somam o total e as levas depois da primeira têm gatilho", () => {
    for (const map of [RIFT, CORAL, ABYSS]) {
      for (const [i, wave] of map.waves.entries()) {
        expect(wave.title.length, `${map.id} onda ${i + 1}`).toBeGreaterThan(0);
        const byKind = new Map<EnemyKind, number>();
        for (const s of wave.surges) for (const g of s.enemies) byKind.set(g.kind, (byKind.get(g.kind) ?? 0) + g.count);
        for (const g of wave.enemies) expect(byKind.get(g.kind), `${map.id} onda ${i + 1} ${g.kind}`).toBe(g.count);
        wave.surges.forEach((s, k) => {
          if (k === 0) return;
          expect(s.afterMs !== undefined || s.whenAliveAtMost !== undefined, `${map.id} onda ${i + 1} leva ${k + 1}`).toBe(true);
        });
      }
    }
  });
});

describe("levas: quando a próxima entra", () => {
  it("sem ninguém em campo, a leva com `whenAliveAtMost` entra na hora e é anunciada no HUD", () => {
    const { w, f } = waveWorld(RIFT, 1);
    setSurges(f, [{ enemies: [{ kind: "fish", count: 2 }], pattern: "flank", afterMs: 6500, whenAliveAtMost: 1 }]);
    step(w);
    expect(waiting(f)).toBe(0);
    expect(f.banner).toBe(SURGES.banner.flank);
    expect(f.bannerMs).toBeGreaterThan(0);
  });

  it("com muitos em campo espera o tempo da leva; matar até sobrarem poucos adianta", () => {
    const { w, f } = waveWorld(RIFT, 1);
    // 3 peixes em campo: mais que o limite da leva seguinte
    setSurges(f, [{ enemies: [{ kind: "fish", count: 3 }], pattern: "scatter", afterMs: 0 }]);
    step(w, 200);
    expect(alive(w) + f.pending.length).toBe(3);
    setSurges(f, [{ enemies: [{ kind: "fish", count: 2 }], pattern: "flank", afterMs: 6500, whenAliveAtMost: 1 }]);
    f.sinceSurgeMs = 0;
    step(w, 60);
    expect(waiting(f), "ainda cedo e 3 vivos").toBe(1);
    // mata 2: sobra 1, e a leva entra
    let killed = 0;
    for (let i = 0; i < w.enemies.count && killed < 2; i++) {
      const e = w.enemies.get(i);
      if (e.fromWave && !e.dead) {
        e.dead = true;
        killed++;
      }
    }
    step(w, 2);
    expect(waiting(f)).toBe(0);
  });

  it("e pelo tempo: com 3 vivos que ninguém mata, a leva entra aos 6,5 s", () => {
    const { w, f } = waveWorld(RIFT, 1);
    setSurges(f, [{ enemies: [{ kind: "fish", count: 3 }], pattern: "scatter", afterMs: 0 }]);
    step(w, 200);
    setSurges(f, [{ enemies: [{ kind: "fish", count: 2 }], pattern: "flank", afterMs: 6500, whenAliveAtMost: 1 }]);
    f.sinceSurgeMs = 0;
    step(w, Math.floor(6000 / STEP));
    expect(waiting(f), "antes do tempo").toBe(1);
    step(w, Math.ceil(700 / STEP));
    expect(waiting(f), "passou o tempo").toBe(0);
  });
});

describe("levas: como cada padrão nasce", () => {
  it("flanco: todos da mesma zona, quase juntos", () => {
    for (const seed of [1, 2, 3]) {
      const { w, f } = waveWorld(RIFT, 2, seed);
      const spots = releaseAndCollect(w, f, { enemies: [{ kind: "fish", count: 4 }], pattern: "flank" });
      expect(spots.length).toBe(4);
      const zones = new Set(spots.map((p) => zoneOf(f, p)));
      expect(zones.size, `semente ${seed}`).toBe(1);
      expect([...zones][0]).toBeGreaterThanOrEqual(0);
      for (const p of spots) expect(len(p.x - w.player.x, p.y - w.player.y)).toBeGreaterThanOrEqual(220);
    }
  });

  it("pinça: duas zonas diferentes, e as duas ficam em lados opostos", () => {
    for (const seed of [1, 2, 3]) {
      const { w, f } = waveWorld(RIFT, 2, seed);
      const spots = releaseAndCollect(w, f, { enemies: [{ kind: "fish", count: 4 }], pattern: "pincer" });
      expect(spots.length).toBe(4);
      const zones = new Set(spots.map((p) => zoneOf(f, p)));
      expect(zones.size, `semente ${seed}`).toBe(2);
      const [a, b] = [...zones] as [number, number];
      const za = f.setup.spawnZones[a]!;
      const zb = f.setup.spawnZones[b]!;
      // as duas zonas distam de verdade (mais que a menor distância entre quaisquer duas)
      const d = len(za.x + za.w / 2 - zb.x - zb.w / 2, za.y + za.h / 2 - zb.y - zb.h / 2);
      expect(d).toBeGreaterThan(400);
    }
  });

  it("cerco: em volta do jogador, na distância do anel e em lados diferentes", () => {
    for (const seed of [1, 2, 3]) {
      const { w, f } = waveWorld(CORAL, 3, seed);
      const spots = releaseAndCollect(w, f, { enemies: [{ kind: "circler", count: 4 }], pattern: "ring" });
      expect(spots.length).toBe(4);
      let inRing = 0;
      const quadrants = new Set<number>();
      for (const p of spots) {
        const d = len(p.x - w.player.x, p.y - w.player.y);
        if (d >= SURGES.ringRadius[0] - 1 && d <= SURGES.ringRadius[1] + 1) inRing++;
        quadrants.add(Math.floor((Math.atan2(p.y - w.player.y, p.x - w.player.x) + Math.PI) / (Math.PI / 2)));
      }
      // a rocha pode tirar um do anel (cai no nascimento comum), mas a maioria fica nele
      expect(inRing, `semente ${seed}`).toBeGreaterThanOrEqual(3);
      expect(quadrants.size, `semente ${seed}`).toBeGreaterThanOrEqual(3);
    }
  });

  it("os estáticos não seguem o padrão: nascem nas posições fixas", () => {
    const { w, f } = waveWorld(RIFT, 3);
    const spots = releaseAndCollect(w, f, { enemies: [{ kind: "urchin", count: 2 }], pattern: "ring" });
    expect(spots.length).toBe(2);
    for (const p of spots) expect(len(p.x - w.player.x, p.y - w.player.y)).toBeGreaterThanOrEqual(220);
    const fixed = f.setup.spots?.urchin ?? [];
    for (const p of spots) expect(fixed.some((s) => Math.abs(s.x - p.x) < 1 && Math.abs(s.y - p.y) < 1)).toBe(true);
  });

  it("flanco, pinça e cerco entram quase juntos: o intervalo é o das levas, não o de 600 ms", () => {
    const { w, f } = waveWorld(RIFT, 2);
    setSurges(f, [{ enemies: [{ kind: "fish", count: 4 }], pattern: "flank", afterMs: 0 }]);
    const at: number[] = [];
    for (let i = 0; i < 300 && at.length < 4; i++) {
      step(w);
      for (const e of w.events.list) if (e.t === "spawnWarn") at.push(w.timeMs);
    }
    expect(at.length).toBe(4);
    expect((at[3] ?? 0) - (at[0] ?? 0)).toBeLessThan(SURGES.staggerMs * 3 + 60);
  });
});
