import type { BossKind, EnemyKind } from "../config/kinds";
import type { Palette } from "../config/palette";

// Formato do mapa híbrido (ARCHITECTURE §6.3): a estrutura é desenhada à mão em ASCII e os
// detalhes são procedurais com semente, SÓ nas células marcadas com `~`.
//
// Legenda do layout:
//   '#' rocha comum (a erosão pode destruir)
//   'P' rocha protegida (borda e estrutura: a erosão nunca destrói)
//   'C' coral (sólido, visual próprio)
//   '.' água fixa
//   '~' água onde o procedural pode pôr detalhes

export type MapId = "rift" | "coral" | "abyss";

/** Em blocos. */
export interface TilePt {
  x: number;
  y: number;
}

/** Em blocos: canto superior esquerdo e tamanho. */
export interface TileRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WaveDef {
  enemies: readonly { kind: EnemyKind; count: number }[];
}

/** Relevo por soma de senos: profundidade = base + a1·sen(f1·x + fase1) + a2·sen(f2·x + fase2) ± ruído. */
export interface ReliefParams {
  base: number;
  amp1: number;
  freq1: number;
  amp2: number;
  freq2: number;
  noise: number;
}

/** Tudo opcional: cada mapa usa só o que faz sentido para ele. */
export interface ProceduralParams {
  /** Relevo do teto, crescendo para baixo a partir de `fromRow`. */
  ceiling?: ReliefParams & { fromRow: number };
  /** Relevo do chão, crescendo para cima a partir de `fromRow`. */
  floor?: ReliefParams & { fromRow: number };
  /** Colunas penduradas no teto (ou erguidas do chão). */
  stalactites?: { count: number; length: readonly [number, number]; fromTopChance: number };
  /** Galhos de coral: 1–2 blocos crescendo de lado a partir de uma coluna, em células `~`. */
  branches?: { count: number; length: readonly [number, number] };
  /** Irregularidade da borda dos pilares (Fosso). */
  pillarEdgeNoise?: number;
  /** Blobs elípticos de rocha, só em células `~`. */
  blobs?: {
    count: readonly [number, number];
    rx: readonly [number, number];
    ry: readonly [number, number];
    /** Irregularidade da borda do blob. */
    edgeNoise: number;
  };
}

export interface MapDef {
  id: MapId;
  /** Linhas do mesmo comprimento; o tamanho do mapa sai daqui. */
  layout: readonly string[];
  markers: {
    playerStart: TilePt;
    bossSpawn: TilePt;
    /** Onde as ondas nascem (GDD §3.1). Precisam ser água. */
    spawnZones: readonly TileRect[];
    /**
     * Posições fixas dos inimigos estáticos das ondas (Ouriços). Não nascem com o mapa: a onda
     * que os lista ocupa uma dessas posições, livre e longe do jogador.
     */
    fixedEnemies: readonly { kind: EnemyKind; at: TilePt }[];
    /** Tocas de enguia: onde as enguias das ondas nascem e para onde voltam. */
    eelDens: readonly TilePt[];
    /**
     * Pilares dissolvíveis (Fosso): centro e raios em blocos. A forma é desenhada (aprendível);
     * a borda ganha uma variação procedural pequena. Precisam estar em células `~`.
     */
    pillars?: readonly { x: number; y: number; rx: number; ry: number }[];
  };
  procedural: ProceduralParams;
  palette: Palette;
  titleCard: { name: string; depth: string; line: string };
  waves: readonly WaveDef[];
  boss: BossKind;
}
