# Spec — Criar uma atividade PDF em etapas, com drop-zone

- **Branch:** `feat/pdf-activity-dropzone`
- **Pedido:** criar uma atividade PDF passa a ter etapas, como o Quiz, para ganhar uma drop-zone onde o
  arquivo pode ser arrastado.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Criando uma atividade do tipo PDF, a primeira etapa (título e tipo) mostra "Próximo" em vez de
   "Salvar", sem o botão de escolher arquivo, e o indicador "Etapa 1 de 2".
2. A segunda etapa ("Etapa 2 de 2") mostra uma drop-zone para o PDF:
   - arrastar um `.pdf` para ela escolhe esse arquivo;
   - clicar nela (ou Enter) abre o seletor nativo de PDF, como o botão antigo;
   - o nome do arquivo escolhido aparece na drop-zone;
   - um arquivo que não é PDF mostra um erro e não é escolhido.
3. "Salvar" fica desabilitado até haver um arquivo, e salva a atividade com o caminho dele.
   "Voltar" retorna à primeira etapa sem perder o que foi preenchido.
4. Editar uma atividade PDF existente continua como antes: uma etapa, com o botão de trocar o arquivo.

## Escolhas técnicas

- A atividade guarda o **caminho** do PDF (o app o abre no leitor nativo). O seletor nativo já devolve o
  caminho. Um arquivo arrastado chega como `File`, que desde o Electron 32 não expõe mais `path`. Por isso
  o preload expõe `webUtils.getPathForFile` via `contextBridge` (`window.personare.getPathForFile`).
- Mesma etapa/indicador/animação do fluxo de criação do Quiz (`activity-form-dialog.tsx`), e mesma
  aparência da drop-zone do import de Quiz (`quiz-import-panel.tsx`).
