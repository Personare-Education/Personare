# Spec — Clique e menu de contexto nas linhas de Módulos e Atividades

- **Branch:** `feature/table-row-open-and-context-menu`
- **Pedido:** clicar na linha de um Módulo ou de uma Atividade abre o item; o botão direito mostra as
  ações possíveis daquela linha.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Módulo, clique na linha:** abre as atividades do módulo (`onNavigateToActivities`), igual ao botão
   "Ver atividades".
2. **Atividade, clique na linha:** executa a ação principal do tipo:
   - `link` abre a URL (`openExternalLink` + `onOpenLink`, que arma a Dialog de Dificuldade)
   - `pdf` abre o PDF (`onViewPdf`)
   - `quiz` começa o quiz (`onTakeQuiz`)
   - `flashcard_deck` inicia a revisão (`onStartReview`)
3. **Botão direito** em qualquer linha abre um menu de contexto com todas as ações da linha, na mesma
   ordem dos botões: as ações do tipo, depois Editar e Excluir (este com `variant="destructive"`).
4. Os botões de ação da linha continuam funcionando e **não** disparam o clique da linha.
5. A linha mostra `cursor-pointer` e pode ser aberta pelo teclado (foco + Enter).

## Escolhas técnicas

- Mesmo padrão do `programs-card-grid.tsx` (Issue #99): `ContextMenu` do shadcn, já instalado em
  `src/components/ui/context-menu.tsx`, envolvendo o elemento clicável.
- Em Atividades, as ações de cada tipo viram uma lista única (rótulo, ícone, handler) que alimenta os
  botões e o menu de contexto. A primeira é a ação principal do clique. Assim os três não divergem.
- A célula de ações interrompe a propagação do clique (`stopPropagation`), para os botões não
  dispararem também o clique da linha.
