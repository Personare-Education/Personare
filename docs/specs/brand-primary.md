# Spec — O botão principal no azul da marca

- **Branch:** `feature/brand-primary` (1 de 4 PRs empilhados; o CHANGELOG fica no último)
- **Origem:** P2 da terceira crítica de design (`.impeccable/critique/2026-10-03T21-39-21Z__src.md`): o botão
  principal era preto no claro e cinza-claro no escuro, onde parecia desabilitado; o azul da marca quase
  nunca dizia "faça isto agora". Decisão do usuário: todo botão principal em azul.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Claro:** `--primary` é um azul da marca um pouco mais escuro, `#2f5ce0`, com texto branco (5,6:1). O
   `#3b6cf6` puro daria só 4,5:1, no limite.
2. **Escuro:** `--primary` é um azul da marca claro, `#7a9cf9`, com texto escuro (`#171717`, 6,8:1). Assim o
   botão não parece desabilitado e o mesmo azul serve de texto sobre o cartão escuro (5,7:1).
3. Todo lugar que já usa `--primary` herda o azul: botões principais, barra de progresso, dia de hoje no
   calendário, links, etapas do formulário de atividade. Os botões secundários continuam neutros.
4. Um teste lê os tokens do `global.css` e garante 4,5:1 do texto sobre o botão e do azul como texto sobre o
   cartão, nos dois temas.
