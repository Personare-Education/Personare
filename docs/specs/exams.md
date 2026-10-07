# Spec — Provas

- **Pedido do usuário (2026-10-06):** "dar seguimento às Provas, essas Provas ficarão na mesma página onde a
  data-table de módulos está localizada e fica logo abaixo da tabela, para criar uma prova é necessário
  selecionar os módulos dos quais a prova será feita e os módulos selecionados obrigatoriamente tem que
  possuir uma atividade do tipo quiz para serem selecionados (a prova puxará algumas perguntas aleatórias
  destes módulos), o usuário também pode criar perguntas avulsas para esta prova". E bloquear módulos "similar
  com sequência de atividades na qual é possível adicionar um critério de desbloqueio".
- **Decisões do usuário:**
  - O bloqueio de módulos já existe (docs/specs/sequences-and-locks.md §4). O que entra é um critério novo:
    **passar numa prova** (nota mínima).
  - O sorteio tira um **total fixo**, definido pelo usuário, dividido por igual entre os módulos escolhidos.
    As perguntas avulsas entram sempre, além do sorteio.
  - A prova é **sob demanda**: fica na página do programa, o aluno faz quando quiser e vê o histórico de
    tentativas. Não entra no FSRS, em Hoje nem no calendário.
  - **Tempo limite opcional**, em minutos; quando acaba, a prova é entregue com o que foi respondido. Sem
    limite, ela só cronometra.
  - Diferente do quiz, a prova **não mostra a resposta na hora**: só no fim (decisão de 2026-10-04). O
    resultado é o que o quiz mostrava antes (`QuizScoreResult`: gráfico, nota de 0 a 1000, tempos).
- **Metodologia:** Spec Driven Development + TDD, em PRs empilhados (CHANGELOG no último).

## Modelo

- **Prova** (`exams`): pertence a um programa; tem título, **quantas perguntas sortear** (`questionCount`),
  **tempo limite** em minutos (`timeLimitMinutes`, vazio = sem limite) e **nota de aprovação** em
  porcentagem (`passingScore`, 70 por padrão). Excluir é com desfazer, como o resto.
- **Módulos da prova** (`exam_modules`): de onde o sorteio tira perguntas. Só entra um módulo do mesmo
  programa que tenha ao menos um **quiz com perguntas** (no primeiro nível ou dentro de uma sequência).
- **Perguntas avulsas:** perguntas de quiz comuns (`quiz_questions`, com as alternativas de sempre), mas da
  prova em vez de uma atividade: `quiz_questions.exam_id` preenchido e `activity_id` vazio. Uma pergunta
  pertence a uma atividade **ou** a uma prova.
- **Sorteio:** a cada tentativa, das perguntas vivas dos quizzes vivos de cada módulo da prova (módulos
  excluídos ficam de fora). O total é dividido por igual entre os módulos; a sobra da divisão vai para
  módulos sorteados; um módulo com menos perguntas do que a sua parte dá tudo o que tem e a falta passa para
  os outros. Se não houver perguntas suficientes, vêm todas. As avulsas entram além do total, e a ordem final
  é embaralhada.
- **Tentativa** (`exam_attempts`): quando começou, quanto durou, acertos e total, guardada ao entregar.
  Abandonar no meio não guarda nada.
- **Aprovada:** a prova está aprovada quando alguma tentativa tem `acertos / total` ≥ nota de aprovação.
- **Desbloqueio por prova:** `unlockMode = "exam"` num módulo, com a prova exigida em `unlock_requirements`
  (`subjectKind = "module"`, `requiredId` = a prova). O módulo libera quando a prova está aprovada. Uma prova
  excluída deixa de exigir (como as outras exigências).

## PRs

1. **Dados** (`feature/exams-data`): migração, IPC `exams` (criar, editar, listar, excluir/restaurar,
   módulos que podem entrar, sortear, guardar tentativa, histórico), perguntas avulsas no IPC de quiz, o
   sorteio em `src/utils/exam-draw.ts`, e backup/restauração com as tabelas novas.
2. **Provas na tela** (`feature/exams-ui`): a seção Provas abaixo da tabela de módulos, a tabela de provas,
   o formulário (módulos, total, tempo, nota) e as perguntas avulsas.
3. **Fazer a prova** (`feature/exam-runner`): a prova sem resposta na hora, com navegação livre, o
   cronômetro, a entrega, o resultado e o histórico de tentativas.
4. **Desbloqueio por prova** (`feature/exam-unlock`): o critério "Depois de passar na prova" nos módulos, o
   cadeado com o que falta, e o CHANGELOG.

Cada PR tem a sua seção de critérios abaixo.

## 1. Dados — critérios de aceite

1. `exams.create({ programId, title, moduleIds, questionCount, timeLimitMinutes, passingScore })` cria a
   prova com os seus módulos. Exige ao menos um módulo; `questionCount` ≥ 1; `timeLimitMinutes` vazio ou ≥ 1;
   `passingScore` de 1 a 100. Um módulo de outro programa, excluído ou sem quiz com perguntas é recusado.
2. `exams.update` troca os mesmos campos e a lista de módulos, com as mesmas regras.
3. `exams.list(programId)` traz as provas vivas do programa, na ordem de criação, cada uma com os seus
   módulos, quantas perguntas avulsas tem, a melhor nota, a última tentativa e se está aprovada.
4. `exams.listEligibleModules(programId)` diz, para cada módulo vivo do programa, quantas perguntas de quiz
   ele tem; os que têm zero não podem entrar numa prova.
5. `exams.softDelete` e `exams.restore` tiram e devolvem a prova (as perguntas avulsas e as tentativas vão e
   voltam com ela).
6. `quiz.createQuestion` aceita `examId` no lugar de `activityId` (um dos dois, nunca os dois);
   `quiz.listQuestions` aceita `examId` e lista as avulsas da prova. As alternativas funcionam igual.
7. `drawExamQuestions` (`src/utils/exam-draw.ts`, sem acesso ao banco, com o sorteio injetável) recebe as
   perguntas por módulo, o total e as avulsas e devolve os ids sorteados, como descrito no Modelo.
8. `exams.draw(examId)` devolve as perguntas sorteadas com as alternativas, prontas para a prova.
9. `exams.saveAttempt({ examId, startedAt, durationMs, correct, total })` guarda a tentativa;
   `exams.listAttempts(examId)` traz as tentativas, da mais nova para a mais velha.
10. O backup leva provas, módulos da prova, tentativas e perguntas avulsas; um backup antigo, sem elas, ainda
    restaura.

## 2. Provas na tela — critérios de aceite

1. Na página do programa, abaixo da tabela de módulos, vem a seção **Provas** (título de seção), com
   **Criar prova**. Sem provas, a seção diz o que é uma prova e oferece **Criar prova**. Sem módulos, a seção
   não aparece.
2. A tabela de provas mostra o título, de onde vêm as perguntas ("Anatomia, Fisiologia" e "+ 3 avulsas"),
   quantas perguntas ("20 perguntas"), o tempo ("30 min" ou "Sem limite") e a melhor nota com a aprovação
   ("820 · Aprovada" ou "Ainda não feita"). Mais ações: **Editar**, **Perguntas avulsas**, **Excluir** (com
   desfazer).
3. O formulário da prova tem: título; a lista de módulos com caixas de marcar, cada um com quantas perguntas
   de quiz tem; os sem quiz aparecem desligados e dizem "Sem quiz"; **Quantas perguntas sortear** (com
   quantas há nos módulos marcados); **Tempo limite (minutos)**, opcional; **Nota para passar (%)**, 70 por
   padrão. Salvar exige título e ao menos um módulo.
4. **Perguntas avulsas** abre o gerenciador de perguntas de sempre, para as perguntas da prova. Criar uma
   prova abre as perguntas avulsas logo depois, como criar um quiz abre as perguntas.

## 3. Fazer a prova — critérios de aceite

1. A ação principal de uma prova é **Fazer prova**. Ela abre a prova com as perguntas sorteadas, uma por vez,
   com "Pergunta 3 de 20". Sem nenhuma pergunta para sortear, **Fazer prova** fica desligado e diz por quê.
2. Escolher uma alternativa **não** mostra se está certa. **Anterior** e **Próxima** andam pelas perguntas, e
   a resposta pode ser trocada até a entrega.
3. **Entregar prova** fica na última pergunta e no rodapé. Com perguntas em branco, pede confirmação ("Faltam
   2 perguntas. Entregar assim mesmo?"); em branco conta como errada.
4. Com tempo limite, o tempo restante aparece no topo (anunciado aos leitores de tela a cada minuto e no
   último minuto); quando chega a zero, a prova é entregue sozinha com o que foi respondido. Sem limite, o
   tempo decorrido aparece.
5. Fechar a prova no meio pede confirmação e não guarda a tentativa.
6. Entregue, a prova mostra o resultado: o gráfico de acertos e erros, a nota de 0 a 1000, o tempo médio e
   total, as respostas com a certa de cada pergunta, e se passou ("Aprovada · nota para passar 70%").
   A tentativa é guardada.
7. **Histórico** (em Mais ações) lista as tentativas: data, nota, acertos e tempo.

## 4. Desbloqueio por prova — critérios de aceite

1. A regra de desbloqueio de um módulo ganha **Depois de passar na prova**, com a lista das provas do
   programa para escolher **uma**. Não aparecem as provas que tiram perguntas do próprio módulo (ele nunca
   liberaria). Salvar exige uma prova escolhida. O diálogo abre com a regra atual.
2. `computeLocks` recebe as provas (id e se está aprovada); um módulo com `exam` fica bloqueado enquanto a
   prova não está aprovada, e o que falta é a prova (`kind: "exam"`). Uma prova excluída não bloqueia.
3. O cadeado diz "Libera depois de passar em Prova 1 (70%)". As atividades do módulo esperam o módulo, como
   já acontece.
4. Entregar uma tentativa aprovada atualiza os cadeados da página.
5. A regra de uma atividade não oferece "Depois de passar na prova".
