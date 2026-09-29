// Nomes dos tipos de criatura. Moram em config/ porque tanto os mapas (world/, que listam as
// ondas) quanto a simulação (sim/) precisam deles, e world/ não pode importar sim/.

export type EnemyKind = "fish" | "circler" | "dummy" | "dummyBig";

export type BossKind = "crab" | "jelly" | "eye";
