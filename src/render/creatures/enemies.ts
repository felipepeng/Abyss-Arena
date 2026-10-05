import { TAU, angLerp, lerp } from "../../core/math";
import type { Enemy, EnemyKind } from "../../sim/enemies/types";
import { drawFish } from "./fish";
import { drawAnemone, drawHermit, drawJellyling, drawLamprey, drawUrchin, drawWatcher, type Drawer } from "./exclusive";

// Inimigos comuns, desenhados como no protótipo (CONTEXTO §2.3 e §2.7). O aviso de cada
// ataque é parte do desenho da criatura: halo pulsante e, no peixe, a linha de mira travada.
// O progresso do aviso vem do estado (`t` e `stateMs`); o desenhador não lê o config.

/** Progresso do estado atual, de 0 (acabou de entrar) a 1 (vai sair). */
const progress = (e: Enemy): number => (e.stateMs > 0 ? 1 - Math.max(e.t, 0) / e.stateMs : 1);

const drawCircler: Drawer = (g, e, flashing) => {
  const r = e.radius;
  if (e.state === "windup") {
    g.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(progress(e) * 12));
    g.fillStyle = "#c58bff";
    g.beginPath();
    g.arc(0, 0, r + 10, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  g.fillStyle = flashing ? "#ffffff" : e.state === "strike" ? "#e2b6ff" : "#8a5ad0";
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();
  // tentáculos girando (a rotação vem de `ang`, aplicada pelo chamador)
  g.strokeStyle = flashing ? "#ffffff" : "#5c3a94";
  g.lineWidth = 3;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    g.lineTo(Math.cos(a) * (r + 9), Math.sin(a) * (r + 9));
    g.stroke();
  }
  g.fillStyle = "#ffe066";
  g.beginPath();
  g.arc(0, 0, 3.5, 0, TAU);
  g.fill();
};

/** Saco de pancada: lona costurada, sem rotação. */
const drawDummy: Drawer = (g, e, flashing) => {
  const r = e.radius;
  g.fillStyle = flashing ? "#ffffff" : "#9b7a52";
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();
  if (flashing) return;
  g.fillStyle = "#6e5436";
  g.beginPath();
  g.arc(r * 0.25, r * 0.25, r * 0.7, 0, TAU);
  g.fill();
  g.fillStyle = "#9b7a52";
  g.beginPath();
  g.arc(-r * 0.1, -r * 0.1, r * 0.72, 0, TAU);
  g.fill();
  g.strokeStyle = "#e4d2a8";
  g.lineWidth = 1.5;
  g.setLineDash([3, 3]);
  g.beginPath();
  g.moveTo(-r * 0.6, 0);
  g.lineTo(r * 0.6, 0);
  g.moveTo(0, -r * 0.6);
  g.lineTo(0, r * 0.6);
  g.stroke();
  g.setLineDash([]);
};

const DRAWERS: Record<EnemyKind, { draw: Drawer; rotates: boolean }> = {
  fish: { draw: drawFish, rotates: true },
  circler: { draw: drawCircler, rotates: true },
  dummy: { draw: drawDummy, rotates: false },
  dummyBig: { draw: drawDummy, rotates: false },
  hermit: { draw: drawHermit, rotates: true },
  urchin: { draw: drawUrchin, rotates: false },
  jellyling: { draw: drawJellyling, rotates: false },
  anemone: { draw: drawAnemone, rotates: false },
  watcher: { draw: drawWatcher, rotates: true },
  lamprey: { draw: drawLamprey, rotates: true },
};

export function drawEnemy(g: CanvasRenderingContext2D, e: Enemy, alpha: number): void {
  const x = lerp(e.prevX, e.x, alpha);
  const y = lerp(e.prevY, e.y, alpha);
  const d = DRAWERS[e.kind];

  if (e.kind === "dummy" || e.kind === "dummyBig") {
    // corda até o ponto de origem
    g.strokeStyle = "rgba(228, 210, 168, 0.35)";
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(e.data.anchorX ?? x, (e.data.anchorY ?? y) - e.radius - 40);
    g.lineTo(x, y - e.radius);
    g.stroke();
  }

  g.save();
  g.translate(x, y);
  if (d.rotates) g.rotate(angLerp(e.prevAng, e.ang, alpha));
  d.draw(g, e, e.flashMs > 0);
  g.restore();

  // barrinha de vida
  if (e.hp < e.maxHp) {
    const w = e.radius * 2.4;
    g.fillStyle = "rgba(0,0,0,0.5)";
    g.fillRect(x - w / 2, y - e.radius - 12, w, 3);
    g.fillStyle = "#7ce89a";
    g.fillRect(x - w / 2, y - e.radius - 12, w * Math.max(0, e.hp / e.maxHp), 3);
  }
}
