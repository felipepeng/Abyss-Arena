import { describe, expect, it } from "vitest";
import { ANEMONE } from "../../src/config/enemies/anemone";
import { FISH } from "../../src/config/enemies/fish";
import { HERMIT } from "../../src/config/enemies/hermit";
import { JELLYLING } from "../../src/config/enemies/jellyling";
import { LAMPREY } from "../../src/config/enemies/lamprey";
import { URCHIN } from "../../src/config/enemies/urchin";
import { WATCHER } from "../../src/config/enemies/watcher";
import type { EnemyKind } from "../../src/config/kinds";
import { PLAYER } from "../../src/config/player";
import { SPEAR } from "../../src/config/spear";
import { angDiff, len } from "../../src/core/math";
import { canSee } from "../../src/sim/enemies/perception";
import { setState, spawnEnemy } from "../../src/sim/enemies/runner";
import type { Enemy } from "../../src/sim/enemies/types";
import type { SimEvent } from "../../src/sim/events";
import { createMapWorld, stepWorld, type World } from "../../src/sim/world";
import { buildMap } from "../../src/world/builder";
import { Cell } from "../../src/world/grid";
import { overlapsRock } from "../../src/sim/collision";
import { CORAL, CORAL_ANEMONE_SPOTS } from "../../src/world/maps/coral";
import { RIFT, RIFT_URCHIN_SPOTS } from "../../src/world/maps/rift";
import { ABYSS } from "../../src/world/maps/abyss";
import { aimRight, intent, openGrid, openWorld, STEP, steps } from "./helpers";

// M5: os seis inimigos exclusivos (GDD §6.2). Cada um com o seu comportamento e, para todos,
// a regra 2 (todo ataque avisa) e a regra 6 (bloquear não dá hit-stop).

const STAB = { attackPressed: true, attackHeld: true, attackPressedByMouse: true };

/** Uma estocada sem carga contra o que estiver à direita; devolve os eventos de todos os passos. */
function stab(w: World): SimEvent[] {
  const all: SimEvent[] = [];
  const grab = () => all.push(...w.events.list);
  stepWorld(w, aimRight(w, STAB), STEP);
  grab();
  for (let i = 0; i < 30; i++) {
    if (w.hitStopMs > 0) {
      w.hitStopMs -= STEP;
      continue;
    }
    stepWorld(w, aimRight(w), STEP);
    grab();
  }
  return all;
}

function spawn(w: World, kind: EnemyKind, x: number, y: number): Enemy {
  const e = spawnEnemy(w, kind, x, y);
  if (!e) throw new Error("pool cheio");
  return e;
}

describe("Ermitão: blindagem frontal", () => {
  it("bloqueia a estocada de frente: sem dano, sem hit-stop, com recuo do jogador", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "hermit", 650, 600); // nasce olhando para o jogador
    let hitStop = 0;
    let vxAtBlock = 0;
    const events: SimEvent[] = [];
    stepWorld(w, aimRight(w, STAB), STEP);
    for (let i = 0; i < 30; i++) {
      events.push(...w.events.list);
      if (w.events.list.some((ev) => ev.t === "spearBlocked")) vxAtBlock = w.player.vx;
      hitStop = Math.max(hitStop, w.hitStopMs);
      stepWorld(w, aimRight(w), STEP);
    }
    expect(events.filter((ev) => ev.t === "spearBlocked")).toHaveLength(1);
    expect(events.some((ev) => ev.t === "spearHit")).toBe(false);
    expect(e.hp).toBe(HERMIT.hp);
    expect(hitStop).toBe(0);
    expect(vxAtBlock).toBeLessThan(0);
  });

  it("uma estocada pelas costas causa dano e hit-stop", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "hermit", 650, 600);
    e.ang = e.prevAng = 0; // de costas para o jogador (que está à esquerda)
    let hitStop = 0;
    const events: SimEvent[] = [];
    stepWorld(w, aimRight(w, STAB), STEP);
    for (let i = 0; i < 30; i++) {
      events.push(...w.events.list);
      hitStop = Math.max(hitStop, w.hitStopMs);
      if (w.hitStopMs > 0) w.hitStopMs -= STEP;
      else stepWorld(w, aimRight(w), STEP);
    }
    expect(events.some((ev) => ev.t === "spearHit")).toBe(true);
    expect(events.some((ev) => ev.t === "spearBlocked")).toBe(false);
    // estocada sem carga: 16 de dano, mais a fração do passo em que ainda estava segurando
    expect(HERMIT.hp - e.hp).toBeGreaterThanOrEqual(SPEAR.damage);
    expect(HERMIT.hp - e.hp).toBeLessThan(SPEAR.damage + 1.5);
    expect(hitStop).toBe(SPEAR.hitStopMs);
  });

  it("só gira a HERMIT.turnRate: contornar por ele funciona", () => {
    const w = openWorld({ start: { x: 600, y: 600 } });
    w.godMode = true;
    const e = spawn(w, "hermit", 700, 600);
    // de costas para o jogador (que está à esquerda), de repente
    e.ang = e.prevAng = 0;
    const before = e.ang;
    steps(w, 30, (w) => intent({ aimX: w.player.x, aimY: w.player.y }));
    // 0,5 s na taxa dele, não os ~3,14 rad da volta inteira
    const turned = Math.abs(e.ang - before);
    expect(turned).toBeCloseTo(HERMIT.turnRate * 0.5, 1);
  });

  it("regra 3: a frente que gira (e leva a pinça) obedece ω · distância < 250 px/s", () => {
    expect(HERMIT.turnRate * HERMIT.attackRange).toBeLessThan(250);
  });

  it("a pinça só alcança a frente: por trás, não fere", () => {
    const w = openWorld();
    const e = spawn(w, "hermit", 630, 600);
    e.ang = e.prevAng = 0; // olhando para longe do jogador
    setState(e, w, "strike");
    // o ermitão em ataque tem dano cheio de contato (12) se encostar, mas o jogador está a 30 px
    // (raios 14 + 9 = 23): fora do contato e fora do arco da frente
    stepWorld(w, aimRight(w), STEP);
    expect(w.player.hp).toBe(PLAYER.hp);
  });
});

describe("Anêmona-chicote: varredura de 270°", () => {
  /** Roda até `pred` valer (ou 10 s) e devolve os ms decorridos. */
  function until(w: World, pred: () => boolean): number {
    const t0 = w.timeMs;
    for (let i = 0; i < 600 && !pred(); i++) stepWorld(w, aimRight(w), STEP);
    return w.timeMs - t0;
  }

  it("descansa, avisa 600 ms e varre por 270° / 2 rad/s, e volta a descansar", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "anemone", 700, 600);
    e.t = 0;
    const warn = until(w, () => e.state === "telegraph");
    expect(warn).toBeLessThan(100);
    const telegraph = until(w, () => e.state === "sweep");
    expect(telegraph).toBeGreaterThanOrEqual(ANEMONE.telegraphMs - STEP);
    expect(telegraph).toBeLessThanOrEqual(ANEMONE.telegraphMs + 2 * STEP);
    const sweep = until(w, () => e.state === "rest");
    const expected = (ANEMONE.sweepRad / ANEMONE.omega) * 1000;
    expect(sweep).toBeGreaterThanOrEqual(expected - 2 * STEP);
    expect(sweep).toBeLessThanOrEqual(expected + 2 * STEP);
  });

  it("o braço fere quem está no alcance dele, uma vez por passada, e só durante a varredura", () => {
    const w = openWorld({ start: { x: 780, y: 600 } });
    const e = spawn(w, "anemone", 700, 600); // o jogador a 80 px, dentro do alcance de 110
    e.t = 0;
    until(w, () => e.state === "telegraph");
    until(w, () => e.state === "sweep");
    // o aviso inteiro passou sem dano
    expect(w.player.hp).toBe(PLAYER.hp);
    until(w, () => e.state === "rest");
    // a varredura passa por onde o jogador estava: uma pancada só (a invulnerabilidade do funil)
    expect(w.player.hp).toBe(PLAYER.hp - ANEMONE.contactDamage);
  });

  it("fora do alcance do braço (mais de ~125 px), não fere", () => {
    const w = openWorld({ start: { x: 850, y: 600 } });
    const e = spawn(w, "anemone", 700, 600); // a 150 px
    e.t = 0;
    steps(w, 60 * 8, (w) => aimRight(w));
    expect(w.player.hp).toBe(PLAYER.hp);
  });

  it("a rocha corta o braço: o coral dá cobertura, como contra o raio da Água-viva", () => {
    const covered = (wall: boolean): number => {
      const grid = openGrid(100, 60);
      if (wall) grid.fill(37, 2, 37, 57, Cell.Rock); // x = 740..760, entre os dois
      const w = openWorld({ grid, start: { x: 790, y: 600 } });
      const e = spawn(w, "anemone", 700, 600);
      e.t = 0;
      steps(w, 60 * 5, (w) => aimRight(w));
      return PLAYER.hp - w.player.hp;
    };
    expect(covered(false)).toBe(ANEMONE.contactDamage);
    expect(covered(true)).toBe(0);
  });

  it("regra 3: a ponta do braço anda a menos que o nado (ω · comprimento < 250 px/s)", () => {
    expect(ANEMONE.omega * ANEMONE.armLen).toBeLessThan(250);
  });

  it("o corpo leva a lança normalmente, com dano e hit-stop", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "anemone", 640, 600);
    e.t = 1e9; // descansando
    const events = stab(w);
    expect(events.some((ev) => ev.t === "spearHit")).toBe(true);
    expect(e.hp).toBeLessThan(ANEMONE.hp);
  });
});

describe("Ouriço: rajada de espinhos", () => {
  it("avisa 500 ms e solta 8 espinhos que somem a 110 px da borda", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "urchin", 900, 600);
    setState(e, w, "telegraph");
    let fired = 0;
    let maxFromCenter = 0;
    for (let i = 0; i < 90; i++) {
      stepWorld(w, aimRight(w), STEP);
      if (w.events.list.some((ev) => ev.t === "attackStart")) fired = w.projectiles.count;
      for (let k = 0; k < w.projectiles.count; k++) {
        const p = w.projectiles.get(k);
        maxFromCenter = Math.max(maxFromCenter, len(p.x - e.x, p.y - e.y));
        expect(p.color).toBe(URCHIN.spikeColor);
      }
    }
    expect(fired).toBe(URCHIN.spikes);
    // borda (12) + alcance (110), com a folga de um passo
    expect(maxFromCenter).toBeLessThanOrEqual(URCHIN.radius + URCHIN.spikeRange + URCHIN.spikeSpeed * STEP / 1000 + 0.5);
    expect(w.projectiles.count).toBe(0);
  });

  it("não sai do lugar, nem quando a lança o empurra", () => {
    const w = openWorld();
    const e = spawn(w, "urchin", 640, 600);
    stab(w);
    steps(w, 60, (w) => aimRight(w));
    expect(len(e.x - 640, e.y - 600)).toBeLessThan(0.01);
  });
});

describe("dano de contato", () => {
  /** Encosta a criatura no jogador, parada, e devolve a vida perdida em um passo. */
  function contact(kind: EnemyKind, state?: string): number {
    const w = openWorld();
    const e = spawn(w, kind, 606, 600);
    if (state) setState(e, w, state);
    stepWorld(w, aimRight(w), STEP);
    return PLAYER.hp - w.player.hp;
  }

  it("Ouriço, Medusinha e Vigia sempre causam o dano cheio de contato", () => {
    expect(contact("urchin")).toBe(URCHIN.contactDamage);
    expect(contact("jellyling")).toBe(JELLYLING.contactDamage);
    expect(contact("watcher")).toBe(WATCHER.contactDamage);
  });

  it("Ermitão e Lampreia: metade fora do ataque (arredondada para cima), cheio nele", () => {
    expect(contact("hermit")).toBe(Math.ceil(HERMIT.contactDamage / 2));
    expect(contact("lamprey")).toBe(Math.ceil(LAMPREY.contactDamage / 2));
    expect(contact("lamprey", "bite")).toBe(LAMPREY.contactDamage);
  });

  it("Anêmona: metade em repouso (arredondada para cima), cheio na varredura", () => {
    expect(contact("anemone")).toBe(Math.ceil(ANEMONE.contactDamage / 2));
    expect(contact("anemone", "sweep")).toBe(ANEMONE.contactDamage);
  });
});

describe("Lampreia: enxame frágil", () => {
  it("sobrevive a uma estocada sem carga e morre na segunda", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "lamprey", 640, 600);
    e.t = 1e9; // não ataca durante o teste
    stab(w);
    // 16 (mais a fração do passo de carga): sobra pouco, mas sobra
    expect(e.hp).toBeGreaterThan(0);
    expect(e.hp).toBeLessThan(LAMPREY.hp - SPEAR.damage + 0.01);
    expect(e.dead).toBe(false);
    e.x = e.prevX = w.player.x + 40;
    e.y = e.prevY = w.player.y;
    e.vx = e.vy = 0;
    stab(w);
    expect(e.dead || w.enemies.count === 0).toBe(true);
  });
});

describe("sem ver o jogador, vão devagar até ele", () => {
  it.each([
    ["fish", 1300, FISH.sightR, FISH.farSpeed],
    ["lamprey", 1600, LAMPREY.sightR, LAMPREY.farSpeed],
  ] as const)("%s longe do raio de visão se aproxima, sem passar da velocidade lenta", (kind, x, sightR, farSpeed) => {
    const w = openWorld({ grid: openGrid(140, 60) });
    w.godMode = true;
    const e = spawn(w, kind, x, 600);
    e.t = 1e9; // não ataca durante o teste
    let maxSpeed = 0;
    steps(w, 240, (w) => {
      // só conta enquanto ainda está fora do raio de visão (dentro dele, a perseguição é normal)
      if (len(e.x - w.player.x, e.y - w.player.y) >= sightR) maxSpeed = Math.max(maxSpeed, len(e.vx, e.vy));
      return aimRight(w);
    });
    expect(x - e.x).toBeGreaterThan(60);
    // um passo de aceleração acima do teto lento (accel · dt), no máximo
    expect(maxSpeed).toBeLessThan(farSpeed + 20);
  });
});

describe("linha de visão", () => {
  /** Arena com uma parede inteira entre o jogador (x=600) e a criatura (x=1000). */
  function walled(kind: EnemyKind): World {
    const grid = openGrid(100, 60);
    grid.fill(40, 2, 40, 57, Cell.Rock); // x = 800..820
    const w = openWorld({ grid });
    w.godMode = true;
    const e = spawn(w, kind, 1000, 600);
    e.t = 0;
    return w;
  }

  function attacks(w: World, seconds: number): number {
    let n = 0;
    for (let i = 0; i < seconds * 60; i++) {
      stepWorld(w, aimRight(w), STEP);
      n += w.events.list.filter((ev) => ev.t === "attackStart").length;
    }
    return n;
  }

  it("canSee: parede corta a visão, e o alcance também", () => {
    const w = walled("jellyling");
    const e = w.enemies.get(0);
    expect(canSee(e, w, 1000)).toBe(false);
    e.x = 700;
    expect(canSee(e, w, 1000)).toBe(true);
    expect(canSee(e, w, 50)).toBe(false);
  });

  it("Medusinha e Vigia não atiram atrás de uma parede", () => {
    expect(attacks(walled("jellyling"), 20)).toBe(0);
    expect(attacks(walled("watcher"), 20)).toBe(0);
  });

  it("e atiram quando o caminho está livre", () => {
    for (const kind of ["jellyling", "watcher"] as const) {
      const w = openWorld();
      w.godMode = true;
      const e = spawn(w, kind, 900, 600);
      e.t = 0;
      expect(attacks(w, 20), kind).toBeGreaterThan(0);
    }
  });
});

describe("Vigia: leque de 3 tiros", () => {
  it("dispara 3 projéteis a 0,3 rad um do outro, na cor do Vigia", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "watcher", 900, 600);
    e.t = 0;
    let shots: { vx: number; vy: number; color: string }[] = [];
    for (let i = 0; i < 120 && shots.length === 0; i++) {
      stepWorld(w, aimRight(w), STEP);
      if (w.events.list.some((ev) => ev.t === "attackStart")) {
        for (let k = 0; k < w.projectiles.count; k++) shots.push(w.projectiles.get(k));
        shots = shots.map((p) => ({ vx: p.vx, vy: p.vy, color: p.color }));
      }
    }
    expect(shots).toHaveLength(WATCHER.shots);
    // ângulos relativos ao primeiro (o tiro central aponta para o jogador, perto de ±π)
    const a0 = Math.atan2(shots[0]!.vy, shots[0]!.vx);
    const rel = shots.map((s) => angDiff(a0, Math.atan2(s.vy, s.vx))).sort((a, b) => a - b);
    expect(rel[1]! - rel[0]!).toBeCloseTo(WATCHER.fanStep, 6);
    expect(rel[2]! - rel[1]!).toBeCloseTo(WATCHER.fanStep, 6);
    expect(shots.every((s) => s.color === WATCHER.shotColor)).toBe(true);
  });
});

describe("regra 2: todo ataque avisa antes", () => {
  // aviso mínimo de cada um, em ms (dos números do GDD §6.2)
  const CASES: readonly [EnemyKind, number, number][] = [
    ["hermit", HERMIT.telegraphMs, 700],
    ["urchin", URCHIN.telegraphMs, 800],
    ["jellyling", JELLYLING.telegraphMs, 850],
    ["anemone", ANEMONE.telegraphMs, 700],
    ["watcher", WATCHER.telegraphMs, 900],
    ["lamprey", LAMPREY.telegraphMs, 700],
  ];

  it.each(CASES)("%s: o ataque só sai depois do aviso inteiro", (kind, warnMs, x) => {
    const w = openWorld();
    w.godMode = true;
    spawn(w, kind, x, 600);
    let lastTelegraph = -1;
    let attacks = 0;
    for (let i = 0; i < 60 * 30; i++) {
      stepWorld(w, aimRight(w), STEP);
      for (const ev of w.events.list) {
        if (ev.t === "telegraph" && ev.source === kind) lastTelegraph = w.timeMs;
        if (ev.t === "attackStart" && ev.source === kind) {
          attacks++;
          expect(lastTelegraph, `${kind} atacou sem aviso`).toBeGreaterThan(0);
          expect(w.timeMs - lastTelegraph).toBeGreaterThanOrEqual(warnMs - 2 * STEP);
        }
      }
    }
    expect(attacks).toBeGreaterThan(0);
  });
});

describe("ondas e posições dos mapas", () => {
  const count = (waves: readonly { enemies: readonly { kind: string; count: number }[] }[], n: number, kind: string) =>
    waves[n]?.enemies.filter((g) => g.kind === kind).reduce((s, g) => s + g.count, 0) ?? 0;

  it("a composição segue o GDD §3.2", () => {
    const rows: readonly [string, typeof RIFT.waves, Record<string, number>[]][] = [
      ["Leito", RIFT.waves, [{ fish: 4 }, { fish: 3, circler: 2, hermit: 2 }, { fish: 3, circler: 2, hermit: 3, urchin: 2 }]],
      ["Coral", CORAL.waves, [
        { fish: 3, jellyling: 2 },
        { fish: 2, circler: 2, jellyling: 2, anemone: 2 },
        { fish: 3, circler: 3, jellyling: 3, anemone: 3 },
      ]],
      ["Fosso", ABYSS.waves, [
        { fish: 4, watcher: 2 },
        { circler: 3, watcher: 2, lamprey: 4 },
        { fish: 3, circler: 3, watcher: 3, lamprey: 8 },
      ]],
    ];
    for (const [name, waves, expected] of rows) {
      expected.forEach((want, n) => {
        const total = Object.values(want).reduce((a, b) => a + b, 0);
        const got = waves[n]?.enemies.reduce((s, g) => s + g.count, 0);
        expect(got, `${name} onda ${n + 1}`).toBe(total);
        for (const [kind, c] of Object.entries(want)) expect(count(waves, n, kind), `${name} ${n + 1} ${kind}`).toBe(c);
      });
    }
  });

  it("as posições fixas nascem sem rocha em cima, em qualquer semente", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const leito = buildMap(RIFT, seed);
      expect(leito.fixedEnemies).toHaveLength(RIFT_URCHIN_SPOTS.length);
      for (const s of leito.fixedEnemies) {
        expect(overlapsRock(leito.grid, s.x, s.y, URCHIN.radius), `ouriço ${s.x},${s.y} semente ${seed}`).toBe(false);
      }
      const coral = buildMap(CORAL, seed);
      expect(coral.fixedEnemies).toHaveLength(CORAL_ANEMONE_SPOTS.length);
      for (const a of coral.fixedEnemies) {
        expect(overlapsRock(coral.grid, a.x, a.y, ANEMONE.radius * ANEMONE.collScale), `anêmona ${a.x},${a.y} semente ${seed}`).toBe(false);
      }
    }
  });

  /**
   * Roda a fase até a onda `n` ter nascido inteira. Mata os inimigos das ondas anteriores e,
   * na onda `n`, todos menos os de `keep` (o teto de 6 vivos seguraria a fila).
   */
  function toWave(w: World, n: number, keep: EnemyKind): void {
    for (let i = 0; i < 40000; i++) {
      const f = w.phase;
      if (!f) throw new Error("sem fase");
      if (f.wave === n && f.state === "wave" && f.surges.length === 0 && f.queue.length === 0 && f.pending.length === 0) return;
      for (let k = 0; k < w.enemies.count; k++) {
        const e = w.enemies.get(k);
        if (e.fromWave && (f.wave < n || e.kind !== keep)) e.dead = true;
      }
      if (w.hitStopMs > 0) w.hitStopMs -= STEP;
      else stepWorld(w, intent(), STEP);
    }
    throw new Error("a onda não terminou de nascer");
  }

  it("Leito, onda 3: os 2 ouriços ocupam posições fixas diferentes e longe do jogador", () => {
    const w = createMapWorld(RIFT, 1);
    w.godMode = true;
    toWave(w, 3, "urchin");
    const urchins: Enemy[] = [];
    for (let i = 0; i < w.enemies.count; i++) if (w.enemies.get(i).kind === "urchin") urchins.push(w.enemies.get(i));
    expect(urchins).toHaveLength(2);
    const spots = buildMap(RIFT, 1).fixedEnemies;
    for (const u of urchins) expect(spots.some((s) => len(s.x - u.x, s.y - u.y) < 1)).toBe(true);
    expect(len(urchins[0]!.x - urchins[1]!.x, urchins[0]!.y - urchins[1]!.y)).toBeGreaterThan(20);
  });

  it("Coral, onda 3: as 3 anêmonas ocupam posições fixas diferentes", () => {
    const w = createMapWorld(CORAL, 1);
    w.godMode = true;
    toWave(w, 3, "anemone");
    const spots = buildMap(CORAL, 1).fixedEnemies;
    const found: Enemy[] = [];
    for (let i = 0; i < w.enemies.count; i++) if (w.enemies.get(i).kind === "anemone") found.push(w.enemies.get(i));
    expect(found).toHaveLength(3);
    const used = found.map((e) => spots.findIndex((d) => len(d.x - e.x, d.y - e.y) < 1));
    expect(used.every((i) => i >= 0)).toBe(true);
    expect(new Set(used).size).toBe(3);
  });
});
