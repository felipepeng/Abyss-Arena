// Tremor de tela. Guarda o maior pedido em andamento; o tempo corre em passo fixo (congela
// no hit-stop, como no protótipo), e o deslocamento é sorteado a cada frame desenhado.

export class Shake {
  private ms = 0;
  private amp = 0;

  add(ms: number, amp: number): void {
    this.ms = Math.max(this.ms, ms);
    this.amp = Math.max(this.amp, amp);
  }

  step(dtMs: number): void {
    if (this.ms <= 0) return;
    this.ms -= dtMs;
    if (this.ms <= 0) this.amp = 0;
  }

  /** Deslocamento deste frame, em px. */
  offsetX(): number {
    return this.ms > 0 ? (Math.random() * 2 - 1) * this.amp : 0;
  }

  offsetY(): number {
    return this.ms > 0 ? (Math.random() * 2 - 1) * this.amp : 0;
  }

  clear(): void {
    this.ms = 0;
    this.amp = 0;
  }
}
