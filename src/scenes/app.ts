import type { AudioApi } from "../audio/api";
import type { Action } from "../config/input";
import type { Input } from "../core/input";
import type { Settings } from "../core/settings";
import type { SceneManager } from "./manager";

// O que toda cena precisa do resto do programa. Cria-se um só, em `main.ts`, e passa-se adiante
// (em vez de cada cena receber cinco argumentos).

export interface DebugFlags {
  readonly enabled: boolean;
}

export interface App {
  readonly input: Input<Action>;
  readonly scenes: SceneManager;
  readonly debug: DebugFlags;
  readonly settings: Settings;
  /** Efeitos e música. Nos testes, um espião ou o `SilentAudio`. */
  readonly audio: AudioApi;
  /**
   * Semente de uma fase nova. A primeira pode vir da URL (`?seed=`, para reproduzir um mapa);
   * depois, cada fase nova sorteia a sua. "Tentar de novo" não chama isto: reusa a da fase
   * (GDD §2.3).
   */
  nextSeed(): number;
}
