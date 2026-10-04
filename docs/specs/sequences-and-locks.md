# Spec — Sequências de atividades e bloqueios

- **Pedido do usuário (2026-10-04):** sub-atividades ("um grupo de atividades a ser realizado em uma
  sequência estabelecida pelo usuário, exemplo: 'Atividade Revisória de Anatomia: PDF, Link de uma Video
  Aula, Quiz'"), atividades bloqueadas ("indicada por um cadeado, requerem que alguma outra atividade seja
  concluída primeiro") e módulos bloqueados ("requerem que um módulo específico seja feito para liberar o
  módulo"). O usuário define se uma sequência só **sugere** a ordem ou **bloqueia**, com critérios de
  desbloqueio.
- **Decisões do usuário:**
  - Critérios de desbloqueio, iguais para atividades e módulos: **todos os anteriores**; **qualquer um** de
    uma lista (OU); **todos** de uma lista (E).
  - Um grupo é **uma revisão só** no FSRS: quando vence, a sessão percorre as sub-atividades na ordem e o
    aluno avalia o grupo inteiro uma vez, no fim. Em Hoje ele é um item.
  - **Concluída** = avaliada ao menos uma vez (qualquer nota). Um módulo está concluído quando todas as suas
    atividades estão.
  - Itens bloqueados **somem de Hoje e do calendário** até serem liberados; nas tabelas aparecem com o
    cadeado e dizem o que falta.
- **Metodologia:** Spec Driven Development + TDD, em PRs empilhados (CHANGELOG no último).

## Modelo

- **Ordem:** módulos e atividades ganham `position`. Os que já existem recebem a ordem que tinham na tela
  (módulos por nome, atividades por criação). Os novos entram no fim.
- **Grupo:** uma atividade de tipo `group`, sem arquivo nem link. Suas sub-atividades são atividades comuns
  (PDF, link ou quiz) com `parentActivityId` apontando para o grupo, ordenadas por `position` dentro dele.
  Baralhos de flashcards não entram em grupos: cada card já tem o próprio agendamento, o que não combina com
  "uma revisão só".
- **Regra de desbloqueio:** `unlockMode` em atividades e módulos: `none` (livre), `previous` (todos os
  anteriores: os módulos antes dele no programa; as atividades antes dela no mesmo nível, isto é, no módulo
  ou no grupo), `any` (qualquer um da lista) ou `all` (todos da lista). As listas ficam em
  `unlock_requirements` (quem exige, de que tipo, e o que é exigido). "Só sugerir a ordem" num grupo = as
  sub-atividades com `none`; "bloquear em sequência" = com `previous`.
- **Concluída:** `completedAt` em atividades, gravado na primeira vez que ela é concluída: a primeira
  avaliação de uma atividade (ou de um card do baralho) ou, numa sub-atividade, quando ela é feita durante o
  grupo. As atividades já avaliadas recebem a data da primeira avaliação na migração.
- **Bloqueada:** um módulo está bloqueado se a regra dele não é cumprida. Uma atividade está bloqueada se o
  módulo dela está bloqueado, se o grupo dela está bloqueado, ou se a regra dela não é cumprida. Exigências
  que apontam para algo excluído são ignoradas; uma lista que fica vazia não bloqueia. Um módulo sem
  atividades não conta como concluído.

## PRs

1. **Dados** (`feature/sequences-data`): migração (ordem, grupo, regras, conclusão, com os dados atuais
   preservados), listas ordenadas, criar no fim, reordenar, gravar regras, gravar `completedAt` ao avaliar,
   excluir/restaurar um grupo junto com as sub-atividades, e backup/restauração com as tabelas novas (os
   backups antigos continuam restaurando).
2. **Bloqueios** (`feature/locks-engine`): a regra calculada num só lugar (`src/utils/unlock.ts`), um IPC que
   diz o que está bloqueado e o que falta, e os bloqueados fora de Hoje, do calendário, dos selos e da
   contagem da bandeja.
3. **Grupos e ordem na tela** (`feature/activity-groups-ui`): criar um grupo, adicionar, ordenar e tirar
   sub-atividades; o grupo na tabela com as sub-atividades dentro; mover atividades e módulos para cima e
   para baixo.
4. **Cadeados** (`feature/unlock-rules-ui`): editar a regra de uma atividade ou módulo (livre, todos os
   anteriores, qualquer um de…, todos de…), o cadeado nas tabelas com o que falta, e o bloqueio de abrir o que
   está trancado.
5. **Fazer um grupo** (`feature/run-activity-group`): na sessão de Hoje e na tela do módulo, o grupo percorre
   as sub-atividades na ordem (respeitando os bloqueios dentro dele) e termina numa avaliação só. Leva o
   CHANGELOG.

Cada PR tem a sua seção de critérios abaixo, escrita antes do código dele.

## 1. Dados — critérios de aceite

1. Módulos e atividades listam pela ordem (`position`); empatados, pela criação. Após a migração, a ordem na
   tela não muda.
2. Um módulo ou atividade novo entra no fim da sua lista (a lista de uma atividade é o seu módulo ou, numa
   sub-atividade, o seu grupo).
3. `reorderModules(programId, ids)` e `reorderActivities(moduleId, parentActivityId, ids)` gravam a nova
   ordem.
4. Uma atividade pode ser criada dentro de um grupo (`parentActivityId`); um grupo não aceita outro grupo nem
   um baralho dentro dele. A lista de um módulo traz só as atividades do primeiro nível; as de um grupo vêm
   com `listActivities(moduleId, groupId)`.
5. `setUnlockRule` grava o modo e a lista de uma atividade ou módulo, substituindo a anterior; uma lista só
   aceita itens do mesmo tipo e do mesmo programa, e nunca o próprio item.
6. Avaliar uma atividade (ou um card do baralho) pela primeira vez grava `completedAt`; avaliar de novo não
   muda a data. `completeActivity(id)` grava a conclusão de uma sub-atividade.
7. Excluir um grupo exclui as sub-atividades junto; desfazer traz todas de volta.
8. O backup leva as regras de desbloqueio; um backup antigo, sem elas, ainda restaura (tudo fica livre).

## 2. Bloqueios — critérios de aceite

1. `computeLocks` (`src/utils/unlock.ts`, sem acesso ao banco) recebe módulos, atividades e listas e diz, para
   cada módulo e atividade, se está bloqueado e **o que falta**: os itens exigidos ainda não concluídos, na
   ordem em que aparecem.
2. Regras de um módulo: `none` livre; `previous` exige concluídos todos os módulos antes dele no programa;
   `any` exige um da lista concluído; `all`, todos. Um módulo está concluído quando tem atividades (do primeiro
   nível) e todas estão concluídas.
3. Regras de uma atividade: as mesmas, sobre atividades; `previous` olha as anteriores no mesmo nível (no
   módulo, ou dentro do grupo). Uma atividade também fica bloqueada quando o seu módulo ou o seu grupo está
   bloqueado; aí o que falta é o desbloqueio dele.
4. Exigências que apontam para algo excluído são ignoradas; uma lista que fica vazia não bloqueia.
5. `review.listLocks` devolve o estado de todos os módulos e atividades bloqueados, com o que falta.
6. `listSchedule` (Hoje, selos, calendário, sincronização do calendário, destaques) e a contagem da bandeja
   (`countDueReviews`) deixam de fora as atividades bloqueadas.

## 3. Grupos e ordem na tela — critérios de aceite

1. O formulário de atividade tem o tipo **Sequência** (ícone de lista numerada), sem link nem arquivo. Criar uma
   sequência abre o gerenciador dela, como criar um quiz abre as perguntas.
2. O **gerenciador da sequência** lista as atividades dela na ordem, numeradas, com o ícone e o tipo de cada
   uma; cada uma sobe, desce, é editada ou excluída (com desfazer), e um quiz abre as suas perguntas.
   **Adicionar atividade** abre o formulário só com PDF, link e quiz (incluindo importar um quiz de IA), e a
   nova entra no fim. Sem nenhuma, ele diz o que cabe numa sequência.
3. Na tabela, a sequência aparece como **Sequência**, com quantas atividades tem ao lado do título, e a ação
   principal **Ver sequência** abre o gerenciador.
4. Atividades e módulos ganham **Mover para cima** e **Mover para baixo** em Mais ações (e no menu do botão
   direito); o primeiro não sobe, o último não desce. Enquanto a busca de atividades filtra a lista, mover
   fica de fora.
5. Um quiz importado de IA entra no fim da lista (ou da sequência), como os outros.

## 4. Cadeados — critérios de aceite

1. Atividades (também dentro de uma sequência) e módulos ganham **Regra de desbloqueio** em Mais ações. O
   diálogo oferece: **Livre**; **Depois de tudo o que vem antes**; **Depois de qualquer um destes** (OU);
   **Depois de todos estes** (E). Nos dois últimos aparece a lista do que pode ser exigido (as outras
   atividades do programa, agrupadas por módulo; ou os outros módulos), e salvar exige ao menos um marcado.
   O diálogo abre com a regra atual.
2. O que está bloqueado mostra um **cadeado** ao lado do nome e o que falta: "Libera depois de Capítulo 1 e
   Videoaula" (ou "… Capítulo 1 ou Videoaula", numa regra de qualquer um); "Libera junto com Esqueleto" quando
   espera o módulo (ou a sequência) liberar. O cadeado tem nome para leitores de tela ("Bloqueada").
3. Uma atividade bloqueada não abre: as ações de abrir, revisar ou responder saem; a ação principal vira
   **Regra de desbloqueio**. Editar, mover e excluir continuam.
4. No gerenciador de uma sequência, **Ordem: Só sugerir / Bloquear em ordem** troca de uma vez as regras das
   atividades dela (a primeira fica livre; as outras, "depois de tudo o que vem antes" ou livres). Cada
   atividade da sequência mostra o cadeado e tem a sua regra.
5. Depois de salvar uma regra (ou de concluir algo), os cadeados se atualizam.

## 5. Fazer uma sequência — critérios de aceite

1. Na tabela, a ação principal de uma sequência livre é **Fazer sequência**; **Ver sequência** vai para Mais
   ações. Uma sequência sem atividades não tem o que fazer: só **Ver sequência**.
2. Fazer uma sequência (pela tabela, ou em Hoje quando ela vence) percorre as atividades **na ordem**, uma por
   vez, com "Etapa 2 de 3". Cada etapa se abre como de costume (PDF, link ou quiz) e, aberta, mostra
   **Concluir etapa**, que a marca como concluída (`completeActivity`) e passa à próxima.
3. Um quiz dentro da sequência não pede avaliação própria: o resultado mostra as respostas e **Continuar**,
   que conclui a etapa.
4. Uma etapa bloqueada (por uma regra dela) mostra o cadeado e o que falta, e pode ser **pulada**; ela não
   conta como concluída.
5. Depois da última etapa vem **uma avaliação só**, da sequência inteira, com os intervalos de cada nota; ela
   agenda a próxima revisão da sequência. Em Hoje, a sequência conta como um item revisado.
6. Em Hoje, a sequência aparece com o ícone e o nome do tipo **Sequência**.
