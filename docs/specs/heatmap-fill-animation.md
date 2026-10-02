# Spec — Animação de preenchimento do heatmap

- **Branch:** `feature/heatmap-fill-animation`
- **Pedido:** o heatmap de frequência dos cards de programa ganha a mesma animação do site
  (`personare-website/src/components/study-heatmap.tsx` e `src/styles.css`).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## A animação do site

Cada célula começa como um dia vazio (`--heatmap-empty-cell`) e um pouco menor (`scale(0.82)`) e
ganha a sua cor, numa cascata coluna por coluna: atraso `coluna × 45ms + linha × 12ms + 150ms`,
900ms com `cubic-bezier(0.16, 1, 0.3, 1)`. Toca uma vez, ao carregar.

## Critérios de aceite

1. As células do `ActivityHeatmap` "preenchem" com a mesma animação do site (mesmos tempos e curva).
   A cor e a opacidade de cada nível continuam as do app.
2. A cascata vai **do dia mais recente para o mais antigo**: começa na última semana (à direita,
   a parte que o card mostra, já que o heatmap rola até o fim) e, dentro de cada semana, do último
   dia para o primeiro.
3. A animação toca **quando as contagens chegam**. Um heatmap ainda sem dados não anima, e uma
   atualização posterior dos dados (outra revisão feita) não repete a animação.
4. Com `prefers-reduced-motion: reduce`, não há animação.

## Escolhas técnicas

- CSS em `src/styles/global.css`: `@keyframes heatmap-cell-fill` e a classe `.heatmap-cell`, que lê
  `--col` e `--row` de cada célula.
- O componente passa `--col` como a distância da semana até a mais recente e `--row` como a
  distância do dia até o último da semana: o atraso cresce com a idade do dia.
- As células só ganham `.heatmap-cell` quando há contagens. O grupo de células é remontado (por
  `key`) só na passagem de "sem dados" para "com dados", e é isso que faz a animação tocar uma vez.
