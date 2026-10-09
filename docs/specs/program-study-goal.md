# Spec — O objetivo do programa: "Nunca mais esquecer" ou "Estudar para uma Prova"

- **Pedido do usuário (2026-10-09):** "ao criar um programa essa decisão seja tomada: ou 'Nunca mais
  esquecer' ou 'Estudar para uma Prova'"; "vamos tirar os dois modos do papel hoje mesmo".
- **Arquitetura:** `docs/architecture/scheduling.md`, decisões D1 e D2.
- **Branch:** `feature/objetivo-do-programa`, empilhada sobre `docs/scheduling-modes`.
- **Escopo:** só o dado e a escolha. O agendamento ainda não muda aqui; o Modo B v1 vem no PR seguinte da
  pilha (`docs/specs/test-prep-scheduling.md`).

## Critérios de aceite

1. **Dado:** `programs.study_goal` (`retain` | `test_prep`, padrão `retain`) e `programs.target_date` (dia
   local `yyyy-MM-dd`, ou nulo). Migration `0019_program_study_goal`. Programas antigos ficam em `retain`.
   Nada usa o nome `exam`, que é das Provas do app.
2. **Criar:** `programs.create` aceita `studyGoal` e `targetDate`. Sem objetivo, é `retain`. `test_prep`
   exige um dia válido (2026-02-31 é recusado). Com `retain`, a data é descartada.
3. **Editar:** `programs.update` troca o objetivo e a data. Uma edição que não fala do objetivo o mantém.
4. **Formulário:** criar e editar um programa mostram **Objetivo** com duas opções ("Nunca mais esquecer":
   "Revisões no ritmo da sua memória, sem data para acabar."; "Estudar para uma Prova": "Tudo volta antes do
   dia da prova."). "Nunca mais esquecer" vem marcada. Escolhendo a prova, aparece **Dia da prova**,
   obrigatório.
5. **Editar mostra o que está salvo**, objetivo e dia.
6. Programas criados pelo Claude (MCP) e por importação ficam em `retain`, o padrão do banco. O backup
   leva os dois campos; um backup antigo restaura com `retain`.
7. Os textos novos existem nos nove idiomas.
