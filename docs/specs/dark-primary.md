# Spec — O botão principal no escuro não parece desabilitado

- **Branch:** `fix/dark-primary` (4 de 5 PRs empilhados, sobre `feature/today-layout`)
- **Origem:** P2 da quinta crítica de design: no tema escuro o botão principal era um azul claro (`#7a9cf9`)
  com texto quase preto, que lembra o estado desabilitado do tema claro (compare "Confirmar resposta"
  desabilitado no claro com "Começar" no escuro). O azul no botão principal continua (decisão do
  `brand-primary.md`); muda a execução no escuro.
- **Por que dois tokens:** o `--primary` fazia dois papéis no escuro: fundo de botão com texto (pede um azul
  escuro o bastante para texto branco) e cor de texto sobre o cartão escuro (pede um azul claro). Nenhum azul
  serve aos dois a 4,5:1. O fundo fica com `--primary`; o texto azul passa a `--brand-text`, que já existe
  para isso nos dois temas.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. No escuro, o `--primary` é o mesmo azul da marca do claro (`#2f5ce0`), com texto branco (5,6:1).
2. O botão se destaca do fundo escuro (3:1 ou mais, o mínimo para componentes).
3. Texto na cor da marca usa `text-brand-text` (o marcador de hoje e os eventos do calendário, os links de
   botão e de selo); nenhum `text-primary` no código.
