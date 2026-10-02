# Spec — Rede de segurança: desfazer exclusões e proteger o quiz

- **Branch:** `feature/harden-safety-net` (sobre `feature/clarify-ratings`)
- **Origem:** o terceiro P1 da crítica de design: "ações destrutivas e que perdem dados não têm rede
  de segurança". É a etapa `harden` do plano.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

### Desfazer exclusões

1. Depois de excluir um **programa**, **módulo**, **atividade**, **pergunta** ou **flashcard**,
   aparece um aviso ("Pergunta excluída") com **Desfazer**, por alguns segundos.
2. **Desfazer** traz de volta o item e tudo o que **aquela** exclusão escondeu: os módulos de um
   programa, as atividades de um módulo, os cards e as perguntas de uma atividade, as alternativas
   de uma pergunta. A lista se atualiza.
3. O que tinha sido excluído **antes, por conta própria**, continua excluído. A cascata só reverte as
   linhas com o mesmo `deletedAt` da exclusão desfeita.
4. A confirmação de excluir programa, módulo ou atividade avisa que dá para desfazer logo em seguida,
   no lugar de "nada é removido permanentemente" (que não tinha como ser usado).

### Quiz em andamento

5. **Voltar:** a partir da segunda pergunta, um botão "Pergunta anterior" volta uma pergunta, com a
   resposta marcada mantida.
6. **Pergunta sem resposta:** a pergunta ainda sem alternativa escolhida mostra o aviso "Esta
   pergunta ainda não tem resposta e vai contar como errada". Avançar continua possível: pular uma
   pergunta que não se sabe é uma escolha do estudante, só que agora é uma escolha consciente.
7. **Abandonar:** fechar o quiz (X ou Esc) depois de responder alguma pergunta pede confirmação:
   "Sair do quiz? Suas respostas não serão salvas." com "Continuar o quiz" e "Sair". Sem respostas,
   ou com o quiz já concluído, fecha direto como antes.

## Escolhas técnicas

- Os IPCs `programs.restore`, `modules.restore`, `activities.restore`, `flashcards.restore` e
  `quiz.restoreQuestion` leem o `deletedAt` do item e limpam esse mesmo valor nele e nos
  descendentes (`cascadeRestore*` em `src/ipc/shared/cascade-soft-delete.ts`).
- O aviso usa o `sonner`, com o `<Toaster />` na raiz. `showUndoToast({ message, onUndo })` em
  `src/utils/undo-toast.ts`.
