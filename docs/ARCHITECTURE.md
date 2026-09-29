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
    loop.ts          passo fixo 60 Hz + acumulador + alpha de interpolação + escala de tempo
    rng.ts           RNG com semente (mulberry32 ou similar), instanciável
    math.ts          clamp, lerp, angLerp, len, vetores
    input.ts         teclado/mouse → AÇÕES, genérico: as ações e teclas vêm de config/input.ts
    events.ts        barramento de eventos da simulação (hit, hurt, death, telegraph...)
    pool.ts          pool de objetos com swap-remove
    display.ts       imagem do canvas em pixels reais + escala lógico → real por frame
  config/            todo número de ajuste, separado por domínio
    system.ts        resolução, passo fixo, teto por frame, fade, fonte
    input.ts         ações do jogo e atalhos (jogo + depuração)
    world.ts         tamanho do bloco, margem da colisão
    fx.ts            bolhas e tremor por evento
    palette.ts       paletas de fundo e rocha
    combat.ts        contato, teto do pool de inimigos, projéteis (teto, erosão)
    spawn.ts         nascimento provisório por tempo e anel de depuração (até o M3)
    player.ts  spear.ts  camera.ts  pickups.ts  waves.ts
    enemies/   fish.ts circler.ts dummy.ts (saco de pancada, depuração)
               hermit.ts urchin.ts jellyling.ts eel.ts watcher.ts lamprey.ts
    bosses/    crab.ts jelly.ts eye.ts
    maps/      rift.ts coral.ts abyss.ts  (paleta, relevo procedural, ondas, cartão de título)
    kinds.ts         nomes dos tipos de inimigo e de chefe (world/ e sim/ precisam deles)
    waves.ts         tempos do fluxo da fase e do nascimento das ondas
  sim/               simulação pura (determinística dada a semente)
    world.ts         estado do mundo e `stepWorld`: grade, entidades, projéteis, pickups, câmera
    body.ts          corpo físico comum (posição, velocidade, prev*, raios)
    camera.ts        câmera com look-ahead (mora aqui porque a mira depende dela)
    events.ts        tipos dos eventos da simulação
    physics.ts       integrador de nado (aceleração, arrasto implícito, teto)
    collision.ts     corpo × grade, separação por eixo com margem
    player.ts        nado, dash (com i-frames), máquina da lança, hitbox
    enemies/         comportamentos dos inimigos (um arquivo por tipo) + runner genérico +
                     registry.ts (tipo → EnemyDef); o saco de pancada é um tipo como os outros
    spawner.ts       nascimento provisório por tempo (M2; sai com as ondas do M3)
    debug.ts         ações de depuração que mexem na simulação (anel de projéteis)
    bosses/          runner genérico de chefe + um arquivo por chefe + registry.ts
    projectiles.ts   movimento, colisão, erosão
    pickups.ts       bolhas de cura
    combat.ts        funil de dano ao jogador, dano a inimigo, hit-stop, empurrão
    phase.ts         máquina de estados da fase (ondas → chefe)
  world/             geração e definição de mapas
    grid.ts          Uint8Array + consultas (isSolid, raycast)
    mapdef.ts        tipos do formato de mapa híbrido
    builder.ts       MapDef + semente → grade + marcadores
    maps/            os 3 layouts desenhados à mão (rift.ts no M3)
    testArena.ts     arena de teste do M1–M2 (`?arena=test`)
  render/            só lê estado; nunca escreve na simulação
    renderer.ts      orquestra camadas, câmera, interpolação, tremor
    background.ts    gradiente + colunas de luz (cache por mapa)
    rocks.ts         rocha em OffscreenCanvas, redesenhada só quando a grade muda
    creatures/       um desenhador por criatura (player, fish, crab, ...)
    telegraphs.ts    desenho dos avisos
    projectiles.ts  particles.ts  pickups.ts
  fx/                efeitos de apresentação
    fx.ts            reage aos eventos da simulação (bolhas, tremor)
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
    sandbox.ts       provisória do M0 (teste de entrada e de fade); sai quando game.ts existir
  ui/
    hud.ts  menu.ts  titleCard.ts  text.ts
  debug/
    overlay.ts       hitboxes, estados, velocidades, FPS
    cheats.ts        pular onda, invocar chefe, invencível
tests/               Vitest, espelhando src/sim e src/world
  fixtures/          rastros gravados do protótipo (paridade)
tools/               scripts de desenvolvimento (gravar rastros do protótipo)
index.html           página única na raiz (convenção do Vite); o CSS faz o letterbox (§7)
public/              arquivos estáticos (favicon)
prototipo/           o protótipo original, referência de paridade
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
  igualmente. As partículas também usam passo fixo. **Durante o hit-stop o alpha é 1**: com o
  alpha do acumulador, a imagem oscilaria entre o passo anterior e o atual em vez de parar.
  O hit-stop é consultado pelo gancho `consumeHitStop` da cena do topo (`core/loop.ts`).
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
  state: string; t: number;               // estado atual e tempo restante nele
  stateMs: number;                        // duração com que o estado começou (progresso do aviso)
  ang: number; prevAng: number; dirX: number; dirY: number;
  flashMs: number; noDrop: boolean; dead: boolean;   // noDrop = invocado por chefe
  data: Record<string, number>;           // campos próprios do tipo (wob, orbitAng...)
}
```

- `enemies`, `projectiles`, `pickups` e `particles` são **pools** com remoção por swap-remove.
  Nada de `filter` por passo (CONTEXTO §7.4, item 8). O passo não aloca por projétil
  (`tests/perf/allocation.test.ts` compara 0 e 300 projéteis).
- **Objetos que vivem muitos passos nascem com os campos numéricos em `UNSET` (NaN)**, num literal
  que lista todos os campos, e são reaproveitados campo a campo (`resetBody`). Um campo que nasce
  com `0` e recebe frações fica com representação genérica no V8 e empacota cada número gravado;
  espalhamento (`{ ...obj }`), `Object.assign`, `delete` e variáveis de módulo com números também
  empacotam; `Math.hypot` aloca a cada chamada (use `len`). Tudo isso foi medido no Chrome com o
  profiler de heap. O que sobra é o V8 empacotando números passados como argumento entre funções
  não embutidas: alguns bytes por criatura por passo, que não vale distorcer o código para evitar.
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

Implementado no M3 (`sim/bosses/`). Resumo dos tipos (a fonte é `sim/bosses/types.ts`):

```ts
interface BossDef {
  kind: BossKind; name: string; rageLabel: string; stats: BossStats;
  phases: BossPhase[];                       // tamanho livre (2 para Caranguejo, 3 para Olho)
  phaseChangeThinkMs: number;                // pausa curta ao mudar de fase
  attacks: Record<string, AttackDef>;
  think(b, w, dt, aim): void;                // o que ele faz enquanto pensa (se aproximar, vagar)
  orient?(b, aimAng): void;                  // orientação do corpo, depois do movimento
  slide?: { durationMs; accelScale };        // desliza pela tangente ao bater na rocha
  onPhaseEnter?(b, w, phase): void;          // ex.: dissolver pilares
}
interface BossPhase {
  hpBelow: number; inclusive?: boolean;      // entra abaixo (ou em, com inclusive) desta fração
  thinkMs: number;
  pool: string[];                            // repetir um nome = mais peso (como no protótipo)
  rerollRepeatChance: number;
}
interface AttackDef {
  telegraphMs(b): number;                    // pode depender da fase
  onTelegraph?(b, w, dt, aim): void;         // frear, travar a mira
  executeMs(b): number;                      // 0 = instantâneo no fim do aviso (o chamado)
  onStart?(b, w): void;                      // o passo em que a execução começa
  onExecute?(b, w, dt, aim): boolean | void; // true = termina antes (investida bateu)
  next?(b, w): { attack; telegraphMs } | null;   // encadear (investida dupla)
  uncapped?; ownContact?; slides?;           // sem teto / dano de contato próprio / desliza
  fxSize?(b): number;                        // alcance do golpe, para efeito e desenho
}
```

- O **runner de chefe** faz `pensar → aviso → execução → (encadear) → pensar`, o sorteio com
  reroll e a troca de fase, na mesma ordem de operações do `updateCrab` do protótipo. Um chefe
  novo só adiciona arquivos; não mexe em `switch` nenhum.
- **Diferenças do desenho original:** não há estado de recuperação separado (o protótipo não
  tinha; a pausa do "pensar" faz esse papel); o *pool* é uma lista com repetições, e não pares
  (ataque, peso), porque é o que reproduz o sorteio do protótipo passo a passo; o limiar de fase
  é "abaixo de" com `inclusive` opcional, porque o Caranguejo usa `<` e o Olho usa `≤`.
- A barra de vida lê `phases[].hpBelow` para desenhar as marcas (resolve CONTEXTO §7.4,
  item 3).
- Durante a entrada (GDD §2.2) o chefe existe mas fica inativo: não age, não ataca e a lança
  não o acerta.
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
- O mapa e a simulação usam sequências aleatórias separadas, derivadas da mesma semente
  (`SIM_SEED_SALT` em `sim/world.ts`): mexer no gerador do mapa não muda o que acontece na
  luta, e vice-versa.
- Os tipos de criatura (`EnemyKind`, `BossKind`) moram em `config/kinds.ts`, porque os
  mapas listam as ondas e `world/` não pode importar `sim/`.
- Os pilares do Fosso são listas de índices de bloco, geradas a partir de `markers.pillars`.
  Ficam **dentro do mundo** (`world.pillars`), não em globais (CONTEXTO §7.4, item 6).

### 6.4 Câmera

Usada em **todos** os mapas (todos são maiores que a tela). Alvo = `jogador + mira · 60 −
centro_da_tela`, limitado às bordas do mundo, suavizado por `0,12` por passo fixo. O mouse guarda
coordenadas de tela e é convertido para o mundo a cada passo. O render interpola a câmera junto
com as entidades.

---

## 7. Render

- **Camadas, na ordem:** fundo (cache) → rocha (cache) → partículas → pickups → avisos de
  nascimento → criaturas (cada uma com o próprio aviso) → chefe (com os avisos dele: faixa,
  círculo, anéis) → projéteis → jogador (com a lança **por baixo** do corpo) → HUD (sem tremor)
  → overlays de cena (fade, cartão de título, menus). É a ordem do protótipo: as bolhas
  do acerto nascem atrás do alvo, os projéteis passam por cima das criaturas, o jogador fica
  sempre visível por cima de tudo, e a haste começa a 6 px do centro do mergulhador. Avisos que
  não pertencem a uma criatura (faixas e anéis dos chefes) entram entre pickups e criaturas.
- **Cache em `OffscreenCanvas`:** o fundo é renderizado uma vez por mapa, numa altura igual à
  da tela. A rocha é renderizada no tamanho do mundo inteiro e só é redesenhada quando a grade
  muda (`Grid.version`: erosão, pilar dissolvido). No frame, só se copia a região da câmera. Hoje
  o redesenho é do mundo inteiro; redesenhar só os blocos tocados fica para quando a erosão
  existir (M4), se o custo aparecer.
- **Resolução:** o jogo pensa num espaço **lógico** fixo de 960 × 540. O CSS decide o tamanho do
  canvas na tela, mantendo 16:9 (letterbox), e a **imagem interna tem o tamanho real** em que o
  canvas aparece, já com o `devicePixelRatio` (`core/display.ts`, refeito por `ResizeObserver`).
  Cada frame começa com a escala lógico → real, então nenhum desenhador sabe disso, e o mouse é
  convertido direto para coordenadas lógicas. *Decisão de 2026-09-29:* a primeira versão desenhava
  em 960 × 540 e deixava o CSS esticar, que é técnica de pixel art; com arte vetorial isso só
  borrava o texto e as linhas finas.
- **Caches na escala real:** a rocha é desenhada no cache já na escala da tela, com as bordas
  dos blocos arredondadas para pixels inteiros (sem emendas em escalas fracionárias, como 125%),
  e o cache é refeito quando a escala muda. A área do cache tem teto de 16 milhões de pixels
  (limite de alguns navegadores); acima disso, a rocha fica um pouco menos nítida em vez de
  falhar. O gradiente de fundo fica em 960 × 540: é liso e não perde nada ao ampliar.
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
| `cleared` | 1200 ms | "FASE CONCLUÍDA" aparece no fim; a saída (próximo mapa, seleção) vem no M6 |

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
| `F8` | anel de projéteis em volta do jogador (testa o pool, o estouro pela lança e a erosão) |
| `B` | o mesmo que `F4` (o protótipo usava `B` para chamar o Caranguejo) |
| `R` | reiniciar com a mesma semente (fora da depuração, só depois de morrer, até existir o menu do M6) |

A semente atual aparece no overlay, para que um bug de mapa possa ser reproduzido.

### 10.2 Testes (Vitest)

Só lógica pura de `sim/` e `world/`, sem DOM:

- **Nado:** 0 → 250 px/s em ~267 ms; a velocidade cai a 10% em ~700 ms depois de soltar.
- **Dash:** percorre ~82 px; invulnerável nos passos de 0 a 100 ms e vulnerável depois; cancela a
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
  nascimento está em água; os corredores do coral têm ≥ 80 px. No Leito: as fendas cabem o
  jogador e não cabem o Caranguejo.
- **Paridade do Caranguejo:** o gerador de rastros desliga as bolhas do protótipo (que também
  sorteavam) e usa um gerador congruencial com semente no `Math.random`; o teste põe o mesmo
  gerador na RNG do mundo. Assim o sorteio de ataques, o reroll e a investida dupla são
  comparados passo a passo, e não só com o sorteio fixo em 0,5.
- **Harness de simulação:** roda N segundos com entradas roteirizadas (ex.: "jogador parado
  atrás de um pilar") e mede o dano recebido, como foi feito no protótipo para o Olho.
- **Paridade com o protótipo:** `tools/prototype-trace.mjs` roda o **código original** de
  `prototipo/index.html` num Chromium headless, passo a passo, com roteiros de entrada, e grava
  os rastros em `tests/fixtures/prototype-traces.json`. `tests/sim/parity.test.ts` repete os
  mesmos roteiros na simulação nova e compara posição, velocidade e estado a cada passo (6 casas
  decimais). Ao portar um sistema com números de feel, acrescente um roteiro nos dois lados.
  Para a IA, o gerador fixa o `Math.random` do protótipo em 0,5 e o teste fixa a RNG do mundo
  no mesmo valor (`pinRng`). Os roteiros evitam encostar nas paredes: ali a colisão nova para o
  corpo na face do bloco e a do protótipo o empurra 1 px por vez (§6.2), menos de 1 px de
  diferença, coberta pelos testes de colisão.
- **Alocação:** `tests/perf/allocation.test.ts` mede o crescimento do heap num trecho sem coleta
  de lixo e garante que o passo não aloca por projétil (§5.2).

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
| Degrau do clamp ao fim do dash | **Não adotado no M1.** O M1 portou o degrau exatamente como está (os testes de paridade o cobrem). A suavização continua possível: aproximar o teto de 250 com arrasto extra nos primeiros ~80 ms depois do dash. Só entra se o teste lado a lado mostrar que o degrau incomoda, e com o motivo registrado (regra 7) |
