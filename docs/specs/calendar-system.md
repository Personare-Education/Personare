# Spec — O Calendário no mesmo sistema do resto do app

- **Branch:** `feature/calendar-system` (terceiro de três PRs empilhados, sobre `feature/focus-rings`; traz
  o CHANGELOG dos três)
- **Origem:** P1 da terceira crítica de design (`.impeccable/critique/2026-10-03T21-39-21Z__src.md`): o
  Calendário não tinha título, abria num "Sincronizar agora" desabilitado, mostrava eventos cinza com o
  nome do módulo e sem a cor do programa, e o número do dia ficava embaixo à direita, fazendo cada evento
  parecer do dia de cima.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Título:** a página tem o título serifado "Calendário", como as outras.
2. **Sincronizar só quando dá:** sem o Google Agenda conectado, o botão não aparece; fica só a frase que
   explica como conectar, discreta, ao lado do título. Conectado, "Sincronizar agora" aparece ali.
3. **Eventos na cor do programa:** cada evento leva a cor do seu programa e o título "Módulo · N
   atividades" (atividades distintas daquele módulo no dia).
4. **Número do dia no topo:** o número fica no canto de cima da célula, antes dos eventos. Os dias fora
   do mês ficam com o fundo apagado.
5. Textos em pt-BR e inglês.

## Escolhas técnicas

- `toCalendarEvents(rows, formatTitle?)`: `color` com `resolveProgramColor`, e o título pelo
  `formatTitle(moduleName, activityCount)` que a página passa com o i18n (sem ele, o nome do módulo).
- O ReUI não é alterado: o número sobe com `classNames.monthCellFooter` (`order-first`), as barras descem
  com `classNames.monthBarOverlay`, e os dias de fora usam `classNames.monthCell` com `data-outside`.
