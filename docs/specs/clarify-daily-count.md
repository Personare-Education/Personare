# Spec — Uma unidade só para a contagem do dia

- **Branch:** `feature/clarify-daily-count`
- **Origem:** P1 da segunda crítica de design (`.impeccable/critique/2026-10-03T19-05-40Z__src.md`): Hoje
  dizia "3 revisões para hoje" (cards), a sessão "1 de 2" (atividades), o fim da sessão "2 itens
  revisados" e o fim do dia "4 revisões feitas hoje" (avaliações). Quem vê 3 e depois 2 se pergunta o
  que ficou para trás.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Decisão

A unidade pública é a **atividade**: é o que a sessão percorre e o que aparece como item em Hoje. Um
baralho é uma atividade; os cards dele aparecem só como detalhe.

## Critérios de aceite

1. **Hoje:** "2 atividades para hoje · 3 cards". O "· N cards" só aparece quando há baralhos com cards
   vencendo. "N atrasadas" conta atividades atrasadas.
2. **Barra lateral e cards de programa:** o número de Hoje e o "N para revisar" de cada programa contam
   atividades.
3. **Sessão:** "1 de 2" e a barra de progresso andam juntos: a barra mostra a posição atual
   (1 de 2 = 50%), e o fim da sessão diz "2 atividades revisadas".
4. **Fim do dia:** "N atividades revisadas hoje", contando cada atividade uma vez, mesmo com vários
   cards avaliados no mesmo baralho.
5. **Notificação da bandeja:** "Você tem N atividades para revisar hoje", contando o que vence até o fim
   do dia, como a tela Hoje.
6. **Próximos 7 dias:** cada dia conta as atividades que voltam nele, um baralho uma vez.
7. Textos em pt-BR e inglês.

## Escolhas técnicas

- `buildTodayQueue`: `dueCount` passa a contar atividades, `overdueCount` atividades atrasadas, e
  `dueCardCount` soma os cards de baralho que vencem.
- `countDueByProgram`: atividades distintas.
- `review.listActivityCounts` devolve também `activities` (atividades distintas avaliadas naquele dia
  e programa). O heatmap continua somando `count`; `countReviewedOn` soma `activities`.
- `countDueReviews` (bandeja): atividades distintas com revisão até o fim do dia de `now`.
