# Spec — Começar onde o olho já está

- **Branch:** `feature/today-layout` (3 de 5 PRs empilhados, sobre `feature/quiz-result-rating`)
- **Origem:** P2 da quinta crítica de design: na tela Hoje, a mais importante do app (princípio 1, "Hoje
  primeiro"), o **Começar** ficava alinhado à direita, a uns 1000px do resumo e dos cartões, e sem atalho de
  teclado; cada cartão levava um selo "Hoje" numa página que já se chama Hoje; e o selo de atrasadas do resumo
  ainda usava o vermelho de pouco contraste.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. O **Começar** fica logo abaixo do resumo ("3 atividades para hoje · 1 atrasada"), no mesmo bloco, alinhado
   à esquerda com ele.
2. **Enter** começa a sessão do dia, quando nada tem o foco (nenhum campo, botão ou diálogo); o botão mostra a
   tecla (`KeyHint`) e a anuncia (`aria-keyshortcuts`).
3. Nos cartões, o selo de urgência só aparece quando o item está **atrasado**; o "Hoje" sai.
4. O selo de atrasadas do resumo usa `--destructive-text`, como o dos cartões.
