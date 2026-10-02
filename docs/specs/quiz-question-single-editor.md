# Spec — Editor único para criar perguntas do Quiz

- **Branch:** `feature/quiz-question-single-editor`
- **Pedido:** a Dialog que cria/edita perguntas do Quiz (`QuizQuestionFormDialog`, aberta pelo
  "Gerenciar perguntas") deixa de ter um textarea por enunciado e por alternativa. Passa a ter **um
  único editor**, no estilo do editor de comentários do GitHub, que alimenta uma pilha de cartões já
  renderizados (preview).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Dialog travada**, como no quiz em andamento: clicar fora ou apertar Esc **não** fecha; a Dialog
   balança (a mesma animação do `QuizRunnerDialog`). Ela só fecha pelo botão **Concluir** ou pelo **X**.
2. **Editor único** (`MarkdownComposer`), parecido com o do GitHub:
   - Abas **Escrever** / **Pré-visualizar**.
   - Barra de formatação: título, negrito, itálico, citação, código, link, lista numerada, lista com
     marcadores e anexar imagem. Cada botão aplica a sintaxe Markdown na seleção (ou no cursor).
   - Rodapé: "Suporta Markdown" e "Cole, arraste ou clique para adicionar uma imagem". A imagem fica
     pendente no editor (com botão de remover) até o envio.
   - **Não** fala de LaTeX (as fórmulas continuam funcionando, só não são anunciadas).
   - **Enter** quebra a linha; **Shift+Enter** envia. Também há um botão de enviar.
   - Enviar sem texto e sem imagem não faz nada.
3. **Ordem do envio:** o primeiro envio (texto e/ou imagem) vira o **enunciado**; os seguintes viram
   **alternativas**, na ordem em que foram enviados.
4. **Pilha em preview:** enunciado e alternativas aparecem um abaixo do outro, já renderizados
   (`MarkdownContent`), acima do editor.
   - Enunciado: botão **Editar** e, se tiver imagem, botão de **ver a imagem**.
   - Cada alternativa: área pontilhada de **arrastar** (reordena as alternativas), botão **Marcar como correta** (exatamente uma; a
     marcada mostra "Correta"), **Editar**, **ver a imagem** (se houver) e **Remover**.
5. **Editar** joga o conteúdo (texto e imagem) do item para o editor; o item fica destacado e o envio
   seguinte **substitui** aquele item, no mesmo lugar. Um botão cancela a edição. O que estava sendo
   digitado antes de clicar em Editar volta para o editor ao terminar.
6. **Adicionar pergunta:** envia o que estiver no editor, valida (enunciado, ≥ 2 alternativas,
   exatamente 1 correta), salva a pergunta, faz um fade-out e um fade-in com o formulário vazio para a
   próxima pergunta.
7. **Concluir:** envia o que estiver no editor, valida e salva a pergunta atual e fecha a Dialog. Sem
   nada na pergunta atual, só fecha.
8. Uma validação que falha mostra a mensagem na Dialog e não salva.
9. Ao editar uma pergunta existente, o primeiro salvamento a atualiza; as perguntas seguintes
   (depois de "Adicionar pergunta") são criadas.
10. As alternativas são gravadas **na ordem da pilha**.

## Escolhas técnicas

- `src/components/markdown-composer.tsx`: o editor. `src/utils/markdown-format.ts`: as funções puras
  da barra de formatação (`(texto, seleção) → (texto, seleção)`).
- Arrastar usa o **Sortable do ReUI** (`src/components/reui/sortable.tsx`, sobre o dnd-kit), com a
  animação dele e o mesmo ícone de arrastar (`GripVerticalIcon`). Pelo teclado: Espaço pega a
  alternativa, as setas movem e Espaço solta.
- A balançada vira o hook `useDialogShake`, usado pelo quiz e por esta Dialog.
- Imagem: clicar usa o seletor nativo (`selectImageFile`); arrastar um arquivo usa o caminho dele
  (`window.personare.getPathForFile`); colar uma imagem da área de transferência (sem caminho) usa
  o novo `attachments.saveImageData` (bytes em base64 + extensão).
- `onSubmit(questionId | null, text, imagePath, options): Promise<void>` — a Dialog decide quando
  fechar. O gerenciador cria as alternativas **uma de cada vez**, para a ordem de inserção seguir a
  pilha.
- O `MarkdownEditor` (flashcards) não muda.
