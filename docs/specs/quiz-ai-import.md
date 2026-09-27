# Spec — Importar Quiz gerado por IA (Markdown)

- **Branch:** `feature/quiz-ai-import` (parte de `feature/activity-type-cards`, #129)
- **Pedido:** ao criar uma Atividade do tipo Quiz, a Dialog vira um formulário multi-step. No primeiro
  passo do Quiz o usuário escolhe **Importar de uma IA** ou **Criar manualmente**. Na importação ele
  informa um tema, escolhe a IA, envia um prompt já estruturado com o tema e solta o `.md` gerado num
  dropzone. "Criar manualmente" segue o fluxo de antes.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.
- **Decisões do usuário:** a IA é escolhida num Select (ChatGPT, Claude, Gemini); o botão copia o
  prompt e abre a IA escolhida; depois do arquivo, uma **prévia** pede confirmação.

## Formato do Markdown

```markdown
## Pergunta 1
Enunciado, com uma ou mais linhas (Markdown e LaTeX: $...$ ou $$...$$).

- [ ] Alternativa incorreta
- [x] Alternativa correta
- [ ] Alternativa incorreta
```

- Cada pergunta começa numa linha `## ` (o texto do título é ignorado).
- O enunciado são as linhas entre o título e a primeira alternativa.
- Alternativas são itens de lista de tarefas (`- [ ]` / `- [x]`, também com `*`). Exatamente uma
  marcada como correta.
- Tolerância a respostas de IA: texto antes do primeiro `## ` e cercas de código (```) são ignorados.
- Uma pergunta inválida (sem enunciado, menos de 2 alternativas, ou sem exatamente 1 correta) vira um
  erro com o número da pergunta e **não** impede as válidas.

## Critérios de aceite

1. **Passo "Detalhes"** (título + cards de tipo): com Quiz selecionado ao **criar**, o botão principal é
   "Próximo" em vez de "Salvar". Editar e os outros tipos continuam salvando direto.
2. **Passo "Origem"**: dois cards, "Importar de uma IA" e "Criar manualmente", e "Voltar". Manual +
   "Salvar" cria a Atividade como antes (sem perguntas) e fecha.
3. **Passo "Importar"**:
   - Campo **Tema** e **Select** da IA (ChatGPT, Claude, Gemini).
   - Botão **"Copiar prompt e abrir …"** (desabilitado sem tema): copia o prompt, montado com o tema e no
     idioma do app, e abre a IA no navegador. ChatGPT e Claude recebem o prompt na URL (`?q=`). O Gemini
     não aceita, então só abre, e o app avisa que o prompt está copiado.
   - **Dropzone** para arrastar ou escolher um `.md`.
   - **Prévia**: quantas perguntas foram lidas, a lista delas e os erros de formato. "Criar quiz (N)"
     fica desabilitado com 0 perguntas válidas.
4. Confirmar cria a Atividade, as perguntas e as alternativas **numa única transação**, na ordem do
   arquivo, e fecha a Dialog.
5. Um indicador mostra o passo atual, e a troca de passo tem uma transição curta.

## Escolhas técnicas

- `src/utils/quiz-markdown.ts`: `buildQuizPrompt(theme, language)` e `parseQuizMarkdown(markdown)`,
  funções puras.
- IPC `quiz.createWithQuestions({ moduleId, title, questions })`: transação do drizzle. Perguntas e
  alternativas são ordenadas por `createdAt`, então cada linha recebe um timestamp crescente para
  preservar a ordem do arquivo.
- Dropzone com o hook `use-file-upload` do ReUI. O arquivo é lido no renderer (`File.text()`), sem IPC.
- Cópia com `navigator.clipboard`; a IA abre com a action `openExternalLink` (`shell.openExternal`).
