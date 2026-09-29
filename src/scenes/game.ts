import type { Action } from "../config/input";
import { PROTOTYPE_PALETTE } from "../config/palette";
import { SPEAR } from "../config/spear";
import { FONT_FAMILY, VIEW } from "../config/system";
import type { Input } from "../core/input";
import { TAU, lerp } from "../core/math";
import { Fx } from "../fx/fx";
import { WorldRenderer } from "../render/renderer";
import { fireDebugRing } from "../sim/debug";
import { ENEMY_DEFS } from "../sim/enemies/registry";
import { inDashInvuln, makeSpearTip, NO_INTENT, spearTip, type PlayerIntent } from "../sim/player";
import { createWorld, stepWorld, type World } from "../sim/world";
import { drawControlsHint, drawPlayerHud } from "../ui/hud";
import type { Scene, SceneManager } from "./manager";
import { PauseScene } from "./pause";

// Cena de jogo. Até o M2 é a arena de teste com o nascimento provisório por tempo; o fluxo
// de fase (ondas → chefe) entra no M3.

export interface DebugFlags {
  readonly enabled: boolean;
}

const CONTROLS_HINT =
  "WASD nadar · clique ou J estocar (segure para carregar) · ESPAÇO dash · Esc pausa · F1 depuração";

export class GameScene implements Scene {
  private world: World;
  private readonly fx = new Fx();
  private readonly renderer = new WorldRenderer(PROTOTYPE_PALETTE);
  private readonly intent: PlayerIntent = { ...NO_INTENT };

  constructor(
    private readonly input: Input<Action>,
    private readonly scenes: SceneManager,
    private readonly debug: DebugFlags,
    private readonly seed: number,
  ) {
    this.world = createWorld(seed);
  }

  step(dtMs: number): void {
    const input = this.input;
    if (input.wasPressed("pause")) {
      this.scenes.push(new PauseScene(input, this.scenes));
      return;
    }
    // reiniciar: sempre depois de morrer (ainda não há menu de derrota, M6); a qualquer
    // momento no modo de depuração
    if (input.wasPressed("debugRestart") && (this.world.playerDead || this.debug.enabled)) {
      this.restart();
      return;
    }
    const w = this.world;
    if (this.debug.enabled) {
      if (input.wasPressed("debugGodMode")) w.godMode = !w.godMode;
      if (input.wasPressed("debugProjectiles")) fireDebugRing(w);
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
    drawControlsHint(g, CONTROLS_HINT);
    drawPlayerHud(g, w.player, w.kills);
    if (w.playerDead) drawDefeat(g, w.kills);
  }

  /** Reinicia com a mesma semente (a mesma que "tentar de novo" vai usar, GDD §2.3). */
  restart(): void {
    this.world = createWorld(this.seed);
    this.fx.clear();
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
      "R reinicia · F2 invencível · F7 lento · F8 projéteis",
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
  g.fillText(`R para reiniciar · ${kills} inimigos mortos`, W / 2, H / 2 + 22);
  g.textAlign = "left";
}
