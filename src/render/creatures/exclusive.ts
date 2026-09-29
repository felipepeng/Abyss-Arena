import { EEL } from "../../config/enemies/eel";
import { HERMIT } from "../../config/enemies/hermit";
import { URCHIN } from "../../config/enemies/urchin";
import { WATCHER } from "../../config/enemies/watcher";
import { TAU } from "../../core/math";
import type { Enemy } from "../../sim/enemies/types";

// Os seis inimigos exclusivos de mapa (GDD §6.2), vetoriais como o resto. Regra 2: o aviso de
// cada ataque é parte do desenho da criatura (halo pulsante, setor, linha, espinhos que
// crescem). Os desenhadores rodam com a origem no corpo; os que giram (`rotates`) têm a frente
// em +x. O progresso do aviso vem do estado (`t` e `stateMs`).

export type Drawer = (g: CanvasRenderingContext2D, e: Enemy, flashing: boolean) => void;

/** Progresso do estado atual, de 0 (acabou de entrar) a 1 (vai sair). */
const progress = (e: Enemy): number => (e.stateMs > 0 ? 1 - Math.max(e.t, 0) / e.stateMs : 1);

const disc = (g: CanvasRenderingContext2D, x: number, y: number, r: number): void => {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
  g.fill();
};

/** Halo pulsante de aviso, no mesmo estilo do peixe e do circulador. */
function warnHalo(g: CanvasRenderingContext2D, e: Enemy, r: number, color: string): void {
  g.globalAlpha = 0.25 + 0.45 * Math.abs(Math.sin(progress(e) * 13));
  g.fillStyle = color;
  disc(g, 0, 0, r);
  g.globalAlpha = 1;
}

/** Ermitão: concha em espiral nas costas, corpo e uma pinça blindada à frente (+x). */
export const drawHermit: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const striking = e.state === "strike";
  const k = progress(e);

  if (tel) {
    // o setor que a pinça vai varrer
    g.globalAlpha = 0.12 + 0.22 * k;
    g.fillStyle = "#ffb070";
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, HERMIT.strikeReach, -HERMIT.frontHalfArc, HERMIT.frontHalfArc);
    g.fill();
    g.globalAlpha = 1;
  }
  if (striking) {
    g.globalAlpha = 0.5;
    g.fillStyle = "#ffe0b0";
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, HERMIT.strikeReach, -HERMIT.frontHalfArc, HERMIT.frontHalfArc);
    g.fill();
    g.globalAlpha = 1;
  }

  // concha nas costas
  g.fillStyle = flashing ? "#ffffff" : "#9a6444";
  disc(g, -r * 0.35, 0, r * 0.95);
  if (!flashing) {
    g.strokeStyle = "#d9a273";
    g.lineWidth = 1.6;
    g.beginPath();
    for (let t = 0; t < 22; t++) {
      const a = t * 0.55;
      const rr = 1.5 + t * 0.44;
      const px = -r * 0.35 + Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (t === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.stroke();
  }
  // corpo
  g.fillStyle = flashing ? "#ffffff" : tel ? "#f08a52" : "#d8704a";
  g.beginPath();
  g.ellipse(r * 0.3, 0, r * 0.75, r * 0.6, 0, 0, TAU);
  g.fill();
  // pinça: abre e brilha no aviso, fecha no golpe
  const open = tel ? 0.15 + 0.6 * k : striking ? 0.05 : 0.18;
  if (tel) {
    g.globalAlpha = 0.3 + 0.4 * Math.abs(Math.sin(k * 14));
    g.fillStyle = "#ffcf8a";
    disc(g, r * 1.05, 0, r * 0.75);
    g.globalAlpha = 1;
  }
  g.fillStyle = flashing ? "#ffffff" : "#e8895a";
  for (const s of [-1, 1]) {
    g.save();
    g.translate(r * 0.7, s * r * 0.3);
    g.rotate(s * open);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(r * 0.9, s * -r * 0.05);
    g.lineTo(r * 0.15, s * r * 0.36);
    g.closePath();
    g.fill();
    g.restore();
  }
  // placa blindada: o arco da frente onde a lança é barrada
  g.strokeStyle = flashing ? "#ffffff" : "#d8d2bc";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(0, 0, r + 3, -HERMIT.frontHalfArc, HERMIT.frontHalfArc);
  g.stroke();
  // olho
  g.fillStyle = "#0b0b14";
  disc(g, r * 0.5, -r * 0.32, 1.8);
  disc(g, r * 0.5, r * 0.32, 1.8);
};

/** Ouriço: estático. No aviso os 8 espinhos da rajada crescem e piscam, na direção em que saem. */
export const drawUrchin: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const k = progress(e);
  const spin = e.data.spin ?? 0;

  // espinhos curtos, sempre
  g.strokeStyle = flashing ? "#ffffff" : "#8d7fb0";
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i < 16; i++) {
    const a = spin + (i / 16) * TAU;
    g.moveTo(Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8);
    g.lineTo(Math.cos(a) * (r + 5), Math.sin(a) * (r + 5));
  }
  g.stroke();

  if (tel) {
    // os 8 espinhos da rajada: crescem com o aviso e piscam
    g.globalAlpha = 0.55 + 0.45 * Math.abs(Math.sin(k * 16));
    g.strokeStyle = URCHIN.spikeColor;
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < URCHIN.spikes; i++) {
      const a = spin + (i / URCHIN.spikes) * TAU;
      g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      g.lineTo(Math.cos(a) * (r + 4 + 20 * k), Math.sin(a) * (r + 4 + 20 * k));
    }
    g.stroke();
    g.globalAlpha = 1;
  }
  g.fillStyle = flashing ? "#ffffff" : tel ? "#7a4aa0" : "#4a3468";
  disc(g, 0, 0, r);
  if (!flashing) {
    g.fillStyle = "#8d6fc0";
    disc(g, -r * 0.25, -r * 0.3, r * 0.3);
    g.fillStyle = "#e8d9a0";
    disc(g, 0, 0, 2.5);
  }
};

/** Medusinha: sino que incha e núcleo que brilha no aviso; tentáculos ondulando. */
export const drawJellyling: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const k = progress(e);

  if (tel) {
    warnHalo(g, e, r + 12, "#b8f0ff");
    // a linha de mira, travada no último passo
    g.strokeStyle = "rgba(184,240,255,0.5)";
    g.lineWidth = 1.5;
    g.setLineDash([4, 4]);
    g.beginPath();
    g.moveTo(e.dirX * r, e.dirY * r);
    g.lineTo(e.dirX * (r + 80), e.dirY * (r + 80));
    g.stroke();
    g.setLineDash([]);
  }
  const bell = tel ? 1 + 0.3 * k : 1;
  g.strokeStyle = flashing ? "#ffffff" : "#7fc4d8";
  g.lineWidth = 1.8;
  for (let i = -2; i <= 2; i++) {
    const x = i * r * 0.36;
    g.beginPath();
    g.moveTo(x, r * 0.3);
    g.quadraticCurveTo(x + (i % 2 === 0 ? 4 : -4), r * 1.0, x, r * 1.5);
    g.stroke();
  }
  g.fillStyle = flashing ? "#ffffff" : "#8fd8e8";
  g.globalAlpha = 0.9;
  g.beginPath();
  g.ellipse(0, 0, r * bell, r * 0.85 * bell, 0, Math.PI, 0);
  g.lineTo(r * bell, r * 0.3);
  g.quadraticCurveTo(0, r * 0.55, -r * bell, r * 0.3);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = flashing ? "#ffffff" : tel ? "#ffffff" : "#dff8ff";
  g.globalAlpha = tel ? 0.6 + 0.4 * k : 0.85;
  disc(g, 0, -r * 0.15, r * (tel ? 0.4 : 0.28));
  g.globalAlpha = 1;
};

/**
 * Enguia. A origem é a cabeça; a toca fica em `data.denX/denY`. Escondida: só os olhos
 * aparecem. No aviso, os olhos acendem e uma linha mostra a trajetória do bote.
 */
export const drawEel: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const hidden = e.state === "hidden" || e.state === "telegraph";
  const denX = (e.data.denX ?? e.x) - e.x;
  const denY = (e.data.denY ?? e.y) - e.y;
  const tel = e.state === "telegraph";
  const k = progress(e);

  if (tel) {
    // trajetória do bote: do tamanho do alcance, na direção travada
    const reach = EEL.strikeSpeed * (EEL.strikeMs / 1000);
    g.strokeStyle = "rgba(200,255,90,0.55)";
    g.lineWidth = 2 + 2 * k;
    g.setLineDash([6, 5]);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(e.dirX * reach, e.dirY * reach);
    g.stroke();
    g.setLineDash([]);
  }

  if (!hidden) {
    // corpo: um tubo curvo da toca até a cabeça
    const mx = denX * 0.5 - denY * 0.22;
    const my = denY * 0.5 + denX * 0.22;
    g.lineCap = "round";
    g.strokeStyle = flashing ? "#ffffff" : "#2f5e46";
    g.lineWidth = r * 1.5;
    g.beginPath();
    g.moveTo(denX, denY);
    g.quadraticCurveTo(mx, my, 0, 0);
    g.stroke();
    g.strokeStyle = flashing ? "#ffffff" : "#5fae82";
    g.lineWidth = r * 0.5;
    g.beginPath();
    g.moveTo(denX, denY);
    g.quadraticCurveTo(mx, my, 0, 0);
    g.stroke();
    g.lineCap = "butt";
    g.fillStyle = flashing ? "#ffffff" : "#3f7a5a";
    disc(g, 0, 0, r);
  }
  // olhos: acompanham o jogador (`dir`); apagados escondida, acesos no aviso e no bote
  const lit = e.state !== "hidden";
  const ex = e.dirX * 2;
  const ey = e.dirY * 2;
  const px = -e.dirY * 3.2;
  const py = e.dirX * 3.2;
  if (lit) {
    g.globalAlpha = 0.35 + 0.35 * (tel ? Math.abs(Math.sin(k * 14)) : 1);
    g.fillStyle = "#c8ff5a";
    disc(g, ex + px, ey + py, 6);
    disc(g, ex - px, ey - py, 6);
    g.globalAlpha = 1;
  }
  g.fillStyle = lit ? "#e8ff9a" : "#7c9a4a";
  disc(g, ex + px, ey + py, 2.4);
  disc(g, ex - px, ey - py, 2.4);
};

/** Vigia: olho com pedúnculo. No aviso a pupila contrai e aparece o setor do leque. */
export const drawWatcher: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const k = progress(e);

  if (tel) {
    const half = (WATCHER.fanStep * (WATCHER.shots - 1)) / 2;
    g.globalAlpha = 0.12 + 0.24 * k;
    g.fillStyle = WATCHER.shotColor;
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, 120, -half, half);
    g.fill();
    g.globalAlpha = 1;
  }
  // pedúnculo, atrás
  g.strokeStyle = flashing ? "#ffffff" : "#6a3a5a";
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(-r * 0.6, 0);
  g.quadraticCurveTo(-r * 1.4, r * 0.7, -r * 2.1, 0);
  g.stroke();
  // globo
  g.fillStyle = flashing ? "#ffffff" : "#eadcf2";
  disc(g, 0, 0, r);
  if (!flashing) {
    g.strokeStyle = "rgba(150,60,90,0.5)";
    g.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * TAU + 0.6;
      g.beginPath();
      g.moveTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
      g.lineTo(Math.cos(a + 0.2) * r * 0.95, Math.sin(a + 0.2) * r * 0.95);
      g.stroke();
    }
  }
  // íris olhando para o jogador (+x), pupila que contrai
  const ir = r * 0.5;
  g.fillStyle = flashing ? "#ffffff" : WATCHER.shotColor;
  disc(g, r * 0.32, 0, ir * (tel ? 1.1 : 1));
  g.fillStyle = "#0a0410";
  disc(g, r * 0.36, 0, ir * (tel ? 0.32 : 0.55));
  g.fillStyle = "rgba(255,255,255,0.7)";
  disc(g, r * 0.22, -ir * 0.35, ir * 0.2);
};

/** Lampreia: corpo fino com a boca redonda à frente (+x); a boca abre e brilha no aviso. */
export const drawLamprey: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const biting = e.state === "bite";
  const k = progress(e);

  if (tel) warnHalo(g, e, r + 8, "#ff9a9a");
  // cauda
  g.fillStyle = flashing ? "#ffffff" : "#6e4a5e";
  g.beginPath();
  g.moveTo(-r * 0.6, -r * 0.55);
  g.quadraticCurveTo(-r * 2.0, -r * 0.5, -r * 3.0, 0);
  g.quadraticCurveTo(-r * 2.0, r * 0.5, -r * 0.6, r * 0.55);
  g.closePath();
  g.fill();
  // corpo
  g.fillStyle = flashing ? "#ffffff" : biting ? "#c48aa6" : "#8a5a6e";
  g.beginPath();
  g.ellipse(0, 0, r * 1.1, r * 0.72, 0, 0, TAU);
  g.fill();
  // boca: um anel de dentes que abre no aviso
  const mouth = biting ? 0.62 : tel ? 0.3 + 0.32 * k : 0.28;
  g.fillStyle = "#1a0810";
  disc(g, r * 0.95, 0, r * mouth);
  if (tel || biting) {
    g.globalAlpha = 0.5 + 0.4 * Math.abs(Math.sin(k * 14));
    g.fillStyle = "#ff9a9a";
    disc(g, r * 0.95, 0, r * mouth * 0.55);
    g.globalAlpha = 1;
  }
  g.strokeStyle = flashing ? "#ffffff" : "#f0e4d0";
  g.lineWidth = 1;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    g.moveTo(r * 0.95 + Math.cos(a) * r * mouth, Math.sin(a) * r * mouth);
    g.lineTo(r * 0.95 + Math.cos(a) * r * mouth * 0.65, Math.sin(a) * r * mouth * 0.65);
  }
  g.stroke();
  g.fillStyle = "#ffe066";
  disc(g, r * 0.2, -r * 0.35, 1.5);
};
