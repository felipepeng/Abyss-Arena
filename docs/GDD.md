# GDD — Abyss Arena

Documento de design do jogo. Descreve **o que** o jogo é. Para **como** o código é
organizado, veja [`ARCHITECTURE.md`](ARCHITECTURE.md); para a ordem de construção,
[`ROADMAP.md`](ROADMAP.md). Os números herdados do protótipo e o porquê de cada um estão em
[`CONTEXTO.md`](CONTEXTO.md). Quando este documento e o CONTEXTO divergirem, **este manda**.

Convenções: tempos em **ms**, velocidades em **px/s**, acelerações em **px/s²**, ângulos em
**radianos**.

As propostas que antes estavam marcadas com 🟡 (ondas, cura, inimigos exclusivos e os mapas do Leito
e do Coral) foram **aprovadas para a v1** no M8, com os números atuais. Continuam sujeitas a ajuste
depois de jogadas: qualquer mudança é normal, com o número no `config/` e o motivo aqui.

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
  aparece "FASE CONCLUÍDA". Na Descida, o jogo segue para o próximo mapa (com vida cheia), depois da
  **descida** (§2.5). Na Arena livre, volta à seleção.
- **Fim da Descida:** depois do Olho, uma tela final com o tempo total e o número de mortes.

### 2.5 A descida entre as fases

Entre uma fase e a seguinte da Descida (Leito → Coral e Coral → Fosso; **não** na Arena livre nem
depois do Olho), o botão "Continuar" leva a uma cena de ~6 s sem controle. Ela **não mostra o
mergulhador entrando no buraco**: já começa com ele caindo, de cabeça para baixo, por um poço enorme,
com a câmera descendo junto. No fim ela mostra **ele saindo** do poço, na água da fase seguinte, e o
fade leva ao jogo; o cartão de título do mapa novo cobre a entrada.

| Trecho | Duração | O que se vê |
|---|---|---|
| Queda | 3,8 s | já em 90% da velocidade (430 px/s em regime); paredes do poço, estratos que andam mais devagar (parallax), bolhas e riscas de velocidade; as cores vão do mapa que acabou para as do próximo; perto do fim a boca de saída aparece embaixo, alargando |
| Saída | 2,5 s | passa pela boca e freia; a água e o feixe de luz do mapa novo aparecem embaixo do teto de rocha; ele vira e nada para a direita (190 px/s, abaixo do nado livre); a câmera para logo depois da boca |

- **A luz só diminui:** de 0,92 a 0,46 na primeira descida e de 0,46 a 0,10 na segunda (1 = dia,
  0 = preto). A escuridão é uma vinheta com um círculo de luz em volta do mergulhador, que encolhe
  com a luz. A segunda descida começa onde a primeira acabou e termina mais escura.
- **Só a água:** a música e o ambiente do mapa se calam (fade de 0,9 s) e fica o som da água do
  mergulhador (§10.1): forte na queda, mais calma quando ele freia e nada.
- **Pular:** Enter, Espaço, J ou Esc, mas só depois de 0,5 s (o Enter que confirmou "Continuar" não
  pula a cena). Aparece "ENTER pular" no canto.
- **Sessão:** o tempo da cena **não** entra no tempo da Descida, que só soma os passos jogados.

---|---|---|
| Boca | 1,8 s | o fundo do mar do mapa que acabou, com as colunas de luz dele; o mergulhador nada (190 px/s, abaixo do nado livre) até o meio do buraco |
| Queda | 4,4 s | vira para baixo e acelera até 430 px/s; paredes do poço, estratos que andam mais devagar (parallax), bolhas e riscas de velocidade; as cores vão do mapa que acabou para as do próximo |
| Chegada | 1,0 s | freia a 25% da velocidade, quase no preto |

- **A luz só diminui:** de 0,92 a 0,46 na primeira descida e de 0,46 a 0,10 na segunda (1 = dia,
  0 = preto). A escuridão é uma vinheta com um círculo de luz em volta do mergulhador, que encolhe
  com a luz. A segunda descida começa onde a primeira acabou e termina mais escura.
- **Só a água:** a música e o ambiente do mapa se calam (fade de 0,9 s) e fica o som da água do
  mergulhador (§10.1), que acompanha a velocidade dele.
- **Pular:** Enter, Espaço, J ou Esc, mas só depois de 0,5 s (o Enter que confirmou "Continuar" não
  pula a cena). Aparece "ENTER pular" no canto.
- **Sessão:** o tempo da cena **não** entra no tempo da Descida, que só soma os passos jogados.

---

## 3. Ondas

Substituem o spawner por tempo do protótipo (CONTEXTO §5.3).

### 3.1 Regras

- Cada onda tem uma **lista fixa de inimigos**, definida por mapa (§3.2), e um **nome** (§3.3).
- A onda é uma **sequência de levas** (§3.3), cada uma entrando de um jeito. A primeira vem com a
  onda; as outras vêm quando **sobram poucos inimigos** (quem joga bem não espera) ou quando
  **passa um tempo** (quem demora é pressionado), o que vier primeiro. Uma leva nova é anunciada
  no HUD ("PINÇA!").
- Nas levas **espalhadas** os inimigos nascem um a cada 600 ms, até o teto de **6 vivos ao mesmo
  tempo**. Nas levas de **flanco, pinça e cerco** entram quase juntos (150 ms entre um e outro) e o
  teto sobe para 10.
- **Onde nascem:** em **zonas de nascimento** desenhadas no mapa, escolhendo uma que esteja a
  pelo menos 220 px do jogador. Só se nenhuma zona servir, cai para um ponto livre aleatório
  com a mesma distância. Os padrões de flanco, pinça e cerco escolhem o lugar (§3.3) e, se não der
  (rocha, jogador perto), caem nesse jeito de sempre.
- **Aviso de nascimento:** um redemoinho de bolhas por 500 ms no ponto antes de o inimigo
  aparecer. Nascer também é telegrafado.
- Inimigos **estáticos** (Ouriço) têm posições fixas no mapa, que não passam por zona.
- Um indicador no HUD mostra quantos inimigos faltam na onda.

### 3.2 Composição

| Mapa | Onda 1 | Onda 2 | Onda 3 |
|---|---|---|---|
| Leito das Fendas | 4 peixes | 3 peixes, 2 circuladores, 2 ermitões | 3 peixes, 2 circuladores, 3 ermitões, 2 ouriços |
| Jardim de Corais | 3 peixes, 2 medusinhas | 2 peixes, 2 circuladores, 2 medusinhas, 2 anêmonas | 3 peixes, 3 circuladores, 3 medusinhas, 3 anêmonas |
| Fosso do Abismo | 4 peixes, 2 vigias | 3 circuladores, 2 vigias, 4 lampreias | 3 peixes, 3 circuladores, 3 vigias, 8 lampreias |

Estes são os **totais** de cada onda. O que as levas mudam é a ordem e o lugar em que chegam.

### 3.3 Levas

Cada onda tem um nome (mostrado no HUD e no número da onda) e uma sequência de levas. O número entre
parênteses é o gatilho da leva seguinte: entra quando sobram **até esse tanto** da onda em campo ou
quando passa o tempo, o que vier primeiro.

| Padrão | Como entra |
|---|---|
| **Espalhada** | cada um numa zona qualquer, um a cada 600 ms (o jeito de antes) |
| **Flanco** | todos da **mesma zona**, quase juntos: um bando que chega por um lado só |
| **Pinça** | de **duas zonas opostas** ao mesmo tempo (a segunda é a mais distante da primeira) |
| **Cerco** | em **anel** em volta do jogador, a 270–340 px: dá tempo de olhar em volta, não de ficar parado |

Os estáticos (Ouriço, Anêmona) não seguem o padrão: sempre nascem nas posições fixas do mapa.

| Mapa | Onda | Nome | Levas |
|---|---|---|---|
| Leito das Fendas | 1 | CARDUME | 2 peixes · 2 peixes em flanco (≤ 1, 6,5 s) |
| | 2 | PINÇA | 2 peixes e 2 circuladores · 1 peixe e 2 ermitões em pinça (≤ 2, 9 s) |
| | 3 | CERCO | 3 peixes e 2 ouriços · 2 circuladores em flanco (≤ 2, 8 s) · 3 ermitões em cerco (≤ 2, 9 s) |
| Jardim de Corais | 1 | À DERIVA | 3 peixes · 2 medusinhas em flanco (≤ 1, 6,5 s) |
| | 2 | PINÇA | 2 anêmonas e 2 medusinhas · 2 peixes e 2 circuladores em pinça (≤ 2, 9 s) |
| | 3 | MARÉ | 3 anêmonas e 3 medusinhas · 3 peixes em flanco (≤ 3, 8 s) · 3 circuladores em cerco (≤ 2, 9 s) |
| Fosso do Abismo | 1 | OLHARES | 2 peixes e 2 vigias · 2 peixes em flanco (≤ 1, 6,5 s) |
| | 2 | ENXAME | 3 circuladores e 2 vigias · 4 lampreias em flanco (≤ 2, 8 s) |
| | 3 | ENXURRADA | 3 peixes e 3 vigias · 3 circuladores e 4 lampreias em pinça (≤ 3, 9 s) · 4 lampreias em cerco (≤ 3, 9 s) |

A última leva de cada onda 3 é o fecho (o cerco): o jogador chega ao chefe depois de ter sido cercado
uma vez. O gatilho "sobram poucos" também elimina o tempo morto de quem limpa a onda rápido.

**Medido com o jogador-robô** (`npm run balance`, regular, 6 sementes): as levas não deixam as ondas
mais difíceis que antes (no Leito ele morre menos; no Coral e no Fosso o dano é parecido). Quem
joga melhor que o robô vai sentir mais a pressão do que o número diz.

---

## 4. Jogador

O jogador do protótipo se mantém. **A única mudança aprovada é a invulnerabilidade do dash
(§4.2).** Os valores completos e a justificativa de cada um estão no CONTEXTO §3, §4 e §8.

**Visual:** o do protótipo (elipse azul, tanque, visor e nadadeiras triangulares), com um leve
sombreamento no corpo e no visor (luz fixa no mundo). Um redesenho completo foi tentado e **descartado**
(`docs/screenshots/player/` guarda o antes e o depois dele). Ficaram dois acréscimos: o **anel de
carga** da lança, que enche até a carga cheia e então fica dourado e pulsante, e o **contorno branco com
halo** nos 100 ms de invulnerabilidade do dash (GDD §4.2), além do rastro de silhuetas.

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
- **Consequência:** o bullet hell do Olho foi calibrado sem essa ferramenta. Medido no M8 (§8.3):
  a invulnerabilidade quase não muda a pressão dele, então a densidade ficou como está.

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

## 5. Cura

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
| Anêmona | 30% |
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

**Visual do Peixe** (redesenhado depois do M8): corpo de torpedo com degradê e contorno, nadadeiras
dorsal, ventral e peitoral, cauda bifurcada que balança no ritmo do serpenteio e olho com anel claro e
brilho. No **aviso** o corpo fica âmbar (com o halo e a linha de mira de sempre) e o cenho franze; na
**investida** a cauda fica reta e aparecem riscos de velocidade. A **dorsal fica sempre para cima**: ele gira para onde nada, então o desenho é espelhado quando aponta para a esquerda (com uma zona morta, para não piscar nadando na vertical). A Lampreia, que tem o olho de um lado só, usa o mesmo espelho. Só apresentação. Antes e depois em
`docs/screenshots/fish/`.

**Fora do raio de visão** (Peixe 300 px, Lampreia 560 px), eles não ficam parados esperando o
jogador: avançam devagar (40 e 70 px/s) e passam a perseguir de verdade quando entram no raio.
É uma mudança em relação ao protótipo, onde o peixe parava.

### 6.2 Inimigos exclusivos

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

Ele se vira para o jogador a no máximo 1,8 rad/s, então circular por ele funciona. (Eram 2,2 rad/s
e 1 e 2 ermitões nas ondas 2 e 3: girava rápido demais para ser acertado, e o jogo pediu mais deles.)

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
| Visual | miniatura da Água-viva: sino com borda de lóbulos e canais, núcleo que acende no aviso, tentáculos finos em ondas e uma aura na cor do esporo (`docs/screenshots/jellyling/`) |
| Comportamento | flutua a 260 px do jogador, subindo e descendo |
| Ataque | aviso de 600 ms (o sino incha e o núcleo brilha) → 1 esporo mirado |
| Esporo | 150 px/s, dano 8, vida 3500 ms, cor `#b8f0ff` |
| Recarga | 2200–3000 ms |
| Contato | 4 |

#### Anêmona-chicote — Jardim de Corais · **varredura rotativa, estática**
Presa às faces das colunas de coral, em posições fixas do mapa. Ensina a **ler uma varredura
rotativa**, que é o raio da Água-viva em miniatura. (Substituiu a Enguia, uma emboscada que exigia
provocar e esperar.)

| Atributo | Valor |
|---|---|
| Vida / raio | 40 / 13 px |
| Ciclo | descansa 1800 ms → aviso de 600 ms (o braço se ergue e brilha, com o arco da varredura marcado) → varredura de 270° |
| Varredura | braço de 110 px a 2 rad/s (2356 ms). Regra 3: 2 · 110 = 220 px/s, abaixo dos 250 |
| Cobertura | a rocha corta o braço, como o raio da Água-viva: o coral dá cobertura |
| Dano (braço / contato) | 12 / 6 |

O arco acompanha o jogador até o último passo do aviso e o tem no meio: o braço chega a ele depois
de 135° (~1,2 s), tempo de sair do alcance, de acompanhar o braço ou de atravessá-lo no dash. Só a
cunha de 90° do lado oposto não é varrida. Só o corpo é atingível (o braço não). As anêmonas de uma
onda não varrem juntas: cada uma nasce com o próprio relógio.

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

**Navegação.** Os inimigos **contornam a rocha**. Quem tem o caminho reto livre anda como sempre; com
um pilar de coral ou de rocha no meio, segue o caminho mais curto até o jogador (um mapa de distâncias
sobre a grade, refeito quando o jogador troca de bloco ou a rocha muda: a parede do Coral que quebra,
os pilares do Fosso). Peixe, Circulador, Lampreia e Ermitão **só avisam o ataque com o caminho até o
jogador livre** (não investem contra a parede); a Medusinha e a Vigia, sem ver o jogador, contornam
até achar um ângulo. Isso corrigiu um bug do Coral e do Fosso: peixes, medusinhas e vigias ficavam
encostados num pilar para sempre e a onda nunca terminava (medido: 3 a 5 presos por onda no Coral e 1
a 4 no Fosso; agora 0).

#### Como o M5 preencheu o que este documento deixava aberto

Os números abaixo não estavam no GDD e saíram de `src/config/enemies/`; todos são ajustáveis.

- **Ermitão:** a pinça alcança 40 px do centro dele até a borda do jogador, dentro do mesmo arco
  de ±60° da blindagem. Recuperação de 600 ms e espera de 500–1200 ms até o próximo aviso. Ele
  continua girando a 1,8 rad/s durante o aviso; o golpe sai para onde ele estiver olhando.
  Regra 3: 1,8 rad/s · 56 px (o alcance do aviso) = 101 px/s, abaixo dos 250.
- **Ouriço:** o ciclo de 2400 ms é 1900 ms de descanso + 500 ms de aviso. O espinho tem raio 3
  e some a 110 px da borda do ouriço. Cada ouriço nasce com um relógio e um ângulo sorteados, para
  dois ouriços não dispararem juntos. Ele ocupa uma das posições fixas do mapa, livre e a
  pelo menos 220 px do jogador.
- **Medusinha e Vigia:** só começam o aviso com **linha de visão** (Medusinha até 420 px, Vigia
  até 520 px). Sem visão, deslizam em volta do jogador até achar um ângulo, o que também os tira
  de trás de um pilar. A Medusinha sobe e desce; a Vigia recua com 1,4× de força se o jogador
  chegar mais perto que a faixa.
- **Anêmona:** ocupa uma das 6 posições fixas do mapa (livre e a 220 px ou mais do jogador). A caixa
  de colisão dela é menor que o desenho (9,1 px), para caber no bloco encostado na coluna.
- **Lampreia:** cada uma persegue um ponto deslocado até 46 px do jogador, que se fecha sobre ele
  ao chegar perto; sem isso o enxame vira uma bola só (os inimigos não colidem entre si).
- **Bloqueio do Ermitão:** a fagulha e as 4 bolhas saem na borda do escudo, do lado do jogador.
  O jogador recua como num acerto, mas não há hit-stop nem tremor (regra 6).

---

## 7. Mapas

Um mapa por chefe, **todos maiores que a tela** (960 × 540) e com câmera (look-ahead de 60 px na
direção da mira, suavização 0,12). As ondas e o chefe acontecem **no mesmo mapa**, então o
jogador aprende o terreno antes da luta.

**Construção híbrida:** a estrutura é **desenhada à mão** (paredes principais, formações
importantes, posições de inimigos fixos, zonas de nascimento, posição do chefe). Os **detalhes** são procedurais com
semente: variação do relevo do chão e do teto, pequenas rochas decorativas e posições exatas de
elementos menores. A semente é sorteada no início da fase e **mantida ao tentar de novo**.

Todo mapa define uma **máscara de blocos protegidos**, que a erosão nunca destrói (a borda e os
blocos estruturais).

### 7.1 Leito das Fendas — Caranguejo

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

### 7.2 Jardim de Corais Luminosos — Água-viva

> **JARDIM DE CORAIS LUMINOSOS** — 120 m
> *A luz aqui não vem de cima.*

- **Tamanho:** 2240 × 1380 (112 × 69 blocos). No começo o jogador só tem a **arena interna**, de
  1440 × 900 (72 × 45 blocos, o tamanho antigo do mapa), cercada por uma parede de **rocha roxa
  rachada** (bloco `Barrier`, `B` no desenho). Em volta dela há uma **câmara externa** fechada, com
  as próprias colunas de coral. As ondas nascem só na arena interna.
- **A parede quebra na fase 2 da Água-viva** (§8.2): uma onda de destruição sai do ponto onde ela
  está e derruba os 296 blocos, do mais perto ao mais longe, em ~1,4 s, com tremor de tela, bolhas
  e som. Só o chefe quebra a parede; projéteis e lança não a tocam. A arena vira o mapa inteiro.
- **Ideia:** um recife bioluminescente. **Colunas de coral** verticais atravessam a água,
  formando corredores e bolsões.
- **Fixo:**
  - 7 a 9 colunas de coral espalhadas. São a **sombra do raio giratório**: a posição delas
    decide onde é seguro. Precisam deixar corredores de pelo menos 80 px.
  - Uma **área aberta** alta no centro, onde a Água-viva flutua sem esbarrar em tudo.
  - 11 **colunas de coral externas** (4 do chão e 7 do teto, a maior com 28 blocos), com corredores
    de 80 px. Depois da quebra, são cobertura nova e espaço para dar a volta no chefe.
  - 6 **posições de anêmona** nas faces das colunas de coral.
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
  300 px (no protótipo eram 56) e mirar numa faixa entre 35 e 50. A conta vale para a arena
  interna.

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

**Visual (redesenhado depois do M8):** carapaça com relevo, espinhos no casco, pernas e braços
articulados, pinças com dentes e olhos em hastes. A pinça brilha e abre durante o aviso (o círculo
no chão continua sendo o aviso de verdade). Na **fase 2** a carapaça racha e brilha por dentro, os
espinhos crescem e os olhos ganham brasa: ele "enlouquece", como o Olho ganha olhos. Só apresentação:
nenhum número de jogo mudou. Antes e depois em `docs/screenshots/crab/`.

**No mapa novo:** o Leito das Fendas é maior que a caverna do protótipo. A investida de
520 px continua curta em relação ao mapa, e as formações rochosas são o que a interrompe.

### 8.2 Água-viva Colossal — controle de espaço

640 de vida (eram 460, e 380 no protótipo). Flutua a 215 px do jogador e 55 px acima dele. **Três fases** (eram duas):
100–65%, 65–30% e abaixo de 30%. A barra de vida mostra as marcas, e a música sobe na terceira.
Os valores abaixo são [fase 1, fase 2, fase 3]; a cor dela muda a cada fase (verde-água, rosa,
dourado incandescente).

| Ataque | Aviso | Execução | Dano |
|---|---|---|---|
| Anel de esporos | 600 / 430 / 370 ms | 15 / 20 / 24 projéteis; 1 / 3 / 4 ondas, cada uma girada 0,22 rad | 11 / 12 / 13 |
| Raio giratório | 680 / 510 / 440 ms, linha de mira + seta de giro | a ponta estica a 620 px/s, depois varre a 0,9 / 1,0 / 1,1 rad/s | 16 / 16 / 18 |
| Sucção | 520 / 480 / 440 ms | 1100 ms puxando a 640 px/s² num raio de 330 px, um ferrão a cada 150 / 130 / 105 ms | 9 |
| **Onda de choque** (novo) | 760 / 640 / 540 ms | um anel que se expande a 270 px/s até 470 px, **com uma fresta** de 71° / 63° / 57° | 14 / 15 / 16 |
| **Chamado das medusinhas** (novo, fase 2+) | 850 / 750 / 650 ms | 2 / 2 / 3 medusinhas nos pontos marcados | — |
| **Farol** (novo, só fase 3) | 850 ms | 3 raios a 120° esticam a 820 px/s e giram juntos por 1,1 rad a 0,8 rad/s | 16 |

**Quebra da arena e movimento.** Na fase 1 ela faz o de sempre (paira acima do jogador) dentro da
arena fechada, a 80 px/s. **Ao entrar na fase 2 ela quebra a parede** (§7.2) e passa a **rondar**,
como o Olho: circula numa elipse de 330 px em volta de um ponto entre o centro do mapa e o
jogador (30% do caminho), recua se ele chegar a menos de 150 px e fica a 110 px das bordas. A
velocidade sobe por fase (80 / 110 / 130 px/s). O resultado é que ela deixa de ficar sempre acima
do jogador e ele precisa **dar a volta** nela.

Pausa entre ataques: 700 → 470 → 260 ms. Sorteio por fase: a 1 tem anel, raio, sucção e onda de
choque; a 2 troca a sucção por mais uma onda de choque e ganha o chamado; a 3 tem anel, raio,
sucção, chamado e, em dobro, onda de choque e farol.

**Onda de choque.** No aviso, a fresta aparece como um arco branco pulsando, com duas marcas, e o
sino contrai. A borda da fresta abre a 0,25–0,75 rad do jogador, então ele nunca começa dentro dela:
tem que nadar até a abertura (o anel chega em ~0,65 s), **atravessar o anel no dash** (a invulnerabilidade
cobre o cruzamento) ou **se esconder atrás de uma coluna de coral**, que para o anel como para o raio.

**Chamado.** As crias (medusinhas comuns, GDD §6.2) não soltam cura, ficam a no máximo 4 vivas e
**somem quando ela morre**. Os pontos de nascimento aparecem marcados durante o aviso e ficam a pelo
menos 48 px uns dos outros.

**Farol.** Cada raio varre só 63°, então entre os raios sobram cunhas seguras de 57° que giram com
eles. O aviso desenha as cunhas que serão varridas (em dourado fraco), e a rocha faz sombra nelas.
O jogador sempre começa dentro da varredura de um raio: tem que se mexer. Regra 3: 0,8 · 215 =
172 px/s, abaixo de 250.

**Combos.** Nas fases finais, a onda de choque (45% / 55%), o chamado (40% / 60%) e o farol (45%, só
na 3) podem emendar um anel de esporos com aviso de 320 ms, sem a pausa de pensar. Cada ataque do
combo ainda avisa.

As sete regras do raio (CONTEXTO §6.2) continuam valendo. A restrição **`ω · 215 px < 250 px/s`** é
dura: acima de ~1,16 rad/s o raio fica impossível de superar nadando (o máximo agora é 1,1: 237 px/s).

**Posição relativa medida** (jogador-robô): fase 1, a Água-viva fica acima do jogador em
100% do tempo (variação de ângulo 0,04); fase 2, 37% acima e 56% abaixo (0,57); fase 3, 42% / 53%
(0,40).

**Medido no M8 (`npm run balance`, jogador-robô, dano por minuto):** fase 1 ≈ 180 (era ≈ 140), fase 2
≈ 300 (era ≈ 200–250) e fase 3 ≈ 340–390 (nova). O Olho fica em ≈ 120–175 / 270–340 / 360–440 nas
suas três fases: a Água-viva agora tem o mesmo formato de subida. É um robô, e o número serve para
comparar com o antes, não para dizer se está justo.

**Visual (redesenhado depois do M8):** sino translúcido com borda de lóbulos, canais e gônadas por
dentro, tentáculos finos que afinam em ondas, braços orais franjados e um núcleo que incha em todo
aviso. Cada fase ganha tentáculos, uma aura mais forte e, da 2ª em diante, uma coroa de pontos de luz
(a cor continua mudando: verde-água, rosa, dourado). Só apresentação: os avisos dos ataques e todos
os números ficaram como estavam. Antes e depois em `docs/screenshots/jelly/`.

**No mapa novo:** as colunas de coral são a sombra do raio, do farol e da onda de choque (§7.2).

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
- **Revisado no M8, sem mudança:** o receio era que a invulnerabilidade do dash deixasse o cerco
  e a espiral fáceis demais. Medido com o jogador-robô (`npm run balance`; 12 sementes, 60 s por
  fase do chefe, vida do chefe travada em 90%, 50% e 20%), o dano por minuto **com** os 100 ms de
  invulnerabilidade ficou dentro de ±8% do dano **sem** ela, em todos os níveis de habilidade,
  inclusive num robô que usa o dash como escudo no instante exato do impacto (o teto do que a
  invulnerabilidade permite: −7% e −2%). A pressão sobe com a fase como deveria (do robô
  veterano, ~120, ~270 e ~360 de dano por minuto nas fases 1, 2 e 3). O dash tem recarga de
  1200 ms, então protege de um tiro a cada 1,2 s; não é uma ferramenta que apague o padrão. **Ressalva:**
  o robô joga pior que uma pessoa; um jogador que decora os padrões pode fazer mais com o dash.
  Se o Olho parecer fácil jogando, os candidatos continuam sendo mais projéteis no cerco e menos
  intervalo na espiral.
- **Pico de projéteis:** numa luta contra o Olho o robô viu até 159 projéteis vivos (fase 3), longe
  do teto de 900. O jogo segue em 60 fps mesmo com 640 projéteis vivos (Chrome e Edge).
- **Medido no M4:** travado atrás de um pilar por 60 s, o jogador leva ~137 de dano na fase 1 e
  ~274 na fase 2 no Fosso novo, contra 336 e 872 no protótipo (pilares sorteados). Os pilares
  desenhados protegem mais. Considerar junto com o ponto acima.

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
| Acerto da lança | baque grave e macio, sincronizado com o hit-stop (sem estalo agudo: acontece várias vezes por segundo) |
| Estocada carregada pronta | tom ascendente que para no máximo |
| Estourar projétil | "plop" agudo |
| Bloqueio do Ermitão | "tink" metálico |
| Dash | rajada de bolhas (ruído com filtro subindo) |
| Jogador ferido | baque abafado + tom descendente |
| Coletar cura | acorde curto ascendente |
| Aviso de ataque de chefe | um som por tipo de aviso, grave e reconhecível |
| Morte de inimigo | bolhas + tom curto |
| Morte do chefe | explosão grave longa |
| Menu | clique suave ao navegar e ao confirmar; outro, descendo, ao voltar |
| Pausa e continuar | varredura que abafa (desce) ao pausar e outra que abre (sobe) ao continuar |
| Cartão do mapa | uma nota longa e grave quando o nome do mapa aparece (a cada fase, inclusive ao tentar de novo) |
| Dash pronto de novo | um tique agudo, curto e baixo quando a recarga acaba. É o único som do estado do jogador além do dano e da morte |
| Onda limpa | sino ascendente (sol, ré, sol), mais grave e mais longo que o da cura |
| O chefe começa a lutar | golpe grave no fim da apresentação, onde o *riser* da entrada dele chega |
| Fase concluída | fanfarra curta (dó, mi, sol e o acorde), logo depois do estrondo da morte do chefe |
| Derrota | acorde menor que afunda, logo depois do baque da morte do jogador |
| Pilar que ruiu, rocha que lasca | estalo seco e baque curto de pedra; o da rocha é bem pequeno, porque o Olho o dispara muito |
| Sucção da Água-viva | uma lufada grave a cada bolha da corrente, com o corte subindo |
| Água da descida (§2.5) | o único som da cena: ruído filtrado que passa (o corte e o volume sobem com a velocidade do mergulhador, de um jorro na queda a um sopro calmo quando ele sai e nada), um rumor grave e bolhas que ficam mais frequentes quando ele acelera. Sem música, sem ambiente, sem sons de interface |

Todo som tem pequena variação aleatória de altura (±5%) para não cansar.

A entrada do chefe (`bossAppear`) ganhou um *riser*: ruído e um tom grave que sobem durante os
1,5 s da apresentação e terminam no golpe grave do início da luta. A fanfarra e a derrota esperam
o estrondo da morte começar, para não brigarem com ele.

Implementação (M7): além da tabela, tocam a morte do jogador, a entrada do chefe, a troca de fase
dele e a batida da investida numa formação. Só os **chefes** têm som de aviso (11 ao todo, um por
ataque); os avisos dos inimigos comuns são visuais. A "estocada carregada pronta" é um tom que
abre ao apertar o ataque, sobe durante os 600 ms da carga e corta quando a estocada sai.

### 10.2 Música (procedural)

- Uma música por mapa, com melodia própria: progressão de 8 compassos, tema, baixo e bateria
  escritos à mão (`config/music.ts`), escala e andamento próprios (mais consonante no Leito,
  mais dissonante no Fosso). Cada fase soa diferente do começo ao fim.
- **Camadas por intensidade, sem cortes bruscos** (a base, o pad e o pulso, nunca para):
  - **Ondas:** pad grave, pulso lento e o tema, suave e abafado.
  - **O chefe nasce** (entrada da apresentação dele): entram o baixo em movimento, a bateria
    e o tema do chefe, mais rápido, mais cheio e mais brilhante.
  - **Última fase do chefe:** o tema dobra uma oitava acima, entra o arpejo e a bateria enche.
- Cada trilha tem a sua personalidade:

| Trilha | Escala · andamento | Ondas | Chefe |
|---|---|---|---|
| Leito das Fendas | Sol dórico · 72 bpm | tema que desce devagar, pesado | bateria em meio-tempo, baixo em colcheias, tema em pergunta e resposta (as pinças) |
| Jardim de Corais | Lá lídio · 84 bpm | sinos que flutuam | síncope 3+3+3+3+4, como a água-viva se contraindo |
| Fosso do Abismo | Mi lócrio · 66 bpm | linhas que rastejam, segundas menores | bateria de coração (tum-tum), estocadas agudas fora do tempo (o olho) |

- Menu com uma música calma própria (pentatônica maior, só as ondas).
- A música do chefe responde na hora: o ganho das camadas sobe em ~1 s, dentro dos 1,5 s da
  apresentação do chefe.

### 10.2.1 Ambiente dos mapas

Por baixo da música, cada mapa tem o som da água do lugar: uma cama contínua de ruído cujo corte
oscila devagar (a água "respira"), às vezes um zumbido grave, e sons esporádicos sorteados (de
3 a 34 s de intervalo). Fica a cerca de um quarto do volume da música. O menu não tem ambiente.

| Mapa | Cama | Esporádicos |
|---|---|---|
| Leito das Fendas | rumor grave de pedra e correnteza | rocha que range, bolhas soltas, uma pedrinha |
| Jardim de Corais | água clara e macia | sinos nas notas do Lá lídio da música, bolhas agudas |
| Fosso do Abismo | grave quase inaudível, com um zumbido de mi e fá que bate | um chamado distante (dois, em alturas diferentes) e um brilho agudo de olho |

O ambiente toca no barramento dos **efeitos** (o controle de volume de efeitos o inclui) e muda
junto com a trilha: some em ~1 s ao trocar de mapa.

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
| **Fase concluída** | "FASE CONCLUÍDA" · segue (Descida, passando pela descida, §2.5) ou volta à seleção (Arena livre) |
| **Fim da Descida** | tempo total, mortes · *Menu* |

Toda troca de tela e de fase tem um **fade** curto (~300 ms). Nenhuma transição é instantânea.

Implementação (M6): a tela de derrota aparece 900 ms depois da morte (o jogador vê o que o
matou). Na Descida, "Tentar de novo" e "Tentar a fase de novo" reusam a semente da fase; um mapa
novo sorteia a sua. A sessão soma o tempo de todos os passos jogados (mortes incluídas, pausa
não) e as mortes. Depois do Olho, "Continuar" leva à tela final. `R` só reinicia na hora com a
depuração ligada.

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

Nenhuma bloqueia a v1. Decididas no M8 (2026-09-29):

1. **Cura:** 12 HP por bolha e as chances da tabela do §5 ficam. Ao longo das 3 ondas de um mapa
   as bolhas podem render de 71 a 82 HP (Leito 71, Coral 76, Fosso 82) se o jogador pegar todas;
   o jogador-robô, que joga pior que uma pessoa, chegou ao chefe com ~50 de vida. Sem jogar, mexer
   nisso seria chute.
2. **Mapas e inimigos exclusivos:** aprovados como estão (§6.2, §7.1, §7.2).
3. **Densidade do Olho com o dash invulnerável:** medida e mantida (§8.3).
4. **Onda 3 do Fosso (17 inimigos):** mantida. O teto de 6 vivos ao mesmo tempo segura o pico, e é
   a última fase antes do Olho. Se cansar jogando, o corte natural são as lampreias (8 → 5).
5. **Vida da Lampreia:** 18. Sobrevive a uma estocada sem carga (16) e morre na segunda; a estocada
   carregada a mata na hora.

**Adiadas para depois da v1:** rebalancear tudo isso com base em jogar de verdade, e um
jogador-robô melhor (o atual não vence as fases; ver ARCHITECTURE §10.2).
