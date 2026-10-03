import { MUSIC_LAYERS, type MusicLevel, type MusicParams } from "../config/music";
import { Rng } from "../core/rng";

// Sequenciador da música procedural: gera notas, não som. Recebe uma trilha (escala, andamento,
// progressão e as linhas escritas em `config/music.ts`) e devolve, para cada janela de tempo, a
// lista de notas que caem nela. É puro (sem Web Audio), determinístico pela semente da trilha e
// por isso testável.
//
// A grade é de semicolcheias: 16 por compasso, 4 por tempo.

export type NoteVoice = "pad" | "pulse" | "lead" | "bass" | "kick" | "snare" | "hat" | "arp";

export interface NoteEvent {
  /** Início, no relógio do contexto (s). */
  time: number;
  voice: NoteVoice;
  /** Hz. Sem altura (chimbal, caixa): 0. */
  freq: number;
  /** Duração, s. */
  dur: number;
  gain: number;
}

/** Uma nota escrita à mão: o passo do compasso, o grau da escala e a duração em passos. */
export interface Note {
  step: number;
  degree: number;
  len: number;
}

export const STEPS_PER_BAR = 16;

const DEFAULT_LEN = 2;

/** Lê um compasso no formato `passo:grau/duração` (ver `config/music.ts`). Erro de digitação grita. */
export function parseBar(text: string): Note[] {
  const out: Note[] = [];
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const m = /^(\d+):(-?\d+)(?:\/(\d+))?$/.exec(token);
    if (!m) throw new Error(`nota inválida: "${token}"`);
    const step = Number(m[1]);
    const len = m[3] === undefined ? DEFAULT_LEN : Number(m[3]);
    if (step >= STEPS_PER_BAR || len < 1 || step + len > STEPS_PER_BAR) {
      throw new Error(`nota fora do compasso: "${token}"`);
    }
    out.push({ step, degree: Number(m[2]), len });
  }
  return out;
}

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
  // as linhas escritas, já lidas: um array de notas por compasso
  private readonly theme: Note[][];
  private readonly bossTheme: Note[][];
  private readonly bossBass: Note[][];

  constructor(
    readonly params: MusicParams,
    readonly startTime: number,
  ) {
    this.stepDur = 60 / params.bpm / 4;
    this.rng = new Rng(params.seed);
    this.theme = params.theme.map(parseBar);
    this.bossTheme = (params.boss?.theme ?? []).map(parseBar);
    this.bossBass = (params.boss?.bass ?? []).map(parseBar);
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
    const boss = level >= 1 ? p.boss : undefined;
    const inBar = step % STEPS_PER_BAR;
    const bar = Math.floor(step / STEPS_PER_BAR);
    const chord = p.chords[bar % p.chords.length] ?? [0];
    const L = MUSIC_LAYERS;

    if (inBar === 0) {
      // pad: o acorde inteiro, um pouco mais longo que o compasso para os acordes se sobrepor
      for (const d of chord) {
        out.push({ time, voice: "pad", freq: degreeFreq(p, d, 1), dur: this.barDur * 1.1, gain: L.pad.noteGain });
      }
    }

    if (inBar % 4 === 0) {
      const beat = inBar / 4;
      const d = p.pulse[beat % p.pulse.length];
      if (d !== null && d !== undefined) {
        out.push({
          time, voice: "pulse", freq: degreeFreq(p, d, 0), dur: this.stepDur * 4 * L.pulse.decay,
          gain: L.pulse.gain * (beat === 0 ? 1 : 0.8),
        });
      }
    }

    // tema: o das ondas, ou o do chefe quando ele nasce; no nível 2 dobrado numa oitava acima
    const themeBars = boss ? this.bossTheme : this.theme;
    for (const n of themeBars[bar % themeBars.length] ?? []) {
      if (n.step !== inBar) continue;
      const dur = n.len * this.stepDur;
      out.push({ time, voice: "lead", freq: degreeFreq(p, n.degree, L.lead.octave), dur, gain: L.lead.gain });
      if (level >= 2) {
        out.push({ time, voice: "lead", freq: degreeFreq(p, n.degree, L.lead.octave + L.lead.doubleOct), dur, gain: L.lead.gain * L.lead.doubleGain });
      }
    }

    if (!boss) return;

    // baixo do chefe: graus relativos à fundamental do acorde da hora
    const root = chord[0] ?? 0;
    for (const n of this.bossBass[bar % this.bossBass.length] ?? []) {
      if (n.step !== inBar) continue;
      out.push({ time, voice: "bass", freq: degreeFreq(p, root + n.degree, L.bass.octave), dur: n.len * this.stepDur, gain: L.bass.gain });
    }

    const lv = level as 1 | 2;
    const d = boss.drums;
    if (d.kick[lv].includes(inBar)) {
      out.push({ time, voice: "kick", freq: L.kick.hz[0], dur: L.kick.durS, gain: L.kick.gain });
    }
    if (d.snare[lv].includes(inBar)) {
      out.push({ time, voice: "snare", freq: 0, dur: L.snare.durS, gain: L.snare.gain });
    }
    if (d.hat[lv].includes(inBar)) {
      out.push({ time, voice: "hat", freq: 0, dur: L.hat.durS, gain: L.hat.gain * (inBar % 4 === 2 ? 1 : 0.6) });
    }

    if (level >= 2 && this.rng.chance(p.arpChance)) {
      // arpejo: um tom do acorde da hora, numa das oitavas da trilha
      const a = chord[this.rng.int(0, chord.length - 1)] ?? 0;
      const oct = p.arpOctaves[this.rng.int(0, p.arpOctaves.length - 1)] ?? 1;
      out.push({ time, voice: "arp", freq: degreeFreq(p, a, oct), dur: L.arp.decayS, gain: L.arp.gain });
    }
  }
}
