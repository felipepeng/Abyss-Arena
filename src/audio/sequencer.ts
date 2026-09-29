import { MUSIC_LAYERS, type MusicLevel, type MusicParams } from "../config/music";
import { Rng } from "../core/rng";

// Sequenciador da música procedural: gera notas, não som. Recebe uma trilha (escala, andamento,
// progressões) e devolve, para cada janela de tempo, a lista de notas que caem nela. É puro
// (sem Web Audio), determinístico pela semente da trilha e por isso testável.
//
// A grade é de semicolcheias: 16 por compasso, 4 por tempo.

export type NoteVoice = "pad" | "pulse" | "kick" | "hat" | "arp";

export interface NoteEvent {
  /** Início, no relógio do contexto (s). */
  time: number;
  voice: NoteVoice;
  /** Hz. Sem altura (chimbal): 0. */
  freq: number;
  /** Duração, s. */
  dur: number;
  gain: number;
}

export const STEPS_PER_BAR = 16;

/** Frequência do grau `degree` da escala. Passar do fim da escala sobe uma oitava. */
export function degreeFreq(p: MusicParams, degree: number, octaveShift = 0): number {
  const n = p.scale.length;
  const octave = Math.floor(degree / n);
  const semitones = (p.scale[((degree % n) + n) % n] ?? 0) + 12 * octave;
  return p.rootHz * 2 ** (semitones / 12 + octaveShift);
}

export class Sequencer {
  /** Duração de uma semicolcheia, s. */
  readonly stepDur: number;
  private step = 0;
  private readonly rng: Rng;

  constructor(
    readonly params: MusicParams,
    readonly startTime: number,
  ) {
    this.stepDur = 60 / params.bpm / 4;
    this.rng = new Rng(params.seed);
  }

  get barDur(): number {
    return this.stepDur * STEPS_PER_BAR;
  }

  /**
   * Notas de todos os passos que começam antes de `until`, para a intensidade `level`. Cada
   * passo é gerado uma vez só: chamar de novo continua de onde parou. A intensidade vale no
   * momento em que o passo é gerado (uns 0,5 s à frente), e a mudança de volume das camadas é
   * suave (ver `MUSIC_LAYERS.rampS`), então não há corte.
   */
  generate(until: number, level: MusicLevel): NoteEvent[] {
    const out: NoteEvent[] = [];
    for (;;) {
      const time = this.startTime + this.step * this.stepDur;
      if (time >= until) break;
      this.emit(this.step, time, level, out);
      this.step++;
    }
    return out;
  }

  private emit(step: number, time: number, level: MusicLevel, out: NoteEvent[]): void {
    const p = this.params;
    const inBar = step % STEPS_PER_BAR;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const chord = p.chords[bar % p.chords.length] ?? [0];

    if (inBar === 0) {
      // pad: o acorde inteiro, um pouco mais longo que o compasso para os acordes se sobrepor
      for (const d of chord) {
        out.push({ time, voice: "pad", freq: degreeFreq(p, d, 1), dur: this.barDur * 1.1, gain: MUSIC_LAYERS.pad.noteGain });
      }
    }

    if (inBar % 4 === 0) {
      const beat = inBar / 4;
      const d = p.pulse[beat % p.pulse.length];
      if (d !== null && d !== undefined) {
        out.push({
          time, voice: "pulse", freq: degreeFreq(p, d, 0), dur: this.stepDur * 4 * MUSIC_LAYERS.pulse.decay,
          gain: MUSIC_LAYERS.pulse.gain * (beat === 0 ? 1 : 0.8),
        });
      }
    }

    if (level >= 1) {
      const kicks: readonly number[] = MUSIC_LAYERS.patterns.kick[level as 1 | 2];
      const hats: readonly number[] = MUSIC_LAYERS.patterns.hat[level as 1 | 2];
      if (kicks.includes(inBar)) {
        out.push({ time, voice: "kick", freq: MUSIC_LAYERS.kick.hz[0], dur: MUSIC_LAYERS.kick.durS, gain: MUSIC_LAYERS.kick.gain });
      }
      if (hats.includes(inBar)) {
        out.push({ time, voice: "hat", freq: 0, dur: MUSIC_LAYERS.hat.durS, gain: MUSIC_LAYERS.hat.gain * (inBar % 4 === 2 ? 1 : 0.6) });
      }
    }

    if (level >= 2 && this.rng.chance(p.arpChance)) {
      // arpejo: um tom do acorde da hora, numa das oitavas da trilha
      const d = chord[this.rng.int(0, chord.length - 1)] ?? 0;
      const oct = p.arpOctaves[this.rng.int(0, p.arpOctaves.length - 1)] ?? 1;
      out.push({ time, voice: "arp", freq: degreeFreq(p, d, oct), dur: MUSIC_LAYERS.arp.decayS, gain: MUSIC_LAYERS.arp.gain });
    }
  }
}
