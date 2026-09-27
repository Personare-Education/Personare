# Spec — Issue #121: Dialog de Dificuldade não abre ao voltar de um PDF (Linux)

- **Issue:** #121 — "Dialog de Selecionar Dificuldade ao Retornar para Aplicação não abre (LINUX)".
- **Branch:** `fix/121-difficulty-dialog-linux`
- **Ambiente do relato:** Bazzite com GNOME (Wayland por padrão). Visto com atividade do tipo PDF.
  Link não foi testado pelo reporter.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Diagnóstico (sem reprodução local)

Não houve como reproduzir: a máquina de desenvolvimento é Windows, e o WSLg não é um desktop GNOME real.

- No Electron (`shell/common/platform_util_linux.cc`), `OpenPath` e `OpenExternal` usam o mesmo
  `XDGOpen(..., wait_for_exit=false, focus_launched_process=true)`. Antes de lançar o `xdg-open`, os
  dois pedem ao compositor um token de ativação XDG, num run loop aninhado. No lado do Electron, PDF e
  Link seguem o mesmo caminho.
- **A única diferença está no Personare**: o Link arma o gatilho de retorno de forma síncrona, no
  clique. O PDF só armava depois do round-trip IPC com `shell.openPath` resolver. Se essa resposta
  atrasa ou não chega (por exemplo, esperando o token de ativação do GNOME), o foco de retorno
  encontra o gatilho vazio e a Dialog não abre.
- Hipótese descartada: "`openPath` espera o visualizador fechar". Ele usa `wait_for_exit=false` e
  resolve logo depois de lançar o `xdg-open`.
- Hipótese não confirmada: "o evento `focus` do DOM não dispara no Wayland". A documentação do
  Electron só limita *focar/desfocar programaticamente* no Wayland, não os eventos. Se o Link também
  falhar no Bazzite, é essa a causa, e esta correção não basta.

## Correção

- `src/hooks/use-rate-on-return.ts` (novo) concentra o "abrir a Dialog no próximo foco" que vivia na
  rota de Atividades. `openPdf` **arma antes** de chamar `openActivityFile`, como o Link já fazia.
  Se o `openPath` devolver erro (arquivo movido ou apagado), desarma: limpa o ref e
  `clearPendingActivityRating`.
- A rota `programs.$programId.modules.$moduleId.tsx` passa a usar o hook para PDF e Link.

## Testes (TDD)

- `src/tests/unit/use-rate-on-return.test.ts` (novo): com o `openActivityFile` pendente para sempre,
  o foco de retorno abre a Dialog (o comportamento antigo falharia). Erro ao abrir desarma. O Link
  abre ao voltar. O gatilho dispara uma única vez.
- **Verificação manual pendente:** no Bazzite/GNOME, abrir PDF **e** Link, voltar ao Personare e
  conferir que a Dialog abre nos dois.
