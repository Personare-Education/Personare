# Spec — O fim do quiz é a hora de avaliar

- **Branch:** `feature/quiz-result-rating` (2 de 5 PRs empilhados, sobre `fix/relearn-in-session`)
- **Origem:** P1 da quinta crítica de design: o resultado do quiz parecia uma prova (medidor vermelho/verde,
  "500 de 1000 pontos", cronômetro) e a avaliação vinha depois, num segundo diálogo que nem mostrava a
  pontuação. Treino de memória tratado como desempenho, e a decisão (avaliar) longe da evidência (o
  acerto).
- **Decisão do usuário:** o resultado atual será reaproveitado na futura atividade **Prova/Simulado**, que
  ficará na tela do programa. Ele é guardado como está, num componente próprio (`QuizScoreResult`), e o quiz
  ganha um resultado novo.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Ao finalizar o quiz, um único diálogo mostra, à esquerda, as respostas revisadas (como antes) e, ao lado,
   **"1 de 2 certas"** em destaque, uma marca por pergunta (certa ou errada, na ordem) e as quatro avaliações
   da atividade com o intervalo de cada uma. Sem pontos de 1000, sem medidor, sem tempo médio ou total.
2. Uma avaliação vem **sugerida** pela proporção de acertos (menos da metade: "Não entendi"; até 79%: "Com
   esforço"; até 99%: "Entendi"; tudo certo: "Fácil demais"): ela tem um contorno, o texto "Sugestão pela sua
   pontuação: …" diz qual é, e o foco começa nela. Nada é marcado sozinho.
3. Avaliar ali salva a avaliação, fecha o quiz e avisa quem abriu (`onRated`): na tela de atividades a tabela
   se atualiza; na sessão de Hoje o item conta como revisado e a sessão segue. Não existe mais "Concluir quiz"
   nem o segundo diálogo de avaliação nesse caminho.
4. Se salvar falhar, o resultado continua aberto com "Não foi possível salvar a avaliação. Tente de novo.".
5. Fechar o resultado sem avaliar (X ou Esc) continua como antes: quem abriu pede a avaliação
   (`onFinished`). E o quiz finalizado deixa a avaliação pendente até ser feita.
6. Nas respostas revisadas, o ✓ da certa é verde e o ✗ da errada é vermelho (os mesmos tons do retorno de cada
   pergunta), em vez de azul.
7. `QuizScoreResult` (o resultado antigo: gráfico, pontos de 1000, tempos) continua existindo e testado, para
   a Prova.
