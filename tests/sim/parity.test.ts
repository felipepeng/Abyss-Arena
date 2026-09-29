import { describe, expect, it } from "vitest";
import { stepWorld, type World } from "../../src/sim/world";
import traces from "../fixtures/prototype-traces.json";
import { aimRight, openWorld, STEP } from "./helpers";

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
  ex: number | null;
  evx: number | null;
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
function replay(w: World, n: number, script: (i: number) => Frame): Trace {
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
    const d = w.dummies[0];
    out.push({
      // relativo ao início, trazido para o referencial do protótipo
      x: p.x - x0 + PROTO_START.x,
      y: p.y - y0 + PROTO_START.y,
      vx: p.vx,
      vy: p.vy,
      phase: p.spear.phase,
      dashMs: p.dashMs,
      hitStop: w.hitStopMs,
      ex: d ? d.x - x0 + PROTO_START.x : null,
      evx: d ? d.vx : null,
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
    const w = openWorld({ dummies: [{ kind: "fish", x: 650, y: 600 }] });
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
