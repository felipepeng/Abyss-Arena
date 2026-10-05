import { describe, expect, it } from "vitest";
import { PLAYER } from "../../src/config/player";
import { SPEAR } from "../../src/config/spear";
import { inDashInvuln, isInvulnerable } from "../../src/sim/player";
import { stepWorld } from "../../src/sim/world";
import { aimRight, firstEnemy, openWorld, speed, STEP, steps } from "./helpers";

// Números do CONTEXTO §3 e §4 e a única mudança aprovada (GDD §4.2). A paridade passo a
// passo com o protótipo está em parity.test.ts; aqui ficam as propriedades legíveis.

describe("nado", () => {
  it("vai de 0 a 250 px/s em ~267 ms (16 passos)", () => {
    const w = openWorld();
    let n = 0;
    while (speed(w) < PLAYER.maxSpeed - 1e-9) {
      stepWorld(w, aimRight(w, { moveX: 1 }), STEP);
      n++;
    }
    expect(n).toBe(16);
  });

  it("cai a 10% em ~700 ms e desliza ~70 px ao soltar", () => {
    const w = openWorld();
    steps(w, 30, (w) => aimRight(w, { moveX: 1 }));
    const x0 = w.player.x;
    let n = 0;
    while (speed(w) > PLAYER.maxSpeed * 0.1) {
      stepWorld(w, aimRight(w), STEP);
      n++;
    }
    expect(n * STEP).toBeCloseTo(700, -1);
    steps(w, 300, (w) => aimRight(w));
    expect(w.player.x - x0).toBeGreaterThan(65);
    expect(w.player.x - x0).toBeLessThan(78);
  });
});

describe("dash pronto de novo", () => {
  it("emite dashReady uma vez, quando a recarga acaba, e só depois de um dash", () => {
    const w = openWorld();
    let ready = 0;
    const count = () => {
      for (const e of w.events.list) if (e.t === "dashReady") ready++;
    };
    // sem dash antes, não há o que anunciar
    for (let i = 0; i < 100; i++) {
      stepWorld(w, aimRight(w), STEP);
      count();
    }
    expect(ready).toBe(0);
    stepWorld(w, aimRight(w, { dashHeld: true }), STEP);
    count();
    let ms = 0;
    while (w.player.dashCdMs > 0) {
      expect(ready).toBe(0);
      stepWorld(w, aimRight(w), STEP);
      count();
      ms += STEP;
    }
    expect(ready).toBe(1);
    expect(ms).toBeGreaterThan(PLAYER.dash.cooldownMs - 2 * STEP);
    for (let i = 0; i < 100; i++) {
      stepWorld(w, aimRight(w), STEP);
      count();
    }
    expect(ready).toBe(1);
  });
});

describe("dash", () => {
  it("percorre ~82 px nos 140 ms (89 é o nominal 640 × 0,14; o arrasto come o resto)", () => {
    const w = openWorld();
    const x0 = w.player.x;
    stepWorld(w, aimRight(w, { dashHeld: true }), STEP);
    while (w.player.dashMs > 0) stepWorld(w, aimRight(w), STEP);
    expect(w.player.x - x0).toBeCloseTo(82.4, 0);
  });

  it("é invulnerável de 0 a 100 ms e vulnerável depois", () => {
    const w = openWorld();
    const invuln: boolean[] = [];
    stepWorld(w, aimRight(w, { dashHeld: true }), STEP);
    invuln.push(isInvulnerable(w.player));
    for (let i = 0; i < 10; i++) {
      stepWorld(w, aimRight(w), STEP);
      invuln.push(inDashInvuln(w.player));
    }
    // passos 1..5 (16,7 a 83,3 ms decorridos) protegidos; a partir de 100 ms, não
    expect(invuln).toEqual([true, true, true, true, true, false, false, false, false, false, false]);
  });

  it("vai na direção da mira, não do nado", () => {
    const w = openWorld();
    stepWorld(w, { ...aimRight(w), aimX: w.player.x, aimY: w.player.y - 500, moveX: 1, dashHeld: true }, STEP);
    expect(w.player.vy).toBeLessThan(-600);
    expect(Math.abs(w.player.vx)).toBeLessThan(1e-6);
  });

  it("cancela a recuperação da lança", () => {
    const w = openWorld();
    stepWorld(w, aimRight(w, { attackPressed: true, attackHeld: true, attackPressedByMouse: true }), STEP);
    while (w.player.spear.phase !== "recovery") stepWorld(w, aimRight(w), STEP);
    stepWorld(w, aimRight(w, { dashHeld: true }), STEP);
    expect(w.player.spear.phase).toBe("idle");
  });

  it("não cancela o golpe em andamento", () => {
    const w = openWorld();
    stepWorld(w, aimRight(w, { attackPressed: true, attackHeld: true, attackPressedByMouse: true }), STEP);
    while (w.player.spear.phase !== "thrust") stepWorld(w, aimRight(w), STEP);
    stepWorld(w, aimRight(w, { dashHeld: true }), STEP);
    expect(w.player.spear.phase).toBe("thrust");
  });
});

describe("lança", () => {
  const press = { attackPressed: true, attackHeld: true, attackPressedByMouse: true };

  it("antecipação de 70 ms, golpe de 120 ms e recuperação de 180 ms", () => {
    const w = openWorld();
    const phases: string[] = [];
    stepWorld(w, aimRight(w, press), STEP);
    phases.push(w.player.spear.phase);
    for (let i = 0; i < 30; i++) {
      stepWorld(w, aimRight(w), STEP);
      phases.push(w.player.spear.phase);
    }
    const count = (p: string) => phases.filter((x) => x === p).length;
    // em passos de 16,7 ms: 4 de antecipação (a quinta já solta o golpe), 8 de golpe (7 com
    // hitbox + o que passa para a recuperação), 11 de recuperação
    expect(count("anticipation") * STEP).toBeCloseTo(SPEAR.anticipationMs, -1);
    expect(count("thrust")).toBe(8);
    expect(count("recovery") * STEP).toBeCloseTo(SPEAR.recoveryMs, -1);
  });

  it("carga cheia: alcance 92 e dano 36; meia carga interpola", () => {
    const w = openWorld();
    stepWorld(w, aimRight(w, press), STEP);
    steps(w, 40, (w) => aimRight(w, { attackHeld: true }));
    expect(w.player.spear.reach).toBeCloseTo(92);
    expect(w.player.spear.damage).toBeCloseTo(36);

    const h = openWorld();
    stepWorld(h, aimRight(h, press), STEP);
    // 300 ms de carga = metade
    steps(h, 17, (h) => aimRight(h, { attackHeld: true }));
    steps(h, 3, (h) => aimRight(h));
    expect(h.player.spear.reach).toBeCloseTo(SPEAR.reach + SPEAR.reachChargeBonus * 0.5, 0);
  });

  it("acerta cada alvo uma vez por estocada, com hit-stop e recuo", () => {
    const w = openWorld({ enemies: [{ kind: "dummyBig", x: 660, y: 600 }] });
    let hits = 0;
    let recoil = 0;
    stepWorld(w, aimRight(w, press), STEP);
    for (let i = 0; i < 40; i++) {
      if (w.hitStopMs > 0) {
        w.hitStopMs -= STEP;
        continue;
      }
      stepWorld(w, aimRight(w), STEP);
      for (const e of w.events.list) {
        if (e.t === "spearHit") {
          hits++;
          expect(w.hitStopMs).toBe(SPEAR.hitStopMs);
          recoil = w.player.vx;
        }
      }
    }
    expect(hits).toBe(1);
    // recuo de 230 px/s para trás, já com um passo de arrasto
    expect(recoil).toBeLessThan(-200);
    // o passo do clique já conta 16,7 ms de carga (como no protótipo): dano 16,56, não 16
    expect(firstEnemy(w).hp).toBeCloseTo(420 - w.player.spear.damage, 9);
    expect(w.player.spear.damage).toBeCloseTo(SPEAR.damage + SPEAR.damageChargeBonus * (STEP / SPEAR.chargeMaxMs), 9);
  });

  it("errar não dá hit-stop nem recuo", () => {
    const w = openWorld();
    stepWorld(w, aimRight(w, press), STEP);
    for (let i = 0; i < 30; i++) {
      stepWorld(w, aimRight(w), STEP);
      expect(w.hitStopMs).toBe(0);
      expect(w.player.vx).toBeGreaterThanOrEqual(0);
    }
  });

  it("uma estocada carregada mata um alvo com a vida do peixe de uma vez (36 > 34)", () => {
    const w = openWorld({ enemies: [{ kind: "dummy", x: 680, y: 600 }] });
    let deaths = 0;
    stepWorld(w, aimRight(w, press), STEP);
    for (let i = 0; i < 80; i++) {
      if (w.hitStopMs > 0) {
        w.hitStopMs -= STEP;
        continue;
      }
      stepWorld(w, aimRight(w, { attackHeld: i < 40 }), STEP);
      deaths += w.events.list.filter((e) => e.t === "enemyDied").length;
    }
    // o saco de pancada "morre" e volta cheio: a morte aparece como evento
    expect(deaths).toBe(1);
  });
});

describe("mundo", () => {
  it("é determinístico: mesma semente e mesmas entradas dão o mesmo estado", () => {
    const run = () => {
      const w = openWorld({ enemies: [{ kind: "fish", x: 760, y: 600 }, { kind: "circler", x: 500, y: 450 }], spawner: true });
      steps(w, 1200, (w, i) =>
        aimRight(w, {
          moveX: i % 50 < 25 ? 1 : -1,
          moveY: i % 30 < 10 ? 1 : 0,
          dashHeld: i % 70 === 0,
          attackPressed: i % 23 === 0,
          attackHeld: i % 23 < 5,
          attackPressedByMouse: true,
        }),
      );
      const p = w.player;
      const foes = Array.from({ length: w.enemies.count }, (_, i) => w.enemies.get(i)).map((e) => [e.kind, e.x, e.y, e.hp, e.state]);
      return [p.x, p.y, p.vx, p.vy, p.hp, p.spear.phase, w.camera.x, w.camera.y, foes, w.projectiles.count, w.pickups.count];
    };
    expect(run()).toEqual(run());
  });
});
