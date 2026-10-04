# Spec — Tamanho do texto nas Configurações

- **Branch:** `feature/text-size`
- **Pedido:** alguns usuários do beta acham a fonte pequena demais. Uma opção nas Configurações para
  aumentar e diminuir o texto.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Em **Configurações → Geral**, a seção **Tamanho do texto** tem quatro opções: **Pequeno** (90%),
   **Padrão** (100%), **Grande** (112,5%) e **Maior** (125%). A escolhida fica marcada.
2. Escolher uma opção muda o texto do app inteiro na hora, junto com os espaçamentos, sem quebrar o
   layout.
3. A escolha fica salva no computador e vale ao abrir o app de novo. Sem escolha salva, é Padrão.
4. Textos em pt-BR e inglês.

## Escolhas técnicas

- O tamanho é o `font-size` da raiz (`<html>`). Quase tudo no app é em `rem` (o Tailwind e os tamanhos
  próprios), então texto e espaçamentos escalam juntos.
- `src/actions/text-size.ts`: `TEXT_SIZES`, `getTextSize`, `setTextSize` e `applySavedTextSize`, salvo no
  `localStorage` (`LOCAL_STORAGE_KEYS.TEXT_SIZE`), como o tema. `applySavedTextSize` roda ao abrir o app.
- `TextSizeToggle`: um `ToggleGroup` como o de idioma.
