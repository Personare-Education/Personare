# CLAUDE.md

Instruções para agentes (Claude Code) neste repositório. As convenções de branch, commit e verificação
antes do PR estão em `CONTRIBUTING.md`; siga-as.

## Vários PRs de uma vez

Quando um trabalho virar vários PRs (por exemplo, as frentes de uma mesma crítica de design):

- **Empilhe os PRs:** cada branch sai da anterior, e cada PR usa a branch anterior como base. Só o
  primeiro aponta para `main`.
- **CHANGELOG só no último PR da pilha.** Os anteriores não tocam no `CHANGELOG.md`; o último traz as
  entradas de todos. Assim nenhum merge gera conflito no CHANGELOG.
- **Mergeie na ordem, um de cada vez, e só com a base em `main`.** O GitHub só troca a base do
  próximo PR para `main` quando a branch do anterior é apagada no merge; com
  "Automatically delete head branches" desligado no repositório, isso não acontece sozinho. Antes de
  mergear o próximo, confira que a base dele é `main` (troque com `gh pr edit <n> --base main` se
  preciso). Mergear com a base antiga manda o código para a branch anterior, e ele não chega a `main`.
- O CI (`check.yaml`, `testing.yaml`) roda em todo PR, inclusive nos empilhados.

## Agendamento de revisões

Antes de mexer no agendamento (`src/utils/fsrs.ts`, `src/ipc/review/`, retenção, calendário), leia
[`docs/architecture/scheduling.md`](docs/architecture/scheduling.md). Resumo:

- **Dois modos, dois objetivos, não equivalentes.** **Modo A:** retenção a longo prazo, sem data. **Modo B:**
  desempenho numa avaliação com data definida. Os dois podem compartilhar modelo de memória e histórico, mas
  cada um tem a sua política de agendamento.
- **Confirmado (no código):** o que existe hoje é uma forma do Modo A. O `ts-fsrs` agenda cada `ReviewItem`
  com pesos padrão e a retenção desejada pelo aluno (0,80 a 0,95). O Modo B **não existe**. O FSRS é a
  referência do Modo A, e se ele é a escolha definitiva ainda está em aberto.
- **Separe três coisas:** o **modelo de memória** (estima a recordação), a **política de agendamento**
  (decide o que revisar e quando, conforme o objetivo) e o **sistema de planejamento** (disponibilidade,
  calendário, replanejamento). Hoje o modelo e a política vêm acoplados dentro do `ts-fsrs`.
- **Modo B, só a formulação conceitual:** $\max_\pi \sum_i w_i R_i(T \mid \pi)$ e a heurística gulosa
  $\text{Score}(i,t)$ são pontos de partida, **não** o algoritmo. Não implemente uma fórmula definitiva sem
  uma decisão registrada.
- **"Prova" já é outra coisa no app:** `exams` (`docs/specs/exams.md`) é a prova feita dentro do app, sem
  FSRS. Não reaproveite esse nome para o Modo B sem decidir antes.
- Marque hipóteses como hipóteses. Nenhuma superioridade de algoritmo foi demonstrada pelo projeto. As
  decisões pendentes estão na seção 9 do documento; issues #228 e #229.
