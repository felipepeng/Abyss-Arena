import type { Action } from "../config/input";
import { PROTOTYPE_PALETTE, type Palette } from "../config/palette";
import { SPEAR } from "../config/spear";
import { FONT_FAMILY, VIEW } from "../config/system";
import type { Input } from "../core/input";
import { TAU, lerp } from "../core/math";
import { Fx } from "../fx/fx";
import { WorldRenderer } from "../render/renderer";
import { BOSS_DEFS } from "../sim/bosses/registry";
import { fireDebugRing } from "../sim/debug";
import { ENEMY_DEFS } from "../sim/enemies/registry";
import { inDashInvuln, makeSpearTip, NO_INTENT, spearTip, type PlayerIntent } from "../sim/player";
import { debugSkipToBoss, debugSkipWave } from "../sim/phase";
import { createMapWorld, createWorld, stepWorld, type World } from "../sim/world";
import type { BossKind } from "../config/kinds";
import type { MapDef } from "../world/mapdef";
import { mapOfBoss } from "../world/maps/registry";
import { buildTestArena } from "../world/testArena";
import { drawControlsHint, drawPlayerHud } from "../ui/hud";
import { drawPhaseHud } from "../ui/phaseHud";
import type { Scene, SceneManager } from "./manager";
import { PauseScene } from "./pause";

// Cena de jogo: uma fase inteira num mapa (ondas → chefe), ou a arena de teste do M1–M2
// (`?arena=test`), com o nascimento provisório por tempo e os sacos de pancada.

export interface DebugFlags {
  readonly enabled: boolean;
}

/** O que a cena joga: o mapa de uma fase, ou a arena de teste. */
export type GameMode = { kind: "map"; map: MapDef } | { kind: "test" };

const CONTROLS_HINT =
  "WASD nadar · clique ou J estocar (segure para carregar) · ESPAÇO dash · Esc pausa · F1 depuração";

export class GameScene implements Scene {
  private world: World;
  private readonly fx = new Fx();
  private renderer: WorldRenderer;
  private readonly intent: PlayerIntent = { ...NO_INTENT };

  constructor(
    private readonly input: Input<Action>,
    private readonly scenes: SceneManager,
    private readonly debug: DebugFlags,
    private readonly seed: number,
    private mode: GameMode,
  ) {
    const palette: Palette = mode.kind === "map" ? mode.map.palette : PROTOTYPE_PALETTE;
    this.renderer = new WorldRenderer(palette);
    this.world = this.newWorld();
  }

  private newWorld(): World {
    return this.mode.kind === "map" ? createMapWorld(this.mode.map, this.seed) : createWorld(this.seed, buildTestArena());
  }

  step(dtMs: number): void {
    const input = this.input;
    if (input.wasPressed("pause")) {
      this.scenes.push(new PauseScene(input, this.scenes));
      return;
    }
    // reiniciar: sempre depois de morrer ou de vencer (ainda não há menus, M6); a qualquer
    // momento no modo de depuração
    const over = this.world.playerDead || this.world.phase?.state === "cleared";
    if (input.wasPressed("debugRestart") && (over || this.debug.enabled)) {
      this.restart();
      return;
    }
    const w = this.world;
    if (this.debug.enabled) {
      if (input.wasPressed("debugGodMode")) w.godMode = !w.godMode;
      if (input.wasPressed("debugProjectiles")) fireDebugRing(w);
      if (input.wasPressed("debugNextWave")) debugSkipWave(w);
      if (input.wasPressed("debugSkipToBoss")) debugSkipToBoss(w);
      // B/N/M escolhem o chefe: vão para o mapa dele e pulam as ondas
      const picked: BossKind | null = input.wasPressed("debugCrab") ? "crab"
        : input.wasPressed("debugJelly") ? "jelly"
        : input.wasPressed("debugEye") ? "eye" : null;
      if (picked && this.mode.kind !== "test") {
        this.pickBoss(picked);
        return;
      }
      if (input.wasPressed("debugBossPhase")) forceNextBossPhase(w);
    }

    const it = this.intent;
    it.moveX = (input.isDown("moveRight") ? 1 : 0) - (input.isDown("moveLeft") ? 1 : 0);
    it.moveY = (input.isDown("moveDown") ? 1 : 0) - (input.isDown("moveUp") ? 1 : 0);
    // cursor de tela → mundo com a câmera deste passo: a mira não escorrega quando a câmera
    // anda com o mouse parado
    it.aimX = input.mouseX + w.camera.x;
    it.aimY = input.mouseY + w.camera.y;
    it.mouseMoved = input.mouseMoved;
    it.attackHeld = input.isDown("attack");
    it.attackPressed = input.wasPressed("attack");
    it.attackPressedByMouse = input.wasMousePressed(0);
    it.dashHeld = input.isDown("dash");

    stepWorld(w, it, dtMs);
    this.fx.step(dtMs, w.events.list);
  }

  consumeHitStop(dtMs: number): boolean {
    if (this.world.hitStopMs <= 0) return false;
    this.world.hitStopMs -= dtMs;
    return true;
  }

  render(g: CanvasRenderingContext2D, alpha: number): void {
    const w = this.world;
    this.renderer.draw(g, w, this.fx, alpha);
    if (!w.phase) drawControlsHint(g, CONTROLS_HINT);
    drawPlayerHud(g, w.player, w.kills);
    if (this.mode.kind === "map") {
      const camX = lerp(w.camera.prevX, w.camera.x, alpha);
      const camY = lerp(w.camera.prevY, w.camera.y, alpha);
      drawPhaseHud(g, w, this.mode.map.titleCard, camX, camY);
    }
    if (w.playerDead) drawDefeat(g, w.kills);
  }

  /** Reinicia com a mesma semente (a mesma que "tentar de novo" vai usar, GDD §2.3). */
  restart(): void {
    this.world = this.newWorld();
    this.fx.clear();
  }

  /** Depuração: troca para o mapa do chefe (mesma semente) e vai direto à entrada dele. */
  private pickBoss(boss: BossKind): void {
    const map = mapOfBoss(boss);
    if (this.mode.kind !== "map" || this.mode.map !== map) {
      this.mode = { kind: "map", map };
      this.renderer = new WorldRenderer(map.palette);
      this.world = this.newWorld();
      this.fx.clear();
    }
    debugSkipToBoss(this.world);
  }

  debugLines(): string[] {
    const w = this.world;
    const p = w.player;
    const sp = p.spear;
    return [
      `vel ${Math.hypot(p.vx, p.vy).toFixed(0)} px/s · pos ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`,
      `lança ${sp.phase} ${Math.max(sp.t, 0).toFixed(0)} ms · carga ${sp.chargeMs.toFixed(0)}`,
      `dash ${Math.max(p.dashMs, 0).toFixed(0)} ms · recarga ${Math.max(p.dashCdMs, 0).toFixed(0)}${inDashInvuln(p) ? " · INVULN" : ""}`,
      `inimigos ${w.enemies.count} · projéteis ${w.projectiles.count} · curas ${w.pickups.count}`,
      `bolhas ${this.fx.bubbles.pool.count}${w.godMode ? " · INVENCÍVEL" : ""}`,
      ...phaseDebugLines(w),
      "R reinicia · F2 invencível · F7 lento · F8 projéteis",
      "F3 próxima onda · F4 chefe daqui · F5 fase do chefe",
      "B caranguejo · N água-viva · M olho (trocam de mapa)",
    ];
  }

  /** Hitboxes, estados e velocidades, em coordenadas de mundo. */
  renderDebug(g: CanvasRenderingContext2D, alpha: number): void {
    const w = this.world;
    const camX = lerp(w.camera.prevX, w.camera.x, alpha);
    const camY = lerp(w.camera.prevY, w.camera.y, alpha);
    g.save();
    g.translate(-camX, -camY);
    g.lineWidth = 1;
    g.font = `10px ${FONT_FAMILY}`;
    g.textAlign = "center";
    g.textBaseline = "bottom";

    const p = w.player;
    drawBodyDebug(g, lerp(p.prevX, p.x, alpha), lerp(p.prevY, p.y, alpha), p.collR, p.radius, p.vx, p.vy, "#9dffb0");

    for (let i = 0; i < w.enemies.count; i++) {
      const e = w.enemies.get(i);
      if (e.dead) continue;
      const x = lerp(e.prevX, e.x, alpha);
      const y = lerp(e.prevY, e.y, alpha);
      const state = ENEMY_DEFS[e.kind].states[e.state];
      // aviso em amarelo, ataque em vermelho: a regra 2 fica visível
      const color = state?.telegraph ? "#ffd36a" : state?.harmful ? "#ff6a6a" : "#9dffb0";
      drawBodyDebug(g, x, y, e.collR, e.radius, e.vx, e.vy, color);
      g.fillStyle = color;
      const tag = state?.telegraph ? " [AVISO]" : state?.harmful ? " [ATAQUE]" : "";
      g.fillText(`${e.state}${tag} ${Math.max(e.t, 0).toFixed(0)}`, x, y - e.radius - 16);
    }

    if (p.spear.phase === "thrust") {
      const tip = spearTip(p, makeSpearTip());
      const back = Math.max(0, tip.k - SPEAR.midBack);
      g.strokeStyle = "#ff6a6a";
      for (const [x, y] of [
        [tip.x, tip.y],
        [p.x + tip.dirX * tip.reach * back, p.y + tip.dirY * tip.reach * back],
      ] as const) {
        g.beginPath();
        g.arc(x, y, SPEAR.tipRadius, 0, TAU);
        g.stroke();
      }
    }
    g.restore();
  }
}

function drawBodyDebug(
  g: CanvasRenderingContext2D, x: number, y: number, collR: number, radius: number,
  vx: number, vy: number, color: string,
): void {
  g.strokeStyle = color;
  g.strokeRect(x - collR, y - collR, collR * 2, collR * 2);
  g.strokeStyle = "rgba(255,255,255,0.5)";
  g.beginPath();
  g.arc(x, y, radius, 0, TAU);
  g.stroke();
  g.strokeStyle = "#ffd36a";
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + vx * 0.1, y + vy * 0.1);
  g.stroke();
}

function phaseDebugLines(w: World): string[] {
  const f = w.phase;
  if (!f) return [];
  const lines = [`fase ${f.state} · onda ${f.wave} · ${Math.max(f.t, 0).toFixed(0)} ms · fila ${f.queue.length}`];
  for (const b of w.bosses) {
    lines.push(`${b.kind} fase ${b.phase + 1} · ${b.state} ${b.attack} ${Math.max(b.t, 0).toFixed(0)} ms · vida ${b.hp.toFixed(0)}`);
  }
  return lines;
}

/** F5: leva a vida do chefe para logo abaixo do próximo limiar de fase. */
function forceNextBossPhase(w: World): void {
  for (const b of w.bosses) {
    const next = BOSS_DEFS[b.kind].phases[b.phase + 1];
    if (!b.active || b.dead || !next) continue;
    b.hp = Math.min(b.hp, b.maxHp * next.hpBelow - 1);
  }
}

/** Tela de derrota provisória; a de verdade, com opções, chega no M6. */
function drawDefeat(g: CanvasRenderingContext2D, kills: number): void {
  const { width: W, height: H } = VIEW;
  g.fillStyle = "rgba(0,0,0,0.6)";
  g.fillRect(0, 0, W, H);
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  g.fillStyle = "#ff8f8f";
  g.font = `34px ${FONT_FAMILY}`;
  g.fillText("VOCÊ AFUNDOU", W / 2, H / 2 - 6);
  g.fillStyle = "#dff0ff";
  g.font = `14px ${FONT_FAMILY}`;
  g.fillText(`R para tentar de novo · ${kills} inimigos mortos`, W / 2, H / 2 + 22);
  g.textAlign = "left";
}
