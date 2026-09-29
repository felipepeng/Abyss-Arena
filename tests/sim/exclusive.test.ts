import { describe, expect, it } from "vitest";
import { EEL } from "../../src/config/enemies/eel";
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
import { CORAL } from "../../src/world/maps/coral";
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

  it("só gira a 2,2 rad/s: contornar por ele funciona", () => {
    const w = openWorld({ start: { x: 600, y: 600 } });
    w.godMode = true;
    const e = spawn(w, "hermit", 700, 600);
    // de costas para o jogador (que está à esquerda), de repente
    e.ang = e.prevAng = 0;
    const before = e.ang;
    steps(w, 30, (w) => intent({ aimX: w.player.x, aimY: w.player.y }));
    // 0,5 s a 2,2 rad/s: gira ~1,1 rad, não os ~3,14 rad da volta inteira
    const turned = Math.abs(e.ang - before);
    expect(turned).toBeGreaterThan(0.9);
    expect(turned).toBeLessThan(1.3);
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

describe("Enguia: toca, bote e volta", () => {
  it("escondida, deixa a lança passar e não fere no contato", () => {
    const w = openWorld();
    const e = spawn(w, "eel", 640, 600);
    let hitStop = 0;
    const events: SimEvent[] = [];
    // estocada nos primeiros 500 ms, ainda na carência do nascimento
    stepWorld(w, aimRight(w, STAB), STEP);
    for (let i = 0; i < 20; i++) {
      events.push(...w.events.list);
      hitStop = Math.max(hitStop, w.hitStopMs);
      stepWorld(w, aimRight(w), STEP);
    }
    expect(events.some((ev) => ev.t === "spearHit" || ev.t === "spearBlocked")).toBe(false);
    expect(e.hp).toBe(EEL.hp);
    expect(hitStop).toBe(0);
    expect(w.player.hp).toBe(PLAYER.hp);
  });

  it("no bote, a cabeça fica exposta e leva dano", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "eel", 640, 600);
    setState(e, w, "strike");
    e.vx = e.vy = 0;
    const events = stab(w);
    expect(events.some((ev) => ev.t === "spearHit")).toBe(true);
    expect(e.hp).toBeLessThan(EEL.hp);
  });

  it("o gatilho é o jogador a menos de 160 px da toca; o bote sai depois do aviso de 450 ms e volta", () => {
    const w = openWorld();
    w.godMode = true;
    const e = spawn(w, "eel", 680, 600); // a 80 px
    e.t = 0;
    let telegraphAt = -1;
    let strikeAt = -1;
    let backAt = -1;
    for (let i = 0; i < 240 && backAt < 0; i++) {
      stepWorld(w, aimRight(w), STEP);
      if (telegraphAt < 0 && e.state === "telegraph") telegraphAt = w.timeMs;
      if (strikeAt < 0 && e.state === "strike") strikeAt = w.timeMs;
      if (strikeAt > 0 && e.state === "hidden") backAt = w.timeMs;
    }
    expect(telegraphAt).toBeGreaterThan(0);
    expect(strikeAt - telegraphAt).toBeGreaterThanOrEqual(EEL.telegraphMs - STEP);
    expect(strikeAt - telegraphAt).toBeLessThanOrEqual(EEL.telegraphMs + 2 * STEP);
    expect(backAt).toBeGreaterThan(strikeAt);
    // voltou para a toca
    expect(len(e.x - (e.data.denX ?? 0), e.y - (e.data.denY ?? 0))).toBeLessThan(1);
  });

  it("longe da toca (mais de 160 px), continua escondida", () => {
    const w = openWorld();
    const e = spawn(w, "eel", 900, 600); // a 300 px
    e.t = 0;
    steps(w, 180, (w) => aimRight(w));
    expect(e.state).toBe("hidden");
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
    // a enguia na volta só fica de fora da toca se a toca estiver longe
    if (kind === "eel") e.data.denX = 700;
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

  it("Enguia: sem contato escondida, cheio no bote, metade na volta", () => {
    expect(contact("eel")).toBe(0);
    expect(contact("eel", "strike")).toBe(EEL.contactDamage);
    expect(contact("eel", "return")).toBe(Math.ceil(EEL.contactDamage / 2));
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
    ["eel", EEL.telegraphMs, 680],
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
      ["Leito", RIFT.waves, [{ fish: 4 }, { fish: 3, circler: 2, hermit: 1 }, { fish: 3, circler: 2, hermit: 2, urchin: 2 }]],
      ["Coral", CORAL.waves, [
        { fish: 3, jellyling: 2 },
        { fish: 2, circler: 2, jellyling: 2, eel: 2 },
        { fish: 3, circler: 3, jellyling: 3, eel: 3 },
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

  it("as posições fixas e as tocas nascem sem rocha em cima, em qualquer semente", () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const leito = buildMap(RIFT, seed);
      expect(leito.fixedEnemies).toHaveLength(RIFT_URCHIN_SPOTS.length);
      for (const s of leito.fixedEnemies) {
        expect(overlapsRock(leito.grid, s.x, s.y, URCHIN.radius), `ouriço ${s.x},${s.y} semente ${seed}`).toBe(false);
      }
      const coral = buildMap(CORAL, seed);
      expect(coral.eelDens).toHaveLength(CORAL.markers.eelDens.length);
      for (const d of coral.eelDens) {
        expect(overlapsRock(coral.grid, d.x, d.y, EEL.radius), `toca ${d.x},${d.y} semente ${seed}`).toBe(false);
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
      if (f.wave === n && f.state === "wave" && f.queue.length === 0 && f.pending.length === 0) return;
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

  it("Coral, onda 3: as 3 enguias ficam em tocas diferentes", () => {
    const w = createMapWorld(CORAL, 1);
    w.godMode = true;
    toWave(w, 3, "eel");
    const dens = buildMap(CORAL, 1).eelDens;
    const eels: Enemy[] = [];
    for (let i = 0; i < w.enemies.count; i++) if (w.enemies.get(i).kind === "eel") eels.push(w.enemies.get(i));
    expect(eels).toHaveLength(3);
    const used = eels.map((e) => dens.findIndex((d) => len(d.x - e.x, d.y - e.y) < 1));
    expect(used.every((i) => i >= 0)).toBe(true);
    expect(new Set(used).size).toBe(3);
  });
});
