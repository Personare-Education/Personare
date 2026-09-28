# Spec — Ícone do app (placeholder)

- **Branch:** `feat/app-icon`
- **Pedido:** usar o logo gerado para o site (`personare-website/public/favicon.svg`) como placeholder do
  ícone do Personare: dentro do app, no ícone do aplicativo/instalador e no ícone da bandeja.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. **Dentro do app:** a sidebar mostra o logo (grade 2×2 de quadrados arredondados, três na cor do texto
   com opacidade crescente e o último no azul da marca `#3b6cf6`), no lugar do ícone de chapéu de formatura.
   Segue o tema claro/escuro.
2. **Ícone do aplicativo:** o executável e o instalador do Windows (`.ico`), o app do macOS (`.icns`) e os
   pacotes do Linux (`.png`) usam o logo sobre um fundo escuro arredondado, legível em docks e barras de
   tarefas claras ou escuras.
3. **Bandeja:** o ícone da bandeja é a mesma grade, toda no azul da marca com opacidade crescente, legível
   em barras claras ou escuras.

## Escolhas técnicas

- `PersonareLogo` (`src/components/personare-logo.tsx`) é o mesmo SVG do site, com as cores do tema; a cor da
  marca vira o token `--brand` (`fill-brand`), como no site.
- Os ícones do aplicativo (`assets/icon.png`, `.ico` com 16–256 px, `.icns`) são gerados por
  `scripts/generate-icons.py` (Pillow), desenhando em 4× e reduzindo para as bordas ficarem suaves. Para
  trocar pelo logo definitivo, basta mudar o desenho no script e rodá-lo de novo.
- O ícone da bandeja continua gerado em memória (`src/main/tray-icon.ts`), sem arquivo de imagem.
