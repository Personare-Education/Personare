# Spec — Um registro por avaliação (`review_logs`)

- **Pedido do usuário (2026-10-09):** "vamos tirar os dois modos do papel hoje mesmo".
- **Arquitetura:** `docs/architecture/scheduling.md`, decisões D3 e D5. É a base da calibração (D4) e do
  simulador (D9).
- **Branch:** `feature/review-logs`, empilhada sobre `feature/objetivo-do-programa`.

## Critérios de aceite

1. **Tabela** `review_logs` (migration `0020_review_logs`), com índices por item e por data. Cada avaliação
   grava uma linha **na mesma transação** que atualiza o `review_items`, com: nota; momento; estado,
   estabilidade e dificuldade antes e depois; vencimento resultante; dias desde a avaliação anterior (nulo
   na primeira); a **recordação prevista** pelo modelo no momento (`get_retrievability` do `ts-fsrs`; nula
   para um item novo); a retenção desejada em vigor; o objetivo do programa (`retain` ou `test_prep`); e o
   tipo do item: `recall` para flashcard, `coverage` para quiz, PDF e link (D5).
2. Vale para `submitRating` (flashcards) e `markActivityDifficulty` (atividades inteiras). O
   `rating_history` continua igual.
3. **Duração:** `submitRating` e `markActivityDifficulty` aceitam `durationMs` (inteiro, ≥ 0). A sessão de
   flashcards mede do momento em que o card aparece até a nota. Acima de 15 minutos (o aluno provavelmente
   saiu da tela), ou com o relógio voltando, não mede. Nas atividades inteiras, o PDF e o link abrem fora
   do app, então a duração fica nula por enquanto.
4. **Backup:** os registros vão no backup e voltam na restauração, apagados antes dos itens a que
   apontam. Um backup antigo, sem eles, restaura sem registros.
5. Nada aparece na interface ainda: os registros servem à calibração e ao simulador.
