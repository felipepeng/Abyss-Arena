import { DESCENT_LIGHT, DESCENT_SCENE, SHAFT } from "../config/descent";
import { SIM, VIEW } from "../config/system";
import { clamp, angLerp, lerp } from "../core/math";
import { DescentRenderer } from "../render/descent";
import type { MapDef } from "../world/mapdef";
import type { App } from "./app";
import { DESCENT } from "./flow";
import { GameScene, type GameParams } from "./game";
import type { Scene } from "./manager";

// A cena entre duas fases da Descida (GDD §2.5): o mergulhador já começa caindo por um poço enorme
// e, no fim, sai pela boca dele na fase seguinte. A luz diminui durante a queda e de uma descida
// para a seguinte, e a música e o ambiente do mapa se calam: fica só o som da água, que acompanha
// a velocidade dele. Não tem controle; Enter, Espaço, J ou Esc pulam. É apresentação pura: não toca
// na simulação nem conta no tempo da sessão.

const CX = VIEW.width / 2;
/** Duração total da cena, ms. */
export const DESCENT_TOTAL_MS = DESCENT_SCENE.fallMs + DESCENT_SCENE.exitMs;

const smooth = (k: number): number => {
  const x = clamp(k, 0, 1);
  return x * x * (3 - 2 * x);
};

/** Velocidade vertical do mergulhador em `tMs`, px/s: já cai ao começar, e freia depois da boca de saída. */
export function descentSpeed(tMs: number): number {
  const d = DESCENT_SCENE;
  if (tMs < d.fallMs) return d.fallSpeedPxS * lerp(d.startSpeedFrac, 1, smooth(tMs / d.fallRampMs));
  return d.fallSpeedPxS * (1 - smooth((tMs - d.fallMs) / d.exitDecelMs));
}

/**
 * A profundidade da boca de saída do poço (mundo da cena): onde ele está quando a queda acaba.
 * Soma passo a passo, no mesmo passo fixo da simulação, para bater com onde a cena o põe.
 */
export function exitDepth(): number {
  let y = SHAFT.fallScreenY;
  for (let t = SIM.stepMs; t - SIM.stepMs < DESCENT_SCENE.fallMs; t += SIM.stepMs) {
    y += (descentSpeed(t) * SIM.stepMs) / 1000;
  }
  return y;
}

/**
 * A luz de uma descida em `tMs`: 1 = dia, 0 = preto. `index` é a posição na Descida do mapa que
 * acabou (0 = Leito, 1 = Coral). Diminui sempre, e a descida seguinte começa onde a anterior acabou.
 */
export function descentLight(index: number, tMs: number): number {
  const level = DESCENT_LIGHT[clamp(index, 0, DESCENT_LIGHT.length - 1)];
  if (!level) return 1;
  return lerp(level.start, level.end, smooth(tMs / DESCENT_TOTAL_MS));
}

/** O que a cena precisa saber para levar à fase seguinte. */
export interface DescentParams {
  /** O mapa que acabou de ser vencido. */
  from: MapDef;
  /** A fase seguinte, já com a semente sorteada. */
  next: GameParams;
}

interface Pose {
  x: number;
  /** Profundidade do mergulhador no mundo da cena. */
  wy: number;
  aim: number;
  cam: number;
}

export class DescentScene implements Scene {
  private readonly view = new DescentRenderer();
  private readonly index: number;
  private readonly toMap: MapDef | null;
  private timeMs = 0;
  private readonly exitY = exitDepth();
  private pose: Pose = { x: CX, wy: SHAFT.fallScreenY, aim: Math.PI / 2, cam: 0 };
  private prev: Pose = { ...this.pose };
  /** Quanto ele já nadou para o lado, na saída. */
  private swimX = 0;
  private speedPxS = 0;
  private level = 0;
  private lastWaterLevel = -1;
  private next: GameScene | null = null;

  constructor(
    private readonly app: App,
    private readonly params: DescentParams,
  ) {
    this.index = Math.max(0, DESCENT.indexOf(params.from));
    this.toMap = params.next.mode.kind === "map" ? params.next.mode.map : null;
    this.place(0);
    this.prev = { ...this.pose };
  }

  /** A profundidade da boca de saída do poço. */
  get mouthY(): number {
    return this.exitY;
  }

  /** Onde o mergulhador está: x na tela, profundidade no mundo da cena, direção do nariz e a câmera. */
  get diver(): Readonly<Pose> {
    return this.pose;
  }

  /** O tempo, em ms, desde que a cena começou. */
  get elapsedMs(): number {
    return this.timeMs;
  }

  /** A fase que vem depois: existe a partir de `enter`. */
  get upcoming(): GameScene | null {
    return this.next;
  }

  /** A luz agora (1 = dia, 0 = preto). */
  get light(): number {
    return descentLight(this.index, this.timeMs);
  }

  enter(): void {
    // a fase seguinte nasce já, no escuro do fade, e não num tranco no fim da cena
    this.next = new GameScene(this.app, this.params.next);
    this.app.audio.stopTrack();
    this.updateWater();
  }

  exit(): void {
    this.app.audio.stopWater();
  }

  step(dtMs: number): void {
    const { input } = this.app;
    if (this.timeMs >= DESCENT_SCENE.skipLockMs && (input.wasPressed("menuConfirm") || input.wasPressed("menuBack"))) {
      this.leave();
      return;
    }
    this.timeMs += dtMs;
    this.prev = { ...this.pose };
    this.place(dtMs);
    this.view.step(dtMs, this.speedPxS, this.pose.x, this.pose.wy - this.pose.cam);
    this.updateWater();
    if (this.timeMs >= DESCENT_TOTAL_MS) this.leave();
  }

  /** Para a fase seguinte. Se um fade já está em andamento, tenta de novo no próximo passo. */
  private leave(): void {
    const next = this.next ?? new GameScene(this.app, this.params.next);
    this.next = next;
    this.app.scenes.resetTo(next);
  }

  /** Põe o mergulhador onde ele está em `timeMs`, andando `dtMs`. */
  private place(dtMs: number): void {
    const d = DESCENT_SCENE;
    const t = this.timeMs;
    const p = this.pose;
    const dt = dtMs / 1000;
    const speed = descentSpeed(t);
    const exitT = t - d.fallMs;
    // o balanço e a deriva somem na saída, e ele vira e nada para a direita
    const calm = 1 - smooth(exitT / d.calmMs);
    const turn = smooth((exitT - d.exitTurnDelayMs) / d.exitTurnMs);
    this.swimX += d.swimSpeedPxS * turn * dt;
    this.speedPxS = speed;
    this.level = Math.max(d.swimLevel, speed / d.fallSpeedPxS);
    p.wy += speed * dt;
    p.x = CX + Math.sin((t / 1000) * 1.3) * d.driftPx * calm + this.swimX;
    p.aim = angLerp(Math.PI / 2, 0, turn) + Math.sin((t / d.swayPeriodMs) * Math.PI * 2) * d.swayRad * calm;
    // a câmera desce com ele e para um pouco depois da boca, para ele sair da tela sozinho
    p.cam = Math.min(Math.max(0, p.wy - SHAFT.fallScreenY), this.exitY - SHAFT.exitCeilingScreenY);
  }

  private updateWater(): void {
    // só fala com o áudio quando a velocidade mudou de verdade
    if (Math.abs(this.level - this.lastWaterLevel) < 0.01) return;
    this.lastWaterLevel = this.level;
    this.app.audio.water(this.level);
  }

  render(g: CanvasRenderingContext2D, alpha: number): void {
    const from = this.params.from.palette;
    const to = this.toMap?.palette ?? from;
    const start = DESCENT_SCENE.fallMs * 0.4;
    this.view.draw(g, {
      from,
      to,
      mix: smooth((this.timeMs - start) / (DESCENT_TOTAL_MS - start)),
      exitY: this.exitY,
      camY: lerp(this.prev.cam, this.pose.cam, alpha),
      diverX: lerp(this.prev.x, this.pose.x, alpha),
      diverY: lerp(this.prev.wy, this.pose.wy, alpha),
      aim: angLerp(this.prev.aim, this.pose.aim, alpha),
      speedPxS: this.speedPxS,
      light: this.light,
      timeMs: this.timeMs,
      hint: this.timeMs >= DESCENT_SCENE.skipLockMs ? "ENTER pular" : "",
    });
  }
}
