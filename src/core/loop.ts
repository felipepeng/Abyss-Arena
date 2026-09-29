// Laço de passo fixo com acumulador, teto por frame, hit-stop e alpha de interpolação.
//
// A simulação roda sempre em passos iguais (todos os números de feel foram calibrados a
// 60 Hz); o desenho roda na taxa do monitor e interpola entre o passo anterior e o atual.
// O hit-stop mora aqui, e não num multiplicador de dt, para congelar tudo igualmente:
// física, cronômetros, partículas e câmera.

const STEP_EPSILON_MS = 1e-6;

export interface LoopHooks {
  step(dtMs: number): void;
  render(alpha: number): void;
  /**
   * Chamado antes de cada passo. Se houver hit-stop pendente, desconta `dtMs` dele e
   * devolve true: aquele passo não roda.
   */
  consumeHitStop?(dtMs: number): boolean;
}

export class FixedStepLoop {
  private acc = 0;
  private frozen = false;

  constructor(
    readonly stepMs: number,
    readonly maxFrameMs: number,
    private readonly hooks: LoopHooks,
  ) {}

  /** Roda os passos devidos a `elapsedMs` de tempo real e devolve o alpha de interpolação. */
  advance(elapsedMs: number): number {
    // teto: depois de uma travada (aba em segundo plano, GC) o jogo não "corre" para alcançar
    this.acc += Math.min(Math.max(elapsedMs, 0), this.maxFrameMs);
    // A tolerância evita que um múltiplo exato do passo (100 ms = 6 passos) perca o último
    // passo para o erro de ponto flutuante de 1000/60 somado várias vezes.
    while (this.acc >= this.stepMs - STEP_EPSILON_MS) {
      this.acc = Math.max(this.acc - this.stepMs, 0);
      this.frozen = this.hooks.consumeHitStop?.(this.stepMs) ?? false;
      if (!this.frozen) this.hooks.step(this.stepMs);
    }
    // Congelado, o desenho fica no estado atual. Com o alpha do acumulador ele oscilaria
    // entre o passo anterior e o atual durante o hit-stop, em vez de parar a imagem.
    return this.frozen ? 1 : this.acc / this.stepMs;
  }

  frame(elapsedMs: number): void {
    this.hooks.render(this.advance(elapsedMs));
  }
}

/**
 * Liga o laço ao `requestAnimationFrame`. `onFrame` recebe o tempo real de cada frame
 * (para medir FPS). Devolve uma função que para o laço.
 */
export function runLoop(loop: FixedStepLoop, onFrame?: (elapsedMs: number) => void): () => void {
  let last = performance.now();
  let handle = 0;
  const tick = (now: number): void => {
    const elapsed = now - last;
    last = now;
    onFrame?.(elapsed);
    loop.frame(elapsed);
    handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(handle);
}
