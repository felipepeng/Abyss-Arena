import { describe, expect, it } from "vitest";
import { Input } from "../../src/core/input";

type A = "attack" | "dash" | "up";

const makeInput = () =>
  new Input<A>({
    keys: { attack: ["KeyJ", "Enter"], dash: ["Space"], up: ["KeyW", "ArrowUp"] },
    mouseButtons: { attack: [0] },
  });

describe("Input", () => {
  it("mapeia teclas para ações", () => {
    const input = makeInput();
    expect(input.keyDown("ArrowUp")).toBe(true);
    expect(input.isDown("up")).toBe(true);
    expect(input.isDown("dash")).toBe(false);
    expect(input.keyDown("KeyZ")).toBe(false);
  });

  it("a ação continua ativa enquanto qualquer tecla dela estiver segura", () => {
    const input = makeInput();
    input.keyDown("KeyW");
    input.keyDown("ArrowUp");
    input.keyUp("KeyW");
    expect(input.isDown("up")).toBe(true);
    input.keyUp("ArrowUp");
    expect(input.isDown("up")).toBe(false);
  });

  it("clique e tecla disparam a mesma ação", () => {
    const input = makeInput();
    input.mouseDown(0);
    expect(input.isDown("attack")).toBe(true);
    expect(input.wasPressed("attack")).toBe(true);
    input.mouseUp(0);
    expect(input.isDown("attack")).toBe(false);
  });

  it("um toque entre dois passos ainda é visto uma vez", () => {
    const input = makeInput();
    input.keyDown("Space");
    input.keyUp("Space");
    expect(input.isDown("dash")).toBe(false);
    expect(input.wasPressed("dash")).toBe(true);
    input.endStep();
    expect(input.wasPressed("dash")).toBe(false);
  });

  it("a repetição automática do teclado não é um novo toque", () => {
    const input = makeInput();
    input.keyDown("KeyJ");
    input.endStep();
    input.keyDown("KeyJ");
    expect(input.wasPressed("attack")).toBe(false);
    expect(input.isDown("attack")).toBe(true);
  });

  it("mouseMoved vale até o fim do passo", () => {
    const input = makeInput();
    input.mouseMove(10, 20);
    expect(input.mouseMoved).toBe(true);
    expect(input.hasMouse).toBe(true);
    input.endStep();
    expect(input.mouseMoved).toBe(false);
    input.mouseMove(10, 20);
    expect(input.mouseMoved).toBe(false);
  });

  it("releaseAll solta tudo", () => {
    const input = makeInput();
    input.keyDown("KeyW");
    input.mouseDown(0);
    input.releaseAll();
    expect(input.isDown("up")).toBe(false);
    expect(input.isDown("attack")).toBe(false);
  });
});
