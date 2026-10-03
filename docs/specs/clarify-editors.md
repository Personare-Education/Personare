# Spec — Editores de flashcard e pergunta: o que está salvo e qual botão apertar

- **Branch:** `feature/clarify-editors`
- **Origem:** P1 da segunda crítica de design (`.impeccable/critique/2026-10-03T19-05-40Z__src.md`): "os
  editores escondem quando o item está salvo", com "Editar frente", "Adicionar frente", "Adicionar
  flashcard", "Concluir" e um cartão "Ainda vazio" competindo.
- **Decisão do usuário:** manter o editor único do #148 (frente, depois verso, cartão que gira; enunciado,
  depois alternativas) e atacar só o que confunde.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Contador do que já está salvo:** o rodapé do editor diz "3 cards salvos neste baralho" (ou "Nenhum
   card salvo ainda") e "2 perguntas salvas neste quiz". O número vem do gerenciador e sobe a cada
   salvamento; é anunciado a leitores de tela (`aria-live`).
2. **O botão do rodapé diz o que faz:** "Adicionar flashcard" vira **Salvar e criar outro** e "Adicionar
   pergunta" vira **Salvar e criar outra**, discretos. **Concluir** continua o principal. O botão de
   adicionar dos gerenciadores não muda.
3. **Cartão vazio sem "Clique para virar":** enquanto frente e verso estão vazios, o cartão do editor de
   flashcard não oferece virar. Com uma das faces preenchida, a dica volta.
4. Textos em pt-BR e inglês.
