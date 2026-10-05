import { describe, expect, it } from "vitest";
import { AudioEngine, gain } from "../../src/audio/engine";
import type { AmbienceDef } from "../../src/config/ambience";
import { ProceduralMusic } from "../../src/audio/music";
import type { AmbienceSource, MusicSource, WaterSource } from "../../src/audio/sources";
import { AUDIO } from "../../src/config/audio";
import { AMBIENCE } from "../../src/config/ambience";
import { MUSIC, MUSIC_LAYERS, type MusicLevel, type MusicParams } from "../../src/config/music";
import { SFX } from "../../src/config/sfx";
import { Settings } from "../../src/core/settings";
import type { SimEvent } from "../../src/sim/events";
import { asAudio, FakeContext } from "./fakeContext";

// O motor (ARCHITECTURE §8): contexto no primeiro gesto, barramentos de música e efeitos, o
// volume das configurações, troca de trilha sem recomeço e o teto de vozes.

class SpyMusic implements MusicSource {
  started = 0;
  stopped: number[] = [];
  levels: MusicLevel[] = [];
  constructor(readonly params: MusicParams) {}
  start(): void {
    this.started++;
  }
  setIntensity(level: MusicLevel): void {
    this.levels.push(level);
  }
  stop(fadeMs: number): void {
    this.stopped.push(fadeMs);
  }
}

/** Ambiente de mentira: só conta o que o motor pediu (o de verdade tem o seu arquivo de testes). */
class SpyAmbience implements AmbienceSource {
  started = 0;
  stopped: number[] = [];
  constructor(readonly def: AmbienceDef) {}
  start(): void {
    this.started++;
  }
  stop(fadeMs: number): void {
    this.stopped.push(fadeMs);
  }
}

/** Água de mentira: só conta o que o motor pediu (a de verdade tem o seu arquivo de testes). */
class SpyWater implements WaterSource {
  started = 0;
  levels: number[] = [];
  stopped: number[] = [];
  start(): void {
    this.started++;
  }
  setLevel(level: number): void {
    this.levels.push(level);
  }
  stop(fadeMs: number): void {
    this.stopped.push(fadeMs);
  }
}

function setup(opts: { noContext?: boolean } = {}) {
  const ambiences: SpyAmbience[] = [];
  const waters: SpyWater[] = [];
  const ctx = new FakeContext();
  const settings = new Settings();
  const made: SpyMusic[] = [];
  let contexts = 0;
  const engine = new AudioEngine(
    settings,
    () => {
      contexts++;
      return opts.noContext ? null : asAudio(ctx);
    },
    () => 0.5,
    (p) => {
      const m = new SpyMusic(p);
      made.push(m);
      return m;
    },
    (d) => {
      const a = new SpyAmbience(d);
      ambiences.push(a);
      return a;
    },
    () => {
      const w = new SpyWater();
      waters.push(w);
      return w;
    },
  );
  return { ctx, settings, engine, made, ambiences, waters, contexts: () => contexts };
}

const at = { x: 0, y: 0 };
const ev = {
  thrust: { t: "thrust", ...at, dirX: 1, dirY: 0, charge: 0 } as SimEvent,
  charge: { t: "chargeStart", ...at } as SimEvent,
  hit: { t: "spearHit", ...at, dirX: 1, dirY: 0, targetR: 10 } as SimEvent,
  died: { t: "enemyDied", ...at, radius: 10, kind: "fish" } as SimEvent,
  dash: { t: "dash", ...at, dirX: 1, dirY: 0 } as SimEvent,
  hurt: { t: "playerHurt", ...at, amount: 5 } as SimEvent,
};

describe("primeiro gesto", () => {
  it("nada toca nem quebra antes do gesto; o contexto nasce uma vez só", () => {
    const { engine, ctx, contexts } = setup();
    expect(engine.unlocked).toBe(false);
    engine.onEvents([ev.hit, ev.dash]);
    engine.ui("move");
    engine.playTrack("menu");
    engine.setIntensity(1);
    expect(ctx.sources).toBe(0);
    expect(contexts()).toBe(0);

    engine.unlock();
    engine.unlock();
    engine.unlock();
    expect(engine.unlocked).toBe(true);
    expect(contexts()).toBe(1);
    expect(ctx.state).toBe("running");
  });

  it("a trilha pedida antes do gesto começa quando o contexto nasce", () => {
    const { engine, made } = setup();
    engine.playTrack("rift");
    expect(made).toHaveLength(0);
    engine.unlock();
    expect(made).toHaveLength(1);
    expect(made[0]?.params).toBe(MUSIC.rift);
    expect(made[0]?.started).toBe(1);
  });

  it("sem Web Audio no navegador, nada quebra", () => {
    const { engine } = setup({ noContext: true });
    engine.unlock();
    engine.playTrack("menu");
    engine.onEvents([ev.hit]);
    engine.ui("confirm");
    engine.update();
    engine.setHidden(true);
    expect(engine.unlocked).toBe(false);
  });
});

describe("volume", () => {
  it("música e efeitos têm ganhos separados, com a curva do volume", () => {
    const { engine, ctx, settings } = setup();
    engine.unlock();
    // ordem de criação em unlock(): master, barramento de efeitos, barramento de música
    const [, sfx, music] = ctx.gains;
    settings.setMusicVolume(0.5);
    settings.setSfxVolume(1);
    engine.update();
    expect(music?.gain.calls.at(-1)?.args[0]).toBeCloseTo(gain(0.5), 9);
    expect(sfx?.gain.calls.at(-1)?.args[0]).toBeCloseTo(1, 9);
    expect(gain(0.5)).toBeCloseTo(0.5 ** AUDIO.volumeCurve, 9);
    settings.setMusicVolume(0);
    engine.update();
    expect(music?.gain.calls.at(-1)?.args[0]).toBe(0);
    // os efeitos não mexeram
    expect(sfx?.gain.calls.at(-1)?.args[0]).toBeCloseTo(1, 9);
  });

  it("só mexe nos ganhos quando o volume muda", () => {
    const { engine, ctx, settings } = setup();
    engine.unlock();
    const music = ctx.gains[2];
    engine.update();
    const before = music?.gain.count("target") ?? 0;
    for (let i = 0; i < 50; i++) engine.update();
    expect(music?.gain.count("target")).toBe(before);
    settings.setMusicVolume(0.2);
    engine.update();
    expect(music?.gain.count("target")).toBe(before + 1);
  });

  it("aba escondida suspende o áudio, e voltar retoma", () => {
    const { engine, ctx } = setup();
    engine.unlock();
    engine.setHidden(true);
    expect(ctx.suspended).toBe(1);
    engine.setHidden(false);
    expect(ctx.state).toBe("running");
  });
});

describe("trilhas e intensidade", () => {
  it("pedir a mesma trilha de novo não recomeça a música (tentar de novo)", () => {
    const { engine, made } = setup();
    engine.unlock();
    engine.playTrack("coral");
    engine.playTrack("coral");
    engine.playTrack("coral");
    expect(made).toHaveLength(1);
  });

  it("trocar de trilha desvanece a antiga e começa a nova", () => {
    const { engine, made } = setup();
    engine.unlock();
    engine.playTrack("menu");
    engine.playTrack("rift");
    expect(made).toHaveLength(2);
    expect(made[0]?.stopped).toEqual([AUDIO.trackFadeMs]);
    expect(made[1]?.started).toBe(1);
    expect(made[1]?.stopped).toEqual([]);
  });

  it("a intensidade só chega à trilha quando muda, e a trilha nova começa nas ondas", () => {
    const { engine, made } = setup();
    engine.unlock();
    engine.playTrack("abyss");
    const music = made[0] as SpyMusic;
    for (let i = 0; i < 30; i++) engine.setIntensity(0);
    engine.setIntensity(1);
    engine.setIntensity(1);
    engine.setIntensity(2);
    expect(music.levels).toEqual([0, 1, 2]);
    engine.playTrack("menu");
    expect(made[1]?.levels).toEqual([0]);
  });
});

describe("ambiente dos mapas", () => {
  it("cada mapa começa o seu ambiente com a trilha; o menu não tem", () => {
    const { engine, ambiences } = setup();
    engine.unlock();
    engine.playTrack("menu");
    expect(ambiences).toHaveLength(0);
    for (const id of ["rift", "coral", "abyss"] as const) {
      engine.playTrack(id);
      expect(ambiences.at(-1)?.def).toBe(AMBIENCE[id]);
    }
    expect(ambiences).toHaveLength(3);
    expect(ambiences.every((a) => a.started === 1)).toBe(true);
  });

  it("trocar de trilha some com o ambiente antigo; repetir a trilha não o recomeça", () => {
    const { engine, ambiences } = setup();
    engine.unlock();
    engine.playTrack("coral");
    engine.playTrack("coral");
    expect(ambiences).toHaveLength(1);
    expect(ambiences[0]?.stopped).toEqual([]);
    engine.playTrack("menu");
    expect(ambiences[0]?.stopped).toEqual([AUDIO.trackFadeMs]);
  });

  it("o ambiente pedido antes do primeiro gesto começa quando o contexto nasce", () => {
    const { engine, ambiences } = setup();
    engine.playTrack("abyss");
    expect(ambiences).toHaveLength(0);
    engine.unlock();
    expect(ambiences).toHaveLength(1);
  });
});

describe("cena de descida: sem música e só a água", () => {
  it("stopTrack desvanece a música e o ambiente; a mesma trilha pode recomeçar depois", () => {
    const { engine, made, ambiences } = setup();
    engine.unlock();
    engine.playTrack("rift");
    engine.stopTrack();
    expect(made[0]?.stopped).toEqual([AUDIO.trackFadeMs]);
    expect(ambiences[0]?.stopped).toEqual([AUDIO.trackFadeMs]);
    engine.playTrack("rift"); // a fase seguinte pede a sua trilha
    expect(made).toHaveLength(2);
    expect(made[1]?.started).toBe(1);
  });

  it("uma trilha pedida e depois cancelada antes do primeiro gesto não começa", () => {
    const { engine, made } = setup();
    engine.playTrack("rift");
    engine.stopTrack();
    engine.unlock();
    expect(made).toHaveLength(0);
  });

  it("a água começa na primeira chamada, só muda o nível nas seguintes e some com fade", () => {
    const { engine, waters } = setup();
    engine.water(0.2); // antes do gesto: nada
    expect(waters).toHaveLength(0);
    engine.unlock();
    engine.water(0.2);
    engine.water(0.6);
    engine.water(1);
    expect(waters).toHaveLength(1);
    expect(waters[0]?.started).toBe(1);
    expect(waters[0]?.levels).toEqual([0.2, 0.6, 1]);
    engine.stopWater();
    expect(waters[0]?.stopped).toEqual([AUDIO.trackFadeMs]);
    engine.stopWater(); // sem água: nada quebra
    engine.water(0.5); // outra descida: água nova
    expect(waters).toHaveLength(2);
  });
});

describe("sons de interface", () => {
  it("cada som de interface toca o efeito certo", () => {
    const names = { move: "menuMove", confirm: "menuConfirm", back: "menuBack", pause: "pause", resume: "resume", title: "mapTitle" } as const;
    for (const [kind, name] of Object.entries(names)) {
      const { engine, ctx } = setup();
      engine.unlock();
      engine.ui(kind as keyof typeof names);
      expect(ctx.sources, kind).toBeGreaterThan(0);
      // a primeira fonte tem a frequência inicial da primeira camada do som esperado (±5%)
      const first = SFX[name].layers.find((l) => l.kind === "osc")?.freq?.[0] as number;
      const got = ctx.oscs[0]?.frequency.calls[0]?.args[0] as number;
      if (SFX[name].layers[0]?.kind === "osc") expect(got / first, kind).toBeCloseTo(1, 1);
    }
  });
});

describe("efeitos", () => {
  it("um evento com som cria fontes de som; um sem som não cria nada", () => {
    const { engine, ctx } = setup();
    engine.unlock();
    engine.onEvents([{ t: "spawnWarn", ...at }]);
    expect(ctx.sources).toBe(0);
    engine.onEvents([ev.hit]);
    expect(ctx.sources).toBeGreaterThan(0);
  });

  it("o intervalo mínimo segura um enxame do mesmo som", () => {
    const { engine, ctx } = setup();
    engine.unlock();
    engine.onEvents([ev.died, ev.died, ev.died, ev.died]);
    const one = ctx.sources;
    expect(one).toBeGreaterThan(0);
    ctx.currentTime = 1;
    engine.onEvents([ev.died]);
    expect(ctx.sources).toBe(one * 2);
  });

  it("o teto de vozes barra os sons comuns, mas não os de prioridade", () => {
    const { engine, ctx } = setup();
    engine.unlock();
    // "dash" não tem intervalo mínimo nem prioridade: só o teto o segura
    for (let i = 0; i < 100; i++) engine.onEvents([ev.dash]);
    const capped = ctx.sources;
    expect(capped).toBeLessThanOrEqual(AUDIO.maxVoices * 2);
    // o dano e os avisos de chefe passam do teto
    engine.onEvents([ev.hurt]);
    expect(ctx.sources).toBeGreaterThan(capped);
  });

  it("o tom da carga acaba na hora em que a estocada sai", () => {
    const { engine, ctx } = setup();
    engine.unlock();
    engine.onEvents([ev.charge]);
    const env = ctx.gains.at(-1);
    expect(env?.gain.count("target")).toBe(0);
    ctx.currentTime = 0.15;
    engine.onEvents([ev.thrust]);
    expect(env?.gain.count("cancel")).toBe(1);
    expect(env?.gain.calls.at(-1)?.fn).toBe("target");
    expect(env?.gain.calls.at(-1)?.args[0]).toBe(0);
  });

  it("os cliques do menu soam ao navegar e ao confirmar", () => {
    const { engine, ctx } = setup();
    engine.unlock();
    engine.ui("move");
    const afterMove = ctx.sources;
    expect(afterMove).toBeGreaterThan(0);
    ctx.currentTime = 1;
    engine.ui("confirm");
    expect(ctx.sources).toBeGreaterThan(afterMove);
  });

  it("o relógio é o do áudio, não o da simulação: o hit-stop não o congela", () => {
    // o motor só lê ctx.currentTime; um evento do passo em que o hit-stop começa toca na hora
    const { engine, ctx } = setup();
    engine.unlock();
    ctx.currentTime = 3;
    engine.onEvents([ev.hit]);
    expect(ctx.oscs[0]?.startedAt).toBe(3);
  });
});

describe("música procedural no contexto de mentira", () => {
  const start = (level: MusicLevel = 0) => {
    const ctx = new FakeContext();
    const out = ctx.createGain();
    const music = new ProceduralMusic(MUSIC.rift, { autoSchedule: false, random: () => 0.5 });
    music.setIntensity(level);
    music.start(asAudio(ctx), out as unknown as AudioNode);
    return { ctx, out, music };
  };

  it("começa em silêncio e sobe (sem estalo), e agenda notas à frente", () => {
    const { ctx, music } = start();
    const master = ctx.gains[1];
    expect(master?.gain.calls[0]?.args[0]).toBeLessThan(0.001);
    expect(master?.gain.calls[1]?.fn).toBe("linear");
    expect(ctx.sources).toBeGreaterThan(0);
    const before = ctx.sources;
    ctx.currentTime = 5;
    music.schedule(5);
    expect(ctx.sources).toBeGreaterThan(before);
  });

  it("mudar a intensidade ajusta o ganho das camadas em rampa, sem parar nada", () => {
    const { ctx, music } = start(0);
    // barramentos criados depois do master: pad, pulso, baixo, tema, percussão, arpejo
    const [, , pad, pulse, bass, lead, perc, arp] = ctx.gains;
    expect(perc?.gain.value).toBe(MUSIC_LAYERS.gains[0].perc);
    const stopsBefore = ctx.oscs.filter((o) => o.stoppedAt === 0).length;
    music.setIntensity(2);
    for (const bus of [pad, pulse, bass, lead, perc, arp]) expect(bus?.gain.calls.at(-1)?.fn).toBe("target");
    expect(perc?.gain.calls.at(-1)?.args[0]).toBe(MUSIC_LAYERS.gains[2].perc);
    expect(arp?.gain.calls.at(-1)?.args[0]).toBe(MUSIC_LAYERS.gains[2].arp);
    expect(bass?.gain.calls.at(-1)?.args[0]).toBe(MUSIC_LAYERS.gains[2].bass);
    expect(lead?.gain.calls.at(-1)?.args[0]).toBe(MUSIC_LAYERS.gains[2].lead);
    expect(arp?.gain.calls.at(-1)?.args[2]).toBe(MUSIC_LAYERS.rampS);
    expect(ctx.oscs.filter((o) => o.stoppedAt === 0).length).toBe(stopsBefore);
  });

  it("a percussão e o arpejo só são gerados nos níveis altos", () => {
    const count = (level: MusicLevel) => {
      const { ctx, music } = start(level);
      for (let t = 0; t < 6; t += 0.4) {
        ctx.currentTime = t;
        music.schedule(t);
      }
      return ctx.sources;
    };
    expect(count(1)).toBeGreaterThan(count(0));
    expect(count(2)).toBeGreaterThan(count(1));
  });

  it("stop() desvanece o master e depois de parar não agenda mais nada", () => {
    const { ctx, music } = start();
    const master = ctx.gains[1];
    music.stop(800);
    expect(master?.gain.calls.at(-1)?.fn).toBe("target");
    expect(master?.gain.calls.at(-1)?.args[0]).toBe(0);
    const before = ctx.sources;
    ctx.currentTime = 9;
    music.schedule(9);
    expect(ctx.sources).toBe(before);
  });
});
