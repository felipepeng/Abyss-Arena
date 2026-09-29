import { PLAYER } from "../config/player";
import { FONT_FAMILY, VIEW } from "../config/system";
import { clamp } from "../core/math";
import type { Player } from "../sim/player";

// HUD do jogador: vida e recarga do dash no canto inferior esquerdo, como no protótipo, e o
// modo de mira. Não treme (é desenhado fora da transformação do mundo).

export function drawPlayerHud(g: CanvasRenderingContext2D, p: Player): void {
  const H = VIEW.height;
  g.font = `12px ${FONT_FAMILY}`;
  g.textBaseline = "alphabetic";

  const hw = 220;
  g.fillStyle = "rgba(0,0,0,0.5)";
  g.fillRect(12, H - 56, hw + 8, 18);
  g.fillStyle = "#4a1a22";
  g.fillRect(16, H - 52, hw, 10);
  g.fillStyle = p.hp > 35 ? "#57d97a" : "#ff6161";
  g.fillRect(16, H - 52, hw * clamp(p.hp / PLAYER.hp, 0, 1), 10);
  g.fillStyle = "#dff0ff";
  g.fillText(`VIDA ${Math.ceil(p.hp)}`, 16 + hw + 16, H - 43);

  const dw = 120;
  const k = 1 - clamp(p.dashCdMs / PLAYER.dash.cooldownMs, 0, 1);
  g.fillStyle = "rgba(0,0,0,0.5)";
  g.fillRect(12, H - 32, dw + 8, 16);
  g.fillStyle = "#14293d";
  g.fillRect(16, H - 28, dw, 8);
  g.fillStyle = k >= 1 ? "#7fe6ff" : "#3d6c8a";
  g.fillRect(16, H - 28, dw * k, 8);
  g.fillStyle = "#dff0ff";
  g.fillText(k >= 1 ? "DASH PRONTO" : "DASH...", 16 + dw + 16, H - 20);

  const keys = p.aimMode === "keys";
  g.fillStyle = keys ? "rgba(255,224,102,0.85)" : "rgba(210,232,255,0.45)";
  g.fillText(keys ? "MIRA: TECLADO (WASD) — mexa o mouse para voltar ao cursor" : "MIRA: CURSOR", 16, 36);
}

/** Linha de ajuda do topo, enquanto não há tela de controles (M6). */
export function drawControlsHint(g: CanvasRenderingContext2D, text: string): void {
  g.font = `12px ${FONT_FAMILY}`;
  g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(210,232,255,0.55)";
  g.fillText(text, 16, 20);
}
