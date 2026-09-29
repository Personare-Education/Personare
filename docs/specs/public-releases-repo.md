# Spec — Releases num repositório público separado

- **Branch:** `feature/public-releases-repo`
- **Pedido:** tornar privado o repositório do código (`Personare-Education/Personare`) sem quebrar o download
  pelo site nem a atualização automática do app.

## Contexto

Com o repo do código privado, três coisas quebram: a API de releases que o backend lista no site responde 404,
os links `browser_download_url` passam a exigir login no GitHub e o `update.electronjs.org`, usado pelo
`update-electron-app`, só atende repositórios públicos. Os instaladores podem ser públicos sem risco: o app só
abre para contas com o beta fechado ativado.

## Critérios de aceite

1. O Forge publica as releases em `Personare-Education/personare-releases` (público, só com releases).
2. O auto-update (`src/main.ts`) busca atualizações em `Personare-Education/personare-releases`.
3. O workflow `Publish Release` publica com o secret `RELEASES_TOKEN`, um token com escrita no repo de
   releases, porque o `GITHUB_TOKEN` do Actions só escreve no próprio repo.
4. O backend lista os downloads de `Personare-Education/personare-releases` por padrão.

## Transição

Instalações existentes procuram atualização no repo antigo. A primeira release depois desta mudança também é
copiada para `Personare-Education/Personare`, e só então o repo do código fica privado. Quem não atualizar
antes disso precisa baixar de novo pelo site.
