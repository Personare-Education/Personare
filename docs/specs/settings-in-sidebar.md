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

## Revisão (2026-10-08): só no menu da conta

- **Pedido do usuário:** "redundante ter um botão de configurações aqui também já que tem no botão de conta".
- Os critérios 1 a 3 acima deixam de valer. O rodapé da barra lateral volta a ter só a sequência, o ranking e
  o menu da conta, e **Configurações** se abre pelo menu da conta, como antes.
