import { CRAB } from "../../config/bosses/crab";
import { TAU, angLerp, lerp } from "../../core/math";
import { BOSS_DEFS } from "../../sim/bosses/registry";
import type { Boss } from "../../sim/bosses/types";
import type { World } from "../../sim/world";
import { drawEye } from "./eye";
import { drawJelly } from "./jelly";

// Chefes, desenhados como no protótipo (CONTEXTO §2.3 e §2.7). Os avisos de ataque são parte
// do desenho e vêm antes do corpo: a faixa da investida, o círculo da pinça e os anéis do
// chamado. O progresso de cada aviso sai do estado (`t` e `stateMs`); o alcance da pinça vem
// do próprio ataque (`fxSize`), não de uma cópia no render.

/** Progresso do estado, de 0 a 1. Estados sem duração fixa (as salvas) contam como cheios. */
const progress = (b: Boss): number =>
  b.stateMs > 0 && Number.isFinite(b.stateMs) ? 1 - Math.max(b.t, 0) / b.stateMs : 1;

export function drawBoss(g: CanvasRenderingContext2D, b: Boss, alpha: number, w: World): void {
  if (b.dead) return;
  const x = lerp(b.prevX, b.x, alpha);
  const y = lerp(b.prevY, b.y, alpha);
  const ang = angLerp(b.prevAng, b.ang, alpha);
  if (b.kind === "crab") drawCrab(g, b, x, y, ang, w.timeMs / 1000);
  else if (b.kind === "jelly") drawJelly(g, b, x, y, progress(b), w.grid);
  else drawEye(g, b, x, y, ang, progress(b), { playerX: w.player.x, worldW: w.grid.width, worldH: w.grid.height, top: w.grid.tile * 2 });
}

function drawCrab(g: CanvasRenderingContext2D, b: Boss, x: number, y: number, ang: number, time: number): void {
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

  g.save();
  g.translate(x, y);
  g.rotate(ang);
  const r = b.radius;
  const flash = b.flashMs > 0;
  const rage = b.phase >= 1;
  // pernas, oscilando
  g.strokeStyle = flash ? "#ffffff" : "#7d4527";
  g.lineWidth = 6;
  for (let i = 0; i < 6; i++) {
    const side = i < 3 ? -1 : 1;
    const j = i % 3;
    const a = side * (0.55 + j * 0.52) + Math.sin(time * 5 + i) * 0.12;
    g.beginPath();
    g.moveTo(-6, side * 10);
    g.lineTo(Math.cos(Math.PI - a) * 30 - 6, Math.sin(Math.PI - a) * 34);
    g.stroke();
  }
  // carapaça
  g.fillStyle = flash ? "#ffffff" : rage ? "#d8492f" : "#b4643c";
  g.beginPath();
  g.ellipse(0, 0, r, r * 0.78, 0, 0, TAU);
  g.fill();
  g.fillStyle = "rgba(0,0,0,0.18)";
  g.beginPath();
  g.ellipse(-6, 4, r * 0.7, r * 0.45, 0, 0, TAU);
  g.fill();
  // pinças: abrem durante o aviso da pinça (a animação é parte do aviso)
  const open = b.attack === "pinch" && (telegraph || executing) ? 0.9 : 0.25 + Math.sin(time * 3) * 0.08;
  for (const s of [-1, 1]) {
    g.save();
    g.translate(r * 0.7, s * r * 0.6);
    g.rotate(s * -0.35);
    g.fillStyle = flash ? "#ffffff" : rage ? "#ff6a48" : "#c9764a";
    g.beginPath();
    g.ellipse(10, 0, 18, 11, 0, 0, TAU);
    g.fill();
    g.fillStyle = "#0e1a26";
    g.save();
    g.translate(20, 0);
    g.rotate(open * 0.6 * s);
    g.fillRect(0, -3, 16, 5);
    g.restore();
    g.save();
    g.translate(20, 0);
    g.rotate(-open * 0.6 * s);
    g.fillRect(0, -2, 16, 5);
    g.restore();
    g.restore();
  }
  g.fillStyle = "#ffe066";
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(r * 0.6, s * 9, 4, 0, TAU);
    g.fill();
  }
  g.restore();
}
