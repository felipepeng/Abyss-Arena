import type { MusicLevel, TrackId } from "../config/music";
import type { SimEvent } from "../sim/events";

// O que o resto do jogo sabe do áudio. As cenas falam com esta interface, e não com o motor de
// Web Audio: assim os testes trocam o motor por um espião, e o jogo roda sem som se o
// navegador não tiver Web Audio.

export type { MusicLevel, TrackId };

export type UiSound = "move" | "confirm";

export interface AudioApi {
  /** Os eventos da simulação de um passo. O áudio decide quais viram som (GDD §10.1). */
  onEvents(events: readonly SimEvent[]): void;
  /** Clique do menu ao navegar e ao confirmar. */
  ui(kind: UiSound): void;
  /** Toca a trilha (a mesma que já toca continua, sem recomeçar). Volta à intensidade 0. */
  playTrack(track: TrackId): void;
  /** Camada de intensidade da música: ondas (0), chefe (1), última fase do chefe (2). */
  setIntensity(level: MusicLevel): void;
}

/** Áudio que não faz nada: os testes e o navegador sem Web Audio. */
export class SilentAudio implements AudioApi {
  onEvents(): void {}
  ui(): void {}
  playTrack(): void {}
  setIntensity(): void {}
}
