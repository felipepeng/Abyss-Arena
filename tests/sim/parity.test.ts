import { describe, expect, it } from "vitest";
import { activateBoss, createBoss } from "../../src/sim/bosses/runner";
import type { Boss } from "../../src/sim/bosses/types";
import { spawnEnemy } from "../../src/sim/enemies/runner";
import type { EnemyKind } from "../../src/sim/enemies/types";
import { stepWorld, type World } from "../../src/sim/world";
import traces from "../fixtures/prototype-traces.json";
import { aimRight, openGrid, openWorld, pinRng, STEP } from "./helpers";

// Paridade de sensação com o protótipo (critério do M1). `prototype-traces.json` foi gravado
// rodando o CÓDIGO DO PRÓPRIO PROTÓTIPO passo a passo num navegador headless
// (tools/prototype-trace.mjs), numa arena aberta, com os mesmos roteiros de entrada abaixo.
// Aqui os roteiros são repetidos na nossa simulação e os estados são comparados passo a passo.
//
// Diferença esperada e aprovada: o dash tem invulnerabilidade (GDD §4.2), o que não mexe em
// posição nem velocidade, então não aparece nestes rastros.

interface ProtoStep {
  x: number;
  y: number;
  vx: number;
  vy: number;
  phase: string;
  dashMs: number;
  hitStop: number;
  hp: number;
  invulnMs: number;
  dead: boolean;
  enemies: number;
  ex: number | null;
  ey: number | null;
  evx: number | null;
  evy: number | null;
  estate: string | null;
  et: number | null;
  ehp: number | null;
  pblocked?: boolean;
  bx?: number | null;
  by?: number | null;
  bvx?: number | null;
  bvy?: number | null;
  bstate?: string | null;
  bt?: number | null;
  bhp?: number | null;
  bphase2?: boolean | null;
  bblocked?: boolean | null;
  /** Fase do chefe contada a partir de 1 (o protótipo: fase do Olho, ou 1/2 pelo phase2). */
  bphase?: number | null;
  pcount?: number;
  /** A rede "parado 1,5 s → recoloca" do protótipo disparou neste passo. */
  bunstuck?: boolean;
  bbeam?: number | null;
}

type Trace = (ProtoStep | null)[];

interface Frame {
  move?: [number, number];
  dash?: boolean;
  /** Botão do mouse segurado; `press` marca o flanco. */
  mouse?: boolean;
  press?: boolean;
  /** Tecla de ataque (J) segurada e pressionada neste passo. */
  key?: boolean;
}

const PROTO_START = { x: 480, y: 270 };

/** Repete o roteiro no nosso mundo. Passos congelados pelo hit-stop viram null, como no rastro. */
function replay(w: World, n: number, script: (i: number) => Frame, origin = PROTO_START): Trace {
  const x0 = w.player.x;
  const y0 = w.player.y;
  const out: Trace = [];
  for (let i = 0; i < n; i++) {
    const f = script(i);
    if (w.hitStopMs > 0) {
      w.hitStopMs -= STEP;
      out.push(null);
      continue;
    }
    stepWorld(
      w,
      aimRight(w, {
        moveX: f.move?.[0] ?? 0,
        moveY: f.move?.[1] ?? 0,
        dashHeld: !!f.dash,
        attackHeld: !!f.mouse || !!f.key,
        attackPressed: !!f.press || !!f.key,
        attackPressedByMouse: !!f.press,
      }),
      STEP,
    );
    const p = w.player;
    const d = w.enemies.count > 0 ? w.enemies.get(0) : undefined;
    const b = w.bosses[0];
    out.push({
      bbeam: b && b.kind === "jelly" && b.attack === "beam" && b.state !== "think" ? (b.data.beamAng ?? null) : null,
      bphase: b ? b.phase + 1 : null,
      pcount: w.projectiles.count,
      bx: b ? b.x - x0 + origin.x : null,
      by: b ? b.y - y0 + origin.y : null,
      bvx: b ? b.vx : null,
      bvy: b ? b.vy : null,
      bstate: b ? protoBossState(b) : null,
      bt: b ? b.t : null,
      bhp: b ? b.hp : null,
      bphase2: b ? b.phase >= 1 : null,
      // relativo ao início, trazido para o referencial do protótipo
      x: p.x - x0 + origin.x,
      y: p.y - y0 + origin.y,
      vx: p.vx,
      vy: p.vy,
      phase: p.spear.phase,
      dashMs: p.dashMs,
      hitStop: w.hitStopMs,
      hp: p.hp,
      invulnMs: p.invulnMs,
      dead: w.playerDead,
      enemies: w.enemies.count,
      ex: d ? d.x - x0 + origin.x : null,
      ey: d ? d.y - y0 + origin.y : null,
      evx: d ? d.vx : null,
      evy: d ? d.vy : null,
      estate: d ? d.state : null,
      et: d ? d.t : null,
      ehp: d ? d.hp : null,
    });
  }
  return out;
}

// o protótipo chama as fases de "state" com os mesmos nomes
function expectSameTrace(ours: Trace, proto: Trace, withEnemy = false): void {
  expect(ours.length).toBe(proto.length);
  for (let i = 0; i < proto.length; i++) {
    const a = ours[i];
    const b = proto[i];
    const where = `passo ${i}`;
    if (b === null || b === undefined) {
      expect(a, where).toBeNull();
      continue;
    }
    expect(a, where).not.toBeNull();
    if (!a) continue;
    expect(a.phase, where).toBe(b.phase);
    expect(a.x, `${where} x`).toBeCloseTo(b.x, 6);
    expect(a.y, `${where} y`).toBeCloseTo(b.y, 6);
    expect(a.vx, `${where} vx`).toBeCloseTo(b.vx, 6);
    expect(a.vy, `${where} vy`).toBeCloseTo(b.vy, 6);
    expect(a.dashMs, `${where} dashMs`).toBeCloseTo(b.dashMs, 6);
    expect(a.hitStop, `${where} hitStop`).toBeCloseTo(b.hitStop, 6);
    if (withEnemy) expect(a.evx, `${where} empurrão do alvo`).toBeCloseTo(b.evx ?? NaN, 6);
  }
}

const T = traces as unknown as Record<string, Trace>;
const len = (name: string): number => T[name]?.length ?? 0;

describe("paridade com o protótipo", () => {
  it("nado: acelera, bate no teto e desliza", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("swim"), (i) => ({ move: i < 30 ? [1, 0] : [0, 0] })), T.swim ?? []);
  });

  it("nado na diagonal (direção normalizada)", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("swimDiagonal"), (i) => ({ move: i < 20 ? [1, 1] : [0, 0] })), T.swimDiagonal ?? []);
  });

  it("dash parado", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("dash"), (i) => ({ dash: i === 0 })), T.dash ?? []);
  });

  it("dash no meio do nado", () => {
    const w = openWorld();
    const trace = replay(w, len("dashWhileSwimming"), (i) => ({ move: i < 25 ? [1, -1] : [0, 0], dash: i === 12 }));
    expectSameTrace(trace, T.dashWhileSwimming ?? []);
  });

  it("dash segurado redispara depois da recarga", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("dashHeld"), () => ({ dash: true })), T.dashHeld ?? []);
  });

  it("estocada rápida (clique)", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("tap"), (i) => ({ mouse: i === 0, press: i === 0 })), T.tap ?? []);
  });

  it("estocada com carga cheia", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("charged"), (i) => ({ mouse: i < 45, press: i === 0 })), T.charged ?? []);
  });

  it("estocada com meia carga", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("halfCharge"), (i) => ({ mouse: i < 18, press: i === 0 })), T.halfCharge ?? []);
  });

  it("estocada pelo teclado", () => {
    const w = openWorld();
    expectSameTrace(replay(w, len("keyAttack"), (i) => ({ key: i === 0 })), T.keyAttack ?? []);
  });

  it("dash cancela a recuperação da lança", () => {
    const w = openWorld();
    const trace = replay(w, len("dashCancelsRecovery"), (i) => ({ mouse: i === 0, press: i === 0, dash: i === 14 }));
    expectSameTrace(trace, T.dashCancelsRecovery ?? []);
  });

  it("acerto num peixe: hit-stop, recuo e empurrão cortado pelo teto", () => {
    const w = openWorld({ enemies: [{ kind: "dummy", x: 650, y: 600 }] });
    const ours = replay(w, len("hitFish"), (i) => ({ mouse: i === 0, press: i === 0 }));
    const proto = T.hitFish ?? [];
    // O peixe do protótipo fica parado; o saco de pancada volta devagar à origem, então só o
    // passo do acerto compara o empurrão do alvo. O jogador é comparado no rastro inteiro.
    const hit = proto.findIndex((s) => s !== null && s.hitStop > 0);
    expect(hit).toBeGreaterThan(0);
    expectSameTrace(ours, proto);
    expect(ours[hit]?.evx).toBeCloseTo(proto[hit]?.evx ?? NaN, 6);
  });
});

// ---------------------------------------------------------------------------------------
// Inimigos (M2). A arena é a do protótipo (48 × 27 blocos, borda de 2), com o jogador no
// mesmo ponto. Os sorteios dos dois lados ficam fixos em 0,5 (o gerador fixa o Math.random
// do protótipo; aqui, a RNG do mundo). Os roteiros evitam encostar nas paredes: ali a colisão
// nova para o corpo na face do bloco e a do protótipo o empurra 1 px por vez, uma diferença
// aprovada (ARCHITECTURE §6.2) de menos de 1 px, que os testes de colisão cobrem à parte.

/** Mundo com a geometria do protótipo e um inimigo a (dx, dy) do jogador. */
function protoWorld(kind: EnemyKind, dx: number, dy: number): World {
  const w = openWorld({ grid: openGrid(48, 27), start: { ...PROTO_START } });
  pinRng(w);
  spawnEnemy(w, kind, PROTO_START.x + dx, PROTO_START.y + dy);
  return w;
}

const KEYS: Record<string, [number, number]> = { KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
const move = (...keys: string[]): [number, number] =>
  keys.reduce<[number, number]>((m, k) => [m[0] + (KEYS[k]?.[0] ?? 0), m[1] + (KEYS[k]?.[1] ?? 0)], [0, 0]);
const poke = (every: number) => (i: number): Frame => ({ mouse: i % every < 3, press: i % every === 0 });

function expectSameEnemyTrace(ours: Trace, proto: Trace): void {
  expectSameTrace(ours, proto);
  for (let i = 0; i < proto.length; i++) {
    const a = ours[i];
    const b = proto[i];
    if (!a || !b) continue;
    const where = `passo ${i}`;
    expect(a.hp, `${where} vida`).toBeCloseTo(b.hp, 6);
    expect(a.invulnMs, `${where} invulnerabilidade`).toBeCloseTo(b.invulnMs, 6);
    expect(a.dead, `${where} morto`).toBe(b.dead);
    expect(a.enemies, `${where} inimigos vivos`).toBe(b.enemies);
    expect(a.estate, `${where} estado do inimigo`).toBe(b.estate);
    if (b.ex === null) continue;
    expect(a.ex, `${where} inimigo x`).toBeCloseTo(b.ex, 6);
    expect(a.ey, `${where} inimigo y`).toBeCloseTo(b.ey ?? NaN, 6);
    expect(a.evx, `${where} inimigo vx`).toBeCloseTo(b.evx ?? NaN, 6);
    expect(a.evy, `${where} inimigo vy`).toBeCloseTo(b.evy ?? NaN, 6);
    expect(a.et, `${where} cronômetro do inimigo`).toBeCloseTo(b.et ?? NaN, 6);
    expect(a.ehp, `${where} vida do inimigo`).toBeCloseTo(b.ehp ?? NaN, 6);
  }
}

describe("paridade com o protótipo: inimigos", () => {
  it("peixe persegue, avisa, investe e fere o jogador parado", () => {
    const w = protoWorld("fish", 220, 0);
    expectSameEnemyTrace(replay(w, len("fishAttacks"), () => ({})), T.fishAttacks ?? []);
  });

  it("peixe contra um jogador que nada", () => {
    const w = protoWorld("fish", 180, 90);
    const script = (i: number): Frame => ({ move: i < 40 ? move("KeyW") : i < 80 ? move("KeyA", "KeyS") : [0, 0] });
    expectSameEnemyTrace(replay(w, len("fishWhileSwimming"), script), T.fishWhileSwimming ?? []);
  });

  it("peixe fora do alcance de visão não persegue", () => {
    const w = protoWorld("fish", 340, 0);
    expectSameEnemyTrace(replay(w, len("fishFarAway"), () => ({})), T.fishFarAway ?? []);
  });

  it("circulador orbita, avisa, estoca e descansa", () => {
    const w = protoWorld("circler", 150, -40);
    expectSameEnemyTrace(replay(w, len("circlerAttacks"), () => ({})), T.circlerAttacks ?? []);
  });

  it("circulador contra um jogador que nada", () => {
    const w = protoWorld("circler", -120, 60);
    const script = (i: number): Frame => ({ move: i < 60 ? move("KeyD") : i < 100 ? move("KeyS") : [0, 0] });
    expectSameEnemyTrace(replay(w, len("circlerWhileSwimming"), script), T.circlerWhileSwimming ?? []);
  });

  it("estocadas matam o peixe (hit-stop, empurrão, morte)", () => {
    const w = protoWorld("fish", 120, 0);
    expectSameEnemyTrace(replay(w, len("killFish"), poke(25)), T.killFish ?? []);
  });

  it("estocadas no circulador", () => {
    const w = protoWorld("circler", 100, 0);
    expectSameEnemyTrace(replay(w, len("killCircler"), poke(25)), T.killCircler ?? []);
  });
});

// ---------------------------------------------------------------------------------------
// Caranguejo (M3). O protótipo chama os estados de "think", "dashTel", "dash", "pinchTel",
// "pinch" e "callTel"; o runner genérico usa pensar / aviso / execução + o nome do ataque.
// O chamado não tem estado de execução no protótipo: acontece no fim do aviso, e o nosso
// também (execução de 0 ms). Os sorteios vêm do mesmo gerador congruencial dos dois lados
// (o gerador de rastros desliga as bolhas do protótipo, que também sorteavam).

const isCrabState = (s: string): boolean => /^(dash|pinch|call)/.test(s);

function protoBossState(b: Boss): string {
  if (b.state === "think") return "think";
  return b.state === "telegraph" ? `${b.attack}Tel` : b.attack;
}

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function crabWorld(dx: number, dy: number, hp: number, seed: number): World {
  const w = openWorld({ grid: openGrid(48, 27), start: { ...PROTO_START } });
  pinRng(w);
  const b = createBoss(w, "crab", PROTO_START.x + dx, PROTO_START.y + dy);
  activateBoss(b);
  if (hp) b.hp = hp;
  w.rng.next = lcg(seed);
  return w;
}

function expectSameBossTrace(ours: Trace, proto: Trace): void {
  // Até o primeiro passo em que alguém encosta na parede (ali a colisão difere de propósito) ou
  // em que a rede "parado 1,5 s → recoloca" do protótipo mexe no Caranguejo (o jogo novo não
  // tem essa rede, ARCHITECTURE §6.2; na Água-viva e no Olho o gerador a desliga).
  const wall = proto.findIndex((s) => s !== null && (s.pblocked || s.bblocked || (s.bunstuck && isCrabState(s.bstate ?? ""))));
  const n = wall < 0 ? proto.length : wall;
  for (let i = 0; i < n; i++) {
    const a = ours[i];
    const b = proto[i];
    const where = `passo ${i}`;
    if (b === null || b === undefined) {
      expect(a, where).toBeNull();
      continue;
    }
    if (!a) throw new Error(`${where}: nosso passo está congelado e o do protótipo não`);
    expect(a.bstate, `${where} estado do chefe`).toBe(b.bstate);
    expect(a.bphase2, `${where} fase 2`).toBe(b.bphase2);
    expect(a.bx, `${where} chefe x`).toBeCloseTo(b.bx ?? NaN, 6);
    expect(a.by, `${where} chefe y`).toBeCloseTo(b.by ?? NaN, 6);
    expect(a.bvx, `${where} chefe vx`).toBeCloseTo(b.bvx ?? NaN, 6);
    expect(a.bvy, `${where} chefe vy`).toBeCloseTo(b.bvy ?? NaN, 6);
    // Execuções "até terminar" (salvas, raio) têm cronômetro infinito aqui e o intervalo da
    // salva no protótipo: é só representação; o estado, as posições e os projéteis contam.
    if (Number.isFinite(a.bt)) expect(a.bt, `${where} cronômetro do chefe`).toBeCloseTo(b.bt ?? NaN, 6);
    expect(a.bhp, `${where} vida do chefe`).toBeCloseTo(b.bhp ?? NaN, 6);
    expect(a.phase, `${where} lança`).toBe(b.phase);
    expect(a.x, `${where} jogador x`).toBeCloseTo(b.x, 6);
    expect(a.y, `${where} jogador y`).toBeCloseTo(b.y, 6);
    expect(a.hp, `${where} vida do jogador`).toBeCloseTo(b.hp, 6);
    expect(a.dead, `${where} morto`).toBe(b.dead);
    // capangas do chamado: a quantidade (a ordem no pool difere da do array do protótipo)
    expect(a.enemies, `${where} peixes invocados`).toBe(b.enemies);
    if (b.pcount !== undefined) expect(a.pcount, `${where} projéteis vivos`).toBe(b.pcount);
    if (b.bbeam !== undefined && b.bbeam !== null) expect(a.bbeam, `${where} ângulo do raio`).toBeCloseTo(b.bbeam, 6);
    if (b.bphase !== undefined && b.bphase !== null) expect(a.bphase, `${where} fase do chefe`).toBe(b.bphase);
  }
}

describe("paridade com o protótipo: Caranguejo", () => {
  it("contra um jogador parado: investida, pinça, contato, morte do jogador", () => {
    const w = crabWorld(240, 0, 0, 1);
    expectSameBossTrace(replay(w, len("crabVsIdle"), () => ({})), T.crabVsIdle ?? []);
  });

  it("contra um jogador que nada: chamado e peixes invocados", () => {
    const w = crabWorld(-220, 40, 0, 7);
    const script = (i: number): Frame => ({ move: i % 160 < 50 ? move("KeyW") : i % 160 < 100 ? move("KeyS") : [0, 0] });
    expectSameBossTrace(replay(w, len("crabVsSwimmer"), script), T.crabVsSwimmer ?? []);
  });

  it("fase 2 com estocadas: troca de fase, investida dupla, dano no chefe", () => {
    const w = crabWorld(150, 0, 216, 42);
    const poke20 = (i: number): Frame => ({ mouse: i % 20 < 3, press: i % 20 === 0 });
    expectSameBossTrace(replay(w, len("crabPhase2"), poke20), T.crabPhase2 ?? []);
  });
});

// ---------------------------------------------------------------------------------------
// Água-viva e Olho (M4). Mesma técnica do Caranguejo: a mesma sequência aleatória dos dois
// lados. Na Água-viva a erosão fica desligada no protótipo (lá todo projétil erodia e
// sorteava; no jogo só os do Olho erodem, GDD §7.3). O Olho joga numa arena só com a borda.

function bossWorld(kind: "jelly" | "eye", grid: ReturnType<typeof openGrid>, start: { x: number; y: number }, bx: number, by: number, hp: number, seed: number): World {
  const w = openWorld({ grid, start });
  pinRng(w);
  const b = createBoss(w, kind, bx, by);
  activateBoss(b);
  if (hp) b.hp = hp;
  w.rng.next = lcg(seed);
  return w;
}

const jellyWorld = (dx: number, dy: number, hp: number, seed: number) =>
  bossWorld("jelly", openGrid(48, 27), { ...PROTO_START }, PROTO_START.x + dx, PROTO_START.y + dy, hp, seed);

const EYE_START = { x: 930, y: 900 };
const eyeWorld = (hp: number, seed: number) => bossWorld("eye", openGrid(93, 55), { ...EYE_START }, 930, 550, hp, seed);

describe("paridade com o protótipo: Água-viva", () => {
  it("contra um jogador parado: anel de esporos", () => {
    expectSameBossTrace(replay(jellyWorld(-200, 0, 0, 3), len("jellyVsIdle"), () => ({})), T.jellyVsIdle ?? []);
  });

  it("contra um jogador que nada: anel, raio (esticar, varrer, sombra na borda) e sucção", () => {
    const script = (i: number): Frame => ({ move: i % 200 < 60 ? move("KeyA") : i % 200 < 120 ? move("KeyD") : [0, 0] });
    expectSameBossTrace(replay(jellyWorld(200, -120, 0, 11), len("jellyVsSwimmer"), script), T.jellyVsSwimmer ?? []);
  });

  it("fase 2", () => {
    expectSameBossTrace(replay(jellyWorld(-150, -150, 189, 5), len("jellyPhase2"), () => ({})), T.jellyPhase2 ?? []);
  });
});

describe("paridade com o protótipo: Olho", () => {
  it("fase 1: leque em salvas e cerco", () => {
    expectSameBossTrace(replay(eyeWorld(0, 9), len("eyePhase1"), () => ({}), EYE_START), T.eyePhase1 ?? []);
  });

  it("fase 2: espiral de dois braços e perseguidores que atravessam a rocha", () => {
    const script = (i: number): Frame => ({ move: i % 240 < 80 ? move("KeyA") : i % 240 < 160 ? move("KeyD") : [0, 0] });
    expectSameBossTrace(replay(eyeWorld(369, 13), len("eyePhase2"), script, EYE_START), T.eyePhase2 ?? []);
  });

  it("fase 3", () => {
    const script = (i: number): Frame => ({ move: i % 180 < 60 ? move("KeyW") : i % 180 < 120 ? move("KeyS") : [0, 0] });
    expectSameBossTrace(replay(eyeWorld(184, 21), len("eyePhase3"), script, EYE_START), T.eyePhase3 ?? []);
  });
});
