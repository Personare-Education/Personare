# Spec — Servidor MCP do Personare: a ponte e a ferramenta "criar programa"

- **Pedido do usuário (2026-10-08):** uma integração MCP como "ponte fina" que reaproveita o CRUD do IPC,
  em processo separado, com três ferramentas granulares (criar programa, módulo e atividade), começando por
  **criar programa** ponta a ponta. E: "garanta que eu também vou conseguir utilizar o mcp como conector no
  programa desktop do claude".
- **Branch:** `feature/mcp-create-program`. Módulo e atividade vêm depois, no mesmo molde.
- **Metodologia:** Spec Driven Development + TDD.

## Arquitetura

```
Claude Desktop ──stdio──▶ servidor MCP (processo separado, iniciado pelo Claude Desktop)
                                │  cliente oRPC + token
                                ▼  named pipe (Windows) / socket Unix (macOS, Linux)
                         Electron main ──▶ router da ponte ──▶ handlers do IPC ──▶ SQLite
```

- **Quem inicia o servidor MCP é o Claude Desktop**, não o Electron: um servidor MCP local fala com o Claude
  por stdin/stdout, e só quem inicia o processo tem esse canal. Continua um processo separado do app.
- **A ponte** é o mesmo oRPC do app, servido pelo main num named pipe com o adaptador `node` do
  `@orpc/server`. O router da ponte expõe só o que as ferramentas usam e chama os **mesmos handlers** do IPC
  (`programs.create`, `programs.list`): mesmo schema, mesmo SQLite, nenhum CRUD duplicado.
- **Descoberta e autenticação:** ao abrir, o app grava `mcp-bridge.json` (o endereço do pipe e um token
  aleatório da sessão) na pasta de dados (`%APPDATA%\Personare` no Windows), legível só pelo usuário. Cada
  chamada leva o token; sem ele, a ponte recusa. Ao fechar, o app apaga o arquivo.
- **Distribuição para o Claude Desktop:** uma extensão `.mcpb` (MCP Bundle) com o servidor já empacotado num
  único arquivo JS; o Claude Desktop o roda com o Node que ele traz. Não depende do caminho de instalação do
  Personare (que, no Squirrel, muda a cada versão).

## Critérios de aceite

1. **A ponte cria um programa:** com o app aberto, uma chamada autenticada a `programs.create` pela ponte
   grava o programa no SQLite, igual à criação pela interface, e o devolve.
2. **Sem o token certo, nada:** uma chamada sem token, ou com outro token, é recusada e não grava nada.
3. **O app anuncia a ponte e a recolhe:** ao abrir, grava `mcp-bridge.json` com o endereço e o token; ao
   fechar, apaga o arquivo e fecha o pipe.
4. **A ferramenta `create_program`:** o servidor MCP lista a ferramenta `create_program` (nome obrigatório;
   cor e ícone opcionais) e, chamada, cria o programa pela ponte e responde com o nome e o id.
5. **App fechado, erro claro:** sem o app aberto (sem `mcp-bridge.json`, ou o pipe não responde), a ferramenta
   responde com erro: "Abra o Personare e tente de novo."
6. **A tela acompanha:** um programa criado pela ponte aparece na lista de Programas aberta, sem precisar
   navegar.
7. **Instalável no Claude Desktop:** `npm run build:mcp` gera `out/mcp/personare.mcpb`, que o Claude Desktop
   instala em Configurações → Extensões. No Claude, "crie um programa chamado Cálculo I" cria o programa no
   Personare aberto.

## Fora do escopo (próximos PRs)

- As ferramentas de módulo e de atividade (no mesmo molde, referenciando o programa pelo id).
- Uma opção nas Configurações para desligar a ponte.
- Listar e ler dados pelo MCP além do necessário para criar.

## Como instalar e testar no Claude Desktop

1. `npm run build:mcp` gera `out/mcp/personare.mcpb`.
2. No Claude Desktop: **Configurações → Extensões** (ou dois cliques no arquivo `.mcpb`) e instalar.
3. Com o Personare aberto (a janela ou só na bandeja), pedir ao Claude: "crie no Personare um programa chamado
   Cálculo I, com o ícone Sigma". O programa aparece na tela de Programas.
4. Para apontar o servidor para outra pasta de dados (ex.: um perfil de desenvolvimento), a variável
   `PERSONARE_DATA_DIR`.

Fechar a janela deixa o Personare na bandeja, e a ponte continua no ar. Só o **Sair** da bandeja encerra a ponte.

## O molde para as próximas ferramentas (módulo e atividade)

1. **Ponte:** em `createBridgeRouter` (`src/main/mcp-bridge.ts`), um procedimento que chama o handler do IPC
   com `call(modules.create, input)` e avisa `onDataChanged("modules")`.
2. **Ferramenta:** em `src/mcp/server.ts`, um `registerTool` com o schema de entrada (o `programId` vindo do
   `create_program`) e a mesma resposta de erro com o app fechado.
3. **Tela:** `useDataChanged("modules", ...)` na página que lista o que mudou.
4. **Manifesto:** a ferramenta em `mcp/manifest.json` (`tools`).
5. **Testes:** um caso na ponte e um no servidor, como os de `mcp-bridge.test.ts` e `mcp-server.test.ts`.
