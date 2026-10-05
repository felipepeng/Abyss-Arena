import type { MusicLevel, TrackId } from "../config/music";
import type { SimEvent } from "../sim/events";

// O que o resto do jogo sabe do áudio. As cenas falam com esta interface, e não com o motor de
// Web Audio: assim os testes trocam o motor por um espião, e o jogo roda sem som se o
// navegador não tiver Web Audio.

export type { MusicLevel, TrackId };

/**
 * Sons de interface: navegar e confirmar nos menus, voltar, abrir e fechar a pausa e o cartão
 * com o nome do mapa.
 */
export type UiSound = "move" | "confirm" | "back" | "pause" | "resume" | "title";

export interface AudioApi {
  /** Os eventos da simulação de um passo. O áudio decide quais viram som (GDD §10.1). */
  onEvents(events: readonly SimEvent[]): void;
  /** Som de interface (cliques do menu, pausa, cartão do mapa). */
  ui(kind: UiSound): void;
  /** Toca a trilha (a mesma que já toca continua, sem recomeçar). Volta à intensidade 0. */
  playTrack(track: TrackId): void;
  /** Camada de intensidade da música: ondas (0), chefe (1), última fase do chefe (2). */
  setIntensity(level: MusicLevel): void;
  /** Para a música e o ambiente do mapa (a cena de descida só tem o som da água). */
  stopTrack(): void;
  /**
   * A água do mergulhador na cena de descida, com a velocidade dele de 0 a 1. A primeira chamada
   * começa o som; as seguintes só mudam o `level`, sem corte.
   */
  water(level: number): void;
  /** Some com a água. */
  stopWater(): void;
}

/** Áudio que não faz nada: os testes e o navegador sem Web Audio. */
export class SilentAudio implements AudioApi {
  onEvents(): void {}
  ui(): void {}
  playTrack(): void {}
  setIntensity(): void {}
  stopTrack(): void {}
  water(): void {}
  stopWater(): void {}
}
