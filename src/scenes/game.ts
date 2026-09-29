import type { Action } from "../config/input";
import { PROTOTYPE_PALETTE } from "../config/palette";
import { SPEAR } from "../config/spear";
import type { Input } from "../core/input";
import { TAU, lerp } from "../core/math";
import { Fx } from "../fx/fx";
import { WorldRenderer } from "../render/renderer";
import { inDashInvuln, makeSpearTip, NO_INTENT, spearTip, type PlayerIntent } from "../sim/player";
import { createWorld, stepWorld, type World } from "../sim/world";
import { drawControlsHint, drawPlayerHud } from "../ui/hud";
import type { Scene, SceneManager } from "./manager";
import { PauseScene } from "./pause";

// Cena de jogo. No M1 é a arena de teste com o jogador e os sacos de pancada; o fluxo de
// fase (ondas → chefe) entra no M3.

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
    if (this.debug.enabled && input.wasPressed("debugRestart")) this.restart();

    const w = this.world;
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
    this.renderer.draw(g, this.world, this.fx, alpha);
    drawControlsHint(g, CONTROLS_HINT);
    drawPlayerHud(g, this.world.player);
  }

  /** Reinicia com a mesma semente (a mesma que "tentar de novo" vai usar, GDD §2.3). */
  restart(): void {
    this.world = createWorld(this.seed);
    this.fx.clear();
  }

  debugLines(): string[] {
    const p = this.world.player;
    const sp = p.spear;
    return [
      `vel ${Math.hypot(p.vx, p.vy).toFixed(0)} px/s`,
      `pos ${p.x.toFixed(0)}, ${p.y.toFixed(0)}`,
      `lança ${sp.phase} ${Math.max(sp.t, 0).toFixed(0)} ms · carga ${sp.chargeMs.toFixed(0)}`,
      `dash ${Math.max(p.dashMs, 0).toFixed(0)} ms · recarga ${Math.max(p.dashCdMs, 0).toFixed(0)}${inDashInvuln(p) ? " · INVULN" : ""}`,
      `bolhas ${this.fx.bubbles.pool.count}`,
      "R reinicia · F7 câmera lenta",
    ];
  }

  /** Hitboxes e velocidades, em coordenadas de mundo. */
  renderDebug(g: CanvasRenderingContext2D, alpha: number): void {
    const w = this.world;
    const camX = lerp(w.camera.prevX, w.camera.x, alpha);
    const camY = lerp(w.camera.prevY, w.camera.y, alpha);
    g.save();
    g.translate(-camX, -camY);
    g.lineWidth = 1;

    const bodies = [w.player, ...w.dummies.filter((d) => d.alive)];
    for (const b of bodies) {
      const x = lerp(b.prevX, b.x, alpha);
      const y = lerp(b.prevY, b.y, alpha);
      g.strokeStyle = "#9dffb0";
      g.strokeRect(x - b.collR, y - b.collR, b.collR * 2, b.collR * 2);
      g.strokeStyle = "rgba(255,255,255,0.5)";
      g.beginPath();
      g.arc(x, y, b.radius, 0, TAU);
      g.stroke();
      g.strokeStyle = "#ffd36a";
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + b.vx * 0.1, y + b.vy * 0.1);
      g.stroke();
    }

    const p = w.player;
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
