import { ANEMONE } from "../../config/enemies/anemone";
import { HERMIT } from "../../config/enemies/hermit";
import { URCHIN } from "../../config/enemies/urchin";
import { WATCHER } from "../../config/enemies/watcher";
import { TAU } from "../../core/math";
import type { Enemy } from "../../sim/enemies/types";
import { facingFlip } from "./flip";

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

/**
 * Medusinha: uma miniatura da Água-viva. Sino com borda de lóbulos, canais e núcleo, tentáculos
 * finos em ondas e uma aura na cor do esporo. No aviso o sino incha e o núcleo acende.
 */
export const drawJellyling: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const k = progress(e);
  // a fase da ondulação é a mesma do sobe e desce dela (e.data.bob), só visual
  const ph = e.data.bob ?? 0;
  const W = "#ffffff";

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
  const R = r * bell;
  const rim = (x: number): number => R * 0.3 * Math.sqrt(Math.max(0, 1 - (x / R) ** 2));
  g.lineCap = "round";
  g.lineJoin = "round";

  // aura
  if (!flashing) {
    const aura = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.6);
    aura.addColorStop(0, "rgba(184,240,255,0.16)");
    aura.addColorStop(1, "rgba(184,240,255,0)");
    g.fillStyle = aura;
    disc(g, 0, 0, r * 2.6);
  }

  // tentáculos: finos, ondulam e somem na ponta (o último brilha)
  for (let i = 0; i < 5; i++) {
    const x0 = (i / 4 - 0.5) * R * 1.45;
    const len = r * (1.2 + 0.5 * ((i * 3) % 4) / 3);
    let px = x0;
    let py = rim(x0);
    for (let s = 1; s <= 7; s++) {
      const t = s / 7;
      const nx = x0 * (1 - 0.12 * t) + Math.sin(ph * 1.3 - t * 4.5 + i * 1.7) * (1 + 3.2 * t);
      const ny = rim(x0) + t * len;
      g.strokeStyle = flashing ? W : "#7fc4d8";
      g.globalAlpha = flashing ? 1 : 1 - 0.45 * t;
      g.lineWidth = 2.8 * (1 - t) + 1;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(nx, ny);
      g.stroke();
      px = nx;
      py = ny;
    }
    if (!flashing) {
      g.globalAlpha = 0.5 + 0.4 * Math.sin(ph * 2 + i);
      g.fillStyle = "#dff8ff";
      disc(g, px, py, 0.9);
    }
  }
  g.globalAlpha = 1;

  // sino: cúpula e borda de baixo recortada em lóbulos
  const dome = (): void => {
    g.beginPath();
    g.ellipse(0, 0, R, R * 0.85, 0, Math.PI, TAU);
    const lobes = 5;
    for (let j = 0; j < lobes; j++) {
      const x1 = R - ((j + 1) * 2 * R) / lobes;
      const mid = R - ((j + 0.5) * 2 * R) / lobes;
      const bulge = R * (0.1 + 0.04 * Math.sin(ph * 1.6 + j)) * (Math.sqrt(Math.max(0, 1 - (mid / R) ** 2)) + 0.3);
      g.quadraticCurveTo(mid, rim(mid) + bulge, x1, rim(x1));
    }
    g.closePath();
  };
  dome();
  if (flashing) {
    g.fillStyle = W;
    g.fill();
    return;
  }
  const grad = g.createRadialGradient(0, -R * 0.3, R * 0.1, 0, 0, R);
  grad.addColorStop(0, "#effcff");
  grad.addColorStop(0.5, "#8fd8e8");
  grad.addColorStop(1, "#4a9fbd");
  g.fillStyle = grad;
  g.fill();
  g.save();
  dome();
  g.clip();
  // canais radiais
  g.strokeStyle = "rgba(255,255,255,0.4)";
  g.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + ((i + 0.5) / 5) * Math.PI;
    g.beginPath();
    g.moveTo(0, -R * 0.15);
    g.lineTo(Math.cos(a) * R * 0.95, Math.sin(a) * R * 0.8);
    g.stroke();
  }
  // reflexo
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.beginPath();
  g.ellipse(-R * 0.4, -R * 0.55, R * 0.2, R * 0.08, -0.6, 0, TAU);
  g.fill();
  g.restore();
  // contorno escuro (para ler sobre o fundo) e fio de luz na borda; pontos de luz nos lóbulos
  dome();
  g.strokeStyle = "rgba(12,70,96,0.75)";
  g.lineWidth = 1.6;
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.7)";
  g.lineWidth = 0.8;
  g.stroke();
  for (let j = 0; j < 5; j++) {
    const mid = R - ((j + 0.5) * 2 * R) / 5;
    g.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(ph * 2 + j * 1.7));
    g.fillStyle = "#ffffff";
    disc(g, mid, rim(mid) + R * 0.05, 0.9);
  }
  g.globalAlpha = 1;
  // núcleo: incha e acende no aviso
  const coreR = r * (tel ? 0.4 : 0.26);
  const cg = g.createRadialGradient(0, -r * 0.15, 0, 0, -r * 0.15, coreR * 2.2);
  cg.addColorStop(0, "rgba(255,255,255,0.95)");
  cg.addColorStop(0.35, tel ? "rgba(255,255,255,0.8)" : "rgba(184,240,255,0.85)");
  cg.addColorStop(1, "rgba(184,240,255,0)");
  g.globalAlpha = tel ? 0.6 + 0.4 * k : 1;
  g.fillStyle = cg;
  disc(g, 0, -r * 0.15, coreR * 2.2);
  g.fillStyle = tel ? W : "#dff8ff";
  disc(g, 0, -r * 0.15, coreR * 0.75);
  g.globalAlpha = 1;
};

/**
 * Anêmona-chicote, presa a um coral. Em repouso: uma coroa de tentáculos curtos. No aviso: o arco
 * que a varredura vai cobrir e o braço aceso onde ela começa. Na varredura: o braço girando, com
 * o rastro do que já passou. O braço é cortado pela rocha (`armLen`), como o raio da Água-viva.
 */
export const drawAnemone: Drawer = (g, e, flashing) => {
  const r = e.radius;
  const tel = e.state === "telegraph";
  const sweeping = e.state === "sweep";
  const k = progress(e);
  const dir = e.data.dir ?? 1;
  const arm0 = e.data.arm0 ?? 0;
  const armAng = e.data.armAng ?? 0;
  const armLen = e.data.armLen ?? 0;
  const ccw = dir < 0;

  const sector = (from: number, to: number, alpha: number): void => {
    g.globalAlpha = alpha;
    g.fillStyle = "#ff6fb5";
    g.beginPath();
    g.moveTo(0, 0);
    g.arc(0, 0, ANEMONE.armLen, from, to, ccw);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  };
  const arm = (ang: number, len: number, glow: number): void => {
    if (len < 2) return;
    const x = Math.cos(ang) * len;
    const y = Math.sin(ang) * len;
    g.lineCap = "round";
    g.globalAlpha = glow;
    g.strokeStyle = "#ff8fc8";
    g.lineWidth = 16;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(x, y);
    g.stroke();
    g.globalAlpha = 1;
    g.strokeStyle = flashing ? "#ffffff" : "#ff5aa8";
    g.lineWidth = 8;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(x, y);
    g.stroke();
    g.fillStyle = flashing ? "#ffffff" : "#ffd6ec";
    g.beginPath();
    g.arc(x, y, 6, 0, TAU);
    g.fill();
    g.lineCap = "butt";
  };

  if (tel) {
    sector(arm0, arm0 + dir * ANEMONE.sweepRad, 0.08 + 0.16 * k);
    arm(arm0, armLen, 0.25 + 0.4 * Math.abs(Math.sin(k * 14)));
  } else if (sweeping) {
    sector(arm0, armAng, 0.14);
    arm(armAng, armLen, 0.4);
  }

  // coroa de tentáculos curtos, que se abrem no aviso
  g.strokeStyle = flashing ? "#ffffff" : "#e0559b";
  g.lineWidth = 3.5;
  g.lineCap = "round";
  const open = tel || sweeping ? 5 : 0;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU;
    g.beginPath();
    g.moveTo(Math.cos(a) * r * 0.7, Math.sin(a) * r * 0.7);
    g.quadraticCurveTo(
      Math.cos(a + 0.35) * (r + 4 + open * 0.6), Math.sin(a + 0.35) * (r + 4 + open * 0.6),
      Math.cos(a) * (r + 8 + open), Math.sin(a) * (r + 8 + open),
    );
    g.stroke();
  }
  g.lineCap = "butt";
  g.fillStyle = flashing ? "#ffffff" : tel ? "#e8579f" : "#c8437f";
  disc(g, 0, 0, r);
  if (!flashing) {
    g.fillStyle = "#ff9ccd";
    disc(g, -r * 0.2, -r * 0.25, r * 0.5);
    g.fillStyle = "#4a1030";
    disc(g, 0, 0, r * 0.28);
  }
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
  // o olho fica de um lado só: espelha para ele ficar sempre em cima (ver flip.ts)
  g.save();
  g.scale(1, facingFlip(e));
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
  g.restore();
};
