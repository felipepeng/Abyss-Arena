# GDD — Abyss Arena

Documento de design do jogo. Descreve **o que** o jogo é. Para **como** o código é
organizado, veja [`ARCHITECTURE.md`](ARCHITECTURE.md); para a ordem de construção,
[`ROADMAP.md`](ROADMAP.md). Os números herdados do protótipo e o porquê de cada um estão em
[`CONTEXTO.md`](CONTEXTO.md). Quando este documento e o CONTEXTO divergirem, **este manda**.

Convenções: tempos em **ms**, velocidades em **px/s**, acelerações em **px/s²**, ângulos em
**radianos**.

Seções marcadas com **🟡 Proposta** ainda não foram validadas em jogo e podem mudar.

---

## 1. Visão

Um mergulhador com uma lança desce ao abismo. Em cada profundidade ele sobrevive a três ondas
de criaturas e depois enfrenta o chefe que domina aquele lugar, no mesmo espaço em que lutou
contra as ondas.

É um jogo de ação 2D de arena, visto de lado, com **física de água**. O ciclo de combate é:
ler o aviso, achar uma janela curta, entrar, dar duas ou três estocadas e sair. A inércia do
nado transforma "aproximar" numa decisão cara, e é daí que vem a tensão.

### 1.1 Pilares

1. **O espaço é o recurso.** Quase todo dano vem de estar no lugar errado. Desviar é, antes de
   tudo, geometria. O dash tem uma invulnerabilidade curta (§4.2), mas continua sendo
   reposicionamento, não fuga.
2. **A arena é um personagem.** Cada mapa é desenhado para o seu chefe. A rocha quebra a
   investida do Caranguejo, faz sombra ao raio da Água-viva e se dissolve na luta do Olho.
3. **Uma arma, muitas leituras.** O vocabulário do jogador é pequeno e profundo: nadar,
   estocar, carregar e dar dash. A variedade vem das criaturas.
4. **Tudo é telegrafado.** Nenhum ataque acerta sem aviso visual antes. Isso permite densidade
   alta sem que o jogo vire sorte.
5. **O impacto só existe quando você acerta.** Hit-stop, empurrão, recuo, tremor e bolhas
   disparam juntos, e só no acerto. Errar não tem recompensa.

### 1.2 Tom

Um mergulho cada vez mais fundo e mais estranho. O começo é colorido e legível (areia, ocre,
luz vinda de cima); o fim é escuro e alienígena. A ambientação vem dos nomes, das paletas e de
um cartão de título curto na entrada de cada mapa (§7). Não há diálogo nem cutscene.

---

## 2. Estrutura da partida

### 2.1 Modos

| Modo | Como funciona |
|---|---|
| **Descida** (principal) | Sequência fixa: Leito das Fendas (Caranguejo) → Jardim de Corais (Água-viva) → Fosso do Abismo (Olho). Vencer o Olho termina o jogo. |
| **Arena livre** | O jogador escolhe qualquer um dos 3 mapas. **Os 3 ficam liberados desde o início.** Vencer volta à seleção. |

Não há salvamento na v1. Fechar o jogo perde o progresso da Descida.

### 2.2 Fluxo de uma fase

Uma **fase** é um mapa com seu chefe:

```
cartão de título → onda 1 → pausa → onda 2 → pausa → onda 3 → pausa → entrada do chefe → luta → fase concluída
```

- **Cartão de título:** nome do mapa, profundidade e uma frase (§7). Dura ~2500 ms; o jogador
  já pode nadar enquanto ele aparece, mas nenhum inimigo nasce.
- **Ondas:** uma onda termina quando **todos** os inimigos dela morrem (§3).
- **Pausa entre ondas:** 2500 ms, com o texto "ONDA 2" / "ONDA 3". A cura que estiver no chão
  continua coletável.
- **Entrada do chefe:** 3000 ms depois da onda 3. O chefe aparece com aviso próprio: nome na
  tela e barra de vida enchendo por 1500 ms. Durante a entrada ele **não ataca nem sofre dano**.
- **A vida do jogador passa de onda para onda e para o chefe.** Não há cura automática. É isso
  que dá valor aos drops (§5).

### 2.3 Morte

- A vida chega a 0: tela "VOCÊ AFUNDOU", com as opções **Tentar de novo** e **Menu**.
- **Tentar de novo reinicia a fase atual do começo** (onda 1), com vida cheia e o mapa
  regenerado com a **mesma semente**.
- Na Descida, os chefes já vencidos continuam vencidos: morrer no Olho não devolve ao
  Caranguejo.

### 2.4 Vitória

- **Fase concluída:** o chefe morre, as bolhas se espalham, a tela congela por um instante e
  aparece "FASE CONCLUÍDA". Na Descida, o jogo segue para o próximo mapa (com vida cheia). Na
  Arena livre, volta à seleção.
- **Fim da Descida:** depois do Olho, uma tela final com o tempo total e o número de mortes.

---

## 3. Ondas

Substituem o spawner por tempo do protótipo (CONTEXTO §5.3).

### 3.1 Regras

- Cada onda tem uma **lista fixa de inimigos**, definida por mapa (§3.2).
- Os inimigos entram em **levas escalonadas**: um nascimento a cada 600 ms, até o teto de
  **6 vivos ao mesmo tempo**. Quando um morre, o próximo da fila entra.
- **Onde nascem:** em **zonas de nascimento** desenhadas no mapa, escolhendo uma que esteja a
  pelo menos 220 px do jogador. Só se nenhuma zona servir, cai para um ponto livre aleatório
  com a mesma distância.
- **Aviso de nascimento:** um redemoinho de bolhas por 500 ms no ponto antes de o inimigo
  aparecer. Nascer também é telegrafado.
- Inimigos **estáticos** (Ouriço) têm posições fixas no mapa, que não passam por zona.
- Um indicador no HUD mostra quantos inimigos faltam na onda.

### 3.2 Composição 🟡 Proposta

| Mapa | Onda 1 | Onda 2 | Onda 3 |
|---|---|---|---|
| Leito das Fendas | 4 peixes | 3 peixes, 2 circuladores, 1 ermitão | 3 peixes, 2 circuladores, 2 ermitões, 2 ouriços |
| Jardim de Corais | 3 peixes, 2 medusinhas | 2 peixes, 2 circuladores, 2 medusinhas, 2 enguias | 3 peixes, 3 circuladores, 3 medusinhas, 3 enguias |
| Fosso do Abismo | 4 peixes, 2 vigias | 3 circuladores, 2 vigias, 4 lampreias | 3 peixes, 3 circuladores, 3 vigias, 8 lampreias |

---

## 4. Jogador

O jogador do protótipo se mantém. **A única mudança aprovada é a invulnerabilidade do dash
(§4.2).** Os valores completos e a justificativa de cada um estão no CONTEXTO §3, §4 e §8.

### 4.1 Nado

| Parâmetro | Valor |
|---|---|
| Raio | 9 px (colisão 7,65) |
| Aceleração | 1500 px/s² |
| Velocidade máxima (nado livre) | 250 px/s |
| Arrasto | 3,4 /s (35% disso no dash e na estocada, sem teto de velocidade) |
| Vida | 100 |

Arrasto implícito `v *= 1 / (1 + arrasto · dt)`. Chega a 250 px/s em ~267 ms e desliza ~70 px
depois de soltar.

### 4.2 Dash

| Parâmetro | Protótipo | **Jogo** |
|---|---|---|
| Velocidade | 640 px/s | 640 px/s |
| Duração | 140 ms (≈82 px) | 140 ms (≈82 px) |
| Recarga | 1200 ms | 1200 ms |
| **Invulnerabilidade** | nenhuma | **primeiros 100 ms** |

A distância é a medida no passo fixo, com o arrasto reduzido do dash: **82,4 px**, a mesma do
protótipo rodando o código original. Os "≈89 px" que o CONTEXTO registrava eram o nominal
640 × 0,14.

- Vai na direção da **mira**. Cancela a recuperação da estocada. Segurar a tecla redispara.
- **Durante a invulnerabilidade**, o jogador atravessa projéteis e contato sem sofrer dano. Os
  projéteis atravessados **não** estouram.
- **Sinal visual:** o corpo fica em `#bfeaff` durante todo o dash, como no protótipo. Nos 100 ms
  de invulnerabilidade, ganha também um contorno branco e um rastro de 2–3 silhuetas.
- Os 40 ms finais sem invulnerabilidade existem de propósito: um dash mal cronometrado ainda
  termina dentro do perigo. Continua sendo posicionamento com uma margem, não um botão de
  imunidade.
- **Consequência:** o bullet hell do Olho foi calibrado sem essa ferramenta. Rever a densidade
  dele no M8 (§8.3).

### 4.3 Lança

Três fases: antecipação 70 ms → golpe 120 ms (a hitbox só existe aqui) → recuperação 180 ms,
cancelável pelo dash. Hitbox em dois círculos de raio `inimigo.raio + 10` (na ponta e a 35% do
alcance), com um acerto por inimigo por estocada.

| | Sem carga | Carga cheia (600 ms) |
|---|---|---|
| Alcance | 52 px | 92 px |
| Dano | 16 | 36 |
| Impulso | 320 px/s | 600 px/s |

A estocada carregada tem **menos DPS** (40,0/s contra 43,2/s) e mais alcance, burst e
mobilidade. **Essa relação agora é uma decisão consciente:** carregar é abrir ou punir, não a
forma padrão de atacar.

A lança **estoura projéteis**, sem hit-stop.

### 4.4 Dano recebido

- Funil único. **667 ms de invulnerabilidade** depois de qualquer dano, empurrão de 330 px/s e
  piscada de 80 ms.
- Contato com criatura fora do ataque dela causa metade do dano (`ceil(dano/2)`).
- Nenhuma regeneração. A única cura são os drops (§5).

### 4.5 Controles

| Ação | Teclado + mouse |
|---|---|
| Nadar | `WASD` / setas |
| Mirar | mouse (sem mouse, a mira segue o nado) |
| Estocar (segurar carrega) | clique esquerdo, `J`, `K`, `Enter` |
| Dash | `Espaço`, `Shift`, `L` |
| Pausar | `Esc`, `P` |

As teclas `B`, `N`, `M` e `R` do protótipo viram atalhos do modo de depuração
(ARCHITECTURE §10.1).

---

## 5. Cura 🟡 Proposta

Inimigos comuns podem soltar uma **bolha de cura** ao morrer.

| Parâmetro | Valor |
|---|---|
| Cura por bolha | 12 HP (não passa de 100) |
| Vida no chão | 8000 ms; pisca nos últimos 2000 ms |
| Atração | a menos de 70 px, é puxada para o jogador a 300 px/s |
| Raio de coleta | 14 px |
| Movimento | sobe devagar (−15 px/s) e oscila, como uma bolha |

**Chance de drop por inimigo:**

| Inimigo | Chance |
|---|---|
| Peixe | 20% |
| Circulador | 30% |
| Ermitão | 45% |
| Ouriço | 25% |
| Medusinha | 25% |
| Enguia | 35% |
| Vigia | 35% |
| Lampreia | 10% |

- Capangas invocados por chefe (o chamado do Caranguejo) **não** soltam cura.
- Chefes não soltam cura.
- **Visual:** círculo `#7dffb0` com brilho pulsante e uma cruz clara no centro. Nenhum projétil
  usa verde claro, para não haver confusão.

---

## 6. Inimigos

Todos seguem o padrão **aviso → execução → recuperação**. Nenhum inimigo sofre dano de
projétil, e os inimigos não colidem entre si.

### 6.1 Inimigos-base (todos os mapas)

Detalhes completos no CONTEXTO §5.

| | Peixe | Circulador |
|---|---|---|
| Papel | perseguidor com investida | orbitador com estocada curta |
| Vida / raio | 34 / 11 px | 46 / 13 px |
| Velocidade base / ataque | 118 / 430 px/s | 132 / 380 px/s |
| Aviso | 400 ms, halo `#ffcf6a` + linha de mira | 300 ms, halo `#c58bff` |
| Execução | 480 ms de investida | 220 ms de estocada |
| Recuperação | 520 ms | 700 ms |
| Dano (ataque / contato) | 9 / 5 | 11 / 6 |

### 6.2 Inimigos exclusivos 🟡 Proposta

Cada mapa acrescenta dois inimigos, que antecipam a gramática do chefe daquele mapa.

#### Ermitão — Leito das Fendas · **blindado**
Um caranguejo-ermitão numa concha em espiral. Ensina o jogador a **flanquear**, que é o que o
Caranguejo exige.

| Atributo | Valor |
|---|---|
| Vida / raio | 60 / 14 px |
| Velocidade | 70 px/s (lento) |
| Blindagem | um acerto dentro de ±60° da frente é **bloqueado**: sem dano, fagulha, "tink", recuo do jogador, **sem hit-stop** |
| Ataque | aviso de 450 ms (pinça se abre e brilha) → golpe de 160 ms num raio de 40 px à frente |
| Dano (ataque / contato) | 12 / 6 |

Ele se vira para o jogador a no máximo 2,2 rad/s, então circular por ele funciona.

#### Ouriço — Leito das Fendas · **nega área, estático**
Fica em posições fixas do mapa, geralmente perto das formações rochosas. Ensina a **ler
zonas**.

| Atributo | Valor |
|---|---|
| Vida / raio | 30 / 12 px |
| Ciclo | a cada 2400 ms: aviso de 500 ms (os espinhos crescem e piscam) → dispara 8 espinhos em todas as direções |
| Espinho | 170 px/s, some a 110 px de distância, dano 8, cor `#e8d9a0` |
| Contato | 8 (sempre; ele não tem "fora do ataque") |

#### Medusinha — Jardim de Corais · **à distância**
Uma cria da Água-viva. Ensina a **pressão de longe** e o uso do coral como cobertura.

| Atributo | Valor |
|---|---|
| Vida / raio | 28 / 10 px |
| Comportamento | flutua a 260 px do jogador, subindo e descendo |
| Ataque | aviso de 600 ms (o sino incha e o núcleo brilha) → 1 esporo mirado |
| Esporo | 150 px/s, dano 8, vida 3500 ms, cor `#b8f0ff` |
| Recarga | 2200–3000 ms |
| Contato | 4 |

#### Enguia — Jardim de Corais · **emboscada**
Mora em **tocas** marcadas no mapa. Ensina que **o terreno também ataca**.

| Atributo | Valor |
|---|---|
| Vida / raio | 40 / 9 px (corpo longo, hitbox só na cabeça) |
| Na toca | só os olhos aparecem; **não pode ser atingida** |
| Gatilho | jogador a menos de 160 px da toca |
| Ataque | aviso de 450 ms (os olhos acendem e aparece uma linha de trajetória) → bote de 300 ms a 520 px/s → volta à toca em ~600 ms |
| Janela | vulnerável durante o bote e a volta |
| Dano (ataque / contato) | 13 / 6 |

Para a onda terminar, ela precisa morrer: o jogador tem que provocá-la e punir a volta.

#### Vigia — Fosso do Abismo · **atirador**
Um olho menor, com pedúnculo. Ensina os **padrões de leque** do Olho.

| Atributo | Valor |
|---|---|
| Vida / raio | 36 / 12 px |
| Comportamento | mantém 320 px do jogador; recua se ele chegar perto |
| Ataque | aviso de 500 ms (a pupila contrai e aparece um setor de 0,6 rad) → 3 projéteis em leque (0,3 rad entre eles) |
| Projétil | 200 px/s, dano 9, vida 4000 ms, cor `#ff8a6a` |
| Recarga | 1800–2600 ms |
| Contato | 5 |

#### Lampreia — Fosso do Abismo · **enxame frágil**
Pequena, rápida, vem em grupo. Ensina a **gerir quantidade** e a usar a estocada carregada
para abrir caminho.

| Atributo | Valor |
|---|---|
| Vida / raio | 18 / 8 px (sobrevive a uma estocada sem carga; ver nota) |
| Velocidade | 190 px/s, persegue direto |
| Ataque | aviso de 300 ms (a boca se abre e brilha) → mordida de 180 ms a 320 px/s |
| Dano (ataque / contato) | 7 / 4 |

> **Nota de balanceamento:** com 18 de vida, a lampreia sobrevive a uma estocada sem carga
> (16) com 2. Isso é proposital: obriga duas estocadas rápidas ou uma carregada. Se ficar
> tedioso, baixar para 16.

---

## 7. Mapas

Um mapa por chefe, **todos maiores que a tela** (960 × 540) e com câmera (look-ahead de 60 px na
direção da mira, suavização 0,12). As ondas e o chefe acontecem **no mesmo mapa**, então o
jogador aprende o terreno antes da luta.

**Construção híbrida:** a estrutura é **desenhada à mão** (paredes principais, formações
importantes, tocas, zonas de nascimento, posição do chefe). Os **detalhes** são procedurais com
semente: variação do relevo do chão e do teto, pequenas rochas decorativas e posições exatas de
elementos menores. A semente é sorteada no início da fase e **mantida ao tentar de novo**.

Todo mapa define uma **máscara de blocos protegidos**, que a erosão nunca destrói (a borda e os
blocos estruturais).

### 7.1 Leito das Fendas — Caranguejo 🟡 Proposta

> **LEITO DAS FENDAS** — 40 m
> *Algo arrasta as pinças no escuro.*

- **Tamanho:** 1440 × 800 (72 × 40 blocos).
- **Ideia:** um leito marinho raso, largo e plano no centro, cortado por **fendas** no chão e
  cercado de **formações rochosas** robustas.
- **Fixo:**
  - Área central aberta, de ~600 × 300 px, onde o Caranguejo nasce e onde a investida tem
    espaço.
  - 4 a 5 formações rochosas grossas ao redor. A investida **bate nelas e deixa o chefe
    exposto**, como já acontecia na caverna.
  - 2 fendas no chão (poços de 2–3 blocos de largura) que servem de refúgio curto: a pinça
    alcança, a investida não.
  - Posições fixas dos ouriços, perto das formações.
  - 4 zonas de nascimento nas bordas.
- **Procedural:** o relevo do chão e do teto (soma de senos, como no protótipo), blobs
  decorativos pequenos longe do centro e estalactites.
- **Paleta:**

  | Elemento | Cor |
  |---|---|
  | Fundo (0 / 0,45 / 1) | `#2b4a5e` / `#183040` / `#0a1822` |
  | Rocha corpo / topo / luz | `#5a4632` / `#7a6040` / `#b89a64` |
  | Colunas de luz | `#ffe6b0`, alpha 0,06 |

### 7.2 Jardim de Corais Luminosos — Água-viva 🟡 Proposta

> **JARDIM DE CORAIS LUMINOSOS** — 120 m
> *A luz aqui não vem de cima.*

- **Tamanho:** 1440 × 900 (72 × 45 blocos).
- **Ideia:** um recife bioluminescente. **Colunas de coral** verticais atravessam a água,
  formando corredores e bolsões.
- **Fixo:**
  - 7 a 9 colunas de coral espalhadas. São a **sombra do raio giratório**: a posição delas
    decide onde é seguro. Precisam deixar corredores de pelo menos 80 px.
  - Uma **área aberta** alta no centro, onde a Água-viva flutua sem esbarrar em tudo.
  - 5 a 6 **tocas de enguia** embutidas nas colunas e no chão.
  - 4 zonas de nascimento.
- **Procedural:** ramificações de coral nas colunas (blocos extras de 1–2), relevo do chão e
  pontos de brilho decorativos.
- **Paleta:**

  | Elemento | Cor |
  |---|---|
  | Fundo (0 / 0,45 / 1) | `#0f3a4a` / `#082634` / `#031219` |
  | Coral corpo / topo / luz | `#2c4a5a` / `#3f7f7a` / `#ff8fc8` |
  | Pontos de brilho | `#8affe0`, `#ff8fc8`, alpha pulsante |

- **Cuidado:** o raio da Água-viva já é interrompido pela rocha. Com corais demais ele fica
  inofensivo; com poucos, impossível. Medir quantas das 64 direções são cortadas antes de
  300 px (no protótipo eram 56) e mirar numa faixa entre 35 e 50.

### 7.3 Fosso do Abismo — Olho

> **FOSSO DO ABISMO** — ??? m
> *Ele já te viu.*

- **Tamanho:** 1860 × 1100 (93 × 55 blocos), a arena aberta do protótipo.
- **Ideia:** um vazio escuro, sem chão nem teto, com **26 pilares** num anel entre 22% e 92%
  do raio, nunca a menos de 7 blocos do centro.
- **Fixo:** a borda, o anel de pilares com formas desenhadas (para que a cobertura seja
  aprendível) e 6 zonas de nascimento na periferia.
- **Procedural:** pequenas variações de forma de cada pilar.
- **Os pilares se dissolvem:** inteiros durante as ondas e na fase 1 do Olho, 45% na fase 2,
  zero na fase 3. Os impactos **dos projéteis do Olho** têm 30% de chance de erodir o bloco
  atingido. Os projéteis da Vigia **não** erodem, para que as ondas não gastem a cobertura
  antes da luta.
- **Paleta:**

  | Elemento | Cor |
  |---|---|
  | Fundo (0 / 0,45 / 1) | `#1a1030` / `#0d0820` / `#050310` |
  | Rocha corpo / topo / luz | `#2a2238` / `#3e3058` / `#6a5a90` |
  | Colunas de luz | nenhuma (não chega luz aqui) |

---

## 8. Chefes

Os três chefes do protótipo, com os mesmos ataques e números (CONTEXTO §6). Todos:

- Pensam (`think`) → sorteiam um ataque do *pool* da fase atual (rerrolam se repetir o último)
  → aviso → execução → recuperação.
- Têm barra de vida no topo, com **marca em cada limiar de fase** (Caranguejo 50%, Água-viva
  50%, Olho 66% e 33%), seta na borda da tela quando saem de vista e raio de colisão menor que
  o visual.
- Não têm fase de vulnerabilidade explícita. O jogador escolhe as janelas.
- Não sofrem dano de projétil nem dão drop.

### 8.1 Caranguejo Abissal — pressão corpo a corpo

420 de vida, 90 px/s. Fase 2 abaixo de 50%.

| Ataque | Aviso | Execução | Dano |
|---|---|---|---|
| Investida | 620 ms (420 na f2), faixa de 520 × 52 px | 620 ms a 520 px/s (640 na f2); para ao bater | 20 |
| Pinça | 520 ms (360 na f2), círculo crescendo | 180 ms, raio 118 px (150 na f2) | 24 |
| Chamado | 700 ms, anéis expandindo | invoca 3 peixes (sem drop, ignoram o teto de 6) | — |

**Fase 2:** pausa entre ataques de 900 → 520 ms; investida e pinça em dobro no *pool*; 55% de
chance de emendar uma investida extra com aviso de 294 ms.

**No mapa novo:** o Leito das Fendas é maior que a caverna do protótipo. A investida de
520 px continua curta em relação ao mapa, e as formações rochosas são o que a interrompe.

### 8.2 Água-viva Colossal — controle de espaço

380 de vida. Flutua a 215 px do jogador e 55 px acima dele. Fase 2 abaixo de 50%.

| Ataque | Aviso | Execução | Dano |
|---|---|---|---|
| Anel de esporos | 620 ms (440 na f2) | 14 projéteis (20 em 3 ondas na f2, cada onda girada 0,22 rad) | 11 |
| Raio giratório | 700 ms (520 na f2), linha de mira + seta de giro | a ponta estica a 620 px/s, depois varre a 0,85 rad/s (1,0 na f2) | 16 |
| Sucção | 520 ms | 1100 ms puxando a 640 px/s² num raio de 330 px, com um ferrão a cada 150 ms | 9 |

As sete regras do raio (CONTEXTO §6.2) continuam valendo. A restrição **`ω · 215 px <
250 px/s`** é dura: acima de ~1,16 rad/s o raio fica impossível de superar nadando.

**No mapa novo:** as colunas de coral são a sombra do raio (§7.2).

### 8.3 Olho do Abismo — bullet hell

560 de vida. Vaga num raio de 260 px do centro e recua se o jogador chegar a menos de 300 px.
Três fases: 100–66%, 66–33% e abaixo de 33%.

| Ataque | Aviso | F1 | F2 | F3 |
|---|---|---|---|---|
| Leque | 520 ms (380 na f3) | 5 × 2 salvas | 7 × 2 | 9 × 3 |
| Espiral | 600 ms | 1 braço, 2000 ms | 2 braços, 2400 ms | 3 braços, 2600 ms |
| Cerco | 700 ms, anel de 430 px no jogador | 18 | 24 | 30 |
| Perseguidores | 620 ms | — | 5 | 8 |
| Chuva | 700 ms, faixa vertical | — | — | 3 a cada 90 ms por 2200 ms |

Pausa entre ataques: 700 → 520 → 380 ms.

**Mudanças em relação ao protótipo:**
- O Olho **não troca a arena** ao nascer: o Fosso já é a arena dele, e as ondas acontecem nela.
- O jogador **não** recupera a vida quando ele aparece (§2.2).
- **A revisar no M8:** com a invulnerabilidade do dash, cerco e espiral podem ficar fáceis
  demais. Candidatos a ajuste: mais projéteis no cerco, menos intervalo na espiral. Medir antes
  de mexer.

---

## 9. Apresentação

### 9.1 Arte

- **Vetorial desenhada por código** (primitivas de Canvas 2D), sem sprites, como no protótipo.
- **Paleta por mapa** para fundo e rocha (§7). Criaturas e projéteis mantêm as cores do
  protótipo (CONTEXTO §2.3 e §2.4).
- A **cor identifica o ataque**. Cores de projéteis novos:

  | Cor | Origem |
  |---|---|
  | `#e8d9a0` | espinho (Ouriço) |
  | `#b8f0ff` | esporo (Medusinha) |
  | `#ff8a6a` | tiro (Vigia) |

  Nenhuma cor nova pode ficar próxima de uma existente nem do verde da cura (`#7dffb0`).

- **Partículas:** só bolhas, como no protótipo. Novos eventos: cura coletada (8 bolhas
  `#7dffb0`), nascimento de inimigo (redemoinho, 12 bolhas `#cfeaff`), bloqueio do Ermitão
  (fagulha + 4 bolhas `#ffe9a8`).

### 9.2 HUD

- Vida do jogador (canto superior esquerdo) e indicador de recarga do dash.
- Contador da onda: "ONDA 2/3 · 5 restantes".
- Barra do chefe no topo, com marcas de fase.
- Seta de chefe fora da tela, com a distância **sem unidade falsa** (o protótipo escrevia "m"
  para pixels).
- O HUD não treme.

---

## 10. Áudio

**Na v1, tudo é gerado por código** (Web Audio API): nenhum arquivo de som. A música passa a vir
de arquivos numa versão futura, então o sistema de áudio precisa aceitar as duas fontes
(ARCHITECTURE §8).

### 10.1 Efeitos

| Evento | Caráter |
|---|---|
| Estocada (início) | sopro curto, filtrado |
| Acerto da lança | golpe grave e seco + estalo, sincronizado com o hit-stop |
| Estocada carregada pronta | tom ascendente que para no máximo |
| Estourar projétil | "plop" agudo |
| Bloqueio do Ermitão | "tink" metálico |
| Dash | rajada de bolhas (ruído com filtro subindo) |
| Jogador ferido | baque abafado + tom descendente |
| Coletar cura | acorde curto ascendente |
| Aviso de ataque de chefe | um som por tipo de aviso, grave e reconhecível |
| Morte de inimigo | bolhas + tom curto |
| Morte do chefe | explosão grave longa |
| Nascimento de inimigo | borbulhar crescente |
| Menu | clique suave ao navegar e ao confirmar |

Todo som tem pequena variação aleatória de altura (±5%) para não cansar.

### 10.2 Música (procedural)

- Uma trilha gerada por mapa: pads graves, pulso lento, escala própria de cada mapa (mais
  consonante no Leito, mais dissonante no Fosso).
- **Camadas por intensidade:** ondas → chefe → fase 2 do chefe acrescentam percussão e
  densidade, sem cortes bruscos.
- Menu com uma trilha calma própria.

### 10.3 Volume

Controles separados de **música** e **efeitos** no menu de pausa e no menu principal (sem
salvar na v1).

---

## 11. Menus

| Tela | Conteúdo |
|---|---|
| **Título** | nome do jogo, fundo animado com bolhas. Opções: *Descida*, *Arena livre*, *Controles*, *Áudio* |
| **Arena livre** | os 3 mapas com o nome e o chefe; todos disponíveis |
| **Controles** | tabela de §4.5 |
| **Pausa** (`Esc`/`P`) | *Continuar*, *Tentar a fase de novo*, *Áudio*, *Sair para o menu*. A simulação congela |
| **Derrota** | "VOCÊ AFUNDOU" · *Tentar de novo* · *Menu* |
| **Fase concluída** | "FASE CONCLUÍDA" · segue (Descida) ou volta à seleção (Arena livre) |
| **Fim da Descida** | tempo total, mortes · *Menu* |

Toda troca de tela e de fase tem um **fade** curto (~300 ms). Nenhuma transição é instantânea.

---

## 12. Fora da v1

- Melhorias escolhíveis entre ondas ou fases (a moeda para isso ainda não existe).
- Salvamento (progresso, configurações).
- Música em arquivo.
- Remapeamento de teclas e suporte a controle.
- Localização (o texto é só português).
- Telemetria de mortes.
- Novos chefes e mapas.

---

## 13. Questões em aberto

1. Balanceamento da cura: 12 HP e as chances da tabela do §5 são chutes. Medir o HP médio com
   que o jogador chega ao chefe.
2. Aprovar ou ajustar os mapas (§7.1, §7.2) e os inimigos exclusivos (§6.2).
3. A densidade do Olho com o dash invulnerável (§8.3).
4. A composição das ondas (§3.2): a onda 3 do Fosso tem 17 inimigos. Talvez seja demais.
5. A vida da Lampreia: 18 ou 16 (§6.2).
