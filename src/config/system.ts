// Números de sistema: resolução, passo fixo, transições e depuração.

export const VIEW = {
  /** Canvas interno. O CSS escala mantendo a proporção (letterbox). */
  width: 960,
  height: 540,
} as const;

export const SIM = {
  hz: 60,
  /** 1000 / 60 ≈ 16,667 ms. Todos os números de feel do protótipo foram calibrados neste passo. */
  stepMs: 1000 / 60,
  /** Teto do tempo acumulado por frame: depois de uma travada o jogo não "corre" para alcançar. */
  maxFrameMs: 100,
} as const;

export const SCENE = {
  /** Duração total da troca de cena (metade escurecendo, metade clareando). GDD §11. */
  fadeMs: 300,
  fadeColor: "#02050b",
} as const;

export const DEBUG = {
  /** Janela de amostragem do contador de FPS. */
  fpsSampleMs: 400,
} as const;

/** Fonte de todo texto desenhado no canvas, a mesma do protótipo. */
export const FONT_FAMILY = "ui-monospace, Consolas, monospace";
