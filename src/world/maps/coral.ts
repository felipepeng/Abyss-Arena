import { CORAL_PALETTE, CORAL_PROCEDURAL, CORAL_TITLE, CORAL_WAVES } from "../../config/maps/coral";
import type { MapDef } from "../mapdef";

// Jardim de Corais Luminosos — Água-viva (GDD §7.2). 72 × 45 blocos = 1440 × 900 px.
//
// Um recife bioluminescente: colunas de coral ('C') atravessam a água e formam corredores.
// - As colunas são a SOMBRA do raio giratório: a posição delas decide onde é seguro. Os
//   corredores entre elas têm 6 blocos, e os galhos procedurais ('~', 1 bloco de cada lado)
//   deixam pelo menos 4 (80 px).
// - Área aberta no alto do centro (colunas 22–49, linhas 4–20), onde a Água-viva flutua.
// - Tocas de enguia marcadas nas faces das colunas (as enguias entram no M5).
// - 4 zonas de nascimento em água fixa.

const LAYOUT = [
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

export const CORAL: MapDef = {
  id: "coral",
  layout: LAYOUT,
  markers: {
    playerStart: { x: 24, y: 30 },
    bossSpawn: { x: 36, y: 10 },
    spawnZones: [
      { x: 20, y: 3, w: 4, h: 4 }, // alto, esquerda
      { x: 48, y: 3, w: 4, h: 4 }, // alto, direita
      { x: 3, y: 28, w: 4, h: 6 }, // esquerda
      { x: 65, y: 28, w: 4, h: 6 }, // direita
    ],
    fixedEnemies: [],
    eelDens: [
      { x: 10, y: 20 },
      { x: 16, y: 30 },
      { x: 26, y: 33 },
      { x: 45, y: 33 },
      { x: 55, y: 30 },
      { x: 61, y: 20 },
    ],
  },
  procedural: CORAL_PROCEDURAL,
  palette: CORAL_PALETTE,
  titleCard: CORAL_TITLE,
  waves: CORAL_WAVES,
  boss: "jelly",
};
