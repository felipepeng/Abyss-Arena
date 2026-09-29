import { describe, expect, it } from "vitest";
import { BINDINGS, type Action } from "../../src/config/input";
import { MENU } from "../../src/config/ui";
import { VIEW } from "../../src/config/system";
import { Input } from "../../src/core/input";
import { Menu, type MenuItem } from "../../src/ui/menu";

// Lógica do menu (sem canvas): teclado, mouse e o controle de volume.

const makeInput = () => new Input(BINDINGS);
const tap = (input: Input<Action>, code: string, menu: Menu) => {
  input.keyDown(code);
  menu.step(input);
  input.keyUp(code);
  input.endStep();
};

function build() {
  const log: string[] = [];
  let volume = 0.5;
  const items: MenuItem[] = [
    { kind: "button", label: "A", onSelect: () => log.push("A") },
    { kind: "button", label: "B", hint: "detalhe", onSelect: () => log.push("B") },
    { kind: "slider", label: "Vol", get: () => volume, set: (v) => (volume = Math.round(Math.min(1, Math.max(0, v)) * 10) / 10) },
  ];
  return { menu: new Menu(items, 100), log, volume: () => volume };
}

describe("Menu", () => {
  it("cima e baixo movem a seleção e dão a volta", () => {
    const { menu } = build();
    const input = makeInput();
    tap(input, "ArrowDown", menu);
    expect(menu.index).toBe(1);
    tap(input, "KeyS", menu);
    expect(menu.index).toBe(2);
    tap(input, "ArrowDown", menu);
    expect(menu.index).toBe(0);
    tap(input, "ArrowUp", menu);
    expect(menu.index).toBe(2);
  });

  it("confirmar aciona o botão selecionado (Enter, Espaço ou J)", () => {
    const { menu, log } = build();
    const input = makeInput();
    tap(input, "Enter", menu);
    tap(input, "ArrowDown", menu);
    tap(input, "Space", menu);
    tap(input, "KeyJ", menu);
    expect(log).toEqual(["A", "B", "B"]);
  });

  it("nos controles de volume, esquerda e direita ajustam de 0,1 em 0,1", () => {
    const { menu, volume } = build();
    const input = makeInput();
    tap(input, "ArrowUp", menu); // dá a volta: o controle
    tap(input, "ArrowRight", menu);
    expect(volume()).toBeCloseTo(0.6, 6);
    tap(input, "KeyA", menu);
    tap(input, "KeyA", menu);
    expect(volume()).toBeCloseTo(0.4, 6);
    for (let i = 0; i < 20; i++) tap(input, "ArrowRight", menu);
    expect(volume()).toBe(1);
  });

  it("confirmar num controle de volume não faz nada", () => {
    const { menu, log, volume } = build();
    const input = makeInput();
    tap(input, "ArrowUp", menu);
    tap(input, "Enter", menu);
    expect(log).toEqual([]);
    expect(volume()).toBe(0.5);
  });

  it("passar o mouse seleciona, e clicar aciona só o item sob o cursor", () => {
    const { menu, log } = build();
    const input = makeInput();
    const r = menu.rect(1);
    input.mouseMove(r.x + 20, r.y + 10);
    menu.step(input);
    expect(menu.index).toBe(1);
    input.endStep();

    input.mouseDown(0);
    menu.step(input);
    input.mouseUp(0);
    input.endStep();
    expect(log).toEqual(["B"]);

    // clique fora de qualquer item: nada
    input.mouseMove(5, 5);
    input.mouseDown(0);
    menu.step(input);
    input.mouseUp(0);
    input.endStep();
    expect(log).toEqual(["B"]);
  });

  it("clicar no trilho do controle de volume define o valor pela posição", () => {
    const { menu, volume } = build();
    const input = makeInput();
    const r = menu.rect(2);
    // a extremidade direita do trilho é 100%
    input.mouseMove(r.x + r.w - 16, r.y + r.h / 2);
    input.mouseDown(0);
    menu.step(input);
    input.mouseUp(0);
    input.endStep();
    expect(volume()).toBe(1);
  });

  it("os itens cabem na tela e o com detalhe é mais alto", () => {
    const { menu } = build();
    const last = menu.rect(2);
    expect(last.y + last.h).toBeLessThan(VIEW.height);
    expect(menu.rect(1).h).toBe(MENU.itemHeightWithHint);
    expect(menu.rect(0).h).toBe(MENU.itemHeight);
    expect(menu.rect(0).x).toBe((VIEW.width - MENU.itemWidth) / 2);
  });
});
