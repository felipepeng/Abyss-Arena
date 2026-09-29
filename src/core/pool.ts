// Pool de objetos com teto e remoção por swap-remove.
//
// Os objetos vivos ficam em [0, count). Remover troca o objeto com o último vivo, então
// nada é alocado nem deslocado por passo (o protótipo fazia `filter` em três arrays a
// cada passo). A ordem dos vivos não é preservada.
//
// Para remover durante a iteração, percorra de trás para frente:
//   for (let i = pool.count - 1; i >= 0; i--) if (morto(pool.get(i))) pool.removeAt(i);
// O objeto que cai em `i` veio do fim, que já foi visitado.

export class Pool<T> {
  private readonly items: T[] = [];
  private n = 0;

  constructor(
    private readonly create: () => T,
    readonly capacity: number,
  ) {}

  get count(): number {
    return this.n;
  }

  /**
   * Um objeto livre, reaproveitado quando possível, ou null se o teto foi atingido.
   * Ele pode vir sujo do uso anterior: o chamador inicializa todos os campos.
   */
  obtain(): T | null {
    if (this.n >= this.capacity) return null;
    if (this.n === this.items.length) this.items.push(this.create());
    return this.items[this.n++] as T;
  }

  get(i: number): T {
    if (i < 0 || i >= this.n) throw new RangeError(`Pool.get(${i}) fora de [0, ${this.n})`);
    return this.items[i] as T;
  }

  removeAt(i: number): void {
    if (i < 0 || i >= this.n) throw new RangeError(`Pool.removeAt(${i}) fora de [0, ${this.n})`);
    const last = --this.n;
    if (i !== last) {
      // o removido vai para a região livre, para ser reaproveitado pelo próximo obtain
      const removed = this.items[i] as T;
      this.items[i] = this.items[last] as T;
      this.items[last] = removed;
    }
  }

  clear(): void {
    this.n = 0;
  }
}
