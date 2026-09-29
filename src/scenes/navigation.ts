import type { MapDef } from "../world/mapdef";
import type { App } from "./app";
import { ArenaSelectScene } from "./arenaSelect";
import { DESCENT, newSession, nextInDescent, type DescentSession } from "./flow";
import { GameScene, type GameParams } from "./game";
import { showFinal } from "./results";
import { TitleScene } from "./title";

// Para onde cada saída leva (GDD §2 e §11). Toda troca passa pelo `SceneManager`, então tem
// fade. Ficam num lugar só porque as telas de resultado, a pausa e o título precisam das
// mesmas saídas, e assim nenhuma delas conhece as outras.

export function goToTitle(app: App): void {
  app.scenes.resetTo(new TitleScene(app));
}

export function goToArenaSelect(app: App): void {
  app.scenes.resetTo(new ArenaSelectScene(app));
}

/** Começa a Descida do Leito, com a sessão zerada. */
export function startDescent(app: App): void {
  const first = DESCENT[0];
  if (!first) return;
  app.scenes.resetTo(
    new GameScene(app, { mode: { kind: "map", map: first }, seed: app.nextSeed(), flow: { kind: "descent", session: newSession() } }),
  );
}

/** Arena livre: um mapa só, semente nova. */
export function startFree(app: App, map: MapDef): void {
  app.scenes.resetTo(new GameScene(app, { mode: { kind: "map", map }, seed: app.nextSeed(), flow: { kind: "free" } }));
}

/** "Tentar de novo": a mesma fase, do começo, com a MESMA semente (GDD §2.3). */
export function retry(app: App, params: GameParams): void {
  app.scenes.resetTo(new GameScene(app, params));
}

/** Depois de "FASE CONCLUÍDA" na Descida: o próximo mapa, ou a tela final. */
export function continueDescent(app: App, params: GameParams, session: DescentSession): void {
  const map = params.mode.kind === "map" ? nextInDescent(params.mode.map) : null;
  if (!map) {
    showFinal(app, session);
    return;
  }
  app.scenes.resetTo(new GameScene(app, { mode: { kind: "map", map }, seed: app.nextSeed(), flow: { kind: "descent", session } }));
}
