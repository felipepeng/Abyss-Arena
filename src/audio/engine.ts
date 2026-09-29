import { AUDIO } from "../config/audio";
import { MUSIC, type MusicLevel, type MusicParams, type TrackId } from "../config/music";
import { SFX, type SfxName } from "../config/sfx";
import type { Settings } from "../core/settings";
import type { SimEvent } from "../sim/events";
import type { AudioApi, UiSound } from "./api";
import { ProceduralMusic } from "./music";
import { soundFor } from "./soundMap";
import type { MusicSource } from "./sources";
import { createNoiseBuffer, playSfx, type Voice } from "./synth";

// Motor de áudio (ARCHITECTURE §8): cria o `AudioContext` no primeiro gesto do jogador (política
// dos navegadores), com dois barramentos independentes, música e efeitos, cada um com o seu
// ganho, e um compressor no fim. Os efeitos vêm dos eventos da simulação; a música é uma
// `MusicSource`.
//
// O hit-stop não pausa o áudio: o relógio daqui é o do contexto, não o da simulação. O som do
// acerto sai no passo em que o evento nasce, ou seja, no começo do congelamento.

const defaultContext = (): AudioContext | null => (typeof AudioContext === "undefined" ? null : new AudioContext());

export class AudioEngine implements AudioApi {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private wantedTrack: TrackId | null = null;
  private track: { id: TrackId; source: MusicSource } | null = null;
  private level: MusicLevel = 0;
  private voices: Voice[] = [];
  private charge: Voice | null = null;
  private readonly lastPlayed = new Map<SfxName, number>();
  private lastVolumes: readonly [number, number] = [-1, -1];

  constructor(
    private readonly settings: Settings,
    private readonly makeContext: () => AudioContext | null = defaultContext,
    private readonly random: () => number = Math.random,
    private readonly makeMusic: (p: MusicParams) => MusicSource = (p) => new ProceduralMusic(p),
  ) {}

  /** O contexto já existe (o jogador já fez algum gesto). */
  get unlocked(): boolean {
    return this.ctx !== null;
  }

  /**
   * Cria o contexto (na primeira chamada) e o retoma. Chamar a cada gesto é seguro: o navegador
   * pode suspendê-lo de novo, e um novo gesto o acorda.
   */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const ctx = this.makeContext();
    if (!ctx) return;
    this.ctx = ctx;
    const compressor = ctx.createDynamicsCompressor();
    const c = AUDIO.compressor;
    compressor.threshold.value = c.threshold;
    compressor.knee.value = c.knee;
    compressor.ratio.value = c.ratio;
    compressor.attack.value = c.attack;
    compressor.release.value = c.release;
    const master = ctx.createGain();
    master.gain.value = AUDIO.masterGain;
    compressor.connect(ctx.destination);
    master.connect(compressor);
    this.sfxBus = ctx.createGain();
    this.musicBus = ctx.createGain();
    this.sfxBus.connect(master);
    this.musicBus.connect(master);
    this.noise = createNoiseBuffer(ctx, AUDIO.noiseSeconds, this.random);
    this.update(true);
    void ctx.resume();
    // a trilha pedida antes do primeiro gesto começa agora
    if (this.wantedTrack) this.startTrack(this.wantedTrack);
  }

  /** Aplica os volumes das configurações. Barato: só mexe nos ganhos quando algo mudou. */
  update(force = false): void {
    if (!this.ctx || !this.sfxBus || !this.musicBus) return;
    const m = gain(this.settings.musicVolume);
    const s = gain(this.settings.sfxVolume);
    if (!force && m === this.lastVolumes[0] && s === this.lastVolumes[1]) return;
    this.lastVolumes = [m, s];
    const now = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(m, now, AUDIO.volumeSmoothingS);
    this.sfxBus.gain.setTargetAtTime(s, now, AUDIO.volumeSmoothingS);
  }

  /** Suspende o áudio com a aba escondida e o retoma ao voltar. */
  setHidden(hidden: boolean): void {
    if (!this.ctx) return;
    if (hidden) void this.ctx.suspend();
    else void this.ctx.resume();
  }

  onEvents(events: readonly SimEvent[]): void {
    if (!this.ctx) return;
    for (const e of events) {
      // a estocada saiu (ou o jogador morreu): o tom da carga acaba na hora
      if (e.t === "thrust" || e.t === "playerDied") this.stopCharge();
      const name = soundFor(e);
      if (!name) continue;
      const voice = this.play(name);
      if (e.t === "chargeStart") {
        this.stopCharge();
        this.charge = voice;
      }
    }
  }

  ui(kind: UiSound): void {
    this.play(kind === "move" ? "menuMove" : "menuConfirm");
  }

  playTrack(track: TrackId): void {
    this.wantedTrack = track;
    if (this.ctx) this.startTrack(track);
  }

  setIntensity(level: MusicLevel): void {
    if (level === this.level) return;
    this.level = level;
    this.track?.source.setIntensity(level);
  }

  private startTrack(id: TrackId): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    // a mesma trilha continua (tentar de novo não recomeça a música)
    if (this.track?.id === id) return;
    this.track?.source.stop(AUDIO.trackFadeMs);
    const source = this.makeMusic(MUSIC[id]);
    // trilha nova começa nas ondas; quem manda a intensidade é a cena, a cada passo
    this.level = 0;
    source.start(ctx, this.musicBus);
    source.setIntensity(0);
    this.track = { id, source };
  }

  private stopCharge(): void {
    this.charge?.stop();
    this.charge = null;
  }

  /** Toca um efeito, respeitando o intervalo mínimo dele e o teto de vozes. */
  play(name: SfxName): Voice | null {
    const ctx = this.ctx;
    if (!ctx || !this.sfxBus || !this.noise) return null;
    const def = SFX[name];
    const now = ctx.currentTime;
    const last = this.lastPlayed.get(name);
    if (def.minGapMs && last !== undefined && (now - last) * 1000 < def.minGapMs) return null;
    this.voices = this.voices.filter((v) => v.endTime > now);
    if (!def.priority && this.voices.length >= AUDIO.maxVoices) return null;
    const voice = playSfx(ctx, this.sfxBus, def, { random: this.random, noise: this.noise });
    this.voices.push(voice);
    this.lastPlayed.set(name, now);
    return voice;
  }
}

/** Volume do menu (linear) para ganho (curva). */
export const gain = (volume: number): number => Math.max(0, volume) ** AUDIO.volumeCurve;
