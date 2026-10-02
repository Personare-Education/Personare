# Spec — Editor único dos flashcards e criação encadeada

- **Branch:** `feature/quiz-question-single-editor` (continua `quiz-question-single-editor.md`)
- **Pedido:**
  1. Ao criar uma atividade de **Quiz manual** ou de **Flashcards**, a janela de criação do primeiro
     item (pergunta ou card) já abre.
  2. A janela de flashcard usa o mesmo editor e os mesmos princípios da janela de perguntas do Quiz.
     O primeiro envio é a **frente**, o segundo o **verso**. O card aparece como um cartão que gira
     no eixo vertical ao ser clicado.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

### Criação encadeada

1. Criar uma atividade do tipo **Quiz** pelo caminho "Criar manualmente" abre o gerenciador de
   perguntas dela **com a janela da primeira pergunta já aberta**. Ao concluir, fica o gerenciador
   com a lista do que foi criado.
2. Criar uma atividade do tipo **Flashcards** faz o mesmo com o gerenciador de flashcards e a janela
   do primeiro card.
3. Editar uma atividade, criar Link/PDF ou importar um quiz de IA não abre nada a mais.

### Janela de flashcard

4. **Travada** como a de perguntas: clicar fora ou Esc balança; fecha só por **Concluir** ou **X**.
5. **Um único editor** (`MarkdownComposer`): Enter quebra a linha, Shift+Enter (ou o botão) envia.
   O primeiro envio vira a **frente**; o segundo, o **verso**. Com as duas faces preenchidas e nada
   em edição, o editor fica desabilitado.
6. **Cartão que gira:** frente e verso aparecem num cartão já renderizado. Clicar no cartão (ou em
   "Virar") gira o cartão no eixo vertical e mostra a outra face. Ao adicionar o verso, o cartão
   gira para mostrá-lo.
7. Abaixo do cartão: **Editar** (a face visível vai para o editor; o envio seguinte a substitui) e,
   se a face visível tiver imagem, **Ver imagem**. O texto não enviado volta ao editor ao terminar a
   edição, como nas perguntas.
8. **Adicionar flashcard:** envia o que estiver no editor, valida (frente e verso), salva, faz
   fade-out/fade-in com o formulário vazio para o próximo card.
9. **Concluir:** envia o que estiver no editor, valida, salva e fecha. Sem nada, só fecha.
10. Ao editar um card existente, o primeiro salvamento o atualiza; os seguintes são criados.

### Revisão do baralho

11. A sessão de revisão mostra o flashcard no **mesmo cartão que gira**: começa na frente, e
    **Revelar resposta** (ou clicar no cartão) gira o cartão para o verso e mostra as avaliações.
12. O verso só entra no cartão quando é revelado: antes disso, não está na tela nem na árvore.
13. Depois de avaliar, o próximo card aparece já na frente, **sem** girar de volta (girar de volta
    mostraria o verso do próximo card no meio do giro).

## Escolhas técnicas

- `onSubmit(flashcardId | null, values): Promise<void>`. A janela decide quando fechar, e o
  gerenciador só salva e recarrega a lista.
- Os gerenciadores ganham `startWithNewItem`: ao abrir com ele, a janela de novo item já abre.
- A página decide o que abrir depois de criar com `followUpForCreatedActivity(type)`
  (`src/utils/activity-follow-up.ts`), uma função pura e testada. Um quiz que chega pelo `onSubmit`
  é sempre o manual: o de IA chega pelo `onImportQuiz`.
- O cartão é o componente `FlipCard`, usado pela janela de flashcard e pela revisão. O giro é CSS 3D (`perspective`, `transform-3d`, `backface-hidden`, `rotate-y-180`), com
  `motion-reduce` sem animação.
- O `MarkdownComposer` ganha `disabled`. O `MarkdownEditor` antigo deixa de ser usado e é removido.
