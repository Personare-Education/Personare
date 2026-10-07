# Spec — Ofensiva acesa, som de acerto e ranking

- **Pedido do usuário (2026-10-07):** "um feedback visual ao acender a ofensiva do dia", "um feedback sonoro
  satisfatório ao acertar uma questão, seja de quiz ou de prova", e "um sistema de pontos, estes pontos serão
  utilizados para o usuário escalar as divisões (será como um jogo competitivo), sendo 7 tiers com 3 divisões
  cada, mais 1 ou 2 tiers de elite por leaderboard, totalizando 22 a 25 degraus".
- **Decisões do usuário:**
  - **Som na prova:** durante a prova, silêncio (o som entregaria a resposta). No **resultado**, um som por
    acerto enquanto a nota sobe, e um som de vitória se passou.
  - **O que dá pontos:** revisões feitas, acertos em quiz, provas (nota e bônus por passar) e a ofensiva
    (um bônus que cresce com os dias seguidos).
  - **Local primeiro:** pontos, tiers e divisões no app agora, sem outros usuários. Os tiers de elite ligados
    a um leaderboard global vêm numa etapa seguinte, com o Study-Butler-Backend.
  - **Temporadas e perda:** temporadas com reset suave alguns degraus abaixo; perde pontos quando revisões
    vencem sem ser feitas ou quando a ofensiva quebra.
- **Propostas desta spec (o usuário pode ajustar):** os valores de pontos, os limites de cada divisão, a
  duração da temporada e os nomes dos tiers, marcados com *(proposta)*.
- **Metodologia:** Spec Driven Development + TDD, em PRs empilhados a partir de `main`, CHANGELOG no último.

## 1. Ofensiva acesa

- A ofensiva do dia **acende** na primeira revisão do dia (é quando o dia passa a contar, docs/specs do
  streak). Hoje o número só muda em silêncio.
- **Critérios de aceite:**
  1. Quando uma revisão acende a ofensiva do dia, a chama da barra lateral **acende**: cresce, brilha e solta
     faíscas por cerca de 1 s, junto com o número novo. Nas revisões seguintes do mesmo dia, nada; ao abrir o
     app num dia já aceso, também nada (só acende o que acontece com o app aberto).
  2. Junto, um aviso curto: "Ofensiva acesa: 6 dias" (ou "Ofensiva começou", no primeiro dia), anunciado aos
     leitores de tela.
  3. Com "reduzir movimento" do sistema, sem animação: a chama só troca de cor e o aviso aparece.
  4. Acender é detectado comparando a ofensiva antes e depois da revisão (`computeCurrentStreak` com e sem
     hoje), não por um contador à parte.

## 2. Som de acerto

- **Sons gerados no app** (Web Audio: notas curtas com envelope), sem arquivos de áudio nem licenças.
- **Critérios de aceite:**
  1. No **quiz**, confirmar uma resposta certa toca um som de acerto (duas notas subindo, curto, ~250 ms), e
     uma errada toca um som de erro (pedido do usuário, 2026-10-07): duas notas descendo, mais graves e mais
     baixas, que dizem "não" sem soar como castigo.
  2. Na **prova**, nenhum som até entregar. No resultado, enquanto a nota sobe, um som por acerto (notas que
     sobem um pouco a cada acerto, num ritmo que acompanha a contagem) e, se passou, um acorde de vitória no
     fim.
  3. **Configurações → Geral → Sons**, ligado por padrão. Desligado, nada toca. Fica no banco (vai no backup).
  4. O som nunca atrasa nem trava a tela: se o áudio não estiver disponível, segue sem som.

## 3. Pontos

- **Livro de pontos** (`point_events`): cada ganho ou perda é uma linha (quando, de quê, quanto, a
  temporada). O total é a soma; nada é recalculado do histórico das revisões, então mudar as regras no futuro
  não mexe no que já foi ganho.
- **Ganhos** *(proposta)*:
  - **Revisão** avaliada: Errei 4, Difícil 8, Bom 10, Fácil 12; **+5** se feita no dia em que venceu (ou antes),
    sem atraso. Um card de baralho conta como uma revisão.
  - **Acerto em quiz:** 3 por questão certa. Para não virar fazenda, um mesmo quiz só dá pontos de acerto
    uma vez por dia.
  - **Prova:** 3 por acerto + **30** se passou. Uma mesma prova só dá pontos uma vez por dia (a primeira
    tentativa do dia).
  - **Ofensiva:** os ganhos do dia levam **+2% por dia de ofensiva**, até **+40%** (20 dias).
- **Perdas** *(proposta)*:
  - **Revisão vencida:** quando o app abre (ou vira o dia), cada item que passou a ter **mais de 1 dia de
    atraso** desde a última verificação tira **2** pontos, até **30** por dia.
  - **Ofensiva quebrada:** **20** pontos, uma vez, quando um dia passa sem revisão depois de uma ofensiva de 3
    dias ou mais.
  - Os pontos da temporada nunca ficam abaixo de 0.
- Itens trancados (docs/specs/sequences-and-locks.md) não vencem para efeito de perda: eles nem aparecem em
  Hoje.
- **Critérios de aceite:**
  1. `scorePoints` (`src/utils/points.ts`, puro) calcula o ganho de uma revisão, de um quiz e de uma prova,
     com o bônus de ofensiva, e as perdas de um dia; testes cobrem cada regra acima.
  2. Avaliar uma revisão, terminar um quiz e entregar uma prova gravam o ganho; abrir o app ou virar o dia
     grava as perdas do período (uma vez só, mesmo abrindo o app de novo).
  3. `points.summary()` devolve os pontos da temporada, o degrau, o próximo degrau e o quanto falta.
  4. O backup leva o livro de pontos; um backup antigo restaura com zero pontos.

## 4. Tiers, divisões e temporadas

- **7 tiers × 3 divisões (III → II → I) = 21 degraus**, mais **Mestre** (um degrau, sem divisão, por pontos) =
  **22 degraus locais**. Na etapa global, entram **Grão-Mestre** e **Desafiante** (os melhores do leaderboard),
  totalizando **24**.
- **Nomes** *(proposta)*: Ferro, Bronze, Prata, Ouro, Platina, Esmeralda, Diamante, Mestre.
- **Tamanho de cada divisão** *(proposta)*, crescente: Ferro 100, Bronze 150, Prata 200, Ouro 300,
  Platina 400, Esmeralda 500, Diamante 700. Mestre a partir de **7.050** pontos. Quem faz ~25 revisões por
  dia no prazo, com ofensiva, ganha ~400 por dia: Mestre em cerca de 3 semanas de constância.
- **Temporada** *(proposta)*: **trimestral** (jan–mar, abr–jun, jul–set, out–dez). Ao começar uma nova, os
  pontos voltam ao início do degrau **6 abaixo** do final (dois tiers), no mínimo Ferro III. A temporada
  anterior fica no histórico com o degrau alcançado.
- **Critérios de aceite:**
  1. `rankOf(points)` (puro) devolve tier, divisão, o degrau (1 a 22), o início e o fim dele.
  2. Na barra lateral, junto da ofensiva, o **emblema** do degrau (ícone e cor do tier, "Prata II") e uma
     barra do progresso até o próximo. Clicar abre o **Ranking**: o degrau atual, os pontos da temporada, a
     escada inteira (o seu degrau marcado), os últimos ganhos e perdas, e as temporadas passadas.
  3. **Subir** de degrau: o emblema anima e um aviso diz "Subiu para Prata I"; subir de **tier** tem uma
     comemoração maior (com o acorde do §2, se os sons estiverem ligados). **Descer**: um aviso discreto, sem
     som.
  4. Ao virar a temporada, o Ranking mostra o resumo da que acabou e o novo ponto de partida.
  5. Com "reduzir movimento", sem animação.

## PRs

1. **Ofensiva acesa** (`feature/streak-ignite`): §1.
2. **Sons** (`feature/answer-sounds`): §2, com o ajuste em Configurações.
3. **Pontos** (`feature/points-data`): §3, migração, regras puras, gravar ganhos e perdas, backup.
4. **Ranking na tela** (`feature/ranks-ui`): §4 e o CHANGELOG.
