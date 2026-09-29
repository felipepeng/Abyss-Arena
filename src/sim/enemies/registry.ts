import { CIRCLER_DEF } from "./circler";
import { DUMMY_BIG_DEF, DUMMY_DEF } from "./dummy";
import { EEL_DEF } from "./eel";
import { FISH_DEF } from "./fish";
import { HERMIT_DEF } from "./hermit";
import { JELLYLING_DEF } from "./jellyling";
import { LAMPREY_DEF } from "./lamprey";
import { URCHIN_DEF } from "./urchin";
import { WATCHER_DEF } from "./watcher";
import type { EnemyDef, EnemyKind } from "./types";

// Todos os tipos de inimigo. Um tipo novo é um arquivo novo e uma linha aqui; o runner não
// muda.

export const ENEMY_DEFS: Readonly<Record<EnemyKind, EnemyDef>> = {
  fish: FISH_DEF,
  circler: CIRCLER_DEF,
  dummy: DUMMY_DEF,
  dummyBig: DUMMY_BIG_DEF,
  hermit: HERMIT_DEF,
  urchin: URCHIN_DEF,
  jellyling: JELLYLING_DEF,
  eel: EEL_DEF,
  watcher: WATCHER_DEF,
  lamprey: LAMPREY_DEF,
};
