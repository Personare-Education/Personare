# Spec — Rever a introdução pelas Configurações

- **Branch:** `feature/replay-welcome`
- **Pedido:** um botão em Configurações para ver de novo a introdução (as boas-vindas da tela Hoje,
  `docs/specs/onboard-empty-states.md` AC-1).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Em **Configurações → Geral**, a seção **Introdução** diz "Veja de novo como o Personare funciona." e
   tem o botão **Ver introdução**.
2. **Ver introdução** fecha as Configurações e abre a tela Hoje com as boas-vindas (`/?welcome=true`):
   a frase do site, a mensagem e os três passos.
3. Para quem já tem programas, as boas-vindas aparecem no lugar do conteúdo de Hoje, com **Voltar para
   Hoje** no lugar de **Criar primeiro programa**. **Voltar para Hoje** tira o `welcome` da URL e mostra
   Hoje como antes.
4. Sem nenhum programa, a tela continua igual à da primeira abertura.
5. Textos em pt-BR e inglês.
