# Spec — Acessibilidade: contraste, rótulos e a barra lateral em janela estreita

- **Branch:** `feature/audit-a11y`
- **Origem:** etapa `audit` do plano da crítica de design (`.impeccable/critique/`), persona Sam.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Botão de tema:** tem nome acessível ("Alternar tema" / "Toggle theme"). Hoje é só um ícone.
2. **Texto secundário sobre o tom do programa:** os rótulos "Frente"/"Verso" e "Clique para virar" do
   flashcard, e o tipo e o módulo nos itens de Hoje, passam a usar o texto principal com transparência
   (`text-foreground/70`) no lugar do cinza. No tema claro, o cinza sobre o azul a 38% fica em cerca de
   2,8:1, e o texto principal a 70% fica em cerca de 5,3:1 (mínimo AA: 4,5:1).
3. **Iniciais do avatar:** passam para o texto principal. Hoje o cinza sobre o fundo `muted` dá 4,3:1.
4. **Heatmap no escuro:** a célula vazia fica visível sobre o cartão (de cerca de 1,2:1 para cerca de
   1,5:1, igual ao contraste do tema claro).
5. **Barra lateral em janela estreita:** abaixo de 1024px de largura, a barra lateral recolhe para os
   ícones. Acima, volta a abrir. Entre uma mudança de largura e outra, o botão de recolher continua
   funcionando.
6. Textos em pt-BR e inglês.

## Escolhas técnicas

- Contraste calculado pela luminância em OKLCH (com croma zero, a luminância é L³) e, nas cores,
  pela mistura do `color-mix` sobre o cartão.
- `useSidebarAutoCollapse` (`src/hooks/use-sidebar-auto-collapse.ts`): `open` controlado do
  `SidebarProvider`, que segue `matchMedia("(max-width: 1023px)")`.
