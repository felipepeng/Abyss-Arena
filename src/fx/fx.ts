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

  private react(e: SimEvent): void {
    const b = this.bubbles;
    switch (e.t) {
      case "spearHit":
        // atrás do alvo, no sentido do empurrão
        b.emit(e.x - e.dirX * e.targetR, e.y - e.dirY * e.targetR, FX.spearHit.bubbles);
        this.shake.add(FX.spearHit.shake.ms, FX.spearHit.shake.amp);
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
        if (e.source === "fish") b.emit(e.x, e.y, FX.fishCharge.bubbles);
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
