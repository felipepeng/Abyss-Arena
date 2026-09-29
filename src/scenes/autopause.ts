import type { App } from "./app";
import { GameScene } from "./game";

// Pausa sozinho quando a janela perde o foco (trocar de aba, clicar fora): o jogador não morre
// enquanto olha outra coisa. Só vale durante a fase; nos menus não há o que pausar, e se a
// pausa já está aberta, um segundo pedido a fecharia.

/** Devolve true se pediu a pausa. */
export function pauseIfPlaying(app: App): boolean {
  if (app.scenes.transitioning || !(app.scenes.top instanceof GameScene)) return false;
  app.input.trigger("pause");
  return true;
}
