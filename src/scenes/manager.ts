// Pilha de cenas com fade em toda troca (GDD §11: nenhuma transição é instantânea).
//
// Só a cena do topo recebe `step`; as de baixo ficam congeladas. É assim que a pausa
// funciona: ela é empilhada sobre o jogo, e o jogo simplesmente não roda enquanto isso.
// O desenho começa pela cena opaca mais alta, para que uma cena sobreposta (pausa) mostre
// o que está embaixo dela.

export interface Scene {
  /** Sobreposta: desenha as cenas de baixo antes dela. */
  readonly overlay?: boolean;
  enter?(): void;
  exit?(): void;
  step(dtMs: number): void;
  render(g: CanvasRenderingContext2D, alpha: number): void;
  /** Ver `LoopHooks.consumeHitStop`. */
  consumeHitStop?(dtMs: number): boolean;
}

type Change =
  | { kind: "push"; scene: Scene }
  | { kind: "replace"; scene: Scene }
  | { kind: "pop" };

type FadePhase = "idle" | "out" | "in";

export class SceneManager {
  private readonly stack: Scene[] = [];
  private pending: Change | null = null;
  private phase: FadePhase = "idle";
  private fadeT = 0;

  constructor(
    private readonly fadeMs: number,
    private readonly fadeColor: string,
  ) {}

  get top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  get transitioning(): boolean {
    return this.phase !== "idle";
  }

  /** Primeira cena do jogo: entra clareando, sem escurecer antes. */
  start(scene: Scene): void {
    this.stack.push(scene);
    scene.enter?.();
    this.phase = "in";
    this.fadeT = 0;
  }

  // As trocas devolvem false (e são ignoradas) se já houver uma em andamento, para que
  // dois toques rápidos não empilhem duas cenas.
  push(scene: Scene): boolean {
    return this.request({ kind: "push", scene });
  }

  replace(scene: Scene): boolean {
    return this.request({ kind: "replace", scene });
  }

  pop(): boolean {
    return this.stack.length > 1 && this.request({ kind: "pop" });
  }

  step(dtMs: number): void {
    const half = this.fadeMs / 2;
    if (this.phase === "out") {
      this.fadeT += dtMs;
      if (this.fadeT >= half) {
        this.apply();
        this.phase = "in";
        this.fadeT = 0;
      }
      return;
    }
    if (this.phase === "in") {
      this.fadeT += dtMs;
      if (this.fadeT >= half) this.phase = "idle";
      return;
    }
    this.top?.step(dtMs);
  }

  consumeHitStop(dtMs: number): boolean {
    return this.top?.consumeHitStop?.(dtMs) ?? false;
  }

  render(g: CanvasRenderingContext2D, alpha: number): void {
    let first = this.stack.length - 1;
    while (first > 0 && this.stack[first]?.overlay) first--;
    for (let i = Math.max(first, 0); i < this.stack.length; i++) this.stack[i]?.render(g, alpha);

    const k = Math.min(this.fadeT / (this.fadeMs / 2), 1);
    const dark = this.phase === "out" ? k : this.phase === "in" ? 1 - k : 0;
    if (dark > 0) {
      g.save();
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalAlpha = dark;
      g.fillStyle = this.fadeColor;
      g.fillRect(0, 0, g.canvas.width, g.canvas.height);
      g.restore();
    }
  }

  private request(change: Change): boolean {
    if (this.phase !== "idle" || this.pending) return false;
    this.pending = change;
    this.phase = "out";
    this.fadeT = 0;
    return true;
  }

  private apply(): void {
    const change = this.pending;
    this.pending = null;
    if (!change) return;
    if (change.kind === "pop" || change.kind === "replace") this.stack.pop()?.exit?.();
    if (change.kind === "push" || change.kind === "replace") {
      this.stack.push(change.scene);
      change.scene.enter?.();
    }
  }
}
