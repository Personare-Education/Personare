# Agendamento de revisões: dois modos, dois objetivos

> **Status:** arquitetura **aceita** em 2026-10-09. As decisões estão numeradas (D1, D2…) na seção 9, e o
> que já está implementado aparece na seção 11. As demais afirmações estão marcadas como **Confirmado** (no
> código ou decidido), **Hipótese** (a validar) ou **Trabalho futuro**.
>
> Issues relacionadas: [#228](https://github.com/Personare-Education/Personare/issues/228) (ajustar os
> parâmetros do FSRS ao histórico do aluno) e [#229](https://github.com/Personare-Education/Personare/issues/229)
> (modo prova com data-alvo).

## 1. Os dois modos

O Personare precisa oferecer dois modos de agendamento. Eles têm **objetivos diferentes** e não são
equivalentes. Podem compartilhar o modelo de memória, o histórico de avaliações e os mecanismos de
avaliação, mas cada um usa uma política de agendamento compatível com o próprio objetivo.

| | Modo A: retenção a longo prazo | Modo B: desempenho na prova |
|---|---|---|
| Objetivo | Manter o conhecimento disponível na memória ao longo do tempo | Maximizar o desempenho esperado numa avaliação com data definida |
| Horizonte | Aberto, sem data final | Termina na data (e, quando relevante, no horário) da prova |
| Pergunta da política | "Quando revisar para manter a recordação perto da meta?" | "Que revisões, até a prova, trazem o maior ganho esperado na prova, dado o tempo disponível?" |
| Pessoa do `PRODUCT.md` | O aluno do semestre | O candidato com meta datada (concurso, vestibular, residência) |

### Escolha do modo: ao criar o programa

**Confirmado (decisão do usuário, 2026-10-09):** o modo é escolhido **por programa, na criação**, entre duas
opções:

- **"Nunca mais esquecer"**: Modo A.
- **"Estudar para uma Prova"**: Modo B.

Consequências desta decisão:

- A data da avaliação $T$ (e os demais dados do Modo B, seção 5.3) pertence ao **programa**. O escopo do
  Modo B é o conteúdo daquele programa.
- Um aluno pode ter programas nos dois modos ao mesmo tempo, então a tela Hoje e o planejador combinam
  itens de políticas diferentes no mesmo dia.

**Confirmado (D2):**

- Programas que já existem ficam em "Nunca mais esquecer", que é o comportamento de antes.
- O modo pode ser trocado depois, na edição do programa. Nada se perde: o histórico é o mesmo e só a
  política muda.
- Passada a data da prova, o programa volta a se comportar como "Nunca mais esquecer", sem que nada precise
  ser gravado.

### Terminologia: "Prova" já tem outro significado no app

**Confirmado:** no Personare, **Prova** (`exams`, `docs/specs/exams.md`) é uma avaliação feita *dentro do
app*: perguntas sorteadas dos quizzes de um programa, feitas sob demanda e **sem FSRS**. O Modo B trata de
outra coisa: uma avaliação **externa** (o concurso, o vestibular) com data marcada.

Na interface, o rótulo do Modo B é **"Estudar para uma Prova"** (decisão acima), e convive com as Provas do
app. **Confirmado (D1):** no código e no banco, o Modo B **não** usa `exam`. Os nomes são
`programs.study_goal` (`"retain"` para o Modo A, `"test_prep"` para o Modo B) e `programs.target_date` (o
dia da prova). Na interface, quando as duas coisas aparecem juntas, fica claro que a data é a da prova de
fora do app.

## 2. Estado atual (Confirmado, no código)

- **Entidade agendada:** o `ReviewItem` (`review_items`), não a atividade (`Plan.md` §1.2). Num baralho, cada
  flashcard é um `ReviewItem`. Quiz, PDF e link têm um `ReviewItem` por atividade inteira (Issue #77).
- **Algoritmo em uso:** `ts-fsrs` 5.4.2, via `src/utils/fsrs.ts` (`applyRating`, `previewRatings`), chamado
  por `src/ipc/review/handlers.ts` (`submitRating`, `markActivityDifficulty`, `previewRatings`).
  - Flashcards usam passos de curto prazo (`enable_short_term: true`). Atividades inteiras não
    (`enable_short_term: false`; ver o comentário em `src/utils/fsrs.ts`).
  - **Parâmetros:** os pesos padrão do `ts-fsrs`, sem ajuste ao histórico do aluno (isso é a #228).
    `enable_fuzz` fica no padrão da biblioteca (desligado).
  - **Retenção desejada:** escolhida pelo aluno em Configurações, de 0,80 a 0,95, com 0,9 como padrão
    (`app_settings.desired_retention`, `docs/specs/desired-retention.md`).
- **Histórico:** `review_items.rating_history` guarda, por avaliação, `{ rating, reviewedAt }`. **Não guarda
  quanto tempo cada revisão levou.**
- **Retenção observada:** `computeRetention` (`src/utils/retention-stats.ts`,
  `docs/specs/retention-summary.md`) calcula, nos últimos 30 dias, a fração de revisões que não foram
  "De novo". É o que a tela Hoje mostra em "Sua memória".
- **Importação do Anki:** o estado SM-2 vira um ponto de partida para o FSRS por heurística
  (`docs/specs/issue-31-anki-sm2-fsrs-seed.md`).
- **Ainda não existem no modelo de dados:** data da avaliação, peso de um conteúdo na avaliação, custo de
  tempo por revisão e disponibilidade diária do aluno.

**Em resumo (antes da implementação de D1 a D7):** o que existia era uma forma do **Modo A**, e o Modo B não
existia. Para o estado de agora, ver a seção 11. A dica "95%, antes de uma
prova", no seletor de retenção, é só um paliativo: subir a retenção não leva a data em conta.

## 3. Separação de responsabilidades

São três conceitos distintos. A implementação de cada um deve seguir as convenções do projeto (funções
puras em `src/utils/`, handlers oRPC em `src/ipc/`, ver `README.md` → Architecture). Este documento **não**
impõe classes nem interfaces.

1. **Modelo de memória:** estima a probabilidade de recordar um conteúdo num dado momento, a partir dos
   parâmetros, do histórico e das revisões anteriores. **Não decide** quando revisar.
   - *Hoje:* o modelo do FSRS (estabilidade, dificuldade, recuperabilidade), dentro do `ts-fsrs`.
2. **Política de agendamento:** decide **quais** conteúdos revisar e **quando**, usando as estimativas do
   modelo de memória conforme o seu objetivo (Modo A ou Modo B).
   - *Hoje:* a política do próprio `ts-fsrs` (o próximo vencimento é escolhido para que a recordação caia
     até a retenção desejada). Modelo e política vêm **acoplados** dentro da biblioteca, e o `fsrs.ts` só
     expõe o resultado.
3. **Sistema de planejamento:** leva em conta disponibilidade, duração das sessões e limites práticos;
   distribui as revisões no calendário; recalcula o plano quando algo relevante muda.
   - *Hoje:* não existe como componente. A tela Hoje e o calendário só listam o que vence.

**Hipótese:** para o Modo B, será preciso consultar o modelo de memória **separado** da política do
`ts-fsrs` (por exemplo, a recuperabilidade prevista numa data futura, com e sem uma revisão agora). Se o
`ts-fsrs` expõe isso de forma utilizável ainda precisa ser verificado.

## 4. Modo A: retenção a longo prazo

**Objetivo:** manter o conhecimento disponível ao longo do tempo.

Requisitos:

- O agendamento é **adaptativo**: considera o histórico de revisões e o desempenho do aluno.
- Intervalos fixos e universais (1, 3, 7, 14 dias…) **não** são a estratégia principal.
- Considera a probabilidade estimada de recordação, a dificuldade do conteúdo e a evolução da memória.
- A implementação respeita as premissas, os parâmetros e o funcionamento do algoritmo de memória escolhido
  (por exemplo, não mexer nos intervalos do FSRS por fora do modelo sem uma razão documentada).

**Sobre o FSRS:**

- **Confirmado:** é o algoritmo **em uso** hoje (`Plan.md` §1.3: "`ts-fsrs` como implementação do
  algoritmo — não reimplementar o FSRS manualmente").
- **Decisão em aberto:** se o FSRS continua sendo o modelo **definitivo** do Modo A. Ele é a referência
  arquitetural, e a escolha final depende da avaliação descrita na seção 8.
- **Trabalho futuro:** ajustar os parâmetros ao histórico de cada aluno (#228).

## 5. Modo B: desempenho na prova

**Objetivo:** maximizar o desempenho esperado do aluno numa avaliação com data definida.

O algoritmo deverá considerar:

- a data e, quando relevante, o horário da prova;
- o tempo restante até ela;
- a importância relativa dos conteúdos para o resultado;
- a retenção estimada de cada conteúdo **na data da prova**;
- a dificuldade individual e o histórico de desempenho do aluno;
- o tempo necessário para revisar cada conteúdo;
- a disponibilidade diária e a capacidade de estudo do aluno;
- quantas revisões ainda cabem antes da prova;
- a necessidade de replanejar após novas respostas, revisões concluídas ou mudanças na disponibilidade.

A prioridade **não** é simplesmente o conteúdo mais antigo nem o de memória estimada mais baixa. O objetivo é
identificar as revisões com **maior benefício esperado para o desempenho na data da prova**, considerando o
tempo disponível e o efeito das decisões de agora sobre as revisões futuras.

### 5.1 Formulação conceitual (modelo inicial, não solução)

- $T$: data da prova.
- $i$: conteúdo ou unidade de conhecimento.
- $R_i(T \mid \pi)$: probabilidade estimada de recordar $i$ na data $T$, dada a política de revisões $\pi$.
- $w_i$: peso ou importância de $i$ na avaliação.
- $c_i$: custo de tempo de uma sessão de revisão de $i$.
- $\pi$: política de agendamento (quais conteúdos revisar e quando).

Objetivo simplificado:

$$
\max_{\pi} \sum_i w_i \, R_i(T \mid \pi)
$$

sujeito às restrições de tempo, disponibilidade e número de sessões possíveis antes da prova.

**Hipótese:** esta função orienta a arquitetura, mas **não** é um modelo matemático completo. Antes de
tratá-la como tal, é preciso validar: como obter os pesos $w_i$; se a estimativa de recordação do modelo de
memória é confiável para uma data futura; e se a soma ponderada de recordações representa bem o
desempenho numa prova real.

### 5.2 Heurística inicial de priorização

Uma possível aproximação do benefício de revisar $i$ no instante $t$:

$$
\operatorname{Score}(i,t)=
\frac{
w_i \left[
R_i(T \mid \text{revisar agora}) -
R_i(T \mid \text{não revisar agora})
\right]
}{
c_i(t)
}
$$

É o ganho marginal estimado na prova por unidade de tempo investida.

**Limitação:** sozinha, essa pontuação **não resolve** o problema completo. Ela é gulosa: não considera
necessariamente todas as consequências de uma revisão de agora sobre a memória e sobre as oportunidades de
revisão futuras. **Trabalho futuro:** se a pesquisa e o custo computacional justificarem, avaliar um modelo
de otimização dinâmica (por exemplo, programação dinâmica ou otimização estocástica; ver a referência 3).

### 5.3 Dados que o Modo B exigiria e que hoje não existem

Lista para orientar a especificação, não decisões tomadas:

- data (e horário) da avaliação e a quais programas ou módulos ela se aplica;
- peso $w_i$ por conteúdo (padrão uniforme? definido pelo aluno? derivado de edital?);
- custo $c_i$: hoje nenhuma duração de revisão é registrada (`rating_history` só tem nota e data);
- disponibilidade diária do aluno.

## 6. Princípios arquiteturais

1. Os dois modos têm objetivos **explicitamente distintos**.
2. O **modelo de memória** e a **política de agendamento** são conceitos separados.
3. O modo de prova considera o **horizonte** definido pela avaliação.
4. As decisões de agendamento levam em conta o **benefício esperado**, e não só o esquecimento atual.
5. Os algoritmos são **avaliáveis por métricas objetivas**.
6. A agenda pode ser **recalculada** quando novas informações mudam as estimativas ou as restrições.
7. Hipóteses de pesquisa são marcadas como **hipóteses**, não como fatos.
8. A escolha definitiva de modelos, parâmetros e métodos de otimização é fundamentada por **pesquisa e
   experimentação**.
9. Sem acoplamento desnecessário entre o algoritmo de memória, o planejador de agenda e a interface.
10. O **custo computacional** e a viabilidade de execução (tudo roda localmente, no processo principal do
    Electron) pesam na escolha da estratégia de otimização.

## 7. Referências para investigação

São **pontos de partida** de pesquisa. Nenhuma delas é evidência de que um algoritmo específico será
superior em provas com data fixa no Personare, e o projeto ainda não extraiu conclusões delas.

1. Eglington, L. G., e Pavlik, P. I. Jr. (2020). *Optimizing practice scheduling requires quantitative
   tracking of individual item performance.* npj Science of Learning.
   <https://www.nature.com/articles/s41539-020-00074-4>
   Relevância: otimização do agendamento a partir de modelos quantitativos do desempenho individual e do
   custo das sessões.
2. Pavlik, P. I. Jr., e Anderson, J. R. (2008). *Using a Model to Compute the Optimal Schedule of Practice.*
   Journal of Experimental Psychology: Applied. <https://doi.org/10.1037/1076-898X.14.2.101>
   Relevância: uso de modelos computacionais de memória para determinar intervalos de prática.
3. *Optimizing Spaced Repetition Schedule by Capturing the Dynamics of Memory* (2023). IEEE Transactions on
   Knowledge and Data Engineering. <https://ieeexplore.ieee.org/document/10059206/>
   Relevância: formulações de otimização do agendamento baseadas na dinâmica da memória, incluindo
   otimização estocástica e programação dinâmica.

Ao incorporar conclusões dessas ou de outras fontes, registre-as aqui com precisão (o que o trabalho mostra,
em que condições). Não acrescente autores, fórmulas, resultados ou garantias que as fontes não trazem.

## 8. Validação (Trabalho futuro)

Cada modo é avaliado **separadamente**.

**Modo A, métricas a investigar:**

- probabilidade de recordação nos momentos relevantes;
- retenção observada depois de intervalos definidos (o `computeRetention` já mede a retenção observada em
  30 dias e pode servir de ponto de partida);
- quantidade de revisões necessárias;
- tempo total investido;
- relação entre retenção e custo de estudo.

**Modo B, métricas a investigar:**

- recordação estimada e observada na data da avaliação;
- desempenho em questões relacionadas aos conteúdos estudados;
- cobertura dos conteúdos prioritários;
- tempo total de estudo;
- robustez diante de disponibilidade limitada e de mudanças no cronograma.

Os experimentos comparam os algoritmos propostos com referências apropriadas: agendamentos convencionais e
variantes relevantes do FSRS, quando tecnicamente aplicável. **Nenhuma superioridade foi demonstrada pelo
projeto até aqui.**

Restrição a considerar no desenho dos experimentos: os dados ficam só no computador do aluno (`PRODUCT.md`,
princípio 3), e nada é enviado automaticamente. Qualquer coleta para avaliação precisa respeitar isso.

## 9. Decisões de arquitetura (aceitas em 2026-10-09)

Vieram da revisão da arquitetura e foram aceitas pelo usuário ("quero que tudo isso seja documentado como
arquitetura"). Mudar uma delas pede um registro novo aqui, dizendo qual substitui e por quê.

**D1. O modo é do programa.** Ele é escolhido na criação: **"Nunca mais esquecer"** (`study_goal = "retain"`)
ou **"Estudar para uma Prova"** (`study_goal = "test_prep"`, com `target_date` obrigatória). A data é um dia
do calendário local, sem horário na v1.

**D2. Transições.** Programas antigos ficam em `retain`. O modo pode ser trocado na edição. Depois da
`target_date`, o programa é tratado como `retain`; a data continua gravada (para o histórico e para a tela
mostrar "a prova foi em…").

**D3. Um registro por avaliação (`review_logs`).** Toda avaliação de um `ReviewItem` grava uma linha com:
nota; momento; estado, estabilidade e dificuldade **antes** e **depois**; dias desde a avaliação anterior;
a **recordação prevista** pelo modelo no momento da avaliação; a retenção desejada em vigor; o `study_goal`
do programa; e a **duração** da revisão quando a interface consegue medi-la (num flashcard, do momento em
que ele aparece até a nota). O `rating_history` continua como está, para não quebrar o que já o lê.

**D4. Calibração antes de confiar em $R_i(T)$.** A recordação prevista (D3) é comparada com a observada, com
as métricas do benchmark do FSRS (log loss e RMSE por faixa de previsão). Enquanto não houver essa medida,
o Modo B usa $R_i(T)$ só para limitar intervalos (D7), não para ordenar o dia.

**D5. Dois tipos de item.** Flashcards são itens de **recordação**: a nota responde "lembrei?". Quiz, PDF e
link são avaliados pela dificuldade percebida (Issue #77) e, no Modo B, são tratados como **cobertura**:
importa que voltem antes da prova, não a recordação estimada. **Trabalho futuro:** usar o acerto de cada
pergunta do quiz como sinal de recordação.

**D6. Modelo e política separados, sem trocar de biblioteca.** O modelo de memória continua no `ts-fsrs`
(estabilidade, dificuldade e as funções `forgetting_curve` e `get_retrievability`). A política de cada modo
fica em código próprio, em `src/utils/`, como função pura: recebe o que o FSRS propôs e o contexto do
programa, e decide o vencimento. Os handlers em `src/ipc/review/` só montam esse contexto.

**D7. Modo B v1: nada vence depois da véspera.** Para um item de um programa em `test_prep` com a prova
ainda por vir:

- seja *véspera* o início do dia anterior à `target_date`, no horário local;
- se a véspera ainda está no futuro, o vencimento é `min(vencimento do FSRS, véspera)`;
- se a véspera já passou (a prova é hoje ou amanhã), vale o vencimento do FSRS;
- a prévia dos botões de avaliação mostra o vencimento já limitado;
- o programa mostra quantos dias faltam para a prova.

Não muda o modelo de memória, só a política. Vale para os dois tipos de item (D5).

**D8. Modo B depois da v1, só com evidência.**

- **v1.1:** teto diário de revisões e distribuição da carga (o sistema de planejamento), compartilhados com
  o Modo A: com `enable_fuzz` desligado, os vencimentos tendem a se acumular nos mesmos dias. Também é o
  planejador que junta, no mesmo dia, programas nos dois modos.
- **v2:** ordenar o dia por $\operatorname{Score}(i,t)$ (seção 5.2), com
  $R_i(T \mid \text{não revisar agora})$ pela curva de esquecimento até $T$ e
  $R_i(T \mid \text{revisar agora})$ pela média dos resultados possíveis ("lembrou" e "esqueceu"),
  ponderada pela recordação atual. Só entra depois da calibração (D4) e de o simulador (D9) mostrar ganho
  sobre a v1.
- **Pesos:** por módulo, iguais por padrão; opcionalmente vindos do edital.

**D9. Simulador offline.** Em TypeScript, com o mesmo modelo do FSRS e os registros de D3, para comparar
políticas antes de levá-las ao aluno: o FSRS sem limite, o FSRS com retenção de 95%, a v1 e as variantes da
v2.

**D10. Parâmetros por aluno (#228) antes da v2.** Parâmetros ajustados ao histórico melhoram a calibração
(D4), e a v2 depende dela.

**D11. Processo.** Cada hipótese registrada aqui diz **como será testada** e que resultado a confirma, antes
do experimento. Dados para pesquisa só saem do computador por exportação **voluntária e anônima** dos
`review_logs`, no mesmo modelo do registro de erros (`docs/specs/error-log.md`).

## 10. Decisões pendentes

- Se o FSRS é o modelo de memória definitivo do Modo A (seção 4).
- A política do Modo B depois da v1: a heurística da seção 5.2 (v2), otimização dinâmica ou outra
  abordagem. Decidir com o simulador (D9).
- Como medir a disponibilidade do aluno para o teto diário (v1.1).
- O horário da prova, se algum dia fizer diferença (a v1 usa só o dia).

## 11. O que está implementado

| Decisão | Estado | Onde |
|---|---|---|
| Modo A (FSRS com retenção desejada) | Implementado | `src/utils/fsrs.ts`, `docs/specs/desired-retention.md` |
| D1, D2: modo no programa | Implementado | `src/utils/study-goal.ts`, `docs/specs/program-study-goal.md` |
| D3: `review_logs` | Implementado | `docs/specs/review-logs.md` |
| D4: calibração | Trabalho futuro | |
| D5, D6, D7: Modo B v1 | Implementado | `src/utils/scheduling-policy.ts`, `docs/specs/test-prep-scheduling.md` |
| D8 (v1.1, v2), D9, D10 | Trabalho futuro | #228 |
