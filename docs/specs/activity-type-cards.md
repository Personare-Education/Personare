# Spec — Tipo de atividade em cards 2×2

- **Branch:** `feature/activity-type-cards`
- **Pedido:** na Dialog de criar/editar Atividade, trocar o combo box do tipo por uma grade de cards
  2×2, cada um com um ícone do lucide centralizado e o nome do tipo embaixo.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. O campo "Tipo" é um grupo de rádio (`role="radiogroup"`) rotulado por "Tipo", com um card por tipo
   (`link`, `quiz`, `pdf`, `flashcard_deck`) numa grade de 2 colunas.
2. Cada card mostra um ícone do lucide centralizado e, abaixo, o nome traduzido do tipo, que também é o
   nome acessível do card.
3. Clicar num card seleciona o tipo. Os campos condicionais (URL para Link, arquivo para PDF) seguem o
   tipo selecionado.
4. Criar começa com `link` selecionado; editar começa com o tipo da atividade.
5. Não existe mais combo box de tipo.

## Escolhas técnicas

- Padrão do exemplo `c-radio-group-7` do ReUI (grupo de rádio em que cada item é um card), montado
  sobre o `RadioGroup` do shadcn já instalado, sem dependência nova: cada card **é** o
  `RadioGroupPrimitive.Item` do Radix, então setas do teclado, foco e leitor de tela funcionam sem
  código extra.
- Ícones iguais aos das ações da tabela para cada tipo: `Link`, `ListChecks` (quiz), `FileText` (PDF)
  e `Layers` (flashcards).
- Card selecionado: borda `primary` e fundo `primary/10`.

## Testes (TDD)

- `activity-form-dialog.test.tsx`: grupo rotulado com os 4 cards, ícone em cada card, seleção padrão
  (criar e editar), clique troca o tipo e os campos condicionais, envio com o tipo escolhido, sem
  combo box.
- e2e: os fluxos que criavam um Quiz pelo combo box passam a clicar no card.
