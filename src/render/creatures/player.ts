import { PLAYER } from "../../config/player";
import { SPEAR } from "../../config/spear";
import { TAU, angLerp, lerp } from "../../core/math";
import { inDashInvuln, makeSpearTip, spearTip, type Player } from "../../sim/player";

// Mergulhador e lança, como no protótipo (CONTEXTO §2.3), com um leve sombreamento no corpo e no
// visor. A lança fica POR BAIXO do corpo: a haste começa a 6 px do centro e o corpo a cobre.
//
// Novo em relação ao protótipo: nos 100 ms de invulnerabilidade do dash, contorno branco com um
// halo e um rastro de silhuetas (GDD §4.2), e o anel de carga da lança, que enche e pulsa em
// dourado quando está cheio.

const COLOR = {
  body: "#2f7fd0",
  bodyDash: "#bfeaff",
  tank: "#123a5c",
  visor: "#ffe9a8",
  fin: "#1a4a70",
  shaft: "#cdd8e2",
  shaftThrust: "#fff3c4",
  tip: "#fefefe",
  charge: "#8fd0ff",
  chargeFull: "#ffe06a",
  invulnOutline: "#ffffff",
};

/** Rastro do dash invulnerável: quanto atrás (em segundos de velocidade) e com que opacidade. */
const TRAIL = [
  { back: 0.018, alpha: 0.35 },
  { back: 0.036, alpha: 0.22 },
  { back: 0.054, alpha: 0.12 },
] as const;

const tip = makeSpearTip();

export function drawPlayer(g: CanvasRenderingContext2D, p: Player, alpha: number, timeMs = 0): void {
  const x = lerp(p.prevX, p.x, alpha);
  const y = lerp(p.prevY, p.y, alpha);
  const aim = angLerp(p.prevAim, p.aim, alpha);
  const sp = p.spear;
  const blink = p.invulnMs > 0 && Math.floor(p.invulnMs / PLAYER.hurt.blinkMs) % 2 === 0;
  const baseAlpha = blink ? 0.35 : 1;
  const dashInvuln = inDashInvuln(p);

  if (dashInvuln) {
    for (const s of TRAIL) {
      g.globalAlpha = s.alpha;
      drawBody(g, x - p.vx * s.back, y - p.vy * s.back, aim, COLOR.bodyDash, false);
    }
  }

  g.globalAlpha = baseAlpha;

  // lança
  spearTip(p, tip, x, y, aim);
  const thrusting = sp.phase === "thrust";
  g.strokeStyle = thrusting ? COLOR.shaftThrust : COLOR.shaft;
  g.lineWidth = thrusting ? 4 : 3;
  g.beginPath();
  g.moveTo(x + tip.dirX * 6, y + tip.dirY * 6);
  g.lineTo(tip.x, tip.y);
  g.stroke();
  g.fillStyle = COLOR.tip;
  g.beginPath();
  g.arc(tip.x, tip.y, 3.5, 0, TAU);
  g.fill();

  // indicador de carga: um anel que enche (dá a volta ao chegar a 600 ms) e fica dourado e pulsante
  if (sp.phase === "anticipation" && sp.chargeMs > 0) {
    drawChargeRing(g, x, y, Math.min(sp.chargeMs / SPEAR.chargeMaxMs, 1), timeMs / 1000, baseAlpha);
  }

  drawBody(g, x, y, aim, p.dashMs > 0 ? COLOR.bodyDash : COLOR.body, dashInvuln);
  g.globalAlpha = 1;
}

function drawChargeRing(g: CanvasRenderingContext2D, x: number, y: number, k: number, time: number, baseAlpha: number): void {
  const full = k >= 1;
  const col = full ? COLOR.chargeFull : COLOR.charge;
  const R = 19;
  g.save();
  g.lineCap = "round";
  g.strokeStyle = col;
  // o trilho do anel, fraco, para o jogador ver quanto falta
  g.globalAlpha = 0.16 * baseAlpha;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, R, 0, TAU);
  g.stroke();
  g.globalAlpha = 0.85 * baseAlpha;
  g.lineWidth = 3.6;
  g.beginPath();
  g.arc(x, y, R, -Math.PI / 2, -Math.PI / 2 + TAU * k);
  g.stroke();
  // a cabeça do arco
  const a = -Math.PI / 2 + TAU * k;
  g.fillStyle = "#ffffff";
  g.globalAlpha = 0.95 * baseAlpha;
  g.beginPath();
  g.arc(x + Math.cos(a) * R, y + Math.sin(a) * R, 2.4, 0, TAU);
  g.fill();
  if (full) {
    // carga cheia: um anel que pulsa para fora (a estocada carregada está pronta)
    const pulse = (time * 2.4) % 1;
    g.globalAlpha = (1 - pulse) * 0.6 * baseAlpha;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, R + 2 + pulse * 9, 0, TAU);
    g.stroke();
  }
  g.restore();
}

/** Corpo: a elipse de 13 × 9 (origem no centro, frente em +x). */
function bodyPath(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.ellipse(0, 0, 13, 9, 0, 0, TAU);
}

/** As duas nadadeiras triangulares, atrás do corpo. */
function finPaths(g: CanvasRenderingContext2D): void {
  g.beginPath();
  g.moveTo(-12, -8);
  g.lineTo(-20, -13);
  g.lineTo(-14, -2);
  g.closePath();
  g.moveTo(-12, 8);
  g.lineTo(-20, 13);
  g.lineTo(-14, 2);
  g.closePath();
}

function drawBody(g: CanvasRenderingContext2D, x: number, y: number, aim: number, color: string, outline: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(aim);
  g.lineJoin = "round";

  if (outline) {
    // dash invulnerável: um halo fraco e o contorno branco, grosso, por trás de todo o corpo
    const halo = g.createRadialGradient(0, 0, 6, 0, 0, 26);
    halo.addColorStop(0, "rgba(255,255,255,0.35)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = halo;
    g.beginPath();
    g.arc(0, 0, 26, 0, TAU);
    g.fill();
    g.fillStyle = COLOR.invulnOutline;
    g.strokeStyle = COLOR.invulnOutline;
    g.lineWidth = 4.6;
    bodyPath(g);
    g.fill();
    g.stroke();
    finPaths(g);
    g.fill();
    g.stroke();
    g.fillRect(-13, -5, 6, 10);
    g.strokeRect(-13, -5, 6, 10);
  }

  g.fillStyle = color;
  bodyPath(g);
  g.fill();
  // leve sombreamento: mais claro do lado da luz (fixa no mundo, desfaz a rotação do corpo) e
  // um pouco mais escuro na borda oposta
  const hx = -4 * Math.cos(-aim) + 5 * Math.sin(-aim);
  const hy = -4 * Math.sin(-aim) - 5 * Math.cos(-aim);
  const shade = g.createRadialGradient(hx, hy, 1, 0, 0, 13);
  shade.addColorStop(0, "rgba(255,255,255,0.22)");
  shade.addColorStop(0.55, "rgba(255,255,255,0)");
  shade.addColorStop(1, "rgba(0,20,60,0.2)");
  g.fillStyle = shade;
  bodyPath(g);
  g.fill();
  g.fillStyle = COLOR.tank;
  g.fillRect(-13, -5, 6, 10);
  g.fillStyle = COLOR.visor;
  g.beginPath();
  g.arc(6, 0, 4.5, 0, TAU);
  g.fill();
  const glass = g.createRadialGradient(4.8, -1.6, 0.4, 6, 0, 4.5);
  glass.addColorStop(0, "rgba(255,255,255,0.45)");
  glass.addColorStop(1, "rgba(160,110,20,0.18)");
  g.fillStyle = glass;
  g.beginPath();
  g.arc(6, 0, 4.5, 0, TAU);
  g.fill();
  g.fillStyle = COLOR.fin;
  finPaths(g);
  g.fill();
  g.restore();
}
