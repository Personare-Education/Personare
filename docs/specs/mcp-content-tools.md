# Spec — MCP: criar módulos, atividades e provas, com ou sem regra de desbloqueio

- **Pedido do usuário (2026-10-08):** "Ainda falta a funcionalidade de criar módulos, provas e atividades,
  todos com ou sem regra de desbloqueio."
- **Branch:** `feature/mcp-content-tools`, empilhada sobre `feature/mcp-create-program`
  (docs/specs/mcp-create-program.md, cuja ponte e molde esta spec segue).
- **Metodologia:** Spec Driven Development + TDD.

## Ferramentas novas

| Ferramenta | O que faz |
|---|---|
| `list_programs` | Os programas, com id e nome, para o Claude achar um programa que já existe. |
| `get_program` | Um programa por dentro: módulos (com a regra), atividades de cada módulo (passos das sequências inclusive) e provas, com os ids. |
| `create_module` | Um módulo num programa, com regra opcional. |
| `create_activity` | Uma atividade num módulo: link, PDF, quiz (com as perguntas), flashcards (com os cards) ou sequência (com os passos e a ordem), com regra opcional. |
| `create_exam` | Uma prova num programa, sorteando dos quizzes dos módulos escolhidos, com perguntas avulsas e regra opcionais. |

As regras são as do app, com as mesmas validações (os handlers do IPC as fazem):

- **Módulo:** `none`, `previous` (depois de tudo antes dele), `all` / `any` (depois de todos / qualquer um dos
  módulos listados), `exam` (depois de passar na prova listada).
- **Atividade:** `none`, `previous`, `all` / `any` (atividades do mesmo programa).
- **Prova:** `none`, `sources` (depois de terminar os módulos de onde sorteia), `all` / `any` (módulos),
  `exam` (depois de passar em outra prova).

## Critérios de aceite

1. **Módulo:** `create_module` cria o módulo no fim do programa; com uma regra, ela fica salva como pela tela.
2. **Atividade:** `create_activity` cria cada tipo: link (com a URL), PDF (com o caminho do arquivo), quiz (com
   as perguntas e alternativas, pelo mesmo `createWithQuestions` do app), flashcards (com os cards) e sequência
   (com os passos; em "travar na ordem", cada passo depois do primeiro espera o anterior). Com uma regra, ela
   fica salva.
3. **Prova:** `create_exam` cria a prova com módulos, quantidade de perguntas, nota para passar (70% se não
   disser) e tempo limite opcional; as perguntas avulsas ficam só da prova; com uma regra, ela fica salva.
4. **Tudo ou nada:** se uma parte falha (uma regra que trancaria para sempre, um módulo de outro programa, uma
   prova sem quiz nos módulos), nada fica criado pela metade, e a ferramenta devolve o motivo como erro.
5. **Achar o que existe:** `list_programs` e `get_program` devolvem os ids que as outras ferramentas pedem.
6. **A tela acompanha:** o que a ponte cria aparece na página aberta (os módulos e as provas na página do
   programa, as atividades na do módulo).
7. **App fechado:** todas as ferramentas respondem "Abra o Personare e tente de novo."

## Escolhas técnicas

- Cada ferramenta é **uma** chamada à ponte; a ponte compõe os handlers do IPC (`modules.create` +
  `modules.setUnlockRule`, `quiz.createWithQuestions`, `flashcards.create`...). Se um passo falha, a ponte
  apaga (soft delete, pelo handler do app) o que criou antes e devolve o erro.
- Os parâmetros das ferramentas em snake_case (`program_id`, `required_ids`), como é costume em MCP.
