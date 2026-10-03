import type { Palette } from "../palette";
import { makeWave, type WaveSpec } from "../waves";

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
  // a parede que a Água-viva quebra na fase 2: violeta escura com rachaduras rosadas
  barrier: { body: "#3d3050", top: "#5b4877", light: "#d6a8ff", crack: "#ff8fc8" },
};

export const CORAL_TITLE = {
  name: "JARDIM DE CORAIS LUMINOSOS",
  depth: "120 m",
  line: "A luz aqui não vem de cima.",
} as const;

/**
 * O tamanho do mapa. A arena desenhada à mão (72 × 45 blocos) fica no meio e é fechada por uma
 * parede quebrável de 2 blocos; em volta há uma câmara de água aberta, com colunas de coral, que
 * a Água-viva revela ao quebrar a parede na fase 2 (GDD §7.2 e §8.2). O chão continua sendo o de
 * baixo, então a câmara cresce para os lados e para cima.
 */
export const CORAL_ARENA = {
  left: 20,
  right: 20,
  top: 24,
  innerCols: 72,
  innerRows: 45,
  /** Espessura da parede quebrável, em blocos (a do layout interno). */
  wall: 2,
  /** A primeira linha do chão, contada dentro da arena interna. */
  floorRow: 40,
} as const;

export const CORAL_PROCEDURAL = {
  // o relevo do chão cresce a partir da última linha `~` acima do chão, agora deslocada pelo topo
  floor: { fromRow: CORAL_ARENA.top + 39, base: 0.8, amp1: 1.0, freq1: 0.27, amp2: 0.6, freq2: 0.57, noise: 0.5 },
  /** Galhos nas colunas: cada um tem 1–2 blocos e ocupa a faixa `~` de 1 bloco ao lado. */
  branches: { count: 40, length: [1, 2] as const },
};

/**
 * Colunas de coral da câmara externa (o padrão "~CC~" das internas: a coluna tem 2 blocos e uma
 * faixa procedural de cada lado, então o vão até a próxima é de 8 blocos de passo). `x` é o
 * primeiro bloco do coral, contado do canto do mapa; `rows` é quantos blocos ela tem de altura.
 * As que sobem do chão dão cobertura ao raio, ao farol e à onda de choque no salão aberto; as
 * que pendem do teto quebram a linha de visão lá em cima.
 */
export const CORAL_OUTER_COLUMNS: readonly { x: number; rows: number; from: "floor" | "ceiling" }[] = [
  // margem esquerda (x 2–19)
  { x: 5, rows: 20, from: "floor" },
  { x: 13, rows: 28, from: "floor" },
  // margem direita (x 92–109)
  { x: 97, rows: 28, from: "floor" },
  { x: 105, rows: 18, from: "floor" },
  // pendurados no teto de cima
  { x: 35, rows: 9, from: "ceiling" },
  { x: 51, rows: 13, from: "ceiling" },
  { x: 67, rows: 10, from: "ceiling" },
  { x: 83, rows: 14, from: "ceiling" },
  // e três menores entre elas (passo de 8 blocos: o vão de 80 px entre corais se mantém)
  { x: 43, rows: 6, from: "ceiling" },
  { x: 59, rows: 5, from: "ceiling" },
  { x: 75, rows: 7, from: "ceiling" },
];

/**
 * Ondas (GDD §3.2 e §3.3). Os totais por tipo são os do GDD; o que muda é como chegam: cada onda é
 * uma sequência de levas (config/waves.ts). As anêmonas ocupam as posições fixas marcadas nos
 * corais (CORAL_ANEMONE_SPOTS).
 */
export const CORAL_WAVES: readonly WaveSpec[] = [
  makeWave("À DERIVA", [
    { enemies: [{ kind: "fish", count: 3 }], pattern: "scatter" },
    { enemies: [{ kind: "jellyling", count: 2 }], pattern: "flank", afterMs: 6500, whenAliveAtMost: 1 },
  ]),
  makeWave("PINÇA", [
    { enemies: [{ kind: "anemone", count: 2 }, { kind: "jellyling", count: 2 }], pattern: "scatter" },
    { enemies: [{ kind: "fish", count: 2 }, { kind: "circler", count: 2 }], pattern: "pincer", afterMs: 9000, whenAliveAtMost: 2 },
  ]),
  makeWave("MARÉ", [
    { enemies: [{ kind: "anemone", count: 3 }, { kind: "jellyling", count: 3 }], pattern: "scatter" },
    { enemies: [{ kind: "fish", count: 3 }], pattern: "flank", afterMs: 8000, whenAliveAtMost: 3 },
    { enemies: [{ kind: "circler", count: 3 }], pattern: "ring", afterMs: 9000, whenAliveAtMost: 2 },
  ]),
];

