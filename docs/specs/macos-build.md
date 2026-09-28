# Spec — Build do macOS

- **Branch:** `feat/macos-build`
- **Pedido:** gerar a build do Personare para macOS.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. O release traz, para macOS, um instalador `.dmg` (arrastar para Aplicativos) e um `.zip`, para
   **Apple Silicon (arm64)** e **Intel (x64)**.
2. O app abre no Apple Silicon: depois de os fuses alterarem o binário do Electron, o `.app` é
   reassinado ad hoc (sem isso, o macOS recusa o app como "danificado").
3. O ícone da bandeja aparece com o tamanho de um ícone da barra de menus (16pt), nítido em Retina.
4. Mudanças no empacotamento são provadas num Mac antes do release: um workflow gera os instaladores
   das duas arquiteturas (como artefatos) e roda os e2e no app empacotado.

## Escolhas técnicas

- **Build só em Mac:** `.dmg`/`.app` não podem ser gerados no Windows ou no Linux, então tudo roda no
  runner `macos-latest` (Apple Silicon) do GitHub Actions; a build Intel é empacotada cruzada no mesmo
  runner (o `better-sqlite3` já traz `prebuilds/darwin-x64.node` e `darwin-arm64.node`, e o
  `copyExternalModules` mantém o da arquitetura alvo).
- **`@electron-forge/maker-dmg`:** as dependências nativas dele (`appdmg`, `macos-alias`) são opcionais
  e só para `darwin` no lockfile, então o `npm ci` do Windows e do Linux as ignora.
- **Assinatura ad hoc** pelo `resetAdHocDarwinSignature` do `FusesPlugin`, que só age em um `.app`.
- **Sem Developer ID:** o app não é assinado com um certificado da Apple nem notarizado, pois isso exige
  o Apple Developer Program (pago). Consequências, documentadas no README:
  - na primeira abertura o macOS bloqueia o app baixado ("não é possível verificar o desenvolvedor"),
    e o usuário libera em Ajustes do Sistema → Privacidade e Segurança → "Abrir Mesmo Assim";
  - a atualização automática (`update-electron-app`) não funciona no macOS, porque o Squirrel.Mac só
    instala atualizações assinadas.

## Fora de escopo

- Assinatura com Developer ID e notarização (depende de conta Apple Developer).
- Build universal (um só binário arm64 + x64).
