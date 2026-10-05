import { describe, expect, it } from "vitest";
import { WaterRush } from "../../src/audio/waterRush";
import { WATER_RUSH } from "../../src/config/waterRush";
import { asAudio, FakeContext } from "./fakeContext";

// A água da cena de descida (`audio/waterRush.ts`): começa em silêncio e sobe sem estalo, o corte
// e o volume acompanham a velocidade, as bolhas ficam mais frequentes quando ele acelera, e parar
// desvanece e solta tudo.

function start() {
  const ctx = new FakeContext();
  const out = ctx.createGain();
  const noise = ctx.createBuffer(1, 16, 8000) as unknown as AudioBuffer;
  const water = new WaterRush(WATER_RUSH, () => 0.5, { autoTick: false });
  water.start(asAudio(ctx), out as unknown as AudioNode, noise);
  return { ctx, out, water };
}

/** Quantas bolhas tocam em `seconds` com o nível fixo em `level`. */
function bubblesIn(seconds: number, level: number): number {
  const { ctx, water } = start();
  water.setLevel(level);
  const before = ctx.oscs.length;
  for (let t = 0; t < seconds; t += 0.05) {
    ctx.currentTime = t;
    water.tick(t);
  }
  return ctx.oscs.length - before;
}

describe("WaterRush", () => {
  it("começa em silêncio e sobe (sem estalo), com ruído e um LFO no ar", () => {
    const { ctx } = start();
    const master = ctx.gains[1];
    expect(master?.gain.calls[0]?.args[0]).toBeLessThan(0.001);
    expect(master?.gain.calls[1]?.fn).toBe("linear");
    expect(master?.gain.calls[1]?.args[0]).toBe(WATER_RUSH.gain);
    expect(ctx.buffers).toHaveLength(2); // o sopro e o rumor
    expect(ctx.buffers.every((b) => b.startedAt !== null)).toBe(true);
    expect(ctx.oscs.length).toBeGreaterThanOrEqual(1); // o LFO
  });

  it("o corte do sopro e os volumes sobem com a velocidade, em rampa", () => {
    const { ctx, water } = start();
    const filter = ctx.filters[0];
    water.setLevel(0);
    const slow = filter?.frequency.calls.at(-1)?.args[0] as number;
    water.setLevel(1);
    const fast = filter?.frequency.calls.at(-1)?.args[0] as number;
    expect(filter?.frequency.calls.at(-1)?.fn).toBe("target");
    expect(slow).toBe(WATER_RUSH.swish.freqHz[0]);
    expect(fast).toBe(WATER_RUSH.swish.freqHz[1]);
    // os dois ganhos (sopro e rumor) foram para o máximo
    const lastTargets = ctx.gains.map((g) => g.gain.calls.at(-1)).filter((c) => c?.fn === "target");
    expect(lastTargets.map((c) => c?.args[0])).toEqual(expect.arrayContaining([WATER_RUSH.swish.gain[1], WATER_RUSH.rumble.gain[1]]));
  });

  it("o nível é limitado entre 0 e 1", () => {
    const { ctx, water } = start();
    water.setLevel(7);
    expect(ctx.filters[0]?.frequency.calls.at(-1)?.args[0]).toBe(WATER_RUSH.swish.freqHz[1]);
    water.setLevel(-3);
    expect(ctx.filters[0]?.frequency.calls.at(-1)?.args[0]).toBe(WATER_RUSH.swish.freqHz[0]);
  });

  it("as bolhas ficam mais frequentes quando ele acelera", () => {
    const calm = bubblesIn(20, 0);
    const rush = bubblesIn(20, 1);
    expect(calm).toBeGreaterThan(0);
    expect(rush).toBeGreaterThan(calm * 2);
  });

  it("stop() desvanece o volume e depois de parar não toca mais nada", () => {
    const { ctx, water } = start();
    const master = ctx.gains[1];
    water.stop(800);
    expect(master?.gain.calls.at(-1)?.fn).toBe("target");
    expect(master?.gain.calls.at(-1)?.args[0]).toBe(0);
    const before = ctx.sources;
    ctx.currentTime = 99;
    water.tick(99);
    water.setLevel(1);
    expect(ctx.sources).toBe(before);
  });
});
