import type { BossKind } from "../../config/kinds";
import type { MapDef } from "../mapdef";
import { ABYSS } from "./abyss";
import { CORAL } from "./coral";
import { RIFT } from "./rift";

// Os 3 mapas por nome (`?map=` na URL, até existirem os menus do M6) e o mapa de cada chefe.

export const MAPS: Readonly<Record<string, MapDef>> = { rift: RIFT, coral: CORAL, abyss: ABYSS };

/** Cada chefe mora no próprio mapa (GDD §2.2): escolher o chefe escolhe o mapa. */
export function mapOfBoss(boss: BossKind): MapDef {
  return Object.values(MAPS).find((m) => m.boss === boss) ?? RIFT;
}
