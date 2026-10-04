# Spec — A barra lateral mostra onde você está

- **Branch:** `fix/sidebar-current-page` (2 de 6 PRs empilhados, sobre `fix/rating-dialog-overflow`)
- **Origem:** P1 da quarta crítica de design: nenhum item da barra lateral marcava a página atual (o
  `isActive` nunca era passado), e dentro de um programa "Programas" não acendia. Com a barra recolhida, não
  havia pista nenhuma.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. O item da página atual fica destacado: **Hoje** só em `/`, **Programas** em `/programs` e em tudo abaixo
   (programa, módulo, atividades), **Calendário** em `/calendar`.
2. Só um item fica destacado por vez.
3. O destaque aparece também com a barra recolhida (o fundo do ícone).
