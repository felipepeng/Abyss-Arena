import { EYE } from "../../config/bosses/eye";
import { TAU, clamp } from "../../core/math";
import type { Boss } from "../../sim/bosses/types";

// Olho do Abismo, como no protótipo (CONTEXTO §2.3 e §2.7): esclera com veias, íris que olha
// para o jogador, pupila que contrai durante os avisos e uma coroa de olhos que cresce com a
// fase. Os avisos: setor (leque), espirais desenhadas, anel com tracinhos para dentro em volta
// do jogador (cerco), halo pulsante (perseguidores), faixa vertical (chuva).

const IRIS = ["#6ad8ff", "#ffa04a", "#ff5a9e"] as const;

export interface EyeContext {
  playerX: number;
  worldW: number;
  worldH: number;
  /** Topo da área jogável (a faixa da chuva começa aqui). */
  top: number;
}

export function drawEye(g: CanvasRenderingContext2D, b: Boss, x: number, y: number, ang: number, k: number, ctx: EyeContext): void {
  const flash = b.flashMs > 0;
  const iris = IRIS[Math.min(b.phase, 2)] ?? IRIS[0];
  const telegraph = b.state === "telegraph";
  const pulse = b.data.pulse ?? 0;

  if (telegraph && b.attack === "fan") {
    g.save();
    g.translate(x, y);
    g.rotate(b.data.aimAng ?? 0);
    g.globalAlpha = 0.12 + 0.22 * k;
    g.fillStyle = EYE.fan.color;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, EYE.fan.warnRadius, -EYE.fan.spread / 2, EYE.fan.spread / 2);
    g.fill();
    g.restore();
  }
  if (telegraph && b.attack === "spiral") {
    g.strokeStyle = EYE.spiral.color;
    g.lineWidth = 2;
    g.globalAlpha = 0.5;
    for (let a = 0; a < 3; a++) {
      g.beginPath();
      for (let t = 0; t < 40; t++) {
        const an = (a / 3) * TAU + t * 0.16 + k * 3;
        const rr = 20 + t * 5;
        if (t === 0) g.moveTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
        else g.lineTo(x + Math.cos(an) * rr, y + Math.sin(an) * rr);
      }
      g.stroke();
    }
  }
  if (telegraph && b.attack === "siege") {
    const sx = b.data.siegeX ?? x;
    const sy = b.data.siegeY ?? y;
    const R = EYE.siege.ringR;
    g.strokeStyle = EYE.siege.color;
    g.lineWidth = 2 + 3 * k;
    g.globalAlpha = 0.35 + 0.4 * k;
    g.beginPath();
    g.arc(sx, sy, R, 0, TAU);
    g.stroke();
    // tracinhos apontando para dentro: vem de todos os lados
    g.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * TAU;
      g.beginPath();
      g.moveTo(sx + Math.cos(a) * R, sy + Math.sin(a) * R);
      g.lineTo(sx + Math.cos(a) * (R - 26 * k), sy + Math.sin(a) * (R - 26 * k));
      g.stroke();
    }
  }
  if (telegraph && b.attack === "seek") {
    g.strokeStyle = EYE.seekers.color;
    g.lineWidth = 3;
    g.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(k * 12));
    g.beginPath();
    g.arc(x, y, b.radius + 14 + k * 10, 0, TAU);
    g.stroke();
  }
  if (telegraph && b.attack === "rain") {
    g.globalAlpha = 0.1 + 0.25 * k;
    g.fillStyle = EYE.rain.color;
    const x0 = clamp(ctx.playerX - EYE.rain.spreadX, 0, ctx.worldW);
    g.fillRect(x0, ctx.top, Math.min(EYE.rain.spreadX * 2, ctx.worldW), ctx.worldH);
  }
  g.globalAlpha = 1;

  g.save();
  g.translate(x, y);
  const R = b.radius;
  const breathe = 1 + Math.sin(pulse) * 0.05;

  // coroa de pequenos olhos: a criatura ganha olhos conforme enlouquece
  const crown = 6 + (b.phase + 1) * 2;
  g.fillStyle = flash ? "#ffffff" : iris;
  g.globalAlpha = 0.5;
  for (let i = 0; i < crown; i++) {
    const a = pulse * 0.5 + (i / crown) * TAU;
    const rr = R * 1.5 + Math.sin(pulse * 2 + i) * 6;
    g.beginPath();
    g.arc(Math.cos(a) * rr, Math.sin(a) * rr, 5, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;

  // o globo inteiro (esclera, íris, pálpebras) pulsa junto: a íris não se solta da esclera
  g.save();
  g.scale(breathe, 1 / breathe);

  // esclera e veias
  const grad = g.createRadialGradient(0, 0, R * 0.2, 0, 0, R);
  if (flash) {
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(1, "#ffffff");
  } else {
    grad.addColorStop(0, "#f2e8ff");
    grad.addColorStop(0.7, "#c8b4dd");
    grad.addColorStop(1, "rgba(70,40,90,0.85)");
  }
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, R, 0, TAU);
  g.fill();
  g.strokeStyle = flash ? "#ffffff" : "rgba(150,60,90,0.5)";
  g.lineWidth = 2;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.4;
    g.beginPath();
    g.moveTo(Math.cos(a) * R * 0.45, Math.sin(a) * R * 0.45);
    g.quadraticCurveTo(Math.cos(a + 0.3) * R * 0.75, Math.sin(a + 0.3) * R * 0.75, Math.cos(a) * R * 0.97, Math.sin(a) * R * 0.97);
    g.stroke();
  }

  // Tudo o que vem agora fica dentro da abertura entre as pálpebras: nada vaza pela borda.
  // A íris anda pouco (a esclera precisa aparecer dos dois lados); a pupila vai um pouco além
  // do centro dela, na direção do olhar, para dar profundidade sem achatar nada.
  const open = R * 0.93;
  const eyeR = R * 0.46;
  const off = R * 0.2;
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const ix = dx * off;
  const iy = dy * off;
  g.save();
  g.beginPath();
  g.arc(0, 0, open, 0, TAU);
  g.clip();

  if (!flash) {
    const halo = g.createRadialGradient(ix, iy, eyeR * 0.6, ix, iy, eyeR * 1.7);
    halo.addColorStop(0, iris);
    halo.addColorStop(1, "rgba(0,0,0,0)");
    g.globalAlpha = 0.6;
    g.fillStyle = halo;
    g.beginPath();
    g.arc(ix, iy, eyeR * 1.7, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }

  // íris e pupila são círculos perfeitos: desfaz a pulsação da esclera em volta do centro delas
  g.save();
  g.translate(ix, iy);
  g.scale(1 / breathe, breathe);
  g.rotate(ang);
  g.fillStyle = flash ? "#ffffff" : iris;
  g.beginPath();
  g.arc(0, 0, eyeR * (telegraph ? 1.15 : 1), 0, TAU);
  g.fill();
  if (!flash) {
    g.strokeStyle = "rgba(10,4,16,0.55)";
    g.lineWidth = 2;
    g.stroke();
  }
  g.fillStyle = "#0a0410";
  g.beginPath();
  g.arc(eyeR * 0.08, 0, eyeR * (telegraph ? 0.38 : 0.55), 0, TAU);
  g.fill();
  g.restore();

  g.fillStyle = "rgba(255,255,255,0.7)";
  g.beginPath();
  g.arc(ix - eyeR * 0.3 + dx * eyeR * 0.08, iy - eyeR * 0.35 + dy * eyeR * 0.08, eyeR * 0.22, 0, TAU);
  g.fill();

  // pálpebras: sombra em cima e (mais leve) embaixo. A de cima acompanha o olhar na vertical e
  // se abre no aviso: o olho arregala antes de atacar.
  if (!flash) {
    const lid = telegraph ? 0.5 : 1;
    const upEdge = -R * 0.5 + iy * 0.6;
    const up = g.createLinearGradient(0, -open, 0, upEdge);
    up.addColorStop(0, `rgba(45,18,66,${0.7 * lid})`);
    up.addColorStop(1, "rgba(45,18,66,0)");
    g.fillStyle = up;
    g.fillRect(-open, -open, open * 2, upEdge + open);
    const lowEdge = R * 0.55 + iy * 0.4;
    const low = g.createLinearGradient(0, open, 0, lowEdge);
    low.addColorStop(0, `rgba(45,18,66,${0.4 * lid})`);
    low.addColorStop(1, "rgba(45,18,66,0)");
    g.fillStyle = low;
    g.fillRect(-open, lowEdge, open * 2, open - lowEdge);
  }
  g.restore();

  // aro da pálpebra: dá moldura ao olho e esconde o corte do recorte
  g.strokeStyle = flash ? "#ffffff" : "rgba(58,26,78,0.95)";
  g.lineWidth = R * 0.11;
  g.beginPath();
  g.arc(0, 0, R * 0.98, 0, TAU);
  g.stroke();
  g.strokeStyle = flash ? "#ffffff" : "rgba(150,90,150,0.45)";
  g.lineWidth = 1.5;
  g.beginPath();
  g.arc(0, 0, R * 0.92, 0, TAU);
  g.stroke();
  g.restore();
  g.restore();
}
