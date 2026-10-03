# Spec — Atividades e Módulos: menos painel de administração

- **Branch:** `feature/layout-tables`
- **Origem:** P1 da segunda crítica de design (`.impeccable/critique/2026-10-03T19-05-40Z__src.md`): colunas
  vazias nos baralhos mesmo depois de revisar, selo de revisão dentro da coluna Ações desalinhando os
  ícones, Excluir ao lado de Editar com o mesmo peso, linhas pulsando sem parar com uma faixa lateral de
  3px.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Baralhos com colunas preenchidas:** "Última avaliação" mostra a avaliação do card avaliado por
   último, nas palavras dos flashcards (Errei/Difícil/Bom/Fácil), e "Próxima revisão" a data do card
   que vence primeiro.
2. **Nada em branco:** sem nenhuma avaliação, "Última avaliação" diz "Ainda não avaliada".
3. **O selo de revisão sai da coluna Ações:** em Atividades, "Revisão hoje"/"Revisão atrasada" fica na
   coluna "Próxima revisão", no lugar da data relativa. Em Módulos, ao lado do nome. Os ícones de ação
   ficam alinhados entre as linhas.
4. **Uma ação principal por linha:** ficam visíveis só as ações do tipo (revisar, abrir, responder,
   gerenciar, ver atividades). **Editar** e **Excluir** vão para um menu **Mais ações** ("⋯"). O menu
   de clique direito continua com todas, na mesma ordem.
5. **Pulso com fim:** a linha com revisão pendente pulsa três vezes e para. A faixa lateral de 3px sai.
6. Textos em pt-BR e inglês.

## Escolhas técnicas

- `review.listActivityReviewState` devolve também uma linha por baralho do módulo, agregada dos cards:
  `dueDate` mínimo e o `lastRating` do card com o `lastReviewedAt` mais recente (vazio se nenhum foi
  avaliado), mais `scale: "flashcard"`.
- `RowAction.inMenu` manda a ação para o menu "⋯" do `ActionableTableRow`. O selo vira o componente
  `ReviewHighlightChip`, posto pela tabela onde faz sentido.
