import { describe, expect, it } from "vitest";
import { soundFor } from "../../src/audio/soundMap";
import { createNoiseBuffer, playSfx } from "../../src/audio/synth";
import { AUDIO } from "../../src/config/audio";
import { SFX, WARN_KEYS, type SfxName } from "../../src/config/sfx";
import { BOSS_DEFS } from "../../src/sim/bosses/registry";
import type { SimEvent } from "../../src/sim/events";
import { asAudio, FakeContext, type FakeOsc } from "./fakeContext";

// Os efeitos (GDD §10.1): cada evento da lista tem som, cada aviso de chefe tem o seu, e a
// síntese aplica a variação de ±5%.

const NAMES = Object.keys(SFX) as SfxName[];

describe("definições dos sons", () => {
  it.each(NAMES)("%s: camadas válidas", (name) => {
    const def = SFX[name];
    expect(def.layers.length).toBeGreaterThan(0);
    for (const l of def.layers) {
      expect(l.durMs).toBeGreaterThan(0);
      expect(l.gain).toBeGreaterThan(0);
      expect(l.gain).toBeLessThanOrEqual(1);
      expect((l.delayMs ?? 0) + l.durMs).toBeLessThanOrEqual(1600);
      // a rampa exponencial não aceita zero nem negativo
      for (const f of l.freq ?? []) expect(f).toBeGreaterThan(0);
      for (const f of l.filter?.freq ?? []) expect(f).toBeGreaterThan(0);
      if (l.kind === "osc") expect(l.freq).toBeDefined();
    }
  });

  it("os efeitos comuns duram no máximo 1 s (só a morte do jogador e as do chefe são mais longas)", () => {
    for (const name of NAMES) {
      const total = Math.max(...SFX[name].layers.map((l) => (l.delayMs ?? 0) + l.durMs));
      if (name === "bossDie" || name === "bossAppear" || name === "playerDie") continue;
      expect(total, name).toBeLessThanOrEqual(1000);
    }
  });

  it("o acerto da lança é grave e macio: sem onda áspera nem ruído agudo, e com o pico contido", () => {
    // acontece várias vezes por segundo; um estalo agudo e alto cansa (e machuca) o ouvido
    const layers = SFX.hit.layers;
    for (const l of layers) {
      expect(l.wave === "square" || l.wave === "sawtooth", "onda áspera").toBe(false);
      expect(l.filter?.type === "highpass", "filtro passa-altas").toBe(false);
      // nenhuma camada sobe muito acima de 1 kHz
      for (const f of l.freq ?? []) expect(f).toBeLessThanOrEqual(1000);
    }
    expect(layers.reduce((s, l) => s + l.gain, 0)).toBeLessThanOrEqual(0.85);
    // a camada de baque grave existe: é ela que dá o impacto
    expect(layers.some((l) => l.kind === "osc" && (l.freq?.[1] ?? 999) <= 60)).toBe(true);
    // e um acerto duplo no mesmo instante não soma dois baques
    expect(SFX.hit.minGapMs).toBeGreaterThan(0);
  });

  it("há exatamente 11 avisos de chefe, todos com definição", () => {
    expect(WARN_KEYS).toHaveLength(11);
    for (const k of WARN_KEYS) expect(SFX[k]).toBeDefined();
  });
});

describe("evento → som", () => {
  const at = { x: 0, y: 0 };
  /** Um evento por linha da tabela do GDD §10.1. */
  const TABLE: readonly [string, SimEvent, SfxName][] = [
    ["estocada (início)", { t: "thrust", ...at, dirX: 1, dirY: 0, charge: 0 }, "thrust"],
    ["estocada carregando", { t: "chargeStart", ...at }, "charge"],
    ["acerto da lança", { t: "spearHit", ...at, dirX: 1, dirY: 0, targetR: 10 }, "hit"],
    ["estourar projétil", { t: "projectilePopped", ...at, color: "#fff" }, "pop"],
    ["bloqueio do Ermitão", { t: "spearBlocked", ...at }, "block"],
    ["dash", { t: "dash", ...at, dirX: 1, dirY: 0 }, "dash"],
    ["jogador ferido", { t: "playerHurt", ...at, amount: 5 }, "hurt"],
    ["coletar cura", { t: "pickup", ...at, amount: 12 }, "pickup"],
    ["morte de inimigo", { t: "enemyDied", ...at, radius: 10, kind: "fish" }, "enemyDie"],
    ["morte do chefe", { t: "bossDied", ...at, radius: 40, boss: "crab" }, "bossDie"],
    ["morte do jogador", { t: "playerDied", ...at }, "playerDie"],
    ["chefe entra", { t: "bossAppeared", ...at, boss: "eye" }, "bossAppear"],
    ["chefe muda de fase", { t: "bossPhase", ...at, boss: "eye", phase: 1 }, "bossPhase"],
    ["investida do chefe bate na rocha", { t: "bossImpact", ...at, boss: "crab" }, "bossImpact"],
  ];

  it.each(TABLE)("%s tem som", (_row, event, name) => {
    expect(soundFor(event)).toBe(name);
  });

  it("todo ataque de todo chefe tem o seu aviso, e os sons são diferentes entre si", () => {
    const seen = new Set<string>();
    for (const [kind, def] of Object.entries(BOSS_DEFS)) {
      for (const attack of Object.keys(def.attacks)) {
        const name = soundFor({ t: "telegraph", ...at, source: kind as "crab", attack });
        expect(name, `${kind}.${attack}`).not.toBeNull();
        expect(seen.has(name as string), `${kind}.${attack} repete um som`).toBe(false);
        seen.add(name as string);
      }
    }
    expect(seen.size).toBe(WARN_KEYS.length);
  });

  it("o nascimento de inimigos comuns não faz som (o redemoinho de bolhas é só visual)", () => {
    expect(soundFor({ t: "spawnWarn", ...at })).toBeNull();
  });

  it("os avisos dos inimigos comuns não têm som (são visuais)", () => {
    expect(soundFor({ t: "telegraph", ...at, source: "fish", attack: "charge" })).toBeNull();
    expect(soundFor({ t: "telegraph", ...at, source: "hermit", attack: "claw" })).toBeNull();
  });

  it("o menu tem os dois cliques", () => {
    expect(SFX.menuMove).toBeDefined();
    expect(SFX.menuConfirm).toBeDefined();
  });
});

describe("síntese", () => {
  const setup = () => {
    const ctx = new FakeContext();
    const out = ctx.createGain();
    const noise = createNoiseBuffer(asAudio(ctx), 0.1, () => 0.5);
    return { ctx, out, noise };
  };

  it("uma fonte por camada, ligada à saída, iniciada e parada", () => {
    const { ctx, out, noise } = setup();
    ctx.currentTime = 2;
    const voice = playSfx(asAudio(ctx), out as unknown as AudioNode, SFX.hit, { random: () => 0.5, noise });
    const layers = SFX.hit.layers.length;
    expect(ctx.sources).toBe(layers);
    for (const o of ctx.oscs) {
      expect(o.startedAt).toBeGreaterThanOrEqual(2);
      expect(o.stoppedAt).toBeGreaterThan(o.startedAt ?? 0);
    }
    for (const b of ctx.buffers) expect(b.loop).toBe(true);
    // cada camada tem um envelope ligado à saída
    expect(ctx.gains.filter((g) => g !== out && g.out.includes(out))).toHaveLength(layers);
    expect(voice.endTime).toBeCloseTo(2 + Math.max(...SFX.hit.layers.map((l) => (l.delayMs ?? 0) + l.durMs)) / 1000, 6);
  });

  it("a variação de altura é de ±5% e vale para o som inteiro", () => {
    const first = (name: SfxName, r: number): FakeOsc[] => {
      const { ctx, out, noise } = setup();
      playSfx(asAudio(ctx), out as unknown as AudioNode, SFX[name], { random: () => r, noise });
      return ctx.oscs;
    };
    const lo = first("pickup", 0);
    const mid = first("pickup", 0.5);
    const hi = first("pickup", 1);
    for (let i = 0; i < mid.length; i++) {
      const base = mid[i]?.frequency.calls[0]?.args[0] as number;
      expect((lo[i]?.frequency.calls[0]?.args[0] as number) / base).toBeCloseTo(1 - AUDIO.pitchVariation, 6);
      expect((hi[i]?.frequency.calls[0]?.args[0] as number) / base).toBeCloseTo(1 + AUDIO.pitchVariation, 6);
    }
    // o acorde continua afinado: as razões entre as notas não mudam
    const ratio = (o: FakeOsc[]) => (o[1]?.frequency.calls[0]?.args[0] as number) / (o[0]?.frequency.calls[0]?.args[0] as number);
    expect(ratio(lo)).toBeCloseTo(ratio(hi), 6);
  });

  it("o envelope sobe do silêncio e decai em exponencial até o silêncio", () => {
    const { ctx, out, noise } = setup();
    playSfx(asAudio(ctx), out as unknown as AudioNode, SFX.thrust, { random: () => 0.5, noise });
    const env = ctx.gains.find((g) => g !== out && g.out.includes(out));
    const calls = env?.gain.calls ?? [];
    expect(calls[0]?.fn).toBe("set");
    expect(calls[0]?.args[0]).toBeLessThan(0.001);
    expect(calls.at(-1)?.fn).toBe("exp");
    expect(calls.at(-1)?.args[0]).toBeLessThan(0.001);
  });

  it("as camadas com atraso começam depois (o acorde de cura sobe nota a nota)", () => {
    const { ctx, out, noise } = setup();
    ctx.currentTime = 1;
    playSfx(asAudio(ctx), out as unknown as AudioNode, SFX.pickup, { random: () => 0.5, noise });
    const starts = ctx.oscs.map((o) => o.startedAt as number);
    expect(starts[0]).toBeCloseTo(1, 6);
    expect(starts[1]).toBeCloseTo(1.07, 6);
    expect(starts[2]).toBeCloseTo(1.14, 6);
    expect(ctx.oscs.map((o) => o.frequency.calls[0]?.args[0] as number)).toEqual(
      [...ctx.oscs.map((o) => o.frequency.calls[0]?.args[0] as number)].sort((a, b) => a - b),
    );
  });

  it("stop() corta o som com uma soltura curta", () => {
    const { ctx, out, noise } = setup();
    const voice = playSfx(asAudio(ctx), out as unknown as AudioNode, SFX.charge, { random: () => 0.5, noise });
    ctx.currentTime = 0.2;
    voice.stop();
    const env = ctx.gains.find((g) => g !== out && g.out.includes(out));
    expect(env?.gain.count("cancel")).toBe(1);
    expect(env?.gain.calls.at(-1)?.fn).toBe("target");
    expect(env?.gain.calls.at(-1)?.args[0]).toBe(0);
    expect(ctx.oscs[0]?.stoppedAt).toBeCloseTo(0.2 + AUDIO.releaseS * 2, 6);
  });
});
