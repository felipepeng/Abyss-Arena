import { EEL } from "../../config/enemies/eel";
import { len } from "../../core/math";
import type { Enemy, EnemyDef } from "./types";
import type { World } from "../world";

// Enguia: mora numa toca. Com o jogador a menos de 160 px, os olhos acendem e uma linha mostra
// a trajetória (450 ms); ela dá um bote de 300 ms e volta à toca em ~600 ms. Escondida (e no
// aviso), não pode ser atingida: a janela é o bote e a volta (GDD §6.2). Para a onda acabar
// ela precisa morrer, então o jogador tem que provocá-la e punir a volta.

/** Aponta (dirX, dirY) para o jogador: os olhos acompanham. */
function lookAtPlayer(e: Enemy, w: World): void {
  const dx = w.player.x - e.x;
  const dy = w.player.y - e.y;
  const d = len(dx, dy) || 1;
  e.dirX = dx / d;
  e.dirY = dy / d;
}

export const EEL_DEF: EnemyDef = {
  kind: "eel",
  stats: {
    radius: EEL.radius,
    collRadius: EEL.radius * EEL.collScale,
    hp: EEL.hp,
    drag: EEL.drag,
    contactDamage: EEL.contactDamage,
    dropChance: EEL.dropChance,
    placement: "spot",
  },
  initial: "hidden",

  init(e) {
    // o ponto de nascimento é a toca
    e.data.denX = e.x;
    e.data.denY = e.y;
    e.data.returnSpeed = 0;
    e.t = EEL.spawnGraceMs;
  },

  // só o bote e a volta deixam a cabeça exposta
  onHit(e) {
    return e.state === "strike" || e.state === "return" ? "damage" : "ignore";
  },

  states: {
    hidden: {
      maxSpeed: 0,
      noContact: true,
      enter(e) {
        e.t = EEL.rehideMs;
      },
      update(e, w) {
        e.vx = e.vy = 0;
        lookAtPlayer(e, w);
        const dist = len(w.player.x - (e.data.denX ?? e.x), w.player.y - (e.data.denY ?? e.y));
        if (e.t <= 0 && !w.playerDead && dist < EEL.triggerR) return "telegraph";
      },
    },

    telegraph: {
      maxSpeed: 0,
      telegraph: true,
      noContact: true,
      enter(e, w) {
        e.t = EEL.telegraphMs;
        w.events.push({ t: "telegraph", x: e.x, y: e.y, source: "eel", attack: "strike" });
      },
      update(e, w) {
        e.vx = e.vy = 0;
        // a linha de trajetória acompanha o jogador até o último passo do aviso
        lookAtPlayer(e, w);
        if (e.t <= 0) return "strike";
      },
    },

    strike: {
      maxSpeed: EEL.strikeSpeed,
      harmful: true,
      enter(e, w) {
        e.t = EEL.strikeMs;
        e.vx = e.dirX * EEL.strikeSpeed;
        e.vy = e.dirY * EEL.strikeSpeed;
        w.events.push({ t: "attackStart", x: e.x, y: e.y, source: "eel", attack: "strike" });
      },
      // termina antes se bater na rocha
      update(e) {
        if (e.t <= 0 || e.blockedX || e.blockedY) return "return";
      },
    },

    return: {
      maxSpeed: EEL.strikeSpeed,
      enter(e) {
        const d = len((e.data.denX ?? e.x) - e.x, (e.data.denY ?? e.y) - e.y);
        e.data.returnSpeed = Math.max(EEL.returnMinSpeed, d / (EEL.returnMs / 1000));
        // com folga: se algo a prender no caminho, ela é recolocada na toca em vez de ficar de fora
        e.t = EEL.returnMs * 2;
      },
      update(e, _w, dt) {
        const dx = (e.data.denX ?? e.x) - e.x;
        const dy = (e.data.denY ?? e.y) - e.y;
        const d = len(dx, dy);
        if (d <= EEL.returnSnapDist || e.t <= 0) {
          e.x = e.data.denX ?? e.x;
          e.y = e.data.denY ?? e.y;
          e.vx = e.vy = 0;
          return "hidden";
        }
        // não passa da toca num passo só
        const speed = Math.min(e.data.returnSpeed ?? EEL.returnMinSpeed, d / dt);
        e.vx = (dx / d) * speed;
        e.vy = (dy / d) * speed;
      },
    },
  },
};
