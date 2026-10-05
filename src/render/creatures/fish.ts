import { TAU } from "../../core/math";
import type { Enemy } from "../../sim/enemies/types";
import type { Drawer } from "./exclusive";

// Peixe (CONTEXTO §2.3 e §5.1): corpo de torpedo que afina até o pedúnculo, degradê com a luz fixa
// no mundo, contorno escuro, nadadeiras dorsal, ventral e peitoral e uma cauda bifurcada que balança
// no ritmo do serpenteio da simulação (`data.wob`). O aviso da investida (halo pulsante e linha de
// mira travada) é o de sempre: o corpo fica âmbar, o cenho franze, e na investida a cauda fica
// reta e aparecem riscos de velocidade. Só apresentação.

interface FishPalette {
  hi: string;
  mid: string;
  lo: string;
  rim: string;
  fin: string;
  finLo: string;
}

const NORMAL: FishPalette = { hi: "#ff9a76", mid: "#e8663f", lo: "#b4412b", rim: "#5a1a0d", fin: "#c24a30", finLo: "#8f2f1d" };
/** No aviso o corpo vira o âmbar do protótipo (#ffb347). */
const WARN: FishPalette = { hi: "#ffe3a6", mid: "#ffb347", lo: "#e0862e", rim: "#65390f", fin: "#e69a3a", finLo: "#b5651c" };

/** Progresso do estado atual, de 0 (acabou de entrar) a 1 (vai sair). */
const progress = (e: Enemy): number => (e.stateMs > 0 ? 1 - Math.max(e.t, 0) / e.stateMs : 1);

function bodyPath(g: CanvasRenderingContext2D, r: number): void {
  g.beginPath();
  g.moveTo(r + 4, 0);
  g.bezierCurveTo(r + 4, -r * 0.55, r * 0.45, -r * 0.74, -r * 0.25, -r * 0.62);
  g.bezierCurveTo(-r * 0.8, -r * 0.52, -r - 1, -r * 0.22, -r - 3, -r * 0.18);
  g.lineTo(-r - 3, r * 0.18);
  g.bezierCurveTo(-r - 1, r * 0.22, -r * 0.8, r * 0.52, -r * 0.25, r * 0.62);
  g.bezierCurveTo(r * 0.45, r * 0.74, r + 4, r * 0.55, r + 4, 0);
  g.closePath();
}

export const drawFish: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const charging = e.state === "charge";
  const k = progress(e);

  if (tel) {
    g.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(k * 14));
    g.fillStyle = "#ffcf6a";
    g.beginPath();
    g.arc(0, 0, r + 9, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    // linha de aviso na direção travada (a criatura já está girada para o ângulo dela)
    g.save();
    g.rotate(Math.atan2(e.dirY, e.dirX) - e.ang);
    g.strokeStyle = "rgba(255,190,90,0.5)";
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(r, 0);
    g.lineTo(r + 70, 0);
    g.stroke();
    g.restore();
  }

  const pal = tel ? WARN : NORMAL;
  const W = "#ffffff";
  const wob = e.data.wob ?? 0;
  // a cauda balança com o serpenteio; no aviso treme, na investida fica reta
  const wag = charging ? 0 : tel ? Math.sin(k * 60) * 0.14 : Math.sin(wob) * 0.34;
  g.lineJoin = "round";
  g.lineCap = "round";

  // riscos de velocidade atrás, na investida
  if (charging && !flashing) {
    g.strokeStyle = "rgba(255,217,160,0.45)";
    g.lineWidth = 1.4;
    for (const [dy, l] of [[-5, 13], [0, 18], [5, 13]] as const) {
      g.beginPath();
      g.moveTo(-r - 15, dy);
      g.lineTo(-r - 15 - l, dy);
      g.stroke();
    }
  }

  // cauda bifurcada, atrás do corpo
  g.save();
  g.translate(-r - 2.6, 0);
  g.rotate(wag);
  g.beginPath();
  g.moveTo(1, -1.8);
  g.quadraticCurveTo(-5, -2.5, -11, -8.2);
  g.quadraticCurveTo(-8.2, -3.2, -6.4, 0);
  g.quadraticCurveTo(-8.2, 3.2, -11, 8.2);
  g.quadraticCurveTo(-5, 2.5, 1, 1.8);
  g.closePath();
  if (flashing) {
    g.fillStyle = W;
    g.fill();
  } else {
    const tg = g.createLinearGradient(1, 0, -11, 0);
    tg.addColorStop(0, pal.fin);
    tg.addColorStop(1, pal.finLo);
    g.fillStyle = tg;
    g.fill();
    g.strokeStyle = pal.rim;
    g.lineWidth = 1.1;
    g.stroke();
  }
  g.restore();

  // nadadeiras dorsal e ventral, também atrás do corpo (a base fica escondida por ele)
  for (const side of [-1, 1] as const) {
    g.beginPath();
    if (side === -1) {
      g.moveTo(r * 0.4, -r * 0.66);
      g.quadraticCurveTo(r * 0.15, -r * 1.3, -r * 0.5, -r * 1.05);
      g.quadraticCurveTo(-r * 0.38, -r * 0.8, -r * 0.3, -r * 0.6);
    } else {
      g.moveTo(-r * 0.05, r * 0.62);
      g.quadraticCurveTo(-r * 0.25, r * 1.0, -r * 0.6, r * 0.95);
      g.quadraticCurveTo(-r * 0.48, r * 0.75, -r * 0.46, r * 0.58);
    }
    g.closePath();
    g.fillStyle = flashing ? W : pal.fin;
    g.fill();
    if (!flashing) {
      g.strokeStyle = pal.rim;
      g.lineWidth = 1.1;
      g.stroke();
    }
  }

  // corpo
  bodyPath(g, r);
  if (flashing) {
    g.fillStyle = W;
    g.fill();
    return;
  }
  // a luz vem de cima à esquerda da tela: o brilho é calculado no mundo, desfazendo a rotação
  const lx = -r * 0.3;
  const ly = -r * 0.45;
  const hx = lx * Math.cos(-e.ang) - ly * Math.sin(-e.ang);
  const hy = lx * Math.sin(-e.ang) + ly * Math.cos(-e.ang);
  const grad = g.createRadialGradient(hx, hy, 1.5, 0, 0, r * 1.6);
  grad.addColorStop(0, pal.hi);
  grad.addColorStop(0.55, pal.mid);
  grad.addColorStop(1, pal.lo);
  g.fillStyle = grad;
  g.fill();
  g.save();
  bodyPath(g, r);
  g.clip();
  // bordo escuro por dentro: dá volume
  g.strokeStyle = "rgba(40,8,0,0.18)";
  g.lineWidth = 4;
  bodyPath(g, r);
  g.stroke();
  // a linha da guelra
  g.strokeStyle = pal.lo;
  g.globalAlpha = 0.6;
  g.lineWidth = 1.2;
  g.beginPath();
  g.moveTo(r * 0.3, -r * 0.5);
  g.quadraticCurveTo(r * 0.12, 0, r * 0.3, r * 0.5);
  g.stroke();
  g.globalAlpha = 1;
  g.restore();
  g.strokeStyle = pal.rim;
  g.lineWidth = 1.3;
  bodyPath(g, r);
  g.stroke();

  // nadadeira peitoral, que bate de leve
  g.save();
  g.translate(r * 0.1, r * 0.22);
  g.rotate(0.55 + Math.sin(wob * 1.5) * 0.18);
  g.beginPath();
  g.ellipse(-3.2, 0, 4.8, 2.1, 0, 0, TAU);
  g.fillStyle = pal.fin;
  g.fill();
  g.strokeStyle = pal.rim;
  g.lineWidth = 0.9;
  g.stroke();
  g.restore();

  // boca
  g.strokeStyle = pal.rim;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(r + 3.4, 1.5);
  g.lineTo(r + 0.8, 1.8);
  g.stroke();

  // olho: anel claro, pupila e um brilho; no aviso e na investida o cenho franze por cima dele
  const ex = r * 0.62;
  const ey = -r * 0.22;
  g.fillStyle = "#fff2d6";
  g.beginPath();
  g.arc(ex, ey, 3.2, 0, TAU);
  g.fill();
  g.strokeStyle = pal.rim;
  g.lineWidth = 0.9;
  g.stroke();
  g.fillStyle = "#0b1420";
  g.beginPath();
  g.arc(ex + 0.7, ey, 1.9, 0, TAU);
  g.fill();
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(ex + 0.1, ey - 0.8, 0.65, 0, TAU);
  g.fill();
  if (tel || charging) {
    g.strokeStyle = pal.rim;
    g.lineWidth = 1.7;
    g.beginPath();
    g.moveTo(ex - 3.4, ey - 3.9);
    g.lineTo(ex + 3.8, ey - 1.4);
    g.stroke();
  }
};
