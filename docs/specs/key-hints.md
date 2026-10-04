# Spec — Dicas de tecla na revisão

- **Branch:** `feature/key-hints` (2 de 4 PRs empilhados, sobre `feature/brand-primary`)
- **Origem:** P2 da terceira crítica de design: os atalhos 1-4 (avaliar) e Espaço (revelar) existiam, mas
  nada na tela dizia isso.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Cada botão de avaliação mostra a sua tecla (1, 2, 3, 4) ao lado do nome, onde quer que as avaliações
   apareçam (revisão de baralho, sessão de Hoje, avaliação de atividade).
2. **Revelar resposta** mostra a tecla **Espaço**.
3. A dica é visual (um `span` com `aria-hidden`): o nome acessível dos botões não muda, e o atalho continua
   anunciado pelo `aria-keyshortcuts`.
4. O nome da tecla Espaço vem do i18n (pt-BR e inglês).
