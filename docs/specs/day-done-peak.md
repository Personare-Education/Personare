# Spec — O fim do dia como ponto alto

- **Branch:** `feature/day-done-peak` (5 de 5 PRs empilhados, sobre `fix/dark-primary`; leva o CHANGELOG dos
  cinco)
- **Origem:** P2 da quinta crítica de design: o hábito diário é a métrica número 1 do produto, e a memória de
  uma experiência se forma no pico e no fim. Mas o fim do dia era um relatório: "Dia concluído" no mesmo
  tamanho de qualquer título de seção, a sequência numa linha, e o mesmo resumo por programa duas vezes
  seguidas (o "Tudo revisado" da sessão e, ao fechar, o "Dia concluído" da tela).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Uma sessão aberta pelo **Começar** (o dia inteiro) fecha sozinha ao terminar, direto na tela do dia: sem o
   cartão "Tudo revisado" no meio. Uma sessão aberta por um item só continua terminando no cartão, já que o
   dia ainda tem o resto.
2. O título do dia concluído vira o destaque da tela: serifado grande ("Dia concluído", ou "Dia livre").
3. A sequência aparece como **número grande**, com "dias seguidos" ao lado e a chama, em vez de uma frase.
4. Continua: o que cada programa recebeu hoje (as casas na cor dele, que se preenchem) e os próximos 7 dias.
