import { DEBUG_RING } from "../config/spawn";
import { TAU } from "../core/math";
import { fireProjectile } from "./projectiles";
import type { World } from "./world";

// Ações de depuração que mexem na simulação. Entram pelo passo, como qualquer entrada: nunca
// de dentro de um handler do DOM.

/** Anel de projéteis em volta do jogador, todos apontando para ele (F8). */
export function fireDebugRing(w: World): void {
  const p = w.player;
  const R = DEBUG_RING;
  for (let i = 0; i < R.count; i++) {
    const a = (i / R.count) * TAU;
    const x = p.x + Math.cos(a) * R.radius;
    const y = p.y + Math.sin(a) * R.radius;
    // erodem, para testar a erosão e a máscara de protegidos na arena de teste
    fireProjectile(w, x, y, a + Math.PI, R.speed, R.damage, R.r, R.lifeMs, R.color, { erodes: true });
  }
}
