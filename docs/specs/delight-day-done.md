# Spec — Fim do dia como recompensa do hábito

- **Branch:** `feature/delight-day-done`
- **Origem:** P2 da segunda crítica de design (`.impeccable/critique/2026-10-03T19-05-40Z__src.md`): "Dia
  concluído" eram duas linhas apagadas e sete caixas quase todas com zero, e a sequência só aparecia no
  rodapé da barra lateral. Num produto de hábito, o fim do dia é o que faz a pessoa voltar.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Sequência em destaque:** com sequência, "N dias seguidos" aparece logo abaixo do título, com a
   chama, em tamanho de destaque.
2. **O dia por programa, na linguagem do heatmap:** "Revisado hoje" lista cada programa com atividades
   revisadas hoje: o nome e uma fileira de células na cor do programa, uma por atividade, e a contagem.
3. **Próxima revisão com o que volta:** "Próxima revisão: domingo, 11 de outubro · 2 atividades".
4. **Semana vazia não ocupa a tela:** a faixa "Próximos 7 dias" só aparece quando algum dos 7 dias tem
   revisão. A mensagem da próxima revisão (ou de que nada está agendado) continua.
5. Textos em pt-BR e inglês.

## Escolhas técnicas

- `buildUpcoming` ganha `nextCount` (atividades distintas na próxima data).
- `reviewedByProgramOn(counts, programs, day)` em `src/utils/today-queue.ts`, a partir de
  `review.listActivityCounts` (que já traz `programId` e `activities`), na ordem dos programas.
