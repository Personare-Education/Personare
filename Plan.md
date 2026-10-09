# Personare — Plano de Desenvolvimento

Dashboard desktop (Electron) para acadêmicos organizarem e lembrarem de realizar atividades de estudo, usando o algoritmo **FSRS** (Free Spaced Repetition Scheduler) e o modelo da curva do esquecimento.

Construído a partir do boilerplate [`electron-shadcn`](https://github.com/LuanRoger/electron-shadcn) (Electron Forge + Vite + TypeScript + React 19 + TanStack Router/Query + shadcn/ui + Tailwind v4 + oRPC), reaproveitado como ponto de partida técnico — o produto em si é construído do zero a partir daqui.

Este plano é o resultado de duas rodadas de análise em conselho (5 perspectivas independentes + revisão cruzada + síntese), cobrindo tanto os requisitos iniciais quanto as decisões de arquitetura de OAuth, mobile-readiness, importação do Anki e backup.

> **Status (2026-10):** as Fases 0 a 3 estão concluídas; o app está em beta fechado (`0.1.0-alpha.x`).
> Só a Fase 4 segue aberta (issues #32 e #33). Este documento é o plano original e fica como registro
> histórico: o que o produto é hoje está em [`PRODUCT.md`](./PRODUCT.md), e cada mudança desde então tem
> sua spec em [`docs/specs/`](./docs/specs/). Onde o plano e o código divergem, vale o código.

---

## 1. Modelo de Domínio

### 1.1 Hierarquia de conteúdo (CMS pessoal do acadêmico)

```
Programa (ex-"Card" — renomeado para não colidir com "Flashcard")
  └── Módulo
        └── Atividade (Link | Quiz | PDF | Flashcards)
```

- **Programa**: área da vida acadêmica do usuário (ex.: "Bacharelado II", "Pós I", "Mestrado", "Curso Livre"). CRUD completo.
- **Módulo**: agrupamento de atividades dentro de um Programa. CRUD completo, exibido como Data Table dentro da página do Programa.
- **Atividade**: unidade de trabalho dentro de um Módulo, exibida como linha de Data Table com Badge indicando o tipo. Tipos no MVP: `link`, `quiz`, `pdf`, `flashcard_deck`. **Não modelar como enum fechado de banco** — usar union tipada/discriminada, extensível sem migração destrutiva.

### 1.2 Motor de repetição espaçada (desacoplado da hierarquia de conteúdo)

- **`ReviewItem`** é a entidade de primeira classe que o FSRS agenda — não a Atividade. Cada `ReviewItem` tem seu próprio estado: `stability`, `difficulty`, `due_date`, histórico de ratings (again/hard/good/easy).
- Uma Atividade do tipo `flashcard_deck` é um **Baralho**: um agrupamento de UI/filtro sobre um conjunto de Flashcards. **O Baralho não tem estado FSRS próprio** — cada Flashcard dentro dele é um `ReviewItem` individual. A "sessão de revisão do baralho" é uma tela que itera sobre os `ReviewItem`s pendentes daquele baralho, mas o agendamento é sempre por Flashcard.
- *(Superado pela Issue #77, `docs/specs/issue-77-activity-difficulty-fsrs.md`: quiz, PDF e link ganharam um `ReviewItem` por atividade, agendado pela dificuldade que o aluno marca ao concluir.)* Texto original: atividades do tipo `quiz`, `pdf` e `link` **não geram `ReviewItem` automaticamente na V1** — são lembretes/conteúdo simples. Ficar em aberto (documentado, não implícito) se e como versões futuras gerarão itens revisáveis a partir delas (ex.: questões erradas de Quiz, trechos marcados de PDF).
- V2 (fora deste plano, apenas registrado): Flashcards ganham uma Seção própria na UI, diferente de um Item padrão de Data Table, mas na mesma página do Baralho.

### 1.3 Persistência

- **SQLite local** via `better-sqlite3`, rodando exclusivamente no processo main do Electron, exposto ao renderer pela camada de IPC/oRPC já existente no boilerplate.
- **Drizzle ORM + drizzle-kit** para schema e migrations versionadas desde o primeiro commit.
- **`ts-fsrs`** como implementação do algoritmo — não reimplementar o FSRS manualmente.
- **UUID como chave primária** em todas as tabelas (não autoincrement) — barateia uma futura decisão de sync sem exigir novo schema.
- Toda tabela leva `created_at` / `updated_at`. Exclusão de conteúdo com histórico de revisão associado usa **soft-delete** (não hard-delete), preservando o histórico FSRS.
- **Mobile-readiness (decisão consciente e explícita)**: nesta fase, "pronto para mobile" significa apenas a higiene de schema acima (UUID, timestamps, soft-delete). O **protocolo de resolução de conflito de sincronização multi-dispositivo (last-write-wins, CRDT, ou árbitro central) fica formalmente em aberto e adiado** para quando o desenvolvimento do cliente Mobile começar de fato — não deve ser resolvido por engenharia especulativa agora.

---

## 2. Notificação e execução em background

- **Sem subprocesso nativo separado.** Usar a API já existente do Electron: `app.setLoginItemSettings({ openAtLogin: true })` para que o próprio app inicie (minimizado/oculto, com ícone na bandeja do sistema) ao ligar o computador. Isso evita o segundo executável, a assinatura de código duplicada, e o risco de o app ser sinalizado como comportamento suspeito por antivírus — riscos identificados na análise de arquitetura.
- Ao iniciar oculto, o app consulta o SQLite local, calcula as revisões do dia via `ts-fsrs`, e dispara notificações nativas do SO — **funciona para todo usuário, com ou sem login Google.**
- A UI deve deixar explícito, em linguagem simples, que o app inicia com o sistema operacional e como desativar isso.

---

## 3. Calendário

- Sidebar com item "Calendário".
- **Escopo do MVP: visão de lista/mês das próximas revisões**, resultado de uma query sobre `ReviewItem` filtrando por `due_date`. **Não construir uma réplica completa do Google Calendar (drag-and-drop, múltiplas visões, recorrência) no Alpha** — isso é complexidade de UI subestimada e deve ser incremento pós-MVP.
- Sincronização com Google Calendar (via OAuth) é tratada na Fase 2 (seção 5).

---

## 4. Backup e proteção de dados

- **Backup local (fallback universal, disponível desde o Alpha)**: exportação/importação de um arquivo local criptografado com todos os dados do usuário. Garante que usuários que não conectam a conta Google não fiquem sem nenhuma proteção de dados — resolve a contradição identificada entre "notificação para todos" e "backup só via Google".
- **Backup via Google Drive** (Fase 2): usa a conta Google do próprio usuário, aproveitando o OAuth já exigido para o Google Calendar. Complementar ao backup local, não substitui.

---

## 5. Integrações Google (Fase 2 — pós-Alpha)

- Login/OAuth com Google, exigido apenas para as funcionalidades que dependem dele (Calendar sync, Drive backup) — o app continua funcional sem login.
- Sincronização com Google Calendar.
- Backup via Google Drive.
- **Risco de cronograma**: a verificação de escopos sensíveis do OAuth (Calendar, Drive) pelo Google pode levar semanas ou ser rejeitada. **A submissão da tela de consentimento no Google Cloud Console deve começar no primeiro dia útil deste plano**, em paralelo ao desenvolvimento, não ao final.
- Requisitos de conformidade (LGPD): exclusão de conta, exportação de dados, telas de consentimento explícitas para cada escopo solicitado.

---

## 6. Importação de Anki

- Tratada como workstream própria de conversão de dados, não como "importador simples".
- Parser de `.apkg` (arquivo zip contendo um banco SQLite interno + mídia).
- Mapeamento de note types/templates do Anki para o modelo de Flashcard do Personare.
- Regra de conversão do estado SM-2 (algoritmo do Anki) para o estado inicial do FSRS — não é um mapeamento 1:1; definir uma heurística de seed razoável.

---

## Fases e Tasks (mapeadas para Issues/Milestones no GitHub)

### Fase 0 — Fundação do Projeto
1. Rebranding do boilerplate: remover referências a "electron-shadcn"/LuanRoger em `README.md`, `package.json` (author), `forge.config.ts` (publisher), `src/main.ts` (updater), `src/localization/i18n.ts`, testes E2E.
2. Configurar SQLite (`better-sqlite3`) + Drizzle ORM + drizzle-kit, com primeira migration vazia.
3. Configurar `ts-fsrs` e escrever teste de regressão de corretude contra a implementação de referência.
4. Definir schema inicial: `Programa`, `Modulo`, `Atividade`, `Baralho`, `Flashcard`, `ReviewItem` (com UUID, timestamps, soft-delete).
5. Documentar convenções de commit/branch para os sub-agentes.

### Fase 1 — Alpha (local-only, sem login)
6. CRUD de Programa (Data Table).
7. CRUD de Módulo dentro de Programa (Data Table).
8. CRUD de Atividade dentro de Módulo (Data Table com Badge por tipo).
9. Atividade tipo Link (criação + abertura de URL).
10. Atividade tipo PDF (criação + visualizador embutido).
11. Atividade tipo Quiz (criação de perguntas + tela de execução + resultado).
12. Atividade tipo Flashcard/Baralho: criação de Baralho, CRUD de Flashcards dentro do Baralho.
13. Motor FSRS: integração de `ts-fsrs` ao `ReviewItem`, tela de sessão de revisão do Baralho (again/hard/good/easy por Flashcard).
14. Sidebar de navegação da aplicação.
15. Calendário — visão de lista/mês das próximas revisões (`ReviewItem` por `due_date`).
16. Notificação via `app.setLoginItemSettings` + ícone de bandeja + notificações nativas do SO.
17. Backup local: exportação/importação de arquivo criptografado.
18. Regra de exclusão/edição de conteúdo com histórico de revisão associado (soft-delete, o que acontece ao editar um Flashcard já revisado).

### Fase 2 — Integrações Google (pós-Alpha)
19. Submissão da tela de consentimento OAuth no Google Cloud Console (Calendar + Drive) — iniciar o quanto antes, em paralelo às demais tasks desta fase.
20. Fluxo de login OAuth com Google no Electron.
21. Sincronização com Google Calendar.
22. Backup via Google Drive.
23. Requisitos de LGPD: exclusão de conta, exportação de dados, telas de consentimento por escopo.

### Fase 3 — Importação de Anki
24. Parser de `.apkg` (extração zip + leitura do SQLite interno).
25. Mapeamento de note types/templates do Anki para Flashcard do Personare.
26. Heurística de conversão de estado SM-2 → seed inicial de FSRS.

### Fase 4 — Preparação para Mobile (pós-validação do Alpha)
27. Decisão de protocolo de sincronização/resolução de conflito multi-dispositivo (CRDT vs. last-write-wins vs. árbitro central).
28. Ajustes de schema decorrentes dessa decisão, se necessário.
29. (Fora deste plano: desenvolvimento do frontend Mobile propriamente dito, a ser planejado separadamente após esta decisão.)

---

## Decisões registradas como propositalmente adiadas

- Protocolo de merge/conflito para sync multi-dispositivo → Fase 4.
- ~~Geração de `ReviewItem` a partir de Quiz/PDF/Link~~ → resolvido na Issue #77 (um `ReviewItem` por atividade).
- Frontend Mobile → planejamento próprio, após Fase 4.
