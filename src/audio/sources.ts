// Fonte de música (ARCHITECTURE §8). Hoje há uma implementação, a procedural (`music.ts`).
// Música em arquivo, numa versão futura, é outra implementação desta interface, e o resto do
// código não muda.

export interface MusicSource {
  /** Começa a tocar em `out`. O contexto já está criado (depois do primeiro gesto do jogador). */
  start(ctx: AudioContext, out: AudioNode): void;
  /** Camada de intensidade: 0 ondas, 1 chefe, 2 última fase do chefe. Muda sem corte. */
  setIntensity(level: 0 | 1 | 2): void;
  /** Some em `fadeMs` e libera tudo. */
  stop(fadeMs: number): void;
}
