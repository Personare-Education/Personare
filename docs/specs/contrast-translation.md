# Spec — Pequenos ajustes de contraste e tradução

- **Branch:** `fix/contrast-translation` (6 de 6 PRs empilhados, sobre `feature/organize-identity`; leva o
  CHANGELOG dos seis)
- **Origem:** observações menores da quarta crítica de design: textos e alvos pequenos que ficavam abaixo do
  mínimo, e um rótulo em inglês para leitores de tela em português.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. A dica de tecla (`KeyHint`) chega a 4,5:1 também dentro do botão azul principal (antes ~3,6:1, pela
   opacidade de 70%): opacidade de 90% ou mais.
2. "Ainda vazio", na face vazia do flashcard do editor, usa o texto em 75% do primeiro plano, como os outros
   textos sobre a cor do programa (antes ~4,2:1 em cinza).
3. O selo "atrasado" dos cartões de Hoje usa `--destructive-text`, como o da tabela (antes ~3,8:1).
4. Os botões de mês da sequência têm 24px (`icon-sm`), o alvo mínimo (antes 20px).
5. O botão de fechar dos diálogos e da folha lateral diz "Fechar" em português (antes "Close" sempre).
