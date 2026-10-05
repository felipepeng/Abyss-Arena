import { WARN_KEYS, type SfxName } from "../config/sfx";
import type { SimEvent } from "../sim/events";
import type { PhaseStateName } from "../sim/phase";

// Que som cada evento da simulação faz (GDD §10.1). A simulação decide *que* algo aconteceu;
// aqui se decide *como soa*. O `switch` é exaustivo de propósito: um evento novo não compila
// até alguém decidir se ele tem som.

const WARN = new Set<string>(WARN_KEYS);

/** Os marcos da fase que têm som: onda limpa, o chefe começar a lutar, vitória e derrota. */
function phaseSound(state: PhaseStateName): SfxName | null {
  switch (state) {
    case "interlude":
      return "waveClear";
    case "boss":
      return "bossStart";
    case "cleared":
      return "phaseClear";
    case "failed":
      return "defeat";
    default:
      return null;
  }
}

export function soundFor(e: SimEvent): SfxName | null {
  switch (e.t) {
    case "thrust":
      return "thrust";
    case "chargeStart":
      return "charge";
    case "spearHit":
      return "hit";
    case "spearBlocked":
      return "block";
    case "projectilePopped":
      return "pop";
    case "dash":
      return "dash";
    case "dashReady":
      return "dashReady";
    case "playerHurt":
      return "hurt";
    case "playerDied":
      return "playerDie";
    case "pickup":
      return "pickup";
    case "enemyDied":
      return "enemyDie";
    case "bossAppeared":
      return "bossAppear";
    case "bossPhase":
      return "bossPhase";
    case "bossImpact":
      return "bossImpact";
    case "arenaBreak":
      return "arenaBreak";
    case "bossDied":
      return "bossDie";
    case "telegraph": {
      // só os chefes têm som de aviso; os avisos dos inimigos comuns são visuais
      const key = `warn.${e.source}.${e.attack}`;
      return WARN.has(key) ? (key as SfxName) : null;
    }
    case "pullStream":
      return "pullWhoosh";
    case "pillarCrumble":
      return "stoneCrumble";
    case "rockEroded":
      return "rockChip";
    case "phaseChanged":
      return phaseSound(e.state);
    // sem som: ou são detalhe visual, ou já são cobertos por outro evento
    case "spawnWarn": // o redemoinho de bolhas avisa sem som: nascer é frequente e o som cansava
    case "attackStart":
    case "bossVolley":
    case "projectileBurst":
    case "projectileHit":
      return null;
    default: {
      const unhandled: never = e;
      return unhandled;
    }
  }
}
