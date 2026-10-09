# Spec — Índices no banco

- **Pedido do usuário (2026-10-09):** seguir com as melhorias da revisão do projeto. Segunda frente: o
  `schema.ts` tinha 16 tabelas e nenhum índice.
- **Branch:** `feature/indices-banco`, empilhada sobre `feature/limpeza-boilerplate`.
- **Por quê:** as consultas centrais (revisões do dia, calendário, listas de módulos e atividades, pontos
  da temporada) filtram ou juntam por chaves estrangeiras e por `due_date`. Sem índice, o SQLite varre a
  tabela inteira. Com poucos dados isso não aparece; um baralho Anki importado já sente. Numa base
  sintética de 100 mil `review_items`, a busca por vencimento mais a busca por flashcard caíram de
  ~8,3 ms para ~0,13 ms por chamada.

## Critérios de aceite

1. Toda coluna de chave estrangeira usada em junções ou filtros começa um índice: `modules.program_id`,
   `activities.module_id`, `activities.parent_activity_id`, `unlock_requirements.subject_id` e
   `.required_id`, `quiz_questions.activity_id` e `.exam_id`, `quiz_options.question_id`,
   `flashcards.activity_id`, `exams.program_id`, `exam_modules.exam_id` e `.module_id`,
   `exam_attempts.exam_id`, `review_items.flashcard_id` e `.activity_id`.
2. `review_items.due_date` tem índice, e a consulta "o que vence até hoje" o usa (`EXPLAIN QUERY PLAN`).
3. `point_events.season` e `point_events.source_id` têm índice (total da temporada; "já contei este
   ganho?").
4. Os índices vêm numa migration do `drizzle-kit` (`0017_add_indexes`), só com `CREATE INDEX`: nenhum dado
   muda, e o backup não muda de formato.
