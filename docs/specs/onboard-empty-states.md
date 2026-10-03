# Spec — Primeiro uso e estados vazios que explicam

- **Branch:** `feature/onboard-empty-states`
- **Origem:** etapa `onboard` do plano da crítica de design (`.impeccable/critique/`): "estados vazios
  sem orientação", "programa e módulo nunca explicados", "'0 dias' sem contexto", heatmap vazio sem
  mensagem.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

O momento que importa é a primeira revisão agendada: a pessoa adiciona material, estuda, diz como foi e
vê quando ele volta. Os estados vazios levam até lá, sem tour e sem tela separada.

## Critérios de aceite

1. **Primeira abertura** (nenhum programa): a tela Hoje mostra "Estude hoje o que você esqueceria
   amanhã." e os três passos do ciclo, em ordem: criar um programa para o que se estuda; adicionar o
   material (PDFs, links, quizzes, flashcards); estudar e dizer como foi, para a revisão voltar em Hoje
   no dia certo. Não mostra "Nada para hoje" nem os próximos 7 dias. O botão **Criar primeiro
   programa** abre Programas com o formulário de novo programa já aberto.
2. **Com programas, mas nada agendado:** a mensagem dos próximos dias explica que as revisões aparecem
   depois de estudar uma atividade e dizer como foi.
3. **Programas vazio:** explica o que é um programa (uma área de estudo: uma disciplina, um curso, um
   concurso, com módulos dentro) e tem **Novo programa**.
4. **Módulos vazio:** explica o que é um módulo (uma parte do programa: um tema, uma unidade, um
   capítulo) e tem **Novo módulo**.
5. **Atividades vazio:** explica os tipos (PDF, link, quiz, baralho de flashcards) e que cada uma volta
   para revisão no dia certo depois de dizer como foi, e tem **Nova atividade**, sem a busca. Uma
   busca sem resultados diz que nenhuma atividade tem esse nome.
6. Nos itens 3 a 5, o botão de criar do cabeçalho some enquanto a lista está vazia (um botão principal
   por área), e o estado vazio só aparece depois de a lista carregar.
7. **Heatmap vazio** (card de programa sem nenhuma revisão): uma frase sobre o quadro diz que as
   revisões do programa vão colori-lo.
8. **Sequência zerada:** a barra lateral mostra "Sem sequência ainda" no lugar de "0 dias".
9. Textos em pt-BR e inglês.

## Escolhas técnicas

- `EmptyState` (`src/components/empty-state.tsx`): ícone, título em serifada, descrição e ação. Sem
  borda nem cartão, para não virar caixa dentro de caixa.
- `useTodayQueue` expõe `hasPrograms`. `/programs` aceita `?new=true`, que abre o formulário e some da
  URL.
- A sequência zerada usa o plural `_zero` do i18next.
