import { describe, expect, it } from "vitest";
import { angDiff, angLerp, clamp, lerp, TAU } from "../../src/core/math";

describe("math", () => {
  it("clamp", () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });

  it("lerp", () => {
    expect(lerp(10, 20, 0.25)).toBe(12.5);
  });

  it("angDiff escolhe o caminho mais curto", () => {
    expect(angDiff(0.1, TAU - 0.1)).toBeCloseTo(-0.2, 10);
    expect(angDiff(TAU - 0.1, 0.1)).toBeCloseTo(0.2, 10);
    expect(angDiff(0, 1)).toBeCloseTo(1, 10);
  });

  it("angLerp não dá a volta pelo lado errado", () => {
    const a = 3;
    const b = -3; // perto de a pelo lado de ±π
    const mid = angLerp(a, b, 0.5);
    expect(Math.cos(mid)).toBeCloseTo(-1, 3);
  });
});
