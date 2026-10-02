# Spec — Tipografia: Newsreader + Instrument Sans

- **Branch:** `feature/typography`
- **Pedido:** trocar a Geist por uma tipografia no espírito da do Claude (Anthropic), que combina uma
  serifada de texto com itálico expressivo (Tiempos/Copernicus) e uma sans limpa (Styrene). As duas
  são licenciadas, então a escolha é por alternativas gratuitas.
- **Origem:** etapa `typeset` do plano que saiu da crítica de design (`.impeccable/critique/`).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Escolha

Comparadas lado a lado com conteúdo real do app: Newsreader + Instrument Sans, Source Serif 4 +
Hanken Grotesk, e Literata + Schibsted Grotesk.

- **Newsreader** (serifada de texto, eixos de tamanho óptico e de peso, com itálico de verdade) é a
  mais próxima da Tiempos/Copernicus: compacta, com itálico expressivo e negrito firme.
- **Instrument Sans** (grotesca enxuta e um pouco estreita) é a mais próxima, em espírito, da
  Styrene. Lê bem em botões, rótulos e metadados.
- **Geist Mono** continua para código.

As fontes vêm em pacotes `@fontsource-variable`, dentro do app: ele roda offline e não depende de
CDN.

## Critérios de aceite

1. **Papéis:**
   - **Newsreader** nos títulos de página e de seção e no **conteúdo de estudo** (tudo o que passa
     pelo `MarkdownContent`: perguntas, alternativas, flashcards).
   - **Instrument Sans** em toda a interface.
   - **Geist Mono** no código.
2. O itálico e o negrito vêm das fontes de verdade (os arquivos de itálico são carregados), e não de
   uma inclinação sintética.
3. Cada família pedida em `--font-sans`, `--font-serif` e `--font-mono` é uma família que um pacote
   importado realmente declara. Isso corrige o bug em que o app pedia "Geist", mas o pacote
   registrava "Geist Variable", e tudo caía na Arial.
4. O pacote da Geist sans sai das dependências.

## Fora do escopo

A escala de tamanhos da interface. A densidade atual (`text-xs`/`text-sm` dos componentes shadcn
"mira") fica como está.
