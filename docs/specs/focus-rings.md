# Spec — Foco sempre visível

- **Branch:** `feature/focus-rings` (segundo de três PRs empilhados, sobre `feature/table-rating-scale`; o
  CHANGELOG fica no último)
- **Origem:** P1 da terceira crítica de design (`.impeccable/critique/2026-10-03T21-39-21Z__src.md`),
  avaliação B: anéis de foco translúcidos (`ring-ring/30` a `/50`, entre ~1,4:1 e ~2,0:1) eram o único
  indicador de foco em vários lugares, e botões sem estilo próprio dependiam do contorno global a ~2:1. O
  mínimo para um indicador de foco é 3:1.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Nenhum anel de foco translúcido:** o flashcard que gira, os cartões de Hoje, a alça de arrastar
   alternativas, as áreas de soltar arquivo e o menu de navegação usam o anel sólido no `--ring` (o azul da
   marca, ~4,5:1 no claro e ~4,0:1 no escuro).
2. **Botão destrutivo:** o foco usa o vermelho sólido, não a 20%/40%.
3. **Quem não tem estilo próprio também mostra foco:** um contorno sólido de 2px no `--ring`, afastado
   2px, para tudo que recebe foco pelo teclado (ícones e cores do formulário de programa, categorias de
   Configurações, controles da janela). Fica na camada base do CSS, então os componentes com estilo
   próprio continuam valendo.
4. **Regressão:** um teste varre `src/` e falha se voltar um anel de foco translúcido.
