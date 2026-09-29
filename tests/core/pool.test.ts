import { describe, expect, it } from "vitest";
import { Pool } from "../../src/core/pool";

interface Thing {
  id: number;
  dead: boolean;
}

const makePool = (capacity: number) => {
  let created = 0;
  const pool = new Pool<Thing>(() => {
    created++;
    return { id: -1, dead: false };
  }, capacity);
  return { pool, created: () => created };
};

function fill(pool: Pool<Thing>, ids: number[]): void {
  for (const id of ids) {
    const t = pool.obtain();
    if (!t) throw new Error("pool cheio");
    t.id = id;
    t.dead = false;
  }
}

const aliveIds = (pool: Pool<Thing>): number[] =>
  Array.from({ length: pool.count }, (_, i) => pool.get(i).id).sort((a, b) => a - b);

describe("Pool", () => {
  it("devolve null ao atingir o teto", () => {
    const { pool } = makePool(3);
    fill(pool, [1, 2, 3]);
    expect(pool.obtain()).toBeNull();
    expect(pool.count).toBe(3);
  });

  it("swap-remove tira só o objeto pedido", () => {
    const { pool } = makePool(10);
    fill(pool, [1, 2, 3, 4, 5]);
    pool.removeAt(1);
    expect(pool.count).toBe(4);
    expect(aliveIds(pool)).toEqual([1, 3, 4, 5]);
    // o último vivo ocupou o lugar do removido
    expect(pool.get(1).id).toBe(5);
  });

  it("remover o último não mexe nos outros", () => {
    const { pool } = makePool(10);
    fill(pool, [1, 2, 3]);
    pool.removeAt(2);
    expect(aliveIds(pool)).toEqual([1, 2]);
  });

  it("remoção de trás para frente durante a iteração não pula ninguém", () => {
    const { pool } = makePool(20);
    fill(pool, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    for (let i = 0; i < pool.count; i++) pool.get(i).dead = pool.get(i).id % 3 === 0;
    for (let i = pool.count - 1; i >= 0; i--) if (pool.get(i).dead) pool.removeAt(i);
    expect(aliveIds(pool)).toEqual([1, 2, 4, 5, 7, 8]);
  });

  it("reaproveita objetos removidos em vez de criar novos", () => {
    const { pool, created } = makePool(5);
    fill(pool, [1, 2, 3]);
    const removed = pool.get(0);
    pool.removeAt(0);
    pool.removeAt(0);
    fill(pool, [7, 8]);
    expect(created()).toBe(3);
    expect(Array.from({ length: pool.count }, (_, i) => pool.get(i))).toContain(removed);
  });

  it("clear esvazia sem perder os objetos", () => {
    const { pool, created } = makePool(4);
    fill(pool, [1, 2, 3, 4]);
    pool.clear();
    expect(pool.count).toBe(0);
    fill(pool, [5, 6, 7, 8]);
    expect(created()).toBe(4);
  });

  it("recusa índices fora dos vivos", () => {
    const { pool } = makePool(4);
    fill(pool, [1, 2]);
    expect(() => pool.get(2)).toThrow(RangeError);
    expect(() => pool.removeAt(-1)).toThrow(RangeError);
  });
});

describe("Pool.removeWhere", () => {
  it("tira os marcados mantendo a ordem dos vivos, e reaproveita os objetos", () => {
    const { pool, created } = makePool(10);
    fill(pool, [0, 1, 2, 3, 4, 5, 6]);
    for (let i = 0; i < pool.count; i++) pool.get(i).dead = [1, 4, 5].includes(pool.get(i).id);
    pool.removeWhere((t) => t.dead);
    expect(Array.from({ length: pool.count }, (_, i) => pool.get(i).id)).toEqual([0, 2, 3, 6]);
    fill(pool, [7, 8, 9]);
    expect(created()).toBe(7);
  });
});
