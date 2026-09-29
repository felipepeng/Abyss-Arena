// Áudio (GDD §10, ARCHITECTURE §8). Volumes da sessão e números do motor. Os sons em si estão em
// `sfx.ts` e as trilhas em `music.ts`.

export const AUDIO = {
  defaultMusic: 0.7,
  defaultSfx: 0.7,
  /** Passo de cada toque nos controles de volume. */
  step: 0.1,
  /**
   * O volume do menu é linear (0–100%), mas o ouvido não: o ganho é `volume ^ curve`, para o
   * meio do controle soar como o meio.
   */
  volumeCurve: 2,
  /** Ganho geral, antes do compressor: folga para vários sons ao mesmo tempo. */
  masterGain: 0.8,
  /** Suaviza a troca de volume (constante de tempo de `setTargetAtTime`). */
  volumeSmoothingS: 0.03,
  /** Compressor no fim da cadeia: segura os picos de um enxame de sons. */
  compressor: { threshold: -18, knee: 12, ratio: 5, attack: 0.004, release: 0.2 },
  /** Efeitos ao mesmo tempo. Os sons de prioridade (`priority`) passam do teto. */
  maxVoices: 24,
  /** Duração do ruído branco reaproveitado por todos os sons de ruído. */
  noiseSeconds: 2,
  /** Pequena variação aleatória de altura por disparo, ±5% (GDD §10.1). */
  pitchVariation: 0.05,
  /** Fim suave de um som cortado (o tom da carga quando a estocada sai). */
  releaseS: 0.04,
  /** Trocar de trilha: quanto a antiga leva para sumir. */
  trackFadeMs: 900,
  /** Começo da trilha nova. */
  trackFadeInS: 1.2,
} as const;
