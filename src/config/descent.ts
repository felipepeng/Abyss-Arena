// A cena de descida entre duas fases da Descida (GDD §2.5): o mergulhador já começa caindo por um
// poço enorme e, no fim, sai pela boca dele na fase seguinte. A luz some um pouco a cada vez e só se
// ouve a água. Só apresentação: nada aqui afeta o combate. Tempos em ms, velocidades em px/s,
// distâncias em px (espaço lógico de 960 × 540).

export const DESCENT_SCENE = {
  /** A queda, do primeiro quadro até ele chegar à boca de saída do poço. */
  fallMs: 3800,
  /** A saída: passa pela boca, freia, vira e nada para a direita na fase seguinte. */
  exitMs: 2500,
  /** Pular só vale depois disto, para o Enter que confirmou "Continuar" não pular a cena. */
  skipLockMs: 500,

  /** Velocidade da queda (em regime). Ele já começa a cena nesta fração dela e chega a ela em `fallRampMs`. */
  fallSpeedPxS: 430,
  startSpeedFrac: 0.9,
  fallRampMs: 500,
  /** Depois da boca: quanto ele leva para parar de cair e para virar da vertical para o nado. */
  exitDecelMs: 1100,
  exitTurnDelayMs: 250,
  exitTurnMs: 1000,
  /**
   * Nado de saída: abaixo dos 250 px/s do nado livre (GDD §4.1), para ele parecer o mesmo mergulhador.
   * `swimLevel` é o volume da água nadando (0 a 1, como o `level` do `WaterRush`).
   */
  swimSpeedPxS: 190,
  swimLevel: 0.22,
  /** Balanço do corpo durante a queda: rad e período. */
  swayRad: 0.14,
  swayPeriodMs: 1700,
  /** Quanto ele deriva de lado, px, e quanto tempo o balanço leva para sumir na saída. */
  driftPx: 14,
  calmMs: 800,
} as const;

/** O mundo da cena. A câmera desce com o mergulhador e para logo depois da boca de saída. */
export const SHAFT = {
  /** Onde o mergulhador começa, na altura da tela e do mundo da cena (a câmera começa em 0). */
  fallScreenY: 200,
  /** Altura da tela em que fica o teto da fase seguinte quando a câmera para. */
  exitCeilingScreenY: 110,
  /** Meia largura do poço, o alargamento na boca de saída e o quanto ele leva para sumir para cima. */
  halfWidth: 190,
  mouthFlare: 70,
  mouthFlareLen: 90,
  /** Passo do contorno das paredes, px. Menor = mais suave e mais caro. */
  edgeStepPx: 14,
  /** Faixas de estrato na parede do fundo: espaçamento e quanto elas andam em relação à frente (parallax). */
  strataGapPx: 74,
  strataParallax: 0.55,
  /** Quantas bolhas e quantas riscas de velocidade. */
  bubbles: 46,
  streaks: 16,
} as const;

/**
 * A luz de cada descida: de `start` a `end`, de 1 (dia) a 0 (preto). A segunda descida começa
 * onde a primeira acabou e termina mais escura, então a iluminação só diminui, dentro de cada
 * cena e de uma para a outra. O índice é a posição do mapa que acabou na Descida.
 */
export const DESCENT_LIGHT: readonly { start: number; end: number }[] = [
  { start: 0.92, end: 0.46 },
  { start: 0.46, end: 0.1 },
];

/** A escuridão desenhada por cima da cena: um círculo de luz em volta do mergulhador. */
export const DARKNESS = {
  color: "2, 5, 11",
  /** Opacidade da escuridão com luz 0. */
  maxAlpha: 0.96,
  /** Raio do círculo de luz com luz 1 e com luz 0. */
  lanternMaxPx: 900,
  lanternMinPx: 150,
} as const;

/** Cores da cena que não vêm da paleta dos mapas. */
export const DESCENT_COLORS = {
  /** Parede do fundo do poço, misturada com a rocha do mapa. */
  farWall: "#04080f",
  farWallMix: 0.55,
  /** A parede do fundo some nos últimos px antes da boca de saída. */
  farWallFadePx: 110,
  bubble: "#bfe6ff",
  streak: "#cfeaff",
  hint: "rgba(210,232,255,0.5)",
} as const;
