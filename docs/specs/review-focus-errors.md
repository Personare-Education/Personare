# Spec — Foco e erros na revisão

- **Branch:** `fix/review-focus-errors` (3 de 6 PRs empilhados, sobre `fix/sidebar-current-page`)
- **Origem:** P1 da quarta crítica de design: ao revelar a resposta o botão "Revelar" some e o foco cai no
  `body`, então quem usa o teclado perde o lugar; e se salvar a avaliação falha, nada acontece, o cartão
  fica parado sem nenhuma explicação.
- **Metodologia:** Spec Driven Development + TDD (Red-Green-Refactor), conforme `CONTRIBUTING.md`.

## Critérios de aceite

1. Ao revelar a resposta de um flashcard, o foco vai para a avaliação "Bom", a mais comum. Enter confirma,
   Tab passa pelas outras.
2. Na sessão de Hoje, quando uma atividade aberta (PDF, link, quiz) passa a pedir a avaliação, o foco vai
   para a avaliação do meio ("Fiz bem") do mesmo jeito.
3. Se salvar a avaliação falha (flashcard na revisão, atividade na sessão de Hoje ou no diálogo de
   avaliação), o item continua na tela e aparece, junto dos botões, "Não foi possível salvar a avaliação.
   Tente de novo." como alerta (`role="alert"`). Avaliar de novo tenta outra vez e, dando certo, o alerta
   some e a revisão segue.
4. Enquanto uma avaliação está sendo salva, outra não é enviada (um duplo clique ou duas teclas não
   avaliam duas vezes).

## Escolhas técnicas

- `RatingButtons` ganha `autoFocus` (foca "good" ao montar) e `disabled` (ignora cliques e as teclas 1-4).
- `RatingSaveError` (em `rating-buttons.tsx`) é a mensagem compartilhada; cada chamador guarda `saving` e
  `saveFailed` e mostra o alerta.
