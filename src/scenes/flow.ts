import type { MapDef } from "../world/mapdef";
import { ABYSS } from "../world/maps/abyss";
import { CORAL } from "../world/maps/coral";
import { RIFT } from "../world/maps/rift";

// Fluxo entre as fases (GDD §2.1). A Descida é uma sequência fixa; a Arena livre joga um mapa
// só. A sessão da Descida vive fora do `World`, que é recriado a cada fase e a cada tentativa.

/** A sequência da Descida (GDD §2.1). */
export const DESCENT: readonly MapDef[] = [RIFT, CORAL, ABYSS];

/** Tempo e mortes de uma Descida, do primeiro passo do Leito ao último do Fosso. */
export interface DescentSession {
  /** Soma dos passos jogados, mortes e recomeços incluídos. A pausa não conta. */
  timeMs: number;
  deaths: number;
}

export const newSession = (): DescentSession => ({ timeMs: 0, deaths: 0 });

/** Como a fase foi iniciada, e portanto para onde ir quando ela acaba. */
export type Flow =
  | { kind: "descent"; session: DescentSession }
  | { kind: "free" }
  /** A arena de teste do M1–M2 (`?arena=test`): não tem fim de fase. */
  | { kind: "test" };

/** O mapa que vem depois de `map` na Descida, ou null se ele for o último. */
export function nextInDescent(map: MapDef): MapDef | null {
  const i = DESCENT.indexOf(map);
  return i >= 0 ? (DESCENT[i + 1] ?? null) : null;
}

/** m:ss (ou h:mm:ss, se passar de uma hora). */
export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
