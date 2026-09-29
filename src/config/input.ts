import type { Bindings } from "../core/input";

// Ações do jogo e seus atalhos. Controles do jogador: GDD §4.5. Atalhos de depuração:
// ARCHITECTURE §10.1 (as teclas B, N, M e R do protótipo viraram depuração, GDD §4.5).

export type Action =
  | "moveUp"
  | "moveDown"
  | "moveLeft"
  | "moveRight"
  | "attack"
  | "dash"
  | "pause"
  | "debugOverlay"
  | "debugGodMode"
  | "debugNextWave"
  | "debugSkipToBoss"
  | "debugBossPhase"
  | "debugRegenMap"
  | "debugSlowMo"
  | "debugCrab"
  | "debugJelly"
  | "debugEye"
  | "debugRestart";

export const BINDINGS: Bindings<Action> = {
  keys: {
    moveUp: ["KeyW", "ArrowUp"],
    moveDown: ["KeyS", "ArrowDown"],
    moveLeft: ["KeyA", "ArrowLeft"],
    moveRight: ["KeyD", "ArrowRight"],
    attack: ["KeyJ", "KeyK", "Enter", "NumpadEnter"],
    dash: ["Space", "ShiftLeft", "ShiftRight", "KeyL"],
    pause: ["Escape", "KeyP"],
    debugOverlay: ["F1"],
    debugGodMode: ["F2"],
    debugNextWave: ["F3"],
    debugSkipToBoss: ["F4"],
    debugBossPhase: ["F5"],
    debugRegenMap: ["F6"],
    debugSlowMo: ["F7"],
    debugCrab: ["KeyB"],
    debugJelly: ["KeyN"],
    debugEye: ["KeyM"],
    debugRestart: ["KeyR"],
  },
  mouseButtons: {
    attack: [0],
  },
};

export const INPUT = {
  /** Sem mouse, a mira segue a direção do nado; mexer o mouse devolve a mira ao cursor. */
  keyboardAimFollowsMovement: true,
} as const;
