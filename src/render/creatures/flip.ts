import type { Enemy } from "../../sim/enemies/types";

// Criaturas que giram para onde nadam e têm um lado de cima (a dorsal do peixe, o olho da lampreia)
// ficariam de ponta cabeça virando para a esquerda. Para o lado de cima ficar sempre para cima, o
// desenho é espelhado na vertical quando a criatura aponta para a esquerda.
//
// A decisão tem histerese: só troca ao passar de ±FLIP_DEADZONE do cosseno do ângulo. Nadando quase
// na vertical ela não fica piscando entre os dois lados. Estado só visual, guardado aqui.

const FLIP_DEADZONE = 0.15;
const flips = new WeakMap<Enemy, number>();

/** +1 (como foi desenhado) ou −1 (espelhado). Use `g.scale(1, facingFlip(e))` depois do giro. */
export function facingFlip(e: Enemy): number {
  const c = Math.cos(e.ang);
  let sy = flips.get(e) ?? 1;
  if (c > FLIP_DEADZONE) sy = 1;
  else if (c < -FLIP_DEADZONE) sy = -1;
  flips.set(e, sy);
  return sy;
}
