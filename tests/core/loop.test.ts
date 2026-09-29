import { describe, expect, it } from "vitest";
import { FixedStepLoop } from "../../src/core/loop";

const STEP = 1000 / 60;

function makeLoop(hitStop = { ms: 0 }) {
  const log = { steps: 0, alphas: [] as number[] };
  const loop = new FixedStepLoop(STEP, 100, {
    step: () => log.steps++,
    render: (alpha) => log.alphas.push(alpha),
    consumeHitStop(dt) {
      if (hitStop.ms <= 0) return false;
      hitStop.ms -= dt;
      return true;
    },
  });
  return { loop, log, hitStop };
}

describe("FixedStepLoop", () => {
  it("roda um passo a cada 16,667 ms, independente do tamanho do frame", () => {
    const { loop, log } = makeLoop();
    for (let i = 0; i < 144; i++) loop.frame(1000 / 144);
    // um segundo a 144 Hz → 60 passos (o último pode ficar no acumulador por arredondamento)
    expect(log.steps).toBeGreaterThanOrEqual(59);
    expect(log.steps).toBeLessThanOrEqual(60);
  });

  it("devolve o alpha como a fração do passo acumulada", () => {
    const { loop, log } = makeLoop();
    loop.frame(STEP * 1.25);
    expect(log.steps).toBe(1);
    expect(log.alphas[0]).toBeCloseTo(0.25, 6);
  });

  it("limita o tempo de um frame ao teto", () => {
    const { loop, log } = makeLoop();
    loop.frame(5000);
    // 100 ms = 6 passos, não 300
    expect(log.steps).toBe(6);
  });

  it("ignora tempo negativo", () => {
    const { loop, log } = makeLoop();
    loop.frame(-50);
    expect(log.steps).toBe(0);
    expect(log.alphas[0]).toBe(0);
  });

  it("o hit-stop pula passos e congela a imagem em alpha 1", () => {
    const { loop, log, hitStop } = makeLoop();
    loop.frame(STEP * 0.5);
    hitStop.ms = 60;
    loop.frame(STEP);
    expect(log.steps).toBe(0);
    expect(log.alphas[1]).toBe(1);

    // 60 ms de hit-stop consomem 4 passos (≈ 66,7 ms); depois a simulação volta
    for (let i = 0; i < 3; i++) loop.frame(STEP);
    expect(log.steps).toBe(0);
    loop.frame(STEP);
    expect(log.steps).toBe(1);
    expect(log.alphas[log.alphas.length - 1]).toBeLessThan(1);
  });
});
