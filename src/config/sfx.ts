// Efeitos sonoros (GDD §10.1): cada som é uma lista de camadas sintetizadas na hora, sem
// nenhum arquivo. Uma camada é um oscilador ou ruído branco, com um envelope (ataque rápido,
// decaimento exponencial) e, se quiser, um filtro. As frequências vão do primeiro valor ao
// segundo em rampa exponencial: é como o "tom descendente" de um golpe ou o "sopro" que sobe.
//
// Todos os sons de um disparo compartilham a mesma variação de altura (±5%), então um acorde
// continua afinado.

export interface SfxLayer {
  kind: "osc" | "noise";
  /** Só para \`osc\`. */
  wave?: "sine" | "square" | "sawtooth" | "triangle";
  /** Início e fim da frequência, em Hz (rampa exponencial). Ignorado no ruído. */
  freq?: readonly [number, number];
  durMs: number;
  /** Quanto depois do disparo a camada começa. */
  delayMs?: number;
  /** Pico do envelope, de 0 a 1. */
  gain: number;
  /** Subida até o pico (padrão: 4 ms). Um ataque longo faz um som "crescente". */
  attackMs?: number;
  filter?: { type: "lowpass" | "highpass" | "bandpass"; freq: readonly [number, number]; q?: number };
}

export interface SfxDef {
  layers: readonly SfxLayer[];
  /** Menor intervalo entre dois disparos, ms. Segura enxames (mortes, estouros). */
  minGapMs?: number;
  /** Passa do teto de vozes: sons que o jogador não pode perder (dano, morte do chefe). */
  priority?: boolean;
}

/** Sons de aviso de chefe: um por tipo de ataque (GDD §10.1), graves e reconhecíveis. */
export const WARN_KEYS = [
  "warn.crab.dash",
  "warn.crab.pinch",
  "warn.crab.call",
  "warn.jelly.ring",
  "warn.jelly.beam",
  "warn.jelly.pull",
  "warn.jelly.shock",
  "warn.jelly.call",
  "warn.jelly.lighthouse",
  "warn.eye.fan",
  "warn.eye.spiral",
  "warn.eye.siege",
  "warn.eye.seek",
  "warn.eye.rain",
] as const;

export type SfxName =
  | "thrust"
  | "charge"
  | "hit"
  | "pop"
  | "block"
  | "dash"
  | "hurt"
  | "playerDie"
  | "pickup"
  | "enemyDie"
  | "bossAppear"
  | "bossPhase"
  | "bossImpact"
  | "arenaBreak"
  | "bossDie"
  | "menuMove"
  | "menuConfirm"
  | "menuBack"
  | "pause"
  | "resume"
  | "mapTitle"
  | "dashReady"
  | "waveClear"
  | "phaseClear"
  | "defeat"
  | "bossStart"
  | "stoneCrumble"
  | "rockChip"
  | "pullWhoosh"
  | (typeof WARN_KEYS)[number];

export const SFX: Readonly<Record<SfxName, SfxDef>> = {
  // sopro curto, filtrado
  thrust: {
    layers: [{ kind: "noise", gain: 0.9, durMs: 140, attackMs: 14, filter: { type: "bandpass", freq: [900, 2400], q: 1.2 } }],
  },
  // tom ascendente que sobe durante a carga e para no máximo (600 ms). Entra em silêncio, então
  // um toque rápido de ataque não o faz soar.
  charge: {
    layers: [{ kind: "osc", wave: "triangle", freq: [220, 880], gain: 0.16, durMs: 620, attackMs: 320 }],
  },
  // baque grave e macio: o impacto vem do grave que cai rápido de altura, não de um estalo agudo.
  // Um acerto acontece várias vezes por segundo, então nada aqui é áspero (sem onda quadrada nem
  // ruído agudo) e o pico é baixo.
  hit: {
    priority: true,
    minGapMs: 45,
    layers: [
      { kind: "osc", wave: "sine", freq: [130, 52], gain: 0.42, durMs: 200, attackMs: 5 },
      { kind: "osc", wave: "triangle", freq: [270, 120], gain: 0.15, durMs: 95, attackMs: 3, filter: { type: "lowpass", freq: [900, 500] } },
      { kind: "noise", gain: 0.22, durMs: 60, attackMs: 3, filter: { type: "bandpass", freq: [700, 350], q: 0.9 } },
    ],
  },
  // "plop" agudo
  pop: {
    minGapMs: 28,
    layers: [
      { kind: "osc", wave: "sine", freq: [880, 1500], gain: 0.28, durMs: 75, attackMs: 2 },
      { kind: "noise", gain: 0.1, durMs: 30, attackMs: 1, filter: { type: "highpass", freq: [4200, 4200] } },
    ],
  },
  // "tink" metálico
  block: {
    layers: [
      { kind: "osc", wave: "square", freq: [1900, 1750], gain: 0.2, durMs: 190, attackMs: 1, filter: { type: "highpass", freq: [1200, 1200] } },
      { kind: "osc", wave: "sine", freq: [2860, 2600], gain: 0.16, durMs: 150, attackMs: 1 },
    ],
  },
  // rajada de bolhas: ruído com filtro subindo
  dash: {
    layers: [
      { kind: "noise", gain: 0.9, durMs: 270, attackMs: 20, filter: { type: "bandpass", freq: [400, 2800], q: 1.4 } },
      { kind: "osc", wave: "sine", freq: [190, 130], gain: 0.12, durMs: 200 },
    ],
  },
  // baque abafado + tom descendente
  hurt: {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [190, 58], gain: 0.55, durMs: 280 },
      { kind: "osc", wave: "sawtooth", freq: [310, 110], gain: 0.18, durMs: 300, filter: { type: "lowpass", freq: [600, 300] } },
    ],
  },
  playerDie: {
    priority: true,
    layers: [
      { kind: "osc", wave: "sawtooth", freq: [230, 38], gain: 0.34, durMs: 950, filter: { type: "lowpass", freq: [700, 160] } },
      { kind: "noise", gain: 0.18, durMs: 700, attackMs: 30, filter: { type: "lowpass", freq: [900, 120] } },
    ],
  },
  // acorde curto ascendente (dó, mi, sol)
  pickup: {
    layers: [
      { kind: "osc", wave: "sine", freq: [523, 523], gain: 0.2, durMs: 150 },
      { kind: "osc", wave: "sine", freq: [659, 659], gain: 0.2, durMs: 150, delayMs: 70 },
      { kind: "osc", wave: "sine", freq: [784, 784], gain: 0.22, durMs: 240, delayMs: 140 },
    ],
  },
  // bolhas + tom curto
  enemyDie: {
    minGapMs: 35,
    layers: [
      { kind: "noise", gain: 0.5, durMs: 150, attackMs: 6, filter: { type: "bandpass", freq: [500, 1600], q: 1.1 } },
      { kind: "osc", wave: "sine", freq: [430, 210], gain: 0.24, durMs: 130 },
    ],
  },
  bossAppear: {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [72, 48], gain: 0.5, durMs: 1300, attackMs: 500 },
      { kind: "noise", gain: 0.2, durMs: 1100, attackMs: 600, filter: { type: "lowpass", freq: [200, 90] } },
      // o riser: ruído e um tom grave que sobem até o fim da apresentação (bossIntroMs)
      { kind: "noise", gain: 0.2, durMs: 1500, attackMs: 1300, filter: { type: "bandpass", freq: [160, 3200], q: 1.4 } },
      { kind: "osc", wave: "sawtooth", freq: [60, 240], gain: 0.1, durMs: 1500, attackMs: 1300, filter: { type: "lowpass", freq: [300, 1600] } },
    ],
  },
  // o golpe grave em que a apresentação acaba e a luta começa: o riser de bossAppear cai aqui
  bossStart: {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [95, 32], gain: 0.62, durMs: 800, attackMs: 3 },
      { kind: "noise", gain: 0.42, durMs: 600, attackMs: 3, filter: { type: "lowpass", freq: [1400, 80] } },
      { kind: "osc", wave: "sawtooth", freq: [58, 30], gain: 0.22, durMs: 700, attackMs: 3, filter: { type: "lowpass", freq: [350, 80] } },
    ],
  },
  bossPhase: {
    priority: true,
    layers: [
      { kind: "osc", wave: "sawtooth", freq: [120, 42], gain: 0.42, durMs: 800, filter: { type: "lowpass", freq: [800, 200] } },
      { kind: "noise", gain: 0.24, durMs: 700, attackMs: 40, filter: { type: "bandpass", freq: [700, 120], q: 0.8 } },
    ],
  },
  bossImpact: {
    layers: [{ kind: "osc", wave: "sine", freq: [105, 38], gain: 0.5, durMs: 280 }],
  },
  // a parede cede: um estrondo grave e longo que racha em pedras (ruído filtrado descendo)
  arenaBreak: {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [70, 30], gain: 0.5, durMs: 1500, attackMs: 40 },
      { kind: "noise", gain: 0.45, durMs: 1400, attackMs: 30, filter: { type: "lowpass", freq: [1400, 90] } },
      { kind: "noise", gain: 0.3, durMs: 900, attackMs: 200, delayMs: 200, filter: { type: "bandpass", freq: [900, 260], q: 1.1 } },
    ],
  },
  // explosão grave longa
  bossDie: {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [95, 28], gain: 0.7, durMs: 1500 },
      { kind: "noise", gain: 0.5, durMs: 1500, attackMs: 8, filter: { type: "lowpass", freq: [1000, 70] } },
      { kind: "osc", wave: "sawtooth", freq: [64, 24], gain: 0.28, durMs: 1300, filter: { type: "lowpass", freq: [400, 90] } },
    ],
  },
  // clique suave ao navegar e ao confirmar
  menuMove: {
    layers: [{ kind: "osc", wave: "sine", freq: [660, 640], gain: 0.22, durMs: 60, attackMs: 2 }],
  },
  menuConfirm: {
    layers: [
      { kind: "osc", wave: "sine", freq: [880, 940], gain: 0.26, durMs: 110, attackMs: 2 },
      { kind: "osc", wave: "sine", freq: [1320, 1320], gain: 0.18, durMs: 120, attackMs: 2, delayMs: 50 },
    ],
  },
  // voltar: o clique de confirmar, mas descendo
  menuBack: {
    layers: [
      { kind: "osc", wave: "sine", freq: [740, 600], gain: 0.22, durMs: 100, attackMs: 2 },
      { kind: "osc", wave: "sine", freq: [520, 440], gain: 0.16, durMs: 110, attackMs: 2, delayMs: 45 },
    ],
  },
  // pausa: o mundo abafa (varredura que desce); continuar: ele volta (varredura que sobe)
  pause: {
    layers: [
      { kind: "noise", gain: 0.3, durMs: 260, attackMs: 20, filter: { type: "lowpass", freq: [2600, 260], q: 0.9 } },
      { kind: "osc", wave: "sine", freq: [440, 220], gain: 0.16, durMs: 240, attackMs: 4 },
    ],
  },
  resume: {
    layers: [
      { kind: "noise", gain: 0.3, durMs: 260, attackMs: 20, filter: { type: "lowpass", freq: [260, 2600], q: 0.9 } },
      { kind: "osc", wave: "sine", freq: [220, 440], gain: 0.16, durMs: 240, attackMs: 4 },
    ],
  },
  // o cartão com o nome do mapa: uma nota longa e grave, com um brilho por cima
  mapTitle: {
    layers: [
      { kind: "osc", wave: "sine", freq: [196, 196], gain: 0.2, durMs: 1500, attackMs: 450 },
      { kind: "osc", wave: "triangle", freq: [294, 294], gain: 0.1, durMs: 1300, attackMs: 600 },
      { kind: "osc", wave: "sine", freq: [784, 784], gain: 0.05, durMs: 1000, attackMs: 700 },
    ],
  },

  // --- estado do jogador -------------------------------------------------------------------
  // o dash voltou: um tique agudo e discreto (acontece a cada ~1,3 s de dash seguido)
  dashReady: {
    minGapMs: 300,
    layers: [{ kind: "osc", wave: "sine", freq: [1568, 1568], gain: 0.14, durMs: 90, attackMs: 2 }],
  },

  // --- progresso da fase ---------------------------------------------------------------------
  // onda limpa: um sino ascendente (sol, ré, sol), mais grave e mais longo que a cura
  waveClear: {
    layers: [
      { kind: "osc", wave: "sine", freq: [392, 392], gain: 0.2, durMs: 320 },
      { kind: "osc", wave: "sine", freq: [587, 587], gain: 0.2, durMs: 320, delayMs: 110 },
      { kind: "osc", wave: "sine", freq: [784, 784], gain: 0.22, durMs: 460, delayMs: 220 },
      { kind: "osc", wave: "sine", freq: [1568, 1568], gain: 0.05, durMs: 320, delayMs: 220 },
    ],
  },
  // fase concluída: uma fanfarra curta (dó, mi, sol e o acorde), depois do estrondo do chefe
  phaseClear: {
    priority: true,
    layers: [
      { kind: "osc", wave: "triangle", freq: [523, 523], gain: 0.2, durMs: 190, delayMs: 600 },
      { kind: "osc", wave: "triangle", freq: [659, 659], gain: 0.2, durMs: 190, delayMs: 760 },
      { kind: "osc", wave: "triangle", freq: [784, 784], gain: 0.2, durMs: 190, delayMs: 920 },
      { kind: "osc", wave: "triangle", freq: [1047, 1047], gain: 0.22, durMs: 500, delayMs: 1080 },
      { kind: "osc", wave: "triangle", freq: [784, 784], gain: 0.16, durMs: 500, delayMs: 1080 },
      { kind: "osc", wave: "sine", freq: [659, 659], gain: 0.16, durMs: 500, delayMs: 1080 },
    ],
  },
  // derrota: um acorde menor que afunda, logo depois do baque da morte
  defeat: {
    priority: true,
    layers: [
      { kind: "osc", wave: "triangle", freq: [220, 165], gain: 0.22, durMs: 900, attackMs: 60, delayMs: 350, filter: { type: "lowpass", freq: [900, 300] } },
      { kind: "osc", wave: "triangle", freq: [262, 196], gain: 0.2, durMs: 900, attackMs: 60, delayMs: 350, filter: { type: "lowpass", freq: [900, 300] } },
      { kind: "osc", wave: "triangle", freq: [330, 247], gain: 0.18, durMs: 900, attackMs: 60, delayMs: 350, filter: { type: "lowpass", freq: [900, 300] } },
    ],
  },

  // --- cenário -------------------------------------------------------------------------------
  // um bloco de pilar se solta: um estalo seco e um baque curto de pedra (vários seguidos ao ruir)
  stoneCrumble: {
    minGapMs: 70,
    layers: [
      { kind: "noise", gain: 0.3, durMs: 170, attackMs: 3, filter: { type: "bandpass", freq: [900, 300], q: 1.1 } },
      { kind: "osc", wave: "sine", freq: [140, 70], gain: 0.18, durMs: 140, attackMs: 3 },
    ],
  },
  // a rocha lasca com a batida de um projétil: bem pequeno, acontece muito no Olho
  rockChip: {
    minGapMs: 110,
    layers: [
      { kind: "noise", gain: 0.16, durMs: 55, attackMs: 2, filter: { type: "bandpass", freq: [1800, 900], q: 1.4 } },
      { kind: "osc", wave: "triangle", freq: [420, 260], gain: 0.1, durMs: 60, attackMs: 2 },
    ],
  },
  // a sucção da Água-viva: uma lufada grave que cada bolha da corrente repete, com o corte subindo
  pullWhoosh: {
    minGapMs: 140,
    layers: [
      { kind: "noise", gain: 0.14, durMs: 420, attackMs: 110, filter: { type: "bandpass", freq: [250, 800], q: 0.9 } },
      { kind: "osc", wave: "sine", freq: [120, 80], gain: 0.08, durMs: 380, attackMs: 100 },
    ],
  },

  // --- avisos de ataque de chefe: graves, um por tipo ---------------------------------------
  // Caranguejo: a investida sobe (vem aí), a pinça bate duas vezes, o chamado desce em três notas
  "warn.crab.dash": {
    priority: true,
    layers: [{ kind: "osc", wave: "sawtooth", freq: [90, 190], gain: 0.34, durMs: 380, attackMs: 60, filter: { type: "lowpass", freq: [500, 900] } }],
  },
  "warn.crab.pinch": {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [115, 80], gain: 0.5, durMs: 130 },
      { kind: "osc", wave: "sine", freq: [115, 80], gain: 0.5, durMs: 130, delayMs: 160 },
    ],
  },
  "warn.crab.call": {
    priority: true,
    layers: [
      { kind: "osc", wave: "triangle", freq: [230, 215], gain: 0.3, durMs: 120 },
      { kind: "osc", wave: "triangle", freq: [185, 172], gain: 0.3, durMs: 120, delayMs: 130 },
      { kind: "osc", wave: "triangle", freq: [150, 140], gain: 0.3, durMs: 160, delayMs: 260 },
    ],
  },
  // Água-viva: o anel é um pulso que vibra (dois tons desafinados), o raio sobe carregando, a
  // sucção é um sopro grave que afunda
  "warn.jelly.ring": {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [160, 160], gain: 0.3, durMs: 520, attackMs: 40 },
      { kind: "osc", wave: "sine", freq: [166, 166], gain: 0.3, durMs: 520, attackMs: 40 },
    ],
  },
  "warn.jelly.beam": {
    priority: true,
    layers: [{ kind: "osc", wave: "sawtooth", freq: [70, 280], gain: 0.3, durMs: 800, attackMs: 560, filter: { type: "lowpass", freq: [400, 900] } }],
  },
  "warn.jelly.pull": {
    priority: true,
    layers: [
      { kind: "noise", gain: 0.3, durMs: 560, attackMs: 200, filter: { type: "lowpass", freq: [420, 140] } },
      { kind: "osc", wave: "sine", freq: [95, 55], gain: 0.34, durMs: 560 },
    ],
  },
  // a onda de choque inspira (um som grave que sobe e se contrai) e solta um baque; o chamado
  // sobe em três notas (o do Caranguejo desce); o farol é uma sirene grave que vai subindo
  "warn.jelly.shock": {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [260, 90], gain: 0.3, durMs: 780, attackMs: 400 },
      { kind: "osc", wave: "triangle", freq: [120, 60], gain: 0.2, durMs: 220, delayMs: 620 },
    ],
  },
  "warn.jelly.call": {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [300, 320], gain: 0.26, durMs: 130 },
      { kind: "osc", wave: "sine", freq: [370, 390], gain: 0.26, durMs: 130, delayMs: 150 },
      { kind: "osc", wave: "sine", freq: [460, 480], gain: 0.26, durMs: 200, delayMs: 300 },
    ],
  },
  "warn.jelly.lighthouse": {
    priority: true,
    layers: [
      { kind: "osc", wave: "sawtooth", freq: [90, 200], gain: 0.26, durMs: 940, attackMs: 620, filter: { type: "lowpass", freq: [450, 900] } },
      { kind: "osc", wave: "sine", freq: [52, 52], gain: 0.3, durMs: 900, attackMs: 300 },
    ],
  },
  // Olho: o leque estala, a espiral gira (dois tons subindo), o cerco pulsa três vezes, os
  // perseguidores pingam, a chuva vem de cima
  "warn.eye.fan": {
    priority: true,
    layers: [
      { kind: "osc", wave: "square", freq: [150, 110], gain: 0.2, durMs: 230, filter: { type: "lowpass", freq: [700, 400] } },
      { kind: "osc", wave: "sine", freq: [75, 55], gain: 0.4, durMs: 260 },
    ],
  },
  "warn.eye.spiral": {
    priority: true,
    layers: [
      { kind: "osc", wave: "sine", freq: [100, 210], gain: 0.3, durMs: 560, attackMs: 200 },
      { kind: "osc", wave: "sine", freq: [104, 218], gain: 0.3, durMs: 560, attackMs: 200 },
    ],
  },
  "warn.eye.siege": {
    priority: true,
    layers: [
      { kind: "osc", wave: "sawtooth", freq: [62, 58], gain: 0.34, durMs: 170, filter: { type: "lowpass", freq: [300, 300] } },
      { kind: "osc", wave: "sawtooth", freq: [62, 58], gain: 0.34, durMs: 170, delayMs: 200, filter: { type: "lowpass", freq: [300, 300] } },
      { kind: "osc", wave: "sawtooth", freq: [62, 58], gain: 0.4, durMs: 260, delayMs: 400, filter: { type: "lowpass", freq: [300, 300] } },
    ],
  },
  "warn.eye.seek": {
    priority: true,
    layers: [
      { kind: "osc", wave: "triangle", freq: [320, 170], gain: 0.28, durMs: 180 },
      { kind: "osc", wave: "triangle", freq: [320, 170], gain: 0.28, durMs: 180, delayMs: 210 },
    ],
  },
  "warn.eye.rain": {
    priority: true,
    layers: [
      { kind: "noise", gain: 0.26, durMs: 620, attackMs: 80, filter: { type: "bandpass", freq: [2600, 420], q: 0.9 } },
      { kind: "osc", wave: "sine", freq: [82, 82], gain: 0.3, durMs: 560, attackMs: 100 },
    ],
  },
};
