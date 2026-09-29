// Câmera (CONTEXTO §3.4). A suavização é por passo fixo, então não depende da taxa de quadros.

export const CAMERA = {
  /** Fração da distância ao alvo percorrida a cada passo. */
  lerp: 0.12,
  /** Quanto a câmera antecipa na direção da mira: você vê para onde olha, não onde está. */
  lookAhead: 60,
} as const;
