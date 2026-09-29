// Entrada: teclas e botões do mouse viram AÇÕES. O jogo nunca pergunta por uma tecla
// literal (o protótipo espalhava `KeyR`, `KeyB`... pelo código).
//
// Os handlers do DOM só registram estado. Quem consome é o passo da simulação, que lê
// `isDown`/`wasPressed` e chama `endStep` no fim. Assim nada roda no meio de um frame
// (o protótipo chamava `resetGame` dentro do `keydown`).
//
// Este módulo não conhece as ações do jogo: elas e os atalhos moram em `config/input.ts`.

export interface Bindings<A extends string> {
  /** `KeyboardEvent.code` de cada ação. */
  keys: Readonly<Record<A, readonly string[]>>;
  /** `MouseEvent.button` de cada ação (0 = esquerdo). */
  mouseButtons: Readonly<Partial<Record<A, readonly number[]>>>;
}

export class Input<A extends string> {
  readonly actions: readonly A[];

  /** Posição do mouse em coordenadas do canvas (tela), não do mundo. */
  mouseX = 0;
  mouseY = 0;
  /** O mouse já se mexeu alguma vez sobre o canvas. */
  hasMouse = false;
  /** O mouse se mexeu desde o último passo (devolve a mira ao cursor). */
  mouseMoved = false;

  private readonly keysDown = new Set<string>();
  private readonly buttonsDown = new Set<number>();
  // Flanco de subida acumulado até o próximo passo. Um toque que começa e termina entre
  // dois passos ainda é visto como "pressionado" uma vez.
  private readonly pressed = new Set<A>();
  private readonly keyActions = new Map<string, A[]>();
  private readonly buttonActions = new Map<number, A[]>();

  constructor(private readonly bindings: Bindings<A>) {
    this.actions = Object.keys(bindings.keys) as A[];
    for (const action of this.actions) {
      for (const code of bindings.keys[action]) addTo(this.keyActions, code, action);
      for (const button of bindings.mouseButtons[action] ?? []) addTo(this.buttonActions, button, action);
    }
  }

  /** Devolve true se a tecla pertence a alguma ação (o chamador pode bloquear o padrão). */
  keyDown(code: string): boolean {
    const actions = this.keyActions.get(code);
    // a repetição automática do teclado não é um novo toque
    if (!this.keysDown.has(code)) {
      this.keysDown.add(code);
      if (actions) for (const a of actions) this.pressed.add(a);
    }
    return actions !== undefined;
  }

  keyUp(code: string): void {
    this.keysDown.delete(code);
  }

  mouseDown(button: number): boolean {
    const actions = this.buttonActions.get(button);
    if (!this.buttonsDown.has(button)) {
      this.buttonsDown.add(button);
      if (actions) for (const a of actions) this.pressed.add(a);
    }
    return actions !== undefined;
  }

  mouseUp(button: number): void {
    this.buttonsDown.delete(button);
  }

  mouseMove(x: number, y: number): void {
    if (x !== this.mouseX || y !== this.mouseY) this.mouseMoved = true;
    this.mouseX = x;
    this.mouseY = y;
    this.hasMouse = true;
  }

  /** Solta tudo. Usado quando a janela perde o foco, para nenhuma tecla ficar presa. */
  releaseAll(): void {
    this.keysDown.clear();
    this.buttonsDown.clear();
  }

  isDown(action: A): boolean {
    for (const code of this.bindings.keys[action]) if (this.keysDown.has(code)) return true;
    for (const button of this.bindings.mouseButtons[action] ?? []) if (this.buttonsDown.has(button)) return true;
    return false;
  }

  /** Pressionada desde o último passo. */
  wasPressed(action: A): boolean {
    return this.pressed.has(action);
  }

  /** Fim do passo: os flancos foram consumidos. */
  endStep(): void {
    this.pressed.clear();
    this.mouseMoved = false;
  }
}

function addTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/**
 * Liga o `Input` aos eventos do navegador. O mouse é convertido para coordenadas do canvas
 * interno (`width` × `height`), descontando a escala do letterbox.
 */
export function attachDomInput<A extends string>(input: Input<A>, canvas: HTMLCanvasElement): void {
  const toCanvas = (e: MouseEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return [
      ((e.clientX - r.left) * canvas.width) / r.width,
      ((e.clientY - r.top) * canvas.height) / r.height,
    ];
  };

  window.addEventListener("keydown", (e) => {
    const bound = input.keyDown(e.code);
    // Ctrl/Cmd ficam com o navegador (Ctrl+R, Ctrl+Shift+I...)
    if (bound && !e.ctrlKey && !e.metaKey) e.preventDefault();
  });
  window.addEventListener("keyup", (e) => input.keyUp(e.code));
  canvas.addEventListener("mousemove", (e) => input.mouseMove(...toCanvas(e)));
  canvas.addEventListener("mousedown", (e) => {
    input.mouseMove(...toCanvas(e));
    if (input.mouseDown(e.button)) e.preventDefault();
  });
  // soltar fora do canvas também conta, senão o botão ficaria preso
  window.addEventListener("mouseup", (e) => input.mouseUp(e.button));
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  window.addEventListener("blur", () => input.releaseAll());
}
