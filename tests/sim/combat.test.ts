import { describe, expect, it } from "vitest";
import { HEAL } from "../../src/config/pickups";
import { PLAYER } from "../../src/config/player";
import { PROJECTILES } from "../../src/config/combat";
import { hurtPlayer } from "../../src/sim/combat";
import { spawnEnemy } from "../../src/sim/enemies/runner";
import { dropHeal } from "../../src/sim/pickups";
import { fireProjectile } from "../../src/sim/projectiles";
import { stepWorld } from "../../src/sim/world";
import { Cell } from "../../src/world/grid";
import { aimRight, openGrid, openWorld, pinRng, STEP, steps } from "./helpers";

describe("funil de dano", () => {
  it("dá 667 ms de invulnerabilidade depois de qualquer dano", () => {
    const w = openWorld();
    expect(hurtPlayer(w, 10, 0, 600)).toBe(true);
    expect(hurtPlayer(w, 10, 0, 600)).toBe(false);
    expect(w.player.hp).toBe(PLAYER.hp - 10);
    // 40 passos são 666,7 ms, ainda menos que 667: a janela só acaba no 41º (como no protótipo)
    steps(w, 40, (w) => aimRight(w));
    expect(hurtPlayer(w, 10, 0, 600)).toBe(false);
    steps(w, 1, (w) => aimRight(w));
    expect(hurtPlayer(w, 10, 0, 600)).toBe(true);
  });

  it("empurra o jogador para longe da fonte", () => {
    const w = openWorld();
    hurtPlayer(w, 10, 500, 600);
    expect(w.player.vx).toBeCloseTo(PLAYER.hurt.knockback, 6);
  });

  it("a invulnerabilidade do dash ignora dano nos primeiros 100 ms", () => {
    const w = openWorld();
    stepWorld(w, aimRight(w, { dashHeld: true }), STEP);
    expect(hurtPlayer(w, 10, 0, 600)).toBe(false);
    steps(w, 5, (w) => aimRight(w));
    // 100 ms decorridos: os 40 ms finais do dash não protegem
    expect(hurtPlayer(w, 10, 0, 600)).toBe(true);
  });

  it("zerar a vida mata, e morto não sofre mais dano", () => {
    const w = openWorld();
    hurtPlayer(w, 150, 0, 600);
    expect(w.player.hp).toBe(0);
    expect(w.playerDead).toBe(true);
    expect(w.events.list.some((e) => e.t === "playerDied")).toBe(true);
    w.player.invulnMs = 0;
    expect(hurtPlayer(w, 10, 0, 600)).toBe(false);
  });

  it("encostar num inimigo fora do ataque dói a metade, arredondada para cima", () => {
    const w = openWorld();
    // circulador colado no jogador, em órbita (fora do ataque): 11 / 2 → 6
    spawnEnemy(w, "circler", 612, 600);
    stepWorld(w, aimRight(w), STEP);
    expect(w.player.hp).toBe(PLAYER.hp - 6);
  });
});

describe("inimigos", () => {
  it("um inimigo morto pela lança some no fim do passo e não age mais", () => {
    const w = openWorld();
    const e = spawnEnemy(w, "fish", 650, 600);
    if (!e) throw new Error("sem inimigo");
    e.hp = 1;
    stepWorld(w, aimRight(w, { attackPressed: true, attackHeld: true, attackPressedByMouse: true }), STEP);
    for (let i = 0; i < 20 && w.enemies.count > 0; i++) {
      if (w.hitStopMs > 0) {
        w.hitStopMs -= STEP;
        continue;
      }
      stepWorld(w, aimRight(w), STEP);
    }
    expect(w.enemies.count).toBe(0);
    expect(w.kills).toBe(1);
  });

  it("todo ataque passa por um estado de aviso antes (regra 2)", () => {
    // roda muito tempo com peixes e circuladores e confere a ordem dos eventos por inimigo
    const w = openWorld({ spawner: true });
    w.godMode = true;
    const lastTelegraph = new Map<string, number>();
    let attacks = 0;
    // os eventos de um passo são apagados no passo seguinte, então a checagem é passo a passo
    for (let i = 0; i < 3000; i++) {
      stepWorld(w, aimRight(w, { moveX: Math.sin(i / 40), moveY: Math.cos(i / 55) }), STEP);
      for (const e of w.events.list) {
        if (e.t === "telegraph") lastTelegraph.set(`${e.source}:${e.attack}`, w.timeMs);
        if (e.t === "attackStart") {
          attacks++;
          expect(lastTelegraph.has(`${e.source}:${e.attack}`), `${e.source} atacou sem aviso`).toBe(true);
        }
      }
    }
    expect(attacks).toBeGreaterThan(5);
  });
});

describe("projéteis", () => {
  it("o pool tem teto de 900 e ignora disparos além dele", () => {
    const w = openWorld();
    for (let i = 0; i < 1000; i++) fireProjectile(w, 300, 300, 0, 0, 1, 4, 10000, "#fff");
    expect(w.projectiles.count).toBe(PROJECTILES.maxAlive);
  });

  it("acerta o jogador pelo funil e some", () => {
    const w = openWorld();
    fireProjectile(w, 560, 600, 0, 200, 10, 6, 5000, "#fff");
    steps(w, 20, (w) => aimRight(w));
    expect(w.player.hp).toBe(PLAYER.hp - 10);
    expect(w.projectiles.count).toBe(0);
  });

  it("atravessa o jogador na invulnerabilidade do dash sem estourar", () => {
    const w = openWorld();
    // disparado de trás, na mesma direção do dash: fica colado nele durante a proteção
    stepWorld(w, aimRight(w, { dashHeld: true }), STEP);
    fireProjectile(w, w.player.x, w.player.y, 0, 600, 10, 6, 5000, "#fff");
    stepWorld(w, aimRight(w), STEP);
    expect(w.player.hp).toBe(PLAYER.hp);
    expect(w.projectiles.count).toBe(1);
  });

  it("a lança estoura projéteis sem hit-stop", () => {
    const w = openWorld();
    fireProjectile(w, 650, 600, 0, 0, 10, 6, 5000, "#fff");
    stepWorld(w, aimRight(w, { attackPressed: true, attackHeld: true, attackPressedByMouse: true }), STEP);
    let popped = 0;
    for (let i = 0; i < 15; i++) {
      stepWorld(w, aimRight(w), STEP);
      popped += w.events.list.filter((e) => e.t === "projectilePopped").length;
      expect(w.hitStopMs).toBe(0);
    }
    expect(popped).toBe(1);
    expect(w.projectiles.count).toBe(0);
  });

  it("some na rocha; a erosão destrói só rocha comum, nunca a protegida", () => {
    const grid = openGrid(40, 30);
    grid.fill(20, 10, 20, 20, Cell.Rock);
    const w = openWorld({ grid, start: { x: 200, y: 200 } });
    pinRng(w, 0); // chance de erosão sempre sorteada: toda batida erode
    // 3 tiros na rocha comum, 3 na borda protegida
    for (let k = 0; k < 3; k++) {
      fireProjectile(w, 300, 300, 0, 300, 1, 4, 5000, "#fff", { erodes: true });
      fireProjectile(w, 300, 100, -Math.PI / 2, 300, 1, 4, 5000, "#fff", { erodes: true });
      // depois do buraco aberto, os tiros seguintes vão até a borda protegida da direita
      steps(w, 150, (w) => aimRight(w));
    }
    expect(grid.get(20, 15)).toBe(Cell.Water);
    for (let cx = 0; cx < 40; cx++) expect(grid.get(cx, 1)).toBe(Cell.Protected);
    expect(w.projectiles.count).toBe(0);
  });

  it("projétil que não erode não mexe na rocha", () => {
    const grid = openGrid(40, 30);
    grid.fill(20, 10, 20, 20, Cell.Rock);
    const w = openWorld({ grid, start: { x: 200, y: 200 } });
    pinRng(w, 0);
    fireProjectile(w, 300, 300, 0, 300, 1, 4, 5000, "#fff");
    steps(w, 40, (w) => aimRight(w));
    expect(grid.get(20, 15)).toBe(Cell.Rock);
  });
});

describe("cura", () => {
  it("é puxada quando o jogador chega perto e cura 12, sem passar de 100", () => {
    const w = openWorld();
    w.player.hp = 50;
    dropHeal(w, 650, 600);
    steps(w, 30, (w) => aimRight(w));
    expect(w.player.hp).toBe(50 + HEAL.amount);
    expect(w.pickups.count).toBe(0);

    const full = openWorld();
    full.player.hp = 95;
    dropHeal(full, 650, 600);
    steps(full, 30, (w) => aimRight(w));
    expect(full.player.hp).toBe(PLAYER.hp);
  });

  it("longe do jogador, sobe devagar e some depois de 8 s", () => {
    const w = openWorld();
    dropHeal(w, 1200, 800);
    const h = w.pickups.get(0);
    const y0 = h.y;
    steps(w, 60, (w) => aimRight(w));
    expect(h.y).toBeCloseTo(y0 - HEAL.riseSpeed, 0);
    steps(w, Math.ceil(HEAL.lifeMs / STEP), (w) => aimRight(w));
    expect(w.pickups.count).toBe(0);
  });

  it("inimigo comum solta cura pela chance; capanga de chefe e saco de pancada não", () => {
    const drops = (noDrop: boolean, kind: "fish" | "dummy") => {
      const w = openWorld();
      pinRng(w, 0); // chance sempre sorteada
      const e = spawnEnemy(w, kind, 650, 600, noDrop);
      if (!e) throw new Error("sem inimigo");
      e.hp = 1;
      stepWorld(w, aimRight(w, { attackPressed: true, attackHeld: true, attackPressedByMouse: true }), STEP);
      for (let i = 0; i < 12; i++) {
        if (w.hitStopMs > 0) {
          w.hitStopMs -= STEP;
          continue;
        }
        stepWorld(w, aimRight(w), STEP);
        if (w.pickups.count > 0) return true;
      }
      return false;
    };
    expect(drops(false, "fish")).toBe(true);
    expect(drops(true, "fish")).toBe(false);
    expect(drops(false, "dummy")).toBe(false);
  });

  it("sem sorte, não solta nada (chance de 20% do peixe)", () => {
    const w = openWorld();
    pinRng(w, 0.99);
    const e = spawnEnemy(w, "fish", 650, 600);
    if (!e) throw new Error("sem inimigo");
    e.hp = 1;
    stepWorld(w, aimRight(w, { attackPressed: true, attackHeld: true, attackPressedByMouse: true }), STEP);
    steps(w, 20, (w) => aimRight(w));
    expect(w.pickups.count).toBe(0);
  });
});
