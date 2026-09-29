# Abyss Arena

Jogo de ação 2D subaquático de arena: um mergulhador com uma lança enfrenta três ondas de
inimigos e depois um chefe, em três fases (Caranguejo → Água-viva → Olho). A física da água
(inércia e arrasto) e os ataques sempre avisados antes de acertar são o centro do jogo.

## Jogar

```
npm install
npm run dev        # servidor de desenvolvimento (abre no título)
npm run build      # build de produção em dist/ (caminhos relativos: funciona em qualquer subpasta)
npm run preview    # serve o dist/ para conferir
```

O jogo abre no título: **Descida** (Leito → Coral → Fosso, em sequência) ou **Arena livre**
(qualquer mapa). Nadar `WASD`, mirar com o mouse, estocar com o clique (segure para carregar),
dash com `Espaço`, pausa com `Esc`. `F1` liga o modo de depuração (hitboxes, atalhos como `B`, `N`
e `M` para ir direto a cada chefe).

## Desenvolver

```
npm run test       # Vitest: a lógica da simulação, os mapas, as cenas e o áudio
npm run typecheck  # tsc --noEmit
npm run balance    # bancada de equilíbrio: simulações sem tela que imprimem tabelas
```

## Documentos

- [`docs/GDD.md`](docs/GDD.md): o que o jogo é
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): como o código é organizado
- [`docs/ROADMAP.md`](docs/ROADMAP.md): ordem de construção e marco atual
- [`docs/CONTEXTO.md`](docs/CONTEXTO.md): registro do protótipo
- [`prototipo/index.html`](prototipo/index.html): o protótipo jogável (abra direto no navegador)

TypeScript (`strict`) + Vite + Canvas 2D + Web Audio, sem engine e sem dependências de execução.
