import { CIRCLER_DEF } from "./circler";
import { DUMMY_BIG_DEF, DUMMY_DEF } from "./dummy";
import { FISH_DEF } from "./fish";
import type { EnemyDef, EnemyKind } from "./types";

// Todos os tipos de inimigo. Um tipo novo é um arquivo novo e uma linha aqui; o runner não
// muda.

export const ENEMY_DEFS: Readonly<Record<EnemyKind, EnemyDef>> = {
  fish: FISH_DEF,
  circler: CIRCLER_DEF,
  dummy: DUMMY_DEF,
  dummyBig: DUMMY_BIG_DEF,
};
