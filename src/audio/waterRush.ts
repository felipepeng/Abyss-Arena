import { AMBIENCE_TICK_MS } from "../config/ambience";
import type { WaterRushDef } from "../config/waterRush";
import { clamp, lerp } from "../core/math";
import type { WaterSource } from "./sources";
import { playSfx } from "./synth";

// A água da cena de descida, a partir de uma `WaterRushDef`: um sopro de ruído filtrado e um
// rumor grave, ambos acompanhando a velocidade do mergulhador, e bolhas que ficam mais
// frequentes quando ele acelera. Usa o relógio do contexto, como os efeitos.

export interface WaterRushOptions {
  /** Confere as bolhas sozinho, num temporizador. Os testes desligam e chamam `tick`. */
  autoTick?: boolean;
}

export class WaterRush implements WaterSource {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private swishFilter: BiquadFilterNode | null = null;
  private swishGain: GainNode | null = null;
  private rumbleGain: GainNode | null = null;
  /** Fontes sem fim (os dois ruídos e o LFO): precisam de `stop` explícito. */
  private readonly running: (OscillatorNode | AudioBufferSourceNode)[] = [];
  private level = 0;
  private nextBubbleAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(
    readonly def: WaterRushDef,
    /** Só sorteia o intervalo e o timbre das bolhas. */
    private readonly random: () => number,
    private readonly opts: WaterRushOptions = {},
  ) {}

  start(ctx: AudioContext, out: AudioNode, noise: AudioBuffer): void {
    this.ctx = ctx;
    this.noise = noise;
    const d = this.def;
    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    master.gain.linearRampToValueAtTime(d.gain, ctx.currentTime + d.fadeInS);
    master.connect(out);
    this.master = master;

    // o sopro: ruído → passa-baixa → ganho
    const swish = ctx.createBufferSource();
    swish.buffer = noise;
    swish.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = d.swish.q;
    filter.frequency.value = d.swish.freqHz[0];
    const swishGain = ctx.createGain();
    swishGain.gain.value = d.swish.gain[0];
    swish.connect(filter);
    filter.connect(swishGain);
    swishGain.connect(master);
    // o corte oscila devagar: a água se move em volta dele
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = d.swish.lfoHz;
    const depth = ctx.createGain();
    depth.gain.value = d.swish.lfoDepthHz;
    lfo.connect(depth);
    depth.connect(filter.frequency);
    swish.start();
    lfo.start();

    // o rumor: outro trecho do mesmo ruído, bem grave
    const rumble = ctx.createBufferSource();
    rumble.buffer = noise;
    rumble.loop = true;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.Q.value = d.rumble.q;
    low.frequency.value = d.rumble.freqHz;
    const rumbleGain = ctx.createGain();
    rumbleGain.gain.value = d.rumble.gain[0];
    rumble.connect(low);
    low.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start(0, noise.duration * 0.5 || 0);

    this.swishFilter = filter;
    this.swishGain = swishGain;
    this.rumbleGain = rumbleGain;
    this.running.push(swish, lfo, rumble);
    this.nextBubbleAt = ctx.currentTime + this.bubbleInterval();
    if (this.opts.autoTick !== false) {
      this.timer = setInterval(() => {
        if (this.ctx) this.tick(this.ctx.currentTime);
      }, AMBIENCE_TICK_MS / 2);
    }
  }

  setLevel(level: number): void {
    const { ctx, swishFilter, swishGain, rumbleGain } = this;
    this.level = clamp(level, 0, 1);
    if (!ctx || !swishFilter || !swishGain || !rumbleGain || this.stopped) return;
    const d = this.def;
    const now = ctx.currentTime;
    // a curva ao quadrado: o sopro cresce devagar e explode perto da velocidade máxima
    const k = this.level * this.level;
    swishFilter.frequency.setTargetAtTime(lerp(d.swish.freqHz[0], d.swish.freqHz[1], k), now, d.smoothS);
    swishGain.gain.setTargetAtTime(lerp(d.swish.gain[0], d.swish.gain[1], this.level), now, d.smoothS);
    rumbleGain.gain.setTargetAtTime(lerp(d.rumble.gain[0], d.rumble.gain[1], this.level), now, d.smoothS);
  }

  /** Toca a bolha que venceu até `now` e sorteia a próxima. */
  tick(now: number): void {
    const { ctx, master, noise } = this;
    if (!ctx || !master || !noise || this.stopped || now < this.nextBubbleAt) return;
    const bubbles = this.def.bubbles;
    const sfx = bubbles[Math.floor(this.random() * bubbles.length) % bubbles.length];
    if (sfx) playSfx(ctx, master, sfx, { random: this.random, noise, when: now });
    this.nextBubbleAt = now + this.bubbleInterval();
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

  /** Quanto falta para a próxima bolha: mais curto quanto mais rápido ele vai. */
  private bubbleInterval(): number {
    const [slow, fast] = this.def.bubbleEveryS;
    const lo = lerp(slow[0], fast[0], this.level);
    const hi = lerp(slow[1], fast[1], this.level);
    return lo + this.random() * (hi - lo);
  }
}
