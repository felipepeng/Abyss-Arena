import { DARKNESS, DESCENT_COLORS, SHAFT } from "../config/descent";
import type { Palette } from "../config/palette";
import { FONT_FAMILY, VIEW } from "../config/system";
import { clamp, lerp, TAU } from "../core/math";
import { createPlayer } from "../sim/player";
import { drawPlayer } from "./creatures/player";

// Desenho da cena de descida (GDD §2.5): um poço vertical visto de lado, com a câmera descendo
// junto do mergulhador, que no fim sai pela boca do poço na fase seguinte. A escuridão vai por cima. Só lê o estado que a cena passa; as bolhas e as
// riscas são decoração, então usam Math.random (como `ambient.ts`).

/** O que a cena entrega ao desenho a cada quadro. */
export interface DescentFrame {
  from: Palette;
  to: Palette;
  /** 0 = cores do mapa que acabou, 1 = as do próximo. */
  mix: number;
  /** Quanto a câmera desceu, px do mundo da cena. */
  camY: number;
  /** Profundidade da boca de saída do poço, no mundo da cena: abaixo dela é a água da fase seguinte. */
  exitY: number;
  /** O mergulhador: x na tela, y no mundo da cena, e a direção do nariz. */
  diverX: number;
  diverY: number;
  aim: number;
  /** Velocidade vertical dele, px/s. */
  speedPxS: number;
  /** 1 = dia, 0 = preto. */
  light: number;
  timeMs: number;
  /** Texto de ajuda no canto, ou "" para nenhum. */
  hint: string;
}

interface Bubble {
  x: number;
  y: number;
  r: number;
  /** Subida própria, px/s, além de a câmera estar descendo. */
  rise: number;
  phase: number;
  /** Nasceu do mergulhador: some ao sair da tela em vez de renascer embaixo. */
  trail: boolean;
}

interface Streak {
  x: number;
  y: number;
  len: number;
}

const MAX_BUBBLES = 90;
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

// ---------------------------------------------------------------------------------------------
// Cores

function parseHex(c: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
  const h = m?.[1];
  if (!h) return null;
  const full = h.length === 3 ? [...h].map((d) => d + d).join("") : h;
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

/** Mistura duas cores `#rrggbb`. Se alguma não for hexadecimal, devolve `a`. */
export function mixHex(a: string, b: string, t: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const k = clamp(t, 0, 1);
  const ch = (i: number): string => Math.round(lerp(ca[i] ?? 0, cb[i] ?? 0, k)).toString(16).padStart(2, "0");
  return `#${ch(0)}${ch(1)}${ch(2)}`;
}

// ---------------------------------------------------------------------------------------------
// O poço: a geometria é uma função da profundidade, sem sorteio, então é a mesma a cada quadro.

const CX = VIEW.width / 2;

const wob = (wy: number, phase: number): number =>
  Math.sin(wy * 0.011 + phase) * 22 + Math.sin(wy * 0.027 + phase * 2.3) * 12 + Math.sin(wy * 0.061 + phase * 0.7) * 5;

/** Meia largura do poço na profundidade `wy`: constante, e mais larga perto da boca de saída (`exitY`). */
const half = (wy: number, exitY: number): number =>
  SHAFT.halfWidth + SHAFT.mouthFlare * Math.exp(-Math.max(0, exitY - wy) / SHAFT.mouthFlareLen);

/** x da parede esquerda e da direita na profundidade `wy` (mundo da cena). */
export const shaftLeft = (wy: number, exitY: number): number => CX - half(wy, exitY) + wob(wy, 0.4);
export const shaftRight = (wy: number, exitY: number): number => CX + half(wy, exitY) + wob(wy, 3.1);

/** O fundo do teto da fase seguinte: ondula e some perto da boca, para a borda do buraco ser limpa. */
const ceiling = (x: number, distToMouth: number, exitY: number): number => {
  const fade = clamp(distToMouth / 120, 0, 1);
  return exitY + (14 + Math.sin(x * 0.013 + 1) * 10 + Math.sin(x * 0.041) * 6) * fade;
};

const rgba = (hex: string, a: number): string => {
  const c = parseHex(hex) ?? [0, 0, 0];
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
};

export class DescentRenderer {
  private readonly bubbles: Bubble[] = [];
  private readonly streaks: Streak[] = [];
  private readonly player = createPlayer(0, 0);

  constructor() {
    for (let i = 0; i < SHAFT.bubbles; i++) this.bubbles.push(this.spawnBubble(true));
    for (let i = 0; i < SHAFT.streaks; i++) {
      this.streaks.push({ x: rand(CX - SHAFT.halfWidth, CX + SHAFT.halfWidth), y: rand(0, VIEW.height), len: rand(30, 90) });
    }
  }

  private spawnBubble(anywhere: boolean): Bubble {
    return {
      x: rand(0, VIEW.width),
      y: anywhere ? rand(0, VIEW.height) : VIEW.height + 10,
      r: rand(1.5, 5),
      rise: rand(14, 46),
      phase: rand(0, TAU),
      trail: false,
    };
  }

  /** Anda as bolhas e as riscas. `speedPxS` é a velocidade da queda; (diverX, diverScreenY) é onde ele está na tela. */
  step(dtMs: number, speedPxS: number, diverX: number, diverScreenY: number): void {
    const dt = dtMs / 1000;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i] as Bubble;
      b.y -= (b.rise + speedPxS) * dt;
      if (b.y >= -10) continue;
      if (b.trail) this.bubbles.splice(i, 1);
      else this.bubbles[i] = this.spawnBubble(false);
    }
    // um fio de bolhas atrás do mergulhador, mais denso quanto mais rápido ele cai
    if (speedPxS > 40 && this.bubbles.length < MAX_BUBBLES && Math.random() < Math.min(0.6, speedPxS / 700)) {
      this.bubbles.push({ x: diverX + rand(-8, 8), y: diverScreenY - 12, r: rand(1, 3), rise: rand(10, 30), phase: rand(0, TAU), trail: true });
    }
    for (const s of this.streaks) {
      s.y -= speedPxS * 2 * dt;
      if (s.y + s.len < 0) {
        s.y = VIEW.height + rand(0, 80);
        s.x = rand(CX - SHAFT.halfWidth, CX + SHAFT.halfWidth);
        s.len = rand(30, 90);
      }
    }
  }

  draw(g: CanvasRenderingContext2D, f: DescentFrame): void {
    const { width: W, height: H } = VIEW;
    const rockBody = mixHex(f.from.rockBody, f.to.rockBody, f.mix);
    const rockTop = mixHex(f.from.rockTop, f.to.rockTop, f.mix);
    const rockLight = mixHex(f.from.rockLight, f.to.rockLight, f.mix);
    const t = f.timeMs / 1000;

    // fundo: o gradiente do mapa que acabou virando o do próximo
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, mixHex(f.from.bg[0], f.to.bg[0], f.mix));
    grad.addColorStop(0.45, mixHex(f.from.bg[1], f.to.bg[1], f.mix));
    grad.addColorStop(1, mixHex(f.from.bg[2], f.to.bg[2], f.mix));
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    // acima da boca de saída, a parede do fundo do poço: mais escura que a rocha da frente, com
    // estratos que andam mais devagar que ela (parallax); perto da boca ela se dissolve na água da
    // fase seguinte
    const farBottom = f.exitY - f.camY;
    if (farBottom > 0) {
      const farColor = mixHex(rockBody, DESCENT_COLORS.farWall, DESCENT_COLORS.farWallMix);
      const fade = g.createLinearGradient(0, 0, 0, farBottom);
      fade.addColorStop(0, farColor);
      fade.addColorStop(clamp(1 - DESCENT_COLORS.farWallFadePx / farBottom, 0, 1), farColor);
      fade.addColorStop(1, rgba(farColor, 0));
      g.fillStyle = fade;
      g.fillRect(0, 0, W, farBottom);
      const gap = SHAFT.strataGapPx;
      const shift = (f.camY * SHAFT.strataParallax) % gap;
      g.lineWidth = 2;
      for (let k = -1; k * gap - shift < H; k++) {
        const y0 = k * gap - shift + 30;
        if (y0 > farBottom - DESCENT_COLORS.farWallFadePx * 0.6) break;
        g.strokeStyle = "rgba(0,0,0,0.28)";
        g.beginPath();
        for (let x = 0; x <= W; x += 80) {
          const y = y0 + Math.sin(x * 0.02 + k * 1.7) * 4;
          if (x === 0) g.moveTo(x, y);
          else g.lineTo(x, y);
        }
        g.stroke();
      }
    }

    // a luz da fase seguinte entrando pela boca de saída: um feixe que abre para baixo
    if (f.to.light && farBottom < H + 400) {
      g.save();
      g.translate(0, -f.camY);
      g.fillStyle = f.to.light.color;
      g.globalAlpha = f.to.light.alpha * 2.5 * f.light * f.mix;
      g.beginPath();
      g.moveTo(CX - SHAFT.halfWidth, f.exitY);
      g.lineTo(CX + SHAFT.halfWidth, f.exitY);
      g.lineTo(CX + SHAFT.halfWidth + 160, f.exitY + 460);
      g.lineTo(CX - SHAFT.halfWidth - 160, f.exitY + 460);
      g.closePath();
      g.fill();
      g.restore();
      g.globalAlpha = 1;
    }

    // riscas de velocidade e bolhas ficam atrás da rocha da frente
    g.strokeStyle = DESCENT_COLORS.streak;
    g.lineWidth = 1.2;
    const streakAlpha = clamp(f.speedPxS / 900, 0, 0.35);
    if (streakAlpha > 0.01) {
      g.globalAlpha = streakAlpha;
      for (const s of this.streaks) {
        g.beginPath();
        g.moveTo(s.x, s.y);
        g.lineTo(s.x, s.y + s.len * (f.speedPxS / 430));
        g.stroke();
      }
    }
    g.strokeStyle = DESCENT_COLORS.bubble;
    g.lineWidth = 1.2;
    for (const b of this.bubbles) {
      g.globalAlpha = 0.18 + 0.22 * (b.r / 5);
      g.beginPath();
      g.arc(b.x + Math.sin(t * 1.2 + b.phase) * 6, b.y, b.r, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;

    this.drawWalls(g, f, rockBody, rockTop, rockLight);

    // o mergulhador, de cabeça para baixo na queda
    const p = this.player;
    p.x = p.prevX = f.diverX;
    p.y = p.prevY = f.diverY - f.camY;
    p.aim = p.prevAim = f.aim;
    drawPlayer(g, p, 1, f.timeMs);

    this.drawDarkness(g, f);

    if (f.hint) {
      g.font = `12px ${FONT_FAMILY}`;
      g.textAlign = "right";
      g.textBaseline = "alphabetic";
      g.fillStyle = DESCENT_COLORS.hint;
      g.fillText(f.hint, W - 16, H - 16);
      g.textAlign = "left";
    }
  }

  /** As duas paredes de rocha, do alto da tela até a boca de saída e o teto da fase seguinte. Em coordenadas do mundo da cena. */
  private drawWalls(g: CanvasRenderingContext2D, f: DescentFrame, body: string, top: string, light: string): void {
    const W = VIEW.width;
    const step = SHAFT.edgeStepPx;
    const yTop = f.camY - 20;
    const exitVisible = f.exitY <= f.camY + VIEW.height + 20;
    const yBottom = Math.min(f.camY + VIEW.height + 20, f.exitY);

    g.save();
    g.translate(0, -f.camY);
    g.lineJoin = "round";
    for (const side of [-1, 1] as const) {
      const edge = (wy: number): number => (side < 0 ? shaftLeft(wy, f.exitY) : shaftRight(wy, f.exitY));
      const outer = side < 0 ? -20 : W + 20;
      const mouthX = edge(f.exitY);
      // a parte de baixo do teto, da boca para fora
      const undersidePath = (): void => {
        for (let x = mouthX; side < 0 ? x > outer : x < outer; x += side * 16) g.lineTo(x, ceiling(x, Math.abs(x - mouthX), f.exitY));
        g.lineTo(outer, ceiling(outer, Math.abs(outer - mouthX), f.exitY));
      };
      const edgePath = (dx: number): void => {
        g.moveTo(edge(yTop) + dx, yTop);
        for (let wy = yTop; wy < yBottom; wy += step) g.lineTo(edge(wy) + dx, wy);
        g.lineTo(edge(yBottom) + dx, yBottom);
      };

      g.beginPath();
      g.moveTo(outer, yTop);
      g.lineTo(edge(yTop), yTop);
      for (let wy = yTop; wy < yBottom; wy += step) g.lineTo(edge(wy), wy);
      g.lineTo(edge(yBottom), yBottom);
      if (exitVisible) undersidePath();
      else g.lineTo(outer, yBottom);
      g.closePath();
      g.fillStyle = body;
      g.fill();

      // relevo: uma sombra larga e um fio de luz na borda voltada para o poço, e o fundo do teto
      g.beginPath();
      edgePath(side * 5);
      g.strokeStyle = "rgba(0,0,0,0.22)";
      g.lineWidth = 9;
      g.stroke();
      g.beginPath();
      edgePath(0);
      g.strokeStyle = light;
      g.lineWidth = 3;
      g.stroke();
      if (exitVisible) {
        g.beginPath();
        g.moveTo(mouthX, f.exitY);
        undersidePath();
        g.strokeStyle = top;
        g.lineWidth = 5;
        g.stroke();
      }
    }
    g.restore();
  }

  /** A escuridão: tudo longe do mergulhador escurece, e o círculo de luz dele encolhe com a luz. */
  private drawDarkness(g: CanvasRenderingContext2D, f: DescentFrame): void {
    const dark = clamp(1 - f.light, 0, 1) * DARKNESS.maxAlpha;
    if (dark < 0.002) return;
    const R = lerp(DARKNESS.lanternMinPx, DARKNESS.lanternMaxPx, clamp(f.light, 0, 1));
    const x = f.diverX;
    const y = f.diverY - f.camY;
    const c = DARKNESS.color;
    const gr = g.createRadialGradient(x, y, R * 0.04, x, y, R);
    gr.addColorStop(0, `rgba(${c}, 0)`);
    gr.addColorStop(0.45, `rgba(${c}, ${(dark * 0.4).toFixed(3)})`);
    gr.addColorStop(1, `rgba(${c}, ${dark.toFixed(3)})`);
    g.fillStyle = gr;
    g.fillRect(0, 0, VIEW.width, VIEW.height);
  }
}
