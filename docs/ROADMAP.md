# ROADMAP — Abyss Arena

Ordem de construção até a v1. Cada marco tem um **critério de pronto** verificável. Não se
começa um marco sem que o anterior esteja pronto, exceto quando indicado.

Design: [`GDD.md`](GDD.md) · Código: [`ARCHITECTURE.md`](ARCHITECTURE.md) · Protótipo:
[`CONTEXTO.md`](CONTEXTO.md).

## Estado atual

**Marco atual: M1 — Feel do jogador** (🟨 implementado; falta o teste lado a lado de quem joga).
M0 pronto em 2026-09-29.
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

## ⬜ M2 — Inimigos e combate

- [ ] `EnemyDef` + runner genérico (movimento, colisão, contato, morte, drop).
- [ ] Peixe e circulador portados para dados, com os mesmos números.
- [ ] `sim/combat.ts`: funil de dano ao jogador, dano a inimigo, empurrão por raio, recuo.
- [ ] Pool de projéteis (teto de 900), estouro pela lança, erosão com máscara de protegidos.
- [ ] Pickups de cura (GDD §5).
- [ ] Avisos visuais dos dois inimigos.
- [ ] Morte do jogador (sem menu ainda: tecla de reinício de depuração).
- [ ] Overlay de depuração: hitboxes e estados.

**Pronto quando:** na arena de teste, com um spawner provisório, peixes e circuladores se
comportam como no protótipo (serpenteio, órbita, avisos, investidas); acertar dispara os cinco
efeitos de impacto; a cura cai, atrai e cura; nenhuma alocação por passo aparece no profiler
com 100+ projéteis.

---

## ⬜ M3 — Fluxo de fase + Caranguejo

A primeira fase completa, de ponta a ponta.

- [ ] `MapDef` + `world/builder.ts` (layout ASCII + procedural com semente só em `~`).
- [ ] **Leito das Fendas** desenhado (GDD §7.1), com paleta, zonas de nascimento e posições
      de ouriço (os ouriços entram no M5; as posições já ficam marcadas).
- [ ] `sim/phase.ts`: intro → 3 ondas → interlúdios → entrada do chefe → chefe →
      concluída / falhou.
- [ ] Spawner de onda: fila, teto de 6, 600 ms, aviso de 500 ms.
- [ ] `BossDef` + `AttackDef` + runner de chefe genérico.
- [ ] **Caranguejo** portado para dados: investida, pinça, chamado, fase 2, investida dupla.
- [ ] HUD: vida, recarga do dash, contador de onda, barra do chefe com marca de fase, seta
      fora da tela.
- [ ] Cartão de título (versão simples) e textos de onda.
- [ ] Reiniciar a fase com a mesma semente ao morrer.
- [ ] Testes: máquina da fase, determinismo do mapa, sorteio com reroll.

**Pronto quando:** dá para jogar a fase inteira do Leito das Fendas, das ondas à morte do
Caranguejo; morrer reinicia na onda 1 com o mesmo mapa; o Caranguejo se comporta como no
protótipo e a investida bate nas formações.

---

## ⬜ M4 — Água-viva e Olho

- [ ] **Jardim de Corais** (GDD §7.2): layout, colunas de coral, tocas marcadas, paleta.
- [ ] **Água-viva** portada: anel, raio (com os subestágios `extend`/`sweep` e as 7 regras),
      sucção, fase 2.
- [ ] Medir a cobertura do raio (direções cortadas antes de 300 px) e ajustar o layout para a
      faixa de 35 a 50 em 64.
- [ ] **Fosso do Abismo** (GDD §7.3): anel de pilares desenhado, dissolução por fase, erosão
      só por projéteis do Olho.
- [ ] **Olho** portado: leque, espiral, cerco, perseguidores, chuva, 3 fases, reações do
      `onPhaseEnter`.
- [ ] Teste: `ω · hoverDist < 250` para todo ataque rotacional.

**Pronto quando:** as três fases são jogáveis do começo ao fim (só com peixe e circulador nas
ondas); o harness do "jogador atrás do pilar" no Olho dá números da mesma ordem do protótipo
(CONTEXTO §6.3).

---

## ⬜ M5 — Inimigos exclusivos

Pode começar em paralelo ao M4, depois que o M3 estiver pronto.

- [ ] Ermitão (blindagem frontal com bloqueio e sem hit-stop).
- [ ] Ouriço (estático, rajada de espinhos).
- [ ] Medusinha (à distância, com linha de visão).
- [ ] Enguia (toca, invulnerável escondida, bote telegrafado).
- [ ] Vigia (leque de 3 tiros, com linha de visão).
- [ ] Lampreia (enxame).
- [ ] Composição final das ondas dos 3 mapas (GDD §3.2).
- [ ] Novas cores de projétil e partículas (GDD §9.1).

**Pronto quando:** as três fases rodam com a composição de ondas do GDD; cada inimigo novo tem
aviso visível no overlay de depuração (estado marcado como `telegraph`) antes de todo ataque.

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
