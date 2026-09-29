import { PLAYER } from "../../config/player";
import { SPEAR } from "../../config/spear";
import { TAU, angLerp, lerp } from "../../core/math";
import { inDashInvuln, makeSpearTip, spearTip, type Player } from "../../sim/player";

// Mergulhador e lança, como no protótipo (CONTEXTO §2.3). A lança fica POR BAIXO do corpo:
// a haste começa a 6 px do centro e o corpo a cobre.
//
// Novo em relação ao protótipo: nos 100 ms de invulnerabilidade do dash, contorno branco e
// um rastro de silhuetas (GDD §4.2).

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

export function drawPlayer(g: CanvasRenderingContext2D, p: Player, alpha: number): void {
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

  // indicador de carga: um arco que cresce e fica amarelo quando cheio
  if (sp.phase === "anticipation" && sp.chargeMs > 0) {
    const k = sp.chargeMs / SPEAR.chargeMaxMs;
    g.strokeStyle = k >= 1 ? COLOR.chargeFull : COLOR.charge;
    g.lineWidth = 2 + k * 3;
    g.globalAlpha = 0.55;
    g.beginPath();
    g.arc(x, y, 16 + k * 10, 0, TAU * k);
    g.stroke();
    g.globalAlpha = baseAlpha;
  }

  drawBody(g, x, y, aim, p.dashMs > 0 ? COLOR.bodyDash : COLOR.body, dashInvuln);
  g.globalAlpha = 1;
}

function drawBody(g: CanvasRenderingContext2D, x: number, y: number, aim: number, color: string, outline: boolean): void {
  g.save();
  g.translate(x, y);
  g.rotate(aim);
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(0, 0, 13, 9, 0, 0, TAU);
  g.fill();
  if (outline) {
    g.strokeStyle = COLOR.invulnOutline;
    g.lineWidth = 2;
    g.stroke();
  }
  g.fillStyle = COLOR.tank;
  g.fillRect(-13, -5, 6, 10);
  g.fillStyle = COLOR.visor;
  g.beginPath();
  g.arc(6, 0, 4.5, 0, TAU);
  g.fill();
  g.fillStyle = COLOR.fin;
  g.beginPath();
  g.moveTo(-12, -8);
  g.lineTo(-20, -13);
  g.lineTo(-14, -2);
  g.fill();
  g.beginPath();
  g.moveTo(-12, 8);
  g.lineTo(-20, 13);
  g.lineTo(-14, 2);
  g.fill();
  g.restore();
}
