import { FONT_FAMILY, VIEW } from "../config/system";
import { clamp, len } from "../core/math";
import { BOSS_DEFS } from "../sim/bosses/registry";
import type { Boss } from "../sim/bosses/types";
import { remainingInWave } from "../sim/phase";
import type { World } from "../sim/world";

// HUD da fase (GDD §2.2 e §9.2): cartão de título, contador de onda, textos entre as ondas,
// barra do chefe com as marcas de fase e a seta do chefe fora da tela. Não treme.

export interface TitleCard {
  name: string;
  depth: string;
  line: string;
}

const BOSS_COLORS: Record<string, readonly [string, string]> = {
  crab: ["#e08a3c", "#ff5a3c"],
};

export function drawPhaseHud(g: CanvasRenderingContext2D, w: World, title: TitleCard, camX: number, camY: number): void {
  const f = w.phase;
  if (!f) return;
  const { width: W, height: H } = VIEW;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";

  if (f.state === "intro") drawTitleCard(g, title, 1 - f.t / f.stateMs);

  if (f.state === "wave") {
    g.font = `13px ${FONT_FAMILY}`;
    g.fillStyle = "rgba(223,240,255,0.85)";
    g.fillText(`ONDA ${f.wave}/${f.setup.waves.length} · ${remainingInWave(w, f)} restantes`, W / 2, 24);
  }

  // entre as ondas: o número da próxima
  if (f.state === "interlude" && f.wave < f.setup.waves.length) {
    bigText(g, `ONDA ${f.wave + 1}`, fadeInOut(1 - f.t / f.stateMs), "#dff0ff");
  }

  const boss = f.boss;
  if (boss && (f.state === "bossIntro" || f.state === "boss")) {
    const fill = f.state === "bossIntro" ? 1 - f.t / f.stateMs : boss.hp / boss.maxHp;
    drawBossBar(g, boss, fill);
    if (f.state === "bossIntro") bigText(g, BOSS_DEFS[boss.kind].name, fadeInOut(1 - f.t / f.stateMs), "#ffdfc0");
    else drawOffscreenArrow(g, boss, w, camX, camY);
  }

  if (f.state === "cleared" && f.t <= 0) {
    g.fillStyle = "rgba(0,0,0,0.45)";
    g.fillRect(0, 0, W, H);
    bigText(g, "FASE CONCLUÍDA", 1, "#ffe9a8");
    g.font = `14px ${FONT_FAMILY}`;
    g.fillStyle = "#dff0ff";
    g.fillText("R para jogar de novo", W / 2, H / 2 + 30);
  }
  g.textAlign = "left";
}

/** Sobe nos primeiros 20% e desce nos últimos 20%. */
const fadeInOut = (k: number): number => clamp(Math.min(k / 0.2, (1 - k) / 0.2), 0, 1);

function bigText(g: CanvasRenderingContext2D, text: string, alpha: number, color: string): void {
  g.globalAlpha = alpha;
  g.font = `bold 30px ${FONT_FAMILY}`;
  g.fillStyle = color;
  g.fillText(text, VIEW.width / 2, VIEW.height / 2 - 60);
  g.globalAlpha = 1;
}

/** Cartão de título na entrada do mapa (GDD §7): nome, profundidade e uma frase. */
function drawTitleCard(g: CanvasRenderingContext2D, t: TitleCard, k: number): void {
  const { width: W, height: H } = VIEW;
  const a = fadeInOut(k);
  g.globalAlpha = a * 0.5;
  g.fillStyle = "#02050b";
  g.fillRect(0, H / 2 - 70, W, 120);
  g.globalAlpha = a;
  g.fillStyle = "#e8f2ff";
  g.font = `bold 34px ${FONT_FAMILY}`;
  g.fillText(t.name, W / 2, H / 2 - 20);
  g.font = `14px ${FONT_FAMILY}`;
  g.fillStyle = "#9fc4e0";
  g.fillText(t.depth, W / 2, H / 2 + 6);
  g.font = `italic 15px ${FONT_FAMILY}`;
  g.fillStyle = "#cfe0f0";
  g.fillText(t.line, W / 2, H / 2 + 32);
  g.globalAlpha = 1;
}

/** Barra de vida do chefe com uma marca em cada limiar de fase (vindas de `phases`). */
function drawBossBar(g: CanvasRenderingContext2D, b: Boss, fill: number): void {
  const def = BOSS_DEFS[b.kind];
  const W = VIEW.width;
  const w = W * 0.6;
  const x = (W - w) / 2;
  const y = 16;
  g.fillStyle = "rgba(0,0,0,0.55)";
  g.fillRect(x - 3, y - 3, w + 6, 20);
  g.fillStyle = "#3a1414";
  g.fillRect(x, y, w, 14);
  const colors = BOSS_COLORS[b.kind] ?? ["#e08a3c", "#ff5a3c"];
  g.fillStyle = b.phase >= 1 ? colors[1] : colors[0];
  g.fillRect(x, y, w * clamp(fill, 0, 1), 14);
  g.strokeStyle = "rgba(255,255,255,0.35)";
  g.lineWidth = 1;
  g.strokeRect(x, y, w, 14);
  g.strokeStyle = "rgba(255,255,255,0.6)";
  for (let i = 1; i < def.phases.length; i++) {
    const at = def.phases[i]?.hpBelow ?? 0;
    g.beginPath();
    g.moveTo(x + w * at, y);
    g.lineTo(x + w * at, y + 14);
    g.stroke();
  }
  g.fillStyle = "#ffdfc0";
  g.font = `12px ${FONT_FAMILY}`;
  g.fillText(b.phase >= 1 ? `${def.name}  — ${def.rageLabel}` : def.name, W / 2, y + 30);
}

/**
 * Seta na borda da tela quando o chefe está fora de vista. A posição é a interseção do raio
 * centro → chefe com o retângulo da tela (o protótipo projetava e cortava, o que desalinhava
 * a seta nos cantos). A distância vai em px, sem a unidade falsa "m" do protótipo.
 */
function drawOffscreenArrow(g: CanvasRenderingContext2D, b: Boss, w: World, camX: number, camY: number): void {
  const { width: W, height: H } = VIEW;
  const m = 34;
  const vx = b.x - camX;
  const vy = b.y - camY;
  if (vx > m && vx < W - m && vy > m && vy < H - m) return;
  const cx = W / 2;
  const cy = H / 2;
  const dx = vx - cx;
  const dy = vy - cy;
  // o menor t que leva o raio até a borda do retângulo interno
  const tx = dx !== 0 ? (W / 2 - m) / Math.abs(dx) : Infinity;
  const ty = dy !== 0 ? (H / 2 - m) / Math.abs(dy) : Infinity;
  const t = Math.min(tx, ty);
  const px = cx + dx * t;
  const py = cy + dy * t;
  g.save();
  g.translate(px, py);
  g.rotate(Math.atan2(dy, dx));
  g.globalAlpha = 0.85;
  g.fillStyle = BOSS_COLORS[b.kind]?.[0] ?? "#e08a3c";
  g.beginPath();
  g.moveTo(13, 0);
  g.lineTo(-9, -9);
  g.lineTo(-9, 9);
  g.fill();
  g.restore();
  g.font = `11px ${FONT_FAMILY}`;
  g.fillStyle = "rgba(230,240,255,0.7)";
  g.fillText(`${Math.round(len(b.x - w.player.x, b.y - w.player.y))} px`, px, py + 22);
}
