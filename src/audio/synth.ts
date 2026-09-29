import { AUDIO } from "../config/audio";
import type { SfxDef, SfxLayer } from "../config/sfx";

// Renderizador genérico dos efeitos: transforma uma `SfxDef` (dados em config/sfx.ts) em nós
// de Web Audio. Não conhece nenhum som em particular.

/** Um som em andamento. */
export interface Voice {
  /** Quando a última camada acaba, no relógio do contexto (s). */
  readonly endTime: number;
  /** Corta o som com uma soltura curta (o tom da carga, quando a estocada sai). */
  stop(): void;
}

/** Ruído branco de `seconds` segundos, reaproveitado por todos os sons de ruído. */
export function createNoiseBuffer(ctx: BaseAudioContext, seconds: number, random: () => number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = random() * 2 - 1;
  return buffer;
}

export interface PlayOptions {
  random: () => number;
  noise: AudioBuffer;
  /** Instante de início no relógio do contexto (s). Padrão: agora. */
  when?: number;
}

const FLOOR = 0.0001;

export function playSfx(ctx: AudioContext, out: AudioNode, def: SfxDef, opts: PlayOptions): Voice {
  const start = opts.when ?? ctx.currentTime;
  // a mesma variação de altura para todas as camadas: um acorde continua afinado
  const pitch = 1 + (opts.random() * 2 - 1) * AUDIO.pitchVariation;
  const gains: GainNode[] = [];
  const sources: (OscillatorNode | AudioBufferSourceNode)[] = [];
  let endTime = start;

  for (const layer of def.layers) {
    const t0 = start + (layer.delayMs ?? 0) / 1000;
    const dur = layer.durMs / 1000;
    const src = makeSource(ctx, layer, t0, dur, pitch, opts);
    const env = ctx.createGain();
    envelope(env, layer, t0, dur);

    let node: AudioNode = src;
    if (layer.filter) {
      const f = ctx.createBiquadFilter();
      f.type = layer.filter.type;
      f.Q.value = layer.filter.q ?? 0.8;
      f.frequency.setValueAtTime(layer.filter.freq[0], t0);
      if (layer.filter.freq[1] !== layer.filter.freq[0]) f.frequency.exponentialRampToValueAtTime(layer.filter.freq[1], t0 + dur);
      node.connect(f);
      node = f;
    }
    node.connect(env);
    env.connect(out);

    src.start(t0);
    src.stop(t0 + dur + 0.05);
    gains.push(env);
    sources.push(src);
    endTime = Math.max(endTime, t0 + dur);
  }

  return {
    endTime,
    stop() {
      const now = ctx.currentTime;
      for (const g of gains) {
        g.gain.cancelScheduledValues(now);
        g.gain.setTargetAtTime(0, now, AUDIO.releaseS / 4);
      }
      for (const s of sources) {
        try {
          s.stop(now + AUDIO.releaseS * 2);
        } catch {
          // já tinha parado
        }
      }
    },
  };
}

function makeSource(
  ctx: AudioContext, layer: SfxLayer, t0: number, dur: number, pitch: number, opts: PlayOptions,
): OscillatorNode | AudioBufferSourceNode {
  if (layer.kind === "noise") {
    const s = ctx.createBufferSource();
    s.buffer = opts.noise;
    s.loop = true;
    return s;
  }
  const o = ctx.createOscillator();
  o.type = layer.wave ?? "sine";
  const [f0, f1] = layer.freq ?? [440, 440];
  o.frequency.setValueAtTime(f0 * pitch, t0);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1 * pitch, t0 + dur);
  return o;
}

/** Sobe em silêncio até o pico (`attackMs`) e decai em exponencial até o fim. */
function envelope(env: GainNode, layer: SfxLayer, t0: number, dur: number): void {
  const attack = Math.min((layer.attackMs ?? 4) / 1000, dur * 0.9);
  env.gain.setValueAtTime(FLOOR, t0);
  env.gain.linearRampToValueAtTime(layer.gain, t0 + attack);
  env.gain.exponentialRampToValueAtTime(FLOOR, t0 + dur);
}
