import { describe, expect, it } from "vitest";
import { type Scene, SceneManager } from "../../src/scenes/manager";

const FADE = 300;
const STEP = 1000 / 60;

class Probe implements Scene {
  steps = 0;
  entered = 0;
  exited = 0;
  constructor(readonly overlay = false) {}
  enter(): void {
    this.entered++;
  }
  exit(): void {
    this.exited++;
  }
  step(): void {
    this.steps++;
  }
  render(): void {}
}

// passos suficientes para cobrir `ms`, arredondando para cima
const run = (m: SceneManager, ms: number): void => {
  const n = Math.ceil(ms / STEP);
  for (let i = 0; i < n; i++) m.step(STEP);
};

describe("SceneManager", () => {
  it("a primeira cena entra com fade e só recebe passo depois dele", () => {
    const m = new SceneManager(FADE, "#000");
    const a = new Probe();
    m.start(a);
    expect(a.entered).toBe(1);
    m.step(STEP);
    expect(a.steps).toBe(0);
    expect(m.transitioning).toBe(true);
    run(m, FADE / 2);
    expect(m.transitioning).toBe(false);
    const before = a.steps;
    m.step(STEP);
    expect(a.steps).toBe(before + 1);
  });

  it("push troca a cena no meio do fade e congela a de baixo", () => {
    const m = new SceneManager(FADE, "#000");
    const a = new Probe();
    const b = new Probe(true);
    m.start(a);
    run(m, FADE / 2);
    expect(m.push(b)).toBe(true);
    m.step(STEP);
    expect(m.top).toBe(a);
    run(m, FADE);
    expect(m.top).toBe(b);
    expect(m.transitioning).toBe(false);
    expect(b.entered).toBe(1);

    const before = a.steps;
    run(m, 200);
    expect(a.steps).toBe(before);
    expect(b.steps).toBeGreaterThan(0);
  });

  it("ignora uma segunda troca durante a primeira", () => {
    const m = new SceneManager(FADE, "#000");
    m.start(new Probe());
    run(m, FADE);
    expect(m.push(new Probe())).toBe(true);
    expect(m.push(new Probe())).toBe(false);
  });

  it("pop chama exit e devolve o passo à cena de baixo", () => {
    const m = new SceneManager(FADE, "#000");
    const a = new Probe();
    const b = new Probe(true);
    m.start(a);
    run(m, FADE);
    m.push(b);
    run(m, FADE + STEP);
    m.pop();
    run(m, FADE + STEP);
    expect(b.exited).toBe(1);
    expect(m.top).toBe(a);
    const before = a.steps;
    m.step(STEP);
    expect(a.steps).toBe(before + 1);
  });

  it("não tira a última cena", () => {
    const m = new SceneManager(FADE, "#000");
    m.start(new Probe());
    run(m, FADE);
    expect(m.pop()).toBe(false);
  });
});
