import { describe, expect, it } from "vitest";
import { formatSeed, parseSeed, Rng } from "../../src/core/rng";

const take = (rng: Rng, n: number): number[] => Array.from({ length: n }, () => rng.next());

describe("Rng", () => {
  it("a mesma semente gera a mesma sequência", () => {
    expect(take(new Rng(12345), 1000)).toEqual(take(new Rng(12345), 1000));
  });

  it("sementes diferentes geram sequências diferentes", () => {
    expect(take(new Rng(1), 20)).not.toEqual(take(new Rng(2), 20));
  });

  it("continua a sequência a partir do estado", () => {
    const a = new Rng(777);
    take(a, 50);
    const b = new Rng(a.state);
    expect(take(b, 50)).toEqual(take(a, 50));
  });

  it("next fica em [0, 1) e tem média perto de 0,5", () => {
    const values = take(new Rng(42), 20000);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    expect(mean).toBeGreaterThan(0.48);
    expect(mean).toBeLessThan(0.52);
  });

  it("int inclui os dois extremos e nada fora deles", () => {
    const rng = new Rng(9);
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) seen.add(rng.int(3, 6));
    expect([...seen].sort()).toEqual([3, 4, 5, 6]);
  });

  it("range fica no intervalo pedido", () => {
    const rng = new Rng(5);
    for (let i = 0; i < 1000; i++) {
      const v = rng.range(-2, 3);
      expect(v).toBeGreaterThanOrEqual(-2);
      expect(v).toBeLessThan(3);
    }
  });

  it("chance respeita os extremos", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it("pick recusa lista vazia", () => {
    expect(() => new Rng(1).pick([])).toThrow();
  });

  it("formatSeed e parseSeed são inversos", () => {
    for (const seed of [0, 1, 0xdeadbeef, 0xffffffff]) {
      expect(parseSeed(formatSeed(seed))).toBe(seed);
    }
    expect(parseSeed("zz")).toBeNull();
    expect(parseSeed(null)).toBeNull();
  });
});
