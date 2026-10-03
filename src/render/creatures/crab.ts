import { CRAB } from "../../config/bosses/crab";
import { TAU } from "../../core/math";
import { BOSS_DEFS } from "../../sim/bosses/registry";
import type { Boss } from "../../sim/bosses/types";

// Caranguejo Abissal (CONTEXTO §2.3 e §2.7). Os avisos de ataque são parte do desenho e vêm
// antes do corpo: a faixa da investida, o círculo da pinça e os anéis do chamado. O alcance da
// pinça vem do próprio ataque (`fxSize`), não de uma cópia no render.
//
// O corpo é só apresentação (a simulação não o lê): carapaça com relevo, bordas e luz fixa no
// mundo (não gira com o bicho), pernas e braços articulados, pinças com dentes que abrem no
// aviso da pinça e olhos em hastes. Na fase 2 a carapaça racha e brilha por dentro, e os
// espinhos crescem: ele "enlouquece" como o Olho ganha olhos.

/** Progresso do estado, de 0 a 1. Estados sem duração fixa contam como cheios. */
const progress = (b: Boss): number =>
  b.stateMs > 0 && Number.isFinite(b.stateMs) ? 1 - Math.max(b.t, 0) / b.stateMs : 1;

interface CrabPalette {
  hi: string;
  mid: string;
  lo: string;
  rim: string;
  claw: string;
  clawLo: string;
  leg: string;
  legLo: string;
  eye: string;
}

const PALETTE: readonly CrabPalette[] = [
  { hi: "#e79a68", mid: "#b4643c", lo: "#5e2f1a", rim: "#3c1c0e", claw: "#d98a58", clawLo: "#7a3d20", leg: "#98542f", legLo: "#43210f", eye: "#ffe066" },
  { hi: "#ff8a63", mid: "#d8492f", lo: "#68170d", rim: "#350b06", claw: "#ff6a48", clawLo: "#8f2314", leg: "#b04328", legLo: "#470f07", eye: "#ffb347" },
];

/** "#rrggbb" → "rgba(r,g,b,a)". */
function withAlphaHex(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Tubérculos da carapaça, em fração do raio (x para a frente, y para o lado). */
const BUMPS: readonly (readonly [number, number])[] = [
  [0.52, 0.27], [0.52, -0.27], [0.28, 0.0], [0.08, 0.42], [0.06, -0.44], [-0.18, 0.2], [-0.2, -0.22],
  [-0.4, 0.42], [-0.42, -0.4], [-0.62, 0.16], [-0.62, -0.18],
];

/** Cracas na carapaça (de dois em dois, para parecer um aglomerado). */
const BARNACLES: readonly (readonly [number, number])[] = [
  [-0.46, 0.18], [-0.41, 0.25], [-0.12, -0.32], [-0.18, -0.36], [-0.7, -0.02], [-0.66, 0.05],
];

/** Rachaduras da fase 2, em fração do raio: partem do meio da carapaça e vão até a borda. */
const CRACKS: readonly (readonly (readonly [number, number])[])[] = [
  [[-0.1, 0.0], [0.05, 0.14], [0.2, 0.1], [0.34, 0.26], [0.5, 0.3]],
  [[-0.1, 0.0], [-0.02, -0.16], [0.14, -0.2], [0.28, -0.36], [0.42, -0.44]],
  [[-0.1, 0.0], [-0.26, 0.1], [-0.36, 0.28], [-0.5, 0.36]],
  [[-0.1, 0.0], [-0.28, -0.08], [-0.4, -0.2], [-0.58, -0.3]],
];

/** Contorno da carapaça: elipse com a borda recortada e uma fenda entre os olhos. */
function shellPath(g: CanvasRenderingContext2D, r: number, scale: number): void {
  const n = 72;
  g.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * TAU;
    const notch = 0.09 * Math.exp(-((a / 0.2) ** 2)) + 0.09 * Math.exp(-(((a - TAU) / 0.2) ** 2));
    const k = (1 + 0.03 * Math.cos(a * 9) - notch) * scale;
    const px = Math.cos(a) * r * k;
    const py = Math.sin(a) * r * 0.78 * k;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

function bumpPath(g: CanvasRenderingContext2D, pts: readonly (readonly [number, number])[], r: number): void {
  g.beginPath();
  pts.forEach(([px, py], i) => {
    if (i === 0) g.moveTo(px * r, py * r);
    else g.lineTo(px * r, py * r);
  });
}

export function drawCrab(g: CanvasRenderingContext2D, b: Boss, x: number, y: number, ang: number, time: number): void {
  const k = progress(b);
  const telegraph = b.state === "telegraph";
  const executing = b.state === "execute";

  // avisos de ataque, no chão/água
  if (telegraph && b.attack === "dash") {
    g.save();
    g.globalAlpha = 0.18 + 0.3 * k;
    g.fillStyle = "#ff7a4a";
    g.translate(x, y);
    g.rotate(Math.atan2(b.dirY, b.dirX));
    g.fillRect(0, -CRAB.dash.laneHalfWidth, CRAB.dash.laneLength, CRAB.dash.laneHalfWidth * 2);
    g.restore();
  }
  if (b.attack === "pinch" && (telegraph || executing)) {
    const R = BOSS_DEFS.crab.attacks.pinch?.fxSize?.(b) ?? 0;
    g.globalAlpha = executing ? 0.5 : 0.2 + 0.25 * k;
    g.fillStyle = executing ? "#ffd7a0" : "#ff9a5a";
    g.beginPath();
    g.arc(x, y, executing ? R : R * (0.4 + 0.6 * k), 0, TAU);
    g.fill();
    g.globalAlpha = 1;
    g.strokeStyle = "#ffbe80";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, R, 0, TAU);
    g.stroke();
  }
  if (telegraph && b.attack === "call") {
    g.strokeStyle = "rgba(140,255,210,0.7)";
    g.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(x, y, 30 + ((k * 140 + i * 45) % 140), 0, TAU);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  const r = b.radius;
  const flash = b.flashMs > 0;
  const rage = b.phase >= 1;
  const pal = PALETTE[rage ? 1 : 0] ?? PALETTE[0]!;
  const W = "#ffffff";
  const pinching = b.attack === "pinch" && (telegraph || executing);
  // quanto a pinça está brilhando: cresce no aviso e fica cheia no golpe
  const charge = pinching ? (executing ? 1 : k) : 0;

  g.save();
  g.translate(x, y);
  // sombra de contato, no mundo (não gira com o corpo)
  const sh = g.createRadialGradient(4, 8, r * 0.2, 4, 8, r * 1.25);
  sh.addColorStop(0, "rgba(0,0,0,0.28)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(4, 8, r * 1.25, r * 1.0, 0, 0, TAU);
  g.fill();

  g.rotate(ang);
  g.lineCap = "round";
  g.lineJoin = "round";

  // pernas: duas peças, andando em alternância (as de um lado contra as do outro)
  for (let side = -1; side <= 1; side += 2) {
    for (let j = 0; j < 3; j++) {
      const hx = r * (0.3 - j * 0.3);
      const hy = side * r * 0.5;
      const swing = Math.sin(time * 5 + j * 2.1 + (side > 0 ? Math.PI : 0)) * 0.17;
      const a1 = side * (Math.PI / 2 - 0.6 + j * 0.55 + swing);
      const kx = hx + Math.cos(a1) * r * 0.45;
      const ky = hy + Math.sin(a1) * r * 0.45;
      const a2 = side * (Math.PI / 2 - 0.6 + j * 0.55 + swing - 0.75);
      const tx = kx + Math.cos(a2) * r * 0.56;
      const ty = ky + Math.sin(a2) * r * 0.56;
      for (const [w, col] of [[8, flash ? W : pal.legLo], [5, flash ? W : pal.leg]] as const) {
        g.strokeStyle = col;
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(kx, ky);
        g.lineTo(tx, ty);
        g.stroke();
      }
      g.fillStyle = flash ? W : pal.hi;
      g.globalAlpha = 0.55;
      g.beginPath();
      g.arc(kx, ky, 2.2, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  // espinhos do casco, atrás da carapaça: crescem na fase 2
  g.fillStyle = flash ? W : pal.lo;
  const spikeH = rage ? 10 : 6;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI * (0.58 + i * 0.1);
    for (const s of [-1, 1]) {
      const bx = Math.cos(a) * r * 0.97;
      const by = s * Math.sin(a) * r * 0.78 * 0.97;
      const nx = Math.cos(a);
      const ny = s * Math.sin(a);
      const tx = -ny;
      const ty = nx;
      g.beginPath();
      g.moveTo(bx + tx * 4.5, by + ty * 4.5);
      g.lineTo(bx + nx * spikeH, by + ny * spikeH);
      g.lineTo(bx - tx * 4.5, by - ty * 4.5);
      g.closePath();
      g.fill();
    }
  }

  // braços: do ombro, por baixo da carapaça, até o pulso
  for (const s of [-1, 1]) {
    for (const [w, col] of [[11, flash ? W : pal.clawLo], [7.5, flash ? W : pal.claw]] as const) {
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.moveTo(r * 0.15, s * r * 0.5);
      g.lineTo(r * 0.5, s * r * 0.98);
      g.lineTo(r * 0.8, s * r * 0.7);
      g.stroke();
    }
  }

  // carapaça
  shellPath(g, r, 1);
  if (flash) {
    g.fillStyle = W;
    g.fill();
  } else {
    // a luz vem de cima à esquerda da tela: o brilho é calculado no mundo, desfazendo a rotação
    const lx = -r * 0.3;
    const ly = -r * 0.38;
    const hx = lx * Math.cos(-ang) - ly * Math.sin(-ang);
    const hy = lx * Math.sin(-ang) + ly * Math.cos(-ang);
    const grad = g.createRadialGradient(hx, hy, r * 0.1, 0, 0, r * 1.05);
    grad.addColorStop(0, pal.hi);
    grad.addColorStop(0.55, pal.mid);
    grad.addColorStop(1, pal.lo);
    g.fillStyle = grad;
    g.fill();

    g.save();
    shellPath(g, r, 1);
    g.clip();
    // sulcos da carapaça e a região do coração
    g.strokeStyle = pal.lo;
    g.globalAlpha = 0.55;
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(r * 0.3, -r * 0.55);
    g.quadraticCurveTo(r * 0.04, 0, r * 0.3, r * 0.55);
    g.moveTo(-r * 0.36, -r * 0.5);
    g.quadraticCurveTo(-r * 0.08, 0, -r * 0.36, r * 0.5);
    g.stroke();
    g.globalAlpha = 0.2;
    g.fillStyle = pal.lo;
    g.beginPath();
    g.ellipse(-r * 0.1, 0, r * 0.28, r * 0.2, 0, 0, TAU);
    g.fill();
    // tubérculos: um ponto claro com a sombra logo abaixo
    for (const [bx, by] of BUMPS) {
      g.globalAlpha = 0.35;
      g.fillStyle = pal.lo;
      g.beginPath();
      g.arc(bx * r + 0.8, by * r + 1.2, 2.4, 0, TAU);
      g.fill();
      g.globalAlpha = 0.65;
      g.fillStyle = pal.hi;
      g.beginPath();
      g.arc(bx * r, by * r, 2.1, 0, TAU);
      g.fill();
    }
    // cracas
    g.globalAlpha = 0.9;
    for (const [bx, by] of BARNACLES) {
      g.fillStyle = "#e8dcc0";
      g.beginPath();
      g.arc(bx * r, by * r, 2.6, 0, TAU);
      g.fill();
      g.fillStyle = "#8a7a60";
      g.beginPath();
      g.arc(bx * r, by * r, 1, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
    // fase 2: rachaduras que brilham de dentro
    if (rage) {
      const beat = 0.75 + 0.25 * Math.sin(time * 6);
      g.strokeStyle = "#ff9a3c";
      g.lineWidth = 5;
      g.globalAlpha = 0.22 * beat;
      for (const c of CRACKS) {
        bumpPath(g, c, r);
        g.stroke();
      }
      g.strokeStyle = "#ffd27a";
      g.lineWidth = 1.7;
      g.globalAlpha = 0.95 * beat;
      for (const c of CRACKS) {
        bumpPath(g, c, r);
        g.stroke();
      }
      g.globalAlpha = 1;
    }
    // bordo escuro por dentro: dá volume
    g.strokeStyle = "rgba(20,6,0,0.35)";
    g.lineWidth = r * 0.22;
    shellPath(g, r, 1);
    g.stroke();
    g.restore();

    // reflexo, perto do ponto de luz
    g.globalAlpha = 0.28;
    g.fillStyle = "#fff4e0";
    g.beginPath();
    g.ellipse(hx * 0.9, hy * 0.9, r * 0.2, r * 0.1, Math.atan2(hy, hx) + Math.PI / 2, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  g.strokeStyle = flash ? W : pal.rim;
  g.lineWidth = 3;
  shellPath(g, r, 1);
  g.stroke();

  // garras: palma grossa que afina no dedo fixo (por dentro) e um dedo móvel articulado em cima,
  // com dentes. O dedo móvel abre durante o aviso da pinça (a animação é parte do aviso).
  const open = pinching ? 0.9 : 0.25 + Math.sin(time * 3) * 0.08;
  const jaw = -(open - 0.15) * 0.9;
  for (const s of [-1, 1]) {
    g.save();
    g.translate(r * 0.8, s * r * 0.7);
    g.rotate(s * -0.3);
    // o dedo móvel fica do lado de fora da garra, o fixo do lado de dentro
    g.scale(0.92, -0.92 * s);
    if (charge > 0 && !flash) {
      const glow = g.createRadialGradient(28, 0, 2, 28, 0, 44);
      glow.addColorStop(0, "rgba(255,215,160,0.9)");
      glow.addColorStop(1, "rgba(255,215,160,0)");
      g.globalAlpha = 0.5 * charge;
      g.fillStyle = glow;
      g.beginPath();
      g.arc(28, 0, 44, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }

    // palma e dedo fixo, numa peça só
    g.beginPath();
    g.moveTo(-5, -3);
    g.bezierCurveTo(-5, -15, 14, -17, 27, -9);
    g.lineTo(28, -3);
    g.lineTo(34, -1.5);
    g.lineTo(37, 2);
    g.lineTo(41, 0.6);
    g.lineTo(45, 3.4);
    g.bezierCurveTo(41, 11, 30, 16, 16, 16);
    g.bezierCurveTo(3, 16, -5, 10, -5, -3);
    g.closePath();
    if (flash) {
      g.fillStyle = W;
      g.fill();
    } else {
      const pg = g.createRadialGradient(10, -6, 2, 14, 2, 24);
      pg.addColorStop(0, charge > 0 ? "#ffd7a0" : pal.hi);
      pg.addColorStop(1, pal.claw);
      g.fillStyle = pg;
      g.fill();
      // a ponta do dedo escurece, como a de uma garra de verdade
      const tip = g.createLinearGradient(30, 0, 46, 3);
      tip.addColorStop(0, "rgba(0,0,0,0)");
      tip.addColorStop(1, withAlphaHex(pal.clawLo, 0.85));
      g.fillStyle = tip;
      g.fill();
      g.strokeStyle = pal.clawLo;
      g.lineWidth = 2;
      g.stroke();
      // tubérculos na palma e um fio de luz na curva de cima
      g.fillStyle = pal.clawLo;
      g.globalAlpha = 0.45;
      for (const [bx, by] of [[6, 5], [13, 8], [19, 3], [9, -3]] as const) {
        g.beginPath();
        g.arc(bx, by, 1.6, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 0.4;
      g.strokeStyle = "#fff4e0";
      g.lineWidth = 1.4;
      g.beginPath();
      g.moveTo(-1, -6);
      g.bezierCurveTo(2, -13, 14, -14, 24, -8);
      g.stroke();
      g.globalAlpha = 1;
    }

    // dedo móvel, articulado no alto da palma
    g.save();
    g.translate(26, -8);
    g.rotate(jaw);
    g.beginPath();
    g.moveTo(-6, -5);
    g.bezierCurveTo(6, -10, 22, -8, 31, 5);
    g.lineTo(26, 4.6);
    g.lineTo(23, 0.8);
    g.lineTo(19, 3);
    g.lineTo(15, -0.6);
    g.lineTo(11, 1.6);
    g.lineTo(7, -1.2);
    g.lineTo(-6, 3);
    g.closePath();
    if (flash) {
      g.fillStyle = W;
      g.fill();
    } else {
      const dg = g.createLinearGradient(0, 0, 31, 4);
      dg.addColorStop(0, charge > 0 ? pal.hi : pal.claw);
      dg.addColorStop(0.65, pal.claw);
      dg.addColorStop(1, pal.clawLo);
      g.fillStyle = dg;
      g.fill();
      g.strokeStyle = pal.clawLo;
      g.lineWidth = 2;
      g.stroke();
      g.globalAlpha = 0.4;
      g.strokeStyle = "#fff4e0";
      g.lineWidth = 1.3;
      g.beginPath();
      g.moveTo(-3, -4);
      g.bezierCurveTo(7, -8, 20, -6, 27, 3);
      g.stroke();
      g.globalAlpha = 1;
      // a junta
      g.fillStyle = pal.clawLo;
      g.beginPath();
      g.arc(0, 0, 3, 0, TAU);
      g.fill();
      g.fillStyle = pal.hi;
      g.globalAlpha = 0.6;
      g.beginPath();
      g.arc(-0.6, -0.6, 1.2, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    g.restore();
    g.restore();
  }

  // olhos em hastes, na fenda da frente
  for (const s of [-1, 1]) {
    const ex = r * 0.82;
    const ey = s * r * 0.26;
    g.strokeStyle = flash ? W : pal.legLo;
    g.lineWidth = 4.5;
    g.beginPath();
    g.moveTo(r * 0.6, s * r * 0.17);
    g.lineTo(ex, ey);
    g.stroke();
    if (flash) {
      g.fillStyle = W;
      g.beginPath();
      g.arc(ex, ey, 5, 0, TAU);
      g.fill();
      continue;
    }
    if (rage) {
      const halo = g.createRadialGradient(ex, ey, 2, ex, ey, 12);
      halo.addColorStop(0, "rgba(255,179,71,0.75)");
      halo.addColorStop(1, "rgba(255,179,71,0)");
      g.globalAlpha = 0.65 + 0.3 * Math.sin(time * 6 + s);
      g.fillStyle = halo;
      g.beginPath();
      g.arc(ex, ey, 12, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
    }
    const eg = g.createRadialGradient(ex - 1.2, ey - 1.5, 0.5, ex, ey, 5.2);
    eg.addColorStop(0, "#fffbe0");
    eg.addColorStop(0.35, pal.eye);
    eg.addColorStop(1, rage ? "#c4520f" : "#c79a1a");
    g.fillStyle = eg;
    g.beginPath();
    g.arc(ex, ey, 5.2, 0, TAU);
    g.fill();
    g.strokeStyle = "rgba(40,12,0,0.6)";
    g.lineWidth = 1;
    g.stroke();
    // pupila vertical, espiando para a frente
    g.fillStyle = "#1a0c06";
    g.beginPath();
    g.ellipse(ex + 1.2, ey, 1.3, 3.2, 0, 0, TAU);
    g.fill();
  }
  g.restore();
}
