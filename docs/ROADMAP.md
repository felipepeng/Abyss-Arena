# ROADMAP — Abyss Arena

Ordem de construção até a v1. Cada marco tem um **critério de pronto** verificável. Não se
começa um marco sem que o anterior esteja pronto, exceto quando indicado.

Design: [`GDD.md`](GDD.md) · Código: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Protótipo:
[`CONTEXTO.md`](CONTEXTO.md).

## Estado atual

**Marco atual: M6 — Menus e fluxo de jogo** (não iniciado). M3, M4 e M5 implementados; falta jogá-los à mão.
M0 pronto em 2026-09-29. M1 e M2 implementados em 2026-09-29, com paridade numérica provada
contra o código do protótipo; falta o teste lado a lado de quem joga (ver cada marco).
O protótipo está em `prototipo/index.html`. Ele é a referência de paridade do M1 em diante.

Legenda: ⬜ não iniciado · 🟨 em andamento · ✅ pronto

---

## ✅ M0 — Fundação

Infraestrutura sem gameplay.

- [x] Projeto Vite + TypeScript `strict` (`noUnusedLocals`, `noUnusedParameters`) + Vitest.
- [x] Scripts `dev`, `build`, `test` e `typecheck`.
- [x] Canvas interno de 960 × 540, escalado com letterbox.
- [x] `core/loop.ts`: passo fixo de 60 Hz, teto de 100 ms, alpha de interpolação, gancho de
      hit-stop.
- [x] `core/rng.ts` com semente; `core/math.ts`; `core/pool.ts` com swap-remove.
- [x] `core/input.ts`: teclado e mouse → ações; mouse em coordenadas de tela.
- [x] `core/events.ts`: buffer de eventos por passo.
- [x] Gerenciador de cenas mínimo com fade.
- [x] Overlay de depuração com FPS e a semente (`F1`).

**Pronto quando:** `npm run dev` abre uma tela que mostra FPS e a ação ativa de cada tecla;
`npm run test` passa com testes de `rng` (determinismo) e `pool`; `npm run typecheck` e
`npm run build` limpos.

---

## 🟨 M1 — Feel do jogador

Portar o que o protótipo tem de mais valioso, com **paridade de sensação**.

- [x] `sim/physics.ts`: integrador de nado com arrasto implícito e teto.
- [x] `world/grid.ts` + `sim/collision.ts`: separação por eixo com margem, sub-passos, invariante.
- [x] Arena de teste simples (borda + alguns blocos), sem `MapDef` ainda.
- [x] Jogador: nado, dash **com invulnerabilidade nos primeiros 100 ms**, lança nas 3 fases,
      carga, hitbox em dois círculos.
- [x] Câmera com look-ahead, em mundo maior que a tela.
- [x] Render: jogador e lança como no protótipo, interpolação, fundo e rocha em cache.
- [x] FX: bolhas, tremor, hit-stop. Um alvo parado (saco de pancada) para testar o impacto.
- [x] Testes de nado, dash, lança e colisão (ARCHITECTURE §10.2).

**Pronto quando:** jogado lado a lado com `prototipo/index.html`, o nado, o dash, a estocada e
o impacto no saco de pancada são indistinguíveis, **exceto** pela invulnerabilidade do dash e
pela suavização do degrau do clamp (se for adotada). Os testes numéricos batem com o CONTEXTO
(267 ms até 250 px/s, ~70 px de deslizada, ~82 px de dash).

**Estado (2026-09-29):** a parte numérica está feita. Nado, dash, lança com e sem carga, dash
cancelando a recuperação e o acerto num peixe batem com o **código do protótipo** passo a passo
(`tests/sim/parity.test.ts`). A suavização do degrau do clamp **não** foi adotada. Falta o teste
lado a lado, que só quem joga pode fazer: `npm run dev` de um lado e `prototipo/index.html` do
outro.

---

## 🟨 M2 — Inimigos e combate

- [x] `EnemyDef` + runner genérico (movimento, colisão, contato, morte, drop).
- [x] Peixe e circulador portados para dados, com os mesmos números.
- [x] `sim/combat.ts`: funil de dano ao jogador, dano a inimigo, empurrão por raio, recuo.
- [x] Pool de projéteis (teto de 900), estouro pela lança, erosão com máscara de protegidos.
- [x] Pickups de cura (GDD §5).
- [x] Avisos visuais dos dois inimigos.
- [x] Morte do jogador (sem menu ainda: tecla de reinício de depuração).
- [x] Overlay de depuração: hitboxes e estados.

**Pronto quando:** na arena de teste, com um spawner provisório, peixes e circuladores se
comportam como no protótipo (serpenteio, órbita, avisos, investidas); acertar dispara os cinco
efeitos de impacto; a cura cai, atrai e cura; nenhuma alocação por passo aparece no profiler
com 100+ projéteis.

**Estado (2026-09-29):**
- Peixe e circulador batem com o **código do protótipo** passo a passo em 7 cenários (IA,
  avisos, ataques, contato, funil de dano, invulnerabilidade, morte), com os sorteios fixados
  dos dois lados.
- Cura: cai, sobe, é atraída e cura (testes). O desenho dela ainda não foi visto em jogo.
- Alocação: medida no Chrome com o profiler de heap. O passo **não aloca por projétil** (teste
  com 0 contra 300). Sobram alguns bytes por criatura por passo, do V8 empacotando números
  passados entre funções; a decisão e o que foi corrigido estão no ARCHITECTURE §5.2.
- Diferença proposital do protótipo: um inimigo morto pela lança não age mais no passo em que
  morre (no protótipo ele ainda podia causar dano de contato naquele passo).
- Falta o teste lado a lado de quem joga.

---

## 🟨 M3 — Fluxo de fase + Caranguejo

A primeira fase completa, de ponta a ponta.

- [x] `MapDef` + `world/builder.ts` (layout ASCII + procedural com semente só em `~`).
- [x] **Leito das Fendas** desenhado (GDD §7.1), com paleta, zonas de nascimento e posições
      de ouriço (os ouriços entram no M5; as posições já ficam marcadas).
- [x] `sim/phase.ts`: intro → 3 ondas → interlúdios → entrada do chefe → chefe →
      concluída / falhou.
- [x] Spawner de onda: fila, teto de 6, 600 ms, aviso de 500 ms.
- [x] `BossDef` + `AttackDef` + runner de chefe genérico.
- [x] **Caranguejo** portado para dados: investida, pinça, chamado, fase 2, investida dupla.
- [x] HUD: vida, recarga do dash, contador de onda, barra do chefe com marca de fase, seta
      fora da tela.
- [x] Cartão de título (versão simples) e textos de onda.
- [x] Reiniciar a fase com a mesma semente ao morrer.
- [x] Testes: máquina da fase, determinismo do mapa, sorteio com reroll.

**Pronto quando:** dá para jogar a fase inteira do Leito das Fendas, das ondas à morte do
Caranguejo; morrer reinicia na onda 1 com o mesmo mapa; o Caranguejo se comporta como no
protótipo e a investida bate nas formações.

**Estado (2026-09-29):**
- O Caranguejo bate com o **código do protótipo** passo a passo em 3 cenários (jogador parado,
  jogador nadando com o chamado, fase 2 com a investida dupla), com a mesma sequência
  aleatória dos dois lados.
- A fase inteira roda nos testes (intro → 3 ondas → chefe → concluída; `failed` de qualquer
  estado) e a investida bate nas formações do Leito.
- As ondas têm só peixes e circuladores até o M5 (ermitão e ouriço); as posições dos ouriços
  estão marcadas em `RIFT_URCHIN_SPOTS`.
- Sem a rede "parado 1,5 s → recoloca" do protótipo: com a colisão nova ela não é necessária.
  O deslize tangencial na parede ficou, porque é comportamento do chefe, não conserto.
- Falta jogar a fase inteira à mão, das ondas à morte do Caranguejo.

---

## 🟨 M4 — Água-viva e Olho

- [x] **Jardim de Corais** (GDD §7.2): layout, colunas de coral, tocas marcadas, paleta.
- [x] **Água-viva** portada: anel, raio (com os subestágios `extend`/`sweep` e as 7 regras),
      sucção, fase 2.
- [x] Medir a cobertura do raio (direções cortadas antes de 300 px) e ajustar o layout para a
      faixa de 35 a 50 em 64.
- [x] **Fosso do Abismo** (GDD §7.3): anel de pilares desenhado, dissolução por fase, erosão
      só por projéteis do Olho.
- [x] **Olho** portado: leque, espiral, cerco, perseguidores, chuva, 3 fases, reações do
      `onPhaseEnter`.
- [x] Teste: `ω · hoverDist < 250` para todo ataque rotacional.

**Pronto quando:** as três fases são jogáveis do começo ao fim (só com peixe e circulador nas
ondas); o harness do "jogador atrás do pilar" no Olho dá números da mesma ordem do protótipo
(CONTEXTO §6.3).

**Estado (2026-09-29):**
- Água-viva e Olho batem com o **código do protótipo** passo a passo em 6 cenários (anel, raio
  esticando e varrendo, sucção, fase 2; leque em salvas, espiral, cerco, perseguidores, as 3
  fases), com a mesma sequência aleatória dos dois lados. Mutações de 1–2% em giro da espiral,
  varredura e ponta do raio e intervalo do leque são detectadas.
- Cobertura do raio no Jardim de Corais: **~38 de 64** direções cortadas antes de 300 px (faixa
  pedida: 35–50). Corredores ≥ 80 px com os galhos, conferido em 8 sementes.
- Harness "jogador travado atrás de um pilar por 60 s" no Fosso: **~137 de dano na fase 1 e
  ~274 na fase 2** (média de 3 sementes), contra 336 e 872 no protótipo. Mesma ordem de
  grandeza, e a fase 2 bem pior que a 1, mas o Fosso novo protege 2,5–3× mais. Entra no
  balanceamento do Olho no M8 (GDD §8.3).
- Achado da paridade: a rede "parado 1,5 s → recoloca" do protótipo dispara em toda luta da
  Água-viva e do Olho (depois de cada ataque longo e ancorado) e empurra o chefe ~10 px. O jogo
  novo não tem essa rede, então esse tremor sumiu.
- Projéteis e inimigos agora são percorridos na ordem de criação, com remoção estável: dois
  projéteis que acertam no mesmo passo empurram o jogador para o lado do primeiro, como no
  protótipo.
- As ondas do Coral e do Fosso têm só peixes e circuladores até o M5.
- Falta jogar as duas fases à mão.

---

## 🟨 M5 — Inimigos exclusivos

- [x] Ermitão (blindagem frontal com bloqueio e sem hit-stop).
- [x] Ouriço (estático, rajada de espinhos).
- [x] Medusinha (à distância, com linha de visão).
- [x] Enguia (toca, invulnerável escondida, bote telegrafado).
- [x] Vigia (leque de 3 tiros, com linha de visão).
- [x] Lampreia (enxame).
- [x] Composição final das ondas dos 3 mapas (GDD §3.2).
- [x] Novas cores de projétil e partículas (GDD §9.1).

**Pronto quando:** as três fases rodam com a composição de ondas do GDD; cada inimigo novo tem
aviso visível no overlay de depuração (estado marcado como `telegraph`) antes de todo ataque.

**Estado (2026-09-29):**
- Os seis inimigos e as ondas do GDD §3.2 estão nos três mapas. `tests/sim/exclusive.test.ts`
  cobre o bloqueio do Ermitão (sem dano nem hit-stop, e o dano pelas costas), a enguia
  (invulnerável escondida, o bote e a volta), os espinhos (8, sumindo a 110 px), a linha de visão
  (Medusinha e Vigia não atiram atrás de parede), o leque de 3 tiros, o dano de contato de cada
  um, a Lampreia (sobrevive a uma estocada sem carga) e a composição das ondas.
- A regra 2 é testada por criatura: cada ataque sai depois do aviso inteiro (450, 500, 600, 450,
  500 e 300 ms). Os seis têm estado `telegraph` no overlay de depuração.
- Ouriços e enguias ocupam posições fixas (`MapDef.markers.fixedEnemies` e `eelDens`), sem rocha
  em cima em qualquer semente (o construtor protege o entorno delas do procedural).
- O GDD ganhou a seção "Como o M5 preencheu o que este documento deixava aberto" e a correção do
  contato da Enguia (13 / 7, pela regra do §4.4).
- Falta jogar as três fases à mão, e o balanceamento das ondas (a onda 3 do Fosso tem 17
  inimigos) fica para o M8.

---

## ⬜ M6 — Menus e fluxo de jogo

- [ ] Título com fundo animado.
- [ ] **Descida:** Leito → Coral → Fosso, com a sessão (tempo, mortes) e a tela final.
- [ ] **Arena livre:** seleção dos 3 mapas, todos liberados.
- [ ] Pausa (`Esc`/`P`): continuar, tentar de novo, áudio, sair.
- [ ] Telas de derrota e de fase concluída.
- [ ] Cartões de título finais, com a frase de cada mapa.
- [ ] Controles.
- [ ] Fades em todas as transições.

**Pronto quando:** dá para abrir o jogo e jogar a Descida inteira, ou qualquer fase na Arena
livre, sem tocar em tecla de depuração, e toda transição tem fade.

---

## ⬜ M7 — Áudio sintetizado

- [ ] `audio/engine.ts`: contexto criado no primeiro gesto, barramentos de música e efeitos.
- [ ] Todos os efeitos do GDD §10.1, disparados por eventos da simulação.
- [ ] `MusicSource` procedural com camadas de intensidade; uma trilha por mapa e uma do menu.
- [ ] Controles de volume (música e efeitos) no título e na pausa.

**Pronto quando:** todo evento da lista do GDD §10.1 tem som; a música muda de intensidade das
ondas para o chefe e para a última fase dele sem corte; o volume funciona; o hit-stop não
engasga o áudio.

---

## ⬜ M8 — Polimento e balanceamento → **v1**

- [ ] Rever o Olho com o dash invulnerável (GDD §8.3). Medir antes e depois.
- [ ] Balancear a cura: medir o HP médio na chegada a cada chefe.
- [ ] Ajustar a composição das ondas (a onda 3 do Fosso em especial) e a vida da Lampreia.
- [ ] Decidir e registrar no GDD o que ficou das propostas 🟡.
- [ ] Revisar as questões em aberto do GDD §13.
- [ ] Desempenho: 60 FPS estáveis no pico de projéteis do Olho.
- [ ] Build de produção testado em Chrome, Firefox e Edge.

**Pronto quando:** a Descida pode ser vencida por um jogador que conhece os padrões, sem
depender de sorte; o GDD §13 está vazio ou só com itens explicitamente adiados para depois da
v1; build publicada.

---

## Depois da v1

Sem ordem definida:

- Melhorias escolhíveis entre ondas e fases (definir a moeda, os drops e a tela de escolha).
- Salvamento: fases desbloqueadas, configurações, recordes.
- Música em arquivo (nova implementação de `MusicSource`).
- Remapeamento de teclas e suporte a controle.
- Localização.
- Telemetria de mortes (onde e por quê).
- Novos mapas e chefes.
