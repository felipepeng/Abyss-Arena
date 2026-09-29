// Um AudioContext de mentira: grava os nós criados e as chamadas nos parâmetros, para os testes
// de áudio rodarem no Node sem som. Só implementa o que o jogo usa.

export class FakeParam {
  value = 0;
  readonly calls: { fn: string; args: number[] }[] = [];
  private log(fn: string, ...args: number[]): this {
    this.calls.push({ fn, args });
    return this;
  }
  setValueAtTime(v: number, t: number): this {
    this.value = v;
    return this.log("set", v, t);
  }
  linearRampToValueAtTime(v: number, t: number): this {
    return this.log("linear", v, t);
  }
  exponentialRampToValueAtTime(v: number, t: number): this {
    return this.log("exp", v, t);
  }
  setTargetAtTime(v: number, t: number, c: number): this {
    return this.log("target", v, t, c);
  }
  cancelScheduledValues(t: number): this {
    return this.log("cancel", t);
  }
  count(fn: string): number {
    return this.calls.filter((c) => c.fn === fn).length;
  }
}

export class FakeNode {
  readonly out: FakeNode[] = [];
  disconnected = false;
  connect<T>(n: T): T {
    this.out.push(n as unknown as FakeNode);
    return n;
  }
  disconnect(): void {
    this.disconnected = true;
  }
}

export class FakeGain extends FakeNode {
  readonly gain = new FakeParam();
}

export class FakeOsc extends FakeNode {
  type = "sine";
  readonly frequency = new FakeParam();
  readonly detune = new FakeParam();
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  start(t: number): void {
    this.startedAt = t;
  }
  stop(t: number): void {
    this.stoppedAt = t;
  }
}

export class FakeBufferSource extends FakeNode {
  buffer: unknown = null;
  loop = false;
  startedAt: number | null = null;
  stoppedAt: number | null = null;
  start(t: number): void {
    this.startedAt = t;
  }
  stop(t: number): void {
    this.stoppedAt = t;
  }
}

export class FakeFilter extends FakeNode {
  type = "lowpass";
  readonly frequency = new FakeParam();
  readonly Q = new FakeParam();
}

export class FakeCompressor extends FakeNode {
  readonly threshold = new FakeParam();
  readonly knee = new FakeParam();
  readonly ratio = new FakeParam();
  readonly attack = new FakeParam();
  readonly release = new FakeParam();
}

export class FakeContext {
  currentTime = 0;
  readonly sampleRate = 8000;
  state: "suspended" | "running" = "suspended";
  readonly destination = new FakeNode();
  readonly gains: FakeGain[] = [];
  readonly oscs: FakeOsc[] = [];
  readonly buffers: FakeBufferSource[] = [];
  readonly filters: FakeFilter[] = [];
  resumed = 0;
  suspended = 0;

  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator(): FakeOsc {
    const o = new FakeOsc();
    this.oscs.push(o);
    return o;
  }
  createBufferSource(): FakeBufferSource {
    const b = new FakeBufferSource();
    this.buffers.push(b);
    return b;
  }
  createBiquadFilter(): FakeFilter {
    const f = new FakeFilter();
    this.filters.push(f);
    return f;
  }
  createDynamicsCompressor(): FakeCompressor {
    return new FakeCompressor();
  }
  createBuffer(_channels: number, length: number, _rate: number): { length: number; getChannelData(): Float32Array } {
    return { length, getChannelData: () => new Float32Array(length) };
  }
  resume(): Promise<void> {
    this.state = "running";
    this.resumed++;
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.state = "suspended";
    this.suspended++;
    return Promise.resolve();
  }
  /** Fontes de som criadas até agora (osciladores e ruído). */
  get sources(): number {
    return this.oscs.length + this.buffers.length;
  }
}

/** O contexto de mentira como o tipo que o código espera. */
export const asAudio = (c: FakeContext): AudioContext => c as unknown as AudioContext;
