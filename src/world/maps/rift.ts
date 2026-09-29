import { RIFT_PALETTE, RIFT_PROCEDURAL, RIFT_TITLE, RIFT_WAVES } from "../../config/maps/rift";
import type { MapDef, TilePt } from "../mapdef";

// Leito das Fendas — Caranguejo (GDD §7.1). 72 × 40 blocos = 1440 × 800 px.
//
// Um leito raso, largo e plano no centro, cercado de formações rochosas grossas:
// - área central aberta (colunas 21–50, linhas 11–27), onde o Caranguejo nasce e tem espaço
//   para investir; as formações ficam a menos de 520 px dali, então a investida BATE nelas e
//   deixa o chefe exposto, como na caverna do protótipo;
// - 5 formações protegidas ('P'): quatro nos cantos do centro e uma pendurada no teto;
// - 2 fendas no chão (colunas 14–15 e 56–57), com 2 blocos (40 px) de largura: o jogador
//   (colisão de 15 px) entra; o Caranguejo (46 px) não. A pinça alcança, a investida não;
// - 4 zonas de nascimento nas bordas, sempre em água fixa;
// - '~': teto, chão e laterais, onde o procedural põe relevo, estalactites e blobs.

const LAYOUT = [
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", //  0
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", //  1
  "PP~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~PP", //  2
  "PP~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~PP", //  3
  "PP~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~PP", //  4
  "PP~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~.PPPPPP.~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~PP", //  5
  "PP~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~PPPPPPPP~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~PP", //  6
  "PP~~~~..........................PPPPPPPP..........................~~~~PP", //  7
  "PP~~~~...........................PPPPPP...........................~~~~PP", //  8
  "PP~~~~..PPPPP..............................................PPPPP..~~~~PP", //  9
  "PP~~~~.PPPPPPP............................................PPPPPPP.~~~~PP", // 10
  "PP~~~~.PPPPPPP............................................PPPPPPP.~~~~PP", // 11
  "PP~~~~.PPPPPPP............................................PPPPPPP.~~~~PP", // 12
  "PP~~~~.PPPPPPP............................................PPPPPPP.~~~~PP", // 13
  "PP~~~~..PPPPP..............................................PPPPP..~~~~PP", // 14
  "PP~~~~............................................................~~~~PP", // 15
  "PP~..................................................................~PP", // 16
  "PP~..................................................................~PP", // 17
  "PP~..................................................................~PP", // 18
  "PP~..................................................................~PP", // 19
  "PP~..................................................................~PP", // 20
  "PP~~~~............................................................~~~~PP", // 21
  "PP~~~~...PPPP..............................................PPPP...~~~~PP", // 22
  "PP~~~~..PPPPPP............................................PPPPPP..~~~~PP", // 23
  "PP~~~~..PPPPPP............................................PPPPPP..~~~~PP", // 24
  "PP~~~~..PPPPPP............................................PPPPPP..~~~~PP", // 25
  "PP~~~~..PPPPPP............................................PPPPPP..~~~~PP", // 26
  "PP~~~~...PPPP..............................................PPPP...~~~~PP", // 27
  "PP~~~~............................................................~~~~PP", // 28
  "PP~~~~............................................................~~~~PP", // 29
  "PP~~~~~~~~~~......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~......~~~~~~~~~~PP", // 30
  "PP~~~~~~~~~~......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~......~~~~~~~~~~PP", // 31
  "PP~~~~~~~~~~......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~......~~~~~~~~~~PP", // 32
  "PP~~~~~~~~~~......~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~......~~~~~~~~~~PP", // 33
  "PPPPPPPPPPPPPP..PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..PPPPPPPPPPPPPP", // 34
  "PPPPPPPPPPPPPP..PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..PPPPPPPPPPPPPP", // 35
  "PPPPPPPPPPPPPP..PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..PPPPPPPPPPPPPP", // 36
  "PPPPPPPPPPPPPP..PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP..PPPPPPPPPPPPPP", // 37
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", // 38
  "PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP", // 39
];

/** Posições dos ouriços, perto das formações. Os ouriços entram no M5. */
export const RIFT_URCHIN_SPOTS: readonly TilePt[] = [
  { x: 15, y: 12 },
  { x: 56, y: 12 },
  { x: 15, y: 25 },
  { x: 56, y: 25 },
];

export const RIFT: MapDef = {
  id: "rift",
  layout: LAYOUT,
  markers: {
    playerStart: { x: 19, y: 19 },
    bossSpawn: { x: 40, y: 19 },
    spawnZones: [
      { x: 3, y: 16, w: 3, h: 5 }, // esquerda
      { x: 66, y: 16, w: 3, h: 5 }, // direita
      { x: 44, y: 8, w: 7, h: 3 }, // alto
      { x: 30, y: 27, w: 11, h: 3 }, // baixo
    ],
    fixedEnemies: [],
    eelDens: [],
  },
  procedural: RIFT_PROCEDURAL,
  palette: RIFT_PALETTE,
  titleCard: RIFT_TITLE,
  waves: RIFT_WAVES,
  boss: "crab",
};
