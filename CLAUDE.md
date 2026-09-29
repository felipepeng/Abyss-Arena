# Abyss Arena

Jogo de ação 2D subaquático de arena. Um mergulhador armado com uma lança enfrenta 3 ondas de
inimigos e depois um chefe, tudo no mapa próprio desse chefe. São 3 fases (Caranguejo →
Água-viva → Olho), jogadas em sequência fixa ou escolhidas livremente. A física da água
(inércia e arrasto) e os ataques sempre telegrafados são o centro do jogo.

## Documentos

| Arquivo | Para quê |
|---|---|
| [`docs/GDD.md`](docs/GDD.md) | **O que** o jogo é: regras, fases, mapas, inimigos, chefes, números. Fonte de verdade de design. |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | **Como** o código é organizado: pastas, laço, dados, princípios. |
| [`docs/ROADMAP.md`](docs/ROADMAP.md) | **Em que ordem**: marcos, critérios de pronto, marco atual. |
| [`docs/CONTEXTO.md`](docs/CONTEXTO.md) | Registro histórico do protótipo, com todos os números originais e o porquê deles. |
| `prototipo/index.html` | O protótipo jogável. É a referência de comportamento na hora de portar. |

Antes de começar uma tarefa, veja no ROADMAP qual é o marco atual. Se uma decisão de design
mudar, atualize o GDD **na mesma tarefa**.

## Stack e comandos

TypeScript (`strict`) + Vite + Vitest, com Canvas 2D, Web Audio e sem engine:

```
npm run dev        # servidor de desenvolvimento
npm run build      # build de produção
npm run test       # Vitest
npm run typecheck  # tsc --noEmit
npm run balance    # bancada de equilíbrio (simulações que imprimem tabelas; fora do npm run test)
```

## Convenções

- **Unidades:** tempo em **ms**, velocidade em **px/s**, aceleração em **px/s²**, ângulo em
  **radianos**. Sufixe nomes ambíguos (`durationMs`, `speedPxS` só quando não for óbvio).
- **Idioma:** identificadores em inglês; comentários, docs e texto do jogo em português.
- **Formatação:** siga o estilo do código ao redor e comente o *porquê*, não o *o quê*.

## Regras invioláveis

1. **Todo número de ajuste mora em `src/config/`.** Nenhuma constante mágica de gameplay no
   meio da lógica.
2. **Todo ataque avisa antes de acertar.** Nenhum ataque, de nenhuma criatura, causa dano sem
   passar antes por um estado de aviso (`telegraph`) com sinal visual.
3. **Ataque rotacional obedece `ω · distância < 250 px/s`**, a velocidade máxima de nado. Se
   passar disso, o jogador não consegue fugir nadando. Deixe a conta como comentário no config.
4. **A simulação não sabe que o render existe.** Código em `src/sim/` não importa nada de
   `render/`, `audio/`, `fx/`, `ui/` ou `scenes/` e nunca usa `Math.random`; a comunicação é por
   eventos. Use a RNG com semente de `core/rng.ts`.
5. **Todo dano ao jogador passa por um funil único** (`sim/combat.ts`), que aplica a
   invulnerabilidade.
6. **Hit-stop só no acerto da lança em criatura.** Estourar projétil não dispara hit-stop.
7. **Os números de feel do protótipo não mudam sem motivo registrado.** Isso vale para nado,
   dash, tempos da lança, invulnerabilidade, hit-stop e empurrões. A única mudança aprovada até
   agora é a invulnerabilidade do dash (GDD §4.2).

## Portando do protótipo

- Porte o **comportamento e os números**, não a estrutura. As falhas do protótipo que não devem
  ser trazidas estão listadas em `docs/CONTEXTO.md` §7.4 e §9.
- Ao portar um sistema, compare lado a lado com o `prototipo/index.html`. O critério de pronto
  dos marcos do ROADMAP exige paridade de sensação.
