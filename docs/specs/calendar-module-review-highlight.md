# Spec — Calendário por módulo, revisões pulsantes e navegação em stack

- **Branch:** `feat/calendar-module-review-highlight`
- **Pedido:**
  1. No calendário, o evento mostra o nome do **módulo**, não da atividade. Clicar leva ao programa,
     onde o módulo pulsa; 2,5 segundos depois, vai ao módulo, onde pulsa a atividade a fazer.
  2. Mesmo sem passar pelo calendário, ao abrir um programa/módulo com revisão pendente, o módulo e a
     atividade pulsam até a revisão ser feita. Revisões atrasadas pulsam em vermelho e têm um relógio
     animado ao lado da linha, fora da tabela.
  3. A navegação Programas → Programa → Módulo anima como a Stack navigation do React Navigation.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

### Calendário

1. **Um evento por módulo por dia.** Vários itens de revisão do mesmo módulo no mesmo dia (atividades
   diferentes ou flashcards do mesmo deck) viram um único evento, com o nome do módulo como título.
2. **Clique no evento:** abre o programa do módulo (`/programs/$programId`) com o módulo em foco
   (`?focusModuleId=…&focusDate=yyyy-MM-dd`).
3. A sincronização com o Google Calendar não muda (continua um evento por item de revisão).

### Programa (lista de módulos)

4. O módulo em foco pulsa na cor de destaque. **Depois de 2,5 segundos**, o app vai para esse módulo
   (`/programs/$programId/modules/$moduleId?focusDate=…`), substituindo a entrada do programa no
   histórico: voltar a partir do módulo retorna ao calendário, sem repetir o redirecionamento.
5. Sem foco, cada módulo com revisão pendente pulsa:
   - **hoje** (vence hoje): cor de destaque (`--primary`);
   - **atrasada** (venceu antes de hoje e não foi feita): vermelho (`--destructive`), com um ícone de
     relógio animado ao lado da linha, fora da tabela.
   Um módulo com as duas situações conta como atrasado.

### Módulo (lista de atividades)

6. Cada atividade com revisão pendente pulsa com as mesmas regras do item 5 (hoje / atrasada + relógio).
   Um deck com qualquer flashcard pendente conta como pendente.
7. Vindo do calendário (`focusDate`), também pulsam as atividades do módulo com revisão naquele dia,
   mesmo que seja uma data futura.
8. Ao fazer a revisão (avaliar a atividade ou terminar a sessão de flashcards), o pulso some sem
   recarregar a página, porque o vencimento passa para o futuro.

### Navegação em stack

9. Descer um nível (Programas → Programa → Módulo, ou Calendário → Programa) anima como **push**: a tela
   nova entra deslizando da direita, e a anterior recua um pouco para a esquerda e escurece.
10. Subir um nível (voltar, breadcrumb) anima como **pop**, o movimento inverso.
11. Só a área de conteúdo anima; a sidebar fica parada. Outras navegações (sidebar, configurações) não
    animam.
12. Com `prefers-reduced-motion: reduce`, não há deslize nem pulso: o destaque vira uma cor fixa.

## Escolhas técnicas

- **Pendência calculada no renderer**, a partir do `review.listSchedule` que o calendário já usa (um
  item por flashcard ou por atividade, com `programId`, `moduleId`, `activityId` e `dueDate`). Uma
  função pura em `src/utils/review-highlight.ts` classifica cada item (`overdue` / `today` / nada) e
  agrega por atividade e por módulo, com `overdue` prevalecendo. Ela também agrupa as linhas em eventos
  de calendário por módulo/dia. O `listSchedule` passa a trazer `moduleName`.
- **Pulso por CSS:** um `@keyframes` que anima só o fundo da linha até `color-mix` da cor de destaque,
  para o texto não piscar (o `animate-pulse` do Tailwind anima a opacidade da linha inteira). A cor vem
  de uma variável, e a variante atrasada troca `--primary` por `--destructive`.
- **Relógio fora da tabela:** o wrapper do shadcn (`overflow-x-auto`) cortaria um ícone posicionado
  para fora da linha, por isso os relógios ficam numa calha ao lado da tabela, alinhados pela posição
  medida de cada linha (`data-row-id` + `ResizeObserver`).
- **Stack navigation:** View Transitions API (nativa no Chromium do Electron), ligada pelo
  `defaultViewTransition` do TanStack Router. Uma função pura decide o tipo (`stack-push` /
  `stack-pop` / sem animação) pela profundidade da rota (`/` = 0, programa = 1, módulo = 2). As
  animações ficam em CSS, com `:active-view-transition-type()`, sobre um `view-transition-name` dado só
  ao painel de conteúdo (`SidebarInset`, que tem fundo próprio: o que desliza é opaco).
- **A página nova só monta depois do deslize.** Montada durante a transição, ela aparecia no meio do
  deslize por cima da anterior. Além disso, a renderização dela (a grade de programas, quando os dados
  chegam) travava a animação. Durante um push/pop, só o painel vazio desliza; ao fim, a página monta
  e entra com um fade in rápido. O TanStack Router não expõe a `ViewTransition`, então
  `src/utils/stack-content-reveal.ts` envolve o `document.startViewTransition` e levanta uma flag no
  início do `update` (a página antiga já foi capturada nesse ponto), e `StackContent` segura o
  `<Outlet />` enquanto ela estiver ativa.

## Fora de escopo

- Atividades não são uma tela própria: abrem diálogos. A stack vai até o módulo, e a atividade é
  indicada pelo pulso.
- Mudança de dia com o app aberto: a pendência é recalculada ao abrir a página, não à meia-noite.
