# CLAUDE.md

Instruções para agentes (Claude Code) neste repositório. As convenções de branch, commit e verificação
antes do PR estão em `CONTRIBUTING.md`; siga-as.

## Vários PRs de uma vez

Quando um trabalho virar vários PRs (por exemplo, as frentes de uma mesma crítica de design):

- **Empilhe os PRs:** cada branch sai da anterior, e cada PR usa a branch anterior como base. Só o
  primeiro aponta para `main`.
- **CHANGELOG só no último PR da pilha.** Os anteriores não tocam no `CHANGELOG.md`; o último traz as
  entradas de todos. Assim nenhum merge gera conflito no CHANGELOG.
- **Mergeie na ordem, um de cada vez,** e espere o GitHub trocar a base do próximo PR para `main`
  antes de mergeá-lo. Mergear antes disso manda o código para a branch antiga, e ele não chega a
  `main`.
