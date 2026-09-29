import { TAU, lerp } from "../../core/math";
import type { Dummy } from "../../sim/dummy";

// Saco de pancada: lona costurada presa por uma corda ao ponto de origem. Pisca em branco
// ao ser acertado e mostra a barrinha de vida quando ferido, como os inimigos do protótipo.

const COLOR = {
  bag: "#9b7a52",
  bagDark: "#6e5436",
  stitch: "#e4d2a8",
  rope: "rgba(228, 210, 168, 0.35)",
  flash: "#ffffff",
  hpBack: "rgba(0,0,0,0.5)",
  hp: "#7ce89a",
};

export function drawDummy(g: CanvasRenderingContext2D, d: Dummy, alpha: number): void {
  if (!d.alive) return;
  const x = lerp(d.prevX, d.x, alpha);
  const y = lerp(d.prevY, d.y, alpha);
  const r = d.radius;
  const flashing = d.flashMs > 0;

  g.strokeStyle = COLOR.rope;
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(d.anchorX, d.anchorY - r - 40);
  g.lineTo(x, y - r);
  g.stroke();

  g.fillStyle = flashing ? COLOR.flash : COLOR.bag;
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
  if (!flashing) {
    g.fillStyle = COLOR.bagDark;
    g.beginPath();
    g.arc(x + r * 0.25, y + r * 0.25, r * 0.7, 0, TAU);
    g.fill();
    g.fillStyle = COLOR.bag;
    g.beginPath();
    g.arc(x - r * 0.1, y - r * 0.1, r * 0.72, 0, TAU);
    g.fill();
    // costura em cruz
    g.strokeStyle = COLOR.stitch;
    g.lineWidth = 1.5;
    g.setLineDash([3, 3]);
    g.beginPath();
    g.moveTo(x - r * 0.6, y);
    g.lineTo(x + r * 0.6, y);
    g.moveTo(x, y - r * 0.6);
    g.lineTo(x, y + r * 0.6);
    g.stroke();
    g.setLineDash([]);
  }

  if (d.hp < d.maxHp) {
    const w = r * 2.4;
    g.fillStyle = COLOR.hpBack;
    g.fillRect(x - w / 2, y - r - 12, w, 3);
    g.fillStyle = COLOR.hp;
    g.fillRect(x - w / 2, y - r - 12, w * (d.hp / d.maxHp), 3);
  }
}
