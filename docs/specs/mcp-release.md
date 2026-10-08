# Spec — O `.mcpb` no release, com a ponte nas três plataformas

- **Pedido do usuário (2026-10-08):** "pode ser um anexo do release, mas lembrando que tem que ser compatível
  com todas as plataformas, ali no IPC".
- **Branch:** `feature/mcp-release`, empilhada sobre `feature/mcp-content-tools`
  (docs/specs/mcp-create-program.md, docs/specs/mcp-content-tools.md).
- **Metodologia:** Spec Driven Development + TDD.

## Critérios de aceite

1. **Anexo do release:** o **Publish Release** gera `personare-<versão>.mcpb` e o anexa ao rascunho
   `v<versão>` em `personare-releases`, junto dos instaladores. Um job só (o de Linux) faz isso: o mesmo
   arquivo serve para Windows, macOS e Linux. Rodar o workflow de novo substitui o anexo em vez de falhar.
2. **A ponte em cada plataforma:**
   - **Windows:** um named pipe com nome novo a cada abertura.
   - **macOS e Linux:** um socket Unix na pasta de dados do app. Um caminho de socket longo demais (o limite
     do macOS é ~104 bytes; uma pasta de usuário longa chega lá) passa para a pasta temporária do sistema,
     com um nome por usuário.
   - O socket fica legível e gravável só pelo usuário (`0600`); um socket deixado por uma queda é
     substituído ao abrir.
3. **A pasta de dados certa:** o servidor MCP acha a mesma pasta que o Electron usa em cada sistema:
   `%APPDATA%\Personare`, `~/Library/Application Support/Personare` e `$XDG_CONFIG_HOME/Personare` (ou
   `~/.config/Personare`).
4. **Provado nas três:** no CI, os testes da ponte e das ferramentas rodam em Windows, macOS e Linux.

## Observações

- O Claude Desktop existe para Windows e macOS. No Linux, o mesmo servidor serve a outros clientes MCP (o
  Claude Code, por exemplo: `claude mcp add personare -- node <pasta>/server/index.mjs`), lendo a mesma ponte.
