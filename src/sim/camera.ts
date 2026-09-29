import { CAMERA } from "../config/camera";
import { VIEW } from "../config/system";
import { clamp } from "../core/math";
import type { Grid } from "../world/grid";
import type { Player } from "./player";

// Câmera. Mora na simulação porque a mira depende dela: o cursor é guardado em
// coordenadas de tela e convertido para o mundo a cada passo, com a câmera daquele passo.

export interface Camera {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

// Alvo: olha à frente da mira e para nas bordas do mundo.
const targetX = (p: Player, grid: Grid): number =>
  clamp(p.x + Math.cos(p.aim) * CAMERA.lookAhead - VIEW.width / 2, 0, Math.max(0, grid.width - VIEW.width));
const targetY = (p: Player, grid: Grid): number =>
  clamp(p.y + Math.sin(p.aim) * CAMERA.lookAhead - VIEW.height / 2, 0, Math.max(0, grid.height - VIEW.height));

export function createCamera(p: Player, grid: Grid): Camera {
  const x = targetX(p, grid);
  const y = targetY(p, grid);
  return { x, y, prevX: x, prevY: y };
}

export function stepCamera(cam: Camera, p: Player, grid: Grid): void {
  cam.x += (targetX(p, grid) - cam.x) * CAMERA.lerp;
  cam.y += (targetY(p, grid) - cam.y) * CAMERA.lerp;
}
