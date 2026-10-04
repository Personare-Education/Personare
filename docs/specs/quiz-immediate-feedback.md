# Spec — Quiz com resposta na hora

- **Branch:** `feature/quiz-immediate-feedback` (4 de 6 PRs empilhados, sobre `fix/review-focus-errors`)
- **Origem:** pedido do usuário na quarta rodada de crítica: "Quero também um feedback visual de acerto para o
  usuário saber que errou ou não. vamos sair dessa abordagem de poder voltar a questão pra refazê-la. Quero
  que o Feedback seja logo após ele selecionar e confirmar a resposta daquela questão em específico."
  Substitui o "Pergunta anterior" e o aviso de pergunta sem resposta de `safety-net.md` (AC-5, AC-6).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Em cada pergunta o estudante escolhe uma alternativa e confirma com **"Confirmar resposta"**. Antes de
   escolher, o botão fica indisponível e o aviso diz "Escolha uma alternativa e confirme."
2. Ao confirmar, a pergunta trava (as alternativas não mudam mais) e o resultado aparece na hora:
   - acertou: a alternativa escolhida fica verde, com ✓, e o aviso "Resposta certa!";
   - errou: a escolhida fica vermelha, com ✗, a certa fica verde, com ✓, e o aviso "Não foi dessa vez. A
     resposta certa é:" seguido do texto dela.
   O aviso é anunciado a leitores de tela (`role="status"`).
3. Depois de confirmar, o mesmo botão vira "Próxima pergunta" (ou "Finalizar quiz" na última); o foco não se
   perde. Na pergunta seguinte, o foco vai para a primeira alternativa.
4. Não dá para voltar a uma pergunta já respondida: não existe mais "Pergunta anterior".
5. O resultado final (pontuação, tempos e a revisão por pergunta) continua como está, com as respostas
   confirmadas.
6. Sair no meio continua pedindo confirmação assim que alguma alternativa foi escolhida.

## Fora do escopo

- A atividade "Prova/Simulado", que **não** mostra a resposta na hora (só no fim), vem depois. Por isso o
  retorno de cada pergunta fica num componente próprio (`QuizAnswerFeedback`) e no estado `answers` das
  perguntas confirmadas, fáceis de desligar num modo prova.
