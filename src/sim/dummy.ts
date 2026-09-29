import { DUMMY, type DummyKind } from "../config/dummy";
import { makeBody, type Body } from "./body";
import { moveBody } from "./collision";
import { accelerate, applyDrag, clampSpeed } from "./physics";
import type { World } from "./world";

// Saco de pancada da arena de teste (M1). Parado, volta devagar ao ponto de origem depois
// de empurrado e renasce ao morrer. Sai quando os inimigos de verdade chegarem (M2).

export interface Dummy extends Body {
  readonly id: number;
  readonly kind: DummyKind;
  hp: number;
  readonly maxHp: number;
  flashMs: number;
  alive: boolean;
  respawnMs: number;
  readonly anchorX: number;
  readonly anchorY: number;
}

export function createDummy(id: number, kind: DummyKind, x: number, y: number): Dummy {
  const spec = DUMMY.kinds[kind];
  return {
    ...makeBody(x, y, spec.radius, spec.collRadius),
    id, kind, hp: spec.hp, maxHp: spec.hp, flashMs: 0, alive: true, respawnMs: 0,
    anchorX: x, anchorY: y,
  };
}

export function stepDummy(d: Dummy, w: World, dtMs: number): void {
  const dt = dtMs / 1000;
  if (d.flashMs > 0) d.flashMs -= dtMs;

  if (!d.alive) {
    d.respawnMs -= dtMs;
    if (d.respawnMs <= 0) {
      d.alive = true;
      d.hp = d.maxHp;
      d.x = d.prevX = d.anchorX;
      d.y = d.prevY = d.anchorY;
      d.vx = d.vy = 0;
    }
    return;
  }

  const spec = DUMMY.kinds[d.kind];
  const ox = d.anchorX - d.x;
  const oy = d.anchorY - d.y;
  const od = Math.hypot(ox, oy);
  if (od > DUMMY.returnDeadZone) accelerate(d, ox / od, oy / od, DUMMY.returnAccel, dt);
  // mesma ordem do integrador das criaturas do protótipo: teto, arrasto, colisão. O teto
  // vem depois do empurrão da lança e o corta no mesmo passo.
  clampSpeed(d, spec.maxSpeed);
  applyDrag(d, spec.drag, dt);
  moveBody(d, w.grid, dt);
}
