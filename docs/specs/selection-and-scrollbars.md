# Spec — Seleção de texto e barras de rolagem

- **Pedido do usuário (2026-10-07):** "não gosto do fato que é possível selecionar o texto em toda a
  aplicação [...] quero que seja possível selecionar somente dentro de uma atividade, ou no editor de texto,
  mas nunca em botões ou outras partes da UI", e "em algumas partes da aplicação aparece esse scroll horrendo
  [...] o scroll estilizado devia ser global também".
- **Metodologia:** Spec Driven Development + TDD, um PR (`feature/ui-selection-scroll`).

## Critérios de aceite

1. Nada da interface se seleciona: títulos, textos de tela, botões, cards, menus, a barra lateral, as
   tabelas. Arrastar o mouse ou Ctrl+A não pinta a tela de azul.
2. Seleciona-se o texto **das atividades** (o conteúdo em Markdown: enunciado das perguntas, frente e verso
   dos flashcards, a revisão das respostas) e o que se **digita** (campos, áreas de texto, o editor).
3. As alternativas de uma pergunta são clicáveis como botões: o texto delas não se seleciona.
4. Toda área com rolagem, em qualquer tela, usa a barra fina do app (a cor da borda, sem trilho), e não a
   barra nativa do sistema.
5. A barra de rolagem não invade os cantos arredondados do painel principal: a área que rola começa e
   termina onde a curva do canto (`--radius-xl`) acaba.
