import { AMBIENCE_TICK_MS, type AmbienceDef } from "../config/ambience";
import { AUDIO } from "../config/audio";
import type { AmbienceSource } from "./sources";
import { playSfx } from "./synth";

// Ambiente sonoro de um mapa (GDD §10.2), a partir de uma `AmbienceDef`: a cama de ruído que
// respira, o zumbido grave e os sons esporádicos. Usa o relógio do contexto, como os efeitos.

export interface AmbienceOptions {
  /** Confere os sons esporádicos sozinho, num temporizador. Os testes desligam e chamam `tick`. */
  autoTick?: boolean;
}

export class Ambience implements AmbienceSource {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  /** Fontes sem fim (cama, zumbido, LFO): precisam de `stop` explícito. */
  private readonly running: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private nextAt: number[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(
    readonly def: AmbienceDef,
    /** Só sorteia os intervalos dos sons esporádicos. */
    private readonly random: () => number,
    private readonly opts: AmbienceOptions = {},
  ) {}

  start(ctx: AudioContext, out: AudioNode, noise: AudioBuffer): void {
    this.ctx = ctx;
    this.noise = noise;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(this.def.gain, ctx.currentTime + AUDIO.trackFadeInS);
    master.connect(out);
    this.master = master;

    const bed = this.def.bed;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = bed.type;
    filter.frequency.value = bed.freqHz;
    filter.Q.value = bed.q;
    const bedGain = ctx.createGain();
    bedGain.gain.value = bed.gain;
    src.connect(filter);
    filter.connect(bedGain);
    bedGain.connect(master);
    // o corte da cama oscila devagar: a água "respira"
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = bed.lfoHz;
    const depth = ctx.createGain();
    depth.gain.value = bed.lfoDepthHz;
    lfo.connect(depth);
    depth.connect(filter.frequency);
    src.start();
    lfo.start();
    this.running.push(src, lfo);

    const drone = this.def.drone;
    if (drone) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = drone.cutoffHz;
      const droneGain = ctx.createGain();
      droneGain.gain.value = drone.gain;
      lp.connect(droneGain);
      droneGain.connect(master);
      for (const hz of drone.hz) {
        const o = ctx.createOscillator();
        o.type = drone.wave;
        o.frequency.value = hz;
        o.connect(lp);
        o.start();
        this.running.push(o);
      }
    }

    this.nextAt = this.def.events.map((e) => ctx.currentTime + this.interval(e.everyS));
    if (this.opts.autoTick !== false) {
      this.timer = setInterval(() => {
        if (this.ctx) this.tick(this.ctx.currentTime);
      }, AMBIENCE_TICK_MS);
    }
  }

  /** Toca os sons esporádicos que venceram até `now` e sorteia o próximo de cada um. */
  tick(now: number): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || this.stopped) return;
    this.def.events.forEach((e, i) => {
      if (now < (this.nextAt[i] ?? Infinity)) return;
      // altura fixa (random = meio): os sinos continuam nas notas da música
      playSfx(ctx, master, e.sfx, { random: () => 0.5, noise, when: now });
      this.nextAt[i] = now + this.interval(e.everyS);
    });
  }

  stop(fadeMs: number): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, Math.max(0.01, fadeMs / 1000 / 4));
    // depois do fade, para as fontes sem fim e solta os nós
    setTimeout(() => {
      for (const s of this.running) {
        try {
          s.stop();
        } catch {
          // já tinha parado
        }
      }
      master.disconnect();
    }, fadeMs + 400);
  }

  private interval(range: readonly [number, number]): number {
    return range[0] + this.random() * (range[1] - range[0]);
  }
}
