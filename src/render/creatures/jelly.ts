import { JELLY } from "../../config/bosses/jelly";
import { TAU } from "../../core/math";
import type { Boss } from "../../sim/bosses/types";

// Água-viva, como no protótipo (CONTEXTO §2.3 e §2.7): sino translúcido que respira,
// tentáculos ondulando e um núcleo que incha durante qualquer aviso. Os avisos: anéis
// convergindo (anel de esporos), linha de mira + seta do sentido do giro (raio), arcos
// sugando para dentro (sucção).

export function drawJelly(g: CanvasRenderingContext2D, b: Boss, x: number, y: number, k: number): void {
  const flash = b.flashMs > 0;
  const rage = b.phase >= 1;
  const glow = rage ? "#ff9ede" : "#8affe0";
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
  g.strokeStyle = flash ? "#ffffff" : rage ? "#d9509f" : "#4f9ab5";
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
  g.strokeStyle = flash ? "#ffffff" : rage ? "#ff7ac0" : "#6fc3d8";
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
  } else if (rage) {
    grad.addColorStop(0, "#ffd9f2");
    grad.addColorStop(0.5, "#ff6fc0");
    grad.addColorStop(1, "rgba(180,40,120,0.55)");
  } else {
    grad.addColorStop(0, "#e6fffa");
    grad.addColorStop(0.5, "#5fd9c4");
    grad.addColorStop(1, "rgba(40,120,150,0.55)");
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
