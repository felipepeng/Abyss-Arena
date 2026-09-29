import { MUSIC_LAYERS, type MusicLevel, type MusicParams } from "../config/music";
import { createNoiseBuffer } from "./synth";
import { Sequencer, type NoteEvent } from "./sequencer";
import type { MusicSource } from "./sources";

// Música procedural (GDD §10.2): implementa `MusicSource`. O sequenciador decide as notas; aqui
// elas viram som. Cada camada (pad, pulso, percussão, arpejo) tem o seu barramento, e a
// intensidade só mexe no ganho deles em rampa: por isso a música muda de nível sem corte.

type Layer = "pad" | "pulse" | "perc" | "arp";

export interface ProceduralOptions {
  /** Agenda sozinha, num temporizador. Os testes desligam e chamam `schedule`. */
  autoSchedule?: boolean;
  random?: () => number;
}

export class ProceduralMusic implements MusicSource {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buses: Record<Layer, GainNode> | null = null;
  private noise: AudioBuffer | null = null;
  private seq: Sequencer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private level: MusicLevel = 0;
  private stopped = false;

  constructor(
    readonly params: MusicParams,
    private readonly opts: ProceduralOptions = {},
  ) {}

  get intensity(): MusicLevel {
    return this.level;
  }

  start(ctx: AudioContext, out: AudioNode): void {
    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(MUSIC_LAYERS.bus, ctx.currentTime + 1.2);
    master.connect(out);
    this.master = master;
    const bus = (target: number): GainNode => {
      const g = ctx.createGain();
      g.gain.value = target;
      g.connect(master);
      return g;
    };
    const t = MUSIC_LAYERS.gains[this.level];
    this.buses = { pad: bus(t.pad), pulse: bus(t.pulse), perc: bus(t.perc), arp: bus(t.arp) };
    this.noise = createNoiseBuffer(ctx, 0.4, this.opts.random ?? Math.random);
    this.seq = new Sequencer(this.params, ctx.currentTime + 0.1);
    this.schedule(ctx.currentTime);
    if (this.opts.autoSchedule !== false) {
      this.timer = setInterval(() => {
        if (this.ctx) this.schedule(this.ctx.currentTime);
      }, MUSIC_LAYERS.tickMs);
    }
  }

  setIntensity(level: MusicLevel): void {
    this.level = level;
    if (!this.ctx || !this.buses) return;
    const now = this.ctx.currentTime;
    const t = MUSIC_LAYERS.gains[level];
    // rampa suave: as camadas entram e saem sem corte
    for (const layer of Object.keys(this.buses) as Layer[]) {
      this.buses[layer].gain.setTargetAtTime(t[layer], now, MUSIC_LAYERS.rampS);
    }
  }

  /** Gera e agenda as notas dos próximos `lookAheadS` segundos. */
  schedule(now: number): void {
    if (!this.seq || this.stopped) return;
    for (const n of this.seq.generate(now + MUSIC_LAYERS.lookAheadS, this.level)) this.play(n);
  }

  stop(fadeMs: number): void {
    if (this.stopped) return;
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setTargetAtTime(0, now, Math.max(0.01, fadeMs / 1000 / 4));
    // solta os nós depois do fade; as notas já agendadas terminam mudas
    setTimeout(() => master.disconnect(), fadeMs + 400);
  }

  private play(n: NoteEvent): void {
    const ctx = this.ctx;
    const buses = this.buses;
    if (!ctx || !buses) return;
    const t = Math.max(n.time, ctx.currentTime);
    switch (n.voice) {
      case "pad":
        return this.pad(ctx, buses.pad, n, t);
      case "pulse":
        return this.tone(ctx, buses.pulse, MUSIC_LAYERS.pulse.wave, n, t);
      case "arp":
        return this.tone(ctx, buses.arp, this.params.arpWave, n, t);
      case "kick":
        return this.kick(ctx, buses.perc, n, t);
      case "hat":
        return this.hat(ctx, buses.perc, n, t);
    }
  }

  /** Dois osciladores levemente desafinados por um passa-baixas, com subida e descida lentas. */
  private pad(ctx: AudioContext, bus: GainNode, n: NoteEvent, t: number): void {
    const env = ctx.createGain();
    const attack = n.dur * MUSIC_LAYERS.pad.attack;
    const release = n.dur * MUSIC_LAYERS.pad.release;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(n.gain, t + attack);
    env.gain.setValueAtTime(n.gain, t + n.dur - release);
    env.gain.linearRampToValueAtTime(0.0001, t + n.dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = this.params.padCutoffHz;
    filter.Q.value = 0.7;
    filter.connect(env);
    env.connect(bus);
    for (const detune of [-MUSIC_LAYERS.pad.detuneCents, MUSIC_LAYERS.pad.detuneCents]) {
      const o = ctx.createOscillator();
      o.type = this.params.padWave;
      o.frequency.value = n.freq;
      o.detune.value = detune;
      o.connect(filter);
      o.start(t);
      o.stop(t + n.dur + 0.05);
    }
  }

  /** Uma nota com ataque curto e decaimento exponencial. */
  private tone(ctx: AudioContext, bus: GainNode, wave: OscillatorType, n: NoteEvent, t: number): void {
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(n.gain, t + 0.006);
    env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    env.connect(bus);
    const o = ctx.createOscillator();
    o.type = wave;
    o.frequency.value = n.freq;
    o.connect(env);
    o.start(t);
    o.stop(t + n.dur + 0.05);
  }

  private kick(ctx: AudioContext, bus: GainNode, n: NoteEvent, t: number): void {
    const env = ctx.createGain();
    env.gain.setValueAtTime(n.gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    env.connect(bus);
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(MUSIC_LAYERS.kick.hz[0], t);
    o.frequency.exponentialRampToValueAtTime(MUSIC_LAYERS.kick.hz[1], t + n.dur);
    o.connect(env);
    o.start(t);
    o.stop(t + n.dur + 0.05);
  }

  private hat(ctx: AudioContext, bus: GainNode, n: NoteEvent, t: number): void {
    if (!this.noise) return;
    const env = ctx.createGain();
    env.gain.setValueAtTime(n.gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);
    env.connect(bus);
    const f = ctx.createBiquadFilter();
    f.type = "highpass";
    f.frequency.value = MUSIC_LAYERS.hat.highpassHz;
    f.connect(env);
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.connect(f);
    s.start(t);
    s.stop(t + n.dur + 0.05);
  }
}
