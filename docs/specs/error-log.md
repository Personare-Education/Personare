# Spec — Registro de erros local, exportável nas Configurações

- **Pedido do usuário (2026-10-09):** seguir com as melhorias da revisão do projeto. Quarta frente: num beta
  fechado, um erro só chegava a quem mantém o app se o aluno reclamasse, e sem nenhum detalhe. Não havia
  `crashReporter`, Sentry nem log em arquivo.
- **Branch:** `feature/log-de-erros`, empilhada sobre `feature/i18n-paridade`.
- **Decisão:** nada sai do computador sozinho (princípio 3 do `PRODUCT.md`: o material do aluno fica na
  máquina dele). O app grava os erros num arquivo local, e o aluno decide exportar e mandar para alguém.

## Critérios de aceite

1. **O que é gravado:** no processo principal, exceções não tratadas, promessas rejeitadas sem tratamento,
   tudo o que passa por `console.error` e um processo do Electron que cai (`render-process-gone`,
   `child-process-gone`). Na janela, os eventos `error` e `unhandledrejection`.
2. **Onde e como:** uma linha JSON por erro em `<userData>/logs/errors.log`, com a hora, a origem (`main`
   ou `renderer`), a mensagem, a pilha quando houver e a versão do app.
3. **Tamanho limitado:** passando de 512 KB, o arquivo atual vira `errors.log.1` (substituindo o anterior)
   e um novo começa. O registro nunca passa de ~1 MB.
4. **Nunca derruba o app:** uma falha ao gravar é ignorada; gravar um erro não gera outro.
5. **Exportar:** no diálogo de Configurações, a categoria **Diagnóstico** explica que o registro fica só no computador e
   tem o botão **Exportar registro de erros**. Ele pede onde salvar e grava um `.txt` com a versão do app,
   o sistema e a arquitetura no topo e depois os erros, do mais antigo ao mais novo. Sem nenhum erro
   gravado, diz "Nenhum erro registrado." e não cria arquivo.
6. Os textos novos existem nos nove idiomas.
