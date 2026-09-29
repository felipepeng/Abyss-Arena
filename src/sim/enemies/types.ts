import type { EnemyKind } from "../../config/kinds";
import type { Body } from "../body";
import type { World } from "../world";

// Inimigos por dados (ARCHITECTURE §5.3). Cada tipo é uma `EnemyDef`: atributos e uma
// máquina de estados declarativa. O runner genérico cuida do que é comum a todos.

export type { EnemyKind };

/** Os campos são mutáveis porque o objeto é reaproveitado pelo pool (`spawnEnemy`). */
export interface Enemy extends Body {
  id: number;
  kind: EnemyKind;
  hp: number;
  maxHp: number;
  state: string;
  /** Tempo restante no estado (pode ficar negativo: alguns estados esperam outra condição). */
  t: number;
  /** Duração com que o estado começou. O render usa para saber o progresso de um aviso. */
  stateMs: number;
  ang: number;
  prevAng: number;
  flashMs: number;
  /** Direção travada de um ataque. */
  dirX: number;
  dirY: number;
  /** Invocado por chefe: não solta cura. */
  noDrop: boolean;
  /** Nasceu de uma onda: conta para o fim dela (os capangas do chefe não contam). */
  fromWave: boolean;
  dead: boolean;
  /** Campos próprios do tipo (fase do serpenteio, ângulo da órbita, ponto de origem...). */
  readonly data: Record<string, number>;
}

export interface EnemyStats {
  radius: number;
  collRadius: number;
  hp: number;
  drag: number;
  contactDamage: number;
  dropChance: number;
}

export interface EnemyState {
  /** Chamado ao entrar no estado; normalmente fixa `t` e a velocidade de um ataque. */
  enter?(e: Enemy, w: World): void;
  /** Decide aceleração e transições. Devolve o nome do próximo estado para trocar. */
  update(e: Enemy, w: World, dt: number): string | void;
  /** Teto de velocidade neste estado, aplicado depois do `update` e antes do arrasto. */
  readonly maxSpeed: number;
  /** Estado de aviso: sinal visual obrigatório antes de todo ataque (regra 2). */
  readonly telegraph?: boolean;
  /** Estado de ataque: contato com dano cheio e alcance extra; fora dele, metade. */
  readonly harmful?: boolean;
}

export interface EnemyDef {
  readonly kind: EnemyKind;
  readonly stats: EnemyStats;
  readonly initial: string;
  readonly states: Readonly<Record<string, EnemyState>>;
  /** Campos iniciais de `data` e sorteios de nascimento. */
  init?(e: Enemy, w: World): void;
  /** Depois do teto de velocidade: orientação do corpo. */
  orient?(e: Enemy, dt: number): void;
  /** Ao zerar a vida. Devolve true para continuar vivo (o saco de pancada volta cheio). */
  onDeath?(e: Enemy, w: World): boolean;
}
