# Spec — Um arquivo por idioma, e um teste que mantém os nove em dia

- **Pedido do usuário (2026-10-09):** seguir com as melhorias da revisão do projeto. Terceira frente: o
  `i18n.ts` tinha ~1.450 linhas (o inglês e o português dentro dele, os outros sete em `locales/`), e nada
  conferia se os nove idiomas tinham as mesmas chaves.
- **Branch:** `feature/i18n-paridade`, empilhada sobre `feature/indices-banco`.
- **Decisão:** separar em namespaces (um arquivo por tela) mudaria todas as chamadas `t()` do app e geraria
  conflito com qualquer PR aberto. O ganho que importa (arquivos menores, um por idioma, e uma trava contra
  tradução faltando) vem de tirar o inglês e o português do `i18n.ts`, como os outros sete já estão.

## Critérios de aceite

1. **Um arquivo por idioma:** `locales/en.ts` e `locales/pt-br.ts` passam a ter o inglês e o português; o
   `i18n.ts` só registra os nove. Nenhum texto muda.
2. **Mesmas chaves:** cada idioma tem as mesmas chaves do inglês (ignorando o sufixo de plural).
3. **Plurais completos:** toda chave com plural tem as formas que `Intl.PluralRules` dá para o idioma
   (português: `one`, `many`, `other`; árabe: `zero`, `one`, `two`, `few`, `many`, `other`; japonês: `other`).
4. **Mesmos placeholders:** cada tradução tem os `{{placeholders}}` do inglês. Uma forma de plural pode
   escrever o número por extenso em vez de `{{count}}`.
5. **O código só pede o que existe:** toda chave literal em `t("…")` no código existe no inglês.
6. O `CONTRIBUTING.md` diz onde ficam as traduções e o que o teste confere.
