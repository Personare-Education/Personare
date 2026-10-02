# Spec — Tela "Hoje" e fila de revisão

- **Branch:** `feature/today-review-queue` (sobre `feature/typography`)
- **Origem:** o primeiro P1 da crítica de design (`.impeccable/critique/`): "não existe uma tela de
  'para hoje', e as revisões estão a três níveis de profundidade". O brief foi confirmado pelo
  usuário no `shape`.
- **Princípio do produto:** "Today first" (`PRODUCT.md`).
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

### A tela

1. **"Hoje" é a tela de abertura** (rota `/`). Programas passa para `/programs`. A barra lateral fica
   **Hoje** (com o número de revisões pendentes), **Programas** e **Calendário**.
2. **Topo:** o título "Hoje", a data por extenso, a frase "**N revisões para hoje**" (dizendo
   quantas estão atrasadas, se houver) e o botão principal **"Começar"**.
3. **Lista:** o que vence até o fim de hoje, **agrupado por programa**, na ordem dos programas.
   - Cada item é um cartão na cor do seu programa: o tipo, o título, o módulo e um selo de urgência
     ("Hoje", ou "Atrasada há N dias").
   - Os itens atrasados vêm primeiro dentro de cada grupo.
   - Um **baralho** aparece como um item só, com o número de cards que vencem ("12 cards").
4. **Clicar num item** abre a sessão só com ele.

### A sessão ("Começar")

5. Uma janela focada, **um item por vez**, com o progresso ("3 de 12") e o botão **"Pular"**.
   - **Baralho:** a revisão do baralho com o cartão que gira, igual à "Iniciar revisão". O item
     termina quando os cards que venciam acabam.
   - **PDF / link:** um cartão com "Abrir PDF" ou "Abrir link". Depois de abrir, os quatro botões
     de avaliação aparecem no próprio cartão.
   - **Quiz:** "Responder quiz" abre o quiz e, ao concluir, os botões de avaliação aparecem no
     cartão.
6. Cada avaliação é **salva na hora**. Fechar a sessão no meio não perde nada, e o que já foi
   feito some da lista.
7. **Teclado:** 1–4 avaliam (Errei / Difícil / Bom / Fácil). Na revisão de baralho, Espaço revela.

### O fim do dia

8. **Sem nada pendente** (porque o dia foi concluído, ou porque não havia nada):
   - quantas revisões foram feitas hoje;
   - a sequência de dias atual;
   - os próximos 7 dias, com quantas revisões vencem em cada um;
   - a próxima data com revisão.
9. A tela se atualiza depois de cada revisão e na virada da meia-noite com o app aberto.

### Fora da tela

10. Cada **card de programa** mostra "**N para revisar**" quando tem revisões vencidas.
11. Na tabela de atividades, a linha com revisão pendente mostra um **selo visível** ("Revisão
    hoje" / "Revisão atrasada"), além da faixa que pulsa. Antes, o texto só existia para leitor de
    tela.

## Fora do escopo

- Atividades que nunca foram feitas. Uma atividade só entra na agenda depois da primeira avaliação.
  Os flashcards entram assim que existem.
- Mudanças no agendamento do FSRS, pontuação ou gamificação, e o redesenho da sequência de dias.
- A cor de cada botão de avaliação e a prévia do intervalo: ficam para a etapa `clarify`.

## Escolhas técnicas

- `review.listSchedule` passa a trazer também o tipo, a URL e o arquivo da atividade, e o nome e a
  cor do programa.
- `src/utils/today-queue.ts`: funções puras e testadas que montam a fila (grupos, urgência, dias de
  atraso, baralhos agregados) e a prévia dos próximos dias.
- `useTodayQueue`: carrega a agenda e as contagens por dia. Recarrega em `onReviewCompleted` e na
  meia-noite.
- A revisão de baralho sai de dentro do `ReviewSessionDialog` para um `FlashcardReviewPanel`, usado
  pela janela antiga e pela sessão.
