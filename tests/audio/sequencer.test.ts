import { describe, expect, it } from "vitest";
import { degreeFreq, parseBar, Sequencer, STEPS_PER_BAR, type NoteEvent } from "../../src/audio/sequencer";
import { MUSIC, type MusicLevel, type TrackId } from "../../src/config/music";

// A música procedural (GDD §10.2): o sequenciador é puro, então dá para provar as camadas, a
// escala de cada mapa e o determinismo sem nenhum som.

const TRACKS = Object.keys(MUSIC) as TrackId[];
// as trilhas de fase têm chefe (e por isso camadas de intensidade); a do menu fica nas ondas
const PHASE_TRACKS = TRACKS.filter((id) => MUSIC[id].boss);
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

  it.each(PHASE_TRACKS)("%s: as camadas se somam com a intensidade", (id) => {
    expect(voices(run(id, 0))).toEqual(new Set(["pad", "pulse", "lead"]));
    expect(voices(run(id, 1))).toEqual(new Set(["pad", "pulse", "lead", "bass", "kick", "snare", "hat"]));
    expect(voices(run(id, 2))).toEqual(new Set(["pad", "pulse", "lead", "bass", "kick", "snare", "hat", "arp"]));
  });

  it("o menu não tem chefe: fica nas ondas em qualquer nível", () => {
    expect(MUSIC.menu.boss).toBeUndefined();
    for (const level of [0, 1, 2] as const) {
      expect(voices(run("menu", level))).toEqual(new Set(["pad", "pulse", "lead"]));
    }
  });

  it.each(PHASE_TRACKS)("%s: o nível 2 tem mais percussão que o 1", (id) => {
    const count = (level: MusicLevel, v: string) => run(id, level).filter((n) => n.voice === v).length;
    expect(count(2, "kick")).toBeGreaterThan(count(1, "kick"));
    expect(count(2, "snare")).toBeGreaterThan(count(1, "snare"));
    expect(count(2, "hat")).toBeGreaterThan(count(1, "hat"));
  });

  it.each(PHASE_TRACKS)("%s: quanto mais alto o nível, mais notas", (id) => {
    const total = (level: MusicLevel) => run(id, level, 8).length;
    expect(total(1)).toBeGreaterThan(total(0) * 1.5);
    expect(total(2)).toBeGreaterThan(total(1));
  });

  it.each(PHASE_TRACKS)("%s: o tema do chefe é outro, mais cheio e mais brilhante que o das ondas", (id) => {
    const lead = (level: MusicLevel) => run(id, level, 8).filter((n) => n.voice === "lead");
    const waves = lead(0);
    const boss = lead(1);
    expect(boss.map((n) => n.freq)).not.toEqual(waves.map((n) => n.freq));
    expect(boss.length).toBeGreaterThan(waves.length);
    const [low, mid, high] = MUSIC[id].leadCutoffHz;
    expect(low).toBeLessThan(mid);
    expect(mid).toBeLessThan(high);
  });

  it.each(PHASE_TRACKS)("%s: no nível 2 o tema é dobrado uma oitava acima", (id) => {
    const lead = (level: MusicLevel) => run(id, level, 8).filter((n) => n.voice === "lead");
    const l1 = lead(1);
    const l2 = lead(2);
    expect(l2).toHaveLength(l1.length * 2);
    // cada nota vem seguida da sua cópia uma oitava acima
    for (let i = 0; i < l2.length; i += 2) {
      const base = l2[i] as NoteEvent;
      const top = l2[i + 1] as NoteEvent;
      expect(top.time).toBe(base.time);
      expect(top.freq).toBeCloseTo(base.freq * 2, 6);
    }
  });

  it.each(PHASE_TRACKS)("%s: o baixo parte da fundamental do acorde e fica audível", (id) => {
    const p = MUSIC[id];
    const bass = run(id, 1, 8).filter((n) => n.voice === "bass");
    expect(bass.length).toBeGreaterThan(8);
    for (const n of bass) {
      expect(n.freq).toBeGreaterThan(60);
      expect(n.freq).toBeLessThan(degreeFreq(p, 12));
    }
    // a primeira nota de cada compasso cai na fundamental do acorde (grau relativo 0)
    for (let bar = 0; bar < 8; bar++) {
      const first = bass.find((n) => Math.abs(n.time - bar * barDur(id)) < 1e-6);
      const root = (p.chords[bar % p.chords.length] as readonly number[])[0] as number;
      expect(first?.freq).toBeCloseTo(degreeFreq(p, root), 6);
    }
  });

  it.each(TRACKS)("%s: nenhuma voz com altura sai da faixa audível", (id) => {
    for (const n of run(id, 2, 16)) {
      if (n.freq === 0) continue;
      expect(n.freq, id + " " + n.voice).toBeGreaterThan(60);
      expect(n.freq, id + " " + n.voice).toBeLessThan(4000);
    }
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
      if (n.voice === "hat" || n.voice === "kick" || n.voice === "snare") continue;
      expect(scale.has(semitoneClass(id, n.freq)), `${id} ${n.voice} ${n.freq.toFixed(1)} Hz`).toBe(true);
    }
  });

  it("a grade é de semicolcheias: 16 passos por compasso", () => {
    expect(STEPS_PER_BAR).toBe(16);
    const step = 60 / MUSIC.rift.bpm / 4;
    const kicks = run("rift", 1).filter((n) => n.voice === "kick");
    const wanted = new Set(MUSIC.rift.boss?.drums.kick[1]);
    expect(kicks.length).toBeGreaterThan(0);
    for (const k of kicks) {
      const slot = Math.round(k.time / step);
      expect(k.time / step).toBeCloseTo(slot, 6);
      expect(wanted.has(slot % STEPS_PER_BAR)).toBe(true);
    }
  });

  it.each(TRACKS)("%s: as linhas escritas são válidas e casam com a progressão", (id) => {
    const p = MUSIC[id];
    // um tema por compasso da progressão, senão o ciclo do tema e o dos acordes se descolam
    expect(p.theme).toHaveLength(p.chords.length);
    for (const bar of p.theme) expect(() => parseBar(bar)).not.toThrow();
    expect(p.theme.some((b) => parseBar(b).length > 0)).toBe(true);
    if (!p.boss) return;
    expect(p.boss.theme).toHaveLength(p.chords.length);
    for (const bar of [...p.boss.theme, ...p.boss.bass]) expect(() => parseBar(bar)).not.toThrow();
    for (const bar of p.boss.bass) expect(parseBar(bar).length).toBeGreaterThan(0);
    for (const kit of Object.values(p.boss.drums)) {
      for (const steps of [kit[1], kit[2]]) {
        expect(steps.length).toBeGreaterThan(0);
        for (const s of steps) {
          expect(s).toBeGreaterThanOrEqual(0);
          expect(s).toBeLessThan(STEPS_PER_BAR);
        }
      }
    }
  });

  it("parseBar: lê passo, grau e duração; texto vazio é pausa; erro grita", () => {
    expect(parseBar("")).toEqual([]);
    expect(parseBar("0:4/6 8:-1 12:2/4")).toEqual([
      { step: 0, degree: 4, len: 6 },
      { step: 8, degree: -1, len: 2 },
      { step: 12, degree: 2, len: 4 },
    ]);
    expect(() => parseBar("0-4")).toThrow();
    expect(() => parseBar("16:0/1")).toThrow();
    expect(() => parseBar("14:0/4")).toThrow();
    expect(() => parseBar("0:0/0")).toThrow();
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

  it("cada fase tem a sua melodia, nas ondas e no chefe, e a sua bateria", () => {
    const themes = TRACKS.map((id) => JSON.stringify(MUSIC[id].theme));
    expect(new Set(themes).size).toBe(TRACKS.length);
    const fights = PHASE_TRACKS.map((id) => JSON.stringify(MUSIC[id].boss?.theme));
    expect(new Set(fights).size).toBe(PHASE_TRACKS.length);
    const drums = PHASE_TRACKS.map((id) => JSON.stringify(MUSIC[id].boss?.drums));
    expect(new Set(drums).size).toBe(PHASE_TRACKS.length);
  });
});
