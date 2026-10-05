# Spec — Atualização automática no Linux

- **Branch:** `feature/linux-updates` (sobre `feature/prerelease-updates`)
- **Origem:** o usuário quer atualização automática também no Linux. A biblioteca usada no Windows e no macOS
  (`update-electron-app`) não tem suporte a Linux.
- **Depende de:** o feed `/updates` com os alvos `linux-x64-appimage`, `linux-x64-deb` e `linux-x64-rpm`
  (`personare-backend`, `docs/specs/update-feed.md` AC-6), que devolve `{ name, url, sha256, size }`.
- **Metodologia:** Spec Driven Development + TDD.

## Critérios de aceite

1. No Linux empacotado, o app procura atualização ao abrir e a cada 4 horas, no mesmo canal de
   **Testar pré-lançamentos** (`…/updates/prerelease` ou `…/updates/stable`), pedindo o formato em que foi
   instalado: AppImage (há `APPIMAGE`), `.deb` (o sistema tem `/etc/debian_version`) ou `.rpm`.
2. **AppImage:** baixa a versão nova ao lado do arquivo atual, confere o SHA-256 publicado (diferente: descarta e
   não troca nada), marca como executável e troca o arquivo. Depois pergunta **Reiniciar agora / Depois**;
   reiniciar abre o AppImage novo.
3. Se a troca não for possível (por exemplo, a pasta do AppImage não aceita escrita), vira o aviso do item 4.
4. **.deb e .rpm** (que precisam de `root` para instalar): avisa que há versão nova, com **Baixar** (abre o
   arquivo no navegador) e **Agora não**.
5. Cada versão é oferecida uma vez por execução do app. Falhas de rede ou do feed só vão para o log.
6. Os textos seguem o idioma do sistema (português ou inglês).
