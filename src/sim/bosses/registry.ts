import { CRAB_DEF } from "./crab";
import type { BossDef, BossKind } from "./types";

// Todos os chefes. Um chefe novo é um arquivo novo e uma linha aqui; o runner não muda.

export const BOSS_DEFS: Readonly<Record<BossKind, BossDef>> = {
  crab: CRAB_DEF,
};
