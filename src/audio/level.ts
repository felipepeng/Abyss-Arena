import type { MusicLevel } from "../config/music";
import { BOSS_DEFS } from "../sim/bosses/registry";
import type { World } from "../sim/world";

// A intensidade da música numa fase (GDD §10.2): ondas → chefe → última fase do chefe. Lê o
// estado da fase; o áudio nunca escreve na simulação.

export function musicLevel(w: World): MusicLevel {
  const f = w.phase;
  if (!f || w.playerDead) return 0;
  const boss = f.boss;
  if (!boss || boss.dead || (f.state !== "bossIntro" && f.state !== "boss")) return 0;
  // a última fase dele: a 2ª do Caranguejo e da Água-viva, a 3ª do Olho
  return boss.phase >= BOSS_DEFS[boss.kind].phases.length - 1 ? 2 : 1;
}
