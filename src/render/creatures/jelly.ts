import { JELLY } from "../../config/bosses/jelly";
import { TAU, angDiff } from "../../core/math";
import type { Boss } from "../../sim/bosses/types";
import { rayLength } from "../../sim/geometry";
import type { Grid } from "../../world/grid";

// Água-viva (CONTEXTO §2.3 e §2.7): sino translúcido que respira, com borda de lóbulos, canais e
// gônadas por dentro, tentáculos finos em ondas, braços orais franjados e um núcleo que incha
// durante qualquer aviso. A cada fase ganha tentáculos e, nas duas últimas, uma coroa de
// pontinhos de luz (como o Olho ganha olhos). O corpo é só apresentação. Os avisos: anéis
// convergindo (anel de esporos), linha de mira + seta do sentido do giro (raio), arcos
// sugando para dentro (sucção). Os ataques novos: a fresta e o anel que se expande (onda de choque),
// os pontos das crias (chamado) e as cunhas varridas pelos três raios (farol). A cor muda a cada
// fase: verde-água, rosa e, na última, dourado incandescente.

const PALETTE = [
  { glow: "#8affe0", tent: "#4f9ab5", arm: "#6fc3d8", bell: ["#e6fffa", "#5fd9c4", "rgba(40,120,150,0.55)"] },
  { glow: "#ff9ede", tent: "#d9509f", arm: "#ff7ac0", bell: ["#ffd9f2", "#ff6fc0", "rgba(180,40,120,0.55)"] },
  { glow: "#ffe38a", tent: "#d99a2b", arm: "#ffd06a", bell: ["#fff6d6", "#ffc94d", "rgba(190,110,20,0.55)"] },
] as const;

export function drawJelly(g: CanvasRenderingContext2D, b: Boss, x: number, y: number, k: number, grid: Grid): void {
  const flash = b.flashMs > 0;
  const pal = PALETTE[Math.min(b.phase, PALETTE.length - 1)] ?? PALETTE[0];
  const glow = pal.glow;
  const pulse = b.data.pulse ?? 0;
  const telegraph = b.state === "telegraph";
  const executing = b.state === "execute";
  const R = b.radius;

  if (telegraph && b.attack === "ring") {
    g.strokeStyle = glow;
    g.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      const rr = 150 * (1 - ((k + i / 3) % 1));
      g.globalAlpha = 0.5 * (1 - rr / 150);
      g.beginPath();
      g.arc(x, y, R + rr, 0, TAU);
      g.stroke();
    }
    g.globalAlpha = 1;
  }

  if (b.attack === "beam" && (telegraph || executing)) drawBeam(g, b, x, y, telegraph ? k : 1, executing, glow);
  if (b.attack === "shock" && (telegraph || executing)) drawShock(g, b, x, y, k, executing, glow, grid);
  if (b.attack === "call" && telegraph) drawCall(g, b, x, y, k, glow);
  if (b.attack === "lighthouse" && (telegraph || executing)) drawLighthouse(g, b, x, y, telegraph ? k : 1, executing, glow, grid);

  if (b.attack === "pull" && (telegraph || executing)) {
    // na execução, os arcos fecham conforme o tempo passa
    const kk = executing ? Math.max(b.t, 0) / JELLY.pull.durationMs : k;
    g.strokeStyle = executing ? "#ffd6f5" : glow;
    g.lineWidth = executing ? 2.5 : 2;
    g.globalAlpha = executing ? 0.55 : 0.2 + 0.3 * kk;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + pulse * 0.6;
      const rr = JELLY.pull.radius * ((executing ? kk : 1) * 0.6 + 0.4);
      g.beginPath();
      g.arc(x, y, rr, a, a + 0.28);
      g.stroke();
    }
    g.strokeStyle = glow;
    g.lineWidth = 1;
    g.globalAlpha = 0.25;
    g.beginPath();
    g.arc(x, y, JELLY.pull.radius, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
  }

  drawBody(g, b, x, y, pal, flash, telegraph, pulse);
}

type JellyPalette = (typeof PALETTE)[number];

const WHITE = "#ffffff";

/** "#rrggbb" → "rgba(r,g,b,a)", para degradês que somem sem escurecer. */
function withAlpha(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Altura da borda de baixo do sino (a meia-elipse achatada) na posição x. */
const rimY = (R: number, x: number): number => R * 0.35 * Math.sqrt(Math.max(0, 1 - (x / R) ** 2));

/** Sobra de um lóbulo da borda, pulsando em contratempo com a respiração. */
const lobeBulge = (R: number, mid: number, pulse: number, j: number): number =>
  R * (0.1 + 0.035 * Math.sin(pulse * 1.6 + j * 0.8)) * (Math.sqrt(Math.max(0, 1 - (mid / R) ** 2)) + 0.3);

/** Sino: cúpula e borda de baixo recortada em lóbulos. */
function bellPath(g: CanvasRenderingContext2D, R: number, pulse: number): void {
  const lobes = 8;
  g.beginPath();
  g.ellipse(0, 0, R, R * 0.85, 0, Math.PI, TAU);
  for (let j = 0; j < lobes; j++) {
    const x1 = R - ((j + 1) * 2 * R) / lobes;
    const mid = R - ((j + 0.5) * 2 * R) / lobes;
    g.quadraticCurveTo(mid, rimY(R, mid) + lobeBulge(R, mid, pulse, j), x1, rimY(R, x1));
  }
  g.closePath();
}

/** Corpo da Água-viva: aura, tentáculos, braços orais, sino e núcleo, de trás para a frente. */
function drawBody(
  g: CanvasRenderingContext2D, b: Boss, x: number, y: number, pal: JellyPalette, flash: boolean, telegraph: boolean,
  pulse: number,
): void {
  const R = b.radius;
  const phase = Math.min(b.phase, 2);
  const breathe = 1 + Math.sin(pulse) * 0.07;
  g.save();
  g.translate(x, y);
  g.lineCap = "round";
  g.lineJoin = "round";

  // aura: mais forte a cada fase
  if (!flash) {
    const aura = g.createRadialGradient(0, 0, R * 0.3, 0, 0, R * (1.9 + 0.2 * phase));
    aura.addColorStop(0, withAlpha(pal.glow, 0.2 + 0.07 * phase));
    aura.addColorStop(1, withAlpha(pal.glow, 0));
    g.fillStyle = aura;
    g.beginPath();
    g.arc(0, 0, R * (1.9 + 0.2 * phase), 0, TAU);
    g.fill();
  }

  // tentáculos finos, atrás do sino: afinam e somem na ponta, com uma onda que desce
  const nTent = 9 + phase * 2;
  const SEG = 14;
  for (let i = 0; i < nTent; i++) {
    const u = i / (nTent - 1);
    const x0 = (u - 0.5) * R * 1.7;
    const y0 = rimY(R, x0) - 2;
    const len = R * (1.55 + 0.55 * (((i * 7) % 5) / 4));
    let px = x0;
    let py = y0;
    for (let sg = 1; sg <= SEG; sg++) {
      const t = sg / SEG;
      const nx = x0 * (1 - 0.18 * t) + Math.sin(pulse * 1.6 - t * 5 + i * 1.3) * (2 + 11 * t);
      const ny = y0 + t * len;
      g.strokeStyle = flash ? WHITE : pal.tent;
      g.globalAlpha = flash ? 1 : 0.9 * (1 - 0.65 * t);
      g.lineWidth = 3.2 * (1 - t) + 0.8;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(nx, ny);
      g.stroke();
      px = nx;
      py = ny;
    }
    if (!flash) {
      g.globalAlpha = 0.5 + 0.4 * Math.sin(pulse * 2 + i);
      g.fillStyle = pal.glow;
      g.beginPath();
      g.arc(px, py, 1.7, 0, TAU);
      g.fill();
    }
  }
  g.globalAlpha = 1;

  // braços orais: fitas franjadas que se desfazem na ponta
  for (let i = 0; i < 4; i++) {
    const off = (i / 3 - 0.5) * R * 0.8;
    const SEGS = 16;
    const left: [number, number][] = [];
    const right: [number, number][] = [];
    for (let sg = 0; sg <= SEGS; sg++) {
      const t = sg / SEGS;
      const cx = off + Math.sin(pulse * 1.2 + i + t * 3) * (6 + 20 * t);
      const cy = R * 0.3 + t * R * 1.65;
      const w = 5.5 * (1 - 0.55 * t);
      left.push([cx - w - 2.2 * Math.sin(t * 22 + pulse * 2 + i), cy]);
      right.push([cx + w + 2.2 * Math.sin(t * 22 + pulse * 2 + i + 1.7), cy]);
    }
    g.beginPath();
    g.moveTo(left[0]![0], left[0]![1]);
    for (const [px, py] of left) g.lineTo(px, py);
    for (let sg = SEGS; sg >= 0; sg--) g.lineTo(right[sg]![0], right[sg]![1]);
    g.closePath();
    if (flash) {
      g.fillStyle = WHITE;
    } else {
      const grad = g.createLinearGradient(0, R * 0.3, 0, R * 1.95);
      grad.addColorStop(0, withAlpha(pal.arm, 0.95));
      grad.addColorStop(1, withAlpha(pal.arm, 0.08));
      g.fillStyle = grad;
    }
    g.fill();
    if (!flash) {
      g.strokeStyle = withAlpha(pal.glow, 0.5);
      g.lineWidth = 1.2;
      g.beginPath();
      for (let sg = 0; sg <= SEGS; sg++) {
        const l = left[sg]!;
        const r = right[sg]!;
        const mx = (l[0] + r[0]) / 2;
        if (sg === 0) g.moveTo(mx, l[1]);
        else g.lineTo(mx, l[1]);
      }
      g.stroke();
    }
  }

  // sino: a escala preserva a área, para a respiração parecer orgânica
  g.save();
  g.scale(breathe, 1 / breathe);
  if (flash) {
    bellPath(g, R, pulse);
    g.fillStyle = WHITE;
    g.fill();
    g.restore();
    g.restore();
    return;
  }
  // brilho da borda, por fora
  bellPath(g, R, pulse);
  g.strokeStyle = withAlpha(pal.glow, 0.28);
  g.lineWidth = 6;
  g.stroke();
  const grad = g.createRadialGradient(0, -R * 0.3, R * 0.15, 0, 0, R);
  grad.addColorStop(0, pal.bell[0]);
  grad.addColorStop(0.5, pal.bell[1]);
  grad.addColorStop(1, pal.bell[2]);
  g.fillStyle = grad;
  g.fill();

  g.save();
  bellPath(g, R, pulse);
  g.clip();
  // sombra de baixo: o sino é mais espesso no meio que na borda
  const shade = g.createLinearGradient(0, -R * 0.1, 0, R * 0.55);
  shade.addColorStop(0, "rgba(0,30,50,0)");
  shade.addColorStop(1, "rgba(0,30,50,0.32)");
  g.fillStyle = shade;
  g.fillRect(-R, -R, R * 2, R * 2);
  // canais radiais e o canal da borda
  const coreY = -R * 0.15;
  g.strokeStyle = "rgba(255,255,255,0.32)";
  g.lineWidth = 1.3;
  for (let i = 0; i < 8; i++) {
    const a = Math.PI + ((i + 0.5) / 8) * Math.PI;
    const ex = Math.cos(a) * R * 0.97;
    const ey = Math.sin(a) * R * 0.8;
    g.beginPath();
    g.moveTo(0, coreY);
    g.quadraticCurveTo(ex * 0.55, ey * 0.5 + coreY * 0.2, ex, ey);
    g.stroke();
  }
  g.globalAlpha = 0.28;
  g.beginPath();
  g.ellipse(0, 0, R * 0.88, R * 0.72, 0, Math.PI, TAU);
  g.stroke();
  g.globalAlpha = 1;
  // gônadas: quatro pétalas em volta do núcleo
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 + Math.PI / 4;
    g.save();
    g.translate(Math.cos(a) * R * 0.4, coreY + Math.sin(a) * R * 0.26);
    g.rotate(a);
    g.beginPath();
    g.ellipse(0, 0, R * 0.17, R * 0.09, 0, 0, TAU);
    g.fillStyle = withAlpha(pal.glow, 0.42);
    g.fill();
    g.strokeStyle = "rgba(255,255,255,0.4)";
    g.lineWidth = 1;
    g.stroke();
    g.restore();
  }
  // reflexo
  g.save();
  g.translate(-R * 0.4, -R * 0.55);
  g.rotate(-0.6);
  g.beginPath();
  g.ellipse(0, 0, R * 0.22, R * 0.08, 0, 0, TAU);
  g.fillStyle = "rgba(255,255,255,0.5)";
  g.fill();
  g.restore();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.arc(-R * 0.12, -R * 0.7, R * 0.045, 0, TAU);
  g.fill();
  g.restore();

  // fio de luz na borda do sino
  bellPath(g, R, pulse);
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.lineWidth = 1.5;
  g.stroke();

  // fotóforos: pontos de luz nas pontas dos lóbulos, piscando fora de compasso
  for (let j = 0; j < 8; j++) {
    const mid = R - ((j + 0.5) * 2 * R) / 8;
    const py = rimY(R, mid) + lobeBulge(R, mid, pulse, j) * 0.5;
    g.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(pulse * 2 + j * 1.7));
    g.fillStyle = pal.glow;
    g.beginPath();
    g.arc(mid, py, 3.4, 0, TAU);
    g.fill();
    g.fillStyle = WHITE;
    g.beginPath();
    g.arc(mid, py, 1.5, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;

  // núcleo: incha durante qualquer aviso ("algo vem aí")
  const coreR = R * 0.26 * (telegraph ? 1.1 + Math.abs(Math.sin(pulse * 4)) * 0.5 : 1);
  const cg = g.createRadialGradient(0, coreY, 0, 0, coreY, coreR * 2.4);
  cg.addColorStop(0, "rgba(255,255,255,0.95)");
  cg.addColorStop(0.25, withAlpha(pal.glow, 0.8));
  cg.addColorStop(1, withAlpha(pal.glow, 0));
  g.fillStyle = cg;
  g.beginPath();
  g.arc(0, coreY, coreR * 2.4, 0, TAU);
  g.fill();
  g.fillStyle = pal.glow;
  g.beginPath();
  g.arc(0, coreY, coreR, 0, TAU);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.beginPath();
  g.arc(0, coreY, coreR * 0.5, 0, TAU);
  g.fill();
  g.restore();

  // coroa de pontinhos de luz: aparece na 2ª e cresce na 3ª fase
  for (let i = 0; i < phase * 3; i++) {
    const a = pulse * 0.4 + (i / (phase * 3)) * TAU;
    const rr = R * (1.3 + 0.1 * Math.sin(pulse * 2 + i));
    g.globalAlpha = 0.35 + 0.5 * Math.abs(Math.sin(pulse * 1.5 + i));
    g.fillStyle = pal.glow;
    g.beginPath();
    g.arc(Math.cos(a) * rr, Math.sin(a) * rr * 0.8 - R * 0.1, 2.4, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
  g.restore();
}

function drawBeam(g: CanvasRenderingContext2D, b: Boss, x: number, y: number, k: number, active: boolean, glow: string): void {
  const B = JELLY.beam;
  const ang = b.data.beamAng ?? 0;
  const dir = b.data.beamDir ?? 1;
  const beamLen = b.data.beamLen ?? B.length;
  // no aviso, a linha inteira (é a mira); ativo, só até onde a ponta chegou
  const L = active ? Math.min(beamLen, b.data.beamTip ?? B.innerGap) : beamLen;
  const g0 = B.innerGap;
  const span = Math.max(0, L - g0);
  const travelling = active && b.data.beamStage !== 1;

  g.save();
  g.translate(x, y);
  g.rotate(ang);
  if (active) {
    const grad = g.createLinearGradient(g0, 0, Math.max(L, g0 + 1), 0);
    grad.addColorStop(0, glow);
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.globalAlpha = 0.35;
    g.fillStyle = grad;
    g.fillRect(g0, -B.halfWidth * 2.4, span, B.halfWidth * 4.8);
    g.globalAlpha = 0.8;
    g.fillStyle = glow;
    g.fillRect(g0, -B.halfWidth, span, B.halfWidth * 2);
    g.globalAlpha = 1;
    g.fillStyle = "#ffffff";
    g.fillRect(g0, -B.halfWidth * 0.45, span, B.halfWidth * 0.9);
    // ponta: brilha forte enquanto viaja, e marca a sombra da rocha depois
    if (L < B.length || travelling) {
      g.globalAlpha = travelling ? 0.45 : 0.25;
      g.fillStyle = glow;
      g.beginPath();
      g.arc(L, 0, B.halfWidth * (travelling ? 3.2 : 2.2), 0, TAU);
      g.fill();
      g.globalAlpha = travelling ? 0.95 : 0.6;
      g.fillStyle = "#ffffff";
      g.beginPath();
      g.arc(L, 0, B.halfWidth * (travelling ? 1.6 : 1.5), 0, TAU);
      g.fill();
    }
  } else {
    g.globalAlpha = 0.15 + 0.3 * k;
    g.fillStyle = glow;
    g.fillRect(g0, -2, span, 4);
  }
  g.globalAlpha = 1;
  g.restore();

  // seta do sentido do giro: fica também enquanto o raio estica, porque é aí que o jogador
  // decide para que lado sair
  if (!active || travelling) {
    const rr = JELLY.hoverDist * 0.55;
    const a0 = ang;
    const a1 = ang + dir * 0.9;
    g.strokeStyle = glow;
    g.lineWidth = 3;
    g.globalAlpha = 0.35 + 0.4 * k;
    g.beginPath();
    g.arc(x, y, rr, Math.min(a0, a1), Math.max(a0, a1));
    g.stroke();
    const px = x + Math.cos(a1) * rr;
    const py = y + Math.sin(a1) * rr;
    const tang = a1 + (dir * Math.PI) / 2;
    g.fillStyle = glow;
    g.beginPath();
    g.moveTo(px + Math.cos(tang) * 11, py + Math.sin(tang) * 11);
    g.lineTo(px + Math.cos(tang + 2.5) * 9, py + Math.sin(tang + 2.5) * 9);
    g.lineTo(px + Math.cos(tang - 2.5) * 9, py + Math.sin(tang - 2.5) * 9);
    g.fill();
    g.globalAlpha = 1;
  }
}

/** Setor preenchido de `from` a `to`, cortado pela rocha (a sombra), como o raio. */
function sector(
  g: CanvasRenderingContext2D, grid: Grid, x: number, y: number, from: number, to: number, maxLen: number,
  color: string, alpha: number,
): void {
  const span = to - from;
  const n = Math.max(2, Math.ceil(Math.abs(span) / 0.07));
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(x, y);
  for (let i = 0; i <= n; i++) {
    const a = from + (span * i) / n;
    const l = rayLength(grid, x, y, a, maxLen, JELLY.beam.rayStep);
    g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
  }
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
}

/** Um raio: da borda interna até `len`, com a ponta brilhando enquanto viaja. */
function arm(
  g: CanvasRenderingContext2D, x: number, y: number, ang: number, g0: number, len: number, halfWidth: number,
  glow: string, travelling: boolean,
): void {
  const span = Math.max(0, len - g0);
  if (span <= 0) return;
  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const grad = g.createLinearGradient(g0, 0, Math.max(len, g0 + 1), 0);
  grad.addColorStop(0, glow);
  grad.addColorStop(1, "rgba(255,255,255,0)");
  g.globalAlpha = 0.35;
  g.fillStyle = grad;
  g.fillRect(g0, -halfWidth * 2.4, span, halfWidth * 4.8);
  g.globalAlpha = 0.8;
  g.fillStyle = glow;
  g.fillRect(g0, -halfWidth, span, halfWidth * 2);
  g.globalAlpha = 1;
  g.fillStyle = "#ffffff";
  g.fillRect(g0, -halfWidth * 0.45, span, halfWidth * 0.9);
  if (travelling) {
    g.globalAlpha = 0.9;
    g.beginPath();
    g.arc(len, 0, halfWidth * 1.5, 0, TAU);
    g.fill();
  }
  g.restore();
}

/**
 * Onda de choque. No aviso: a fresta marcada (um arco branco pulsando com duas marcas), um guia
 * fraco do anel na distância em que ela flutua e o sino contraindo. Na execução: o anel se
 * expandindo, desenhado só onde a rocha não o para (é a mesma regra do dano).
 */
function drawShock(
  g: CanvasRenderingContext2D, b: Boss, x: number, y: number, k: number, active: boolean, glow: string, grid: Grid,
): void {
  const S = JELLY.shock;
  const gap = b.data.shockGap ?? 0;
  const half = S.gapHalf[Math.min(b.phase, S.gapHalf.length - 1)] ?? 0.5;
  const R = b.radius;

  if (!active) {
    // guia do anel onde ele vai passar pelo jogador, sem a fresta
    g.strokeStyle = glow;
    g.lineWidth = 3;
    g.globalAlpha = 0.08 + 0.18 * k;
    g.beginPath();
    g.arc(x, y, JELLY.hoverDist, gap + half, gap - half + TAU);
    g.stroke();
    // a fresta, mais perto e forte: é para onde o jogador vai
    g.strokeStyle = "#ffffff";
    g.lineWidth = 7;
    g.globalAlpha = 0.45 + 0.4 * Math.abs(Math.sin(k * 11));
    g.beginPath();
    g.arc(x, y, R + 78, gap - half, gap + half);
    g.stroke();
    g.lineWidth = 3;
    for (const edge of [gap - half, gap + half]) {
      g.beginPath();
      g.moveTo(x + Math.cos(edge) * (R + 62), y + Math.sin(edge) * (R + 62));
      g.lineTo(x + Math.cos(edge) * (R + 96), y + Math.sin(edge) * (R + 96));
      g.stroke();
    }
    // o sino contrai antes de soltar o anel
    g.strokeStyle = glow;
    g.lineWidth = 3;
    g.globalAlpha = 0.25 + 0.4 * k;
    g.beginPath();
    g.arc(x, y, R * (1.75 - 0.65 * k), 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
    return;
  }

  const r = b.data.shockR ?? R;
  const fade = 1 - 0.55 * Math.min(1, (r - R) / (S.maxRadius - R));
  const step = 0.05;
  const runs: [number, number][] = [];
  let start: number | null = null;
  const n = Math.ceil(TAU / step);
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI + i * step;
    const visible =
      i < n && Math.abs(angDiff(gap, a)) > half && rayLength(grid, x, y, a, r, JELLY.beam.rayStep) >= r - JELLY.beam.rayStep - 0.5;
    if (visible && start === null) start = a;
    if (!visible && start !== null) {
      runs.push([start, a - step]);
      start = null;
    }
  }
  g.lineCap = "round";
  for (const [lw, color, alpha] of [
    [S.band * 2.2, glow, 0.22],
    [S.band, glow, 0.85],
    [S.band * 0.35, "#ffffff", 0.95],
  ] as const) {
    g.lineWidth = lw;
    g.strokeStyle = color;
    g.globalAlpha = alpha * fade;
    for (const [a0, a1] of runs) {
      g.beginPath();
      g.arc(x, y, r, a0, a1);
      g.stroke();
    }
  }
  g.lineCap = "butt";
  g.globalAlpha = 1;
}

/** Chamado: um anel fechando e uma cruz em cada ponto onde uma cria vai nascer. */
function drawCall(g: CanvasRenderingContext2D, b: Boss, x: number, y: number, k: number, glow: string): void {
  const n = b.data.callN ?? 0;
  for (let i = 0; i < n; i++) {
    const sx = b.data[`callX${i}`];
    const sy = b.data[`callY${i}`];
    if (sx === undefined || sy === undefined) continue;
    g.strokeStyle = glow;
    g.lineWidth = 2;
    g.globalAlpha = 0.14;
    g.setLineDash([4, 5]);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(sx, sy);
    g.stroke();
    g.setLineDash([]);
    g.globalAlpha = 0.3 + 0.55 * k;
    g.lineWidth = 2.5;
    g.beginPath();
    g.arc(sx, sy, 10 + 30 * (1 - k), 0, TAU);
    g.stroke();
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(sx - 7, sy);
    g.lineTo(sx + 7, sy);
    g.moveTo(sx, sy - 7);
    g.lineTo(sx, sy + 7);
    g.stroke();
  }
  g.globalAlpha = 1;
}

/**
 * Farol. No aviso: as cunhas que cada um dos 3 raios vai varrer (fracas) e um traço no ponto de
 * partida de cada raio, com uma seta do sentido do giro; o que sobra entre elas é seguro. Na
 * execução: os raios esticando e girando, com o rastro do que já passou.
 */
function drawLighthouse(
  g: CanvasRenderingContext2D, b: Boss, x: number, y: number, k: number, active: boolean, glow: string, grid: Grid,
): void {
  const L = JELLY.lighthouse;
  const base = b.data.lhBase ?? 0;
  const dir = b.data.lhDir ?? 1;
  const swept = b.data.lhSwept ?? 0;
  const tip = active ? (b.data.lhTip ?? L.innerGap) : L.length;
  const travelling = active && b.data.lhStage !== 1;
  for (let i = 0; i < L.arms; i++) {
    const a0 = base + (i / L.arms) * TAU;
    if (!active) {
      sector(g, grid, x, y, a0, a0 + dir * L.sweepRad, L.length, glow, 0.07 + 0.13 * k);
      const reach = rayLength(grid, x, y, a0, L.length, L.rayStep);
      g.strokeStyle = glow;
      g.lineWidth = 3;
      g.globalAlpha = 0.25 + 0.4 * k;
      g.beginPath();
      g.moveTo(x + Math.cos(a0) * L.innerGap, y + Math.sin(a0) * L.innerGap);
      g.lineTo(x + Math.cos(a0) * reach, y + Math.sin(a0) * reach);
      g.stroke();
      // seta do sentido do giro, junto ao traço
      const a1 = a0 + dir * 0.5;
      const rr = JELLY.hoverDist * 0.5;
      g.globalAlpha = 0.4 + 0.4 * k;
      g.beginPath();
      g.arc(x, y, rr, Math.min(a0, a1), Math.max(a0, a1));
      g.stroke();
      const tang = a1 + (dir * Math.PI) / 2;
      const px = x + Math.cos(a1) * rr;
      const py = y + Math.sin(a1) * rr;
      g.fillStyle = glow;
      g.beginPath();
      g.moveTo(px + Math.cos(tang) * 10, py + Math.sin(tang) * 10);
      g.lineTo(px + Math.cos(tang + 2.5) * 8, py + Math.sin(tang + 2.5) * 8);
      g.lineTo(px + Math.cos(tang - 2.5) * 8, py + Math.sin(tang - 2.5) * 8);
      g.fill();
      g.globalAlpha = 1;
    } else {
      const aNow = a0 + dir * swept;
      if (swept > 0) sector(g, grid, x, y, a0, aNow, L.length, glow, 0.12);
      const reach = Math.min(rayLength(grid, x, y, aNow, L.length, L.rayStep), tip);
      arm(g, x, y, aNow, L.innerGap, reach, L.halfWidth, glow, travelling);
    }
  }
}
