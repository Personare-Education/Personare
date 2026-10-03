# Spec — Uma escala só na coluna "Última avaliação"

- **Branch:** `feature/table-rating-scale` (primeiro de três PRs empilhados; o CHANGELOG fica no último)
- **Origem:** P1 da terceira crítica de design (`.impeccable/critique/2026-10-03T21-39-21Z__src.md`): na
  tabela de Atividades, um quiz mostrava "Entendi" e um baralho "Fácil" (a mesma nota com palavras
  diferentes), e "Fácil" saía como selo preto sólido, parecendo um botão.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Uma escala só:** a coluna "Última avaliação" usa sempre as palavras das atividades ("Não entendi /
   Com esforço / Entendi / Fácil demais"), também para baralhos. A linha descreve a atividade inteira; as
   palavras dos flashcards continuam na revisão card a card.
2. **Selo no tom da avaliação:** cada selo leva o tom do seu nível, como os botões de avaliação (fundo
   leve e borda no tom, texto no tom principal). Nenhum selo usa o estilo de botão principal.
3. O campo `scale` que o #164 acrescentou ao estado de revisão deixa de existir.
