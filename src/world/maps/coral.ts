import {
  CORAL_ARENA,
  CORAL_OUTER_COLUMNS,
  CORAL_PALETTE,
  CORAL_PROCEDURAL,
  CORAL_TITLE,
  CORAL_WAVES,
} from "../../config/maps/coral";
import type { MapDef, TilePt, TileRect } from "../mapdef";

// Jardim de Corais Luminosos — Água-viva (GDD §7.2). 112 × 69 blocos = 2240 × 1380 px: a arena
// desenhada à mão (72 × 45) no meio, fechada por uma parede quebrável ('B'), e em volta uma câmara
// de água aberta com colunas de coral. A Água-viva quebra a parede ao entrar na fase 2 (§8.2).
// O que está descrito abaixo é a arena interna, sem mudança.
//
// Um recife bioluminescente: colunas de coral ('C') atravessam a água e formam corredores.
// - As colunas são a SOMBRA do raio giratório: a posição delas decide onde é seguro. Os
//   corredores entre elas têm 6 blocos, e os galhos procedurais ('~', 1 bloco de cada lado)
//   deixam pelo menos 4 (80 px).
// - Área aberta no alto do centro (colunas 22–49, linhas 4–20), onde a Água-viva flutua.
// - Tocas de enguia marcadas nas faces das colunas (as enguias entram no M5).
// - 4 zonas de nascimento em água fixa.

const INNER = [
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", //  0
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", //  1
  "PP.........~CC~..........................................~CC~.........PP", //  2
  "PP.........~CC~..........................................~CC~.........PP", //  3
  "PP.........~CC~..........................................~CC~.........PP", //  4
  "PP.........~CC~..........................................~CC~.........PP", //  5
  "PP.........~CC~..........................................~CC~.........PP", //  6
  "PP.........~CC~..........................................~CC~.........PP", //  7
  "PP.........~CC~..........................................~CC~.........PP", //  8
  "PP.........~CC~..........................................~CC~.........PP", //  9
  "PP.........~CC~..........................................~CC~.........PP", // 10
  "PP....................................................................PP", // 11
  "PP....................................................................PP", // 12
  "PP....................................................................PP", // 13
  "PP.....~CC~..................................................~CC~.....PP", // 14
  "PP.....~CC~..................................................~CC~.....PP", // 15
  "PP.....~CC~..................................................~CC~.....PP", // 16
  "PP.....~CC~..................................................~CC~.....PP", // 17
  "PP.....~CC~..................................................~CC~.....PP", // 18
  "PP.....~CC~..................................................~CC~.....PP", // 19
  "PP.....~CC~..................................................~CC~.....PP", // 20
  "PP.....~CC~..................................................~CC~.....PP", // 21
  "PP.....~CC~.....~CC~................................~CC~.....~CC~.....PP", // 22
  "PP.....~CC~.....~CC~................................~CC~.....~CC~.....PP", // 23
  "PP.....~CC~.....~CC~................................~CC~.....~CC~.....PP", // 24
  "PP.....~CC~.....~CC~................................~CC~.....~CC~.....PP", // 25
  "PP.....~CC~.....~CC~................................~CC~.....~CC~.....PP", // 26
  "PP.....~CC~.....~CC~......~CC~............~CC~......~CC~.....~CC~.....PP", // 27
  "PP.....~CC~.....~CC~......~CC~............~CC~......~CC~.....~CC~.....PP", // 28
  "PP.....~CC~.....~CC~......~CC~............~CC~......~CC~.....~CC~.....PP", // 29
  "PP.....~CC~.....~CC~......~CC~............~CC~......~CC~.....~CC~.....PP", // 30
  "PP.....~CC~.....~CC~......~CC~....~CC~....~CC~......~CC~.....~CC~.....PP", // 31
  "PP.....~CC~.....~CC~......~CC~....~CC~....~CC~......~CC~.....~CC~.....PP", // 32
  "PP.....~CC~.....~CC~......~CC~....~CC~....~CC~......~CC~.....~CC~.....PP", // 33
  "PP.....~CC~.....~CC~......~CC~....~CC~....~CC~......~CC~.....~CC~.....PP", // 34
  "PP.....~CC~.....~CC~......~CC~....~CC~....~CC~......~CC~.....~CC~.....PP", // 35
  "PP.....~CC~.....~CC~......~CC~....~CC~....~CC~......~CC~.....~CC~.....PP", // 36
  "PP~~~~~~CC~~~~~~~CC~~~~~~~~CC~~~~~~CC~~~~~~CC~~~~~~~~CC~~~~~~~CC~~~~~~PP", // 37
  "PP~~~~~~CC~~~~~~~CC~~~~~~~~CC~~~~~~CC~~~~~~CC~~~~~~~~CC~~~~~~~CC~~~~~~PP", // 38
  "PP~~~~~~CC~~~~~~~CC~~~~~~~~CC~~~~~~CC~~~~~~CC~~~~~~~~CC~~~~~~~CC~~~~~~PP", // 39
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", // 40
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", // 41
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", // 42
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", // 43
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", // 44
];

const { left: LEFT, right: RIGHT, top: TOP, innerCols: IW, innerRows: IH } = CORAL_ARENA;
const COLS = LEFT + IW + RIGHT;
const ROWS = TOP + IH;
/** A primeira linha do chão, em coordenadas do mapa inteiro. */
const FLOOR = TOP + CORAL_ARENA.floorRow;

/** A arena interna no meio, a parede quebrável em volta dela e a câmara externa em volta. */
function buildLayout(): string[] {
  const g: string[][] = Array.from({ length: ROWS }, () => Array<string>(COLS).fill("."));
  const put = (x: number, y: number, ch: string): void => {
    if (x >= 0 && y >= 0 && x < COLS && y < ROWS) (g[y] as string[])[x] = ch;
  };
  // borda externa, protegida: teto, laterais e o chão de ponta a ponta
  for (let x = 0; x < COLS; x++) for (const y of [0, 1]) put(x, y, "P");
  for (let y = 0; y < ROWS; y++) for (const x of [0, 1, COLS - 2, COLS - 1]) put(x, y, "P");
  for (let y = FLOOR; y < ROWS; y++) for (let x = 0; x < COLS; x++) put(x, y, "P");
  // o relevo do chão da câmara externa: as três linhas de cima do chão são `~` (procedural)
  for (let y = FLOOR - 3; y < FLOOR; y++) {
    for (let x = 2; x < LEFT; x++) put(x, y, "~");
    for (let x = COLS - RIGHT; x < COLS - 2; x++) put(x, y, "~");
  }
  // a arena interna; o que era a borda dela (fora do chão) é a parede quebrável
  INNER.forEach((line, oy) => {
    for (let ox = 0; ox < IW; ox++) {
      const ch = line[ox] ?? ".";
      put(LEFT + ox, TOP + oy, ch === "P" && oy < CORAL_ARENA.floorRow ? "B" : ch);
    }
  });
  // colunas de coral da câmara externa
  for (const c of CORAL_OUTER_COLUMNS) {
    const y0 = c.from === "floor" ? FLOOR - c.rows : 2;
    const y1 = c.from === "floor" ? FLOOR - 1 : 2 + c.rows - 1;
    for (let y = y0; y <= y1; y++) {
      put(c.x - 1, y, "~");
      put(c.x, y, "C");
      put(c.x + 1, y, "C");
      put(c.x + 2, y, "~");
    }
  }
  return g.map((row) => row.join(""));
}

const LAYOUT = buildLayout();
const at = (pt: TilePt): TilePt => ({ x: pt.x + LEFT, y: pt.y + TOP });
const rect = (r: TileRect): TileRect => ({ ...r, x: r.x + LEFT, y: r.y + TOP });

/** Posições das anêmonas, nas faces das colunas de coral da arena interna (GDD §7.2). */
export const CORAL_ANEMONE_SPOTS: readonly TilePt[] = [
  { x: 10, y: 20 },
  { x: 16, y: 30 },
  { x: 26, y: 33 },
  { x: 45, y: 33 },
  { x: 55, y: 30 },
  { x: 61, y: 20 },
].map(at);

export const CORAL: MapDef = {
  id: "coral",
  layout: LAYOUT,
  // as ondas e o começo da luta acontecem só na arena interna; o resto é a câmara fechada
  playArea: { x: LEFT, y: TOP, w: IW, h: IH },
  markers: {
    playerStart: at({ x: 24, y: 30 }),
    bossSpawn: at({ x: 36, y: 10 }),
    spawnZones: [
      rect({ x: 20, y: 3, w: 4, h: 4 }), // alto, esquerda
      rect({ x: 48, y: 3, w: 4, h: 4 }), // alto, direita
      rect({ x: 3, y: 28, w: 4, h: 6 }), // esquerda
      rect({ x: 65, y: 28, w: 4, h: 6 }), // direita
    ],
    // anêmonas presas às faces das colunas: onde a varredura tem o coral atrás e o corredor à frente
    fixedEnemies: CORAL_ANEMONE_SPOTS.map((at) => ({ kind: "anemone" as const, at })),
  },
  procedural: CORAL_PROCEDURAL,
  palette: CORAL_PALETTE,
  titleCard: CORAL_TITLE,
  waves: CORAL_WAVES,
  boss: "jelly",
};
