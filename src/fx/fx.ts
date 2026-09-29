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
    switch (e.t) {
      case "spearHit":
        // atrás do alvo, no sentido do empurrão
        this.bubbles.emit(e.x - e.dirX * e.targetR, e.y - e.dirY * e.targetR, FX.spearHit.bubbles);
        this.shake.add(FX.spearHit.shake.ms, FX.spearHit.shake.amp);
        break;
      case "enemyDied":
        this.bubbles.emit(e.x, e.y, FX.enemyDied.bubbles, e.radius * FX.enemyDied.spreadScale);
        break;
      case "dash":
        this.bubbles.emit(e.x, e.y, FX.dash.bubbles);
        break;
      case "thrust":
        this.bubbles.emit(e.x + e.dirX * FX.thrust.offset, e.y + e.dirY * FX.thrust.offset, FX.thrust.bubbles);
        break;
    }
  }
}
