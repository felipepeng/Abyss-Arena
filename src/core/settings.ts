import { AUDIO } from "../config/audio";
import { clamp } from "./math";

// Configurações da sessão. Na v1 não são salvas (GDD §12). O motor de áudio (M7) lê os volumes
// daqui; os menus os alteram.

export class Settings {
  private music: number = AUDIO.defaultMusic;
  private sfx: number = AUDIO.defaultSfx;

  get musicVolume(): number {
    return this.music;
  }

  get sfxVolume(): number {
    return this.sfx;
  }

  setMusicVolume(v: number): void {
    this.music = quantize(v);
  }

  setSfxVolume(v: number): void {
    this.sfx = quantize(v);
  }
}

/** Entre 0 e 1, em passos de `AUDIO.step` (sem restos de ponto flutuante como 0,30000000000000004). */
function quantize(v: number): number {
  const steps = Math.round(clamp(v, 0, 1) / AUDIO.step);
  return Number((steps * AUDIO.step).toFixed(3));
}
