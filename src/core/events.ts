// Buffer de eventos por passo. A simulação empurra eventos durante o passo; render, áudio
// e FX os leem depois e o buffer é limpo antes do passo seguinte. É o único canal da
// simulação para fora (ela não conhece quem reage).

export class EventBuffer<E> {
  private readonly items: E[] = [];

  push(event: E): void {
    this.items.push(event);
  }

  get list(): readonly E[] {
    return this.items;
  }

  clear(): void {
    // reaproveita o array em vez de criar outro a cada passo
    this.items.length = 0;
  }
}
