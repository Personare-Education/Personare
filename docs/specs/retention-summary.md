# Spec — "Sua memória": o quanto o aluno lembrou, ao lado da meta

- **Pedido do usuário (2026-10-09):** seguir com as melhorias da revisão do projeto. Sexta frente: o aluno
  escolhe a meta de retenção (docs/specs/desired-retention.md), mas não via o quanto de fato lembrava.
  Princípio 4 do `PRODUCT.md`: mostrar o raciocínio do sistema.
- **Branch:** `feature/painel-retencao`, empilhada sobre `feature/retencao-alvo`.
- **Sem métricas inventadas:** tudo sai do histórico de avaliações do próprio aluno, na máquina dele.

## Critérios de aceite

1. **O cálculo** (`computeRetention`): nos últimos 30 dias, entre as avaliações que testaram a memória, a
   parte que não foi "De novo". Não contam a primeira avaliação de um item (ainda não havia o que
   lembrar) nem uma avaliação a menos de 12 h da anterior do mesmo item (a mesma sessão, como um flashcard
   reaprendido). Um histórico ilegível é ignorado.
2. **IPC:** `review.retentionStats` devolve `{ attempts, remembered, desiredRetention }`.
3. **Hoje, com o dia concluído:** abaixo de "Próximos 7 dias", a seção **Sua memória** mostra a
   porcentagem lembrada, sobre quantas revisões, uma barra com a meta marcada e "Sua meta é N%". Com menos
   de 20 revisões no período (pouco para dizer algo) ou sem os números, a seção não aparece.
4. Os textos novos existem nos nove idiomas, com as formas de plural de cada um.
