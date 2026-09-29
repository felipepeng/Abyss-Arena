import { describe, expect, it } from "vitest";
import { degreeFreq, Sequencer, STEPS_PER_BAR, type NoteEvent } from "../../src/audio/sequencer";
import { MUSIC, type MusicLevel, type TrackId } from "../../src/config/music";

// A música procedural (GDD §10.2): o sequenciador é puro, então dá para provar as camadas, a
// escala de cada mapa e o determinismo sem nenhum som.

const TRACKS = Object.keys(MUSIC) as TrackId[];
const BARS = 8;

const barDur = (id: TrackId) => (60 / MUSIC[id].bpm) * 4;
const semitoneClass = (id: TrackId, freq: number) => {
  const p = MUSIC[id];
  const s = 12 * Math.log2(freq / p.rootHz);
  return ((Math.round(s) % 12) + 12) % 12;
};
const voices = (notes: NoteEvent[]) => new Set(notes.map((n) => n.voice));
const run = (id: TrackId, level: MusicLevel, bars = BARS) => new Sequencer(MUSIC[id], 0).generate(barDur(id) * bars, level);

describe("Sequencer", () => {
  it.each(TRACKS)("%s: mesma semente, mesmas notas", (id) => {
    expect(run(id, 2)).toEqual(run(id, 2));
  });

  it.each(TRACKS)("%s: gerar aos poucos dá o mesmo que gerar de uma vez", (id) => {
    const a = new Sequencer(MUSIC[id], 1);
    const parts = [...a.generate(1 + 2, 2), ...a.generate(1 + 5, 2), ...a.generate(1 + barDur(id) * 4, 2)];
    const whole = new Sequencer(MUSIC[id], 1).generate(1 + barDur(id) * 4, 2);
    expect(parts).toEqual(whole);
  });

  it.each(TRACKS)("%s: nenhuma nota antes do início nem depois do fim da janela", (id) => {
    const start = 5;
    const until = start + barDur(id) * 3;
    for (const n of new Sequencer(MUSIC[id], start).generate(until, 2)) {
      expect(n.time).toBeGreaterThanOrEqual(start);
      expect(n.time).toBeLessThan(until);
      expect(n.dur).toBeGreaterThan(0);
      expect(n.gain).toBeGreaterThan(0);
    }
  });

  it.each(TRACKS)("%s: as camadas se somam com a intensidade", (id) => {
    expect(voices(run(id, 0))).toEqual(new Set(["pad", "pulse"]));
    expect(voices(run(id, 1))).toEqual(new Set(["pad", "pulse", "kick", "hat"]));
    expect(voices(run(id, 2))).toEqual(new Set(["pad", "pulse", "kick", "hat", "arp"]));
  });

  it.each(TRACKS)("%s: o nível 2 tem mais percussão que o 1", (id) => {
    const count = (level: MusicLevel, v: string) => run(id, level).filter((n) => n.voice === v).length;
    expect(count(2, "kick")).toBeGreaterThan(count(1, "kick"));
    expect(count(2, "hat")).toBeGreaterThan(count(1, "hat"));
  });

  it.each(TRACKS)("%s: pad e pulso não mudam com a intensidade (a base não corta)", (id) => {
    const base = (notes: NoteEvent[]) => notes.filter((n) => n.voice === "pad" || n.voice === "pulse");
    expect(base(run(id, 2))).toEqual(base(run(id, 0)));
    expect(base(run(id, 1))).toEqual(base(run(id, 0)));
  });

  it.each(TRACKS)("%s: mudar de nível no meio não perde nem repete passos", (id) => {
    const seq = new Sequencer(MUSIC[id], 0);
    const bar = barDur(id);
    const mixed = [
      ...seq.generate(bar * 2, 0),
      ...seq.generate(bar * 4, 1),
      ...seq.generate(bar * 6, 2),
      ...seq.generate(bar * 8, 0),
    ];
    const pad = mixed.filter((n) => n.voice === "pad");
    // um acorde por compasso, sempre no começo dele
    const per = MUSIC[id].chords.map((c) => c.length);
    let expected = 0;
    for (let b = 0; b < 8; b++) expected += per[b % per.length] as number;
    expect(pad).toHaveLength(expected);
    for (const n of pad) expect((n.time / bar) % 1).toBeCloseTo(0, 6);
  });

  it.each(TRACKS)("%s: toda nota com altura está na escala da trilha", (id) => {
    const scale = new Set(MUSIC[id].scale.map((s) => s % 12));
    for (const n of run(id, 2, 16)) {
      if (n.voice === "hat" || n.voice === "kick") continue;
      expect(scale.has(semitoneClass(id, n.freq)), `${id} ${n.voice} ${n.freq.toFixed(1)} Hz`).toBe(true);
    }
  });

  it("a grade é de semicolcheias: 16 passos por compasso", () => {
    expect(STEPS_PER_BAR).toBe(16);
    const kicks = run("rift", 1).filter((n) => n.voice === "kick");
    const step = 60 / MUSIC.rift.bpm / 4;
    for (const k of kicks) expect((k.time / step) % 8).toBeCloseTo(0, 6);
  });

  it("o caráter de cada mapa: o Leito é consonante, o Fosso é dissonante", () => {
    const has = (id: TrackId, s: number) => MUSIC[id].scale.includes(s);
    // segunda menor e trítono são os intervalos mais duros
    expect(has("abyss", 1) && has("abyss", 6)).toBe(true);
    expect(has("rift", 1) || has("rift", 6)).toBe(false);
    expect(has("coral", 1) || has("coral", 3)).toBe(false);
    // o Fosso tem o acorde mais apertado: uma segunda menor entre dois graus consecutivos
    const abyss = MUSIC.abyss;
    const clash = abyss.chords.some((c) => {
      const semis = c.map((d) => degreeFreq(abyss, d)).map((f) => 12 * Math.log2(f / abyss.rootHz));
      return semis.some((a, i) => semis.some((b, j) => i !== j && Math.abs(Math.abs(a - b) - 1) < 0.01));
    });
    expect(clash).toBe(true);
  });

  it("degreeFreq: passar do fim da escala sobe uma oitava", () => {
    const p = MUSIC.rift;
    expect(degreeFreq(p, 0)).toBeCloseTo(p.rootHz, 6);
    expect(degreeFreq(p, p.scale.length)).toBeCloseTo(p.rootHz * 2, 6);
    expect(degreeFreq(p, 2, 1)).toBeCloseTo(degreeFreq(p, 2) * 2, 6);
  });

  it("as trilhas são diferentes entre si", () => {
    const sig = (id: TrackId) => JSON.stringify([MUSIC[id].bpm, MUSIC[id].scale, MUSIC[id].rootHz]);
    expect(new Set(TRACKS.map(sig)).size).toBe(TRACKS.length);
  });
});
