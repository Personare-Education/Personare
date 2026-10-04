# Spec — Configurações na barra lateral

- **Branch:** `feature/settings-in-sidebar` (4 de 4 PRs empilhados, sobre `feature/row-primary-action`; traz
  o CHANGELOG dos quatro)
- **Origem:** P2 da terceira crítica de design: Configurações só se achava pelo menu da conta
  ("Convidado / Personare"), a dois cliques.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. O rodapé da barra lateral tem o item **Configurações**, com a engrenagem, acima da sequência de dias.
2. Clicar abre o mesmo diálogo de Configurações do menu da conta (que continua lá).
3. Com a barra recolhida, o item vira só o ícone, com a dica "Configurações", como os outros itens.
