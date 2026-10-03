import { JELLY } from "../../config/bosses/jelly";
import { TAU, angDiff } from "../../core/math";
import type { Boss } from "../../sim/bosses/types";
import { rayLength } from "../../sim/geometry";
import type { Grid } from "../../world/grid";

// Água-viva, como no protótipo (CONTEXTO §2.3 e §2.7): sino translúcido que respira,
// tentáculos ondulando e um núcleo que incha durante qualquer aviso. Os avisos: anéis
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

  g.save();
  g.translate(x, y);
  const breathe = 1 + Math.sin(pulse) * 0.07;

  // tentáculos, atrás do sino
  g.strokeStyle = flash ? "#ffffff" : pal.tent;
  g.lineWidth = 3;
  for (let i = 0; i < 9; i++) {
    const off = (i / 8 - 0.5) * R * 1.5;
    g.beginPath();
    g.moveTo(off * 0.7, R * 0.35);
    for (let s = 1; s <= 5; s++) {
      const t = s / 5;
      g.lineTo(off * 0.7 + Math.sin(pulse * 1.6 + i + t * 3) * 12 * t, R * 0.35 + t * R * 2.1);
    }
    g.stroke();
  }
  // braços orais, mais grossos
  g.lineWidth = 6;
  g.strokeStyle = flash ? "#ffffff" : pal.arm;
  for (let i = 0; i < 4; i++) {
    const off = (i / 3 - 0.5) * R * 0.8;
    g.beginPath();
    g.moveTo(off, R * 0.3);
    g.quadraticCurveTo(off + Math.sin(pulse * 1.2 + i) * 18, R * 1.1, off + Math.sin(pulse * 1.2 + i) * 26, R * 1.7);
    g.stroke();
  }

  // sino: escala que preserva a área, para a respiração parecer orgânica
  g.save();
  g.scale(breathe, 1 / breathe);
  const grad = g.createRadialGradient(0, -R * 0.3, R * 0.15, 0, 0, R);
  if (flash) {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#ffffff");
  } else {
    grad.addColorStop(0, pal.bell[0]);
    grad.addColorStop(0.5, pal.bell[1]);
    grad.addColorStop(1, pal.bell[2]);
  }
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(0, 0, R, R * 0.85, 0, Math.PI, TAU);
  g.ellipse(0, 0, R, R * 0.35, 0, 0, Math.PI);
  g.fill();
  g.strokeStyle = flash ? "#ffffff" : "rgba(255,255,255,0.45)";
  g.lineWidth = 1.5;
  for (let i = 1; i < 5; i++) {
    const nx = -R + (i / 5) * R * 2;
    g.beginPath();
    g.moveTo(nx, -R * 0.65);
    g.lineTo(nx * 0.9, R * 0.25);
    g.stroke();
  }
  g.restore();

  // núcleo: incha durante qualquer aviso ("algo vem aí")
  const coreR = R * 0.26 * (telegraph ? 1.1 + Math.abs(Math.sin(pulse * 4)) * 0.5 : 1);
  g.globalAlpha = 0.5;
  g.fillStyle = glow;
  g.beginPath();
  g.arc(0, -R * 0.15, coreR * 2, 0, TAU);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = flash ? "#ffffff" : glow;
  g.beginPath();
  g.arc(0, -R * 0.15, coreR, 0, TAU);
  g.fill();
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
