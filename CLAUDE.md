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

Antes de mexer no agendamento (`src/utils/fsrs.ts`, `src/ipc/review/`, retenção, calendário, objetivo do
programa), leia [`docs/architecture/scheduling.md`](docs/architecture/scheduling.md). As decisões aceitas
estão na seção 9 (D1 a D11) e o que já está implementado na seção 11. Resumo:

- **Dois modos, dois objetivos, não equivalentes, escolhidos por programa, na página do programa acima
  dos módulos (D1).** Todo programa nasce no Modo A.
  **"Nunca mais esquecer"** (`study_goal = "retain"`, Modo A): retenção a longo prazo, com o FSRS e a
  retenção desejada. **"Estudar para uma Prova"** (`study_goal = "test_prep"` + `target_date`, Modo B):
  desempenho numa prova com data.
- **"Prova" já é outra coisa no app:** `exams` (`docs/specs/exams.md`) é a prova feita dentro do app, sem
  FSRS. No código e no banco, o Modo B nunca usa `exam`.
- **Modelo de memória ≠ política de agendamento ≠ planejamento.** O modelo é o `ts-fsrs`. A política de cada
  modo é uma função pura em `src/utils/` (D6).
- **Modo B v1 (D7):** nenhum vencimento depois da véspera da prova; depois da data, o programa volta a agir
  como Modo A (D2). A ordenação por $\text{Score}(i,t)$ (v2) só entra com calibração (D4) e simulador (D9).
- **Toda avaliação grava um `review_logs` (D3)**, com a recordação prevista e a duração quando medida.
- Marque hipóteses como hipóteses. Nenhuma superioridade de algoritmo foi demonstrada pelo projeto.
  Mudar uma decisão pede um registro novo na seção 9.
