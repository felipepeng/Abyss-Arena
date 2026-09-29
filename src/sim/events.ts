// Eventos que a simulação emite para fora (ARCHITECTURE §4.2). Render, áudio e FX reagem a
// eles; a simulação decide *que* algo aconteceu, o resto decide *como* aparece.
// A lista cresce com os marcos: no M1 só existem jogador e sacos de pancada.

export type TargetKind = "dummy";

export type SimEvent =
  /** A lança acertou uma criatura. (x, y) é a posição do alvo; dir é a direção da estocada. */
  | { t: "spearHit"; x: number; y: number; dirX: number; dirY: number; targetR: number }
  | { t: "enemyDied"; x: number; y: number; radius: number; kind: TargetKind }
  | { t: "dash"; x: number; y: number; dirX: number; dirY: number }
  /** A estocada saiu. `charge` em [0, 1]. */
  | { t: "thrust"; x: number; y: number; dirX: number; dirY: number; charge: number };
