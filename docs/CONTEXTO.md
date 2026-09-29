# CONTEXTO — protótipo de combate subaquático

Registro completo do que existe em `prototipo/index.html` (2.116 linhas, arquivo único,
HTML + Canvas 2D + JavaScript puro, sem dependências, sem build).

Este documento é o ponto de partida do jogo **Abyss Arena** e é o **registro histórico do
protótipo**: descreve o que o protótipo é, não o que o jogo novo será. Quando este arquivo e
o [`GDD.md`](GDD.md) divergirem, **o GDD manda**. Tudo aqui foi extraído do código real;
onde há uma conta ou uma medição, a derivação está explícita.

Convenções do código: tempos em **ms**, velocidades em **px/s**, acelerações em **px/s²**,
ângulos em **radianos**. Identificadores em inglês, comentários em português.

---

## 1. Visão geral

Um mergulhador com uma lança luta contra cardumes e chefes numa caverna submersa. Não há
progressão, itens, save, menu nem áudio: o protótipo existe só para responder **como o
combate se sente**.

O que ele entrega hoje:

- **Nado com peso.** A água tem inércia e arrasto. Você não para onde solta a tecla; derrapa.
- **Uma arma só, com ritmo.** A estocada tem antecipação, golpe e recuperação. Você se
  compromete com cada ataque e paga por errar.
- **Impacto legível.** Acertar congela a imagem por 60 ms, empurra o inimigo, joga você para
  trás e solta bolhas. Errar não faz nada disso — o contraste é a recompensa.
- **Três chefes de gramática oposta.** Um que fecha distância e bate, um que controla
  espaço de longe, um bullet hell.
- **Tudo telegrafado.** Nenhum ataque de nenhuma criatura acerta sem aviso visual antes.

A sensação alvo é a de um action game de arena em 2D com física de água: mais próximo de um
*boss rush* do que de um jogo de exploração. É isso que o protótipo realmente é hoje.

**Controles.** `WASD`/setas nadar · mouse mirar · clique esquerdo ou `J`/`K`/`Enter` estocar
(segurar carrega) · `Espaço`/`Shift`/`L` dash · `B` caranguejo · `N` água-viva · `M` olho ·
`R` reiniciar.

---

## 2. Arte

Tudo é desenhado por código com primitivas de Canvas 2D (`arc`, `ellipse`, `fillRect`,
`quadraticCurveTo`, gradientes). Não há nenhuma imagem, nenhum sprite, nenhum arquivo externo.
O canvas é fixo em **960 × 540** com `image-rendering: pixelated` — que hoje não faz efeito
nenhum, porque nada é desenhado em resolução menor e escalado. É um resquício.

### 2.1 Fundo

Gradiente vertical de topo a base, redesenhado todo frame em espaço de tela:

| Parada | Cor |
|---|---|
| 0.00 | `#123a63` |
| 0.45 | `#0a2444` |
| 1.00 | `#04101f` |

Por cima, **5 colunas de luz** em `#9fd8ff` com `globalAlpha 0.05`: trapézios que vão de
52 px de largura no topo a 140 px na base. Elas deslizam com `cam.x * 0.25` em módulo
`W/5`, o que dá um parallax barato. O fundo nunca reage à profundidade nem ao chefe ativo.

Fora do canvas, a página é `#05080f` e o canvas tem fundo `#061021`.

### 2.2 Arena

A arena é uma **grade de blocos de 20 px** (`Uint8Array`, 1 = rocha). Cada bloco sólido é
desenhado como:

- corpo `#22333c`, ou `#3c5a52` se o bloco acima estiver vazio (topo exposto);
- sombra `rgba(0,0,0,0.18)` em duas faixas de 3 px, na direita e embaixo;
- se topo exposto, uma faixa de 3 px em `#587f6f` no alto — a "luz" que dá relevo.

São três instruções de preenchimento por bloco. É o suficiente para ler volume sem textura.
Só os blocos dentro da câmera são percorridos (`drawRocks` recorta pela viewport).

Existem **dois geradores de arena**:

**Caverna (`buildArena("cave")`)** — 960 × 540, 48 × 27 blocos. É a arena padrão.
- Borda de 2 blocos em todos os lados.
- Chão irregular por soma de senos: `h = 2,6 + 1,9·sen(0,24x + p1) + 1,2·sen(0,61x + p2) + ruído(±0,6)`,
  mínimo 2 blocos. `p1` e `p2` são fases aleatórias por partida.
- Teto pelo mesmo método, mais raso: `1,6 + 1,1·sen(0,19x − p2) + ruído(±0,4)`.
- 5 a 7 blobs elípticos de rocha (`rx` 1,6–4,2, `ry` 1,4–3,4 blocos), pulando os que caem a
  menos de 6 blocos do centro.
- 6 estalactites/estalagmites: colunas de 2 a 5 blocos, lado sorteado.

**Arena aberta (`buildOpenArena()`)** — 1860 × 1100, 93 × 55 blocos. Exclusiva do Olho.
- Só a borda de 2 blocos. Sem chão, sem teto irregular: água limpa.
- 26 pilares elípticos (`rx`/`ry` 1,3–2,9 blocos) distribuídos num anel entre 22% e 92% do
  raio da arena, nunca a menos de 7 blocos do centro (onde o chefe nasce).
- **Cada pilar guarda a lista dos seus blocos** em `pillars[]`. É isso que permite dissolvê-los
  por fase depois.

### 2.3 Personagens

Todos desenhados em espaço local, com `translate` + `rotate` para o ângulo da criatura.

**Mergulhador** (raio de colisão 9): elipse 13 × 9 em `#2f7fd0`, que vira `#bfeaff` durante o
dash. Tanque nas costas: retângulo 6 × 10 em `#123a5c`. Visor: círculo r 4,5 em `#ffe9a8`,
deslocado 6 px à frente. Duas nadadeiras triangulares em `#1a4a70` atrás. A lança é uma linha
de 3 px em `#cdd8e2` (4 px e `#fff3c4` durante a estocada) com uma ponta `#fefefe` de r 3,5.

**Peixe** (r 11): elipse (r+4) × (r·0,68) em `#e0603f`, cauda triangular `#a83c28`, olho
`#0b1420`. Rotaciona para a direção da velocidade com interpolação angular de 0,25 por passo.

**Circulador** (r 13): círculo `#8a5ad0` com 6 tentáculos de 3 px em `#5c3a94` girando, e um
núcleo `#ffe066` de r 3,5. Gira sozinho a 4 rad/s.

**Caranguejo** (r visual 38): carapaça elíptica 38 × 29,6 em `#b4643c` (`#d8492f` na fase 2),
sombra interna `rgba(0,0,0,0.18)`. 6 pernas de 6 px em `#7d4527` que oscilam com
`sen(clawT·5 + i)`. Duas pinças `#c9764a` (`#ff6a48` na fase 2) de 18 × 11, com dois dedos
`#0e1a26` que **abrem para 0,9 rad quando o golpe de pinça está sendo carregado** — a
animação é parte do aviso. Olhos `#ffe066`.

**Água-viva** (r visual 42): sino desenhado como duas elipses (cúpula 42 × 35,7 e borda
inferior 42 × 14,7) preenchidas por um gradiente radial —
fase 1 `#e6fffa` → `#5fd9c4` → `rgba(40,120,150,0.55)`, fase 2 `#ffd9f2` → `#ff6fc0` →
`rgba(180,40,120,0.55)`. O sino **pulsa** por `scale(breathe, 1/breathe)` com
`breathe = 1 + sen(pulse)·0,07`, o que preserva a área e dá respiração. 9 tentáculos finos de
3 px e 4 braços orais de 6 px ondulam com senos defasados. Um núcleo central de r 10,9 brilha
e **incha 1,1–1,6× quando o estado termina em `Tel`** (ou seja, durante qualquer aviso).

**Olho** (r visual 46): esclera com gradiente radial `#f2e8ff` → `#c8b4dd` →
`rgba(70,40,90,0.85)`, 7 veias em `rgba(150,60,90,0.5)` desenhadas com curvas quadráticas.
Íris de r 19,3 deslocada 13,8 px na direção do jogador — **o olho literalmente olha para
você**. Pupila `#0a0410`, que contrai de 0,55 para 0,38 do raio da íris durante os avisos.
Coroa de pequenos olhos de r 5 orbitando a 1,5× o raio; a quantidade é `6 + 2·fase`, então
a criatura ganha olhos conforme enlouquece. A cor da íris muda por fase: `#6ad8ff` →
`#ffa04a` → `#ff5a9e`.

### 2.4 Projéteis

Todo projétil é desenhado em quatro camadas: halo com `alpha 0.28` e raio 2,1×, corpo
sólido, reflexo branco de 0,35× deslocado para cima e à esquerda, e 4 farpas de 4 px girando
a 8 rad/s. A rotação existe só para o olho ler que aquilo é uma coisa viva, não um ponto.

A cor identifica o ataque, e essa é a única linguagem que o jogador tem para distinguir
padrões sobrepostos:

| Cor | Origem |
|---|---|
| `#8affe0` | anel de esporos (água-viva) |
| `#ffd6f5` | ferrões da sucção (água-viva) |
| `#ffe07a` | leque (olho) |
| `#9ad8ff` | espiral (olho) |
| `#ff9ad8` | cerco (olho) |
| `#c8a0ff` | perseguidores (olho) |
| `#a8ffd8` | chuva (olho) |

### 2.5 Partículas

Só existe um tipo: **bolha**. `bubbles(x, y, n, cor, espalhamento, velocidade)` cria `n`
círculos vazados de raio 1,5–4,5 px, com vida de 720 ms × 0,6–1,3, direção aleatória e um
viés inicial de −40 px/s em Y. Elas **sobem** (−120 px/s² em Y) e sofrem arrasto próprio
(2,2 em X, 1,4 em Y). São desenhadas como contorno de 1,5 px com alpha proporcional à vida
restante, e o raio encolhe junto.

Uma única função cobre todos os eventos, mudando só cor e quantidade:

| Evento | Qtd | Cor |
|---|---|---|
| acerto da lança | 10 | `#dff3ff` |
| morte comum | 18 | `#9fe0ff` |
| morte de chefe | 18 | `#ffd2b0` |
| jogador ferido | 14 | `#ff9aa6` |
| dash | 10 | `#cfeaff` |
| início da estocada | 6 | `#e6f6ff` |
| peixe iniciando investida | 8 | `#ffd48a` |
| rocha erodida / pilar dissolvido | 3 / 1 | `#7f9e94` |
| projétil sumindo na rocha | 4 | a cor do projétil |

### 2.6 Efeitos de impacto

Cinco efeitos compõem a resposta a um golpe, e eles disparam **juntos**:

1. **Hit-stop de 60 ms.** No laço principal, quando `game.hitStopMs > 0` o `step()` inteiro é
   pulado — a simulação congela e o desenho continua. Vira um quadro parado de ~4 frames.
   Só acerto de lança em criatura dispara; estourar projétil não dispara, de propósito.
2. **Empurrão do inimigo.** `damageEnemy` soma `430 · (1 / max(1, raio/12))` à velocidade na
   direção da estocada. O divisor faz criaturas maiores serem empurradas menos: o peixe (r 11)
   recebe o empurrão cheio, o caranguejo (r 38) recebe 32% dele.
3. **Recuo do jogador.** A velocidade do jogador é **substituída** por 230 px/s na direção
   oposta — só quando acerta. Errar não recua.
4. **Tremor de tela.** `shake(ms, amplitude)` guarda o máximo pedido e aplica um deslocamento
   aleatório de ±amplitude no `translate` do mundo. O HUD não treme, porque é desenhado
   depois do `restore`.
5. **Bolhas** no ponto de impacto, deslocadas para trás do inimigo.

Quando o **jogador** é ferido: 667 ms de invulnerabilidade, empurrão de 330 px/s para longe
da fonte, 14 bolhas rosadas, tremor de 180 ms, e o corpo **pisca** — `globalAlpha` alterna
entre 0,35 e 1 a cada 80 ms, o que dá ~8 piscadas na janela de invulnerabilidade.

### 2.7 Avisos de ataque

Toda criatura anuncia. Os formatos usados:

- **Halo pulsante** — peixe (`#ffcf6a`, com uma linha de mira de 70 px na direção travada) e
  circulador (`#c58bff`). A pulsação é `|sen(k·14)|` sobre o progresso do aviso.
- **Retângulo de trajetória** — investida do caranguejo: 520 × 52 px em `#ff7a4a`, opacidade
  subindo de 0,18 a 0,48.
- **Círculo que cresce** — pinça do caranguejo: de 40% a 100% do raio final, virando
  `#ffd7a0` sólido no frame do golpe.
- **Anéis convergindo** — anel da água-viva (para dentro) e chamado do caranguejo (para fora).
- **Linha de mira + seta de rotação** — raio da água-viva: a linha mostra onde, o arco com
  ponta de seta mostra **para que lado vai girar**, e ela continua visível enquanto o raio
  estica.
- **Setor circular** — leque do olho: uma fatia de 640 px de raio e 0,85 rad de abertura.
- **Espirais desenhadas** — espiral do olho: 3 braços traçados com 40 segmentos cada.
- **Anel com tracinhos para dentro** — cerco do olho, centrado no jogador, raio 430 px.
- **Faixa vertical** — chuva do olho, marcando a coluna da arena que vai ser atingida.
- **Núcleo/pupila** — água-viva incha o núcleo, olho contrai a pupila. Funciona como aviso
  genérico "algo vem aí", independente do ataque.

---

## 3. Movimento e fluidez

### 3.1 O modelo de nado

Três linhas, aplicadas por passo fixo:

```
se há direção:  v += direção_normalizada · 1500 · dt
sempre:         v *= 1 / (1 + arrasto · dt)
se nado livre:  |v| limitado a 250
```

O arrasto é **implícito** (`1/(1+k·dt)`), não `v *= 0,94`. Isso importa: o decaimento fica
independente do passo e nunca fica negativo, mesmo com `dt` grande.

Por que a sensação funciona, em números:

- **Velocidade terminal teórica** = accel/drag = 1500/3,4 = **441 px/s**, bem acima do teto de
  250. Ou seja, o teto é o que manda, não o arrasto. Consequência: a aceleração é agressiva e
  você chega ao topo rápido — **~267 ms** para ir de 0 a 250 px/s.
- **Deslizada ao soltar**: a velocidade cai a 10% em **700 ms**. Você percorre
  mais ou menos 70 px depois de soltar a tecla. É esse atraso que faz parecer água e não gelo:
  longo o suficiente para sentir massa, curto o suficiente para não frustrar.
- **Aceleração alta + teto baixo + deslizada longa** é a combinação. Responde na hora quando
  você quer ir, e continua andando quando você quer parar. Reduzir `accel` mataria a resposta;
  reduzir `drag` transformaria em patinação.

O arrasto cai para **35%** (1,19) durante dash e estocada, e o teto de velocidade é
**desligado** nesses dois estados. É o que faz o impulso ter peso em vez de ser absorvido no
mesmo frame.

### 3.2 Dash

640 px/s por 140 ms, recarga de 1200 ms, **sem invulnerabilidade**. A distância percorrida é
medida na simulação em **89 px** — pouco mais de quatro corpos do jogador. *(Correção de
2026-09-29: rodando o código do protótipo passo a passo, o dash percorre **82,4 px** nos 140 ms.
Os 89 px são o nominal 640 × 0,14, sem o arrasto.)* Curto de
propósito: é reposicionamento, não fuga.

Três propriedades importantes:

- Vai na direção da **mira**, não do movimento. Com mouse, na direção do cursor; no modo
  teclado, na direção do nado.
- **Cancela a recuperação da estocada.** Se `spear.state === "recovery"`, ela volta para
  `idle` na hora. É a única forma de encurtar o comprometimento de um ataque, e é o que
  transforma "atacar" numa decisão com saída.
- É lido com tecla **mantida**, não com o flanco de pressão. Segurar `Espaço` redispara assim
  que a recarga zera.

### 3.3 Colisão

Colisão AABB contra a grade, resolvida **eixo por eixo** (X, depois Y), o que dá deslizamento
em parede de graça. O raio de colisão é `collR` quando existe, senão `radius · 0,85`.

`hitsRock` amostra a caixa do corpo numa grade de passo ≤ 0,75 bloco (`n = max(2, ceil(2r/15))`).
Amostrar só os cantos deixava um bloco de 20 px passar entre as amostras de um corpo grande.

Três redes de segurança, todas escritas depois de bugs reais:

- **Guarda de iterações** no laço de expulsão. Sem ela, um corpo totalmente dentro da rocha
  empurrava para fora da grade (onde tudo é sólido) e o `while` **nunca terminava** —
  congelava a aba do navegador, não só a criatura.
- **`unstick`**: busca em espiral (anéis de 10 px até 200 px, 16 direções cada) o ponto livre
  mais próximo e recoloca o corpo lá, com a velocidade reduzida a 20%. Se falhar, abre espaço
  na rocha com `carveRoom`.
- **Limite na área jogável**, não no canvas: `clamp(x, BORDER + r, world.w − BORDER − r)`.
  Limitar ao canvas enfiava corpos grandes dentro da própria parede de borda.

### 3.4 Câmera

Só existe porque a arena do Olho (1860 × 1100) é maior que a janela (960 × 540). Nas outras
arenas o mundo tem o tamanho da tela e a câmera fica fixa em (0,0) pelo `clamp`.

O alvo é `jogador + mira·60 − centro_da_tela`, limitado às bordas do mundo. O **look-ahead de
60 px na direção da mira** faz você ver para onde está olhando, não onde está. A suavização é
`cam += (alvo − cam) · 0,12` por passo fixo — como roda em passo fixo, não depende da taxa de
quadros.

O mouse guarda coordenadas de **tela** (`viewX/viewY`) e é reconvertido para mundo todo passo
(`mouse.x = viewX + cam.x`). Sem isso, a mira escorregaria sozinha quando a câmera se movesse
com o mouse parado.

---

## 4. Combate

### 4.1 As fases da estocada

Máquina de estados com quatro estados: `idle → anticipation → thrust → recovery → idle`.

| Fase | Duração | O que acontece |
|---|---|---|
| `anticipation` | 70 ms (ou até 600 ms carregando) | lança recua para −22% do alcance; direção ainda acompanha a mira |
| `thrust` | 120 ms | lança avança até o alcance total; **só aqui há hitbox**; impulso para a frente |
| `recovery` | 180 ms | lança volta de 55% a 0; sem hitbox; cancelável por dash |

Ciclo completo sem carga: **370 ms**. Com carga cheia: **900 ms**.

A posição da ponta é `jogador + direção · alcance · ease`, com `ease = 1 − (1−k)²` — saída
rápida, chegada suave. Na antecipação `k = −0,22` (recolhe), em repouso `k = 0,12`.

### 4.2 Área de acerto

A hitbox **não é o segmento da lança**. São **dois círculos** de raio `inimigo.raio + 10`:
um na ponta, outro a 35% do alcance atrás dela. Dois pontos em vez de um porque um inimigo
pequeno passava entre frames da estocada.

Um `Set` de ids (`hitIds`) garante **um acerto por inimigo por estocada**, limpo no início de
cada `thrust`. Sem ele, os 7 frames da estocada aplicariam dano 7 vezes.

Alvos: todos os inimigos **mais o chefe**, via `enemies.concat([boss])`.

### 4.3 Estocada carregada

Segurar o botão (mouse ou tecla) acumula até **600 ms**. O acúmulo começa no momento do
clique e **corre junto com a antecipação**, então a carga cheia sai 600 ms depois do clique,
não 670. Soltar antes dispara imediatamente, desde que os 70 ms já tenham passado.

Interpolação linear por `k = carga/600`:

| | sem carga | carga cheia |
|---|---|---|
| alcance | 52 px | 92 px |
| dano | 16 | 36 |
| impulso | 320 px/s | 600 px/s |

**Uma consequência que não foi planejada:** o DPS sustentado *piora* com carga —
16/0,37 s = **43,2/s** contra 36/0,9 s = **40,0/s**. Carregar não é dano por segundo, é
alcance (+77%), burst e mobilidade. Isso faz do golpe carregado uma ferramenta de abertura e
de punição, não a forma padrão de atacar. Funcionou bem por acidente; se o jogo crescer, essa
relação deveria ser uma decisão consciente.

Também emerge daí: um golpe carregado (36) **mata um peixe (34) de uma vez**, e leva um
circulador (46) a 10 de vida.

### 4.4 Regras de dano e invulnerabilidade

- Jogador: **100 de vida**, sem regeneração. Morrer mostra "VOCÊ AFUNDOU" e exige `R`.
- **667 ms de invulnerabilidade** após qualquer dano recebido, de qualquer fonte. Em 60 Hz são
  40 frames. É essa janela única e global que impede que um enxame ou uma parede de projéteis
  mate instantaneamente.
- `hurtPlayer` retorna imediatamente se já invulnerável ou morto, então **toda** fonte de dano
  passa pelo mesmo funil.
- Inimigos **não** têm invulnerabilidade — são limitados pelo `hitIds` por estocada.
- Inimigos não colidem entre si e **projéteis não ferem inimigos**. Só o jogador é alvo.
- Contato com criatura fere sempre, mas com dano reduzido à metade fora do ataque
  (`ceil(dano/2)`). Encostar num peixe parado dói 5; ser investido dói 9.

---

## 5. Inimigos

Só dois tipos, ambos com máquina de estados em `switch`/`if` dentro de `updateEnemies`, e
ambos usando o mesmo integrador de movimento (aceleração → limite de velocidade por estado →
arrasto → colisão).

### 5.1 Peixe — perseguidor com investida

| Atributo | Valor |
|---|---|
| Vida / raio | 34 / 11 px |
| Velocidade base / investida | 118 / 430 px/s |
| Aceleração / arrasto | 900 / 3,0 |
| Visão | 300 px |
| Dano de contato | 9 (investindo) / 5 (encostando) |

**Estados:**

- `chase` — se o jogador está a menos de 300 px, acelera na direção dele. Soma um termo
  perpendicular `sen(wob)·600·dt` (com `wob` crescendo 6 rad/s) que faz o peixe **serpentear**
  em vez de vir em linha reta. É o detalhe que faz ele parecer um peixe.
  Transição: distância < 200 px **e** cronômetro zerado → `telegraph`.
- `telegraph` — **400 ms**. Freia (arrasto extra de 4/s), e **trava a direção** apontando para
  o jogador a cada frame até o último. Brilha em `#ffb347` com halo pulsante e uma linha de
  mira de 70 px.
- `charge` — **480 ms** a 430 px/s em linha reta. Termina antes se bater na rocha.
- `recover` — **520 ms** freando, depois volta a `chase` com um cronômetro aleatório de
  300–900 ms antes de poder investir de novo.

O alvo é sempre o jogador; não há percepção, agrupamento nem memória.

### 5.2 Circulador — orbitador com estocada curta

| Atributo | Valor |
|---|---|
| Vida / raio | 46 / 13 px |
| Velocidade base / estocada | 132 / 380 px/s |
| Aceleração / arrasto | 1000 / 3,2 |
| Raio de órbita | 92 px, a 1,9 rad/s |
| Dano de contato | 11 (estocando) / 6 (encostando) |

**Estados:**

- `orbit` — persegue um ponto que gira em torno do jogador a 92 px e 1,9 rad/s, com sentido
  sorteado no nascimento. Não persegue o jogador: persegue a **posição orbital**, o que
  produz o movimento circular sem nenhuma matemática de órbita.
  Transição: cronômetro zerado e distância < 138 px → `windup`.
- `windup` — **300 ms** freando forte, travando a direção, com halo roxo pulsante.
- `strike` — **220 ms** a 380 px/s.
- `rest` — **700 ms**, e ao voltar para `orbit` o ângulo orbital é **recalculado a partir da
  posição atual**, para não teleportar visualmente.

### 5.3 Como aparecem no mundo

`updateSpawner`, rodando todo passo:

- Primeiro nascimento em **1200 ms**; depois a cada **2600 ms**, e esse intervalo **encurta 90 ms
  a cada nascimento** até o piso de **1100 ms**. É a única escalada de dificuldade do protótipo.
- Máximo de **9 vivos**. Sorteio de **60% peixe / 40% circulador**.
- Posição: ponto aleatório livre a pelo menos **220 px** do jogador (400 tentativas; se nenhuma
  servir, ninguém nasce naquele tique).
- **Pausa total enquanto um chefe estiver vivo** (`spawn.pauseDuringBoss`), e o cronômetro é
  mantido cheio durante a luta — senão, no instante em que o chefe morresse, o tempo acumulado
  despejaria uma leva inteira de uma vez.
- A única exceção é o chamado do caranguejo, que invoca peixes diretamente e **ignora o limite
  de 9**.

---

## 6. Chefes

Três, todos com a mesma estrutura: um `switch` sobre `state`, estados de aviso sufixados com
`Tel`, um estado `think` que sorteia o próximo ataque, e um *pool* de ataques que muda por
fase. O sorteio **rerrola se repetir o último** (60% de chance no caranguejo e na água-viva,
65% no olho) — sem isso, sequências repetidas eram comuns e a luta ficava monótona.

Todos compartilham: barra de vida no topo, seta na borda da tela quando saem de vista,
rede de antitravamento (`unstick` após 1500 ms parado) e raio de colisão menor que o visual.

### 6.1 Caranguejo Abissal (`B`) — pressão corpo a corpo

420 de vida, raio visual 38 / colisão 23, 90 px/s. Fase 2 abaixo de **50%**.

| Ataque | Aviso | Execução | Dano |
|---|---|---|---|
| Investida | 620 ms (420 na f2) — faixa de 520 px no chão | 620 ms a 520 px/s (640 na f2); para ao bater | 20 |
| Pinça | 520 ms (360 na f2) — círculo crescendo | 180 ms, raio 118 px (150 na f2) | 24 |
| Chamado | 700 ms — anéis expandindo | invoca 3 peixes ao redor | — |

Contato fora da investida: 12.

**Fase 2:** pausa entre ataques cai de 900 para 520 ms; o *pool* passa a ter investida e pinça
em dobro; e uma investida tem **55% de chance de emendar outra** com aviso reduzido a 294 ms.

**Detalhe de comportamento:** enquanto "pensa", ele se aproxima a 45% da aceleração normal —
nunca está realmente parado. E se bater na rocha perseguindo, aplica um empurrão tangencial
por 700 ms para deslizar pela parede em vez de moê-la.

**Arena:** a caverna padrão. O terreno irregular é parte da luta — a investida bate nas
formações e ele fica exposto.

### 6.2 Água-viva Colossal (`N`) — controle de espaço

380 de vida, raio visual 42 / colisão 25. Flutua a **215 px** do jogador e 55 px acima dele.
Fase 2 abaixo de 50%. Não tem nenhum ataque corpo a corpo.

| Ataque | Aviso | Execução | Dano |
|---|---|---|---|
| Anel de esporos | 620 ms (440 na f2) — anéis para dentro | 14 projéteis em todas as direções (20 e 3 ondas na f2, cada onda girada 0,22 rad) | 11 |
| Raio giratório | 700 ms (520 na f2) — linha de mira + seta do giro | ver abaixo | 16 |
| Sucção | 520 ms — arcos girando para dentro | 1100 ms puxando a 640 px/s² num raio de 330 px, cuspindo um ferrão a cada 150 ms | 9 |

**O raio merece detalhe, porque duas versões dele foram injogáveis e o desenho atual é a
correção:**

1. A ponta **sai da água-viva e viaja para fora a 620 px/s**. O dano só vale até onde a ponta
   chegou. Na distância de flutuação isso dá ~280 ms de reação, medidos.
2. **Não gira enquanto estica.** Primeiro lança, depois varre — duas leituras separadas.
3. **Vão interno de 48 px**: colar nela é seguro.
4. **A rocha faz sombra** — o raio é interrompido no primeiro bloco, com fagulha no ponto de
   impacto. Nas arenas geradas, 56 de 64 direções são cortadas antes de 300 px.
5. **Um acerto por varredura**, no máximo.
6. **Piso de 130 ms** antes de poder ferir, para o caso de perto.
7. A velocidade angular é 0,85 rad/s (1,0 na fase 2). **Isto é uma restrição dura:** a
   velocidade tangencial é `ω · distância`, e a 215 px isso dá 183 e 215 px/s, contra 250 px/s
   de nado. Acima de ~1,16 rad/s o raio fica matematicamente impossível de superar nadando.
   O CONFIG carrega essa conta como comentário.

**Fase 2:** anel e raio ganham peso no sorteio (são os que cobrem mais água), pausa cai de
800 para 440 ms, cor vira rosa.

**Arena:** a caverna padrão — e a rocha importa muito, porque é a sombra do raio.

### 6.3 Olho do Abismo (`M`) — bullet hell

560 de vida, raio visual 46 / colisão 30. **Troca a arena** ao nascer: reconstrói o mundo como
a arena aberta de 1860 × 1100, limpa inimigos, projéteis e partículas, e reposiciona o jogador
a pelo menos 380 px do centro com vida cheia. Fica vagando devagar num raio de 260 px do centro
e recua se o jogador chegar a menos de 300 px.

**Três fases por vida: 100–66%, 66–33%, abaixo de 33%.**

| Ataque | Aviso | Fase 1 | Fase 2 | Fase 3 |
|---|---|---|---|---|
| Leque | 520 ms (380 na f3) — setor de 0,85 rad | 5 projéteis × 2 salvas | 7 × 2 | 9 × 3 |
| Espiral | 600 ms — braços desenhados | 1 braço, 2000 ms | 2 braços, 2400 ms | 3 braços, 2600 ms |
| Cerco | 700 ms — anel de 430 px no jogador | 18 projéteis | 24 | 30 |
| Perseguidores | 620 ms — halo pulsante | — | 5 | 8 |
| Chuva | 700 ms — faixa vertical | — | — | 3 a cada 90 ms por 2200 ms |

A espiral emite a cada 70 ms girando a 2,3 rad/s. O cerco nasce num anel **centrado no
jogador** (a posição acompanha durante o aviso e trava no fim) e todos apontam para dentro.
Os perseguidores curvam a 1,5 rad/s e **atravessam a rocha**.

**As pedras vão sumindo:** os 26 pilares ficam inteiros na fase 1, caem para **45%** na fase 2
e para **zero** na fase 3. Junto disso, todo impacto de projétil tem **30% de chance de
destruir o bloco atingido** (nunca a parede de borda). Medido: 78 blocos erodidos em 60 s.

Isso é deliberado e é a espinha dorsal do desenho: a cobertura existe para ser aprendida na
fase 1 e retirada depois. Medição com um jogador travado atrás de um pilar por 60 s:
**336 de dano na fase 1, 872 na fase 2**, e na fase 3 não há pilar onde se esconder.

**Ritmo:** pausa entre ataques de 700 → 520 → 380 ms.

### 6.4 Ritmo geral das lutas

Com 16 de dano por estocada sem carga e um ciclo de 370 ms, o tempo teórico mínimo de
combate é de ~9,7 s (caranguejo), ~8,8 s (água-viva) e ~13 s (olho) de dano ininterrupto.
Na prática as lutas duram bem mais, porque os três chefes passam boa parte do tempo longe ou
em estados em que aproximar custa vida. **Nenhum chefe tem fase de vulnerabilidade
explícita** — nada de "ele se cansa, bata agora". O jogador escolhe suas janelas.

---

## 7. Arquitetura

### 7.1 Organização do arquivo

Um `<script>` único, sem módulos, sem classes, sem `import`. Tudo em escopo global, em ordem
de dependência:

| Linhas | Bloco |
|---|---|
| 1–18 | Casca HTML, CSS, canvas 960×540 |
| 22–209 | `CONFIG` — todos os números de ajuste |
| 211–230 | Utilidades (`clamp`, `rand`, `randi`, `len`, `angLerp`) e constantes de mundo |
| 232–281 | Entrada (teclado, mouse, direção de nado) |
| 283–476 | Arena: grade, dois geradores, colisão, `unstick`, `carveRoom`, `freeSpot` |
| 478–521 | Estado global, `resetGame`, câmera |
| 523–536 | Partículas |
| 538–640 | Nascimento de inimigos e chefes, `damageEnemy` |
| 642–729 | Projéteis, raycast do raio, `hurtPlayer` |
| 731–764 | `step()` e partículas |
| 766–907 | Jogador: nado, dash, lança, hitbox |
| 909–981 | Inimigos |
| 983–1466 | Chefes (`updateEye`, `updateJelly`, `updateCrab`) e spawner |
| 1468–2066 | Desenho (fundo, rochas, criaturas, projéteis, HUD) |
| 2068–2113 | `render()` e laço principal |

### 7.2 Laço de jogo e passo fixo

```
frame(now):
  elapsed = min(now − last, 100)          // teto: evita "correr" depois de uma travada
  acc += elapsed
  enquanto acc ≥ 16,667:
     acc -= 16,667
     se hitStopMs > 0: hitStopMs -= 16,667   // simulação congelada
     senão: step()
  render()
```

**Simulação a 60 Hz fixos, desenho na taxa do monitor.** Não há interpolação entre passos —
num monitor de 144 Hz a mesma posição é desenhada mais de uma vez. Isso não incomoda nesta
escala, mas é a primeira coisa a mudar se o jogo crescer.

O hit-stop mora **aqui**, e não num multiplicador de `dt`, o que garante que ele congela tudo
igualmente: física, cronômetros, partículas, câmera.

### 7.3 Estruturas de dados

Seis variáveis globais mutáveis guardam o jogo inteiro:

- `player` — objeto único, com um sub-objeto `spear` para a máquina de estados da lança.
- `enemies` — array de objetos planos. Filtrado (`filter`) todo passo para remover mortos.
- `projectiles` — array de objetos planos. Idem.
- `particles` — array de objetos planos. Idem.
- `boss` — objeto único ou `null`. O campo `kind` (`"crab"`, `"jelly"`, `"eye"`) decide o
  despacho em `updateBoss` e `drawBoss`.
- `game` — contadores da partida (`kills`, `hitStopMs`, cronômetro de spawn, tremor, `dead`).

Fora deles: `grid` (`Uint8Array` de 1 byte por bloco), `pillars` (array de arrays de índices),
`world`, `COLS`/`ROWS` e `cam`.

Não há sistema de entidades, nem componentes, nem herança. Cada tipo de criatura tem seus
próprios campos, e campos com o mesmo nome (`state`, `t`, `flash`, `ang`) significam coisas
diferentes em cada um.

### 7.4 Gambiarras conhecidas

Registradas honestamente, porque cada uma é um ponto de manutenção:

1. **`b.t += DTMS` no raio da água-viva.** O cronômetro é decrementado no topo da função; a
   fase de esticar devolve o passo para não consumir a varredura. Funciona, mas é um efeito
   colateral escondido.
2. **`b.phase2` no Olho.** É setado (`phase >= 2`) só para reaproveitar código da barra, mas
   o Olho usa `phase` (1–3) de verdade. O campo fica morto nele.
3. **A barra de vida desenha sempre uma marca em 50%**, inclusive no Olho, cujas fases são
   66% e 33%. É um traço sem significado na barra dele.
4. **`drawBossOffscreenArrow` projeta `cos(a)·W` e depois faz `clamp`**, o que não é a
   interseção correta com o retângulo da tela. A seta fica levemente fora do eixo nos cantos.
   Também escreve "m" (metros) num valor que é pixels.
5. **A erosão pode abrir buracos no chão da caverna.** Só a borda está protegida. Na caverna
   isso quase nunca acontece (poucos projéteis), mas é uma porta aberta.
6. **`pillars` e `pillarsTotal` vivem fora de `game`** e só são limpos via `buildArena`.
7. **`resetGame()` é chamado de dentro do `keydown`**, ou seja, pode rodar no meio de um frame,
   entre passos. Nunca deu problema nesta escala.
8. **`enemies.concat([boss])` aloca um array por frame de estocada**, e os três `filter` por
   passo alocam arrays novos — com 900 projéteis isso é lixo constante para o coletor.
9. **Código morto:** `fish.knockbackTakenMult` (declarado, nunca lido), `spear.didHit`
   (escrito, nunca lido), `mouse.released` (mantido, nunca lido), `game.timeMs` (acumulado,
   nunca lido), `player.dashDirX/Y` (poderiam ser locais).
10. **`image-rendering: pixelated`** no canvas não faz nada, porque nada é renderizado em
    resolução menor.

---

## 8. Tabela de valores

Todos os parâmetros do `CONFIG`, com unidade e efeito.

### Sistema

| Parâmetro | Valor | Unidade | Efeito |
|---|---|---|---|
| `view.w` / `view.h` | 960 / 540 | px | tamanho do canvas e da janela de visão |
| `tile` | 20 | px | lado do bloco da grade de colisão |
| `sim.hz` | 60 | Hz | frequência do passo fixo (dt = 16,667 ms) |
| `maxFrameMs` | 100 | ms | teto de tempo acumulado por frame |
| `camera.lerp` | 0,12 | — | suavização da câmera por passo |
| `camera.lookAhead` | 60 | px | quanto a câmera antecipa na direção da mira |
| `particles.bubbleLifeMs` | 720 | ms | vida base da bolha (×0,6–1,3) |
| `particles.deathCount` | 18 | un | bolhas ao matar |
| `particles.hitCount` | 10 | un | bolhas por acerto |

### Entrada

| Parâmetro | Valor | Efeito |
|---|---|---|
| `input.attackKeys` | `J`, `K`, `Enter`, `NumpadEnter` | teclas que fazem a mesma estocada do clique |
| `input.dashKeys` | `Espaço`, `Shift` esq./dir., `L` | teclas de dash |
| `input.keyboardAimFollowsMovement` | `true` | no modo teclado a mira segue o nado |

### Jogador

| Parâmetro | Valor | Unidade | Efeito |
|---|---|---|---|
| `player.radius` | 9 | px | raio do corpo (colisão usa 0,85× = 7,65) |
| `player.accel` | 1500 | px/s² | aceleração do nado |
| `player.maxSpeed` | 250 | px/s | teto de velocidade no nado livre |
| `player.drag` | 3,4 | 1/s | arrasto da água (35% disso no dash/estocada) |
| `player.hp` | 100 | — | vida |
| `player.dash.speed` | 640 | px/s | velocidade inicial do dash |
| `player.dash.durationMs` | 140 | ms | duração (≈82 px percorridos; ver §3.2) |
| `player.dash.cooldownMs` | 1200 | ms | recarga |
| `player.hurt.invulnMs` | 667 | ms | invulnerabilidade após dano |
| `player.hurt.knockback` | 330 | px/s | empurrão ao ser ferido |
| `player.hurt.blinkMs` | 80 | ms | período de piscada |

### Lança

| Parâmetro | Valor | Unidade | Efeito |
|---|---|---|---|
| `spear.anticipationMs` | 70 | ms | recolhida antes do golpe |
| `spear.thrustMs` | 120 | ms | janela com hitbox ativa |
| `spear.recoveryMs` | 180 | ms | travamento após o golpe (cancelável por dash) |
| `spear.reach` | 52 | px | alcance da ponta |
| `spear.reachChargeBonus` | 40 | px | alcance extra com carga cheia |
| `spear.chargeMaxMs` | 600 | ms | teto de carga |
| `spear.lungeSpeed` | 320 | px/s | impulso para a frente |
| `spear.lungeChargeBonus` | 280 | px/s | impulso extra com carga cheia |
| `spear.damage` | 16 | — | dano base |
| `spear.damageChargeBonus` | 20 | — | dano extra com carga cheia |
| `spear.tipRadius` | 10 | px | raio da hitbox (em dois pontos) |
| `spear.hitStopMs` | 60 | ms | congelamento da simulação ao acertar |
| `spear.enemyKnockback` | 430 | px/s | empurrão no inimigo (÷ raio/12) |
| `spear.selfRecoil` | 230 | px/s | recuo do jogador (só ao acertar) |

### Inimigos

| Parâmetro | Peixe | Circulador | Unidade |
|---|---|---|---|
| `radius` | 11 | 13 | px |
| `hp` | 34 | 46 | — |
| `speed` | 118 | 132 | px/s |
| `accel` | 900 | 1000 | px/s² |
| `drag` | 3,0 | 3,2 | 1/s |
| `contactDamage` | 9 | 11 | — (metade fora do ataque) |
| aviso | `telegraphMs` 400 | `windupMs` 300 | ms |
| ataque | `chargeMs` 480 a 430 px/s | `strikeMs` 220 a 380 px/s | ms / px/s |
| recuperação | `recoverMs` 520 | `restMs` 700 | ms |
| específico | `sightR` 300 px | `orbitR` 92 px, `orbitSpeed` 1,9 rad/s | |

### Nascimento

| Parâmetro | Valor | Unidade | Efeito |
|---|---|---|---|
| `spawn.firstDelayMs` | 1200 | ms | atraso do primeiro |
| `spawn.intervalMs` | 2600 | ms | intervalo inicial |
| `spawn.intervalMinMs` | 1100 | ms | piso do intervalo |
| `spawn.intervalDecayMs` | 90 | ms | encurtamento por nascimento |
| `spawn.maxAlive` | 9 | un | teto de inimigos vivos |
| `spawn.minDistFromPlayer` | 220 | px | distância mínima do jogador |
| `spawn.pauseDuringBoss` | `true` | — | pausa total durante chefe |

### Caranguejo

| Parâmetro | Valor | Unidade |
|---|---|---|
| `hp` / `radius` / `collRadius` | 420 / 38 / 23 | — / px / px |
| `speed` / `accel` / `drag` | 90 / 700 / 2,6 | px/s, px/s², 1/s |
| `phase2At` | 0,5 | fração de vida |
| `thinkMs` / `thinkMsP2` | 900 / 520 | ms |
| `dash.telegraphMs` / `P2` | 620 / 420 | ms |
| `dash.durationMs` | 620 | ms |
| `dash.speed` / `speedP2` | 520 / 640 | px/s |
| `dash.damage` | 20 | — |
| `pinch.telegraphMs` / `P2` | 520 / 360 | ms |
| `pinch.activeMs` | 180 | ms |
| `pinch.radius` / `radiusP2` | 118 / 150 | px |
| `pinch.damage` | 24 | — |
| `call.telegraphMs` / `count` | 700 / 3 | ms / un |
| `contactDamage` | 12 | — |
| `unstickAfterMs` | 1500 | ms |

### Água-viva

| Parâmetro | Valor | Unidade |
|---|---|---|
| `hp` / `radius` / `collRadius` | 380 / 42 / 25 | — / px / px |
| `speed` / `accel` / `drag` | 80 / 540 / 2,2 | px/s, px/s², 1/s |
| `hoverDist` / `hoverBias` | 215 / −55 | px |
| `thinkMs` / `thinkMsP2` | 800 / 440 | ms |
| `contactDamage` | 10 | — |
| `ring.telegraphMs` / `P2` | 620 / 440 | ms |
| `ring.count` / `countP2` | 14 / 20 | un |
| `ring.waves` / `wavesP2` / `waveGapMs` | 1 / 3 / 190 | un / ms |
| `ring.waveTwist` | 0,22 | rad |
| `ring.speed` / `damage` / `lifeMs` / `r` | 195 / 11 / 4200 / 6 | px/s, —, ms, px |
| `beam.telegraphMs` / `P2` | 700 / 520 | ms |
| `beam.sweepMs` / `P2` | 1100 / 1400 | ms |
| `beam.sweepSpeed` / `P2` | 0,85 / 1,0 | rad/s |
| `beam.length` / `halfWidth` | 640 / 11 | px |
| `beam.damage` | 16 | — |
| `beam.innerGap` | 48 | px — vão seguro colado nela |
| `beam.growSpeed` | 620 | px/s — avanço da ponta |
| `beam.armDelayMs` | 130 | ms — piso de reação |
| `beam.blockedByRock` / `oncePerSweep` / `rotateAfterExtend` | `true` | — |
| `pull.telegraphMs` / `durationMs` | 520 / 1100 | ms |
| `pull.force` / `radius` | 640 / 330 | px/s², px |
| `pull.stingerEveryMs` / `Speed` / `Spread` | 150 / 250 / 0,5 | ms, px/s, rad |
| `pull.damage` / `lifeMs` / `r` | 9 / 2600 / 5 | —, ms, px |

### Olho

| Parâmetro | Valor | Unidade |
|---|---|---|
| `hp` / `radius` / `collRadius` | 560 / 46 / 30 | — / px / px |
| `speed` / `accel` / `drag` | 72 / 430 / 2,4 | px/s, px/s², 1/s |
| `keepDist` / `driftR` | 300 / 260 | px |
| `phaseAt` | [1, 0,66, 0,33] | fração de vida |
| `thinkMs` | [700, 520, 380] | ms por fase |
| `contactDamage` | 14 | — |
| `arena.w` / `arena.h` | 1860 / 1100 | px |
| `arena.pillars` | 26 | un |
| `arena.pillarKeepByPhase` | [1, 0,45, 0] | fração restante |
| `fan.telegraphMs` / `P3` | 520 / 380 | ms |
| `fan.count` / `volleys` / `volleyGapMs` | [5,7,9] / [2,2,3] / 170 | un / un / ms |
| `fan.spread` | 0,85 | rad |
| `fan.speed` / `damage` / `lifeMs` / `r` | 230 / 10 / 5000 / 6 | px/s, —, ms, px |
| `spiral.telegraphMs` | 600 | ms |
| `spiral.durationMs` | [2000, 2400, 2600] | ms por fase |
| `spiral.arms` / `emitEveryMs` / `spinSpeed` | [1,2,3] / 70 / 2,3 | un / ms / rad/s |
| `spiral.speed` / `damage` / `lifeMs` / `r` | 200 / 10 / 6000 / 6 | px/s, —, ms, px |
| `siege.telegraphMs` / `ringR` | 700 / 430 | ms / px |
| `siege.count` | [18, 24, 30] | un por fase |
| `siege.speed` / `damage` / `lifeMs` / `r` | 215 / 12 / 5000 / 7 | px/s, —, ms, px |
| `seekers.telegraphMs` / `count` | 620 / [0, 5, 8] | ms / un |
| `seekers.speed` / `turnRate` | 135 / 1,5 | px/s / rad/s |
| `seekers.damage` / `lifeMs` / `r` | 11 / 7000 / 8 | —, ms, px |
| `rain.telegraphMs` / `durationMs` / `everyMs` | 700 / 2200 / 90 | ms |
| `rain.spreadX` | 620 | px |
| `rain.speed` / `damage` / `lifeMs` / `r` | 260 / 10 / 6000 / 6 | px/s, —, ms, px |

### Projéteis

| Parâmetro | Valor | Efeito |
|---|---|---|
| `projectiles.maxAlive` | 900 | teto global (pico medido: 109) |
| `projectiles.popBySpear` | `true` | a estocada estoura projéteis, sem hit-stop |
| `projectiles.erodeRock` | `true` | impactos destroem rocha |
| `projectiles.erodeChance` | 0,3 | chance por impacto |

---

## 9. O que funcionou e o que não

### Funcionou

- **O modelo de nado.** Aceleração alta com teto baixo e deslizada de ~680 ms é a coisa mais
  bem calibrada do protótipo. Sobrevive a qualquer jogo que venha depois.
- **A gramática de três fases da estocada.** Antecipação curta, golpe curto, recuperação longa
  e cancelável cria uma decisão real em cada ataque. É pouco código para muito efeito.
- **O conjunto de impacto.** Hit-stop + empurrão + recuo + tremor + bolhas, disparando juntos
  e **só quando acerta**, é o que faz a lança sentir peso. Nenhum desses cinco sozinho basta.
- **Avisos visuais como regra, não exceção.** Todo ataque tem `Tel`. Isso deu legibilidade de
  graça e é o que permite densidade de projéteis sem o jogo virar azar.
- **`CONFIG` como única fonte de números.** Foi o que tornou possível corrigir o raio da
  água-viva três vezes sem caçar constantes no código.
- **Os três chefes têm gramáticas realmente distintas.** Fechar distância, controlar espaço,
  saturar espaço. Não são o mesmo chefe com outra cor.

### Ficou frágil

- **O clamp de velocidade é um degrau.** Ao fim do dash a velocidade cai de ~536 para 250 px/s
  num único frame. O mesmo acontece ao fim da estocada. Não incomoda, mas é uma desaceleração
  instantânea escondida no meio de um sistema que trata inércia com cuidado em todo o resto.
- **Carregar dá menos DPS que não carregar** (40,0/s contra 43,2/s). Emergiu por acidente e
  funciona, mas ninguém decidiu isso.
- **A câmera só existe numa arena.** Nas outras ela fica travada em (0,0) pelo `clamp`, então
  todo o caminho de câmera é exercitado em um único caso. Erros nele passam despercebidos.
- **Nenhuma interpolação de render.** A 144 Hz há repetição de quadros. Invisível nesta escala,
  visível em qualquer jogo mais rápido ou com câmera mais móvel.
- **O antitravamento é remendo sobre remendo.** Guarda de iterações, `unstick`, `carveRoom`,
  deslize tangencial e vigia de 1500 ms parado — cinco mecanismos para um problema que uma
  colisão feita direito (varredura contínua, ou separação por eixo com `skin`) resolveria.
- **A erosão não respeita a estrutura da arena.** Ela só protege a borda; a integridade do
  chão e dos pilares é sorte.
- **Nascimento por tentativa e erro.** `freeSpot` sorteia até 400 posições e desiste. Funciona
  numa arena pequena e vazia; numa arena densa vira custo e falha silenciosa.

### Quebraria se o jogo crescesse

- **Escopo global e estado mutável compartilhado.** `boss` é uma variável única: dois chefes ao
  mesmo tempo é impossível sem reescrever o despacho.
- **O despacho por `kind` em `switch`.** Cada chefe novo toca `updateBoss`, `drawBoss` e a barra
  de vida. Com cinco chefes isso vira um emaranhado.
- **`filter` em três arrays por passo.** A 900 projéteis são 54.000 objetos varridos e três
  arrays novos por segundo.
- **Desenho imediato, tudo todo frame.** Sem batching, sem camadas, sem cache. O fundo e as
  rochas são redesenhados integralmente 60+ vezes por segundo.
- **Nenhuma separação entre simulação e apresentação.** `drawJelly` lê `CONFIG` e o estado do
  chefe direto. Trocar o renderizador significa reescrever tudo.
- **Números de fase como arrays indexados por `phase − 1`.** Funciona com 3 fases; qualquer
  chefe com número diferente de fases quebra o padrão.

---

## 10. Identidade emergente

Pelo que o protótipo **faz**, e não pelo que se quis que ele fosse:

É um **jogo de arena de chefes com física de água**. O ciclo real é: entrar num espaço
fechado, ler padrões telegrafados, achar janelas curtas para se aproximar, dar duas ou três
estocadas e recuar. A inércia do nado transforma "aproximar" numa decisão custosa, porque
você não consegue parar de imediato — e é daí que vem a tensão.

Três traços que o código já assumiu sozinho:

1. **O espaço é o recurso, não a vida.** Quase todo dano vem de estar no lugar errado, não de
   errar um tempo de defesa. Não há bloqueio, parry nem esquiva com invulnerabilidade — o dash
   não dá i-frames. Desviar é geometria, não timing.
2. **A arena é um personagem.** A rocha bloqueia o raio da água-viva, quebra a investida do
   caranguejo e some progressivamente na luta do Olho. O terreno já participa do combate em
   três lugares diferentes, sem ninguém ter planejado isso como sistema.
3. **Uma arma só, muitas leituras.** A lança não evoluiu em variedade; a variedade veio dos
   inimigos. O protótipo sugere um jogo onde o vocabulário do jogador é pequeno e profundo,
   não amplo.

Direções que ele abre naturalmente, por já ter as peças:

- **Boss rush / arena.** É o que ele literalmente já é. Três chefes, uma tecla cada.
- **Roguelite de arenas curtas.** O gerador procedural de arena, o spawner com escalada e a
  ausência de estado persistente apontam para isso quase sem esforço.
- **Bullet hell subaquático.** O sistema de projéteis e a arena aberta do Olho já sustentam
  isso, e a inércia da água dá a ele uma identidade que um bullet hell normal não tem.
- **Metroidvania de exploração** é a direção **mais cara**: exigiria mundo persistente, câmera
  robusta, streaming de arena e salvamento — nada disso existe.

---

## 11. Para expandir

### Dá para aproveitar quase como está

- **Os números de game feel.** Nado, dash, tempos da lança, invulnerabilidade, hit-stop. Foram
  iterados contra problemas reais e estão calibrados entre si.
- **O modelo de arrasto implícito** `v *= 1/(1+k·dt)`.
- **A estrutura de máquina de estados com `Tel`.** O padrão "aviso → execução → recuperação"
  com um `think` que sorteia é reutilizável para qualquer criatura.
- **As fórmulas de geração de arena** (soma de senos para chão, blobs elípticos, pilares em
  anel) como ponto de partida de um gerador melhor.
- **A conta do raio giratório.** `ω · distância < velocidade do jogador` é uma restrição de
  desenho válida para qualquer ataque rotacional em qualquer jogo.
- **A paleta e a linguagem de cor por ataque.** Funciona e é barata.

### Precisa ser refeito direito

- **Renderização.** Hoje é desenho imediato de primitivas, tudo todo frame, sem camadas nem
  cache. Um jogo de verdade precisa de: separação entre estado de simulação e estado de
  apresentação, interpolação entre passos fixos, agrupamento por material, e alguma forma de
  atlas ou de cache em `OffscreenCanvas` para fundo e rochas. Se a direção for pixel art, a
  decisão de renderizar em resolução baixa e escalar tem que vir **antes** de desenhar
  qualquer arte.
- **Inimigos.** Precisa de uma representação de dados: um tipo descrito por tabela (vida,
  velocidades, estados, ataques) em vez de um `if` por tipo dentro de `updateEnemies`. E de um
  conceito de percepção — hoje todo inimigo sabe onde o jogador está, sempre, sem exceção.
- **Chefes.** O despacho por `kind` precisa virar dados: uma lista de fases, cada uma com um
  *pool* de ataques, e cada ataque como uma estrutura com aviso, execução, emissor e desenho.
  O padrão já está lá três vezes; falta extraí-lo.
- **Mundo.** Uma grade única em memória, reconstruída inteira ao trocar de arena, não escala.
  Qualquer jogo maior precisa de divisão em regiões, carregamento sob demanda e entidades
  ligadas à região.
- **Colisão.** Trocar as cinco redes de antitravamento por uma resolução correta: varredura
  contínua para corpos rápidos, ou separação por eixo com margem, e uma garantia de que um
  corpo nunca começa um passo dentro da geometria.
- **Salvamento.** Não existe nada. Nem estado de partida, nem progresso, nem configurações.
- **Entrada.** Hoje as teclas são literais espalhadas (`KeyR`, `KeyB`, `KeyN`, `KeyM` no
  próprio `keydown`). Precisa de mapeamento configurável e suporte a controle.

---

## 12. Lacunas

O que **não existe** no protótipo e qualquer jogo feito a partir dele vai precisar:

**Sistemas ausentes**
- Áudio de qualquer tipo — sem som, sem música, sem mixagem.
- Salvamento e carregamento.
- Menu, pausa, tela de título, opções.
- Progressão: níveis, experiência, itens, equipamento, moeda.
- Mais de uma arma ou qualquer habilidade além do dash.
- Cura de qualquer natureza. A vida só desce.
- Economia de recursos: sem oxigênio, sem estamina, sem munição — nada limita ações além do
  tempo dos golpes.
- Objetivo. Não há condição de vitória; o jogo só termina quando você morre.
- Transições: entrar e sair de arena é instantâneo, sem fade, sem carregamento.
- Dificuldade configurável, acessibilidade, remapeamento de teclas.
- Localização (o texto está fixo em português no código).

**Robustez ausente**
- Nenhuma semente de aleatoriedade — arenas não são reproduzíveis, e um bug de arena não pode
  ser recriado.
- Nenhum teste dentro do arquivo (a verificação foi feita por fora, em harness Node).
- Nenhum tratamento de redimensionamento de janela: o canvas é fixo em 960 × 540 e escalado
  por CSS.
- Nenhum suporte a toque ou controle.
- Nenhuma métrica ou telemetria para saber onde o jogador morre.
- Nenhum modo de depuração no jogo (hitboxes, estados, velocidade).

**Conteúdo ausente**
- Dois tipos de inimigo comum. Um jogo precisa de muito mais, e de variedade de papéis
  (à distância, blindado, suporte, de área).
- Um único bioma visual.
- Nenhuma narrativa, nenhum texto de jogo, nenhuma ambientação além dos nomes dos chefes.

---

## Perguntas que você precisa responder para definir o jogo novo

**Sobre a forma**

1. Qual é o **ciclo de uma sessão**? Arena após arena até morrer (roguelite), um boss rush com
   ordem fixa, ou um mundo contínuo para explorar? Essa resposta determina praticamente tudo o
   que vem na lista de refazer.
2. A morte **reinicia tudo** ou existe progresso que atravessa partidas?
3. Qual é a **duração alvo** de uma sessão, e de uma luta de chefe?

**Sobre o combate**

4. O jogador continua com **uma arma só**, ou ganha vocabulário (armas, habilidades, magias)?
   O protótipo hoje aposta em profundidade com pouco vocabulário — vale manter isso?
5. O dash deve ganhar **invulnerabilidade**? Hoje não tem, e é isso que torna desviar uma
   questão de posição e não de tempo. Mudar isso muda o gênero.
6. **Como o jogador se cura?** É a lacuna mais urgente: sem cura, qualquer sessão longa é
   insustentável.
7. A **estocada carregada** deve continuar sendo pior em DPS e melhor em alcance, ou isso
   precisa ser rebalanceado?
8. Existe **recurso a gerenciar** (oxigênio, estamina)? Num jogo subaquático o oxigênio é o
   candidato óbvio, e mudaria completamente o ritmo.

**Sobre o mundo**

9. As arenas são **procedurais ou desenhadas à mão**? O protótipo é 100% procedural, e essa é
   uma escolha que precisa ser feita cedo.
10. O mundo é feito de **arenas fechadas** ou é contínuo com câmera rolando? Se for contínuo,
    a colisão e a câmera precisam ser refeitas antes de qualquer conteúdo.
11. A **profundidade** significa alguma coisa mecanicamente (pressão, escuridão, criaturas
    diferentes), ou é só cenário?

**Sobre a apresentação**

12. **Pixel art com resolução fixa** ou vetorial/geométrico como está hoje? Essa decisão vem
    antes de qualquer arte, porque define toda a arquitetura de renderização.
13. Os **chefes atuais são conteúdo do jogo novo** ou só provas de conceito para o feel? Se
    forem conteúdo, eles precisam de identidade visual e narrativa de verdade.
14. Qual é o **tom**? O protótipo é colorido e legível; não há nada de sombrio nele hoje.

**Sobre o escopo**

15. Isso é um projeto **para terminar e publicar** ou um laboratório de aprendizado? A resposta
    muda quanto vale a pena investir em salvamento, menus, áudio e acessibilidade.
16. Quais das lacunas da seção 12 são **obrigatórias na primeira versão jogável**, e quais podem
    esperar?
