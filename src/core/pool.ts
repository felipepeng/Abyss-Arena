// Pool de objetos com teto. Os objetos vivos ficam em [0, count); nada é alocado por passo (o
// protótipo fazia `filter` em três arrays a cada passo).
//
// Duas formas de remover:
// - `removeAt(i)`: swap-remove, O(1), NÃO preserva a ordem. Para remover durante a iteração,
//   percorra de trás para frente (o objeto que cai em `i` veio do fim, que já foi visitado).
// - `removeWhere(morto)`: compactação estável, O(n), PRESERVA a ordem de criação. Use quando a
//   ordem decide o resultado: dois projéteis que acertam o jogador no mesmo passo empurram
//   para lados diferentes, e o primeiro criado é o que conta (como no protótipo).

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

  /**
   * Tira todos os objetos para os quais `dead` é true, mantendo a ordem dos vivos. Os mortos
   * vão para a região livre, para serem reaproveitados.
   */
  removeWhere(dead: (item: T) => boolean): void {
    const items = this.items;
    let j = 0;
    for (let i = 0; i < this.n; i++) {
      const item = items[i] as T;
      if (dead(item)) continue;
      if (i !== j) {
        items[i] = items[j] as T;
        items[j] = item;
      }
      j++;
    }
    this.n = j;
  }

  clear(): void {
    this.n = 0;
  }
}
