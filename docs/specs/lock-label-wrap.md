# Spec — A trava quebra linha nas tabelas de módulos e de atividades

- **Pedido do usuário (2026-10-08):** "o layout do módulo está quebrando", "é só no L e no XL": num programa
  com regras longas ("Libera depois de Funções e Limites, Derivadas: Definição e Regras Básicas, ..."), a
  tabela de módulos ganha rolagem horizontal e as ações saem da tela.
- **Causa:** a célula do nome (`TableCell`, com `whitespace-nowrap`) junta nome, cadeado e a lista do que
  falta numa linha só. A tabela de provas já quebra linha nessa célula; as de módulos e de atividades não.
- **Branch:** `fix/lock-label-wrap`.

## Critérios de aceite

1. Nas tabelas de **módulos** e de **atividades**, a célula do nome quebra linha: um nome ou uma trava longa
   desce para a linha de baixo em vez de alargar a tabela, como na tabela de provas.
2. Em M, L e XL, com as regras do programa do print (8 módulos, travas de até 7 nomes), numa janela de
   1030 px, nenhuma das tabelas tem rolagem horizontal, e as ações ficam à vista.
