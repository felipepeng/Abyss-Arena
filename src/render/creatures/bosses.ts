import { angLerp, lerp } from "../../core/math";
import type { Boss } from "../../sim/bosses/types";
import type { World } from "../../sim/world";
import { drawCrab } from "./crab";
import { drawEye } from "./eye";
import { drawJelly } from "./jelly";

// Despacha o desenho de cada chefe (CONTEXTO §2.3 e §2.7). Os avisos de ataque são parte do
// desenho de cada um e vêm antes do corpo. O progresso de cada aviso sai do estado (`t` e
// `stateMs`), não de uma cópia do tempo no render.

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
