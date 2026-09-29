import type { Palette } from "../palette";

// Jardim de Corais Luminosos (GDD §7.2, 🟡 proposta): números de ajuste do mapa. A estrutura
// desenhada está em world/maps/coral.ts.

export const CORAL_PALETTE: Palette = {
  bg: ["#0f3a4a", "#082634", "#031219"],
  // a luz aqui não vem de cima
  light: null,
  rockBody: "#2c4a5a",
  rockTop: "#3f7f7a",
  rockLight: "#ff8fc8",
  rockShadow: "rgba(0,0,0,0.2)",
};

export const CORAL_TITLE = {
  name: "JARDIM DE CORAIS LUMINOSOS",
  depth: "120 m",
  line: "A luz aqui não vem de cima.",
} as const;

export const CORAL_PROCEDURAL = {
  floor: { fromRow: 39, base: 0.8, amp1: 1.0, freq1: 0.27, amp2: 0.6, freq2: 0.57, noise: 0.5 },
  /** Galhos nas colunas: cada um tem 1–2 blocos e ocupa a faixa `~` de 1 bloco ao lado. */
  branches: { count: 22, length: [1, 2] as const },
};

/**
 * Ondas (GDD §3.2, 🟡). O GDD pede também medusinhas (todas as ondas) e enguias (ondas 2 e 3),
 * que entram no M5. Até lá, as ondas têm só peixes e circuladores.
 */
export const CORAL_WAVES = [
  { enemies: [{ kind: "fish", count: 3 }] },
  { enemies: [{ kind: "fish", count: 2 }, { kind: "circler", count: 2 }] },
  { enemies: [{ kind: "fish", count: 3 }, { kind: "circler", count: 3 }] },
] as const;
