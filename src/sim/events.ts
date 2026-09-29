import type { EnemyKind } from "./enemies/types";

// Eventos que a simulação emite para fora (ARCHITECTURE §4.2). Render, áudio e FX reagem a
// eles; a simulação decide *que* algo aconteceu, o resto decide *como* aparece.

export type SimEvent =
  /** A lança acertou uma criatura. (x, y) é a posição do alvo; dir é a direção da estocada. */
  | { t: "spearHit"; x: number; y: number; dirX: number; dirY: number; targetR: number }
  | { t: "enemyDied"; x: number; y: number; radius: number; kind: EnemyKind }
  /** Um aviso começou (regra 2). Para som e depuração; o desenho lê o estado da criatura. */
  | { t: "telegraph"; x: number; y: number; source: EnemyKind; attack: string }
  /** O ataque telegrafado saiu. */
  | { t: "attackStart"; x: number; y: number; source: EnemyKind; attack: string }
  | { t: "dash"; x: number; y: number; dirX: number; dirY: number }
  /** A estocada saiu. `charge` em [0, 1]. */
  | { t: "thrust"; x: number; y: number; dirX: number; dirY: number; charge: number }
  | { t: "playerHurt"; x: number; y: number; amount: number }
  | { t: "playerDied"; x: number; y: number }
  /** A lança estourou um projétil (sem hit-stop, regra 6). */
  | { t: "projectilePopped"; x: number; y: number; color: string }
  /** Um projétil sumiu na rocha ou na borda do mundo. */
  | { t: "projectileBurst"; x: number; y: number; color: string }
  /** Um projétil acertou o jogador. */
  | { t: "projectileHit"; x: number; y: number; color: string }
  | { t: "rockEroded"; x: number; y: number }
  | { t: "pickup"; x: number; y: number; amount: number };
