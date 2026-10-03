import type { BossKind } from "../../config/kinds";
import type { Body } from "../body";
import type { World } from "../world";

// Chefes por dados (ARCHITECTURE §5.4). É o padrão que o protótipo repete três vezes,
// extraído: pensar → sortear um ataque do pool da fase → aviso → execução → (encadear) →
// pensar. Um chefe novo só adiciona arquivos; o runner não muda.

export type { BossKind };

export type BossState = "think" | "telegraph" | "execute";

export interface Boss extends Body {
  id: number;
  kind: BossKind;
  hp: number;
  maxHp: number;
  /** Índice em `BossDef.phases` (0 = primeira fase). */
  phase: number;
  state: BossState;
  /** Ataque em aviso ou em execução. */
  attack: string;
  lastAttack: string;
  /** Tempo restante no estado. */
  t: number;
  /** Duração com que o estado começou (progresso do aviso, para o desenho). */
  stateMs: number;
  ang: number;
  prevAng: number;
  /** Direção travada do ataque. */
  dirX: number;
  dirY: number;
  flashMs: number;
  /** Falso durante a entrada: não age, não ataca e não sofre dano (GDD §2.2). */
  active: boolean;
  dead: boolean;
  /** Deslize tangencial ao bater na rocha. */
  slideMs: number;
  slideDir: number;
  /** Campos próprios do chefe. */
  readonly data: Record<string, number>;
}

export interface BossPhase {
  /** Entra nesta fase quando a fração de vida fica abaixo disto (a primeira fase usa 1). */
  hpBelow: number;
  /** Compara com ≤ em vez de < (o Olho do protótipo usa ≤; o Caranguejo, <). */
  inclusive?: boolean;
  /** Pausa entre ataques. */
  thinkMs: number;
  /** Ataques sorteáveis. Repetir um nome aumenta o peso dele, como no protótipo. */
  pool: readonly string[];
  /** Se o sorteio repetir o último ataque, sorteia de novo com esta chance. */
  rerollRepeatChance: number;
}

/** Vetor até o jogador, calculado no começo do passo (antes do movimento). */
export interface Aim {
  dx: number;
  dy: number;
  /** Distância, nunca zero. */
  d: number;
}

export interface AttackDef {
  telegraphMs(b: Boss): number;
  /** A cada passo do aviso (frear, travar a mira). */
  onTelegraph?(b: Boss, w: World, dt: number, aim: Aim, dtMs: number): void;
  /**
   * Duração da execução. 0 = o ataque acontece de uma vez no fim do aviso; Infinity = dura até
   * `onExecute` devolver true (as salvas do leque, o raio que precisa esticar antes de varrer).
   */
  executeMs(b: Boss): number;
  /** No passo em que a execução começa. */
  onStart?(b: Boss, w: World): void;
  /**
   * A cada passo da execução. Devolve true para terminar antes do tempo. `dt` em segundos
   * (física); `dtMs` é o passo exato, para cronômetros em ms (ver o cabeçalho do runner).
   */
  onExecute?(b: Boss, w: World, dt: number, aim: Aim, dtMs: number): boolean | void;
  /** Ao terminar: encadear outro aviso (a investida dupla do Caranguejo) ou voltar a pensar. */
  next?(b: Boss, w: World): { attack: string; telegraphMs: number } | null;
  /** Na execução, sem teto de velocidade (a investida). */
  readonly uncapped?: boolean;
  /** Na execução, o dano de contato é do próprio ataque (e não o de encostar). */
  readonly ownContact?: boolean;
  /** Na execução, desliza pela tangente ao bater na rocha. */
  readonly slides?: boolean;
  /** Alcance do golpe, para o efeito de apresentação (o raio da pinça). */
  fxSize?(b: Boss): number;
}

export interface BossStats {
  hp: number;
  radius: number;
  collRadius: number;
  speed: number;
  accel: number;
  drag: number;
  contactDamage: number;
}

export interface BossDef {
  readonly kind: BossKind;
  readonly name: string;
  /** Sufixo da barra de vida na fase 2 ("ENFURECIDO"). */
  readonly rageLabel: string;
  readonly stats: BossStats;
  readonly phases: readonly BossPhase[];
  /** Pausa curta logo depois de mudar de fase. */
  readonly phaseChangeThinkMs: number;
  /** Pausa antes do primeiro ataque, se diferente da da fase 1 (o Olho espera mais). */
  readonly firstThinkMs?: number;
  readonly attacks: Readonly<Record<string, AttackDef>>;
  /** O que ele faz enquanto pensa (se aproximar, vagar). */
  think(b: Boss, w: World, dt: number, aim: Aim): void;
  /** Orientação do corpo, depois do movimento. `aimAng` é a direção do jogador no começo do passo. */
  orient?(b: Boss, aimAng: number): void;
  /** Deslize tangencial ao bater na rocha pensando (e nos ataques com `slides`). */
  readonly slide?: { durationMs: number; accelScale: number };
  /** Ao entrar numa fase nova (dissolver pilares, no Olho). */
  onPhaseEnter?(b: Boss, w: World, phase: number): void;
  /** A troca de fase gasta o passo inteiro: nada mais acontece nele (o Olho). */
  readonly phaseChangeSkipsStep?: boolean;
  /** Teto de velocidade do chefe agora, se mudar por fase (a Água-viva acelera). Padrão: `stats.speed`. */
  maxSpeed?(b: Boss): number;
  /** Freio (1/s) durante avisos e execuções: o chefe fica ancorado enquanto ataca. */
  readonly attackBrake?: number;
  /** O contato vale dentro de `radius · contactRadiusScale` (padrão 1). */
  readonly contactRadiusScale?: number;
  /** Campos de `data` e sorteios do nascimento. */
  init?(b: Boss, w: World): void;
  /** A cada passo, depois do cronômetro: estado só visual (pulsação), em `data`. */
  animate?(b: Boss, dt: number): void;
}
