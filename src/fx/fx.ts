import { JELLY } from "../config/bosses/jelly";
import { FX } from "../config/fx";
import type { SimEvent } from "../sim/events";
import { Bubbles } from "./particles";
import { Shake } from "./shake";

// Efeitos de apresentação como reação aos eventos da simulação. A simulação diz que algo
// aconteceu; aqui se decide como isso aparece.

export class Fx {
  readonly bubbles = new Bubbles();
  readonly shake = new Shake();

  /**
   * Chamado uma vez por passo, depois do passo da simulação. Primeiro anda o que já existe,
   * depois nasce o novo: bolhas criadas neste passo só se movem no próximo, como no protótipo.
   */
  step(dtMs: number, events: readonly SimEvent[]): void {
    this.bubbles.step(dtMs);
    this.shake.step(dtMs);
    for (const e of events) this.react(e);
  }

  clear(): void {
    this.bubbles.clear();
    this.shake.clear();
  }

  private attackStart(source: string, attack: string, x: number, y: number, size: number): void {
    const b = this.bubbles;
    if (source === "fish") {
      b.emit(x, y, FX.fishCharge.bubbles);
    } else if (source === "crab") {
      if (attack === "dash") {
        b.emit(x, y, FX.crab.dash.bubbles);
        this.shake.add(FX.crab.dash.shake.ms, FX.crab.dash.shake.amp);
      } else if (attack === "pinch") {
        b.emit(x, y, FX.crab.pinch.bubbles, size * FX.crab.pinch.spreadScale);
        this.shake.add(FX.crab.pinch.shake.ms, FX.crab.pinch.shake.amp);
      } else if (attack === "call") {
        b.emit(x, y, FX.crab.call.bubbles);
      }
    } else if (source === "jelly" && attack === "beam") {
      this.shake.add(FX.jelly.beam.shake.ms, FX.jelly.beam.shake.amp);
    } else if (source === "jelly" && attack === "shock") {
      b.emit(x, y, FX.jelly.shock.bubbles);
      this.shake.add(FX.jelly.shock.shake.ms, FX.jelly.shock.shake.amp);
    } else if (source === "jelly" && attack === "call") {
      b.emit(x, y, FX.jelly.call.bubbles);
    } else if (source === "eye" && attack === "seek") {
      b.emit(x, y, FX.eye.seek.bubbles);
    }
  }

  private react(e: SimEvent): void {
    const b = this.bubbles;
    switch (e.t) {
      case "spearHit":
        // atrás do alvo, no sentido do empurrão
        b.emit(e.x - e.dirX * e.targetR, e.y - e.dirY * e.targetR, FX.spearHit.bubbles);
        this.shake.add(FX.spearHit.shake.ms, FX.spearHit.shake.amp);
        break;
      case "spearBlocked":
        b.emit(e.x, e.y, FX.spearBlocked.spark);
        b.emit(e.x, e.y, FX.spearBlocked.bubbles);
        break;
      case "enemyDied":
        b.emit(e.x, e.y, FX.enemyDied.bubbles, e.radius * FX.enemyDied.spreadScale);
        break;
      case "dash":
        b.emit(e.x, e.y, FX.dash.bubbles);
        break;
      case "thrust":
        b.emit(e.x + e.dirX * FX.thrust.offset, e.y + e.dirY * FX.thrust.offset, FX.thrust.bubbles);
        break;
      case "playerHurt":
        b.emit(e.x, e.y, FX.playerHurt.bubbles);
        this.shake.add(FX.playerHurt.shake.ms, FX.playerHurt.shake.amp);
        break;
      case "playerDied":
        this.shake.add(FX.playerDied.shake.ms, FX.playerDied.shake.amp);
        break;
      case "attackStart":
        this.attackStart(e.source, e.attack, e.x, e.y, e.size ?? 0);
        break;
      case "spawnWarn":
        b.emit(e.x, e.y, FX.spawnWarn.bubbles);
        break;
      case "bossAppeared":
        this.shake.add(FX.bossAppeared.shake.ms, FX.bossAppeared.shake.amp);
        break;
      case "bossPhase": {
        const fx = e.boss === "crab" ? FX.crab.phase2 : e.boss === "jelly" ? FX.jelly.phase2 : FX.eye.phase;
        b.emit(e.x, e.y, fx.bubbles);
        this.shake.add(fx.shake.ms, fx.shake.amp);
        break;
      }
      case "bossVolley":
        if (e.attack === "ring") {
          b.emit(e.x, e.y, FX.jelly.ring.bubbles, JELLY.radius * FX.jelly.ring.spreadScale);
          this.shake.add(FX.jelly.ring.shake.ms, FX.jelly.ring.shake.amp);
        } else if (e.attack === "fan") {
          this.shake.add(FX.eye.fan.shake.ms, FX.eye.fan.shake.amp);
        } else if (e.attack === "siege") {
          b.emit(e.x, e.y, FX.eye.siege.bubbles);
          this.shake.add(FX.eye.siege.shake.ms, FX.eye.siege.shake.amp);
        }
        break;
      case "pullStream":
        b.emit(e.x, e.y, FX.jelly.pullStream.bubbles);
        break;
      case "arenaBreak":
        b.emit(e.x, e.y, FX.arenaBreak.bubbles);
        this.shake.add(FX.arenaBreak.shake.ms, FX.arenaBreak.shake.amp);
        break;
      case "pillarCrumble":
        b.emit(e.x, e.y, FX.pillarCrumble.bubbles);
        break;
      case "bossImpact":
        this.shake.add(FX.crab.impact.shake.ms, FX.crab.impact.shake.amp);
        break;
      case "bossDied":
        b.emit(e.x, e.y, FX.bossDied.bubbles, e.radius * FX.bossDied.spreadScale);
        this.shake.add(FX.bossDied.shake.ms, FX.bossDied.shake.amp);
        break;
      case "phaseChanged":
      case "dashReady":
        break;
      case "projectilePopped":
        b.emit(e.x, e.y, { ...FX.projectilePopped, color: e.color });
        break;
      case "projectileBurst":
        b.emit(e.x, e.y, { ...FX.projectileBurst, color: e.color });
        break;
      case "projectileHit":
        b.emit(e.x, e.y, { ...FX.projectileHit, color: e.color });
        break;
      case "rockEroded":
        b.emit(e.x, e.y, FX.rockEroded.bubbles);
        break;
      case "pickup":
        b.emit(e.x, e.y, FX.pickup.bubbles);
        break;
      case "telegraph":
        break;
    }
  }
}
