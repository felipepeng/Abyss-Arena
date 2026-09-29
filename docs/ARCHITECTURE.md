# ARCHITECTURE — Abyss Arena

Descreve **como** o código é organizado. Para o que o jogo é, veja [`GDD.md`](GDD.md); para a
ordem de construção, [`ROADMAP.md`](ROADMAP.md). As falhas do protótipo que esta arquitetura
resolve estão em [`CONTEXTO.md`](CONTEXTO.md) §7.4 e §9. A tabela da §11 liga cada falha à sua
solução.

---

## 1. Stack

| Peça | Escolha | Por quê |
|---|---|---|
| Linguagem | TypeScript, `strict: true` | Chefes, ataques e inimigos viram **dados**; a tipagem pega definição incompleta em tempo de compilação. |
| Build/dev | Vite | Servidor rápido, recarga ao salvar, build estático sem configuração. |
| Testes | Vitest | Mesma configuração do Vite; testa a lógica pura da simulação. |
| Render | Canvas 2D | A arte é vetorial por código (GDD §9.1). Não precisa de WebGL. |
| Áudio | Web Audio API | Síntese de efeitos e música (GDD §10). |
| Engine | nenhuma | O protótipo já provou que o núcleo cabe em pouco código; uma engine traria mais do que resolve. |

Nenhuma dependência de runtime além do navegador. Dependências de desenvolvimento: `vite`,
`typescript`, `vitest` e, opcionalmente, `eslint` e `prettier`.

---

## 2. Estrutura de pastas

```
src/
  main.ts            ponto de entrada: cria canvas, laço, gerenciador de cenas
  core/              infraestrutura sem conhecimento de jogo
    loop.ts          passo fixo 60 Hz + acumulador + alpha de interpolação
    rng.ts           RNG com semente (mulberry32 ou similar), instanciável
    math.ts          clamp, lerp, angLerp, len, vetores
    input.ts         teclado/mouse → AÇÕES (move, aim, attack, dash, pause...)
    events.ts        barramento de eventos da simulação (hit, hurt, death, telegraph...)
    pool.ts          pool de objetos com swap-remove
  config/            todo número de ajuste, separado por domínio
    player.ts  spear.ts  camera.ts  particles.ts  pickups.ts  waves.ts
    enemies/   fish.ts circler.ts hermit.ts urchin.ts jellyling.ts eel.ts watcher.ts lamprey.ts
    bosses/    crab.ts jelly.ts eye.ts
    maps/      rift.ts coral.ts abyss.ts
  sim/               simulação pura (determinística dada a semente)
    world.ts         estado do mundo: grade, entidades, projéteis, pickups, câmera-alvo
    physics.ts       integrador de nado (aceleração, arrasto implícito, teto)
    collision.ts     corpo × grade, separação por eixo com margem
    player.ts        nado, dash (com i-frames), máquina da lança, hitbox
    enemies/         comportamentos dos inimigos (um arquivo por tipo) + runner genérico
    bosses/          runner genérico de chefe + ataques de cada chefe
    projectiles.ts   movimento, colisão, erosão
    pickups.ts       bolhas de cura
    combat.ts        funil de dano ao jogador, dano a inimigo, hit-stop, empurrão
    phase.ts         máquina de estados da fase (ondas → chefe)
  world/             geração e definição de mapas
    grid.ts          Uint8Array + consultas (isSolid, raycast)
    mapdef.ts        tipos do formato de mapa híbrido
    builder.ts       MapDef + semente → grade + marcadores
    maps/            os 3 layouts desenhados à mão
  render/            só lê estado; nunca escreve na simulação
    renderer.ts      orquestra camadas, câmera, interpolação, tremor
    background.ts    gradiente + colunas de luz (cache por mapa)
    rocks.ts         rocha em OffscreenCanvas, redesenhada só quando a grade muda
    creatures/       um desenhador por criatura (player, fish, crab, ...)
    telegraphs.ts    desenho dos avisos
    projectiles.ts  particles.ts  pickups.ts
  fx/                efeitos de apresentação
    particles.ts     bolhas (pool)
    shake.ts         tremor de tela
  audio/
    engine.ts        AudioContext, barramentos (music/sfx), volume
    sfx.ts           síntese de cada efeito
    music.ts         sequenciador procedural por mapa, camadas de intensidade
    sources.ts       interface MusicSource (procedural agora, arquivo depois)
  scenes/
    manager.ts       pilha de cenas + fades
    title.ts  arenaSelect.ts  controls.ts  game.ts  pause.ts  result.ts
  ui/
    hud.ts  menu.ts  titleCard.ts  text.ts
  debug/
    overlay.ts       hitboxes, estados, velocidades, FPS
    cheats.ts        pular onda, invocar chefe, invencível
tests/               Vitest, espelhando src/sim e src/world
public/              index.html estático, favicon
```

**Regra de dependência:** `core` ← `config` ← `world` ← `sim` ← (`render`, `audio`, `fx`,
`ui`) ← `scenes` ← `main`. As setas apontam para quem pode ser importado: `sim` pode importar
`world`, mas **`sim` nunca importa `render`, `audio`, `fx`, `ui` ou `scenes`**. A comunicação no
sentido contrário é por eventos (§4.2).

---

## 3. Laço e tempo

```
frame(now):
  elapsed = min(now − last, 100)
  acc += elapsed
  while acc ≥ DT (16,667 ms):
    acc −= DT
    if hitStopMs > 0: hitStopMs −= DT        // simulação congelada
    else: scene.step(DT)                     // passo fixo
  alpha = acc / DT
  scene.render(alpha)                        // interpola entre o passo anterior e o atual
```

- **Simulação a 60 Hz fixos**, igual ao protótipo. Todos os números de feel foram calibrados
  assim.
- **Interpolação de render:** cada entidade guarda `prevX/prevY/prevAng` antes do passo. O
  render desenha `lerp(prev, cur, alpha)`. Isso resolve a repetição de quadros a 144 Hz
  (CONTEXTO §9).
- **Hit-stop mora no laço**, como no protótipo: congela física, cronômetros, partículas e câmera
  igualmente. As partículas também usam passo fixo.
- **Pausa** é da cena, não do laço: a cena de jogo simplesmente não chama `step` enquanto a
  pausa está por cima.
- **`resetGame` nunca roda dentro de um handler de evento DOM.** A entrada só marca intenções;
  a cena as consome no início do próximo passo (resolve CONTEXTO §7.4, item 7).

---

## 4. Simulação × apresentação

### 4.1 Separação

- `sim/` contém estado e regras. É **determinística** dada a semente e a sequência de entradas.
  Nada nela lê o relógio, o DOM ou `Math.random`.
- `render/` lê o estado de `sim` (somente leitura) e desenha. Desenhadores **não** leem
  `config/` para decidir comportamento. Se precisam de um número de gameplay (ex.: o raio do
  aviso da pinça), a simulação expõe esse número no estado do ataque.
- Estado **só visual** (fase da ondulação dos tentáculos, animação das pernas) mora no
  desenhador ou num campo `anim` separado, que a simulação não lê.

### 4.2 Eventos

A simulação emite eventos num buffer por passo. Render, áudio e FX os consomem depois do passo:

```ts
type SimEvent =
  | { t: "spearHit"; x: number; y: number; dirX: number; dirY: number; targetR: number }
  | { t: "spearBlocked"; x: number; y: number }
  | { t: "projectilePopped"; x: number; y: number; color: string }
  | { t: "playerHurt"; x: number; y: number; amount: number }
  | { t: "enemyDied"; x: number; y: number; kind: EnemyKind }
  | { t: "telegraph"; source: string; attack: string }
  | { t: "spawnWarn"; x: number; y: number }
  | { t: "pickup"; x: number; y: number }
  | { t: "phaseChanged"; state: PhaseState }
  | { t: "bossPhase"; boss: BossKind; phase: number }
  | { t: "dash" } | { t: "thrust"; charge: number } | { t: "rockEroded"; x: number; y: number };
```

Bolhas, tremor e sons são **reações** a eventos. A simulação decide *que* algo aconteceu e o
resto decide *como* aparece. O hit-stop é a exceção: é estado de simulação (`world.hitStopMs`),
porque congela a própria simulação.

---

## 5. Modelo de dados

### 5.1 Config

Um módulo por domínio, exportando objetos `as const` tipados. Os valores iniciais são **os do
protótipo** (CONTEXTO §8) mais os do GDD. Contas de restrição ficam como comentário junto do
número (ex.: `sweepSpeed` da Água-viva com a conta `ω · 215 < 250`).

### 5.2 Entidades

Sem ECS. **Tipos concretos em arrays com pool**:

```ts
interface Body { x: number; y: number; vx: number; vy: number; prevX: number; prevY: number;
                 radius: number; collR: number; }

interface Enemy extends Body {
  id: number; kind: EnemyKind; hp: number; maxHp: number;
  state: string; stateT: number;          // estado atual e tempo restante nele
  ang: number; prevAng: number;
  flashMs: number; noDrop: boolean;       // noDrop = invocado por chefe
  data: Record<string, number>;           // campos próprios do tipo (wob, orbitAng...)
}
```

- `enemies`, `projectiles`, `pickups` e `particles` são **pools** com remoção por swap-remove.
  Nada de `filter` por passo (CONTEXTO §7.4, item 8).
- A lista de alvos da lança é iterada **sem alocar** (inimigos e depois o chefe), sem
  `concat`.
- IDs são inteiros crescentes por mundo; o `hitIds` da lança é um `Set<number>` limpo no início
  de cada golpe.

### 5.3 Inimigos por dados

Cada tipo é uma `EnemyDef`: atributos (do config) e uma **máquina de estados declarativa** com
funções pequenas por estado:

```ts
interface EnemyDef {
  kind: EnemyKind;
  stats: EnemyStats;                         // vida, raio, velocidades, dano, chance de drop
  initial: string;
  states: Record<string, EnemyState>;
  onHit?(e: Enemy, hit: SpearHit, w: World): "damage" | "block";   // blindagem do Ermitão
  draw: string;                              // chave do desenhador em render/creatures
}
interface EnemyState {
  enter?(e: Enemy, w: World): void;
  update(e: Enemy, w: World, dt: number): string | void;   // retorna o próximo estado
  telegraph?: boolean;                       // marca estado de aviso (debug + regra de ouro)
  harmful?: boolean;                         // true = dano cheio no contato; false = metade
}
```

Um **runner genérico** (`sim/enemies/runner.ts`) cuida do que é comum a todos: integrador de
movimento, colisão, contato com o jogador (dano cheio ou metade, conforme `harmful`), morte,
drop. Os estados só decidem a aceleração, o alvo e as transições.

**Percepção:** o runner expõe `canSee(e, w)` (distância + linha de visão pela grade). O peixe
continua usando só distância, como no protótipo, mas a Medusinha e a Vigia usam linha de visão,
para que o coral e os pilares funcionem como cobertura contra elas.

### 5.4 Chefes por dados

É o padrão que o protótipo repete três vezes (CONTEXTO §11), agora extraído:

```ts
interface BossDef {
  kind: BossKind; name: string; stats: BossStats;
  phases: BossPhase[];                       // tamanho livre (2 para Caranguejo, 3 para Olho)
  movement(b: Boss, w: World, dt: number): void;   // o que ele faz no "think"
  onPhaseEnter?(b: Boss, w: World, phase: number): void;   // ex.: dissolver pilares
}
interface BossPhase {
  hpAtOrBelow: number;                       // 1, 0.66, 0.33...
  thinkMs: number;
  pool: { attack: string; weight: number }[];
  rerollRepeatChance: number;
}
interface AttackDef {
  id: string;
  telegraphMs(b: Boss): number;              // pode depender da fase
  onTelegraph?(b: Boss, w: World, dt: number): void;   // ex.: travar mira, seguir jogador
  executeMs(b: Boss): number;
  onExecute(b: Boss, w: World, dt: number, t: number): void;
  recoverMs(b: Boss): number;
  next?(b: Boss, w: World): string | null;   // encadear (investida dupla do Caranguejo)
}
```

- O **runner de chefe** faz `think → telegraph → execute → recover → think`, o sorteio com
  reroll e a troca de fase. Um chefe novo só adiciona arquivos; não mexe em `switch` nenhum.
- A barra de vida lê `phases[].hpAtOrBelow` para desenhar as marcas (resolve CONTEXTO §7.4,
  item 3).
- Não existe mais `boss` global único: o mundo tem `bosses: Boss[]`, mesmo que a v1 use um só.
- O raio da Água-viva deixa de usar `b.t += DTMS` (CONTEXTO §7.4, item 1): o `AttackDef` dele
  tem **dois subestágios explícitos** (`extend` e `sweep`) dentro de `onExecute`.

### 5.5 Projéteis

Um único tipo com campos opcionais de comportamento (`turnRate` para perseguidores,
`maxDist` para espinhos, `erodes` para erosão, `color`). O pool tem teto de 900. A erosão
consulta a **máscara de protegidos** do mapa antes de destruir um bloco.

---

## 6. Mundo e mapas

### 6.1 Grade

`Uint8Array` de 1 byte por bloco de 20 px. Valores: `0` água, `1` rocha, `2` rocha protegida
(nunca erode), `3` coral (sólido, visual distinto). As consultas (`isSolid`, `raycast`,
`sampleBody`) moram em `world/grid.ts`. A grade marca um **flag de sujeira** quando muda, para o
cache de render (§7).

### 6.2 Colisão

Substitui as cinco redes de segurança do protótipo (CONTEXTO §9):

- **Separação por eixo com margem (`skin`):** move em X, resolve, move em Y, resolve. A
  resolução empurra o corpo para a face do bloco mais a margem de 0,01 px, calculando pela
  posição do bloco, sem laço de "empurra 1 px até sair".
- **Sub-passos para corpos rápidos:** se `|v| · dt > collR`, o movimento é dividido em
  sub-passos de no máximo `collR`. Isso cobre dash (640 px/s ≈ 10,7 px/passo) e investidas.
- **Invariante:** nenhum corpo começa um passo dentro da rocha. Nascimentos validam a posição.
  Quando a erosão ou a dissolução de um pilar muda a grade, nenhum corpo fica preso (só se remove
  rocha). Se a invariante falhar mesmo assim, `unstick` roda como **fallback com
  `console.warn`**, para o bug aparecer em vez de ser escondido.
- **Limite da área jogável** pela borda do mapa, não pelo canvas.

### 6.3 Formato do mapa híbrido

```ts
interface MapDef {
  id: "rift" | "coral" | "abyss";
  size: { cols: number; rows: number };
  layout: string[];              // ASCII: '#' rocha, 'P' protegida, 'C' coral, '.' água,
                                 //        '~' área onde o procedural pode pôr detalhes
  markers: {
    playerStart: Pt; bossSpawn: Pt;
    spawnZones: Rect[];          // zonas de nascimento das ondas
    fixedEnemies: { kind: EnemyKind; at: Pt }[];   // Ouriços
    eelDens: Pt[];               // tocas de enguia
    pillars?: Rect[];            // Fosso: pilares nomeados para dissolver por fase
  };
  procedural: ProceduralParams;  // relevo por senos, blobs, ramificações... cada um opcional
  palette: MapPalette;
  titleCard: { name: string; depth: string; line: string };
  waves: WaveDef[];              // composição das 3 ondas (GDD §3.2)
  music: MusicParams;
}
```

- `world/builder.ts` recebe `MapDef` e semente e devolve a grade mais os marcadores
  resolvidos. **O procedural só escreve em células `~`**. A estrutura desenhada nunca muda.
- A mesma semente gera o mesmo mapa. "Tentar de novo" reusa a semente (GDD §2.3).
- Os pilares do Fosso são listas de índices de bloco, geradas a partir de `markers.pillars`.
  Ficam **dentro do mundo** (`world.pillars`), não em globais (CONTEXTO §7.4, item 6).

### 6.4 Câmera

Usada em **todos** os mapas (todos são maiores que a tela). Alvo = `jogador + mira · 60 −
centro_da_tela`, limitado às bordas do mundo, suavizado por `0,12` por passo fixo. O mouse guarda
coordenadas de tela e é convertido para o mundo a cada passo. O render interpola a câmera junto
com as entidades.

---

## 7. Render

- **Camadas, na ordem:** fundo (cache) → rocha (cache) → pickups → projéteis de baixo → avisos
  → criaturas → jogador → lança → partículas → HUD (sem tremor) → overlays de cena (fade,
  cartão de título, menus).
- **Cache em `OffscreenCanvas`:** o fundo é renderizado uma vez por mapa, numa altura igual à
  da tela. A rocha é renderizada no tamanho do mundo inteiro e só é redesenhada, por blocos, quando
  a grade fica suja (erosão, pilar dissolvido). No frame, só se copia a região da câmera.
- **Resolução:** canvas interno fixo de 960 × 540, escalado por CSS mantendo proporção (letterbox).
  Sem `image-rendering: pixelated`, porque a arte é vetorial.
- **Interpolação:** todo desenhador recebe `alpha` e usa `prev*`/atual.

---

## 8. Áudio

```ts
interface MusicSource {
  start(ctx: AudioContext, out: AudioNode): void;
  setIntensity(level: 0 | 1 | 2): void;   // ondas / chefe / fase final do chefe
  stop(fadeMs: number): void;
}
```

- `audio/engine.ts` cria o `AudioContext` no primeiro gesto do usuário (política dos
  navegadores), com barramentos `music` e `sfx` independentes, cada um com o próprio `GainNode`.
- `sfx.ts`: uma função por efeito do GDD §10.1, sintetizada com osciladores, ruído branco com
  filtro e envelopes. Variação de altura de ±5% por disparo. Os efeitos são disparados a partir
  dos **eventos** da simulação (§4.2).
- `music.ts` implementa `MusicSource` com um sequenciador simples (escala, tempo, padrões por
  camada) definido em `MapDef.music`. **Música em arquivo, no futuro, é outra implementação de
  `MusicSource`**, e o resto do código não muda.
- O **hit-stop não pausa o áudio**. O som do acerto toca no começo do congelamento.

---

## 9. Fluxo de jogo

### 9.1 Cenas

Pilha de cenas com fade de ~300 ms entre trocas:

```
Title ─┬─ Descida ──────────────► Game(rift) → Game(coral) → Game(abyss) → Result(final)
       ├─ Arena livre → ArenaSelect → Game(x) → Result(fase) → ArenaSelect
       ├─ Controles
       └─ Áudio
Game ── Esc/P ──► Pause (sobreposta; Game não chama step)
Game ── morte ──► Result(derrota) → Tentar de novo (mesma semente) | Title
```

A cena `Game` recebe `{ mapId, mode, seed }` e cria um `World` novo. A Descida é um objeto
pequeno de sessão (`runIndex`, `deaths`, `timeMs`) que vive fora do `World`.

### 9.2 Máquina da fase (`sim/phase.ts`)

```
intro(titleCard) → wave(1) → interlude → wave(2) → interlude → wave(3) → interlude
  → bossIntro → boss → cleared
qualquer estado (exceto cleared) → failed   (vida do jogador = 0)
```

| Estado | Duração | Sai quando |
|---|---|---|
| `intro` | 2500 ms | tempo |
| `wave(n)` | — | fila vazia **e** nenhum inimigo da onda vivo |
| `interlude` | 2500 ms (3000 antes do chefe) | tempo |
| `bossIntro` | 1500 ms | tempo; o chefe fica inerte e invulnerável |
| `boss` | — | chefe morto → `cleared` |

O **spawner de onda** (fila, teto de 6 vivos, intervalo de 600 ms, aviso de 500 ms, zonas do
mapa) mora aqui. Os capangas invocados pelo Caranguejo entram direto no mundo, com
`noDrop = true`, e não contam na onda.

---

## 10. Depuração e testes

### 10.1 Modo de depuração

Ligado por `?debug` na URL ou `F1`:

| Tecla | Efeito |
|---|---|
| `F1` | overlay: hitboxes (corpo, lança, ataques), estado e tempo de cada criatura, velocidades, FPS, contagem dos pools |
| `F2` | invencível |
| `F3` | pular para a próxima onda |
| `F4` | ir direto ao chefe |
| `F5` | forçar a próxima fase do chefe |
| `F6` | regenerar o mapa com semente nova |
| `F7` | câmera lenta (0,25×) |

A semente atual aparece no overlay, para que um bug de mapa possa ser reproduzido.

### 10.2 Testes (Vitest)

Só lógica pura de `sim/` e `world/`, sem DOM:

- **Nado:** 0 → 250 px/s em ~267 ms; a velocidade cai a 10% em ~700 ms depois de soltar.
- **Dash:** percorre ~89 px; invulnerável nos passos de 0 a 100 ms e vulnerável depois; cancela a
  recuperação da lança.
- **Lança:** tempos de cada fase; um acerto por inimigo por golpe; interpolação da carga.
- **Funil de dano:** 667 ms de invulnerabilidade; metade do dano fora do ataque.
- **Colisão:** um corpo a 640 px/s contra uma parede de 1 bloco não atravessa; nenhum corpo
  termina um passo dentro da rocha.
- **Fase:** sequência de estados; a onda só termina com todos mortos; `failed` a partir de
  qualquer estado.
- **Chefes:** sorteio com reroll; troca de fase nos limiares; `ω · hoverDist < 250` para todo
  ataque rotacional do config.
- **Mapas:** mesma semente → mesma grade; o procedural não toca células fixas; toda zona de
  nascimento está em água; os corredores do coral têm ≥ 80 px.
- **Harness de simulação:** roda N segundos com entradas roteirizadas (ex.: "jogador parado
  atrás de um pilar") e mede o dano recebido, como foi feito no protótipo para o Olho.

---

## 11. Falhas do protótipo → solução

| Falha (CONTEXTO) | Solução aqui |
|---|---|
| Escopo global, `boss` único | `World` como objeto; `bosses: Boss[]` (§5.4) |
| Despacho por `kind` em `switch` | `EnemyDef` e `BossDef` como dados + runners genéricos (§5.3, §5.4) |
| `filter` em três arrays por passo | pools com swap-remove (§5.2) |
| `enemies.concat([boss])` por golpe | iteração sem alocar (§5.2) |
| Desenho imediato de tudo | cache de fundo e rocha em `OffscreenCanvas` (§7) |
| Sem separação sim/render | regra de dependência + eventos (§2, §4) |
| Sem interpolação | `prev*` + `alpha` (§3) |
| Fases como array por `phase − 1` | `BossPhase[]` de tamanho livre (§5.4) |
| Cinco redes antitravamento | separação por eixo com margem + sub-passos + invariante (§6.2) |
| Erosão só protege a borda | máscara de protegidos por mapa (§5.5, §6.1) |
| Câmera exercitada num caso só | câmera em todos os mapas (§6.4) |
| `b.t += DTMS` no raio | subestágios explícitos (§5.4) |
| Marca de 50% em toda barra | marcas vindas de `phases` (§5.4) |
| `resetGame` no `keydown` | entrada vira intenção, consumida no passo (§3) |
| Teclas literais espalhadas | entrada por ações (§2, `core/input.ts`) |
| Sem semente | `core/rng.ts` + semente no overlay (§10.1) |
| `freeSpot` por tentativa e erro | zonas de nascimento desenhadas no mapa (§6.3) |
| Código morto (`knockbackTakenMult`, `didHit`...) | não portar; `noUnusedLocals` no tsconfig |
| Degrau do clamp ao fim do dash | aproximar o teto de 250 com arrasto extra nos primeiros ~80 ms depois do dash, em vez de cortar num frame. **Validar no M1 se não mexe no feel** |
