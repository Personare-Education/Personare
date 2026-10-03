# Spec — Fins de sessão como cartões, e o azul da marca como cor padrão

- **Branch:** `feature/bolder-cards`
- **Origem:** etapa `bolder` do plano da crítica de design (`.impeccable/critique/`): "o app inteiro na
  linguagem do cartão", "programas nascem vermelhos", "o azul da marca quase não aparece".
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Cor padrão:** um programa novo nasce no azul da marca (`#3b6cf6`), e um programa sem cor também
   aparece nele. O azul da marca entra no lugar do `#3b82f6` na paleta, na mesma posição. Programas que
   já existem mantêm a cor que têm.
2. **Fim da sessão Hoje:** "Tudo revisado" aparece num cartão no azul da marca (o mesmo gradiente,
   anel e brilho dos cards de programa), com a mensagem de quantos itens foram revisados e, abaixo, o
   que foi revisado **por programa**: a cor do programa, o nome e quantos itens. Itens pulados não
   entram.
3. **Fim da revisão de um baralho** (Iniciar revisão, na linha da atividade): "Sessão de revisão
   concluída" aparece num cartão na cor do programa, com quantos cards foram revisados.
4. **Resultado do quiz:** a pontuação, a mensagem de acertos e os tempos ficam num cartão na cor do
   programa do quiz. Os tempos deixam de ser caixas com borda dentro dele. Sem cor conhecida, o cartão
   usa a cor padrão.

## Escolhas técnicas

- `SessionEndCard` (`src/components/session-end-card.tsx`): título em serifada e conteúdo livre, com
  `programTintStyle(color)`, a mesma definição dos cards de programa, dos flashcards e dos itens de Hoje.
- `QuizRunnerDialog` ganha `color`, passado pela página do módulo e pela sessão de Hoje.
