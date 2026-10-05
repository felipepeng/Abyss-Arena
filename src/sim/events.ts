import type { BossKind, EnemyKind } from "../config/kinds";
import type { PhaseStateName } from "./phase";

// Eventos que a simulação emite para fora (ARCHITECTURE §4.2). Render, áudio e FX reagem a
// eles; a simulação decide *que* algo aconteceu, o resto decide *como* aparece.

export type SimEvent =
  /** A lança acertou uma criatura. (x, y) é a posição do alvo; dir é a direção da estocada. */
  | { t: "spearHit"; x: number; y: number; dirX: number; dirY: number; targetR: number }
  /** A blindagem de uma criatura barrou a lança: sem dano e sem hit-stop (regra 6). */
  | { t: "spearBlocked"; x: number; y: number }
  | { t: "enemyDied"; x: number; y: number; radius: number; kind: EnemyKind }
  /** Um aviso começou (regra 2). Para som e depuração; o desenho lê o estado da criatura. */
  | { t: "telegraph"; x: number; y: number; source: EnemyKind | BossKind; attack: string }
  /** O ataque telegrafado saiu. `size` é o alcance do golpe, quando importa para o efeito. */
  | { t: "attackStart"; x: number; y: number; source: EnemyKind | BossKind; attack: string; size?: number }
  /** O chefe mudou de fase. */
  | { t: "bossPhase"; x: number; y: number; boss: BossKind; phase: number }
  /** O chefe bateu na rocha no meio de um ataque (a investida contra uma formação). */
  | { t: "bossImpact"; x: number; y: number; boss: BossKind }
  | { t: "bossDied"; x: number; y: number; radius: number; boss: BossKind }
  /** Uma salva de um ataque de várias (anel da Água-viva, leque do Olho). */
  | { t: "bossVolley"; x: number; y: number; boss: BossKind; attack: string }
  /** Bolha na corrente da sucção (sorteada na simulação para manter a sequência do protótipo). */
  | { t: "pullStream"; x: number; y: number }
  /** A parede quebrável começou a ceder a partir de (x, y): tremor e som (a Água-viva, fase 2). */
  | { t: "arenaBreak"; x: number; y: number }
  /** Um bloco de pilar dissolveu (o sorteio da bolha é da simulação, como no protótipo). */
  | { t: "pillarCrumble"; x: number; y: number }
  /** O chefe entrou em cena (começo da entrada). */
  | { t: "bossAppeared"; x: number; y: number; boss: BossKind }
  /** Um inimigo vai nascer aqui daqui a pouco: nascer também é telegrafado (GDD §3.1). */
  | { t: "spawnWarn"; x: number; y: number }
  /** A máquina da fase mudou de estado. */
  | { t: "phaseChanged"; state: PhaseStateName; wave: number }
  | { t: "dash"; x: number; y: number; dirX: number; dirY: number }
  /** A recarga do dash acabou: o jogador pode usá-lo de novo (só o áudio reage). */
  | { t: "dashReady" }
  /** O jogador apertou o ataque: começa a antecipação e a carga. O áudio abre o tom da carga. */
  | { t: "chargeStart"; x: number; y: number }
  /** A estocada saiu. `charge` em [0, 1]. */
  | { t: "thrust"; x: number; y: number; dirX: number; dirY: number; charge: number }
  | { t: "playerHurt"; x: number; y: number; amount: number }
  | { t: "playerDied"; x: number; y: number }
  /** A lança estourou um projétil (sem hit-stop, regra 6). */
  | { t: "projectilePopped"; x: number; y: number; color: string }
  /** Um projétil sumiu na rocha ou na borda do mundo. */
  | { t: "projectileBurst"; x: number; y: number; color: string }
  /** Um projétil acertou o jogador. */
  | { t: "projectileHit"; x: number; y: number; color: string }
  | { t: "rockEroded"; x: number; y: number }
  | { t: "pickup"; x: number; y: number; amount: number };
