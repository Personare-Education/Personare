# Spec — Regra de desbloqueio das provas

- **Pedido do usuário (2026-10-07):** provas "com ou sem regra de desbloqueio", lido como a **própria
  prova** ficar trancada até cumprir uma regra ("precisamos implementar a 1.b também, seria uma nova regra
  de desbloqueio"). Vem antes do import de programas (docs/specs/program-import.md), que traz provas com regra.
- Hoje um **módulo** pode esperar uma prova (docs/specs/exams.md §4); a prova em si é sempre livre. Esta
  spec dá à prova uma regra própria, nos moldes das de módulos e atividades
  (docs/specs/sequences-and-locks.md §4).
- **Metodologia:** Spec Driven Development + TDD. Um PR (`feature/exam-locks`), empilhado sobre #203, sem
  CHANGELOG (vai no último PR do import).

## Modelo

- `exams.unlock_mode`: `none` (livre, o padrão), `sources` (depois de **concluir os módulos da prova**),
  `all` (depois de **todos estes módulos**), `any` (depois de **qualquer um destes módulos**) ou `exam`
  (depois de **passar noutra prova**). As listas ficam em `unlock_requirements`, com `subjectKind = "exam"`.
- **Concluído**, para um módulo, é o de sempre: tem atividades e todas estão concluídas
  (sequences-and-locks.md §2 AC-2). **Passar** numa prova é o de exams.md §4.
- Exigências que apontam para algo excluído são ignoradas; uma lista que fica vazia não tranca.

## Critérios de aceite

1. `exams.setUnlockRule({ id, mode, requiredIds })` grava a regra (substitui a anterior) e
   `exams.getUnlockRule({ id })` a devolve. `sources` não leva lista; `all`/`any` levam módulos vivos do
   programa da prova (ao menos um); `exam` leva **uma** prova viva do programa, que não seja a própria.
2. `computeLocks` tranca a prova enquanto a regra não é cumprida e diz o que falta: os módulos não concluídos
   (`kind: "module"`) ou a prova a passar (`kind: "exam"`). `review.listLocks` traz as provas trancadas em
   `locks.exams`.
3. Uma prova trancada **não pode ser feita**: na tabela, o título mostra o cadeado e o que falta ("Libera
   depois de Fundamentos e Arrays" / "Libera depois de passar em Prova 1 (70%)"), **Fazer prova** sai e a
   ação principal vira **Regra de desbloqueio**. Editar, perguntas avulsas, histórico e excluir continuam.
   `exams.draw` recusa uma prova trancada.
4. **Nada fica trancado para sempre:** uma regra que fecharia um ciclo de espera (a prova A espera a B, que
   espera a A; ou a prova espera um módulo que espera ela) é recusada por `setUnlockRule`, de provas e de
   módulos, e o diálogo fica aberto dizendo por quê ("Esta regra deixaria isto trancado para sempre").
5. Na tabela de provas, **Regra de desbloqueio** fica em Mais ações. O diálogo é o de módulos, com:
   **Livre**; **Depois de concluir os módulos da prova**; **Depois de todos estes** e **Depois de qualquer um
   destes** (com os módulos do programa); **Depois de passar na prova** (com as outras provas). Abre com a
   regra atual.
6. Os cadeados se atualizam depois de uma tentativa, de concluir uma atividade ou de mudar uma regra.
7. O backup leva a regra (a coluna nova e as listas, que já iam em `unlock_requirements`); um backup antigo
   restaura com as provas livres.
