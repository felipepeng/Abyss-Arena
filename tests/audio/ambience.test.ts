import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Ambience } from "../../src/audio/ambience";
import { createNoiseBuffer } from "../../src/audio/synth";
import { AMBIENCE, type AmbienceDef } from "../../src/config/ambience";
import { MUSIC, type TrackId } from "../../src/config/music";
import { asAudio, FakeContext } from "./fakeContext";

// O ambiente dos mapas (GDD §10.2): a cama que respira, o zumbido e os sons esporádicos. O
// contexto é de mentira, então dá para provar a estrutura e o tempo sem nenhum som.

const IDS = Object.keys(AMBIENCE) as TrackId[];

const start = (def: AmbienceDef, random = () => 0.5) => {
  const ctx = new FakeContext();
  const out = ctx.createGain();
  const noise = createNoiseBuffer(asAudio(ctx), 0.1, () => 0.5);
  const amb = new Ambience(def, random, { autoTick: false });
  amb.start(asAudio(ctx), out as unknown as AudioNode, noise);
  return { ctx, out, amb };
};

describe("definições do ambiente", () => {
  it("só os mapas têm ambiente; o menu não", () => {
    expect(IDS.sort()).toEqual(["abyss", "coral", "rift"]);
    expect(AMBIENCE.menu).toBeUndefined();
  });

  it.each(IDS)("%s: números válidos, e o ambiente é bem mais baixo que a música", (id) => {
    const d = AMBIENCE[id] as AmbienceDef;
    expect(d.gain).toBeGreaterThan(0);
    expect(d.gain).toBeLessThanOrEqual(1);
    expect(d.bed.freqHz).toBeGreaterThan(d.bed.lfoDepthHz);
    expect(d.bed.lfoHz).toBeLessThan(1);
    expect(d.events.length).toBeGreaterThan(0);
    for (const e of d.events) {
      expect(e.everyS[0]).toBeGreaterThan(0);
      expect(e.everyS[1]).toBeGreaterThanOrEqual(e.everyS[0]);
      // esporádico de verdade: nada que role várias vezes por segundo
      expect(e.everyS[0]).toBeGreaterThanOrEqual(3);
      for (const l of e.sfx.layers) expect(l.gain).toBeLessThanOrEqual(0.15);
    }
  });

  it("o Jardim toca sinos nas notas do Lá lídio da música dele", () => {
    const p = MUSIC.coral;
    const inScale = (hz: number) => {
      const semis = 12 * Math.log2(hz / p.rootHz);
      const pc = ((Math.round(semis) % 12) + 12) % 12;
      return p.scale.includes(pc);
    };
    const bells = (AMBIENCE.coral as AmbienceDef).events
      .map((e) => e.sfx.layers[0])
      .filter((l) => l?.kind === "osc" && (l.durMs ?? 0) >= 1000);
    expect(bells.length).toBe(3);
    for (const l of bells) expect(inScale(l?.freq?.[0] as number), `${l?.freq?.[0]} Hz`).toBe(true);
  });

  it("o zumbido do Fosso é dissonante: dois graves a um semitom de distância", () => {
    const hz = (AMBIENCE.abyss as AmbienceDef).drone?.hz ?? [];
    expect(hz).toHaveLength(2);
    expect(12 * Math.log2((hz[1] as number) / (hz[0] as number))).toBeCloseTo(1, 0);
  });
});

describe("Ambience", () => {
  it.each(IDS)("%s: entra em silêncio e sobe (sem estalo), com a cama ligada e a oscilar", (id) => {
    const def = AMBIENCE[id] as AmbienceDef;
    const { ctx, out } = start(def);
    const master = ctx.gains[1];
    expect(master?.out).toContain(out);
    expect(master?.gain.calls[0]?.args[0]).toBeLessThan(0.001);
    expect(master?.gain.calls[1]?.fn).toBe("linear");
    expect(master?.gain.calls[1]?.args[0]).toBe(def.gain);
    // a cama é um ruído em laço; o LFO é um seno lento
    const bed = ctx.buffers[0];
    expect(bed?.loop).toBe(true);
    expect(bed?.startedAt).not.toBeNull();
    expect(ctx.filters[0]?.type).toBe(def.bed.type);
    const lfo = ctx.oscs[0];
    expect(lfo?.frequency.value).toBe(def.bed.lfoHz);
  });

  it("o zumbido tem um oscilador por frequência (só o Fosso)", () => {
    const rift = start(AMBIENCE.rift as AmbienceDef);
    expect(rift.ctx.oscs).toHaveLength(1); // só o LFO
    const abyss = start(AMBIENCE.abyss as AmbienceDef);
    expect(abyss.ctx.oscs).toHaveLength(1 + 2);
  });

  it("os esporádicos só tocam depois do seu tempo, e cada um volta a sortear o próximo", () => {
    const def = AMBIENCE.rift as AmbienceDef;
    const { ctx, amb } = start(def, () => 0); // sorteio mínimo: o limite inferior de cada um
    const base = ctx.sources;
    amb.tick(0.5);
    expect(ctx.sources).toBe(base);
    const shortest = Math.min(...def.events.map((e) => e.everyS[0]));
    amb.tick(shortest);
    expect(ctx.sources).toBeGreaterThan(base);
    const after = ctx.sources;
    // logo em seguida o mesmo som não repete: o próximo ficou para depois
    amb.tick(shortest + 0.1);
    expect(ctx.sources).toBe(after);
    // numa janela longa todos tocam várias vezes
    for (let t = shortest; t < 120; t += 0.25) amb.tick(t);
    expect(ctx.sources).toBeGreaterThan(after + 10);
  });

  it("os sons esporádicos soam sem variação de altura (os sinos ficam afinados)", () => {
    const def = AMBIENCE.coral as AmbienceDef;
    const { ctx, amb } = start(def, () => 0);
    const base = ctx.oscs.length;
    amb.tick(60);
    const bell = ctx.oscs.slice(base).find((o) => o.frequency.calls[0]?.args[0] === 880);
    expect(bell).toBeDefined();
  });

  describe("stop", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("desvanece, para as fontes sem fim depois do fade e não toca mais nada", () => {
      const def = AMBIENCE.abyss as AmbienceDef;
      const { ctx, amb } = start(def, () => 0);
      const master = ctx.gains[1];
      amb.stop(900);
      expect(master?.gain.calls.at(-1)?.fn).toBe("target");
      expect(master?.gain.calls.at(-1)?.args[0]).toBe(0);
      const endless = [...ctx.oscs, ...ctx.buffers];
      expect(endless.every((s) => s.stoppedAt === null)).toBe(true);
      vi.advanceTimersByTime(900 + 500);
      expect(endless.every((s) => s.stoppedAt !== null)).toBe(true);
      expect(master?.disconnected).toBe(true);
      const before = ctx.sources;
      amb.tick(500);
      expect(ctx.sources).toBe(before);
    });
  });
});
