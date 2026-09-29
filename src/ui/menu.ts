import type { AudioApi } from "../audio/api";
import type { Action } from "../config/input";
import { FONT_FAMILY, VIEW } from "../config/system";
import { AUDIO } from "../config/audio";
import { MENU } from "../config/ui";
import { clamp } from "../core/math";
import type { Input } from "../core/input";

// Menu vertical reutilizável (GDD §11): teclado (cima/baixo, esquerda/direita nos controles de
// volume, confirmar) e mouse (passar seleciona, clicar confirma). A lógica (`step`) não toca
// no canvas, para ser testada sem DOM; o desenho (`render`) usa as mesmas caixas.

export interface ButtonItem {
  kind: "button";
  label: string;
  /** Linha menor abaixo do rótulo (o chefe de cada mapa, na Arena livre). */
  hint?: string;
  onSelect(): void;
}

/** Controle de volume: valor de 0 a 1. */
export interface SliderItem {
  kind: "slider";
  label: string;
  get(): number;
  set(v: number): void;
}

export type MenuItem = ButtonItem | SliderItem;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class Menu {
  index = 0;

  constructor(
    readonly items: readonly MenuItem[],
    /** Topo do primeiro item, em px. */
    private readonly top: number,
    /** Clique ao navegar e ao confirmar (GDD §10.1). Sem som se omitido. */
    private readonly sounds?: Pick<AudioApi, "ui">,
  ) {}

  private itemHeight(i: number): number {
    const it = this.items[i];
    return it?.kind === "button" && it.hint ? MENU.itemHeightWithHint : MENU.itemHeight;
  }

  /** Caixa do item `i`, em coordenadas da tela. */
  rect(i: number): Rect {
    let y = this.top;
    for (let k = 0; k < i; k++) y += this.itemHeight(k) + MENU.itemGap;
    return { x: (VIEW.width - MENU.itemWidth) / 2, y, w: MENU.itemWidth, h: this.itemHeight(i) };
  }

  /** Altura total, para o chamador centrar um título acima. */
  get height(): number {
    if (this.items.length === 0) return 0;
    const last = this.rect(this.items.length - 1);
    return last.y + last.h - this.top;
  }

  /** Trilho do controle de volume do item `i`. */
  private track(i: number): Rect {
    const r = this.rect(i);
    return { x: r.x + r.w - MENU.sliderWidth - 16, y: r.y + r.h / 2 - MENU.sliderHeight / 2, w: MENU.sliderWidth, h: MENU.sliderHeight };
  }

  private hit(x: number, y: number): number {
    for (let i = 0; i < this.items.length; i++) {
      const r = this.rect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  step(input: Input<Action>): void {
    const n = this.items.length;
    if (n === 0) return;
    const before = this.index;
    if (input.wasPressed("menuUp")) this.index = (this.index + n - 1) % n;
    if (input.wasPressed("menuDown")) this.index = (this.index + 1) % n;
    if (input.mouseMoved) {
      const h = this.hit(input.mouseX, input.mouseY);
      if (h >= 0) this.index = h;
    }
    if (this.index !== before) this.sounds?.ui("move");

    const item = this.items[this.index];
    if (item?.kind === "slider") {
      const left = input.wasPressed("menuLeft");
      const right = input.wasPressed("menuRight");
      if (left) item.set(item.get() - AUDIO.step);
      if (right) item.set(item.get() + AUDIO.step);
      if (left || right) this.sounds?.ui("move");
    } else if (item && input.wasPressed("menuConfirm")) {
      this.sounds?.ui("confirm");
      item.onSelect();
      return;
    }

    if (input.wasMousePressed(0)) {
      const h = this.hit(input.mouseX, input.mouseY);
      const clicked = h >= 0 ? this.items[h] : undefined;
      if (!clicked) return;
      this.index = h;
      this.sounds?.ui("confirm");
      if (clicked.kind === "button") clicked.onSelect();
      else {
        const t = this.track(h);
        clicked.set(clamp((input.mouseX - t.x) / t.w, 0, 1));
      }
    }
  }

  render(g: CanvasRenderingContext2D): void {
    // não vaza alinhamento nem linha de base para o que o chamador desenha depois
    g.save();
    g.textBaseline = "middle";
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      if (!it) continue;
      const r = this.rect(i);
      const selected = i === this.index;
      g.fillStyle = selected ? "rgba(120,200,255,0.18)" : "rgba(4,10,20,0.45)";
      g.fillRect(r.x, r.y, r.w, r.h);
      g.strokeStyle = selected ? "rgba(160,225,255,0.85)" : "rgba(120,170,210,0.25)";
      g.lineWidth = selected ? 2 : 1;
      g.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);

      g.textAlign = "left";
      g.fillStyle = selected ? "#eaf6ff" : "#9fbdd6";
      const labelY = it.kind === "button" && it.hint ? r.y + r.h * 0.36 : r.y + r.h / 2;
      g.font = `${selected ? "bold " : ""}${MENU.labelPx}px ${FONT_FAMILY}`;
      g.fillText(it.label, r.x + 16, labelY);
      if (it.kind === "button" && it.hint) {
        g.font = `${MENU.hintPx}px ${FONT_FAMILY}`;
        g.fillStyle = selected ? "#a9cde6" : "#6f8ea6";
        g.fillText(it.hint, r.x + 16, r.y + r.h * 0.74);
      }
      if (it.kind === "slider") {
        const t = this.track(i);
        const v = clamp(it.get(), 0, 1);
        g.fillStyle = "rgba(20,40,60,0.9)";
        g.fillRect(t.x, t.y, t.w, t.h);
        g.fillStyle = selected ? "#7fe6ff" : "#4f88a8";
        g.fillRect(t.x, t.y, t.w * v, t.h);
        g.textAlign = "right";
        g.font = `${MENU.hintPx}px ${FONT_FAMILY}`;
        g.fillStyle = selected ? "#eaf6ff" : "#9fbdd6";
        g.fillText(`${Math.round(v * 100)}%`, t.x - 10, r.y + r.h / 2);
      }
    }
    g.restore();
  }
}
