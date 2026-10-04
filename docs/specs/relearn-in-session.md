# Spec — O card de "Errei · 1 minuto" volta na sessão

- **Branch:** `fix/relearn-in-session` (1 de 5 PRs empilhados, sobre `main`)
- **Origem:** P1 da quinta crítica de design: cada botão mostra quando o card volta ("Errei · 1 minuto",
  "Difícil · 10 minutos"), mas a sessão descartava o card avaliado e terminava em "Tudo revisado". O intervalo
  mostrado é o raciocínio do agendamento à vista (princípio 4 do PRODUCT.md); prometer 1 minuto e não cumprir
  quebra a confiança nele. O usuário escolheu cumprir: o card volta na mesma sessão.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Ao avaliar um card, se o novo vencimento cai dentro de **20 minutos** (os passos curtos do FSRS: 1 e 10
   minutos), o card volta para o **fim da fila** da sessão, com o agendamento novo.
2. Um card que vence mais tarde (dias, ou horas) sai da sessão, como antes.
3. Enquanto a sessão tem cards, ela diz quantos faltam: "2 cards restantes" (contando os que voltaram).
4. A sessão só termina quando nenhum card voltou para a fila; o fim ("Tudo revisado", e a passagem para o
   próximo item na sessão de Hoje) continua igual.
5. A contagem de cards revisados no fim continua contando cada card uma vez.

## Escolhas técnicas

- `submitRating` já devolve o item com o `dueDate` novo; `FlashcardReviewPanel` decide com
  `returnsThisSession(dueDate, now)` (janela de 20 minutos, como o "aprender adiantado" do Anki: o card volta
  mesmo que ainda falte um pouco para vencer, já que esperar parado não ajuda ninguém).
