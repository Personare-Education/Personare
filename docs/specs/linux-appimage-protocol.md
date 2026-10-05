# Spec — O retorno do Google chega ao app no Linux (AppImage)

- **Branch:** `fix/linux-appimage-protocol`
- **Origem:** um usuário do beta no Linux, com o AppImage, não conseguia entrar: depois de escolher a conta
  no Google, o retorno `personare://oauth-callback?token=…` não abria o app. Sem login, o beta fica
  inacessível.
- **Causa:** no Linux, `app.setAsDefaultProtocolClient` só associa o esquema por meio de um arquivo
  `.desktop` instalado. O AppImage não instala nada e roda de uma montagem temporária
  (`/tmp/.mount_XXXX`), que muda a cada execução; nada no sistema aponta `personare://` para ele. Os
  pacotes `.deb` e `.rpm` também não declaravam o tipo `x-scheme-handler/personare`.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Rodando como AppImage (Linux, com `APPIMAGE` definido), ao abrir o app escreve
   `~/.local/share/applications/personare-appimage.desktop` com `Exec="<caminho do AppImage>" %u`,
   `MimeType=x-scheme-handler/personare;` e `NoDisplay=true` (não duplica o atalho no menu), e o torna o
   tratador do esquema com `xdg-mime default personare-appimage.desktop x-scheme-handler/personare`.
2. O caminho no `Exec` é citado conforme a especificação de `.desktop` (aspas, `\`, `"`, `` ` `` e `$`
   escapados), para funcionar em pastas com espaços.
3. Se o AppImage mudar de lugar, a próxima abertura reescreve a entrada com o caminho novo.
4. Falhas (sem `xdg-mime`, pasta sem permissão) não impedem o app de abrir; ficam no log.
5. Fora do AppImage nada muda. Os pacotes `.deb`, `.rpm` e o `.desktop` dentro do AppImage declaram
   `x-scheme-handler/personare`.
