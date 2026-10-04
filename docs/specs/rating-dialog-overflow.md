# Spec — Os botões de avaliação cabem no diálogo

- **Branch:** `fix/rating-dialog-overflow` (1 de 6 PRs empilhados; o CHANGELOG fica no último)
- **Origem:** P1 da quarta crítica de design (`.impeccable/critique/2026-10-04T18-29-15Z__src.md`): no diálogo
  de avaliação da atividade, "Fácil demais 4" passava da borda direita e a dica "4" era cortada. Eram quatro
  botões numa linha que não quebra, num diálogo de 384px; em português e com o texto "Maior", pior.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. O diálogo de avaliação da atividade fica mais largo (`sm:max-w-lg`).
2. Os quatro botões ficam numa grade de 4 colunas da largura do diálogo, que vira 2×2 quando a largura não
   dá. Nenhum botão passa da borda, em inglês ou em português, em qualquer tamanho de texto.
