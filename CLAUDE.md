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
