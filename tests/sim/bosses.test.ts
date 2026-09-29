import { describe, expect, it } from "vitest";
import { EYE } from "../../src/config/bosses/eye";
import { JELLY } from "../../src/config/bosses/jelly";
import { PLAYER } from "../../src/config/player";
import { activateBoss, createBoss } from "../../src/sim/bosses/runner";
import { fireProjectile } from "../../src/sim/projectiles";
import { debugSkipToBoss } from "../../src/sim/phase";
import { createMapWorld, stepWorld, type World } from "../../src/sim/world";
import { Cell } from "../../src/world/grid";
import { ABYSS } from "../../src/world/maps/abyss";
import { CORAL } from "../../src/world/maps/coral";
import { intent, openGrid, openWorld, STEP } from "./helpers";

const idle = intent();

describe("regra 3: ataque rotacional", () => {
  it("ω · distância de flutuação < 250 px/s (velocidade do nado) em todas as fases do raio", () => {
    for (const w of JELLY.beam.sweepSpeed) expect(w * JELLY.hoverDist).toBeLessThan(PLAYER.maxSpeed);
  });
});

/** Roda o chefe do mapa até ele estar ativo. */
function bossFight(def: typeof CORAL, seed = 1): World {
  const w = createMapWorld(def, seed);
  debugSkipToBoss(w);
  for (let i = 0; i < 2000 && w.phase?.state !== "boss"; i++) stepWorld(w, idle, STEP);
  return w;
}

describe("Água-viva", () => {
  it("o coral faz sombra: atrás de uma coluna, o raio não acerta", () => {
    // Água-viva à esquerda de uma coluna alta, jogador colado do outro lado; ela só lança raios
    const w = openWorld({ grid: openGrid(60, 30), start: { x: 700, y: 300 } });
    w.grid.fill(30, 4, 31, 25, Cell.Coral);
    const b = createBoss(w, "jelly", 420, 300);
    activateBoss(b);
    let beams = 0;
    let hurt = 0;
    for (let i = 0; i < 3000; i++) {
      // jogador preso atrás da coluna, Água-viva presa do outro lado, sempre no raio
      w.player.x = 700;
      w.player.y = 300;
      w.player.vx = w.player.vy = 0;
      b.x = 420;
      b.y = 300;
      b.lastAttack = "";
      if (b.state === "think" && b.t <= 20) b.t = 1;
      stepWorld(w, idle, STEP);
      if (b.state === "telegraph" && b.attack !== "beam") b.attack = "beam";
      for (const e of w.events.list) {
        if (e.t === "attackStart" && e.attack === "beam") beams++;
        if (e.t === "playerHurt") hurt++;
      }
      // tira os esporos e ferrões que sobraram: só o raio interessa
      for (let k = 0; k < w.projectiles.count; k++) w.projectiles.get(k).dead = true;
    }
    expect(beams).toBeGreaterThan(3);
    expect(hurt).toBe(0);
  });

  it("os projéteis dela não erodem a rocha", () => {
    const w = bossFight(CORAL);
    const before = Array.from(w.grid.cells);
    for (let i = 0; i < 1800; i++) {
      w.player.hp = PLAYER.hp;
      w.player.invulnMs = 0;
      stepWorld(w, idle, STEP);
    }
    expect(Array.from(w.grid.cells)).toEqual(before);
  });
});

describe("Olho", () => {
  it("dissolve os pilares por fase: todos na fase 1, 45% na 2, nenhum na 3", () => {
    const w = bossFight(ABYSS);
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    expect(w.pillars.length).toBe(26);
    boss.hp = boss.maxHp * EYE.phaseAt[1];
    stepWorld(w, idle, STEP);
    expect(boss.phase).toBe(1);
    expect(w.pillars.length).toBe(Math.floor(26 * EYE.pillarKeepByPhase[1]));
    boss.hp = boss.maxHp * EYE.phaseAt[2];
    stepWorld(w, idle, STEP);
    expect(boss.phase).toBe(2);
    expect(w.pillars.length).toBe(0);
    // nenhum bloco de pilar sobrou (a borda continua)
    let rock = 0;
    for (const c of w.grid.cells) if (c === Cell.Rock) rock++;
    expect(rock).toBe(0);
  });

  it("os projéteis do Olho erodem a rocha comum, nunca a borda protegida", () => {
    const w = openWorld({ grid: openGrid(40, 30), start: { x: 200, y: 400 } });
    w.grid.fill(20, 5, 20, 25, Cell.Rock);
    w.rng.next = () => 0; // toda batida erode
    for (let k = 0; k < 30; k++) {
      fireProjectile(w, 300, 100 + k * 15, 0, 300, 1, 4, 9000, "#fff", { erodes: true });
      fireProjectile(w, 300, 100 + k * 15, -Math.PI / 2, 300, 1, 4, 9000, "#fff", { erodes: true });
    }
    for (let i = 0; i < 300; i++) stepWorld(w, idle, STEP);
    let eroded = 0;
    for (let cy = 5; cy <= 25; cy++) if (w.grid.get(20, cy) === Cell.Water) eroded++;
    expect(eroded).toBeGreaterThan(5);
    for (let cx = 0; cx < 40; cx++) expect(w.grid.get(cx, 0)).toBe(Cell.Protected);
  });
});

interface Cover {
  group: number[];
  x: number;
  y: number;
}

/**
 * O pilar vivo mais perto de (bx, by), a mais de 150 px, e o ponto encostado nele do lado
 * oposto: onde o jogador se esconde.
 */
function pickCover(w: World, bx: number, by: number): Cover | null {
  const t = w.grid.tile;
  const cols = w.grid.cols;
  let best: Cover | null = null;
  let bestD = Infinity;
  for (const group of w.pillars) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const idx of group) {
      if (w.grid.cells[idx] !== Cell.Rock) continue;
      sx += ((idx % cols) + 0.5) * t;
      sy += (Math.floor(idx / cols) + 0.5) * t;
      n++;
    }
    if (n === 0) continue;
    const cx = sx / n;
    const cy = sy / n;
    const d = Math.hypot(cx - bx, cy - by);
    if (d >= bestD || d <= 150) continue;
    bestD = d;
    // raio aproximado do pilar pela área, mais uma folga para o corpo do jogador
    const r = Math.sqrt(n / Math.PI) * t + 16;
    best = { group, x: cx + ((cx - bx) / d) * r, y: cy + ((cy - by) / d) * r };
  }
  return best;
}

describe("harness: jogador parado atrás de um pilar (CONTEXTO §6.3)", () => {
  /**
   * Trava o jogador atrás do pilar mais perto do Olho (do lado oposto a ele, no começo) por
   * 60 s e soma o dano recebido. O ponto é escolhido UMA vez, como no protótipo: o Olho vaga, e
   * às vezes o jogador fica exposto. Só troca de pilar se o dele dissolver. A vida é reposta a
   * cada passo, para medir o dano e não a morte. No protótipo: 336 na fase 1 e 872 na fase 2.
   */
  function damageBehindPillar(phase: 0 | 1, seed: number): number {
    const w = bossFight(ABYSS, seed);
    const boss = w.phase?.boss;
    if (!boss) throw new Error("sem chefe");
    if (phase === 1) {
      boss.hp = boss.maxHp * EYE.phaseAt[1];
      stepWorld(w, idle, STEP);
    }
    let damage = 0;
    let cover: Cover | null = null;
    for (let i = 0; i < 3600; i++) {
      if (!cover || !w.pillars.includes(cover.group)) cover = pickCover(w, boss.x, boss.y);
      if (cover) {
        w.player.x = w.player.prevX = cover.x;
        w.player.y = w.player.prevY = cover.y;
      }
      w.player.vx = w.player.vy = 0;
      w.player.hp = PLAYER.hp;
      stepWorld(w, idle, STEP);
      for (const e of w.events.list) if (e.t === "playerHurt") damage += e.amount;
      // a fase não pode avançar sozinha durante a medida
      boss.hp = Math.max(boss.hp, 1);
    }
    return damage;
  }

  it("dá números da mesma ordem do protótipo (336 na fase 1, 872 na fase 2)", () => {
    const p1 = [1, 2, 3].map((s) => damageBehindPillar(0, s));
    const p2 = [1, 2, 3].map((s) => damageBehindPillar(1, s));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    console.log(`atrás do pilar, 60 s: fase 1 ${p1.join(", ")} (média ${avg(p1).toFixed(0)}) · fase 2 ${p2.join(", ")} (média ${avg(p2).toFixed(0)})`);
    // mesma ordem de grandeza, e a fase 2 bem pior que a 1 (a cobertura está sumindo)
    expect(avg(p1)).toBeGreaterThan(100);
    expect(avg(p1)).toBeLessThan(1000);
    expect(avg(p2)).toBeGreaterThan(avg(p1));
  });
});
