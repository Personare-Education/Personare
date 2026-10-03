# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/).

## [Unreleased]

### Added

- **Primeira abertura:** sem nenhum programa, a tela Hoje mostra "Estude hoje o que você esqueceria
  amanhã." e o ciclo em três passos (criar um programa, adicionar o material, estudar e dizer como
  foi). **Criar primeiro programa** abre Programas com o formulário já aberto.
- **Listas vazias que explicam:** Programas, Módulos e Atividades dizem o que vai em cada uma, com um
  exemplo e o botão de criar. Enquanto a lista está vazia, o botão do cabeçalho some, e a busca de
  atividades só aparece quando há atividades. Uma busca sem resultados diz que nenhuma atividade tem
  esse nome.
- **O heatmap vazio diz que as revisões vão colori-lo.**
- **Fins de sessão em cartões na cor do programa.** "Tudo revisado" aparece num cartão no azul da
  marca, com o que foi revisado em cada programa, na cor dele. O fim da revisão de um baralho mostra,
  num cartão na cor do programa, quantos cards foram revisados.
- **Desfazer exclusões.** Depois de excluir um programa, módulo, atividade, pergunta ou flashcard,
  um aviso com **Desfazer** traz de volta o item e tudo o que aquela exclusão escondeu (o que já
  estava excluído antes continua excluído). Clicar em Desfazer não fecha o gerenciador aberto.
- **Quiz mais seguro:** "Pergunta anterior" para voltar uma pergunta mantendo a resposta, um aviso
  na pergunta ainda sem resposta (ela conta como errada) e uma confirmação antes de sair do quiz com
  respostas marcadas.
- **Tela "Hoje", a nova tela de abertura.** Diz quantas revisões vencem hoje (e quantas estão
  atrasadas), lista o que vence agrupado por programa, cada item num cartão na cor do seu programa, e
  tem um único **Começar** que percorre o dia inteiro: baralhos com o cartão que gira, PDFs e links
  abertos e avaliados ali mesmo, quizzes respondidos e avaliados. Dá para pular itens e fechar no
  meio sem perder nada. Sem nada pendente, mostra o fechamento do dia (revisões feitas, sequência de
  dias) e os próximos 7 dias. Programas passa para o item **Programas** da barra lateral, e **Hoje**
  mostra o número de revisões pendentes.
- **Atalhos na revisão:** Espaço revela a resposta, e as teclas 1 a 4 avaliam (Errei, Difícil, Bom,
  Fácil).
- **Cada botão de avaliação mostra quando seria a próxima revisão** ("Bom · 4 dias", "Errei · 1
  minuto"), calculado pelo próprio FSRS para aquele item.
- **Atividades têm uma escala própria:** "Não entendi / Com esforço / Entendi / Fácil demais" no
  lugar de "Errei / Difícil / Bom / Fácil", que fica para os flashcards.
- **"N para revisar" nos cards de programa**, e um selo visível de "Revisão para hoje" / "Revisão
  atrasada" na linha da tabela (antes, só leitores de tela recebiam esse texto).

### Changed

- A barra lateral mostra "Sem sequência ainda" no lugar de "0 dias", e a tela Hoje sem nada agendado
  explica que as revisões aparecem depois de estudar uma atividade e dizer como foi.
- **Acessibilidade:** o botão de tema tem nome para leitores de tela. O texto secundário sobre a cor
  do programa (Frente/Verso, "Clique para virar", tipo e módulo nos itens de Hoje) usa o texto
  principal em vez do cinza, que ficava abaixo do contraste mínimo no tema claro. As iniciais do
  avatar também ficaram mais escuras, e a grade vazia do heatmap passou a aparecer no tema escuro.
- **A barra lateral recolhe para os ícones em janelas com menos de 1024px** e volta a abrir acima
  disso. O botão de recolher continua funcionando.
- **Programas novos nascem no azul da marca**, e não mais em vermelho. Na paleta, o azul da marca
  substitui o azul anterior, que era quase igual. Programas que já existem continuam com a cor deles.
- **Tabela de atividades:** a coluna "Progresso" passa a se chamar "Última avaliação", e a próxima
  revisão aparece como "hoje", "amanhã", "em 4 dias" ou "atrasada há 2 dias", com a data completa ao
  passar o mouse.
- O seletor de idioma mostra "English" e "Português"; um tempo de quiz abaixo de um segundo aparece
  como "<1s"; a lista do resultado do quiz se chama "Respostas"; e "Sincronizar agora" explica por que
  está desabilitado.
- **Tipografia nova, no espírito da do Claude.** Newsreader (serifada de texto, com itálico de verdade)
  nos títulos e no conteúdo de estudo (perguntas, alternativas, flashcards), e Instrument Sans em toda
  a interface. As duas são gratuitas e vêm dentro do app. Isso também corrige um bug antigo: o app pedia
  a fonte "Geist", mas ela era registrada como "Geist Variable", então tudo caía na Arial.

### Fixed

- **Resultado do quiz:** voltou ao layout anterior, sem o cartão na cor do programa, que apertava a
  coluna e cortava o gráfico.
- **Revisões de hoje:** o flashcard tem a mesma largura do cartão do item acima dele, o brilho dos
  cartões não é mais cortado nas bordas e a barra de rolagem segue o tema do app.

### Added

- **O heatmap dos cards de programa "preenche" ao carregar**, com a mesma animação do site: cada dia
  começa vazio e ganha a cor numa cascata do dia mais recente para o mais antigo. Toca
  uma vez, quando os dados chegam, e não anima com "reduzir movimento" ligado no sistema.

### Changed

- **Escrever perguntas do Quiz com um editor só.** A Dialog de perguntas deixa de ter um campo por
  enunciado e por alternativa: há um único editor Markdown, no estilo do GitHub (abas Escrever e
  Pré-visualizar, barra de formatação, imagem colada, arrastada ou escolhida). Shift+Enter (ou o
  botão) envia: o primeiro envio vira o enunciado, os seguintes viram alternativas, empilhados já
  renderizados. Cada item tem **Editar** (volta para o editor), as alternativas têm **Marcar como
  correta** e podem ser reordenadas arrastando, com a animação do Sortable do ReUI (ou pelo teclado:
  Espaço e setas). **Adicionar pergunta** salva e já abre a próxima; **Concluir** salva e fecha. A
  Dialog não fecha mais por um clique fora ou pelo Esc: ela balança, como no quiz em andamento.
- **Flashcards com o mesmo editor.** O primeiro envio é a frente e o segundo o verso, num cartão que
  gira ao ser clicado. Cada face tem **Editar**, e **Adicionar flashcard** e **Concluir** funcionam
  como nas perguntas do Quiz.
- **A revisão do baralho usa o mesmo cartão.** **Revelar resposta** (ou um clique no cartão) gira o
  cartão para o verso. O próximo card já aparece na frente, sem mostrar o verso dele no meio do giro.
- **Os flashcards têm a cor do programa**, com o mesmo gradiente e brilho dos cards de programa, no
  editor e na revisão.
- **Criar um Quiz manual ou um baralho de Flashcards já abre o primeiro item.** Depois de salvar a
  atividade, a janela da primeira pergunta (ou do primeiro card) abre direto, e ao concluir aparece a
  lista do que foi criado.

## [0.1.0-alpha.8] - 2026-09-30

### Fixed

- **Fórmulas de quizzes gerados pelo Gemini ainda apareciam como código LaTeX**
  ([#145](https://github.com/Personare-Education/Personare/pull/145)). O Gemini escreve os
  delimitadores escapados para Markdown (`\\(...\\)`), e a correção do alpha.7 só reconhecia
  `\(...\)`: sobrava uma `\` que deixava o `$` literal. As duas formas agora são renderizadas.
- **Blocos de código no enunciado de uma pergunta viravam uma linha só** na importação do quiz, e
  blocos e código inline não tinham estilo. O código é mantido como está e exibido com fundo, borda
  e fonte monoespaçada. Quizzes importados antes precisam ser reimportados.
- **O dialog "Gerenciar perguntas" passava da altura da janela** com muitas perguntas, escondendo o
  título. Agora ele cabe na janela e só a lista rola.

## [0.1.0-alpha.7] - 2026-09-29

### Fixed

- **Fórmulas LaTeX entre `\(...\)` e `\[...\]` apareciam como código**
  ([#143](https://github.com/Personare-Education/Personare/pull/143)). Esses delimitadores agora são
  renderizados como `$...$`/`$$...$$`, e o prompt de geração de quiz pede à IA para usar LaTeX só
  em fórmulas.

## [0.1.0-alpha.4] - 2026-09-26

### Added

- **Versão portátil para Windows.** O release passa a ter um `Personare-win32-x64-<versão>.zip`: é só
  extrair e rodar o `Personare.exe`, sem instalar. A versão portátil não se atualiza sozinha.

### Fixed

- **No app instalado não dava para fechar ou minimizar a janela, trocar o tema nem fazer CRUD**
  ([#118](https://github.com/jopsfernandes/Personare/pull/118)). O renderer envia a porta do oRPC
  uma única vez, ao carregar, mas o main só registrava o listener no fim do boot, depois de esperar
  o download do React DevTools, que também rodava em produção. A porta chegava sem listener, era
  descartada e todo o IPC ficava pendente. O listener agora é registrado antes de a janela existir,
  e o DevTools só é instalado em desenvolvimento.
- **O `Setup.exe` não criava atalhos**, e o usuário precisava rodar o instalador de novo para abrir o
  app. O `electron-squirrel-startup` estava nas dependências, mas nunca era chamado, então os eventos
  `--squirrel-install/-updated/-uninstall` eram ignorados. Agora o Setup instala uma vez e cria os
  atalhos no Menu Iniciar e na Área de Trabalho, e a desinstalação os remove.

## [0.1.0-alpha.3] - 2026-09-26

### Added

- **Release para Linux em AppImage.** O workflow `Publish Release` agora roda também em
  `ubuntu-latest` e anexa ao release um `Personare-<versão>-x64.AppImage` (maker
  `@reforged/maker-appimage`), além dos `.deb` e `.rpm` que já estavam configurados mas nunca eram
  gerados, porque o workflow só rodava no Windows.

## [0.1.0-alpha.2] - 2026-09-24

### Fixed

- **App instalado não abria: `Cannot find module 'better-sqlite3'`** ([#111](https://github.com/jopsfernandes/Personare/issues/111)).
  `better-sqlite3` é `external` no Vite (o `.node` nativo não pode ser bundlado), mas o Forge só
  empacota a saída `.vite`, então o módulo não ia para dentro do `app.asar`. O bug só aparecia
  fora do repositório -- rodando de `out/`, o `require` subia até o `node_modules` do projeto.
  Um hook `packageAfterCopy` (`scripts/copy-external-modules.ts`) agora copia os módulos externos
  (lista única em `scripts/external-modules.ts`, compartilhada com o Vite) para o pacote, e o
  `AutoUnpackNativesPlugin` move os `.node` para `app.asar.unpacked`.

## [0.1.0-alpha.1] - 2026-09-23

### Added

- **Sistema de streak na sidebar** ([#101](https://github.com/jopsfernandes/Personare/issues/101)).
  Novo indicador de sequência de dias de estudo (ícone de chama + contagem), no rodapé da sidebar,
  acima do menu de conta.
  - Clicar abre um popover (`StreakWidget`) com "Day N" do mês + contagem regressiva até a meia-noite
    local, um mini calendário mensal navegável (estilo painel do Notion) com o dia atual e os dias com
    revisão marcados, e cards de "Current Streak"/"Best Streak".
  - Critério de streak: qualquer revisão concluída no dia (mesma métrica do heatmap dos cards de
    Programa, Issue #99) -- reaproveita o mesmo `review.listActivityCounts()`, sem endpoint novo.
  - Funções puras testáveis em `src/utils/streak.ts` (`computeCurrentStreak`, `computeBestStreak`,
    `buildMonthGrid`, `msUntilNextLocalMidnight`).
- **Programas: cards com ícone/cor, heatmap de uso de 365 dias e Context Menu**
  ([#99](https://github.com/jopsfernandes/Personare/issues/99)).
  A tela de Programas (`/`) troca a `<table>`/`ProgramsDataTable` por uma grid de cards
  (`ProgramsCardGrid`), um por programa.
  - Cada card tem um ícone (curado, ~32 ícones Lucide relevantes a áreas de estudo) sobre uma cor
    própria (paleta fixa de 19 cores), escolhidos num formulário redesenhado
    (`ProgramFormDialog`) inspirado em pickers de ícone/cor de apps de hábito: preview circular,
    grade de ícones e swatches de cor. `programs.icon`/`programs.color` são novas colunas
    nullable (`drizzle/0009_steep_albert_cleary.sql`); programas existentes sem valor caem num
    ícone/cor padrão via `resolveProgramIcon`/`resolveProgramColor`.
  - Abaixo do nome, um heatmap de uso estilo GitHub (`ActivityHeatmap`) cobrindo os últimos 365 dias
    (53 semanas), tingido na cor do próprio programa, com a intensidade de cada dia proporcional ao
    número de revisões concluídas -- agregado a partir de `review_items.ratingHistory` por um novo
    procedimento `review.listActivityCounts`, já que o schema não tem uma tabela de log por revisão.
    Quando as 53 semanas não cabem na largura do card, o heatmap rola horizontalmente (já começando
    no fim, mostrando os dias mais recentes) com uma máscara de fade-out do lado esquerdo, em vez de
    um corte abrupto.
  - O ícone de "ver módulos" some: um clique simples no card já navega para os módulos do programa.
  - Editar e excluir vivem tanto num Context Menu (shadcn/ui, novo `src/components/ui/context-menu.tsx`,
    clique direito no card) quanto num botão de três pontos no canto do card (`DropdownMenu`),
    em vez de dois botões-ícone sempre visíveis.
  - Cada card ganha um efeito de "border glow" na cor do programa (`box-shadow` em duas camadas,
    anel + brilho difuso), presente nos dois temas; o gradiente de fundo é vertical (de cima para
    baixo), e o tema claro ganhou variáveis de cor dedicadas para o heatmap e o tingimento do card
    (`--heatmap-empty-cell`, `--heatmap-level-1..4`, `--card-tint-strength`), já que os mesmos valores
    do tema escuro ficavam quase invisíveis sobre um fundo branco.
- **Quiz: fluxo multi-step com progress-bar e resultado com radial chart** ([#93](https://github.com/jopsfernandes/Personare/issues/93)).
  Redesenha a experiência de responder um Quiz (`QuizRunnerDialog`), que antes renderizava todas as
  perguntas de uma vez com `<input type="radio">` cru e mostrava o resultado como uma única frase.
  - Uma pergunta por vez, com uma `Progress` bar (shadcn/ui) no topo indicando "Pergunta X de Y" --
    navegação só pra frente, sem revisar uma resposta já dada.
  - Alternativas de resposta agora usam `RadioGroup`/`RadioGroupItem` (shadcn/ui) em vez do `<input>`
    cru anterior.
  - Tela final de resultado com um novo componente genérico `RadialChartText` (shadcn charts sobre
    Recharts) mostrando a pontuação em %, mais tempo total do quiz e tempo médio por questão (dois
    timestamps -- início e fim -- já que média é sempre soma/contagem, sem precisar de um cronômetro
    por pergunta).
- **Markdown, LaTeX e anexo de imagem em flashcards e quizzes** ([#96](https://github.com/jopsfernandes/Personare/issues/96)).
  Conteúdo de flashcards e de perguntas/opções de quiz agora aceita Markdown, com fórmulas em LaTeX
  (`$...$` em linha, `$$` em bloco) renderizadas como matemática de verdade em vez de texto cru, e pode
  ter uma imagem opcional anexada.
  - `MarkdownContent` (renderer somente-leitura, `react-markdown` + `remark-math` + `rehype-katex`) e
    `MarkdownEditor` (campo de formulário com abas Escrever/Pré-visualizar sobre um `Textarea`)
    substituem o `<Input>` de uma linha usado antes em `flashcard-form-dialog.tsx` e
    `quiz-question-form-dialog.tsx`.
  - Imagens são copiadas para `app.getPath("userData")/attachments/` sob um nome gerado (nunca o
    caminho original do usuário) via o novo namespace de IPC `attachments`
    (`saveImage`/`getImageDataUrl`/`deleteImage`) e `dialog.selectImageFile`; `flashcards` ganha
    `frontImagePath`/`backImagePath` e `quiz_questions`/`quiz_options` ganham `imagePath`
    (`drizzle/0008_mighty_genesis.sql`), todos nullable e retrocompatíveis.
  - `ImageAttachmentField` (anexar/remover, usado nos formulários) e `ImageAttachmentViewer` (um botão
    "Ver imagem" que abre a imagem num Dialog sob demanda, usado nas telas de listagem/revisão/quiz)
    garantem que a imagem nunca aparece inline — não há como ela quebrar o layout.
  - Telas de exibição atualizadas: `flashcard-manager-dialog.tsx`, `quiz-question-manager-dialog.tsx`,
    `review-session-dialog.tsx` e `quiz-runner-dialog.tsx`.
- **Quiz: componente Questionnaire do shadcn/ui + revisão por pergunta no resultado**
  ([#95](https://github.com/jopsfernandes/Personare/issues/95)).
  - `QuizRunnerDialog` troca o `RadioGroup`/`RadioGroupItem` montado à mão pelos primitivos oficiais
    `Questionnaire.Item`/`Title`/`Choices`/`Choice` (shadcn/ui) para pergunta e alternativas -- a
    navegação em si continua um único botão próprio (não `Questionnaire.Next`/`Submit`), preservando a
    tolerância a pergunta sem resposta já decidida na #93.
  - A tela de resultado ganha uma lista de revisão por pergunta, abaixo do radial chart e dos tempos:
    texto da pergunta, resposta escolhida (ou "nenhuma resposta"), resposta correta (quando a escolhida
    estava errada) e um indicador de acerto/erro.
- **Parser de arquivos .apkg do Anki** ([#29](https://github.com/jopsfernandes/Personare/issues/29)).
  Primeira etapa da importação de Anki (Plan.md seção 6, Fase 3): extrai o zip `.apkg` e abre o banco
  SQLite interno para leitura, sem UI nem mapeamento de conteúdo ainda (isso fica para as Issues #30 e
  #31) -- um módulo puro, `parseApkg`, consumido pelas issues seguintes.
  - Suporta as 3 versões de pacote que o próprio Anki gera: `collection.anki2`/`.anki21` (SQLite puro,
    exports de versões antigas) e `collection.anki21b` (SQLite comprimido em zstd, formato padrão desde
    o Anki 2.1.50+), detectadas pelo arquivo `meta` do pacote quando presente.
  - Resolve a lista de mídia (JSON legado ou protobuf `MediaEntries` no formato novo) para nomes de
    arquivo originais, e devolve os bytes de cada mídia referenciada.
  - Novo módulo utilitário `src/utils/protobuf-lite.ts` (parser genérico de wire format, sem depender de
    uma lib de protobuf completa) e `src/utils/zstd.ts` (compress/decompress via `zstd-codec`, WASM, sem
    binário nativo).
- **Mapeamento de note types/templates do Anki para Flashcard** ([#30](https://github.com/jopsfernandes/Personare/issues/30)).
  Segunda etapa da importação de Anki: converte o banco SQLite extraído pela Issue #29 em cards prontos
  para virar `Flashcard` do Personare, sem tocar DB/IPC/UI ainda (isso fica para uma issue de importação
  futura) -- um módulo puro, `mapAnkiNotesToFlashcards`.
  - Suporta os dois schemas de coleção que um `.apkg` real pode conter: o legado (`col.models`/
    `col.decks` como JSON) e o normalizado (tabelas `notetypes`/`fields`/`templates`/`decks`, com as
    colunas `config` decodificadas via `protobuf-lite`).
  - Renderiza os templates de front/verso do Anki (substituição de campos, seções condicionais
    `{{#Campo}}`/`{{^Campo}}`, `{{FrontSide}}`) e note types de cloze deletion, gerando um card por
    número de cloze e mascarando só o número ativo em cada um.
  - Agrupa o resultado por deck do Anki (usando o deck de origem quando o card está num deck filtrado) e
    extrai, por card, os nomes de arquivo de mídia referenciados no HTML renderizado.
- **Conversão de estado SM-2 para seed inicial de FSRS** ([#31](https://github.com/jopsfernandes/Personare/issues/31)).
  Terceira etapa da importação de Anki: gera, por card do banco extraído pela Issue #29, um estado
  inicial de FSRS pronto para virar `ReviewItem` do Personare -- também um módulo puro,
  `seedReviewStateFromAnkiCards`, sem tocar DB/IPC/UI (fica para a mesma issue de importação futura da
  #30; os dois resultados se casam pelo `cardId`/`cards.id`, não por posição na lista).
  - Usa o estado real do scheduler FSRS do próprio Anki (`cards.data`) quando presente -- coleções do
    Anki 23.10+ com FSRS habilitado já guardam `stability`/`difficulty` na mesma escala do `ts-fsrs`.
  - Sem esse estado nativo, estima `stability`/`difficulty` a partir do intervalo/fator de facilidade do
    SM-2 (`ivl`/`factor`), ancorado nos próprios parâmetros padrão do FSRS (`request_retention`,
    `S_MIN`) e no piso de ease que o Anki mesmo impõe -- não é (nem tenta ser) um mapeamento 1:1.
- **Backup via Google Drive** ([#27](https://github.com/jopsfernandes/Personare/issues/27)).
  Complementa o Backup local (Issue #21) com uma cópia extra fora do dispositivo, no próprio Google
  Drive do usuário -- não o substitui. Reaproveita o mesmo padrão de conexão OAuth separada do login já
  estabelecido pelo Calendar sync (Issue #26), mediado pelo backend compartilhado.
  - Escopo `drive.appdata`: pasta especial oculta, invisível na UI normal do Drive do usuário,
    classificada por padrão como não-sensível pelo Google (diferente de `drive.file`/`drive`).
  - Botão **"Conectar Google Drive"** (Configurações → Conta), com o mesmo diálogo de consentimento
    explícito por escopo já usado pelo Calendar (LGPD, Issue #28).
  - Nova seção **"Backup no Google Drive"** (Configurações), visível só quando conectado: **"Fazer
    backup no Drive"** e **"Restaurar do Drive"**, mesma senha/criptografia (AES-256-GCM) e mesma
    semântica de restauração por substituição total já usadas no Backup local -- o backend nunca vê o
    conteúdo em claro nem a passphrase, só transporta os bytes já cifrados pelo Electron.
  - Um único arquivo de backup, sempre sobrescrito -- sem versionamento/histórico. Gatilho manual, sob
    demanda -- sem backup agendado/automático.
  - `DELETE /auth/me` (exclusão de conta) e `GET /auth/me/export` (exportação LGPD) estendidos para
    também revogar/reportar a conexão do Drive, mesmo tratamento já dado à conexão do Calendar.
- **Agendamento FSRS para Quiz/PDF/Link via dificuldade percebida** ([#77](https://github.com/jopsfernandes/Personare/issues/77)).
  Resolve a decisão que `Plan.md` (seção 1.2) deixava formalmente em aberto: Atividades do tipo Quiz,
  PDF e Link passam a poder ser agendadas pelo mesmo motor FSRS que já agenda Flashcards. Nova ação
  "Marcar como concluído" na row da Atividade (visível só para quiz/pdf/link -- Baralho continua com seu
  próprio fluxo por Flashcard) abre o mesmo passo de avaliação Again/Hard/Good/Easy da revisão de
  Flashcard; a primeira marcação cria e já avalia um `ReviewItem` da Atividade inteira, marcações
  seguintes reaproveitam esse mesmo `ReviewItem`. A row passa a mostrar a última dificuldade registrada e
  a próxima data de revisão.
  - `review_items.flashcard_id` vira opcional e ganha uma nova coluna opcional `activity_id` --
    exatamente um dos dois preenchido, validado em app (mesmo padrão de `activities.type`, não um CHECK
    de banco).
  - Novos procedures `review.markActivityDifficulty` e `review.listActivityReviewState`; `review.listSchedule`
    e `countDueReviews` (boot, notificação de revisões pendentes) passam a somar as duas origens
    (Flashcard-scoped e Activity-scoped), então essas Atividades também aparecem no Calendário.
  - `flashcard_deck` fica inalterado -- continua com um `ReviewItem` por Flashcard, sem `ReviewItem` no
    nível da Atividade.
  - Corrigido durante validação manual: a primeira marcação de uma Atividade usava o scheduler default
    do `ts-fsrs` (pensado pra revisão de Flashcard na mesma sessão), agendando a próxima revisão minutos
    depois em vez de um intervalo real em dias -- `markActivityDifficulty` agora usa
    `enable_short_term: false`, então mesmo a primeira marcação já agenda um intervalo real.
- **Requisitos de LGPD: exclusão de conta, exportação de dados, consentimento explícito** ([#28](https://github.com/jopsfernandes/Personare/issues/28)).
  Implementado contra o backend compartilhado, escopado à **conta** (identidade no backend + conexão do
  Google Calendar), não ao conteúdo de estudo local -- que já tem seu próprio CRUD/soft-delete por
  entidade e exportação completa via Backup local (Issue #21).
  - **"Exportar dados da conta"** (Configurações → Conta, visível só logado): salva um JSON com o perfil
    e o status da conexão de Calendar mantidos pelo backend -- nunca inclui nenhum token. Deixa explícito
    na UI que isso é diferente do Backup local.
  - **"Excluir minha conta"**: diálogo de confirmação destrutiva (mesmo padrão da Issue #21) explicando
    claramente o que é apagado (perfil e conexão do Calendar no backend) e o que **não** é apagado (todo
    o conteúdo de estudo local). Ao confirmar, a sessão local é limpa exatamente como no logout.
  - **`src/components/scope-consent-dialog.tsx` (novo, genérico)**: antes de abrir o OAuth do Google para
    conectar o Calendar, o Personare agora mostra sua própria tela de consentimento, na própria
    linguagem do produto, explicando o que o escopo faz e por quê -- distinta da tela de consentimento do
    próprio Google (Issue #24), que está fora do nosso controle visual. Já preparado para a Issue #27
    (Drive) reaproveitar com outra descrição quando existir.
  - Cobertura de testes em `auth-ipc.test.ts`, `backend-client.test.ts`, `dialog-ipc.test.ts` e
    `settings-page.test.tsx` (estendidos). 489/489 testes passando, sem regressão.

- **Sincronização com Google Calendar (unidirecional)** ([#26](https://github.com/jopsfernandes/Personare/issues/26)).
  Adiciona sincronização unidirecional Personare → Google Calendar: cada `ReviewItem` pendente passa a
  poder aparecer como evento no Google Calendar do usuário. Nada vem de volta do Google Calendar para o
  Personare -- decisão de produto confirmada com o usuário antes do spec, sem merge/conflito (o
  protocolo de sync multi-dispositivo continua formalmente em aberto, Fase 4).
  - **Autorização separada do login** (Issue #25): novo botão "Conectar Google Calendar" em
    Configurações → Conta, visível só quando logado, pedindo o escopo `calendar.events` (não o escopo
    `calendar` completo) contra um segundo fluxo OAuth do backend compartilhado
    (`jopsfernandes/study-butler-backend`, mesmo protocolo `personare://`, host diferente
    `calendar-connect-callback`). `src/main.ts` agora despacha a URL de callback por hostname
    (`getProtocolCallbackHost`) entre o fluxo de login e o de conexão do Calendar, mantendo os dois
    handlers isolados.
  - **Novo namespace de IPC/oRPC `calendarSync`** (`src/ipc/calendar-sync/`): `connect()`,
    `getConnectionStatus()`, `sync(reviewItems)`. O JWT da sessão atual fica em memória
    (`src/ipc/auth/state.ts`, `getAuthToken`/`setAuthToken`, novo) para ser anexado como Bearer nas
    chamadas ao backend sem reler o arquivo criptografado a cada ação.
  - **Botão "Sincronizar agora" na página Calendário**: reconcilia sob demanda contra o backend (cria,
    atualiza ou remove eventos do Google Calendar refletindo a lista atual de revisões pendentes) --
    sem sincronização automática em background, a issue pede só sob demanda.
  - Cobertura de testes em `src/tests/unit/oauth-callback.test.ts`, `backend-client.test.ts`,
    `calendar-sync-ipc.test.ts` (novo), `settings-page.test.tsx` e `calendar-page.test.tsx` (estendidos).
    465/465 testes passando, sem regressão.

- **Login com Google via OAuth no Electron** ([#25](https://github.com/jopsfernandes/Personare/issues/25)).
  Adiciona uma seção "Conta" em Configurações para entrar/sair com uma conta Google, contra o backend
  compartilhado `Study-Butler-Backend` (repositório separado, `jopsfernandes/study-butler-backend`), que
  já expõe o fluxo OAuth2 + emissão de JWT. O app continua funcionando totalmente sem login -- esta issue
  é só autenticação, nenhuma sincronização de conteúdo (Calendar/Drive) foi implementada ainda.
  - **⚠️ Mudança de comportamento visível a toda sessão**: o app agora exige instância única
    (`app.requestSingleInstanceLock()`) -- abrir o Personare uma segunda vez foca a janela já aberta em
    vez de iniciar um processo novo. Necessário para capturar a URL do protocolo customizado quando o app
    já está rodando (evento `second-instance`).
  - **Fluxo**: "Entrar com Google" chama `shell.openExternal` para abrir o navegador do sistema contra
    `GET /auth/google` do backend (nunca uma `BrowserWindow` embutida carregando o login do Google -- o
    app nunca vê a senha); o backend redireciona para `personare://oauth-callback?token=<jwt>` (protocolo
    customizado registrado via `app.setAsDefaultProtocolClient`); `src/main.ts` captura essa URL via
    `open-url` (macOS) ou `second-instance`/`process.argv` (Windows/Linux), valida o token contra
    `GET /auth/me` do backend (`src/main/backend-client.ts`) e guarda a sessão em memória.
  - **Token persistido via `safeStorage`** (`src/main/auth-token-storage.ts`), nunca em texto plano e
    nunca no SQLite local (é credencial, não dado de conteúdo); se o keychain/credential manager do SO
    não estiver disponível, a sessão simplesmente não persiste entre reinícios, sem fallback insegredo.
  - **Novo namespace de IPC/oRPC `auth`** (`src/ipc/auth/`): `login()`, `getSession()`, `logout()`. A UI
    (`src/components/account-section.tsx`) faz polling de `getSession()` a cada 2s por até 2 minutos após
    clicar em "Entrar com Google" -- não foi introduzido nenhum canal de push main→renderer novo só para
    este caso único.
  - **Validação manual documentada** (a orquestração de protocolo/single-instance em `main.ts` não é
    testável de forma automatizada com o stack atual, mesmo padrão já estabelecido pelo Tray da Issue
    #20): RED/GREEN cobrem toda a lógica extraível e pura (`src/main/oauth-callback.ts`,
    `auth-token-storage.ts`, `backend-client.ts`, namespace `auth`, seção "Conta"); o fluxo ponta a ponta
    completo (navegador real, callback do protocolo, restauração de sessão no boot) depende de
    credenciais reais do Google Cloud Console e é validado manualmente antes de distribuir.
  - Cobertura de testes em `src/tests/unit/auth-token-storage.test.ts`, `backend-client.test.ts`,
    `auth-ipc.test.ts`, `oauth-callback.test.ts` (novos) e `settings-page.test.tsx` (estendido). 440/440
    testes passando, sem regressão.

- **Backup local (exportação/importação criptografada)** ([#21](https://github.com/jopsfernandes/Personare/issues/21)).
  Adiciona uma seção "Backup local" na tela de Configurações para exportar todos os dados do usuário para um arquivo local criptografado e restaurá-los depois, funcionando independente de login Google:
  - **Criptografia via `node:crypto` nativo, sem dependência nova**: `src/utils/backup-crypto.ts` cifra com AES-256-GCM (autenticado, detecta arquivo corrompido/adulterado), derivando a chave de uma passphrase via `scryptSync`. O arquivo (extensão `.personare-backup`) é um envelope binário `MAGIC + salt + iv + authTag + ciphertext`; a passphrase nunca é persistida, é pedida a cada exportação/importação.
  - **Formato do conteúdo**: `src/utils/backup-codec.ts` serializa/deserializa um `BackupData` (uma linha por tabela de negócio — `programs`, `modules`, `activities`, `quiz_questions`, `quiz_options`, `flashcards`, `review_items`, `app_settings`, incluindo linhas soft-deletadas) para JSON, convertendo `Date` de forma explícita (replacer/reviver) já que drizzle-orm lê essas colunas como objetos `Date`.
  - **Importação = substituição total, não mescla**: `src/utils/backup-data.ts`'s `restoreBackupData` apaga todas as tabelas de negócio e reinsere o conteúdo do backup dentro de uma única transaction (atômico), respeitando a ordem das foreign keys. É "restaurar um backup", não "sincronizar dois conjuntos de dados" — o protocolo de resolução de conflito multi-dispositivo continua formalmente em aberto (Fase 4, Issues #32/#33). Por ser destrutiva, a UI exige que o usuário veja um aviso explícito antes de confirmar.
  - **Novo namespace de IPC/oRPC `backup`** (`src/ipc/backup/`): `exportBackup({ filePath, passphrase })` e `importBackup({ filePath, passphrase })`. Uma importação bem-sucedida chama `app.relaunch(); app.exit(0);` — o app reinicia com um processo e renderer totalmente novos lendo o banco já restaurado, em vez de invalidar manualmente todo cache de query da sessão atual.
  - **Dois novos handlers em `src/ipc/dialog/`**: `selectBackupExportPath` (`showSaveDialog`) e `selectBackupImportFile` (`showOpenDialog`), ambos restritos à extensão `.personare-backup`, seguindo o padrão já usado por `selectPdfFile` (Issue #13).
  - Cobertura de testes em `src/tests/unit/backup-codec.test.ts`, `backup-crypto.test.ts`, `backup-data.test.ts`, `backup-ipc.test.ts` (novos), `dialog-ipc.test.ts` e `settings-page.test.tsx` (estendidos). 414/414 testes passando, sem regressão.

- **Notificação via inicialização com o sistema operacional** ([#20](https://github.com/jopsfernandes/Personare/issues/20)).
  Adiciona inicialização automática do Personare junto com o SO, iniciando oculto na bandeja do sistema quando lançado dessa forma, calculando e notificando as revisões pendentes do dia:
  - **⚠️ Mudança de UX visível a toda sessão, não só a quem ativar o auto-start**: fechar a janela principal (botão X) agora **minimiza para a bandeja do sistema em vez de encerrar o app**, independente de como o app foi iniciado. O app só encerra de fato pelo item "Sair" do menu da bandeja. `src/main.ts` intercepta o evento `close` da janela (não `window-all-closed`, que dispara tarde demais para cancelar) e usa uma flag `isQuitting` (só `true` dentro do handler de "Sair", antes de `app.quit()`) para distinguir "esconder" de "encerrar de verdade".
  - **Mudança de schema**: nova tabela singleton `app_settings` (`id` fixo `1`, `auto_start_enabled` boolean default `false`), aplicada via `drizzle/0006_sad_sebastian_shaw.sql`. A linha é criada de forma preguiçosa na primeira leitura/escrita, não semeada pela migration.
  - **Novo namespace de IPC/oRPC `settings`** (`src/ipc/settings/`), registrado em `src/ipc/router.ts`: `get()` (lê ou cria a linha singleton) e `setAutoStart({ enabled })` (faz upsert da preferência **e** chama `app.setLoginItemSettings({ openAtLogin: enabled })` no mesmo handler, com efeito imediato no registro do SO, não só na próxima inicialização).
  - `src/main/due-reviews.ts`: `countDueReviews(db, now)` — mesmo join que `review.listDue`/`review.listSchedule` já usam (não alterados por esta issue), mas global e filtrado por `dueDate <= now`; não exposto como procedure oRPC, é consultado só internamente pelo processo main para decidir se dispara notificação.
  - `src/main/tray-icon.ts`: `createPlaceholderTrayIcon()` gera um ícone 32×32 (círculo preenchido) inteiramente em memória via `nativeImage.createFromBuffer` — **ícone placeholder intencional e temporário**, sem asset de marca no repositório ainda; trocar por um ícone real fica para trabalho futuro.
  - `src/main.ts` reescrito: lê `app.getLoginItemSettings().wasOpenedAtLogin` antes de criar qualquer janela; sincroniza o registro do SO com a preferência salva a cada boot; cria o `Tray` sempre (menu "Abrir Personare"/"Sair", clique no ícone também foca a janela); se foi aberto pelo login item, pula `createWindow()` e dispara uma `Notification` nativa (texto fixo em português; internacionalização de notificação nativa fica para trabalho futuro) quando há revisões pendentes; caso contrário, cria a janela normalmente.
  - Novo componente shadcn `src/components/ui/switch.tsx` e nova rota `src/routes/settings.tsx` (item `navSettings` na Sidebar): seção "Inicialização automática" com um toggle ligado a `settings.get()`/`settings.setAutoStart()` e um parágrafo explicando claramente o que a opção faz.
  - **Validação manual documentada** (a orquestração de ciclo de vida do Electron em `main.ts` — criar janela vs. Tray, interceptar `close` — não é testável de forma automatizada com o stack atual): build empacotado real, toggle testado contra um registro de auto-start genuíno do Windows (criado e removido na mesma sessão), `close` interceptado confirmado ponta a ponta contra a janela real.
  - Cobertura de testes automatizados em `src/tests/unit/due-reviews.test.ts`, `src/tests/unit/tray-icon.test.ts` e `src/tests/unit/settings-ipc.test.ts` (novos). 377/377 testes passando, sem regressão.

- **Calendário: visão de lista/mês das próximas revisões** ([#18](https://github.com/jopsfernandes/Personare/issues/18)).
  Adiciona uma página de Calendário acessível pela Sidebar, exibindo um evento por `ReviewItem` pendente (mostrando a frente do Flashcard), restrita a duas views (Mês e Agenda/Lista) e sem drag-and-drop, conforme pedido pela issue:
  - **Novo componente `EventCalendar` da ReUI** (`npx shadcn@latest add @reui/event-calendar`), instalado em `src/components/reui/event-calendar/*`, trazendo `date-fns`/`@date-fns/tz`/`@base-ui/react` como novas dependências. Usado com `views={["month", "agenda"]}` (restringindo o seletor às duas views pedidas) e `interactions={{ drag: false, resize: false, selectSlot: false }}` + `readOnly: true` em cada evento gerado — duas camadas de garantia contra edição, já que o componente vem com drag-and-drop habilitado por padrão.
  - **Extensão do namespace de IPC/oRPC `review`** (Issue #16), sem quebrar o contrato existente: `ensureReviewItems` ganhou `activityId` opcional — quando omitido, cobre todos os flashcards não deletados do app (não só os de uma Atividade), garantindo que Baralhos nunca revisados apareçam no calendário. Nova procedure `listSchedule` (sem input, sem o filtro `dueDate <= now()` que `listDue` tem, já que o calendário também mostra revisões futuras), com join até `modules`/`programs` para dar suporte à navegação, retornando `{ id, dueDate, front, activityId, activityTitle, moduleId, programId }` por linha. `listDue`/`submitRating`/`review-session-dialog.tsx` (Issue #16) permanecem intocados.
  - Novo `src/actions/calendar.ts`: wrapper para `listSchedule`/`ensureReviewItems({})` e a função pura `toCalendarEvents` mapeando as linhas para o formato `CalendarEvent` da ReUI.
  - `src/routes/calendar.tsx`: placeholder substituído pela composição do `EventCalendar`; cada evento é clicável (via `renderEvent`) e navega até o Módulo de origem da Atividade.
  - **Bug pré-existente descoberto durante o trabalho, registrado separadamente na Issue #64 (não corrigido nesta issue)**: um problema de precisão de timestamp que motivou ajuste em um teste de `listSchedule`, sem relação com a lógica de calendário em si.
  - **Bugfix nesta issue**: o primeiro GREEN usava `defaultEvents` (não-controlado, lido só na montagem) para alimentar o `EventCalendar`, mas o carregamento de dados da rota é assíncrono (`ensureReviewItems` → `listSchedule`), então o componente capturava o array vazio inicial e nunca mais olhava para os dados — o calendário sempre mostrava "sem eventos" apesar da busca funcionar. Corrigido trocando para o par controlado `events`/`onEventsChange`, conforme a própria documentação da ReUI recomenda quando a aplicação (aqui, o banco via `listSchedule`) é a fonte de verdade dos dados. Achado testando visualmente contra um build empacotado, não pelos testes unitários (que mockam o componente ReUI inteiro).
  - Cobertura de testes em `src/tests/unit/review-ipc.test.ts` (novos casos para `listSchedule` e `ensureReviewItems` sem `activityId`), `src/tests/unit/calendar-actions.test.ts` (novo) e `src/tests/unit/calendar-page.test.tsx` (novo). 340/340 testes passando, sem regressão.

- **Motor FSRS: sessão de revisão do Baralho** ([#16](https://github.com/jopsfernandes/Personare/issues/16)).
  Integra a biblioteca `ts-fsrs` ao `ReviewItem`, com uma tela de sessão de revisão que itera pelos cartões pendentes de um Baralho, captura o rating do usuário (again/hard/good/easy) e atualiza `stability`/`difficulty`/`due_date` via o algoritmo FSRS:
  - **Mudança de schema**: `review_items` estendida com os campos que o `Card` do `ts-fsrs` precisa para reagendar corretamente além do que já existia (`difficulty`/`stability`/`due_date`/`last_rating`/`rating_history`) — `state` (texto, default `"New"`), `reps`/`lapses`/`scheduled_days`/`learning_steps` (inteiro, default `0`) e `last_reviewed_at` (timestamp nullable). `elapsed_days` do `Card` é intencionalmente nunca persistido (marcado `@deprecated` na própria lib, será removido na v6). Migration `drizzle/0005_violet_puff_adder.sql`.
  - Novo módulo puro `src/utils/fsrs.ts`, sem I/O: `createInitialReviewItemFields` (estado inicial via `createEmptyCard()`), `toFsrsCard`/`fromFsrsCard` (ponte entre a linha persistida e o tipo `Card` da biblioteca) e `applyRating` (chama `fsrs().next(...)` com parâmetros default, sem customização de `request_retention`/`learning_steps`).
  - **Novo namespace de IPC/oRPC `review`** (`src/ipc/review/`), registrado em `src/ipc/router.ts`: `ensureReviewItems({ activityId })` (criação preguiçosa e idempotente de um `review_items` por flashcard ainda sem um, via `LEFT JOIN` + `WHERE IS NULL`), `listDue({ activityId })` (cartões com `due_date <= now()`, já com `front`/`back` do flashcard via join, evitando N+1 na UI) e `submitRating({ reviewItemId, rating })` (valida o rating por Zod enum excluindo `"manual"`, aplica via `utils/fsrs.ts` e acrescenta ao `rating_history` em JSON). Consumido pelo renderer via `src/actions/review.ts`.
  - Novo componente `src/components/review-session-dialog.tsx`: ao abrir, chama `ensureReviewItems` e depois `listDue` para montar a fila em memória; por cartão, revela frente → verso e os 4 botões de rating; ao avaliar, a fila local avança sem reconsultar `listDue`, mostrando mensagens de "nada para revisar agora" ou "sessão concluída" quando aplicável.
  - `src/components/activities-data-table.tsx` e `src/routes/programs.$programId.modules.$moduleId.tsx`: novo botão condicional "iniciar revisão" (ícone `Repeat`, distinto do `Layers` de "gerenciar flashcards" e do `Play` de "responder quiz") para Atividades do tipo `flashcard_deck`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para a ação de iniciar revisão, revelar resposta, os 4 ratings e as mensagens de fila vazia/sessão concluída.
  - **Fora de escopo, explicitamente não tocado**: `flashcard-form-dialog.tsx`/`flashcard-manager-dialog.tsx` (Issue #15) e o fluxo de criação de Flashcard — a criação de `review_items` é preguiçosa, não acontece na criação do Flashcard; nenhum parâmetro customizado de FSRS, preview de múltiplos outcomes ou UI de estatísticas de progresso; Calendário (Issue #18) e notificação do SO (Issue #20), mesmo usando `due_date` como dado que eventualmente alimentará essas telas.
  - Cobertura de testes em `src/tests/unit/fsrs-utils.test.ts`, `src/tests/unit/review-ipc.test.ts`, `src/tests/unit/review-session-dialog.test.tsx` e novos casos em `src/tests/unit/activities-data-table.test.tsx`. 320/320 testes passando, sem regressão.

- **Atividade do tipo Flashcard/Baralho: CRUD de Flashcards** ([#15](https://github.com/jopsfernandes/Personare/issues/15)).
  Adiciona CRUD de Flashcards (frente/verso) dentro de uma Atividade do tipo `flashcard_deck` (Baralho):
  - **Nenhuma migration nova**: as tabelas `flashcards` e `review_items` já existiam desde `drizzle/0001_chilly_zombie.sql` (schema fundacional); esta issue só implementa o CRUD sobre a tabela `flashcards` já existente.
  - **Novo namespace de IPC/oRPC `flashcards`** (`src/ipc/flashcards/`), espelhando `ipc/activities` (entidade flat, sem sub-entidade): `list({ activityId })`/`create({ activityId, front, back })`/`update({ id, front, back })`/`softDelete({ id })`, registrado em `src/ipc/router.ts`. `front`/`back` rejeitam string vazia (Zod `.min(1)`). Consumido pelo renderer via `src/actions/flashcards.ts` (wrappers finos, sem camada de composição — Flashcard não tem sub-entidade como as opções do Quiz).
  - Novo componente `src/components/flashcard-form-dialog.tsx`: cria/edita UM flashcard por vez (campos `front`/`back`, validação HTML nativa `required`).
  - Novo componente `src/components/flashcard-manager-dialog.tsx`: gerenciador de todos os flashcards de um Baralho, mostrando frente e verso de cada linha (tela de autoria, não a tela de revisão) — listar, adicionar, editar, excluir (soft-delete).
  - `src/components/activities-data-table.tsx` e `src/routes/programs.$programId.modules.$moduleId.tsx`: novo botão condicional "gerenciar flashcards" (ícone `Layers`) para Atividades do tipo `flashcard_deck`, seguindo o mesmo padrão condicional de `link`/`pdf`/`quiz`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para o gerenciador e o formulário de flashcard, reaproveitando `saveAction`/`cancelAction` já existentes.
  - **Fora de escopo, explicitamente não tocado**: qualquer leitura/escrita em `review_items`, integração com `ts-fsrs` e a tela de sessão de revisão — tudo isso pertence à Issue #16 (Motor FSRS), que depende desta issue estar concluída. Um Flashcard criado por esta feature fica sem `ReviewItem` associado até a Issue #16 existir.
  - Cobertura de testes em `src/tests/unit/flashcards-ipc.test.ts`, `src/tests/unit/flashcard-form-dialog.test.tsx`, `src/tests/unit/flashcard-manager-dialog.test.tsx` e novos casos em `src/tests/unit/activities-data-table.test.tsx`. 272/272 testes passando, sem regressão.

- **Atividade do tipo Quiz: perguntas de múltipla escolha, execução e resultado** ([#14](https://github.com/jopsfernandes/Personare/issues/14)).
  Adiciona suporte a Quiz com múltiplas perguntas de múltipla escolha por Atividade, usado quando `type = 'quiz'`:
  - **Mudança de schema**: novas tabelas `quiz_questions` (`id`, `activity_id` FK, `text`, `created_at`/`updated_at`, `deleted_at` para soft-delete) e `quiz_options` (`id`, `question_id` FK, `text`, `is_correct`, `created_at`/`updated_at`, `deleted_at` — cada opção tem soft-delete próprio, mesmo padrão do resto do app) em `src/database/schema.ts`, aplicadas via `drizzle/0004_overconfident_whiplash.sql`.
  - **Novo namespace de IPC/oRPC `quiz`** (`src/ipc/quiz/`), espelhando `ipc/activities`: `listQuestions`/`createQuestion`/`updateQuestion`/`softDeleteQuestion` e `listOptions`/`createOption`/`updateOption`/`softDeleteOption`, registrado em `src/ipc/router.ts`. Consumido pelo renderer via `src/actions/quiz.ts`, que também expõe `listQuizQuestionsWithOptions(activityId)` — composição no processo renderer que evita N+1 dentro de um handler.
  - `src/utils/quiz-scoring.ts`: função pura `calculateQuizScore(questions, answers)`, sem I/O; pergunta sem resposta conta como errada, sem lançar exceção.
  - Novo componente `src/components/quiz-question-form-dialog.tsx`: cria/edita uma pergunta e suas alternativas, com validação client-side (mínimo 2 opções com texto, exatamente 1 correta).
  - Novo componente `src/components/quiz-question-manager-dialog.tsx`: gerenciador de todas as perguntas de um Quiz (listar, adicionar, editar, excluir). Ao editar uma pergunta, as opções são reconciliadas via soft-delete-and-recreate (o form não devolve `id` das opções existentes).
  - Novo componente `src/components/quiz-runner-dialog.tsx`: tela de execução do Quiz (radio buttons por pergunta) e tela de resultado ao final ("X de Y corretas"). Estado de resposta vive só em memória do componente — a V1 não persiste tentativas de Quiz no banco (Plan.md 1.2), reiniciando do zero se o diálogo for fechado e reaberto.
  - `src/components/activities-data-table.tsx` e `src/routes/programs.$programId.modules.$moduleId.tsx`: dois novos botões condicionais para Atividades do tipo `quiz` — "gerenciar perguntas" (`ListChecks`) e "responder quiz" (`Play`) — seguindo o mesmo padrão condicional já usado para `link`/`pdf`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para os formulários de pergunta/opção, ações do gerenciador e executor, e o resultado do Quiz (interpolação `{{correct}}`/`{{total}}`).
  - Fora de escopo desta issue e não alterados: Issue #15 (Flashcards/Baralho), geração de `ReviewItem` a partir de Quiz e persistência de tentativas/histórico de resultado no banco — todos explicitamente adiados pelo Plan.md para versão futura.
  - Cobertura de testes em `src/tests/unit/quiz-schema.test.ts`, `src/tests/unit/quiz-ipc.test.ts`, `src/tests/unit/quiz-scoring.test.ts`, `src/tests/unit/quiz-question-form-dialog.test.tsx`, `src/tests/unit/quiz-actions.test.ts`, `src/tests/unit/quiz-question-manager-dialog.test.tsx`, `src/tests/unit/quiz-runner-dialog.test.tsx` e novos casos em `src/tests/unit/activities-data-table.test.tsx`. 241/241 testes passando, sem regressão.

- **Atividade do tipo PDF: seleção e visualização de arquivo** ([#13](https://github.com/jopsfernandes/Personare/issues/13)).
  Adiciona suporte a um arquivo PDF associado à Atividade, usado quando `type = 'pdf'`:
  - **Mudança de schema**: nova coluna `activities.file_path` (`text`, nullable) em `src/database/schema.ts`, aplicada via `drizzle/0003_past_crusher_hogan.sql` (`ALTER TABLE activities ADD file_path text`, sem `NOT NULL`), seguindo o mesmo padrão de coluna opcional por tipo da Issue #12 (`url`).
  - **Novo namespace de IPC/oRPC `dialog`** (`src/ipc/dialog/`), expondo a procedure `selectPdfFile`, registrada em `src/ipc/router.ts`. No processo main, usa `dialog.showOpenDialog` do Electron filtrado para extensão `.pdf` (`properties: ["openFile"]`), retornando o caminho do arquivo escolhido ou `null` se o usuário cancelar. Consumida pelo renderer via `src/actions/dialog.ts`. **Nota para a Issue #14**: este é o primeiro namespace de IPC que não é um CRUD sobre uma tabela — expõe uma capability do processo main (file dialog nativo do SO), sem schema de validação de payload próprio.
  - IPC de `activities` (`src/ipc/activities/schemas.ts` e `handlers.ts`) atualizado para aceitar e retornar `filePath` em `create`/`update`/`list`, consumido pelo renderer via `src/actions/activities.ts`.
  - `src/components/activity-form-dialog.tsx`: novo botão de seleção de arquivo, exibido apenas quando o tipo selecionado é `pdf`, que aciona `selectPdfFile` e exibe o caminho escolhido; o valor só é enviado ao submit quando o tipo é `pdf`, caso contrário `null`.
  - Novo componente `src/components/pdf-viewer-dialog.tsx`: dialog com um `iframe` (`src="file://<filePath>"`) para visualizar o PDF embutido na própria aplicação.
  - `src/components/activities-data-table.tsx`: nova ação "visualizar" (ícone `FileText`) na linha da Data Table, visível apenas para Atividades do tipo `pdf`, que abre o `PdfViewerDialog`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para o botão de seleção de arquivo, o título do iframe do visualizador e a ação "visualizar".
  - Cobertura de testes em `src/tests/unit/schema.test.ts`, `src/tests/unit/activities-ipc.test.ts`, `src/tests/unit/activity-form-dialog.test.tsx`, `src/tests/unit/activities-data-table.test.tsx`, `src/tests/unit/dialog-ipc.test.ts` (novo) e `src/tests/unit/pdf-viewer-dialog.test.tsx` (novo). 163/163 testes passando, sem regressão.

- **Atividade do tipo Link: campo de URL** ([#12](https://github.com/jopsfernandes/Personare/issues/12)).
  Adiciona suporte a uma URL associada à Atividade, usada quando `type = 'link'`:
  - **Mudança de schema**: nova coluna `activities.url` (`text`, nullable) em `src/database/schema.ts`, aplicada via `drizzle/0002_peaceful_apocalypse.sql` (`ALTER TABLE activities ADD url text`, sem `NOT NULL`). Esta é a primeira alteração no schema de `activities` desde a Issue #10, e a Issue #13 (Atividade tipo PDF) depende de partir deste schema já migrado.
  - IPC de `activities` (`src/ipc/activities/schemas.ts` e `handlers.ts`) atualizado para aceitar e retornar `url` em `create`/`update`/`list`, consumido pelo renderer via `src/actions/activities.ts`.
  - `src/components/activity-form-dialog.tsx`: novo campo de URL (`type="url"`) exibido apenas quando o tipo selecionado é `link`; o valor só é enviado ao submit quando o tipo é `link`, caso contrário `null`.
  - `src/components/activities-data-table.tsx`: nova ação "abrir URL" (ícone `ExternalLink`) na linha da Data Table, visível apenas para Atividades do tipo `link`, usando `openExternalLink` (`src/actions/shell.ts`) para abrir a URL no navegador padrão do sistema.
  - `src/localization/i18n.ts`: nova chave de tradução (en e pt-BR) para o label do campo de URL e para a ação de abrir URL.
  - Cobertura de testes em `src/tests/unit/schema.test.ts`, `src/tests/unit/activities-ipc.test.ts`, `src/tests/unit/activity-form-dialog.test.tsx` (novo) e `src/tests/unit/activities-data-table.test.tsx`. 140/140 testes passando, sem regressão.

- **CRUD de Atividade dentro de Módulo** ([#10](https://github.com/jopsfernandes/Personare/issues/10)).
  Adiciona a Data Table de Atividades à rota de um Módulo, com criação, edição e exclusão (soft-delete), espelhando o padrão dos CRUDs de Programa (Issue #8) e Módulo (Issue #9):
  - `src/routes/programs.$programId.modules.$moduleId.tsx`: placeholder substituído pela Data Table de Atividades (`src/components/activities-data-table.tsx`) do Módulo da rota atual, listando apenas as atividades não deletadas daquele Módulo.
  - `src/components/activities-data-table.tsx`: exibe cada Atividade com um `Badge` (novo componente shadcn/ui `src/components/ui/badge.tsx`) trazendo o rótulo traduzido do seu `type`.
  - `src/components/activity-form-dialog.tsx`: dialog de criar/editar Atividade (título e tipo obrigatórios; tipo escolhido via `Select`, novo componente shadcn/ui `src/components/ui/select.tsx`).
  - `src/components/delete-activity-dialog.tsx`: confirmação via `AlertDialog` antes da exclusão, que é soft-delete (`deleted_at`), não remoção da linha.
  - Novo namespace de IPC/oRPC `activities` (`src/ipc/activities/`), expondo `list` (filtrado por `moduleId`)/`create`/`update`/`softDelete`, registrado em `src/ipc/router.ts` e consumido pelo renderer via `src/actions/activities.ts`.
  - `activities.type` permanece uma coluna de texto aberta (`z.string().min(1)`, sem enum fechado), conforme definido na Issue #4: o formulário e o `Badge` cobrem os tipos do MVP (`link`, `quiz`, `pdf`, `flashcard_deck`), mas a API aceita outros valores de tipo.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para título da página, botões, labels do formulário, rótulos de tipo e confirmação de exclusão, sem texto hardcoded; placeholder `activitiesPlaceholder` removido.
  - Cobertura de testes em `src/tests/unit/activities-ipc.test.ts` (handlers de IPC, incluindo filtro por `moduleId`, que `softDelete` não aparece em `list` e aceitação de um tipo fora do MVP) e `src/tests/unit/activities-data-table.test.tsx` (renderização da Data Table, Badge de tipo e ações).
  - Fora de escopo desta issue e não alterados: Sidebar (`src/components/app-sidebar.tsx`), CRUDs de Programa e Módulo (`src/ipc/programs/`, `src/ipc/modules/`) e schema do banco.

- **CRUD de Módulo dentro de Programa** ([#9](https://github.com/jopsfernandes/Personare/issues/9)).
  Adiciona a Data Table de Módulos à rota de um Programa, com criação, edição e exclusão (soft-delete), espelhando o padrão do CRUD de Programa (Issue #8):
  - `src/routes/programs.$programId.tsx`: placeholder substituído pela Data Table de Módulos (`src/components/modules-data-table.tsx`) do Programa da rota atual, listando apenas os módulos não deletados daquele Programa.
  - `src/components/module-form-dialog.tsx`: dialog de criar/editar Módulo (nome obrigatório, associado ao `programId` da rota).
  - `src/components/delete-module-dialog.tsx`: confirmação via `AlertDialog` antes da exclusão, que é soft-delete (`deleted_at`), não remoção da linha.
  - `src/routes/programs.$programId.modules.$moduleId.tsx`: nova rota placeholder de Atividades do Módulo, para onde cada linha da tabela navega (conteúdo real fica para a Issue #10).
  - Novo namespace de IPC/oRPC `modules` (`src/ipc/modules/`), expondo `list` (filtrado por `programId`)/`create`/`update`/`softDelete`, registrado em `src/ipc/router.ts` e consumido pelo renderer via `src/actions/modules.ts`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para títulos, botões, labels do formulário e confirmação de exclusão, sem texto hardcoded.
  - Cobertura de testes em `src/tests/unit/modules-ipc.test.ts` (handlers de IPC, incluindo filtro por `programId` e que `softDelete` não aparece em `list`) e `src/tests/unit/modules-data-table.test.tsx` (renderização da Data Table e ações).
  - Fora de escopo desta issue e não alterados: Sidebar (`src/components/app-sidebar.tsx`), CRUD de Programa (`src/ipc/programs/`, `src/routes/index.tsx`) e schema do banco.

- **CRUD de Programa** ([#8](https://github.com/jopsfernandes/Personare/issues/8)).
  Adiciona a Data Table de Programas à tela inicial do dashboard, com criação, edição e exclusão (soft-delete):
  - `src/routes/index.tsx`: rota inicial substituída pela Data Table de Programas (`src/components/programs-data-table.tsx`), listando apenas os programas não deletados.
  - `src/components/program-form-dialog.tsx`: dialog de criar/editar Programa (nome obrigatório).
  - `src/components/delete-program-dialog.tsx`: confirmação via `AlertDialog` antes da exclusão, que é soft-delete (`deleted_at`), não remoção da linha.
  - `src/routes/programs.$programId.tsx`: nova rota placeholder de Módulos do Programa, para onde cada linha da tabela navega (conteúdo real fica para a Issue #9).
  - Novo namespace de IPC/oRPC `programs` (`src/ipc/programs/`), expondo `list`/`create`/`update`/`softDelete`, consumido pelo renderer via `src/actions/programs.ts`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para títulos, botões, labels do formulário e confirmação de exclusão, sem texto hardcoded.
  - Cobertura de testes em `src/tests/unit/programs-ipc.test.ts` (handlers de IPC, incluindo que `softDelete` não aparece em `list`) e `src/tests/unit/programs-data-table.test.tsx` (renderização da Data Table e ações).

- **Sidebar de navegação** ([#17](https://github.com/jopsfernandes/Personare/issues/17)).
  Adiciona a Sidebar principal da aplicação, usando o bloco oficial `sidebar` do shadcn/ui:
  - `src/components/app-sidebar.tsx`: novo componente com os itens de navegação "Programas" (rota `/`) e "Calendário" (nova rota placeholder `src/routes/calendar.tsx`, cujo conteúdo real fica para a Issue #18).
  - `src/layouts/base-layout.tsx`: layout raiz atualizado para envolver o conteúdo com `SidebarProvider` e renderizar a nova Sidebar (incluindo `SidebarTrigger` para colapsar/expandir) em todas as rotas.
  - Novos componentes shadcn/ui de suporte instalados via CLI: `sidebar`, `sheet`, `tooltip`, `separator`, `skeleton`, `input`.
  - `src/localization/i18n.ts`: novas chaves de tradução (en e pt-BR) para os itens do menu, sem texto hardcoded na Sidebar.
  - Indicador de rota ativa via `aria-current`/`isActive`, seguindo o padrão do bloco shadcn.
  - Cobertura de testes em `src/tests/unit/app-sidebar.test.tsx` e `src/tests/unit/base-layout.test.tsx`.

- **Schema inicial do banco de dados** ([#4](https://github.com/jopsfernandes/Personare/issues/4)).
  Modelagem das tabelas de domínio via Drizzle ORM (SQLite) em `src/database/schema.ts`, substituindo o placeholder `health_check` da Issue #2 como fonte de verdade do schema:
  - `programs` (Programa), `modules` (Módulo), `activities` (Atividade) e `flashcards` (Flashcard), formando a hierarquia Programa → Módulo → Atividade → Flashcard. Baralho não tem tabela própria: é uma `activities` com `type = 'flashcard_deck'`.
  - `activities.type` é uma coluna de texto aberta (discriminador validado pela aplicação), não um enum fechado/CHECK constraint do SQLite, permitindo adicionar novos tipos de Atividade (além de `link`, `quiz`, `pdf`, `flashcard_deck`) sem migration destrutiva.
  - `review_items` (ReviewItem) como entidade de primeira classe agendada pelo FSRS, desacoplada estruturalmente da hierarquia de conteúdo: referencia apenas o `flashcard_id` que a agenda, mantendo `stability`, `difficulty`, `due_date` e histórico de ratings (`last_rating`/`rating_history`) mesmo que o Flashcard associado seja editado.
  - Todas as tabelas de negócio usam UUID (gerado pela aplicação) como chave primária e têm `created_at`/`updated_at`; `programs`, `modules`, `activities` e `flashcards` têm soft-delete via `deleted_at` nullable.
  - Nova migration `drizzle/0001_chilly_zombie.sql` gerada via drizzle-kit, aplicada pelo `runMigrations` já existente de `src/database/migrate.ts`.
  - Cobertura de testes em `src/tests/unit/schema.test.ts`: inserção básica em cada tabela, relacionamentos (FK), soft-delete e aplicação da migration contra um banco de teste temporário.

- **Integração de banco de dados local com SQLite + Drizzle** ([#2](https://github.com/jopsfernandes/Personare/issues/2)).
  Adiciona persistência local ao app via `better-sqlite3` e `drizzle-orm`/`drizzle-kit`:
  - `src/database/client.ts`: client de conexão SQLite criado no processo main.
  - `src/database/migrate.ts`: execução automática das migrations no startup, com suporte a build empacotado via `process.resourcesPath` (e `extraResource: ["./drizzle"]` em `forge.config.ts`).
  - `drizzle/0000_init.sql`: primeira migration, vazia.
  - Novo namespace de IPC/oRPC `database` (`src/ipc/database/`), expondo `getDatabaseStatus` ao renderer.
- **Dependência `ts-fsrs` e teste de corretude do algoritmo FSRS** ([#3](https://github.com/jopsfernandes/Personare/issues/3)).
  Adicionada a biblioteca `ts-fsrs` (`^5.4.2`) como dependência do projeto, base para o agendamento de repetição espaçada (FSRS) previsto na Fase 1.
  - Novo teste de regressão `src/tests/unit/fsrs-correctness.test.ts`, validando `stability`, `difficulty` e os intervalos (`scheduled_days`) calculados pelo algoritmo FSRS-6 (pesos padrão da biblioteca) contra sequências de ratings (`again`/`hard`/`good`/`easy`).
  - Os valores de referência usados no teste são copiados literalmente da suíte de testes oficial do `ts-fsrs` (`FSRS-6.test.ts`, upstream `open-spaced-repetition/ts-fsrs`), garantindo que nossa integração se comporte de forma idêntica à implementação de referência.

### Fixed

- **PDF abria uma Dialog vazia; fluxo de avaliação de dificuldade unificado** ([#103](https://github.com/jopsfernandes/Personare/issues/103)).
  `PdfViewerDialog` renderizava um iframe apontando para `` `file://${activity.filePath}` ``, que
  ficava em branco por duas causas independentes: a concatenação gerava uma URL de `file://` inválida
  no Windows (barras invertidas, sem o triplo `/` do drive-letter), e mesmo corrigida, o Electron não
  habilita `webPreferences.plugins`, então o plugin de PDF do Chromium não estaria disponível de
  qualquer forma. Em vez de consertar o viewer embutido, PDF passa a abrir nativamente no sistema
  (`shell.openPath`), igual Link já fazia (`shell.openExternal`) -- `PdfViewerDialog` é removido.
  - Aproveitando a mudança, o botão separado de "marcar como feito" some para PDF, Link e Quiz: agora
    abrir o PDF/Link e, ao voltar o foco para a janela do app, ou fechar a Dialog do Quiz depois de
    finalizá-lo, já abre a Dialog de Dificuldade da Atividade automaticamente.
  - Se o app for fechado antes de uma avaliação pendente ser respondida, a Dialog de Dificuldade
    reabre imediatamente na próxima abertura do app (`review.getPendingActivityRating`, verificado uma
    vez na raiz do app), agora sobre a tela em que o app tiver restaurado -- nova tabela
    `pending_activity_ratings`, já que `markActivityDifficulty` (Issue #77) cria seu `review_item`
    já avaliado atomicamente, sem uma linha "pendente" para reaproveitar.
  - A Dialog de Dificuldade passa a mostrar o nome do Programa e do Módulo, além da Atividade.

- **Streak da sidebar não atualizava após avaliar uma Atividade** (follow-up da [#101](https://github.com/jopsfernandes/Personare/issues/101)).
  `StreakWidget` buscava `review.listActivityCounts` uma única vez, no `mount` -- como o widget vive
  fixo no rodapé da sidebar (nunca desmonta com a navegação), avaliar uma revisão em qualquer outro
  lugar do app (Atividade, Flashcard, ou a Dialog de pendência na raiz) não tinha como chegar até ele;
  o contador só se atualizava reabrindo o app.
  - Novo `src/utils/review-events.ts`: um pub/sub mínimo (`notifyReviewCompleted`/`onReviewCompleted`),
    já que o app não tem nenhum store global/query-cache para invalidar. `submitRating` e
    `markActivityDifficulty` (`src/actions/review.ts`) disparam o evento assim que a avaliação é
    persistida; `StreakWidget` assina o evento e refaz o fetch, atualizando a contagem e o calendário
    do popover em tempo real, sem precisar relançar o app.

- **Sincronização com Google Calendar não aparecia na agenda do usuário** (hotfix, follow-up da [#26](https://github.com/jopsfernandes/Personare/issues/26)).
  `POST /calendar/sync` (`Study-Butler-Backend`) sempre escreveu na agenda `primary` do usuário conectado, mas o escopo pedido (`calendar.events`) só permite ler/escrever eventos em agendas já existentes -- nunca permitiu `calendars.insert`, então não havia como criar uma agenda dedicada nem confirmar programaticamente que os eventos realmente apareciam na agenda certa do usuário.
  - Troca de abordagem: eventos agora vão para uma agenda secundária dedicada **"Personare"**, criada uma vez por usuário (`ensureCalendar`) e reaproveitada em todo sync seguinte via a nova coluna `calendar_id` em `google_calendar_connections`.
  - Escopo do OAuth do Calendar trocado de `calendar.events` para `calendar.app.created` (permite criar/gerenciar só as agendas que o próprio app cria, sem acesso às agendas existentes do usuário) -- conexões feitas antes deste hotfix precisam reconectar (Configurações → Conta → Conectar Google Calendar) para o escopo novo ser concedido.
  - `POST /calendar/sync` retorna `409 { error: "calendar_reconnect_required" }` quando a conexão armazenada não tem escopo suficiente para criar a agenda (ao invés de uma falha genérica), e o Personare mostra uma mensagem específica orientando a reconectar.
  - `upsertCalendarEvent`/`deleteCalendarEvent` (`Study-Butler-Backend`) passam a receber `calendarId` explicitamente em vez de assumir `"primary"`.

- **Evento no Google Calendar caía um dia depois do dia mostrado no Personare** (hotfix, follow-up da [#26](https://github.com/jopsfernandes/Personare/issues/26)).
  `handleSyncClick` (`src/routes/calendar.tsx`) mandava `row.dueDate.toISOString()` (timestamp UTC completo) para o backend, que extrai o dia via `.slice(0, 10)` -- também em UTC. Um `dueDate` cujo horário local é tarde o bastante (ou cujo fuso tem offset positivo) cruza pro dia UTC seguinte (ou anterior), então o evento no Google Calendar caía num dia diferente do mostrado na própria agenda do Personare, que já floreia corretamente para o dia local (`toCalendarEvents`, `src/actions/calendar.ts`).
  - Corrigido enviando `format(row.dueDate, "yyyy-MM-dd")` (date-fns, hora local) em vez do timestamp UTC -- mesma técnica de "floor pro dia local" já usada na renderização do calendário, só que agora também no envio pro sync.
  - Novo teste de regressão fixando `TZ=America/Sao_Paulo` (UTC-3 fixo, sem horário de verão desde 2019) com um `dueDate` que cai em dias diferentes em UTC vs. hora local, reproduzindo o bug relatado de forma determinística independente do fuso de quem roda a suíte.

- **`review_items.due_date`/`last_reviewed_at` perdiam precisão de milissegundos** ([#64](https://github.com/jopsfernandes/Personare/issues/64)).
  `src/database/schema.ts` usava `integer(..., { mode: "timestamp" })` do drizzle-orm para essas duas colunas, que trunca para segundos inteiros em todo round-trip via SQLite — bug pré-existente desde a migration fundacional, exposto pela primeira vez pela Issue #16 (FSRS, que escreve timestamps com precisão sub-segundo via `ts-fsrs`) e descoberto incidentalmente durante a Issue #18 (Calendário).
  - Corrigido trocando o modo para `{ mode: "timestamp_ms" }` nas duas colunas — reinterpretação pura na camada do driver (o integer bruto já armazenado no SQLite não muda), sem impacto de DDL: `drizzle-kit generate` confirma que nenhuma migration nova é necessária.
  - Novo teste de regressão em `src/tests/unit/schema.test.ts` (`review_items`), gravando e relendo `dueDate`/`lastReviewedAt` com milissegundos não-alinhados e conferindo o round-trip exato.
  - 378/378 testes passando, sem regressão.

- **Cascata de soft-delete ao excluir Programa/Módulo/Atividade** ([#22](https://github.com/jopsfernandes/Personare/issues/22)).
  Corrige um bug real: todo `softDelete` do app (`programs`, `modules`, `activities`, `flashcards`, `quiz.softDeleteQuestion`) setava `deletedAt` só na própria linha, sem propagar para as tabelas filhas. Isso já causava um efeito visível na Issue #18 (Calendário) — excluir um Módulo (ou Atividade, ou Programa) inteiro não removia seus Flashcards pendentes do Calendário, que continuavam aparecendo indefinidamente mesmo sem nenhum caminho de navegação de volta a eles na UI.
  - Novo módulo compartilhado `src/ipc/shared/cascade-soft-delete.ts`, com funções reaproveitáveis entre os handlers: excluir um **Programa** cascateia para seus Módulos → Atividades desses Módulos → Flashcards dessas Atividades; excluir um **Módulo** cascateia para suas Atividades → Flashcards; excluir uma **Atividade** cascateia para seus Flashcards (`flashcard_deck`) ou, no caso de `quiz`, para suas `quiz_questions` → `quiz_options`. Toda a cascata de uma mesma chamada usa o mesmo timestamp.
  - **Regra de não sobrescrita**: a cascata só atualiza linhas com `deletedAt IS NULL` — uma linha filha já excluída independentemente antes (com seu próprio timestamp) não é sobrescrita pelo timestamp da cascata do pai, preservando quando cada coisa foi de fato excluída.
  - `review_items` não é tocado por nenhuma cascata (não tem coluna `deletedAt`, decisão de design já existente desde a Issue #16) — fica automaticamente invisível em `listDue`/`listSchedule`/`ensureReviewItems` assim que o Flashcard associado é corretamente cascateado; o bug estava na ausência de cascata, não nessas queries.
  - Editar um Flashcard que já tem histórico de revisão já funcionava corretamente sem nenhuma mudança de código (`flashcards.update` não versiona/faz snapshot, então o `ReviewItem` continua referenciando o mesmo `flashcardId` e mostrando o texto atual) — coberto agora por um teste de regressão explícito que trava esse comportamento.
  - Nenhuma UI foi alterada — os diálogos de exclusão já existentes continuam chamando as mesmas procedures `softDelete`, que agora cascateiam corretamente por baixo dos panos.
  - Cobertura de testes estendida em `src/tests/unit/programs-ipc.test.ts`, `modules-ipc.test.ts`, `activities-ipc.test.ts`, `quiz-ipc.test.ts` e `review-ipc.test.ts` (incluindo a reprodução exata do bug original da Issue #18: criar Programa → Módulo → Atividade `flashcard_deck` → Flashcard → excluir o Módulo → confirmar que `listSchedule` não retorna mais aquele item). 359/359 testes passando, sem regressão.

### Changed

- **Rebranding do boilerplate `electron-shadcn` para Personare** ([#1](https://github.com/jopsfernandes/Personare/issues/1)).
  Removidas todas as referências ao boilerplate original (`electron-shadcn`) e ao autor original (`LuanRoger`), substituídas pela identidade do projeto Personare:
  - `README.md`: textos e links atualizados para o Personare.
  - `package.json`: campo `author` alterado para `Personare <contato@devfernandes.com>`.
  - `forge.config.ts`: publisher do Electron Forge (GitHub) atualizado para `owner: jopsfernandes`, `name: Personare`.
  - `src/main.ts`: configuração do `update-electron-app` atualizada para o novo repositório.
  - `src/localization/i18n.ts`: `appName` alterado para `Personare` e `madeBy` para `Made by Personare` / `Feito por Personare` (en e pt-BR).
  - `index.html`, `src/components/navigation-menu.tsx`, `src/layouts/base-layout.tsx`, `src/routes/index.tsx`: referências de UI/título atualizadas.
  - `src/tests/e2e/example.test.ts`: teste de título de janela atualizado para o novo nome do app.
  - Cobertura de testes adicionada (`src/tests/unit/branding-config.test.ts`, `src/tests/unit/branding-i18n.test.ts`, `src/tests/unit/no-legacy-branding.test.ts`) garantindo que nenhuma ocorrência de `electron-shadcn` ou `LuanRoger` permaneça no código-fonte.
