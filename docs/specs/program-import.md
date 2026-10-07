# Spec — Importar um programa inteiro

- **Pedido do usuário (2026-10-07):** "quero ser capaz de importar um programa INTEIRO, estou querendo que a
  IA gere um arquivo para mim". O arquivo vem de uma IA de terceiros (ChatGPT, Claude, Gemini) ou é escrito à
  mão: o app entrega **um prompt para colar** e recebe o arquivo de volta. Se a IA dá conta de gerar tudo, não
  é com o app.
- **Decisões do usuário:**
  - O arquivo cria **módulos**, com ou sem **regra de desbloqueio**. Dentro deles: **quizzes**,
    **flashcards**, **links** e **sequências** (que agrupam vários tipos num lugar só, por exemplo um link de
    material e um quiz).
  - O arquivo traz **provas**, com ou sem regra de desbloqueio. A regra é da **própria prova** (ela fica
    trancada até cumprir a regra), uma funcionalidade que vem antes do import: docs/specs/exam-locks.md.
  - Completando um programa, a regra do arquivo vale só para módulos (e provas) **novos**; um módulo que já
    existia **mantém a sua** e a do arquivo é ignorada.
  - Se já existe um **programa com o mesmo nome**, o arquivo **completa** esse programa em vez de criar outro.
- **Formato: Markdown**, estendendo o do import de quiz (docs/specs/quiz-ai-import.md), e não XML nem JSON.
  Por quê: a resposta é colada de um chat, sem schema que garanta a sintaxe; um erro de JSON (uma vírgula,
  uma aspa, o `\\` de cada LaTeX) perde o arquivo inteiro, e o XML exige escapar `<` e `&`, que perguntas
  de programação têm de sobra. Markdown é o que as IAs escrevem com mais constância, dá para ler e corrigir à
  mão, e o leitor pode **pular só o trecho com erro**, como o import de quiz já faz.
- **Backup (Configurações):** não precisa mudar. O import só grava em tabelas que o backup já leva
  (programas, módulos, atividades, sequências, flashcards, perguntas e alternativas, regras de desbloqueio,
  provas e os módulos de cada prova; as provas entraram no backup em docs/specs/exams.md §1 AC-10). Um
  teste confirma: importar, fazer backup e restaurar devolve tudo.
- **Metodologia:** Spec Driven Development + TDD, em PRs empilhados a partir de `main` (as Provas, #200→#204,
  já estão lá), CHANGELOG no último.

## O formato

Um arquivo `.md` por programa. As palavras-chave valem em português e em inglês (`Módulo`/`Module`,
`Sequência`/`Sequence`…), maiúsculas ou não; o prompt usa as da língua do app.

```markdown
# Programa: Algoritmos

## Módulo: Fundamentos

### Link: Videoaula de complexidade
https://www.youtube.com/watch?v=...

### Quiz: Fixação de complexidade
Qual a complexidade de busca binária?
- [x] O(log n)
- [ ] O(n)
- [ ] O(1)

Quanto vale $\sum_{i=1}^{n} i$?
- [x] $\frac{n(n+1)}{2}$
- [ ] $n^2$

### Flashcards: Termos
Frente: Big-O
Verso: Limite superior do crescimento de uma função.

Frente: Estável (ordenação)
Verso: Mantém a ordem relativa de elementos iguais.

## Módulo: Arrays e Hashing
Libera depois de: Fundamentos

### Sequência: Revisão de hashing
Ordem: bloquear

#### Link: Apostila de hashing
https://exemplo.com/hashing.pdf

#### Quiz: Hashing na prática
O que é uma colisão?
- [x] Duas chaves no mesmo bucket
- [ ] Uma chave sem valor

## Prova: Prova 1
Módulos: Fundamentos; Arrays e Hashing
Perguntas: 10
Tempo: 30
Nota: 70

Pergunta avulsa: qual estrutura usa FIFO?
- [x] Fila
- [ ] Pilha
```

Regras:

- `# Programa: <nome>` uma vez, no começo.
- `## Módulo: <nome>` abre um módulo; `## Prova: <título>` abre uma prova. Ficam na ordem do arquivo.
- **Regra de um módulo** (opcional, logo abaixo do título): `Libera depois de:` seguido de
  - `anteriores` → todos os módulos antes dele;
  - `<A>` ou `<A>; <B>` → todos estes (E);
  - `qualquer um de: <A>; <B>` → qualquer um (OU);
  - `passar na prova: <título>` → depois de passar na prova (docs/specs/exams.md §4).
  Sem a linha, o módulo é livre.
- **Atividades de um módulo** (`###`): `Quiz:`, `Flashcards:`, `Link:` e `Sequência:`. PDFs e imagens não
  entram (a IA não gera arquivos).
- **Link:** a primeira linha com `http(s)://` é o endereço.
- **Quiz:** perguntas em sequência. Uma pergunta é o texto (uma ou mais linhas, com Markdown e LaTeX) e logo
  depois as alternativas `- [x]` (a certa, uma só) e `- [ ]` (ao menos duas no total), como no import de quiz.
- **Flashcards:** pares `Frente:` / `Verso:` (`Front:` / `Back:`); o texto pode seguir nas linhas de baixo até
  o próximo `Frente:`.
- **Sequência** (`###`), com etapas em `####`: `Link:` e `Quiz:` (sem flashcards nem outra sequência, como
  no app). `Ordem: bloquear` tranca as etapas em ordem; `Ordem: sugerir` (ou sem a linha) só sugere.
- **Prova:** `Módulos:` (os nomes, separados por `;`), `Perguntas:` (quantas sortear), `Tempo:` (minutos,
  opcional), `Nota:` (para passar, 70 se faltar) e, opcional, a regra da própria prova
  (docs/specs/exam-locks.md): `Libera depois de:` seguido de `módulos da prova`, `<A>; <B>` (todos estes
  módulos), `qualquer um de: <A>; <B>` ou `passar na prova: <título>`. As perguntas abaixo dela são as
  **avulsas**, no mesmo formato do quiz.
- Blocos de código (```` ``` ````) são texto: um `#` dentro deles não abre nada. A exceção é o bloco que
  **embrulha a resposta inteira** (```` ```markdown ```` … ```` ``` ````), como os chats costumam entregar:
  esse é tirado. Texto antes de `# Programa:` (a conversa da IA) é ignorado.
- Sem `Perguntas:`, a prova sorteia 10.

## Completar um programa existente

- O nome do programa é comparado sem diferenciar maiúsculas e espaços nas pontas. Achou um programa vivo com
  esse nome: o import **completa** esse; senão, cria um novo.
- Completando: um módulo com o mesmo nome **recebe** as atividades novas (entram no fim) e **mantém a sua
  regra**: a do arquivo é ignorada, e a prévia diz isso. Um módulo novo entra no fim da lista. Uma atividade com o mesmo tipo e título no mesmo lugar (módulo ou sequência) **não é
  duplicada**: fica de fora e a prévia diz "já existe". O mesmo vale para uma prova com o mesmo título.
- Importar o mesmo arquivo duas vezes, portanto, não duplica nada.

## O que dá errado

O leitor nunca recusa o arquivo inteiro por um trecho. Cada problema vira um aviso, com a linha:

- Sem `# Programa:` → o arquivo não é importável (o único erro que bloqueia).
- Pergunta sem alternativa certa, com mais de uma certa ou com menos de duas → a pergunta fica de fora.
- Flashcard sem verso, link sem endereço, quiz ou baralho sem nenhum item válido → aquele item fica de fora.
- Título desconhecido (`## Coisa:`, `### PDF:`) → o bloco fica de fora, com o aviso.
- Regra que cita um módulo ou prova que não existe (nem no arquivo nem no programa) → a regra é ignorada e o
  módulo fica livre. Uma prova citada que tira perguntas do próprio módulo também é ignorada (ele nunca
  liberaria, exams.md §4 AC-1).
- Prova que cita um módulo sem quiz ou inexistente → esse módulo sai da prova; sem nenhum módulo que sirva, a
  prova fica de fora.

## PRs

1. **Formato** (`feature/program-import-format`): o leitor `parseProgramMarkdown` e o prompt
   `buildProgramPrompt`, em `src/utils/program-markdown.ts`, puros e sem banco.
2. **Gravar** (`feature/program-import-data`): o IPC `programs.import`, que recebe o programa lido, decide o
   que é novo e o que já existe, e grava tudo **numa transação** (ou tudo, ou nada).
3. **Na tela** (`feature/program-import-ui`): **Importar programa** na página de Programas, o diálogo em
   passos (prompt → arquivo → prévia → importar), desfazer, e o CHANGELOG.

## 1. Formato — critérios de aceite

1. `parseProgramMarkdown(text)` devolve o programa (nome, módulos com regra e atividades, provas) e a lista
   de avisos `{ line, reason }`, como descrito em "O formato" e "O que dá errado".
2. Quiz e perguntas avulsas seguem as regras do import de quiz (uma certa, ao menos duas alternativas).
3. Palavras-chave em português e em inglês, sem diferenciar maiúsculas; `#` dentro de bloco de código não
   conta; finais de linha `\r\n` e `\n`.
4. A regra de módulo vira `{ mode, names }` (`previous`, `all`, `any`, `exam`), ainda por nome; quem resolve
   os nomes é o PR 2.
5. `buildProgramPrompt({ language, topic, extraInstructions? })` devolve o prompt na língua do app: pede
   **só** o arquivo, no formato acima, com um exemplo curto de cada bloco e as regras (uma alternativa certa,
   ao menos duas, LaTeX entre `$`, sem PDFs), e para usar os nomes exatos nas regras e nas provas.
6. Um arquivo gerado a partir do exemplo do próprio prompt é lido sem nenhum aviso.
7. A resposta embrulhada num bloco ```` ```markdown ````, ou com texto antes de `# Programa:`, é lida igual.

## 2. Gravar — critérios de aceite

1. `programs.import(parsed)` acha o programa pelo nome (sem diferenciar maiúsculas e espaços) ou cria um, e
   devolve o relatório: o que foi criado e o que ficou de fora por já existir.
2. Módulos, atividades, sequências (com etapas e a ordem), flashcards (cada card com o seu agendamento, como
   ao criar à mão), quizzes com perguntas e alternativas, e provas com módulos e perguntas avulsas, na ordem
   do arquivo, no fim das listas que já existem.
3. Completar não duplica: módulo com o mesmo nome é reaproveitado; atividade com o mesmo tipo e título no
   mesmo lugar, e prova com o mesmo título, ficam de fora.
4. Regras resolvidas por nome, contra o arquivo **e** o programa (um módulo do arquivo pode esperar um que já
   existia); "anteriores" usa a ordem final. Só módulos e provas **novos** recebem regra; um que já existia
   mantém a sua. Nomes que não se resolvem, ou uma regra que trancaria algo para sempre (exam-locks.md AC-4):
   a regra é ignorada e entra no relatório.
5. Tudo numa transação: um erro no meio não deixa nada gravado.
6. `programs.undoImport(report)` tira (com exclusão reversível, como o resto) tudo o que aquele import criou,
   e só isso: o que já existia fica.
7. Importar, fazer backup e restaurar devolve o programa importado inteiro (o backup não precisa mudar).

## 3. Na tela — critérios de aceite

1. Na página de Programas, ao lado de **Novo programa**, vem **Importar programa** (também no estado vazio).
2. O diálogo tem três passos, como o import de quiz:
   1. **Prompt:** sobre o que é o programa (campo livre) e **Copiar prompt e abrir** ChatGPT, Claude ou
      Gemini (o prompt vai na URL quando o site aceita; senão, só na área de transferência), ou **Já tenho o
      arquivo**.
   2. **Arquivo:** soltar ou escolher o `.md` (ou colar o texto).
   3. **Prévia:** o programa em árvore (módulos com o cadeado e o que esperam, atividades com o ícone do tipo
      e quantas perguntas ou cards, provas), se ele é **novo** ou **completa** um que já existe, o que já
      existe e vai ficar de fora, e os avisos com a linha. **Importar** grava.
3. Depois de importar, o app abre o programa e mostra "Programa importado" com **Desfazer**.
4. Um arquivo sem `# Programa:` não passa da prévia: ela diz o que falta e oferece voltar ao prompt.
