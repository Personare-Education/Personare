# Spec — Avaliações que dizem o que fazem

- **Branch:** `feature/clarify-ratings` (sobre `feature/today-review-queue`)
- **Origem:** o segundo P1 da crítica de design: "avaliar uma atividade não dá retorno, e os rótulos
  confundem". É a etapa `clarify` do plano.
- **Princípio do produto:** "Show the system's reasoning" (`PRODUCT.md`).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Cada botão de avaliação mostra quando seria a próxima revisão** se aquela avaliação fosse
   escolhida ("Bom · 4 dias", "Errei · 10 min").
   - O intervalo é calculado pelo próprio FSRS para aquele item, com o mesmo agendador do
     salvamento: passos curtos para flashcards, só dias inteiros para atividades.
   - O nome acessível do botão continua sendo a avaliação ("Bom"); o intervalo é a descrição dele.
2. **Atividades (PDF, link, quiz) usam uma escala própria:** "Não entendi / Com esforço / Entendi /
   Fácil demais". Os flashcards mantêm "Errei / Difícil / Bom / Fácil". Os valores gravados não
   mudam (again / hard / good / easy).
3. **Tabela de atividades:**
   - A coluna "Progresso" vira **"Última avaliação"**, com o rótulo da escala de atividade.
   - **"Próxima revisão"** mostra a data relativa no idioma do app ("hoje", "amanhã", "em 4 dias",
     "atrasada há 2 dias"), no lugar de `yyyy-MM-dd`. A data completa aparece ao passar o mouse.
4. **Textos menores:**
   - O seletor de idioma mostra "English" e "Português", no lugar de "EN-US" e "PT-BR".
   - Um tempo de quiz abaixo de um segundo aparece como "<1s", e não "0s".
   - O título da lista de respostas no resultado do quiz passa de "Revisão" para **"Respostas"**,
     para não colidir com a revisão espaçada.
   - "Sincronizar agora", quando desabilitado, diz por quê: "Conecte o Google Calendar em
     Configurações para sincronizar."

## Fora do escopo

Um aviso flutuante (toast) depois de avaliar. O intervalo visível em cada botão já mostra a
consequência antes do clique.

## Escolhas técnicas

- `previewRatings(row | null, now, { shortTermEnabled })` em `src/utils/fsrs.ts` e o IPC
  `review.previewRatings({ reviewItemId } | { activityId })`.
- `formatInterval(due, now, locale)` e `formatRelativeDue(due, now, t)` em
  `src/utils/review-time.ts`.
- O `RatingButtons` recebe `scale` ("flashcard" | "activity") e `intervals`.
