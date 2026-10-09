# Spec — Modo B v1: estudar para uma prova com data

- **Pedido do usuário (2026-10-09):** "vamos tirar os dois modos do papel hoje mesmo".
- **Arquitetura:** `docs/architecture/scheduling.md`, decisões D2, D5, D6 e D7.
- **Branch:** `feature/modo-prova`, empilhada sobre `feature/review-logs`. Último PR da pilha: traz o
  CHANGELOG.

## Critérios de aceite

1. **Política pura** (`src/utils/scheduling-policy.ts`, D6): `scheduleForGoal(vencimento do FSRS,
   programa, agora)`.
   - Em "Nunca mais esquecer", ou sem programa encontrado: o vencimento do FSRS.
   - Em "Estudar para uma Prova", com a prova por vir: `min(vencimento do FSRS, véspera)`, sendo a véspera
     o início do dia anterior à prova, no horário local.
   - Se a véspera já passou (a prova é hoje ou amanhã): o vencimento do FSRS.
   - Depois do dia da prova, o programa age como "Nunca mais esquecer" (D2).
2. **Avaliar aplica a política:** `submitRating` e `markActivityDifficulty` gravam o vencimento já
   limitado (e os `scheduledDays` coerentes com ele). O `review_logs` registra esse vencimento. O modelo de
   memória (estabilidade, dificuldade) não muda: só a política.
3. **A prévia dos botões** mostra o mesmo vencimento limitado.
4. **Contagem regressiva** no cartão do programa e ao lado do dia, no painel de objetivo da página do
   programa: "Prova em N dias", "Prova hoje" e, depois, "A prova foi
   em …" (em cinza). Nada aparece em "Nunca mais esquecer".
5. Vale para os dois tipos de item (D5): flashcards e atividades inteiras.
6. Os textos novos existem nos nove idiomas, com os plurais de cada um.

## Fora desta versão (D8)

O teto diário e a distribuição de carga (v1.1) e a ordenação do dia por `Score(i,t)` (v2), que depende da
calibração (D4) e do simulador (D9).
