// RNG com semente (mulberry32). Instanciável: cada mundo tem a sua, e a mesma semente
// reproduz a mesma sequência. É a única fonte de aleatoriedade permitida em `sim/`.

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  /** Estado interno atual; `new Rng(r.state)` continua a sequência dali. */
  get state(): number {
    return this.s;
  }

  /** Número em [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Real em [a, b). */
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  /** Inteiro em [a, b], com os dois extremos incluídos. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error("Rng.pick em lista vazia");
    return items[Math.floor(this.next() * items.length)] as T;
  }
}

/**
 * Semente nova, sorteada pelo navegador. Só para quem cria o mundo (cena, `main`):
 * nunca chamar de dentro de `sim/`, senão a simulação deixa de ser reproduzível.
 */
export function randomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0] as number;
}

/** Semente em 8 dígitos hexadecimais, para o overlay e para `?seed=` na URL. */
export const formatSeed = (seed: number): string => (seed >>> 0).toString(16).padStart(8, "0");

/** Aceita o formato de `formatSeed`. Devolve null se o texto não for uma semente. */
export function parseSeed(text: string | null): number | null {
  if (!text || !/^[0-9a-f]{1,8}$/i.test(text)) return null;
  return parseInt(text, 16) >>> 0;
}
