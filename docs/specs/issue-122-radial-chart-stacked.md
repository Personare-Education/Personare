# Spec — Issue #122: Radial Chart Stacked no resultado do Quiz

- **Issue:** #122 — "Gráfico do ShadcnUI não renderizando por mais que tenha sido implementando previamente".
- **Branch:** `fix/122-radial-chart-stacked`
- **Motivação:** a issue pede o **Radial Chart - Stacked** do shadcn acima das métricas de tempo. O #125
  corrigiu o 0 × 0 do anel de valor único (`RadialChartText`, da #93), mas não trocou a variante.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Decisões do usuário:** verde para acertos, vermelho para erros; a porção verde começa na esquerda
  e cresce para a direita; pontuação máxima de 1000.

## Critérios de aceite

1. O resultado do Quiz mostra um semicírculo empilhado, com acertos (verde) e erros (vermelho),
   acima das métricas de tempo.
2. A primeira seção (acertos) começa na ponta esquerda.
3. O centro mostra a pontuação de 0 a 1000 (`round(acertos / total × 1000)`) e "de 1000 pontos".
   A frase "X de Y corretas" passa para a lista de métricas, acima dos tempos.

## Escolhas técnicas

- **`RadialChartStacked` (novo, genérico)** substitui o `RadialChartText`, que só era usado aqui.
  Recebe `segments` (`key`, `label`, `value`, `color`), segue o exemplo oficial do shadcn
  (`chart-radial-stacked`) e inclui o tooltip.
- **`startAngle={180}` / `endAngle={0}`**: o Recharts mede ângulos no sentido anti-horário a partir das
  3 h; 180 → 0 desenha da esquerda para a direita.
- **`PolarAngleAxis` com `domain={[0, total]}`**: sem ele, o Recharts escala o ângulo pelo maior valor
  individual, e não pela soma empilhada. Com 1 acerto e 1 erro, o verde ocupava 180° e o vermelho
  ficava fora da escala (tamanho 0).
- **Token `--success`** em `global.css` (claro: green-600, escuro: green-500, os mesmos valores do
  Tailwind v4), no padrão do `--destructive`, já usado para erros.
- **`w-full max-w-[250px]`** mantém a largura explícita do #125. **`-mb-24`** recorta a metade
  inferior vazia do quadrado sob o semicírculo.

## Testes (TDD)

- `radial-chart-stacked.test.tsx` (novo, substitui `radial-chart-text.test.tsx`): textos do centro;
  uma camada por seção.
- `quiz-runner-dialog.test.tsx`: pontuação `1000`/`500` no lugar de `100%`/`50%`, e "de 1000 pontos".
- e2e `quiz-result-chart.test.ts`: duas perguntas (uma certa, uma errada), exige `500`, as duas
  seções e tamanho visível em cada uma. Sem o `domain`, a seção vermelha mede 0 e o teste falha.
