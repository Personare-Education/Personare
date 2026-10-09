# Spec — Meta de retenção escolhida pelo aluno

- **Pedido do usuário (2026-10-09):** seguir com as melhorias da revisão do projeto. Quinta frente: o FSRS
  agendava sempre para 90% de retenção (o padrão do `ts-fsrs`). As duas pessoas do `PRODUCT.md` pedem
  coisas diferentes: o aluno do semestre equilibra várias matérias; quem vai fazer prova com data marcada
  aceita mais revisões para lembrar mais.
- **Branch:** `feature/retencao-alvo`, empilhada sobre `feature/log-de-erros`.
- **Retenção** é a parte do que vence que o aluno quer acertar no dia em que vence. O FSRS escolhe o
  intervalo para chegar nela: mais alta traz a revisão mais cedo, e há mais revisões.

## Critérios de aceite

1. **Configuração:** `app_settings.desired_retention` (migration `0018_desired_retention`), padrão 0,9.
   `settings.get` devolve; `settings.setDesiredRetention` grava, aceitando de 0,8 a 0,95 e recusando o
   resto.
2. **FSRS:** `applyRating` e `previewRatings` aceitam `desiredRetention` (padrão 0,9, o de antes), tanto no
   agendador de flashcards quanto no de atividades inteiras. Retenção mais alta dá intervalo menor.
3. **Avaliar usa a meta salva:** `submitRating`, `markActivityDifficulty` e `previewRatings` leem a meta das
   Configurações. A prévia dos botões mostra o que a avaliação vai agendar.
4. **Configurações → Geral:** "Meta de retenção", com 80%, 85%, 90% e 95%; a salva aparece marcada. 80%
   diz "menos revisões", 90% "recomendado" e 95% "antes de uma prova" (no nome lido pelo leitor de tela e
   na dica). O texto explica a troca e que vale a partir da próxima avaliação.
5. **O que já está agendado não muda:** cada item passa a usar a meta nova quando for avaliado de novo.
   Reagendar tudo de uma vez fica para depois, se fizer falta.
6. O backup leva a meta junto (o JSON do backup já copia a linha inteira); um backup antigo, sem ela,
   restaura com 0,9.
7. Os textos novos existem nos nove idiomas.
